import React, { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button component with multiple variants, sizes, and states
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Click me
 * </Button>
 * 
 * <Button variant="outline" size="sm" leftIcon={<Icon />} loading>
 *   Loading...
 * </Button>
 * ```
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Icon to display before the button text */
  leftIcon?: React.ReactNode;
  /** Icon to display after the button text */
  rightIcon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      // Base styles
      'inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      'active:scale-[0.98]',
      
      // Size variants
      size === 'sm' && 'h-8 px-3 text-sm rounded-medium',
      size === 'md' && 'h-10 px-4 text-body rounded-medium',
      size === 'lg' && 'h-12 px-6 text-body-large rounded-medium',
      
      // Variant styles
      variant === 'primary' && [
        'bg-foundational-600 text-white hover:bg-foundational-700',
        'focus-visible:ring-foundational-500',
        'active:bg-foundational-800'
      ],
      variant === 'secondary' && [
        'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
        'focus-visible:ring-neutral-500',
        'active:bg-neutral-300'
      ],
      variant === 'outline' && [
        'border border-neutral-300 bg-transparent text-neutral-700',
        'hover:bg-neutral-50 hover:border-neutral-400',
        'focus-visible:ring-neutral-500',
        'active:bg-neutral-100'
      ],
      variant === 'ghost' && [
        'bg-transparent text-neutral-700 hover:bg-neutral-100',
        'focus-visible:ring-neutral-500',
        'active:bg-neutral-200'
      ],
      
      className
    );

    return (
      <button
        ref={ref}
        className={baseClasses}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className={cn(
              'animate-spin -ml-1 mr-2',
              size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
            )}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        
        {!loading && leftIcon && (
          <span className={cn(
            size === 'sm' ? 'mr-1.5' : size === 'md' ? 'mr-2' : 'mr-2.5'
          )}>
            {leftIcon}
          </span>
        )}
        
        <span className={loading ? 'opacity-0' : 'opacity-100'}>
          {children}
        </span>
        
        {!loading && rightIcon && (
          <span className={cn(
            size === 'sm' ? 'ml-1.5' : size === 'md' ? 'ml-2' : 'ml-2.5'
          )}>
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default memo(Button);
