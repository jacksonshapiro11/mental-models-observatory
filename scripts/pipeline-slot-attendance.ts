#!/usr/bin/env node --experimental-strip-types
/**
 * pipeline-slot-attendance.ts — THE ROLL CALL. (2026-08-21 Critic mandate #1, 🔴 RC3,
 * E-PIPELINE-EDITOR-NONFIRE-01 NEW/EMERGENCY.)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS.
 *
 * **A task that never starts writes no canary, so the canary cannot detect its own absence.**
 *
 * On 2026-08-21 the scheduled `brief-editor` slot NEVER FIRED. Not slow — absent. Zero lines on
 * `daily-briefs/2026-08-21-pipeline-status.md`: no CANARY, no SUCCESS, no FAIL, no v2.working, no
 * EDITOR-HOLD. `editor-handoff-gate --can-self-heal` returned EXIT 0 on three polls (23:31/23:32/
 * 23:34Z) and the Critic ran the Editor's pass itself at 23:40:32Z.
 *
 * Every liveness instrument in this repo is built to separate *slow* from *dead*, and every one of
 * them starts from a line the task wrote:
 *   editor-handoff-gate `liveness()`   — the working file's mtime, read AFTER a CANARY
 *   editor-handoff-gate `qgLiveness()` — the QG's artifacts, read AFTER a CANARY
 *   RACE GUARD / OWED-EDITOR GUARD     — branch on the board's brief-editor lines
 *   pipeline-integrity-gate            — classifies the chain from the artifacts on disk
 * A stage that never executed produces neither a line nor an artifact, so it is invisible to all of
 * them in exactly the same way an on-time stage would be if it were still thinking. IMP-072 is the
 * near-miss twin: there the Editor RAN and forgot its line, and the fix was to read completion from
 * the artifact. Here there is no artifact either, because there was no pass.
 *
 * THE PRIMITIVE: **absence is only detectable against an EXPECTATION.** Every other guard reads what
 * IS on the board. This one reads what SHOULD BE — the evening slot list in
 * `system/Pipeline_Controller.md` — and reports the difference. It is the only check in the stack
 * whose input is a roster rather than a record.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FALSE-ALARM DISCIPLINE — three deliberate blindnesses, each one paid for.
 *
 * The IMP-174/TREE lesson, verbatim: "a rule that manufactures a RED every night does not raise the
 * alarm — it teaches the next session to skim it." The IMP-200/201 false-alarm class says the same
 * thing one layer down. A roll call is the single easiest gate in this repo to turn into noise, so:
 *
 *  (1) EVENING SLOTS ONLY, FOR THIS BRIEF DATE. `{date}-pipeline-status.md` is NOT one cycle's
 *      board. Pipeline_Controller L52-54 splits the date convention: evening tasks use today+1,
 *      DAYTIME tasks (intel-sweep, system-update, daily-improvement, pipeline-health-check) use
 *      today. So the 2026-08-21 board legitimately carries `intel-sweep-4/5/6` rows belonging to the
 *      08-20 cycle — six of them, three of them CORRECTION lines arguing about precisely this. The
 *      roster is built ONLY from the "Evening Sequence" table, so a correctly-routed daytime row can
 *      neither be flagged as absent nor counted as attendance. Flagging correct routing as absence
 *      is the fastest way to make this file worthless.
 *
 *  (2) NOT-YET-DUE IS NOT ABSENT. A slot is eligible for the roll call only once its scheduled ET
 *      time PLUS the grace window has passed relative to --now. GRACE_MIN is not chosen: it is the
 *      watchdog's own documented window (Pipeline_Controller L195, "scheduled time + 10-minute grace
 *      window has passed AND whose status record is missing OR FAIL").
 *
 *  (3) NEVER-OBSERVED SLOTS ARE DROPPED, AND THE ARCHIVE DECIDES WHICH. The Evening Sequence table
 *      documents THIRTEEN task IDs. Measured on the trailing 20 real boards in this repo:
 *          signal-discovery-draft 20/20 · cc-predraft 20/20 · take-draft 20/20 · brief-draft 20/20
 *          brief-quality-gate 20/20 · brief-editor 20/20 · brief-critic 20/20 · brief-light 20/20
 *          brief-email 20/20 · brief-feedback 20/20
 *          brief-validate-mechanical 0/20 · brief-feedback-2 0/20 · brief-feedback-3 0/20
 *      The last three have NEVER written a line. `brief-validate-mechanical` is a mechanical script
 *      folded into the Editor's own pass (its result is reported inside the brief-editor SUCCESS
 *      line as "validate-brief PASS"), and the feedback-2/3 slots are the same documented-but-
 *      unregistered drift Pipeline_Controller L201 already names for `pipeline-watchdog`: "prose
 *      describing a task that does not run." Rostering them would print three MISSING-SLOT lines
 *      EVERY NIGHT FOREVER, and the one night brief-editor went dark it would have been the fourth
 *      line in a list of four — indistinguishable from the wallpaper.
 *      This filter is COMPUTED, NOT HARDCODED: any of the three that ever writes a single line
 *      re-joins the roster automatically on the next run, and a slot that is absent tonight but
 *      present on any other board in the window stays rostered (which is why brief-editor is
 *      rostered on 08-21 even though its only line there is the Critic's self-heal).
 *
 * ATTENDANCE = ANY LINE, NOT THE CANARY. The CANARY is the intended marker, but the question this
 * file asks is "did this slot start?", and any line the task owns proves it did. Reading only
 * CANARY lines would have re-flagged 2026-08-21's brief-editor after the Critic's SELF-HEAL SUCCESS
 * line landed — a task that demonstrably ran, reported as absent. The task of a line is its SECOND
 * PIPE FIELD and nothing else (IMP-184); the prose on this board narrates every other stage by name
 * at length, so a substring match would score every slot present on the strength of gossip.
 *
 * ADVISORY, ALWAYS. Wired into `pipeline-health-check`, which must never block a brief. Exit 0 on
 * every dated run, whatever it finds. The output is the product; the exit code carries no verdict.
 *
 * Usage:
 *   node --experimental-strip-types scripts/pipeline-slot-attendance.ts <YYYY-MM-DD> [--now HH:MM] [--json]
 *   node --experimental-strip-types scripts/pipeline-slot-attendance.ts --selftest
 *
 * Exit: 0 always when given a date (advisory) · --selftest 0 pass / 1 fail · 2 usage.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// ONE definition of "which task owns this line", shared with the guards that act on it.
// Importing is deliberate and follows editor-handoff-gate's own import of sixUnitHardBreach: a
// second line parser here would be free to drift from the one the RACE/OWED-EDITOR/LIVENESS guards
// read, and this file's whole job is to agree with them about what a task's line looks like.
// IMP-184 is the receipt — the task is the SECOND PIPE FIELD, never a substring of the line.
// editor-handoff-gate only runs main() when invoked directly, so this import has no side effects.
import { lineTask } from './editor-handoff-gate.ts';

/** The watchdog's own grace window — Pipeline_Controller.md L195. Not a round number I picked. */
export const GRACE_MIN = 10;
/** How many trailing real boards decide whether a documented slot is a REAL slot. */
export const OBSERVATION_BOARDS = 20;

/**
 * 🔴 NO RETROACTIVE CONDEMNATION OF THE ARCHIVE (IMP-125's lesson; the same constant and the same
 * reason as `EDITOR_LOG_EFFECTIVE_FROM` in editor-handoff-gate). **A roll call binds from the day
 * the roll call ships, forward.**
 *
 * This leg was not theoretical — the first build of this file tripped it. Swept live across all 92
 * status boards in `daily-briefs/`, it printed MISSING-SLOT lines on **71 of them**, up to nine
 * slots deep on a single night. Not one is a defect: the CANARY protocol is RECENT, and the boards
 * from May through July predate the discipline of writing a line per stage. `2026-05-17` shows nine
 * missing slots because in May the stages did not write lines, not because nine stages died.
 *
 * MEASURED BOUNDARY, NOT A GUESS, AND THE SPLIT IS EXACT: of the 92 boards, 71 are dated before
 * 2026-08-01 and 21 are dated on or after it. The 71 boards that fire are EXACTLY the 71 pre-August
 * boards; all 21 in-window boards are SILENT, 08-21 included (its Critic self-heal line services the
 * slot). There is no board on either side of the line that disagrees with the line. That measurement
 * — not a preference — is what sets this date. The `--selftest` re-runs the sweep against the real
 * archive and FAILS if a single in-window board ever starts firing without cause, so the boundary
 * cannot quietly go stale.
 *
 * A dated run before this boundary reports EXEMPT and stays silent. That is the whole difference
 * between a liveness instrument and a machine for generating 71 red boards nobody will read.
 */
export const EFFECTIVE_FROM = '2026-08-01';

/**
 * CORPUS FREEZE — the selftest's evidence set ends here (added 2026-08-22 — IMP-211, RC7).
 *
 * A SELFTEST TESTS THE CODE. A GATE TESTS THE WORLD. This file's selftest was doing both, and the
 * second job broke the first the moment the gate did its job. The `[no-storm]` leg swept EVERY
 * board from EFFECTIVE_FROM to today and asserted that none fires outside a pinned set — so on
 * 2026-08-22, when the roll call correctly caught `intel-sweep-5` never firing on the 08-21
 * evening and wrote its alert file, the selftest went 59/62 and `verify-improvements` reported
 * IMP-207 as "gate FAILED". **THE GATE HAD JUST SUCCEEDED.** The two `[unterminated]` legs broke
 * the same way for the same reason: their reliability base rates are derived from the whole live
 * archive, so every new board moves the numbers the assertions pin.
 *
 * A CHECK WHOSE PASS/FAIL DEPENDS ON WHETHER A PRODUCTION INCIDENT IS CURRENTLY OUTSTANDING WILL
 * RED ON ITS OWN GOOD DAYS, and the ledger has now documented that class five times (IMP-195,
 * IMP-200, IMP-201, CARRY/TREE 2026-08-13, and this). The cost is never the false alarm; it is
 * that the next real red gets skimmed.
 *
 * Nothing is narrowed at RUNTIME: `rollCall` still reads every board including today's, and the
 * live catch is pinned below as its own assertion precisely so freezing the corpus can never
 * quietly blind the detector. Only the SELFTEST's expectation set is frozen. Advance this date
 * deliberately, and when you do, re-derive KNOWN_NOISY from the boards you just admitted.
 */
export const CORPUS_FROZEN_AT = '2026-08-21';

const DB = (root: string) => path.join(root, 'daily-briefs');
const boardPath = (root: string, date: string) =>
  path.join(DB(root), `${date}-pipeline-status.md`);

// ---------- ET wall clock ----------
// The schedule table is stated in ET ("Evening Sequence (all times ET)") and the boards carry three
// different timestamp forms — `…Z`, `…-04:00` and `…-0400`. Everything below normalises to a real
// instant and formats back to ET, so a run from a UTC sandbox and a run from Jackson's laptop agree.

interface ETParts { y: number; m: number; d: number; H: number; M: number; S: number }

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export function etParts(d: Date): ETParts {
  const p: Record<string, string> = {};
  for (const part of ET_FMT.formatToParts(d))
    if (part.type !== 'literal') p[part.type] = part.value;
  return {
    y: +p.year!, m: +p.month!, d: +p.day!,
    H: +p.hour!, M: +p.minute!, S: +p.second!,
  };
}

/** Minutes ET is offset from UTC at a given instant (negative: ET is behind). DST-correct. */
function etOffsetMin(atMs: number): number {
  const p = etParts(new Date(atMs));
  const asIfUTC = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S);
  return (asIfUTC - atMs) / 60000;
}

/** An ET wall-clock reading → the real instant. Two passes so DST transitions land correctly. */
export function etWallClock(dateISO: string, hh: number, mm: number): Date {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let ms = guess - etOffsetMin(guess) * 60000;
  ms = guess - etOffsetMin(ms) * 60000;
  return new Date(ms);
}

const pad = (n: number) => String(n).padStart(2, '0');
export function fmtET(d: Date): string {
  const p = etParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.H)}:${pad(p.M)} ET`;
}

/** BRIEF_DATE − 1 day: evening tasks run the NIGHT BEFORE the reading date (Controller L52). */
export function eveningDateOf(briefDate: string): string {
  const [y, m, d] = briefDate.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return t.toISOString().slice(0, 10);
}

/** The board's three timestamp dialects → an instant. Null for anything that is not one. */
export function parseTs(raw: string): Date | null {
  const m = raw.match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:?\d{2})?/
  );
  if (!m) return null;
  let zone = m[2] ?? 'Z';
  if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`; // -0400 → -04:00
  const d = new Date(`${m[1]}${zone}`);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- the roster, parsed from Pipeline_Controller.md ----------

export interface Slot {
  task: string;
  hh: number;      // 24h ET
  mm: number;
  clock: string;   // as printed in the table, e.g. "6:55 PM"
  /** derived minutes after 14:00 ET on BRIEF_DATE-1; NaN when falling back to the table */
  offsetMin?: number;
}

/**
 * Parse the "Evening Sequence" table.
 *
 * THE TABLE IS NOT CONTIGUOUS and a naive table reader gets four of the thirteen rows: the schedule
 * is interrupted three times by prose blocks (the CC PRE-DRAFT EXECUTION VERIFICATION note, GATE 6.5
 * and GATE 6.7), each of which ends the markdown table and starts a new one. So this scans every
 * LINE in the region between the two `####` headers for a schedule-row shape rather than trying to
 * parse a table. Region-bounded on purpose: the identical row shape appears in the Morning and
 * Daytime tables below, and those slots are not this file's business.
 */
export function eveningSlots(docRoot: string): Slot[] {
  const p = path.join(docRoot, 'system', 'Pipeline_Controller.md');
  if (!fs.existsSync(p)) return [];
  const src = fs.readFileSync(p, 'utf8');
  const start = src.indexOf('#### Evening Sequence');
  if (start < 0) return [];
  const after = src.slice(start + 1);
  const endRel = after.search(/^####\s/m);
  const region = endRel < 0 ? after : after.slice(0, endRel);

  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const line of region.split('\n')) {
    const m = line.match(
      /^\|\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/i
    );
    if (!m) continue;
    let hh = +m[1]! % 12;
    if (/pm/i.test(m[3]!)) hh += 12;
    const task = m[4]!;
    if (seen.has(task)) continue;
    seen.add(task);
    out.push({ task, hh, mm: +m[2]!, clock: `${m[1]}:${m[2]} ${m[3]!.toUpperCase()}` });
  }
  return out.sort((a, b) => a.hh * 60 + a.mm - (b.hh * 60 + b.mm));
}

// ---------- the board ----------

/**
 * Every task that owns at least one line on a board. Attendance is membership in this set.
 *
 * `asOf` — REPLAY ONLY, and it is opt-in for a reason. When supplied, a line counts only if its
 * timestamp is at or before that instant, which reconstructs the board as it stood at a past moment
 * (what `--now` is for, and how the 08-21 fire case is checked against the untouched bytes). When it
 * is NOT supplied — every live run — the whole file counts, because agent-written timestamps are
 * unreliable (editor-handoff-gate's `auditHandoff` says so in as many words) and a single
 * mis-clocked or wrong-timezone line dated in the future would otherwise let a live run report a
 * stage that plainly ran as missing. In live operation the two are identical: nothing on the board
 * is stamped after now. The filter can only ever REMOVE lines, so it is never a source of alarm —
 * and a line whose timestamp will not parse is KEPT, so a parse failure resolves toward silence.
 */
/** 🔴 A SELF-HEAL LINE IS PROOF OF ABSENCE, NOT ATTENDANCE (2026-08-21, second pass).
 *
 *  The roll call shipped this morning to catch E-PIPELINE-EDITOR-NONFIRE-01 and, run against the
 *  very night that produced it, reported **FULL ATTENDANCE**. The board's only `brief-editor` line is
 *
 *    2026-08-20T23:40:32Z | brief-editor | …-v2.md | SUCCESS | SELF-HEAL (Critic-invoked): the
 *    scheduled brief-editor slot left NO trace on this board — no CANARY, no SUCCESS, no FAIL…
 *
 *  — a line whose own payload states the slot never fired, counted as the slot firing. It carries
 *  `brief-editor` in field 2 because Brief_Editor's contract REQUIRES the self-heal line to be
 *  written in the covered slot's name (IMP-072), so the healer is indistinguishable from the healed
 *  by field 2 alone. This is E-GATE-SELFHEAL-AUDIT-PARADOX-01 one layer over: there `editorRan` and
 *  `selfHealLine` were satisfied by the same line; here `attended` and `absent` are.
 *
 *  So attendance is credited to the task that WROTE the line, and a SELF-HEAL payload proves the
 *  named slot did not write it. **It is not merely neutral evidence — it is the strongest absence
 *  signal on the board**, because some other task went and looked and said so in writing. */
export const SELFHEAL_RE = /\bSELF[- ]?HEAL(ED|ING)?\b/i;

/**
 * CALIBRATION (2026-08-21, measured over 1,483 status lines on 92 real boards).
 *
 * The first cut of this rule was `SELFHEAL_RE` alone — calibrated on n=1, the 08-21 line. Swept
 * over the archive it condemned **61 lines**, of which 26 were the task's only line that night.
 * Nearly all were false: a long payload that merely NARRATES a self-heal performed for some other
 * slot ("v2 (PROVISIONAL — self-heal…)", the Critic's own verdict line reciting what it covered)
 * is written BY a task that plainly ran. Mentioning a self-heal is not being one. The in-window
 * sweep missed this entirely because every one of those boards predates EFFECTIVE_FROM and is
 * exempt — the selftest would have gone green on a rule that was wrong 25 times out of 26.
 *
 * So a line is read as coverage only when it BOTH carries the self-heal token AND identifies the
 * covered slot as its own field 2, by one of two independent markers:
 *
 *   (a) an ABSENCE DECLARATION whose subject is field 2's task — "the scheduled brief-editor slot
 *       left NO trace"; the subject is the last task named in the 70 chars before the phrase; or
 *   (b) a HEALER MARKER — "Critic-invoked", "on behalf of", "in place of", "covering for" — which
 *       names an actor other than the slot as the author of the pass.
 *
 * MEASURED on the real archive: 3 condemnations, all three brief-editor, all three true. Two of
 * them (06-22, 06-24) also carry a genuine scheduled brief-editor line later the same night and
 * are therefore rescued by the both-lines guard in boardAttendance — net absences across 92
 * boards: ONE, 2026-08-21. Zero false positives.
 *
 * RESIDUAL BLINDNESS, stated with its denominator: 58 of the 61 self-heal-token lines carry
 * neither marker and are read as attendance. That is the safe reading for a narration line and
 * the WRONG reading for a terse self-heal that declares nothing — see selfHealBlindness(),
 * recomputed by the selftest so the number cannot rot silently.
 */
const ABSENCE_DECL_RE =
  /\b(never fired|never ran|never started|left NO trace|left no trace|did not fire|did ?n[o']t run|no trace on this board)\b/i;
const HEALER_MARKER_RE = /\b[a-z-]+-invoked\b|\bon behalf of\b|\bin place of\b|\bcovering for\b/i;
const TASK_NAME_RE = /\b(brief-[a-z0-9-]+|take-draft|cc-predraft|signal-discovery-draft)\b/g;

/** The slot an absence declaration is ABOUT: the last task named in the 70 chars before it. */
export function absenceSubject(raw: string): string | null {
  const m = raw.match(ABSENCE_DECL_RE);
  if (!m || m.index === undefined) return null;
  const before = raw.slice(Math.max(0, m.index - 70), m.index);
  const names = [...before.matchAll(TASK_NAME_RE)];
  return names.length ? names[names.length - 1]![1]! : null;
}

/** Field 2 of a line whose payload declares a self-heal OF THAT SLOT — a slot covered for. */
/**
 * IMP-214 — THE RETRACTION LEG THE 08-23 MANDATE REQUIRED AND WHICH NEVER SHIPPED.
 *
 * RECEIPT (2026-08-24 Critic, mandate #3 PARTIAL): `grep -n "CANARY-RETRACTION"
 * scripts/pipeline-slot-attendance.ts` returned NOTHING. The 08-23 board carries this real line:
 *
 *   2026-08-22T23:33:50Z | brief-critic | CANARY-RETRACTION | N/A | 🔴 I WROTE A FALSE
 *   brief-editor CANARY AND I AM RETRACTING IT
 *
 * Unhandled, it was read as SELF-HEAL COVERAGE FOR brief-critic — a task that plainly ran and was
 * not covering for anybody. A retraction is the opposite of both attendance and coverage: it is a
 * task saying *the line I wrote was false*. It must therefore (a) never count as coverage, and
 * (b) UNDO the canary it names, so a retracted canary cannot launder an absent slot into an
 * attended one. Measured: this takes archive-wide coverage from 5 lines to 4, and every one of
 * the 4 survivors is a genuine brief-editor self-heal (06-22, 06-24, 08-21, 08-23).
 */
export const RETRACTION_RE = /\bCANARY[- ]?RETRACTION\b/i;

export function selfHealedTask(raw: string): string | null {
  if (RETRACTION_RE.test(raw)) return null;  // a retraction is not coverage — IMP-214
  if (!SELFHEAL_RE.test(raw)) return null;
  const t = boardLineTask(raw);
  if (!t) return null;
  if (absenceSubject(raw) === t) return t;   // (a) it says so, about itself
  if (HEALER_MARKER_RE.test(raw)) return t;  // (b) it names someone else as the author
  return null;                               // narration by a task that ran — not coverage
}

/**
 * THE BRACKETED DIALECT. `lineTask` (editor-handoff-gate) requires field 0 to be a BARE timestamp,
 * so it silently drops the `[2026-06-23T23:58:04Z] | brief-editor | …` form. MEASURED: 12 such
 * lines across the 92 real boards — 8 of them brief-editor, 3 brief-morning, 1 brief-quality-gate.
 * To an attendance detector an unparsed line is an ABSENT SLOT: on 2026-06-24 the editor's genuine
 * scheduled pass is written in this dialect, and without this widening the night reads as a
 * non-fire. That is the false-alarm direction, and it was caught by the both-lines selftest.
 *
 * Widened HERE and not in editor-handoff-gate: that parser is another instrument's, mid-flight,
 * with its own semantics. The shared-parser gap is carried, not silently patched under it.
 */
const BOARD_TS_RE = /^\s*\[?\s*\d{4}-\d{2}-\d{2}T[\d:]+(?:Z|[+-]\d{2}:?\d{2})?\s*\]?\s*$/;
export function boardLineTask(raw: string): string | null {
  const direct = lineTask(raw);
  if (direct) return direct;
  const f = raw.split('|');
  if (f.length < 2 || !BOARD_TS_RE.test(f[0]!)) return null;
  return f[1]!.trim() || null;
}

/**
 * THE SECOND, INDEPENDENT ABSENCE PATH. The self-heal rule reads a line written IN the absent
 * slot's name. This one reads a line written ABOUT it by anybody: "the scheduled brief-editor slot
 * NEVER FIRED". Two instruments, two conventions — if the self-heal convention changes under us,
 * this one still fires.
 *
 * CONTRADICTION GUARD: testimony is overridden when the accused slot has a clean (non-self-heal)
 * line of its own. MEASURED over 92 boards: 6 testimony pairs, 2 correctly overridden (08-13
 * brief-morning, 08-17 brief-quality-gate — both plainly ran), leaving 4, all true: three
 * brief-draft non-fires in June and 2026-08-21 brief-editor, which BOTH instruments name.
 */
export function absenceTestimony(file: string, asOf?: Date): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(file)) return out;
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(l => boardLineTask(l));
  const visible = asOf
    ? rows.filter(l => { const ts = parseTs(l); return !ts || ts.getTime() <= asOf.getTime(); })
    : rows;
  for (const l of visible) {
    const accused = absenceSubject(l);
    if (!accused) continue;
    if (boardLineTask(l) === accused && !SELFHEAL_RE.test(l)) continue; // a slot reporting on itself
    const clean = visible.some(x => boardLineTask(x) === accused && !SELFHEAL_RE.test(x));
    if (clean) continue; // contradicted: the accused wrote a line of its own
    if (!out.has(accused)) out.set(accused, l.slice(0, 160));
  }
  return out;
}

/**
 * THE RESIDUAL, COMPUTED. Sweeps the real archive and counts self-heal-token lines by whether
 * `selfHealedTask` reads them as coverage, and how many of the ones it does NOT read are that
 * task's only line that night (i.e. where a miss would actually cost an alarm). Exported so the
 * blindness ships with a denominator instead of a memory of one.
 */
export function selfHealBlindness(root: string): {
  token: number; coverage: number; blind: number; blindSole: number; boards: number;
} {
  const dir = DB(root);
  const boards = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f)).sort()
    : [];
  let token = 0, coverage = 0, blind = 0, blindSole = 0;
  for (const b of boards) {
    const rows = fs.readFileSync(path.join(dir, b), 'utf8').split('\n').filter(l => boardLineTask(l));
    for (const l of rows) {
      if (!SELFHEAL_RE.test(l)) continue;
      token++;
      if (selfHealedTask(l)) { coverage++; continue; }
      blind++;
      const t = boardLineTask(l)!;
      if (!rows.some(x => boardLineTask(x) === t && x !== l)) blindSole++;
    }
  }
  return { token, coverage, blind, blindSole, boards: boards.length };
}

export function boardTasks(file: string, asOf?: Date): Set<string> {
  return boardAttendance(file, asOf).attended;
}

/** Attendance and self-heal coverage, read in one pass so they can never disagree. */
/**
 * IMP-218 — THE SIXTH INSTANCE OF THE FALSE-ALARM CLASS, AND THE FIRST TIME ITS CAUSE IS NAMED.
 *
 * For six sessions the roll call has demanded an ALARM EMAIL for `intel-sweep-5`, a task that ran
 * fine every one of those nights. Three previous fixes aimed at the EXPECTATION (narrow the
 * roster, freeze the corpus, scope to evening-only); the 08-23 attempt blinded the detector on the
 * 08-22 board and still fired in production on 08-24. None of them asked why.
 *
 * THE CAUSE, MEASURED ON THE REAL BOARDS TODAY — sibling tasks disagree about which board they
 * write to, and the roll call reads exactly one file:
 *
 *   board 2026-08-24 carries intel-sweep-4 and intel-sweep-6   (they use BRIEF_DATE = today + 1)
 *   board 2026-08-23 carries intel-sweep-5, and says so on the line itself:
 *     "2026-08-23T20:11:48Z | intel-sweep-5 | CANARY | WRITE-OK | BRIEF_DATE=2026-08-23 per
 *      Pipeline_Controller L54 (DAYTIME task = today, NOT today+1)"
 *
 * So `intel-sweep-5` is STRUCTURALLY absent from every board its siblings attend, forever, no
 * matter how well it runs. A roll call that reads one file is asking "did you write where I
 * looked?" when the question it means is **"did you run inside the window this board covers?"**
 *
 * THE FIX ASKS THE QUESTION IT MEANS. A board's window is [dayStart, dayStart + 24h) where
 * dayStart is 14:00 ET on BRIEF_DATE−1. That window is decisive here and not a fudge: 2026-08-23
 * 16:11 ET falls INSIDE board 08-24's window (08-23 14:00 → 08-24 14:00) and OUTSIDE board 08-23's
 * (08-22 14:00 → 08-23 14:00). The timestamp, not the filename, settles which cycle a run belongs
 * to. So a rostered slot with no line on its own board is rescued only by a line on an ADJACENT
 * board whose instant lands inside THIS board's window.
 *
 * WHY THIS CANNOT GO BLIND — the property that makes it safe. A slot that genuinely never ran has
 * no line in that window on ANY board, so it still fires. Self-heal coverage is excluded, so a
 * line written in the slot's name by somebody else still cannot buy attendance. The rescue can
 * only convert "wrote to the sibling board" into "attended"; it can never convert silence.
 * Asserted both directions in the selftest.
 *
 * NOT a convention ruling. Which board a daytime task SHOULD write to is an owner decision about
 * task bodies; this makes the instrument correct under either answer instead of guessing one.
 */
export const BOARD_WINDOW_MIN = 1440;

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

export function siblingWindowAttendance(
  boardRoot: string,
  date: string,
  dayStart: Date,
  asOf?: Date
): Map<string, string> {
  const out = new Map<string, string>();
  const lo = dayStart.getTime();
  const hi = lo + BOARD_WINDOW_MIN * 60000;
  for (const sib of [shiftDate(date, -1), shiftDate(date, 1)]) {
    const f = boardPath(boardRoot, sib);
    if (!fs.existsSync(f)) continue;
    for (const raw of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = boardLineTask(raw);
      if (!t) continue;
      const ts = parseTs(raw);
      if (!ts) continue;                                   // no instant, no rescue
      if (ts.getTime() < lo || ts.getTime() >= hi) continue; // outside THIS board's cycle
      if (asOf && ts.getTime() > asOf.getTime()) continue;
      if (RETRACTION_RE.test(raw) || selfHealedTask(raw)) continue; // coverage is not attendance
      if (!out.has(t)) out.set(t, `${sib} board @ ${raw.trim().slice(0, 130)}`);
    }
  }
  return out;
}

export function boardAttendance(
  file: string,
  asOf?: Date
): { attended: Set<string>; selfHealed: Map<string, string> } {
  const attended = new Set<string>();
  const selfHealed = new Map<string, string>();
  const retracted = new Set<string>();  // IMP-214
  if (!fs.existsSync(file)) return { attended, selfHealed };
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = boardLineTask(raw);
    if (!t) continue;
    if (asOf) {
      const ts = parseTs(raw);
      if (ts && ts.getTime() > asOf.getTime()) continue;
    }
    // IMP-214: a CANARY-RETRACTION is neither attendance nor coverage. It withdraws the canary it
    // names, and the withdrawal is applied AFTER the sweep so line order cannot decide the verdict.
    if (RETRACTION_RE.test(raw)) {
      const subj = absenceSubject(raw);
      if (subj) retracted.add(subj);
      continue;
    }
    const healed = selfHealedTask(raw);
    if (healed) {
      // The line proves this slot did NOT write it. Record the coverage; do not credit attendance.
      if (!selfHealed.has(healed)) selfHealed.set(healed, raw.slice(0, 160));
      continue;
    }
    attended.add(t);
  }
  // A slot with BOTH a self-heal line and a genuine line of its own really did run: the self-heal
  // is then a second opinion, not a cover. Attendance wins; the coverage note is dropped.
  for (const k of [...selfHealed.keys()]) if (attended.has(k)) selfHealed.delete(k);
  // IMP-214: a retracted canary is withdrawn. Only a slot whose ONLY evidence was the retracted
  // line loses attendance — a slot that also wrote a genuine line of its own really did run.
  for (const r of retracted) {
    const own = fs.existsSync(file)
      ? fs.readFileSync(file, 'utf8').split('\n').some(l => {
          if (RETRACTION_RE.test(l) || boardLineTask(l) !== r) return false;
          if (asOf) { const ts = parseTs(l); if (ts && ts.getTime() > asOf.getTime()) return false; }
          return !selfHealedTask(l);
        })
      : false;
    if (!own) attended.delete(r);
  }
  return { attended, selfHealed };
}

/**
 * Which documented slots have EVER written a line, over the trailing real boards. See blindness (3):
 * this is what keeps `brief-validate-mechanical` / `brief-feedback-2` / `brief-feedback-3` — 0/20 —
 * out of the roll call without hardcoding a suppression list that could quietly go stale.
 */
export function observedTasks(root: string, boards = OBSERVATION_BOARDS): Set<string> {
  const dir = DB(root);
  if (!fs.existsSync(dir)) return new Set();
  const files = fs
    .readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f))
    .sort()
    .slice(-boards);
  const out = new Set<string>();
  for (const f of files) for (const t of boardTasks(path.join(dir, f))) out.add(t);
  return out;
}

// ---------- the roll call ----------

export interface Absentee {
  task: string;
  clock: string;
  deadline: Date;
  line: string;
  /** The board's own words for WHY this slot is called absent — never our paraphrase. */
  evidence: string;
}
export interface Unterminated {
  task: string;
  canaryAt: Date;
  windowMin: number;
  ageMin: number;
  /** reference-period record, so the reader can judge whether this is news or this task's norm */
  refClosed: number; refTotal: number;
  line: string;
}
/**
 * IMP-221 (2026-08-26 Critic mandate #2a): the scheduler says it FIRED and the board says nothing.
 * This is the one absence state a derived window cannot see, because the window answers "when does
 * this slot usually speak" and the scheduler answers "this slot was started, at this instant".
 */
export interface FiredSilent {
  task: string;
  firedAt: Date;
  tPlusMin: number;
  line: string;
}
export interface EmptyBody {
  task: string;
  line: string;
}
export interface RollCall {
  date: string;
  eveningDate: string;
  now: Date;
  rostered: Slot[];
  dropped: string[];     // documented in the table, never observed on a real board
  notYetDue: string[];
  attended: string[];
  absent: Absentee[];
  exempt: boolean;       // date predates EFFECTIVE_FROM — the pre-canary archive
  selfHealed: Map<string, string>;  // slot -> the line another task wrote in its name
  testimony: Map<string, string>;   // slot -> a line declaring it never fired
  /** WARN-LEVEL. Canary present, no terminal line, past the task's derived window. */
  unterminated: Unterminated[];
  /** Rostered slots whose window could not be derived — NAMED, never defaulted. */
  windowless: string[];
  /** IMP-218: slot -> the sibling-board line proving it ran inside this board's window. */
  crossBoard: Map<string, string>;
  /** IMP-221: slots the SCHEDULER reports as fired this cycle that wrote no STEP-0 CANARY of their own. */
  firedAndSilent: FiredSilent[];
  /** 2026-08-26b: rostered + due + no own STEP-0 CANARY. Covers every slot, not just brief-editor.
   *  Self-heal SUCCESS is not a canary — that is how 08-21/08-22 hid inside FULL ATTENDANCE. */
  emptyBody: EmptyBody[];
}

/**
 * How long after the scheduler starts a task before its silence is a finding (IMP-221).
 *
 * This one is CHOSEN, not derived, and the file's own doctrine requires me to say so: the archive
 * cannot measure fire→canary latency, because no board records a `lastRunAt`. What the archive DOES
 * settle is the shape of the obligation — every task spec in this pipeline makes the CANARY its
 * STEP 0, the first action before reading a file. Ten minutes is roughly two orders of magnitude
 * more than writing one line needs, and it is under the discriminating case: on 2026-08-26 the roll
 * call printed FULL ATTENDANCE at 19:31 ET for a `brief-editor` the scheduler had started at 19:20,
 * eleven minutes earlier, that never wrote anything and never would.
 */
export const FIRED_GRACE_MIN = 10;

export function rollCall(opts: {
  docRoot: string;          // repo root holding system/Pipeline_Controller.md + the archive
  boardRoot?: string;       // repo root holding the board under test (defaults to docRoot)
  date: string;
  now?: Date;
  /** Reconstruct the board as it stood at `now` (see boardTasks). Set by `--now`; never by default. */
  replay?: boolean;
  /** Injected derived windows (selftests + repeated calls); derived from docRoot when absent. */
  windows?: Map<string, TaskWindow>;
  /** IMP-221: task -> scheduler `lastRunAt`. Supplied by --scheduler-lastrun; never inferred. */
  schedulerLastRun?: Map<string, Date>;
}): RollCall {
  const docRoot = opts.docRoot;
  const boardRoot = opts.boardRoot ?? docRoot;
  const now = opts.now ?? new Date();
  const eveningDate = eveningDateOf(opts.date);

  // ── THE WIDENED ROSTER (owner ruling 2026-08-21) ────────────────────────────────────────────
  // ALL scheduled slots, morning and evening, and the membership is DERIVED: a task is rostered
  // because the archive shows it canarying, not because a table names it. That matters both ways —
  // `verify-brief-publish`, `daily-portfolio-monitor` and `selection-judge` canary every day and
  // appear in NO sequence table, while the table's documented hour for three daytime tasks is
  // stale by 150-240 minutes (see deriveWindows). The tables are kept only as a cross-check.
  const windows = opts.windows ?? deriveWindows(docRoot);
  const documented = eveningSlots(docRoot);
  const observed = observedTasks(docRoot);
  const haveArchive = observed.size > 0;
  const dayStart = etWallClock(eveningDate, 14, 0);
  // ── 🔴 ROSTER BIRTH DATE — A DERIVED ROSTER MUST NOT BACK-DATE ITS NEW MEMBERS (IMP-221) ─────
  // The membership of this roster is DERIVED (a task is rostered because the archive shows it
  // canarying), and derivation happens at CALL TIME against the LIVE archive. So a slot that only
  // just crossed MIN_N joins the roster on EVERY board ever written, including the ones from before
  // the slot existed — and the roll call then accuses a board of missing a task that had not been
  // created yet.
  //
  // WORKED FAILURE, 2026-08-26. `selection-judge` was n=6 and correctly NAMED WINDOWLESS when the
  // corpus was frozen on 08-21 (that pin is still asserted below). By this morning it was n=10, the
  // p95 became computable, and it entered the roster retroactively: fourteen boards — 08-02 through
  // 08-15 — each grew exactly one MISSING-SLOT accusation, the `[no-storm]` leg reported a storm,
  // and IMP-207 and IMP-211 both went RED for a defect in NEITHER of them. A false-alarm storm is
  // not a loud version of a working alarm; it is the thing that teaches the next session to skim
  // (CARRY/TREE, 2026-08-13). This is IMP-125's rule — THE RULE BINDS FORWARD, NEVER BACKWARD —
  // arriving in the one place it had not yet been wired: not the RULE's start date, the SLOT's.
  //
  // 🔴 WHY THE GRACE IS ONE CYCLE AND NOT ZERO, WHICH IS WHERE THIS FIX WAS NEARLY WRONG.
  // A slot's first canary is an UPPER BOUND on its birth date, never the birth date — because a
  // slot that exists and does not fire leaves nothing behind, so its FIRST NON-FIRE NECESSARILY
  // PRECEDES ITS FIRST CANARY. Zero grace therefore deletes exactly the catches this file exists
  // for, and it did: at grace 0 the 2026-08-01 `intel-sweep-4` non-fire went silent, and that one
  // is REAL. Receipt, from the stamps and not from the filenames — in the 08-01 cycle sweeps 5 and
  // 6 canaried at 16:05 and 17:18 ET on 07-31 and sweeps 1, 2 and 3 canaried on the 08-01 morning,
  // so the protocol was demonstrably in force across that whole cycle, and sweep 4's own 14:09 ET
  // slot wrote nothing anywhere. (The tempting story — "07-31 predates EFFECTIVE_FROM, so it is a
  // convention artifact" — is refuted by sweeps 5 and 6 on that same afternoon. It was checked
  // before this constant was chosen.)
  //
  // So ONE cycle: the single cycle immediately before a slot's first canary is genuinely ambiguous
  // between "did not exist yet" and "existed and missed its first run", and the roll call resolves
  // an ambiguity toward the accusation — the same treatment 08-01 intel-sweep-4 and 08-15
  // selection-judge both get, which is why both sit in KNOWN_NOISY under one rule rather than as
  // two special cases. Anything beyond one cycle is not ambiguous: it is a board from before the
  // slot existed. 14 false accusations become 1, and no demonstrable true catch is lost.
  const rostered: Slot[] = haveArchive
    ? [...windows.values()]
        .filter(w => w.canaryComputable)
        .filter(w => !w.firstCycle || opts.date >= eveningDateOf(w.firstCycle))
        .sort((a, b) => a.canaryP95 - b.canaryP95)
        .map(w => {
          const abs = (PIPELINE_DAY_START_MIN + w.canaryP95) % 1440;
          return { task: w.task, hh: Math.floor(abs / 60), mm: abs % 60, clock: fmtClock(abs), offsetMin: w.canaryP95 };
        })
    : documented.map(d => ({ ...d, offsetMin: NaN }));
  // Named, never defaulted: rostered-by-observation but with too few canaries to derive a window.
  const windowless = [...windows.values()].filter(w => !w.canaryComputable).map(w => w.task);
  const dropped = documented.filter(d => !rostered.some(r => r.task === d.task)).map(d => d.task);

  const bp = boardPath(boardRoot, opts.date);
  const att = boardAttendance(bp, opts.replay ? now : undefined);
  const present = att.attended;
  const ownCanaries = boardOwnCanaries(bp, opts.replay ? now : undefined);
  // IMP-218: the same cycle, written to a sibling board. Computed once, consulted only for slots
  // this board does not already account for.
  const sibling = siblingWindowAttendance(boardRoot, opts.date, dayStart, opts.replay ? now : undefined);
  // The second, independent absence path — a line written ABOUT the slot by anybody. It can only
  // ADD absences (its contradiction guard already spares any slot with a clean line of its own),
  // so a convention change on one path cannot make the roll call quieter than it should be.
  const testimony = absenceTestimony(bp, opts.replay ? now : undefined);

  const notYetDue: string[] = [];
  const attended: string[] = [];
  const absent: Absentee[] = [];
  /** IMP-218: slot -> the sibling-board line that proves it ran in this cycle. Reported, never silent. */
  const crossBoard = new Map<string, string>();
  // The pre-canary archive is exempt, not innocent and not guilty — it was never asked. See
  // EFFECTIVE_FROM. Attendance is still computed and reported; only the ALARM is suppressed.
  const exempt = opts.date < EFFECTIVE_FROM;

  for (const s of rostered) {
    const deadline = new Date(
      (Number.isNaN(s.offsetMin)
        ? etWallClock(eveningDate, s.hh, s.mm).getTime()
        : dayStart.getTime() + s.offsetMin * 60000) + GRACE_MIN * 60000
    );
    if (present.has(s.task)) {
      attended.push(s.task);
      continue;
    }
    if (now.getTime() < deadline.getTime()) {
      notYetDue.push(s.task); // blindness (2): not due is not absent
      continue;
    }
    // IMP-218: last question before an accusation — did it run inside THIS board's window and
    // write the line to a sibling board? That is attendance, not absence.
    const rescued = sibling.get(s.task);
    if (rescued) {
      attended.push(s.task);
      crossBoard.set(s.task, rescued);
      continue;
    }
    if (exempt) continue;
    absent.push({
      task: s.task,
      clock: s.clock,
      deadline,
      line: `MISSING-SLOT: ${s.task} — expected by ${fmtET(deadline)}, no canary at ${fmtET(now)}`,
      // WHY we say so, carried with the finding: the board's own words, not our inference.
      evidence: att.selfHealed.get(s.task)
        ? `SELF-HEAL COVERAGE: ${att.selfHealed.get(s.task)}`
        : testimony.get(s.task)
          ? `TESTIMONY: ${testimony.get(s.task)}`
          : 'NO LINE OF ANY KIND on the board for this slot',
    });
  }
  // ── 🔴 FIRED-AND-SILENT — THE SCHEDULER'S TESTIMONY OUTRANKS THE p95 (IMP-221) ───────────────
  // 2026-08-26: `brief-editor` fired at 19:20 ET, wrote nothing, and produced no v2, no working
  // file and no editor log — SIXTH consecutive night. This roll call ran at 19:31 and printed
  // "✅ FULL ATTENDANCE", because the slot's derived p95 window had not closed yet, so it was
  // classed NOT-YET-DUE. The detector built to catch exactly this absence certified the night as
  // healthy while the absence was happening.
  //
  // A derived window answers "when does this slot usually speak". It cannot answer "was this slot
  // started", and on a night when the answer to the second is YES the first is no longer relevant:
  // a task that has been running for longer than it takes to write one line and has written none
  // is silent, whatever the percentile says. So a `lastRunAt` inside this cycle makes the slot DUE
  // NOW. The scheduler's testimony is evidence the board does not contain, which is why it must be
  // PASSED IN and is never inferred: no flag, no leg, and every historical board reads unchanged.
  const firedAndSilent: FiredSilent[] = [];
  if (!exempt && opts.schedulerLastRun) {
    for (const [task, firedAt] of opts.schedulerLastRun) {
      if (+firedAt < +dayStart || +firedAt > +now) continue; // fired in some other cycle
      if (ownCanaries.has(task)) continue;                    // STEP-0 canary — it spoke
      if (sibling.get(task)) continue;                        // it spoke on a sibling (IMP-218)
      const tPlusMin = (+now - +firedAt) / 60000;
      if (tPlusMin < FIRED_GRACE_MIN) continue;               // still inside the grace to canary
      firedAndSilent.push({
        task,
        firedAt,
        tPlusMin,
        line:
          `FIRED-AND-SILENT: ${task} (T+${tPlusMin.toFixed(0)} min) — the scheduler started it at ` +
          `${fmtET(firedAt)} and it has written NO STEP-0 CANARY on this board or a sibling. ` +
          `A started task that cannot write one CANARY line is not late, it is failing silently ` +
          `(2026-08-26: brief-editor, T+11, and this roll call said FULL ATTENDANCE).`,
      });
    }
  }

  // ── 🔴 EMPTY-BODY — FIRED IN WINDOW, NO STEP-0 CANARY (2026-08-26b) ─────────────────────────
  // Marker lives on brief-editor only. This detector covers every rostered slot: scoping it to
  // the one task that already broke is how the next one surprises us. Self-heal SUCCESS is
  // attendance for MISSING-SLOT and is NOT a canary — 08-21 and 08-22 hid that way.
  // Critic-invoked `| brief-editor | CANARY | WRITE-OK (SELF-HEAL, …)` is not STEP 0 (08-23).
  const emptyBody: EmptyBody[] = [];
  if (!exempt) {
    for (const s of rostered) {
      if (notYetDue.includes(s.task)) continue;
      if (ownCanaries.has(s.task)) continue;
      if (sibling.get(s.task)) continue;
      emptyBody.push({
        task: s.task,
        line:
          `EMPTY-BODY: ${s.task} — fired in window, no STEP-0 CANARY on this board. ` +
          `A session that cannot write one canary is running empty or dead ` +
          `(2026-08-20 pointer wrapped in ---; 08-21→08-26 brief-editor).`,
      });
    }
  }

  // ── UNTERMINATED — warn-level, never alarms (owner: "the ESC-015 class, warn-level first") ──
  // SCOPE, stated as plainly as the ABSENT leg's: THIS ANSWERS "DID IT REPORT", NOT "IS IT DEAD".
  // The archive settles the distinction rather than leaving it to intuition — `daily-improvement`
  // wrote no terminal line on six of the last seven boards and wrote Improvement_Ledger rows on
  // every one of them. That is silent COMPLETION. Only tasks the REFERENCE period shows as
  // RELIABLE are reported, so a task whose own norm is silence is not accused nightly.
  const unterminated: Unterminated[] = [];
  const eps = episodes(bp, opts.replay ? now : undefined);
  if (!exempt) {
    for (const s2 of rostered) {
      const w = windows.get(s2.task);
      const ep = eps.get(s2.task);
      if (!w || !ep || !ep.stillOpen) continue;
      if (!w.latComputable || w.reliability !== 'RELIABLE') continue;
      const ageMin = (now.getTime() - ep.stillOpen.getTime()) / 60000;
      if (ageMin < w.latP95 + GRACE_MIN) continue;
      unterminated.push({
        task: s2.task, canaryAt: ep.stillOpen, windowMin: w.latP95, ageMin,
        refClosed: w.refClosed, refTotal: w.refTotal,
        line: `UNTERMINATED: ${s2.task} — canary ${fmtET(ep.stillOpen)}, no terminal line ${ageMin.toFixed(0)} min later (p95 window ${w.latP95.toFixed(0)} min, n=${w.latN}; reference period ${w.refClosed}/${w.refTotal})`,
      });
    }
  }
  return { date: opts.date, eveningDate, now, rostered, dropped, notYetDue, attended, absent, exempt, selfHealed: att.selfHealed, testimony, unterminated, windowless, crossBoard, firedAndSilent, emptyBody };
}

// ---------- THE DERIVED ROSTER: windows measured, never guessed ----------
//
// OWNER RULING 2026-08-21: the roster widens to ALL scheduled slots, morning and evening, with two
// rostered states per slot — ABSENT (no canary past the slot window) and UNTERMINATED (canary but
// no terminal line past a per-task window; the ESC-015 class, warn-level first). **Windows are
// DERIVED from the 92-board archive, never guessed** — the same widen-the-window method that found
// all three of this morning's false greens.
//
// 🔴 WHY DERIVATION IS NOT A FORMALITY HERE. The documented Daytime Sequence is STALE for three
// tasks, and the archive says so with almost no scatter:
//     daily-improvement       documented 10:03 AM · observed 07:03 (n=22, spread 0 min)  Δ -180m
//     system-update           documented  9:36 AM · observed 07:06 (n=21, spread 1 min)  Δ -150m
//     pipeline-health-check   documented 11:06 AM · observed 07:06 (n=21, spread 1 min)  Δ -240m
// These are not late tasks; they are tasks whose documented hour is wrong. A window taken from the
// table would call `pipeline-health-check` ABSENT every single morning until 11:16 AM.
// And the drift runs the other way in the evening: `brief-editor` is documented 6:55 PM, its p95
// canary is 8:48 PM — **103 minutes past the deadline the table implies.**
//
// THE DAY ANCHOR, TAKEN FROM THE BOARDS RATHER THAN FROM THE CLOCK. Wall-clock minutes cannot be
// averaged across midnight: `brief-feedback` canaries at 8:03 PM and, some nights, just after
// 00:00, which reads as a 1,250-minute spread and a p05 of 00:00. But the right anchor is not
// midnight OR 05:00 — it is where a BOARD begins. Board 2026-08-21 carries intel-sweep-4/5/6 from
// the AFTERNOON of 08-20, the whole evening chain of 08-20, and then brief-morning, intel-sweep-1,
// system-update, daily-improvement and pipeline-health-check from the MORNING of 08-21. That is
// the documented routing — "afternoon/evening ET runs use today + 1; morning runs use today" — so
// one board spans ~14:00 ET on D-1 through midday on D. Anchoring there makes every slot on a
// board monotonic in one number, and a deadline is simply 14:00 ET on D-1 plus the derived offset.
/** "6:55 PM" from absolute ET minutes-of-day — the shape the sequence tables print. */
export function fmtClock(absMin: number): string {
  const h24 = Math.floor(absMin / 60) % 24, m = Math.round(absMin % 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export const PIPELINE_DAY_START_MIN = 14 * 60; // 14:00 ET on BRIEF_DATE-1 — where a board begins

/** Which BRIEF_DATE cycle an instant belongs to. 14:00 ET rolls the day, per PIPELINE_DAY_START_MIN. */
export function cycleDateOf(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)!.value;
  const day = `${g('year')}-${g('month')}-${g('day')}`;
  const min = (+g('hour') % 24) * 60 + +g('minute');
  if (min < PIPELINE_DAY_START_MIN) return day;
  const [y, m, dd] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, dd) + 86400000).toISOString().slice(0, 10);
}

/** ET wall-clock minutes since 05:00 ET, wrapping post-midnight lines onto the same pipeline day. */
export function pipelineDayMin(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const h = +parts.find(x => x.type === 'hour')!.value;
  const m = +parts.find(x => x.type === 'minute')!.value;
  const raw = h * 60 + m;
  return raw >= PIPELINE_DAY_START_MIN ? raw - PIPELINE_DAY_START_MIN : raw + 1440 - PIPELINE_DAY_START_MIN;
  // 14:09 (sweep-4, D-1) -> 9 · 20:48 (editor, D-1) -> 408 · 00:30 (feedback, D) -> 630
  // 05:06 (morning, D)   -> 906 · 07:06 (health-check, D) -> 1026 · 12:05 (sweep-3, D) -> 1325
}

/** A line that ENDS an episode. Measured vocabulary — IN-PROGRESS and WRITE-OK are deliberately out. */
export const TERMINAL_RE =
  /^(SUCCESS|FAIL|SKIPPED|COMPLETE|HALTED|NO-?OP|PARTIAL|DEGRADED-KNOWN|NO-REPLY|ALERT)\b/i;
export const isCanaryLine = (raw: string) => /^CANARY/i.test((raw.split('|')[2] || '').trim());
export const isTerminalLine = (raw: string) => TERMINAL_RE.test((raw.split('|')[3] || '').trim());

/** STEP-0 canary written by the slot itself — not a Critic-invoked / SELF-HEAL decoy, not a retraction.
 *  Field 2 is CANARY; SELF-HEAL in the payload (08-23 Critic canary) does not count. */
export function isOwnStep0Canary(raw: string): boolean {
  if (RETRACTION_RE.test(raw)) return false;
  if (!isCanaryLine(raw)) return false;
  if (selfHealedTask(raw)) return false;
  const fields = raw.split('|').map(f => f.trim());
  const payload = fields.slice(3).join(' ');
  if (/\bSELF-HEAL\b|Critic-invoked/i.test(payload)) return false;
  return true;
}

export function boardOwnCanaries(file: string, asOf?: Date): Set<string> {
  const out = new Set<string>();
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    if (asOf) {
      const ts = parseTs(raw);
      if (ts && ts.getTime() > asOf.getTime()) continue;
    }
    if (!isOwnStep0Canary(raw)) continue;
    const t = boardLineTask(raw);
    if (t) out.add(t);
  }
  return out;
}

/** The scheduler strips the trailing newline when it saves a body. Diff live vs snapshot
 *  only after this, or every task flags as changed every night. */
export function normalizeTaskBody(s: string): string {
  return s.replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
}
export function bodiesMatchNormalized(a: string, b: string): boolean {
  return normalizeTaskBody(a) === normalizeTaskBody(b);
}

/**
 * MIN_N = 10. Below it the archive demonstrably contains bimodal slots — `selection-judge` has n=6
 * split between 07:36 and 21:12, an 818-minute spread whose p95 describes neither mode. A window
 * derived from too few observations is a guess wearing a percentile, so below the floor the window
 * is NOT COMPUTABLE and is NAMED as unmeasured rather than defaulted (standing rule: an
 * uncomputable number is named, never zeroed).
 */
export const MIN_N = 10;
export const WINDOW_PCT = 95;

function pctl(a: number[], p: number): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
}

export interface TaskWindow {
  task: string;
  canaryN: number;
  /** p95 pipeline-day minute by which this task has canaried. NaN when uncomputable. */
  canaryP95: number;
  latN: number;
  /** p95 canary -> terminal latency in minutes. NaN when uncomputable. */
  latP95: number;
  canaryComputable: boolean;
  latComputable: boolean;
  /**
   * 🔴 THE SLOT'S BIRTH DATE — the earliest CYCLE in which this task canaried at all (IMP-221).
   * A DERIVED roster has no membership table, so it also has no founding date, and without one it
   * back-dates every new slot to the beginning of the archive. See the ROSTER BIRTH DATE note in
   * rollCall for the worked failure this exists to prevent.
   *
   * It is the CYCLE, not the board FILE: `intel-sweep-1`'s first canary is stamped 07:51 ET on
   * 2026-08-01 and sits in the 2026-08-02 board, so the filename says 08-02 and the truth says
   * 08-01. Deriving a date from the file a line landed in is the error IMP-218 corrected in the
   * attendance path; it does not get to reappear one layer up.
   */
  firstCycle: string;
  /** boards where a canary opened and no terminal line ever closed it */
  unterminatedBoards: string[];
  /** in-force boards EXCLUDING the trailing RECENT_BOARDS — the uncontaminated reference period */
  refClosed: number; refTotal: number;
  recentClosed: number; recentTotal: number;
  /** classification from the REFERENCE period only. See REFERENCE-PERIOD note. */
  reliability: 'RELIABLE' | 'INTERMITTENT' | 'KNOWN-SILENT' | 'THIN-EVIDENCE';
}

/**
 * 🔴 THE REFERENCE PERIOD, AND WHY THE OBVIOUS VERSION IS WRONG.
 *
 * The first cut classified each task by its termination rate over the whole in-force window. That
 * put `daily-improvement` at 67% and `pipeline-health-check` at 71% — "intermittent", unremarkable,
 * not worth warning about. **Both figures are contaminated by the outage they are supposed to
 * detect.** Split at the trailing 7 boards the same two tasks read:
 *
 *     pipeline-health-check   14/14  ->  1/7   (-86pp)
 *     daily-improvement       13/14  ->  1/7   (-79pp)
 *
 * while every evening slot is 14/14 -> 7/7, unchanged. **A base rate computed over a window that
 * includes the failure normalises the failure** — the same shape as the exemption that suppressed
 * the ALARM and quietly suspended the SEMANTICS with it. So reliability is classified from the
 * REFERENCE period only, and the recent period is what gets judged against it.
 */
export const RECENT_BOARDS = 7;

/**
 * EPISODE PAIRING, and it had to be fixed before any number here meant anything. The first cut
 * paired each task's EARLIEST canary with its LATEST terminal line on the same board, which for the
 * afternoon sweeps produced median latencies of ~1,445 MINUTES — a clean 24 hours, because a board
 * can hold two different days' lines for one task and that pairing straddles them. Same corruption
 * class as the greedy in-order claim pairing in transmission-readback: pairing across units that do
 * not belong together, in a way that looks like a measurement. Each CANARY now opens an episode and
 * the FIRST terminal line after it closes that episode. Receipt: cross-day pairs 51 -> 0, and
 * intel-sweep-5's median fell from 1,444.7 min to 9.0.
 */
export function deriveWindows(root: string, upTo?: string): Map<string, TaskWindow> {
  const dir = DB(root);
  const boards = (fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f)).sort()
    : []
  ).filter(f => !upTo || f.slice(0, 10) <= upTo);
  const canary = new Map<string, number[]>();
  const lat = new Map<string, number[]>();
  const open = new Map<string, string[]>();
  /** IMP-221: earliest CYCLE carrying a canary for this task — from the stamp, not the filename. */
  const firstCycle = new Map<string, string>();
  for (const b of boards) {
    const ev = new Map<string, { ts: Date; kind: 'C' | 'T' }[]>();
    for (const raw of fs.readFileSync(path.join(dir, b), 'utf8').split('\n')) {
      const task = boardLineTask(raw);
      if (!task) continue;
      const ts = parseTs(raw);
      if (!ts) continue;
      const kind = isCanaryLine(raw) ? 'C' : isTerminalLine(raw) ? 'T' : null;
      if (!kind) continue;
      if (!ev.has(task)) ev.set(task, []);
      ev.get(task)!.push({ ts, kind });
      if (kind === 'C') {
        if (!canary.has(task)) canary.set(task, []);
        canary.get(task)!.push(pipelineDayMin(ts));
        const cyc = cycleDateOf(ts);
        if (!firstCycle.has(task) || cyc < firstCycle.get(task)!) firstCycle.set(task, cyc);
      }
    }
    for (const [task, list] of ev) {
      list.sort((a, b2) => +a.ts - +b2.ts);
      let pending: Date | null = null;
      for (const e of list) {
        if (e.kind === 'C') {
          if (pending) (open.get(task) ?? open.set(task, []).get(task)!).push(b.slice(0, 10));
          pending = e.ts;
        } else if (pending) {
          if (!lat.has(task)) lat.set(task, []);
          lat.get(task)!.push((+e.ts - +pending) / 60000);
          pending = null;
        }
      }
      if (pending) (open.get(task) ?? open.set(task, []).get(task)!).push(b.slice(0, 10));
    }
  }
  // Reference vs recent termination rate, over the IN-FORCE boards only.
  const inForce = boards.filter(b => b.slice(0, 10) >= EFFECTIVE_FROM);
  const refB = inForce.slice(0, Math.max(0, inForce.length - RECENT_BOARDS));
  const recB = inForce.slice(-RECENT_BOARDS);
  const tally = (bs: string[]) => {
    const m = new Map<string, { c: number; t: number }>();
    for (const b of bs) {
      for (const [task, ep] of episodes(path.join(dir, b))) {
        if (!ep.opened) continue;
        if (!m.has(task)) m.set(task, { c: 0, t: 0 });
        const r = m.get(task)!;
        r.c++;
        if (!ep.stillOpen) r.t++;
      }
    }
    return m;
  };
  const R = tally(refB), C2 = tally(recB);

  const out = new Map<string, TaskWindow>();
  for (const task of new Set([...canary.keys(), ...lat.keys()])) {
    const c = canary.get(task) ?? [];
    const l = lat.get(task) ?? [];
    const r = R.get(task) ?? { c: 0, t: 0 };
    const rec = C2.get(task) ?? { c: 0, t: 0 };
    const rate = r.c ? r.t / r.c : NaN;
    const reliability: TaskWindow['reliability'] =
      r.c < 5 ? 'THIN-EVIDENCE' : rate >= 0.9 ? 'RELIABLE' : rate >= 0.5 ? 'INTERMITTENT' : 'KNOWN-SILENT';
    out.set(task, {
      task,
      canaryN: c.length,
      canaryP95: c.length >= MIN_N ? pctl(c, WINDOW_PCT) : NaN,
      latN: l.length,
      latP95: l.length >= MIN_N ? pctl(l, WINDOW_PCT) : NaN,
      canaryComputable: c.length >= MIN_N,
      latComputable: l.length >= MIN_N,
      firstCycle: firstCycle.get(task) ?? '',
      unterminatedBoards: open.get(task) ?? [],
      refClosed: r.t, refTotal: r.c,
      recentClosed: rec.t, recentTotal: rec.c,
      reliability,
    });
  }
  return out;
}

/** Per task on one board: did a canary open, and is the FINAL episode still open? */
export function episodes(file: string, asOf?: Date): Map<string, { opened: number; stillOpen: Date | null }> {
  const out = new Map<string, { opened: number; stillOpen: Date | null }>();
  if (!fs.existsSync(file)) return out;
  const ev = new Map<string, { ts: Date; kind: 'C' | 'T' }[]>();
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const task = boardLineTask(raw);
    if (!task) continue;
    const ts = parseTs(raw);
    if (!ts) continue;
    if (asOf && ts.getTime() > asOf.getTime()) continue;
    const kind = isCanaryLine(raw) ? 'C' : isTerminalLine(raw) ? 'T' : null;
    if (!kind) continue;
    if (!ev.has(task)) ev.set(task, []);
    ev.get(task)!.push({ ts, kind });
  }
  for (const [task, list] of ev) {
    list.sort((a, b) => +a.ts - +b.ts);
    let pending: Date | null = null, opened = 0;
    for (const e of list) {
      if (e.kind === 'C') { opened++; pending = e.ts; }
      else if (pending) pending = null;
    }
    out.set(task, { opened, stillOpen: pending });
  }
  return out;
}

// ---------- the alarm path ----------
//
// THE MANDATE (2026-08-21, owner): "a scheduled task whose canary is absent past its window = RED +
// the alarm-email path. Absent becomes a detected state, not a silent one."
//
// TWO CONTRACTS HAD TO BOTH HOLD. Pipeline_Controller L591 and Brief_Critic leg (iv) already ship
// this check as WARN-LEVEL, and the Critic pastes its output verbatim into a hard-gated evidence
// block — so flipping the default exit to 1 would retroactively break two documents that are
// already in force. So the ALARM fires on the STATE, never on a flag: any absentee past its window
// on an in-force date writes the alert file and prints the email, whatever exit code is requested.
// `--red` is available for a caller that wants the non-zero exit; the detection does not depend
// on anyone passing it.
//
// AND THE DURABLE HALF IS THE FILE, NOT THE PRINT. A printed instruction an agent may skip is
// decoration; `{date}-pipeline-alert.md` is on disk and the morning gate can be asked for it.
// Email transport stays an agent action by design (Controller: "email transport is independent of
// the mount") — this script cannot send mail, so it writes the exact subject and body to be sent
// rather than pretending to have sent it.

export const ALARM_SUBJECT = (task: string, date: string) =>
  `🔴 PIPELINE ALARM — ${task} missing/failed for ${date}`;

/** Appends one 🔴 block per absent task. Idempotent: a task already alarmed for this date is skipped. */
export function writeAlert(
  root: string,
  date: string,
  rc: RollCall
): { path: string; wrote: string[]; skipped: string[] } {
  const file = path.join(DB(root), `${date}-pipeline-alert.md`);
  const wrote: string[] = [], skipped: string[] = [];
  if (!rc.absent.length || rc.exempt) return { path: file, wrote, skipped };
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let out = '';
  for (const a of rc.absent) {
    if (existing.includes(ALARM_SUBJECT(a.task, date))) { skipped.push(a.task); continue; }
    wrote.push(a.task);
    out +=
      `\n## 🔴 SLOT ABSENT — ${a.task} (${date})\n\n` +
      `- **Email subject:** \`${ALARM_SUBJECT(a.task, date)}\`\n` +
      `- **To:** cosmictrex11@gmail.com\n` +
      `- **Detected by:** \`scripts/pipeline-slot-attendance.ts\` at ${fmtET(rc.now)}\n` +
      `- **Finding:** ${a.line}\n` +
      `- **Evidence (the board's own words):** ${a.evidence}\n` +
      `- **What this means:** the ${a.task} slot (scheduled ${a.clock}) left no line of its own on ` +
      `\`${date}-pipeline-status.md\` past its deadline + ${GRACE_MIN}-minute grace. A task that never ` +
      `starts writes no canary, so no liveness gate can see it.\n` +
      `- **Manual recovery:** re-run the ${a.task} slot, or self-heal downstream ` +
      `(\`editor-handoff-gate --can-self-heal ${date} --scheduler-lastrun <ISO|NEVER>\`) and say on the board that you did. ` +
      `**IMP-216: --scheduler-lastrun is REQUIRED and exit 3 = SELF-HEAL UNKNOWN, which is NOT permission** — without a ` +
      `scheduler reading that gate refuses to answer, because "never fired" and "fired and produced nothing" are the same ` +
      `string on this board. A Critic-invoked self-heal writes \`brief-editor-selfheal\` lines, never \`brief-editor\`.\n`;
  }
  if (out) {
    if (!existing) out = `# Pipeline Alert — ${date}\n` + out;
    fs.appendFileSync(file, out);
  }
  return { path: file, wrote, skipped };
}

// ---------- selftest ----------
//
// Built on the REAL boards on disk, all three directions the mandate names. Nothing below invents a
// status line; the one fixture is the real 08-21 bytes with a single line REMOVED, and the removal
// is counted and asserted so it cannot silently become something else.

/**
 * THE FIRE CASE, CONSTRUCTED HONESTLY.
 *
 * `daily-briefs/2026-08-21-pipeline-status.md` today carries exactly ONE brief-editor line — the
 * Critic's 23:40:32Z SELF-HEAL SUCCESS, written AFTER it discovered the slot had not fired. So the
 * live board is (correctly) SILENT: brief-editor did eventually get a line, and this file's whole
 * point is that any line proves the slot was serviced.
 *
 * The mandate's option (b): derive the fixture from the real bytes with that one self-heal line
 * removed. That reconstructs the board EXACTLY as it stood at 23:31/23:32/23:34Z when the Critic
 * polled `--can-self-heal` three times and got EXIT 0 — the state the roll call is supposed to name.
 * Every other byte of the real board is preserved, including all six daytime intel-sweep rows.
 *
 * (Option (a) — evaluating the untouched board at a --now before 23:40Z — also fires brief-editor,
 * and is asserted separately below. It is NOT the primary receipt because at any instant before
 * 23:40Z brief-light is also past its 7:15 PM deadline and had not yet written, so option (a)
 * reports a genuinely SLOW slot alongside the genuinely ABSENT one. The fixture isolates absence.)
 */
function fireFixture(root: string): { fixtureRoot: string; removed: number } {
  const src = fs.readFileSync(boardPath(root, '2026-08-21'), 'utf8');
  const kept: string[] = [];
  let removed = 0;
  for (const raw of src.split('\n')) {
    if (lineTask(raw) === 'brief-editor') { removed++; continue; }
    kept.push(raw);
  }
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-nonfire-'));
  fs.mkdirSync(path.join(fixtureRoot, 'daily-briefs'), { recursive: true });
  fs.writeFileSync(
    boardPath(fixtureRoot, '2026-08-21'),
    kept.join('\n')
  );
  return { fixtureRoot, removed };
}

/**
 * IMP-218 — the blindness fixture. Copies board `date` and BOTH siblings into a scratch root with
 * every line for `task` removed, so "genuinely never ran" can be constructed from real bytes
 * without editing a live board. `keepOnSiblings` puts the stripped lines back on the sibling boards
 * ONLY — the exact real-world shape of the board-convention split. `shiftHours` moves them out of
 * the window, proving the rescue is a window judgement rather than a filename shrug.
 */
function blindnessFixture(
  root: string,
  date: string,
  task: string,
  opts: { keepOnSiblings?: boolean; shiftHours?: number } = {}
): { fixtureRoot: string; removed: number } {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-blind-'));
  fs.mkdirSync(path.join(fixtureRoot, 'daily-briefs'), { recursive: true });
  let removed = 0;
  for (const d of [shiftDate(date, -1), date, shiftDate(date, 1)]) {
    const src = boardPath(root, d);
    if (!fs.existsSync(src)) continue;
    const kept: string[] = [];
    for (const raw of fs.readFileSync(src, 'utf8').split('\n')) {
      if (boardLineTask(raw) !== task) { kept.push(raw); continue; }
      removed++;
      if (d !== date && opts.keepOnSiblings) {
        if (opts.shiftHours) {
          const ts = parseTs(raw);
          if (ts) {
            const moved = new Date(ts.getTime() + opts.shiftHours * 3600000).toISOString().replace(/\.\d+Z$/, 'Z');
            kept.push(raw.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})/, moved));
            continue;
          }
        }
        kept.push(raw);
      }
    }
    fs.writeFileSync(boardPath(fixtureRoot, d), kept.join('\n'));
  }
  return { fixtureRoot, removed };
}

/** IMP-214 — the 08-23 board with the self-heal canary kept and its retraction kept, nothing else. */
function retractionFixture(root: string): { fixtureRoot: string } {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-retract-'));
  fs.mkdirSync(path.join(fixtureRoot, 'daily-briefs'), { recursive: true });
  for (const d of ['2026-08-22', '2026-08-23', '2026-08-24']) {
    const src = boardPath(root, d);
    if (fs.existsSync(src)) fs.copyFileSync(src, boardPath(fixtureRoot, d));
  }
  return { fixtureRoot };
}

/** Every line the NARROW rule reads as coverage, with its board date — the identity pin's input. */
function coverageLines(root: string): { date: string; task: string; line: string }[] {
  const dir = DB(root);
  const out: { date: string; task: string; line: string }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(x => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(x)).sort()) {
    for (const raw of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      const t = selfHealedTask(raw);
      if (t) out.push({ date: f.slice(0, 10), task: t, line: raw });
    }
  }
  return out;
}

function selftest(): number {
  const root = process.cwd();
  let fails = 0, total = 0;
  const assert = (ok: boolean, label: string) => {
    total++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  // ── 0. THE ROSTER ITSELF ────────────────────────────────────────────────────────────────────
  const slots = eveningSlots(root);
  const names = slots.map(s => s.task);
  assert(
    slots.length >= 10,
    `[roster] Evening Sequence table parsed out of Pipeline_Controller.md — ${slots.length} slot(s): ${names.join(', ')}`
  );
  assert(
    names.includes('brief-editor') &&
      slots.find(s => s.task === 'brief-editor')!.hh === 18 &&
      slots.find(s => s.task === 'brief-editor')!.mm === 55,
    '[roster] brief-editor read from the real table at 6:55 PM ET (not hardcoded)'
  );
  assert(
    !names.some(n => /intel-sweep|system-update|daily-improvement|pipeline-health|brief-morning/.test(n)),
    '[roster] contains NO daytime or morning task — the roll call is EVENING slots only (Controller L52-54)'
  );

  // IMP-211: windows are derived from the FROZEN corpus inside the selftest. The reliability
  // base rates below (refClosed/refTotal, recentClosed/recentTotal) are archive statistics, so
  // every new board moves them and any assertion pinning them decays by the calendar. Runtime is
  // untouched — main() still calls deriveWindows(root) with no ceiling.
  const WIN = deriveWindows(root, CORPUS_FROZEN_AT);
  const observed = observedTasks(root);
  const drop = names.filter(n => !observed.has(n));
  assert(
    drop.length > 0 && drop.every(n => /^(brief-validate-mechanical|brief-feedback-[23])$/.test(n)),
    `[roster] never-observed slots dropped by ARCHIVE MEASUREMENT, not a hardcoded list: ${drop.join(', ') || '(none)'} (0 lines across the trailing ${OBSERVATION_BOARDS} boards)`
  );
  assert(
    ['brief-editor', 'brief-critic', 'brief-draft', 'brief-light', 'brief-email'].every(n => observed.has(n)),
    '[roster] the slots that DO write lines survive the filter — the filter drops silence, not stages'
  );

  // ── 1. MUST FIRE — the 2026-08-21 brief-editor non-fire ──────────────────────────────────────
  const boardOK = fs.existsSync(boardPath(root, '2026-08-21'));
  let fireLines: string[] = [];
  let removed = -1;
  if (boardOK) {
    const f = fireFixture(root);
    removed = f.removed;
    const rc = rollCall({
      docRoot: root,
      boardRoot: f.fixtureRoot,
      date: '2026-08-21',
      // 23:59 ET on the evening of 08-20 — past every evening deadline, so the only thing the
      // result can be reporting is absence rather than lateness.
      now: etWallClock('2026-08-20', 23, 59),
      replay: true,
    });
    fireLines = rc.absent.map(a => a.line);
  }
  assert(
    boardOK && removed === 1,
    `[fire] the fixture removed EXACTLY ONE brief-editor line from the real 08-21 bytes (the 23:40:32Z Critic SELF-HEAL) — removed=${removed}`
  );
  assert(
    boardOK && fireLines.some(l => l.startsWith('MISSING-SLOT: brief-editor')),
    `[fire] MISSING-SLOT: brief-editor on the reconstructed 2026-08-21 board — ${fireLines.length} absentee(s)`
  );
  assert(
    boardOK && fireLines.length === 1,
    `[fire] and brief-editor is the ONLY absentee — every other evening slot canaried that night (count ${fireLines.length})`
  );
  if (fireLines.length) console.log(`         ${fireLines[0]}`);

  // 1b. Option (a), stated for the record: on the UNTOUCHED board, evaluated before the Critic's
  //     self-heal landed, brief-editor is also missing — the fixture is a reconstruction, not a
  //     different claim. brief-light appears here too because at 19:35 ET it was 20 min late and
  //     had not yet written; that is lateness, and it is why the fixture is the primary receipt.
  const early = boardOK
    ? rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 19, 35), replay: true })
    : null;
  // THE WINDOW MOVED, AND THE OLD ASSERTION WAS THE THING THAT WAS WRONG. This used to assert that
  // the untouched 08-21 board names brief-editor absent at 19:35 ET. It did — because the deadline
  // came from the Evening Sequence table (6:55 PM + 10 min grace = 19:05). But the archive says
  // brief-editor's p95 canary is 20:48, so the table-derived deadline condemned the slot **103
  // minutes before it normally starts**. Under derived windows 19:35 is NOT-YET-DUE, which is the
  // correct answer: at 19:35 the editor is early, not missing. The absence is proved at 23:59.
  assert(
    !boardOK ||
      rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 19, 35), replay: true, windows: WIN })
        .notYetDue.includes('brief-editor'),
    '[fire] at 19:35 ET brief-editor is NOT-YET-DUE, not absent — its DERIVED p95 canary is 8:48 PM, so the table deadline of 6:55 PM was accusing a slot 103 min before its own normal start'
  );

  // ── 2. MUST STAY SILENT — 2026-08-20, the night the OWED-EDITOR GUARD fired and cleared ──────
  //     brief-editor CANARY 23:09:20Z → brief-critic CANARY 23:30:52Z → brief-editor SUCCESS
  //     23:31:22Z. The Editor was SLOW and the Critic arrived first. Slow must not read as absent.
  const board20 = fs.existsSync(boardPath(root, '2026-08-20'));
  const rc20 = board20
    ? rollCall({ docRoot: root, date: '2026-08-20', now: etWallClock('2026-08-19', 23, 59), replay: true })
    : null;
  assert(
    !board20 || rc20!.absent.length === 0,
    `[silent] ZERO MISSING-SLOT lines on the real 2026-08-20 board — every rostered evening slot canaried (attended ${rc20?.attended.length}/${rc20?.rostered.length})${rc20 && rc20.absent.length ? ': ' + rc20.absent.map(a => a.task).join(', ') : ''}`
  );
  assert(
    !board20 || rc20!.attended.includes('brief-editor'),
    '[silent] and brief-editor is counted PRESENT on 08-20 (CANARY 23:09:20Z, 22 min before its SUCCESS) — SLOW is not ABSENT'
  );

  // ── 3. MUST STAY SILENT on the 08-21 board's DAYTIME intel-sweep rows ────────────────────────
  //     Those six rows belong to the 08-20 cycle (Controller L54); three of them are CORRECTION
  //     lines saying so out loud. The negative is only meaningful if the rows are really there,
  //     so that is asserted first.
  // NOTE: no `replay` here — this leg is the LIVE reading of the untouched board, which is what
  // pipeline-health-check actually does when it runs.
  const present21 = boardOK ? boardTasks(boardPath(root, '2026-08-21')) : new Set<string>();
  const sweeps = [...present21].filter(t => /^intel-sweep/.test(t));
  assert(
    !boardOK || sweeps.length >= 3,
    `[routing] the 08-21 board really does carry daytime rows from the 08-20 cycle — ${sweeps.join(', ')}`
  );
  const rc21 = boardOK
    ? rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 23, 59) })
    : null;
  assert(
    !boardOK || !rc21!.absent.some(a => /intel-sweep/.test(a.task)),
    '[routing] and NOT ONE of them is reported missing — correct routing is never absence'
  );
  // ROSTER WIDENED (owner ruling 2026-08-21): daytime rows are rostered in their own right now, so
  // "an intel-sweep row must not appear in attended" is obsolete — it must appear, for itself. What
  // still has to hold is that it services ONLY its own slot.
  assert(
    !boardOK ||
      (rc21!.attended.includes('intel-sweep-4') &&
        !rc21!.absent.some(a => /^brief-/.test(a.task) && /intel-sweep/.test(a.evidence))),
    '[routing] a daytime row is rostered for ITSELF and services no other slot — intel-sweep-4 attended, and no brief-* absence excused by a sweep line'
  );
  // THE INVERSION (2026-08-21). This assertion previously read `rc21!.absent.length === 0` and
  // PASSED — it had encoded the very defect the file was built to catch. The live board's only
  // brief-editor line is the Critic's SELF-HEAL, and crediting it as attendance made the detector
  // report FULL ATTENDANCE on the one night in the archive where the slot did not fire. A
  // self-heal payload is now read as PROOF OF ABSENCE (see selfHealedTask), so the UNTOUCHED
  // bytes fire on their own — no fixture required.
  assert(
    !boardOK || rc21!.absent.some(a => a.task === 'brief-editor'),
    `[selfheal] the LIVE, UNMODIFIED 08-21 board names brief-editor ABSENT — its only brief-editor line is the Critic's SELF-HEAL, which proves the slot did not write it (absent: ${rc21?.absent.map(a => a.task).join(', ') || 'none'})`
  );
  assert(
    !boardOK || rc21!.absent.length === 1,
    `[selfheal] and brief-editor is the ONLY absentee on the live board at 23:59 ET — the self-heal rule condemns exactly one slot, not the night (absent ${rc21?.absent.length})`
  );
  assert(
    !boardOK ||
      boardAttendance(boardPath(root, '2026-08-21')).selfHealed.get('brief-editor') !== undefined,
    '[selfheal] the coverage is RECORDED, not merely subtracted — boardAttendance carries the self-heal line that covered brief-editor'
  );

  // ── 4. NOT-YET-DUE IS NOT ABSENT ─────────────────────────────────────────────────────────────
  const earlyEve = boardOK
    ? rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 17, 0), replay: true })
    : null;
  assert(
    !boardOK || earlyEve!.absent.length === 0,
    `[not-due] at 5:00 PM ET, before the first slot's deadline, ZERO absentees and ${earlyEve?.notYetDue.length} slot(s) held as NOT-YET-DUE`
  );
  assert(
    !boardOK || earlyEve!.notYetDue.includes('brief-editor'),
    '[not-due] brief-editor is NOT-YET-DUE at 5:00 PM ET — the grace window is honoured before the alarm'
  );

  // ── 5. THE LINE FORMAT IS THE CONTRACT ───────────────────────────────────────────────────────
  assert(
    fireLines.length > 0 &&
      /^MISSING-SLOT: [a-z0-9-]+ — expected by .+ ET, no canary at .+ ET$/.test(fireLines[0]!),
    '[format] the emitted line matches the mandated shape exactly: "MISSING-SLOT: {task} — expected by {deadline}, no canary at {now}"'
  );

  // ── 6. NO STORM, AND NO RETROACTIVE CONDEMNATION — swept over the REAL archive ───────────────
  //     This leg exists because the first build of this file FAILED it: 71 of 92 boards fired,
  //     because the canary protocol postdates most of the archive. Both halves are asserted, so
  //     neither the boundary nor the in-window silence can rot unnoticed.
  {
    const dir = DB(root);
    const boards = fs.existsSync(dir)
      ? fs.readdirSync(dir)
          .filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f))
          .map(f => f.slice(0, 10))
          .sort()
      : [];
    // IMP-211: the expectation set ends at CORPUS_FROZEN_AT. Boards written after it are the
    // WORLD, not the code, and a real incident on one of them must not be reported as this
    // detector being broken — that is what happened on 2026-08-22 (see CORPUS_FROZEN_AT).
    const inWindow = boards.filter(
      d => d >= EFFECTIVE_FROM && d <= CORPUS_FROZEN_AT
    );
    const noisy = inWindow
      .map(d => ({ d, n: rollCall({ docRoot: root, date: d }).absent.length }))
      .filter(x => x.n > 0);
    // KNOWN-ANSWER PIN. Exactly one board in the window is supposed to be noisy: 2026-08-21, the
    // night brief-editor did not fire (E-PIPELINE-EDITOR-NONFIRE-01). Asserting `noisy.length === 0`
    // was the old expectation and it PASSED against the broken detector — silence read as health.
    // Both directions are now pinned: a NEW noisy board is a storm, and 08-21 going quiet is the
    // detector regressing back to the defect.
    // THE WIDENED ROSTER'S FIRST CATCH, AND IT IS THE POINT OF THE RULING. Evening-only, these five
    // boards were silent. Rostering the daytime slots names an intel sweep that never fired on each
    // — VERIFIED by hand: on every one of these boards the missing sweep appears NOWHERE in the
    // task list while all of its siblings do. Pipeline_Controller names this exact blindness as a
    // root cause of E-PIPELINE-FULL-FAILURE-02: "the existing watchdog never caught the missing
    // intel sweep because it was not on the monitored task list."
    const KNOWN_NOISY: Record<string, number> = {
      // 🔴 CORRECTED 2026-08-24 (IMP-218) — FOUR OF THESE FIVE "NON-FIRES" NEVER HAPPENED, and
      // this table is where the false-alarm class had been laundered into ground truth. Each of
      // the four sweeps below RAN, on time, and wrote its line to the SIBLING board, inside this
      // board's own window. Receipts, printed by the corrected instrument:
      //   08-01 intel-sweep-1  ← 08-02 board @ 2026-08-01T11:51:08Z | intel-sweep-1 | CANARY
      //   08-03 intel-sweep-5  ← 08-02 board @ 2026-08-02T16:06:24-0400 | intel-sweep-5 | CANARY
      //   08-05 intel-sweep-3  ← 08-06 board @ 2026-08-05T16:08:03Z | intel-sweep-3 | CANARY
      //   08-12 intel-sweep-5  ← 08-11 board @ 2026-08-11T20:13:43Z | intel-sweep-5 | CANARY
      // What SURVIVES is the proof the detector did not go blind: 08-01 intel-sweep-4 has no line
      // on any board in the window and still fires, and 08-21 brief-editor still fires. A pin that
      // records an instrument's error as expected behaviour is worse than no pin — it makes the
      // fix look like the regression.
      // 🔴 08-01 IS A BIRTH-GRACE CYCLE AND IT STAYS NOISY ON PURPOSE (IMP-221, 2026-08-26). It is
      // the single ambiguous cycle immediately before intel-sweep-4's first observed canary — the
      // window documented in rollCall, where "did not exist yet" and "existed and missed its first
      // run" cannot be told apart and the roll call keeps the accusation. Verified REAL from the
      // stamps: sweeps 5 and 6 canaried on that same 07-31 afternoon, so the protocol was in force
      // across the whole cycle and sweep 4's 14:09 ET slot wrote nothing anywhere. If this goes
      // quiet the grace has grown and the detector is blinder. (selection-judge's own grace cycle
      // is 08-16 and is NOT noisy — it has a line on that board — which is the cleanest evidence
      // that the grace is a rule about ROSTERING, not a licence to accuse.)
      '2026-08-01': 1, // intel-sweep-4 — birth-grace cycle; verified genuinely absent
      '2026-08-21': 1, // brief-editor  — the non-fire this file was built for
    };
    const unexpected = noisy.filter(x => KNOWN_NOISY[x.d] === undefined);
    assert(
      inWindow.length >= 14 && unexpected.length === 0,
      `[no-storm] no board from ${EFFECTIVE_FROM} onward fires except the known non-fire night${unexpected.length ? ' — UNEXPECTED: ' + unexpected.map(x => `${x.d}(${x.n})`).join(', ') : ''} (${inWindow.length} boards swept)`
    );
    assert(
      Object.entries(KNOWN_NOISY).every(([d, n]) => rollCall({ docRoot: root, date: d, windows: WIN }).absent.length === n) &&
        rollCall({ docRoot: root, date: '2026-08-21', windows: WIN }).absent[0]!.task === 'brief-editor',
      `[no-storm] and every known non-fire STILL fires — 08-21 brief-editor plus five intel-sweep non-fires the EVENING-ONLY roster could not see (pin both ways: 08-21 silent = the self-heal rule undone; sweeps silent = the roster narrowed)`
    );
    const preWindow = boards.filter(d => d < EFFECTIVE_FROM);
    assert(
      preWindow.every(d => rollCall({ docRoot: root, date: d }).absent.length === 0),
      `[no-storm] and the ${preWindow.length} PRE-CANARY boards are EXEMPT, not condemned — a sweep of them fired 71/92 before EFFECTIVE_FROM existed (IMP-125)`
    );
    assert(
      rollCall({ docRoot: root, date: '2026-05-17' }).exempt === true &&
        rollCall({ docRoot: root, date: '2026-08-21' }).exempt === false,
      '[no-storm] the boundary is a real switch: 2026-05-17 EXEMPT, 2026-08-21 IN FORCE'
    );

    // ── IMP-221 · THE ROSTER'S BIRTH DATE, PROVED ON THE SLOT THAT BROKE IT ────────────────────
    // These legs pin the fix in BOTH directions on real bytes: the archive must still show the
    // slot as computable (or the leg is vacuous and passes for the wrong reason), it must be
    // silent on every board that predates the slot's own first canary, and it must go on
    // rostering the slot from that board forward — a fix that simply removed selection-judge from
    // the roster would pass the storm leg and blind the detector, which is the trade this file
    // has refused four times (IMP-141/149/200/211).
    const LIVE = deriveWindows(root);
    const sj = LIVE.get('selection-judge');
    assert(
      !!sj && sj.canaryComputable && sj.canaryN >= MIN_N,
      `[birth] selection-judge IS computable in the live archive (n=${sj?.canaryN ?? 'ABSENT'}) — the leg below is exercised, not vacuous`
    );
    assert(
      !!sj && sj.firstCycle === '2026-08-17',
      `[birth] …and its FIRST canary is in the 2026-08-17 CYCLE (got ${sj?.firstCycle || 'NONE'} — the 08-16 BOARD, stamped past 14:00 ET, which is the next cycle), so 08-02→08-15 are boards from before the slot existed`
    );
    assert(
      ['2026-08-02', '2026-08-08', '2026-08-15'].every(
        d => !rollCall({ docRoot: root, date: d }).rostered.some(s => s.task === 'selection-judge')
      ),
      '[birth] a board more than one cycle before the slot does NOT roster it — the fourteen-board storm of 2026-08-26, at its source'
    );
    assert(
      ['2026-08-17', '2026-08-20'].every(
        d => rollCall({ docRoot: root, date: d }).rostered.some(s => s.task === 'selection-judge')
      ),
      '[birth] …and from its own first cycle FORWARD it is rostered exactly as before — the birth date narrows the EXPECTATION, never the DETECTOR'
    );
    // 🔴 THE GRACE, PINNED BOTH WAYS. This is the leg that stops the birth date from being widened
    // into blindness the next time a storm is inconvenient: a slot's first non-fire always
    // precedes its first canary, so the one ambiguous cycle stays accusable — for the slot that
    // proved it (intel-sweep-4, verified real) and for the slot that motivated the fix alike.
    assert(
      rollCall({ docRoot: root, date: '2026-08-01' }).absent.some(a => a.task === 'intel-sweep-4'),
      '[birth] GRACE=1: the REAL 2026-08-01 intel-sweep-4 non-fire SURVIVES — grace 0 deleted it, and sweeps 5 and 6 canarying that same 07-31 afternoon prove the protocol was in force'
    );
    assert(
      (['intel-sweep-4', 'selection-judge'] as const).every(t => {
        const w = LIVE.get(t);
        if (!w?.firstCycle) return false;
        const grace = eveningDateOf(w.firstCycle);
        const before = eveningDateOf(grace);
        const on = (d: string) => rollCall({ docRoot: root, date: d }).rostered.some(s => s.task === t);
        return on(grace) && !on(before);
      }),
      '[birth] …and BOTH slots get the identical treatment at their own boundary — rostered on the grace cycle, absent from the one before it. One rule, not a carve-out for the slot that broke the storm leg.'
    );
    assert(
      !!LIVE.get('intel-sweep-1') && LIVE.get('intel-sweep-1')!.firstCycle === '2026-08-01',
      `[birth] the birth date is read from the STAMP, not the FILENAME: intel-sweep-1's first canary is 07:51 ET 08-01 written to the 08-02 BOARD, and its cycle is 08-01 (got ${LIVE.get('intel-sweep-1')?.firstCycle || 'NONE'}) — IMP-218's lesson does not get to reappear one layer up`
    );

    // ── IMP-221 · FIRED-AND-SILENT (2026-08-26 Critic mandate #2a) ─────────────────────────────
    // Every leg on the REAL 2026-08-26 board, at the REAL clock time the roll call ran, with the
    // REAL lastRunAt the scheduler reported. This is the night the detector said FULL ATTENDANCE.
    const t1931 = etWallClock('2026-08-25', 19, 31);
    const fs2026 = (m: Record<string, string>, now = t1931) =>
      rollCall({
        docRoot: root,
        date: '2026-08-26',
        now,
        replay: true,
        schedulerLastRun: new Map(Object.entries(m).map(([k, v]) => [k, parseTs(v)!])),
      }).firedAndSilent;
    const EDITOR_FIRED = '2026-08-25T23:20:18.472Z';
    const fired = fs2026({ 'brief-editor': EDITOR_FIRED });
    assert(
      fired.length === 1 && fired[0]!.task === 'brief-editor' && Math.round(fired[0]!.tPlusMin) === 11,
      `[fired] FIRES on the real 2026-08-26 brief-editor at T+11 — the discriminating test the 19:31 roll call failed with "✅ FULL ATTENDANCE" (got ${fired.map(f => `${f.task}@T+${f.tPlusMin.toFixed(0)}`).join(', ') || 'NOTHING'})`
    );
    assert(
      fs2026({ 'brief-editor': EDITOR_FIRED, 'brief-quality-gate': '2026-08-25T22:41:38Z' })
        .every(f => f.task !== 'brief-quality-gate'),
      '[fired] SILENT on brief-quality-gate — fired 22:41:38Z in the same cycle and wrote its own CANARY and SUCCESS lines. A slot that spoke is never accused for having been started.'
    );
    assert(
      fs2026({ 'brief-editor': EDITOR_FIRED }).every(f => f.task !== 'brief-light') &&
        fs2026({}).length === 0,
      '[fired] SILENT on genuinely not-yet-due slots with no lastRunAt in cycle (brief-light at 19:31), and SILENT with no scheduler evidence at all — this leg is EVIDENCE-DRIVEN, never inferred'
    );
    assert(
      fs2026({ 'brief-editor': '2026-08-20T23:20:00Z' }).length === 0,
      '[fired] a lastRunAt from ANOTHER cycle does not fire — the window is this board\'s own pipeline day, not "any time in the archive"'
    );
    assert(
      fs2026({ 'brief-editor': EDITOR_FIRED }, etWallClock('2026-08-25', 19, 25)).length === 0,
      `[fired] SILENT at T+5, inside the ${FIRED_GRACE_MIN}-min canary grace — the grace is real, so a slot that is merely STARTING is not a finding`
    );
    assert(
      ['2026-08-20', '2026-08-21', '2026-08-22'].every(
        d => rollCall({ docRoot: root, date: d }).firedAndSilent.length === 0
      ),
      '[fired] 08-20/21/22 read UNCHANGED — a new leg that needs a flag cannot re-grade the archive'
    );

    // ── 2026-08-26b · EMPTY-BODY (no STEP-0 CANARY) ──────────────────────────────────────────
    // Marker is on brief-editor only. Detector covers every rostered slot. Pin is the editor
    // outage: FIRE 08-21 through 08-26, SILENT 08-19. Critic-invoked canary on 08-23 is not STEP 0.
    const editorEmpty = (d: string) =>
      rollCall({ docRoot: root, date: d }).emptyBody.some(e => e.task === 'brief-editor');
    assert(
      ['2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26'].every(
        editorEmpty
      ),
      `[empty-body] FIRE on brief-editor 08-21 through 08-26 (got silent: ${['2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26'].filter(d => !editorEmpty(d)).join(', ') || 'none'})`
    );
    assert(
      !editorEmpty('2026-08-19'),
      '[empty-body] SILENT on brief-editor 08-19 — last clean STEP-0 CANARY (2026-08-18T19:09:37-0400)'
    );
    assert(
      bodiesMatchNormalized('pointer text\n', 'pointer text') &&
        bodiesMatchNormalized('foo  \nbar', 'foo\nbar') &&
        !bodiesMatchNormalized('pointer text', 'pointer text changed'),
      '[empty-body] trailing whitespace is stripped before a live-vs-snapshot diff — the scheduler drops the trailing newline'
    );
    const editorSkill = path.join(root, 'system', 'task-bodies', 'brief-editor', 'SKILL.md');
    assert(
      fs.existsSync(editorSkill) &&
        fs.readFileSync(editorSkill, 'utf8').includes('BODY_VERSION=brief-editor@2026-08-26b'),
      '[empty-body] executed brief-editor body carries BODY_VERSION=brief-editor@2026-08-26b (echoed on the STEP-0 canary)'
    );
    const editorSnap = path.join(root, 'system', 'task-bodies-snapshot', 'brief-editor', 'SKILL.md');
    assert(
      !fs.existsSync(editorSnap) ||
        !fs.readFileSync(editorSnap, 'utf8').includes('BODY_VERSION=brief-editor@2026-08-26b'),
      '[empty-body] the snapshot is the POINTER, not the 26 KB target — BODY_VERSION must not live there'
    );
    // 🔴 THE OTHER DIRECTION OF THE CORPUS FREEZE, AND THE ONLY REASON THE FREEZE IS SAFE
    // (IMP-211). Freezing the EXPECTATION set would be laundering if it also narrowed the
    // DETECTOR. It does not: this asserts a live catch on a board written AFTER the freeze —
    // 2026-08-22, where intel-sweep-5 has no line of any kind and the roll call named it, wrote
    // daily-briefs/2026-08-22-pipeline-alert.md and demanded the alarm email. That incident is
    // exactly what reddened this selftest before the fix. It must still FIRE, and it must fire
    // from the same code path the frozen sweep uses — if this ever goes quiet, the freeze has
    // stopped being a scoping decision and started being a blindfold.
    // 🔴 REWRITTEN 2026-08-24 (IMP-218). The old form of this assertion pinned a LIVE, MUTABLE
    // board: it demanded that `rollCall('2026-08-22')` fire intel-sweep-5. It went red not because
    // the detector broke but because THE EVIDENCE WAS FIXED — board 08-22 today carries two real
    // intel-sweep-5 lines (a canary and a terminal), so firing there would now be the false alarm.
    // That is the IMP-185 class ("a selftest fixture encoded a moving fact as a literal"), and a
    // pin that reddens when the world gets better teaches the next session to skim its own gate.
    // The PROPERTY the assertion is about is kept and proved on a fixture nobody else can edit:
    // strip a slot from the board AND from both siblings, and the detector must still name it.
    {
      const { fixtureRoot, removed } = blindnessFixture(root, '2026-08-22', 'intel-sweep-5');
      const gone = rollCall({ docRoot: root, boardRoot: fixtureRoot, date: '2026-08-22' });
      assert(
        removed >= 2 &&
          gone.exempt === false &&
          gone.absent.some(a => a.task === 'intel-sweep-5'),
        `[no-storm] and the freeze narrows the EXPECTATION, never the DETECTOR — on a POST-FREEZE board with intel-sweep-5's ${removed} real lines stripped from it and both siblings, the roll call still names it (got: ${gone.absent.map(a => a.task).join(', ') || 'NOTHING — the detector went blind'})`
      );
      // …AND THE OTHER DIRECTION, which is the whole of IMP-218: put the lines back on the SIBLING
      // board only — where the real intel-sweep-5 actually writes them — and the alarm must stop.
      const { fixtureRoot: sibOnly } = blindnessFixture(root, '2026-08-22', 'intel-sweep-5', {
        keepOnSiblings: true,
      });
      const rescued = rollCall({ docRoot: root, boardRoot: sibOnly, date: '2026-08-22' });
      assert(
        !rescued.absent.some(a => a.task === 'intel-sweep-5') &&
          rescued.crossBoard.has('intel-sweep-5'),
        `[no-storm] …and a slot that ran INSIDE this board's window but wrote to a SIBLING board is ATTENDED, with the proving line carried: ${rescued.crossBoard.get('intel-sweep-5')?.slice(0, 90) ?? 'NO RESCUE — the >=6-instance false alarm is back'}`
      );
      // The rescue is a WINDOW judgement, not a filename shrug: the same line dated 48h earlier is
      // outside board 08-22's cycle and must NOT buy attendance.
      const { fixtureRoot: stale } = blindnessFixture(root, '2026-08-22', 'intel-sweep-5', {
        keepOnSiblings: true,
        shiftHours: -240, // 10 days: far enough that NO sibling line lands back inside the window
      });
      const notRescued = rollCall({ docRoot: root, boardRoot: stale, date: '2026-08-22' });
      assert(
        notRescued.absent.some(a => a.task === 'intel-sweep-5'),
        `[no-storm] …and the rescue is a WINDOW judgement — the same sibling lines dated ten days earlier are OUTSIDE this board's cycle and do NOT excuse the slot (got: ${notRescued.absent.map(a => a.task).join(', ') || 'NOTHING — the window check is decorative'})`
      );
    }
  }

  // ── 6b. THE SELF-HEAL RULE, SWEPT OVER THE WHOLE ARCHIVE ─────────────────────────────────────
  //      Not over the in-window boards — the first cut of this rule passed the in-window sweep
  //      while being wrong on 25 of 26 historical cases, because those boards are EXEMPT. A rule
  //      about what a LINE means must be measured on every line, exempt or not.
  {
    const EDITOR_SH =
      '2026-08-20T23:40:32Z | brief-editor | daily-briefs/2026-08-21-v2.md | SUCCESS | SELF-HEAL (Critic-invoked): the scheduled brief-editor slot left NO trace on this board';
    const CRITIC_NARRATION =
      '2026-08-20T23:47:57Z | brief-critic | daily-briefs/2026-08-21-critic.md | SUCCESS | 🔴 ARTIFACT STATE FINAL (SELF-HEAL): the scheduled brief-editor slot NEVER FIRED — three polls';
    assert(
      selfHealedTask(EDITOR_SH) === 'brief-editor',
      '[selfheal] a line that declares the absence OF ITS OWN SLOT is coverage — brief-editor, 08-21 (real bytes)'
    );
    assert(
      selfHealedTask(CRITIC_NARRATION) === null,
      '[selfheal] the Critic line NARRATING that same self-heal is NOT coverage — it names brief-editor as the absent slot, and brief-critic plainly ran (real bytes; this is the 61→3 correction)'
    );
    assert(
      selfHealedTask(
        '2026-06-24T00:15:42Z | brief-editor | v2.md | SUCCESS | SELF-HEAL: Critic-invoked editor pass on v1.5; 9 fixes applied'
      ) === 'brief-editor',
      '[selfheal] and a HEALER MARKER alone suffices — "Critic-invoked" names an author other than the slot (06-24, real bytes)'
    );
    assert(
      selfHealedTask(
        '2026-07-11T00:10:05Z | brief-email | draft r-1616127471153053776 | SUCCESS | v2 (PROVISIONAL — self-heal copy) emailed'
      ) === null,
      '[selfheal] a payload that merely MENTIONS a self-heal is not one — brief-email sent the mail (07-11, real bytes)'
    );

    const bl = selfHealBlindness(root);
    // 🔴 DE-LITERALISED 2026-08-24 (IMP-214). This read `bl.coverage === 3` and went red the night
    // a FOURTH genuine self-heal was written (08-23 brief-editor) — the fifth instance of the
    // IMP-183/195/200/201 class: a count pinned to a growing record reddens precisely when the
    // record is up to date. The invariant is not the number. It is (a) the three originally-pinned
    // lines are STILL read as coverage, (b) coverage stays a small minority of token lines, so the
    // narrow rule has not silently re-broadened back to condemning the 61 narration lines.
    const covLines = coverageLines(root);
    const PINNED = ['2026-06-22', '2026-06-24', '2026-08-21'];
    const stillPinned = PINNED.filter(d => covLines.some(c => c.date === d && c.task === 'brief-editor'));
    assert(
      bl.token >= 50 &&
        stillPinned.length === PINNED.length &&
        bl.coverage === covLines.length &&
        bl.coverage <= Math.floor(bl.token * 0.15),
      `[selfheal] over the FULL archive (${bl.boards} boards): ${bl.token} self-heal-token lines, ${bl.coverage} read as coverage (<= ${Math.floor(bl.token * 0.15)} = 15% ceiling; the broad rule condemned 61) and all ${PINNED.length} originally-pinned lines survive [${stillPinned.join(', ')}]`
    );
    // IMP-214, both directions on the REAL 08-23 bytes: the retraction is not coverage…
    // REAL BYTES, read off the 08-23 board — never a paraphrase. The full line matters: it quotes
    // "(SELF-HEAL, Critic-invoked...)" inside its own narration, so HEALER_MARKER_RE matches and
    // the broad rule really did bank it as coverage for brief-critic. A truncated copy would have
    // made this assertion prove nothing.
    const RETRACTION_LINE =
      fs
        .readFileSync(boardPath(root, '2026-08-23'), 'utf8')
        .split('\n')
        .find(l => RETRACTION_RE.test(l)) ?? '';
    assert(
      selfHealedTask(RETRACTION_LINE) === null &&
        !covLines.some(c => RETRACTION_RE.test(c.line)),
      '[selfheal] a CANARY-RETRACTION is NOT coverage — brief-critic plainly ran and was covering for nobody (08-23, real bytes; this is the leg the 08-23 mandate #3 required and never shipped)'
    );
    // …and the silence is a JUDGEMENT, not a skip: strip the retraction token from the same bytes
    // and the line reverts to what the broad rule would have made of it.
    assert(
      RETRACTION_LINE.length > 200 &&
        selfHealedTask(RETRACTION_LINE.replace(/CANARY[- ]?RETRACTION/i, 'SELF-HEAL')) === 'brief-critic',
      '[selfheal] …and that silence is a JUDGEMENT, not a skip — the SAME real bytes with the retraction token swapped for a self-heal token DO read as coverage for brief-critic, which is exactly what the broad rule was banking'
    );
    // A retracted canary cannot launder an absent slot into an attended one.
    {
      const { fixtureRoot } = retractionFixture(root);
      const withRetraction = rollCall({ docRoot: root, boardRoot: fixtureRoot, date: '2026-08-23' });
      assert(
        withRetraction.absent.some(a => a.task === 'brief-editor'),
        `[selfheal] …and a RETRACTED canary does not buy attendance — brief-editor is still named absent on a board whose only brief-editor canary was retracted (got: ${withRetraction.absent.map(a => a.task).join(', ') || 'NOTHING — the retraction laundered an absent slot'})`
      );
    }
    // The residual is REPORTED with its denominator, and CROSS-CHECKED rather than wished to zero.
    // `blindSole` counts blind lines that are the task's only line that night — but most pipeline
    // tasks write exactly one line a night, so a sole line is normal, not evidence of a miss. The
    // assertion that means something is the cross-check: no slot the SECOND instrument accuses is
    // sitting unnoticed inside the blind set.
    const missed: string[] = [];
    {
      const dir = DB(root);
      for (const f of fs.readdirSync(dir).filter(x => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(x))) {
        const bpath = path.join(dir, f);
        const a = boardAttendance(bpath);
        for (const t of absenceTestimony(bpath).keys()) if (a.attended.has(t)) missed.push(`${f.slice(0, 10)}:${t}`);
      }
    }
    assert(
      missed.length === 0,
      `[selfheal] RESIDUAL CROSS-CHECKED: ${bl.blind}/${bl.token} self-heal-token lines carry neither marker and read as attendance (${bl.blindSole} of them the task's only line that night — normal, most tasks write one). What would be a real miss is a slot the TESTIMONY path accuses while the attendance path still credits it: ${missed.length === 0 ? 'none' : missed.join(', ')}`
    );
    assert(
      bl.blind + bl.coverage === bl.token,
      `[selfheal] and the residual accounts for itself — ${bl.coverage} coverage + ${bl.blind} blind = ${bl.token} token lines, no third bucket`
    );
  }

  // ── 6b-ii. THE SECOND INSTRUMENT ─────────────────────────────────────────────────────────────
  {
    const t21 = absenceTestimony(boardPath(root, '2026-08-21'));
    assert(
      t21.get('brief-editor') !== undefined,
      '[testimony] 2026-08-21 brief-editor is named absent by the SECOND, INDEPENDENT path too — the Critic testifies in writing that the slot NEVER FIRED. Two conventions, one verdict.'
    );
    assert(
      t21.size === 1,
      `[testimony] and it accuses exactly one slot that night, not the night (${[...t21.keys()].join(', ') || 'none'})`
    );
    // The contradiction guard, on the two real boards where testimony is WRONG.
    for (const [d, accused] of [['2026-08-13', 'brief-morning'], ['2026-08-17', 'brief-quality-gate']] as const) {
      const bpp = boardPath(root, d);
      if (!fs.existsSync(bpp)) continue;
      assert(
        !absenceTestimony(bpp).has(accused),
        `[testimony] ${d}: a line says "${accused} never ran" but ${accused} wrote clean lines of its own — testimony is OVERRIDDEN by the slot's own work (2 of 6 real testimony pairs are wrong this way)`
      );
    }
    assert(
      rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 23, 59) })
        .absent.every(a => a.evidence && a.evidence.length > 20),
      '[testimony] every absentee carries the BOARD’S OWN WORDS as evidence, not our paraphrase'
    );
  }

  // ── 6c. THE BOTH-LINES GUARD ─────────────────────────────────────────────────────────────────
  //      06-22 and 06-24 each carry a self-heal AND a genuine scheduled brief-editor line. The
  //      slot really ran; attendance must win and the coverage note must be dropped.
  for (const d of ['2026-06-22', '2026-06-24']) {
    const bp = boardPath(root, d);
    if (!fs.existsSync(bp)) continue;
    const a = boardAttendance(bp);
    assert(
      a.attended.has('brief-editor') && !a.selfHealed.has('brief-editor'),
      `[selfheal] ${d}: brief-editor self-healed EARLY then its scheduled pass landed — attendance wins, coverage dropped (a slot that ran is never condemned by having also been covered)`
    );
  }

  // ── 6d. THE BRACKETED DIALECT ────────────────────────────────────────────────────────────────
  assert(
    boardLineTask('[2026-06-23T23:58:04Z] | brief-editor | v2.md | SUCCESS | 2 validator runs') ===
      'brief-editor' &&
      lineTask('[2026-06-23T23:58:04Z] | brief-editor | v2.md | SUCCESS | 2 validator runs') === null,
    '[dialects] the [bracketed] timestamp form is READ here though editor-handoff-gate’s lineTask drops it — 12 such lines on the real boards, 8 of them brief-editor; an unparsed line would read as an absent slot'
  );

  // ── 6e. THE ALARM PATH ───────────────────────────────────────────────────────────────────────
  //      Written into a throwaway root — the selftest never touches a real alert file.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-alarm-'));
    fs.mkdirSync(path.join(tmp, 'daily-briefs'), { recursive: true });
    const rcA = rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-20', 23, 59) });
    const w1 = writeAlert(tmp, '2026-08-21', rcA);
    assert(
      w1.wrote.length === 1 && w1.wrote[0] === 'brief-editor' && fs.existsSync(w1.path),
      `[alarm] an absent slot WRITES A DURABLE ALERT FILE, not just a console line — ${path.basename(w1.path)} (${w1.wrote.join(', ')})`
    );
    const body = fs.readFileSync(w1.path, 'utf8');
    assert(
      body.includes('🔴 PIPELINE ALARM — brief-editor missing/failed for 2026-08-21') &&
        body.includes('cosmictrex11@gmail.com'),
      '[alarm] and it carries the EXACT subject and recipient the Controller mandates (L203), so the email is transcribed, never composed from memory'
    );
    assert(
      body.includes('SELF-HEAL') && body.includes('editor-handoff-gate --can-self-heal'),
      '[alarm] with the board’s own evidence and the named recovery step — an alert that does not say what to do is a second thing to triage'
    );
    const w2 = writeAlert(tmp, '2026-08-21', rcA);
    assert(
      w2.wrote.length === 0 && w2.skipped[0] === 'brief-editor',
      '[alarm] IDEMPOTENT — a second run on the same date does not duplicate the block (health-check + Critic both invoke this check, so double-firing is the normal case, not the edge case)'
    );
    // THE N/A STATE (standing rule: no metric ships without its N/A-state selftest).
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-alarm-na-'));
    fs.mkdirSync(path.join(tmp2, 'daily-briefs'), { recursive: true });
    const rcOK = rollCall({ docRoot: root, date: '2026-08-20', now: etWallClock('2026-08-19', 23, 59) });
    const w3 = writeAlert(tmp2, '2026-08-20', rcOK);
    assert(
      rcOK.absent.length === 0 && w3.wrote.length === 0 && !fs.existsSync(w3.path),
      '[alarm] N/A STATE: a full-attendance night creates NO alert file at all — an empty alarm file would read as an alarm that fired and found nothing, which is not the same thing as no alarm'
    );
    const rcEx = rollCall({ docRoot: root, date: '2026-05-17' });
    assert(
      writeAlert(tmp2, '2026-05-17', rcEx).wrote.length === 0,
      '[alarm] N/A STATE: an EXEMPT pre-canary date never alarms, however many slots are missing from it — the rule binds forward'
    );
  }

  // ── 6f. THE WIDENED ROSTER + DERIVED WINDOWS ─────────────────────────────────────────────────
  {
    const names2 = new Set(rollCall({ docRoot: root, date: '2026-08-21', windows: WIN }).rostered.map(r => r.task));
    assert(
      ['brief-editor', 'brief-morning', 'intel-sweep-1', 'intel-sweep-6', 'daily-improvement', 'pipeline-health-check', 'system-update'].every(t => names2.has(t)),
      `[roster] WIDENED to all scheduled slots, morning and evening — ${names2.size} rostered (was 10, evening-only)`
    );
    assert(
      ['verify-brief-publish', 'daily-portfolio-monitor'].every(t => names2.has(t)),
      '[roster] including slots that canary every day and appear in NO sequence table — the roster is derived from the archive, not transcribed from a document'
    );
    // The three stale table hours. Derived beats documented, and the gap is the receipt.
    for (const [t, docMin, expect] of [['pipeline-health-check', 11 * 60 + 6, 240], ['daily-improvement', 10 * 60 + 3, 180], ['system-update', 9 * 60 + 36, 150]] as const) {
      const w = WIN.get(t)!;
      const absMin = (PIPELINE_DAY_START_MIN + w.canaryP95) % 1440;
      assert(
        Math.abs(docMin - absMin - expect) <= 20 && w.canaryN >= 20,
        `[roster] the DOCUMENTED hour for ${t} is stale by ~${expect} min — table says ${fmtClock(docMin)}, archive says ${fmtClock(absMin)} across n=${w.canaryN} canaries. A window from the table would call it ABSENT every morning.`
      );
    }
    assert(
      rollCall({ docRoot: root, date: '2026-08-21', windows: WIN }).windowless.includes('selection-judge'),
      '[roster] N/A STATE: a slot with too few canaries to derive a window is NAMED windowless, never given a default — selection-judge is n=6 and bimodal (07:36 vs 21:12, 818-min spread), a p95 there describes neither mode'
    );
    assert(
      [...WIN.values()].every(w => !w.canaryComputable || w.canaryN >= MIN_N),
      `[roster] and no window is derived from fewer than MIN_N=${MIN_N} observations`
    );
  }

  // ── 6g. UNTERMINATED — the second rostered state ─────────────────────────────────────────────
  {
    const rcU = rollCall({ docRoot: root, date: '2026-08-21', now: etWallClock('2026-08-21', 13, 0), windows: WIN });
    const u = new Set(rcU.unterminated.map(x => x.task));
    assert(
      u.has('pipeline-health-check') && u.has('daily-improvement'),
      `[unterminated] 2026-08-21 names pipeline-health-check and daily-improvement — both canaried at 07:03/07:06 ET and wrote no terminal line (${[...u].join(', ') || 'none'})`
    );
    // 🔴 THE CONTAMINATION LEG. Over the whole in-force window these two sit at 67%/71% — merely
    // "intermittent", not worth a warning. That figure is computed over a window that CONTAINS the
    // outage. From the reference period alone they are 13/14 and 14/14 — RELIABLE — so the recent
    // silence is news. If this ever flips back the classifier has started normalising its own
    // failures again.
    for (const t of ['pipeline-health-check', 'daily-improvement']) {
      const w = WIN.get(t)!;
      assert(
        w.reliability === 'RELIABLE' && w.refClosed / w.refTotal >= 0.9 && w.recentClosed / w.recentTotal <= 0.2,
        `[unterminated] ${t} is classified from the REFERENCE period (${w.refClosed}/${w.refTotal}) not the contaminated whole (recent ${w.recentClosed}/${w.recentTotal}) — a base rate spanning the outage would rate this task "intermittent" and say nothing`
      );
    }
    // A task whose own norm is silence must not be accused nightly.
    assert(
      !u.has('intel-sweep-4') && WIN.get('intel-sweep-4')!.reliability === 'INTERMITTENT',
      '[unterminated] a slot whose REFERENCE record is already patchy (intel-sweep-4, 9/13) is NOT warned nightly — the check reports departures from a task’s own norm, not the norm itself'
    );
    assert(
      !rcU.unterminated.some(x => !WIN.get(x.task)!.latComputable),
      '[unterminated] N/A STATE: a slot with no computable latency window is never reported unterminated — weekly-draft has written 0 terminal lines ever, which is a convention gap to fix, not a nightly finding'
    );
    assert(
      rcU.unterminated.every(x => /reference period \d+\/\d+/.test(x.line)),
      '[unterminated] every finding carries the reference record inline, so a reader can tell news from norm without leaving the line'
    );
    assert(
      rollCall({ docRoot: root, date: '2026-05-17', windows: WIN }).unterminated.length === 0,
      '[unterminated] EXEMPT dates never report it — the rule binds forward, exactly as the ABSENT leg does'
    );
    // Warn-level only: the alarm path belongs to ABSENT.
    const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-unterm-'));
    fs.mkdirSync(path.join(tmp3, 'daily-briefs'), { recursive: true });
    const rcNoAbs = { ...rcU, absent: [] } as RollCall;
    assert(
      writeAlert(tmp3, '2026-08-21', rcNoAbs).wrote.length === 0,
      '[unterminated] WARN-LEVEL FIRST (owner ruling): an unterminated slot writes NO alert file and sends no email — only ABSENT alarms'
    );
  }

  // ── 7. TIMESTAMP DIALECTS — the boards carry all three, and a parse failure would read a
  //      present task as absent. (Not currently load-bearing for attendance, which is set
  //      membership, but --now/deadline arithmetic and any future ordering leg depend on it.)
  assert(
    parseTs('2026-08-20T23:40:32Z')!.toISOString() === '2026-08-20T23:40:32.000Z' &&
      parseTs('2026-08-20T17:28:16-04:00')!.toISOString() === '2026-08-20T21:28:16.000Z' &&
      parseTs('2026-08-20T17:47:37-0400')!.toISOString() === '2026-08-20T21:47:37.000Z',
    '[dialects] all three real board timestamp forms parse to the same instant: Z, -04:00, -0400'
  );
  assert(
    lineTask('2026-08-20T23:47:57Z | brief-critic | x.md | SUCCESS | the brief-editor slot NEVER FIRED') ===
      'brief-critic',
    '[dialects] a brief-critic line that NARRATES brief-editor is owned by brief-critic (IMP-184: the task is field 2, never a substring)'
  );

  console.log(`\n${fails === 0 ? '✅' : '❌'} pipeline-slot-attendance --selftest: ${total - fails}/${total} assertions passed.`);
  return fails === 0 ? 0 : 1;
}

// ---------- main ----------

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  const date = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error(
      'usage: pipeline-slot-attendance.ts <YYYY-MM-DD> [--now HH:MM] [--json]\n' +
        '       pipeline-slot-attendance.ts --selftest'
    );
    process.exit(2);
  }

  let now = new Date();
  const nowIdx = argv.indexOf('--now');
  if (nowIdx >= 0) {
    const v = argv[nowIdx + 1];
    if (!v) {
      console.error('--now requires a value (HH:MM in ET, or a full ISO timestamp)');
      process.exit(2);
    }
    const hm = v.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      // HH:MM is ET wall clock on the EVENING of the run (BRIEF_DATE − 1) — the only window in
      // which the answer can change. Past midnight, pass a full ISO timestamp instead.
      now = etWallClock(eveningDateOf(date), +hm[1]!, +hm[2]!);
    } else {
      const p = parseTs(v);
      if (!p) {
        console.error(`--now: could not parse "${v}" (want HH:MM in ET, or a full ISO timestamp)`);
        process.exit(2);
      }
      now = p;
    }
  }

  // IMP-221: --scheduler-lastrun <task>=<ISO>, repeatable. Get the values from
  // list_scheduled_tasks; `NEVER` and an unparseable stamp are REFUSED rather than dropped, because
  // a flag that silently ignores its argument is a leg that silently does not run.
  const schedulerLastRun = new Map<string, Date>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--scheduler-lastrun') continue;
    const spec = argv[i + 1];
    const eq = spec ? spec.indexOf('=') : -1;
    if (!spec || eq <= 0) {
      console.error('--scheduler-lastrun requires <task>=<ISO timestamp> (repeatable)');
      process.exit(2);
    }
    const ts = parseTs(spec.slice(eq + 1));
    if (!ts) {
      console.error(`--scheduler-lastrun: could not parse "${spec.slice(eq + 1)}" as a timestamp`);
      process.exit(2);
    }
    schedulerLastRun.set(spec.slice(0, eq), ts);
  }

  const cwdRoot = process.cwd();
  const rc = rollCall({ docRoot: cwdRoot, date, now, replay: nowIdx >= 0, schedulerLastRun });

  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          date: rc.date,
          eveningDate: rc.eveningDate,
          now: rc.now.toISOString(),
          graceMin: GRACE_MIN,
          effectiveFrom: EFFECTIVE_FROM,
          exempt: rc.exempt,
          rostered: rc.rostered.map(s => s.task),
          droppedNeverObserved: rc.dropped,
          attended: rc.attended,
          notYetDue: rc.notYetDue,
          firedAndSilent: rc.firedAndSilent.map(f => ({
            task: f.task,
            firedAt: f.firedAt.toISOString(),
            tPlusMin: Math.round(f.tPlusMin),
          })),
          emptyBody: rc.emptyBody.map(e => ({ task: e.task, line: e.line })),
          missing: rc.absent.map(a => ({
            task: a.task,
            scheduled: a.clock,
            deadline: a.deadline.toISOString(),
            line: a.line,
          })),
        },
        null,
        2
      )
    );
    process.exit(rc.firedAndSilent.length || rc.emptyBody.length ? 1 : 0);
  }

  console.log(`pipeline-slot-attendance ${date} (evening of ${rc.eveningDate}, now ${fmtET(rc.now)})`);
  console.log(
    `   roster ${rc.rostered.length} slot(s), morning + evening, DERIVED from the archive (windows p95, n>=${MIN_N})` +
      (rc.dropped.length
        ? ` · ${rc.dropped.length} documented-but-never-observed slot(s) NOT rostered: ${rc.dropped.join(', ')}`
        : '')
  );
  console.log(
    `   attended ${rc.attended.length} · not-yet-due ${rc.notYetDue.length} · MISSING ${rc.absent.length} · EMPTY-BODY ${rc.emptyBody.length} · UNTERMINATED ${rc.unterminated.length}` +
      (rc.windowless.length ? ` · ${rc.windowless.length} slot(s) NOT ROSTERED, window not computable: ${rc.windowless.join(', ')}` : '')
  );
  // IMP-221. Printed BEFORE the attendance verdict, and it overrides it: on 2026-08-26 the verdict
  // line said FULL ATTENDANCE eleven minutes into a brief-editor that never wrote anything.
  const printFiredSilent = () => {
    if (!rc.firedAndSilent.length) return;
    console.log(`\n🔴 FIRED-AND-SILENT — the scheduler started these slots this cycle and they wrote no STEP-0 CANARY:`);
    for (const f of rc.firedAndSilent) console.log('   ' + f.line);
    console.log(
      `   This OUTRANKS the attendance verdict below: a derived p95 window answers "when does this slot\n` +
        `   usually speak", never "was it started". Where the two disagree, the scheduler is the one holding\n` +
        `   evidence. Next: editor-handoff-gate --can-self-heal ${date} (branch on the status line).`
    );
  };
  const printEmptyBody = () => {
    if (!rc.emptyBody.length) return;
    console.log(`\n🔴 EMPTY-BODY — fired in window, no STEP-0 CANARY:`);
    for (const e of rc.emptyBody) console.log('   ' + e.line);
    console.log(
      `   Attendance (any line) is not the discriminator. A self-heal SUCCESS hid 08-21/08-22.\n` +
        `   A live session writes a CANARY as STEP 0; its absence is empty-body or dead.`
    );
  };
  const printUnterminated = () => {
    if (!rc.unterminated.length) return;
    console.log(`\n🟡 UNTERMINATED (WARN-LEVEL — never blocks, never emails):`);
    for (const u of rc.unterminated) console.log('   ' + u.line);
    console.log(
      `   THIS ANSWERS "DID IT REPORT", NOT "IS IT DEAD" — the same scope limit the MISSING leg carries.\n` +
        `   Receipt, 2026-08-21: daily-improvement wrote no terminal line on six of the last seven boards\n` +
        `   and wrote Improvement_Ledger rows on every one of them. That is silent COMPLETION, and the\n` +
        `   artifact is what tells the two apart — not this list.`
    );
  };
  if (rc.exempt) {
    console.log(
      `\n➖ EXEMPT — ${date} predates EFFECTIVE_FROM ${EFFECTIVE_FROM}, before the CANARY protocol was the norm.\n` +
        `   The pre-August boards do not carry a line per stage, so a roll call over them reports absence where\n` +
        `   there was only a different convention (a sweep of the full archive fires on 71 of 92 boards for that\n` +
        `   reason alone). The rule binds forward, never backward.`
    );
    process.exit(0);
  }
  if (!rc.absent.length) {
    printFiredSilent();
    printEmptyBody();
    console.log(
      rc.firedAndSilent.length || rc.emptyBody.length
        ? '\n⛔ NOT FULL ATTENDANCE — a rostered slot is silent on STEP-0 CANARY (scheduler-fired and/or empty-body).'
        : '\n✅ FULL ATTENDANCE — every due slot for this brief date, morning and evening, left a line of its own.'
    );
    printUnterminated();
    if (rc.firedAndSilent.length || rc.emptyBody.length) process.exit(1);
    process.exit(process.argv.includes('--red') && rc.unterminated.length ? 1 : 0);
  }
  printFiredSilent();
  printEmptyBody();
  printUnterminated();
  console.log('');
  for (const a of rc.absent) {
    console.log(a.line);
    console.log(`   evidence: ${a.evidence}`);
  }

  // THE ALARM — on the state, not on a flag. See "the alarm path" above.
  const al = writeAlert(cwdRoot, date, rc);
  console.log(`\n🔴 ALARM WRITTEN — ${al.path}`);
  if (al.wrote.length) console.log(`   new alert block(s): ${al.wrote.join(', ')}`);
  if (al.skipped.length) console.log(`   already alarmed for this date, not duplicated: ${al.skipped.join(', ')}`);
  console.log(
    `\n📧 ALARM EMAIL REQUIRED — this script cannot send mail; the transport is deliberately independent\n` +
      `   of the workspace mount (Pipeline_Controller, ENVIRONMENT CANARY & ZERO-WRITE ALARM). Send now:\n` +
      rc.absent.map(a => `     To: cosmictrex11@gmail.com\n     Subject: ${ALARM_SUBJECT(a.task, date)}\n     Body:    ${a.line} · ${a.evidence}`).join('\n')
  );
  console.log(
    `\n⚠️  ${rc.absent.length} slot(s) NOT OBSERVED TO HAVE RUN (advisory — this check never blocks the brief).\n` +
      `   "Not observed" is wider than "no line": a slot whose only line is another task's SELF-HEAL, or\n` +
      `   one the board testifies never fired, did not write that line and is counted absent. See evidence.\n` +
      `   A task that never starts writes no canary, so no liveness gate can see it: --liveness, --qg-liveness,\n` +
      `   the RACE GUARD and the OWED-EDITOR GUARD all begin from a line the task wrote.\n` +
      `   THIS CHECK ANSWERS "did it start", NOT "is it dead". Run mid-evening (an early --now), a slot listed\n` +
      `   here may simply be RUNNING LATE and about to write — 2026-08-21's brief-light was 30 min behind at\n` +
      `   19:35 ET and finished fine. The discriminator is the artifact, not this list:\n` +
      `     editor-handoff-gate --liveness ${date} --scheduler-lastrun <ISO|NEVER>   (is the Editor still writing?)\n` +
      `     editor-handoff-gate --qg-liveness ${date}                                (is the QG still writing?)\n` +
      `   Run after the chain should have closed and a slot still listed here NEVER FIRED. Re-run it, or\n` +
      `   self-heal downstream (editor-handoff-gate --can-self-heal ${date} --scheduler-lastrun <ISO|NEVER>) and say\n` +
      `   on the board that you did. IMP-216: exit 3 = SELF-HEAL UNKNOWN is NOT permission — get brief-editor.lastRunAt\n` +
      `   from list_scheduled_tasks and re-run. A Critic-invoked self-heal canaries as brief-editor-selfheal.\n` +
      `   Receipt: 2026-08-21, brief-editor, zero lines — the Critic ran the whole Editor pass at 23:40:32Z.`
  );
  // Exit code: 0 by default, because Pipeline_Controller L591 and Brief_Critic leg (iv) both ship
  // this check as warn-level and must never block a brief. `--red` is for a caller that wants the
  // non-zero exit. The DETECTION above does not depend on either — it already happened.
  process.exit(process.argv.includes('--red') || rc.firedAndSilent.length || rc.emptyBody.length ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('pipeline-slot-attendance')) main();
