/**
 * Standalone parser for Brief Light (Super Brief) markdown files.
 *
 * Completely independent of daily-update-parser.ts.
 * No dashboard injection, no full-brief section definitions.
 */

import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BriefLight {
  date: string;           // "2026-04-06"
  displayDate: string;    // "Monday, April 6, 2026"
  dailyTitle: string;     // "The Bypass That Wasn't" — editorial headline
  lede: string;           // Intro summary (2-3 italic sentences shared with full brief)
  epigraph: string;       // Opening quote
  sections: BriefLightSection[];
  raw: string;            // Full markdown
}

export interface BriefLightSection {
  id: string;
  label: string;
  content: string;
}

// ─── Section definitions (Brief Light only) ─────────────────────────────────

const LIGHT_SECTION_MARKERS = [
  { marker: '## ▸ THE UPDATE',          id: 'the-update',          label: 'The Update' },
  { marker: '## ▸ MARKETS MINUTE',      id: 'markets-minute',      label: 'Markets Minute' },
  { marker: '## ▸ INTERESTING THINGS',  id: 'interesting-things',  label: 'Interesting Things' },
  { marker: '## ▸ THE MEDITATION',      id: 'the-meditation',      label: 'The Meditation' },
  { marker: '## ▸ THE MODEL',           id: 'the-model',           label: 'The Model' },
];

// ─── Parser ─────────────────────────────────────────────────────────────────

export function parseBriefLight(markdown: string, dateSlug: string): BriefLight {
  const lines = markdown.split('\n');

  // Extract epigraph, display date, daily title, and lede from header
  let epigraph = '';
  let displayDate = '';
  let dailyTitle = '';
  let lede = '';
  let foundTitle = false;

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = (lines[i] ?? '').trim();

    // Italic epigraph line: *"quote"* — appears before the date
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && !epigraph && !foundTitle) {
      epigraph = line.slice(1, -1);
      epigraph = epigraph.replace(/^[""\u201C\u201D]+/, '').replace(/[""\u201C\u201D]+$/, '').trim();
    }

    // Date heading: ## Monday, April 6, 2026
    if (line.startsWith('## ') && !displayDate && !line.includes('▸')) {
      displayDate = line.replace('## ', '');
    }

    // Daily Title: ### The Bypass That Wasn't
    if (line.startsWith('### ') && !dailyTitle && !line.includes('▸')) {
      dailyTitle = line.replace('### ', '');
      foundTitle = true;
    }

    // Lede: italic summary paragraph(s) after the Daily Title, before first section
    // These are *italic text* lines that appear after ### title and before ## ▸
    if (foundTitle && line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && !lede) {
      lede = line.slice(1, -1);
    }

    // Stop at first section marker
    if (line.includes('## ▸')) break;
  }

  // Parse sections
  const sections: BriefLightSection[] = [];

  for (let si = 0; si < LIGHT_SECTION_MARKERS.length; si++) {
    const def = LIGHT_SECTION_MARKERS[si]!;
    const startIdx = markdown.indexOf(def.marker);
    if (startIdx === -1) continue;

    // Content starts after the marker line
    const afterMarker = markdown.indexOf('\n', startIdx);
    if (afterMarker === -1) continue;

    // Find end: next section marker or end of file
    let endIdx = markdown.length;
    for (let ni = si + 1; ni < LIGHT_SECTION_MARKERS.length; ni++) {
      const nextDef = LIGHT_SECTION_MARKERS[ni]!;
      const nextIdx = markdown.indexOf(nextDef.marker);
      if (nextIdx !== -1 && nextIdx > startIdx) {
        endIdx = nextIdx;
        break;
      }
    }

    const content = markdown
      .slice(afterMarker + 1, endIdx)
      .replace(/^---\s*$/gm, '')     // Strip horizontal rules
      .trim();

    if (content) {
      sections.push({
        id: def.id,
        label: def.label,
        content,
      });
    }
  }

  return {
    date: dateSlug,
    displayDate,
    dailyTitle,
    lede,
    epigraph,
    sections,
    raw: markdown,
  };
}

// ─── File accessors ─────────────────────────────────────────────────────────

export function getBriefLightByDate(dateSlug: string): BriefLight | null {
  const filePath = path.join(CONTENT_DIR, `${dateSlug}-light.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseBriefLight(content, dateSlug);
}

export function getLatestBriefLight(): BriefLight | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('-light.md'))
    .sort()
    .reverse();

  const latest = files[0];
  if (!latest) return null;

  const dateSlug = latest.replace('-light.md', '');
  const content = fs.readFileSync(path.join(CONTENT_DIR, latest), 'utf-8');
  return parseBriefLight(content, dateSlug);
}

export function hasBriefLight(dateSlug: string): boolean {
  const filePath = path.join(CONTENT_DIR, `${dateSlug}-light.md`);
  return fs.existsSync(filePath);
}
