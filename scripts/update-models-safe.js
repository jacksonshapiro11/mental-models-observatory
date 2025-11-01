const fs = require('fs');
const path = require('path');

// Parse the new model descriptions
function parseDescriptionFiles() {
  const descriptionDir = path.join(__dirname, '..', 'Mental Models Description');
  const files = fs.readdirSync(descriptionDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  
  const models = new Map();
  
  for (const file of files) {
    console.log(`📖 Reading ${file}...`);
    const filePath = path.join(descriptionDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const modelSections = content.split(/\n### /g);
    
    for (const section of modelSections) {
      if (!section.trim()) continue;
      
      const codeMatch = section.match(/^(\d+[a-z]?):/i);
      if (!codeMatch) continue;
      
      const modelCode = codeMatch[1].toUpperCase();
      
      const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
      const principlesMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
      const applicationsMatch = section.match(/\*\*Key Applications:\*\*\s*([\s\S]*?)(\n\*\*Related Models:\*\*|$)/);
      
      if (descMatch || principlesMatch || applicationsMatch) {
        models.set(modelCode, {
          description: descMatch ? descMatch[1].trim() : '',
          principles: principlesMatch ? principlesMatch[1].trim() : '',
          applications: applicationsMatch ? applicationsMatch[1].trim() : ''
        });
      }
    }
  }
  
  console.log(`\n📚 Parsed ${models.size} models\n`);
  return models;
}

// Convert paragraph to array
function paragraphToArray(paragraph) {
  return paragraph
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 0);
}

// Main migration
function migrateModels() {
  console.log('🚀 Starting safe migration...\n');
  
  const newModels = parseDescriptionFiles();
  
  const readwiseDataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
  const lines = fs.readFileSync(readwiseDataPath, 'utf8').split('\n');
  
  let currentModel = null;
  let updateCount = 0;
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect model code
    const codeMatch = line.match(/"code":\s*"([^"]+)"/);
    if (codeMatch) {
      currentModel = codeMatch[1].toUpperCase();
    }
    
    // If we're in a model that needs updating
    if (currentModel && newModels.has(currentModel)) {
      const newContent = newModels.get(currentModel);
      
      // Replace description line
      if (line.includes('"description":')) {
        const indent = line.match(/^(\s*)/)[1];
        const newDesc = newContent.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        result.push(`${indent}"description": "${newDesc}",`);
        console.log(`✏️  Updated description for ${currentModel}`);
        continue;
      }
      
      // Replace principles array
      if (line.includes('"principles":')) {
        const indent = line.match(/^(\s*)/)[1];
        const principles = paragraphToArray(newContent.principles);
        result.push(`${indent}"principles": [`);
        principles.forEach((p, idx) => {
          const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const comma = idx < principles.length - 1 ? ',' : '';
          result.push(`${indent}  "${escaped}"${comma}`);
        });
        result.push(`${indent}],`);
        
        // Skip old principles array
        let bracketCount = 1;
        i++;
        while (i < lines.length && bracketCount > 0) {
          if (lines[i].includes('[')) bracketCount++;
          if (lines[i].includes(']')) bracketCount--;
          i++;
        }
        i--; // Back up one since loop will increment
        continue;
      }
      
      // Replace applications array
      if (line.includes('"applications":')) {
        const indent = line.match(/^(\s*)/)[1];
        const applications = paragraphToArray(newContent.applications);
        result.push(`${indent}"applications": [`);
        applications.forEach((p, idx) => {
          const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const comma = idx < applications.length - 1 ? ',' : '';
          result.push(`${indent}  "${escaped}"${comma}`);
        });
        result.push(`${indent}],`);
        
        // Skip old applications array
        let bracketCount = 1;
        i++;
        while (i < lines.length && bracketCount > 0) {
          if (lines[i].includes('[')) bracketCount++;
          if (lines[i].includes(']')) bracketCount--;
          i++;
        }
        i--; // Back up one
        
        updateCount++;
        currentModel = null; // Done with this model
        continue;
      }
    }
    
    result.push(line);
  }
  
  fs.writeFileSync(readwiseDataPath, result.join('\n'), 'utf8');
  
  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Updated: ${updateCount} models`);
  console.log(`\n✨ File updated: lib/readwise-data.ts`);
}

try {
  migrateModels();
} catch (error) {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
}


