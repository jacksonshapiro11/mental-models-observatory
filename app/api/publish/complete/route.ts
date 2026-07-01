/**
 * /api/publish/complete — Post-publish orchestrator
 *
 * Fires full podcast audio, light audio, distribution (email + X), and
 * marketing pack in parallel. Each step is idempotent — skips work already done.
 *
 * Primary trigger: publish.py after GitHub push + deploy wait.
 * Failsafe: Vercel cron at ~5:55 AM ET (55 9 * * * UTC during EDT).
 *
 * Query: ?date=YYYY-MM-DD (optional, defaults to today ET)
 *         ?weekly=YYYY-Www (optional — weekly audio + email instead of daily)
 * Auth: Bearer CRON_SECRET or SNAPSHOT_SECRET
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isCronAuthorized } from '@/lib/cron-auth';
import { resolvePublishDate } from '@/lib/publish-date';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { getBriefByDate, getWeeklyBySlug } from '@/lib/daily-update-parser';
import { getWeeklyLightBySlug } from '@/lib/weekly-light-parser';
import { generateLightAudio, weeklyLightEpisodeKey } from '@/lib/audio/light-generate';
import { generateFullBriefAudio, weeklyFullEpisodeKey } from '@/lib/audio/full-generate';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { runDistributeIfNeeded } from '@/lib/distribute/run-if-needed';
import { generateDailyPack } from '@/lib/marketing/generate-daily-pack';
import { audioNeedsRetry } from '@/lib/marketing/pipeline-status';
import { readAudioLog, readMarketingPack, writeAudioLog } from '@/lib/marketing/distribute-log';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await runPublishComplete(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[publish/complete] Unhandled error:', err);
    return NextResponse.json(
      { error: 'Publish pipeline failed', detail: message },
      { status: 503 },
    );
  }
}

async function runPublishComplete(req: NextRequest) {
  const weeklySlug = req.nextUrl.searchParams.get('weekly')?.trim() || null;
  if (weeklySlug) {
    return runWeeklyPublishComplete(weeklySlug);
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

  const [existingAudioLog, existingFullEpisode, existingMarketingPack] = await Promise.all([
    readAudioLog(dateSlug),
    readEpisodeMetadata(dateSlug),
    readMarketingPack(dateSlug),
  ]);

  const shouldRunLightAudio = audioNeedsRetry(existingAudioLog);
  const shouldRunFullAudio = !existingFullEpisode && !!getBriefByDate(dateSlug);

  const [fullAudioSettled, lightAudioSettled, distributeSettled, marketingSettled] =
    await Promise.allSettled([
      shouldRunFullAudio
        ? generateFullBriefAudio({ date: dateSlug, manual })
        : Promise.resolve({
            status: existingFullEpisode ? ('exists' as const) : ('skipped' as const),
            date: dateSlug,
            details: existingFullEpisode
              ? 'skipped — full podcast already completed'
              : 'skipped — no full brief on site',
          }),
      shouldRunLightAudio
        ? generateLightAudio({ date: dateSlug, manual })
        : Promise.resolve({
            status: 'exists' as const,
            date: dateSlug,
            details: 'skipped — light audio already completed',
          }),
      runDistributeIfNeeded({ dateSlug }),
      existingMarketingPack
        ? Promise.resolve({ success: true, pack: existingMarketingPack, skipped: true })
        : generateDailyPack(dateSlug),
    ]);

  const at = new Date().toISOString();
  const summary: Record<string, unknown> = { date: dateSlug, at };

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
      console.warn(`[publish/complete] Light audio skipped for ${dateSlug}: ${audio.details}`);
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
      await writeAudioLog(dateSlug, audioLog);
    }
  } else {
    const err =
      lightAudioSettled.reason instanceof Error
        ? lightAudioSettled.reason.message
        : String(lightAudioSettled.reason);
    await writeAudioLog(dateSlug, { status: 'failed', error: err, at });
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

async function runWeeklyPublishComplete(weeklySlug: string) {
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

export async function GET(req: NextRequest) {
  return POST(req);
}
