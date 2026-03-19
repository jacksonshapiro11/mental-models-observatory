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
  { marker: '# ▸ THE DASHBOARD', name: 'The Dashboard', mode: 'commentary-only' },
  { marker: '# ▸ THE SIX', name: 'The Six', mode: 'full' },
  { marker: '# ▸ THE TAKE', name: 'The Take', mode: 'full' },
  { marker: '# ▸ THE MODEL', name: 'The Model', mode: 'full' },
  { marker: '# ▸ THE BIG STORIES', name: 'The Big Stories', mode: 'full' },
  { marker: "# ▸ TOMORROW'S HEADLINES", name: "Tomorrow's Headlines", mode: 'full' },
  { marker: '# ▸ THE WATCHLIST', name: 'The Watchlist', mode: 'full' },
  { marker: '# ▸ DISCOVERY', name: 'Discovery', mode: 'full' },
];

/** All known section markers (for finding boundaries) */
const ALL_MARKERS = [
  ...AUDIO_SECTIONS.map(s => s.marker),
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
  for (const [ticker, name] of Object.entries(TICKER_NAMES)) {
    const regex = new RegExp(`\\b${ticker}\\b`, 'g');
    text = text.replace(regex, name);
  }
  return text;
}

function cleanFormatting(text: string): string {
  text = text.replace(/▸/g, '');
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
    for (const sec of AUDIO_SECTIONS) {
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
    const sectionIdToConfig: Record<string, AudioSectionConfig> = {
      'dashboard': AUDIO_SECTIONS[0]!,
      'the-six': AUDIO_SECTIONS[1]!,
      'the-take': AUDIO_SECTIONS[2]!,
      'the-model': AUDIO_SECTIONS[3]!,
      'big-stories': AUDIO_SECTIONS[4]!,
      'tomorrows-headlines': AUDIO_SECTIONS[5]!,
      'watchlist': AUDIO_SECTIONS[6]!,
      'discovery': AUDIO_SECTIONS[7]!,
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

const SECTION_SYSTEM_PROMPT = `You are a podcast scriptwriter for "Markets, Meditations, and Mental Models" by Cosmic Trex — a daily financial market intelligence podcast.

YOUR JOB: Convert written market analysis into natural, conversational spoken form. Do NOT summarize or compress. Every insight, every thesis, every key level, every "so what" from the source must appear in your output.

VOICE & FEEL — THIS IS CRITICAL:
You're writing how a smart friend actually talks when explaining something they find fascinating. Not a podcast host performing. Not a finance bro hyping. Just a person who reads a lot and thinks clearly, sharing what they know in plain language. The listener should feel like they're in a conversation, not an audience.

Techniques for natural delivery:
- Talk through ideas like you're working them out. "So the thing is..." / "What I keep coming back to is..." / "The part that doesn't get enough attention is..."
- Use plain language FIRST. If you need a technical term, say it once and immediately explain what it means in normal words. Never stack jargon.
- Vary your pacing. Some things deserve a quick mention. Others need you to slow down and unpack. Match the weight of the idea.
- Connect ideas naturally when they actually connect. Don't force transitions.
- Use contractions everywhere. "It's" not "it is." "Don't" not "do not." "That's" not "that is." "Wouldn't" not "would not."

BANNED PHRASES — these are overused filler that replaces actual insight:
- "Buckle up" / "Strap in" / "Hold on tight"
- "Here's where it gets interesting" / "Here's where it gets wild" / "Here's the thing"
- "This is huge" / "This is massive" / "Game-changer" / "Jaw-dropping"
- "Let that sink in" / "Read that again" / "I'll say that again"
- "Without further ado" / "That said" / "Having said that"
- "At the end of the day"
- "Moving on to..." / "Next up..." / "Let's turn to..." / "Let's dive into..."
Do NOT use any of these. If you catch yourself reaching for one, just say the actual insight instead.

AVOID — these make it sound scripted:
- Starting every paragraph the same way
- Perfect parallel structure (real speech isn't symmetric)
- Formal topic sentences followed by supporting evidence (that's essay structure, not speech)
- Wrapping every point with a neat takeaway
- Repeating the same transition phrase or energy pattern across sections
- Explaining what you're about to explain ("I'm going to walk you through..." — just walk through it)
- Hype language where the substance should speak for itself

JARGON RULES — CRITICAL:
- If a concept can be said in plain English, say it in plain English. "The price where a lot of stop-losses are clustered" not "the negative gamma wall." "Investors are really scared right now" not "extreme fear sentiment persists."
- When a technical term IS the clearest way to say something (like "basis points" or "moving average"), use it once and give context. "The ten-year yield moved up about fifteen basis points — that's a pretty meaningful one-day move for bonds."
- Never use more than ONE technical term per sentence without an explanation.
- If the written source has jargon, translate it. Your job is to make the listener smarter, not to prove you know the vocabulary.

SKIP: Markdown formatting, links, emoji, reference markers, story numbers, status labels, confidence scores, Validates/Rejects framework labels (but include the reasoning).

NUMBERS — THIS IS CRITICAL FOR NATURAL SPEECH:
- Commodities & stock prices: ALWAYS round. Say "oil hit eighty-five dollars" NOT "$85.41". Say "gold above five thousand" NOT "$5,012.37". Only keep decimals if the decimal IS the story.
- Index levels: Round to nearest hundred or use natural speech. Say "S&P near fifty-eight hundred" NOT "5,782.76". Say "Nasdaq around twenty thousand."
- Yields & rates: Keep the precision — these move in basis points. Say "four point one four percent on the ten-year" or "the ten-year at four-fourteen." Never round a yield to a whole number.
- Percentage changes: Round to halves. Say "up about a point and a half" NOT "up 1.47%". Say "down roughly two percent" NOT "down 1.93%". Say "up about five percent" NOT "up 4.9%".
- Crypto: Round to nearest thousand for BTC ("Bitcoin at seventy-two thousand"), nearest hundred for ETH. Only precise when a key level matters.
- Dollar amounts: "about one point two billion" NOT "1.2 billion dollars exactly." Use "trillion," "billion," "million."
- Basis points: Say "twenty-five basis points" NOT "25 bps." For context, "a quarter point" works too.
- Dates: Say "March sixth" NOT "March 6, 2026." Say "last Thursday" when the exact date isn't critical.
- Use natural approximation: "roughly," "about," "just under," "a little over," "nearly."

REPETITION — CRITICAL:
- If a topic was already covered in a previous section of this podcast, do NOT re-explain it. Reference it briefly ("like we talked about earlier with Iran") and move on to the NEW information.
- Never repeat the same fact, number, or framing twice in your output. If you've already said Bitcoin hit seventy-four thousand, don't say it again — say "that spike we mentioned" or just move on.
- Each section should feel like it's adding something NEW to the listener's understanding, not reinforcing what they already heard two minutes ago.

RULES:
- Do NOT add information not in the source
- Do NOT hallucinate data, quotes, or attributions
- Do NOT invent quotes and attribute them to people
- DIRECTIONAL ACCURACY IS CRITICAL: If the source says a price "broke above" or "reclaimed" a level, do NOT say it "fell below" or "broke down." If the source says something went UP, it went UP. Read the source carefully for direction before writing. Getting the direction wrong is the worst possible error.
- Do NOT say "have a nice weekend" or reference the weekend unless the date in the brief is actually a Friday. Check the date provided.
- Do NOT refer to Discovery content as "a read" or "a great article" — it is original content being delivered in the podcast, not an external recommendation.
- Expand ALL abbreviations (YoY → "year over year", ETF → "E.T.F.", Q3 → "third quarter")
- Spell out ticker symbols (NVDA → "NVIDIA", MSTR → "MicroStrategy")

Return ONLY the spoken script for this section. No meta-commentary, no [bracketed notes].`;

/** Per-section user prompts — tailored instructions for what to emphasize */
const SECTION_INSTRUCTIONS: Record<string, string> = {
  'intro': 'Write a short podcast opening. Say "Welcome to Markets, Meditations, and Mental Models" and the date naturally. Then give a 2-3 sentence setup about the day\'s biggest story based on the lede. Keep it direct — just tell the listener what matters today. Do NOT include any quotes or epigraphs — the daily word of encouragement will be added separately at the start. Do NOT use hype language or phrases like "buckle up."',
  'The Dashboard': 'Open with a brief natural transition like "Let\'s start with the dashboard" or "Here\'s where markets stand." Quick market snapshot — 2-3 sentences max. What was the session\'s character (risk-on, risk-off, rotational), the key technical picture, and one structural observation if there is one. Do NOT preview stories from The Six or summarize news — just the numbers and what they\'re saying. Plain language, no jargon.',
  'The Take': 'Open with a natural transition that names the section, like "Now for today\'s Take" or "Let\'s get into the Take." This is the heart of the episode — the big picture argument. Give it full treatment, don\'t compress. Let the argument build naturally, like you\'re thinking through it in real time. Explain any frameworks in plain language — if the listener has never heard of the concept, they should still follow the logic.',
  'The Model': 'Open with a natural transition like "Today\'s mental model" or "Now for the Model." Explain the model in plain language. What is it, where does it come from, and how does it connect to what\'s happening today? Make it feel like you\'re sharing something genuinely interesting you learned — not lecturing.',
  'The Big Stories': 'Open with a natural transition like "Let\'s check in on the big stories" or "Now the big stories we\'re tracking." Run through the big stories. Cover EVERY story individually — headline, context, why it matters, what to watch. React to them naturally. Flag which ones you think matter most. Don\'t repeat information that was already covered in The Six — reference it briefly and add the NEW context.',
  "Tomorrow's Headlines": 'Open with a natural transition like "Looking ahead — tomorrow\'s headlines" or "Now what\'s coming next." Cover EVERY headline. For each: what happened, what it means going forward, and the signal. Keep it forward-looking. Don\'t re-explain things already covered — just add the new angle.',
  'The Watchlist': 'Open with a natural transition like "Now the Watchlist" or "Let\'s look at the Watchlist." Talk through each position like you\'re explaining your thinking to a friend. The asset, why it\'s interesting, the key levels, and what would make you wrong. Plain language — no spreadsheet jargon.',
  'Discovery': 'Open with a natural transition like "Time for today\'s Discovery" or "Now for something different — today\'s Discovery." This is an original essay about a concept from science, history, or systems thinking — NOT a reading recommendation. Explain the concept, tell the story, and help the listener see why it matters. Teach it like you find it genuinely fascinating. Do NOT say "this is a great read" or refer to it as something to read — it\'s content you\'re delivering right now. Keep it warm and intellectually curious.',

  // The Six sub-sections — each gets its own API call to prevent compression
  'The Six: Markets & Macro': 'Open with a natural transition into The Six, like "Now let\'s get into today\'s six — starting with markets and macro." Cover EVERY bullet point. Weave a narrative — what\'s the thread connecting these stories? Use plain language. If there\'s a technical concept, explain it simply. React naturally to the surprising ones.',
  'The Six: Crypto': 'Transition naturally, like "Moving to crypto." Cover EVERY bullet. Explain each in plain terms — the data, the thesis, and what it means for someone holding crypto. Connect the dots where stories relate. Avoid crypto jargon where a normal word works.',
  'The Six: AI & Tech': 'Transition naturally, like "Over to AI and tech." Cover EVERY bullet. Explain what shipped, what changed, and why it matters. If something is genuinely exciting, let that come through naturally — don\'t perform excitement with hype words.',
  'The Six: Geopolitics': 'Transition naturally, like "Now geopolitics." Cover EVERY bullet. Explain the developments and why they matter for markets. Help the listener understand the strategic picture. Use plain language — "Iran is expanding its targets from oil infrastructure to civilian airports" not "the escalation matrix is broadening."',
  'The Six: Deep Read / Listen': 'Transition naturally, like "A few things worth your time this week." Share each recommendation like you\'re texting a friend a link. Why is this worth their time? What will they learn? Keep it genuine — no hard sell.',
  'The Six: Inner Game': 'Transition naturally, like "And finally, the inner game." Read this warmly and slowly. Include the quote, the teaching, and the practical action. This is the human moment — let it breathe. Don\'t rush it. No market references here at all.',
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

/** Rewrite a single section via GPT-4o with retry */
async function rewriteSection(client: OpenAI, sectionName: string, content: string): Promise<string> {
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
  if (!instruction) instruction = `Convert this "${sectionName}" section into natural spoken podcast form. Include ALL substantive content — do not skip or compress anything.`;

  try {
    const result = await withRetry(
      async () => {
        const resp = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SECTION_SYSTEM_PROMPT },
            { role: 'user', content: `SECTION: ${sectionName}\n\nINSTRUCTION: ${instruction}\n\nCONTENT:\n${content}` },
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
        const script = await rewriteSection(client, task.name, task.content);
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

    const totalChars = scriptParts.reduce((sum, s) => sum + s.length, 0);
    console.log(`[audio] Total script: ${totalChars} chars across ${scriptParts.length} sections`);
    return scriptParts.join('\n\n');

  } catch (parallelErr) {
    // Strategy 2: Sequential fallback (slower but gentler on rate limits)
    console.warn(`[audio] Parallel rewrite failed (${parallelErr}), falling back to sequential...`);

    const scriptParts: string[] = [];
    for (const task of tasks) {
      console.log(`[audio] [sequential] Section ${task.index + 1}: ${task.name}...`);
      const script = await rewriteSection(client, task.name, task.content);
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

    const totalChars = scriptParts.reduce((sum, s) => sum + s.length, 0);
    console.log(`[audio] Total script (sequential): ${totalChars} chars across ${scriptParts.length} sections`);
    return scriptParts.join('\n\n');
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
