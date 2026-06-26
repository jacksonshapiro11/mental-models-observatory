#!/usr/bin/env node --experimental-strip-types
/**
 * prediction-scoreboard.ts — the running track record.
 *
 * Reads system/predictions-ledger.json and prints the one thing the system has
 * never made visible: are we actually right? It shows the hit-rate, calibration
 * by confidence, and — critically — every call that is OVERDUE and still ungraded,
 * because an unresolved prediction is how slop survives (a confident-sounding call
 * that never faces a verdict). "Resolution is non-negotiable" only binds if the
 * overdue list is visible and acted on.
 *
 * This is a REPORT, not a publish gate (resolution is a periodic editorial job, not
 * a per-brief check). Exit is 0; pass --strict to exit non-zero when calls are overdue.
 *
 * Usage: node --experimental-strip-types scripts/prediction-scoreboard.ts [--strict]
 */
import * as fs from 'fs';
import * as path from 'path';

type Status = 'open' | 'right' | 'wrong' | 'partial';
interface P {
  id: string; date_made: string; section: string; claim: string;
  asset: string | null; threshold: string; due: string;
  confidence: 'high' | 'medium' | 'low'; status: Status;
  resolved_on: string | null; postmortem: string | null;
}

function findLedger(): string | null {
  const names = ['system/predictions-ledger.json'];
  const roots = [process.cwd(), path.join(path.dirname(process.argv[1] || '.'), '..')];
  for (const r of roots) for (const n of names) {
    const p = path.join(r, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function pct(n: number, d: number): string { return d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`; }

function main() {
  const strict = process.argv.includes('--strict');
  const ledgerPath = findLedger();
  if (!ledgerPath) { console.error('predictions-ledger.json not found'); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const preds: P[] = (data.predictions ?? []).filter((p: any) => p && p.id);
  const today = new Date().toISOString().slice(0, 10);

  const resolved = preds.filter((p) => p.status !== 'open');
  const right = resolved.filter((p) => p.status === 'right').length;
  const wrong = resolved.filter((p) => p.status === 'wrong').length;
  const partial = resolved.filter((p) => p.status === 'partial').length;
  const open = preds.filter((p) => p.status === 'open');
  const overdue = open.filter((p) => p.due && p.due < today).sort((a, b) => a.due.localeCompare(b.due));
  const dueSoon = open.filter((p) => p.due && p.due >= today && p.due <= addDays(today, 14));

  // Accuracy with partial credit (partial = 0.5).
  const score = right + 0.5 * partial;
  const acc = pct(Math.round(score), resolved.length);

  console.log('═══════════════ PREDICTION SCOREBOARD ═══════════════');
  console.log(`ledger: ${path.basename(ledgerPath)}  ·  total calls: ${preds.length}`);
  console.log(`resolved: ${resolved.length}  (✓ ${right} right · ✗ ${wrong} wrong · ◐ ${partial} partial)`);
  console.log(`running accuracy: ${acc}  (partial = half credit)`);
  console.log(`open: ${open.length}  ·  overdue (ungraded past due): ${overdue.length}  ·  due ≤14d: ${dueSoon.length}`);

  // Calibration by confidence — the meta-metric: do high-confidence calls actually win more?
  console.log('\ncalibration by confidence (resolved only):');
  for (const c of ['high', 'medium', 'low'] as const) {
    const r = resolved.filter((p) => p.confidence === c);
    const rr = r.filter((p) => p.status === 'right').length;
    console.log(`  ${c.padEnd(6)} ${r.length ? `${rr}/${r.length} right (${pct(rr, r.length)})` : '— none resolved'}`);
  }

  if (overdue.length) {
    console.log(`\n⚠ OVERDUE — ungraded past their due date (resolve these; this is where slop hides):`);
    for (const p of overdue) console.log(`   • [${p.due}] ${p.claim.slice(0, 90)}  (made ${p.date_made}, ${p.confidence})`);
  }
  if (dueSoon.length) {
    console.log(`\n→ due within 14 days:`);
    for (const p of dueSoon) console.log(`   • [${p.due}] ${p.claim.slice(0, 90)}`);
  }

  if (resolved.length < 10) {
    console.log(`\nNote: only ${resolved.length} resolved — below the 10-minimum for calibration analysis. Backfill open calls from system/Thesis_Tracker.md and grade them honestly.`);
  }
  console.log('═════════════════════════════════════════════════════');

  if (strict && overdue.length) process.exit(1);
  process.exit(0);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

main();
