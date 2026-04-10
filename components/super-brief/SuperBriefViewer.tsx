'use client';

import React from 'react';
import Link from 'next/link';
import type { BriefLight } from '@/lib/brief-light-parser';
import SuperBriefAudioPlayer from '@/components/super-brief/SuperBriefAudioPlayer';
import { SuperBriefDashboard } from '@/components/super-brief/SuperBriefDashboard';
import { Footer } from '@/components/layout/Footer';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';

// ─── Inline markdown helpers ────────────────────────────────────────────────

function RichText({ text, className = '' }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
    const linkMatch = remaining.match(/\[([^\]]+?)\]\(([^)]+?)\)/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) { parts.push(remaining); break; }

    const first = matches[0]!;
    if (first.index > 0) parts.push(remaining.slice(0, first.index));

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold">{first.match![1]}</strong>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} className="italic">{first.match![1]}</em>);
    } else if (first.type === 'link') {
      parts.push(
        <a key={key++} href={first.match![2]} target="_blank" rel="noopener noreferrer"
          className="text-ct-pink hover:text-ct-yellow underline">{first.match![1]}</a>
      );
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return <span className={className}>{parts}</span>;
}

// ─── Signal parser ──────────────────────────────────────────────────────────
// Parse "The Update" section markdown into signal items.
// Each bold headline (**Title**) starts a new signal.
// The paragraph(s) after it are the body.
// Color is inferred from content keywords.

interface SignalItem {
  headline: string;
  body: string;
  color: 'red' | 'green' | 'yellow';
  domain: string;
}

function inferSignalColor(headline: string, body: string): 'red' | 'green' | 'yellow' {
  const t = (headline + ' ' + body).toLowerCase();
  // Red signals: risk, decline, war, crash, hack, loss, inflation, shutdown
  if (/war|escalat|strike|attack|hack|breach|exploit|crash|decline|inflation|risk|shutdown|tariff|sanctions|weaponiz|broke|loss|selloff|selling/.test(t)) return 'red';
  // Green signals: growth, surge, rally, launch, breakthrough, innovation, record
  if (/surge|rally|launch|breakthrough|innovation|record|milestone|bullish|growth|restored|reversed|cleared|approval|funded/.test(t)) return 'green';
  return 'yellow';
}

function inferDomain(headline: string, body: string): string {
  const t = (headline + ' ' + body).toLowerCase();
  if (/bitcoin|btc|ethereum|eth|crypto|defi|aave|solana|protocol|blockchain|nft/.test(t)) return 'crypto · defi';
  if (/ai\b|openai|anthropic|claude|gpt|gemini|llm|model|neural|compute|gpu/.test(t)) return 'ai · tech';
  if (/geopolit|iran|china|russia|nato|war|hormuz|military|sanctions|tariff|trump|trade war/.test(t)) return 'geopolitics';
  if (/s&p|nasdaq|dow|equit|stock|market|fed|rate|yield|treasury|dollar|euro|ecb|inflation|gdp/.test(t)) return 'markets · macro';
  if (/oil|gold|brent|commodit|energy|copper|natural gas/.test(t)) return 'commodities';
  if (/quantum|encrypt|security|cyber|qubit|nist/.test(t)) return 'tech · security';
  if (/health|protein|cognitive|brain|pharma|biotech|fda/.test(t)) return 'science · health';
  return 'signal';
}

function parseSignals(content: string): SignalItem[] {
  const signals: SignalItem[] = [];
  const lines = content.split('\n');

  let currentHeadline = '';
  let currentBody = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') continue;

    // Bold standalone headline: **Title**
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      // Save previous signal
      if (currentHeadline) {
        signals.push({
          headline: currentHeadline,
          body: currentBody.trim(),
          color: inferSignalColor(currentHeadline, currentBody),
          domain: inferDomain(currentHeadline, currentBody),
        });
      }
      currentHeadline = trimmed.slice(2, -2);
      currentBody = '';
      continue;
    }

    // Body paragraph
    if (currentHeadline) {
      currentBody += (currentBody ? ' ' : '') + trimmed;
    }
  }

  // Push final signal
  if (currentHeadline) {
    signals.push({
      headline: currentHeadline,
      body: currentBody.trim(),
      color: inferSignalColor(currentHeadline, currentBody),
      domain: inferDomain(currentHeadline, currentBody),
    });
  }

  return signals;
}

// ─── Interesting Things parser ──────────────────────────────────────────────
// Same structure as signals but rendered differently

interface InterestingItem {
  headline: string;
  body: string;
}

function parseInterestingThings(content: string): InterestingItem[] {
  const items: InterestingItem[] = [];
  const lines = content.split('\n');

  let currentHeadline = '';
  let currentBody = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') continue;

    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      if (currentHeadline) {
        items.push({ headline: currentHeadline, body: currentBody.trim() });
      }
      currentHeadline = trimmed.slice(2, -2);
      currentBody = '';
      continue;
    }

    if (currentHeadline) {
      currentBody += (currentBody ? ' ' : '') + trimmed;
    }
  }

  if (currentHeadline) {
    items.push({ headline: currentHeadline, body: currentBody.trim() });
  }

  return items;
}

// ─── Meditation parser ──────────────────────────────────────────────────────

function parseMeditation(content: string): { quote: string; attribution: string; body: string } {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let quote = '';
  let attribution = '';
  const bodyLines: string[] = [];

  for (const line of lines) {
    // Pattern: *"Quote"* Author, *Source*
    // This is the most common format in the light briefs.
    // The line starts with *" and contains "* somewhere, followed by attribution text.
    const fullQuoteMatch = line.match(/^\*[""\u201C](.+?)[""\u201D]\*\s+(.+)$/);
    if (fullQuoteMatch && !quote) {
      quote = fullQuoteMatch[1] ?? '';
      // Attribution may contain italic source: "Author, *Source*"
      attribution = (fullQuoteMatch[2] ?? '').replace(/\*/g, '');
      continue;
    }

    // Simpler pattern: *"Quote"* on its own line
    if (line.startsWith('*"') && line.endsWith('"*') && !quote) {
      quote = line.slice(2, -2);
      continue;
    }

    // Standalone italic line: *text*
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && !quote) {
      const inner = line.slice(1, -1);
      quote = inner.replace(/^[""\u201C]+/, '').replace(/[""\u201D]+$/, '');
      continue;
    }

    // Attribution line starting with —
    if ((line.startsWith('—') || line.startsWith('\u2014')) && !attribution) {
      attribution = line;
      continue;
    }

    bodyLines.push(line);
  }

  return { quote, attribution, body: bodyLines.join(' ') };
}

// ─── Model parser ───────────────────────────────────────────────────────────

function parseModel(content: string): { name: string; body: string; link: string } {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let name = '';
  let link = '';
  const bodyLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      name = line.replace('### ', '');
      continue;
    }
    // Link: [→ Explore](url) or [→ Explore this model](url)
    const linkMatch = line.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (linkMatch) {
      link = linkMatch[2] ?? '';
      continue;
    }
    bodyLines.push(line);
  }

  return { name, body: bodyLines.join(' '), link };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SuperBriefViewer({ brief }: { brief: BriefLight }) {
  // Find sections by ID
  const updateSection = brief.sections.find(s => s.id === 'the-update');
  const marketsMinuteSection = brief.sections.find(s => s.id === 'markets-minute');
  const interestingSection = brief.sections.find(s => s.id === 'interesting-things');
  const meditationSection = brief.sections.find(s => s.id === 'the-meditation');
  const modelSection = brief.sections.find(s => s.id === 'the-model');

  // Parse content
  const signals = updateSection ? parseSignals(updateSection.content) : [];
  const interestingItems = interestingSection ? parseInterestingThings(interestingSection.content) : [];
  const meditation = meditationSection ? parseMeditation(meditationSection.content) : null;
  const model = modelSection ? parseModel(modelSection.content) : null;

  // Extract first signal as hero headline + TLDR
  const heroSignal = signals[0];
  const remainingSignals = signals.slice(1);

  return (
    <div className="min-h-screen">
      {/* ── 1. YELLOW HERO ──────────────────────────────────────────────── */}
      <section className="bg-ct-yellow px-4 py-4 border-b-[3px] border-ct-dark">
        <div className="max-w-lg mx-auto">
          <div className="font-mono text-[13px] font-semibold text-ct-dark mb-0.5">
            {brief.displayDate}
          </div>
          <div className="font-mono text-[11px] font-medium text-[#555] uppercase tracking-[0.08em] mb-3">
            Markets, Meditations &amp; Mental Models — Super Brief
          </div>
          {brief.epigraph && (
            <div className="font-serif italic text-[14px] text-[#333] leading-[1.5] mb-3">
              &ldquo;{brief.epigraph}&rdquo;
            </div>
          )}
          {heroSignal && (
            <>
              <h1 className="text-[18px] font-medium text-ct-dark leading-[1.25] mb-2 font-serif">
                {heroSignal.headline}
              </h1>
              <p className="text-[13px] text-[#444] leading-[1.55]">
                {heroSignal.body.split('.').slice(0, 2).join('.')}.
              </p>
            </>
          )}

          {/* Audio player */}
          <div className="mt-3">
            <SuperBriefAudioPlayer date={brief.date} />
          </div>
        </div>
      </section>

      {/* ── 2. DARK DASHBOARD — live prices ─────────────────────────────── */}
      <SuperBriefDashboard />

      {/* ── 2b. MARKETS MINUTE — compressed regime read ─────────────────── */}
      {marketsMinuteSection && (
        <section className="bg-[#0d0d0d] px-4 py-3 border-t border-[#1a1a1a]">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[9px] text-ct-yellow uppercase tracking-wider font-medium mb-2">
              Markets minute
            </div>
            <p className="text-[12px] text-[#bbb] leading-[1.6]">
              <RichText text={marketsMinuteSection.content} />
            </p>
          </div>
        </section>
      )}

      {/* ── 3. DARK SIGNALS — "Today's Signals" ─────────────────────────── */}
      <section className="bg-ct-dark px-4 py-3 border-t border-[#1a1a1a]">
        <div className="max-w-lg mx-auto">
          <div className="font-mono text-[9px] text-ct-pink uppercase tracking-wider font-medium mb-2">
            Today&apos;s signals
          </div>

          {/* All signals */}
          {signals.map((sig, i) => (
            <div
              key={i}
              className="flex gap-2 items-start py-1.5 border-b border-[#1a1a1a] last:border-0"
            >
              <div
                className={`w-[5px] h-[5px] rounded-full mt-[6px] flex-shrink-0 ${
                  sig.color === 'green'
                    ? 'bg-ct-green-data'
                    : sig.color === 'red'
                      ? 'bg-ct-pink'
                      : 'bg-ct-yellow'
                }`}
              />
              <div>
                <div className="text-[12px] text-[#ccc] leading-[1.45]">
                  <strong className="text-white font-medium">{sig.headline}.</strong>{' '}
                  {sig.body.split('.').slice(0, 2).join('.')}.
                </div>
                <div className="font-mono text-[9px] text-[#555] mt-0.5">{sig.domain}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. WARM CREAM — "Interesting Things" (replaces The Take) ───── */}
      {interestingItems.length > 0 && (
        <section className="bg-[#FFFDF0] px-4 py-4 border-t-[3px] border-ct-yellow">
          <div className="max-w-lg mx-auto">
            <div className="text-[10px] tracking-[0.06em] uppercase font-medium text-ct-dark mb-1.5">
              Interesting things
            </div>
            {interestingItems.map((item, i) => (
              <div key={i} className={i > 0 ? 'mt-4 pt-3 border-t border-[#e8e4d0]' : ''}>
                <h2 className="font-serif text-[16px] font-medium text-[#111] leading-[1.3] mb-2">
                  {item.headline}
                </h2>
                <p className="text-[13px] text-[#444] leading-[1.6]">
                  <RichText text={item.body} />
                </p>
              </div>
            ))}
            <Link
              href={`/daily-update/${brief.date}`}
              className="text-[11px] text-ct-pink font-medium mt-3 block no-underline"
            >
              More in today&apos;s full brief →
            </Link>
          </div>
        </section>
      )}

      {/* ── 5. DARK + PINK — "The Meditation" (matches Inner Game) ──────── */}
      {meditation && (
        <section className="bg-ct-dark px-4 py-5 text-center border-t-[3px] border-ct-pink">
          <div className="max-w-lg mx-auto">
            <div className="text-[10px] tracking-[0.1em] uppercase text-ct-pink font-medium mb-2">
              The meditation
            </div>
            {meditation.quote && (
              <blockquote className="font-serif italic text-[15px] text-[#ccc] leading-[1.45] max-w-[320px] mx-auto mb-1">
                &ldquo;{meditation.quote}&rdquo;
              </blockquote>
            )}
            {meditation.attribution && (
              <div className="text-[10px] text-[#555] mb-3">{meditation.attribution}</div>
            )}
            {meditation.body && (
              <p className="text-[11px] text-[#999] leading-[1.55] text-left">
                <RichText text={meditation.body} />
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── 6. MINT GREEN — "The Model" ─────────────────────────────────── */}
      {model && (
        <section className="bg-[#E8FFF5] px-4 py-3.5 border-t-[3px] border-[#00885a]">
          <div className="max-w-lg mx-auto">
            <div className="text-[9px] text-[#00885a] tracking-[0.06em] uppercase font-medium mb-1">
              Today&apos;s model
            </div>
            {model.name && (
              <div className="font-serif text-[14px] font-medium text-[#111] mb-1">
                {model.name}
              </div>
            )}
            <div className="text-[12px] text-[#444] leading-[1.45]">
              <RichText text={model.body} />
            </div>
            {model.link && (
              <Link
                href={model.link}
                className="text-[10px] text-[#00885a] font-medium mt-1.5 block no-underline"
              >
                Explore in the observatory →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── 7. YELLOW READ FULL BRIEF CTA ───────────────────────────────── */}
      <section className="bg-ct-yellow px-4 py-3 text-center border-t-[3px] border-ct-dark">
        <Link href={`/daily-update/${brief.date}`} className="text-[12px] font-medium text-ct-dark no-underline">
          Read the full brief →
        </Link>
        <div className="text-[10px] text-[#666] mt-1">
          Dashboard, all Six sections, Watchlist, Discovery, and more
        </div>
      </section>

      {/* ── 8. PINK SUBSCRIBE CTA ───────────────────────────────────────── */}
      <section className="bg-ct-pink px-4 py-4 text-center">
        <div className="max-w-lg mx-auto">
          <div className="text-[14px] font-medium text-white mb-1">Get this every morning</div>
          <div className="text-[11px] text-white/70 mb-3">Markets, meditations, mental models. Free.</div>
          <SubscribeForm
            source="super-brief"
            inputClassName="px-3 py-2 border-[1.5px] border-white bg-transparent text-white text-[12px] w-[200px] placeholder-white/50"
            buttonClassName="px-4 py-2 bg-white text-ct-pink text-[12px] font-medium border-[1.5px] border-white"
            showNote={false}
          />
        </div>
      </section>

      {/* ── 9. FOOTER ───────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
