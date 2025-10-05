'use client';

import { useState } from 'react';
import { UserProfile } from '@/types/user';
import { ArrowRight, Clock, Target, Lightbulb, Users, BookOpen, TrendingUp } from 'lucide-react';

interface ProfileSetupProps {
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
}

export default function ProfileSetup({ onComplete, onSkip }: ProfileSetupProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});

  const handleComplete = () => {
    const completeProfile: UserProfile = {
      experience: profile.experience || 'some',
      interests: profile.interests || [],
      goals: profile.goals || 'curiosity',
      timeAvailable: profile.timeAvailable || '15min',
      preferredDifficulty: profile.preferredDifficulty || 'mixed',
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    onComplete(completeProfile);
  };

  const interestOptions = [
    { id: 'business', label: 'Business & Strategy', icon: TrendingUp },
    { id: 'decisions', label: 'Decision Making', icon: Target },
    { id: 'creativity', label: 'Creativity & Innovation', icon: Lightbulb },
    { id: 'leadership', label: 'Leadership & Teams', icon: Users },
    { id: 'learning', label: 'Learning & Growth', icon: BookOpen },
    { id: 'systems', label: 'Systems Thinking', icon: '🌐' },
    { id: 'psychology', label: 'Human Psychology', icon: '🧠' },
    { id: 'science', label: 'Science & Research', icon: '🔬' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-foundational-100 text-foundational-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <span>Step {step} of 4</span>
            </div>
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">
              Personalize Your Learning Journey
            </h2>
            <p className="text-neutral-600">
              Help us recommend the best mental models for you
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 rounded-full h-2 mb-8">
            <div 
              className="bg-foundational-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>

          {/* Step 1: Experience */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-neutral-800">
                How familiar are you with mental models?
              </h3>
              <div className="space-y-3">
                {[
                  { value: 'new', label: 'New to mental models', desc: 'I\'m just getting started' },
                  { value: 'some', label: 'Some experience', desc: 'I know a few frameworks' },
                  { value: 'experienced', label: 'Very experienced', desc: 'I regularly use mental models' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProfile({ ...profile, experience: option.value as any })}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      profile.experience === option.value
                        ? 'border-foundational-500 bg-foundational-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-medium text-neutral-800">{option.label}</div>
                    <div className="text-sm text-neutral-600">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Interests */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-neutral-800">
                What areas interest you most? (Select 2-4)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {interestOptions.map((interest) => {
                  const isSelected = profile.interests?.includes(interest.id) || false;
                  const Icon = typeof interest.icon === 'string' ? null : interest.icon;
                  
                  return (
                    <button
                      key={interest.id}
                      onClick={() => {
                        const current = profile.interests || [];
                        const updated = isSelected
                          ? current.filter(i => i !== interest.id)
                          : [...current, interest.id];
                        setProfile({ ...profile, interests: updated });
                      }}
                      className={`p-4 rounded-lg border-2 transition-colors text-center ${
                        isSelected
                          ? 'border-foundational-500 bg-foundational-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">
                        {Icon ? <Icon className="w-6 h-6 mx-auto" /> : <span>{String(interest.icon)}</span>}
                      </div>
                      <div className="text-sm font-medium text-neutral-800">
                        {interest.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-neutral-800">
                What's your main goal?
              </h3>
              <div className="space-y-3">
                {[
                  { value: 'learning', label: 'Personal Learning', desc: 'Expand my knowledge and thinking' },
                  { value: 'work', label: 'Professional Development', desc: 'Improve my work performance' },
                  { value: 'curiosity', label: 'Pure Curiosity', desc: 'Explore interesting ideas' },
                  { value: 'teaching', label: 'Teaching Others', desc: 'Share knowledge with others' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setProfile({ ...profile, goals: option.value as any })}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      profile.goals === option.value
                        ? 'border-foundational-500 bg-foundational-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-medium text-neutral-800">{option.label}</div>
                    <div className="text-sm text-neutral-600">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Time & Difficulty */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-800">
                  How much time do you usually have for learning?
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: '5min', label: '5 minutes', icon: Clock },
                    { value: '15min', label: '15 minutes', icon: Clock },
                    { value: '30min', label: '30+ minutes', icon: Clock }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setProfile({ ...profile, timeAvailable: option.value as any })}
                      className={`p-4 rounded-lg border-2 transition-colors text-center ${
                        profile.timeAvailable === option.value
                          ? 'border-foundational-500 bg-foundational-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <Clock className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-sm font-medium text-neutral-800">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-800">
                  Preferred difficulty level?
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'beginner', label: 'Beginner friendly' },
                    { value: 'intermediate', label: 'Intermediate' },
                    { value: 'advanced', label: 'Advanced' },
                    { value: 'mixed', label: 'Mixed levels' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setProfile({ ...profile, preferredDifficulty: option.value as any })}
                      className={`p-3 rounded-lg border-2 transition-colors text-center ${
                        profile.preferredDifficulty === option.value
                          ? 'border-foundational-500 bg-foundational-50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-neutral-800">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={onSkip}
              className="text-neutral-600 hover:text-neutral-800 font-medium"
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
              
              {step < 4 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !profile.experience) ||
                    (step === 2 && (!profile.interests || profile.interests.length === 0)) ||
                    (step === 3 && !profile.goals)
                  }
                  className="btn btn-primary"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={!profile.timeAvailable || !profile.preferredDifficulty}
                  className="btn btn-primary"
                >
                  Complete Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}