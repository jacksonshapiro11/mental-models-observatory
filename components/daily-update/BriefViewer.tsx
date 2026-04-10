'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DailyBrief, BriefSection } from '@/lib/daily-update-parser';
import LiveDashboard from '@/components/dashboard/LiveDashboard';
import { MobileKPICards } from '@/components/dashboard/MobileKPICards';
import AudioPlayer from '@/components/daily-update/AudioPlayer';
import { TickerBar } from '@/components/landing/TickerBar';
import { SectionVote } from '@/components/daily-update/SectionVote';

// ─── Status badge system ─────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  accelerating: { bg: 'bg-ct-dark', text: 'text-ct-pink', border: 'border-ct-pink' },
  developing:   { bg: 'bg-ct-dark', text: 'text-ct-yellow', border: 'border-ct-yellow' },
  elevated:     { bg: 'bg-ct-dark', text: 'text-ct-pink', border: 'border-ct-pink' },
  new:          { bg: 'bg-ct-dark', text: 'text-ct-yellow', border: 'border-ct-yellow' },
  watching:     { bg: 'bg-ct-dark', text: 'text-ct-green-data', border: 'border-ct-green-data' },
  building:     { bg: 'bg-ct-dark', text: 'text-ct-green-data', border: 'border-ct-green-data' },
};

function inferStatus(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('(new)') || t.includes('— new')) return 'new';
  if (t.includes('accelerating') || t.includes('deepening') || t.includes('surging')) return 'accelerating';
  if (t.includes('elevated') || t.includes('war') || t.includes('risk') || t.includes('shutdown') || t.includes('violence')) return 'elevated';
  if (t.includes('building') || t.includes('industrialization') || t.includes('renaissance')) return 'building';
  if (t.includes('watching') || t.includes('stalled')) return 'watching';
  return 'developing';
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.developing!;
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded border font-mono ${s.bg} ${s.text} ${s.border}`}>
      {status}
    </span>
  );
}

// ─── Markdown rendering helpers ──────────────────────────────────────────────

function RichText({ text, className = '', onAnchorClick }: { text: string; className?: string; onAnchorClick?: (id: string) => void }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[([^\]]+?)\]\(([^)]+?)\)/);

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) { parts.push(remaining); break; }

    const first = matches[0]!;
    if (first.index > 0) parts.push(remaining.slice(0, first.index));

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold"><RichText text={first.match![1] ?? ''} {...(onAnchorClick ? { onAnchorClick } : {})} /></strong>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} className="italic"><RichText text={first.match![1] ?? ''} {...(onAnchorClick ? { onAnchorClick } : {})} /></em>);
    } else if (first.type === 'code') {
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded text-[0.9em] font-mono">{first.match![1]}</code>);
    } else if (first.type === 'link') {
      const linkText = first.match![1] ?? '';
      const linkHref = first.match![2] ?? '';
      if (linkHref.startsWith('#') && onAnchorClick) {
        // Internal anchor link — use scrollToSection
        const sectionId = linkHref.slice(1);
        parts.push(
          <a key={key++} href={linkHref} onClick={(e) => { e.preventDefault(); onAnchorClick(sectionId); }}
            className="text-ct-pink hover:text-ct-yellow underline cursor-pointer">{linkText}</a>
        );
      } else {
        // External link
        parts.push(
          <a key={key++} href={linkHref} target="_blank" rel="noopener noreferrer"
            className="text-ct-pink hover:text-ct-yellow underline">{linkText}</a>
        );
      }
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return <span className={className}>{parts}</span>;
}

function MarkdownTable({ content }: { content: string }) {
  const lines = content.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(cell => cell.trim());

  const headers = parseRow(lines[0]!);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 mb-5 rounded-sm border border-text-muted/30">
      <table className="w-full text-sm border-collapse min-w-[600px] font-mono">
        <thead>
          <tr className="bg-surface-warm border-b border-text-muted/20">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-text-muted/10 hover:bg-surface-warm/50 transition-colors">
              {row.map((cell, ci) => {
                const isNeg = cell.startsWith('-') && cell.includes('%');
                const isPos = cell.startsWith('+') && cell.includes('%');
                return (
                  <td key={ci} className={`py-2.5 px-3 text-sm ${
                    ci === 0 ? 'font-semibold text-text-primary' :
                    isNeg ? 'text-ct-pink' :
                    isPos ? 'text-ct-green-data' :
                    'text-text-secondary'
                  }`}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Safe line accessor
function ln(lines: string[], idx: number): string {
  return lines[idx] ?? '';
}

// Parse a markdown section into blocks
function parseBlocks(content: string): { type: string; content: string }[] {
  const blocks: { type: string; content: string }[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = ln(lines, i).trim();
    if (!line) { i++; continue; }

    if (line.startsWith('|')) {
      let tableContent = '';
      while (i < lines.length && ln(lines, i).trim().startsWith('|')) {
        tableContent += ln(lines, i) + '\n'; i++;
      }
      blocks.push({ type: 'table', content: tableContent.trim() }); continue;
    }
    if (line.startsWith('## ')) { blocks.push({ type: 'h2', content: line.replace('## ', '') }); i++; continue; }
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', content: line.replace('### ', '') }); i++; continue; }

    if (line.startsWith('- ')) {
      let listContent = '';
      while (i < lines.length && ln(lines, i).trim().startsWith('- ')) {
        listContent += ln(lines, i).trim() + '\n'; i++;
      }
      blocks.push({ type: 'list', content: listContent.trim() }); continue;
    }

    if (/^\d+\.\s/.test(line)) {
      let listContent = '';
      while (i < lines.length && /^\d+\.\s/.test(ln(lines, i).trim())) {
        listContent += ln(lines, i).trim() + '\n';
        const nextLine = () => ln(lines, i + 1).trim();
        while (i + 1 < lines.length && nextLine() && !nextLine().startsWith('|') && !/^\d+\.\s/.test(nextLine()) && !nextLine().startsWith('#') && !nextLine().startsWith('- ') && !nextLine().startsWith('---')) {
          i++; listContent += ' ' + ln(lines, i).trim();
        }
        listContent += '\n'; i++;
      }
      blocks.push({ type: 'numbered-list', content: listContent.trim() }); continue;
    }

    if (line === '---') { i++; continue; }

    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push({ type: 'italic', content: line.slice(1, -1) }); i++; continue;
    }

    let para = line; i++;
    while (i < lines.length && ln(lines, i).trim() && !ln(lines, i).trim().startsWith('|') && !ln(lines, i).trim().startsWith('#') && !ln(lines, i).trim().startsWith('- ') && !/^\d+\.\s/.test(ln(lines, i).trim()) && ln(lines, i).trim() !== '---') {
      para += '\n' + ln(lines, i).trim(); i++;
    }
    blocks.push({ type: 'paragraph', content: para });
  }
  return blocks;
}

// ─── Section Renderers ───────────────────────────────────────────────────────

function DashboardSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.type === 'h3') return (
          <h3 key={i} className="text-[10px] font-bold text-ct-yellow uppercase tracking-[0.06em] mt-10 first:mt-0 flex items-center gap-2 font-mono">
            <span className="w-4 h-px bg-ct-yellow" />
            {block.content}
          </h3>
        );
        if (block.type === 'table') return <MarkdownTable key={i} content={block.content} />;
        if (block.type === 'italic') return (
          <p key={i} className="text-sm text-text-secondary leading-[1.6] italic pl-3 border-l-[3px] border-ct-yellow">
            <RichText text={block.content} />
          </p>
        );
        return (
          <p key={i} className="text-sm text-text-secondary font-mono leading-[1.6]">
            <RichText text={block.content} />
          </p>
        );
      })}
    </div>
  );
}

// ─── HIGH-RHYTHM SIX: each subsection gets its own background ───────────────
//
// The Six is one big markdown section with h2 headings splitting it into
// Markets & Macro, Companies & Crypto, AI & Tech, Geopolitics, Wild Card, The Signal.
// The updated spec says these should alternate backgrounds for visual rhythm.

const SIX_SUBSECTION_STYLES: Record<string, {
  bg: string; border: string; borderStyle?: React.CSSProperties; tag: string;
  hlColor: string; bodyColor: string; divider: string; listBorder: string;
}> = {
  'markets': {
    bg: 'bg-white', border: 'border-t-[3px] border-ct-dark',
    tag: 'text-ct-dark', hlColor: 'text-text-primary', bodyColor: 'text-text-secondary',
    divider: 'border-[#f0f0ec]', listBorder: 'border-text-muted/20',
  },
  'crypto': {
    bg: 'bg-ct-dark', border: 'border-t-2 border-ct-yellow',
    tag: 'text-ct-yellow', hlColor: 'text-[#fff]', bodyColor: 'text-[#aaa]',
    divider: 'border-[#333]', listBorder: 'border-[#333]',
  },
  'ai': {
    bg: 'bg-ct-yellow', border: '',
    borderStyle: { borderTop: '3px solid #FF2E63', borderBottom: '3px solid #00885a' },
    tag: 'text-ct-dark', hlColor: 'text-ct-dark', bodyColor: 'text-[#444]',
    divider: 'border-black/10', listBorder: 'border-black/15',
  },
  'geopolitics': {
    bg: 'bg-white', border: 'border-t border-[#e8e8e4]',
    tag: 'text-ct-dark', hlColor: 'text-text-primary', bodyColor: 'text-text-secondary',
    divider: 'border-[#f0f0ec]', listBorder: 'border-text-muted/20',
  },
  'wildcard': {
    bg: 'bg-[#F8F8F4]', border: 'border-t-2 border-ct-pink',
    tag: 'text-ct-pink', hlColor: 'text-text-primary', bodyColor: 'text-text-secondary',
    divider: 'border-[#e8e8e4]', listBorder: 'border-text-muted/20',
  },
  'signal': {
    bg: 'bg-ct-dark', border: 'border-t-2 border-ct-green-data',
    tag: 'text-ct-green-data', hlColor: 'text-[#fff]', bodyColor: 'text-[#aaa]',
    divider: 'border-[#333]', listBorder: 'border-[#333]',
  },
};

function classifySubsection(heading: string): string {
  const h = heading.toLowerCase();
  if (h.includes('wild card') || h.includes('wildcard')) return 'wildcard';
  if (h.includes('signal')) return 'signal';
  if (h.includes('market') || h.includes('macro')) return 'markets';
  if (h.includes('crypto') || h.includes('companies')) return 'crypto';
  if (h.includes('ai') || h.includes('tech')) return 'ai';
  if (h.includes('geopolit')) return 'geopolitics';
  return 'markets'; // fallback
}

function TheSixSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  // Split blocks into subsections by h2
  const subsections: { heading: string; blocks: { type: string; content: string }[] }[] = [];
  let currentSubsection: { heading: string; blocks: { type: string; content: string }[] } | null = null;

  for (const block of blocks) {
    if (block.type === 'h2') {
      if (currentSubsection) subsections.push(currentSubsection);
      currentSubsection = { heading: block.content, blocks: [] };
    } else if (currentSubsection) {
      currentSubsection.blocks.push(block);
    }
    // blocks before the first h2 are ignored (shouldn't happen)
  }
  if (currentSubsection) subsections.push(currentSubsection);

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
      {subsections.map((sub, si) => {
        const styleKey = classifySubsection(sub.heading);
        const s = SIX_SUBSECTION_STYLES[styleKey] || SIX_SUBSECTION_STYLES['markets']!;

        return (
          <div key={si} className={`${s.bg} ${s.border} px-4 py-4`} style={s.borderStyle}>
            <div className="max-w-5xl mx-auto">
              {/* Subsection heading */}
              <div className={`text-sm sm:text-base tracking-[0.06em] uppercase font-bold font-mono mb-4 ${s.tag}`}>
                {sub.heading}
              </div>

              {/* Subsection content */}
              <div className="space-y-4">
                {sub.blocks.map((block, bi) => {
                  if (block.type === 'list') {
                    const items = block.content.split('\n').filter(Boolean);
                    return (
                      <div key={bi} className="space-y-0">
                        {items.map((item, j) => {
                          const stripped = item.replace(/^- /, '');
                          const hlMatch = stripped.match(/^\*\*(.+?)\*\*\s*([\s\S]*)/);
                          return (
                            <div key={j} className={`py-3 border-b ${s.divider} last:border-b-0`}>
                              {hlMatch ? (
                                <p className={`text-[13px] leading-[1.65] ${s.bodyColor}`}>
                                  <strong className={`font-semibold ${s.hlColor}`}>{hlMatch[1]}</strong>{' '}
                                  <RichText text={hlMatch[2] ?? ''} />
                                </p>
                              ) : (
                                <p className={`text-[13px] leading-[1.65] ${s.bodyColor}`}>
                                  <RichText text={stripped} />
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  if (block.type === 'italic') return (
                    <p key={bi} className={`text-sm leading-[1.6] italic ${styleKey === 'crypto' ? 'text-[#666]' : 'text-text-muted'}`}>
                      <RichText text={block.content} />
                    </p>
                  );
                  if (block.type === 'paragraph') return (
                    <p key={bi} className={`text-sm leading-[1.6] ${s.bodyColor}`}>
                      <RichText text={block.content} />
                    </p>
                  );
                  return null;
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TheTakeSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.type === 'h3') return (
          <h3 key={i} className="text-xl font-serif font-bold text-text-primary mb-3 leading-tight">
            {block.content}
          </h3>
        );
        if (block.type === 'italic') return (
          <div key={i} className="bg-[#F8F4E0] border-l-[3px] border-ct-yellow px-4 py-3 rounded-sm">
            <p className="text-sm text-text-secondary leading-[1.65] italic">
              <RichText text={block.content} />
            </p>
          </div>
        );
        return (
          <p key={i} className="text-sm text-text-secondary leading-[1.65]">
            <RichText text={block.content} />
          </p>
        );
      })}
    </div>
  );
}

// ─── INNER GAME: quote detection, centered layout, action box ────────────────

function InnerGameSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  // Classify blocks: find quote (italic with quotes), attribution (line after quote),
  // action block (starts with "Today's action:" or "Today's practice:"), and body paragraphs
  const elements: { type: 'body' | 'quote' | 'attribution' | 'action'; content: string }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const text = block.content.trim();

    // Detect quote: italic block containing quotation marks
    if (block.type === 'italic' && (text.startsWith('"') || text.startsWith('\u201C'))) {
      elements.push({ type: 'quote', content: text });
      // Next non-empty block is likely attribution
      const next = blocks[i + 1];
      if (next && (next.type === 'paragraph' || next.type === 'italic') &&
          (next.content.startsWith('—') || next.content.startsWith('\u2014') ||
           next.content.match(/^[A-Z][a-z]+ [A-Z]/))) {
        elements.push({ type: 'attribution', content: next.content });
        i++; // skip the attribution block
      }
      continue;
    }

    // Detect action block: paragraph starting with bold "Today's action/practice:"
    if (block.type === 'paragraph' && /^\*\*Today's (action|practice):/.test(text)) {
      elements.push({ type: 'action', content: text });
      continue;
    }

    // Everything else is body
    elements.push({ type: 'body', content: text });
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {elements.map((el, i) => {
        if (el.type === 'quote') return (
          <blockquote key={i} className="font-serif text-xl font-semibold italic leading-snug text-text-primary text-center px-4 py-4">
            <RichText text={el.content} />
          </blockquote>
        );
        if (el.type === 'attribution') return (
          <p key={i} className="text-sm text-ct-pink text-center font-medium -mt-4">
            <RichText text={el.content} />
          </p>
        );
        if (el.type === 'action') return (
          <div key={i} className="border border-ct-pink px-4 py-3 mt-4 text-left">
            <div className="text-[10px] font-mono font-bold text-ct-pink uppercase tracking-[0.06em] mb-2">
              Today&apos;s Action
            </div>
            <p className="text-sm text-text-secondary leading-[1.65]">
              <RichText text={el.content.replace(/^\*\*Today's (action|practice):\*\*\s*/i, '')} />
            </p>
          </div>
        );
        // Body paragraph
        return (
          <p key={i} className="text-sm text-text-secondary leading-[1.7] text-center">
            <RichText text={el.content} />
          </p>
        );
      })}
    </div>
  );
}

// ─── DISCOVERY: title, body, decision tool callout, source citation ──────────

function DiscoverySectionRenderer({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  const elements: { type: 'title' | 'body' | 'callout' | 'source'; content: string }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const text = block.content.trim();

    // h3 = title
    if (block.type === 'h3') {
      elements.push({ type: 'title', content: text });
      continue;
    }

    // Detect decision tool / application callout
    if (block.type === 'paragraph' && /^Decision tool:/i.test(text)) {
      elements.push({ type: 'callout', content: text });
      continue;
    }

    // Detect source citation: italic block in parentheses at end
    if (block.type === 'italic' && text.startsWith('(') && text.endsWith(')')) {
      elements.push({ type: 'source', content: text });
      continue;
    }

    // Everything else is body
    elements.push({ type: 'body', content: text });
  }

  return (
    <div className="space-y-5">
      {elements.map((el, i) => {
        if (el.type === 'title') return (
          <h3 key={i} className="text-xl font-serif font-bold text-text-primary leading-tight">
            {el.content}
          </h3>
        );
        if (el.type === 'callout') return (
          <div key={i} className="bg-[#00885a]/10 border border-[#00885a]/20 px-4 py-3 rounded-sm">
            <p className="text-sm leading-[1.65] text-text-secondary">
              <strong className="text-[#00885a] font-semibold">Decision tool:</strong>{' '}
              <RichText text={el.content.replace(/^Decision tool:\s*/i, '')} />
            </p>
          </div>
        );
        if (el.type === 'source') return (
          <p key={i} className="text-xs text-text-muted italic leading-[1.6]">
            {el.content}
          </p>
        );
        return (
          <p key={i} className="text-sm text-text-secondary leading-[1.65]">
            <RichText text={el.content} />
          </p>
        );
      })}
    </div>
  );
}

// ─── THE MODEL: mechanism/sizing/failure structure + test callout ─────────────

function TheModelSection({ content, darkBg = false }: { content: string; darkBg?: boolean }) {
  const blocks = parseBlocks(content);

  const bodyColor = darkBg ? 'text-[#aaa]' : 'text-text-secondary';
  const headColor = darkBg ? 'text-[#fff]' : 'text-text-primary';
  const mutedColor = darkBg ? 'text-[#888]' : 'text-text-muted';
  const calloutBg = darkBg ? 'bg-ct-yellow/10 border-ct-yellow/20' : 'bg-ct-yellow/10 border-ct-yellow/20';
  const calloutStrong = darkBg ? 'text-ct-yellow' : 'text-ct-dark';
  const linkColor = darkBg ? 'text-ct-yellow' : 'text-ct-pink';
  const wrapperClass = darkBg ? 'dark-section-text' : 'light-section-text';

  const elements: { type: 'title' | 'body' | 'callout' | 'link' | 'italic'; content: string }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const text = block.content.trim();

    if (block.type === 'h3') {
      elements.push({ type: 'title', content: text });
      continue;
    }

    // Detect "The test:" or "the test:" callout (italic block)
    if (block.type === 'italic' && /^The test:/i.test(text)) {
      elements.push({ type: 'callout', content: text });
      continue;
    }

    // Detect model link "→ Explore this model"
    if (block.type === 'paragraph' && text.includes('Explore this model')) {
      elements.push({ type: 'link', content: text });
      continue;
    }

    if (block.type === 'italic') {
      elements.push({ type: 'italic', content: text });
      continue;
    }

    elements.push({ type: 'body', content: text });
  }

  return (
    <div className={`space-y-5 ${wrapperClass}`}>
      {elements.map((el, i) => {
        if (el.type === 'title') return (
          <h3 key={i} className={`text-xl font-serif font-bold ${headColor} leading-tight`}>
            {el.content}
          </h3>
        );
        if (el.type === 'callout') return (
          <div key={i} className={`${calloutBg} border px-4 py-3 rounded-sm`}>
            <p className={`text-sm leading-[1.65] ${bodyColor} italic`}>
              <RichText text={el.content} />
            </p>
          </div>
        );
        if (el.type === 'link') return (
          <p key={i}>
            <RichText text={el.content} className={`text-sm font-mono ${linkColor} underline`} />
          </p>
        );
        if (el.type === 'italic') return (
          <p key={i} className={`text-sm ${mutedColor} italic leading-[1.6]`}>
            <RichText text={el.content} />
          </p>
        );
        return (
          <p key={i} className={`text-sm ${bodyColor} leading-[1.65]`}>
            <RichText text={el.content} />
          </p>
        );
      })}
    </div>
  );
}

// ─── ASSET SPOTLIGHT: thesis subsections with bold labels ─────────────────────

function AssetSpotlightSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-5 light-section-text">
      {blocks.map((block, i) => {
        if (block.type === 'h3') return (
          <h3 key={i} className="text-lg font-serif font-bold text-text-primary leading-tight">
            {block.content}
          </h3>
        );
        if (block.type === 'italic') return (
          <p key={i} className="text-xs text-text-muted italic leading-[1.6]">
            <RichText text={block.content} />
          </p>
        );
        // Paragraphs — detect bold label pattern like "**Why now:**"
        const labelMatch = block.content.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
        if (labelMatch) {
          return (
            <div key={i} className="py-2 border-b border-text-muted/10 last:border-0">
              <p className="text-sm text-text-secondary leading-[1.65]">
                <strong className="text-text-primary font-semibold">{labelMatch[1]}:</strong>{' '}
                <RichText text={labelMatch[2] ?? ''} />
              </p>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-text-secondary leading-[1.65]">
            <RichText text={block.content} />
          </p>
        );
      })}
    </div>
  );
}

function BigStoriesSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const stories: { title: string; body: string }[] = [];
  let currentTitle = '';
  let currentBody = '';
  let skippedFirstItalic = false;

  for (const block of blocks) {
    // Skip the first italic block — it's the section intro that the markdown already provides
    if (block.type === 'italic' && !skippedFirstItalic) {
      skippedFirstItalic = true;
      continue;
    }
    if (block.type === 'h3') {
      if (currentTitle) stories.push({ title: currentTitle, body: currentBody.trim() });
      currentTitle = block.content;
      currentBody = '';
    } else if (block.type === 'italic' && block.content.startsWith('Remaining Big Stories')) {
      if (currentTitle) stories.push({ title: currentTitle, body: currentBody.trim() });
      currentTitle = '';
      stories.push({ title: '__remaining__', body: block.content });
    } else {
      currentBody += block.content + '\n\n';
    }
  }
  if (currentTitle) stories.push({ title: currentTitle, body: currentBody.trim() });

  return (
    <div className="space-y-4">
      {stories.map((story, i) => {
        if (story.title === '__remaining__') return (
          <p key={i} className="text-xs text-text-muted italic mt-6 pt-4 border-t-[0.5px] border-text-muted/20">
            <RichText text={story.body} />
          </p>
        );

        // Extract number and clean title for status inference
        const numMatch = story.title.match(/^(\d+)\.\s*(.*)/);
        const num = numMatch ? numMatch[1] ?? '' : '';
        const cleanTitle = numMatch ? (numMatch[2] ?? '') : story.title;
        const status = inferStatus(cleanTitle);

        return (
          <div key={i} className="p-4 bg-white border-[0.5px] border-text-muted/20">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="text-base font-bold text-text-primary leading-snug">
                {num && <span className="text-ct-yellow font-mono mr-1.5">{num}.</span>}
                {cleanTitle}
              </h4>
              <StatusBadge status={status} />
            </div>
            <div className="space-y-2">
              {story.body.split('\n').filter(Boolean).map((p, j) => (
                <p key={j} className="text-sm text-text-secondary leading-[1.6]">
                  <RichText text={p} />
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TomorrowsHeadlinesSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const items: { title: string; body: string }[] = [];
  let currentTitle = '';
  let currentBody = '';
  let skippedFirstItalic = false;

  for (const block of blocks) {
    if (block.type === 'italic' && !skippedFirstItalic) {
      skippedFirstItalic = true; continue;
    }
    if (block.type === 'h3') {
      if (currentTitle) items.push({ title: currentTitle, body: currentBody.trim() });
      currentTitle = block.content; currentBody = '';
    } else if (block.type === 'italic' && block.content.includes('Full reference list')) {
      if (currentTitle) items.push({ title: currentTitle, body: currentBody.trim() });
      currentTitle = '';
    } else {
      currentBody += block.content + '\n\n';
    }
  }
  if (currentTitle) items.push({ title: currentTitle, body: currentBody.trim() });

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="p-4 bg-white border-[0.5px] border-text-muted/20">
          <h4 className="text-base font-bold text-text-primary mb-3 leading-snug">{item.title}</h4>
          <div className="space-y-2">
            {item.body.split('\n').filter(Boolean).map((p, j) => (
              <p key={j} className="text-sm text-text-secondary leading-[1.6]">
                <RichText text={p} />
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WatchlistSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const items: { content: string; isUpdate?: boolean }[] = [];
  let current = '';
  let skippedFirstItalic = false;

  for (const block of blocks) {
    if (block.type === 'italic' && !skippedFirstItalic) {
      skippedFirstItalic = true; continue;
    }
    // New item starts with a heading (### Ticker) or a bold paragraph with em-dash (** Ticker — )
    const isNewItem = (block.type === 'h3') ||
      (block.type === 'paragraph' && block.content.startsWith('**') && block.content.includes('—'));
    if (isNewItem) {
      if (current) items.push({ content: current.trim() });
      current = block.content + '\n';
    } else {
      current += block.content + '\n';
    }
  }
  if (current) items.push({ content: current.trim() });

  // Post-process: split "Updates" blocks that have multiple tickers jammed into one paragraph.
  // Pattern: **Updates:** **TICKER (~$XX)** — text. **TICKER2 (~$YY)** — text.
  const processedItems: { content: string; isUpdate?: boolean }[] = [];
  for (const item of items) {
    const firstLine = item.content.split('\n')[0] ?? '';
    if (firstLine.startsWith('**Updates') || firstLine.startsWith('**Update')) {
      // Split on bold ticker patterns: **TICKER (~$XX)** — or **TICKER** —
      const text = item.content.replace(/^\*\*Updates?:?\*\*\s*/i, '');
      // Split where a new bold ticker starts (look for **UPPERCASE at word boundary)
      const tickerParts = text.split(/(?=\*\*[A-Z]{2,}[\s(])/).filter(s => s.trim());
      if (tickerParts.length > 1) {
        for (const part of tickerParts) {
          processedItems.push({ content: part.trim(), isUpdate: true });
        }
      } else {
        processedItems.push({ content: item.content, isUpdate: true });
      }
    } else {
      processedItems.push(item);
    }
  }

  // Label detection helper — matches both **Label:** (bold) and *Label:* (italic) formats
  const labelPattern = /^(?:\*{1,2})(Framework error|Data signal|Signal|Upside|Downside|Upside\/downside|Validates|Rejects)(?::?\*{1,2})/i;

  // If a line contains multiple labels jammed together (no line breaks), split them out
  function splitLabels(line: string): string[] {
    // Match positions where a label starts mid-line (preceded by content)
    const splitRegex = /\s+(?=\*{1,2}(?:Framework error|Data signal|Signal|Upside|Downside|Upside\/downside|Validates|Rejects):?\*{0,2})/i;
    const parts = line.split(splitRegex).filter(Boolean);
    return parts.length > 1 ? parts : [line];
  }

  // Check if any items are updates (for section header)
  const hasUpdates = processedItems.some(item => item.isUpdate);
  const updateItems = processedItems.filter(item => item.isUpdate);
  const newItems = processedItems.filter(item => !item.isUpdate);

  return (
    <div className="space-y-5">
      {/* Updates section — compact cards with "update" styling */}
      {hasUpdates && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-ct-yellow uppercase tracking-[0.06em] flex items-center gap-2 font-mono">
            <span className="w-3 h-px bg-ct-yellow" />
            Updates
          </h3>
          {updateItems.map((item, i) => {
            const lines = item.content.split('\n').filter(Boolean);
            return (
              <div key={`update-${i}`} className="p-4 bg-surface-warm border-[0.5px] border-text-muted/20">
                {lines.map((line, j) => (
                  <p key={j} className="text-sm text-text-secondary leading-[1.6]">
                    <RichText text={line} />
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* New positions — full cards */}
      {newItems.length > 0 && hasUpdates && (
        <h3 className="text-xs font-semibold text-ct-yellow uppercase tracking-[0.06em] flex items-center gap-2 mt-4 font-mono">
          <span className="w-3 h-px bg-ct-yellow" />
          New Positions
        </h3>
      )}
      {newItems.map((item, i) => {
        // Expand all lines, splitting any that have multiple labels jammed together
        const rawLines = item.content.split('\n').filter(Boolean);
        const lines: string[] = [];
        for (const line of rawLines) {
          lines.push(...splitLabels(line));
        }

        return (
          <div key={i} className="p-4 bg-white border-[0.5px] border-text-muted/20">
            {lines.map((line, j) => {
              const labelMatch = line.match(labelPattern);
              const labelType = labelMatch ? (labelMatch[1] ?? '').toLowerCase() : null;
              const isUpside = labelType === 'upside' || labelType === 'upside/downside';
              const isDownside = labelType === 'downside';
              const isValidates = labelType === 'validates';
              const isRejects = labelType === 'rejects';
              const isSignal = labelType === 'signal' || labelType === 'data signal';
              const isDateNote = /^\*(?:Feb|Mar|Jan|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s/.test(line);
              const isTitle = j === 0;

              return (
                <p key={j} className={`leading-[1.6] mb-2 ${
                  isTitle ? 'text-base font-bold text-text-primary mb-3' :
                  isUpside ? 'text-sm text-ct-green-data' :
                  isDownside ? 'text-sm text-ct-pink' :
                  isValidates ? 'text-xs text-text-muted' :
                  isRejects ? 'text-xs text-text-muted' :
                  isSignal ? 'text-sm text-ct-pink' :
                  isDateNote ? 'text-xs text-ct-yellow italic mt-2 font-mono' :
                  'text-sm text-text-secondary'
                }`}>
                  <RichText text={line} />
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DeepReadSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const recommendations: { emoji: string; title: string; description: string; timeEstimate: string; url: string }[] = [];

  let currentTitle = '';
  let currentDescription = '';
  let currentEmoji = '';
  let currentUrl = '';

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      // Check if this line starts with emoji + bold (title line)
      const titleMatch = block.content.match(/^(📖|🎧)\s+\*\*(.+?)\*\*\s*\(([^)]+)\)\s*$/);

      if (titleMatch) {
        // Save previous recommendation if exists
        if (currentTitle && currentDescription) {
          recommendations.push({
            emoji: currentEmoji,
            title: currentTitle,
            description: currentDescription,
            timeEstimate: '',
            url: currentUrl,
          });
        }
        currentEmoji = titleMatch[1] ?? '';
        currentTitle = titleMatch[2] ?? '';
        currentDescription = '';
        currentUrl = '';
      } else {
        // Check if this is the description line (may contain time estimate)
        const descMatch = block.content.match(/^(.+?)\s*\(\~(.+?)\)$/);
        if (descMatch) {
          currentDescription = descMatch[1] ?? '';
          const timeStr = descMatch[2] ?? '';
          const timeEstimate = `~${timeStr}`;

          // Update the last recommendation with time estimate
          if (recommendations.length > 0) {
            recommendations[recommendations.length - 1]!.timeEstimate = timeEstimate;
          }
        } else {
          currentDescription = block.content;
        }
      }
    } else if (block.type === 'paragraph' && block.content.includes('[→')) {
      // Link line
      const linkMatch = block.content.match(/\[→\s*(.+?)\]\((.+?)\)/);
      if (linkMatch) {
        currentUrl = linkMatch[2] ?? '';
      }
    }
  }

  // Save final recommendation
  if (currentTitle && currentDescription) {
    recommendations.push({
      emoji: currentEmoji,
      title: currentTitle,
      description: currentDescription,
      timeEstimate: '',
      url: currentUrl,
    });
  }

  // Parse recommendations more carefully by looking for emoji + bold pattern
  const recommendations2: { emoji: string; title: string; description: string; timeEstimate: string; url: string }[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i]!;

    if (block.type === 'paragraph') {
      // Match emoji + bold title + date in parentheses
      const titleMatch = block.content.match(/^(📖|🎧)\s+\*\*(.+?)\*\*\s*\(([^)]+)\)/);

      if (titleMatch) {
        const emoji = titleMatch[1] ?? '';
        const title = titleMatch[2] ?? '';
        let description = '';
        let timeEstimate = '';
        let url = '';

        // Next block should be description with time estimate
        i++;
        if (i < blocks.length) {
          const descBlock = blocks[i]!;
          if (descBlock.type === 'paragraph') {
            const descMatch = descBlock.content.match(/^(.+?)\s*\(\~(.+?)\)$/);
            if (descMatch) {
              description = descMatch[1] ?? '';
              timeEstimate = `~${descMatch[2] ?? ''}`;
            } else {
              description = descBlock.content;
            }

            // Next block should be the link
            i++;
            if (i < blocks.length) {
              const linkBlock = blocks[i]!;
              if (linkBlock.type === 'paragraph') {
                const linkMatch = linkBlock.content.match(/\[→\s*(.+?)\]\((.+?)\)/);
                if (linkMatch) {
                  url = linkMatch[2] ?? '';
                }
              } else {
                i--; // Back up if not a link block
              }
            }
          } else {
            i--; // Back up if not description block
          }
        }

        recommendations2.push({ emoji, title, description, timeEstimate, url });
      }
    }
    i++;
  }

  return (
    <div className="space-y-4">
      {recommendations2.map((rec, idx) => (
        <a
          key={idx}
          href={rec.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 bg-white border-[0.5px] border-text-muted/20 rounded-sm hover:border-text-muted/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">{rec.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary mb-2 leading-tight">
                {rec.title}
              </p>
              <p className="text-xs text-text-secondary leading-[1.6] mb-2">
                <RichText text={rec.description} />
              </p>
              {rec.timeEstimate && (
                <p className="text-xs font-mono text-ct-pink">
                  {rec.timeEstimate}
                </p>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function GenericSection({ content, darkBg = false }: { content: string; darkBg?: boolean }) {
  const blocks = parseBlocks(content);

  // Text color tokens based on background
  const h2Color = darkBg ? 'text-[#fff]' : 'text-text-primary';
  const h3Color = darkBg ? 'text-[#fff]' : 'text-text-primary';
  const bodyColor = darkBg ? 'text-[#aaa]' : 'text-text-secondary';
  const italicColor = darkBg ? 'text-[#888]' : 'text-text-muted';
  const listBorder = darkBg ? 'border-[#333]' : 'border-text-muted/20';
  const numColor = 'text-ct-yellow'; // yellow on both dark and light

  // Wrap content in a context div that lets bold/code inherit the right colors
  const wrapperClass = darkBg
    ? 'space-y-5 dark-section-text'
    : 'space-y-5 light-section-text';

  return (
    <div className={wrapperClass}>
      {blocks.map((block, i) => {
        if (block.type === 'h2') return (
          <h3 key={i} className={`text-base font-bold ${h2Color} mt-6 first:mt-0`}>{block.content}</h3>
        );
        if (block.type === 'h3') return (
          <h4 key={i} className={`text-sm font-semibold ${h3Color} mt-4`}>{block.content}</h4>
        );
        if (block.type === 'table') return <MarkdownTable key={i} content={block.content} />;
        if (block.type === 'italic') return (
          <p key={i} className={`text-sm ${italicColor} italic leading-[1.6]`}><RichText text={block.content} /></p>
        );
        if (block.type === 'list') {
          const items = block.content.split('\n').filter(Boolean);
          return (
            <div key={i} className="space-y-0">
              {items.map((item, j) => {
                const stripped = item.replace(/^- /, '');
                // Split bold headline from body: "**Headline.** Body text"
                const hlMatch = stripped.match(/^\*\*(.+?)\*\*\s*([\s\S]*)/);
                return (
                  <div key={j} className={`py-3 border-b ${listBorder} last:border-b-0`}>
                    {hlMatch ? (
                      <p className={`text-sm ${bodyColor} leading-[1.65]`}>
                        <strong className={`font-semibold ${h2Color}`}>{hlMatch[1]}</strong>{' '}
                        <RichText text={hlMatch[2] ?? ''} />
                      </p>
                    ) : (
                      <p className={`text-sm ${bodyColor} leading-[1.65]`}>
                        <RichText text={stripped} />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        if (block.type === 'numbered-list') {
          const items = block.content.split('\n').filter(Boolean);
          return (
            <div key={i} className="space-y-4">
              {items.map((item, j) => {
                const match = item.match(/^(\d+)\.\s*(.*)/);
                if (!match) return null;
                return (
                  <div key={j} className="flex gap-3 items-start">
                    <span className={`text-sm font-bold ${numColor} font-mono min-w-[24px]`}>{match[1] ?? ''}.</span>
                    <p className={`text-sm ${bodyColor} leading-[1.6]`}>
                      <RichText text={match[2] ?? ''} />
                    </p>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <p key={i} className={`text-sm ${bodyColor} leading-[1.6]`}>
            <RichText text={block.content} />
          </p>
        );
      })}
    </div>
  );
}

function RefBigStoriesSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const items: { num: string; title: string; text: string; date: string }[] = [];

  const fullText = content;
  const itemRegex = /\*\*(\d+)\.\s+(.+?)\*\*\n([\s\S]*?)(?=\n\*\*\d+\.|$)/g;
  let match;
  while ((match = itemRegex.exec(fullText)) !== null) {
    const text = (match[3] ?? '').trim();
    const dateMatch = text.match(/\*([^*]+)\*\s*$/);
    const date = dateMatch ? (dateMatch[1] ?? '') : '';
    const body = dateMatch ? text.slice(0, dateMatch.index).trim() : text;
    items.push({ num: match[1] ?? '', title: match[2] ?? '', text: body, date });
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-4 bg-white border-[0.5px] border-text-muted/20">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold text-ct-yellow font-mono">{item.num}.</span>
            <span className="text-sm font-bold text-text-primary">{item.title}</span>
          </div>
          <p className="text-sm text-text-secondary leading-[1.6] mb-1">{item.text}</p>
          {item.date && <p className="text-xs text-text-muted italic">{item.date}</p>}
        </div>
      ))}
    </div>
  );
}

function RefTomorrowsSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const items: { num: string; title: string; text: string; evidence?: string | undefined }[] = [];

  const fullText = content;
  const itemRegex = /(\d+)\.\s+\*\*(.+?)\*\*\s*—\s*([\s\S]*?)(?=\n\d+\.\s+\*\*|$)/g;
  let match;
  while ((match = itemRegex.exec(fullText)) !== null) {
    const text = (match[3] ?? '').trim();
    const evidenceMatch = text.match(/\*New evidence[^*]+\*$/);
    const evidence = evidenceMatch ? (evidenceMatch[0] ?? '').slice(1, -1) : undefined;
    const body = evidence && evidenceMatch ? text.slice(0, evidenceMatch.index).trim() : text;
    items.push({ num: match[1] ?? '', title: match[2] ?? '', text: body, evidence });
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-4 bg-white border-[0.5px] border-text-muted/20">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-bold text-ct-yellow font-mono">{item.num}.</span>
            <span className="text-sm font-bold text-text-primary">{item.title}</span>
          </div>
          <p className="text-sm text-text-secondary leading-[1.6]">{item.text}</p>
          {item.evidence && <p className="text-xs text-ct-pink italic mt-1.5">{item.evidence}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Section renderer dispatch ───────────────────────────────────────────────

function SectionContent({ section, darkBg = false }: { section: BriefSection; darkBg?: boolean }) {
  switch (section.type) {
    case 'dashboard': {
      // Parse per-section context notes from the brief markdown.
      const blocks = parseBlocks(section.content);
      let currentSection = '';
      const sectionNotes: Record<string, string[]> = { equity: [], crypto: [], commodity: [] };

      for (const block of blocks) {
        if (block.type === 'h3') {
          const h = block.content.toLowerCase();
          if (h.includes('equit')) currentSection = 'equity';
          else if (h.includes('crypto')) currentSection = 'crypto';
          else if (h.includes('commodit') || h.includes('rate')) currentSection = 'commodity';
          else currentSection = '';
        } else if ((block.type === 'italic' || block.type === 'paragraph') && currentSection) {
          sectionNotes[currentSection]!.push(block.content);
        }
      }

      const equityNotes = (sectionNotes.equity ?? []).length > 0 ? sectionNotes.equity!.join(' ') : undefined;
      const cryptoNotes = (sectionNotes.crypto ?? []).length > 0 ? sectionNotes.crypto!.join(' ') : undefined;
      const commodityNotes = (sectionNotes.commodity ?? []).length > 0 ? sectionNotes.commodity!.join(' ') : undefined;

      return (
        <div>
          <MobileKPICards>
            <LiveDashboard
              equityNotes={equityNotes as string | null}
              cryptoNotes={cryptoNotes as string | null}
              commodityNotes={commodityNotes as string | null}
            />
          </MobileKPICards>
          <p className="text-[10px] text-[#555] mt-3">
            Crypto data provided by <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#888]">CoinGecko</a>
          </p>
        </div>
      );
    }
    case 'overnight': return <GenericSection content={section.content} darkBg={darkBg} />;
    case 'the-six': return <TheSixSection content={section.content} />;
    case 'deep-read': return <DeepReadSection content={section.content} />;
    case 'the-take': return <TheTakeSection content={section.content} />;
    // asset-spotlight is handled by the default GenericSection fallback
    case 'inner-game': return <InnerGameSection content={section.content} />;
    case 'the-model': return <TheModelSection content={section.content} darkBg={darkBg} />;
    case 'discovery': return <DiscoverySectionRenderer content={section.content} />;
    case 'big-stories': return <BigStoriesSection content={section.content} />;
    case 'tomorrows-headlines': return <TomorrowsHeadlinesSection content={section.content} />;
    case 'watchlist': return <WatchlistSection content={section.content} />;
    case 'ref-big-stories': return <RefBigStoriesSection content={section.content} />;
    case 'ref-tomorrows': return <RefTomorrowsSection content={section.content} />;
    default: return <GenericSection content={section.content} darkBg={darkBg} />;
  }
}

// ─── Section display titles ──────────────────────────────────────────────────

const SECTION_TITLES: Record<string, string> = {
  'overnight': 'Overnight',
  'dashboard': 'The Dashboard',
  'the-six': 'The Six',
  'deep-read': 'Deep Read',
  'the-take': 'The Take',
  'asset-spotlight': 'Asset Spotlight',
  'inner-game': 'Inner Game',
  'the-model': 'The Model',
  'big-stories': 'The Big Stories',
  'tomorrows-headlines': "Tomorrow's Headlines",
  'watchlist': 'The Watchlist',
  'discovery': 'Discovery',
  'worldview': 'Worldview Updates',
  'ref-big-stories': 'Full Reference: Big Stories',
  'ref-tomorrows': "Full Reference: Tomorrow's Headlines",
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BriefViewer({ brief }: { brief: DailyBrief }) {
  const [activeSection, setActiveSection] = useState<string>(brief.sections[0]?.id || '');
  const [readProgress, setReadProgress] = useState(0);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setReadProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    brief.sections.forEach((section) => {
      const el = sectionRefs.current[section.id];
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting) setActiveSection(section.id);
        },
        { rootMargin: '-160px 0px -50% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [brief.sections]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      const offset = 110; // global nav (44px) + section tabs (~40px) + padding
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const activeSectionIndex = brief.sections.findIndex(s => s.id === activeSection);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-surface-reading"
    >
      {/* Ticker bar — NOT sticky, scrolls away, live data */}
      <TickerBar />

      {/* Sticky section tabs + progress bar — sits below global nav (44px) */}
      <div className="sticky top-[44px] z-40 bg-white border-b-[2px] border-ct-dark">
        {/* Section tabs */}
        <div className="flex overflow-x-auto no-scrollbar pl-1">
          {brief.sections.map((section, idx) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`px-4 py-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors flex-shrink-0 whitespace-nowrap border-r border-[#e8e8e4] last:border-r-0 ${
                  isActive
                    ? 'bg-ct-dark text-ct-yellow'
                    : 'text-text-muted hover:text-text-secondary hover:bg-[#f8f8f4]'
                }`}
              >
                {section.shortLabel}
              </button>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="h-[3px] bg-surface-warm">
          <div
            className="h-full bg-ct-pink transition-all duration-150"
            style={{ width: `${readProgress}%` }}
          />
        </div>
      </div>

      {/* Yellow Hero — matches super brief layout */}
      <div className="bg-ct-yellow border-b-[3px] border-ct-dark px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[13px] font-semibold text-ct-dark mb-0.5">
            {brief.displayDate}
          </div>
          <div className="font-mono text-[11px] font-medium text-[#555] uppercase tracking-[0.08em] mb-3">
            Markets, Meditations &amp; Mental Models — Daily Brief
          </div>

          {brief.epigraph && (
            <div className="font-serif italic text-[14px] text-[#333] leading-[1.5] mb-3">
              &ldquo;{brief.epigraph}&rdquo;
            </div>
          )}

          {brief.lede && (
            <p className="text-[13px] text-[#444] leading-[1.55] mb-3">
              <RichText text={brief.lede} />
            </p>
          )}

          <div className="mt-3">
            <AudioPlayer date={brief.date} />
          </div>
        </div>
      </div>

      {/* Sections — full-bleed backgrounds, content constrained inside each */}
      <div>
        {(() => {
          // Every section gets a full-bleed colored background — no plain white gaps
          const SECTION_BG: Record<string, string> = {
            'overnight':          'bg-[#F8F8F4]',
            'dashboard':          'bg-ct-dark',
            'the-six':            'bg-transparent',    // The Six has its own internal alternating subsections
            'the-take':           'bg-[#FFFDF0]',
            'big-stories':        'bg-[#F8F8F4]',
            'asset-spotlight':    'bg-white',
            'inner-game':         'bg-[#FFFDF0]',
            'discovery':          'bg-[#E8FFF5]',
            'the-model':          'bg-ct-dark',
            'tomorrows-headlines': 'bg-[#F8F8F4]',
            'watchlist':          'bg-white',
            'deep-read':          'bg-[#F8F8F4]',
            'worldview':          'bg-ct-dark',
            'ref-big-stories':    'bg-[#F8F8F4]',
            'ref-tomorrows':      'bg-[#F8F8F4]',
          };

          // Sections that render on dark backgrounds need light text
          const DARK_BG_SECTIONS = new Set(['dashboard', 'the-model', 'worldview']);

          const SECTION_BORDER: Record<string, string> = {
            'overnight':          'border-t border-[#e8e8e4]',
            'dashboard':          '',
            'the-six':            'border-t-[3px] border-ct-dark',
            'the-take':           'border-t-[3px] border-ct-yellow',
            'big-stories':        'border-t border-[#e8e8e4]',
            'asset-spotlight':    'border-t-[3px] border-ct-dark',
            'inner-game':         'border-t-[3px] border-ct-pink',
            'discovery':          'border-t-[3px] border-[#00885a]',
            'the-model':          'border-t-2 border-ct-yellow',
            'tomorrows-headlines': 'border-t border-[#e8e8e4]',
            'watchlist':          'border-t-[3px] border-ct-dark',
            'deep-read':          'border-t border-[#e8e8e4]',
            'worldview':          'border-t-2 border-ct-pink',
            'ref-big-stories':    'border-t border-[#e8e8e4]',
            'ref-tomorrows':      'border-t border-[#e8e8e4]',
          };

          const SECTION_LABEL_COLOR: Record<string, string> = {
            'dashboard':          'text-ct-yellow',
            'the-six':            'text-ct-dark',
            'the-take':           'text-ct-dark',
            'big-stories':        'text-ct-dark',
            'asset-spotlight':    'text-ct-dark',
            'inner-game':         'text-ct-pink',
            'discovery':          'text-[#00885a]',
            'the-model':          'text-ct-yellow',
            'tomorrows-headlines': 'text-ct-dark',
            'watchlist':          'text-ct-dark',
            'deep-read':          'text-ct-dark',
            'worldview':          'text-ct-pink',
            'ref-big-stories':    'text-text-secondary',
            'ref-tomorrows':      'text-text-secondary',
          };

          return (
            <>
              {brief.sections.map((section, idx) => {
                const bgClass = SECTION_BG[section.id] || 'bg-[#F8F8F4]';
                const borderClass = SECTION_BORDER[section.id] || 'border-t border-[#e8e8e4]';
                const labelColor = SECTION_LABEL_COLOR[section.id] || 'text-text-secondary';
                const isCentered = section.id === 'inner-game';
                const isDarkBg = DARK_BG_SECTIONS.has(section.id);
                const isTheSix = section.id === 'the-six';

                return (
                  <React.Fragment key={section.id}>
                    <div className={`${bgClass} ${isTheSix ? 'px-0 py-0' : 'px-4 py-12'} ${borderClass}`}>
                      <section
                        ref={(el) => { sectionRefs.current[section.id] = el; }}
                        className={`${isTheSix ? '' : 'max-w-5xl mx-auto'} ${isCentered ? 'text-center' : ''}`}
                        id={section.id}
                      >
                        {/* Section label + vote */}
                        <div className={`flex items-center justify-between mb-8 ${isTheSix ? 'max-w-5xl mx-auto px-4 pt-8' : ''} ${isCentered ? 'flex-col gap-4' : ''}`}>
                          <div className={`text-base sm:text-xl font-mono font-bold ${labelColor} uppercase tracking-[0.08em]`}>
                            {SECTION_TITLES[section.id] || section.label}
                          </div>
                          <SectionVote briefDate={brief.date} sectionId={section.id} />
                        </div>
                        {/* Section content */}
                        <SectionContent section={section} darkBg={isDarkBg} />
                      </section>
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          );
        })()}

        {/* Footer */}
        <div className="bg-ct-dark px-4 py-8 border-t-[3px] border-ct-yellow text-center">
          <p className="text-[12px] font-mono text-ct-green-data font-medium mb-1">✓ Fully caught up</p>
          <p className="text-[10px] font-mono text-text-on-dark-muted mb-4">
            Edition {brief.date} · <a href="/archive" className="text-ct-pink hover:text-ct-yellow">Archive</a>
          </p>
          <div className="flex gap-4 justify-center text-[10px] font-medium font-mono">
            <a className="text-ct-yellow" href="/archive">Yesterday →</a>
            <a className="text-ct-pink" href="/archive">Archive →</a>
            <a className="text-ct-green-data" href="/models">Models →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
