/**
 * Financial text preprocessor for TTS audio generation.
 *
 * Two-layer approach:
 *   1. GPT-4o "scriptwriter" — rewrites the raw brief as a conversational podcast script
 *   2. Regex normalization — catches any remaining financial shorthand the LLM missed
 *
 * The scriptwriter handles tone, flow, section selection, and natural transitions.
 * The regex layer is the safety net for abbreviations and formatting artifacts.
 */

import OpenAI from 'openai';

// ─── Ticker / abbreviation dictionaries ─────────────────────────────────────

const TICKER_NAMES: Record<string, string> = {
  // Major indices
  'SPX': 'S&P 500',
  'NDX': 'Nasdaq 100',
  'DJI': 'Dow Jones',
  'VIX': 'the VIX',
  'DXY': 'the Dollar Index',
  'US10Y': 'the 10-year Treasury yield',
  'US2Y': 'the 2-year Treasury yield',
  // Crypto
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'XRP': 'XRP',
  'DOGE': 'Dogecoin',
  // Commodities
  'GOLD': 'Gold',
  'BRENT': 'Brent crude',
  'WTI': 'WTI crude',
  // Mega-cap stocks
  'AAPL': 'Apple',
  'MSFT': 'Microsoft',
  'GOOGL': 'Alphabet',
  'GOOG': 'Alphabet',
  'AMZN': 'Amazon',
  'META': 'Meta',
  'NVDA': 'NVIDIA',
  'TSLA': 'Tesla',
  'MSTR': 'MicroStrategy',
  'COIN': 'Coinbase',
  'AMD': 'AMD',
  'INTC': 'Intel',
  'AVGO': 'Broadcom',
  'CRM': 'Salesforce',
  'NFLX': 'Netflix',
  'TSM': 'TSMC',
  'QCOM': 'Qualcomm',
  'ARM': 'ARM Holdings',
  // Consumer / other stocks
  'DPZ': "Domino's",
  'VZ': 'Verizon',
  'WU': 'Western Union',
  'BLK': 'BlackRock',
  // ETFs
  'SPY': 'the S&P 500 ETF',
  'QQQ': 'the Nasdaq 100 ETF',
  'IWM': 'the Russell 2000 ETF',
  'GLD': 'the Gold ETF',
  'TLT': 'the long-term Treasury ETF',
  'IBIT': 'the iShares Bitcoin ETF',
  'GBTC': 'the Grayscale Bitcoin Trust',
};

const FINANCIAL_ABBREVIATIONS: Record<string, string> = {
  'YoY': 'year over year',
  'QoQ': 'quarter over quarter',
  'MoM': 'month over month',
  'WoW': 'week over week',
  'DoD': 'day over day',
  'EBITDA': 'E.B.I.T.D.A.',
  'EPS': 'earnings per share',
  'P/E': 'P.E. ratio',
  'PE': 'P.E. ratio',
  'GDP': 'G.D.P.',
  'CPI': 'C.P.I.',
  'PPI': 'P.P.I.',
  'PCE': 'P.C.E.',
  'NFP': 'nonfarm payrolls',
  'FOMC': 'the F.O.M.C.',
  'IMF': 'the I.M.F.',
  'ECB': 'the E.C.B.',
  'BOJ': 'the Bank of Japan',
  'EM': 'emerging markets',
  'DM': 'developed markets',
  'IPO': 'I.P.O.',
  'M&A': 'M. and A.',
  'AUM': 'assets under management',
  'NAV': 'net asset value',
  'ROI': 'return on investment',
  'ROE': 'return on equity',
  'CAGR': 'compound annual growth rate',
  'DCF': 'discounted cash flow',
  'LBO': 'leveraged buyout',
  'SPAC': 'SPAC',
  'SEC': 'the S.E.C.',
  'CFTC': 'the C.F.T.C.',
  'ETF': 'E.T.F.',
  'ETFs': 'E.T.F.s',
  'ATH': 'all-time high',
  'ATL': 'all-time low',
  'MA': 'moving average',
  'EMA': 'exponential moving average',
  'RSI': 'R.S.I.',
  'MACD': 'MACD',
  'DHS': 'D.H.S.',
  'TSA': 'T.S.A.',
  'NATO': 'NATO',
  'GTC': 'G.T.C.',
  'AI': 'A.I.',
  'LLM': 'large language model',
  'GPU': 'G.P.U.',
  'GPUs': 'G.P.U.s',
  'SDK': 'S.D.K.',
  'API': 'A.P.I.',
  'APIs': 'A.P.I.s',
  'IRGC': 'I.R.G.C.',
  'LNG': 'L.N.G.',
};

const QUARTER_MAP: Record<string, string> = {
  'Q1': 'first quarter',
  'Q2': 'second quarter',
  'Q3': 'third quarter',
  'Q4': 'fourth quarter',
};

// ─── Section configuration ──────────────────────────────────────────────────

interface AudioSectionConfig {
  marker: string;
  name: string;
  mode: 'full' | 'commentary-only';
}

/** Sections to include in audio (in order). Dashboard is commentary-only (skip tables). */
const AUDIO_SECTIONS: AudioSectionConfig[] = [
  { marker: '## ▸ OVERNIGHT', name: 'Overnight', mode: 'full' },
  { marker: '# ▸ THE DASHBOARD', name: 'The Dashboard', mode: 'commentary-only' },
  { marker: '# ▸ THE SIX', name: 'The Six', mode: 'full' },
  // Deep Read / Listen is SKIPPED in audio — external links don't work in audio format
  { marker: '# ▸ THE TAKE', name: 'The Take', mode: 'full' },
  { marker: '# ▸ INNER GAME', name: 'Inner Game', mode: 'full' },
  { marker: '# ▸ THE MODEL', name: 'The Model', mode: 'full' },
  { marker: '# ▸ DISCOVERY', name: 'Discovery', mode: 'full' },
];

// Legacy section markers — kept so the pipeline can still process older briefs
// that were published before the 3-act restructure (March 2026)
// NOTE: The Watchlist is EXCLUDED — it's internal-only content, never for audio.
const LEGACY_AUDIO_SECTIONS: AudioSectionConfig[] = [
  { marker: '# ▸ THE BIG STORIES', name: 'The Big Stories', mode: 'full' },
  { marker: "# ▸ TOMORROW'S HEADLINES", name: "Tomorrow's Headlines", mode: 'full' },
];

/**
 * Weekly audio section set. The Weekly reads THE SIGNAL and THE PREDICTIONS as their own
 * TOP-LEVEL sections. The daily differs: it has no PREDICTIONS, and "The Signal" is a
 * `## ` sub-header inside The Six — spoken as "The Six: The Signal" via splitAtSubHeaders,
 * NOT omitted. These weekly-only top-level markers are excluded from daily boundary
 * detection (see extractRawContent) so they never truncate The Six. Selected only when
 * processing a weekly file (PreprocessOptions.isWeekly).
 */
const WEEKLY_AUDIO_SECTIONS: AudioSectionConfig[] = [
  { marker: '## ▸ OVERNIGHT', name: 'Overnight', mode: 'full' },                  // optional — included if present
  { marker: '# ▸ THE DASHBOARD', name: 'The Dashboard', mode: 'commentary-only' },
  { marker: '# ▸ THE SIX', name: 'The Six', mode: 'full' },
  { marker: '# ▸ THE SIGNAL', name: 'The Signal', mode: 'full' },                 // weekly-only inclusion
  { marker: '# ▸ THE TAKE', name: 'The Take', mode: 'full' },
  { marker: '# ▸ THE PREDICTIONS', name: 'The Predictions', mode: 'full' },       // weekly-only section
  { marker: '# ▸ INNER GAME', name: 'Inner Game', mode: 'full' },
  { marker: '# ▸ THE MODEL', name: 'The Model', mode: 'full' },
  { marker: '# ▸ DISCOVERY', name: 'Discovery', mode: 'full' },
];

/** All known section markers (for finding boundaries).
 *  THE SIGNAL and THE PREDICTIONS are weekly-only markers; adding them here only affects
 *  boundary detection (they never appear in daily briefs), so the daily is unchanged. */
const ALL_MARKERS = [
  ...AUDIO_SECTIONS.map(s => s.marker),
  ...LEGACY_AUDIO_SECTIONS.map(s => s.marker),
  '# ▸ THE SIGNAL',       // Weekly-only boundary (sits between The Six and The Take)
  '# ▸ THE PREDICTIONS',  // Weekly-only boundary (sits after The Take)
  '## Deep Read',  // Boundary marker — section is skipped in audio but needs to be recognized
  '# ▸ WORLDVIEW UPDATES',
  '# ▸ FULL REFERENCE: BIG STORIES',
  "# ▸ FULL REFERENCE: TOMORROW'S HEADLINES",
  '# ▸ THE WATCHLIST',  // Boundary only — Watchlist is internal, never included in audio
  '## Watchlist Pulse',  // Alternate format — also internal only
];

/**
 * Find a section marker in the markdown, with flexible matching.
 * Handles drift like "# ▸ BIG STORIES" vs "# ▸ THE BIG STORIES"
 * and "## Full Reference:" vs "# ▸ FULL REFERENCE:".
 */
function findMarkerIndex(text: string, marker: string): number {
  let idx = text.indexOf(marker);
  if (idx !== -1) return idx;

  // Try without "THE "
  const withoutThe = marker.replace(/(#\s*▸\s*)THE\s+/i, '$1');
  if (withoutThe !== marker) {
    idx = text.indexOf(withoutThe);
    if (idx !== -1) return idx;
  }

  // Try line-by-line case-insensitive match on the section name — but ONLY at the SAME
  // header level as the marker. Without the level guard a top-level marker like
  // "# ▸ THE SIGNAL" (one #) fuzzily matched a daily "## The Signal" sub-header (two #),
  // mis-locating the boundary and dropping The Signal from daily audio.
  const markerLevel = marker.match(/^#+/)?.[0].length ?? 0;
  const sectionName = marker.replace(/^#\s*▸\s*(THE\s+)?/i, '').trim();
  const lines = text.split('\n');
  let charIdx = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const lineLevel = trimmed.match(/^#+/)?.[0].length ?? 0;
    if (lineLevel === markerLevel && /^#{1,3}\s/.test(trimmed) && trimmed.toUpperCase().includes(sectionName.toUpperCase())) {
      return charIdx + (line.length - line.trimStart().length);
    }
    charIdx += line.length + 1;
  }

  return -1;
}

// ─── Regex-based financial text normalization ───────────────────────────────

function expandCurrency(text: string): string {
  const magnitudes: Record<string, string> = {
    'T': 'trillion', 'B': 'billion', 'M': 'million', 'K': 'thousand',
  };
  return text.replace(
    /\$([0-9]+(?:\.[0-9]+)?)\s*(T|B|M|K)\b/gi,
    (_, num, mag) => `${num} ${magnitudes[mag.toUpperCase()] || mag} dollars`
  );
}

function expandBasisPoints(text: string): string {
  return text.replace(
    /([+-]?)(\d+)\s*bps?\b/gi,
    (_, sign, num) => `${sign === '+' ? 'plus ' : sign === '-' ? 'minus ' : ''}${num} basis points`
  );
}

function expandMultipliers(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)\s*x\b/gi, '$1 times');
}

function expandQuarters(text: string): string {
  let result = text.replace(
    /\b(Q[1-4])\s*['']?(\d{2,4})\b/g,
    (_, q, year) => `${QUARTER_MAP[q.toUpperCase()] || q} ${year}`
  );
  result = result.replace(/\bFY\s*(\d{4})\b/gi, 'fiscal year $1');
  return result;
}

function expandPercentages(text: string): string {
  let result = text.replace(
    /([+-])(\d+)\s*bp\b/gi,
    (_, sign, num) => `${sign === '+' ? 'plus ' : 'minus '}${num} basis points`
  );
  // Expand numeric ranges BEFORE signed percentages so "1.2-1.5%" doesn't get
  // mis-parsed as "1.2 down 1.5%". Handles dash, en-dash, and em-dash separators.
  result = result.replace(
    /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)%/g,
    (_, low, high) => `${low} to ${high} percent`
  );
  // Also handle ranges where both sides have % signs: "1.2%-1.5%"
  result = result.replace(
    /(\d+(?:\.\d+)?)%\s*[-–—]\s*(\d+(?:\.\d+)?)%/g,
    (_, low, high) => `${low} to ${high} percent`
  );
  // Expand basis point ranges: "25-50bp" → "25 to 50 basis points"
  result = result.replace(
    /(\d+)\s*[-–—]\s*(\d+)\s*bp\b/gi,
    (_, low, high) => `${low} to ${high} basis points`
  );
  result = result.replace(
    /([+-])(\d+(?:\.\d+)?)%/g,
    (_, sign, num) => `${sign === '+' ? 'up ' : 'down '}${num} percent`
  );
  return result;
}

function expandMovingAverages(text: string): string {
  let result = text.replace(/(\d+)D\s*MA\b/gi, '$1-day moving average');
  result = result.replace(/(\d+)W\s*MA\b/gi, '$1-week moving average');
  result = result.replace(/(\d+)D\s*EMA\b/gi, '$1-day exponential moving average');
  return result;
}

function expandYearAbbreviations(text: string): string {
  // "10Y" → "10-year", "2Y" → "2-year", "30Y" → "30-year" (bond/yield context)
  // Must NOT match "10Y MA" (already handled by expandMovingAverages)
  return text.replace(/\b(\d+)Y\b(?!\s*MA)/g, '$1-year');
}

function expandAbbreviations(text: string): string {
  for (const [abbr, spoken] of Object.entries(FINANCIAL_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    text = text.replace(regex, spoken);
  }
  return text;
}

function expandTickers(text: string): string {
  // ETH disambiguation: "ETH Zurich" and similar institutional uses → "E.T.H." (spelled out)
  // Must run BEFORE the generic ETH → Ethereum replacement
  text = text.replace(/\bETH\s+(Zurich|Zürich|Lausanne|Board|Domain)\b/g, 'E.T.H. $1');

  for (const [ticker, name] of Object.entries(TICKER_NAMES)) {
    // Skip ETH if it's followed by institutional context (already handled above)
    if (ticker === 'ETH') {
      // Only replace ETH when NOT followed by university/institution words
      text = text.replace(/\bETH\b(?!\s*(?:Zurich|Zürich|Lausanne|Board|Domain))/g, name);
      continue;
    }
    const regex = new RegExp(`\\b${ticker}\\b`, 'g');
    text = text.replace(regex, name);
  }
  return text;
}

function cleanFormatting(text: string): string {
  text = text.replace(/▸/g, '');
  // Strip "former President Trump" → "President Trump" (he IS the sitting president)
  text = text.replace(/\bformer President\s+Trump\b/gi, 'President Trump');
  // Fix GPT-4o training data title errors — Rubio is Secretary of State, not Senator
  text = text.replace(/\bSenator\s+Rubio\b/g, 'Secretary of State Rubio');
  text = text.replace(/~/g, 'approximately ');
  text = text.replace(/\s*—\s*/g, ', ');
  // Remove markdown escape sequences (e.g., "\-" → "-", "\*" → "*")
  text = text.replace(/\\([*\-_~`#>|])/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/`(.+?)`/g, '$1');
  text = text.replace(/⬆️|⬇️|🔴|🟢|🟡|📖|🎧|⚡/g, '');
  text = text.replace(/^[-*]\s+/gm, '');
  text = text.replace(/^#+\s*/gm, '');
  return text;
}

/** Remove doubled expansions like "the Dollar Index, the Dollar Index" caused by
 *  GPT-4o expanding a ticker AND the regex layer expanding it again. */
function deduplicateExpansions(text: string): string {
  // Catch patterns like "the X, the X" or "the X the X" (with optional comma/dash between)
  // Apply to BOTH ticker names AND financial abbreviations — GPT-4o may expand
  // an abbreviation AND the regex layer expands it again, causing doubling.
  const allExpansions = [
    ...Object.values(TICKER_NAMES),
    ...Object.values(FINANCIAL_ABBREVIATIONS),
  ];
  const seen = new Set<string>();
  for (const name of allExpansions) {
    // Deduplicate the expansion list itself (some values may overlap)
    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    // Escape for regex
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match "X[,;— ] X" or "X X" (adjacent) — works whether or not name starts with "the"
    const doublePattern = new RegExp(`(${escaped})[,;\\s—-]+(${escaped})`, 'gi');
    text = text.replace(doublePattern, '$1');
  }
  return text;
}

/** Collapse doubled words and article collisions left by abbreviation expansion.
 *  Caught live in W27 audio (2026-07-05): "at the the E.C.B.'s", "WTI crude crude oil",
 *  and "a the Bank of Japan hike" (expansion of "a BOJ hike"). deduplicateExpansions only
 *  covers known expansion strings; this is the general mechanical backstop. */
export function collapseDoubledWords(text: string): string {
  // Legit English doubles we must not touch.
  const legit = new Set(['had', 'that', 'very', 'many']);
  // "the the", "crude crude", "Japan Japan" — immediate case-insensitive duplicates.
  text = text.replace(/\b([A-Za-z][\w.&'’-]*)(\s+\1)\b/gi, (m, w1: string) =>
    legit.has(w1.toLowerCase()) ? m : w1
  );
  // Article collision: "a the Bank of Japan" / "an the E.C.B." → "the ...".
  text = text.replace(/\b[Aa]n?\s+(the\s+)/g, '$1');
  return text;
}

/** Apply all regex-based normalizations */
function regexNormalize(text: string): string {
  text = expandCurrency(text);
  text = expandBasisPoints(text);
  text = expandMovingAverages(text);
  text = expandYearAbbreviations(text);
  text = expandMultipliers(text);
  text = expandQuarters(text);
  text = expandPercentages(text);
  text = expandTickers(text);
  text = expandAbbreviations(text);
  text = cleanFormatting(text);
  text = deduplicateExpansions(text);
  text = collapseDoubledWords(text);
  return text;
}

// ─── Raw content extraction ─────────────────────────────────────────────────

interface ParsedBriefForAudio {
  displayDate: string;
  lede: string;
  sections: { name: string; content: string; mode: string }[];
}

/**
 * Extract raw brief content, selecting only audio-relevant sections.
 * Dashboard uses commentary-only mode (italic paragraphs + sub-headers, skip tables).
 */
function extractRawContent(
  brief: { date: string; displayDate: string; epigraph: string; lede: string; sections: { id: string; label: string; content: string }[] },
  rawMarkdown?: string,
  isWeekly = false
): { rawContent: string; parsed: ParsedBriefForAudio } {
  // The weekly reads a different section set (adds THE SIGNAL + THE PREDICTIONS);
  // the daily is untouched. Legacy markers are only relevant to the daily.
  const primarySections = isWeekly ? WEEKLY_AUDIO_SECTIONS : AUDIO_SECTIONS;

  // If we have the raw markdown, parse sections directly from it (more reliable for markers)
  // Otherwise fall back to the parsed sections from daily-update-parser
  const parsed: ParsedBriefForAudio = {
    displayDate: brief.displayDate,
    lede: brief.lede
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1'),
    sections: [],
  };

  if (rawMarkdown) {
    // Parse directly from raw markdown (same approach as test script)
    // Try current sections first, then legacy sections for older briefs
    const allSectionsToTry = isWeekly
      ? [...WEEKLY_AUDIO_SECTIONS]
      : [...AUDIO_SECTIONS, ...LEGACY_AUDIO_SECTIONS];

    // Boundary markers used to find where each section ends. THE SIGNAL and THE PREDICTIONS
    // are weekly-only TOP-LEVEL sections. In the DAILY, "The Signal" is a `## ` sub-header
    // INSIDE The Six — so the weekly marker "# ▸ THE SIGNAL" must NOT be used as a daily
    // boundary, or it truncates The Six right before "## The Signal" and silently drops the
    // Signal from the daily audio. Excluding them for the daily lets The Six run to THE TAKE;
    // splitAtSubHeaders then emits "The Six: The Signal" (spoken via its own transition +
    // instruction). The weekly still uses them — it owns those sections at the top level.
    const boundaryMarkers = isWeekly
      ? ALL_MARKERS
      : ALL_MARKERS.filter(m => m !== '# ▸ THE SIGNAL' && m !== '# ▸ THE PREDICTIONS');

    for (const sec of allSectionsToTry) {
      const startIdx = findMarkerIndex(rawMarkdown, sec.marker);
      if (startIdx === -1) continue;

      const afterMarker = rawMarkdown.indexOf('\n', startIdx);
      if (afterMarker === -1) continue;

      let endIdx = rawMarkdown.length;
      for (const m of boundaryMarkers) {
        if (m === sec.marker) continue;
        const idx = findMarkerIndex(rawMarkdown, m);
        if (idx > startIdx && idx < endIdx) endIdx = idx;
      }

      let content = rawMarkdown.slice(afterMarker + 1, endIdx).trim();
      if (content.endsWith('---')) content = content.slice(0, -3).trim();

      // For dashboard: extract only commentary paragraphs (skip table data)
      if (sec.mode === 'commentary-only') {
        content = extractCommentaryOnly(content);
      }

      // For The Six: split at ## sub-headers into individual chunks to prevent compression
      if (sec.name === 'The Six') {
        const subSections = splitAtSubHeaders(content);
        for (const sub of subSections) {
          parsed.sections.push({ name: `The Six: ${sub.name}`, content: sub.content, mode: 'full' });
        }
        continue;
      }

      parsed.sections.push({ name: sec.name, content, mode: sec.mode });
    }
  } else {
    // Fall back to parsed sections from daily-update-parser
    // Maps section IDs from the parser to audio section configs
    const allConfigs = [...WEEKLY_AUDIO_SECTIONS, ...AUDIO_SECTIONS, ...LEGACY_AUDIO_SECTIONS];
    const configByName = (name: string) => allConfigs.find(c => c.name === name);
    const sectionIdToConfig: Record<string, AudioSectionConfig> = {
      'overnight': configByName('Overnight')!,
      'dashboard': configByName('The Dashboard')!,
      'the-six': configByName('The Six')!,
      // 'deep-read' intentionally excluded — Deep Read / Listen is skipped in audio
      'the-take': configByName('The Take')!,
      'inner-game': configByName('Inner Game')!,
      'the-model': configByName('The Model')!,
      'discovery': configByName('Discovery')!,
      // Weekly-only section IDs — only present (and only selected) for the weekly
      ...(isWeekly ? {
        'the-signal': configByName('The Signal')!,
        'the-predictions': configByName('The Predictions')!,
      } : {}),
      // Legacy section IDs (for older briefs)
      'big-stories': configByName('The Big Stories')!,
      'tomorrows-headlines': configByName("Tomorrow's Headlines")!,
      'watchlist': configByName('The Watchlist')!,
    };

    for (const section of brief.sections) {
      const config = sectionIdToConfig[section.id];
      if (!config) continue;

      let content = section.content;
      if (config.mode === 'commentary-only') {
        content = extractCommentaryOnly(content);
      }

      parsed.sections.push({ name: config.name, content, mode: config.mode });
    }
  }

  // Build the raw content string for the scriptwriter
  const parts: string[] = [];
  parts.push(`DATE: ${parsed.displayDate}`);
  if (brief.epigraph) {
    const plainEpigraph = brief.epigraph
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1');
    parts.push(`EPIGRAPH: ${plainEpigraph}`);
  }
  if (parsed.lede) parts.push(`LEDE: ${parsed.lede}`);

  for (const section of parsed.sections) {
    parts.push(`\n--- SECTION: ${section.name} ---\n${section.content}`);
  }

  return { rawContent: parts.join('\n\n'), parsed };
}

/** Split content at ## sub-headers into individual chunks */
function splitAtSubHeaders(content: string): { name: string; content: string }[] {
  const subSections: { name: string; content: string }[] = [];
  const lines = content.split('\n');
  let currentName = 'Overview';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        if (text.length > 50) {
          subSections.push({ name: currentName, content: text });
        }
      }
      currentName = trimmed.replace(/^#+\s*/, '');
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const text = currentLines.join('\n').trim();
    if (text.length > 50) {
      subSections.push({ name: currentName, content: text });
    }
  }

  return subSections;
}

/**
 * Extract only commentary from a section (for dashboard).
 * Keeps: sub-headers, italic paragraphs, regular prose.
 * Skips: table rows (lines starting with |).
 */
function extractCommentaryOnly(content: string): string {
  const lines = content.split('\n');
  const commentaryLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip table rows
    if (line.startsWith('|')) continue;

    // Keep subsection headers (### Equities, ### Crypto, etc.)
    if (line.startsWith('###')) {
      commentaryLines.push(line.replace(/^#+\s*/, ''));
      continue;
    }

    // Keep italic commentary paragraphs (wrapped in *)
    if (line.startsWith('*') && !line.startsWith('**')) {
      commentaryLines.push(line.replace(/^\*/, '').replace(/\*$/, ''));
      continue;
    }

    // Keep regular paragraphs too (some commentary isn't italic)
    if (line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('---')) {
      commentaryLines.push(line);
    }
  }

  return commentaryLines.join('\n\n');
}

// ─── Section-name canonical matching ─────────────────────────────────────────
// Writer header drift ("## The Wild Card" vs "## Wild Card") silently dropped the
// Wild Card transition AND its instruction from BOTH the daily and the weekly
// (confirmed in the 2026-07-04 and 2026-W27 scripts — the section started cold).
// Exact-match lookups are banned for section maps; every lookup goes through here.

/** "The Six: The Wild Card" and "the six: wild card" both → "six: wild card" */
export function canonicalSectionKey(name: string): string {
  return name
    .split(':')
    .map(p => p.trim().replace(/^the\s+/i, ''))
    .join(': ')
    .toLowerCase();
}

/** Map lookup by canonical section name — tolerant of "The " drift and casing. */
export function lookupSection<T>(dict: Record<string, T>, sectionName: string): T | undefined {
  if (dict[sectionName] !== undefined) return dict[sectionName];
  const target = canonicalSectionKey(sectionName);
  for (const [key, val] of Object.entries(dict)) {
    if (canonicalSectionKey(key) === target) return val;
  }
  return undefined;
}

// ─── Mechanical script gate ──────────────────────────────────────────────────
// The written brief has five enforcement layers; until 2026-07-05 the audio script
// had ZERO — every rule lived in a prompt, and prompts leak (banned phrases, gutted
// sections, filler morals all shipped in W27/07-04 audio). This gate is the
// mechanical layer: deterministic repairs where safe, one regeneration when a
// section arrives gutted, loud warnings for everything else.

/** Phrases the system prompt bans — now mechanically enforced on OUTPUT. */
const BANNED_SCRIPT_PHRASES = [
  'buckle up', 'strap in', 'hold on tight',
  "here's where it gets interesting", "here's where it gets wild",
  'let that sink in', 'read that again', 'without further ado',
  'at the end of the day', 'game-changer', 'jaw-dropping',
  "let's dive into", "let's dive in", "let's jump in!", 'switching gears', "let's shift gears",
  'that wraps up', 'get ready to explore',
];

/** Filler-moral endings the scriptwriter invents when it has cut real substance. */
const FILLER_ENDING_PATTERNS = [
  /these stories highlight[^.!?]*[.!?]\s*$/i,
  /it (all )?goes to show[^.!?]*[.!?]\s*$/i,
  /keep (this|that) in mind[^.!?]*[.!?]\s*$/i,
  /something to (keep in mind|think about|watch)[^.!?]*[.!?]\s*$/i,
];

/** Generic double-intro leads. The deterministic transition already introduced the
 *  section; ANY announce-y first sentence is a double intro, banned phrase or not
 *  (W27 light: transition said "caught our eye outside the main stories", then the
 *  script added "Let's dive into some fascinating stories from this week..."). */
const INTRO_LEAD_PATTERNS = [
  /^(?:let'?s|here (?:are|is)|these are|now for|time for|first,? let'?s|get ready|welcome)\b[^.!?]{0,120}\b(?:stories|things|ideas|items|highlights|moments)\b[^.!?]{0,60}[.!?]/i,
];

/** Sections that teach — they must not compress much, or the teaching dies. */
const SUBSTANCE_PROTECTED_SECTIONS = ['inner game', 'model', 'discovery', 'meditation', 'take', 'close'];

interface ScriptCheckResult {
  script: string;
  warnings: string[];
  /** true when the section should be regenerated (gutted beyond repair) */
  needsRetry: boolean;
}

/** Curly→straight apostrophes + lowercase, so banned-phrase matching can't be dodged
 *  by typography. GPT-4o writes "Let’s dive into" (curly); the list holds "let's dive
 *  into" (straight) — caught by scripts/audio-gate-regression.ts before it shipped. */
function normalizeForPhraseMatch(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** Deterministic repairs + checks on a single section's script. */
export function enforceScriptRules(sectionName: string, script: string, sourceContent: string): ScriptCheckResult {
  const warnings: string[] = [];
  let out = script.trim();

  // 1) Strip a double-intro LEAD sentence ("Let's dive into some fascinating stories...").
  //    The deterministic transition already did the intro; an announce-y lead is pure
  //    double-intro whether or not it uses a phrase from the banned list.
  const firstSentence = out.match(/^[^.!?\n]{0,160}[.!?]/)?.[0] ?? '';
  const isBannedLead = firstSentence && BANNED_SCRIPT_PHRASES.some(p => normalizeForPhraseMatch(firstSentence).includes(p));
  const isIntroLead = firstSentence && INTRO_LEAD_PATTERNS.some(p => p.test(normalizeForPhraseMatch(firstSentence)));
  if (isBannedLead || isIntroLead) {
    out = out.slice(firstSentence.length).trim();
    warnings.push(`${sectionName}: stripped double-intro lead sentence ("${firstSentence.trim()}")`);
  }

  // 2) Strip invented filler-moral endings ("These stories highlight the complex...").
  for (const pattern of FILLER_ENDING_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, '').trim();
      warnings.push(`${sectionName}: stripped filler-moral ending`);
    }
  }

  // 3) Remaining banned phrases mid-script — warn loudly (semantic edit isn't safe here).
  const normalizedOut = normalizeForPhraseMatch(out);
  for (const phrase of BANNED_SCRIPT_PHRASES) {
    if (normalizedOut.includes(phrase)) {
      warnings.push(`${sectionName}: banned phrase survived in script body: "${phrase}"`);
    }
  }

  // 4) Substance floor. Teaching sections must keep >=55% of source length; others >=35%.
  //    Below the floor = gutted → regenerate once with explicit feedback.
  const srcWords = sourceContent.split(/\s+/).filter(Boolean).length;
  const outWords = out.split(/\s+/).filter(Boolean).length;
  const canonical = canonicalSectionKey(sectionName);
  const isProtected = SUBSTANCE_PROTECTED_SECTIONS.some(s => canonical.includes(s));
  const floor = isProtected ? 0.55 : 0.35;
  const ratio = srcWords > 0 ? outWords / srcWords : 1;
  const needsRetry = srcWords > 120 && ratio < floor;
  if (needsRetry) {
    warnings.push(
      `${sectionName}: GUTTED — script is ${Math.round(ratio * 100)}% of source (floor ${Math.round(floor * 100)}%), regenerating once`
    );
  }

  return { script: out, warnings, needsRetry };
}

// ─── GPT-4o per-section scriptwriter ─────────────────────────────────────────
// Sending all 35K+ chars to GPT-4o in one shot causes massive compression (~4K out).
// Instead: rewrite each section individually, then stitch together.
// Each section gets the full prompt context so voice/tone is consistent.

const SECTION_SYSTEM_PROMPT = `You are a podcast scriptwriter for "Markets, Meditations, and Mental Models", a daily financial market intelligence podcast.

YOUR JOB: Convert written market analysis into natural, conversational spoken form. THE BALANCE, which is the entire job: keep the episode to a reasonable length AND lose no substance. Aim to land the full brief UNDER 30 minutes, but you hit that target by compressing DELIVERY, never by dropping substance. Compress delivery aggressively: paraphrase (it does NOT have to be word-for-word), cut setup, redundancy, throat-clearing, and connective filler. But EVERY substantive point survives: every thesis, every "so what," every number that drives an argument, every "where this might be wrong," every distinct story. NEVER drop a point, a step in the argument, or a piece of evidence to save time. Test: could the listener reconstruct every argument and conclusion from your script? If yes, you compressed right. If a point is gone, that is the lossy compression we are killing. Tiebreaker: if keeping all the substance runs you slightly over, run slightly over. Substance beats the clock by a small margin. Do not pad, do not gut. It should sound like a smart friend thinking it through out loud, not reading aloud.

VOICE & FEEL (THIS IS CRITICAL):
You're writing how a smart friend actually talks when explaining something they find fascinating. This is a MORNING show. The listener is waking up. Your script should wake them up. Not a podcast host performing. Not NPR. Not a finance bro hyping. A person who reads a lot, thinks clearly, and is genuinely excited to share what they know. The listener should feel like they're in a conversation, not an audience. They should feel ENERGIZED, AWAKE, and SMARTER after listening, not weighed down by doom or lulled to sleep. Even when the news is heavy, the energy should be "isn't it fascinating that we get to think about this?" not "everything is terrible." Bring LIFE to the writing. If you write it flat, the voice reads it flat.

Techniques for natural delivery:
- Talk through ideas like you're working them out. "So the thing is..." / "What I keep coming back to is..." / "The part that doesn't get enough attention is..."
- Use plain language FIRST. If you need a technical term, say it once and immediately explain what it means in normal words. Never stack jargon.
- Vary your pacing. Some things deserve a quick mention. Others need you to slow down and unpack. Match the weight of the idea.
- Connect ideas naturally when they actually connect. Don't force transitions.
- Use contractions everywhere. "It's" not "it is." "Don't" not "do not." "That's" not "that is." "Wouldn't" not "would not."

TRANSITIONS:
Within your section, every bullet must connect to the next. Do NOT start a new bullet cold. Thread them naturally:
- "Meanwhile..." / "On a completely different front..." / "Speaking of infrastructure..." / "And that connects to something else..."
- If two stories rhyme, connect them. If they don't, acknowledge the shift briefly and move on.

CRITICAL — NO SECTION INTRODUCTIONS:
A deterministic transition phrase is prepended to your section AFTER you write it. You are writing ONLY the content body. Do NOT write any opening that introduces, announces, or frames the section. No "Let's look at..." No "In today's markets..." No "Here's what's happening in..." No "For today's [section name]..." Just start with the first substantive point. Your first sentence should be a FACT, an INSIGHT, or a STORY — never a meta-statement about what you're about to discuss. If your first sentence could be deleted without losing any information, it's an intro and must be cut.

BANNED PHRASES (these are overused filler that replaces actual insight):
- "Buckle up" / "Strap in" / "Hold on tight"
- "Here's where it gets interesting" / "Here's where it gets wild" / "Here's the thing"
- "This is huge" / "This is massive" / "Game-changer" / "Jaw-dropping"
- "Let that sink in" / "Read that again" / "I'll say that again"
- "Without further ado" / "That said" / "Having said that"
- "At the end of the day"
- "Moving on to..." / "Next up..." / "Let's turn to..." / "Let's dive into..."
- "Switching gears" / "Let's shift gears" / "Now let's shift" (find a fresh transition every time)
- "That's the [section name]" / "That wraps up" / "And that's" (no section sign-offs. Just move to the next topic.)
- "Now we're diving into The Six" / "Let's dive into The Six" (The Six is only introduced ONCE at the very start by Markets & Macro. Never re-announce it mid-flow.)
Do NOT use any of these. If you catch yourself reaching for one, just say the actual insight instead.

FIDELITY TO SOURCE TEXT (CRITICAL — THIS IS THE #1 RULE):
Stay close to the written brief. The written text was carefully crafted. Your job is to make it sound natural when spoken, NOT to rewrite it from scratch. Keep the specific language, the specific numbers, the specific framing. Do not paraphrase loosely or over-simplify. If the brief says "the DeFi-CeFi lending rate spread surviving 51 consecutive days of extreme fear," say that. Do not compress it to "DeFi rates are holding up." The specificity IS the value. Simplify delivery (contractions, pacing, natural rhythm) but preserve the substance word-for-word where possible.

FIDELITY FLOOR — NEVER DROP THESE (even when compressing for time):
- COMPANY NAMES: If the brief names a company (Domino's, Verizon, BlackRock, etc.), that name MUST appear in your script. You may shorten context around it, but the name itself is sacred. Never replace a company name with a generic description ("a pizza chain," "a telecom company").
- POLITICAL TITLES: Use EXACTLY the title in the brief. If the brief says "Secretary of State Rubio," say "Secretary of State Rubio." Do NOT substitute titles from your training data. Titles change — the brief has the current one.
- KEY DATA POINTS: If the brief includes a specific number that drives the analysis (earnings miss, rate move, price level), keep it. You can round per the NUMBERS rules above, but don't drop the data point entirely.
- TICKER SYMBOLS: When the brief uses a ticker (DPZ, VZ, MSFT), convert it to the company name for speech. Do NOT skip the reference.
- PROPER NOUNS: Names of people, institutions, laws, treaties, technologies. If the brief names it, your script names it.

BANNED PUNCTUATION:
- NEVER use em-dashes ("--" or "—") in the output. They are an AI writing tell and sound unnatural when spoken.
- Instead of an em-dash, use a period and start a new sentence, use a comma, or just restructure. "Bitcoin hit seventy-two thousand. That's the highest since January." NOT "Bitcoin hit seventy-two thousand — the highest since January."
- This applies to ALL output. Zero em-dashes, no exceptions.

AVOID (these make it sound scripted):
- Starting every paragraph the same way
- Perfect parallel structure (real speech isn't symmetric)
- Formal topic sentences followed by supporting evidence (that's essay structure, not speech)
- Wrapping every point with a neat takeaway
- Repeating the same transition phrase or energy pattern across sections
- Explaining what you're about to explain ("I'm going to walk you through..." just walk through it)
- Hype language where the substance should speak for itself

DISAMBIGUATION (CRITICAL):
- "ETH Zurich" is a university in Switzerland. Say "E.T.H. Zurich" (spell out the letters). It is NOT Ethereum. Never say "Ethereum Zurich."
- "ETH" alone in a crypto context = "Ethereum" or "ether."
- If a ticker or abbreviation has a non-financial meaning in context, use the non-financial meaning.

JARGON RULES (CRITICAL):
- If a concept can be said in plain English, say it in plain English. "The price where a lot of stop-losses are clustered" not "the negative gamma wall." "Investors are really scared right now" not "extreme fear sentiment persists."
- When a technical term IS the clearest way to say something (like "basis points" or "moving average"), use it once and give context. "The ten-year yield moved up about fifteen basis points. That's a pretty meaningful one-day move for bonds."
- Never use more than ONE technical term per sentence without an explanation.
- If the written source has jargon, translate it. Your job is to make the listener smarter, not to prove you know the vocabulary.

DEPTH (SUBSTANCE IS SACRED):
The listener is smart and wants to get smarter. Simplify the LANGUAGE, never the THINKING. Keep every second-order effect, every "why this matters," every "where this might be wrong." Tighten wording, never ideas: you may deliver a four-sentence point in three well-chosen sentences, but all of its substance survives. Cut throat-clearing and repeated setup, not reasoning or evidence. When in doubt, include it. The specificity IS the value, and a section that arrives gutted has failed even if it is short.

SKIP: Markdown formatting, links, emoji, reference markers, story numbers, status labels, confidence scores, Validates/Rejects framework labels (but include the reasoning).

NUMBERS (CRITICAL FOR NATURAL SPEECH):
- Commodities & stock prices: ALWAYS round. Say "oil hit eighty-five dollars" NOT "$85.41". Say "gold above five thousand" NOT "$5,012.37". Only keep decimals if the decimal IS the story.
- Index levels: Round to nearest hundred or use natural speech. Say "S&P near fifty-eight hundred" NOT "5,782.76". Say "Nasdaq around twenty thousand."
- Yields & rates: Keep the precision. These move in basis points. Say "four point one four percent on the ten-year" or "the ten-year at four-fourteen." Never round a yield to a whole number.
- Percentage changes: Round to halves. Say "up about a point and a half" NOT "up 1.47%". Say "down roughly two percent" NOT "down 1.93%". Say "up about five percent" NOT "up 4.9%".
- Ranges: ALWAYS say "to" for ranges. Say "one point two to one point five percent" NOT "one point two one point five percent." The dash in "1.2-1.5%" is spoken as "to." Never read a range dash as "down" or skip it entirely. Same for basis point ranges: "twenty-five to fifty basis points."
- Crypto: Round to nearest thousand for BTC ("Bitcoin at seventy-two thousand"), nearest hundred for ETH. Only precise when a key level matters.
- Dollar amounts: "about one point two billion" NOT "1.2 billion dollars exactly." Use "trillion," "billion," "million."
- Basis points: Say "twenty-five basis points" NOT "25 bps." For context, "a quarter point" works too.
- Dates: Say "March sixth" NOT "March 6, 2026." Say "last Thursday" when the exact date isn't critical.
- Use natural approximation: "roughly," "about," "just under," "a little over," "nearly."

REPETITION (CRITICAL — THIS IS THE #1 LISTENER COMPLAINT):
- If a topic, fact, or data point was already covered in a previous section of this podcast (check the ALREADY COVERED list in TRANSITION CONTEXT), do NOT re-explain it. Reference it with a brief callback ("like we covered earlier") and move IMMEDIATELY to the NEW information this section adds.
- Never repeat the same fact, number, percentage, or framing twice in your output. If the intro already said rate hike odds collapsed from 52% to 2%, the Dashboard and Markets & Macro must NOT say that again. One mention is enough. After the second mention, the listener is annoyed.
- Each section should feel like it's adding something NEW to the listener's understanding, not reinforcing what they already heard two minutes ago.
- When in doubt, CUT the repeated fact entirely rather than re-stating it. The listener remembers.

SECTION NAMING (CRITICAL):
- Markets & Macro formally opens The Six. Wild Card gets a brief, natural introduction (e.g., "Now getting into today's Wild Cards"). All OTHER sub-sections of The Six should NOT be announced by name.
- Do NOT reference other section names as callbacks. Do NOT say "back in markets and macro" or "as we covered in the dashboard" by section name. Just say "earlier" or "a few minutes ago."

RULES:
- Do NOT add information not in the source
- Do NOT hallucinate data, quotes, or attributions
- Do NOT invent quotes and attribute them to people
- DIRECTIONAL ACCURACY IS CRITICAL: If the source says a price "broke above" or "reclaimed" a level, do NOT say it "fell below" or "broke down." If the source says something went UP, it went UP. Read the source carefully for direction before writing. Getting the direction wrong is the worst possible error.
- Do NOT say "have a nice weekend" or reference the weekend unless the date in the brief is actually a Friday. Check the date provided.
- Do NOT refer to Discovery content as "a read" or "a great article." It is original content being delivered in the podcast, not an external recommendation.
- Expand ALL abbreviations (YoY → "year over year", ETF → "E.T.F.", Q3 → "third quarter")
- Spell out ticker symbols (NVDA → "NVIDIA", MSTR → "MicroStrategy")

Return ONLY the spoken script for this section. No meta-commentary, no [bracketed notes].`;

/** Per-section user prompts — tailored instructions for what to emphasize.
 *
 * TRANSITION PHILOSOPHY: The podcast is ONE continuous conversation, not segments.
 * Each section should flow from the previous one. The TRANSITION CONTEXT block
 * (injected at call time) tells the scriptwriter what came before and after.
 * Transitions between bullets within a section matter just as much — don't just
 * start a new thought cold. Thread them: "Meanwhile..." / "On a completely different
 * front..." / "Speaking of infrastructure..." / "Now here's where it gets structural..."
 *
 * DO NOT OVERSIMPLIFY. The listener is smart. Keep the nuance, the second-order
 * effects, the "why this matters" reasoning. Simplify the language, not the thinking.
 */
const SECTION_INSTRUCTIONS: Record<string, string> = {
  'intro': 'Write a SHORT, energizing podcast opening. Say "Welcome to Markets, Meditations, and Mental Models" and the date naturally. Then say the episode title (the Daily Title from the brief — it appears as an H3 below the date). Then give the Intro Summary from the brief (the 2-3 italic sentences below the Daily Title). Keep it under 45 seconds when spoken. Direct and conversational, like greeting a friend. Do NOT include any quotes or epigraphs. The daily word of encouragement will be added separately. Do NOT use hype language. Do NOT introduce or preview The Dashboard at the end. A separate transition will handle that.',
  'light-intro': 'Write a SHORT, punchy podcast opening for the Super Brief. Say "Welcome to the Super Brief" and the date naturally. Then say the Daily Title (the editorial headline for the day). Then tease the top 1-2 stories in one sentence. Keep it under 20 seconds when spoken. Fast, direct, energized. No hype language. No quotes. Jump right in.',
  'The Dashboard': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the content. Structural regime read: what\'s the session\'s character, what regime is forming or breaking, and one structural observation per sub-section (Equities, Crypto, Commodities & Rates). The editorial product is the commentary. The website renders the data. Do NOT recite prices the listener can check themselves. Do NOT preview stories from The Six. Keep the full analytical depth. Simplify language, not thinking. Thread between sub-sections: if equities tell one story and bonds tell another, connect them.',
  'The Take': 'Do NOT introduce or announce this section by name. A separate transition handles that. Start with the topic: "We\'re looking at [topic/headline from the content]." Give the listener a one-sentence setup of what question or argument you\'re about to unpack. THEN build the argument naturally, like you\'re thinking through it in real time. This is the heart of the Markets section. Give it full treatment, don\'t compress. Explain any frameworks in plain language. If the listener has never heard of the concept, they should still follow the logic. This should feel like the most intellectually satisfying part of the episode. Keep ALL the nuance. The "where this might be wrong" is just as important as the thesis.',
  // Weekly-only top-level sections (THE SIGNAL and THE PREDICTIONS appear only in the Weekly)
  'The Signal': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first signal. Forward-looking tone: these are slow, structural things forming that most people are missing, each carried at week-view. Each signal ends with a clear if/then condition to watch. Make the if/then land in plain language. Give each signal what it needs. If signals connect, say so. Stay close to the written text. Do not over-simplify.',
  'The Predictions': 'Do NOT introduce or announce this section. A separate transition handles that. Start with the framing sentence, then deliver the standing calls. There is one call per horizon: next week, next month, next year. For EACH call, say the call clearly AND its single kill-switch condition (the one thing that would prove it wrong). The kill switch is as important as the call, never drop it. Keep it tight and concrete. Stay close to the written text; do not invent or re-direct a call.',
  'The Model': 'Do NOT introduce or announce this section. A separate transition handles that. Teach this mental model as a standalone concept using the timeless examples from the written text — do NOT connect it to today\'s news, markets, or any companies mentioned in earlier sections. Name the model, explain it with genuine intellectual energy, and land on the decision tool. This is an intellectual gift the listener keeps forever. The listener should feel like they just gained a new thinking tool.',
  'Inner Game': 'Do NOT introduce or announce this section. A separate transition handles that. Just start reading warmly and with genuine presence. Include the quote, the teaching, and the practical action. This is the personal, human moment of the episode. Let it breathe. Don\'t rush it. No market references here at all. This should feel like a gift. The listener should feel lighter and more grounded after hearing it. The energy shifts from analytical to reflective, but it should still feel uplifting, not heavy.',
  'Discovery': 'Do NOT introduce or announce this section. A separate transition handles that. Just start telling the story. This is an original essay. NOT a reading recommendation, NOT a list of cool facts (that was Wild Card). Discovery is ONE deep narrative with a single through-line argument. The energy here is slower, more reflective, more intellectually weighty than Wild Card. Tell the story with fascination but let it build. Explain the concept, the surprising finding, and why it reframes something the listener thought they understood. Do NOT say "this is a great read" or refer to it as something to read. You\'re delivering it right now. Stay very close to the written text. The essay was carefully constructed. End the episode on intellectual wonder. You are the FINAL content section: your last line must land like an ending, not a cliffhanger or an open loop — the sign-off follows immediately, so close the thought completely before you stop.',
  // Optional sections
  'Overnight': 'Quick overnight catch-up. Three to four key developments since last night. Keep it brisk and factual with "here\'s what happened while you were sleeping" energy. Each item gets 1-2 sentences. CRITICAL: Check the ALREADY COVERED list carefully. If an overnight development is already covered in the Dashboard or Markets & Macro, do NOT restate it. Either skip it entirely or say "we\'ll get into that in a moment" and move on. The listener should NEVER hear the same fact in Overnight and then again in the Dashboard or Six. Overnight only adds what\'s genuinely new since the evening brief was written.',
  'Deep Read / Listen': 'Skip this section entirely in audio. Do not read it. These are external link recommendations that don\'t work in audio format.',

  // Legacy sections — still used for processing older briefs
  'The Big Stories': 'Run through the big stories. Cover every story individually but efficiently. Headline, context, why it matters, what to watch.',
  "Tomorrow's Headlines": 'Cover every headline efficiently. For each: what happened, what it means going forward, and the signal.',
  // Watchlist is EXCLUDED from audio — it's internal-only content.

  // The Six sub-sections. Each gets its own API call to prevent compression.
  // Only Markets & Macro formally opens The Six. The rest flow as one conversation.
  'The Six: Markets & Macro': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first bullet. Cover every bullet. Give each bullet what it needs to land clearly. These are regime-based structural reads. Weave a narrative about what\'s shifting structurally. Connect bullets naturally, don\'t start each one cold. Skip any facts already covered in the intro or Dashboard (check ALREADY COVERED list). If something can be said more concisely without losing clarity or substance, compress it. But never skip substance to save time.',
  'The Six: Companies & Crypto': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first bullet. Cover every bullet. Each bullet gets its headline, why it matters, and what to watch. Give each bullet what it needs to land. If two stories rhyme, connect them. Avoid jargon where a normal word works, but keep the analytical depth.',
  'The Six: AI & Tech': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first bullet. Cover every bullet. Give each bullet what it needs. Explain what shipped, what changed, and why it matters. If multiple stories tell a bigger pattern, weave that thread briefly. Let genuine excitement come through naturally.',
  'The Six: Geopolitics': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first bullet. Cover every bullet. Give each bullet what it needs. Do NOT skip or merge bullets. When one theater dominates (e.g., a war), keep each bullet concise but PRESENT. The goal is geographic breadth. If Iran and BRICS+ are two sides of the same shift, connect them. Use plain language. "Iran is expanding its targets from oil infrastructure to civilian airports" not "the escalation matrix is broadening."',
  'The Six: Wild Card': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first item. Energy should be lighter and more curious. Cover each item with genuine curiosity and fascination. This is cross-disciplinary: science, culture, history. If items connect, say so. Stay close to the written text. Do not over-simplify or paraphrase loosely. The specificity is the value.',
  'The Six: The Signal': 'Do NOT introduce or announce this section. A separate transition handles that. Just start with the first signal. Tone shifts to forward-looking. These are things forming that most people are missing. Each one ends with a clear if/then. Make sure the if/then lands in plain language. Give each signal what it needs to land clearly. If signals connect, say so. Stay close to the written text. Do not over-simplify.',
  // Legacy sub-section — Inner Game was under The Six in pre-March-22 briefs
  'The Six: Inner Game': 'Read this warmly and slowly. Include the quote, the teaching, and the practical action. This is the personal, human moment. Let it breathe. No market references.',

  // Brief Light (Super Brief) sections
  'The Update': 'Do NOT introduce or announce this section — the transition handles it. Cover every story. Each one gets its headline, the key numbers, why it matters, and the "so what." STORY BOUNDARIES (critical): each story is its own beat. Open every new story with a brief, VARIED turn signal in a few words (Meanwhile / One more / The quieter one / On a different front) so the listener always knows a new story just started. Never let two stories blur into one sentence stream, and never bridge them with a fabricated connection. Do NOT skip any story. Stay close to the source text. The specificity is the value. Get to the insight fast. No throat-clearing.',
  'Markets Minute': 'Do NOT introduce or announce this section — the transition handles it. Quick, punchy market read. What\'s the character of the session or the week? Connect the dots between equities, crypto, commodities, and rates. If divergences tell a story, say so. Round prices naturally for speech. This should feel brisk but insightful.',
  'Interesting Things': 'Do NOT introduce or announce this section — the transition handles it; start directly with the first item. Lighter energy, genuine curiosity. These are fascinating things OUTSIDE the main stories. Science, health, breakthroughs, oddities. Each item is its own clear beat: open each new item on its own turn, never run two items together into one stream. Give each one what it needs to land. If items genuinely connect, say so. No invented wrap-up moral at the end — land the last item and stop. Stay close to the written text.',
  'The Meditation': 'Warm, present, reflective. Include the full quote and attribution. Then deliver the teaching and the practical action. Let it breathe. No rushing. This is the human moment. The listener should feel grounded after hearing it.',
};

/** Retry an async fn with exponential backoff on rate-limit (429) and server errors (5xx). */
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 2000, label = '' } = {}
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[audio] ${label} attempt ${attempt + 1} failed (${status}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

/** Context passed to each section for position and dedup awareness */
interface SectionContext {
  prevSection?: string | undefined;
  nextSection?: string | undefined;
  /** The previous section's TOPIC (its ### title or bold lead) — enables the
   *  one-clause bridge in teaching sections (Jackson 2026-07-06: the Model→Discovery
   *  seam played as two unrelated lectures even when the subjects rhymed). */
  prevTopic?: string | undefined;
  /** Key facts/data points already covered in earlier sections — DO NOT repeat these */
  alreadyCovered?: string[] | undefined;
}

/** Pull a section's topic for bridge context: its ### title, else its first bold lead. */
function extractSectionTopic(content: string): string | undefined {
  const heading = content.match(/^###\s+(.{4,90})$/m)?.[1]?.trim();
  if (heading) return heading;
  const bold = content.match(/\*\*([^*]{8,90})\*\*/)?.[1]?.trim();
  return bold || undefined;
}

// Act transitions are now handled by deterministic SECTION_TRANSITIONS in rewriteAsScript().
// No need for AI-generated act boundary cues — the transitions are structural scaffolding.

interface RewriteOpts {
  instructions?: Record<string, string>;
  systemPrompt?: string;
  /** Appended to the section instruction (weekly close handling, retry feedback, etc.) */
  instructionAddendum?: string;
  /** Appended to the system prompt (weekly edition framing) */
  systemPromptAddendum?: string;
}

/** Rewrite a single section via GPT-4o with retry */
async function rewriteSection(client: OpenAI, sectionName: string, content: string, context?: SectionContext, opts?: RewriteOpts): Promise<string> {
  // Which instruction set + system prompt to use. The super brief passes its own
  // (LIGHT_SECTION_INSTRUCTIONS + LIGHT_SECTION_SYSTEM_PROMPT) so its per-section
  // guidance actually applies — previously it was silently ignored.
  const instrDict = opts?.instructions ?? SECTION_INSTRUCTIONS;
  const systemPrompt = (opts?.systemPrompt ?? SECTION_SYSTEM_PROMPT) + (opts?.systemPromptAddendum ?? '');
  // Canonical lookup — tolerant of "The " header drift (see canonicalSectionKey).
  let instruction = lookupSection(instrDict, sectionName);
  if (!instruction) {
    for (const [key, val] of Object.entries(instrDict)) {
      if (sectionName.startsWith(key.split(':')[0] + ':')) {
        instruction = val;
        break;
      }
    }
  }
  if (!instruction) instruction = `Convert this "${sectionName}" section into natural spoken podcast form. Include ALL substantive content. Do not skip or compress anything.`;
  if (opts?.instructionAddendum) instruction += opts.instructionAddendum;

  // Build context for dedup and section awareness.
  // Transitions between sections are also injected deterministically after scriptwriting,
  // but the scriptwriter still needs to know where it sits in the episode to write
  // with appropriate depth and energy.
  let transitionContext = '';
  if (context) {
    const parts: string[] = [];
    if (context.prevSection) {
      parts.push(`PREVIOUS SECTION: "${context.prevSection}". The listener just heard this section before yours.`);
    }
    if (context.nextSection) {
      parts.push(`NEXT SECTION: "${context.nextSection}".`);
    }
    // Teaching-section bridge (Model / Discovery): the deterministic transition tells
    // the listener WHERE they are; this lets the script acknowledge WHY the subjects
    // sit next to each other — but only when the link is real.
    if (context.prevTopic) {
      const canon = canonicalSectionKey(sectionName);
      if (canon === 'model' || canon === 'discovery') {
        parts.push(`PREVIOUS SECTION TOPIC: "${context.prevTopic}". BRIDGE OPTION (narrow exception to the no-intro rule): IF your section's subject genuinely rhymes with that topic, you may open with ONE short clause that links the two SUBJECTS (never section names, never "speaking of," never a forced link). Example shape: "The last idea was about the cost of destroying information. This one is about what makes information trustworthy at all." If no genuine link exists, start cold with your first substantive point as usual.`);
      }
    }
    if (context.alreadyCovered && context.alreadyCovered.length > 0) {
      parts.push(`ALREADY COVERED (DO NOT REPEAT THESE — the listener has already heard them):\n${context.alreadyCovered.map(f => `- ${f}`).join('\n')}\nIf any of these facts appear in your source content, do not RE-EXPLAIN them at length; reference them with a brief callback like "as we mentioned earlier" and move to the new angle. BUT never drop a fact your section's own argument actually needs to land. If the point requires the number to make sense, say it again briefly. Only skip pure restatement that adds nothing. Preserving the argument always beats avoiding a repeat.`);
    }
    if (parts.length > 0) {
      transitionContext = '\n\nCONTEXT:\n' + parts.join('\n');
    }
  }

  try {
    const result = await withRetry(
      async () => {
        const resp = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `SECTION: ${sectionName}\n\nINSTRUCTION: ${instruction}${transitionContext}\n\nCONTENT:\n${content}` },
          ],
          temperature: 0.4,
          max_tokens: 8000,
        });
        const choice = resp.choices[0];
        const text = choice?.message?.content?.trim();
        if (!text) throw new Error('Empty response');
        // Truncation guard: if GPT stopped because it ran out of output room, the script
        // is cut mid-sentence and TTS will read the cut. Surface it loudly.
        if (choice?.finish_reason === 'length') {
          console.warn(`[audio] Section "${sectionName}" hit the output-token cap — the script may be cut mid-sentence. This section likely needs splitting.`);
        }
        return text;
      },
      { label: `GPT-4o "${sectionName}"` }
    );
    return result;
  } catch (err) {
    console.warn(`[audio] Section "${sectionName}" LLM failed after retries (${err}), using regex fallback`);
    return regexNormalize(content);
  }
}

/**
 * rewriteSection + mechanical script gate + one-shot regeneration on gutted output.
 * Used by BOTH the full-brief and super-brief paths — this is the audio counterpart
 * of the written pipeline's Validator: deterministic repair where safe, one retry
 * with explicit feedback when a section arrives gutted, warnings for the rest.
 */
async function rewriteSectionChecked(
  client: OpenAI,
  sectionName: string,
  content: string,
  context?: SectionContext,
  opts?: RewriteOpts,
): Promise<{ script: string; warnings: string[] }> {
  const first = await rewriteSection(client, sectionName, content, context, opts);
  // Intros are intentionally short — gate the repairs but skip the substance floor.
  const isIntro = /intro/i.test(sectionName);
  let checked = enforceScriptRules(sectionName, first, isIntro ? '' : content);

  if (checked.needsRetry && !isIntro) {
    const retryOpts: RewriteOpts = {
      ...opts,
      instructionAddendum:
        (opts?.instructionAddendum ?? '') +
        ' RETRY FEEDBACK: your previous attempt cut too much substance from this section. Rewrite it keeping EVERY substantive point, number, example, and step of the argument. Compress delivery only, never content.',
    };
    const second = await rewriteSection(client, sectionName, content, context, retryOpts);
    const secondChecked = enforceScriptRules(sectionName, second, content);
    // Keep whichever attempt preserved more substance.
    if (secondChecked.script.length > checked.script.length) {
      checked = { ...secondChecked, warnings: [...checked.warnings, ...secondChecked.warnings] };
    }
  }

  for (const w of checked.warnings) console.warn(`[audio:gate] ${w}`);
  return { script: checked.script, warnings: checked.warnings };
}

/**
 * Extract key facts/data points from a section's source text for cross-section deduplication.
 * Looks for specific patterns: named percentages, named price levels, named events with numbers.
 * Returns human-readable fact strings that can be injected into subsequent sections' context.
 */
function extractKeyFacts(text: string): string[] {
  const facts: string[] = [];
  if (!text) return facts;

  // Match "X% to Y%" or "from X% to Y%" patterns (e.g., "rate hike odds from 52% to 2.2%")
  const pctShiftPattern = /(?:from\s+)?([\d.]+%)\s+(?:to|down to|up to)\s+([\d.]+%)/gi;
  let match: RegExpExecArray | null;
  while ((match = pctShiftPattern.exec(text)) !== null) {
    const idx = match.index;
    const contextStart = Math.max(0, idx - 80);
    const contextEnd = Math.min(text.length, idx + match[0].length + 30);
    const surrounding = text.slice(contextStart, contextEnd).replace(/[\n\r]+/g, ' ').trim();
    facts.push(surrounding);
  }

  // Match large percentage gains/losses (e.g., "+58%", "58% monthly gain")
  const bigPctPattern = /(?:\+|-)?(\d{2,3})%\s+(?:monthly|weekly|daily|annual|ytd|gain|loss|increase|decrease|drop|surge|spike|rise|fall)/gi;
  while ((match = bigPctPattern.exec(text)) !== null) {
    const idx = match.index;
    const contextStart = Math.max(0, idx - 60);
    const contextEnd = Math.min(text.length, idx + match[0].length + 20);
    const surrounding = text.slice(contextStart, contextEnd).replace(/[\n\r]+/g, ' ').trim();
    facts.push(surrounding);
  }

  // Match specific price levels with context (e.g., "$115.35", "6,426")
  const priceLevelPattern = /\$[\d,]+\.?\d*\s*(?:\/(?:gallon|barrel|lb))?/g;
  while ((match = priceLevelPattern.exec(text)) !== null) {
    const idx = match.index;
    const contextStart = Math.max(0, idx - 50);
    const contextEnd = Math.min(text.length, idx + match[0].length + 30);
    const surrounding = text.slice(contextStart, contextEnd).replace(/[\n\r]+/g, ' ').trim();
    if (surrounding.length > 20) {
      facts.push(surrounding);
    }
  }

  // Match "largest/biggest/first since/in X years/history" superlatives
  const superlativePattern = /(?:largest|biggest|highest|lowest|worst|best|first|record)\s+(?:since|in)\s+[\w\s,'-]+/gi;
  while ((match = superlativePattern.exec(text)) !== null) {
    const fact = match[0].replace(/[\n\r]+/g, ' ').trim();
    if (fact.length > 15 && fact.length < 120) {
      facts.push(fact);
    }
  }

  // Percentages — glyph OR spelled "percent". The briefs spell them out ("73 percent"),
  // so the %-glyph patterns above miss them entirely. (July 1, 2026 — the yen/flows repeat.)
  const percentPattern = /([\d.]+)\s*(?:%|percent)\b/gi;
  while ((match = percentPattern.exec(text)) !== null) {
    const idx = match.index;
    const surrounding = text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + match[0].length + 25)).replace(/[\n\r]+/g, ' ').trim();
    if (surrounding.length > 12) facts.push(surrounding);
  }

  // Distinctive bare price levels the $-pattern misses: thousands-separated (52,319),
  // 3+ straight digits (162, 4000), or a decimal level (4.44). Skips years. This is how
  // "the yen broke 162" finally becomes dedupable — it is neither $-prefixed nor a percent.
  const bareLevelPattern = /\b(\d{1,3}(?:,\d{3})+|\d{3,}|\d+\.\d{1,2})\b/g;
  while ((match = bareLevelPattern.exec(text)) !== null) {
    const raw = match[1]!;
    if (/^(19|20)\d{2}$/.test(raw.replace(/,/g, ''))) continue; // years, not data points
    const idx = match.index;
    const surrounding = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + match[0].length + 25)).replace(/[\n\r]+/g, ' ').trim();
    if (surrounding.length > 12) facts.push(surrounding);
  }

  // Extract topic-level subjects from bolded headlines (e.g., "**Liberation Day turned one year old**")
  // This catches repetition where the same TOPIC appears across sections with different numbers.
  const boldPattern = /\*\*([^*]{15,120})\*\*/g;
  while ((match = boldPattern.exec(text)) !== null) {
    const headline = match[1]!.replace(/[\n\r]+/g, ' ').trim();
    // Extract the core subject (first ~60 chars, up to the first comma or period)
    const core = headline.split(/[,.]/, 1)[0]!.trim();
    if (core.length > 10) {
      facts.push(`TOPIC: ${core}`);
    }
  }

  // Deduplicate very similar facts (substring containment)
  const unique: string[] = [];
  for (const fact of facts) {
    const dominated = unique.some(existing =>
      existing.includes(fact) || fact.includes(existing)
    );
    if (!dominated) {
      unique.push(fact);
    }
  }

  // Cap at 20 facts to avoid bloating the prompt (increased from 15 to accommodate topics)
  return unique.slice(0, 20);
}

/** Rewrite the full brief as a podcast script. Tries parallel first, falls back to sequential. */
// ─── Weekly edition framing ──────────────────────────────────────────────────
// The Weekly ran through the daily's prompt, transitions, and sign-off on its first
// live run (2026-W27): "today's Six" on a week-in-review, a "we'll be back tomorrow"
// sign-off stacked cold on top of the weekly's own written close, and a sub-30-minute
// target applied to a 35-minute-read product. Everything weekly-flavored lives here.

const WEEKLY_SYSTEM_PROMPT_ADDENDUM = `

WEEKLY EDITION (this episode is THE WEEKLY, the Sunday zoom-out over the whole week):
- Say "this week" / "the week", never "today" — the listener is hearing a week in review.
- LENGTH: the written Weekly is roughly a 35-minute read. Land the spoken version UNDER 40 minutes, NOT under 30. Do not compress it to a daily's length. The substance-beats-the-clock tiebreaker is even stronger here: if keeping everything runs long, run long.
- The listener is on a slower Sunday clock. Let the teachings and the endings breathe.`;

// ─── Deterministic transition phrases ────────────────────────────────────────
// Injected BETWEEN sections after scriptwriting completes. No AI — structural
// scaffolding that tells the listener where they are. Module-scoped and exported
// so the regression test (scripts/audio-gate-regression.ts) exercises the REAL maps.
export const SECTION_TRANSITIONS: Record<string, string> = {
  'The Dashboard': 'Alright, let\'s start with the markets. Here\'s the Dashboard.',
  'The Six: Markets & Macro': 'OK, let\'s jump into today\'s Six, starting with Markets and Macro.',
  'The Six: Companies & Crypto': 'Now moving over to Companies and Crypto.',
  'The Six: AI & Tech': 'Next up, A.I. and Tech.',
  'The Six: Geopolitics': 'Now to the geopolitical picture.',
  'The Six: Wild Card': 'Now getting into today\'s Wild Cards. The coolest things we found happening around the globe.',
  'The Six: The Signal': 'And wrapping up The Six with The Signal. Things that are forming that most people aren\'t watching yet.',
  // Weekly-only top-level sections
  'The Signal': 'Now to The Signal. The slow, structural things forming underneath the week that most people aren\'t watching yet.',
  'The Take': 'Now let\'s take a deep dive into one of the biggest stories we\'re monitoring. For today\'s Take.',
  'The Predictions': 'And now The Predictions. Where we put our standing calls on the record, each with the one thing that would prove it wrong.',
  'Inner Game': 'That\'s all we have for today\'s markets. Let\'s take a deep breath, and settle into today\'s meditation.',
  'The Model': 'OK, let\'s get the brain working. Time for Mental Models.',
  'Discovery': 'And finally, today\'s Discovery.',
};

/** Weekly overrides for the deterministic transitions (canonical-name lookup). */
export const WEEKLY_TRANSITION_OVERRIDES: Record<string, string> = {
  'The Six: Markets & Macro': 'OK, let\'s jump into the week\'s Six, starting with Markets and Macro.',
  'The Six: Wild Card': 'Now for the week\'s Wild Card. The story that has nothing to do with markets and everything to do with how the world actually works.',
  'The Take': 'Now let\'s take a deep dive into the biggest current running under the week. For this week\'s Take.',
  'Inner Game': 'That\'s the week\'s markets. Let\'s take a deep breath, and settle into this week\'s meditation.',
  'The Model': 'OK, let\'s get the brain working. Time for this week\'s Mental Model.',
  'Discovery': 'And finally, this week\'s Discovery.',
};

export const DAILY_SIGN_OFF = 'That\'s today\'s brief. Thank you for spending part of your morning with us. Hopefully you\'re walking away a bit more informed, a bit more grounded, and a bit more curious about what\'s forming around the corner. We\'ll be back tomorrow with more. Until then. Yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it\'s called the present. Take care.';

/** Weekly sign-off — opens with a bridge so it never lands cold after the close. */
export const WEEKLY_SIGN_OFF = 'And that closes out the week. Thank you for spending part of your Sunday with us. Hopefully you\'re stepping into the new week a bit more informed, a bit more grounded, and a bit more curious about what\'s forming around the corner. The daily brief is back tomorrow morning. Until then. Yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it\'s called the present. Take care.';

/** The weekly's written close (final paragraph after Discovery) has no section marker,
 *  so it rides inside Discovery's content. W27 delivered the essay's falsification
 *  challenge and then jumped cold to the week-summary close — this addendum makes the
 *  scriptwriter treat the close as the episode's landing, not part of the essay. */
const WEEKLY_DISCOVERY_CLOSE_ADDENDUM =
  ' WEEKLY CLOSE (critical): the final paragraph of your content, after the essay ends, is the episode\'s written closing reflection on the whole week. It is NOT part of the essay. Finish the essay completely and let it land. Then start a new paragraph, bridge in one short line (for example: "Which brings us back to the week itself."), and deliver that closing reflection with the unhurried weight of an ending. It is the last thing the listener hears before the sign-off.';

async function rewriteAsScript(parsed: ParsedBriefForAudio, openaiApiKey: string, epigraph: string, isWeekly = false): Promise<string> {
  const client = new OpenAI({ apiKey: openaiApiKey });

  // Build all section tasks: intro + each content section
  const tasks: { index: number; name: string; content: string }[] = [];

  // Intro: hard-inject the epigraph verbatim so GPT-4o can't hallucinate a different quote.
  // GPT-4o only writes the hook — the epigraph is prepended after.
  tasks.push({
    index: 0,
    name: 'intro',
    content: `DATE: ${parsed.displayDate}\nLEDE: ${parsed.lede}`,
    _epigraph: epigraph, // carried through for post-processing
  } as any);

  for (let i = 0; i < parsed.sections.length; i++) {
    const sec = parsed.sections[i]!;
    tasks.push({ index: i + 1, name: sec.name, content: sec.content });
  }

  // ─── Cross-section deduplication ───────────────────────────────────────
  // Extract key facts from the lede (which the intro covers first). Any section
  // that repeats these facts should reference them briefly, not re-explain.
  // Also detect facts that appear in multiple sections' source content.
  const ledeFacts = extractKeyFacts(parsed.lede);
  console.log(`[audio] Lede key facts for dedup: ${ledeFacts.length} facts`);

  // Build a map: for each section index, which facts were already stated in earlier sections
  const sectionSourceTexts = tasks.map(t => t.content);
  const cumulativeFacts: Map<number, string[]> = new Map();

  // The intro (index 0) covers the lede — its facts propagate to all subsequent sections
  cumulativeFacts.set(0, []);
  const runningFacts = [...ledeFacts];

  for (let i = 1; i < tasks.length; i++) {
    // This section should know about all facts from earlier sections
    cumulativeFacts.set(i, [...runningFacts]);
    // Extract facts from this section's source to propagate forward
    const thisSectionFacts = extractKeyFacts(tasks[i]!.content);
    runningFacts.push(...thisSectionFacts);
  }

  // Strategy 1: Parallel (fast — all sections at once)
  try {
    console.log(`[audio] Rewriting ${tasks.length} sections in parallel via GPT-4o...`);

    const optsFor = (name: string): RewriteOpts | undefined =>
      isWeekly
        ? {
            systemPromptAddendum: WEEKLY_SYSTEM_PROMPT_ADDENDUM,
            ...(canonicalSectionKey(name).includes('discovery')
              ? { instructionAddendum: WEEKLY_DISCOVERY_CLOSE_ADDENDUM }
              : {}),
          }
        : undefined;

    const results = await Promise.all(
      tasks.map(async (task) => {
        console.log(`[audio] Section ${task.index + 1}: ${task.name}...`);
        const prevTask = tasks.find(t => t.index === task.index - 1);
        const nextTask = tasks.find(t => t.index === task.index + 1);
        const context: SectionContext = {
          prevSection: prevTask?.name,
          nextSection: nextTask?.name,
          prevTopic: prevTask ? extractSectionTopic(prevTask.content) : undefined,
          alreadyCovered: cumulativeFacts.get(task.index),
        };
        const { script } = await rewriteSectionChecked(client, task.name, task.content, context, optsFor(task.name));
        console.log(`[audio]   → ${script.length} chars`);
        return { index: task.index, name: task.name, script };
      })
    );

    // Check how many fell back to regex (indicates rate limiting)
    const avgLen = results.reduce((s, r) => s + r.script.length, 0) / results.length;
    const shortCount = results.filter(r => r.script.length < avgLen * 0.3).length;

    if (shortCount > results.length * 0.4) {
      console.warn(`[audio] ${shortCount}/${results.length} sections look regex-fallback — retrying`);
      throw new Error('Too many regex fallbacks');
    }

    results.sort((a, b) => a.index - b.index);

    // ─── Stitch sections with deterministic transitions ───────────────
    const stitchedParts: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      // Canonical lookup + weekly overrides — exact-match lookups silently dropped
      // the Wild Card transition for months when the header drifted to "The Wild Card".
      const transition =
        (isWeekly ? lookupSection(WEEKLY_TRANSITION_OVERRIDES, result.name) : undefined) ??
        lookupSection(SECTION_TRANSITIONS, result.name);

      // Inject transition phrase before the section content (if one exists)
      if (transition) {
        stitchedParts.push(transition + '\n\n' + result.script);
      } else {
        if (i > 0) {
          console.warn(`[audio:gate] No transition for section "${result.name}" — it will start cold. Add it to SECTION_TRANSITIONS.`);
        }
        stitchedParts.push(result.script);
      }
    }

    // Hard-inject the epigraph into the intro (index 0) — leads the episode
    if (epigraph && stitchedParts[0]) {
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      stitchedParts[0] = `${cleanEpigraph}\n\n${stitchedParts[0]}`;
    }

    // Append standard sign-off verbatim (never sent through GPT-4o).
    // Weekly gets its own sign-off with a built-in bridge — the daily one said
    // "today's brief / back tomorrow" cold on top of the weekly's written close.
    stitchedParts.push(isWeekly ? WEEKLY_SIGN_OFF : DAILY_SIGN_OFF);

    // Add pause markers between sections for natural breathing room in TTS.
    const SECTION_PAUSE = '\n\n...\n\n';
    const totalChars = stitchedParts.reduce((sum, s) => sum + s.length, 0);
    console.log(`[audio] Total script: ${totalChars} chars across ${stitchedParts.length} sections`);
    return stitchedParts.join(SECTION_PAUSE);

  } catch (parallelErr) {
    // Strategy 2: Sequential fallback (slower but gentler on rate limits)
    console.warn(`[audio] Parallel rewrite failed (${parallelErr}), falling back to sequential...`);

    const scriptParts: string[] = [];
    const seqRunningFacts = [...ledeFacts];
    for (let ti = 0; ti < tasks.length; ti++) {
      const task = tasks[ti]!;
      console.log(`[audio] [sequential] Section ${task.index + 1}: ${task.name}...`);
      const prevTask = ti > 0 ? tasks[ti - 1] : undefined;
      const nextTask = ti < tasks.length - 1 ? tasks[ti + 1] : undefined;
      const context: SectionContext = {
        prevSection: prevTask?.name,
        nextSection: nextTask?.name,
        prevTopic: prevTask ? extractSectionTopic(prevTask.content) : undefined,
        alreadyCovered: ti > 0 ? [...seqRunningFacts] : [],
      };
      const seqOpts: RewriteOpts | undefined = isWeekly
        ? {
            systemPromptAddendum: WEEKLY_SYSTEM_PROMPT_ADDENDUM,
            ...(canonicalSectionKey(task.name).includes('discovery')
              ? { instructionAddendum: WEEKLY_DISCOVERY_CLOSE_ADDENDUM }
              : {}),
          }
        : undefined;
      const { script } = await rewriteSectionChecked(client, task.name, task.content, context, seqOpts);

      // Inject deterministic transition before section content (canonical lookup + weekly overrides)
      const transition =
        (isWeekly ? lookupSection(WEEKLY_TRANSITION_OVERRIDES, task.name) : undefined) ??
        lookupSection(SECTION_TRANSITIONS, task.name);
      if (transition) {
        scriptParts.push(transition + '\n\n' + script);
      } else {
        if (ti > 0) {
          console.warn(`[audio:gate] No transition for section "${task.name}" — it will start cold. Add it to SECTION_TRANSITIONS.`);
        }
        scriptParts.push(script);
      }

      console.log(`[audio]   → ${script.length} chars`);
      seqRunningFacts.push(...extractKeyFacts(task.content));
      await new Promise(r => setTimeout(r, 300));
    }

    // Hard-inject epigraph into intro (sequential path)
    if (epigraph && scriptParts[0]) {
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      scriptParts[0] = `${cleanEpigraph}\n\n${scriptParts[0]}`;
    }

    scriptParts.push(isWeekly ? WEEKLY_SIGN_OFF : DAILY_SIGN_OFF);

    const SECTION_PAUSE_SEQ = '\n\n...\n\n';
    const totalChars = scriptParts.reduce((sum, s) => sum + s.length, 0);
    console.log(`[audio] Total script (sequential): ${totalChars} chars across ${scriptParts.length} sections`);
    return scriptParts.join(SECTION_PAUSE_SEQ);
  }
}

// ─── Main preprocessor ─────────────────────────────────────────────────────

export interface PreprocessedBrief {
  /** The full text ready for TTS, all sections concatenated */
  fullText: string;
  /** Per-section labels (for logging/metadata) */
  sections: { id: string; label: string; text: string }[];
  /** Approximate character count (for cost estimation) */
  characterCount: number;
}

export interface PreprocessOptions {
  /** OpenAI API key for scriptwriter rewrite */
  openaiApiKey?: string;
  /** Skip LLM scriptwriter (faster, cheaper, regex-only) */
  skipLlmCleanup?: boolean;
  /** Raw markdown of the brief (optional — enables more reliable section parsing) */
  rawMarkdown?: string;
  /** Weekly mode — reads the weekly section set (adds THE SIGNAL + THE PREDICTIONS).
   *  Leave false/undefined for the daily, which must read exactly as before. */
  isWeekly?: boolean;
}

/**
 * Convert a parsed DailyBrief into TTS-ready spoken text.
 *
 * Pipeline: extract raw content → GPT-4o scriptwriter rewrite → regex normalization
 */
export async function preprocessBriefForTTS(
  brief: { date: string; displayDate: string; epigraph: string; lede: string; sections: { id: string; label: string; content: string }[] },
  options: PreprocessOptions = {}
): Promise<PreprocessedBrief> {
  // Step 1: Extract raw content from selected sections
  const { rawContent, parsed } = extractRawContent(brief, options.rawMarkdown, options.isWeekly);

  console.log(`[audio] Extracted ${parsed.sections.length} sections: ${parsed.sections.map(s => s.name).join(', ')}`);
  console.log(`[audio] Raw content: ${rawContent.length} characters`);

  // Warn about expected sections that weren't found (helps diagnose formatting issues)
  const expectedNames = (options.isWeekly ? WEEKLY_AUDIO_SECTIONS : AUDIO_SECTIONS).map(s => s.name);
  const foundNames = new Set(parsed.sections.map(s => (s.name.split(':')[0] ?? s.name).trim()));
  const missingSections = expectedNames.filter(n => !foundNames.has(n));
  if (missingSections.length > 0) {
    console.warn(`[audio] ⚠️  Missing expected sections: ${missingSections.join(', ')}. Check brief formatting — headers must be "# ▸ SECTION NAME" format.`);
  }

  // Extract epigraph for the intro
  let epigraph = '';
  const rawMd = options.rawMarkdown || '';
  if (rawMd) {
    for (const line of rawMd.split('\n').slice(0, 30)) {
      const trimmed = line.trim();
      // Match blockquote italic: > *text* or >*text*
      if (trimmed.startsWith('> *') || trimmed.startsWith('>*') || trimmed.startsWith('> "') || trimmed.startsWith('>"')) {
        epigraph = trimmed.replace(/^>\s*/, '').replace(/\*(.+?)\*/g, '$1').trim();
        if (epigraph.length > 20) break;
      }
      // Match plain italic on its own line: *text* (not bold **text**)
      // Must appear in first 5 lines (before the date header)
      if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**') && trimmed.length > 20) {
        epigraph = trimmed.slice(1, -1).trim();
        break;
      }
    }
  } else if (brief.epigraph) {
    epigraph = brief.epigraph.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  }

  let fullText: string;

  // Step 2: Rewrite as conversational podcast script via GPT-4o (per-section)
  if (!options.skipLlmCleanup && options.openaiApiKey) {
    try {
      console.log('[audio] Rewriting as conversational podcast script (GPT-4o, per-section)...');
      const script = await rewriteAsScript(parsed, options.openaiApiKey, epigraph, options.isWeekly ?? false);
      // Step 3: Regex normalize the output to catch anything the LLM missed
      fullText = regexNormalize(script);
      console.log(`[audio] Script: ${fullText.length} characters`);
    } catch (err) {
      console.warn('[audio] Scriptwriter failed, falling back to regex-only:', err);
      fullText = regexNormalize(rawContent);
    }
  } else {
    // Regex-only fallback
    fullText = regexNormalize(rawContent);
  }

  // Build section metadata (for logging — the script is one continuous piece now)
  const sections = parsed.sections.map(s => ({
    id: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: s.name,
    text: '', // individual section text not meaningful after scriptwriter rewrite
  }));

  return {
    fullText,
    sections,
    characterCount: fullText.length,
  };
}

// ─── Exports for testing ────────────────────────────────────────────────────

// ─── Brief Light preprocessor ──────────────────────────────────────────────

// ─── Brief Light pronunciation dictionary ──────────────────────────────────
// Words that TTS mispronounces or that confuse listeners in audio context.

const LIGHT_PRONUNCIATIONS: Record<string, string> = {
  'Morpho': 'MORE-fo',
  'MORPHO': 'MORE-fo',
  'Hormuz': 'hor-MOOZ',
  'Ghalibaf': 'gah-lee-BAHF',
  'Witkoff': 'WIT-koff',
  'DeepSeek': 'Deep Seek',
  'Ascend': 'Ascend',
  'Giffen': 'GIFF-en',
  'DeFi': 'Dee-Fi',
  'CeFi': 'See-Fi',
  'TVL': 'T.V.L.',
  'AUM': 'assets under management',
  'ReArm': 'Re-Arm',
  'QT': 'quantitative tightening',
  'bps': 'basis points',
};

function applyLightPronunciations(text: string): string {
  for (const [word, pronunciation] of Object.entries(LIGHT_PRONUNCIATIONS)) {
    // Only replace standalone words (not inside other words)
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    text = text.replace(pattern, pronunciation);
  }
  return text;
}

// ─── Brief Light section ordering & transitions ────────────────────────────

/** Desired section order for audio. Selection format leads with THE UPDATE (the day's
 *  stories), then the market read — matching the written brief and the web renderer.
 *  Ideas-first has no the-update, so it leads with the-idea/also-moving then markets-minute. */
const LIGHT_SECTION_ORDER = [
  'the-idea',          // ideas-first LEAD — the whole point opens the brief
  'also-moving',       // ideas-first secondary
  'the-update',        // selection-format LEAD — stories first, like the written brief
  'markets-minute',    // market-state read, after the stories/ideas
  'interesting-things',
  'our-calls',         // weekly-light-only — the predictions nod (absent in daily lights)
  'the-meditation',
  'the-model',
  'the-close',
];

const LIGHT_SECTION_TRANSITIONS: Record<string, string> = {
  'the-idea': 'Let\'s get into today\'s biggest ideas.', // fired once before the first idea
  'also-moving': 'A few other things moving today.',
  // Markets Minute was '' (mid-flow) — Jackson 2026-07-05: the turn into it was
  // unclear. Every section gets an explicit deterministic lead-in.
  'markets-minute': 'Quick markets minute. Today\'s tape, fast.',
  'the-update': 'Alright, here\'s what\'s driving the conversation today.',
  // "A couple" shipped over five items on W27 — count-agnostic wording.
  'interesting-things': 'A few things that caught our eye outside the main stories.',
  'our-calls': 'And quickly, where our standing calls sit going forward.',
  'the-meditation': 'OK. Let\'s take a breath. Time for today\'s meditation.',
  'the-model': 'And finally, today\'s mental model.',
  'the-close': '',  // No transition — the close IS the sign-off
};

/** Weekly-light overrides — the Sunday product must not say "today" (W27 shipped
 *  "driving the conversation today" on a week-in-review). Resolved before the
 *  daily map when PreprocessOptions.isWeekly is set. */
const LIGHT_WEEKLY_TRANSITION_OVERRIDES: Record<string, string> = {
  'the-update': 'Alright, here\'s what drove the week.',
  'markets-minute': 'Quick markets minute. The week\'s tape, fast.',
  'the-meditation': 'OK. Let\'s take a breath. Time for this week\'s meditation.',
  'the-model': 'And finally, this week\'s mental model.',
};

// Dedicated system prompt for the SUPER BRIEF. The super brief is already curated and
// distilled, so unlike the full brief it must NOT be compressed again — deliver it nearly
// whole, conversationally, around 10 minutes. (Previously the super brief borrowed the
// full-brief prompt, which told it to compress to a 30-35 min target — the root of the
// over-compression and the fabricated closing summary.)
const LIGHT_SECTION_SYSTEM_PROMPT = `You are the scriptwriter for the SUPER BRIEF, the short daily audio from "Markets, Meditations, and Mental Models."

WHAT THIS IS: the super brief is ALREADY a tight, curated, distilled product (roughly 1,500 words). It is NOT a long episode to compress. Your job is to deliver it nearly WHOLE in a natural spoken voice, landing around 10 minutes. Do NOT compress it further. It was already compressed once on the page, and compressing it again is exactly the failure we are fixing.

THE BALANCE (read twice):
- You MAY smooth and tighten DELIVERY: contractions, natural rhythm, drop a redundant connective, round a price for speech. It does NOT have to be word-for-word.
- You may NOT drop substance. Every idea keeps its news hook, its bigger idea, and its honest "what would change my mind." The meditation reads in FULL: the setup, the quote and author, the whole reflection, the practice. The model is TAUGHT in full: example, mechanism, and the "Use it." Each Two Things bullet is read. Nothing substantive is left on the floor.
- Test: could the listener reconstruct every idea and its turn from your script? If yes, you delivered it right. If a point is gone, that is the lossy compression we are killing.

FIDELITY (NON-NEGOTIABLE): say what the brief says. Never swap a concept for a different one. If the brief says "the AI stack," never say "the blockchain stack." Never invent a number, a claim, or a connection the brief did not make. Connecting two stories the brief connects is good. Inventing one is a lie.

THE CLOSE: deliver the brief's written close as one or two warm spoken sentences. Do NOT write a recap or summary of the episode. Never summarize what the listener just heard. If the brief's close is one line, your close is one line.

NO REPETITION (the listener hears this once, linearly): never state the same figure or the same framing more than TWICE across the whole episode. Each story tells itself once. If a story already delivered its number, MARKETS MINUTE and any later section must NOT recap that same figure — give the levels the stories did not dwell on, or reference the move without restating the number ("the same yen move we covered"). Check the ALREADY COVERED list in the transition context. After the second mention, the listener is annoyed.

VOICE: a smart friend talking something through out loud, not reading aloud and not performing. Energized and awake, never doom, never NPR-flat. Contractions everywhere.

NO SECTION INTROS: a deterministic transition is added before your section. Do not announce or frame the section. Start with the first substantive sentence.

BANNED: em-dashes (use a period or a comma instead), "buckle up," "here's where it gets interesting," "let that sink in," "at the end of the day," and hype filler. Spell numbers for natural speech and round where it helps. Skip markdown, links, and reference markers.`;

const LIGHT_SECTION_INSTRUCTIONS: Record<string, string> = {
  'light-intro': 'Open the episode in two or three warm, energetic sentences. Use the DAILY TITLE and the lead idea HEADLINE to set up the big ideas coming, and make the listener want to stay. Do not summarize the whole brief; just open the door. No "welcome back," no throat-clearing.',
  'The Idea': 'Deliver this as one genuine market idea: state the idea and why it matters, ground it in the news that surfaced it, and include the honest "what would change my mind." Keep the through-line tight — the idea is the point, the news is the evidence. Stay close to the source text; do not invent numbers or calls not in it.',
  'Also Moving': 'Brisk and secondary. A couple of things moving that did not rise to a full idea today. One or two sentences each. Keep it light and quick.',
  'The Update': 'Do NOT introduce or announce this section — the transition handles it. Cover every story. Each one gets its headline, the key numbers, why it matters, and the "so what." STORY BOUNDARIES (critical): each story is its own beat. Open every new story with a brief, VARIED turn signal in a few words (Meanwhile / One more / The quieter one / On a different front) so the listener always knows a new story just started. Never let two stories blur into one sentence stream, and never bridge them with a fabricated connection. Do NOT skip any story. Stay close to the source text. The specificity is the value. Get to the insight fast. No throat-clearing.',
  'Markets Minute': 'Do NOT introduce or announce this section — the transition handles it. Quick, punchy market read. What\'s the character of the session or the week? Connect the dots between equities, crypto, commodities, and rates. If divergences tell a story, say so. Round prices naturally for speech. This should feel brisk but insightful.',
  'Interesting Things': 'Do NOT introduce or announce this section — the transition handles it; start directly with the first item. Lighter energy, genuine curiosity. These are fascinating things OUTSIDE the main stories. Science, health, breakthroughs, oddities. Each item is its own clear beat: open each new item on its own turn, never run two items together into one stream. Give each one what it needs to land. If items genuinely connect, say so. No invented wrap-up moral at the end — land the last item and stop. Stay close to the written text.',
  'Our Calls': 'Brisk and concrete. These are our three standing calls going forward: next week, next month, next year. Say each call in one clear line AND its single kill-switch condition (the one thing that would prove it wrong). If a call came due, give its one-line grade first. Keep it tight, this is the accountability nod, not a deep dive. Stay close to the written text; do not invent or re-direct a call.',
  'The Meditation': 'Warm, present, reflective. This is the FULL Inner Game and a centerpiece of the brief: read it complete, do NOT shorten or summarize. Deliver the opening setup, the full quote and attribution, the entire reflection, and the closing practice. Let it breathe. No rushing. This is the human moment. The listener should feel grounded after hearing it.',
  'The Model': 'This is the brief\'s deep keeper: the one reusable idea the listener takes away. Teach it, do not just name it. Give the vivid example, explain the mechanism (why it is true), then land on the bolded "Use it" decision tool they can apply today. Use the timeless examples from the written text and do NOT tie it to today\'s news, markets, or companies. Keep it clear and unhurried; the listener should finish with something genuinely useful they will reuse.',
  'The Close': 'Warm, brief sign-off. This is the last thing the listener hears. Land it cleanly — don\'t trail off. One or two sentences that feel like a human saying goodbye. No market references, no previews of tomorrow.',
};

/**
 * Fidelity tripwire. Compares the spoken script to the written source and flags lossy
 * compression (script far shorter than the brief = gutted sections) or bloat (far longer
 * = padding/verbatim). Runs at generation time so a bad episode is caught in the logs,
 * not days later on the podcast. Word-ratio based, which is robust to numbers being
 * spelled out for speech.
 */
export function checkScriptFidelity(
  sourceText: string,
  script: string,
  opts?: { minRatio?: number; maxRatio?: number },
): { ok: boolean; warnings: string[]; ratio: number; sourceWords: number; scriptWords: number } {
  const minRatio = opts?.minRatio ?? 0.6;
  const maxRatio = opts?.maxRatio ?? 1.8;
  const sourceWords = sourceText.split(/\s+/).filter(Boolean).length;
  const scriptWords = script.split(/\s+/).filter(Boolean).length;
  const ratio = sourceWords > 0 ? scriptWords / sourceWords : 1;
  const warnings: string[] = [];
  if (ratio < minRatio) {
    warnings.push(`LOSSY: the spoken script is only ${Math.round(ratio * 100)}% of the brief's length (${scriptWords} vs ${sourceWords} words). Sections are likely gutted; regenerate or raise fidelity before this ships.`);
  }
  if (ratio > maxRatio) {
    warnings.push(`BLOATED: the spoken script is ${Math.round(ratio * 100)}% of the brief's length; it may be padding or reading verbatim.`);
  }
  return { ok: warnings.length === 0, warnings, ratio, sourceWords, scriptWords };
}

/**
 * Preprocess a Brief Light for TTS. Dedicated pipeline that handles
 * Brief Light section ordering, transitions, and instructions natively
 * (does NOT reuse the full brief's rewriteAsScript which expects different markers).
 */
export async function preprocessBriefLightForTTS(
  brief: {
    date: string;
    displayDate: string;
    dailyTitle?: string;
    epigraph: string;
    sections: { id: string; label: string; content: string; title?: string }[];
  },
  options: PreprocessOptions = {}
): Promise<PreprocessedBrief> {
  // Reorder sections per LIGHT_SECTION_ORDER. Use a per-id sweep (not find) so multiple
  // "the-idea" sections are all included, in document order.
  const ordered: { id: string; label: string; content: string; title?: string }[] = [];
  for (const id of LIGHT_SECTION_ORDER) {
    for (const s of brief.sections) if (s.id === id) ordered.push(s);
  }
  // Append any sections not in the order list
  for (const s of brief.sections) {
    if (!ordered.includes(s)) ordered.push(s);
  }

  console.log(`[audio:light] Sections (ordered): ${ordered.map(s => s.label).join(' → ')}`);

  // Extract epigraph
  const epigraph = brief.epigraph
    ? brief.epigraph.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    : '';

  let fullText: string;

  if (!options.skipLlmCleanup && options.openaiApiKey) {
    try {
      console.log('[audio:light] Rewriting as Super Brief podcast script (GPT-4o, per-section)...');
      const client = new OpenAI({ apiKey: options.openaiApiKey });

      // Build intro — include Daily Title so the opening uses the same headline as the brief.
      // Anchor the HEADLINE hint to the lead IDEA (not ordered[0], which is now Markets Minute),
      // so the intro still previews the ideas even though Markets Minute is spoken first.
      const firstIdea = ordered.find(s => s.id === 'the-idea');
      const ideaHeadline = firstIdea
        ? (firstIdea.title
            || firstIdea.content.split('\n').map(l => l.trim()).find(l => /^\*\*.+\*\*$/.test(l))?.replace(/\*\*/g, '').trim()
            || firstIdea.content.split('\n')[0]
            || '')
        : (ordered[0]?.content?.split('\n')[0] || '');
      const introContent = `DATE: ${brief.displayDate}\nDAILY TITLE: ${brief.dailyTitle || ''}\nHEADLINE: ${ideaHeadline}`;
      const { script: introScript } = await rewriteSectionChecked(client, 'light-intro', introContent, {}, { instructions: LIGHT_SECTION_INSTRUCTIONS, systemPrompt: LIGHT_SECTION_SYSTEM_PROMPT });

      // Rewrite each section individually with section-specific instructions
      const sectionScripts: string[] = [];

      // Prepend epigraph + intro
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      if (cleanEpigraph) {
        sectionScripts.push(`${cleanEpigraph}\n\n${introScript}`);
      } else {
        sectionScripts.push(introScript);
      }

      // Process each section. The light path is sequential (this for-await loop), so we can
      // carry a running fact list forward: each section is told what earlier ones already
      // covered, so MARKETS MINUTE stops recapping figures THE UPDATE already delivered (the
      // 2026-07-01 yen/flows repeat). Previously the light passed NO dedup context at all.
      const usedTransitions = new Set<string>();
      const runningFacts: string[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const section = ordered[i]!;
        const prevSection = i > 0 ? ordered[i - 1]?.label : 'intro';
        const nextSection = i < ordered.length - 1 ? ordered[i + 1]?.label : undefined;

        const context: SectionContext = { prevSection, nextSection };
        if (runningFacts.length > 0) context.alreadyCovered = [...runningFacts];

        // Ideas-first: the idea headline and the model name live in the header
        // (section.title), not the body — fold them back in so they get spoken.
        // Use a stable label ('The Idea') for section-specific instructions.
        const rewriteLabel = section.id === 'the-idea' ? 'The Idea' : section.label;
        const rewriteContent = (section.title && (section.id === 'the-idea' || section.id === 'the-model'))
          ? `**${section.title}**\n\n${section.content}`
          : section.content;

        console.log(`[audio:light] Section: ${rewriteLabel}${section.title ? ` — ${section.title}` : ''}...`);
        const { script } = await rewriteSectionChecked(client, rewriteLabel, rewriteContent, context, { instructions: LIGHT_SECTION_INSTRUCTIONS, systemPrompt: LIGHT_SECTION_SYSTEM_PROMPT });
        console.log(`[audio:light]   → ${script.length} chars`);

        // Feed this section's figures forward so later sections (esp. MARKETS MINUTE) know
        // what's already been said and reference rather than repeat it.
        runningFacts.push(...extractKeyFacts(section.content));

        // Prepend the transition once per section id (so multiple ideas don't repeat the lead-in).
        // An id deliberately mapped to '' (e.g. 'the-close') is a chosen no-transition;
        // an id MISSING from the map is a silent cold start — warn loudly (audio gate).
        if (LIGHT_SECTION_TRANSITIONS[section.id] === undefined) {
          console.warn(`[audio:gate] No light transition mapped for section id "${section.id}" — it will start cold. Add it to LIGHT_SECTION_TRANSITIONS.`);
        }
        const transition =
          (options.isWeekly ? LIGHT_WEEKLY_TRANSITION_OVERRIDES[section.id] : undefined) ??
          (LIGHT_SECTION_TRANSITIONS[section.id] || '');
        if (transition && !usedTransitions.has(section.id)) {
          sectionScripts.push(`${transition}\n\n${script}`);
          usedTransitions.add(section.id);
        } else {
          sectionScripts.push(script);
        }
      }

      // Sign-off: if the brief has its own THE CLOSE section it was already spoken above;
      // otherwise append a default so the episode never ends mid-air.
      const hasClose = ordered.some(s => s.id === 'the-close');
      if (!hasClose) {
        const signOff = 'That\'s today\'s Super Brief. Quick, sharp, and hopefully you\'re walking away with something useful. We\'ll be back tomorrow. Until then, stay curious.';
        sectionScripts.push(signOff);
      }

      // Stitch with pause markers
      const SECTION_PAUSE = '\n\n...\n\n';
      fullText = regexNormalize(applyLightPronunciations(sectionScripts.join(SECTION_PAUSE)));
      console.log(`[audio:light] Script: ${fullText.length} characters`);
    } catch (err) {
      console.warn('[audio:light] Scriptwriter failed, falling back to regex-only:', err);
      const rawContent = ordered.map(s => `${s.label}:\n${s.content}`).join('\n\n');
      fullText = regexNormalize(applyLightPronunciations(rawContent));
    }
  } else {
    const rawContent = ordered.map(s => `${s.label}:\n${s.content}`).join('\n\n');
    fullText = regexNormalize(applyLightPronunciations(rawContent));
  }

  const sections = ordered.map(s => ({
    id: s.id,
    label: s.label,
    text: '',
  }));

  return {
    fullText,
    sections,
    characterCount: fullText.length,
  };
}

// ─── Exports for testing ────────────────────────────────────────────────────

export const _test = {
  expandCurrency,
  expandBasisPoints,
  expandMultipliers,
  expandQuarters,
  expandPercentages,
  expandAbbreviations,
  expandTickers,
  expandMovingAverages,
  cleanFormatting,
  regexNormalize,
  extractCommentaryOnly,
  extractRawContent,
};
