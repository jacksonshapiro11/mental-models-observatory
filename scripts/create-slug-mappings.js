const fs = require('fs');
const path = require('path');

async function createSlugMappings() {
  console.log('=== CREATING SLUG MAPPINGS ===\n');

  // Get Readwise model IDs
  let readwiseModelIds = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    readwiseModelIds = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch Readwise model IDs');
    return;
  }
  
  console.log(`📊 Readwise model IDs: ${readwiseModelIds.length}`);
  console.log('First 10 Readwise IDs:');
  readwiseModelIds.slice(0, 10).forEach(id => console.log(`  - ${id}`));
  
  // Get static framework model slugs
  const readwiseDataPath = path.join(process.cwd(), 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Find a few sample static slugs
  const slugMatches = content.match(/"slug":\s*"([^"]+)"/g);
  const staticSlugs = slugMatches ? slugMatches.map(m => m.match(/"([^"]+)"/)[1]).slice(0, 10) : [];
  
  console.log(`\n📊 Static framework slugs (first 10):`);
  staticSlugs.forEach(slug => console.log(`  - ${slug}`));
  
  // Test a few specific cases to understand the pattern
  console.log('\n🔍 TESTING SPECIFIC MODELS:');
  
  const testCases = [
    'energy-as-core-resource-ultimate-constraint',
    'energy-core-resource-ultimate-constraint',
    'models-as-mental-procedures-operating-systems',
    'memento-mori-death-as-teacher',
    'system-1-vs-system-2-thinking'
  ];
  
  for (const testSlug of testCases) {
    try {
      const response = require('child_process').execSync(
        `curl -s http://localhost:3000/api/readwise/highlights/${testSlug}`, 
        { encoding: 'utf8' }
      );
      const data = JSON.parse(response);
      const highlightCount = data.curatedHighlights ? data.curatedHighlights.length : 0;
      console.log(`  ${testSlug}: ${highlightCount} highlights ${highlightCount > 0 ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`  ${testSlug}: ERROR ❌`);
    }
  }
  
  // Manual mappings for the problematic ones identified
  const manualMappings = {
    // Energy domain
    'energy-as-core-resource-ultimate-constraint': 'energy-core-resource-ultimate-constraint',
    
    // Mental Models domain
    'models-as-mental-procedures-operating-systems': 'models-mental-procedures-operating-systems',
    
    // Psychology domain
    'system-1-vs-system-2-thinking': 'system-1-vs-system-2-thinking', // This might be exact
    
    // Add more as we identify them
  };
  
  console.log('\n💡 SUGGESTED MANUAL MAPPINGS:');
  for (const [staticSlug, readwiseId] of Object.entries(manualMappings)) {
    console.log(`  "${staticSlug}": "${readwiseId}",`);
  }
  
  return { readwiseModelIds, staticSlugs, manualMappings };
}

createSlugMappings();
