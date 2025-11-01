const fs = require('fs');
const path = require('path');

console.log('📝 Replacing old model content with regenerated content...\n');

// Load the regenerated models
const regenPath = path.join(__dirname, '..', 'Mental Models Description', 'regenerated_models_missing.md');
const regenContent = fs.readFileSync(regenPath, 'utf8');

// Map of old codes to new content
const codeMapping = {
  '13B': { oldName: 'Social Identity & Group Belonging', newName: 'Social Reality Construction & Collective Belief' },
  '14B': { oldName: 'Communication Bandwidth & Medium Constraints', newName: 'Semantics vs. Meaning & Deep Understanding' },
  '15C': { oldName: 'Media as Reality Constructor', newName: 'Predictive Processing & Constructed Experience' },
  '18A': { oldName: 'Quality vs. Quantity in Relationships', newName: 'Love as Nuclear Fuel & Life Foundation' },
  '18D': { oldName: 'Attachment & Interdependence', newName: 'Compounding Human Connections' },
  '19C': { oldName: 'Sleep & Recovery as Performance Foundation', newName: 'Physiological States & Decision Quality' },
  '20B': { oldName: 'Flow States & Peak Performance', newName: 'Mind-Body Integration & Embodied Presence' },
  '20C': { oldName: 'Habit Formation & Behavior Change', newName: 'Deconstructing Mental Patterns & Pain Body' },
  '20D': { oldName: 'Meditation & Contemplative Practice', newName: 'Transcending Ego & Two-Selves Integration' }
};

// Parse the regenerated models
const models = [];
const modelSections = regenContent.split(/###\s+\d+[A-Z]:/);

for (let i = 1; i < modelSections.length; i++) {
  const section = modelSections[i];
  
  // Extract code from the previous section
  const prevSection = regenContent.substring(0, regenContent.indexOf(section));
  const codeMatch = prevSection.match(/###\s+(\d+[A-Z]):/g);
  const lastCode = codeMatch ? codeMatch[codeMatch.length - 1].match(/(\d+[A-Z])/)[1] : null;
  
  if (!lastCode) continue;
  
  // Extract name
  const nameMatch = section.match(/^\s*([^\n]+)/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  
  // Extract description
  const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
  const description = descMatch ? descMatch[1].trim() : '';
  
  // Extract principles
  const prinMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
  const principlesText = prinMatch ? prinMatch[1].trim() : '';
  const principles = principlesText.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // Extract applications
  const appMatch = section.match(/\*\*Key Applications:\*\*\s*([\s\S]*?)(?:\n\*\*Related Models:|$)/);
  const applicationsText = appMatch ? appMatch[1].trim() : '';
  const applications = applicationsText.split(/\n\n+/).filter(a => a.trim().length > 0);
  
  models.push({
    code: lastCode,
    name,
    description,
    principles,
    applications
  });
}

console.log(`✅ Parsed ${models.length} regenerated models\n`);

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
let dataContent = fs.readFileSync(dataPath, 'utf8');

// Replace content for each model
let updatedCount = 0;

for (const model of models) {
  console.log(`📌 Updating ${model.code}: ${codeMapping[model.code]?.oldName} → ${model.name}`);
  
  // Find the model by code
  const codePattern = new RegExp(`"code": "${model.code}"`, 'g');
  const matches = [...dataContent.matchAll(codePattern)];
  
  if (matches.length === 0) {
    console.log(`   ❌ Could not find model with code ${model.code}`);
    continue;
  }
  
  // Use the first match (should be the original model, not the duplicate we just added)
  const match = matches[0];
  const modelStart = dataContent.lastIndexOf('{', match.index);
  
  // Find the end of this model
  let braceCount = 0;
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
        // Found the end of the model
        const modelEnd = i + 1;
        const oldModel = dataContent.substring(modelStart, modelEnd);
        
        // Extract just the fields we need to preserve
        const idMatch = oldModel.match(/"id": "([^"]+)"/);
        const slugMatch = oldModel.match(/"slug": "([^"]+)"/);
        const domainMatch = oldModel.match(/"domain": "([^"]+)"/);
        const domainSlugMatch = oldModel.match(/"domainSlug": "([^"]+)"/);
        
        if (!idMatch || !slugMatch || !domainMatch || !domainSlugMatch) {
          console.log(`   ❌ Could not extract required fields from model ${model.code}`);
          break;
        }
        
        // Create the new model with updated content
        const escapedDescription = model.description.replace(/"/g, '\\"');
        const escapedName = model.name.replace(/"/g, '\\"');
        const escapedPrinciples = model.principles.map(p => `      "${p.replace(/"/g, '\\"')}"`).join(',\n');
        const escapedApplications = model.applications.map(a => `      "${a.replace(/"/g, '\\"')}"`).join(',\n');
        
        const newModel = `  {
    "id": "${idMatch[1]}",
    "code": "${model.code}",
    "name": "${escapedName}",
    "description": "${escapedDescription}",
    "slug": "${slugMatch[1]}",
    "domain": "${domainMatch[1]}",
    "domainSlug": "${domainSlugMatch[1]}",
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
        
        // Replace the old model with the new one
        dataContent = dataContent.substring(0, modelStart) + newModel + dataContent.substring(modelEnd);
        updatedCount++;
        console.log(`   ✅ Updated successfully`);
        break;
      }
    }
    
    i++;
  }
}

// Write back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully updated ${updatedCount} models!\n`);
console.log('🔄 Next: Remove the duplicate models we added earlier\n');

