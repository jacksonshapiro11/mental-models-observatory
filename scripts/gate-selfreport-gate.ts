#!/usr/bin/env node --experimental-strip-types
/**
 * gate-selfreport-gate.ts — A GATE VERDICT MUST BE A MEASUREMENT, NOT AN OPINION.
 *
 * IMP-128 · 2026-08-04 Critic mandate #1 · RC2 · recurrence of E-EDITOR-GATE-SELFREPORT-01.
 *
 * ── THE FAILURE ────────────────────────────────────────────────────────────────────────────────
 * The 08-04 v2's Validation Report pasted `fact-gate.ts  ✅ PASS — … 4 FLAGs, all expected and all
 * routed`, and the `brief-editor` status line certified `evening-truth: 4 flags, 0 unresolved`.
 * The Critic re-ran the gate against that same v2 and got `❌ FACT-GATE FAIL — 6 issue(s)`, six
 * of them `unverified-critical`. The FLAG COUNT was right and the VERDICT was inverted, which is
 * strictly worse than a wrong count: a reader of the log sees a green gate. E-EDITOR-GATE-
 * SELFREPORT-01 was opened in Week 21 for exactly this shape. It happened again.
 *
 * ── WHY THIS GATE DOES NOT DO WHAT THE CRITIC ASKED FOR ────────────────────────────────────────
 * The mandate prescribed: re-run each named gate against the same v2 and fail on any verdict
 * mismatch. That mechanism cannot work, and this session has the receipt. Re-running `fact-gate`
 * against `daily-briefs/2026-08-04-v2.md` at 10:03 on 08-04 exits **0** — because the Morning
 * Updater wrote `2026-08-04-truth.json` at 05:13 and the six `unverified-critical` rows the Critic
 * saw at 19:45 are now resolved. The gates read time-varying inputs (truth files, the archive,
 * the premise registries), so a later re-run measures a DIFFERENT WORLD. An acceptance gate whose
 * verdict depends on what time you run it is not a gate. Built as prescribed, this script would
 * have exited 0 on the very artifact it was commissioned to catch.
 *
 * You cannot re-litigate last night's exit code. You CAN require that it was recorded. So:
 *
 *   1. MISSING MEASUREMENT (🔴) — a gate line asserts a verdict glyph (✅/❌/PASS/FAIL) and carries
 *      no `EXIT=<n>` captured from the run. A glyph is an opinion; an exit code is a measurement.
 *      This is the root fix: once the verdict is transcribed rather than authored, it cannot be
 *      inverted by the author's reading of the output.
 *   2. INVERTED VERDICT (🔴) — a line carries BOTH a glyph and an `EXIT=<n>` and they contradict
 *      (✅ with a non-zero exit, ❌ with zero). Time-independent: both facts are in the file.
 *   3. `--rerun` (advisory, never blocking) — re-runs each named gate and prints drift, labelled
 *      as drift. Useful signal, inadmissible as a verdict, for the reason above.
 *
 * ── ENFORCEMENT EPOCH: THE ARCHIVE IS READ, NEVER CONDEMNED ────────────────────────────────────
 * Every v2 in the archive predates this requirement and uses bare glyphs, so an ungated version of
 * this check would red-fail 100% of the corpus on day one. That is the mistake IMP-125 had to undo
 * and IMP-116 documented. Briefs dated before EPOCH are measured and REPORTED; only briefs written
 * under the rule can fail it.
 *
 * Usage:
 *   gate-selfreport-gate.ts <YYYY-MM-DD | path-to-v2.md> [--rerun]
 *   gate-selfreport-gate.ts --sweep [n]     # how big is E-EDITOR-GATE-SELFREPORT-01, actually?
 *   gate-selfreport-gate.ts --selftest
 *
 * Exit codes: 0 clean (or pre-epoch) · 1 finding on an in-epoch brief · 2 usage error.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const EPOCH = '2026-08-05'; // the first brief written after this rule exists
const BLOCK_HEADER = /MECHANICAL GATE OUTPUT/i;
const GATE_LINE = /^\s*([A-Za-z][\w.-]*\.(?:ts|sh|py))\s+(.*)$/;
const EXIT_RE = /\bEXIT\s*[=:]?\s*(\d+)\b/i;
const GLYPH_PASS = /✅|(?<![A-Za-z])PASS(?![A-Za-z])/;
const GLYPH_FAIL = /❌|🔴|(?<![A-Za-z])FAIL(?![A-Za-z])/;

export type Finding = {
  kind:
    | 'missing-measurement'
    | 'inverted-verdict'
    | 'count-inversion'
    | 'no-block';
  gate: string;
  detail: string;
};

/**
 * ── COUNT INVERSION — IMP-132 · 2026-08-06 Critic mandate #1(b) · RC2 ──────────────────────────
 *
 * The exit-code check above has a blind spot exactly the size of an ADVISORY gate. `six-conversion
 * -gate.ts` exits 0 whether it finds nothing or ten things — the findings are for the Editor to
 * act on, not a publish blocker — so its self-report can NEVER contradict its exit code. On
 * 2026-08-06 the v2 block certified `six-conversion-gate.ts (CLEAN 0/10) EXIT=0 ✅ PASS` while the
 * gate, re-run on that same v2, returned `1 finding(s)`. Both halves of the line were true and the
 * sentence was false. IMP-128 was built to stop exactly this — a verdict authored rather than
 * transcribed — and it watched this one go by, because it only knew how to read one of the two
 * numbers on the line.
 *
 * ── WHY AN ALLOWLIST, AND NOT "RE-RUN EVERYTHING" ─────────────────────────────────────────────
 * The header above rejects re-running as a verdict source, and that reasoning still holds: gates
 * that read `{date}-truth.json`, the archive, or a premise registry measure a DIFFERENT WORLD at
 * 10:03 than they did at 19:45, so a morning re-run of `fact-gate` is drift, not evidence. But
 * that argument is about INPUTS, not about re-running, and it does not generalise: a gate whose
 * only input is the brief file is a pure function of an immutable artifact, and re-running it
 * tomorrow returns exactly what it returned last night. Those gates — and only those — can be
 * held to their reported counts. The allowlist is the discrimination, and it is deliberately
 * small: adding a gate to it is a claim that the gate reads nothing but the file, and that claim
 * must be checked in the source before the name goes in.
 */
const DETERMINISTIC_GATES = new Set<string>([
  // Verified 2026-08-06: single `fs.readFileSync(file)` of the brief, no truth file, no archive,
  // no network, no env, no clock. `grep -n "readFileSync\|spawnSync\|readdirSync\|process.env"`
  // returns exactly one line.
  'six-conversion-gate.ts',
]);

/** Counts a gate line CLAIMS. Deliberately narrow — two shapes, both unambiguous, or null. */
export function parseAssertedCount(rest: string): number | null {
  const clean =
    /\bCLEAN\b[^)\n]*?\b0\s*\/\s*\d+/i.exec(rest) ||
    /\bCLEAN\b\s*\(\s*0\b/i.exec(rest);
  if (clean) return 0;
  const n = /\b(\d+)\s+finding\(?s?\)?/i.exec(rest);
  return n ? parseInt(n[1]!, 10) : null;
}

/** Counts a gate REPORTS when re-run. Null = the output did not state a count we recognise. */
export function parseReportedCount(stdout: string): number | null {
  if (/CLEAN\s*\(0 findings\)/i.test(stdout)) return 0;
  const m = /:\s*(\d+)\s+finding\(s\)/i.exec(stdout);
  return m ? parseInt(m[1]!, 10) : null;
}

/** Pull the gate lines out of a v2's `MECHANICAL GATE OUTPUT` block. Empty array = no block. */
export function parseGateBlock(v2: string): { gate: string; rest: string }[] {
  const lines = v2.split('\n');
  const start = lines.findIndex(l => BLOCK_HEADER.test(l));
  if (start === -1) return [];
  const out: { gate: string; rest: string }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*-->\s*$/.test(line)) break;
    const m = GATE_LINE.exec(line);
    if (m) out.push({ gate: m[1]!, rest: m[2]! });
  }
  return out;
}

/**
 * `measure` re-runs a deterministic gate against the SAME v2 and returns its findings count
 * (null = not measurable). Injectable so the selftest can prove the comparison logic without
 * depending on which gates happen to be clean today.
 */
export function auditSelfReport(
  v2: string,
  measure?: (gate: string) => number | null
): Finding[] {
  const rows = parseGateBlock(v2);
  if (rows.length === 0)
    return [
      {
        kind: 'no-block',
        gate: '(none)',
        detail:
          'no `MECHANICAL GATE OUTPUT` block found in the Validation Report — the Validator is required to paste one',
      },
    ];
  const findings: Finding[] = [];
  for (const { gate, rest } of rows) {
    if (measure && DETERMINISTIC_GATES.has(gate)) {
      const asserted = parseAssertedCount(rest);
      const measured = asserted === null ? null : measure(gate);
      if (asserted !== null && measured !== null && measured !== asserted) {
        findings.push({
          kind: 'count-inversion',
          gate,
          detail: `reports ${asserted} finding(s); re-running it against this same v2 returns ${measured}. ${gate} reads nothing but the brief file, so this is not drift — the two runs measured the same bytes and disagree. An ADVISORY gate exits 0 either way, so the exit code cannot catch this: the COUNT is the verdict. Paste what the run printed.`,
        });
        continue; // one finding per line; the count contradiction subsumes the glyph check
      }
    }
    const exit = EXIT_RE.exec(rest);
    const asserted = GLYPH_PASS.test(rest)
      ? 'PASS'
      : GLYPH_FAIL.test(rest)
        ? 'FAIL'
        : null;
    if (!asserted) continue; // a line with no verdict claims nothing; nothing to contradict
    if (!exit) {
      findings.push({
        kind: 'missing-measurement',
        gate,
        detail: `asserts ${asserted} with no captured exit code. Record what the run returned: \`${gate}  EXIT=0 ✅ PASS — …\`. A glyph is the author's reading of the output; an exit code is what the process returned.`,
      });
      continue;
    }
    const code = parseInt(exit[1]!, 10);
    const measured = code === 0 ? 'PASS' : 'FAIL';
    if (measured !== asserted) {
      findings.push({
        kind: 'inverted-verdict',
        gate,
        detail: `asserted ${asserted}, actual EXIT=${code}. The verdict contradicts the measurement recorded beside it. Compare exit codes, not prose — a matching FLAG count does not launder an inverted verdict.`,
      });
    }
  }
  return findings;
}

/** Re-run one DETERMINISTIC gate against this v2 and return the findings count it prints. */
function liveCount(gate: string, v2Path: string): number | null {
  const gp = path.join(process.cwd(), 'scripts', gate);
  if (!fs.existsSync(gp)) return null;
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', gp, v2Path],
    { encoding: 'utf8', timeout: 120000 }
  );
  return parseReportedCount((r.stdout || '') + (r.stderr || ''));
}

/** ADVISORY ONLY. Re-runs each named gate now and prints drift. Never contributes to the exit code. */
function rerunDrift(
  v2Path: string,
  rows: { gate: string; rest: string }[]
): void {
  console.log(
    '\n  --rerun (ADVISORY — gates read time-varying inputs, so drift here is information, not a verdict):'
  );
  for (const { gate, rest } of rows) {
    const gp = path.join(process.cwd(), 'scripts', gate);
    if (!fs.existsSync(gp)) {
      console.log(`    ${gate}: not found in scripts/, skipped`);
      continue;
    }
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', gp, v2Path],
      { encoding: 'utf8', timeout: 120000 }
    );
    const asserted = GLYPH_PASS.test(rest)
      ? 'PASS'
      : GLYPH_FAIL.test(rest)
        ? 'FAIL'
        : '(none)';
    const now = r.status === 0 ? 'PASS' : 'FAIL';
    console.log(
      `    ${gate}: asserted ${asserted} · re-run now EXIT=${r.status} (${now})${now !== asserted && asserted !== '(none)' ? '  ← DRIFT' : ''}`
    );
  }
}

function resolveV2(arg: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg))
    return path.join(process.cwd(), 'daily-briefs', `${arg}-v2.md`);
  return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
}

function sweep(n: number): number {
  const dir = path.join(process.cwd(), 'daily-briefs');
  const files = fs
    .readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f))
    .sort()
    .slice(-n);
  let missing = 0,
    inverted = 0,
    noBlock = 0,
    clean = 0;
  for (const f of files) {
    const findings = auditSelfReport(
      fs.readFileSync(path.join(dir, f), 'utf8')
    );
    if (findings.length === 0) {
      clean++;
      continue;
    }
    if (findings.some(x => x.kind === 'inverted-verdict')) inverted++;
    else if (findings.some(x => x.kind === 'no-block')) noBlock++;
    else missing++;
    const inv = findings.filter(x => x.kind === 'inverted-verdict');
    if (inv.length)
      console.log(
        `  ${f}: INVERTED — ${inv.map(x => `${x.gate} ${x.detail.split('.')[0]}`).join('; ')}`
      );
  }
  console.log(
    `\nSWEEP — ${files.length} v2 files: ${inverted} carried an INVERTED gate verdict · ${missing} asserted a verdict with NO captured exit code · ${noBlock} had no gate block at all · ${clean} clean.`
  );
  console.log(
    'That first number is the measured size of E-EDITOR-GATE-SELFREPORT-01. Nobody had measured it before today.'
  );
  console.log(
    'The second is the size of the hole: a verdict nobody recorded cannot be checked, which is why the fix is EXIT= rather than a re-run.'
  );
  return 0;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };
  const wrap = (block: string) =>
    `# ▸ THE DASHBOARD\n\n<!--\nVALIDATION REPORT\n\nMECHANICAL GATE OUTPUT (pasted, not asserted):\n${block}\n\nFixes applied:\n- none\n-->\n`;

  // 1. The real 08-04 shape: glyphs, no exit codes.
  const REAL_08_04 =
    '  fact-gate.ts        ✅ PASS — 5 market claims, 3 superlatives. 4 FLAGs, all expected and all routed to the Morning Truth Gate.\n  novelty-gate.ts     ✅ PASS — move `custody-dispersal`.\n  assembly-gate.ts    ✅ PASS (payoff).';
  const a = auditSelfReport(wrap(REAL_08_04));
  t(
    a.length === 3 && a.every(x => x.kind === 'missing-measurement'),
    `[IMP-128] FIRES on the real 08-04 shape — 3 asserted verdicts, 0 captured exit codes (got ${a.length})`
  );

  // 2. The inversion the Critic actually caught, once an exit code IS recorded.
  const INVERTED =
    '  fact-gate.ts        EXIT=1 ✅ PASS — 4 FLAGs, all expected and all routed.';
  const b = auditSelfReport(wrap(INVERTED));
  t(
    b.length === 1 &&
      b[0]!.kind === 'inverted-verdict' &&
      /EXIT=1/.test(b[0]!.detail),
    '[IMP-128] FIRES on an INVERTED verdict (asserted PASS against EXIT=1) — the E-EDITOR-GATE-SELFREPORT-01 shape'
  );

  // 3. The compliant shape is silent.
  const GOOD =
    '  fact-gate.ts        EXIT=0 ✅ PASS — 4 FLAGs, all routed.\n  novelty-gate.ts     EXIT=0 ✅ PASS\n  ceiling-lint.ts     EXIT=1 ❌ FAIL — 2 FLAGs, both routed to Editor Gate 14(e).';
  t(
    auditSelfReport(wrap(GOOD)).length === 0,
    '[IMP-128] SILENT when every verdict is transcribed from a captured EXIT= (including an honest ❌ at EXIT=1)'
  );
  const BLANK_SEPARATED =
    '  fact-gate.ts        EXIT=0 ✅ PASS\n\n  novelty-gate.ts     EXIT=1 ✅ PASS';
  const blankFindings = auditSelfReport(wrap(BLANK_SEPARATED));
  t(
    blankFindings.length === 1 &&
      blankFindings[0]!.gate === 'novelty-gate.ts' &&
      blankFindings[0]!.kind === 'inverted-verdict',
    '[IMP-128] FIRES on an inverted gate line after a blank separator inside the mechanical-output block'
  );

  // 4. The 08-04 line that already did it right is a positive control for the parser.
  const CONTROL =
    '  predraft-consumption-gate.ts  ✅ EXIT 0 — "every on-disk pre-draft is present in v1". 0 FAIL, 0 FLAG.';
  t(
    auditSelfReport(wrap(CONTROL)).length === 0,
    '[IMP-128] SILENT on 08-04\'s own predraft-consumption line ("✅ EXIT 0") — the format is already achievable'
  );

  // 4b. IMP-132 — COUNT INVERSION. The line is VERBATIM from 2026-08-06-v2.md. Note what it does
  // to the exit-code check: EXIT=0 and ✅ PASS agree perfectly, so IMP-128 passes it. The lie is
  // in the third number. `measure` is injected so this proves the COMPARISON, not today's weather:
  // with the gate returning 1 (what it actually returned on 08-06, before IMP-131 fixed the
  // extractSection false positive) the line must FAIL; with it returning 0 (what it returns now
  // that the gate reads the section instead of the editor's note about the section) it must PASS.
  //
  // HONEST NOTE ON THE ACCEPTANCE GATE: the Critic asked for "exit 1 on tonight's real v2 block."
  // Applying mandate 1(a) in the same session makes that literally unsatisfiable — once the gate
  // stops mis-reading the comment block, tonight's `CLEAN 0/10` becomes TRUE and the correct
  // behaviour is silence. Chasing the letter of it would mean preserving the false positive to
  // keep a test red. So the FIRE case is proved against the verbatim line with the count the gate
  // actually produced last night, and the live 08-06 file is asserted SILENT below, deliberately.
  const REAL_08_06 =
    '  six-conversion-gate.ts         on 2026-08-06-v2.md (CLEAN 0/10)       EXIT=0 ✅ PASS';
  const c1 = auditSelfReport(wrap(REAL_08_06), () => 1);
  t(
    c1.length === 1 &&
      c1[0]!.kind === 'count-inversion' &&
      /returns 1/.test(c1[0]!.detail),
    "[IMP-132] FIRES on 08-06's verbatim line — asserted CLEAN 0/10, gate returns 1 finding, EXIT=0 ✅ agree (the ADVISORY blind spot)"
  );
  t(
    auditSelfReport(wrap(REAL_08_06), () => 0).length === 0,
    '[IMP-132] SILENT on the same line once the count matches — a true self-report is not a finding'
  );
  t(
    auditSelfReport(wrap(REAL_08_06)).length === 0,
    '[IMP-132] SILENT with no measurer injected — the count check is opt-in, so sweep()/archive reads never re-run gates'
  );
  // The allowlist is the discrimination, not decoration: a time-varying gate is never re-measured.
  const TIMEVARY =
    '  fact-gate.ts        EXIT=0 ✅ PASS — CLEAN 0/10 claims, all resolved.';
  t(
    auditSelfReport(wrap(TIMEVARY), () => 6).length === 0,
    '[IMP-132] SILENT on a NON-deterministic gate (fact-gate reads {date}-truth.json) even when the re-run disagrees — drift is not a verdict'
  );
  // End-to-end on the live artifacts, which is the state the fix is supposed to produce.
  const live06 = path.join(process.cwd(), 'daily-briefs', '2026-08-06-v2.md');
  const live05 = path.join(process.cwd(), 'daily-briefs', '2026-08-05-v2.md');
  if (fs.existsSync(live06))
    t(
      runOne(live06, false, true) === 0,
      '[IMP-132] EXIT 0 on the real 2026-08-06 v2 — after IMP-131 its CLEAN 0/10 is true'
    );
  if (fs.existsSync(live05))
    t(
      runOne(live05, false, true) === 0,
      "[IMP-132] EXIT 0 on the real 2026-08-05 v2 (the Critic's silent-case acceptance leg)"
    );

  // 5. A missing block is its own finding.
  t(
    auditSelfReport('# ▸ THE DASHBOARD\n\nno validation report here\n')[0]!
      .kind === 'no-block',
    '[IMP-128] FLAGS a v2 with no MECHANICAL GATE OUTPUT block'
  );

  // 6. THE EPOCH IS REAL — the archive is measured, never failed.
  const dir = path.join(process.cwd(), 'daily-briefs');
  if (fs.existsSync(dir)) {
    const archive = fs
      .readdirSync(dir)
      .filter(
        f => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f) && f.slice(0, 10) < EPOCH
      )
      .sort()
      .slice(-5);
    const codes = archive.map(f => runOne(path.join(dir, f), false, true));
    t(
      codes.every(c => c === 0),
      `[IMP-128] EPOCH: the trailing ${archive.length} pre-${EPOCH} v2 files exit 0 (reported, never condemned — the IMP-125 lesson)`
    );
  }

  console.log(
    `\ngate-selfreport-gate selftest — ${fails ? 'FAILED' : 'PASS'} (missing-measurement + inverted-verdict + epoch verified both directions)`
  );
  return fails ? 1 : 0;
}

function runOne(v2Path: string, rerun: boolean, quiet = false): number {
  if (!fs.existsSync(v2Path)) {
    console.error(`File not found: ${v2Path}`);
    return 2;
  }
  const v2 = fs.readFileSync(v2Path, 'utf8');
  const dateMatch = path.basename(v2Path).match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    if (!quiet)
      console.error(
        `Cannot determine brief date from filename: ${v2Path}. Use a YYYY-MM-DD filename so epoch enforcement cannot fail open.`
      );
    return 2;
  }
  const briefDate = dateMatch[1]!;
  const inEpoch = briefDate >= EPOCH;
  const findings = auditSelfReport(v2, gate => liveCount(gate, v2Path));

  if (!quiet) {
    console.log(
      `gate-selfreport-gate — ${path.basename(v2Path)} (${inEpoch ? 'IN EPOCH — findings BLOCK' : `pre-${EPOCH} — reported, never condemned`})`
    );
    for (const f of findings)
      console.log(
        `  ${inEpoch ? '🔴' : '🟡'} [${f.kind}] ${f.gate}: ${f.detail}`
      );
    if (!findings.length)
      console.log(
        '  ✅ every asserted gate verdict is backed by a captured exit code.'
      );
    if (rerun) rerunDrift(v2Path, parseGateBlock(v2));
  }
  if (findings.length && inEpoch) {
    if (!quiet)
      console.error(
        '\n❌ GATE SELF-REPORT FAIL — the validation report certifies a verdict it did not measure. Paste EXIT= from the run, or write NOT RUN.'
      );
    return 1;
  }
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  if (args.includes('--sweep')) {
    const i = args.indexOf('--sweep');
    return sweep(parseInt(args[i + 1] || '30', 10) || 30);
  }
  const target = args.find(a => !a.startsWith('--'));
  if (!target) {
    console.error(
      'Usage: gate-selfreport-gate.ts <YYYY-MM-DD | path-to-v2.md> [--rerun] | --sweep [n] | --selftest'
    );
    return 2;
  }
  return runOne(resolveV2(target), args.includes('--rerun'));
}

const invokedDirectly =
  !!process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('gate-selfreport-gate.ts');
if (invokedDirectly) process.exit(main());
