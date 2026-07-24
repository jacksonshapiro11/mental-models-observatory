#!/usr/bin/env node --experimental-strip-types
/**
 * append-geo-lead.ts — KEEP THE GEO-LEAD THEATER LOG LIVE (IMP-085, 2026-07-21).
 *
 * THE FAILURE THIS EXISTS TO KILL. The Geo-Lead Theater Log (system/Thesis_Tracker.md) is read by
 * the Quality Gate's ENTITY-PERSISTENCE CAP; a cap that reads a log nobody appends to cannot fire —
 * it re-reads the last recorded status forever and returns clean regardless of what the briefs do.
 * The log was found DEAD FOR 20 DAYS on 2026-07-17, then went 1 day stale again on 07-20 and again
 * on 07-21 — each recurrence BLOCKED `verify-improvements` via `gate-input-freshness.ts`. Three
 * staleness events tripped the pre-authorized escalation (Thesis_Tracker note): "escalate to a
 * publish-time appender (derive the lead theater from the Geo-1 bullet at brief-morning)."
 *
 * WHY THE GATE AUTHOR DELIBERATELY DID NOT AUTO-APPEND: "an auto-appender would guess which theater
 * led — a judgment." This appender answers that caution rather than ignoring it:
 *   - it derives the theater from a KEYWORD SCORE on the Geo-1 bullet (the section's LEAD only),
 *   - a bullet it cannot classify confidently (no match, or a tie) is appended as `NEEDS-REVIEW` —
 *     LOUD, never a silent guess,
 *   - every auto-row is marked `(auto)`, so the daily improvement session's Phase 6 ritual re-reads
 *     the published Geo-1 and corrects any mis-derivation within 24h.
 * The result: the log stays LIVE (no more staleness blocks) and a low-confidence classification is
 * surfaced, not buried. Staleness is a silent, compounding failure; a NEEDS-REVIEW row is a visible,
 * self-healing one.
 *
 * Usage:
 *   node --experimental-strip-types scripts/append-geo-lead.ts [YYYY-MM-DD]   (default: today)
 *   node --experimental-strip-types scripts/append-geo-lead.ts --selftest
 * Exit: 0 appended-or-idempotent-or-selftest-pass · 1 selftest fail · 2 usage/no-brief.
 * Wired into: Pipeline_Controller morning sequence (brief-morning) + Morning_Updater; registered as a
 * freshness input in gate-input-freshness.ts (unchanged — this appender is what keeps it green).
 */
import * as fs from 'fs';
import * as path from 'path';

const SECTION = '### Geo-Lead Theater Log';

// Canonical theater names MUST match the log's existing vocabulary so consecutive-day comparison works.
export const THEATERS: { name: string; kws: RegExp }[] = [
  { name: 'Iran/Middle East', kws: /\b(iran|iranian|tehran|irgc|hormuz|persian gulf|gulf state|gulf states|kuwait|bahrain|qatar|khamenei|revolutionary guard|chabahar|houthi|red sea)\b/gi },
  { name: 'Russia/Ukraine', kws: /\b(russia|russian|ukraine|ukrainian|kyiv|kiev|moscow|putin|kremlin|iskander|zircon|donbas|kharkiv|zelensky)\b/gi },
  { name: 'Korea', kws: /\b(north korea|pyongyang|kim jong|dprk|south korea|seoul|choe son hui)\b/gi },
  { name: 'Taiwan/China', kws: /\b(taiwan|taipei|taiwan strait|cross-strait)\b/gi },
  { name: 'China', kws: /\b(china|chinese|beijing|xi jinping|\bpla\b|south china sea)\b/gi },
  { name: 'Europe/NATO', kws: /\b(nato|brussels|european union|germany|france|britain|british|poland|baltic)\b/gi },
  { name: 'Japan/Asia', kws: /\b(japan|japanese|tokyo)\b/gi },
  { name: 'AI/Technology Policy', kws: /\b(executive order|white house|ai policy|chip export|semiconductor export|tech policy)\b/gi },
];

/** The Geo-1 bullet is the section LEAD: the first "- **…" bullet under "## Geopolitics". */
export function extractGeo1(briefMd: string): string {
  const lines = briefMd.split('\n');
  const i = lines.findIndex((l) => /^##\s+Geopolitics\b/i.test(l));
  if (i === -1) return '';
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (/^##\s/.test(l)) break;              // next section — no bullet found
    if (/^\s*-\s+\*\*/.test(l)) return l;     // first bold-led bullet = Geo-1
  }
  return '';
}

/** Keyword score → the single dominant theater, or NEEDS-REVIEW on no-match / a tie (conservative). */
export function classifyTheater(geo1: string): string {
  if (!geo1.trim()) return 'NEEDS-REVIEW';
  const scored = THEATERS.map((t) => ({ name: t.name, score: (geo1.match(t.kws) || []).length }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]!.score === 0) return 'NEEDS-REVIEW';
  if (scored[1] && scored[1].score === scored[0]!.score) return 'NEEDS-REVIEW'; // ambiguous lead
  return scored[0]!.name;
}

export interface LogRow { date: string; theater: string; count: string; }

export function parseLogRows(trackerMd: string): LogRow[] {
  const rows: LogRow[] = [];
  const lines = trackerMd.split('\n');
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith(SECTION)) { inSection = true; continue; }
    if (inSection && /^###\s/.test(line) && !line.startsWith(SECTION)) break;
    const m = inSection ? line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/) : null;
    if (m) rows.push({ date: m[1]!, theater: m[2]!.trim(), count: m[3]!.trim() });
  }
  return rows;
}

/** Consecutive-days count: increment if the immediately-prior row is the same theater, else 1. */
export function computeConsecutive(rows: LogRow[], theater: string): number {
  if (theater === 'NEEDS-REVIEW') return 0;
  const prior = rows[rows.length - 1];
  if (prior && prior.theater === theater) {
    const n = parseInt(prior.count.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n + 1 : 1;
  }
  return 1;
}

/** Insert a row after the last dated row of the log section. Idempotent on date. Returns new markdown or null (no-op). */
export function insertRow(trackerMd: string, date: string, theater: string, count: number, note: string): string | null {
  const rows = parseLogRows(trackerMd);
  if (rows.some((r) => r.date === date)) return null; // idempotent — already recorded
  const lines = trackerMd.split('\n');
  let inSection = false;
  let lastRowIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith(SECTION)) { inSection = true; continue; }
    if (inSection && /^###\s/.test(lines[i]!) && !lines[i]!.startsWith(SECTION)) break;
    if (inSection && /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(lines[i]!)) lastRowIdx = i;
  }
  if (lastRowIdx === -1) return null; // section/table not found — do not guess a location
  const countCell = theater === 'NEEDS-REVIEW' ? '—' : String(count);
  const row = `| ${date} | ${theater} | ${countCell} | ${note} |`;
  lines.splice(lastRowIdx + 1, 0, row);
  return lines.join('\n');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function run(date: string): number {
  const root = process.cwd();
  const briefPath = path.join(root, 'content', 'daily-updates', `${date}.md`);
  if (!fs.existsSync(briefPath)) { console.error(`No published brief for ${date} at ${briefPath}`); return 2; }
  const trackerPath = path.join(root, 'system', 'Thesis_Tracker.md');
  if (!fs.existsSync(trackerPath)) { console.error('Thesis_Tracker.md not found'); return 2; }

  const geo1 = extractGeo1(fs.readFileSync(briefPath, 'utf8'));
  const theater = classifyTheater(geo1);
  const tracker = fs.readFileSync(trackerPath, 'utf8');
  const rows = parseLogRows(tracker);
  const count = computeConsecutive(rows, theater);
  const snippet = geo1.replace(/^\s*-\s+\*\*/, '').replace(/\*\*/g, '').trim().slice(0, 90);
  const note = theater === 'NEEDS-REVIEW'
    ? `(auto) NEEDS-REVIEW — could not classify the Geo-1 lead; a human/improvement session must set the theater. Geo-1: "${snippet}…"`
    : `(auto) derived from Geo-1: "${snippet}…"`;

  const updated = insertRow(tracker, date, theater, count, note);
  if (updated === null) { console.log(`append-geo-lead — ${date} already recorded (or no log table); no-op.`); return 0; }
  fs.writeFileSync(trackerPath, updated);
  console.log(`append-geo-lead — appended ${date} | ${theater} | ${theater === 'NEEDS-REVIEW' ? '—' : count} (auto).`);
  return 0;
}

// ---------- selftest ----------
function selftest(): number {
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const assert = (name: string, pass: boolean, detail = '') => results.push({ name, pass, detail });
  const root = process.cwd();

  // classifyTheater — the REAL 07-21 Geo-1 (US airstrikes on Iran).
  const jul21 = path.join(root, 'content', 'daily-updates', '2026-07-21.md');
  if (fs.existsSync(jul21)) {
    const g = extractGeo1(fs.readFileSync(jul21, 'utf8'));
    assert('extractGeo1 pulls the real 07-21 Geo-1 (mentions Iran)', /iran/i.test(g), g.slice(0, 60));
    assert('classifyTheater(real 07-21 Geo-1) = Iran/Middle East', classifyTheater(g) === 'Iran/Middle East', classifyTheater(g));
  }
  // classifyTheater — synthetic both directions.
  assert('classify a Kyiv barrage → Russia/Ukraine',
    classifyTheater('- **Russia launched ~40 missiles at Kyiv overnight, incl. Iskander and Zircon.**') === 'Russia/Ukraine');
  assert('classify a NK foreign-minister trip → Korea',
    classifyTheater("- **North Korea's Choe Son Hui arrived in Pyongyang for talks.**") === 'Korea');
  assert('classify an unmatched bullet → NEEDS-REVIEW',
    classifyTheater('- **A domestic infrastructure bill advanced through committee this week.**') === 'NEEDS-REVIEW');
  assert('classify an empty Geo-1 → NEEDS-REVIEW', classifyTheater('') === 'NEEDS-REVIEW');

  // computeConsecutive — increment on same theater, reset on switch.
  const priorIran4: LogRow[] = [{ date: '2026-07-18', theater: 'Iran/Middle East', count: '4' }];
  assert('computeConsecutive: prior Iran day 4 + Iran → 5', computeConsecutive(priorIran4, 'Iran/Middle East') === 5);
  const priorRussia: LogRow[] = [{ date: '2026-07-20', theater: 'Russia/Ukraine', count: '1' }];
  assert('computeConsecutive: prior Russia + Iran → 1 (streak reset)', computeConsecutive(priorRussia, 'Iran/Middle East') === 1);

  // parseLogRows + idempotency on the REAL tracker (07-21 was backfilled this session).
  const trackerPath = path.join(root, 'system', 'Thesis_Tracker.md');
  if (fs.existsSync(trackerPath)) {
    const tracker = fs.readFileSync(trackerPath, 'utf8');
    const rows = parseLogRows(tracker);
    assert('parseLogRows reads the real log (≥ 20 rows)', rows.length >= 20, `${rows.length} rows`);
    assert('idempotent: inserting a date already present is a no-op',
      insertRow(tracker, rows[rows.length - 1]!.date, 'Iran/Middle East', 1, 'x') === null);
    // FIRE: a brand-new date inserts exactly one row, after the last dated row.
    const updated = insertRow(tracker, '2099-01-01', 'Iran/Middle East', 2, '(auto) test');
    assert('insertRow adds one dated row for a new date', !!updated && parseLogRows(updated!).some((r) => r.date === '2099-01-01' && r.theater === 'Iran/Middle East'));
    // NEEDS-REVIEW rows carry a "—" count, never a fabricated number.
    const nr = insertRow(tracker, '2099-01-02', 'NEEDS-REVIEW', 0, '(auto) NEEDS-REVIEW');
    assert('NEEDS-REVIEW row uses a "—" count (no fabricated number)', !!nr && /\| 2099-01-02 \| NEEDS-REVIEW \| — \|/.test(nr!));
  }

  console.log('append-geo-lead --selftest');
  let failed = 0;
  for (const r of results) { console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${!r.pass && r.detail ? ` — ${r.detail}` : ''}`); if (!r.pass) failed++; }
  console.log(`\n${results.length - failed}/${results.length} assertions passed.`);
  if (failed) { console.error('✗ SELFTEST FAILED'); return 1; }
  console.log('✓ derives the theater from the real Geo-1, computes consecutive days, is idempotent, and flags the unclassifiable LOUD.');
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? todayISO();
  return run(date);
}

process.exit(main());
