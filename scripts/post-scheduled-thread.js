#!/usr/bin/env node

/**
 * Post scheduled tweets with catch-up logic
 * Posts any tweet that should have been posted (including missed ones)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postScheduledThread() {
  const queueFile = path.join(process.cwd(), 'tweets', 'queue', 'pending.json');
  const postedDir = path.join(process.cwd(), 'tweets', 'posted');
  
  if (!fs.existsSync(queueFile)) {
    console.log('✅ No pending tweets in queue');
    console.log('💡 Add tweets with: node scripts/parse-weekly-markdown.js <markdown-file>');
    return;
  }
  
  if (!fs.existsSync(postedDir)) {
    fs.mkdirSync(postedDir, { recursive: true });
  }
  
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  
  // Find tweets that should be posted (scheduled time is now or past)
  const now = new Date();
  const nowEST = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  console.log(`\n📅 Current time (EST): ${nowEST.toLocaleString('en-US', { timeZone: 'America/New_York' })}\n`);
  
  const toPost = queue.filter(item => {
    if (item.status === 'posted') return false;
    const scheduledTime = new Date(item.scheduledDateTime);
    return scheduledTime <= nowEST;
  });
  
  if (toPost.length === 0) {
    console.log('⏰ No tweets scheduled for posting yet');
    const nextScheduled = queue.find(item => item.status === 'pending');
    if (nextScheduled) {
      const nextTime = new Date(nextScheduled.scheduledDateTime);
      console.log(`📋 Next tweet: ${nextScheduled.modelName}`);
      console.log(`   Scheduled for: ${nextTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST\n`);
    }
    return;
  }
  
  // Post the first pending tweet (catch up one at a time)
  const threadToPost = toPost[0];
  
  console.log(`🐦 Posting: ${threadToPost.modelName}`);
  console.log(`   Scheduled: ${threadToPost.scheduledDate} ${threadToPost.scheduledTime} EST`);
  if (toPost.length > 1) {
    console.log(`   ⚠️  ${toPost.length - 1} other tweet(s) also need posting\n`);
  } else {
    console.log('');
  }
  
  // Initialize Twitter client with auto-refresh
  const client = new TwitterClient({
    oauth2AccessToken: process.env.TWITTER_OAUTH2_ACCESS_TOKEN,
    refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET
  });
  
  // Post the thread
  let previousTweetId = null;
  const results = [];
  
  for (let i = 0; i < threadToPost.tweets.length; i++) {
    const tweetText = threadToPost.tweets[i];
    console.log(`Tweet ${i + 1}/${threadToPost.tweets.length}:`);
    console.log(`  ${tweetText.substring(0, 60)}...`);
    console.log(`  Length: ${tweetText.length} chars`);
    
    const result = await client.postTweet(tweetText, previousTweetId);
    
    if (!result.success) {
      console.error(`  ❌ Failed: ${result.error}`);
      process.exit(1);
    }
    
    console.log(`  ✅ Posted! ID: ${result.tweetId}\n`);
    previousTweetId = result.tweetId;
    results.push(result);
    
    // Wait 5 seconds between tweets in thread
    if (i < threadToPost.tweets.length - 1) {
      console.log('  ⏳ Waiting 5 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Mark as posted
  threadToPost.status = 'posted';
  threadToPost.postedAt = new Date().toISOString();
  threadToPost.tweetIds = results.map(r => r.tweetId);
  threadToPost.threadUrl = `https://twitter.com/Cosmic_t_rex/status/${results[0].tweetId}`;
  
  // Save to posted history
  const today = new Date().toISOString().split('T')[0];
  const postedFile = path.join(postedDir, `${today}.json`);
  
  let postedToday = [];
  if (fs.existsSync(postedFile)) {
    postedToday = JSON.parse(fs.readFileSync(postedFile, 'utf8'));
  }
  postedToday.push(threadToPost);
  fs.writeFileSync(postedFile, JSON.stringify(postedToday, null, 2));
  
  // Update queue (mark as posted)
  const updatedQueue = queue.map(item => 
    item.threadIndex === threadToPost.threadIndex && item.scheduledDateTime === threadToPost.scheduledDateTime
      ? threadToPost
      : item
  );
  fs.writeFileSync(queueFile, JSON.stringify(updatedQueue, null, 2));
  
  console.log('✅ Thread posted successfully!');
  console.log(`🔗 View: ${threadToPost.threadUrl}`);
  console.log(`📁 Saved to: ${postedFile}\n`);
  
  // Show remaining tweets
  const remaining = updatedQueue.filter(item => item.status === 'pending').length;
  console.log(`📊 Remaining in queue: ${remaining} threads`);
  
  if (toPost.length > 1) {
    console.log(`⚠️  ${toPost.length - 1} more tweet(s) need posting now`);
    console.log('   Run again to post next one\n');
  }
}

postScheduledThread()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

