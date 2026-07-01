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
  title?: string;   // text after a colon in the header, e.g. "THE IDEA: <title>" or "THE MODEL: <name>"
}

// ─── Section detection (header-driven) ──────────────────────────────────────
// Handles BOTH the legacy selection format (THE UPDATE / INTERESTING THINGS / …)
// AND the ideas-first format (multiple "THE IDEA: <title>" headers, ALSO MOVING,
// TWO THINGS WORTH KNOWING, THE MODEL: <name> inline, THE CLOSE). Any "## ▸ …"
// line is a section boundary; the id is derived from the header text so renamed
// or new sections never silently disappear again.

const SECTION_HEADER_RE = /^##\s*▸\s*(.+?)\s*$/;

function sectionMetaFor(rawHeader: string): { id: string; label: string; title: string } {
  const colonIdx = rawHeader.indexOf(':');
  const head = (colonIdx >= 0 ? rawHeader.slice(0, colonIdx) : rawHeader).trim();
  const title = colonIdx >= 0 ? rawHeader.slice(colonIdx + 1).trim() : '';
  const u = head.toUpperCase();
  if (u.startsWith('THE UPDATE')) return { id: 'the-update', label: 'The Update', title };
  if (u.startsWith('THE BIG IDEA') || u.startsWith('THE IDEA')) return { id: 'the-idea', label: title || 'Idea', title };
  if (u.startsWith('ALSO MOVING')) return { id: 'also-moving', label: 'Also Moving', title };
  if (u.startsWith('MARKETS MINUTE')) return { id: 'markets-minute', label: 'Markets Minute', title };
  if (u.startsWith('TWO THINGS') || u.startsWith('INTERESTING THINGS')) return { id: 'interesting-things', label: 'Interesting Things', title };
  if (u.startsWith('OUR CALLS')) return { id: 'our-calls', label: 'Our Calls', title };  // weekly-light-only — the predictions nod
  if (u.startsWith('THE MEDITATION')) return { id: 'the-meditation', label: 'The Meditation', title };
  if (u.startsWith('THE MODEL')) return { id: 'the-model', label: 'The Model', title };
  if (u.startsWith('THE CLOSE')) return { id: 'the-close', label: 'The Close', title };
  return { id: head.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section', label: head, title };
}

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

    // Skip HTML comment lines (e.g. a calibration-example banner, which may
    // contain "## ▸" and would otherwise trip the section-break below).
    if (line.startsWith('<!--')) continue;

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

  // Parse sections (header-driven — every "## ▸ …" line is a boundary)
  const sections: BriefLightSection[] = [];

  const headerLines: { lineNo: number; raw: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = (lines[i] ?? '').match(SECTION_HEADER_RE);
    if (m && m[1]) headerLines.push({ lineNo: i, raw: m[1].trim() });
  }

  for (let h = 0; h < headerLines.length; h++) {
    const { lineNo, raw } = headerLines[h]!;
    const meta = sectionMetaFor(raw);
    const endLine = h + 1 < headerLines.length ? headerLines[h + 1]!.lineNo : lines.length;
    const content = lines
      .slice(lineNo + 1, endLine)
      .join('\n')
      .replace(/^---\s*$/gm, '')      // Strip horizontal rules
      .trim();

    // Keep the section if it has content (the close may be just a sign-off line).
    if (content || meta.id === 'the-close') {
      sections.push({ id: meta.id, label: meta.label, title: meta.title, content });
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

// All published super-brief dates, newest first (mirrors getAllBriefDates for the full brief).
export function getAllBriefLightDates(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('-light.md'))
    .map(f => f.replace('-light.md', ''))
    .sort()
    .reverse();
}
