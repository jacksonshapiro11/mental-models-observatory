/**
 * /api/audio/light/generate — Brief Light (Super Brief) audio generation endpoint
 *
 * Completely standalone — does NOT modify or depend on the main brief audio pipeline.
 *
 * POST: Generates audio for a Brief Light. Reads the -light.md file,
 * preprocesses it for TTS, generates audio via OpenAI, uploads to
 * Vercel Blob, and stores metadata in Redis (light namespace).
 *
 * Query params:
 *   ?date=YYYY-MM-DD  — Generate for a specific date (defaults to latest)
 *   ?force=true       — Regenerate even if audio already exists
 *
 * Protected by SNAPSHOT_SECRET / CRON_SECRET (same auth pattern as main pipeline).
 * Triggered by Vercel cron or manual POST.
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { resolvePublishDate } from '@/lib/publish-date';
import { generateLightAudio } from '@/lib/audio/light-generate';
import { readLightEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { writeAudioLog } from '@/lib/marketing/distribute-log';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get('date');
  const force = req.nextUrl.searchParams.get('force') === 'true';
  const { date: targetDate, manual } = resolvePublishDate(dateParam);

  const result = await generateLightAudio({ date: targetDate, force, manual });

  if (result.status === 'skipped') {
    return NextResponse.json({ status: 'skipped', reason: result.details, date: result.date });
  }

  if (result.status === 'error' && manual) {
    return NextResponse.json(
      { error: 'Brief Light not found', date: result.date },
      { status: 404 },
    );
  }

  if (result.status === 'error') {
    const audioLog: Parameters<typeof writeAudioLog>[1] = {
      status: 'failed',
      at: new Date().toISOString(),
    };
    if (result.error) audioLog.error = result.error;
    await writeAudioLog(targetDate, audioLog);
    return NextResponse.json(
      { error: 'Super Brief audio generation failed', detail: result.error },
      { status: 500 },
    );
  }

  if (result.status === 'exists') {
    const audioLog: Parameters<typeof writeAudioLog>[1] = {
      status: 'success',
      at: new Date().toISOString(),
    };
    if (result.details) audioLog.details = result.details;
    await writeAudioLog(targetDate, audioLog);
    return NextResponse.json({
      status: 'exists',
      message: result.details,
      episode: result.episode,
    });
  }

  let feedVerified = false;
  try {
    const storedEpisode = await readLightEpisodeMetadata(result.date);
    feedVerified = !!storedEpisode && storedEpisode.audioUrl === result.episode?.audioUrl;
  } catch (verifyErr) {
    console.warn(`[audio:light] Verification error: ${verifyErr}`);
  }

  await writeAudioLog(result.date, {
    status: 'success',
    at: new Date().toISOString(),
    ...(result.details ? { details: result.details } : {}),
  });

  return NextResponse.json({
    status: 'success',
    episode: result.episode,
    feedVerified,
    details: result.details,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
