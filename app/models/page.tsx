'use client';

import { getAllDomains, getAllModels } from '@/lib/data';
import { ProgressTracker } from '@/lib/progress-tracker';
import { ArrowRight, CheckCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export default function ModelsPage() {
  const models = getAllModels();
  const domains = getAllDomains();
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [viewedModelSlugs, setViewedModelSlugs] = useState<string[]>([]);
  
  // Load viewed models from progress tracker
  useEffect(() => {
    const progress = ProgressTracker.getProgress();
    setViewedModelSlugs(progress.modelsViewed.map(m => m.slug));
  }, []);

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter(model => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Domain filter
      const matchesDomain = selectedDomain === '' || model.domainSlug === selectedDomain;
      
      // Difficulty filter
      const matchesDifficulty = selectedDifficulty === '' || model.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesDomain && matchesDifficulty;
    });
  }, [models, searchQuery, selectedDomain, selectedDifficulty]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Mental Models
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Discover powerful thinking frameworks across all domains of knowledge. 
            Each model includes principles, examples, and practical applications.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search mental models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <select 
              className="input w-auto"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              <option value="">All Domains</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.slug}>
                  {domain.name}
                </option>
              ))}
            </select>
            <select 
              className="input w-auto"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        {(searchQuery || selectedDomain || selectedDifficulty) && (
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              Showing {filteredModels.length} of {models.length} models
            </p>
          </div>
        )}

        {/* Models Grid */}
        {filteredModels.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((model) => {
              const isViewed = viewedModelSlugs.includes(model.slug);
              
              return (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className={`group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative ${
                  isViewed ? 'ring-2 ring-green-400' : ''
                }`}
              >
                {/* Reviewed Badge */}
                {isViewed && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1 text-xs font-bold shadow-lg z-10">
                    <CheckCircle className="h-3 w-3" />
                    REVIEWED
                  </div>
                )}
                
                <div className={`card-header ${isViewed ? 'bg-green-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`card-title text-lg group-hover:text-blue-600 transition-colors ${isViewed ? 'text-green-800' : ''}`}>
                        {model.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {model.domain}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      model.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      model.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {model.difficulty}
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  <p className="text-gray-600 text-sm mb-4">
                    {model.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {model.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                        +{model.tags.length - 3} more
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors">
                    <span className="text-sm font-medium">{isViewed ? 'Review again' : 'Learn more'}</span>
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No models found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('');
                setSelectedDifficulty('');
              }}
              className="btn btn-secondary"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-8 bg-white rounded-lg px-8 py-4 shadow-sm">
            <div>
              <div className="text-2xl font-bold text-gray-900">{models.length}</div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{domains.length}</div>
              <div className="text-sm text-gray-600">Domains</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {models.filter(m => m.difficulty === 'beginner').length}
              </div>
              <div className="text-sm text-gray-600">Beginner Friendly</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
