/**
 * Build a Substack post from a Brief Light (daily) or Weekly Light markdown.
 *
 * Conventions (Jackson, 2026-07-24/25):
 *   - Title = thesis headline (first bold-only line in the sections), same
 *     rule as the email subject in lib/email/render-brief.ts; falls back to
 *     the daily editorial title.
 *   - Subtitle = the lede, truncated.
 *   - Post body opens with the Cosmic Trex masthead image (uploaded to
 *     Substack's CDN at publish time), then the Spotify + full-brief links,
 *     then the epigraph as a styled pullquote, then the light verbatim minus
 *     the `# … LIGHT` masthead, date heading, and epigraph line.
 */

import { parseBriefLight } from '../brief-light-parser';
import {
  PMNode,
  markdownToBlocks,
  parseInline,
  captionedImage,
  pullquote,
} from './prosemirror';

const SPOTIFY_SHOW_URL = 'https://open.spotify.com/show/0MhCdB3jidaoJ25kg7zr6O';
const SITE_URL = 'https://www.cosmictrex.com';

export type SubstackPostKind = 'daily' | 'weekly';

export interface BuiltSubstackPost {
  title: string;
  subtitle: string;
  slug: string;
  kind: SubstackPostKind;
  sourceSlug: string; // 2026-07-25 or 2026-W30
  linkLine: string;
  epigraph: string;
  contentMarkdown: string; // body minus masthead/date/epigraph lines
  bodyMarkdown: string; // linkLine + contentMarkdown (dry-run stats)
}

function truncate(text: string, n: number): string {
  const t = text.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}…`;
}

/** First bold-only line inside the sections = thesis headline. */
function extractThesis(markdown: string): string {
  let inSections = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^##\s*▸/.test(line)) {
      inSections = true;
      continue;
    }
    if (!inSections) continue;
    const m = /^\*\*(.+?)\*\*$/.exec(line);
    if (m && m[1] && !m[1].startsWith('[')) {
      // Strip a trailing period for title use (weekly theses end with one).
      return m[1].trim().replace(/\.$/, '');
    }
  }
  return '';
}

export function buildSubstackPost(
  markdown: string,
  sourceSlug: string,
  kind: SubstackPostKind
): BuiltSubstackPost {
  const meta = parseBriefLight(markdown, sourceSlug);
  const thesis = extractThesis(markdown);

  const base =
    thesis || meta.dailyTitle || `Brief — ${meta.displayDate || sourceSlug}`;
  const title = kind === 'weekly' ? `The Weekly: ${base}` : base;
  const subtitle = truncate(meta.lede || meta.epigraph, 200);

  const fullUrl =
    kind === 'weekly'
      ? `${SITE_URL}/weekly/${sourceSlug}`
      : `${SITE_URL}/daily-update/${sourceSlug}`;
  const fullLabel =
    kind === 'weekly'
      ? 'Read the full Weekly on cosmictrex.com'
      : 'Read the full brief on cosmictrex.com';
  const linkLine =
    `🎧 [Listen on Spotify](${SPOTIFY_SHOW_URL}) · ` +
    `📖 [${fullLabel}](${fullUrl})`;

  // Strip the `# BRIEF LIGHT` / `# WEEKLY LIGHT` masthead, the date heading,
  // and the epigraph line (re-emitted as a pullquote); the rest ships verbatim.
  const bodyLines: string[] = [];
  let seenTitle = false;
  let epigraphTaken = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^#\s+(BRIEF|WEEKLY)\s+LIGHT\s*$/i.test(line)) continue;
    if (
      line.startsWith('## ') &&
      !line.includes('▸') &&
      meta.displayDate &&
      line.slice(3).trim() === meta.displayDate
    ) {
      continue;
    }
    if (line.startsWith('### ') && !line.includes('▸')) seenTitle = true;
    if (
      !seenTitle &&
      !epigraphTaken &&
      meta.epigraph &&
      line.startsWith('*') &&
      line.endsWith('*') &&
      !line.startsWith('**')
    ) {
      epigraphTaken = true;
      continue;
    }
    bodyLines.push(raw);
  }
  const contentMarkdown = bodyLines.join('\n').trim();

  return {
    title,
    subtitle,
    slug: `brief-${sourceSlug.toLowerCase()}`,
    kind,
    sourceSlug,
    linkLine,
    epigraph: meta.epigraph,
    contentMarkdown,
    bodyMarkdown: `${linkLine}\n\n${contentMarkdown}\n`,
  };
}

/**
 * Assemble the full ProseMirror doc: masthead image (when its Substack CDN
 * URL is available), the link line, the epigraph pullquote, then the body.
 */
export function composeSubstackDoc(
  post: BuiltSubstackPost,
  mastheadSrc?: string | null
): PMNode {
  const blocks: PMNode[] = [];
  if (mastheadSrc) {
    blocks.push(
      captionedImage(mastheadSrc, {
        href: SITE_URL,
        alt: 'Cosmic Trex — Markets, Meditations & Mental Models',
        width: 1456,
        height: 480,
      })
    );
  }
  blocks.push({ type: 'paragraph', content: parseInline(post.linkLine) });
  if (post.epigraph) {
    blocks.push(pullquote(post.epigraph));
  }
  blocks.push(...markdownToBlocks(post.contentMarkdown));
  return { type: 'doc', content: blocks };
}
