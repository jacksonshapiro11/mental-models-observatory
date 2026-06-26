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

// Split a section's content into paragraphs (blank-line separated) for the ideas-first layout.
function toParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map(p => p.replace(/\n+/g, ' ').trim())
    .filter(Boolean);
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

    // A new item begins at a bold headline at the START of a line. Handles BOTH
    // "**Headline**" alone on its line (the ideas format) AND "**Headline.** body on
    // the same line" (the format the generator uses for Two Things Worth Knowing).
    // The old version only matched the own-line form, so Two Things parsed to zero
    // items and the whole section silently failed to render.
    const headlineMatch = trimmed.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (headlineMatch && headlineMatch[1] && !headlineMatch[1].includes('**')) {
      if (currentHeadline) {
        items.push({ headline: currentHeadline, body: currentBody.trim() });
      }
      currentHeadline = headlineMatch[1].trim();
      currentBody = headlineMatch[2] ? headlineMatch[2].trim() : '';
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

function parseMeditation(content: string): { quote: string; attribution: string; before: string; after: string } {
  const paras = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  let quote = '';
  let attribution = '';
  let quoteIdx = -1;

  for (let idx = 0; idx < paras.length; idx++) {
    const lines = paras[idx]!.split('\n').map(l => l.trim()).filter(Boolean);
    const first = lines[0] ?? '';
    const m = first.match(/^\*["“”](.+?)["“”]\*\s*(.*)$/);
    if (m) {
      quote = m[1] ?? '';
      let attr = (m[2] ?? '').trim();
      if (!attr && lines[1]) attr = lines[1];
      attribution = attr.replace(/^[–—-]\s*/, '').replace(/\*/g, '').trim();
      quoteIdx = idx;
      break;
    }
  }

  const before: string[] = [];
  const after: string[] = [];
  paras.forEach((p, idx) => {
    if (quoteIdx < 0 || idx > quoteIdx) after.push(p);
    else if (idx < quoteIdx) before.push(p);
  });

  return { quote, attribution, before: before.join('\n\n'), after: after.join('\n\n') };
}

// ─── Model parser ───────────────────────────────────────────────────────────

// The Model is the day's deep "keeper": a named model with a vivid example, the
// mechanism (why), a bolded "Use it" takeaway, and an Explore link. Paragraph-aware.
function parseModel(content: string): { name: string; body: string; useIt: string; link: string } {
  const paras = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  let name = '';
  let link = '';
  let useIt = '';
  const bodyParas: string[] = [];

  for (const para of paras) {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines[0]?.startsWith('### ')) {                              // ### Name: the angle
      name = lines[0].replace(/^###\s+/, '');
      const rest = lines.slice(1).join(' ').trim();
      if (rest) bodyParas.push(rest);
      continue;
    }
    if (/^\*\*\s*use it/i.test(para)) { useIt = para; continue; }    // **Use it:** takeaway
    const onlyLink = para.match(/^\*{0,2}\[([^\]]*)\]\(([^)]+)\)\*{0,2}$/);
    if (onlyLink) { link = onlyLink[2] ?? ''; continue; }            // a paragraph that is just the link
    const inlineLink = para.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (inlineLink && !link) link = inlineLink[2] ?? '';
    bodyParas.push(para);
  }

  return { name, body: bodyParas.join('\n\n'), useIt, link };
}

// ─── Ideas parser ───────────────────────────────────────────────────────────
// Ideas-first ideas may arrive as a single "## ▸ THE IDEAS" block with bold
// headlines, OR as separate "## ▸ THE IDEA: <title>" sections. Normalize to cards.
function buildIdeaCards(ideaSections: { content: string; title?: string }[]): { headline: string; body: string }[] {
  const cards: { headline: string; body: string }[] = [];
  for (const sec of ideaSections) {
    const items = parseInterestingThings(sec.content); // bold-headline + body items, if any
    if (items.length > 0) {
      for (const it of items) cards.push({ headline: it.headline, body: it.body });
    } else {
      cards.push({ headline: sec.title || '', body: sec.content });
    }
  }
  return cards;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SuperBriefViewer({ brief }: { brief: BriefLight }) {
  // Find sections by ID
  const updateSection = brief.sections.find(s => s.id === 'the-update');     // legacy selection format
  const ideaSections = brief.sections.filter(s => s.id === 'the-idea');      // ideas-first format
  const alsoMovingSection = brief.sections.find(s => s.id === 'also-moving');
  const marketsMinuteSection = brief.sections.find(s => s.id === 'markets-minute');
  const interestingSection = brief.sections.find(s => s.id === 'interesting-things');
  const meditationSection = brief.sections.find(s => s.id === 'the-meditation');
  const modelSection = brief.sections.find(s => s.id === 'the-model');
  const closeSection = brief.sections.find(s => s.id === 'the-close');   // sign-off — parsed but previously never rendered

  // Parse content
  const signals = updateSection ? parseSignals(updateSection.content) : [];
  const interestingItems = interestingSection ? parseInterestingThings(interestingSection.content) : [];
  const meditation = meditationSection ? parseMeditation(meditationSection.content) : null;
  const model = modelSection ? parseModel(modelSection.content) : null;
  // Ideas-first puts the model name inline in the header ("THE MODEL: <name>") — captured as the section title.
  if (model && !model.name && modelSection?.title) model.name = modelSection.title;
  const ideaCards = buildIdeaCards(ideaSections);  // one card per idea, from either format

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
          {brief.dailyTitle && (
            <h1 className="text-[22px] font-medium text-ct-dark leading-[1.2] mb-2 font-serif">
              {brief.dailyTitle}
            </h1>
          )}
          {brief.epigraph && (
            <div className="font-serif italic text-[14px] text-[#333] leading-[1.5] mb-3">
              &ldquo;{brief.epigraph}&rdquo;
            </div>
          )}
          {brief.lede && (
            <p className="text-[13px] text-[#444] leading-[1.55] italic mb-2">
              <RichText text={brief.lede} />
            </p>
          )}

          {/* Audio player */}
          <div className="mt-3">
            <SuperBriefAudioPlayer date={brief.date} />
          </div>
        </div>
      </section>

      {/* ── 2. DARK DASHBOARD — live prices ─────────────────────────────── */}
      <SuperBriefDashboard />

      {/* ── 2a. THE IDEAS — ideas-first lead (the day's biggest ideas) ───── */}
      {ideaCards.length > 0 && (
        <section className="bg-white px-4 py-4 border-t-[3px] border-ct-dark">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[10px] text-ct-pink uppercase tracking-wider font-medium mb-3">
              The ideas
            </div>
            {ideaCards.map((idea, i) => (
              <div key={i} className={i > 0 ? 'mt-5 pt-4 border-t border-[#eee]' : ''}>
                {idea.headline && (
                  <h2 className="font-serif text-[18px] font-medium text-[#111] leading-[1.3] mb-2">
                    {idea.headline}
                  </h2>
                )}
                {toParagraphs(idea.body).map((para, j) => (
                  <p key={j} className="text-[13px] text-[#1a1a1a] font-medium leading-[1.6] mb-2 last:mb-0">
                    <RichText text={para} />
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 2a2. ALSO MOVING — ideas-first secondary ────────────────────── */}
      {alsoMovingSection && (
        <section className="bg-[#FAFAFA] px-4 py-3 border-t border-[#e5e5e5]">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[9px] text-[#888] uppercase tracking-wider font-medium mb-1.5">
              Also moving
            </div>
            {toParagraphs(alsoMovingSection.content).map((para, j) => (
              <p key={j} className="text-[12px] text-[#3a3a3a] font-medium leading-[1.6] mb-1.5 last:mb-0">
                <RichText text={para} />
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── 2c. MARKETS MINUTE — market-state read, after the ideas ─────── */}
      {marketsMinuteSection && (
        <section className="bg-ct-pink px-4 py-4 border-t-[3px] border-ct-dark">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[9px] text-white/75 uppercase tracking-wider font-medium mb-2">
              Markets minute
            </div>
            <p className="text-[13px] text-white leading-[1.65] font-medium">
              <RichText text={marketsMinuteSection.content} />
            </p>
          </div>
        </section>
      )}

      {/* ── 3. DARK SIGNALS — "Today's Signals" (legacy selection format only) ─ */}
      {signals.length > 0 && (
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
                  <strong className="text-white font-medium"><RichText text={sig.headline} /></strong>{' '}
                  <RichText text={sig.body} />
                </div>
                <div className="font-mono text-[9px] text-[#555] mt-0.5">{sig.domain}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

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
                <p className="text-[13px] text-[#1a1a1a] font-medium leading-[1.6]">
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
        <section className="bg-ct-dark px-4 py-5 border-t-[3px] border-ct-pink">
          <div className="max-w-lg mx-auto">
            <div className="text-[10px] tracking-[0.1em] uppercase text-ct-pink font-medium mb-3 text-center">
              The meditation
            </div>
            {meditation.before && toParagraphs(meditation.before).map((para, i) => (
              <p key={`mb-${i}`} className="text-[12px] text-[#cfcfcf] font-medium leading-[1.6] mb-3">
                <RichText text={para} />
              </p>
            ))}
            {meditation.quote && (
              <blockquote className="font-serif italic text-[16px] text-[#f0f0f0] leading-[1.45] max-w-[340px] mx-auto mt-1 mb-1 text-center">
                &ldquo;{meditation.quote}&rdquo;
              </blockquote>
            )}
            {meditation.attribution && (
              <div className="text-[10px] text-[#888] mb-4 text-center">{meditation.attribution}</div>
            )}
            {meditation.after && toParagraphs(meditation.after).map((para, i) => (
              <p key={`ma-${i}`} className="text-[12px] text-[#cfcfcf] font-medium leading-[1.6] mb-3 last:mb-0">
                <RichText text={para} />
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── 6. MINT — "The Model" — the day's deep keeper ───────────────── */}
      {model && (
        <section className="bg-[#E8FFF5] px-4 py-5 border-t-[3px] border-[#00885a]">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[10px] text-[#00885a] tracking-wider uppercase font-medium mb-2">
              The model
            </div>
            {model.name && (
              <h2 className="font-serif text-[19px] font-medium text-[#111] leading-[1.3] mb-3">
                {model.name}
              </h2>
            )}
            {model.body && toParagraphs(model.body).map((para, i) => (
              <p key={`mo-${i}`} className="text-[13px] text-[#1a1a1a] font-medium leading-[1.6] mb-2.5">
                <RichText text={para} />
              </p>
            ))}
            {model.useIt && (
              <div className="bg-[#D6F5E8] border-l-[3px] border-[#00885a] px-3 py-2.5 mt-1 text-[13px] text-[#1a1a1a] leading-[1.6]">
                <RichText text={model.useIt} />
              </div>
            )}
            {model.link && (
              <Link
                href={model.link}
                className="text-[11px] text-[#00885a] font-medium mt-3 inline-block no-underline"
              >
                Explore this model →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── 6.5 DARK — "The Close" — the day's human sign-off ───────────── */}
      {closeSection && closeSection.content.trim() && (
        <section className="bg-ct-dark px-4 py-7 border-t-[3px] border-ct-dark">
          <div className="max-w-lg mx-auto">
            <div className="font-mono text-[10px] text-ct-yellow tracking-wider uppercase font-medium mb-3">
              The close
            </div>
            {toParagraphs(closeSection.content).map((para, i) => (
              <p key={`cl-${i}`} className="font-serif text-[17px] text-[#F5F1E8] leading-[1.55] mb-3 last:mb-0">
                <RichText text={para} />
              </p>
            ))}
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
