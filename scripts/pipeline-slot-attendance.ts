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
export function boardTasks(file: string, asOf?: Date): Set<string> {
  const out = new Set<string>();
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = lineTask(raw);
    if (!t) continue;
    if (asOf) {
      const ts = parseTs(raw);
      if (ts && ts.getTime() > asOf.getTime()) continue;
    }
    out.add(t);
  }
  return out;
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
}

export function rollCall(opts: {
  docRoot: string;          // repo root holding system/Pipeline_Controller.md + the archive
  boardRoot?: string;       // repo root holding the board under test (defaults to docRoot)
  date: string;
  now?: Date;
  /** Reconstruct the board as it stood at `now` (see boardTasks). Set by `--now`; never by default. */
  replay?: boolean;
}): RollCall {
  const docRoot = opts.docRoot;
  const boardRoot = opts.boardRoot ?? docRoot;
  const now = opts.now ?? new Date();
  const eveningDate = eveningDateOf(opts.date);

  const documented = eveningSlots(docRoot);
  const observed = observedTasks(docRoot);
  // If the archive is empty (a fresh clone), roster everything — a filter with no evidence behind
  // it must not silently shrink the roll call.
  const haveArchive = observed.size > 0;
  const rostered = haveArchive ? documented.filter(s => observed.has(s.task)) : documented;
  const dropped = documented.filter(s => !rostered.includes(s)).map(s => s.task);

  const present = boardTasks(
    boardPath(boardRoot, opts.date),
    opts.replay ? now : undefined
  );

  const notYetDue: string[] = [];
  const attended: string[] = [];
  const absent: Absentee[] = [];
  // The pre-canary archive is exempt, not innocent and not guilty — it was never asked. See
  // EFFECTIVE_FROM. Attendance is still computed and reported; only the ALARM is suppressed.
  const exempt = opts.date < EFFECTIVE_FROM;

  for (const s of rostered) {
    const deadline = new Date(
      etWallClock(eveningDate, s.hh, s.mm).getTime() + GRACE_MIN * 60000
    );
    if (present.has(s.task)) {
      attended.push(s.task);
      continue;
    }
    if (now.getTime() < deadline.getTime()) {
      notYetDue.push(s.task); // blindness (2): not due is not absent
      continue;
    }
    if (exempt) continue;
    absent.push({
      task: s.task,
      clock: s.clock,
      deadline,
      line: `MISSING-SLOT: ${s.task} — expected by ${fmtET(deadline)}, no canary at ${fmtET(now)}`,
    });
  }
  return { date: opts.date, eveningDate, now, rostered, dropped, notYetDue, attended, absent, exempt };
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
  assert(
    !boardOK || early!.absent.some(a => a.task === 'brief-editor'),
    `[fire] the UNTOUCHED 08-21 board at 19:35 ET also names brief-editor (absent: ${early?.absent.map(a => a.task).join(', ') || 'none'})`
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
  assert(
    !boardOK || !rc21!.attended.some(t => /intel-sweep/.test(t)),
    '[routing] nor counted as attendance for anything — a daytime row cannot service an evening slot'
  );
  assert(
    !boardOK || rc21!.absent.length === 0,
    `[routing] the LIVE 08-21 board is silent overall: brief-editor's self-heal line services the slot (ANY line, not only CANARY) — absent ${rc21?.absent.length}`
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
    const inWindow = boards.filter(d => d >= EFFECTIVE_FROM);
    const noisy = inWindow
      .map(d => ({ d, n: rollCall({ docRoot: root, date: d }).absent.length }))
      .filter(x => x.n > 0);
    assert(
      inWindow.length >= 14 && noisy.length === 0,
      `[no-storm] SILENT on all ${inWindow.length} real boards from ${EFFECTIVE_FROM} onward${noisy.length ? ' — NOISY: ' + noisy.map(x => `${x.d}(${x.n})`).join(', ') : ''}`
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

  const rc = rollCall({ docRoot: process.cwd(), date, now, replay: nowIdx >= 0 });

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
    process.exit(0);
  }

  console.log(`pipeline-slot-attendance ${date} (evening of ${rc.eveningDate}, now ${fmtET(rc.now)})`);
  console.log(
    `   roster ${rc.rostered.length} evening slot(s) from system/Pipeline_Controller.md` +
      (rc.dropped.length
        ? ` · ${rc.dropped.length} documented-but-never-observed slot(s) NOT rostered: ${rc.dropped.join(', ')}`
        : '')
  );
  console.log(
    `   attended ${rc.attended.length} · not-yet-due ${rc.notYetDue.length} · MISSING ${rc.absent.length}`
  );
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
    console.log('\n✅ FULL ATTENDANCE — every due evening slot for this brief date left a line on the board.');
    process.exit(0);
  }
  console.log('');
  for (const a of rc.absent) console.log(a.line);
  console.log(
    `\n⚠️  ${rc.absent.length} slot(s) with NO LINE ON THE BOARD (advisory — this check never blocks the brief).\n` +
      `   A task that never starts writes no canary, so no liveness gate can see it: --liveness, --qg-liveness,\n` +
      `   the RACE GUARD and the OWED-EDITOR GUARD all begin from a line the task wrote.\n` +
      `   THIS CHECK ANSWERS "did it start", NOT "is it dead". Run mid-evening (an early --now), a slot listed\n` +
      `   here may simply be RUNNING LATE and about to write — 2026-08-21's brief-light was 30 min behind at\n` +
      `   19:35 ET and finished fine. The discriminator is the artifact, not this list:\n` +
      `     editor-handoff-gate --liveness ${date}      (is the Editor still writing?)\n` +
      `     editor-handoff-gate --qg-liveness ${date}   (is the QG still writing?)\n` +
      `   Run after the chain should have closed and a slot still listed here NEVER FIRED. Re-run it, or\n` +
      `   self-heal downstream (editor-handoff-gate --can-self-heal) and say on the board that you did.\n` +
      `   Receipt: 2026-08-21, brief-editor, zero lines — the Critic ran the whole Editor pass at 23:40:32Z.`
  );
  process.exit(0); // ADVISORY, ALWAYS. pipeline-health-check must never block a brief.
}

if (process.argv[1] && process.argv[1].includes('pipeline-slot-attendance')) main();
