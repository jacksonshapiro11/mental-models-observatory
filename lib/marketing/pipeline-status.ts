/**
 * Shared idempotency helpers for the daily publish pipeline.
 * Used by distribute, publish/complete, and retry crons.
 */

import type { AudioLog, StepLogEntry } from './distribute-log';

/** Missing, failed, or skipped (e.g. brief not deployed yet) → retry. */
export function stepNeedsRetry(entry?: StepLogEntry | null): boolean {
  if (!entry) return true;
  return entry.status === 'failed' || entry.status === 'skipped';
}

export function audioNeedsRetry(entry?: AudioLog | null): boolean {
  if (!entry) return true;
  return entry.status === 'failed' || entry.status === 'skipped';
}

/** True only when we have evidence subscribers actually received mail. */
export function emailWasActuallySent(entry?: StepLogEntry | null): boolean {
  if (!entry || entry.status !== 'success') return false;
  const d = entry.details ?? '';
  if (d.includes('skipped')) return false;
  if (d.includes('No subscribers')) return false;
  if (d.startsWith('Would send')) return false;
  if (/Sent 0\/\d+/.test(d)) return false;
  return /Sent \d+\/\d+/.test(d);
}

/** True only when we have evidence a tweet went live. */
export function xWasActuallyPosted(entry?: StepLogEntry | null): boolean {
  if (!entry || entry.status !== 'success') return false;
  const d = entry.details ?? '';
  if (d.includes('skipped')) return false;
  if (d.startsWith('Would post') || d.startsWith('[redis] Would post')) return false;
  return !!entry.tweetId || /Published \d+ posts/.test(d);
}
