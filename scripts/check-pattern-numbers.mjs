#!/usr/bin/env node
/**
 * check-pattern-numbers.mjs — Emerging Pattern ID collision gate.
 *
 * WHY THIS EXISTS (2026-07-12, Sweep 3):
 * Sweeps 1 and 2 on July 12 assigned new Emerging Patterns the numbers
 * #267, #268, #270, #271, #272 — without reading the World Briefing Book's
 * live ledger, which already ran to #284. Four of those numbers were already
 * taken by ACTIVE patterns:
 *   #268 = "Frontier-Moat Distillation Arbitrage" (Jun 27)
 *   #270 = "Overt Misalignment as a Detectability Canary" (Jun 28)
 *   #271 = "King Dollar Breaks the Periphery" (Jun 28) <-- flagged for Worldview review
 *   #272 = "The Stagflation Cell" (Jun 28)
 * Had Sweep 6 consolidated the day's patterns into the Briefing Book as numbered,
 * it would have overwritten or silently duplicated four live macro signals.
 *
 * The rule "number new patterns from the Briefing Book's current max" existed only
 * in prose, so it was unenforced, so it drifted. This is the mechanical check.
 *
 * USAGE:
 *   node scripts/check-pattern-numbers.mjs                  # checks today's intel file
 *   node scripts/check-pattern-numbers.mjs 2026-07-12       # checks a specific date
 *
 * EXIT CODES: 0 = no collisions. 1 = collision(s) found.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WBB = resolve(ROOT, 'system/World_Briefing_Book.md');

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const INTEL = resolve(ROOT, `daily-intelligence/${date}-intelligence.md`);

/** Normalize a pattern label so cosmetic differences don't read as different patterns. */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/\(new[^)]*\)/g, '') // drop the "(NEW July 12, 2026 — Sweep 4)" stamp
    .replace(/\[[^\]]*\]/g, '') // drop "[META — watch]" tags
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Pattern IDs the Briefing Book has *declared* (ledger entries), not merely cross-referenced.
 * Returns id -> label, because the ID alone cannot distinguish a FOREIGN collision from this
 * sweep's OWN correctly-consolidated entry. (See IDEMPOTENCY note below.)
 */
function declaredInWBB(text) {
  const found = new Map();
  // Ledger declarations look like:  - **#271 "King Dollar..."   or   **#284. The One-System Loop...
  for (const m of text.matchAll(
    /^\s*(?:-\s*)?\*\*#(\d{3})\.?\s*(.{0,200}?)\s*(?:\(|\*\*|$)/gm
  )) {
    const id = Number(m[1]);
    // First declaration wins: the original ledger entry, not a later restatement.
    if (!found.has(id)) found.set(id, (m[2] ?? '').trim());
  }
  return found;
}

/** Pattern IDs a sweep file declares as NEW. */
function declaredNewInIntel(text) {
  const found = new Map(); // id -> label
  // Sweep files declare new patterns as:  **270. Europe's China Shock ... (NEW July 12 ...)
  //                                  or:  **#291. The Chokepoint ...    (NEW July 12 ...)
  // NB 1: the '#' is OPTIONAL. Sweeps 1-2 wrote "**270."; Sweep 3 wrote "**#291.". A regex that
  //       matched only one form would let the other bypass the gate entirely — the same
  //       one-layer-drifted failure this gate exists to prevent.
  // NB 2: label bound must be generous — a tight bound (80) silently MISSED #270 on 2026-07-12
  //       because its title ran long. A gate that misses a real collision is a defeated gate.
  for (const m of text.matchAll(
    /^\*\*#?(\d{3})\.\s*(.{0,200}?)\s*(?:\(|\*\*)/gm
  )) {
    const id = Number(m[1]);
    const label = m[2].trim();
    // Only count it as a NEW declaration if the line advertises itself as new.
    const line = text.slice(m.index, text.indexOf('\n', m.index));
    if (/\bNEW\b/i.test(line)) found.set(id, label);
  }
  return found;
}

if (!existsSync(WBB)) {
  console.error(`FAIL: World Briefing Book not found at ${WBB}`);
  process.exit(1);
}
if (!existsSync(INTEL)) {
  console.log(`SKIP: no intelligence file for ${date} — nothing to check.`);
  process.exit(0);
}

const wbbIds = declaredInWBB(readFileSync(WBB, 'utf8'));
const newIds = declaredNewInIntel(readFileSync(INTEL, 'utf8'));
const maxWbb = wbbIds.size ? Math.max(...wbbIds.keys()) : 0;

// IDEMPOTENCY (added 2026-07-12, Sweep 4 — the gate's own worked failure).
// The original gate compared IDs only. That made it a strictly PRE-consolidation check: the
// moment a sweep was correctly written into the Briefing Book, the gate saw its own entries
// and reported them as collisions — advising a renumber that would, on the next run, collide
// again. An infinite renumber loop, and following its advice would have CORRUPTED the ledger.
// A gate that fails on correct input is not a gate; it is a trap.
// Fix: an ID present in the WBB under the SAME label is this sweep's own consolidated entry
// (silent). An ID present under a DIFFERENT label is a genuine collision (bites). The gate is
// now safe to run before AND after consolidation, which is what pipeline-health-check does.
const collisions = [...newIds].filter(([id, label]) => {
  if (!wbbIds.has(id)) return false;
  const wbbLabel = norm(wbbIds.get(id) ?? '');
  const newLabel = norm(label);
  if (!wbbLabel || !newLabel) return true; // can't prove it's ours -> fail closed
  // Same pattern, already consolidated -> not a collision.
  return !(wbbLabel.startsWith(newLabel) || newLabel.startsWith(wbbLabel));
});

const consolidated =
  [...newIds].filter(([id]) => wbbIds.has(id)).length - collisions.length;

console.log(`Emerging Pattern ID gate — ${date}`);
console.log(
  `  Briefing Book ledger: ${wbbIds.size} patterns, highest = #${maxWbb}`
);
console.log(
  `  Sweep file declares NEW: ${newIds.size ? [...newIds.keys()].map(i => `#${i}`).join(', ') : '(none)'}`
);
if (consolidated > 0) {
  console.log(
    `  Already consolidated into the WBB under the same label (OK): ${consolidated}`
  );
}

if (collisions.length) {
  console.error(
    `\n❌ COLLISION — ${collisions.length} new pattern ID(s) already exist in the Briefing Book:`
  );
  for (const [id, label] of collisions) {
    console.error(
      `   #${id} is already taken in the WBB. Sweep file reuses it for: "${label}"`
    );
  }
  let next = maxWbb + 1;
  console.error(
    `\n   FIX — renumber the day's new patterns starting at #${next}:`
  );
  for (const [id, label] of newIds)
    console.error(`     #${id} -> #${next++}  ("${label}")`);
  console.error(
    `\n   Do NOT consolidate this sweep into the Briefing Book until renumbered.`
  );
  process.exit(1);
}

console.log(`\n✅ No collisions. Next free pattern ID: #${maxWbb + 1}`);
process.exit(0);
