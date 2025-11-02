import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Espresso-gold theme utilities
    'text-[var(--espresso-h1)]',
    'text-[var(--espresso-body)]',
    'text-[var(--espresso-accent)]',
    'bg-[var(--espresso-cta-bg)]',
    'text-[var(--espresso-cta-text)]',
    'bg-[var(--espresso-surface)]',
    'bg-[var(--espresso-bg-dark)]',
    'bg-[var(--espresso-bg-medium)]',
    'bg-[var(--espresso-bg-light)]',
    'border-[color:rgba(212,175,55,0.35)]',
    'border-[var(--espresso-accent)]/20',
    'border-[var(--espresso-accent)]/30',
    'border-[var(--espresso-accent)]/40',
    'hover:bg-[#c49f2e]',
    'hover:border-[color:rgba(212,175,55,0.5)]',
    'hover:bg-[var(--espresso-surface)]/40',
    'hover:bg-[var(--espresso-surface)]/80',
    'hover:border-[var(--espresso-accent)]/40',
  ],
  theme: {
    extend: {
      // DESIGN SYSTEM FOUNDATION
      colors: {
        // Tier-based Knowledge Architecture
        foundational: {
          50: '#eff6ff',
          100: '#dbeafe', 
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1e40af', // Primary foundational knowledge
          700: '#1d4ed8',
          800: '#1e3a8a',
          900: '#1e293b',
          950: '#0f172a',
        },
        practical: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca', 
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626', // Primary practical knowledge
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        specialized: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7', 
          400: '#34d399',
          500: '#10b981',
          600: '#059669', // Primary specialized knowledge
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Primary accent
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Sophisticated Neutral Palette
        neutral: {
          0: '#ffffff',
          25: '#fafafa', // Background primary
          50: '#f9fafb', // Background accent
          100: '#f3f4f6',
          200: '#e5e7eb', // Border light
          300: '#d1d5db', // Border medium
          400: '#9ca3af', // Text tertiary
          500: '#6b7280', // Text secondary
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937', // Text primary
          900: '#111827',
          950: '#030712',
        },
        // Semantic Colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },

      // TYPOGRAPHY SYSTEM
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'Cascadia Code', 'Segoe UI Mono', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '600' }],
        'h2': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '600' }],
        'h3': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '600' }],
        'h4': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-large': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-small': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },

      // SPACING SYSTEM (8px grid)
      spacing: {
        'xs': '0.25rem',  // 4px
        'sm': '0.5rem',   // 8px
        'md': '1rem',     // 16px
        'lg': '1.5rem',   // 24px
        'xl': '2rem',     // 32px
        '2xl': '3rem',    // 48px
        '3xl': '4rem',    // 64px
        '4xl': '6rem',    // 96px
        '5xl': '8rem',    // 128px
        '6xl': '12rem',   // 192px
      },

      // BORDER RADIUS
      borderRadius: {
        'small': '0.375rem',  // 6px
        'medium': '0.5rem',   // 8px
        'large': '0.75rem',   // 12px
        'xl': '1rem',         // 16px
        '2xl': '1.5rem',      // 24px
      },

      // SHADOWS (Subtle, sophisticated depth)
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'gentle': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'strong': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'emphasis': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'inner-subtle': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },

      // TRANSITIONS
      transitionDuration: {
        'fast': '150ms',
        'medium': '300ms', 
        'slow': '500ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'sharp': 'cubic-bezier(0.4, 0, 1, 1)',
        'gentle': 'cubic-bezier(0, 0, 0.2, 1)',
      },

      // Z-INDEX SCALE
      zIndex: {
        'dropdown': '1000',
        'sticky': '1010', 
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'notification': '1080',
      },

      // ANIMATIONS
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'fade-up': 'fade-up 300ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
        'slide-down': 'slide-down 200ms ease-out',
        'pulse-gentle': 'pulse-gentle 2s ease-in-out infinite',
      },

      // TYPOGRAPHY PLUGIN CUSTOMIZATION
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#1f2937',
            lineHeight: '1.6',
            '[class~="lead"]': {
              fontSize: '1.125rem',
              lineHeight: '1.6',
            },
            h1: {
              fontSize: '2.25rem',
              fontWeight: '600',
              lineHeight: '1.2',
              letterSpacing: '-0.025em',
            },
            h2: {
              fontSize: '1.875rem', 
              fontWeight: '600',
              lineHeight: '1.2',
              letterSpacing: '-0.025em',
            },
            h3: {
              fontSize: '1.5rem',
              fontWeight: '600', 
              lineHeight: '1.25',
              letterSpacing: '-0.02em',
            },
            code: {
              fontSize: '0.875rem',
              fontWeight: '400',
              backgroundColor: '#f9fafb',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            blockquote: {
              borderLeftColor: '#3b82f6',
              borderLeftWidth: '0.25rem',
              fontStyle: 'normal',
              paddingLeft: '1.5rem',
              marginLeft: '0',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};

export default config;
