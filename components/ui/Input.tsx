"use client";

import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import React, { forwardRef, memo, useState } from 'react';

/**
 * Input components with validation states and accessibility
 * 
 * @example
 * ```tsx
 * <TextInput 
 *   label="Email" 
 *   placeholder="Enter your email"
 *   error="Invalid email format"
 * />
 * 
 * <SearchInput 
 *   placeholder="Search models..."
 *   onSearch={handleSearch}
 * />
 * 
 * <TextArea 
 *   label="Description" 
 *   rows={4}
 *   maxLength={500}
 * />
 * ```
 */

// Base Input Props
export interface BaseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input label */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Success state */
  success?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// TextInput Component
export interface TextInputProps extends BaseInputProps {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const hasSuccess = success && !hasError;

    return (
      <div className="space-y-sm">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-body-small font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={cn(
            // Base styles
            'w-full px-md py-sm border rounded-medium',
            'text-body text-neutral-800 placeholder-neutral-500',
            'bg-neutral-0 transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            
            // State styles
            hasError && [
              'border-error-300 focus-visible:ring-error-500',
              'focus-visible:border-error-500'
            ],
            hasSuccess && [
              'border-success-300 focus-visible:ring-success-500',
              'focus-visible:border-success-500'
            ],
            !hasError && !hasSuccess && [
              'border-neutral-300 focus-visible:border-neutral-400'
            ],
            
            className
          )}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        
        {(helperText || error) && (
          <div
            id={hasError ? `${inputId}-error` : `${inputId}-helper`}
            className={cn(
              'text-body-small',
              hasError ? 'text-error-600' : 'text-neutral-600'
            )}
          >
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);
TextInput.displayName = 'TextInput';

// SearchInput Component
export interface SearchInputProps extends Omit<BaseInputProps, 'type'> {
  /** Search callback */
  onSearch?: (value: string) => void;
  /** Clear callback */
  onClear?: () => void;
  /** Debounce delay in ms */
  debounceMs?: number;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      className,
      placeholder = 'Search...',
      onSearch,
      onClear,
      debounceMs = 300,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      
      if (onSearch) {
        setIsSearching(true);
        setTimeout(() => {
          onSearch(newValue);
          setIsSearching(false);
        }, debounceMs);
      }
    };

    const handleClear = () => {
      setValue('');
      onClear?.();
      onSearch?.('');
    };

    return (
      <div className="space-y-sm">
        {label && (
          <label className="block text-body-small font-medium text-neutral-700">
            {label}
          </label>
        )}
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-neutral-400" />
          </div>
          
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={cn(
              // Base styles
              'w-full pl-xl pr-xl py-sm border rounded-medium',
              'text-body text-neutral-800 placeholder-neutral-500',
              'bg-neutral-0 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              
              // State styles
              error && [
                'border-error-300 focus-visible:ring-error-500',
                'focus-visible:border-error-500'
              ],
              success && !error && [
                'border-success-300 focus-visible:ring-success-500',
                'focus-visible:border-success-500'
              ],
              !error && !success && [
                'border-neutral-300 focus-visible:border-neutral-400'
              ],
              
              className
            )}
            aria-invalid={!!error}
            {...props}
          />
          
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-md flex items-center"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-neutral-400 hover:text-neutral-600 transition-colors" />
            </button>
          )}
          
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-md flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full" />
            </div>
          )}
        </div>
        
        {(helperText || error) && (
          <div
            className={cn(
              'text-body-small',
              error ? 'text-error-600' : 'text-neutral-600'
            )}
          >
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

// TextArea Component
export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Textarea label */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Success state */
  success?: boolean;
  /** Character count */
  showCharacterCount?: boolean;
  /** Maximum characters */
  maxLength?: number;
  /** Additional CSS classes */
  className?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      showCharacterCount,
      maxLength,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const hasSuccess = success && !hasError;
    const currentLength = (props.value as string)?.length || 0;

    return (
      <div className="space-y-sm">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-body-small font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            maxLength={maxLength}
            className={cn(
              // Base styles
              'w-full px-md py-sm border rounded-medium',
              'text-body text-neutral-800 placeholder-neutral-500',
              'bg-neutral-0 transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'resize-vertical min-h-[80px]',
              
              // State styles
              hasError && [
                'border-error-300 focus-visible:ring-error-500',
                'focus-visible:border-error-500'
              ],
              hasSuccess && [
                'border-success-300 focus-visible:ring-success-500',
                'focus-visible:border-success-500'
              ],
              !hasError && !hasSuccess && [
                'border-neutral-300 focus-visible:border-neutral-400'
              ],
              
              className
            )}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
            }
            {...props}
          />
          
          {showCharacterCount && maxLength && (
            <div className="absolute bottom-sm right-sm text-caption text-neutral-500">
              {currentLength}/{maxLength}
            </div>
          )}
        </div>
        
        {(helperText || error) && (
          <div
            id={hasError ? `${textareaId}-error` : `${textareaId}-helper`}
            className={cn(
              'text-body-small',
              hasError ? 'text-error-600' : 'text-neutral-600'
            )}
          >
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

// Memoized exports for performance
export default {
  TextInput: memo(TextInput),
  SearchInput: memo(SearchInput),
  TextArea: memo(TextArea)
};
