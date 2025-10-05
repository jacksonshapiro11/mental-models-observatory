'use client';

import { getAllModels } from '@/lib/data';
import { DynamicLearningPath, DynamicPathGenerator } from '@/lib/dynamic-path-generator';
import { UserProfile } from '@/types/user';
import { ArrowRight, Brain, CheckCircle, Clock, Lightbulb, Play, Star, Target, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TrulyPersonalizedResultsProps {
  profile: UserProfile & { personalContext: any };
}

export default function TrulyPersonalizedResults({ profile }: TrulyPersonalizedResultsProps) {
  const [personalizedPaths, setPersonalizedPaths] = useState<DynamicLearningPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateTrulyPersonalizedPaths();
  }, [profile]);

  const generateTrulyPersonalizedPaths = () => {
    const allModels = getAllModels();
    
    console.log('Generating paths for profile:', profile);
    console.log('Continuation type:', profile.personalContext?.continuationType);
    
    // Generate dynamic paths but map them to existing path IDs for proper linking
    const dynamicPaths = DynamicPathGenerator.generateDynamicPaths(allModels, profile);
    
    console.log('Generated dynamic paths:', dynamicPaths);
    
    // Map dynamic paths to existing path IDs so they link properly
    const mappedPaths = dynamicPaths.map((path, index) => {
      const existingIds = ['decision-maker', 'business-strategist', 'creative-thinker', 'system-thinker', 'psychology-expert', 'learning-optimizer'];
      return {
        ...path,
        id: existingIds[index] || 'decision-maker' // Fallback to first ID
      };
    });
    
    console.log('Mapped paths:', mappedPaths);
    
    // Store dynamic paths in sessionStorage so the path page can access them
    sessionStorage.setItem('dynamic_paths', JSON.stringify(mappedPaths));
    
    setPersonalizedPaths(mappedPaths);
    setLoading(false);
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
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-foundational-500 mx-auto mb-6"></div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-neutral-700">Analyzing your specific situation...</p>
            <p className="text-sm text-neutral-600">Finding the mental models that will help you most</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50">
      <div className="container mx-auto px-4 py-8">
        {/* Personalized Welcome */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-foundational-100 text-foundational-800 px-6 py-3 rounded-full text-sm font-medium mb-6">
            <Zap className="h-5 w-5" />
            <span>Your Personal Learning Plan</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-800 mb-6">
            Here's How to{' '}
            <span className="gradient-text">
              {profile.personalContext.specificChallenge ? 'Solve This' : 'Think Better'}
            </span>
          </h1>
          
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 rounded-lg bg-foundational-100">
                  <Target className="h-6 w-6 text-foundational-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg text-neutral-700 mb-2">
                    <strong>Your Challenge:</strong> "{profile.personalContext.specificChallenge}"
                  </p>
                  <p className="text-neutral-600">
                    {profile.personalContext.personalizedReason}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Learning Paths */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-neutral-800 mb-2 text-center">Your Learning Paths</h2>
          <p className="text-center text-neutral-600 mb-8">
            {personalizedPaths.length} paths dynamically generated for your specific situation
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {personalizedPaths.map((path, index) => (
              <div key={path.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Path Header */}
                <div className={`p-6 ${getPathColor(path.pathType)} text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold">{path.title}</h3>
                    <div className="flex items-center space-x-1">
                      {getPathIcon(path.pathType)}
                      <span className="text-xs font-medium">{getPathTypeLabel(path.pathType)}</span>
                    </div>
                  </div>
                  <p className="text-white/90 text-sm">{path.description}</p>
                </div>

                {/* Why This Path */}
                <div className="p-4 bg-foundational-50 border-b">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 rounded bg-foundational-100">
                      <Lightbulb className="h-4 w-4 text-foundational-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foundational-800 mb-1">Why this path?</p>
                      <p className="text-sm text-foundational-700">{path.personalizedReason}</p>
                    </div>
                  </div>
                </div>

                {/* Path Details */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 text-sm text-neutral-500">
                      <Clock className="h-4 w-4" />
                      <span>{path.estimatedTotalTime}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-neutral-500">
                      <Brain className="h-4 w-4" />
                      <span>{path.models.length} models</span>
                    </div>
                  </div>

                  {/* Model Preview */}
                  <div className="space-y-2 mb-6">
                    {path.models.slice(0, 2).map((pathModel, modelIndex) => (
                      <div key={modelIndex} className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                        <div className="h-6 w-6 rounded-full bg-foundational-100 flex items-center justify-center text-foundational-600 font-semibold text-xs">
                          {modelIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-neutral-800 text-sm">{pathModel.model.name}</p>
                          <p className="text-xs text-neutral-600">{pathModel.reasoning}</p>
                        </div>
                      </div>
                    ))}
                    
                    {path.models.length > 2 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-neutral-500">
                          +{path.models.length - 2} more models
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Difficulty & Features */}
                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Difficulty:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(path.difficulty)}`}>
                        {path.difficulty}
                      </span>
                    </div>
                    
                    {path.adaptiveFeatures.branchingPoints.length > 0 && (
                      <div className="text-xs text-accent-600">
                        ✨ Adaptive branching based on your progress
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <Link 
                    href={`/guide/path/${path.id}`}
                    className="w-full btn btn-primary group flex items-center justify-center"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start This Path
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

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
      return 'bg-green-100 text-green-800';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'challenging':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-800';
  }
}
