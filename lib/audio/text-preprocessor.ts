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

YOUR JOB: Convert written market analysis into natural, conversational spoken form. Do NOT summarize or compress. Every insight, every thesis, every key level, every "so what" from the source must appear in your output.

VOICE & FEEL (THIS IS CRITICAL):
You're writing how a smart friend actually talks when explaining something they find fascinating. Not a podcast host performing. Not a finance bro hyping. Just a person who reads a lot and thinks clearly, sharing what they know in plain language. The listener should feel like they're in a conversation, not an audience. They should feel ENERGIZED and SMARTER after listening, not weighed down by doom. Even when the news is heavy, the energy should be "isn't it fascinating that we get to think about this?" not "everything is terrible."

Techniques for natural delivery:
- Talk through ideas like you're working them out. "So the thing is..." / "What I keep coming back to is..." / "The part that doesn't get enough attention is..."
- Use plain language FIRST. If you need a technical term, say it once and immediately explain what it means in normal words. Never stack jargon.
- Vary your pacing. Some things deserve a quick mention. Others need you to slow down and unpack. Match the weight of the idea.
- Connect ideas naturally when they actually connect. Don't force transitions.
- Use contractions everywhere. "It's" not "it is." "Don't" not "do not." "That's" not "that is." "Wouldn't" not "would not."

TRANSITIONS (THIS IS THE MOST IMPORTANT THING):
The podcast is ONE continuous conversation. Every section must flow naturally from the previous one. Every bullet within a section must connect to the next. DO NOT start a new section or bullet cold. Thread from what just happened. Techniques:
- Between bullets in the same section: "Meanwhile..." / "On a completely different front..." / "Speaking of infrastructure..." / "And that connects to something else..."
- Between sub-sections of The Six: Pick up a thread from the last bullet of the previous sub-section, or acknowledge the shift. "OK, that's the macro picture. Now companies and crypto, and some of these stories rhyme with what we just talked about."
- Between major sections: Reference something specific from the previous section, not a generic "moving on."
- Between acts (Markets → Meditations → Mental Models): These are the biggest transitions. Name the shift explicitly and change the energy.
If the TRANSITION CONTEXT block is provided, USE IT. It tells you what section came before and after you.

BANNED PHRASES (these are overused filler that replaces actual insight):
- "Buckle up" / "Strap in" / "Hold on tight"
- "Here's where it gets interesting" / "Here's where it gets wild" / "Here's the thing"
- "This is huge" / "This is massive" / "Game-changer" / "Jaw-dropping"
- "Let that sink in" / "Read that again" / "I'll say that again"
- "Without further ado" / "That said" / "Having said that"
- "At the end of the day"
- "Moving on to..." / "Next up..." / "Let's turn to..." / "Let's dive into..."
Do NOT use any of these. If you catch yourself reaching for one, just say the actual insight instead.

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

DEPTH (DO NOT OVERSIMPLIFY):
The listener is smart and wants to get smarter. Simplify the LANGUAGE, not the THINKING. Keep second-order effects, keep the "why this matters" reasoning, keep the nuance. If the source says "the DeFi-CeFi spread persisted for a second consecutive week at 180-220bp," say the spread and explain what it means. Don't just say "DeFi rates are higher." The specificity IS the value.

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

REPETITION (CRITICAL):
- If a topic was already covered in a previous section of this podcast, do NOT re-explain it. Reference it briefly ("like we talked about earlier with Iran") and move on to the NEW information.
- Never repeat the same fact, number, or framing twice in your output. If you've already said Bitcoin hit seventy-four thousand, don't say it again. Say "that spike we mentioned" or just move on.
- Each section should feel like it's adding something NEW to the listener's understanding, not reinforcing what they already heard two minutes ago.

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
  'intro': 'Write a short, energizing podcast opening. Say "Welcome to Markets, Meditations, and Mental Models" and the date naturally. Then give a 2-3 sentence setup about the day\'s biggest story based on the lede. Keep it direct and conversational, like you\'re greeting a friend and telling them what matters today. This should make the listener feel EXCITED to be here. They\'re about to get smarter. Do NOT include any quotes or epigraphs. The daily word of encouragement will be added separately at the start. Do NOT use hype language or phrases like "buckle up." End the intro with a natural bridge into the first section, something that connects the lede to what\'s coming in The Dashboard.',
  'The Dashboard': 'You\'re starting the Markets section of the episode. Structural regime read: what\'s the session\'s character, what regime is forming or breaking, and one structural observation per sub-section (Equities, Crypto, Commodities & Rates). The editorial product is the commentary. The website renders the data. Do NOT recite prices the listener can check themselves. Do NOT preview stories from The Six. Keep the full analytical depth. Simplify language, not thinking. Thread between sub-sections: if equities tell one story and bonds tell another, connect them.',
  'The Take': 'This is the heart of the Markets section. The big picture argument. Give it full treatment, don\'t compress. Let the argument build naturally, like you\'re thinking through it in real time. Explain any frameworks in plain language. If the listener has never heard of the concept, they should still follow the logic. This should feel like the most intellectually satisfying part of the episode. Keep ALL the nuance. The "where this might be wrong" is just as important as the thesis.',
  'The Model': 'Explain the model in plain language with genuine intellectual energy. What is it, where does it come from, and how does it connect to what\'s happening today? Make it feel like you\'re sharing something genuinely cool, not lecturing. Keep the full depth of the application. This should make the listener feel like they just gained a new thinking tool.',
  'Asset Spotlight': 'This is a thesis check on one portfolio asset. Walk through the original thesis, the evidence, what changed, and the thesis adjustment. Talk through it like you\'re explaining your thinking to a friend who\'s also an investor. Don\'t dumb it down. Keep the specifics: the spreads, the TVL checks, the regulatory catalysts. This section should end the Markets block on a concrete, actionable note.',
  'Inner Game': 'Read this warmly and with genuine presence. Include the quote, the teaching, and the practical action. This is the personal, human moment of the episode. Let it breathe. Don\'t rush it. No market references here at all. This should feel like a gift. The listener should feel lighter and more grounded after hearing it. The energy shifts from analytical to reflective, but it should still feel uplifting, not heavy.',
  'Discovery': 'This is an original essay about a concept from science, history, or systems thinking. NOT a reading recommendation. Tell the story with genuine fascination. Explain the concept, the surprising finding, and why it reframes something the listener thought they understood. Do NOT say "this is a great read" or refer to it as something to read. You\'re delivering it right now. This should be the section that makes someone say "I didn\'t know that." End the episode on intellectual wonder. The listener should feel their world just got a little bigger.',
  // Optional sections
  'Overnight': 'Quick overnight catch-up. Three to four key developments since last night. Keep it brisk and factual with "here\'s what happened while you were sleeping" energy. Each item gets 1-2 sentences. Natural transition into the Dashboard.',
  'Deep Read / Listen': 'Skip this section entirely in audio. Do not read it. These are external link recommendations that don\'t work in audio format.',

  // Legacy sections — still used for processing older briefs
  'The Big Stories': 'Run through the big stories. Cover EVERY story individually. Headline, context, why it matters, what to watch.',
  "Tomorrow's Headlines": 'Cover EVERY headline. For each: what happened, what it means going forward, and the signal.',
  'The Watchlist': 'Talk through each position like you\'re explaining your thinking to a friend. The asset, why it\'s interesting, the key levels, and what would make you wrong.',

  // The Six sub-sections. Each gets its own API call to prevent compression.
  // Only Markets & Macro formally opens The Six. The rest flow as one conversation.
  'The Six: Markets & Macro': 'You\'re opening The Six. This is the only subsection that gets a formal introduction. Say something natural like "Alright, let\'s get into The Six, starting with Markets and Macro." Cover EVERY bullet with full analytical depth. These are regime-based structural reads, trends forming, breaking, or continuing over 1-3 months. Weave a narrative about what\'s shifting structurally. If bullet 1 is about rates and bullet 2 is about the ECB, connect them naturally. Don\'t just drop one bullet and start the next cold.',
  'The Six: Companies & Crypto': 'Do NOT formally announce this section or say its name like a chapter heading. The listener is already in The Six. Just shift the conversation naturally from the macro picture into company and crypto territory. Something like "OK so that\'s the macro picture. On the company side..." Cover EVERY bullet with full depth. Mix structural company moves with crypto architectural changes. If two stories rhyme with each other or with something from Markets & Macro, connect them. Avoid jargon where a normal word works, but keep the analytical depth.',
  'The Six: AI & Tech': 'Do NOT formally announce this section. Flow from whatever Companies & Crypto just covered. If there\'s a natural bridge (a company story that connects to an AI development), use it. Otherwise a light pivot works: "Now on the tech side..." Cover EVERY bullet with full depth. Explain what shipped, what changed, and why it matters. If multiple stories tell a bigger pattern about where AI is heading, weave that thread. Let genuine excitement come through naturally.',
  'The Six: Geopolitics': 'Do NOT formally announce this section. Shift naturally from tech into the geopolitical picture. Cover EVERY bullet. When one theater dominates (e.g., a war), give it 1-2 concise bullets and spend more time on the OTHER theaters the listener might be missing. The goal is geographic breadth. If Iran and BRICS+ are two sides of the same shift, connect them. Use plain language. "Iran is expanding its targets from oil infrastructure to civilian airports" not "the escalation matrix is broadening."',
  'The Six: Wild Card': 'Do NOT formally announce this section by name. Just shift the energy. Let the listener feel you\'re pivoting to something unexpected and fun. This is cross-disciplinary content: science, culture, history, anything surprising that makes you smarter. Cover each item with genuine curiosity and lighter energy. If a glacier story and a water crisis story are both about resource limits, connect them. Let the wonder come through. This should be FUN.',
  'The Six: The Signal': 'Do NOT formally announce this section by name. You\'re wrapping up The Six, so the tone should shift to forward-looking. These are things forming that most people are missing. Each one ends with a clear if/then. Make sure the if/then lands in plain language. If signals connect to each other, say so. The listener should walk away knowing exactly what to watch for and what it means.',
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

/** Context passed to each section for transition awareness */
interface SectionContext {
  prevSection?: string | undefined;
  nextSection?: string | undefined;
  /** e.g. "You're now entering the Meditations section of the episode." */
  actTransition?: string | undefined;
}

/**
 * Act boundaries — when crossing these, the scriptwriter gets an act-level transition cue.
 * The episode flows: Markets → Meditations → Mental Models.
 */
const ACT_BOUNDARIES: Record<string, string> = {
  'The Dashboard': 'You\'re opening the Markets section of the episode. First of three acts: Markets, Meditations, Mental Models. After the intro, signal the start of Markets naturally. Something like "Alright, let\'s start with the Markets. Here\'s the Dashboard." The listener should know they\'re entering the market intelligence portion of the show.',
  'Inner Game': 'You just finished the Markets section of the episode (Dashboard, The Six, The Take, Asset Spotlight). You\'re now crossing into the Meditations section. The personal, human part of the episode. This is a real shift in register. Signal it naturally. Something like "Alright, that\'s the markets. Now let\'s shift gears. Time for the part of the show that\'s just about you." Make the listener feel the energy change.',
  'The Model': 'You just finished the Meditations section (Inner Game). You\'re now crossing into Mental Models. The thinking tools section. Signal the shift naturally. Something like "OK, let\'s get the brain working. Time for Mental Models, starting with today\'s model." This should feel like a fresh burst of intellectual energy.',
};

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

  // Build transition context so the scriptwriter knows what came before and after
  let transitionContext = '';
  if (context) {
    const parts: string[] = [];
    if (context.actTransition) {
      parts.push(`ACT TRANSITION: ${context.actTransition}`);
    }
    if (context.prevSection) {
      parts.push(`PREVIOUS SECTION: "${context.prevSection}". The listener just heard this. Your opening should flow naturally FROM that section. Don't start cold. Reference something from it, pick up a thread, or acknowledge the shift in topic. The transition should feel like one conversation, not separate segments stitched together.`);
    }
    if (context.nextSection) {
      parts.push(`NEXT SECTION: "${context.nextSection}". This comes after you. If there's a natural thread to leave open, leave it. But don't preview or tease. Just let your ending be warm and complete.`);
    }
    if (parts.length > 0) {
      transitionContext = '\n\nTRANSITION CONTEXT:\n' + parts.join('\n');
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

  // Strategy 1: Parallel (fast — all sections at once)
  try {
    console.log(`[audio] Rewriting ${tasks.length} sections in parallel via GPT-4o...`);

    const results = await Promise.all(
      tasks.map(async (task) => {
        console.log(`[audio] Section ${task.index + 1}: ${task.name}...`);
        // Build transition context for this section
        const prevTask = tasks.find(t => t.index === task.index - 1);
        const nextTask = tasks.find(t => t.index === task.index + 1);
        const context: SectionContext = {
          prevSection: prevTask?.name,
          nextSection: nextTask?.name,
          actTransition: ACT_BOUNDARIES[task.name],
        };
        const script = await rewriteSection(client, task.name, task.content, context);
        console.log(`[audio]   → ${script.length} chars`);
        return { index: task.index, script };
      })
    );

    // Check how many fell back to regex (indicates rate limiting)
    // Regex fallback produces much shorter output — heuristic: if >40% of sections
    // are suspiciously short, the parallel approach got throttled
    const avgLen = results.reduce((s, r) => s + r.script.length, 0) / results.length;
    const shortCount = results.filter(r => r.script.length < avgLen * 0.3).length;

    if (shortCount > results.length * 0.4) {
      console.warn(`[audio] ${shortCount}/${results.length} sections look regex-fallback — switching to sequential`);
      throw new Error('Too many regex fallbacks, retry sequentially');
    }

    results.sort((a, b) => a.index - b.index);
    const scriptParts = results.map(r => r.script);

    // Hard-inject the epigraph into the intro (index 0) so it's never hallucinated
    // Place it at the START — the word of encouragement leads the episode
    if (epigraph && scriptParts[0]) {
      // Strip any markdown formatting from epigraph for clean spoken form
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      scriptParts[0] = `${cleanEpigraph}\n\n${scriptParts[0]}`;
    }

    // Append standard sign-off verbatim (never sent through GPT-4o)
    const signOff = 'That\'s today\'s brief. Thank you for spending part of your morning with us. Hopefully you\'re walking away a bit more informed, a bit more grounded, and a bit more curious about what\'s forming around the corner. We\'ll be back tomorrow with more. Until then. Yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it\'s called the present. Take care.';
    scriptParts.push(signOff);

    // Add pause markers between sections for natural breathing room in TTS.
    // A period + ellipsis + newlines creates a ~1-2 second pause in OpenAI TTS.
    const SECTION_PAUSE = '\n\n...\n\n';
    const totalChars = scriptParts.reduce((sum, s) => sum + s.length, 0);
    console.log(`[audio] Total script: ${totalChars} chars across ${scriptParts.length} sections`);
    return scriptParts.join(SECTION_PAUSE);

  } catch (parallelErr) {
    // Strategy 2: Sequential fallback (slower but gentler on rate limits)
    console.warn(`[audio] Parallel rewrite failed (${parallelErr}), falling back to sequential...`);

    const scriptParts: string[] = [];
    for (let ti = 0; ti < tasks.length; ti++) {
      const task = tasks[ti]!;
      console.log(`[audio] [sequential] Section ${task.index + 1}: ${task.name}...`);
      const prevTask = ti > 0 ? tasks[ti - 1] : undefined;
      const nextTask = ti < tasks.length - 1 ? tasks[ti + 1] : undefined;
      const context: SectionContext = {
        prevSection: prevTask?.name,
        nextSection: nextTask?.name,
        actTransition: ACT_BOUNDARIES[task.name],
      };
      const script = await rewriteSection(client, task.name, task.content, context);
      scriptParts.push(script);
      console.log(`[audio]   → ${script.length} chars`);
      // Small delay between sequential calls
      await new Promise(r => setTimeout(r, 300));
    }

    // Hard-inject epigraph into intro (sequential path) — leads the episode
    if (epigraph && scriptParts[0]) {
      const cleanEpigraph = epigraph.replace(/\*+/g, '').replace(/[_~`]/g, '').trim();
      scriptParts[0] = `${cleanEpigraph}\n\n${scriptParts[0]}`;
    }

    // Append standard sign-off verbatim (never sent through GPT-4o)
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
