'use client';

import { MentalModel } from '@/lib/data';
import { UserProfile } from '@/types/user';

export interface DynamicLearningPath {
  id: string;
  title: string;
  description: string;
  personalizedReason: string;
  models: Array<{
    model: MentalModel;
    reasoning: string;
    sequenceReason: string;
    estimatedTime: number;
  }>;
  pathType: 'immediate-solution' | 'skill-building' | 'deep-mastery' | 'cross-domain' | 'weakness-targeted';
  difficulty: 'gentle' | 'moderate' | 'challenging';
  estimatedTotalTime: string;
  successMetrics: string[];
  adaptiveFeatures: {
    branchingPoints: string[];
    reinforcementTriggers: string[];
    progressionLogic: string;
  };
}

export class DynamicPathGenerator {
  
  /**
   * Generate unlimited dynamic paths based on user's specific context
   */
  static generateDynamicPaths(
    allModels: MentalModel[], 
    profile: UserProfile & { personalContext: any }
  ): DynamicLearningPath[] {
    const context = profile.personalContext;
    const paths: DynamicLearningPath[] = [];
    
    // Check if this is a continuation from a completed path
    const continuationType = context.continuationType;
    console.log('Generating paths with continuation type:', continuationType);
    
    // ALWAYS generate all path types, but PRIORITIZE based on continuation type
    const immediatePath = this.generateImmediateSolutionPath(allModels, context);
    const skillPaths = this.generateSkillBuildingPaths(allModels, context);
    const masteryPath = this.generateDeepMasteryPath(allModels, context);
    const crossDomainPaths = this.generateCrossDomainPaths(allModels, context);
    const weaknessPaths = this.generateWeaknessTargetedPaths(allModels, context);
    
    // Additional specialized paths
    const advancedPaths = this.generateAdvancedPaths(allModels, context);
    const relatedPaths = this.generateRelatedPaths(allModels, context);
    const newDomainPaths = this.generateNewDomainPaths(allModels, context);
    const explorationPaths = this.generateExplorationPaths(allModels, context);
    const applicationPaths = this.generateApplicationPaths(allModels, context);
    const practicalPaths = this.generatePracticalPaths(allModels, context);
    
    // Add all paths
    if (immediatePath) paths.push(immediatePath);
    paths.push(...skillPaths);
    if (masteryPath) paths.push(masteryPath);
    paths.push(...crossDomainPaths);
    paths.push(...weaknessPaths);
    paths.push(...advancedPaths);
    paths.push(...relatedPaths);
    paths.push(...newDomainPaths);
    paths.push(...explorationPaths);
    paths.push(...applicationPaths);
    paths.push(...practicalPaths);
    
    console.log('Total paths generated before filtering:', paths.length);
    
    // Sort by continuation type priority, then by relevance
    return this.rankAndFilterPaths(paths, context, continuationType);
  }
  
  /**
   * Generate advanced paths for "deeper" continuation
   */
  private static generateAdvancedPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find advanced models - use ANY models if specific advanced ones aren't available
    let advancedModels = allModels.filter(m => 
      m.slug.includes('advanced') || 
      m.slug.includes('complex') || 
      m.slug.includes('mastery') ||
      m.difficulty === 'advanced'
    );
    
    // Fallback: Just use some models if no specific "advanced" ones exist
    if (advancedModels.length < 3) {
      advancedModels = allModels.filter(m => 
        m.slug.includes('strategy') || 
        m.slug.includes('system') ||
        m.slug.includes('integration')
      ).slice(0, 4);
    }
    
    if (advancedModels.length >= 3) {
      paths.push({
        id: 'advanced-mastery',
        title: 'Advanced Mastery Path',
        description: 'Dive deeper into sophisticated concepts and advanced applications',
        personalizedReason: 'Build on your foundation with more complex mental models',
        models: advancedModels.slice(0, 4).map((model, index) => ({
          model,
          reasoning: `Advanced concept that builds on your existing knowledge`,
          sequenceReason: `Step ${index + 1} in your mastery journey`,
          estimatedTime: 15
        })),
        pathType: 'deep-mastery',
        difficulty: 'challenging',
        estimatedTotalTime: '45-60 minutes',
        successMetrics: ['Master advanced concepts', 'Apply to complex situations'],
        adaptiveFeatures: {
          branchingPoints: ['After concept 2: Choose specialization'],
          reinforcementTriggers: ['When facing complex problems'],
          progressionLogic: 'Sequential mastery with application checkpoints'
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Generate related paths for "adjacent" continuation
   */
  private static generateRelatedPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find models with related tags but different domains
    let relatedModels = allModels.filter(m => 
      m.tags && m.tags.some(tag => 
        context.primaryFocus && tag.includes(context.primaryFocus.split('-')[0])
      )
    );
    
    // Fallback: Use models from similar categories
    if (relatedModels.length < 3) {
      relatedModels = allModels.filter(m => m.tags && m.tags.length > 0).slice(0, 4);
    }
    
    if (relatedModels.length >= 3) {
      paths.push({
        id: 'related-expansion',
        title: 'Related Concepts Expansion',
        description: 'Explore connected ideas that complement what you\'ve learned',
        personalizedReason: 'Connect the dots with related mental models',
        models: relatedModels.slice(0, 4).map((model, index) => ({
          model,
          reasoning: `Related concept that connects to your learning`,
          sequenceReason: `Builds connections to your existing knowledge`,
          estimatedTime: 12
        })),
        pathType: 'cross-domain',
        difficulty: 'moderate',
        estimatedTotalTime: '30-40 minutes',
        successMetrics: ['Connect related concepts', 'Build mental model network'],
        adaptiveFeatures: {
          branchingPoints: ['After connection 2: Choose focus area'],
          reinforcementTriggers: ['When making connections'],
          progressionLogic: 'Connection-focused learning with pattern recognition'
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Generate new domain paths for "new" continuation
   */
  private static generateNewDomainPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find models from completely different domains
    const newDomainModels = allModels.filter(m => 
      !m.domainSlug || !context.primaryFocus || 
      !m.domainSlug.includes(context.primaryFocus.split('-')[0])
    );
    
    if (newDomainModels.length >= 3) {
      paths.push({
        id: 'new-territory',
        title: 'New Territory Exploration',
        description: 'Branch out into completely different areas of thinking',
        personalizedReason: 'Broaden your perspective with fresh mental models',
        models: newDomainModels.slice(0, 4).map((model, index) => ({
          model,
          reasoning: `New perspective from a different domain`,
          sequenceReason: `Introduces fresh thinking patterns`,
          estimatedTime: 10
        })),
        pathType: 'cross-domain',
        difficulty: 'gentle',
        estimatedTotalTime: '25-35 minutes',
        successMetrics: ['Explore new domains', 'Broaden perspective'],
        adaptiveFeatures: {
          branchingPoints: ['After exploration 2: Choose interest'],
          reinforcementTriggers: ['When encountering new situations'],
          progressionLogic: 'Exploration-focused with discovery emphasis'
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Generate exploration paths for "new" continuation
   */
  private static generateExplorationPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find foundational models from different domains
    const explorationModels = allModels.filter(m => 
      m.difficulty === 'beginner' && 
      m.slug.includes('foundation') || 
      m.slug.includes('basic') ||
      m.slug.includes('introduction')
    );
    
    if (explorationModels.length >= 3) {
      paths.push({
        id: 'foundation-exploration',
        title: 'Foundation Exploration',
        description: 'Build foundational knowledge in new areas',
        personalizedReason: 'Establish strong foundations in new domains',
        models: explorationModels.slice(0, 3).map((model, index) => ({
          model,
          reasoning: `Foundational concept for new domain`,
          sequenceReason: `Builds base knowledge in new area`,
          estimatedTime: 8
        })),
        pathType: 'skill-building',
        difficulty: 'gentle',
        estimatedTotalTime: '20-25 minutes',
        successMetrics: ['Build new foundations', 'Expand knowledge base'],
        adaptiveFeatures: {
          branchingPoints: ['After foundation 1: Choose depth'],
          reinforcementTriggers: ['When applying new concepts'],
          progressionLogic: 'Foundation-first with gradual complexity'
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Generate application paths for "apply" continuation
   */
  private static generateApplicationPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find practical application models
    const applicationModels = allModels.filter(m => 
      m.slug.includes('application') || 
      m.slug.includes('practical') || 
      m.slug.includes('implementation') ||
      m.tags?.includes('work') ||
      m.tags?.includes('practice')
    );
    
    if (applicationModels.length >= 3) {
      paths.push({
        id: 'practical-application',
        title: 'Practical Application Path',
        description: 'Turn your knowledge into real-world action',
        personalizedReason: 'Apply your mental models to practical situations',
        models: applicationModels.slice(0, 4).map((model, index) => ({
          model,
          reasoning: `Practical framework for real-world application`,
          sequenceReason: `Step-by-step application process`,
          estimatedTime: 12
        })),
        pathType: 'immediate-solution',
        difficulty: 'moderate',
        estimatedTotalTime: '35-45 minutes',
        successMetrics: ['Apply to real situations', 'Get practical results'],
        adaptiveFeatures: {
          branchingPoints: ['After application 2: Choose focus'],
          reinforcementTriggers: ['When facing real challenges'],
          progressionLogic: 'Application-focused with immediate feedback'
        }
      });
    }
    
    return paths;
  }
  
  /**
   * Generate practical paths for "apply" continuation
   */
  private static generatePracticalPaths(allModels: MentalModel[], context: any): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    
    // Find work-focused models
    const practicalModels = allModels.filter(m => 
      m.tags?.includes('business') || 
      m.tags?.includes('decision') ||
      m.slug.includes('strategy') ||
      m.slug.includes('optimization')
    );
    
    if (practicalModels.length >= 3) {
      paths.push({
        id: 'work-optimization',
        title: 'Work & Decision Optimization',
        description: 'Optimize your work and decision-making processes',
        personalizedReason: 'Improve your professional effectiveness',
        models: practicalModels.slice(0, 3).map((model, index) => ({
          model,
          reasoning: `Professional effectiveness framework`,
          sequenceReason: `Optimizes your work processes`,
          estimatedTime: 10
        })),
        pathType: 'immediate-solution',
        difficulty: 'moderate',
        estimatedTotalTime: '25-30 minutes',
        successMetrics: ['Improve work efficiency', 'Better decisions'],
        adaptiveFeatures: {
          branchingPoints: ['After optimization 1: Choose area'],
          reinforcementTriggers: ['When making work decisions'],
          progressionLogic: 'Work-focused with immediate impact'
        }
      });
    }
    
    return paths;
  }

  /**
   * Generate immediate solution path - laser-focused on their exact challenge
   */
  private static generateImmediateSolutionPath(
    allModels: MentalModel[], 
    context: any
  ): DynamicLearningPath | null {
    const challenge = context.specificChallenge?.toLowerCase() || '';
    
    // Find models that directly address their challenge
    const relevantModels = this.findModelsForChallenge(allModels, challenge);
    if (relevantModels.length < 2) return null;
    
    // Sequence models logically
    const sequencedModels = this.sequenceModelsForChallenge(relevantModels, challenge);
    
    return {
      id: 'immediate-solution',
      title: this.generateChallengeTitle(challenge),
      description: `Directly tackles your challenge: "${context.specificChallenge}"`,
      personalizedReason: `These models were specifically chosen because they address the core elements of your situation.`,
      models: sequencedModels.slice(0, 4).map((model, index) => ({
        model,
        reasoning: this.getModelReasoningForChallenge(model, challenge),
        sequenceReason: this.getSequenceReasoning(model, index, challenge),
        estimatedTime: this.calculateModelTime(model, context)
      })),
      pathType: 'immediate-solution',
      difficulty: this.determineDifficulty(context),
      estimatedTotalTime: this.calculateTotalTime(sequencedModels.slice(0, 4), context),
      successMetrics: this.generateSuccessMetrics(context),
      adaptiveFeatures: {
        branchingPoints: [`After model 2: If still struggling, add reinforcement models`],
        reinforcementTriggers: [`When applying to real situation`],
        progressionLogic: `Linear progression with application checkpoints`
      }
    };
  }
  
  /**
   * Generate multiple skill-building paths with different approaches
   */
  private static generateSkillBuildingPaths(
    allModels: MentalModel[], 
    context: any
  ): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    const challenge = context.specificChallenge?.toLowerCase() || '';
    
    // Identify core skills needed
    const coreSkills = this.identifyCoreSkills(challenge, context.thinkingPattern);
    
    // Generate a path for each core skill
    coreSkills.forEach(skill => {
      const skillModels = this.findModelsForSkill(allModels, skill);
      if (skillModels.length >= 2) {
        paths.push({
          id: `skill-${skill.replace(/\s+/g, '-')}`,
          title: `Master ${skill}`,
          description: `Build strong ${skill} capabilities to handle challenges like yours`,
          personalizedReason: `${skill} is crucial for your situation because ${this.getSkillRelevance(skill, challenge)}`,
          models: skillModels.slice(0, 3).map((model, index) => ({
            model,
            reasoning: `Develops your ${skill} through ${this.getSkillDevelopmentReason(model, skill)}`,
            sequenceReason: this.getSkillSequenceReason(index, skill),
            estimatedTime: this.calculateModelTime(model, context)
          })),
          pathType: 'skill-building',
          difficulty: this.determineDifficulty(context),
          estimatedTotalTime: this.calculateTotalTime(skillModels.slice(0, 3), context),
          successMetrics: [`You can apply ${skill} to similar challenges`, `You recognize when ${skill} is needed`],
          adaptiveFeatures: {
            branchingPoints: [`After each model: Practice application`],
            reinforcementTriggers: [`Weekly skill application check`],
            progressionLogic: `Progressive skill building with practice integration`
          }
        });
      }
    });
    
    return paths;
  }
  
  /**
   * Generate deep mastery path for dedicated learners
   */
  private static generateDeepMasteryPath(
    allModels: MentalModel[], 
    context: any
  ): DynamicLearningPath | null {
    const challenge = context.specificChallenge?.toLowerCase() || '';
    
    // Find comprehensive set of models for deep understanding
    const masteryModels = this.findMasteryModels(allModels, challenge, context);
    if (masteryModels.length < 5) return null;
    
    return {
      id: 'deep-mastery',
      title: 'Become an Expert Thinker',
      description: `Comprehensive mastery of thinking frameworks relevant to your challenge`,
      personalizedReason: `Since you want deep understanding, this path covers the full spectrum of mental models that will make you exceptionally capable in situations like yours.`,
      models: masteryModels.slice(0, 8).map((model, index) => ({
        model,
        reasoning: `Part of comprehensive framework for mastering ${this.getMasteryDomain(challenge)}`,
        sequenceReason: this.getMasterySequenceReason(index, masteryModels.length),
        estimatedTime: this.calculateModelTime(model, context, 1.5) // Longer for mastery
      })),
      pathType: 'deep-mastery',
      difficulty: 'challenging',
      estimatedTotalTime: this.calculateTotalTime(masteryModels.slice(0, 8), context, 1.5),
      successMetrics: [
        `You can teach these concepts to others`,
        `You see patterns and connections others miss`,
        `You can adapt these frameworks to new situations`
      ],
      adaptiveFeatures: {
        branchingPoints: [`After every 2 models: Integration checkpoint`],
        reinforcementTriggers: [`Monthly mastery assessment`, `Real-world application projects`],
        progressionLogic: `Spiral learning with increasing complexity and integration`
      }
    };
  }
  
  /**
   * Generate cross-domain paths that connect to other areas
   */
  private static generateCrossDomainPaths(
    allModels: MentalModel[], 
    context: any
  ): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    const primaryDomain = this.identifyPrimaryDomain(context.specificChallenge);
    
    // Find related domains that could provide valuable perspectives
    const relatedDomains = this.findRelatedDomains(primaryDomain, context);
    
    relatedDomains.forEach(domain => {
      const crossDomainModels = this.findCrossDomainModels(allModels, primaryDomain, domain);
      if (crossDomainModels.length >= 2) {
        paths.push({
          id: `cross-${domain.replace(/\s+/g, '-')}`,
          title: `${domain} Perspective`,
          description: `Apply ${domain} insights to your ${primaryDomain} challenge`,
          personalizedReason: `${domain} offers unique perspectives that can breakthrough limitations in ${primaryDomain} thinking.`,
          models: crossDomainModels.slice(0, 3).map((model, index) => ({
            model,
            reasoning: `Brings ${domain} insights to your ${primaryDomain} challenge`,
            sequenceReason: this.getCrossDomainSequenceReason(index, domain, primaryDomain),
            estimatedTime: this.calculateModelTime(model, context)
          })),
          pathType: 'cross-domain',
          difficulty: this.determineDifficulty(context),
          estimatedTotalTime: this.calculateTotalTime(crossDomainModels.slice(0, 3), context),
          successMetrics: [`You can see your challenge from multiple angles`, `You find novel solutions by combining perspectives`],
          adaptiveFeatures: {
            branchingPoints: [`After each model: Connect back to original challenge`],
            reinforcementTriggers: [`Cross-domain application exercises`],
            progressionLogic: `Bridge building between domains with synthesis checkpoints`
          }
        });
      }
    });
    
    return paths;
  }
  
  /**
   * Generate paths that target their specific thinking weaknesses
   */
  private static generateWeaknessTargetedPaths(
    allModels: MentalModel[], 
    context: any
  ): DynamicLearningPath[] {
    const paths: DynamicLearningPath[] = [];
    const thinkingPattern = context.thinkingPattern?.toLowerCase() || '';
    
    // Identify specific thinking weaknesses
    const weaknesses = this.identifyThinkingWeaknesses(thinkingPattern);
    
    weaknesses.forEach(weakness => {
      const targetedModels = this.findModelsForWeakness(allModels, weakness);
      if (targetedModels.length >= 2) {
        paths.push({
          id: `weakness-${weakness.replace(/\s+/g, '-')}`,
          title: `Overcome ${weakness}`,
          description: `Specifically designed to address your tendency to ${weakness.toLowerCase()}`,
          personalizedReason: `Since you mentioned "${context.thinkingPattern}", these models will help you recognize and correct this pattern.`,
          models: targetedModels.slice(0, 3).map((model, index) => ({
            model,
            reasoning: `Directly addresses ${weakness} by ${this.getWeaknessCorrection(model, weakness)}`,
            sequenceReason: this.getWeaknessSequenceReason(index, weakness),
            estimatedTime: this.calculateModelTime(model, context)
          })),
          pathType: 'weakness-targeted',
          difficulty: 'moderate',
          estimatedTotalTime: this.calculateTotalTime(targetedModels.slice(0, 3), context),
          successMetrics: [`You catch yourself before ${weakness.toLowerCase()}`, `You have alternative thinking strategies`],
          adaptiveFeatures: {
            branchingPoints: [`After each model: Self-assessment checkpoint`],
            reinforcementTriggers: [`Daily pattern recognition practice`],
            progressionLogic: `Weakness recognition → Alternative strategies → Habit formation`
          }
        });
      }
    });
    
    return paths;
  }
  
  // Helper methods for finding relevant models
  private static findModelsForChallenge(models: MentalModel[], challenge: string): MentalModel[] {
    return models.filter(model => {
      const modelText = `${model.name} ${model.description} ${model.tags.join(' ')}`.toLowerCase();
      
      // Decision-making challenges
      if (challenge.includes('decision') || challenge.includes('choose')) {
        return modelText.includes('decision') || modelText.includes('probabilistic') || 
               modelText.includes('bias') || modelText.includes('choice');
      }
      
      // Business challenges
      if (challenge.includes('business') || challenge.includes('startup') || challenge.includes('company')) {
        return modelText.includes('competitive') || modelText.includes('strategy') || 
               modelText.includes('market') || modelText.includes('business');
      }
      
      // Team/people challenges
      if (challenge.includes('team') || challenge.includes('people') || challenge.includes('manage')) {
        return modelText.includes('psychology') || modelText.includes('behavior') || 
               modelText.includes('cooperation') || modelText.includes('social');
      }
      
      // Creative challenges
      if (challenge.includes('creative') || challenge.includes('innovation') || challenge.includes('idea')) {
        return modelText.includes('creative') || modelText.includes('innovation') || 
               modelText.includes('design') || modelText.includes('problem');
      }
      
      // System challenges
      if (challenge.includes('complex') || challenge.includes('system') || challenge.includes('overwhelm')) {
        return modelText.includes('system') || modelText.includes('complex') || 
               modelText.includes('emergence') || modelText.includes('structure');
      }
      
      return false;
    });
  }
  
  private static identifyCoreSkills(challenge: string, thinkingPattern: string): string[] {
    const skills = [];
    
    if (challenge.includes('decision')) skills.push('Decision Making', 'Risk Assessment');
    if (challenge.includes('business')) skills.push('Strategic Thinking', 'Competitive Analysis');
    if (challenge.includes('team') || challenge.includes('people')) skills.push('Human Psychology', 'Influence');
    if (challenge.includes('creative')) skills.push('Creative Problem Solving', 'Innovation');
    if (challenge.includes('complex') || challenge.includes('system')) skills.push('Systems Thinking', 'Pattern Recognition');
    
    if (thinkingPattern?.includes('overthink')) skills.push('Clear Thinking');
    if (thinkingPattern?.includes('overwhelmed')) skills.push('Prioritization');
    if (thinkingPattern?.includes('options')) skills.push('Option Evaluation');
    
    return [...new Set(skills)]; // Remove duplicates
  }
  
  private static findModelsForSkill(models: MentalModel[], skill: string): MentalModel[] {
    const skillKeywords = {
      'Decision Making': ['decision', 'choice', 'probabilistic', 'expected-value'],
      'Risk Assessment': ['risk', 'uncertainty', 'probability', 'asymmetric'],
      'Strategic Thinking': ['strategy', 'competitive', 'advantage', 'game-theory'],
      'Competitive Analysis': ['competitive', 'moats', 'strategy', 'market'],
      'Human Psychology': ['psychology', 'behavior', 'cognitive', 'bias'],
      'Influence': ['influence', 'persuasion', 'cooperation', 'social'],
      'Creative Problem Solving': ['creative', 'innovation', 'design', 'problem'],
      'Innovation': ['innovation', 'creative', 'breakthrough', 'novel'],
      'Systems Thinking': ['systems', 'complexity', 'emergence', 'feedback'],
      'Pattern Recognition': ['pattern', 'recognition', 'mental-models', 'frameworks'],
      'Clear Thinking': ['first-principles', 'critical', 'bias', 'fallacy'],
      'Prioritization': ['priority', 'focus', 'essential', 'leverage'],
      'Option Evaluation': ['evaluation', 'comparison', 'trade-off', 'decision']
    };
    
    const keywords = skillKeywords[skill as keyof typeof skillKeywords] || [];
    
    return models.filter(model => {
      const modelText = `${model.slug} ${model.name} ${model.description}`.toLowerCase();
      return keywords.some(keyword => modelText.includes(keyword));
    });
  }
  
  // Additional helper methods would continue here...
  // (I'll implement the remaining methods if you want to see them)
  
  private static rankAndFilterPaths(paths: DynamicLearningPath[], context: any, continuationType?: string): DynamicLearningPath[] {
    // Score paths based on relevance to user context AND continuation type
    const scoredPaths = paths.map(path => ({
      path,
      score: this.calculatePathRelevance(path, context, continuationType)
    }));
    
    console.log('Scored paths:', scoredPaths.map(p => ({ title: p.path.title, score: p.score, type: p.path.pathType })));
    
    // Sort by relevance and return top 5-7 paths
    return scoredPaths
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map(item => item.path);
  }
  
  private static calculatePathRelevance(path: DynamicLearningPath, context: any, continuationType?: string): number {
    let score = 0;
    
    // BOOST paths based on continuation type
    if (continuationType === 'deeper') {
      if (path.pathType === 'deep-mastery') score += 20;
      if (path.difficulty === 'challenging') score += 15;
      if (path.title.includes('Advanced') || path.title.includes('Mastery')) score += 10;
    } else if (continuationType === 'adjacent') {
      if (path.pathType === 'cross-domain') score += 20;
      if (path.title.includes('Related') || path.title.includes('Connected') || path.title.includes('Expansion')) score += 15;
    } else if (continuationType === 'new') {
      if (path.title.includes('New') || path.title.includes('Exploration') || path.title.includes('Territory')) score += 20;
      if (path.difficulty === 'gentle') score += 10;
      if (path.title.includes('Foundation')) score += 15;
    } else if (continuationType === 'apply') {
      if (path.pathType === 'immediate-solution') score += 20;
      if (path.title.includes('Practical') || path.title.includes('Application') || path.title.includes('Work')) score += 15;
    } else {
      // DEFAULT - Original scoring for first-time users
      if (path.pathType === 'immediate-solution') score += 10;
    }
    
    // Match time commitment
    if (context.timeCommitment === 'micro-learning' && path.models.length <= 3) score += 5;
    if (context.timeCommitment === 'intensive-learning' && path.models.length >= 5) score += 5;
    
    // Match learning style preferences
    if (context.learningStyle === 'hands-on' && path.pathType === 'skill-building') score += 3;
    if (context.learningStyle === 'connection-based' && path.pathType === 'cross-domain') score += 3;
    
    // Ensure we always have some score for valid paths
    score += 1;
    
    return score;
  }
  
  // Placeholder implementations for remaining helper methods
  private static sequenceModelsForChallenge(models: MentalModel[], challenge: string): MentalModel[] {
    // Implement intelligent sequencing logic
    return models;
  }
  
  private static generateChallengeTitle(challenge: string): string {
    if (challenge.includes('decision')) return 'Master Decision Making';
    if (challenge.includes('business')) return 'Navigate Business Challenges';
    if (challenge.includes('team')) return 'Lead People Effectively';
    if (challenge.includes('creative')) return 'Unlock Creative Solutions';
    return 'Solve Your Challenge';
  }
  
  private static getModelReasoningForChallenge(model: MentalModel, challenge: string): string {
    return `Directly addresses key aspects of your challenge`;
  }
  
  private static getSequenceReasoning(model: MentalModel, index: number, challenge: string): string {
    if (index === 0) return 'Foundation - start here to build understanding';
    if (index === 1) return 'Core application - apply to your specific situation';
    return 'Advanced integration - master the nuances';
  }
  
  private static calculateModelTime(model: MentalModel, context: any, multiplier: number = 1): number {
    const baseTime = context.timeCommitmentData?.time === '5min' ? 8 : 
                    context.timeCommitmentData?.time === '15min' ? 18 : 25;
    return Math.round(baseTime * multiplier);
  }
  
  private static calculateTotalTime(models: MentalModel[], context: any, multiplier: number = 1): string {
    const totalMinutes = models.length * this.calculateModelTime(models[0] || {} as MentalModel, context, multiplier);
    return `${totalMinutes-5}-${totalMinutes+10} minutes`;
  }
  
  private static determineDifficulty(context: any): 'gentle' | 'moderate' | 'challenging' {
    if (context.thinkingPattern?.includes('overwhelmed')) return 'gentle';
    if (context.timeCommitment === 'intensive-learning') return 'challenging';
    return 'moderate';
  }
  
  private static generateSuccessMetrics(context: any): string[] {
    return [
      `You can confidently handle situations like: "${context.specificChallenge}"`,
      `You have clear frameworks for similar challenges`,
      `You make better decisions in this area`
    ];
  }
  
  // Additional placeholder methods...
  private static findMasteryModels(models: MentalModel[], challenge: string, context: any): MentalModel[] { return models.slice(0, 8); }
  private static getMasteryDomain(challenge: string): string { return 'your domain'; }
  private static getMasterySequenceReason(index: number, total: number): string { return `Step ${index + 1} of ${total}`; }
  private static identifyPrimaryDomain(challenge: string): string { return 'decision-making'; }
  private static findRelatedDomains(primaryDomain: string, context: any): string[] { return ['psychology', 'systems-thinking']; }
  private static findCrossDomainModels(models: MentalModel[], primary: string, related: string): MentalModel[] { return models.slice(0, 3); }
  private static getCrossDomainSequenceReason(index: number, domain: string, primary: string): string { return `Bridge ${domain} to ${primary}`; }
  private static identifyThinkingWeaknesses(pattern: string): string[] { 
    const weaknesses = [];
    if (pattern.includes('overthink')) weaknesses.push('Overthinking');
    if (pattern.includes('overwhelmed')) weaknesses.push('Analysis Paralysis');
    return weaknesses;
  }
  private static findModelsForWeakness(models: MentalModel[], weakness: string): MentalModel[] { return models.slice(0, 3); }
  private static getWeaknessCorrection(model: MentalModel, weakness: string): string { return 'providing alternative approaches'; }
  private static getWeaknessSequenceReason(index: number, weakness: string): string { return `Address ${weakness} step ${index + 1}`; }
  private static getSkillRelevance(skill: string, challenge: string): string { return 'it directly impacts your situation'; }
  private static getSkillDevelopmentReason(model: MentalModel, skill: string): string { return 'practical application'; }
  private static getSkillSequenceReason(index: number, skill: string): string { return `Build ${skill} foundation`; }
}
