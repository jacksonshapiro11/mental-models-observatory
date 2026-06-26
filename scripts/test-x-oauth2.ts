#!/usr/bin/env node
/**
 * Test X posting with OAuth 2.0 token from developer portal.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import { TwitterApi } from 'twitter-api-v2';

async function main() {
  const token = process.env.TWITTER_OAUTH2_ACCESS_TOKEN;
  if (!token) {
    console.error('❌ TWITTER_OAUTH2_ACCESS_TOKEN not set in .env.local');
    process.exit(1);
  }

  console.log(`Token: ${token.slice(0, 10)}...${token.slice(-6)}`);
  console.log('Testing OAuth 2.0...\n');

  const client = new TwitterApi(token);

  try {
    const me = await client.v2.me();
    console.log(`✅ Authenticated as @${me.data.username}\n`);

    console.log('Posting test tweet in 5 seconds... (Ctrl+C to cancel)');
    await new Promise(r => setTimeout(r, 5000));

    const result = await client.v2.tweet('Observatory pipeline test — delete me');
    console.log(`✅ Tweet posted: https://x.com/i/status/${result.data.id}`);
    console.log('(Delete this test tweet when done)');
  } catch (err: any) {
    console.log(`❌ Failed: ${err.code} — ${err.message}`);
    if (err.data) console.log('Detail:', JSON.stringify(err.data, null, 2));
  }
}

main();
