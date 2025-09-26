'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { BookReference, SourceHighlight } from '@/types/models';
import {
    BookOpen,
    Calendar,
    Copy,
    ExternalLink,
    MessageSquare,
    Quote,
    Share2
} from 'lucide-react';
import { useState } from 'react';

interface HighlightBlockProps {
  highlight: SourceHighlight;
  showBook?: boolean;
  showRelevanceScore?: boolean;
  showPersonalNote?: boolean;
  variant?: 'card' | 'quote' | 'inline';
  onBookClick?: (book: BookReference) => void;
}

const getRelevanceColor = (score: number) => {
  if (score >= 8) return 'text-green-600 bg-green-100';
  if (score >= 6) return 'text-yellow-600 bg-yellow-100';
  if (score >= 4) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
};

export function HighlightBlock({
  highlight,
  showBook = true,
  showRelevanceScore = false,
  showPersonalNote = true,
  variant = 'card',
  onBookClick
}: HighlightBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = async () => {
    try {
      const textToCopy = `"${highlight.text}"${highlight.personalNote ? `\n\nPersonal Note: ${highlight.personalNote}` : ''}\n\n— ${highlight.book.author}, ${highlight.book.title}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Quote from ${highlight.book.title}`,
          text: highlight.text,
          url: window.location.href
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopyToClipboard();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center space-x-2 text-sm">
        <Quote className="w-3 h-3 text-neutral-400" />
        <span className="italic text-neutral-700">"{highlight.text}"</span>
        {showBook && (
          <span className="text-neutral-500">
            — {highlight.book.author}
          </span>
        )}
      </span>
    );
  }

  if (variant === 'quote') {
    return (
      <blockquote className="border-l-4 border-foundational-300 pl-4 py-2 my-4 bg-foundational-25">
        <div className="space-y-3">
          <p className="text-lg text-neutral-800 font-serif leading-relaxed italic">
            "{highlight.text}"
          </p>
          
          {showBook && (
            <footer className="flex items-center justify-between">
              <cite className="text-sm text-neutral-600 not-italic">
                — {highlight.book.author}, <em>{highlight.book.title}</em>
              </cite>
              {showRelevanceScore && (
                <Badge className={`text-xs ${getRelevanceColor(highlight.relevanceScore)}`}>
                  Relevance: {highlight.relevanceScore}/10
                </Badge>
              )}
            </footer>
          )}

          {showPersonalNote && highlight.personalNote && (
            <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 mt-3">
              <div className="flex items-start space-x-2">
                <MessageSquare className="w-4 h-4 text-accent-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-accent-800 mb-1">Personal Note</p>
                  <p className="text-sm text-accent-700">{highlight.personalNote}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </blockquote>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header with actions */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-100">
        <div className="flex items-center space-x-2">
          <Quote className="w-4 h-4 text-foundational-600" />
          <span className="text-sm font-medium text-neutral-700">Source Highlight</span>
          {showRelevanceScore && (
            <Badge className={`text-xs ${getRelevanceColor(highlight.relevanceScore)}`}>
              Relevance: {highlight.relevanceScore}/10
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyToClipboard}
            className="h-8 w-8 p-0"
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="h-8 w-8 p-0"
            title="Share highlight"
          >
            <Share2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4">
        <blockquote className="text-lg text-neutral-800 font-serif leading-relaxed mb-4">
          "{highlight.text}"
        </blockquote>

        {/* Personal note */}
        {showPersonalNote && highlight.personalNote && (
          <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <MessageSquare className="w-4 h-4 text-accent-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent-800 mb-1">Personal Note</p>
                <p className="text-sm text-accent-700">{highlight.personalNote}</p>
              </div>
            </div>
          </div>
        )}

        {/* Context */}
        {highlight.context && (
          <div className="bg-neutral-50 rounded p-3 mb-4">
            <p className="text-sm text-neutral-600">
              <strong>Context:</strong> {highlight.context}
            </p>
          </div>
        )}
      </div>

      {/* Book attribution */}
      {showBook && (
        <div className="bg-neutral-50 border-t border-neutral-100 p-4">
          <div 
            className={`flex items-center space-x-3 ${onBookClick ? 'cursor-pointer hover:bg-neutral-100 rounded p-2 -m-2 transition-colors' : ''}`}
            onClick={() => onBookClick?.(highlight.book)}
          >
            {/* Book cover */}
            <div className="flex-shrink-0">
              {highlight.book.coverUrl ? (
                <img
                  src={highlight.book.coverUrl}
                  alt={`Cover of ${highlight.book.title}`}
                  className="w-12 h-16 object-cover rounded border border-neutral-200"
                />
              ) : (
                <div className="w-12 h-16 bg-neutral-200 rounded border border-neutral-300 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-neutral-400" />
                </div>
              )}
            </div>

            {/* Book info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-neutral-800 line-clamp-1">
                {highlight.book.title}
              </h4>
              <p className="text-sm text-neutral-600 line-clamp-1">
                by {highlight.book.author}
              </p>
              <div className="flex items-center space-x-3 mt-1">
                <Badge variant="outline" className="text-xs">
                  {highlight.book.category}
                </Badge>
                <div className="flex items-center text-xs text-neutral-500">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(highlight.highlightedAt)}
                </div>
              </div>
            </div>

            {/* Book stats */}
            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-medium text-neutral-800">
                {highlight.book.relevantHighlights}
              </div>
              <div className="text-xs text-neutral-500">
                relevant highlights
              </div>
              {onBookClick && (
                <ExternalLink className="w-3 h-3 text-neutral-400 mt-1 ml-auto" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Copy feedback */}
      {copied && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg">
          Copied!
        </div>
      )}
    </div>
  );
}

export default HighlightBlock;
