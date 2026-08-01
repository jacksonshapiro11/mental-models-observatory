/**
 * predraft-correction-gate.ts — CHECK C: FIDELITY, not just presence.
 *
 * WHY (2026-08-01, E-PREDRAFT-CORRECTION-REVERSION-01): the pre-draft fix landed — the Writer
 * consumed all four pre-drafts, QG rewrite fell 38% -> 0%. But it shipped a SUPERSEDED number
 * from inside one: the take-draft's own adversarial fact-check had already corrected "roughly
 * 46% below its 2025 high" to "about 40%", and v1 carried the pre-correction figure. Both
 * provenance-gate and predraft-consumption-gate exited 0, correctly — they verify a pre-draft was
 * PRESENT and CONSUMED, never that the version used was the corrected one.
 *
 * Pre-drafts record their corrections in a parseable form:
 *     "roughly 46% below its 2025 high" was WRONG ... FIXED to "about 40%."
 *     "in February" -> "in early 2026"
 * This extracts those pairs and FAILs if the superseded string survives into the draft.
 *
 *   node --experimental-strip-types scripts/predraft-correction-gate.ts {BRIEF_DATE} [--stage v1|v1.5|v2]
 *   node --experimental-strip-types scripts/predraft-correction-gate.ts --selftest
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const COMPONENTS = ['take-draft', 'signal-draft', 'discovery-draft', 'cc-predraft'] as const;

export interface Correction { wrong: string; right: string; component: string }

/** Extract (superseded -> corrected) pairs from a pre-draft's self-recorded fact-check. */
export function extractCorrections(text: string, component = 'unknown'): Correction[] {
  const out: Correction[] = [];
  const seen = new Set<string>();
  const push = (wrong: string, right: string) => {
    wrong = wrong.trim(); right = right.trim().replace(/[.,;]$/, '');
    // Ignore trivial or overly generic strings — they produce false positives on normal prose.
    if (wrong.length < 6 || wrong === right || seen.has(wrong)) return;
    seen.add(wrong); out.push({ wrong, right, component });
  };
  // Pattern A:  "<wrong>" ... FIXED to "<right>"   (also CORRECTED to / REVISED to / changed to)
  for (const m of text.matchAll(/"([^"]{6,120})"[^"\n]{0,200}?\b(?:FIXED|CORRECTED|REVISED|CHANGED)\s+to\s+"([^"]{1,120})"/gi)) {
    push(m[1]!, m[2]!);
  }
  // Pattern B:  "<wrong>" -> "<right>"
  for (const m of text.matchAll(/"([^"]{6,120})"\s*(?:->|→)\s*"([^"]{1,120})"/g)) {
    push(m[1]!, m[2]!);
  }
  return out;
}

export function violations(draft: string, corrections: Correction[]): Correction[] {
  return corrections.filter(c => draft.includes(c.wrong));
}

function runOnDate(date: string, stage: string, root = process.cwd()): number {
  const candidates = stage === 'v1'
    ? [`daily-briefs/${date}-v1.md`, `daily-briefs/${date}-v1-pre-quality-gate.md`]
    : [`daily-briefs/${date}-${stage}.md`];
  const draftPath = candidates.map(p => path.join(root, p)).find(fs.existsSync);
  if (!draftPath) { console.error(`predraft-correction-gate: no ${stage} for ${date}`); return 2; }
  const draft = fs.readFileSync(draftPath, 'utf8');

  let all: Correction[] = [];
  for (const c of COMPONENTS) {
    const p = path.join(root, `daily-briefs/${date}-${c}.md`);
    if (fs.existsSync(p)) all = all.concat(extractCorrections(fs.readFileSync(p, 'utf8'), c));
  }
  const bad = violations(draft, all);
  console.log(`predraft-correction-gate ${date} — ${path.basename(draftPath)} · ${all.length} recorded correction(s) across pre-drafts`);
  for (const v of bad) {
    console.error(`  ✗ 🔴 correction-reverted [${v.component}]: the draft still contains "${v.wrong}", which the pre-draft's own fact-check superseded with "${v.right}". Use the corrected text.`);
  }
  if (bad.length) { console.error(`\n✗ ${bad.length} SUPERSEDED value(s) survived into ${stage}. Replace with the pre-draft's corrected text.`); return 1; }
  console.log('  ✓ no superseded pre-draft values in the draft.');
  return 0;
}

function selftest(): number {
  let ok = 0, fail = 0;
  const t = (n: string, c: boolean) => { c ? ok++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };
  const real = `  CORRECTED IN DRAFT after the check —
  - "roughly 46% below its 2025 high" was WRONG and load-bearing. CSU.TO closed C$3,020.30. FIXED to "about 40%."
  - "in February" -> "in early 2026" (sources split)`;
  const cs = extractCorrections(real, 'take-draft');
  t('extracts the real 08-01 FIXED-to pair', cs.some(c => c.wrong.includes('46%') && c.right.includes('40%')));
  t('extracts the real 08-01 arrow pair', cs.some(c => c.wrong === 'in February' && c.right === 'in early 2026'));
  t('FIRES on the pre-correction figure (the real 08-01 v1 bug)',
    violations('trades roughly 46% below its 2025 high after a drawdown', cs).length === 1);
  t('SILENT on the corrected figure (the real 08-01 published text)',
    violations('trades about 40% below its 2025 high after a drawdown near 56% in early 2026', cs).length === 0);
  t('SILENT when no corrections are recorded', violations('any text at all', extractCorrections('no fact-check here')).length === 0);
  t('ignores trivially short strings', extractCorrections('"a" FIXED to "b"').length === 0);
  t('does not double-count a repeated correction', extractCorrections(real + '\n' + real).length === cs.length);
  console.log(`\npredraft-correction-gate selftest — ${ok} passed · ${fail} failed`);
  return fail ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) { console.error('usage: predraft-correction-gate.ts <YYYY-MM-DD> [--stage v1|v1.5|v2] | --selftest'); return 2; }
  const si = args.indexOf('--stage');
  return runOnDate(date, si !== -1 ? args[si + 1]! : 'v1');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
