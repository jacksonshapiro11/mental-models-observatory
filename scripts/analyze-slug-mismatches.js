const fs = require('fs');
const path = require('path');

async function analyzeSlugMismatches() {
  console.log('=== ANALYZING SLUG MISMATCHES ===\n');

  // Get static framework model slugs
  const readwiseDataPath = path.join(process.cwd(), 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Extract all model slugs from the READWISE_MODELS section
  const modelsSection = content.match(/export const READWISE_MODELS[\s\S]*?^\];/m);
  if (!modelsSection) {
    console.error('Could not find READWISE_MODELS section');
    return;
  }
  
  const slugMatches = modelsSection[0].match(/"slug":\s*"([^"]+)"/g);
  const staticSlugs = slugMatches ? slugMatches.map(m => m.match(/"([^"]+)"/)[1]) : [];
  
  console.log(`📊 Static framework slugs: ${staticSlugs.length}`);
  
  // Get Readwise model IDs
  let readwiseModelIds = [];
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    readwiseModelIds = data.modelIds || [];
  } catch (error) {
    console.error('Could not fetch Readwise model IDs');
  }
  
  console.log(`📊 Readwise model IDs: ${readwiseModelIds.length}`);
  
  // Find exact matches
  const exactMatches = staticSlugs.filter(slug => readwiseModelIds.includes(slug));
  console.log(`✅ Exact matches: ${exactMatches.length}`);
  
  // Find mismatches that need mapping
  const unmatchedStatic = staticSlugs.filter(slug => !readwiseModelIds.includes(slug));
  const unmatchedReadwise = readwiseModelIds.filter(id => !staticSlugs.includes(id));
  
  console.log(`❌ Unmatched static slugs: ${unmatchedStatic.length}`);
  console.log(`❌ Unmatched Readwise IDs: ${unmatchedReadwise.length}`);
  
  // Try to find similar slugs (potential mappings)
  console.log('\n🔍 POTENTIAL MAPPINGS:');
  const potentialMappings = [];
  
  for (const staticSlug of unmatchedStatic.slice(0, 20)) { // Limit to first 20 for readability
    for (const readwiseId of unmatchedReadwise) {
      // Calculate similarity (simple approach)
      const similarity = calculateSimilarity(staticSlug, readwiseId);
      if (similarity > 0.7) { // High similarity threshold
        console.log(`  ${staticSlug} → ${readwiseId} (${Math.round(similarity * 100)}% similar)`);
        potentialMappings.push({
          staticSlug,
          readwiseId,
          similarity
        });
      }
    }
  }
  
  // Show some specific examples
  console.log('\n📝 SPECIFIC EXAMPLES:');
  const testCases = [
    'energy-as-core-resource-ultimate-constraint',
    'models-as-mental-procedures-operating-systems',
    'system-1-vs-system-2-thinking'
  ];
  
  for (const testSlug of testCases) {
    const isInStatic = staticSlugs.includes(testSlug);
    const isInReadwise = readwiseModelIds.includes(testSlug);
    console.log(`  ${testSlug}:`);
    console.log(`    Static: ${isInStatic ? '✅' : '❌'}`);
    console.log(`    Readwise: ${isInReadwise ? '✅' : '❌'}`);
    
    if (!isInStatic && !isInReadwise) {
      // Try to find similar ones
      const similarStatic = staticSlugs.find(s => calculateSimilarity(s, testSlug) > 0.8);
      const similarReadwise = readwiseModelIds.find(r => calculateSimilarity(r, testSlug) > 0.8);
      if (similarStatic) console.log(`    Similar static: ${similarStatic}`);
      if (similarReadwise) console.log(`    Similar Readwise: ${similarReadwise}`);
    }
  }
  
  return { staticSlugs, readwiseModelIds, potentialMappings };
}

function calculateSimilarity(str1, str2) {
  // Simple Levenshtein distance-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

analyzeSlugMismatches();
