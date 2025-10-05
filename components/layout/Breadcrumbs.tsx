import Badge from '@/components/ui/Badge';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href: string;
  tier?: number;
  current?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showTierColors?: boolean;
  maxItems?: number;
  showHome?: boolean;
}

const getTierColors = (tier: number) => {
  switch (tier) {
    case 1:
      return 'text-foundational-600 hover:text-foundational-700';
    case 2:
      return 'text-practical-600 hover:text-practical-700';
    case 3:
      return 'text-specialized-600 hover:text-specialized-700';
    default:
      return 'text-neutral-600 hover:text-neutral-800';
  }
};

const getTierLabel = (tier: number) => {
  switch (tier) {
    case 1: return 'Foundational';
    case 2: return 'Practical';
    case 3: return 'Specialized';
    default: return '';
  }
};

export function Breadcrumbs({ 
  items, 
  showTierColors = true, 
  maxItems = 5,
  showHome = true 
}: BreadcrumbsProps) {
  // Add home item if requested and not already present
  let breadcrumbItems = [...items];
  if (showHome && (items.length === 0 || items[0]?.href !== '/')) {
    breadcrumbItems = [
      { label: 'Home', href: '/', current: false },
      ...items
    ];
  }

  // Truncate items if exceeding maxItems
  if (breadcrumbItems.length > maxItems) {
    const firstItems = breadcrumbItems.slice(0, 1);
    const lastItems = breadcrumbItems.slice(-(maxItems - 2));
    const truncatedItems = [
      ...firstItems,
      { label: '...', href: '#', current: false },
      ...lastItems
    ];
    breadcrumbItems = truncatedItems;
  }

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm">
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {/* Separator */}
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-neutral-400 mx-2 flex-shrink-0" />
            )}

            {/* Breadcrumb item */}
            <div className="flex items-center space-x-2 min-w-0">
              {item.current ? (
                <span className="font-medium text-neutral-800 truncate">
                  {/* Home icon for first item */}
                  {index === 0 && showHome && item.href === '/' && (
                    <Home className="w-3 h-3 mr-1 inline" />
                  )}
                  {item.label}
                </span>
              ) : item.label === '...' ? (
                <span className="text-neutral-500">...</span>
              ) : (
                <Link 
                  href={item.href}
                  className={`transition-colors truncate hover:underline ${
                    showTierColors && item.tier 
                      ? getTierColors(item.tier)
                      : 'text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  {/* Home icon for first item */}
                  {index === 0 && showHome && item.href === '/' && (
                    <Home className="w-3 h-3 mr-1 inline" />
                  )}
                  {item.label}
                </Link>
              )}

              {/* Tier badge */}
              {item.tier && showTierColors && (
                <Badge 
                  variant="outline" 
                  className={`text-xs flex-shrink-0 ${
                    item.tier === 1 ? 'bg-foundational-50 text-foundational-700 border-foundational-200' :
                    item.tier === 2 ? 'bg-practical-50 text-practical-700 border-practical-200' :
                    'bg-specialized-50 text-specialized-700 border-specialized-200'
                  }`}
                  title={getTierLabel(item.tier)}
                >
                  T{item.tier}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
