import Link from 'next/link';
import { getAllModels, getAllDomains } from '@/lib/data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Cosmic Trex',
  description: 'Daily financial intelligence brief covering markets, geopolitics, AI, crypto, and macro — filtered through 100+ mental models across 40 knowledge domains. 50+ expert sources, tracked predictions, cross-disciplinary synthesis.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Cosmic Trex',
    description: 'Daily financial intelligence brief covering markets, geopolitics, AI, crypto, and macro — filtered through mental models from physics, psychology, game theory, and systems thinking.',
    url: '/about',
  },
};

export default function AboutPage() {
  const modelCount = getAllModels().length;
  const domainCount = getAllDomains().length;

  return (
    <div className="min-h-screen bg-white">
      {/* Dark header */}
      <div className="bg-ct-dark border-b-[3px] border-ct-yellow py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="font-mono text-xs text-ct-yellow uppercase tracking-widest mb-6">
            About Cosmic Trex
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Built for smart, curious people who think in systems and want to get a bit smarter every day.
          </h1>
          <p className="text-text-on-dark text-lg leading-relaxed">
            Markets, meditations, and mental models. A daily intelligence brief that connects what's happening to why it matters — across markets, philosophy, science, and human nature.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-16 sm:py-20">

        {/* WHAT THIS IS */}
        <section className="mb-20">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6">
            What This Is
          </div>
          <div className="space-y-5 text-text-primary text-lg leading-relaxed">
            <p>
              Every morning, Cosmic Trex publishes a brief that most people describe as
              "the thing I didn't know I needed." It covers markets, geopolitics, AI, crypto,
              and macro — then does something no other publication does: it connects the dots
              to mental models from physics, psychology, game theory, and systems thinking.
            </p>
            <p>
              The result is 8 minutes of reading that makes you genuinely smarter about
              what's happening in the world and why. Not rewritten headlines. Not vibes.
              Real analysis from 50+ expert sources, filtered through frameworks that
              have been battle-tested across centuries and disciplines.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/daily-update"
              className="inline-block bg-ct-dark text-ct-yellow px-5 py-2.5 font-mono text-sm font-semibold hover:bg-ct-pink hover:text-white transition-colors"
            >
              Read today's brief →
            </Link>
            <Link
              href="/super-brief"
              className="inline-block border-2 border-ct-dark text-ct-dark px-5 py-2.5 font-mono text-sm font-semibold hover:bg-ct-dark hover:text-ct-yellow transition-colors"
            >
              Try the super brief →
            </Link>
          </div>
        </section>

        {/* THREE LAYERS */}
        <section className="mb-20">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6">
            Three Layers
          </div>
          <div className="space-y-8">
            <div className="border-l-[3px] border-ct-yellow pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The data layer</h3>
              <p className="text-text-secondary leading-relaxed">
                Markets, crypto, commodities, rates. Not just prices — positioning, flows,
                the signals beneath the surface that tell you where smart money is actually moving.
              </p>
            </div>
            <div className="border-l-[3px] border-ct-pink pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The thinking layer</h3>
              <p className="text-text-secondary leading-relaxed">
                The Take connects today's data to deeper analysis. Inner Game grounds you
                in presence and clarity. Because good investing starts with good thinking,
                and good thinking starts with knowing yourself.
              </p>
            </div>
            <div className="border-l-[3px] border-ct-green-disc pl-6">
              <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">The discovery layer</h3>
              <p className="text-text-secondary leading-relaxed">
                Cross-domain insights from science, philosophy, and history that
                sharpen how you see patterns. The frameworks behind the frameworks.
              </p>
            </div>
          </div>
        </section>

        {/* THE SOURCES */}
        <section className="mb-20">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6">
            The Sources
          </div>
          <div className="space-y-5 text-text-primary text-lg leading-relaxed">
            <p>
              The source network is curated, not scraped. 50+ expert sources checked daily —
              Lyn Alden, Byrne Hobart, SemiAnalysis, Simon Willison, hildobby, and dozens more.
              People who actually understand the domains they write about.
            </p>
            <p>
              Theses are tracked with explicit predictions and outcomes. When the brief is wrong,
              it says so. The system compounds — feedback loops tighten, blindspots narrow.
              Day 50 is smarter than day 1.
            </p>
          </div>
        </section>

        {/* THE OBSERVATORY */}
        <section className="mb-20">
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6">
            The Observatory
          </div>
          <div className="space-y-5 text-text-primary text-lg leading-relaxed">
            <p>
              {modelCount} mental models across {domainCount} domains. Physics, psychology,
              game theory, evolution, information theory, decision science — sourced from
              5,000+ pages of hand-curated material. Every model is referenced in the daily brief.
              It's not a static library — it's a living knowledge graph.
            </p>
          </div>
          <div className="mt-8">
            <Link
              href="/models"
              className="inline-block bg-ct-dark text-ct-yellow px-5 py-2.5 font-mono text-sm font-semibold hover:bg-ct-pink hover:text-white transition-colors"
            >
              Explore {modelCount} models →
            </Link>
          </div>
        </section>

        {/* PHILOSOPHY CALLOUT */}
        <section className="bg-surface-take border-l-[3px] border-ct-yellow -mx-6 px-6 py-10 sm:mx-0 sm:px-8 sm:rounded-sm mb-20">
          <p className="font-serif text-2xl text-ct-dark leading-relaxed italic mb-4">
            "The cost of information has approached zero, but the core truths of humanity
            and the world remain the same."
          </p>
          <p className="text-text-secondary text-lg leading-relaxed">
            We're drowning in content and starving for synthesis. Cosmic Trex exists because
            the world needs fewer headlines and more frameworks. The brief takes the analysis
            seriously without taking itself seriously. That's the whole thing.
          </p>
        </section>

        {/* CONTACT */}
        <section>
          <div className="font-mono text-xs text-ct-pink uppercase tracking-widest mb-6">
            Get in Touch
          </div>
          <p className="text-text-primary text-lg leading-relaxed mb-6">
            Questions, feedback, ideas, or just want to say hi:
          </p>
          <div className="space-y-3">
            <a
              href="mailto:cosmictrex11@gmail.com"
              className="block text-ct-pink hover:text-ct-dark transition-colors font-mono text-sm"
            >
              cosmictrex11@gmail.com
            </a>
            <a
              href="https://twitter.com/cosmictrex"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-ct-pink hover:text-ct-dark transition-colors font-mono text-sm"
            >
              @cosmictrex
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-ct-dark border-t-[3px] border-ct-yellow py-8">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 pb-6 border-b border-text-on-dark-muted/20">
            <div className="font-mono text-sm text-text-on-dark">2026 cosmic trex</div>
            <div className="font-mono text-sm text-text-on-dark-muted">markets. meditations. models.</div>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/daily-update" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">Brief</Link>
            <Link href="/super-brief" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">Super Brief</Link>
            <Link href="/archive" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">Archive</Link>
            <Link href="/models" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">Observatory</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
