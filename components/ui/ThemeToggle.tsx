'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Load theme on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-neutral-200" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full
                 transition-all duration-300 hover:scale-110
                 bg-neutral-200 dark:bg-[var(--espresso-cta-text)] hover:bg-neutral-300 dark:hover:bg-[var(--espresso-cta-text)]/90
                 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foundational-500 dark:focus:ring-[var(--espresso-accent)]"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-neutral-700 transition-transform duration-300" />
      ) : (
        <Sun className="w-5 h-5 transition-transform duration-300 dark:text-[var(--espresso-accent)]" />
      )}
    </button>
  );
}

