const fs = require('fs');
const path = require('path');

const readwiseDir = path.join(process.cwd(), 'Readwise website notes');

// Test files that should have the most models
const priorityFiles = [
  'mental_models_domains_1_3B.md', // 17 expected
  'mental-models-16-20.md', // 16 expected
  'mental_models_curation_21-24.md', // 16 expected
  'domains_36_40_curation.md', // 15 expected
  'domains_9_10_11_12 curation.txt', // 13 expected
  'domains_7_8_full.md', // 8 expected
  'domain8-philosophy-highlights.txt', // 7 expected
  'psychology-domain6-highlights.json' // 4 expected
];

function testJsonParsing(content, fileName) {
  try {
    // Try parsing as pure JSON first
    JSON.parse(content);
    console.log(`✅ ${fileName}: Valid JSON`);
    return true;
  } catch (error) {
    console.log(`❌ ${fileName}: JSON Error - ${error.message}`);
    
    // Check if it starts with JSON
    const trimmed = content.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      console.log(`   → Starts with JSON but has syntax errors`);
      
      // Find where it breaks
      const lines = content.split('\n');
      for (let i = 0; i < Math.min(50, lines.length); i++) {
        const line = lines[i];
        if (line.includes('//') || line.includes('...')) {
          console.log(`   → Line ${i + 1}: "${line.trim()}" (contains comments/ellipsis)`);
          break;
        }
      }
    } else {
      console.log(`   → Not pure JSON format`);
    }
    return false;
  }
}

function analyzeFile(fileName) {
  const filePath = path.join(readwiseDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${fileName}: File not found`);
    return;
  }
  
  console.log(`\n🔍 ANALYZING: ${fileName}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const fileSize = Math.round(content.length / 1024);
  console.log(`   File size: ${fileSize}KB`);
  
  // Count expected models
  const modelIdMatches = content.match(/"modelId"\s*:/g);
  const sectionMatches = content.match(/### \d+[A-Z]:/g);
  const expectedModels = (modelIdMatches?.length || 0) + (sectionMatches?.length || 0);
  console.log(`   Expected models: ${expectedModels}`);
  
  // Test if it's JSON-parseable
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    testJsonParsing(content, fileName);
  } else {
    console.log(`   Format: Markdown/Text (not pure JSON)`);
    
    // Check for JSON blocks in markdown
    const jsonBlocks = content.match(/```json\n([\s\S]*?)\n```/g);
    if (jsonBlocks) {
      console.log(`   Found ${jsonBlocks.length} JSON blocks in markdown`);
      
      // Test first JSON block
      if (jsonBlocks[0]) {
        const firstBlock = jsonBlocks[0].replace(/```json\n/, '').replace(/\n```/, '');
        console.log(`   Testing first JSON block...`);
        testJsonParsing(firstBlock, `${fileName} (first block)`);
      }
    }
  }
}

console.log('=== DEBUGGING PRIORITY FILES ===');

for (const fileName of priorityFiles) {
  analyzeFile(fileName);
}

console.log('\n=== SUMMARY ===');
console.log('Files analyzed for specific parsing issues that prevent model extraction.');
