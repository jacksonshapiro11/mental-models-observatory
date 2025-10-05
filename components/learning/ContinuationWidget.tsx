'use client';

import { ProgressTracker, UserProgress } from '@/lib/progress-tracker';
import { ArrowRight, BookOpen, ChevronRight, Clock, Star, Target } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ContinuationWidgetProps {
  className?: string;
}

export default function ContinuationWidget({ className = '' }: ContinuationWidgetProps) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [showWidget, setShowWidget] = useState(false);

  useEffect(() => {
    const userProgress = ProgressTracker.getProgress();
    const learningInsights = ProgressTracker.getLearningInsights();
    
    setProgress(userProgress);
    setInsights(learningInsights);
    
    // Show widget if user has any learning activity
    setShowWidget(
      userProgress.modelsViewed.length > 0 || 
      userProgress.quickStartCompleted ||
      userProgress.pathsStarted.length > 0
    );
  }, []);

  if (!showWidget || !progress || !insights) {
    return null;
  }

  const getNextStepComponent = () => {
    const nextStep = progress.suggestedNextSteps[0];
    
    if (!nextStep) {
      return (
        <Link 
          href="/models"
          className="flex items-center justify-between p-4 bg-foundational-50 rounded-lg hover:bg-foundational-100 transition-colors"
        >
          <div>
            <p className="font-medium text-foundational-800">Explore More Models</p>
            <p className="text-sm text-foundational-600">Discover new mental frameworks</p>
          </div>
          <ChevronRight className="h-5 w-5 text-foundational-600" />
        </Link>
      );
    }

    const getStepLink = () => {
      switch (nextStep.type) {
        case 'model':
          return `/models/${nextStep.slug}`;
        case 'domain':
          return `/knowledge-domains/${nextStep.slug}`;
        case 'path':
          return nextStep.slug === 'personalized-onboarding' ? '/?personalize=true' : `/guide/path/${nextStep.slug}`;
        default:
          return '/models';
      }
    };

    return (
      <Link 
        href={getStepLink()}
        className="flex items-center justify-between p-4 bg-accent-50 rounded-lg hover:bg-accent-100 transition-colors"
      >
        <div>
          <p className="font-medium text-accent-800">Suggested Next Step</p>
          <p className="text-sm text-accent-600">{nextStep.reason}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-accent-600" />
      </Link>
    );
  };

  const getRecentAchievement = () => {
    if (progress.achievements.length === 0) return null;
    
    const latest = progress.achievements.sort((a, b) => b.unlockedAt - a.unlockedAt)[0];
    if (!latest) return null;
    
    const isRecent = Date.now() - latest.unlockedAt < 24 * 60 * 60 * 1000; // 24 hours
    
    if (!isRecent) return null;
    
    return (
      <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
          <Star className="h-4 w-4 text-green-600 fill-current" />
        </div>
        <div>
          <p className="text-sm font-medium text-green-800">{latest.title}</p>
          <p className="text-xs text-green-600">{latest.description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-neutral-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-800">Continue Learning</h3>
            <p className="text-sm text-neutral-600">
              {insights.totalModelsViewed} models explored • {Math.round(insights.completionRate * 100)}% completion rate
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foundational-600">{insights.learningStreak}</div>
            <div className="text-xs text-neutral-500">day streak</div>
          </div>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="p-6 border-b border-neutral-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-foundational-100 flex items-center justify-center mx-auto mb-2">
              <BookOpen className="h-6 w-6 text-foundational-600" />
            </div>
            <div className="text-lg font-semibold text-neutral-800">{insights.totalModelsViewed}</div>
            <div className="text-xs text-neutral-600">Models</div>
          </div>
          
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-practical-100 flex items-center justify-center mx-auto mb-2">
              <Target className="h-6 w-6 text-practical-600" />
            </div>
            <div className="text-lg font-semibold text-neutral-800">{insights.totalDomainsExplored}</div>
            <div className="text-xs text-neutral-600">Domains</div>
          </div>
          
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-specialized-100 flex items-center justify-center mx-auto mb-2">
              <Clock className="h-6 w-6 text-specialized-600" />
            </div>
            <div className="text-lg font-semibold text-neutral-800">
              {Math.round(progress.totalTimeSpent / 60)}m
            </div>
            <div className="text-xs text-neutral-600">Learning</div>
          </div>
        </div>
      </div>

      {/* Recent Achievement */}
      {getRecentAchievement() && (
        <div className="p-6 border-b border-neutral-200">
          {getRecentAchievement()}
        </div>
      )}

      {/* Incomplete Models */}
      {progress.modelsViewed.some(m => !m.completed) && (
        <div className="p-6 border-b border-neutral-200">
          <h4 className="text-sm font-medium text-neutral-800 mb-3">Continue Where You Left Off</h4>
          <div className="space-y-2">
            {progress.modelsViewed
              .filter(m => !m.completed)
              .slice(0, 2)
              .map(model => (
                <Link
                  key={model.slug}
                  href={`/models/${model.slug}`}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-800 capitalize">
                      {model.slug.replace(/-/g, ' ')}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {Math.round(model.timeSpent / 60)}m spent
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Suggested Next Step */}
      <div className="p-6">
        <h4 className="text-sm font-medium text-neutral-800 mb-3">Recommended Next</h4>
        {getNextStepComponent()}
      </div>

      {/* Learning Insight */}
      <div className="p-6 pt-0">
        <div className="p-4 bg-gradient-to-r from-foundational-50 to-practical-50 rounded-lg">
          <p className="text-sm font-medium text-neutral-800 mb-1">💡 Learning Insight</p>
          <p className="text-sm text-neutral-600">{insights.suggestedFocus}</p>
        </div>
      </div>
    </div>
  );
}

// Compact version for homepage
export function ContinuationBanner({ className = '' }: ContinuationWidgetProps) {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const userProgress = ProgressTracker.getProgress();
    setProgress(userProgress);
    
    // Show banner if user has started learning but hasn't been active recently
    const hasActivity = userProgress.modelsViewed.length > 0 || userProgress.quickStartCompleted;
    const isRecentlyActive = Date.now() - userProgress.lastUpdated < 24 * 60 * 60 * 1000; // 24 hours
    
    setShowBanner(hasActivity && !isRecentlyActive);
  }, []);

  if (!showBanner || !progress) {
    return null;
  }

  const incompleteModels = progress.modelsViewed.filter(m => !m.completed);
  const nextStep = progress.suggestedNextSteps[0];

  return (
    <div className={`bg-gradient-to-r from-foundational-500 to-foundational-600 text-white rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium mb-1">Welcome back! 👋</p>
          <p className="text-sm text-foundational-100">
            {incompleteModels.length > 0 
              ? `You have ${incompleteModels.length} concepts to complete`
              : 'Ready to continue your learning journey?'
            }
          </p>
        </div>
        
        <Link
          href={nextStep ? `/models/${nextStep.slug}` : '/models'}
          className="btn btn-white btn-sm group"
        >
          Continue
          <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
