#!/usr/bin/env node
/**
 * Non-destructive X pipeline diagnostic.
 * Checks env presence, Redis token/post keys, and API auth (v2.me) without posting.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import { resolveXPostContent } from '../lib/social/x-post-content';
import {
  createXPostingClient,
  hasXPostingCredentials,
  loadXOAuthTokens,
  readXTokensFromRedis,
} from '../lib/social/x-oauth';

function envStatus(name: string): string {
  return process.env[name] ? 'set' : 'MISSING';
}

async function main() {
  console.log('X Pipeline Diagnostic\n');

  console.log('── Env vars (names only) ──');
  const required = [
    'TWITTER_CLIENT_ID',
    'TWITTER_CLIENT_SECRET',
    'TWITTER_OAUTH2_ACCESS_TOKEN',
    'TWITTER_OAUTH2_REFRESH_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'CRON_SECRET',
    'SNAPSHOT_SECRET',
  ];
  for (const name of required) {
    console.log(`  ${name}: ${envStatus(name)}`);
  }

  console.log('\n── OAuth tokens ──');
  const redisTokens = await readXTokensFromRedis();
  console.log(`  Redis x-oauth:tokens: ${redisTokens ? 'present' : 'missing'}`);
  const loaded = await loadXOAuthTokens();
  console.log(`  Effective source: ${loaded.source || 'none'}`);
  console.log(`  Can post: ${(await hasXPostingCredentials()) ? 'yes' : 'no'}`);

  console.log('\n── Post content (today ET) ──');
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dateSlug = et.toISOString().slice(0, 10);
  const content = await resolveXPostContent(dateSlug);
  if (!content) {
    console.log(`  No content for ${dateSlug}`);
  } else {
    console.log(`  Source: ${content.source}`);
    console.log(`  Posts: ${content.posts.length}`);
    content.posts.forEach((p, i) => console.log(`    [${i + 1}] ${p.length} chars`));
  }

  if (await hasXPostingCredentials()) {
    console.log('\n── API auth check (v2.me, no post) ──');
    try {
      const { tokens } = await loadXOAuthTokens();
      const client = createXPostingClient(tokens!.accessToken);
      const me = await client.v2.me();
      console.log(`  ✅ Authenticated as @${me.data.username}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Auth failed: ${msg}`);
      console.log('  → Re-run OAuth: https://YOUR_DOMAIN/api/x-auth?secret=SNAPSHOT_SECRET');
      console.log('  → Or locally: npx tsx scripts/x-oauth2-setup.ts');
    }
  } else {
    console.log('\n── API auth check ──');
    console.log('  Skipped (no credentials)');
  }

  console.log('\n── Production checklist ──');
  console.log('  1. Register callback: https://YOUR_DOMAIN/api/x-auth/callback in X Developer Portal');
  console.log('  2. Deploy /api/x-auth and /api/x-auth/callback routes');
  console.log('  3. Visit /api/x-auth?secret=SNAPSHOT_SECRET once to authorize');
  console.log('  4. Test dry-run: curl -H "Authorization: Bearer CRON_SECRET" "https://YOUR_DOMAIN/api/distribute?channel=x&dry-run=true"');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
