#!/usr/bin/env node

/**
 * Simple test: Post "hello world" to Twitter
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function testPost() {
  console.log('🧪 Testing Twitter Post: "Hello World"\n');
  
  let client;
  
  // Check for OAuth 2.0 first
  if (process.env.TWITTER_OAUTH2_ACCESS_TOKEN) {
    console.log('🔑 Using OAuth 2.0: ✅\n');
    console.log('   Client ID:', process.env.TWITTER_CLIENT_ID ? '✅' : '❌');
    console.log('   Access Token:', process.env.TWITTER_OAUTH2_ACCESS_TOKEN ? '✅' : '❌');
    console.log('');
    
    client = new TwitterClient({
      oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
      clientId: process.env.TWITTER_CLIENT_ID
    });
  } else if (process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN) {
    console.log('🔑 Credentials check:');
    console.log(`   OAuth 1.0a API Key: ${process.env.TWITTER_API_KEY ? '✅' : '❌'}`);
    console.log(`   OAuth 1.0a API Secret: ${process.env.TWITTER_API_SECRET ? '✅' : '❌'}`);
    console.log(`   OAuth 1.0a Access Token: ${process.env.TWITTER_ACCESS_TOKEN ? '✅' : '❌'}`);
    console.log(`   OAuth 1.0a Access Token Secret: ${process.env.TWITTER_ACCESS_TOKEN_SECRET ? '✅' : '❌'}`);
    console.log('');
    
    client = new TwitterClient({
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    });
  } else {
    console.error('❌ No Twitter credentials found');
    console.error('   Run: node scripts/oauth2-authorize.js');
    process.exit(1);
  }
  
  const testTweet = 'Hello world! Testing Twitter API integration. 🧪';
  
  console.log(`📝 Posting: "${testTweet}"\n`);
  
  try {
    const result = await client.postTweet(testTweet, null);
    
    if (result.success) {
      console.log('✅ SUCCESS! Tweet posted!');
      console.log(`   Tweet ID: ${result.tweetId}`);
      console.log(`   View: https://twitter.com/i/web/status/${result.tweetId}`);
      console.log('\n🎉 Your Twitter integration is working!');
    } else {
      console.error('❌ Failed to post');
      console.error(`   Error: ${result.error}`);
      if (result.details) {
        console.error(`   Code: ${result.details.code}`);
        if (result.details.data) {
          console.error(`   Details: ${JSON.stringify(result.details.data, null, 2)}`);
        }
      }
      if (result.details && result.details.accessTierIssue) {
        console.error('\n⚠️  ACCESS TIER ISSUE:');
        console.error('   Your app is on the "Free" tier, which only allows READ access.');
        console.error('   To POST tweets, you need to upgrade to:');
        console.error('   - "Essential" tier ($100/month) - allows posting tweets');
        console.error('   - "Elevated" tier (free, but requires approval) - full access');
        console.error('\n   Upgrade here: https://developer.twitter.com/en/portal/products');
        console.error('   Or apply for Elevated access: https://developer.twitter.com/en/portal/products/elevated');
      } else {
        console.error('\n💡 403 Forbidden usually means:');
        console.error('   1. App needs "Elevated" or "Essential" access tier (not "Free")');
        console.error('   2. App permissions must be "Read and Write"');
        console.error('   3. OAuth callback URL might need to be set');
        console.error('   4. Check Twitter Developer Portal: https://developer.twitter.com/en/portal/dashboard');
        console.error('   5. Go to: App Settings → User authentication settings → Ensure "Read and write"');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 403) {
      console.error('\n💡 403 Forbidden - Check:');
      console.error('   - App access tier: Need "Elevated" or "Essential" (not "Free")');
      console.error('   - App permissions: Must be "Read and Write"');
      console.error('   - Go to: https://developer.twitter.com/en/portal/dashboard');
      console.error('   - Click your app → Settings → User authentication settings');
      console.error('   - Ensure "Read and write" is selected');
    } else {
      console.error('\n💡 Check:');
      console.error('   - App has "Read and Write" permissions');
      console.error('   - All credentials are correct');
      console.error('   - App is active in Twitter Developer Portal');
    }
  }
}

testPost();

