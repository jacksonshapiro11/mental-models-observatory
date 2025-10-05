'use client';

import { LearningPath, PersonalizedRecommendation, UserBehavior, UserProfile } from '@/types/user';

const USER_PROFILE_KEY = 'mmo_user_profile';
const USER_BEHAVIOR_KEY = 'mmo_user_behavior';

// Default learning paths using actual model slugs from your data
export const DEFAULT_LEARNING_PATHS: LearningPath[] = [
  {
    id: 'decision-maker',
    title: 'Decision Making Foundations',
    description: 'Essential frameworks for better choices in work and life',
    difficulty: 'beginner',
    estimatedTime: '15-20 minutes',
    models: ['probabilistic-thinking-base-rate-neglect', 'cognitive-biases-systematic-errors', 'strategic-thinking-equilibrium-concepts'],
    domains: ['decision-making-under-uncertainty', 'psychology-human-behavior', 'game-theory-strategic-interaction'],
    tags: ['decisions', 'psychology', 'thinking'],
    icon: '🎯'
  },
  {
    id: 'business-strategist',
    title: 'Business Strategy Essentials',
    description: 'Core models for competitive advantage and strategic thinking',
    difficulty: 'intermediate',
    estimatedTime: '25-30 minutes',
    models: ['competitive-advantage-sustainable-moats', 'supply-demand-emergent-market-behavior', 'power-concentration-natural-centralization'],
    domains: ['business-strategy-competition', 'economics-market-dynamics', 'power-dynamics-political-systems'],
    tags: ['business', 'strategy', 'competition'],
    icon: '📈'
  },
  {
    id: 'creative-thinker',
    title: 'Innovation & Creativity',
    description: 'Mental models for breakthrough thinking and problem solving',
    difficulty: 'beginner',
    estimatedTime: '20-25 minutes',
    models: ['combinatorial-creativity-recombination', 'models-as-mental-procedures-operating-systems', 'design-principles-user-mental-models'],
    domains: ['creativity-innovation', 'mental-models-cross-disciplinary-thinking', 'engineering-design'],
    tags: ['creativity', 'innovation', 'problems'],
    icon: '💡'
  },
  {
    id: 'system-thinker',
    title: 'Systems & Complexity',
    description: 'Understanding interconnections and emergent behaviors',
    difficulty: 'advanced',
    estimatedTime: '30-35 minutes',
    models: ['stocks-flows-system-structure', 'network-effects-emergent-behavior', 'adaptation-continuous-evolution'],
    domains: ['systems-thinking-complexity', 'complex-adaptive-systems', 'complex-adaptive-systems'],
    tags: ['systems', 'complexity', 'emergence'],
    icon: '🌐'
  },
  {
    id: 'leader',
    title: 'Leadership & Influence',
    description: 'Frameworks for effective leadership and team dynamics',
    difficulty: 'intermediate',
    estimatedTime: '20-25 minutes',
    models: ['power-concentration-natural-centralization', 'coordination-mechanisms-human-cooperation', 'love-as-nuclear-fuel-life-foundation'],
    domains: ['power-dynamics-political-systems', 'organizational-design-institutions', 'relationships-human-connection'],
    tags: ['leadership', 'influence', 'teams'],
    icon: '👥'
  },
  {
    id: 'learner',
    title: 'Learning & Growth',
    description: 'Meta-cognitive models for accelerated learning',
    difficulty: 'beginner',
    estimatedTime: '15-20 minutes',
    models: ['deliberate-practice-expertise-development', 'identity-based-habits-self-concept', 'models-as-mental-procedures-operating-systems'],
    domains: ['learning-skill-development', 'habit-formation-behavior-change', 'mental-models-cross-disciplinary-thinking'],
    tags: ['learning', 'growth', 'skills'],
    icon: '📚'
  }
];

export class UserProfileManager {
  static getProfile(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(USER_PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error reading user profile:', error);
      return null;
    }
  }

  static setProfile(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  static getBehavior(): UserBehavior {
    if (typeof window === 'undefined') {
      return this.getDefaultBehavior();
    }
    
    try {
      const stored = localStorage.getItem(USER_BEHAVIOR_KEY);
      return stored ? JSON.parse(stored) : this.getDefaultBehavior();
    } catch (error) {
      console.error('Error reading user behavior:', error);
      return this.getDefaultBehavior();
    }
  }

  static setBehavior(behavior: UserBehavior): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(USER_BEHAVIOR_KEY, JSON.stringify(behavior));
    } catch (error) {
      console.error('Error saving user behavior:', error);
    }
  }

  static trackPageVisit(pageType: 'domain' | 'model', slug: string, timeSpent?: number): void {
    const behavior = this.getBehavior();
    
    if (pageType === 'domain' && !behavior.visitedDomains.includes(slug)) {
      behavior.visitedDomains.push(slug);
    } else if (pageType === 'model' && !behavior.visitedModels.includes(slug)) {
      behavior.visitedModels.push(slug);
    }
    
    if (timeSpent) {
      behavior.timeSpentOnPages[slug] = (behavior.timeSpentOnPages[slug] || 0) + timeSpent;
    }
    
    behavior.lastSession = Date.now();
    this.setBehavior(behavior);
  }

  static trackSearch(query: string): void {
    const behavior = this.getBehavior();
    behavior.searchQueries.push(query);
    behavior.lastSession = Date.now();
    this.setBehavior(behavior);
  }

  static getRecommendedPaths(profile: UserProfile, behavior: UserBehavior): LearningPath[] {
    const paths = [...DEFAULT_LEARNING_PATHS];
    
    // Sort by relevance to user profile
    return paths.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Difficulty preference
      if (profile.preferredDifficulty === a.difficulty || profile.preferredDifficulty === 'mixed') scoreA += 2;
      if (profile.preferredDifficulty === b.difficulty || profile.preferredDifficulty === 'mixed') scoreB += 2;
      
      // Interest alignment
      const aInterestMatch = a.tags.filter(tag => profile.interests.includes(tag)).length;
      const bInterestMatch = b.tags.filter(tag => profile.interests.includes(tag)).length;
      scoreA += aInterestMatch;
      scoreB += bInterestMatch;
      
      // Goal alignment
      if (profile.goals === 'work' && a.id === 'business-strategist') scoreA += 3;
      if (profile.goals === 'work' && b.id === 'business-strategist') scoreB += 3;
      if (profile.goals === 'learning' && a.id === 'learner') scoreA += 3;
      if (profile.goals === 'learning' && b.id === 'learner') scoreB += 3;
      
      // Experience level
      if (profile.experience === 'new' && a.difficulty === 'beginner') scoreA += 2;
      if (profile.experience === 'new' && b.difficulty === 'beginner') scoreB += 2;
      if (profile.experience === 'experienced' && a.difficulty === 'advanced') scoreA += 2;
      if (profile.experience === 'experienced' && b.difficulty === 'advanced') scoreB += 2;
      
      return scoreB - scoreA;
    });
  }

  static getPersonalizedRecommendations(
    profile: UserProfile, 
    behavior: UserBehavior
  ): PersonalizedRecommendation[] {
    const recommendations: PersonalizedRecommendation[] = [];
    
    // Recommend based on incomplete paths
    if (behavior.visitedModels.length > 0 && behavior.completedPaths.length === 0) {
      recommendations.push({
        type: 'path',
        id: 'decision-maker',
        title: 'Complete your decision-making journey',
        reason: 'You\'ve explored some models - try a structured learning path',
        confidence: 0.8,
        urgency: 'medium'
      });
    }
    
    // Recommend based on interests
    if (profile.interests.includes('business')) {
      recommendations.push({
        type: 'path',
        id: 'business-strategist',
        title: 'Business Strategy Essentials',
        reason: 'Matches your business interests',
        confidence: 0.9,
        urgency: 'high'
      });
    }
    
    return recommendations;
  }

  private static getDefaultBehavior(): UserBehavior {
    return {
      visitedDomains: [],
      visitedModels: [],
      searchQueries: [],
      timeSpentOnPages: {},
      completedPaths: [],
      bookmarkedModels: [],
      lastSession: Date.now()
    };
  }
}