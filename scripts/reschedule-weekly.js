#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function rescheduleWeekly() {
  const schedulePath = path.join(process.cwd(), 'marketing-content', 'scheduled-tweets', 'posting-schedule.json');
  const outputDir = path.join(process.cwd(), 'marketing-content', 'scheduled-tweets');
  
  if (!fs.existsSync(schedulePath)) {
    console.error('❌ No posting schedule found');
    process.exit(1);
  }
  
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  
  // Calculate start date (next Monday)
  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  
  // EST times: 9am, 12pm, 5pm (convert to UTC for GitHub Actions)
  // EST is UTC-5, so: 9am EST = 14:00 UTC, 12pm EST = 17:00 UTC, 5pm EST = 22:00 UTC
  const times = ['14:00', '17:00', '22:00']; // UTC times
  const estTimes = ['09:00', '12:00', '17:00']; // Display times
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const newSchedule = [];
  let tweetIndex = 0;
  
  // Schedule 3 tweets per day for 7 days
  for (let day = 0; day < 7; day++) {
    const postDate = new Date(nextMonday);
    postDate.setDate(nextMonday.getDate() + day);
    const dateStr = postDate.toISOString().split('T')[0];
    const dayName = dayNames[postDate.getDay()];
    
    // 3 tweets per day
    for (let timeSlot = 0; timeSlot < 3; timeSlot++) {
      if (tweetIndex >= schedule.length) break;
      
      const originalItem = schedule[tweetIndex];
      const utcTime = times[timeSlot];
      const estTime = estTimes[timeSlot];
      
      // Find the thread file
      const threadPath = path.join(outputDir, originalItem.date, `${originalItem.slug}-thread-${originalItem.thread}.json`);
      
      if (!fs.existsSync(threadPath)) {
        console.error(`⚠️  Thread file not found: ${threadPath}`);
        tweetIndex++;
        continue;
      }
      
      const threadData = JSON.parse(fs.readFileSync(threadPath, 'utf8'));
      
      // Create new date directory
      const newDayDir = path.join(outputDir, dateStr);
      if (!fs.existsSync(newDayDir)) {
        fs.mkdirSync(newDayDir, { recursive: true });
      }
      
      // Update thread data with new schedule
      threadData.scheduledDate = dateStr;
      threadData.scheduledTime = estTime;
      threadData.scheduledDateTime = `${dateStr}T${utcTime}:00`;
      
      // Save to new location
      const newThreadPath = path.join(newDayDir, `${originalItem.slug}-thread-${originalItem.thread}.json`);
      fs.writeFileSync(newThreadPath, JSON.stringify(threadData, null, 2));
      
      // Add to new schedule
      newSchedule.push({
        date: dateStr,
        time: estTime,
        datetime: `${dateStr}T${utcTime}:00`,
        day: dayName,
        model: originalItem.model,
        slug: originalItem.slug,
        thread: originalItem.thread,
        totalThreads: originalItem.totalThreads,
        tweets: originalItem.tweets
      });
      
      console.log(`✅ Scheduled ${originalItem.model} for ${dayName} ${dateStr} at ${estTime} EST (${utcTime} UTC)`);
      
      tweetIndex++;
    }
  }
  
  // Save new schedule
  const newSchedulePath = path.join(outputDir, 'posting-schedule.json');
  fs.writeFileSync(newSchedulePath, JSON.stringify(newSchedule, null, 2));
  
  console.log(`\n📅 Rescheduled ${newSchedule.length} tweets`);
  console.log(`   Start date: ${nextMonday.toISOString().split('T')[0]}`);
  console.log(`   Schedule: 3 tweets per day at 9am, 12pm, 5pm EST`);
  console.log(`   Saved to: ${newSchedulePath}\n`);
}

rescheduleWeekly();
