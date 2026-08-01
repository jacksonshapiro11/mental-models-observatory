/**
 * persistence-gate.ts — WORK THAT ISN'T PERSISTED DOESN'T EXIST.
 *
 * WHY: the dominant failure class of the 07-31/08-01 lift was not bad code, it was code that
 * stopped existing.
 *   · IMP-102's `provenance-gate --stamp` was recorded as built+verified on 07-26. The flag was
 *     never in the script. Written, never committed, reverted by the nightly `pull --rebase`.
 *     ESC-006 then spent 19 days routing an FDA ask to Jackson for a manifest no code could produce.
 *   · IMP-110/111 restored three detectors on 07-31; `b3512c2` deleted them hours later by
 *     committing without a pathspec.
 *   · 13 commits sat unpushed for four days — every fix from the lift existing on one laptop.
 *
 * Rules 1 and 4 of the standing rules were prose. A prose-only rule is unenforced — that is the
 * lesson of this entire week. This makes them mechanical.
 *
 *   node --experimental-strip-types scripts/persistence-gate.ts            # warn-only, exit 0
 *   node --experimental-strip-types scripts/persistence-gate.ts --strict   # exit 1 on any finding
 *   node --experimental-strip-types scripts/persistence-gate.ts --selftest
 */
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const TRACKED = ['scripts/', 'lib/', 'app/', 'components/'];

export interface Finding { kind: string; message: string }

const git = (cmd: string): string => {
  try { return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

/** Pure — testable without a repo. */
export function analyse(porcelain: string, unpushed: string): Finding[] {
  const out: Finding[] = [];

  const dirty = porcelain.split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.replace(/^\S+\s+/, ''))
    .filter(f => TRACKED.some(p => f.startsWith(p)));
  if (dirty.length) {
    out.push({ kind: 'UNCOMMITTED-TRACKED-CODE',
      message: `${dirty.length} tracked file(s) modified but NOT committed: ${dirty.slice(0, 6).join(', ')}${dirty.length > 6 ? ` (+${dirty.length - 6} more)` : ''}. The nightly \`pull --rebase\` reverts these. Commit them in this session — \`git commit -- <paths>\` with an explicit pathspec.` });
  }

  const ahead = unpushed.split('\n').map(l => l.trim()).filter(Boolean);
  if (ahead.length) {
    out.push({ kind: 'UNPUSHED-COMMITS',
      message: `${ahead.length} commit(s) exist only on this machine: ${ahead[0]!.slice(0, 60)}${ahead.length > 1 ? ` … +${ahead.length - 1} more` : ''}. Not backed up anywhere. Push.` });
  }
  return out;
}

function selftest(): number {
  let ok = 0, fail = 0;
  const t = (n: string, c: boolean) => { c ? ok++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };
  t('FIRES on an uncommitted tracked script (the IMP-102 class)',
    analyse(' M scripts/ceiling-lint.ts', '').some(f => f.kind === 'UNCOMMITTED-TRACKED-CODE'));
  t('SILENT on an untracked-path edit (system/ is gitignored by policy)',
    analyse(' M system/Brief_Writer.md', '').length === 0);
  t('FIRES on unpushed commits (the 4-day red)',
    analyse('', 'abc1234 gates: something').some(f => f.kind === 'UNPUSHED-COMMITS'));
  t('counts multiple unpushed commits',
    analyse('', 'a1 x\nb2 y\nc3 z')[0]!.message.includes('3 commit(s)'));
  t('SILENT when everything is committed and pushed', analyse('', '').length === 0);
  t('handles staged-and-modified (MM) markers',
    analyse('MM scripts/fact-gate.ts', '').some(f => f.message.includes('scripts/fact-gate.ts')));
  console.log(`\npersistence-gate selftest — ${ok} passed · ${fail} failed`);
  return fail ? 1 : 0;
}

function main(): number {
  if (process.argv.includes('--selftest')) return selftest();
  const strict = process.argv.includes('--strict');
  const findings = analyse(git('status --porcelain'), git('log --oneline origin/main..HEAD'));
  console.log(`persistence-gate — ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  ${strict ? '🔴' : '🟡'} ${f.kind}: ${f.message}`);
  if (!findings.length) console.log('  ✓ all tracked code committed and pushed.');
  return strict && findings.length ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
