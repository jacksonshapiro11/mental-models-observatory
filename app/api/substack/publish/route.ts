/**
 * /api/substack/publish — post the day's super brief to Substack.
 *
 * The system-of-record runtime for the Substack leg: runs server-side on
 * Vercel (clean egress — no sandbox proxies, no GH Actions token scopes),
 * fired by Vercel cron every morning after the brief lands, with a backstop.
 *
 * Resolution (no params, the cron path):
 *   - today's daily light exists → post it
 *   - else (zoom-out Sunday) → latest weekly light → post it
 *   - already on Substack (slug match) → idempotent skip
 *
 * Query params (manual runs):
 *   ?date=YYYY-MM-DD   — explicit daily
 *   ?weekly=2026-W30   — explicit weekly
 *   ?mode=draft|publish — override SUBSTACK_MODE (default: publish)
 *   ?send=false        — publish without Substack email
 *   ?dry=true          — build only; returns title/slug/size, no Substack call
 *
 * Env: SUBSTACK_COOKIES_STRING (auth), SUBSTACK_PUBLICATION_URL,
 *      SUBSTACK_MODE (default publish), SUBSTACK_SEND_EMAIL (default true).
 *
 * Protected by SNAPSHOT_SECRET / CRON_SECRET (lib/cron-auth).
 * Failures never block the brief pipeline — this is strictly downstream.
 */

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { todayET } from '@/lib/publish-date';
import { SubstackClient, SubstackError } from '@/lib/substack/client';
import {
  buildSubstackPost,
  composeSubstackDoc,
  sectionLabelsIn,
  SECTION_STRIPS,
  BuiltSubstackPost,
  SubstackPostKind,
} from '@/lib/substack/post-builder';
import type { PMNode } from '@/lib/substack/prosemirror';

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');
const WEEKLY_DIR = path.join(CONTENT_DIR, 'weekly');
const SITE_URL = 'https://www.cosmictrex.com';

interface ResolvedSource {
  kind: SubstackPostKind;
  sourceSlug: string;
  filePath: string;
}

function dailySource(date: string): ResolvedSource {
  return {
    kind: 'daily',
    sourceSlug: date,
    filePath: path.join(CONTENT_DIR, `${date}-light.md`),
  };
}

function weeklySource(slug: string): ResolvedSource {
  return {
    kind: 'weekly',
    sourceSlug: slug,
    filePath: path.join(WEEKLY_DIR, `${slug}-light.md`),
  };
}

/**
 * Upload the masthead + section-header strips to Substack's CDN and compose
 * the styled doc. Every upload is fault-tolerant: a miss degrades that
 * element to plain text/absence rather than failing the post.
 */
async function buildStyledDoc(
  client: SubstackClient,
  post: BuiltSubstackPost
): Promise<PMNode> {
  let mastheadSrc: string | null = null;
  try {
    mastheadSrc = await client.uploadImage(`${SITE_URL}/substack-masthead.png`);
  } catch (e) {
    console.warn('[substack] masthead upload failed, posting without:', e);
  }
  const sectionImages: Record<string, string> = {};
  await Promise.all(
    sectionLabelsIn(post.contentMarkdown).map(async key => {
      try {
        sectionImages[key] = await client.uploadImage(
          `${SITE_URL}/${SECTION_STRIPS[key]}`
        );
      } catch (e) {
        console.warn(`[substack] strip upload failed (${key}):`, e);
      }
    })
  );
  return composeSubstackDoc(post, mastheadSrc, sectionImages);
}

/** Latest weekly light on the deployed filesystem, by (year, week) numeric. */
function latestWeeklySlug(): string | null {
  if (!fs.existsSync(WEEKLY_DIR)) return null;
  let best: { year: number; week: number; slug: string } | null = null;
  for (const name of fs.readdirSync(WEEKLY_DIR)) {
    const m = /^(\d{4})-W(\d{1,2})-light\.md$/.exec(name);
    if (!m) continue;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (
      best === null ||
      year > best.year ||
      (year === best.year && week > best.week)
    ) {
      best = { year, week, slug: `${m[1]}-W${m[2]}` };
    }
  }
  return best ? best.slug : null;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dateParam = params.get('date');
  const weeklyParam = params.get('weekly');
  const dry = params.get('dry') === 'true';
  const mode = (
    params.get('mode') ||
    process.env.SUBSTACK_MODE ||
    'publish'
  ).toLowerCase();
  const sendEmail =
    (params.get('send') || process.env.SUBSTACK_SEND_EMAIL || 'true') !==
    'false';

  if (mode !== 'draft' && mode !== 'publish') {
    return NextResponse.json({ error: `Bad mode: ${mode}` }, { status: 400 });
  }

  // ── Resolve source file ──────────────────────────────────────────────────
  let source: ResolvedSource;
  const explicit = Boolean(dateParam || weeklyParam);
  if (weeklyParam) {
    if (!/^\d{4}-W\d{1,2}$/.test(weeklyParam)) {
      return NextResponse.json(
        { error: `Bad weekly slug: ${weeklyParam}` },
        { status: 400 }
      );
    }
    source = weeklySource(weeklyParam);
  } else if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: `Bad date: ${dateParam}` },
        { status: 400 }
      );
    }
    source = dailySource(dateParam);
  } else {
    const today = todayET();
    const daily = dailySource(today);
    if (fs.existsSync(daily.filePath)) {
      source = daily;
    } else {
      // Zoom-out Sunday (or missed daily): fall through to the latest weekly.
      // Never falls back to an older daily; a stale weekly idempotent-skips.
      const weekly = latestWeeklySlug();
      if (!weekly) {
        return NextResponse.json({
          status: 'skipped',
          reason: `no light brief for ${today} and no weekly light found`,
        });
      }
      source = weeklySource(weekly);
    }
  }

  if (!fs.existsSync(source.filePath)) {
    return NextResponse.json(
      {
        status: explicit ? 'error' : 'skipped',
        reason: `no light file for ${source.sourceSlug}`,
      },
      { status: explicit ? 404 : 200 }
    );
  }

  const markdown = fs.readFileSync(source.filePath, 'utf-8');
  if (markdown.length < 2000) {
    return NextResponse.json(
      {
        error:
          `light file for ${source.sourceSlug} suspiciously small ` +
          `(${markdown.length} bytes) — refusing to post`,
      },
      { status: 500 }
    );
  }

  const post = buildSubstackPost(markdown, source.sourceSlug, source.kind);

  // Test hook: publish/draft under a different slug (bypasses idempotency
  // against the real daily slug — used to preview styling changes safely).
  const slugOverride = params.get('slug');
  if (slugOverride) {
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slugOverride)) {
      return NextResponse.json(
        { error: `Bad slug: ${slugOverride}` },
        { status: 400 }
      );
    }
    post.slug = slugOverride;
  }

  if (dry) {
    return NextResponse.json({
      status: 'dry-run',
      kind: post.kind,
      title: post.title,
      subtitle: post.subtitle,
      slug: post.slug,
      epigraphPullquote: Boolean(post.epigraph),
      bodyChars: post.bodyMarkdown.length,
      blocks: composeSubstackDoc(post, null).content?.length ?? 0,
    });
  }

  // ── Config ───────────────────────────────────────────────────────────────
  const cookies = (process.env.SUBSTACK_COOKIES_STRING || '').trim();
  const pubUrl = (process.env.SUBSTACK_PUBLICATION_URL || '').trim();
  if (!cookies || !pubUrl) {
    return NextResponse.json(
      {
        status: 'not-configured',
        reason:
          'Set SUBSTACK_COOKIES_STRING and SUBSTACK_PUBLICATION_URL in ' +
          'Vercel env (Production) and redeploy.',
      },
      { status: 503 }
    );
  }

  const client = new SubstackClient(cookies, pubUrl);
  const restyle = params.get('restyle') === 'true';

  try {
    // Auth check + user id in one call.
    const userId = await client.getUserId();

    // ── Restyle: rebuild an ALREADY-PUBLISHED post with the current template
    // (masthead, pullquote, cover) and save it live WITHOUT re-emailing. ──────
    if (restyle) {
      const published = await client.listPublished(25);
      const target = published.find(p => p.slug === post.slug);
      if (!target || typeof target.id !== 'number') {
        return NextResponse.json(
          { error: `No published post with slug ${post.slug} to restyle` },
          { status: 404 }
        );
      }
      const doc = await buildStyledDoc(client, post);
      await client.updateDraft(target.id, {
        draft_title: post.title,
        draft_subtitle: post.subtitle,
        draft_body: JSON.stringify(doc),
      });
      try {
        const coverSource =
          post.kind === 'daily'
            ? `${SITE_URL}/api/og/super-brief/${post.sourceSlug}`
            : `${SITE_URL}/substack-cover.png`;
        const cover = await client.uploadImage(coverSource);
        await client.updateDraft(target.id, { cover_image: cover });
      } catch (e) {
        console.warn('[substack] cover upload failed during restyle:', e);
      }
      // publish with send:false = "save" on a live post; no email goes out.
      await client.publishDraft(target.id, false);
      return NextResponse.json({
        status: 'restyled',
        slug: post.slug,
        url: `${client.publicationUrl()}/p/${post.slug}`,
        emailSent: false,
      });
    }

    // ── Idempotency: never double-post a slug ──────────────────────────────
    const published = await client.listPublished(25);
    const existing = published.find(p => p.slug === post.slug);
    if (existing) {
      return NextResponse.json({
        status: 'exists',
        slug: post.slug,
        url: `${client.publicationUrl()}/p/${post.slug}`,
      });
    }

    // Reuse a matching draft (e.g. an earlier draft-mode run) instead of
    // creating a duplicate; publish it in place when mode=publish.
    const drafts = await client.listDrafts(25);
    const existingDraft = drafts.find(
      d => d.slug === post.slug || (d.draft_title || '').trim() === post.title
    );

    let draftId: number;
    if (existingDraft && typeof existingDraft.id === 'number') {
      draftId = existingDraft.id;
    } else {
      const doc = await buildStyledDoc(client, post);
      const created = await client.createDraft({
        draft_title: post.title,
        draft_subtitle: post.subtitle,
        draft_body: JSON.stringify(doc),
        draft_bylines: [{ id: userId, is_guest: false }],
        audience: 'everyone',
        draft_section_id: null,
        section_chosen: true,
        write_comment_permissions: 'everyone',
      });
      draftId = created.id;
      await client.updateDraft(draftId, { slug: post.slug });

      // Cover image for inbox/social cards: the site's dynamic OG card for
      // dailies (matches cosmictrex.com), static brand card for weeklies.
      try {
        const coverSource =
          post.kind === 'daily'
            ? `${SITE_URL}/api/og/super-brief/${post.sourceSlug}`
            : `${SITE_URL}/substack-cover.png`;
        const cover = await client.uploadImage(coverSource);
        await client.updateDraft(draftId, { cover_image: cover });
      } catch (e) {
        console.warn('[substack] cover upload failed, continuing:', e);
      }
    }

    if (mode === 'draft') {
      return NextResponse.json({
        status: 'draft',
        kind: post.kind,
        draftId,
        title: post.title,
        editorUrl: `${client.publicationUrl()}/publish/post/${draftId}`,
      });
    }

    await client.prepublishDraft(draftId);
    const publishedPost = await client.publishDraft(draftId, sendEmail);
    return NextResponse.json({
      status: 'published',
      kind: post.kind,
      title: post.title,
      slug: publishedPost.slug || post.slug,
      url: `${client.publicationUrl()}/p/${publishedPost.slug || post.slug}`,
      emailSent: sendEmail,
    });
  } catch (err) {
    const cloudflare = err instanceof SubstackError && err.cloudflare;
    const message = err instanceof Error ? err.message : String(err);
    console.error('[substack] publish failed:', message);
    return NextResponse.json(
      {
        status: 'error',
        error: message,
        hint: cloudflare
          ? 'Cloudflare challenge or expired session — refresh ' +
            'SUBSTACK_COOKIES_STRING from a logged-in browser and redeploy.'
          : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
