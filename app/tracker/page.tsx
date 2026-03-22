import type { Metadata } from 'next';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';

export const metadata: Metadata = {
  title: 'Prediction Tracker | Cosmic Trex',
  description: 'Tracking every forward-looking claim — thesis predictions, watchlist signals, portfolio kill signals, and calibration data.',
};

interface Prediction {
  category: string;
  text: string;
  date: string;
  dueDate: string;
  status: 'pending' | 'right' | 'wrong' | 'partial' | 'overdue';
  thesis?: string;
}

function parsePredictions(): { predictions: Prediction[]; watchlistItems: string[]; calibration: { right: number; wrong: number; partial: number; pending: number } } {
  const predictions: Prediction[] = [];
  const watchlistItems: string[] = [];

  // Parse Thesis Tracker for predictions
  const trackerPath = path.join(process.cwd(), 'system/Thesis_Tracker.md');
  if (fs.existsSync(trackerPath)) {
    const content = fs.readFileSync(trackerPath, 'utf-8');

    // Find prediction tables — look for "Predictions made" or similar headers
    const predictionBlocks = content.match(/\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|/g) || [];

    // Find watchlist items
    const watchlistMatch = content.match(/### Watchlist History([\s\S]*?)(?=###|$)/);
    if (watchlistMatch) {
      const wLines = (watchlistMatch[1] || '').split('\n').filter((l: string) => l.trim().startsWith('|') && !l.includes('---') && !l.includes('Item'));
      for (const line of wLines) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2 && cells[0]) {
          watchlistItems.push(cells[0]);
        }
      }
    }
  }

  // Parse Portfolio Tracker for kill signal status
  const portfolioPath = path.join(process.cwd(), 'system/Portfolio_Tracker.md');
  if (fs.existsSync(portfolioPath)) {
    const content = fs.readFileSync(portfolioPath, 'utf-8');
    // Extract kill conditions as implicit predictions
    const killMatches = content.matchAll(/Kill:\s*(.+?)(?:\n|$)/g);
    for (const match of killMatches) {
      predictions.push({
        category: 'Portfolio Kill Signal',
        text: match[1].trim(),
        date: 'Portfolio entry',
        dueDate: 'Rolling',
        status: 'pending',
      });
    }
  }

  const calibration = {
    right: predictions.filter(p => p.status === 'right').length,
    wrong: predictions.filter(p => p.status === 'wrong').length,
    partial: predictions.filter(p => p.status === 'partial').length,
    pending: predictions.filter(p => p.status === 'pending' || p.status === 'overdue').length,
  };

  return { predictions, watchlistItems, calibration };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    right: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    wrong: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    partial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    pending: 'bg-neutral-100 dark:bg-[var(--espresso-surface)]/50 text-neutral-600 dark:text-[var(--espresso-body)]/70',
    overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    'Thesis': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    'Watchlist': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    'Portfolio Kill Signal': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    "Tomorrow's Headlines": 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    'Greenshoot': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[category] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}>
      {category}
    </span>
  );
}

export default function TrackerPage() {
  const { predictions, watchlistItems, calibration } = parsePredictions();
  const total = calibration.right + calibration.wrong + calibration.partial;
  const accuracy = total > 0 ? Math.round((calibration.right / total) * 100) : null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-2">Prediction Tracker</h1>
        <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70 text-sm max-w-2xl">
          Every forward-looking claim the system makes is a bet. This page tracks those bets, scores outcomes, and measures calibration.
        </p>
      </div>

      {/* Calibration Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <div className="border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg p-4 bg-white dark:bg-[var(--espresso-bg-medium)]">
          <div className="text-2xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">
            {accuracy !== null ? `${accuracy}%` : '—'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-[var(--espresso-body)]/60">Accuracy</div>
        </div>
        <div className="border border-green-200 dark:border-green-800/30 rounded-lg p-4 bg-green-50/50 dark:bg-green-900/10">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{calibration.right}</div>
          <div className="text-xs text-green-600 dark:text-green-400/70">Right</div>
        </div>
        <div className="border border-red-200 dark:border-red-800/30 rounded-lg p-4 bg-red-50/50 dark:bg-red-900/10">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{calibration.wrong}</div>
          <div className="text-xs text-red-600 dark:text-red-400/70">Wrong</div>
        </div>
        <div className="border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{calibration.partial}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400/70">Partial</div>
        </div>
        <div className="border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg p-4 bg-white dark:bg-[var(--espresso-bg-medium)]">
          <div className="text-2xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">{calibration.pending}</div>
          <div className="text-xs text-neutral-500 dark:text-[var(--espresso-body)]/60">Pending</div>
        </div>
      </div>

      {/* Active Predictions */}
      {predictions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-4">Active Predictions</h2>
          <div className="border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-[var(--espresso-bg-light)]/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-[var(--espresso-body)]/60">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-[var(--espresso-body)]/60">Prediction</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-[var(--espresso-body)]/60">Due</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-[var(--espresso-body)]/60">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-[var(--espresso-accent)]/10">
                  {predictions.map((p, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-[var(--espresso-bg-light)]/10">
                      <td className="px-4 py-3"><CategoryBadge category={p.category} /></td>
                      <td className="px-4 py-3 text-neutral-700 dark:text-[var(--espresso-body)] max-w-md">{p.text}</td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-[var(--espresso-body)]/60 font-mono text-xs whitespace-nowrap">{p.dueDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Watchlist Items */}
      {watchlistItems.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-4">Watchlist History</h2>
          <div className="flex flex-wrap gap-2">
            {watchlistItems.map((item, i) => (
              <span key={i} className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/15 text-purple-700 dark:text-purple-400 rounded-lg text-sm border border-purple-100 dark:border-purple-800/30">
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {predictions.length === 0 && watchlistItems.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70 mb-2">No predictions tracked yet.</p>
          <p className="text-sm text-neutral-400 dark:text-[var(--espresso-body)]/50">
            Predictions from the daily brief pipeline will appear here as the system tracks them.
          </p>
        </div>
      )}

      <div className="mt-8 p-4 border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg bg-neutral-50 dark:bg-[var(--espresso-bg-light)]/30">
        <p className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/50 italic">
          This tracker measures the system&apos;s predictive calibration — the gap between what we claim will happen and what actually happens. The goal isn&apos;t to be right every time, but to be well-calibrated: confident when we should be, uncertain when we should be.
        </p>
      </div>
    </div>
  );
}
