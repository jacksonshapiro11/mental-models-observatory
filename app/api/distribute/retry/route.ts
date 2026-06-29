/**
 * /api/distribute/retry — Retry failed publish pipeline steps
 *
 * For today ET: checks Redis step logs and episode metadata, retries only
 * missing/failed steps when the brief exists. Manual backstop when publish/complete
 * failsafe did not fully succeed.
 *
 * Auth: Bearer CRON_SECRET / SNAPSHOT_SECRET / x-vercel-cron
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { todayET } from '@/lib/publish-date';
import { getBriefByDate } from '@/lib/daily-update-parser';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { generateLightAudio } from '@/lib/audio/light-generate';
import { generateFullBriefAudio } from '@/lib/audio/full-generate';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { runDistributeIfNeeded } from '@/lib/distribute/run-if-needed';
import { generateDailyPack } from '@/lib/marketing/generate-daily-pack';
import { audioNeedsRetry, stepNeedsRetry } from '@/lib/marketing/pipeline-status';
import {
  readAudioLog,
  readDistributeLog,
  readMarketingPack,
  writeAudioLog,
} from '@/lib/marketing/distribute-log';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateSlug = todayET();

  if (!getBriefLightByDate(dateSlug)) {
    return NextResponse.json({
      date: dateSlug,
      skipped: true,
      reason: `No brief published for ${dateSlug}`,
    });
  }

  const [audioLog, distributeLog, marketingPack, fullEpisode] = await Promise.all([
    readAudioLog(dateSlug),
    readDistributeLog(dateSlug),
    readMarketingPack(dateSlug),
    readEpisodeMetadata(dateSlug),
  ]);

  const retries: string[] = [];
  const results: Record<string, unknown> = { date: dateSlug };
  const at = new Date().toISOString();

  const retryTasks: Promise<void>[] = [];

  const needsFullPodcast = !fullEpisode && !!getBriefByDate(dateSlug);
  if (needsFullPodcast) {
    retries.push('fullAudio');
    retryTasks.push(
      generateFullBriefAudio({ date: dateSlug }).then((audio) => {
        results.fullAudio = audio;
      }),
    );
  }

  if (audioNeedsRetry(audioLog)) {
    retries.push('lightAudio');
    retryTasks.push(
      generateLightAudio({ date: dateSlug }).then(async (audio) => {
        const audioOk = audio.status === 'success' || audio.status === 'exists';
        if (audio.status === 'skipped') {
          results.lightAudio = audio;
          return;
        }
        const entry: Parameters<typeof writeAudioLog>[1] = {
          status: audioOk ? 'success' : 'failed',
          at,
        };
        const audioDetails = audio.details || audio.error;
        if (audioDetails) entry.details = audioDetails;
        if (audio.error) entry.error = audio.error;
        await writeAudioLog(dateSlug, entry);
        results.lightAudio = audio;
      }),
    );
  }

  const retryEmail = stepNeedsRetry(distributeLog?.email);
  const retryX = stepNeedsRetry(distributeLog?.x);

  if (retryEmail || retryX) {
    if (retryEmail) retries.push('email');
    if (retryX) retries.push('x');
    const channel = retryEmail && retryX ? null : retryEmail ? 'email' : 'x';
    retryTasks.push(
      runDistributeIfNeeded({ dateSlug, channel }).then((dist) => {
        results.distribute = dist;
      }),
    );
  }

  if (!marketingPack) {
    retries.push('marketing');
    retryTasks.push(
      generateDailyPack(dateSlug).then((pack) => {
        results.marketing = pack;
      }),
    );
  }

  if (retryTasks.length === 0) {
    return NextResponse.json({
      date: dateSlug,
      skipped: true,
      reason: 'All steps already completed',
    });
  }

  const settled = await Promise.allSettled(retryTasks);
  const errors = settled
    .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
    .map((s) => (s.reason instanceof Error ? s.reason.message : String(s.reason)));

  return NextResponse.json({
    date: dateSlug,
    retried: retries,
    results,
    ...(errors.length > 0 ? { errors } : {}),
    success: errors.length === 0,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
