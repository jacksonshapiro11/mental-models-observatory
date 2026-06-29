/**
 * /api/audio/generate — Audio generation endpoint
 *
 * POST: Generates audio for a daily brief. Thin wrapper around lib/audio/full-generate.
 *
 * Query params:
 *   ?date=YYYY-MM-DD  — Generate for a specific date (defaults to today ET)
 *   ?force=true       — Regenerate even if audio already exists
 *
 * Protected by SNAPSHOT_SECRET / CRON_SECRET.
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { resolvePublishDate } from '@/lib/publish-date';
import { generateFullBriefAudio } from '@/lib/audio/full-generate';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get('date');
  const force = req.nextUrl.searchParams.get('force') === 'true';

  if (dateParam && /-light$/i.test(dateParam)) {
    return NextResponse.json(
      {
        error: 'Wrong endpoint',
        detail: `Date "${dateParam}" is a Brief Light date. Call /api/audio/light/generate?date=${dateParam.replace(/-light$/i, '')} instead.`,
      },
      { status: 400 },
    );
  }

  const { date: targetDate, manual } = resolvePublishDate(dateParam);
  const result = await generateFullBriefAudio({ date: targetDate, force, manual });

  if (result.status === 'error') {
    return NextResponse.json(
      { error: result.error || 'Audio generation failed', date: targetDate },
      { status: manual ? 404 : 500 },
    );
  }

  if (result.status === 'skipped') {
    return NextResponse.json({
      status: 'skipped',
      reason: result.details,
      date: targetDate,
    });
  }

  if (result.status === 'exists') {
    return NextResponse.json({
      status: 'exists',
      message: result.details,
      episode: result.episode,
    });
  }

  return NextResponse.json({
    status: 'success',
    episode: result.episode,
    stats: { details: result.details },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
