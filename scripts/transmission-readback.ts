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
const PANEL_CALIBRATION = 'system/panel-calibration.json';
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

/** 🔴 FROZEN — THE ASSUMED-KNOWLEDGE READER (owner decree 2026-08-16, C2). ADVISORY ONLY.
 *  Joins the panel BESIDE the hurried reader; it replaces nobody. The calibrated readers ask "did
 *  the meaning arrive." The hurried reader asks "did it arrive in three minutes." This one asks a
 *  question neither can: "what did the writer assume I already knew." A unit transmits perfectly to
 *  a reader who happens to share the writer's background and is a closed door to the freshman the
 *  Clarity Standard names — and nothing in the panel could see that until now.
 *  OWN HASH, so it does not move when READER_TEMPLATE moves. Logged as `assumed_knowledge`.
 *  ACTUATES NOTHING until it reproduces owner complaints.
 *  🔴 REVISED 2026-08-16 by owner ruling 3, and the revision matters: the first version said
 *  "zero items = CLEAN". A markets brief will essentially never return zero — a nineteen-year-old
 *  does not know breakeven, free float, cost-to-mine or non-GAAP — so CLEAN was a state the product
 *  could not reach and the detector would have read as permanently failing, exactly like the
 *  consequence test on Inner Game. There is no CLEAN now. It reports a COUNT, the terms, and whether
 *  the sentence could have carried the gloss. The TREND is the signal; owner marks set the good
 *  number. Template changed, so its hash changed — declared, not silent. */
const ASSUMED_KNOWLEDGE_TEMPLATE = `You are a smart nineteen-year-old. You are curious and you read carefully, but you have no specialized background in markets, technology, policy or geopolitics, and you have not read anything else this publication has written — not the longer edition, not yesterday's, nothing.

Read the passage below. Your ONLY job is to report what each numbered item expects you to already know. You are not judging the writing and you are not grading anything.

Do TWO passes over every item. Judge each item ALONE: something named in a DIFFERENT numbered item does not count, because a reader may only ever see this one.

FIRST PASS — WHAT IT ASSUMES.
List every term of art, concept, mechanism, institution, background fact, OR compressed statement that the item USES but does not EXPLAIN in plain words in the sentence that uses it. Include anything you would have to look up to follow the claim.
A STATEMENT counts here, not just a term. The test is whether you could restate it in your own words. If the only thing you can do is repeat it back, list it — that is a sentence that sounds like it explained something and did not.
For EACH thing you list, add one word: CARRYABLE if a short plain-words gloss could have ridden inside the sentence that used it, or STANDALONE if explaining it would have needed its own sentence.

SECOND PASS — WHAT IT POINTS AT.
Read the item again looking ONLY at pointing words: it, its, they, them, their, this, that, these, those, he, she, his, her, such, the former, the latter — plus any "the <noun>" where that noun was never introduced in this item, and any "you" or "we" where it is not clear who is meant.
For each one ask: is the thing it points at NAMED somewhere inside THIS numbered item?
 · If yes, ignore it.
 · If you have to guess, or you would have to have read something else to know — report it, and say what you think it means, or UNKNOWN if you cannot guess.
Report your guess even when you are fairly confident. A guess you got right and a guess you got wrong look identical from where you sit, and the difference is the whole point of asking.

Do not list things you merely find interesting.

Output one line per item and nothing else:
U<n>: <total across both passes> | AK: <term> (CARRYABLE|STANDALONE); … | REF: "<pointing word, verbatim>" → <your best guess, or UNKNOWN>; …

Write a dash for a pass that found nothing. An item clean on both looks like:
U<n>: 0 | AK: — | REF: —

{artifact}`;

/** 🔴 FROZEN — THE HURRIED READER (added 2026-08-10, FINAL WORK ORDER item 4). ADVISORY ONLY.
 *  The success criterion is "understood in one reading by a smart reader IN A HURRY"; the three
 *  calibrated readers measure the careful half. This fourth blind reader measures the hurried half.
 *  Same isolation rules (pass the prompt TEXT; the reader opens no repo file), own frozen template,
 *  own hash, logged in the separate `hurried_read` ledger field, and NEVER counted toward
 *  actuation — finalFor() does not take it as a parameter, which is the guarantee. It earns
 *  actuation later only through the same owner-marks calibration bar as everything else.
 *  Exactly one interpolation slot: {artifact}. */
const HURRIED_TEMPLATE = `You are an educated professional — smart, busy, not a specialist in markets, technology or geopolitics — and today you are late. You have about three minutes and you will not get a second pass.

Skim the brief below ONCE, fast, the way you would scan it on your phone between meetings. Do not slow down. Do not re-read a single line.

Then, from what stuck — memory of your one pass, without studying the text again — state for each numbered item: (1) CLAIM — the one thing the item says is true, and (2) WHY — why it matters to someone like you. Use your own words; do not copy phrases from the text. If an item left nothing behind, write LOST and say what little you retain. Do not skip items.

Output one line per item and nothing else:
U<n> CLAIM: … | WHY: …

---

{artifact}`;

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
  hurriedTemplateHash?: string; // optional: absent on runs prepared before 2026-08-10
  hurriedPromptHash?: string;
  assumedKnowledgeTemplateHash?: string; // optional: absent on runs prepared before 2026-08-16
  assumedKnowledgePromptHash?: string;
};
type HurriedGrade = { grade: Grade; sowhat?: string };
type Grade = 'TRANSMITTED' | 'DISTORTED' | 'LOST';
type UnitGrades = { grades: Grade[]; sowhat?: string[]; element?: string };

const sha = (s: string): string =>
  crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const die = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};
/** 🔴 The light brief and the full brief share a BRIEF_DATE. Before this suffix they also shared
 *  `.readback/<date>/meta.json`, so the full-brief loop's first night would have silently overwritten
 *  the light's graded state for the same date. `--product=full` routes to `.readback/<date>-full/`.
 *  Default is unsuffixed, so every directory already on disk keeps working. */
let PRODUCT_SUFFIX = '';
const rbPath = (date: string, ...p: string[]): string =>
  path.join(RB_DIR, date + PRODUCT_SUFFIX, ...p);

// ── SEGMENTATION ──────────────────────────────────────────────────────────────
/** Split the artifact into candidate units. A unit is a bold-led block, OR — when a `## ▸` section
 *  contains no bold-led block — that section's whole body. The Explore-model hyperlink is never a
 *  unit. Returns [{section, start, end}] in document order. */
/** 🔴 PART 2 (2026-08-19) — THE FULL BRIEF IS A DIFFERENT SHAPE AND THE OLD SEGMENTER WAS BLIND TO IT.
 *  Measured before building: `prepare content/daily-updates/2026-08-19.md ... --product=full` returned
 *  **prose 19 / claims 24**, collapsing every Six section to ONE unit and returning ZERO for Discovery,
 *  Inner Game and the Dashboard. The light brief is `## ▸ SECTION` + bold-led blocks; the full brief is
 *  `# ▸ MAJOR` with `## Subsection` and `- **bold**` LIST ITEMS. A segmenter that returns the wrong
 *  units is not a pass, and one that returns zero is a finding.
 *
 *  THE CLAIMS SIDECAR REMAINS AUTHORITATIVE (rule 1). This does not invent units — it teaches the
 *  parser the full brief's shape so it can REPRODUCE the sidecar, including the Dashboard rows the
 *  sidecar counts and the `## ▸ OVERNIGHT` block it does not.
 *
 *  MATCHING IS BY SECTION LABEL, NOT POSITION, for the full brief: the sidecar lists `intro` LAST
 *  while it appears FIRST in the document, and positional pairing would have silently attached every
 *  id to the wrong prose — a corruption that passes a count check. */
const normLabel = (x: string): string =>
  x.trim().toUpperCase().replace(/\s+/g, ' ');

function candidatesFull(
  md: string
): { section: string; start: number; end: number }[] {
  const out: { section: string; start: number; end: number }[] = [];
  const push = (section: string, start: number, end: number) => {
    const t = md.slice(start, end).replace(/\s+$/, '');
    if (t.trim().length > 40)
      out.push({ section, start, end: start + t.length });
  };
  const majors = [...md.matchAll(/^#\s*▸\s*(.+)$/gm)];
  // 1. the payoff intro: the `### …` block before the first major
  if (majors.length) {
    const pre = md.slice(0, majors[0]!.index!);
    const m = pre.match(/^###\s+.+$/m);
    if (m)
      push('Intro Summary (payoff)', pre.indexOf(m[0]!), majors[0]!.index!);
  }
  for (let i = 0; i < majors.length; i++) {
    const name = majors[i]!['1']!.trim();
    const from = majors[i]!.index! + majors[i]![0]!.length;
    const to = i + 1 < majors.length ? majors[i + 1]!.index! : md.length;
    const body = md.slice(from, to);
    const N = normLabel(name);
    if (N === 'THE DASHBOARD') {
      const subs = [...body.matchAll(/^###\s+(.+)$/gm)];
      subs.forEach((sm, k) =>
        push(
          `Dashboard/${sm[1]!.trim()}`,
          from + sm.index! + sm[0]!.length,
          from + (k + 1 < subs.length ? subs[k + 1]!.index! : body.length)
        )
      );
    } else if (N === 'THE SIX') {
      const subs = [...body.matchAll(/^##(?!#)\s*(.+)$/gm)];
      subs.forEach((sm, k) => {
        const sname = sm[1]!.trim();
        const sf = sm.index! + sm[0]!.length;
        const st = k + 1 < subs.length ? subs[k + 1]!.index! : body.length;
        const sbody = body.slice(sf, st);
        const isSignal = /signal/i.test(sname);
        const raws = isSignal
          ? [
              ...sbody.matchAll(
                /^\*\*[\s\S]*?(?=\n\s*\n\*\*(?!Watch:)|\n\s*\n#|(?![\s\S]))/gm
              ),
            ]
          : [
              ...sbody.matchAll(
                /^-\s+[\s\S]*?(?=\n\s*\n-\s|\n\s*\n#|\n##|(?![\s\S]))/gm
              ),
            ];
        for (const it of raws.filter(x => !/^\*\*Watch:/i.test(x[0]!)))
          push(
            sname,
            from + sf + it.index!,
            from + sf + it.index! + it[0]!.length
          );
      });
    } else if (N === 'OVERNIGHT') {
      continue; // present in the artifact, absent from the sidecar — excluded by contract
    } else {
      push(name, from, to);
    }
  }
  return out;
}

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
function segment(md: string, claims: Claim[], product = ''): Unit[] {
  const full = product === 'full';
  const cands = full ? candidatesFull(md) : candidates(md);
  // 🔴 FULL BRIEF: pair by SECTION LABEL in document order, never by position.
  if (full && cands.length === claims.length) {
    const pool = cands.map(c => ({ ...c, used: false }));
    const paired: Unit[] = [];
    for (let i = 0; i < claims.length; i++) {
      const want = normLabel(claims[i]!.section);
      const hit = pool.find(c => !c.used && normLabel(c.section) === want);
      if (!hit) {
        console.error(
          `\n❌ SECTION LABEL MISMATCH — claim "${claims[i]!.unit}" wants section "${claims[i]!.section}" and no unpaired prose block carries it.`
        );
        console.error(
          `   Prose labels seen: ${[...new Set(cands.map(c => c.section))].join(' · ')}`
        );
        process.exit(1);
      }
      hit.used = true;
      paired.push({
        id: claims[i]!.unit,
        section: claims[i]!.section,
        idx: i,
        start: hit.start,
        end: hit.end,
        sha: sha(md.slice(hit.start, hit.end)),
      });
    }
    return paired;
  }
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
  const units = segment(md, claims, PRODUCT_SUFFIX.replace('-', ''));

  let art = '';
  units.forEach((u, i) => {
    art += `[U${i + 1}] ${md.slice(u.start, u.end).trim()}\n\n`;
  });
  const prompt = READER_TEMPLATE.replace('{artifact}', art.trim());

  // Isolation assertion: the rendered prompt is the template and the artifact and nothing else.
  if (prompt !== READER_TEMPLATE.replace('{artifact}', art.trim()))
    die('prompt isolation assertion failed');

  const hurriedPrompt = HURRIED_TEMPLATE.replace('{artifact}', art.trim());
  const akPrompt = ASSUMED_KNOWLEDGE_TEMPLATE.replace('{artifact}', art.trim());

  fs.mkdirSync(rbPath(date), { recursive: true });
  fs.writeFileSync(rbPath(date, 'artifact.txt'), art.trim());
  fs.writeFileSync(rbPath(date, 'reader-prompt.txt'), prompt);
  fs.writeFileSync(rbPath(date, 'hurried-prompt.txt'), hurriedPrompt);
  fs.writeFileSync(rbPath(date, 'assumed-knowledge-prompt.txt'), akPrompt);
  fs.writeFileSync(rbPath(date, 'source.md'), md);
  const meta: Meta = {
    date,
    source: light,
    templateHash: sha(READER_TEMPLATE),
    promptHash: sha(prompt),
    units,
    hurriedTemplateHash: sha(HURRIED_TEMPLATE),
    hurriedPromptHash: sha(hurriedPrompt),
    assumedKnowledgeTemplateHash: sha(ASSUMED_KNOWLEDGE_TEMPLATE),
    assumedKnowledgePromptHash: sha(akPrompt),
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
  console.log(
    `  → ALSO spawn 1 HURRIED Reader [ADVISORY — never counted toward actuation] on ${rbPath(date, 'hurried-prompt.txt')} (same isolation: pass the file's TEXT); save its reply to ${rbPath(date, 'readback-hurried.txt')}; grade it to ${rbPath(date, 'hurried-grades.json')} as {"<unit-id>":{"grade":"TRANSMITTED|DISTORTED|LOST","sowhat":"OK|MISSING|WRONG"}}`
  );
  console.log(
    `  → ALSO spawn 1 FRESHMAN (assumed-knowledge) Reader — 🔴 EVERY NIGHT, NOT OPTIONAL, on BOTH surfaces [ADVISORY — C2, actuates nothing] on ${rbPath(date, 'assumed-knowledge-prompt.txt')} (same isolation: pass the file's TEXT); save its reply to ${rbPath(date, 'readback-assumed-knowledge.txt')}; it returns TWO PASSES PER UNIT — assumed knowledge and dangling REFERENTS — never a grade`
  );
  console.log(
    `  → then: check ${date}  (prints the PANEL ROSTER)  ·  panel ${date}  (roster alone, exit 1 on a RED-LEG)  ·  akcheck ${date}  (calibration)`
  );
  console.log(
    `  🔴 SKIPPING A LEG IS NOT SILENT ANY MORE. The roster enumerates readers/hurried/freshman every night and prints RED-LEG for any that did not run. The hurried reader skipped 2026-08-17 and nobody knew for three days; the full brief's loop never ran at all for eight weeks.`
  );
  console.log(`  HURRIED_HASH ${meta.hurriedTemplateHash}`);
  console.log(
    `  ASSUMED_KNOWLEDGE_HASH ${meta.assumedKnowledgeTemplateHash}   [C2 · advisory · actuates nothing]`
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
  // ── HURRIED READER (ADVISORY LANE — kept out of `flagged` so it can never drive actuation) ──
  const hf = rbPath(date, 'readback-hurried.txt');
  if (fs.existsSync(hf)) {
    const rb = parseReadback(fs.readFileSync(hf, 'utf-8'));
    const missing = meta.units.filter(u => !rb[u.idx + 1]);
    if (missing.length)
      console.log(
        `  ⚠ hurried reader: ${missing.length} unit(s) unanswered — ${missing.map(u => 'U' + (u.idx + 1)).join(', ')}`
      );
    let hFlag = 0;
    for (const u of meta.units) {
      const r = rb[u.idx + 1];
      if (!r) continue;
      const ov = overlap(r.claim, md.slice(u.start, u.end));
      if (ov > PARROT_THRESHOLD) {
        hFlag++;
        console.log(
          `  🦜 hurried U${u.idx + 1} overlap ${(ov * 100).toFixed(0)}% — PARROT [advisory lane; re-run the hurried reader with the sterner suffix, still advisory]`
        );
      }
    }
    console.log(
      `  ✓ hurried read-back present [ADVISORY — never counted toward actuation]${hFlag ? ` · ${hFlag} parrot flag(s)` : ''}`
    );
  } else {
    console.log(
      `  ○ hurried read-back absent (${hf}) — advisory lane not run this night [see the PANEL roster below; absence is a RED-LEG there]`
    );
  }

  fs.writeFileSync(rbPath(date, 'sterner-suffix.txt'), STERNER);
  console.log(
    flagged
      ? `\n✗ ${flagged} parroted read-back(s). Append ${rbPath(date, 'sterner-suffix.txt')} to the prompt and re-run those readers ONCE.`
      : `\n✓ PARROT GUARD CLEAN — no read-back exceeded ${PARROT_THRESHOLD * 100}% non-entity overlap.`
  );

  // 🔴 THE ROSTER RIDES THE COMMAND THE NIGHTLY ALREADY RUNS. No task-body edit, no install —
  // the same channel that shipped the hurried and freshman readers. `check` PRINTS it; the
  // standalone `panel` command EXITS 1 on a RED-LEG, which is the half that can stop a caller.
  // `check` deliberately does NOT take that exit code: it is the parrot guard, and a red leg
  // must not be able to abort the loop mid-night.
  console.log('');
  printPanel(date);
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
  const hgPath = rbPath(date, 'hurried-grades.json');
  if (fs.existsSync(hgPath)) {
    const hg: Record<string, HurriedGrade> = JSON.parse(
      fs.readFileSync(hgPath, 'utf-8')
    );
    let ht = 0,
      hn = 0;
    for (const u of meta.units) {
      const h = hg[u.id];
      if (!h) continue;
      hn++;
      if (h.grade === 'TRANSMITTED') ht++;
    }
    console.log(
      `   hurried transmitted     ${ht}/${hn}   [ADVISORY — single replica, NEVER actuates, excluded from every number above]`
    );
  }
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
  const after = segment(out, claims, PRODUCT_SUFFIX.replace('-', ''));
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

/** 🔴 ACTUATION ARITHMETIC — takes ONLY the three calibrated grades and the redraft flag. The
 *  hurried read is not a parameter of this function, which is the structural guarantee that it can
 *  never reach actuation. Do not add it. */
function finalFor(
  g: UnitGrades | undefined,
  wasRedrafted: boolean
): 'PASS' | 'RESIDUAL' | 'REDRAFTED' {
  const failed = g
    ? g.grades.filter(x => x !== 'TRANSMITTED').length === g.grades.length
    : false;
  return failed && !wasRedrafted
    ? 'RESIDUAL'
    : failed && wasRedrafted
      ? 'REDRAFTED'
      : 'PASS';
}

/** Attaches the advisory hurried read AFTER final is computed. Mutates nothing else. */
function attachHurried<T extends Record<string, unknown>>(
  row: T,
  hg: HurriedGrade | undefined
): T & { hurried_read: HurriedGrade | null } {
  return Object.assign(row, { hurried_read: hg ?? null });
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
  const hurried: Record<string, HurriedGrade> = fs.existsSync(
    rbPath(date, 'hurried-grades.json')
  )
    ? JSON.parse(fs.readFileSync(rbPath(date, 'hurried-grades.json'), 'utf-8'))
    : {};
  const ledger = fs.existsSync(LEDGER)
    ? JSON.parse(fs.readFileSync(LEDGER, 'utf-8'))
    : [];
  let residual = 0;
  for (const u of meta.units) {
    const g = grades[u.id];
    const c = claims.find(x => x.unit === u.id)!;
    const wasRedrafted = u.id in redrafts;
    const final = finalFor(g, wasRedrafted);
    if (final === 'RESIDUAL') residual++;
    ledger.push(
      attachHurried(
        {
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
        },
        hurried[u.id]
      )
    );
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

// ── MORNING JURISDICTION ──────────────────────────────────────────────────────
/** Pure half, so the selftest can exercise it without touching disk. Compares the graded units
 *  against the same units re-segmented out of a later artifact. Identity is the unit id; the
 *  verdict is the sha. */
function dirtyUnits(
  graded: Unit[],
  md: string,
  claims: Claim[]
): { id: string; section: string; before: string; after: string }[] {
  const now = segment(md, claims, PRODUCT_SUFFIX.replace('-', ''));
  return graded
    .filter(u => now.find(a => a.id === u.id)?.sha !== u.sha)
    .map(u => ({
      id: u.id,
      section: u.section,
      before: u.sha,
      after: now.find(a => a.id === u.id)?.sha ?? 'MISSING',
    }));
}

/** 🔴 LAW 1 — ANY PASS WITH REWRITE AUTHORITY SITS INSIDE THE LOOP'S JURISDICTION
 *  (WORK_ORDER_READBACK.md, PART 12.8). The Morning Truth Gate rewrites the PUBLISHED artifact at
 *  05:06, hours after every check has run, and nothing re-read what it changed. Receipt: on
 *  2026-08-08 it rewrote three graded units — lede, update-2, line-3 — and line-3's TRANSMITTED 3/3
 *  was awarded to a sentence that no longer existed. Their grades were invalidated BY HAND, which is
 *  the same as not at all.
 *
 *  WARN-ONLY BY CONTRACT. It never blocks a publish. Exit 1 means "units changed", not "stop". */
function cmdDirty(date: string, publishedPath: string, mark: boolean): number {
  const metaPath = rbPath(date, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    console.log(
      `MORNING-DIRTY ${date} — 0/0 · no read-back state at ${metaPath}; nothing was graded for this date, so nothing can be stale. Not a pass, an absence.`
    );
    return 0;
  }
  if (!fs.existsSync(publishedPath)) {
    console.log(
      `MORNING-DIRTY ${date} — 0/0 · published artifact not found at ${publishedPath}. Nothing compared.`
    );
    return 0;
  }
  const meta: Meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const claims: Claim[] = JSON.parse(
    fs.readFileSync(rbPath(date, 'claims.json'), 'utf-8')
  );
  const md = fs.readFileSync(publishedPath, 'utf-8');

  // A changed unit COUNT is a bigger finding than a changed unit, and segment() would die on it.
  const cands = candidates(md);
  if (cands.length !== claims.length) {
    console.log(
      `⚠ MORNING-DIRTY ${date} — UNIT COUNT CHANGED: published has ${cands.length}, graded had ${claims.length}. A unit was added or removed after grading; positional comparison abandoned. EVERY grade for this date is suspect.`
    );
    fs.writeFileSync(
      rbPath(date, 'morning-dirty.json'),
      JSON.stringify(
        {
          date,
          source: publishedPath,
          graded_units: claims.length,
          published_units: cands.length,
          verdict: 'UNIT_COUNT_CHANGED',
          dirty: null,
        },
        null,
        2
      )
    );
    return 1;
  }

  // 🔴 THE BASELINE IS WHAT THE LOOP BLESSED, NOT WHAT IT FIRST SAW. meta.units is hashed at
  // prepare time, BEFORE any redraft. Comparing against it reports every redrafted unit as a
  // morning change — which is false, since a redraft is re-read inside the loop. When the loop
  // assembled, `assembled.md` is the graded artifact and it is the baseline. Caught by running the
  // 2026-08-08 receipt: source-baseline said 6 changed, three of which were the loop's own work.
  const assembledPath = rbPath(date, 'assembled.md');
  const usedAssembled = fs.existsSync(assembledPath);
  const baseline = usedAssembled
    ? segment(
        fs.readFileSync(assembledPath, 'utf-8'),
        claims,
        PRODUCT_SUFFIX.replace('-', '')
      )
    : meta.units;
  const changed = dirtyUnits(baseline, md, claims);
  console.log(
    `MORNING-DIRTY ${date} — ${changed.length}/${baseline.length} unit(s) changed since grading  ·  baseline=${usedAssembled ? 'assembled' : 'source'}`
  );
  for (const c of changed)
    console.log(`  · ${c.id}  (${c.section})   ${c.before} → ${c.after}`);
  if (!changed.length)
    console.log(
      `  every graded unit is byte-identical to what shipped. Graded bytes = shipped bytes.`
    );

  fs.writeFileSync(
    rbPath(date, 'morning-dirty.json'),
    JSON.stringify(
      {
        date,
        source: publishedPath,
        graded_units: baseline.length,
        published_units: cands.length,
        baseline: usedAssembled ? 'assembled' : 'source',
        verdict: changed.length ? 'DIRTY' : 'CLEAN',
        dirty: changed,
      },
      null,
      2
    )
  );

  if (mark && changed.length && fs.existsSync(LEDGER)) {
    const product = publishedPath.includes('/weekly/')
      ? 'weekly'
      : publishedPath.endsWith('-light.md')
        ? 'light'
        : 'full';
    const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf-8'));
    const ids = new Set(changed.map(c => c.id));
    let n = 0;
    for (const r of ledger) {
      // 🔴 ONLY GRADE ROWS. The ledger also holds owner-mark rows and notes under the same
      // (date, product, unit) key — the owner's verbatim mark is ground truth and no later edit
      // invalidates it. Caught by the denominator: an early run stamped 8 rows for 6 units.
      if (r.date !== date || r.product !== product || !ids.has(r.unit))
        continue;
      if (!r.grades) continue;
      r.GRADE_INVALIDATED = true;
      // never overwrite a reason a human wrote — the ledger is append-only in spirit
      if (!r.invalidation_reason)
        r.invalidation_reason = `A pass with rewrite authority changed this unit after the read-back graded it (source ${publishedPath}). Grade belongs to bytes that no longer ship.`;
      n++;
    }
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    console.log(
      `  ✓ ${n}/${changed.length} changed unit(s) stamped GRADE_INVALIDATED in ${LEDGER} (product=${product})`
    );
  }
  return changed.length ? 1 : 0;
}

/** 🔴 ITEM 9 (2026-08-17) — THE ASSUMED-KNOWLEDGE READER'S CALIBRATION CHECK. Mechanical half only:
 *  it never runs the detector, it AUDITS the detector's returned lines against known-positive seeds
 *  taken from the owner's own marks. A detector with no known positives cannot fail, and a detector
 *  that cannot fail is not an instrument. Seeds live in system/panel-calibration.json.
 *  Usage: akcheck <DATE>  — reads .readback/<DATE>/readback-assumed-knowledge.txt */
/** Slice one pass out of a v3 assumed-knowledge line.
 *  v3 lines are `U<n>: <count> | AK: … | REF: …`; v2 lines are `U<n>: <count> | …` with no
 *  labels at all. A seed with no `segment` matches the WHOLE line, which is what keeps the three
 *  2026-08-17 seeds working unchanged across the template change — and is also why a seed that
 *  MUST come from one pass has to say so: without a segment, an `x402` flagged as a referent
 *  would satisfy a seed that exists to prove the vocabulary pass fires. */
export function isLabelled(body: string): boolean {
  return /\b(AK|REF)\s*:/i.test(body);
}

/** Slice one pass out of an assumed-knowledge line.
 *  Returns `null` when the caller asked for a pass and the line HAS NO PASSES — i.e. a v2
 *  transcript, written before the referent pass existed.
 *
 *  🔴 WHY null AND NOT ''. The first version returned '' there, and it was wrong in the way that
 *  matters most: the two CONTROL seeds (x402, USDC) are present and correct in the real 08-19 v2
 *  transcript, and they read MISSED — a format mismatch reported as a detection failure. That
 *  output cannot distinguish "the detector is broken" from "the transcript predates the pass",
 *  which are opposite findings, and it would have made every historical night look like a failing
 *  detector. Three states exist, so three states are reported. Blending them into one number is
 *  the thing this system does not do. */
export function akSegment(body: string, segment?: string): string | null {
  if (!segment) return body;
  const S = segment.toUpperCase();
  if (S !== 'AK' && S !== 'REF') return body;
  if (!isLabelled(body)) return null; // pre-v3 line: not a miss, not a hit — N/A
  const m = body.match(new RegExp(`\\b${S}\\s*:(.*?)(?=\\|\\s*(?:AK|REF)\\s*:|$)`, 'i'));
  return m ? m[1]! : '';
}

export function akAudit(
  transcript: string,
  seeds: { unit: string; term: string; match: string; segment?: string }[],
  unitIds: string[]
): { seed: string; unit: string; found: boolean; applicable: boolean; segment?: string }[] {
  // v2 lines:  U<n>: <count> | <term> (CARRYABLE); …
  // v3 lines:  U<n>: <count> | AK: <term> (CARRYABLE); … | REF: "<word>" → <guess>; …
  const byIdx: Record<number, string> = {};
  for (const line of transcript.split('\n')) {
    const m = line.match(/^\s*U(\d+)\s*:\s*(.*)$/);
    if (m) byIdx[Number(m[1])] = m[2]!;
  }
  return seeds.map(sd => {
    const i = unitIds.indexOf(sd.unit);
    const body = i >= 0 ? akSegment(byIdx[i + 1] ?? '', sd.segment) : '';
    return {
      seed: sd.term,
      unit: sd.unit,
      segment: sd.segment,
      // null = the transcript has no passes to slice; the seed is N/A, not missed.
      applicable: i >= 0 && body !== null,
      // 'i' is applied here, not embedded: an inline (?i) is Python syntax and throws in JS.
      found: i >= 0 && body !== null && new RegExp(sd.match, 'i').test(body),
    };
  });
}

function cmdAkCheck(date: string): number {
  if (!fs.existsSync(PANEL_CALIBRATION))
    die(
      `${PANEL_CALIBRATION} is missing — the detector has no known positives and therefore cannot fail.`
    );
  const cal = JSON.parse(fs.readFileSync(PANEL_CALIBRATION, 'utf-8'));
  const seeds = (cal.assumed_knowledge?.seeds ?? []).filter(
    (x: { date: string }) => x.date === date
  );
  const tPath = rbPath(date, 'readback-assumed-knowledge.txt');
  if (!seeds.length) {
    console.log(
      `AK-CALIBRATION ${date} — 0/0 seeds for this date. Nothing asserted; this is an absence, not a pass.`
    );
    return 0;
  }
  if (!fs.existsSync(tPath)) {
    console.log(
      `AK-CALIBRATION ${date} — 0/${seeds.length} · no detector output at ${tPath}. The reader has not run. Absence, not a pass.`
    );
    // 🔴 EXIT 1, changed 2026-08-20. This branch used to return 0: seeds asserted, reader absent,
    // and the command reported success. That is the exact shape of the failure this whole order
    // exists to close — a leg that did not run reading as health. Prose said "absence, not a pass"
    // while the exit code said pass, and the exit code is the half a caller can act on.
    return 1;
  }
  const meta: Meta = JSON.parse(
    fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8')
  );
  const res = akAudit(
    fs.readFileSync(tPath, 'utf-8'),
    seeds,
    meta.units.map(u => u.id)
  );
  const asserted = res.filter(r => r.applicable);
  const na = res.filter(r => !r.applicable);
  const hit = asserted.filter(r => r.found).length;
  console.log(
    `AK-CALIBRATION ${date} — ${hit}/${asserted.length} seed(s) flagged` +
      (na.length
        ? `  ·  ${na.length} N/A (transcript predates the pass that seed asserts — NOT counted either way)`
        : '')
  );
  for (const r of res) {
    const seg = r.segment ? ` [${r.segment}]` : '';
    if (!r.applicable) console.log(`  ·  N/A   ${r.unit}${seg}  ${r.seed}`);
    else console.log(`  ${r.found ? '✓     ' : '✗ MISS'}  ${r.unit}${seg}  ${r.seed}`);
  }
  if (na.length)
    console.log(
      `  ⓘ  ${na.length} seed(s) assert a pass this transcript does not contain. Re-run akcheck on the first night the v3 reader runs; until then they are unmeasured, which is not the same as passing and not the same as failing.`
    );
  if (!asserted.length) {
    console.log(
      '  🔴 ZERO SEEDS MEASURABLE. Nothing was asserted about this transcript, so nothing was proved. This is an absence with its denominator printed, not a pass.'
    );
    return 1;
  }
  if (hit < asserted.length)
    console.log(
      '  🔴 CALIBRATION FAILS. A seed is an owner receipt: a term a real reader actually bounced off. Missing one means the detector does not yet see what he sees.'
    );
  return hit === asserted.length ? 0 : 1;
}

/** 🔴 THE PANEL ROSTER — THE CONSUMER (2026-08-20, FRESHMAN READER order item 2).
 *
 *  THE LESSON THIS IS BUILT FROM, stated so it is not re-learned a third time: the full brief's
 *  read-back was broken for eight weeks and the hurried reader silently skipped 2026-08-17, and
 *  BOTH survived because NOTHING CONSUMED THE COUNT. A leg that does not run produces no file,
 *  no error and no line — and absence reads exactly like health.
 *
 *  So the roster is a FIXED ENUMERATION, never derived from what happens to be on disk. Every leg
 *  named here prints a row every night whether it ran or not. A missing leg is a RED-LEG, which is
 *  a claim with a denominator; it is never silence.
 *
 *  EXIT CODE: 1 if any RED-LEG. That makes this an instrument rather than decoration — a check
 *  that only prints cannot stop the next command. 🔴 BUT IT FAILS THE PANEL CLAIM, NEVER THE
 *  BRIEF. THE BRIEF ALWAYS SHIPS. Nothing here may be wired into a publish gate.
 */
const PANEL_LEGS = [
  { key: 'readers', files: ['readback-1.txt', 'readback-2.txt', 'readback-3.txt'], label: 'readers ', advisory: false },
  { key: 'hurried', files: ['readback-hurried.txt'], label: 'hurried ', advisory: true },
  { key: 'ak', files: ['readback-assumed-knowledge.txt'], label: 'ak (freshman)', advisory: true },
] as const;

/** Counts DISTINCT answered units in any panel transcript.
 *  Two shapes in play: the readers and the hurried reader emit `U<n> CLAIM: …`, the freshman
 *  reader emits `U<n>: …`. Both are covered; the colon is REQUIRED.
 *  🔴 The colon is not pedantry. A looser match (`U\d+` anywhere at line start) would count a
 *  reader's prose aside as an answered unit, and an over-count turns a SHORT leg into a GREEN one
 *  — a counter that errs toward permission, which is the defect logged against the Thesis_Tracker
 *  rotation counter on 2026-08-19. Under-counting shows up as SHORT and gets looked at; the error
 *  is deliberately pointed at the alarm. */
export function countUnitLines(text: string): number {
  const seen = new Set<number>();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*U(\d+)\s*(?:CLAIM)?\s*:/i);
    if (m) seen.add(Number(m[1]));
  }
  return seen.size;
}

export type LegRow = {
  leg: string;
  counts: number[]; // one per expected file; -1 means the file is absent
  expected: number;
  state: 'GREEN' | 'SHORT' | 'RED-LEG';
  note: string;
};

export function legState(counts: number[], expected: number): { state: LegRow['state']; note: string } {
  if (counts.every(c => c < 0))
    return { state: 'RED-LEG', note: 'transcript absent — the leg did not run' };
  if (counts.some(c => c < 0))
    return { state: 'RED-LEG', note: `${counts.filter(c => c < 0).length} of ${counts.length} transcript(s) absent` };
  if (counts.some(c => c === 0))
    return { state: 'RED-LEG', note: 'transcript present but zero units parsed — the leg produced nothing readable' };
  if (counts.some(c => c > expected))
    return { state: 'RED-LEG', note: `answered MORE units than exist (${Math.max(...counts)} > ${expected}) — parse or isolation failure` };
  if (counts.some(c => c < expected))
    return { state: 'SHORT', note: `${Math.min(...counts)}/${expected} units answered — a partial pass is a hole, not a pass` };
  return { state: 'GREEN', note: '' };
}

export function surfaceRoster(
  dirExists: boolean,
  units: number,
  read: (f: string) => string | null
): { prepared: boolean; units: number; legs: LegRow[] } {
  if (!dirExists) return { prepared: false, units: 0, legs: [] };
  const legs: LegRow[] = PANEL_LEGS.map(L => {
    const counts = L.files.map(f => {
      const t = read(f);
      return t === null ? -1 : countUnitLines(t);
    });
    const { state, note } = legState(counts, units);
    return { leg: L.key, counts, expected: units, state, note };
  });
  return { prepared: true, units, legs };
}

/** Prints the roster for both surfaces of one date. Returns the RED-LEG count. */
function printPanel(date: string): number {
  let red = 0;
  console.log(`PANEL ${date} — every leg prints, run or not. Absence is a RED-LEG, never a blank.`);
  for (const [suffix, surface] of [['', 'light'], ['-full', 'full ']] as const) {
    const dir = `${RB_DIR}/${date}${suffix}`;
    const metaPath = `${dir}/meta.json`;
    if (!fs.existsSync(metaPath)) {
      if (surface.trim() === 'light') {
        red++;
        console.log(`  ${surface}  🔴 RED-LEG — NOT PREPARED. The light loop is standing; a night with no ${dir}/meta.json is a night the loop did not run at all.`);
      } else {
        console.log(`  ${surface}  ·  NOT PREPARED — full-brief loop not activated for this date (editor install gates it). Printed, not hidden: this is the state, and it turns RED the moment ${dir} exists.`);
      }
      continue;
    }
    const meta: Meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const r = surfaceRoster(true, meta.units.length, f =>
      fs.existsSync(`${dir}/${f}`) ? fs.readFileSync(`${dir}/${f}`, 'utf-8') : null
    );
    console.log(`  ${surface}  ${dir}  ·  ${r.units} units prepared`);
    for (const L of r.legs) {
      const shown = L.counts.map(c => (c < 0 ? '—' : String(c)));
      const tally = L.counts.length > 1 ? `${L.counts.length}×[${shown.join(',')}]` : shown[0]!;
      const icon = L.state === 'GREEN' ? '✓' : L.state === 'SHORT' ? '🟡 SHORT ' : '🔴 RED-LEG ';
      if (L.state === 'RED-LEG') red++;
      const leg = PANEL_LEGS.find(x => x.key === L.leg)!;
      console.log(
        `      ${leg.label.padEnd(14)} ${String(tally).padStart(12)} / ${String(r.units).padEnd(3)} ${icon}${L.note}`
      );
    }
  }
  // Calibration rides the same command. An akcheck nobody runs is the pathology this file exists
  // to close, one level up.
  if (fs.existsSync(PANEL_CALIBRATION)) {
    const cal = JSON.parse(fs.readFileSync(PANEL_CALIBRATION, 'utf-8'));
    const seeds = (cal.assumed_knowledge?.seeds ?? []).filter(
      (x: { date: string }) => x.date === date
    );
    if (!seeds.length) {
      console.log(`  calibration  ·  0 seeds registered for ${date} — nothing asserted, which is an absence, not a pass`);
    } else {
      const tPath = rbPath(date, 'readback-assumed-knowledge.txt');
      if (!fs.existsSync(tPath)) {
        red++;
        console.log(`  calibration  🔴 RED-LEG — ${seeds.length} seed(s) registered and no freshman transcript to audit`);
      } else {
        const meta: Meta = JSON.parse(fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8'));
        const res = akAudit(fs.readFileSync(tPath, 'utf-8'), seeds, meta.units.map(u => u.id));
        const app = res.filter(r => r.applicable);
        const hit = app.filter(r => r.found).length;
        console.log(
          `  calibration  ·  ${hit}/${app.length} seed(s) flagged` +
            (res.length - app.length ? `  ·  ${res.length - app.length} N/A (transcript predates the pass asserted)` : '') +
            `   → akcheck ${date} for the breakdown`
        );
      }
    }
  }
  console.log(
    red === 0
      ? '  ALL LEGS GREEN — the panel is claimed AND the claim has a denominator.'
      : `  🔴 ${red} RED-LEG(S). This fails the PANEL claim. It does not fail the brief — THE BRIEF ALWAYS SHIPS.`
  );
  return red;
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

  // morning jurisdiction — a later pass's edit is detected, and only on the unit it touched
  const morning = md.replace(
    'Beta body sentence here.',
    'Beta body sentence here, corrected at 05:06.'
  );
  const md1 = dirtyUnits(units, morning, claims);
  t('morning edit detected as dirty', md1.length === 1 && md1[0]!.id === 'u2');
  t(
    'untouched units are NOT called dirty by the morning check',
    !md1.some(d => d.id !== 'u2')
  );
  t(
    'an unedited artifact reports zero dirty units',
    dirtyUnits(units, md, claims).length === 0
  );

  // product routing — the light and the full brief must not share a state directory
  const beforeSuffix = PRODUCT_SUFFIX;
  PRODUCT_SUFFIX = '-full';
  const fullPath = rbPath('2026-01-01', 'meta.json');
  PRODUCT_SUFFIX = '';
  const lightPath = rbPath('2026-01-01', 'meta.json');
  PRODUCT_SUFFIX = beforeSuffix;
  t('--product routes to a separate state dir', fullPath !== lightPath);
  t('default product path is unchanged', lightPath.includes('2026-01-01/'));

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

  // 🔴 ITEM 9 — the calibration set exists, carries the owner's three seeds, and the auditor works
  const calOk = fs.existsSync(PANEL_CALIBRATION);
  t('the AK calibration set exists on disk', calOk);
  if (calOk) {
    const cal = JSON.parse(fs.readFileSync(PANEL_CALIBRATION, 'utf-8'));
    const all = cal.assumed_knowledge?.seeds ?? [];
    const sd = all.filter((x: { date: string }) => x.date === '2026-08-10');
    t('the three 2026-08-10 owner seeds are still registered', sd.length === 3);
    t(
      'the five 2026-08-19 owner marks are registered',
      all.filter((x: { date: string }) => x.date === '2026-08-19').length === 5
    );
    t(
      'no duplicate seed (same date + unit + matcher)',
      new Set(
        all.map((x: Record<string, string>) => `${x.date}|${x.unit}|${x.match}`)
      ).size === all.length
    );
    t(
      'every seed names a date, a unit, a term and a matcher',
      all.every(
        (x: Record<string, string>) => x.date && x.unit && x.term && x.match
      )
    );
    t(
      'the calibration file records the template hash it was written against',
      cal.assumed_knowledge?.template_hash === sha(ASSUMED_KNOWLEDGE_TEMPLATE)
    );
    const ids = ['six:markets-macro:1', 'six:geopolitics:2', 'signal:2'];
    const good = akAudit(
      'U1: 2 | 10-year breakeven (CARRYABLE); CPI consensus (CARRYABLE)\nU2: 1 | shadow fleet (CARRYABLE)\nU3: 1 | EtO sterilization (STANDALONE)',
      sd,
      ids
    );
    t(
      'auditor confirms a detector that flagged all three 2026-08-10 seeds',
      good.every(r => r.found)
    );
    const bad = akAudit('U1: 0 |\nU2: 0 |\nU3: 0 |', sd, ids);
    t(
      'auditor CATCHES a detector that flagged none of them',
      bad.every(r => !r.found)
    );
  }

  // 🔴 C2 — the assumed-knowledge reader is a SEPARATE instrument with its own hash
  t(
    'assumed-knowledge template has exactly one slot',
    (ASSUMED_KNOWLEDGE_TEMPLATE.match(/\{artifact\}/g) ?? []).length === 1
  );
  t(
    'assumed-knowledge hash differs from the reader and hurried hashes',
    sha(ASSUMED_KNOWLEDGE_TEMPLATE) !== sha(READER_TEMPLATE) &&
      sha(ASSUMED_KNOWLEDGE_TEMPLATE) !== sha(HURRIED_TEMPLATE)
  );
  t(
    'assumed-knowledge asks for terms, never for a grade',
    /does not EXPLAIN/.test(ASSUMED_KNOWLEDGE_TEMPLATE) &&
      !/TRANSMITTED|DISTORTED|LOST/.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );

  // 🔴 PART 2 — FULL-BRIEF SEGMENTATION. The old parser returned prose 19 / claims 24 on the real
  // 2026-08-19 brief, collapsing every Six section to one unit. These assertions are the contract.
  const fullMd = [
    '# MARKETS, MEDITATIONS & MENTAL MODELS',
    '',
    '## Wednesday, August 19, 2026',
    '',
    '### The Payoff Headline',
    '',
    '*An intro paragraph long enough to clear the forty character floor for a real unit.*',
    '',
    '## ▸ OVERNIGHT',
    '',
    'Overnight prose that the claims sidecar deliberately does not count as a unit at all.',
    '',
    '# ▸ THE DASHBOARD',
    '',
    '### Equities',
    'Equities commentary long enough to clear the forty character floor for a unit.',
    '',
    '### Crypto',
    'Crypto commentary long enough to clear the forty character floor for a unit.',
    '',
    '# ▸ THE SIX',
    '',
    '## Markets & Macro',
    '',
    '- **Alpha lead.** Alpha body with enough characters to clear the floor test here.',
    '',
    '- **Beta lead.** Beta body with enough characters to clear the floor test here.',
    '',
    '## The Signal',
    '',
    '**Signal one lead.** Signal one body with enough characters to clear the floor.',
    '',
    '**Watch:** this continuation belongs to signal one and is never its own unit.',
    '',
    '# ▸ THE TAKE',
    '',
    '**Take lead.** Take body with enough characters to clear the forty character floor.',
    '',
    '# ▸ DISCOVERY',
    '',
    'Discovery prose long enough to clear the forty character floor for a standalone major.',
    '',
  ].join('\n');
  const fullClaims: Claim[] = [
    {
      unit: 'dash-equities',
      section: 'Dashboard/Equities',
      claim: 'dash equities claim words',
      so_what: 'x',
    },
    {
      unit: 'dash-crypto',
      section: 'Dashboard/Crypto',
      claim: 'dash crypto claim words',
      so_what: 'x',
    },
    {
      unit: 'mm-1',
      section: 'Markets & Macro',
      claim: 'alpha claim words here',
      so_what: 'x',
    },
    {
      unit: 'mm-2',
      section: 'Markets & Macro',
      claim: 'beta claim words here',
      so_what: 'x',
    },
    {
      unit: 'signal-1',
      section: 'The Signal',
      claim: 'signal claim words here',
      so_what: 'x',
    },
    {
      unit: 'take',
      section: 'THE TAKE',
      claim: 'take claim words here',
      so_what: 'x',
    },
    {
      unit: 'discovery',
      section: 'DISCOVERY',
      claim: 'discovery claim words here',
      so_what: 'x',
    },
    // 🔴 intro is LAST in the sidecar and FIRST in the document — positional pairing would corrupt
    {
      unit: 'intro',
      section: 'Intro Summary (payoff)',
      claim: 'intro claim words here',
      so_what: 'x',
    },
  ];
  const fc = candidatesFull(fullMd);
  t(
    'full: segments the same COUNT as the sidecar',
    fc.length === fullClaims.length
  );
  t(
    'full: OVERNIGHT is excluded by contract',
    !fc.some(c => /overnight/i.test(c.section))
  );
  t(
    'full: each Dashboard subsection is its own unit',
    fc.filter(c => c.section.startsWith('Dashboard/')).length === 2
  );
  t(
    'full: Six list items segment individually, not one per section',
    fc.filter(c => c.section === 'Markets & Macro').length === 2
  );
  t(
    'full: **Watch:** is folded into its Signal, never a unit',
    fc.filter(c => c.section === 'The Signal').length === 1
  );
  t(
    'full: the payoff intro is a unit',
    fc.some(c => c.section === 'Intro Summary (payoff)')
  );
  const fu = segment(fullMd, fullClaims, 'full');
  t(
    'full: pairs by SECTION LABEL, so out-of-order claims still land right',
    fu.every(x => {
      const body = fullMd.slice(x.start, x.end).toLowerCase();
      return x.id !== 'intro' || body.includes('payoff headline');
    })
  );
  t(
    'full: intro prose is NOT the discovery prose',
    fu.find(x => x.id === 'intro')!.sha !==
      fu.find(x => x.id === 'discovery')!.sha
  );
  t(
    'full: no degenerate units — every unit clears 40 chars',
    fu.every(x => fullMd.slice(x.start, x.end).trim().length > 40)
  );
  t(
    'full: every unit id is unique',
    new Set(fu.map(x => x.id)).size === fu.length
  );
  t(
    'full: a segmenter returning ZERO units is a finding, not a pass',
    candidatesFull('# MARKETS\n\nnothing here at all\n').length === 0
  );
  t(
    'light segmentation is UNCHANGED by the full-brief work',
    candidates(md).length === claims.length
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

  // hurried reader (ADVISORY) — own frozen prompt, structurally unable to actuate
  t(
    'calibrated reader template hash is FROZEN at 8362e5b17930dd37',
    sha(READER_TEMPLATE) === '8362e5b17930dd37'
  );
  t(
    'hurried template has exactly one slot',
    (HURRIED_TEMPLATE.match(/\{artifact\}/g) ?? []).length === 1
  );
  t(
    'hurried template is its own prompt, distinct from the calibrated one',
    sha(HURRIED_TEMPLATE) !== sha(READER_TEMPLATE)
  );
  t(
    'finalFor computes from the three calibrated grades alone',
    finalFor(
      { grades: ['TRANSMITTED', 'TRANSMITTED', 'TRANSMITTED'] },
      false
    ) === 'PASS' &&
      finalFor({ grades: ['DISTORTED', 'DISTORTED', 'DISTORTED'] }, false) ===
        'RESIDUAL' &&
      finalFor({ grades: ['DISTORTED', 'DISTORTED', 'DISTORTED'] }, true) ===
        'REDRAFTED' &&
      finalFor({ grades: ['DISTORTED', 'DISTORTED', 'TRANSMITTED'] }, false) ===
        'PASS'
  );
  const hrow = attachHurried(
    {
      final: finalFor(
        { grades: ['TRANSMITTED', 'TRANSMITTED', 'TRANSMITTED'] },
        false
      ),
    },
    { grade: 'LOST' }
  );
  t(
    'a LOST hurried read cannot move final off PASS',
    hrow.final === 'PASS' && hrow.hurried_read?.grade === 'LOST'
  );
  t(
    'absent hurried grade logs null, not a failure',
    attachHurried({ final: 'PASS' }, undefined).hurried_read === null
  );


  // ── FRESHMAN READER + PANEL ROSTER (2026-08-20) ────────────────────────────
  const V3 = 'U1: 3 | AK: USDC (STANDALONE); x402 transfers (STANDALONE) | REF: "it" → UNKNOWN';
  const V2 = 'U1: 2 | USDC (STANDALONE); x402 transfers (STANDALONE)';

  t('countUnitLines reads the reader/hurried shape', countUnitLines('U1 CLAIM: a | WHY: b') === 1);
  t('countUnitLines reads the freshman shape', countUnitLines(V3) === 1);
  t(
    'countUnitLines does NOT count a colon-less prose line — over-counting would turn SHORT into GREEN',
    countUnitLines('U1 is the interesting one here') === 0
  );
  t(
    'countUnitLines counts DISTINCT units, so a repeated answer cannot inflate the leg',
    countUnitLines('U1 CLAIM: a\nU1 CLAIM: a again\nU2 CLAIM: b') === 2
  );

  t('legState: every transcript absent is RED-LEG', legState([-1, -1, -1], 25).state === 'RED-LEG');
  t('legState: one of three absent is RED-LEG, not SHORT', legState([25, -1, 25], 25).state === 'RED-LEG');
  t('legState: a transcript that parses to zero units is RED-LEG', legState([0], 25).state === 'RED-LEG');
  t(
    'legState: answering MORE units than exist is RED-LEG (parse or isolation failure)',
    legState([26], 25).state === 'RED-LEG'
  );
  t('legState: a partial pass is SHORT, printed with its numbers', legState([18], 25).state === 'SHORT');
  t('legState: full coverage is GREEN', legState([25, 25, 25], 25).state === 'GREEN');
  t(
    'legState: SHORT reports the WORST of the three readers, never the best',
    legState([25, 18, 25], 25).note.includes('18/25')
  );

  t('akSegment with no segment returns the whole body — the 2026-08-17 seeds are unchanged', akSegment(V3) === V3);
  t('akSegment ak slices only the first pass', akSegment(V3, 'ak').includes('USDC') && !akSegment(V3, 'ak').includes('UNKNOWN'));
  t('akSegment ref slices only the second pass', akSegment(V3, 'ref').includes('UNKNOWN') && !akSegment(V3, 'ref').includes('USDC'));
  t(
    'akSegment ref on a v3 line with no REF content is EMPTY (a real miss), not null (N/A)',
    akSegment('U1: 1 | AK: x402 (STANDALONE) | REF: —', 'ref')!.trim() === '—'
  );

  const segIds = ['line-8'];
  t(
    'akAudit finds a referent seed in the REF pass',
    akAudit(V3, [{ unit: 'line-8', term: 'dangling it', match: '["“]it["”]|\\bit\\b\\s*(?:→|->)', segment: 'ref' }], segIds)[0]!.found
  );
  t(
    'akAudit does NOT let a REF flag satisfy an AK seed — the whole reason segment exists',
    akAudit(
      'U1: 1 | AK: — | REF: "x402" → UNKNOWN',
      [{ unit: 'line-8', term: 'x402', match: 'x402', segment: 'ak' }],
      segIds
    )[0]!.found === false
  );
  t(
    'akAudit unsegmented still matches anywhere on the line (backward compatibility)',
    akAudit(V3, [{ unit: 'line-8', term: 'x402', match: 'x402' }], segIds)[0]!.found
  );

  t('AK template v3 carries BOTH passes', /FIRST PASS/.test(ASSUMED_KNOWLEDGE_TEMPLATE) && /SECOND PASS/.test(ASSUMED_KNOWLEDGE_TEMPLATE));
  t(
    'AK template v3 asks for the referent GUESS, not just the flag',
    /UNKNOWN/.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );
  t(
    'AK template v3 judges each unit ALONE — the line-8 defect was full-brief dependency',
    /ALONE/.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );
  t(
    'AK template v3 does NOT contain the calibration clause itself — teaching to the test would make the seed pass without detection power',
    !/constraint is a successor/i.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );
  t('AK template still has exactly one interpolation slot', (ASSUMED_KNOWLEDGE_TEMPLATE.match(/\{artifact\}/g) ?? []).length === 1);

  t(
    'akSegment returns null (N/A) on a pre-v3 line, so a format mismatch is never reported as a detection miss',
    akSegment(V2, 'ak') === null && akSegment(V2, 'ref') === null
  );
  t(
    'akAudit marks a pre-v3 line NOT APPLICABLE rather than not-found',
    akAudit(V2, [{ unit: 'line-8', term: 'x402', match: 'x402', segment: 'ak' }], ['line-8'])[0]!.applicable === false
  );
  t(
    'akAudit keeps unsegmented seeds APPLICABLE on a pre-v3 line — the 2026-08-17 seeds still measure',
    akAudit(V2, [{ unit: 'line-8', term: 'x402', match: 'x402' }], ['line-8'])[0]!.applicable === true
  );

  // ── THE SHIPPED SEEDS, ROUND-TRIPPED ──────────────────────────────────────
  // Tests the matchers that are actually on disk, not hand-written copies of them. A regex that
  // works in the test and not in the file is the failure this guards.
  if (fs.existsSync(PANEL_CALIBRATION)) {
    const cal = JSON.parse(fs.readFileSync(PANEL_CALIBRATION, 'utf-8'));
    const live = (cal.assumed_knowledge?.seeds ?? []) as {
      date: string; unit: string; term: string; match: string; segment?: string;
    }[];
    t('every shipped matcher compiles as a JS regex', live.every(sd => { try { new RegExp(sd.match, 'i'); return true; } catch { return false; } }));

    const l8 = live.filter(sd => sd.unit === 'line-8');
    const tk = live.filter(sd => sd.unit === 'take');
    // A synthetic v3 line carrying exactly what a working freshman reader should return for line-8.
    const GOOD_L8 =
      'U1: 4 | AK: x402 (STANDALONE); USDC (CARRYABLE) | REF: "you" → UNKNOWN; "it" → the AI agent, I think';
    const GOOD_TAKE =
      'U1: 2 | AK: solvent deletion (CARRYABLE); "the constraint is a successor and not a lender" (STANDALONE) | REF: —';
    t(
      `all ${l8.length} shipped line-8 seeds fire on a correct v3 answer`,
      l8.length > 0 && akAudit(GOOD_L8, l8, ['line-8']).every(r => r.applicable && r.found)
    );
    t(
      `all ${tk.length} shipped take seed(s) fire on a correct v3 answer`,
      tk.length > 0 && akAudit(GOOD_TAKE, tk, ['take']).every(r => r.applicable && r.found)
    );
    // The negative direction: the v2 answer the detector ACTUALLY gave on 08-19 must NOT satisfy
    // the referent seeds. If it did, the seeds would be measuring nothing.
    const REAL_V2_L8 = 'U1: 2 | USDC (STANDALONE); x402 transfers (STANDALONE)';
    t(
      'the real 08-19 v2 answer satisfies NO segmented line-8 seed — the gap is real, not a matcher artifact',
      akAudit(REAL_V2_L8, l8.filter(x => x.segment), ['line-8']).every(r => !r.found)
    );
    // And a v3 answer that flags the vocabulary but still misses the referents must FAIL.
    const HALF_L8 = 'U1: 2 | AK: x402 (STANDALONE); USDC (CARRYABLE) | REF: —';
    t(
      'a v3 answer that catches the words but not the referents FAILS calibration — that is the whole point of the second pass',
      akAudit(HALF_L8, l8, ['line-8']).some(r => r.applicable && !r.found)
    );
  }

  t('surfaceRoster reports an unprepared surface as prepared:false, never as green', surfaceRoster(false, 0, () => null).prepared === false);
  t(
    'surfaceRoster enumerates ALL THREE legs even when nothing ran — the roster is fixed, not derived',
    surfaceRoster(true, 25, () => null).legs.length === 3 &&
      surfaceRoster(true, 25, () => null).legs.every(l => l.state === 'RED-LEG')
  );

  console.log(
    `\n${fail ? '✗' : '✓'} selftest ${pass}/${pass + fail} passed  ·  TEMPLATE_HASH ${sha(READER_TEMPLATE)}  ·  HURRIED_HASH ${sha(HURRIED_TEMPLATE)}`
  );
  console.log(
    `  ASSUMED_KNOWLEDGE_HASH ${sha(ASSUMED_KNOWLEDGE_TEMPLATE)}  [v3 two-pass · advisory · actuates nothing]`
  );
  if (!fail) console.log('SCRIPT-OK');
  return fail ? 1 : 0;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter(x => x.startsWith('--'));
const prod = flags.find(x => x.startsWith('--product='))?.split('=')[1] ?? '';
if (prod) PRODUCT_SUFFIX = `-${prod}`;
const positional = rawArgs.filter(x => !x.startsWith('--'));
const cmd = rawArgs[0]?.startsWith('--') ? rawArgs[0] : positional[0];
const a = positional[1];
const b = positional[2];
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
  case 'dirty':
    if (!a || !b)
      die('usage: dirty <DATE> <published.md> [--mark] [--product=full]');
    process.exit(cmdDirty(a, b, flags.includes('--mark')));
  // eslint-disable-next-line no-fallthrough
  case 'panel':
    if (!a) die('usage: panel <DATE>   — roster for BOTH surfaces; exit 1 on any RED-LEG');
    process.exit(printPanel(a) === 0 ? 0 : 1);
  case 'akcheck':
    if (!a) die('usage: akcheck <DATE>');
    process.exit(cmdAkCheck(a));
  // eslint-disable-next-line no-fallthrough
  case 'ledger':
    if (!a) die('usage: ledger <DATE>');
    cmdLedger(a);
    break;
  default:
    console.log(
      'transmission-readback.ts — mechanical half of the read-back loop. Never calls a model.'
    );
    console.log(
      '  prepare <light.md> <claims.json> | check <DATE> | panel <DATE> | tabulate <DATE> | assemble <DATE> | ledger <DATE> | dirty <DATE> <published.md> [--mark] | akcheck <DATE> | --selftest'
    );
    console.log(
      '  --product=full routes state to .readback/<DATE>-full/ so the full brief and the light never collide.'
    );
    process.exit(2);
}
