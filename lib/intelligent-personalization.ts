'use client';

import { MentalModel } from '@/lib/data';
import { UserProfile, UserBehavior, LearningPath } from '@/types/user';
import { getAllModels } from '@/lib/data';

// Enhanced user interaction tracking
export interface DetailedUserBehavior extends UserBehavior {
  // Engagement depth tracking
  highlightEngagement: Record<string, {
    viewTime: number;
    fullReads: number;
    skims: number;
    bookmarks: number;
  }>;
  
  // Learning pattern analysis
  learningVelocity: Record<string, number>; // domain -> concepts per hour
  conceptMastery: Record<string, {
    firstVisit: number;
    totalTime: number;
    revisits: number;
    masteryScore: number; // 0-1
  }>;
  
  // Interest evolution
  interestDrift: Array<{
    timestamp: number;
    interests: string[];
    confidence: number;
  }>;
  
  // Application attempts
  applicationAttempts: Record<string, {
    modelSlug: string;
    context: string;
    success: boolean;
    timestamp: number;
  }>;
}

// Intelligent content scoring
export interface ContentScore {
  relevanceScore: number; // 0-1 based on user profile
  difficultyMatch: number; // 0-1 how well difficulty matches user level
  prerequisiteScore: number; // 0-1 whether user has prerequisites
  noveltyScore: number; // 0-1 how new/interesting this is
  connectionScore: number; // 0-1 how well it connects to known concepts
  overallScore: number; // weighted combination
}

// Dynamic learning path
export interface AdaptiveLearningPath {
  id: string;
  title: string;
  description: string;
  personalizedReason: string; // Why this path was created for this user
  models: Array<{
    model: MentalModel;
    reasoning: string; // Why this model is in this position
    prerequisites: string[]; // What should be understood first
    connections: string[]; // What this connects to
    estimatedTime: number; // Personalized based on user velocity
  }>;
  adaptiveFeatures: {
    difficultyProgression: 'gentle' | 'moderate' | 'aggressive';
    branchingPoints: Array<{
      afterModel: string;
      condition: string;
      alternativePath: string[];
    }>;
    reinforcementTriggers: string[]; // When to revisit concepts
  };
}

export class IntelligentPersonalizationEngine {
  
  /**
   * Analyze user's learning patterns and generate insights
   */
  static analyzeUserLearningProfile(behavior: DetailedUserBehavior): {
    learningStyle: 'visual' | 'analytical' | 'practical' | 'exploratory';
    optimalSessionLength: number;
    preferredComplexity: 'building' | 'jumping' | 'mixed';
    strongDomains: string[];
    growthAreas: string[];
    interestEvolution: 'stable' | 'expanding' | 'shifting';
  } {
    const allModels = getAllModels();
    
    // Analyze learning velocity across domains
    const domainVelocities = Object.entries(behavior.learningVelocity);
    const avgVelocity = domainVelocities.reduce((sum, [, vel]) => sum + vel, 0) / domainVelocities.length;
    
    // Determine learning style from engagement patterns
    const totalHighlightTime = Object.values(behavior.highlightEngagement)
      .reduce((sum, eng) => sum + eng.viewTime, 0);
    const avgTimePerHighlight = totalHighlightTime / Object.keys(behavior.highlightEngagement).length;
    
    let learningStyle: 'visual' | 'analytical' | 'practical' | 'exploratory' = 'analytical';
    if (avgTimePerHighlight > 120) learningStyle = 'analytical'; // Deep reading
    else if (behavior.applicationAttempts && Object.keys(behavior.applicationAttempts).length > 5) learningStyle = 'practical';
    else if (behavior.visitedDomains.length > behavior.visitedModels.length * 0.3) learningStyle = 'exploratory';
    else learningStyle = 'visual';
    
    // Identify strong domains (high mastery scores)
    const strongDomains = Object.entries(behavior.conceptMastery)
      .filter(([, mastery]) => mastery.masteryScore > 0.7)
      .map(([concept]) => {
        const model = allModels.find(m => m.slug === concept);
        return model?.domain || 'unknown';
      })
      .filter((domain, index, arr) => arr.indexOf(domain) === index);
    
    // Identify growth areas (low mastery, high time investment)
    const growthAreas = Object.entries(behavior.conceptMastery)
      .filter(([, mastery]) => mastery.masteryScore < 0.4 && mastery.totalTime > 300)
      .map(([concept]) => {
        const model = allModels.find(m => m.slug === concept);
        return model?.domain || 'unknown';
      })
      .filter((domain, index, arr) => arr.indexOf(domain) === index);
    
    return {
      learningStyle,
      optimalSessionLength: Math.max(300, Math.min(1800, avgVelocity * 60)), // 5-30 minutes
      preferredComplexity: strongDomains.length > 3 ? 'jumping' : 'building',
      strongDomains,
      growthAreas,
      interestEvolution: behavior.interestDrift.length > 2 ? 'shifting' : 'stable'
    };
  }
  
  /**
   * Score content relevance for a specific user
   */
  static scoreContentForUser(
    model: MentalModel, 
    profile: UserProfile, 
    behavior: DetailedUserBehavior
  ): ContentScore {
    const learningProfile = this.analyzeUserLearningProfile(behavior);
    
    // Relevance based on interests and goals
    const interestMatch = model.tags.filter((tag: string) => 
      profile.interests.some((interest: string) => 
        tag.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(tag.toLowerCase())
      )
    ).length / Math.max(model.tags.length, 1);
    
    // Difficulty matching
    const userLevel = profile.experience === 'new' ? 0.2 : 
                     profile.experience === 'some' ? 0.5 : 0.8;
    const modelLevel = model.difficulty === 'beginner' ? 0.3 :
                      model.difficulty === 'intermediate' ? 0.6 : 0.9;
    const difficultyMatch = 1 - Math.abs(userLevel - modelLevel);
    
    // Prerequisites check
    const hasPrerequisites = model.relatedModels?.every((relatedSlug: string) => 
      (behavior.conceptMastery[relatedSlug]?.masteryScore ?? 0) > 0.5
    ) ?? true;
    const prerequisiteScore = hasPrerequisites ? 1 : 0.3;
    
    // Novelty (haven't seen this before)
    const noveltyScore = behavior.visitedModels.includes(model.slug) ? 0.2 : 1;
    
    // Connection to known concepts
    const knownRelatedConcepts = model.relatedModels?.filter((slug: string) => 
      behavior.visitedModels.includes(slug)
    ).length || 0;
    const connectionScore = Math.min(1, knownRelatedConcepts * 0.3);
    
    // Weighted overall score
    const overallScore = (
      interestMatch * 0.3 +
      difficultyMatch * 0.25 +
      prerequisiteScore * 0.2 +
      noveltyScore * 0.15 +
      connectionScore * 0.1
    );
    
    return {
      relevanceScore: interestMatch,
      difficultyMatch,
      prerequisiteScore,
      noveltyScore,
      connectionScore,
      overallScore
    };
  }
  
  /**
   * Generate adaptive learning paths based on user profile and behavior
   */
  static generateAdaptivePaths(
    profile: UserProfile, 
    behavior: DetailedUserBehavior
  ): AdaptiveLearningPath[] {
    const allModels = getAllModels();
    const learningProfile = this.analyzeUserLearningProfile(behavior);
    
    // Score all models for this user
    const scoredModels = allModels.map(model => ({
      model,
      score: this.scoreContentForUser(model, profile, behavior)
    })).sort((a, b) => b.score.overallScore - a.score.overallScore);
    
    const paths: AdaptiveLearningPath[] = [];
    
    // Path 1: Strength Amplification
    if (learningProfile.strongDomains.length > 0) {
      const strengthModels = scoredModels
        .filter(({ model }) => learningProfile.strongDomains.includes(model.domain))
        .slice(0, 5);
      
      paths.push({
        id: 'strength-amplification',
        title: 'Amplify Your Strengths',
        description: `Build on your expertise in ${learningProfile.strongDomains.join(', ')}`,
        personalizedReason: `You've shown strong mastery in ${learningProfile.strongDomains[0]}. Let's deepen that expertise.`,
        models: strengthModels.map(({ model, score }) => ({
          model,
          reasoning: `Builds on your ${model.domain} expertise (${Math.round(score.overallScore * 100)}% match)`,
          prerequisites: model.relatedModels?.slice(0, 2) || [],
          connections: this.findConnectedModels(model, allModels).slice(0, 3),
          estimatedTime: this.estimateTimeForUser(model, learningProfile)
        })),
        adaptiveFeatures: {
          difficultyProgression: 'aggressive',
          branchingPoints: [],
          reinforcementTriggers: []
        }
      });
    }
    
    // Path 2: Knowledge Gap Bridging
    if (learningProfile.growthAreas.length > 0) {
      const bridgeModels = scoredModels
        .filter(({ model }) => 
          learningProfile.growthAreas.includes(model.domain) &&
          model.difficulty === 'beginner'
        )
        .slice(0, 4);
      
      paths.push({
        id: 'knowledge-bridging',
        title: 'Bridge Knowledge Gaps',
        description: `Strengthen understanding in ${learningProfile.growthAreas.join(', ')}`,
        personalizedReason: `You've invested time in ${learningProfile.growthAreas[0]} but could benefit from foundational reinforcement.`,
        models: bridgeModels.map(({ model, score }) => ({
          model,
          reasoning: `Foundational concept to strengthen your ${model.domain} understanding`,
          prerequisites: [],
          connections: this.findConnectedModels(model, allModels).slice(0, 2),
          estimatedTime: this.estimateTimeForUser(model, learningProfile) * 1.5 // More time for challenging areas
        })),
        adaptiveFeatures: {
          difficultyProgression: 'gentle',
          branchingPoints: [
            {
              afterModel: bridgeModels[1]?.model.slug || '',
              condition: 'if mastery < 0.6',
              alternativePath: ['reinforcement-exercises']
            }
          ],
          reinforcementTriggers: ['after-3-days', 'before-advanced-concepts']
        }
      });
    }
    
    // Path 3: Cross-Domain Connections
    const crossDomainModels = this.findCrossDomainConnections(scoredModels, profile);
    if (crossDomainModels.length > 0) {
      paths.push({
        id: 'cross-domain-synthesis',
        title: 'Connect the Dots',
        description: 'Discover powerful connections between different domains',
        personalizedReason: 'Based on your interests, these models will reveal surprising connections.',
        models: crossDomainModels.slice(0, 4).map(({ model, score }) => ({
          model,
          reasoning: `Connects ${model.domain} with your other interests`,
          prerequisites: model.relatedModels?.slice(0, 1) || [],
          connections: this.findConnectedModels(model, allModels).slice(0, 4),
          estimatedTime: this.estimateTimeForUser(model, learningProfile)
        })),
        adaptiveFeatures: {
          difficultyProgression: 'moderate',
          branchingPoints: [],
          reinforcementTriggers: ['when-connections-made']
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Find models that connect multiple domains
   */
  private static findCrossDomainConnections(
    scoredModels: Array<{ model: MentalModel; score: ContentScore }>,
    profile: UserProfile
  ): Array<{ model: MentalModel; score: ContentScore }> {
    return scoredModels.filter(({ model }) => {
      // Models that have tags matching multiple user interests
      const matchingInterests = profile.interests.filter((interest: string) =>
        model.tags.some((tag: string) => tag.toLowerCase().includes(interest.toLowerCase()))
      );
      return matchingInterests.length >= 2;
    });
  }
  
  /**
   * Find models connected to a given model
   */
  private static findConnectedModels(model: MentalModel, allModels: MentalModel[]): string[] {
    const connected = new Set<string>();
    
    // Direct relationships
    model.relatedModels?.forEach(slug => connected.add(slug));
    
    // Same domain models
    allModels
      .filter((m: MentalModel) => m.domain === model.domain && m.slug !== model.slug)
      .slice(0, 2)
      .forEach((m: MentalModel) => connected.add(m.slug));
    
    // Tag-based connections
    allModels
      .filter((m: MentalModel) => 
        m.slug !== model.slug &&
        m.tags.some((tag: string) => model.tags.includes(tag))
      )
      .slice(0, 2)
      .forEach((m: MentalModel) => connected.add(m.slug));
    
    return Array.from(connected);
  }
  
  /**
   * Estimate learning time based on user's learning profile
   */
  private static estimateTimeForUser(
    model: MentalModel, 
    learningProfile: ReturnType<typeof IntelligentPersonalizationEngine.analyzeUserLearningProfile>
  ): number {
    let baseTime = 15; // minutes
    
    // Adjust for difficulty
    if (model.difficulty === 'intermediate') baseTime *= 1.3;
    if (model.difficulty === 'advanced') baseTime *= 1.6;
    
    // Adjust for learning style
    if (learningProfile.learningStyle === 'analytical') baseTime *= 1.4;
    if (learningProfile.learningStyle === 'practical') baseTime *= 1.2;
    
    // Adjust for domain strength
    if (learningProfile.strongDomains.includes(model.domain)) baseTime *= 0.8;
    if (learningProfile.growthAreas.includes(model.domain)) baseTime *= 1.3;
    
    return Math.round(baseTime);
  }
  
  /**
   * Track detailed user interaction
   */
  static trackDetailedInteraction(
    behavior: DetailedUserBehavior,
    interaction: {
      type: 'highlight_view' | 'model_visit' | 'application_attempt' | 'bookmark';
      modelSlug: string;
      highlightId?: string;
      duration?: number;
      context?: string;
      success?: boolean;
    }
  ): DetailedUserBehavior {
    const updated = { ...behavior };
    
    switch (interaction.type) {
      case 'highlight_view':
        if (interaction.highlightId && interaction.duration) {
          const key = `${interaction.modelSlug}-${interaction.highlightId}`;
          if (!updated.highlightEngagement[key]) {
            updated.highlightEngagement[key] = {
              viewTime: 0,
              fullReads: 0,
              skims: 0,
              bookmarks: 0
            };
          }
          updated.highlightEngagement[key].viewTime += interaction.duration;
          if (interaction.duration > 30) {
            updated.highlightEngagement[key].fullReads++;
          } else {
            updated.highlightEngagement[key].skims++;
          }
        }
        break;
        
      case 'application_attempt':
        if (interaction.context) {
          const attemptId = `${Date.now()}-${Math.random()}`;
          updated.applicationAttempts[attemptId] = {
            modelSlug: interaction.modelSlug,
            context: interaction.context,
            success: interaction.success || false,
            timestamp: Date.now()
          };
        }
        break;
    }
    
    updated.lastSession = Date.now();
    return updated;
  }
}
