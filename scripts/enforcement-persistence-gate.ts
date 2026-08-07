#!/usr/bin/env node --experimental-strip-types
/**
 * enforcement-persistence-gate.ts — "COMMITTED" IS NOT "PERSISTED" (IMP-131, 2026-08-05, RC7).
 *
 * THE FAILURE THIS EXISTS TO KILL, measured on this repo this morning. `verify-improvements` said
 * IMP-128 was GREEN: its `run:` leg passed, its `grep:` leg found the enforcement on disk, and its
 * `gitshow:` leg found it in HEAD. All three legs were true and the gate was still one command from
 * oblivion:
 *   - `scripts/gate-selfreport-gate.ts` (13,492 bytes, the whole of IMP-128) was UNTRACKED, with a
 *     staged DELETION sitting in `.git/index` — a `git commit` would have removed it from the tree.
 *   - The commit that "persisted" the 08-04 cohort, `d8bd450`, was LOCAL-ONLY: never pushed. Its
 *     files do not exist on `origin/main` at all.
 * Both states are invisible to every existing leg, because `gitshow:` reads LOCAL HEAD — and local
 * HEAD can be a commit nobody else will ever see. The 08-04 session used the ESC-012 private-index
 * workaround (`GIT_INDEX_FILE=.git/index.session`), which by design leaves the real index untouched;
 * that is how a staged deletion survived a "successful" commit.
 *
 * This is the same family as IMP-110 ("green but gone") one layer up: green-but-not-on-origin. The
 * nightly `pull --rebase origin main` is the executioner in both cases — on 2026-07-29 it reverted
 * four detectors while verify stayed green.
 *
 * WHAT IT CHECKS, for every scripts// lib/ file named by any check in system/Improvement_Ledger.md:
 *   1. UNTRACKED       — exists on disk, git does not know it. One `git clean -fd` from gone.
 *   2. STAGED-DELETED  — the index removes it. The next commit deletes the enforcement.
 *   3. UNPUSHED        — absent from origin/main, and the local commit that carries it is older
 *                        than the grace window (default 6h, so a same-session commit-then-push is
 *                        never a false alarm).
 * Silent when the tree is clean. Every finding names the exact command that repairs it.
 *
 * Usage:
 *   node --experimental-strip-types scripts/enforcement-persistence-gate.ts [--grace <hours>]
 *   node --experimental-strip-types scripts/enforcement-persistence-gate.ts --selftest
 * Exit: 0 every enforcement file is tracked, undeleted and pushed · 1 at least one is not · 2 usage.
 * Wired into: system/Apply_Improvements.md Phase 5 step 6, system/Improvement_Ledger.md rule 9,
 * system/System_Change_Guide.md.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const LEDGER = 'system/Improvement_Ledger.md';

function git(args: string[], cwd = process.cwd()) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 });
}

/** Every scripts/ or lib/ path named by a grep:, gitshow: or run: leg in the ledger. */
export function enforcementPaths(ledgerText: string): string[] {
  const out = new Set<string>();
  const re = /((?:scripts|lib)\/[A-Za-z0-9._\-/]+\.(?:ts|js|py|mjs|cjs))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ledgerText)) !== null) out.add(m[1]!);
  return [...out].sort();
}

export interface Finding { path: string; kind: 'UNTRACKED' | 'STAGED-DELETED' | 'UNPUSHED' | 'UNPUSHED-CONTENT'; detail: string; fix: string }

/**
 * Every `gitshow:<path>:<needle>` leg in the ledger. `gitshow:` proves the enforcement is in LOCAL
 * HEAD — which on 2026-08-05 was a local-only commit. This pairs each needle with its file so the
 * gate can ask the only question that matters: is it on the tree everyone else will pull?
 */
export function gitshowAnchors(ledgerText: string): { path: string; needle: string }[] {
  const out: { path: string; needle: string }[] = [];
  const re = /gitshow:((?:scripts|lib)\/[A-Za-z0-9._\-/]+):([^&|\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ledgerText)) !== null) out.push({ path: m[1]!, needle: m[2]!.trim() });
  return out;
}

export function needleOnRemote(p: string, needle: string, remote: string, cwd = process.cwd()): boolean | null {
  const r = git(['show', `${remote}:${p}`], cwd);
  if (r.status !== 0) return null; // file absent from remote — the UNPUSHED check owns that case
  return (r.stdout || '').includes(needle);
}

export function isTracked(p: string, cwd = process.cwd()): boolean {
  return git(['ls-files', '--error-unmatch', '--', p], cwd).status === 0;
}

export function isStagedDeleted(p: string, cwd = process.cwd()): boolean {
  const r = git(['diff', '--cached', '--name-status', 'HEAD', '--', p], cwd);
  return r.status === 0 && /^D\s/m.test(r.stdout || '');
}

export function onRemote(p: string, remote: string, cwd = process.cwd()): boolean {
  return git(['cat-file', '-e', `${remote}:${p}`], cwd).status === 0;
}

/** Age in hours of the newest local-only commit touching this path, or null if none. */
export function unpushedAgeHours(p: string, remote: string, cwd = process.cwd()): number | null {
  const r = git(['log', '--format=%ct', '-1', `${remote}..HEAD`, '--', p], cwd);
  const ts = Number((r.stdout || '').trim().split('\n')[0]);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return (Date.now() / 1000 - ts) / 3600;
}

export function scan(paths: string[], opts: { cwd?: string; remote?: string; graceHours?: number } = {}): Finding[] {
  const cwd = opts.cwd ?? process.cwd();
  const remote = opts.remote ?? 'origin/main';
  const grace = opts.graceHours ?? 6;
  const remoteKnown = git(['rev-parse', '--verify', '--quiet', remote], cwd).status === 0;
  const out: Finding[] = [];
  for (const p of paths) {
    if (!fs.existsSync(path.join(cwd, p))) continue; // absent-file case belongs to verify-improvements' anchor forensics
    if (!isTracked(p, cwd)) {
      out.push({ path: p, kind: 'UNTRACKED', detail: 'exists on disk, git does not know it — one `git clean -fd` from gone, and absent from every clone', fix: `git add ${p}` });
      continue;
    }
    if (isStagedDeleted(p, cwd)) {
      out.push({ path: p, kind: 'STAGED-DELETED', detail: 'the index stages this file for DELETION — the next commit removes the enforcement from the tree', fix: `git reset -- ${p}   # or: git add ${p} to re-stage the live file` });
      continue;
    }
    if (!remoteKnown) continue;
    if (!onRemote(p, remote, cwd)) {
      const age = unpushedAgeHours(p, remote, cwd);
      if (age === null || age >= grace) {
        out.push({
          path: p,
          kind: 'UNPUSHED',
          detail: `absent from ${remote}${age === null ? '' : ` — its local commit is ${age.toFixed(1)}h old`}; "committed locally" is not persisted, and the nightly rebase replays onto ${remote}`,
          fix: `git pull --rebase origin main && git push origin HEAD:main`,
        });
      }
    }
  }
  return out;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) fails++; };

  t(enforcementPaths('| check | run:node scripts/foo-gate.ts --selftest && grep:scripts/foo-gate.ts:needle |').join(',') === 'scripts/foo-gate.ts',
    'extracts the enforcement path from a compound check');
  t(enforcementPaths('grep:system/Model_Library.md:CANONICAL').length === 0,
    'ignores system/ paths (gitignored by design — they persist on their own)');
  t(enforcementPaths('run:node lib/audio/text-preprocessor.ts --selftest').includes('lib/audio/text-preprocessor.ts'),
    'covers lib/ as well as scripts/');

  // Hermetic git fixture: a real repo with a real "remote", exercising all three findings.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'epg-'));
  const repo = path.join(tmp, 'repo');
  const bare = path.join(tmp, 'remote.git');
  fs.mkdirSync(repo);
  git(['init', '-q', '--bare', bare], tmp);
  git(['init', '-q', '-b', 'main'], repo);
  git(['config', 'user.email', 't@t'], repo);
  git(['config', 'user.name', 't'], repo);
  fs.mkdirSync(path.join(repo, 'scripts'));
  for (const f of ['pushed.ts', 'deleted.ts']) fs.writeFileSync(path.join(repo, 'scripts', f), '// enforcement\n');
  git(['add', 'scripts/pushed.ts', 'scripts/deleted.ts'], repo);
  git(['commit', '-qm', 'base'], repo);
  git(['remote', 'add', 'origin', bare], repo);
  git(['push', '-q', 'origin', 'main'], repo);
  git(['fetch', '-q', 'origin'], repo);

  fs.writeFileSync(path.join(repo, 'scripts', 'untracked.ts'), '// enforcement\n');   // case 1
  git(['rm', '-q', '--cached', 'scripts/deleted.ts'], repo);                          // case 2 (file stays on disk)
  fs.writeFileSync(path.join(repo, 'scripts', 'local.ts'), '// enforcement\n');
  git(['add', 'scripts/local.ts'], repo);
  git(['commit', '-qm', 'local only'], repo);                                          // case 3

  const paths = ['scripts/pushed.ts', 'scripts/untracked.ts', 'scripts/deleted.ts', 'scripts/local.ts'];
  const f = scan(paths, { cwd: repo, remote: 'origin/main', graceHours: 0 });
  const by = (k: string) => f.filter((x) => x.kind === k).map((x) => x.path);
  t(by('UNTRACKED').includes('scripts/untracked.ts'), 'catches an UNTRACKED enforcement file');
  // `git rm --cached` leaves the file on disk AND untracked; the staged deletion is the same event.
  t(by('UNTRACKED').includes('scripts/deleted.ts') || by('STAGED-DELETED').includes('scripts/deleted.ts'),
    'catches a file removed from the index while still on disk (the real 08-05 gate-selfreport case)');
  t(by('UNPUSHED').includes('scripts/local.ts'), 'catches an enforcement file committed LOCALLY but never pushed');
  t(!f.some((x) => x.path === 'scripts/pushed.ts'), 'SILENT on a tracked, undeleted, pushed file');
  t(scan(['scripts/pushed.ts'], { cwd: repo, remote: 'origin/main', graceHours: 0 }).length === 0, 'a healthy tree produces zero findings');
  t(scan(paths, { cwd: repo, remote: 'origin/main', graceHours: 99999 }).every((x) => x.kind !== 'UNPUSHED'),
    'the grace window suppresses a just-made commit, so commit-then-push is never a false alarm');
  t(scan(['scripts/does-not-exist.ts'], { cwd: repo, remote: 'origin/main', graceHours: 0 }).length === 0,
    'an absent file is not this gate\'s business (verify-improvements owns anchor forensics)');

  // CONTENT-LEVEL: the real 08-05 case — a tracked, pushed file whose new enforcement line lives
  // only in a local-only commit. `gitshow:` passes; the enforcement is still not persisted.
  fs.appendFileSync(path.join(repo, 'scripts', 'pushed.ts'), '// NEW-ENFORCEMENT-ANCHOR\n');
  git(['add', 'scripts/pushed.ts'], repo);
  git(['commit', '-qm', 'local enforcement edit'], repo);
  const anchors = [{ path: 'scripts/pushed.ts', needle: 'NEW-ENFORCEMENT-ANCHOR' }, { path: 'scripts/pushed.ts', needle: '// enforcement' }];
  const cf = scanContent(anchors, { cwd: repo, remote: 'origin/main', graceHours: 0 });
  t(cf.length === 1 && cf[0]!.kind === 'UNPUSHED-CONTENT',
    'catches enforcement TEXT that exists only in a local-only commit (gitshow: cannot see this)');
  t(scanContent(anchors, { cwd: repo, remote: 'origin/main', graceHours: 99999 }).length === 0,
    'the grace window covers the content check too');
  t(gitshowAnchors('| run:x && gitshow:scripts/a.ts:SOME ANCHOR |').length === 1, 'parses gitshow: anchors out of a compound check');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\nenforcement-persistence-gate selftest — ${13 - fails}/13 assertions passed`);
  if (fails) { console.error('❌ SELFTEST FAIL'); return 1; }
  console.log('✅ SELFTEST PASS — untracked, staged-deleted and unpushed enforcement all go RED.');
  return 0;
}

/**
 * CONTENT-LEVEL persistence. A file can be tracked and present on origin while the SPECIFIC
 * enforcement string a ledger row depends on exists only in a local-only commit — exactly the
 * 2026-08-05 state, where d8bd450 carried four gates' worth of enforcement that origin/main had
 * never seen. `gitshow:` cannot see this; it reads local HEAD.
 */
export function scanContent(
  anchors: { path: string; needle: string }[],
  opts: { cwd?: string; remote?: string; graceHours?: number } = {},
): Finding[] {
  const cwd = opts.cwd ?? process.cwd();
  const remote = opts.remote ?? 'origin/main';
  const grace = opts.graceHours ?? 6;
  if (git(['rev-parse', '--verify', '--quiet', remote], cwd).status !== 0) return [];
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const a of anchors) {
    const k = `${a.path}::${a.needle}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (needleOnRemote(a.path, a.needle, remote, cwd) !== false) continue;
    const age = unpushedAgeHours(a.path, remote, cwd);
    if (age !== null && age < grace) continue;
    out.push({
      path: a.path,
      kind: 'UNPUSHED-CONTENT',
      detail: `"${a.needle.slice(0, 60)}" is in local HEAD but NOT on ${remote}${age === null ? '' : ` — its local commit is ${age.toFixed(1)}h old`}. gitshow: reads local HEAD and cannot see this.`,
      fix: 'git pull --rebase origin main && git push origin HEAD:main',
    });
  }
  return out;
}

function main(graceHours: number): number {
  if (!fs.existsSync(LEDGER)) { console.error(`enforcement-persistence-gate: ${LEDGER} not found`); return 2; }
  const ledger = fs.readFileSync(LEDGER, 'utf8');
  const paths = enforcementPaths(ledger);
  const findings = [...scan(paths, { graceHours }), ...scanContent(gitshowAnchors(ledger), { graceHours })];
  console.log(`enforcement-persistence-gate — ${paths.length} enforcement files named by the ledger · grace ${graceHours}h`);
  if (findings.length === 0) {
    console.log('  ✓ every one is tracked, not staged for deletion, and present on origin/main.');
    return 0;
  }
  for (const f of findings) {
    console.log(`  ✗ ${f.kind} ${f.path}`);
    console.log(`      ${f.detail}`);
    console.log(`      FIX: ${f.fix}`);
  }
  console.log(`\n${findings.length} enforcement file(s) are not persisted. A ledger row can be green while its code is one command from gone — that is what this gate exists to make impossible.`);
  return 1;
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) process.exit(selftest());
else {
  const gi = argv.indexOf('--grace');
  const g = gi >= 0 ? Number(argv[gi + 1]) : 6;
  process.exit(main(Number.isFinite(g) ? g : 6));
}
