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
 * The product supports the following formats, all backward-compatible in the consumers:
 *   • SELECTION (restored 2026-06-27): `## ▸ THE UPDATE` leads (5-7 stories),
 *     then MARKETS MINUTE, INTERESTING THINGS, THE MEDITATION, THE MODEL, THE CLOSE.
 *   • TWO-TIER (v2, effective LIGHT_V2_EPOCH): selection plus `## ▸ THE LINE`
 *     (after THE UPDATE, 8-12 one-line items) and `## ▸ THE TAKE` (after
 *     MARKETS MINUTE). THE UPDATE drops to 4-5 deep stories.
 *   • IDEAS-FIRST (archived): `## ▸ THE IDEAS` + `## ▸ ALSO MOVING`, then the rest.
 * This gate detects the format from the lead header and asserts the matching contract.
 *
 * THE STORY OF THE DAY (the italic lede under the Daily Title) is DELIBERATELY
 * NOT REQUIRED, in any format. It is absent by design on days with no honest
 * through-line (expected present only 40-60% of days) — a gate that requires it
 * will manufacture one every day. Do not "fix" that here.
 *
 * WORD COUNT (added 2026-08-05, the enforcement the spec never had):
 * target 1,300-1,600 words ≈ 8-10 minutes at 160 wpm. Printed on EVERY run.
 * 🟡 advisory outside the target band · 🔴 over LIGHT_LEN_HARD (1,900) — but:
 *
 * ── THE BRIEF ALWAYS SHIPS ────────────────────────────────────────────────
 * A length failure must NEVER prevent publication. Same pattern as
 * scripts/validate-brief.ts (`brief-length`): over-hard-ceiling BLOCKS ONLY
 * under an explicit `--enforce-length` flag, which the GENERATING step passes
 * inside its own compression loop. At the publish path (no flag) it prints
 * loudly and returns nothing. The failure a blocking rail would cause — no
 * brief at all — is strictly worse than the failure it prevents.
 * Enforcement epoch: briefs dated before LIGHT_LEN_EPOCH are measured and
 * reported, never failed. The archive is read, never condemned.
 * Escape hatch (same as validate-brief.ts): `<!-- LENGTH-OVERRIDE: <reason, 20+ chars> -->`
 * turns a hard over-length into a declared, countable editorial decision.
 *
 * Usage: node --experimental-strip-types scripts/brief-light-format-gate.ts content/daily-updates/2026-06-27-light.md [--enforce-length]
 * Exit: 0 pass (may warn) · 1 contract violation (blocks ship) · 2 usage error
 */
import * as fs from 'fs';

const HEADER_RE = /^##\s*▸\s*(.+?)\s*$/;

// Word-count rails (see header comment). LIGHT_LEN_EPOCH: never condemn the archive.
const LIGHT_LEN_TARGET_LO = 1300;
const LIGHT_LEN_TARGET_HI = 1600;
const LIGHT_LEN_HARD = 1900;
const LIGHT_LEN_EPOCH = '2026-08-06';
const LIGHT_WPM = 160;

// First day the two-tier (THE LINE / THE TAKE) contract is REQUIRED.
// Briefs dated before this are checked against the original selection contract.
const LIGHT_V2_EPOCH = '2026-08-07';

const SELECTION_REQUIRED: { label: string; accepts: string[] }[] = [
  { label: 'The Update',         accepts: ['THE UPDATE'] },
  { label: 'Markets Minute',     accepts: ['MARKETS MINUTE'] },
  { label: 'Interesting Things', accepts: ['INTERESTING THINGS', 'TWO THINGS'] },
  { label: 'The Meditation',     accepts: ['THE MEDITATION'] },
  { label: 'The Model',          accepts: ['THE MODEL'] },
  { label: 'The Close',          accepts: ['THE CLOSE'] },
];
// Two-tier (v2) adds THE LINE and THE TAKE. Order below is the written order;
// presence is blocking (a missing header silently drops the section from site
// + podcast), order is advisory (consumers re-order for their own layouts).
const SELECTION_V2_REQUIRED: { label: string; accepts: string[] }[] = [
  { label: 'The Update',         accepts: ['THE UPDATE'] },
  { label: 'The Line',           accepts: ['THE LINE'] },
  { label: 'Markets Minute',     accepts: ['MARKETS MINUTE'] },
  { label: 'The Take',           accepts: ['THE TAKE'] },
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

/** Brief date from the filename (2026-08-05-light.md → "2026-08-05").
 *  Weekly lights (2026-W31-light.md) and unnamed scratch files return '' and are
 *  treated as pre-epoch: measured, never failed. */
function briefDateFromPath(file: string): string {
  const m = /(\d{4}-\d{2}-\d{2})-light\.md$/.exec(file);
  return m?.[1] ?? '';
}

function main(): number {
  const file = process.argv[2];
  if (!file) { console.error('usage: brief-light-format-gate.ts <brief-light.md> [--enforce-length]'); return 2; }
  if (!fs.existsSync(file)) { console.error(`FAIL: file not found: ${file}`); return 2; }
  const md = fs.readFileSync(file, 'utf-8');
  const lines = md.split('\n');
  const briefDate = briefDateFromPath(file);

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
  const isV2Era = briefDate !== '' && briefDate >= LIGHT_V2_EPOCH;

  const fails: string[] = [];
  const warns: string[] = [];

  if (!isSelection && !isIdeas) {
    fails.push('No lead section: expected "## ▸ THE UPDATE" (selection) or "## ▸ THE IDEAS" (ideas-first).');
  }
  const isTwoTier = isSelection && isV2Era;
  const mode = isTwoTier ? 'TWO-TIER' : isSelection ? 'SELECTION' : 'IDEAS-FIRST';
  const required = isTwoTier ? SELECTION_V2_REQUIRED : isSelection ? SELECTION_REQUIRED : IDEAS_REQUIRED;

  // Header block essentials.
  if (!/^#\s+BRIEF LIGHT\s*$/m.test(md)) warns.push('Missing "# BRIEF LIGHT" title line.');
  if (!lines.some(l => /^##\s+[A-Z][a-z]+day,/.test(l.trim()))) warns.push('Missing "## [Weekday, Month D, YYYY]" date line.');
  if (!lines.some(l => /^###\s+\S/.test(l.trim()))) warns.push('Missing "### [Daily Title]" line.');
  // NOTE: THE STORY OF THE DAY (the italic lede) is deliberately NOT checked — optional by design.

  // Required sections present (by accepted alias).
  const matched = (accepts: string[]) => headers.find(h => accepts.some(a => h.upper.startsWith(a)));
  for (const req of required) {
    if (!matched(req.accepts)) fails.push(`Missing required section: "## ▸ ${req.accepts[0]}" (${req.label}). Site + audio will drop it.`);
  }

  // Section ORDER (advisory — consumers lay out for themselves, but the written
  // order is part of the contract and drift here usually signals a bigger slip).
  const orderIdx = required
    .map(req => ({ label: req.label, at: matched(req.accepts)?.idx ?? -1 }))
    .filter(x => x.at >= 0);
  for (let i = 1; i < orderIdx.length; i++) {
    if (orderIdx[i]!.at < orderIdx[i - 1]!.at) {
      warns.push(`Section order: "${orderIdx[i]!.label}" appears before "${orderIdx[i - 1]!.label}" (expected ${required.map(r => r.label).join(' → ')}).`);
      break;
    }
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
  if (isTwoTier) {
    // Two-tier: 4-5 deep stories (the Signal holds one of them, every day).
    if (cards < 4) fails.push(`THE UPDATE has only ${cards} story headlines; two-tier format needs 4-5 deep stories. Add bold "**headline**" lines.`);
    else if (cards > 5) warns.push(`THE UPDATE has ${cards} stories (two-tier spec calls for 4-5 deep; move the extras to THE LINE).`);
  } else if (isSelection) {
    if (cards < 4) fails.push(`THE UPDATE has only ${cards} story headlines; selection format needs 5-7 (min 4). Add bold "**headline**" lines.`);
    else if (cards < 5 || cards > 7) warns.push(`THE UPDATE has ${cards} stories (spec calls for 5-7).`);
  } else {
    if (cards === 0) fails.push('No ideas parse: need bold "**headline**" lines under "## ▸ THE IDEAS", or "## ▸ THE IDEA: <title>" sections.');
    else if (cards < 2) warns.push(`Only ${cards} idea card parses (spec calls for 2-3).`);
  }

  // THE LINE — two-tier breadth tier: bold-led one-liner items, 8-12 on a normal day.
  const lineH = headers.find(h => h.upper.startsWith('THE LINE'));
  if (lineH) {
    const end = headers.find(x => x.idx > lineH.idx)?.idx ?? lines.length;
    const body = lines.slice(lineH.idx + 1, end);
    const items = body.filter(l => /^\*\*[^*]/.test(l.trim())).length;
    if (items === 0) fails.push('THE LINE parses to zero items: each item is "**Bold conclusion-first headline.** one sentence" — bold lead at line start.');
    else if (items < 6 || items > 12) warns.push(`THE LINE has ${items} items (spec: 8-12 on a normal day; the line tier is elastic and absorbs the day).`);
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

  // ── WORD COUNT — printed every run; blocking ONLY under --enforce-length ──
  // (see THE BRIEF ALWAYS SHIPS in the header comment before touching this)
  const lenBody = md.replace(/<!--[\s\S]*?-->/g, '');
  const words = lenBody.split(/\s+/).filter(Boolean).length;
  const mins = words / LIGHT_WPM;
  const enforceLength = process.argv.includes('--enforce-length');
  const lenOverride = /<!--\s*LENGTH-OVERRIDE:\s*([^>]{20,}?)\s*-->/.exec(md);
  const inEpoch = briefDate !== '' && briefDate >= LIGHT_LEN_EPOCH;
  const lenMark = words > LIGHT_LEN_HARD ? '🔴' : (words > LIGHT_LEN_TARGET_HI || words < LIGHT_LEN_TARGET_LO) ? '🟡' : '✅';
  console.log(`${lenMark} LIGHT LENGTH: ${words.toLocaleString()} words ≈ ${mins.toFixed(1)} min at ${LIGHT_WPM} wpm (target ${LIGHT_LEN_TARGET_LO.toLocaleString()}-${LIGHT_LEN_TARGET_HI.toLocaleString()} ≈ 8-10 min, hard ceiling ${LIGHT_LEN_HARD.toLocaleString()})`);
  if (words > LIGHT_LEN_HARD && inEpoch) {
    if (lenOverride) {
      console.log(`  ⚪ LENGTH-OVERRIDE accepted — ${lenOverride[1]!.trim()}`);
    } else if (!enforceLength) {
      console.log(`  🔴 OVER HARD CEILING by ${(words - LIGHT_LEN_HARD).toLocaleString()} words (${mins.toFixed(1)} min vs 8-10). NOT BLOCKING — the brief always ships.`);
      console.log(`     The generating step owns this (\`brief-light-format-gate <file> --enforce-length\` inside its own`);
      console.log(`     compression loop). If you are seeing this at the publish path, the generator did not compress`);
      console.log(`     and did not declare — that is the thing to fix, not the brief.`);
    } else {
      fails.push(
        `LIGHT LENGTH HARD FAIL: ${words.toLocaleString()} words ≈ ${mins.toFixed(1)} min against an 8-10 minute product (target ${LIGHT_LEN_TARGET_LO.toLocaleString()}-${LIGHT_LEN_TARGET_HI.toLocaleString()}, ceiling ${LIGHT_LEN_HARD.toLocaleString()}). ` +
        `Cut DEPTH, never COVERAGE: shorten THE LINE items toward their ~36-word floor → shorten the already-covered sections (Meditation, Model, Markets Minute) → move a deep item down to THE LINE. ` +
        `Dropping a story is the last resort and needs a logged reason. If today genuinely needs the length, declare it: <!-- LENGTH-OVERRIDE: <reason, 20+ chars> -->`,
      );
    }
  } else if (words > LIGHT_LEN_TARGET_HI && inEpoch) {
    warns.push(`Length ${words.toLocaleString()} is over target ${LIGHT_LEN_TARGET_HI.toLocaleString()} (advisory band up to ${LIGHT_LEN_HARD.toLocaleString()}). Shorten lines first; never cut coverage.`);
  } else if (words < LIGHT_LEN_TARGET_LO && inEpoch) {
    warns.push(`Length ${words.toLocaleString()} is under target ${LIGHT_LEN_TARGET_LO.toLocaleString()}. Never blocking — but check whether coverage was dropped (every full-brief story belongs in a tier).`);
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
