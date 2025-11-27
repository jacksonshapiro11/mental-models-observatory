#!/usr/bin/env node

/**
 * Queue weekly tweets from markdown file
 * Validates character limits and schedules 3/day at 9am, 12pm, 5pm EST
 */

const fs = require('fs');
const path = require('path');

function parseMarkdown(markdownPath) {
  const content = fs.readFileSync(markdownPath, 'utf8');
  const threads = [];
  
  // Split by ## PROMPT sections
  const sections = content.split(/## PROMPT \d+:/);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    
    // Extract model name
    const modelMatch = section.match(/^([^\n]+)/);
    if (!modelMatch) continue;
    const modelName = modelMatch[1].trim();
    
    // Extract tweet blocks - each **Tweet X:** is a separate thread
    const tweetBlocks = section.match(/```\n([\s\S]*?)```/g);
    if (!tweetBlocks) continue;
    
    // Each code block is ONE thread with 3 sub-tweets
    tweetBlocks.forEach((block, blockIdx) => {
      let content = block.replace(/```\n?/g, '').trim();
      
      // Split by SUB TWEET markers
      const subTweets = content.split(/SUB TWEET \d+\n/).filter(t => t.trim());
      
      const tweets = subTweets.map(subTweet => {
        return subTweet.trim().replace(/\n\n+/g, '\n');
      }).filter(t => t);
      
      // Validate character limits
      const invalid = tweets.filter(t => t.length > 280);
      if (invalid.length > 0) {
        console.error(`❌ ${modelName} - Thread ${blockIdx + 1}: ${invalid.length} tweet(s) over 280 chars`);
        invalid.forEach((t, idx) => {
          console.error(`   Tweet ${idx + 1}: ${t.length} chars`);
        });
        process.exit(1);
      }
      
      threads.push({ 
        modelName: `${modelName} - Thread ${blockIdx + 1}`,
        tweets 
      });
    });
  }
  
  return threads;
}

function scheduleThreads(threads, startDate) {
  const times = ['09:00', '12:00', '17:00']; // EST times
  const scheduled = [];
  
  let currentDate = new Date(startDate);
  let timeIndex = 0;
  
  threads.forEach(thread => {
    const time = times[timeIndex];
    const [hours, minutes] = time.split(':');
    
    const scheduledDateTime = new Date(currentDate);
    scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    scheduled.push({
      modelName: thread.modelName,
      tweets: thread.tweets,
      scheduledDate: currentDate.toISOString().split('T')[0],
      scheduledTime: time,
      scheduledDateTime: scheduledDateTime.toISOString(),
      status: 'pending'
    });
    
    timeIndex++;
    if (timeIndex >= times.length) {
      timeIndex = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return scheduled;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run queue-weekly-tweets <markdown-file>');
    process.exit(1);
  }
  
  const markdownPath = args[0];
  if (!fs.existsSync(markdownPath)) {
    console.error(`❌ File not found: ${markdownPath}`);
    process.exit(1);
  }
  
  console.log(`\n📖 Parsing: ${path.basename(markdownPath)}\n`);
  
  // Parse markdown
  const threads = parseMarkdown(markdownPath);
  console.log(`✅ Found ${threads.length} threads\n`);
  
  // Validate character limits
  console.log('🔍 Validating character limits...');
  threads.forEach(thread => {
    thread.tweets.forEach((tweet, idx) => {
      const len = tweet.length;
      const status = len <= 280 ? '✅' : '❌';
      console.log(`   ${thread.modelName} - Tweet ${idx + 1}: ${len} chars ${status}`);
    });
  });
  console.log('');
  
  // Get existing queue to find last scheduled date
  const queueDir = path.join(process.cwd(), 'tweets', 'queue');
  const queueFile = path.join(queueDir, 'pending.json');
  
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  
  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  if (fs.existsSync(queueFile)) {
    const existing = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    if (existing.length > 0) {
      // Find last scheduled date and start day after
      const lastDate = new Date(existing[existing.length - 1].scheduledDateTime);
      startDate = new Date(lastDate);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);
      console.log(`📅 Appending after existing queue (starts ${startDate.toISOString().split('T')[0]})\n`);
    }
  } else {
    console.log(`📅 Starting today (${startDate.toISOString().split('T')[0]})\n`);
  }
  
  // Schedule threads
  const scheduled = scheduleThreads(threads, startDate);
  
  // Merge with existing queue
  let queue = [];
  if (fs.existsSync(queueFile)) {
    queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  }
  queue = [...queue, ...scheduled];
  
  // Save queue
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  
  console.log(`✅ Queued ${scheduled.length} threads`);
  console.log(`📁 Queue: ${queueFile}\n`);
  
  // Show schedule preview
  console.log('📋 Schedule Preview:');
  scheduled.slice(0, 5).forEach(item => {
    console.log(`   ${item.scheduledDate} ${item.scheduledTime} EST - ${item.modelName}`);
  });
  if (scheduled.length > 5) {
    console.log(`   ... and ${scheduled.length - 5} more`);
  }
  
  console.log('\n✅ Ready! Commit and push to GitHub.');
  console.log('   GitHub Action will auto-post every 3 hours.\n');
}

main();

