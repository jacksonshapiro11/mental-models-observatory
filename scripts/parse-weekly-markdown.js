#!/usr/bin/env node

/**
 * Parse weekly markdown format into scheduled tweets
 * Format: ## PROMPT N: with **Tweet 1-3:** in code blocks
 */

const fs = require('fs');
const path = require('path');

function parseWeeklyMarkdown(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const threads = [];
  
  // Split by ## PROMPT sections
  const sections = content.split(/## PROMPT \d+:/);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    
    // Extract model name from first line
    const modelMatch = section.match(/^([^\n]+)/);
    if (!modelMatch) continue;
    
    const modelName = modelMatch[1].trim();
    
    // Extract model slug from URL in tweets
    const urlMatch = section.match(/https:\/\/www\.cosmictrex\.xyz\/models\/([^\s]+)/);
    const modelSlug = urlMatch ? urlMatch[1] : modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Extract tweets from code blocks
    const tweetBlocks = section.match(/```\n([\s\S]*?)```/g);
    if (!tweetBlocks || tweetBlocks.length === 0) continue;
    
    const tweets = tweetBlocks.map(block => {
      // Remove code block markers and trim
      return block.replace(/```\n?/g, '').trim();
    });
    
    if (tweets.length > 0) {
      threads.push({
        modelName,
        modelSlug,
        tweets,
        totalTweets: tweets.length
      });
    }
  }
  
  return threads;
}

function scheduleThreads(threads, startDate = null) {
  // Times in EST: 9am, 12pm, 5pm
  const postTimes = ['09:00', '12:00', '17:00'];
  
  // If no start date, use tomorrow
  if (!startDate) {
    startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
  }
  
  const scheduled = [];
  let currentDate = new Date(startDate);
  let timeIndex = 0;
  
  threads.forEach((thread, threadIdx) => {
    const time = postTimes[timeIndex];
    const scheduledDateTime = new Date(currentDate);
    const [hours, minutes] = time.split(':');
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    scheduled.push({
      threadIndex: threadIdx,
      modelName: thread.modelName,
      modelSlug: thread.modelSlug,
      tweets: thread.tweets,
      scheduledDate: currentDate.toISOString().split('T')[0],
      scheduledTime: time,
      scheduledDateTime: scheduledDateTime.toISOString(),
      status: 'pending'
    });
    
    // Move to next time slot
    timeIndex++;
    if (timeIndex >= postTimes.length) {
      timeIndex = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return scheduled;
}

function addToQueue(markdownPath) {
  console.log(`\n📖 Parsing: ${path.basename(markdownPath)}\n`);
  
  const threads = parseWeeklyMarkdown(markdownPath);
  console.log(`✅ Found ${threads.length} threads\n`);
  
  // Load existing queue
  const queueDir = path.join(process.cwd(), 'tweets', 'queue');
  const queueFile = path.join(queueDir, 'pending.json');
  
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  
  let existingQueue = [];
  if (fs.existsSync(queueFile)) {
    existingQueue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  }
  
  // Find last scheduled date
  let startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Default to tomorrow
  
  if (existingQueue.length > 0) {
    const lastScheduled = new Date(existingQueue[existingQueue.length - 1].scheduledDateTime);
    // Start after last scheduled tweet (next day)
    startDate = new Date(lastScheduled);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
  }
  
  // Schedule new threads
  const scheduled = scheduleThreads(threads, startDate);
  
  // Add to queue
  const newQueue = [...existingQueue, ...scheduled];
  
  fs.writeFileSync(queueFile, JSON.stringify(newQueue, null, 2));
  
  console.log(`✅ Scheduled ${scheduled.length} threads`);
  console.log(`📅 Starting from: ${startDate.toISOString().split('T')[0]}`);
  console.log(`📁 Queue file: ${queueFile}\n`);
  
  // Show schedule
  console.log('📋 Schedule:');
  scheduled.slice(0, 5).forEach(item => {
    console.log(`   ${item.scheduledDate} ${item.scheduledTime} - ${item.modelName}`);
  });
  if (scheduled.length > 5) {
    console.log(`   ... and ${scheduled.length - 5} more`);
  }
  console.log('');
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node parse-weekly-markdown.js <markdown-file>');
  process.exit(1);
}

const markdownPath = args[0];
if (!fs.existsSync(markdownPath)) {
  console.error(`❌ File not found: ${markdownPath}`);
  process.exit(1);
}

addToQueue(markdownPath);

