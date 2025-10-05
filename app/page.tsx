'use client';

import IntelligentProfileSetup from '@/components/personalization/IntelligentProfileSetup';
import { getAllDomains, getAllModels } from '@/lib/data';
import { UserProfileManager } from '@/lib/user-profile';
import { UserProfile } from '@/types/user';
import { ArrowRight, BookOpen, Brain, Compass, Target, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const allDomains = getAllDomains();
  const allModels = getAllModels();
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleProfileComplete = (profile: UserProfile) => {
    UserProfileManager.setProfile(profile);
    // Redirect to results page instead of hiding onboarding
    window.location.href = '/guide/results';
  };

  const handleProfileSkip = () => {
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <IntelligentProfileSetup onComplete={handleProfileComplete} onSkip={handleProfileSkip} />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 py-8 sm:py-16">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
               <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-neutral-800 sm:text-6xl lg:text-7xl mb-6">
                 Guided Learning{' '}
                 <span className="gradient-text">Experience</span>
               </h1>
               <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600 mb-8">
                 The cost of information has approached zero, but the core truths of humanity and the world remain the same. Now more than ever, we need a focused and curated start to our learning journey as we risk getting lost in the dark forest of infinite self-reinforcing content. We have compiled the big ideas from the big disciplines backed up by 5000 pages of hand curated sources to help you start wide and go deep with the society altering ideas that will fill your life with meaning, purpose, and direction while giving you an edge in any pursuit.
               </p>
               
               {/* Primary CTA - Always Personalization First */}
               <div className="mt-8 space-y-4">
                 <div className="mb-6">
                   <button
                     onClick={() => setShowOnboarding(true)}
                     className="btn btn-primary btn-xl group mb-3"
                   >
                     <Compass className="mr-2 h-6 w-6" />
                     Get My Personalized Guide
                     <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                   </button>
                   <p className="text-sm text-neutral-500">Answer 5 questions • Get tailored learning paths • No signup required</p>
                 </div>
                 
                 {/* Secondary Options */}
                 <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                   <Link
                     href="/knowledge-domains"
                     className="btn btn-outline btn-lg"
                   >
                     Explore All Domains
                   </Link>
                   
                   <span className="text-neutral-400 hidden sm:block">or</span>
                   
                   <Link
                     href="/models"
                     className="btn btn-ghost btn-lg"
                   >
                     Browse All Models
                   </Link>
                 </div>
               </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-foundational-100">
                <Brain className="h-6 w-6 text-foundational-600" />
              </div>
              <div className="text-3xl font-bold text-neutral-800">{allModels.length}</div>
              <div className="text-sm text-neutral-600">Mental Models</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-specialized-100">
                <Target className="h-6 w-6 text-specialized-600" />
              </div>
              <div className="text-3xl font-bold text-neutral-800">{allDomains.length}</div>
              <div className="text-sm text-neutral-600">Knowledge Domains</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-practical-100">
                <BookOpen className="h-6 w-6 text-practical-600" />
              </div>
              <div className="text-3xl font-bold text-neutral-800">100+</div>
              <div className="text-sm text-neutral-600">Source References</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100">
                <Users className="h-6 w-6 text-accent-600" />
              </div>
              <div className="text-3xl font-bold text-neutral-800">Growing</div>
              <div className="text-sm text-neutral-600">Community</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
