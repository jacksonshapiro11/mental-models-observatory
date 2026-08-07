#!/usr/bin/env node --experimental-strip-types
/**
 * causal-sequence-gate.ts — IMP-137 (2026-08-07, RC2). Critic mandate #1, 2026-08-07.
 *
 * THE FAILURE THIS EXISTS FOR. The 2026-08-07 brief's Take and its payoff intro both said:
 *
 *   "The FCC banned a class of foreign robot without spending a dollar, and Ohio answered
 *    with $762 million of its own."
 *
 * Every number in that sentence is correct. $762M is correct ($310M JobsOhio + $452.2M JCTC).
 * July 28, 2026 is the correct FCC Covered List date. And the sentence is false, because
 * Ohio's money was committed between 2025-01-27 and 2025-07 — twelve to eighteen months
 * BEFORE the policy it is said to answer. The Take's whole mechanism ("a costless policy
 * summons unrecoverable capital") ran backwards in time, and the error propagated into the
 * intro's second sentence, failing the payoff on requirement (a) TRUE.
 *
 * WHY NOTHING CAUGHT IT. The entire truth stack is number-shaped. `fact-gate` extracts
 * numerals against an asset lexicon; `superlative-escalation-gate` checks extremes;
 * `wildcard-freshness-gate` checks publication dates against publishers. Every one of them
 * would have verified "$762 million" and "July 28" as individually correct and never asked
 * WHICH CAME FIRST. Ordering is not a number, so the number-shaped stack is blind to it.
 * (E-EVIDENCE-SELECTION-01, opened as a Day-1 EMERGENCY the same night.)
 *
 * THE DISCRIMINATION, and it is the whole design. Three sentence shapes look similar and
 * mean completely different things:
 *
 *   TIER A — RESPONSE. "X did this, and Y ANSWERED with …" asserts that Y acted BECAUSE of
 *     X. That is a dated claim wearing no date. It must carry a `causal:` truth row naming
 *     both events and both dates, and the antecedent must actually precede the consequent.
 *
 *   ANTERIORITY — "the $762 million Ohio HAD ALREADY SUNK … is what now makes the ban
 *     expensive to lift" is the CORRECTED form of the same facts. It asserts priority rather
 *     than response, so it is exempt. A gate that fired here would punish the repair and
 *     teach the Writer to avoid the true construction — the precise inverse of the job.
 *
 *   TIER B — ORDERED INTERVAL. "Hadrian raised $1.37 billion SEVEN DAYS AFTER two federal
 *     agencies ruled…" states its own ordering with an interval, and here it is correct
 *     (FAA 2026-07-29 → NHTSA 2026-07-30 → round 2026-08-06). Silent by default; checked
 *     only when a `causal:` row exists to check it against. Cheap to be right about, and
 *     firing on it would be a false-positive storm on every correctly-ordered sentence.
 *
 * THE POINT IS THE REQUIREMENT, NOT THE CLEVERNESS. This gate does not try to parse events
 * out of prose — that would be a worse `fact-gate`. It requires that any sentence claiming
 * B RESPONDED TO A be backed by a truth row that dates both. The Writer cannot invert an
 * ordering it is required to record, and a recorded ordering is mechanically checkable.
 *
 * Usage: node --experimental-strip-types scripts/causal-sequence-gate.ts <brief.md> [--truth <path>] [--require-resolved]
 *        node --experimental-strip-types scripts/causal-sequence-gate.ts --selftest
 * Exit:  0 clean (FLAGs may print) · 1 FAIL (inverted order, or uncovered under
 *        --require-resolved) · 2 usage error
 * Wired into: system/Brief_Editor.md Gate 1 · system/Take_Generator.md (emission requirement).
 */
import * as fs from 'fs';
import * as path from 'path';

export interface CausalFinding {
  check: 'causal-sequence' | 'causal-sequence-unresolved';
  severity: 'FAIL' | 'FLAG';
  message: string;
  sentence: string;
}

interface CausalRow {
  resolved?: boolean;
  match?: string;
  antecedent?: string; antecedentDate?: string;
  consequent?: string; consequentDate?: string;
  note?: string;
}

/**
 * IMP-131's lesson, inherited deliberately: the Editor documents the brief INSIDE the brief,
 * so any gate that reads raw markdown eventually grades the Editor's prose about a section
 * instead of the section. The more carefully the pipeline explains itself, the likelier an
 * unguarded gate is to fire on the explanation. Newlines are preserved so line/offset math
 * stays byte-aligned, and an unterminated `<!--` is treated as commentary to EOF exactly as
 * a renderer would.
 */
export function stripHtmlComments(md: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = md.indexOf('<!--', i);
    if (start === -1) { out += md.slice(i); break; }
    out += md.slice(i, start);
    const end = md.indexOf('-->', start);
    const body = end === -1 ? md.slice(start) : md.slice(start, end + 3);
    out += body.replace(/[^\n]/g, ' ');
    if (end === -1) break;
    i = end + 3;
  }
  return out;
}

/** TIER A — the sentence asserts that one party acted BECAUSE another did. */
const RESPONSE_RE = new RegExp([
  /\banswered\s+(?:it\s+)?(?:with|by)\b/, /\banswered\s+that\b/,
  /\bin\s+response\s+to\b/, /\bresponded\s+(?:to|with|by)\b/, /\bresponding\s+to\b/,
  /\bretaliat(?:ed|ing)\s+(?:with|by|against)\b/, /\bcounter(?:ed|ing)\s+with\b/,
  /\bfollowed\s+suit\b/, /\breplied\s+with\b/, /\bhit\s+back\s+with\b/,
  /\bstaked\s+[^.;]{0,80}\bon\s+a\s+(?:listing|ruling|docket|determination|policy)\b/,
  /\bpriced\s+[^.;]{0,60}\b(?:off|against)\s+(?:the\s+)?(?:listing|ruling|clearance|determination)\b/,
  /\bprompted\s+by\b/, /\bspurred\s+by\b/, /\bdrew\s+[^.;]{0,40}\bin\s+response\b/,
].map((r) => r.source).join('|'), 'i');

/**
 * ANTERIORITY — the sentence explicitly places the money/act BEFORE the trigger. This is
 * the corrected 08-07 construction and must stay silent, or the gate punishes the repair.
 */
const ANTERIORITY_RE = new RegExp([
  /\bhad\s+already\b/, /\balready\s+(?:sunk|spent|committed|in\s+the\s+ground|paid|built)\b/,
  /\bwas\s+already\b/, /\bpre-?existing\b/, /\bpredates?\b/, /\bpre-?dated\b/,
  /\bbefore\s+the\s+(?:FCC|agency|ruling|listing|policy|determination|ban|order|vote)\b/,
  /\balready\s+in\s+the\s+ground\b/, /\bmonths?\s+(?:earlier|before)\b/, /\byears?\s+(?:earlier|before)\b/,
  /\bhad\s+been\s+(?:committed|approved|inked|signed|announced)\b/,
].map((r) => r.source).join('|'), 'i');

/** TIER B — the sentence states its own ordering with an explicit interval. */
const INTERVAL_RE = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen)\s+(?:day|week|month|year)s?\s+(?:after|later|before|earlier)\b/i;

export function splitSentences(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((para) => para.split(/(?<=[.!?])\s+(?=[A-Z"“(])/))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 30);
}

function loadTruth(truthPath: string | null): Record<string, CausalRow> {
  if (!truthPath || !fs.existsSync(truthPath)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
    const claims = (j.claims ?? j) as Record<string, CausalRow>;
    const out: Record<string, CausalRow> = {};
    for (const [k, v] of Object.entries(claims)) if (k.startsWith('causal:')) out[k] = v;
    return out;
  } catch { return {}; }
}

/** A row covers a sentence when its `match` regex hits, or both event labels appear. */
function coveringRow(sentence: string, rows: Record<string, CausalRow>): [string, CausalRow] | null {
  for (const [key, row] of Object.entries(rows)) {
    if (row.match) {
      try { if (new RegExp(row.match, 'i').test(sentence)) return [key, row]; } catch { /* bad row: fall through */ }
    }
    const a = row.antecedent?.trim();
    const c = row.consequent?.trim();
    if (a && c && new RegExp(escapeRe(a), 'i').test(sentence) && new RegExp(escapeRe(c), 'i').test(sentence)) {
      return [key, row];
    }
  }
  return null;
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function causalSequence(
  body: string,
  truth: Record<string, CausalRow>,
  opts: { requireResolved?: boolean } = {},
): CausalFinding[] {
  const findings: CausalFinding[] = [];
  const clean = stripHtmlComments(body);
  for (const sentence of splitSentences(clean)) {
    if (ANTERIORITY_RE.test(sentence)) continue;      // asserts priority, not response — the corrected form
    const isResponse = RESPONSE_RE.test(sentence);
    const isInterval = INTERVAL_RE.test(sentence);
    if (!isResponse && !isInterval) continue;

    const hit = coveringRow(sentence, truth);
    if (!hit) {
      if (!isResponse) continue;                       // TIER B is silent without a row to check against
      findings.push({
        check: 'causal-sequence-unresolved',
        severity: opts.requireResolved ? 'FAIL' : 'FLAG',
        message:
          `UNDATED CAUSAL CLAIM — this sentence asserts that one event was a RESPONSE to another, and nothing in ` +
          `{DATE}-truth.json dates either end of it. Ordering is not a number, so no other gate in the stack can see it. ` +
          `Record a "causal:<slug>" row with antecedent/antecedentDate and consequent/consequentDate, then re-run. ` +
          `2026-08-07 receipt: "the FCC banned a class of foreign robot ... and Ohio answered with $762 million of its own" ` +
          `— every figure correct, and Ohio's money predates the FCC listing by 12-18 months.`,
        sentence: sentence.slice(0, 220),
      });
      continue;
    }
    const [key, row] = hit;
    const aD = row.antecedentDate;
    const cD = row.consequentDate;
    if (!aD || !cD) {
      findings.push({
        check: 'causal-sequence-unresolved',
        severity: opts.requireResolved ? 'FAIL' : 'FLAG',
        message: `INCOMPLETE CAUSAL ROW — ${key} covers this sentence but is missing ${!aD ? 'antecedentDate' : 'consequentDate'}. A causal row without both dates cannot be checked and is not evidence.`,
        sentence: sentence.slice(0, 220),
      });
      continue;
    }
    if (row.resolved === false) {
      findings.push({
        check: 'causal-sequence-unresolved',
        severity: opts.requireResolved ? 'FAIL' : 'FLAG',
        message: `UNRESOLVED CAUSAL ROW — ${key} is marked resolved:false. Verify both dates against primary sources before this ships.`,
        sentence: sentence.slice(0, 220),
      });
      continue;
    }
    if (new Date(aD).getTime() >= new Date(cD).getTime()) {
      findings.push({
        check: 'causal-sequence',
        severity: 'FAIL',
        message:
          `CAUSAL SEQUENCE INVERTED — the sentence says "${row.consequent ?? 'the consequent'}" responded to ` +
          `"${row.antecedent ?? 'the antecedent'}", but ${key} dates the antecedent ${aD} and the consequent ${cD}. ` +
          `The response predates its trigger, so the causal claim is FALSE however correct its numbers are. ` +
          `Per the Fact & Superlative Test this is a REWRITE, not a repair: when the wrong fact is the section's ` +
          `premise, restate it as pre-existing capital/action rather than a response.`,
        sentence: sentence.slice(0, 220),
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
function selftest(): number {
  const root = process.cwd();
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`); if (!ok) fails++; };

  // The VERBATIM false sentence. It no longer exists in daily-briefs/2026-08-07-v2.md because
  // the Morning Truth Gate repaired the artifact at 05:27 — so the honest fixture is the
  // Critic's own quotation of it, which IS on disk in daily-briefs/2026-08-07-critic.md.
  const FALSE_INTRO =
    'The FCC banned a class of foreign robot without spending a dollar, and Ohio answered with $762 million of its own.';
  const criticPath = path.join(root, 'daily-briefs/2026-08-07-critic.md');
  const criticHasIt = fs.existsSync(criticPath)
    && fs.readFileSync(criticPath, 'utf8').includes('Ohio answered with $762 million of its own');
  t(criticHasIt, '[fixture] the verbatim 08-07 falsehood is on disk in the Critic report (real text, not invented)');

  // 1. FIRE — undated response claim.
  t(causalSequence(FALSE_INTRO, {}).some((f) => f.check === 'causal-sequence-unresolved'),
    'FIRES on the real 08-07 intro: an undated "answered with" response claim');

  // 2. FIRE — the INVERSION itself, once the real dates are recorded. This is the assertion
  //    that matters: absence is easy to catch, a wrong order recorded as fact is the failure.
  const realDates: Record<string, CausalRow> = {
    'causal:fcc-robotics-listing-ohio-anduril': {
      resolved: true,
      match: 'Ohio answered with \\$762 million',
      antecedent: 'FCC Covered List robotics addition', antecedentDate: '2026-07-28',
      consequent: 'Ohio JCTC approval for Anduril Arsenal-1', consequentDate: '2025-01-27',
    },
  };
  const inverted = causalSequence(FALSE_INTRO, realDates);
  t(inverted.some((f) => f.check === 'causal-sequence' && f.severity === 'FAIL' && /INVERTED/.test(f.message)),
    'FIRES with CAUSAL SEQUENCE INVERTED once the real dates are recorded (2026-07-28 → 2025-01-27)');

  // 3. SILENT — the corrected construction, taken verbatim from the real repaired artifact.
  const CORRECTED =
    'The FCC banned a class of foreign robot without spending a dollar, and the $762 million Ohio had already sunk into a domestic arsenal is what now makes the ban expensive to lift.';
  t(causalSequence(CORRECTED, realDates).length === 0,
    'SILENT on the corrected anteriority form ("had already sunk") — the gate must not punish the repair');

  // 4. SILENT — the real Hadrian chain, correctly ordered, no causal row.
  const HADRIAN =
    'Two agencies removed that ambiguity in one week, and the week\'s largest private round priced seven days later.';
  t(causalSequence(HADRIAN, {}).length === 0,
    'SILENT on AI&T-3\'s Hadrian interval chain (Tier B, correctly ordered, no row to contradict it)');

  // 4b. FIRE on the REAL pre-repair brief file. v2 was repaired in place by the 05:27 Morning
  //     Truth Gate, but daily-briefs/2026-08-07-v1.5.md still carries "Ohio answered with
  //     $762 million of its own" — the artifact the falsehood actually lived in.
  const v15 = path.join(root, 'daily-briefs/2026-08-07-v1.5.md');
  if (fs.existsSync(v15)) {
    const onV15 = causalSequence(fs.readFileSync(v15, 'utf8'), realDates);
    t(onV15.some((f) => f.check === 'causal-sequence' && f.severity === 'FAIL'),
      'FIRES on the REAL pre-repair file daily-briefs/2026-08-07-v1.5.md (whole brief, not a snippet)');
  } else t(true, '[skip] v1.5 not on disk');

  // 5. SILENT on the whole real published brief — no false-positive storm.
  const pub = path.join(root, 'content/daily-updates/2026-08-07.md');
  if (fs.existsSync(pub)) {
    const truth = loadTruth(path.join(root, 'daily-briefs/2026-08-07-truth.json'));
    const onReal = causalSequence(fs.readFileSync(pub, 'utf8'), truth);
    const realFails = onReal.filter((f) => f.severity === 'FAIL');
    t(realFails.length === 0,
      `SILENT (no FAIL) across the entire real published 2026-08-07.md — ${onReal.length} advisory flag(s), 0 FAIL`);
  } else t(true, '[skip] published 08-07 brief not on disk');

  // 6. The anteriority exemption must not be a blanket mute: a response claim that ALSO
  //    contains a date word still fires when it carries no anteriority marker.
  t(causalSequence('Beijing retaliated with export controls two days after the tariff took effect.', {}).length === 1,
    'the exemption is scoped: a response verb with no anteriority marker still FIRES');

  console.log(`\ncausal-sequence-gate selftest — ${8 - fails}/8 assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED'); return 1; }
  console.log('✓ causal-sequence-gate verified in BOTH directions on real 2026-08-07 text.');
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const briefPath = args.find((a) => !a.startsWith('--'));
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error('usage: causal-sequence-gate.ts <brief.md> [--truth <path>] [--require-resolved]');
    return 2;
  }
  const ti = args.indexOf('--truth');
  const date = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  const truthPath = ti > -1 && args[ti + 1]
    ? args[ti + 1]!
    : [`daily-briefs/${date}-truth.json`, `content/daily-updates/${date}-truth.json`]
        .map((p) => path.join(process.cwd(), p)).find((p) => fs.existsSync(p)) ?? null;

  const truth = loadTruth(truthPath);
  const findings = causalSequence(fs.readFileSync(briefPath, 'utf8'), truth, {
    requireResolved: args.includes('--require-resolved'),
  });
  console.log(`causal-sequence-gate — ${path.basename(briefPath)}`);
  console.log(`  truth file: ${truthPath ? path.basename(truthPath) : 'NONE'} · causal rows: ${Object.keys(truth).length}`);
  const fails = findings.filter((f) => f.severity === 'FAIL');
  const flags = findings.filter((f) => f.severity === 'FLAG');
  for (const f of flags) console.log(`  ⚠ [${f.check}] ${f.message}\n      "${f.sentence}"`);
  for (const f of fails) console.error(`  ✗ [${f.check}] ${f.message}\n      "${f.sentence}"`);
  if (fails.length) {
    console.error(`\n❌ CAUSAL-SEQUENCE FAIL — ${fails.length} sentence(s) assert a response that its own dates contradict.`);
    return 1;
  }
  console.log(`\n✅ CAUSAL-SEQUENCE PASS — ${flags.length} advisory flag(s), 0 inverted sequence(s).`);
  return 0;
}

// Only take over the process when RUN, not when IMPORTED — otherwise any test or sibling
// gate that reuses these detectors inherits an exit(2) on import.
if (/causal-sequence-gate\.ts$/.test(process.argv[1] ?? '')) process.exit(main());
