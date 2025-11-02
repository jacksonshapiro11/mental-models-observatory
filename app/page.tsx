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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-espresso-gold py-8 sm:py-16">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
               {/* Espresso & Gold badge */}
               <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--espresso-cta-bg)]/20 border border-[color:rgba(212,175,55,0.35)]">
                 <div className="w-2 h-2 rounded-full bg-[var(--espresso-accent)]"></div>
                 <span className="text-[var(--espresso-accent)] text-sm font-medium">Espresso & Gold</span>
               </div>

               <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-[var(--espresso-h1)] sm:text-6xl lg:text-7xl mb-6">
                 Guided Learning{' '}
                 <span className="text-[var(--espresso-accent)]">Experience</span>
               </h1>
               <p className="mx-auto mt-6 max-w-2xl text-xl text-[var(--espresso-body)] mb-8">
                 The cost of information has approached zero, but the core truths of humanity and the world remain the same. Now more than ever, we need a focused and curated start to our learning journey as we risk getting lost in the dark forest of infinite self-reinforcing content. We have compiled the big ideas from the big disciplines backed up by 5000 pages of hand curated sources to help you start wide and go deep with the society altering ideas that will fill your life with meaning, purpose, and direction while giving you an edge in any pursuit.
               </p>

               {/* Primary CTA - Always Personalization First */}
               <div className="mt-8 space-y-4">
                 <div className="mb-6">
                   <button
                     onClick={() => setShowOnboarding(true)}
                     className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold rounded-xl
                              bg-[var(--espresso-cta-bg)] text-[var(--espresso-cta-text)]
                              hover:bg-[#c49f2e] transition-all duration-300
                              shadow-strong hover:shadow-emphasis hover:scale-105
                              border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]
                              group mb-3"
                   >
                     <Compass className="mr-2 h-6 w-6" />
                     Get My Personalized Guide →
                   </button>
                   <p className="text-sm text-[var(--espresso-body)]/80">Answer 5 questions • Get tailored learning paths • No signup required</p>
                 </div>
                 
                 {/* Secondary Options */}
                 <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                   <Link
                     href="/knowledge-domains"
                     className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold rounded-xl
                              bg-transparent text-[var(--espresso-body)]
                              hover:bg-white/10 transition-all duration-300
                              border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]"
                   >
                     Explore All Domains
                   </Link>
                 </div>
               </div>

               {/* Color indicators */}
               <div className="mt-12 flex flex-wrap gap-4 justify-center items-center">
                 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-[color:rgba(245,237,227,0.2)]">
                   <div className="w-3 h-3 rounded-full bg-[var(--espresso-h1)]"></div>
                   <span className="text-[var(--espresso-body)] text-sm">Heading</span>
                   <span className="text-[var(--espresso-body)]/60 text-xs font-mono">#F5EDE3</span>
                 </div>
                 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-[color:rgba(229,218,203,0.2)]">
                   <div className="w-3 h-3 rounded-full bg-[var(--espresso-body)]"></div>
                   <span className="text-[var(--espresso-body)] text-sm">Body</span>
                   <span className="text-[var(--espresso-body)]/60 text-xs font-mono">#E5DACB</span>
                 </div>
                 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-[color:rgba(212,175,55,0.35)]">
                   <div className="w-3 h-3 rounded-full bg-[var(--espresso-accent)]"></div>
                   <span className="text-[var(--espresso-accent)] text-sm">Accent</span>
                   <span className="text-[var(--espresso-body)]/60 text-xs font-mono">#D4AF37</span>
                 </div>
                 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-[color:rgba(212,175,55,0.35)]">
                   <div className="w-3 h-3 rounded-full" style={{ background: 'radial-gradient(1200px 600px at 20% -10%, #2a1a0f 0%, rgba(42,26,15,0) 45%), linear-gradient(160deg, #0b0b0b 0%, #14110f 45%, #1c140f 85%)' }}></div>
                   <span className="text-[var(--espresso-body)] text-sm">Background</span>
                   <span className="text-[var(--espresso-body)]/60 text-xs">gradient</span>
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
