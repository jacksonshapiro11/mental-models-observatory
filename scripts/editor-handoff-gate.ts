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
function editorLines(root: string, date: string): EditorLine[] {
  const out: EditorLine[] = [];
  for (const raw of statusLines(root, date)) {
    if (!/brief-editor/i.test(raw)) continue;
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

/** May the Critic rebuild v2 from a v1.5 copy? Strictly narrower than promotion. */
export function canSelfHeal(
  root: string,
  date: string,
  now = new Date()
): Violation[] {
  const v: Violation[] = [];
  const lines = editorLines(root, date);
  const terminal = lines.find(l => l.kind === 'SUCCESS' || l.kind === 'FAIL');
  const canary = lines.find(l => l.kind === 'CANARY');
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
    if (!/brief-quality-gate|\|\s*quality-gate\s*\|/i.test(raw)) continue;
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

  for (const d of [alive, dead, early, held, ceiling, husk, full, huskEarly])
    fs.rmSync(d, { recursive: true, force: true });

  const rows: [string, boolean][] = [
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

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  const root = process.cwd();
  const modes = [
    '--can-self-heal',
    '--can-promote',
    '--audit',
    '--liveness',
    '--qg-liveness',
  ];
  const i = argv.findIndex(a => modes.includes(a));
  if (i < 0 || !argv[i + 1]) {
    console.error(
      `usage: editor-handoff-gate.ts (${modes.join(' | ')}) <DATE> | --selftest`
    );
    process.exit(2);
  }
  const mode = argv[i]!;
  const date = argv[i + 1]!;

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
    const l = liveness(root, date);
    console.log(`editor-handoff-gate --liveness ${date}`);
    console.log(`   state: ${l.state} — ${l.reason}`);
    if (l.state === 'ALIVE') {
      console.log(
        '\n⏳ EDITOR ALIVE — WAIT. Do not promote, do not self-heal. Re-poll in 3 minutes.'
      );
      process.exit(1);
    }
    console.log(
      l.state === 'QUIET'
        ? '\n✅ EDITOR QUIET — the artifact has stopped changing. Check --can-promote.'
        : '\n✅ NO EDITOR ARTIFACT — check --can-self-heal.'
    );
    process.exit(0);
  }

  const v =
    mode === '--can-self-heal'
      ? canSelfHeal(root, date)
      : mode === '--can-promote'
        ? canPromote(root, date)
        : auditHandoff(root, date);

  console.log(`editor-handoff-gate ${mode} ${date}`);
  if (!v.length) {
    console.log(
      mode === '--can-self-heal'
        ? '✅ SELF-HEAL ALLOWED — no live Editor, no Editor artifact on disk.'
        : mode === '--can-promote'
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
