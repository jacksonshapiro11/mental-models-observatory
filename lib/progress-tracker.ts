'use client';

// Progress tracking without requiring accounts - uses localStorage
export interface UserProgress {
  // Learning milestones
  quickStartCompleted: boolean;
  quickStartModels: string[];
  profileCreated: boolean;
  
  // Content engagement
  modelsViewed: Array<{
    slug: string;
    viewedAt: number;
    timeSpent: number;
    completed: boolean;
  }>;
  
  domainsExplored: Array<{
    slug: string;
    exploredAt: number;
    modelsViewed: number;
  }>;
  
  pathsStarted: Array<{
    pathId: string;
    startedAt: number;
    currentStep: number;
    completed: boolean;
  }>;
  
  // Learning patterns
  sessionCount: number;
  totalTimeSpent: number;
  longestSession: number;
  averageSessionLength: number;
  
  // Preferences learned from behavior
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  preferredSessionLength?: 'short' | 'medium' | 'long';
  learningVelocity?: 'slow' | 'moderate' | 'fast';
  
  // Achievements
  achievements: Array<{
    id: string;
    unlockedAt: number;
    title: string;
    description: string;
  }>;
  
  // Next steps suggestions
  suggestedNextSteps: Array<{
    type: 'model' | 'domain' | 'path';
    slug: string;
    reason: string;
    priority: number;
  }>;
  
  lastUpdated: number;
}

export class ProgressTracker {
  private static readonly STORAGE_KEY = 'learning_progress';
  
  /**
   * Get current user progress
   */
  static getProgress(): UserProgress {
    if (typeof window === 'undefined') {
      return this.getDefaultProgress();
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const progress = JSON.parse(stored);
        // Ensure all required fields exist
        return { ...this.getDefaultProgress(), ...progress };
      }
    } catch (error) {
      console.error('Error reading progress:', error);
    }
    
    return this.getDefaultProgress();
  }
  
  /**
   * Update user progress
   */
  static updateProgress(updates: Partial<UserProgress>): void {
    if (typeof window === 'undefined') return;
    
    try {
      const current = this.getProgress();
      const updated = {
        ...current,
        ...updates,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }
  
  /**
   * Track model view
   */
  static trackModelView(slug: string, timeSpent: number = 0, completed: boolean = false): void {
    const progress = this.getProgress();
    
    // Update or add model view
    const existingIndex = progress.modelsViewed.findIndex(m => m.slug === slug);
    if (existingIndex >= 0) {
      const existingModel = progress.modelsViewed[existingIndex];
      if (existingModel) {
        existingModel.timeSpent += timeSpent;
        existingModel.completed = completed || existingModel.completed;
      }
    } else {
      progress.modelsViewed.push({
        slug,
        viewedAt: Date.now(),
        timeSpent,
        completed
      });
    }
    
    // Update totals
    progress.totalTimeSpent += timeSpent;
    
    // Check for achievements
    this.checkAchievements(progress);
    
    // Generate next steps
    this.updateSuggestedNextSteps(progress);
    
    this.updateProgress(progress);
  }
  
  /**
   * Track domain exploration
   */
  static trackDomainExploration(slug: string): void {
    const progress = this.getProgress();
    
    const existingIndex = progress.domainsExplored.findIndex(d => d.slug === slug);
    if (existingIndex >= 0) {
      const existingDomain = progress.domainsExplored[existingIndex];
      if (existingDomain) {
        existingDomain.modelsViewed++;
      }
    } else {
      progress.domainsExplored.push({
        slug,
        exploredAt: Date.now(),
        modelsViewed: 1
      });
    }
    
    this.checkAchievements(progress);
    this.updateSuggestedNextSteps(progress);
    this.updateProgress(progress);
  }
  
  /**
   * Track learning path progress
   */
  static trackPathProgress(pathId: string, currentStep: number, completed: boolean = false): void {
    const progress = this.getProgress();
    
    const existingIndex = progress.pathsStarted.findIndex(p => p.pathId === pathId);
    if (existingIndex >= 0) {
      const existingPath = progress.pathsStarted[existingIndex];
      if (existingPath) {
        existingPath.currentStep = Math.max(
          existingPath.currentStep,
          currentStep
        );
      }
      if (existingPath) {
        existingPath.completed = completed || existingPath.completed;
      }
    } else {
      progress.pathsStarted.push({
        pathId,
        startedAt: Date.now(),
        currentStep,
        completed
      });
    }
    
    this.checkAchievements(progress);
    this.updateSuggestedNextSteps(progress);
    this.updateProgress(progress);
  }
  
  /**
   * Start a new session
   */
  static startSession(): void {
    const progress = this.getProgress();
    progress.sessionCount++;
    this.updateProgress(progress);
  }
  
  /**
   * End current session
   */
  static endSession(sessionLength: number): void {
    const progress = this.getProgress();
    
    progress.longestSession = Math.max(progress.longestSession, sessionLength);
    progress.averageSessionLength = (
      (progress.averageSessionLength * (progress.sessionCount - 1)) + sessionLength
    ) / progress.sessionCount;
    
    // Learn preferences
    if (sessionLength < 300) { // 5 minutes
      progress.preferredSessionLength = 'short';
    } else if (sessionLength < 1200) { // 20 minutes
      progress.preferredSessionLength = 'medium';
    } else {
      progress.preferredSessionLength = 'long';
    }
    
    this.updateProgress(progress);
  }
  
  /**
   * Get learning insights for user
   */
  static getLearningInsights(): {
    totalModelsViewed: number;
    totalDomainsExplored: number;
    completionRate: number;
    learningStreak: number;
    strongestDomains: string[];
    suggestedFocus: string;
  } {
    const progress = this.getProgress();
    
    const totalModelsViewed = progress.modelsViewed.length;
    const completedModels = progress.modelsViewed.filter(m => m.completed).length;
    const completionRate = totalModelsViewed > 0 ? completedModels / totalModelsViewed : 0;
    
    // Calculate learning streak (days with activity)
    const daysSinceStart = Math.floor((Date.now() - (progress.modelsViewed[0]?.viewedAt || Date.now())) / (1000 * 60 * 60 * 24));
    const learningStreak = Math.min(daysSinceStart, progress.sessionCount);
    
    // Find strongest domains (most models viewed)
    const domainCounts: Record<string, number> = {};
    progress.domainsExplored.forEach(domain => {
      domainCounts[domain.slug] = domain.modelsViewed;
    });
    const strongestDomains = Object.entries(domainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([domain]) => domain);
    
    // Suggest focus area
    let suggestedFocus = 'Continue exploring';
    if (completionRate < 0.3) {
      suggestedFocus = 'Focus on completing concepts you\'ve started';
    } else if (progress.domainsExplored.length < 3) {
      suggestedFocus = 'Explore new domains to broaden your perspective';
    } else if (progress.pathsStarted.length === 0) {
      suggestedFocus = 'Try a structured learning path';
    }
    
    return {
      totalModelsViewed,
      totalDomainsExplored: progress.domainsExplored.length,
      completionRate,
      learningStreak,
      strongestDomains,
      suggestedFocus
    };
  }
  
  /**
   * Check and unlock achievements
   */
  private static checkAchievements(progress: UserProgress): void {
    const achievements = [
      {
        id: 'first_model',
        title: 'First Steps',
        description: 'Viewed your first mental model',
        condition: () => progress.modelsViewed.length >= 1
      },
      {
        id: 'quick_start',
        title: 'Quick Learner',
        description: 'Completed the quick start experience',
        condition: () => progress.quickStartCompleted
      },
      {
        id: 'explorer',
        title: 'Domain Explorer',
        description: 'Explored 5 different domains',
        condition: () => progress.domainsExplored.length >= 5
      },
      {
        id: 'dedicated_learner',
        title: 'Dedicated Learner',
        description: 'Spent over 1 hour learning',
        condition: () => progress.totalTimeSpent >= 3600
      },
      {
        id: 'completionist',
        title: 'Completionist',
        description: 'Completed 10 mental models',
        condition: () => progress.modelsViewed.filter(m => m.completed).length >= 10
      },
      {
        id: 'path_walker',
        title: 'Path Walker',
        description: 'Completed your first learning path',
        condition: () => progress.pathsStarted.some(p => p.completed)
      }
    ];
    
    achievements.forEach(achievement => {
      const alreadyUnlocked = progress.achievements.some(a => a.id === achievement.id);
      if (!alreadyUnlocked && achievement.condition()) {
        progress.achievements.push({
          id: achievement.id,
          unlockedAt: Date.now(),
          title: achievement.title,
          description: achievement.description
        });
      }
    });
  }
  
  /**
   * Update suggested next steps based on progress
   */
  private static updateSuggestedNextSteps(progress: UserProgress): void {
    const suggestions: UserProgress['suggestedNextSteps'] = [];
    
    // If they've completed quick start but no profile, suggest personalization
    if (progress.quickStartCompleted && !progress.profileCreated) {
      suggestions.push({
        type: 'path',
        slug: 'personalized-onboarding',
        reason: 'Get personalized recommendations based on your interests',
        priority: 10
      });
    }
    
    // If they've viewed models but not completed any, suggest focusing
    const incompleteModels = progress.modelsViewed.filter(m => !m.completed);
    if (incompleteModels.length > 0) {
      const firstIncomplete = incompleteModels[0];
      if (firstIncomplete) {
        suggestions.push({
          type: 'model',
          slug: firstIncomplete.slug,
          reason: 'Complete this concept you started exploring',
          priority: 8
        });
      }
    }
    
    // If they're strong in one domain, suggest related domains
    if (progress.domainsExplored.length > 0) {
      const strongestDomain = progress.domainsExplored
        .sort((a, b) => b.modelsViewed - a.modelsViewed)[0];
      
      if (strongestDomain && strongestDomain.modelsViewed >= 3) {
        suggestions.push({
          type: 'domain',
          slug: 'related-domain', // This would need domain relationship mapping
          reason: `Expand your ${strongestDomain.slug} knowledge to related areas`,
          priority: 6
        });
      }
    }
    
    progress.suggestedNextSteps = suggestions.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Get default progress object
   */
  private static getDefaultProgress(): UserProgress {
    return {
      quickStartCompleted: false,
      quickStartModels: [],
      profileCreated: false,
      modelsViewed: [],
      domainsExplored: [],
      pathsStarted: [],
      sessionCount: 0,
      totalTimeSpent: 0,
      longestSession: 0,
      averageSessionLength: 0,
      achievements: [],
      suggestedNextSteps: [],
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Clear all progress (for testing or reset)
   */
  static clearProgress(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
