/**
 * Local audio test — generates podcast from sample brief.
 *
 * Usage:
 *   node scripts/test-audio-local.mjs              # default voice (onyx)
 *   node scripts/test-audio-local.mjs ash           # test with ash voice
 *   node scripts/test-audio-local.mjs coral          # test with coral voice
 *   node scripts/test-audio-local.mjs --skip-script  # reuse last script, TTS only (faster iteration on voice)
 *
 * Outputs:
 *   test-audio-output-{voice}.mp3   — the audio
 *   test-audio-script.txt           — the GPT-4o scriptwriter output (shared across voices)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

// Parse CLI args
const args = process.argv.slice(2);
const VOICE = args.find(a => !a.startsWith('--')) || 'onyx';
const SKIP_SCRIPT = args.includes('--skip-script');

const client = new OpenAI({ apiKey });

// ─── Load the sample brief ──────────────────────────────────────────────────
const briefMd = fs.readFileSync(path.join(__dirname, 'test-brief-sample.md'), 'utf-8');

// ─── Extract sections from markdown ─────────────────────────────────────────
const SECTION_MARKERS = [
  '# ▸ THE DASHBOARD',
  '# ▸ THE SIX',
  '# ▸ THE TAKE',
  '# ▸ ASSET SPOTLIGHT',
  '# ▸ INNER GAME',
  '# ▸ THE MODEL',
  '# ▸ DISCOVERY',
];

function extractSections(md) {
  const sections = [];
  for (let i = 0; i < SECTION_MARKERS.length; i++) {
    const marker = SECTION_MARKERS[i];
    const start = md.indexOf(marker);
    if (start === -1) continue;

    const afterMarker = md.indexOf('\n', start);
    if (afterMarker === -1) continue;

    let end = md.length;
    for (const m of SECTION_MARKERS) {
      if (m === marker) continue;
      const idx = md.indexOf(m);
      if (idx > start && idx < end) end = idx;
    }
    // Also check for END OF EXAMPLE
    const endMarker = md.indexOf('## END OF EXAMPLE');
    if (endMarker > start && endMarker < end) end = endMarker;

    let content = md.slice(afterMarker + 1, end).trim();
    if (content.endsWith('---')) content = content.slice(0, -3).trim();

    const name = marker.replace(/^#\s*▸\s*/, '').trim();
    sections.push({ name, content });
  }
  return sections;
}

// ─── Split The Six into sub-sections ────────────────────────────────────────
function splitSix(content) {
  const subs = [];
  const lines = content.split('\n');
  let currentName = 'Overview';
  let currentLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        if (text.length > 30) subs.push({ name: `The Six: ${currentName}`, content: text });
      }
      currentName = trimmed.replace(/^#+\s*/, '');
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    const text = currentLines.join('\n').trim();
    if (text.length > 30) subs.push({ name: `The Six: ${currentName}`, content: text });
  }
  return subs;
}

// ─── GPT-4o scriptwriter per section ────────────────────────────────────────
const SYSTEM_PROMPT = `You are a podcast scriptwriter for "Markets, Meditations, and Mental Models" by Cosmic Trex — a daily financial market intelligence podcast.

YOUR JOB: Convert written market analysis into natural, conversational spoken form. Do NOT summarize or compress. Every insight, every thesis, every key level, every "so what" from the source must appear in your output.

VOICE: You're writing how a smart friend actually talks when explaining something fascinating. The listener should feel ENERGIZED and SMARTER — not weighed down. Even when news is heavy, the energy is "isn't it fascinating that we get to think about this?" not "everything is terrible."
- Use contractions everywhere
- Vary pacing — match the weight of the idea
- Plain language first; if you need jargon, explain it immediately then keep the full analytical depth
- No hype phrases ("buckle up", "here's where it gets interesting", "game-changer", "let that sink in")

TRANSITIONS — MOST IMPORTANT:
The podcast is ONE continuous conversation. Flow naturally from the previous section. Thread between bullets — don't start each one cold. Techniques: "Meanwhile..." / "On a completely different front..." / "Speaking of infrastructure..." / "And that connects to..." Between major sections, reference something specific from what just happened. If TRANSITION CONTEXT is provided, USE IT.

DEPTH: Simplify the LANGUAGE, not the THINKING. Keep second-order effects, keep specifics (spreads, basis points, TVL). The listener is smart and wants to get smarter.

NUMBERS: Round commodities/stocks. Keep yield precision. Round percentages to halves. Say "about" and "roughly."

SKIP: Markdown, links, emoji, reference markers, confidence scores.
Expand abbreviations (YoY → year over year, ETF → E.T.F.).
Spell out tickers (NVDA → NVIDIA).

Return ONLY the spoken script. No [brackets] or meta-commentary.`;

const SECTION_INSTRUCTIONS = {
  'THE DASHBOARD': 'Starting the Markets section. Structural regime read with full depth — what\'s the session\'s character, what regime is forming or breaking. Thread between sub-sections. Commentary only, not data.',
  'The Six: Markets & Macro': 'Opening The Six — say "Alright, let\'s get into The Six — starting with Markets and Macro." Cover EVERY bullet with full analytical depth. Regime-based structural reads. CRITICAL: Thread between bullets naturally.',
  'The Six: Companies & Crypto': 'Call it "Companies and Crypto." Cover EVERY bullet with full depth. Thread between bullets — connect stories that rhyme.',
  'The Six: AI & Tech': 'Call it "AI and Tech." Cover EVERY bullet with full depth. Thread between bullets if they tell a bigger story.',
  'The Six: Geopolitics': 'Call it "Geopolitics." Cover EVERY bullet. Compress dominant theater, give more time to others. Thread between bullets.',
  'The Six: The Wild Card': 'Call it "The Wild Card" with a shift in energy. Cover each item with genuine curiosity. This should be FUN. Thread between items where possible.',
  'The Six: The Signal': 'Call it "The Signal." Forward-looking items. Each ends with a clear if/then in plain language. Thread between signals if they connect.',
  'THE TAKE': 'Heart of the Markets section — big picture argument. Full treatment, don\'t compress. Keep ALL nuance including "where this might be wrong."',
  'ASSET SPOTLIGHT': 'Thesis check on one asset. Full depth — spreads, catalysts, thesis adjustment. Don\'t dumb it down.',
  'INNER GAME': 'Read warmly with genuine presence. Let it breathe. No market references. Should feel uplifting, not heavy.',
  'THE MODEL': 'Explain with genuine intellectual energy. Keep the full depth of the application. Should make the listener feel like they gained a new tool.',
  'DISCOVERY': 'Original essay — teach it with fascination. NOT a reading recommendation. Should end the episode on intellectual wonder.',
};

// Act transitions — when crossing Markets → Meditations → Mental Models
const ACT_TRANSITIONS = {
  'THE DASHBOARD': 'ACT TRANSITION: You\'re opening the Markets section of the episode — the first of three acts (Markets, Meditations, Mental Models). After the intro, signal the start of Markets naturally — "Alright, let\'s start with the Markets. Here\'s the Dashboard." The listener should know they\'re entering the market intelligence portion.',
  'INNER GAME': 'ACT TRANSITION: You just finished the Markets section (Dashboard, The Six, The Take, Asset Spotlight). You\'re crossing into the Meditations section — the personal, human part. Signal the shift naturally — "Alright, that\'s the markets. Now let\'s shift gears — time for the part of the show that\'s just about you." Change the energy.',
  'THE MODEL': 'ACT TRANSITION: You just finished Meditations (Inner Game). You\'re crossing into Mental Models — the thinking tools section. Signal the shift — "OK, let\'s get the brain working. Time for Mental Models — starting with today\'s model." Fresh burst of intellectual energy.',
};

async function rewriteSection(name, content, context = {}) {
  const instruction = SECTION_INSTRUCTIONS[name] || `Convert "${name}" into natural spoken podcast form. Include ALL substantive content.`;

  // Build transition context
  let transitionContext = '';
  const parts = [];
  if (context.actTransition) parts.push(context.actTransition);
  if (context.prevSection) parts.push(`PREVIOUS SECTION: "${context.prevSection}" — the listener just heard this. Flow naturally FROM it. Reference something, pick up a thread, or acknowledge the shift. Don't start cold.`);
  if (context.nextSection) parts.push(`NEXT SECTION: "${context.nextSection}" — this comes after you. Let your ending be warm and complete.`);
  if (parts.length > 0) transitionContext = '\n\nTRANSITION CONTEXT:\n' + parts.join('\n');

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `SECTION: ${name}\n\nINSTRUCTION: ${instruction}${transitionContext}\n\nCONTENT:\n${content}` },
      ],
      temperature: 0.4,
    });
    return resp.choices[0]?.message?.content?.trim() || content;
  } catch (err) {
    console.warn(`  ⚠ Scriptwriter failed for "${name}": ${err.message}`);
    return content;
  }
}

// ─── TTS generation ─────────────────────────────────────────────────────────
const VOICE_INSTRUCTIONS = `Voice: warm, energized, genuinely curious — like a smart friend who's excited to share what they've been reading over morning coffee. Not a podcast host performing. Not a news anchor delivering bad news. A real person who finds this stuff fascinating and wants you to find it fascinating too.

Pacing: Vary naturally. Slow down and let weight land on key insights — the "so what" moments. Move briskly through transitions. Pause briefly between sections to let the listener reset. But keep the momentum — this should feel like a conversation that's going somewhere, not a lecture.

Tone: Confident and curious. Even when the content is serious (rate hikes, geopolitical crises), the energy should be "isn't it interesting that we get to think about this?" — not doom and gloom. The listener should feel sharper and more alive after listening, not drained. Warm during Inner Game. Intellectually excited during Discovery and The Model. Direct and clear during market sections.

Energy: Medium-high — present, engaged, genuinely interested. Think: the best conversation at a dinner party where everyone is smart and curious. Let real enthusiasm come through. The listener chose to spend their morning with you — reward that choice with energy.

Avoid: Robotic cadence, singsong patterns, dramatic pauses for effect, breathy emphasis on every other word, monotone delivery through dense content, depressive gravity, funeral-director solemnity.`;

async function generateTTSChunk(text) {
  const resp = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: VOICE,
    input: text,
    instructions: VOICE_INSTRUCTIONS,
    response_format: 'mp3',
  });
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf);
}

function chunkText(text, maxChars = 3500) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const combined = current ? `${current}\n\n${trimmed}` : trimmed;
    if (combined.length > maxChars && current) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== Local Audio Test ===`);
  console.log(`Voice: ${VOICE} | Model: gpt-4o-mini-tts | Skip script: ${SKIP_SCRIPT}\n`);
  const t0 = Date.now();

  const scriptPath = path.join(__dirname, '..', 'test-audio-script.txt');
  let fullScript;

  if (SKIP_SCRIPT && fs.existsSync(scriptPath)) {
    // Reuse existing script — only regenerate TTS (much faster for voice A/B testing)
    console.log('[1/3] Reusing existing script from test-audio-script.txt');
    fullScript = fs.readFileSync(scriptPath, 'utf-8');
    console.log(`  → ${fullScript.length} chars\n`);
  } else {
    // 1. Extract sections
    const rawSections = extractSections(briefMd);
    const sections = [];
    for (const sec of rawSections) {
      if (sec.name === 'THE SIX') {
        sections.push(...splitSix(sec.content));
      } else {
        sections.push(sec);
      }
    }
    console.log(`Extracted ${sections.length} sections: ${sections.map(s => s.name).join(', ')}\n`);

    // 2. Scriptwriter (parallel)
    console.log('[1/3] GPT-4o scriptwriter (parallel)...');
    const scriptStart = Date.now();

    // Build ordered task list: intro + all sections
    const allTasks = [
      { name: 'intro', content: `DATE: Sunday, March 29, 2026\nLEDE: Rate hike probability crossed 50% for the first time this cycle. All five US indices now in correction. Iran blocked Chinese ships from Hormuz — ending preferential passage. The regime changed this week.` },
      ...sections,
    ];

    const sectionScriptsAll = await Promise.all(
      allTasks.map(async (task, i) => {
        const prevTask = i > 0 ? allTasks[i - 1] : undefined;
        const nextTask = i < allTasks.length - 1 ? allTasks[i + 1] : undefined;
        const context = {
          prevSection: prevTask?.name,
          nextSection: nextTask?.name,
          actTransition: ACT_TRANSITIONS[task.name],
        };
        const script = await rewriteSection(task.name, task.content, context);
        console.log(`  ✓ ${task.name} (${script.length} chars)`);
        return script;
      })
    );

    const introScript = sectionScriptsAll[0];
    const sectionScripts = sectionScriptsAll.slice(1);

    const epigraph = "The person you'll be in five years is being built by the decisions you're making this week. Most of them aren't about money.";
    const signOff = "That's today's brief. Thank you for spending part of your morning with us. Hopefully you're walking away a bit more informed, a bit more grounded, and a bit more curious about what's forming around the corner. We'll be back tomorrow with more. Until then — yesterday is history, tomorrow is a mystery, but today is a gift, and that is why it's called the present. Take care.";

    const PAUSE = '\n\n...\n\n';
    fullScript = [epigraph, introScript, ...sectionScripts, signOff].join(PAUSE);

    console.log(`  → Total script: ${fullScript.length} chars (${((Date.now() - scriptStart) / 1000).toFixed(1)}s)\n`);

    // Save script for reuse
    fs.writeFileSync(scriptPath, fullScript);
    console.log('  → Script saved to test-audio-script.txt');
  }

  // 3. TTS (parallel chunks)
  console.log(`\n[2/3] gpt-4o-mini-tts generation (voice: ${VOICE})...`);
  const ttsStart = Date.now();
  const chunks = chunkText(fullScript, 3500);
  console.log(`  → ${chunks.length} chunks`);

  const audioBuffers = await Promise.all(
    chunks.map(async (chunk, i) => {
      const buf = await generateTTSChunk(chunk);
      console.log(`  ✓ chunk ${i + 1}/${chunks.length} (${buf.length} bytes)`);
      return buf;
    })
  );

  const audio = Buffer.concat(audioBuffers);
  const ttsMs = Date.now() - ttsStart;
  const estimatedDuration = Math.round(audio.length / (128000 / 8));

  console.log(`  → ${audio.length} bytes total (${(ttsMs / 1000).toFixed(1)}s)`);
  console.log(`  → Estimated duration: ${Math.floor(estimatedDuration / 60)}m ${estimatedDuration % 60}s`);

  // 4. Save with voice name in filename
  const outputPath = path.join(__dirname, '..', `test-audio-output-${VOICE}.mp3`);
  fs.writeFileSync(outputPath, audio);
  console.log(`\n[3/3] Audio saved to ${outputPath}`);
  console.log(`\nTotal time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`\nDone! Open test-audio-output-${VOICE}.mp3 to listen.`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
