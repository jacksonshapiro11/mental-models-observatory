#!/usr/bin/env node

/**
 * Parse tweets from markdown file and convert to posting format
 * 
 * Converts TWITTER_CONTENT_FINAL.md into JSON format for auto-posting
 */

const fs = require('fs');
const path = require('path');

function parseTweetsFromMarkdown(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const tweets = [];
  
  // Split by PROMPT sections
  const promptSections = content.split(/## PROMPT \d+:/);
  
  for (let i = 1; i < promptSections.length; i++) {
    const section = promptSections[i];
    const modelMatch = section.match(/^([^\n]+)/);
    if (!modelMatch) continue;
    
    const modelName = modelMatch[1].trim();
    
    // Extract slug from URLs in the section
    const urlMatch = section.match(/https:\/\/www\.cosmictrex\.xyz\/models\/([^\s]+)/);
    const slug = urlMatch ? urlMatch[1] : modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Extract all tweets for this model
    const tweetMatches = section.matchAll(/\*\*Tweet \d+:\*\*\s*\n\n([\s\S]*?)(?=\*\*Tweet \d+:|$)/g);
    
    const modelTweets = [];
    let tweetNum = 1;
    
    for (const match of tweetMatches) {
      const fullTweet = match[1].trim();
      
      // Split into 3 parts:
      // 1. Scenario + Model name (up to "From [Book]")
      // 2. Quote + Connection (from "From [Book]" to invitation)
      // 3. Invitation + URL (last part)
      
      // Find the URL first
      const urlMatch = fullTweet.match(/(https:\/\/[^\s]+)/);
      const url = urlMatch ? urlMatch[1] : '';
      
      // Find invitation patterns
      const invitationPatterns = [
        /(I read a lot\. Wanted to remember what mattered\. Built this to help me think clearer\. Maybe it helps you\.)/,
        /(Signal gets buried under noise\. I enjoy organizing ideas\. This is what came out of it\.)/,
        /(Information overload is real\. Spent time filtering what I read\. See if any of it resonates\.)/,
        /(We all keep re-learning the same things\. I organized them here\. Take what's useful\.)/,
        /(Most content is noise\. I like reading\. This is my attempt to find signal\.)/,
        /(Hard to know what actually matters\. I'm trying to figure it out\. Maybe you are too\.)/,
        /(Good ideas get buried fast\. I pulled them together here\. See what clicks\.)/,
        /(Couldn't keep track of what I was learning\. Built this to fix that\. Use what helps\.)/,
        /(Core ideas buried in endless repackaging\. Tried to get back to the core\. Take what fits\.)/,
        /(Started keeping notes for myself\. Organized them into this\. Explore if you want\.)/
      ];
      
      let invitationText = '';
      let invitationMatch = null;
      for (const pattern of invitationPatterns) {
        const match = fullTweet.match(pattern);
        if (match) {
          invitationText = match[1];
          invitationMatch = match;
          break;
        }
      }
      
      // Find "From [Book]" section
      const fromBookMatch = fullTweet.match(/From ([^:]+):\s*\n\n"([^"]+)"\s*\n\n([^\n]+)/);
      
      if (fromBookMatch && invitationMatch) {
        // Part 1: Everything before "From [Book]"
        const beforeQuote = fullTweet.substring(0, fullTweet.indexOf('From '));
        const part1 = beforeQuote.trim();
        
        // Part 2: Quote section
        const quoteStart = fullTweet.indexOf('From ');
        const quoteEnd = invitationMatch.index;
        const part2 = fullTweet.substring(quoteStart, quoteEnd).trim();
        
        // Part 3: Invitation + URL
        const part3 = invitationText + (url ? '\n\n' + url : '');
        
        // Trim parts to 280 chars if needed
        const trimToLimit = (text, maxLen = 280) => {
          if (text.length <= maxLen) return text;
          // Try to cut at sentence boundary
          const trimmed = text.substring(0, maxLen - 3);
          const lastPeriod = trimmed.lastIndexOf('.');
          const lastNewline = trimmed.lastIndexOf('\n');
          const cutPoint = Math.max(lastPeriod, lastNewline);
          if (cutPoint > maxLen * 0.7) {
            return text.substring(0, cutPoint + 1) + '..';
          }
          return trimmed + '...';
        };
        
        // Add all 3 parts as separate tweets
        if (part1) {
          const trimmed1 = trimToLimit(part1);
          modelTweets.push({
            number: tweetNum++,
            text: trimmed1,
            charCount: trimmed1.length,
            type: 'scenario'
          });
        }
        if (part2) {
          const trimmed2 = trimToLimit(part2);
          modelTweets.push({
            number: tweetNum++,
            text: trimmed2,
            charCount: trimmed2.length,
            type: 'quote'
          });
        }
        if (part3) {
          const trimmed3 = trimToLimit(part3);
          modelTweets.push({
            number: tweetNum++,
            text: trimmed3,
            charCount: trimmed3.length,
            type: 'invitation'
          });
        }
      } else {
        // Fallback: try simpler split
        const parts = fullTweet.split(/\n\n+/);
        if (parts.length >= 3) {
          // Try to intelligently group parts
          let part1 = '';
          let part2 = '';
          let part3 = '';
          
          // Find model name line
          const modelNameIdx = parts.findIndex(p => p.includes(modelName) && !p.includes('From '));
          
          if (modelNameIdx >= 0) {
            part1 = parts.slice(0, modelNameIdx + 1).join('\n\n').trim();
            
            // Find quote section
            const quoteStart = parts.findIndex(p => p.startsWith('From '));
            if (quoteStart >= 0) {
              const invStart = parts.findIndex(p => invitationPatterns.some(pat => pat.test(p)));
              if (invStart >= 0) {
                part2 = parts.slice(quoteStart, invStart).join('\n\n').trim();
                part3 = parts.slice(invStart).join('\n\n').trim();
                if (url && !part3.includes(url)) {
                  part3 += '\n\n' + url;
                }
              }
            }
          }
          
          // If we got parts, use them
          if (part1 && part2 && part3) {
            const trimToLimit = (text) => text.length > 280 ? text.substring(0, 277) + '...' : text;
            modelTweets.push({
              number: tweetNum++,
              text: trimToLimit(part1),
              charCount: Math.min(part1.length, 280),
              type: 'scenario'
            });
            modelTweets.push({
              number: tweetNum++,
              text: trimToLimit(part2),
              charCount: Math.min(part2.length, 280),
              type: 'quote'
            });
            modelTweets.push({
              number: tweetNum++,
              text: trimToLimit(part3),
              charCount: Math.min(part3.length, 280),
              type: 'invitation'
            });
          } else {
            // Last resort: split evenly (but this shouldn't happen)
            console.warn(`⚠️  Could not parse tweet for ${modelName}, using fallback`);
            const trimmed = fullTweet.length > 280 ? fullTweet.substring(0, 277) + '...' : fullTweet;
            modelTweets.push({
              number: tweetNum++,
              text: trimmed,
              charCount: Math.min(fullTweet.length, 280),
              type: 'full'
            });
          }
        } else {
          // Single part - just trim if needed
          const trimmed = fullTweet.length > 280 ? fullTweet.substring(0, 277) + '...' : fullTweet;
          modelTweets.push({
            number: tweetNum++,
            text: trimmed,
            charCount: Math.min(fullTweet.length, 280),
            type: 'full'
          });
        }
      }
    }
    
    if (modelTweets.length > 0) {
      tweets.push({
        model: modelName,
        slug: slug,
        url: `https://www.cosmictrex.xyz/models/${slug}`,
        thread: modelTweets,
        totalTweets: modelTweets.length,
        totalChars: modelTweets.reduce((sum, t) => sum + t.charCount, 0)
      });
    }
  }
  
  return tweets;
}

function saveTweetsForPosting(tweets, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Schedule: All models in one week, 3 threads per model
  // Spread threads across the week with hours between them
  const startDate = new Date();
  const schedule = [];
  
  // Posting times: 9am, 2pm, 7pm (can be adjusted)
  const postingTimes = ['09:00', '14:00', '19:00'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Find next Monday
  const nextMonday = new Date(startDate);
  const dayOfWeek = nextMonday.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // Schedule all models for the same week, spreading them out
  // Each model gets 3 threads on Mon/Wed/Fri, but stagger models across days
  for (let modelIdx = 0; modelIdx < tweets.length; modelIdx++) {
    const tweet = tweets[modelIdx];
    
    // Split tweets into groups of 3 (threads)
    const threads = [];
    for (let i = 0; i < tweet.thread.length; i += 3) {
      threads.push(tweet.thread.slice(i, i + 3));
    }
    
    // Spread models across the week
    // Model 0: Mon/Wed/Fri
    // Model 1: Tue/Thu/Sat  
    // Model 2: Wed/Fri/Sun
    // etc. (cycling through days)
    const baseDay = modelIdx % 7; // Cycle through days
    const daysForModel = [
      (baseDay + 0) % 7,  // Thread 1 day
      (baseDay + 2) % 7,  // Thread 2 day (2 days later)
      (baseDay + 4) % 7   // Thread 3 day (4 days later)
    ];
    
    for (let threadIdx = 0; threadIdx < threads.length; threadIdx++) {
      const threadDay = daysForModel[threadIdx];
      const postDate = new Date(nextMonday);
      postDate.setDate(postDate.getDate() + threadDay);
      const dateStr = postDate.toISOString().split('T')[0];
      const timeStr = postingTimes[threadIdx] || postingTimes[0];
      
      const dayDir = path.join(outputDir, dateStr);
      if (!fs.existsSync(dayDir)) {
        fs.mkdirSync(dayDir, { recursive: true });
      }
      
      // Save thread as separate file
      const threadData = {
        model: tweet.model,
        slug: tweet.slug,
        url: tweet.url,
        thread: threads[threadIdx],
        threadNumber: threadIdx + 1,
        totalThreads: threads.length,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        scheduledDateTime: `${dateStr}T${timeStr}:00`
      };
      
      const filePath = path.join(dayDir, `${tweet.slug}-thread-${threadIdx + 1}.json`);
      fs.writeFileSync(filePath, JSON.stringify(threadData, null, 2));
      
      schedule.push({
        date: dateStr,
        time: timeStr,
        datetime: `${dateStr}T${timeStr}:00`,
        day: dayNames[threadDay],
        model: tweet.model,
        slug: tweet.slug,
        thread: threadIdx + 1,
        totalThreads: threads.length,
        tweets: threads[threadIdx].length
      });
      
      console.log(`✅ Scheduled ${tweet.model} - Thread ${threadIdx + 1} for ${dayNames[threadDay]} ${dateStr} at ${timeStr}`);
    }
  }
  
  // Save master schedule
  const schedulePath = path.join(outputDir, 'posting-schedule.json');
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
  
  const weekEnd = new Date(nextMonday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  console.log(`\n📅 Created schedule: ${schedulePath}`);
  console.log(`📊 ${tweets.length} models scheduled for week of ${nextMonday.toISOString().split('T')[0]}`);
  console.log(`   Each model: 3 threads (Mon/Wed/Fri at 9am/2pm/7pm)`);
  console.log(`   Total: ${schedule.length} threads scheduled`);
}

// Main execution
const markdownPath = path.join(process.cwd(), 'TWITTER_CONTENT_FINAL.md');
const outputDir = path.join(process.cwd(), 'marketing-content', 'scheduled-tweets');

if (!fs.existsSync(markdownPath)) {
  console.error(`❌ File not found: ${markdownPath}`);
  process.exit(1);
}

console.log('📖 Parsing tweets from markdown...\n');
const tweets = parseTweetsFromMarkdown(markdownPath);

console.log(`✅ Parsed ${tweets.length} models with ${tweets.reduce((sum, t) => sum + t.totalTweets, 0)} total tweets\n`);

saveTweetsForPosting(tweets, outputDir);

console.log(`\n✅ Done! Tweets ready for posting.`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Set up Twitter API keys (see AUTO_POSTING_SETUP.md)`);
console.log(`   2. Test with: npm run post-content:dry-run`);
console.log(`   3. Post with: npm run post-content`);

