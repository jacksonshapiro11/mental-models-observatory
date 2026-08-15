/**
 * selection-judge.ts — mechanical half of the SELECTION grading loop. NEVER CALLS A MODEL.
 *
 * Phase one measured whether a unit's meaning ARRIVED (the read-back loop). Phase two asks whether
 * the meaning was worth arriving. This asks the question underneath both: SHOULD THIS ITEM HAVE BEEN
 * PICKED AT ALL? A unit can transmit perfectly, be finished as a thought, and still be the wrong
 * thing to have spent a slot on.
 *
 * Same architecture as scripts/transmission-readback.ts, on purpose:
 *   1. FROZEN PROMPT + HASH. The judge template has interpolation slots and nothing else. Its hash
 *      prints on every run; a changed hash is a declared recalibration event.
 *   2. THE SCRIPT NEVER JUDGES. It segments, assembles the blind packet, validates the returned
 *      verdicts against the grammar, and writes the ledger. Judgment is a model's job elsewhere.
 *   3. APPEND-ONLY LEDGER with denominators printed. A zero is a claim and prints what it searched.
 *   4. ADVISORY. Exit is 0 unless --strict. Nothing here blocks, rewrites, or touches a live pass.
 *
 * BLINDNESS RULE (the whole validity of the instrument): the judge sees the STANDARD, the SHIPPED
 * ARTIFACT, the PRIOR CORPUS and the TAKE LEDGER. It never sees generator rationale — no
 * daily-briefs/*-v1.md, no take-draft, no quality-gate log, no critic file, no predraft manifest.
 * A judge that reads why we picked something is grading our reasoning, not our selection.
 *
 * WHAT IT GRADES, per unit:
 *   (a) BELIEF-CHANGE — the judge states in ONE sentence what a reader should now believe that they
 *       did not believe before. If it cannot write that sentence, the unit is NO-STAKES.
 *   (b) REPETITION — the unit advances a prior take/thesis, or it is a REPEAT. Checked against the
 *       take-ledger's structural moves and the prior-lead corpus, not word overlap.
 *   (c) REACH — a claim that stretches beyond its evidence must pay with a transferable mechanism.
 *       If it stretches and does not pay, UNPAID-REACH.
 *
 * VERDICTS: SOUND · REPEAT · UNPAID-REACH · NO-STAKES.
 *
 * Usage:
 *   node --experimental-strip-types scripts/selection-judge.ts prepare <brief.md> [--priors N]
 *   node --experimental-strip-types scripts/selection-judge.ts record  <DATE>
 *   node --experimental-strip-types scripts/selection-judge.ts tally   <DATE>
 *   node --experimental-strip-types scripts/selection-judge.ts --selftest
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const SEL_DIR = '.selection';
const LEDGER = 'system/selection-ledger.json';
const STANDARD = 'system/Selection_Standard.md';
const TAKE_LEDGER = 'system/take-ledger.json';
const ARCHIVE = 'content/daily-updates';
const PRIOR_DAYS_DEFAULT = 30;
const LEAD_CHARS = 170;

/** 🔴 FROZEN. Slots: {standard} {artifact} {priors} {takemoves} {takehistory}. Changing this text
 *  changes the hash and invalidates any calibration run against it. */
const JUDGE_TEMPLATE = `You are grading SELECTION, not writing. You did not write this brief and you will never see why any item was chosen. Judge only what is on the page.

Here is the standard you grade against.

---STANDARD---
{standard}

Here is every lead sentence this publication has run in the recent past. Use it to decide whether an item is new work or a re-run.

---PRIOR LEADS---
{priors}

Here are the structural moves The Take has already used, and its recent history. A move repeated inside the window is a repeat even when the topic is different.

---TAKE MOVES---
{takemoves}

---TAKE HISTORY---
{takehistory}

Here is today's shipped brief. Each unit is prefixed with its id in square brackets.

---ARTIFACT---
{artifact}

---

For EACH unit id, answer three questions in order, then give one verdict.

(a) BELIEF-CHANGE. Write ONE sentence: what should a reader now believe that they did not believe before reading this unit? Write the sentence, do not describe it. If you cannot write that sentence — because the unit reports something without asking the reader to change any belief — say NO-STAKES and stop.

(b) REPETITION. Does this advance a prior thesis, or re-run it? Name the prior lead or the take move it repeats if it repeats. Same topic with a new fact is an UPDATE and is fine. Same claim, or the same structural move inside the window, is a REPEAT.

(c) REACH. Does the unit claim more than its evidence carries? If it does, it must pay with a mechanism a reader could carry to a different situation. Stretch with a transferable mechanism is SOUND. Stretch without one is UNPAID-REACH.

VERDICT, exactly one of: SOUND · REPEAT · UNPAID-REACH · NO-STAKES.

Output one JSON object and nothing else, keyed by unit id:
{"<unit-id>": {"verdict": "...", "belief_change": "<your one sentence, or empty for NO-STAKES>", "repetition_of": "<prior lead or move id, or empty>", "reach": "<the transferable mechanism, or why it is unpaid, or empty>", "note": "<optional, one line>"}}`;

type Unit = {
  id: string;
  section: string;
  lead: string;
  fingerprint: string;
  start: number;
  end: number;
  sha: string;
};
type Verdict = 'SOUND' | 'REPEAT' | 'UNPAID-REACH' | 'NO-STAKES';
type Row = {
  verdict: Verdict;
  belief_change?: string;
  repetition_of?: string;
  reach?: string;
  note?: string;
};

const sha = (s: string): string =>
  crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
const die = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};
const selPath = (date: string, ...p: string[]): string =>
  path.join(SEL_DIR, date, ...p);
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** 🔴 A LEAD SENTENCE IS NOT ENOUGH TO SEE A RE-RUN. Measured: the 2026-08-01 hydro-relicensing
 *  thesis and its 2026-08-14 re-run share no lead wording at all — the word "relicensing" appears
 *  only in their bodies and in one `**Watch:**` block. A leads-only corpus is blind to the exact
 *  repetition class this instrument exists to catch. So each prior unit also carries a fingerprint:
 *  the named actors and the load-bearing figures, which is what a repeated thesis actually repeats.
 *  Shape borrowed from the standing CARRY fix ("grep the load-bearing entities + figures"). */
export function fingerprint(text: string): string {
  const body = text.replace(/\*\*/g, ' ');
  const proper =
    body.match(
      /\b(?:[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3}|[A-Z]{2,6})\b/g
    ) ?? [];
  const figures =
    body.match(
      /\b\d[\d,.]*\s?(?:percent|%|GW|MW|bn|billion|million|trillion|bp|basis points)\b/gi
    ) ?? [];
  const STOP = new Set([
    'The',
    'This',
    'That',
    'These',
    'Those',
    'And',
    'But',
    'For',
    'With',
    'From',
    'Their',
    'There',
    'What',
    'When',
    'Where',
    'Which',
    'While',
    'Watch',
    'Every',
    'Human',
    'One',
    'Two',
    'Three',
    'Its',
    'It',
    'A',
    'An',
    'US',
    'U.S.',
  ]);
  const seen = new Set<string>();
  const keep: string[] = [];
  for (const p of [...proper, ...figures]) {
    const k = p.trim();
    if (STOP.has(k) || k.length < 2) continue;
    const low = k.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    keep.push(k);
    if (keep.length >= 14) break;
  }
  return keep.join('; ');
}

// ── SEGMENTATION ──────────────────────────────────────────────────────────────
/** 🔴 DELIBERATE COPY, NOT A SHARED IMPORT. transmission-readback.ts segments the LIGHT brief by
 *  bold-led blocks; the full brief's Six bullets are list items (`- **lead**`) and that segmenter
 *  returns one unit per Six section, which is wrong here. Factoring one segmenter out of both is the
 *  right end state and it touches shipping code, which this work order forbids — so it is a CARRY
 *  row, and this comment is the receipt. If these two ever disagree about the same artifact, that
 *  disagreement is the defect.
 *
 *  A SELECTION UNIT IS A THING SOMEBODY CHOSE TO SPEND A SLOT ON. The Dashboard is data, not a
 *  choice, and is excluded. `**Watch:**` continues its Signal item and is not its own unit. */
export function selectionUnits(md: string): Unit[] {
  const out: Unit[] = [];
  const majors = [...md.matchAll(/^#\s*▸\s*(.+)$/gm)];
  const push = (section: string, id: string, start: number, end: number) => {
    const text = md.slice(start, end).replace(/\s+$/, '');
    if (text.trim().length < 40) return;
    const lead = (text.match(/\*\*(.+?)\*\*/)?.[1] ?? text)
      .replace(/\s+/g, ' ')
      .trim();
    out.push({
      id,
      section,
      lead,
      fingerprint: fingerprint(text),
      start,
      end: start + text.length,
      sha: sha(text),
    });
  };

  for (let i = 0; i < majors.length; i++) {
    const m = majors[i]!;
    const name = m[1]!.trim();
    const from = m.index! + m[0]!.length;
    const to = i + 1 < majors.length ? majors[i + 1]!.index! : md.length;
    const body = md.slice(from, to);
    if (/dashboard/i.test(name)) continue; // data, not selection

    if (/the six/i.test(name)) {
      const subs = [...body.matchAll(/^##(?!#)\s*(.+)$/gm)];
      for (let j = 0; j < subs.length; j++) {
        const s = subs[j]!;
        const sname = s[1]!.trim();
        const sf = s.index! + s[0]!.length;
        const st = j + 1 < subs.length ? subs[j + 1]!.index! : body.length;
        const sbody = body.slice(sf, st);
        // Signal items are bold blocks; every other Six section is `- **lead**` list items.
        const isSignal = /signal/i.test(sname);
        // 🔴 `**Watch:**` is FOLDED INTO its Signal item, not dropped. Dropping it threw away the
        // named instruments and datasets a Signal is built on — and those are exactly the tokens a
        // re-run of the same thesis repeats. Caught by the known-answer case: the 08-01 relicensing
        // thesis carries FERC and Oak Ridge only in its Watch block.
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
        const items = raws.filter(x => !/^\*\*Watch:/i.test(x[0]!));
        items.forEach((it, k) =>
          push(
            sname,
            `${isSignal ? 'signal' : 'six:' + slug(sname)}:${k + 1}`,
            from + sf + it.index!,
            from + sf + it.index! + it[0]!.length
          )
        );
      }
      continue;
    }
    push(name, slug(name), from, from + body.length);
  }
  return out;
}

// ── PRIOR CORPUS ──────────────────────────────────────────────────────────────
/** Every lead this publication has run in the window, one per line, so the judge can see a re-run
 *  for what it is. Built mechanically from the PUBLISHED archive — the reader surface, not a draft. */
export function buildPriors(
  excludeDate: string,
  days: number,
  archive = ARCHIVE
): { lines: string[]; files: string[] } {
  if (!fs.existsSync(archive)) return { lines: [], files: [] };
  const files = fs
    .readdirSync(archive)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    // 🔴 STRICTLY EARLIER, not merely "not today". On a nightly run the distinction never shows up
    // because there is no future on disk; on a RETRO run there is, and a judge handed a later brief
    // will happily call an item a repeat of something published after it. Caught building the retro.
    .filter(f => f.slice(0, 10) < excludeDate)
    .slice(0, days)
    .reverse();
  const lines: string[] = [];
  for (const f of files) {
    const md = fs.readFileSync(path.join(archive, f), 'utf-8');
    for (const u of selectionUnits(md))
      lines.push(
        `${f.slice(0, 10)} · ${u.id} · ${u.lead.slice(0, LEAD_CHARS)}${u.fingerprint ? `  ⟨${u.fingerprint}⟩` : ''}`
      );
  }
  return { lines, files };
}

// ── COMMANDS ──────────────────────────────────────────────────────────────────
function cmdPrepare(briefPath: string, priorDays: number): void {
  if (!fs.existsSync(briefPath)) die(`brief not found: ${briefPath}`);
  const date = path.basename(briefPath).slice(0, 10);
  const md = fs.readFileSync(briefPath, 'utf-8');
  const units = selectionUnits(md);
  if (!units.length)
    die(
      `SEGMENTED 0 UNITS from ${briefPath}. A brief with no selectable units means the markup changed and this parser is now blind. Nothing is graded from this state.`
    );
  if (!fs.existsSync(STANDARD))
    die(`${STANDARD} is missing. The judge has nothing to grade against.`);

  const { lines, files } = buildPriors(date, priorDays);
  const tl = fs.existsSync(TAKE_LEDGER)
    ? JSON.parse(fs.readFileSync(TAKE_LEDGER, 'utf-8'))
    : { _moves: {}, history: [] };
  const moves = Object.entries(tl._moves ?? {})
    .map(([k, v]) => `${k} — ${v}`)
    .join('\n');
  const hist = (tl.history ?? [])
    .slice(-priorDays)
    .map(
      (h: Record<string, unknown>) =>
        `${h.date} · ${h.title} · move=${h.move} · form=${h.title_form}`
    )
    .join('\n');

  // The artifact the judge sees is the SHIPPED bytes with unit ids prefixed. Nothing else.
  let tagged = '',
    cursor = 0;
  for (const u of units) {
    tagged +=
      md.slice(cursor, u.start) + `[${u.id}] ` + md.slice(u.start, u.end);
    cursor = u.end;
  }
  tagged += md.slice(cursor);

  const prompt = JUDGE_TEMPLATE.replace(
    '{standard}',
    fs.readFileSync(STANDARD, 'utf-8')
  )
    .replace('{priors}', lines.join('\n') || '(none)')
    .replace('{takemoves}', moves || '(none)')
    .replace('{takehistory}', hist || '(none)')
    .replace('{artifact}', tagged);

  fs.mkdirSync(selPath(date), { recursive: true });
  fs.writeFileSync(selPath(date, 'units.json'), JSON.stringify(units, null, 2));
  fs.writeFileSync(selPath(date, 'judge-prompt.txt'), prompt);
  fs.writeFileSync(
    selPath(date, 'meta.json'),
    JSON.stringify(
      {
        date,
        source: briefPath,
        units: units.length,
        templateHash: sha(JUDGE_TEMPLATE),
        promptHash: sha(prompt),
        priorFiles: files.length,
        priorLeads: lines.length,
        priorWindowDays: priorDays,
        takeMoves: Object.keys(tl._moves ?? {}).length,
        takeHistory: (tl.history ?? []).length,
      },
      null,
      2
    )
  );
  console.log(
    `✓ PREPARED ${date} — ${units.length} units from ${path.basename(briefPath)}`
  );
  console.log(
    `  priors ${lines.length} leads / ${files.length} nights (window ${priorDays}) · take moves ${Object.keys(tl._moves ?? {}).length} · take history ${(tl.history ?? []).length}`
  );
  console.log(
    `  TEMPLATE_HASH ${sha(JUDGE_TEMPLATE)}   PROMPT_HASH ${sha(prompt)}`
  );
  console.log(
    `  → ${selPath(date, 'judge-prompt.txt')} — give this to the judge and nothing else`
  );
}

const VERDICTS: Verdict[] = ['SOUND', 'REPEAT', 'UNPAID-REACH', 'NO-STAKES'];

/** 🔴 THE GRAMMAR IS THE STANDARD, MECHANISED. A verdict whose evidence is missing is not a verdict. */
export function validate(units: Unit[], v: Record<string, Row>): string[] {
  const errs: string[] = [];
  const ids = new Set(units.map(u => u.id));
  for (const id of ids)
    if (!(id in v)) errs.push(`missing verdict for unit "${id}"`);
  for (const [id, r] of Object.entries(v)) {
    if (!ids.has(id)) errs.push(`verdict names unknown unit "${id}"`);
    if (!VERDICTS.includes(r.verdict))
      errs.push(`${id}: bad verdict "${r.verdict}"`);
    if (r.verdict === 'REPEAT' && !r.repetition_of?.trim())
      errs.push(`${id}: REPEAT with nothing named as the thing repeated`);
    if (r.verdict === 'UNPAID-REACH' && !r.reach?.trim())
      errs.push(`${id}: UNPAID-REACH without saying what went unpaid`);
    if (r.verdict === 'NO-STAKES' && r.belief_change?.trim())
      errs.push(
        `${id}: NO-STAKES but a belief-change sentence was written — pick one`
      );
    if (r.verdict !== 'NO-STAKES' && !r.belief_change?.trim())
      errs.push(`${id}: ${r.verdict} with no belief-change sentence`);
  }
  return errs;
}

/** The judging model is recorded per row. A calibration table that cannot say which judge produced
 *  a verdict cannot be reproduced, and every recalibration after it is arguing from memory. */
function cmdRecord(date: string, model: string, force: boolean): void {
  const units: Unit[] = JSON.parse(
    fs.readFileSync(selPath(date, 'units.json'), 'utf-8')
  );
  const meta = JSON.parse(fs.readFileSync(selPath(date, 'meta.json'), 'utf-8'));
  const vPath = selPath(date, 'verdicts.json');
  if (!fs.existsSync(vPath))
    die(
      `no verdicts at ${vPath}. The judge has not run. Nothing recorded — this is an absence, not a clean sheet.`
    );
  const v: Record<string, Row> = JSON.parse(fs.readFileSync(vPath, 'utf-8'));
  const errs = validate(units, v);
  if (errs.length)
    die(
      `VERDICT GRAMMAR FAILURE — ${errs.length} problem(s):\n   ${errs.join('\n   ')}`
    );

  const ledger = fs.existsSync(LEDGER)
    ? JSON.parse(fs.readFileSync(LEDGER, 'utf-8'))
    : [];
  // 🔴 APPEND-ONLY MEANS ONCE. A retried nightly task would otherwise write a second set of rows for
  // the same night, and every share in every rollup after it would quietly be computed on a doubled
  // denominator. Refuse by default; --force is the deliberate override.
  const already = ledger.filter(
    (r: { date: string }) => r.date === date
  ).length;
  if (already && !force)
    die(
      `${date} ALREADY RECORDED — ${already} row(s) present in ${LEDGER}. Refusing to append a second set. Re-run with --force only if you mean to double-count.`
    );
  for (const u of units) {
    const r = v[u.id]!;
    ledger.push({
      date,
      brief: meta.source,
      unit: u.id,
      section: u.section,
      lead: u.lead.slice(0, LEAD_CHARS),
      verdict: r.verdict,
      belief_change: r.belief_change?.trim() || null,
      repetition_of: r.repetition_of?.trim() || null,
      reach: r.reach?.trim() || null,
      note: r.note?.trim() || null,
      promptHash: meta.promptHash,
      templateHash: meta.templateHash,
      priorLeads: meta.priorLeads,
      judge_model: model || 'UNRECORDED',
      owner_mark: null,
    });
  }
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  console.log(
    `✓ RECORDED ${date} — ${units.length}/${units.length} units written to ${LEDGER} (total ${ledger.length})`
  );
  console.log(`  ${tallyLine(date, units, v)}`);
}

export function tallyLine(
  date: string,
  units: Unit[],
  v: Record<string, Row>
): string {
  const c: Record<string, number> = {};
  for (const u of units) c[v[u.id]!.verdict] = (c[v[u.id]!.verdict] ?? 0) + 1;
  const parts = VERDICTS.filter(k => c[k]).map(k => `${c[k]} ${k}`);
  return `SELECTION: ${units.length} units — ${parts.join(', ') || 'no verdicts'}`;
}

function cmdTally(date: string): void {
  const units: Unit[] = JSON.parse(
    fs.readFileSync(selPath(date, 'units.json'), 'utf-8')
  );
  const v: Record<string, Row> = JSON.parse(
    fs.readFileSync(selPath(date, 'verdicts.json'), 'utf-8')
  );
  console.log(tallyLine(date, units, v));
}

// ── SELFTEST ──────────────────────────────────────────────────────────────────
function selftest(): number {
  let pass = 0,
    fail = 0;
  const t = (name: string, cond: boolean) => {
    if (cond) pass++;
    else {
      fail++;
      console.error(`  ✗ ${name}`);
    }
  };

  const md = [
    '# MARKETS, MEDITATIONS & MENTAL MODELS',
    '',
    '# ▸ THE DASHBOARD',
    '',
    '### Equities',
    'The S&P closed up half a percent on thin volume and nobody chose this sentence.',
    '',
    '# ▸ THE SIX',
    '',
    '## Markets & Macro',
    '',
    '- **Alpha lead sentence here.** Alpha body with enough characters to clear the floor test.',
    '',
    '- **Beta lead sentence here.** Beta body with enough characters to clear the floor test.',
    '',
    '## The Signal',
    '',
    '**Signal one lead sentence.** Signal one body with enough characters to clear the floor.',
    '',
    '**Watch:** this continuation is not its own unit and must never be counted as one.',
    '',
    '# ▸ THE TAKE',
    '',
    '### Some Framework',
    '**Take lead sentence here.** Take body with enough characters to clear the floor test.',
    '',
    '# ▸ THE MODEL',
    '',
    'Model prose long enough to clear the forty character floor for a standalone section.',
    '',
  ].join('\n');

  const u = selectionUnits(md);
  const ids = u.map(x => x.id);
  t(
    'six bullets segment individually',
    ids.filter(i => i.startsWith('six:')).length === 2
  );
  t('signal item segments', ids.includes('signal:1'));
  t('**Watch:** is NOT a unit', !ids.some(i => i === 'signal:2'));
  t('the dashboard is excluded', !ids.some(i => /dashboard/.test(i)));
  t(
    'standalone sections are units',
    ids.includes('the-take') && ids.includes('the-model')
  );
  t(
    'every unit carries a lead',
    u.every(x => x.lead.length > 0)
  );
  t('ids are unique', new Set(ids).size === ids.length);

  // grammar, both directions
  const good: Record<string, Row> = {};
  for (const x of u)
    good[x.id] = {
      verdict: 'SOUND',
      belief_change: 'A reader now believes a new thing.',
    };
  t(
    'a complete, well-formed verdict set validates',
    validate(u, good).length === 0
  );
  const missing = { ...good } as Record<string, Row>;
  delete missing[ids[0]!];
  t(
    'a missing unit is caught',
    validate(u, missing).some(e => e.includes('missing verdict'))
  );
  t(
    'REPEAT with nothing named is caught',
    validate(u, {
      ...good,
      [ids[0]!]: { verdict: 'REPEAT', belief_change: 'x' },
    }).some(e => e.includes('nothing named'))
  );
  t(
    'UNPAID-REACH with no reason is caught',
    validate(u, {
      ...good,
      [ids[0]!]: { verdict: 'UNPAID-REACH', belief_change: 'x' },
    }).some(e => e.includes('unpaid'))
  );
  t(
    'NO-STAKES carrying a belief sentence is caught',
    validate(u, {
      ...good,
      [ids[0]!]: { verdict: 'NO-STAKES', belief_change: 'x' },
    }).some(e => e.includes('pick one'))
  );
  t(
    'a verdict with no belief sentence is caught',
    validate(u, { ...good, [ids[0]!]: { verdict: 'SOUND' } }).some(e =>
      e.includes('no belief-change')
    )
  );
  t(
    'tally counts what it read',
    tallyLine('X', u, good) ===
      `SELECTION: ${u.length} units — ${u.length} SOUND`
  );

  // template discipline
  t(
    'template has one slot each',
    [
      '{standard}',
      '{priors}',
      '{takemoves}',
      '{takehistory}',
      '{artifact}',
    ].every(
      s =>
        (
          JUDGE_TEMPLATE.match(new RegExp(s.replace(/[{}]/g, '\\$&'), 'g')) ??
          []
        ).length === 1
    )
  );

  // 🔴 KNOWN-ANSWER CASE. CARRY row 2026-08-14: the 08-14 Signal re-ran the thesis published on
  // 08-01, thirteen days earlier, and every instrument passed it because none of them reads the
  // register of what we have already argued. `relicens` appears in exactly two published briefs in
  // the whole archive. If the prior corpus built for 08-14 does not surface the 08-01 lead, the
  // judge is blind to that repeat BY CONSTRUCTION and no amount of judgment can recover it.
  const KNOWN = { date: '2026-08-14', prior: '2026-08-01', shared: /FERC/ };
  if (fs.existsSync(path.join(ARCHIVE, `${KNOWN.date}.md`))) {
    const { lines } = buildPriors(KNOWN.date, PRIOR_DAYS_DEFAULT);
    const priorSide = lines.filter(
      l => l.startsWith(KNOWN.prior) && KNOWN.shared.test(l)
    );
    const todaySide = selectionUnits(
      fs.readFileSync(path.join(ARCHIVE, `${KNOWN.date}.md`), 'utf-8')
    ).filter(u => KNOWN.shared.test(u.fingerprint));
    t(
      `KNOWN ANSWER — the ${KNOWN.prior} thesis is in the corpus the ${KNOWN.date} judge reads`,
      priorSide.length > 0
    );
    t(
      `KNOWN ANSWER — the ${KNOWN.date} re-run carries the same load-bearing actor`,
      todaySide.length > 0
    );
    t(
      'KNOWN ANSWER — the target night is excluded from its own priors',
      !lines.some(l => l.startsWith(KNOWN.date))
    );
    t(
      'KNOWN ANSWER — no night later than the target leaks into its priors',
      lines.every(l => l.slice(0, 10) < KNOWN.date)
    );
  } else {
    console.error(
      `  ⚠ known-answer case SKIPPED — ${KNOWN.date} not in the archive`
    );
  }

  console.log(
    `\n${fail ? '✗' : '✓'} selftest ${pass}/${pass + fail} passed  ·  TEMPLATE_HASH ${sha(JUDGE_TEMPLATE)}`
  );
  if (!fail) console.log('SELECTION-OK');
  return fail ? 1 : 0;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
/** Guard so the exported helpers can be imported by a test harness without firing the CLI. */
const INVOKED_DIRECTLY =
  !!process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('selection-judge.ts');
const raw = INVOKED_DIRECTLY ? process.argv.slice(2) : [];
const flags = raw.filter(x => x.startsWith('--'));
const pos = raw.filter(x => !x.startsWith('--'));
const priorDays = Number(
  flags.find(f => f.startsWith('--priors='))?.split('=')[1] ??
    PRIOR_DAYS_DEFAULT
);
if (flags.includes('--selftest')) process.exit(selftest());
switch (INVOKED_DIRECTLY ? pos[0] : '__imported__') {
  case '__imported__':
    break;
  case 'prepare':
    if (!pos[1]) die('usage: prepare <brief.md> [--priors=N]');
    cmdPrepare(pos[1], priorDays);
    break;
  case 'record':
    if (!pos[1]) die('usage: record <DATE> [--model=NAME]');
    cmdRecord(
      pos[1],
      flags.find(f => f.startsWith('--model='))?.split('=')[1] ?? '',
      flags.includes('--force')
    );
    break;
  case 'tally':
    if (!pos[1]) die('usage: tally <DATE>');
    cmdTally(pos[1]);
    break;
  default:
    console.log(
      'selection-judge.ts — mechanical half of the selection loop. Never calls a model.'
    );
    console.log(
      '  prepare <brief.md> [--priors=N] | record <DATE> | tally <DATE> | --selftest'
    );
    process.exit(2);
}
