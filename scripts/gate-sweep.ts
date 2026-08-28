#!/usr/bin/env node --experimental-strip-types
/**
 * gate-sweep.ts — A CORRECT GATE THAT NO STAGE CALLS IS NOT A GATE. IT IS A FILE.
 * (IMP-160, 2026-08-11 — the 08-11 Critic's mandate #1(a), RC3. Converts ESC-013 and ESC-014,
 *  both prose escalations about orphaned gates, into a single mechanical check.)
 *
 * WORKED FAILURE — three instances, one class, and the class is now measured.
 *   1. 2026-08-08: `scripts/reader-surface-gate.ts` had banned reader-surface HTML comments since
 *      07-21 and exits 1 on `content/daily-updates/2026-08-08.md` — correctly, every time. Nothing
 *      called it. A fabricated podcast title ("Brief: Tesla's stock crashes after shocking reveal",
 *      `grep -ic tesla` = 0) reached the public feed through the hole that gate was built to close.
 *   2. 2026-08-11: `scripts/corrections-gate.ts` exited 1 on COR-008 — a falsehood ("with 178
 *      covered by all three") LIVE on the reader surface for ~30 hours. The gate was right the
 *      whole time; it is named in Pipeline_Controller's morning gate and NOT in the Editor's
 *      mandatory pasted gate block, so nothing ran it at the hour it mattered.
 *   3. 2026-08-11: `editor-handoff-gate.ts --audit-promotion` exited 1 for the SIXTH consecutive
 *      night on ORPHANED-SCRATCH. Sixth. Nothing called it on any of them.
 *
 * The 08-11 Critic named two orphans. THE ACTUAL COUNT AT BUILD TIME WAS TEN — measured, not
 * estimated. That is why this is a detector and not three wiring edits: the wiring edits fix the
 * three we noticed, and this fixes the ones we have not noticed yet. Under the proxy discipline
 * (Ceiling_Doctrine §9) a new structural check needs a RECURRING class, ≥2 occurrences. This is
 * n=10 on the day it was built.
 *
 * THE CHECK. Enumerate every gate in `scripts/` that exposes a CLI entry point. Diff that set
 * against the set of gates any STAGE actually invokes. Report every gate that exists and is
 * called by nothing.
 *
 * 🔴 THE ANTI-LAUNDERING RULE — the one design decision this whole check rests on.
 * Records are not callers. `system/Improvement_Ledger.md` rows carry `run:npx tsx scripts/x.ts`
 * strings as their mechanical-check field, and history files (Root_Cause_Library, Change_Record_*,
 * CARRY, Renovation_Log) quote invocations in prose. If those counted as callers, EVERY orphan
 * would show up CALLED by the very row that claims it is enforced — the registry would launder
 * exactly the failure it is supposed to expose. A `run:` in the ledger proves the check EXISTS.
 * Only a stage doc or a task body proves something RUNS it. See RECORD_FILES below.
 *
 * Usage: node --experimental-strip-types scripts/gate-sweep.ts            # sweep, exit 1 on orphans
 *        node --experimental-strip-types scripts/gate-sweep.ts --run      # + execute each orphan
 *        node --experimental-strip-types scripts/gate-sweep.ts --selftest
 * Exit: 0 no un-retired orphans · 1 orphans found · 2 usage/IO error
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const REPO = path.resolve(import.meta.dirname ?? __dirname, '..');

/**
 * Deliberately retired / non-stage gates. Retiring is a CODE change with a reason, never a silent
 * drop — that is the whole point of keeping the list here instead of in a data file someone edits
 * without review.
 */
const RETIRED: Record<string, string> = {
  'gate-replay.mjs':
    'harness, not a gate — replays other gates against archived briefs on demand',
  'audio-gate-regression.ts':
    'regression harness for the audio gate family; invoked by IMP-018 verification, not by a stage',
  'quality-gate-timestamp.ts':
    'helper invoked inline by the QG stage prose, not an independent detector',
};

/** Files that RECORD invocations rather than PERFORM them. Never counted as callers. */
const RECORD_FILES = [
  'Improvement_Ledger.md',
  'Root_Cause_Library.md',
  'CARRY.md',
  'Renovation_Log.md',
  'Corrections_Ledger.md',
  'Quality_Tracker_final.md',
  'Thesis_Tracker.md',
  'Prediction_Calibration_Log.md',
  'Accountability_Cycle.md',
  'Complexity_Map.md',
  'Escalation_Mechanism.md',
];

function isRecordFile(f: string): boolean {
  const b = path.basename(f);
  return (
    RECORD_FILES.includes(b) ||
    /^Change_Record_/.test(b) ||
    /^Ceiling_Analysis_/.test(b) ||
    /^System_Audit_/.test(b) ||
    /^Deep_Clean_/.test(b) ||
    /^Edit_Log_/.test(b) ||
    /^Status_/.test(b) ||
    /^Engagement_Review_/.test(b)
  );
}

function isNoise(f: string): boolean {
  return (
    /\.bak/.test(f) ||
    /(^|\/)(archive|zzOld|worktrees|node_modules)(\/|$)/.test(f) ||
    /\.stale-/.test(f)
  );
}

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (isNoise(p)) continue;
    if (e.isDirectory()) walk(p, out, depth + 1);
    else out.push(p);
  }
  return out;
}

/** A gate = a file in scripts/ whose name contains "gate", with a runnable extension. */
export function enumerateGates(scriptsDir: string): string[] {
  if (!fs.existsSync(scriptsDir)) return [];
  return fs
    .readdirSync(scriptsDir)
    .filter(f => /gate/i.test(f))
    .filter(f => /\.(ts|sh|mjs|js)$/.test(f))
    .filter(f => !isNoise(f))
    .sort();
}

/** Does the file expose a CLI entry point? A library with no argv is not an orphan, it is a module. */
export function hasCliEntry(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  const src = fs.readFileSync(file, 'utf8');
  if (/\.(sh)$/.test(file)) return /^#!/.test(src);
  return /process\.argv/.test(src) || /process\.exit\s*\(\s*main/.test(src);
}

/**
 * Invocation-shaped reference to scripts/<basename>. A bare mention in prose ("reader-surface-gate
 * has banned comments since 07-21") is NOT a call — that sentence is exactly what nine published
 * briefs' worth of comment leaks were "protected" by.
 */
export function callerPattern(basename: string): RegExp {
  const esc = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    String.raw`(?:npx\s+tsx|npx\s+ts-node|\btsx\b|\bnode\b[^\n\`]{0,60}?|\bbash\b|\bsh\b|\bpython3?\b|\./)\s*[^\s\`'"]*scripts/${esc}`
  );
}

export interface SweepRow {
  gate: string;
  cli: boolean;
  callers: string[];
  retired?: string;
}

export function sweep(repo: string): SweepRow[] {
  const scriptsDir = path.join(repo, 'scripts');
  const gates = enumerateGates(scriptsDir);

  // Candidate caller surfaces: stage docs, task bodies, and executable scripts.
  const candidates = [
    ...walk(path.join(repo, 'system')).filter(f => /\.(md|json)$/.test(f)),
    ...walk(path.join(repo, '.claude')),
    ...walk(scriptsDir).filter(f => /\.(sh|py|mjs|ts|js)$/.test(f)),
    ...walk(path.join(repo, '.github')),
    ...(fs.existsSync(path.join(repo, 'package.json'))
      ? [path.join(repo, 'package.json')]
      : []),
  ].filter(f => !isNoise(f) && !isRecordFile(f));

  const contents = new Map<string, string>();
  for (const f of candidates) {
    try {
      contents.set(f, fs.readFileSync(f, 'utf8'));
    } catch {
      /* unreadable → not a caller */
    }
  }

  return gates.map(g => {
    const re = callerPattern(g);
    const callers: string[] = [];
    for (const [f, src] of contents) {
      if (path.basename(f) === g) continue; // a gate is never its own caller
      if (re.test(src)) callers.push(path.relative(repo, f));
    }
    return {
      gate: g,
      cli: hasCliEntry(path.join(scriptsDir, g)),
      callers,
      retired: RETIRED[g],
    };
  });
}

export function orphansOf(rows: SweepRow[]): SweepRow[] {
  return rows.filter(r => r.cli && !r.retired && r.callers.length === 0);
}

// ── selftest ────────────────────────────────────────────────────────────────
function selftest(): number {
  const tmp = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? '/tmp', 'gsweep-')
  );
  const S = path.join(tmp, 'scripts');
  const Y = path.join(tmp, 'system');
  fs.mkdirSync(S, { recursive: true });
  fs.mkdirSync(Y, { recursive: true });

  const cliSrc = 'const a = process.argv.slice(2);\nprocess.exit(0);\n';
  fs.writeFileSync(path.join(S, 'called-gate.ts'), cliSrc);
  fs.writeFileSync(path.join(S, 'orphan-gate.ts'), cliSrc);
  fs.writeFileSync(path.join(S, 'laundered-gate.ts'), cliSrc);
  fs.writeFileSync(path.join(S, 'prose-only-gate.ts'), cliSrc);
  fs.writeFileSync(path.join(S, 'library-gate.ts'), 'export const x = 1;\n'); // no CLI

  // A real stage doc that RUNS one gate.
  fs.writeFileSync(
    path.join(Y, 'Brief_Editor.md'),
    'Run `npx tsx scripts/called-gate.ts daily-briefs/x.md` and paste the output.\n'
  );
  // A RECORD that merely cites an invocation — must NOT launder the orphan.
  fs.writeFileSync(
    path.join(Y, 'Improvement_Ledger.md'),
    '| IMP-999 | ... | run:npx tsx scripts/laundered-gate.ts --selftest | ... |\n'
  );
  // Prose mention with no invocation shape — must NOT count as a caller.
  fs.writeFileSync(
    path.join(Y, 'Workflow_v3.md'),
    'The prose-only-gate.ts has banned reader-surface comments since 07-21.\n'
  );

  const rows = sweep(tmp);
  const byName = (n: string) => rows.find(r => r.gate === n)!;
  const orphanNames = orphansOf(rows)
    .map(r => r.gate)
    .sort();

  const checks: [string, boolean][] = [
    [
      'a gate invoked by a stage doc is CALLED',
      byName('called-gate.ts').callers.length === 1,
    ],
    [
      'a gate invoked by nothing is an ORPHAN',
      orphanNames.includes('orphan-gate.ts'),
    ],
    [
      '🔴 ANTI-LAUNDERING: a `run:` cite in Improvement_Ledger.md does NOT make a gate called',
      byName('laundered-gate.ts').callers.length === 0 &&
        orphanNames.includes('laundered-gate.ts'),
    ],
    [
      'a bare prose mention is not a call (the reader-surface-gate shape)',
      orphanNames.includes('prose-only-gate.ts'),
    ],
    [
      'a module with no CLI entry is not reported as an orphan',
      !orphanNames.includes('library-gate.ts'),
    ],
    ['fixture orphan count is exactly 3', orphanNames.length === 3],
  ];

  // REAL-REPO LEG — binds the fixture to the artifact it protects. A selftest that only ever
  // reads its own fixtures proves the regexes compile, not that they see the pipeline.
  let realFire = false;
  let realSilent = false;
  if (fs.existsSync(path.join(REPO, 'scripts', 'fact-gate.ts'))) {
    const live = sweep(REPO);
    const liveOrphans = orphansOf(live).map(r => r.gate);
    realSilent =
      (live.find(r => r.gate === 'fact-gate.ts')?.callers.length ?? 0) > 0;
    realFire = liveOrphans.length > 0;
    checks.push([
      'REAL REPO: fact-gate.ts is CALLED (silent on a wired gate)',
      realSilent,
    ]);
    checks.push([
      'REAL REPO: the sweep finds at least one live orphan (fires on the real class)',
      realFire,
    ]);
  }

  console.log('gate-sweep --selftest');
  for (const [name, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${name}`);
  fs.rmSync(tmp, { recursive: true, force: true });

  const pass = checks.every(([, ok]) => ok);
  console.log(pass ? '\n✅ SELFTEST PASS' : '\n❌ SELFTEST FAIL');
  return pass ? 0 : 1;
}

// ── main ────────────────────────────────────────────────────────────────────
function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const rows = sweep(REPO);
  const orphans = orphansOf(rows);
  const called = rows.filter(r => r.callers.length > 0);
  const retired = rows.filter(r => r.retired);

  console.log(
    `gate-sweep — ${rows.length} gates · ${called.length} called · ${orphans.length} ORPHANED · ${retired.length} retired`
  );

  for (const r of orphans) {
    console.log(
      `  ✗ ORPHAN  scripts/${r.gate} — exists, has a CLI entry, called by NO stage`
    );
    if (args.includes('--run')) {
      let code = 0;
      let head = '';
      try {
        head = execSync(
          `node --experimental-strip-types ${path.join(REPO, 'scripts', r.gate)} --selftest 2>&1 | tail -3`,
          { cwd: REPO, encoding: 'utf8', timeout: 60_000 }
        );
      } catch (e: any) {
        code = e.status ?? 1;
        head = (e.stdout ?? e.message ?? '')
          .toString()
          .split('\n')
          .slice(-3)
          .join('\n');
      }
      console.log(
        `      → --selftest exit ${code}: ${head.trim().replace(/\n/g, ' | ')}`
      );
    }
  }
  for (const r of retired)
    console.log(`  · retired  scripts/${r.gate} — ${r.retired}`);

  if (!orphans.length) {
    console.log(
      '  ✅ every CLI gate in scripts/ is invoked by at least one stage'
    );
    return 0;
  }
  console.log(
    `\n❌ ${orphans.length} ORPHANED GATE(S). A correct gate that no stage calls is not a gate, it is a file.\n` +
      `   Wire each into the stage that owns it (system/Brief_Editor.md, system/Pipeline_Controller.md,\n` +
      `   system/Brief_Validator.md), or add it to RETIRED in this file WITH A REASON.`
  );
  return 1;
}

process.exit(main());
