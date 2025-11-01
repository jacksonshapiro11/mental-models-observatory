const fs = require('fs');
const path = require('path');

/**
 * Verify that models with matching substance are correctly mapped
 * and displaying the new content on the website
 */

console.log('🔍 Verifying mappings for models with matching substance...\n');

// Load readwise-data.ts
const dataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const dataContent = fs.readFileSync(dataPath, 'utf8');

// Models we identified as having matching substance
const modelsToCheck = [
  { code: '13B', oldName: 'Social Reality Construction & Collective Belief', newName: 'Social Identity & Group Belonging' },
  { code: '18A', oldName: 'Love as Nuclear Fuel & Life Foundation', newName: 'Quality vs. Quantity in Relationships' },
  { code: '18D', oldName: 'Compounding Human Connections', newName: 'Attachment & Interdependence' },
  { code: '19C', oldName: 'Physiological States & Decision Quality', newName: 'Sleep, Nutrition, & Movement as Foundation' },
  { code: '20B', oldName: 'Mind-Body Integration & Embodied Presence', newName: 'Acceptance vs. Resistance' },
  { code: '20C', oldName: 'Deconstructing Mental Patterns & Pain Body', newName: 'Meditation & Contemplative Practice' },
  { code: '20D', oldName: 'Transcending Ego & Two-Selves Integration', newName: 'Non-Attachment & Letting Go' }
];

// Extract model by code
function getModelByCode(code) {
  const regex = new RegExp(`"code":\\s*"${code}"[\\s\\S]*?}(?=\\s*(?:,\\s*\\{)|(?:\\s*\\]))`, 'g');
  const match = dataContent.match(regex);
  if (!match) return null;
  
  try {
    // Extract key fields
    const nameMatch = match[0].match(/"name":\s*"([^"]+)"/);
    const descMatch = match[0].match(/"description":\s*"([^"]+)"/);
    const slugMatch = match[0].match(/"slug":\s*"([^"]+)"/);
    
    return {
      code,
      name: nameMatch ? nameMatch[1] : '',
      description: descMatch ? descMatch[1].substring(0, 150) : '',
      slug: slugMatch ? slugMatch[1] : ''
    };
  } catch (e) {
    return null;
  }
}

console.log('📊 Current State in lib/readwise-data.ts:\n');
console.log('='.repeat(80));

for (const model of modelsToCheck) {
  const current = getModelByCode(model.code);
  
  if (!current) {
    console.log(`\n❌ CODE ${model.code}: NOT FOUND`);
    continue;
  }
  
  console.log(`\n✅ CODE ${model.code}:`);
  console.log(`   Current Name: "${current.name}"`);
  console.log(`   Expected NEW Name: "${model.newName}"`);
  console.log(`   Slug: ${current.slug}`);
  console.log(`   Description Preview: ${current.description}...`);
  
  // Check if name matches OLD or NEW
  if (current.name === model.oldName) {
    console.log(`   ⚠️  Name still OLD - needs update to "${model.newName}"`);
  } else if (current.name === model.newName || current.name.includes(model.newName.split(' ')[0])) {
    console.log(`   ✅ Name matches NEW content`);
  } else {
    console.log(`   ℹ️  Name differs: "${current.name}" (could be updated)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Verification complete!\n');


