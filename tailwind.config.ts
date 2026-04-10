import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ZINE TERMINAL COLOR PALETTE
      colors: {
        ct: {
          dark: '#0D0D0D',
          yellow: '#FFE600',
          pink: '#FF2E63',
          'green-data': '#00FF41',
          'green-disc': '#00885a',
        },
        surface: {
          terminal: '#0D0D0D',
          reading: '#FFFFFF',
          take: '#FFFDF0',
          warm: '#F8F8F4',
          'dark-card': '#141416',
        },
        text: {
          primary: '#111111',
          secondary: '#555555',
          muted: '#999999',
          'on-dark': '#DDDDDD',
          'on-dark-muted': '#888888',
        },
      },

      // TYPOGRAPHY SYSTEM
      fontFamily: {
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
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
              borderLeftColor: '#FFE600',
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
