#!/usr/bin/env node

/**
 * Test script to post a single tweet
 * Usage: node scripts/test-post-one-tweet.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postTestTweet() {
  console.log('🧪 Testing Twitter posting...\n');

  // Check for credentials
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    console.error('❌ Missing Twitter credentials!');
    console.error('   Make sure these are set in .env.local:');
    console.error('   - TWITTER_API_KEY');
    console.error('   - TWITTER_API_SECRET');
    console.error('   - TWITTER_ACCESS_TOKEN');
    console.error('   - TWITTER_ACCESS_TOKEN_SECRET');
    process.exit(1);
  }

  console.log('✅ Credentials found');
  console.log('   Using OAuth 1.0a\n');

  // Initialize Twitter client
  const client = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });

  // Test tweet content
  const tweetText = `🧪 Test tweet from Mental Models Observatory - ${new Date().toISOString()}`;

  console.log('📝 Tweet content:');
  console.log(`   "${tweetText}"\n`);

  console.log('🚀 Posting tweet...\n');

  try {
    const result = await client.postTweet(tweetText);

    if (result.success) {
      console.log('✅ SUCCESS! Tweet posted!');
      console.log(`   Tweet ID: ${result.tweetId}`);
      console.log(`   View at: https://twitter.com/i/web/status/${result.tweetId}`);
      console.log('\n🎉 Your Twitter integration is working correctly!');
      process.exit(0);
    } else {
      console.error('❌ FAILED to post tweet');
      console.error(`   Error: ${result.error}`);
      if (result.details) {
        console.error('   Details:', JSON.stringify(result.details, null, 2));
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ EXCEPTION:', error.message);
    console.error(error);
    process.exit(1);
  }
}

postTestTweet();
