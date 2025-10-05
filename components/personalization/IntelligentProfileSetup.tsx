'use client';

import { UserProfile } from '@/types/user';
import { ArrowRight, BookOpen, Brain, Clock, Eye, Layers, Lightbulb, Target, TrendingUp, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IntelligentProfileSetupProps {
  onComplete: (profile: UserProfile & { personalContext: any }) => void;
  onSkip: () => void;
}

export default function IntelligentProfileSetup({ onComplete, onSkip }: IntelligentProfileSetupProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [intelligentFlags, setIntelligentFlags] = useState<any>({});
  const [interactionData, setInteractionData] = useState<{
    timeSpentPerStep: number[];
    clickPatterns: string[];
    hesitationPoints: string[];
  }>({
    timeSpentPerStep: [],
    clickPatterns: [],
    hesitationPoints: []
  });

  // Track time spent on each step
  useEffect(() => {
    const startTime = Date.now();
    return () => {
      const timeSpent = Date.now() - startTime;
      setInteractionData(prev => ({
        ...prev,
        timeSpentPerStep: [...prev.timeSpentPerStep, timeSpent]
      }));
    };
  }, [step]);

  const handleComplete = () => {
    // Analyze interaction patterns to enhance profile
    const avgTimePerStep = interactionData.timeSpentPerStep.reduce((a, b) => a + b, 0) / interactionData.timeSpentPerStep.length;
    
    // Generate personalContext for dynamic path generation
    const personalContext = {
      // Infer challenge from their interests and goals
      specificChallenge: generateChallengeFromProfile(profile, intelligentFlags),
      thinkingPattern: avgTimePerStep > 15000 ? 'I take time to think things through carefully' : 
                      avgTimePerStep > 8000 ? 'I balance speed and deliberation' : 
                      'I prefer quick decisions',
      learningStyle: intelligentFlags.learningStyle || 'balanced',
      learningStyleData: { desc: getLearningStyleDescription(intelligentFlags.learningStyle) },
      timeCommitment: intelligentFlags.sessionIntensity || 'standard',
      timeCommitmentData: { time: profile.timeAvailable },
      successDefinition: `Successfully apply mental models to my ${profile.goals} goals`,
      primaryFocus: derivePrimaryFocus(profile.interests || []),
      recommendedApproach: {
        contentStyle: intelligentFlags.learningStyle || 'balanced',
        pacing: intelligentFlags.sessionIntensity || 'standard',
        difficulty: profile.preferredDifficulty || 'mixed'
      },
      personalizedReason: `Based on your interests in ${(profile.interests || []).join(', ')} and your ${profile.goals} goals`
    };

    const completeProfile: UserProfile = {
      experience: profile.experience || 'some',
      interests: profile.interests || [],
      goals: profile.goals || 'curiosity',
      timeAvailable: profile.timeAvailable || '15min',
      preferredDifficulty: profile.preferredDifficulty || 'mixed',
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    
    onComplete({ ...completeProfile, personalContext });
  };
  
  // Helper function to generate challenge from profile
  const generateChallengeFromProfile = (profile: Partial<UserProfile>, flags: any) => {
    const interests = profile.interests || [];
    const goals = profile.goals || 'learning';
    
    if (interests.includes('business') && goals === 'work') {
      return 'Building a successful business and making strategic decisions';
    }
    if (interests.includes('decisions')) {
      return 'Making better decisions under uncertainty';
    }
    if (interests.includes('psychology') || interests.includes('learning')) {
      return 'Understanding how people think and behave';
    }
    if (interests.includes('creativity')) {
      return 'Solving creative problems and generating innovative ideas';
    }
    if (interests.includes('systems')) {
      return 'Understanding complex systems and how they work';
    }
    
    return `Improving my thinking and ${goals}`;
  };
  
  const getLearningStyleDescription = (style: string) => {
    switch (style) {
      case 'analytical': return 'deep analysis and thorough understanding';
      case 'exploratory': return 'broad exploration and connecting ideas';
      case 'practical': return 'hands-on application and real-world examples';
      default: return 'balanced learning approach';
    }
  };
  
  const derivePrimaryFocus = (interests: string[]) => {
    if (interests.includes('business')) return 'business-strategy';
    if (interests.includes('decisions')) return 'decision-making';
    if (interests.includes('psychology')) return 'human-psychology';
    if (interests.includes('creativity')) return 'creative-thinking';
    if (interests.includes('systems')) return 'systems-thinking';
    return 'general-thinking';
  };

  const trackInteraction = (action: string) => {
    setInteractionData(prev => ({
      ...prev,
      clickPatterns: [...prev.clickPatterns, action]
    }));
  };

  const trackHesitation = (area: string) => {
    setInteractionData(prev => ({
      ...prev,
      hesitationPoints: [...prev.hesitationPoints, area]
    }));
  };

  // Enhanced interest options with more granular tracking
  const interestOptions = [
    { 
      id: 'business', 
      label: 'Business & Strategy', 
      icon: TrendingUp,
      subCategories: ['startups', 'investing', 'leadership', 'operations'],
      description: 'Building, growing, and optimizing organizations'
    },
    { 
      id: 'decisions', 
      label: 'Decision Making', 
      icon: Target,
      subCategories: ['probability', 'biases', 'frameworks', 'intuition'],
      description: 'Making better choices under uncertainty'
    },
    { 
      id: 'creativity', 
      label: 'Creativity & Innovation', 
      icon: Lightbulb,
      subCategories: ['design', 'problem-solving', 'ideation', 'breakthrough'],
      description: 'Generating novel solutions and ideas'
    },
    { 
      id: 'systems', 
      label: 'Systems Thinking', 
      icon: Layers,
      subCategories: ['complexity', 'emergence', 'feedback', 'networks'],
      description: 'Understanding interconnections and patterns'
    },
    { 
      id: 'psychology', 
      label: 'Human Psychology', 
      icon: Brain,
      subCategories: ['behavior', 'motivation', 'cognition', 'social'],
      description: 'How minds work and people behave'
    },
    { 
      id: 'learning', 
      label: 'Learning & Growth', 
      icon: BookOpen,
      subCategories: ['skills', 'habits', 'mastery', 'meta-learning'],
      description: 'Accelerating personal development'
    },
    { 
      id: 'science', 
      label: 'Science & Research', 
      icon: Eye,
      subCategories: ['physics', 'biology', 'data', 'methods'],
      description: 'Understanding how the world works'
    },
    { 
      id: 'philosophy', 
      label: 'Philosophy & Meaning', 
      icon: Zap,
      subCategories: ['ethics', 'existence', 'truth', 'purpose'],
      description: 'Big questions about life and reality'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-foundational-100 text-foundational-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Brain className="h-4 w-4" />
              <span>Intelligent Setup - Step {step} of 5</span>
            </div>
            <h2 className="text-3xl font-bold text-neutral-800 mb-2">
              Create Your Learning DNA
            </h2>
            <p className="text-neutral-600">
              We'll analyze your responses to craft a truly personalized experience
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 rounded-full h-3 mb-8">
            <div 
              className="bg-gradient-to-r from-foundational-500 to-foundational-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>

          {/* Step 1: Learning Context */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-neutral-800">
                What's driving your learning journey right now?
              </h3>
              <p className="text-neutral-600">
                This helps us understand your motivation and tailor the experience accordingly.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { 
                    value: 'curiosity', 
                    label: 'Pure Curiosity', 
                    desc: 'I love exploring big ideas and connecting dots',
                    icon: Eye
                  },
                  { 
                    value: 'work', 
                    label: 'Professional Growth', 
                    desc: 'I want to level up my thinking for career success',
                    icon: TrendingUp
                  },
                  { 
                    value: 'learning', 
                    label: 'Learning Mastery', 
                    desc: 'I want to become a more effective learner',
                    icon: BookOpen
                  },
                  { 
                    value: 'teaching', 
                    label: 'Teaching Others', 
                    desc: 'I want to share knowledge and help others grow',
                    icon: Users
                  }
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setProfile({ ...profile, goals: option.value as any });
                        trackInteraction(`goal-${option.value}`);
                      }}
                      onMouseEnter={() => trackHesitation(`goal-${option.value}`)}
                      className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                        profile.goals === option.value
                          ? 'border-foundational-500 bg-foundational-50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-2 rounded-lg bg-foundational-100">
                          <Icon className="h-5 w-5 text-foundational-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-800 mb-1">{option.label}</div>
                          <div className="text-sm text-neutral-600">{option.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Deep Interest Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-neutral-800">
                Which areas spark your curiosity? (Select 2-4)
              </h3>
              <p className="text-neutral-600">
                We'll use this to find unexpected connections and personalized insights.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interestOptions.map((interest) => {
                  const isSelected = profile.interests?.includes(interest.id) || false;
                  const Icon = interest.icon;
                  
                  return (
                    <button
                      key={interest.id}
                      onClick={() => {
                        const current = profile.interests || [];
                        const updated = isSelected
                          ? current.filter(i => i !== interest.id)
                          : [...current, interest.id];
                        setProfile({ ...profile, interests: updated });
                        trackInteraction(`interest-${interest.id}-${isSelected ? 'remove' : 'add'}`);
                      }}
                      onMouseEnter={() => trackHesitation(`interest-${interest.id}`)}
                      className={`p-6 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md ${
                        isSelected
                          ? 'border-foundational-500 bg-foundational-50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-2 rounded-lg bg-foundational-100">
                          <Icon className="h-6 w-6 text-foundational-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-neutral-800 mb-1">
                            {interest.label}
                          </div>
                          <div className="text-sm text-neutral-600 mb-2">
                            {interest.description}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {interest.subCategories.map(sub => (
                              <span key={sub} className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded">
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Learning Style Detection */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-neutral-800">
                How do you prefer to learn complex concepts?
              </h3>
              <p className="text-neutral-600">
                This helps us optimize the presentation and pacing for your learning style.
              </p>
              <div className="space-y-4">
                {[
                  { 
                    value: 'deep-dive', 
                    label: 'Deep Dive', 
                    desc: 'I like to thoroughly understand one concept before moving on',
                    style: 'analytical'
                  },
                  { 
                    value: 'broad-then-deep', 
                    label: 'Survey Then Focus', 
                    desc: 'I prefer to get an overview first, then dive deeper into interesting areas',
                    style: 'exploratory'
                  },
                  { 
                    value: 'practical-first', 
                    label: 'Show Me Examples', 
                    desc: 'I learn best when I can see real-world applications immediately',
                    style: 'practical'
                  },
                  { 
                    value: 'visual-connections', 
                    label: 'Connect the Dots', 
                    desc: 'I like to see how concepts relate and build on each other',
                    style: 'visual'
                  }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setIntelligentFlags({ 
                        ...intelligentFlags, 
                        learningStyle: option.style,
                        learningPreference: option.value 
                      });
                      trackInteraction(`learning-style-${option.value}`);
                    }}
                    onMouseEnter={() => trackHesitation(`learning-style-${option.value}`)}
                    className={`w-full text-left p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                      intelligentFlags.learningPreference === option.value
                        ? 'border-foundational-500 bg-foundational-50 shadow-md'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-semibold text-neutral-800 mb-1">{option.label}</div>
                    <div className="text-sm text-neutral-600">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Experience & Time */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-neutral-800">
                  What's your experience with mental models and frameworks?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: 'new', label: 'New Explorer', desc: 'Mental models are new to me', level: 'beginner' },
                    { value: 'some', label: 'Familiar User', desc: 'I know some frameworks', level: 'intermediate' },
                    { value: 'experienced', label: 'Advanced Practitioner', desc: 'I regularly use mental models', level: 'advanced' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setProfile({ ...profile, experience: option.value as any });
                        setIntelligentFlags({ ...intelligentFlags, skillLevel: option.level });
                        trackInteraction(`experience-${option.value}`);
                      }}
                      className={`p-6 rounded-lg border-2 transition-all duration-200 text-center hover:shadow-md ${
                        profile.experience === option.value
                          ? 'border-foundational-500 bg-foundational-50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="font-semibold text-neutral-800 mb-2">{option.label}</div>
                      <div className="text-sm text-neutral-600">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-neutral-800">
                  How much time do you typically have for focused learning?
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { value: '5min', label: '5 min', desc: 'Quick insights', intensity: 'micro' },
                    { value: '15min', label: '15 min', desc: 'Focused sessions', intensity: 'standard' },
                    { value: '30min', label: '30 min', desc: 'Deep dives', intensity: 'extended' },
                    { value: '60min', label: '60+ min', desc: 'Immersive learning', intensity: 'intensive' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setProfile({ ...profile, timeAvailable: option.value as any });
                        setIntelligentFlags({ ...intelligentFlags, sessionIntensity: option.intensity });
                        trackInteraction(`time-${option.value}`);
                      }}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 text-center hover:shadow-md ${
                        profile.timeAvailable === option.value
                          ? 'border-foundational-500 bg-foundational-50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <Clock className="w-6 h-6 mx-auto mb-2 text-foundational-600" />
                      <div className="font-semibold text-neutral-800">{option.label}</div>
                      <div className="text-xs text-neutral-600">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Challenge Preference */}
          {step === 5 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-neutral-800">
                How do you like to be challenged?
              </h3>
              <p className="text-neutral-600">
                We'll use this to calibrate the difficulty progression in your learning paths.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { 
                    value: 'gentle', 
                    label: 'Gentle Progression', 
                    desc: 'Build confidence with manageable steps',
                    difficulty: 'beginner'
                  },
                  { 
                    value: 'moderate', 
                    label: 'Balanced Challenge', 
                    desc: 'Mix of comfortable and stretching concepts',
                    difficulty: 'mixed'
                  },
                  { 
                    value: 'aggressive', 
                    label: 'Push My Limits', 
                    desc: 'Challenge me with complex, advanced concepts',
                    difficulty: 'advanced'
                  },
                  { 
                    value: 'adaptive', 
                    label: 'Adapt to My Progress', 
                    desc: 'Adjust difficulty based on how I\'m doing',
                    difficulty: 'mixed'
                  }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setProfile({ ...profile, preferredDifficulty: option.difficulty as any });
                      setIntelligentFlags({ 
                        ...intelligentFlags, 
                        challengePreference: option.value,
                        adaptiveDifficulty: option.value === 'adaptive'
                      });
                      trackInteraction(`challenge-${option.value}`);
                    }}
                    className={`p-6 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md ${
                      intelligentFlags.challengePreference === option.value
                        ? 'border-foundational-500 bg-foundational-50 shadow-md'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-semibold text-neutral-800 mb-1">{option.label}</div>
                    <div className="text-sm text-neutral-600">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={onSkip}
              className="text-neutral-600 hover:text-neutral-800 font-medium transition-colors"
            >
              Skip for now
            </button>
            
            <div className="flex space-x-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="btn btn-outline"
                >
                  Back
                </button>
              )}
              
              {step < 5 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !profile.goals) ||
                    (step === 2 && (!profile.interests || profile.interests.length === 0)) ||
                    (step === 3 && !intelligentFlags.learningPreference) ||
                    (step === 4 && (!profile.experience || !profile.timeAvailable))
                  }
                  className="btn btn-primary group"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={!intelligentFlags.challengePreference}
                  className="btn btn-primary group"
                >
                  Create My Learning Experience
                  <Zap className="ml-2 h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
