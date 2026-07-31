#!/usr/bin/env node --experimental-strip-types
/**
 * weekday-date-consistency.ts — a DETERMINISTIC calendar check that a stated
 * weekday actually matches the absolute date it is pinned to.
 *
 * WHY (2026-07-25 — IMP-098). The 07-25 Critic emitted a 🔴 top-priority "truth"
 * mandate: "M&M-1 'at midnight Friday' is wrong — tariffs took effect July 24,
 * 2026 — Thursday, not Friday. Correct to 'on Thursday'." But July 24, 2026 is a
 * FRIDAY (the system clock, `date -d 2026-07-24`, and every USTR source agree the
 * tariffs took effect Fri July 24). The brief was CORRECT; the Critic miscalculated
 * the weekday, and the false "Thursday" propagated into Current_Worldview_v5.md and
 * Quality_Tracker_final.md as resolved truth. Had a less-careful morning gate
 * "obeyed" that mandate, it would have injected an error into the published archive
 * under the banner of truth — the single scariest failure mode in this system.
 *
 * fact-gate already checks RELEASE-date weekdays against a hard-coded macro calendar
 * (IMP-044) and corporate-event weekdays (IMP-082), but NOTHING checks the general
 * class: any prose that pairs a weekday word with an absolute date (word-form
 * "Thursday, July 24" / "July 24, 2026 — Thursday", or ISO "Friday 2026-07-24").
 * A weekday pinned to a date is a PURE CALENDAR FACT — it needs no web lookup, only
 * arithmetic — so it can and must be mechanized. This gate FIRES on any pairing whose
 * weekday ≠ the true calendar weekday, and stays SILENT on a bare weekday with no
 * adjacent absolute date (so the correct brief — "at midnight Friday" with no date —
 * is never flagged). It runs on the brief AND on the Critic report, so a future
 * Critic cannot ship a weekday-based truth mandate the calendar disproves.
 *
 * Usage:
 *   node --experimental-strip-types scripts/weekday-date-consistency.ts <file.md> [--year YYYY]
 *   node --experimental-strip-types scripts/weekday-date-consistency.ts --selftest
 * Exit: 0 consistent (or silent) · 1 a weekday↔date mismatch was found · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WD = '(sun|mon|tues?|wednes?|thurs?|fri|satur)(?:day)?';
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

function wdIndex(word: string): number {
  const w = word.toLowerCase();
  // Normalise the abbreviation classes the regex can capture.
  if (w.startsWith('sun')) return 0;
  if (w.startsWith('mon')) return 1;
  if (w.startsWith('tue')) return 2;
  if (w.startsWith('wed')) return 3;
  if (w.startsWith('thu')) return 4;
  if (w.startsWith('fri')) return 5;
  if (w.startsWith('sat')) return 6;
  return -1;
}

function trueWeekday(year: number, month0: number, day: number): number {
  // UTC to avoid any timezone drift; getUTCDay() → 0=Sun..6=Sat.
  return new Date(Date.UTC(year, month0, day)).getUTCDay();
}

export interface Mismatch { stated: string; date: string; calendar: string; context: string; }

export function findMismatches(text: string, defaultYear: number): Mismatch[] {
  const out: Mismatch[] = [];
  const push = (statedWd: string, y: number, m0: number, d: number, ctx: string) => {
    const stated = wdIndex(statedWd);
    if (stated < 0) return;
    if (m0 < 0 || m0 > 11 || d < 1 || d > 31) return;
    const cal = trueWeekday(y, m0, d);
    if (cal !== stated) {
      out.push({
        stated: WEEKDAYS[stated]![0]!.toUpperCase() + WEEKDAYS[stated]!.slice(1),
        date: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m0]} ${d}, ${y}`,
        calendar: WEEKDAYS[cal]![0]!.toUpperCase() + WEEKDAYS[cal]!.slice(1),
        context: ctx.replace(/\s+/g, ' ').trim().slice(0, 140),
      });
    }
  };

  // (1) weekday THEN word-date: "Thursday, July 24" / "Thursday July 24, 2026"
  const reWordFwd = new RegExp(`\\b${WD}\\b,?\\s+${MON}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?`, 'gi');
  // (2) word-date THEN weekday (dash / paren / comma / "a"): "July 24, 2026 — Thursday", "July 24 (Thursday)"
  const reWordBack = new RegExp(`${MON}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s*[—\\-–(,]\\s*(?:a\\s+)?\\b${WD}\\b`, 'gi');
  // (3) weekday THEN ISO: "Friday 2026-07-24"
  const reIsoFwd = new RegExp(`\\b${WD}\\b,?\\s+(\\d{4})-(\\d{2})-(\\d{2})`, 'gi');
  // (4) ISO THEN weekday: "2026-07-24 (Friday)"
  const reIsoBack = new RegExp(`(\\d{4})-(\\d{2})-(\\d{2})\\s*[—\\-–(,]\\s*(?:a\\s+)?\\b${WD}\\b`, 'gi');

  let m: RegExpExecArray | null;
  while ((m = reWordFwd.exec(text)) !== null) {
    const mon = MONTHS[m[2]!.toLowerCase().slice(0, 3)]!;
    push(m[1]!, m[4] ? parseInt(m[4]!, 10) : defaultYear, mon, parseInt(m[3]!, 10), m[0]!);
  }
  while ((m = reWordBack.exec(text)) !== null) {
    const mon = MONTHS[m[1]!.toLowerCase().slice(0, 3)]!;
    push(m[4]!, m[3] ? parseInt(m[3]!, 10) : defaultYear, mon, parseInt(m[2]!, 10), m[0]!);
  }
  while ((m = reIsoFwd.exec(text)) !== null) {
    push(m[1]!, parseInt(m[2]!, 10), parseInt(m[3]!, 10) - 1, parseInt(m[4]!, 10), m[0]!);
  }
  while ((m = reIsoBack.exec(text)) !== null) {
    push(m[4]!, parseInt(m[1]!, 10), parseInt(m[2]!, 10) - 1, parseInt(m[3]!, 10), m[0]!);
  }
  return out;
}

function selftest(): number {
  let fails = 0;
  const check = (label: string, cond: boolean) => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'} — ${label}`);
    if (!cond) fails++;
  };

  // FIRES — the exact real 07-25 Critic phrasings (July 24, 2026 is a FRIDAY).
  const critic1 = findMismatches('confirm the effective date as 12:01 AM EDT on July 24, 2026 — Thursday, not Friday.', 2026);
  check('FIRES on the real Critic "July 24, 2026 — Thursday" (July 24 = Friday)',
    critic1.some(x => x.stated === 'Thursday' && /Jul 24, 2026/.test(x.date) && x.calendar === 'Friday'));

  const critic2 = findMismatches('tariffs took effect July 24 (Thursday) per USTR, not Friday.', 2026);
  check('FIRES on "July 24 (Thursday)" with the year inferred', critic2.length > 0);

  const fwd = findMismatches('the deadline is Thursday, July 24 this year', 2026);
  check('FIRES on weekday-first "Thursday, July 24"', fwd.length > 0);

  const iso = findMismatches('closes frozen on Thursday 2026-07-24 for the tape', 2026);
  check('FIRES on ISO "Thursday 2026-07-24" (that date is a Friday)', iso.length > 0);

  // SILENT — the healthy cases, so the gate never "corrects" a correct brief.
  check('SILENT on the correct brief "At midnight Friday, tariffs took effect" (bare weekday, no date)',
    findMismatches('At midnight Friday, tariffs of 10-12.5% took effect on imports from 60 economies.', 2026).length === 0);
  check('SILENT on the correct date-line "Saturday, July 25, 2026"',
    findMismatches('# Saturday, July 25, 2026', 2026).length === 0);
  check('SILENT on the correct pairing "Friday, July 24, 2026"',
    findMismatches('markets closed Friday, July 24, 2026 for the weekend', 2026).length === 0);
  check('SILENT on the correct ISO pairing "Friday 2026-07-24"',
    findMismatches('the Friday 2026-07-24 close is frozen', 2026).length === 0);
  check('SILENT on a bare future date with no weekday "FOMC July 28-29"',
    findMismatches('Watch FOMC July 28-29, where the committee meets.', 2026).length === 0);

  const total = 9;
  console.log(`\nweekday-date-consistency selftest — ${total - fails}/${total} assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED — the calendar check no longer bites both directions.'); return 1; }
  console.log('✓ Weekday↔date consistency verified in both directions.');
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const file = args.find(a => !a.startsWith('--'));
  if (!file) { console.error('Usage: weekday-date-consistency.ts <file.md> [--year YYYY] | --selftest'); return 2; }
  const yIdx = args.indexOf('--year');
  const year = yIdx > -1 && args[yIdx + 1] ? parseInt(args[yIdx + 1]!, 10) : new Date().getUTCFullYear();
  const fp = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(fp)) { console.error(`File not found: ${fp}`); return 2; }
  const bad = findMismatches(fs.readFileSync(fp, 'utf8'), year);
  if (bad.length === 0) {
    console.log(`weekday-date-consistency — ${path.basename(fp)} — 0 mismatches. ✓`);
    return 0;
  }
  console.error(`weekday-date-consistency — ${path.basename(fp)} — ${bad.length} MISMATCH${bad.length === 1 ? '' : 'ES'}:`);
  for (const b of bad) {
    console.error(`  ✗ text says "${b.stated}" but ${b.date} is a ${b.calendar} — "${b.context}"`);
  }
  console.error('  Correct the weekday to the calendar day, or the date to match the weekday. A weekday pinned to a date is arithmetic, not opinion.');
  return 1;
}
process.exit(main());
