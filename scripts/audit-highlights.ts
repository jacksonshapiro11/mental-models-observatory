#!/usr/bin/env node

/**
 * Comprehensive audit script to check highlight counts for all models
 * Identifies models with 0 or 1 highlight and checks source files
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAllDomainFiles, getModelHighlightsFromAllDomains, getAllAvailableModelIds } from '../lib/parse-all-domains';
import { READWISE_MODELS } from '../lib/readwise-data';

interface AuditResult {
  totalModels: number;
  modelsWithHighlights: number;
  modelsWithNoHighlights: Array<{
    slug: string;
    id: string;
    name: string;
    modelIdInFile?: string;
    potentialMatch?: string | null;
    highlights: any[];
  }>;
  modelsWithOneHighlight: Array<{
    slug: string;
    id: string;
    name: string;
    modelIdInFile: string;
    highlightCount: number;
    highlight: any;
  }>;
  modelsWithFewHighlights: Array<{
    slug: string;
    id: string;
    name: string;
    modelIdInFile: string;
    highlightCount: number;
  }>;
  modelsWithManyHighlights: Array<{
    slug: string;
    id: string;
    name: string;
    modelIdInFile: string;
    highlightCount: number;
  }>;
  mappingIssues: any[];
  highlightFileModels: Set<string>;
  modelSlugMismatches: Array<{
    slug: string;
    id: string;
    name: string;
    modelIdInFile: string;
    highlightCount: number;
  }>;
}

// Parse all highlights from files
console.log('📖 Parsing all highlight files...\n');
const allParsedHighlights = parseAllDomainFiles();
console.log(`✅ Parsed ${allParsedHighlights.length} models with highlights\n`);

// Get all available model IDs from highlight files
const availableModelIds = getAllAvailableModelIds();
console.log(`📋 Found ${availableModelIds.length} unique model IDs in highlight files\n`);

// Get all models from readwise-data.ts
const allModels = READWISE_MODELS;
console.log(`🧠 Checking ${allModels.length} models from readwise-data.ts\n`);

// Audit results
const results: AuditResult = {
  totalModels: allModels.length,
  modelsWithHighlights: 0,
  modelsWithNoHighlights: [],
  modelsWithOneHighlight: [],
  modelsWithFewHighlights: [],
  modelsWithManyHighlights: [],
  mappingIssues: [],
  highlightFileModels: new Set(),
  modelSlugMismatches: []
};

// Check each model
for (const model of allModels) {
  const modelSlug = model.slug;
  const highlights = getModelHighlightsFromAllDomains(modelSlug);
  
  if (highlights) {
    const count = highlights.curatedHighlights.length;
    results.highlightFileModels.add(highlights.modelId);
    
    if (count === 0) {
      results.modelsWithNoHighlights.push({
        slug: modelSlug,
        id: model.id,
        name: model.name,
        modelIdInFile: highlights.modelId,
        highlights: []
      });
    } else if (count === 1) {
      results.modelsWithOneHighlight.push({
        slug: modelSlug,
        id: model.id,
        name: model.name,
        modelIdInFile: highlights.modelId,
        highlightCount: count,
        highlight: highlights.curatedHighlights[0]
      });
    } else if (count >= 2 && count <= 4) {
      results.modelsWithFewHighlights.push({
        slug: modelSlug,
        id: model.id,
        name: model.name,
        modelIdInFile: highlights.modelId,
        highlightCount: count
      });
    } else {
      results.modelsWithManyHighlights.push({
        slug: modelSlug,
        id: model.id,
        name: model.name,
        modelIdInFile: highlights.modelId,
        highlightCount: count
      });
    }
    
    // Check if modelId matches slug (potential mapping issue)
    if (highlights.modelId !== modelSlug && highlights.modelId !== model.id) {
      results.modelSlugMismatches.push({
        slug: modelSlug,
        id: model.id,
        name: model.name,
        modelIdInFile: highlights.modelId,
        highlightCount: count
      });
    }
    
    results.modelsWithHighlights++;
  } else {
    // No highlights found - check if modelId exists in files but with different slug
    const foundInFiles = availableModelIds.find(id => 
      id === modelSlug || 
      id === model.id ||
      id.toLowerCase().replace(/-/g, '') === modelSlug.toLowerCase().replace(/-/g, '')
    );
    
    results.modelsWithNoHighlights.push({
      slug: modelSlug,
      id: model.id,
      name: model.name,
      potentialMatch: foundInFiles || null,
      highlights: []
    });
  }
}

// Summary
console.log('='.repeat(80));
console.log('📊 HIGHLIGHT AUDIT SUMMARY');
console.log('='.repeat(80));
console.log(`\nTotal Models: ${results.totalModels}`);
console.log(`Models with Highlights: ${results.modelsWithHighlights}`);
console.log(`Models with NO Highlights: ${results.modelsWithNoHighlights.length}`);
console.log(`Models with 1 Highlight: ${results.modelsWithOneHighlight.length}`);
console.log(`Models with 2-4 Highlights: ${results.modelsWithFewHighlights.length}`);
console.log(`Models with 5+ Highlights: ${results.modelsWithManyHighlights.length}`);
console.log(`\nUnique Model IDs in Highlight Files: ${results.highlightFileModels.size}`);
console.log(`Potential Slug Mismatches: ${results.modelSlugMismatches.length}`);

// Detailed reports
if (results.modelsWithNoHighlights.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('❌ MODELS WITH NO HIGHLIGHTS');
  console.log('='.repeat(80));
  results.modelsWithNoHighlights.forEach(model => {
    console.log(`\n  • ${model.name}`);
    console.log(`    Slug: ${model.slug}`);
    console.log(`    ID: ${model.id}`);
    if (model.potentialMatch) {
      console.log(`    ⚠️  Potential match found in files: ${model.potentialMatch}`);
    } else {
      console.log(`    ❌ No match found in highlight files`);
    }
  });
}

if (results.modelsWithOneHighlight.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  MODELS WITH ONLY 1 HIGHLIGHT');
  console.log('='.repeat(80));
  results.modelsWithOneHighlight.forEach(model => {
    console.log(`\n  • ${model.name}`);
    console.log(`    Slug: ${model.slug}`);
    console.log(`    Model ID in file: ${model.modelIdInFile}`);
    console.log(`    Highlight ID: ${model.highlight.readwiseId}`);
    console.log(`    Book: ${model.highlight.book.title} by ${model.highlight.book.author}`);
  });
}

if (results.modelsWithFewHighlights.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('📝 MODELS WITH 2-4 HIGHLIGHTS');
  console.log('='.repeat(80));
  results.modelsWithFewHighlights.forEach(model => {
    console.log(`\n  • ${model.name} (${model.highlightCount} highlights)`);
    console.log(`    Slug: ${model.slug}`);
    console.log(`    Model ID in file: ${model.modelIdInFile}`);
  });
}

if (results.modelSlugMismatches.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('🔀 POTENTIAL SLUG MAPPING ISSUES');
  console.log('='.repeat(80));
  results.modelSlugMismatches.forEach(model => {
    console.log(`\n  • ${model.name}`);
    console.log(`    Model Slug: ${model.slug}`);
    console.log(`    Model ID: ${model.id}`);
    console.log(`    Model ID in Highlight File: ${model.modelIdInFile}`);
    console.log(`    Highlights: ${model.highlightCount}`);
  });
}

// Show models in highlight files that aren't in readwise-data.ts
console.log('\n' + '='.repeat(80));
console.log('🔍 MODEL IDs IN HIGHLIGHT FILES BUT NOT IN READWISE_DATA.TS');
console.log('='.repeat(80));
const modelIdsInData = new Set(allModels.map(m => m.id).concat(allModels.map(m => m.slug)));
const orphanedModelIds = availableModelIds.filter(id => !modelIdsInData.has(id));
if (orphanedModelIds.length > 0) {
  orphanedModelIds.forEach(id => {
    const highlights = allParsedHighlights.find(h => h.modelId === id);
    if (highlights) {
      console.log(`\n  • ${id} (${highlights.curatedHighlights.length} highlights)`);
      console.log(`    Title: ${highlights.modelTitle}`);
    }
  });
} else {
  console.log('\n  ✅ All model IDs in highlight files are matched to models in readwise-data.ts');
}

// Save detailed report to file
const reportPath = path.join(process.cwd(), 'highlight-audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Detailed report saved to: ${reportPath}`);

// Generate mapping suggestions
if (results.modelsWithNoHighlights.length > 0 || results.modelSlugMismatches.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('💡 SUGGESTED MAPPING FIXES');
  console.log('='.repeat(80));
  console.log('\nAdd these to MODEL_SLUG_MAPPINGS in lib/parse-all-domains.ts:\n');
  
  const suggestions: string[] = [];
  
  // Models with no highlights that have potential matches
  results.modelsWithNoHighlights.forEach(model => {
    if (model.potentialMatch) {
      suggestions.push(`  '${model.slug}': '${model.potentialMatch}',`);
    }
  });
  
  // Models with slug mismatches
  results.modelSlugMismatches.forEach(model => {
    suggestions.push(`  '${model.slug}': '${model.modelIdInFile}',`);
  });
  
  if (suggestions.length > 0) {
    console.log(suggestions.join('\n'));
  } else {
    console.log('  No mapping fixes needed based on current analysis.');
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ Audit complete!');
console.log('='.repeat(80) + '\n');

