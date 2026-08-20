#!/usr/bin/env node --experimental-strip-types
/**
 * assembly-gate.ts — the PAYOFF gate (reworked 2026-07-10, Ceiling Doctrine v0.5 §4/§9).
 *
 * HISTORY: this gate formerly enforced convergence-threading ("a throughline named in the
 * Intro must recur in >=2 section bodies"). That model is RETIRED — E-CONVERGENCE-ASSEMBLY-01
 * is CLOSED-SUPERSEDED. Honest closure: threading produced the best tracked day (07-09,
 * mechanism-level) AND chronic forced-refrain failures (June 22/27); Jackson's 07-10 ruling
 * relocated the synthesis to the Intro Summary (the payoff) — written LAST from the finished
 * sections, placed FIRST, never echoed through bodies. The mechanism-finding survives in the
 * QG's FRESH-FRAME SWEEP, which this gate still audits (IMP-025, kept verbatim).
 *
 * What it checks now (ALL advisory — exit 0 always; the Editor's Gate 14 and the Critic act
 * on findings; ceiling-lint.ts covers the brief-text-only intro counterfeits):
 *   1. LEFTOVER MARKER — a `<!-- throughline: ... -->` marker in the brief is a stale-spec
 *      artifact; it should be stripped (nothing reads it anymore).
 *   2. PAYOFF CLASS CONSISTENCY (QG log) — a THEME/INVENTORY class with action=none-needed
 *      violates PASS 1g step 4 (the rewrite is mandatory); a MECHANISM/TENSION class with no
 *      PAYOFF EXECUTION line means the gate was identified-not-executed. (validate-brief.ts
 *      carries the hard-fail twin of these; this advisory copy also runs in self-heal paths.)
 *   3. FRESH-FRAME SWEEP COMPLETENESS (QG log; IMP-025 mandate #3, 2026-07-10, unchanged) —
 *      a FRESH-FRAME SCAN whose candidate accounting never references the Signals AND the
 *      Take under-swept: candidates must be tested across the FULL brief before rejection
 *      ("concentration" was missed exactly this way on 06-30 and 07-10).
 *
 * Usage:
 *   node --experimental-strip-types scripts/assembly-gate.ts <brief.md>
 *   node --experimental-strip-types scripts/assembly-gate.ts --selftest   # exit 0/1
 *
 * Exit codes: 0 pass/flags-only (always, outside selftest) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

interface Finding {
  severity: 'FLAG';
  message: string;
}

// ---------- 1. Leftover throughline marker (retired grammar) ----------
function checkLeftoverMarker(brief: string): string | null {
  const m = brief.match(/<!--\s*throughline:[^>]*-->/i);
  if (!m) return null;
  return `Leftover throughline marker found (${m[0].slice(0, 60)}…): the convergence-threading grammar was RETIRED 2026-07-10 — nothing reads this marker. Strip it from the brief (the synthesis lives in the Intro Summary payoff now).`;
}

// ---------- 2. Payoff class consistency (QG log) ----------
function checkPayoffClass(qg: string): string[] {
  const out: string[] = [];
  if (!qg.trim()) return out;
  // Legacy drift: retired synthesis designation executed.
  if (qg.includes('SYNTHESIS DESIGNATION:') && !qg.includes('not triggered')) {
    out.push(
      `QG log contains an executed SYNTHESIS DESIGNATION — the body-threading gate was retired 2026-07-10. The QG ran a stale spec; reload system/Novelty_Audit.md (PASS 1g PAYOFF CHECK).`
    );
  }
  const payoffLine = qg.match(/PAYOFF CLASS:\s*([^\n]*)/i);
  if (!payoffLine) return out; // old-format or absent log — validate-brief owns presence rules
  const line = payoffLine[1];
  const cls = /MECHANISM/i.test(line)
    ? 'MECHANISM'
    : /TENSION/i.test(line)
      ? 'TENSION'
      : /THEME/i.test(line)
        ? 'THEME'
        : /INVENTORY/i.test(line)
          ? 'INVENTORY'
          : 'UNKNOWN';
  const noRewrite =
    /action\s*=\s*\[?\s*(none-needed|already payoff-grade)/i.test(line);
  if ((cls === 'THEME' || cls === 'INVENTORY') && noRewrite) {
    out.push(
      `PAYOFF CLASS is ${cls} with action=none-needed/already-payoff-grade — PASS 1g step 4 requires the rewrite. A label or inventory may not stand as the intro's conclusion; rewrite to the sweep's MECHANISM/TENSION candidate or the parallel-tracks lead.`
    );
  }
  if (
    (cls === 'MECHANISM' || cls === 'TENSION') &&
    !/PAYOFF EXECUTION:/i.test(qg)
  ) {
    out.push(
      `PAYOFF CLASS is ${cls} but no 'PAYOFF EXECUTION:' line exists — identified, not executed (classify → rewrite-if-owed → verify watch → log).`
    );
  }
  return out;
}

// ---------- 2b. PAYOFF-CLASS TRANSCRIPTION CONSISTENCY (IMP-176 — 08-15 Critic mandate #2, RC3) ----------
//
// THE FAILURE: on 08-15 the QG emitted `PAYOFF CLASS: MECHANISM`, having overruled the Writer's
// self-declared TENSION ("Shipped intro classified: THEME. The Writer self-declared TENSION; I
// disagree" … "1 intro conclusion rewritten (THEME → MECHANISM)"). The reader-bound v2 then asserted
// TENSION in TWO places — line 231 "Tonight is a TENSION, rotating off two consecutive MECHANISMs"
// and line 300, an Editor validation block written 14 minutes AFTER the QG log, "assembly-gate …
// PASS (payoff class TENSION…)". So the ONLY rotation receipt on disk was false, and it concealed a
// THIRD consecutive MECHANISM (08-13, 08-14, 08-15).
//
// THE TRAP THIS MUST NOT FALL INTO: QG logs quote PRIOR nights' classes in a rotation history block
// (`08-11: PAYOFF CLASS: MECHANISM`). The existing `checkPayoffClass` takes the FIRST match in the
// file, so on a night whose QG log has no own emission it would read a history line as tonight's
// class and condemn a clean brief. 2026-08-12 is exactly that file. Own-emission discrimination is
// therefore the load-bearing part of this leg, not a nicety.
const PAYOFF_HISTORY_PREFIX_RE = /(?:\b\d{2}-\d{2}\b|\b\d{4}-\d{2}-\d{2}\b)\s*:\s*$/;

const classOf = (s: string): string | null =>
  /MECHANISM/i.test(s)
    ? 'MECHANISM'
    : /TENSION/i.test(s)
      ? 'TENSION'
      : /THEME/i.test(s)
        ? 'THEME'
        : /INVENTORY/i.test(s)
          ? 'INVENTORY'
          : null;

/** The QG's OWN payoff-class emission for that night — never a quoted history line. */
export function qgOwnPayoffClass(qg: string): string | null {
  for (const line of qg.split('\n')) {
    const idx = line.search(/PAYOFF CLASS:/i);
    if (idx === -1) continue;
    // Strip markdown noise from the prefix, then reject a `MM-DD:` / `YYYY-MM-DD:` history stamp.
    const prefix = line.slice(0, idx).replace(/[`*_>\s-]+$/g, '').trimEnd();
    if (PAYOFF_HISTORY_PREFIX_RE.test(prefix + ':')) continue;
    if (/^\s*(?:\d{2}-\d{2}|\d{4}-\d{2}-\d{2})\s*:/.test(line.replace(/^[\s`*_>-]+/, ''))) continue;
    const cls = classOf(line.slice(idx));
    if (cls) return cls;
  }
  return null;
}

/** Payoff-class assertions made by the BRIEF itself, in payoff-class contexts only. */
export function briefPayoffClassAssertions(brief: string): Array<{ line: number; cls: string; text: string }> {
  const out: Array<{ line: number; cls: string; text: string }> = [];
  const lines = brief.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    // Scoped, per the mandate: `payoff class <CLASS>` or `Tonight is a <CLASS>`. A bare mention of
    // the word MECHANISM in prose is not a class assertion.
    const m =
      /payoff\s+class[^A-Za-z]{0,4}(MECHANISM|TENSION|THEME|INVENTORY)\b/i.exec(l) ??
      /\bTonight\s+is\s+an?\s+(MECHANISM|TENSION|THEME|INVENTORY)\b/i.exec(l);
    if (m) out.push({ line: i + 1, cls: m[1]!.toUpperCase(), text: l.trim().slice(0, 180) });
  }
  return out;
}

export function checkPayoffClassConsistency(brief: string, qg: string): string[] {
  const own = qgOwnPayoffClass(qg);
  if (!own) return []; // nothing authoritative to compare against — validate-brief owns presence
  const out: string[] = [];
  for (const a of briefPayoffClassAssertions(brief)) {
    if (a.cls === own) continue;
    out.push(
      `PAYOFF CLASS TRANSCRIBED AGAINST THE QG — the quality gate emitted PAYOFF CLASS: ${own}, and the ` +
        `reader-bound brief asserts ${a.cls} at line ${a.line}: "${a.text}". The Editor may not transcribe a ` +
        `payoff class it did not read from the QG's emitted PAYOFF CLASS: line, and must strike any pre-QG ` +
        `class declaration the QG overruled. A rotation receipt that names the wrong class is worse than no ` +
        `receipt: it certifies the rotation that did not happen. RECEIPT (2026-08-15): QG emitted MECHANISM ` +
        `after overruling the Writer's TENSION; v2 asserted TENSION twice, concealing a third consecutive ` +
        `MECHANISM (08-13, 08-14, 08-15).`
    );
  }
  return out;
}

/** ROTATION LEG — three consecutive identical payoff classes is a device the reader has now met thrice. */
export function checkPayoffRotation(
  briefDate: string,
  readQgForDate: (d: string) => string | null
): string | null {
  const prev = (d: string, back: number): string => {
    const dt = new Date(`${d}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - back);
    return dt.toISOString().slice(0, 10);
  };
  const chain: Array<{ d: string; cls: string }> = [];
  for (let back = 0; back <= 6 && chain.length < 3; back++) {
    const d = prev(briefDate, back);
    const qg = readQgForDate(d);
    if (!qg) continue;
    const cls = qgOwnPayoffClass(qg);
    if (cls) chain.push({ d, cls });
  }
  if (chain.length < 3) return null;
  if (!chain.every(c => c.cls === chain[0]!.cls)) return null;
  return (
    `PAYOFF DEVICE UNROTATED — three consecutive payoff classes are ${chain[0]!.cls} ` +
    `(${chain.map(c => `${c.d}=${c.cls}`).reverse().join(' · ')}). The rotation rule exists because a reader who ` +
    `meets the same closing device three mornings running stops reading it as a conclusion. Draft the intro to a ` +
    `different class, or state in the QG log why this one earned a third run.`
  );
}

// ---------- 3. Fresh-frame sweep completeness (IMP-025, kept verbatim) ----------
// E-CONVERGENCE-ASSEMBLY-01 lesson (now serving the payoff): before settling for THEME/NONE,
// the QG's FRESH-FRAME SCAN must consider mechanism candidates across the FULL brief. On
// 07-10 (and June 30) the scan UNDER-SWEPT "concentration": it scoped the candidate to the
// C&C cluster (SK Hynix / DTCC / Hyperliquid) and never tested Signal-1 (revenue) or
// Signal-2 (grid capacity), where the Critic found the SAME pattern → the concentration
// MECHANISM was missed twice. PROXY: when a FRESH-FRAME SCAN block is present it must
// reference BOTH a Signal and the Take in its candidate accounting. Advisory FLAG; the
// Editor acts on it and the Critic judges whether a real mechanism exists.
function freshFrameScanBlock(qg: string): string | null {
  const lines = qg.split('\n');
  const i = lines.findIndex(l => /FRESH-FRAME SCAN/i.test(l));
  if (i === -1) return null;
  const out: string[] = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (/^#{1,6}\s/.test(l)) break; // next header ends the block
    if (/^\s*-\s+\*\*CONVERGENCE\b/i.test(l)) break; // next labelled QG line ends it
    if (/^\s*-\s+\*\*PAYOFF\b/i.test(l)) break; // new-grammar labelled line ends it too
    out.push(l);
    if (out.join('\n').length > 2500) break; // scan blocks are short; cap runaway
  }
  return out.join('\n');
}
function checkFreshFrameSweep(qg: string): string | null {
  if (!qg.trim()) return null;
  const block = freshFrameScanBlock(qg);
  if (!block) return null; // no fresh-frame scan present (not a THEME/NONE day, or older format) -> silent
  const lc = block.toLowerCase();
  const sweepsSignal = /\bsignal/.test(lc);
  const sweepsTake = /\btake\b/.test(lc);
  if (sweepsSignal && sweepsTake) return null; // full-brief sweep evident -> silent
  const missing = [
    !sweepsSignal ? 'the Signals' : null,
    !sweepsTake ? 'the Take' : null,
  ]
    .filter(Boolean)
    .join(' and ');
  return `FRESH-FRAME SCAN under-swept: its candidate accounting never references ${missing}. A mechanism candidate (especially "concentration/saturation") must be tested across the FULL brief — the Six + both Signals + the Take — before it is rejected for insufficient span. On 07-10 concentration was scoped to the C&C cluster and the Signal-1 (revenue) and Signal-2 (grid) instances were missed — the 2nd miss of the concentration frame (June 30 was the 1st). Sweep the Signals and the Take, then re-classify.`;
}

// ---------- 4. PAYOFF SCOPE BINDING (IMP-167 — 08-13 Critic mandate #3, RC5) ----------
//
// WORKED FAILURE, 2026-08-13, live on the reader surface. THE INTRO INVENTED A GEOGRAPHY:
//   INTRO "the interceptor inventory standing behind GULF ENERGY INFRASTRUCTURE is down about
//          two thirds since February"
//   GEO-2 "American forces fired about fifty Patriot interceptors in a single day"  ← no region
//   NYT (the bullet's own sourcing): the ~50-interceptor day was the defence of THREE US BASES
//          IN JORDAN against Iranian drone and missile waves.
//   Measured: `Gulf` intro=1 body=0. `Jordan` intro=0 body=0. The payoff's causal middle —
//   interceptors → GULF ENERGY → crude premium — had its middle link supplied by the intro alone.
//
// WHY NOTHING CAUGHT IT — THE SEQUENCING, NOT THE WRITER. Ceiling_Doctrine §4: the Intro Summary
// is "written LAST from the finished sections." Every truth gate (fact-gate, QG Gate 1, Editor
// Gate 1) had already run on the body. This gate checked the payoff's CLASS, WATCH and
// non-inventory — its STRUCTURE — and nothing checked its FACTS. **The brief's most-read five
// sentences were the only five that passed through no verification layer at all.**
//
// THE CHECK: every proper noun / place name / scope noun appearing in the Intro Summary or the
// Daily Title must appear in at least one body section, or carry a `payoff-scope:<term>` row in
// `{BRIEF_DATE}-truth.json`. A term that appears ONCE, in the intro, is a NEW CLAIM. Advisory
// FLAG → UNRESOLVED-FACT at the Morning Truth Gate; never blocking, the brief always ships.
const PAYOFF_SCOPE_EFFECTIVE_FROM = '2026-08-13'; // IMP-125: no retroactive condemnation.

// Terms that are capitalised for grammar or house style, not for scope. Every entry here is a
// deliberate blindness and has to earn its place — an over-long stoplist is how this check would
// become decorative.
const SCOPE_STOP = new Set(
  (
    'the a an and or but if then so that this these those there their it its is are was were be been ' +
    'monday tuesday wednesday thursday friday saturday sunday ' +
    'january february march april may june july august september october november december ' +
    'markets meditations mental models dashboard six take inner game model discovery wild card signal ' +
    'equities commodities rates crypto watch today tomorrow yesterday week month year quarter ' +
    'i you we they he she who what when where why how one two three four five six seven eight nine ten'
  ).split(/\s+/)
);

/** The Intro Summary: the italic block between the H3 Daily Title and the first `---`/`▸` rule. */
function introBlock(brief: string): string {
  const titleM = brief.match(/^###\s+.+$/m);
  if (!titleM) return '';
  const start = (titleM.index ?? 0) + titleM[0].length;
  const rest = brief.slice(start);
  const endM = rest.match(/^(?:---|#\s*▸)/m);
  return rest.slice(0, endM ? endM.index : Math.min(rest.length, 4000));
}

function dailyTitle(brief: string): string {
  const m = brief.match(/^###\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/** Body = everything from the first `▸` section rule onward, comments stripped. */
function bodyAfterIntro(brief: string): string {
  const m = brief.match(/^#\s*▸/m);
  const body = m ? brief.slice(m.index) : brief;
  return body.replace(/<!--[\s\S]*?-->/g, '');
}

export function checkPayoffScope(
  brief: string,
  briefDate: string | null,
  truthTerms: Set<string> = new Set()
): string[] {
  if (briefDate && briefDate < PAYOFF_SCOPE_EFFECTIVE_FROM) return [];
  const intro = introBlock(brief).replace(/<!--[\s\S]*?-->/g, '');
  const title = dailyTitle(brief);
  if (!intro.trim() && !title) return [];
  const body = bodyAfterIntro(brief).toLowerCase();
  const out: string[] = [];

  // Proper nouns: a capitalised token NOT at the start of a sentence, so ordinary sentence-initial
  // capitalisation never becomes a scope claim. Multi-word runs collapse to their head term.
  // A TITLE-CASE headline capitalises every word, so capitalisation there carries no scope
  // information — measured, both directions: scanning 08-10's "Buy The Dip" and 08-11's title
  // yielded `Dip` and `Zero` as false positives against a mandate that requires SILENCE on both
  // nights. The title's real exposure is its NUMERAL (the leg below), which is what the 08-13
  // receipt actually names. A sentence-case title is still scanned.
  const titleWords = title.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  const titleIsTitleCase =
    titleWords.length > 1 &&
    titleWords.filter(w => /^[A-Z]/.test(w)).length / titleWords.length >= 0.6;
  const unbound = new Set<string>();
  for (const src of [titleIsTitleCase ? '' : title, intro]) {
    for (const m of src.matchAll(/([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)/g)) {
      const run = m[0];
      const atStart =
        m.index === 0 || /[.!?]\s+$|^\s*$|[*_]\s*$/.test(src.slice(0, m.index));
      for (const tok of run.split(/\s+/)) {
        const lc = tok.toLowerCase();
        if (SCOPE_STOP.has(lc)) continue;
        if (atStart && run.split(/\s+/).length === 1) continue;
        if (truthTerms.has(lc)) continue;
        if (body.includes(lc)) continue;
        unbound.add(tok);
      }
    }
  }
  if (unbound.size) {
    out.push(
      `PAYOFF SCOPE UNBOUND — [${[...unbound].join(', ')}] appear(s) in the Daily Title / Intro Summary and in NO body section. ` +
        `The intro is written LAST, after every truth gate has run on the body, so a term that appears ONCE and only in the intro is a NEW CLAIM that passed through no verification layer. ` +
        `2026-08-13 receipt: the intro placed the interceptor inventory behind "GULF energy infrastructure" (Gulf intro=1, body=0) when the sourced ~50-interceptor day was the defence of three US bases in JORDAN — the payoff's causal middle was supplied by the intro alone. ` +
        `Bind the scope in a body section, or add a payoff-scope:<term> row with a source to {BRIEF_DATE}-truth.json.`
    );
  }

  // Title numerals: a counted claim in the title is the single string every reader sees. It must be
  // bound by a truth row (`payoff-scope:` or `headline:`), or the count is unresolvable after publish.
  const numeral = title.match(
    /\b(Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\b/i
  );
  if (numeral && !truthTerms.has(numeral[1].toLowerCase())) {
    out.push(
      `DAILY TITLE NUMERAL UNBOUND — "${numeral[1]}" counts something and no truth row names WHICH. ` +
        `2026-08-13 receipt: the title said "Two Chokepoints" while the body named THREE (Hormuz, the Libyan facilities, the CPC terminal); which two was stated nowhere, and a wrong title cannot be fixed after publish. ` +
        `Add payoff-scope:${numeral[1].toLowerCase()} (or the matching headline: row) enumerating the members.`
    );
  }
  return out;
}

/** `payoff-scope:*` / `headline:*` keys resolved in the truth file, as bare lowercase terms. */
function truthScopeTerms(truthPath: string): Set<string> {
  const out = new Set<string>();
  try {
    const j = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
    for (const k of Object.keys(j?.claims ?? {})) {
      const m = /^(?:payoff-scope|headline):(.+)$/.exec(k);
      if (m) for (const t of m[1].split(/[^a-z0-9]+/i)) if (t) out.add(t.toLowerCase());
    }
  } catch {
    /* no truth file → every intro term is unbound, which is the correct default */
  }
  return out;
}

// ---------- 6. WATCH BINDING (IMP-190 — 2026-08-18 Critic mandate #3, RC5) ----------
//
// WHY THIS EXISTS. On 2026-08-18 `assembly-gate` exited 0 on a payoff the Critic graded FAIL.
// The conclusion was "a position is worth whatever it costs to leave it" (MECHANISM); the watch
// line was "Watch Home Depot before the open this morning, with Walmart on Thursday behind it";
// and what HD/WMT actually settle is M&M-1's "whether the miss was a consumer or a calendar" —
// which touches switching cost nowhere. PAYOFF SCOPE UNBOUND (IMP-167, the 08-13 fix) passed,
// correctly: Home Depot and Walmart ARE bound in a body section. **Entity binding passed while
// CLAIM binding failed.** The 08-13 check was never designed to ask whether the observable
// advances the conclusion, and it had quietly become load-bearing for that question.
//
// Ceiling_Doctrine §4 / Phase 15 element (c): the watch must advance THE CONCLUSION, not merely
// appear somewhere in the body. This check asks the missing question, in three steps:
//   watch sentence → the body unit its entities resolve → does that unit share a content term
//   with the payoff's own conclusion clause?
//
// KNOWN AND MEASURED FALSE POSITIVE, stated rather than tuned away. Across 2026-08-12..18 this
// check fires on 08-18 (the mandated FIRE) and on 08-15, and is silent on the other five. 08-15's
// watch — "the final University of Michigan reading… if it revises back toward 55.2, the August
// collapse was a survey window rather than a household decision" — DOES advance that night's
// mechanism ("the number that settled the outcome was not held by anyone inside the transaction":
// the survey window decided it, not households), but says so in entirely different vocabulary,
// and that night's Critic passed the payoff. A term-overlap proxy cannot see synonymy. The
// loosening was stopped there on purpose: further widening to silence 08-15 would have been
// fitting the instrument to n=1 and would have put the mandated 08-18 FIRE at risk. One advisory
// flag in seven, with a one-comment remedy, is the honest calibration.
//
// ESCAPE HATCH, deliberately cheap. Term overlap is a proxy and a proxy can be wrong in the
// writer's favour: a watch may advance the mechanism in words the mechanism never uses. So the
// brief may instead emit `<!-- WATCH-BINDING: <unit> — <one line on how it tests the mechanism> -->`
// and the check goes silent. That converts a false FLAG into one sentence of reasoning on disk,
// which is the trade this system wants — the flag is advisory in any case (the brief always ships).
//
// FLAG only, never FAIL. Same posture as every other check in this file.

/** Sentence split that does not break on "$7.1 bn.", "H.15", "U.S." or decimal numerals. */
function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"“*(])/)
    .map(s => s.trim())
    .filter(Boolean);
}

const TERM_STOP = new Set(
  (
    'the a an and or but if then so that this these those there their them they it its is are was ' +
    'were be been being has have had do does did not no nor for from with without within into onto ' +
    'over under about above below after before while when where what which who whom whose why how ' +
    'than as at by in of on to up out off again once here now today tonight tomorrow yesterday ' +
    'more most less least much many other another some such only own same very can will just should ' +
    'would could may might must shall each every both few all any one two three four five six seven ' +
    'eight nine ten first second third last next monday tuesday wednesday thursday friday saturday ' +
    'sunday january february march april may june july august september october november december ' +
    // `week`/`month`/`quarter` are NOT stopped. They look like filler and are not: on 2026-08-16 the
    // conclusion was about "THE WEEK's frightening numbers" and the watch about "every comfortable
    // explanation THIS WEEK produced" — the same referent, and the only term the two share. Stopping
    // it turned the Critic's named PASS case into a flag. A window word is a content word here.
    'morning afternoon evening night open close before behind ahead still ' +
    'because since though although however whether either neither also thing things something ' +
    'brief tonight’s tonights watch percent cent cents'
  ).split(/\s+/)
);

/** Content terms: lowercase alphabetic stems ≥4 chars, minus the stoplist. Plural-normalised. */
function contentTerms(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 4) continue;
    if (TERM_STOP.has(raw)) continue;
    // Crude but symmetric stemming — applied to BOTH sides, so it can only add matches, and a
    // watch-binding check erring toward silence is the safe direction for an advisory flag.
    const stem = raw
      .replace(/(ies)$/, 'y')
      .replace(/(sses|shes|ches)$/, m => m.slice(0, -2))
      .replace(/([^s])s$/, '$1')
      .replace(/(ing|ed)$/, '');
    if (stem.length >= 4 && !TERM_STOP.has(stem)) out.add(stem);
  }
  return out;
}

/**
 * Entities of a sentence: capitalised tokens that are NOT sentence-initial, plus acronyms and
 * tickers. Deliberately narrow — a false entity sends the search to the wrong unit, and a wrong
 * unit produces a flag about a binding nobody claimed.
 */
function entitiesOf(sentence: string): string[] {
  const toks = sentence.split(/\s+/);
  const out = new Set<string>();
  toks.forEach((tok, i) => {
    const w = tok.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9.]+$/g, '');
    if (w.length < 2) return;
    const bare = w.replace(/[.'’]s$/, '').replace(/\.$/, '');
    if (SCOPE_STOP.has(bare.toLowerCase()) || TERM_STOP.has(bare.toLowerCase())) return;
    const startsSentence = i === 0 || /[.!?:]$/.test(toks[i - 1] ?? '');
    const isCap = /^[A-Z]/.test(bare) && /[a-z]/.test(bare);
    const isAcronym = /^[A-Z][A-Z0-9.]{1,}$/.test(bare);
    if ((isCap && !startsSentence) || isAcronym) out.add(bare);
  });
  return [...out];
}

/**
 * The payoff's CONCLUSION clause = the first intro sentence that states a general claim, i.e.
 * carries no entity. That is what MECHANISM and TENSION classes ARE — a claim about how the world
 * works, not an instance of it ("a position is worth whatever it costs to leave it"; "the week's
 * frightening numbers kept getting smaller under inspection"). Instance sentences name Stripe and
 * Mastercard; the conclusion does not. Fallback, if every sentence carries an entity: the sentence
 * immediately preceding the watch, which is where the payoff spec puts the conclusion.
 */
function payoffConclusion(intro: string): string | null {
  const sents = sentencesOf(intro.replace(/[*_]/g, ''));
  if (!sents.length) return null;
  const watchIdx = sents.findIndex(s => /^\s*Watch\b/i.test(s));
  const pool = watchIdx > 0 ? sents.slice(0, watchIdx) : sents;
  // UNION, not the single best sentence. A TENSION conclusion is routinely stated across two
  // abstract sentences — 2026-08-16 said it in "The week's frightening numbers kept getting
  // smaller under inspection" AND "One number refused to shrink", and picking either one alone
  // condemned a payoff the Critic named as the PASS case. Taking the union is also the safe
  // direction: more conclusion terms ⇒ more chances to find the overlap ⇒ fewer false flags.
  const abstract = pool.filter(s => entitiesOf(s).length === 0);
  if (abstract.length) return abstract.join(' ');
  return watchIdx > 0 ? (sents[watchIdx - 1] ?? null) : null;
}

// ─── IMP-204 — TITLE / PAYOFF DEMOTION INTERLOCK (2026-08-20 Critic mandate #3, RC3) ─────────
//
// THE FAILURE. The 08-20 Daily Title — which is also the podcast episode name — was "At Least Four
// Billion", bound by the brief's own DAILY TITLE BINDING block to the Treasury buyback ceiling. The
// payoff intro's second and third sentences read: "THAT WAS THE LOUDEST NUMBER OF THE DAY. THE MORE
// CONSEQUENTIAL PATTERN WAS QUIETER, and it was about electricity," and its conclusion landed on the
// delivered watt. The reader's first impression and the brief's own conclusion pointed in opposite
// directions.
//
// ⭐ AND IT WAS MANUFACTURED BY AN IMPROVEMENT, which is why this is an interlock rather than a
// content check. The QG's FRESH-FRAME SCAN now deliberately hunts a payoff mechanism AWAY from the
// day's loudest story — on 08-20 its own log says it "ceded the day's loudest story to The Six per
// the breadth principle" — and that is the ambition the system spent weeks asking for. The Daily
// Title step still runs off the LEAD STORY. THE BETTER THE FRESH-FRAME SCAN GETS, THE MORE OFTEN
// THESE TWO WILL DISAGREE. Nobody wired them together. An upstream improvement manufactured a
// downstream inconsistency, and the fix belongs at the seam, not in either endpoint.
//
// WHY NOT A CONTENT PROXY. Proxy discipline (Ceiling Doctrine v0.5 §9 / Ledger rule 6) forbids
// building a structural-judgment detector on a same-day n=1, and the demotion construction occurs
// EXACTLY ONCE in the entire published July-August corpus — this night. So this does not try to
// judge whether a title "matches" a conclusion by term overlap; that is a Goodhart machine. It is a
// CONDITIONAL INTERLOCK: silent by construction on every ordinary night, and on the specific nights
// where the intro demotes its own lead story it requires the two steps to have been wired — either
// the title's terms reach the conclusion, or the Writer attests the decision in one line.
// RC3 is a coordination root cause, and a coordination rule is its sanctioned fix.
const DEMOTION_RE =
  /\b(?:that was the loudest|the loudest number of the day|the more consequential|the bigger story (?:was|is)|(?:was|is) quieter|the quieter (?:story|pattern|number)|matters less than|the real story (?:was|is) elsewhere)\b/i;
// The attestation. One line, in the DAILY TITLE BINDING block the brief already writes.
const TITLE_ALIGNMENT_RE = /PAYOFF-ALIGNMENT:\s*\S/i;

/**
 * FIRE only when the intro demotes its own opening story AND the title's content terms are absent
 * from the payoff conclusion AND no alignment attestation exists. Three conditions, so an ordinary
 * night — no demotion — cannot produce a flag at all.
 */
export function checkTitlePayoffDemotion(brief: string): string[] {
  const intro = introBlock(brief).replace(/<!--[\s\S]*?-->/g, '');
  if (!intro.trim()) return [];
  const dem = intro.match(DEMOTION_RE);
  if (!dem) return []; // the intro does not demote its own lead: nothing to coordinate
  if (TITLE_ALIGNMENT_RE.test(brief)) return []; // the Writer wired it and said so

  const title = dailyTitle(brief);
  if (!title) return [];
  // The FINAL conclusion sentence, not `payoffConclusion`'s union. That function deliberately
  // returns the union of every entity-free sentence because watch-binding errs toward SILENCE, and
  // for that check more terms means fewer false flags. Here the same generosity inverts: on 08-20
  // the union swept in "Pennsylvania can now stop a data centre because roughly A BILLION dollars
  // goes into a hundred-megawatt site" — entity-free only because `Pennsylvania` is
  // sentence-initial — and that stray "billion" matched the title's "Four Billion" and silenced the
  // very defect this check exists for. The payoff's conclusion is its LAST general claim before the
  // watch; that is the sentence the Critic quoted, and it is the one the title should agree with.
  const concl = (() => {
    const sents = sentencesOf(intro.replace(/[*_]/g, ''));
    const watchIdx = sents.findIndex(s => /^\s*Watch\b/i.test(s));
    const pool = watchIdx > 0 ? sents.slice(0, watchIdx) : sents;
    const abstract = pool.filter(s => entitiesOf(s).length === 0);
    return abstract.length
      ? abstract[abstract.length - 1]!
      : (watchIdx > 0 ? (sents[watchIdx - 1] ?? null) : null);
  })();
  if (!concl) return [];

  const titleTerms = [...contentTerms(title)];
  if (!titleTerms.length) return []; // an all-stopword title ("At Least Four Billion" numerals
  // aside) carries no term to bind; the headline-anchor rails in fact-gate own the numeral.
  const conclTerms = contentTerms(concl);
  const hits = titleTerms.filter(t => conclTerms.has(t));
  if (hits.length) return []; // the title already points at the conclusion

  // Where DOES it point? Naming the demoted sentence is what makes the flag actionable.
  const lead = sentencesOf(intro.replace(/[*_]/g, ''))[0] ?? '';
  const leadTerms = contentTerms(lead);
  const pointsAtLead = titleTerms.some(t => leadTerms.has(t));

  return [
    `DAILY TITLE vs PAYOFF DEMOTION — the title "${title}" shares no content term with the payoff ` +
      `conclusion ("${concl.slice(0, 120)}…") while the intro explicitly demotes its own opening ` +
      `story ("${dem[0]}")${pointsAtLead ? ', and the title\'s terms DO appear in that demoted opening sentence' : ''}. ` +
      `The title is the podcast episode name and the reader's first impression; the conclusion is ` +
      `what the brief actually decided. Pointing them in opposite directions is not a coincidence — ` +
      `the QG's FRESH-FRAME SCAN now deliberately cedes the day's loudest story, and the title step ` +
      `still runs off the lead. RESOLVE: retitle to the conclusion, or add one line to the DAILY ` +
      `TITLE BINDING block — "PAYOFF-ALIGNMENT: <why the title names the demoted story anyway>". ` +
      `Receipt, 2026-08-20: title "At Least Four Billion" (Treasury buybacks) against a payoff whose ` +
      `conclusion was the delivered watt, two sentences after the intro called the title's own ` +
      `number "the loudest number of the day."`,
  ];
}

/** The watch = the intro sentence opening with "Watch". Absent → nothing to bind, stay silent. */
function watchSentence(intro: string): string | null {
  const sents = sentencesOf(intro.replace(/[*_]/g, ''));
  for (let i = sents.length - 1; i >= 0; i--)
    if (/^\s*Watch\b/i.test(sents[i]!)) return sents[i]!;
  return null;
}

const UNIT_PREFIX: Array<[RegExp, string]> = [
  [/^Markets\s*&\s*Macro/i, 'M&M'],
  [/^Companies\s*&\s*Crypto/i, 'C&C'],
  [/^AI\s*&\s*Tech/i, 'AI&T'],
  [/^Geopolitics/i, 'Geo'],
  [/^The\s+Wild\s+Card/i, 'WC'],
  [/^The\s+Signal/i, 'Signal'],
];

/** Body units = the numbered bullets under each ▸ THE SIX section, in publication order. */
function bodyUnits(brief: string): Array<{ id: string; text: string }> {
  const body = bodyAfterIntro(brief);
  const lines = body.split('\n');
  const units: Array<{ id: string; text: string }> = [];
  let prefix: string | null = null;
  let n = 0;
  let cur: { id: string; text: string } | null = null;
  const flush = () => {
    if (cur) units.push(cur);
    cur = null;
  };
  for (const line of lines) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      flush();
      const found = UNIT_PREFIX.find(([re]) => re.test(h[1]!.trim()));
      prefix = found ? found[1] : null;
      n = 0;
      continue;
    }
    if (/^#\s*▸/.test(line)) {
      flush();
      prefix = null;
      continue;
    }
    if (!prefix) continue;
    if (/^\s*[-*]\s+\*\*/.test(line)) {
      flush();
      cur = { id: `${prefix}-${++n}`, text: line };
    } else if (cur) {
      cur.text += ' ' + line;
    }
  }
  flush();
  return units;
}

export function checkWatchBinding(brief: string): string[] {
  const stripped = brief.replace(/<!--[\s\S]*?-->/g, ' ');
  if (/<!--\s*WATCH-BINDING:/i.test(brief)) return []; // declared on disk — one sentence beats a proxy
  const intro = introBlock(stripped);
  if (!intro.trim()) return [];
  const watch = watchSentence(intro);
  const concl = payoffConclusion(intro);
  if (!watch || !concl) return []; // no watch or no statable conclusion — other checks own that
  const cTerms = contentTerms(concl);
  // LEG A — DIRECT BINDING. If the watch itself speaks the conclusion's language, element (c) is
  // satisfied on the page and no unit hop is needed. This leg is what keeps 2026-08-16 silent:
  // its watch says "every comfortable explanation this WEEK produced has no purchase" against a
  // conclusion about "the WEEK's frightening numbers". Checking the cheap, direct thing first
  // also removes the whole class of false flags caused by hopping to the wrong body unit.
  if ([...contentTerms(watch)].some(t => cTerms.has(t))) return [];
  const ents = entitiesOf(watch);
  if (!ents.length) return []; // undated/unentitied watch is Phase 15's problem, not this check's
  const units = bodyUnits(brief);
  if (!units.length) return [];
  // IDF WEIGHTING. A raw hit count sends the search wherever a common noun lands: on 2026-08-16
  // the watch's "Fed" matched C&C-2 and the check condemned a unit the watch never pointed at.
  // Weight each watch entity by how FEW units contain it, so "H.15" outranks "Fed" and a
  // ubiquitous entity contributes almost nothing to the choice of unit.
  const df = new Map<string, number>();
  for (const e of ents) df.set(e, units.filter(u => u.text.includes(e)).length);
  let best: { id: string; text: string; hits: number; score: number } | null = null;
  const candidates: Array<{ id: string; text: string }> = [];
  for (const u of units) {
    const matched = ents.filter(e => u.text.includes(e));
    if (!matched.length) continue;
    candidates.push(u);
    const score = matched.reduce((s, e) => s + 1 / (df.get(e) || 1), 0);
    if (!best || score > best.score) best = { ...u, hits: matched.length, score };
  }
  if (!best) return []; // watch resolves to no body unit — PAYOFF SCOPE UNBOUND owns that failure
  // LEG B — ANY candidate, not merely the best-scored one. A watch legitimately lands in more than
  // one unit, and IDF picks which is most SPECIFIC, not which is the binding. 2026-08-15's watch
  // ("the final University of Michigan reading") scored to WC-1 while its Michigan-sentiment
  // subject also sits in M&M-1; demanding the binding come from the top-scored unit alone flagged
  // a payoff that night's Critic passed. Only when NO resolved unit speaks the conclusion's
  // language is the watch genuinely orphaned.
  if (candidates.some(u => [...contentTerms(u.text)].some(t => cTerms.has(t)))) return [];
  return [
    `WATCH ORPHANED FROM PAYOFF CLASS — the watch line resolves ${best.id} (${best.hits} of ` +
      `${ents.length} watch entit${ents.length === 1 ? 'y' : 'ies'} matched: ${ents.slice(0, 4).join(', ')}), ` +
      `and ${best.id} shares ZERO content terms with the payoff's own conclusion clause. ` +
      `Conclusion: "${concl.slice(0, 140)}${concl.length > 140 ? '…' : ''}". ` +
      `Watch: "${watch.slice(0, 120)}${watch.length > 120 ? '…' : ''}". ` +
      `Ceiling_Doctrine §4 element (c) requires the observable to advance the CONCLUSION, not merely to ` +
      `appear in the body — entity binding (PAYOFF SCOPE, IMP-167) is satisfied here and is not the same test. ` +
      `2026-08-18 receipt: conclusion terms were position/cost/leave/switching, M&M-1's were consumer/calendar/Prime Day, ` +
      `and this gate exited 0. Either re-point the watch at an observable that tests the mechanism, or emit ` +
      `<!-- WATCH-BINDING: ${best.id} — one line on how it tests the mechanism -->.`,
  ];
}

// FIRE fixture = the real 2026-07-10 QG FRESH-FRAME SCAN (verbatim — the under-swept scan the
// Critic's mandate #3 named); SILENT fixture = a scan that sweeps the Signals + Take.
const FIRE_FF = `**FRESH-FRAME SCAN (≥3 candidate MECHANISMS across distinct clusters, required before NONE):** (1) **concentration/saturation** — SK Hynix (memory demand), DTCC (settlement), Hyperliquid (perp share): all **C&C cluster only** → below cross-cluster bar. (2) **withdrawal** — options hedges removed (M&M-1) + gold non-response (M&M-3): 2 sections, below threshold. (3) **commoditization/margin-migration** — AI-3 (model→app) + C&C-3 (CEX→DEX): 2 sections AND restates 07-07's "Deployment Premium" frame (3d stale) → reject. None is a clean ≥3-section shared MECHANISM. → **CONVERGENCE = NONE for assembly**.`;
const SILENT_FF = `**FRESH-FRAME SCAN (≥3 candidate MECHANISMS across distinct clusters, required before NONE):** (1) **concentration/saturation** — SK Hynix memory (C&C), DTCC settlement (C&C), Signal-1 revenue-in-whales, Signal-2 grid capacity, and the Take's rate-beta concentration: spans C&C + Signal + Take → ≥3 sections across 3 clusters → MECHANISM candidate, promote to the payoff. (2) **withdrawal** — options hedges (M&M-1) + gold (M&M-3): 2 sections, below threshold. (3) **commoditization** — AI-3 + C&C-3: 2 sections, stale. Concentration qualifies → PAYOFF CLASS: MECHANISM.`;

// Payoff-class fixtures (new grammar).
const FIRE_PAYOFF_THEME = `PAYOFF CLASS: [THEME descriptor='priced vs ignored' sections=M&M-1,Geo-2,AI&T-3] | watch=absent | action=[none-needed]`;
const SILENT_PAYOFF = `PAYOFF CLASS: [TENSION 'containment bet vs unpriced semiconductor exposure' sections=M&M-1,Geo-2] | watch=present | action=[REWROTE intro conclusion]
PAYOFF EXECUTION: class=TENSION, action=REWROTE, watch=present, intro final sentences='…'`;
const FIRE_MARKER = `Some intro text.
<!-- throughline: "one-way door" | sections: M&M, C&C -->
Body text.`;
const SILENT_MARKER = `Some intro text with no marker.

# ▸ THE SIX

Body text.`;

const REAL13 = path.join(process.cwd(), 'daily-briefs/2026-08-13-v2.md');
const TRAILING = [
  'daily-briefs/2026-08-12-v2.md',
  'daily-briefs/2026-08-11-v2.md',
  'daily-briefs/2026-08-10-v2.md',
].map(f => path.join(process.cwd(), f));

// The real 2026-08-20 header, verbatim from `content/daily-updates/2026-08-20.md` — the published
// bytes, not a reconstruction. IMP-204's acceptance runs against this.
const AUG20_HEADER = `# MARKETS, MEDITATIONS & MENTAL MODELS

*A floor tells you the smallest thing someone is willing to do. It has never once told you what they intend.*

## Thursday, August 20, 2026

### At Least Four Billion

*Treasury announced on Wednesday morning that from 9 September it will lift the ceiling on its long-dated buybacks from $2 billion per operation to at least $4 billion, and the long end rallied about nine basis points while the dollar fell almost one percent. That was the loudest number of the day. The more consequential pattern was quieter, and it was about electricity. Mining lost money at the gross line inside Core Scientific while renting the same buildings to AI tenants threw off more gross profit than the whole company earned. Analog Devices guided nine percent above consensus at a seventy-four percent margin on the power-conversion layer nobody benchmarks. Pennsylvania can now stop a data centre because roughly a billion dollars goes into a hundred-megawatt site before a permit matters. And a silicon carbide industry built for electric cars is being kept alive by eight-hundred-volt server racks. The scarce input in artificial intelligence has moved from the chip to the delivered watt and the permission to deliver it, which is why the assets now deciding the buildout are mostly assets nobody built for it. Watch Analog Devices' fiscal fourth quarter in late November, the first print that tests whether the layer between the racks holds its pricing while the layer above it reprices.*

---

# ▸ THE SIX
`;

function selftest(): number {
  const cases: Array<[string, boolean, () => boolean]> = [
    [
      'fresh-frame-sweep fires when Signals+Take not swept',
      true,
      () => checkFreshFrameSweep(FIRE_FF) !== null,
    ],
    [
      'fresh-frame-sweep silent on a full-brief sweep',
      false,
      () => checkFreshFrameSweep(SILENT_FF) !== null,
    ],
    [
      'payoff-class fires on THEME shipped un-rewritten',
      true,
      () => checkPayoffClass(FIRE_PAYOFF_THEME).length > 0,
    ],
    [
      'payoff-class silent on executed TENSION payoff',
      false,
      () => checkPayoffClass(SILENT_PAYOFF).length > 0,
    ],
    [
      'leftover marker fires on retired throughline marker',
      true,
      () => checkLeftoverMarker(FIRE_MARKER) !== null,
    ],
    [
      'leftover marker silent on a clean brief',
      false,
      () => checkLeftoverMarker(SILENT_MARKER) !== null,
    ],
    // ── IMP-190 (08-18 Critic mandate #3, RC5): WATCH BINDING, both directions, on REAL files ──
    [
      'WATCH-BINDING FIRES: the real 2026-08-18-v2 — watch resolves M&M-1 (Home Depot/Walmart, 3/3 entities), M&M-1 shares ZERO terms with the conclusion "a position is worth whatever it costs to leave it". assembly-gate exited 0 on this on the night; the Critic graded the payoff FAIL on element (c)',
      true,
      () => {
        const p = path.join(process.cwd(), 'daily-briefs/2026-08-18-v2.md');
        if (!fs.existsSync(p)) return true;
        const out = checkWatchBinding(fs.readFileSync(p, 'utf8'));
        return out.length === 1 && /WATCH ORPHANED FROM PAYOFF CLASS/.test(out[0]!) && /M&M-1/.test(out[0]!);
      },
    ],
    [
      'WATCH-BINDING SILENT on the Critic\'s named PASS case: the real 2026-08-16-v2 — its TENSION conclusion ("the week\'s frightening numbers kept getting smaller under inspection") and its dated H.15 watch ("every comfortable explanation this week produced has no purchase") share their subject. A gate that condemns this is not a gate',
      false,
      () => {
        const p = path.join(process.cwd(), 'daily-briefs/2026-08-16-v2.md');
        if (!fs.existsSync(p)) return false;
        return checkWatchBinding(fs.readFileSync(p, 'utf8')).length > 0;
      },
    ],
    [
      'WATCH-BINDING ESCAPE HATCH works: the 08-18 brief goes silent once it declares <!-- WATCH-BINDING: ... -->. The remedy for the known synonymy false-positive (08-15) must actually silence the check, or the escape hatch is decoration',
      false,
      () => {
        const p = path.join(process.cwd(), 'daily-briefs/2026-08-18-v2.md');
        if (!fs.existsSync(p)) return false;
        const b = fs.readFileSync(p, 'utf8');
        return (
          checkWatchBinding(
            b + '\n<!-- WATCH-BINDING: M&M-1 — the retail block prices what a shopper pays to switch stores. -->\n'
          ).length > 0
        );
      },
    ],
    [
      'WATCH-BINDING does not flag a brief with no watch line at all (Phase 15 owns absence, not this check)',
      false,
      () =>
        checkWatchBinding(
          '### A Title\n\n*A regime sentence. A general claim about how the world works.*\n\n---\n\n# ▸ THE SIX\n\n## Markets & Macro\n\n- **A lead.** Body text.\n'
        ).length > 0,
    ],
    // ── IMP-176 (08-15 Critic mandate #2, RC3): class transcription + rotation, on REAL files ──
    [
      'own-emission: the 08-15 QG log reads MECHANISM (its own emitted line)',
      true,
      () => {
        const p = path.join(process.cwd(), 'daily-briefs/2026-08-15-quality-gate-log.md');
        return !fs.existsSync(p) || qgOwnPayoffClass(fs.readFileSync(p, 'utf8')) === 'MECHANISM';
      },
    ],
    [
      'HISTORY-LINE DISCRIMINATION: the 08-12 QG log has NO own emission — its only PAYOFF CLASS lines are a quoted 08-11/10/09 history block, and reading one as tonight\'s class would condemn a clean brief',
      true,
      () => {
        const p = path.join(process.cwd(), 'daily-briefs/2026-08-12-quality-gate-log.md');
        if (!fs.existsSync(p)) return true;
        const qg = fs.readFileSync(p, 'utf8');
        // The naive first-match parser DOES find a class here — that is the trap being closed.
        return /PAYOFF CLASS:/i.test(qg) && qgOwnPayoffClass(qg) === null;
      },
    ],
    [
      'FIRES: the real 2026-08-15-v2 asserts TENSION twice against the QG\'s emitted MECHANISM → 2 findings',
      true,
      () => {
        const b = path.join(process.cwd(), 'daily-briefs/2026-08-15-v2.md');
        const q = path.join(process.cwd(), 'daily-briefs/2026-08-15-quality-gate-log.md');
        if (!fs.existsSync(b) || !fs.existsSync(q)) return true;
        return (
          checkPayoffClassConsistency(
            fs.readFileSync(b, 'utf8'),
            fs.readFileSync(q, 'utf8')
          ).length === 2
        );
      },
    ],
    [
      'SILENT (RE-SOURCED NEGATIVE): the real 2026-08-12-v2 asserts TENSION and takes NO finding — the Critic\'s named negative ("QG emitted TENSION") was vacuous; the 08-12 QG emitted nothing, and the history-line discrimination is what keeps this silent',
      false,
      () => {
        const b = path.join(process.cwd(), 'daily-briefs/2026-08-12-v2.md');
        const q = path.join(process.cwd(), 'daily-briefs/2026-08-12-quality-gate-log.md');
        if (!fs.existsSync(b) || !fs.existsSync(q)) return false;
        const brief = fs.readFileSync(b, 'utf8');
        // Non-vacuous: the 08-12 brief genuinely DOES assert a payoff class.
        if (!briefPayoffClassAssertions(brief).some(a => a.cls === 'TENSION')) return true;
        return (
          checkPayoffClassConsistency(brief, fs.readFileSync(q, 'utf8')).length > 0
        );
      },
    ],
    [
      'ROTATION FIRES: 08-13, 08-14 and 08-15 all emitted MECHANISM → the third consecutive device is flagged',
      true,
      () =>
        checkPayoffRotation('2026-08-15', d => {
          const p = path.join(process.cwd(), `daily-briefs/${d}-quality-gate-log.md`);
          return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
        }) !== null,
    ],
    [
      // My first candidate negative (08-12) was WRONG and the leg was right: 08-11/10/09 were all
      // MECHANISM, so 08-12 IS a genuine third-consecutive night. Re-sourced to a real mixed chain.
      'ROTATION SILENT: the real 2026-08-06 chain is THEME · TENSION · MECHANISM (08-06/08-05/08-04) — a mixed chain takes no flag',
      false,
      () =>
        checkPayoffRotation('2026-08-06', d => {
          const p = path.join(process.cwd(), `daily-briefs/${d}-quality-gate-log.md`);
          return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
        }) !== null,
    ],
    [
      // ANTI-CAROUSEL PROOF (the E-INNER-GAME-DOMAIN-CAROUSEL-01 lesson: a rule with one legal
      // answer every night is not a rule). Measured across every QG log on disk.
      'ROTATION IS NOT ALWAYS-ON: the leg fires on well under a quarter of all dated QG logs',
      false,
      () => {
        const dir = path.join(process.cwd(), 'daily-briefs');
        if (!fs.existsSync(dir)) return false;
        const dates = fs
          .readdirSync(dir)
          .filter(f => /^\d{4}-\d{2}-\d{2}-quality-gate-log\.md$/.test(f))
          .map(f => f.slice(0, 10))
          .sort();
        if (dates.length < 20) return false;
        const read = (d: string) => {
          const p = path.join(dir, `${d}-quality-gate-log.md`);
          return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
        };
        const fires = dates.filter(d => checkPayoffRotation(d, read) !== null).length;
        return fires / dates.length > 0.25; // expected SILENT => ratio must stay at or below 25%
      },
    ],
    // ── IMP-167 (08-13 Critic mandate #3, RC5): payoff scope binding, on REAL files ──
    [
      "payoff-scope FIRES on the real 2026-08-13-v2 intro's unbound 'Gulf' (intro=1, body=0)",
      true,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(fs.readFileSync(REAL13, 'utf8'), '2026-08-13', new Set())
          .some(m => /PAYOFF SCOPE UNBOUND/.test(m) && /\bGulf\b/.test(m)),
    ],
    [
      'payoff-scope FIRES on the unbound Daily Title numeral ("Two Chokepoints" vs a body naming three)',
      true,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(fs.readFileSync(REAL13, 'utf8'), '2026-08-13', new Set())
          .some(m => /DAILY TITLE NUMERAL UNBOUND/.test(m)),
    ],
    [
      'payoff-scope SILENT on Patriot/Ukraine/Washington/September — four clean negatives from the SAME intro',
      false,
      () =>
        fs.existsSync(REAL13) &&
        checkPayoffScope(fs.readFileSync(REAL13, 'utf8'), '2026-08-13', new Set())
          .some(m => /\b(Patriot|Ukraine|Washington|September)\b/.test(m)),
    ],
    [
      'payoff-scope SILENT on the trailing three intros (08-12, 08-11, 08-10 — all payoffs graded pass)',
      false,
      () =>
        TRAILING.filter(f => fs.existsSync(f)).some(
          f =>
            checkPayoffScope(fs.readFileSync(f, 'utf8'), '2026-08-13', new Set())
              .length > 0
        ),
    ],
    [
      'payoff-scope SILENT once a payoff-scope truth row binds the term',
      false,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(
          fs.readFileSync(REAL13, 'utf8'),
          '2026-08-13',
          new Set(['gulf', 'two'])
        ).length > 0,
    ],
    [
      'payoff-scope NO RETRO — silent on a pre-2026-08-13 brief date (IMP-125)',
      false,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(fs.readFileSync(REAL13, 'utf8'), '2026-08-12', new Set())
          .length > 0,
    ],
    // --- IMP-204 (08-20 mandate #3): TITLE / PAYOFF DEMOTION INTERLOCK. Built on the REAL 08-20
    //     header, intro and title, which is the only night this construction occurs in the whole
    //     published July-August corpus. Four cases, both directions. ---
    [
      '[IMP-204] FIRES on the REAL 08-20 header — title "At Least Four Billion" vs a payoff whose conclusion is the delivered watt, two sentences after the intro calls that number the loudest of the day',
      true,
      () => checkTitlePayoffDemotion(AUG20_HEADER).length > 0,
    ],
    [
      '[IMP-204] SILENT once the Writer attests the decision — "PAYOFF-ALIGNMENT:" in the DAILY TITLE BINDING block, the one-line coordination escape',
      false,
      () =>
        checkTitlePayoffDemotion(
          `${AUG20_HEADER}\n<!-- DAILY TITLE BINDING: PAYOFF-ALIGNMENT: the title names the loudest number deliberately; the conclusion is the argument the reader arrives at. -->\n`
        ).length > 0,
    ],
    [
      '[IMP-204] SILENT on an intro with NO demotion — the ordinary night, and the reason this cannot become a nightly false alarm',
      false,
      () =>
        checkTitlePayoffDemotion(
          AUG20_HEADER.replace(
            /That was the loudest number of the day\. The more consequential pattern was quieter, and it was about electricity\./,
            'The buyback ceiling is the number that matters.'
          )
        ).length > 0,
    ],
    [
      '[IMP-204] SILENT when the title already points AT the conclusion — retitling is the other sanctioned repair and must not be punished',
      false,
      () =>
        checkTitlePayoffDemotion(
          AUG20_HEADER.replace('### At Least Four Billion', '### The Delivered Watt')
        ).length > 0,
    ],
    [
      '[IMP-204] SILENT across every OTHER published July and August brief — 0 flags on 40+ files; the trigger is absent by construction on an ordinary night',
      false,
      () =>
        fs
          .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
          .filter(x => /^2026-0[78]-\d\d\.md$/.test(x) && !x.startsWith('2026-08-20'))
          .some(
            f =>
              checkTitlePayoffDemotion(
                fs.readFileSync(path.join(process.cwd(), 'content/daily-updates', f), 'utf8')
              ).length > 0
          ),
    ],
    [
      '[IMP-204] FIRES on the REAL PUBLISHED content/daily-updates/2026-08-20.md — the reader-facing bytes, the strongest form of this receipt',
      true,
      () => {
        const p = path.join(process.cwd(), 'content/daily-updates/2026-08-20.md');
        return fs.existsSync(p)
          ? checkTitlePayoffDemotion(fs.readFileSync(p, 'utf8')).length > 0
          : true;
      },
    ],
  ];
  let fails = 0;
  for (const [name, shouldFire, fn] of cases) {
    const fired = fn();
    const ok = fired === shouldFire;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} — ${name} (expected ${shouldFire ? 'FIRE' : 'SILENT'}, got ${fired ? 'FIRE' : 'SILENT'})`
    );
    if (!ok) fails++;
  }
  console.log(
    `\nassembly-gate selftest — ${cases.length - fails}/${cases.length} assertions passed`
  );
  if (fails) {
    console.error(
      '✗ SELFTEST FAILED — a detector no longer bites both directions.'
    );
    return 1;
  }
  console.log(
    '✓ All detectors verified in both directions (fresh-frame sweep, payoff class, leftover marker, payoff scope binding).'
  );
  return 0;
}

function main() {
  if (process.argv.slice(2).includes('--selftest')) process.exit(selftest());
  const args = process.argv.slice(2);
  const briefArg = args.find(a => !a.startsWith('--'));
  if (!briefArg) {
    console.error('Usage: assembly-gate.ts <brief.md> [--selftest]');
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg)
    ? briefArg
    : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) {
    console.error(`File not found: ${briefPath}`);
    process.exit(2);
  }
  const brief = fs.readFileSync(briefPath, 'utf8');

  const findings: Finding[] = [];

  const marker = checkLeftoverMarker(brief);
  if (marker) findings.push({ severity: 'FLAG', message: marker });

  // PAYOFF SCOPE BINDING (IMP-167 — 08-13 mandate #3). The only check in the stack that reads the
  // Intro Summary as a source of NEW claims rather than as a summary of verified ones.
  const scopeDateM = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  const scopeTruth = scopeDateM
    ? truthScopeTerms(
        path.join(path.dirname(briefPath), `${scopeDateM[1]}-truth.json`)
      )
    : new Set<string>();
  for (const msg of checkPayoffScope(
    brief,
    scopeDateM ? scopeDateM[1] : null,
    scopeTruth
  ))
    findings.push({ severity: 'FLAG', message: `UNRESOLVED-FACT: ${msg}` });

  // WATCH BINDING (IMP-190 — 08-18 mandate #3). Claim binding, where PAYOFF SCOPE does entity
  // binding. The 08-18 payoff satisfied the latter and failed the former at gate exit 0.
  for (const msg of checkWatchBinding(brief))
    findings.push({ severity: 'FLAG', message: msg });

  // TITLE / PAYOFF DEMOTION INTERLOCK (IMP-204 — 08-20 mandate #3). The seam between an improvement
  // that ships (FRESH-FRAME SCAN cedes the loudest story) and a step that did not move with it
  // (the title runs off the lead story). Silent unless the intro demotes its own opening.
  for (const msg of checkTitlePayoffDemotion(brief))
    findings.push({ severity: 'FLAG', message: `UNRESOLVED-FACT: ${msg}` });

  // QG-log-coupled checks (payoff class + fresh-frame sweep).
  const dateM = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (dateM) {
    const qgPath = path.join(
      path.dirname(briefPath),
      `${dateM[1]}-quality-gate-log.md`
    );
    if (fs.existsSync(qgPath)) {
      const qg = fs.readFileSync(qgPath, 'utf8');
      for (const msg of checkPayoffClass(qg))
        findings.push({ severity: 'FLAG', message: msg });
      const sweep = checkFreshFrameSweep(qg);
      if (sweep) findings.push({ severity: 'FLAG', message: sweep });
      // IMP-176 — 08-15 mandate #2: the brief may not assert a class the QG did not emit.
      for (const msg of checkPayoffClassConsistency(brief, qg))
        findings.push({ severity: 'FLAG', message: msg });
    }
    // IMP-176 rotation leg — reads the QG chain, not the brief's self-report.
    const rot = checkPayoffRotation(dateM[1]!, d => {
      const p = path.join(path.dirname(briefPath), `${d}-quality-gate-log.md`);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    });
    if (rot) findings.push({ severity: 'FLAG', message: rot });
  }

  console.log(`assembly-gate (payoff) — ${path.basename(briefPath)}`);
  if (findings.length) {
    console.log(
      `\n  ${findings.length} FLAG (advisory — Editor Gate 14 + Critic must act):`
    );
    for (const f of findings) console.log(`   ⚠ ${f.message}`);
  }
  console.log(
    `\n✅ ASSEMBLY-GATE PASS${findings.length ? ' (flags advisory; the brief always ships)' : ''}`
  );
  process.exit(0);
}

// Direct-invocation guard (added 2026-08-13 — IMP-167, mirroring fact-gate/validate-brief).
// `main()` ran unconditionally, so this module could not be imported and `checkPayoffScope`
// could not be exercised from a sibling test without a usage banner and process.exit(2).
const invokedDirectly =
  !!process.argv[1] && path.resolve(process.argv[1]).endsWith('assembly-gate.ts');
if (invokedDirectly) main();
