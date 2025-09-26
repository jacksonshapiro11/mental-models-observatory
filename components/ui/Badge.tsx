import React, { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge component for tags, categories, and status indicators
 * 
 * @example
 * ```tsx
 * <Badge variant="primary">Primary</Badge>
 * <Badge difficulty="intermediate">Intermediate</Badge>
 * <Badge variant="outline" size="sm">Small</Badge>
 * ```
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Difficulty level for mental models */
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'secondary',
      difficulty,
      size = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      'sm': 'px-xs py-px text-caption',
      'md': 'px-sm py-xs text-body-small',
      'lg': 'px-md py-sm text-body'
    };

    const variantClasses = {
      'primary': 'bg-foundational-100 text-foundational-800 border-foundational-200',
      'secondary': 'bg-neutral-100 text-neutral-700 border-neutral-200',
      'outline': 'bg-transparent text-neutral-600 border-neutral-300'
    };

    const difficultyClasses = {
      'beginner': 'bg-success-100 text-success-800 border-success-200',
      'intermediate': 'bg-warning-100 text-warning-800 border-warning-200',
      'advanced': 'bg-error-100 text-error-800 border-error-200'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium border rounded-medium',
          sizeClasses[size],
          difficulty ? difficultyClasses[difficulty] : variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export default memo(Badge);
