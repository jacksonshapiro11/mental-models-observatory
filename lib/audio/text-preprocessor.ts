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
  { marker: '# ▸ ASSET SPOTLIGHT', name: 'Asset Spotlight', mode: 'full' },
  { marker: '# ▸ INNER GAME', name: 'Inner Game', mode: 'full' },
  { marker: '# ▸ THE MODEL', name: 'The Model', mode: 'full' },
  { marker: '# ▸ DISCOVERY', name: 'Discovery', mode: 'full' },
];

// Legacy section markers — kept so the pipeline can still process older briefs
// that were published before the 3-act restructure (March 2026)
const LEGACY_AUDIO_SECTIONS: AudioSectionConfig[] = [
  { marker: '# ▸ THE BIG STORIES', name: 'The Big Stories', mode: 'full' },
  { marker: "# ▸ TOMORROW'S HEADLINES", name: "Tomorrow's Headlines", mode: 'full' },
  { marker: '# ▸ THE WATCHLIST', name: 'The Watchlist', mode: 'full' },
];

/** All known section markers (for finding boundaries) */
const ALL_MARKERS = [
  ...AUDIO_SECTIONS.map(s => s.marker),
  ...LEGACY_AUDIO_SECTIONS.map(s => s.marker),
  '## Deep Read',  // Boundary marker — section is skipped in audio but needs to be recognized
  '# ▸ WORLDVIEW UPDATES',
  '# ▸ FULL REFERENCE: BIG STORIES',
  "# ▸ FULL REFERENCE: TOMORROW'S HEADLINES",
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

  // Try line-by-line case-insensitive match on the section name
  const sectionName = marker.replace(/^#\s*▸\s*(THE\s+)?/i, '').trim();
  const lines = text.split('\n');
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
  text = text.replace(/~/g, 'approximately ');
  text = text.replace(/\s*—\s*/g, ', ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/`(.+?)`/g, '$1');
  text = text.replace(/⬆️|⬇️|🔴|🟢|🟡|📖|🎧|⚡/g, '');
  text = text.replace(/^[-*]\s+/gm, '');
  text = text.replace(/^#+\s*/gm, '');
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
  rawMarkdown?: string
): { rawContent: string; parsed: ParsedBriefForAudio } {
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
    const allSectionsToTry = [...AUDIO_SECTIONS, ...LEGACY_AUDIO_SECTIONS];
    for (const sec of allSectionsToTry) {
      const startIdx = findMarkerIndex(rawMarkdown, sec.marker);
      if (startIdx === -1) continue;

      const afterMarker = rawMarkdown.indexOf('\n', startIdx);
      if (afterMarker === -1) continue;

      let endIdx = rawMarkdown.length;
      for (const m of ALL_MARKERS) {
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
    const allConfigs = [...AUDIO_SECTIONS, ...LEGACY_AUDIO_SECTIONS];
    const configByName = (name: string) => allConfigs.find(c => c.name === name);
    const sectionIdToConfig: Record<string, AudioSectionConfig> = {
      'overnight': configByName('Overnight')!,
      'dashboard': configByName('The Dashboard')!,
      'the-six': configByName('The Six')!,
      // 'deep-read' intentionally excluded — Deep Read / Listen is skipped in audio
      'the-take': configByName('The Take')!,
      'asset-spotlight': configByName('Asset Spotlight')!,
      'inner-game': configByName('Inner Game')!,
      'the-model': configByName('The Model')!,
      'discovery': configByName('Discovery')!,
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

// ─── GPT-4o per-section scriptwriter ─────────────────────────────────────────
// Sending all 35K+ chars to GPT-4o in one shot causes massive compression (~4K out).
// Instead: rewrite each section individually, then stitch together.
// Each section gets the full prompt context so voice/tone is consistent.

const SECTION_SYSTEM_PROMPT = `You are a podcast scriptwriter for "Markets, Meditations, and Mental Models" by Cosmic Trex, a daily financial market intelligence podcast.

YOUR JOB: Convert written market analysis into natural, conversational spoken form. Every KEY insight, thesis, and "so what" from the source must appear in your output. But be EFFICIENT. The target episode length is 30-35 minutes total across all sections. That means each section must be tight. Deliver the insight in the fewest words that preserve the substance. Cut redundant context, excessive setup, and throat-clearing. Get to the point, make it land, move on.

VOICE & FEEL (THIS IS CRITICAL):
You're writing how a smart friend actually talks when explaining something they find fascinating. This is a MORNING show. The listener is waking up. Your script should wake them up. Not a podcast host performing. Not NPR. Not a finance bro hyping. A person who reads a lot, thinks clearly, and is genuinely excited to share what they know. The listener should feel like they're in a conversation, not an audience. They should feel ENERGIZED, AWAKE, and SMARTER after listening, not weighed down by doom or lulled to sleep. Even when the news is heavy, the energy should be "isn't it fascinating that we get to think about this?" not "everything is terrible." Bring LIFE to the writing. If you write it flat, the voice reads it flat.

Techniques for natural delivery:
- Talk through ideas like you're working them out. "So the thing is..." / "What I keep coming back to is..." / "The part that doesn't get enough attention is..."
- Use plain language FIRST. If you need a technical term, say it once and immediately explain what it means in normal words. Never stack jargon.
- Vary your pacing. Some things deserve a quick mention. Others need you to slow down and unpack. Match the weight of the idea.
- Connect ideas naturally when they actually connect. Don't force transitions.
- Use contractions everywhere. "It's" not "it is." "Don't" not "do not." "That's" not "that is." "Wouldn't" not "would not."

TRANSITIONS:
Transitions BETWEEN sections are already written and injected separately. Do NOT write your own section intro or outro. Just write the section content. But WITHIN your section, every bullet must connect to the next. Do NOT start a new bullet cold. Thread them naturally:
- "Meanwhile..." / "On a completely different front..." / "Speaking of infrastructure..." / "And that connects to something else..."
- If two stories rhyme, connect them. If they don't, acknowledge the shift briefly and move on.

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

FIDELITY TO SOURCE TEXT (CRITICAL):
Stay close to the written brief. The written text was carefully crafted. Your job is to make it sound natural when spoken, NOT to rewrite it from scratch. Keep the specific language, the specific numbers, the specific framing. Do not paraphrase loosely or over-simplify. If the brief says "the DeFi-CeFi lending rate spread surviving 51 consecutive days of extreme fear," say that. Do not compress it to "DeFi rates are holding up." The specificity IS the value. Simplify delivery (contractions, pacing, natural rhythm) but preserve the substance word-for-word where possible.

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

DEPTH (SMART BUT EFFICIENT):
The listener is smart and wants to get smarter. Simplify the LANGUAGE, not the THINKING. Keep second-order effects and "why this matters" reasoning. But be CONCISE. The target total episode is 30-35 minutes. Every sentence must earn its place. If a point can land in 2 sentences instead of 4, use 2. Cut setup sentences that delay the insight. Get to the "so what" fast. The specificity IS the value, but verbosity is not.

SKIP: Markdown formatting, links, emoji, reference markers, story numbers, status labels, confidence scores, Validates/Rejects framework labels (but include the reasoning).

NUMBERS (CRITICAL FOR NATURAL SPEECH):
- Commodities & stock prices: ALWAYS round. Say "oil hit eighty-five dollars" NOT "$85.41". Say "gold above five thousand" NOT "$5,012.37". Only keep decimals if the decimal IS the story.
- Index levels: Round to nearest hundred or use natural speech. Say "S&P near fifty-eight hundred" NOT "5,782.76". Say "Nasdaq around twenty thousand."
- Yields & rates: Keep the precision. These move in basis points. Say "four point one four percent on the ten-year" or "the ten-year at four-fourteen." Never round a yield to a whole number.
- Percentage changes: Round to halves. Say "up about a point and a half" NOT "up 1.47%". Say "down roughly two percent" NOT "down 1.93%". Say "up about five percent" NOT "up 4.9%".
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
  'intro': 'Write a SHORT, energizing podcast opening. Say "Welcome to Markets, Meditations, and Mental Models" and the date naturally. Then give a 2-3 sentence setup about the day\'s biggest story based on the lede. Keep it under 30 seconds when spoken. Direct and conversational, like greeting a friend. Do NOT include any quotes or epigraphs. The daily word of encouragement will be added separately. Do NOT use hype language. End with a natural bridge into The Dashboard.',
  'The Dashboard': 'Structural regime read: what\'s the session\'s character, what regime is forming or breaking, and one structural observation per sub-section (Equities, Crypto, Commodities & Rates). The editorial product is the commentary. The website renders the data. Do NOT recite prices the listener can check themselves. Do NOT preview stories from The Six. Keep the full analytical depth. Simplify language, not thinking. Thread between sub-sections: if equities tell one story and bonds tell another, connect them.',
  'The Take': 'INTRODUCE THE TAKE. Start with something like "For today\'s Take, we\'re discussing [topic/headline from the content]." Give the listener a one-sentence setup of what question or argument you\'re about to unpack. THEN build the argument naturally, like you\'re thinking through it in real time. This is the heart of the Markets section. Give it full treatment, don\'t compress. Explain any frameworks in plain language. If the listener has never heard of the concept, they should still follow the logic. This should feel like the most intellectually satisfying part of the episode. Keep ALL the nuance. The "where this might be wrong" is just as important as the thesis.',
  'The Model': 'Explain the model in plain language with genuine intellectual energy. What is it, where does it come from, and how does it connect to what\'s happening today? Make it feel like you\'re sharing something genuinely cool, not lecturing. Keep the full depth of the application. This should make the listener feel like they just gained a new thinking tool.',
  'Asset Spotlight': 'INTRODUCE THE ASSET. Start with something like "The asset we\'re taking a closer look at today is [asset name from the content]." Then immediately add: "As always, this is not financial advice, just an expression of our themes through an asset." THEN walk through the original thesis, the evidence, what changed, and the thesis adjustment. Talk through it like you\'re explaining your thinking to a friend who\'s also an investor. Don\'t dumb it down. Keep the specifics: the spreads, the TVL checks, the regulatory catalysts. This section should end the Markets block on a concrete note.',
  'Inner Game': 'Read this warmly and with genuine presence. The transition into this section has already been spoken. Just start with the content. Include the quote, the teaching, and the practical action. This is the personal, human moment of the episode. Let it breathe. Don\'t rush it. No market references here at all. This should feel like a gift. The listener should feel lighter and more grounded after hearing it. The energy shifts from analytical to reflective, but it should still feel uplifting, not heavy.',
  'Discovery': 'The transition into this section has already been spoken. Just start with the content. This is an original essay. NOT a reading recommendation, NOT a list of cool facts (that was Wild Card). Discovery is ONE deep narrative with a single through-line argument. The energy here is slower, more reflective, more intellectually weighty than Wild Card. Tell the story with fascination but let it build. Explain the concept, the surprising finding, and why it reframes something the listener thought they understood. Do NOT say "this is a great read" or refer to it as something to read. You\'re delivering it right now. Stay very close to the written text. The essay was carefully constructed. End the episode on intellectual wonder.',
  // Optional sections
  'Overnight': 'Quick overnight catch-up. Three to four key developments since last night. Keep it brisk and factual with "here\'s what happened while you were sleeping" energy. Each item gets 1-2 sentences. Natural transition into the Dashboard.',
  'Deep Read / Listen': 'Skip this section entirely in audio. Do not read it. These are external link recommendations that don\'t work in audio format.',

  // Legacy sections — still used for processing older briefs
  'The Big Stories': 'Run through the big stories. Cover every story individually but efficiently. Headline, context, why it matters, what to watch.',
  "Tomorrow's Headlines": 'Cover every headline efficiently. For each: what happened, what it means going forward, and the signal.',
  'The Watchlist': 'Talk through each position like you\'re explaining your thinking to a friend. The asset, why it\'s interesting, the key levels, and what would make you wrong.',

  // The Six sub-sections. Each gets its own API call to prevent compression.
  // Only Markets & Macro formally opens The Six. The rest flow as one conversation.
  'The Six: Markets & Macro': 'The transition into The Six has already been spoken. Just start with the content. Cover every bullet. Give each bullet what it needs to land clearly. These are regime-based structural reads. Weave a narrative about what\'s shifting structurally. Connect bullets naturally, don\'t start each one cold. Skip any facts already covered in the intro or Dashboard (check ALREADY COVERED list). If something can be said more concisely without losing clarity or substance, compress it. But never skip substance to save time.',
  'The Six: Companies & Crypto': 'Do NOT formally announce this section or say its name like a chapter heading. The listener is already in The Six. Just shift naturally from macro into company territory. Cover every bullet. Each bullet gets its headline, why it matters, and what to watch. Give each bullet what it needs to land. If two stories rhyme, connect them. Avoid jargon where a normal word works, but keep the analytical depth.',
  'The Six: AI & Tech': 'Do NOT formally announce this section. Flow naturally from Companies & Crypto. Cover every bullet. Give each bullet what it needs. Explain what shipped, what changed, and why it matters. If multiple stories tell a bigger pattern, weave that thread briefly. Let genuine excitement come through naturally.',
  'The Six: Geopolitics': 'Do NOT formally announce this section. Shift naturally from tech into the geopolitical picture. Cover every bullet. Give each bullet what it needs. Do NOT skip or merge bullets. When one theater dominates (e.g., a war), keep each bullet concise but PRESENT. The goal is geographic breadth. If Iran and BRICS+ are two sides of the same shift, connect them. Use plain language. "Iran is expanding its targets from oil infrastructure to civilian airports" not "the escalation matrix is broadening."',
  'The Six: Wild Card': 'The transition into this section has already been spoken. Just start with the content. Energy should be lighter and more curious. Do NOT say "markets and macro" or reference any other section name. Cover each item with genuine curiosity and fascination. This is cross-disciplinary: science, culture, history. If items connect, say so. Stay close to the written text. Do not over-simplify or paraphrase loosely. The specificity is the value.',
  'The Six: The Signal': 'Do NOT say "the signal" or announce this section by name. You\'re wrapping up The Six, so the tone shifts to forward-looking. These are things forming that most people are missing. Each one ends with a clear if/then. Make sure the if/then lands in plain language. Give each signal what it needs to land clearly. If signals connect, say so. Stay close to the written text. Do not over-simplify.',
  // Legacy sub-section — Inner Game was under The Six in pre-March-22 briefs
  'The Six: Inner Game': 'Read this warmly and slowly. Include the quote, the teaching, and the practical action. This is the personal, human moment. Let it breathe. No market references.',
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

/** Context passed to each section for dedup awareness */
interface SectionContext {
  prevSection?: string | undefined;
  nextSection?: string | undefined;
  /** Key facts/data points already covered in earlier sections — DO NOT repeat these */
  alreadyCovered?: string[] | undefined;
}

// Act transitions are now handled by deterministic SECTION_TRANSITIONS in rewriteAsScript().
// No need for AI-generated act boundary cues — the transitions are structural scaffolding.

/** Rewrite a single section via GPT-4o with retry */
async function rewriteSection(client: OpenAI, sectionName: string, content: string, context?: SectionContext): Promise<string> {
  // Look up exact match first, then try prefix match for sub-sections
  let instruction = SECTION_INSTRUCTIONS[sectionName];
  if (!instruction) {
    for (const [key, val] of Object.entries(SECTION_INSTRUCTIONS)) {
      if (sectionName.startsWith(key.split(':')[0] + ':')) {
        instruction = val;
        break;
      }
    }
  }
  if (!instruction) instruction = `Convert this "${sectionName}" section into natural spoken podcast form. Include ALL substantive content. Do not skip or compress anything.`;

  // Build context for dedup awareness. Transitions between sections are handled
  // deterministically — injected as plain text AFTER scriptwriting. The scriptwriter
  // only needs to know what facts were already covered so it doesn't repeat them.
  // It should NOT try to write its own transition in or out — just write the section content.
  let transitionContext = '';
  if (context) {
    const parts: string[] = [];
    if (context.prevSection) {
      parts.push(`PREVIOUS SECTION: "${context.prevSection}". A spoken transition into your section has already been written separately. Do NOT write your own transition or opening announcement. Just start with the content.`);
    }
    if (context.alreadyCovered && context.alreadyCovered.length > 0) {
      parts.push(`ALREADY COVERED (DO NOT REPEAT THESE — the listener has already heard them):\n${context.alreadyCovered.map(f => `- ${f}`).join('\n')}\nIf any of these facts appear in your source content, either skip them entirely or reference them with a brief callback like "as we mentioned earlier" and move immediately to NEW information. Do NOT re-state the numbers, percentages, or framing. The listener remembers.`);
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
            { role: 'system', content: SECTION_SYSTEM_PROMPT },
            { role: 'user', content: `SECTION: ${sectionName}\n\nINSTRUCTION: ${instruction}${transitionContext}\n\nCONTENT:\n${content}` },
          ],
          temperature: 0.4,
        });
        const text = resp.choices[0]?.message?.content?.trim();
        if (!text) throw new Error('Empty response');
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

  // Cap at 15 facts to avoid bloating the prompt
  return unique.slice(0, 15);
}

/** Rewrite the full brief as a podcast script. Tries parallel first, falls back to sequential. */
async function rewriteAsScript(parsed: ParsedBriefForAudio, openaiApiKey: string, epigraph: string): Promise<string> {
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

  // ─── Deterministic transition phrases ───────────────────────────────────
  // These are injected BETWEEN sections after parallel scriptwriting completes.
  // No AI needed — they're structural scaffolding that tells the listener where they are.
  const SECTION_TRANSITIONS: Record<string, string> = {
    'The Dashboard': 'Alright, let\'s start with the markets. Here\'s the Dashboard.',
    'The Six: Markets & Macro': 'OK, let\'s jump into today\'s Six, starting with Markets and Macro.',
    'The Six: Companies & Crypto': 'Now moving over to Companies and Crypto.',
    'The Six: AI & Tech': 'Next up, A.I. and Tech.',
    'The Six: Geopolitics': 'Now to the geopolitical picture.',
    'The Six: Wild Card': 'Now getting into today\'s Wild Cards. The coolest things we found happening around the globe.',
    'The Six: The Signal': 'And wrapping up The Six with The Signal. Things that are forming that most people aren\'t watching yet.',
    'The Take': '', // The Take intro is handled by the section instruction itself (includes headline)
    'Asset Spotlight': '', // Asset Spotlight intro is handled by the section instruction itself (includes asset name + disclaimer)
    'Inner Game': 'That\'s all we have for today\'s markets. Let\'s take a deep breath, and settle into today\'s meditation.',
    'The Model': 'OK, let\'s get the brain working. Time for Mental Models.',
    'Discovery': 'And finally, today\'s Discovery.',
  };

  // Strategy 1: Parallel (fast — all sections at once)
  try {
    console.log(`[audio] Rewriting ${tasks.length} sections in parallel via GPT-4o...`);

    const results = await Promise.all(
      tasks.map(async (task) => {
        console.log(`[audio] Section ${task.index + 1}: ${task.name}...`);
        const prevTask = tasks.find(t => t.index === task.index - 1);
        const nextTask = tasks.find(t => t.index === task.index + 1);
        const context: SectionContext = {
          prevSection: prevTask?.name,
          nextSection: nextTask?.name,
          alreadyCovered: cumulativeFacts.get(task.index),
        };
        const script = await rewriteSection(client, task.name, task.content, context);
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
      const transition = SECTION_TRANSITIONS[result.name];

      // Inject transition phrase before the section content (if one exists)
      if (transition) {
        stitchedParts.push(transition + '\n\n' + result.script);
      } else {
        stitchedParts.push(result.script);
      }
    }

    // Hard-inject the epigraph into the intro (index 0) — leads the episode
    if (epigraph && stitchedParts[0]) {
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      stitchedParts[0] = `${cleanEpigraph}\n\n${stitchedParts[0]}`;
    }

    // Append standard sign-off verbatim (never sent through GPT-4o)
    const signOff = 'That\'s today\'s brief. Thank you for spending part of your morning with us. Hopefully you\'re walking away a bit more informed, a bit more grounded, and a bit more curious about what\'s forming around the corner. We\'ll be back tomorrow with more. Until then. Yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it\'s called the present. Take care.';
    stitchedParts.push(signOff);

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
        alreadyCovered: ti > 0 ? [...seqRunningFacts] : [],
      };
      const script = await rewriteSection(client, task.name, task.content, context);

      // Inject deterministic transition before section content
      const transition = SECTION_TRANSITIONS[task.name];
      if (transition) {
        scriptParts.push(transition + '\n\n' + script);
      } else {
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

    const signOff = 'That\'s today\'s brief. Thank you for spending part of your morning with us. Hopefully you\'re walking away a bit more informed, a bit more grounded, and a bit more curious about what\'s forming around the corner. We\'ll be back tomorrow with more. Until then. Yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it\'s called the present. Take care.';
    scriptParts.push(signOff);

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
  const { rawContent, parsed } = extractRawContent(brief, options.rawMarkdown);

  console.log(`[audio] Extracted ${parsed.sections.length} sections: ${parsed.sections.map(s => s.name).join(', ')}`);
  console.log(`[audio] Raw content: ${rawContent.length} characters`);

  // Warn about expected sections that weren't found (helps diagnose formatting issues)
  const expectedNames = AUDIO_SECTIONS.map(s => s.name);
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
      const script = await rewriteAsScript(parsed, options.openaiApiKey, epigraph);
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
