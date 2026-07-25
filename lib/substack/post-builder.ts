/**
 * Build a Substack post from a Brief Light (daily) or Weekly Light markdown.
 *
 * Conventions (Jackson, 2026-07-24):
 *   - Title = thesis headline (first bold-only line in the sections), same
 *     rule as the email subject in lib/email/render-brief.ts; falls back to
 *     the daily editorial title.
 *   - Subtitle = the lede, truncated.
 *   - Link block on top: 🎧 Spotify show + 📖 full brief/Weekly on the site.
 *   - Body = the light markdown verbatim minus the `# … LIGHT` masthead and
 *     the date heading (Substack shows title + date itself).
 */

import { parseBriefLight } from '../brief-light-parser';

const SPOTIFY_SHOW_URL = 'https://open.spotify.com/show/0MhCdB3jidaoJ25kg7zr6O';
const SITE_URL = 'https://www.cosmictrex.com';

export type SubstackPostKind = 'daily' | 'weekly';

export interface BuiltSubstackPost {
  title: string;
  subtitle: string;
  slug: string;
  bodyMarkdown: string;
  kind: SubstackPostKind;
  sourceSlug: string; // 2026-07-25 or 2026-W30
}

function truncate(text: string, n: number): string {
  const t = text.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trimEnd()}…`;
}

/** First bold-only line inside the sections = thesis headline. */
function extractThesis(markdown: string): string {
  let inSections = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^##\s*▸/.test(line)) {
      inSections = true;
      continue;
    }
    if (!inSections) continue;
    const m = /^\*\*(.+?)\*\*$/.exec(line);
    if (m && m[1] && !m[1].startsWith('[')) {
      // Strip a trailing period for title use (weekly theses end with one).
      return m[1].trim().replace(/\.$/, '');
    }
  }
  return '';
}

export function buildSubstackPost(
  markdown: string,
  sourceSlug: string,
  kind: SubstackPostKind
): BuiltSubstackPost {
  const meta = parseBriefLight(markdown, sourceSlug);
  const thesis = extractThesis(markdown);

  const base =
    thesis || meta.dailyTitle || `Brief — ${meta.displayDate || sourceSlug}`;
  const title = kind === 'weekly' ? `The Weekly: ${base}` : base;
  const subtitle = truncate(meta.lede || meta.epigraph, 200);

  const fullUrl =
    kind === 'weekly'
      ? `${SITE_URL}/weekly/${sourceSlug}`
      : `${SITE_URL}/daily-update/${sourceSlug}`;
  const fullLabel =
    kind === 'weekly'
      ? 'Read the full Weekly on cosmictrex.com'
      : 'Read the full brief on cosmictrex.com';
  const linkBlock =
    `🎧 [Listen on Spotify](${SPOTIFY_SHOW_URL}) · ` +
    `📖 [${fullLabel}](${fullUrl})`;

  // Strip the `# BRIEF LIGHT` / `# WEEKLY LIGHT` masthead and the date
  // heading; everything else ships verbatim.
  const bodyLines: string[] = [];
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (/^#\s+(BRIEF|WEEKLY)\s+LIGHT\s*$/i.test(line)) continue;
    if (
      line.startsWith('## ') &&
      !line.includes('▸') &&
      meta.displayDate &&
      line.slice(3).trim() === meta.displayDate
    ) {
      continue;
    }
    bodyLines.push(raw);
  }
  const body = bodyLines.join('\n').trim();

  return {
    title,
    subtitle,
    slug: `brief-${sourceSlug.toLowerCase()}`,
    bodyMarkdown: `${linkBlock}\n\n${body}\n`,
    kind,
    sourceSlug,
  };
}
