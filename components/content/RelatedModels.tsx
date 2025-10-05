'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { SubModel } from '@/types/models';
import {
    ArrowRight,
    Building,
    ChevronLeft,
    ChevronRight,
    GitBranch,
    Target,
    Zap
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

interface RelatedModelsProps {
  currentModelId: string;
  relatedModels: SubModel[];
  maxDisplay?: number;
  showRelationshipType?: boolean;
}

// Mock relationship types - in a real app, this would come from the data
const getRelationshipType = (modelId: string, currentId: string) => {
  const relationships = ['builds-on', 'applies-to', 'similar-to', 'prerequisite'];
  return relationships[Math.floor(Math.random() * relationships.length)];
};

const getRelationshipIcon = (type: string) => {
  switch (type) {
    case 'builds-on':
      return <Building className="w-3 h-3" />;
    case 'applies-to':
      return <Target className="w-3 h-3" />;
    case 'similar-to':
      return <GitBranch className="w-3 h-3" />;
    case 'prerequisite':
      return <Zap className="w-3 h-3" />;
    default:
      return <ArrowRight className="w-3 h-3" />;
  }
};

const getRelationshipColor = (type: string) => {
  switch (type) {
    case 'builds-on':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'applies-to':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'similar-to':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'prerequisite':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200';
  }
};

const formatRelationshipType = (type: string) => {
  return type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export function RelatedModels({ 
  currentModelId, 
  relatedModels, 
  maxDisplay = 6,
  showRelationshipType = true 
}: RelatedModelsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const displayModels = relatedModels.slice(0, maxDisplay);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  if (displayModels.length === 0) {
    return (
      <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6 text-center">
        <GitBranch className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-neutral-600">No related models found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-neutral-800">Related Models</h3>
          <p className="text-sm text-neutral-600">
            Explore connected concepts and frameworks
          </p>
        </div>
        
        {/* Desktop scroll controls */}
        <div className="hidden md:flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={scrollLeft}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={scrollRight}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Models container */}
      <div className="relative">
        {/* Desktop: Horizontal scrolling */}
        <div 
          ref={scrollContainerRef}
          className="hidden md:flex space-x-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayModels.map((model) => {
            const relationshipType = getRelationshipType(model.id, currentModelId);
            
            return (
              <div
                key={model.id}
                className="flex-shrink-0 w-80 group"
              >
                <Link href={`/models/${model.slug}`}>
                  <div className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-200 p-4 h-full">
                    {/* Relationship type */}
                    {showRelationshipType && (
                      <div className="flex items-center space-x-2 mb-3">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getRelationshipColor(relationshipType || 'related')}`}
                        >
                          <span className="mr-1">
                            {getRelationshipIcon(relationshipType || 'related')}
                          </span>
                          {formatRelationshipType(relationshipType || 'related')}
                        </Badge>
                      </div>
                    )}

                    {/* Model info */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-neutral-800 group-hover:text-foundational-600 transition-colors line-clamp-2">
                          {model.title}
                        </h4>
                        <p className="text-sm text-neutral-600 mt-1">
                          {model.domainId}
                        </p>
                      </div>

                      <p className="text-sm text-neutral-600 line-clamp-3 leading-relaxed">
                        {model.definition}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {model.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {model.tags.length > 3 && (
                          <span className="text-xs text-neutral-500">
                            +{model.tags.length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <div className="text-xs text-neutral-500">
                          {model.sourceHighlights.length} sources
                        </div>
                        <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-foundational-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Mobile: Grid layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
          {displayModels.map((model) => {
            const relationshipType = getRelationshipType(model.id, currentModelId);
            
            return (
              <Link key={model.id} href={`/models/${model.slug}`}>
                <div className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-200 p-4 h-full">
                  {/* Relationship type */}
                  {showRelationshipType && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs mb-3 ${getRelationshipColor(relationshipType || 'related')}`}
                    >
                      <span className="mr-1">
                        {getRelationshipIcon(relationshipType || 'related')}
                      </span>
                      {formatRelationshipType(relationshipType || 'related')}
                    </Badge>
                  )}

                  {/* Model info */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-neutral-800 line-clamp-2">
                      {model.title}
                    </h4>
                    <p className="text-sm text-neutral-600 line-clamp-2">
                      {model.definition}
                    </p>
                    <div className="text-xs text-neutral-500">
                      {model.sourceHighlights.length} sources
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* View all link */}
      {relatedModels.length > maxDisplay && (
        <div className="text-center pt-4 border-t border-neutral-200">
          <Link 
            href={`/models/${currentModelId}/related`}
            className="inline-flex items-center space-x-2 text-sm text-foundational-600 hover:text-foundational-700 font-medium"
          >
            <span>View all {relatedModels.length} related models</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Breadcrumbs hint */}
      <div className="bg-foundational-50 rounded-lg p-3 border border-foundational-200">
        <div className="flex items-start space-x-2">
          <GitBranch className="w-4 h-4 text-foundational-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foundational-800 mb-1">
              Cross-Domain Connections
            </p>
            <p className="text-xs text-foundational-700">
              These models span multiple domains, showing how mental frameworks connect across different areas of knowledge.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RelatedModels;
