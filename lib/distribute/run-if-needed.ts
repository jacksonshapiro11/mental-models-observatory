/**
 * Idempotent distribute — skips channels already confirmed in Redis.
 */

import { runDistribute, type DistributeResults } from '@/lib/distribute/handler';
import {
  emailWasActuallySent,
  xWasActuallyPosted,
} from '@/lib/marketing/pipeline-status';
import { readDistributeLog, writeStepLog } from '@/lib/marketing/distribute-log';

export interface RunDistributeIfNeededOptions {
  dateSlug: string;
  dryRun?: boolean;
  channel?: 'email' | 'x' | null;
}

export async function runDistributeIfNeeded(
  options: RunDistributeIfNeededOptions,
): Promise<DistributeResults> {
  const { dateSlug, dryRun = false, channel = null } = options;
  const existingLog = await readDistributeLog(dateSlug);
  const results: DistributeResults = {};

  const skipEmail =
    emailWasActuallySent(existingLog?.email) && (!channel || channel === 'email');
  const skipX = xWasActuallyPosted(existingLog?.x) && (!channel || channel === 'x');

  if (skipEmail) {
    results.email = { success: true, details: 'skipped — already sent' };
  }
  if (skipX) {
    results.x = { success: true, details: 'skipped — already posted' };
  }

  const needsEmail = (!channel || channel === 'email') && !skipEmail;
  const needsX = (!channel || channel === 'x') && !skipX;

  if (!needsEmail && !needsX) {
    return results;
  }

  const runChannel = needsEmail && needsX ? null : needsEmail ? 'email' : 'x';
  const fresh = await runDistribute({ dateSlug, dryRun, channel: runChannel });

  if (needsEmail && fresh.email) {
    results.email = fresh.email;
    if (!dryRun) {
      const at = new Date().toISOString();
      const emailEntry: Parameters<typeof writeStepLog>[2] = {
        status: fresh.email.success ? 'success' : 'failed',
        at,
      };
      if (fresh.email.details) emailEntry.details = fresh.email.details;
      await writeStepLog(dateSlug, 'email', emailEntry);
    }
  }

  if (needsX && fresh.x) {
    results.x = fresh.x;
    if (!dryRun) {
      const at = new Date().toISOString();
      const xEntry: Parameters<typeof writeStepLog>[2] = {
        status: fresh.x.success ? 'success' : 'failed',
        at,
      };
      if (fresh.x.details) xEntry.details = fresh.x.details;
      if (fresh.x.tweetId) xEntry.tweetId = fresh.x.tweetId;
      await writeStepLog(dateSlug, 'x', xEntry);
    }
  }

  return results;
}
