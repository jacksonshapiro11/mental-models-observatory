/**
 * wip-shunt.ts — TRACKED-CODE DIRT GOES TO A BRANCH, NEVER TO THE FLOOR (work order W1, 2026-08-28).
 *
 * THE CLASS, with its receipts: a nightly rebase runs against a dirty tree and uncommitted work
 * disappears. It erased IMP-102's `--stamp` (a 19-day escalation for code that never existed) and
 * `b3512c2` deleted three detectors. On 2026-08-28 the tree was dirty again — `six-conversion-gate.ts`
 * had been carrying daily-improvement's Kalecki additions for two days, one rebase away from the
 * same fate.
 *
 * THE PRINCIPLE: a rebase may not be the thing that decides whether work survives. Before any
 * integration step, tracked-CODE dirt is COMMITTED TO A DATED wip/ BRANCH and alarmed. The work
 * then exists as a commit someone can find, review and cherry-pick — instead of as a diff that a
 * clean checkout silently discards.
 *
 * WHY ONLY TRACKED CODE. Untracked files survive a rebase already, and tracked DATA (factcheck
 * json, ledgers, published content) is regenerated nightly — shunting it would produce a wip branch
 * every single night and train everyone to ignore them. The signal is source that a human wrote and
 * nobody committed.
 *
 *   wip-shunt --check          report what would be shunted, exit 0 (advisory)
 *   wip-shunt --shunt          create wip/dirt-<date> and commit the tracked-code dirt onto it
 *   wip-shunt --selftest
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

/** Extensions that are SOURCE. Everything else is regenerated or is content. */
export const CODE_RE = /\.(ts|tsx|js|mjs|cjs|py|sh|json5|yml|yaml)$/;
/** Tracked JSON that is DATA, not source — regenerated nightly, never shunted. */
export const DATA_JSON_RE =
  /(factcheck|ledger|-log|manifest|calibration)\.json$/i;

export function isTrackedCodeDirt(porcelainLine: string): boolean {
  const status = porcelainLine.slice(0, 2);
  const file = porcelainLine.slice(3).trim();
  if (!file) return false;
  if (status.includes('?')) return false; // untracked survives a rebase already
  if (DATA_JSON_RE.test(file)) return false; // regenerated nightly
  if (/\.json$/.test(file)) return false; // json is data here unless proven otherwise
  return CODE_RE.test(file);
}

export function git(
  cwd: string,
  args: string[]
): { code: number; out: string; err: string } {
  // Sweep zero-byte stale locks first. On the device mount `unlink` inside .git is refused, so git
  // leaves the lock it just used and the NEXT command dies on "File exists". Measured 2026-08-28:
  // every leftover lock in .git is 0 bytes, and a lock git is actively using has the new index
  // written into it before the rename — so size is a safe discriminator.
  try {
    const gitDir = path.join(cwd, '.git');
    if (fs.existsSync(gitDir))
      for (const f of fs.readdirSync(gitDir))
        if (f.endsWith('.lock')) {
          const p = path.join(gitDir, f);
          try {
            if (fs.statSync(p).size === 0)
              fs.renameSync(
                p,
                path.join(cwd, '_to_delete', `${f}.${Date.now()}`)
              );
          } catch {
            /* best effort */
          }
        }
  } catch {
    /* best effort */
  }
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return { code: r.status ?? 1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

export function dirtyCode(cwd: string): string[] {
  const r = git(cwd, ['status', '--porcelain']);
  return r.out
    .split('\n')
    .filter(l => l.trim() && isTrackedCodeDirt(l))
    .map(l => l.slice(3).trim());
}

export interface ShuntResult {
  branch: string | null;
  files: string[];
  alarm: string | null;
  note: string;
}

export function shunt(cwd: string, date: string, apply: boolean): ShuntResult {
  const files = dirtyCode(cwd);
  if (!files.length)
    return {
      branch: null,
      files: [],
      alarm: null,
      note: 'no tracked-code dirt — nothing to shunt, and the rebase is safe to run',
    };
  const branch = `wip/dirt-${date}`;
  const alarm =
    `🔴 PIPELINE ALARM — tracked-code dirt shunted to ${branch} (${files.length} file(s)) before integration\n` +
    `   To: cosmictrex11@gmail.com\n` +
    `   Files: ${files.join(', ')}\n` +
    `   These were UNCOMMITTED source changes in the path of a rebase. They are now a commit on\n` +
    `   ${branch}; review and cherry-pick. Nothing was reverted, and nothing was merged for you.`;
  if (!apply)
    return {
      branch,
      files,
      alarm,
      note: 'DRY RUN — pass --shunt to create the branch and commit',
    };
  const head =
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim() || 'main';
  const mk = git(cwd, ['checkout', '-B', branch]);
  if (mk.code !== 0)
    return {
      branch,
      files,
      alarm,
      note: `FAILED to create ${branch}: ${mk.err.trim().slice(0, 160)}`,
    };
  git(cwd, ['add', '--', ...files]);
  const c = git(cwd, [
    'commit',
    '-m',
    `wip: tracked-code dirt shunted ${date}\n\nUncommitted source in the path of an integration step. Committed here rather\nthan left for a rebase to discard (the IMP-102 / b3512c2 class).\n\n${files.join('\n')}`,
  ]);
  const back = git(cwd, ['checkout', head]);
  return {
    branch,
    files,
    alarm,
    note:
      c.code === 0
        ? `shunted to ${branch}; returned to ${head}${back.code === 0 ? '' : ' (RETURN FAILED — check HEAD)'}`
        : `commit on ${branch} FAILED: ${c.err.trim().slice(0, 160)}`,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const cwd = process.cwd();
  const date =
    argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
    new Date().toISOString().slice(0, 10);

  if (argv.includes('--selftest')) {
    let pass = 0,
      fail = 0;
    const t = (n: string, ok: boolean) => {
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${n}`);
    };

    t(
      '[classify] a modified tracked .ts IS tracked-code dirt',
      isTrackedCodeDirt(' M scripts/six-conversion-gate.ts')
    );
    t(
      '[classify] an UNTRACKED file is not — it survives a rebase already',
      !isTrackedCodeDirt('?? scripts/brand-new.ts')
    );
    t(
      '[classify] a factcheck json is DATA, regenerated nightly — shunting it would make a branch every night and train everyone to ignore them',
      !isTrackedCodeDirt(
        ' M content/daily-updates/weekly/2026-W28-factcheck.json'
      )
    );
    t(
      '[classify] published content is not code',
      !isTrackedCodeDirt(' M content/daily-updates/2026-08-28.md')
    );
    t(
      '[classify] a staged-and-modified .ts still counts (status "MM")',
      isTrackedCodeDirt('MM scripts/x.ts')
    );

    // END-TO-END on a REAL repository — git is fully functional outside the device mount.
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'wip-shunt-'));
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(repo, '_to_delete'), { recursive: true });
    git(repo, ['init', '-q', '.']);
    git(repo, ['config', 'user.email', 't@t']);
    git(repo, ['config', 'user.name', 't']);
    fs.writeFileSync(
      path.join(repo, 'scripts', 'gate.ts'),
      'export const v = 1;\n'
    );
    fs.writeFileSync(path.join(repo, 'data.json'), '{}\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'init']);
    const clean = shunt(repo, '2026-08-28', false);
    t(
      '[e2e] a CLEAN tree shunts nothing and says the rebase is safe',
      clean.files.length === 0 && /safe to run/.test(clean.note)
    );

    fs.writeFileSync(
      path.join(repo, 'scripts', 'gate.ts'),
      'export const v = 2; // uncommitted work\n'
    );
    fs.writeFileSync(path.join(repo, 'data.json'), '{"regenerated":true}\n');
    const dry = shunt(repo, '2026-08-28', false);
    t(
      '[e2e] DRY RUN names exactly the code file, not the json beside it',
      dry.files.length === 1 && dry.files[0] === 'scripts/gate.ts'
    );
    t(
      '[e2e] and it produces the alarm text with the branch and the files in it',
      !!dry.alarm &&
        dry.alarm.includes('wip/dirt-2026-08-28') &&
        dry.alarm.includes('scripts/gate.ts') &&
        dry.alarm.includes('cosmictrex11@gmail.com')
    );

    const applied = shunt(repo, '2026-08-28', true);
    const onBranch = git(repo, [
      'show',
      '--stat',
      '--oneline',
      'wip/dirt-2026-08-28',
    ]).out;
    t(
      '[e2e] APPLY creates wip/dirt-<date> and the work is a COMMIT on it, not a diff on the floor',
      /shunted to wip\/dirt-2026-08-28/.test(applied.note) &&
        /scripts\/gate\.ts/.test(onBranch)
    );
    t(
      '[e2e] the commit body names the class it prevents, so the branch explains itself later',
      /IMP-102 \/ b3512c2 class/.test(
        git(repo, ['log', '-1', '--format=%B', 'wip/dirt-2026-08-28']).out
      )
    );
    t(
      '[e2e] HEAD is returned to the original branch — the shunt must not leave the repo somewhere else',
      /^(main|master)$/.test(
        git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim()
      )
    );
    // 🔴 THE PROPERTY THAT MATTERS: the work must now SURVIVE the thing that used to eat it.
    git(repo, ['checkout', '--', 'scripts/gate.ts']);
    t(
      '[e2e] and after a hard checkout — the operation that used to discard it — the work is still recoverable from the branch',
      /uncommitted work/.test(
        git(repo, ['show', 'wip/dirt-2026-08-28:scripts/gate.ts']).out
      ) &&
        !/uncommitted work/.test(
          fs.readFileSync(path.join(repo, 'scripts', 'gate.ts'), 'utf-8')
        )
    );

    console.log(
      `\n${fail ? '❌' : '✅'} wip-shunt --selftest: ${pass}/${pass + fail} assertions passed.`
    );
    process.exit(fail ? 1 : 0);
  }

  const apply = argv.includes('--shunt');
  const r = shunt(cwd, date, apply);
  console.log(
    `wip-shunt ${date} — ${r.files.length} tracked-code file(s) dirty`
  );
  if (!r.files.length) {
    console.log(`✅ ${r.note}`);
    process.exit(0);
  }
  for (const f of r.files) console.log(`   ${f}`);
  console.log(`\n${r.alarm}\n\n   ${r.note}`);
  process.exit(argv.includes('--red') ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('wip-shunt')) main();
