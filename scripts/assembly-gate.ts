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
    }
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
