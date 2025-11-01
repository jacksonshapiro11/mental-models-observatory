const fs = require('fs');
const path = require('path');

console.log('📝 Removing duplicate models (13C, 14C, 15D, 18E, 18F, 19D, 20E, 20F, 20G)...\n');

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
let dataContent = fs.readFileSync(dataPath, 'utf8');

const duplicateCodes = ['13C', '14C', '15D', '18E', '18F', '19D', '20E', '20F', '20G'];
let removedCount = 0;

for (const code of duplicateCodes) {
  console.log(`📌 Removing duplicate model ${code}...`);
  
  // Find the model by code
  const codePattern = new RegExp(`"code": "${code}"`, 'g');
  const matches = [...dataContent.matchAll(codePattern)];
  
  if (matches.length === 0) {
    console.log(`   ⚠️  Model ${code} not found (might have been removed already)`);
    continue;
  }
  
  // Find the model object
  const match = matches[0];
  const modelStart = dataContent.lastIndexOf('{', match.index);
  
  // We need to find the comma before this model and the closing brace
  let commaBeforeModel = dataContent.lastIndexOf(',', modelStart);
  
  // Find the end of this model
  let braceCount = 0;
  let i = modelStart;
  let inString = false;
  let escapeNext = false;
  
  while (i < dataContent.length) {
    const char = dataContent[i];
    
    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      i++;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      if (braceCount === 0) {
        // Found the end of the model
        const modelEnd = i + 1;
        
        // Remove from the comma before to the end of the model (including the model itself)
        dataContent = dataContent.substring(0, commaBeforeModel) + dataContent.substring(modelEnd);
        removedCount++;
        console.log(`   ✅ Removed`);
        break;
      }
    }
    
    i++;
  }
}

// Write back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully removed ${removedCount} duplicate models!\n`);

