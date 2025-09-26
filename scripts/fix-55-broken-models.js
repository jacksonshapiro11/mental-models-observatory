const fs = require('fs');
const path = require('path');

async function fix55BrokenModels() {
  console.log('=== FIXING 55 BROKEN MODELS ===\n');

  // Load the results from our previous check
  const resultsPath = path.join(process.cwd(), 'real-model-check-results.json');
  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch (error) {
    console.error('Could not load previous results. Running fresh check...');
    return;
  }

  const brokenModels = results.brokenModels;
  console.log(`📊 Found ${brokenModels.length} broken models to fix\n`);

  // Get all available Readwise model IDs
  let readwiseModelIds = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    readwiseModelIds = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch Readwise model IDs');
    return;
  }

  console.log(`📊 Available Readwise IDs: ${readwiseModelIds.length}\n`);

  const foundMappings = [];
  const stillBroken = [];

  // Process each broken model
  for (let i = 0; i < brokenModels.length; i++) {
    const model = brokenModels[i];
    console.log(`\n🔍 [${i+1}/${brokenModels.length}] ${model.name}`);
    console.log(`   Slug: ${model.slug}`);
    
    // Extract keywords from the model slug and name
    const slugKeywords = model.slug.split('-').filter(word => word.length > 2);
    const nameKeywords = model.name.toLowerCase().split(/[\s&\-,()]+/).filter(word => word.length > 2);
    const allKeywords = [...new Set([...slugKeywords, ...nameKeywords])];
    
    console.log(`   Keywords: ${allKeywords.slice(0, 5).join(', ')}`);
    
    // Find potential matches in Readwise
    const candidates = [];
    
    for (const readwiseId of readwiseModelIds) {
      if (!readwiseId || typeof readwiseId !== 'string') continue;
      
      let score = 0;
      const readwiseWords = readwiseId.split('-');
      
      // Score based on keyword matches
      for (const keyword of allKeywords) {
        if (readwiseId.includes(keyword)) {
          score += 2;
        }
        // Partial matches
        for (const readwiseWord of readwiseWords) {
          if (readwiseWord && keyword && (readwiseWord.includes(keyword) || keyword.includes(readwiseWord))) {
            score += 1;
          }
        }
      }
      
      if (score > 0) {
        candidates.push({ id: readwiseId, score });
      }
    }
    
    // Sort by score and test top candidates
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, 3);
    
    console.log(`   Top candidates: ${topCandidates.map(c => `${c.id}(${c.score})`).join(', ')}`);
    
    let foundMatch = false;
    for (const candidate of topCandidates) {
      try {
        const response = require('child_process').execSync(
          `curl -s http://localhost:3000/api/readwise/highlights/${candidate.id}`, 
          { encoding: 'utf8', timeout: 3000 }
        );
        const data = JSON.parse(response);
        const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
        
        if (highlightCount > 0) {
          console.log(`   ✅ FOUND MATCH: ${candidate.id} (${highlightCount} highlights)`);
          foundMappings.push({
            brokenSlug: model.slug,
            brokenName: model.name,
            workingId: candidate.id,
            highlightCount: highlightCount,
            domain: model.domain
          });
          foundMatch = true;
          break;
        }
      } catch (error) {
        // Continue to next candidate
      }
    }
    
    if (!foundMatch) {
      console.log(`   ❌ No working match found`);
      stillBroken.push(model);
    }
    
    // Small delay to avoid overwhelming the server
    if (i % 5 === 4) {
      console.log(`\n   ... processed ${i+1}/${brokenModels.length} models`);
      require('child_process').execSync('sleep 1');
    }
  }
  
  // Generate mapping code
  console.log('\n=== RESULTS ===');
  console.log(`✅ Found mappings: ${foundMappings.length}/${brokenModels.length}`);
  console.log(`❌ Still broken: ${stillBroken.length}/${brokenModels.length}`);
  
  if (foundMappings.length > 0) {
    console.log('\n=== TYPESCRIPT MAPPINGS TO ADD ===');
    console.log('// Add these to MODEL_SLUG_MAPPINGS in parse-all-domains.ts:');
    
    // Group by domain for better organization
    const mappingsByDomain = {};
    for (const mapping of foundMappings) {
      if (!mappingsByDomain[mapping.domain]) {
        mappingsByDomain[mapping.domain] = [];
      }
      mappingsByDomain[mapping.domain].push(mapping);
    }
    
    for (const [domain, mappings] of Object.entries(mappingsByDomain)) {
      console.log(`\n  // ${domain} - NEWLY FIXED`);
      for (const mapping of mappings) {
        console.log(`  '${mapping.brokenSlug}': '${mapping.workingId}',`);
      }
    }
  }
  
  if (stillBroken.length > 0) {
    console.log('\n=== STILL BROKEN (may need manual research) ===');
    for (const model of stillBroken.slice(0, 10)) {
      console.log(`  - ${model.slug} (${model.name})`);
    }
    if (stillBroken.length > 10) {
      console.log(`  ... and ${stillBroken.length - 10} more`);
    }
  }
  
  // Save results
  const fixResults = {
    foundMappings,
    stillBroken,
    summary: {
      total: brokenModels.length,
      fixed: foundMappings.length,
      remaining: stillBroken.length,
      successRate: Math.round(foundMappings.length / brokenModels.length * 100)
    }
  };
  
  fs.writeFileSync('fix-results.json', JSON.stringify(fixResults, null, 2));
  console.log('\n📁 Fix results saved to fix-results.json');
  
  return fixResults;
}

fix55BrokenModels();
