// Re-export types from lib modules for convenience
export type {
  MentalModel,
  Domain,
  Source,
  SearchResult
} from '@/lib/data';

export type {
  ReadwiseHighlight,
  ReadwiseBook,
  ReadwiseResponse,
  ReadwiseTag,
  GetHighlightsParams,
  GetBooksParams,
  ReadwiseError,
  CacheEntry,
  RequestOptions
} from '@/types/readwise';

// Additional types for the application
export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface MetaData {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedAt?: string;
  updatedAt?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface FilterOptions {
  domain?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  search?: string;
}

export interface SortOptions {
  field: 'name' | 'createdAt' | 'updatedAt' | 'difficulty';
  direction: 'asc' | 'desc';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showTags: boolean;
  showDifficulty: boolean;
  enableAnimations: boolean;
}

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
  retry?: () => void;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  image?: string;
  href?: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  onClick?: () => void;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'search' | 'number';
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  icon?: string;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export interface TooltipProps extends BaseComponentProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Search and filtering types
export interface SearchFilters {
  query: string;
  domains: string[];
  difficulties: string[];
  tags: string[];
  sortBy: 'relevance' | 'name' | 'date';
  sortOrder: 'asc' | 'desc';
}

export interface SearchSuggestion {
  text: string;
  type: 'model' | 'domain' | 'tag';
  count?: number;
}

// Theme and styling types
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  fonts: {
    sans: string;
    serif: string;
    mono: string;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
}

// Performance and analytics types
export interface PerformanceMetrics {
  pageLoadTime: number;
  timeToFirstByte: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  largestContentfulPaint: number;
}

export interface UserInteraction {
  type: 'click' | 'scroll' | 'search' | 'navigation';
  target: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// Accessibility types
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-hidden'?: boolean;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
  'aria-current'?: boolean;
  role?: string;
  tabIndex?: number;
}

// SEO and metadata types
export interface SeoProps {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'book';
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio';
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: (value: unknown) => string | undefined;
  };
  options?: Array<{ value: string; label: string }>;
}

export interface FormData {
  [key: string]: unknown;
}

export interface FormErrors {
  [key: string]: string;
}

export interface FormState {
  data: FormData;
  errors: FormErrors;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}
