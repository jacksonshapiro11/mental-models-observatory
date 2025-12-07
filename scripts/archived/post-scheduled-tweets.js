#!/usr/bin/env node

/**
 * Post scheduled tweets based on schedule file
 * Only posts if current time matches scheduled time
 * 
 * Usage:
 *   node scripts/post-scheduled-tweets.js [--force] [--check-all]
 * 
 * Options:
 *   --force      Post all scheduled tweets regardless of time
 *   --check-all  Check all scheduled dates, not just today
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const TwitterClient = require('./platforms/twitter-client');

async function postThread(threadData, dryRun = false) {
  // Use OAuth 1.0a (required for posting tweets)
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    throw new Error('Twitter OAuth 1.0a credentials not found in .env.local');
  }
  
  const client = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });
  
  let previousTweetId = null;
  const postedTweetIds = [];
  
  for (let idx = 0; idx < threadData.thread.length; idx++) {
    const tweet = threadData.thread[idx];
    const tweetText = tweet.text || tweet;
    const tweetNum = idx + 1;
    
    if (dryRun) {
      console.log(`  [DRY RUN] Tweet ${tweetNum}/${threadData.thread.length}: ${tweetText.substring(0, 50)}...`);
      postedTweetIds.push(`dry-run-${tweetNum}`);
    } else {
      try {
        const result = await client.postTweet(tweetText, previousTweetId);
        if (result.success) {
          console.log(`  ✅ Posted tweet ${tweetNum}/${threadData.thread.length}`);
          previousTweetId = result.tweetId;
          postedTweetIds.push(result.tweetId);
          
          // Wait 5 seconds between tweets in thread
          if (tweetNum < threadData.thread.length) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error(`  ❌ Error posting tweet ${tweetNum}:`, error.message);
        throw error;
      }
    }
  }
  
  return postedTweetIds;
}

async function postScheduledTweets(force = false, checkAll = false) {
  const scheduledDir = path.join(process.cwd(), 'marketing-content', 'scheduled-tweets');
  const schedulePath = path.join(scheduledDir, 'posting-schedule.json');
  
  if (!fs.existsSync(schedulePath)) {
    console.error('❌ No posting schedule found. Run: npm run parse-tweets');
    process.exit(1);
  }
  
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().substring(0, 5); // HH:MM
  
  console.log(`📅 Checking scheduled tweets...`);
  console.log(`   Current time: ${today} ${currentTime}\n`);
  
  const toPost = schedule.filter(item => {
    if (force) return true;
    if (checkAll) return item.date <= today;
    
    // Check if scheduled time is within 5 minutes of now
    const scheduledDateTime = new Date(item.datetime);
    const timeDiff = Math.abs(now - scheduledDateTime);
    const minutesDiff = timeDiff / (1000 * 60);
    
    return item.date === today && minutesDiff <= 5;
  });
  
  if (toPost.length === 0) {
    console.log('⏳ No tweets scheduled for posting right now.');
    if (!force && !checkAll) {
      console.log('   Use --force to post all scheduled tweets');
      console.log('   Use --check-all to check all past/current dates');
    }
    return;
  }
  
  console.log(`📱 Found ${toPost.length} scheduled tweet(s) to post\n`);
  
  const results = {
    posted: [],
    errors: [],
    timestamp: new Date().toISOString()
  };
  
  for (const item of toPost) {
    const threadPath = path.join(scheduledDir, item.date, `${item.slug}-thread-${item.thread}.json`);
    
    if (!fs.existsSync(threadPath)) {
      console.error(`❌ Thread file not found: ${threadPath}`);
      results.errors.push(`${item.model} - Thread ${item.thread}: File not found`);
      continue;
    }
    
    const threadData = JSON.parse(fs.readFileSync(threadPath, 'utf8'));
    
    console.log(`🧵 ${item.model} - Thread ${item.thread}/${item.totalThreads}`);
    console.log(`   Scheduled: ${item.day} ${item.date} at ${item.time}`);
    
    try {
      const tweetIds = await postThread(threadData, false);
      results.posted.push({
        model: item.model,
        thread: item.thread,
        date: item.date,
        time: item.time,
        tweetIds
      });
      console.log(`✅ Posted successfully\n`);
      
      // Wait 1 minute between different threads
      if (item !== toPost[toPost.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
      results.errors.push(`${item.model} - Thread ${item.thread}: ${error.message}`);
    }
  }
  
  // Save results
  const resultsPath = path.join(scheduledDir, `post-results-${today}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Posted: ${results.posted.length}`);
  console.log(`   ❌ Errors: ${results.errors.length}`);
  console.log(`   📁 Saved to: ${resultsPath}`);
}

// Main execution
const args = process.argv.slice(2);
const force = args.includes('--force');
const checkAll = args.includes('--check-all');

postScheduledTweets(force, checkAll)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

