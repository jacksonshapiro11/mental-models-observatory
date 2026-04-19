/**
 * /api/subscribe/backfill
 *
 * Self-healing cron. Retries any subscribers parked in `subscribers:beehiiv_backfill`
 * (because the primary sync failed during /api/subscribe).
 *
 * Runs daily via vercel.json cron. Also callable manually for debugging.
 *
 * Response:
 *   { checked, succeeded, failed, stillPending, errors? }
 *
 * Protected:
 *   - Vercel cron hits with `x-vercel-cron: 1` header → allowed
 *   - Manual calls require ?secret=<SNAPSHOT_SECRET> or x-secret header
 */

import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { createSubscription } from '@/lib/email/beehiiv-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow up to 60s for rate-limited retries

const REDIS_KEY_BACKFILL = 'subscribers:beehiiv_backfill';
const REDIS_KEY_SUB_META = 'subscribers:meta:';

// Cap per run so we never blow past beehiiv's rate limit (~100/min).
// 30 emails × ~1.2s = ~36s, comfortably under maxDuration.
const MAX_PER_RUN = 30;
const DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAuthorized(req: NextRequest): boolean {
  // Vercel cron always sends this header
  if (req.headers.get('x-vercel-cron') === '1') return true;

  const secret = process.env.SNAPSHOT_SECRET;
  if (!secret) return false;

  const provided =
    req.nextUrl.searchParams.get('secret') || req.headers.get('x-secret');
  return provided === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.BEEHIIV_API_KEY || !process.env.BEEHIIV_PUBLICATION_ID) {
    return NextResponse.json(
      {
        error:
          'BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID not set in environment',
      },
      { status: 500 }
    );
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const allPending = await redis.smembers(REDIS_KEY_BACKFILL);
  const batch = allPending.slice(0, MAX_PER_RUN);

  let succeeded = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const email of batch) {
    try {
      const meta = await redis.hgetall<Record<string, string>>(
        REDIS_KEY_SUB_META + email
      );

      await createSubscription({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: meta?.source ?? 'backfill',
        utm_medium: 'backfill_cron',
      });

      await redis.srem(REDIS_KEY_BACKFILL, email);
      succeeded++;
    } catch (err) {
      errors.push({
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(DELAY_MS);
  }

  const stillPending = allPending.length - succeeded;

  return NextResponse.json({
    checked: batch.length,
    succeeded,
    failed: errors.length,
    stillPending,
    // Only include errors if small — avoid leaking emails in large responses
    errors: errors.length <= 10 ? errors : undefined,
  });
}
