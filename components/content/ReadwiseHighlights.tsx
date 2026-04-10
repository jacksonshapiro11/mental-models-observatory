'use client';

import { useEffect, useState } from 'react';

interface CuratedHighlight {
  readwiseId: number;
  book: { title: string; author: string };
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
  book: { id: number; title: string; author: string; cover_image_url?: string };
  created_at: string;
  updated_at: string;
  url?: string;
}

interface ReadwiseHighlightsProps {
  modelSlug: string;
  /** How many highlights get the full "featured" treatment */
  featuredCount?: number;
}

const FEATURED_DEFAULT = 3;

function formatInsightType(type: string): string {
  if (!type) return 'Insight';
  return type
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => {
      if (w.toLowerCase() === 'vs' || w.toLowerCase() === 'vs.') return w.toLowerCase();
      if (w.toUpperCase() === w && w.length <= 3) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Trim a quote to ~2 clean sentences. Prefers sentence boundaries. */
function extractKeyLine(text: string, maxLen = 220): string {
  if (text.length <= maxLen) return text;

  // Try to break on sentence boundaries within the limit
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    let result = '';
    for (const s of sentences) {
      if ((result + s).length > maxLen) break;
      result += s;
    }
    if (result.length > 60) return result.trim();
  }

  // Fallback: break on last space before limit
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace > 140 ? lastSpace : maxLen).trim() + '…';
}

export default function ReadwiseHighlights({
  modelSlug,
  featuredCount = FEATURED_DEFAULT,
}: ReadwiseHighlightsProps) {
  const [highlights, setHighlights] = useState<{
    curatedHighlights: CuratedHighlight[];
    actualHighlights: ReadwiseHighlight[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/readwise/highlights/${modelSlug}`);
        if (!res.ok) throw new Error(`${res.status}`);
        setHighlights(await res.json());
      } catch (err) {
        console.error('Highlights fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [modelSlug]);

  const toggleQuote = (id: number) => {
    setExpandedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // --- Loading / empty states ---

  if (loading) {
    return (
      <div className="font-mono text-[10px] text-[#999] py-2">
        Loading sources…
      </div>
    );
  }

  if (!highlights || highlights.curatedHighlights.length === 0) {
    return (
      <p className="text-[11px] text-[#888] italic">
        Sources for this model will be added as the knowledge base grows.
      </p>
    );
  }

  // --- Sort by relevance, split into featured vs. rest ---
  const sorted = [...highlights.curatedHighlights].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );
  const featured = sorted.slice(0, featuredCount);
  const remaining = sorted.slice(featuredCount);

  return (
    <div>
      {/* ── Featured highlights ── */}
      <div className="space-y-4">
        {featured.map((curated, i) => {
          const actual = highlights.actualHighlights.find(
            h => h.id === curated.readwiseId
          );
          const quoteExpanded = expandedQuotes.has(curated.readwiseId);

          return (
            <div key={curated.readwiseId} className="border-l-2 border-ct-yellow pl-3">
              {/* Lead: insight type + the curator's synthesis */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ct-pink shrink-0">
                  {formatInsightType(curated.insightType)}
                </span>
                <span className="font-mono text-[9px] text-[#ccc]">
                  {curated.relevanceScore.toFixed(1)}
                </span>
              </div>

              {/* The insight — curator reason is the headline */}
              <p className="text-[13px] text-[#333] leading-[1.55] mb-1.5">
                {curated.curatorReason}
              </p>

              {/* Expandable proof quote */}
              {actual && (
                <div className="mb-1.5">
                  <button
                    onClick={() => toggleQuote(curated.readwiseId)}
                    className="font-mono text-[10px] text-[#999] hover:text-ct-pink transition-colors flex items-center gap-1"
                  >
                    <span className="text-ct-yellow">{quoteExpanded ? '▾' : '▸'}</span>
                    {quoteExpanded ? 'Hide passage' : 'Read the passage'}
                  </button>

                  {quoteExpanded && (
                    <blockquote className="mt-1.5 pl-3 border-l border-[#e8e8e4] text-[12px] text-[#666] leading-[1.65] font-serif italic">
                      &ldquo;{actual.text}&rdquo;
                    </blockquote>
                  )}
                </div>
              )}

              {/* Source line */}
              <div className="font-mono text-[10px] text-[#aaa] flex items-center gap-1.5 flex-wrap">
                <span>{curated.book.title}</span>
                <span className="text-[#ddd]">/</span>
                <span>{curated.book.author}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Collapsed remaining sources ── */}
      {remaining.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#eee]">
          <button
            onClick={() => setShowAll(!showAll)}
            className="font-mono text-[10px] text-[#999] hover:text-ct-pink transition-colors flex items-center gap-1 mb-2"
          >
            <span className="text-ct-yellow">{showAll ? '▾' : '▸'}</span>
            {showAll
              ? 'Collapse'
              : `${remaining.length} more source${remaining.length === 1 ? '' : 's'}`}
          </button>

          {showAll && (
            <div className="space-y-2">
              {remaining.map(curated => (
                <div
                  key={curated.readwiseId}
                  className="pl-3 border-l border-[#e8e8e4]"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-ct-pink shrink-0">
                      {formatInsightType(curated.insightType)}
                    </span>
                    <span className="text-[12px] text-[#555] leading-[1.5]">
                      {curated.curatorReason}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-[#bbb] mt-0.5">
                    {curated.book.title} / {curated.book.author}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
