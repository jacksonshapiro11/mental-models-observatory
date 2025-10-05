'use client';

import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/types/user';
import { IntelligentPersonalizationEngine, AdaptiveLearningPath, DetailedUserBehavior } from '@/lib/intelligent-personalization';
import { ArrowRight, Brain, Clock, Zap, Target, TrendingUp, Eye, Layers, BookOpen, Sparkles, ChevronRight, Play, Star, Users, Lightbulb } from 'lucide-react';
import Link from 'next/link';

interface IntelligentResultsPageProps {
  profile: UserProfile & { intelligentFlags: any };
}

export default function IntelligentResultsPage({ profile }: IntelligentResultsPageProps) {
  const [adaptivePaths, setAdaptivePaths] = useState<AdaptiveLearningPath[]>([]);
  const [learningProfile, setLearningProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create initial behavior object for new users
    const initialBehavior: DetailedUserBehavior = {
      visitedDomains: [],
      visitedModels: [],
      searchQueries: [],
      timeSpentOnPages: {},
      completedPaths: [],
      bookmarkedModels: [],
      lastSession: Date.now(),
      highlightEngagement: {},
      learningVelocity: {},
      conceptMastery: {},
      interestDrift: [{
        timestamp: Date.now(),
        interests: profile.interests,
        confidence: 0.8
      }],
      applicationAttempts: {}
    };

    // Generate intelligent learning profile
    const learningAnalysis = IntelligentPersonalizationEngine.analyzeUserLearningProfile(initialBehavior);
    setLearningProfile(learningAnalysis);

    // Generate adaptive paths
    const paths = IntelligentPersonalizationEngine.generateAdaptivePaths(profile, initialBehavior);
    setAdaptivePaths(paths);
    
    setLoading(false);
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-foundational-500 mx-auto mb-6"></div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-neutral-700">Analyzing your learning DNA...</p>
            <p className="text-sm text-neutral-600">Creating your personalized experience</p>
          </div>
        </div>
      </div>
    );
  }

  const getGoalIcon = (goal: string) => {
    switch (goal) {
      case 'work': return TrendingUp;
      case 'learning': return BookOpen;
      case 'curiosity': return Eye;
      case 'teaching': return Users;
      default: return Target;
    }
  };

  const getInterestIcon = (interest: string) => {
    switch (interest) {
      case 'business': return TrendingUp;
      case 'decisions': return Target;
      case 'creativity': return Lightbulb;
      case 'systems': return Layers;
      case 'psychology': return Brain;
      case 'learning': return BookOpen;
      case 'science': return Eye;
      default: return Sparkles;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50">
      <div className="container mx-auto px-4 py-8">
        {/* Personalized Welcome */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-foundational-100 text-foundational-800 px-6 py-3 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-5 w-5" />
            <span>Your Intelligent Learning Experience</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-800 mb-6">
            Welcome to Your{' '}
            <span className="gradient-text">Personalized Journey</span>
          </h1>
          
          <div className="max-w-3xl mx-auto">
            <p className="text-xl text-neutral-600 mb-4">
              Based on your {profile.intelligentFlags.learningStyle} learning style and interest in{' '}
              <span className="font-semibold text-foundational-600">
                {profile.interests.slice(0, 2).join(' and ')}
              </span>
              {profile.interests.length > 2 && (
                <span className="font-semibold text-foundational-600">
                  {' '}(+{profile.interests.length - 2} more)
                </span>
              )}
              , we've crafted an adaptive learning experience just for you.
            </p>
            
            {profile.intelligentFlags.setupBehavior && (
              <p className="text-lg text-neutral-500">
                Your {profile.intelligentFlags.setupBehavior.deliberationStyle} approach to setup suggests 
                you'll appreciate our {learningProfile?.preferredComplexity} learning progression.
              </p>
            )}
          </div>
        </div>

        {/* Learning DNA Analysis */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-neutral-800 mb-6 flex items-center">
            <Brain className="h-6 w-6 text-foundational-600 mr-3" />
            Your Learning DNA
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-foundational-50 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-foundational-100 flex items-center justify-center mx-auto mb-3">
                {React.createElement(getGoalIcon(profile.goals), { className: "h-6 w-6 text-foundational-600" })}
              </div>
              <p className="text-sm text-neutral-500 mb-1">Primary Goal</p>
              <p className="font-semibold text-neutral-800 capitalize">{profile.goals}</p>
            </div>
            
            <div className="text-center p-4 bg-practical-50 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-practical-100 flex items-center justify-center mx-auto mb-3">
                <Zap className="h-6 w-6 text-practical-600" />
              </div>
              <p className="text-sm text-neutral-500 mb-1">Learning Style</p>
              <p className="font-semibold text-neutral-800 capitalize">
                {profile.intelligentFlags.learningStyle || 'Adaptive'}
              </p>
            </div>
            
            <div className="text-center p-4 bg-specialized-50 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-specialized-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-specialized-600" />
              </div>
              <p className="text-sm text-neutral-500 mb-1">Session Length</p>
              <p className="font-semibold text-neutral-800">{profile.timeAvailable}</p>
            </div>
            
            <div className="text-center p-4 bg-accent-50 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-accent-600" />
              </div>
              <p className="text-sm text-neutral-500 mb-1">Challenge Level</p>
              <p className="font-semibold text-neutral-800 capitalize">
                {profile.intelligentFlags.challengePreference || profile.preferredDifficulty}
              </p>
            </div>
          </div>

          {/* Interest Breakdown */}
          <div className="mt-8 pt-6 border-t border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Your Interest Profile</h3>
            <div className="flex flex-wrap gap-3">
              {profile.interests.map((interest, index) => {
                const Icon = getInterestIcon(interest);
                return (
                  <div key={interest} className="flex items-center space-x-2 bg-neutral-100 px-4 py-2 rounded-full">
                    <Icon className="h-4 w-4 text-foundational-600" />
                    <span className="text-sm font-medium text-neutral-700 capitalize">{interest}</span>
                    {index === 0 && (
                      <span className="text-xs bg-foundational-100 text-foundational-700 px-2 py-1 rounded">Primary</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Adaptive Learning Paths */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-800 mb-4">
              Your Adaptive Learning Paths
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              These paths evolve based on your progress, interests, and learning patterns. 
              Each one is uniquely crafted for your learning DNA.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {adaptivePaths.map((path, index) => (
              <div key={path.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                {/* Path Header */}
                <div className="p-6 bg-gradient-to-r from-foundational-500 to-foundational-600 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{path.title}</h3>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-medium">Personalized</span>
                    </div>
                  </div>
                  <p className="text-foundational-100 text-sm">{path.description}</p>
                </div>

                {/* Personalization Insight */}
                <div className="p-4 bg-foundational-50 border-b">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 rounded bg-foundational-100">
                      <Sparkles className="h-4 w-4 text-foundational-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foundational-800 mb-1">Why this path?</p>
                      <p className="text-sm text-foundational-700">{path.personalizedReason}</p>
                    </div>
                  </div>
                </div>

                {/* Path Content */}
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    {path.models.slice(0, 3).map((pathModel, modelIndex) => (
                      <div key={modelIndex} className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                        <div className="h-8 w-8 rounded-lg bg-foundational-100 flex items-center justify-center text-foundational-600 font-semibold text-sm">
                          {modelIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-neutral-800 text-sm">{pathModel.model.name}</p>
                          <p className="text-xs text-neutral-600">{pathModel.reasoning}</p>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {pathModel.estimatedTime}m
                        </div>
                      </div>
                    ))}
                    
                    {path.models.length > 3 && (
                      <div className="text-center py-2">
                        <span className="text-sm text-neutral-500">
                          +{path.models.length - 3} more concepts
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Adaptive Features */}
                  <div className="mb-6 p-3 bg-accent-50 rounded-lg">
                    <p className="text-sm font-medium text-accent-800 mb-2">Adaptive Features:</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded">
                        {path.adaptiveFeatures.difficultyProgression} progression
                      </span>
                      {path.adaptiveFeatures.branchingPoints.length > 0 && (
                        <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded">
                          Smart branching
                        </span>
                      )}
                      {path.adaptiveFeatures.reinforcementTriggers.length > 0 && (
                        <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded">
                          Auto reinforcement
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link 
                    href={`/guide/path/${path.id}`}
                    className="w-full btn btn-primary group flex items-center justify-center"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start This Journey
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-neutral-800 mb-6 text-center">
            Explore Beyond Your Paths
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href="/models" 
              className="p-6 rounded-lg border-2 border-neutral-200 hover:border-foundational-300 hover:bg-foundational-50 transition-all duration-200 text-center group"
            >
              <Brain className="h-8 w-8 text-foundational-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-semibold text-neutral-800 mb-2">Browse All Models</h4>
              <p className="text-sm text-neutral-600">Explore our complete collection of 119 mental models</p>
            </Link>
            
            <Link 
              href="/knowledge-domains" 
              className="p-6 rounded-lg border-2 border-neutral-200 hover:border-practical-300 hover:bg-practical-50 transition-all duration-200 text-center group"
            >
              <Layers className="h-8 w-8 text-practical-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-semibold text-neutral-800 mb-2">Explore Domains</h4>
              <p className="text-sm text-neutral-600">Discover knowledge organized by 40 domains</p>
            </Link>
            
            <button 
              onClick={() => window.location.href = '/'}
              className="p-6 rounded-lg border-2 border-neutral-200 hover:border-specialized-300 hover:bg-specialized-50 transition-all duration-200 text-center group"
            >
              <Zap className="h-8 w-8 text-specialized-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-semibold text-neutral-800 mb-2">Retake Assessment</h4>
              <p className="text-sm text-neutral-600">Update your profile for new recommendations</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
