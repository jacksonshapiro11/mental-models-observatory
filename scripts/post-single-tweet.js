#!/usr/bin/env node

/**
 * Post a single test tweet thread to Twitter
 */

const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postTestThread() {
  // Check for OAuth 2.0 credentials
  if (!process.env.TWITTER_OAUTH2_ACCESS_TOKEN && !process.env.TWITTER_ACCESS_TOKEN) {
    console.error('❌ Twitter OAuth 2.0 credentials not found in .env.local');
    console.log('\nRequired environment variables:');
    console.log('  - TWITTER_OAUTH2_ACCESS_TOKEN (or TWITTER_ACCESS_TOKEN for OAuth 2.0)');
    console.log('\nRun: npm run twitter:authorize');
    process.exit(1);
  }

  // Use OAuth 2.0 token
  const oauth2Token = process.env.TWITTER_OAUTH2_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN;
  const clientId = process.env.TWITTER_CLIENT_ID;
  
  const client = new TwitterClient({
    oauth2AccessToken: oauth2Token,
    clientId: clientId
  });

  // Test tweet thread about Competitive Advantage
  const thread = [
    // Tweet 1: The Scenario
    `Quarter tank of gas, middle of nowhere. Every station charges the same. You pick one.

Next town over, only one station for 50 miles. Different game entirely.

Competitive Advantage & Sustainable Moats

https://www.cosmictrex.xyz/models/competitive-advantage-sustainable-moats

Real examples →`,

    // Tweet 2: The Book Example
    `From Zero to One by Peter Thiel:

"Things that are important in building a good monopoly: Proprietary tech, network effects, strong brand. The tech advantage must provide a 10x improvement. Network effects make things more useful as more people use them."

This is why some businesses have moats and others don't.`,

    // Tweet 3: The Mission
    `I read a lot. Wanted to remember what mattered. Built this to help me think clearer. Maybe it helps you.

https://www.cosmictrex.xyz/models/competitive-advantage-sustainable-moats`
  ];

  console.log('📱 Posting test thread to Twitter...\n');
  
  let previousTweetId = null;
  const results = [];

  for (let i = 0; i < thread.length; i++) {
    const tweetText = thread[i];
    const tweetNum = i + 1;
    
    console.log(`Tweet ${tweetNum}/${thread.length}:`);
    console.log(`  Text: ${tweetText.substring(0, 50)}...`);
    console.log(`  Length: ${tweetText.length} chars`);
    
    try {
      const result = await client.postTweet(tweetText, previousTweetId);
      
      if (result.success) {
        console.log(`  ✅ Posted successfully!`);
        console.log(`  Tweet ID: ${result.tweetId}\n`);
        previousTweetId = result.tweetId;
        results.push(result);
        
        // Wait 5 seconds between tweets
        if (i < thread.length - 1) {
          console.log('  ⏳ Waiting 5 seconds before next tweet...\n');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else {
        console.error(`  ❌ Failed: ${result.error}`);
        if (result.details) {
          console.error(`  Details:`, JSON.stringify(result.details, null, 2));
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\n✅ Thread posted successfully!');
  console.log(`\nThread URL: https://twitter.com/user/status/${results[0].tweetId}`);
  console.log(`\nPosted ${results.length} tweets`);
}

// Run
postTestThread()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

