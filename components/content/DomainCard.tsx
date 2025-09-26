import Badge from '@/components/ui/Badge';
import { Domain } from '@/types/models';
import Link from 'next/link';

interface DomainCardProps {
  domain: Domain;
  showStats?: boolean;
  variant?: 'grid' | 'list' | 'featured';
  onClick?: (domain: Domain) => void;
}

const getTierColor = (tier: number) => {
  switch (tier) {
    case 1:
      return {
        bg: 'bg-gradient-to-br from-foundational-100 to-foundational-200',
        border: 'border-foundational-300',
        text: 'text-foundational-700',
        accent: 'bg-foundational-500'
      };
    case 2:
      return {
        bg: 'bg-gradient-to-br from-practical-100 to-practical-200',
        border: 'border-practical-300',
        text: 'text-practical-700',
        accent: 'bg-practical-500'
      };
    case 3:
      return {
        bg: 'bg-gradient-to-br from-specialized-100 to-specialized-200',
        border: 'border-specialized-300',
        text: 'text-specialized-700',
        accent: 'bg-specialized-500'
      };
    default:
      return {
        bg: 'bg-gradient-to-br from-neutral-100 to-neutral-200',
        border: 'border-neutral-300',
        text: 'text-neutral-700',
        accent: 'bg-neutral-500'
      };
  }
};

const getTierLabel = (tier: number) => {
  switch (tier) {
    case 1: return 'Foundational';
    case 2: return 'Practical';
    case 3: return 'Specialized';
    default: return 'Unknown';
  }
};

export function DomainCard({ domain, showStats = true, variant = 'grid', onClick }: DomainCardProps) {
  const tierColors = getTierColor(domain.tier);
  const isClickable = !!onClick;
  
  const content = (
    <div 
      className={`
        group relative overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg hover:-translate-y-1
        ${tierColors.bg} ${tierColors.border}
        ${variant === 'list' ? 'flex items-center p-4' : 'p-6'}
        ${variant === 'featured' ? 'min-h-[200px]' : ''}
        ${isClickable ? 'cursor-pointer' : ''}
      `}
      onClick={() => onClick?.(domain)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.(domain);
        }
      }}
    >
      {/* Progress indicator */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-200 overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${tierColors.accent}`}
          style={{ width: `${Math.min(100, (domain.subModels.length / 10) * 100)}%` }}
        />
      </div>

      <div className={variant === 'list' ? 'flex items-center w-full space-x-4' : 'space-y-4'}>
        {/* Tier Badge */}
        <div className="flex-shrink-0">
          <Badge 
            variant="outline" 
            className={`${tierColors.text} ${tierColors.border} font-medium`}
          >
            Tier {domain.tier} • {getTierLabel(domain.tier)}
          </Badge>
        </div>

        {/* Content */}
        <div className={variant === 'list' ? 'flex-1 min-w-0' : ''}>
          <div className="flex items-start justify-between mb-3">
            <h3 className={`font-bold text-lg ${tierColors.text} group-hover:text-opacity-80 transition-colors`}>
              {domain.title}
            </h3>
            {showStats && (
              <div className="flex items-center space-x-2 text-sm text-neutral-600">
                <span>{domain.subModels.length} models</span>
                <span>•</span>
                <span>{domain.totalHighlights} highlights</span>
              </div>
            )}
          </div>

          <p className="text-neutral-600 text-sm leading-relaxed mb-4">
            {domain.description}
          </p>

          {variant === 'featured' && (
            <div className="bg-white/50 rounded p-3 border border-white/20">
              <p className="text-xs text-neutral-700 font-medium">Integration Statement</p>
              <p className="text-sm text-neutral-600 mt-1 italic">
                {domain.integrationStatement}
              </p>
            </div>
          )}

          {showStats && variant !== 'list' && (
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="flex items-center space-x-4 text-sm text-neutral-600">
                <span className="flex items-center">
                  <span className="font-medium">{domain.subModels.length}</span>
                  <span className="ml-1">models</span>
                </span>
                <span className="flex items-center">
                  <span className="font-medium">{domain.totalHighlights}</span>
                  <span className="ml-1">highlights</span>
                </span>
                <span className="flex items-center">
                  <span className="font-medium">{domain.sourceBooks.length}</span>
                  <span className="ml-1">sources</span>
                </span>
              </div>
              <div className="text-xs text-neutral-500">
                Updated {new Date(domain.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300 pointer-events-none" />
    </div>
  );

  if (!isClickable) {
    return (
      <Link href={`/domains/${domain.slug}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default DomainCard;
