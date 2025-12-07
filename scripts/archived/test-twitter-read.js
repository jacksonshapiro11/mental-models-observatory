#!/usr/bin/env node

/**
 * Test Twitter API read access to verify authentication
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });

const { TwitterApi } = require('twitter-api-v2');

async function testRead() {
  console.log('🧪 Testing Twitter API Read Access\n');
  
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    console.error('❌ Twitter credentials not found');
    process.exit(1);
  }
  
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });
  
  const rwClient = client.readWrite;
  
  try {
    // Test reading user info (should work even on Free tier)
    console.log('📖 Testing read access...');
    const me = await rwClient.v2.me();
    console.log('✅ Read access works!');
    console.log(`   Username: @${me.data.username}`);
    console.log(`   Name: ${me.data.name}`);
    console.log(`   ID: ${me.data.id}`);
    console.log('\n✅ Authentication is working correctly!');
    console.log('⚠️  The issue is likely:');
    console.log('   1. App access tier (Free tier can\'t post)');
    console.log('   2. Or tokens need to be regenerated after setting app to "Read and Write"');
    return true;
  } catch (error) {
    console.error('❌ Read access failed');
    console.error(`   Error: ${error.message}`);
    if (error.code === 403) {
      console.error('\n💡 This suggests authentication itself might be the issue.');
      console.error('   Try regenerating your access tokens in the Twitter Developer Portal.');
    }
    return false;
  }
}

testRead();

