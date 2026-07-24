/**
 * editor-handoff-gate.ts — nobody may promote or replace the Editor's artifact while the Editor
 * is still writing it. (IMP-046, 2026-07-13 · IMP-048 liveness rewrite, 2026-07-14)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS, IN TWO FAILURES ONE NIGHT APART.
 *
 * 2026-07-13 (IMP-046 — the first hole):
 *   23:10:11Z brief-editor | CANARY        <- the Editor is ALIVE and editing
 *   23:35:34Z brief-editor | SELF-HEAL     <- the Critic declared it missing and rebuilt v2 from v1.5
 *   23:54:42Z brief-editor | SUCCESS       <- the real Editor lands, "supersedes SELF-HEAL-CRITIC"
 *   The RACE GUARD branched on SUCCESS / FAIL / no-line. A CANARY line is none of the three, so a
 *   LIVE Editor was read as an ABSENT one — the exact inversion. Fix: CANARY ⇒ alive, and never
 *   overwrite {date}-v2.working.md with a v1.5 copy.
 *
 * 2026-07-14 (IMP-048 — the SAME hole, one layer down, on the very next night):
 *   23:10:17Z brief-editor | CANARY
 *   23:55:39Z brief-editor | SUCCESS | "CRITIC-PROMOTED: v2.working.md promoted by Critic after
 *                                       45-min CANARY budget expired (Editor crash …)"
 *   00:04:50Z the Editor finishes its pass (context-overflow resume, ~65 min) and writes the real v2
 *   The gate read the STATUS BOARD for liveness and then promoted off the WORKING FILE without ever
 *   asking whether that file was still being written. **v2.working.md's mtime was advancing the
 *   entire time the Critic was calling it a corpse.** A mid-pass snapshot (8 HARD-FAIL word
 *   ceilings) was promoted and graded; the brief that actually shipped was graded by nobody.
 *
 * THE PRIMITIVE, STATED ONCE:
 *   **A crash is "the artifact stopped changing." It is not "my timer went off."**
 *   Brief_Editor rule 6 (ATOMIC v2) makes {date}-v2.working.md the Editor's SCRATCH file — it
 *   exists FOR THE WHOLE PASS and is deleted on promotion. So "working file on disk" carries two
 *   opposite meanings (mid-pass · finished-but-held) and the ONLY thing that separates them is
 *   whether it is still being written. Liveness is therefore read from the file's mtime, which
 *   requires no cooperation from the Editor, not from a status line it writes when it is done.
 *
 * BUDGETS (from the observed runtime distribution, not a round number):
 *   07-05 39m · 07-07 17m · 07-08 14m · 07-12 19m · 07-13 44m · 07-14 ~65m (context-overflow resume)
 *   The 45-minute wait was BELOW the observed max. It was never a crash detector; it was an egg timer.
 *
 * Modes:
 *   --liveness <DATE>        ALIVE (still being written) / QUIET (stopped) / ABSENT. exit 1 = ALIVE, WAIT.
 *   --can-promote <DATE>     may the Critic promote {date}-v2.working.md → v2.md? exit 1 = FORBIDDEN.
 *   --can-self-heal <DATE>   may the Critic rebuild v2 from v1.5? exit 1 = FORBIDDEN.
 *   --audit <DATE>           post-hoc: self-heal/promotion over a live Editor, or an unreconciled
 *                            PROVISIONAL Critic report. exit 1 = violation.
 *   --selftest               both directions, on the REAL 07-10…07-14 artifacts + mtime fixtures.
 *
 * Exit: 0 clean · 1 violation · 2 usage.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** The working file has not been touched for this long ⇒ the Editor stopped writing ⇒ crashed.
 *  The Editor's HEARTBEAT contract (Brief_Editor.md) is a touch every ≤5 min, so 20 min of silence
 *  is death, not thought. */
export const QUIET_MIN = 20;
/** No promotion of a quiet working file before this — a floor under the quiescence test. */
export const MIN_WAIT_MIN = 45;
/** Nothing on disk at all for this long after the CANARY ⇒ the Editor died before writing. */
export const NO_ARTIFACT_WAIT_MIN = 60;
/** The never-deadlock ceiling. The brief always ships: past this, promotion is FORCED and logged. */
export const HARD_CEILING_MIN = 120;

type Violation = { check: string; message: string };
const DB = (root: string) => path.join(root, 'daily-briefs');

interface EditorLine { ts: Date | null; kind: 'CANARY' | 'SUCCESS' | 'FAIL' | 'SELF-HEAL' | 'OTHER'; raw: string }

const statusLines = (root: string, date: string): string[] => {
  const p = path.join(DB(root), `${date}-pipeline-status.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n') : [];
};

// Classify by the STATUS FIELD, never by substring. The 07-13 Editor's SUCCESS line reads
// "… | SUCCESS | … Supersedes SELF-HEAL-CRITIC entry." — a naive /SELF-HEAL/ test on the whole
// line calls the Editor's completion a self-heal. (Caught by this gate's own selftest.)
function editorLines(root: string, date: string): EditorLine[] {
  const out: EditorLine[] = [];
  for (const raw of statusLines(root, date)) {
    if (!/brief-editor/i.test(raw)) continue;
    const tsm = raw.match(/(\d{4}-\d{2}-\d{2}T[\d:]+Z)/);
    const ts = tsm ? new Date(tsm[1]) : null;
    const fields = raw.split('|').map((f) => f.trim());
    const has = (re: RegExp) => fields.some((f) => re.test(f));
    const kind: EditorLine['kind'] =
      has(/^SUCCESS$/i) ? 'SUCCESS'
      : has(/^FAIL/i) ? 'FAIL'
      : has(/^SELF-HEAL/i) ? 'SELF-HEAL'
      : has(/^CANARY$/i) || has(/^CANARY\b/i) ? 'CANARY'
      : 'OTHER';
    out.push({ ts, kind, raw: raw.trim() });
  }
  return out;
}

export type LivenessState = 'ALIVE' | 'QUIET' | 'ABSENT';
export interface Liveness {
  state: LivenessState;
  quietMin: number | null;   // minutes since the working file was last written
  canaryAgeMin: number | null;
  workingPath: string;
  reason: string;
}

/** THE LOAD-BEARING FUNCTION. Liveness is mtime, not a stopwatch. */
export function liveness(root: string, date: string, now = new Date()): Liveness {
  const working = path.join(DB(root), `${date}-v2.working.md`);
  const lines = editorLines(root, date);
  const canary = lines.find((l) => l.kind === 'CANARY');
  const canaryAgeMin = canary?.ts ? (now.getTime() - canary.ts.getTime()) / 60000 : null;

  if (!fs.existsSync(working)) {
    return {
      state: 'ABSENT', quietMin: null, canaryAgeMin, workingPath: working,
      reason: `no ${date}-v2.working.md on disk${canaryAgeMin !== null ? ` (CANARY ${canaryAgeMin.toFixed(0)} min old)` : ''}`,
    };
  }
  const quietMin = (now.getTime() - fs.statSync(working).mtimeMs) / 60000;
  return {
    state: quietMin < QUIET_MIN ? 'ALIVE' : 'QUIET',
    quietMin, canaryAgeMin, workingPath: working,
    reason: quietMin < QUIET_MIN
      ? `${date}-v2.working.md was written ${quietMin.toFixed(1)} min ago (< ${QUIET_MIN} min) — the Editor is STILL WRITING IT`
      : `${date}-v2.working.md has not changed for ${quietMin.toFixed(0)} min (≥ ${QUIET_MIN}) — the Editor has stopped`,
  };
}

/** May the Critic promote {date}-v2.working.md → v2.md? (07-14's exact question.) */
export function canPromote(root: string, date: string, now = new Date()): Violation[] {
  const v: Violation[] = [];
  const l = liveness(root, date, now);
  const lines = editorLines(root, date);
  const failed = lines.some((x) => x.kind === 'FAIL');
  const forced = l.canaryAgeMin !== null && l.canaryAgeMin >= HARD_CEILING_MIN;

  if (l.state === 'ABSENT') {
    v.push({ check: 'promote-nothing', message: `PROMOTION IMPOSSIBLE — ${l.reason}. There is no Editor artifact to promote.` });
    return v;
  }
  if (l.state === 'ALIVE' && !failed && !forced) {
    v.push({
      check: 'promote-over-live-editor',
      message: `PROMOTION FORBIDDEN — ${l.reason}. This is the 07-14 failure: a mid-pass snapshot was promoted at the 45-minute mark while the Editor (running ~65 min after a context-overflow resume) was still compressing bullets, and the brief that shipped was graded by nobody. WAIT and re-poll --liveness. A crash is "the artifact stopped changing," never "my timer went off."`,
    });
    return v;
  }
  if (l.state === 'QUIET' && !failed && !forced && (l.canaryAgeMin === null || l.canaryAgeMin < MIN_WAIT_MIN)) {
    v.push({
      check: 'promote-inside-min-wait',
      message: `PROMOTION FORBIDDEN — the working file is quiet (${l.quietMin?.toFixed(0)} min) but the Editor CANARY is only ${l.canaryAgeMin?.toFixed(0) ?? '?'} min old (floor ${MIN_WAIT_MIN} min). Quiescence is necessary, not sufficient: give the pass its floor before you call it dead.`,
    });
  }
  const hold = readHold(root, date);
  if (hold) {
    v.push({
      check: 'promote-over-editor-hold',
      message: `PROMOTION FORBIDDEN — the Editor is HOLDING: "${hold}". A hold is a DECISION, not a crash: resolve the flagged content, then promote. Never ship what the Editor refused to ship (07-13: the self-heal shipped the exact unverifiable quote the Editor had rejected).`,
    });
  }
  return v;
}

/** May the Critic rebuild v2 from a v1.5 copy? Strictly narrower than promotion. */
export function canSelfHeal(root: string, date: string, now = new Date()): Violation[] {
  const v: Violation[] = [];
  const lines = editorLines(root, date);
  const terminal = lines.find((l) => l.kind === 'SUCCESS' || l.kind === 'FAIL');
  const canary = lines.find((l) => l.kind === 'CANARY');
  const l = liveness(root, date, now);
  const elog = path.join(DB(root), `${date}-editor-log.md`);

  if (l.state !== 'ABSENT') {
    const hold = readHold(root, date);
    v.push({
      check: 'self-heal-over-editor-artifact',
      message: `SELF-HEAL FORBIDDEN — ${l.reason}. ${
        l.state === 'ALIVE'
          ? 'The Editor is ALIVE. Wait for it.'
          : hold
            ? `The Editor is holding: "${hold}". RESOLVE the hold, then promote its file.`
            : 'The Editor stopped mid-pass: PROMOTE its working file (run --can-promote), do not substitute a v1.5 copy.'
      } A copy of v1.5 has not been through the Editor's checks; substituting one throws away the pass that already ran.`,
    });
  }
  if (canary && !terminal) {
    const ageMin = l.canaryAgeMin ?? Infinity;
    if (ageMin < NO_ARTIFACT_WAIT_MIN) {
      v.push({
        check: 'self-heal-over-live-editor',
        message: `SELF-HEAL FORBIDDEN — a brief-editor CANARY line exists with no SUCCESS/FAIL and is ${ageMin.toFixed(0)} min old (wait ${NO_ARTIFACT_WAIT_MIN} min; observed Editor runtimes reach ~65). CANARY means the Editor is ALIVE, not absent — absence of the artifact is not evidence of failure while the step is still running. WAIT and re-check.`,
      });
    }
  }
  if (!canary && !terminal && fs.existsSync(elog)) {
    v.push({
      check: 'self-heal-over-editor-artifact',
      message: `SELF-HEAL FORBIDDEN — ${date}-editor-log.md exists: the Editor ran. Read its log (and any EDITOR-HOLD) before declaring it missing.`,
    });
  }
  return v;
}

function readHold(root: string, date: string): string | null {
  const p = path.join(DB(root), `${date}-editor-log.md`);
  if (!fs.existsSync(p)) return null;
  const m = fs.readFileSync(p, 'utf8').match(/^EDITOR-HOLD:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

/** IMP-072 (E-PIPELINE-EDITOR-STATUS-01, 2026-07-18). The Editor can FINISH — editor-log.md written,
 *  v2 on disk and fresher than v1.5 — yet write NO CANARY/SUCCESS line to the status board (07-18:
 *  "brief-editor: NO LINE IN PIPELINE-STATUS"). Every guard that reads the BOARD (RACE / OWED-EDITOR /
 *  LIVENESS) then reads a COMPLETED Editor as an ABSENT one — the exact inversion that self-heals over
 *  a live pass. This reads completion from the ARTIFACT (log + v2), the signal that cannot go missing:
 *  a board-reading consumer should fall back to this when the status line is absent. */
export function editorCompletedByLog(root: string, date: string): boolean {
  const elog = path.join(DB(root), `${date}-editor-log.md`);
  const v2 = path.join(DB(root), `${date}-v2.md`);
  if (!fs.existsSync(elog) || !fs.existsSync(v2)) return false;
  const v15 = path.join(DB(root), `${date}-v1.5.md`);
  if (fs.existsSync(v15)) {
    try { if (fs.statSync(v2).mtimeMs < fs.statSync(v15).mtimeMs) return false; } catch { /* stat race — treat as complete */ }
  }
  return true;
}

/** Post-hoc audit: what 07-13, 07-11 (self-heal) and 07-14 (premature promotion) actually did. */
export function auditHandoff(root: string, date: string): Violation[] {
  const v: Violation[] = [];
  const raw = statusLines(root, date);
  const lines = editorLines(root, date);
  // A self-heal is recorded inconsistently across nights — as a brief-editor SELF-HEAL-CRITIC line
  // (07-13) or only inside the brief-critic line's prose (07-11). Both count. Agent-written
  // timestamps are unreliable, so ORDERING is not evidence; CO-OCCURRENCE is.
  const selfHealLine = raw.find((l) => /self-heal/i.test(l) && !/supersede/i.test(l));
  const editorRan = lines.some((l) => l.kind === 'CANARY' || l.kind === 'SUCCESS');
  const editorSuccess = lines.find((l) => l.kind === 'SUCCESS');

  if (selfHealLine && editorRan) {
    v.push({
      check: 'self-heal-over-live-editor',
      message: `A SELF-HEAL fired for ${date} on a night the Editor RAN (brief-editor ${editorSuccess ? 'SUCCESS' : 'CANARY'} line on the board). The self-heal artifact — a copy of v1.5 that never went through the Editor's checks — is what got graded${editorSuccess ? ", and the Editor's own v2 landed afterwards" : ''}. Run --can-self-heal BEFORE self-healing; a CANARY means ALIVE.`,
    });
  }

  // 07-14: not a self-heal — a PREMATURE PROMOTION. The Critic promoted the Editor's own scratch
  // file mid-pass, and the Editor's real SUCCESS superseded it ~10 minutes later. Fingerprint:
  // a CRITIC-PROMOTED / budget-expired promotion line AND a later editor line that supersedes it.
  const promoted = raw.find((l) => /brief-editor/i.test(l) && /critic-promoted|budget expired|promoted by critic/i.test(l));
  const superseding = raw.find((l) => /brief-editor/i.test(l) && /supersedes (the )?critic|supersedes critic emergency|editor pass completed/i.test(l));
  if (promoted && superseding) {
    v.push({
      check: 'premature-promotion',
      message: `The Critic PROMOTED ${date}-v2.working.md while the Editor was still writing it, and the Editor's own pass superseded that promotion afterwards. The graded artifact is a MID-PASS SNAPSHOT: every finding in the ${date} Critic report describes a document the reader never saw. Liveness must be read from the working file's mtime (--liveness), never from a countdown against a CANARY line.`,
    });
  }

  // FINAL-ARTIFACT RECONCILIATION owed: the Critic stamped PROVISIONAL and an Editor SUCCESS landed,
  // so the report — and the mandates it hands to the improvement loop — grade the wrong document.
  const criticPath = path.join(DB(root), `${date}-critic.md`);
  if (editorSuccess && fs.existsSync(criticPath)) {
    const c = fs.readFileSync(criticPath, 'utf8');
    if (/PROVISIONAL/i.test(c) && !/RECONCILED/i.test(c)) {
      v.push({
        check: 'critic-reconciliation-owed',
        message: `The ${date} Critic report is stamped PROVISIONAL, a brief-editor SUCCESS line exists, and the report carries no "RECONCILED" note. Its section ratings, its ceiling scorecard and its three MUST-BE-BETTER mandates describe a document that is not the one that shipped. Run FINAL-ARTIFACT RECONCILIATION (Brief_Critic) against the current v2 and re-stamp.`,
      });
    }
  }

  // IMP-072 (E-PIPELINE-EDITOR-STATUS-01, 07-18): the Editor COMPLETED by artifact (editor-log + v2
  // fresher than v1.5) but wrote NO brief-editor line to the status board. The board-reading guards
  // then treat a completed pass as an absent one. The artifact is FINAL, so this is advisory — but it
  // must be SURFACED so the missing line gets written and the board stops lying about the Editor.
  if (editorCompletedByLog(root, date) && !editorRan) {
    v.push({
      check: 'editor-status-unlogged',
      message: `The Editor COMPLETED for ${date} (editor-log.md present, v2 on disk and ≥ v1.5 mtime) but wrote NO CANARY/SUCCESS brief-editor line to ${date}-pipeline-status.md. The RACE GUARD, OWED-EDITOR GUARD and LIVENESS GATE read the STATUS BOARD, so a completed Editor reads as ABSENT — a future night's Critic self-heals over a live pass (the IMP-046/048 class). FIX: the Editor MUST write its SUCCESS line (output contract), and board-reading consumers must fall back to editorCompletedByLog() when the line is missing. The artifact is FINAL; this is the observability gap, not an artifact-finality failure.`,
    });
  }
  return v;
}

// ---------- selftest ----------

/** Build a throwaway pipeline dir with REAL mtimes — the only honest way to test a liveness rule. */
function fixture(name: string, opts: { canaryMinAgo: number; workingQuietMin: number | null; hold?: string }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ehg-${name}-`));
  fs.mkdirSync(path.join(root, 'daily-briefs'), { recursive: true });
  const date = '2026-01-01';
  const now = Date.now();
  const canaryTs = new Date(now - opts.canaryMinAgo * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  fs.writeFileSync(path.join(root, 'daily-briefs', `${date}-pipeline-status.md`),
    `${canaryTs} | brief-editor | CANARY | WRITE-OK\n`);
  if (opts.workingQuietMin !== null) {
    const w = path.join(root, 'daily-briefs', `${date}-v2.working.md`);
    fs.writeFileSync(w, '# working\n');
    const t = new Date(now - opts.workingQuietMin * 60000);
    fs.utimesSync(w, t, t);
  }
  if (opts.hold) {
    fs.writeFileSync(path.join(root, 'daily-briefs', `${date}-editor-log.md`), `EDITOR-HOLD: ${opts.hold}\n`);
  }
  return root;
}

function selftest(): number {
  const root = process.cwd();
  const D = '2026-01-01';

  // --- REAL ARTIFACTS: the gate must bite the nights that failed and stay silent on the clean ones.
  const fire14 = auditHandoff(root, '2026-07-14');
  const fire13 = auditHandoff(root, '2026-07-13');
  const fire11 = auditHandoff(root, '2026-07-11');
  const silent10 = auditHandoff(root, '2026-07-10');
  const silent12 = auditHandoff(root, '2026-07-12');

  const ok14 = fire14.some((x) => x.check === 'premature-promotion');
  const ok13 = fire13.some((x) => x.check === 'self-heal-over-live-editor');
  const ok13Recon = fire13.some((x) => x.check === 'critic-reconciliation-owed');
  const ok11 = fire11.some((x) => x.check === 'self-heal-over-live-editor');
  const ok10 = silent10.length === 0;
  const ok12 = silent12.length === 0;

  // --- LIVENESS, on real mtimes.
  // (a) THE 07-14 CASE: 45 min into the run, the working file was written 30 seconds ago.
  //     The old gate promoted here. The new one must FORBID.
  const alive = fixture('alive', { canaryMinAgo: 46, workingQuietMin: 0.5 });
  const okAliveState = liveness(alive, D).state === 'ALIVE';
  const okAliveForbid = canPromote(alive, D).some((x) => x.check === 'promote-over-live-editor');
  const okAliveNoSelfHeal = canSelfHeal(alive, D).length > 0;

  // (b) A REAL CRASH: canary 50 min old, the file has not moved in 25 min. Promote — the brief ships.
  const dead = fixture('dead', { canaryMinAgo: 50, workingQuietMin: 25 });
  const okDeadState = liveness(dead, D).state === 'QUIET';
  const okDeadPromote = canPromote(dead, D).length === 0;

  // (c) QUIESCENCE IS NOT SUFFICIENT: quiet, but only 20 min into the pass. Hold the floor.
  const early = fixture('early', { canaryMinAgo: 20, workingQuietMin: 21 });
  const okEarly = canPromote(early, D).some((x) => x.check === 'promote-inside-min-wait');

  // (d) A HOLD IS A DECISION: quiet + past the floor, but the Editor declared a hold. Never promote.
  const held = fixture('held', { canaryMinAgo: 60, workingQuietMin: 30, hold: 'Inner Game :: quote unverifiable' });
  const okHeld = canPromote(held, D).some((x) => x.check === 'promote-over-editor-hold');

  // (e) NEVER DEADLOCK: past the hard ceiling, promotion is allowed even if the file is still moving.
  const ceiling = fixture('ceiling', { canaryMinAgo: HARD_CEILING_MIN + 5, workingQuietMin: 1 });
  const okCeiling = canPromote(ceiling, D).length === 0;

  // (f) A GENUINELY DEAD EDITOR (nothing on disk, past the wait) may still be self-healed.
  const okAllowed = canSelfHeal(root, '1999-01-01').length === 0;

  // (g) IMP-072 (E-PIPELINE-EDITOR-STATUS-01): the Editor completed by ARTIFACT but wrote no
  //     brief-editor line to the board (the 07-18 gap). auditHandoff must FLAG editor-status-unlogged;
  //     adding the SUCCESS line makes it silent.
  const unlogged = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-unlogged-'));
  fs.mkdirSync(path.join(unlogged, 'daily-briefs'), { recursive: true });
  const ud = '2026-01-02';
  const uStatus = path.join(unlogged, 'daily-briefs', `${ud}-pipeline-status.md`);
  fs.writeFileSync(uStatus, 'brief-draft | START\nbrief-quality-gate | SUCCESS\n'); // NO brief-editor line
  fs.writeFileSync(path.join(unlogged, 'daily-briefs', `${ud}-editor-log.md`), '# editor log\nGate 1..15 all pass\n');
  const uV15 = path.join(unlogged, 'daily-briefs', `${ud}-v1.5.md`); fs.writeFileSync(uV15, '# v1.5\n');
  const uV2 = path.join(unlogged, 'daily-briefs', `${ud}-v2.md`); fs.writeFileSync(uV2, '# v2\n');
  const uOld = new Date(Date.now() - 5 * 60000); fs.utimesSync(uV15, uOld, uOld); // v2 fresher than v1.5
  const okUnlogged = auditHandoff(unlogged, ud).some((x) => x.check === 'editor-status-unlogged');
  fs.appendFileSync(uStatus, '2026-01-02T20:00:00Z | brief-editor | SUCCESS | done\n');
  const okLoggedSilent = !auditHandoff(unlogged, ud).some((x) => x.check === 'editor-status-unlogged');
  fs.rmSync(unlogged, { recursive: true, force: true });

  for (const d of [alive, dead, early, held, ceiling]) fs.rmSync(d, { recursive: true, force: true });

  const rows: [string, boolean][] = [
    ['FIRES on real 07-14 (mid-pass snapshot promoted, then superseded)', ok14],
    ['FIRES on real 07-13 (self-heal over a live Editor)', ok13],
    ['FIRES on real 07-13 (Critic PROVISIONAL, later Editor SUCCESS)', ok13Recon],
    ['FIRES on real 07-11 (same fingerprint — not day one)', ok11],
    ['SILENT on real 07-10 (clean handoff)', ok10],
    ['SILENT on real 07-12 (clean handoff)', ok12],
    ['LIVENESS: working file touched 30s ago at minute 46 = ALIVE', okAliveState],
    ['FORBIDS promotion of a file that is still being written (THE 07-14 FIX)', okAliveForbid],
    ['FORBIDS a self-heal over a live Editor', okAliveNoSelfHeal],
    ['LIVENESS: no write for 25 min = QUIET (a crash is the artifact stopping)', okDeadState],
    ['ALLOWS promotion of a genuinely crashed Editor (the brief always ships)', okDeadPromote],
    ['FORBIDS promotion inside the 45-min floor even when quiet', okEarly],
    ['FORBIDS promotion over an EDITOR-HOLD (a hold is a decision)', okHeld],
    ['ALLOWS a forced promotion past the 120-min hard ceiling (never deadlock)', okCeiling],
    ['ALLOWS a self-heal when the Editor is genuinely absent', okAllowed],
    ['IMP-072 FIRES on a completed-but-unlogged Editor (07-18 observability gap)', okUnlogged],
    ['IMP-072 SILENT once the brief-editor SUCCESS line is present', okLoggedSilent],
  ];

  console.log('editor-handoff-gate --selftest');
  for (const [label, ok] of rows) console.log(`  ${ok ? '✓' : '✗'} ${label}`);

  const ok = rows.every(([, x]) => x);
  if (ok) {
    console.log('\n✅ SELFTEST PASS — liveness is read from the artifact, not from a stopwatch: the gate bites 07-14/07-13/07-11, stays silent on 07-10/07-12, and never deadlocks a dead Editor.');
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  for (const x of [...silent10, ...silent12]) console.error(`  unexpected on a clean night: ${x.check} — ${x.message.slice(0, 120)}`);
  return 1;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  const root = process.cwd();
  const modes = ['--can-self-heal', '--can-promote', '--audit', '--liveness'];
  const i = argv.findIndex((a) => modes.includes(a));
  if (i < 0 || !argv[i + 1]) {
    console.error(`usage: editor-handoff-gate.ts (${modes.join(' | ')}) <DATE> | --selftest`);
    process.exit(2);
  }
  const mode = argv[i]!;
  const date = argv[i + 1]!;

  if (mode === '--liveness') {
    const l = liveness(root, date);
    console.log(`editor-handoff-gate --liveness ${date}`);
    console.log(`   state: ${l.state} — ${l.reason}`);
    if (l.state === 'ALIVE') {
      console.log('\n⏳ EDITOR ALIVE — WAIT. Do not promote, do not self-heal. Re-poll in 3 minutes.');
      process.exit(1);
    }
    console.log(l.state === 'QUIET'
      ? '\n✅ EDITOR QUIET — the artifact has stopped changing. Check --can-promote.'
      : '\n✅ NO EDITOR ARTIFACT — check --can-self-heal.');
    process.exit(0);
  }

  const v = mode === '--can-self-heal' ? canSelfHeal(root, date)
    : mode === '--can-promote' ? canPromote(root, date)
    : auditHandoff(root, date);

  console.log(`editor-handoff-gate ${mode} ${date}`);
  if (!v.length) {
    console.log(
      mode === '--can-self-heal' ? '✅ SELF-HEAL ALLOWED — no live Editor, no Editor artifact on disk.'
      : mode === '--can-promote' ? '✅ PROMOTION ALLOWED — the Editor has stopped writing, past the floor, no hold.'
      : '✅ HANDOFF CLEAN.');
    process.exit(0);
  }
  for (const x of v) console.log(`   ✗ [${x.check}] ${x.message}`);
  console.log(`\n❌ ${v.length} violation(s).`);
  process.exit(1);
}

if (process.argv[1] && process.argv[1].includes('editor-handoff-gate')) main();
