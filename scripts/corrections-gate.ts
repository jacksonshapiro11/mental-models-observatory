#!/usr/bin/env node --experimental-strip-types
/**
 * corrections-gate.ts — proves that every falsehood we CAUGHT actually got FIXED
 * in the published archive. (IMP-034, 2026-07-11.)
 *
 * WHY THIS EXISTS: on 2026-07-11 the pipeline proved its own published 07-10 brief
 * false (SK Hynix "$28 billion" — the pre-pricing target, not the $26.5B raise),
 * corrected the NEW brief before publish... and left the OLD one live. The Quality
 * Gate log literally said "issue a correction to BOTH briefs." Nobody did, because
 * "issue a correction" was prose addressed to no one. Detection without repair is
 * not a truth system; it is a system that knows it is lying.
 *
 * WHAT IT CHECKS: for every row in system/Corrections_Ledger.md —
 *   1. the target file exists;
 *   2. the WRONG text is GONE from it   (an unapplied correction = an open falsehood);
 *   3. the CORRECT text is PRESENT      (guards against a deletion that fixed nothing).
 * Backticked spans in the ledger's wrong/correct cells are the literal needles; prose
 * outside them is commentary for humans and is ignored.
 *
 * ...and it checks all three against BOTH copies (v2, IMP-035, 2026-07-11):
 *   LOCAL     — the working file on disk.
 *   PUBLISHED — the blob actually on origin/main, which is what the READER sees.
 *
 * WHY v2 EXISTS: v1 read only the local file. On the night of 2026-07-11 the SK Hynix
 * correction (COR-001/002) was applied on disk, the ledger said `applied`, and this gate
 * printed "✓ Every logged correction has landed in the published file" — while the live
 * 07-10 page still said "$28 billion". The fix was never pushed, because publish.py's
 * staleness guard refused every back-dated write and pointed at an override that did not
 * exist. Three layers all reported done; the falsehood stayed live for 36 hours.
 * A gate that reads the working copy proves only that we MEANT to fix it. The reader does
 * not read our working copy. PUBLISHED is the only copy that can lie to anyone.
 *
 * A published state we cannot PROVE is treated as a failure, not a pass. Green must mean
 * "the reader sees the truth" — never "we could not check."
 *
 * Usage:
 *   node --experimental-strip-types scripts/corrections-gate.ts              # local + published
 *   node --experimental-strip-types scripts/corrections-gate.ts --local-only # skip network
 *   node --experimental-strip-types scripts/corrections-gate.ts --selftest
 *
 * Exit: 0 all corrections landed in BOTH copies · 1 an open falsehood is live (or the
 *       published state is unprovable) · 2 usage/parse error
 * Wired into: verify-improvements.ts (IMP-034/035 rows) + pipeline-health-check (daily).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

interface Row {
  id: string;
  found: string;
  file: string;
  wrong: string;
  correct: string;
  source: string;
  applied: string;
}

/** The literal needle is the FIRST backticked span in a cell; everything else is prose. */
function needle(cell: string): string | null {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1].trim() : null;
}

export function parseLedger(md: string): Row[] {
  const rows: Row[] = [];
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const c = t.split('|').map(s => s.trim());
    if (c.length < 8) continue;
    if (!/^COR-\d+/.test(c[1] ?? '')) continue; // skips header + divider
    rows.push({
      id: c[1]!,
      found: c[2]!,
      file: c[3]!,
      wrong: c[4]!,
      correct: c[5]!,
      source: c[6]!,
      applied: c[7]!,
    });
  }
  return rows;
}

export function checkRow(
  r: Row,
  readFile: (p: string) => string | null
): string[] {
  const fails: string[] = [];
  const body = readFile(r.file);
  if (body === null) return [`${r.id}: target file missing: ${r.file}`];

  const wrong = needle(r.wrong);
  const correct = needle(r.correct);
  if (!wrong || !correct) {
    return [
      `${r.id}: malformed row — wrong/correct cells must each contain a \`backticked\` literal (got wrong=${wrong ? 'ok' : 'MISSING'}, correct=${correct ? 'ok' : 'MISSING'})`,
    ];
  }
  if (body.includes(wrong)) {
    fails.push(
      `${r.id}: OPEN FALSEHOOD — the wrong text is STILL LIVE in ${r.file}: "${wrong.slice(0, 90)}". We proved this false on ${r.found} (${r.source.slice(0, 70)}) and never fixed the file. Apply the correction.`
    );
  }
  if (!body.includes(correct)) {
    fails.push(
      `${r.id}: correction NOT PRESENT in ${r.file} — expected "${correct.slice(0, 90)}". The wrong text may have been deleted rather than corrected; the reader is owed the true figure, not a hole.`
    );
  }
  if (!r.applied.trim() && fails.length === 0) {
    fails.push(
      `${r.id}: file is correct but 'applied' is empty — log the date; an unlogged correction is an unverifiable one.`
    );
  }
  return fails;
}

/**
 * Reads the file as it exists on origin/main — the copy the reader actually sees.
 *
 * Publishing goes through publish.py, which writes to GitHub via the REST API or a /tmp
 * clone and NEVER commits locally. So the local repo's HEAD says nothing about what is
 * live, and a cached origin/main ref may be stale. We therefore prove currency first:
 * `git ls-remote` (network read, no local writes — safe on the Cowork mount, which
 * cannot delete a stale .git/index.lock) must agree with the cached ref before we trust
 * `git show`. If it does not agree, the published state is UNPROVEN — and unproven is a
 * failure, because "I could not check" is exactly the state that let a known lie sit live.
 */
const UNPROVEN = Symbol('unproven');
type Published = string | null | typeof UNPROVEN;

function makePublishedReader(): (p: string) => Published {
  const git = (args: string[], cwd?: string): string =>
    execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 120_000,
      cwd,
    }).trim();

  // FAST PATH: if the cached origin/main ref already equals the remote HEAD, the local
  // object store is authoritative and `git show` is a true published receipt — no network
  // beyond the ls-remote, no writes anywhere.
  try {
    const remote = git(['ls-remote', 'origin', 'main']).split(/\s+/)[0]!;
    const cached = git(['rev-parse', 'origin/main']);
    if (remote && remote === cached) {
      return p => {
        try {
          return git(['show', `origin/main:${p}`]);
        } catch {
          return null;
        }
      };
    }
    console.error(
      `  · cached origin/main (${cached.slice(0, 7)}) is behind remote HEAD (${remote.slice(0, 7)}) — expected, since publish.py pushes via API//tmp clone and never commits locally. Reading the published tree directly.`
    );
  } catch {
    console.error(
      '  ! could not reach origin — published state cannot be proven.'
    );
    return () => UNPROVEN;
  }

  // SLOW PATH: read the published tree from a disposable blobless clone. We do NOT run
  // `git fetch` on the Cowork mount: an interrupted fetch strands .git/index.lock, which
  // the mount's permissions cannot delete, bricking every later git op (Repo_Operations).
  // A /tmp clone has full permissions and is thrown away.
  try {
    const url = git(['remote', 'get-url', 'origin']).replace(
      /https:\/\/[^@]*@/,
      'https://'
    );
    let token = process.env.GITHUB_TOKEN ?? '';
    if (!token) {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        token = (
          fs
            .readFileSync(envPath, 'utf8')
            .match(/^GITHUB_TOKEN\s*=\s*["']?([^"'\r\n]+)/m)?.[1] ?? ''
        ).trim();
      }
    }
    const auth = token
      ? url.replace('https://', `https://x-access-token:${token}@`)
      : url;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corrgate-'));
    git([
      'clone',
      '--filter=blob:none',
      '--depth',
      '1',
      '--branch',
      'main',
      '--quiet',
      auth,
      dir,
    ]);
    return p => {
      const fp = path.join(dir, p);
      return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
    };
  } catch (e) {
    // Never swallow this: a silent clone failure is indistinguishable from a passing gate.
    const msg = String((e as Error)?.message ?? e).replace(
      /x-access-token:[^@]*@/g,
      'x-access-token:***@'
    );
    console.error(
      `  ! could not clone the published tree — published state cannot be proven: ${msg.slice(0, 160)}`
    );
    return () => UNPROVEN;
  }
}

function selftest(): number {
  const FIXED =
    'raising roughly $26.5 billion, the largest foreign IPO in US history';
  const BROKEN =
    'raising roughly 28 billion dollars, the largest foreign IPO in US history';
  const row: Row = {
    id: 'COR-TEST',
    found: '2026-07-11',
    file: 'fake.md',
    wrong: '`raising roughly 28 billion dollars`',
    correct: '`raising roughly $26.5 billion`',
    source: 'selftest',
    applied: '2026-07-11',
  };
  const cases: Array<[string, boolean, () => boolean]> = [
    [
      'FAILs when the false text is still live (the real 07-10 state)',
      true,
      () => checkRow(row, () => BROKEN).length > 0,
    ],
    [
      'SILENT once the correction is applied (the real 07-10 state now)',
      false,
      () => checkRow(row, () => FIXED).length > 0,
    ],
    [
      'FAILs when the wrong text was deleted but no correction landed',
      true,
      () =>
        checkRow(row, () => 'SK Hynix listed on the Nasdaq under SKHY.')
          .length > 0,
    ],
    [
      'FAILs on a missing target file',
      true,
      () => checkRow(row, () => null).length > 0,
    ],
    // THE 2026-07-11 REGRESSION. This is the exact state v1 called green: the working copy
    // was corrected, the ledger said `applied`, and the live page still said "$28 billion".
    // The two-reader design must FIRE on the published copy even when local is spotless.
    [
      'FAILs when LOCAL is fixed but PUBLISHED still carries the falsehood (the 07-11 blindness)',
      true,
      () =>
        checkRow(row, () => FIXED).length === 0 &&
        checkRow(row, () => BROKEN).length > 0,
    ],
    [
      'parses the live ledger',
      false,
      () => {
        const p = path.join(process.cwd(), 'system/Corrections_Ledger.md');
        if (!fs.existsSync(p)) return true;
        return parseLedger(fs.readFileSync(p, 'utf8')).length === 0; // fires (=true) if it parses to zero rows
      },
    ],
  ];
  let fails = 0;
  for (const [name, shouldFire, fn] of cases) {
    const fired = fn();
    const ok = fired === shouldFire;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} — ${name} (expected ${shouldFire ? 'FIRE' : 'SILENT'}, got ${fired ? 'FIRE' : 'SILENT'})`
    );
    if (!ok) fails++;
  }
  console.log(
    `\ncorrections-gate selftest — ${cases.length - fails}/${cases.length} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ Both directions verified: an unapplied correction FAILs, an applied one is silent.'
  );
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();
  const localOnly = argv.includes('--local-only');

  const ledgerPath = path.join(process.cwd(), 'system/Corrections_Ledger.md');
  if (!fs.existsSync(ledgerPath)) {
    console.error(`FAIL: corrections ledger not found: ${ledgerPath}`);
    return 2;
  }
  const rows = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
  const readLocal = (p: string): string | null => {
    const fp = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  };

  const fails: string[] = [];
  for (const r of rows)
    fails.push(...checkRow(r, readLocal).map(f => `[LOCAL]     ${f}`));

  // THE COPY THAT CAN LIE TO A READER. Never skipped silently.
  if (localOnly) {
    console.error(
      '  ! --local-only: the PUBLISHED archive was NOT checked. This proves only that we meant to fix it.'
    );
  } else {
    const readPublished = makePublishedReader();
    for (const r of rows) {
      const body = readPublished(r.file);
      if (body === UNPROVEN) {
        fails.push(
          `[PUBLISHED] ${r.id}: UNPROVEN — could not read ${r.file} from origin/main. We cannot show the reader sees the truth, so this is RED, not green. (v1 of this gate went green on the working copy while the live page still carried the falsehood — never again.)`
        );
        continue;
      }
      fails.push(
        ...checkRow(r, () => body as string | null).map(f => `[PUBLISHED] ${f}`)
      );
    }
  }

  const open = fails.length;
  console.log(
    `corrections-gate — ${rows.length} logged correction(s) · ${open} open · scope: LOCAL${localOnly ? '' : ' + PUBLISHED (origin/main)'}`
  );
  for (const f of fails) console.error(`  ✗ ${f}`);
  if (open) {
    console.error(
      '\n✗ CORRECTIONS GATE FAILED — a claim we PROVED false is still live in the published archive (or we could not prove otherwise). Detection without repair is not a truth system.'
    );
    return 1;
  }
  console.log(
    `\n✓ Every logged correction has landed${localOnly ? ' on disk' : ' in the file the READER actually sees (origin/main)'}.`
  );
  return 0;
}

process.exit(main());
