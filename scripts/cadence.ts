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
    t('[roster] and every DECLARED entry says so, so a reader can tell what was measured from what was asserted',
      Object.entries(R).filter(([k]) => !k.startsWith('_')).every(([, v]) => ['measured', 'declared'].includes(String((v as CadenceEntry).source))));

    // 🔴 THE TWO CASES W3 NAMES, side by side.
    // 2026-08-27 (Thu) and 08-28 (Fri): daily-improvement is weekly/Sat, so it is NOT due — no alarm.
    t('[W3] NO false alarm — daily-improvement is not due on 2026-08-27 (Thu) or 2026-08-28 (Fri) under its true cadence',
      !isDue('daily-improvement', '2026-08-27', R) && !isDue('daily-improvement', '2026-08-28', R));
    t('[W3] …and a GENUINELY missed Saturday still fires — 2026-08-29 is a Saturday and it IS due',
      isDue('daily-improvement', '2026-08-29', R));
    t('[W3] selection-judge follows the same order it stopped on the same day as', !isDue('selection-judge', '2026-08-27', R) && isDue('selection-judge', '2026-08-29', R));
    t('[W3] a DAILY component is due every day, including the days the weekly one is not',
      isDue('system-update', '2026-08-27', R) && isDue('system-update', '2026-08-29', R));
    t('[W3] accountability-cycle-weekly is due on Sundays only — 08-30 yes, 08-29 no',
      isDue('accountability-cycle-weekly', '2026-08-30', R) && !isDue('accountability-cycle-weekly', '2026-08-29', R));
    t('[W3] a PAUSED component is never due, and never alarms', !isDue('source-health-check-monthly', '2026-08-29', R));

    // Starvation budgets read cadence, never "daily".
    t('[W3] a daily component keeps the 2-day Critical budget (IMP-223 unchanged)', starveBudgetDays('system-update', '2026-08-27', R) === 2);
    t('[W3] a weekly component gets next-run+1 — Thursday to Saturday is 2 days, so budget 3',
      starveBudgetDays('daily-improvement', '2026-08-27', R) === 3);
    t('[W3] and on its own run-day the budget is a full week + 1, not zero — a row raised just after a weekly run is not starved for existing during the week',
      starveBudgetDays('daily-improvement', '2026-08-29', R) === 8);
    t('[W3] a paused component can never starve a row', starveBudgetDays('source-health-check-monthly', '2026-08-29', R) === Number.POSITIVE_INFINITY);
    t('[W3] an UNKNOWN task falls back to the default and is treated as daily — the fallback is explicit in the roster, not implicit in the code',
      starveBudgetDays('some-new-task', '2026-08-27', R) === 2 && isDue('some-new-task', '2026-08-27', R));

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
