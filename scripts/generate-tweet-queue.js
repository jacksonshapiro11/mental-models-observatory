#!/usr/bin/env node

/**
 * Generate a queue of tweets from mental models
 * Creates simple JSON files with ready-to-post tweets
 */

const fs = require('fs');
const path = require('path');

// Simple mental models data - we'll expand this
const mentalModels = [
  {
    id: 'competitive-advantage-sustainable-moats',
    name: 'Competitive Advantage & Sustainable Moats',
    scenario: `Quarter tank of gas, middle of nowhere. Every station charges the same. You pick one.

Next town over, only one station for 50 miles. Different game entirely.`,
    bookQuote: {
      text: 'Proprietary tech, network effects, strong brand. Tech advantage must provide 10x improvement. Network effects make things more useful as more people use them.',
      book: 'Zero to One',
      author: 'Peter Thiel'
    },
    summary: 'This is why some businesses build lasting moats.'
  },
  // Add more models here
];

function generateTweetQueue() {
  const queueDir = path.join(process.cwd(), 'tweet-queue');
  
  // Create queue directory
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }

  // Clear old queue
  const existingFiles = fs.readdirSync(queueDir).filter(f => f.endsWith('.json'));
  existingFiles.forEach(f => fs.unlinkSync(path.join(queueDir, f)));

  console.log('📝 Generating tweet queue...\n');

  mentalModels.forEach((model, index) => {
    const thread = [
      // Tweet 1: Scenario + Model name
      {
        text: `${model.scenario}

${model.name}

https://cosmictrex.xyz/models/${model.id}`,
        type: 'scenario'
      },
      // Tweet 2: Book quote
      {
        text: `From ${model.bookQuote.book} by ${model.bookQuote.author}:

"${model.bookQuote.text}"

${model.summary}`,
        type: 'quote'
      },
      // Tweet 3: Mission
      {
        text: `I read a lot. Wanted to remember what mattered. Built this to help me think clearer. Maybe it helps you.

https://cosmictrex.xyz/models/${model.id}`,
        type: 'mission'
      }
    ];

    // Validate character counts
    const valid = thread.every(t => {
      const isValid = t.text.length <= 280;
      if (!isValid) {
        console.error(`❌ Tweet too long for ${model.name}: ${t.text.length} chars`);
      }
      return isValid;
    });

    if (!valid) {
      console.error(`⚠️  Skipping ${model.name} - tweets too long\n`);
      return;
    }

    const queueItem = {
      id: model.id,
      model: model.name,
      thread,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const filename = `${String(index + 1).padStart(3, '0')}-${model.id}.json`;
    fs.writeFileSync(
      path.join(queueDir, filename),
      JSON.stringify(queueItem, null, 2)
    );

    console.log(`✅ ${filename} - ${model.name}`);
  });

  console.log(`\n✅ Generated ${mentalModels.length} tweets in queue`);
  console.log(`📁 Location: ${queueDir}\n`);
}

generateTweetQueue();

