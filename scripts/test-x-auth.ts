#!/usr/bin/env node
/**
 * Quick diagnostic: test Twitter API auth and show the exact error.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const TwitterClient = require('./platforms/twitter-client.js');

async function main() {
  console.log('🔍 Twitter API Diagnostics\n');

  // Check env vars
  const vars = ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET'];
  for (const v of vars) {
    const val = process.env[v];
    console.log(`  ${v}: ${val ? val.slice(0, 8) + '...' + val.slice(-4) : '❌ NOT SET'}`);
  }

  console.log('\n🔗 Attempting to verify credentials...\n');

  try {
    const client = new TwitterClient({
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });

    // Try to verify credentials (read-only, won't post anything)
    const me = await client.rwClient.v2.me();
    console.log(`✅ Authenticated as: @${me.data.username} (${me.data.name})`);
    console.log(`   ID: ${me.data.id}\n`);

    // Try a test tweet (won't actually post — just checking permissions)
    console.log('🧪 Testing write access with a tweet...');
    console.log('   (This WILL post a test tweet. Press Ctrl+C within 5 seconds to cancel)\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const testTweet = `Observatory pipeline test — ${new Date().toISOString().slice(0, 16)}`;
    const result = await client.postTweet(testTweet);

    if (result.success) {
      console.log(`✅ Tweet posted: https://x.com/i/status/${result.tweetId}`);
      console.log('   (You can delete this test tweet now)');
    } else {
      console.log(`❌ Tweet failed:`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
  } catch (err: any) {
    console.log('❌ Error:', err.message);
    if (err.data) console.log('   Data:', JSON.stringify(err.data, null, 2));
    if (err.code) console.log('   Code:', err.code);
    if (err.headers) {
      const rateHeaders = Object.entries(err.headers || {})
        .filter(([k]) => k.toLowerCase().includes('rate') || k.toLowerCase().includes('x-'));
      if (rateHeaders.length) console.log('   Rate headers:', Object.fromEntries(rateHeaders));
    }
  }
}

main();
