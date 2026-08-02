#!/usr/bin/env node --experimental-strip-types
/**
 * pipeline-integrity-gate.ts — CATCH THE SILENT WRITER FAILURE BEFORE THE READER DOES.
 * (IMP-105, 2026-07-27. Escalates ESC-003 "brief-draft dark". Closes the detection half of the
 *  2026-07-27 E-PIPELINE-V1-FAILURE near-miss.)
 *
 * WORKED FAILURE (2026-07-27, receipts in daily-briefs/2026-07-27-pipeline-alert.md):
 *   The evening writing chain fired ~3h late and OUT OF ORDER. `brief-draft` RAN (scheduler
 *   lastRun 2026-07-27T00:53:30Z ≈ 8:53 PM ET) but wrote NO v1 AND NO pipeline-status line — a
 *   SILENT Writer failure. cc-predraft and take-draft were written at 8:58–9:04 PM, AFTER
 *   brief-draft had already executed: the Writer ran before its inputs were complete, produced
 *   nothing, and said nothing. The editor correctly HALTed (v1/v1.5 absent); brief-email STOPPed
 *   and emailed Jackson. But no `pipeline-watchdog` is registered, so nothing re-ran brief-draft;
 *   the brief was rescued only by a fragile morning self-heal, and 2026-07-27-critic.md + the
 *   evening super-brief were LOST. A silent failure with no status line is indistinguishable, from
 *   disk, from "never ran" — unless something looks for the exact signature.
 *
 * THE SIGNATURE this gate names, deterministically from disk, for a given brief DATE:
 *   SILENT_V1_FAILURE — the Writer's component pre-drafts are present (its inputs were ready) but
 *   no v1 / v1.5 / v2 exists. "Inputs ready, output absent" is the discriminator that separates a
 *   Writer failure from a legitimately-not-started evening (NOT_STARTED). Whether a brief-draft
 *   status line exists tells LOUD (a FAIL line was written) from SILENT (nothing was) — the 07-27
 *   case was SILENT, the worst kind.
 *
 * WHY A SCRIPT, NOT A PROSE RULE: ESC-003 has sat "brief-draft dark — propagation to task
 *   blocked-on-Jackson" since 2026-07-03. The task-prompt body (which would make brief-draft write
 *   its own status line) is FDA-gated and not reachable from the repo. What IS reachable is the
 *   DETECTION: a deterministic gate the actors that DO run (brief-morning self-heal, the daily
 *   pipeline-health-check) can call to convert a silent failure into a loud, specific, actionable
 *   signal by 5 AM / 11 AM latest — instead of hoping the morning session notices absent files.
 *
 * DELIBERATELY NOT auto-re-running brief-draft: re-running a Writer is a write action with an LLM
 *   in the loop; this gate FIRES and tells the caller exactly what to re-run. The evening watchdog
 *   TASK that acts on it is routed to Jackson (a scheduler change).
 *
 * ADDED 2026-07-28 (IMP-106) — two provenance WARNINGS (exit 0, never block) on the actor that runs
 *   (morning gate CLASSIFY-FIRST + daily health-check), making two silent failures the QG catch
 *   layer masks LOUD and dated instead of leaving them as Critic prose the improvement loop
 *   re-diagnoses from scratch every day:
 *     PREDRAFT-STAMP-ABSENT — a brief was produced but no {DATE}-predraft-manifest.md exists, i.e.
 *       IMP-102's `provenance-gate --stamp` never ran before the Writer. It is prose-wired in
 *       Pipeline_Controller, not the FDA brief-draft task body, so it silently no-ops. Receipt:
 *       the 07-28 brief shipped clean with NO 2026-07-28-predraft-manifest.md on disk.
 *     PREDRAFT-FABRICATION — v1 declares a Writer input "absent" while that pre-draft exists on disk
 *       (E-WRITER-FABRICATION-01 / ESC-006; 5th+ consecutive night as of 07-28). Receipt: 07-28 v1
 *       line 26 "take-draft | ABSENT" with 2026-07-28-take-draft.md (5,725 bytes) present. The QG
 *       restores from the pre-draft, so nothing false ships — this gate COUNTS the generation-layer
 *       fabrication so "unresponsive, 5th+ day" is a machine fact, not an adjective.
 *   Both warns SELF-CLEAR the instant the condition is fixed (manifest present / no false-absent in
 *   v1), so they persist exactly as long as the unfixed generation layer does — no wolf-crying. The
 *   input-layer fix itself (task body runs --stamp + HARD-INJECTS the manifest, IMP-094 precedent)
 *   is FDA-gated → routed to Jackson via ESC-006.
 *
 * Usage:
 *   node --experimental-strip-types scripts/pipeline-integrity-gate.ts [--date YYYY-MM-DD]
 *   node --experimental-strip-types scripts/pipeline-integrity-gate.ts --selftest
 * Exit: 0 healthy / not-yet-started (warnings allowed) · 1 SILENT_V1_FAILURE or PARTIAL · 2 usage
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process'; // IMP-119: re-execute the gate the status line claims to have run

export type PipelineState = 'HEALTHY' | 'NOT_STARTED' | 'SILENT_V1_FAILURE' | 'PARTIAL';

export interface Diagnosis {
  date: string;
  state: PipelineState;
  fail: boolean;
  warnings: string[];
  detail: string;
}

/** The Writer's component pre-drafts — its inputs. "Inputs ready" = >=2 of these on disk. */
const COMPONENT_DRAFTS = ['signal-draft', 'discovery-draft', 'cc-predraft', 'take-draft', 'predraft-manifest'];

/**
 * The pre-drafts the Writer must CONSUME (excludes predraft-manifest, which is the stamp's output,
 * not a Writer input). Used by the PREDRAFT-FABRICATION warn: if v1 calls one of these "absent"
 * while its file is on disk, the Writer fabricated the absence. (IMP-106)
 */
const WRITER_INPUT_DRAFTS = ['take-draft', 'cc-predraft', 'signal-draft', 'discovery-draft'];

/** Today on the America/New_York reading clock — the date the system publishes against. */
export function nyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

const exists = (root: string, rel: string) => fs.existsSync(path.join(root, rel));

/** Read the pre-QG Writer output (v1) for `date`, whichever name it landed under. '' if none. (IMP-106) */
function readV1(root: string, date: string): string {
  for (const name of [`${date}-v1-pre-quality-gate.md`, `${date}-v1.md`]) {
    const p = path.join(root, 'daily-briefs', name);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return '';
}

/**
 * Provenance warnings for a brief that WAS produced (v1/v2 on disk) — IMP-106. Two silent failures
 * the QG catch layer masks, surfaced as warnings (never fail the gate; nothing false shipped):
 *   PREDRAFT-STAMP-ABSENT — no {date}-predraft-manifest.md: IMP-102's `provenance-gate --stamp`
 *     did not run, so the ground-truth manifest the Writer should inherit was never written.
 *   PREDRAFT-FABRICATION — v1 asserts a Writer input "absent" while its pre-draft exists on disk
 *     (E-WRITER-FABRICATION-01 / ESC-006). The QG restores it; this counts the fabrication.
 * Both self-clear when the underlying condition is fixed. Pure function of disk.
 */
export function provenanceWarns(root: string, date: string): string[] {
  const briefs = 'daily-briefs';
  const out: string[] = [];

  if (!exists(root, `${briefs}/${date}-predraft-manifest.md`)) {
    out.push(`PREDRAFT-STAMP-ABSENT: no ${date}-predraft-manifest.md — IMP-102's provenance-gate --stamp did not run before the Writer, so the ground-truth pre-draft manifest was never written and the input-layer fabrication guard is unexercised. The stamp is prose-wired in Pipeline_Controller, not the FDA brief-draft task body (ESC-006 → Jackson).`);
  }

  const v1 = readV1(root, date);
  if (v1) {
    const fabricated = WRITER_INPUT_DRAFTS.filter((c) =>
      new RegExp(`\\b${c}\\b[^\\n]{0,40}\\babsent\\b`, 'i').test(v1)
      && exists(root, `${briefs}/${date}-${c}.md`));
    if (fabricated.length) {
      out.push(`PREDRAFT-FABRICATION: v1 declares [${fabricated.join(', ')}] ABSENT while the pre-draft file(s) exist on disk — the Writer fabricated absence at generation (E-WRITER-FABRICATION-01 / ESC-006). The QG catch restores from the pre-draft (nothing false ships), but the generation layer produced the fabrication. Route the input fix (task body runs --stamp + HARD-INJECTS the manifest into the Writer, IMP-094 precedent) to Jackson.`);
    }
  }
  return out;
}

// ── IMP-119 (2026-08-02, E-EDITOR-GATE-SELFREPORT-01, RC2): DON'T TRUST A GATE VERDICT YOU
// DIDN'T RUN. ────────────────────────────────────────────────────────────────────────────────
// RECEIPT (08-02 Critic, PIPELINE-STATE EVIDENCE): the `brief-editor` SUCCESS line asserted of the
// promoted v2 — "Full battery on the promoted v2: … fact-gate PASS …" — while the SAME line
// separately reported the truth file as NONE with 4 market claims + 5 superlatives unverified. Run
// against that unmodified file, `fact-gate` exited 1 with two unverified-critical rows. A status
// line saying PASS where the gate says FAIL is the exact shape that produced the 2026-07-10 truth
// incident ("fact-gate PASS" meaning "no contradictions found against nothing"), and every
// downstream consumer — the morning gate, the health check, the improvement loop — reads status
// lines. Nothing re-executed the gate.
//
// THE RULE: a self-reported gate verdict is a CLAIM, and this brief's own doctrine says a claim is
// checked by re-running the primary source. This warn re-executes fact-gate on the promoted v2 and
// contradicts the status line when they disagree. WARN-ONLY by construction (exit 0) — it never
// blocks a brief; it makes a lying status line loud and dated.
// NO TIMING FALSE POSITIVE: the only asserted direction is "status says PASS, gate says FAIL". A
// later re-run can only ever gain a truth file, which moves the gate toward PASS — so a
// contradiction found now was necessarily true then, and the warn SELF-CLEARS the moment the gate
// genuinely passes or the line stops claiming it.
const SELFREPORT_PASS_RE = /fact-gate[^.\n]{0,24}\bPASS\b/i;
/** Pure decision function: does a status line's self-reported verdict contradict a re-run? */
export function selfReportContradiction(statusText: string, gateExit: number): string | null {
  const line = statusText.split('\n').find((l) => /\bbrief-editor\b/.test(l) && SELFREPORT_PASS_RE.test(l));
  if (!line) return null;
  if (gateExit === 0) return null;
  const quoted = (line.match(SELFREPORT_PASS_RE) || [''])[0];
  return `GATE-SELFREPORT-CONTRADICTED: the brief-editor status line asserts "${quoted}" but re-executing fact-gate on the promoted v2 exits ${gateExit}. A self-reported gate verdict is a CLAIM; this one is false as written. Re-run the gate and correct the status line — a pipeline whose status lines say PASS where the gate says FAIL is the 2026-07-10 truth-incident shape (E-EDITOR-GATE-SELFREPORT-01).`;
}
/** Disk wrapper: re-executes fact-gate on {date}-v2.md and compares to the editor's self-report. */
export function gateSelfReportWarns(root: string, date: string): string[] {
  const statusPath = path.join(root, 'daily-briefs', `${date}-pipeline-status.md`);
  const v2Path = path.join(root, 'daily-briefs', `${date}-v2.md`);
  const gatePath = path.join(root, 'scripts', 'fact-gate.ts');
  if (!fs.existsSync(statusPath) || !fs.existsSync(v2Path) || !fs.existsSync(gatePath)) return [];
  const statusText = fs.readFileSync(statusPath, 'utf8');
  if (!statusText.split('\n').some((l) => /\bbrief-editor\b/.test(l) && SELFREPORT_PASS_RE.test(l))) return [];
  const r = spawnSync(process.execPath, ['--experimental-strip-types', gatePath, v2Path], { encoding: 'utf8', cwd: root });
  const warn = selfReportContradiction(statusText, r.status ?? 0);
  return warn ? [warn] : [];
}

/** Classify the evening chain's state for `date` from the artifacts on disk. Pure function of disk. */
export function diagnose(root: string, date: string): Diagnosis {
  const briefs = 'daily-briefs';
  const componentsPresent = COMPONENT_DRAFTS.filter((c) => exists(root, `${briefs}/${date}-${c}.md`));
  const hasV1 = exists(root, `${briefs}/${date}-v1.md`) || exists(root, `${briefs}/${date}-v1-pre-quality-gate.md`);
  const hasV15 = exists(root, `${briefs}/${date}-v1.5.md`);
  const hasV2 = exists(root, `${briefs}/${date}-v2.md`);
  const hasCritic = exists(root, `${briefs}/${date}-critic.md`);

  // Was a brief-draft status line ever written for this date? (SILENT vs LOUD.)
  const statusPath = path.join(root, briefs, `${date}-pipeline-status.md`);
  const hasBriefDraftStatus = fs.existsSync(statusPath)
    && /\bbrief-draft\b/.test(fs.readFileSync(statusPath, 'utf8'));

  const warnings: string[] = [];

  // NOTE: a post-hoc mtime "out-of-order" check (v1 older than an input) was considered and
  // rejected — the morning QG/editor and the 10:03 session legitimately regenerate component files
  // AFTER v1, so comparing mtimes on a recovered brief cries wolf on healthy days. The 07-27 root
  // cause (Writer ran before inputs) surfaces reliably as the SILENT_V1_FAILURE signature below,
  // not as an mtime race. Keeping the signal clean beats a noisy warn (the IMP-065/068 lesson).

  if (hasV2) {
    // Brief was produced. The one remaining cascade tail: the critic never ran (07-27 lost it).
    if (!hasCritic) warnings.push(`CRITIC-ABSENT: ${date}-v2.md exists but ${date}-critic.md does not — the feedback loop for this brief is broken (the improvement cycle inherits no adversarial read).`);
    warnings.push(...provenanceWarns(root, date)); // IMP-106: stamp-didn't-run + Writer fabricated-absent
    warnings.push(...gateSelfReportWarns(root, date)); // IMP-119: status line says PASS, gate says FAIL
    return { date, state: 'HEALTHY', fail: false, warnings, detail: `v2 present${hasCritic ? ' + critic' : ' (critic MISSING)'}.` };
  }

  if (hasV1 || hasV15) {
    // Writer produced something but the editor never promoted a v2 — HALT / mid-pass / crash.
    warnings.push(...provenanceWarns(root, date)); // IMP-106: v1 exists → the stamp/fabrication checks apply
    return {
      date, state: 'PARTIAL', fail: true, warnings,
      detail: `v1${hasV15 ? '/v1.5' : ''} present but NO v2 — the editor HALTed or is mid-pass and no clean v2 was promoted. Re-run brief-editor (and brief-critic after).`,
    };
  }

  if (componentsPresent.length >= 2) {
    // Inputs were ready, but the Writer produced no v1/v1.5/v2 — the SILENT signature.
    const silence = hasBriefDraftStatus
      ? 'a brief-draft status line exists (LOUD failure — at least it was logged)'
      : 'NO brief-draft status line exists (SILENT failure — indistinguishable from "never ran")';
    return {
      date, state: 'SILENT_V1_FAILURE', fail: true, warnings,
      detail: `${componentsPresent.length}/${COMPONENT_DRAFTS.length} component pre-drafts present [${componentsPresent.join(', ')}] but NO v1/v1.5/v2 — the Writer had its inputs and produced nothing; ${silence}. ACTION: re-run brief-draft (Architect→Writer) → brief-editor → brief-critic; all inputs are on disk.`,
    };
  }

  // No components, no brief — the evening chain simply has not run yet for this date. Not a failure.
  return {
    date, state: 'NOT_STARTED', fail: false, warnings,
    detail: `no component pre-drafts and no brief for ${date} — the evening chain has not started (or this is not yet a brief date). Nothing to catch yet.`,
  };
}

function selftest(): number {
  const results: [string, boolean][] = [];
  const mk = (files: string[]): string => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'pig-selftest-'));
    fs.mkdirSync(path.join(r, 'daily-briefs'), { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(r, 'daily-briefs', f), 'x\n');
    return r;
  };
  const D = '2026-07-27';
  const roots: string[] = [];
  try {
    // HEALTHY: v2 + critic + predraft-manifest present, v1 carries no false-absent → zero warnings.
    let r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`, `${D}-v1-pre-quality-gate.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    results.push(['HEALTHY when v2 + critic + manifest present (silent, exit 0)', (() => { const d = diagnose(r, D); return d.state === 'HEALTHY' && !d.fail && d.warnings.length === 0; })()]);

    // HEALTHY but CRITIC-ABSENT warn: v2 present, critic missing (the 07-27 cascade tail).
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-v2.md`]); roots.push(r);
    results.push(['HEALTHY + CRITIC-ABSENT warn when v2 but no critic (exit 0, warned)', (() => { const d = diagnose(r, D); return d.state === 'HEALTHY' && !d.fail && d.warnings.some((w) => w.startsWith('CRITIC-ABSENT')); })()]);

    // SILENT_V1_FAILURE, the exact 07-27 signature: components present, no v1/v1.5/v2, no status line.
    r = mk([`${D}-signal-draft.md`, `${D}-discovery-draft.md`, `${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`]); roots.push(r);
    results.push(['FIRES SILENT_V1_FAILURE on the 07-27 signature (inputs ready, no brief, no status) — exit 1', (() => { const d = diagnose(r, D); return d.state === 'SILENT_V1_FAILURE' && d.fail && /SILENT failure/.test(d.detail); })()]);

    // LOUD vs SILENT: same missing-brief, but a brief-draft status line exists.
    r = mk([`${D}-signal-draft.md`, `${D}-discovery-draft.md`, `${D}-cc-predraft.md`, `${D}-take-draft.md`]); roots.push(r);
    fs.writeFileSync(path.join(r, 'daily-briefs', `${D}-pipeline-status.md`), `2026-07-27T00:53Z | brief-draft | FAIL | writer produced no v1\n`);
    results.push(['SILENT_V1_FAILURE still FAILs but reports LOUD when a brief-draft status line exists', (() => { const d = diagnose(r, D); return d.state === 'SILENT_V1_FAILURE' && d.fail && /LOUD failure/.test(d.detail); })()]);

    // PARTIAL: v1 present but no v2 (editor HALTed).
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-v1-pre-quality-gate.md`, `${D}-v1.5.md`]); roots.push(r);
    results.push(['FIRES PARTIAL when v1/v1.5 present but no v2 (editor HALT) — exit 1', (() => { const d = diagnose(r, D); return d.state === 'PARTIAL' && d.fail; })()]);

    // NOT_STARTED: nothing on disk — legitimately not a failure (avoids evening false positives).
    r = mk([]); roots.push(r);
    results.push(['SILENT on NOT_STARTED (no components, no brief) — exit 0, no false positive', (() => { const d = diagnose(r, D); return d.state === 'NOT_STARTED' && !d.fail; })()]);

    // Fewer than 2 components (upstream not ready) is NOT a Writer failure — NOT_STARTED.
    r = mk([`${D}-signal-draft.md`]); roots.push(r);
    results.push(['1 component only => NOT_STARTED, not SILENT (inputs not yet ready)', (() => { const d = diagnose(r, D); return d.state === 'NOT_STARTED' && !d.fail; })()]);

    // A HEALTHY brief must be SILENT (no noisy warns) so the gate keeps its signal.
    r = mk([`${D}-signal-draft.md`, `${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`, `${D}-v1-pre-quality-gate.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    results.push(['HEALTHY brief with full artifacts emits ZERO warnings (no wolf-crying)', (() => { const d = diagnose(r, D); return d.state === 'HEALTHY' && d.warnings.length === 0; })()]);

    // IMP-106 — PREDRAFT-STAMP-ABSENT: brief produced (v2+critic) but NO predraft-manifest → the
    // stamp did not run. Warn, not fail (nothing false shipped). This is the real 07-28 signature.
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-v1-pre-quality-gate.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    results.push(['IMP-106: FIRES PREDRAFT-STAMP-ABSENT when a produced brief has no manifest (warn, exit 0)', (() => { const d = diagnose(r, D); return d.state === 'HEALTHY' && !d.fail && d.warnings.some((w) => w.startsWith('PREDRAFT-STAMP-ABSENT')); })()]);

    // IMP-106 — PREDRAFT-STAMP-ABSENT self-clears the moment the manifest is present.
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`, `${D}-v1-pre-quality-gate.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    results.push(['IMP-106: PREDRAFT-STAMP-ABSENT is SILENT once the manifest exists (self-clears)', (() => { const d = diagnose(r, D); return !d.warnings.some((w) => w.startsWith('PREDRAFT-STAMP-ABSENT')); })()]);

    // IMP-106 — PREDRAFT-FABRICATION: v1 declares take-draft ABSENT while take-draft.md exists on
    // disk (the exact 07-28 v1 line-26 signature). Manifest present here to isolate the fabrication warn.
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    fs.writeFileSync(path.join(r, 'daily-briefs', `${D}-v1-pre-quality-gate.md`), `| take-draft | ABSENT  --  confirmed via bash ls ${D}; generated inline |\n`);
    results.push(['IMP-106: FIRES PREDRAFT-FABRICATION when v1 says take-draft ABSENT but the file exists', (() => { const d = diagnose(r, D); return d.warnings.some((w) => w.startsWith('PREDRAFT-FABRICATION') && /take-draft/.test(w)); })()]);

    // IMP-106 — an HONEST absent (v1 says discovery-draft absent AND no discovery-draft.md on disk)
    // must NOT warn — the discriminator is disk truth, not the word "absent".
    r = mk([`${D}-cc-predraft.md`, `${D}-take-draft.md`, `${D}-predraft-manifest.md`, `${D}-v1.5.md`, `${D}-v2.md`, `${D}-critic.md`]); roots.push(r);
    fs.writeFileSync(path.join(r, 'daily-briefs', `${D}-v1-pre-quality-gate.md`), `| discovery-draft | ABSENT  --  no discovery-draft on disk, honest |\n`);
    results.push(['IMP-106: SILENT on an HONEST absent (v1 says absent AND the pre-draft truly is absent)', (() => { const d = diagnose(r, D); return !d.warnings.some((w) => w.startsWith('PREDRAFT-FABRICATION')); })()]);

    // IMP-119 — GATE-SELFREPORT. The decision function is pure so the assertion is deterministic
    // (the disk wrapper re-executes fact-gate; the logic under test is the comparison).
    const REAL_LINE = `2026-08-01T23:27:45Z | brief-editor | daily-briefs/2026-08-02-v2.md | SUCCESS | Full battery on the promoted v2: validate-brief 8 SOFT, fact-gate PASS, truth file NONE with 9 unverified items.`;
    results.push(['IMP-119: FIRES when the editor line claims "fact-gate PASS" and the re-run exits 1 (the real 08-02 line)',
      (() => { const w = selfReportContradiction(REAL_LINE, 1); return !!w && w.startsWith('GATE-SELFREPORT-CONTRADICTED') && /fact-gate PASS/.test(w); })()]);
    results.push(['IMP-119: SILENT when the claim is true (line says PASS, re-run exits 0) — self-clears',
      selfReportContradiction(REAL_LINE, 0) === null]);
    results.push(['IMP-119: SILENT when the editor line makes no fact-gate claim (nothing to contradict)',
      selfReportContradiction('2026-08-01T23:27:45Z | brief-editor | v2 | SUCCESS | promoted.', 1) === null]);
    results.push(['IMP-119: SILENT on a non-editor line that mentions fact-gate PASS (scoping)',
      selfReportContradiction('2026-08-01T10:00Z | brief-morning | fact-gate PASS after truth resolve', 1) === null]);
    // Disk wrapper is inert when the artifacts are absent — no crash, no false warn.
    r = mk([`${D}-cc-predraft.md`]); roots.push(r);
    results.push(['IMP-119: disk wrapper is INERT when v2/status are absent (no crash, no warn)', gateSelfReportWarns(r, D).length === 0]);
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }

  console.log('pipeline-integrity-gate --selftest');
  for (const [name, ok] of results) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  const ok = results.every(([, v]) => v);
  if (ok) { console.log('\n✅ SELFTEST PASS — a silent Writer failure now has a deterministic, actionable signature.'); return 0; }
  console.error('\n❌ SELFTEST FAIL'); return 1;
}

function main(): number {
  if (process.argv.includes('--selftest')) return selftest();
  const i = process.argv.indexOf('--date');
  const date = i > -1 && process.argv[i + 1] ? process.argv[i + 1]! : nyToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error(`FAIL: bad --date "${date}"`); return 2; }
  const d = diagnose(process.cwd(), date);
  console.log(`pipeline-integrity-gate — ${date}: ${d.state}`);
  console.log(`  ${d.detail}`);
  for (const w of d.warnings) console.log(`  ⚠ ${w}`);
  if (d.fail) {
    console.error(`\n❌ PIPELINE-INTEGRITY FAIL — ${d.state} for ${date}. ${d.detail}`);
    return 1;
  }
  console.log(`\n✅ PIPELINE-INTEGRITY OK — ${d.state} for ${date}.${d.warnings.length ? ' (see warnings above)' : ''}`);
  return 0;
}

process.exit(main());
