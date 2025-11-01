const fs = require('fs');
const path = require('path');

// Read the main data file
const readwiseDataPath = path.join(__dirname, '../lib/readwise-data.ts');
const content = fs.readFileSync(readwiseDataPath, 'utf8');

// Extract READWISE_MODELS array
const modelsMatch = content.match(/export const READWISE_MODELS[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!modelsMatch) {
  console.error('Could not find READWISE_MODELS in readwise-data.ts');
  process.exit(1);
}

const modelsArray = eval(modelsMatch[1]);

console.log(`\n📊 Testing ${modelsArray.length} models...\n`);

const issues = [];
const warnings = [];

modelsArray.forEach((model, index) => {
  const num = index + 1;
  
  // Check required fields
  if (!model.name) {
    issues.push(`❌ Model ${num} (${model.id}): Missing name`);
  }
  if (!model.description) {
    issues.push(`❌ Model ${num} (${model.id}): Missing description`);
  }
  if (!model.slug) {
    issues.push(`❌ Model ${num} (${model.id}): Missing slug`);
  }
  
  // Check principles
  if (!model.principles || model.principles.length === 0) {
    warnings.push(`⚠️  Model ${num} (${model.name}): No principles`);
  }
  
  // Check applications
  if (!model.applications || model.applications.length === 0) {
    warnings.push(`⚠️  Model ${num} (${model.name}): No applications`);
  }
  
  // Check examples
  if (!model.examples || model.examples.length === 0) {
    warnings.push(`⚠️  Model ${num} (${model.name}): No examples (this is expected)`);
  }
});

console.log(`\n✅ CRITICAL ISSUES: ${issues.length}`);
if (issues.length > 0) {
  issues.forEach(issue => console.log(issue));
}

console.log(`\n⚠️  WARNINGS: ${warnings.length}`);
if (warnings.length > 0) {
  const exampleWarnings = warnings.filter(w => w.includes('examples'));
  const otherWarnings = warnings.filter(w => !w.includes('examples'));
  
  if (otherWarnings.length > 0) {
    console.log('\nNon-example warnings:');
    otherWarnings.forEach(warning => console.log(warning));
  }
  
  console.log(`\n(${exampleWarnings.length} models have no examples - this is expected)`);
}

console.log(`\n✅ Total models: ${modelsArray.length}`);
console.log(`✅ Models with principles: ${modelsArray.filter(m => m.principles && m.principles.length > 0).length}`);
console.log(`✅ Models with applications: ${modelsArray.filter(m => m.applications && m.applications.length > 0).length}`);

// Check for duplicate slugs
const slugs = modelsArray.map(m => m.slug);
const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
if (duplicateSlugs.length > 0) {
  console.log(`\n❌ DUPLICATE SLUGS FOUND:`);
  duplicateSlugs.forEach(slug => console.log(`   - ${slug}`));
}

console.log('\n✅ All models loaded successfully!\n');



