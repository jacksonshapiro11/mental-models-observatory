'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserProfile, UserBehavior, LearningPath } from '@/types/user';
import { UserProfileManager, DEFAULT_LEARNING_PATHS } from '@/lib/user-profile';
import { ArrowRight, Clock, Target, Star, BookOpen, Users, TrendingUp, Lightbulb } from 'lucide-react';

interface PersonalizedGuideProps {
  onStartOnboarding: () => void;
}

export default function PersonalizedGuide({ onStartOnboarding }: PersonalizedGuideProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [behavior, setBehavior] = useState<UserBehavior | null>(null);
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userProfile = UserProfileManager.getProfile();
    const userBehavior = UserProfileManager.getBehavior();
    
    setProfile(userProfile);
    setBehavior(userBehavior);
    
    if (userProfile) {
      const paths = UserProfileManager.getRecommendedPaths(userProfile, userBehavior);
      setRecommendedPaths(paths.slice(0, 3)); // Top 3 recommendations
    } else {
      setRecommendedPaths(DEFAULT_LEARNING_PATHS.slice(0, 3));
    }
    
    setIsLoading(false);
  }, []);

  const getPathIcon = (path: LearningPath) => {
    const iconMap: { [key: string]: any } = {
      '🎯': Target,
      '📈': TrendingUp,
      '💡': Lightbulb,
      '🌐': Target,
      '👥': Users,
      '📚': BookOpen
    };
    
    const IconComponent = iconMap[path.icon];
    return IconComponent ? <IconComponent className="w-6 h-6" /> : <span className="text-xl">{path.icon}</span>;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-specialized-100 text-specialized-800 dark:bg-[#3d4a2a] dark:text-[#a8c97f]';
      case 'intermediate': return 'bg-accent-100 text-accent-800 dark:bg-[var(--espresso-accent)]/20 dark:text-[var(--espresso-accent)]';
      case 'advanced': return 'bg-practical-100 text-practical-800 dark:bg-[#5a2a2a] dark:text-[#d4a3a3]';
      default: return 'bg-neutral-100 text-neutral-800 dark:bg-[var(--espresso-surface)]/40 dark:text-[var(--espresso-body)]';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-foundational-50 to-accent-50 rounded-xl p-8 animate-pulse">
        <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-neutral-200 rounded w-2/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-neutral-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-gradient-to-br from-foundational-50 to-accent-50 rounded-xl p-8 border border-foundational-200">
        <div className="text-center">
          <div className="w-16 h-16 bg-foundational-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-foundational-600" />
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">
            Get Your Personalized Learning Path
          </h3>
          <p className="text-neutral-600 mb-6 max-w-md mx-auto">
            Answer a few quick questions to get mental model recommendations tailored specifically for you
          </p>
          <button
            onClick={onStartOnboarding}
            className="btn btn-primary btn-lg"
          >
            Start Personalization
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
          
          <div className="mt-6 pt-6 border-t border-foundational-200">
            <p className="text-sm text-neutral-500 mb-4">Or explore these popular starting points:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEFAULT_LEARNING_PATHS.slice(0, 3).map((path) => (
                <Link
                  key={path.id}
                  href={`/guide/path/${path.id}`}
                  className="block p-3 bg-white rounded-lg border border-neutral-200 hover:border-foundational-300 hover:shadow-sm transition-all text-center group"
                >
                  <div className="text-lg mb-1">{path.icon}</div>
                  <div className="text-sm font-medium text-neutral-800 group-hover:text-foundational-600">
                    {path.title}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-foundational-50 to-accent-50 rounded-xl p-8 border border-foundational-200">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">
            Your Personalized Learning Paths
          </h3>
          <p className="text-neutral-600">
            Based on your interests in {profile.interests.slice(0, 2).join(' and ')}
            {profile.interests.length > 2 && ` and ${profile.interests.length - 2} more`}
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-foundational-600">
          <Star className="w-4 h-4" />
          <span>Personalized</span>
        </div>
      </div>

      <div className="space-y-4">
        {recommendedPaths.map((path, index) => (
          <Link
            key={path.id}
            href={`/guide/path/${path.id}`}
            className="block bg-white rounded-lg p-6 border border-neutral-200 hover:border-foundational-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-foundational-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-foundational-200 transition-colors">
                {getPathIcon(path)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-lg font-semibold text-neutral-800 group-hover:text-foundational-600 transition-colors">
                    {path.title}
                  </h4>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    {index === 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-800">
                        <Star className="w-3 h-3 mr-1" />
                        Best Match
                      </span>
                    )}
                    <span 
                      data-difficulty={path.difficulty}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficulty)}`}
                    >
                      {path.difficulty}
                    </span>
                  </div>
                </div>
                
                <p className="text-neutral-600 text-sm mb-3 line-clamp-2">
                  {path.description}
                </p>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4 text-neutral-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{path.estimatedTime}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{path.models.length} models</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-foundational-400 group-hover:text-foundational-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-foundational-200 flex items-center justify-between">
        <button
          onClick={onStartOnboarding}
          className="text-sm text-foundational-600 hover:text-foundational-800 font-medium"
        >
          Update preferences
        </button>
        <Link
          href="/guide"
          className="text-sm text-foundational-600 hover:text-foundational-800 font-medium flex items-center"
        >
          Browse all paths
          <ArrowRight className="ml-1 w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}