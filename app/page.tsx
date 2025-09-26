'use client';

import PersonalizedGuide from '@/components/guide/PersonalizedGuide';
import ProfileSetup from '@/components/onboarding/ProfileSetup';
import { getAllDomains, getAllModels } from '@/lib/data';
import { UserProfileManager } from '@/lib/user-profile';
import { UserProfile } from '@/types/user';
import { ArrowRight, BookOpen, Brain, Compass, Filter, Search, Sparkles, Target, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function HomePage() {
  const allDomains = getAllDomains();
  const allModels = getAllModels();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Filter and search logic
  const filteredDomains = useMemo(() => {
    let filtered = allDomains;
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(domain => 
        domain.name.toLowerCase().includes(query) ||
        domain.description.toLowerCase().includes(query)
      );
    }
    
    // Apply tier filter
    if (selectedTier !== null) {
      filtered = filtered.filter(domain => domain.tier === selectedTier);
    }
    
    return filtered;
  }, [allDomains, searchQuery, selectedTier]);

  const filteredModels = useMemo(() => {
    let filtered = allModels;
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query) ||
        model.principles.some(p => p.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [allModels, searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTier(null);
  };

  const handleProfileComplete = (profile: UserProfile) => {
    UserProfileManager.setProfile(profile);
    setShowOnboarding(false);
  };

  const handleProfileSkip = () => {
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <ProfileSetup onComplete={handleProfileComplete} onSkip={handleProfileSkip} />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 py-20 sm:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="flex items-center space-x-2 rounded-full bg-foundational-100 px-4 py-2 text-sm font-medium text-foundational-800">
                <Sparkles className="h-4 w-4" />
                <span>40 Domains of Knowledge</span>
              </div>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-neutral-800 sm:text-6xl lg:text-7xl">
              Mental Models{' '}
              <span className="gradient-text">Observatory</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600">
              A comprehensive collection of intellectual frameworks organized across 40 domains of knowledge. 
              Each model includes core principles, real-world examples, and complete source attribution.
            </p>
            {/* Search Interface */}
            <div className="mt-10 max-w-2xl mx-auto">
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search domains, models, or concepts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent text-lg"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                
                {/* Simple Filters */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center space-x-1 text-sm text-neutral-600 hover:text-neutral-800"
                    >
                      <Filter className="h-4 w-4" />
                      <span>Filters</span>
                    </button>
                    
                    {(searchQuery || selectedTier !== null) && (
                      <button
                        onClick={clearFilters}
                        className="text-sm text-foundational-600 hover:text-foundational-800"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  
                  <div className="text-sm text-neutral-500">
                    {searchQuery || selectedTier !== null ? (
                      <>
                        {filteredDomains.length} domains, {filteredModels.length} models
                      </>
                    ) : (
                      <>
                        {allDomains.length} domains, {allModels.length} models
                      </>
                    )}
                  </div>
                </div>
                
                {/* Filter Options */}
                {showFilters && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-neutral-200 shadow-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-neutral-700">Tier:</span>
                      {[1, 2, 3].map((tier) => (
                        <button
                          key={tier}
                          onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            selectedTier === tier
                              ? 'bg-foundational-100 text-foundational-800 border border-foundational-200'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          Tier {tier}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => setShowOnboarding(true)}
                className="btn btn-primary btn-lg group"
              >
                <Compass className="mr-2 h-5 w-5" />
                Get My Personalized Guide
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <Link
                href="/models"
                className="btn btn-outline btn-lg"
              >
                Explore All Domains
              </Link>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-500">
                ✨ Get curated learning paths based on your interests and goals
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Guide Section */}
      <section className="py-16 bg-neutral-0">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PersonalizedGuide onStartOnboarding={() => setShowOnboarding(true)} />
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

      {/* Featured Domains */}
      <section className="py-16 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-800 sm:text-4xl">
              Explore Knowledge Domains
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Discover mental models organized by domain of knowledge
            </p>
          </div>
          {searchQuery || selectedTier !== null ? (
            filteredDomains.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDomains.map((domain) => (
              <Link
                key={domain.id}
                href={`/domains/${domain.slug}`}
                className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="card-header">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: domain.color }}
                    >
                      <span className="text-white font-bold text-sm">
                        {domain.icon === 'puzzle' && '🧩'}
                        {domain.icon === 'target' && '🎯'}
                        {domain.icon === 'network' && '🌐'}
                      </span>
                    </div>
                    <div>
                      <h3 className="card-title text-lg group-hover:text-foundational-600 transition-colors">
                        {domain.name}
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {domain.models.length} models
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  <p className="text-neutral-600 text-sm">
                    {domain.description}
                  </p>
                </div>
              </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-800 mb-2">
                  No domains found
                </h3>
                <p className="text-neutral-600 mb-4">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={clearFilters}
                  className="btn btn-outline"
                >
                  Clear Filters
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allDomains.slice(0, 6).map((domain) => (
                <Link
                  key={domain.id}
                  href={`/domains/${domain.slug}`}
                  className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="card-header">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: domain.color }}
                      >
                        <span className="text-white font-bold text-sm">
                          {domain.icon === 'puzzle' && '🧩'}
                          {domain.icon === 'target' && '🎯'}
                          {domain.icon === 'network' && '🌐'}
                        </span>
                      </div>
                      <div>
                        <h3 className="card-title text-lg group-hover:text-foundational-600 transition-colors">
                          {domain.name}
                        </h3>
                        <p className="text-sm text-neutral-500">
                          {domain.models.length} models
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="card-content">
                    <p className="text-neutral-600 text-sm">
                      {domain.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {!(searchQuery || selectedTier !== null) && (
            <div className="mt-12 text-center">
              <Link
                href="/domains"
                className="btn btn-outline btn-lg"
              >
                View All Domains
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Featured Models */}
      <section className="py-16 bg-neutral-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-800 sm:text-4xl">
              Popular Mental Models
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Start with these foundational thinking frameworks
            </p>
          </div>
          {searchQuery ? (
            filteredModels.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredModels.map((model) => (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="card-header">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="card-title text-lg group-hover:text-foundational-600 transition-colors">
                        {model.name}
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        {model.domain}
                      </p>
                    </div>
                    <div className={`badge badge-outline text-xs ${
                      model.difficulty === 'beginner' ? 'bg-specialized-100 text-specialized-800' :
                      model.difficulty === 'intermediate' ? 'bg-accent-100 text-accent-800' :
                      'bg-practical-100 text-practical-800'
                    }`}>
                      {model.difficulty}
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  <p className="text-neutral-600 text-sm mb-4">
                    {model.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="badge badge-secondary text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-800 mb-2">
                  No models found
                </h3>
                <p className="text-neutral-600 mb-4">
                  Try adjusting your search terms
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn btn-outline"
                >
                  Clear Search
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allModels.slice(0, 6).map((model) => (
                <Link
                  key={model.id}
                  href={`/models/${model.slug}`}
                  className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="card-header">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="card-title text-lg group-hover:text-foundational-600 transition-colors">
                          {model.name}
                        </h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {model.domain}
                        </p>
                      </div>
                      <div className={`badge badge-outline text-xs ${
                        model.difficulty === 'beginner' ? 'bg-specialized-100 text-specialized-800' :
                        model.difficulty === 'intermediate' ? 'bg-accent-100 text-accent-800' :
                        'bg-practical-100 text-practical-800'
                      }`}>
                        {model.difficulty}
                      </div>
                    </div>
                  </div>
                  <div className="card-content">
                    <p className="text-neutral-600 text-sm mb-4">
                      {model.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {model.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="badge badge-secondary text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {!searchQuery && (
            <div className="mt-12 text-center">
              <Link
                href="/models"
                className="btn btn-outline btn-lg"
              >
                Browse All Models
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-foundational-600 to-accent-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Expand Your Thinking?
          </h2>
          <p className="mt-4 text-xl text-foundational-100">
            Join thousands of learners exploring mental models for better decision-making
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/domains"
              className="btn bg-white text-foundational-600 hover:bg-neutral-100 btn-lg"
            >
              Start Exploring
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="btn btn-outline border-white text-white hover:bg-white hover:text-foundational-600 btn-lg"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
