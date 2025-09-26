import React, { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Typography components for consistent text styling
 * 
 * @example
 * ```tsx
 * <H1>Main Heading</H1>
 * <Text variant="body-large">Large body text</Text>
 * <Code>const example = "code";</Code>
 * <Quote author="Author Name">Quote text here</Quote>
 * ```
 */

// Heading Components
export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Additional CSS classes */
  className?: string;
}

export const H1 = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, children, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn('text-h1 font-semibold text-neutral-800', className)}
      {...props}
    >
      {children}
    </h1>
  )
);
H1.displayName = 'H1';

export const H2 = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-h2 font-semibold text-neutral-800', className)}
      {...props}
    >
      {children}
    </h2>
  )
);
H2.displayName = 'H2';

export const H3 = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-h3 font-semibold text-neutral-800', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
H3.displayName = 'H3';

export const H4 = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, children, ...props }, ref) => (
    <h4
      ref={ref}
      className={cn('text-h4 font-semibold text-neutral-800', className)}
      {...props}
    >
      {children}
    </h4>
  )
);
H4.displayName = 'H4';

// Text Components
export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Text variant */
  variant?: 'body' | 'body-large' | 'body-small' | 'caption';
  /** Additional CSS classes */
  className?: string;
}

export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({ variant = 'body', className, children, ...props }, ref) => {
    const variantClasses = {
      'body': 'text-body text-neutral-700',
      'body-large': 'text-body-large text-neutral-700',
      'body-small': 'text-body-small text-neutral-600',
      'caption': 'text-caption text-neutral-500'
    };

    return (
      <p
        ref={ref}
        className={cn(variantClasses[variant], className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
Text.displayName = 'Text';

// Code Components
export interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  /** Code variant */
  variant?: 'inline' | 'block';
  /** Additional CSS classes */
  className?: string;
}

export const Code = forwardRef<HTMLElement, CodeProps>(
  ({ variant = 'inline', className, children, ...props }, ref) => {
    if (variant === 'block') {
      return (
        <pre
          ref={ref as React.Ref<HTMLPreElement>}
          className={cn(
            'bg-neutral-50 border border-neutral-200 rounded-medium p-md',
            'text-body-small font-mono text-neutral-800 overflow-x-auto',
            className
          )}
          {...props}
        >
          <code>{children}</code>
        </pre>
      );
    }

    return (
      <code
        ref={ref}
        className={cn(
          'bg-neutral-50 text-neutral-800 px-xs py-px rounded-small',
          'text-body-small font-mono',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }
);
Code.displayName = 'Code';

// Quote Component
export interface QuoteProps extends React.HTMLAttributes<HTMLQuoteElement> {
  /** Quote author */
  author?: string;
  /** Quote source */
  source?: string;
  /** Additional CSS classes */
  className?: string;
}

export const Quote = forwardRef<HTMLQuoteElement, QuoteProps>(
  ({ author, source, className, children, ...props }, ref) => (
    <blockquote
      ref={ref}
      className={cn(
        'border-l-4 border-foundational-500 pl-lg py-sm',
        'text-body-large text-neutral-700 italic',
        'bg-neutral-25 rounded-r-medium',
        className
      )}
      {...props}
    >
      <div className="mb-sm">"{children}"</div>
      {(author || source) && (
        <footer className="text-body-small text-neutral-600 not-italic">
          {author && <cite className="font-medium">{author}</cite>}
          {author && source && <span className="mx-xs">•</span>}
          {source && <span>{source}</span>}
        </footer>
      )}
    </blockquote>
  )
);
Quote.displayName = 'Quote';

// Memoized exports for performance
export default {
  H1: memo(H1),
  H2: memo(H2),
  H3: memo(H3),
  H4: memo(H4),
  Text: memo(Text),
  Code: memo(Code),
  Quote: memo(Quote)
};
