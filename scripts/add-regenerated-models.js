const fs = require('fs');
const path = require('path');

/**
 * Add the 9 regenerated models from regenerated_models_missing.md
 * as NEW models with new codes (e.g., 13C, 14C, etc.)
 */

console.log('📝 Adding regenerated models to lib/readwise-data.ts...\n');

// Load the regenerated models file
const regenPath = path.join(__dirname, '..', 'Mental Models Description', 'regenerated_models_missing.md');
const regenContent = fs.readFileSync(regenPath, 'utf8');

// Parse the regenerated models
const models = [];
const modelSections = regenContent.split(/###\s+\d+[A-Z]:/);

for (let i = 1; i < modelSections.length; i++) {
  const section = modelSections[i];
  
  // Extract code from the section
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
  
  // Extract related models
  const relMatch = section.match(/\*\*Related Models:\*\*\s*([^\n]+)/);
  const relatedModels = relMatch ? relMatch[1].split(',').map(m => m.trim()) : [];
  
  // Map old codes to new codes (add one letter)
  const codeMapping = {
    '13B': '13C',
    '14B': '14C',
    '15C': '15D',
    '18A': '18E',
    '18D': '18F',
    '19C': '19D',
    '20B': '20E',
    '20C': '20F',
    '20D': '20G'
  };
  
  const newCode = codeMapping[lastCode] || lastCode;
  
  // Get domain info
  const domainMap = {
    '13': { name: 'Cultural Anthropology & Social Identity', slug: 'cultural-anthropology-social-identity' },
    '14': { name: 'Language & Communication Systems', slug: 'language-communication-systems' },
    '15': { name: 'Information Theory & Media Ecology', slug: 'information-theory-media-ecology' },
    '18': { name: 'Relationships & Human Connection', slug: 'relationships-human-connection' },
    '19': { name: 'Health & Human Optimization', slug: 'health-human-optimization' },
    '20': { name: 'Mindfulness & Inner Work', slug: 'mindfulness-inner-work' }
  };
  
  const domainNum = lastCode.match(/^\d+/)[0];
  const domain = domainMap[domainNum];
  
  if (!domain) continue;
  
  // Create slug from name
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  models.push({
    code: newCode,
    name,
    description,
    slug,
    domain: domain.name,
    domainSlug: domain.slug,
    principles,
    applications,
    relatedModels
  });
}

console.log(`✅ Parsed ${models.length} models from regenerated_models_missing.md\n`);

// Display what we're adding
for (const model of models) {
  console.log(`📌 CODE ${model.code}: ${model.name}`);
  console.log(`   Slug: ${model.slug}`);
  console.log(`   Domain: ${model.domain}`);
  console.log(`   Principles: ${model.principles.length}`);
  console.log(`   Applications: ${model.applications.length}\n`);
}

console.log('\n📝 Models ready to add. Next step: manually add to lib/readwise-data.ts');
console.log('   OR run the update script to insert them automatically.\n');

// Save the parsed models to a JSON file for easy insertion
const outputPath = path.join(__dirname, '..', 'regenerated-models-parsed.json');
fs.writeFileSync(outputPath, JSON.stringify(models, null, 2));
console.log(`✅ Saved parsed models to: regenerated-models-parsed.json\n`);


