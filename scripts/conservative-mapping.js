const fs = require('fs');
const path = require('path');

async function conservativeMapping() {
  console.log('=== CONSERVATIVE MAPPING - ONLY VERY CLOSE MATCHES ===\n');

  // Load the results from our previous check
  const resultsPath = path.join(process.cwd(), 'real-model-check-results.json');
  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch (error) {
    console.error('Could not load previous results.');
    return;
  }

  const brokenModels = results.brokenModels;
  console.log(`📊 Found ${brokenModels.length} broken models to analyze\n`);

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

  const highQualityMappings = [];
  const noCloseMatchFound = [];

  // Process each broken model with strict criteria
  for (let i = 0; i < brokenModels.length; i++) {
    const model = brokenModels[i];
    console.log(`\n🔍 [${i+1}/${brokenModels.length}] ${model.name}`);
    console.log(`   Slug: ${model.slug}`);
    
    // Look for very close matches using multiple criteria
    const candidates = findHighQualityMatches(model, readwiseModelIds);
    
    if (candidates.length > 0) {
      console.log(`   Top candidates: ${candidates.slice(0, 3).map(c => `${c.id}(score:${c.score})`).join(', ')}`);
      
      // Test the best candidate
      let foundMatch = false;
      for (const candidate of candidates.slice(0, 2)) { // Only test top 2
        try {
          const response = require('child_process').execSync(
            `curl -s http://localhost:3000/api/readwise/highlights/${candidate.id}`, 
            { encoding: 'utf8', timeout: 3000 }
          );
          const data = JSON.parse(response);
          const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
          
          if (highlightCount > 0) {
            console.log(`   ✅ HIGH QUALITY MATCH: ${candidate.id} (${highlightCount} highlights, score: ${candidate.score})`);
            highQualityMappings.push({
              brokenSlug: model.slug,
              brokenName: model.name,
              workingId: candidate.id,
              highlightCount: highlightCount,
              domain: model.domain,
              matchScore: candidate.score,
              confidence: candidate.score >= 15 ? 'high' : candidate.score >= 10 ? 'medium' : 'low'
            });
            foundMatch = true;
            break;
          }
        } catch (error) {
          // Continue to next candidate
        }
      }
      
      if (!foundMatch) {
        console.log(`   ⚠️  Candidates found but none have highlights`);
        noCloseMatchFound.push({ ...model, reason: 'candidates_no_highlights' });
      }
    } else {
      console.log(`   ❌ NO CLOSE MATCH - flagging for manual research`);
      noCloseMatchFound.push({ ...model, reason: 'no_semantic_match' });
    }
  }
  
  // Results
  console.log('\n=== CONSERVATIVE RESULTS ===');
  console.log(`✅ High quality mappings: ${highQualityMappings.length}/${brokenModels.length}`);
  console.log(`❌ No close match found: ${noCloseMatchFound.length}/${brokenModels.length}`);
  
  // Show only high-confidence mappings
  const highConfidenceMappings = highQualityMappings.filter(m => m.confidence === 'high');
  const mediumConfidenceMappings = highQualityMappings.filter(m => m.confidence === 'medium');
  const lowConfidenceMappings = highQualityMappings.filter(m => m.confidence === 'low');
  
  console.log(`\n📊 Confidence breakdown:`);
  console.log(`   High confidence: ${highConfidenceMappings.length}`);
  console.log(`   Medium confidence: ${mediumConfidenceMappings.length}`);
  console.log(`   Low confidence: ${lowConfidenceMappings.length}`);
  
  if (highConfidenceMappings.length > 0) {
    console.log('\n=== HIGH CONFIDENCE MAPPINGS ===');
    for (const mapping of highConfidenceMappings) {
      console.log(`  '${mapping.brokenSlug}': '${mapping.workingId}', // ${mapping.brokenName} (${mapping.highlightCount} highlights)`);
    }
  }
  
  if (mediumConfidenceMappings.length > 0) {
    console.log('\n=== MEDIUM CONFIDENCE MAPPINGS (review these) ===');
    for (const mapping of mediumConfidenceMappings) {
      console.log(`  '${mapping.brokenSlug}': '${mapping.workingId}', // ${mapping.brokenName} (${mapping.highlightCount} highlights)`);
    }
  }
  
  if (noCloseMatchFound.length > 0) {
    console.log('\n=== NO CLOSE MATCH FOUND (manual research needed) ===');
    for (const model of noCloseMatchFound.slice(0, 20)) {
      console.log(`  - ${model.slug} (${model.name}) [${model.reason}]`);
    }
    if (noCloseMatchFound.length > 20) {
      console.log(`  ... and ${noCloseMatchFound.length - 20} more`);
    }
  }
  
  // Save results
  const conservativeResults = {
    highQualityMappings,
    noCloseMatchFound,
    summary: {
      total: brokenModels.length,
      highQuality: highQualityMappings.length,
      highConfidence: highConfidenceMappings.length,
      mediumConfidence: mediumConfidenceMappings.length,
      lowConfidence: lowConfidenceMappings.length,
      noMatch: noCloseMatchFound.length
    }
  };
  
  fs.writeFileSync('conservative-mapping-results.json', JSON.stringify(conservativeResults, null, 2));
  console.log('\n📁 Conservative results saved to conservative-mapping-results.json');
  
  return conservativeResults;
}

function findHighQualityMatches(model, readwiseModelIds) {
  const candidates = [];
  
  // Extract key terms from model name and slug
  const nameWords = model.name.toLowerCase()
    .replace(/[&\-(),]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !isStopWord(word));
    
  const slugWords = model.slug.split('-').filter(word => word.length > 2);
  
  for (const readwiseId of readwiseModelIds) {
    if (!readwiseId || typeof readwiseId !== 'string') continue;
    
    let score = 0;
    const readwiseWords = readwiseId.split('-');
    
    // Exact word matches (high value)
    for (const word of [...nameWords, ...slugWords]) {
      if (readwiseWords.includes(word)) {
        score += 5;
      }
      
      // Partial matches within words
      for (const rwWord of readwiseWords) {
        if (rwWord.includes(word) && word.length > 3) {
          score += 2;
        }
      }
    }
    
    // Bonus for multiple word matches
    const matchingWords = nameWords.filter(word => readwiseWords.includes(word));
    if (matchingWords.length >= 2) {
      score += matchingWords.length * 3;
    }
    
    // Penalty for very different lengths (likely overfit)
    const lengthDiff = Math.abs(model.slug.length - readwiseId.length);
    if (lengthDiff > 20) {
      score -= 3;
    }
    
    // Only include candidates with meaningful scores
    if (score >= 8) { // Higher threshold for quality
      candidates.push({ id: readwiseId, score });
    }
  }
  
  return candidates.sort((a, b) => b.score - a.score);
}

function isStopWord(word) {
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'vs', 'through', 'under', 'about'];
  return stopWords.includes(word);
}

conservativeMapping();
