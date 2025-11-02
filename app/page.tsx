'use client';

import IntelligentProfileSetup from '@/components/personalization/IntelligentProfileSetup';
import QuickStartModal from '@/components/ui/QuickStartModal';
import { getAllDomains, getAllModels } from '@/lib/data';
import { UserProfileManager } from '@/lib/user-profile';
import { UserProfile } from '@/types/user';
import { ArrowRight, BookOpen, Brain, Compass, HelpCircle, Target, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const allDomains = getAllDomains();
  const allModels = getAllModels();
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);

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
      {/* Quick Start Modal */}
      <QuickStartModal isOpen={showQuickStart} onClose={() => setShowQuickStart(false)} />

      {/* Hero Section - Espresso & Gold Theme */}
      <section className="bg-espresso-gold min-h-[85vh] flex items-center justify-center py-8 sm:py-16">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
               {/* Badge */}
               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--espresso-accent)]/10 border border-[color:rgba(212,175,55,0.35)] mb-8">
                 <div className="w-2 h-2 rounded-full bg-[var(--espresso-accent)]"></div>
                 <span className="text-[var(--espresso-accent)] text-sm font-medium">Espresso & Gold</span>
               </div>

               <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6">
                 <span className="text-[var(--espresso-h1)]">Guided Learning</span>{' '}
                 <span className="text-[var(--espresso-accent)]">Experience</span>
               </h1>
               <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-[var(--espresso-body)] mb-8 leading-relaxed">
                 Warm black → espresso brown with muted gold accents. Luxurious and editorial. We curated the big ideas across disciplines so you can start wide, go deep, and make deliberate progress without drowning in infinite content.
               </p>

               {/* Color Legend */}
               <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-sm">
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full bg-[var(--espresso-h1)]"></div>
                   <span className="text-[var(--espresso-body)]">Heading <span className="text-[var(--espresso-accent)]">#F5EDE3</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full bg-[var(--espresso-body)]"></div>
                   <span className="text-[var(--espresso-body)]">Body <span className="text-[var(--espresso-accent)]">#E5DACB</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full bg-[var(--espresso-accent)]"></div>
                   <span className="text-[var(--espresso-body)]">Accent <span className="text-[var(--espresso-accent)]">#D4AF37</span></span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#0b0b0b] to-[#1c140f]"></div>
                   <span className="text-[var(--espresso-body)]">Background <span className="text-[var(--espresso-accent)]">gradient</span></span>
                 </div>
               </div>
               
               {/* Primary CTA - Always Personalization First */}
               <div className="mt-8 space-y-4">
                 <div className="mb-6">
                   <button
                     onClick={() => setShowOnboarding(true)}
                     className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-large
                              bg-[var(--espresso-cta-bg)] text-[var(--espresso-cta-text)]
                              hover:bg-[#c49f2e] transition-all duration-300
                              shadow-strong hover:shadow-emphasis hover:scale-105
                              border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]
                              group mb-3"
                   >
                     <Compass className="h-6 w-6" />
                     Get My Personalized Guide
                     <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                   </button>
                   <p className="text-sm text-[var(--espresso-body)]">Answer 5 questions • Get tailored learning paths • No signup required</p>
                 </div>
                 
                 {/* Secondary Options */}
                 <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                   <Link
                     href="/knowledge-domains"
                     className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold rounded-large
                              bg-transparent text-[var(--espresso-body)]
                              hover:bg-white/10 transition-all duration-300
                              border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]"
                   >
                     Explore All Domains
                   </Link>
                   
                   <span className="text-[var(--espresso-accent)]/50 hidden sm:block">or</span>
                   
                   <button
                     onClick={() => setShowQuickStart(true)}
                     className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-large
                              text-[var(--espresso-body)] hover:text-[var(--espresso-h1)]
                              hover:bg-white/5 transition-all duration-300"
                   >
                     <HelpCircle className="h-5 w-5" />
                     What is this?
                   </button>
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
