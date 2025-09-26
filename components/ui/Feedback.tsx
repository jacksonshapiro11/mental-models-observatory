import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import React, { forwardRef, memo } from 'react';

/**
 * Feedback components for user interaction and status communication
 * 
 * @example
 * ```tsx
 * <LoadingSpinner size="lg" />
 * 
 * <Alert type="success" title="Success!" onClose={handleClose}>
 *   Your changes have been saved.
 * </Alert>
 * 
 * <Badge variant="primary" difficulty="intermediate">
 *   Intermediate
 * </Badge>
 * ```
 */

// LoadingSpinner Component
export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Spinner color */
  color?: 'neutral' | 'foundational' | 'practical' | 'specialized';
  /** Additional CSS classes */
  className?: string;
}

export const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (
    {
      size = 'md',
      color = 'foundational',
      className,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      'sm': 'h-4 w-4',
      'md': 'h-6 w-6',
      'lg': 'h-8 w-8',
      'xl': 'h-12 w-12'
    };

    const colorClasses = {
      'neutral': 'border-neutral-300 border-t-neutral-600',
      'foundational': 'border-foundational-300 border-t-foundational-600',
      'practical': 'border-practical-300 border-t-practical-600',
      'specialized': 'border-specialized-300 border-t-specialized-600'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'animate-spin rounded-full border-2',
          sizeClasses[size],
          colorClasses[color],
          className
        )}
        role="status"
        aria-label="Loading"
        {...props}
      />
    );
  }
);
LoadingSpinner.displayName = 'LoadingSpinner';

// Alert Component
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alert type */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Alert title */
  title?: string;
  /** Show close button */
  closable?: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      type = 'info',
      title,
      closable = false,
      onClose,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const typeConfig = {
      info: {
        icon: Info,
        classes: 'bg-info-50 border-info-200 text-info-800',
        iconClasses: 'text-info-600'
      },
      success: {
        icon: CheckCircle,
        classes: 'bg-success-50 border-success-200 text-success-800',
        iconClasses: 'text-success-600'
      },
      warning: {
        icon: AlertCircle,
        classes: 'bg-warning-50 border-warning-200 text-warning-800',
        iconClasses: 'text-warning-600'
      },
      error: {
        icon: XCircle,
        classes: 'bg-error-50 border-error-200 text-error-800',
        iconClasses: 'text-error-600'
      }
    };

    const config = typeConfig[type];
    const Icon = config.icon;

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-md p-md border rounded-medium',
          config.classes,
          className
        )}
        role="alert"
        aria-live="polite"
        {...props}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconClasses)} />
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-body font-medium mb-xs">
              {title}
            </h4>
          )}
          <div className="text-body-small">
            {children}
          </div>
        </div>
        
        {closable && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-xs rounded-small hover:bg-black/5 transition-colors"
            aria-label="Close alert"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

// Badge Component
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

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
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

// Progress Component
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  color?: 'neutral' | 'foundational' | 'practical' | 'specialized' | 'success' | 'warning' | 'error';
  /** Show percentage label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      size = 'md',
      color = 'foundational',
      showLabel = false,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    
    const sizeClasses = {
      'sm': 'h-1',
      'md': 'h-2',
      'lg': 'h-3'
    };

    const colorClasses = {
      'neutral': 'bg-neutral-200',
      'foundational': 'bg-foundational-200',
      'practical': 'bg-practical-200',
      'specialized': 'bg-specialized-200',
      'success': 'bg-success-200',
      'warning': 'bg-warning-200',
      'error': 'bg-error-200'
    };

    const fillColorClasses = {
      'neutral': 'bg-neutral-600',
      'foundational': 'bg-foundational-600',
      'practical': 'bg-practical-600',
      'specialized': 'bg-specialized-600',
      'success': 'bg-success-600',
      'warning': 'bg-warning-600',
      'error': 'bg-error-600'
    };

    return (
      <div className="space-y-xs">
        <div
          ref={ref}
          className={cn(
            'w-full bg-neutral-200 rounded-full overflow-hidden',
            sizeClasses[size],
            className
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`Progress: ${percentage}%`}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out',
              fillColorClasses[color]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {showLabel && (
          <div className="text-body-small text-neutral-600 text-center">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    );
  }
);
Progress.displayName = 'Progress';

// Skeleton Component
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape variant */
  variant?: 'text' | 'circular' | 'rectangular';
  /** Additional CSS classes */
  className?: string;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      width,
      height,
      variant = 'text',
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      'text': 'h-4 rounded-medium',
      'circular': 'rounded-full',
      'rectangular': 'rounded-medium'
    };

    const style = {
      width: width,
      height: height,
      ...props.style
    };

    return (
      <div
        ref={ref}
        className={cn(
          'animate-pulse bg-neutral-200',
          variantClasses[variant],
          className
        )}
        style={style}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

// Memoized exports for performance
export default {
  LoadingSpinner: memo(LoadingSpinner),
  Alert: memo(Alert),
  Badge: memo(Badge),
  Progress: memo(Progress),
  Skeleton: memo(Skeleton)
};
