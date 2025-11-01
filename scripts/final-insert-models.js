const fs = require('fs');
const path = require('path');

console.log('📝 Inserting regenerated models into lib/readwise-data.ts...\n');

// Load the parsed models
const parsedPath = path.join(__dirname, '..', 'regenerated-models-parsed.json');
const models = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const lines = fs.readFileSync(dataPath, 'utf8').split('\n');

// Find line 6046 (the last model's closing brace)
const insertAfterLine = 6045; // 0-indexed, so line 6046 is index 6045

// Format models
function formatModel(model) {
  const escapedDescription = model.description.replace(/"/g, '\\"');
  const escapedName = model.name.replace(/"/g, '\\"');
  const escapedPrinciples = model.principles.map(p => `      "${p.replace(/"/g, '\\"')}"`).join(',\n');
  const escapedApplications = model.applications.map(a => `      "${a.replace(/"/g, '\\"')}"`).join(',\n');
  
  return `  {
    "id": "${model.domainSlug}-${model.code.toLowerCase()}",
    "code": "${model.code}",
    "name": "${escapedName}",
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

// Generate all models
const newModelsLines = [];
for (const model of models) {
  console.log(`📌 Adding ${model.code}: ${model.name}`);
  const formattedModel = formatModel(model);
  newModelsLines.push(',');
  newModelsLines.push(...formattedModel.split('\n'));
}

// Insert the models
lines.splice(insertAfterLine + 1, 0, ...newModelsLines);

// Write back
fs.writeFileSync(dataPath, lines.join('\n'));

console.log(`\n✅ Successfully added ${models.length} models!`);
console.log(`Total lines in file: ${lines.length}`);


