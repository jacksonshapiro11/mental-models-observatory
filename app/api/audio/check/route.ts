/**
 * /api/audio/check — Post-deploy audio trigger
 *
 * GET: Checks if the latest brief has audio. If not, triggers generation.
 * Call this after publishing a brief to ensure audio is generated.
 *
 * This is the recommended way to trigger audio after a brief publish.
 * The cron job at /api/audio/generate serves as a backup.
 *
 * Auth: same as /api/audio/generate (SNAPSHOT_SECRET or CRON_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLatestBrief } from '@/lib/daily-update-parser';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) return false;

  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret && snapshotSecret && secret === snapshotSecret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (cronSecret && token === cronSecret) return true;
    if (snapshotSecret && token === snapshotSecret) return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const brief = getLatestBrief();
    if (!brief) {
      return NextResponse.json({ status: 'no_brief', message: 'No brief found' });
    }

    const existing = await readEpisodeMetadata(brief.date);
    if (existing) {
      return NextResponse.json({
        status: 'exists',
        message: `Audio already exists for ${brief.date}`,
        episode: existing,
      });
    }

    // Audio doesn't exist — trigger generation by calling the generate endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const secret = process.env.SNAPSHOT_SECRET;

    console.log(`[audio/check] No audio for ${brief.date}, triggering generation...`);

    const generateUrl = `${baseUrl}/api/audio/generate?date=${brief.date}&secret=${secret}`;
    const resp = await fetch(generateUrl, { method: 'POST' });
    const result = await resp.json();

    return NextResponse.json({
      status: 'triggered',
      briefDate: brief.date,
      generateResult: result,
    });
  } catch (err) {
    console.error('[audio/check] Error:', err);
    return NextResponse.json(
      { error: 'Check failed', detail: String(err) },
      { status: 500 }
    );
  }
}
