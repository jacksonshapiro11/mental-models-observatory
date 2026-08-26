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
 *   --can-self-heal <DATE>   may the Critic rebuild v2 from v1.5?
 *                            exit 0 = SELF-HEAL ALLOWED · exit 1 = SELF-HEAL FORBIDDEN
 *                            exit 3 = SELF-HEAL UNKNOWN — NOT a verdict. Fetch the scheduler
 *                            reading and re-run. NEVER treat 3 as 0. (IMP-216)
 *
 * Inputs (IMP-216 — apply to --can-self-heal and --liveness):
 *   --scheduler-lastrun <ISO|NEVER>   brief-editor.lastRunAt from `list_scheduled_tasks`. Without it
 *                                     these modes CANNOT answer and return UNKNOWN by contract.
 *   --scheduler-state-dir <DIR>       override the opportunistic scheduler-state read.
 *   --now <ISO>                       REPLAY ONLY — pin the clock so a receipt is reproducible.
 *                                     Banner-ed on every use. Never act on a simulated verdict.
 *   --unedited-promotion <DATE> [--strict]
 *                            ESC-020 tripwire. FIRES when v1.5 and v2 are the same brief
 *                            (file md5 OR reader-body) AND the editor log is absent or does not
 *                            contain the honest stamp token SELFHEAL. exit 1 under --strict
 *                            (daily canary); exit 0 warn-only otherwise (morning path).
 *   --audit <DATE>           post-hoc: self-heal/promotion over a live Editor, or an unreconciled
 *                            PROVISIONAL Critic report. exit 1 = violation.
 *   --audit-nonproduction <DATE> --scheduler-lastrun <ISO|NEVER>
 *                            THE MORNING ALARM (IMP-216, 2026-08-24). The scheduler says the Editor
 *                            FIRED, it is past the fired-and-silent band, and there is NO trace of
 *                            it anywhere — no v2, no working file, no board line. exit 1 = the
 *                            Editor produced NOTHING and the reader got an unedited brief.
 *                            exit 3 = UNKNOWN (no scheduler reading) — NOT a clean bill of health.
 *   --finalize <DATE>        IMP-164: retire the working file, assert the editor log, enforce the
 *                            Gate 16 cut order, print the required paste block. Idempotent.
 *   --selftest               both directions, on the REAL 07-10…07-14 artifacts + mtime fixtures.
 *
 * Exit: 0 clean · 1 violation · 2 usage.
 */
import * as crypto from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// IMP-164 — ONE definition of a Six unit, shared with the Validator. Importing is deliberate:
// a second word-counter here would be free to drift from the one the Editor reads, and two
// counters measuring one thing is the failure that killed checkSixBulletWordCeiling.
// validate-brief.ts only runs main() when invoked directly, so this import has no side effects.
import { sixUnitHardBreach } from './validate-brief.ts';

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
/** IMP-141 (2026-08-08 Critic mandate #3, 🔴, RC2). A working file smaller than this is not a brief.
 *  THE FAILURE: twenty minutes after `brief-editor … SUCCESS` on 08-08, `2026-08-08-v2.working.md`
 *  sat on disk at 0 BYTES — Brief_Editor rule 6 requires the working file be DELETED on promotion and
 *  it was TRUNCATED instead — and `--liveness 2026-08-08` answered
 *      "state: ALIVE — written 9.4 min ago (< 20 min) — the Editor is STILL WRITING IT".
 *  This file is IMP-048 with its own assumption inverted: liveness was correctly moved off a countdown
 *  and onto the working file's mtime, and NOTHING ever checked that the file has CONTENT. On any night
 *  v2 is genuinely absent the path runs: false ALIVE (20 min) → mtime ages → QUIET → "quiet file, no
 *  hold, past the floor ⇒ the Editor crashed, promote its working file" → A 0-BYTE BRIEF IS PROMOTED,
 *  or the 120-min ceiling forces the same thing. NEVER-DEADLOCK MUST NOT MEAN NEVER-SANITY-CHECK:
 *  forcing the promotion of nothing is not shipping the brief, it is shipping the absence of one.
 *  CALIBRATED, NOT CHOSEN: the selftest re-derives the smallest real v2 on disk from the trailing
 *  boards and fails if this floor has crept up toward it, so it can never start eating real briefs. */
export const MIN_PLAUSIBLE_BRIEF_BYTES = 4000;

// ── IMP-216 (2026-08-23 Critic mandate #3, 🔴, RC3): THE SCHEDULER IS THE ONLY WITNESS ────────
// E-PIPELINE-EDITOR-NONPRODUCTION-01 day 3 · E-CRITIC-EVIDENCE-SELFPOISON-01 day 1.
//
// THE BLINDNESS, in one sentence: `brief-editor` writes NO canary at start and creates NO working
// file early, so on disk **"never started" and "started and produced nothing" are the same string**,
// and every function above this line reads only the board and the disk.
//
// THE RECEIPTS, two consecutive nights, WRONG IN BOTH DIRECTIONS:
//   2026-08-22  scheduler lastRunAt 23:20:14Z (fired, unterminated) · board: zero brief-editor lines
//               → `--can-self-heal` EXIT 0  "SELF-HEAL ALLOWED"      ← A FALSE PERMIT over a live Editor.
//   2026-08-23  scheduler lastRunAt 23:20:17.192Z (fired, T+32)      · board: one brief-editor CANARY
//               → `--can-self-heal` EXIT 1  FORBIDDEN                ← the RIGHT verdict read off a
//               canary THE CRITIC ITSELF had written 90 seconds earlier while obeying Brief_Editor L31.
//               Its own report: "right answer, fabricated evidence… tonight's right answer was luck."
//               A CANARY-RETRACTION was appended and no board-reading guard honours it: **a false
//               canary is unrecallable**, which is why the fix is an INPUT, not a louder board.
//
// THE PRIMITIVE, STATED ONCE AND SYMMETRIC TO THE ONE AT THE TOP OF THIS FILE:
//   A crash is "the artifact stopped changing". **An absence is "the process never fired" — and
//   nothing on disk can tell you that.** An existence check with no liveness input must therefore
//   REFUSE TO ANSWER (UNKNOWN), never guess. UNKNOWN is not a soft ALLOWED; it is a distinct verdict
//   with a distinct exit code, because every caller of the old gate read "no violations" as "go".
//
// THE BAND. schedulerLiveness() still classifies FIRED-AND-SILENT vs FIRED-PAST-BAND at 16–38 min
// (the 08-23 Critic's recorded silence window). That classification feeds --audit-nonproduction.
// It does NOT authorise or forbid self-heal. 2026-08-26b: a blanket refuse past 38 min meant a
// genuinely dead editor could never be self-healed — six of the last seven nights. Discriminator:
//   canary present, no terminal, lastRunAt this cycle → still working → REFUSE (live-canary)
//   no canary at all, lastRunAt this cycle           → fired and did nothing → ALLOW (empty-body)
//   terminal line present, or NEVER                  → ALLOW (terminated / never)
// A live Editor writes a CANARY at STEP 0. Its absence is the empty-body state, not "in flight".
// The 2c-still-running case (canary written, no terminal, lastRunAt 40+ min) has never occurred
// in production because 2c has never run; it is held out synthetically.
/** Lower edge of the observed fired-and-silent band. Below this the Editor cannot even have
 *  finished; reported for the message, not for --can-self-heal. */
export const EDITOR_FIRE_BAND_MIN_MIN = 16;
/** Top of the band for schedulerLiveness / --audit-nonproduction. NOT a self-heal cutoff. */
export const EDITOR_FIRE_BAND_MAX_MIN = 38;
/** The third verdict. NOT 0 (ALLOWED) and NOT 1 (FORBIDDEN) — a caller that branches on either of
 *  those must fall through to a code it does not recognise rather than silently proceed. */
export const SELF_HEAL_UNKNOWN_EXIT: number = 3;
/** The verdict tokens every caller parses. One line, one token, no inference from violation counts. */
export const VERDICT_TOKEN = {
  ALLOWED: 'SELF-HEAL ALLOWED',
  FORBIDDEN: 'SELF-HEAL FORBIDDEN',
  UNKNOWN: 'SELF-HEAL UNKNOWN',
} as const;
/** Where the scheduler parks its per-task state, when this box exposes it at all. Opportunistic:
 *  the FLAG is the contract, this is a convenience so the Critic need not paste on every poll. */
export const SCHEDULER_STATE_DIR_DEFAULT = path.join(
  os.homedir(),
  'Documents',
  'Claude',
  'Scheduled',
  'brief-editor'
);

type Violation = { check: string; message: string };
const DB = (root: string) => path.join(root, 'daily-briefs');

interface EditorLine {
  ts: Date | null;
  kind: 'CANARY' | 'SUCCESS' | 'FAIL' | 'SELF-HEAL' | 'OTHER';
  raw: string;
}

const statusLines = (root: string, date: string): string[] => {
  const p = path.join(DB(root), `${date}-pipeline-status.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n') : [];
};

// Classify by the STATUS FIELD, never by substring. The 07-13 Editor's SUCCESS line reads
// "… | SUCCESS | … Supersedes SELF-HEAL-CRITIC entry." — a naive /SELF-HEAL/ test on the whole
// line calls the Editor's completion a self-heal. (Caught by this gate's own selftest.)
//
// ── THE SELECTOR IS A FIELD TOO, NOT A SUBSTRING (added 2026-08-17 — IMP-184, RC2) ────────────
// The rule above was learned for the KIND and never applied to the SELECTION, so for months both
// selectors below asked "does this line MENTION the task?" — and on this board every task narrates
// every other task at length. RECEIPTS, from the real 2026-08-17 status board:
//   line 32  `… | brief-critic | … | SUCCESS |` — prose names brief-editor → read as an EDITOR SUCCESS
//   line 32  the same line mentions brief-quality-gate      → read as a QG SUCCESS at 00:27:29Z
//   line 15  `… | signal-discovery-draft | …`               → read as an Editor line
//   line 19 (08-03) `… | brief-email | …`                   → read as a QG line
// Two live consequences, not one cosmetic one:
//   (1) MEASUREMENT. The QG runtime distribution took max(terminal) − min(canary) across the
//       contaminated set, so 2026-08-17 measured 105.2 min against a real QG runtime of 86.98
//       (CANARY 22:42:15Z → SUCCESS 00:09:14Z). That tripped the calibration leg — the leg whose
//       whole purpose is that QG_NO_ARTIFACT_WAIT_MIN "cannot quietly go stale" — and red-failed
//       nine ledger rows on a number no QG ever ran.
//   (2) CORRECTNESS, and this is the one that could ship a bad brief. `qgLiveness` returns QUIET
//       the moment it finds a terminal line, with the reason "the QG has finished". A foreign
//       SUCCESS line that merely mentions the quality gate therefore clears the Editor to seed a
//       passthrough v1.5 over a QG that is still writing — verbatim the 2026-08-03 failure this
//       function exists to prevent. Symmetrically, `liveness()` reads a brief-critic SUCCESS as the
//       Editor's own, which silences IMP-072's completed-but-unlogged check (the 07-18 gap).
// A line's task is the SECOND PIPE FIELD of a real status line. Nothing else is its task.
/** The task that OWNS a status line — `{ts} | {task} | {output} | {STATUS} | {reason}`.
 *  Returns null for any line that is not a status line (prose, headers, continuations), which is
 *  why field 0 must be a bare timestamp and not merely contain one. */
export function lineTask(raw: string): string | null {
  const fields = raw.split('|');
  if (fields.length < 2) return null;
  if (!/^\s*\d{4}-\d{2}-\d{2}T[\d:]+(?:Z|[+-]\d{2}:?\d{2})?\s*$/.test(fields[0]!))
    return null;
  return fields[1]!.trim();
}
/** True only when THIS line's task field is the named task. */
const ownedBy = (raw: string, task: RegExp): boolean => {
  const t = lineTask(raw);
  return t !== null && task.test(t);
};

function editorLines(root: string, date: string): EditorLine[] {
  const out: EditorLine[] = [];
  for (const raw of statusLines(root, date)) {
    if (!ownedBy(raw, /^brief-editor$/i)) continue;
    const tsm = raw.match(/(\d{4}-\d{2}-\d{2}T[\d:]+Z)/);
    const ts = tsm ? new Date(tsm[1]) : null;
    const fields = raw.split('|').map(f => f.trim());
    const has = (re: RegExp) => fields.some(f => re.test(f));
    const kind: EditorLine['kind'] = has(/^SUCCESS$/i)
      ? 'SUCCESS'
      : has(/^FAIL/i)
        ? 'FAIL'
        : has(/^SELF-HEAL/i)
          ? 'SELF-HEAL'
          : has(/^CANARY$/i) || has(/^CANARY\b/i)
            ? 'CANARY'
            : 'OTHER';
    out.push({ ts, kind, raw: raw.trim() });
  }
  return out;
}

export type LivenessState = 'ALIVE' | 'QUIET' | 'ABSENT';
export interface Liveness {
  state: LivenessState;
  quietMin: number | null; // minutes since the working file was last written
  canaryAgeMin: number | null;
  workingPath: string;
  reason: string;
  bytes: number | null; // IMP-141: null = nothing on disk. 0 = a truncated scratch file.
}

/** THE LOAD-BEARING FUNCTION. Liveness is mtime, not a stopwatch. */
export function liveness(
  root: string,
  date: string,
  now = new Date()
): Liveness {
  const working = path.join(DB(root), `${date}-v2.working.md`);
  const lines = editorLines(root, date);
  const canary = lines.find(l => l.kind === 'CANARY');
  const canaryAgeMin = canary?.ts
    ? (now.getTime() - canary.ts.getTime()) / 60000
    : null;

  if (!fs.existsSync(working)) {
    return {
      state: 'ABSENT',
      quietMin: null,
      canaryAgeMin,
      workingPath: working,
      bytes: null,
      reason: `no ${date}-v2.working.md on disk${canaryAgeMin !== null ? ` (CANARY ${canaryAgeMin.toFixed(0)} min old)` : ''}`,
    };
  }
  const st = fs.statSync(working);
  const bytes = st.size;
  const quietMin = (now.getTime() - st.mtimeMs) / 60000;

  // IMP-141: AN EMPTY FILE IS NOT A LIVE EDITOR. A fresh mtime on a 0-byte file is a truncate, a
  // `touch`, or a promotion that failed to delete its scratch — never a pass in progress. Reporting
  // ALIVE here burns 20 minutes and then hands a QUIET empty file to the promotion path. Reporting
  // ABSENT is both true and safe: ABSENT makes promotion IMPOSSIBLE (see canPromote), and the
  // self-heal path it opens is independently held shut by the CANARY guard in canSelfHeal for
  // NO_ARTIFACT_WAIT_MIN — so an Editor that has genuinely only just started is still protected.
  if (bytes < MIN_PLAUSIBLE_BRIEF_BYTES) {
    return {
      state: 'ABSENT',
      quietMin,
      canaryAgeMin,
      workingPath: working,
      bytes,
      reason: `${date}-v2.working.md exists but is ${bytes} byte(s) — below the ${MIN_PLAUSIBLE_BRIEF_BYTES}-byte floor, so it is a truncated or empty scratch file, NOT an Editor artifact (last written ${quietMin.toFixed(1)} min ago). 2026-08-08 receipt: this exact file sat at 0 bytes and the gate called it ALIVE.`,
    };
  }
  // IMP-149 (2026-08-09, 08-09 Critic mandate #3 — SECOND CONSECUTIVE NIGHT of the
  // same rule failing, one night after IMP-141 shipped). IMP-141 fixed the shape it
  // was SHOWN — an empty husk — not the rule it was written for: Brief_Editor rule 6
  // requires the working file to be DELETED on promotion, with an `ls` receipt.
  // RECEIPT: on 08-09 the working file survived promotion at 37,973 bytes, a
  // BYTE-IDENTICAL COPY of the promoted v2 with the same mtime. It clears the
  // 4,000-byte plausibility floor effortlessly and then reads ALIVE for 20 minutes
  // and QUIET forever after.
  //
  // A working file identical to the promoted v2 is not an Editor mid-pass; it is the
  // fingerprint of a finished pass that skipped its delete. Reporting ABSENT is both
  // true and safe: v2 already exists, so there is nothing the promotion path needs
  // from this file, and ABSENT makes promoting it impossible.
  //
  // Deliberately IDENTITY, not similarity: a real mid-pass working file differs from
  // the previous v2 by whatever the Editor has changed so far, and any threshold
  // below exact equality would start calling live Editors dead on a light-edit night.
  const promoted = path.join(DB(root), `${date}-v2.md`);
  if (fs.existsSync(promoted)) {
    const pst = fs.statSync(promoted);
    if (
      pst.size === bytes &&
      fs.readFileSync(promoted, 'utf8') === fs.readFileSync(working, 'utf8')
    ) {
      return {
        state: 'ABSENT',
        quietMin,
        canaryAgeMin,
        workingPath: working,
        bytes,
        reason: `${date}-v2.working.md is BYTE-IDENTICAL to the promoted ${date}-v2.md (${bytes} bytes) — the Editor finished and did not delete its scratch file (Brief_Editor rule 6 requires deletion with an \`ls\` receipt). This is a leftover, not a pass in progress, so it is ABSENT for promotion purposes. 2026-08-09 receipt: this exact file survived promotion at 37,973 bytes and read ALIVE.`,
      };
    }
  }

  // IMP-216 (2026-08-24) — THE STAGED COPY THAT WAS NEVER EDITED.
  // Brief_Editor Gate 0.5 now requires the working file to be created as a BYTE-COPY OF v1.5 as
  // the Editor's first file action, so that "never started" and "died at check 3" stop being the
  // same empty string on disk. That fix hands this function a new shape it has never seen, and the
  // shape is dangerous: a fresh, 60,000-byte, perfectly plausible working file that contains ZERO
  // editorial work. Left unhandled it reads ALIVE for 20 min, then QUIET, and then `--can-promote`
  // says "quiet file, no hold, past the 45-min floor ⇒ promote it" — and an UNEDITED v1.5 ships as
  // v2. That is the precise harm this whole improvement exists to stop, re-entering through the
  // door the fix opened.
  //
  // The primitive at the top of this file already answers it and only needed applying: LIVENESS IS
  // THE ARTIFACT CHANGING. A byte-copy of v1.5 has not changed. So the staged file proves the
  // Editor STARTED (which is what `--audit-nonproduction` and the `--liveness` mtime read want);
  // only a DIVERGED staged file proves the Editor is WORKING.
  //
  // ABSENT is both true and safe here, exactly as in the IMP-149 branch above: it makes promotion
  // IMPOSSIBLE (canPromote's `promote-nothing`), and the self-heal it opens is independently held
  // shut for NO_ARTIFACT_WAIT_MIN by the CANARY guard in canSelfHeal — so an Editor that has only
  // just staged its copy is still protected for a full hour, by which time the 5-minute HEARTBEAT
  // contract (Brief_Editor rule 7) has long since made the file differ. Past that hour, an Editor
  // with zero edits to show IS dead, and self-heal — which runs the checks — is the right recovery.
  // IDENTITY, never similarity, for the same reason as IMP-149: a real pass differs from v1.5 by
  // whatever it has changed so far, and any looser threshold starts calling live Editors dead on a
  // light-edit night.
  //
  // 🔴 BODIES, NOT BYTES (IMP-222, 2026-08-25 Critic mandate #3a). The identity test above was
  // written against a `cp` and was defeated the first night it ran, by a stage that copied the
  // reader body WITHOUT the comment blocks: 80,496 B of v1.5 became a 40,546 B working file whose
  // every reader-facing byte was v1.5's, and byte-identity read DIVERGED — i.e. "the Editor is
  // working" — on a file containing zero editorial work. Comment-stripping is what a body-only
  // staging naturally does, so that is the DEFAULT path, not an edge case. `readerBody` compares
  // what the reader gets; a byte-identical `cp` is still caught, because byte-identical implies
  // body-identical, and one changed reader-facing word still reads as work (a gate that holds a
  // genuinely edited brief is worse than the hole it closes — the brief always ships).
  const v15 = path.join(DB(root), `${date}-v1.5.md`);
  if (fs.existsSync(v15)) {
    const bodyV15 = readerBodyOf(v15);
    const bodyWorking = readerBodyOf(working);
    if (bodyV15 !== null && bodyV15 === bodyWorking) {
      const v15Bytes = fs.statSync(v15).size;
      return {
        state: 'ABSENT',
        quietMin,
        canaryAgeMin,
        workingPath: working,
        bytes,
        reason: `${date}-v2.working.md is READER-BODY-IDENTICAL to ${date}-v1.5.md (${bytes} vs ${v15Bytes} bytes on disk — ${bytes === v15Bytes ? 'a byte copy' : 'the comment blocks differ, the brief does not'}) — this is the Gate 0.5 STAGED COPY with ZERO editorial work applied (last written ${quietMin.toFixed(1)} min ago). The staged file proves the Editor STARTED; only a file whose READER BODY has diverged from v1.5 proves it is WORKING. ABSENT here is what stops --can-promote from shipping an unedited v1.5 as v2 at the 45-minute floor. If this persists past the CANARY budget, the recovery is --can-self-heal (which runs the Editor's checks), never promotion of this file.`,
      };
    }
  }

  return {
    state: quietMin < QUIET_MIN ? 'ALIVE' : 'QUIET',
    quietMin,
    canaryAgeMin,
    workingPath: working,
    bytes,
    reason:
      quietMin < QUIET_MIN
        ? `${date}-v2.working.md was written ${quietMin.toFixed(1)} min ago (< ${QUIET_MIN} min) — the Editor is STILL WRITING IT`
        : `${date}-v2.working.md has not changed for ${quietMin.toFixed(0)} min (≥ ${QUIET_MIN}) — the Editor has stopped`,
  };
}

/** May the Critic promote {date}-v2.working.md → v2.md? (07-14's exact question.) */
export function canPromote(
  root: string,
  date: string,
  now = new Date()
): Violation[] {
  const v: Violation[] = [];
  const l = liveness(root, date, now);
  const lines = editorLines(root, date);
  const failed = lines.some(x => x.kind === 'FAIL');
  const forced = l.canaryAgeMin !== null && l.canaryAgeMin >= HARD_CEILING_MIN;

  // IMP-141 — FIRST, AND IT OUTRANKS `forced`. Every other refusal below can be overridden by the
  // 120-minute never-deadlock ceiling; this one cannot, because the thing the ceiling exists to
  // guarantee — that a brief ships — is precisely what promoting an empty file destroys. Read the
  // size directly rather than trusting the state above, so that a future reordering of liveness()
  // cannot silently reopen the hole.
  if (l.bytes !== null && l.bytes < MIN_PLAUSIBLE_BRIEF_BYTES) {
    v.push({
      check: 'promote-empty-artifact',
      message: `PROMOTION REFUSED — ${path.basename(l.workingPath)} is ${l.bytes} byte(s), below the ${MIN_PLAUSIBLE_BRIEF_BYTES}-byte plausible-brief floor. THIS REFUSAL SURVIVES THE ${HARD_CEILING_MIN}-MINUTE HARD CEILING${forced ? ' (which is currently ACTIVE — canary ' + l.canaryAgeMin?.toFixed(0) + ' min old)' : ''}: never-deadlock means the brief always ships, and a 0-byte v2 is not a brief that shipped, it is the absence of one wearing the filename. 2026-08-08 receipt: this file sat at 0 bytes 20 minutes after brief-editor SUCCESS (Brief_Editor rule 6 requires DELETION on promotion; it was truncated instead) and --liveness answered ALIVE. If v2 is genuinely missing, run --can-self-heal and rebuild from v1.5 — do not promote a husk.`,
    });
    return v;
  }

  if (l.state === 'ABSENT') {
    v.push({
      check: 'promote-nothing',
      message: `PROMOTION IMPOSSIBLE — ${l.reason}. There is no Editor artifact to promote.`,
    });
    return v;
  }
  if (l.state === 'ALIVE' && !failed && !forced) {
    v.push({
      check: 'promote-over-live-editor',
      message: `PROMOTION FORBIDDEN — ${l.reason}. This is the 07-14 failure: a mid-pass snapshot was promoted at the 45-minute mark while the Editor (running ~65 min after a context-overflow resume) was still compressing bullets, and the brief that shipped was graded by nobody. WAIT and re-poll --liveness. A crash is "the artifact stopped changing," never "my timer went off."`,
    });
    return v;
  }
  if (
    l.state === 'QUIET' &&
    !failed &&
    !forced &&
    (l.canaryAgeMin === null || l.canaryAgeMin < MIN_WAIT_MIN)
  ) {
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

// ── IMP-216: THE SCHEDULER READING ────────────────────────────────────────────────────────────
/** What the scheduler said, and where we got it. `never` = the scheduler was CONSULTED and reports
 *  no run for this cycle — that is a reading, and a decisive one. It is not the absence of a reading. */
export interface SchedulerReading {
  lastRunAt: Date | null;
  never: boolean;
  source: string;
}
export type SchedulerState =
  | 'UNKNOWN' // no reading was supplied. The gate must REFUSE, not guess.
  | 'NEVER-FIRED' // consulted; the slot did not fire this cycle (the real 2026-08-21).
  | 'FIRED-AND-SILENT' // fired, inside the band, nothing on the board or disk (the real 2026-08-23).
  | 'FIRED-PAST-BAND' // fired, past the band, still nothing — dead. This leg ABSTAINS.
  | 'FIRED-AND-OBSERVED'; // fired AND left a trace; the artifact guards own it. This leg ABSTAINS.
export interface SchedulerLiveness {
  state: SchedulerState;
  elapsedMin: number | null;
  reading: SchedulerReading | null;
  reason: string;
}

/** Parse `--scheduler-lastrun`. Accepts an ISO instant or the explicit NEVER/NONE sentinel.
 *  Returns null for anything else — the CALLER turns that into a usage error, never into UNKNOWN:
 *  a typo must not be able to buy the gate's silence. */
export function parseSchedulerLastRun(
  raw: string,
  source = 'flag:--scheduler-lastrun'
): SchedulerReading | null {
  const s = raw.trim();
  if (/^(never|none|no-run|not-fired)$/i.test(s))
    return { lastRunAt: null, never: true, source };
  const d = new Date(s);
  if (!/\d{4}-\d{2}-\d{2}T/.test(s) || Number.isNaN(d.getTime())) return null;
  return { lastRunAt: d, never: false, source };
}

/** Opportunistic: read the scheduler's own state directory when this box exposes one. Any JSON in
 *  it carrying a lastRunAt-shaped field counts. Absent/unreadable ⇒ null ⇒ UNKNOWN, which is the
 *  whole point: a missing file is not evidence of anything. */
export function readSchedulerStateDir(
  dir = SCHEDULER_STATE_DIR_DEFAULT
): SchedulerReading | null {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/\.json$/i.test(f)) continue;
      const p = path.join(dir, f);
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        continue;
      }
      const raw =
        obj['lastRunAt'] ?? obj['last_run_at'] ?? obj['lastRun'] ?? null;
      if (typeof raw !== 'string') continue;
      const r = parseSchedulerLastRun(raw, `file:${p}`);
      if (r) return r;
    }
  } catch {
    return null;
  }
  return null;
}

/** DID THE PROCESS FIRE, AND HOW LONG AGO — the question the board and the disk cannot answer.
 *  Deliberately independent of `liveness()`: that one reads the artifact, this one reads the
 *  process. They are combined by the caller, never merged, so neither can launder the other. */
export function schedulerLiveness(
  root: string,
  date: string,
  reading: SchedulerReading | null,
  now = new Date()
): SchedulerLiveness {
  if (!reading)
    return {
      state: 'UNKNOWN',
      elapsedMin: null,
      reading: null,
      reason: `no scheduler reading supplied. \`brief-editor\` writes no canary at start and no early working file, so "never fired" and "fired and produced nothing" are the SAME STRING on this board and on this disk. There is no evidence here from which to answer the question; pass --scheduler-lastrun <ISO|NEVER> (list_scheduled_tasks → brief-editor.lastRunAt).`,
    };
  if (reading.never)
    return {
      state: 'NEVER-FIRED',
      elapsedMin: null,
      reading,
      reason: `the scheduler was consulted (${reading.source}) and reports NO run of brief-editor for this cycle. This is the real 2026-08-21 state: the slot never fired, so there is no process to race.`,
    };

  const last = reading.lastRunAt!;
  const elapsedMin = (now.getTime() - last.getTime()) / 60000;

  // The QG's terminal line is this cycle's floor: the Editor slot runs AFTER it. A lastRunAt that
  // predates it belongs to a PREVIOUS night, which is the same fact as "did not fire tonight" —
  // exactly how the 08-21 Critic stated it ("no lastRunAt after the QG's SUCCESS").
  const qgTerm = qgLines(root, date)
    .filter(l => (l.kind === 'SUCCESS' || l.kind === 'FAIL') && l.ts)
    .map(l => l.ts!.getTime())
    .sort((a, b) => b - a)[0];
  if (qgTerm !== undefined && last.getTime() < qgTerm)
    return {
      state: 'NEVER-FIRED',
      elapsedMin,
      reading,
      reason: `brief-editor lastRunAt = ${last.toISOString()} PREDATES this cycle's brief-quality-gate terminal line (${new Date(qgTerm).toISOString()}), so that run belongs to a previous night: the slot did NOT fire for ${date}.`,
    };

  // Did it leave any trace at all? If so the artifact guards above already have real evidence and
  // this leg must not double-count it (nor override it — see MONOTONICITY).
  const traced =
    editorLines(root, date).length > 0 ||
    fs.existsSync(path.join(DB(root), `${date}-v2.working.md`)) ||
    fs.existsSync(path.join(DB(root), `${date}-v2.md`)) ||
    fs.existsSync(path.join(DB(root), `${date}-editor-log.md`));
  if (traced)
    return {
      state: 'FIRED-AND-OBSERVED',
      elapsedMin,
      reading,
      reason: `brief-editor fired ${elapsedMin.toFixed(0)} min ago (${last.toISOString()}) AND left a trace (board line and/or artifact). The artifact guards own this verdict; the scheduler leg abstains.`,
    };

  if (elapsedMin <= EDITOR_FIRE_BAND_MAX_MIN)
    return {
      state: 'FIRED-AND-SILENT',
      elapsedMin,
      reading,
      reason: `brief-editor FIRED at ${last.toISOString()} and is T+${elapsedMin.toFixed(0)} min with NOTHING on the board or the disk — inside the observed ${EDITOR_FIRE_BAND_MIN_MIN}–${EDITOR_FIRE_BAND_MAX_MIN} min fired-and-silent band${elapsedMin < EDITOR_FIRE_BAND_MIN_MIN ? `, and below its ${EDITOR_FIRE_BAND_MIN_MIN}-min floor it cannot even have finished` : ''}. NO STEP-0 CANARY: this is empty-body, not in-flight. A live Editor writes a CANARY as its first action.`,
    };
  return {
    state: 'FIRED-PAST-BAND',
    elapsedMin,
    reading,
    reason: `brief-editor fired at ${last.toISOString()}, T+${elapsedMin.toFixed(0)} min, past the ${EDITOR_FIRE_BAND_MAX_MIN}-min band with nothing on the board or the disk — DEAD. The scheduler leg abstains; the pre-existing guards decide.`,
  };
}

/** A STEP-0 canary written by the live Editor, not a Critic-invoked / SELF-HEAL decoy.
 *  08-23: `| brief-editor | CANARY | WRITE-OK (SELF-HEAL, Critic-invoked: …)` is not STEP 0. */
export function isOwnStep0CanaryLine(raw: string): boolean {
  const fields = raw.split('|').map(f => f.trim());
  if (fields.length < 3) return false;
  if (!/^CANARY$/i.test(fields[2]!)) return false;
  const payload = fields.slice(3).join(' ');
  if (/\bSELF-HEAL\b|Critic-invoked/i.test(payload)) return false;
  return true;
}

/** May the Critic rebuild v2 from a v1.5 copy? Strictly narrower than promotion.
 *  2026-08-26b: the discriminator is the STEP-0 CANARY, not the 16–38 min silence band.
 *  `sched` is optional. Omitting it still forbids a live canary / live artifact; it cannot
 *  authorise empty-body (that needs a this-cycle lastRunAt, else UNKNOWN). */
export function canSelfHeal(
  root: string,
  date: string,
  now = new Date(),
  _sched?: SchedulerLiveness
): Violation[] {
  const v: Violation[] = [];
  const lines = editorLines(root, date);
  const terminal = lines.find(l => l.kind === 'SUCCESS' || l.kind === 'FAIL');
  const ownCanary = lines.find(l => isOwnStep0CanaryLine(l.raw));
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
  // No age cap. A live Editor past 38 min — and past NO_ARTIFACT_WAIT_MIN — still has its
  // STEP-0 canary. The 60-min cutoff would have PERMITTED the 2c-still-running case the
  // 08-26b ruling exists to refuse. Held out synthetically: canary, no terminal, T+40 → REFUSE.
  if (ownCanary && !terminal) {
    const ageMin = l.canaryAgeMin ?? Infinity;
    v.push({
      check: 'self-heal-over-live-editor',
      message: `SELF-HEAL FORBIDDEN — a brief-editor STEP-0 CANARY exists with no SUCCESS/FAIL (${ageMin === Infinity ? 'age unknown' : ageMin.toFixed(0) + ' min old'}). CANARY means the Editor is ALIVE. The empty-body failure writes no canary at all; a live pass past 19:30 still has this line. WAIT and re-check.`,
    });
  }
  if (!ownCanary && !terminal && fs.existsSync(elog)) {
    v.push({
      check: 'self-heal-over-editor-artifact',
      message: `SELF-HEAL FORBIDDEN — ${date}-editor-log.md exists: the Editor ran. Read its log (and any EDITOR-HOLD) before declaring it missing.`,
    });
  }
  return v;
}

/** IMP-216 — THE THREE-VALUED VERDICT. The old CLI inferred the answer from a violation COUNT, so
 *  "I have no evidence" and "I have evidence of absence" produced the identical EXIT 0 and the
 *  identical green sentence. They are opposite facts. Resolution order, and the order is the rule:
 *    1. FORBIDDEN outranks everything — positive evidence of a live Editor needs no scheduler
 *       (STEP-0 canary, or a live/quiet artifact).
 *    2. Otherwise, no scheduler reading ⇒ UNKNOWN.
 *    3. Only a reading that positively rules out a live process yields ALLOWED.
 *  2026-08-26b: ALLOWED now includes the empty-body case (lastRunAt this cycle, no STEP-0 canary).
 *  That used to be FORBIDDEN inside the 16–38 band, which is how a dead editor could never be
 *  healed. The branch field on the decision names which arm fired so this is never re-diagnosed
 *  by inference. */
export type SelfHealVerdict = 'ALLOWED' | 'FORBIDDEN' | 'UNKNOWN';
export type SelfHealBranch =
  | 'live-canary'
  | 'live-artifact'
  | 'empty-body'
  | 'terminated'
  | 'never'
  | 'unknown';
export interface SelfHealDecision {
  verdict: SelfHealVerdict;
  branch: SelfHealBranch;
  token: string;
  exitCode: number;
  violations: Violation[];
  sched: SchedulerLiveness;
}
export function selfHealBranchOf(
  root: string,
  date: string,
  sched: SchedulerLiveness,
  violations: Violation[]
): SelfHealBranch {
  if (violations.some(x => x.check === 'self-heal-over-live-editor')) return 'live-canary';
  if (violations.some(x => x.check === 'self-heal-over-editor-artifact')) return 'live-artifact';
  if (sched.state === 'UNKNOWN') return 'unknown';
  if (sched.state === 'NEVER-FIRED') return 'never';
  const lines = editorLines(root, date);
  if (lines.some(l => l.kind === 'SUCCESS' || l.kind === 'FAIL')) return 'terminated';
  return 'empty-body';
}
export function selfHealDecision(
  root: string,
  date: string,
  opts: { reading?: SchedulerReading | null; now?: Date } = {}
): SelfHealDecision {
  const now = opts.now ?? new Date();
  const sched = schedulerLiveness(root, date, opts.reading ?? null, now);
  const violations = canSelfHeal(root, date, now, sched);
  const branch = selfHealBranchOf(root, date, sched, violations);
  if (violations.length)
    return {
      verdict: 'FORBIDDEN',
      branch,
      token: VERDICT_TOKEN.FORBIDDEN,
      exitCode: 1,
      violations,
      sched,
    };
  if (sched.state === 'UNKNOWN')
    return {
      verdict: 'UNKNOWN',
      branch: 'unknown',
      token: VERDICT_TOKEN.UNKNOWN,
      exitCode: SELF_HEAL_UNKNOWN_EXIT,
      violations,
      sched,
    };
  return {
    verdict: 'ALLOWED',
    branch,
    token: VERDICT_TOKEN.ALLOWED,
    exitCode: 0,
    violations,
    sched,
  };
}

// ── IMP-216 (2026-08-24 Critic mandate #2, 🔴, RC3): --audit-nonproduction ────────────────────
// E-PIPELINE-EDITOR-NONPRODUCTION-01, DAY 4.
//
// THE RECEIPT, four consecutive nights, and the fourth is the one that indicts this file:
//   08-21  brief-editor NEVER FIRED.        Zero lines. The Critic ran the whole Editor pass 23:40:32Z.
//   08-22  FIRED 23:20:14Z, produced NOTHING.  Critic graded v1.5 PROVISIONAL.
//   08-23  FIRED 23:20:17Z, produced NOTHING.  Critic graded v1.5 PROVISIONAL.
//   08-24  FIRED 23:21:20Z, produced NOTHING at T+27.  PROVISIONAL.
// Fixes shipped inside that window: the editor-handoff liveness rewrite (08-22), then
// `--scheduler-lastrun` / UNKNOWN / exit 3 / the `brief-editor-selfheal` naming split (08-23).
// **ALL OF THEM ARE DETECTION. NONE OF THEM REACHED THE EDITOR.** The detection layer now works
// perfectly and there is still no v2. Downstream, `brief-light`, `brief-email` and `brief-morning`
// all consume v2 and all fall back to v1.5 with NO HARD STOP, so the v1.5→v2 TRANSMISSION GATE —
// the strongest anti-regression check in the system — has not been able to run for three nights and
// **the reader has received an unedited brief since Thursday**.
//
// WHY A NEW MODE AND NOT A LOUDER `--can-self-heal`: every existing mode answers a question asked
// AT 23:40 BY THE CRITIC, in the middle of the night, about whether it may touch the artifact. None
// of them is ever asked the next morning, and none of them is asked by anyone whose job is to raise
// an alarm. So a non-producing Editor was found four nights running by the Critic noticing its own
// input was missing — a discovery that happens at 23:48 at the earliest and, on 08-21, only
// incidentally. This mode asks the ONE question nobody owned: **did the Editor produce anything at
// all last night?** It is designed for `pipeline-health-check` at 11:06, by which time the evening
// chain has closed and silence is a fact rather than a delay.
//
// IT INVENTS NO MACHINERY. The verdict is `schedulerLiveness()`'s state, one branch each, because
// that function already encodes exactly this question's evidence model:
//   UNKNOWN            → exit 3. No reading ⇒ refuse to answer. NOT a clean bill of health.
//   NEVER-FIRED        → exit 0, and say so: a slot that did not fire is `pipeline-slot-attendance`'s
//                        alarm (IMP-207), not this one. Two alarms for one fact teach the reader to
//                        skim both. This is the real 2026-08-21.
//   FIRED-AND-SILENT   → exit 0. INSIDE the 16–38 min band is IN FLIGHT, not dead. A gate that reds
//                        at minute 20 recreates the false-permit class from the opposite side.
//   FIRED-AND-OBSERVED → exit 0. It left a trace; the artifact guards (`--liveness`,
//                        `--audit-promotion`, `--finalize`, `--audit`) own every one of those shapes.
//   FIRED-PAST-BAND    → exit 1. **FIRED, PAST THE BAND, ZERO TRACE. THIS IS THE ALARM.**
//
// NOTE THE ONE DELIBERATE NARROWING: `traced` also counts `{date}-editor-log.md`, so an Editor that
// wrote a log and no v2 is FIRED-AND-OBSERVED and this mode stays silent. That is production without
// promotion — a different failure, already owned by `--audit-promotion` and `--finalize`. This mode
// is the NON-PRODUCTION alarm: nothing, anywhere, at all.
export interface NonProductionAudit {
  fired: boolean;
  exitCode: number;
  sched: SchedulerLiveness;
  live: Liveness;
  violations: Violation[];
  verdict: 'NON-PRODUCTION' | 'PRODUCED' | 'IN-FLIGHT' | 'NOT-FIRED' | 'UNKNOWN';
}
export function auditNonProduction(
  root: string,
  date: string,
  opts: { reading?: SchedulerReading | null; now?: Date } = {}
): NonProductionAudit {
  const now = opts.now ?? new Date();
  const sched = schedulerLiveness(root, date, opts.reading ?? null, now);
  const live = liveness(root, date, now);
  const base = { sched, live };

  if (sched.state === 'UNKNOWN')
    return {
      ...base,
      fired: false,
      verdict: 'UNKNOWN',
      exitCode: SELF_HEAL_UNKNOWN_EXIT,
      violations: [],
    };
  if (sched.state === 'NEVER-FIRED')
    return {
      ...base,
      fired: false,
      verdict: 'NOT-FIRED',
      exitCode: 0,
      violations: [],
    };
  if (sched.state === 'FIRED-AND-SILENT')
    return {
      ...base,
      fired: false,
      verdict: 'IN-FLIGHT',
      exitCode: 0,
      violations: [],
    };
  if (sched.state === 'FIRED-AND-OBSERVED')
    return {
      ...base,
      fired: false,
      verdict: 'PRODUCED',
      exitCode: 0,
      violations: [],
    };

  return {
    ...base,
    fired: true,
    verdict: 'NON-PRODUCTION',
    exitCode: 1,
    violations: [
      {
        check: 'editor-nonproduction',
        message: `🔴 THE EDITOR PRODUCED NOTHING. brief-editor FIRED at ${sched.reading!.lastRunAt!.toISOString()} and it is now T+${sched.elapsedMin!.toFixed(0)} min — past the ${EDITOR_FIRE_BAND_MAX_MIN}-min fired-and-silent band — with NO ${date}-v2.md, NO ${date}-v2.working.md, NO ${date}-editor-log.md and NO brief-editor line on ${date}-pipeline-status.md. The process ran and left the pipeline exactly as it found it. CONSEQUENCE, and it is the reader's, not the pipeline's: brief-light, brief-email and brief-morning all consume v2 and all fall back to v1.5 WITHOUT A HARD STOP, so the v1.5→v2 TRANSMISSION GATE cannot run and the brief that shipped was never edited. Receipt: this is the fourth consecutive night of E-PIPELINE-EDITOR-NONPRODUCTION-01 (08-21 never fired · 08-22 fired 23:20:14Z · 08-23 fired 23:20:17Z · 08-24 fired 23:21:20Z), and every fix shipped against it so far has been DETECTION. ACTION: this is 🔴 for the health report — name it and SEND THE ALARM EMAIL. Do NOT block the brief on it (Constitution I: the brief always ships; by 11:06 it already has).`,
      },
    ],
  };
}

// ── IMP-121 (2026-08-03 Critic mandate #2, 🔴, RC3): QG LIVENESS ─────────────────────────────
// E-QG-RACE-GUARD-MISCALIBRATION-01, Day 1. This file already encodes the correct primitive ONE
// STAGE DOWNSTREAM — liveness is the artifact's mtime, never a countdown — and the QG had no
// equivalent protection. RECEIPT, from the 08-03 status board and the Editor's own log:
//   brief-quality-gate CANARY 2026-08-02T22:42:31Z · real v1.5 written 00:08:17Z · SUCCESS 00:12:33Z
//   → a NINETY-MINUTE run.
// The Editor's guard used a 21-minute ceiling and a 45-minute slot window, computed EXPIRED at
// 23:57Z, and seeded a passthrough v1.5 byte-identical to v1 (md5 8283cf41b04e6224060178fc9f364324).
// Its own log: "THE RACE GUARD WAS WRONG AND I REPORT IT AGAINST MYSELF… Nothing in the guard covers
// 'the QG is slow but alive'… the guard told me to overwrite its work." Had it not noticed mid-pass
// and voluntarily rebased, v2 would have shipped without the QG's truth correction, its Inner Game
// re-cut and four staleness rewrites. `brief-email` died on the IDENTICAL misreading at 23:57:32Z
// and, unlike the Editor, never recovered — no email shipped for 08-03.
//
// A slow QG is not a crashed QG, exactly as a slow Editor is not a crashed Editor.
/** The QG's artifacts. ANY of them moving is proof of life; it writes the pre-gate copy first,
 *  the log throughout, and v1.5 last — which is why a v1.5-only liveness test sees nothing for
 *  most of the run. */
const QG_ARTIFACTS = (date: string) => [
  `${date}-v1.5.md`,
  `${date}-quality-gate-log.md`,
  `${date}-v1-pre-quality-gate.md`,
];
/** Same 20-minute silence-is-death rule as the Editor: below this, the QG is still writing. */
export const QG_QUIET_MIN = 20;
/** Nothing on disk at all this long after the QG CANARY ⇒ it died before writing.
 *  EVIDENCED, NOT CHOSEN — from the observed QG runtime distribution on the real status boards:
 *    2026-08-01 17.0 min · 2026-08-02 18.5 min · 2026-08-03 90.0 min   (max 90.0)
 *  The sample is THIN (n=3 — the QG canary discipline is new), which argues for MORE headroom over
 *  the max, not less: 105 = observed max + 15. The `--selftest` re-derives the distribution from
 *  the real trailing status boards and FAILS if this constant ever falls to or below the observed
 *  max, so the number cannot quietly go stale the way the Editor's 21/45 did. */
export const QG_NO_ARTIFACT_WAIT_MIN = 105;

function qgLines(root: string, date: string): EditorLine[] {
  const out: EditorLine[] = [];
  for (const raw of statusLines(root, date)) {
    if (!ownedBy(raw, /^(brief-)?quality-gate$/i)) continue;
    const tsm = raw.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2}))/
    );
    // The board carries BOTH `…Z` and `…-0400` (no colon) forms; Date parses only the latter with
    // a colon. Normalising here is why the runtime distribution above is 90 min and not 75.
    let ts: Date | null = null;
    if (tsm) {
      let s = tsm[1];
      if (/[+-]\d{4}$/.test(s)) s = `${s.slice(0, -2)}:${s.slice(-2)}`;
      const d = new Date(s);
      ts = isNaN(d.getTime()) ? null : d;
    }
    const fields = raw.split('|').map(f => f.trim());
    const has = (re: RegExp) => fields.some(f => re.test(f));
    const kind: EditorLine['kind'] = has(/^SUCCESS$/i)
      ? 'SUCCESS'
      : has(/^FAIL/i)
        ? 'FAIL'
        : has(/^SKIPPED/i)
          ? 'SUCCESS'
          : has(/^CANARY\b/i)
            ? 'CANARY'
            : 'OTHER';
    out.push({ ts, kind, raw: raw.trim() });
  }
  return out;
}

/** THE LOAD-BEARING FUNCTION, one stage upstream. exit 1 = ALIVE = do not inline-QG, do not seed
 *  a passthrough v1.5. Mirrors `liveness()` deliberately: same primitive, same failure it prevents. */
export function qgLiveness(
  root: string,
  date: string,
  now = new Date()
): Liveness {
  const lines = qgLines(root, date);
  const canary = lines.find(l => l.kind === 'CANARY');
  const terminal = lines.find(l => l.kind === 'SUCCESS' || l.kind === 'FAIL');
  const canaryAgeMin = canary?.ts
    ? (now.getTime() - canary.ts.getTime()) / 60000
    : null;
  const paths = QG_ARTIFACTS(date).map(f => path.join(DB(root), f));
  const present = paths.filter(p => fs.existsSync(p));
  const freshestMin = present.length
    ? Math.min(
        ...present.map(p => (now.getTime() - fs.statSync(p).mtimeMs) / 60000)
      )
    : null;
  const label = present.length ? path.basename(present[0]!) : `${date}-v1.5.md`;

  // A terminal line ENDS the question — the QG announced it is done. QUIET, whatever the mtimes say.
  if (terminal) {
    return {
      state: 'QUIET',
      quietMin: freshestMin,
      canaryAgeMin,
      workingPath: label,
      reason: `brief-quality-gate posted a ${terminal.kind} line for ${date} — the QG has finished`,
    };
  }
  if (!canary) {
    return {
      state: 'ABSENT',
      quietMin: freshestMin,
      canaryAgeMin,
      workingPath: label,
      reason: `no brief-quality-gate CANARY line on the ${date} board — the QG has not started`,
    };
  }
  // CANARY with no terminal line. Proof of life is an ARTIFACT THAT MOVED, never a countdown.
  if (freshestMin !== null && freshestMin < QG_QUIET_MIN) {
    return {
      state: 'ALIVE',
      quietMin: freshestMin,
      canaryAgeMin,
      workingPath: label,
      reason: `${label} was written ${freshestMin.toFixed(1)} min ago (< ${QG_QUIET_MIN}) — the QG is STILL RUNNING. Do NOT inline-QG and do NOT seed a passthrough v1.5.`,
    };
  }
  // Nothing on disk yet: the QG writes nothing for the first stretch of a long pass. Wait out the
  // budget derived from the observed distribution — this is the 08-03 branch exactly.
  if (
    freshestMin === null &&
    canaryAgeMin !== null &&
    canaryAgeMin < QG_NO_ARTIFACT_WAIT_MIN
  ) {
    return {
      state: 'ALIVE',
      quietMin: null,
      canaryAgeMin,
      workingPath: label,
      reason: `brief-quality-gate CANARY is ${canaryAgeMin.toFixed(0)} min old with no artifact yet (budget ${QG_NO_ARTIFACT_WAIT_MIN} min, observed runtimes reach 90) — a SLOW QG IS NOT A CRASHED QG. Do NOT seed a passthrough v1.5; this is the 2026-08-03 failure.`,
    };
  }
  return {
    state: 'QUIET',
    quietMin: freshestMin,
    canaryAgeMin,
    workingPath: label,
    reason:
      freshestMin !== null
        ? `no QG artifact has changed for ${freshestMin.toFixed(0)} min (≥ ${QG_QUIET_MIN}) and no terminal line — the QG has stopped`
        : `nothing on disk ${canaryAgeMin?.toFixed(0)} min after the CANARY (≥ ${QG_NO_ARTIFACT_WAIT_MIN}) — the QG died before writing`,
  };
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
    try {
      if (fs.statSync(v2).mtimeMs < fs.statSync(v15).mtimeMs) return false;
    } catch {
      /* stat race — treat as complete */
    }
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
  const selfHealLine = raw.find(
    l => /self-heal/i.test(l) && !/supersede/i.test(l)
  );
  const editorRan = lines.some(
    l => l.kind === 'CANARY' || l.kind === 'SUCCESS'
  );
  const editorSuccess = lines.find(l => l.kind === 'SUCCESS');

  if (selfHealLine && editorRan) {
    v.push({
      check: 'self-heal-over-live-editor',
      message: `A SELF-HEAL fired for ${date} on a night the Editor RAN (brief-editor ${editorSuccess ? 'SUCCESS' : 'CANARY'} line on the board). The self-heal artifact — a copy of v1.5 that never went through the Editor's checks — is what got graded${editorSuccess ? ", and the Editor's own v2 landed afterwards" : ''}. Run --can-self-heal BEFORE self-healing; a CANARY means ALIVE.`,
    });
  }

  // 07-14: not a self-heal — a PREMATURE PROMOTION. The Critic promoted the Editor's own scratch
  // file mid-pass, and the Editor's real SUCCESS superseded it ~10 minutes later. Fingerprint:
  // a CRITIC-PROMOTED / budget-expired promotion line AND a later editor line that supersedes it.
  const promoted = raw.find(
    l =>
      /brief-editor/i.test(l) &&
      /critic-promoted|budget expired|promoted by critic/i.test(l)
  );
  const superseding = raw.find(
    l =>
      /brief-editor/i.test(l) &&
      /supersedes (the )?critic|supersedes critic emergency|editor pass completed/i.test(
        l
      )
  );
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

/**
 * PROMOTION AUDIT — the invariant, not the shape (IMP-155, 2026-08-10 Critic mandate #3, RC2/RC5).
 *
 * `Brief_Editor.md` rule 6 states one thing: THE WORKING FILE MUST NOT EXIST AFTER PROMOTION.
 * Two fixes were built against it in three nights and both were built against the SHAPE they were
 * shown rather than the RULE, so both are silent tonight:
 *
 *   IMP-141 (08-08) saw an EMPTY husk           → built MIN_PLAUSIBLE_BRIEF_BYTES, a 4,000 B floor.
 *   IMP-149 (08-09) saw a BYTE-IDENTICAL copy   → built an identity test, "identity, not similarity".
 *   08-10 shipped a 56,562 B MID-PASS SNAPSHOT  → clears the floor, fails identity. Both blind.
 *
 * Measured on disk this session, five consecutive nights, five different shapes:
 *   08-06 294 B · 08-07 0 B · 08-08 0 B · 08-09 37,973 B (identical to v2) · 08-10 56,562 B (neither).
 *
 * The lesson is the one 08-09 mandate #1 named and the very next fix then committed: ACCEPTANCE ON
 * THE TRAINING SET. So this check tests EXISTENCE and nothing else. Size, contents and similarity
 * are reported as a DIAGNOSIS (ORPHANED-SCRATCH when byte-identical to v2, STALE-SCRATCH when not)
 * but they never decide the verdict — there is no sixth shape that can slip past an existence test.
 *
 * Scope is deliberately narrow: it fires only ONCE v2 EXISTS, i.e. after promotion. A working file
 * beside no v2 is a live Editor mid-pass, which `--liveness` correctly reads as ALIVE and which this
 * must never touch. A promotion audit that fires during a live Editor run is a regression wearing
 * an improvement's name.
 */
/**
 * 🔴 THE READER-FACING BODY — WHAT THE BRIEF ACTUALLY IS (IMP-222, 08-25 Critic mandate #3a, RC5).
 *
 * Gate 0.5's invariant is not "the files differ", it is "editorial work has been done", and on
 * 2026-08-25 those came apart. The Editor staged its working file as v1.5's BODY with the comment
 * blocks stripped — 80,496 B of v1.5 became a 40,546 B stage — so every reader-facing byte was
 * v1.5's, ZERO editorial work existed, and the byte-identity test read DIVERGED. Past the 45-minute
 * floor `--can-promote` would have shipped an unedited v1.5 as v2: the exact harm Gate 0.5 was
 * written one day earlier to prevent, produced by Gate 0.5's own implementation.
 *
 * IMP-155's lesson, one layer up: there is no byte-comparison that beats a content check. Compare
 * only what the reader gets — everything above the first `<!-- ====` fence, all HTML comments
 * stripped, whitespace normalised, so a trailing newline is not editorial work either.
 */
export function readerBody(text: string): string {
  const fence = text.indexOf('<!-- ====');
  const head = fence >= 0 ? text.slice(0, fence) : text;
  return head.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

function readerBodyOf(file: string): string | null {
  try {
    return readerBody(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 🔴 THE WORKLIST BLOCKS — the ones a MACHINE reads, not every comment (IMP-222, mandate #3d).
 *
 * The mandate asked for "a promoted v2 that carries fewer `<!--` blocks than its v1.5". Measured
 * across the whole archive first, that rule fires on ~70 nights and is silent on four: the Editor
 * routinely and legitimately retires blocks it has consumed. A gate that reds on the normal case is
 * the false-alarm class this file has refused four times, and mis-specifying the invariant from the
 * night that produced it is the acceptance-on-the-training-set error the same mandate warns about.
 *
 * The INVARIANT is narrower and it is the one the mandate's own receipt names: the Editor may edit
 * the brief; it may not silently discard THE NEXT STAGE'S INSTRUCTIONS. So the protected set is
 * derived, not chosen — a block is protected exactly when a script downstream parses it, and each
 * entry carries the consumer that makes it load-bearing. The selftest asserts every consumer still
 * reads its block, so this list cannot rot into decoration.
 */
export const PROTECTED_BLOCKS: { name: string; consumer: string }[] = [
  { name: 'WRITER DECLARATIONS', consumer: 'scripts/declaration-binding-gate.ts' },
  { name: 'VALIDATION REPORT', consumer: 'scripts/declaration-binding-gate.ts' },
  { name: 'STALENESS LEDGER', consumer: 'scripts/validate-brief.ts' },
  { name: 'COUNTER-CASE', consumer: 'scripts/validate-brief.ts' },
  { name: 'take-move', consumer: 'scripts/validate-brief.ts' },
  { name: 'MODEL-LOCKED', consumer: 'scripts/validate-brief.ts' },
];

/** Protected blocks present in v1.5 and fewer (or absent) in v2. Names only — the verdict is count. */
export function droppedProtectedBlocks(v15Text: string, v2Text: string): string[] {
  const count = (text: string, name: string) =>
    (text.match(new RegExp('<!--\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
  return PROTECTED_BLOCKS.filter(b => count(v2Text, b.name) < count(v15Text, b.name)).map(b => b.name);
}

/**
 * Both editorial-work legs bind FORWARD from the night they were written, never backward — IMP-125,
 * and the archive is why: 70 of ~100 nights drop a block, and no v2 before 2026-08-26 is
 * reader-body-identical to its v1.5. Condemning the archive would produce a storm on the day the
 * gate shipped and teach the next session to skim it.
 */
export const EDITORIAL_WORK_EFFECTIVE_FROM = '2026-08-26';

/** Honest unedited-promotion stamp (ESC-020 Stage 2). Must NOT match `self-heal-critic` or `SELF-HEAL`. */
export const SELFHEAL_STAMP_RE = /\bSELFHEAL\b/;

export function hasHonestSelfhealStamp(logText: string): boolean {
  return SELFHEAL_STAMP_RE.test(logText);
}

export function fileMd5(p: string): string | null {
  try {
    return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * ESC-020 Stage 3 — UNEDITED-PROMOTION as a dated canary, not a ledger `run:` leg.
 * IMP-222's same-named check inside `--audit-promotion` binds FORWARD from 2026-08-26, so it is
 * silent on the rubber-stamp night the health report named. This mode takes an explicit DATE and
 * answers only: did this night ship v1.5's brief under a v2 label without the honest SELFHEAL stamp?
 *
 * Identity is file-md5 OR reader-body. File-md5 is the handoff's stated condition (08-26 is
 * 70,983 B both, digest 2473b3d3). Reader-body catches the 08-25-claimed *shape* (comment-stripped
 * twin) without treating a trailing newline as editorial work. 2026-08-25 on disk is NEITHER —
 * v1.5 80,591 B vs v2 41,340 B, and the reader bodies diverge (Dashboard 4.7 vs 4.70). The stamp
 * said "byte-identical"; md5 disproved the stamp. The night that matches the stated condition is
 * 2026-08-26. Forcing a fire on 08-25 would make the detector a log-narrative check, which this
 * file has refused four times.
 */
export function uneditedPromotion(root: string, date: string): Violation[] {
  const v15 = path.join(DB(root), `${date}-v1.5.md`);
  const v2 = path.join(DB(root), `${date}-v2.md`);
  const logPath = path.join(DB(root), `${date}-editor-log.md`);
  if (!fs.existsSync(v15) || !fs.existsSync(v2)) return [];

  const md5a = fileMd5(v15);
  const md5b = fileMd5(v2);
  const md5Equal = md5a !== null && md5b !== null && md5a === md5b;
  const bodyA = readerBodyOf(v15);
  const bodyB = readerBodyOf(v2);
  const bodyEqual = bodyA !== null && bodyB !== null && bodyA === bodyB;
  if (!md5Equal && !bodyEqual) return [];

  let logText = '';
  let logPresent = false;
  try {
    logText = fs.readFileSync(logPath, 'utf8');
    logPresent = true;
  } catch {
    logPresent = false;
  }
  if (logPresent && hasHonestSelfhealStamp(logText)) return [];

  const how = md5Equal ? 'byte-identical (md5)' : 'reader-body-identical';
  const logState = logPresent
    ? 'editor log does not contain SELFHEAL (the honest unedited-promotion stamp)'
    : 'editor log is ABSENT';
  return [
    {
      check: 'UNEDITED-PROMOTION',
      message:
        `RED: UNEDITED-PROMOTION — ${date}: ${date}-v2.md is ${how} to ${date}-v1.5.md and ${logState}. ` +
        `Same brief, edited label. ESC-020 ruling: selfheal may ship v1.5's bytes but must stamp them ` +
        `v2-SELFHEAL (unedited promotion). Inherited gate exits are fabricated provenance.`,
    },
  ];
}

export function auditPromotion(root: string, date: string): Violation[] {
  const v2 = path.join(DB(root), `${date}-v2.md`);
  const working = path.join(DB(root), `${date}-v2.working.md`);
  if (!fs.existsSync(v2)) return []; // not promoted yet — --liveness owns this window, not us

  const out: Violation[] = [];

  // ── IMP-164 (2026-08-12 Critic mandate #2(c), RC1+RC3): MISSING-EDITOR-LOG ──────────────────
  // On 2026-08-12 the Editor did the work — Gate 16 cut a unit, the truth file was written, the
  // body landed at exactly 5,489 words — and then evaporated: no editor log, no SUCCESS line,
  // CANARY only. The absence of the log was detected by NOTHING; the Critic found it with `ls`.
  // A Critic arriving at 23:31Z cannot distinguish "finished" from "died mid-pass" without it, and
  // 07-13/07-14 are what happens when that distinction is guessed.
  //
  // THE MANDATE ROUTED THIS TO gate-sweep.ts. It is wired HERE instead, deliberately: gate-sweep
  // answers exactly one question — which gates does no stage call — and its orphan count is only
  // comparable across days because it answers nothing else. A nightly-artifact assertion inside an
  // orphan detector is two classes in one number. This gate already owns "what must be true once
  // v2 is promoted", the Critic already runs it (`--audit-promotion` is in the 08-12 critic's
  // receipts), and it costs no new surface. Same detection, correct layer.
  //
  // 🔴 NO RETROACTIVE CONDEMNATION OF THE ARCHIVE (IMP-125's lesson, and this leg tripped it within
  // minutes of being written: it red-failed the IMP-155 leg that asserts silence on 115 real nights).
  // The rule binds from the day it ships FORWARD. Measured on disk 2026-08-12: 08-06 through 08-11
  // ALL carry an editor log — so the mandate's own claim that "three additionally carry no editor
  // log" is wrong, and 2026-08-12 is the ONLY night in the window with a promoted v2 and no log.
  const EDITOR_LOG_EFFECTIVE_FROM = '2026-08-12';
  const log = path.join(DB(root), `${date}-editor-log.md`);
  const logBytes = fs.existsSync(log) ? fs.statSync(log).size : -1;
  if (date >= EDITOR_LOG_EFFECTIVE_FROM && logBytes <= 0) {
    out.push({
      check: 'MISSING-EDITOR-LOG',
      message:
        `PROMOTION AUDIT FAILED — ${date}-v2.md is promoted but ${date}-editor-log.md is ` +
        `${logBytes < 0 ? 'NOT ON DISK' : 'EMPTY (0 bytes)'}. The Editor shipped a brief and left no record that it ran. ` +
        `A stage without a receipt cannot be told apart from a stage that died mid-pass, and the recovery for those two ` +
        `is opposite. FIX: run \`editor-handoff-gate.ts --finalize ${date}\` as the LAST action of the Editor pass — it ` +
        `retires the working file, asserts this log, and prints the block the status line requires. ` +
        `An Editor that cannot run --finalize writes FAIL, not silence.`,
    });
  }

  // ── IMP-222 (08-25 Critic mandate #3a/#3d, RC5): WAS ANY EDITORIAL WORK DONE AT ALL? ─────────
  // The 08-25 mandate predicted this and the 2026-08-26 brief is it: v2.md landed byte-identical to
  // v1.5.md (70,983 B both), was stamped v2, and every downstream stage consumed it as an edited
  // brief. The v1.5→v2 transmission gate passes such a file perfectly, because v2 carries every
  // v1.5 replacement — which is why the check has to be for WORK, not for correctness.
  if (date >= EDITORIAL_WORK_EFFECTIVE_FROM) {
    const v15 = path.join(DB(root), `${date}-v1.5.md`);
    const bodyV15 = readerBodyOf(v15);
    const bodyV2 = readerBodyOf(v2);
    if (bodyV15 !== null && bodyV2 !== null) {
      if (bodyV15 === bodyV2) {
        out.push({
          check: 'UNEDITED-PROMOTION',
          message:
            `PROMOTION AUDIT FAILED — ${date}-v2.md is READER-BODY-IDENTICAL to ${date}-v1.5.md. ` +
            `A v2 was promoted and ZERO editorial work reached the reader; the comment blocks may differ, ` +
            `the brief does not. This is not "a light edit night" — it is character-for-character the same ` +
            `document, and every downstream stage (brief-light, brief-email, brief-morning) consumed it as ` +
            `an edited brief. FIX: the Editor must actually edit, or write FAIL and let the downstream ` +
            `stages label the fallback \`INPUT: v1.5 — NO EDITOR PASS\`. Shipping nothing is honest; ` +
            `shipping v1.5 stamped v2 is not.`,
        });
      }
      const dropped = droppedProtectedBlocks(
        fs.readFileSync(v15, 'utf8'),
        fs.readFileSync(v2, 'utf8')
      );
      if (dropped.length) {
        out.push({
          check: 'DROPPED-WORKLIST-BLOCK',
          message:
            `PROMOTION AUDIT FAILED — ${date}-v2.md dropped ${dropped.length} block(s) that a downstream ` +
            `stage PARSES: ${dropped.join(', ')}. On 2026-08-25 a comment-stripping stage deleted v1.5's ` +
            `WRITER DECLARATIONS and VALIDATION REPORT — the Morning Truth Gate's worklist of eight open ` +
            `items and five unverified load-bearing superlatives — out of the file the morning gate reads, ` +
            `and the worklist counts went 1→0 and 2→0. The Editor may edit the brief; it may not silently ` +
            `discard the next stage's instructions. FIX: carry the block forward, or resolve it and say so ` +
            `in ${date}-editor-log.md.`,
        });
      }
    }
  }

  if (!fs.existsSync(working)) return out; // rule 6 satisfied: the scratch file is gone

  let bytes = -1;
  let identical = false;
  try {
    bytes = fs.statSync(working).size;
    identical =
      bytes === fs.statSync(v2).size &&
      fs.readFileSync(working).equals(fs.readFileSync(v2));
  } catch {
    /* stat/read race — existence already decided the verdict */
  }
  out.push(
    {
      check: identical ? 'ORPHANED-SCRATCH' : 'STALE-SCRATCH',
      message:
        `PROMOTION AUDIT FAILED — ${date}-v2.working.md STILL EXISTS beside a promoted ${date}-v2.md ` +
        `(${bytes} byte(s), ${identical ? 'byte-identical to v2' : 'NOT identical to v2'}). ` +
        `Brief_Editor rule 6 requires DELETION on promotion; the size and the contents are a diagnosis, ` +
        `not the verdict — ${identical ? 'ORPHANED-SCRATCH: the promotion copied instead of moving, so the husk is a leftover' : 'STALE-SCRATCH: a mid-pass snapshot survived, so a later reader can grade a document that never shipped'}. ` +
        `FIX: delete it and write the WORKING FILE DELETED receipt to ${date}-editor-log.md. ` +
        `Do not add a size or similarity condition to this check — that is exactly how IMP-141 and IMP-149 ` +
        `each went blind on the next night's shape.`,
    }
  );
  return out;
}

/**
 * --finalize {DATE} — THE RECEIPT IS PRODUCED BY THE MACHINE, NOT REMEMBERED BY THE STAGE.
 * (IMP-164, 2026-08-12 Critic mandate #2(a)+(b), RC1+RC3. Also carries mandate #1's cut-order
 *  enforcement — see the LENGTH-OVERRIDE leg below.)
 *
 * Seven consecutive nights of ORPHANED-SCRATCH, three of them with no editor log at all, is not a
 * stage that forgets. It is a rule with no hands. `rule 6 says delete the working file` has been
 * true and unobserved since 08-06. So: one idempotent command that DOES the deletion, ASSERTS the
 * artifacts, and PRINTS the block the Editor is required to paste. The Editor cannot comply by
 * remembering; it complies by running one thing, and if it cannot run it, it writes FAIL.
 *
 * 🔴 THE DELETE GATE. `fs.unlink` returns EPERM on this mount — proved live 2026-08-12
 * (`rm daily-briefs/.probe-del-test` → "Operation not permitted"), the same gate that blocks
 * `rm .git/index.lock` (ESC-010/ESC-012). RENAME SUCCEEDS WHERE UNLINK IS BLOCKED, so finalize
 * retires the husk to `{date}-v2.working.md.retired-{ts}` when unlink fails. That satisfies the
 * property the rule is actually about — no file named `*-v2.working.md` beside a promoted v2, so
 * no later reader can grade a document that never shipped — without pretending a delete happened.
 * Retired husks are visible on disk on purpose; they are evidence, not litter.
 */
export function finalize(root: string, date: string): { code: number; lines: string[] } {
  const lines: string[] = [];
  const db = DB(root);
  const v2 = path.join(db, `${date}-v2.md`);
  const working = path.join(db, `${date}-v2.working.md`);
  const log = path.join(db, `${date}-editor-log.md`);

  // 1. v2 must exist and be a plausible brief. Finalizing an absent or husk v2 would write a
  //    receipt for a pass that did not happen — the exact laundering this file exists to prevent.
  if (!fs.existsSync(v2)) {
    lines.push(`   ✗ NO-V2 — ${date}-v2.md is not on disk. There is nothing to finalize. If the Editor is still running, this is correct: wait. If it died, use --can-self-heal.`);
    return { code: 1, lines };
  }
  const v2Bytes = fs.statSync(v2).size;
  if (v2Bytes < MIN_PLAUSIBLE_BRIEF_BYTES) {
    lines.push(`   ✗ HUSK-V2 — ${date}-v2.md is ${v2Bytes} bytes, under the ${MIN_PLAUSIBLE_BRIEF_BYTES}-byte plausibility floor. Do not finalize a husk.`);
    return { code: 1, lines };
  }
  lines.push(`   ✓ v2 present — ${date}-v2.md, ${v2Bytes} bytes`);

  // 2. Retire the working file. Idempotent: absent is success, not an error.
  if (fs.existsSync(working)) {
    const wb = fs.statSync(working).size;
    try {
      fs.unlinkSync(working);
      lines.push(`   ✓ WORKING FILE DELETED — ${date}-v2.working.md (${wb} bytes) unlinked`);
    } catch {
      const retired = `${working}.retired-${Date.now()}`;
      try {
        fs.renameSync(working, retired);
        lines.push(`   ✓ WORKING FILE RETIRED — ${date}-v2.working.md (${wb} bytes) → ${path.basename(retired)} (unlink is EPERM on this mount; rename is not)`);
      } catch (e: any) {
        lines.push(`   ✗ CANNOT-RETIRE-WORKING — neither unlink nor rename succeeded on ${date}-v2.working.md: ${e?.message ?? e}`);
        return { code: 1, lines };
      }
    }
  } else {
    lines.push(`   ✓ no working file beside the promoted v2 (Brief_Editor rule 6 satisfied)`);
  }

  // 3. The editor log must exist and say something.
  const logBytes = fs.existsSync(log) ? fs.statSync(log).size : -1;
  if (logBytes <= 0) {
    lines.push(`   ✗ MISSING-EDITOR-LOG — ${date}-editor-log.md is ${logBytes < 0 ? 'NOT ON DISK' : 'EMPTY'}. Write the pass record (gates run, edits made, Gate 16 ledger) and re-run --finalize. This is the whole of mandate #2: a stage that ships without a receipt is indistinguishable from a stage that died.`);
    return { code: 1, lines };
  }
  lines.push(`   ✓ editor log present — ${date}-editor-log.md, ${logBytes} bytes`);

  // 4. THE CUT ORDER (2026-08-12 Critic mandate #1, RC4). A night that ends with a majority of Six
  //    units past their hard ceiling ended with compressible words on the table. If the Editor
  //    also took a whole-unit cut, it traded a verified story for fat it never spent. Finalize
  //    refuses to close that night without an explicit LENGTH-OVERRIDE showing the arithmetic.
  const breach = sixUnitHardBreach(fs.readFileSync(v2, 'utf8'));
  if (breach.breach) {
    const logSrc = fs.readFileSync(log, 'utf8');
    if (!/LENGTH-OVERRIDE/.test(logSrc)) {
      lines.push(
        `   ✗ SIX-UNIT-HARD-BREACH — ${breach.over} of ${breach.units} core Six units are over their HARD ceiling ` +
          `(${breach.distribution}); Σ(unit − hard) = ${breach.surplus} words were recoverable BY COMPRESSION.\n` +
          `     Gate 16 cut order: exhaust the per-unit surplus BEFORE any whole-unit cut. To close the night anyway, ` +
          `write \`LENGTH-OVERRIDE:\` into ${date}-editor-log.md with the arithmetic — words needed vs ${breach.surplus} available — and re-run.\n` +
          `     RECEIPT: 2026-08-12 had 280 recoverable words and deleted a 194-word verified unit instead.`
      );
      return { code: 1, lines };
    }
    lines.push(`   ✓ LENGTH-OVERRIDE declared in the editor log against a ${breach.over}/${breach.units} breach (${breach.surplus} words recoverable) — the trade is on the record`);
  } else {
    lines.push(`   ✓ six-unit-hard-breach clear — ${breach.over} of ${breach.units} core units over hard (${breach.distribution})`);
  }

  lines.push('');
  lines.push('   PASTE THIS BLOCK INTO THE EDITOR LOG AND THE STATUS LINE:');
  lines.push(`   MECHANICAL GATE OUTPUT — editor-handoff-gate --finalize ${date} EXIT=0`);
  lines.push(`     v2 ${v2Bytes} B · working file retired · editor-log ${logBytes} B · six-unit-hard-breach ${breach.over}/${breach.units} over, ${breach.surplus} recoverable${breach.breach ? ' (LENGTH-OVERRIDE declared)' : ''}`);
  return { code: 0, lines };
}

// ---------- selftest ----------

/** Build a throwaway pipeline dir with REAL mtimes — the only honest way to test a liveness rule. */
/** IMP-141: a plausible brief body. The old fixture wrote 10 bytes, which the new emptiness floor
 *  would classify ABSENT — every liveness assertion in this file would have "passed" for the wrong
 *  reason. A guard whose own fixtures trip it teaches nothing. */
const PLAUSIBLE_BODY = `# Daily Update — fixture\n\n## Markets & Macro\n\n${'- **A bullet with a hook.** Body sentence carrying a number, 4.1 percent, and a source.\n'.repeat(60)}`;

function fixture(
  name: string,
  opts: {
    canaryMinAgo: number;
    workingQuietMin: number | null;
    hold?: string;
    workingBody?: string;
  }
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ehg-${name}-`));
  fs.mkdirSync(path.join(root, 'daily-briefs'), { recursive: true });
  const date = '2026-01-01';
  const now = Date.now();
  const canaryTs = new Date(now - opts.canaryMinAgo * 60000)
    .toISOString()
    .replace(/\.\d+Z$/, 'Z');
  fs.writeFileSync(
    path.join(root, 'daily-briefs', `${date}-pipeline-status.md`),
    `${canaryTs} | brief-editor | CANARY | WRITE-OK\n`
  );
  if (opts.workingQuietMin !== null) {
    const w = path.join(root, 'daily-briefs', `${date}-v2.working.md`);
    fs.writeFileSync(w, opts.workingBody ?? PLAUSIBLE_BODY);
    const t = new Date(now - opts.workingQuietMin * 60000);
    fs.utimesSync(w, t, t);
  }
  if (opts.hold) {
    fs.writeFileSync(
      path.join(root, 'daily-briefs', `${date}-editor-log.md`),
      `EDITOR-HOLD: ${opts.hold}\n`
    );
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

  const ok14 = fire14.some(x => x.check === 'premature-promotion');
  const ok13 = fire13.some(x => x.check === 'self-heal-over-live-editor');
  const ok13Recon = fire13.some(x => x.check === 'critic-reconciliation-owed');
  const ok11 = fire11.some(x => x.check === 'self-heal-over-live-editor');
  const ok10 = silent10.length === 0;
  const ok12 = silent12.length === 0;

  // --- LIVENESS, on real mtimes.
  // (a) THE 07-14 CASE: 45 min into the run, the working file was written 30 seconds ago.
  //     The old gate promoted here. The new one must FORBID.
  const alive = fixture('alive', { canaryMinAgo: 46, workingQuietMin: 0.5 });
  const okAliveState = liveness(alive, D).state === 'ALIVE';
  const okAliveForbid = canPromote(alive, D).some(
    x => x.check === 'promote-over-live-editor'
  );
  const okAliveNoSelfHeal = canSelfHeal(alive, D).length > 0;

  // (b) A REAL CRASH: canary 50 min old, the file has not moved in 25 min. Promote — the brief ships.
  const dead = fixture('dead', { canaryMinAgo: 50, workingQuietMin: 25 });
  const okDeadState = liveness(dead, D).state === 'QUIET';
  const okDeadPromote = canPromote(dead, D).length === 0;

  // (c) QUIESCENCE IS NOT SUFFICIENT: quiet, but only 20 min into the pass. Hold the floor.
  const early = fixture('early', { canaryMinAgo: 20, workingQuietMin: 21 });
  const okEarly = canPromote(early, D).some(
    x => x.check === 'promote-inside-min-wait'
  );

  // (d) A HOLD IS A DECISION: quiet + past the floor, but the Editor declared a hold. Never promote.
  const held = fixture('held', {
    canaryMinAgo: 60,
    workingQuietMin: 30,
    hold: 'Inner Game :: quote unverifiable',
  });
  const okHeld = canPromote(held, D).some(
    x => x.check === 'promote-over-editor-hold'
  );

  // (e) NEVER DEADLOCK: past the hard ceiling, promotion is allowed even if the file is still moving.
  const ceiling = fixture('ceiling', {
    canaryMinAgo: HARD_CEILING_MIN + 5,
    workingQuietMin: 1,
  });
  const okCeiling = canPromote(ceiling, D).length === 0;

  // (f) A GENUINELY DEAD EDITOR (nothing on disk, past the wait) may still be self-healed.
  const okAllowed = canSelfHeal(root, '1999-01-01').length === 0;

  // (g) IMP-072 (E-PIPELINE-EDITOR-STATUS-01): the Editor completed by ARTIFACT but wrote no
  //     brief-editor line to the board (the 07-18 gap). auditHandoff must FLAG editor-status-unlogged;
  //     adding the SUCCESS line makes it silent.
  const unlogged = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-unlogged-'));
  fs.mkdirSync(path.join(unlogged, 'daily-briefs'), { recursive: true });
  const ud = '2026-01-02';
  const uStatus = path.join(
    unlogged,
    'daily-briefs',
    `${ud}-pipeline-status.md`
  );
  fs.writeFileSync(
    uStatus,
    'brief-draft | START\nbrief-quality-gate | SUCCESS\n'
  ); // NO brief-editor line
  fs.writeFileSync(
    path.join(unlogged, 'daily-briefs', `${ud}-editor-log.md`),
    '# editor log\nGate 1..15 all pass\n'
  );
  const uV15 = path.join(unlogged, 'daily-briefs', `${ud}-v1.5.md`);
  fs.writeFileSync(uV15, '# v1.5\n');
  const uV2 = path.join(unlogged, 'daily-briefs', `${ud}-v2.md`);
  fs.writeFileSync(uV2, '# v2\n');
  const uOld = new Date(Date.now() - 5 * 60000);
  fs.utimesSync(uV15, uOld, uOld); // v2 fresher than v1.5
  const okUnlogged = auditHandoff(unlogged, ud).some(
    x => x.check === 'editor-status-unlogged'
  );
  fs.appendFileSync(
    uStatus,
    '2026-01-02T20:00:00Z | brief-editor | SUCCESS | done\n'
  );
  const okLoggedSilent = !auditHandoff(unlogged, ud).some(
    x => x.check === 'editor-status-unlogged'
  );
  fs.rmSync(unlogged, { recursive: true, force: true });

  // --- IMP-121: QG LIVENESS. The acceptance gate is stated against the REAL 08-03 timestamps, so
  //     the fixture replays the REAL status lines verbatim and evaluates at the REAL decision moments.
  const qgRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-qg-'));
  fs.mkdirSync(path.join(qgRoot, 'daily-briefs'), { recursive: true });
  const QD = '2026-08-03';
  const qgStatus = path.join(
    qgRoot,
    'daily-briefs',
    `${QD}-pipeline-status.md`
  );
  // Verbatim from the real 08-03 board — including the `-0400` offset form that a naive parser drops.
  fs.writeFileSync(
    qgStatus,
    '2026-08-02T22:42:31Z | brief-quality-gate | CANARY | WRITE-OK\n'
  );
  const decisionMoment = new Date('2026-08-02T23:57:43Z'); // the instant the Editor computed EXPIRED
  const qgAtDecision = qgLiveness(qgRoot, QD, decisionMoment);
  // (a) THE FAILURE ITSELF: 75 min in, nothing on disk yet, no terminal line → ALIVE, exit 1.
  const okQgAlive = qgAtDecision.state === 'ALIVE';
  // (b) …and it becomes QUIET only once the QG posts its real SUCCESS line at 00:12:33Z.
  fs.appendFileSync(
    qgStatus,
    '2026-08-02T20:12:33-0400 | brief-quality-gate | daily-briefs/2026-08-03-v1.5.md | SUCCESS\n'
  );
  const okQgQuietAfter =
    qgLiveness(qgRoot, QD, new Date('2026-08-03T00:15:00Z')).state === 'QUIET';
  // (c) THE `-0400` FORM MUST PARSE. If it does not, the SUCCESS line is invisible and the guard
  //     stays ALIVE forever — the mirror-image deadlock. (This is the bug that made the observed
  //     runtime read 75 min instead of 90 during calibration.)
  const okQgOffsetParsed = qgLines(qgRoot, QD).some(
    l => l.kind === 'SUCCESS' && l.ts !== null
  );
  // (d) A REAL CRASH still ends the wait: past the budget with nothing on disk → QUIET, never a deadlock.
  const crashRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-qgcrash-'));
  fs.mkdirSync(path.join(crashRoot, 'daily-briefs'), { recursive: true });
  fs.writeFileSync(
    path.join(crashRoot, 'daily-briefs', `${QD}-pipeline-status.md`),
    `${new Date(Date.now() - (QG_NO_ARTIFACT_WAIT_MIN + 10) * 60000).toISOString().replace(/\.\d+Z$/, 'Z')} | brief-quality-gate | CANARY | WRITE-OK\n`
  );
  const okQgCrash = qgLiveness(crashRoot, QD).state === 'QUIET';
  // (e) SILENT on a night the QG finished BEFORE the Editor's canary — the real 08-01 board:
  //     QG CANARY 22:41:38Z, SUCCESS 22:58:40Z, brief-editor CANARY 23:09:44Z.
  const okQg0801 =
    qgLiveness(root, '2026-08-01', new Date('2026-07-31T23:09:44Z')).state ===
    'QUIET';
  const okQg0802 =
    qgLiveness(root, '2026-08-02', new Date('2026-08-01T23:09:43Z')).state ===
    'QUIET';
  // (f) THE CONSTANT IS EVIDENCED, NOT CHOSEN. Re-derive the QG runtime distribution from the REAL
  //     trailing status boards and fail if QG_NO_ARTIFACT_WAIT_MIN has fallen to or below the max.
  //     This is what the Editor's 21/45 lacked: a number that cannot quietly go stale.
  const runtimes: number[] = [];
  const dbDir = path.join(root, 'daily-briefs');
  if (fs.existsSync(dbDir)) {
    const boards = fs
      .readdirSync(dbDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f))
      .sort()
      .slice(-30);
    for (const b of boards) {
      const d = b.slice(0, 10);
      const ls = qgLines(root, d);
      const c = ls
        .filter(l => l.kind === 'CANARY' && l.ts)
        .map(l => l.ts!.getTime());
      const t = ls
        .filter(l => (l.kind === 'SUCCESS' || l.kind === 'FAIL') && l.ts)
        .map(l => l.ts!.getTime());
      if (c.length && t.length) {
        const mins = (Math.max(...t) - Math.min(...c)) / 60000;
        if (mins > 0) runtimes.push(mins);
      }
    }
  }
  const observedMax = runtimes.length ? Math.max(...runtimes) : 0;
  const okQgCalibrated = QG_NO_ARTIFACT_WAIT_MIN > observedMax;

  // --- IMP-184 (2026-08-17, RC2): THE SELECTOR IS A FIELD, NOT A SUBSTRING. Asserted against the
  //     REAL 08-17 board, which is the densest cross-narration night on record. Both directions:
  //     the foreign lines must be EXCLUDED, and the genuine ones must still be SELECTED.
  const board0817 = statusLines(root, '2026-08-17');
  const foreignQg = board0817.filter(
    l => /brief-quality-gate/i.test(l) && !ownedBy(l, /^(brief-)?quality-gate$/i)
  );
  const foreignEd = board0817.filter(
    l => /brief-editor/i.test(l) && !ownedBy(l, /^brief-editor$/i)
  );
  // (a) The contamination is REAL on this board — if these ever hit 0 the legs below prove nothing.
  const okContaminationReal = foreignQg.length >= 2 && foreignEd.length >= 2;
  // (b) NOT ONE foreign line survives the selector, by either name.
  const okNoForeignSelected =
    !qgLines(root, '2026-08-17').some(l => foreignQg.includes(l.raw)) &&
    !editorLines(root, '2026-08-17').some(l => foreignEd.includes(l.raw));
  // (c) A foreign SUCCESS line must never be read as a TERMINAL — this is the correctness leg, not
  //     the measurement one. brief-critic posted `| SUCCESS |` at 00:27:29Z while narrating both
  //     tasks; had that been read as the QG's terminal, qgLiveness would answer QUIET ("the QG has
  //     finished") and clear the Editor to overwrite a live QG's v1.5. The real QG terminal is
  //     00:09:14Z, so we assert the terminal is THAT line and not the critic's.
  const qgTerm = qgLines(root, '2026-08-17').find(
    l => l.kind === 'SUCCESS' || l.kind === 'FAIL'
  );
  const okTerminalIsTheQgs =
    !!qgTerm &&
    /2026-08-17T00:09:14Z/.test(qgTerm.raw) &&
    !/brief-critic/.test(lineTask(qgTerm.raw) ?? '');
  // (d) The MEASUREMENT leg: 08-17's QG ran 22:42:15Z → 00:09:14Z = 86.98 min. The contaminated
  //     selector reported 105.2 (the critic's 00:27:29Z line) and red-failed nine ledger rows.
  const qg0817 = qgLines(root, '2026-08-17');
  const c0817 = qg0817.filter(l => l.kind === 'CANARY' && l.ts).map(l => l.ts!.getTime());
  const t0817 = qg0817
    .filter(l => (l.kind === 'SUCCESS' || l.kind === 'FAIL') && l.ts)
    .map(l => l.ts!.getTime());
  const mins0817 =
    c0817.length && t0817.length
      ? (Math.max(...t0817) - Math.min(...c0817)) / 60000
      : -1;
  const okRuntime0817 = Math.abs(mins0817 - 86.98) < 0.05;
  // (e) A prose line owns no task at all — field 0 must BE a timestamp, not merely contain one.
  const okProseOwnsNoTask =
    lineTask('the brief-editor should defer to brief-quality-gate') === null &&
    lineTask('## brief-editor | SUCCESS | not a status line') === null &&
    lineTask('2026-08-17T00:09:14Z | brief-quality-gate | x | SUCCESS |') ===
      'brief-quality-gate';
  console.log(
    `  [IMP-121] observed QG runtimes (trailing 30 boards, n=${runtimes.length}): ${runtimes.map(m => m.toFixed(1)).join(' · ')} min → max ${observedMax.toFixed(1)}, budget ${QG_NO_ARTIFACT_WAIT_MIN}`
  );
  fs.rmSync(qgRoot, { recursive: true, force: true });
  fs.rmSync(crashRoot, { recursive: true, force: true });

  // --- IMP-141 (2026-08-08 Critic mandate #3, RC2): AN EMPTY WORKING FILE IS NOT A LIVE EDITOR.
  //     Leg (a) is asserted against the REAL artifact the Critic found on disk, not a fixture.
  const realEmpty = path.join(root, 'daily-briefs', '2026-08-08-v2.working.md');
  const realEmptyExists =
    fs.existsSync(realEmpty) &&
    fs.statSync(realEmpty).size < MIN_PLAUSIBLE_BRIEF_BYTES;
  //     Evaluated at the REAL decision moment the Critic quoted: 9.4 min after the file's mtime, the
  //     instant the old gate answered "ALIVE — the Editor is STILL WRITING IT".
  const realMoment = realEmptyExists
    ? new Date(fs.statSync(realEmpty).mtimeMs + 9.4 * 60000)
    : new Date();
  const okRealAbsent =
    realEmptyExists &&
    liveness(root, '2026-08-08', realMoment).state === 'ABSENT';
  //     …and --can-promote must refuse it WITH THE CEILING ACTIVE. The real 08-08 canary is hours
  //     old, so `forced` is already true against the live board — the strongest form of the test.
  const realPromo = realEmptyExists ? canPromote(root, '2026-08-08') : [];
  const okRealRefused = realPromo.some(
    x => x.check === 'promote-empty-artifact'
  );

  // (b) SYNTHETIC MINIMAL PAIR — same mtime, same canary, differing ONLY in content.
  const husk = fixture('husk', {
    canaryMinAgo: HARD_CEILING_MIN + 30,
    workingQuietMin: 0.5,
    workingBody: '',
  });
  const okHuskAbsent = liveness(husk, D).state === 'ABSENT';
  const okHuskRefusedPastCeiling = canPromote(husk, D).some(
    x => x.check === 'promote-empty-artifact'
  );
  const full = fixture('full', {
    canaryMinAgo: HARD_CEILING_MIN + 30,
    workingQuietMin: 0.5,
  });
  const okFullAlive = liveness(full, D).state === 'ALIVE';
  const okFullPromotable = canPromote(full, D).length === 0; // never-deadlock still works

  // (c) THE GUARD MUST NOT OPEN THE 07-13 HOLE. An empty file now reads ABSENT, which is the state
  //     that permits a self-heal — so prove the CANARY guard independently holds it shut while a
  //     just-started Editor could still be writing.
  const huskEarly = fixture('husk-early', {
    canaryMinAgo: 5,
    workingQuietMin: 0.2,
    workingBody: '',
  });
  const okHuskEarlyNoSelfHeal = canSelfHeal(huskEarly, D).some(
    x => x.check === 'self-heal-over-live-editor'
  );

  // (d) THE FLOOR IS CALIBRATED, NOT CHOSEN (the IMP-121 discipline): re-derive the smallest REAL v2
  //     on disk and fail if the floor has crept up toward it. A floor that eats real briefs is worse
  //     than no floor — it would refuse to promote a short but genuine Editor pass.
  const v2Sizes = fs.existsSync(dbDir)
    ? fs
        .readdirSync(dbDir)
        .filter(f => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f))
        .map(f => fs.statSync(path.join(dbDir, f)).size)
        .filter(s => s > 0)
    : [];
  const smallestRealV2 = v2Sizes.length ? Math.min(...v2Sizes) : 0;
  const okFloorCalibrated =
    smallestRealV2 > 0 && MIN_PLAUSIBLE_BRIEF_BYTES < smallestRealV2 / 2;
  console.log(
    `  [IMP-141] real v2 sizes on disk: n=${v2Sizes.length}, smallest ${smallestRealV2}B → floor ${MIN_PLAUSIBLE_BRIEF_BYTES}B is ${(smallestRealV2 / (MIN_PLAUSIBLE_BRIEF_BYTES || 1)).toFixed(1)}× below it`
  );

  // --- IMP-149 (2026-08-09 Critic mandate #3, RC2): A LEFTOVER IS NOT A LIVE EDITOR.
  // Second consecutive night of Brief_Editor rule 6 failing. IMP-141 caught the EMPTY
  // husk; this is the FULL one — a byte-identical copy of the promoted v2 that clears
  // the 4,000-byte floor and reads ALIVE. Tested on the REAL 2026-08-09 artifacts, then
  // on a synthetic minimal pair so the case survives those files being cleaned up.
  const realTwin = liveness(process.cwd(), '2026-08-09');
  const realTwinPath = path.join(DB(process.cwd()), '2026-08-09-v2.working.md');
  const realTwinExists = fs.existsSync(realTwinPath);
  const okRealTwinAbsent = !realTwinExists || realTwin.state === 'ABSENT';

  const twin = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-twin-'));
  fs.mkdirSync(path.join(twin, 'daily-briefs'), { recursive: true });
  const twinBody = PLAUSIBLE_BODY;
  fs.writeFileSync(path.join(twin, 'daily-briefs', '2026-08-09-v2.md'), twinBody);
  fs.writeFileSync(
    path.join(twin, 'daily-briefs', '2026-08-09-v2.working.md'),
    twinBody
  );
  const okTwinAbsent = liveness(twin, '2026-08-09').state === 'ABSENT';

  // …and the minimal pair: ONE CHARACTER of difference means a real pass in progress,
  // which must still read ALIVE. This is the leg that stops the check from calling a
  // live Editor dead on a light-edit night.
  fs.writeFileSync(
    path.join(twin, 'daily-briefs', '2026-08-09-v2.working.md'),
    twinBody + 'x'
  );
  const okTwinDiffAlive = liveness(twin, '2026-08-09').state === 'ALIVE';

  // ── IMP-216 (2026-08-23 Critic mandate #3, 🔴, RC3) ─────────────────────────────────────────
  //    THE GATE THAT AUTHORIZES SELF-HEAL COULD NOT SEE THE ONLY SOURCE THAT KNOWS THE ANSWER.
  //
  //    EVERY BYTE BELOW IS FROZEN IN THIS SOURCE FILE — never read from `daily-briefs/`. Ledger
  //    rule 9: an assertion pinned to a live board, a directory sweep that grows nightly, or an
  //    incident being currently outstanding red-flags itself the moment the world moves on. The
  //    2026-08-23 board is TODAY'S board and is still being appended to, so reading it here would
  //    be that bug verbatim. These are verbatim prefixes of the real lines through the STATUS
  //    field — everything `lineTask`/`editorLines`/`qgLines` actually parse — with the prose
  //    reason truncated.
  const FROZEN_0823_QG = // the 2026-08-23 board, brief-editor lines ABSENT (see below)
    '2026-08-22T18:41:42-04:00 | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-22T19:04:55-04:00 | brief-quality-gate | daily-briefs/2026-08-23-v1.5.md | SUCCESS | [reason truncated in fixture]\n';
  //    THE CRITIC'S OWN LINE, frozen verbatim. It is the ONLY brief-editor line the 08-23 board
  //    carried, it was written by the CRITIC at 23:32:03Z, and the CANARY-RETRACTION 107 seconds
  //    later is invisible to every board-reading guard. A false canary is unrecallable.
  const FROZEN_0823_CRITIC_CANARY =
    '2026-08-22T23:32:03Z | brief-editor | CANARY | WRITE-OK (SELF-HEAL, Critic-invoked: v2 absent at 19:31 ET, 36 min after the 18:55 editor slot, no brief-editor line on the board)\n';
  const FROZEN_0821_QG = // the 2026-08-21 board as it stood at 23:31Z, BEFORE the Critic self-healed
    '2026-08-20T22:41:32Z | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-20T23:00:18Z | brief-quality-gate | daily-briefs/2026-08-21-v1.5.md | SUCCESS | [reason truncated in fixture]\n';

  const frozenBoard = (date: string, body: string): string => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-sched-'));
    fs.mkdirSync(path.join(r, 'daily-briefs'), { recursive: true });
    fs.writeFileSync(
      path.join(r, 'daily-briefs', `${date}-pipeline-status.md`),
      body
    );
    return r;
  };

  // (a) TONIGHT, WITH THE CRITIC'S CANARY REMOVED — the receipt that the verdict no longer depends
  //     on evidence the Critic wrote. Scheduler: fired 23:20:17.192Z. Now: 23:52Z = T+31.7, inside
  //     the 16–38 band.
  const R0823 = frozenBoard('2026-08-23', FROZEN_0823_QG);
  const NOW0823 = new Date('2026-08-22T23:52:00Z');
  const READ0823 = parseSchedulerLastRun('2026-08-22T23:20:17.192Z')!;
  //     FIRST, the counterfactual that makes the leg mean something: with the canary GONE the board
  //     and the disk carry NOTHING, so the OLD gate — the one with no scheduler input — says ALLOWED.
  //     That is the 08-22 false permit, reproduced on tonight's state.
  const okOldGateWouldPermit = canSelfHeal(R0823, '2026-08-23', NOW0823).length === 0;
  const d0823 = selfHealDecision(R0823, '2026-08-23', {
    reading: READ0823,
    now: NOW0823,
  });
  //     2026-08-26b: 08-23 with NO STEP-0 canary and lastRunAt T+32 is EMPTY-BODY — ALLOW.
  //     The old gate forbade this as FIRED-AND-SILENT "in flight". That is how a dead editor
  //     could never be healed. 08-22 on the real board was the same shape and self-heal was
  //     correct that night.
  const okAllowed0823 =
    d0823.verdict === 'ALLOWED' &&
    d0823.exitCode === 0 &&
    d0823.token === VERDICT_TOKEN.ALLOWED &&
    d0823.branch === 'empty-body' &&
    d0823.sched.state === 'FIRED-AND-SILENT' &&
    d0823.violations.length === 0;
  //     …and the SELFPOISON receipt, inverted: the Critic's canary is NOT a STEP-0 canary, so
  //     restoring it must not flip the verdict to live-canary. Empty-body still ALLOWED.
  const R0823poison = frozenBoard(
    '2026-08-23',
    FROZEN_0823_QG + FROZEN_0823_CRITIC_CANARY
  );
  const poisonD = selfHealDecision(R0823poison, '2026-08-23', {
    reading: READ0823,
    now: NOW0823,
  });
  const poisonV = canSelfHeal(R0823poison, '2026-08-23', NOW0823);
  const okPoisonIgnored =
    poisonD.verdict === 'ALLOWED' &&
    poisonD.branch === 'empty-body' &&
    !poisonV.some(x => x.check === 'self-heal-over-live-editor') &&
    !isOwnStep0CanaryLine(FROZEN_0823_CRITIC_CANARY);
  //     …and the doc rule from part (b) is mechanically honoured HERE: a self-heal canary named
  //     `brief-editor-selfheal` is invisible to this gate's selector, so obeying Brief_Editor L31
  //     can no longer manufacture the evidence Brief_Critic L32 reads. Both directions.
  const R0823selfheal = frozenBoard(
    '2026-08-23',
    FROZEN_0823_QG +
      FROZEN_0823_CRITIC_CANARY.replace('| brief-editor |', '| brief-editor-selfheal |')
  );
  const okSelfhealCanaryInvisible =
    editorLines(R0823selfheal, '2026-08-23').length === 0 &&
    editorLines(R0823poison, '2026-08-23').length === 1;

  // (b) UNKNOWN — the load-bearing clause. Same fixture, same instant, NO scheduler reading.
  const dUnknown = selfHealDecision(R0823, '2026-08-23', {
    reading: null,
    now: NOW0823,
  });
  const okUnknown =
    dUnknown.verdict === 'UNKNOWN' &&
    dUnknown.token === 'SELF-HEAL UNKNOWN' &&
    dUnknown.exitCode === 3 &&
    dUnknown.exitCode === SELF_HEAL_UNKNOWN_EXIT &&
    dUnknown.sched.state === 'UNKNOWN' &&
    dUnknown.violations.length === 0;
  //     The three verdicts must be TELLABLE APART by exit code alone — a caller that cannot
  //     distinguish them is a caller that will read UNKNOWN as ALLOWED.
  const okExitCodesDistinct =
    new Set([0, 1, SELF_HEAL_UNKNOWN_EXIT]).size === 3 &&
    SELF_HEAL_UNKNOWN_EXIT !== 0 &&
    SELF_HEAL_UNKNOWN_EXIT !== 1;

  // (c) 2026-08-21 — THE NIGHT THE EDITOR WAS GENUINELY ABSENT AND SELF-HEAL WAS CORRECT.
  //     The gate must not become a deadlock: a true absence still returns ALLOWED.
  const R0821 = frozenBoard('2026-08-21', FROZEN_0821_QG);
  const NOW0821 = new Date('2026-08-20T23:31:00Z'); // the Critic's first poll
  const d0821never = selfHealDecision(R0821, '2026-08-21', {
    reading: parseSchedulerLastRun('NEVER'),
    now: NOW0821,
  });
  const okAllowed0821 =
    d0821never.verdict === 'ALLOWED' &&
    d0821never.exitCode === 0 &&
    d0821never.token === VERDICT_TOKEN.ALLOWED &&
    d0821never.sched.state === 'NEVER-FIRED' &&
    d0821never.violations.length === 0;
  //     …and by the other route the record actually states it — "no lastRunAt AFTER the QG's
  //     SUCCESS". A lastRunAt predating this cycle's QG terminal belongs to a previous night.
  //     (The 08-19 value is not on disk; what is on the record is that nothing followed 23:00:18Z.)
  const d0821prior = selfHealDecision(R0821, '2026-08-21', {
    reading: parseSchedulerLastRun('2026-08-19T23:20:00Z'),
    now: NOW0821,
  });
  const okAllowed0821Prior =
    d0821prior.verdict === 'ALLOWED' &&
    d0821prior.sched.state === 'NEVER-FIRED' &&
    d0821prior.branch === 'never';

  // (c2) 2026-08-22 — THE HELD-OUT CASE THE OLD GATE GOT WRONG. No canary, no terminal,
  //      lastRunAt this cycle (23:20:14Z). Empty-body. Self-heal was correct that night.
  const FROZEN_0822_QG_EARLY =
    '2026-08-21T22:41:38Z | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-21T23:07:07Z | brief-quality-gate | daily-briefs/2026-08-22-v1.5.md | SUCCESS | [reason truncated in fixture]\n';
  const R0822 = frozenBoard('2026-08-22', FROZEN_0822_QG_EARLY);
  const NOW0822 = new Date('2026-08-21T23:52:00Z'); // T+32 from 23:20:14Z
  const d0822 = selfHealDecision(R0822, '2026-08-22', {
    reading: parseSchedulerLastRun('2026-08-21T23:20:14Z'),
    now: NOW0822,
  });
  const okAllowed0822 =
    d0822.verdict === 'ALLOWED' &&
    d0822.branch === 'empty-body' &&
    d0822.sched.state === 'FIRED-AND-SILENT' &&
    d0822.violations.length === 0;

  // (c3) SYNTHETIC live-canary past 38 min — the state 2c would produce if it ever ran.
  //      Canary written, no terminal, lastRunAt 40+ minutes ago → REFUSE. Also T+65, past
  //      the old NO_ARTIFACT_WAIT_MIN cap that would have permitted it.
  const RliveCanary = frozenBoard(
    '2026-08-23',
    FROZEN_0823_QG + '2026-08-22T23:20:30Z | brief-editor | CANARY | WRITE-OK\n'
  );
  const LAST0823 = new Date('2026-08-22T23:20:17.192Z');
  const dLive40 = selfHealDecision(RliveCanary, '2026-08-23', {
    reading: READ0823,
    now: new Date(LAST0823.getTime() + 40 * 60000),
  });
  const dLive65 = selfHealDecision(RliveCanary, '2026-08-23', {
    reading: READ0823,
    now: new Date(LAST0823.getTime() + 65 * 60000),
  });
  const okLiveCanaryRefuse =
    dLive40.verdict === 'FORBIDDEN' &&
    dLive40.branch === 'live-canary' &&
    dLive40.violations.some(x => x.check === 'self-heal-over-live-editor') &&
    dLive65.verdict === 'FORBIDDEN' &&
    dLive65.branch === 'live-canary';

  // (d) A live Editor's FORBIDDEN is scheduler-independent. On a fixture with a LIVE Editor, a
  //     past-the-band scheduler reading must NOT downgrade the verdict, and neither must UNKNOWN.
  const aliveSched = schedulerLiveness(
    alive,
    D,
    parseSchedulerLastRun('1999-01-01T00:00:00Z'),
    new Date()
  );
  const okMonotonePastBand =
    canSelfHeal(alive, D, new Date(), aliveSched).length >=
      canSelfHeal(alive, D).length &&
    selfHealDecision(alive, D, {
      reading: parseSchedulerLastRun('1999-01-01T00:00:00Z'),
    }).verdict === 'FORBIDDEN';
  const okForbiddenOutranksUnknown =
    selfHealDecision(alive, D, { reading: null }).verdict === 'FORBIDDEN';

  // (e) THE BAND EDGES, both sides, and the floor case.
  const bandRoot = frozenBoard('2026-08-23', FROZEN_0823_QG);
  const bandAt = (min: number) =>
    schedulerLiveness(
      bandRoot,
      '2026-08-23',
      parseSchedulerLastRun('2026-08-22T23:20:00Z'),
      new Date(new Date('2026-08-22T23:20:00Z').getTime() + min * 60000)
    ).state;
  const okBandEdges =
    bandAt(5) === 'FIRED-AND-SILENT' && // below the 16-min floor it cannot even have finished
    bandAt(EDITOR_FIRE_BAND_MAX_MIN) === 'FIRED-AND-SILENT' &&
    bandAt(EDITOR_FIRE_BAND_MAX_MIN + 0.5) === 'FIRED-PAST-BAND';

  // (f) THE PARSER REFUSES TO GUESS. A typo must not silently become UNKNOWN via the flag path;
  //     the CLI turns null into a usage error (exit 2).
  const okParser =
    parseSchedulerLastRun('NEVER')?.never === true &&
    parseSchedulerLastRun('2026-08-22T23:20:17.192Z')?.lastRunAt?.toISOString() ===
      '2026-08-22T23:20:17.192Z' &&
    parseSchedulerLastRun('2026-08-22T19:04:55-04:00')?.lastRunAt instanceof Date &&
    parseSchedulerLastRun('yesterday') === null &&
    parseSchedulerLastRun('') === null;
  //     …and an ABSENT scheduler-state directory yields NO reading (⇒ UNKNOWN), never a default.
  const okStateDirAbsentIsUnknown =
    readSchedulerStateDir(path.join(os.tmpdir(), 'ehg-no-such-dir-216')) === null;

  // (g) THE TWO DOCUMENTS MUST AGREE — the second half of the mandate, mechanically. A prose-only
  //     rule is unenforced, and this pair ordering incompatible first actions is what made a
  //     compliant self-heal unable to pass its own gate.
  const edDoc = path.join(root, 'system', 'Brief_Editor.md');
  const crDoc = path.join(root, 'system', 'Brief_Critic.md');
  const edTxt = fs.existsSync(edDoc) ? fs.readFileSync(edDoc, 'utf8') : '';
  const crTxt = fs.existsSync(crDoc) ? fs.readFileSync(crDoc, 'utf8') : '';
  const okDocsAgree =
    edTxt.includes('brief-editor-selfheal') &&
    crTxt.includes('brief-editor-selfheal') &&
    crTxt.includes('--scheduler-lastrun') &&
    crTxt.includes('exit 3') &&
    edTxt.includes('--can-self-heal');

  // THE BAND IS CALIBRATED AND ITS LIMITS ARE STATED, NOT HIDDEN. Frozen measurement of every
  // brief-editor CANARY→terminal runtime on the real boards, 2026-07-01 → 2026-08-20 (n=34,
  // CORPUS FROZEN — never re-swept, or this leg moves every night):
  const FROZEN_EDITOR_RUNTIMES_MIN = [
    38.8, 204.7, 16.5, 14.1, 19.3, 44.5, 64.7, 64.5, 54.2, 94.2, 22.4, 80.6,
    23.4, 23.0, 79.7, 39.2, 65.0, 12.1, 18.0, 21.2, 24.7, 73.0, 29.0, 24.4,
    20.9, 22.0, 11.3, 11.0, 36.0, 14.9, 23.5, 38.5, 18.3, 22.0,
  ];
  const okBandIsNotARuntimeCeiling =
    FROZEN_EDITOR_RUNTIMES_MIN.length === 34 &&
    Math.max(...FROZEN_EDITOR_RUNTIMES_MIN) > EDITOR_FIRE_BAND_MAX_MIN &&
    okMonotonePastBand; // ← which is precisely why that is safe
  console.log(
    `  [IMP-216] frozen brief-editor CANARY→terminal runtimes (n=${FROZEN_EDITOR_RUNTIMES_MIN.length}, 07-01→08-20): median ${[...FROZEN_EDITOR_RUNTIMES_MIN].sort((a, b) => a - b)[17]!.toFixed(1)}, max ${Math.max(...FROZEN_EDITOR_RUNTIMES_MIN).toFixed(1)} min. Fired-and-silent band ${EDITOR_FIRE_BAND_MIN_MIN}–${EDITOR_FIRE_BAND_MAX_MIN} min is a SILENCE window, NOT a runtime ceiling — safe only because the leg is monotone.`
  );

  // ── IMP-216 (2026-08-24 Critic mandate #2, 🔴, RC3): --audit-nonproduction ──────────────────
  //    E-PIPELINE-EDITOR-NONPRODUCTION-01, DAY 4. Same freezing discipline as the block above:
  //    EVERY BYTE IS FROZEN HERE, never read from `daily-briefs/`. The 08-24 board is TODAY'S board
  //    and is still being appended to — and the 08-22 board is the proof that this matters, because
  //    the ONLY brief-editor line it carries was written by a self-heal the NEXT MORNING at
  //    09:15:55Z. An assertion pinned to that live file would have flipped from RED to green
  //    overnight, silently, for a night on which the Editor produced nothing.
  //    Verbatim prefixes of the real lines through the STATUS field; prose reasons truncated.
  const FROZEN_0820_BOARD = // the Editor RAN and produced v2 — the clean night
    '2026-08-19T22:41:28Z | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-19T22:58:45Z | brief-quality-gate | daily-briefs/2026-08-20-v1.5.md | SUCCESS | [reason truncated in fixture]\n' +
    '2026-08-19T23:09:20Z | brief-editor | CANARY | WRITE-OK\n' +
    '2026-08-19T23:31:22Z | brief-editor | daily-briefs/2026-08-20-v2.md | SUCCESS | [reason truncated in fixture]\n';
  const FROZEN_0822_QG = // the 2026-08-22 board at the night poll — brief-editor lines ABSENT
    '2026-08-21T22:41:38Z | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-21T22:42:57Z | brief-quality-gate | WAITING-ON-V1 | NOT self-healing. [reason truncated in fixture]\n' +
    '2026-08-21T23:07:07Z | brief-quality-gate | daily-briefs/2026-08-22-v1.5.md | SUCCESS | [reason truncated in fixture]\n';
  const FROZEN_0824_QG = // the 2026-08-24 board — ZERO brief-editor lines, then and now
    '2026-08-23T18:41:45-0400 | brief-quality-gate | CANARY | WRITE-OK\n' +
    '2026-08-23T19:12:08-0400 | brief-quality-gate | daily-briefs/2026-08-24-v1.5.md | SUCCESS | [reason truncated in fixture]\n';
  //    The three fire instants, from `list_scheduled_tasks` → brief-editor.lastRunAt, as recorded
  //    in the Critic reports for those nights.
  const LR22 = parseSchedulerLastRun('2026-08-21T23:20:14Z')!;
  const LR23 = parseSchedulerLastRun('2026-08-22T23:20:17.192Z')!;
  const LR24 = parseSchedulerLastRun('2026-08-23T23:21:20Z')!;
  const plus = (r: SchedulerReading, min: number) =>
    new Date(r.lastRunAt!.getTime() + min * 60000);

  // (1) THREE REAL NIGHTS, THREE REDS, ASSERTED INDIVIDUALLY. Fired · past the band · zero trace.
  const NP22 = frozenBoard('2026-08-22', FROZEN_0822_QG);
  const a22 = auditNonProduction(NP22, '2026-08-22', {
    reading: LR22,
    now: plus(LR22, 39),
  });
  const okNP22 =
    a22.fired &&
    a22.exitCode === 1 &&
    a22.verdict === 'NON-PRODUCTION' &&
    a22.sched.state === 'FIRED-PAST-BAND' &&
    a22.violations.some(x => x.check === 'editor-nonproduction');
  //    08-23 reuses the frozen board from the block above — the one with the Critic's fabricated
  //    canary REMOVED, which is the honest state of that night's evidence.
  const a23 = auditNonProduction(R0823, '2026-08-23', {
    reading: LR23,
    now: plus(LR23, 39),
  });
  const okNP23 =
    a23.fired && a23.exitCode === 1 && a23.sched.state === 'FIRED-PAST-BAND';
  const NP24 = frozenBoard('2026-08-24', FROZEN_0824_QG);
  const a24 = auditNonProduction(NP24, '2026-08-24', {
    reading: LR24,
    now: plus(LR24, 39),
  });
  const okNP24 =
    a24.fired && a24.exitCode === 1 && a24.sched.state === 'FIRED-PAST-BAND';

  // (2) SILENT ON THE NIGHTS A v2 EXISTS — and for two DIFFERENT right reasons, which is the point.
  //     08-20: the Editor fired, ran, and left both a board line and v2 ⇒ FIRED-AND-OBSERVED.
  //     08-21: the scheduler says the slot NEVER FIRED ⇒ that is `pipeline-slot-attendance`'s alarm
  //            (IMP-207), not this one. Two alarms for one fact teach the reader to skim both.
  const NP20 = frozenBoard('2026-08-20', FROZEN_0820_BOARD);
  fs.writeFileSync(
    path.join(NP20, 'daily-briefs', '2026-08-20-v2.md'),
    PLAUSIBLE_BODY
  );
  const a20 = auditNonProduction(NP20, '2026-08-20', {
    reading: parseSchedulerLastRun('2026-08-19T23:09:20Z'),
    now: new Date('2026-08-19T23:48:20Z'),
  });
  const okNP20 =
    !a20.fired &&
    a20.exitCode === 0 &&
    a20.verdict === 'PRODUCED' &&
    a20.sched.state === 'FIRED-AND-OBSERVED' &&
    a20.violations.length === 0;
  const NP21 = frozenBoard(
    '2026-08-21',
    FROZEN_0821_QG +
      '2026-08-20T23:40:32Z | brief-editor | daily-briefs/2026-08-21-v2.md | SUCCESS | SELF-HEAL (Critic-invoked) [reason truncated in fixture]\n'
  );
  fs.writeFileSync(
    path.join(NP21, 'daily-briefs', '2026-08-21-v2.md'),
    PLAUSIBLE_BODY
  );
  const a21pre = auditNonProduction(NP21, '2026-08-21', {
    reading: parseSchedulerLastRun('NEVER'),
    now: new Date('2026-08-20T23:31:00Z'),
  });
  const a21post = auditNonProduction(NP21, '2026-08-21', {
    reading: parseSchedulerLastRun('NEVER'),
    now: new Date('2026-08-20T23:59:00Z'),
  });
  const okNP21 =
    !a21pre.fired &&
    a21pre.exitCode === 0 &&
    a21pre.verdict === 'NOT-FIRED' &&
    !a21post.fired &&
    a21post.exitCode === 0;
  //     …and the two v2 files those legs describe are REALLY on disk. Corroboration, deliberately
  //     NOT the assertion: if the archive is ever cleaned the frozen legs above still bind.
  const realV2_0820 = fs.existsSync(
    path.join(DB(root), '2026-08-20-v2.md')
  );
  const realV2_0821 = fs.existsSync(
    path.join(DB(root), '2026-08-21-v2.md')
  );
  const realV2_0823 = fs.existsSync(path.join(DB(root), '2026-08-23-v2.md'));
  const realV2_0824 = fs.existsSync(path.join(DB(root), '2026-08-24-v2.md'));
  const okRealV2Split = !realV2_0823 && !realV2_0824;

  // (3) THE BOUNDARY IS A REAL SWITCH, NOT A SLOPE. Inside the band is IN FLIGHT: a gate that reds
  //     at minute 20 recreates the false-permit class from the opposite side — it teaches the
  //     morning reader that this alarm cries wolf, and the next real RED gets skimmed. Same
  //     fixture, same scheduler reading, two instants.
  const a24_t20 = auditNonProduction(NP24, '2026-08-24', {
    reading: LR24,
    now: plus(LR24, 20),
  });
  const a24_t38 = auditNonProduction(NP24, '2026-08-24', {
    reading: LR24,
    now: plus(LR24, EDITOR_FIRE_BAND_MAX_MIN),
  });
  const okBandSwitch =
    !a24_t20.fired &&
    a24_t20.exitCode === 0 &&
    a24_t20.verdict === 'IN-FLIGHT' &&
    a24_t20.sched.state === 'FIRED-AND-SILENT' &&
    !a24_t38.fired && // the top of the band is still IN FLIGHT
    a24.fired && // …and T+39 fires. One fixture, one switch.
    a24.exitCode === 1;

  // (4) UNKNOWN, NEVER A VERDICT — the exit-3 contract, on the state that most looks like a red.
  //     08-24's board and disk are empty; with no scheduler reading that emptiness is EVIDENCE OF
  //     NOTHING, and "no violations printed" must not be readable as a clean bill of health.
  const a24_unknown = auditNonProduction(NP24, '2026-08-24', {
    reading: null,
    now: plus(LR24, 39),
  });
  const okNPUnknown =
    !a24_unknown.fired &&
    a24_unknown.verdict === 'UNKNOWN' &&
    a24_unknown.exitCode === SELF_HEAL_UNKNOWN_EXIT &&
    //     …and it is TELLABLE APART from both real verdicts BY EXIT CODE ALONE. Three live audits
    //     of three real nights, three distinct codes: 08-20 clean (0), 08-24 non-production (1),
    //     08-24 with no reading (3). A caller that cannot distinguish UNKNOWN from a clean run is a
    //     caller that will file it as one.
    new Set([a20.exitCode, a24.exitCode, a24_unknown.exitCode]).size === 3 &&
    a24_unknown.sched.state === 'UNKNOWN' &&
    a24_unknown.violations.length === 0;

  // (5) THE STAGED WORKING FILE MAKES LIVENESS SCHEDULER-INDEPENDENT — the whole point of
  //     Brief_Editor Gate 0.5. Before it, the Editor wrote nothing until it was finished, so
  //     "never started" · "died at check 3" · "still working" were one indistinguishable string on
  //     disk and `--liveness` had to INFER from the scheduler. With a staged file that exists from
  //     minute one, liveness is an MTIME QUESTION — which is what this gate was built to read.
  //     The proof is the CONTRADICTION: the scheduler is handed NEVER (the strongest possible
  //     "there is no Editor") and the disk still says ALIVE, out-voting it on its own evidence.
  const staged = frozenBoard('2026-08-24', FROZEN_0824_QG);
  const stagedDb = path.join(staged, 'daily-briefs');
  const V15_BODY = PLAUSIBLE_BODY;
  fs.writeFileSync(path.join(stagedDb, '2026-08-24-v1.5.md'), V15_BODY);
  const stagedWorking = path.join(stagedDb, '2026-08-24-v2.working.md');
  const STAGED_NOW = new Date();
  const touch = (p: string, minAgo: number) => {
    const t = new Date(STAGED_NOW.getTime() - minAgo * 60000);
    fs.utimesSync(p, t, t);
  };
  //     (5a) the steady state: staged, then EDITED — Gate 1 struck a magnitude 2 minutes ago.
  fs.writeFileSync(
    stagedWorking,
    V15_BODY.replace('4.1 percent', '4.3 percent')
  );
  touch(stagedWorking, 2);
  const stagedLive = liveness(staged, '2026-08-24', STAGED_NOW);
  const stagedSched = schedulerLiveness(
    staged,
    '2026-08-24',
    parseSchedulerLastRun('NEVER'),
    STAGED_NOW
  );
  const okStagedAliveFromMtime =
    stagedLive.state === 'ALIVE' &&
    stagedLive.quietMin !== null &&
    stagedLive.quietMin < QUIET_MIN &&
    stagedLive.bytes !== null &&
    stagedLive.bytes >= MIN_PLAUSIBLE_BRIEF_BYTES &&
    stagedSched.state === 'NEVER-FIRED' && // the scheduler says NO EDITOR…
    stagedLive.state === 'ALIVE'; // …and the artifact out-votes it. mtime needs no witness.
  //     …and the counterfactual that makes the leg mean something: TODAY's shape — same board, same
  //     instant, NO working file — is ABSENT, and the answer then depends entirely on the scheduler.
  fs.rmSync(stagedWorking, { force: true });
  const okNoStagedIsAbsent =
    liveness(staged, '2026-08-24', STAGED_NOW).state === 'ABSENT';

  // (5-bis) THE HOLE GATE 0.5 OPENS, CLOSED IN THE SAME PASS. A staged file is a byte-copy of v1.5
  //     containing ZERO editorial work, and it is fresh, 60 KB and perfectly plausible. Unhandled it
  //     reads ALIVE → QUIET → "past the 45-min floor, promote it" and an UNEDITED v1.5 SHIPS AS v2 —
  //     the exact reader harm this improvement exists to stop, re-entering through the door the fix
  //     opened. IDENTITY, never similarity (IMP-149's reason): one character of divergence is a real
  //     pass in progress and must still be promotable.
  fs.writeFileSync(
    path.join(stagedDb, '2026-08-24-pipeline-status.md'),
    FROZEN_0824_QG +
      `${new Date(STAGED_NOW.getTime() - 50 * 60000).toISOString().replace(/\.\d+Z$/, 'Z')} | brief-editor | CANARY | WRITE-OK\n`
  );
  fs.writeFileSync(stagedWorking, V15_BODY); // byte-identical to v1.5 — staged, never edited
  touch(stagedWorking, 25); // quiet, and past the 45-min promotion floor
  const untouched = liveness(staged, '2026-08-24', STAGED_NOW);
  const okUntouchedStagedAbsent =
    untouched.state === 'ABSENT' &&
    // IMP-222 widened this branch from bytes to reader bodies; the byte case is a strict subset and
    // must go on being caught, which is what this leg pins. The wording moved, the verdict did not.
    /READER-BODY-IDENTICAL to 2026-08-24-v1\.5\.md/.test(untouched.reason) &&
    /a byte copy/.test(untouched.reason) &&
    canPromote(staged, '2026-08-24', STAGED_NOW).some(
      x => x.check === 'promote-nothing'
    );
  fs.writeFileSync(stagedWorking, `${V15_BODY}x`); // ONE character of real work
  touch(stagedWorking, 25);
  const okOneCharIsPromotable =
    liveness(staged, '2026-08-24', STAGED_NOW).state === 'QUIET' &&
    canPromote(staged, '2026-08-24', STAGED_NOW).length === 0;

  // (6) THE DOCUMENTS THAT CARRY THIS RULE MUST CARRY IT. A prose-only rule is unenforced, and a
  //     mode nothing calls is not a gate, it is a file (the orphaned-gate class, IMP-160).
  const hcDoc = path.join(
    root,
    'system',
    'task-bodies-snapshot',
    'pipeline-health-check',
    'SKILL.md'
  );
  const hcTxt = fs.existsSync(hcDoc) ? fs.readFileSync(hcDoc, 'utf8') : '';
  const okStagedRuleDocumented =
    /Gate 0\.5/.test(edTxt) &&
    /STAGED OUTPUT/.test(edTxt) &&
    edTxt.includes('v2.working.md') &&
    /byte-copy/i.test(edTxt);
  const okAuditWired =
    hcTxt.includes('--audit-nonproduction') &&
    hcTxt.includes('--scheduler-lastrun') &&
    /never blocks?/i.test(hcTxt);

  for (const d of [NP20, NP21, NP22, NP24, staged])
    fs.rmSync(d, { recursive: true, force: true });

  for (const d of [R0823, R0823poison, R0823selfheal, R0821, R0822, RliveCanary, bandRoot])
    fs.rmSync(d, { recursive: true, force: true });

  for (const d of [alive, dead, early, held, ceiling, husk, full, huskEarly, twin])
    fs.rmSync(d, { recursive: true, force: true });

  const rows: [string, boolean][] = [
    [
      'IMP-216 with the Critic\'s canary REMOVED, tonight\'s board carries NO evidence — the OLD gate says ALLOWED (the 08-22 false permit, reproduced)',
      okOldGateWouldPermit,
    ],
    [
      'IMP-216 ALLOWED empty-body on the real 2026-08-23 scheduler state (fired 23:20:17.192Z, T+32, no STEP-0 canary) — a dead editor must be healable (2026-08-26b)',
      okAllowed0823,
    ],
    [
      'IMP-216 a Critic-invoked canary is NOT STEP 0 — restoring it leaves empty-body ALLOWED, it cannot launder a live-canary refuse',
      okPoisonIgnored,
    ],
    [
      'IMP-216 a `brief-editor-selfheal` canary is INVISIBLE to this gate (Brief_Editor L31 can no longer poison Brief_Critic L32) — and a real `brief-editor` canary is still selected',
      okSelfhealCanaryInvisible,
    ],
    [
      'IMP-216 UNKNOWN with no scheduler reading — token "SELF-HEAL UNKNOWN", exit 3, zero violations (an existence check with no liveness input REFUSES to answer)',
      okUnknown,
    ],
    [
      'IMP-216 ALLOWED / FORBIDDEN / UNKNOWN are three distinct exit codes (0 / 1 / 3) — a caller cannot read UNKNOWN as permission',
      okExitCodesDistinct,
    ],
    [
      'IMP-216 ALLOWED on the real 2026-08-21 state (scheduler NEVER fired) — the night self-heal was correct; the gate must not deadlock a genuinely absent Editor',
      okAllowed0821,
    ],
    [
      'IMP-216 …and by the record\'s own wording — a lastRunAt PREDATING this cycle\'s QG terminal is NEVER-FIRED',
      okAllowed0821Prior,
    ],
    [
      'IMP-216 ALLOWED empty-body on the real 2026-08-22 state (fired 23:20:14Z, T+32, no canary, no terminal) — self-heal was correct that night',
      okAllowed0822,
    ],
    [
      'IMP-216 REFUSE live-canary at T+40 and T+65 (synthetic 2c-still-running) — no age cap; a canary with no terminal is still working',
      okLiveCanaryRefuse,
    ],
    [
      'IMP-216 a live Editor stays FORBIDDEN under a past-the-band scheduler reading and under UNKNOWN',
      okMonotonePastBand,
    ],
    [
      'IMP-216 FORBIDDEN outranks UNKNOWN — evidence of a live Editor needs no scheduler',
      okForbiddenOutranksUnknown,
    ],
    [
      'IMP-216 band edges: T+5 and T+38 are FIRED-AND-SILENT, T+38.5 is FIRED-PAST-BAND',
      okBandEdges,
    ],
    [
      'IMP-216 the reading parser refuses to guess (ISO, offset form, NEVER; null on garbage) and an absent state dir yields NO reading',
      okParser && okStateDirAbsentIsUnknown,
    ],
    [
      'IMP-216 Brief_Editor.md and Brief_Critic.md AGREE — both name `brief-editor-selfheal`; the Critic names --scheduler-lastrun and exit 3',
      okDocsAgree,
    ],
    [
      'IMP-216 the 16–38 band is a SILENCE window, not a runtime ceiling (frozen n=34, max 204.7 min) — safe because the leg is monotone',
      okBandIsNotARuntimeCeiling,
    ],
    [
      'IMP-216 --audit-nonproduction FIRES on 2026-08-22 (fired 23:20:14Z, T+39, no v2 / no working file / no board line) — exit 1, check editor-nonproduction',
      okNP22,
    ],
    [
      'IMP-216 --audit-nonproduction FIRES on 2026-08-23 (fired 23:20:17.192Z, T+39) on the board with the Critic\'s fabricated canary REMOVED — exit 1',
      okNP23,
    ],
    [
      'IMP-216 --audit-nonproduction FIRES on 2026-08-24 (fired 23:21:20Z, T+39, ZERO brief-editor lines on the real board) — exit 1. Four consecutive nights, three reds this gate would have raised at 11:06',
      okNP24,
    ],
    [
      'IMP-216 --audit-nonproduction SILENT on 2026-08-20 — the Editor fired, ran, and left a board line AND a v2 ⇒ FIRED-AND-OBSERVED, exit 0, zero violations',
      okNP20,
    ],
    [
      'IMP-216 --audit-nonproduction SILENT on 2026-08-21 (scheduler NEVER fired, both before and after the Critic\'s self-heal) — a slot that never STARTED is pipeline-slot-attendance\'s alarm (IMP-207), not this one',
      okNP21,
    ],
    [
      `IMP-216 …and the v2 files those two silent legs describe are really on disk (08-20 ${realV2_0820 ? 'present' : 'CLEANED UP — frozen leg binds'}, 08-21 ${realV2_0821 ? 'present' : 'CLEANED UP — frozen leg binds'}), while 08-23 and 08-24 have NO v2 at all`,
      okRealV2Split,
    ],
    [
      `IMP-216 the band boundary is a REAL SWITCH: SILENT at T+20 and at T+${EDITOR_FIRE_BAND_MAX_MIN} (IN-FLIGHT), FIRES at T+39 — one fixture, one scheduler reading, three instants. A gate that reds at minute 20 is the false-permit class from the opposite side`,
      okBandSwitch,
    ],
    [
      'IMP-216 --audit-nonproduction returns UNKNOWN (exit 3), never a verdict, with no scheduler reading — on the emptiest board of all, where "no violations" most looks like health',
      okNPUnknown,
    ],
    [
      'IMP-216 the STAGED working file makes --liveness SCHEDULER-INDEPENDENT: ALIVE read from mtime while --scheduler-lastrun NEVER says there is no Editor at all; strip the file and the same instant reads ABSENT',
      okStagedAliveFromMtime && okNoStagedIsAbsent,
    ],
    [
      'IMP-216 a staged copy still BYTE-IDENTICAL to v1.5 reads ABSENT and is UNPROMOTABLE — Gate 0.5 cannot become a path for shipping an unedited v1.5 as v2 at the 45-min floor',
      okUntouchedStagedAbsent,
    ],
    [
      'IMP-216 …and ONE CHARACTER of real editorial work makes it promotable again — identity, never similarity (IMP-149\'s reason: a light-edit night is still a live Editor)',
      okOneCharIsPromotable,
    ],
    [
      'IMP-216 Brief_Editor.md carries the Gate 0.5 STAGED OUTPUT rule (byte-copy of v1.5 as the first file action) — a prose-only rule is unenforced, and an undocumented mechanical rule is unfollowed',
      okStagedRuleDocumented,
    ],
    [
      'IMP-216 pipeline-health-check INVOKES --audit-nonproduction with --scheduler-lastrun and states it never blocks — a mode nothing calls is not a gate, it is a file (IMP-160)',
      okAuditWired,
    ],
    [
      'IMP-149 the REAL 37,973-byte 2026-08-09-v2.working.md twin reads ABSENT' +
        (realTwinExists ? '' : ' (artifact cleaned up — synthetic leg binds)'),
      okRealTwinAbsent,
    ],
    [
      'IMP-149 a working file byte-identical to the promoted v2 reads ABSENT, never ALIVE',
      okTwinAbsent,
    ],
    [
      'IMP-149 SILENT on a one-character difference — a real mid-pass Editor stays ALIVE',
      okTwinDiffAlive,
    ],
    [
      'IMP-141 the REAL 0-byte 2026-08-08-v2.working.md reads ABSENT at the moment it read ALIVE',
      okRealAbsent,
    ],
    [
      'IMP-141 --can-promote REFUSES that real husk with the 120-min ceiling already active',
      okRealRefused,
    ],
    [
      'IMP-141 an empty working file reads ABSENT, never ALIVE (synthetic minimal pair)',
      okHuskAbsent,
    ],
    [
      'IMP-141 …and promotion is refused PAST the hard ceiling (never-deadlock ≠ never-sanity-check)',
      okHuskRefusedPastCeiling,
    ],
    [
      'IMP-141 SILENT on the same fixture with a plausible body: still ALIVE',
      okFullAlive,
    ],
    [
      'IMP-141 …and still promotable past the ceiling — the never-deadlock path survives the guard',
      okFullPromotable,
    ],
    [
      'IMP-141 an empty file at minute 5 still FORBIDS a self-heal (the 07-13 hole stays shut)',
      okHuskEarlyNoSelfHeal,
    ],
    [
      `IMP-141 the ${MIN_PLAUSIBLE_BRIEF_BYTES}B floor stays far under the smallest real v2 (${smallestRealV2}B)`,
      okFloorCalibrated,
    ],
    [
      'IMP-121 QG ALIVE at 23:57:43Z on the REAL 08-03 board (the moment the guard said EXPIRED)',
      okQgAlive,
    ],
    [
      'IMP-121 QG QUIET only after the real 00:12:33Z SUCCESS line',
      okQgQuietAfter,
    ],
    [
      "IMP-121 the board's `-0400` timestamp form parses (else the guard deadlocks ALIVE)",
      okQgOffsetParsed,
    ],
    [
      'IMP-121 a genuinely crashed QG goes QUIET past the budget (never deadlock)',
      okQgCrash,
    ],
    [
      "IMP-121 SILENT on real 08-01 — QG finished before the Editor's canary",
      okQg0801,
    ],
    ['IMP-121 SILENT on real 08-02 — same clean ordering', okQg0802],
    [
      `IMP-121 the ${QG_NO_ARTIFACT_WAIT_MIN}-min budget still exceeds the observed max (${observedMax.toFixed(1)})`,
      okQgCalibrated,
    ],
    [
      `IMP-184 the real 08-17 board DOES cross-narrate (${foreignQg.length} foreign QG mentions, ${foreignEd.length} foreign editor mentions) — else the next four legs prove nothing`,
      okContaminationReal,
    ],
    [
      'IMP-184 NOT ONE foreign line survives either selector (task field, not substring)',
      okNoForeignSelected,
    ],
    [
      "IMP-184 a foreign SUCCESS is never a TERMINAL — the QG's terminal is its own 00:09:14Z line, not brief-critic's 00:27:29Z (this is the passthrough-v1.5 hole)",
      okTerminalIsTheQgs,
    ],
    [
      `IMP-184 08-17 measures the QG's REAL 86.98 min, not the contaminated 105.2 (got ${mins0817.toFixed(2)})`,
      okRuntime0817,
    ],
    [
      'IMP-184 a prose line owns no task; a real status line owns exactly its second field',
      okProseOwnsNoTask,
    ],
    ['FIRES on real 07-14 (mid-pass snapshot promoted, then superseded)', ok14],
    ['FIRES on real 07-13 (self-heal over a live Editor)', ok13],
    [
      'FIRES on real 07-13 (Critic PROVISIONAL, later Editor SUCCESS)',
      ok13Recon,
    ],
    ['FIRES on real 07-11 (same fingerprint — not day one)', ok11],
    ['SILENT on real 07-10 (clean handoff)', ok10],
    ['SILENT on real 07-12 (clean handoff)', ok12],
    [
      'LIVENESS: working file touched 30s ago at minute 46 = ALIVE',
      okAliveState,
    ],
    [
      'FORBIDS promotion of a file that is still being written (THE 07-14 FIX)',
      okAliveForbid,
    ],
    ['FORBIDS a self-heal over a live Editor', okAliveNoSelfHeal],
    [
      'LIVENESS: no write for 25 min = QUIET (a crash is the artifact stopping)',
      okDeadState,
    ],
    [
      'ALLOWS promotion of a genuinely crashed Editor (the brief always ships)',
      okDeadPromote,
    ],
    ['FORBIDS promotion inside the 45-min floor even when quiet', okEarly],
    ['FORBIDS promotion over an EDITOR-HOLD (a hold is a decision)', okHeld],
    [
      'ALLOWS a forced promotion past the 120-min hard ceiling (never deadlock)',
      okCeiling,
    ],
    ['ALLOWS a self-heal when the Editor is genuinely absent', okAllowed],
    [
      'IMP-072 FIRES on a completed-but-unlogged Editor (07-18 observability gap)',
      okUnlogged,
    ],
    [
      'IMP-072 SILENT once the brief-editor SUCCESS line is present',
      okLoggedSilent,
    ],
  ];

  // --- IMP-155 PROMOTION AUDIT: existence, on REAL artifacts, across all five shapes.
  // The acceptance the 08-10 mandate set: FIRE on 08-06 (294 B), 08-07 (0 B), 08-08 (0 B),
  // 08-09 (byte-identical to v2) and 08-10 (56,562 B mid-pass snapshot) — the two prior fixes
  // are blind on at least one of these each. Then: SILENT wherever rule 6 was honoured, and
  // SILENT during a live Editor pass (working file, no v2 yet), which --liveness owns.
  // ⚠️ THESE FIVE `daily-briefs/2026-08-0*-v2.working.md` FILES ARE RECEIPTS, NOT LITTER.
  // They are the only surviving evidence of all five shapes. Do NOT sweep them in a cleanup pass
  // or this leg goes red for the wrong reason — the gate must go on being provable against the
  // failures that produced it. Delete them only together with this assertion.
  const promoNights = [
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
    '2026-08-10',
  ];
  const promoFired = promoNights.map(d => auditPromotion(root, d));
  const okPromoFiresAll = promoFired.every(v => v.length === 1);
  // Both diagnoses must still be distinguishable — 08-09 is the byte-identical husk, 08-10 is not.
  const okPromoDiagnoses =
    auditPromotion(root, '2026-08-09')[0]?.check === 'ORPHANED-SCRATCH' &&
    auditPromotion(root, '2026-08-10')[0]?.check === 'STALE-SCRATCH';
  // SILENT on every real date that has a promoted v2 and honoured rule 6. Derived from disk, not
  // from a hand-picked date, so the silent leg cannot be tuned.
  const promoDir = DB(root);
  const cleanNights = fs.existsSync(promoDir)
    ? fs
        .readdirSync(promoDir)
        .map(f => f.match(/^(\d{4}-\d{2}-\d{2})-v2\.md$/)?.[1])
        .filter((d): d is string => !!d)
        .filter(d => !fs.existsSync(path.join(promoDir, `${d}-v2.working.md`)))
    : [];
  // 🔴 SCOPE: THIS LEG TESTS THE GATE, NOT THE WORLD (IMP-222, 2026-08-26, RC5).
  // `cleanNights` is derived from LIVE disk, which is what makes the leg untunable — and which also
  // made it a world-state assertion in disguise. `auditPromotion` grew a second question in IMP-164
  // (is there an editor log?) and two more today, so from the moment the Editor stopped writing its
  // log this leg went RED — on nights that honoured rule 6 perfectly — and took TEN unrelated
  // ledger rows down with it (IMP-046/048/072/121/141/149/155/157/164/184 and ESC-004 all share
  // this one `--selftest`). A REAL production defect was being reported as "these ten improvements
  // are not mechanically real", which is the opposite of true and is exactly how a registry teaches
  // the next session to skim it (CARRY/TREE, 2026-08-13; IMP-211, which drew this same line for
  // pipeline-slot-attendance).
  //
  // So IMP-155's leg asserts IMP-155's invariant: rule 6, the scratch file, and nothing else. The
  // world-state it used to smuggle in is not discarded — `--scan-promotions` reports it every day
  // through the ledger's `world:` channel, where an out-of-contract RECORD belongs.
  const RULE6 = new Set(['ORPHANED-SCRATCH', 'STALE-SCRATCH']);
  const okPromoSilentClean =
    cleanNights.length > 0 &&
    cleanNights.every(d => auditPromotion(root, d).every(v => !RULE6.has(v.check)));
  // SILENT mid-pass: a working file with NO v2 yet is a live Editor, never a failed promotion.
  const liveRoot = fixture('promo-live', {
    canaryMinAgo: 10,
    workingQuietMin: 1,
  });
  const okPromoSilentMidPass = auditPromotion(liveRoot, D).length === 0;
  const okPromoLivenessIntact = liveness(liveRoot, D).state === 'ALIVE';

  rows.push(
    [
      `IMP-155 FIRES on all ${promoNights.length} promotion nights, every shape (294 B / 0 B / 0 B / identical / mid-pass)`,
      okPromoFiresAll,
    ],
    [
      'IMP-155 keeps ORPHANED-SCRATCH vs STALE-SCRATCH distinguishable (verdict is existence either way)',
      okPromoDiagnoses,
    ],
    [
      `IMP-155 SILENT on all ${cleanNights.length} real nights that honoured rule 6`,
      okPromoSilentClean,
    ],
    [
      'IMP-155 SILENT mid-pass (working file, no v2) — --liveness owns that window',
      okPromoSilentMidPass,
    ],
    [
      'IMP-155 does NOT break --liveness: the same mid-pass fixture still reads ALIVE',
      okPromoLivenessIntact,
    ]
  );

  // ── IMP-222 · BODIES, NOT BYTES (08-25 mandate #3a) — every leg on REAL published bytes ───────
  const RD = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  const real = (d: string, kind: string) => RD(path.join(DB(root), `${d}-${kind}.md`));
  const bodyEq = (a: string | null, b: string | null) => a !== null && b !== null && readerBody(a) === readerBody(b);

  // THE DISCRIMINATING TEST, and today's gate failed it: the 08-25 stage is 40,546 B against a
  // 80,496 B v1.5 — NOT byte-identical, and every reader-facing byte identical.
  const s25 = real('2026-08-25', 'v2.working');
  const v25 = real('2026-08-25', 'v1.5');
  rows.push(
    [
      'IMP-222 the real 2026-08-25 stage is NOT byte-identical to v1.5 (40,546 B vs 80,496 B) — else the leg below proves nothing',
      !!s25 && !!v25 && s25 !== v25 && s25.length !== v25.length,
    ],
    [
      'IMP-222 …and IS reader-body-identical to it — ZERO editorial work, which byte-identity read as DIVERGED (the 45-min-floor hole)',
      bodyEq(s25, v25),
    ],
    [
      'IMP-222 REGRESSION PIN: 08-20/21/22, three nights with real Editor passes, ALL read as EDITED — a gate that calls a real pass "absent" can stop a brief',
      ['2026-08-20', '2026-08-21', '2026-08-22'].every(
        d => !bodyEq(real(d, 'v2'), real(d, 'v1.5'))
      ),
    ],
    [
      'IMP-222 a byte-identical `cp` stage is STILL caught — no regression on the case IMP-216 already covered',
      bodyEq('# body\nhello\n', '# body\nhello\n'),
    ],
    [
      'IMP-222 whitespace and a trailing newline are NOT editorial work',
      bodyEq('# body\n\nhello   world\n', '# body\nhello world'),
    ],
    [
      'IMP-222 …and ONE changed reader-facing word IS: the gate must never hold a genuinely edited brief',
      !bodyEq('# body\nhello world\n', '# body\nhello worlds\n'),
    ],
    [
      'IMP-222 comment blocks are not the brief: identical bodies with different comments still read UNEDITED',
      bodyEq('# b\ntext\n<!-- ==== A ==== -->\nx', '# b\ntext\n<!-- ==== B ==== -->\ny'),
    ]
  );

  // ── IMP-222 · UNEDITED-PROMOTION + DROPPED-WORKLIST-BLOCK (mandate #3d) ──────────────────────
  // 2026-08-26 IS the predicted night: v2.md landed byte-identical to v1.5.md and shipped.
  const a26 = auditPromotion(root, '2026-08-26');
  rows.push(
    [
      'IMP-222 FIRES UNEDITED-PROMOTION on the REAL 2026-08-26 v2 — 70,983 B identical to v1.5, promoted, and consumed by three downstream stages as an edited brief',
      a26.some(v => v.check === 'UNEDITED-PROMOTION'),
    ],
    [
      'IMP-222 SILENT on 08-20/21/22, whose v2s are real passes',
      ['2026-08-20', '2026-08-21', '2026-08-22'].every(
        d => !auditPromotion(root, d).some(v => v.check === 'UNEDITED-PROMOTION')
      ),
    ],
    [
      `IMP-222 the rule binds FORWARD from ${EDITORIAL_WORK_EFFECTIVE_FROM}: no pre-effective night is condemned by either new leg (IMP-125)`,
      fs
        .readdirSync(DB(root))
        .map(f => f.match(/^(\d{4}-\d{2}-\d{2})-v2\.md$/)?.[1])
        .filter((d): d is string => !!d && d < EDITORIAL_WORK_EFFECTIVE_FROM)
        .every(d =>
          !auditPromotion(root, d).some(
            v => v.check === 'UNEDITED-PROMOTION' || v.check === 'DROPPED-WORKLIST-BLOCK'
          )
        ),
    ],
    [
      'IMP-222 droppedProtectedBlocks FIRES on the real 08-25 v2 (7 blocks in v1.5, 0 in v2) naming WRITER DECLARATIONS and VALIDATION REPORT — the Morning Truth Gate\'s own worklist',
      (() => {
        const dr = droppedProtectedBlocks(real('2026-08-25', 'v1.5') ?? '', real('2026-08-25', 'v2') ?? '');
        return dr.includes('WRITER DECLARATIONS') && dr.includes('VALIDATION REPORT') && dr.length >= 4;
      })(),
    ],
    [
      'IMP-222 …and is SILENT on 08-20/21/22, which retain their blocks — the mandate\'s own both-directions receipt',
      ['2026-08-20', '2026-08-21', '2026-08-22'].every(
        d => droppedProtectedBlocks(real(d, 'v1.5') ?? '', real(d, 'v2') ?? '').length === 0
      ),
    ],
    [
      'IMP-222 the protected set is DERIVED, not decorative: every block still appears in the consumer script that makes it load-bearing',
      PROTECTED_BLOCKS.every(b => {
        const src = RD(path.join(root, b.consumer));
        return !!src && src.includes(b.name);
      }),
    ],
    [
      'IMP-222 a v2 that ADDS blocks is never accused — the Editor may write, it may only not silently discard',
      droppedProtectedBlocks('<!-- COUNTER-CASE -->', '<!-- COUNTER-CASE -->\n<!-- MODEL-LOCKED -->').length === 0,
    ]
  );

  // ── ESC-020 · --unedited-promotion (2026-08-26 handoff Stage 3) ─────────────────────────────
  // Held-out: 08-26 is the night that matches the stated condition (file md5 equal, no editor log).
  // 08-25 on disk does NOT (stamp claimed identity; sizes 80,591 vs 41,340; bodies diverge) — a
  // detector that fired on 08-25 would be reading the log, not the bytes. 08-19 is the healthy
  // pre-08-20 night with a real editor log. Synthetics cover the 08-25-*claimed* shape and the
  // honest-stamp silence.
  const upTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-up-'));
  const upBriefs = path.join(upTmp, 'daily-briefs');
  fs.mkdirSync(upBriefs, { recursive: true });
  const UP_BODY = '# Tuesday, January 6, 2026\n\nThe same brief.\n<!-- ==== WRITER DECLARATIONS ==== -->\nkept\n';
  fs.writeFileSync(path.join(upBriefs, '2026-01-06-v1.5.md'), UP_BODY);
  fs.writeFileSync(path.join(upBriefs, '2026-01-06-v2.md'), UP_BODY);
  const fireNoLog = uneditedPromotion(upTmp, '2026-01-06');
  fs.writeFileSync(
    path.join(upBriefs, '2026-01-06-editor-log.md'),
    'EDITOR VERSION: self-heal-critic-2026-01-06\nzero modifications, all mechanical gates inherit EXIT 0\n'
  );
  const fireRubberStamp = uneditedPromotion(upTmp, '2026-01-06');
  fs.writeFileSync(
    path.join(upBriefs, '2026-01-06-editor-log.md'),
    'artifact line: v2-SELFHEAL (unedited promotion)\nstatus: RED\n'
  );
  const silentHonest = uneditedPromotion(upTmp, '2026-01-06');
  fs.writeFileSync(path.join(upBriefs, '2026-01-07-v1.5.md'), UP_BODY);
  fs.writeFileSync(path.join(upBriefs, '2026-01-07-v2.md'), UP_BODY.replace('same brief', 'edited brief'));
  const silentEdited = uneditedPromotion(upTmp, '2026-01-07');
  fs.rmSync(upTmp, { recursive: true, force: true });

  const hcSnap = path.join(root, 'system', 'task-bodies-snapshot', 'pipeline-health-check', 'SKILL.md');
  const hcSnapTxt = fs.existsSync(hcSnap) ? fs.readFileSync(hcSnap, 'utf8') : '';

  rows.push(
    [
      'ESC-020 --unedited-promotion FIRES on the REAL 2026-08-26 v2 — md5-identical to v1.5, no editor log',
      uneditedPromotion(root, '2026-08-26').some(v => v.check === 'UNEDITED-PROMOTION'),
    ],
    [
      'ESC-020 SILENT on 2026-08-19 — pre-08-20 night, real editor log, bodies differ (held-out healthy)',
      uneditedPromotion(root, '2026-08-19').length === 0,
    ],
    [
      'ESC-020 SILENT on 2026-08-20 — real Editor pass, bodies differ',
      uneditedPromotion(root, '2026-08-20').length === 0,
    ],
    [
      'ESC-020 2026-08-25 on disk is NOT the identity case (stamp lied; md5/body both DIFF) — SILENT here is a judgement, not a miss',
      uneditedPromotion(root, '2026-08-25').length === 0 &&
        (real('2026-08-25', 'v1.5') ?? '').length !== (real('2026-08-25', 'v2') ?? '').length,
    ],
    [
      'ESC-020 FIRES on a byte-identical pair with no editor log (the 08-25-claimed shape)',
      fireNoLog.some(v => v.check === 'UNEDITED-PROMOTION'),
    ],
    [
      'ESC-020 FIRES on a byte-identical pair whose log is self-heal-critic without the SELFHEAL stamp (rubber stamp)',
      fireRubberStamp.some(v => v.check === 'UNEDITED-PROMOTION'),
    ],
    [
      'ESC-020 SILENT once the log carries v2-SELFHEAL — honest unedited promotion is legal',
      silentHonest.length === 0,
    ],
    [
      'ESC-020 SILENT on a genuinely edited v2 (one reader-facing word changed)',
      silentEdited.length === 0,
    ],
    [
      'ESC-020 self-heal-critic / SELF-HEAL is NOT the honest stamp — hasHonestSelfhealStamp rejects both',
      !hasHonestSelfhealStamp('EDITOR VERSION: self-heal-critic-2026-08-25') &&
        !hasHonestSelfhealStamp('# Editor Log — 2026-08-21 (SELF-HEAL, Critic-invoked)') &&
        hasHonestSelfhealStamp('v2-SELFHEAL (unedited promotion)'),
    ],
    [
      'ESC-020 health-check snapshot uses current names (v1-pre-quality-gate / v1.5), not the stale -v1.md existence check',
      /v1-pre-quality-gate/.test(hcSnapTxt) &&
        !/daily-briefs\/YYYY-MM-DD-v1\.md/.test(hcSnapTxt) &&
        hcSnapTxt.includes('--unedited-promotion'),
    ]
  );

  // ── IMP-224 · THE DOWNSTREAM CONTRACT (08-25 mandate #3c, re-issued as 08-26 mandate #2c) ─────
  // The FIRE leg runs with the effective date wound back to the real night, because the rule binds
  // from 2026-08-27 forward and the receipt is 2026-08-26. Detection is proved on the real board;
  // emission still refuses to condemn the archive.
  const dl26 = auditDownstreamLabel(root, '2026-08-26', '2026-08-26');
  rows.push(
    [
      'IMP-224 the real 2026-08-26 was a NO-EDITOR-PASS night by the artifact, not by inference (v2 present, reader body identical to v1.5)',
      noEditorPass(root, '2026-08-26'),
    ],
    [
      `IMP-224 FIRES on the real 2026-08-26 board — ${dl26.map(v => v.message.match(/^DOWNSTREAM CONTRACT BROKEN — (\S+)/)?.[1]).join(', ') || 'NOBODY'} reported a result and none carried the label`,
      dl26.length >= 2 && dl26.every(v => v.check === 'UNLABELLED-FALLBACK'),
    ],
    [
      'IMP-224 SILENT on 08-20/21/22 — real Editor passes owe no label, and a gate that labels an edited brief is a lie in the other direction',
      ['2026-08-20', '2026-08-21', '2026-08-22'].every(
        d => auditDownstreamLabel(root, d, '2026-08-01').length === 0
      ),
    ],
    [
      `IMP-224 the rule binds FORWARD from ${DOWNSTREAM_LABEL_EFFECTIVE_FROM}: the same real 2026-08-26 board is NOT condemned through the public path`,
      auditDownstreamLabel(root, '2026-08-26').length === 0,
    ],
    [
      'IMP-224 SILENT once the label is present — the remedy is one string and it must never be punished',
      (() => {
        const r = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-label-'));
        fs.mkdirSync(path.join(r, 'daily-briefs'), { recursive: true });
        const D2 = '2026-08-27';
        fs.writeFileSync(path.join(r, 'daily-briefs', `${D2}-v1.5.md`), '# brief\nbody\n');
        fs.writeFileSync(path.join(r, 'daily-briefs', `${D2}-v2.md`), '# brief\nbody\n');
        const board = path.join(r, 'daily-briefs', `${D2}-pipeline-status.md`);
        fs.writeFileSync(board, `2026-08-26T23:45:00Z | brief-light | out.md | SUCCESS | built\n`);
        const before = auditDownstreamLabel(r, D2).length;
        fs.writeFileSync(board, `2026-08-26T23:45:00Z | brief-light | out.md | SUCCESS | built · ${DOWNSTREAM_LABEL}\n`);
        const after = auditDownstreamLabel(r, D2).length;
        return before === 1 && after === 0;
      })(),
    ],
    [
      'IMP-224 a stage that NEVER REPORTED is not accused here — an absent slot is pipeline-slot-attendance\'s finding; one fact, one alarm',
      (() => {
        const r = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-label2-'));
        fs.mkdirSync(path.join(r, 'daily-briefs'), { recursive: true });
        const D2 = '2026-08-27';
        fs.writeFileSync(path.join(r, 'daily-briefs', `${D2}-v1.5.md`), '# brief\nbody\n');
        fs.writeFileSync(
          path.join(r, 'daily-briefs', `${D2}-pipeline-status.md`),
          `2026-08-26T23:45:00Z | brief-light | CANARY | WRITE-OK\n`
        );
        return auditDownstreamLabel(r, D2).length === 0;
      })(),
    ]
  );

  // ── IMP-164 (08-12 Critic mandate #2, RC1+RC3): --finalize + MISSING-EDITOR-LOG ─────────────
  // Both directions, on a throwaway tree with REAL files. The fixture dates are 2026-08-12+ so the
  // effective-from window is exercised, and a pre-window date proves the archive stays untouched.
  {
    const F = fs.mkdtempSync(path.join(os.tmpdir(), 'ehg-final-'));
    fs.mkdirSync(path.join(F, 'daily-briefs'), { recursive: true });
    const db = path.join(F, 'daily-briefs');
    const W = (n: string, b: string) => fs.writeFileSync(path.join(db, n), b);
    const w = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    const brief = (words: number) =>
      `# ▸ THE SIX\n\n## Markets & Macro\n\n${w(words)}\n\n${w(words)}\n\n` +
      `## Companies & Crypto\n\n${w(words)}\n\n${w(words)}\n\n` +
      `## AI & Tech\n\n${w(words)}\n\n${w(words)}\n\n` +
      `## Geopolitics\n\n${w(words)}\n\n${w(words)}\n\n# ▸ THE TAKE\n\n${w(900)}\n`;

    // (a) the 08-12 shape: promoted v2, orphaned scratch, NO editor log.
    W('2026-08-12-v2.md', brief(170));
    W('2026-08-12-v2.working.md', brief(170));
    const a = auditPromotion(F, '2026-08-12').map(v => v.check).sort();
    const finA = finalize(F, '2026-08-12');
    rows.push([
      'IMP-164 --audit-promotion FIRES on MISSING-EDITOR-LOG *and* ORPHANED-SCRATCH together (the real 08-12 shape)',
      a.length === 2 && a.includes('MISSING-EDITOR-LOG') && a.includes('ORPHANED-SCRATCH'),
    ]);
    rows.push([
      'IMP-164 --finalize REFUSES a night with no editor log (exit 1) after retiring the husk',
      finA.code === 1 && finA.lines.some(l => l.includes('MISSING-EDITOR-LOG')),
    ]);
    rows.push([
      'IMP-164 --finalize retires the working file even though unlink is EPERM on this mount (no *-v2.working.md survives)',
      !fs.existsSync(path.join(db, '2026-08-12-v2.working.md')),
    ]);

    // (b) write the log → finalize passes, and --audit-promotion goes silent. Idempotent re-run.
    W('2026-08-12-editor-log.md', 'GATE 16: nothing cut. Pass complete.\n');
    const finB = finalize(F, '2026-08-12');
    rows.push([
      'IMP-164 --finalize PASSES the moment the working file is gone and a non-empty editor log exists',
      finB.code === 0 && finB.lines.some(l => l.includes('MECHANICAL GATE OUTPUT')),
    ]);
    rows.push([
      'IMP-164 --finalize is IDEMPOTENT (a second run still exits 0)',
      finalize(F, '2026-08-12').code === 0,
    ]);
    rows.push([
      'IMP-164 --audit-promotion SILENT once both conditions hold',
      auditPromotion(F, '2026-08-12').length === 0,
    ]);

    // (c) mandate #1's cut order, enforced at the chokepoint: a majority breach with no override.
    W('2026-08-13-v2.md', brief(210)); // 8/8 units at 210 → 8 over, 240 recoverable
    W('2026-08-13-editor-log.md', 'GATE 16: cut C&C-3 whole.\n');
    const finC = finalize(F, '2026-08-13');
    rows.push([
      'IMP-164/163 --finalize REFUSES to close a night with 8/8 units over hard and no LENGTH-OVERRIDE',
      finC.code === 1 && finC.lines.some(l => l.includes('SIX-UNIT-HARD-BREACH')),
    ]);
    fs.appendFileSync(path.join(db, '2026-08-13-editor-log.md'), 'LENGTH-OVERRIDE: needed 194, surplus 240, cut whole anyway because X.\n');
    rows.push([
      'IMP-164/163 …and ALLOWS it once LENGTH-OVERRIDE puts the arithmetic on the record',
      finalize(F, '2026-08-13').code === 0,
    ]);

    // (d) SILENT mid-pass, and SILENT on the archive (pre-effective-from), both unchanged.
    W('2026-08-14-v2.working.md', brief(170)); // no v2 → live Editor
    W('2026-07-20-v2.md', brief(170)); // archive night, no log, no husk
    rows.push([
      'IMP-164 SILENT mid-pass (working file, no v2) — --liveness still owns that window',
      auditPromotion(F, '2026-08-14').length === 0,
    ]);
    rows.push([
      'IMP-164 SILENT on a pre-2026-08-12 night with no editor log — the rule binds forward, never backward (IMP-125)',
      auditPromotion(F, '2026-07-20').length === 0,
    ]);
    fs.rmSync(F, { recursive: true, force: true });
  }

  console.log('editor-handoff-gate --selftest');
  for (const [label, ok] of rows) console.log(`  ${ok ? '✓' : '✗'} ${label}`);

  const ok = rows.every(([, x]) => x);
  if (ok) {
    console.log(
      '\n✅ SELFTEST PASS — liveness is read from the artifact, not from a stopwatch: the gate bites 07-14/07-13/07-11, stays silent on 07-10/07-12, and never deadlocks a dead Editor.'
    );
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  for (const x of [...silent10, ...silent12])
    console.error(
      `  unexpected on a clean night: ${x.check} — ${x.message.slice(0, 120)}`
    );
  return 1;
}

/**
 * 🔴 THE DOWNSTREAM CONTRACT — THE BRIEF ALWAYS SHIPS; IT SHIPS LABELLED (IMP-224).
 *
 * 08-25 Critic mandate #3c, re-issued as 08-26 mandate #2c. THREE nights running the Critic has
 * asked for this one line, and the reason is the plainest fact in the whole file: `brief-light`,
 * `brief-email` and `brief-morning` all consume v2, all fall back to v1.5 with no hard stop, and
 * for six nights the reader received an unedited brief while NO ARTIFACT ANYWHERE SAID SO. On
 * 2026-08-26 it got worse in the way 08-25 predicted — a v2 existed, byte-identical to v1.5, and
 * brief-light's own SUCCESS line recorded the identity as a RECEIPT OF SAFETY ("BYTE-IDENTICAL to
 * v1.5, so tonight's race is closed by receipt") rather than as the absence of an Editor.
 *
 * A LABEL, NOT A BLOCK (Constitution I). This never stops a brief; it stops a brief being
 * MISREPRESENTED as edited.
 */
export const DOWNSTREAM_LABEL = 'INPUT: v1.5 — NO EDITOR PASS';
export const DOWNSTREAM_STAGES = ['brief-light', 'brief-email', 'brief-morning'];
export const DOWNSTREAM_LABEL_EFFECTIVE_FROM = '2026-08-27';

/** Was there an Editor pass at all? v2 absent, or v2 present with a reader body identical to v1.5. */
export function noEditorPass(root: string, date: string): boolean {
  const v2 = path.join(DB(root), `${date}-v2.md`);
  if (!fs.existsSync(v2)) return true;
  const b15 = readerBodyOf(path.join(DB(root), `${date}-v1.5.md`));
  const b2 = readerBodyOf(v2);
  return b15 !== null && b2 !== null && b15 === b2;
}

export function auditDownstreamLabel(
  root: string,
  date: string,
  effectiveFrom = DOWNSTREAM_LABEL_EFFECTIVE_FROM
): Violation[] {
  if (date < effectiveFrom) return []; // the rule binds forward, never backward (IMP-125)
  if (!noEditorPass(root, date)) return []; // a real pass owes no label
  const board = path.join(DB(root), `${date}-pipeline-status.md`);
  if (!fs.existsSync(board)) return [];
  const lines = fs.readFileSync(board, 'utf8').split('\n');
  const out: Violation[] = [];
  for (const stage of DOWNSTREAM_STAGES) {
    // Only a stage that CLAIMED to have produced something owes a label. A stage that never ran is
    // slot attendance's finding, not this one — one fact, one alarm.
    const own = lines.filter(l => (l.split('|')[1] || '').trim() === stage);
    const terminal = own.filter(l => !/^CANARY/i.test((l.split('|')[2] || '').trim()));
    if (!terminal.length) continue;
    if (terminal.some(l => l.includes(DOWNSTREAM_LABEL))) continue;
    out.push({
      check: 'UNLABELLED-FALLBACK',
      message:
        `DOWNSTREAM CONTRACT BROKEN — ${stage} reported a result for ${date} on a night with NO EDITOR PASS ` +
        `(${fs.existsSync(path.join(DB(root), `${date}-v2.md`)) ? 'v2 exists and is reader-body-identical to v1.5' : 'no v2 on disk'}) ` +
        `and its status line does not carry "${DOWNSTREAM_LABEL}". The brief always ships — it ships LABELLED. ` +
        `For six consecutive nights the reader received an unedited brief and no artifact anywhere said so; on ` +
        `2026-08-26 brief-light recorded the v1.5/v2 identity as a receipt of SAFETY. FIX: print the label in the ` +
        `status line AND in the artifact.`,
    });
  }
  return out;
}

/**
 * --scan-promotions [N] — THE WORLD-STATE CHANNEL FOR THIS GATE (IMP-222).
 *
 * The selftest asks "does the code work". This asks "is the record in contract", over the last N
 * promoted nights. They are different questions with different fixes, and fusing them is what put
 * ten green improvements behind one red Editor. Exit 1 means the WORLD is out of contract; the
 * ledger carries it as a `world:` leg, which prints every morning and never reds the registry.
 */
export function scanPromotions(root: string, days: number, today = new Date()): { date: string; v: Violation[] }[] {
  const out: { date: string; v: Violation[] }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(today.getTime() - (i - 1) * 86400000).toISOString().slice(0, 10);
    if (!fs.existsSync(path.join(DB(root), `${d}-v2.md`))) continue;
    const v = auditPromotion(root, d);
    if (v.length) out.push({ date: d, v });
  }
  return out.reverse();
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  const root = process.cwd();

  const spI = argv.indexOf('--scan-promotions');
  if (spI >= 0) {
    const n = Number(argv[spI + 1]) || 7;
    const hits = scanPromotions(root, n);
    console.log(`editor-handoff-gate --scan-promotions ${n} — ${hits.length} night(s) out of contract`);
    for (const h of hits) for (const v of h.v) console.log(`   ✗ ${h.date} ${v.check}: ${v.message.slice(0, 220)}`);
    if (!hits.length) console.log('   ✅ every promoted v2 in the window carries its editor log, its worklist blocks, and real editorial work.');
    process.exit(hits.length ? 1 : 0);
  }

  const upI = argv.indexOf('--unedited-promotion');
  if (upI >= 0) {
    const date = argv[upI + 1];
    if (!date || date.startsWith('--')) {
      console.error('usage: editor-handoff-gate.ts --unedited-promotion <DATE> [--strict]');
      process.exit(2);
    }
    const strict = argv.includes('--strict');
    const v = uneditedPromotion(root, date);
    console.log(
      `editor-handoff-gate --unedited-promotion ${date}${strict ? ' --strict' : ' (warn-only)'}`
    );
    if (!v.length) {
      console.log(`   ✅ ${date} — v2 is edited, or honestly stamped v2-SELFHEAL.`);
      process.exit(0);
    }
    for (const x of v) console.log(`   ✗ ${x.message}`);
    if (strict) {
      console.log('\n❌ UNEDITED-PROMOTION (strict) — exit 1. The daily canary treats this as RED.');
      process.exit(1);
    }
    console.log('\n⚠️  UNEDITED-PROMOTION (warn-only) — exit 0. Morning path never blocks the brief.');
    process.exit(0);
  }

  const modes = [
    '--can-self-heal',
    '--can-promote',
    '--audit',
    '--audit-promotion',
    '--audit-downstream-label',
    '--audit-nonproduction',
    '--finalize',
    '--liveness',
    '--qg-liveness',
  ];
  const i = argv.findIndex(a => modes.includes(a));
  if (i < 0 || !argv[i + 1] || argv[i + 1]!.startsWith('--')) {
    console.error(
      `usage: editor-handoff-gate.ts (${modes.join(' | ')}) <DATE> | --selftest`
    );
    process.exit(2);
  }
  const mode = argv[i]!;
  const date = argv[i + 1]!;

  // ── IMP-216: the scheduler reading. FLAG first, state dir as a convenience, else NOTHING —
  //    and NOTHING means UNKNOWN, never a guess. An unparseable value is a USAGE ERROR (exit 2):
  //    a typo must not be able to buy the gate's silence.
  const slrI = argv.indexOf('--scheduler-lastrun');
  const sdirI = argv.indexOf('--scheduler-state-dir');
  let reading: SchedulerReading | null = null;
  if (slrI >= 0) {
    const raw = argv[slrI + 1];
    if (!raw) {
      console.error(
        'usage: --scheduler-lastrun <ISO|NEVER>  (brief-editor.lastRunAt from list_scheduled_tasks)'
      );
      process.exit(2);
    }
    reading = parseSchedulerLastRun(raw);
    if (!reading) {
      console.error(
        `--scheduler-lastrun: cannot parse "${raw}". Give an ISO instant (2026-08-22T23:20:17.192Z) or the literal NEVER. Refusing to guess.`
      );
      process.exit(2);
    }
  } else {
    reading = readSchedulerStateDir(
      sdirI >= 0 && argv[sdirI + 1] ? argv[sdirI + 1]! : undefined
    );
  }

  // --now <ISO>: REPLAY ONLY. Every verdict in this file is a function of (board, disk, scheduler,
  // NOW), so a receipt that cannot pin NOW is not reproducible — and an unreproducible receipt is
  // how "the gate said ALLOWED" survives in a report long after the state that produced it is gone.
  // Loudly banner-ed, because a stale --now is a wrong verdict wearing a real one's clothes.
  const nowI = argv.indexOf('--now');
  let simulatedNow: Date | null = null;
  if (nowI >= 0) {
    const raw = argv[nowI + 1] ?? '';
    const d = new Date(raw);
    if (!/\d{4}-\d{2}-\d{2}T/.test(raw) || Number.isNaN(d.getTime())) {
      console.error(`--now: cannot parse "${raw}". Give an ISO instant.`);
      process.exit(2);
    }
    simulatedNow = d;
    console.log(
      `⚠️  SIMULATED CLOCK — --now ${d.toISOString()}. REPLAY ONLY: this verdict describes that instant, never this one. Do not act on it.`
    );
  }
  const NOW = () => simulatedNow ?? new Date();

  if (mode === '--finalize') {
    const r = finalize(root, date);
    console.log(`editor-handoff-gate --finalize ${date}`);
    for (const l of r.lines) console.log(l);
    console.log(
      r.code === 0
        ? '\n\u2705 FINALIZED — the Editor pass is closed and its receipt exists on disk.'
        : '\n\u274c NOT FINALIZED. Fix the line(s) above and re-run. An Editor that cannot finalize writes FAIL to its status line, not silence.'
    );
    process.exit(r.code);
  }

  if (mode === '--audit-downstream-label') {
    const v = auditDownstreamLabel(root, date);
    console.log(`editor-handoff-gate --audit-downstream-label ${date}`);
    if (!v.length) {
      console.log(
        noEditorPass(root, date)
          ? `   ✅ NO EDITOR PASS for ${date} and every downstream stage that reported says so.`
          : `   ✅ ${date} had a real Editor pass — no label owed.`
      );
      process.exit(0);
    }
    for (const x of v) console.log(`   ✗ ${x.check}: ${x.message}`);
    console.log(`\n   LABEL, NOT BLOCK — this never stops a brief (Constitution I). It stops a brief being called edited when it was not.`);
    process.exit(1);
  }

  if (mode === '--audit-promotion') {
    const v = auditPromotion(root, date);
    console.log(`editor-handoff-gate --audit-promotion ${date}`);
    for (const x of v) console.log(`   ✗ ${x.check} — ${x.message}`);
    if (v.length === 0) {
      console.log(
        '   ✓ no working file beside the promoted v2 (Brief_Editor rule 6 satisfied)'
      );
      process.exit(0);
    }
    process.exit(1);
  }

  if (mode === '--audit-nonproduction') {
    const a = auditNonProduction(root, date, { reading, now: NOW() });
    console.log(`editor-handoff-gate --audit-nonproduction ${date}`);
    console.log(`   scheduler: ${a.sched.state} — ${a.sched.reason}`);
    console.log(`   disk: ${a.live.state} — ${a.live.reason}`);
    for (const x of a.violations) console.log(`   ✗ [${x.check}] ${x.message}`);
    if (a.verdict === 'UNKNOWN') {
      console.log(
        `\n❓ NON-PRODUCTION UNKNOWN (exit ${SELF_HEAL_UNKNOWN_EXIT}) — no scheduler reading, so "the Editor never fired" and "the Editor fired and produced nothing" are the same string here. **THIS IS NOT A CLEAN BILL OF HEALTH.** Re-run with --scheduler-lastrun <ISO|NEVER> (list_scheduled_tasks → brief-editor.lastRunAt).`
      );
      process.exit(SELF_HEAL_UNKNOWN_EXIT);
    }
    if (a.verdict === 'NON-PRODUCTION') {
      console.log(
        '\n❌ EDITOR NON-PRODUCTION — 🔴 for the health report. Name it in the email AND send the alarm. Do not block the brief.'
      );
      process.exit(1);
    }
    console.log(
      a.verdict === 'NOT-FIRED'
        ? '\n✅ NOT THIS GATE\'S ALARM — the slot did not fire this cycle. A slot that never started is `pipeline-slot-attendance` (IMP-207), not non-production. Check that report.'
        : a.verdict === 'IN-FLIGHT'
          ? `\n✅ IN FLIGHT — fired and silent INSIDE the ${EDITOR_FIRE_BAND_MIN_MIN}–${EDITOR_FIRE_BAND_MAX_MIN} min band. Silence here is a delay, not a death. Re-poll past T+${EDITOR_FIRE_BAND_MAX_MIN}.`
          : '\n✅ THE EDITOR PRODUCED — it left a trace (board line and/or artifact). The artifact guards own the rest.'
    );
    process.exit(0);
  }

  if (mode === '--qg-liveness') {
    const l = qgLiveness(root, date);
    console.log(`editor-handoff-gate --qg-liveness ${date}`);
    console.log(`   state: ${l.state} — ${l.reason}`);
    if (l.state === 'ALIVE') {
      console.log(
        '\n⏳ QUALITY GATE ALIVE — WAIT. Do NOT inline-QG. Do NOT seed a passthrough v1.5.'
      );
      console.log(
        '   (2026-08-03: the guard called EXPIRED on a QG with 14 minutes left to run and'
      );
      console.log(
        '    seeded a v1.5 byte-identical to v1. A slow QG is not a crashed QG.)'
      );
      process.exit(1);
    }
    console.log(
      l.state === 'QUIET'
        ? '\n✅ QG QUIET — it finished or stopped. Proceed; if you seed a v1.5, declare INLINE-QG SEEDED: in the status line.'
        : '\n✅ NO QG CANARY — the QG has not started.'
    );
    process.exit(0);
  }

  if (mode === '--liveness') {
    const l = liveness(root, date, NOW());
    const s = schedulerLiveness(root, date, reading, NOW());
    console.log(`editor-handoff-gate --liveness ${date}`);
    console.log(`   state: ${l.state} — ${l.reason}`);
    console.log(`   scheduler: ${s.state} — ${s.reason}`);
    if (l.state === 'ALIVE') {
      console.log(
        '\n⏳ EDITOR ALIVE — WAIT. Do not promote, do not self-heal. Re-poll in 3 minutes.'
      );
      process.exit(1);
    }
    if (l.state === 'QUIET') {
      console.log(
        '\n✅ EDITOR QUIET — the artifact has stopped changing. Check --can-promote.'
      );
      process.exit(0);
    }
    // ABSENT. IMP-216: this is the branch that answered "is there a file?" and had its answer read
    // as "is the process alive?". It is the ONLY branch with no artifact evidence, so it is the
    // only one that may now refuse to answer.
    if (s.state === 'FIRED-AND-SILENT') {
      console.log(
        '\n✅ EMPTY-BODY — scheduler fired this cycle, no STEP-0 CANARY, no artifact. Not in-flight: a live Editor writes a canary at STEP 0. Check --can-self-heal.'
      );
      process.exit(0);
    }
    if (s.state === 'UNKNOWN') {
      console.log(
        `\n❓ LIVENESS UNKNOWN (exit ${SELF_HEAL_UNKNOWN_EXIT}) — NO ARTIFACT AND NO SCHEDULER READING. This is not "the Editor is absent"; it is "nothing here can tell you". Re-run with --scheduler-lastrun <ISO|NEVER>. NEVER read this as permission.`
      );
      process.exit(SELF_HEAL_UNKNOWN_EXIT);
    }
    console.log('\n✅ NO EDITOR ARTIFACT — check --can-self-heal.');
    process.exit(0);
  }

  if (mode === '--can-self-heal') {
    const d = selfHealDecision(root, date, { reading, now: NOW() });
    console.log(`editor-handoff-gate ${mode} ${date}`);
    console.log(`   scheduler: ${d.sched.state} — ${d.sched.reason}`);
    console.log(`   branch: ${d.branch}`);
    for (const x of d.violations) console.log(`   ✗ [${x.check}] ${x.message}`);
    if (d.verdict === 'ALLOWED') {
      const why =
        d.branch === 'empty-body'
          ? 'EMPTY-BODY: lastRunAt this cycle, no STEP-0 CANARY, no terminal. The scheduler fired and the session did nothing (2026-08-20 --- wrapped pointer). Self-heal ALLOWED.'
          : d.branch === 'never'
            ? 'NEVER-FIRED: the slot did not start this cycle. Self-heal ALLOWED.'
            : d.branch === 'terminated'
              ? 'TERMINATED: a SUCCESS/FAIL line is already on the board. Self-heal ALLOWED (the pass already ended).'
              : 'no live Editor, no Editor artifact on disk, and the scheduler positively rules out a live process.';
      console.log(`✅ ${VERDICT_TOKEN.ALLOWED} — ${why}`);
    } else if (d.verdict === 'UNKNOWN')
      console.log(
        `❓ ${VERDICT_TOKEN.UNKNOWN} — THE GATE REFUSES TO ANSWER. Nothing on the board or the disk distinguishes "never fired" from "fired and produced nothing", and no scheduler reading was supplied. 2026-08-22: this exact state returned EXIT 0 "SELF-HEAL ALLOWED" over a live Editor. Re-run with --scheduler-lastrun <ISO|NEVER>. **UNKNOWN IS NOT ALLOWED.**`
      );
    else console.log(`\n❌ ${d.violations.length} violation(s).`);
    console.log(`\nVERDICT: ${d.token} (exit ${d.exitCode}) branch=${d.branch}`);
    process.exit(d.exitCode);
  }

  const v = mode === '--can-promote' ? canPromote(root, date) : auditHandoff(root, date);

  console.log(`editor-handoff-gate ${mode} ${date}`);
  if (!v.length) {
    console.log(
      mode === '--can-promote'
        ? '✅ PROMOTION ALLOWED — the Editor has stopped writing, past the floor, no hold.'
        : '✅ HANDOFF CLEAN.'
    );
    process.exit(0);
  }
  for (const x of v) console.log(`   ✗ [${x.check}] ${x.message}`);
  console.log(`\n❌ ${v.length} violation(s).`);
  process.exit(1);
}

if (process.argv[1] && process.argv[1].includes('editor-handoff-gate')) main();
