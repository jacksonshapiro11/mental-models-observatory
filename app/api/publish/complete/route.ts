/**
 * /api/publish/complete — Post-publish orchestrator
 *
 * Fires light audio, distribution (email + X), and marketing pack in parallel.
 * Each step logs to Redis for retry cron visibility.
 *
 * Query: ?date=YYYY-MM-DD (optional, defaults to today ET)
 * Auth: Bearer CRON_SECRET or SNAPSHOT_SECRET
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { resolvePublishDate } from '@/lib/publish-date';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { generateLightAudio } from '@/lib/audio/light-generate';
import { runDistribute } from '@/lib/distribute/handler';
import { generateDailyPack } from '@/lib/marketing/generate-daily-pack';
import { writeStepLog, writeAudioLog } from '@/lib/marketing/distribute-log';

function stepStatus(success: boolean): 'success' | 'failed' {
  return success ? 'success' : 'failed';
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date: dateSlug, manual } = resolvePublishDate(req.nextUrl.searchParams.get('date'));

  if (!getBriefLightByDate(dateSlug)) {
    return NextResponse.json({
      date: dateSlug,
      skipped: true,
      reason: `No brief published for ${dateSlug}`,
    });
  }

  console.log(`[publish/complete] Starting parallel pipeline for ${dateSlug}`);

  const [audioSettled, distributeSettled, marketingSettled] = await Promise.allSettled([
    generateLightAudio({ date: dateSlug, manual }),
    runDistribute({ dateSlug }),
    generateDailyPack(dateSlug),
  ]);

  const at = new Date().toISOString();
  const summary: Record<string, unknown> = { date: dateSlug, at };

  // Light audio
  if (audioSettled.status === 'fulfilled') {
    const audio = audioSettled.value;
    const audioOk = audio.status === 'success' || audio.status === 'exists';
    const audioLog: Parameters<typeof writeAudioLog>[1] = {
      status: audioOk ? 'success' : audio.status === 'skipped' ? 'skipped' : 'failed',
      at,
    };
    const audioDetails = audio.details || audio.error;
    if (audioDetails) audioLog.details = audioDetails;
    if (audio.error) audioLog.error = audio.error;
    await writeAudioLog(dateSlug, audioLog);
    summary.audio = audio;
  } else {
    const err = audioSettled.reason instanceof Error ? audioSettled.reason.message : String(audioSettled.reason);
    await writeAudioLog(dateSlug, { status: 'failed', error: err, at });
    summary.audio = { status: 'error', error: err };
  }

  // Distribute (email + X)
  if (distributeSettled.status === 'fulfilled') {
    const results = distributeSettled.value;
    if (results.email) {
      const emailEntry: Parameters<typeof writeStepLog>[2] = {
        status: stepStatus(results.email.success),
        at,
      };
      if (results.email.details) emailEntry.details = results.email.details;
      await writeStepLog(dateSlug, 'email', emailEntry);
    }
    if (results.x) {
      const xEntry: Parameters<typeof writeStepLog>[2] = {
        status: stepStatus(results.x.success),
        at,
      };
      if (results.x.details) xEntry.details = results.x.details;
      if (results.x.tweetId) xEntry.tweetId = results.x.tweetId;
      await writeStepLog(dateSlug, 'x', xEntry);
    }
    summary.distribute = results;
  } else {
    const err =
      distributeSettled.reason instanceof Error
        ? distributeSettled.reason.message
        : String(distributeSettled.reason);
    await writeStepLog(dateSlug, 'email', { status: 'failed', error: err, at });
    await writeStepLog(dateSlug, 'x', { status: 'failed', error: err, at });
    summary.distribute = { error: err };
  }

  // Marketing pack (best-effort)
  if (marketingSettled.status === 'fulfilled') {
    summary.marketing = marketingSettled.value;
  } else {
    summary.marketing = {
      success: false,
      error:
        marketingSettled.reason instanceof Error
          ? marketingSettled.reason.message
          : String(marketingSettled.reason),
    };
  }

  const allOk =
    (summary.audio as { status?: string })?.status !== 'error' &&
    (summary.distribute as { email?: { success: boolean }; x?: { success: boolean } })?.email?.success !== false &&
    (summary.distribute as { x?: { success: boolean } })?.x?.success !== false;

  return NextResponse.json({ ...summary, success: allOk }, { status: allOk ? 200 : 207 });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
