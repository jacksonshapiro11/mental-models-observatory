/**
 * tree-canary.ts — THE TREE CHECK, MECHANICAL (work order 2026-08-28, item 8).
 *
 * WHY IT IS A SCRIPT AND NOT A SENTENCE: the rule already existed as prose in CLAUDE.md and
 * enforced nothing — the tree was dirty again the morning this was written. A prose rule that
 * nobody executes is indistinguishable from no rule, which is the same finding as the gate manifest
 * one file over.
 *
 * WHERE IT RUNS: in the CANARY, first action of a scheduled session, BEFORE that session does any
 * work — which is what "outside any task it checks" means. A task that inspects the tree after its
 * own edits is grading its own homework; at canary time the tree is exactly as the previous session
 * left it, so a dirty tree names a PREDECESSOR, never the current run.
 *
 * Exit 0 always by default: a dirty tree must never stop a brief (THE BRIEF ALWAYS SHIPS). It emits
 * the TREE header and, when dirty, the alarm-email block to send. `--red` returns 1 for a caller
 * that wants the non-zero exit.
 */
import { spawnSync } from 'child_process';

export interface TreeState { dirty: string[]; ok: boolean; error?: string }

export function treeState(cwd = process.cwd()): TreeState {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8' });
  if (r.status !== 0) return { dirty: [], ok: false, error: (r.stderr || 'git failed').trim().slice(0, 200) };
  const dirty = (r.stdout || '').split('\n').map(l => l.trimEnd()).filter(Boolean);
  return { dirty, ok: true };
}

/** The block a scheduled session pastes onto the board. Pure — takes state, returns text. */
export function treeReport(s: TreeState, task: string, iso: string): string {
  if (!s.ok)
    return `TREE — UNREADABLE (${s.error}). An unread tree is not a clean one; report this line as 🔴.`;
  if (!s.dirty.length) return 'TREE — CLEAN (git status --porcelain empty)';
  const head = `TREE — 🔴 DIRTY: ${s.dirty.length} uncommitted path(s)`;
  return (
    `${head}\n` +
    s.dirty.slice(0, 40).map(l => `    ${l}`).join('\n') +
    (s.dirty.length > 40 ? `\n    … ${s.dirty.length - 40} more` : '') +
    `\n  ALARM EMAIL REQUIRED — this script cannot send mail (transport is deliberately independent\n` +
    `  of the workspace mount). Send now:\n` +
    `    To: cosmictrex11@gmail.com\n` +
    `    Subject: 🔴 PIPELINE ALARM — dirty tree at ${task} canary ${iso}\n` +
    `    Body:    ${head}. Uncommitted work is work that can be lost; the class already erased\n` +
    `             IMP-102's --stamp and deleted three detectors in b3512c2.`
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const task = (argv.find(a => a.startsWith('--task=')) ?? '--task=unknown').slice(7);
  const iso = new Date().toISOString();

  if (argv.includes('--selftest')) {
    let pass = 0, fail = 0;
    const t = (n: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${n}`); };
    t('[tree] a CLEAN tree reports clean and says so in one line',
      treeReport({ dirty: [], ok: true }, 'x', iso) === 'TREE — CLEAN (git status --porcelain empty)');
    const dirty = treeReport({ dirty: [' M a.ts', '?? b.ts'], ok: true }, 'brief-morning', iso);
    t('[tree] a DIRTY tree names the count, lists the paths, and prints the alarm email',
      /TREE — 🔴 DIRTY: 2 uncommitted path\(s\)/.test(dirty) && dirty.includes(' M a.ts') && dirty.includes('cosmictrex11@gmail.com'));
    t('[tree] the alarm subject carries the task and the timestamp, so a board line identifies its own run',
      dirty.includes('dirty tree at brief-morning canary'));
    t('[tree] an UNREADABLE tree is 🔴, never silently clean — an unread tree is not a clean one',
      /UNREADABLE/.test(treeReport({ dirty: [], ok: false, error: 'not a git repo' }, 'x', iso)));
    t('[tree] N/A STATE: git failing produces ok:false rather than an empty-and-therefore-clean result',
      treeState('/nonexistent-path-for-selftest').ok === false);
    console.log(`\n${fail ? '❌' : '✅'} tree-canary --selftest: ${pass}/${pass + fail} assertions passed.`);
    process.exit(fail ? 1 : 0);
  }

  const s = treeState();
  console.log(treeReport(s, task, iso));
  process.exit(argv.includes('--red') && (!s.ok || s.dirty.length) ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('tree-canary')) main();
