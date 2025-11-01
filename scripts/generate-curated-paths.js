/**
 * Generate 50-100 curated learning paths using ACTUAL models from readwise-data.ts
 * This creates thoughtfully designed learning journeys with real model slugs
 */

const fs = require('fs');
const path = require('path');

// Import the actual models by requiring the compiled data module
// We'll read the raw TS file and extract the JSON data
const readwiseDataPath = path.join(__dirname, '../lib/readwise-data.ts');
const content = fs.readFileSync(readwiseDataPath, 'utf-8');

// Extract the READWISE_MODELS array
const modelsMatch = content.match(/export const READWISE_MODELS: MentalModel\[\] = (\[[\s\S]*?\n\]);/);
if (!modelsMatch) {
  console.error('❌ Could not find READWISE_MODELS in readwise-data.ts');
  process.exit(1);
}

// Parse the JSON (it's valid JSON in the TS file)
const models = JSON.parse(modelsMatch[1]);

console.log(`✅ Loaded ${models.length} models from readwise-data.ts`);

// Helper functions
function getModelsByDomain(domainName) {
  return models.filter(m => m.domain === domainName);
}

function getModelsByDifficulty(difficulty) {
  return models.filter(m => m.difficulty === difficulty);
}

function getRandomModels(count, filter = null) {
  const pool = filter ? models.filter(filter) : models;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function findModelsByKeywords(...keywords) {
  return models.filter(m => 
    keywords.some(kw => 
      m.name.toLowerCase().includes(kw.toLowerCase()) ||
      m.description.toLowerCase().includes(kw.toLowerCase())
    )
  );
}

// Generate curated paths
const curatedPaths = [];

// Get all unique domains
const allDomains = [...new Set(models.map(m => m.domain))];
console.log(`\n📁 Found ${allDomains.length} domains`);

// CATEGORY 1: FOUNDATIONAL THINKING (Beginner-friendly)
const beginnerModels = getModelsByDifficulty('beginner');
if (beginnerModels.length >= 4) {
  curatedPaths.push({
    id: 'foundations-clear-thinking',
    title: 'Foundations of Clear Thinking',
    description: 'Start your journey with the most essential mental models for better decision-making',
    level: 'beginner',
    category: 'foundational',
    estimatedTime: '2-3 hours',
    icon: '🧠',
    tags: ['thinking', 'decision-making', 'beginner'],
    modelSlugs: beginnerModels.slice(0, 5).map(m => m.slug)
  });
}

// CATEGORY 2: BY DOMAIN - Create a path for each major domain
allDomains.forEach(domain => {
  const domainModels = getModelsByDomain(domain);
  if (domainModels.length >= 3) {
    const domainSlug = domain.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const difficulty = domainModels[0].difficulty || 'intermediate';
    
    curatedPaths.push({
      id: `${domainSlug}-essentials`,
      title: `${domain}: Essential Models`,
      description: `Master the key mental models in ${domain.toLowerCase()}`,
      level: difficulty,
      category: 'domain-focused',
      estimatedTime: `${Math.ceil(domainModels.length * 0.4)}-${Math.ceil(domainModels.length * 0.6)} hours`,
      icon: getIconForDomain(domain),
      tags: [domainSlug, 'domain-focused', difficulty],
      modelSlugs: domainModels.slice(0, Math.min(7, domainModels.length)).map(m => m.slug)
    });
    
    // If domain has many models, create a "deep dive" path too
    if (domainModels.length >= 6) {
      curatedPaths.push({
        id: `${domainSlug}-deep-dive`,
        title: `${domain}: Deep Dive`,
        description: `Go deeper into ${domain.toLowerCase()} with advanced applications`,
        level: 'advanced',
        category: 'domain-focused',
        estimatedTime: `${Math.ceil(domainModels.length * 0.6)}-${Math.ceil(domainModels.length * 0.8)} hours`,
        icon: getIconForDomain(domain),
        tags: [domainSlug, 'deep-dive', 'advanced'],
        modelSlugs: domainModels.slice(0, Math.min(10, domainModels.length)).map(m => m.slug)
      });
    }
  }
});

// CATEGORY 3: THEMATIC CROSS-DOMAIN PATHS
const thematicPaths = [
  {
    id: 'decision-making-mastery',
    title: 'Decision-Making Mastery',
    description: 'A comprehensive toolkit for making better decisions under uncertainty',
    keywords: ['decision', 'choice', 'judgment', 'probability', 'bayesian'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '🎯',
    tags: ['decision-making', 'cross-domain'],
    maxModels: 8
  },
  {
    id: 'systems-thinking-journey',
    title: 'Systems Thinking Journey',
    description: 'Learn to see the interconnections, feedback loops, and emergent properties',
    keywords: ['system', 'feedback', 'loop', 'emergence', 'complexity', 'network'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '🔄',
    tags: ['systems', 'complexity', 'cross-domain'],
    maxModels: 7
  },
  {
    id: 'psychology-human-nature',
    title: 'Psychology & Human Nature',
    description: 'Understand the forces that drive human behavior and decision-making',
    keywords: ['psychology', 'cognitive', 'bias', 'behavior', 'social', 'mental'],
    level: 'beginner',
    category: 'cross-domain',
    icon: '🧑‍🤝‍🧑',
    tags: ['psychology', 'behavior', 'cross-domain'],
    maxModels: 6
  },
  {
    id: 'business-strategy-toolkit',
    title: 'Business Strategy Toolkit',
    description: 'Build competitive advantage and strategic thinking for business',
    keywords: ['business', 'strategy', 'competition', 'moat', 'advantage', 'market'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '📊',
    tags: ['business', 'strategy', 'cross-domain'],
    maxModels: 7
  },
  {
    id: 'learning-acceleration',
    title: 'Learning Acceleration',
    description: 'Meta-cognitive models for learning faster and retaining more',
    keywords: ['learning', 'knowledge', 'mental model', 'thinking', 'reasoning'],
    level: 'beginner',
    category: 'cross-domain',
    icon: '📚',
    tags: ['learning', 'meta-cognition', 'cross-domain'],
    maxModels: 5
  },
  {
    id: 'physics-reality-constraints',
    title: 'Physics & Reality Constraints',
    description: 'Understand the fundamental laws that govern all systems',
    keywords: ['physics', 'energy', 'thermodynamics', 'entropy', 'conservation'],
    level: 'advanced',
    category: 'cross-domain',
    icon: '⚛️',
    tags: ['physics', 'science', 'cross-domain'],
    maxModels: 6
  },
  {
    id: 'time-mortality-meaning',
    title: 'Time, Mortality & Meaning',
    description: 'Confront our finite existence to live more intentionally',
    keywords: ['time', 'mortality', 'death', 'meaning', 'purpose'],
    level: 'advanced',
    category: 'philosophy',
    icon: '⏰',
    tags: ['philosophy', 'mortality', 'existential'],
    maxModels: 4
  },
  {
    id: 'economics-incentives',
    title: 'Economics & Incentives',
    description: 'Understand how incentives shape behavior and outcomes',
    keywords: ['economics', 'incentive', 'market', 'price', 'supply', 'demand'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '💰',
    tags: ['economics', 'incentives', 'cross-domain'],
    maxModels: 6
  },
  {
    id: 'communication-influence',
    title: 'Communication & Influence',
    description: 'Master the art of persuasion and effective communication',
    keywords: ['communication', 'persuasion', 'influence', 'rhetoric', 'story', 'narrative'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '💬',
    tags: ['communication', 'influence', 'cross-domain'],
    maxModels: 5
  },
  {
    id: 'innovation-creativity',
    title: 'Innovation & Creative Thinking',
    description: 'Unlock creative problem-solving and innovative thinking',
    keywords: ['innovation', 'creativity', 'design', 'invention', 'combinatorial'],
    level: 'intermediate',
    category: 'cross-domain',
    icon: '💡',
    tags: ['innovation', 'creativity', 'cross-domain'],
    maxModels: 6
  }
];

thematicPaths.forEach(theme => {
  const themeModels = findModelsByKeywords(...theme.keywords);
  if (themeModels.length >= 3) {
    curatedPaths.push({
      id: theme.id,
      title: theme.title,
      description: theme.description,
      level: theme.level,
      category: theme.category,
      estimatedTime: `${Math.ceil(Math.min(themeModels.length, theme.maxModels) * 0.4)}-${Math.ceil(Math.min(themeModels.length, theme.maxModels) * 0.6)} hours`,
      icon: theme.icon,
      tags: theme.tags,
      modelSlugs: themeModels.slice(0, theme.maxModels).map(m => m.slug)
    });
  }
});

// CATEGORY 4: DIFFICULTY-BASED PROGRESSIVE PATHS
const beginnerPath = getModelsByDifficulty('beginner');
if (beginnerPath.length >= 5) {
  curatedPaths.push({
    id: 'beginner-friendly-start',
    title: 'Beginner-Friendly Start',
    description: 'The easiest mental models to understand and apply immediately',
    level: 'beginner',
    category: 'progressive',
    estimatedTime: '3-4 hours',
    icon: '🌱',
    tags: ['beginner', 'easy-start'],
    modelSlugs: beginnerPath.slice(0, 6).map(m => m.slug)
  });
}

const advancedPath = getModelsByDifficulty('advanced');
if (advancedPath.length >= 5) {
  curatedPaths.push({
    id: 'advanced-mastery',
    title: 'Advanced Mastery Challenge',
    description: 'Complex, nuanced models for experienced learners',
    level: 'advanced',
    category: 'progressive',
    estimatedTime: '5-7 hours',
    icon: '🏆',
    tags: ['advanced', 'challenging'],
    modelSlugs: advancedPath.slice(0, 8).map(m => m.slug)
  });
}

// CATEGORY 5: QUICK WINS (Short paths for busy people)
const quickWinTopics = [
  { keywords: ['decision', 'choice'], title: 'Quick Decision Tools', icon: '⚡' },
  { keywords: ['bias', 'cognitive'], title: 'Bias Awareness Quick Guide', icon: '🧩' },
  { keywords: ['system', 'feedback'], title: 'Systems Thinking Basics', icon: '🔄' }
];

quickWinTopics.forEach(topic => {
  const topicModels = findModelsByKeywords(...topic.keywords);
  if (topicModels.length >= 3) {
    curatedPaths.push({
      id: `quick-${topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: topic.title,
      description: `A focused 30-minute introduction to ${topic.title.toLowerCase()}`,
      level: 'beginner',
      category: 'quick-win',
      estimatedTime: '30-45 minutes',
      icon: topic.icon,
      tags: ['quick-win', 'short'],
      modelSlugs: topicModels.slice(0, 3).map(m => m.slug)
    });
  }
});

// Clean up - ensure all paths have valid model slugs
const validPaths = curatedPaths.filter(p => p.modelSlugs && p.modelSlugs.length >= 3);

console.log(`\n✅ Generated ${validPaths.length} curated paths`);
console.log(`📊 Breakdown:`);
const categories = [...new Set(validPaths.map(p => p.category))];
categories.forEach(cat => {
  console.log(`   - ${cat}: ${validPaths.filter(p => p.category === cat).length}`);
});

// Helper function for domain icons
function getIconForDomain(domain) {
  const iconMap = {
    'Time & Mortality Awareness': '⏰',
    'Physics & Fundamental Constraints': '⚛️',
    'Energy & Resource Flows': '⚡',
    'Systems & Complexity': '🔄',
    'Mental Models & Cross-Disciplinary Thinking': '🧠',
    'Psychology & Human Behavior': '🧑‍🤝‍🧑',
    'Decision-Making & Judgment': '🎯',
    'Probability & Statistics': '🎲',
    'Economics & Incentives': '💰',
    'Business Strategy & Competition': '📊',
    'Communication & Persuasion': '💬',
    'Innovation & Creativity': '💡'
  };
  return iconMap[domain] || '🎓';
}

// Generate TypeScript file
const tsContent = `// Generated curated learning paths using ACTUAL models from readwise-data.ts
// Generated on: ${new Date().toISOString()}
// Total paths: ${validPaths.length}
// Total models used: ${models.length}

export interface CuratedPath {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  estimatedTime: string;
  icon: string;
  tags: string[];
  modelSlugs: string[];
}

export const CURATED_PATHS: CuratedPath[] = ${JSON.stringify(validPaths, null, 2)};

// Helper to get paths by category
export function getPathsByCategory(category: string): CuratedPath[] {
  return CURATED_PATHS.filter(p => p.category === category);
}

// Helper to get paths by level
export function getPathsByLevel(level: 'beginner' | 'intermediate' | 'advanced'): CuratedPath[] {
  return CURATED_PATHS.filter(p => p.level === level);
}

// Helper to get paths containing a specific model
export function getPathsWithModel(modelSlug: string): CuratedPath[] {
  return CURATED_PATHS.filter(p => p.modelSlugs.includes(modelSlug));
}

// Get recommended starter paths
export function getStarterPaths(): CuratedPath[] {
  return CURATED_PATHS.filter(p => 
    p.level === 'beginner' && 
    (p.category === 'foundational' || p.category === 'quick-win')
  ).slice(0, 5);
}
`;

// Write to file
const outputPath = path.join(__dirname, '../lib/curated-learning-paths.ts');
fs.writeFileSync(outputPath, tsContent);

console.log(`\n✅ Written to: ${outputPath}`);
console.log(`\n🎉 Ready to use! All paths use real model slugs from your 119 models.`);
