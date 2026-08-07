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

/**
 * IS THIS ROW CLOSED? — IMP-140 (2026-08-07, RC7). The exemption predicate used to be
 * `/CLOSED/i.test(behavior)`, a bare substring match on a free-prose cell. Two ways that
 * silently let a row out of the acceptance gate and its 30-day code-or-close fuse:
 *
 *   "…flips Y when an AI&T segment figure ships as a **disCLOSED** single qualifier"  (IMP-083)
 *   "…OPEN escalation, deliberately **not closed**; carry-forward Critical"           (ESC-013)
 *
 * The second one is the alarming shape: a row can declare itself OPEN in plain English and
 * be read as CLOSED by the machine — so the louder and more honest the prose, the likelier
 * the exemption. Found today by writing exactly that sentence and noticing the registry
 * reported `0 warn` when it owed one.
 *
 * Closure is now a DECLARATION, not a word that appears somewhere: the cell must OPEN with
 * an explicit closure token (optionally behind markdown emphasis or a `Y —` grade). Prose
 * that merely mentions closing no longer closes anything.
 */
const CLOSED_RE = /^\W*(?:Y\s*[—–-]\s*)?(?:CLOSED\b|WONT-FIX-VIA-PROSE\b)/i;
export function isClosed(behavior: string): boolean { return CLOSED_RE.test(behavior.trim()); }

function ageDays(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

/**
 * ANCHOR FORENSICS — IMP-129 (2026-08-04, RC7). "Enforcement ABSENT" is two completely
 * different events wearing one message, and the fix for each is the opposite of the other:
 *
 *   REVERT      — the enforcement was lost (nightly rebase, a bad merge, a `git clean`).
 *                 The fix is to RESTORE THE CODE. Re-pointing the ledger row would launder
 *                 a real regression into a green registry.
 *   SUPERSESSION— the enforcement was deliberately replaced by something stronger, and the
 *                 row's anchor is now stale. The fix is to RE-POINT THE ROW at the surviving
 *                 enforcement. Restoring the old code would resurrect a retired gate.
 *
 * On 2026-08-04 all three RED rows were supersessions and every one of them LOOKED like a
 * revert: IMP-125's "BULLET LENGTH ADVISORY" was deleted by be7fdf0 ("delete the blind
 * bullet-ceiling duplicate") after a stronger whole-brief length rail replaced it; IMP-041's
 * and IMP-019's enforcement moved when `.claude/skills/publish-brief/scripts/publish.py`
 * became a 643-byte shim pointing at the newly TRACKED `scripts/publish-brief.py`. A session
 * that re-points on reflex is one bad night away from doing the same to a genuine revert.
 *
 * So the tool hands over the receipt instead of relying on the next session knowing the
 * protocol: on any absent anchor, print the commit that removed it. `git log -S` answers
 * "was this ever here, and what took it out" in one line, and the answer decides the fix.
 *
 * ── SHALLOW-HISTORY CORRECTION — IMP-130 (2026-08-06, RC7) ─────────────────────────────────────
 * `git log -S` cannot see past a shallow clone's grafted boundary, and it reports that the same
 * way it reports a string no commit ever added: silence, exit 0. The original function read that
 * silence as NEVER-LANDED. In THIS sandbox the checkout is shallow (13 commits) — so the receipt
 * IMP-129 exists to provide was, on 2026-08-06, a confidently wrong one: it would have told a
 * session to treat a genuine revert as an enforcement that never landed, which is the exact
 * mis-classification IMP-129 was built to prevent, wearing the badge of a receipt. THREE outcomes,
 * not two: NAMED (a commit removed it) · TRUNCATED (history cannot answer — refuse to classify)
 * · NEVER-LANDED (full history, no commit ever added it). "I cannot tell" is a legitimate verdict
 * and is strictly better than a fabricated one.
 */
type GitResult = { status: number | null; out: string; err: string };
type GitRunner = (args: string[], cwd?: string) => GitResult;

function gitStdout(args: string[], cwd?: string): GitResult {
  const res = spawnSync('git', args, { encoding: 'utf8', timeout: 30000, ...(cwd ? { cwd } : {}) });
  return {
    status: res.status,
    out: (res.stdout || '').trim(),
    err: (res.error?.message || res.stderr || '').trim(),
  };
}

export function anchorForensics(file: string, needle: string, cwd?: string, run: GitRunner = gitStdout): string {
  const { status, out, err } = run(['log', '--oneline', '-S', needle, '--', file], cwd);
  const lines = out.split('\n').filter(Boolean);
  if (status === 0 && lines.length > 0) {
    return `\n      FORENSICS: last commit touching this string in ${file} → ${lines[0]}\n      Classify before you act: REVERT (restore the code) or SUPERSESSION (re-point the row at the enforcement that replaced it, and prove the behaviour survives with a run: leg). Re-pointing a REVERT is how a regression turns green.`;
  }
  if (status !== 0) {
    return `\n      FORENSICS: GIT ERROR — \`git log -S\` could not inspect ${file} (exit ${status ?? 'unknown'}${err ? `: ${err.split('\n').slice(-1)[0]}` : ''}). This is NOT evidence of NEVER-LANDED. Restore repository/history access and re-run before classifying the missing enforcement.`;
  }
  const shallow = run(['rev-parse', '--is-shallow-repository'], cwd);
  if (shallow.status !== 0) {
    return `\n      FORENSICS: GIT ERROR — repository depth could not be determined for ${file} (exit ${shallow.status ?? 'unknown'}${shallow.err ? `: ${shallow.err.split('\n').slice(-1)[0]}` : ''}). This is NOT evidence of NEVER-LANDED. Restore repository access and re-run.`;
  }
  if (shallow.out === 'true') {
    const depth = run(['rev-list', '--count', 'HEAD'], cwd).out || '?';
    return `\n      FORENSICS: HISTORY TRUNCATED — this checkout is a SHALLOW clone (${depth} commits), so \`git log -S\` cannot see whether ${file} ever contained this string. This is NOT evidence of NEVER-LANDED and must NOT be classified as one. Run \`git fetch --unshallow\` and re-run before deciding REVERT vs SUPERSESSION; until then the correct verdict is "cannot tell".`;
  }
  return `\n      FORENSICS: git log -S finds NO commit that ever added this string to ${file}, in a FULL (non-shallow) history. Either the enforcement never landed, or it lives in a gitignored path. Treat as NEVER-LANDED, not as a revert.`;
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
      return `${id}: enforcement text ABSENT — "${needle}" not found in ${file} (the improvement was reverted or never landed)` + anchorForensics(file, needle);
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
      return `${id}: enforcement ABSENT from committed tree — "${needle}" not in HEAD:${file} (working tree may still have it; nightly rebase will not)` + anchorForensics(file, needle);
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
    const closed = isClosed(r.behavior);

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
  // IMP-129 — an absent anchor must arrive WITH its forensics, so the next session classifies
  // revert-vs-supersession from a receipt instead of from a hunch. Both directions.
  //
  // IMP-130 (2026-08-06) — THESE ASSERTIONS ARE NOW HERMETIC. The previous version asserted
  // against the LIVE repository (`git log -S "BULLET LENGTH ADVISORY" -- scripts/validate-brief.ts`,
  // expecting commit be7fdf0). That made the assertion a function of CLONE DEPTH rather than of the
  // logic under test: in a shallow checkout the removing commit is past the graft boundary, the
  // assertion goes RED, and — because this selftest is the `run:` leg of BOTH IMP-129 and IMP-110 —
  // it takes all 140 ledger rows down with it. That is what happened on 2026-08-06 (13-commit
  // shallow clone): 137 healthy checks were reported as a failed registry, and the morning session
  // declined to log a fix it had verified in both directions rather than "log on top of red". A
  // test that fails for reasons outside its subject is not protection, it is a tax on every future
  // session. So: build the history the assertion needs, in a throwaway repo, and prove all three
  // outcomes anywhere — NAMED, TRUNCATED, NEVER-LANDED.
  const t2 = (ok: boolean, label: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`); if (!ok) fails++; };
  let forensicAssertions = 0;
  {
    const msg = executeCheck(`grep:${self}:${absent}`, 'SELFTEST').join('');
    t2(/FORENSICS:/.test(msg), '[IMP-129] an absent anchor carries FORENSICS'); forensicAssertions++;

    const scripted = (log: GitResult, shallow: GitResult, depth = '1'): GitRunner =>
      args => args[0] === 'log'
        ? log
        : args[0] === 'rev-parse'
          ? shallow
          : { status: 0, out: depth, err: '' };
    const ok = (out: string): GitResult => ({ status: 0, out, err: '' });
    const named = anchorForensics('gate.ts', 'SENTINEL_ENFORCEMENT_STRING', undefined, scripted(ok('abc123 delete enforcement'), ok('false')));
    t2(/FORENSICS: last commit touching this string/.test(named) && /SUPERSESSION/.test(named),
      '[IMP-129] a deleted-but-once-committed anchor NAMES the commit that removed it (hermetic decision fixture)');
    const never = anchorForensics('gate.ts', `zz_${absent}`, undefined, scripted(ok(''), ok('false')));
    t2(/Treat as NEVER-LANDED/.test(never) && !/HISTORY TRUNCATED/.test(never),
      '[IMP-129] in FULL history, a string no commit ever added is classified NEVER-LANDED, not a revert');
    const trunc = anchorForensics('gate.ts', 'SENTINEL_ENFORCEMENT_STRING', undefined, scripted(ok(''), ok('true'), '13'));
    t2(/HISTORY TRUNCATED/.test(trunc) && !/Treat as NEVER-LANDED/.test(trunc),
      '[IMP-130] in a SHALLOW clone the same string is TRUNCATED, never NEVER-LANDED');
    const errored = anchorForensics('gate.ts', 'SENTINEL_ENFORCEMENT_STRING', undefined, scripted(
      { status: 128, out: '', err: 'fatal: not a git repository' }, ok('false'),
    ));
    t2(/FORENSICS: GIT ERROR/.test(errored) && !/Treat as NEVER-LANDED/.test(errored),
      '[IMP-130] a git failure is reported as UNKNOWN, never fabricated into NEVER-LANDED');
    forensicAssertions += 4;
  }
  // IMP-140 — closure is a declaration, not a substring. Both directions, verbatim cells
  // taken from the live ledger (the two false exemptions and the three true closures).
  const closureCases: [string, boolean, string][] = [
    ['CLOSED-BY-CODE (IMP-007)', true, 'ESC-001 verbatim: an explicit closure token closes'],
    ['**Y — closed by code path, not by prose.** A subsequent session…', true, 'ESC-010 verbatim: closure behind markdown + a Y grade still closes'],
    ['pending — advisory leg + rubric verified both directions today; flips Y when an AI&T segment figure ships as a disclosed single qualifier', false, 'IMP-083 verbatim: "disCLOSED" no longer closes a row'],
    ['pending — OPEN escalation, deliberately not closed; carry-forward Critical for the next session', false, 'ESC-013 verbatim: a row that says it is NOT closed is not closed'],
    ['WONT-FIX-VIA-PROSE — superseded by the length rail', true, 'the second legal closure token closes'],
  ];
  for (const [cell, expect, label] of closureCases) {
    const got = isClosed(cell);
    console.log(`  ${got === expect ? 'PASS' : 'FAIL'} — [IMP-140] ${label}`);
    if (got !== expect) fails++;
  }
  const total = cases.length + forensicAssertions + closureCases.length;
  console.log(`\nverify-improvements selftest — ${total - fails}/${total} assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED — compound-check logic no longer bites both directions.'); return 1; }
  console.log('✓ compound-check (run:<selftest> && grep:<anchor> && gitshow:<anchor>) verified — a reverted enforcement now goes RED.');
  return 0;
}

process.exit(process.argv.includes('--selftest') ? selftest() : main());
