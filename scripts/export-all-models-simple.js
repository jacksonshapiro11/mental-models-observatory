#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Simple approach: Read lib/readwise-data.ts which contains ALL 119 models
 * that power the website, and extract the data to create our markdown
 */

console.log('🚀 Extracting all models from lib/readwise-data.ts (the source of truth)...\n');

const readwiseDataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const content = fs.readFileSync(readwiseDataPath, 'utf8');

// Find the READWISE_MODELS array
const modelsMatch = content.match(/export const READWISE_MODELS: MentalModel\[\] = \[([\s\S]*?)\n\];/);

if (!modelsMatch) {
  console.error('❌ Could not find READWISE_MODELS array');
  process.exit(1);
}

// Extract just the array content and parse it
const modelsArrayContent = '[' + modelsMatch[1] + '\n]';

// Write to a temporary JSON file to parse it properly
const tempFile = path.join(__dirname, '..', 'temp-models.json');
fs.writeFileSync(tempFile, modelsArrayContent);

let models = [];
try {
  models = JSON.parse(modelsArrayContent);
  console.log(`✅ Successfully parsed ${models.length} models from readwise-data.ts\n`);
} catch (error) {
  console.error('❌ Error parsing models:', error.message);
  process.exit(1);
} finally {
  // Clean up temp file
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
}

// Now generate the comprehensive markdown
function generateMarkdown(models) {
  console.log('📝 Generating comprehensive markdown document...\n');
  
  // Sort models by domain then name
  const sortedModels = models.sort((a, b) => {
    if (a.domain !== b.domain) {
      return a.domain.localeCompare(b.domain);
    }
    return a.name.localeCompare(b.name);
  });
  
  // Group by domain
  const modelsByDomain = {};
  sortedModels.forEach(model => {
    if (!modelsByDomain[model.domain]) {
      modelsByDomain[model.domain] = [];
    }
    modelsByDomain[model.domain].push(model);
  });
  
  let markdown = `# Mental Models Observatory - Complete Reference Guide

*Comprehensive documentation of ${sortedModels.length} mental models across ${Object.keys(modelsByDomain).length} domains*

---

## Table of Contents

`;
  
  // Generate table of contents by domain
  Object.keys(modelsByDomain).sort().forEach((domain, index) => {
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    markdown += `${index + 1}. [${domain}](#${domainSlug}) - ${modelsByDomain[domain].length} models\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content for each domain
  Object.keys(modelsByDomain).sort().forEach(domain => {
    const domainModels = modelsByDomain[domain];
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${domain}\n\n`;
    markdown += `*${domainModels.length} mental model${domainModels.length !== 1 ? 's' : ''}*\n\n`;
    
    domainModels.forEach((model, index) => {
      markdown += `### ${model.name}\n\n`;
      
      // Model metadata
      markdown += `**Model ID:** \`${model.id}\`  \n`;
      markdown += `**Slug:** \`${model.slug}\`  \n`;
      if (model.difficulty) {
        const difficultyEmoji = {
          'beginner': '🟢',
          'intermediate': '🟡', 
          'advanced': '🔴'
        };
        markdown += `**Difficulty:** ${difficultyEmoji[model.difficulty] || '⚪'} ${model.difficulty}  \n`;
      }
      markdown += `\n`;
      
      // Description
      if (model.description) {
        markdown += `#### Description\n\n${model.description}\n\n`;
      }
      
      // Core Principles
      if (model.principles && model.principles.length > 0) {
        markdown += `#### Core Principles\n\n`;
        model.principles.forEach((principle, pIndex) => {
          markdown += `${pIndex + 1}. ${principle}\n\n`;
        });
      }
      
      // Examples
      if (model.examples && model.examples.length > 0) {
        markdown += `#### Examples\n\n`;
        model.examples.forEach((example, eIndex) => {
          markdown += `${eIndex + 1}. ${example}\n\n`;
        });
      }
      
      // Applications
      if (model.applications && model.applications.length > 0) {
        markdown += `#### Applications\n\n`;
        model.applications.forEach((application, aIndex) => {
          markdown += `${aIndex + 1}. ${application}\n\n`;
        });
      }
      
      // Tags
      if (model.tags && model.tags.length > 0) {
        markdown += `**Tags:** ${model.tags.join(', ')}\n\n`;
      }
      
      markdown += `---\n\n`;
    });
  });
  
  // Add comprehensive summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `### Overall\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Total Domains:** ${Object.keys(modelsByDomain).length}\n`;
  markdown += `- **Models with Descriptions:** ${sortedModels.filter(m => m.description && m.description.trim()).length}\n`;
  markdown += `- **Models with Principles:** ${sortedModels.filter(m => m.principles && m.principles.length > 0).length}\n`;
  markdown += `- **Models with Examples:** ${sortedModels.filter(m => m.examples && m.examples.length > 0).length}\n`;
  markdown += `- **Models with Applications:** ${sortedModels.filter(m => m.applications && m.applications.length > 0).length}\n`;
  
  // Domain breakdown
  markdown += `\n### Models by Domain\n\n`;
  Object.keys(modelsByDomain).sort().forEach(domain => {
    const count = modelsByDomain[domain].length;
    markdown += `- **${domain}:** ${count} model${count !== 1 ? 's' : ''}\n`;
  });
  
  // Difficulty breakdown
  const difficultyCounts = sortedModels.reduce((acc, model) => {
    if (model.difficulty) {
      acc[model.difficulty] = (acc[model.difficulty] || 0) + 1;
    }
    return acc;
  }, {});
  
  if (Object.keys(difficultyCounts).length > 0) {
    markdown += `\n### Models by Difficulty\n\n`;
    Object.keys(difficultyCounts).sort().forEach(difficulty => {
      const count = difficultyCounts[difficulty];
      const emoji = {
        'beginner': '🟢',
        'intermediate': '🟡',
        'advanced': '🔴'
      };
      markdown += `- ${emoji[difficulty] || '⚪'} **${difficulty}:** ${count} model${count !== 1 ? 's' : ''}\n`;
    });
  }
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*  \n`;
  markdown += `*Source: lib/readwise-data.ts (Mental Models Observatory)*\n`;
  
  return markdown;
}

const markdown = generateMarkdown(models);

const outputPath = path.join(__dirname, '..', 'MENTAL_MODELS_COMPLETE.md');
fs.writeFileSync(outputPath, markdown, 'utf8');

console.log(`✅ Successfully generated complete markdown reference!\n`);
console.log(`📄 File: ${outputPath}`);
console.log(`📊 Size: ${(markdown.length / 1024).toFixed(2)} KB`);
console.log(`📏 Lines: ${markdown.split('\n').length.toLocaleString()}`);
console.log(`🧠 Models: ${models.length}`);
console.log(`\n✨ All done! Your complete mental models reference is ready.`);

