#!/usr/bin/env node

/**
 * Process AI Responses into Scenarios
 * 
 * Takes AI-generated scenarios and formats them into scenarios.json
 * 
 * Usage:
 *   node scripts/process-ai-responses.js [options]
 * 
 * Options:
 *   --input FILE      Input file with AI responses
 *   --output FILE     Output file (default: scenarios.json)
 */

const fs = require('fs');
const path = require('path');

// Import models to validate
let READWISE_MODELS;
try {
  const readwiseData = require('../lib/readwise-data');
  READWISE_MODELS = readwiseData.READWISE_MODELS;
} catch (error) {
  console.error('❌ Could not load models');
  process.exit(1);
}

function parseAIResponse(responseText) {
  // Extract scenarios from AI response
  // Format: ```scenario text``` or just scenario text
  const scenarios = [];
  
  // Try to find code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = responseText.match(codeBlockRegex);
  
  if (matches) {
    matches.forEach(block => {
      const content = block.replace(/```/g, '').trim();
      if (content.length > 20 && content.length < 500) {
        scenarios.push(content);
      }
    });
  }
  
  // If no code blocks, try to find numbered scenarios
  if (scenarios.length === 0) {
    const numberedRegex = /(?:^|\n)\d+\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
    let match;
    while ((match = numberedRegex.exec(responseText)) !== null) {
      const scenario = match[1].trim();
      if (scenario.length > 20 && scenario.length < 500) {
        scenarios.push(scenario);
      }
    }
  }
  
  // If still nothing, try to split by double newlines
  if (scenarios.length === 0) {
    const parts = responseText.split(/\n\n+/);
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.length > 20 && trimmed.length < 500 && !trimmed.startsWith('#')) {
        scenarios.push(trimmed);
      }
    });
  }
  
  return scenarios;
}

function processResponses(inputFile, outputFile) {
  const inputPath = path.join(process.cwd(), inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }
  
  const responseText = fs.readFileSync(inputPath, 'utf8');
  const scenarios = parseAIResponse(responseText);
  
  if (scenarios.length === 0) {
    console.error('❌ No scenarios found in response');
    process.exit(1);
  }
  
  console.log(`✅ Found ${scenarios.length} scenarios`);
  
  // For now, create a simple structure
  // You'll need to map scenarios to models manually or improve parsing
  const output = {
    generated: new Date().toISOString(),
    scenarios: scenarios.map((s, i) => ({
      id: i + 1,
      text: s,
      modelSlug: null, // Will need to map manually
      category: null
    }))
  };
  
  const outputPath = path.join(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Saved to: ${outputPath}`);
  console.log(`\n📋 Next: Map scenarios to models in scenarios.json`);
}

// Main execution
const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith('--input='))?.split('=')[1] || 
                 (args.includes('--input') ? args[args.indexOf('--input') + 1] : null);
const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 
                  (args.includes('--output') ? args[args.indexOf('--output') + 1] : 'scenarios.json');

if (!inputArg) {
  console.log('Usage:');
  console.log('  node scripts/process-ai-responses.js --input=ai-response.txt');
  console.log('\nOptions:');
  console.log('  --input FILE      Input file with AI responses');
  console.log('  --output FILE     Output file (default: scenarios.json)');
  process.exit(1);
}

processResponses(inputArg, outputArg);

