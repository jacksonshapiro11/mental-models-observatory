'use client';

import { useTheme } from '@/lib/theme-context';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full
                 transition-all duration-300 hover:scale-110
                 dark:bg-[var(--espresso-accent)]/20 dark:hover:bg-[var(--espresso-accent)]/30
                 bg-neutral-200 hover:bg-neutral-300
                 focus:outline-none focus:ring-2 focus:ring-offset-2
                 dark:focus:ring-[var(--espresso-accent)] focus:ring-foundational-500"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-neutral-700 transition-transform duration-300" />
      ) : (
        <Sun className="w-5 h-5 text-[var(--espresso-accent)] transition-transform duration-300" />
      )}
    </button>
  );
}

