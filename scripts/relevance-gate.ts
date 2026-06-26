#!/usr/bin/env node --experimental-strip-types
/**
 * relevance-gate.ts — the RELEVANCE gate.
 *
 * Truth checks that claims are correct. Novelty checks that the Take is fresh.
 * Relevance checks the third failure: sections that float free of today's actual
 * events — the system narrating its own pet themes instead of what happened.
 *
 * Mechanism: every Six subsection lead and the Take must trace to today's
 * verified intelligence file. If a section's core entity/claim has no support in
 * daily-intelligence/{date}-intelligence.md, that section is either confabulated
 * or recycled from the worldview corpus rather than sourced from today. FLAG it.
 *
 * Relevance is a judgment call, so this gate FLAGS by default and only FAILS
 * with --strict (use --strict once thresholds are tuned on real briefs).
 *
 * Usage:
 *   node --experimental-strip-types scripts/relevance-gate.ts <brief.md> [--intel <file>] [--strict]
 *
 * Exit codes: 0 pass/flags-only · 1 fail (only with --strict) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const STOP = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'into', 'their', 'which',
  'about', 'these', 'those', 'would', 'could', 'should', 'after', 'before', 'than',
  'first', 'most', 'more', 'over', 'under', 'when', 'what', 'while', 'where', 'three',
  'simultaneously', 'losing', 'buyers', 'made', 'stable', 'market', 'markets', 'global',
  'billion', 'million', 'trillion', 'percent', 'world', 'years', 'every', 'because',
]);

function tokens(s: string): string[] {
  return [...new Set(
    s.toLowerCase().replace(/[^a-z0-9$%&. ]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 4 && !STOP.has(w))
  )];
}

function sliceBetween(body: string, a: string, b: string): string {
  const i = body.indexOf(a); if (i === -1) return '';
  const j = b ? body.indexOf(b, i + a.length) : -1;
  return body.slice(i, j === -1 ? undefined : j);
}

function main() {
  const args = process.argv.slice(2);
  const briefArg = args.find((a) => !a.startsWith('--'));
  const intelArg = args.includes('--intel') ? args[args.indexOf('--intel') + 1] : null;
  const strict = args.includes('--strict');
  if (!briefArg) { console.error('Usage: relevance-gate.ts <brief.md> [--intel <file>] [--strict]'); process.exit(2); }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) { console.error(`File not found: ${briefPath}`); process.exit(2); }
  const body = fs.readFileSync(briefPath, 'utf8');
  const dateMatch = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';

  // Today's intelligence file
  const intelCandidates = [
    intelArg,
    date ? path.join(path.dirname(briefPath), '..', '..', 'daily-intelligence', `${date}-intelligence.md`) : null,
    date ? path.join(process.cwd(), 'daily-intelligence', `${date}-intelligence.md`) : null,
  ].filter(Boolean) as string[];
  const intelPath = intelCandidates.find((p) => fs.existsSync(p));
  if (!intelPath) {
    console.log(`relevance-gate — no intelligence file found for ${date}. Cannot verify relevance.`);
    console.log(`  Looked for: daily-intelligence/${date}-intelligence.md`);
    console.log(strict ? '\n❌ RELEVANCE-GATE FAIL (strict): no intel to trace against.' : '\n⚠ RELEVANCE-GATE SKIPPED (no intel file).');
    process.exit(strict ? 1 : 0);
  }
  const intel = fs.readFileSync(intelPath, 'utf8').toLowerCase();

  // Each Six subsection lead + the Take title must trace to intel.
  const six = sliceBetween(body, '# ▸ THE SIX', '# ▸ THE TAKE');
  const targets: { section: string; lead: string }[] = [];
  let cur = '';
  for (const line of six.split('\n')) {
    const h = line.match(/^##\s+(.+)$/); if (h) { cur = h[1].trim(); continue; }
    const b = line.match(/^- \*\*(.+?)\*\*/); if (b && cur) targets.push({ section: cur, lead: b[1] });
  }
  const takeTitle = (sliceBetween(body, '# ▸ THE TAKE', '# ▸ INNER GAME').match(/^\s*##\s+(.+)$/m) ?? [])[1];
  if (takeTitle) targets.push({ section: 'The Take', lead: takeTitle });

  const flags: string[] = [];
  for (const t of targets) {
    const toks = tokens(t.lead);
    if (toks.length === 0) continue;
    const hits = toks.filter((w) => intel.includes(w));
    const ratio = hits.length / toks.length;
    if (hits.length < 2 || ratio < 0.25) {
      flags.push(`${t.section}: lead "${t.lead.slice(0, 70)}…" has weak support in today's intel (${hits.length}/${toks.length} key terms found). Verify it is sourced from today, not the worldview corpus.`);
    }
  }

  console.log(`relevance-gate — ${path.basename(briefPath)}`);
  console.log(`  intel: ${path.basename(intelPath)}`);
  console.log(`  sections traced: ${targets.length}`);
  if (flags.length === 0) { console.log(`\n✅ RELEVANCE-GATE PASS — every section traces to today's intel.`); process.exit(0); }
  console.log(`\n  ${flags.length} weak-relevance ${flags.length === 1 ? 'finding' : 'findings'}:`);
  for (const f of flags) console.log(`   ⚠ ${f}`);
  if (strict) { console.log(`\n❌ RELEVANCE-GATE FAIL (strict)`); process.exit(1); }
  console.log(`\n✅ RELEVANCE-GATE PASS (flags are advisory; run --strict to enforce)`);
  process.exit(0);
}

main();
