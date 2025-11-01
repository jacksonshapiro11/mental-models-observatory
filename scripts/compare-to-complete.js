const fs = require('fs');
const path = require('path');

/**
 * Compare lib/readwise-data.ts (current) vs MENTAL_MODELS_COMPLETE.md (old generated doc)
 * to identify which models don't match up
 */

console.log('🔍 Comparing lib/readwise-data.ts vs MENTAL_MODELS_COMPLETE.md...\n');

// Load current state from lib/readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const dataContent = fs.readFileSync(dataPath, 'utf8');

// Load OLD state from MENTAL_MODELS_COMPLETE.md
const completePath = path.join(__dirname, '..', 'MENTAL_MODELS_COMPLETE.md');
const completeContent = fs.readFileSync(completePath, 'utf8');

// Extract models from readwise-data.ts by code
const modelsByCode = {};
const modelMatches = dataContent.matchAll(/"code":\s*"([^"]+)",[\s\S]*?"name":\s*"([^"]+)",[\s\S]*?"description":\s*"([^"]+)"/g);
for (const match of modelMatches) {
  const code = match[1];
  const name = match[2];
  const description = match[3].substring(0, 200);
  modelsByCode[code] = { code, name, description };
}

// Extract models from MENTAL_MODELS_COMPLETE.md
const oldModelsByCode = {};
const sectionMatches = completeContent.matchAll(/### ([^\n]+)\n\n\*\*Model ID:\*\*[^\n]+\n\*\*Slug:\*\*[^\n]+\n\*\*Difficulty:\*\*[^\n]+\n\n#### Description\n\n([^\n]+)/g);
for (const match of sectionMatches) {
  const name = match[1].trim();
  const description = match[2].trim();
  
  // Try to find code by searching for it in the section
  const sectionStart = match.index;
  const section = completeContent.substring(sectionStart, sectionStart + 500);
  const codeMatch = section.match(/\*\*Model ID:\*\*[^\n]+-(\d+[a-z])/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    oldModelsByCode[code] = { code, name, description: description.substring(0, 200) };
  }
}

console.log('📊 COMPARISON RESULTS:\n');
console.log('='.repeat(80));

const mismatches = [];
const matches = [];

for (const code in modelsByCode) {
  const current = modelsByCode[code];
  const old = oldModelsByCode[code];
  
  if (!old) {
    mismatches.push({
      code,
      reason: 'Not found in MENTAL_MODELS_COMPLETE.md',
      current: current.name,
      old: 'N/A'
    });
    continue;
  }
  
  // Compare names
  if (current.name !== old.name) {
    // Compare descriptions to see if substance matches
    const descSimilarity = compareDescriptions(current.description, old.description);
    
    if (descSimilarity < 0.3) {
      mismatches.push({
        code,
        reason: 'DIFFERENT MODEL (name and description both changed)',
        current: current.name,
        old: old.name,
        descSimilarity: (descSimilarity * 100).toFixed(1)
      });
    } else {
      matches.push({
        code,
        reason: 'Name updated (same substance)',
        current: current.name,
        old: old.name,
        descSimilarity: (descSimilarity * 100).toFixed(1)
      });
    }
  } else {
    matches.push({
      code,
      reason: 'Matches',
      current: current.name,
      old: old.name
    });
  }
}

function compareDescriptions(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length < 20 || desc2.length < 20) return 0;
  
  const words1 = new Set(desc1.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const words2 = new Set(desc2.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return union > 0 ? intersection / union : 0;
}

console.log(`\n❌ MISMATCHES (${mismatches.length} models):\n`);
for (const mismatch of mismatches) {
  console.log(`CODE ${mismatch.code}:`);
  console.log(`   OLD: "${mismatch.old}"`);
  console.log(`   NEW: "${mismatch.current}"`);
  console.log(`   Reason: ${mismatch.reason}`);
  if (mismatch.descSimilarity) {
    console.log(`   Description Similarity: ${mismatch.descSimilarity}%`);
  }
  console.log();
}

console.log(`\n✅ MATCHES (${matches.length} models with same substance):\n`);
for (const match of matches.slice(0, 10)) { // Show first 10
  if (match.reason === 'Name updated (same substance)') {
    console.log(`CODE ${match.code}: "${match.old}" → "${match.current}" (${match.descSimilarity}% similarity)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Summary: ${mismatches.length} different models, ${matches.length} matches\n`);


