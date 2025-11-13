#!/usr/bin/env node

/**
 * Auto-Post Marketing Content
 * 
 * Automatically posts generated content to social media platforms.
 * Supports: Twitter/X, LinkedIn (via APIs)
 * 
 * Usage:
 *   node scripts/auto-post-content.js [options]
 * 
 * Options:
 *   --input DIR       Input directory (default: ./marketing-content)
 *   --platform PLATFORM  twitter, linkedin, all
 *   --dry-run         Test without actually posting
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Platform clients
const TwitterClient = require('./platforms/twitter-client');

async function postTwitterThread(thread, dryRun = false) {
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET) {
    console.log('⚠️  Twitter API keys not configured. Skipping Twitter posts.');
    return { success: false, reason: 'No API keys' };
  }

  const client = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });

  if (dryRun) {
    console.log(`[DRY RUN] Would post Twitter thread for: ${thread.model}`);
    thread.thread.forEach(tweet => {
      console.log(`  Tweet ${tweet.number}: ${tweet.text.substring(0, 50)}...`);
    });
    return { success: true, dryRun: true };
  }

  try {
    let previousTweetId = null;
    const postedTweets = [];

    for (const tweet of thread.thread) {
      const result = await client.postTweet(tweet.text, previousTweetId);
      if (result.success) {
        previousTweetId = result.tweetId;
        postedTweets.push(result.tweetId);
        console.log(`✅ Posted tweet ${tweet.number}/${thread.thread.length}`);
        
        // Wait 5 seconds between tweets in a thread
        if (tweet.number < thread.thread.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else {
        console.error(`❌ Failed to post tweet ${tweet.number}:`, result.error);
        return { success: false, error: result.error };
      }
    }

    return { success: true, tweetIds: postedTweets };
  } catch (error) {
    console.error('❌ Error posting Twitter thread:', error);
    return { success: false, error: error.message };
  }
}

// LinkedIn posting removed - focus on Twitter for now
// Can be added back later if needed

async function autoPostContent(inputDir, dryRun = false) {
  console.log(`🚀 Auto-posting content from: ${inputDir}`);
  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No posts will be made\n');
  }

  // Find latest content directory
  const dirs = fs.readdirSync(inputDir)
    .filter(f => fs.statSync(path.join(inputDir, f)).isDirectory())
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.error('❌ No content directories found. Run generate-content first.');
    process.exit(1);
  }

  const latestDir = dirs[0];
  const contentDir = path.join(inputDir, latestDir);
  console.log(`📁 Using content from: ${latestDir}\n`);

  // Find today's content
  const today = new Date().toISOString().split('T')[0];
  const dayFiles = fs.readdirSync(contentDir)
    .filter(f => f.startsWith('day-') && f.endsWith('.json'))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/day-(\d+)/)?.[1] || '0');
      const bNum = parseInt(b.match(/day-(\d+)/)?.[1] || '0');
      return aNum - bNum;
    });

  // Find content for today or next available
  let contentFile = null;
  for (const file of dayFiles) {
    const filePath = path.join(contentDir, file);
    const dayContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (dayContent.date === today || dayContent.date >= today) {
      contentFile = filePath;
      break;
    }
  }

  if (!contentFile) {
    console.log('⚠️  No content found for today or future dates.');
    console.log('   Generating new content...');
    // Could trigger content generation here
    return;
  }

  const dayContent = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  console.log(`📅 Posting content for: ${dayContent.date}\n`);

  const results = {
    date: dayContent.date,
    platform: 'twitter',
    posts: [],
    errors: []
  };

  // Post each model's content to Twitter
  for (const model of dayContent.models) {
    console.log(`\n📝 Processing: ${model.model}`);

    if (model.twitter) {
      console.log('🐦 Posting to Twitter...');
      const result = await postTwitterThread(model.twitter, dryRun);
      results.posts.push({
        model: model.model,
        ...result
      });

      if (!result.success && !result.dryRun) {
        results.errors.push(`${model.model} - ${result.error || result.reason}`);
      }

      // Rate limiting: wait 1 minute between models
      if (!dryRun && model !== dayContent.models[dayContent.models.length - 1]) {
        console.log('⏳ Waiting 60 seconds (rate limiting)...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } else {
      console.log('⚠️  No Twitter content found for this model');
    }
  }

  // Save results
  const resultsFile = path.join(contentDir, `post-results-${today}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  console.log(`\n✅ Posting complete!`);
  console.log(`📊 Results saved to: ${resultsFile}`);
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    results.errors.forEach(err => console.log(`   - ${err}`));
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith('--input='))?.split('=')[1] || 
                 (args.includes('--input') ? args[args.indexOf('--input') + 1] : null);
const dryRun = args.includes('--dry-run');

const inputDir = inputArg || path.join(process.cwd(), 'marketing-content');

autoPostContent(inputDir, dryRun)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

