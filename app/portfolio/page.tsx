import { parsePortfolioTracker } from '@/lib/portfolio-parser';
import type { Metadata } from 'next';
import Link from 'next/link';
import PortfolioClient from '@/components/portfolio/PortfolioClient';

export const metadata: Metadata = {
  title: 'Portfolio Tracker | Cosmic Trex',
  description: 'Structural thesis positions across Core, Satellite, and Optionality tiers — tracking mispricing, kill signals, and conviction.',
};

export default function PortfolioPage() {
  const portfolio = parsePortfolioTracker();

  if (!portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)] mb-2">Portfolio Tracker</h1>
          <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70">No portfolio data found.</p>
          <Link href="/" className="inline-block mt-4 text-blue-600 dark:text-[var(--espresso-accent)] hover:underline">← Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <PortfolioClient positions={portfolio.positions} />
    </div>
  );
}
