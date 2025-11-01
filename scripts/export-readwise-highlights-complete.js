#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Complete approach: Extract highlights from Readwise notes and match them
 * to the models in readwise-data.ts using the slug mapping system
 */

console.log('🚀 Extracting highlights and matching to all 119 models...\n');

// Step 1: Load all 119 models from readwise-data.ts
const readwiseDataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
const readwiseContent = fs.readFileSync(readwiseDataPath, 'utf8');

const modelsMatch = readwiseContent.match(/export const READWISE_MODELS: MentalModel\[\] = \[([\s\S]*?)\n\];/);
if (!modelsMatch) {
  console.error('❌ Could not find READWISE_MODELS');
  process.exit(1);
}

const modelsArrayContent = '[' + modelsMatch[1] + '\n]';
const allModels = JSON.parse(modelsArrayContent);

console.log(`✅ Loaded ${allModels.length} models from readwise-data.ts\n`);

// Step 2: Parse highlights from Readwise notes (using existing logic)
const readwiseDir = path.join(__dirname, '..', 'Readwise website notes');

function parseMarkdownFileForHighlights(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  
  const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
  
  if (jsonMatches && jsonMatches.length > 0) {
    for (const jsonMatch of jsonMatches) {
      try {
        let jsonContent = jsonMatch
          .replace(/```json\n/, '')
          .replace(/\n```/, '')
          .trim()
          .replace(/^\s*\/\/.*$/gm, '');
        
        const modelData = JSON.parse(jsonContent);
        
        if (modelData.modelId && modelData.curatedHighlights) {
          models.push({
            modelId: modelData.modelId,
            modelTitle: modelData.modelTitle,
            modelDescription: modelData.modelDescription,
            curatedHighlights: modelData.curatedHighlights
          });
        }
      } catch (error) {
        // Skip malformed JSON
      }
    }
  }
  
  return models;
}

const highlightsMap = new Map();

try {
  const files = fs.readdirSync(readwiseDir);
  
  for (const file of files) {
    if (file.startsWith('.')) continue;
    
    const filePath = path.join(readwiseDir, file);
    const ext = path.extname(file).toLowerCase();
    
    try {
      let models = [];
      
      // Check if it's a pure JSON file (even with .md extension)
      const content = fs.readFileSync(filePath, 'utf8').trim();
      
      if (content.startsWith('[') || content.startsWith('{')) {
        // Parse as pure JSON
        const jsonData = JSON.parse(content);
        
        if (Array.isArray(jsonData)) {
          models = jsonData;
        } else if (typeof jsonData === 'object') {
          // Handle nested structure like { "domain9": {...}, "domain10": {...} }
          for (const [key, value] of Object.entries(jsonData)) {
            if (value && typeof value === 'object' && value.modelId) {
              models.push(value);
            }
          }
          
          // If no nested models found, treat the whole object as one model
          if (models.length === 0 && jsonData.modelId) {
            models = [jsonData];
          }
        }
        
        if (models.length > 0) {
          console.log(`  ✅ Loaded ${models.length} models from JSON file: ${file}`);
        }
      } else if (ext === '.md') {
        // Parse markdown with JSON blocks
        models = parseMarkdownFileForHighlights(filePath);
        if (models.length > 0) {
          console.log(`  ✅ Loaded ${models.length} models from markdown: ${file}`);
        }
      }
      
      models.forEach(model => {
        if (model.modelId) {
          highlightsMap.set(model.modelId, model);
        }
      });
    } catch (error) {
      console.error(`  ❌ Error parsing ${file}:`, error.message);
    }
  }
  
  console.log(`\n✅ Total: Loaded highlights for ${highlightsMap.size} models from Readwise notes\n`);
  
} catch (error) {
  console.error('Error reading Readwise directory:', error);
}

// Step 3: Load the slug mapping from the website's code
const slugMappingPath = path.join(__dirname, '..', 'lib', 'parse-all-domains.ts');
const slugMappingContent = fs.readFileSync(slugMappingPath, 'utf8');

// Extract the MODEL_SLUG_MAPPINGS object
const mappingMatch = slugMappingContent.match(/const MODEL_SLUG_MAPPINGS: \{ \[key: string\]: string \} = \{([\s\S]*?)\};/);
let slugToIdMap = {};

if (mappingMatch) {
  // Parse the mapping (simple extraction of key-value pairs)
  const mappingText = mappingMatch[1];
  const mappingLines = mappingText.split('\n');
  
  mappingLines.forEach(line => {
    const match = line.match(/'([^']+)':\s*'([^']+)'/);
    if (match) {
      slugToIdMap[match[1]] = match[2];
    }
  });
  
  console.log(`✅ Loaded ${Object.keys(slugToIdMap).length} slug mappings from parse-all-domains.ts\n`);
}

// Step 3: Match models with highlights using the SAME logic as the website
function findHighlightsForModel(model) {
  // Use the slug (this is what the website uses!)
  const slug = model.slug;
  
  // Apply the same mapping logic as the website
  const mappedId = slugToIdMap[slug] || slug;
  
  // Look up highlights using the mapped ID
  if (highlightsMap.has(mappedId)) {
    return highlightsMap.get(mappedId);
  }
  
  // Fallback: try the original slug
  if (highlightsMap.has(slug)) {
    return highlightsMap.get(slug);
  }
  
  // Fallback: try the model ID
  if (highlightsMap.has(model.id)) {
    return highlightsMap.get(model.id);
  }
  
  return null;
}

// Step 4: Generate markdown with all 119 models
function generateMarkdown(allModels, highlightsMap) {
  console.log('📝 Generating complete highlights document...\n');
  
  const sortedModels = allModels.sort((a, b) => {
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
  
  let modelsWithHighlights = 0;
  let totalHighlights = 0;
  
  sortedModels.forEach(model => {
    const highlights = findHighlightsForModel(model);
    if (highlights && highlights.curatedHighlights.length > 0) {
      modelsWithHighlights++;
      totalHighlights += highlights.curatedHighlights.length;
    }
  });
  
  let markdown = `# Mental Models Observatory - Complete Readwise Highlights Collection

*All ${sortedModels.length} mental models with ${totalHighlights.toLocaleString()} curated insights from Readwise*

**Coverage:** ${modelsWithHighlights} models have highlights, ${sortedModels.length - modelsWithHighlights} models pending curation

---

## Table of Contents

`;
  
  // Table of contents by domain
  Object.keys(modelsByDomain).sort().forEach((domain, index) => {
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const count = modelsByDomain[domain].length;
    markdown += `${index + 1}. [${domain}](#${domainSlug}) - ${count} models\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content
  Object.keys(modelsByDomain).sort().forEach(domain => {
    const domainModels = modelsByDomain[domain];
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${domain}\n\n`;
    markdown += `*${domainModels.length} models*\n\n`;
    
    domainModels.forEach((model, index) => {
      markdown += `### ${model.name}\n\n`;
      markdown += `**Model ID:** \`${model.id}\`  \n`;
      markdown += `**Slug:** \`${model.slug}\`  \n`;
      
      const highlights = findHighlightsForModel(model);
      
      if (highlights && highlights.curatedHighlights.length > 0) {
        markdown += `**Highlights:** ${highlights.curatedHighlights.length}\n\n`;
        
        if (highlights.modelDescription) {
          markdown += `#### Description\n\n${highlights.modelDescription}\n\n`;
        }
        
        markdown += `#### Curated Highlights\n\n`;
        
        const sortedHighlights = [...highlights.curatedHighlights].sort((a, b) => 
          (b.relevanceScore || 0) - (a.relevanceScore || 0)
        );
        
        sortedHighlights.forEach((highlight, hIndex) => {
          markdown += `##### ${hIndex + 1}. ${highlight.book?.title || 'Unknown Source'}\n\n`;
          
          markdown += `**Readwise ID:** ${highlight.readwiseId}  \n`;
          if (highlight.book?.author) {
            markdown += `**Author:** ${highlight.book.author}  \n`;
          }
          if (highlight.relevanceScore) {
            markdown += `**Relevance:** ${highlight.relevanceScore}/10  \n`;
          }
          if (highlight.qualityScore) {
            markdown += `**Quality:** ${highlight.qualityScore}/10  \n`;
          }
          if (highlight.insightType) {
            markdown += `**Type:** ${highlight.insightType}  \n`;
          }
          markdown += `\n`;
          
          if (highlight.curatorReason) {
            markdown += `**Note:** ${highlight.curatorReason}\n\n`;
          }
          
          if (highlight.text) {
            markdown += `> ${highlight.text}\n\n`;
          }
          
          markdown += `---\n\n`;
        });
      } else {
        markdown += `**Status:** ⏳ Pending highlight curation\n\n`;
        markdown += `*This model is part of the framework but doesn't yet have curated Readwise highlights.*\n\n`;
      }
      
      markdown += `\n`;
    });
  });
  
  // Summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `### Coverage\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Models with Highlights:** ${modelsWithHighlights}\n`;
  markdown += `- **Models Pending:** ${sortedModels.length - modelsWithHighlights}\n`;
  markdown += `- **Total Highlights:** ${totalHighlights.toLocaleString()}\n`;
  markdown += `- **Coverage:** ${((modelsWithHighlights / sortedModels.length) * 100).toFixed(1)}%\n`;
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*  \n`;
  markdown += `*Source: lib/readwise-data.ts + Readwise website notes*\n`;
  
  return markdown;
}

const markdown = generateMarkdown(allModels, highlightsMap);

const outputPath = path.join(__dirname, '..', 'MENTAL_MODELS_READWISE_HIGHLIGHTS.md');
fs.writeFileSync(outputPath, markdown, 'utf8');

console.log(`✅ Successfully generated complete highlights document!\n`);
console.log(`📄 File: ${outputPath}`);
console.log(`📊 Size: ${(markdown.length / 1024).toFixed(2)} KB`);
console.log(`📏 Lines: ${markdown.split('\n').length.toLocaleString()}`);
console.log(`🧠 Total Models: ${allModels.length}`);
console.log(`\n✨ All done!`);

