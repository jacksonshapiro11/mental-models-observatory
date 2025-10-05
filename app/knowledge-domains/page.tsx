'use client';

import { getAllDomains } from '@/lib/data';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function DomainsPage() {
  const allDomains = getAllDomains();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter domains based on search
  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) return allDomains;
    
    const query = searchQuery.toLowerCase();
    return allDomains.filter(domain =>
      domain.name.toLowerCase().includes(query) ||
      domain.description.toLowerCase().includes(query)
    );
  }, [allDomains, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Knowledge Domains
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Explore mental models organized by domain of knowledge. Each domain contains 
            carefully curated frameworks and thinking tools.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="Search domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Color Legend */}
        <div className="mb-8 flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-4 bg-white rounded-lg px-6 py-3 shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-900 rounded"></div>
              <span className="text-sm text-gray-600">Tier 1: Foundational Knowledge</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-600 rounded"></div>
              <span className="text-sm text-gray-600">Tier 2: Practical Knowledge</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-800 rounded"></div>
              <span className="text-sm text-gray-600">Tier 3: Specialized Knowledge</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-purple-400 rounded"></div>
              <span className="text-sm text-gray-600">Tier 4: Advanced Integration</span>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-6 text-center">
          <p className="text-gray-600">
            Showing {filteredDomains.length} of {allDomains.length} domains
          </p>
        </div>

        {/* Domains Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDomains.map((domain) => (
            <Link
              key={domain.id}
              href={`/knowledge-domains/${domain.slug}`}
              className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div 
                  className={`h-12 w-12 rounded-lg ${
                    domain.tier === 1 ? 'bg-blue-900' :
                    domain.tier === 2 ? 'bg-orange-600' :
                    domain.tier === 3 ? 'bg-green-800' :
                    domain.tier === 4 ? 'bg-purple-400' :
                    'bg-gray-500'
                  }`}
                >
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {domain.models?.length || 0} models
                  </p>
                </div>
              </div>
              <p className="text-gray-600 mb-4 line-clamp-3">
                {domain.description}
              </p>
              <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors">
                <span className="text-sm font-medium">Explore models</span>
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        {/* No results */}
        {filteredDomains.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No domains found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-8 bg-white rounded-lg px-8 py-4 shadow-sm">
            <div>
              <div className="text-2xl font-bold text-gray-900">{allDomains.length}</div>
              <div className="text-sm text-gray-600">Total Domains</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {allDomains.reduce((acc, domain) => acc + (domain.models?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {filteredDomains.length}
              </div>
              <div className="text-sm text-gray-600">Showing</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}