#!/usr/bin/env node --experimental-strip-types
/**
 * assembly-gate.ts — the ASSEMBLY gate. Does the brief assemble into one thesis,
 * or ship as disconnected sections?
 *
 * The 73-day "Must-Read" drought has one named cause (per the Quality Tracker /
 * E-CONVERGENCE-ASSEMBLY-01): the brief NAMES a cross-section throughline in the
 * Intro ("the thread under the day is which of these changes are one-way doors…")
 * but never THREADS it through the section bodies. The Intro opens a door the
 * sections never walk through, so the reader does the assembly and the brief
 * reads as a portfolio of good articles instead of one thesis.
 *
 * This gate checks the one MECHANICAL precondition that keeps failing: a
 * throughline named up top must actually recur in the section bodies. It does
 * NOT judge whether the throughline is good — that's the Critic's job. It only
 * enforces "named => threaded", which is exactly the precondition that has been
 * left to prose/judgment for 73 days and never bound.
 *
 *   - Primary (deterministic): the Writer emits a marker the Architect designed —
 *       <!-- throughline: "one-way door" | sections: M&M, C&C, AI&T -->
 *       or <!-- throughline: NONE -->  (an honest parallel-tracks day).
 *     The gate confirms the keyword recurs in >= MIN_SECTIONS section bodies.
 *   - Fallback (heuristic): no marker but the Intro clearly CLAIMS a thread
 *       (connective language: "one-way door", "ratchet", "the same pattern",
 *       "what connects", "the thread under"…). If a claimed thread phrase does
 *       not recur in the bodies, that's "named not cashed out".
 *
 * Severity: advisory FLAG by default (validate-brief spawns it non-failing, and
 * the Editor + Critic are required to act on it); pass --strict to make
 * "named not threaded" exit non-zero.
 *
 * Usage:
 *   node --experimental-strip-types scripts/assembly-gate.ts <brief.md> [--strict] [--min N]
 *
 * Exit codes: 0 pass/flags-only · 1 named-not-threaded (only with --strict) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_MIN_SECTIONS = 2; // a throughline must thread >= this many section bodies

// Connective / pattern language that signals the Intro is CLAIMING a cross-section thread.
const THREAD_SIGNALS = [
  'the thread under', 'the thread of', 'the thread here', 'the thread today',
  'what connects', 'the common thread', 'the through-?line', 'throughline',
  'the same (?:pattern|mechanism|dynamic|force|logic|story)', 'the link (?:across|between)',
  'all (?:three|four|of these|of them)', 'tie(?:s|d)? together', 'one and the same',
  'one-way door', '\\bratchet', 'flywheel', 'feedback loop', 'crowding out',
  'second-order', 'the wedge', 'the same wedge', 'the throughline',
];
// Abstract pattern phrases worth threading (distinct from the concrete TOPIC nouns,
// which naturally appear in their own sections and must NOT count as "threading").
const PATTERN_LEXICON = [
  'one-way door', 'ratchet', 'flywheel', 'feedback loop', 'domino', 'cascade',
  'crowding out', 'second-order', 'wedge', 'spiral', 'doom loop', 'reflexive',
  'lock-in', 'captured', 'capture', 'displacement', 'speciation', 'bifurcation',
];

function stripComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

// The Intro is everything before the first major section marker (Dashboard/Six).
function introOf(body: string): string {
  const m = body.search(/^#\s*▸/m);
  return m === -1 ? body.slice(0, 1200) : body.slice(0, m);
}

// Section bodies = everything after THE SIX begins, minus the Dashboard block,
// split into chunks by headings. Returns one string per section chunk.
function sectionChunks(body: string): string[] {
  let start = body.search(/^#\s*▸\s*THE SIX/im);
  if (start === -1) start = body.search(/^#\s*▸/m); // fallback: first marker
  if (start === -1) return [];
  const after = stripComments(body.slice(start));
  // Drop a Dashboard block if it appears here (prices, not analysis).
  const chunks = after.split(/^#{1,3}\s+/m).map((c) => c.trim()).filter(Boolean);
  return chunks.filter((c) => !/^(▸\s*)?(THE\s+)?DASHBOARD\b/i.test(c) && !/^(Equities|Crypto|Commodities)\b/i.test(c));
}

// Count how many section chunks contain the keyword (plural-tolerant, word-ish).
function threadCount(chunks: string[], keyword: string): number {
  const k = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!k) return 0;
  const re = new RegExp(`\\b${k}s?\\b`, 'i');
  return chunks.filter((c) => re.test(c)).length;
}

interface Result { findings: { severity: 'FAIL' | 'FLAG'; message: string }[]; }

function main() {
  const args = process.argv.slice(2);
  const briefArg = args.find((a) => !a.startsWith('--'));
  const strict = args.includes('--strict');
  const minSections = args.includes('--min') ? (parseInt(args[args.indexOf('--min') + 1], 10) || DEFAULT_MIN_SECTIONS) : DEFAULT_MIN_SECTIONS;
  if (!briefArg) { console.error('Usage: assembly-gate.ts <brief.md> [--strict] [--min N]'); process.exit(2); }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) { console.error(`File not found: ${briefPath}`); process.exit(2); }
  const raw = fs.readFileSync(briefPath, 'utf8');
  const intro = introOf(raw);
  const chunks = sectionChunks(raw);

  const findings: Result['findings'] = [];
  let mode = '';
  let keyword: string | null = null;
  let declaredNone = false;
  let declaredSections: string[] = [];

  // 1. Marker (deterministic).
  const marker = raw.match(/<!--\s*throughline:\s*"?([^"|>]+?)"?\s*(?:\|\s*sections:\s*([^>]+?)\s*)?-->/i);
  if (marker) {
    const val = marker[1].trim();
    if (/^none$/i.test(val)) {
      declaredNone = true;
      mode = 'marker:NONE';
    } else {
      keyword = val;
      mode = 'marker';
      declaredSections = (marker[2] || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  // 2. Heuristic fallback when no marker: is a thread CLAIMED in the Intro?
  // Strip comments first so the marker's own "throughline" text can't self-trigger.
  const introLc = stripComments(intro).toLowerCase();
  const claimsThread = THREAD_SIGNALS.some((s) => new RegExp(s, 'i').test(introLc));
  if (!marker && claimsThread) {
    mode = 'heuristic';
    // The pattern phrase to thread = an abstract pattern term present in the Intro
    // (NOT the concrete topic nouns, which trivially appear in their own sections).
    keyword = PATTERN_LEXICON.find((p) => introLc.includes(p)) ?? null;
  }

  const need = Math.max(minSections, declaredSections.length ? Math.min(declaredSections.length, 3) : 0);

  if (declaredNone) {
    // Honest parallel-tracks day is fine — unless the Intro nonetheless claims a thread.
    if (claimsThread) {
      findings.push({ severity: 'FLAG', message: `throughline marked NONE, but the Intro still reads like it claims a cross-section thread. Either thread it and name it, or remove the thread language from the Intro so the brief doesn't promise assembly it doesn't deliver.` });
    }
  } else if (keyword) {
    const n = threadCount(chunks, keyword);
    if (n < need) {
      findings.push({
        severity: 'FAIL',
        message: `Throughline "${keyword}" is named in the Intro but threaded in only ${n}/${need}+ section bodies — NAMED, NOT CASHED OUT (the Must-Read killer). The Intro promises one thesis; the sections deliver disconnected stories. Thread the pattern explicitly through ${need}+ sections (one sentence each connecting the section back to "${keyword}"), or drop the thread from the Intro and let the sections stand independent. Do not fake it.`,
      });
    }
  } else if (marker && !keyword && !declaredNone) {
    findings.push({ severity: 'FLAG', message: `throughline marker present but unparseable — use: <!-- throughline: "keyword" | sections: A, B, C --> or <!-- throughline: NONE -->.` });
  } else if (!marker && !claimsThread) {
    findings.push({ severity: 'FLAG', message: `No cross-section throughline found (no marker, no thread language in the Intro). Is this a genuine parallel-tracks day, or a missed chance to assemble the strongest sections into one thesis? The Architect should design a throughline or emit <!-- throughline: NONE -->.` });
  }

  console.log(`assembly-gate — ${path.basename(briefPath)}`);
  console.log(`  mode: ${mode || 'none'} · throughline: ${declaredNone ? 'NONE' : keyword ? `"${keyword}"` : '(none detected)'} · section chunks: ${chunks.length}${keyword ? ` · threaded in ${threadCount(chunks, keyword)}` : ''}`);

  const fails = findings.filter((f) => f.severity === 'FAIL');
  const flags = findings.filter((f) => f.severity === 'FLAG');
  if (flags.length) { console.log(`\n  ${flags.length} FLAG (review):`); for (const f of flags) console.log(`   ⚠ ${f.message}`); }
  if (fails.length) { console.log(`\n  ${fails.length} ASSEMBLY finding(s):`); for (const f of fails) console.log(`   ✗ ${f.message}`); }

  if (fails.length === 0) { console.log(`\n✅ ASSEMBLY-GATE PASS${flags.length ? ' (flags advisory)' : ''}`); process.exit(0); }
  if (strict) { console.log(`\n❌ ASSEMBLY-GATE FAIL (strict) — named not cashed out.`); process.exit(1); }
  console.log(`\n✅ ASSEMBLY-GATE PASS (assembly findings are advisory; Editor + Critic must resolve them; run --strict to enforce)`);
  process.exit(0);
}

main();
