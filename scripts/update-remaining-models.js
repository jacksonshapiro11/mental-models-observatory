const fs = require('fs');
const path = require('path');

console.log('📝 Updating remaining models with case-insensitive code matching...\n');

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
let dataContent = fs.readFileSync(dataPath, 'utf8');

// Run the simple-update-by-code script again with case-insensitive matching
const descDir = path.join(__dirname, '..', 'Mental Models Description');
const files = fs.readdirSync(descDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));

console.log(`Found ${files.length} description files to process\n`);

// Parse all models from description files
const allNewContent = {};

for (const file of files) {
  const filePath = path.join(descDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all models with format "### XYz:" (case insensitive)
  const modelRegex = /###\s+(\d+[a-z]):\s*([^\n]+)\s*\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*(?:Key )?Applications:\*\*\s*([\s\S]*?)(?:\n\*\*Related Models:|\n\n---|$)/gi;
  
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const code = match[1].toUpperCase(); // Convert to uppercase for matching
    const name = match[2].trim();
    const description = match[3].trim();
    const principlesText = match[4].trim();
    const applicationsText = match[5].trim();
    
    const principles = principlesText.split(/\n\n+/).filter(p => p.trim().length > 0);
    const applications = applicationsText.split(/\n\n+/).filter(a => a.trim().length > 0);
    
    allNewContent[code] = {
      code,
      name,
      description,
      principles,
      applications
    };
  }
}

console.log(`✅ Parsed ${Object.keys(allNewContent).length} models from description files\n`);

// Now update models in readwise-data.ts
let updatedCount = 0;

for (const [code, newContent] of Object.entries(allNewContent)) {
  // Find the model by code (case-insensitive)
  const codePattern = new RegExp(`"code":\\s*"${code}"`, 'gi');
  const matches = [...dataContent.matchAll(codePattern)];
  
  if (matches.length === 0) {
    continue; // Skip if not found
  }
  
  // Use the first match
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
        const modelEnd = i + 1;
        const oldModel = dataContent.substring(modelStart, modelEnd);
        
        // Extract fields we need to preserve
        const idMatch = oldModel.match(/"id": "([^"]+)"/);
        const slugMatch = oldModel.match(/"slug": "([^"]+)"/);
        const domainMatch = oldModel.match(/"domain": "([^"]+)"/);
        const domainSlugMatch = oldModel.match(/"domainSlug": "([^"]+)"/);
        const oldNameMatch = oldModel.match(/"name": "([^"]+)"/);
        
        if (!idMatch || !slugMatch || !domainMatch || !domainSlugMatch || !oldNameMatch) {
          break;
        }
        
        // Check if content actually changed
        const oldDescMatch = oldModel.match(/"description": "([^"]+)"/);
        if (oldDescMatch && oldDescMatch[1].length > 100) {
          // Already has substantial content, skip
          break;
        }
        
        console.log(`📌 Updating ${code}: ${oldNameMatch[1]} → ${newContent.name}`);
        
        // Create the new model
        const escapedDescription = newContent.description.replace(/"/g, '\\"').replace(/\n/g, ' ');
        const escapedName = newContent.name.replace(/"/g, '\\"');
        const escapedPrinciples = newContent.principles.map(p => `      "${p.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`).join(',\n');
        const escapedApplications = newContent.applications.map(a => `      "${a.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`).join(',\n');
        
        const newModel = `  {
    "id": "${idMatch[1]}",
    "code": "${code}",
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
        
        dataContent = dataContent.substring(0, modelStart) + newModel + dataContent.substring(modelEnd);
        updatedCount++;
        console.log(`   ✅ Updated`);
        break;
      }
    }
    
    i++;
  }
}

// Write back
fs.writeFileSync(dataPath, dataContent);

console.log(`\n✅ Successfully updated ${updatedCount} models!\n`);

