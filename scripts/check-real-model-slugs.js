const fs = require('fs');
const path = require('path');

async function checkRealModelSlugs() {
  console.log('=== CHECKING ALL MODEL SLUGS FOR READWISE HIGHLIGHTS ===\n');

  // Get all model slugs from the static framework
  const readwiseDataPath = path.join(process.cwd(), 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Extract all models from READWISE_MODELS section
  const modelsSection = content.match(/export const READWISE_MODELS[\s\S]*?^\];/m);
  if (!modelsSection) {
    console.error('Could not find READWISE_MODELS section');
    return;
  }
  
  // Parse each model object to get the real slug and name
  const models = [];
  const modelMatches = modelsSection[0].match(/\{[\s\S]*?\}/g);
  
  if (modelMatches) {
    for (const modelMatch of modelMatches) {
      try {
        // Extract slug, name, and domain
        const slugMatch = modelMatch.match(/"slug":\s*"([^"]+)"/);
        const nameMatch = modelMatch.match(/"name":\s*"([^"]+)"/);
        const domainMatch = modelMatch.match(/"domain":\s*"([^"]+)"/);
        
        if (slugMatch && nameMatch && domainMatch) {
          models.push({
            slug: slugMatch[1],
            name: nameMatch[1],
            domain: domainMatch[1]
          });
        }
      } catch (e) {
        // Skip malformed objects
      }
    }
  }
  
  console.log(`📊 Found ${models.length} models to check\n`);
  
  // Group models by domain for better organization
  const modelsByDomain = {};
  for (const model of models) {
    if (!modelsByDomain[model.domain]) {
      modelsByDomain[model.domain] = [];
    }
    modelsByDomain[model.domain].push(model);
  }
  
  const workingModels = [];
  const brokenModels = [];
  
  let checkedCount = 0;
  
  // Check each model
  for (const [domain, domainModels] of Object.entries(modelsByDomain)) {
    console.log(`🔍 ${domain} (${domainModels.length} models):`);
    
    for (const model of domainModels) {
      try {
        const response = require('child_process').execSync(
          `curl -s http://localhost:3000/api/readwise/highlights/${model.slug}`, 
          { encoding: 'utf8', timeout: 5000 }
        );
        const data = JSON.parse(response);
        const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
        
        if (highlightCount > 0) {
          console.log(`  ✅ ${model.name}: ${highlightCount} highlights`);
          workingModels.push({ ...model, highlightCount });
        } else {
          console.log(`  ❌ ${model.name}: 0 highlights`);
          brokenModels.push(model);
        }
        
        checkedCount++;
        
        // Add a small delay to avoid overwhelming the server
        if (checkedCount % 10 === 0) {
          console.log(`    ... checked ${checkedCount}/${models.length} models`);
          require('child_process').execSync('sleep 0.5'); // 500ms delay
        }
        
      } catch (error) {
        console.log(`  ❌ ${model.name}: ERROR`);
        brokenModels.push(model);
        checkedCount++;
      }
    }
    console.log(); // Empty line between domains
  }
  
  // Summary
  console.log('=== SUMMARY ===');
  console.log(`✅ Working models: ${workingModels.length}/${models.length} (${Math.round(workingModels.length/models.length*100)}%)`);
  console.log(`❌ Broken models: ${brokenModels.length}/${models.length} (${Math.round(brokenModels.length/models.length*100)}%)`);
  
  console.log('\n=== TOP 20 BROKEN MODELS (by domain) ===');
  const brokenByDomain = {};
  for (const model of brokenModels) {
    if (!brokenByDomain[model.domain]) {
      brokenByDomain[model.domain] = [];
    }
    brokenByDomain[model.domain].push(model);
  }
  
  let shownCount = 0;
  for (const [domain, domainModels] of Object.entries(brokenByDomain)) {
    console.log(`\n${domain} (${domainModels.length} broken):`);
    for (const model of domainModels.slice(0, 5)) { // Show max 5 per domain
      console.log(`  - ${model.slug} (${model.name})`);
      shownCount++;
      if (shownCount >= 20) break;
    }
    if (shownCount >= 20) break;
  }
  
  // Export results for further analysis
  const results = {
    total: models.length,
    working: workingModels.length,
    broken: brokenModels.length,
    workingModels,
    brokenModels,
    brokenByDomain
  };
  
  fs.writeFileSync('real-model-check-results.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Results saved to real-model-check-results.json');
  
  return results;
}

checkRealModelSlugs();
