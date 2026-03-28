import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyBrief {
  date: string;           // "2026-02-23"
  displayDate: string;    // "Monday, February 23, 2026"
  epigraph: string;       // Italic line after title
  lede: string;           // Italic summary paragraph
  orientation: string;    // "New here?" guide paragraph (optional)
  sections: BriefSection[];
  raw: string;            // Full markdown for fallback
}

export interface BriefSection {
  id: string;
  type: 'dashboard' | 'the-six' | 'the-take' | 'asset-spotlight' | 'inner-game' | 'the-model' | 'discovery' | 'big-stories' | 'tomorrows-headlines' | 'watchlist' | 'worldview' | 'ref-big-stories' | 'ref-tomorrows';
  label: string;
  shortLabel: string;
  content: string;        // Raw markdown content of this section
}

// ─── Section definitions (order matters) ─────────────────────────────────────

const SECTION_DEFS: { marker: string; id: string; type: BriefSection['type']; label: string; shortLabel: string }[] = [
  { marker: '# ▸ THE DASHBOARD', id: 'dashboard', type: 'dashboard', label: 'Dashboard', shortLabel: 'Dash' },
  { marker: '# ▸ THE SIX', id: 'the-six', type: 'the-six', label: 'The Six', shortLabel: 'Six' },
  { marker: '# ▸ THE TAKE', id: 'the-take', type: 'the-take', label: 'The Take', shortLabel: 'Take' },
  { marker: '# ▸ ASSET SPOTLIGHT', id: 'asset-spotlight', type: 'asset-spotlight', label: 'Asset Spotlight', shortLabel: 'Asset' },
  { marker: '# ▸ INNER GAME', id: 'inner-game', type: 'inner-game', label: 'Inner Game', shortLabel: 'Inner' },
  { marker: '# ▸ THE MODEL', id: 'the-model', type: 'the-model', label: 'The Model', shortLabel: 'Model' },
  { marker: '# ▸ DISCOVERY', id: 'discovery', type: 'discovery', label: 'Discovery', shortLabel: 'Discovery' },
  // Legacy sections — kept for backward compatibility with older briefs
  { marker: '# ▸ THE BIG STORIES', id: 'big-stories', type: 'big-stories', label: 'Big Stories', shortLabel: 'Stories' },
  { marker: "# ▸ TOMORROW'S HEADLINES", id: 'tomorrows-headlines', type: 'tomorrows-headlines', label: 'Tomorrow', shortLabel: 'Tomorrow' },
  { marker: '# ▸ THE WATCHLIST', id: 'watchlist', type: 'watchlist', label: 'Watchlist', shortLabel: 'Watch' },
  { marker: '# ▸ WORLDVIEW UPDATES', id: 'worldview', type: 'worldview', label: 'Worldview', shortLabel: 'Worldview' },
  { marker: '# ▸ FULL REFERENCE: BIG STORIES', id: 'ref-big-stories', type: 'ref-big-stories', label: 'Ref: Stories', shortLabel: 'Ref:Stories' },
  { marker: "# ▸ FULL REFERENCE: TOMORROW'S HEADLINES", id: 'ref-tomorrows', type: 'ref-tomorrows', label: 'Ref: Tomorrow', shortLabel: 'Ref:Tmrw' },
];

// ─── Flexible section marker matching ─────────────────────────────────────────
// The Brief Writer occasionally drifts on exact markers (e.g. "# ▸ BIG STORIES"
// instead of "# ▸ THE BIG STORIES", or "## Full Reference:" instead of
// "# ▸ FULL REFERENCE:"). This function finds section starts resiliently.

function findSectionStart(markdown: string, marker: string): number {
  // 1. Exact match (fastest path)
  let idx = markdown.indexOf(marker);
  if (idx !== -1) return idx;

  // 2. Try without "THE " (handles "# ▸ BIG STORIES" vs "# ▸ THE BIG STORIES")
  const withoutThe = marker.replace(/(#\s*▸\s*)THE\s+/i, '$1');
  if (withoutThe !== marker) {
    idx = markdown.indexOf(withoutThe);
    if (idx !== -1) return idx;
  }

  // 3. Try "## " prefix instead of "# ▸ " with title case (handles "## Full Reference: Big Stories")
  const sectionName = marker.replace(/^#\s*▸\s*(THE\s+)?/i, '').trim();
  const lines = markdown.split('\n');
  let charIdx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s/.test(trimmed) && trimmed.toUpperCase().includes(sectionName.toUpperCase())) {
      return charIdx + (line.length - line.trimStart().length);
    }
    charIdx += line.length + 1;
  }

  return -1;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseDailyBrief(markdown: string, dateSlug: string): DailyBrief {
  const lines = markdown.split('\n');

  // Extract epigraph (first italic line after brief title)
  let epigraph = '';
  let displayDate = '';
  let lede = '';
  let orientation = '';
  let headerEndIndex = 0;
  let italicLinesAfterDate: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = (lines[i] ?? '').trim();
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && i < 5) {
      epigraph = line.slice(1, -1);
      // Strip leading/trailing quotes — the renderer adds its own typographic quotes
      epigraph = epigraph.replace(/^[""\u201C\u201D]+/, '').replace(/[""\u201C\u201D]+$/, '').trim();
    }
    if (line.startsWith('## ') && !displayDate) {
      displayDate = line.replace('## ', '');
      headerEndIndex = i + 1;
    }
    // Capture bold TLDR line (e.g. "**News TLDR:** ...")
    if (headerEndIndex > 0 && i > headerEndIndex && line.startsWith('**') && !lede) {
      lede = line;
    }
    // Collect italic paragraphs after the date, before first ---
    if (headerEndIndex > 0 && i > headerEndIndex && line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      italicLinesAfterDate.push(line.slice(1, -1));
    }
    if (line === '---' && headerEndIndex > 0) {
      break;
    }
  }

  // If lede was captured from bold TLDR line, orientation is first italic line
  // Otherwise fall back to old behavior (first italic = lede, second = orientation)
  if (lede) {
    orientation = italicLinesAfterDate[0] || '';
  } else {
    lede = italicLinesAfterDate[0] || '';
    orientation = italicLinesAfterDate[1] || '';
  }

  // Split into sections
  const sections: BriefSection[] = [];

  // Always inject the LiveDashboard as the first section.
  // The dashboard component fetches its own data from the API —
  // it doesn't need markdown content. This ensures the dashboard
  // renders even when the brief markdown doesn't include a dashboard section.
  const hasDashboardInMarkdown = findSectionStart(markdown, '# ▸ THE DASHBOARD') !== -1;
  if (!hasDashboardInMarkdown) {
    sections.push({
      id: 'dashboard',
      type: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Dash',
      content: '', // LiveDashboard component handles its own data
    });
  }

  for (let si = 0; si < SECTION_DEFS.length; si++) {
    const def = SECTION_DEFS[si]!;
    const startIdx = findSectionStart(markdown, def.marker);
    if (startIdx === -1) continue;

    // Content starts after the marker line
    const afterMarker = markdown.indexOf('\n', startIdx);
    if (afterMarker === -1) continue;

    // Find end: next section marker or end of file
    let endIdx = markdown.length;
    for (let ni = si + 1; ni < SECTION_DEFS.length; ni++) {
      const nextDef = SECTION_DEFS[ni]!;
      const nextIdx = findSectionStart(markdown, nextDef.marker);
      if (nextIdx !== -1 && nextIdx > startIdx) {
        endIdx = nextIdx;
        break;
      }
    }

    // Also check for --- separators as potential ends
    // But only if there's a section marker after it
    let content = markdown.slice(afterMarker + 1, endIdx).trim();

    // Remove trailing --- separators
    if (content.endsWith('---')) {
      content = content.slice(0, -3).trim();
    }

    sections.push({
      id: def.id,
      type: def.type,
      label: def.label,
      shortLabel: def.shortLabel,
      content,
    });
  }

  return {
    date: dateSlug,
    displayDate,
    epigraph,
    lede,
    orientation,
    sections,
    raw: markdown,
  };
}

// ─── File system helpers ─────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');

export function getLatestBrief(): DailyBrief | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  const latest = files[0];
  if (!latest) return null;

  const dateSlug = latest.replace('.md', '');
  const content = fs.readFileSync(path.join(CONTENT_DIR, latest), 'utf-8');
  return parseDailyBrief(content, dateSlug);
}

export function getBriefByDate(dateSlug: string): DailyBrief | null {
  const filePath = path.join(CONTENT_DIR, `${dateSlug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseDailyBrief(content, dateSlug);
}

export function getAllBriefDates(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''))
    .sort()
    .reverse();
}
