/**
 * weekly-complete — the Weekly's post-publish pipeline (audio + email).
 *
 * Extracted verbatim from app/api/publish/complete/route.ts so it can be
 * shared by two routes without illegal route-file exports:
 *   - /api/publish/complete?weekly=YYYY-Www  (explicit trigger, publish scripts)
 *   - /api/publish/complete-weekly           (Vercel cron failsafe — see that
 *     route for why it exists: sandbox sessions can't always reach this host,
 *     which stranded W27's audio + email on 2026-07-05)
 *
 * Every step is idempotent — skips work already done.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getWeeklyBySlug } from '@/lib/daily-update-parser';
import { getWeeklyLightBySlug } from '@/lib/weekly-light-parser';
import { generateLightAudio, weeklyLightEpisodeKey } from '@/lib/audio/light-generate';
import { generateFullBriefAudio, weeklyFullEpisodeKey } from '@/lib/audio/full-generate';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { runDistributeIfNeeded } from '@/lib/distribute/run-if-needed';
import { audioNeedsRetry } from '@/lib/marketing/pipeline-status';
import { readAudioLog, writeAudioLog } from '@/lib/marketing/distribute-log';

export async function runWeeklyPublishComplete(weeklySlug: string) {
  const manual = true;
  const logKey = weeklySlug;
  const fullEpisodeKey = weeklyFullEpisodeKey(weeklySlug);
  const lightEpisodeKey = weeklyLightEpisodeKey(weeklySlug);

  if (!getWeeklyLightBySlug(weeklySlug)) {
    return NextResponse.json({
      weekly: weeklySlug,
      skipped: true,
      reason: `No Weekly Light published for ${weeklySlug}`,
    });
  }

  console.log(`[publish/complete] Starting weekly pipeline for ${weeklySlug}`);

  const [existingAudioLog, existingFullEpisode] = await Promise.all([
    readAudioLog(logKey),
    readEpisodeMetadata(fullEpisodeKey),
  ]);

  const shouldRunLightAudio = audioNeedsRetry(existingAudioLog);
  const shouldRunFullAudio = !existingFullEpisode && !!getWeeklyBySlug(weeklySlug);

  const [fullAudioSettled, lightAudioSettled, distributeSettled] = await Promise.allSettled([
    shouldRunFullAudio
      ? generateFullBriefAudio({ date: weeklySlug, weeklySlug, manual })
      : Promise.resolve({
          status: existingFullEpisode ? ('exists' as const) : ('skipped' as const),
          date: fullEpisodeKey,
          details: existingFullEpisode
            ? 'skipped — full weekly podcast already completed'
            : 'skipped — no full weekly on site',
        }),
    shouldRunLightAudio
      ? generateLightAudio({ date: weeklySlug, weeklySlug, manual })
      : Promise.resolve({
          status: 'exists' as const,
          date: lightEpisodeKey,
          details: 'skipped — weekly light audio already completed',
        }),
    runDistributeIfNeeded({ dateSlug: logKey, weeklySlug, channel: 'email' }),
  ]);

  const at = new Date().toISOString();
  const summary: Record<string, unknown> = { weekly: weeklySlug, at };

  if (fullAudioSettled.status === 'fulfilled') {
    summary.fullAudio = fullAudioSettled.value;
  } else {
    const err =
      fullAudioSettled.reason instanceof Error
        ? fullAudioSettled.reason.message
        : String(fullAudioSettled.reason);
    summary.fullAudio = { status: 'error', error: err };
  }

  if (lightAudioSettled.status === 'fulfilled') {
    const audio = lightAudioSettled.value;
    summary.lightAudio = audio;

    if (audio.status === 'skipped') {
      console.warn(`[publish/complete] Weekly light audio skipped for ${weeklySlug}: ${audio.details}`);
    } else {
      const audioOk = audio.status === 'success' || audio.status === 'exists';
      const audioLog: Parameters<typeof writeAudioLog>[1] = {
        status: audioOk ? 'success' : 'failed',
        at,
      };
      const audioDetails = 'details' in audio ? audio.details : undefined;
      const audioError = 'error' in audio ? audio.error : undefined;
      if (audioDetails) audioLog.details = audioDetails;
      if (audioError) audioLog.error = audioError;
      await writeAudioLog(logKey, audioLog);
    }
  } else {
    const err =
      lightAudioSettled.reason instanceof Error
        ? lightAudioSettled.reason.message
        : String(lightAudioSettled.reason);
    await writeAudioLog(logKey, { status: 'failed', error: err, at });
    summary.lightAudio = { status: 'error', error: err };
  }

  if (distributeSettled.status === 'fulfilled') {
    summary.distribute = distributeSettled.value;
  } else {
    const err =
      distributeSettled.reason instanceof Error
        ? distributeSettled.reason.message
        : String(distributeSettled.reason);
    summary.distribute = { error: err };
  }

  const dist = summary.distribute as
    | { email?: { success: boolean }; x?: { success: boolean }; error?: string }
    | undefined;
  const fullAudio = summary.fullAudio as { status?: string } | undefined;
  const lightAudio = summary.lightAudio as { status?: string } | undefined;

  const allOk =
    fullAudio?.status !== 'error' &&
    lightAudio?.status !== 'error' &&
    dist?.email?.success !== false &&
    dist?.x?.success !== false &&
    !dist?.error;

  if (fullAudio?.status === 'success' || lightAudio?.status === 'success') {
    revalidatePath('/api/podcast/feed');
  }

  return NextResponse.json({ ...summary, success: allOk }, { status: allOk ? 200 : 207 });
}
