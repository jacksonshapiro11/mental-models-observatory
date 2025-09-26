#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = path.join(__dirname, '..', 'Readwise website notes');
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'domains');
const DOMAIN_GROUPS = [
  { start: 1, end: 5, name: 'domains-01-05' },
  { start: 6, end: 10, name: 'domains-06-10' },
  { start: 11, end: 15, name: 'domains-11-15' },
  { start: 16, end: 20, name: 'domains-16-20' },
  { start: 21, end: 25, name: 'domains-21-25' },
  { start: 26, end: 30, name: 'domains-26-30' },
  { start: 31, end: 35, name: 'domains-31-35' },
  { start: 36, end: 40, name: 'domains-36-40' }
];

// Domain metadata from Readwise Frameworks
const DOMAIN_METADATA = {
  1: { title: "Time & Mortality Awareness", tier: 1, description: "Understanding the finite nature of time and using mortality as a lens for decision-making" },
  2: { title: "Physics & Fundamental Constraints", tier: 1, description: "Applying physical laws and constraints to understand system boundaries" },
  3: { title: "Energy & Resource Flows", tier: 1, description: "Tracing how energy and resources move through systems" },
  4: { title: "Systems Thinking & Complexity", tier: 1, description: "Understanding how systems behave and interact" },
  5: { title: "Mental Models & Cross-Disciplinary Thinking", tier: 1, description: "Building a latticework of mental models for better thinking" },
  6: { title: "Psychology & Human Behavior", tier: 2, description: "Understanding cognitive biases and human decision-making" },
  7: { title: "Economics & Incentives", tier: 2, description: "How incentives shape behavior and market dynamics" },
  8: { title: "Biology & Evolution", tier: 2, description: "Applying evolutionary principles to understand adaptation and selection" },
  9: { title: "Chemistry & Molecular Interactions", tier: 2, description: "Understanding how components interact at the molecular level" },
  10: { title: "Mathematics & Logic", tier: 2, description: "Using mathematical thinking and formal logic" },
  11: { title: "Statistics & Probability", tier: 2, description: "Understanding uncertainty and making probabilistic decisions" },
  12: { title: "Information Theory & Communication", tier: 2, description: "How information flows and is processed" },
  13: { title: "Cultural Transmission & Memetic Evolution", tier: 2, description: "How ideas spread and evolve through culture" },
  14: { title: "Network Theory & Graph Theory", tier: 2, description: "Understanding connections and relationships in systems" },
  15: { title: "Information Processing & Signal Detection", tier: 2, description: "Processing and filtering information effectively" },
  16: { title: "Decision Theory & Game Theory", tier: 3, description: "Making optimal decisions in strategic situations" },
  17: { title: "Risk Management & Uncertainty", tier: 3, description: "Managing risk and making decisions under uncertainty" },
  18: { title: "Learning & Skill Development", tier: 3, description: "How to learn effectively and develop expertise" },
  19: { title: "Communication & Persuasion", tier: 3, description: "Effective communication and influence strategies" },
  20: { title: "Leadership & Organizational Behavior", tier: 3, description: "Leading teams and understanding organizational dynamics" },
  21: { title: "Strategy & Competitive Dynamics", tier: 3, description: "Strategic thinking and competitive positioning" },
  22: { title: "Innovation & Disruption", tier: 3, description: "Understanding innovation patterns and disruptive change" },
  23: { title: "Technology & Digital Systems", tier: 3, description: "Understanding technology trends and digital systems" },
  24: { title: "Finance & Capital Markets", tier: 3, description: "Understanding financial systems and capital allocation" },
  25: { title: "Evolution & Biology", tier: 3, description: "Applying biological principles to understand adaptation" },
  26: { title: "Creativity & Innovation", tier: 3, description: "Understanding creative processes and innovation patterns" },
  27: { title: "Mathematics & Logic", tier: 3, description: "Advanced mathematical thinking and logical reasoning" },
  28: { title: "History & Institutional Evolution", tier: 3, description: "Understanding historical patterns and institutional change" },
  29: { title: "Engineering & Design", tier: 3, description: "Engineering principles and design thinking" },
  30: { title: "Complex Adaptive Systems", tier: 3, description: "Understanding complex systems and emergent behavior" },
  31: { title: "Statistics & Data Science", tier: 3, description: "Statistical thinking and data-driven decision making" },
  32: { title: "Philosophy & Ethics", tier: 3, description: "Philosophical frameworks and ethical reasoning" },
  33: { title: "Anthropology & Cultural Evolution", tier: 3, description: "Understanding human cultures and social evolution" },
  34: { title: "Geography & Spatial Thinking", tier: 3, description: "Understanding spatial relationships and geographic factors" },
  35: { title: "Linguistics & Language", tier: 3, description: "Understanding language and communication systems" },
  36: { title: "Art & Aesthetics", tier: 3, description: "Understanding beauty, design, and artistic expression" },
  37: { title: "Music & Rhythm", tier: 3, description: "Understanding patterns, harmony, and temporal structures" },
  38: { title: "Architecture & Built Environment", tier: 3, description: "Understanding how physical spaces shape behavior" },
  39: { title: "Medicine & Health", tier: 3, description: "Understanding health, disease, and medical systems" },
  40: { title: "Law & Governance", tier: 3, description: "Understanding legal systems and governance structures" }
};

// Standard insight types
const INSIGHT_TYPES = [
  'foundational_concept',
  'practical_application', 
  'mechanism_insight',
  'empirical_evidence',
  'philosophical_insight',
  'counterpoint',
  'design_principles',
  'historical_perspective',
  'technical_implementation',
  'case_study'
];

function extractJsonFromMarkdown(content) {
  const jsonBlocks = [];
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      jsonBlocks.push(jsonData);
    } catch (error) {
      console.warn('Failed to parse JSON block:', error.message);
    }
  }
  
  return jsonBlocks;
}

function extractDomainsFromMarkdown(content) {
  const domains = [];
  
  // Look for domain headers and extract domain numbers
  const domainMatches = content.match(/## Domain (\d+):/g);
  if (domainMatches) {
    domainMatches.forEach(match => {
      const domainId = parseInt(match.match(/## Domain (\d+):/)[1]);
      domains.push(domainId);
    });
  }
  
  return domains;
}

function standardizeModel(model, domainId) {
  return {
    modelId: model.modelId || `domain-${domainId}-${model.modelTitle?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    modelTitle: model.modelTitle,
    modelDescription: model.modelDescription || model.description,
    difficulty: model.difficulty || 'intermediate',
    practicalValue: model.practicalValue || 8,
    tags: model.tags || [],
    curatedHighlights: model.curatedHighlights?.map(highlight => ({
      readwiseId: highlight.readwiseId,
      book: {
        title: highlight.book?.title,
        author: highlight.book?.author,
        readwiseBookId: highlight.book?.readwiseBookId
      },
      relevanceScore: highlight.relevanceScore,
      qualityScore: highlight.qualityScore,
      insightType: highlight.insightType || 'foundational_concept',
      curatorReason: highlight.curatorReason
    })) || [],
    examples: model.examples || []
  };
}

function createDomainGroup(group, models) {
  const { start, end, name } = group;
  
  let content = `# Mental Models Observatory: Domains ${start.toString().padStart(2, '0')}-${end.toString().padStart(2, '0')}\n\n`;
  
  for (let domainId = start; domainId <= end; domainId++) {
    const metadata = DOMAIN_METADATA[domainId];
    if (!metadata) {
      content += `## Domain ${domainId}: [TO BE CURATED]\n*Domain ${domainId} curation pending*\n\n`;
      continue;
    }
    
    content += `## Domain ${domainId}: ${metadata.title}\n*${metadata.description}*\n\n`;
    
    const domainModels = models.filter(m => m.domainId === domainId);
    
    if (domainModels.length === 0) {
      content += `### ${domainId}A: [TO BE CURATED]\n*Model curation pending*\n\n`;
    } else {
      domainModels.forEach((model, index) => {
        const modelLetter = String.fromCharCode(65 + index); // A, B, C, etc.
        const standardizedModel = standardizeModel(model, domainId);
        
        content += `### ${domainId}${modelLetter}: ${standardizedModel.modelTitle}\n\n`;
        content += '```json\n';
        content += JSON.stringify(standardizedModel, null, 2);
        content += '\n```\n\n';
      });
    }
  }
  
  return content;
}

function processExistingFiles() {
  const models = [];
  
  // Process each file and extract models
  const files = fs.readdirSync(INPUT_DIR);
  
  files.forEach(file => {
    if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.txt')) {
      const filePath = path.join(INPUT_DIR, file);
      let content;
      
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        console.warn(`Could not read ${file}:`, error.message);
        return;
      }
      
      console.log(`Processing ${file}...`);
      
      if (file.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            data.forEach(model => {
              // Try to extract domain ID from filename or model ID
              const domainMatch = file.match(/domain[_-]?(\d+)/i);
              const domainId = domainMatch ? parseInt(domainMatch[1]) : null;
              if (domainId) {
                model.domainId = domainId;
                models.push(model);
              }
            });
          } else {
            // Handle single model JSON files
            const domainMatch = file.match(/domain[_-]?(\d+)/i);
            const domainId = domainMatch ? parseInt(domainMatch[1]) : null;
            if (domainId) {
              data.domainId = domainId;
              models.push(data);
            }
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      } else if (file === 'domains_9_10_11_12 curation.txt') {
        // Handle the special format for domains 9-12
        try {
          const data = JSON.parse(content);
          Object.entries(data).forEach(([key, model]) => {
            const domainMatch = key.match(/domain(\d+)/);
            if (domainMatch) {
              const domainId = parseInt(domainMatch[1]);
              model.domainId = domainId;
              models.push(model);
            }
          });
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      } else if (file === 'domain8-philosophy-highlights.txt') {
        // Handle domain 8 format
        try {
          const data = JSON.parse(content);
          if (data.subModels) {
            data.subModels.forEach(model => {
              const domainMatch = data.domain.match(/Domain (\d+):/);
              const domainId = domainMatch ? parseInt(domainMatch[1]) : 8;
              model.domainId = domainId;
              models.push(model);
            });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      } else if (file === 'domain_13_curation.md') {
        // Handle domain 13 - it's actually JSON, not markdown
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            data.forEach(model => {
              model.domainId = 13;
              models.push(model);
            });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      } else if (file === 'domains 3 to 5.md') {
        // Handle the corrupted domains 3-5 file
        console.log('Skipping corrupted domains 3 to 5.md file (Microsoft Word format)');
      } else {
        // Handle markdown files with JSON blocks and multiple domains
        const jsonBlocks = extractJsonFromMarkdown(content);
        const domainsInFile = extractDomainsFromMarkdown(content);
        
        if (jsonBlocks.length > 0 && domainsInFile.length > 0) {
          // For files with multiple domains, try to map models to domains
          jsonBlocks.forEach(model => {
            // Try to determine which domain this model belongs to
            let assignedDomain = null;
            
            // Check if model has explicit domain info
            if (model.modelId) {
              const modelDomainMatch = model.modelId.match(/(\d+)/);
              if (modelDomainMatch) {
                const potentialDomain = parseInt(modelDomainMatch[1]);
                if (domainsInFile.includes(potentialDomain)) {
                  assignedDomain = potentialDomain;
                }
              }
            }
            
            // If no explicit domain found, use filename to guess
            if (!assignedDomain) {
              const fileNameMatches = file.match(/(\d+)[-_](\d+)/);
              if (fileNameMatches) {
                // For files like "mental_models_curation_21-24.md", assign to first domain
                assignedDomain = parseInt(fileNameMatches[1]);
              } else {
                // Use the first domain in the file as fallback
                assignedDomain = domainsInFile[0];
              }
            }
            
            if (assignedDomain) {
              model.domainId = assignedDomain;
              models.push(model);
            }
          });
        } else if (jsonBlocks.length > 0) {
          // Fallback for files with JSON but no clear domain markers
          const domainMatch = file.match(/(\d+)/);
          if (domainMatch) {
            const domainId = parseInt(domainMatch[1]);
            jsonBlocks.forEach(model => {
              model.domainId = domainId;
              models.push(model);
            });
          }
        }
      }
    }
  });
  
  return models;
}

function main() {
  console.log('🔄 Standardizing domain files...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Process existing files
  const models = processExistingFiles();
  console.log(`📊 Found ${models.length} models across ${new Set(models.map(m => m.domainId)).size} domains`);
  
  // Group models by domain
  const modelsByDomain = {};
  models.forEach(model => {
    if (!modelsByDomain[model.domainId]) {
      modelsByDomain[model.domainId] = [];
    }
    modelsByDomain[model.domainId].push(model);
  });
  
  // Create domain group files
  DOMAIN_GROUPS.forEach(group => {
    const groupModels = [];
    for (let domainId = group.start; domainId <= group.end; domainId++) {
      if (modelsByDomain[domainId]) {
        groupModels.push(...modelsByDomain[domainId]);
      }
    }
    
    const content = createDomainGroup(group, groupModels);
    const outputPath = path.join(OUTPUT_DIR, `${group.name}.md`);
    
    fs.writeFileSync(outputPath, content);
    console.log(`✅ Created ${group.name}.md with ${groupModels.length} models`);
  });
  
  console.log('\n🎉 Standardization complete!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  
  // Create summary
  const summary = {
    totalModels: models.length,
    domainsWithModels: Object.keys(modelsByDomain).length,
    missingDomains: Array.from({ length: 40 }, (_, i) => i + 1).filter(id => !modelsByDomain[id]),
    domainGroups: DOMAIN_GROUPS.map(group => ({
      name: group.name,
      models: Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i)
        .filter(domainId => modelsByDomain[domainId])
        .map(domainId => ({ domainId, modelCount: modelsByDomain[domainId]?.length || 0 }))
    }))
  };
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('📋 Created summary.json with coverage statistics');
  
  // Log detailed breakdown
  console.log('\n📊 Detailed breakdown:');
  Object.entries(modelsByDomain).forEach(([domainId, domainModels]) => {
    console.log(`  Domain ${domainId}: ${domainModels.length} models`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { standardizeModel, createDomainGroup, processExistingFiles };
