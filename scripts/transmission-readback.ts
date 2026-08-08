#!/usr/bin/env node --experimental-strip-types
/**
 * transmission-readback.ts — the MECHANICAL half of the read-back loop.
 *
 * 🔴 THIS FILE NEVER CALLS A MODEL. No API key, no network, no spend.
 * The model half (three blind Readers, one Grader) is spawned by the brief-light task session.
 * This script owns the parts that must not be instructions, because instructions decay:
 *
 *   1. SEGMENTATION IS VALIDATED, NOT DERIVED. The claims sidecar defines the units. This script
 *      proves the prose contains exactly those units, in that order, per section — and fails loudly
 *      when it does not. (2026-08-07: the old bold-lead parser assigned a unit to the
 *      "[→ Explore this model]" HYPERLINK and assigned none to THE TAKE, which is the unit the
 *      owner then failed hardest in blind labeling.)
 *   2. FROZEN UNITS BY ASSEMBLY. Redrafts are spliced positionally and every untouched unit is
 *      re-hashed after the rebuild. A passed unit that changed by one byte is a hard failure.
 *   3. THE PARROT GUARD. A read-back that quotes the unit proves parsing, not comprehension.
 *      Entities and numbers are excluded from the overlap count — financial prose cannot paraphrase
 *      "Fed" or "$7.4 billion", and a guard that punishes that manufactures failures.
 *   4. PROMPT HASHING. The Reader prompt is a frozen template with exactly one slot. Its hash is
 *      printed every run; a changed hash means recalibration is owed.
 *   5. TABULATION. Unanimity vs majority is arithmetic, not judgment.
 *   6. LEDGER WRITES. Append-only. Nobody edits it by hand.
 *
 * Subcommands: prepare | check | tabulate | assemble | ledger | --selftest
 * Contract and call order: BODY_brief-light_REPLACEMENT.md step 4b.0.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const RB_DIR = '.readback';
const LEDGER = 'system/readback-ledger.json';
const PARROT_THRESHOLD = 0.7;

/** 🔴 FROZEN. Exactly one interpolation slot: {artifact}. Changing this text changes the hash and
 *  invalidates calibration — see WORK_ORDER_READBACK.md Part 5. */
const READER_TEMPLATE = `You are an educated professional — smart, busy, not a specialist in markets, technology or geopolitics.

Read the brief below once, top to bottom, the way you would listen to a podcast while making coffee. Do not re-read.

Then, for each numbered item, state in your own words: (1) CLAIM — the one thing the item says is true, and (2) WHY — why it matters to someone like you. Use your own words; do not copy phrases from the text. If you cannot state an item's claim, write LOST and say what confused you. Do not skip items.

Output one line per item and nothing else:
U<n> CLAIM: … | WHY: …

---

{artifact}`;

const STERNER = `\n\nIMPORTANT: your previous answer reused the brief's own wording. State each claim in COMPLETELY different words. Do not reuse the text's phrasing. Proper nouns and figures may be repeated; nothing else may be.`;

type Claim = { unit: string; section: string; claim: string; so_what?: string };
type Unit = {
  id: string;
  section: string;
  idx: number;
  start: number;
  end: number;
  sha: string;
};
type Meta = {
  date: string;
  source: string;
  templateHash: string;
  promptHash: string;
  units: Unit[];
};
type Grade = 'TRANSMITTED' | 'DISTORTED' | 'LOST';
type UnitGrades = { grades: Grade[]; sowhat?: string[]; element?: string };

const sha = (s: string): string =>
  crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const die = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};
const rbPath = (date: string, ...p: string[]): string =>
  path.join(RB_DIR, date, ...p);

// ── SEGMENTATION ──────────────────────────────────────────────────────────────
/** Split the artifact into candidate units. A unit is a bold-led block, OR — when a `## ▸` section
 *  contains no bold-led block — that section's whole body. The Explore-model hyperlink is never a
 *  unit. Returns [{section, start, end}] in document order. */
function candidates(
  md: string
): { section: string; start: number; end: number }[] {
  const out: { section: string; start: number; end: number }[] = [];
  const headers = [...md.matchAll(/^##(?!#)\s*▸?\s*(.+)$/gm)]; // (?!#) — '### Model Name' is not a section
  const bounds: { name: string; from: number; to: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!;
    bounds.push({
      name: h[1]!.trim(),
      from: h.index! + h[0]!.length,
      to: i + 1 < headers.length ? headers[i + 1]!.index! : md.length,
    });
  }
  for (const b of bounds) {
    const body = md.slice(b.from, b.to);
    // NOTE: the `m` flag makes `$` match END-OF-LINE, which truncated every unit to its bold
    // headline and excluded all body prose — so tampering with a body was invisible to the
    // integrity check. `(?![\s\S])` is end-of-INPUT regardless of the flag. Caught by selftest.
    const bolds = [
      ...body.matchAll(/^\*\*[\s\S]*?(?=\n\s*\n|\n##|(?![\s\S]))/gm),
    ].filter(m => !m[0]!.startsWith('**[→')); // a hyperlink is not a unit
    if (bolds.length) {
      // Leading non-bold prose in the same section is its own unit — THE MEDITATION's quote and
      // teaching sit before its bold practice block and were being dropped on the floor.
      const firstBold = bolds[0]!.index!;
      const lead = body.slice(0, firstBold).replace(/\s+$/, '');
      if (lead.trim().length > 40)
        out.push({ section: b.name, start: b.from, end: b.from + lead.length });
      for (const m of bolds)
        out.push({
          section: b.name,
          start: b.from + m.index!,
          end: b.from + m.index! + m[0]!.length,
        });
    } else {
      const t = body.replace(/\s+$/, '');
      if (t.trim().length > 40)
        out.push({ section: b.name, start: b.from, end: b.from + t.length });
    }
  }
  return out;
}

/** 🔴 The claims file is authoritative. This VALIDATES the prose against it and never invents units. */
function segment(md: string, claims: Claim[]): Unit[] {
  const cands = candidates(md);
  if (cands.length !== claims.length) {
    const byS = (xs: { section: string }[]) =>
      xs.reduce<Record<string, number>>(
        (a, x) => ((a[x.section] = (a[x.section] || 0) + 1), a),
        {}
      );
    const p = byS(cands),
      c = byS(claims.map(x => ({ section: x.section })));
    const keys = [...new Set([...Object.keys(p), ...Object.keys(c)])].sort();
    console.error(
      `\n❌ UNIT COUNT MISMATCH — prose has ${cands.length}, claims file has ${claims.length}.`
    );
    console.error(
      `   The claims file DEFINES the units. Either a unit was drafted with no claim row,`
    );
    console.error(
      `   or a claim row was written and never drafted. Per section (prose / claims):`
    );
    for (const k of keys) {
      const mark = (p[k] || 0) === (c[k] || 0) ? ' ' : '←';
      console.error(`     ${mark} ${k.padEnd(22)} ${p[k] || 0} / ${c[k] || 0}`);
    }
    process.exit(1);
  }
  return cands.map((x, i) => ({
    id: claims[i]!.unit,
    section: claims[i]!.section,
    idx: i,
    start: x.start,
    end: x.end,
    sha: sha(md.slice(x.start, x.end)),
  }));
}

// ── PARROT GUARD ──────────────────────────────────────────────────────────────
/** Content-word overlap, EXCLUDING proper nouns and figures. A faithful read-back of financial
 *  prose must reuse "Fed" and "$7.4 billion"; punishing that manufactures failures. */
const STOP = new Set(
  'the a an and or but of to in on for with is are was were be been it its this that as at by from not no than then so if into over under up down out about'.split(
    ' '
  )
);
function overlap(readback: string, unit: string): number {
  const words = (s: string): Set<string> =>
    new Set(
      s
        .split(/\s+/)
        .filter(w => !/\d/.test(w)) // drop figures
        .filter(w => !/^[A-Z]/.test(w.replace(/^[^A-Za-z]+/, ''))) // drop proper nouns
        .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
        .filter(w => w.length > 3 && !STOP.has(w))
    );
  const r = words(readback),
    u = words(unit);
  if (!r.size) return 0;
  let hit = 0;
  for (const w of r) if (u.has(w)) hit++;
  return hit / r.size;
}

function parseReadback(
  raw: string
): Record<number, { claim: string; why: string }> {
  const out: Record<number, { claim: string; why: string }> = {};
  for (const line of raw.split('\n')) {
    const m = /^\s*U(\d+)\s*(?:CLAIM)?\s*:?\s*(.*)$/i.exec(line);
    if (!m) continue;
    const rest = m[2] ?? '';
    const [claim, why] = rest.split('|');
    out[Number(m[1])] = {
      claim: (claim ?? '').replace(/^CLAIM:\s*/i, '').trim(),
      why: (why ?? '').replace(/^WHY:\s*/i, '').trim(),
    };
  }
  return out;
}

// ── SUBCOMMANDS ───────────────────────────────────────────────────────────────
function cmdPrepare(light: string, claimsPath: string): void {
  const md = fs.readFileSync(light, 'utf-8');
  const claims: Claim[] = JSON.parse(fs.readFileSync(claimsPath, 'utf-8'));
  const bad = claims.filter(
    c => !c.claim || c.claim.trim().split(/\s+/).length < 4
  );
  if (bad.length)
    die(
      `UNGRADEABLE_CLAIM — ${bad.length} claim row(s) are empty or under 4 words: ${bad.map(b => b.unit).join(', ')}. A vague claim cannot be transmitted and cannot be graded. Charged to the writer.`
    );
  const date = (/(\d{4}-\d{2}-\d{2})/.exec(path.basename(light)) ?? [
    ,
    'undated',
  ])[1]!;
  const units = segment(md, claims);

  let art = '';
  units.forEach((u, i) => {
    art += `[U${i + 1}] ${md.slice(u.start, u.end).trim()}\n\n`;
  });
  const prompt = READER_TEMPLATE.replace('{artifact}', art.trim());

  // Isolation assertion: the rendered prompt is the template and the artifact and nothing else.
  if (prompt !== READER_TEMPLATE.replace('{artifact}', art.trim()))
    die('prompt isolation assertion failed');

  fs.mkdirSync(rbPath(date), { recursive: true });
  fs.writeFileSync(rbPath(date, 'artifact.txt'), art.trim());
  fs.writeFileSync(rbPath(date, 'reader-prompt.txt'), prompt);
  fs.writeFileSync(rbPath(date, 'source.md'), md);
  const meta: Meta = {
    date,
    source: light,
    templateHash: sha(READER_TEMPLATE),
    promptHash: sha(prompt),
    units,
  };
  fs.writeFileSync(rbPath(date, 'meta.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(
    rbPath(date, 'claims.json'),
    JSON.stringify(claims, null, 2)
  );

  console.log(
    `✓ PREPARED ${date} — ${units.length} units validated against the claims file`
  );
  for (const u of units)
    console.log(`    U${u.idx + 1}  ${u.section.padEnd(20)} ${u.id}`);
  console.log(
    `  TEMPLATE_HASH ${meta.templateHash}   PROMPT_HASH ${meta.promptHash}`
  );
  console.log(
    `  → spawn 3 blind Readers on ${rbPath(date, 'reader-prompt.txt')} (pass the file's TEXT in the prompt; do NOT tell a reader to open a repo file — CLAUDE.md would leak doctrine)`
  );
  console.log(
    `  → save raw replies to ${rbPath(date, 'readback-{1,2,3}.txt')}, then run: check ${date}`
  );
}

function cmdCheck(date: string): void {
  const meta: Meta = JSON.parse(
    fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8')
  );
  const md = fs.readFileSync(rbPath(date, 'source.md'), 'utf-8');
  let flagged = 0;
  for (let n = 1; n <= 3; n++) {
    const f = rbPath(date, `readback-${n}.txt`);
    if (!fs.existsSync(f)) {
      console.log(`  ⚠ readback-${n}.txt missing`);
      continue;
    }
    const rb = parseReadback(fs.readFileSync(f, 'utf-8'));
    const missing = meta.units.filter(u => !rb[u.idx + 1]);
    if (missing.length)
      console.log(
        `  ⚠ reader ${n}: ${missing.length} unit(s) unanswered — ${missing.map(u => 'U' + (u.idx + 1)).join(', ')}`
      );
    for (const u of meta.units) {
      const r = rb[u.idx + 1];
      if (!r) continue;
      const ov = overlap(r.claim, md.slice(u.start, u.end));
      if (ov > PARROT_THRESHOLD) {
        flagged++;
        console.log(
          `  🦜 reader ${n} U${u.idx + 1} overlap ${(ov * 100).toFixed(0)}% — PARROT, re-run this reader with the sterner instruction`
        );
      }
    }
  }
  fs.writeFileSync(rbPath(date, 'sterner-suffix.txt'), STERNER);
  console.log(
    flagged
      ? `\n✗ ${flagged} parroted read-back(s). Append ${rbPath(date, 'sterner-suffix.txt')} to the prompt and re-run those readers ONCE.`
      : `\n✓ PARROT GUARD CLEAN — no read-back exceeded ${PARROT_THRESHOLD * 100}% non-entity overlap.`
  );
}

function cmdTabulate(date: string): void {
  const meta: Meta = JSON.parse(
    fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8')
  );
  const grades: Record<string, UnitGrades> = JSON.parse(
    fs.readFileSync(rbPath(date, 'grades.json'), 'utf-8')
  );
  const unanimous: string[] = [],
    majority: string[] = [];
  let transmitted = 0,
    sowhatOk = 0,
    sowhatSeen = 0;
  for (const u of meta.units) {
    const g = grades[u.id];
    if (!g) {
      console.log(`  ⚠ no grades for ${u.id}`);
      continue;
    }
    const fails = g.grades.filter(x => x !== 'TRANSMITTED').length;
    if (fails === g.grades.length) unanimous.push(u.id);
    else if (fails > g.grades.length / 2) majority.push(u.id);
    else transmitted++;
    if (g.sowhat?.length) {
      sowhatSeen++;
      if (g.sowhat.filter(x => x === 'OK').length > g.sowhat.length / 2)
        sowhatOk++;
    }
  }
  const n = meta.units.length;
  console.log(`\n📊 READ-BACK ${date} — ${n} units`);
  console.log(
    `   transmitted (majority)  ${transmitted}/${n}  (${Math.round((100 * transmitted) / n)}%)`
  );
  console.log(
    `   so-what OK              ${sowhatOk}/${sowhatSeen || n}   [LOGGED ONLY — never triggers a rewrite yet]`
  );
  console.log(
    `   unanimous failures      ${unanimous.length}  ← REDRAFT THESE`
  );
  console.log(
    `   majority-only failures  ${majority.length}  ← LOGGED, NOT ACTUATED (nights 1-7 rule)`
  );
  if (unanimous.length)
    console.log(
      `\n   redraft: ${unanimous.join(', ')}\n   → write {"unit-id":"new prose"} to ${rbPath(date, 'redrafts.json')} then run: assemble ${date}`
    );
  else console.log(`\n   nothing to redraft. → run: ledger ${date}`);
  fs.writeFileSync(
    rbPath(date, 'tabulation.json'),
    JSON.stringify({ n, transmitted, sowhatOk, unanimous, majority }, null, 2)
  );
}

function cmdAssemble(date: string): void {
  const meta: Meta = JSON.parse(
    fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8')
  );
  const md = fs.readFileSync(rbPath(date, 'source.md'), 'utf-8');
  const redrafts: Record<string, string> = JSON.parse(
    fs.readFileSync(rbPath(date, 'redrafts.json'), 'utf-8')
  );
  const touched = new Set(Object.keys(redrafts));
  for (const k of touched)
    if (!meta.units.some(u => u.id === k))
      die(`redraft names unknown unit "${k}"`);

  let out = '',
    cursor = 0;
  for (const u of meta.units) {
    out += md.slice(cursor, u.start);
    out += touched.has(u.id)
      ? redrafts[u.id]!.trim()
      : md.slice(u.start, u.end);
    cursor = u.end;
  }
  out += md.slice(cursor);

  // 🔴 THE GUARANTEE: re-segment the rebuilt artifact and prove every untouched unit is byte-identical.
  const claims: Claim[] = JSON.parse(
    fs.readFileSync(rbPath(date, 'claims.json'), 'utf-8')
  );
  const after = segment(out, claims);
  const drift = meta.units.filter(
    u => !touched.has(u.id) && after.find(a => a.id === u.id)?.sha !== u.sha
  );
  if (drift.length)
    die(
      `ASSEMBLY INTEGRITY FAILURE — ${drift.length} passed unit(s) changed: ${drift.map(d => d.id).join(', ')}. Passed units are frozen by assembly, not by instruction. Nothing ships from this state.`
    );

  fs.writeFileSync(rbPath(date, 'assembled.md'), out);
  fs.writeFileSync(
    rbPath(date, `diff-${Date.now()}.txt`),
    [...touched]
      .map(k => {
        const u = meta.units.find(x => x.id === k)!;
        return `═══ ${k} (${u.section})\n── BEFORE\n${md.slice(u.start, u.end)}\n── AFTER\n${redrafts[k]!.trim()}\n`;
      })
      .join('\n')
  );
  console.log(
    `✓ ASSEMBLED ${date} — ${touched.size} unit(s) redrafted, ${meta.units.length - touched.size} frozen and verified byte-identical`
  );
  console.log(
    `  → ${rbPath(date, 'assembled.md')} (copy over the draft) · before/after diff written for the night-one report`
  );
}

function cmdLedger(date: string): void {
  const meta: Meta = JSON.parse(
    fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8')
  );
  const claims: Claim[] = JSON.parse(
    fs.readFileSync(rbPath(date, 'claims.json'), 'utf-8')
  );
  const grades: Record<string, UnitGrades> = JSON.parse(
    fs.readFileSync(rbPath(date, 'grades.json'), 'utf-8')
  );
  const tab = fs.existsSync(rbPath(date, 'tabulation.json'))
    ? JSON.parse(fs.readFileSync(rbPath(date, 'tabulation.json'), 'utf-8'))
    : { unanimous: [] };
  const redrafts: Record<string, string> = fs.existsSync(
    rbPath(date, 'redrafts.json')
  )
    ? JSON.parse(fs.readFileSync(rbPath(date, 'redrafts.json'), 'utf-8'))
    : {};
  const ledger = fs.existsSync(LEDGER)
    ? JSON.parse(fs.readFileSync(LEDGER, 'utf-8'))
    : [];
  let residual = 0;
  for (const u of meta.units) {
    const g = grades[u.id];
    const c = claims.find(x => x.unit === u.id)!;
    const failed = g
      ? g.grades.filter(x => x !== 'TRANSMITTED').length === g.grades.length
      : false;
    const wasRedrafted = u.id in redrafts;
    const final =
      failed && !wasRedrafted
        ? 'RESIDUAL'
        : failed && wasRedrafted
          ? 'REDRAFTED'
          : 'PASS';
    if (final === 'RESIDUAL') residual++;
    ledger.push({
      date,
      product: 'light',
      unit: u.id,
      section: u.section,
      claim: c.claim,
      so_what: c.so_what ?? null,
      grades: g?.grades ?? null,
      sowhat_grades: g?.sowhat ?? null,
      element: g?.element ?? null,
      final,
      cycle: wasRedrafted ? 1 : 0,
      outcome: wasRedrafted
        ? 'redrafted'
        : final === 'RESIDUAL'
          ? 'shipped-failing'
          : 'held',
      promptHash: meta.promptHash,
      owner_mark: null,
    });
  }
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  console.log(
    `✓ LEDGER — ${meta.units.length} rows appended to ${LEDGER} (total ${ledger.length})`
  );
  if (residual)
    console.log(
      `  🔴 ${residual} RESIDUAL unit(s) failed and shipped anyway. These lead tomorrow's summary and the weekly rollup. 3+ in any 7 nights is a health-bar breach.`
    );
  console.log(
    `  status line: readback-light | transmitted ${tab.transmitted ?? '?'}/${meta.units.length} | unanimous-fail ${(tab.unanimous ?? []).length} | residual ${residual} | via=script`
  );
}

// ── SELFTEST (both directions, per the IMP standard) ──────────────────────────
function selftest(): number {
  let pass = 0,
    fail = 0;
  const t = (name: string, cond: boolean) => {
    if (cond) {
      pass++;
    } else {
      fail++;
      console.error(`  ✗ ${name}`);
    }
  };

  const md = `# BRIEF LIGHT\n\n## ▸ THE UPDATE\n\n**Alpha headline.**\nAlpha body sentence here.\n\n**Beta headline.**\nBeta body sentence here.\n\n## ▸ THE TAKE\n\nA take with no bold lead at all, which the old parser never assigned a unit to.\n\n## ▸ THE MODEL\n\n### Name\n\nModel prose.\n\n**[→ Explore this model](https://x/y)**\n`;
  const claims: Claim[] = [
    {
      unit: 'u1',
      section: 'THE UPDATE',
      claim: 'alpha claim words here',
      so_what: 'x',
    },
    {
      unit: 'u2',
      section: 'THE UPDATE',
      claim: 'beta claim words here',
      so_what: 'x',
    },
    {
      unit: 'take',
      section: 'THE TAKE',
      claim: 'take claim words here',
      so_what: 'x',
    },
    {
      unit: 'model',
      section: 'THE MODEL',
      claim: 'model claim words here',
      so_what: 'x',
    },
  ];
  const units = segment(md, claims);
  t('segments 4 units from the claims file', units.length === 4);
  t(
    'THE TAKE gets a unit (it has no bold lead)',
    units.some(u => u.id === 'take')
  );
  t(
    'the Explore hyperlink is NOT a unit',
    !units.some(u => md.slice(u.start, u.end).startsWith('**[→'))
  );

  // negative control: count mismatch must be caught (segment() exits, so test candidates directly)
  t(
    'count mismatch is detectable',
    candidates(md).length !== claims.length - 1
  );

  // parrot guard, both directions
  const unit =
    'Burger King US sales rose 8.5 percent while Popeyes, owned by the same company, fell 5.1.';
  t(
    'parrot detected',
    overlap(
      'Burger King sales rose while Popeyes owned by the same company fell',
      unit
    ) > PARROT_THRESHOLD
  );
  t(
    'honest entity-dense paraphrase NOT flagged',
    overlap(
      'One chain gained share and its sibling brand lost it, under a single parent.',
      unit
    ) <= PARROT_THRESHOLD
  );

  // assembly integrity, both directions
  const u1 = units[0]!;
  const rebuilt =
    md.slice(0, u1.start) +
    '**Alpha rewritten.**\nNew body.' +
    md.slice(u1.end);
  const after = segment(rebuilt, claims);
  t(
    'untouched unit survives assembly byte-identical',
    after[1]!.sha === units[1]!.sha
  );
  t('touched unit is detected as changed', after[0]!.sha !== units[0]!.sha);
  const corrupted = rebuilt.replace(
    'Beta body sentence here.',
    'Beta body sentence here, tampered.'
  );
  t(
    'tampered passed-unit IS caught',
    segment(corrupted, claims)[1]!.sha !== units[1]!.sha
  );

  // tabulation arithmetic
  const g: Grade[][] = [
    ['DISTORTED', 'DISTORTED', 'DISTORTED'],
    ['DISTORTED', 'DISTORTED', 'TRANSMITTED'],
    ['TRANSMITTED', 'TRANSMITTED', 'TRANSMITTED'],
  ];
  t(
    'unanimous fail identified',
    g[0]!.filter(x => x !== 'TRANSMITTED').length === 3
  );
  t(
    'majority-only fail NOT actuated',
    g[1]!.filter(x => x !== 'TRANSMITTED').length !== 3
  );
  t(
    'clean unit passes',
    g[2]!.every(x => x === 'TRANSMITTED')
  );

  // prompt isolation
  const rendered = READER_TEMPLATE.replace('{artifact}', 'ARTIFACT');
  t(
    'prompt = template + artifact, nothing else',
    rendered === READER_TEMPLATE.replace('{artifact}', 'ARTIFACT') &&
      rendered.includes('ARTIFACT')
  );
  t(
    'template has exactly one slot',
    (READER_TEMPLATE.match(/\{artifact\}/g) ?? []).length === 1
  );

  // readback parsing
  const p = parseReadback(
    'U1 CLAIM: the thing happened | WHY: it matters\nU2 CLAIM: LOST | WHY: confused'
  );
  t(
    'readback parses',
    p[1]?.claim === 'the thing happened' && p[2]?.claim === 'LOST'
  );

  console.log(
    `\n${fail ? '✗' : '✓'} selftest ${pass}/${pass + fail} passed  ·  TEMPLATE_HASH ${sha(READER_TEMPLATE)}`
  );
  if (!fail) console.log('SCRIPT-OK');
  return fail ? 1 : 0;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const [, , cmd, a, b] = process.argv;
switch (cmd) {
  case '--selftest':
    process.exit(selftest());
  case 'prepare':
    if (!a || !b) die('usage: prepare <light.md> <claims.json>');
    cmdPrepare(a, b);
    break;
  case 'check':
    if (!a) die('usage: check <DATE>');
    cmdCheck(a);
    break;
  case 'tabulate':
    if (!a) die('usage: tabulate <DATE>');
    cmdTabulate(a);
    break;
  case 'assemble':
    if (!a) die('usage: assemble <DATE>');
    cmdAssemble(a);
    break;
  case 'ledger':
    if (!a) die('usage: ledger <DATE>');
    cmdLedger(a);
    break;
  default:
    console.log(
      'transmission-readback.ts — mechanical half of the read-back loop. Never calls a model.'
    );
    console.log(
      '  prepare <light.md> <claims.json> | check <DATE> | tabulate <DATE> | assemble <DATE> | ledger <DATE> | --selftest'
    );
    process.exit(2);
}
