// Parser for domains 26-30 curation file
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
}

export interface ModelHighlights {
  modelId: string;
  modelTitle: string;
  modelDescription: string;
  curatedHighlights: CuratedHighlight[];
}

export function parseDomains26to30File(): ModelHighlights[] {
  try {
    const filePath = path.join(process.cwd(), 'Readwise website notes/domains-26-30-curation.md');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    const models: ModelHighlights[] = [];
    
    // Split by model sections (looking for ### pattern)
    const sections = fileContent.split(/### \d+[A-Z]:/);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      
      // Extract JSON blocks from each section
      const jsonMatches = section.match(/```json\n([\s\S]*?)\n```/g);
      
      if (jsonMatches && jsonMatches.length > 0) {
        try {
          // Parse the first JSON block (main model data)
          const jsonContent = jsonMatches[0].replace(/```json\n/, '').replace(/\n```/, '');
          const modelData = JSON.parse(jsonContent);
          
          models.push({
            modelId: modelData.modelId,
            modelTitle: modelData.modelTitle,
            modelDescription: modelData.modelDescription,
            curatedHighlights: modelData.curatedHighlights || []
          });
        } catch (error) {
          console.error('Error parsing JSON in section:', error);
        }
      }
    }
    
    return models;
  } catch (error) {
    console.error('Error reading domains 26-30 file:', error);
    return [];
  }
}

// Mapping between model slugs in our data and model IDs in the curation file
const MODEL_SLUG_TO_ID_MAPPING: { [key: string]: string } = {
  'combinatorial-creativity-recombination': 'combinatorial-creativity',
  'aesthetic-innovation-mathematical-beauty': 'aesthetic-innovation',
  'pattern-recognition-constants': 'pattern-recognition-constants',
  'logic-optimization-constraints': 'logic-optimization-constraints',
  'historical-cycles-pendulum': 'historical-cycles-pendulum',
  'institutional-path-dependence': 'institutional-path-dependence',
  'design-principles-user-mental-models': 'design-principles-user-models',
  'reliability-safety-margins': 'reliability-safety-margins',
  'network-effects-emergent-behavior': 'network-effects-emergence'
};

// Get highlights for a specific model slug
export function getModelHighlightsFromFile(modelSlug: string): ModelHighlights | null {
  const allModels = parseDomains26to30File();
  const modelId = MODEL_SLUG_TO_ID_MAPPING[modelSlug] || modelSlug;
  return allModels.find(model => model.modelId === modelId) || null;
}
