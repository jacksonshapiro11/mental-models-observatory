const fs = require('fs');
const path = require('path');

async function checkAll119Models() {
  console.log('=== CHECKING ALL 119 MODELS FOR READWISE HIGHLIGHTS ===\n');

  // Get all model slugs from the static framework
  const readwiseDataPath = path.join(process.cwd(), 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Extract all models with their domains and slugs
  const modelsSection = content.match(/export const READWISE_MODELS[\s\S]*?^\];/m);
  if (!modelsSection) {
    console.error('Could not find READWISE_MODELS section');
    return;
  }
  
  // Parse each model object
  const modelObjects = [];
  const modelMatches = modelsSection[0].match(/\{[\s\S]*?\}/g);
  
  if (modelMatches) {
    for (const modelMatch of modelMatches) {
      try {
        // Extract slug, title, and domain
        const slugMatch = modelMatch.match(/"slug":\s*"([^"]+)"/);
        const titleMatch = modelMatch.match(/"title":\s*"([^"]+)"/);
        const domainMatch = modelMatch.match(/"domain":\s*"([^"]+)"/);
        
        if (slugMatch && titleMatch && domainMatch) {
          modelObjects.push({
            slug: slugMatch[1],
            title: titleMatch[1],
            domain: domainMatch[1]
          });
        }
      } catch (e) {
        // Skip malformed objects
      }
    }
  }
  
  console.log(`📊 Found ${modelObjects.length} models to check\n`);
  
  // Group models by domain for better organization
  const modelsByDomain = {};
  for (const model of modelObjects) {
    if (!modelsByDomain[model.domain]) {
      modelsByDomain[model.domain] = [];
    }
    modelsByDomain[model.domain].push(model);
  }
  
  const workingModels = [];
  const brokenModels = [];
  
  // Check each model
  for (const [domain, models] of Object.entries(modelsByDomain)) {
    console.log(`🔍 ${domain} (${models.length} models):`);
    
    for (const model of models) {
      try {
        const response = require('child_process').execSync(
          `curl -s http://localhost:3000/api/readwise/highlights/${model.slug}`, 
          { encoding: 'utf8', timeout: 5000 }
        );
        const data = JSON.parse(response);
        const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
        
        if (highlightCount > 0) {
          console.log(`  ✅ ${model.title}: ${highlightCount} highlights`);
          workingModels.push({ ...model, highlightCount });
        } else {
          console.log(`  ❌ ${model.title}: 0 highlights`);
          brokenModels.push(model);
        }
      } catch (error) {
        console.log(`  ❌ ${model.title}: ERROR`);
        brokenModels.push(model);
      }
    }
    console.log(); // Empty line between domains
  }
  
  // Summary
  console.log('=== SUMMARY ===');
  console.log(`✅ Working models: ${workingModels.length}/${modelObjects.length} (${Math.round(workingModels.length/modelObjects.length*100)}%)`);
  console.log(`❌ Broken models: ${brokenModels.length}/${modelObjects.length} (${Math.round(brokenModels.length/modelObjects.length*100)}%)`);
  
  console.log('\n=== BROKEN MODELS BY DOMAIN ===');
  const brokenByDomain = {};
  for (const model of brokenModels) {
    if (!brokenByDomain[model.domain]) {
      brokenByDomain[model.domain] = [];
    }
    brokenByDomain[model.domain].push(model);
  }
  
  for (const [domain, models] of Object.entries(brokenByDomain)) {
    console.log(`\n${domain} (${models.length} broken):`);
    for (const model of models) {
      console.log(`  - ${model.slug}`);
    }
  }
  
  // Export results for further analysis
  const results = {
    total: modelObjects.length,
    working: workingModels.length,
    broken: brokenModels.length,
    workingModels,
    brokenModels,
    brokenByDomain
  };
  
  fs.writeFileSync('model-check-results.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Results saved to model-check-results.json');
  
  return results;
}

checkAll119Models();
