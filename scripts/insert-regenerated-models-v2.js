const fs = require('fs');
const path = require('path');

/**
 * Insert the 9 regenerated models into lib/readwise-data.ts
 * by finding the last model in each domain and inserting after it
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

// Insert models domain by domain
let insertedCount = 0;
let offset = 0; // Track position offset as we insert

for (const [domainSlug, domainModels] of Object.entries(modelsByDomain)) {
  console.log(`\n📂 Domain: ${domainSlug}`);
  
  // Find the last model in this domain using domainSlug
  const pattern = `"domainSlug": "${domainSlug}"`;
  let lastIndex = -1;
  let searchPos = 0;
  
  while (true) {
    const foundIndex = dataContent.indexOf(pattern, searchPos);
    if (foundIndex === -1) break;
    lastIndex = foundIndex;
    searchPos = foundIndex + pattern.length;
  }
  
  if (lastIndex === -1) {
    console.log(`   ❌ Could not find domain slug: ${domainSlug}`);
    continue;
  }
  
  // Find the end of this model (find the closing }, that ends the model object)
  // We need to find the matching closing brace for the model object
  let braceCount = 0;
  let modelStart = dataContent.lastIndexOf('{', lastIndex);
  let i = modelStart;
  let inString = false;
  let escapeNext = false;
  
  while (i < dataContent.length) {
    const char = dataContent[i];
    
    if (escapeNext) {
      escapeNext = false;
      i++;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      i++;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      if (braceCount === 0) {
        // Found the end of the model object
        const insertPosition = i + 1;
        
        // Insert all models for this domain
        for (const model of domainModels) {
          console.log(`   📌 Inserting ${model.code}: ${model.name}`);
          const formattedModel = ',\n' + formatModel(model);
          dataContent = dataContent.slice(0, insertPosition + offset) + 
                        formattedModel + 
                        dataContent.slice(insertPosition + offset);
          offset += formattedModel.length;
          insertedCount++;
        }
        
        break;
      }
    }
    
    i++;
  }
}

// Write the updated content back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully inserted ${insertedCount} models into lib/readwise-data.ts\n`);
console.log('🔄 Next step: Verify the file compiles and test the website\n');


