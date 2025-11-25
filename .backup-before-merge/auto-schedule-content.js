#!/usr/bin/env node

/**
 * Auto-Scheduler for Marketing Content
 * 
 * Takes generated content and creates scheduling files for:
 * - Buffer/Hootsuite CSV imports
 * - Social media platform native schedulers
 * - Email newsletter scheduling
 * 
 * Usage:
 *   node scripts/auto-schedule-content.js [options]
 * 
 * Options:
 *   --input DIR     Input directory with generated content (default: ./marketing-content)
 *   --platform PLATFORM  Target platform (buffer, twitter, linkedin, all)
 */

const fs = require('fs');
const path = require('path');

function generateBufferCSV(contentDir, outputFile) {
  const csvRows = [
    ['Created At', 'Text', 'Profile IDs', 'Media URLs', 'Scheduled At', 'Now', 'Top', 'Sent', 'Service Link', 'Status'].join(',')
  ];

  // Find all Twitter thread files
  const files = fs.readdirSync(contentDir);
  const twitterFiles = files.filter(f => f.startsWith('twitter-day-') && f.endsWith('.txt'));

  for (const file of twitterFiles) {
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse threads (simple regex-based parsing)
    const threadMatches = content.match(/=== (.+?) ===([\s\S]*?)(?===|$)/g);
    
    if (threadMatches) {
      threadMatches.forEach(match => {
        const modelMatch = match.match(/=== (.+?) ===/);
        const threadMatch = match.match(/Tweet (\d+) \([\d]+ chars\):\n([\s\S]*?)(?=Tweet \d+|$)/g);
        
        if (modelMatch && threadMatch) {
          const modelName = modelMatch[1];
          
          threadMatch.forEach((tweet, idx) => {
            const tweetMatch = tweet.match(/Tweet \d+ \([\d]+ chars\):\n([\s\S]*?)$/);
            if (tweetMatch) {
              const tweetText = tweetMatch[1].trim();
              const dayMatch = file.match(/day-(\d+)/);
              const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 0;
              
              // Schedule for 8am, 12pm, or 5pm based on tweet number
              const hours = [8, 12, 17];
              const hour = hours[idx % hours.length] || 8;
              const scheduledDate = new Date();
              scheduledDate.setDate(scheduledDate.getDate() + dayNumber);
              scheduledDate.setHours(hour, 0, 0, 0);
              
              csvRows.push([
                new Date().toISOString(),
                `"${tweetText.replace(/"/g, '""')}"`,
                '', // Profile IDs - user fills in
                '', // Media URLs
                scheduledDate.toISOString(),
                'false',
                'false',
                'false',
                '', // Service link
                'pending'
              ].join(','));
            }
          });
        }
      });
    }
  }

  fs.writeFileSync(outputFile, csvRows.join('\n'));
  console.log(`✅ Generated Buffer CSV: ${outputFile}`);
  console.log(`   ${csvRows.length - 1} posts scheduled`);
}

function generateTwitterNativeSchedule(contentDir, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(contentDir);
  const twitterFiles = files.filter(f => f.startsWith('twitter-day-') && f.endsWith('.txt'));

  const schedule = [];

  for (const file of twitterFiles) {
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const dayMatch = file.match(/day-(\d+)/);
    const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 0;
    
    const threadMatches = content.match(/=== (.+?) ===([\s\S]*?)(?===|$)/g);
    
    if (threadMatches) {
      threadMatches.forEach(match => {
        const modelMatch = match.match(/=== (.+?) ===/);
        const threadMatch = match.match(/Tweet (\d+) \([\d]+ chars\):\n([\s\S]*?)(?=Tweet \d+|$)/g);
        
        if (modelMatch && threadMatch) {
          const modelName = modelMatch[1];
          const tweets = [];
          
          threadMatch.forEach(tweet => {
            const tweetMatch = tweet.match(/Tweet \d+ \([\d]+ chars\):\n([\s\S]*?)$/);
            if (tweetMatch) {
              tweets.push(tweetMatch[1].trim());
            }
          });

          if (tweets.length > 0) {
            // Schedule first tweet, then replies
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() + dayNumber);
            baseDate.setHours(8, 0, 0, 0);

            tweets.forEach((tweet, idx) => {
              const tweetDate = new Date(baseDate);
              tweetDate.setMinutes(tweetDate.getMinutes() + idx * 5); // 5 min between tweets
              
              schedule.push({
                date: tweetDate.toISOString(),
                text: tweet,
                type: idx === 0 ? 'tweet' : 'reply',
                threadId: modelName,
                model: modelName
              });
            });
          }
        }
      });
    }
  }

  // Save as JSON for easy import
  const scheduleFile = path.join(outputDir, 'twitter-schedule.json');
  fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2));
  
  // Also create a human-readable schedule
  const readableFile = path.join(outputDir, 'twitter-schedule.txt');
  const readable = schedule.map(s => 
    `${s.date} | ${s.type.toUpperCase()} | ${s.text.substring(0, 50)}...`
  ).join('\n');
  fs.writeFileSync(readableFile, readable);

  console.log(`✅ Generated Twitter schedule: ${scheduleFile}`);
  console.log(`   ${schedule.length} tweets scheduled`);
}

function generateNewsletterSchedule(contentDir, outputFile) {
  const schedule = [];

  // Find all day files
  const files = fs.readdirSync(contentDir);
  const dayFiles = files.filter(f => f.startsWith('day-') && f.endsWith('.json'));

  for (const file of dayFiles) {
    const filePath = path.join(contentDir, file);
    const dayContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Find models with newsletter content
    dayContent.models.forEach(model => {
      if (model.newsletter) {
        const newsletter = model.newsletter;
        schedule.push({
          date: newsletter.date,
          subject: newsletter.subject,
          preview: newsletter.preview,
          model: model.model,
          slug: model.slug,
          url: model.url
        });
      }
    });
  }

  // Group by week
  const weeklySchedule = {};
  schedule.forEach(item => {
    const week = item.date.split('T')[0];
    if (!weeklySchedule[week]) {
      weeklySchedule[week] = [];
    }
    weeklySchedule[week].push(item);
  });

  fs.writeFileSync(outputFile, JSON.stringify(weeklySchedule, null, 2));
  console.log(`✅ Generated newsletter schedule: ${outputFile}`);
  console.log(`   ${Object.keys(weeklySchedule).length} weeks scheduled`);
}

// Main function
const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith('--input='))?.split('=')[1] || 
                 (args.includes('--input') ? args[args.indexOf('--input') + 1] : null);
const platformArg = args.find(arg => arg.startsWith('--platform='))?.split('=')[1] || 
                    (args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'all');

const inputDir = inputArg || path.join(process.cwd(), 'marketing-content');
const latestDir = fs.readdirSync(inputDir)
  .filter(f => fs.statSync(path.join(inputDir, f)).isDirectory())
  .sort()
  .reverse()[0];

if (!latestDir) {
  console.error('❌ No content directory found. Run generate-marketing-content.js first.');
  process.exit(1);
}

const contentDir = path.join(inputDir, latestDir);
const outputDir = path.join(inputDir, latestDir, 'schedules');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`📅 Generating schedules from: ${contentDir}\n`);

if (platformArg === 'all' || platformArg === 'buffer') {
  generateBufferCSV(contentDir, path.join(outputDir, 'buffer-import.csv'));
}

if (platformArg === 'all' || platformArg === 'twitter') {
  generateTwitterNativeSchedule(contentDir, outputDir);
}

if (platformArg === 'all' || platformArg === 'newsletter') {
  generateNewsletterSchedule(contentDir, path.join(outputDir, 'newsletter-schedule.json'));
}

console.log(`\n✅ All schedules generated in: ${outputDir}`);

