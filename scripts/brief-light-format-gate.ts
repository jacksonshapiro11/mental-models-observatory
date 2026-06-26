#!/usr/bin/env node --experimental-strip-types
/**
 * brief-light-format-gate.ts — the FORMAT FAILSAFE for the ideas-first Super Brief.
 *
 * Why this exists: the Super Brief (`content/daily-updates/[DATE]-light.md`) is
 * parsed by TWO hardcoded consumers — the website (`lib/brief-light-parser.ts` →
 * `components/super-brief/SuperBriefViewer.tsx`) and the podcast
 * (`lib/audio/text-preprocessor.ts`). Both key off the exact `## ▸` section
 * headers. When the ideas-first format shipped without updating them, a renamed /
 * missing / merged header SILENTLY produced blank sections on the site and a
 * broken, ending-less episode. The consumer can't auto-correct a malformed file;
 * it just renders nothing. So this gate asserts the header contract at the
 * markdown level BEFORE publish, turning a silent render-break into a loud,
 * specific, fixable error — in the same verify-and-correct spirit as the other
 * gates (catch it, fix it, never ship it broken).
 *
 * It is deliberately self-contained (no parser import): it validates the raw
 * contract defined in `system/Brief_Light_Generator.md` → "Output Format
 * Contract", which is precisely what both consumers depend on.
 *
 * Usage:
 *   node --experimental-strip-types scripts/brief-light-format-gate.ts content/daily-updates/2026-06-22-light.md
 *
 * Exit codes: 0 pass (may print warnings) · 1 contract violation (blocks ship) · 2 usage error
 */
import * as fs from 'fs';

// Required sections, by the header-prefix the website parser maps (sectionMetaFor).
// Each entry: a human label + the accepted UPPERCASE header prefixes (aliases).
const REQUIRED: { label: string; accepts: string[] }[] = [
  { label: 'The Ideas',              accepts: ['THE IDEAS', 'THE IDEA', 'THE BIG IDEA'] },
  { label: 'Also Moving',            accepts: ['ALSO MOVING'] },
  { label: 'Markets Minute',         accepts: ['MARKETS MINUTE'] },
  { label: 'Two Things Worth Knowing', accepts: ['TWO THINGS', 'INTERESTING THINGS'] },
  { label: 'The Meditation',         accepts: ['THE MEDITATION'] },
  { label: 'The Model',              accepts: ['THE MODEL'] },
  { label: 'The Close',              accepts: ['THE CLOSE'] },
];

const HEADER_RE = /^##\s*▸\s*(.+?)\s*$/;

function main(): number {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: brief-light-format-gate.ts <brief-light.md>');
    return 2;
  }
  if (!fs.existsSync(file)) {
    console.error(`FAIL: file not found: ${file}`);
    return 2;
  }
  const md = fs.readFileSync(file, 'utf-8');
  const lines = md.split('\n');

  // Collect the ## ▸ headers in document order.
  const headers: { idx: number; raw: string; upper: string }[] = [];
  lines.forEach((ln, idx) => {
    const m = ln.match(HEADER_RE);
    if (m && m[1]) {
      const raw = m[1].trim();
      const head = (raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw).trim();
      headers.push({ idx, raw, upper: head.toUpperCase() });
    }
  });

  const fails: string[] = [];
  const warns: string[] = [];

  // 1. Header block essentials.
  if (!/^#\s+BRIEF LIGHT\s*$/m.test(md)) warns.push('Missing "# BRIEF LIGHT" title line.');
  if (!lines.some(l => /^##\s+[A-Z][a-z]+day,/.test(l.trim()))) warns.push('Missing "## [Weekday, Month D, YYYY]" date line.');
  if (!lines.some(l => /^###\s+\S/.test(l.trim()))) warns.push('Missing "### [Daily Title]" line.');

  // 2. Every required section present (by accepted alias).
  const matched = (accepts: string[]) => headers.find(h => accepts.some(a => h.upper.startsWith(a)));
  for (const req of REQUIRED) {
    if (!matched(req.accepts)) {
      fails.push(`Missing required section: "## ▸ ${req.accepts[0]}" (${req.label}). Site + audio will drop it.`);
    }
  }

  // 3. The ideas must yield >= 1 card: either bold headlines inside "## ▸ THE IDEAS",
  //    or one or more "## ▸ THE IDEA: <title>" sections.
  const ideaHeaders = headers.filter(h => h.upper.startsWith('THE IDEA') || h.upper.startsWith('THE BIG IDEA'));
  let ideaCards = 0;
  for (let i = 0; i < ideaHeaders.length; i++) {
    const h = ideaHeaders[i]!;
    const titled = h.raw.includes(':') && h.raw.slice(h.raw.indexOf(':') + 1).trim().length > 0;
    const end = headers.find(x => x.idx > h.idx)?.idx ?? lines.length;
    const body = lines.slice(h.idx + 1, end);
    const boldHeadlines = body.filter(l => /^\*\*[^*].*[^*]\*\*\s*$/.test(l.trim())).length;
    ideaCards += titled ? 1 : boldHeadlines; // titled section = 1 idea; THE IDEAS block = N bold headlines
  }
  if (ideaCards === 0) fails.push('No ideas parse: need bold "**headline**" lines under "## ▸ THE IDEAS", or "## ▸ THE IDEA: <title>" sections.');
  else if (ideaCards < 2) warns.push(`Only ${ideaCards} idea card parses (spec calls for 2-3).`);

  // 4. The Model: needs a name (### line or "THE MODEL: <name>") and an Explore link.
  const modelH = headers.find(h => h.upper.startsWith('THE MODEL'));
  if (modelH) {
    const end = headers.find(x => x.idx > modelH.idx)?.idx ?? lines.length;
    const body = lines.slice(modelH.idx + 1, end);
    const hasName = modelH.raw.includes(':') && modelH.raw.slice(modelH.raw.indexOf(':') + 1).trim().length > 0
      || body.some(l => /^###\s+\S/.test(l.trim()));
    const hasLink = body.some(l => /\[[^\]]*\]\([^)]+\)/.test(l));
    if (!hasName) warns.push('The Model has no name (### line or "THE MODEL: <name>").');
    if (!body.some(l => /^\*\*\s*use it/i.test(l.trim()))) warns.push('The Model has no **Use it:** takeaway (the deep keeper needs one).');
    if (!hasLink) warns.push('The Model has no [→ Explore](url) link.');
  }

  // 5. The Meditation should open with *"quote"* attribution.
  const medH = headers.find(h => h.upper.startsWith('THE MEDITATION'));
  if (medH) {
    const end = headers.find(x => x.idx > medH.idx)?.idx ?? lines.length;
    const body = lines.slice(medH.idx + 1, end).map(l => l.trim()).filter(Boolean);
    if (!body.some(l => /^\*["“”].+["“”]\*/.test(l))) warns.push('The Meditation has no *"quote"* line.');
  }

  // Report
  const name = file.split('/').pop();
  if (fails.length) {
    console.error(`\n✗ FORMAT GATE FAILED — ${name}\n`);
    for (const f of fails) console.error(`  ✗ ${f}`);
    if (warns.length) { console.error('\n  warnings:'); for (const w of warns) console.error(`  ⚠ ${w}`); }
    console.error('\n  Fix the headers to match system/Brief_Light_Generator.md → "Output Format Contract", then re-run. Do not publish until this passes.\n');
    return 1;
  }
  console.log(`\n✓ FORMAT GATE PASSED — ${name}  (${ideaCards} idea cards, all required sections present)`);
  if (warns.length) { console.log('  warnings (non-blocking):'); for (const w of warns) console.log(`  ⚠ ${w}`); }
  console.log('');
  return 0;
}

process.exit(main());
