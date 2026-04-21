import Link from 'next/link';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';
import { getLatestBrief, getAllBriefDates } from '@/lib/daily-update-parser';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscribe — Cosmic Trex Daily Brief',
  description: 'Get the daily intelligence brief every morning. Markets, geopolitics, AI, crypto, and macro — filtered through mental models. 8 minutes. Free.',
  alternates: { canonical: '/subscribe' },
  openGraph: {
    title: 'Subscribe to Cosmic Trex',
    description: 'Daily financial intelligence brief. Markets, meditations, and mental models. Every morning. 8 minutes. Free.',
    url: '/subscribe',
  },
};

export default function SubscribePage() {
  const latestBrief = getLatestBrief();
  const briefCount = getAllBriefDates().length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark header section */}
      <section className="bg-ct-dark py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <h1 className="font-mono text-4xl sm:text-5xl font-bold text-ct-yellow mb-4 tracking-wide">
            SUBSCRIBE
          </h1>
          <p className="font-body text-lg text-text-on-dark-muted mb-2">
            Markets, meditations, and mental models. Every morning. 8 minutes.
          </p>
          {briefCount > 0 && (
            <p className="font-mono text-xs text-text-on-dark-muted/60">
              Join readers across {briefCount}+ published editions
            </p>
          )}
        </div>
      </section>

      {/* White background email capture section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          {/* Email form */}
          <SubscribeForm
            source="subscribe-page"
            layout="column"
            inputClassName="w-full bg-white border-2 border-ct-dark px-4 py-3 font-body text-base focus:outline-none focus:bg-ct-dark focus:text-ct-yellow focus:border-ct-dark"
            buttonClassName="w-full bg-ct-yellow text-ct-dark px-6 py-3 font-sans font-semibold text-base hover:bg-ct-pink hover:text-white transition-colors"
            noteClassName="text-xs text-ct-dark font-body text-center"
          />
        </div>
      </section>

      {/* What you get — value proposition with structure */}
      <section className="bg-surface-reading py-16 sm:py-20 border-t-2 border-ct-dark">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-8 text-center">
            What You Get Every Morning
          </div>
          <div className="space-y-8">
            <div className="border-l-[3px] border-ct-yellow pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The data layer</h3>
              <p className="text-text-secondary leading-relaxed">
                Markets, crypto, commodities, rates — not just prices but positioning, flows,
                and the signals beneath the surface that tell you where smart money is moving.
              </p>
            </div>
            <div className="border-l-[3px] border-ct-pink pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The thinking layer</h3>
              <p className="text-text-secondary leading-relaxed">
                Deep analysis that connects today's data to bigger patterns. The Take goes
                where headline-driven newsletters won't.
              </p>
            </div>
            <div className="border-l-[3px] border-ct-green-disc pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The discovery layer</h3>
              <p className="text-text-secondary leading-relaxed">
                Cross-domain insights from physics, psychology, game theory, and systems thinking.
                The frameworks behind the frameworks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Source credibility */}
      <section className="bg-white py-16 sm:py-20 border-t border-[#e8e8e4]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6 text-center">
            The Sources
          </div>
          <p className="text-text-primary text-lg leading-relaxed text-center mb-6">
            50+ expert sources checked daily — Lyn Alden, Byrne Hobart, SemiAnalysis,
            Simon Willison, and dozens more. Theses tracked with explicit predictions and outcomes.
          </p>
          <p className="text-text-secondary text-base leading-relaxed text-center italic">
            "The cost of information has approached zero, but the core truths of humanity
            and the world remain the same." We're drowning in content and starving for synthesis.
          </p>
        </div>
      </section>

      {/* Latest brief preview — proof of quality */}
      {latestBrief && (
        <section className="bg-ct-dark py-12 sm:py-16 border-t-[3px] border-ct-yellow">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <div className="font-mono text-xs text-ct-yellow uppercase tracking-widest mb-4">
              Latest Brief
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-white mb-3">
              {latestBrief.dailyTitle || 'Today\'s Brief'}
            </h3>
            <p className="text-text-on-dark-muted text-sm mb-1 font-mono">
              {latestBrief.displayDate}
            </p>
            {latestBrief.lede && (
              <p className="text-text-on-dark text-base leading-relaxed mt-4 mb-6">
                {latestBrief.lede.replace(/\*\*/g, '').substring(0, 200)}...
              </p>
            )}
            <Link
              href="/daily-update"
              className="inline-block bg-ct-yellow text-ct-dark px-5 py-2.5 font-mono text-sm font-semibold hover:bg-ct-pink hover:text-white transition-colors"
            >
              Read today's brief →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
