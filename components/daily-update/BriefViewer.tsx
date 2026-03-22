'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DailyBrief, BriefSection } from '@/lib/daily-update-parser';
import LiveDashboard from '@/components/dashboard/LiveDashboard';
import AudioPlayer from '@/components/daily-update/AudioPlayer';

// ─── Status badge system ─────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }> = {
  accelerating: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', darkBg: 'dark:bg-red-500/10', darkText: 'dark:text-red-400', darkBorder: 'dark:border-red-500/25' },
  developing:   { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', darkBg: 'dark:bg-amber-500/10', darkText: 'dark:text-amber-400', darkBorder: 'dark:border-amber-500/25' },
  elevated:     { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', darkBg: 'dark:bg-orange-500/10', darkText: 'dark:text-orange-400', darkBorder: 'dark:border-orange-500/25' },
  new:          { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', darkBg: 'dark:bg-purple-500/10', darkText: 'dark:text-purple-400', darkBorder: 'dark:border-purple-500/25' },
  watching:     { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', darkBg: 'dark:bg-slate-500/10', darkText: 'dark:text-slate-400', darkBorder: 'dark:border-slate-500/25' },
  building:     { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', darkBg: 'dark:bg-green-500/10', darkText: 'dark:text-green-400', darkBorder: 'dark:border-green-500/25' },
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
    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border} ${s.darkBg} ${s.darkText} ${s.darkBorder}`}>
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
      parts.push(<strong key={key++} className="text-neutral-900 dark:text-[var(--espresso-h1)] font-semibold"><RichText text={first.match![1] ?? ''} {...(onAnchorClick ? { onAnchorClick } : {})} /></strong>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++} className="text-neutral-500 dark:text-neutral-400"><RichText text={first.match![1] ?? ''} {...(onAnchorClick ? { onAnchorClick } : {})} /></em>);
    } else if (first.type === 'code') {
      parts.push(<code key={key++} className="text-amber-700 dark:text-[var(--espresso-accent)] bg-amber-50 dark:bg-[var(--espresso-bg-medium)] px-1.5 py-0.5 rounded text-[0.9em] font-mono">{first.match![1]}</code>);
    } else if (first.type === 'link') {
      const linkText = first.match![1] ?? '';
      const linkHref = first.match![2] ?? '';
      if (linkHref.startsWith('#') && onAnchorClick) {
        // Internal anchor link — use scrollToSection
        const sectionId = linkHref.slice(1);
        parts.push(
          <a key={key++} href={linkHref} onClick={(e) => { e.preventDefault(); onAnchorClick(sectionId); }}
            className="text-amber-600 dark:text-[var(--espresso-accent)] hover:underline cursor-pointer">{linkText}</a>
        );
      } else {
        // External link
        parts.push(
          <a key={key++} href={linkHref} target="_blank" rel="noopener noreferrer"
            className="text-amber-600 dark:text-[var(--espresso-accent)] hover:underline">{linkText}</a>
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
    <div className="overflow-x-auto -mx-4 sm:mx-0 mb-5 rounded-lg border border-neutral-200 dark:border-[var(--espresso-accent)]/15">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-white dark:bg-[var(--espresso-bg-medium)]/60 border-b border-neutral-200 dark:border-[var(--espresso-accent)]/15">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-[var(--espresso-accent)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-neutral-100 dark:border-[var(--espresso-accent)]/8 hover:bg-neutral-50/50 dark:hover:bg-[var(--espresso-bg-medium)]/40 transition-colors">
              {row.map((cell, ci) => {
                const isNeg = cell.startsWith('-') && cell.includes('%');
                const isPos = cell.startsWith('+') && cell.includes('%');
                return (
                  <td key={ci} className={`py-2.5 px-3 font-mono text-sm ${
                    ci === 0 ? 'font-semibold text-neutral-900 dark:text-[var(--espresso-h1)]' :
                    isNeg ? 'text-red-500 dark:text-red-400' :
                    isPos ? 'text-green-600 dark:text-green-400' :
                    'text-neutral-700 dark:text-[var(--espresso-body)]'
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
          <h3 key={i} className="text-sm font-bold text-amber-700 dark:text-[var(--espresso-accent)] uppercase tracking-widest mt-10 first:mt-0 flex items-center gap-2">
            <span className="w-4 h-px bg-amber-600 dark:bg-[var(--espresso-accent)]" />
            {block.content}
          </h3>
        );
        if (block.type === 'table') return <MarkdownTable key={i} content={block.content} />;
        if (block.type === 'italic') return (
          <p key={i} className="text-[15px] text-neutral-500 dark:text-neutral-400 leading-[1.8] italic pl-4 border-l-2 border-amber-300 dark:border-[var(--espresso-accent)]/20">
            <RichText text={block.content} />
          </p>
        );
        return (
          <p key={i} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.8]">
            <RichText text={block.content} />
          </p>
        );
      })}
    </div>
  );
}

function TheSixSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.type === 'h2') return (
          <h3 key={i} className="text-lg font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mt-10 first:mt-0 pb-2 border-b border-neutral-200 dark:border-[var(--espresso-accent)]/15">
            {block.content}
          </h3>
        );
        if (block.type === 'list') {
          const items = block.content.split('\n').filter(Boolean);
          return (
            <ul key={i} className="space-y-5">
              {items.map((item, j) => (
                <li key={j} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.8] pl-5 border-l-2 border-amber-300/60 dark:border-[var(--espresso-accent)]/20">
                  <RichText text={item.replace(/^- /, '')} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'italic') return (
          <p key={i} className="text-[15px] text-neutral-500 dark:text-neutral-400 leading-[1.7] italic">
            <RichText text={block.content} />
          </p>
        );
        if (block.type === 'paragraph') return (
          <p key={i} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.8]">
            <RichText text={block.content} />
          </p>
        );
        return null;
      })}
    </div>
  );
}

function TheTakeSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.type === 'h3') return (
          <h3 key={i} className="text-2xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-2 leading-tight">
            {block.content}
          </h3>
        );
        if (block.type === 'italic') return (
          <p key={i} className="text-[15px] text-neutral-500 dark:text-neutral-400 leading-[1.7] italic">
            <RichText text={block.content} />
          </p>
        );
        return (
          <p key={i} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.85]">
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
          <p key={i} className="text-sm text-neutral-500 dark:text-neutral-400 italic mt-6 pt-4 border-t border-neutral-200 dark:border-[var(--espresso-accent)]/10">
            <RichText text={story.body} />
          </p>
        );

        // Extract number and clean title for status inference
        const numMatch = story.title.match(/^(\d+)\.\s*(.*)/);
        const num = numMatch ? numMatch[1] ?? '' : '';
        const cleanTitle = numMatch ? (numMatch[2] ?? '') : story.title;
        const status = inferStatus(cleanTitle);

        return (
          <div key={i} className="p-5 rounded-xl bg-white dark:bg-[var(--espresso-bg-medium)]/50 border border-neutral-200 dark:border-[var(--espresso-accent)]/10">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="text-[17px] font-bold text-neutral-900 dark:text-[var(--espresso-h1)] leading-snug">
                {num && <span className="text-amber-600 dark:text-[var(--espresso-accent)] font-mono mr-1.5">{num}.</span>}
                {cleanTitle}
              </h4>
              <StatusBadge status={status} />
            </div>
            <div className="space-y-2.5">
              {story.body.split('\n').filter(Boolean).map((p, j) => (
                <p key={j} className="text-[15px] text-neutral-600 dark:text-[var(--espresso-body)] leading-[1.75]">
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
        <div key={i} className="p-5 rounded-xl bg-white dark:bg-[var(--espresso-bg-medium)]/40 border border-neutral-200 dark:border-[var(--espresso-accent)]/8">
          <h4 className="text-[17px] font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-3 leading-snug">{item.title}</h4>
          <div className="space-y-2.5">
            {item.body.split('\n').filter(Boolean).map((p, j) => (
              <p key={j} className="text-[15px] text-neutral-600 dark:text-[var(--espresso-body)] leading-[1.75]">
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
          <h3 className="text-sm font-semibold text-amber-700 dark:text-[var(--espresso-accent)] uppercase tracking-wider flex items-center gap-2">
            <span className="w-3 h-px bg-amber-500 dark:bg-[var(--espresso-accent)]" />
            Updates
          </h3>
          {updateItems.map((item, i) => {
            const lines = item.content.split('\n').filter(Boolean);
            return (
              <div key={`update-${i}`} className="p-4 rounded-lg bg-amber-50/50 dark:bg-[var(--espresso-accent)]/5 border border-amber-200/60 dark:border-[var(--espresso-accent)]/10">
                {lines.map((line, j) => (
                  <p key={j} className="text-[15px] text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.7]">
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
        <h3 className="text-sm font-semibold text-amber-700 dark:text-[var(--espresso-accent)] uppercase tracking-wider flex items-center gap-2 mt-4">
          <span className="w-3 h-px bg-amber-500 dark:bg-[var(--espresso-accent)]" />
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
          <div key={i} className="p-5 rounded-xl bg-white dark:bg-[var(--espresso-bg-medium)]/40 border border-neutral-200 dark:border-[var(--espresso-accent)]/10">
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
                <p key={j} className={`leading-[1.7] mb-2 ${
                  isTitle ? 'text-lg font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-3' :
                  isUpside ? 'text-[15px] text-green-600 dark:text-green-400' :
                  isDownside ? 'text-[15px] text-red-500 dark:text-red-400' :
                  isValidates ? 'text-[14px] text-neutral-500 dark:text-neutral-400' :
                  isRejects ? 'text-[14px] text-neutral-500 dark:text-neutral-400' :
                  isSignal ? 'text-[15px] text-blue-600 dark:text-blue-400' :
                  isDateNote ? 'text-[14px] text-amber-600 dark:text-[var(--espresso-accent)] italic mt-2' :
                  'text-base text-neutral-600 dark:text-[var(--espresso-body)]'
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

function GenericSection({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.type === 'h2') return (
          <h3 key={i} className="text-lg font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mt-6 first:mt-0">{block.content}</h3>
        );
        if (block.type === 'h3') return (
          <h4 key={i} className="text-base font-semibold text-neutral-800 dark:text-[var(--espresso-h1)] mt-4">{block.content}</h4>
        );
        if (block.type === 'table') return <MarkdownTable key={i} content={block.content} />;
        if (block.type === 'italic') return (
          <p key={i} className="text-[15px] text-neutral-500 dark:text-neutral-400 italic leading-[1.7]"><RichText text={block.content} /></p>
        );
        if (block.type === 'list') {
          const items = block.content.split('\n').filter(Boolean);
          return (
            <ul key={i} className="space-y-3">
              {items.map((item, j) => (
                <li key={j} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.75] pl-5 border-l-2 border-amber-300/60 dark:border-[var(--espresso-accent)]/15">
                  <RichText text={item.replace(/^- /, '')} />
                </li>
              ))}
            </ul>
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
                    <span className="text-sm font-bold text-amber-600 dark:text-[var(--espresso-accent)] font-mono min-w-[24px]">{match[1] ?? ''}.</span>
                    <p className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.75]">
                      <RichText text={match[2] ?? ''} />
                    </p>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <p key={i} className="text-base text-neutral-700 dark:text-[var(--espresso-body)] leading-[1.8]">
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
        <div key={i} className="p-4 rounded-lg bg-white dark:bg-[var(--espresso-bg-medium)]/35 border border-neutral-200 dark:border-[var(--espresso-accent)]/8">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold text-amber-600 dark:text-[var(--espresso-accent)] font-mono">{item.num}.</span>
            <span className="text-[15px] font-bold text-neutral-900 dark:text-[var(--espresso-h1)]">{item.title}</span>
          </div>
          <p className="text-[15px] text-neutral-600 dark:text-[var(--espresso-body)] leading-[1.7] mb-1">{item.text}</p>
          {item.date && <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">{item.date}</p>}
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
        <div key={i} className="p-4 rounded-lg bg-white dark:bg-[var(--espresso-bg-medium)]/30 border border-neutral-200 dark:border-[var(--espresso-accent)]/6">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-bold text-amber-600 dark:text-[var(--espresso-accent)] font-mono">{item.num}.</span>
            <span className="text-[15px] font-bold text-neutral-900 dark:text-[var(--espresso-h1)]">{item.title}</span>
          </div>
          <p className="text-[15px] text-neutral-600 dark:text-[var(--espresso-body)] leading-[1.7]">{item.text}</p>
          {item.evidence && <p className="text-sm text-purple-600 dark:text-purple-400 italic mt-1.5">{item.evidence}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Section renderer dispatch ───────────────────────────────────────────────

function SectionContent({ section }: { section: BriefSection }) {
  switch (section.type) {
    case 'dashboard': {
      // Parse per-section context notes from the brief markdown.
      // Structure: ### Equities → table → italic notes → ### Crypto → table → italic notes → ### Commodities → ...
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
          <LiveDashboard
            equityNotes={equityNotes as string | null}
            cryptoNotes={cryptoNotes as string | null}
            commodityNotes={commodityNotes as string | null}
          />
          {/* CoinGecko attribution (required by their terms) */}
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-3">
            Crypto data provided by <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-500">CoinGecko</a>
          </p>
        </div>
      );
    }
    case 'the-six': return <TheSixSection content={section.content} />;
    case 'the-take': return <TheTakeSection content={section.content} />;
    case 'asset-spotlight': return <GenericSection content={section.content} />;
    case 'inner-game': return <GenericSection content={section.content} />;
    case 'big-stories': return <BigStoriesSection content={section.content} />;
    case 'tomorrows-headlines': return <TomorrowsHeadlinesSection content={section.content} />;
    case 'watchlist': return <WatchlistSection content={section.content} />;
    case 'ref-big-stories': return <RefBigStoriesSection content={section.content} />;
    case 'ref-tomorrows': return <RefTomorrowsSection content={section.content} />;
    default: return <GenericSection content={section.content} />;
  }
}

// ─── Section display titles ──────────────────────────────────────────────────

const SECTION_TITLES: Record<string, string> = {
  'dashboard': 'The Dashboard',
  'the-six': 'The Six',
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
      const offset = 160; // site header (~57px) + section nav (~45px) + padding
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const activeSectionIndex = brief.sections.findIndex(s => s.id === activeSection);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-neutral-50 dark:bg-[var(--espresso-bg-dark)] [--daily-tab-unexplored-color:#9ca3af] [--daily-tab-unexplored-hover-color:#4b5563] dark:[--daily-tab-unexplored-color:#1A1410] dark:[--daily-tab-unexplored-hover-color:#1A1410]"
    >
      {/* Progress bar — sits right below the site header */}
      <div className="fixed top-[57px] left-0 right-0 z-[60] h-1 bg-neutral-200 dark:bg-[var(--espresso-bg-medium)]">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-600 dark:from-[var(--espresso-accent)] dark:to-amber-500 transition-all duration-150"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Sticky section nav — below site header + progress bar */}
      <div className="sticky top-[58px] z-50 bg-neutral-50/95 dark:bg-[var(--espresso-bg-dark)]/95 backdrop-blur-sm border-b border-neutral-200 dark:border-[var(--espresso-accent)]/15 py-3">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1.5 sm:gap-1 overflow-x-auto no-scrollbar">
            {brief.sections.map((section, idx) => {
              const isActive = section.id === activeSection;
              const isPast = idx < activeSectionIndex;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`sm:flex-1 sm:min-w-0 flex-shrink-0 px-3 sm:px-2 py-1.5 rounded-md text-xs font-medium transition-all sm:truncate whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-bg-dark)]'
                      : isPast
                      ? 'text-amber-600 dark:text-[var(--espresso-accent)] hover:bg-amber-50 dark:hover:bg-[var(--espresso-accent)]/10'
                      : 'text-[var(--daily-tab-unexplored-color)] hover:text-[var(--daily-tab-unexplored-hover-color)] hover:bg-neutral-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="hidden sm:inline">{section.label}</span>
                  <span className="sm:hidden">{section.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-8 sm:pt-14 pb-6 sm:pb-8">
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-lg sm:text-xl font-semibold text-amber-600 dark:text-[var(--espresso-accent)] uppercase tracking-[0.15em] mb-5">
            Markets, Meditations & Mental Models
          </div>

          {/* Audio player — between header and date */}
          <AudioPlayer date={brief.date} />

          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-5">
            {brief.displayDate}
          </h1>
          {brief.epigraph && (
            <p className="text-lg text-neutral-500 dark:text-neutral-400 italic max-w-xl mx-auto mb-8 leading-relaxed">
              &ldquo;{brief.epigraph}&rdquo;
            </p>
          )}
          {brief.lede && (
            <p className="text-[17px] text-neutral-700 dark:text-[var(--espresso-body)] max-w-2xl mx-auto leading-[1.7]">
              <RichText text={brief.lede} />
            </p>
          )}
          {brief.orientation && (
            <p className="text-[15px] text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto leading-[1.7] mt-6 italic">
              <RichText text={brief.orientation} onAnchorClick={scrollToSection} />
            </p>
          )}

          {/* Previous brief link */}
          <p className="text-xl sm:text-2xl text-neutral-400 dark:text-neutral-500 mt-8">
            Miss yesterday?{' '}
            <a
              href="/archive"
              className="text-amber-600 dark:text-[var(--espresso-accent)] hover:underline font-semibold"
            >
              Find a previous brief →
            </a>
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-amber-300/40 dark:via-[var(--espresso-accent)]/20 to-transparent" />

        {/* Act headers and sections */}
        {(() => {
          const ACT_HEADERS: Record<string, string> = {
            'dashboard': 'Markets',
            'inner-game': 'Meditations',
            'the-model': 'Mental Models',
          };

          return (
            <>
              {brief.sections.map((section, idx) => (
                <React.Fragment key={section.id}>
                  {/* Inject act header before specific sections */}
                  {ACT_HEADERS[section.id] && (
                    <div className="pt-16 pb-6 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-5">
                        <span className="w-12 h-px bg-amber-400/50 dark:bg-[var(--espresso-accent)]/30" />
                        <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-[var(--espresso-accent)] uppercase tracking-[0.2em]">
                          {ACT_HEADERS[section.id]}
                        </div>
                        <span className="w-12 h-px bg-amber-400/50 dark:bg-[var(--espresso-accent)]/30" />
                      </div>
                    </div>
                  )}

                  <section
                    ref={(el) => { sectionRefs.current[section.id] = el; }}
                    className="py-14"
                    id={section.id}
                  >
                    {/* Section header — centered with decorative lines */}
                    <div className="mb-10 text-center">
                      <div className="flex items-center justify-center gap-4 mb-1">
                        <span className="flex-1 max-w-[60px] h-px bg-amber-300/60 dark:bg-[var(--espresso-accent)]/25" />
                        <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] tracking-tight">
                          {SECTION_TITLES[section.id] || section.label}
                        </h2>
                        <span className="flex-1 max-w-[60px] h-px bg-amber-300/60 dark:bg-[var(--espresso-accent)]/25" />
                      </div>
                    </div>

                    {/* Section content — subtitle comes from the markdown itself */}
                    <SectionContent section={section} />
                  </section>

                  {idx < brief.sections.length - 1 && (
                    <div className="h-px bg-gradient-to-r from-transparent via-amber-200/60 dark:via-[var(--espresso-accent)]/15 to-transparent" />
                  )}
                </React.Fragment>
              ))}
            </>
          );
        })()}

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-neutral-200 dark:border-[var(--espresso-accent)]/10 text-center">
          <div className="text-sm text-neutral-400 dark:text-neutral-500">
            Markets, Meditations & Mental Models
          </div>
        </div>
      </div>
    </div>
  );
}
