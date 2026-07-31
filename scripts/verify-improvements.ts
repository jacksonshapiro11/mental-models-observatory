#!/usr/bin/env node --experimental-strip-types
/**
 * verify-improvements.ts — mechanical proof that improvements are REAL.
 *
 * Reads system/Improvement_Ledger.md and, for every row: verifies target files
 * exist, executes the named mechanical check (grep: substring present · run:
 * command exits 0), and enforces the acceptance gate (Critical/High rows need a
 * check — warn young, FAIL at 30+ days per the code-or-close rule).
 *
 * Why (Jackson's memo, 2026-07-06): the loop graded its own homework — "Applied ✅"
 * in prose, ~0% behavior change on Writer-only rules, escalations re-prescribed
 * weekly for 70+ days. This script is the exit code the loop never had. The system
 * improves when failures become exit codes; it stalls when they become paragraphs.
 *
 * Usage: npx tsx scripts/verify-improvements.ts [--ledger <path>]
 * Exit: 0 all rows verified · 1 any failure · 2 usage/parse error
 * Wired into: pipeline-health-check (daily) and the improve-and-apply task (self-check).
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

interface Row {
  id: string; date: string; source: string; rc: string; sev: string;
  summary: string; targets: string[]; check: string;
  applied: string; verified: string; behavior: string; recur: string;
}

const AGE_FUSE_DAYS = 30; // check=none on Critical/High: WARN until this age, FAIL after.

function parseLedger(md: string): Row[] {
  const rows: Row[] = [];
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').map(c => c.trim());
    // | id | date | source | rc | sev | summary | targets | check | applied | verified | behavior | recur |
    if (cells.length < 13) continue;
    const id = cells[1]!;
    if (!/^(IMP|ESC)-\d+/.test(id)) continue; // skips header + divider
    rows.push({
      id, date: cells[2]!, source: cells[3]!, rc: cells[4]!, sev: cells[5]!,
      summary: cells[6]!, targets: cells[7]!.split(',').map(s => s.trim()).filter(s => s && s !== 'scripts/'),
      check: cells[8]!, applied: cells[9]!, verified: cells[10]!, behavior: cells[11]!, recur: cells[12]!,
    });
  }
  return rows;
}

function ageDays(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

function main(): number {
  const argIdx = process.argv.indexOf('--ledger');
  const ledgerPath = argIdx > -1 && process.argv[argIdx + 1]
    ? process.argv[argIdx + 1]!
    : path.join(process.cwd(), 'system/Improvement_Ledger.md');
  if (!fs.existsSync(ledgerPath)) { console.error(`FAIL: ledger not found: ${ledgerPath}`); return 2; }

  const rows = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
  if (rows.length === 0) { console.error('FAIL: ledger parsed to zero rows — schema drift?'); return 2; }

  const fails: string[] = [];
  const warns: string[] = [];
  let verified = 0;

  for (const r of rows) {
    const closed = /CLOSED/i.test(r.behavior);

    // 1. Target files exist (skip directory-ish / empty targets).
    for (const target of r.targets) {
      if (!target.includes('.')) continue;
      if (!fs.existsSync(path.join(process.cwd(), target))) {
        fails.push(`${r.id}: target file missing: ${target}`);
      }
    }

    // 2. The acceptance gate: Critical/High without a mechanical check.
    if (r.check === 'none' || r.check === '') {
      if (/^(Critical|High)$/i.test(r.sev) && !closed) {
        const age = ageDays(r.date);
        const msg = `${r.id} [${r.sev}] has NO mechanical check (age ${age}d): "${r.summary.slice(0, 80)}" — convert to a code gate or close WONT-FIX-VIA-PROSE`;
        if (age >= AGE_FUSE_DAYS) fails.push(msg + ` — ${AGE_FUSE_DAYS}d fuse blown, this now BLOCKS`);
        else warns.push(msg);
      }
      continue;
    }

    // 3. Execute the check.
    if (r.check.startsWith('grep:')) {
      const rest = r.check.slice(5);
      const colon = rest.indexOf(':');
      if (colon === -1) { fails.push(`${r.id}: malformed grep check: ${r.check}`); continue; }
      const file = rest.slice(0, colon).trim();
      const needle = rest.slice(colon + 1).trim();
      const fp = path.join(process.cwd(), file);
      if (!fs.existsSync(fp)) { fails.push(`${r.id}: grep target missing: ${file}`); continue; }
      if (!fs.readFileSync(fp, 'utf8').includes(needle)) {
        fails.push(`${r.id}: enforcement text ABSENT — "${needle}" not found in ${file} (the improvement was reverted or never landed)`);
      } else verified++;
    } else if (r.check.startsWith('run:')) {
      const cmd = r.check.slice(4).trim();
      const res = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 120000 });
      if (res.status !== 0) {
        fails.push(`${r.id}: gate FAILED (exit ${res.status}): ${cmd}\n      ${(res.stderr || res.stdout || '').trim().split('\n').slice(-3).join('\n      ')}`);
      } else verified++;
    } else {
      fails.push(`${r.id}: unknown check type: ${r.check} (use grep:<file>:<substring> or run:<command> or none)`);
    }
  }

  // 4. The theater report — behavior counts (informational, the accountability view).
  const counts = {
    rows: rows.length,
    behaviorY: rows.filter(r => /^Y/i.test(r.behavior)).length,
    pending: rows.filter(r => /pending/i.test(r.behavior)).length,
    recurred: rows.filter(r => parseInt(r.recur || '0', 10) > 0 && !/CLOSED/i.test(r.behavior)).length,
    closedByCode: rows.filter(r => /CLOSED-BY-CODE/i.test(r.behavior)).length,
  };

  console.log(`verify-improvements — ${rows.length} rows · ${verified} checks passed · ${fails.length} FAIL · ${warns.length} warn`);
  console.log(`  behavior: ${counts.behaviorY} changed · ${counts.pending} pending · ${counts.recurred} recurred-open (theater candidates) · ${counts.closedByCode} closed-by-code`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  if (fails.length) {
    console.error('\n✗ IMPROVEMENT VERIFICATION FAILED — a logged improvement is not mechanically real. Fix the enforcement or the ledger row; do not log new improvements on top of broken ones.');
    return 1;
  }
  console.log('\n✓ All ledger improvements mechanically verified.');
  return 0;
}
process.exit(main());
