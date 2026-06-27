#!/usr/bin/env node --experimental-strip-types
/**
 * brief-light-craft-gate.ts — MECHANICAL CRAFT + PROVENANCE failsafe for the Super Brief.
 *
 * The format gate proves the file parses. This gate proves it meets the
 * deterministic craft constraints in system/Brief_Light_Generator.md and, when
 * given the full brief, that it introduces NO NEW ATOMS (every load-bearing
 * number traces to the full brief). The judgment checks — the three Craft
 * Standard tests, breadth, the story-thesis lede — live in
 * system/Brief_Light_Critic.md and are run by the brief-light task; this gate
 * is the mechanical safety net underneath that, mirroring the full brief's
 * scripts/validate-brief.ts.
 *
 * Usage:
 *   node --experimental-strip-types scripts/brief-light-craft-gate.ts <light.md> [full-brief.md]
 * Exit: 0 pass (may warn) · 1 violation (blocks ship) · 2 usage error
 */
import * as fs from 'fs';

const BANNED = ['buckle up', "let's talk about", 'let us talk about', "here's where it gets interesting", 'dive in', 'in this piece', 'we unpack'];
const SUPERLATIVE = /\b(record (?:high|low)|all-time (?:high|low)|new (?:high|low)|biggest ever|largest ever|first ever|highest ever)\b/gi;

function sentenceCount(s: string): number {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  return (t.match(/[.!?](?:\s|$)/g) || []).length;
}
function sectionBody(lines: string[], headerRe: RegExp): string {
  const start = lines.findIndex(l => headerRe.test(l));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^##\s*▸/.test(lines[i]!)) { end = i; break; } }
  return lines.slice(start + 1, end).join('\n');
}

function main(): number {
  const file = process.argv[2];
  const fullFile = process.argv[3];
  if (!file) { console.error('usage: brief-light-craft-gate.ts <light.md> [full-brief.md]'); return 2; }
  if (!fs.existsSync(file)) { console.error(`FAIL: file not found: ${file}`); return 2; }
  const md = fs.readFileSync(file, 'utf-8');
  const lines = md.split('\n');
  const fails: string[] = [];
  const warns: string[] = [];

  // 1. Em-dashes — zero tolerance.
  const em = (md.match(/—/g) || []).length;
  if (em > 0) fails.push(`${em} em-dash(es) found. Zero tolerance; replace with commas or periods.`);

  // 2. Word budget.
  const words = (md.match(/\S+/g) || []).length;
  if (words < 1500 || words > 2400) fails.push(`Total words ${words} outside hard bounds 1,500-2,400.`);
  else if (words < 1700 || words > 2200) warns.push(`Total words ${words} outside target 1,700-2,200.`);

  // 3. THE UPDATE story count (selection format).
  const updateBody = sectionBody(lines, /^##\s*▸\s*THE UPDATE/i);
  if (updateBody) {
    const stories = updateBody.split('\n').filter(l => /^\*\*[^*].*[^*]\*\*\s*$/.test(l.trim())).length;
    if (stories < 4 || stories > 8) fails.push(`THE UPDATE has ${stories} stories; selection format needs 5-7 (hard bounds 4-8).`);
    else if (stories < 5 || stories > 7) warns.push(`THE UPDATE has ${stories} stories (target 5-7).`);
  }

  // 4. Markets Minute — exactly 4 sentences.
  const mmBody = sectionBody(lines, /^##\s*▸\s*MARKETS MINUTE/i);
  if (mmBody) {
    const sc = sentenceCount(mmBody);
    if (sc !== 4) warns.push(`Markets Minute has ${sc} sentences (spec: exactly 4).`);
  }

  // 5. Banned filler.
  const lower = md.toLowerCase();
  for (const b of BANNED) if (lower.includes(b)) fails.push(`Banned filler phrase: "${b}".`);

  // 6. Superlatives — warn (the critic verifies provenance against the full brief).
  const sup = md.match(SUPERLATIVE);
  if (sup) warns.push(`Superlative(s) present (${[...new Set(sup.map(s => s.toLowerCase()))].join(', ')}); confirm each is verified in the full brief — no false superlatives.`);

  // 7. Landing — each ## ▸ section ends on terminal punctuation.
  const secHeaders = lines.map((l, i) => ({ l, i })).filter(x => /^##\s*▸/.test(x.l));
  for (let s = 0; s < secHeaders.length; s++) {
    const start = secHeaders[s]!.i;
    const end = s + 1 < secHeaders.length ? secHeaders[s + 1]!.i : lines.length;
    const body = lines.slice(start + 1, end).map(l => l.trim()).filter(l => l.length > 0 && !/^[-*_]{3,}$/.test(l));
    const last = body[body.length - 1] || '';
    if (last && !/[.!?)\]"”]$/.test(last)) warns.push(`Section "${secHeaders[s]!.l.trim()}" may end mid-thought: "...${last.slice(-40)}".`);
  }

  // 8. NO NEW ATOMS — number provenance vs the full brief.
  if (fullFile && fs.existsSync(fullFile)) {
    const norm = (s: string) => s.replace(/[,$]/g, '').replace(/\bpercent\b/gi, '%').toLowerCase();
    const fullN = norm(fs.readFileSync(fullFile, 'utf-8'));
    const body = md.replace(/\[[^\]]*\]\([^)]+\)/g, ' '); // drop links (slugs/urls)
    const nums = body.match(/\$?\d[\d,]*(?:\.\d+)?\s?(?:percent|%|million|billion|trillion|gigawatt|gw)?/gi) || [];
    const orphans: string[] = [];
    for (const raw of nums) {
      const core = raw.replace(/[,$]/g, '').replace(/\s?(?:percent|%|million|billion|trillion|gigawatt|gw)/i, '').trim();
      const n = parseFloat(core);
      if (isNaN(n)) continue;
      if (Number.isInteger(n) && n >= 1900 && n <= 2099) continue;   // years
      if (Number.isInteger(n) && core.replace('.', '').length <= 2) continue; // small counts / ordinals
      if (!fullN.includes(core.toLowerCase())) orphans.push(raw.trim());
    }
    if (orphans.length) warns.push(`Numbers not found in the full brief (verify NO NEW ATOMS): ${[...new Set(orphans)].slice(0, 12).join(' · ')}`);
  } else {
    warns.push('Full brief not provided; skipped NO-NEW-ATOMS number-provenance check. Pass the full brief path as arg 2.');
  }

  const name = file.split('/').pop();
  if (fails.length) {
    console.error(`\n✗ CRAFT GATE FAILED — ${name}  (${words} words)\n`);
    for (const f of fails) console.error(`  ✗ ${f}`);
    if (warns.length) { console.error('\n  warnings:'); for (const w of warns) console.error(`  ⚠ ${w}`); }
    console.error('\n  Fix the blocking items, then re-run. Judgment checks: run system/Brief_Light_Critic.md.\n');
    return 1;
  }
  console.log(`\n✓ CRAFT GATE PASSED — ${name}  (${words} words, 0 em-dashes)`);
  if (warns.length) { console.log('  warnings (non-blocking):'); for (const w of warns) console.log(`  ⚠ ${w}`); }
  console.log('  Next: run the judgment pass in system/Brief_Light_Critic.md (three tests, breadth, no-new-atoms).');
  console.log('');
  return 0;
}
process.exit(main());
