#!/usr/bin/env node --experimental-strip-types
/**
 * wildcard-count-gate.ts — THE WILD CARD MUST SHIP ITS ITEMS, NOT HALF OF THEM.
 * (IMP-076, 2026-07-20. Closes E-WILDCARD-UNDERCOUNT-01 / 07-20 Critic mandate #2.)
 *
 * WORKED FAILURE. The 2026-07-20 brief shipped a Wild Card with **2 items** (Penrose-process
 * energy extraction + ceramic heat routing). The generator spec (system/Wild_Card_Generator.md)
 * requires **4** genuinely novel, cross-domain items and its own Four-Test Gate says "Four items
 * must span four distinct domains." The Critic: "Wild Card must ship 4 items (3 minimum) — 2 of 4
 * is a structural shortfall." The section was 50% empty and NOTHING gated it: validate-brief's
 * Check 16a tests Wild Card STALENESS (repeats) but never COUNT, so an undercount shipped clean.
 *
 * THE CHECK. Count the items in the Wild Card section (the paragraph/`**bold**`-led blocks between
 * `## The Wild Card` and `## The Signal`). This is a FLOOR, not a proxy: the standard IS "ship the
 * items", so a count is the direct measure, not a countable stand-in for a semantic thing (it
 * cannot be gamed the way "4 cloud providers" gamed number-presence — Root-Cause Pattern 8).
 *   count >= 4  -> PASS (target met)
 *   count == 3  -> PASS + advisory (at the floor, below target — log the reason for <4)
 *   count <  3  -> FAIL (structural shortfall; backfill or the QG restores from the generator)
 *
 * Items are counted as blocks separated by blank lines, excluding the heading, sub-headings,
 * horizontal rules, and HTML comments — robust to both bold-led items and plain-paragraph items
 * (the 07-20 Wild Card used plain paragraphs, so a `**bold**`-lead counter would have read ZERO).
 *
 * Usage: node --experimental-strip-types scripts/wildcard-count-gate.ts <brief.md> [--min N] [--target N]
 *        node --experimental-strip-types scripts/wildcard-count-gate.ts --selftest
 * Exit: 0 count >= floor · 1 count < floor (or usage error on a real run with no file)
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_FLOOR = 3;   // hard minimum — below this FAILS
const DEFAULT_TARGET = 4;  // the generator's spec — below this is an advisory

function stripComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

/** Count Wild Card items = non-empty, non-heading, non-rule blocks between the two section headers. */
export function countWildCardItems(body: string): number | null {
  const clean = stripComments(body);
  const start = clean.indexOf('## The Wild Card');
  if (start === -1) return null;
  const end = clean.indexOf('## The Signal', start);
  let section = clean.slice(start, end === -1 ? undefined : end);
  // Drop the section heading line itself.
  section = section.replace(/^##\s+The Wild Card.*(\n|$)/, '');
  const blocks = section.split(/\n\s*\n/);
  let count = 0;
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;                 // blank
    if (/^#{1,6}\s/.test(b)) continue; // a sub-heading, not an item
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(b)) continue; // horizontal rule
    // A block with at least one word of prose is an item.
    if (/[A-Za-z]{3,}/.test(b)) count++;
  }
  return count;
}

interface Result { count: number | null; floor: number; target: number; status: 'PASS' | 'ADVISORY' | 'FAIL' | 'NO-SECTION'; message: string; }

export function evaluate(body: string, floor = DEFAULT_FLOOR, target = DEFAULT_TARGET): Result {
  const count = countWildCardItems(body);
  if (count === null) {
    return { count, floor, target, status: 'NO-SECTION', message: 'No "## The Wild Card" section found — cannot count. (If the brief has no Wild Card by design, this gate does not apply.)' };
  }
  if (count < floor) {
    return { count, floor, target, status: 'FAIL', message: `WILD CARD UNDERCOUNT — ${count} item${count === 1 ? '' : 's'} present, floor is ${floor} (target ${target}). A half-empty Wild Card is a structural shortfall (07-20: 2 of 4). Backfill from system/Wild_Card_Generator.md (four distinct domains, Four-Test Gate) or the QG must restore the missing items before publish.` };
  }
  if (count < target) {
    return { count, floor, target, status: 'ADVISORY', message: `WILD CARD AT FLOOR — ${count} items (target ${target}). Acceptable minimum, but below spec: log why the 4th item was cut.` };
  }
  return { count, floor, target, status: 'PASS', message: `Wild Card carries ${count} items (target ${target}).` };
}

function selftest(): number {
  const root = process.cwd();
  const four = `## The Wild Card\n\nAlpha discovery paragraph about corals reversing bleaching.\n\nBeta paragraph about a Bronze Age shipwreck lexicon.\n\nGamma paragraph about a muon-collider feasibility milestone.\n\nDelta paragraph about deep-sea mining permits.\n\n## The Signal\n`;
  const three = `## The Wild Card\n\nAlpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n\n## The Signal\n`;
  const two = `## The Wild Card\n\nResearchers recreated the Penrose process at lab scale.\n\nResearchers made ceramics route heat like current.\n\n## The Signal\n`;
  const bolded = `## The Wild Card\n\n**Coral reversal.** A discovery paragraph.\n\n**Shipwreck lexicon.** Another.\n\n**Muon collider.** A third.\n\n**Deep-sea permit.** A fourth.\n\n## The Signal\n`;
  const commented = `## The Wild Card\n\n<!-- editor note: consider swapping item 2 -->\n\nOnly one real item paragraph here.\n\n## The Signal\n`;

  const okFourPass = evaluate(four).status === 'PASS' && countWildCardItems(four) === 4;
  const okThreeAdvisory = evaluate(three).status === 'ADVISORY' && countWildCardItems(three) === 3;
  const okTwoFail = evaluate(two).status === 'FAIL' && countWildCardItems(two) === 2;
  const okBoldedFour = countWildCardItems(bolded) === 4; // bold-led items counted too
  const okCommentIgnored = countWildCardItems(commented) === 1; // HTML comment is not an item -> FAIL
  const okNoSection = evaluate('# No wild card here\n').status === 'NO-SECTION';

  // THE REAL 07-20 ARTIFACT: the brief that shipped 2 of 4 must FAIL.
  const realV2 = path.join(root, 'daily-briefs/2026-07-20-v2.md');
  let okReal2026 = true;
  if (fs.existsSync(realV2)) {
    const r = evaluate(fs.readFileSync(realV2, 'utf8'));
    okReal2026 = r.status === 'FAIL' && r.count === 2;
  }
  // The PUBLISHED 07-20 (morning may have backfilled or not) must at least parse to a count.
  const realPub = path.join(root, 'content/daily-updates/2026-07-20.md');
  let okRealPubParses = true;
  if (fs.existsSync(realPub)) okRealPubParses = countWildCardItems(fs.readFileSync(realPub, 'utf8')) !== null;

  console.log('wildcard-count-gate --selftest');
  console.log(`  4 items -> PASS: ${okFourPass ? '✓' : '✗'}`);
  console.log(`  3 items -> ADVISORY (floor, below target): ${okThreeAdvisory ? '✓' : '✗'}`);
  console.log(`  2 items -> FAIL (structural shortfall): ${okTwoFail ? '✓' : '✗'}`);
  console.log(`  bold-led items are counted (not just plain paragraphs): ${okBoldedFour ? '✓' : '✗'}`);
  console.log(`  HTML comments are not items: ${okCommentIgnored ? '✓' : '✗'}`);
  console.log(`  absent section -> NO-SECTION (never a silent pass): ${okNoSection ? '✓' : '✗'}`);
  console.log(`  FIRES on the real 07-20 v2 (2 of 4): ${okReal2026 ? '✓' : '✗'}`);
  console.log(`  the real published 07-20 parses to a count: ${okRealPubParses ? '✓' : '✗'}`);

  const ok = okFourPass && okThreeAdvisory && okTwoFail && okBoldedFour && okCommentIgnored && okNoSection && okReal2026 && okRealPubParses;
  if (ok) { console.log('\n✅ SELFTEST PASS — a half-empty Wild Card now FAILs instead of shipping 50% short.'); return 0; }
  console.error('\n❌ SELFTEST FAIL'); return 1;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('usage: wildcard-count-gate.ts <brief.md> [--min N] [--target N] | --selftest'); return 2; }
  const floorIdx = args.indexOf('--min');
  const targetIdx = args.indexOf('--target');
  const floor = floorIdx > -1 ? parseInt(args[floorIdx + 1]!, 10) : DEFAULT_FLOOR;
  const target = targetIdx > -1 ? parseInt(args[targetIdx + 1]!, 10) : DEFAULT_TARGET;
  if (!fs.existsSync(file)) { console.error(`FAIL: file not found: ${file}`); return 2; }
  const r = evaluate(fs.readFileSync(file, 'utf8'), floor, target);
  console.log(`wildcard-count-gate — ${path.basename(file)}: ${r.count ?? 'no section'} item(s) [${r.status}]`);
  console.log(`  ${r.message}`);
  return r.status === 'FAIL' ? 1 : 0;
}

process.exit(main());
