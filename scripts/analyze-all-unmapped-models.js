const fs = require('fs');
const path = require('path');

async function analyzeAllUnmappedModels() {
  console.log('=== ANALYZING ALL UNMAPPED STATIC FRAMEWORK MODELS ===\n');

  // Get all static framework models from domains
  const readwiseDataPath = path.join(process.cwd(), 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Extract all model IDs from the domains' "models" arrays
  const modelMatches = content.match(/"[^"]*-[0-9]+[a-z]"/g);
  const staticFrameworkModels = modelMatches ? modelMatches.map(m => m.replace(/"/g, '')) : [];
  
  console.log(`📊 STATIC FRAMEWORK MODELS: ${staticFrameworkModels.length}`);
  
  // Group by domain number
  const modelsByDomain = {};
  staticFrameworkModels.forEach(model => {
    const domainMatch = model.match(/-([0-9]+)[a-z]$/);
    if (domainMatch) {
      const domainNum = parseInt(domainMatch[1]);
      if (!modelsByDomain[domainNum]) {
        modelsByDomain[domainNum] = [];
      }
      modelsByDomain[domainNum].push(model);
    }
  });

  // Get current parsed models (from Readwise)
  let currentParsedModels = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    currentParsedModels = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch current parsed models');
  }

  console.log(`📊 READWISE PARSED MODELS: ${currentParsedModels.length}`);

  // Check which static framework models have Readwise mappings
  const mappedModels = [];
  const unmappedModels = [];
  
  staticFrameworkModels.forEach(model => {
    if (currentParsedModels.includes(model)) {
      mappedModels.push(model);
    } else {
      unmappedModels.push(model);
    }
  });

  console.log(`✅ MAPPED (have Readwise): ${mappedModels.length}`);
  console.log(`❌ UNMAPPED (no Readwise): ${unmappedModels.length}`);

  // Show breakdown by domain
  console.log('\n🔍 BREAKDOWN BY DOMAIN:');
  for (let domain = 1; domain <= 40; domain++) {
    if (modelsByDomain[domain]) {
      const domainModels = modelsByDomain[domain];
      const mappedCount = domainModels.filter(m => currentParsedModels.includes(m)).length;
      const unmappedCount = domainModels.length - mappedCount;
      
      console.log(`Domain ${domain.toString().padStart(2, '0')}: ${domainModels.length} models | ${mappedCount} mapped ✅ | ${unmappedCount} unmapped ❌`);
      
      if (unmappedCount > 0) {
        const unmappedInDomain = domainModels.filter(m => !currentParsedModels.includes(m));
        console.log(`    Unmapped: ${unmappedInDomain.join(', ')}`);
      }
    } else {
      console.log(`Domain ${domain.toString().padStart(2, '0')}: No models found`);
    }
  }

  // Show all unmapped models
  console.log('\n❌ ALL UNMAPPED MODELS:');
  unmappedModels.forEach(model => {
    console.log(`  ${model}`);
  });

  console.log('\n📈 SUMMARY:');
  console.log(`Total static framework models: ${staticFrameworkModels.length}`);
  console.log(`Mapped to Readwise: ${mappedModels.length} (${Math.round(mappedModels.length/staticFrameworkModels.length*100)}%)`);
  console.log(`Unmapped (no Readwise): ${unmappedModels.length} (${Math.round(unmappedModels.length/staticFrameworkModels.length*100)}%)`);

  // Check if we need to create slug mappings
  console.log('\n💡 NEXT STEPS:');
  if (unmappedModels.length > 0) {
    console.log(`1. Create slug mappings for ${unmappedModels.length} unmapped models`);
    console.log(`2. Or create Readwise curation files for these models`);
    console.log(`3. Or hide these models from the website until they have highlights`);
  } else {
    console.log('✅ All static framework models are mapped to Readwise data!');
  }
}

analyzeAllUnmappedModels();
