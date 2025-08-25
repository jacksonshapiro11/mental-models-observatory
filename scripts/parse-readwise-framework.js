#!/usr/bin/env node

/**
 * Parse Readwise Frameworks.md and convert to data structure
 * This script reads the markdown file and generates TypeScript data files
 */

const fs = require('fs');
const path = require('path');

// Read the Readwise framework file
const frameworkPath = path.join(__dirname, '..', 'Readwise Frameworks.md');
const outputPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');

if (!fs.existsSync(frameworkPath)) {
  console.error('❌ Readwise Frameworks.md not found');
  process.exit(1);
}

console.log('🧠 Parsing Readwise Mental Models Framework...');

const content = fs.readFileSync(frameworkPath, 'utf-8');
const lines = content.split('\n');

const domains = [];
const models = [];
let currentDomain = null;
let currentModel = null;
let currentSection = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Parse domain headers
  const domainMatch = line.match(/^### \*\*Domain (\d+): (.+?)\*\*/);
  if (domainMatch) {
    const [, number, name] = domainMatch;
    
    // Get description (next line after *)
    let description = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine.startsWith('*') && nextLine.endsWith('*') && !nextLine.startsWith('**')) {
        description = nextLine.slice(1, -1); // Remove asterisks
        break;
      }
    }
    
    currentDomain = {
      id: `domain-${number}`,
      number: parseInt(number),
      name: name,
      description: description,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      models: [], // Will be populated with model IDs
      tier: getTier(parseInt(number)),
      icon: getIcon(name),
      color: getColor(parseInt(number)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    domains.push(currentDomain);
    continue;
  }
  
  // Parse sub-model headers
  const modelMatch = line.match(/^#### \*\*Sub-Model (\d+[A-Z]): (.+?)\*\*/);
  if (modelMatch && currentDomain) {
    const [, code, name] = modelMatch;
    
    // Get description (next line after *)
    let description = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine.startsWith('*') && nextLine.endsWith('*') && !nextLine.startsWith('**')) {
        description = nextLine.slice(1, -1);
        break;
      }
    }
    
    currentModel = {
      id: `${currentDomain.slug}-${code.toLowerCase()}`,
      code: code,
      name: name,
      description: description,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      domain: currentDomain.name,
      domainSlug: currentDomain.slug,
      principles: [],
      examples: [],
      applications: [],
      relatedModels: [], // Will be populated later
      sources: [],
      tags: extractTags(name + ' ' + description),
      difficulty: getDifficulty(currentDomain.tier),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    currentDomain.models.push(currentModel.id);
    models.push(currentModel);
    currentSection = null;
    continue;
  }
  
  // Parse content sections
  if (currentModel) {
    if (line.startsWith('**Key Applications:**')) {
      currentSection = 'applications';
      const apps = line.replace('**Key Applications:**', '').trim();
      if (apps) {
        currentModel.applications.push(...apps.split(';').map(s => s.trim()).filter(Boolean));
      }
      continue;
    }
    
    if (line.startsWith('*Sources:')) {
      currentSection = 'sources';
      const sources = line.replace('*Sources:', '').replace('*', '').trim();
      if (sources) {
        currentModel.sources.push(...parseSourcesString(sources));
      }
      continue;
    }
    
    // Collect content for principles
    if (currentSection === null && line && !line.startsWith('*') && !line.startsWith('#') && !line.startsWith('**')) {
      if (currentModel.principles.length === 0 || currentModel.principles[currentModel.principles.length - 1].length > 200) {
        currentModel.principles.push(line);
      } else {
        currentModel.principles[currentModel.principles.length - 1] += ' ' + line;
      }
    }
    
    // Continue applications on next lines
    if (currentSection === 'applications' && line && !line.startsWith('*') && !line.startsWith('#') && !line.startsWith('**')) {
      currentModel.applications.push(...line.split(';').map(s => s.trim()).filter(Boolean));
    }
  }
}

// Helper functions
function getTier(domainNumber) {
  if (domainNumber <= 8) return 1; // Foundational Meta-Frameworks
  if (domainNumber <= 20) return 2; // Core Cognitive Frameworks  
  if (domainNumber <= 32) return 3; // Applied Domain Frameworks
  return 4; // Specialized Implementation Frameworks
}

function getIcon(name) {
  const iconMap = {
    'time': '⏰', 'physics': '⚛️', 'energy': '⚡', 'systems': '🔗',
    'mental': '🧠', 'psychology': '🧑‍🤝‍🧑', 'decision': '🎯', 'philosophy': '🤔',
    'exponential': '📈', 'spatial': '📐', 'temporal': '⏳', 'power': '⚡',
    'cultural': '🌍', 'language': '💬', 'information': '📡', 'technology': '💻',
    'organizational': '🏢', 'relationships': '❤️', 'health': '🏥', 'mindfulness': '🧘',
    'investment': '💰', 'learning': '📚', 'business': '💼', 'incentives': '🎁',
    'evolution': '🧬', 'creativity': '🎨', 'mathematics': '🔢', 'history': '📜',
    'engineering': '⚙️', 'complex': '🌀', 'statistics': '📊', 'neuroscience': '🧠',
    'game': '🎲', 'habit': '🔄', 'economics': '📊', 'practical': '🛠️',
    'ritual': '🕯️', 'narrative': '📖', 'constraint': '🔒', 'emergence': '🌟'
  };
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.toLowerCase().includes(key)) return icon;
  }
  return '🧩';
}

function getColor(number) {
  const colors = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', 
    '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
    '#6366F1', '#F97316', '#14B8A6', '#A855F7'
  ];
  return colors[number % colors.length];
}

function getDifficulty(tier) {
  return tier <= 1 ? 'advanced' : tier <= 2 ? 'intermediate' : 'beginner';
}

function extractTags(text) {
  const commonTags = [
    'thinking', 'decision-making', 'systems', 'psychology', 'physics',
    'energy', 'time', 'complexity', 'information', 'behavior', 'strategy',
    'learning', 'consciousness', 'optimization', 'feedback', 'design',
    'interaction', 'communication', 'creativity', 'logic', 'data'
  ];
  
  return commonTags.filter(tag => 
    text.toLowerCase().includes(tag.toLowerCase())
  ).slice(0, 5);
}

function parseSourcesString(sources) {
  return sources.split(',').map(source => {
    const cleaned = source.trim();
    // Extract title and author from patterns like "Title (Author)"
    const match = cleaned.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (match) {
      return {
        id: cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        title: match[1].trim(),
        author: match[2].trim(),
        type: 'book',
        url: '',
        highlights: [],
        accessedAt: new Date().toISOString()
      };
    }
    return {
      id: cleaned.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: cleaned,
      author: 'Unknown',
      type: 'book',
      url: '',
      highlights: [],
      accessedAt: new Date().toISOString()
    };
  });
}

// Generate TypeScript file
const tsContent = `// Generated from Readwise Frameworks.md
// Do not edit this file directly - run npm run parse-readwise to regenerate

import type { Domain, MentalModel } from '@/types';

export const READWISE_DOMAINS: Domain[] = ${JSON.stringify(domains, null, 2)};

export const READWISE_MODELS: MentalModel[] = ${JSON.stringify(
  models, null, 2
)};

export function getReadwiseDomainBySlug(slug: string): Domain | undefined {
  return READWISE_DOMAINS.find(domain => domain.slug === slug);
}

export function getReadwiseModelBySlug(slug: string): MentalModel | undefined {
  return READWISE_MODELS.find(model => model.slug === slug);
}

export function getReadwiseModelsByDomain(domainSlug: string): MentalModel[] {
  return READWISE_MODELS.filter(model => model.domainSlug === domainSlug);
}

export function getReadwiseModelsByTier(tier: number): MentalModel[] {
  const domainIds = READWISE_DOMAINS
    .filter(domain => domain.tier === tier)
    .map(domain => domain.slug);
  return READWISE_MODELS.filter(model => domainIds.includes(model.domainSlug));
}

export function searchReadwiseContent(query: string): Array<Domain | MentalModel> {
  const searchTerm = query.toLowerCase();
  const results: Array<Domain | MentalModel> = [];
  
  // Search domains
  READWISE_DOMAINS.forEach(domain => {
    if (domain.name.toLowerCase().includes(searchTerm) ||
        domain.description.toLowerCase().includes(searchTerm)) {
      results.push(domain);
    }
  });
  
  // Search models
  READWISE_MODELS.forEach(model => {
    if (model.name.toLowerCase().includes(searchTerm) ||
        model.description.toLowerCase().includes(searchTerm) ||
        model.principles.some(p => p.toLowerCase().includes(searchTerm))) {
      results.push(model);
    }
  });
  
  return results;
}
`;

// Write the TypeScript file
fs.writeFileSync(outputPath, tsContent);

console.log(`✅ Generated ${domains.length} domains with ${models.length} models`);
console.log(`📁 Output written to: ${outputPath}`);

// Print summary
console.log('\n📊 Summary:');
console.log(`Tier 1 (Foundational): ${domains.filter(d => d.tier === 1).length} domains`);
console.log(`Tier 2 (Core Cognitive): ${domains.filter(d => d.tier === 2).length} domains`);
console.log(`Tier 3 (Applied Domain): ${domains.filter(d => d.tier === 3).length} domains`);
console.log(`Tier 4 (Specialized): ${domains.filter(d => d.tier === 4).length} domains`);
