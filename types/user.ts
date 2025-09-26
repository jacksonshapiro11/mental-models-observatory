export interface UserProfile {
  experience: 'new' | 'some' | 'experienced';
  interests: string[];
  goals: 'learning' | 'work' | 'curiosity' | 'teaching';
  timeAvailable: '5min' | '15min' | '30min';
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  createdAt: number;
  lastActive: number;
}

export interface UserBehavior {
  visitedDomains: string[];
  visitedModels: string[];
  searchQueries: string[];
  timeSpentOnPages: { [key: string]: number };
  completedPaths: string[];
  bookmarkedModels: string[];
  lastSession: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  models: string[]; // model slugs
  domains: string[]; // domain slugs
  tags: string[];
  icon: string;
}

export interface PersonalizedRecommendation {
  type: 'model' | 'domain' | 'path';
  id: string;
  title: string;
  reason: string;
  confidence: number; // 0-1
  urgency: 'low' | 'medium' | 'high';
}