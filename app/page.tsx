import { getAllDomains, getAllModels } from '@/lib/data';
import { getSignalData } from '@/lib/signal-data';
import { getRecentLifeNotes } from '@/lib/life-notes';
import { getRecentArchiveTakes, getLatestInnerGame, getLatestDiscovery, getEditionCount } from '@/lib/landing-data';
import Link from 'next/link';
import { TerminalData } from '@/components/landing/TerminalData';
import { SplitFlapSignals } from '@/components/landing/SplitFlapSignals';
import { Footer } from '@/components/layout/Footer';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';

// Revalidate every 60 seconds — picks up new brief data without manual redeploy
export const revalidate = 60;

export default function HomePage() {
  const allDomains = getAllDomains();
  const allModels = getAllModels();
  const domainCount = allDomains.length;
  const modelCount = allModels.length;
  const signalData = getSignalData();
  const lifeNotes = getRecentLifeNotes(3);

  // Dynamic content from actual published briefs
  const archiveTakes = getRecentArchiveTakes(3);
  const innerGame = signalData?.innerGame ?? getLatestInnerGame();
  const discovery = signalData?.model ?? getLatestDiscovery();
  const editionCount = getEditionCount();

  // Build Data Layer cards from signal data (real signals, not hardcoded)
  const dataLayerCards = (signalData?.signals ?? []).slice(0, 2).map(signal => ({
    domain: signal.domain.toUpperCase(),
    title: signal.terminalLine,
    body: signal.text.length > 180
      ? signal.text.slice(0, 177).replace(/\s+\S*$/, '') + '…'
      : signal.text,
  }));

  // Domain breakdown from actual model library
  const domainBreakdown = allDomains.slice(0, 4).map(domain => {
    const models = allModels.filter(m => m.domain === domain.name);
    return {
      name: domain.name,
      count: models.length,
      examples: models.slice(0, 3).map(m => m.name).join(', '),
    };
  });

  return (
    <div className="min-h-screen bg-white">
      {/* 1. SPLIT-SCREEN HERO */}
      <section className="border-b-2 border-ct-dark">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px] lg:min-h-screen">
          {/* Left: Terminal */}
          <div className="bg-ct-dark p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
            {/* Terminal header dots */}
            <div>
              <div className="flex gap-2 mb-8">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>

              {/* Terminal prompt */}
              <div className="font-mono text-sm text-ct-green-data space-y-4">
                <div className="text-text-on-dark">
                  <span className="text-ct-green-data">&gt;</span> cosmic_trex --status
                </div>

                {/* Market data - live from API */}
                <TerminalData />

                {/* Signal detected — rotating split-flap display */}
                <div className="border-t border-ct-green-data pt-6 mt-6">
                  <div className="text-ct-green-data mb-2 font-mono text-sm">SIGNAL DETECTED</div>
                  <SplitFlapSignals signals={signalData?.signals ?? []} />
                  {signalData?.updatedAt && (
                    <div className="text-[#333] mt-3 text-[9px] font-mono">
                      signals: {new Date(signalData.updatedAt).toLocaleDateString()} · prices: live
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Zine */}
          <div className="bg-ct-yellow p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
            <div>
              <div className="inline-block bg-ct-pink text-white px-3 py-1 text-xs font-mono font-semibold mb-6 rounded-sm">
                DAILY INTELLIGENCE
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-ct-dark leading-tight mb-4">
                {signalData?.headline || "Your morning briefing is rewritten headlines. This isn't."}
              </h1>

              <p className="font-body text-base sm:text-lg text-ct-dark leading-relaxed mb-8 max-w-lg">
                {signalData?.tldr || "Markets, meditations, and mental models. Delivered every morning, cross-domain thinking in 8 minutes."}
              </p>

              {/* CTA Buttons */}
              <div className="mb-8 space-y-2">
                <Link
                  href="/daily-update"
                  className="inline-block bg-ct-dark text-ct-yellow px-6 py-3 font-semibold hover:bg-ct-pink hover:text-white transition-colors"
                >
                  Read today's brief →
                </Link>
                <div className="pt-2">
                  <Link
                    href="/super-brief"
                    className="inline-block bg-ct-pink text-white px-6 py-3 font-semibold hover:bg-ct-dark hover:text-ct-yellow transition-colors text-sm"
                  >
                    Read the super brief →
                  </Link>
                </div>
              </div>

              {/* Email signup */}
              <SubscribeForm
                source="hero"
                inputClassName="flex-1 bg-white border-2 border-ct-dark px-4 py-3 font-body text-sm focus:outline-none focus:bg-ct-dark focus:text-ct-yellow"
                buttonClassName="bg-ct-dark text-ct-yellow px-6 py-3 font-sans font-semibold text-sm hover:bg-ct-pink hover:text-white transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIFE NOTES / VOICE STRIP */}
      <section className="border-t-[3px] border-ct-pink border-b-[3px] border-b-ct-green-data bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="font-mono text-sm text-ct-pink font-semibold mb-8 tracking-wide">
            HOW WE START MORNINGS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lifeNotes.map((note, idx) => (
              <div key={idx} className="border-l-4 border-ct-yellow pl-6">
                <p className="font-serif italic text-lg text-ct-text-primary leading-relaxed mb-4">
                  &ldquo;{note.text}&rdquo;
                </p>
                <div className="font-body text-sm text-text-secondary">
                  <div className="text-text-muted text-xs">{note.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CONTENT SPLIT (DATA LAYER / THINKING LAYER) */}
      <section className="bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Data Layer — dynamic from signal data */}
          <div className="bg-ct-dark p-6 sm:p-8 lg:p-12">
            <div className="font-mono text-xs text-text-on-dark-muted uppercase tracking-wider mb-8 font-semibold">
              Data Layer
            </div>

            <div className="space-y-6">
              {dataLayerCards.map((card, idx) => (
                <div key={idx} className="bg-surface-dark-card border border-ct-green-data/30 p-6 rounded-sm">
                  <div className="font-mono text-xs text-ct-green-data uppercase tracking-wider font-semibold mb-2">
                    {card.domain}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="font-body text-sm text-text-on-dark-muted leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Thinking Layer — dynamic from latest brief */}
          <div className="bg-white p-6 sm:p-8 lg:p-12">
            <div className="font-mono text-xs text-ct-pink uppercase tracking-wider mb-8 font-semibold">
              Thinking Layer
            </div>

            <div className="space-y-8">
              {/* Inner Game — from signal data or latest brief */}
              {innerGame && (
                <div>
                  <div className="inline-block bg-ct-pink text-white px-2 py-1 text-xs font-mono font-semibold mb-3 rounded-sm">
                    INNER GAME
                  </div>
                  {('quote' in innerGame && innerGame.quote) ? (
                    <>
                      <p className="font-serif text-lg italic text-ct-dark mb-2 leading-relaxed">
                        &ldquo;{innerGame.quote}&rdquo;
                      </p>
                      {innerGame.attribution && (
                        <p className="font-body text-sm text-text-muted mb-3">
                          — {innerGame.attribution}
                        </p>
                      )}
                      {innerGame.action && (
                        <p className="font-body text-sm text-text-secondary leading-relaxed">
                          {innerGame.action.length > 200
                            ? innerGame.action.slice(0, 197).replace(/\s+\S*$/, '') + '…'
                            : innerGame.action}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-body text-sm text-text-secondary leading-relaxed">
                      {('action' in innerGame ? innerGame.action : '') || ''}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-ct-dark"></div>

              {/* Discovery / Model — from signal data or latest brief */}
              {discovery && (
                <div>
                  <div className="inline-block bg-ct-dark text-white px-2 py-1 text-xs font-mono font-semibold mb-3 rounded-sm">
                    DISCOVERY
                  </div>
                  <h3 className="font-serif text-xl font-bold text-ct-dark mb-2">
                    {discovery.name}
                  </h3>
                  <p className="font-body text-sm text-text-secondary leading-relaxed">
                    {discovery.preview.length > 250
                      ? discovery.preview.slice(0, 247).replace(/\s+\S*$/, '') + '…'
                      : discovery.preview}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. THREE-LAYER PRODUCT SECTION */}
      <section className="bg-ct-dark border-t-4 border-ct-yellow py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-mono text-lg sm:text-xl text-ct-yellow font-semibold text-center mb-12 sm:mb-16 uppercase tracking-wider">
            One site. Three layers of intelligence.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* 01: The Brief */}
            <div className="bg-surface-dark-card border border-ct-green-data/30 p-8 rounded-sm">
              <div className="text-3xl font-serif font-bold text-ct-green-data mb-4">01</div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">The Brief</h3>
              <div className="inline-block bg-ct-green-data text-ct-dark px-2 py-1 text-xs font-mono font-semibold mb-4 rounded-sm">
                LIVE DAILY
              </div>
              <p className="font-body text-sm text-text-on-dark-muted leading-relaxed mb-6">
                Markets. Meditations. Mental models. Delivered every morning, cross-domain thinking in 8 minutes.
              </p>
              <div className="font-mono text-xs text-ct-green-data">{editionCount}+ editions</div>
            </div>

            {/* 02: The Observatory */}
            <div className="bg-surface-dark-card border border-ct-yellow/30 p-8 rounded-sm">
              <div className="text-3xl font-serif font-bold text-ct-yellow mb-4">02</div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">The Observatory</h3>
              <div className="inline-block bg-purple-600 text-white px-2 py-1 text-xs font-mono font-semibold mb-4 rounded-sm">
                BROWSE
              </div>
              <p className="font-body text-sm text-text-on-dark-muted leading-relaxed mb-6">
                Explore {modelCount} mental models across {domainCount} knowledge domains. Build mental scaffolding.
              </p>
              <div className="font-mono text-xs text-ct-yellow">{modelCount} models / {domainCount} domains</div>
            </div>

            {/* 03: The Library */}
            <div className="bg-surface-dark-card border border-ct-pink/30 p-8 rounded-sm">
              <div className="text-3xl font-serif font-bold text-ct-pink mb-4">03</div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">The Library</h3>
              <div className="inline-block bg-ct-yellow text-ct-dark px-2 py-1 text-xs font-mono font-semibold mb-4 rounded-sm">
                EXPLORE
              </div>
              <p className="font-body text-sm text-text-on-dark-muted leading-relaxed mb-6">
                1,000+ hand-curated sources. 150+ books, 175+ articles, 600+ podcasts. The research behind every model.
              </p>
              <div className="font-mono text-xs text-ct-pink">1,000+ sources</div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. OBSERVATORY PEEK */}
      <section className="bg-ct-yellow py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ct-dark text-center mb-12">
            From the Observatory — {modelCount} models, {domainCount} domains
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {domainBreakdown.map((domain, idx) => (
              <div key={idx} className="bg-white border-2 border-ct-dark p-6 rounded-sm">
                <h3 className="font-serif text-lg font-bold text-ct-dark mb-1">
                  {domain.name}
                </h3>
                <p className="font-mono text-sm text-text-secondary mb-4">
                  {domain.count} models
                </p>
                <p className="font-body text-xs text-text-muted leading-relaxed">
                  {domain.examples}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/models"
              className="font-sans font-semibold text-ct-dark hover:text-ct-pink transition-colors inline-flex items-center gap-2"
            >
              Explore all {modelCount} models
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. ARCHIVE STRIP — from actual published briefs */}
      <section className="border-t-4 border-ct-dark bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="font-mono text-sm text-ct-pink font-semibold mb-12 tracking-wide">
            FROM THE ARCHIVE
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {archiveTakes.map((take, idx) => (
              <div key={idx} className="bg-surface-take border border-ct-dark/10 p-6 rounded-sm">
                <div className="inline-block bg-ct-pink text-white px-2 py-1 text-xs font-mono font-semibold mb-3 rounded-sm">
                  THE TAKE
                </div>
                <h3 className="font-serif text-lg font-bold text-ct-dark mb-2 leading-tight">
                  {take.title}
                </h3>
                <p className="font-body text-sm text-text-secondary leading-relaxed mb-4">
                  {take.excerpt}
                </p>
                <div className="font-mono text-xs text-text-muted">
                  {take.date}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/archive"
              className="font-sans font-semibold text-ct-dark hover:text-ct-pink transition-colors inline-flex items-center gap-2"
            >
              Browse the full archive
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. STATS BAR */}
      <section className="bg-ct-dark border-t-4 border-ct-yellow py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-ct-yellow mb-1">
                {editionCount}+
              </div>
              <div className="font-mono text-xs text-text-on-dark-muted">EDITIONS</div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-ct-yellow mb-1">
                {modelCount}
              </div>
              <div className="font-mono text-xs text-text-on-dark-muted">MODELS</div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-ct-yellow mb-1">
                1,000+
              </div>
              <div className="font-mono text-xs text-text-on-dark-muted">SOURCES</div>
            </div>
            <div>
              <div className="font-mono text-2xl sm:text-3xl font-bold text-ct-yellow mb-1">
                8m
              </div>
              <div className="font-mono text-xs text-text-on-dark-muted">DAILY</div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA */}
      <section className="bg-ct-pink py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            Tomorrow morning, read something with teeth
          </h2>
          <p className="font-body text-lg text-white/90 mb-8">
            Markets, meditations, mental models. Free.
          </p>

          <SubscribeForm
            source="footer-cta"
            inputClassName="flex-1 bg-white/20 border-2 border-white px-4 py-3 font-body text-sm text-white placeholder-white/60 focus:outline-none focus:bg-white focus:text-ct-pink"
            buttonClassName="bg-white text-ct-pink px-6 py-3 font-sans font-semibold text-sm hover:bg-ct-dark hover:text-ct-yellow transition-colors whitespace-nowrap"
            noteClassName="text-xs text-white/70 font-body"
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}
