'use client';

import TrulyPersonalizedResults from '@/components/personalization/TrulyPersonalizedResults';
import { UserProfileManager } from '@/lib/user-profile';
import { UserProfile } from '@/types/user';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function ResultsContent() {
  const searchParams = useSearchParams();
  const continueType = searchParams.get('continue'); // 'deeper', 'adjacent', 'new', 'apply'
  
  const [profile, setProfile] = useState<(UserProfile & { personalContext: any }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userProfile = UserProfileManager.getProfile();
    if (userProfile) {
      // Cast to include personalContext
      let updatedProfile = userProfile as UserProfile & { personalContext: any };
      
      // If they're continuing from a completed path, adjust their context
      if (continueType && updatedProfile.personalContext) {
        updatedProfile = {
          ...updatedProfile,
          personalContext: {
            ...updatedProfile.personalContext,
            continuationType: continueType,
            isReturning: true
          }
        };
      }
      
      setProfile(updatedProfile);
    } else {
      // Redirect to homepage if no profile
      window.location.href = '/';
    }
    setLoading(false);
  }, [continueType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foundational-500 mx-auto mb-4"></div>
          <p className="text-neutral-600">Generating your personalized learning journey...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-800 mb-4">No Profile Found</h1>
          <p className="text-neutral-600 mb-6">Please complete your profile setup first.</p>
          <Link href="/" className="btn btn-primary">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return <TrulyPersonalizedResults profile={profile} />;
}

export default function PersonalizedResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foundational-500 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading your personalized results...</p>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
