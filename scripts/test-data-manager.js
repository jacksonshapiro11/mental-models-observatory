#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple test to verify the standardized data
function testStandardizedData() {
  console.log('🧪 Testing standardized data...');
  
  const dataPath = path.join(__dirname, '..', 'data', 'domains');
  
  if (!fs.existsSync(dataPath)) {
    console.error('❌ Data directory not found');
    return;
  }
  
  const files = fs.readdirSync(dataPath)
    .filter(file => file.endsWith('.md'))
    .sort();
  
  console.log(`📁 Found ${files.length} domain group files:`);
  
  let totalModels = 0;
  let totalDomains = 0;
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(dataPath, file), 'utf8');
    const jsonBlocks = extractJsonBlocks(content);
    
    const domainMatches = content.match(/## Domain (\d+):/g);
    const domainsInFile = domainMatches ? domainMatches.length : 0;
    
    console.log(`  📄 ${file}: ${jsonBlocks.length} models, ${domainsInFile} domains`);
    totalModels += jsonBlocks.length;
    totalDomains += domainsInFile;
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total models: ${totalModels}`);
  console.log(`  Total domains: ${totalDomains}`);
  console.log(`  Average models per domain: ${(totalModels / totalDomains).toFixed(1)}`);
  
  // Check summary.json
  const summaryPath = path.join(dataPath, 'summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log(`\n📋 Summary from summary.json:`);
    console.log(`  Total models: ${summary.totalModels}`);
    console.log(`  Domains with models: ${summary.domainsWithModels}`);
    console.log(`  Missing domains: ${summary.missingDomains.length}`);
    
    console.log(`\n🔍 Missing domains: ${summary.missingDomains.join(', ')}`);
  }
  
  console.log('\n✅ Data standardization test complete!');
}

function extractJsonBlocks(content) {
  const jsonBlocks = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      jsonBlocks.push(jsonData);
    } catch (error) {
      console.warn('Failed to parse JSON block:', error.message);
    }
  }
  
  return jsonBlocks;
}

if (require.main === module) {
  testStandardizedData();
}
