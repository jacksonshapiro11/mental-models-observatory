import { getLatestBrief } from '@/lib/daily-update-parser';
import BriefViewer from '@/components/daily-update/BriefViewer';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Update | Mental Models Observatory',
  description: 'Daily market intelligence brief — macro, crypto, AI, geopolitics, and the mental models that connect them.',
};

export default function DailyUpdatePage() {
  const brief = getLatestBrief();

  if (!brief) {
    return (
      <div className="min-h-screen bg-[var(--espresso-bg-dark)] flex items-center justify-center">
        <div className="text-center">
          <Newspaper className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[var(--espresso-h1)] mb-2">No briefs yet</h1>
          <p className="text-[var(--espresso-body)]/70">Check back soon for the first daily update.</p>
          <Link href="/" className="inline-block mt-6 text-[var(--espresso-accent)] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <BriefViewer brief={brief} />;
}
