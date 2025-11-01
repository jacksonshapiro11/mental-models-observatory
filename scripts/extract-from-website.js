#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extract all model principles and applications from the running website
 * by fetching data from http://localhost:3000/models and individual model pages
 */

async function fetchModelsFromWebsite() {
  console.log('🌐 Fetching models from running website...');
  
  try {
    // First, get the list of all models from the models page
    const modelsResponse = await fetch('http://localhost:3000/api/models');
    if (!modelsResponse.ok) {
      throw new Error(`Failed to fetch models: ${modelsResponse.status}`);
    }
    
    const models = await modelsResponse.json();
    console.log(`✅ Found ${models.length} models from API`);
    
    return models;
  } catch (error) {
    console.error('❌ Error fetching from API:', error);
    
    // Fallback: try to use the existing data loading mechanism
    console.log('🔄 Falling back to local data...');
    return loadFromLocalData();
  }
}

function loadFromLocalData() {
  // Use the same approach as the website uses
  const { getAllModels } = require('../lib/data');
  
  console.log('📖 Loading models from local data...');
  const models = getAllModels();
  console.log(`✅ Loaded ${models.length} models from local data`);
  
  return models;
}

function generateMarkdown(models) {
  console.log('📝 Generating markdown...');
  
  // Sort models by domain and name
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
  
  let markdown = `# Mental Models Observatory - Complete Principles & Applications

*Generated from ${sortedModels.length} mental models across ${Object.keys(modelsByDomain).length} domains*

---

## Table of Contents

`;
  
  // Generate table of contents
  Object.keys(modelsByDomain).sort().forEach((domain, index) => {
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    markdown += `${index + 1}. [${domain}](#${domainSlug}) (${modelsByDomain[domain].length} models)\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content for each domain
  Object.keys(modelsByDomain).sort().forEach(domain => {
    const domainModels = modelsByDomain[domain];
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${domain}\n\n`;
    markdown += `*${domainModels.length} mental model${domainModels.length !== 1 ? 's' : ''}*\n\n`;
    
    domainModels.forEach((model, index) => {
      markdown += `### ${index + 1}. ${model.name}\n\n`;
      
      // Add difficulty level if available
      if (model.difficulty) {
        const difficultyEmoji = {
          'beginner': '🟢',
          'intermediate': '🟡', 
          'advanced': '🔴'
        };
        markdown += `**Difficulty:** ${difficultyEmoji[model.difficulty] || '⚪'} ${model.difficulty}\n\n`;
      }
      
      // Core Principles
      if (model.principles && model.principles.length > 0) {
        markdown += `#### Core Principles\n\n`;
        model.principles.forEach((principle, pIndex) => {
          markdown += `${pIndex + 1}. ${principle}\n\n`;
        });
      }
      
      // Applications
      if (model.applications && model.applications.length > 0) {
        markdown += `#### Applications\n\n`;
        model.applications.forEach((application, aIndex) => {
          markdown += `${aIndex + 1}. ${application}\n\n`;
        });
      }
      
      // Add tags if available
      if (model.tags && model.tags.length > 0) {
        markdown += `**Tags:** ${model.tags.join(', ')}\n\n`;
      }
      
      markdown += `---\n\n`;
    });
  });
  
  // Add summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Total Domains:** ${Object.keys(modelsByDomain).length}\n`;
  markdown += `- **Models with Principles:** ${sortedModels.filter(m => m.principles && m.principles.length > 0).length}\n`;
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
      markdown += `- **${emoji[difficulty] || '⚪'} ${difficulty}:** ${count} model${count !== 1 ? 's' : ''}\n`;
    });
  }
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*\n`;
  markdown += `*Source: Mental Models Observatory - http://localhost:3000/models*\n`;
  
  return markdown;
}

async function main() {
  try {
    console.log('🚀 Starting extraction from website...');
    
    const models = await fetchModelsFromWebsite();
    
    if (models.length === 0) {
      console.log('❌ No models found.');
      return;
    }
    
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
