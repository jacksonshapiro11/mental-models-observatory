const fs = require('fs');
const path = require('path');

// Name mappings for models where description file names don't match readwise-data.ts exactly
const NAME_MAPPINGS = {
  // Case differences
  'Cross-Disciplinary Synthesis & The Best Answer Problem': 'Cross-Disciplinary Synthesis & the Best Answer Problem',
  
  // Different subtitle names
  'Behavioral Economics & Market Psychology': 'Behavioral Economics & Psychological Market Forces',
  'Cultural Evolution & Memetic Theory': 'Cultural Transmission & Memetic Evolution',
  'Language as Thought Constraint': 'Language as Mental Model & Reverse Compression',
  'Signal vs. Noise & Information Filtering': 'Signal vs. Noise & Information Quality',
  'Mind-Body Integration & Physiological Intelligence': 'Mind-Body Integration & Embodied Presence',
  'Consciousness & the Hard Problem': 'The Hard Problem & Consciousness Integration',
  'Affirmations & Identity Reinforcement': 'Identity Affirmation & Conscious Self-Creation',
  'Bricolage & Making Do': 'Resourcefulness & Constraint Navigation',
  'Metis & Local Knowledge': 'Execution & Implementation Mastery',
  'Neuroplasticity & Brain Architecture': 'Neural Networks & Executive Function',
  
  // Add more mappings as needed when discovered
};

// Step 1: Load new content
console.log('📖 Loading new content from Mental Models Description/...\n');

const newContent = new Map();

const files = [
  'mental_models_rewrite_1-7.txt',
  'mental_models_8_24.md',
  'mental_models_25_38.md',
  'mental_models_39_40.md'
];

for (const file of files) {
  const filePath = path.join(__dirname, '..', 'Mental Models Description', file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const sections = content.split(/\n### /);
  
  for (const section of sections) {
    const match = section.match(/^(\d+[a-z]):\s*([^\n]+)/i);
    if (!match) continue;
    
    let name = match[2].trim();
    
    // Apply name mapping if exists
    const mappedName = NAME_MAPPINGS[name];
    if (mappedName) {
      name = mappedName;
    }
    
    const descMatch = section.match(/\*\*Description:\*\*\s*([\s\S]*?)\n\*\*Core Principles:\*\*/);
    const prinMatch = section.match(/\*\*Core Principles:\*\*\s*([\s\S]*?)\n\*\*Key Applications:\*\*/);
    const appMatch = section.match(/\*\*Key Applications:\*\*\s*([\s\S]*?)(\n\*\*Related Models:\*\*|---|\n### |$)/);
    
    newContent.set(name, {
      description: descMatch ? descMatch[1].trim().replace(/\n/g, ' ') : '',
      principles: prinMatch ? prinMatch[1].trim().split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p) : [],
      applications: appMatch ? appMatch[1].trim().split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p) : []
    });
  }
}

console.log(`✅ Loaded ${newContent.size} models with new content\n`);

// Step 2: Process the TypeScript file line by line
console.log('🔄 Updating lib/readwise-data.ts...\n');

const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const lines = fs.readFileSync(dataPath, 'utf8').split('\n');

const output = [];
let currentModelName = null;
let updateCount = 0;
let inArray = false;
let arrayType = null; // 'principles' or 'applications'

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect model name
  const nameMatch = line.match(/"name":\s*"([^"]+)"/);
  if (nameMatch) {
    currentModelName = nameMatch[1];
  }
  
  // If we have a model with new content
  if (currentModelName && newContent.has(currentModelName)) {
    const updated = newContent.get(currentModelName);
    
    // Update description line
    if (line.includes('"description":')) {
      const indent = line.match(/^(\s*)/)[1];
      const escaped = updated.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      output.push(`${indent}"description": "${escaped}",`);
      console.log(`✏️  ${currentModelName}`);
      continue;
    }
    
    // Start of principles array
    if (line.includes('"principles":')) {
      inArray = true;
      arrayType = 'principles';
      const indent = line.match(/^(\s*)/)[1];
      output.push(`${indent}"principles": [`);
      updated.principles.forEach((p, idx) => {
        const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const comma = idx < updated.principles.length - 1 ? ',' : '';
        output.push(`${indent}  "${escaped}"${comma}`);
      });
      continue;
    }
    
    // Start of applications array
    if (line.includes('"applications":')) {
      inArray = true;
      arrayType = 'applications';
      const indent = line.match(/^(\s*)/)[1];
      output.push(`${indent}"applications": [`);
      updated.applications.forEach((p, idx) => {
        const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const comma = idx < updated.applications.length - 1 ? ',' : ''; 
        output.push(`${indent}  "${escaped}"${comma}`);
      });
      continue;
    }
    
    // Skip old array content
    if (inArray) {
      if (line.trim() === '],') {
        output.push(line);
        inArray = false;
        if (arrayType === 'applications') {
          updateCount++;
          currentModelName = null; // Done with this model
        }
        arrayType = null;
      }
      continue;
    }
  }
  
  output.push(line);
}

fs.writeFileSync(dataPath, output.join('\n'), 'utf8');

console.log(`\n✅ Updated ${updateCount} models in lib/readwise-data.ts`);
console.log('\n📋 Next: Test with npm run dev');
