/**
 * Local test: generate audio for today's brief.
 *
 * Usage: node scripts/test-audio.mjs
 *        node scripts/test-audio.mjs 2026-03-02
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── Load env from .env.local ───────────────────────────────────────────────

const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: No OPENAI_API_KEY found in .env.local or environment');
  process.exit(1);
}

// ─── Brief loading ──────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(ROOT, 'content/daily-updates');

function loadBrief(dateSlug) {
  if (dateSlug) {
    const fp = path.join(CONTENT_DIR, `${dateSlug}.md`);
    if (!fs.existsSync(fp)) return null;
    return { date: dateSlug, raw: fs.readFileSync(fp, 'utf-8') };
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).sort().reverse();
  if (!files[0]) return null;
  const d = files[0].replace('.md', '');
  return { date: d, raw: fs.readFileSync(path.join(CONTENT_DIR, files[0]), 'utf-8') };
}

// ─── Section extraction ─────────────────────────────────────────────────────

// Sections to include in audio (in order)
const AUDIO_SECTIONS = [
  { marker: '# ▸ THE DASHBOARD', name: 'The Dashboard', mode: 'commentary-only' },
  { marker: '# ▸ THE SIX', name: 'The Six', mode: 'full' },
  { marker: '# ▸ THE TAKE', name: 'The Take', mode: 'full' },
  { marker: '# ▸ THE MODEL', name: 'The Model', mode: 'full' },
  { marker: '# ▸ THE BIG STORIES', name: 'The Big Stories', mode: 'full' },
  { marker: "# ▸ TOMORROW'S HEADLINES", name: "Tomorrow's Headlines", mode: 'full' },
  { marker: '# ▸ THE WATCHLIST', name: 'The Watchlist', mode: 'full' },
  { marker: '# ▸ DISCOVERY', name: 'Discovery', mode: 'full' },
];

// All markers (for finding section boundaries)
const ALL_MARKERS = [
  ...AUDIO_SECTIONS.map(s => s.marker),
  '# ▸ WORLDVIEW UPDATES',
  '# ▸ FULL REFERENCE: BIG STORIES',
  "# ▸ FULL REFERENCE: TOMORROW'S HEADLINES",
];

function parseBriefForAudio(brief) {
  const lines = brief.raw.split('\n');

  // Extract display date
  let displayDate = brief.date;
  for (const line of lines.slice(0, 15)) {
    if (line.trim().startsWith('## ')) { displayDate = line.replace('## ', '').trim(); break; }
  }

  // Extract epigraph — italic line *before* the ## date header
  // Format: *"Quote text here"* or *Quote text here*
  let epigraph = '';
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) break; // stop at date header
    // Check for italic text (epigraph) — starts and ends with *
    if (trimmed.startsWith('*') && !trimmed.startsWith('**') && trimmed.endsWith('*') && trimmed.length > 20) {
      epigraph = trimmed.slice(1, -1).trim();
      break;
    }
    // Also check blockquote style: > *quote*
    if (trimmed.startsWith('> *') || trimmed.startsWith('>*') || trimmed.startsWith('> "') || trimmed.startsWith('>"')) {
      epigraph = trimmed.replace(/^>\s*/, '').replace(/\*(.+?)\*/g, '$1').trim();
      if (epigraph.length > 20) break;
    }
  }

  // Extract lede — the **News TLDR:** bold paragraph after the date
  let lede = '';
  let foundDate = false;
  for (const line of lines.slice(0, 30)) {
    if (line.trim().startsWith('## ')) { foundDate = true; continue; }
    if (!foundDate) continue;
    // Look for the bold TLDR paragraph (starts with **)
    if (line.trim().startsWith('**News TLDR:**') || line.trim().startsWith('**')) {
      lede = line.trim()
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      break;
    }
  }

  const sections = [];
  for (const sec of AUDIO_SECTIONS) {
    const startIdx = brief.raw.indexOf(sec.marker);
    if (startIdx === -1) continue;

    const afterMarker = brief.raw.indexOf('\n', startIdx);
    if (afterMarker === -1) continue;

    let endIdx = brief.raw.length;
    for (const m of ALL_MARKERS) {
      if (m === sec.marker) continue;
      const idx = brief.raw.indexOf(m);
      if (idx > startIdx && idx < endIdx) endIdx = idx;
    }

    let content = brief.raw.slice(afterMarker + 1, endIdx).trim();
    if (content.endsWith('---')) content = content.slice(0, -3).trim();

    // For dashboard: extract only the italic commentary paragraphs (skip tables)
    if (sec.mode === 'commentary-only') {
      const commentaryLines = [];
      const contentLines = content.split('\n');
      let i = 0;
      while (i < contentLines.length) {
        const line = contentLines[i].trim();
        if (line.startsWith('|')) { i++; continue; }
        if (line.startsWith('###')) {
          commentaryLines.push(line.replace(/^#+\s*/, ''));
          i++;
          continue;
        }
        if (line.startsWith('*') && !line.startsWith('**')) {
          commentaryLines.push(line.replace(/^\*/, '').replace(/\*$/, ''));
          i++;
          continue;
        }
        if (line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('---')) {
          commentaryLines.push(line);
        }
        i++;
      }
      content = commentaryLines.join('\n\n');
    }

    // For The Six: split into sub-sections at ## headers and process each individually
    // This prevents GPT-4o from compressing 11K+ chars into a few paragraphs
    if (sec.name === 'The Six') {
      const subSections = splitAtSubHeaders(content);
      for (const sub of subSections) {
        sections.push({ name: `The Six: ${sub.name}`, content: sub.content, mode: 'full' });
      }
      continue;
    }

    sections.push({ name: sec.name, content, mode: sec.mode });
  }

  return { displayDate, lede, epigraph, sections };
}

/** Split content at ## sub-headers into individual chunks */
function splitAtSubHeaders(content) {
  const subSections = [];
  const lines = content.split('\n');
  let currentName = 'Overview';
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      // Save previous sub-section if it has content
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

  // Save last sub-section
  if (currentLines.length > 0) {
    const text = currentLines.join('\n').trim();
    if (text.length > 50) {
      subSections.push({ name: currentName, content: text });
    }
  }

  return subSections;
}

// ─── Financial text normalization (regex layer) ─────────────────────────────

const TICKER_NAMES = {
  SPX: 'S&P 500', NDX: 'Nasdaq 100', DJI: 'Dow Jones', VIX: 'the VIX', DXY: 'the Dollar Index',
  US10Y: 'the 10-year Treasury yield', US2Y: 'the 2-year Treasury yield',
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin',
  GOLD: 'Gold', BRENT: 'Brent crude', WTI: 'WTI crude',
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', META: 'Meta',
  NVDA: 'NVIDIA', TSLA: 'Tesla', MSTR: 'MicroStrategy', COIN: 'Coinbase', AMD: 'AMD',
  INTC: 'Intel', AVGO: 'Broadcom', NFLX: 'Netflix', TSM: 'TSMC',
  SPY: 'the S&P 500 ETF', QQQ: 'the Nasdaq 100 ETF', GLD: 'the Gold ETF',
  IBIT: 'the iShares Bitcoin ETF', GBTC: 'the Grayscale Bitcoin Trust',
};

const ABBREVS = {
  YoY: 'year over year', QoQ: 'quarter over quarter', MoM: 'month over month',
  EBITDA: 'E.B.I.T.D.A.', EPS: 'earnings per share', GDP: 'G.D.P.',
  CPI: 'C.P.I.', PPI: 'P.P.I.', PCE: 'P.C.E.', NFP: 'nonfarm payrolls',
  FOMC: 'the F.O.M.C.', IMF: 'the I.M.F.', ECB: 'the E.C.B.', SEC: 'the S.E.C.',
  ETF: 'E.T.F.', ETFs: 'E.T.F.s', ATH: 'all-time high',
  DHS: 'D.H.S.', TSA: 'T.S.A.', NATO: 'NATO', GTC: 'G.T.C.',
  AI: 'A.I.', LLM: 'large language model', GPU: 'G.P.U.', GPUs: 'G.P.U.s',
  API: 'A.P.I.', IPO: 'I.P.O.', IRGC: 'I.R.G.C.', LNG: 'L.N.G.',
};

const QUARTERS = { Q1: 'first quarter', Q2: 'second quarter', Q3: 'third quarter', Q4: 'fourth quarter' };

function regexNormalize(text) {
  text = text.replace(/\$([0-9]+(?:\.[0-9]+)?)\s*(T|B|M|K)\b/gi, (_, n, m) => {
    const mag = { T: 'trillion', B: 'billion', M: 'million', K: 'thousand' }[m.toUpperCase()] || m;
    return `${n} ${mag} dollars`;
  });
  text = text.replace(/([+-]?)(\d+)\s*bps?\b/gi, (_, s, n) => `${s === '+' ? 'plus ' : s === '-' ? 'minus ' : ''}${n} basis points`);
  text = text.replace(/(\d+)D\s*MA\b/gi, '$1-day moving average');
  text = text.replace(/(\d+)W\s*MA\b/gi, '$1-week moving average');
  text = text.replace(/(\d+)D\s*EMA\b/gi, '$1-day exponential moving average');
  text = text.replace(/(\d+(?:\.\d+)?)\s*x\b/gi, '$1 times');
  text = text.replace(/\b(Q[1-4])\s*['']?(\d{2,4})\b/g, (_, q, y) => `${QUARTERS[q.toUpperCase()] || q} ${y}`);
  text = text.replace(/\bFY\s*(\d{4})\b/gi, 'fiscal year $1');
  text = text.replace(/([+-])(\d+(?:\.\d+)?)%/g, (_, s, n) => `${s === '+' ? 'up ' : 'down '}${n} percent`);
  for (const [t, name] of Object.entries(TICKER_NAMES)) {
    text = text.replace(new RegExp(`\\b${t}\\b`, 'g'), name);
  }
  for (const [a, spoken] of Object.entries(ABBREVS)) {
    text = text.replace(new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), spoken);
  }
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

// ─── Build raw content for LLM rewrite ──────────────────────────────────────

function buildRawContent(brief) {
  const parsed = parseBriefForAudio(brief);
  const parts = [];

  parts.push(`DATE: ${parsed.displayDate}`);

  // Extract epigraph (the daily quote, usually a blockquote near the top)
  for (const line of brief.raw.split('\n').slice(0, 30)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('> *') || trimmed.startsWith('>*') || trimmed.startsWith('> "') || trimmed.startsWith('>"')) {
      const epigraph = trimmed.replace(/^>\s*/, '').replace(/\*(.+?)\*/g, '$1').trim();
      if (epigraph.length > 20) { parts.push(`EPIGRAPH: ${epigraph}`); break; }
    }
  }

  if (parsed.lede) parts.push(`LEDE: ${parsed.lede}`);

  for (const section of parsed.sections) {
    parts.push(`\n--- SECTION: ${section.name} ---\n${section.content}`);
  }

  return { raw: parts.join('\n\n'), parsed };
}

// ─── LLM conversational rewrite (per-section to prevent compression) ─────────
// Sending all 35K chars to the LLM in one shot causes massive compression (~4K out).
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

// Per-section user prompts — tailored instructions for what to emphasize
const SECTION_INSTRUCTIONS = {
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

async function rewriteAsScript(brief) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const parsed = parseBriefForAudio(brief);

  console.log(`  Epigraph: "${parsed.epigraph.slice(0, 80)}..."`);
  console.log(`  Lede: "${parsed.lede.slice(0, 80)}..."`);
  console.log(`  Sections: ${parsed.sections.map(s => s.name).join(', ')}`);

  const scriptParts = [];
  let totalChars = 0;

  // 1. Generate intro (date + epigraph + hook)
  console.log('  [1] Intro...');
  const introContent = `DATE: ${parsed.displayDate}\nEPIGRAPH: ${parsed.epigraph}\nLEDE: ${parsed.lede}`;
  const intro = await rewriteSection(client, 'intro', introContent);
  scriptParts.push(intro);
  totalChars += intro.length;
  process.stdout.write(`       → ${intro.length} chars\n`);

  // 2. Process each section individually
  for (let i = 0; i < parsed.sections.length; i++) {
    const sec = parsed.sections[i];
    const num = i + 2;
    process.stdout.write(`  [${num}] ${sec.name}...`);

    const sectionScript = await rewriteSection(client, sec.name, sec.content);
    scriptParts.push(sectionScript);
    totalChars += sectionScript.length;
    process.stdout.write(` → ${sectionScript.length} chars\n`);

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`  Total script: ${totalChars} chars across ${scriptParts.length} sections`);

  const fullScript = scriptParts.join('\n\n');
  return regexNormalize(fullScript);
}

async function rewriteSection(client, sectionName, content) {
  // Look up exact match first, then try prefix match for sub-sections
  let instruction = SECTION_INSTRUCTIONS[sectionName];
  if (!instruction) {
    // Check if it's a sub-section like "The Six: Something New"
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
    console.log(` ⚠ Failed (${err.message}), using regex fallback`);
    return regexNormalize(content);
  }
}

// ─── TTS generation ─────────────────────────────────────────────────────────

function chunkText(text, maxChars = 4096) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    const t = p.trim();
    if (!t) continue;
    if (t.length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = '';
      const sentences = t.match(/[^.!?]+[.!?]+\s*/g) || [t];
      for (const s of sentences) {
        if ((current + s).length > maxChars) { if (current.trim()) chunks.push(current.trim()); current = s; }
        else current += s;
      }
      continue;
    }
    const combined = current ? `${current}\n\n${t}` : t;
    if (combined.length > maxChars) { chunks.push(current.trim()); current = t; }
    else current = combined;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function generateAudio(text) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const chunks = chunkText(text);
  const buffers = [];

  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`  Chunk ${i + 1}/${chunks.length}...\r`);
    const resp = await client.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',
      input: chunks[i],
      response_format: 'mp3',
    });
    const ab = await resp.arrayBuffer();
    buffers.push(Buffer.from(ab));
  }
  console.log(`  Generated ${chunks.length} chunks                `);
  return Buffer.concat(buffers);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const dateArg = process.argv[2];
const brief = loadBrief(dateArg);
if (!brief) { console.error(`No brief found${dateArg ? ` for ${dateArg}` : ''}`); process.exit(1); }

const parsed = parseBriefForAudio(brief);
console.log(`\nBrief: ${parsed.displayDate} (${brief.date})`);
console.log(`Epigraph: "${parsed.epigraph.slice(0, 80)}..."`);
console.log(`Lede: "${parsed.lede.slice(0, 80)}..."`);
console.log(`Sections: ${parsed.sections.length}`);
for (const s of parsed.sections) {
  console.log(`  - ${s.name} (${s.content.length} chars)`);
}
console.log(`Raw content: ${brief.raw.length} chars`);
console.log('');

console.log('Step 1/3: Preprocessing (per-section rewrite)...');
const script = await rewriteAsScript(brief);
console.log(`  → ${script.length} characters (script)`);

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `${brief.date}-script.txt`), script);
console.log(`  Script saved to: scripts/output/${brief.date}-script.txt`);
console.log('');

console.log('Step 2/3: Generating audio (tts-1-hd, voice: onyx)...');
const audio = await generateAudio(script);
console.log(`  → ${(audio.length / 1024 / 1024).toFixed(1)} MB`);
console.log('');

const mp3Path = path.join(outputDir, `${brief.date}.mp3`);
fs.writeFileSync(mp3Path, audio);
const dur = Math.round(audio.length / (128000 / 8));
const m = Math.floor(dur / 60), s = dur % 60;
const m25 = Math.floor(dur / 2.5 / 60), s25 = Math.floor((dur / 2.5) % 60);

console.log(`Step 3/3: Done!`);
console.log(`  MP3: ${mp3Path}`);
console.log(`  Duration: ${m}:${String(s).padStart(2, '0')} (at 2.5x: ~${m25}:${String(s25).padStart(2, '0')})`);
console.log('');
console.log(`  Read the script: cat scripts/output/${brief.date}-script.txt`);
