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

/** Run ONE check leg. Returns null on pass, an error string on fail. */
function runLeg(leg: string, id: string): string | null {
  leg = leg.trim();
  if (leg.startsWith('grep:')) {
    const rest = leg.slice(5);
    const colon = rest.indexOf(':');
    if (colon === -1) return `${id}: malformed grep check: ${leg}`;
    const file = rest.slice(0, colon).trim();
    const needle = rest.slice(colon + 1).trim();
    const fp = path.join(process.cwd(), file);
    if (!fs.existsSync(fp)) return `${id}: grep target missing: ${file}`;
    if (!fs.readFileSync(fp, 'utf8').includes(needle)) {
      return `${id}: enforcement text ABSENT — "${needle}" not found in ${file} (the improvement was reverted or never landed)`;
    }
    return null;
  }
  // gitshow:<path>:<needle> — proves the pattern exists in the COMMITTED tree at HEAD,
  // not merely in the working tree. Catches the b3512c2 class: a commit that deletes an
  // enforcement while the working tree still looks fine (or the reverse — a claim that
  // "exists on disk" after an uncommitted edit that the nightly rebase will wipe).
  // Added 2026-07-31 — closes the "reverted after commit" / "never committed" blind spot
  // that let IMP-102's --stamp, ESC-009's pool, and IMP-108's strict gate sit as ledger
  // theater while the committed tree had none of them.
  if (leg.startsWith('gitshow:')) {
    const rest = leg.slice('gitshow:'.length);
    const colon = rest.indexOf(':');
    if (colon === -1) return `${id}: malformed gitshow check: ${leg}`;
    const file = rest.slice(0, colon).trim();
    const needle = rest.slice(colon + 1).trim();
    if (!file || !needle) return `${id}: malformed gitshow check: ${leg}`;
    const res = spawnSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', timeout: 30000 });
    if (res.status !== 0) {
      return `${id}: gitshow target missing from HEAD: ${file}\n      ${(res.stderr || '').trim().split('\n').slice(-2).join('\n      ')}`;
    }
    if (!(res.stdout || '').includes(needle)) {
      return `${id}: enforcement ABSENT from committed tree — "${needle}" not in HEAD:${file} (working tree may still have it; nightly rebase will not)`;
    }
    return null;
  }
  if (leg.startsWith('run:')) {
    const cmd = leg.slice(4).trim();
    const res = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 120000 });
    if (res.status !== 0) {
      return `${id}: gate FAILED (exit ${res.status}): ${cmd}\n      ${(res.stderr || res.stdout || '').trim().split('\n').slice(-3).join('\n      ')}`;
    }
    return null;
  }
  return `${id}: unknown check type: ${leg} (use grep:<file>:<substring> or gitshow:<file>:<substring> or run:<command> or none)`;
}

/**
 * A row's check may be a COMPOUND of legs joined by ` && ` — ALL must pass.
 *
 * This is the fix for the 2026-07-31 "GREEN BUT GONE" blind spot (RC7). On 07-29 the
 * nightly `pull --rebase origin main` reverted UNCOMMITTED working-tree edits to already-
 * tracked scripts (ceiling-lint.ts lost cc-deal-magnitude/model-canonical-example/
 * cc-pricing-rung; fact-gate.ts lost stockMoveReactionFindings) — four "verified ✅"
 * improvements silently vanished — yet this gate stayed GREEN because a `run:…--selftest`
 * check only asserted exit 0, and the shrunken selftest (17→11 assertions) still exits 0.
 * A code improvement now carries BOTH `run:<selftest>` (proves it still WORKS) AND
 * `grep:<file>:<check-name>` (proves the specific enforcement is STILL ON DISK). A silent
 * revert now turns the registry RED on the grep leg instead of hiding behind exit 0.
 */
function executeCheck(check: string, id: string): string[] {
  const legs = check.split(/\s+&&\s+/).map(s => s.trim()).filter(Boolean);
  const fails: string[] = [];
  for (const leg of legs) { const f = runLeg(leg, id); if (f) fails.push(f); }
  return fails;
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

    // 3. Execute the check (compound-aware; ALL ` && `-joined legs must pass).
    const checkFails = executeCheck(r.check, r.id);
    if (checkFails.length) fails.push(...checkFails); else verified++;
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

/** Proves the compound-check logic bites BOTH directions — non-circular (it exercises
 *  executeCheck against crafted legs, not the live ledger). IMP-110's mechanical check. */
function selftest(): number {
  const self = 'scripts/verify-improvements.ts';
  // Build the ABSENT needle at RUNTIME so it never appears as a source literal in this file
  // (a literal would make its own grep leg pass — the bug the first cut of this selftest hit).
  const absent = ['zz', Math.random().toString(36).slice(2), Date.now().toString(36), 'zz'].join('_');
  const cases: [string, string, boolean][] = [
    [`grep:${self}:AGE_FUSE_DAYS`, 'grep leg PASSES on a present string', true],
    [`grep:${self}:${absent}`, 'grep leg FAILS on an absent string (revert catch)', false],
    ['run:true', 'run leg PASSES on exit 0', true],
    ['run:false', 'run leg FAILS on exit 1', false],
    [`run:true && grep:${self}:AGE_FUSE_DAYS`, 'compound PASSES when ALL legs pass', true],
    [`run:true && grep:${self}:${absent}`, 'compound FAILS when the grep-anchor is gone (the green-but-gone catch)', false],
    [`grep:${self}:AGE_FUSE_DAYS && run:false`, 'compound FAILS when the run leg fails', false],
    // gitshow: proves the pattern is on HEAD (committed tree), not just the working tree.
    // AGE_FUSE_DAYS has been on HEAD since before this edit; an absent needle must fail.
    [`gitshow:${self}:AGE_FUSE_DAYS`, 'gitshow leg PASSES when needle is on HEAD', true],
    [`gitshow:${self}:${absent}`, 'gitshow leg FAILS when needle is absent from HEAD', false],
    [`gitshow:scripts/does-not-exist-zz.ts:anything`, 'gitshow leg FAILS when path is absent from HEAD', false],
  ];
  let fails = 0;
  for (const [check, label, expectPass] of cases) {
    const got = executeCheck(check, 'SELFTEST').length === 0;
    const ok = got === expectPass;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  }
  console.log(`\nverify-improvements selftest — ${cases.length - fails}/${cases.length} assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED — compound-check logic no longer bites both directions.'); return 1; }
  console.log('✓ compound-check (run:<selftest> && grep:<anchor> && gitshow:<anchor>) verified — a reverted enforcement now goes RED.');
  return 0;
}

process.exit(process.argv.includes('--selftest') ? selftest() : main());
