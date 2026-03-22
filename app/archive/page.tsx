'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface ArchiveBrief {
  date: string;
  displayDate: string;
  epigraph: string;
  lede: string;
  sectionCount: number;
  sections: string[];
}

// This component fetches data client-side from an API route
// We'll also provide a server-rendered fallback via the API

export default function ArchivePage() {
  const [briefs, setBriefs] = useState<ArchiveBrief[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load on mount
  if (!loaded) {
    fetch('/api/archive')
      .then(r => r.json())
      .then((data: ArchiveBrief[]) => {
        setBriefs(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return briefs;
    const q = searchQuery.toLowerCase();
    return briefs.filter(b =>
      b.displayDate.toLowerCase().includes(q) ||
      b.epigraph.toLowerCase().includes(q) ||
      b.lede.toLowerCase().includes(q) ||
      b.sections.some(s => s.toLowerCase().includes(q))
    );
  }, [briefs, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-2">Brief Archive</h1>
        <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70 text-sm">
          Every published edition of Markets, Meditations & Mental Models.
        </p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search briefs by date, topic, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-[var(--espresso-accent)]/20 bg-white dark:bg-[var(--espresso-bg-medium)] text-neutral-800 dark:text-[var(--espresso-h1)] placeholder-neutral-400 dark:placeholder-[var(--espresso-body)]/40 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[var(--espresso-accent)]/50 text-sm"
        />
      </div>

      {!loaded ? (
        <div className="text-center py-12">
          <div className="animate-pulse-gentle text-neutral-400 dark:text-[var(--espresso-body)]/50">Loading archive...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70">
            {searchQuery ? 'No briefs match your search.' : 'No briefs published yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((brief) => (
            <Link
              key={brief.date}
              href={`/daily-update/${brief.date}`}
              className="block border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg p-4 hover:border-neutral-300 dark:hover:border-[var(--espresso-accent)]/30 hover:bg-neutral-50 dark:hover:bg-[var(--espresso-bg-light)]/20 transition-colors bg-white dark:bg-transparent"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-neutral-800 dark:text-[var(--espresso-h1)]">
                    {brief.displayDate || brief.date}
                  </h2>
                  {brief.epigraph && (
                    <p className="text-sm italic text-neutral-500 dark:text-[var(--espresso-body)]/60 mt-0.5 truncate">
                      &ldquo;{brief.epigraph}&rdquo;
                    </p>
                  )}
                  {brief.lede && (
                    <p className="text-sm text-neutral-600 dark:text-[var(--espresso-body)]/70 mt-1 line-clamp-2">
                      {brief.lede.replace(/\*\*/g, '')}
                    </p>
                  )}
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <span className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/40 font-mono">{brief.date}</span>
                  <div className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/40 mt-1">
                    {brief.sectionCount} sections
                  </div>
                </div>
              </div>
            </Link>
          ))}
          <div className="text-center pt-4">
            <span className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/40">
              {filtered.length} brief{filtered.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'published'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
