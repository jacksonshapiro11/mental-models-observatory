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
For EACH thing you list, add TWO words in brackets: CARRYABLE if a short plain-words gloss could have ridden inside the sentence that used it, or STANDALONE if explaining it would have needed its own sentence — then BLOCKING or MINOR.

SECOND PASS — WHAT IT POINTS AT.
Read the item again looking ONLY at pointing words: it, its, they, them, their, this, that, these, those, he, she, his, her, such, the former, the latter — plus any "the <noun>" where that noun was never introduced in this item, and any "you" or "we" where it is not clear who is meant.
For each one ask: is the thing it points at NAMED somewhere inside THIS numbered item?
 · If yes, ignore it.
 · If you have to guess, or you would have to have read something else to know — report it, and say what you think it means, or UNKNOWN if you cannot guess.
Report your guess even when you are fairly confident. A guess you got right and a guess you got wrong look identical from where you sit, and the difference is the whole point of asking.

RANK EVERYTHING. Two levels, and the line between them is whether you could keep reading:
 · BLOCKING — a pointing word you could not resolve, or background you could not bridge. You could not follow the claim without looking something up or guessing.
 · MINOR — you followed it fine; it could simply have been said plainer.
**A referent you had to guess at is BLOCKING, always.** Be strict about MINOR: if you understood the sentence, the flag is MINOR, however inelegant the wording. **Most items should be MINOR. If everything you list is BLOCKING, you have not ranked, you have re-listed.**
Within each pass, put the BLOCKING items first.

Do not list things you merely find interesting.

Output one line per item and nothing else:
U<n>: <total across both passes> | AK: <term> (CARRYABLE|STANDALONE, BLOCKING|MINOR); … | REF: "<pointing word, verbatim>" → <your best guess, or UNKNOWN> (BLOCKING|MINOR); …

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
  claimsTotal?: number; // total claim rows, which may exceed units.length when a claim was never drafted
  findings?: SegmentFindings;
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
/** 🔴 SECTION LABELS ARE NOT STABLE ACROSS NIGHTS AND THE SEGMENTER WAS BUILT AGAINST ONE OF THEM.
 *  2026-08-19 writes `Dashboard/Equities` and `Intro Summary (payoff)`; 2026-08-10 writes
 *  `Dashboard / Equities` and `Intro Summary`. Verified on both files, not assumed. A comparison
 *  that is exact-match on a label the pipeline reformats will report four healthy units as
 *  undrafted — which it did, on the first run of the CLAIM-UNDRAFTED policy. Normalise: case,
 *  whitespace, spaces around a slash, a trailing parenthetical, and and/&. */
const normLabel = (x: string): string =>
  x
    .trim()
    .toUpperCase()
    .replace(/\([^)]*\)\s*$/, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+&\s+/g, ' AND ')
    .replace(/\s+/g, ' ')
    .trim();

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

export type SegmentFindings = {
  claimUndrafted: { unit: string; section: string; claim: string }[];
  proseUnclaimed: { section: string; words: number }[];
  mispaired?: { unit: string; section: string; score: number }[];
};
/** Side channel for cmdPrepare. segment() must keep returning Unit[] — every caller depends on it. */
let LAST_FINDINGS: SegmentFindings = { claimUndrafted: [], proseUnclaimed: [] };
let SEG_SCORES: { unit: string; score: number; paired: boolean }[] = [];
export const lastFindings = (): SegmentFindings => LAST_FINDINGS;

/** 🔴 CLAIM-UNDRAFTED POLICY (owner ruling 2026-08-20, decision 2).
 *
 *  Pairs claims to prose blocks by SECTION LABEL, greedily, in document order. A claim with no
 *  unpaired prose block in its section is CLAIM-UNDRAFTED: it is NAMED and it is NOT graded.
 *  A prose block with no claim is PROSE-UNCLAIMED: also named, also not graded (there is nothing
 *  to grade it against).
 *
 *  🔴 THIS REPLACES A HARD ABORT WITH A NAMED FINDING, AND THAT IS THE WHOLE POINT. The abort was
 *  correct about the defect and wrong about the consequence: on 2026-08-10 and 2026-08-11 it
 *  refused to grade 21 good units because 1 claim was never drafted, so ten days of read-back data
 *  was lost to protect against a mispairing that label-pairing already prevents. A guard that
 *  discards the measurable to avoid an unmeasurable is not conservative, it is expensive.
 *
 *  What is NOT relaxed: the pairing itself. A claim only ever pairs with prose carrying its own
 *  section label. Nothing is paired by position, and nothing is invented. */
/** Share of the CLAIM's content words that appear in the prose block. Directional on purpose: a
 *  claim is a compressed restatement of its prose, so the right block contains nearly all of it
 *  while a wrong block in the same section shares only topic words. Measured on the two real
 *  mismatched nights before this was written — right pairs scored 0.68–1.00, wrong pairs 0.05–0.32.
 *  The gap is what makes the floor safe; the floor is not a guess. */
export function overlapScore(claim: string, prose: string): number {
  const tk = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9$%.\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP.has(w))
    );
  const c = tk(claim);
  if (!c.size) return 0;
  const p = tk(prose);
  let hit = 0;
  for (const w of c) if (p.has(w)) hit++;
  return hit / c.size;
}

/** Reporting annotation ONLY — a pairing below this is printed WEAK so a human looks at it.
 *  🔴 IT IS NOT A GATE, AND IT USED TO BE. As a gate it dropped 3 correctly-paired units from the
 *  2026-08-19 brief (24/24 -> 21/24), because it was calibrated on THE SIX's long bullets and then
 *  applied to Dashboard lines and the intro, which are short and restate rather than repeat.
 *  Caught by a byte-level regression check against the known-good 08-19 pairing. The fix was to
 *  DELETE the threshold from the decision, not to tune it: see pairByLabel. */
export const PAIR_WEAK = 0.45;

/** 🔴 THE MISPAIR FLAG SITS FAR BELOW PAIR_WEAK, AND THE GAP IS THE WHOLE POINT.
 *  Calibrated 2026-08-20 against every balanced-section pair on three nights (n = 66 units):
 *    · the ONE true mispair found — 2026-08-11 The Wild Card, three claims about three different
 *      stories than the three bullets they were attached to — scored 0.06 / 0.00 / 0.00.
 *    · every pair verified correct BY HAND scored 0.25 or above, and the low end of that range is
 *      correct pairs with different vocabulary: 2026-08-19 `wc-1` at 0.25 ("3D-printed gun networks
 *      buy ammunition from licensed dealers" vs prose saying exactly that in other words),
 *      `dash-commodities` at 0.44 (claim says crude, prose says WTI and Brent), `intro` at 0.39
 *      (an intro abstracts the brief, so overlap is low by construction).
 *  0.15 sits in the empty band between 0.06 and 0.25. **At PAIR_WEAK (0.45) this flag fired on all
 *  three of those correct 08-19 pairs — a constant calibrated for one job used for another, which
 *  is the third time today.** n is small; this is a FLAG and never a gate, so the cost of it being
 *  wrong is a missed warning, not a dropped unit. Widen it if a real mispair ever scores above 0.15. */
export const MISPAIR_FLAG = 0.15;

/** 🔴 PAIRING IS BY SECTION LABEL **AND CONTENT**, NEVER BY POSITION WITHIN A SECTION.
 *
 *  The first cut of this function paired greedily in document order inside each section, and on
 *  2026-08-10 it attached `ait-2`'s claim (Meta ad growth) to `ait-3`'s prose (the Claude Code
 *  permission test) and reported `ait-3` as the undrafted one. Both halves wrong: a unit graded
 *  against a claim about a different story, and the finding named the wrong row. **That is the
 *  exact corruption the hard abort existed to prevent, reintroduced by the relaxation that
 *  replaced it.** When a section's counts differ, position carries no information — the gap can be
 *  anywhere — so the claim text itself has to decide.
 *
 *  Best-match first, globally within the section, so a strong pair can never be displaced by a
 *  weaker one that happens to come first. Every score is printed by the caller: no pairing
 *  decision here is silent. */
export function pairByLabel(
  md: string,
  cands: { section: string; start: number; end: number }[],
  claims: Claim[]
): {
  units: Unit[];
  findings: SegmentFindings;
  scores: { unit: string; score: number; paired: boolean }[];
} {
  const pool = cands.map((c, i) => ({ ...c, i, used: false }));
  const byUnit = new Map<string, { start: number; end: number; score: number }>();
  const scores: { unit: string; score: number; paired: boolean }[] = [];
  const mispaired: { unit: string; section: string; score: number }[] = [];

  const groups = new Map<string, { cl: Claim[]; pr: typeof pool }>();
  const grp = (k: string) => {
    if (!groups.has(k)) groups.set(k, { cl: [], pr: [] });
    return groups.get(k)!;
  };
  for (const cl of claims) grp(normLabel(cl.section)).cl.push(cl);
  for (const pb of pool) grp(normLabel(pb.section)).pr.push(pb);

  for (const { cl, pr } of groups.values()) {
    // ── BALANCED SECTION: counts agree, so the label already forces the assignment. Pair in
    //    document order and do NOT consult content. This is the 2026-08-19 path — 24/24, verified
    //    byte-identical before and after content matching was added — and it must stay untouched.
    if (cl.length === pr.length) {
      // 🔴 BUT SCORE IT ANYWAY AND FLAG. A balanced count means the COUNTS match. It does not mean
      // the claims correspond to the prose, and on 2026-08-11 The Wild Card had 3 claims and 3
      // prose blocks that were THREE DIFFERENT STORIES — wolfsbane enzymes, hippocampus microglia
      // and an Indian Ocean current, against prose about primate brains, a silver catalyst and
      // microglia. Positional pairing attached all three to the wrong prose and nothing said a word:
      // scores 0.06 / 0.00 / 0.00. The shortcut's premise — "a balanced count forces the
      // assignment" — is simply false, and it failed silently, which is the class this whole
      // instrument exists to catch.
      // The flag never RE-ASSIGNS: in a balanced section document order is still the best available
      // guess, and a low score is a finding for a human, not a licence for the matcher to reorder.
      cl.forEach((c, i) => {
        pr[i]!.used = true;
        const sc = overlapScore(c.claim, md.slice(pr[i]!.start, pr[i]!.end));
        byUnit.set(c.unit, { start: pr[i]!.start, end: pr[i]!.end, score: sc });
        if (sc < MISPAIR_FLAG) mispaired.push({ unit: c.unit, section: c.section, score: sc });
      });
      continue;
    }
    // ── UNBALANCED SECTION: the gap can be anywhere, so position carries no information and the
    //    claim text has to decide. Assign BEST-FIRST until one side runs out. Whoever is left over
    //    is the finding — RANK, NOT THRESHOLD. 🔴 There is deliberately no magic number here: the
    //    count difference already tells us exactly how many claims must be undrafted, so the only
    //    question is WHICH, and that is answered by taking the strongest matches first.
    const cells: { ci: number; pi: number; s: number }[] = [];
    cl.forEach((c, ci) =>
      pr.forEach((b, pi) =>
        cells.push({ ci, pi, s: overlapScore(c.claim, md.slice(b.start, b.end)) })
      )
    );
    cells.sort((a, b) => b.s - a.s);
    const tookC = new Set<number>(),
      tookP = new Set<number>();
    for (const cell of cells) {
      if (tookC.has(cell.ci) || tookP.has(cell.pi)) continue;
      tookC.add(cell.ci);
      tookP.add(cell.pi);
      pr[cell.pi]!.used = true;
      byUnit.set(cl[cell.ci]!.unit, {
        start: pr[cell.pi]!.start,
        end: pr[cell.pi]!.end,
        score: cell.s,
      });
    }
    // every claim in an unbalanced section reports its best score, paired or not
    cl.forEach((c, ci) =>
      scores.push({
        unit: c.unit,
        score: cells.filter(x => x.ci === ci).reduce((m, x) => Math.max(m, x.s), 0),
        paired: tookC.has(ci),
      })
    );
  }

  // emit in CLAIMS-FILE ORDER: the sidecar defines the units and their order
  const units: Unit[] = [];
  const claimUndrafted: SegmentFindings['claimUndrafted'] = [];
  for (const cl of claims) {
    const hit = byUnit.get(cl.unit);
    if (!hit) {
      claimUndrafted.push({ unit: cl.unit, section: cl.section, claim: cl.claim });
      continue;
    }
    units.push({
      id: cl.unit,
      section: cl.section,
      idx: units.length,
      start: hit.start,
      end: hit.end,
      sha: sha(md.slice(hit.start, hit.end)),
    });
  }
  const proseUnclaimed = pool
    .filter(c => !c.used)
    .map(c => ({ section: c.section, words: md.slice(c.start, c.end).trim().split(/\s+/).length }));
  return { units, findings: { claimUndrafted, proseUnclaimed, mispaired }, scores };
}

/** 🔴 The claims file is authoritative. This VALIDATES the prose against it and never invents units. */
/**
 * 🔴 TRAILING COMMENT BLOCKS ARE NOT PART OF THE LAST UNIT (declared on the 2026-08-27 board, fixed
 * 2026-08-28 — work order item 3).
 *
 * THE BOARD'S OWN WORDS: *"SEGMENTER BUG: prepare's reader-prompt.txt appended the trailing
 * DECLARATIONS/staleness/truth blocks to the last unit and would have shown the readers the Take's
 * framework and the Inner Game discomfort line; readers were run on a stripped copy."*
 *
 * The last unit's `end` runs to EOF, so every end-of-file comment block — declarations, the
 * staleness ledger, the truth log — was pasted into the reader's view of the final unit. That is
 * not a cosmetic leak: those blocks name the Take's framework and the Inner Game's intended
 * discomfort, which is precisely the material a BLIND reader must not see. The night it was caught,
 * the readers were run on a hand-stripped copy — a workaround that fixes one night and no other,
 * and the bug was declared 🔴 and then left off the open list. (Carried as its own CARRY row.)
 *
 * The boundary is CLAMPED, never deleted: `segment` stops the last unit before the trailing run, and
 * assembly's `out += md.slice(cursor)` re-appends those bytes verbatim. So the readers stop seeing
 * them and the artifact keeps them. A file with no trailing blocks is untouched — the clamp is a
 * no-op, which is the second direction of the selftest.
 */
/** Clamp the final unit so it stops before any end-of-file comment run. Mutates in place. */
export function clampTrailing(units: { start: number; end: number }[], md: string): void {
  if (!units.length) return;
  const cut = trailingBlockStart(md);
  const last = units[units.length - 1]!;
  if (cut < last.end && cut > last.start) last.end = cut;
}

export function trailingBlockStart(md: string): number {
  let i = md.length;
  let stripped = 0;
  for (;;) {
    let j = i;
    while (j > 0 && /\s/.test(md[j - 1]!)) j--;      // skip whitespace before the block
    if (j === 0) break;
    if (!md.slice(0, j).endsWith('-->')) break;       // not a comment block: boundary found
    const open = md.lastIndexOf('<!--', j - 3);
    if (open < 0) break;                              // unbalanced: change nothing
    i = open;
    stripped++;
  }
  if (!stripped) return md.length;                    // clean file: untouched, to the byte
  // Having stripped at least one block, take the separating whitespace with it — otherwise the
  // last unit keeps a trailing blank line that was only ever there to separate it from the block.
  while (i > 0 && /\s/.test(md[i - 1]!)) i--;
  return i;
}

function segment(md: string, claims: Claim[], product = ''): Unit[] {
  const full = product === 'full';
  const cands = full ? candidatesFull(md) : candidates(md);
  // 🔴 FULL BRIEF: pair by SECTION LABEL in document order, never by position — always, whether or
  // not the counts agree. Counts agreeing was never what made the pairing safe; the labels are.
  if (full) {
    const { units, findings, scores } = pairByLabel(md, cands, claims);
    clampTrailing(units, md);
    if (units.length) {
      const last = units[units.length - 1]!;
      last.sha = sha(md.slice(last.start, last.end)); // re-fingerprint after the clamp
    }
    LAST_FINDINGS = findings;
    SEG_SCORES = scores;
    if (!units.length) {
      console.error(
        `\n❌ ZERO UNITS PAIRED — ${claims.length} claim(s), ${cands.length} prose block(s), no section label in common.`
      );
      console.error(`   Prose labels: ${[...new Set(cands.map(c => c.section))].join(' · ')}`);
      console.error(`   Claim labels: ${[...new Set(claims.map(c => c.section))].join(' · ')}`);
      console.error(`   A segmenter returning zero units is a finding, never a pass.`);
      process.exit(1);
    }
    return units;
  }
  LAST_FINDINGS = { claimUndrafted: [], proseUnclaimed: [], mispaired: [] };
  SEG_SCORES = [];
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
  const plain = cands.map((x, i) => ({
    id: claims[i]!.unit,
    section: claims[i]!.section,
    idx: i,
    start: x.start,
    end: x.end,
    sha: '',
  }));
  clampTrailing(plain, md);
  // sha AFTER the clamp — a unit's fingerprint must cover exactly the bytes a reader is shown.
  for (const u of plain) u.sha = sha(md.slice(u.start, u.end));
  return plain;
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
    claimsTotal: claims.length,
    findings: lastFindings(),
  };
  fs.writeFileSync(rbPath(date, 'meta.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(
    rbPath(date, 'claims.json'),
    JSON.stringify(claims, null, 2)
  );

  const F = lastFindings();
  if (F.mispaired?.length) {
    console.log('');
    console.log(
      `🔴 RED — MISPAIR-SUSPECT. ${F.mispaired.length} unit(s) in a BALANCED section pair to prose that barely shares their words.`
    );
    for (const m of F.mispaired)
      console.log(`   ⚠ MISPAIR-SUSPECT  ${m.unit}  [${m.section}]  content match ${m.score.toFixed(2)}`);
    console.log(
      `   A balanced count means the COUNTS match. It does NOT mean the claims correspond to the prose.`
    );
    console.log(
      `   2026-08-11 The Wild Card scored 0.06/0.00/0.00 — three claims about three different stories than the three bullets they were attached to.`
    );
    console.log(`   NOT re-assigned. Document order is still the best guess; this is a finding for a human.`);
  }
  if (F.claimUndrafted.length || F.proseUnclaimed.length) {
    console.log('');
    console.log(
      `🔴 RED — CLAIM-UNDRAFTED. ${units.length} of ${claims.length} claim(s) paired to prose. The rest are named below and will NOT be graded.`
    );
    const byUnitScore = new Map(SEG_SCORES.map(x => [x.unit, x]));
    for (const c of F.claimUndrafted) {
      const sc = byUnitScore.get(c.unit);
      console.log(
        `   ✗ CLAIM-UNDRAFTED  ${c.unit}  [${c.section}]  best content match ${sc ? sc.score.toFixed(2) : 'n/a'} — no prose in its section restates it` +
          `\n        claim: "${c.claim.slice(0, 110)}${c.claim.length > 110 ? '…' : ''}"`
      );
    }
    const weak = SEG_SCORES.filter(x => x.paired && x.score < PAIR_WEAK);
    for (const w of weak)
      console.log(`   ⚠ WEAK PAIR       ${w.unit}  matched at ${w.score.toFixed(2)} in an unbalanced section — paired by rank, look at it`);
    for (const c of F.proseUnclaimed)
      console.log(`   ✗ PROSE-UNCLAIMED  [${c.section}]  ${c.words} words drafted with no claim row — ungradeable, there is nothing to grade it against`);
    console.log(
      `   The drafted units ARE graded. This is a RED line in pipeline status, not a reason to grade nothing —`
    );
    console.log(
      `   and it is NOT fixed by editing the claims file to match the prose.`
    );
    console.log('');
  }
  console.log(
    `✓ PREPARED ${date} — ${units.length} units validated against the claims file` +
      (claims.length !== units.length ? `  (of ${claims.length} claim rows — see RED above)` : '')
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

// ── 🔴 THE ASSEMBLY INVARIANT (WORK ORDER 2026-08-28, item 1) ─────────────────────────────────
//
// THE DEFECT THIS EXISTS TO END, stated exactly: on 2026-08-26 `redrafts.json` carried FOUR keys —
// `update-1`, `line-7`, `line-5`, `line-4` — while `tabulation.json` recorded `unanimous: []` and
// `majority: ["update-1","line-7"]`. **Two of the four splices were authorized by nothing.** They
// were spliced anyway, because `assemble` checked only that a redraft key NAMED A KNOWN UNIT. That
// is a spell-check standing in for a permission check, and it is the only defect in this instrument's
// history that reached readers.
//
// Note what did NOT save it. Assembly already re-segments and proves every UNTOUCHED unit is
// byte-identical — a real guarantee, and useless here: both unauthorized units were TOUCHED, so
// the freeze check waved them through by construction. **A guard that only inspects what you did
// not change cannot see an unauthorized change.**
//
// AUTHORIZED means one of four sources said so, and the source is recorded per key:
//   1. unanimous                     — all three readers failed the unit (any night)
//   2. majority-if-past-phase-1      — 2-of-3, only after the ladder's first 7 GRADED nights
//   3. 2-of-3 direction-inversion    — so_what WRONG at 2-of-3; a reader acting on it acts backwards
//   4. so_what unanimous MISSING/WRONG — 3/3 (work-order item 6a)
//
// ✅ TENSION RESOLVED BY OWNER RULING 2026-08-28 (W2), and the resolution shows both items were
// talking about DIFFERENT INSTRUMENTS — which is why they looked contradictory:
//
//   • TRANSMISSION READERS (this rung): the three blind readers each state back what the unit said.
//     When 2 of 3 read the DIRECTION BACKWARDS — recorded as `WRONG` in that reader's so_what mark —
//     the unit ACTUATES IMMEDIATELY and its rewrite is re-read the same night. A reader acting on an
//     inverted unit acts backwards; two of three doing so is not a difference of taste.
//
//   • SO_WHAT ENSEMBLE (`sowhatActuation`, below): three GRADERS scoring the same transcripts.
//     A 2-1 split there is graders disagreeing about a grade, not readers reporting a reversal.
//     It still NEVER actuates. Unchanged by this ruling.
//
// The earlier session read item 1's "2-of-3 direction-inversions" as a so_what-ensemble rung and
// switched it off to obey item 6(a). Wrong instrument: item 6(a) governs the ensemble, item 1's rung
// governs the readers. **The lesson is worth more than the fix — "2-of-3" named a threshold without
// naming WHOSE three, and two rules that never overlapped read as a contradiction for a day.**
export const ALLOW_INVERSION_RUNG = true; // ON — owner ruling 2026-08-28 (W2). Readers, not graders.
export const TRANSMISSION_PHASE1_NIGHTS = 7;

/** Nights this product has been graded BEFORE `date` — from the LEDGER, never the calendar, and
 *  never including the night under assembly (a replay must see what that night could see). */
export function nightsGradedBefore(product: string, date: string): number {
  if (!fs.existsSync(LEDGER)) return 0;
  const rows = JSON.parse(fs.readFileSync(LEDGER, 'utf-8')) as Record<string, unknown>[];
  const prod = product || 'light';
  return new Set(
    rows.filter(r => (r['product'] ?? 'light') === prod && String(r['date']) < date).map(r => r['date'])
  ).size;
}

export type SowhatCell = 'OK' | 'MISSING' | 'WRONG' | string;

/** unit -> the source that authorized redrafting it. Absent from the map == NOT authorized. */
export function authorizeRedrafts(opts: {
  tab: { unanimous?: string[]; majority?: string[] };
  sowhat?: Record<string, SowhatCell[] | undefined>;
  product: string;
  date: string;
}): Map<string, string> {
  const out = new Map<string, string>();
  const nights = nightsGradedBefore(opts.product, opts.date);
  const past = nights >= TRANSMISSION_PHASE1_NIGHTS;
  for (const u of opts.tab.unanimous ?? []) out.set(u, 'unanimous (3/3 readers failed)');
  for (const u of opts.tab.majority ?? []) {
    if (past) { if (!out.has(u)) out.set(u, `majority 2-of-3 · past phase 1 (${nights} graded nights >= ${TRANSMISSION_PHASE1_NIGHTS})`); }
  }
  for (const [u, cells] of Object.entries(opts.sowhat ?? {})) {
    if (!cells || !cells.length) continue;
    const wrong = cells.filter(c => c === 'WRONG').length;
    const failed = cells.filter(c => c !== 'OK').length;
    if (failed === cells.length) { if (!out.has(u)) out.set(u, `so_what unanimous ${cells.join('/')} (${failed}/${cells.length})`); continue; }
    if (ALLOW_INVERSION_RUNG && wrong >= 2 && !out.has(u))
      out.set(u, `READER DIRECTION-INVERSION — ${wrong}/${cells.length} blind readers read the direction backwards. Actuates immediately (W2, 2026-08-28); rewrite is re-read the same night.`);
  }
  return out;
}

export interface StrictFinding { kind: string; detail: string }

/**
 * STRICT WHOLE-ARTIFACT VALIDATION, run AFTER the splice — always, both products.
 *
 * The claims-anchored pairing (`pairByLabel`) deliberately tolerates unmatched prose blocks, because
 * an unbalanced section's count difference is itself the finding. That tolerance is correct for
 * DIAGNOSIS and wrong for SHIPPING: post-splice there is nothing left to diagnose, and a prose block
 * bound to no claim — or two blocks bound to one claim — is a duplicated or orphaned unit heading for
 * a reader. 2026-08-26's board records both halves of that: *"tonight's lede sat last in claims,
 * assemble mangled the artifact ... also, prepare accepted a DUPLICATE unit id."*
 */
export function strictArtifactCheck(md: string, claims: Claim[], product: string): StrictFinding[] {
  const f: StrictFinding[] = [];
  const cands = product === 'full' ? candidatesFull(md) : candidates(md);
  if (cands.length !== claims.length)
    f.push({
      kind: 'COUNT-MISMATCH',
      detail: `${cands.length} prose block(s) vs ${claims.length} claim row(s) — post-splice the two must agree exactly; the claims file DEFINES the units`,
    });
  const dupClaimIds = Object.entries(
    claims.reduce<Record<string, number>>((a, c) => ((a[c.unit] = (a[c.unit] || 0) + 1), a), {})
  ).filter(([, n]) => n > 1);
  if (dupClaimIds.length)
    f.push({ kind: 'DUPLICATE-UNIT-ID', detail: `claims file carries the same unit id more than once: ${dupClaimIds.map(([k, n]) => `${k}×${n}`).join(', ')}` });
  // Two candidates binding one claim. Section-level is the only binding the pairing has, so an
  // over-subscribed section is exactly that condition.
  const bySec = (xs: { section: string }[]) => xs.reduce<Record<string, number>>((a, x) => ((a[x.section] = (a[x.section] || 0) + 1), a), {});
  const pc = bySec(cands), cc = bySec(claims.map(c => ({ section: c.section })));
  for (const k of new Set([...Object.keys(pc), ...Object.keys(cc)]))
    if ((pc[k] || 0) > (cc[k] || 0))
      f.push({ kind: 'OVER-BOUND-SECTION', detail: `section "${k}" has ${pc[k]} prose block(s) for ${cc[k] || 0} claim(s) — two candidates would bind one claim` });
  return f;
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

  // ── LEG (a): AUTHORIZATION. Naming a real unit is not permission to rewrite it. ──────────────
  const product = PRODUCT_SUFFIX.replace('-', '');
  const tabPath = rbPath(date, 'tabulation.json');
  if (!fs.existsSync(tabPath))
    die(
      `NO TABULATION — assemble cannot authorize a single splice without it. Run: tabulate ${date}\n` +
        `   (Refusing is the point: 2026-08-26 spliced two units nothing had authorized.)`
    );
  const tab = JSON.parse(fs.readFileSync(tabPath, 'utf-8'));
  const gradesForAuth: Record<string, { sowhat?: SowhatCell[] }> = fs.existsSync(rbPath(date, 'grades.json'))
    ? JSON.parse(fs.readFileSync(rbPath(date, 'grades.json'), 'utf-8'))
    : {};
  const sowhatCells: Record<string, SowhatCell[] | undefined> = {};
  for (const [u, g] of Object.entries(gradesForAuth)) sowhatCells[u] = g?.sowhat;
  const auth = authorizeRedrafts({ tab, sowhat: sowhatCells, product, date });
  const unauthorized = [...touched].filter(k => !auth.has(k));
  if (unauthorized.length)
    die(
      `UNAUTHORIZED REDRAFT — ${unauthorized.length} unit(s) in redrafts.json that nothing actuated: ${unauthorized.join(', ')}\n` +
        `   authorized this night (${auth.size}): ${[...auth].map(([k, why]) => `${k} ← ${why}`).join('; ') || 'NONE'}\n` +
        `   tabulation: unanimous [${(tab.unanimous ?? []).join(', ')}] · majority [${(tab.majority ?? []).join(', ')}]\n` +
        `   Receipt this rule exists for — 2026-08-26: redrafts carried update-1, line-7, line-5, line-4;\n` +
        `   tabulation authorized only update-1 and line-7. line-4 and line-5 shipped on nobody's say-so.\n` +
        `   A redraft is authorized by a TABULATED FAILURE, never by appearing in the file.`
    );
  for (const [k, why] of auth) if (touched.has(k)) console.log(`   AUTHORIZED ${k} ← ${why}`);

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

  // ── LEG (b): STRICT WHOLE-ARTIFACT RE-VALIDATION, always, after the splice ──────────────────
  const strict = strictArtifactCheck(out, claims, product);
  if (strict.length)
    die(
      `POST-SPLICE STRICT VALIDATION FAILED — ${strict.length} finding(s):\n` +
        strict.map(x => `     ${x.kind}: ${x.detail}`).join('\n') +
        `\n   The claims-anchored pairing tolerates unmatched prose during DIAGNOSIS; after the splice\n` +
        `   there is nothing left to diagnose, and an unbound block is a duplicated or orphaned unit\n` +
        `   heading for a reader. Nothing ships from this state.`
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
    `✓ ASSEMBLED ${date} — ${touched.size} unit(s) redrafted (all authorized), ${meta.units.length - touched.size} frozen and verified byte-identical, whole artifact strictly re-validated`
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

/** RULING 2 (2026-08-20) — the drift number the flag policy is graded on.
 *  Counts flags per unit and splits them BLOCKING / MINOR across a whole freshman transcript.
 *  🔴 THE WIN CONDITION IS THIS NUMBER TRENDING DOWN. ZERO IS NOT THE TARGET — a freshman reader
 *  that flags nothing has stopped reading, which is the hurried reader's parrot failure wearing a
 *  different hat. A rise after a template change is a template effect, not a writing effect:
 *  windows either side of a hash move are different measurements and never pool. */
export function flagStats(transcript: string): {
  units: number; total: number; blocking: number; minor: number; unranked: number; preV3: number; perUnit: number;
} {
  let units = 0, total = 0, blocking = 0, minor = 0, unranked = 0, preV3 = 0;
  for (const line of transcript.split('\n')) {
    const m = line.match(/^\s*U(\d+)\s*:\s*(.*)$/);
    if (!m) continue;
    units++;
    const body = m[2] ?? '';
    // Items are ';'-separated inside each pass. A bare dash is an empty pass, not an item.
    if (!isLabelled(body)) preV3++; // pre-v3 line: it has flags, they just cannot be split or ranked
    for (const seg of ['ak', 'ref'] as const) {
      const part = akSegment(body, seg);
      if (part === null) continue; // pre-v3 line: no passes to split
      for (const raw of part.split(';')) {
        const it = raw.trim();
        if (!it || it === '—' || it === '-') continue;
        total++;
        if (/\bBLOCKING\b/i.test(it)) blocking++;
        else if (/\bMINOR\b/i.test(it)) minor++;
        else unranked++;
      }
    }
  }
  return { units, total, blocking, minor, unranked, preV3, perUnit: units ? total / units : 0 };
}

/** One line, and it REFUSES to state a rate it cannot compute.
 *  🔴 A pre-v3 transcript has flags that cannot be split or ranked — total would compute to 0 and
 *  print `0.0/unit`, which reads as a flawless brief. That is the permissive direction, the same
 *  error shape as the rotation counter logged on 2026-08-19 and as the first cut of akSegment
 *  earlier tonight. Third instance; the rule is that an uncomputable number is named, never zeroed. */
export function flagLine(f: ReturnType<typeof flagStats>): string {
  if (f.preV3)
    return `flags        ·  NOT COMPUTABLE — ${f.preV3}/${f.units} unit(s) are pre-v3 (no AK:/REF: passes to split or rank). NOT zero flags; unmeasured flags.`;
  return (
    `flags        ·  ${f.perUnit.toFixed(1)}/unit  (${f.blocking} blocking, ${f.minor} minor` +
    (f.unranked ? `, ${f.unranked} UNRANKED — the reader ignored the rank` : '') +
    `) over ${f.units} unit(s)   ↓ is the win; 0 is not the target`
  );
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
    const F = meta.findings;
    const undraft = (F?.claimUndrafted?.length ?? 0) + (F?.proseUnclaimed?.length ?? 0);
    console.log(
      `  ${surface}  ${dir}  ·  ${r.units} units prepared` +
        (meta.claimsTotal && meta.claimsTotal !== r.units ? `  of ${meta.claimsTotal} claim rows` : '')
    );
    if (undraft) {
      red++;
      for (const c of F!.claimUndrafted)
        console.log(`      🔴 CLAIM-UNDRAFTED  ${c.unit}  [${c.section}]  — a claim row written and never drafted`);
      for (const c of F!.proseUnclaimed)
        console.log(`      🔴 PROSE-UNCLAIMED  [${c.section}] ${c.words}w  — drafted with no claim row`);
    }
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
    const akPath = rbPath(date, 'readback-assumed-knowledge.txt');
    if (!seeds.length) {
      if (fs.existsSync(akPath))
        console.log('  ' + flagLine(flagStats(fs.readFileSync(akPath, 'utf-8'))));
      console.log(`  calibration  ·  0 seeds registered for ${date} — nothing asserted, which is an absence, not a pass`);
    } else {
      const tPath = rbPath(date, 'readback-assumed-knowledge.txt');
      if (!fs.existsSync(tPath)) {
        red++;
        console.log(`  calibration  🔴 RED-LEG — ${seeds.length} seed(s) registered and no freshman transcript to audit`);
      } else {
        const meta: Meta = JSON.parse(fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8'));
        const txt = fs.readFileSync(tPath, 'utf-8');
        console.log('  ' + flagLine(flagStats(txt)));
        const res = akAudit(txt, seeds, meta.units.map(u => u.id));
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

/** 🔴 THE SO_WHAT ENSEMBLE AND ITS ACTUATION LADDER (owner adoption 2026-08-20).
 *
 *  WHY AN ENSEMBLE AT ALL. The single-pass so_what grader was measured on 2026-08-19 and it does
 *  not reproduce: four undefined-rubric re-runs landed 48.0-53.3%, three defined-rubric off-packet
 *  runs landed 54.7-62.7%, and the LIVE PRODUCTION run of that same night logged 90.7%. Defining
 *  the rubric killed the MISSING/WRONG boundary (9 inter-run disagreements -> 0) but did NOT
 *  collapse the spread — it widened to 8 points once in-sample anchors were removed. The
 *  pre-registered consequence was an ensemble, and this is it.
 *
 *  🔴 THE 90.7% IS RETIRED. It is an artifact of a path that no longer exists, and it is never
 *  quoted as a quality number again. Neither is the 90.3% all-history baseline built from it.
 *
 *  SHAPE. Three graders each grade three reader WHYs per unit against the logged so_what, in
 *  isolation, on the defined rubric with off-packet anchors. Majority per (unit, reader) is the
 *  ensemble verdict. A 2-1 split is resolved by the majority and COUNTED, because the split rate is
 *  the leg's own noise reading.
 *
 *  THE LADDER — the standing actuation law, applied to a leg that has only just earned trust:
 *    · WRONG at 2-of-3 readers actuates IMMEDIATELY, on any night. A WRONG is a direction
 *      inversion: the reader believes something the so_what denies, and a reader acting on it acts
 *      backwards. That is not a degree of misunderstanding.
 *    · MISSING-or-WRONG at 3-of-3 actuates during the leg's first seven graded nights.
 *    · From the eighth graded night, MISSING-or-WRONG at 2-of-3 actuates.
 *  Nights are COUNTED FROM THE LEDGER, never from the calendar: a night the leg did not grade is
 *  not a night it learned anything.
 *
 *  ONE PASS. The writer redrafts the DELIVERING SENTENCE — the clause carrying the actionable
 *  point, per the carried-clause rule — and one reader re-checks. Then it ships. 🔴 THE BRIEF
 *  ALWAYS SHIPS. Nothing here may block a publish.
 *
 *  INHERITED LAWS. Redrafting is rewrite authority, so this pass sits inside the loop's
 *  jurisdiction. Units that were not actuated must be BYTE-IDENTICAL between graded and shipped. */
export type SowhatGrade = 'OK' | 'MISSING' | 'WRONG';
export const SOWHAT_LADDER_NIGHTS = 7;

/** Parses one grader transcript. Lines look like `U<n> SO_WHAT: OK/MISSING/WRONG`. */
export function parseSowhatGrades(text: string): Record<number, SowhatGrade[]> {
  const out: Record<number, SowhatGrade[]> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*U(\d+)\s*(?:SO_WHAT)?\s*:\s*([A-Za-z]+)\s*\/\s*([A-Za-z]+)\s*\/\s*([A-Za-z]+)/i);
    if (!m) continue;
    const g = [m[2]!, m[3]!, m[4]!].map(x => x.toUpperCase()) as SowhatGrade[];
    if (g.some(x => x !== 'OK' && x !== 'MISSING' && x !== 'WRONG')) continue;
    out[Number(m[1])] = g;
  }
  return out;
}

/** Majority per position across three graders. Returns the verdict and whether it was a 2-1 split.
 *  🔴 A three-way disagreement (OK/MISSING/WRONG) has no majority. It resolves to the WORST grade
 *  present, because the alternative is resolving a unit nobody agreed on toward OK, and this leg
 *  spent a full day being audited for exactly that direction of error. It is counted as a split. */
export function ensembleVerdict(three: SowhatGrade[][]): { verdict: SowhatGrade; split: boolean } {
  const c: Record<string, number> = {};
  for (const g of three) c[g[0]!] = (c[g[0]!] ?? 0) + 1;
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]!;
  if (top[1] >= 2) return { verdict: top[0] as SowhatGrade, split: top[1] === 2 };
  const worst: SowhatGrade = three.some(g => g[0] === 'WRONG')
    ? 'WRONG'
    : three.some(g => g[0] === 'MISSING')
      ? 'MISSING'
      : 'OK';
  return { verdict: worst, split: true };
}

export type SowhatAction = 'HOLD' | 'REDRAFT' | 'REDRAFT-INVERSION';

/** The ladder. `nightsGraded` = how many nights this leg has ALREADY graded before tonight. */
// ── 🔴 SO_WHAT REWRITE LOOP — SELF-GUARDING (owner ruling 2026-08-28, work order item 6) ──────
//
// (a) ACTUATION: a so_what rewrite fires ONLY on unanimous MISSING/WRONG (3/3). A 2-1 split LOGS
//     and never actuates.
//
// 🔴 THIS REVOKES THE 2-OF-3 INVERSION RUNG, and the revocation is deliberate rather than an
// oversight. The ladder adopted 2026-08-20 fired REDRAFT-INVERSION on WRONG at 2-of-3 "on any
// night". Item 6(a) says plainly that a 2-1 split never actuates, and an inversion at 2-of-3 IS a
// 2-1 split. The later, more specific ruling wins, and it moves in the conservative direction: a
// rewrite that does not fire is a logged split someone can read, while a rewrite that fires on a
// split rewrites prose two of three readers understood. Item 1's authorization list names the
// inversion rung — `ALLOW_INVERSION_RUNG` is the single constant that restores it, and it is now
// FALSE. **This is the one place where two items of the same work order disagree; it is resolved
// here in favour of the newer text, visibly, rather than silently.**
export const SOWHAT_MAX_CYCLES = 2;

export function sowhatActuation(
  verdicts: SowhatGrade[],
  _nightsGraded: number
): { action: SowhatAction; reason: string } {
  const wrong = verdicts.filter(v => v === 'WRONG').length;
  const failed = verdicts.filter(v => v === 'WRONG' || v === 'MISSING').length;
  const n = verdicts.length;
  if (n === 0) return { action: 'HOLD', reason: 'NOT GRADED — no verdicts. Not a pass; unmeasured.' };
  if (failed === n)
    return {
      action: wrong >= 2 ? 'REDRAFT-INVERSION' : 'REDRAFT',
      reason: `MISSING/WRONG ${failed}/${n} — UNANIMOUS${wrong >= 2 ? `, and ${wrong} of them WRONG: a reader acting on this acts backwards` : ''}`,
    };
  return {
    action: 'HOLD',
    reason: `${failed}/${n} failed — a split LOGS and never actuates (item 6a, 2026-08-28). ${wrong >= 2 ? `Note ${wrong} WRONG in a split: recorded, not acted on — the inversion rung was revoked with the rest.` : ''}`.trim(),
  };
}

/**
 * (b) EVERY REWRITE IS RE-READ THE SAME NIGHT, both legs, by fresh readers — same as transmission
 * redrafts. HARD CAP TWO CYCLES per unit. "Perfect" is not the bar; LANDING is. A unit still
 * failing after cycle 2 SHIPS AS-IS, rows RESIDUAL, and leads the morning summary.
 *
 * The cap is the point. Without it a rewrite loop that cannot land optimises the prose against its
 * own graders all night, which is how a loop starts serving itself instead of the reader.
 */
export function sowhatCycleAction(
  verdicts: SowhatGrade[],
  cyclesDone: number
): { action: SowhatAction | 'RESIDUAL'; reason: string } {
  const base = sowhatActuation(verdicts, 0);
  if (base.action === 'HOLD') return base;
  if (cyclesDone >= SOWHAT_MAX_CYCLES)
    return {
      action: 'RESIDUAL',
      reason: `still failing after ${cyclesDone} cycle(s) — SHIPS AS-IS and leads tomorrow's summary. The cap is ${SOWHAT_MAX_CYCLES}: landing is the bar, not perfection, and a loop that keeps rewriting is optimising against its own graders.`,
    };
  return { action: base.action, reason: `${base.reason} · cycle ${cyclesDone + 1} of ${SOWHAT_MAX_CYCLES}, re-read tonight by fresh readers on BOTH legs` };
}

/**
 * (c) PASSIVE CALIBRATION. No scheduled labeling sessions — the owner's ordinary listening marks
 * land in the ledger as they always have, and a weekly one-liner computes ensemble-vs-owner
 * agreement on the marked units only. n=0 is a valid receipt and must READ as n=0, never as 100%.
 *
 * PROMOTION (splits gain the pen) requires agreement >= 85% on >= 15 accumulated marks AND the
 * owner's signature — this function never promotes, it only reports eligibility.
 * DEMOTION to log-only is AUTOMATIC below 80%, and needs nobody's signature.
 */
export const SOWHAT_PROMOTE_PCT = 85, SOWHAT_PROMOTE_N = 15, SOWHAT_DEMOTE_PCT = 80;

export function sowhatAgreement(
  rows: { owner_mark?: unknown; sowhat_grades?: unknown }[]
): { n: number; agree: number; pct: number | null; verdict: 'PROMOTE-ELIGIBLE' | 'HOLD' | 'DEMOTE' | 'UNMEASURED'; line: string } {
  const marked = rows.filter(r => typeof r.owner_mark === 'string' && (r.owner_mark as string).trim());
  let n = 0, agree = 0;
  for (const r of marked) {
    const g = Array.isArray(r.sowhat_grades) ? (r.sowhat_grades as string[]) : [];
    if (!g.length) continue;
    n++;
    const ensembleOk = g.filter(x => x === 'OK').length > g.length / 2;
    const ownerOk = /\b(ok|landed|clear|got it|yes)\b/i.test(String(r.owner_mark));
    if (ensembleOk === ownerOk) agree++;
  }
  if (n === 0)
    return { n: 0, agree: 0, pct: null, verdict: 'UNMEASURED', line: 'so_what calibration — n=0 marked units. NOT COMPUTABLE: no agreement rate exists yet. This is a valid first receipt and is NOT 100%.' };
  const pct = Math.round((100 * agree) / n);
  const verdict = pct < SOWHAT_DEMOTE_PCT ? 'DEMOTE' : pct >= SOWHAT_PROMOTE_PCT && n >= SOWHAT_PROMOTE_N ? 'PROMOTE-ELIGIBLE' : 'HOLD';
  const tail =
    verdict === 'DEMOTE'
      ? `🔴 AUTOMATIC DEMOTION to log-only — below ${SOWHAT_DEMOTE_PCT}%. Needs nobody's signature.`
      : verdict === 'PROMOTE-ELIGIBLE'
        ? `ELIGIBLE for promotion (>=${SOWHAT_PROMOTE_PCT}% on >=${SOWHAT_PROMOTE_N} marks) — REQUIRES THE OWNER'S SIGNATURE. This line never promotes anything.`
        : `HOLD — needs >=${SOWHAT_PROMOTE_PCT}% on >=${SOWHAT_PROMOTE_N} marks to be eligible.`;
  return { n, agree, pct, verdict, line: `so_what calibration — ensemble agrees with the owner on ${agree}/${n} marked unit(s) = ${pct}%. ${tail}` };
}

/** (d) THRASH GUARD — >4 units rewritten a night for 3 consecutive nights is RED. */
export const THRASH_UNITS = 4, THRASH_NIGHTS = 3;

export function sowhatThrash(perNight: { date: string; rewrites: number }[]): { red: boolean; line: string } {
  const sorted = [...perNight].sort((a, b) => a.date.localeCompare(b.date));
  const tail = sorted.slice(-THRASH_NIGHTS);
  const red = tail.length === THRASH_NIGHTS && tail.every(x => x.rewrites > THRASH_UNITS);
  return {
    red,
    line: red
      ? `🔴 SO_WHAT THRASH — >${THRASH_UNITS} units rewritten on ${THRASH_NIGHTS} consecutive nights (${tail.map(x => `${x.date}:${x.rewrites}`).join(', ')}). SUSPECT THE INSTRUMENT OR THE WRITER, NOT THE UNITS.`
      : `so_what rewrites, last ${tail.length} night(s): ${tail.map(x => `${x.date}:${x.rewrites}`).join(', ') || 'none'} — below the thrash bar (>${THRASH_UNITS} for ${THRASH_NIGHTS} straight).`,
  };
}

/** How many nights this leg has already graded on the ensemble basis. Read from the ledger, never
 *  from the calendar: a night the leg did not grade is not a night it learned anything. */
function sowhatNightsGraded(product: string): number {
  if (!fs.existsSync(LEDGER)) return 0;
  const rows = JSON.parse(fs.readFileSync(LEDGER, 'utf-8')) as Record<string, unknown>[];
  const prod = product || 'light';
  return new Set(
    rows
      .filter(r => r['sowhat_basis'] === 'ens/3' && (r['product'] ?? 'light') === prod)
      .map(r => r['date'])
  ).size;
}

function cmdSowhat(date: string): number {
  const product = PRODUCT_SUFFIX.replace('-', '') || 'light';
  const files = [1, 2, 3].map(n => rbPath(date, `sowhat-grader-${n}.txt`));
  console.log(`SO_WHAT ENSEMBLE ${date} (${product}) — 3 graders, majority per reader`);

  const present = files.map(f => fs.existsSync(f));
  files.forEach((f, i) => console.log(`  grader ${i + 1}  ${present[i] ? '✓' : '🔴 ABSENT'}  ${f}`));
  if (present.some(x => !x)) {
    console.log(
      `  🔴 RED-LEG — ${present.filter(x => !x).length} of 3 grader transcripts missing. An ensemble of fewer than three is not an ensemble, and a partial tally is NOT a lower number — it is an unmeasured one.`
    );
    return 1;
  }

  const parsed = files.map(f => parseSowhatGrades(fs.readFileSync(f, 'utf-8')));
  const meta: Meta = JSON.parse(fs.readFileSync(rbPath(date, 'meta.json'), 'utf-8'));
  const idx = meta.units.map(u => u.idx + 1);
  const short = parsed.map((p, i) => ({ i, missing: idx.filter(n => !p[n]) })).filter(x => x.missing.length);
  if (short.length) {
    for (const s of short)
      console.log(`  🔴 RED-LEG — grader ${s.i + 1} did not grade ${s.missing.length} unit(s): ${s.missing.map(n => 'U' + n).join(', ')}`);
    console.log(`  A short grader is an unmeasured brief, not a worse one. Re-run that grader.`);
    return 1;
  }

  const nights = sowhatNightsGraded(product);
  let ok = 0, splits = 0, total = 0;
  const acts: { unit: string; n: number; v: SowhatGrade[]; a: SowhatAction; why: string }[] = [];
  for (const u of meta.units) {
    const n = u.idx + 1;
    const verdicts: SowhatGrade[] = [];
    for (let r = 0; r < 3; r++) {
      const e = ensembleVerdict(parsed.map(p => [p[n]![r]!]));
      verdicts.push(e.verdict);
      if (e.split) splits++;
      if (e.verdict === 'OK') ok++;
      total++;
    }
    const { action, reason } = sowhatActuation(verdicts, nights);
    if (action !== 'HOLD') acts.push({ unit: u.id, n, v: verdicts, a: action, why: reason });
  }

  console.log(
    `  units ${meta.units.length} · grades ${total} · OK ${ok}/${total} = ${((100 * ok) / total).toFixed(1)}%   [basis ens/3, RESET 2026-08-20]`
  );
  console.log(
    `  🔴 NOT COMPARABLE to any pre-reset number. The retired single-pass path logged 90.7% on 2026-08-19 and 90.3% all-history; both are artifacts of a path that no longer exists.`
  );
  console.log(`  2-1 splits ${splits}/${total} = ${((100 * splits) / total).toFixed(0)}%  — the leg's own noise reading`);
  console.log(
    `  ── ACTUATION · ladder night ${nights + 1}${nights < SOWHAT_LADDER_NIGHTS ? ` of ${SOWHAT_LADDER_NIGHTS} (unanimous-only)` : ' (past the window: majority)'} · WRONG at 2-of-3 immediate ──`
  );
  if (!acts.length) console.log(`  ✓ no unit meets the bar tonight. Nothing redrafts.`);
  for (const a of acts)
    console.log(`  🔴 ${a.a.padEnd(18)} ${a.unit.padEnd(20)} U${a.n}  ${a.v.join('/')}\n        ${a.why}`);
  if (acts.length) {
    console.log(
      `  → ${acts.length} unit(s) to redraft. Rewrite the DELIVERING SENTENCE so the actionable point lands (carried-clause rule). ONE reader re-checks.`
    );
    console.log(
      `  → ONE PASS, then ship regardless. 🔴 THE BRIEF ALWAYS SHIPS. Untouched units must be BYTE-IDENTICAL between graded and shipped.`
    );
  }
  return 0;
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

  // ── 🔴 THE ASSEMBLY INVARIANT (work order 2026-08-28, item 1) ──────────────────────────────
  // Held-out replay against the REAL state on disk, both directions. No fixture: the bytes that
  // shipped are the test.
  {
    const RBROOT = RB_DIR;
    const readNight = (d: string) => {
      const dir = path.join(RBROOT, d);
      const rp = path.join(dir, 'redrafts.json'), tp = path.join(dir, 'tabulation.json');
      if (!fs.existsSync(rp) || !fs.existsSync(tp)) return null;
      const keys = Object.keys(JSON.parse(fs.readFileSync(rp, 'utf-8')));
      const tab = JSON.parse(fs.readFileSync(tp, 'utf-8'));
      const gp = path.join(dir, 'grades.json');
      const g = fs.existsSync(gp) ? JSON.parse(fs.readFileSync(gp, 'utf-8')) : {};
      const sw: Record<string, SowhatCell[] | undefined> = {};
      for (const [u, v] of Object.entries<{ sowhat?: SowhatCell[] }>(g)) sw[u] = v?.sowhat;
      const m = d.match(/^(\d{4}-\d{2}-\d{2})(?:-(\w+))?$/);
      if (!m) return null;
      const auth = authorizeRedrafts({ tab, sowhat: sw, product: m[2] ?? '', date: m[1]! });
      return { keys, auth, unauth: keys.filter(k => !auth.has(k)) };
    };

    // MUST FIRE — the night the work order names. redrafts carried 4 keys; tabulation authorized 2.
    const n26 = readNight('2026-08-26');
    t(
      'ITEM1 · 2026-08-26 FIRES — line-4 and line-5 were spliced with nothing authorizing them',
      !!n26 && n26.unauth.length === 2 && n26.unauth.includes('line-4') && n26.unauth.includes('line-5')
    );
    t(
      'ITEM1 · and the two that WERE authorized are still authorized — this refuses unauthorized splices, it does not refuse redrafting',
      !!n26 && n26.auth.has('update-1') && n26.auth.has('line-7')
    );

    // 🔴 A SECOND NIGHT, FOUND BY THE REPLAY AND WORSE THAN THE FIRST. On 2026-08-20 the redraft
    // set was DISJOINT from the authorized set: line-2 and line-7 were graded TRANSMITTED 3/3 with
    // so_what OK 3/3 — perfectly clean — and were rewritten anyway, while line-1, the ONLY unit the
    // tabulation named, was left alone. Not a near-miss: the loop actuated on something other than
    // its own measurement.
    const n20 = readNight('2026-08-20');
    t(
      'ITEM1 · 2026-08-20 FIRES TOO — two units graded TRANSMITTED 3/3 and so_what OK 3/3 were rewritten; the one flagged unit was not',
      !!n20 && n20.unauth.length === 2 && n20.unauth.includes('line-2') && n20.unauth.includes('line-7')
    );

    // MUST STAY SILENT — every other night that redrafted anything.
    const clean = ['2026-08-08', '2026-08-14', '2026-08-15', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-21', '2026-08-25', '2026-08-27']
      .map(d => ({ d, r: readNight(d) }))
      .filter(x => x.r);
    t(
      `ITEM1 · SILENT on all ${clean.length} other redrafting nights in the archive — ${clean.map(x => x.d.slice(5)).join(' ')}`,
      clean.length >= 8 && clean.every(x => x.r!.unauth.length === 0)
    );

    // The phase-1 rung is REAL, counted from the ledger and never the calendar.
    t(
      'ITEM1 · majority authorizes only past phase 1 — same tabulation, phase-1 night refuses it',
      authorizeRedrafts({ tab: { unanimous: [], majority: ['x'] }, product: 'nonexistent-product', date: '2026-08-26' }).size === 0 &&
        authorizeRedrafts({ tab: { unanimous: [], majority: ['x'] }, product: '', date: '2026-08-26' }).has('x')
    );
    t(
      'ITEM1 · unanimous authorizes on ANY night, phase or no phase',
      authorizeRedrafts({ tab: { unanimous: ['x'], majority: [] }, product: 'nonexistent-product', date: '2026-08-26' }).has('x')
    );
    t(
      'ITEM1 · so_what unanimous MISSING authorizes (work-order item 6a)',
      authorizeRedrafts({ tab: {}, sowhat: { x: ['MISSING', 'MISSING', 'MISSING'] }, product: 'nonexistent-product', date: '2026-08-26' }).has('x')
    );
    t(
      'ITEM1 · a so_what 2-1 split that is NOT an inversion never authorizes',
      !authorizeRedrafts({ tab: {}, sowhat: { x: ['MISSING', 'MISSING', 'OK'] }, product: 'nonexistent-product', date: '2026-08-26' }).has('x')
    );
    t(
      'ITEM1 · a clean so_what authorizes nothing — N/A state',
      authorizeRedrafts({ tab: {}, sowhat: { x: ['OK', 'OK', 'OK'] }, product: 'nonexistent-product', date: '2026-08-26' }).size === 0
    );
    t(
      'ITEM1 · an EMPTY tabulation authorizes NOTHING — the permissive direction is the one that shipped',
      authorizeRedrafts({ tab: { unanimous: [], majority: [] }, product: '', date: '2026-08-26' }).size === 0
    );

    // ── LEG (b): STRICT POST-SPLICE VALIDATION ────────────────────────────────────────────────
    const claims26: Claim[] = JSON.parse(fs.readFileSync(path.join(RBROOT, '2026-08-26', 'claims.json'), 'utf-8'));
    const asm26 = fs.readFileSync(path.join(RBROOT, '2026-08-26', 'assembled.md'), 'utf-8');
    t(
      'ITEM1b · the strict check is SILENT on a well-formed assembled artifact (2026-08-26 after the claims renumbering that unblocked it)',
      strictArtifactCheck(asm26, claims26, '').length === 0
    );
    const dupClaims = [...claims26, { ...claims26[0]! }] as Claim[];
    t(
      'ITEM1b · DUPLICATE-UNIT-ID fires — the exact condition the 08-26 board recorded ("prepare accepted a DUPLICATE unit id")',
      strictArtifactCheck(asm26, dupClaims, '').some(x => x.kind === 'DUPLICATE-UNIT-ID')
    );
    t(
      'ITEM1b · COUNT-MISMATCH fires when the splice leaves a prose block bound to no claim',
      strictArtifactCheck(asm26, claims26.slice(0, -1), '').some(x => x.kind === 'COUNT-MISMATCH')
    );
    t(
      'ITEM1b · OVER-BOUND-SECTION fires when two candidates would bind one claim',
      strictArtifactCheck(asm26, claims26.filter((_, i) => i !== 1), '').some(x => x.kind === 'OVER-BOUND-SECTION')
    );
  }

  // ── 🔴 ITEM 3 — TRAILING COMMENT BLOCKS ARE NOT PART OF THE LAST UNIT ────────────────────────
  {
    const body = '## ▸ THE CLOSE\n\nMost of what moved prices today has not been delivered yet.\n';
    const decls =
      '\n<!-- DECLARATIONS\n  take-move: hidden-precondition\n  inner-game: the discomfort is the point\n-->\n\n<!-- staleness ledger: DGS2 printed 2026-08-27 -->\n';
    t(
      'ITEM3 · the trailing comment run is found and the boundary sits at the end of real content (the blank line that only separated them goes with the block)',
      trailingBlockStart(body + decls) === body.trimEnd().length
    );
    t(
      'ITEM3 · a file with NO trailing blocks loses nothing — the clamp is a no-op (the second direction)',
      trailingBlockStart(body) === body.length
    );
    t(
      'ITEM3 · consecutive trailing blocks are stripped as one run, not one deep',
      trailingBlockStart(body + decls + '\n<!-- truth log: 0 unresolved -->\n') === body.trimEnd().length
    );
    t(
      'ITEM3 · an INLINE comment is never touched — only an end-of-file run is trailing',
      trailingBlockStart('a <!-- take-move: inversion --> b\n\ntail text\n') ===
        'a <!-- take-move: inversion --> b\n\ntail text\n'.length
    );
    t(
      'ITEM3 · an UNBALANCED "-->" changes nothing rather than eating the file',
      trailingBlockStart(body + '\n-->\n') === (body + '\n-->\n').length
    );
    // The clamp itself, on the shape the bug actually had: last unit runs to EOF.
    const u = [{ start: 0, end: (body + decls).length }];
    clampTrailing(u, body + decls);
    t(
      'ITEM3 · clampTrailing pulls the LAST unit back off the declarations block',
      u[0]!.end === body.trimEnd().length
    );
    const u2 = [{ start: 0, end: body.length }];
    clampTrailing(u2, body);
    t('ITEM3 · and leaves a clean file exactly as it found it', u2[0]!.end === body.length);
    // 🔴 THE REAL FILE THAT CARRIES THE BUG TODAY.
    const v2 = 'daily-briefs/2026-08-28-v2.md';
    if (fs.existsSync(v2)) {
      const raw = fs.readFileSync(v2, 'utf-8');
      t(
        `ITEM3 · the LIVE full brief ends in a comment block and the clamp moves the boundary — ${raw.length - trailingBlockStart(raw)} byte(s) would have been shown to a blind reader`,
        trailingBlockStart(raw) < raw.length
      );
    }
  }

  // ── ITEM 6 (b)(c)(d) — the rewrite loop guards itself ────────────────────────────────────────
  {
    const C = (v: string[], n: number) => sowhatCycleAction(v as SowhatGrade[], n);
    t('item6b: cycle 1 of a unanimous fail is a REDRAFT that will be re-read the same night, both legs',
      C(['MISSING', 'MISSING', 'MISSING'], 0).action === 'REDRAFT' && /re-read tonight by fresh readers on BOTH legs/.test(C(['MISSING', 'MISSING', 'MISSING'], 0).reason));
    t('item6b: cycle 2 is still allowed', C(['MISSING', 'MISSING', 'MISSING'], 1).action === 'REDRAFT');
    t('item6b: HARD CAP — a unit still failing after 2 cycles ships as-is and rows RESIDUAL, never a third rewrite',
      C(['MISSING', 'MISSING', 'MISSING'], 2).action === 'RESIDUAL' && /SHIPS AS-IS/.test(C(['MISSING', 'MISSING', 'MISSING'], 2).reason));
    t('item6b: the cap says why — landing is the bar, and a loop past it optimises against its own graders',
      /optimising against its own graders/.test(C(['MISSING', 'MISSING', 'MISSING'], 2).reason));
    t('item6b: a HOLD never consumes a cycle — a split is not a failed rewrite', C(['MISSING', 'OK', 'OK'], 0).action === 'HOLD');

    // (c) PASSIVE CALIBRATION
    const A = sowhatAgreement;
    t('item6c: n=0 READS as n=0 — NOT COMPUTABLE, explicitly not 100%',
      A([]).verdict === 'UNMEASURED' && A([]).pct === null && /NOT COMPUTABLE/.test(A([]).line) && /NOT 100%/.test(A([]).line));
    t('item6c: an owner mark with no ensemble grades is not counted — an unmeasured pair is not an agreement',
      A([{ owner_mark: 'landed', sowhat_grades: [] }]).n === 0);
    const agreeRows = Array.from({ length: 15 }, () => ({ owner_mark: 'landed', sowhat_grades: ['OK', 'OK', 'OK'] }));
    t('item6c: >=85% on >=15 marks is PROMOTE-ELIGIBLE and says out loud that it requires the owner’s signature',
      A(agreeRows).verdict === 'PROMOTE-ELIGIBLE' && /REQUIRES THE OWNER'S SIGNATURE/.test(A(agreeRows).line));
    t('item6c: the same agreement on too FEW marks is only HOLD — the n bar is real',
      A(agreeRows.slice(0, 14)).verdict === 'HOLD');
    const disagree = [
      ...Array.from({ length: 7 }, () => ({ owner_mark: 'landed', sowhat_grades: ['OK', 'OK', 'OK'] })),
      ...Array.from({ length: 3 }, () => ({ owner_mark: 'landed', sowhat_grades: ['MISSING', 'MISSING', 'MISSING'] })),
    ];
    t('item6c: below 80% is AUTOMATIC DEMOTION to log-only and needs nobody’s signature',
      A(disagree).verdict === 'DEMOTE' && /AUTOMATIC DEMOTION/.test(A(disagree).line) && /nobody/.test(A(disagree).line));

    // (d) THRASH GUARD
    const T = sowhatThrash;
    t('item6d: >4 units on 3 consecutive nights is RED and names the instrument, not the units',
      T([{ date: '2026-08-25', rewrites: 5 }, { date: '2026-08-26', rewrites: 6 }, { date: '2026-08-27', rewrites: 5 }]).red &&
        /SUSPECT THE INSTRUMENT OR THE WRITER, NOT THE UNITS/.test(T([{ date: '2026-08-25', rewrites: 5 }, { date: '2026-08-26', rewrites: 6 }, { date: '2026-08-27', rewrites: 5 }]).line));
    t('item6d: exactly 4 is not thrash — the bar is MORE than 4, not at least 4',
      !T([{ date: '2026-08-25', rewrites: 4 }, { date: '2026-08-26', rewrites: 4 }, { date: '2026-08-27', rewrites: 4 }]).red);
    t('item6d: two heavy nights broken by a quiet one is not thrash — consecutive means consecutive',
      !T([{ date: '2026-08-25', rewrites: 6 }, { date: '2026-08-26', rewrites: 1 }, { date: '2026-08-27', rewrites: 6 }]).red);
    t('item6d: N/A STATE — fewer than 3 recorded nights can never be RED, and says how many it has',
      !T([{ date: '2026-08-27', rewrites: 9 }]).red && /last 1 night/.test(T([{ date: '2026-08-27', rewrites: 9 }]).line));
  }

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
      'the four 2026-08-19 owner seeds are registered (the it-seed merged into the you-seed, owner ruling 2026-08-20)',
      all.filter((x: { date: string }) => x.date === '2026-08-19').length === 4
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

  // ── SO_WHAT ENSEMBLE + ACTUATION LADDER (owner adoption 2026-08-20) ───────
  const G = (x: string) => parseSowhatGrades(x);
  t('parseSowhatGrades reads the grader line shape', Object.keys(G('U1 SO_WHAT: OK/MISSING/WRONG')).length === 1);
  t('parseSowhatGrades keeps reader order', G('U1 SO_WHAT: OK/MISSING/WRONG')[1]!.join('/') === 'OK/MISSING/WRONG');
  t('parseSowhatGrades ignores a line with an unknown label', Object.keys(G('U1 SO_WHAT: OK/MAYBE/WRONG')).length === 0);
  t('parseSowhatGrades ignores prose', Object.keys(G('these units were hard to grade')).length === 0);

  const E = (a: string, b: string, c: string) => ensembleVerdict([[a as SowhatGrade], [b as SowhatGrade], [c as SowhatGrade]]);
  t('ensemble: unanimous OK is OK and not a split', E('OK', 'OK', 'OK').verdict === 'OK' && !E('OK', 'OK', 'OK').split);
  t('ensemble: 2-1 takes the majority and IS counted as a split', E('OK', 'OK', 'MISSING').verdict === 'OK' && E('OK', 'OK', 'MISSING').split);
  t('ensemble: 2-1 the other way', E('MISSING', 'MISSING', 'OK').verdict === 'MISSING');
  t(
    'ensemble: a three-way disagreement resolves to the WORST grade, never to OK',
    E('OK', 'MISSING', 'WRONG').verdict === 'WRONG' && E('OK', 'MISSING', 'WRONG').split
  );

  const L = (v: string[], n: number) => sowhatActuation(v as SowhatGrade[], n);
  t('ladder: unanimous MISSING actuates on night 1', L(['MISSING', 'MISSING', 'MISSING'], 0).action === 'REDRAFT');
  t('ladder: 2-of-3 MISSING HOLDS inside the unanimous-only window', L(['MISSING', 'MISSING', 'OK'], 0).action === 'HOLD');
  // 🔴 REVOKED BY ITEM 6(a), 2026-08-28. This asserted that a 2-of-3 MISSING actuates once the
  // ladder passed 7 graded nights. The ruling is now unambiguous — "a so_what rewrite fires ONLY on
  // unanimous MISSING/WRONG (3/3); a 2-1 split logs and never actuates" — so the night count no
  // longer buys a split the pen, on night 8 or night 800.
  t('item6a: a 2-of-3 MISSING HOLDS even far past the old ladder window — nights no longer buy a split the pen', L(['MISSING', 'MISSING', 'OK'], 99).action === 'HOLD');
  t(
    'item6a: WRONG at 2-of-3 no longer actuates — the inversion rung was revoked with the rest of the split rungs, and the split is LOGGED with its WRONG count named',
    L(['WRONG', 'WRONG', 'OK'], 0).action === 'HOLD' && /2 WRONG in a split/.test(L(['WRONG', 'WRONG', 'OK'], 0).reason)
  );
  t(
    'item6a: a UNANIMOUS WRONG still actuates as an inversion — unanimity, not the WRONG count, is what buys the pen now',
    L(['WRONG', 'WRONG', 'WRONG'], 0).action === 'REDRAFT-INVERSION'
  );
  // ── W2 (owner ruling 2026-08-28) — TWO INSTRUMENTS, TWO RULES, PROVEN SIDE BY SIDE ──────────
  // The whole point of this pair: the same "2-of-3" means different things depending on WHOSE
  // three, and the earlier session switched off the wrong one for a day because the phrase did
  // not say. These assertions sit together so that can never be re-read as a contradiction.
  t(
    'W2: READERS — 2-of-3 blind readers reading the direction BACKWARDS actuates immediately',
    ALLOW_INVERSION_RUNG === true &&
      authorizeRedrafts({ tab: {}, sowhat: { u: ['WRONG', 'WRONG', 'OK'] }, product: 'nonexistent-product', date: '2026-08-28' }).has('u')
  );
  t(
    'W2: and the authorization says WHOSE three, so the next reader of this code cannot confuse the instruments',
    /READER DIRECTION-INVERSION/.test(
      authorizeRedrafts({ tab: {}, sowhat: { u: ['WRONG', 'WRONG', 'OK'] }, product: 'nonexistent-product', date: '2026-08-28' }).get('u')!
    )
  );
  t(
    'W2: GRADERS — the so_what ensemble still HOLDS on a 2-1 split, unchanged by the ruling',
    sowhatActuation(['WRONG', 'WRONG', 'OK'] as SowhatGrade[], 0).action === 'HOLD' &&
      sowhatActuation(['MISSING', 'MISSING', 'OK'] as SowhatGrade[], 99).action === 'HOLD'
  );
  t(
    'W2: a lone reader inversion is still not enough — 1-of-3 authorizes nothing',
    !authorizeRedrafts({ tab: {}, sowhat: { u: ['WRONG', 'OK', 'OK'] }, product: 'nonexistent-product', date: '2026-08-28' }).has('u')
  );
  t(
    'W2: the reader rung and the ensemble rung disagree on the SAME input, and that is correct — 2 WRONG authorizes a redraft while the ensemble holds',
    authorizeRedrafts({ tab: {}, sowhat: { u: ['WRONG', 'WRONG', 'OK'] }, product: 'nonexistent-product', date: '2026-08-28' }).has('u') &&
      sowhatActuation(['WRONG', 'WRONG', 'OK'] as SowhatGrade[], 0).action === 'HOLD'
  );
  t('ladder: a single WRONG does not actuate on night 1', L(['WRONG', 'OK', 'OK'], 0).action === 'HOLD');
  t('ladder: all OK holds on any night', L(['OK', 'OK', 'OK'], 0).action === 'HOLD' && L(['OK', 'OK', 'OK'], 99).action === 'HOLD');
  t(
    'ladder: mixed MISSING+WRONG counts as failed for the unanimous bar',
    L(['MISSING', 'WRONG', 'MISSING'], 0).action === 'REDRAFT'
  );
  t('item6a: an ungraded unit is HOLD with an explicit NOT GRADED reason — never a silent pass', L([], 0).action === 'HOLD' && /NOT GRADED/.test(L([], 0).reason));
  t('ladder window is 7 nights', SOWHAT_LADDER_NIGHTS === 7);

  // ── CLAIM-UNDRAFTED POLICY (owner ruling 2026-08-20, decision 2) ──────────
  t('overlapScore is 1.0 when the claim is fully contained', overlapScore('alpha beta gamma', 'alpha beta gamma delta') === 1);
  t('overlapScore is 0 on disjoint content', overlapScore('alpha beta', 'zulu yankee') === 0);
  t('overlapScore ignores stopwords, so "the of and" cannot manufacture a match', overlapScore('the of and', 'zulu yankee') === 0);

  const MD =
    '## S\n- **alpha widget** the alpha widget shipped tuesday\n\n- **charlie widget** the charlie widget shipped friday\n';
  const CANDS = [
    { section: 'S', start: MD.indexOf('- **alpha'), end: MD.indexOf('\n\n- **charlie') },
    { section: 'S', start: MD.indexOf('- **charlie'), end: MD.length },
  ];
  const CL3 = [
    { unit: 'a', section: 'S', claim: 'alpha widget shipped tuesday' },
    { unit: 'b', section: 'S', claim: 'bravo gadget recalled wednesday' },
    { unit: 'c', section: 'S', claim: 'charlie widget shipped friday' },
  ];
  const r3 = pairByLabel(MD, CANDS, CL3);
  t(
    'UNBALANCED section: the MIDDLE claim is named undrafted, not the last — the 2026-08-10 ait-2 bug',
    r3.findings.claimUndrafted.length === 1 && r3.findings.claimUndrafted[0]!.unit === 'b'
  );
  t(
    'UNBALANCED section: the surviving claims keep their OWN prose, never the neighbour\'s',
    r3.units.length === 2 &&
      MD.slice(r3.units[0]!.start, r3.units[0]!.end).includes('alpha') &&
      MD.slice(r3.units[1]!.start, r3.units[1]!.end).includes('charlie')
  );
  t('every claim in an unbalanced section reports a score', r3.scores.length === 3);

  const CL2 = [
    { unit: 'a', section: 'S', claim: 'totally unrelated words here' },
    { unit: 'c', section: 'S', claim: 'nothing in common at all' },
  ];
  const r2 = pairByLabel(MD, CANDS, CL2);
  t(
    'BALANCED section pairs in document order and NEVER consults content — a low score cannot drop a unit',
    r2.units.length === 2 && r2.findings.claimUndrafted.length === 0 && r2.scores.length === 0
  );

  const r1 = pairByLabel(MD, CANDS, [{ unit: 'a', section: 'S', claim: 'alpha widget shipped tuesday' }]);
  t('prose with no claim row is named PROSE-UNCLAIMED, never silently graded', r1.findings.proseUnclaimed.length === 1);

  t(
    'normLabel absorbs the 08-10/08-19 convention drift: "Dashboard / Equities" == "Dashboard/Equities"',
    normLabel('Dashboard / Equities') === normLabel('Dashboard/Equities')
  );
  t(
    'normLabel absorbs a trailing parenthetical: "Intro Summary" == "Intro Summary (payoff)"',
    normLabel('Intro Summary') === normLabel('Intro Summary (payoff)')
  );
  t('normLabel does NOT collapse two genuinely different sections', normLabel('Dashboard/Crypto') !== normLabel('Dashboard/Equities'));

  // ── RULING 2: ranked flags ────────────────────────────────────────────────
  const RANKED =
    'U1: 3 | AK: x402 (STANDALONE, BLOCKING); jargon-y phrase (CARRYABLE, MINOR) | REF: "it" → UNKNOWN (BLOCKING)';
  t('flagStats counts every item across both passes', flagStats(RANKED).total === 3);
  t('flagStats splits BLOCKING from MINOR', flagStats(RANKED).blocking === 2 && flagStats(RANKED).minor === 1);
  t('flagStats reports per-unit', flagStats(RANKED + '\nU2: 1 | AK: — | REF: —').perUnit === 1.5);
  t('an empty pass contributes no items', flagStats('U1: 0 | AK: — | REF: —').total === 0);
  t(
    'an UNRANKED item is counted and named, never quietly binned as minor',
    flagStats('U1: 1 | AK: x402 (STANDALONE) | REF: —').unranked === 1
  );
  t(
    'a pre-v3 transcript is NOT reported as zero flags — that is the permissive error',
    flagStats(V2).preV3 === 1 && flagLine(flagStats(V2)).includes('NOT COMPUTABLE')
  );
  t('a ranked transcript does report a rate', flagLine(flagStats(RANKED)).includes('/unit'));
  t('v4 template ranks: BLOCKING and MINOR both defined', /BLOCKING/.test(ASSUMED_KNOWLEDGE_TEMPLATE) && /MINOR/.test(ASSUMED_KNOWLEDGE_TEMPLATE));
  t(
    'v4 template makes an unresolved referent BLOCKING by definition',
    /referent you had to guess at is BLOCKING/i.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );
  t(
    'v4 template guards against everything-is-blocking, which would un-rank the list',
    /Most items should be MINOR/i.test(ASSUMED_KNOWLEDGE_TEMPLATE)
  );

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
    `  ASSUMED_KNOWLEDGE_HASH ${sha(ASSUMED_KNOWLEDGE_TEMPLATE)}  [v4 two-pass + ranked · advisory · actuates nothing]`
  );
  if (!fail) console.log('SCRIPT-OK');
  return fail ? 1 : 0;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
// 🔴 DIRECT-INVOCATION GUARD (2026-08-28). The CLI dispatch below used to run at module top level,
// so `import { … } from './transmission-readback.ts'` EXECUTED it — printing usage and calling
// process.exit(2) in the importer. That made the exported arithmetic untestable from outside the
// file and, worse, made this module unsafe for any other script to depend on. The guard is a
// no-op for every real caller: `npx tsx scripts/transmission-readback.ts <cmd>` still matches.
const INVOKED_DIRECTLY = !!process.argv[1] && process.argv[1].includes('transmission-readback');
const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter(x => x.startsWith('--'));
const prod = flags.find(x => x.startsWith('--product='))?.split('=')[1] ?? '';
if (prod) PRODUCT_SUFFIX = `-${prod}`;
const positional = rawArgs.filter(x => !x.startsWith('--'));
const cmd = rawArgs[0]?.startsWith('--') ? rawArgs[0] : positional[0];
const a = positional[1];
const b = positional[2];
if (INVOKED_DIRECTLY) switch (cmd) {
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
  case 'calibration': {
    // The weekly one-liner (item 6c) + the thrash guard (item 6d). Emitting n=0 is a valid receipt.
    const rowsAll: Record<string, unknown>[] = fs.existsSync(LEDGER)
      ? JSON.parse(fs.readFileSync(LEDGER, 'utf-8'))
      : [];
    const prod = PRODUCT_SUFFIX.replace('-', '') || 'light';
    const mine = rowsAll.filter(r => (r['product'] ?? 'light') === prod);
    console.log(sowhatAgreement(mine as { owner_mark?: unknown; sowhat_grades?: unknown }[]).line);
    const perNight = Object.entries(
      mine.reduce<Record<string, number>>((acc, r) => {
        if (r['final'] === 'REDRAFTED' || r['cycle']) acc[String(r['date'])] = (acc[String(r['date'])] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([date, rewrites]) => ({ date, rewrites }));
    console.log(sowhatThrash(perNight).line);
    process.exit(0);
    break;
  }
  case 'assemble':
    if (!a) die('usage: assemble <DATE>');
    cmdAssemble(a);
    break;
  case 'dirty':
    if (!a || !b)
      die('usage: dirty <DATE> <published.md> [--mark] [--product=full]');
    process.exit(cmdDirty(a, b, flags.includes('--mark')));
  // eslint-disable-next-line no-fallthrough
  case 'sowhat':
    if (!a) die('usage: sowhat <DATE> [--product=full]   — ensemble of 3 graders + actuation ladder');
    process.exit(cmdSowhat(a));
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
      '  prepare <light.md> <claims.json> | check <DATE> | panel <DATE> | sowhat <DATE> | calibration | tabulate <DATE> | assemble <DATE> | ledger <DATE> | dirty <DATE> <published.md> [--mark] | akcheck <DATE> | --selftest'
    );
    console.log(
      '  --product=full routes state to .readback/<DATE>-full/ so the full brief and the light never collide.'
    );
    process.exit(2);
}
