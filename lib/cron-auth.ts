/**
 * Shared auth for cron / snapshot protected API routes.
 *
 * Accepts (any one):
 *   1. Vercel Cron markers — `x-vercel-cron: 1`, `x-vercel-cron-schedule`,
 *      or User-Agent `vercel-cron/1.0` (Vercel validates these at the edge)
 *   2. Authorization: Bearer CRON_SECRET or SNAPSHOT_SECRET
 *      (Vercel also sends Bearer CRON_SECRET when that env var is set)
 *   3. ?secret= / x-snapshot-secret matching SNAPSHOT_SECRET (publish.py / manual)
 *
 * Manual curl:
 *   curl -X POST "https://www.cosmictrex.com/api/publish/complete" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * IMPORTANT: Vercel Cron hits the deployment's *.vercel.app host. If SSO
 * Deployment Protection is `all_except_custom_domains`, those requests get a
 * 302 to login and cron NEVER reaches this function (crons do not follow
 * redirects). Production SSO must be `preview` (or off) for cron failsafes.
 */

import { NextRequest } from 'next/server';

export type CronAuthPath =
  | 'x-vercel-cron'
  | 'x-vercel-cron-schedule'
  | 'user-agent-vercel-cron'
  | 'snapshot-secret'
  | 'bearer-cron'
  | 'bearer-snapshot'
  | null;

/** Returns which auth path matched, or null if unauthorized. */
export function getCronAuthPath(req: NextRequest): CronAuthPath {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) {
    console.error('[cron-auth] Neither SNAPSHOT_SECRET nor CRON_SECRET is set');
    return null;
  }

  // Vercel cron — official markers (any one is sufficient; edge already authenticated).
  if (req.headers.get('x-vercel-cron') === '1') return 'x-vercel-cron';
  if (req.headers.get('x-vercel-cron-schedule')) return 'x-vercel-cron-schedule';
  const ua = req.headers.get('user-agent') || '';
  if (ua.includes('vercel-cron')) return 'user-agent-vercel-cron';

  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret && snapshotSecret && secret === snapshotSecret) return 'snapshot-secret';

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (cronSecret && token === cronSecret) return 'bearer-cron';
    if (snapshotSecret && token === snapshotSecret) return 'bearer-snapshot';
  }

  return null;
}

export function isCronAuthorized(req: NextRequest): boolean {
  return getCronAuthPath(req) !== null;
}
