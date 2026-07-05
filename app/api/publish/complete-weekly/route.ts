/**
 * /api/publish/complete-weekly — weekly-aware audio + email failsafe (Vercel cron).
 *
 * Why this exists: the sandbox sessions that publish the Weekly cannot reliably
 * reach this host to POST /api/publish/complete?weekly= (proxy allowlist varies
 * per session — this stranded 2026-W27's audio + email on 2026-07-05 even though
 * the content was live). This route runs ON Vercel via cron, so no sandbox proxy
 * can block it. Closes Pipeline_Controller "ZOOM-OUT DAY / Build status" gap (1).
 *
 * Behavior (daily at 10:15Z, after the 9:55Z daily failsafe):
 *   - Resolves the newest published Weekly and its ISO-week Sunday.
 *   - Inside its Sun→Sat window: runs the idempotent weekly completion
 *     (audio + email — skips anything already done, so most days it's a no-op).
 *   - Outside the window: skips. Never backfills audio/email for an old weekly.
 *
 * Query: ?weekly=YYYY-Www (optional explicit override — always runs, no window check)
 * Auth: Bearer CRON_SECRET or SNAPSHOT_SECRET
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { runWeeklyPublishComplete } from '@/lib/publish/weekly-complete';
import { getAllWeeklyLightSlugs } from '@/lib/weekly-light-parser';
import { isoWeekSunday } from '@/lib/weekly-window';
import { todayET } from '@/lib/publish-date';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const explicit = req.nextUrl.searchParams.get('weekly')?.trim() || null;
    if (explicit) {
      return await runWeeklyPublishComplete(explicit);
    }

    const slug = getAllWeeklyLightSlugs()[0] ?? null;
    const sunday = slug ? isoWeekSunday(slug) : null;
    if (!slug || !sunday) {
      return NextResponse.json({ skipped: true, reason: 'No weekly published yet' });
    }

    const today = todayET();
    const end = new Date(`${sunday}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    const windowEnd = end.toISOString().slice(0, 10);

    if (today < sunday || today > windowEnd) {
      return NextResponse.json({
        skipped: true,
        weekly: slug,
        reason: `Outside completion window (${sunday} to ${windowEnd}, today ${today})`,
      });
    }

    return await runWeeklyPublishComplete(slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[publish/complete-weekly] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Weekly publish pipeline failed', detail: message },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
