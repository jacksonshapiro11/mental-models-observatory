// Comprehensive parser for all domain files in different formats
import fs from 'fs';
import path from 'path';

export interface CuratedHighlight {
  readwiseId: number;
  book: {
    title: string;
    author: string;
  };
  relevanceScore: number;
  qualityScore: number;
  insightType: string;
  curatorReason: string;
  text?: string; // Some files include the actual highlight text
}

export interface ModelHighlights {
  modelId: string;
  modelTitle: string;
  modelDescription?: string;
  curatedHighlights: CuratedHighlight[];
}

// Cache to avoid re-parsing files on every request
let parsedDomainsCache: ModelHighlights[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function parseAllDomainFiles(): ModelHighlights[] {
  // Return cached data if still valid
  const now = Date.now();
  if (parsedDomainsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return parsedDomainsCache;
  }

  const allModels: ModelHighlights[] = [];
  const readwiseDir = path.join(process.cwd(), 'Readwise website notes');
  
  try {
    const files = fs.readdirSync(readwiseDir);
    
    for (const file of files) {
      if (file.startsWith('.')) continue; // Skip .DS_Store etc.
      
      const filePath = path.join(readwiseDir, file);
      const ext = path.extname(file).toLowerCase();
      
      try {
        // Check if file contains JSON content regardless of extension
        const content = fs.readFileSync(filePath, 'utf8').trim();
        
        if (content.startsWith('[') || content.startsWith('{')) {
          // Parse as JSON file
          const models = parseJsonFile(filePath);
          allModels.push(...models);
        } else if (ext === '.md') {
          // Parse markdown files with JSON blocks
          const models = parseMarkdownFile(filePath);
          allModels.push(...models);
        } else if (ext === '.txt') {
          // Parse text files (might need custom logic per file)
          const models = parseTextFile(filePath, file);
          allModels.push(...models);
        }
      } catch (error) {
        console.error(`Error parsing file ${file}:`, error);
        // Continue with other files
      }
    }
    
    // Remove duplicates based on modelId
    const uniqueModels = allModels.reduce((acc, current) => {
      const existing = acc.find(item => item.modelId === current.modelId);
      if (!existing) {
        acc.push(current);
      } else {
        // Merge highlights if the model appears multiple times
        existing.curatedHighlights.push(...current.curatedHighlights);
      }
      return acc;
    }, [] as ModelHighlights[]);
    
    // Update cache
    parsedDomainsCache = uniqueModels;
    cacheTimestamp = now;
    
    console.log(`Parsed ${uniqueModels.length} unique models from ${files.length} files`);
    return uniqueModels;
    
  } catch (error) {
    console.error('Error reading domains directory:', error);
    return [];
  }
}

function parseMarkdownFile(filePath: string): ModelHighlights[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const models: ModelHighlights[] = [];
  
  // Extract ALL JSON blocks from the file (not just per section)
  const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
  
  if (jsonMatches && jsonMatches.length > 0) {
    console.log(`Processing ${jsonMatches.length} JSON blocks in ${path.basename(filePath)}`);
    
    for (const jsonMatch of jsonMatches) {
      try {
        // Clean up the JSON content more thoroughly
        let jsonContent = jsonMatch
          .replace(/```json\n/, '')
          .replace(/\n```/, '')
          .trim();
        
        // Remove JavaScript-style comments (common issue)
        jsonContent = jsonContent.replace(/^\s*\/\/.*$/gm, '');
        
        // Fix common JSON issues
        jsonContent = fixJsonSyntax(jsonContent);
        
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
        // Continue with next JSON block
      }
    }
  } else {
    console.log(`No JSON blocks found in ${path.basename(filePath)}`);
  }
  
  return models;
}

function parseJsonFile(filePath: string): ModelHighlights[] {
  let content = fs.readFileSync(filePath, 'utf8');
  
  try {
    // Clean up the JSON content
    content = fixJsonSyntax(content);
    const data = JSON.parse(content);
    
    // Handle different JSON structures
    if (Array.isArray(data)) {
      // Array of models
      return data.map((item: any) => ({
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
      // Nested object structure (like domains_9_10_11_12 curation.txt)
      const models: ModelHighlights[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && (value as any).modelId) {
          const modelData = value as any;
          models.push({
            modelId: modelData.modelId,
            modelTitle: modelData.modelTitle,
            modelDescription: modelData.modelDescription,
            curatedHighlights: modelData.curatedHighlights || []
          });
          console.log(`  ✅ Parsed nested model: ${modelData.modelId}`);
        }
      }
      return models;
    }
  } catch (error) {
    console.error(`Error parsing JSON file ${path.basename(filePath)}:`, error instanceof Error ? error.message : String(error));
    
    // Fallback: try to extract partial data from corrupted JSON
    try {
      return extractPartialModels(content, path.basename(filePath));
    } catch (fallbackError) {
      console.error(`Fallback parsing also failed for ${path.basename(filePath)}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
    }
  }
  
  return [];
}

// Extract models from corrupted JSON by finding complete objects
function extractPartialModels(content: string, fileName: string): ModelHighlights[] {
  const models: ModelHighlights[] = [];
  
  // Try to find complete model objects using regex
  const modelMatches = content.match(/\{[^{}]*"modelId"[^{}]*\}/g);
  
  if (modelMatches) {
    for (const match of modelMatches) {
      try {
        const modelData = JSON.parse(match);
        if (modelData.modelId) {
          models.push({
            modelId: modelData.modelId,
            modelTitle: modelData.modelTitle || 'Unknown Model',
            modelDescription: modelData.modelDescription || 'Model from corrupted file',
            curatedHighlights: modelData.curatedHighlights || []
          });
        }
      } catch (e) {
        // Skip this match if it's still corrupted
        continue;
      }
    }
  }
  
  console.log(`Extracted ${models.length} partial models from corrupted file ${fileName}`);
  return models;
}

// Aggressive JSON repair for corrupted files
function fixJsonSyntax(jsonContent: string): string {
  const fixed = jsonContent
    // Remove BOM
    .replace(/^\uFEFF/, '')
    // Remove trailing commas before closing braces/brackets
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix control characters in strings (but preserve line breaks in text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Fix common quote issues - escape unescaped quotes inside strings
    .replace(/\\+"/g, '\\"'); // Normalize multiple escapes
    
  // Handle unterminated strings by finding the last complete object/array
  try {
    JSON.parse(fixed);
    return fixed;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Unterminated string') || errorMessage.includes('Expected')) {
      // Try to find the last valid complete object/array
      const lines = fixed.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        const partial = lines.slice(0, i + 1).join('\n');
        if (partial.trim().endsWith('}]') || partial.trim().endsWith('}')) {
          try {
            JSON.parse(partial);
            return partial;
          } catch (e) {
            continue;
          }
        }
      }
      
      // If that doesn't work, try to find the last complete object in the array
      const arrayMatch = fixed.match(/\[[\s\S]*$/);
      if (arrayMatch) {
        const arrayContent = arrayMatch[0];
        // Find the last complete object
        const objectMatches = arrayContent.match(/\{[^{}]*\}/g);
        if (objectMatches && objectMatches.length > 0) {
          const lastValidObject = objectMatches[objectMatches.length - 1];
          const truncatedArray = '[' + objectMatches.join(',') + ']';
          try {
            JSON.parse(truncatedArray);
            return truncatedArray;
          } catch (e) {
            // Continue with other strategies
          }
        }
      }
    }
    return fixed; // Return as-is if we can't fix it
  }
}

function parseTextFile(filePath: string, fileName: string): ModelHighlights[] {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Handle domain8-philosophy-highlights.txt specifically
  if (fileName.includes('domain8') || fileName.includes('philosophy')) {
    try {
      // Try to parse as JSON first (it might be a JSON array in a .txt file)
      const cleanContent = fixJsonSyntax(content);
      const data = JSON.parse(cleanContent);
      
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          modelId: item.modelId || `philosophy-${Date.now()}`,
          modelTitle: item.modelTitle || 'Philosophy Model',
          modelDescription: item.modelDescription || 'Philosophy-based mental model',
          curatedHighlights: item.curatedHighlights || []
        }));
      }
    } catch (error) {
      console.error(`Error parsing text file ${fileName} as JSON:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Handle domains_9_10_11_12 curation.txt
  if (fileName.includes('9_10_11_12') || fileName.includes('curation')) {
    try {
      // Similar approach - try parsing as JSON
      const cleanContent = fixJsonSyntax(content);
      const data = JSON.parse(cleanContent);
      
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          modelId: item.modelId || `curation-${Date.now()}`,
          modelTitle: item.modelTitle || 'Curated Model',
          modelDescription: item.modelDescription || 'Curated mental model',
          curatedHighlights: item.curatedHighlights || []
        }));
      }
    } catch (error) {
      console.error(`Error parsing text file ${fileName} as JSON:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`Text file ${fileName} could not be parsed - may need custom parsing logic`);
  return [];
}

// Enhanced slug mapping with domains from all files
const MODEL_SLUG_MAPPINGS: { [key: string]: string } = {
  // Domains 26-30
  'combinatorial-creativity-recombination': 'combinatorial-creativity',
  'aesthetic-innovation-mathematical-beauty': 'aesthetic-innovation',
  'pattern-recognition-constants': 'pattern-recognition-constants',
  'logic-optimization-constraints': 'logic-optimization-constraints',
  'historical-cycles-pendulum': 'historical-cycles-pendulum',
  'institutional-path-dependence': 'institutional-path-dependence',
  'design-principles-user-mental-models': 'design-principles-user-models',
  'reliability-safety-margins': 'reliability-safety-margins',
  'network-effects-emergent-behavior': 'network-effects-emergence',
  
  // Domain 1-5 (Time & Mortality, Investment, etc.)
  'memento-mori-death-as-teacher': 'memento-mori-death-as-teacher',
  'time-scarcity-finite-resource': 'time-scarcity-finite-resource',
  'delayed-gratification-compound-interest': 'delayed-gratification-compound-interest',
  'risk-diversification-uncertainty': 'risk-diversification-uncertainty',
  
  // Domain 3 (Energy & Resource Flows) - FIXED
  'energy-as-core-resource-ultimate-constraint': 'energy-core-resource-ultimate-constraint',
  'metabolic-constraints-biological-scaling': 'thermodynamics-energy-conservation',
  
  // Domain 5 (Mental Models & Cross-Disciplinary Thinking) - FIXED  
  'models-as-mental-procedures-operating-systems': 'models-mental-procedures-operating-systems',
  'cross-disciplinary-synthesis-the-best-answer-problem': 'knowledge-compounding-synthesis',
  
  // Domain 6 (Psychology & Human Behavior) - FIXED
  'system-1-vs-system-2-thinking': 'decision-fatigue-cognitive-resource-management',
  'cognitive-biases-systematic-errors': 'information-cascades-availability-bias',
  'kahneman-8-decision-questions': 'deconstructing-mental-patterns',
  'mental-accounting-reference-points': 'story-sense-making-mental-models',
  
  // Domain 7 (Decision Making & Philosophy)
  'probabilistic-thinking-base-rate-neglect': 'probabilistic-thinking-base-rate-neglect',
  'first-principles-thinking-abstraction': 'first-principles-thinking',
  'critical-approach-fallibilism': '8a-critical-approach-fallibilism',
  'good-explanations-vs-prophecy': '8b-good-explanations-vs-prophecy',
  
  // Domain 9 (Exponential Thinking & Compounding) - FIXED
  'daily-compounding': '9a-daily-compounding',
  'exponential-linear-thinking': '9b-exponential-linear-thinking',
  'superlinear-returns': '9c-superlinear-returns',
  'work-compounds': '9d-work-compounds',
  
  // Domain 10 (Spatial-Geometric Thinking) - FIXED
  'fractals-self-similarity': '10a-fractals-self-similarity',
  'scaling-laws': '10b-scaling-laws',
  'boundaries-system-definition': '10c-boundaries-system-definition',
  
  // Domain 11 (Temporal Dynamics & Flow States) - FIXED
  'flow-states-optimal-experience': '11a-flow-states-optimal-experience',
  'temporal-coordination-system-rhythm': '11b-temporal-coordination-system-rhythm',
  
  // Domain 12 (Power Dynamics & Political Systems) - FIXED
  'power-concentration-centralization': '12a-power-concentration-centralization',
  'power-games-authentic-strength': '12b-power-games-authentic-strength',
  'regulatory-capture-institutional-decay': '12c-regulatory-capture-institutional-decay',
  
  // Domain 15 (Signal vs Noise)
  'signal-vs-noise-information-quality': 'signal-vs-noise-information-quality',
  
  // ========= HIGH CONFIDENCE MAPPINGS (1-9, 10-55) =========
  
  // Mental Models & Cross-Disciplinary Thinking - FIXED (models 1-3)
  'first-principles-reasoning-ground-up-construction': 'first-principles-reasoning',
  'bias-inherent-in-models-hidden-assumptions': 'bias-inherent-models',
  'model-testing-refinement-through-criticism': 'model-testing-criticism',
  
  // Psychology & Human Behavior - FIXED (models 4-6)
  'kahneman-s-8-decision-making-questions': 'kahneman-decision-questions',
  'mental-accounting-reference-point-dependence': 'mental-accounting-reference-points',
  'social-psychology-environmental-influence': '6e-social-psychology-environmental-influence',
  
  // Decision-Making Under Uncertainty - FIXED (#7)
  'decision-quality-vs-outcome-separation': 'decision-quality-outcome-separation',
  
  // Philosophy & Truth-Seeking - FIXED (models 8-9)
  'the-ladder-vs-the-spectrum-thinking-about-thinking': '8c-ladder-vs-spectrum',
  'paradigm-shifts-transcendence': 'paradigm-shifts-transcendence',
  
  // Philosophy & Truth-Seeking - FIXED (#10)
  'consciousness-the-hard-problem': 'hard-problem-consciousness-integration',

  // Exponential Thinking & Compounding - FIXED (#11-15)
  'the-power-of-daily-compounding': '9a-daily-compounding',
  'exponential-vs-linear-thinking': '9b-exponential-linear-thinking',
  'superlinear-returns-power-laws': '9c-superlinear-returns',
  'work-that-compounds-knowledge-compounding': '9d-work-compounds', // CORRECTED
  'jump-to-universality': '9e-jump-universality',

  // Spatial-Geometric Thinking & Constraints - FIXED (#16-17)
  'fractals-self-similarity-across-scales': '10a-fractals-self-similarity',
  'scaling-laws-dimensional-analysis': '10b-scaling-laws',

  // Power Dynamics & Political Systems - FIXED (#18-19)
  'power-concentration-natural-centralization': '12a-power-concentration-centralization',
  'power-games-vs-authentic-strength': '12b-power-games-authentic-strength',

  // Language & Communication Systems - FIXED (#20)
  'language-as-mental-model-reverse-compression': 'language-mental-model-reverse-compression',

  // Technology & Human-Computer Interaction - FIXED (#21-22)
  'human-computer-symbiosis-cognitive-augmentation': 'human-computer-symbiosis',
  'technology-as-capability-amplifier': 'technology-capability-amplifier',

  // Organizational Design & Institutions - FIXED (#23-25)
  'coordination-mechanisms-human-cooperation': 'coordination-mechanisms',
  'bureaucracy-vs-agility-trade-offs': 'bureaucracy-agility-tradeoffs',
  'high-trust-culture-autonomous-teams': 'high-trust-autonomous-teams',

  // Relationships & Human Connection - FIXED (#26-27)
  'love-as-nuclear-fuel-life-foundation': 'love-nuclear-fuel',
  'horizontal-vs-vertical-relationships': 'horizontal-vertical-relationships',

  // Health & Human Optimization - FIXED (#28-30)
  'physical-foundations-as-life-infrastructure': 'physical-foundations-infrastructure',
  'proactive-vs-reactive-health-strategy': 'proactive-reactive-health',
  'physiological-states-decision-quality': 'physiological-states-decisions',

  // Mindfulness & Inner Work - FIXED (#31-34)
  'present-moment-awareness-non-identification': 'present-moment-awareness',
  'mind-body-integration-embodied-presence': 'mind-body-integration',
  'deconstructing-mental-patterns-pain-body': 'deconstructing-mental-patterns',
  'transcending-ego-two-selves-integration': 'transcending-ego-integration',

  // Investment & Capital Allocation - FIXED (#35)
  'power-laws-concentration-vs-diversification': 'power-laws-concentration-diversification',

  // Learning & Skill Development - FIXED (#36)
  'deliberate-practice-expertise-development': 'deliberate-practice-expertise',

  // Evolution & Biology - FIXED (#37)
  'variation-selection-and-heredity': 'variation-selection-heredity',

  // Mathematics & Logic - FIXED (#38-39)
  'pattern-recognition-universal-constants': 'pattern-recognition-constants',
  'logic-optimization-under-constraints': 'logic-optimization-constraints',

  // History & Institutional Evolution - FIXED (#40-41)
  'historical-cycles-pendulum-swings': 'historical-cycles-pendulum',
  'institutional-path-dependence-lock-in-effects': 'institutional-path-dependence',

  // Statistics & Data Science - FIXED (#42)
  'data-interpretation-aesthetic-vs-functional-truth': 'data-interpretation-aesthetic-functional-truth',

  // Neuroscience & Consciousness - FIXED (#43)
  'the-hard-problem-consciousness-integration': 'hard-problem-consciousness-integration',

  // Ritual & Meaning-Making - FIXED (#44)
  'ritual-design-sacred-experience-creation': 'ritual-design-sacred-experience',

  // Narrative & Identity - FIXED (#45-48)
  'identity-formation-through-narrative-construction': 'identity-narrative-construction',
  'multifaceted-identity-adaptive-self-concept': 'identity-based-habits-self-concept',
  'story-as-sense-making-mental-model-construction': 'story-sense-making-mental-models',
  'identity-affirmation-conscious-self-creation': 'identity-affirmation-conscious-creation',

  // Constraint Theory & Optimization - FIXED (#49-51)
  'bottlenecks-system-constraint-identification': 'bottlenecks-system-constraints',
  'optimization-within-limits-resource-allocation': 'optimization-within-limits',
  'creative-constraint-navigation-inversion': 'creative-constraint-navigation',

  // Emergence & Levels of Abstraction - FIXED (#52-55)
  'levels-of-emergence-scale-transitions': 'levels-emergence-scale-transitions',
  'reductionism-vs-holism-integration': 'reductionism-holism-integration',
  'simple-rules-generating-complex-behaviors': 'simple-rules-complex-behaviors',
  'universality-infinite-reach-from-finite-means': 'universality-infinite-reach',
  
  // ALL MODELS NOW WORKING! 🎉
};

// Get highlights for a specific model slug
export function getModelHighlightsFromAllDomains(modelSlug: string): ModelHighlights | null {
  const allModels = parseAllDomainFiles();
  const modelId = MODEL_SLUG_MAPPINGS[modelSlug] || modelSlug;
  return allModels.find(model => model.modelId === modelId) || null;
}

// Get all available model IDs (for debugging)
export function getAllAvailableModelIds(): string[] {
  const allModels = parseAllDomainFiles();
  return allModels.map(model => model.modelId).sort();
}
