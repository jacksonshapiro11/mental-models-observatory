/**
 * /api/distribute/retry — Retry failed publish pipeline steps
 *
 * For today ET: checks Redis step logs and retries only missing/failed steps
 * when the brief exists. Used by retry cron at 12:00 and 14:00 ET.
 *
 * Auth: Bearer CRON_SECRET
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { todayET } from '@/lib/publish-date';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { generateLightAudio } from '@/lib/audio/light-generate';
import { runDistribute } from '@/lib/distribute/handler';
import { generateDailyPack } from '@/lib/marketing/generate-daily-pack';
import {
  readAudioLog,
  readDistributeLog,
  readMarketingPack,
  writeAudioLog,
  writeStepLog,
} from '@/lib/marketing/distribute-log';

function isCronOnly(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === cronSecret;
}

function stepFailed(entry?: { status?: string } | null): boolean {
  return !entry || entry.status === 'failed';
}

export async function POST(req: NextRequest) {
  if (!isCronOnly(req) && !isCronAuthorized(req)) {
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

  const [audioLog, distributeLog, marketingPack] = await Promise.all([
    readAudioLog(dateSlug),
    readDistributeLog(dateSlug),
    readMarketingPack(dateSlug),
  ]);

  const retries: string[] = [];
  const results: Record<string, unknown> = { date: dateSlug };
  const at = new Date().toISOString();

  const retryTasks: Promise<void>[] = [];

  if (stepFailed(audioLog)) {
    retries.push('audio');
    retryTasks.push(
      generateLightAudio({ date: dateSlug }).then(async (audio) => {
        const audioOk = audio.status === 'success' || audio.status === 'exists';
        const audioLog: Parameters<typeof writeAudioLog>[1] = {
          status: audioOk ? 'success' : audio.status === 'skipped' ? 'skipped' : 'failed',
          at,
        };
        const audioDetails = audio.details || audio.error;
        if (audioDetails) audioLog.details = audioDetails;
        if (audio.error) audioLog.error = audio.error;
        await writeAudioLog(dateSlug, audioLog);
        results.audio = audio;
      }),
    );
  }

  const retryEmail = stepFailed(distributeLog?.email);
  const retryX = stepFailed(distributeLog?.x);

  if (retryEmail || retryX) {
    if (retryEmail) retries.push('email');
    if (retryX) retries.push('x');
    const channel = retryEmail && retryX ? null : retryEmail ? 'email' : 'x';
    retryTasks.push(
      runDistribute({ dateSlug, channel }).then(async (dist) => {
        if (dist.email) {
          const emailEntry: Parameters<typeof writeStepLog>[2] = {
            status: dist.email.success ? 'success' : 'failed',
            at,
          };
          if (dist.email.details) emailEntry.details = dist.email.details;
          await writeStepLog(dateSlug, 'email', emailEntry);
        }
        if (dist.x) {
          const xEntry: Parameters<typeof writeStepLog>[2] = {
            status: dist.x.success ? 'success' : 'failed',
            at,
          };
          if (dist.x.details) xEntry.details = dist.x.details;
          if (dist.x.tweetId) xEntry.tweetId = dist.x.tweetId;
          await writeStepLog(dateSlug, 'x', xEntry);
        }
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

  await Promise.allSettled(retryTasks);

  return NextResponse.json({
    date: dateSlug,
    retried: retries,
    results,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
