'use client';

import { ProgressTracker } from '@/lib/progress-tracker';
import { CheckCircle, ExternalLink, Loader2, Quote, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface CuratedHighlight {
  readwiseId: number;
  book: {
    title: string;
    author: string;
  };
  relevanceScore: number;
  qualityScore: number;
  insightType: string;
  curatorReason: string;
}

interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string;
  tags: string[];
  book: {
    id: number;
    title: string;
    author: string;
    cover_image_url?: string;
  };
  created_at: string;
  updated_at: string;
  url?: string;
}

interface ReadwiseHighlightsProps {
  modelSlug: string;
}

export default function ReadwiseHighlights({ modelSlug }: ReadwiseHighlightsProps) {
  const [highlights, setHighlights] = useState<{
    curatedHighlights: CuratedHighlight[];
    actualHighlights: ReadwiseHighlight[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedHighlightIds, setViewedHighlightIds] = useState<Set<number>>(new Set());
  const highlightRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Load viewed highlights from progress tracker
  useEffect(() => {
    const progress = ProgressTracker.getProgress();
    const viewedIds = new Set<number>();
    
    // Check if this model has been viewed and extract viewed highlight IDs
    const modelProgress = progress.modelsViewed.find(m => m.slug === modelSlug);
    if (modelProgress && (modelProgress as any).viewedHighlights) {
      (modelProgress as any).viewedHighlights.forEach((id: number) => viewedIds.add(id));
    }
    
    setViewedHighlightIds(viewedIds);
  }, [modelSlug]);

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        setLoading(true);
        console.log('Fetching highlights for model:', modelSlug);
        const response = await fetch(`/api/readwise/highlights/${modelSlug}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch highlights: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Highlights data received:', data);
        setHighlights(data);
      } catch (err) {
        console.error('Error fetching highlights:', err);
        setError('Failed to load highlights');
      } finally {
        setLoading(false);
      }
    };

    fetchHighlights();
  }, [modelSlug]);
  
  // Mark highlight as viewed when it's been visible for 3 seconds
  const markHighlightViewed = (highlightId: number) => {
    if (!viewedHighlightIds.has(highlightId)) {
      setViewedHighlightIds(prev => new Set(prev).add(highlightId));
      
      // Store in progress tracker (extend the model's data)
      const progress = ProgressTracker.getProgress();
      const modelIndex = progress.modelsViewed.findIndex(m => m.slug === modelSlug);
      
      if (modelIndex >= 0) {
        const model = progress.modelsViewed[modelIndex];
        if (!(model as any).viewedHighlights) {
          (model as any).viewedHighlights = [];
        }
        (model as any).viewedHighlights.push(highlightId);
        ProgressTracker.updateProgress(progress);
      }
    }
  };

  // Format insight type for display: normalize underscores/spaces and capitalize words
  const formatInsightType = (type: string): string => {
    if (!type) return 'Insight';
    
    // Normalize: replace underscores and multiple spaces with single space
    const normalized = type
      .replace(/_/g, ' ')  // Replace all underscores with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Capitalize each word
    return normalized
      .split(' ')
      .map(word => {
        // Handle special cases like "vs", "AI", etc.
        if (word.toLowerCase() === 'vs' || word.toLowerCase() === 'vs.') return word.toLowerCase();
        if (word.toUpperCase() === word && word.length <= 3) return word; // Preserve acronyms like "AI"
        
        // Capitalize first letter, lowercase the rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Get color based on insight type, using pattern matching for better coverage
  const getInsightTypeColor = (type: string) => {
    if (!type) return 'bg-gray-100 text-gray-800 dark:bg-[var(--espresso-surface)]/40 dark:text-[var(--espresso-body)]';
    
    const normalizedType = type.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
    
    // Foundational/Definition/Core concepts - Blue
    if (normalizedType.includes('foundational') || 
        normalizedType.includes('definition') || 
        normalizedType.includes('core') ||
        normalizedType === 'insight' ||
        normalizedType.includes('epistemological')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
    
    // Mechanism/Process/How it works - Green
    if (normalizedType.includes('mechanism') || 
        normalizedType.includes('process') ||
        normalizedType.includes('how') ||
        normalizedType.includes('method') ||
        normalizedType.includes('framework') ||
        normalizedType.includes('system')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
    
    // Practical/Application/Implementation/Impact - Orange
    if (normalizedType.includes('practical') || 
        normalizedType.includes('application') ||
        normalizedType.includes('implementation') ||
        normalizedType.includes('practice') ||
        normalizedType.includes('example') ||
        normalizedType.includes('case study') ||
        normalizedType.includes('use case') ||
        normalizedType.includes('impact') ||
        normalizedType.includes('real world')) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700/30';
    }
    
    // Philosophical/Philosophy/Wisdom - Purple
    if (normalizedType.includes('philosophical') || 
        normalizedType.includes('philosophy') ||
        normalizedType.includes('wisdom') ||
        normalizedType.includes('transcendence') ||
        normalizedType.includes('existential') ||
        normalizedType.includes('meaning')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    
    // Empirical/Evidence/Data - Yellow
    if (normalizedType.includes('empirical') || 
        normalizedType.includes('evidence') ||
        normalizedType.includes('data') ||
        normalizedType.includes('research') ||
        normalizedType.includes('scientific') ||
        normalizedType.includes('study')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
    
    // Design/Principles/Patterns - Pink
    if (normalizedType.includes('design') || 
        normalizedType.includes('principle') ||
        normalizedType.includes('pattern') ||
        normalizedType.includes('rule')) {
      return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
    }
    
    // Warning/Counterpoint/Caution - Red
    if (normalizedType.includes('warning') || 
        normalizedType.includes('counterpoint') ||
        normalizedType.includes('caution') ||
        normalizedType.includes('risk')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    }
    
    // Historical/Perspective/Context - Teal
    if (normalizedType.includes('historical') || 
        normalizedType.includes('perspective') ||
        normalizedType.includes('context') ||
        normalizedType.includes('development')) {
      return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
    }
    
    // Default - Gray (improved contrast for readability)
    return 'bg-gray-100 text-gray-800 dark:bg-[var(--espresso-surface)]/60 dark:text-[var(--espresso-body)] dark:border-[var(--espresso-accent)]/20';
  };

  const getScoreColor = (score: number) => {
    if (score >= 9.0) return 'text-green-600 dark:text-green-400';
    if (score >= 8.0) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-specialized-600 mr-2" />
        <span className="text-specialized-600 text-sm">Loading highlights...</span>
      </div>
    );
  }

  if (error) {
    console.error('Readwise highlights error:', error);
    return null; // Don't show anything if there's an error
  }

  if (!highlights) {
    return null; // Still loading
  }

  if (highlights.curatedHighlights.length === 0) {
    return null; // Don't show anything if there are no highlights
  }

  return (
    <div className="space-y-4">
        {highlights.curatedHighlights.map((curated, index) => {
          const actualHighlight = highlights.actualHighlights.find(
            h => h.id === curated.readwiseId
          );
          const isViewed = viewedHighlightIds.has(curated.readwiseId);
          
          return (
            <div 
              key={`${curated.readwiseId}-${index}`} 
              ref={(el) => {
                if (el) highlightRefs.current.set(curated.readwiseId, el);
              }}
              onClick={() => markHighlightViewed(curated.readwiseId)}
              className={`rounded-lg p-4 border transition-all cursor-pointer ${
                isViewed 
                  ? 'bg-neutral-50 dark:bg-transparent border-green-300 dark:border-[var(--espresso-accent)]/40 opacity-75' 
                  : 'bg-white dark:bg-transparent border-specialized-200 dark:border-[var(--espresso-accent)]/25 hover:border-specialized-300 dark:hover:border-[var(--espresso-accent)]/40'
              }`}
            >
              {/* Viewed Badge */}
              {isViewed && (
                <div className="flex items-center gap-2 mb-3 text-green-700 dark:text-green-400 font-medium text-sm">
                  <CheckCircle className="h-5 w-5" />
                  <span>✓ You've read this highlight</span>
                </div>
              )}
              
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span 
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border insight-type-badge ${getInsightTypeColor(curated.insightType)}`}
                      data-insight-type={curated.insightType.toLowerCase()}
                    >
                      {formatInsightType(curated.insightType)}
                    </span>
                    <div className="flex items-center space-x-1 text-xs text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <Star className="w-3 h-3" />
                      <span className={getScoreColor(curated.relevanceScore)}>
                        {curated.relevanceScore}/10
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-neutral-500 dark:text-[var(--espresso-body)]/70">
                      <span className={getScoreColor(curated.qualityScore)}>
                        Quality: {curated.qualityScore}/10
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-neutral-600 dark:text-[var(--espresso-body)] mb-2">
                    <strong>Why this matters:</strong> {curated.curatorReason}
                  </div>
                </div>
              </div>

              {actualHighlight && (
                <div className="border-l-2 border-specialized-300 dark:border-[var(--espresso-accent)]/30 pl-4 mb-3">
                  <div className="flex items-start space-x-2">
                    <Quote className="w-4 h-4 text-specialized-500 dark:text-[var(--espresso-accent)] mt-1 flex-shrink-0" />
                    <blockquote className="text-sm text-neutral-700 dark:text-[var(--espresso-body)] italic">
                      "{actualHighlight.text}"
                    </blockquote>
                  </div>
                  
                  {actualHighlight.note && (
                    <div className="mt-2 text-xs text-neutral-600 dark:text-[var(--espresso-body)]/80">
                      <strong>Note:</strong> {actualHighlight.note}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-[var(--espresso-body)]/70">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{curated.book.title}</span>
                  <span>by {curated.book.author}</span>
                </div>
                {actualHighlight?.url && (
                  <a
                    href={actualHighlight.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-specialized-600 dark:text-[var(--espresso-accent)] hover:text-specialized-800 dark:hover:text-[var(--espresso-accent)]/80"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View in Readwise</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
