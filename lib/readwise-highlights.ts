// Readwise highlights integration for mental models

export interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string;
  tags: string[];
  book: {
    id: number;
    title: string;
    author: string;
    cover_image_url?: string;
  };
  created_at: string;
  updated_at: string;
  url?: string;
}

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

import { getModelHighlightsFromAllDomains, parseAllDomainFiles } from './parse-all-domains';

// Parse all domain files to extract highlights
export function parseAllDomainsHighlights(): ModelHighlights[] {
  return parseAllDomainFiles();
}

import { getCachedHighlight } from './readwise-cache';

// Fetch actual highlight text from Readwise API (with caching)
export async function fetchReadwiseHighlight(highlightId: number): Promise<ReadwiseHighlight | null> {
  return getCachedHighlight(highlightId, async (id) => {
    const apiToken = process.env.READWISE_API_TOKEN;
    
    if (!apiToken) {
      console.warn('READWISE_API_TOKEN not found');
      return null;
    }

    try {
      const response = await fetch(`https://readwise.io/api/v2/highlights/${id}`, {
        headers: {
          'Authorization': `Token ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch highlight ${id}:`, response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching highlight ${id}:`, error);
      return null;
    }
  });
}

// Get highlights for a specific model
export async function getModelHighlights(modelSlug: string): Promise<{
  curatedHighlights: CuratedHighlight[];
  actualHighlights: ReadwiseHighlight[];
}> {
  const modelHighlights = getModelHighlightsFromAllDomains(modelSlug);
  
  if (!modelHighlights) {
    return { curatedHighlights: [], actualHighlights: [] };
  }

  // Fetch actual highlight text for each curated highlight
  const actualHighlights: ReadwiseHighlight[] = [];
  
  for (const curated of modelHighlights.curatedHighlights) {
    const highlight = await fetchReadwiseHighlight(curated.readwiseId);
    if (highlight) {
      actualHighlights.push(highlight);
    }
  }

  return {
    curatedHighlights: modelHighlights.curatedHighlights,
    actualHighlights
  };
}
