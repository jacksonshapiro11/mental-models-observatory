/**
 * Shared auth for cron / snapshot protected API routes.
 * Accepts Bearer CRON_SECRET or SNAPSHOT_SECRET, or ?secret= / x-snapshot-secret header.
 */

import { NextRequest } from 'next/server';

export function isCronAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) {
    console.error('[cron-auth] Neither SNAPSHOT_SECRET nor CRON_SECRET is set');
    return false;
  }

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
