#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate a comprehensive markdown file with all model principles and applications
 */

function loadModelsData() {
  // Use the existing parse-all-domains functionality
  const { parseAllDomainFiles } = require('../lib/parse-all-domains');
  
  console.log('📖 Parsing domain files...');
  const modelHighlights = parseAllDomainFiles();
  
  // Convert to the format we need
  const models = modelHighlights.map(model => ({
    id: model.modelId,
    name: model.modelTitle || model.modelId,
    slug: model.modelId,
    description: model.modelDescription || '',
    domain: 'Unknown Domain', // We'll need to determine this
    domainSlug: 'unknown',
    principles: model.modelDescription ? [model.modelDescription] : [],
    examples: [],
    applications: [],
    relatedModels: [],
    sources: [],
    tags: [],
    difficulty: 'intermediate',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  return models;
}

function generateMarkdown() {
  console.log('🔍 Extracting model data...');
  
  const READWISE_MODELS = loadModelsData();
  
  // Sort models by domain and name for better organization
  const sortedModels = READWISE_MODELS.sort((a, b) => {
    // First sort by domain
    if (a.domain !== b.domain) {
      return a.domain.localeCompare(b.domain);
    }
    // Then by name within domain
    return a.name.localeCompare(b.name);
  });
  
  console.log(`📊 Found ${sortedModels.length} models across ${new Set(sortedModels.map(m => m.domain)).size} domains`);
  
  // Group models by domain for better organization
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
    markdown += `${index + 1}. [${domain}](#${domainSlug})\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content for each domain
  Object.keys(modelsByDomain).sort().forEach(domain => {
    const models = modelsByDomain[domain];
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${domain}\n\n`;
    markdown += `*${models.length} mental model${models.length !== 1 ? 's' : ''}*\n\n`;
    
    models.forEach((model, index) => {
      markdown += `### ${index + 1}. ${model.name}\n\n`;
      
      // Add difficulty level
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
      } else {
        markdown += `#### Core Principles\n\n*No principles defined for this model.*\n\n`;
      }
      
      // Applications
      if (model.applications && model.applications.length > 0) {
        markdown += `#### Applications\n\n`;
        model.applications.forEach((application, aIndex) => {
          markdown += `${aIndex + 1}. ${application}\n\n`;
        });
      } else {
        markdown += `#### Applications\n\n*No applications defined for this model.*\n\n`;
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
    acc[model.difficulty] = (acc[model.difficulty] || 0) + 1;
    return acc;
  }, {});
  
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
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*\n`;
  
  return markdown;
}

function main() {
  try {
    console.log('🚀 Starting markdown generation...');
    
    const markdown = generateMarkdown();
    
    const outputPath = path.join(__dirname, '..', 'MENTAL_MODELS_PRINCIPLES.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');
    
    console.log(`✅ Successfully generated markdown file: ${outputPath}`);
    console.log(`📄 File size: ${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`📊 Contains ${markdown.split('\n').length} lines`);
    
    // Show preview of first few lines
    const preview = markdown.split('\n').slice(0, 20).join('\n');
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

module.exports = { generateMarkdown };
