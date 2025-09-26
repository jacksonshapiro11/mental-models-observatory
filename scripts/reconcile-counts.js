const fs = require('fs');
const path = require('path');

async function getCurrentParsedModels() {
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    return data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch current parsed models');
    return [];
  }
}

function countStaticModels() {
  try {
    const content = fs.readFileSync('/Users/jackson/Desktop/mental-models-observatory/lib/readwise-data.ts', 'utf8');
    const modelMatches = content.match(/"id":\s*"[^"]+"/g);
    return modelMatches ? modelMatches.length : 0;
  } catch (error) {
    console.error('Error reading static models:', error.message);
    return 0;
  }
}

function countExpectedFromFiles() {
  const readwiseDir = path.join(process.cwd(), 'Readwise website notes');
  let totalExpected = 0;
  
  try {
    const files = fs.readdirSync(readwiseDir);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      const filePath = path.join(readwiseDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const modelIdMatches = content.match(/"modelId"\s*:/g);
      if (modelIdMatches) {
        totalExpected += modelIdMatches.length;
      }
    }
  } catch (error) {
    console.error('Error counting expected models:', error.message);
  }
  
  return totalExpected;
}

async function reconcileCounts() {
  console.log('=== RECONCILING MODEL COUNTS ===\n');
  
  // 1. Static models in readwise-data.ts (what website shows)
  const staticCount = countStaticModels();
  console.log(`📊 Static models in readwise-data.ts: ${staticCount}`);
  
  // 2. Expected models from Readwise files
  const expectedCount = countExpectedFromFiles();
  console.log(`📊 Expected models from Readwise files: ${expectedCount}`);
  
  // 3. Currently parsed models from API
  const parsedModels = await getCurrentParsedModels();
  console.log(`📊 Currently parsed models: ${parsedModels.length}`);
  
  console.log('\n=== ANALYSIS ===');
  console.log(`Static data (website shows): ${staticCount} models`);
  console.log(`Readwise files expected: ${expectedCount} models`);
  console.log(`Actually parsed: ${parsedModels.length} models`);
  
  console.log('\n=== DISCREPANCY EXPLANATION ===');
  if (staticCount > expectedCount) {
    console.log(`❌ Static data has ${staticCount - expectedCount} MORE models than Readwise files`);
    console.log('   → The static data includes models not in the Readwise curation files');
  } else if (expectedCount > staticCount) {
    console.log(`❌ Readwise files have ${expectedCount - staticCount} MORE models than static data`);
    console.log('   → The Readwise files include models not in the static data');
  } else {
    console.log('✅ Static data and Readwise files have the same count');
  }
  
  if (parsedModels.length < expectedCount) {
    console.log(`❌ Parser is missing ${expectedCount - parsedModels.length} models from Readwise files`);
  } else {
    console.log('✅ Parser is working correctly');
  }
  
  console.log('\n=== RECOMMENDATION ===');
  if (staticCount !== expectedCount) {
    console.log('🔧 The static data and Readwise files are out of sync!');
    console.log('   → Either update static data to match Readwise files');
    console.log('   → Or update Readwise files to match static data');
  } else {
    console.log('✅ Counts are consistent - focus on fixing the parser');
  }
}

reconcileCounts();
