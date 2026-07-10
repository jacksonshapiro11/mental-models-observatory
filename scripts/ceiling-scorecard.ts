#!/usr/bin/env node --experimental-strip-types
/**
 * ceiling-scorecard.ts — advisory scorecard tally + trend (NEW 2026-07-10, Ceiling Doctrine
 * v0.5 §9/§10). Parses the CEILING SCORECARD block the Critic appends to its report,
 * appends the day's row to system/ceiling-trend.json, RECOMPUTES must_read from the fixed
 * conjunction, and prints the rolling windows the weekly loops read. This is the fixed
 * ruler's bookkeeper — it audits the judge (a must_read mismatch between the Critic's claim
 * and the computed conjunction is FLAGGED, in both directions).
 *
 * The fixed conjunction (Ceiling Doctrine v0.5 §2 — may not be extended ad hoc):
 *   take === 'A'  AND  bloomberg_differentiated === 'y'
 *   AND  ≥2 more A's among the other top slots (top slots = take, mm_x / cc_x / ait_x / geo_x, signal_x)
 *   AND  payoff === 'pass'  AND  breath >= 3  AND  zero C among top slots
 *
 * Usage:
 *   node --experimental-strip-types scripts/ceiling-scorecard.ts <critic-report.md> [--trend <path>]
 *   node --experimental-strip-types scripts/ceiling-scorecard.ts --selftest
 *
 * Exit: 0 always (advisory; "no block found" is a FLAG, not a failure), selftest 0/1, usage 2.
 */
import * as fs from 'fs';
import * as path from 'path';

interface Row {
  date: string;
  grades: Record<string, string>;   // key -> A/B/C
  missing: Record<string, string>;  // key -> comma rungs
  bloomberg: boolean;
  payoff: 'pass' | 'fail' | 'unknown';
  payoffClass: string;
  watch: boolean;
  breath: number;
  topSlotC: number;                 // as claimed in block (recomputed too)
  mustReadClaimed: boolean;
  mustReadComputed: boolean;
  aCountTop: number;
  cCountTop: number;
  gradedTop: number;
}

const TOP_SLOT = /^(take|mm_\d+|cc_\d+|ait_\d+|geo_\d+|signal_\d+)$/;

function parseBlock(md: string): { date: string; lines: string[] } | null {
  const m = md.match(/<!--\s*CEILING SCORECARD\s+(\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)-->/);
  if (!m) return null;
  return { date: m[1], lines: m[2].split('\n').map(l => l.trim()).filter(Boolean) };
}

function parseRow(md: string): Row | null {
  const block = parseBlock(md);
  if (!block) return null;
  const row: Row = {
    date: block.date, grades: {}, missing: {}, bloomberg: false, payoff: 'unknown',
    payoffClass: '', watch: false, breath: 0, topSlotC: -1, mustReadClaimed: false,
    mustReadComputed: false, aCountTop: 0, cCountTop: 0, gradedTop: 0,
  };
  for (const line of block.lines) {
    const kv = line.match(/^([a-z_0-9]+):\s*([^|]+)(?:\|(.*))?$/i);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const val = kv[2].trim();
    const rest = (kv[3] || '');
    const fields: Record<string, string> = {};
    for (const part of rest.split('|')) {
      const f = part.match(/^\s*([a-z_]+):\s*(.+?)\s*$/i);
      if (f) fields[f[1].toLowerCase()] = f[2].trim();
    }
    if (key === 'payoff') { row.payoff = /pass/i.test(val) ? 'pass' : 'fail'; row.payoffClass = (fields['class'] || '').toLowerCase(); row.watch = /^y/i.test(fields['watch'] || ''); continue; }
    if (key === 'breath') { row.breath = parseInt(val, 10) || 0; continue; }
    if (key === 'top_slot_c') { row.topSlotC = parseInt(val, 10); continue; }
    if (key === 'must_read') { row.mustReadClaimed = /^y/i.test(val); continue; }
    if (/^[ABC]$/i.test(val)) {
      row.grades[key] = val.toUpperCase();
      if (fields['missing']) row.missing[key] = fields['missing'];
      if (key === 'take') row.bloomberg = /^y/i.test(fields['bloomberg_differentiated'] || '');
    }
  }
  // Compute top-slot tallies + the fixed conjunction.
  for (const [k, g] of Object.entries(row.grades)) {
    if (!TOP_SLOT.test(k)) continue;
    row.gradedTop++;
    if (g === 'A') row.aCountTop++;
    if (g === 'C') row.cCountTop++;
  }
  const aBeyondTake = row.aCountTop - (row.grades['take'] === 'A' ? 1 : 0);
  row.mustReadComputed =
    row.grades['take'] === 'A' && row.bloomberg && aBeyondTake >= 2 &&
    row.payoff === 'pass' && row.breath >= 3 && row.cCountTop === 0;
  return row;
}

function loadTrend(trendPath: string): any[] {
  if (!fs.existsSync(trendPath)) return [];
  try { const j = JSON.parse(fs.readFileSync(trendPath, 'utf8')); return Array.isArray(j) ? j : []; }
  catch { return []; }
}

function appendTrend(trendPath: string, row: Row) {
  const trend = loadTrend(trendPath).filter((r: any) => r.date !== row.date); // idempotent re-runs
  trend.push({
    date: row.date,
    a_top: row.aCountTop, c_top: row.cCountTop, graded_top: row.gradedTop,
    grades: row.grades, missing: row.missing,
    take: row.grades['take'] || null, bloomberg_differentiated: row.bloomberg,
    payoff: row.payoff, payoff_class: row.payoffClass, watch: row.watch,
    breath: row.breath, must_read_claimed: row.mustReadClaimed, must_read_computed: row.mustReadComputed,
  });
  trend.sort((a: any, b: any) => a.date < b.date ? -1 : 1);
  fs.writeFileSync(trendPath, JSON.stringify(trend, null, 2) + '\n');
  return trend;
}

function windows(trend: any[]) {
  const last = (n: number) => trend.slice(-n);
  const w7 = last(7), w21 = last(21);
  const avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
  return {
    days7: w7.length,
    aAvg7: avg(w7.map((r: any) => r.a_top)).toFixed(2),
    cRate7: (avg(w7.map((r: any) => r.graded_top ? r.c_top / r.graded_top : 0)) * 100).toFixed(1) + '%',
    payoffPass7: `${w7.filter((r: any) => r.payoff === 'pass').length}/${w7.length}`,
    mustRead21: w21.filter((r: any) => r.must_read_computed).length,
    days21: w21.length,
  };
}

// ---------- selftest ----------
const FIXTURE_OK = `# Critic Report — 2026-07-10

…report body…

<!-- CEILING SCORECARD 2026-07-10
take: A | missing: none | bloomberg_differentiated: y
mm_1: B | missing: falsifier
mm_2: B | missing: none
mm_3: C | missing: mechanism,pricing | note: regime restated day 3
cc_1: B | missing: pricing
cc_2: A | missing: none
cc_3: B | missing: falsifier
ait_1: B | missing: none
ait_2: B | missing: falsifier
ait_3: B | missing: mechanism
geo_1: B | missing: none
geo_2: A | missing: none
geo_3: B | missing: pricing
wild_card: B
signal_1: A
signal_2: B
inner_game: B | bar: philosopher | compounding: extends
model: B | bar: specialist
discovery: B | bar: specialist
payoff: fail | class: theme | watch: n
breath: 4
top_slot_c: 1
must_read: no | blockers: payoff_fail,top_slot_c
-->
`;
const FIXTURE_MISMATCH = FIXTURE_OK
  .replace('payoff: fail | class: theme | watch: n', 'payoff: pass | class: tension | watch: y')
  .replace('mm_3: C | missing: mechanism,pricing | note: regime restated day 3', 'mm_3: A | missing: none')
  .replace('must_read: no | blockers: payoff_fail,top_slot_c', 'must_read: no | blockers: none');

function selftest(): number {
  let fails = 0;
  const t = (name: string, cond: boolean) => { console.log(`  ${cond ? 'PASS' : 'FAIL'} — ${name}`); if (!cond) fails++; };

  const r1 = parseRow(FIXTURE_OK)!;
  t('block parses (date)', r1 && r1.date === '2026-07-10');
  t('grades parsed (15 top slots)', r1.gradedTop === 15);
  t('A-count in top slots = 4 (take, cc_2, geo_2, signal_1)', r1.aCountTop === 4);
  t('C-count in top slots = 1 (mm_3)', r1.cCountTop === 1);
  t('bloomberg flag parsed', r1.bloomberg === true);
  t('payoff fail parsed', r1.payoff === 'fail');
  t('must_read computed = false (payoff fail + C in top slot)', r1.mustReadComputed === false);
  t('claim/computed agree on the honest block', r1.mustReadClaimed === r1.mustReadComputed);

  const r2 = parseRow(FIXTURE_MISMATCH)!;
  t('mismatch fixture: conjunction now met (A=5, payoff pass, no C)', r2.mustReadComputed === true);
  t('mismatch fixture: judge under-claims → auditable mismatch', r2.mustReadClaimed === false && r2.mustReadComputed === true);

  const noBlock = parseRow('# a report with no scorecard block');
  t('missing block → null (advisory flag path, not a crash)', noBlock === null);

  console.log(`\nceiling-scorecard selftest — ${11 - fails}/11 assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED'); return 1; }
  console.log('✓ Parser + fixed conjunction verified in both directions (honest block agrees; drifted claim flagged).');
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());
  const fileArg = argv.find(a => !a.startsWith('--'));
  if (!fileArg) { console.error('Usage: ceiling-scorecard.ts <critic-report.md> [--trend <path>] | --selftest'); process.exit(2); }
  const p = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(p)) { console.error(`File not found: ${p}`); process.exit(2); }
  const ti = argv.indexOf('--trend');
  const trendPath = ti > -1 && argv[ti + 1] ? argv[ti + 1] : path.join(process.cwd(), 'system/ceiling-trend.json');

  const row = parseRow(fs.readFileSync(p, 'utf8'));
  console.log(`ceiling-scorecard — ${path.basename(p)}`);
  if (!row) {
    console.log('  ⚠ FLAG: no CEILING SCORECARD block found in the report — the Critic must append it (Brief_Critic.md Phase 6 item 17). Trend not updated.');
    console.log('\n✅ CEILING-SCORECARD PASS (advisory)');
    process.exit(0);
  }
  console.log(`  ${row.date}: A(top)=${row.aCountTop} C(top)=${row.cCountTop}/${row.gradedTop} · payoff=${row.payoff}(${row.payoffClass}${row.watch ? ', watch' : ', NO WATCH'}) · breath=${row.breath}`);
  console.log(`  must_read: computed=${row.mustReadComputed ? 'YES' : 'no'} · claimed=${row.mustReadClaimed ? 'YES' : 'no'}${row.mustReadComputed !== row.mustReadClaimed ? '  ⚠ MISMATCH — the fixed conjunction disagrees with the Critic\'s claim; the conjunction wins. Audit the grades or the verdict.' : ''}`);
  const trend = appendTrend(trendPath, row);
  const w = windows(trend);
  console.log(`  trend → ${trendPath} (${trend.length} rows)`);
  console.log(`  7d: A-avg=${w.aAvg7} · C-rate=${w.cRate7} · payoff-pass=${w.payoffPass7} · 21d computed Must-Reads=${w.mustRead21}/${w.days21}`);
  if (w.days21 >= 21 && w.mustRead21 === 0) {
    console.log('  ⚠ CALIBRATION: zero computed Must-Reads in 21 days — if A-count is trending up, the grades have drifted (Ceiling Doctrine v0.5 §2 symmetric rule): run the calibration review.');
  }
  console.log('\n✅ CEILING-SCORECARD PASS (advisory)');
  process.exit(0);
}

main();
