/**
 * qg-growth-gate.ts — the ratchet that replaces five failed prose freezes.
 *
 * WHY THIS EXISTS
 * The Quality Gate (system/Novelty_Audit.md) has been under an explicit prose
 * freeze since Week 14. It grew every single week anyway: 675 → 728 → 746 → 753.
 * Five prescriptions, five failures, zero retirements logged. The Accountability
 * Cycle's own rule says a prose-only rule is an unenforced rule — so the freeze
 * stops being a mandate and becomes a mechanism.
 *
 * THE MECHANISM (a ratchet, not a wall)
 * The baseline in system/qg-baseline.json is a CEILING that can only ever go DOWN.
 *  - Grow the file above the ceiling  → this gate FAILS. Growth is now blocked at
 *    the enforcement layer, not requested at the prose layer.
 *  - Shrink the file                  → run with --ratchet to lower the ceiling.
 *    Retirements are the ONLY way the number moves, and they move it one way.
 *
 * The ceiling starts at today's reality (753), not at the aspirational 720. A gate
 * that fails on day one gets disabled by the next session that trips over it; a
 * gate that bites on the next ATTEMPTED growth survives to do its job. The 33-line
 * debt to the 720 target is carried explicitly in the baseline file, not forgiven.
 *
 * ALSO CHECKED: ceiling-trend.json completeness. Ceiling Doctrine §8 / Accountability
 * Dimension 4.5 mandate that the weekly ceiling bet be READ FROM THIS FILE, never
 * eyeballed. In week 18 the file held 3 of 7 days — and was missing 07-12, the day
 * the 95-day Must-Read drought broke. A trend file that skips the best day in three
 * months cannot be the referent for anything. Warn below 5/7, fail below 3/7.
 *
 * USAGE
 *   npx tsx scripts/qg-growth-gate.ts            # verify (exit 0 = healthy)
 *   npx tsx scripts/qg-growth-gate.ts --ratchet  # lower ceiling after a retirement
 *   npx tsx scripts/qg-growth-gate.ts --self-test
 *
 * Wired into: system/Improvement_Ledger.md (ESC-005) via verify-improvements.ts,
 * which is run daily by pipeline-health-check and by the 10:03 improve-and-apply.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const QG_FILE = path.join(ROOT, 'system', 'Novelty_Audit.md');
const BASELINE_FILE = path.join(ROOT, 'system', 'qg-baseline.json');
const TREND_FILE = path.join(ROOT, 'system', 'ceiling-trend.json');

const TREND_WARN_BELOW = 5; // of the trailing 7 days
const TREND_FAIL_BELOW = 3;

interface Baseline {
  ceiling_lines: number;
  target_lines: number;
  set_on: string;
  retirements: { date: string; lines_removed: number; what: string }[];
  note: string;
}

function readBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_FILE)) {
    throw new Error(`baseline missing: ${BASELINE_FILE} — run --ratchet to initialise`);
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

/** Newline count — matches `wc -l` exactly, so the number in the gate is the number a human greps. */
function lineCount(file: string): number {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop(); // trailing newline is not a line
  return lines.length;
}

/** Trailing-7-day completeness of the ceiling scorecard. */
function trendCoverage(): { present: number; missing: string[] } {
  if (!fs.existsSync(TREND_FILE)) return { present: 0, missing: ['<file absent>'] };
  const rows: { date: string }[] = JSON.parse(fs.readFileSync(TREND_FILE, 'utf8'));
  const have = new Set(rows.map((r) => r.date));
  const missing: string[] = [];
  let present = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (have.has(key)) present++;
    else missing.push(key);
  }
  return { present, missing };
}

function main(): number {
  const args = process.argv.slice(2);
  const fails: string[] = [];
  const warns: string[] = [];

  const actual = lineCount(QG_FILE);
  const baseline = readBaseline();

  // --ratchet: the ONLY way the ceiling moves, and it only moves down.
  if (args.includes('--ratchet')) {
    if (actual >= baseline.ceiling_lines) {
      console.error(
        `✗ RATCHET REFUSED — Novelty_Audit.md is ${actual} lines, ceiling is ${baseline.ceiling_lines}. ` +
          `The ratchet only turns one way: retire passes first, then lower the ceiling.`,
      );
      return 1;
    }
    const removed = baseline.ceiling_lines - actual;
    baseline.retirements.push({
      date: new Date().toISOString().slice(0, 10),
      lines_removed: removed,
      what: args[args.indexOf('--ratchet') + 1] ?? '(unlabelled retirement)',
    });
    baseline.ceiling_lines = actual;
    baseline.set_on = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`✓ RATCHETED — ceiling lowered to ${actual} (−${removed}). Debt to target: ${Math.max(0, actual - baseline.target_lines)} lines.`);
    return 0;
  }

  // 1. THE FREEZE, AS A MECHANISM.
  if (actual > baseline.ceiling_lines) {
    fails.push(
      `QG-GROWTH: system/Novelty_Audit.md is ${actual} lines, ceiling is ${baseline.ceiling_lines} ` +
        `(+${actual - baseline.ceiling_lines}). The quality gate grew without a logged retirement. ` +
        `Retire a pass and run --ratchet, or revert the addition. Five prose freezes failed here; ` +
        `this one is code.`,
    );
  }

  const debt = actual - baseline.target_lines;
  if (debt > 0) {
    warns.push(
      `QG-DEBT: ${actual} lines vs target ${baseline.target_lines} — ${debt} lines owed in retirements ` +
        `(no retirement logged since ${baseline.set_on}).`,
    );
  }

  // 2. THE TREND FILE MUST BE READABLE TO BE THE REFERENT.
  const { present, missing } = trendCoverage();
  if (present < TREND_FAIL_BELOW) {
    fails.push(
      `CEILING-TREND-GAP: only ${present}/7 trailing days in system/ceiling-trend.json (missing: ${missing.join(', ')}). ` +
        `Dimension 4.5 reads the weekly ceiling bet FROM THIS FILE. A trend that isn't written can't be read.`,
    );
  } else if (present < TREND_WARN_BELOW) {
    warns.push(
      `CEILING-TREND-THIN: ${present}/7 trailing days in ceiling-trend.json (missing: ${missing.join(', ')}). ` +
        `The scorecard is not appending every night.`,
    );
  }

  console.log(
    `qg-growth-gate — Novelty_Audit ${actual}/${baseline.ceiling_lines} lines (target ${baseline.target_lines}) · ` +
      `ceiling-trend ${present}/7 days · ${fails.length} FAIL · ${warns.length} warn`,
  );
  for (const w of warns) console.log(`  ⚠ ${w}`);
  for (const f of fails) console.error(`  ✗ ${f}`);

  if (fails.length > 0) {
    console.error('\n✗ QG GROWTH GATE FAILED — the freeze is now enforced, not requested.');
    return 1;
  }
  console.log('\n✓ Quality gate within its ceiling; trend file readable.');
  return 0;
}

process.exit(main());
