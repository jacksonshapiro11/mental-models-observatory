#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extract principles directly from the Readwise website notes files
 * using the same approach as the working website
 */

function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  
  // Extract ALL JSON blocks from the file
  const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
  
  if (jsonMatches && jsonMatches.length > 0) {
    console.log(`Processing ${jsonMatches.length} JSON blocks in ${path.basename(filePath)}`);
    
    for (const jsonMatch of jsonMatches) {
      try {
        // Clean up the JSON content
        let jsonContent = jsonMatch
          .replace(/```json\n/, '')
          .replace(/\n```/, '')
          .trim();
        
        // Remove JavaScript-style comments
        jsonContent = jsonContent.replace(/^\s*\/\/.*$/gm, '');
        
        const modelData = JSON.parse(jsonContent);
        
        if (modelData.modelId) {
          models.push({
            modelId: modelData.modelId,
            modelTitle: modelData.modelTitle,
            modelDescription: modelData.modelDescription,
            curatedHighlights: modelData.curatedHighlights || []
          });
          console.log(`  ✅ Parsed model: ${modelData.modelId}`);
        }
      } catch (error) {
        console.error(`  ❌ Error parsing JSON in markdown file ${path.basename(filePath)}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  return models;
}

function parseJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  
  try {
    const data = JSON.parse(content);
    
    // Handle different JSON structures
    if (Array.isArray(data)) {
      // Array of models
      return data.map((item) => ({
        modelId: item.modelId,
        modelTitle: item.modelTitle,
        modelDescription: item.modelDescription,
        curatedHighlights: item.curatedHighlights || []
      }));
    } else if (data.modelId) {
      // Single model object
      return [{
        modelId: data.modelId,
        modelTitle: data.modelTitle,
        modelDescription: data.modelDescription,
        curatedHighlights: data.curatedHighlights || []
      }];
    } else if (typeof data === 'object') {
      // Nested object structure
      const models = [];
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value.modelId) {
          models.push({
            modelId: value.modelId,
            modelTitle: value.modelTitle,
            modelDescription: value.modelDescription,
            curatedHighlights: value.curatedHighlights || []
          });
        }
      }
      return models;
    }
  } catch (error) {
    console.error(`Error parsing JSON file ${path.basename(filePath)}:`, error.message);
    // Try to extract partial data from corrupted JSON
    try {
      return extractPartialModels(content, path.basename(filePath));
    } catch (fallbackError) {
      console.log(`  ⚠️  Skipping corrupted file ${path.basename(filePath)}`);
      return [];
    }
  }
  
  return models;
}

function extractPartialModels(content, fileName) {
  const models = [];
  
  // Try to find complete model objects using regex
  const modelMatches = content.match(/\{\s*"modelId":\s*"[^"]+",[\s\S]*?\}/g);
  
  if (modelMatches) {
    for (const modelStr of modelMatches) {
      try {
        // Clean up the model string
        let cleanedStr = modelStr
          .replace(/,\s*}/g, '}') // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        const model = JSON.parse(cleanedStr);
        
        if (model.modelId) {
          models.push({
            modelId: model.modelId,
            modelTitle: model.modelTitle || model.modelId,
            modelDescription: model.modelDescription || '',
            curatedHighlights: model.curatedHighlights || []
          });
          console.log(`  ✅ Extracted partial model: ${model.modelId}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not parse partial model from ${fileName}`);
      }
    }
  }
  
  return models;
}

function parseTextFile(filePath, fileName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  
  try {
    // Try to parse as JSON first (some .txt files contain JSON)
    const cleanContent = content.trim();
    if (cleanContent.startsWith('[') || cleanContent.startsWith('{')) {
      const data = JSON.parse(cleanContent);
      
      if (Array.isArray(data)) {
        return data.map((item) => ({
          modelId: item.modelId || `text-${Date.now()}-${Math.random()}`,
          modelTitle: item.modelTitle || 'Text Model',
          modelDescription: item.modelDescription || 'Model from text file',
          curatedHighlights: item.curatedHighlights || []
        }));
      }
    }
  } catch (error) {
    console.log(`Could not parse text file ${fileName} as JSON, skipping...`);
  }
  
  return models;
}

function loadAllModels() {
  const allModels = [];
  const readwiseDir = path.join(__dirname, '..', 'Readwise website notes');
  const dataDomainsDir = path.join(__dirname, '..', 'data', 'domains');
  
  // Process Readwise website notes
  try {
    const files = fs.readdirSync(readwiseDir);
    
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!['.md', '.json', '.txt'].includes(ext)) continue;
      
      const filePath = path.join(readwiseDir, file);
      
      try {
        let models = [];
        
        if (ext === '.md') {
          models = parseMarkdownFile(filePath);
        } else if (ext === '.json') {
          models = parseJsonFile(filePath);
        } else if (ext === '.txt') {
          models = parseTextFile(filePath, file);
        }
        
        allModels.push(...models);
      } catch (error) {
        console.error(`Error parsing file ${file}:`, error);
      }
    }
    
    // Remove duplicates based on modelId
    const uniqueModels = [];
    const seenIds = new Set();
    
    for (const model of allModels) {
      if (!seenIds.has(model.modelId)) {
        seenIds.add(model.modelId);
        uniqueModels.push(model);
      }
    }
    
    console.log(`Parsed ${uniqueModels.length} unique models from ${files.length} Readwise files`);
    
    // Process data/domains directory
    try {
      const dataFiles = fs.readdirSync(dataDomainsDir);
      console.log(`\n📁 Processing ${dataFiles.length} files from data/domains...`);
      
      for (const file of dataFiles) {
        if (file.startsWith('.') || !file.endsWith('.md')) continue;
        
        const filePath = path.join(dataDomainsDir, file);
        
        try {
          const models = parseMarkdownFile(filePath);
          allModels.push(...models);
          console.log(`  ✅ Processed ${file}: ${models.length} models`);
        } catch (error) {
          console.error(`  ❌ Error parsing file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error reading data/domains directory:', error);
    }
    
    // Remove duplicates based on modelId
    const finalUniqueModels = [];
    const seenIds = new Set();
    
    for (const model of allModels) {
      if (!seenIds.has(model.modelId)) {
        seenIds.add(model.modelId);
        finalUniqueModels.push(model);
      }
    }
    
    console.log(`\n📊 Final count: ${finalUniqueModels.length} unique models from all sources`);
    return finalUniqueModels;
    
  } catch (error) {
    console.error('Error reading Readwise directory:', error);
    return [];
  }
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
    
    // Applications section (placeholder since we're focusing on principles)
    markdown += `### Applications\n\n`;
    markdown += `*Applications are derived from the core principles above and can be applied across various domains including decision-making, problem-solving, strategic thinking, and personal development.*\n\n`;
    
    // Show highlight count
    if (model.curatedHighlights && model.curatedHighlights.length > 0) {
      markdown += `**Supporting Insights:** ${model.curatedHighlights.length} curated highlights from books and articles\n\n`;
    }
    
    markdown += `---\n\n`;
  });
  
  // Add summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Models with Principles:** ${sortedModels.filter(m => m.modelDescription && m.modelDescription.trim()).length}\n`;
  markdown += `- **Models with Supporting Insights:** ${sortedModels.filter(m => m.curatedHighlights && m.curatedHighlights.length > 0).length}\n`;
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*\n`;
  markdown += `*Source: Mental Models Observatory - Extracted from Readwise website notes*\n`;
  
  return markdown;
}

function main() {
  try {
    console.log('🚀 Starting principles extraction from Readwise notes...');
    
    const models = loadAllModels();
    
    if (models.length === 0) {
      console.log('❌ No models found. Check the Readwise website notes directory.');
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
