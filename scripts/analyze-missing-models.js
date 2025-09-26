const fs = require('fs');
const path = require('path');

const readwiseDir = path.join(process.cwd(), 'Readwise website notes');

function countModelsInFile(filePath, fileName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Count different patterns that indicate models
    let modelCount = 0;
    
    // For JSON files or JSON-like content
    const modelIdMatches = content.match(/"modelId"\s*:/g);
    if (modelIdMatches) {
      modelCount += modelIdMatches.length;
      console.log(`${fileName}: ${modelIdMatches.length} models (found "modelId" patterns)`);
      return modelIdMatches.length;
    }
    
    // For markdown files with ### sections
    const sectionMatches = content.match(/### \d+[A-Z]:/g);
    if (sectionMatches) {
      modelCount += sectionMatches.length;
      console.log(`${fileName}: ${sectionMatches.length} models (found ### section patterns)`);
      return sectionMatches.length;
    }
    
    // For other patterns
    const jsonBlockMatches = content.match(/```json/g);
    if (jsonBlockMatches) {
      modelCount += jsonBlockMatches.length;
      console.log(`${fileName}: ${jsonBlockMatches.length} models (found JSON blocks)`);
      return jsonBlockMatches.length;
    }
    
    console.log(`${fileName}: 0 models (no recognizable patterns found)`);
    return 0;
    
  } catch (error) {
    console.error(`Error reading ${fileName}:`, error.message);
    return 0;
  }
}

function analyzeAllFiles() {
  console.log('=== ANALYZING EXPECTED MODEL COUNTS ===\n');
  
  const files = fs.readdirSync(readwiseDir);
  let totalExpected = 0;
  
  for (const file of files) {
    if (file.startsWith('.')) continue;
    
    const filePath = path.join(readwiseDir, file);
    const count = countModelsInFile(filePath, file);
    totalExpected += count;
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total expected models: ${totalExpected}`);
  
  // Get current parsed count
  try {
    const response = require('child_process').execSync('curl -s http://localhost:3000/api/readwise/debug', { encoding: 'utf8' });
    const data = JSON.parse(response);
    console.log(`Currently parsed models: ${data.totalModels}`);
    console.log(`Missing models: ${totalExpected - data.totalModels}`);
  } catch (error) {
    console.log('Could not fetch current parsed count from API');
  }
}

analyzeAllFiles();
