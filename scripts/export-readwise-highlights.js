#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Simple approach: Use the existing parseAllDomainFiles() logic to extract
 * all Readwise highlights with their metadata from the source files
 */

console.log('🚀 Extracting all Readwise highlights from source files...\n');

// We'll replicate the parsing logic from lib/parse-all-domains.ts
const readwiseDir = path.join(__dirname, '..', 'Readwise website notes');

function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const models = [];
  
  const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
  
  if (jsonMatches && jsonMatches.length > 0) {
    for (const jsonMatch of jsonMatches) {
      try {
        let jsonContent = jsonMatch
          .replace(/```json\n/, '')
          .replace(/\n```/, '')
          .trim();
        
        // Remove comments
        jsonContent = jsonContent.replace(/^\s*\/\/.*$/gm, '');
        
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

function loadAllHighlights() {
  const allModels = [];
  
  try {
    const files = fs.readdirSync(readwiseDir);
    
    for (const file of files) {
      if (file.startsWith('.') || !file.endsWith('.md')) continue;
      
      const filePath = path.join(readwiseDir, file);
      
      try {
        const models = parseMarkdownFile(filePath);
        allModels.push(...models);
        console.log(`  ✅ Processed ${file}: ${models.length} models`);
      } catch (error) {
        console.error(`  ❌ Error parsing ${file}:`, error.message);
      }
    }
    
    // Remove duplicates
    const uniqueModels = [];
    const seenIds = new Set();
    
    for (const model of allModels) {
      if (!seenIds.has(model.modelId)) {
        seenIds.add(model.modelId);
        uniqueModels.push(model);
      }
    }
    
    console.log(`\n📊 Total: ${uniqueModels.length} models with highlights\n`);
    return uniqueModels;
    
  } catch (error) {
    console.error('Error reading Readwise directory:', error);
    return [];
  }
}

function generateMarkdown(models) {
  console.log('📝 Generating Readwise highlights document...\n');
  
  // Sort models alphabetically by title
  const sortedModels = models.sort((a, b) => a.modelTitle.localeCompare(b.modelTitle));
  
  // Calculate total highlights
  const totalHighlights = sortedModels.reduce((sum, model) => sum + model.curatedHighlights.length, 0);
  
  let markdown = `# Mental Models Observatory - Readwise Highlights Collection

*Curated highlights for ${sortedModels.length} mental models with ${totalHighlights.toLocaleString()} total insights*

---

## Table of Contents

`;
  
  // Generate table of contents
  sortedModels.forEach((model, index) => {
    const slug = model.modelTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const count = model.curatedHighlights.length;
    markdown += `${index + 1}. [${model.modelTitle}](#${slug}) - ${count} highlight${count !== 1 ? 's' : ''}\n`;
  });
  
  markdown += `\n---\n\n`;
  
  // Generate content for each model
  sortedModels.forEach((model, modelIndex) => {
    const slug = model.modelTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    
    markdown += `## ${model.modelTitle}\n\n`;
    markdown += `**Model ID:** \`${model.modelId}\`  \n`;
    markdown += `**Total Highlights:** ${model.curatedHighlights.length}\n\n`;
    
    if (model.modelDescription) {
      markdown += `### Description\n\n${model.modelDescription}\n\n`;
    }
    
    markdown += `### Curated Highlights\n\n`;
    
    // Sort highlights by relevance score (highest first)
    const sortedHighlights = [...model.curatedHighlights].sort((a, b) => 
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    
    sortedHighlights.forEach((highlight, index) => {
      markdown += `#### ${index + 1}. ${highlight.book?.title || 'Unknown Source'}\n\n`;
      
      // Metadata
      markdown += `**Readwise ID:** ${highlight.readwiseId}  \n`;
      if (highlight.book?.author) {
        markdown += `**Author:** ${highlight.book.author}  \n`;
      }
      if (highlight.relevanceScore) {
        markdown += `**Relevance Score:** ${highlight.relevanceScore}/10  \n`;
      }
      if (highlight.qualityScore) {
        markdown += `**Quality Score:** ${highlight.qualityScore}/10  \n`;
      }
      if (highlight.insightType) {
        markdown += `**Insight Type:** ${highlight.insightType}  \n`;
      }
      markdown += `\n`;
      
      // Curator's reason/notes
      if (highlight.curatorReason) {
        markdown += `**Curator's Note:** ${highlight.curatorReason}\n\n`;
      }
      
      // Include highlight text if available
      if (highlight.text) {
        markdown += `> ${highlight.text}\n\n`;
      } else {
        markdown += `*Highlight text available in Readwise (ID: ${highlight.readwiseId})*\n\n`;
      }
      
      markdown += `---\n\n`;
    });
    
    markdown += `\n`;
  });
  
  // Add summary statistics
  markdown += `## Summary Statistics\n\n`;
  markdown += `### Overall Collection\n`;
  markdown += `- **Total Models:** ${sortedModels.length}\n`;
  markdown += `- **Total Highlights:** ${totalHighlights.toLocaleString()}\n`;
  markdown += `- **Average Highlights per Model:** ${(totalHighlights / sortedModels.length).toFixed(1)}\n`;
  
  // Highlight count distribution
  const highlightCounts = {};
  sortedModels.forEach(model => {
    const count = model.curatedHighlights.length;
    highlightCounts[count] = (highlightCounts[count] || 0) + 1;
  });
  
  markdown += `\n### Highlights per Model Distribution\n`;
  Object.keys(highlightCounts).sort((a, b) => parseInt(b) - parseInt(a)).forEach(count => {
    const modelCount = highlightCounts[count];
    markdown += `- **${count} highlights:** ${modelCount} model${modelCount !== 1 ? 's' : ''}\n`;
  });
  
  // Top books by citation
  const bookCitations = {};
  sortedModels.forEach(model => {
    model.curatedHighlights.forEach(h => {
      if (h.book?.title) {
        const key = `${h.book.title} by ${h.book.author || 'Unknown'}`;
        bookCitations[key] = (bookCitations[key] || 0) + 1;
      }
    });
  });
  
  const sortedBooks = Object.entries(bookCitations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  if (sortedBooks.length > 0) {
    markdown += `\n### Top 20 Most Cited Books\n`;
    sortedBooks.forEach(([book, count], index) => {
      markdown += `${index + 1}. **${book}** - ${count} citation${count !== 1 ? 's' : ''}\n`;
    });
  }
  
  markdown += `\n---\n\n`;
  markdown += `*Generated on ${new Date().toISOString().split('T')[0]}*  \n`;
  markdown += `*Source: Readwise website notes (Mental Models Observatory)*  \n`;
  markdown += `*Note: Readwise IDs can be used to fetch full highlight text via the Readwise API*\n`;
  
  return markdown;
}

function main() {
  const models = loadAllHighlights();
  
  if (models.length === 0) {
    console.log('❌ No models with highlights found.');
    process.exit(1);
  }
  
  const markdown = generateMarkdown(models);
  
  const outputPath = path.join(__dirname, '..', 'MENTAL_MODELS_READWISE_HIGHLIGHTS.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');
  
  console.log(`✅ Successfully generated Readwise highlights document!\n`);
  console.log(`📄 File: ${outputPath}`);
  console.log(`📊 Size: ${(markdown.length / 1024).toFixed(2)} KB`);
  console.log(`📏 Lines: ${markdown.split('\n').length.toLocaleString()}`);
  
  const totalHighlights = models.reduce((sum, m) => sum + m.curatedHighlights.length, 0);
  console.log(`🧠 Models: ${models.length}`);
  console.log(`💡 Total Highlights: ${totalHighlights}`);
  console.log(`\n✨ All done! Your complete Readwise highlights collection is ready.`);
}

main();

