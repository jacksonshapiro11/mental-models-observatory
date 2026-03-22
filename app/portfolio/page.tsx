import { parsePortfolioTracker, type PortfolioPosition } from '@/lib/portfolio-parser';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Portfolio Tracker | Cosmic Trex',
  description: 'Structural thesis positions across Core, Satellite, and Optionality tiers — tracking mispricing, kill signals, and conviction.',
};

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Core: 'bg-blue-600 text-white',
    Satellite: 'bg-amber-600 text-white',
    Optionality: 'bg-purple-600 text-white',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colors[tier] || 'bg-gray-500 text-white'}`}>
      {tier}
    </span>
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const isPending = signal.includes('Pending');
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
      isPending ? 'bg-neutral-200 dark:bg-[var(--espresso-surface)] text-neutral-600 dark:text-[var(--espresso-body)]/70' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    }`}>
      {signal}
    </span>
  );
}

function PositionCard({ position }: { position: PortfolioPosition }) {
  return (
    <div className="border border-neutral-200 dark:border-[var(--espresso-accent)]/20 rounded-lg p-5 hover:border-neutral-300 dark:hover:border-[var(--espresso-accent)]/40 transition-colors bg-white dark:bg-[var(--espresso-bg-medium)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-[var(--espresso-h1)]">
            {position.ticker}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-[var(--espresso-body)]/70">{position.name}</p>
        </div>
        <div className="flex gap-2 items-center">
          <TierBadge tier={position.tier} />
          <SignalBadge signal={position.signal} />
        </div>
      </div>

      {position.mispricingMarket && (
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-[var(--espresso-body)]/50 mb-1">Mispricing</p>
          <p className="text-sm text-neutral-600 dark:text-[var(--espresso-body)]/80">
            <span className="text-red-500 dark:text-red-400 font-medium">Market:</span> {position.mispricingMarket}
          </p>
          {position.mispricingOurs && (
            <p className="text-sm text-neutral-600 dark:text-[var(--espresso-body)]/80 mt-1">
              <span className="text-green-600 dark:text-green-400 font-medium">Us:</span> {position.mispricingOurs}
            </p>
          )}
        </div>
      )}

      {position.killCriteria.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-[var(--espresso-body)]/50 mb-1">Kill Signals</p>
          <ul className="space-y-1">
            {position.killCriteria.slice(0, 3).map((k: string, i: number) => (
              <li key={i} className="text-sm text-neutral-600 dark:text-[var(--espresso-body)]/70 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5 shrink-0">✕</span>
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {position.keyAssumptions.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-[var(--espresso-body)]/50 mb-1">Key Assumptions</p>
          <div className="space-y-1">
            {position.keyAssumptions.map((a: { text: string; probability: string; track: string; kill: string }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {a.probability && (
                  <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                    {a.probability}
                  </span>
                )}
                <span className="text-neutral-600 dark:text-[var(--espresso-body)]/70 truncate">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TierSection({ title, description, positions, weight }: {
  title: string;
  description: string;
  positions: PortfolioPosition[];
  weight: string;
}) {
  if (positions.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">{title}</h2>
          <p className="text-sm text-neutral-500 dark:text-[var(--espresso-body)]/60">{description}</p>
        </div>
        <span className="text-sm font-medium text-neutral-400 dark:text-[var(--espresso-body)]/50">{weight}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map((p: PortfolioPosition) => (
          <PositionCard key={p.ticker} position={p} />
        ))}
      </div>
    </section>
  );
}

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-[var(--espresso-h1)]">Portfolio Tracker</h1>
          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">DRAFT</span>
        </div>
        <p className="text-neutral-500 dark:text-[var(--espresso-body)]/70 text-sm max-w-2xl">
          Structural thesis positions applying our frameworks to specific assets. Not investment advice — a testing ground for our mental models against real markets.
        </p>
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <span className="text-neutral-400 dark:text-[var(--espresso-body)]/50">Positions</span>
            <span className="ml-1.5 font-semibold text-neutral-800 dark:text-[var(--espresso-h1)]">{portfolio.positions.length}</span>
          </div>
          <div>
            <span className="text-neutral-400 dark:text-[var(--espresso-body)]/50">Core</span>
            <span className="ml-1.5 font-semibold text-blue-600 dark:text-blue-400">{portfolio.core.length}</span>
          </div>
          <div>
            <span className="text-neutral-400 dark:text-[var(--espresso-body)]/50">Satellite</span>
            <span className="ml-1.5 font-semibold text-amber-600 dark:text-amber-400">{portfolio.satellite.length}</span>
          </div>
          <div>
            <span className="text-neutral-400 dark:text-[var(--espresso-body)]/50">Optionality</span>
            <span className="ml-1.5 font-semibold text-purple-600 dark:text-purple-400">{portfolio.optionality.length}</span>
          </div>
        </div>
      </div>

      <TierSection
        title="Core Tier"
        description="Structural regime bets — highest conviction, largest thinking weight"
        positions={portfolio.core}
        weight="60-70%"
      />
      <TierSection
        title="Satellite Tier"
        description="Thesis-driven positions — moderate conviction, specific catalysts"
        positions={portfolio.satellite}
        weight="20-30%"
      />
      <TierSection
        title="Optionality Tier"
        description="Asymmetric bets — bounded downside, convex upside"
        positions={portfolio.optionality}
        weight="5-10%"
      />

      <div className="mt-8 p-4 border border-neutral-200 dark:border-[var(--espresso-accent)]/15 rounded-lg bg-neutral-50 dark:bg-[var(--espresso-bg-light)]/30">
        <p className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/50 italic">
          This portfolio is purely illustrative — not investment advice. It applies our structural theses to specific assets to test frameworks against real markets. The tiered structure reflects conviction levels, not recommended allocations. Do not invest in anything because it appears here.
        </p>
      </div>
    </div>
  );
}
