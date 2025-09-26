#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Debug script to understand the structure of multi-domain files
function debugMultiDomainFile(filename) {
  const filePath = path.join(__dirname, '..', 'Readwise website notes', filename);
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\n=== Debugging ${filename} ===`);
  
  // Find all domain headers
  const domainMatches = content.match(/## Domain (\d+):/g);
  if (domainMatches) {
    console.log(`Found domains: ${domainMatches.join(', ')}`);
    
    domainMatches.forEach(match => {
      const domainId = parseInt(match.match(/## Domain (\d+):/)[1]);
      console.log(`\nDomain ${domainId}:`);
      
      // Find JSON blocks after this domain header
      const domainIndex = content.indexOf(match);
      const nextDomainIndex = content.indexOf('## Domain', domainIndex + 1);
      const domainSection = nextDomainIndex > -1 
        ? content.substring(domainIndex, nextDomainIndex)
        : content.substring(domainIndex);
      
      const jsonBlocks = domainSection.match(/```json\s*([\s\S]*?)\s*```/g);
      if (jsonBlocks) {
        console.log(`  - Found ${jsonBlocks.length} JSON blocks`);
        jsonBlocks.forEach((block, idx) => {
          try {
            const jsonData = JSON.parse(block.replace(/```json\s*|\s*```/g, ''));
            console.log(`    Block ${idx + 1}: ${jsonData.modelTitle || jsonData.modelId || 'Unknown model'}`);
          } catch (error) {
            console.log(`    Block ${idx + 1}: Parse error - ${error.message}`);
          }
        });
      } else {
        console.log(`  - No JSON blocks found`);
      }
    });
  } else {
    console.log('No domain headers found');
  }
  
  // Also check for overall JSON structure
  const allJsonBlocks = content.match(/```json\s*([\s\S]*?)\s*```/g);
  console.log(`\nTotal JSON blocks in file: ${allJsonBlocks ? allJsonBlocks.length : 0}`);
}

// Debug the problematic files
debugMultiDomainFile('mental_models_curation_21-24.md');
debugMultiDomainFile('mental-models-16-20.md');
debugMultiDomainFile('mental_models_domains_31_35.md');
