'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface ArchiveBrief {
  date: string;
  displayDate: string;
  epigraph: string;
  lede: string;
  sectionCount: number;
  sections: string[];
}

export default function ArchivePage() {
  const [briefs, setBriefs] = useState<ArchiveBrief[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

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

  // Extract unique months
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    briefs.forEach(b => {
      const date = new Date(b.date);
      const monthStr = date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
      monthSet.add(monthStr);
    });
    return Array.from(monthSet).sort().reverse();
  }, [briefs]);

  // Filter
  const filtered = useMemo(() => {
    let result = briefs;

    // Month filter
    if (selectedMonth) {
      result = result.filter(b => {
        const date = new Date(b.date);
        const monthStr = date.toLocaleString('en-US', { year: 'numeric', month: 'long' });
        return monthStr === selectedMonth;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.displayDate.toLowerCase().includes(q) ||
        b.epigraph.toLowerCase().includes(q) ||
        b.lede.toLowerCase().includes(q) ||
        b.sections.some(s => s.toLowerCase().includes(q))
      );
    }

    return result;
  }, [briefs, searchQuery, selectedMonth]);

  return (
    <div className="min-h-screen bg-surface-reading">
      {/* Dark Header */}
      <div className="bg-ct-dark">
        <div className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-mono text-2xl font-bold text-ct-yellow mb-2">
              THE ARCHIVE
            </h1>
            <p className="text-text-on-dark text-sm mb-6">
              Every published edition of Markets, Meditations & Mental Models
            </p>
            <p className="text-text-on-dark-muted text-xs font-mono">
              {briefs.length}+ editions | Published daily since February 2026
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative border-b-2 border-ct-dark bg-white">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search briefs by date or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 w-full text-sm focus:outline-none bg-white"
              />
            </div>
          </div>

          {/* Month Filter Chips */}
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button
              onClick={() => setSelectedMonth('')}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                selectedMonth === ''
                  ? 'bg-ct-dark text-ct-yellow'
                  : 'bg-surface-warm text-text-primary border border-text-muted'
              }`}
            >
              All
            </button>
            {months.map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                  selectedMonth === month
                    ? 'bg-ct-dark text-ct-yellow'
                    : 'bg-surface-warm text-text-primary border border-text-muted'
                }`}
              >
                {month}
              </button>
            ))}
          </div>

          {/* Briefs List */}
          {!loaded ? (
            <div className="text-center py-16">
              <div className="animate-pulse text-text-muted">Loading archive...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">
                {searchQuery ? 'No briefs match your search.' : 'No briefs published yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filtered.map((brief) => {
                // Extract title from epigraph or lede
                const title = brief.epigraph || brief.lede.replace(/\*\*/g, '').substring(0, 60);

                return (
                  <Link
                    key={brief.date}
                    href={`/daily-update/${brief.date}`}
                    className="group bg-[#FAFAF6] border border-[#e8e8e4] rounded-md p-4 hover:shadow-medium transition-all duration-300 hover:border-text-secondary"
                  >
                    {/* Date */}
                    <p className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-2">
                      {brief.displayDate || brief.date}
                    </p>

                    {/* Headline */}
                    <h3 className="text-sm font-bold text-text-primary mb-2 group-hover:text-ct-pink transition-colors line-clamp-2">
                      {title}
                    </h3>

                    {/* Excerpt */}
                    {brief.lede && (
                      <p className="text-[11px] text-text-secondary mb-3 line-clamp-2">
                        {brief.lede.replace(/\*\*/g, '')}
                      </p>
                    )}

                    {/* Tag and Meta */}
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-ct-pink text-white text-[8px] font-bold rounded">
                        THE TAKE
                      </span>
                      <span className="text-[9px] text-text-muted font-mono">
                        {brief.sectionCount} sections
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Results count */}
          {loaded && filtered.length > 0 && (
            <div className="text-center pt-8">
              <span className="text-xs text-text-muted font-mono">
                {filtered.length} brief{filtered.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'displayed'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
