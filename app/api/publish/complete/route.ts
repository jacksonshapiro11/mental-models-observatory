/**
 * /api/publish/complete — Post-publish orchestrator
 *
 * Fires full podcast audio, light audio, distribution (email + X), and
 * marketing pack in parallel. Each step is idempotent — skips work already done.
 *
 * Primary trigger: publish.py after GitHub push + health poll.
 * Failsafes:
 *   - GitHub Action on content/daily-updates/** push (polls custom domain, then POST)
 *   - Vercel crons ~5:55 / ~6:30 / ~7:15 AM ET (UTC during EDT)
 *
 * Query: ?date=YYYY-MM-DD (optional, defaults to today ET)
 *         ?weekly=YYYY-Www (optional — weekly audio + email instead of daily)
 * Auth: see lib/cron-auth.ts (Vercel cron markers, Bearer CRON_SECRET / SNAPSHOT_SECRET)
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCronAuthPath } from '@/lib/cron-auth';
import { resolvePublishDate } from '@/lib/publish-date';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { getBriefByDate } from '@/lib/daily-update-parser';
import { generateLightAudio } from '@/lib/audio/light-generate';
import { generateFullBriefAudio } from '@/lib/audio/full-generate';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { runDistributeIfNeeded } from '@/lib/distribute/run-if-needed';
import { generateDailyPack } from '@/lib/marketing/generate-daily-pack';
import { audioNeedsRetry } from '@/lib/marketing/pipeline-status';
import { readAudioLog, readMarketingPack, writeAudioLog } from '@/lib/marketing/distribute-log';
import { runWeeklyPublishComplete } from '@/lib/publish/weekly-complete';

/** Brief may land mid-request when cron races a deploy — wait before 409. */
const BRIEF_WAIT_MS = 90_000;
const BRIEF_POLL_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLightBrief(dateSlug: string): Promise<boolean> {
  if (getBriefLightByDate(dateSlug)) return true;
  const deadline = Date.now() + BRIEF_WAIT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    console.warn(
      `[publish/complete] light brief missing for ${dateSlug} — waiting (${attempt}, up to ${BRIEF_WAIT_MS / 1000}s)`,
    );
    await sleep(BRIEF_POLL_MS);
    if (getBriefLightByDate(dateSlug)) {
      console.log(`[publish/complete] light brief appeared for ${dateSlug} after wait`);
      return true;
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const authPath = getCronAuthPath(req);
  if (!authPath) {
    console.warn('[publish/complete] Unauthorized — no matching cron auth path');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log(`[publish/complete] auth=${authPath}`);

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

  if (!(await waitForLightBrief(dateSlug))) {
    console.error(
      `[publish/complete] SKIPPED — No brief published for ${dateSlug} on deployed filesystem after ${BRIEF_WAIT_MS / 1000}s wait. ` +
        `Caller should poll /api/publish/health?date=${dateSlug} until lightBrief=true before retrying.`,
    );
    return NextResponse.json(
      {
        date: dateSlug,
        skipped: true,
        reason: `No brief published for ${dateSlug}`,
        waitedMs: BRIEF_WAIT_MS,
        success: false,
      },
      { status: 409 },
    );
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

export async function GET(req: NextRequest) {
  return POST(req);
}
