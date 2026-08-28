/**
 * cadence.ts — ONE SOURCE OF TRUTH FOR HOW OFTEN A COMPONENT IS SUPPOSED TO RUN (work order W3).
 *
 * THE CLASS THIS ENDS: `daily-improvement` moved to a weekly cadence on 2026-08-26 and every checker
 * that had "daily" written into it started reporting a healthy component dead. An accountability
 * layer that is wrong about the denominator produces alarms on exactly the days it should be
 * trusted — and the fix is never to tune the alarm, it is to stop each checker from having its own
 * private opinion about the schedule.
 *
 * Consumers: pipeline-slot-attendance (absence), verify-improvements (starvation budgets), the
 * cycle checks. None of them may hardcode "daily" again.
 */
import * as fs from 'fs';
import * as path from 'path';

export const CADENCE_FILE = 'system/slot-cadence.json';
export type Cadence = 'daily' | 'weekly' | 'paused';
export interface CadenceEntry { cadence: Cadence; dow?: number; source?: string; evidence?: string; falsifier?: string }

export function loadCadence(root = process.cwd()): Record<string, CadenceEntry> {
  const p = path.join(root, CADENCE_FILE);
  if (!fs.existsSync(p)) return {};
  return (JSON.parse(fs.readFileSync(p, 'utf-8')).tasks ?? {}) as Record<string, CadenceEntry>;
}

export function cadenceFor(task: string, roster: Record<string, CadenceEntry>): CadenceEntry {
  return roster[task] ?? roster['_default'] ?? { cadence: 'daily', source: 'assumed' };
}

const dowOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
};

/** Is this component EXPECTED to run for this board date? A weekly one is due only on its day. */
export function isDue(task: string, iso: string, roster: Record<string, CadenceEntry>): boolean {
  const e = cadenceFor(task, roster);
  if (e.cadence === 'paused') return false;
  if (e.cadence === 'weekly') return e.dow === undefined ? false : dowOf(iso) === e.dow;
  return true;
}

/**
 * How many days a Critical row may sit before it is STARVED, given the cadence of the component
 * that would clear it. Daily: 2 days (IMP-223, unchanged). Weekly: the next scheduled run + 1, so
 * a row raised the day after a weekly run is not starved for merely existing during the week.
 */
export function starveBudgetDays(task: string, iso: string, roster: Record<string, CadenceEntry>, dailyBudget = 2): number {
  const e = cadenceFor(task, roster);
  if (e.cadence === 'daily') return dailyBudget;
  if (e.cadence === 'paused') return Number.POSITIVE_INFINITY;
  if (e.dow === undefined) return Number.POSITIVE_INFINITY;
  const today = dowOf(iso);
  const until = (e.dow - today + 7) % 7 || 7; // days to the NEXT run (never 0 — today's already gone)
  return until + 1;
}

function main(): void {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  if (argv.includes('--selftest')) {
    let pass = 0, fail = 0;
    const t = (n: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${n}`); };
    const R = loadCadence(root);
    t('[roster] loads and carries daily-improvement', !!R['daily-improvement']);
    t('[roster] EVERY entry carries a falsifier — an entry with no falsifier is a belief, not a record',
      Object.entries(R).filter(([k]) => !k.startsWith('_')).every(([, v]) => !!(v as CadenceEntry).falsifier));
    // 'contested' is a third, load-bearing state: two readings disagree and the entry is set to
    // whichever KEEPS THE ALARM ON. Admitting it beats picking a side quietly.
    t('[roster] every entry declares its epistemic status — measured, declared, or contested — so a reader can tell what was observed from what was asserted',
      Object.entries(R).filter(([k]) => !k.startsWith('_')).every(([, v]) => ['measured', 'declared', 'contested'].includes(String((v as CadenceEntry).source).split(' ')[0]) ||
        String((v as CadenceEntry).source).startsWith('owner-observed')));

    // 🔴 THE MECHANISM ON A FIXTURE, not on today's roster. An earlier revision asserted these
    // against the LIVE entry for daily-improvement — and when that entry was corrected from
    // "weekly" to "contested/daily" the tests went red without a line of logic changing. Third
    // instance in one session of the same defect: **a test that asserts today's world is a clock.**
    const FX: Record<string, CadenceEntry> = {
      'weekly-sat': { cadence: 'weekly', dow: 6, source: 'measured', falsifier: 'x' },
      'weekly-sun': { cadence: 'weekly', dow: 0, source: 'measured', falsifier: 'x' },
      'daily-thing': { cadence: 'daily', source: 'measured', falsifier: 'x' },
      'paused-thing': { cadence: 'paused', source: 'measured', falsifier: 'x' },
      _default: { cadence: 'daily', source: 'measured', falsifier: 'x' },
    };
    t('[W3] a WEEKLY/Saturday component is not due Thu or Fri, and IS due Saturday',
      !isDue('weekly-sat', '2026-08-27', FX) && !isDue('weekly-sat', '2026-08-28', FX) && isDue('weekly-sat', '2026-08-29', FX));
    t('[W3] and Sunday is quiet again — the exemption is one day wide, not a permanent excuse',
      !isDue('weekly-sat', '2026-08-30', FX));
    t('[W3] a DAILY component is due every day, including the days the weekly one is not',
      isDue('daily-thing', '2026-08-27', FX) && isDue('daily-thing', '2026-08-29', FX));
    t('[W3] a Sunday-weekly is due 08-30 and not 08-29', isDue('weekly-sun', '2026-08-30', FX) && !isDue('weekly-sun', '2026-08-29', FX));
    t('[W3] a PAUSED component is never due, and never alarms', !isDue('paused-thing', '2026-08-29', FX));
    t('[W3] a daily component keeps the 2-day Critical budget (IMP-223 unchanged)', starveBudgetDays('daily-thing', '2026-08-27', FX) === 2);
    t('[W3] a weekly component gets next-run+1 — Thursday to Saturday is 2 days, so budget 3', starveBudgetDays('weekly-sat', '2026-08-27', FX) === 3);
    t('[W3] and on its own run-day the budget is a full week + 1, not zero', starveBudgetDays('weekly-sat', '2026-08-29', FX) === 8);
    t('[W3] a paused component can never starve a row', starveBudgetDays('paused-thing', '2026-08-29', FX) === Number.POSITIVE_INFINITY);
    t('[W3] an UNKNOWN task falls back to the default and is treated as daily', starveBudgetDays('nobody', '2026-08-27', FX) === 2 && isDue('nobody', '2026-08-27', FX));

    // 🔴 THE MECHANISM ON FIXTURES, NOT ON TODAY'S ROSTER. These two legs used to assert the LIVE
    // daily-improvement entry ("is contested", "is set to daily"). On 2026-08-28 the owner READ THE
    // SCHEDULER CARDS — both weekly — the contest resolved, the roster was corrected, and these tests
    // went red without one line of logic changing. FOURTH instance of the same defect in this repo.
    // The property worth protecting is not what the roster says today; it is that a CONTESTED entry
    // resolves toward the alarm, and that an owner reading outranks a board inference.
    const CONTESTED_FX: Record<string, CadenceEntry> = {
      'fx-contested': { cadence: 'daily', dow: 6, source: 'contested', falsifier: 'resolves 2026-08-29' } as CadenceEntry,
      'fx-owner': { cadence: 'weekly', dow: 6, source: 'owner-observed 2026-08-28', falsifier: 'no line by Saturday + grace' } as CadenceEntry,
    };
    t('[R6] a CONTESTED entry keeps its alarm ON — it reads daily while the question is open, because a cadence claim that silences an alarm must never be merely declared',
      cadenceFor('fx-contested', CONTESTED_FX).cadence === 'daily' && isDue('fx-contested', '2026-08-27', CONTESTED_FX));
    t('[R6] an OWNER-OBSERVED entry outranks a board inference and may go weekly — the owner can read the scheduler; no session can',
      cadenceFor('fx-owner', CONTESTED_FX).cadence === 'weekly' && !isDue('fx-owner', '2026-08-27', CONTESTED_FX));
    t('[R6] and a weekly component still ALARMS on its own missed day — resolution narrows the window, it never removes the check',
      isDue('fx-owner', '2026-08-29', CONTESTED_FX));

    console.log(`\n${fail ? '❌' : '✅'} cadence --selftest: ${pass}/${pass + fail} assertions passed.`);
    process.exit(fail ? 1 : 0);
  }
  const R = loadCadence(root);
  const date = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10);
  console.log(`cadence roster — ${date} (dow ${dowOf(date)})`);
  for (const [k, v] of Object.entries(R)) {
    if (k.startsWith('_')) continue;
    console.log(`  ${k.padEnd(30)} ${v.cadence.padEnd(7)} ${v.source === 'declared' ? '⚠️ DECLARED' : 'measured  '}  due=${isDue(k, date, R)}  starve-budget=${starveBudgetDays(k, date, R)}d`);
  }
  process.exit(0);
}

if (process.argv[1] && process.argv[1].includes('cadence')) main();
