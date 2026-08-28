/**
 * evening-truth-gate.ts — close E-TRUTH-BYPASS-EVENING-01 without touching the structure.
 *
 * WHY: the 5:06 AM Morning Truth Gate is the ONLY mechanical check standing between a wrong
 * number and a reader. The Quality Tracker calls it "a single point of failure with no
 * redundancy." Between 6:01 PM and midnight the Writer, QG, Editor and Critic all hand content
 * along with no truth check at all — the evening chain writes `truthFile: null`, which is
 * E-TRUTH-BYPASS-EVENING-01. It has fired 11+ times, 9 of them on 2026-08-01 alone.
 *
 * WHAT THIS IS NOT: a new pipeline stage. The structure is frozen (Standing Ruling #2), so this
 * adds no task, no section, no ordering change. It runs the EXISTING fact-gate against v2 at the
 * Editor stage and records what it finds. Warn-only — it can never block a brief.
 *
 * WHAT IT BUYS: the morning gate stops discovering truth work at 5 AM. It inherits a written
 * worklist from nine hours earlier, and the evening chain stops being truth-blind. If the file
 * comes back empty for 30 straight days, the morning gate really was sufficient and
 * E-TRUTH-BYPASS-EVENING-01 closes with evidence instead of staying open another month.
 *
 *   node --experimental-strip-types scripts/evening-truth-gate.ts {BRIEF_DATE}
 *   node --experimental-strip-types scripts/evening-truth-gate.ts {BRIEF_DATE} --strict   # exit 1 on findings
 *   node --experimental-strip-types scripts/evening-truth-gate.ts --selftest
 */

/**
 * 🔴 SETTLED-CLOSE CAPTURE (C2, 2026-08-28) — REQUIRED OF THE EVENING TRUTH PASS.
 *
 * For EVERY price or percentage move the brief quotes on a US-listed instrument, after the 16:00 ET
 * settle, write a claim to `daily-briefs/{BRIEF_DATE}-truth.json`:
 *
 *   "close:{TICKER}:{SESSION_DATE}": {
 *     "resolved": true, "direction": "up"|"down",
 *     "value": <settled level>, "magnitudePct": <settled % move>,
 *     "window": "{SESSION_DATE} settled close",
 *     "source": "<where the close came from>",
 *     "names": ["Micron"]            // company names as the prose writes them
 *   }
 *
 * `names` is not decoration: the prose says "Salesforce", not "CRM", and without it the check
 * cannot connect a sentence to its own close.
 *
 * WHAT IT IS FOR, and why an instrument-level exemption was rejected: `fact-gate`'s
 * `settledCloseFindings` exempts a sentence only when the NUMBER IT QUOTES matches this row.
 * Exempting every sentence about a recorded instrument was wired first and measured — it would have
 * exempted the Salesforce sentence, whose defect is that it says "about 21 percent" while the close
 * is +22.60%. **Recording a close does not mean the prose used it.**
 *
 * A row with `resolved: false` is a close that was looked for and not found. That is the opposite of
 * an exemption and must never be written as one.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface EveningTruth {
  flags: string[];
  unresolved: string[];
  pass: boolean;
}

/** Pure — parses fact-gate output so it is testable without running the pipeline. */
export function parseFactGate(out: string): EveningTruth {
  const flags = (out.match(/⚠ \[[a-z-]+\][^\n]*/g) || []).map(s => s.trim());
  const unresolved = (out.match(/UNRESOLVED-FACT:[^\n]*/g) || []).map(s =>
    s.trim()
  );
  return { flags, unresolved, pass: /✅ FACT-GATE PASS/.test(out) };
}

export function renderReport(date: string, t: EveningTruth): string {
  const lines = [
    `# Evening truth pass — ${date}`,
    '',
    'Warn-only. Produced at the Editor stage so the 5:06 AM Morning Truth Gate inherits a worklist',
    'instead of discovering it. Nothing here blocks the brief.',
    '',
    `**fact-gate verdict:** ${t.pass ? 'PASS' : 'NOT PASS'} · ${t.flags.length} flag(s) · ${t.unresolved.length} unresolved`,
    '',
  ];
  if (!t.flags.length && !t.unresolved.length) {
    lines.push(
      'No findings. If this holds 30 consecutive nights, E-TRUTH-BYPASS-EVENING-01 can close on evidence.'
    );
  } else {
    if (t.flags.length)
      lines.push(
        '## Flags for the morning gate',
        '',
        ...t.flags.map(f => `- ${f}`),
        ''
      );
    if (t.unresolved.length)
      lines.push(
        '## Unresolved claims',
        '',
        ...t.unresolved.map(u => `- ${u}`),
        ''
      );
  }
  return lines.join('\n') + '\n';
}

function selftest(): number {
  let ok = 0,
    fail = 0;
  const t = (n: string, c: boolean) => {
    c ? ok++ : fail++;
    console.log(`  ${c ? '✓' : '✗'} ${n}`);
  };
  const real = `  1 FLAG (verify):\n   ⚠ [take-extraordinary-claim] TAKE EXTRAORDINARY CLAIM — "roughly $1.6 billion in all of 2025"\n\n✅ FACT-GATE PASS`;
  const p = parseFactGate(real);
  t(
    'parses the real 08-01 flag',
    p.flags.length === 1 && p.flags[0]!.includes('take-extraordinary-claim')
  );
  t('reads PASS correctly', p.pass === true);
  t(
    'parses UNRESOLVED-FACT lines',
    parseFactGate('UNRESOLVED-FACT: GM +22%').unresolved.length === 1
  );
  t(
    'clean input yields no findings',
    (() => {
      const c = parseFactGate('✅ FACT-GATE PASS');
      return !c.flags.length && !c.unresolved.length && c.pass;
    })()
  );
  t(
    'report names the 30-night close condition when clean',
    renderReport('2026-08-01', parseFactGate('✅ FACT-GATE PASS')).includes(
      '30 consecutive nights'
    )
  );
  t(
    'report lists findings when present',
    renderReport('2026-08-01', p).includes('take-extraordinary-claim')
  );
  console.log(`\nevening-truth-gate selftest — ${ok} passed · ${fail} failed`);
  return fail ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error(
      'usage: evening-truth-gate.ts <YYYY-MM-DD> [--strict] | --selftest'
    );
    return 2;
  }
  const strict = args.includes('--strict');
  const v2 = path.join(process.cwd(), `daily-briefs/${date}-v2.md`);
  if (!fs.existsSync(v2)) {
    console.error(`evening-truth-gate: no v2 for ${date}`);
    return 2;
  }

  let out = '';
  try {
    out = execSync(
      `node --experimental-strip-types scripts/fact-gate.ts ${v2}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (e: any) {
    out = (e.stdout || '') + (e.stderr || '');
  }

  const t = parseFactGate(out);
  const report = path.join(
    process.cwd(),
    `daily-briefs/${date}-evening-truth.md`
  );
  fs.writeFileSync(report, renderReport(date, t), 'utf8');

  console.log(
    `evening-truth-gate ${date} — ${t.flags.length} flag(s), ${t.unresolved.length} unresolved → ${path.basename(report)}`
  );
  for (const f of [...t.flags, ...t.unresolved])
    console.error(`  🟡 ${f.slice(0, 160)}`);
  if (!t.flags.length && !t.unresolved.length)
    console.log('  ✓ evening chain is truth-clean.');
  else
    console.log(
      '  🟡 WARN-ONLY — does not block. The morning gate inherits this worklist.'
    );
  return strict && (t.flags.length || t.unresolved.length) ? 1 : 0;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exit(main());
