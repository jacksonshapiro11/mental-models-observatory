#!/usr/bin/env node

/**
 * Post the next tweet in the queue
 * Marks it as posted and moves to next
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postNextTweet() {
  const queueDir = path.join(process.cwd(), 'tweet-queue');
  const postedDir = path.join(process.cwd(), 'tweet-queue', 'posted');

  // Ensure directories exist
  if (!fs.existsSync(queueDir)) {
    console.error('❌ No tweet queue found. Run: node scripts/generate-tweet-queue.js');
    process.exit(1);
  }

  if (!fs.existsSync(postedDir)) {
    fs.mkdirSync(postedDir, { recursive: true });
  }

  // Find next pending tweet
  const files = fs.readdirSync(queueDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .sort();

  if (files.length === 0) {
    console.log('✅ No more tweets in queue');
    console.log('💡 Generate more with: node scripts/generate-tweet-queue.js');
    process.exit(0);
  }

  const nextFile = files[0];
  const filePath = path.join(queueDir, nextFile);
  const tweetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`\n📱 Posting: ${tweetData.model}\n`);

  // Initialize Twitter client
  const client = new TwitterClient({
    oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
    refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET
  });

  // Post the thread
  let previousTweetId = null;
  const results = [];

  for (let i = 0; i < tweetData.thread.length; i++) {
    const tweet = tweetData.thread[i];
    console.log(`Tweet ${i + 1}/${tweetData.thread.length}:`);
    console.log(`  ${tweet.text.substring(0, 50)}...`);
    console.log(`  Length: ${tweet.text.length} chars`);

    const result = await client.postTweet(tweet.text, previousTweetId);

    if (!result.success) {
      console.error(`  ❌ Failed: ${result.error}`);
      process.exit(1);
    }

    console.log(`  ✅ Posted! ID: ${result.tweetId}\n`);
    previousTweetId = result.tweetId;
    results.push(result);

    // Wait 5 seconds between tweets in thread
    if (i < tweetData.thread.length - 1) {
      console.log('  ⏳ Waiting 5 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Mark as posted
  tweetData.status = 'posted';
  tweetData.postedAt = new Date().toISOString();
  tweetData.tweetIds = results.map(r => r.tweetId);
  tweetData.threadUrl = `https://twitter.com/Cosmic_t_rex/status/${results[0].tweetId}`;

  // Move to posted directory
  const postedPath = path.join(postedDir, nextFile);
  fs.writeFileSync(postedPath, JSON.stringify(tweetData, null, 2));
  fs.unlinkSync(filePath);

  console.log('✅ Thread posted successfully!');
  console.log(`🔗 View: ${tweetData.threadUrl}`);
  console.log(`📁 Marked as posted: ${postedPath}\n`);
}

postNextTweet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

