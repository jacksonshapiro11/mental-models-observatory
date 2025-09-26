import React, { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card component with multiple variants and interactive states
 * 
 * @example
 * ```tsx
 * <Card variant="elevated" padding="lg">
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </Card>
 * 
 * <Card variant="outlined" hover clickable onClick={handleClick}>
 *   Clickable card
 * </Card>
 * ```
 */

// Base card props
interface BaseCardProps {
  /** Visual style variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Padding size */
  padding?: 'sm' | 'md' | 'lg';
  /** Enable hover effects */
  hover?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Non-clickable card props
export interface CardProps extends BaseCardProps, React.HTMLAttributes<HTMLDivElement> {
  /** Make card clickable */
  clickable?: false;
  /** Click handler for clickable cards */
  onClick?: never;
}

// Clickable card props
export interface ClickableCardProps extends BaseCardProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Make card clickable */
  clickable: true;
  /** Click handler for clickable cards */
  onClick?: () => void;
}

// Union type for all card props
export type CardComponentProps = CardProps | ClickableCardProps;

const Card = forwardRef<HTMLDivElement, CardComponentProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hover = false,
      clickable = false,
      onClick,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      // Base styles
      'bg-neutral-0 rounded-large transition-all duration-200',
      'focus-visible:outline-none',
      
      // Padding variants
      padding === 'sm' && 'p-sm',
      padding === 'md' && 'p-md',
      padding === 'lg' && 'p-lg',
      
      // Variant styles
      variant === 'default' && [
        'border border-neutral-200',
        'hover:border-neutral-300'
      ],
      variant === 'elevated' && [
        'shadow-medium border border-neutral-100',
        'hover:shadow-strong hover:border-neutral-200'
      ],
      variant === 'outlined' && [
        'border-2 border-neutral-200',
        'hover:border-neutral-300'
      ],
      
      // Interactive states
      hover && [
        'hover:shadow-gentle hover:-translate-y-0.5',
        'active:translate-y-0 active:shadow-subtle'
      ],
      
      clickable && [
        'cursor-pointer text-left',
        'focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
        'active:scale-[0.98]'
      ],
      
      className
    );

    if (clickable) {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          className={baseClasses}
          onClick={onClick}
          type="button"
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      );
    }

    return (
      <div
        ref={ref}
        className={baseClasses}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default memo(Card);
