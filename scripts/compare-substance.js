const fs = require('fs');
const path = require('path');

/**
 * Compare OLD content (from MENTAL_MODELS_COMPLETE.md) vs NEW content (from Description files)
 * to see if they describe the same substance/concept even if names differ
 */

console.log('🔍 Comparing OLD vs NEW content for all mismatches...\n');

// Load MENTAL_MODELS_COMPLETE.md (OLD content)
const completePath = path.join(__dirname, '..', 'MENTAL_MODELS_COMPLETE.md');
const completeContent = fs.readFileSync(completePath, 'utf8');

// Load readwise-data.ts to get model codes
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const dataContent = fs.readFileSync(dataPath, 'utf8');
const modelsMatch = dataContent.match(/export const READWISE_MODELS: MentalModel\[\] = \[([\s\S]*?)\n\];/);
const allModels = JSON.parse('[' + modelsMatch[1] + '\n]');

// Load description files (NEW content)
const descFiles = [
  'mental_models_rewrite_1-7.txt',
  'mental_models_8_24.md',
  'mental_models_25_38.md',
  'mental_models_39_40.md'
];

const newContentByCode = {};

for (const file of descFiles) {
  const filePath = path.join(__dirname, '..', 'Mental Models Description', file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const sections = content.split(/\n### /);
  
  for (const section of sections) {
    const match = section.match(/^(\d+[a-z]):\s*([^\n]+)/i);
    if (!match) continue;
    
    const code = match[1].toUpperCase();
    const name = match[2].trim();
    
    const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
    const prinMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
    
    newContentByCode[code] = {
      code,
      name,
      description: descMatch ? descMatch[1].trim().replace(/\n/g, ' ') : '',
      principles: prinMatch ? prinMatch[1].trim().substring(0, 500) : '' // First 500 chars
    };
  }
}

// List of mismatches to check
const mismatches = [
  { code: '6C', oldName: "Kahneman's 8 Decision-Making Questions", newName: "Mental Accounting & Reference Point Dependence" },
  { code: '6D', oldName: "Mental Accounting & Reference Point Dependence", newName: "Social Psychology & Environmental Influence" },
  { code: '6E', oldName: "Social Psychology & Environmental Influence", newName: "Kahneman's 8 Decision-Making Questions" },
  { code: '13B', oldName: "Social Reality Construction & Collective Belief", newName: "Social Identity & Group Belonging" },
  { code: '14B', oldName: "Semantics vs. Meaning & Deep Understanding", newName: "Communication Bandwidth & Medium Constraints" },
  { code: '15C', oldName: "Predictive Processing & Constructed Experience", newName: "Media as Reality Constructor" },
  { code: '18A', oldName: "Love as Nuclear Fuel & Life Foundation", newName: "Quality vs. Quantity in Relationships" },
  { code: '18D', oldName: "Compounding Human Connections", newName: "Attachment & Interdependence" },
  { code: '19C', oldName: "Physiological States & Decision Quality", newName: "Sleep, Nutrition, & Movement as Foundation" },
  { code: '20B', oldName: "Mind-Body Integration & Embodied Presence", newName: "Acceptance vs. Resistance" },
  { code: '20C', oldName: "Deconstructing Mental Patterns & Pain Body", newName: "Meditation & Contemplative Practice" },
  { code: '20D', oldName: "Transcending Ego & Two-Selves Integration", newName: "Non-Attachment & Letting Go" }
];

// Extract OLD content from MENTAL_MODELS_COMPLETE.md
function extractOldContent(code, oldName) {
  // Find section with this name
  const regex = new RegExp(`### ${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=###|##|---|$)`, 'i');
  const match = completeContent.match(regex);
  
  if (!match) return null;
  
  const section = match[0];
  const descMatch = section.match(/#### Description\\s*\\n\\n([\\s\\S]*?)\\n\\n#### Core Principles/);
  const prinMatch = section.match(/#### Core Principles\\s*\\n\\n([\\s\\S]*?)(\\n\\n#### Applications|\\n\\n---|$)/);
  
  return {
    description: descMatch ? descMatch[1].trim() : '',
    principles: prinMatch ? prinMatch[1].trim().substring(0, 500) : ''
  };
}

// Compare descriptions for semantic similarity
function compareDescriptions(oldDesc, newDesc) {
  if (!oldDesc || !newDesc || oldDesc.length < 20 || newDesc.length < 20) return 0;
  
  // Extract key concepts (words > 4 chars)
  const oldWords = new Set(oldDesc.toLowerCase().split(/\\s+/).filter(w => w.length > 4));
  const newWords = new Set(newDesc.toLowerCase().split(/\\s+/).filter(w => w.length > 4));
  
  const intersection = [...oldWords].filter(w => newWords.has(w)).length;
  const union = new Set([...oldWords, ...newWords]).size;
  
  return union > 0 ? intersection / union : 0;
}

console.log('📊 SUBSTANCE COMPARISON:\n');
console.log('=' .repeat(80));

for (const mismatch of mismatches) {
  const code = mismatch.code;
  const oldContent = extractOldContent(code, mismatch.oldName);
  const newContent = newContentByCode[code];
  
  if (!oldContent || !newContent) {
    console.log(`\n⚠️  CODE ${code}: Could not extract content`);
    continue;
  }
  
  const descSimilarity = compareDescriptions(oldContent.description, newContent.description);
  const prinSimilarity = compareDescriptions(oldContent.principles, newContent.principles);
  const avgSimilarity = (descSimilarity + prinSimilarity) / 2;
  
  const matchStatus = avgSimilarity > 0.3 ? '✅ SAME SUBSTANCE' : '❌ DIFFERENT MODEL';
  
  console.log(`\n${matchStatus} - CODE ${code}`);
  console.log(`   Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
  console.log(`   OLD: "${mismatch.oldName}"`);
  console.log(`   NEW: "${mismatch.newName}"`);
  console.log(`\n   OLD Description: ${oldContent.description.substring(0, 150)}...`);
  console.log(`   NEW Description: ${newContent.description.substring(0, 150)}...`);
  
  if (avgSimilarity > 0.3) {
    console.log(`   ✓ Same concept, different name/expansion`);
  } else {
    console.log(`   ✗ Different concepts - need to investigate`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Analysis complete!\n');


