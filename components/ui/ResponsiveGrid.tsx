import React from 'react';

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    wide?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  equalHeight?: boolean;
}

const getGridClasses = (columns: ResponsiveGridProps['columns']) => {
  const mobile = columns?.mobile || 1;
  const tablet = columns?.tablet || 2;
  const desktop = columns?.desktop || 3;
  const wide = columns?.wide || desktop;

  return `grid grid-cols-${mobile} sm:grid-cols-${tablet} lg:grid-cols-${desktop} xl:grid-cols-${wide}`;
};

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-2 sm:gap-3',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
  xl: 'gap-8 sm:gap-10'
};

export function ResponsiveGrid({ 
  children, 
  className = '', 
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  equalHeight = false
}: ResponsiveGridProps) {
  const gridClasses = getGridClasses(columns);
  const heightClasses = equalHeight ? 'items-stretch' : '';

  return (
    <div className={`${gridClasses} ${gapClasses[gap]} ${heightClasses} ${className}`}>
      {children}
    </div>
  );
}

export default ResponsiveGrid;

