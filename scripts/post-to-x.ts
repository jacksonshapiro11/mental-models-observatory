#!/usr/bin/env node
/**
 * Post the daily brief thread to X/Twitter.
 *
 * Parses the published brief, generates a thread, and posts via Twitter API v2.
 *
 * Usage:
 *   npx tsx scripts/post-to-x.ts                    # today's brief
 *   npx tsx scripts/post-to-x.ts --date=2026-04-24  # specific date
 *   npx tsx scripts/post-to-x.ts --dry-run          # preview thread, don't post
 *   npx tsx scripts/post-to-x.ts --single            # post only the hook tweet (no thread)
 *
 * Env:
 *   TWITTER_API_KEY, TWITTER_API_SECRET,
 *   TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();
import { generateThreadFromDate, generateThreadForLatest } from '../lib/social/thread-generator';

// Use require for the JS Twitter client
const TwitterClient = require('../scripts/platforms/twitter-client.js');

// ─── Args ──────────────────────────────────────────────────────────────────

interface Args {
  date?: string;
  dryRun: boolean;
  single: boolean;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, single: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--single') args.single = true;
    else if (arg.startsWith('--date=')) args.date = arg.slice('--date='.length);
  }
  return args;
}

// ─── Twitter client setup ──────────────────────────────────────────────────

function getTwitterClient(): InstanceType<typeof TwitterClient> {
  // Prefer OAuth 2.0 (free tier), fall back to OAuth 1.0a
  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN && process.env.TWITTER_CLIENT_ID) {
    return new TwitterClient({
      oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
    });
  }

  const config: Record<string, string | undefined> = {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  };

  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing Twitter credentials: ${missing.join(', ')}`);
  }

  return new TwitterClient(config);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // 1. Generate thread
  const thread = args.date
    ? generateThreadFromDate(args.date)
    : generateThreadForLatest();

  if (!thread) {
    console.error(`❌ No brief found${args.date ? ` for ${args.date}` : ''}`);
    process.exit(1);
  }

  const tweets = args.single ? thread.tweets.slice(0, 1) : thread.tweets;

  console.log(`📰 Brief: ${thread.date} — "${thread.dailyTitle}"`);
  console.log(`🧵 Thread: ${tweets.length} tweet(s)\n`);

  // 2. Preview
  tweets.forEach((tweet, i) => {
    console.log(`── Tweet ${i + 1}/${tweets.length} (${tweet.text.length} chars) ──`);
    console.log(tweet.text);
    console.log('');
  });

  if (args.dryRun) {
    console.log('🏃 Dry run — not posting.');
    return;
  }

  // 3. Post
  const client = getTwitterClient();

  console.log('🚀 Posting to X...\n');

  const tweetTexts = tweets.map((t) => t.text);
  const result = await client.postThread(tweetTexts);

  if (result.success) {
    console.log(`✅ Thread posted successfully`);
    result.results.forEach((r: { tweetId: string; text: string }, i: number) => {
      console.log(`   Tweet ${i + 1}: https://x.com/i/status/${r.tweetId}`);
    });
  } else {
    console.error(`❌ Thread posting failed: ${result.error}`);
    if (result.results) {
      const posted = result.results.filter((r: { success: boolean }) => r.success).length;
      console.error(`   ${posted}/${tweets.length} tweets posted before failure`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ X posting failed:', err);
  process.exit(1);
});
