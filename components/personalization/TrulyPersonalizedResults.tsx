'use client';

import { CuratedPath } from '@/lib/curated-learning-paths';
import { getAllModels } from '@/lib/data';
import { DynamicLearningPath, DynamicPathGenerator } from '@/lib/dynamic-path-generator';
import { PathMatcher } from '@/lib/path-matcher';
import { ProgressTracker } from '@/lib/progress-tracker';
import { UserProfile } from '@/types/user';
import { ArrowRight, Brain, CheckCircle, Clock, Lightbulb, Play, Sparkles, Star, Target, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TrulyPersonalizedResultsProps {
  profile: UserProfile & { personalContext: any };
}

export default function TrulyPersonalizedResults({ profile }: TrulyPersonalizedResultsProps) {
  const [curatedPaths, setCuratedPaths] = useState<CuratedPath[]>([]);
  const [dynamicPaths, setDynamicPaths] = useState<DynamicLearningPath[]>([]);
  const [showDynamic, setShowDynamic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewedModelSlugs, setViewedModelSlugs] = useState<string[]>([]);
  const [completedPathIds, setCompletedPathIds] = useState<string[]>([]);

  useEffect(() => {
    generateTrulyPersonalizedPaths();
  }, [profile]);

  const generateTrulyPersonalizedPaths = () => {
    try {
      const allModels = getAllModels();
      
      // Get user progress
      const progress = ProgressTracker.getProgress();
      const viewed = progress.modelsViewed.map(m => m.slug);
      const completed = progress.pathsStarted.filter(p => p.completed).map(p => p.pathId);
      
      setViewedModelSlugs(viewed);
      setCompletedPathIds(completed);
      
      console.log('Generating paths for profile:', profile);
      console.log(`Progress: ${viewed.length} viewed models, ${completed.length} completed paths`);
      
      // 1. Get 2-3 curated paths (always shown)
      const bestCuratedPaths = PathMatcher.getBestMatches(profile, viewed, completed);
      setCuratedPaths(bestCuratedPaths);
      console.log('Curated paths:', bestCuratedPaths.map(p => p.title));
    
    // 2. Check if user has completed enough to unlock dynamic paths
    const hasCompletedEnough = completed.length >= 2 || viewed.length >= 15;
    setShowDynamic(hasCompletedEnough);
    
    if (hasCompletedEnough) {
      // Generate 3 dynamic paths for exploration
      const dynamicPathsGenerated = DynamicPathGenerator.generateDynamicPaths(
        allModels,
        profile,
        viewed,
        completed
      );
      
      // Take only top 3 and ensure they're different from curated
      const curatedModelSets = bestCuratedPaths.map(p => new Set(p.modelSlugs));
      const uniqueDynamic = dynamicPathsGenerated.filter(dynPath => {
        const dynModels = new Set(dynPath.models.map(m => m.model.slug));
        // Check if >50% overlap with any curated path
        const hasOverlap = curatedModelSets.some(curatedSet => {
          const intersection = [...dynModels].filter(slug => curatedSet.has(slug)).length;
          return intersection / dynModels.size > 0.5;
        });
        return !hasOverlap;
      }).slice(0, 3);
      
      setDynamicPaths(uniqueDynamic);
      console.log('Dynamic paths:', uniqueDynamic.map(p => p.title));
      
      // Store all paths in sessionStorage
      const allPaths = [
        ...bestCuratedPaths.map(cp => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          difficulty: cp.level === 'beginner' ? 'gentle' : cp.level === 'intermediate' ? 'moderate' : 'challenging',
          estimatedTime: cp.estimatedTime,
          models: cp.modelSlugs,
          domains: [],
          tags: cp.tags,
          icon: cp.icon,
          pathType: cp.category
        })),
        ...uniqueDynamic
      ];
      
      sessionStorage.setItem('dynamic_paths', JSON.stringify(allPaths));
    } else {
      // Store only curated paths
      const curatedOnly = bestCuratedPaths.map(cp => ({
        id: cp.id,
        title: cp.title,
        description: cp.description,
        difficulty: cp.level === 'beginner' ? 'gentle' : cp.level === 'intermediate' ? 'moderate' : 'challenging',
        estimatedTime: cp.estimatedTime,
        models: cp.modelSlugs,
        domains: [],
        tags: cp.tags,
        icon: cp.icon,
        pathType: cp.category
      }));
      
      sessionStorage.setItem('dynamic_paths', JSON.stringify(curatedOnly));
    }
    
    setLoading(false);
    } catch (error) {
      console.error('Error generating paths:', error);
      setLoading(false);
      // Set empty arrays so the page still renders
      setCuratedPaths([]);
      setDynamicPaths([]);
    }
  };

  const findRelevantModels = (allModels: any[], context: any) => {
    // Score models based on relevance to their specific challenge
    const scoredModels = allModels.map(model => {
      let score = 0;
      
      // Challenge-specific relevance
      if (context.specificChallenge) {
        const challenge = context.specificChallenge.toLowerCase();
        
        // Decision-making challenges
        if (challenge.includes('decision') || challenge.includes('choose')) {
          if (model.slug.includes('decision') || model.slug.includes('probabilistic') || model.slug.includes('bias')) score += 10;
        }
        
        // Business/startup challenges
        if (challenge.includes('business') || challenge.includes('startup')) {
          if (model.slug.includes('competitive') || model.slug.includes('strategy') || model.slug.includes('market')) score += 10;
        }
        
        // Team/people challenges
        if (challenge.includes('team') || challenge.includes('people') || challenge.includes('manage')) {
          if (model.slug.includes('psychology') || model.slug.includes('behavior') || model.slug.includes('cooperation')) score += 10;
        }
        
        // Creative/innovation challenges
        if (challenge.includes('creative') || challenge.includes('innovation') || challenge.includes('idea')) {
          if (model.slug.includes('creative') || model.slug.includes('innovation') || model.slug.includes('design')) score += 10;
        }
      }
      
      // Thinking pattern relevance
      if (context.thinkingPattern) {
        const pattern = context.thinkingPattern.toLowerCase();
        
        if (pattern.includes('overthink') && model.slug.includes('decision-quality')) score += 8;
        if (pattern.includes('overwhelmed') && model.slug.includes('systems')) score += 8;
        if (pattern.includes('options') && model.slug.includes('probabilistic')) score += 8;
      }
      
      // Learning style bonus
      if (context.learningStyle === 'story-driven' && model.examples && model.examples.length > 0) score += 3;
      if (context.learningStyle === 'principle-first' && model.principles && model.principles.length > 2) score += 3;
      
      return { model, score };
    });
    
    return scoredModels
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.model);
  };

  const findFoundationalModels = (allModels: any[], context: any) => {
    // Find foundational models that support their primary focus
    const foundationalSlugs = [
      'first-principles-thinking',
      'systems-thinking-complexity',
      'models-as-mental-procedures-operating-systems',
      'cognitive-biases-systematic-errors'
    ];
    
    return allModels.filter(model => foundationalSlugs.includes(model.slug)).slice(0, 3);
  };

  const generatePersonalizedTitle = (context: any) => {
    if (context.specificChallenge) {
      const challenge = context.specificChallenge.toLowerCase();
      
      if (challenge.includes('decision')) return 'Make Better Decisions in Your Situation';
      if (challenge.includes('business') || challenge.includes('startup')) return 'Navigate Your Business Challenge';
      if (challenge.includes('team') || challenge.includes('people')) return 'Understand & Influence People Better';
      if (challenge.includes('creative') || challenge.includes('innovation')) return 'Unlock Your Creative Problem-Solving';
    }
    
    return 'Solve Your Specific Challenge';
  };

  const generatePersonalizedDescription = (context: any) => {
    const challenge = context.specificChallenge || 'your challenge';
    const approach = context.learningStyle === 'story-driven' ? 'real-world examples' :
                    context.learningStyle === 'principle-first' ? 'core principles' :
                    context.learningStyle === 'hands-on' ? 'practical applications' : 'connected insights';
    
    return `Specifically designed for your situation with ${challenge}. Focused on ${approach} you can apply immediately.`;
  };

  const generateFoundationDescription = (context: any) => {
    const focus = context.primaryFocus === 'decision-making' ? 'decision-making' :
                 context.primaryFocus === 'business-strategy' ? 'strategic thinking' :
                 context.primaryFocus === 'human-psychology' ? 'understanding people' : 'clear thinking';
    
    return `Build the mental foundations that will make you exceptional at ${focus}. These aren't just concepts - they're thinking tools.`;
  };

  const calculatePersonalizedTime = (timeData: any, multiplier: number = 1) => {
    if (!timeData) return '15-20 minutes';
    
    const baseTime = timeData.time === '5min' ? 8 : timeData.time === '15min' ? 18 : 35;
    const adjustedTime = Math.round(baseTime * multiplier);
    
    return `${adjustedTime-5}-${adjustedTime+5} minutes`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 dark:from-[var(--espresso-bg-dark)] dark:via-[var(--espresso-bg-medium)] dark:to-[var(--espresso-bg-light)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-foundational-500 dark:border-[var(--espresso-accent)] mx-auto mb-6"></div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-neutral-700 dark:text-[var(--espresso-h1)]">Analyzing your specific situation...</p>
            <p className="text-sm text-neutral-600 dark:text-[var(--espresso-body)]">Finding the mental models that will help you most</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 dark:from-[var(--espresso-bg-dark)] dark:via-[var(--espresso-bg-medium)] dark:to-[var(--espresso-bg-light)]">
      <div className="container mx-auto px-4 py-8">
        {/* Personalized Welcome */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-foundational-100 dark:bg-[var(--espresso-accent)]/20 text-foundational-800 dark:text-[var(--espresso-accent)] px-6 py-3 rounded-full text-sm font-medium mb-6">
            <Zap className="h-5 w-5" />
            <span>Your Personal Learning Plan</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-6">
            Here's How to{' '}
            <span className="gradient-text">
              {profile.personalContext.specificChallenge ? 'Solve This' : 'Think Better'}
            </span>
          </h1>
          
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-transparent rounded-xl p-6 shadow-lg dark:shadow-none mb-6 border border-neutral-200 dark:border-[var(--espresso-accent)]/25">
              <div className="flex items-start space-x-4">
                <div className="p-2 rounded-lg bg-foundational-100 dark:bg-[var(--espresso-accent)]/20">
                  <Target className="h-6 w-6 text-foundational-600 dark:text-[var(--espresso-accent)]" />
                </div>
                <div className="text-left">
                  <p className="text-lg text-neutral-700 dark:text-[var(--espresso-body)] mb-2">
                    <strong>Your Challenge:</strong> "{profile.personalContext.specificChallenge}"
                  </p>
                  <p className="text-neutral-600 dark:text-[var(--espresso-body)]">
                    {profile.personalContext.personalizedReason}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Summary */}
        {viewedModelSlugs.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:!bg-transparent rounded-xl p-6 mb-8 border-2 border-green-200 dark:border-[var(--espresso-accent)]/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-green-800 dark:text-[var(--espresso-accent)] mb-2">Your Learning Progress</h3>
                <p className="text-green-700 dark:text-[var(--espresso-body)]">
                  You've explored <span className="font-bold text-2xl dark:text-[var(--espresso-accent)]">{viewedModelSlugs.length}</span> mental models so far!
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600 dark:text-[var(--espresso-accent)]">{completedPathIds.length}</div>
                <div className="text-sm text-green-700 dark:text-[var(--espresso-body)]">Paths Completed</div>
              </div>
            </div>
          </div>
        )}

        {/* Curated Learning Paths */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Star className="h-8 w-8 text-yellow-500 dark:text-[var(--espresso-accent)]" />
            <h2 className="text-3xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">Recommended For You</h2>
            <Star className="h-8 w-8 text-yellow-500 dark:text-[var(--espresso-accent)]" />
          </div>
          <p className="text-center text-neutral-600 dark:text-[var(--espresso-body)] mb-8">
            {curatedPaths.length} expertly curated paths matched to your goals
            {viewedModelSlugs.length > 0 && (
              <span className="block mt-2 text-sm text-green-600 dark:text-[var(--espresso-accent)] font-medium">
                ✓ Models you've already viewed are marked with gold checkmarks
              </span>
            )}
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {curatedPaths.map((path, index) => {
              const viewedCount = path.modelSlugs.filter(slug => viewedModelSlugs.includes(slug)).length;
              const totalCount = path.modelSlugs.length;
              const progressPercent = (viewedCount / totalCount) * 100;
              const isCompleted = viewedCount === totalCount && totalCount > 0;
              
              return (
              <div key={path.id} className={`bg-white dark:bg-transparent rounded-xl shadow-lg dark:shadow-none overflow-hidden hover:shadow-xl dark:hover:shadow-none transition-shadow border border-neutral-200 dark:border-[var(--espresso-accent)]/25 ${isCompleted ? 'ring-4 ring-green-400 dark:ring-[var(--espresso-accent)]' : ''}`}>
                {/* Completed Badge */}
                {isCompleted && (
                  <div className="bg-green-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-cta-text)] text-center py-2 px-4 font-bold flex items-center justify-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    PATH COMPLETED ✓
                  </div>
                )}
                
                {/* Path Header */}
                <div className={`p-6 ${getPathColor(path.category)} text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{path.icon}</span>
                    <h3 className="text-lg font-bold">{path.title}</h3>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm ${
                      path.level === 'beginner' ? 'bg-green-500/30 text-white' : 
                      path.level === 'intermediate' ? 'bg-[var(--espresso-accent)]/40 text-white' : 
                      path.level === 'advanced' ? 'bg-red-500/30 text-white' : 
                      'bg-white/20 text-white'
                    }`}>{path.level}</span>
                  </div>
                  <p className="text-white/90 text-sm">{path.description}</p>
                </div>

                {/* Path Details */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <Clock className="h-4 w-4" />
                      <span>{path.estimatedTime}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <Brain className="h-4 w-4" />
                      <span>{path.modelSlugs.length} models</span>
                    </div>
                  </div>

                  {/* Model Preview */}
                  <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                    {path.modelSlugs.slice(0, 5).map((slug, modelIndex) => {
                      const isViewed = viewedModelSlugs.includes(slug);
                      const model = getAllModels().find(m => m.slug === slug);
                      return (
                        <div key={modelIndex} className={`flex items-center space-x-3 p-2 rounded-lg transition-all ${isViewed ? 'bg-green-50 dark:bg-transparent border border-green-200 dark:border-[var(--espresso-accent)]/40' : 'bg-neutral-50 dark:bg-transparent hover:bg-neutral-100 dark:hover:bg-[var(--espresso-accent)]/10 border border-transparent dark:border-[var(--espresso-accent)]/20'}`}>
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${isViewed ? 'bg-green-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-cta-text)]' : 'bg-foundational-100 dark:bg-[var(--espresso-accent)]/20 text-foundational-600 dark:text-[var(--espresso-accent)]'}`}>
                            {isViewed ? <CheckCircle className="h-4 w-4" /> : modelIndex + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm truncate ${isViewed ? 'text-green-800 dark:text-[var(--espresso-body)] line-through' : 'text-neutral-800 dark:text-[var(--espresso-h1)]'}`}>
                              {model?.name || slug}
                              {isViewed && <span className="ml-2 text-xs text-green-600 dark:text-[var(--espresso-accent)] font-bold no-underline">✓ DONE</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {path.modelSlugs.length > 5 && (
                      <p className="text-xs text-neutral-500 dark:text-[var(--espresso-body)]/70 text-center">+{path.modelSlugs.length - 5} more models</p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {viewedCount > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-neutral-600 dark:text-[var(--espresso-body)]">Your Progress:</span>
                        <span className="font-medium text-green-600 dark:text-[var(--espresso-accent)]">{viewedCount}/{totalCount} models</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-[var(--espresso-accent)]/20 rounded-full h-2">
                        <div 
                          className="bg-green-500 dark:bg-[var(--espresso-accent)] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <Link
                    href={`/guide/path/${path.id}`}
                    className={`w-full btn group flex items-center justify-center ${isCompleted ? 'btn-outline' : 'btn-primary'}`}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Review Path
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {viewedCount > 0 ? 'Continue Path' : 'Start This Path'}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Paths (Unlocked after progress) */}
        {showDynamic && dynamicPaths.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="h-8 w-8 text-purple-500 dark:text-[var(--espresso-accent)]" />
              <h2 className="text-3xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">Explore Further</h2>
              <Sparkles className="h-8 w-8 text-purple-500 dark:text-[var(--espresso-accent)]" />
            </div>
            <p className="text-center text-neutral-600 dark:text-[var(--espresso-body)] mb-2">
              🎉 Unlocked! {dynamicPaths.length} dynamic paths generated based on your progress
            </p>
            <p className="text-center text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70 mb-8">
              These paths adapt to what you've already learned
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {dynamicPaths.map((path, index) => {
                const viewedCount = path.models.filter(m => viewedModelSlugs.includes(m.model.slug)).length;
                const totalCount = path.models.length;
                const progressPercent = (viewedCount / totalCount) * 100;
                const isCompleted = viewedCount === totalCount && totalCount > 0;
                
                return (
                  <div key={path.id} className={`bg-white dark:bg-transparent rounded-xl shadow-lg dark:shadow-none overflow-hidden hover:shadow-xl dark:hover:shadow-none transition-shadow border border-neutral-200 dark:border-[var(--espresso-accent)]/25 ${isCompleted ? 'ring-4 ring-green-400 dark:ring-[var(--espresso-accent)]' : ''}`}>
                    {isCompleted && (
                      <div className="bg-green-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-cta-text)] text-center py-2 px-4 font-bold flex items-center justify-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        PATH COMPLETED ✓
                      </div>
                    )}
                    
                    <div className={`p-6 ${getPathColor(path.pathType)} text-white`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold">{path.title}</h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm ${path.difficulty === 'gentle' ? 'bg-green-500/30 text-white' : path.difficulty === 'moderate' ? 'bg-[var(--espresso-accent)]/40 text-white' : path.difficulty === 'challenging' ? 'bg-red-500/30 text-white' : 'bg-white/20 text-white'}`}>
                          {path.difficulty}
                        </span>
                      </div>
                      <p className="text-white/90 text-sm">{path.description}</p>
                    </div>

                <div className="p-4 bg-foundational-50 dark:bg-transparent border-b dark:border-[var(--espresso-accent)]/25">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 rounded bg-foundational-100 dark:bg-[var(--espresso-accent)]/20">
                      <Lightbulb className="h-4 w-4 text-foundational-600 dark:text-[var(--espresso-accent)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foundational-800 dark:text-[var(--espresso-h1)] mb-1">Why this path?</p>
                      <p className="text-sm text-foundational-700 dark:text-[var(--espresso-body)]">{path.personalizedReason}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <Clock className="h-4 w-4" />
                      <span>{path.estimatedTotalTime}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <Brain className="h-4 w-4" />
                      <span>{path.models.length} models</span>
                    </div>
                  </div>

                      <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                        {path.models.slice(0, 5).map((pathModel, modelIndex) => {
                          const isViewed = viewedModelSlugs.includes(pathModel.model.slug);
                          return (
                            <div key={modelIndex} className={`flex items-center space-x-3 p-2 rounded-lg transition-all ${isViewed ? 'bg-green-50 dark:bg-transparent border border-green-200 dark:border-[var(--espresso-accent)]/40' : 'bg-neutral-50 dark:bg-transparent hover:bg-neutral-100 dark:hover:bg-[var(--espresso-accent)]/10 border border-transparent dark:border-[var(--espresso-accent)]/20'}`}>
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${isViewed ? 'bg-green-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-cta-text)]' : 'bg-foundational-100 dark:bg-[var(--espresso-accent)]/20 text-foundational-600 dark:text-[var(--espresso-accent)]'}`}>
                                {isViewed ? <CheckCircle className="h-4 w-4" /> : modelIndex + 1}
                        </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm truncate ${isViewed ? 'text-green-800 dark:text-[var(--espresso-body)] line-through' : 'text-neutral-800 dark:text-[var(--espresso-h1)]'}`}>
                                  {pathModel.model.name}
                                  {isViewed && <span className="ml-2 text-xs text-green-600 dark:text-[var(--espresso-accent)] font-bold no-underline">✓ DONE</span>}
                                </p>
                        </div>
                      </div>
                          );
                        })}
                        {path.models.length > 5 && (
                          <p className="text-xs text-neutral-500 dark:text-[var(--espresso-body)]/70 text-center">+{path.models.length - 5} more models</p>
                        )}
                      </div>

                      {viewedCount > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-neutral-600 dark:text-[var(--espresso-body)]">Your Progress:</span>
                            <span className="font-medium text-green-600 dark:text-[var(--espresso-accent)]">{viewedCount}/{totalCount} models</span>
                  </div>
                          <div className="w-full bg-gray-200 dark:bg-[var(--espresso-accent)]/20 rounded-full h-2">
                            <div 
                              className="bg-green-500 dark:bg-[var(--espresso-accent)] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                    </div>
                      </div>
                    )}

                  <Link 
                    href={`/guide/path/${path.id}`}
                        className={`w-full btn group flex items-center justify-center ${isCompleted ? 'btn-outline' : 'btn-primary'}`}
                  >
                        {isCompleted ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Review Path
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        ) : (
                          <>
                    <Play className="mr-2 h-4 w-4" />
                            {viewedCount > 0 ? 'Continue Path' : 'Start This Path'}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                  </Link>
                </div>
              </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Success Tracking */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h3 className="text-xl font-bold text-neutral-800 mb-4 flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
            Your Success Metrics
          </h3>
          
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-green-800 font-medium mb-2">You'll know this is working when:</p>
            <p className="text-green-700">
              {profile.personalContext.successDefinition || 'You can apply these mental models to solve similar challenges with confidence.'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/models" 
              className="btn btn-outline btn-lg"
            >
              Explore More Models
            </Link>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="btn btn-ghost btn-lg"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions for dynamic paths
function getPathColor(pathType: string): string {
  switch (pathType) {
    case 'immediate-solution':
      return 'bg-gradient-to-r from-foundational-500 to-foundational-600';
    case 'skill-building':
      return 'bg-gradient-to-r from-practical-500 to-practical-600';
    case 'deep-mastery':
      return 'bg-gradient-to-r from-specialized-500 to-specialized-600';
    case 'cross-domain':
      return 'bg-gradient-to-r from-accent-500 to-accent-600';
    case 'weakness-targeted':
      return 'bg-gradient-to-r from-orange-500 to-orange-600';
    default:
      return 'bg-gradient-to-r from-neutral-500 to-neutral-600';
  }
}

function getPathIcon(pathType: string) {
  switch (pathType) {
    case 'immediate-solution':
      return <Zap className="h-4 w-4 fill-current" />;
    case 'skill-building':
      return <Target className="h-4 w-4 fill-current" />;
    case 'deep-mastery':
      return <Star className="h-4 w-4 fill-current" />;
    case 'cross-domain':
      return <Lightbulb className="h-4 w-4 fill-current" />;
    case 'weakness-targeted':
      return <CheckCircle className="h-4 w-4 fill-current" />;
    default:
      return <Brain className="h-4 w-4 fill-current" />;
  }
}

function getPathTypeLabel(pathType: string): string {
  switch (pathType) {
    case 'immediate-solution':
      return 'Solution';
    case 'skill-building':
      return 'Skill';
    case 'deep-mastery':
      return 'Mastery';
    case 'cross-domain':
      return 'Cross-Domain';
    case 'weakness-targeted':
      return 'Targeted';
    default:
      return 'Custom';
  }
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'gentle':
      return 'bg-green-100 text-green-800 dark:bg-[#3d4a2a] dark:text-[#a8c97f]';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-[var(--espresso-accent)]/20 dark:text-[var(--espresso-accent)]';
    case 'challenging':
      return 'bg-red-100 text-red-800 dark:bg-[#5a2a2a] dark:text-[#d4a3a3]';
    default:
      return 'bg-neutral-100 text-neutral-800 dark:bg-[var(--espresso-surface)]/40 dark:text-[var(--espresso-body)]';
  }
}
