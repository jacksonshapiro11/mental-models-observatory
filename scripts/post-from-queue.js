#!/usr/bin/env node

/**
 * Post from queue - uses EXACT same logic as test-tweet-now
 * Posts any tweet that's due (including missed ones)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postFromQueue() {
  const queueFile = path.join(process.cwd(), 'tweets', 'queue', 'pending.json');
  const postedDir = path.join(process.cwd(), 'tweets', 'posted');
  
  if (!fs.existsSync(queueFile)) {
    console.log('📭 No queue file found');
    return;
  }
  
  if (!fs.existsSync(postedDir)) {
    fs.mkdirSync(postedDir, { recursive: true });
  }
  
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  
  // Get current time in EST
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const estDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
  const estTime = `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}`;
  
  console.log(`\n📅 Current time: ${estDate} ${estTime} EST\n`);
  
  // Find tweets that should be posted
  const toPost = queue.filter(item => {
    if (item.status === 'posted') return false;
    
    const scheduledDateTime = new Date(item.scheduledDateTime);
    const nowUTC = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    
    return scheduledDateTime <= nowUTC;
  });
  
  if (toPost.length === 0) {
    console.log('⏰ No tweets due yet');
    const next = queue.find(item => item.status === 'pending');
    if (next) {
      console.log(`\n📋 Next: ${next.modelName}`);
      console.log(`   Scheduled: ${next.scheduledDate} ${next.scheduledTime} EST\n`);
    }
    return;
  }
  
  // Post first due tweet
  const thread = toPost[0];
  
  console.log(`🐦 Posting: ${thread.modelName}`);
  console.log(`   Scheduled: ${thread.scheduledDate} ${thread.scheduledTime} EST\n`);
  
  // Use SAME TwitterClient as test-tweet-now
  const client = new TwitterClient({
    oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
    refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET
  });
  
  // Post thread (SAME logic as test-tweet-now)
  let previousTweetId = null;
  const results = [];
  
  for (let i = 0; i < thread.tweets.length; i++) {
    const tweet = thread.tweets[i];
    console.log(`Tweet ${i + 1}/${thread.tweets.length}:`);
    console.log(`  ${tweet.substring(0, 50)}...`);
    console.log(`  Length: ${tweet.length} chars`);
    
    const result = await client.postTweet(tweet, previousTweetId);
    
    if (!result.success) {
      console.error(`  ❌ Failed: ${result.error}`);
      if (result.details) {
        console.error(`  Details:`, JSON.stringify(result.details, null, 2));
      }
      process.exit(1);
    }
    
    console.log(`  ✅ Posted! ID: ${result.tweetId}\n`);
    previousTweetId = result.tweetId;
    results.push(result);
    
    // Wait 5 seconds between tweets
    if (i < thread.tweets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Mark as posted
  thread.status = 'posted';
  thread.postedAt = new Date().toISOString();
  thread.tweetIds = results.map(r => r.tweetId);
  thread.threadUrl = `https://twitter.com/Cosmic_t_rex/status/${results[0].tweetId}`;
  
  // Save to posted history
  const today = new Date().toISOString().split('T')[0];
  const postedFile = path.join(postedDir, `${today}.json`);
  
  let posted = [];
  if (fs.existsSync(postedFile)) {
    posted = JSON.parse(fs.readFileSync(postedFile, 'utf8'));
  }
  posted.push(thread);
  fs.writeFileSync(postedFile, JSON.stringify(posted, null, 2));
  
  // Update queue
  const updated = queue.map(item =>
    item.scheduledDateTime === thread.scheduledDateTime ? thread : item
  );
  fs.writeFileSync(queueFile, JSON.stringify(updated, null, 2));
  
  console.log('✅ Thread posted successfully!');
  console.log(`🔗 ${thread.threadUrl}\n`);
  
  const remaining = updated.filter(item => item.status === 'pending').length;
  console.log(`📊 Remaining: ${remaining} threads\n`);
}

postFromQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

