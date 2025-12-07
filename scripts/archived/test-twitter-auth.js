#!/usr/bin/env node

/**
 * Test Twitter API authentication
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function testAuth() {
  console.log('🧪 Testing Twitter API Authentication...\n');
  
  // Check credentials
  const hasOAuth1 = process.env.TWITTER_API_KEY && 
                    process.env.TWITTER_API_SECRET && 
                    process.env.TWITTER_ACCESS_TOKEN && 
                    process.env.TWITTER_ACCESS_TOKEN_SECRET;
  
  console.log('📋 Credentials check:');
  console.log(`   API Key: ${process.env.TWITTER_API_KEY ? '✅' : '❌'}`);
  console.log(`   API Secret: ${process.env.TWITTER_API_SECRET ? '✅' : '❌'}`);
  console.log(`   Access Token: ${process.env.TWITTER_ACCESS_TOKEN ? '✅' : '❌'}`);
  console.log(`   Access Token Secret: ${process.env.TWITTER_ACCESS_TOKEN_SECRET ? '✅' : '❌'}\n`);
  
  if (!hasOAuth1) {
    console.error('❌ Missing OAuth 1.0a credentials');
    process.exit(1);
  }
  
  const client = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });
  
  // Test with a simple tweet
  console.log('📝 Testing tweet post...');
  const testTweet = '🧪 Test tweet from automation system';
  
  try {
    const result = await client.postTweet(testTweet, null);
    
    if (result.success) {
      console.log('✅ Authentication successful!');
      console.log(`   Tweet ID: ${result.tweetId}`);
      console.log(`   Tweet: ${result.text}`);
      console.log('\n🎉 Your credentials are working!');
    } else {
      console.error('❌ Failed to post tweet');
      console.error(`   Error: ${result.error}`);
      console.log('\n💡 Possible issues:');
      console.log('   1. App permissions: Make sure your app has "Read and Write" permissions');
      console.log('   2. Credentials: Verify all 4 credentials are correct');
      console.log('   3. App status: Check if your app is active in Twitter Developer Portal');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Check:');
    console.log('   - Twitter Developer Portal: https://developer.twitter.com/en/portal/dashboard');
    console.log('   - App permissions: Must be "Read and Write"');
    console.log('   - Credentials: All 4 must be correct');
  }
}

testAuth();

