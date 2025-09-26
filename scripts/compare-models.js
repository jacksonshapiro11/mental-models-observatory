const fs = require('fs');
const path = require('path');

const readwiseDir = path.join(process.cwd(), 'Readwise website notes');

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

function extractModelIdsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/"modelId"\s*:\s*"([^"]+)"/g);
    
    if (matches) {
      return matches.map(match => {
        const idMatch = match.match(/"([^"]+)"$/);
        return idMatch ? idMatch[1] : null;
      }).filter(Boolean);
    }
    
    return [];
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

async function compareModels() {
  console.log('=== COMPARING EXPECTED VS PARSED MODELS ===\n');
  
  const currentParsed = await getCurrentParsedModels();
  console.log(`Currently parsed: ${currentParsed.length} models`);
  
  const allExpectedIds = [];
  const fileBreakdown = {};
  
  const files = fs.readdirSync(readwiseDir);
  for (const file of files) {
    if (file.startsWith('.')) continue;
    
    const filePath = path.join(readwiseDir, file);
    const modelIds = extractModelIdsFromFile(filePath);
    
    if (modelIds.length > 0) {
      fileBreakdown[file] = modelIds;
      allExpectedIds.push(...modelIds);
      console.log(`${file}: ${modelIds.length} models`);
    }
  }
  
  const uniqueExpected = [...new Set(allExpectedIds)];
  console.log(`\nTotal unique expected: ${uniqueExpected.length}`);
  console.log(`Actually parsed: ${currentParsed.length}`);
  console.log(`Missing: ${uniqueExpected.length - currentParsed.length}`);
  
  // Find which specific models are missing
  const missing = uniqueExpected.filter(id => !currentParsed.includes(id));
  
  console.log('\n=== MISSING MODELS ===');
  missing.slice(0, 10).forEach(id => {
    // Find which file it's from
    for (const [file, ids] of Object.entries(fileBreakdown)) {
      if (ids.includes(id)) {
        console.log(`❌ ${id} (from ${file})`);
        break;
      }
    }
  });
  
  if (missing.length > 10) {
    console.log(`... and ${missing.length - 10} more missing models`);
  }
  
  console.log('\n=== FILES WITH MOST MISSING MODELS ===');
  const fileMissingCounts = {};
  
  for (const [file, expectedIds] of Object.entries(fileBreakdown)) {
    const missingFromFile = expectedIds.filter(id => !currentParsed.includes(id));
    if (missingFromFile.length > 0) {
      fileMissingCounts[file] = missingFromFile.length;
    }
  }
  
  const sortedFiles = Object.entries(fileMissingCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  for (const [file, count] of sortedFiles) {
    console.log(`❌ ${file}: ${count} missing models`);
  }
}

compareModels();
