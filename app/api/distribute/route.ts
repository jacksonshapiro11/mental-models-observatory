/**
 * /api/distribute — Automated distribution endpoint
 *
 * Fires after brief publishes: sends email to subscribers via Resend,
 * posts thread to X/Twitter via OAuth 2.0.
 *
 * Triggered by Vercel cron (daily) or manual POST.
 *
 * Query params:
 *   ?date=YYYY-MM-DD   — Distribute a specific date (defaults to latest)
 *   ?channel=email      — Email only
 *   ?channel=x          — X/Twitter only
 *   ?dry-run=true       — Preview, don't send
 *
 * Protected by CRON_SECRET / SNAPSHOT_SECRET.
 */

export const maxDuration = 120; // 2 minutes — enough for email batch + thread posting

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { TwitterApi } from 'twitter-api-v2';
import { getBriefLightByDate, getLatestBriefLight } from '@/lib/brief-light-parser';
import { renderBriefEmail } from '@/lib/email/render-brief';
import { sendBatch } from '@/lib/email/resend-client';
import { generateThreadFromDate, generateThreadForLatest } from '@/lib/social/thread-generator';

// ─── Auth (matches other cron endpoints) ───────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!snapshotSecret && !cronSecret) {
    console.error('[distribute] Neither SNAPSHOT_SECRET nor CRON_SECRET is set');
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

  console.warn('[distribute] Auth failed.');
  return false;
}

// ─── Today's date in ET ────────────────────────────────────────────────────

function todaySlug(): string {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.toISOString().slice(0, 10);
}

// ─── Email distribution ────────────────────────────────────────────────────

async function distributeEmail(dateSlug: string, dryRun: boolean): Promise<{ success: boolean; details: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, details: 'RESEND_API_KEY not set' };
  }

  const brief = getBriefLightByDate(dateSlug) || getLatestBriefLight();
  if (!brief) {
    return { success: false, details: `No brief light found for ${dateSlug}` };
  }

  const rendered = renderBriefEmail(brief);
  console.log(`[distribute] Email subject: ${rendered.subject}`);

  // Get subscribers from Redis
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const recipients = (await redis.smembers('subscribers:emails')) as string[];
  console.log(`[distribute] Subscribers: ${recipients.length}`);

  if (recipients.length === 0) {
    return { success: true, details: 'No subscribers' };
  }

  if (dryRun) {
    return { success: true, details: `Would send to ${recipients.length} subscriber(s)` };
  }

  const result = await sendBatch(recipients, rendered.subject, rendered.html, {
    tags: [
      { name: 'type', value: 'daily-brief' },
      { name: 'date', value: brief.date },
    ],
  });

  return {
    success: result.failed.length === 0,
    details: `Sent ${result.sent}/${result.total}${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`,
  };
}

// ─── X/Twitter distribution ───────────────────────────────────────────────

async function distributeX(dateSlug: string, dryRun: boolean): Promise<{ success: boolean; details: string }> {
  const hasOAuth2 = Boolean(process.env.TWITTER_OAUTH2_ACCESS_TOKEN && process.env.TWITTER_CLIENT_ID);
  if (!hasOAuth2) {
    return { success: false, details: 'Twitter OAuth 2.0 credentials not set' };
  }

  const thread = generateThreadFromDate(dateSlug) || generateThreadForLatest();
  if (!thread) {
    return { success: false, details: 'No brief found for thread generation' };
  }

  console.log(`[distribute] X thread: ${thread.tweets.length} tweets for "${thread.dailyTitle}"`);

  if (dryRun) {
    return { success: true, details: `Would post ${thread.tweets.length}-tweet thread` };
  }

  // Post thread using twitter-api-v2 directly (OAuth 2.0 bearer token)
  const client = new TwitterApi(process.env.TWITTER_OAUTH2_ACCESS_TOKEN!);

  let previousTweetId: string | null = null;
  const postedIds: string[] = [];

  for (const tweet of thread.tweets) {
    try {
      const text = tweet.text.substring(0, 280);
      let tweetId: string;

      if (previousTweetId) {
        const reply = await client.v2.reply(text, previousTweetId);
        tweetId = reply.data.id;
      } else {
        const post = await client.v2.tweet(text);
        tweetId = post.data.id;
      }

      previousTweetId = tweetId;
      postedIds.push(tweetId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        details: `Thread failed after ${postedIds.length}/${thread.tweets.length} tweets: ${msg}`,
      };
    }

    // Wait between tweets to avoid rate limits
    if (tweet !== thread.tweets[thread.tweets.length - 1]) {
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    }
  }

  return {
    success: true,
    details: `Thread posted (${postedIds.length} tweets): https://x.com/i/status/${postedIds[0]}`,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateSlug = req.nextUrl.searchParams.get('date') || todaySlug();
  const channel = req.nextUrl.searchParams.get('channel'); // 'email' | 'x' | null (both)
  const dryRun = req.nextUrl.searchParams.get('dry-run') === 'true';

  console.log(`[distribute] Starting — date=${dateSlug}, channel=${channel || 'all'}, dryRun=${dryRun}`);

  const results: Record<string, { success: boolean; details: string }> = {};

  // Email
  if (!channel || channel === 'email') {
    try {
      results.email = await distributeEmail(dateSlug, dryRun);
    } catch (err) {
      results.email = { success: false, details: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
    console.log(`[distribute] Email: ${results.email.success ? '✅' : '❌'} ${results.email.details}`);
  }

  // X/Twitter
  if (!channel || channel === 'x') {
    try {
      results.x = await distributeX(dateSlug, dryRun);
    } catch (err) {
      results.x = { success: false, details: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
    console.log(`[distribute] X: ${results.x.success ? '✅' : '❌'} ${results.x.details}`);
  }

  const allSuccess = Object.values(results).every(r => r.success);

  return NextResponse.json({
    date: dateSlug,
    dryRun,
    results,
    success: allSuccess,
  }, { status: allSuccess ? 200 : 207 }); // 207 Multi-Status if partial failure
}

// Vercel cron sends GET requests
export async function GET(req: NextRequest) {
  return POST(req);
}
