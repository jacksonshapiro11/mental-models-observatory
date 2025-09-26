import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { BookReference } from '@/types/models';
import {
    BookOpen,
    ExternalLink,
    Hash,
    Star,
    TrendingUp
} from 'lucide-react';

interface SourceAttributionProps {
  book: BookReference;
  highlightCount?: number;
  showCover?: boolean;
  showStats?: boolean;
  variant?: 'full' | 'compact' | 'minimal';
}

const renderRating = (rating: number) => {
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < rating 
              ? 'text-yellow-400 fill-current' 
              : 'text-neutral-300'
          }`}
        />
      ))}
    </div>
  );
};

export function SourceAttribution({
  book,
  highlightCount,
  showCover = true,
  showStats = true,
  variant = 'full'
}: SourceAttributionProps) {
  const effectiveHighlightCount = highlightCount || book.relevantHighlights;

  if (variant === 'minimal') {
    return (
      <div className="inline-flex items-center space-x-2 text-sm text-neutral-600">
        <BookOpen className="w-3 h-3" />
        <span>
          <em>{book.title}</em> by {book.author}
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        {showCover && (
          <div className="flex-shrink-0">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                className="w-10 h-14 object-cover rounded border border-neutral-200"
              />
            ) : (
              <div className="w-10 h-14 bg-neutral-200 rounded border border-neutral-300 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-neutral-400" />
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-neutral-800 line-clamp-1">
            {book.title}
          </h4>
          <p className="text-sm text-neutral-600 line-clamp-1">
            by {book.author}
          </p>
          {showStats && (
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="outline" className="text-xs">
                {book.category}
              </Badge>
              <span className="text-xs text-neutral-500">
                {effectiveHighlightCount} highlights
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-foundational-600" />
          <span className="text-sm font-medium text-neutral-700">Source Attribution</span>
        </div>
      </div>

      {/* Main content */}
      <div className="p-4">
        <div className="flex space-x-4">
          {/* Book cover */}
          {showCover && (
            <div className="flex-shrink-0">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={`Cover of ${book.title}`}
                  className="w-20 h-28 object-cover rounded border border-neutral-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-28 bg-neutral-200 rounded border border-neutral-300 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-neutral-400" />
                </div>
              )}
            </div>
          )}

          {/* Book information */}
          <div className="flex-1 min-w-0">
            <div className="space-y-3">
              {/* Title and author */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 leading-tight">
                  {book.title}
                </h3>
                <p className="text-neutral-600 mt-1">
                  by <span className="font-medium">{book.author}</span>
                </p>
              </div>

              {/* Category and ID */}
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="bg-foundational-50 text-foundational-700 border-foundational-200">
                  {book.category}
                </Badge>
                <div className="flex items-center text-xs text-neutral-500">
                  <Hash className="w-3 h-3 mr-1" />
                  ID: {book.id}
                </div>
              </div>

              {/* Statistics */}
              {showStats && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-practical-600" />
                    <div>
                      <div className="text-sm font-medium text-neutral-800">
                        {effectiveHighlightCount}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Mental Models Highlights
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-specialized-600" />
                    <div>
                      <div className="text-sm font-medium text-neutral-800">
                        {book.totalHighlights}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Total Highlights
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Relevance percentage */}
              {showStats && (
                <div className="pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-600">Relevance to Mental Models</span>
                    <span className="text-sm font-medium text-neutral-800">
                      {Math.round((effectiveHighlightCount / book.totalHighlights) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-foundational-500 to-practical-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (effectiveHighlightCount / book.totalHighlights) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to all highlights from this book
                window.location.href = `/books/${book.id}/highlights`;
              }}
            >
              View All Highlights
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Personal rating */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-neutral-500">Rating:</span>
              {renderRating(4)} {/* This would come from user preferences/ratings */}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Link to external source
                window.open('#', '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SourceAttribution;
