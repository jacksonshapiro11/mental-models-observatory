#!/usr/bin/env node --experimental-strip-types
/**
 * brief-light-format-gate.ts — FORMAT FAILSAFE for the Super Brief (both formats).
 *
 * The Super Brief (content/daily-updates/[DATE]-light.md) is parsed by two
 * hardcoded consumers — the website (lib/brief-light-parser.ts →
 * components/super-brief/SuperBriefViewer.tsx) and the podcast
 * (lib/audio/text-preprocessor.ts) — both keyed off the exact `## ▸` headers.
 * A renamed / missing / merged header SILENTLY drops that section from BOTH.
 *
 * The product supports TWO formats, both backward-compatible in the consumers:
 *   • SELECTION (restored 2026-06-27): `## ▸ THE UPDATE` leads (5-7 stories),
 *     then MARKETS MINUTE, INTERESTING THINGS, THE MEDITATION, THE MODEL, THE CLOSE.
 *   • IDEAS-FIRST (archived): `## ▸ THE IDEAS` + `## ▸ ALSO MOVING`, then the rest.
 * This gate detects the format from the lead header and asserts the matching contract.
 *
 * Usage: node --experimental-strip-types scripts/brief-light-format-gate.ts content/daily-updates/2026-06-27-light.md
 * Exit: 0 pass (may warn) · 1 contract violation (blocks ship) · 2 usage error
 */
import * as fs from 'fs';

const HEADER_RE = /^##\s*▸\s*(.+?)\s*$/;

const SELECTION_REQUIRED: { label: string; accepts: string[] }[] = [
  { label: 'The Update',         accepts: ['THE UPDATE'] },
  { label: 'Markets Minute',     accepts: ['MARKETS MINUTE'] },
  { label: 'Interesting Things', accepts: ['INTERESTING THINGS', 'TWO THINGS'] },
  { label: 'The Meditation',     accepts: ['THE MEDITATION'] },
  { label: 'The Model',          accepts: ['THE MODEL'] },
  { label: 'The Close',          accepts: ['THE CLOSE'] },
];
const IDEAS_REQUIRED: { label: string; accepts: string[] }[] = [
  { label: 'The Ideas',                accepts: ['THE IDEAS', 'THE IDEA', 'THE BIG IDEA'] },
  { label: 'Also Moving',              accepts: ['ALSO MOVING'] },
  { label: 'Markets Minute',           accepts: ['MARKETS MINUTE'] },
  { label: 'Two Things Worth Knowing', accepts: ['TWO THINGS', 'INTERESTING THINGS'] },
  { label: 'The Meditation',           accepts: ['THE MEDITATION'] },
  { label: 'The Model',                accepts: ['THE MODEL'] },
  { label: 'The Close',                accepts: ['THE CLOSE'] },
];

function main(): number {
  const file = process.argv[2];
  if (!file) { console.error('usage: brief-light-format-gate.ts <brief-light.md>'); return 2; }
  if (!fs.existsSync(file)) { console.error(`FAIL: file not found: ${file}`); return 2; }
  const md = fs.readFileSync(file, 'utf-8');
  const lines = md.split('\n');

  const headers: { idx: number; raw: string; upper: string }[] = [];
  lines.forEach((ln, idx) => {
    const m = ln.match(HEADER_RE);
    if (m && m[1]) {
      const raw = m[1].trim();
      const head = (raw.includes(':') ? raw.slice(0, raw.indexOf(':')) : raw).trim();
      headers.push({ idx, raw, upper: head.toUpperCase() });
    }
  });
  const has = (p: string) => headers.some(h => h.upper.startsWith(p));
  const isSelection = has('THE UPDATE');
  const isIdeas = has('THE IDEAS') || has('THE IDEA') || has('THE BIG IDEA');

  const fails: string[] = [];
  const warns: string[] = [];

  if (!isSelection && !isIdeas) {
    fails.push('No lead section: expected "## ▸ THE UPDATE" (selection) or "## ▸ THE IDEAS" (ideas-first).');
  }
  const mode = isSelection ? 'SELECTION' : 'IDEAS-FIRST';
  const required = isSelection ? SELECTION_REQUIRED : IDEAS_REQUIRED;

  // Header block essentials.
  if (!/^#\s+BRIEF LIGHT\s*$/m.test(md)) warns.push('Missing "# BRIEF LIGHT" title line.');
  if (!lines.some(l => /^##\s+[A-Z][a-z]+day,/.test(l.trim()))) warns.push('Missing "## [Weekday, Month D, YYYY]" date line.');
  if (!lines.some(l => /^###\s+\S/.test(l.trim()))) warns.push('Missing "### [Daily Title]" line.');

  // Required sections present (by accepted alias).
  const matched = (accepts: string[]) => headers.find(h => accepts.some(a => h.upper.startsWith(a)));
  for (const req of required) {
    if (!matched(req.accepts)) fails.push(`Missing required section: "## ▸ ${req.accepts[0]}" (${req.label}). Site + audio will drop it.`);
  }

  // Lead section must yield cards (bold headlines, or "## ▸ THE IDEA: <title>").
  const leadPrefixes = isSelection ? ['THE UPDATE'] : ['THE IDEA', 'THE BIG IDEA'];
  const leadHeaders = headers.filter(h => leadPrefixes.some(p => h.upper.startsWith(p)));
  let cards = 0;
  for (const h of leadHeaders) {
    const titled = h.raw.includes(':') && h.raw.slice(h.raw.indexOf(':') + 1).trim().length > 0;
    const end = headers.find(x => x.idx > h.idx)?.idx ?? lines.length;
    const body = lines.slice(h.idx + 1, end);
    const boldHeadlines = body.filter(l => /^\*\*[^*].*[^*]\*\*\s*$/.test(l.trim())).length;
    cards += titled ? 1 : boldHeadlines;
  }
  if (isSelection) {
    if (cards < 4) fails.push(`THE UPDATE has only ${cards} story headlines; selection format needs 5-7 (min 4). Add bold "**headline**" lines.`);
    else if (cards < 5 || cards > 7) warns.push(`THE UPDATE has ${cards} stories (spec calls for 5-7).`);
  } else {
    if (cards === 0) fails.push('No ideas parse: need bold "**headline**" lines under "## ▸ THE IDEAS", or "## ▸ THE IDEA: <title>" sections.');
    else if (cards < 2) warns.push(`Only ${cards} idea card parses (spec calls for 2-3).`);
  }

  // The Model: name + Explore link. (Use-it takeaway only expected on the ideas-first deep model.)
  const modelH = headers.find(h => h.upper.startsWith('THE MODEL'));
  if (modelH) {
    const end = headers.find(x => x.idx > modelH.idx)?.idx ?? lines.length;
    const body = lines.slice(modelH.idx + 1, end);
    const hasName = (modelH.raw.includes(':') && modelH.raw.slice(modelH.raw.indexOf(':') + 1).trim().length > 0)
      || body.some(l => /^###\s+\S/.test(l.trim()));
    const hasLink = body.some(l => /\[[^\]]*\]\([^)]+\)/.test(l));
    if (!hasName) warns.push('The Model has no name (### line or "THE MODEL: <name>").');
    if (isIdeas && !body.some(l => /^\*\*\s*use it/i.test(l.trim()))) warns.push('The Model has no **Use it:** takeaway (the ideas-first deep keeper needs one).');
    if (!hasLink) warns.push('The Model has no [→ Explore](url) link.');
  }

  // The Meditation should open with *"quote"*.
  const medH = headers.find(h => h.upper.startsWith('THE MEDITATION'));
  if (medH) {
    const end = headers.find(x => x.idx > medH.idx)?.idx ?? lines.length;
    const body = lines.slice(medH.idx + 1, end).map(l => l.trim()).filter(Boolean);
    if (!body.some(l => /^\*["“”].+["“”]\*/.test(l))) warns.push('The Meditation has no *"quote"* line.');
  }

  const name = file.split('/').pop();
  if (fails.length) {
    console.error(`\n✗ FORMAT GATE FAILED (${mode}) — ${name}\n`);
    for (const f of fails) console.error(`  ✗ ${f}`);
    if (warns.length) { console.error('\n  warnings:'); for (const w of warns) console.error(`  ⚠ ${w}`); }
    console.error('\n  Fix headers to match system/Brief_Light_Generator.md → "Output Format Contract", then re-run.\n');
    return 1;
  }
  console.log(`\n✓ FORMAT GATE PASSED (${mode}) — ${name}  (${cards} ${isSelection ? 'stories' : 'idea cards'}, all required sections present)`);
  if (warns.length) { console.log('  warnings (non-blocking):'); for (const w of warns) console.log(`  ⚠ ${w}`); }
  console.log('');
  return 0;
}
process.exit(main());
