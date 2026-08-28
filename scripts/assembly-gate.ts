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
const PAYOFF_HISTORY_PREFIX_RE =
  /(?:\b\d{2}-\d{2}\b|\b\d{4}-\d{2}-\d{2}\b)\s*:\s*$/;

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
    const prefix = line
      .slice(0, idx)
      .replace(/[`*_>\s-]+$/g, '')
      .trimEnd();
    if (PAYOFF_HISTORY_PREFIX_RE.test(prefix + ':')) continue;
    if (
      /^\s*(?:\d{2}-\d{2}|\d{4}-\d{2}-\d{2})\s*:/.test(
        line.replace(/^[\s`*_>-]+/, '')
      )
    )
      continue;
    const cls = classOf(line.slice(idx));
    if (cls) return cls;
  }
  return null;
}

/** Payoff-class assertions made by the BRIEF itself, in payoff-class contexts only. */
export function briefPayoffClassAssertions(
  brief: string
): Array<{ line: number; cls: string; text: string }> {
  const out: Array<{ line: number; cls: string; text: string }> = [];
  const lines = brief.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    // Scoped, per the mandate: `payoff class <CLASS>` or `Tonight is a <CLASS>`. A bare mention of
    // the word MECHANISM in prose is not a class assertion.
    const m =
      /payoff\s+class[^A-Za-z]{0,4}(MECHANISM|TENSION|THEME|INVENTORY)\b/i.exec(
        l
      ) ??
      /\bTonight\s+is\s+an?\s+(MECHANISM|TENSION|THEME|INVENTORY)\b/i.exec(l);
    if (m)
      out.push({
        line: i + 1,
        cls: m[1]!.toUpperCase(),
        text: l.trim().slice(0, 180),
      });
  }
  return out;
}

export function checkPayoffClassConsistency(
  brief: string,
  qg: string
): string[] {
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
    `(${chain
      .map(c => `${c.d}=${c.cls}`)
      .reverse()
      .join(' · ')}). The rotation rule exists because a reader who ` +
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
      if (m)
        for (const t of m[1].split(/[^a-z0-9]+/i))
          if (t) out.add(t.toLowerCase());
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
    if (SCOPE_STOP.has(bare.toLowerCase()) || TERM_STOP.has(bare.toLowerCase()))
      return;
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
      : watchIdx > 0
        ? (sents[watchIdx - 1] ?? null)
        : null;
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
      `story ("${dem[0]}")${pointsAtLead ? ", and the title's terms DO appear in that demoted opening sentence" : ''}. ` +
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
  let best: { id: string; text: string; hits: number; score: number } | null =
    null;
  const candidates: Array<{ id: string; text: string }> = [];
  for (const u of units) {
    const matched = ents.filter(e => u.text.includes(e));
    if (!matched.length) continue;
    candidates.push(u);
    const score = matched.reduce((s, e) => s + 1 / (df.get(e) || 1), 0);
    if (!best || score > best.score)
      best = { ...u, hits: matched.length, score };
  }
  if (!best) return []; // watch resolves to no body unit — PAYOFF SCOPE UNBOUND owns that failure
  // LEG B — ANY candidate, not merely the best-scored one. A watch legitimately lands in more than
  // one unit, and IDF picks which is most SPECIFIC, not which is the binding. 2026-08-15's watch
  // ("the final University of Michigan reading") scored to WC-1 while its Michigan-sentiment
  // subject also sits in M&M-1; demanding the binding come from the top-scored unit alone flagged
  // a payoff that night's Critic passed. Only when NO resolved unit speaks the conclusion's
  // language is the watch genuinely orphaned.
  if (candidates.some(u => [...contentTerms(u.text)].some(t => cTerms.has(t))))
    return [];
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

// ─── IMP-210 — PAYOFF MECHANISM EARNED (2026-08-22 Critic mandate #3, RC5) ───────────────────
//
// THE FAILURE, from the QG's own log (daily-briefs/2026-08-22-quality-gate-log.md):
//   :169  PAYOFF CLASS (as shipped in v1): THEME     descriptor='a claim on an asset is not the asset'
//   :195  PAYOFF CLASS (v1.5):             MECHANISM cause='the adjustment is landing on the layer
//                                                           that carries the asset, not the asset'
// Same proposition; the second one has a verb. The `cause=` field names NO AGENT — it says WHERE the
// repricing landed, not WHAT caused it. The real cause was in the file the whole time: the intro's own
// watch line reads "the metals were paid for on the announcement", and the published v2 says it
// outright — "the Treasury's announced buyback of longer-dated debt repriced term premium". That cause
// was ineligible at the QG only because Treasury buybacks had LED M&M on 08-20 and 08-21 and were
// demoted under entity cooldown; the intro is not a bullet and consumes no slot, which is now stated as
// the PAYOFF MECHANISM EXEMPTION in system/Novelty_Audit.md (PASS 1g).
//
// ⭐ WHY THIS IS NOT AN UNCONDITIONAL "does the cause name an agent" TEST — MEASURED, NOT ASSUMED.
// Proxy discipline (Ceiling Doctrine v0.5 §9 / Ledger rule 6) forbids a string-shaped fix for a
// judgment-shaped defect. So the agent rule was measured against every August `cause=` field on disk
// BEFORE it was wired. Result: **ZERO of the twelve MECHANISM causes published 2026-08-01..22 names a
// proper noun**, and seven of them (08-07, 08-08, 08-09, 08-10, 08-14, 08-21, 08-22) are passive,
// copular or unaccusative — "assurance that cannot be verified gets replaced at the holder's own
// expense", "an announced date is already a price". That is not sloppiness: PASS 1g defines a MECHANISM
// as a claim about how the world works, and `payoffConclusion` above encodes the same thing ("Instance
// sentences name Stripe and Mastercard; the conclusion does not"). An unconditional agent requirement
// would therefore FLAG 7 of 12 healthy nights — the IMP-200/201 nightly-false-alarm class the mandate
// names as the failure mode to avoid, and a silent policy change to what a MECHANISM *is*. The agent
// rule is stated as POLICY in Novelty_Audit.md; it is enforced HERE only where the corpus proves it
// discriminates: THE RELABEL. When the same night's QG emits a THEME/INVENTORY class and then
// re-emits a MECHANISM/TENSION with a `cause=`, the second label is a claim to have found a cause the
// first lacked — and a cause with no actor anywhere in its subject clause has not found one. Measured:
// exactly ONE night in 2026-08-01..22 re-emits (08-22). Silent by construction on every ordinary night,
// exactly like the IMP-204 interlock directly above.
//
// LEG B — and the same discipline. "Reject a payoff whose descriptor appears in a section's own closing
// sentence" measured UNCONDITIONALLY fires on 08-02, 08-18, 08-19 and 08-22 — and 08-19 is the mandate's
// required SILENT case (trend file: `payoff: pass`, `a_top: 4`). Quoting a body sentence inside a sweep
// is normal, healthy candidate accounting. The defect is narrower and the corpus states it precisely:
// the sentence evidences the **SELECTED** frame. On 08-19 the body-quoted sentence sits inside candidate
// A, which that QG REJECTED — in these words: *"unusable: M&M-3's own closing already **is** this loop."*
// 08-19 is this rule applied by hand. 08-22 is the same rule inverted: *"Two sections reached for this
// frame independently, in their own words — the strongest available evidence that it is a real
// mechanism."* Two sections closing on the frame is evidence the frame is REAL and evidence the INTRO
// has nothing left to add. Scoped to the selected candidate, the leg fires on 1 night in 21.
//
// FLAG only, never FAIL, with a cheap declared escape per leg — same posture as everything else here.
const PAYOFF_MECHANISM_EFFECTIVE_FROM = '2026-08-22'; // IMP-125: no retroactive condemnation.

// The escape hatches. One line each, in the QG log or the brief, and the leg goes silent — the trade
// this system always makes: a proxy's false positive converted into one sentence of reasoning on disk.
const CAUSE_AGENT_ATTESTATION = /PAYOFF-CAUSE-AGENT:\s*\S/i;
const FRAME_INDEPENDENCE_ATTESTATION = /PAYOFF-FRAME-INDEPENDENCE:\s*\S/i;

export interface PayoffEmission {
  line: number;
  cls: 'MECHANISM' | 'TENSION' | 'THEME' | 'INVENTORY';
  field: 'cause' | 'descriptor' | null;
  value: string | null;
  /** The emission's declared span, normalised to body-unit ids (IMP-212). Additive: every
   *  pre-existing reader of this interface reads cls/field/value/line and is unaffected. */
  sections: string[];
}

// The emission GRAMMAR, not the phrase. `qgOwnPayoffClass` above takes the first own line and stops,
// which is right for a single-class question; this leg iterates, so it must also reject the QG's own
// PROSE ABOUT the rule — "the payoff rewrite moved `PAYOFF CLASS` off a THEME" (08-19:382), "read the
// last 3 `PAYOFF CLASS` lines" (08-11:153, 08-18:435, 08-20:256). Measured: requiring the `sections=`
// field of the PASS 1g grammar removes all nine such lines across August and keeps all real emissions.
const EMISSION_FIELD_RE =
  /(cause|descriptor)\s*=\s*'([\s\S]*?)'\s*(?=sections\s*=|\||$)/i;

/**
 * IMP-212. A body-unit id, canonicalised so the QG's spelling and `bodyUnits()`'s spelling meet.
 * The house writes the AI section three ways across August — `AI&T-1`, `AI-1`, `AI&T 1` — and a
 * span check that cannot see through that silently loses a declared section, which in this gate
 * means a FALSE FIRE. Everything else is uppercase + punctuation removal.
 */
export function normUnitId(s: string): string {
  return s
    .replace(/[()[\]`*_'"“”]/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/^AI&T(?=-|$)/, 'AI')
    .replace(/^AI&TECH(?=-|$)/, 'AI')
    .replace(/^AI(?:\s|-)?TECH(?=-|$)/, 'AI')
    .replace(/\s+/g, '');
}

/** The `sections=[...]` span of one emission, as canonical unit ids. Junk entries ("Intro",
 *  "Dashboard/Commodities", "(Take, unnamed)") survive as junk and simply never match a body unit. */
export function emissionSections(after: string): string[] {
  const m = /sections\s*=\s*\[?([^\]\n|]*)/i.exec(after);
  if (!m) return [];
  return m[1]!
    .split(',')
    .map(s => normUnitId(s))
    .filter(Boolean);
}

export function qgPayoffEmissions(qg: string): PayoffEmission[] {
  const out: PayoffEmission[] = [];
  const lines = qg.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const idx = line.search(/PAYOFF CLASS/i);
    if (idx === -1) continue;
    // Same history-line discrimination as `qgOwnPayoffClass` — 08-12's only PAYOFF CLASS lines are a
    // quoted 08-11/10/09 block and reading one as tonight's class condemns a clean brief (IMP-176).
    const prefix = line
      .slice(0, idx)
      .replace(/[`*_>\s-]+$/g, '')
      .trimEnd();
    if (PAYOFF_HISTORY_PREFIX_RE.test(prefix + ':')) continue;
    if (
      /^\s*(?:\d{2}-\d{2}|\d{4}-\d{2}-\d{2})\s*:/.test(
        line.replace(/^[\s`*_>-]+/, '')
      )
    )
      continue;
    // An emission wraps (08-05, 08-09, 08-16 all do). Join continuations, stop at the next labelled line.
    const buf = [line];
    for (let j = i + 1; j < lines.length && buf.length < 4; j++) {
      if (!lines[j]!.trim()) break;
      if (/PAYOFF\s+(?:CLASS|EXECUTION|ROTATION)/i.test(lines[j]!)) break;
      buf.push(lines[j]!);
    }
    const joined = buf.join(' ');
    const after = joined.slice(joined.search(/PAYOFF CLASS/i));
    if (!/sections\s*=/i.test(after)) continue; // prose about the rule, not an emission
    const head = after.split(/sections\s*=/i)[0]!;
    const cls = classOf(head);
    if (!cls) continue;
    const fm = EMISSION_FIELD_RE.exec(after);
    out.push({
      line: i + 1,
      cls: cls as PayoffEmission['cls'],
      field: fm ? (fm[1]!.toLowerCase() as 'cause' | 'descriptor') : null,
      value: fm ? fm[2]!.replace(/\s+/g, ' ').trim() : null,
      sections: emissionSections(after),
    });
  }
  return out;
}

// Named actors the repo already knows about, from system/entity-bindings.json — the registry every
// other entity-shaped check reads (fact-gate.ts). It carries what capitalisation cannot see: the
// lowercase-keyed continuously-traded instruments ("bitcoin", "ether"). Never throws: an unreadable
// registry degrades this leg to capitalisation, and fact-gate owns the PREMISE REGISTRY BLIND alarm.
let REGISTRY_ACTORS: RegExp[] | null = null;
function registryActors(): RegExp[] {
  if (REGISTRY_ACTORS) return REGISTRY_ACTORS;
  const res: RegExp[] = [];
  try {
    const j = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'system', 'entity-bindings.json'),
        'utf8'
      )
    );
    for (const b of j?.bindings ?? [])
      if (b?.correctRe) res.push(new RegExp(b.correctRe, 'i'));
    for (const c of j?.continuouslyTraded ?? [])
      if (c?.key) res.push(new RegExp(c.key, 'i'));
  } catch {
    /* registry unreadable → capitalisation only */
  }
  REGISTRY_ACTORS = res;
  return res;
}

// The SUBJECT CLAUSE of the cause: everything before the first clause boundary. Boundaries are drawn
// from the closed grammatical class of subordinators/coordinators plus punctuation — a finite function
// word list, not a content-word blacklist, which is the difference between a parse approximation and
// the word-list trap. "the Treasury's buyback announcement repriced term premium" has no boundary and
// stays whole; "the adjustment is landing on the layer THAT carries the asset, not the asset" cuts at
// `that`, leaving "the adjustment is landing on the layer" — which is the clause whose subject the
// Critic said names no agent. Degenerate cuts fall back to the whole field (the silent direction).
const CLAUSE_BOUNDARY_RE =
  /(?:[,;:])|\b(?:that|which|who|whom|whose|when|while|because|since|after|before|until|unless|if|so|and|but|rather|where|though|although)\b/i;

export function causeSubjectClause(cause: string): string {
  const m = CLAUSE_BOUNDARY_RE.exec(cause);
  if (!m || m.index === 0) return cause;
  const head = cause.slice(0, m.index).trim();
  return head.split(/\s+/).filter(Boolean).length >= 3 ? head : cause;
}

/**
 * Named actors in a `cause=` field's subject clause. A cause field is a FRAGMENT, not a sentence, and
 * the house writes it lowercase-initial — measured: ALL EIGHTEEN `cause=`/`descriptor=` fields emitted
 * 2026-08-01..22 start lowercase. So unlike `entitiesOf`, which must exempt sentence-initial capitals
 * because a capital there carries no information, a capital at position 0 HERE is a proper noun and is
 * counted. Same stoplists, same acronym/possessive handling, plus the registry.
 */
export function causeActors(cause: string): string[] {
  const subject = causeSubjectClause(cause);
  const out = new Set<string>();
  for (const tok of subject.split(/\s+/)) {
    const w = tok.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9.]+$/g, '');
    const bare = w.replace(/[.'’]s$/, '').replace(/\.$/, '');
    if (bare.length < 2) continue;
    if (SCOPE_STOP.has(bare.toLowerCase()) || TERM_STOP.has(bare.toLowerCase()))
      continue;
    const isCap = /^[A-Z]/.test(bare) && /[a-z]/.test(bare);
    const isAcronym = /^[A-Z][A-Z0-9.]{1,}$/.test(bare);
    if (isCap || isAcronym) out.add(bare);
  }
  for (const re of registryActors()) {
    const m = re.exec(subject);
    if (m) out.add(m[0]);
  }
  return [...out];
}

/** The QG's payoff region: the sweep + its emissions, ending before PAYOFF EXECUTION (which quotes the
 *  INTRO's own sentences and would otherwise look like a section collision). */
function payoffSweepBlock(qg: string): string {
  const lines = qg.split('\n');
  const marks: number[] = [];
  for (const e of qgPayoffEmissions(qg)) marks.push(e.line - 1);
  lines.forEach((l, i) => {
    if (/FRESH-FRAME SCAN/i.test(l)) marks.push(i);
  });
  if (!marks.length) return '';
  const start = Math.min(...marks);
  const out: string[] = [];
  for (let j = start; j < Math.min(lines.length, start + 120); j++) {
    if (j > start && /^#{1,6}\s/.test(lines[j]!)) break;
    if (/PAYOFF\s+EXECUTION:/i.test(lines[j]!)) break;
    out.push(lines[j]!);
  }
  return out.join('\n');
}

/** Candidate chunks = list items / bolded paragraphs. A bolded CONTINUATION line ("  **Signal-1** (…")
 *  is NOT a new candidate — requiring a bullet marker or column-0 bold is what keeps candidate D whole,
 *  and an over-split block hides the very quotes this leg reads. */
function candidateChunks(block: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const l of block.split('\n')) {
    if (/^\s{0,3}(?:[-*•]|\d+\.)\s+\*\*/.test(l) || /^\*\*/.test(l)) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [l];
    } else if (!l.trim()) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [];
    } else if (cur.length) cur.push(l);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

const SELECTION_RE = /\bSELECTED\b|✅\s*SELECT|→\s*SELECT|\bPROMOTED?\b/i;

/** The candidate that BECAME the payoff. Explicit marker first; else the chunk whose content terms best
 *  match the emitted class field (≥2 shared terms — a real link between sweep and emission, not a
 *  guess). If neither resolves, return null and stay SILENT: an advisory gate that cannot say WHICH
 *  candidate was selected has no business saying it was selected wrongly. */
function selectedCandidate(
  block: string,
  ems: PayoffEmission[]
): string | null {
  const chunks = candidateChunks(block);
  if (!chunks.length) return null;
  const marked = chunks.filter(c => SELECTION_RE.test(c));
  if (marked.length === 1) return marked[0]!;
  const emitted = [...ems].reverse().find(e => e.value);
  if (!emitted) return null;
  const target = contentTerms(emitted.value!);
  let best: { c: string; n: number } | null = null;
  for (const c of chunks) {
    const n = [...contentTerms(c)].filter(t => target.has(t)).length;
    if (!best || n > best.n) best = { c, n };
  }
  return best && best.n >= 2 ? best.c : null;
}

interface SectionSentence {
  section: string;
  sentence: string;
  closesParagraph: boolean;
}

/** Every sentence of every body paragraph/bullet, tagged with its section and whether it closes its
 *  paragraph. The intro is excluded by construction (`bodyAfterIntro`). */
function sectionSentences(brief: string): SectionSentence[] {
  const out: SectionSentence[] = [];
  let section = 'body';
  let para: string[] = [];
  const flush = () => {
    const text = para.join(' ').trim();
    para = [];
    if (!text) return;
    const sents = sentencesOf(text.replace(/[*_`]/g, ''));
    sents.forEach((s, i) =>
      out.push({
        section,
        sentence: s,
        closesParagraph: i === sents.length - 1,
      })
    );
  };
  for (const line of bodyAfterIntro(brief).split('\n')) {
    const h = /^#{1,6}\s*(?:▸\s*)?(.+)$/.exec(line);
    if (h) {
      flush();
      section = h[1]!.replace(/[*_`#]/g, '').trim();
      continue;
    }
    if (/^\s*(?:---|___|\*\*\*)\s*$/.test(line)) {
      flush();
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*[-*]\s+\*\*/.test(line)) flush(); // a new bullet is a new paragraph
    para.push(line);
  }
  flush();
  return out;
}

const normQuote = (s: string) =>
  s
    .replace(/[*_`]/g, '')
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/, '')
    .toLowerCase();

const QUOTED_SPAN_RE = /["“]([^"“”]{20,300})["”]/g;

export function checkPayoffMechanismEarned(
  brief: string,
  qg: string,
  briefDate: string | null
): string[] {
  if (briefDate && briefDate < PAYOFF_MECHANISM_EFFECTIVE_FROM) return [];
  if (!qg.trim()) return [];
  const ems = qgPayoffEmissions(qg);
  if (!ems.length) return []; // no own emission (08-12) — validate-brief owns presence
  const out: string[] = [];

  // ── LEG A — THE RELABEL. A same-night THEME/INVENTORY followed by a re-emitted MECHANISM/TENSION
  //    whose `cause=` names no actor anywhere in its subject clause.
  const labelIdx = ems.findIndex(
    e => e.cls === 'THEME' || e.cls === 'INVENTORY'
  );
  const upIdx = ems.findIndex(
    e =>
      (e.cls === 'MECHANISM' || e.cls === 'TENSION') &&
      e.field === 'cause' &&
      !!e.value
  );
  if (
    labelIdx !== -1 &&
    upIdx > labelIdx &&
    !CAUSE_AGENT_ATTESTATION.test(qg + brief)
  ) {
    const label = ems[labelIdx]!;
    const up = ems[upIdx]!;
    if (!causeActors(up.value!).length) {
      out.push(
        `PAYOFF MECHANISM UNEARNED — RELABEL, NOT A CAUSE. The QG emitted PAYOFF CLASS: ${label.cls} ` +
          `${label.field ?? 'descriptor'}='${label.value ?? ''}' at line ${label.line} and then re-emitted ` +
          `PAYOFF CLASS: ${up.cls} cause='${up.value}' at line ${up.line} — same night, same proposition, ` +
          `and the second one has a verb. Its subject clause ("${causeSubjectClause(up.value!)}") names NO ` +
          `ACTOR: no entity performs the causal verb, so the field says WHERE the move landed, not WHAT ` +
          `caused it. PASS 1g's own test is "BECAUSE <single cause>, we see A, B, C"; a clause with no ` +
          `agent cannot fill that blank, and a THEME with a participle bolted on is still a THEME. ` +
          `DOWNGRADE to THEME and RE-SWEEP for a cause with a named actor. 2026-08-22 receipt: the ` +
          `agent-bearing cause was already in the brief — the intro's own watch line said "the metals were ` +
          `paid for on the announcement" and the published v2 says "the Treasury's announced buyback of ` +
          `longer-dated debt repriced term premium". It was ineligible only because Treasury buybacks had ` +
          `led M&M on 08-20 and 08-21 and were demoted under entity cooldown — and per the PAYOFF ` +
          `MECHANISM EXEMPTION (system/Novelty_Audit.md, PASS 1g) a subject burned by entity cooldown ` +
          `remains eligible as the payoff's named cause: the intro is not a bullet and consumes no slot. ` +
          `RESOLVE: name the actor, or write one line — "PAYOFF-CAUSE-AGENT: <actor> — <what it did>".`
      );
    }
  }

  // ── LEG B — THE SELECTED FRAME IS A SECTION'S OWN SENTENCE.
  if (!FRAME_INDEPENDENCE_ATTESTATION.test(qg + brief)) {
    const block = payoffSweepBlock(qg);
    const sel = block ? selectedCandidate(block, ems) : null;
    if (sel) {
      const sents = sectionSentences(brief);
      const hits: SectionSentence[] = [];
      for (const m of sel.matchAll(QUOTED_SPAN_RE)) {
        const q = normQuote(m[1]!);
        if (q.split(' ').length < 6) continue; // a phrase is not a sentence
        const hit = sents.find(s => normQuote(s.sentence).includes(q));
        if (hit && !hits.some(h => h.sentence === hit.sentence)) hits.push(hit);
      }
      if (hits.length) {
        out.push(
          `PAYOFF FRAME IS THE SECTION'S OWN SENTENCE — the SELECTED payoff candidate is evidenced by ` +
            `${hits.length} verbatim body sentence${hits.length > 1 ? 's' : ''}: ` +
            hits
              .map(
                h =>
                  `"${h.sentence.slice(0, 90)}${h.sentence.length > 90 ? '…' : ''}" (${h.section}${h.closesParagraph ? ", its paragraph's closing sentence" : ''})`
              )
              .join(' · ') +
            `. The payoff is the conclusion the reader arrives at ABOVE the sections; a frame that is ` +
            `already a section's own sentence spends the most-read slot in the brief on a claim the body ` +
            `has already made, and the reader meets the same sentence twice. DOWNGRADE to THEME and ` +
            `RE-SWEEP. 2026-08-22 receipt: the QG selected "the repricing is landing on the carrier, not ` +
            `the cargo" and cited Signal-1 ("The thing that gives is the growth case, not the credit") and ` +
            `the Take ("They re-rated the clearinghouse, not the metal") as "the strongest available ` +
            `evidence that it is a real mechanism". Two sections closing on the frame is evidence the ` +
            `frame is REAL and evidence the INTRO has nothing left to add. The 08-19 QG met the same ` +
            `construction and got it right, rejecting its own candidate A as "unusable: M&M-3's own ` +
            `closing already IS this loop". RESOLVE: re-sweep, or write one line — ` +
            `"PAYOFF-FRAME-INDEPENDENCE: <what the intro concludes that no section does>".`
        );
      }
    }
  }
  return out;
}

// ─── IMP-212 — WATCH / CAUSE BINDING (2026-08-23 Critic mandate #2, RC5) ─────────────────────
//
// THE FAILURE, fifth-day recurrence, from the shipped 08-23 intro:
//   cause  (MECHANISM):  "Iran's closure of the Strait of Hormuz"     sections=[M&M-2, M&M-3, Geo-2,
//                                                                                Dashboard/Commodities]
//   watch:               "Watch what the dollar does into 8 September, when Canada's matching
//                         tariffs take effect."   -> resolves Geo-1. Names no oil, no strait, no reserve.
// The brief WROTE the correct watch itself, in M&M-3: "The week the weekly count stops falling is the
// week this administration decided a capped pump price is worth less than the barrels it would take…"
// `assembly-gate` EXIT 0. Identical verdict, identical exit, on 08-18 ("a position is worth whatever it
// costs to leave it" against "Watch Home Depot before the open this morning" → M&M-1).
//
// ⭐ WHY THIS IS NOT `checkWatchBinding` (IMP-190) WITH A WIDER NET. IMP-190 asks whether the watch's
// RESOLVED BODY UNIT shares a content term with the intro's own CONCLUSION CLAUSE, and it exited 0 on
// both nights — correctly, on its own terms. IMP-210 then made the `cause=` field carry a named agent.
// Nobody asked whether the WATCH carries the same object. So a payoff can pass with a well-formed cause
// and a watch pointing at an unrelated story, which is exactly the shape that shipped on 08-18 and
// 08-23. This check binds the watch to the QG's DECLARED CAUSE — the actor, the instrument, the
// mechanism's noun, and the span the cause claims — rather than to the intro's prose.
//
// ⭐ WHY THE SPAN LEG EXISTS, and why term overlap alone would have punished the repair. The Critic
// named the repair explicitly: swap the watch to the brief's own DOE-count sentence. That sentence
// shares ZERO literal terms with "Iran's closure of the Strait of Hormuz" — it talks about a weekly
// count, an administration and a pump price. A pure term-overlap check therefore FIRES on the
// mandated-silent repair. It is silent here because the DOE count resolves M&M-3, which is one of the
// cause's OWN DECLARED SECTIONS. That is the Critic's phrase "matched on the cause's own terms"
// operationalised: a cause states where it lives, and an observable inside that span tests it whatever
// vocabulary it uses. Two legs, either one silences.
//
// ⭐ AND WHY IT MUST FIND A FOREIGN UNIT BEFORE IT FIRES. The failure the Critic described is not "the
// watch is vague", it is "the watch resolves A DIFFERENT STORY". So the check must be able to NAME that
// story. A watch that resolves nothing (08-21: "so watch whether the thirty-year holds below its 5.33
// percent high") produces no accusation — silence is the only honest verdict, and 08-21 is the window's
// one awarded Must-Read (ceiling-trend: must_read_computed true, a_top 4). Condemning it would be the
// IMP-200/201 false-alarm class and would teach the next session to skim the flag.
//
// SCOPE: MECHANISM only. A TENSION names two forces and a parallel-tracks day names none, so neither
// has a single `cause=` to bind to — silent by construction, per the mandate.
//
// FLAG only, never FAIL, with the Critic's verbatim escape hatch — WHICH IS LOGGED, NEVER SILENT.
const WATCH_CAUSE_EFFECTIVE_FROM = '2026-08-23'; // IMP-125: no retroactive condemnation in production.

/** The Critic's verbatim grammar. A bare label may not buy silence: `resolves` and `because` are
 *  required, because the whole value of a declared exception is the sentence of reasoning it puts on
 *  disk. A malformed line does NOT suppress — it is reported as malformed. */
const WATCH_BINDING_DECL_RE =
  /PAYOFF-WATCH-BINDING:\s*(.+?)\s+resolves\s+(.+?)\s+because\s+(\S[^\n]*)/i;
const WATCH_BINDING_LABEL_RE = /PAYOFF-WATCH-BINDING:/i;

/**
 * The payoff's watch. `watchSentence` (IMP-190) requires a sentence-initial "Watch", which is the
 * house form; but 08-21 and 08-22 write it as a trailing clause ("…, so watch whether the thirty-year
 * holds…"). Reading only the sentence-initial form would make this check silent on the exact nights it
 * most needs to be honest about, so the clause form is read too — from `watch` to the sentence end.
 */
export function payoffWatchClause(intro: string): string | null {
  const direct = watchSentence(intro);
  if (direct) return direct;
  const sents = sentencesOf(intro.replace(/[*_]/g, ''));
  for (let i = sents.length - 1; i >= 0; i--) {
    const m = /\bwatch\b/i.exec(sents[i]!);
    if (m) return sents[i]!.slice(m.index).trim();
  }
  return null;
}

/**
 * The causal objects of a `cause=` field: its content terms plus the named actors IMP-210 already
 * knows how to extract (capitalised tokens + the entity registry). For "Iran's closure of the Strait
 * of Hormuz" that is {iran, closure, strait, hormuz} ∪ {Iran, Strait, Hormuz} — the actor, the
 * instrument and the mechanism's noun, which is the Critic's own list.
 */
export function causalObjects(cause: string): Set<string> {
  const out = new Set<string>(contentTerms(cause));
  for (const a of causeActors(cause)) out.add(a.toLowerCase());
  return out;
}

interface ResolvedUnit {
  id: string;
  ents: number;
  terms: number;
}

/**
 * Which body units the watch resolves to. Entity match is the strong signal (IMP-190's basis); a
 * ≥2-content-term match is the weak one, and it exists so a watch that names no proper noun (08-21)
 * can still be RESOLVED rather than accused. Both are symmetric across every unit, so neither can
 * favour the accusation.
 */
export function watchResolvedUnits(
  watch: string,
  units: Array<{ id: string; text: string }>
): ResolvedUnit[] {
  const ents = entitiesOf(watch);
  const wTerms = contentTerms(watch);
  const out: ResolvedUnit[] = [];
  for (const u of units) {
    const e = ents.filter(x => u.text.includes(x)).length;
    const uTerms = contentTerms(u.text);
    const t = [...wTerms].filter(x => uTerms.has(x)).length;
    if (e >= 1 || t >= 2) out.push({ id: u.id, ents: e, terms: t });
  }
  return out.sort((a, b) => b.ents * 4 + b.terms - (a.ents * 4 + a.terms));
}

export function checkWatchCauseBinding(
  brief: string,
  qg: string,
  briefDate: string | null
): string[] {
  if (briefDate && briefDate < WATCH_CAUSE_EFFECTIVE_FROM) return [];
  if (!qg.trim()) return [];

  // ── 1. THE DECLARED CAUSE. Preferred: the last MECHANISM emission carrying a `cause=`. Fallback,
  //    for the 08-18 shape — a THEME emission REWRITTEN to MECHANISM, where the executed class is
  //    MECHANISM but the mechanism proposition lives in `PAYOFF ROTATION: today = '…'`.
  const ems = qgPayoffEmissions(qg);
  const mech = [...ems]
    .reverse()
    .find(e => e.cls === 'MECHANISM' && e.field === 'cause' && !!e.value);
  let cause: string | null = mech?.value ?? null;
  let causeSrc = mech ? `QG PAYOFF CLASS line ${mech.line}` : '';
  if (!cause) {
    if (!/PAYOFF\s+EXECUTION:[^\n]*class\s*=\s*MECHANISM\b/i.test(qg))
      return []; // TENSION / THEME /
    // parallel-tracks: no single cause to bind to (the mandate's silent classes)
    const rot = /PAYOFF\s+ROTATION:[^\n]*today\s*=\s*'([^']+)'/i.exec(qg);
    if (!rot) return [];
    cause = rot[1]!.replace(/\s+/g, ' ').trim();
    causeSrc =
      'QG PAYOFF ROTATION (executed class=MECHANISM, no emitted cause= field)';
  }
  // THE SPAN IS THE QG'S LAST DECLARED `sections=`, whichever class carried it — never the union of
  // every emission. MEASURED, both ways: on 08-23 the union sweeps in Geo-1 from the superseded THEME
  // line and silences the mandated FIRE; taking only a MECHANISM-emission span leaves the 08-18 shape
  // (THEME emitted, MECHANISM executed) span-less, and 08-20 — recorded `payoff: pass` — then fires on
  // an ADI watch that does test the delivered watt in different vocabulary. The LAST declared span is
  // the QG's final statement of where the payoff lives, and it is the field the primary path already
  // reads. Floor across 2026-08-01..23: 3 of 23 nights, and they are exactly the three
  // `ceiling-trend.json` records as `payoff: fail` (08-18, 08-22, 08-23).
  const span: string[] =
    [...ems].reverse().find(e => e.sections.length)?.sections ?? [];

  // ── 2. THE WATCH.
  const stripped = brief.replace(/<!--[\s\S]*?-->/g, ' ');
  const intro = introBlock(stripped);
  if (!intro.trim()) return [];
  const watch = payoffWatchClause(intro);
  if (!watch) return []; // Phase 15 / ceiling-lint own watch ABSENCE, not this check

  // ── 3. LEG A — CAUSAL OBJECT. Does the watch speak any of the cause's own objects?
  const objects = causalObjects(cause);
  const shared = [...contentTerms(watch)].filter(t => objects.has(t));
  for (const e of entitiesOf(watch))
    if (objects.has(e.toLowerCase())) shared.push(e);
  if (shared.length) return [];

  // ── 4. LEG B — DECLARED SPAN. Does the watch resolve inside the sections the cause claims?
  const units = bodyUnits(brief);
  if (!units.length) return [];
  const resolved = watchResolvedUnits(watch, units);
  if (!resolved.length) return []; // resolves nothing → no different story to name → silent (08-21)
  const spanSet = new Set(span);
  if (resolved.some(r => spanSet.has(normUnitId(r.id)))) return [];
  const foreign = resolved[0]!;

  // ── 5. THE DECLARED EXCEPTION. Suppresses the finding, and is LOGGED — never silent.
  const decl = WATCH_BINDING_DECL_RE.exec(brief + '\n' + qg);
  if (decl) {
    return [
      `WATCH-BINDING EXCEPTION DECLARED (advisory note, not a defect) — the watch shares no causal ` +
        `object with cause='${cause}' and resolves ${foreign.id}, which is outside the declared span ` +
        `[${span.join(', ') || 'none declared'}]. Suppressed by an explicit declaration: ` +
        `"${decl[1]!.trim()} resolves ${decl[2]!.trim()} because ${decl[3]!.trim()}". Recorded so a ` +
        `declared exception is visible to the Editor and the Critic rather than invisible.`,
    ];
  }
  const malformed = WATCH_BINDING_LABEL_RE.test(brief + qg);

  return [
    `WATCH RESOLVES A DIFFERENT STORY THAN THE MECHANISM — the payoff declares ` +
      `PAYOFF CLASS: MECHANISM cause='${cause}' (${causeSrc})` +
      `${span.length ? ` sections=[${span.join(', ')}]` : ''}, and its watch — ` +
      `"${watch.slice(0, 140)}${watch.length > 140 ? '…' : ''}" — shares ZERO causal objects with that ` +
      `cause (the cause's objects: ${[...objects].slice(0, 8).join(', ')}) and resolves ${foreign.id}, ` +
      `which the cause does not claim. The watch is not a dated sentence; it is THE THING THAT WOULD ` +
      `PROVE THE CONCLUSION WRONG. A dated observable that settles a different story leaves the ` +
      `conclusion unfalsifiable, which is the one thing the payoff exists to prevent. ` +
      `2026-08-23 receipt: cause='Iran's closure of the Strait of Hormuz' against "Watch what the ` +
      `dollar does into 8 September, when Canada's matching tariffs take effect" — Geo-1, no oil, no ` +
      `strait, no reserve — while the brief's own M&M-3 had already written the correct watch ("the ` +
      `week the weekly count stops falling…, and that decision will show up in the DOE series"). ` +
      `Identical verdict on 08-18 and assembly-gate exited 0 both times. RESOLVE: re-point the watch ` +
      `at an observable inside the cause's own span, or write one line — ` +
      `"PAYOFF-WATCH-BINDING: <observable> resolves <cause> because <one sentence>"` +
      `${malformed ? '. NOTE: a PAYOFF-WATCH-BINDING: line is present but does not parse — the grammar requires BOTH "resolves" and "because"; a bare label may not buy silence' : ''}.`,
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

// ─── IMP-212 FIXTURES — FROZEN BYTES, copied out of the real files (Ledger rule 9) ───────────
// Every string below is verbatim from `daily-briefs/2026-08-23-v1.5.md`,
// `daily-briefs/2026-08-23-quality-gate-log.md`, `content/daily-updates/2026-08-18.md` and
// `daily-briefs/2026-08-18-quality-gate-log.md`. The check was MEASURED against those files first
// (23 nights, 2026-08-01..23, date guard OFF: FIRES on exactly 08-18, 08-22 and 08-23 — which is
// exactly the set `system/ceiling-trend.json` records as `payoff: fail`, and it is SILENT on 08-19,
// 08-20 and 08-21, every one of them `payoff: pass`). The bytes are frozen HERE so the assertion is
// world-state-independent: `-v1.5.md` is a draft, drafts get edited and swept, and an assertion that
// depends on tonight's working tree is an assertion that will lie to a future session.
// M&M-1 and M&M-2 are pinned as their real bold lead sentences (verbatim prefixes) — they exist only
// so the DOE bullet is M&M-**3** and the ordinals are the real ones.
const AUG23_QG = `\`PAYOFF CLASS (as shipped in v1): THEME descriptor='economic coercion is not free, and the bill does not always arrive at the address of the party being coerced' sections=[Intro, Geo-1, Geo-2, M&M-3] | watch=present | action=REWROTE intro conclusion to MECHANISM.\`

\`PAYOFF CLASS (v1.5): MECHANISM cause='Iran's closure of the Strait of Hormuz' sections=[M&M-2, M&M-3, Geo-2, Dashboard/Commodities] | watch=present (8 September, dated) | action=REWROTE intro conclusion.\`

\`PAYOFF EXECUTION: class=MECHANISM, action=REWROTE, watch=present (8 September, dated), intro final sentences='…'\``;

const AUG23_WATCH_SHIPPED = `Watch what the dollar does into 8 September, when Canada's matching tariffs take effect.`;
// The Critic's named repair — the brief's OWN M&M-3 sentence, put in the watch slot. "The repair must
// never be punished."
const AUG23_WATCH_DOE = `Watch the DOE weekly count: the week it stops falling is the week this administration decided a capped pump price is worth less than the barrels it would take, and that decision will show up in the DOE series before it shows up in anything anyone says.`;

const aug23Brief = (watch: string) => `# MARKETS, MEDITATIONS & MENTAL MODELS

## Sunday, August 23, 2026

### Canada Talks Died, Fifty Percent Landed

*Washington let 50 percent tariffs land on roughly $20 billion of Canadian goods at midnight on 22 August, after Ottawa declined an American request to align its external tariffs and police transshipment. Underneath that, most of the rest of this weekend traces to one thing, and it is not tariffs. Iran's closure of the Strait of Hormuz is now being paid for out of everyone's reserves except Iran's: Washington is down to 293.4 million barrels of strategic petroleum, its lowest since December 1982; Qatar, which did not close the strait, is cutting roughly 85 percent of its overseas aid and shrinking 8.6 percent this year; and the entire consensus that inflation cools from here rests on Brent falling 17 percent while the strait stays shut. A blockade that costs its author nothing has to be paid by someone, and the bill is arriving as an inventory drawdown, a sovereign budget cut and a forecast nobody has priced. ${watch}*

---

# ▸ THE SIX

## Markets & Macro

- **Two named strategists published the falsification test for the dollar-debasement argument this week, and all three of its conditions currently point away from crisis.**

- **US business activity expanded at its fastest pace since 2022, and the disinflation almost everyone is forecasting into year-end is an oil forecast wearing a policy costume.**

- **The Strategic Petroleum Reserve holds 293.4 million barrels, 41 percent of its authorized capacity and the lowest level since December 1982.** The Energy Department's latest weekly count has it down another 5.3 million barrels, part of a commitment to release 172 million while the Strait of Hormuz constrains Middle Eastern supply. The reserve is also the cheapest instrument any administration has for capping a fuel price without legislating one. Put the two Energy Department numbers together and the stock becomes a clock: 293.4 million barrels against the latest week's 5.3 million is roughly 55 weeks. The week the weekly count stops falling is the week this administration decided a capped pump price is worth less than the barrels it would take, and that decision will show up in the DOE series before it shows up in anything anyone says.

## Geopolitics

- **US tariffs of 50 percent landed on roughly $20 billion of Canadian goods at midnight on 22 August, and Canada will match them dollar for dollar from 8 September.** The covered goods run from wine and dairy to cement, clothing and hockey equipment. Mark Carney said Canada takes the step reluctantly, and that it will raise costs for Canadians. Bill Bishop's reading is the one that reframes it: Washington was asking Ottawa to join a tariff perimeter aimed at China, and Ottawa declined. A tariff rate used this way is not a revenue measure. It is a membership test.
`;

// 08-18 — the shape the Critic cites: a THEME emitted, then REWRITTEN to MECHANISM, so the mechanism
// proposition lives in PAYOFF ROTATION rather than in a `cause=` field.
const AUG18_QG = `\`PAYOFF CLASS: THEME descriptor='a commitment is dated and publishable while the thing it bought is measured by a blind instrument' sections=[Intro, AI&T-1, Geo-1, C&C-1] | watch=present | action=REWROTE intro conclusion to MECHANISM.\`

\`PAYOFF ROTATION: today = 'a position is worth whatever it costs to leave it'. Last 3, read from the quality-gate logs: 08-17 TENSION 'two bids pricing different worlds; one is early'; 08-16 MECHANISM 'the number that settles the outcome is held by a party outside the transaction'; 08-15 TENSION 'the alarming numbers shrank under re-measurement; one did not'. Result: DISTINCT.\`

\`PAYOFF EXECUTION: class=MECHANISM, action=REWROTE, watch=present (Home Depot before the open this morning; "resolves"), intro final sentence='Home Depot reports before the open this morning, and the retail block behind it resolves whether July's consumption miss was a consumer or a calendar.'\``;

const AUG18_BRIEF = `# MARKETS, MEDITATIONS & MENTAL MODELS

## Tuesday, August 18, 2026

### Stripe Buys the Off-Ramp

*Stripe agreed to pay more than seven billion dollars for a company whose whole product is making AI models interchangeable, and that price is the clearest read tonight on what a position is worth. The answer running through this brief is that a position is worth whatever it costs to leave it. Where leaving is cheap, the money migrates to whoever owns the door: Stripe buys the switching layer instead of a model, Mastercard buys the conversion rails instead of the card brand, and a model you can download onto a laptop leaves hosted providers selling nothing at that tier but speed. Where leaving is impossible, the money stays with whoever already holds the position: a carmaker cannot requalify a memory chip inside two years, a radiology department cannot reformulate the iodine atom out of a CT scan, and a homebuilder's rate buydown sits inside a contract the national price index cannot read. Tonight's Take runs the arithmetic backwards, on the Chinese firms that could move without Beijing's permission. Watch Home Depot before the open this morning, with Walmart on Thursday behind it.*

---

# ▸ THE SIX

## Markets & Macro

- **American factories printed nearly double what forecasters expected in August while American consumers printed their weakest month in over a year, and only one of those numbers came with a warning label attached at the source.** The New York Fed's Empire State index came in at 20.6 against a median forecast of 11.0, an 87 percent overshoot, with new orders and shipments both positive, so it is not one component carrying a weak survey. July retail sales, released Friday by the Census Bureau, fell 0.6 percent against an expected 0.1 percent rise, the sharpest monthly drop since May 2025. The mechanism nobody put in the headline is a marketing calendar: Amazon moved Prime Day from July to June this year, pulling nonstore spending into the prior month. Home Depot reports before the open this morning and Walmart on Thursday, and that block settles whether the miss was a consumer or a calendar.
`;

// Same 08-23 bytes, class swapped. TENSION names two forces and parallel-tracks names none, so
// neither has a single cause to bind to — the mandate's two structural SILENT classes.
const AUG23_QG_TENSION = `\`PAYOFF CLASS: TENSION 'a blockade that costs its author nothing vs a bill that arrives at someone else's address' sections=[M&M-2, M&M-3, Geo-2] | watch=present | action=REWROTE intro conclusion.\`

\`PAYOFF EXECUTION: class=TENSION, action=REWROTE, watch=present, intro final sentences='…'\``;
const AUG23_QG_PARALLEL = `\`PAYOFF CLASS: THEME descriptor='economic coercion is not free' sections=[Intro, Geo-1, Geo-2, M&M-3] | watch=present | action=REWROTE to parallel-tracks lead.\`

**CONVERGENCE: pattern = NONE (parallel tracks).** No single clean 3+-section mechanism that is not forced.

\`PAYOFF EXECUTION: class=PARALLEL-TRACKS, action=REWROTE, watch=present, intro final sentences='…'\``;

const WATCH_BINDING_DECLARED = `\nPAYOFF-WATCH-BINDING: the dollar into 8 September resolves Iran's closure of the Strait of Hormuz because the reserve drawdown is financed in dollars and a matching-tariff shock is the cleanest test of whether the bill is being paid by the coercer or the coerced.\n`;

const REAL13 = path.join(process.cwd(), 'daily-briefs/2026-08-13-v2.md');
const TRAILING = [
  'daily-briefs/2026-08-12-v2.md',
  'daily-briefs/2026-08-11-v2.md',
  'daily-briefs/2026-08-10-v2.md',
].map(f => path.join(process.cwd(), f));

// IMP-210 acceptance runs entirely against real bytes: the two QG logs the mandate names, the
// published brief, and every quality-gate log from 2026-08-01 onward.
const QG_22 = path.join(
  process.cwd(),
  'daily-briefs/2026-08-22-quality-gate-log.md'
);
const PUB_22 = path.join(process.cwd(), 'content/daily-updates/2026-08-22.md');
const QG_19 = path.join(
  process.cwd(),
  'daily-briefs/2026-08-19-quality-gate-log.md'
);
const PUB_19 = path.join(process.cwd(), 'content/daily-updates/2026-08-19.md');
const SHIPPED_CAUSE_22 =
  'the adjustment is landing on the layer that carries the asset, not the asset';
// The mandate's compliant control, verbatim from the mandate.
const COMPLIANT_CAUSE =
  "the Treasury's buyback announcement repriced term premium";

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
        return (
          out.length === 1 &&
          /WATCH ORPHANED FROM PAYOFF CLASS/.test(out[0]!) &&
          /M&M-1/.test(out[0]!)
        );
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
            b +
              '\n<!-- WATCH-BINDING: M&M-1 — the retail block prices what a shopper pays to switch stores. -->\n'
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
        const p = path.join(
          process.cwd(),
          'daily-briefs/2026-08-15-quality-gate-log.md'
        );
        return (
          !fs.existsSync(p) ||
          qgOwnPayoffClass(fs.readFileSync(p, 'utf8')) === 'MECHANISM'
        );
      },
    ],
    [
      "HISTORY-LINE DISCRIMINATION: the 08-12 QG log has NO own emission — its only PAYOFF CLASS lines are a quoted 08-11/10/09 history block, and reading one as tonight's class would condemn a clean brief",
      true,
      () => {
        const p = path.join(
          process.cwd(),
          'daily-briefs/2026-08-12-quality-gate-log.md'
        );
        if (!fs.existsSync(p)) return true;
        const qg = fs.readFileSync(p, 'utf8');
        // The naive first-match parser DOES find a class here — that is the trap being closed.
        return /PAYOFF CLASS:/i.test(qg) && qgOwnPayoffClass(qg) === null;
      },
    ],
    [
      "FIRES: the real 2026-08-15-v2 asserts TENSION twice against the QG's emitted MECHANISM → 2 findings",
      true,
      () => {
        const b = path.join(process.cwd(), 'daily-briefs/2026-08-15-v2.md');
        const q = path.join(
          process.cwd(),
          'daily-briefs/2026-08-15-quality-gate-log.md'
        );
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
        const q = path.join(
          process.cwd(),
          'daily-briefs/2026-08-12-quality-gate-log.md'
        );
        if (!fs.existsSync(b) || !fs.existsSync(q)) return false;
        const brief = fs.readFileSync(b, 'utf8');
        // Non-vacuous: the 08-12 brief genuinely DOES assert a payoff class.
        if (!briefPayoffClassAssertions(brief).some(a => a.cls === 'TENSION'))
          return true;
        return (
          checkPayoffClassConsistency(brief, fs.readFileSync(q, 'utf8'))
            .length > 0
        );
      },
    ],
    [
      'ROTATION FIRES: 08-13, 08-14 and 08-15 all emitted MECHANISM → the third consecutive device is flagged',
      true,
      () =>
        checkPayoffRotation('2026-08-15', d => {
          const p = path.join(
            process.cwd(),
            `daily-briefs/${d}-quality-gate-log.md`
          );
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
          const p = path.join(
            process.cwd(),
            `daily-briefs/${d}-quality-gate-log.md`
          );
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
        const fires = dates.filter(
          d => checkPayoffRotation(d, read) !== null
        ).length;
        return fires / dates.length > 0.25; // expected SILENT => ratio must stay at or below 25%
      },
    ],
    // ── IMP-167 (08-13 Critic mandate #3, RC5): payoff scope binding, on REAL files ──
    [
      "payoff-scope FIRES on the real 2026-08-13-v2 intro's unbound 'Gulf' (intro=1, body=0)",
      true,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(
          fs.readFileSync(REAL13, 'utf8'),
          '2026-08-13',
          new Set()
        ).some(m => /PAYOFF SCOPE UNBOUND/.test(m) && /\bGulf\b/.test(m)),
    ],
    [
      'payoff-scope FIRES on the unbound Daily Title numeral ("Two Chokepoints" vs a body naming three)',
      true,
      () =>
        !fs.existsSync(REAL13) ||
        checkPayoffScope(
          fs.readFileSync(REAL13, 'utf8'),
          '2026-08-13',
          new Set()
        ).some(m => /DAILY TITLE NUMERAL UNBOUND/.test(m)),
    ],
    [
      'payoff-scope SILENT on Patriot/Ukraine/Washington/September — four clean negatives from the SAME intro',
      false,
      () =>
        fs.existsSync(REAL13) &&
        checkPayoffScope(
          fs.readFileSync(REAL13, 'utf8'),
          '2026-08-13',
          new Set()
        ).some(m => /\b(Patriot|Ukraine|Washington|September)\b/.test(m)),
    ],
    [
      'payoff-scope SILENT on the trailing three intros (08-12, 08-11, 08-10 — all payoffs graded pass)',
      false,
      () =>
        TRAILING.filter(f => fs.existsSync(f)).some(
          f =>
            checkPayoffScope(
              fs.readFileSync(f, 'utf8'),
              '2026-08-13',
              new Set()
            ).length > 0
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
        checkPayoffScope(
          fs.readFileSync(REAL13, 'utf8'),
          '2026-08-12',
          new Set()
        ).length > 0,
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
          AUG20_HEADER.replace(
            '### At Least Four Billion',
            '### The Delivered Watt'
          )
        ).length > 0,
    ],
    [
      '[IMP-204] SILENT across every OTHER published July and August brief — 0 flags on 40+ files; the trigger is absent by construction on an ordinary night',
      false,
      () =>
        fs
          .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
          .filter(
            x => /^2026-0[78]-\d\d\.md$/.test(x) && !x.startsWith('2026-08-20')
          )
          .some(
            f =>
              checkTitlePayoffDemotion(
                fs.readFileSync(
                  path.join(process.cwd(), 'content/daily-updates', f),
                  'utf8'
                )
              ).length > 0
          ),
    ],
    [
      '[IMP-204] FIRES on the REAL PUBLISHED content/daily-updates/2026-08-20.md — the reader-facing bytes, the strongest form of this receipt',
      true,
      () => {
        const p = path.join(
          process.cwd(),
          'content/daily-updates/2026-08-20.md'
        );
        return fs.existsSync(p)
          ? checkTitlePayoffDemotion(fs.readFileSync(p, 'utf8')).length > 0
          : true;
      },
    ],
    // --- IMP-210 (08-22 mandate #3, RC5): PAYOFF MECHANISM EARNED. Three mandated cases, both
    //     directions, plus the measured false-positive floor. Every assertion reads bytes on disk. ---
    [
      '[IMP-210] EMISSION GRAMMAR: the real 08-22 log yields exactly TWO own emissions (v1 THEME descriptor, v1.5 MECHANISM cause) and the real 08-12 log — whose only PAYOFF CLASS lines are a quoted history block — yields ZERO. The iterating parser must not read prose ABOUT the rule as an emission',
      true,
      () => {
        if (!fs.existsSync(QG_22)) return true;
        const a = qgPayoffEmissions(fs.readFileSync(QG_22, 'utf8'));
        const q12 = path.join(
          process.cwd(),
          'daily-briefs/2026-08-12-quality-gate-log.md'
        );
        const b = fs.existsSync(q12)
          ? qgPayoffEmissions(fs.readFileSync(q12, 'utf8'))
          : [];
        return (
          a.length === 2 &&
          a[0]!.cls === 'THEME' &&
          a[0]!.field === 'descriptor' &&
          a[1]!.cls === 'MECHANISM' &&
          a[1]!.field === 'cause' &&
          a[1]!.value === SHIPPED_CAUSE_22 &&
          b.length === 0
        );
      },
    ],
    [
      "[IMP-210] LEG A FIRES on the REAL 08-22 QG log — v1 THEME descriptor='a claim on an asset is not the asset' re-emitted as v1.5 MECHANISM cause='the adjustment is landing on the layer that carries the asset, not the asset', whose subject clause names no actor. Same proposition, second one has a verb",
      true,
      () =>
        !fs.existsSync(QG_22) ||
        !fs.existsSync(PUB_22) ||
        checkPayoffMechanismEarned(
          fs.readFileSync(PUB_22, 'utf8'),
          fs.readFileSync(QG_22, 'utf8'),
          '2026-08-22'
        ).some(m => /RELABEL, NOT A CAUSE/.test(m)),
    ],
    [
      '[IMP-210] AGENT DISCRIMINATION, unit level: the mandate\'s compliant cause ("the Treasury\'s buyback announcement repriced term premium") resolves an actor — Treasury — and the shipped one resolves none. Structural, not lexical: the subject clause is cut at the closed-class boundary `that`, leaving "the adjustment is landing on the layer"',
      true,
      () =>
        causeActors(COMPLIANT_CAUSE).some(a => /Treasury/i.test(a)) &&
        causeActors(SHIPPED_CAUSE_22).length === 0 &&
        causeSubjectClause(SHIPPED_CAUSE_22) ===
          'the adjustment is landing on the layer',
    ],
    [
      '[IMP-210] LEG A SILENT on a compliant agent-bearing cause — the REAL published v2\'s own sentence ("the Treasury\'s announced buyback of longer-dated debt repriced term premium") spliced into the REAL 08-22 log in place of the shipped one. The gate must condemn the relabel, not the reclassification',
      false,
      () => {
        if (!fs.existsSync(QG_22) || !fs.existsSync(PUB_22)) return false;
        const pub = fs.readFileSync(PUB_22, 'utf8');
        const compliant =
          /the Treasury['’]s announced buyback of longer-dated debt repriced term premium/i.exec(
            pub
          );
        if (!compliant) return true; // the receipt sentence is gone from the published bytes — fail loudly
        return checkPayoffMechanismEarned(
          pub,
          fs
            .readFileSync(QG_22, 'utf8')
            .split(SHIPPED_CAUSE_22)
            .join(compliant[0]),
          '2026-08-22'
        ).some(m => /RELABEL, NOT A CAUSE/.test(m));
      },
    ],
    [
      '[IMP-210] LEG B FIRES on the REAL 08-22 log + REAL published brief — the SELECTED candidate D is evidenced by two verbatim section sentences ("They re-rated the clearinghouse, not the metal" — the Take, its paragraph\'s closer; "The thing that gives is the growth case, not the credit" — the Signal)',
      true,
      () =>
        !fs.existsSync(QG_22) ||
        !fs.existsSync(PUB_22) ||
        checkPayoffMechanismEarned(
          fs.readFileSync(PUB_22, 'utf8'),
          fs.readFileSync(QG_22, 'utf8'),
          '2026-08-22'
        ).some(
          m =>
            /PAYOFF FRAME IS THE SECTION'S OWN SENTENCE/.test(m) &&
            /clearinghouse/.test(m) &&
            /growth case/.test(m)
        ),
    ],
    [
      '[IMP-210] SILENT on the REAL 08-19 — the trend file records payoff: pass, a_top: 4, and a gate that condemns a known-good intro is the IMP-200/201 false-alarm class. NON-VACUOUS, and the date guard is turned OFF so the silence is earned: 08-19 HAS an own emission and its sweep DOES quote a body sentence verbatim. It is silent because that sentence evidences candidate A, which that QG REJECTED — "unusable: M&M-3\'s own closing already IS this loop" — i.e. 08-19 is this very rule applied by hand',
      false,
      () => {
        if (!fs.existsSync(QG_19) || !fs.existsSync(PUB_19)) return false;
        const qg = fs.readFileSync(QG_19, 'utf8');
        const brief = fs.readFileSync(PUB_19, 'utf8');
        if (!qgPayoffEmissions(qg).length) return true; // vacuous negative → fail loudly
        const sents = sectionSentences(brief);
        const sweepQuotesBody = [
          ...payoffSweepBlock(qg).matchAll(QUOTED_SPAN_RE),
        ].some(m => {
          const q = normQuote(m[1]!);
          return (
            q.split(' ').length >= 6 &&
            sents.some(s => normQuote(s.sentence).includes(q))
          );
        });
        if (!sweepQuotesBody) return true; // vacuous negative → fail loudly
        return checkPayoffMechanismEarned(brief, qg, null).length > 0;
      },
    ],
    [
      '[IMP-210] NO RETRO (IMP-125) — the same 08-22 bytes take no finding at a brief date before 2026-08-22',
      false,
      () =>
        fs.existsSync(QG_22) &&
        fs.existsSync(PUB_22) &&
        checkPayoffMechanismEarned(
          fs.readFileSync(PUB_22, 'utf8'),
          fs.readFileSync(QG_22, 'utf8'),
          '2026-08-21'
        ).length > 0,
    ],
    [
      '[IMP-210] ESCAPE HATCHES silence the check: PAYOFF-CAUSE-AGENT + PAYOFF-FRAME-INDEPENDENCE on the real 08-22 bytes take it to zero findings — a hatch that does not silence is decoration',
      false,
      () => {
        if (!fs.existsSync(QG_22) || !fs.existsSync(PUB_22)) return false;
        const qg =
          fs.readFileSync(QG_22, 'utf8') +
          '\n`PAYOFF-CAUSE-AGENT: the Treasury — its announced buyback of longer-dated debt repriced term premium.`\n' +
          '`PAYOFF-FRAME-INDEPENDENCE: the intro names the one cause under all three cross-asset prints; no section names it.`\n';
        return (
          checkPayoffMechanismEarned(
            fs.readFileSync(PUB_22, 'utf8'),
            qg,
            '2026-08-22'
          ).length > 0
        );
      },
    ],
    [
      '[IMP-210] THE HATCHES ARE PER-LEG — attesting the cause agent leaves the section-collision finding standing, and vice versa. One line may not buy silence on a defect it does not address',
      true,
      () => {
        if (!fs.existsSync(QG_22) || !fs.existsSync(PUB_22)) return true;
        const brief = fs.readFileSync(PUB_22, 'utf8');
        const qg = fs.readFileSync(QG_22, 'utf8');
        const a = checkPayoffMechanismEarned(
          brief,
          qg +
            '\n`PAYOFF-CAUSE-AGENT: the Treasury — the buyback repriced term premium.`\n',
          '2026-08-22'
        );
        const b = checkPayoffMechanismEarned(
          brief,
          qg +
            '\n`PAYOFF-FRAME-INDEPENDENCE: the intro concludes above the sections.`\n',
          '2026-08-22'
        );
        return (
          a.length === 1 &&
          /SECTION'S OWN SENTENCE/.test(a[0]!) &&
          b.length === 1 &&
          /RELABEL, NOT A CAUSE/.test(b[0]!)
        );
      },
    ],
    [
      '[IMP-210] FALSE-POSITIVE FLOOR — swept across EVERY quality-gate log from 2026-08-01 onward with the date guard OFF (the only way the floor means anything): exactly ONE night flags, and it is 2026-08-22. An unconditional agent rule would have flagged 7 of the 12 MECHANISM nights; an unscoped section-collision rule would have flagged 08-02, 08-18 and 08-19',
      false,
      () => {
        const dir = path.join(process.cwd(), 'daily-briefs');
        if (!fs.existsSync(dir)) return true;
        const dates = fs
          .readdirSync(dir)
          .filter(f => /^\d{4}-\d{2}-\d{2}-quality-gate-log\.md$/.test(f))
          .map(f => f.slice(0, 10))
          .filter(d => d >= '2026-08-01')
          .sort();
        if (dates.length < 20) return true; // a sweep this thin proves nothing → fail loudly
        const flagged = dates.filter(d => {
          const pub = path.join(process.cwd(), `content/daily-updates/${d}.md`);
          const v2 = path.join(dir, `${d}-v2.md`);
          const bp = fs.existsSync(pub) ? pub : fs.existsSync(v2) ? v2 : null;
          if (!bp) return false;
          return (
            checkPayoffMechanismEarned(
              fs.readFileSync(bp, 'utf8'),
              fs.readFileSync(
                path.join(dir, `${d}-quality-gate-log.md`),
                'utf8'
              ),
              null
            ).length > 0
          );
        });
        return !(flagged.length === 1 && flagged[0] === '2026-08-22');
      },
    ],
    // ── IMP-212 (08-23 Critic mandate #2, RC5): WATCH / CAUSE BINDING. Every fixture is frozen
    //    bytes copied out of the real files (Ledger rule 9) — no directory sweep, no assertion that
    //    any production incident is currently outstanding.
    [
      "[IMP-212] FIRES on the REAL 2026-08-23 pair — cause='Iran's closure of the Strait of Hormuz' (sections M&M-2/M&M-3/Geo-2/Dashboard) against \"Watch what the dollar does into 8 September, when Canada's matching tariffs take effect\": zero shared causal objects AND it resolves Geo-1, which the cause does not claim. assembly-gate exited 0 on this on the night; the Critic graded the payoff FAIL for the fifth-day recurrence of this defect",
      true,
      () => {
        const out = checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED),
          AUG23_QG,
          '2026-08-23'
        );
        return (
          out.length === 1 &&
          /WATCH RESOLVES A DIFFERENT STORY THAN THE MECHANISM/.test(out[0]!) &&
          /resolves Geo-1/.test(out[0]!) &&
          /Strait of Hormuz/.test(out[0]!)
        );
      },
    ],
    [
      '[IMP-212] FIRES on the 08-18 pair the Critic cites and `ceiling-trend.json` records as `payoff: fail` — the mechanism is "a position is worth whatever it costs to leave it" and the watch is "Watch Home Depot before the open this morning, with Walmart on Thursday behind it", which resolves M&M-1 (a consumer-vs-calendar question that touches switching cost nowhere). NON-VACUOUS: this night emits a THEME and EXECUTES a MECHANISM, so the cause is read from PAYOFF ROTATION — the shape a cause=-only parser cannot see',
      true,
      () => {
        const out = checkWatchCauseBinding(AUG18_BRIEF, AUG18_QG, '2026-08-23');
        return (
          out.length === 1 &&
          /WATCH RESOLVES A DIFFERENT STORY THAN THE MECHANISM/.test(out[0]!) &&
          /resolves M&M-1/.test(out[0]!) &&
          /a position is worth whatever it costs to leave it/.test(out[0]!)
        );
      },
    ],
    [
      "[IMP-212] SILENT on THE REPAIR — the identical 08-23 bytes with the watch swapped to the brief's own DOE-count sentence, the fix the Critic named. It shares no literal term with \"Iran's closure of the Strait of Hormuz\" either, so a term-overlap-only check would punish it; it is silent because it resolves M&M-3, one of the cause's OWN declared sections. THE REPAIR MUST NEVER BE PUNISHED — a gate that flags the fix teaches the Writer to route around it",
      false,
      () =>
        checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_DOE),
          AUG23_QG,
          '2026-08-23'
        ).length > 0,
    ],
    [
      "[IMP-212] SILENT on the REAL 2026-08-21 payoff — `ceiling-trend.json` records must_read_computed: true, a_top: 4, the window's ONE awarded Must-Read. Its watch (\"so watch whether the thirty-year holds below its 5.33 percent high of 18 August until then\") resolves M&M-1, inside the cause's declared span [Intro, M&M-1, Geo-1, Geo-2]. A gate that condemns the week's best brief is the IMP-200/201 false-alarm class",
      false,
      () => {
        const b = path.join(
          process.cwd(),
          'content/daily-updates/2026-08-21.md'
        );
        const q = path.join(
          process.cwd(),
          'daily-briefs/2026-08-21-quality-gate-log.md'
        );
        if (!fs.existsSync(b) || !fs.existsSync(q)) return false;
        return (
          checkWatchCauseBinding(
            fs.readFileSync(b, 'utf8'),
            fs.readFileSync(q, 'utf8'),
            '2026-08-23'
          ).length > 0
        );
      },
    ],
    [
      '[IMP-212] SILENT on a TENSION payoff — the SAME 08-23 brief bytes and the SAME orphaned watch, with the class swapped to TENSION. A tension names two forces and has no single cause= to bind to. This is the discrimination proof: only the CLASS differs between this assertion and the mandated FIRE above',
      false,
      () =>
        checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED),
          AUG23_QG_TENSION,
          '2026-08-23'
        ).length > 0,
    ],
    [
      '[IMP-212] SILENT on a parallel-tracks payoff — same bytes, same orphaned watch, `class=PARALLEL-TRACKS` with CONVERGENCE = NONE. A parallel-tracks day declares no mechanism at all, so there is nothing for the watch to be bound to',
      false,
      () =>
        checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED),
          AUG23_QG_PARALLEL,
          '2026-08-23'
        ).length > 0,
    ],
    [
      '[IMP-212] THE DECLARED EXCEPTION SUPPRESSES THE DEFECT — one `PAYOFF-WATCH-BINDING: <observable> resolves <cause> because <sentence>` line on the 08-23 bytes takes the finding to zero. A hatch that does not silence is decoration',
      false,
      () =>
        checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED) + WATCH_BINDING_DECLARED,
          AUG23_QG,
          '2026-08-23'
        ).some(m => /WATCH RESOLVES A DIFFERENT STORY/.test(m)),
    ],
    [
      "[IMP-212] …AND IT IS LOGGED, NEVER SILENT — the same declared exception still emits a WATCH-BINDING EXCEPTION DECLARED note carrying the declaration's own words. An escape hatch the Editor and the Critic cannot see is an undocumented policy change",
      true,
      () => {
        const out = checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED) + WATCH_BINDING_DECLARED,
          AUG23_QG,
          '2026-08-23'
        );
        return (
          out.length === 1 &&
          /WATCH-BINDING EXCEPTION DECLARED/.test(out[0]!) &&
          /because the reserve drawdown is financed in dollars/.test(out[0]!)
        );
      },
    ],
    [
      '[IMP-212] A MALFORMED HATCH DOES NOT BUY SILENCE — a bare `PAYOFF-WATCH-BINDING: the dollar` with no "resolves"/"because" leaves the finding standing and is called out as malformed. The whole value of a declared exception is the sentence of reasoning it puts on disk',
      true,
      () => {
        const out = checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED) +
            '\nPAYOFF-WATCH-BINDING: the dollar\n',
          AUG23_QG,
          '2026-08-23'
        );
        return (
          out.length === 1 &&
          /WATCH RESOLVES A DIFFERENT STORY/.test(out[0]!) &&
          /does not parse/.test(out[0]!)
        );
      },
    ],
    [
      '[IMP-212] NO RETRO (IMP-125) — the same 08-23 bytes take no finding at a brief date before 2026-08-23. A gate may not condemn nights that shipped before it existed',
      false,
      () =>
        checkWatchCauseBinding(
          aug23Brief(AUG23_WATCH_SHIPPED),
          AUG23_QG,
          '2026-08-22'
        ).length > 0,
    ],
    [
      '[IMP-212] section-id canonicalisation — the QG writes the AI section as `AI&T-1` (08-18) and as `AI-1` (08-22), and `bodyUnits` emits `Geo-2`/`M&M-3` inside brackets. A span check that cannot see through that silently loses a declared section, which in THIS gate means a FALSE FIRE',
      true,
      () =>
        normUnitId(' AI&T-1 ') === 'AI-1' &&
        normUnitId('AI-1') === 'AI-1' &&
        normUnitId('[M&M-3') === 'M&M-3' &&
        normUnitId('Geo-2 ') === 'GEO-2',
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
      // IMP-210 — 08-22 mandate #3: the MECHANISM label must be EARNED. Two legs: a same-night relabel
      // whose cause names no actor, and a selected frame that is already a section's own sentence.
      for (const msg of checkPayoffMechanismEarned(brief, qg, dateM[1]!))
        findings.push({ severity: 'FLAG', message: msg });
      // IMP-212 — 08-23 mandate #2: on a MECHANISM payoff the watch must share a causal object with
      // the declared cause, or resolve inside the span that cause claims. A declared
      // `PAYOFF-WATCH-BINDING:` line suppresses the defect and is LOGGED here, never silent.
      for (const msg of checkWatchCauseBinding(brief, qg, dateM[1]!))
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
  !!process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('assembly-gate.ts');
if (invokedDirectly) main();
