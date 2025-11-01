const fs = require('fs');
const path = require('path');

/**
 * Insert the 9 regenerated models into lib/readwise-data.ts
 * using a safer approach: find models by their ID pattern
 */

console.log('📝 Inserting regenerated models into lib/readwise-data.ts...\n');

// Load the parsed models
const parsedPath = path.join(__dirname, '..', 'regenerated-models-parsed.json');
const models = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
let dataContent = fs.readFileSync(dataPath, 'utf8');

// Function to format a model as TypeScript
function formatModel(model) {
  return `  {
    "id": "${model.domainSlug}-${model.code.toLowerCase()}",
    "code": "${model.code}",
    "name": "${model.name}",
    "description": "${model.description}",
    "slug": "${model.slug}",
    "domain": "${model.domain}",
    "domainSlug": "${model.domainSlug}",
    "principles": ${JSON.stringify(model.principles, null, 6).replace(/\n/g, '\n    ')},
    "examples": [],
    "applications": ${JSON.stringify(model.applications, null, 6).replace(/\n/g, '\n    ')},
    "relatedModels": [],
    "sources": [],
    "tags": [],
    "difficulty": "intermediate",
    "createdAt": "${new Date().toISOString()}",
    "updatedAt": "${new Date().toISOString()}"
  }`;
}

// Group models by domain
const modelsByDomain = {};
for (const model of models) {
  if (!modelsByDomain[model.domainSlug]) {
    modelsByDomain[model.domainSlug] = [];
  }
  modelsByDomain[model.domainSlug].push(model);
}

// Strategy: Find the highest code letter in each domain and insert after that model
let insertedCount = 0;

for (const [domainSlug, domainModels] of Object.entries(modelsByDomain)) {
  console.log(`\n📂 Domain: ${domainSlug}`);
  
  // Find all model IDs in this domain
  const idPattern = new RegExp(`"id": "${domainSlug}-\\d+[a-z]"`, 'gi');
  const idMatches = [...dataContent.matchAll(idPattern)];
  
  if (idMatches.length === 0) {
    console.log(`   ❌ Could not find any models in domain: ${domainSlug}`);
    continue;
  }
  
  // Get the last match
  const lastIdMatch = idMatches[idMatches.length - 1];
  const lastIdIndex = lastIdMatch.index;
  
  // Now find the end of this entire model object
  // Strategy: find the next "id": pattern OR the closing of READWISE_MODELS array
  const nextIdMatch = dataContent.indexOf('"id":', lastIdIndex + lastIdMatch[0].length);
  const closingArrayMatch = dataContent.indexOf('];', lastIdIndex);
  
  let insertPosition;
  if (nextIdMatch !== -1 && nextIdMatch < closingArrayMatch) {
    // There's another model after this one - insert before it
    // Find the }, that comes before the next id
    const commaBeforeNext = dataContent.lastIndexOf(',', nextIdMatch);
    insertPosition = commaBeforeNext + 1;
  } else {
    // This is the last model in the array - insert before ];
    const lastComma = dataContent.lastIndexOf(',', closingArrayMatch);
    insertPosition = dataContent.indexOf('}', lastComma) + 1;
  }
  
  // Insert all models for this domain
  let insertText = '';
  for (const model of domainModels) {
    console.log(`   📌 Inserting ${model.code}: ${model.name}`);
    insertText += ',\n' + formatModel(model);
    insertedCount++;
  }
  
  dataContent = dataContent.slice(0, insertPosition) + 
                insertText + 
                dataContent.slice(insertPosition);
}

// Write the updated content back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully inserted ${insertedCount} models into lib/readwise-data.ts\n`);
console.log('🔄 Next step: Verify the file compiles and test the website\n');


