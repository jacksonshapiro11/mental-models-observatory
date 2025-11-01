const fs = require('fs');
const path = require('path');

console.log('📝 Appending regenerated models to lib/readwise-data.ts...\n');

// Load the parsed models
const parsedPath = path.join(__dirname, '..', 'regenerated-models-parsed.json');
const models = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
let dataContent = fs.readFileSync(dataPath, 'utf8');

// Function to format a model as TypeScript (with proper escaping)
function formatModel(model) {
  const escapedDescription = model.description.replace(/"/g, '\\"');
  const escapedPrinciples = model.principles.map(p => `      "${p.replace(/"/g, '\\"')}"`).join(',\n');
  const escapedApplications = model.applications.map(a => `      "${a.replace(/"/g, '\\"')}"`).join(',\n');
  
  return `  {
    "id": "${model.domainSlug}-${model.code.toLowerCase()}",
    "code": "${model.code}",
    "name": "${model.name.replace(/"/g, '\\"')}",
    "description": "${escapedDescription}",
    "slug": "${model.slug}",
    "domain": "${model.domain}",
    "domainSlug": "${model.domainSlug}",
    "principles": [
${escapedPrinciples}
    ],
    "examples": [],
    "applications": [
${escapedApplications}
    ],
    "relatedModels": [],
    "sources": [],
    "tags": [],
    "difficulty": "intermediate",
    "createdAt": "${new Date().toISOString()}",
    "updatedAt": "${new Date().toISOString()}"
  }`;
}

// Find the end of the READWISE_MODELS array (just before the closing ];)
const closingPattern = /\n\];[\s\n]*export const READWISE_DOMAINS/;
const match = dataContent.match(closingPattern);

if (!match) {
  console.log('❌ Could not find end of READWISE_MODELS array');
  process.exit(1);
}

const insertPosition = match.index;

// Generate all models as comma-separated strings
let modelsText = '';
for (const model of models) {
  console.log(`📌 Adding ${model.code}: ${model.name}`);
  modelsText += ',\n' + formatModel(model);
}

// Insert the models
dataContent = dataContent.slice(0, insertPosition) + 
              modelsText + 
              dataContent.slice(insertPosition);

// Write back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully added ${models.length} models!`);
console.log('🔄 Verifying...\n');

// Quick verification
const modelCount = (dataContent.match(/"code": "/g) || []).length;
console.log(`Total models in file: ${modelCount}`);


