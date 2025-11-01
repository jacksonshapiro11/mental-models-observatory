const fs = require('fs');
const path = require('path');

console.log('📖 Loading new content from Mental Models Description/ by CODE...\n');

// Step 1: Load all models from readwise-data.ts and index by code
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const dataContent = fs.readFileSync(dataPath, 'utf8');

// Extract models array
const modelsMatch = dataContent.match(/export const READWISE_MODELS: MentalModel\[\] = \[([\s\S]*?)\n\];/);
if (!modelsMatch) {
  console.error('❌ Could not find READWISE_MODELS');
  process.exit(1);
}

const modelsArrayContent = '[' + modelsMatch[1] + '\n]';
const allModels = JSON.parse(modelsArrayContent);

// Create index by code (normalized to uppercase)
const modelsByCode = {};
allModels.forEach(model => {
  const code = model.code.toUpperCase();
  modelsByCode[code] = model;
});

console.log(`✅ Indexed ${allModels.length} models by code\n`);

// Step 2: Load new content from description files, indexed by code
const newContentByCode = {};

const files = [
  'mental_models_rewrite_1-7.txt',
  'mental_models_8_24.md',
  'mental_models_25_38.md',
  'mental_models_39_40.md'
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', 'Mental Models Description', file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const sections = content.split(/\n### /);
  
  for (const section of sections) {
    // Extract code and name (e.g., "14b: Communication Bandwidth & Medium Constraints")
    const match = section.match(/^(\d+[a-z]):\s*([^\n]+)/i);
    if (!match) continue;
    
    const code = match[1].toUpperCase(); // Normalize to uppercase
    const name = match[2].trim();
    
    const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
    const prinMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
    const appMatch = section.match(/\*\*Key Applications:\*\*\s*([\s\S]*?)(\n\*\*Related Models:\*\*|---|\n### |$)/);
    
    newContentByCode[code] = {
      code,
      name,
      description: descMatch ? descMatch[1].trim().replace(/\n/g, ' ') : '',
      principles: prinMatch ? prinMatch[1].trim().split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p) : [],
      applications: appMatch ? appMatch[1].trim().split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p) : []
    };
  }
}

console.log(`✅ Loaded ${Object.keys(newContentByCode).length} models from description files\n`);

// Step 3: Compare and report name mismatches (ignore ones we already know about)
console.log('🔍 Comparing names by code...\n');
const nameMismatches = [];
const alreadyKnownMismatches = new Set([
  '5B',  // Cross-Disciplinary Synthesis - just case difference
  '13A', // Cultural Evolution → Cultural Transmission (already mapped)
  '14A', // Language as Thought → Language as Mental Model (already mapped)
  '15A', // Signal vs. Noise - just subtitle difference (already mapped)
  '19A', // Mind-Body Integration - already mapped
  '32A', // Neuroplasticity → Neural Networks (already mapped)
  '32B', // Consciousness & the Hard Problem → The Hard Problem (already mapped)
  '35B', // Behavioral Economics - already mapped
  '36A', // Metis → Resourcefulness (already mapped)
  '36B', // Bricolage → Execution (already mapped)
  '38D'  // Affirmations → Identity Affirmation (already mapped)
]);

for (const code in newContentByCode) {
  if (modelsByCode[code]) {
    const descName = newContentByCode[code].name;
    const dataName = modelsByCode[code].name;
    
    if (descName !== dataName && !alreadyKnownMismatches.has(code)) {
      nameMismatches.push({
        code,
        descriptionFile: descName,
        readwiseData: dataName
      });
      console.log(`⚠️  CODE ${code}: NEW NAME MISMATCH`);
      console.log(`   Description file: "${descName}"`);
      console.log(`   readwise-data.ts: "${dataName}"`);
      console.log('');
    }
  } else {
    console.log(`❌ CODE ${code}: Not found in readwise-data.ts (${newContentByCode[code].name})`);
  }
}

console.log(`\n📊 Found ${nameMismatches.length} NEW name mismatches to investigate\n`);

// Step 3.5: Compare substance (first 200 chars of description) to see if content matches despite name mismatch
console.log('🔬 Checking if NEW mismatches have matching SUBSTANCE...\n');
const substanceMatches = [];

for (const mismatch of nameMismatches) {
  const code = mismatch.code;
  const descContent = newContentByCode[code];
  const dataModel = modelsByCode[code];
  
  if (descContent && dataModel) {
    // Compare first 200 characters of description
    const descSample = descContent.description.substring(0, 200).toLowerCase().replace(/\s+/g, ' ');
    const dataSample = dataModel.description.substring(0, 200).toLowerCase().replace(/\s+/g, ' ');
    
    // Simple similarity check - if >70% of words match, consider it the same substance
    const descWords = new Set(descSample.split(' ').filter(w => w.length > 4));
    const dataWords = new Set(dataSample.split(' ').filter(w => w.length > 4));
    const intersection = [...descWords].filter(w => dataWords.has(w)).length;
    const union = new Set([...descWords, ...dataWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    
    if (similarity > 0.5) {
      substanceMatches.push({
        code,
        similarity: (similarity * 100).toFixed(1),
        descriptionFile: mismatch.descriptionFile,
        readwiseData: mismatch.readwiseData
      });
      console.log(`✅ CODE ${code}: SUBSTANCE MATCHES (${(similarity * 100).toFixed(1)}% similarity)`);
      console.log(`   Description file: "${mismatch.descriptionFile}"`);
      console.log(`   readwise-data.ts: "${mismatch.readwiseData}"`);
      console.log(`   → Names differ but content is the SAME. Will update content by code.\n`);
    } else {
      console.log(`❌ CODE ${code}: SUBSTANCE DIFFERS (${(similarity * 100).toFixed(1)}% similarity)`);
      console.log(`   Description file: "${mismatch.descriptionFile}"`);
      console.log(`   readwise-data.ts: "${mismatch.readwiseData}"`);
      console.log(`   → DIFFERENT MODELS! Need manual investigation.\n`);
    }
  }
}

console.log(`\n📊 ${substanceMatches.length} mismatches have matching substance (names wrong in readwise-data.ts)\n`);

// Step 4: Update readwise-data.ts by code matching
console.log('🔄 Updating lib/readwise-data.ts by CODE...\n');

const lines = fs.readFileSync(dataPath, 'utf8').split('\n');
const output = [];
let currentModelCode = null;
let updateCount = 0;
let inArray = false;
let arrayType = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect model code
  const codeMatch = line.match(/"code":\s*"([^"]+)"/);
  if (codeMatch) {
    currentModelCode = codeMatch[1].toUpperCase();
  }
  
  // If we have a model with new content by code
  if (currentModelCode && newContentByCode[currentModelCode]) {
    const updated = newContentByCode[currentModelCode];
    
    // Update description line
    if (line.includes('"description":')) {
      const indent = line.match(/^(\s*)/)[1];
      const escaped = updated.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      output.push(`${indent}"description": "${escaped}",`);
      continue;
    }
    
    // Start of principles array
    if (line.includes('"principles":')) {
      inArray = true;
      arrayType = 'principles';
      const indent = line.match(/^(\s*)/)[1];
      output.push(`${indent}"principles": [`);
      updated.principles.forEach((p, idx) => {
        const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const comma = idx < updated.principles.length - 1 ? ',' : '';
        output.push(`${indent}  "${escaped}"${comma}`);
      });
      continue;
    }
    
    // Start of applications array
    if (line.includes('"applications":')) {
      inArray = true;
      arrayType = 'applications';
      const indent = line.match(/^(\s*)/)[1];
      output.push(`${indent}"applications": [`);
      updated.applications.forEach((p, idx) => {
        const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const comma = idx < updated.applications.length - 1 ? ',' : '';
        output.push(`${indent}  "${escaped}"${comma}`);
      });
      continue;
    }
    
    // Skip old array content
    if (inArray) {
      if (line.trim() === '],') {
        output.push(line);
        inArray = false;
        if (arrayType === 'applications') {
          updateCount++;
          console.log(`✏️  CODE ${currentModelCode}: ${modelsByCode[currentModelCode]?.name || 'Unknown'}`);
          currentModelCode = null; // Done with this model
        }
        arrayType = null;
      }
      continue;
    }
  }
  
  output.push(line);
}

fs.writeFileSync(dataPath, output.join('\n'), 'utf8');

console.log(`\n✅ Updated ${updateCount} models in lib/readwise-data.ts`);
console.log('\n📋 Summary:');
console.log(`   - Models in description files: ${Object.keys(newContentByCode).length}`);
console.log(`   - Models updated: ${updateCount}`);
console.log(`   - Name mismatches found: ${nameMismatches.length}`);
if (nameMismatches.length > 0) {
  console.log('\n⚠️  Name mismatches (substance may still match):');
  nameMismatches.forEach(m => {
    console.log(`   ${m.code}: "${m.descriptionFile}" vs "${m.readwiseData}"`);
  });
}
console.log('\n📋 Next: Test with npm run dev');

