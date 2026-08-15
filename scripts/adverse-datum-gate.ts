#!/usr/bin/env node --experimental-strip-types
/**
 * adverse-datum-gate.ts — IMP-144 (2026-08-08, RC6). Critic mandate #1, 2026-08-08.
 *
 * THE FAILURE THIS EXISTS FOR. Three bullets in one brief withheld the figure most adverse to
 * their own thesis, and every figure they DID print was true:
 *
 *   M&M-2  argued "87 percent beat … beating has stopped carrying information" and offered The
 *          Trade Desk as its example. TTD MISSED Q2 revenue ($715.1M vs $752.6M consensus, adj.
 *          EPS −17%). The one example offered is not an instance of the phenomenon.
 *   AI&T-2 argued Alphabet's build "has stopped being capex and started being leverage" without
 *          printing TTM free cash flow of ≈ +$53B or ≈ $240B of cash and securities.
 *   M&M-1  argued "the economy lost 920,000 jobs" without printing that private payrolls ROSE
 *          30,000 while government FELL 53,000 — the composition inside its own release.
 *
 * WHY THE EXISTING GATES CANNOT SEE IT. `fact-gate` checks whether printed numbers are true; all
 * of these were. `reaction-symmetry-gate` (IMP-138, built for this defect one night earlier) FAILs
 * only on asymmetric PRICE REACTIONS across ≥2 companies in one bullet, and none of the three has
 * that shape. The class is wider and simpler: **a bullet asserts a directional thesis and does not
 * print the figure that cuts against it.**
 *
 * THE RULE IS A DISCLOSURE REQUIREMENT, NOT A JUDGEMENT. The gate never decides whether a figure
 * is adverse — it cannot know that, and a gate that tried would be a bias detector nobody could
 * calibrate. It asks only: did this bullet, which makes a strong directional claim, disclose a
 * counterweight at all? Two ways to satisfy it, both cheap and both honest:
 *
 *   (a) THE CONTRACT (the strong path): `{DATE}-truth.json` carries a `counterDatum` for the
 *       claim, and the bullet PRINTS that figure. The power is the requirement, not the parsing —
 *       a Writer required to record the strongest opposing figure from its own source cannot
 *       quietly omit it.
 *   (b) THE SELF-DISCLOSURE (the escape hatch): the bullet states its own counter in the open —
 *       "The counter is the same fact read forward: this book has not seen a downturn" (C&C-2,
 *       2026-08-08). A bullet that already does this right is never touched.
 *
 * NO ORPHAN (ESC-013 — E-GATE-INPUT-ORPHAN-01, three gates in one night blocked on inputs no
 * layer emits). The truth-contract leg is ADDITIVE: with no truth file, or no counterDatum rows,
 * the textual leg still operates and the gate is fully functional. It is never waiting on an
 * input nobody writes.
 *
 * Usage: node --experimental-strip-types scripts/adverse-datum-gate.ts <brief.md> [--truth <truth.json>]
 *        node --experimental-strip-types scripts/adverse-datum-gate.ts --selftest
 * Exit:  0 clean · 1 an undisclosed adverse datum · 2 usage error
 * Wired into: system/Brief_Editor.md Gate 1 · system/Markets_Macro_Generator.md ·
 *             system/AI_Tech_Generator.md · system/Companies_Crypto_Generator.md.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface AdverseFinding {
  check:
    | 'adverse-datum'
    | 'adverse-datum-contract'
    | 'series-direction-contradiction';
  severity: 'FAIL' | 'UNRESOLVED-FACT';
  message: string;
  bullet: string;
  thesis: string;
}

/** IMP-131's lesson: never grade the Editor's commentary about a section as if it were the section. */
export function stripHtmlComments(md: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = md.indexOf('<!--', i);
    if (start === -1) {
      out += md.slice(i);
      break;
    }
    out += md.slice(i, start);
    const end = md.indexOf('-->', start);
    const body = end === -1 ? md.slice(start) : md.slice(start, end + 3);
    out += body.replace(/[^\n]/g, ' ');
    if (end === -1) break;
    i = end + 3;
  }
  return out;
}

/**
 * THE TRIGGER. Strong directional claims about a named entity or an aggregate — the shapes the
 * 08-08 Critic named, and no more. Derived from, and measured against, the real 2026-08-08 v2:
 * 3 of 11 bullets trigger, and they are exactly the Critic's three receipts. Widening this beyond
 * "the thesis asserts a state CHANGE or a NEGATION about the world" buys false positives, and
 * every false positive here punishes a bullet for making an argument at all.
 *
 * A BARE "has stopped" IS EXCLUDED, and the reason is a real false positive caught in testing: the
 * 08-08 Wild Card bullet on the Atlantic circulation ("nearly shut down 3.4 million years ago")
 * matched it. That bullet reports a physical process, not a thesis about how the world now works,
 * and there is no adverse datum for it to withhold. The trigger must be the CLAIM SHAPE — a state
 * change asserted about an entity or an aggregate — never the verb alone.
 */
const THESIS_RE =
  /\b(?:has stopped (?:being|carrying|measuring|working|tracking)|stopped being \w+ and started being|is no longer|are no longer|does not measure|do not measure|the economy lost|has become the|is now the only)\b/i;

/**
 * THE ESCAPE HATCH. Explicit counter-disclosure. Deliberately NARROW: these are phrases a writer
 * uses when consciously turning the argument against itself, not connectives that appear in any
 * comparison. "against" and "but" are excluded on purpose — M&M-2 is full of "against" clauses
 * ("87 percent against 82 percent a year ago") and every one of them supports its thesis. The
 * 08-08 M&M-1 bullet contains "stood on the other side of this exact instrument failure", which
 * is a historical aside, not a concession — so "on the other side" is excluded too. A marker that
 * a supporting clause can satisfy is not a counter-disclosure requirement; it is a loophole.
 */
const COUNTER_RE =
  /\b(?:the counter (?:is|to this|here)|counter-case|the countervailing|cuts the other way|cuts against (?:this|it|the thesis)|the bear case|what would falsify|the falsifier|the objection|the case against|the risk to this|argues the other way|to be fair|the strongest figure against)\b/i;

/**
 * SCOPE. The mandate names three generators — Markets & Macro, Companies & Crypto, AI & Tech —
 * plus Geopolitics and the Take, which make the same kind of claim. The Wild Card, Discovery,
 * Model and Inner Game are NOT in scope, and that is not squeamishness: the second false positive
 * caught in testing was the 08-08 Wild Card bullet on Atlantic circulation, which matched
 * "is no longer" while reporting a palaeoclimate finding. There is no withheld market figure in a
 * three-million-year-old ocean current. A disclosure rule aimed at argument should not be pointed
 * at reportage.
 */
const IN_SCOPE_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|THE TAKE|The Take/i;

/** Bullets: a markdown list item that opens with a bold hook, inside an in-scope section.
 *  A fragment with no headings at all (a single bullet handed to the gate, as in the selftest and
 *  in the Editor's per-bullet use) is treated as in scope — the caller has already chosen it. */
export function bullets(body: string): string[] {
  const clean = stripHtmlComments(body);
  const split = (s: string) =>
    s.split(/\n(?=\s*[-*]\s+\*\*)/).filter(b => /^\s*[-*]\s+\*\*/.test(b));
  const lines = clean.split('\n');
  const headingIdx = lines
    .map((l, i) => (/^#{1,6}\s/.test(l) ? i : -1))
    .filter(i => i >= 0);
  if (!headingIdx.length) return split(clean);

  const out: string[] = [];
  for (let k = 0; k < headingIdx.length; k++) {
    const start = headingIdx[k]!;
    const end = k + 1 < headingIdx.length ? headingIdx[k + 1]! : lines.length;
    if (!IN_SCOPE_SECTION_RE.test(lines[start]!)) continue;
    out.push(...split(lines.slice(start + 1, end).join('\n')));
  }
  return out;
}

/** Does this bullet disclose a counter in the open? (Exported so the selftest can prove WHY.) */
export function counterDisclosures(bullet: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(COUNTER_RE.source, 'gi');
  while ((m = re.exec(bullet)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard (IMP-136's class)
    out.push(m[0]);
  }
  return out;
}

/** Every numeric token in a bullet, normalised for comparison against a recorded counterDatum. */
function numerals(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,.]*/g))
    out.add(m[0].replace(/[,]/g, '').replace(/\.0+$/, ''));
  return out;
}

export interface TruthCounter {
  bullet?: string;
  counterDatum?: string;
}

export function adverseDatum(
  body: string,
  truthClaims?: Record<string, TruthCounter> | undefined
): AdverseFinding[] {
  const findings: AdverseFinding[] = [];
  const bs = bullets(body);

  for (const bullet of bs) {
    const t = THESIS_RE.exec(bullet);
    if (!t) continue; // no directional thesis, nothing to counter
    if (counterDisclosures(bullet).length) continue; // the bullet already prints its own counter

    findings.push({
      check: 'adverse-datum',
      severity: 'FAIL',
      message:
        `UNDISCLOSED ADVERSE DATUM — this bullet asserts a directional thesis ("${t[0]}") and prints no counterweight. ` +
        `Either state the strongest figure from your OWN source that cuts against the claim, or say in the open why none exists. ` +
        `2026-08-08 receipts: M&M-2 argued "beating has stopped carrying information" and offered The Trade Desk, which MISSED Q2 revenue ` +
        `($715.1M vs $752.6M consensus) — the one example given was not an instance of the phenomenon; AI&T-2 argued Alphabet's build ` +
        `"has stopped being capex and started being leverage" while TTM free cash flow was still ≈ +$53B on ≈ $240B of cash. ` +
        `Every number in both was TRUE — the omission was the argument. Record it as counterDatum in {DATE}-truth.json and print it.`,
      bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
      thesis: t[0],
    });
  }

  // THE CONTRACT LEG (additive — absent truth rows never disable the gate). Once the Writer has
  // recorded the strongest opposing figure, printing it stops being optional.
  if (truthClaims) {
    for (const [key, row] of Object.entries(truthClaims)) {
      const cd = row?.counterDatum;
      if (!cd) continue;
      const wanted = numerals(cd);
      if (!wanted.size) continue;
      const target = row.bullet
        ? bs.find(b =>
            b.toLowerCase().includes(row.bullet!.toLowerCase().slice(0, 40))
          )
        : undefined;
      const haystack = target ?? stripHtmlComments(body);
      const printed = numerals(haystack);
      const missing = [...wanted].filter(n => !printed.has(n));
      if (missing.length === wanted.size) {
        findings.push({
          check: 'adverse-datum-contract',
          severity: 'FAIL',
          message:
            `RECORDED COUNTER-DATUM NOT PRINTED — {DATE}-truth.json records "${key}" with counterDatum "${cd}", and none of its figures ` +
            `(${[...wanted].join(', ')}) appears in ${target ? 'the bullet it belongs to' : 'the brief'}. The Writer found the number that ` +
            `cuts against the thesis and then left it out of the text. Print it, or withdraw the thesis it contradicts.`,
          bullet: (target ?? '').slice(0, 200).replace(/\s+/g, ' '),
          thesis: key,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// IMP-171 — THE SERIES-DIRECTION LEG (2026-08-14 Critic mandate #1, RC2).
//
// M&M-1 closed on "A market can reprice a rate of change in an afternoon. It cannot reprice a
// level." The level it named — PPI final demand, +4.7% y/y for July — had fallen 80bp from June's
// +5.5% IN THE SAME RELEASE. Every number in the bullet was true; the conclusion was the
// arithmetic inverse of a datum sitting in the bullet's own source. `adverse-datum-gate` EXITED 0,
// because the textual leg triggers on state-change THESES ("has stopped being", "is no longer")
// and a stickiness claim is the opposite shape: it asserts that nothing changed.
//
// A LEVEL YOU CALL STICKY IS A TWO-POINT CLAIM. One point cannot support it. So the leg is:
//   (a) the bullet prints a periodic series value ("4.7 percent over the year", "annualised"), AND
//   (b) it draws a persistence conclusion about that value, AND
//   (c) it does NOT print the prior period's value.
// Resolution against {BRIEF_DATE}-truth.json, which stores periodic series as `<family>-YYYY-MM`:
//   • no prior-period row on disk        → UNRESOLVED-FACT (the Morning Truth Gate resolves it)
//   • prior row exists and the value moved → FAIL (the conclusion contradicts its own series)
//   • the bullet prints the prior value    → SILENT. This is the escape hatch, and it is the whole
//     point: the leg rewards printing the second point rather than punishing any numeral. The
//     08-14 Take is the clean negative — it prints BOTH endpoints of the hold series (7.5% → 10.2%)
//     inside the sentence and takes no finding.
//
// MEASURED, and the reason the acceptance gate below differs from the mandate's wording: by the
// time this session ran, the Morning Truth Gate had already repaired the CONTENT — it added
// `ppi:final-demand-yoy-2026-06` (5.5) and rewrote the published closer to name the fall. So the
// mandate's stated FIRE condition ("no prior-period row on disk") no longer reproduces. The
// contradiction branch does, on the same file, and it is the stronger test: the row exists, the
// series fell, and the frozen v2 closer still calls the level unrepricable.
const SERIES_VALUE_RE =
  /(\d+(?:\.\d+)?)\s*percent\s+(?:over the year|on the year|for the year|year[- ]over[- ]year|y\/y|annualised|annualized|at an annual rate)/gi;

/**
 * Persistence / stickiness conclusions. NARROW on purpose: this must not match ordinary reporting
 * of a level. "the level is falling" is excluded by construction — a bullet that says the level is
 * falling is doing the thing this leg exists to ask for.
 */
const STICKY_RE =
  /\b(?:cannot reprice (?:a|the) level|cannot be repriced|a level takes|levels take|the level (?:is|remains|stays|holds|has not)|remains (?:stuck|elevated|where it|unchanged)|has not budged|does not (?:move|come down)|is not (?:moving|coming down|going anywhere)|stays put|is sticky|remains sticky)\b/i;

export interface SeriesPoint {
  key: string;
  family: string;
  period: string; // YYYY-MM
  value: number;
}

/** Periodic-series rows in a truth file: keys shaped `<family>-YYYY-MM`. Daily price rows
 *  (`price:sp500-close-2026-08-13`, i.e. `-YYYY-MM-DD`) do NOT match and are not series points. */
export function seriesPoints(
  truthClaims?: Record<string, unknown> | undefined
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  if (!truthClaims) return out;
  for (const [key, row] of Object.entries(truthClaims)) {
    const m = /^(.*?)-(\d{4}-\d{2})$/.exec(key);
    if (!m) continue;
    const raw = (row as { value?: unknown })?.value;
    const v = Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(v) || String(raw ?? '') === '') continue;
    out.push({ key, family: m[1]!, period: m[2]!, value: v });
  }
  return out;
}

const norm = (n: number) => String(n).replace(/\.0+$/, '');

export function seriesDirectionContradiction(
  body: string,
  truthClaims?: Record<string, unknown> | undefined
): AdverseFinding[] {
  const findings: AdverseFinding[] = [];
  const byFamily = new Map<string, SeriesPoint[]>();
  for (const p of seriesPoints(truthClaims)) {
    if (!byFamily.has(p.family)) byFamily.set(p.family, []);
    byFamily.get(p.family)!.push(p);
  }
  for (const arr of byFamily.values())
    arr.sort((a, b) => a.period.localeCompare(b.period));

  for (const bullet of bullets(body)) {
    const sticky = STICKY_RE.exec(bullet);
    if (!sticky) continue;
    const vals = [...bullet.matchAll(new RegExp(SERIES_VALUE_RE.source, 'gi'))]
      .map(m => Number(m[1]))
      .filter(n => Number.isFinite(n));
    if (!vals.length) continue; // a stickiness claim with no periodic value is not a two-point claim

    const printed = numerals(bullet);

    // The family whose LATEST recorded point this bullet prints as a periodic value.
    let series: SeriesPoint[] | undefined;
    for (const arr of byFamily.values()) {
      const latest = arr[arr.length - 1]!;
      if (vals.some(v => Math.abs(v - latest.value) < 1e-9)) {
        series = arr;
        break;
      }
    }

    const prior = series && series.length > 1 ? series[series.length - 2] : undefined;

    if (!prior) {
      findings.push({
        check: 'series-direction-contradiction',
        severity: 'UNRESOLVED-FACT',
        message:
          `STICKY LEVEL, ONE POINT — this bullet concludes "${sticky[0]}" about a periodic series it prints as ` +
          `${vals.map(v => `${v} percent`).join(', ')}, and {BRIEF_DATE}-truth.json carries no row for the PRIOR period of that ` +
          `series. A level you call sticky is a two-point claim: print the prior point or do not call it sticky. ` +
          `MORNING GATE: record <series>-YYYY-MM for the prior period and re-run — if the series moved against the ` +
          `conclusion, the closer is the arithmetic inverse of its own source. RECEIPT (2026-08-14 M&M-1): "It cannot ` +
          `reprice a level" shipped over PPI final demand +4.7% y/y, which the SAME BLS release put at +5.5% in June.`,
        bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
        thesis: sticky[0],
      });
      continue;
    }

    const latest = series![series!.length - 1]!;
    if (printed.has(norm(prior.value))) continue; // ESCAPE HATCH — the second point is in the text
    if (Math.abs(prior.value - latest.value) < 1e-9) continue; // genuinely unchanged: sticky is true

    const dir = latest.value < prior.value ? 'FELL' : 'ROSE';
    findings.push({
      check: 'series-direction-contradiction',
      severity: 'FAIL',
      message:
        `SERIES DIRECTION CONTRADICTS THE CONCLUSION — the bullet concludes "${sticky[0]}" about ${latest.key}, and the ` +
        `recorded series ${dir} from ${prior.value} (${prior.period}) to ${latest.value} (${latest.period}). The prior value ` +
        `appears nowhere in the bullet. Either print "${norm(prior.value)}" and rewrite the conclusion to describe the move, ` +
        `or drop the conclusion. Every number here can be true while the sentence is the arithmetic inverse of its own source ` +
        `— that is exactly what shipped on 2026-08-14.`,
      bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
      thesis: sticky[0],
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// IMP-175 — THE ARTIFACT-CONCLUSION RAIL (2026-08-15 Critic mandate #3, RC2).
//
// THE FAILURE: 08-15 M&M-1 concluded that the July retail-sales print was a calendar artifact
// ("it is sitting on a calendar", "inside a confidence interval that includes zero") while
// withholding the LEAD FINDING OF ITS OWN WIRE — Reuters led that release with economists
// slashing Q3 growth estimates. Every figure in the bullet verified. The unit was true and
// rhetorically one-sided, which is the failure mode no truth gate can see.
//
// THE RULE: if a bullet concludes that a data release is an ARTIFACT of measurement or the
// calendar, it must carry at least one sentence attributing a NON-ARTIFACT reading to a named
// forecaster, wire or institution. Otherwise the reader gets one side of a two-sided release.
//
// SEVERITY IS UNRESOLVED-FACT, NEVER FAIL — by design. Whether a competing reading exists is a
// question for the Morning Truth Gate, which has a browser. The evening does not, and the brief
// always ships (the ESC-013 orphan-input discipline).
//
// NARROWNESS IS THE WHOLE DESIGN. The mandate's vocabulary list includes the bare word
// "measurement", and 08-15 M&M-2 — a REQUIRED SILENT case — contains "Robin Brooks made the
// measurement Friday". A word list would have fired on the clean unit. So the trigger is a list of
// artifact CONCLUSIONS, not artifact words.
const ARTIFACT_CONCLUSION_RE =
  /\b(?:sit(?:s|ting)\s+on\s+a\s+calendar|confidence\s+interval\s+that\s+includes\s+zero|seasonal\s+adjustment|(?:is|was|were|are)\s+payback\b|payback\s+for\b|measurement\s+artifact|calendar\s+artifact|an\s+artifact\s+of\s+(?:the\s+)?(?:calendar|measurement|timing|comparison)|a\s+timing\s+(?:artifact|distortion|effect)|(?:the\s+)?(?:same\s+)?distortion\s+runs\s+in\s+reverse)\b/i;

// The escape hatch, proved on a real unit: 08-15 Geo-1 carries "which TP ICAP's Scott Shelton
// reads as a risk premium rather than tighter fundamentals". A NAMED entity plus an
// INTERPRETATION verb. Reporting verbs ("put", "ran", "made", "said") are deliberately excluded —
// M&M-1 contains "The Census Bureau put the drop against a consensus" and "Amazon ran Prime Day",
// and neither is a competing reading of what the print means.
const ATTRIBUTED_READING_RE =
  /\b[A-Z][A-Za-z.&'’-]*(?:\s+[A-Z][A-Za-z.&'’-]*){0,3}(?:'s|’s)?\s+(?:\w+\s+){0,3}?(?:reads?|calls?|argues?|warns?|blames?|attributes?|slashed|slash|cutting|forecasts?|expects?|estimates?)\b/;

export function artifactConclusionRail(body: string): AdverseFinding[] {
  const findings: AdverseFinding[] = [];
  for (const bullet of bullets(body)) {
    const hit = ARTIFACT_CONCLUSION_RE.exec(bullet);
    if (!hit) continue;
    if (ATTRIBUTED_READING_RE.test(bullet)) continue; // ESCAPE HATCH — a competing read is in the open
    findings.push({
      check: 'artifact-conclusion-unattributed',
      severity: 'UNRESOLVED-FACT',
      message:
        `ARTIFACT CONCLUSION WITH NO ATTRIBUTED COUNTER-READING — this bullet concludes the release is an ` +
        `artifact of measurement or the calendar ("${hit[0]}") and no sentence in it attributes a NON-artifact ` +
        `reading to a named forecaster, wire or institution. Every figure can verify and the unit still ships ` +
        `one side of a two-sided release. MORNING GATE: find what the release's own wire led with; if a named ` +
        `economist or institution read it as signal rather than noise, print that read and let the artifact ` +
        `argument answer it. RECEIPT (2026-08-15 M&M-1): "it is sitting on a calendar" shipped while Reuters led ` +
        `the same release with economists slashing third-quarter growth estimates — a fact the bullet never met. ` +
        `ESCAPE HATCH (2026-08-15 Geo-1): "which TP ICAP's Scott Shelton reads as a risk premium rather than ` +
        `tighter fundamentals" — one attributed sentence discharges this rail.`,
      bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
      thesis: hit[0],
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// IMP-177 — THE SCHEDULE-SEQUENCE RAIL (2026-08-15 Critic mandate #1, RC2).
//
// THE FAILURE: 08-15 C&C-3 closed "When the depreciation schedule ends before the lease begins,
// the bitcoin has stopped being treasury and become construction financing." Riot's own filing puts
// the first 96 IT MW in DECEMBER 2027 and the depreciation running to 2029 — the lease begins ~18
// months BEFORE the depreciation ends. The sentence was the arithmetic inverse of its own source.
// Seven other figures in the unit verified exactly, and `adverse-datum-gate` exited 0: IMP-171's
// series leg fires on PERSISTENCE claims, and a SEQUENCING claim over two dated events is a
// different shape.
//
// THE RULE: a sequencing claim is a two-date claim. The sentence that asserts the ORDER must print
// a date. Zero dates in the ordering sentence means the claim cannot be checked by anyone —
// including the writer, which is how the inverse shipped.
//
// THE THRESHOLD IS ≥1 IN-SENTENCE DATE, and that is a deliberate, receipted choice rather than the
// doc rule's "print both". It is exactly what separates the shipped defect from its repair:
//   v1.5 (shipped defect): "When the depreciation schedule ends before the lease begins, …"  → 0 dates
//   v2   (morning repair): "The lease begins in December 2027, before the depreciation ends, …" → 1 date
// A bullet-scoped date count would have passed the DEFECT, because the same bullet prints 2026,
// 2027 and 2029 in the depreciation table three sentences earlier. KNOWN LIMIT: a one-date ordering
// sentence can still invert. That residual is what the truth-row leg below is for, and it is
// recorded here rather than hidden.
const SEQ_VERB =
  String.raw`(?:end|ends|ended|expire|expires|expired|begin|begins|began|start|starts|started|commence|commences|commenced|lapse|lapses|lapsed|mature|matures|matured|close|closes|closed|open|opens|opened|run\s+off|runs\s+off|run\s+out|runs\s+out|deliver|delivers|delivered|deploy|deploys|deployed|land|lands|landed|arrive|arrives|arrived|tax|taxed|apply|applies|applied|due|effective|sign|signs|signed|signing|vote|votes|voted|take\s+effect|takes\s+effect)`;

/** An ORDERING claim: a schedule verb, then before/after/until/by the time, then a second schedule verb. */
const SEQ_CLAIM_RE = new RegExp(
  String.raw`\b${SEQ_VERB}\b[^.;]{0,80}?\b(?:before|after|ahead\s+of|by\s+the\s+time|until|prior\s+to)\b[^.;]{0,80}?\b${SEQ_VERB}\b`,
  'i'
);

/** A printed calendar date: a month name, or a bare four-digit year, or ISO. */
const DATE_TOKEN_RE =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\b|\b(?:19|20)\d{2}\b|\b\d{4}-\d{2}-\d{2}\b/;

/** Sentence split that tolerates the bold lead and decimal figures well enough for this rail. */
function sentences(bullet: string): string[] {
  return bullet
    .replace(/\*\*/g, '')
    .split(/(?<=[.!?])\s+(?=[A-Z“"(])/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function scheduleSequenceContradiction(
  body: string,
  truthClaims?: Record<string, unknown> | undefined
): AdverseFinding[] {
  const findings: AdverseFinding[] = [];
  // Recorded schedule dates, if the Morning Truth Gate has any: `scheduled-event:*` / `schedule:*`
  // rows carrying a resolvable date. Absent rows never block — the rail degrades to advisory.
  const recorded: string[] = [];
  for (const [key, row] of Object.entries(truthClaims ?? {})) {
    if (!/^(?:scheduled-event|schedule|delivery|lease|maturity):/i.test(key)) continue;
    const v = String((row as { value?: unknown })?.value ?? '');
    if (DATE_TOKEN_RE.test(v)) recorded.push(`${key}=${v}`);
  }

  for (const bullet of bullets(body)) {
    for (const s of sentences(bullet)) {
      const claim = SEQ_CLAIM_RE.exec(s);
      if (!claim) continue;
      if (DATE_TOKEN_RE.test(s)) continue; // ESCAPE HATCH — the ordering sentence is dated
      findings.push({
        check: 'schedule-sequence-undated',
        severity: 'UNRESOLVED-FACT',
        message:
          `UNDATED SEQUENCING CLAIM — this sentence asserts an ORDER between two scheduled events ` +
          `("${claim[0].replace(/\s+/g, ' ').slice(0, 120)}") and prints no date for either. A sequencing claim is a ` +
          `two-date claim: print the dates in the sentence that makes the ordering claim, or do not claim the order. ` +
          `MORNING GATE: record each event as a schedule row and re-run — if the recorded order contradicts the ` +
          `asserted order, this escalates to FAIL. ` +
          (recorded.length
            ? `RECORDED SCHEDULE ROWS AVAILABLE: ${recorded.slice(0, 4).join(' · ')}. `
            : `NO schedule rows recorded for this brief, so the order cannot be checked mechanically tonight. `) +
          `RECEIPT (2026-08-15 C&C-3, shipped in v1.5): "When the depreciation schedule ends before the lease ` +
          `begins" — Riot's own filing puts the first 96 IT MW in December 2027 against depreciation running to ` +
          `2029, so the lease begins about eighteen months BEFORE the depreciation ends. The closer was the ` +
          `arithmetic inverse of the issuer's schedule and seven other figures in the unit verified exactly.`,
        bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
        thesis: claim[0].replace(/\s+/g, ' ').slice(0, 120),
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
function sectionBlock(body: string, heading: RegExp): string | null {
  const lines = stripHtmlComments(body).split('\n');
  const start = lines.findIndex(l => /^#{1,6}\s/.test(l) && heading.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(l => /^#{1,6}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function pickBullet(
  body: string,
  heading: RegExp,
  pick: (b: string) => boolean
): string | null {
  const block = sectionBlock(body, heading);
  if (block === null) return null;
  return bullets(block).find(pick) ?? null;
}

function selftest(): number {
  const root = process.cwd();
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  const v2Path = path.join(root, 'daily-briefs/2026-08-08-v2.md');
  if (!fs.existsSync(v2Path)) {
    console.error(`SELFTEST FAIL — missing fixture: ${v2Path}`);
    return 1;
  }
  const v2 = fs.readFileSync(v2Path, 'utf8');

  // ── FIRE, on the two bullets the Critic's acceptance gate names, off the real file. ──
  const mm2 = pickBullet(
    v2,
    /Markets\s*&\s*Macro/i,
    b => /87 percent/.test(b) && /Trade Desk/.test(b)
  );
  t(
    !!mm2,
    '[fixture] the real M&M-2 "87 percent beat" bullet was located in 2026-08-08-v2.md'
  );
  t(
    mm2 ? adverseDatum(mm2).length === 1 : false,
    'FIRES on the REAL M&M-2 — thesis "has stopped carrying", no counterweight (TTD missed Q2 revenue)'
  );

  const ait2 = pickBullet(
    v2,
    /AI\s*&\s*Tech/i,
    b => /Alphabet/.test(b) && /free cash flow/i.test(b)
  );
  t(
    !!ait2,
    '[fixture] the real AI&T-2 Alphabet free-cash-flow bullet was located'
  );
  t(
    ait2 ? adverseDatum(ait2).length === 1 : false,
    'FIRES on the REAL AI&T-2 — "has stopped being capex and started being leverage", no TTM FCF or cash printed'
  );

  // The Critic named a third receipt; it is not in the acceptance gate, but it must not escape.
  const mm1 = pickBullet(v2, /Markets\s*&\s*Macro/i, b =>
    /Nonfarm payrolls/.test(b)
  );
  t(
    mm1 ? adverseDatum(mm1).length === 1 : false,
    'FIRES on the REAL M&M-1 — "the economy lost 920,000 jobs" with no private/government composition'
  );
  t(
    mm1 ? counterDisclosures(mm1).length === 0 : false,
    '…and for the RIGHT reason: "stood on the other side of" is a historical aside, not a counter-disclosure'
  );

  // ── SILENT, on the two the Critic says already do it right. ──
  const cc2 = pickBullet(
    v2,
    /Companies\s*&\s*Crypto/i,
    b => /Grab/.test(b) && /lending/.test(b)
  );
  t(!!cc2, '[fixture] the real C&C-2 Grab lending bullet was located');
  t(
    cc2 ? adverseDatum(cc2).length === 0 : false,
    'SILENT on the real C&C-2 (Grab), which prints its own counter'
  );
  t(
    cc2 ? counterDisclosures(cc2).length > 0 : false,
    '…and the escape hatch is what does it: "The counter is the same fact read forward" is detected'
  );

  const signal = sectionBlock(v2, /The Signal/i);
  t(
    signal ? adverseDatum(signal).length === 0 : false,
    'SILENT on the real Signal-1, which prints exposure on both sides'
  );

  // ── WHOLE-BRIEF FIRE RATE. A gate that fires on a third of the brief every night gets ignored.
  const all = adverseDatum(v2);
  t(
    all.length === 3,
    `whole-brief fire rate on the real 08-08 v2 is exactly the Critic's 3 receipts (got ${all.length})`
  );
  t(
    bullets(v2).length >= 7,
    `[fixture] the gate scanned every IN-SCOPE bullet: ${bullets(v2).length} of 11 (Wild Card excluded by design)`
  );
  const wild = sectionBlock(v2, /Wild Card/i);
  t(
    wild ? adverseDatum(`## The Wild Card\n${wild}`).length === 0 : false,
    'SILENT on the whole real Wild Card section — "is no longer" about a 3.4-million-year-old ocean current is reportage, not a withheld figure'
  );

  // ── THE MINIMAL PAIR: identical bullets differing ONLY by the disclosed counter.
  const bare =
    '- **A hook.** The build has stopped being capex and started being leverage, and the guide went up again.';
  const withCounter =
    bare +
    ' The counter is that trailing free cash flow is still positive at $53 billion.';
  t(
    adverseDatum(bare).length === 1,
    'FIRES on the minimal pair without a counter'
  );
  t(
    adverseDatum(withCounter).length === 0,
    'SILENT on the same sentence once the counter is printed (the fix)'
  );

  // ── THE CONTRACT LEG, both directions, and its graceful degradation (ESC-013).
  //     The minimal pair here differs ONLY in whether the RECORDED figure reaches the page: both
  //     bullets satisfy the textual leg (each prints a counter), so only the contract leg can move.
  const truthRow = {
    'ait-2': {
      bullet: 'A hook.',
      counterDatum: 'TTM free cash flow +$53 billion',
    },
  };
  const counterButNotTheFigure =
    '- **A hook.** The build has stopped being capex and started being leverage. The counter is that the balance sheet is still unusually strong.';
  const contractFinds = adverseDatum(counterButNotTheFigure, truthRow);
  t(
    contractFinds.length === 1 &&
      contractFinds[0]!.check === 'adverse-datum-contract',
    'CONTRACT: a recorded counterDatum ($53B) that never reaches the page FAILS, even though the bullet prints A counter'
  );
  const printedBullet =
    '- **A hook.** The build has stopped being capex. The counter is trailing free cash flow of $53 billion.';
  t(
    adverseDatum(printedBullet, truthRow).length === 0,
    'CONTRACT: …and passes once that same recorded figure is printed'
  );
  t(
    adverseDatum(counterButNotTheFigure, undefined).length === 0,
    'NO ORPHAN: with NO truth file the same bullet is CLEAN — the contract is additive, never a blocker (ESC-013)'
  );
  t(
    adverseDatum(bare, {}).length === 1,
    'NO ORPHAN: an EMPTY truth object does not disable the textual leg'
  );

  // -------------------------------------------------------------------------
  // IMP-171 — THE SERIES-DIRECTION LEG, proved in BOTH directions on the real 2026-08-14 files.
  const v2_0814 = path.join(root, 'daily-briefs', '2026-08-14-v2.md');
  const pub_0814 = path.join(root, 'content', 'daily-updates', '2026-08-14.md');
  const truth_0814 = path.join(root, 'daily-briefs', '2026-08-14-truth.json');
  if (fs.existsSync(v2_0814) && fs.existsSync(truth_0814)) {
    const claims = JSON.parse(fs.readFileSync(truth_0814, 'utf8'))?.claims;
    const fired = seriesDirectionContradiction(
      fs.readFileSync(v2_0814, 'utf8'),
      claims
    );
    t(
      fired.length === 1 && fired[0]!.severity === 'FAIL',
      'BITES: 08-14 v2 M&M-1 — "It cannot reprice a level" over PPI 4.7% y/y while the recorded series fell from 5.5 (June) → 1 FAIL'
    );
    t(
      /5\.5 \(2026-06\) to 4\.7 \(2026-07\)/.test(fired[0]?.message ?? ''),
      'THE FINDING NAMES BOTH POINTS — a gate that says "contradicts" without printing the two values is unactionable'
    );
    if (fs.existsSync(pub_0814)) {
      t(
        seriesDirectionContradiction(
          fs.readFileSync(pub_0814, 'utf8'),
          claims
        ).length === 0,
        'ESCAPE HATCH WORKS: the PUBLISHED 08-14 M&M-1 prints "down from 5.5 percent in June" and takes no finding — the leg rewards the second point'
      );
    }
    // Clean negatives from the SAME brief, so the leg cannot be tuned to fire on every numeral.
    const takeBullet = bullets(fs.readFileSync(v2_0814, 'utf8')).find(b =>
      /7\.5[\s\S]{0,120}10\.2|10\.2[\s\S]{0,120}7\.5/.test(b)
    );
    if (takeBullet)
      t(
        seriesDirectionContradiction(takeBullet, claims).length === 0,
        'SILENT on the 08-14 Take — it prints BOTH endpoints of the hold series in the sentence'
      );
    else t(true, '(08-14 Take two-endpoint bullet not located — assertion skipped)');
    t(
      seriesDirectionContradiction(
        '- **A level.** Producer prices ran 4.7 percent over the year and the level remains elevated.',
        {}
      ).length === 1,
      'NO-TRUTH BRANCH: a stickiness conclusion on a one-point series with an empty truth file returns UNRESOLVED-FACT, never silence'
    );
    t(
      seriesDirectionContradiction(
        '- **No stickiness claim.** Producer prices ran 4.7 percent over the year and the month was flat.',
        claims
      ).length === 0,
      'NOT A NUMERAL DETECTOR: the same series value with NO persistence conclusion takes no finding'
    );
  } else {
    for (let i = 0; i < 6; i++)
      t(false, 'SELFTEST FAIL — missing 2026-08-14 fixture for the series leg');
  }

  // -------------------------------------------------------------------------
  // IMP-175 — THE ARTIFACT-CONCLUSION RAIL, on the 2026-08-15 Critic's own four acceptance cases.
  const v2_0815 = path.join(root, 'daily-briefs', '2026-08-15-v2.md');
  const v15_0815 = path.join(root, 'daily-briefs', '2026-08-15-v1.5.md');
  if (fs.existsSync(v2_0815)) {
    const b0815 = fs.readFileSync(v2_0815, 'utf8');
    const mm1 = bullets(b0815).find(b => /sitting on a calendar/i.test(b));
    const mm2b = bullets(b0815).find(b => /Robin Brooks made the measurement/i.test(b));
    const geo1 = bullets(b0815).find(b => /Scott Shelton reads as a risk premium/i.test(b));

    t(
      !!mm1 && artifactConclusionRail(mm1).length === 1,
      'FIRES: 08-15 M&M-1 — artifact conclusion ("sitting on a calendar") with zero attributed counter-reading → 1 UNRESOLVED-FACT'
    );
    t(
      !!mm1 && artifactConclusionRail(mm1)[0]?.severity === 'UNRESOLVED-FACT',
      'NEVER BLOCKING: the artifact rail emits UNRESOLVED-FACT, never FAIL — the evening has no browser'
    );
    t(
      !!mm2b && artifactConclusionRail(mm2b).length === 0,
      'SILENT: 08-15 M&M-2 — contains "made the measurement" but concludes about PRICING; a bare-word list would have fired here, the conclusion list does not'
    );
    t(
      !!geo1 && artifactConclusionRail(geo1).length === 0,
      'SILENT: 08-15 Geo-1 — no artifact conclusion (silent on the vocabulary leg, not the escape hatch; the escape hatch is proved on the next assertion)'
    );
    // THE ESCAPE HATCH, PROVED — not asserted. Real defective prose + the real Geo-1 attribution
    // clause must go silent. Without this the Geo-1 negative above is vacuous, which is exactly the
    // failure the 08-15 Critic named in its own acceptance specs.
    t(
      !!mm1 &&
        !!geo1 &&
        artifactConclusionRail(
          `${mm1!.replace(/\s+$/, '')} The drop is one reading, which TP ICAP's Scott Shelton reads as a genuine demand slowdown rather than a calendar effect.`
        ).length === 0,
      'ESCAPE HATCH PROVED: the SAME firing M&M-1 prose plus one real attributed counter-reading goes SILENT'
    );

    // IMP-177 — THE SCHEDULE-SEQUENCE RAIL, fire case re-pointed to v1.5.
    // THE MORNING TRUTH GATE ERASED THE MANDATE'S NAMED FIRE CASE at 05:10 today: v2's closer was
    // rewritten to "The lease begins in December 2027, before the depreciation ends". Testing
    // against v2 would produce a green run proving nothing. The shipped defect survives in v1.5.
    if (fs.existsSync(v15_0815)) {
      const b15 = fs.readFileSync(v15_0815, 'utf8');
      const cc3_defect = bullets(b15).find(b =>
        /depreciation schedule ends before the lease begins/i.test(b)
      );
      t(
        !!cc3_defect && scheduleSequenceContradiction(cc3_defect, {}).length === 1,
        'FIRES: 08-15 v1.5 C&C-3 — "the depreciation schedule ends before the lease begins" prints no date in the ordering sentence → 1 finding'
      );
      t(
        !!cc3_defect &&
          scheduleSequenceContradiction(cc3_defect, {})[0]?.check ===
            'schedule-sequence-undated',
        'THE FINDING NAMES THE ORDERING CLAUSE — a sequencing gate that will not quote the clause is unactionable'
      );
      // BULLET-SCOPED WOULD HAVE PASSED THE DEFECT. This is the assertion that proves the design
      // choice: the same bullet prints 2026, 2027 and 2029 in its depreciation table.
      t(
        !!cc3_defect && /\b2029\b/.test(cc3_defect!) && /\b2027\b/.test(cc3_defect!),
        'SCOPE PROOF: the defective bullet DOES print 2027 and 2029 elsewhere — a bullet-scoped date count would have exited 0 on the shipped inversion'
      );
    } else {
      for (let i = 0; i < 3; i++)
        t(false, 'SELFTEST FAIL — missing 2026-08-15-v1.5.md fixture for the schedule-sequence leg');
    }

    const cc3_repaired = bullets(b0815).find(b =>
      /lease begins in December 2027, before the depreciation ends/i.test(b)
    );
    t(
      !!cc3_repaired && scheduleSequenceContradiction(cc3_repaired, {}).length === 0,
      'SILENT on the REPAIR: v2 C&C-3 dates the ordering sentence ("December 2027") — the rail rewards the date, and the morning fix is not re-condemned'
    );
    const geo2 = bullets(b0815).find(b => /Finished imports are taxed 21 days after signing/i.test(b));
    t(
      !!geo2 && SEQ_CLAIM_RE.test('Finished imports are taxed 21 days after signing, which is 3 September.'),
      'NON-VACUOUS NEGATIVE, PART 1: 08-15 Geo-2 genuinely CONTAINS an ordering claim ("taxed 21 days after signing")'
    );
    t(
      !!geo2 && scheduleSequenceContradiction(geo2, {}).length === 0,
      'NON-VACUOUS NEGATIVE, PART 2: 08-15 Geo-2 is SILENT because that ordering sentence prints "3 September" — the escape hatch, on a real unit in the same brief'
    );

    // NO STORM — the Critic capped both rails across the 08-09…08-14 window.
    let artifactHits = 0;
    let seqHits = 0;
    for (const d of [
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
    ]) {
      const p = path.join(root, 'daily-briefs', `${d}-v2.md`);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      artifactHits += artifactConclusionRail(raw).length;
      seqHits += scheduleSequenceContradiction(raw, {}).length;
    }
    t(
      artifactHits <= 2,
      `NO STORM (artifact rail): ${artifactHits} finding(s) across 08-09…08-14 v2 — the Critic's cap is ≤2`
    );
    t(
      seqHits <= 1,
      `NO STORM (sequence rail): ${seqHits} finding(s) across 08-09…08-14 v2 — the Critic's cap is ≤1`
    );
  } else {
    for (let i = 0; i < 12; i++)
      t(false, 'SELFTEST FAIL — missing 2026-08-15-v2.md fixture for the 08-15 mandate legs');
  }

  const total = 37;
  console.log(
    `\nadverse-datum-gate selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ adverse-datum-gate verified in BOTH directions on the real 2026-08-08 v2.'
  );
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const briefPath = args.find(a => !a.startsWith('--'));
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error(
      'usage: adverse-datum-gate.ts <brief.md> [--truth <truth.json>]'
    );
    return 2;
  }
  const ti = args.indexOf('--truth');
  let truthPath: string | undefined;
  if (ti > -1 && args[ti + 1] && fs.existsSync(args[ti + 1]!)) {
    truthPath = args[ti + 1]!;
  } else {
    // IMP-171 AUTO-DISCOVERY. The Editor and the QG call this gate as `adverse-datum-gate <brief>`
    // with no --truth flag, so a leg that only works behind a flag is a leg that never runs. Derive
    // {BRIEF_DATE}-truth.json from the brief's own filename, exactly as fact-gate does.
    const d = /(\d{4}-\d{2}-\d{2})/.exec(path.basename(briefPath))?.[1];
    const guess = d
      ? path.join(path.dirname(briefPath), `${d}-truth.json`)
      : undefined;
    const alt = d ? path.join('daily-briefs', `${d}-truth.json`) : undefined;
    truthPath = [guess, alt].find(p => p && fs.existsSync(p));
  }
  let truthClaims: Record<string, TruthCounter> | undefined;
  if (truthPath) {
    try {
      truthClaims = JSON.parse(fs.readFileSync(truthPath, 'utf8'))?.claims;
    } catch {
      truthClaims = undefined;
    }
  }
  const raw = fs.readFileSync(briefPath, 'utf8');
  const findings = [
    ...adverseDatum(raw, truthClaims),
    ...seriesDirectionContradiction(raw, truthClaims),
    ...artifactConclusionRail(raw), // IMP-175 — 08-15 mandate #3
    ...scheduleSequenceContradiction(raw, truthClaims), // IMP-177 — 08-15 mandate #1
  ];
  console.log(
    `adverse-datum-gate — ${path.basename(briefPath)}${truthPath ? ` · truth: ${path.basename(truthPath)}` : ' · no truth file'}`
  );
  const fails = findings.filter(f => f.severity === 'FAIL');
  const unresolved = findings.filter(f => f.severity === 'UNRESOLVED-FACT');
  for (const f of fails)
    console.error(`  ✗ [${f.check}] ${f.message}\n      "${f.bullet}"`);
  for (const f of unresolved)
    console.error(
      `  UNRESOLVED-FACT: [${f.check}] ${f.message}\n      "${f.bullet}"`
    );
  if (fails.length) {
    console.error(
      `\n❌ ADVERSE-DATUM FAIL — ${fails.length} bullet(s) assert a thesis without disclosing what cuts against it.` +
        (unresolved.length ? ` (+${unresolved.length} UNRESOLVED-FACT)` : '')
    );
    return 1;
  }
  if (unresolved.length) {
    // Never blocking: an absent prior-period row is a question for the Morning Truth Gate, which
    // has a browser. The evening does not, and the brief always ships.
    console.log(
      `\n✅ ADVERSE-DATUM PASS — ${unresolved.length} UNRESOLVED-FACT routed to the Morning Truth Gate.`
    );
    return 0;
  }
  console.log(
    '\n✅ ADVERSE-DATUM PASS — every directional thesis prints its counterweight.'
  );
  return 0;
}

// Only take over the process when RUN, not when IMPORTED.
if (/adverse-datum-gate\.ts$/.test(process.argv[1] ?? '')) process.exit(main());
