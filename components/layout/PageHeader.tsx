import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
    ArrowLeft,
    Bookmark,
    BookOpen,
    ChevronRight,
    Clock,
    Share2,
    TrendingUp,
    Users
} from 'lucide-react';
import Link from 'next/link';
import React from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
  tier?: number;
  current?: boolean;
}

interface HeaderStats {
  totalModels?: number;
  totalHighlights?: number;
  totalSources?: number;
  lastUpdated?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tier?: number;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  backgroundImage?: string;
  actions?: React.ReactNode[];
  breadcrumbs?: BreadcrumbItem[];
  stats?: HeaderStats;
  backLink?: {
    href: string;
    label: string;
  };
}

const getTierColors = (tier?: number) => {
  switch (tier) {
    case 1:
      return {
        bg: 'bg-gradient-to-br from-foundational-50 via-foundational-100 to-foundational-200',
        text: 'text-foundational-800',
        accent: 'text-foundational-600'
      };
    case 2:
      return {
        bg: 'bg-gradient-to-br from-practical-50 via-practical-100 to-practical-200',
        text: 'text-practical-800',
        accent: 'text-practical-600'
      };
    case 3:
      return {
        bg: 'bg-gradient-to-br from-specialized-50 via-specialized-100 to-specialized-200',
        text: 'text-specialized-800',
        accent: 'text-specialized-600'
      };
    default:
      return {
        bg: 'bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200',
        text: 'text-neutral-800',
        accent: 'text-neutral-600'
      };
  }
};

const getDifficultyColor = (difficulty?: string) => {
  switch (difficulty) {
    case 'beginner':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-[#3d4a2a] dark:text-[#a8c97f] dark:border-[#5a6a3f]';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-[var(--espresso-accent)]/20 dark:text-[var(--espresso-accent)] dark:border-[var(--espresso-accent)]/40';
    case 'advanced':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-[#5a2a2a] dark:text-[#d4a3a3] dark:border-[#7a3a3a]';
    default:
      return 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-[var(--espresso-surface)]/40 dark:text-[var(--espresso-body)] dark:border-[var(--espresso-accent)]/20';
  }
};

export function PageHeader({
  title,
  subtitle,
  description,
  backgroundImage,
  actions = [],
  breadcrumbs = [],
  stats,
  backLink
}: PageHeaderProps) {
  const tierColors = getTierColors(stats?.tier);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description || subtitle || '',
          url: window.location.href
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        // You could show a toast notification here
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  return (
    <header className={`relative overflow-hidden ${tierColors.bg}`}>
      {/* Background image overlay */}
      {backgroundImage && (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Back link */}
          {backLink && (
            <div className="mb-6">
              <Link 
                href={backLink.href}
                className="inline-flex items-center space-x-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{backLink.label}</span>
              </Link>
            </div>
          )}

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <nav className="mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((item, index) => (
                  <li key={index} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight className="w-3 h-3 text-neutral-400 mx-2" />
                    )}
                    {item.current ? (
                      <span className={`font-medium ${tierColors.text}`}>
                        {item.label}
                      </span>
                    ) : (
                      <Link 
                        href={item.href}
                        className={`hover:${tierColors.accent} transition-colors ${
                          item.tier 
                            ? getTierColors(item.tier).accent 
                            : 'text-neutral-600'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                    {item.tier && (
                      <Badge 
                        variant="outline" 
                        className="ml-2 text-xs"
                      >
                        T{item.tier}
                      </Badge>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
            {/* Title and description */}
            <div className="flex-1 max-w-4xl">
              {/* Tier and difficulty badges */}
              <div className="flex items-center space-x-2 mb-4">
                {stats?.tier && (
                  <Badge 
                    variant="outline" 
                    className={`${tierColors.text} border-current`}
                  >
                    Tier {stats.tier}
                  </Badge>
                )}
                {stats?.difficulty && (
                  <Badge 
                    variant="outline" 
                    className={getDifficultyColor(stats.difficulty)}
                  >
                    {stats.difficulty}
                  </Badge>
                )}
              </div>

              {/* Main title */}
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight ${tierColors.text} mb-4`}>
                {title}
              </h1>

              {/* Subtitle */}
              {subtitle && (
                <p className={`text-xl sm:text-2xl ${tierColors.accent} mb-6 font-medium`}>
                  {subtitle}
                </p>
              )}

              {/* Description */}
              {description && (
                <p className="text-lg text-neutral-700 leading-relaxed max-w-3xl mb-8">
                  {description}
                </p>
              )}

              {/* Statistics */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8">
                  {stats.totalModels !== undefined && (
                    <div className="text-center sm:text-left">
                      <div className={`text-2xl sm:text-3xl font-bold ${tierColors.text}`}>
                        {stats.totalModels}
                      </div>
                      <div className="text-sm text-neutral-600 flex items-center justify-center sm:justify-start">
                        <BookOpen className="w-3 h-3 mr-1" />
                        Mental Models
                      </div>
                    </div>
                  )}

                  {stats.totalHighlights !== undefined && (
                    <div className="text-center sm:text-left">
                      <div className={`text-2xl sm:text-3xl font-bold ${tierColors.text}`}>
                        {stats.totalHighlights}
                      </div>
                      <div className="text-sm text-neutral-600 flex items-center justify-center sm:justify-start">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Highlights
                      </div>
                    </div>
                  )}

                  {stats.totalSources !== undefined && (
                    <div className="text-center sm:text-left">
                      <div className={`text-2xl sm:text-3xl font-bold ${tierColors.text}`}>
                        {stats.totalSources}
                      </div>
                      <div className="text-sm text-neutral-600 flex items-center justify-center sm:justify-start">
                        <Users className="w-3 h-3 mr-1" />
                        Sources
                      </div>
                    </div>
                  )}

                  {stats.lastUpdated && (
                    <div className="text-center sm:text-left">
                      <div className={`text-sm font-medium ${tierColors.text}`}>
                        Updated
                      </div>
                      <div className="text-sm text-neutral-600 flex items-center justify-center sm:justify-start">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(stats.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 mt-6 lg:mt-0 lg:ml-8">
              {/* Default actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="bg-white/80 backdrop-blur-sm"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-white/80 backdrop-blur-sm"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Bookmark
              </Button>

              {/* Custom actions */}
              {actions.map((action, index) => (
                <div key={index}>{action}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
      </div>
    </header>
  );
}

export default PageHeader;
