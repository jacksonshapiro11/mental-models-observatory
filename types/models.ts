export interface Domain {
  id: string;
  slug: string;
  title: string;
  tier: 1 | 2 | 3; // Foundational, Practical, Specialized
  description: string;
  integrationStatement: string;
  subModels: SubModel[];
  sourceBooks: string[]; // Book IDs that contributed to this domain
  relatedDomains: string[]; // IDs of related domains
  totalHighlights: number;
  lastUpdated: string;
}

export interface SubModel {
  id: string;
  domainId: string;
  slug: string;
  title: string;
  definition: string;
  keyApplications: string[];
  examples: Example[];
  sourceHighlights: SourceHighlight[];
  relatedSubModels: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  practicalValue: number; // 1-10 scale
  tags: string[];
}

export interface SourceHighlight {
  readwiseId: number;
  text: string;
  personalNote?: string;
  book: BookReference;
  relevanceScore: number; // How well this highlight supports the model
  context?: string; // Additional context for why this highlight matters
  highlightedAt: string;
}

export interface BookReference {
  id: number;
  title: string;
  author: string;
  coverUrl?: string;
  category: string;
  totalHighlights: number;
  relevantHighlights: number; // How many highlights relate to mental models
}

export interface Example {
  title: string;
  description: string;
  domain: string; // Business, Personal, Academic, etc.
  difficulty: 'simple' | 'complex';
  outcome: string;
}

export interface SearchFilters {
  tiers?: number[];
  domains?: string[];
  difficulty?: string[];
  tags?: string[];
  hasExamples?: boolean;
  minRelevanceScore?: number;
}

export interface SearchResult {
  type: 'domain' | 'submodel' | 'highlight';
  item: Domain | SubModel | SourceHighlight;
  relevanceScore: number;
  matchedFields: string[];
  snippet?: string;
}

export interface SyncResult {
  totalHighlights: number;
  mappedHighlights: number;
  newModels: number;
  updatedModels: number;
  errors: string[];
  processingTime: number;
}

export interface FrameworkStats {
  totalDomains: number;
  totalSubModels: number;
  totalHighlights: number;
  totalBooks: number;
  averageRelevanceScore: number;
  coverageByTier: Record<number, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentActivity: Array<{ date: string; highlights: number; models: number }>;
}

export interface CoverageStats {
  domainCoverage: Array<{ domain: string; coverage: number; highlights: number }>;
  tierCoverage: Record<number, { domains: number; models: number; highlights: number }>;
  gaps: string[]; // Areas that need more highlights
  strengths: string[]; // Well-covered areas
}

export interface BookStats {
  book: BookReference;
  modelsContributed: number;
  highlightsUsed: number;
  averageRelevanceScore: number;
  topModels: string[];
}

export interface RelationshipMap {
  modelId: string;
  relatedModels: Array<{
    modelId: string;
    relationshipType: 'concept' | 'source' | 'application' | 'prerequisite';
    strength: number; // 0-1 scale
    sharedHighlights: number;
  }>;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: Array<{
    order: number;
    modelId: string;
    type: 'domain' | 'submodel';
    estimatedTime: number; // in minutes
    prerequisites: string[];
  }>;
  totalTime: number;
  tags: string[];
}
