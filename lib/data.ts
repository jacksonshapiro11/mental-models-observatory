export interface MentalModel {
  id: string;
  code?: string; // Optional field for sub-model codes like "1A", "2B", etc.
  name: string;
  slug: string;
  description: string;
  domain: string;
  domainSlug: string;
  principles: string[];
  examples: string[];
  applications: string[];
  relatedModels: string[];
  sources: Source[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  number?: number; // Domain number in the framework (1-40)
  tier?: number; // Tier level (1-4)
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  models: string[];
  parentDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  title: string;
  author: string;
  type: 'book' | 'article' | 'paper' | 'video' | 'podcast';
  url?: string;
  readwiseId?: number;
  highlights: string[];
  publishedAt?: string;
  accessedAt: string;
}

export interface SearchResult {
  type: 'model' | 'domain' | 'source';
  id: string;
  title: string;
  description: string;
  url: string;
  relevance: number;
}

// Import the parsed Readwise data
import {
    READWISE_DOMAINS,
    READWISE_MODELS
} from './readwise-data';

/**
 * Mental models data from Readwise framework
 */
export const SAMPLE_MODELS: MentalModel[] = READWISE_MODELS as MentalModel[];

/**
 * Domains data from Readwise framework
 */
export const SAMPLE_DOMAINS: Domain[] = READWISE_DOMAINS as Domain[];

/**
 * Get all mental models
 */
export function getAllModels(): MentalModel[] {
  return SAMPLE_MODELS;
}

/**
 * Get all domains
 */
export function getAllDomains(): Domain[] {
  return SAMPLE_DOMAINS;
}

/**
 * Get a mental model by slug
 */
export function getModelBySlug(slug: string): MentalModel | undefined {
  return SAMPLE_MODELS.find(model => model.slug === slug);
}

/**
 * Get a domain by slug
 */
export function getDomainBySlug(slug: string): Domain | undefined {
  return SAMPLE_DOMAINS.find(domain => domain.slug === slug);
}

/**
 * Get models by domain
 */
export function getModelsByDomain(domainSlug: string): MentalModel[] {
  return SAMPLE_MODELS.filter(model => model.domainSlug === domainSlug);
}

/**
 * Search models and domains
 */
export function searchContent(query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const searchTerm = query.toLowerCase();

  // Search models
  SAMPLE_MODELS.forEach(model => {
    const relevance = calculateRelevance(model, searchTerm);
    if (relevance > 0) {
      results.push({
        type: 'model',
        id: model.id,
        title: model.name,
        description: model.description,
        url: `/models/${model.slug}`,
        relevance
      });
    }
  });

  // Search domains
  SAMPLE_DOMAINS.forEach(domain => {
    const relevance = calculateRelevance(domain, searchTerm);
    if (relevance > 0) {
      results.push({
        type: 'domain',
        id: domain.id,
        title: domain.name,
        description: domain.description,
        url: `/knowledge-domains/${domain.slug}`,
        relevance
      });
    }
  });

  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Calculate search relevance score
 */
function calculateRelevance(item: MentalModel | Domain, searchTerm: string): number {
  let score = 0;
  
  if (item.name.toLowerCase().includes(searchTerm)) score += 10;
  if (item.description.toLowerCase().includes(searchTerm)) score += 5;
  
  if ('tags' in item) {
    const model = item as MentalModel;
    model.tags.forEach(tag => {
      if (tag.toLowerCase().includes(searchTerm)) score += 3;
    });
  }
  
  return score;
}

/**
 * Get related models
 */
export function getRelatedModels(modelSlug: string): MentalModel[] {
  const model = getModelBySlug(modelSlug);
  if (!model) return [];
  
  return SAMPLE_MODELS.filter(m => 
    model.relatedModels.includes(m.slug) || 
    m.relatedModels.includes(model.slug)
  );
}

/**
 * Get models by difficulty level
 */
export function getModelsByDifficulty(difficulty: MentalModel['difficulty']): MentalModel[] {
  return SAMPLE_MODELS.filter(model => model.difficulty === difficulty);
}

/**
 * Get all tags
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  SAMPLE_MODELS.forEach(model => {
    model.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Get models by tag
 */
export function getModelsByTag(tag: string): MentalModel[] {
  return SAMPLE_MODELS.filter(model => 
    model.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
}
