/**
 * UI Component Library for Mental Models Observatory
 * 
 * This module exports all UI components with consistent APIs, accessibility features,
 * and performance optimizations. All components are built with TypeScript, forwardRefs,
 * and memoization for optimal performance.
 * 
 * @example
 * ```tsx
 * import { Button, Card, H1, TextInput, LoadingSpinner } from '@/components/ui';
 * 
 * function MyComponent() {
 *   return (
 *     <Card>
 *       <H1>Title</H1>
 *       <TextInput label="Email" />
 *       <Button variant="primary">Submit</Button>
 *     </Card>
 *   );
 * }
 * ```
 */

// Button Components
export { default as Button } from './Button';
export type { ButtonProps } from './Button';

// Card Components
export { default as Card } from './Card';
export type { CardProps } from './Card';

// Typography Components
export { Code, H1, H2, H3, H4, Quote, Text, default as Typography } from './Typography';
export type {
    CodeProps, HeadingProps, QuoteProps, TextProps
} from './Typography';

// Input Components
export { default as Input, SearchInput, TextArea, TextInput } from './Input';
export type {
    BaseInputProps, SearchInputProps,
    TextAreaProps, TextInputProps
} from './Input';

// Layout Components
export { Cluster, Container, Grid, default as Layout, Section, Stack } from './Layout';
export type {
    ClusterProps, ContainerProps,
    GridProps, SectionProps, StackProps
} from './Layout';

// Feedback Components
export { Alert, Badge, default as Feedback, LoadingSpinner, Progress, Skeleton } from './Feedback';
export type {
    AlertProps,
    BadgeProps, LoadingSpinnerProps, ProgressProps,
    SkeletonProps
} from './Feedback';

// Responsive Components
export { default as MobileOptimized, touchOptimized, useIsMobile, useIsTouchDevice } from './MobileOptimized';
export { default as ResponsiveContainer } from './ResponsiveContainer';
export { default as ResponsiveGrid } from './ResponsiveGrid';

// Accessibility Components
export {
    AccessibleButton, AccessibleField, AccessibleHeading, FocusTrap,
    LiveRegion, ScreenReaderOnly, SkipToContent, useHighContrastMode,
    useReducedMotion
} from './AccessibilityEnhanced';

// Legacy exports for backward compatibility - Badge is already exported from Feedback

// Re-export utility function
export { cn } from '@/lib/utils';
