#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

function checkAndPost(once = false) {
  console.log(`\n⏰ Checking for scheduled tweets... (${new Date().toLocaleString()})\n`);
  
  const postScript = path.join(__dirname, 'post-scheduled-tweets.js');
  const postProcess = spawn('node', [postScript], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  postProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Check complete');
    } else {
      console.log(`\n⚠️  Check completed with code ${code}`);
    }
    
    if (!once) {
      console.log('⏰ Next check in 5 minutes...\n');
      setTimeout(() => checkAndPost(false), 5 * 60 * 1000);
    } else {
      process.exit(code);
    }
  });
  
  postProcess.on('error', (error) => {
    console.error('❌ Error running post script:', error);
    if (!once) {
      setTimeout(() => checkAndPost(false), 5 * 60 * 1000);
    } else {
      process.exit(1);
    }
  });
}

const args = process.argv.slice(2);
const once = args.includes('--once');

if (once) {
  console.log('🔍 Running one-time check for scheduled tweets...');
  checkAndPost(true);
} else {
  console.log('🤖 Starting automatic tweet scheduler...');
  console.log('   Checking every 5 minutes for tweets to post');
  console.log('   Press Ctrl+C to stop\n');
  checkAndPost(false);
}
