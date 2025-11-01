const fs = require('fs');
const path = require('path');

// Parse the new model descriptions
function parseDescriptionFiles() {
  const descriptionDir = path.join(__dirname, '..', 'Mental Models Description');
  const files = fs.readdirSync(descriptionDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  
  const models = new Map(); // modelCode -> { description, principles, applications }
  
  for (const file of files) {
    console.log(`📖 Reading ${file}...`);
    const filePath = path.join(descriptionDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Split into model sections (starting with ### followed by model code)
    const modelSections = content.split(/\n### /g);
    
    for (const section of modelSections) {
      if (!section.trim()) continue;
      
      // Extract model code (e.g., "1a:", "23b:", etc.)
      const codeMatch = section.match(/^(\d+[a-z]?):/i);
      if (!codeMatch) continue;
      
      const modelCode = codeMatch[1].toUpperCase(); // Use uppercase to match "1A", "2B", etc.
      
      // Extract sections
      const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
      const principlesMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
      const applicationsMatch = section.match(/\*\*Key Applications:\*\*\s*([\s\S]*?)(\n\*\*Related Models:\*\*|$)/);
      
      if (descMatch || principlesMatch || applicationsMatch) {
        models.set(modelCode, {
          description: descMatch ? descMatch[1].trim() : '',
          principles: principlesMatch ? principlesMatch[1].trim() : '',
          applications: applicationsMatch ? applicationsMatch[1].trim() : ''
        });
        console.log(`   ✓ Parsed model ${modelCode}`);
      }
    }
  }
  
  console.log(`\n📚 Parsed ${models.size} models from description files\n`);
  return models;
}

// Escape string for JSON
function escapeForJSON(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Convert paragraph text to array of principles/applications
function paragraphToArray(paragraph) {
  // Split by double newlines (paragraphs) into individual points
  return paragraph
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(p => p.length > 0);
}

// Main migration function
function migrateModels() {
  console.log('🚀 Starting model content migration...\n');
  
  // Step 1: Parse new descriptions
  const newModels = parseDescriptionFiles();
  
  // Step 2: Load existing file
  const readwiseDataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
  let content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Step 3: Update each model
  let updateCount = 0;
  let missingCount = 0;
  const missing = [];
  const updated = [];
  
  // Find each model by its code field and update
  content = content.replace(
    /"code":\s*"([^"]+)"/g,
    (match, code) => {
      const modelCode = code.toUpperCase();
      
      if (newModels.has(modelCode)) {
        // We found a match, but we'll update the fields separately
        // Just mark that we found it
        if (!updated.includes(modelCode)) {
          updated.push(modelCode);
        }
      }
      return match; // Don't change the code field itself
    }
  );
  
  // Now update description, principles, and applications for each found model
  for (const [modelCode, newContent] of newModels.entries()) {
    // Create regex to find this specific model's object
    const modelRegex = new RegExp(
      `("code":\\s*"${modelCode}"[\\s\\S]*?)("description":\\s*"[^"]*")([\\s\\S]*?)("principles":\\s*\\[[^\\]]*\\])([\\s\\S]*?)("applications":\\s*\\[[^\\]]*\\])`,
      'i'
    );
    
    const modelMatch = content.match(modelRegex);
    
    if (modelMatch) {
      console.log(`✏️  Updating model ${modelCode}...`);
      
      // Prepare new values
      const newDesc = escapeForJSON(newContent.description);
      const newPrinciples = paragraphToArray(newContent.principles)
        .map(p => `"${escapeForJSON(p)}"`)
        .join(',\n    ');
      const newApplications = paragraphToArray(newContent.applications)
        .map(p => `"${escapeForJSON(p)}"`)
        .join(',\n    ');
      
      // Replace the matched section
      content = content.replace(
        modelRegex,
        `$1"description": "${newDesc}"$3"principles": [\n    ${newPrinciples}\n  ]$5"applications": [\n    ${newApplications}\n  ]`
      );
      
      updateCount++;
    } else {
      console.log(`⚠️  Could not find model ${modelCode} in file`);
      missing.push(modelCode);
      missingCount++;
    }
  }
  
  // Step 4: Write updated file
  fs.writeFileSync(readwiseDataPath, content, 'utf8');
  
  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Updated: ${updateCount} models`);
  console.log(`⚠️  Missing: ${missingCount} models`);
  
  if (missing.length > 0 && missing.length <= 10) {
    console.log(`\n⚠️  Models not found in file:`);
    missing.forEach(code => console.log(`   - ${code}`));
  }
  
  console.log(`\n✨ Updated file: lib/readwise-data.ts`);
  console.log(`\n🔄 Next steps:`);
  console.log(`   1. Regenerate markdown docs: node scripts/export-all-models-simple.js`);
  console.log(`   2. Test locally: npm run dev`);
  console.log(`   3. Commit and push to deploy`);
}

// Run migration
try {
  migrateModels();
} catch (error) {
  console.error('❌ Error during migration:', error);
  console.error(error.stack);
  process.exit(1);
}
