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
      const startIdx = rawMarkdown.indexOf(sec.marker);
      if (startIdx === -1) continue;

      const afterMarker = rawMarkdown.indexOf('\n', startIdx);
      if (afterMarker === -1) continue;

      let endIdx = rawMarkdown.length;
      for (const m of ALL_MARKERS) {
        if (m === sec.marker) continue;
        const idx = rawMarkdown.indexOf(m);
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

const SECTION_SYSTEM_PROMPT = `You are a podcast scriptwriter for "The Daily Brief," a daily financial market intelligence podcast.

YOUR JOB: Convert written market analysis into natural spoken form. Do NOT summarize or compress.
Every insight, every thesis, every key level, every "so what" from the source must appear in your output.

VOICE: Speak like a sharp, well-informed friend explaining markets over coffee. Confident but not pompous. Vary sentence length. Mix short punchy statements with longer analytical ones.

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

RULES:
- Do NOT add information not in the source
- Do NOT hallucinate data
- Expand ALL abbreviations (YoY → "year over year", ETF → "E.T.F.", Q3 → "third quarter")
- Spell out ticker symbols (NVDA → "NVIDIA", MSTR → "MicroStrategy")

Return ONLY the spoken script for this section. No meta-commentary, no [bracketed notes].`;

/** Per-section user prompts — tailored instructions for what to emphasize */
const SECTION_INSTRUCTIONS: Record<string, string> = {
  'intro': 'Write a podcast opening. Read the epigraph/daily quote EXACTLY as provided — do NOT substitute a different quote. Then give a 2-3 sentence hook about the day\'s biggest story based on the lede. Keep it punchy — this sets the tone.',
  'The Dashboard': 'Convert this dashboard commentary into a quick spoken market check-in. Cover equities, crypto, commodities, and rates. Focus on the narrative and analysis, not raw numbers. Use transitions between asset classes.',
  'The Take': 'Convert this editorial synthesis into spoken form. This is the heart of the brief — the big picture argument. Give it full treatment, don\'t compress.',
  'The Model': 'Explain this mental model naturally, including the source, the framework, and how it applies to today\'s markets. Make it feel like a teaching moment.',
  'The Big Stories': 'Cover EVERY story individually. Each one gets: the headline, the context, the implications, and what to watch. Do NOT skip or lump stories together. This is the longest section — give each story the depth it deserves.',
  "Tomorrow's Headlines": 'Cover EVERY headline individually. For each: what happened, what it means, and the forward signal. Do NOT lump them together.',
  'The Watchlist': 'Cover EVERY watchlist item. For each: the asset, the thesis, key levels, and what would change the view. Include the reasoning behind each position.',
  'Discovery': 'Mention each recommended read/listen with why it matters.',

  // The Six sub-sections — each gets its own API call to prevent compression
  'The Six: Markets & Macro': 'Convert EVERY bullet point in this markets & macro section into spoken analysis. Cover each one individually with its full context and implications. Do NOT skip any.',
  'The Six: Crypto': 'Convert EVERY crypto bullet into spoken analysis. Each gets its full explanation — the data, the thesis, and the "so what." Do NOT skip any.',
  'The Six: AI & Tech': 'Convert EVERY AI & tech bullet into spoken analysis. Cover the companies, the numbers, and why each matters. Do NOT skip any.',
  'The Six: Geopolitics': 'Convert EVERY geopolitics bullet into spoken analysis. Cover the developments, the strategic context, and the implications. Do NOT skip any.',
  'The Six: Deep Read / Listen': 'Mention each recommended read or listen with a brief explanation of why it matters and what the reader will get from it.',
  'The Six: Inner Game': 'Read this reflective/philosophical section naturally and warmly. Include the quote, the story or teaching, and the practical action. This is the personal, human moment in the brief — give it space.',
};

/** Rewrite a single section via GPT-4o */
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
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SECTION_SYSTEM_PROMPT },
        { role: 'user', content: `SECTION: ${sectionName}\n\nINSTRUCTION: ${instruction}\n\nCONTENT:\n${content}` },
      ],
      temperature: 0.4,
    });
    const result = resp.choices[0]?.message?.content?.trim();
    if (!result) throw new Error('Empty response');
    return result;
  } catch (err) {
    console.warn(`[audio] Section "${sectionName}" LLM failed (${err}), using regex fallback`);
    return regexNormalize(content);
  }
}

/** Rewrite the full brief as a podcast script, processing sections in parallel */
async function rewriteAsScript(parsed: ParsedBriefForAudio, openaiApiKey: string, epigraph: string): Promise<string> {
  const client = new OpenAI({ apiKey: openaiApiKey });

  // Build all section tasks: intro + each content section
  const tasks: { index: number; name: string; content: string }[] = [];

  // Index 0 = intro
  tasks.push({
    index: 0,
    name: 'intro',
    content: `DATE: ${parsed.displayDate}\nEPIGRAPH: ${epigraph}\nLEDE: ${parsed.lede}`,
  });

  // Index 1..N = content sections
  for (let i = 0; i < parsed.sections.length; i++) {
    const sec = parsed.sections[i]!;
    tasks.push({ index: i + 1, name: sec.name, content: sec.content });
  }

  console.log(`[audio] Rewriting ${tasks.length} sections in parallel via GPT-4o...`);

  // Run all sections in parallel (GPT-4o handles concurrent requests well)
  const results = await Promise.all(
    tasks.map(async (task) => {
      console.log(`[audio] Section ${task.index + 1}: ${task.name}...`);
      const script = await rewriteSection(client, task.name, task.content);
      console.log(`[audio]   → ${script.length} chars`);
      return { index: task.index, script };
    })
  );

  // Reassemble in order
  results.sort((a, b) => a.index - b.index);
  const scriptParts = results.map(r => r.script);
  const totalChars = scriptParts.reduce((sum, s) => sum + s.length, 0);

  console.log(`[audio] Total script: ${totalChars} chars across ${scriptParts.length} sections`);

  return scriptParts.join('\n\n');
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
      if (trimmed.startsWith('> *') || trimmed.startsWith('>*') || trimmed.startsWith('> "') || trimmed.startsWith('>"')) {
        epigraph = trimmed.replace(/^>\s*/, '').replace(/\*(.+?)\*/g, '$1').trim();
        if (epigraph.length > 20) break;
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
