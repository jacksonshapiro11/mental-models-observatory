import { getLatestBriefLight } from '@/lib/brief-light-parser';
import SuperBriefViewer from '@/components/super-brief/SuperBriefViewer';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Super Brief | Mental Models Observatory',
  description: 'Your compressed daily intelligence brief — markets, meditations, and mental models in 5 minutes.',
};

export default function SuperBriefPage() {
  const brief = getLatestBriefLight();

  if (!brief) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-ct-dark flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-4xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-ct-text-on-dark mb-3">
            Super Brief coming soon
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            The compressed daily intelligence brief isn&apos;t available yet. Check back soon.
          </p>
          <Link
            href="/daily-update"
            className="text-amber-600 dark:text-ct-yellow hover:underline"
          >
            Read the full brief &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return <SuperBriefViewer brief={brief} />;
}
