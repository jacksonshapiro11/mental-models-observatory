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

  let displayDate = brief.date;
  for (const line of lines.slice(0, 15)) {
    if (line.trim().startsWith('## ')) { displayDate = line.replace('## ', '').trim(); break; }
  }

  let lede = '';
  let foundDate = false;
  for (const line of lines.slice(0, 20)) {
    if (line.trim().startsWith('## ')) foundDate = true;
    if (foundDate && line.trim().startsWith('*') && !line.trim().startsWith('**') && line.trim().endsWith('*')) {
      lede = line.trim().slice(1, -1); // First italic paragraph after date = lede summary
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
        // Skip table rows
        if (line.startsWith('|')) { i++; continue; }
        // Keep subsection headers (### Equities, ### Crypto, etc.)
        if (line.startsWith('###')) {
          commentaryLines.push(line.replace(/^#+\s*/, ''));
          i++;
          continue;
        }
        // Keep italic commentary paragraphs (wrapped in *)
        if (line.startsWith('*') && !line.startsWith('**')) {
          commentaryLines.push(line.replace(/^\*/, '').replace(/\*$/, ''));
          i++;
          continue;
        }
        // Keep regular paragraphs too (some commentary isn't italic)
        if (line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('---')) {
          commentaryLines.push(line);
        }
        i++;
      }
      content = commentaryLines.join('\n\n');
    }

    sections.push({ name: sec.name, content, mode: sec.mode });
  }

  return { displayDate, lede, sections };
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

// ─── LLM conversational rewrite ─────────────────────────────────────────────

const SCRIPTWRITER_PROMPT = `You are a podcast scriptwriter for "The Daily Brief," a daily financial market intelligence podcast. You receive raw content from a written brief and rewrite it as a natural, conversational podcast script.

VOICE AND TONE:
- Speak like a sharp, well-informed friend explaining markets over coffee
- Confident but not pompous. Direct but not rushed
- Use natural transitions between topics ("Now here's what's interesting...", "Shifting to crypto...", "The bigger picture here...")
- Vary sentence length. Mix short punchy statements with longer analytical ones
- It's OK to editorialize slightly — "this matters because...", "pay attention to...", "the market's telling you..."

STRUCTURE:
- Open with the date, then read the epigraph (the daily quote) naturally — e.g. "Today's thought: [quote]"
- Follow with a 2-3 sentence hook summarizing the day's biggest story
- Flow through sections with natural spoken transitions (don't say "Section: The Six")
- Dashboard commentary should feel like a quick market check-in, not a data dump
- For Big Stories and Tomorrow's Headlines: hit the headline and the "so what" — skip tracking metadata, story numbers, and status labels
- Watchlist items: mention the asset, the thesis, and the key levels — skip the Validates/Rejects framework verbatim
- Close with a brief sign-off

NUMBERS AND DATA — SPEAK LIKE A HUMAN:
- Round aggressively when precision doesn't matter. Say "up about one and a half percent" not "up 1.47 percent." Say "nearly two percent" not "1.93 percent." Say "just over half a percent" not "0.54 percent."
- Keep precise numbers ONLY when the precision is the point — specific prices, key levels, exact earnings figures
- For prices, use natural spoken forms: "sixty-eight eighty-two" for 6,882 on the S&P. "Ninety-seven thousand" not "97,412" for Bitcoin (unless the exact level matters)
- Basis points: say "twenty-five basis points" not "25 bps." For large moves, prefer plain language: "a quarter point" instead of "25 basis points" when context is clear
- Large dollar amounts: "about 1.2 billion" not "1.2 billion dollars exactly." Use "trillion," "billion," "million" — never abbreviations
- Percentages with signs: say "up about a point and a half" or "down roughly two percent" — never "plus 1.61 percent" or "minus 2.03 percent"
- Dates: say "March sixth" not "March 6, 2026." Say "last Thursday" or "earlier this week" when the exact date isn't critical
- Use approximation words naturally: "roughly," "about," "just under," "a little over," "nearly"

CRITICAL RULES:
- Preserve ALL substantive analysis and directional insights from the original
- Do NOT add information that isn't in the source material
- Do NOT hallucinate data, prices, or claims
- Expand ALL abbreviations and financial shorthand for speech (YoY → "year over year", Q3 → "third quarter")
- Spell out ticker symbols or use company names (NVDA → "NVIDIA", MSTR → "MicroStrategy")
- Remove all markdown formatting, links, emoji, and reference markers (e.g., "[See Big Story #1]")
- Keep the script to roughly 3,000-5,000 words (targeting ~15-20 minutes of audio at natural pace)

Return ONLY the podcast script. No meta-commentary, no stage directions, no [bracketed notes].`;

async function rewriteAsScript(rawContent, displayDate) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log('  Rewriting as conversational podcast script...');

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SCRIPTWRITER_PROMPT },
        { role: 'user', content: rawContent },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    });
    const script = resp.choices[0]?.message?.content?.trim();
    if (!script) throw new Error('Empty response');

    // Run regex normalization on the output to catch anything the LLM missed
    return regexNormalize(script);
  } catch (err) {
    console.log(`  ⚠ Script rewrite failed (${err.code || err.status || err.message})`);
    console.log(`    Falling back to regex-only preprocessing...`);
    // Fallback: just normalize the raw content
    return regexNormalize(rawContent);
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

const { raw: rawContent, parsed } = buildRawContent(brief);
console.log(`\nBrief: ${parsed.displayDate} (${brief.date})`);
console.log(`Sections: ${parsed.sections.length} (${parsed.sections.map(s => s.name).join(', ')})`);
console.log(`Raw content: ${rawContent.length} chars`);
console.log('');

console.log('Step 1/3: Preprocessing...');
const script = await rewriteAsScript(rawContent, parsed.displayDate);
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
