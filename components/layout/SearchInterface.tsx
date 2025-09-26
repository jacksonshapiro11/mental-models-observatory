'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    ArrowRight,
    Clock,
    Filter,
    Search,
    Sparkles,
    TrendingUp,
    X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface SearchSuggestion {
  text: string;
  type: 'model' | 'domain' | 'tag' | 'recent';
  count?: number;
  tier?: number;
}

interface SearchInterfaceProps {
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  onSearch?: (query: string) => void;
  onSuggestionClick?: (suggestion: SearchSuggestion) => void;
  showFilters?: boolean;
  autoFocus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const mockSuggestions: SearchSuggestion[] = [
  { text: 'Mental Models', type: 'domain', count: 156, tier: 1 },
  { text: 'Decision Making', type: 'tag', count: 89 },
  { text: 'Systems Thinking', type: 'model', count: 34, tier: 2 },
  { text: 'Cognitive Biases', type: 'domain', count: 67, tier: 3 },
  { text: 'First Principles', type: 'model', count: 23, tier: 1 },
  { text: 'Psychology', type: 'domain', count: 45, tier: 2 }
];

const mockRecentSearches: SearchSuggestion[] = [
  { text: 'confirmation bias', type: 'recent' },
  { text: 'sunk cost fallacy', type: 'recent' },
  { text: 'circle of competence', type: 'recent' },
  { text: 'opportunity cost', type: 'recent' }
];

const getSuggestionIcon = (type: string) => {
  switch (type) {
    case 'recent':
      return <Clock className="w-3 h-3" />;
    case 'model':
      return <Sparkles className="w-3 h-3" />;
    case 'domain':
      return <TrendingUp className="w-3 h-3" />;
    case 'tag':
      return <Filter className="w-3 h-3" />;
    default:
      return <Search className="w-3 h-3" />;
  }
};

const getSuggestionTypeLabel = (type: string) => {
  switch (type) {
    case 'recent': return 'Recent';
    case 'model': return 'Model';
    case 'domain': return 'Domain';
    case 'tag': return 'Tag';
    default: return '';
  }
};

const getTierColor = (tier?: number) => {
  switch (tier) {
    case 1: return 'bg-foundational-50 text-foundational-700 border-foundational-200';
    case 2: return 'bg-practical-50 text-practical-700 border-practical-200';
    case 3: return 'bg-specialized-50 text-specialized-700 border-specialized-200';
    default: return 'bg-neutral-50 text-neutral-700 border-neutral-200';
  }
};

export function SearchInterface({
  placeholder = "Search mental models, domains, highlights...",
  suggestions = mockSuggestions,
  onSearch,
  onSuggestionClick,
  showFilters = false,
  autoFocus = false,
  size = 'md'
}: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on query
  useEffect(() => {
    if (query.trim() === '') {
      setFilteredSuggestions(mockRecentSearches);
    } else {
      const filtered = suggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 8)); // Limit to 8 suggestions
    }
    setSelectedIndex(-1);
  }, [query, suggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch?.(query.trim());
      setIsOpen(false);
      
      // Add to recent searches
      const recentSearch: SearchSuggestion = {
        text: query.trim(),
        type: 'recent'
      };
      mockRecentSearches.unshift(recentSearch);
      if (mockRecentSearches.length > 5) {
        mockRecentSearches.pop();
      }
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setIsOpen(false);
    onSuggestionClick?.(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          handleSuggestionClick(filteredSuggestions[selectedIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 ${
            size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
          }`} />
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`
              w-full pl-10 pr-10 py-3 border border-neutral-300 rounded-lg 
              bg-white shadow-sm transition-all duration-200 
              focus:ring-2 focus:ring-foundational-500 focus:border-transparent 
              hover:border-neutral-400 placeholder-neutral-500
              ${sizeClasses[size]}
              ${size === 'sm' ? 'py-2' : size === 'lg' ? 'py-4' : 'py-3'}
            `}
          />
          
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>
          )}
        </div>

        {/* Submit button (hidden, for form submission) */}
        <button type="submit" className="sr-only">Search</button>
      </form>

      {/* Suggestions dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50 max-h-96 overflow-y-auto">
          {filteredSuggestions.length > 0 ? (
            <>
              {/* Header */}
              <div className="px-4 py-2 border-b border-neutral-100">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {query.trim() === '' ? 'Recent Searches' : 'Suggestions'}
                </p>
              </div>

              {/* Suggestions */}
              <div className="py-1">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.text}-${index}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                      index === selectedIndex ? 'bg-foundational-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="text-neutral-400 flex-shrink-0">
                        {getSuggestionIcon(suggestion.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-neutral-800 block truncate">
                          {suggestion.text}
                        </span>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getSuggestionTypeLabel(suggestion.type)}
                          </Badge>
                          {suggestion.tier && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getTierColor(suggestion.tier)}`}
                            >
                              Tier {suggestion.tier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {suggestion.count && (
                        <span className="text-xs text-neutral-500">
                          {suggestion.count}
                        </span>
                      )}
                      <ArrowRight className="w-3 h-3 text-neutral-400" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick actions */}
              {query.trim() && (
                <div className="border-t border-neutral-100 pt-2">
                  <button
                    onClick={handleSubmit}
                    className="w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-foundational-50 transition-colors text-foundational-600"
                  >
                    <Search className="w-3 h-3" />
                    <span className="text-sm">
                      Search for "<strong>{query}</strong>"
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-6 text-center">
              <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">
                No suggestions found
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchInterface;
