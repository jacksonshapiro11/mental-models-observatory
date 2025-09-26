'use client';

import { ExternalLink, Loader2, Quote, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'foundational_concept': return 'bg-blue-100 text-blue-800';
      case 'mechanism_insight': return 'bg-green-100 text-green-800';
      case 'practical_application': return 'bg-orange-100 text-orange-800';
      case 'philosophical_insight': return 'bg-purple-100 text-purple-800';
      case 'empirical_evidence': return 'bg-yellow-100 text-yellow-800';
      case 'design_principles': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 9.0) return 'text-green-600';
    if (score >= 8.0) return 'text-yellow-600';
    return 'text-gray-600';
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
          
          return (
            <div key={curated.readwiseId} className="bg-white rounded-lg p-4 border border-specialized-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInsightTypeColor(curated.insightType)}`}>
                      {curated.insightType.replace('_', ' ')}
                    </span>
                    <div className="flex items-center space-x-1 text-xs text-neutral-500">
                      <Star className="w-3 h-3" />
                      <span className={getScoreColor(curated.relevanceScore)}>
                        {curated.relevanceScore}/10
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-neutral-500">
                      <span className={getScoreColor(curated.qualityScore)}>
                        Quality: {curated.qualityScore}/10
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-neutral-600 mb-2">
                    <strong>Why this matters:</strong> {curated.curatorReason}
                  </div>
                </div>
              </div>

              {actualHighlight && (
                <div className="border-l-2 border-specialized-300 pl-4 mb-3">
                  <div className="flex items-start space-x-2">
                    <Quote className="w-4 h-4 text-specialized-500 mt-1 flex-shrink-0" />
                    <blockquote className="text-sm text-neutral-700 italic">
                      "{actualHighlight.text}"
                    </blockquote>
                  </div>
                  
                  {actualHighlight.note && (
                    <div className="mt-2 text-xs text-neutral-600">
                      <strong>Note:</strong> {actualHighlight.note}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{curated.book.title}</span>
                  <span>by {curated.book.author}</span>
                </div>
                {actualHighlight?.url && (
                  <a
                    href={actualHighlight.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-specialized-600 hover:text-specialized-800"
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
