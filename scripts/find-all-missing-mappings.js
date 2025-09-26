const fs = require('fs');
const path = require('path');

async function findAllMissingMappings() {
  console.log('=== FINDING ALL MISSING MAPPINGS ===\n');

  // Get all Readwise model IDs
  let readwiseModelIds = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    readwiseModelIds = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch Readwise model IDs');
    return;
  }

  console.log(`📊 Available Readwise IDs: ${readwiseModelIds.length}`);

  // Test specific problematic models
  const problematicModels = [
    'metabolic-constraints-biological-scaling',
    'cognitive-biases-systematic-errors',
    'mental-accounting-reference-points',
    'kahneman-8-decision-questions',
    'cross-disciplinary-synthesis-the-best-answer-problem',
    'first-principles-thinking-abstraction',
    'critical-approach-fallibilism',
    'good-explanations-vs-prophecy'
  ];

  console.log('\n🔍 TESTING PROBLEMATIC MODELS:');
  
  for (const model of problematicModels) {
    try {
      const response = require('child_process').execSync(
        `curl -s http://localhost:3000/api/readwise/highlights/${model}`, 
        { encoding: 'utf8' }
      );
      const data = JSON.parse(response);
      const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
      console.log(`  ${model}: ${highlightCount} highlights ${highlightCount > 0 ? '✅' : '❌'}`);
      
      if (highlightCount === 0) {
        // Try to find similar Readwise IDs
        const keywords = model.split('-');
        const candidates = readwiseModelIds.filter(id => 
          keywords.some(keyword => id.includes(keyword)) ||
          id.split('-').some(part => keywords.includes(part))
        );
        
        if (candidates.length > 0) {
          console.log(`    Potential matches: ${candidates.slice(0, 3).join(', ')}`);
          
          // Test the first candidate
          try {
            const testResponse = require('child_process').execSync(
              `curl -s http://localhost:3000/api/readwise/highlights/${candidates[0]}`, 
              { encoding: 'utf8' }
            );
            const testData = JSON.parse(testResponse);
            const testCount = testData.curatedHighlights ? testData.curatedHighlights.length : 0;
            if (testCount > 0) {
              console.log(`    ✅ FOUND: ${candidates[0]} has ${testCount} highlights`);
            }
          } catch (e) {
            // Ignore test errors
          }
        }
      }
    } catch (error) {
      console.log(`  ${model}: ERROR ❌`);
    }
  }

  // Search for specific terms in Readwise IDs
  console.log('\n🔍 SEARCHING FOR SPECIFIC TERMS:');
  
  const searchTerms = [
    { term: 'metabolic', description: 'Metabolic models' },
    { term: 'cognitive', description: 'Cognitive models' },
    { term: 'bias', description: 'Bias models' },
    { term: 'account', description: 'Accounting models' },
    { term: 'kahneman', description: 'Kahneman models' },
    { term: 'disciplinary', description: 'Cross-disciplinary models' },
    { term: 'principles', description: 'First principles models' },
    { term: 'critical', description: 'Critical thinking models' },
    { term: 'explanation', description: 'Explanation models' }
  ];
  
  for (const { term, description } of searchTerms) {
    const matches = readwiseModelIds.filter(id => id.includes(term));
    console.log(`  ${description}: ${matches.join(', ') || 'None found'}`);
  }
}

findAllMissingMappings();
