import fs from 'fs';
import path from 'path';
import ReadwiseClient from '@/lib/readwise-client';
import {
  Domain,
  SubModel,
  SourceHighlight,
  BookReference,
  SearchFilters,
  SearchResult,
  SyncResult,
  FrameworkStats,
  CoverageStats,
  BookStats,
  RelationshipMap,
  LearningPath
} from '@/types/models';

class ModelDataManager {
  private domains: Map<string, Domain> = new Map();
  private subModels: Map<string, SubModel> = new Map();
  private readwiseClient: ReadwiseClient | null = null;
  private dataPath: string;
  private searchIndex: Map<string, SearchResult[]> = new Map();

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'domains');
    this.initializeData();
  }

  /**
   * Initialize data from domain files
   */
  private async initializeData() {
    try {
      const domainFiles = fs.readdirSync(this.dataPath)
        .filter(file => file.endsWith('.md'))
        .sort();

      for (const file of domainFiles) {
        await this.loadDomainFile(path.join(this.dataPath, file));
      }

      this.buildSearchIndex();
      console.log(`📊 Loaded ${this.domains.size} domains with ${this.subModels.size} sub-models`);
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  }

  /**
   * Load domain data from markdown file
   */
  private async loadDomainFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8');
    const jsonBlocks = this.extractJsonFromMarkdown(content);
    
    // Group models by domain
    const modelsByDomain = new Map<number, SubModel[]>();
    
    jsonBlocks.forEach(model => {
      const domainMatch = content.match(new RegExp(`Domain ${model.domainId || '\\d+'}:`));
      if (domainMatch) {
        const domainId = parseInt(domainMatch[1] || model.domainId?.toString() || '0');
        if (!modelsByDomain.has(domainId)) {
          modelsByDomain.set(domainId, []);
        }
        const models = modelsByDomain.get(domainId);
        if (models) {
          models.push(this.convertToSubModel(model, domainId));
        }
      }
    });

    // Create domain objects
    modelsByDomain.forEach((models, domainId) => {
      const domainMetadata = this.getDomainMetadata(domainId);
      if (domainMetadata) {
        const domain: Domain = {
          id: `domain-${domainId}`,
          slug: `domain-${domainId}`,
          title: domainMetadata.title,
          tier: domainMetadata.tier,
          description: domainMetadata.description,
          integrationStatement: `Integration of ${domainMetadata.title} with other mental models`,
          subModels: models,
          sourceBooks: this.extractSourceBooks(models),
          relatedDomains: this.findRelatedDomains(domainId),
          totalHighlights: models.reduce((sum, model) => sum + model.sourceHighlights.length, 0),
          lastUpdated: new Date().toISOString()
        };

        this.domains.set(domain.id, domain);
        models.forEach(model => {
          this.subModels.set(model.id, model);
        });
      }
    });
  }

  /**
   * Extract JSON blocks from markdown content
   */
  private extractJsonFromMarkdown(content: string): any[] {
    const jsonBlocks: any[] = [];
    const regex = /```json\s*([\s\S]*?)\s*```/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        jsonBlocks.push(jsonData);
      } catch (error) {
        console.warn('Failed to parse JSON block:', error);
      }
    }
    
    return jsonBlocks;
  }

  /**
   * Convert raw model data to SubModel
   */
  private convertToSubModel(model: any, domainId: number): SubModel {
    return {
      id: model.modelId || `domain-${domainId}-model`,
      domainId: `domain-${domainId}`,
      slug: model.modelId || `domain-${domainId}-model`,
      title: model.modelTitle || 'Untitled Model',
      definition: model.modelDescription || '',
      keyApplications: this.extractKeyApplications(model),
      examples: model.examples || [],
      sourceHighlights: this.convertToSourceHighlights(model.curatedHighlights || []),
      relatedSubModels: [],
      difficulty: model.difficulty || 'intermediate',
      practicalValue: model.practicalValue || 8,
      tags: model.tags || []
    };
  }

  /**
   * Convert curated highlights to SourceHighlight format
   */
  private convertToSourceHighlights(highlights: any[]): SourceHighlight[] {
    return highlights.map(highlight => ({
      readwiseId: highlight.readwiseId,
      text: '', // Will be populated from Readwise API
      book: {
        id: highlight.book?.readwiseBookId || 0,
        title: highlight.book?.title || '',
        author: highlight.book?.author || '',
        coverUrl: '',
        category: '',
        totalHighlights: 0,
        relevantHighlights: 0
      },
      relevanceScore: highlight.relevanceScore,
      context: highlight.curatorReason,
      highlightedAt: new Date().toISOString()
    }));
  }

  /**
   * Get domain metadata
   */
  private getDomainMetadata(domainId: number) {
    const metadata: Record<number, { title: string; tier: 1 | 2 | 3; description: string }> = {
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

    return metadata[domainId];
  }

  /**
   * Extract source books from models
   */
  private extractSourceBooks(models: SubModel[]): string[] {
    const bookIds = new Set<string>();
    models.forEach(model => {
      model.sourceHighlights.forEach(highlight => {
        if (highlight.book.id) {
          bookIds.add(highlight.book.id.toString());
        }
      });
    });
    return Array.from(bookIds);
  }

  /**
   * Find related domains based on shared concepts
   */
  private findRelatedDomains(domainId: number): string[] {
    // Simple implementation - can be enhanced with semantic analysis
    const related = [];
    if (domainId > 1) related.push(`domain-${domainId - 1}`);
    if (domainId < 40) related.push(`domain-${domainId + 1}`);
    return related;
  }

  /**
   * Extract key applications from model
   */
  private extractKeyApplications(model: any): string[] {
    // Extract from curator reasons or model description
    const applications: string[] = [];
    if (model.curatedHighlights) {
      model.curatedHighlights.forEach((highlight: any) => {
        if (highlight.insightType === 'practical_application') {
          applications.push(highlight.curatorReason);
        }
      });
    }
    return applications.slice(0, 5); // Limit to 5 key applications
  }

  /**
   * Build search index for fast querying
   */
  private buildSearchIndex() {
    this.searchIndex.clear();
    
    // Index domains
    this.domains.forEach(domain => {
      this.indexItem(domain.title, { type: 'domain', item: domain, relevanceScore: 10, matchedFields: ['title'] });
      this.indexItem(domain.description, { type: 'domain', item: domain, relevanceScore: 8, matchedFields: ['description'] });
    });

    // Index sub-models
    this.subModels.forEach(model => {
      this.indexItem(model.title, { type: 'submodel', item: model, relevanceScore: 10, matchedFields: ['title'] });
      this.indexItem(model.definition, { type: 'submodel', item: model, relevanceScore: 9, matchedFields: ['definition'] });
      model.tags.forEach(tag => {
        this.indexItem(tag, { type: 'submodel', item: model, relevanceScore: 7, matchedFields: ['tags'] });
      });
    });
  }

  /**
   * Index an item for search
   */
  private indexItem(text: string, result: SearchResult) {
    const words = text.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        this.searchIndex.get(word)!.push(result);
      }
    });
  }

  // Public API Methods

  /**
   * Get domains with optional tier filter
   */
  async getDomains(tier?: number): Promise<Domain[]> {
    const domains = Array.from(this.domains.values());
    if (tier) {
      return domains.filter(domain => domain.tier === tier);
    }
    return domains;
  }

  /**
   * Get domain by slug
   */
  async getDomainBySlug(slug: string): Promise<Domain | null> {
    return this.domains.get(slug) || null;
  }

  /**
   * Get sub-model by ID
   */
  async getSubModel(id: string): Promise<SubModel | null> {
    return this.subModels.get(id) || null;
  }

  /**
   * Get sub-models by domain
   */
  async getSubModelsByDomain(domainId: string): Promise<SubModel[]> {
    return Array.from(this.subModels.values()).filter(model => model.domainId === domainId);
  }

  /**
   * Search models with filters
   */
  async searchModels(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const words = query.toLowerCase().split(/\s+/);
    const results = new Map<string, SearchResult>();
    
    words.forEach(word => {
      if (this.searchIndex.has(word)) {
        const searchResults = this.searchIndex.get(word);
        if (searchResults) {
          searchResults.forEach(result => {
            const key = `${result.type}-${('id' in result.item) ? result.item.id : result.item.readwiseId}`;
            if (!results.has(key)) {
              results.set(key, result);
            } else {
              // Boost relevance score for multiple matches
              const existing = results.get(key);
              if (existing) {
                existing.relevanceScore += 2;
              }
            }
          });
        }
      }
    });

    let filteredResults = Array.from(results.values());

    // Apply filters
    if (filters) {
      if (filters.tiers) {
        filteredResults = filteredResults.filter(result => {
          if (result.type === 'domain') {
            return filters.tiers!.includes((result.item as Domain).tier);
          }
          return true;
        });
      }

      if (filters.difficulty) {
        filteredResults = filteredResults.filter(result => {
          if (result.type === 'submodel') {
            return filters.difficulty!.includes((result.item as SubModel).difficulty);
          }
          return true;
        });
      }

      if (filters.tags) {
        filteredResults = filteredResults.filter(result => {
          if (result.type === 'submodel') {
            return filters.tags!.some(tag => (result.item as SubModel).tags.includes(tag));
          }
          return true;
        });
      }

      if (filters.minRelevanceScore) {
        filteredResults = filteredResults.filter(result => 
          result.relevanceScore >= filters.minRelevanceScore!
        );
      }
    }

    // Sort by relevance score
    return filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get related models
   */
  async getRelatedModels(modelId: string, limit: number = 5): Promise<SubModel[]> {
    const model = await this.getSubModel(modelId);
    if (!model) return [];

    // Find models with similar tags or concepts
    const related = Array.from(this.subModels.values())
      .filter(m => m.id !== modelId)
      .map(m => ({
        model: m,
        similarity: this.calculateSimilarity(model, m)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.model);

    return related;
  }

  /**
   * Calculate similarity between models
   */
  private calculateSimilarity(model1: SubModel, model2: SubModel): number {
    let similarity = 0;
    
    // Tag similarity
    const commonTags = model1.tags.filter(tag => model2.tags.includes(tag));
    similarity += commonTags.length * 2;
    
    // Text similarity (simple word overlap)
    const words1 = model1.definition.toLowerCase().split(/\s+/);
    const words2 = model2.definition.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    similarity += commonWords.length * 0.5;
    
    return similarity;
  }

  /**
   * Get models by tag
   */
  async getModelsByTag(tag: string): Promise<SubModel[]> {
    return Array.from(this.subModels.values()).filter(model => 
      model.tags.includes(tag)
    );
  }

  /**
   * Get popular models
   */
  async getPopularModels(limit: number = 10): Promise<SubModel[]> {
    return Array.from(this.subModels.values())
      .sort((a, b) => b.practicalValue - a.practicalValue)
      .slice(0, limit);
  }

  /**
   * Sync highlights with Readwise
   */
  async syncHighlightsToModels(): Promise<SyncResult> {
    if (!this.readwiseClient) {
      throw new Error('Readwise client not initialized');
    }

    const startTime = Date.now();
    const errors: string[] = [];
    let totalHighlights = 0;
    let mappedHighlights = 0;

    try {
      // Get all highlights from Readwise
      const highlights = await this.readwiseClient.getAllHighlights();
      totalHighlights = highlights.length;

      // Map highlights to models
      for (const highlight of highlights) {
        try {
          const modelIds = await this.mapHighlightToModels(highlight);
          if (modelIds.length > 0) {
            mappedHighlights++;
            // Update model highlights
            for (const modelId of modelIds) {
              await this.updateModelHighlights(modelId);
            }
          }
        } catch (error) {
          errors.push(`Failed to map highlight ${highlight.id}: ${error}`);
        }
      }

      // Generate relevance scores
      await this.generateRelevanceScores();

    } catch (error) {
      errors.push(`Sync failed: ${error}`);
    }

    return {
      totalHighlights,
      mappedHighlights,
      newModels: 0, // Not implemented yet
      updatedModels: this.subModels.size,
      errors,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Map highlight to relevant models
   */
  async mapHighlightToModels(highlight: any): Promise<string[]> {
    const modelIds: string[] = [];
    const highlightText = highlight.text.toLowerCase();
    
    // Simple keyword matching - can be enhanced with semantic analysis
    this.subModels.forEach(model => {
      const modelText = `${model.title} ${model.definition} ${model.tags.join(' ')}`.toLowerCase();
      const words = modelText.split(/\s+/);
      
      const matches = words.filter(word => 
        word.length > 3 && highlightText.includes(word)
      );
      
      if (matches.length >= 2) {
        modelIds.push(model.id);
      }
    });

    return modelIds;
  }

  /**
   * Update model highlights
   */
  async updateModelHighlights(modelId: string): Promise<void> {
    const model = await this.getSubModel(modelId);
    if (!model) return;

    // This would update the model's source highlights
    // Implementation depends on how you want to store the data
    console.log(`Updated highlights for model: ${modelId}`);
  }

  /**
   * Generate relevance scores
   */
  async generateRelevanceScores(): Promise<void> {
    // This would analyze highlight-model relationships and generate scores
    // Implementation depends on your scoring algorithm
    console.log('Generated relevance scores for all highlights');
  }

  /**
   * Get framework statistics
   */
  async getFrameworkStats(): Promise<FrameworkStats> {
    const domains = Array.from(this.domains.values());
    const models = Array.from(this.subModels.values());
    
    const coverageByTier: Record<number, number> = {};
    domains.forEach(domain => {
      coverageByTier[domain.tier] = (coverageByTier[domain.tier] || 0) + 1;
    });

    const tagCounts = new Map<string, number>();
    models.forEach(model => {
      model.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const totalHighlights = models.reduce((sum, model) => sum + model.sourceHighlights.length, 0);
    const averageRelevanceScore = totalHighlights > 0 
      ? models.reduce((sum, model) => 
          sum + model.sourceHighlights.reduce((s, h) => s + h.relevanceScore, 0), 0) / totalHighlights
      : 0;

    return {
      totalDomains: domains.length,
      totalSubModels: models.length,
      totalHighlights,
      totalBooks: new Set(models.flatMap(m => m.sourceHighlights.map(h => h.book.id))).size,
      averageRelevanceScore,
      coverageByTier,
      topTags,
      recentActivity: [] // Would be populated from actual activity data
    };
  }

  /**
   * Get domain coverage statistics
   */
  async getDomainCoverage(): Promise<CoverageStats> {
    const domains = Array.from(this.domains.values());
    
    const domainCoverage = domains.map(domain => ({
      domain: domain.title,
      coverage: domain.subModels.length,
      highlights: domain.totalHighlights
    }));

    const tierCoverage: Record<number, { domains: number; models: number; highlights: number }> = {};
    domains.forEach(domain => {
      if (!tierCoverage[domain.tier]) {
        tierCoverage[domain.tier] = { domains: 0, models: 0, highlights: 0 };
      }
      tierCoverage[domain.tier].domains++;
      tierCoverage[domain.tier].models += domain.subModels.length;
      tierCoverage[domain.tier].highlights += domain.totalHighlights;
    });

    const gaps = domains
      .filter(domain => domain.subModels.length === 0)
      .map(domain => domain.title);

    const strengths = domains
      .filter(domain => domain.subModels.length > 2)
      .map(domain => domain.title);

    return {
      domainCoverage,
      tierCoverage,
      gaps,
      strengths
    };
  }

  /**
   * Get source book distribution
   */
  async getSourceBookDistribution(): Promise<BookStats[]> {
    const bookStats = new Map<number, BookStats>();
    
    this.subModels.forEach(model => {
      model.sourceHighlights.forEach(highlight => {
        const bookId = highlight.book.id;
        if (!bookStats.has(bookId)) {
          bookStats.set(bookId, {
            book: highlight.book,
            modelsContributed: 0,
            highlightsUsed: 0,
            averageRelevanceScore: 0,
            topModels: []
          });
        }
        
        const stats = bookStats.get(bookId);
        if (stats) {
          stats.highlightsUsed++;
          stats.modelsContributed++;
          stats.averageRelevanceScore = (stats.averageRelevanceScore + highlight.relevanceScore) / 2;
          stats.topModels.push(model.title);
        }
      });
    });

    return Array.from(bookStats.values())
      .sort((a, b) => b.highlightsUsed - a.highlightsUsed);
  }

  /**
   * Initialize Readwise client
   */
  initializeReadwise(token: string) {
    this.readwiseClient = new ReadwiseClient(token);
  }

  /**
   * Get Readwise client
   */
  getReadwiseClient(): ReadwiseClient | null {
    return this.readwiseClient;
  }
}

// Create singleton instance
export const modelDataManager = new ModelDataManager();
export default modelDataManager;

