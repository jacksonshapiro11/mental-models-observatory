'use client';

import Button from '@/components/ui/Button';
import { SearchFilters, SearchResult } from '@/types/models';
import {
    ChevronDown,
    ChevronUp,
    Filter,
    Grid,
    List,
    Loader2,
    Search,
    SortAsc,
    SortDesc
} from 'lucide-react';
import { useMemo, useState } from 'react';
import DomainCard from './DomainCard';
import HighlightBlock from './HighlightBlock';
import SubModelCard from './SubModelCard';

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  loading?: boolean;
  onResultClick?: (result: SearchResult) => void;
  filters?: SearchFilters;
  onFilterChange?: (filters: SearchFilters) => void;
}

interface GroupedResults {
  domains: SearchResult[];
  submodels: SearchResult[];
  highlights: SearchResult[];
}

const defaultFilters: SearchFilters = {
  tiers: [],
  domains: [],
  difficulty: [],
  tags: [],
  hasExamples: false,
  minRelevanceScore: 0
};

export function SearchResults({
  query,
  results,
  loading = false,
  onResultClick,
  filters = defaultFilters,
  onFilterChange
}: SearchResultsProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'date'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Group results by type
  const groupedResults: GroupedResults = useMemo(() => {
    const grouped = results.reduce((acc, result) => {
      switch (result.type) {
        case 'domain':
          acc.domains.push(result);
          break;
        case 'submodel':
          acc.submodels.push(result);
          break;
        case 'highlight':
          acc.highlights.push(result);
          break;
      }
      return acc;
    }, { domains: [], submodels: [], highlights: [] } as GroupedResults);

    // Sort each group
    const sortFunction = (a: SearchResult, b: SearchResult) => {
      let comparison = 0;
      switch (sortBy) {
        case 'relevance':
          comparison = b.relevanceScore - a.relevanceScore;
          break;
        case 'name':
          const aName = 'title' in a.item ? a.item.title : 'text' in a.item ? a.item.text.slice(0, 50) : '';
          const bName = 'title' in b.item ? b.item.title : 'text' in b.item ? b.item.text.slice(0, 50) : '';
          comparison = aName.localeCompare(bName);
          break;
        case 'date':
          const aDate = 'lastUpdated' in a.item ? a.item.lastUpdated : 'highlightedAt' in a.item ? a.item.highlightedAt : '';
          const bDate = 'lastUpdated' in b.item ? b.item.lastUpdated : 'highlightedAt' in b.item ? b.item.highlightedAt : '';
          comparison = new Date(bDate).getTime() - new Date(aDate).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    };

    grouped.domains.sort(sortFunction);
    grouped.submodels.sort(sortFunction);
    grouped.highlights.sort(sortFunction);

    return grouped;
  }, [results, sortBy, sortOrder]);

  const totalResults = results.length;

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    onFilterChange?.({ ...filters, ...newFilters });
  };

  const clearFilters = () => {
    onFilterChange?.(defaultFilters);
  };

  const highlightQuery = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-foundational-600 mx-auto mb-4" />
          <p className="text-neutral-600">Searching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">
              Search Results
            </h2>
            <p className="text-sm text-neutral-600">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-neutral-200 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-foundational-100 text-foundational-700' : 'text-neutral-600 hover:text-neutral-800'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-foundational-100 text-foundational-700' : 'text-neutral-600 hover:text-neutral-800'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort controls */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'name' | 'date')}
              className="text-sm border border-neutral-200 rounded px-2 py-1"
            >
              <option value="relevance">Relevance</option>
              <option value="name">Name</option>
              <option value="date">Date</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 text-neutral-600 hover:text-neutral-800"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>

            {/* Filter toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="border-t border-neutral-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tier filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Tiers
                </label>
                <div className="space-y-1">
                  {[1, 2, 3].map((tier) => (
                    <label key={tier} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.tiers?.includes(tier) || false}
                        onChange={(e) => {
                          const newTiers = e.target.checked
                            ? [...(filters.tiers || []), tier]
                            : (filters.tiers || []).filter(t => t !== tier);
                          handleFilterChange({ tiers: newTiers });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Tier {tier}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Difficulty filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Difficulty
                </label>
                <div className="space-y-1">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <label key={level} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.difficulty?.includes(level) || false}
                        onChange={(e) => {
                          const newDifficulty = e.target.checked
                            ? [...(filters.difficulty || []), level]
                            : (filters.difficulty || []).filter(d => d !== level);
                          handleFilterChange({ difficulty: newDifficulty });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Relevance score */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Min Relevance Score
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.minRelevanceScore || 0}
                  onChange={(e) => handleFilterChange({ minRelevanceScore: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="text-xs text-neutral-600 mt-1">
                  {filters.minRelevanceScore || 0}/10
                </div>
              </div>

              {/* Has examples */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.hasExamples || false}
                    onChange={(e) => handleFilterChange({ hasExamples: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Has Examples</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* No results */}
      {totalResults === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-800 mb-2">
            No results found
          </h3>
          <p className="text-neutral-600 mb-4">
            Try adjusting your search terms or filters
          </p>
          <Button onClick={clearFilters}>Clear Filters</Button>
        </div>
      )}

      {/* Results sections */}
      {groupedResults.domains.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
            Domains ({groupedResults.domains.length})
          </h3>
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {groupedResults.domains.map((result) => (
              <div key={(result.item as any).id} onClick={() => onResultClick?.(result)}>
                <DomainCard 
                  domain={result.item as any}
                  variant={viewMode === 'list' ? 'list' : 'grid'}
                  showStats={true}
                />
                {result.snippet && (
                  <div className="mt-2 text-sm text-neutral-600">
                    <span dangerouslySetInnerHTML={{ 
                      __html: highlightQuery(result.snippet, query) 
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {groupedResults.submodels.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
            Mental Models ({groupedResults.submodels.length})
          </h3>
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
            {groupedResults.submodels.map((result) => (
              <div key={(result.item as any).id} onClick={() => onResultClick?.(result)}>
                <SubModelCard 
                  subModel={result.item as any}
                  compact={viewMode === 'list'}
                  showDomain={true}
                />
                {result.snippet && (
                  <div className="mt-2 text-sm text-neutral-600">
                    <span dangerouslySetInnerHTML={{ 
                      __html: highlightQuery(result.snippet, query) 
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {groupedResults.highlights.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
            Highlights ({groupedResults.highlights.length})
          </h3>
          <div className="space-y-4">
            {groupedResults.highlights.map((result) => (
              <div key={(result.item as any).readwiseId} onClick={() => onResultClick?.(result)}>
                <HighlightBlock 
                  highlight={result.item as any}
                  variant="card"
                  showBook={true}
                  showRelevanceScore={true}
                />
                {result.snippet && result.snippet !== (result.item as any).text && (
                  <div className="mt-2 text-sm text-neutral-600">
                    <span className="font-medium">Context:</span>{' '}
                    <span dangerouslySetInnerHTML={{ 
                      __html: highlightQuery(result.snippet, query) 
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default SearchResults;
