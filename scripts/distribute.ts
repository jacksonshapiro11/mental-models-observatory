#!/usr/bin/env node
/**
 * Distribution Orchestrator
 *
 * Single entry point that fires ALL distribution channels after brief publishes:
 *   1. Email → Send Brief Light to subscribers via Resend
 *   2. X/Twitter → Post thread with key insights
 *
 * Usage:
 *   npx tsx scripts/distribute.ts                    # distribute today's brief
 *   npx tsx scripts/distribute.ts --date=2026-04-24  # specific date
 *   npx tsx scripts/distribute.ts --dry-run          # preview everything, send nothing
 *   npx tsx scripts/distribute.ts --email-only       # skip X posting
 *   npx tsx scripts/distribute.ts --x-only           # skip email
 *   npx tsx scripts/distribute.ts --test=you@email.com  # test email to one address
 *
 * This script is designed to be called by the morning pipeline after publish.py
 * succeeds and the site is live. It handles failures gracefully — if email fails,
 * X still posts, and vice versa.
 *
 * Env:
 *   RESEND_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly (dotenv/config only loads .env by default)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config(); // fallback to .env
import { getBriefLightByDate, getLatestBriefLight } from '../lib/brief-light-parser';
import { renderBriefEmail } from '../lib/email/render-brief';
import { sendEmail, sendBatch } from '../lib/email/resend-client';
import { generateThreadFromDate, generateThreadForLatest } from '../lib/social/thread-generator';
import { Redis } from '@upstash/redis';

const TwitterClient = require('./platforms/twitter-client.js');

// ─── Args ──────────────────────────────────────────────────────────────────

interface Args {
  date?: string;
  dryRun: boolean;
  emailOnly: boolean;
  xOnly: boolean;
  testEmail?: string;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, emailOnly: false, xOnly: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--email-only') args.emailOnly = true;
    else if (arg === '--x-only') args.xOnly = true;
    else if (arg.startsWith('--date=')) args.date = arg.slice('--date='.length);
    else if (arg.startsWith('--test=')) args.testEmail = arg.slice('--test='.length);
  }
  return args;
}

// ─── Get today's date slug ─────────────────────────────────────────────────

function todaySlug(): string {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.toISOString().slice(0, 10);
}

// ─── Email distribution ────────────────────────────────────────────────────

async function distributeEmail(args: Args): Promise<{ success: boolean; details: string }> {
  try {
    // Check for required env vars
    if (!process.env.RESEND_API_KEY) {
      return { success: false, details: 'RESEND_API_KEY not set — skipping email' };
    }

    const dateSlug = args.date || todaySlug();
    const brief = args.date ? getBriefLightByDate(args.date) : getLatestBriefLight();

    if (!brief) {
      return { success: false, details: `No brief light found for ${dateSlug}` };
    }

    const rendered = renderBriefEmail(brief);
    console.log(`📧 Email subject: ${rendered.subject}`);

    // Get recipients
    let recipients: string[];
    if (args.testEmail) {
      recipients = [args.testEmail];
      console.log(`   Test mode: ${args.testEmail}`);
    } else {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      recipients = (await redis.smembers('subscribers:emails')) as string[];
      console.log(`   Subscribers: ${recipients.length}`);
    }

    if (recipients.length === 0) {
      return { success: true, details: 'No subscribers — nothing to send' };
    }

    if (args.dryRun) {
      return { success: true, details: `Would send to ${recipients.length} subscriber(s)` };
    }

    if (args.testEmail) {
      const result = await sendEmail({
        to: args.testEmail,
        subject: rendered.subject,
        html: rendered.html,
        tags: [
          { name: 'type', value: 'daily-brief' },
          { name: 'date', value: brief.date },
        ],
      });
      return result.success
        ? { success: true, details: `Test email sent (${result.id})` }
        : { success: false, details: `Send failed: ${result.error}` };
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
  } catch (err) {
    return { success: false, details: `Email error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── X/Twitter distribution ───────────────────────────────────────────────

async function distributeX(args: Args): Promise<{ success: boolean; details: string }> {
  try {
    // Check for required env vars — prefer OAuth 2.0 (free tier), fall back to OAuth 1.0a
    const hasOAuth2 = Boolean(process.env.TWITTER_OAUTH2_ACCESS_TOKEN && process.env.TWITTER_CLIENT_ID);
    const hasOAuth1 = Boolean(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN);
    if (!hasOAuth2 && !hasOAuth1) {
      return { success: false, details: 'Twitter credentials not set — skipping X' };
    }

    const thread = args.date
      ? generateThreadFromDate(args.date)
      : generateThreadForLatest();

    if (!thread) {
      return { success: false, details: `No brief found for thread generation` };
    }

    console.log(`🐦 X thread: ${thread.tweets.length} tweets for "${thread.dailyTitle}"`);

    if (args.dryRun) {
      thread.tweets.forEach((t, i) => {
        console.log(`   [${i + 1}] (${t.text.length}c) ${t.text.slice(0, 80)}...`);
      });
      return { success: true, details: `Would post ${thread.tweets.length}-tweet thread` };
    }

    const clientConfig = hasOAuth2
      ? {
          oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
          clientId: process.env.TWITTER_CLIENT_ID,
          clientSecret: process.env.TWITTER_CLIENT_SECRET,
          refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
        }
      : {
          apiKey: process.env.TWITTER_API_KEY,
          apiSecret: process.env.TWITTER_API_SECRET,
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        };
    const client = new TwitterClient(clientConfig);

    const tweetTexts = thread.tweets.map((t) => t.text);
    const result = await client.postThread(tweetTexts);

    if (result.success) {
      const firstId = result.results[0]?.tweetId;
      return {
        success: true,
        details: `Thread posted: https://x.com/i/status/${firstId}`,
      };
    } else {
      const posted = result.results?.filter((r: { success: boolean }) => r.success).length || 0;
      return {
        success: false,
        details: `Thread failed after ${posted}/${thread.tweets.length} tweets: ${result.error}`,
      };
    }
  } catch (err) {
    return { success: false, details: `X error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── Main orchestrator ─────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const dateSlug = args.date || todaySlug();

  console.log('\n' + '═'.repeat(60));
  console.log(`  📡  DISTRIBUTION — ${dateSlug}`);
  console.log('═'.repeat(60) + '\n');

  if (args.dryRun) {
    console.log('🏃 DRY RUN MODE — nothing will be sent\n');
  }

  const results: Array<{ channel: string; success: boolean; details: string }> = [];

  // 1. Email
  if (!args.xOnly) {
    console.log('─── EMAIL ───');
    const emailResult = await distributeEmail(args);
    results.push({ channel: 'Email', ...emailResult });
    console.log(`   ${emailResult.success ? '✅' : '❌'} ${emailResult.details}\n`);
  }

  // 2. X/Twitter
  if (!args.emailOnly) {
    console.log('─── X/TWITTER ───');
    const xResult = await distributeX(args);
    results.push({ channel: 'X', ...xResult });
    console.log(`   ${xResult.success ? '✅' : '❌'} ${xResult.details}\n`);
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  results.forEach((r) => {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.channel}: ${r.details}`);
  });

  const allSuccess = results.every((r) => r.success);
  console.log(`\n  ${allSuccess ? '🎉 All channels distributed' : '⚠️  Some channels failed'}\n`);

  if (!allSuccess) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Distribution failed:', err);
  process.exit(1);
});
