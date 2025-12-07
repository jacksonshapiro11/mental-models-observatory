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

  // Find today's content
  const today = new Date().toISOString().split('T')[0];
  
  // Check if this is the scheduled-tweets format (date-based directories directly in inputDir)
  const dateDirs = fs.readdirSync(inputDir)
    .filter(f => {
      const fullPath = path.join(inputDir, f);
      return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
    })
    .sort();
  
  if (dateDirs.length > 0) {
    // This IS the scheduled-tweets format - date directories are directly in inputDir
    const contentDir = inputDir;
    // New format: date-based directories with individual model files
    // Find today or next available date (including past dates if we're catching up)
    let targetDate = today;
    let targetDir = path.join(contentDir, targetDate);
    
    if (!fs.existsSync(targetDir)) {
      // Find next available date (could be today, future, or earliest past date)
      const nextDate = dateDirs.find(d => d >= today);
      if (nextDate) {
        targetDate = nextDate;
        targetDir = path.join(contentDir, targetDate);
        console.log(`📅 No content for today (${today}). Using next available: ${targetDate}`);
      } else {
        // No future dates, use the earliest available date
        const earliestDate = dateDirs[0];
        if (earliestDate) {
          targetDate = earliestDate;
          targetDir = path.join(contentDir, targetDate);
          console.log(`📅 No content for today or future. Using earliest available: ${targetDate}`);
        } else {
          console.log(`⚠️  No content directories found.`);
          console.log('   Run: npm run parse-tweets');
          return;
        }
      }
    }
    
    const todayDir = targetDir;
    
    const modelFiles = fs.readdirSync(todayDir)
      .filter(f => f.endsWith('.json') && f !== 'posting-schedule.json');
    
    if (modelFiles.length === 0) {
      console.log(`⚠️  No models found for today (${today}).`);
      return;
    }
    
    console.log(`📅 Posting content for: ${today}\n`);
    
    const results = {
      date: today,
      platform: 'twitter',
      posts: [],
      errors: []
    };
    
    // Post each model's tweets (standalone, not threads)
    for (const modelFile of modelFiles) {
      const modelPath = path.join(todayDir, modelFile);
      const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      
      // Handle both formats
      const model = modelData.model || modelData;
      const tweets = modelData.thread || modelData.tweets || [];
      
      console.log(`\n📝 Processing: ${modelData.model || 'Unknown'} (${tweets.length} tweets)`);
      
      if (tweets.length === 0) {
        console.log('⚠️  No tweets found for this model');
        continue;
      }
      
      // Post tweets in groups of 3 (threaded)
      // Each group of 3 tweets forms one thread
      const groupsOf3 = [];
      for (let i = 0; i < tweets.length; i += 3) {
        groupsOf3.push(tweets.slice(i, i + 3));
      }
      
      console.log(`📱 Posting ${groupsOf3.length} threads (3 tweets each)`);
      
      for (let groupIdx = 0; groupIdx < groupsOf3.length; groupIdx++) {
        const group = groupsOf3[groupIdx];
        const threadNum = groupIdx + 1;
        
        console.log(`\n🧵 Thread ${threadNum}/${groupsOf3.length}:`);
        
        if (dryRun) {
          group.forEach((tweet, idx) => {
            const tweetText = tweet.text || tweet;
            console.log(`  [DRY RUN] Tweet ${idx + 1}/3: ${tweetText.substring(0, 50)}...`);
          });
          results.posts.push({
            model: modelData.model || 'Unknown',
            thread: threadNum,
            tweets: group.length,
            success: true,
            dryRun: true
          });
        } else {
          // Post as threaded tweets (reply to previous)
          const client = new TwitterClient({
            apiKey: process.env.TWITTER_API_KEY,
            apiSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
          });
          
          let previousTweetId = null;
          const postedTweetIds = [];
          
          for (let idx = 0; idx < group.length; idx++) {
            const tweet = group[idx];
            const tweetText = tweet.text || tweet;
            const tweetNum = idx + 1;
            
            try {
              // Post as reply to previous tweet (or standalone if first)
              const result = await client.postTweet(tweetText, previousTweetId);
              
              if (result.success) {
                console.log(`  ✅ Posted tweet ${tweetNum}/3`);
                previousTweetId = result.tweetId;
                postedTweetIds.push(result.tweetId);
                
                // Wait 5 seconds between tweets in thread
                if (tweetNum < group.length) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }
              } else {
                console.error(`  ❌ Failed to post tweet ${tweetNum}:`, result.error);
                results.errors.push(`${modelData.model || 'Unknown'} - Thread ${threadNum}, Tweet ${tweetNum}: ${result.error}`);
                break; // Stop this thread if one fails
              }
            } catch (error) {
              console.error(`  ❌ Error posting tweet ${tweetNum}:`, error.message);
              results.errors.push(`${modelData.model || 'Unknown'} - Thread ${threadNum}, Tweet ${tweetNum}: ${error.message}`);
              break; // Stop this thread if one fails
            }
          }
          
          if (postedTweetIds.length > 0) {
            results.posts.push({
              model: modelData.model || 'Unknown',
              thread: threadNum,
              tweets: postedTweetIds.length,
              success: true,
              tweetIds: postedTweetIds
            });
          }
          
          // Wait 1 minute between different threads
          if (threadNum < groupsOf3.length) {
            console.log('⏳ Waiting 60 seconds before next thread...');
            await new Promise(resolve => setTimeout(resolve, 60000));
          }
        }
      }
      
      // Rate limiting: wait 1 minute between models
      if (!dryRun && modelFile !== modelFiles[modelFiles.length - 1]) {
        console.log('⏳ Waiting 60 seconds (rate limiting)...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
    
    // Save results
    const resultsFile = path.join(todayDir, `post-results-${today}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Posting complete!`);
    console.log(`📊 Results saved to: ${resultsFile}`);
    
    if (results.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      results.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    return results;
  }
  
  // Legacy format: find latest content directory with day-based files
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
  
  // Legacy format: day-based files
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

