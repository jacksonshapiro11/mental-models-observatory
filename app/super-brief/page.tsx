import { getLatestBriefLight } from '@/lib/brief-light-parser';
import { currentWeeklyLightSlug } from '@/lib/weekly-window';
import { superBriefOgImage } from '@/lib/og-super-brief';
import SuperBriefViewer from '@/components/super-brief/SuperBriefViewer';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const brief = getLatestBriefLight();
  const title = "Today's Super Brief — Cosmic Trex";
  const description = 'The compressed daily intelligence brief. Essential market signals in about ten minutes.';

  return {
    title: "Today's Super Brief",
    description,
    alternates: { canonical: '/super-brief' },
    openGraph: {
      title,
      description,
      url: '/super-brief',
      ...(brief ? { images: superBriefOgImage(brief.date) } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(brief ? { images: [`/api/og/super-brief/${brief.date}`] } : {}),
    },
  };
}

export default function SuperBriefPage() {
  // Zoom-out window (Pipeline_Controller "ZOOM-OUT DAY"): from the Weekly's
  // Sunday until the next daily publishes, the Weekly Light IS the super brief.
  const weeklySlug = currentWeeklyLightSlug();
  if (weeklySlug) {
    redirect(`/weekly-super/${weeklySlug}`);
  }

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
