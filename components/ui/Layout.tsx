import React, { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Layout components for consistent spacing and responsive design
 * 
 * @example
 * ```tsx
 * <Container>
 *   <Grid cols={3} gap="lg">
 *     <div>Item 1</div>
 *     <div>Item 2</div>
 *     <div>Item 3</div>
 *   </Grid>
 * </Container>
 * 
 * <Stack gap="md">
 *   <div>First item</div>
 *   <div>Second item</div>
 * </Stack>
 * 
 * <Cluster gap="sm">
 *   <Badge>Tag 1</Badge>
 *   <Badge>Tag 2</Badge>
 * </Cluster>
 * ```
 */

// Container Component
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum width */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Center the container */
  center?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      maxWidth = 'xl',
      padding = 'md',
      center = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const maxWidthClasses = {
      'sm': 'max-w-sm',
      'md': 'max-w-md',
      'lg': 'max-w-lg',
      'xl': 'max-w-xl',
      '2xl': 'max-w-2xl',
      'full': 'max-w-full'
    };

    const paddingClasses = {
      'none': '',
      'sm': 'px-sm',
      'md': 'px-md',
      'lg': 'px-lg',
      'xl': 'px-xl'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          center && 'mx-auto',
          maxWidthClasses[maxWidth],
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Container.displayName = 'Container';

// Grid Component
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns on mobile */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Number of columns on tablet */
  colsMd?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Number of columns on desktop */
  colsLg?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  /** Gap between items */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    {
      cols = 1,
      colsMd,
      colsLg,
      gap = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const gapClasses = {
      'xs': 'gap-xs',
      'sm': 'gap-sm',
      'md': 'gap-md',
      'lg': 'gap-lg',
      'xl': 'gap-xl'
    };

    const colsClasses = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
      12: 'grid-cols-12'
    };

    const colsMdClasses = colsMd ? {
      1: 'md:grid-cols-1',
      2: 'md:grid-cols-2',
      3: 'md:grid-cols-3',
      4: 'md:grid-cols-4',
      5: 'md:grid-cols-5',
      6: 'md:grid-cols-6',
      12: 'md:grid-cols-12'
    } : {};

    const colsLgClasses = colsLg ? {
      1: 'lg:grid-cols-1',
      2: 'lg:grid-cols-2',
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
      5: 'lg:grid-cols-5',
      6: 'lg:grid-cols-6',
      12: 'lg:grid-cols-12'
    } : {};

    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          colsClasses[cols],
          colsMd && colsMdClasses[colsMd],
          colsLg && colsLgClasses[colsLg],
          gapClasses[gap],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Grid.displayName = 'Grid';

// Stack Component
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between items */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Alignment of items */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justification of items */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Additional CSS classes */
  className?: string;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      gap = 'md',
      align = 'start',
      justify = 'start',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const gapClasses = {
      'xs': 'space-y-xs',
      'sm': 'space-y-sm',
      'md': 'space-y-md',
      'lg': 'space-y-lg',
      'xl': 'space-y-xl',
      '2xl': 'space-y-2xl'
    };

    const alignClasses = {
      'start': 'items-start',
      'center': 'items-center',
      'end': 'items-end',
      'stretch': 'items-stretch'
    };

    const justifyClasses = {
      'start': 'justify-start',
      'center': 'justify-center',
      'end': 'justify-end',
      'between': 'justify-between',
      'around': 'justify-around',
      'evenly': 'justify-evenly'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col',
          gapClasses[gap],
          alignClasses[align],
          justifyClasses[justify],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Stack.displayName = 'Stack';

// Cluster Component
export interface ClusterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gap between items */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Alignment of items */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Justification of items */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Wrap items to new lines */
  wrap?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Cluster = forwardRef<HTMLDivElement, ClusterProps>(
  (
    {
      gap = 'md',
      align = 'center',
      justify = 'start',
      wrap = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const gapClasses = {
      'xs': 'gap-xs',
      'sm': 'gap-sm',
      'md': 'gap-md',
      'lg': 'gap-lg',
      'xl': 'gap-xl'
    };

    const alignClasses = {
      'start': 'items-start',
      'center': 'items-center',
      'end': 'items-end',
      'stretch': 'items-stretch',
      'baseline': 'items-baseline'
    };

    const justifyClasses = {
      'start': 'justify-start',
      'center': 'justify-center',
      'end': 'justify-end',
      'between': 'justify-between',
      'around': 'justify-around',
      'evenly': 'justify-evenly'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          wrap && 'flex-wrap',
          gapClasses[gap],
          alignClasses[align],
          justifyClasses[justify],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Cluster.displayName = 'Cluster';

// Section Component
export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Background color */
  background?: 'transparent' | 'neutral' | 'foundational' | 'practical' | 'specialized';
  /** Additional CSS classes */
  className?: string;
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      padding = 'lg',
      background = 'transparent',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const paddingClasses = {
      'none': '',
      'sm': 'py-sm',
      'md': 'py-md',
      'lg': 'py-lg',
      'xl': 'py-xl',
      '2xl': 'py-2xl'
    };

    const backgroundClasses = {
      'transparent': '',
      'neutral': 'bg-neutral-50',
      'foundational': 'bg-foundational-50',
      'practical': 'bg-practical-50',
      'specialized': 'bg-specialized-50'
    };

    return (
      <section
        ref={ref}
        className={cn(
          'w-full',
          paddingClasses[padding],
          backgroundClasses[background],
          className
        )}
        {...props}
      >
        {children}
      </section>
    );
  }
);
Section.displayName = 'Section';

// Memoized exports for performance
export default {
  Container: memo(Container),
  Grid: memo(Grid),
  Stack: memo(Stack),
  Cluster: memo(Cluster),
  Section: memo(Section)
};
