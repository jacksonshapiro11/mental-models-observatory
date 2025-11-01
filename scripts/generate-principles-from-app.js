#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate a comprehensive markdown file with all model principles and applications
 * by using the same data loading mechanism as the website
 */

// Use the existing parse functionality that works
function loadModelsFromWebsite() {
  // Import the working parse function
  const { parseAllDomainFiles } = require('../lib/parse-all-domains');
  
  console.log('📖 Loading models using website data parser...');
  const modelHighlights = parseAllDomainFiles();
  
  console.log(`✅ Loaded ${modelHighlights.length} models from domain files`);
  return modelHighlights;
}

function generateMarkdown(models) {
  console.log('📝 Generating markdown...');
  
  // Sort models by title
  const sortedModels = models.sort((a, b) => a.modelTitle.localeCompare(b.modelTitle));
  
  let markdown = `# Mental Models Observatory - Complete Principles & Applications

*Generated from ${sortedModels.length} mental models*

---

## Table of Contents

`;
  
  // Generate table of contents
  sortedModels.forEach((model, index) => {
    const slug = model.modelTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    markdown += `${index + 1}. [${model.modelTitle}](#${slug})\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content for each model
  sortedModels.forEach((model, index) => {
    const slug = model.modelTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${model.modelTitle}\n\n`;
    
    // Model ID for reference
    markdown += `**Model ID:** \`${model.modelId}\`\n\n`;
    
    // Core Principles (using modelDescription as the principle)
    if (model.modelDescription && model.modelDescription.trim()) {
      markdown += `### Core Principles\n\n`;
      markdown += `${model.modelDescription}\n\n`;
    }
    
    // Applications (we'll note that these would come from the full model data)
    markdown += `### Applications\n\n`;
    markdown += `*Applications would be loaded from the full model data structure.*\n\n`;
    
    // Show highlight count
    if (model.curatedHighlights && model.curatedHighlights.length > 0) {
      markdown += `**Supporting Highlights:** ${model.curatedHighlights.length} curated insights\n\n`;
    }
    
    markdown += `---\n\n`;
  });
  
  // Add summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Models with Descriptions:** ${sortedModels.filter(m => m.modelDescription && m.modelDescription.trim()).length}\n`;
  markdown += `- **Models with Highlights:** ${sortedModels.filter(m => m.curatedHighlights && m.curatedHighlights.length > 0).length}\n`;
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*\n`;
  markdown += `*Source: Mental Models Observatory*\n`;
  
  return markdown;
}

function main() {
  try {
    console.log('🚀 Starting principles extraction using website data...');
    
    const models = loadModelsFromWebsite();
    const markdown = generateMarkdown(models);
    
    const outputPath = path.join(__dirname, '..', 'MENTAL_MODELS_PRINCIPLES.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');
    
    console.log(`✅ Successfully generated markdown file: ${outputPath}`);
    console.log(`📄 File size: ${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`📊 Contains ${markdown.split('\n').length} lines`);
    console.log(`🧠 Includes ${models.length} mental models`);
    
    // Show preview of first few lines
    const preview = markdown.split('\n').slice(0, 30).join('\n');
    console.log('\n📖 Preview:\n');
    console.log(preview);
    console.log('\n...\n');
    
  } catch (error) {
    console.error('❌ Error generating markdown:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
