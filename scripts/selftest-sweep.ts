/**
 * selftest-sweep.ts — EVERY SELFTEST, UNDER THE RUNNER THE PIPELINE ACTUALLY USES (A1, 2026-08-28).
 *
 * THE RULE: **"green under a runner the pipeline doesn't use" is not green.**
 *
 * WHY IT EXISTS, with the count. `gate-attendance` printed all ten of its passes and then the
 * PROCESS died — `require is not defined in ES module scope` — so every caller read FAILURE from a
 * passing run. `npx tsx` transpiles to CJS, where `require` works; the bodies invoke
 * `node --experimental-strip-types`, which is true ESM. Every check anyone had run was green
 * against a runner nothing in production uses.
 *
 * Swept across all 59 rostered selftests the same day, that was not one bug but **four**, from two
 * causes — a CJS idiom (`require(...)`, `require.main === module`) and extensionless relative
 * imports, which tsx resolves and ESM refuses. The import cause was a SHARED-LIB convention:
 * `lib/daily-update-parser.ts` importing `'./brief-date'` broke every gate that imports it. 21
 * files carried it.
 *
 * So the sweep reports two different things, and the second is the point:
 *   NON-ZERO   — the selftest failed under production. A real finding either way.
 *   DIVERGENT  — it passes under tsx and fails under production. **This one is worse**, because
 *                every previous report of health on that script was false.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

export const PROD_RUNNER = ['node', ['--experimental-strip-types']] as const;
export const PER_SCRIPT_TIMEOUT_MS = 60_000;

export interface SweepRow { script: string; prod: number; tsx: number | null; divergent: boolean }

/** Scripts that accept --selftest. Discovered, never hardcoded — a new one is rostered by existing. */
export function rosteredSelftests(root: string): string[] {
  const dir = path.join(root, 'scripts');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.ts') && !/\.bak|scratch/.test(f))
    .filter(f => fs.readFileSync(path.join(dir, f), 'utf-8').includes('--selftest'))
    .sort();
}

function run(cmd: string, args: string[], root: string): number {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf-8', timeout: PER_SCRIPT_TIMEOUT_MS });
  return r.status ?? 1;
}

export function sweepOne(root: string, script: string, alsoTsx: boolean): SweepRow {
  const p = path.join('scripts', script);
  const prod = run(PROD_RUNNER[0], [...PROD_RUNNER[1], p, '--selftest'], root);
  const tsx = alsoTsx ? run('npx', ['tsx', p, '--selftest'], root) : null;
  return { script: script.replace(/\.ts$/, ''), prod, tsx, divergent: tsx === 0 && prod !== 0 };
}

function main(): void {
  const argv = process.argv.slice(2);
  const root = process.cwd();

  if (argv.includes('--selftest')) {
    let pass = 0, fail = 0;
    const t = (n: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${n}`); };
    const roster = rosteredSelftests(root);
    t(`[roster] discovers the selftests by reading the scripts, never from a list — ${roster.length} found`, roster.length >= 40);
    t('[roster] and it rosters itself, so this leg cannot exempt itself from its own rule', roster.includes('selftest-sweep.ts'));
    t('[runner] the production runner is node --experimental-strip-types, not tsx',
      PROD_RUNNER[0] === 'node' && PROD_RUNNER[1].includes('--experimental-strip-types'));
    // The divergence classifier is the whole instrument — assert it on its truth table.
    const mk = (prod: number, tsx: number | null) => ({ script: 'x', prod, tsx, divergent: tsx === 0 && prod !== 0 });
    t('[divergence] green-under-tsx + red-under-production is DIVERGENT — the case that made every prior report false',
      mk(1, 0).divergent);
    t('[divergence] red under both is a real failure, not a divergence', !mk(1, 1).divergent);
    t('[divergence] green under both is neither', !mk(0, 0).divergent);
    t('[divergence] and a run with no tsx comparison never claims divergence it did not measure', !mk(1, null).divergent);
    console.log(`\n${fail ? '❌' : '✅'} selftest-sweep --selftest: ${pass}/${pass + fail} assertions passed.`);
    process.exit(fail ? 1 : 0);
  }

  const alsoTsx = !argv.includes('--no-compare');
  const roster = rosteredSelftests(root).filter(s => s !== 'selftest-sweep.ts');
  console.log(`selftest-sweep — ${roster.length} rostered selftest(s) under ${PROD_RUNNER[0]} ${PROD_RUNNER[1].join(' ')}${alsoTsx ? ' (comparing against tsx)' : ''}`);
  const rows = roster.map(s => sweepOne(root, s, alsoTsx));
  const bad = rows.filter(r => r.prod !== 0);
  const div = rows.filter(r => r.divergent);
  for (const r of bad)
    console.log(`  ${r.divergent ? '🔴 DIVERGENT' : '❌ FAILING  '} ${r.script}  prod=${r.prod}${r.tsx === null ? '' : ` tsx=${r.tsx}`}`);
  if (!bad.length) console.log('✅ every rostered selftest exits 0 under the production runner.');
  else {
    console.log(
      `\n🔴 ${bad.length} non-zero of ${rows.length}${div.length ? `, of which ${div.length} DIVERGENT` : ''}.`
    );
    if (div.length)
      console.log(
        `   A DIVERGENT script passes under tsx and fails in production, which means every previous\n` +
          `   report of its health was false. Fix the script, never the runner: the bodies invoke\n` +
          `   node --experimental-strip-types and that is the only opinion that counts.`
      );
  }
  process.exit(argv.includes('--red') && bad.length ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('selftest-sweep')) main();
