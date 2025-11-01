const fs = require('fs');
const path = require('path');

/**
 * Insert the 9 regenerated models into lib/readwise-data.ts
 * at the appropriate domain positions
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

// Insert models by domain
let insertedCount = 0;

for (const model of models) {
  console.log(`📌 Inserting ${model.code}: ${model.name}`);
  
  // Find the domain section
  const domainRegex = new RegExp(
    `domain: "${model.domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?(?=\\n  },\\n  {\\n    "id"|\\n];)`,
    'g'
  );
  
  // Find all models in this domain
  const domainMatches = [...dataContent.matchAll(domainRegex)];
  
  if (domainMatches.length === 0) {
    console.log(`   ❌ Could not find domain: ${model.domain}`);
    continue;
  }
  
  // Get the last match (last model in this domain)
  const lastMatch = domainMatches[domainMatches.length - 1];
  const insertPosition = lastMatch.index + lastMatch[0].length;
  
  // Insert the new model
  const formattedModel = formatModel(model);
  dataContent = dataContent.slice(0, insertPosition) + 
                ',\n' + formattedModel + 
                dataContent.slice(insertPosition);
  
  insertedCount++;
  console.log(`   ✅ Inserted successfully`);
}

// Write the updated content back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully inserted ${insertedCount} models into lib/readwise-data.ts\n`);
console.log('🔄 Next step: Verify the file compiles and test the website\n');


