const fs = require('fs');
const path = require('path');

// The 21 models the user listed (from static framework)
const userListedModels = [
  'energy-resource-flows-3a',
  'mental-models-cross-disciplinary-thinking-5a',
  'psychology-human-behavior-6a',
  'philosophy-truth-seeking-8a',
  'exponential-thinking-compounding-9a',
  'spatial-geometric-thinking-constraints-10a',
  'temporal-dynamics-flow-states-11a',
  'power-dynamics-political-systems-12a',
  'cultural-anthropology-social-identity-13a',
  'language-communication-systems-14a',
  'information-theory-media-ecology-15a',
  'technology-human-computer-interaction-16a',
  'organizational-design-institutions-17a',
  'relationships-human-connection-18a',
  'health-human-optimization-19a',
  'mindfulness-inner-work-20a',
  'evolution-biology-21a',
  'mathematics-logic-22a',
  'history-institutional-evolution-23a',
  'neuroscience-consciousness-24a',
  'narrative-identity-25a'
];

async function analyzeWhy21NotWorking() {
  console.log('=== ANALYZING WHY 21 MODELS HAVE NO READWISE HIGHLIGHTS ===\n');

  // Check current parsed models
  let currentParsedModels = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    currentParsedModels = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch current parsed models');
  }

  // Check if these models are in our parsed list
  console.log('📊 CHECKING IF MODELS ARE PARSED:');
  for (const modelSlug of userListedModels) {
    const isParsed = currentParsedModels.includes(modelSlug);
    console.log(`${isParsed ? '✅' : '❌'} ${modelSlug}: ${isParsed ? 'Parsed' : 'Not parsed'}`);
  }

  // Get actual model IDs from Readwise files
  console.log('\n📊 READWISE FILE CONTENTS:');
  const readwiseDir = path.join(process.cwd(), 'Readwise website notes');
  const files = fs.readdirSync(readwiseDir);
  
  const allReadwiseModels = [];
  for (const file of files) {
    if (file.startsWith('.')) continue;
    
    const filePath = path.join(readwiseDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const modelIdMatches = content.match(/"modelId"\s*:\s*"([^"]+)"/g);
    
    if (modelIdMatches) {
      const modelIds = modelIdMatches.map(match => {
        const idMatch = match.match(/"([^"]+)"$/);
        return idMatch ? idMatch[1] : null;
      }).filter(Boolean);
      
      console.log(`${file}: ${modelIds.length} models`);
      console.log(`  → ${modelIds.join(', ')}`);
      allReadwiseModels.push(...modelIds);
    }
  }

  console.log('\n🔍 ANALYSIS:');
  console.log(`Static framework models (user listed): ${userListedModels.length}`);
  console.log(`Readwise curated models: ${allReadwiseModels.length}`);
  
  // Check overlap
  const overlap = userListedModels.filter(model => allReadwiseModels.includes(model));
  console.log(`Overlap between static and Readwise: ${overlap.length}`);
  
  if (overlap.length === 0) {
    console.log('\n❌ PROBLEM IDENTIFIED:');
    console.log('The 21 models from the static framework have NO Readwise highlights');
    console.log('because the Readwise files contain completely different model IDs.');
    console.log('\nThe static framework uses IDs like:');
    console.log('  → energy-resource-flows-3a');
    console.log('  → psychology-human-behavior-6a');
    console.log('\nBut Readwise files contain IDs like:');
    console.log('  → probabilistic-thinking-base-rate-neglect');
    console.log('  → 8a-critical-approach-fallibilism');
    console.log('\n💡 SOLUTION:');
    console.log('Either:');
    console.log('1. Create Readwise highlights for the static framework model IDs');
    console.log('2. Map the static framework IDs to existing Readwise model IDs');
    console.log('3. Update the static framework to use the Readwise model IDs');
  }
}

analyzeWhy21NotWorking();
