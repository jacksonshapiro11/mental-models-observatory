#!/usr/bin/env node --experimental-strip-types
/**
 * superlative-escalation-gate.ts — THE EDITOR MAY NOT MANUFACTURE A HISTORICAL SUPERLATIVE.
 *
 * THE FAILURE THIS EXISTS TO KILL (2026-07-24 Critic mandate #1, 🔴, RC2):
 *
 *   The Writer's v1.5 said weekly jobless claims were the "lowest of 2026" — a bounded,
 *   self-limiting, safe claim. The Editor, during its pass, UPGRADED it to "lowest since
 *   1969" in THREE places (intro, Dashboard, M&M-1) with no citation. 187,000 claims would
 *   be near or below the pre-pandemic record (~196K, April 2019); "since 1969" is an
 *   extraordinary historical assertion that was load-bearing for the brief's central
 *   rate-regime thesis. It reached v2 uncited and only the morning truth gate resolved it.
 *
 * WHY THE EXISTING SUPERLATIVE CHECK DOES NOT CATCH THIS:
 *   fact-gate's `superlative-archive` backstop disproves a superlative against OUR OWN
 *   archive — which reaches back only ~14 published briefs. A "since 1969" claim is
 *   BEYOND the archive's horizon, so the archive can neither confirm nor contradict it and
 *   the check passes. The gap is not "is it in our archive" but "did a downstream editor
 *   INTRODUCE an unbounded historical superlative that was not in the Writer's draft, with
 *   no source." That is a v1.5 → v2 DIFF, and nothing compared those two artifacts for
 *   superlative escalation.
 *
 * WHAT IT CHECKS (v1.5 → v2 diff):
 *   A TEMPORAL/HISTORICAL superlative present in v2 but ABSENT from v1.5 (an Editor
 *   introduction) that carries NO adjacent citation and is not resolved in truth.json → FAIL.
 *   The bounded kind the Writer used ("lowest of 2026", "this year") is deliberately NOT a
 *   temporal-historical superlative and never fires — only the unbounded "since <year>",
 *   "record/all-time low|high", "on record", "first … since <year>" class does.
 *
 * The Editor's two legal moves on a FAIL: (a) cite a primary source in the sentence, or
 * (b) revert to the Writer's bounded claim. Escalating an extreme is not an edit; it is a
 * new factual claim, and a new factual claim without a source is a fabrication risk.
 *
 *   node --experimental-strip-types scripts/superlative-escalation-gate.ts {BRIEF_DATE}
 *   node --experimental-strip-types scripts/superlative-escalation-gate.ts --selftest
 * Exit: 0 clean · 1 an uncited historical superlative was introduced in v2 · 2 usage/inputs.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface Finding {
  check: 'superlative-escalation';
  severity: '🔴';
  phrase: string;
  sentence: string;
}

// Unbounded HISTORICAL superlatives — the class our ~14-day archive cannot disprove.
const EXTREME =
  'record|lowest|highest|fewest|most|largest|smallest|strongest|weakest|worst|best|biggest|greatest|deepest|steepest|longest';
const TEMPORAL_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(?:${EXTREME})\\b[^.]{0,40}?\\bsince\\s+(?:1[89]|20)\\d\\d\\b`,
    'i'
  ),
  /\b(?:record|all-time)\s+(?:low|high|lowest|highest)\b/i,
  new RegExp(`\\b(?:${EXTREME})\\b[^.]{0,25}?\\bon record\\b`, 'i'),
  /\bfirst\s+(?:time\s+)?since\s+(?:1[89]|20)\d\d\b/i,
];

// A source token — NOT a bare year (the superlative's own "1969" is not its citation).
const CITATION =
  /\b(per|according to|BLS|BEA|the Fed|Federal Reserve|Treasury|Bloomberg|Reuters|WSJ|Financial Times|OECD|IMF|Census|data from|reported by|figures from|source:)\b|https?:\/\//i;

function sentences(body: string): string[] {
  // Strip HTML comments and markdown noise, then split on sentence boundaries.
  const clean = body.replace(/<!--[\s\S]*?-->/g, ' ').replace(/[*_#>`|]/g, ' ');
  return clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Every sentence carrying a temporal-historical superlative, with the matched phrase. */
export function temporalSuperlatives(
  body: string
): { phrase: string; sentence: string }[] {
  const out: { phrase: string; sentence: string }[] = [];
  for (const s of sentences(body)) {
    for (const re of TEMPORAL_PATTERNS) {
      const m = s.match(re);
      if (m) {
        out.push({
          phrase: m[0].toLowerCase().replace(/\s+/g, ' ').trim(),
          sentence: s,
        });
        break;
      }
    }
  }
  return out;
}

export function hasCitation(sentence: string): boolean {
  return CITATION.test(sentence);
}

function norm(p: string): string {
  return p.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * PURE — new temporal superlatives in v2 that were not in v1.5 and carry no citation.
 * `resolvedKeys` are normalized phrase substrings already resolved in truth.json (Editor
 * stage usually has none; the morning gate does).
 */
export function escalations(
  v15: string,
  v2: string,
  resolvedKeys: string[] = []
): Finding[] {
  const inV15 = new Set(temporalSuperlatives(v15).map(x => norm(x.phrase)));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const { phrase, sentence } of temporalSuperlatives(v2)) {
    const key = norm(phrase);
    if (inV15.has(key)) continue; // present in the Writer's draft — not an Editor introduction
    if (hasCitation(sentence)) continue; // the Editor cited a source — legal
    if (resolvedKeys.some(r => key.includes(r) || r.includes(key))) continue; // already resolved in truth.json
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      check: 'superlative-escalation',
      severity: '🔴',
      phrase,
      sentence: sentence.slice(0, 160),
    });
  }
  return out;
}

// ---- I/O + CLI ----

function loadResolvedKeys(root: string, date: string): string[] {
  const p = path.join(root, `daily-briefs/${date}-truth.json`);
  if (!fs.existsSync(p)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (
      JSON.stringify(j)
        .toLowerCase()
        .match(/(?:lowest|highest|record|all-time|since)[a-z0-9 ]{0,30}/g) ?? []
    );
  } catch {
    return [];
  }
}

function runOnDate(date: string, root = process.cwd()): number {
  const v15Path = path.join(root, `daily-briefs/${date}-v1.5.md`);
  const v2Path = path.join(root, `daily-briefs/${date}-v2.md`);
  if (!fs.existsSync(v2Path)) {
    console.error(`superlative-escalation-gate: no v2 for ${date}`);
    return 2;
  }
  // If v1.5 is missing (degraded pipeline), treat as empty baseline → any temporal superlative in v2 is "introduced".
  const v15 = fs.existsSync(v15Path) ? fs.readFileSync(v15Path, 'utf8') : '';
  const v2 = fs.readFileSync(v2Path, 'utf8');
  const findings = escalations(v15, v2, loadResolvedKeys(root, date));

  console.log(
    `superlative-escalation-gate ${date} — v1.5=${fs.existsSync(v15Path) ? 'present' : 'MISSING(empty baseline)'}`
  );
  for (const f of findings)
    console.error(
      `  ✗ ${f.severity} superlative-escalation: "${f.phrase}" introduced in v2, absent from v1.5, no citation. — "${f.sentence}"`
    );
  if (findings.length) {
    console.error(
      `\n✗ SUPERLATIVE ESCALATION — ${findings.length} uncited historical superlative(s) added after the Writer's draft. CITE a primary source in the sentence or REVERT to the Writer's bounded claim.`
    );
    return 1;
  }
  console.log(
    '  ✓ no uncited historical superlative introduced between v1.5 and v2.'
  );
  return 0;
}

function selftest(): number {
  let ok = 0,
    fail = 0;
  const t = (n: string, c: boolean) => {
    if (c) {
      ok++;
      console.log(`  ✓ ${n}`);
    } else {
      fail++;
      console.error(`  ✗ ${n}`);
    }
  };

  // The real 07-24 shape.
  const v15 =
    'Weekly jobless claims at 187,000 were the lowest of 2026, and the labor market stayed tight.';
  const v2_bad =
    'Weekly jobless claims at 187,000 were the lowest since 1969, and the labor market stayed tight.';
  const fire = escalations(v15, v2_bad);
  t(
    'FIRES on real 07-24 "lowest since 1969" introduced over v1.5 "lowest of 2026"',
    fire.length === 1 && fire[0]!.phrase.includes('since 1969')
  );

  // Bounded superlative is not a temporal-historical superlative — never fires.
  t(
    'SILENT when v2 keeps the bounded "lowest of 2026"',
    escalations(v15, v15).length === 0
  );
  t(
    'bounded "lowest of 2026" is not extracted as temporal',
    temporalSuperlatives(v15).length === 0
  );
  t(
    '"lowest since 1969" IS extracted as temporal',
    temporalSuperlatives(v2_bad).length === 1
  );

  // The Editor's legal move (a): cite a source → no fire.
  const v2_cited =
    'Weekly jobless claims at 187,000 were the lowest since 1969, per BLS.';
  t(
    'SILENT when the introduced superlative carries a citation (per BLS)',
    escalations(v15, v2_cited).length === 0
  );

  // Present in v1.5 already (Writer wrote it, cited or not) → not an Editor introduction.
  const v15_hist = 'Gold hit a record high this session.';
  const v2_hist = 'Gold hit a record high this session and equities slipped.';
  t(
    'SILENT when the historical superlative was already in v1.5',
    escalations(v15_hist, v2_hist).length === 0
  );

  // "record low" class fires when introduced uncited.
  t(
    'FIRES on introduced "record low" with no citation',
    escalations('Yields were elevated.', 'Yields hit a record low.').length ===
      1
  );

  // truth.json resolution suppresses.
  t(
    'SILENT when resolved in truth.json',
    escalations(v15, v2_bad, ['lowest since 1969']).length === 0
  );

  // No double-count of the same phrase across three placements.
  const v2_thrice =
    'Claims were the lowest since 1969. The lowest since 1969 print stunned desks. M&M: lowest since 1969.';
  t(
    'de-dupes the same phrase across 3 placements → 1 finding',
    escalations(v15, v2_thrice).length === 1
  );

  console.log(
    `\nsuperlative-escalation-gate selftest — ${ok} passed · ${fail} failed`
  );
  return fail ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error(
      'usage: superlative-escalation-gate.ts <YYYY-MM-DD> | --selftest'
    );
    return 2;
  }
  return runOnDate(date);
}

// Only auto-run when invoked directly (so the pure functions are importable for tests).
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(main());
}
