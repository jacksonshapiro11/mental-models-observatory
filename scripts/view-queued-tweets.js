#!/usr/bin/env node

/**
 * View queued tweets in a simple format for manual posting
 * Shows tweets in chronological order with easy-to-copy format
 */

const fs = require('fs');
const path = require('path');

function main() {
  const queueFile = path.join(process.cwd(), 'tweets', 'queue', 'pending.json');
  
  if (!fs.existsSync(queueFile)) {
    console.log('❌ No queued tweets found.');
    console.log(`   Run: npm run queue-weekly-tweets <markdown-file>`);
    process.exit(1);
  }
  
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  
  if (queue.length === 0) {
    console.log('📭 Queue is empty.');
    process.exit(0);
  }
  
  // Sort by scheduled date/time
  const sorted = [...queue].sort((a, b) => 
    new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime)
  );
  
  // Filter to show only upcoming/pending tweets
  const now = new Date();
  const upcoming = sorted.filter(item => 
    new Date(item.scheduledDateTime) >= now || item.status === 'pending'
  );
  
  const past = sorted.filter(item => 
    new Date(item.scheduledDateTime) < now && item.status !== 'posted'
  );
  
  console.log('\n📋 QUEUED TWEETS FOR MANUAL POSTING\n');
  console.log('═'.repeat(60));
  
  if (past.length > 0) {
    console.log(`\n⏰ PAST DUE (${past.length}):\n`);
    past.forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.modelName}`);
      console.log(`   📅 ${item.scheduledDate} at ${item.scheduledTime} EST`);
      console.log(`   Status: ${item.status || 'pending'}`);
      console.log(`   Thread (${item.tweets.length} tweets):`);
      item.tweets.forEach((tweet, tIdx) => {
        console.log(`\n   Tweet ${tIdx + 1} (${tweet.length} chars):`);
        console.log(`   ${'─'.repeat(50)}`);
        console.log(`   ${tweet.split('\n').join('\n   ')}`);
        console.log(`   ${'─'.repeat(50)}`);
      });
    });
  }
  
  if (upcoming.length > 0) {
    console.log(`\n\n📅 UPCOMING (${upcoming.length}):\n`);
    upcoming.forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.modelName}`);
      console.log(`   📅 ${item.scheduledDate} at ${item.scheduledTime} EST`);
      console.log(`   Status: ${item.status || 'pending'}`);
      console.log(`   Thread (${item.tweets.length} tweets):`);
      item.tweets.forEach((tweet, tIdx) => {
        console.log(`\n   Tweet ${tIdx + 1} (${tweet.length} chars):`);
        console.log(`   ${'─'.repeat(50)}`);
        console.log(`   ${tweet.split('\n').join('\n   ')}`);
        console.log(`   ${'─'.repeat(50)}`);
      });
    });
  }
  
  // Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total queued: ${queue.length}`);
  console.log(`   Past due: ${past.length}`);
  console.log(`   Upcoming: ${upcoming.length}`);
  console.log(`   Posted: ${queue.filter(q => q.status === 'posted').length}`);
  
  // Export option
  console.log('\n💡 TIP: Copy tweets above and post manually to Twitter');
  console.log(`   Queue file: ${queueFile}\n`);
}

main();




