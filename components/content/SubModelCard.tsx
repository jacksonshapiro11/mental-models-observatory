'use client';

import Badge from '@/components/ui/Badge';
import { SubModel } from '@/types/models';
import { BookOpen, ChevronDown, ChevronUp, Star, Tag } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

interface SubModelCardProps {
  subModel: SubModel;
  showDomain?: boolean;
  compact?: boolean;
  highlightCount?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'advanced':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-neutral-100 text-neutral-800 border-neutral-200';
  }
};

const renderStars = (value: number, max: number = 10) => {
  const filledStars = Math.floor((value / max) * 5);
  const partialStar = ((value / max) * 5) % 1;
  
  return (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < filledStars
              ? 'text-yellow-400 fill-current'
              : i === filledStars && partialStar > 0
              ? 'text-yellow-400 fill-current opacity-50'
              : 'text-neutral-300'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-neutral-600">
        {value}/{max}
      </span>
    </div>
  );
};

export function SubModelCard({ 
  subModel, 
  showDomain = false, 
  compact = false,
  highlightCount,
  difficulty 
}: SubModelCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const effectiveDifficulty = difficulty || subModel.difficulty;
  const effectiveHighlightCount = highlightCount || subModel.sourceHighlights.length;

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <Link href={`/models/${subModel.slug}`} className="block">
      <div className="group bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-200 overflow-hidden">
        {/* Header */}
        <div className={`p-4 ${compact ? 'pb-2' : 'pb-4'}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-neutral-800 group-hover:text-foundational-600 transition-colors line-clamp-2">
                {subModel.title}
              </h3>
              {showDomain && (
                <p className="text-sm text-neutral-500 mt-1">
                  Domain: {subModel.domainId}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
              <Badge 
                variant="outline" 
                className={getDifficultyColor(effectiveDifficulty)}
              >
                {effectiveDifficulty}
              </Badge>
              {!compact && (
                <button
                  onClick={toggleExpanded}
                  className="p-1 rounded hover:bg-neutral-100 transition-colors"
                  aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center space-x-4 text-sm text-neutral-600 mb-3">
            <div className="flex items-center">
              <BookOpen className="w-3 h-3 mr-1" />
              <span>{effectiveHighlightCount} sources</span>
            </div>
            <div className="flex items-center">
              <Tag className="w-3 h-3 mr-1" />
              <span>{subModel.tags.length} tags</span>
            </div>
            {!compact && (
              <div className="flex items-center">
                <span className="text-xs font-medium mr-1">Value:</span>
                {renderStars(subModel.practicalValue)}
              </div>
            )}
          </div>

          {/* Definition preview */}
          <p className={`text-neutral-600 text-sm leading-relaxed ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
            {subModel.definition}
          </p>
        </div>

        {/* Expandable content */}
        {isExpanded && !compact && (
          <div className="px-4 pb-4 border-t border-neutral-100 bg-neutral-25">
            <div className="pt-4">
              {/* Key Applications */}
              {subModel.keyApplications.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-neutral-800 mb-2">Key Applications</h4>
                  <ul className="space-y-1">
                    {subModel.keyApplications.slice(0, 3).map((application, index) => (
                      <li key={index} className="text-sm text-neutral-600 flex items-start">
                        <span className="w-1 h-1 bg-neutral-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {application}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Examples preview */}
              {subModel.examples.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-neutral-800 mb-2">Example</h4>
                  <div className="bg-white rounded p-3 border border-neutral-200">
                    <h5 className="text-sm font-medium text-neutral-800 mb-1">
                      {subModel.examples[0]?.title}
                    </h5>
                    <p className="text-xs text-neutral-600">
                      {subModel.examples[0]?.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {!compact && subModel.tags.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-1">
              {subModel.tags.slice(0, 4).map((tag) => (
                <Badge 
                  key={tag} 
                  variant="secondary" 
                  className="text-xs"
                >
                  {tag}
                </Badge>
              ))}
              {subModel.tags.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{subModel.tags.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Related models hint */}
        {!compact && subModel.relatedSubModels.length > 0 && (
          <div className="px-4 pb-4 pt-2 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Related to {subModel.relatedSubModels.length} other model{subModel.relatedSubModels.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

export default SubModelCard;
