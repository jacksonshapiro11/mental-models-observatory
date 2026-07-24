#!/usr/bin/env node
/**
 * Daily Model Rotation — deterministic selector.
 *
 * WHY: the daily brief's Model was chosen by the Writer from Model_Library.md under a prose
 * "14-day cooldown" that went stale (the Recently Used table stopped at April) and was keyed on
 * slug, so the same idea shipped twice in three days (2026-07-19 AND 2026-07-21 both used
 * `signal-vs-noise-information-quality`). LLM familiarity bias also collapsed selection into one
 * style — obscure-science-principle-with-a-discovery-anecdote — every day. Jackson: "a new one
 * every day for 100 days then cycle them back, not the same style every day."
 *
 * HOW: the model is ASSIGNED, not free-picked. A domain-interleaved queue of all catalog models
 * (data/model-rotation-queue.json) is walked one-per-day from the epoch RECORDED IN THE QUEUE
 * FILE. Selection is a pure function of the date (queue.models[(date - epoch) mod len]) —
 * idempotent, reproducible, no discretion. Queue length (119) > 100 makes a 100-day no-repeat
 * structural; consecutive head entries come from different domains, so style rotates.
 * ENFORCED at the gate: scripts/validate-brief.ts checkModelAssigned rejects a brief whose
 * Model slug ≠ the assignment for its date — the prose rule failed, the validator cannot.
 *
 * v2 (2026-07-24 review hardening):
 *   - Paths moved system/ → data/ so the queue/ledger are TRACKED (system/ is gitignored and
 *     rewritten daily by scheduled tasks — the rotation's source of truth must live in git).
 *   - Epoch lives in the queue file, set by --build, so a rebuild starts a new well-defined
 *     cycle instead of re-dealing against a hardcoded constant.
 *   - --build parks every slug played in the last 100 DAYS (by ledger date, not row count) at
 *     the tail, OLDEST last-play first. The v1 slice(-10) parking silently broke the 100-day
 *     guarantee on a mid-cycle rebuild (measured: 10 slugs replayed at gap=90 after a
 *     day-30 rebuild). With len ≥ 119 and ≤ 100 recent slugs, oldest-first tail placement makes
 *     the minimum replay gap ≥ len days — structural again. --build refuses to write a queue
 *     that violates the invariants.
 *   - --selftest additionally proves the HISTORY GAP: no slug in the ledger replays within
 *     100 days of its recorded last play, across rebuild boundaries.
 *   - The ledger is only appended for TODAY (ET). Any other --date is a PEEK: printed, never
 *     recorded (v1 appended future/past/invalid rows — audit-log pollution, including a
 *     rotation row contradicting the pre-rotation history for the same date).
 *   - --date is validated (format + real calendar date); pre-epoch dates are rejected.
 *
 * USAGE:
 *   node --experimental-strip-types scripts/select-daily-model.ts [--date YYYY-MM-DD]
 *       Print the assignment. Appends to data/model-rotation-ledger.json ONLY when the date is
 *       today (ET); other dates print with "peek": true. Idempotent per date.
 *   node --experimental-strip-types scripts/select-daily-model.ts --selftest
 *       Verify rotation invariants incl. the ledger history gap. Exit 0/1.
 *   node --experimental-strip-types scripts/select-daily-model.ts --build
 *       Regenerate the queue from system/Model_Library.md (domain round-robin; last-100-days
 *       slugs parked oldest-first; epoch = first unshipped day). Run after editing the catalog.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const QUEUE_PATH = path.join(ROOT, 'data/model-rotation-queue.json');
const LEDGER_PATH = path.join(ROOT, 'data/model-rotation-ledger.json');
const LIBRARY_PATH = path.join(ROOT, 'system/Model_Library.md');

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Model = { slug: string; name: string; domain: string };
type QueueFile = { epoch: string; parked: number; models: Model[] };
type LedgerRow = { date: string; slug: string; domain: string; queueIndex: number | null; source: string };

function readJSON<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function utcDay(dateStr: string): number {
  return Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10));
}

/** Format + real-calendar-date check ("2026-7-4" and "2026-02-31" both rejected). */
function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  return new Date(utcDay(s)).toISOString().slice(0, 10) === s;
}

function addDays(dateStr: string, n: number): string {
  return new Date(utcDay(dateStr) + n * DAY_MS).toISOString().slice(0, 10);
}

function todayET(): string {
  // America/New_York calendar date, no time component.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function loadQueueFile(): QueueFile {
  const q = readJSON<QueueFile | Model[] | null>(QUEUE_PATH, null);
  if (!q) throw new Error(`Missing/empty queue at ${QUEUE_PATH}. Run --build first.`);
  if (Array.isArray(q)) {
    throw new Error(`Legacy array-format queue at ${QUEUE_PATH} — re-run --build to write the epoch-stamped format.`);
  }
  if (!q.epoch || !DATE_RE.test(q.epoch) || !Array.isArray(q.models) || q.models.length === 0 || typeof q.parked !== 'number') {
    throw new Error(`Malformed queue file at ${QUEUE_PATH} (need { epoch, parked, models[] }). Run --build.`);
  }
  return q;
}

/** Deterministic index for a date string (YYYY-MM-DD) into the queue. Pre-epoch dates throw. */
function indexForDate(dateStr: string, q: QueueFile): number {
  const days = Math.round((utcDay(dateStr) - utcDay(q.epoch)) / DAY_MS);
  if (days < 0) {
    throw new Error(
      `${dateStr} precedes the rotation epoch (${q.epoch}). Pre-epoch models were free-picked and live in the ledger as history — they have no assignment.`,
    );
  }
  return days % q.models.length;
}

function select(dateStr: string): { date: string; queueIndex: number } & Model {
  const q = loadQueueFile();
  const idx = indexForDate(dateStr, q);
  return { date: dateStr, queueIndex: idx, ...q.models[idx]! };
}

function appendLedger(pick: { date: string; queueIndex: number } & Model): void {
  const ledger = readJSON<LedgerRow[]>(LEDGER_PATH, []);
  if (ledger.some((r) => r.date === pick.date && r.source === 'rotation')) return; // idempotent
  ledger.push({
    date: pick.date,
    slug: pick.slug,
    domain: pick.domain,
    queueIndex: pick.queueIndex,
    source: 'rotation',
  });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

// ── Shared invariant checker (used by --selftest AND --build, so a rebuild that would break
//    the rotation refuses to write) ─────────────────────────────────────────────────────────
function invariantFails(q: QueueFile, ledger: LedgerRow[]): string[] {
  const fails: string[] = [];
  const len = q.models.length;
  if (len < 100) fails.push(`queue length ${len} < 100 — cannot guarantee a 100-day no-repeat`);
  if (new Set(q.models.map((m) => m.slug)).size !== len) fails.push('queue contains duplicate slugs');
  if (q.parked < 0 || q.parked > len) fails.push(`parked=${q.parked} out of range`);

  // Simulate len + 15 consecutive days from the epoch.
  const days: (Model & { idx: number })[] = [];
  for (let i = 0; i < len + 15; i++) {
    const idx = i % len;
    days.push({ idx, ...q.models[idx]! });
  }

  // (1) No slug repeats within any 100-consecutive-day window.
  for (let i = 0; i < days.length; i++) {
    const seen = new Set<string>();
    for (let j = i; j < Math.min(i + 100, days.length); j++) {
      if (seen.has(days[j]!.slug)) { fails.push(`slug ${days[j]!.slug} repeats within 100 days of index ${i}`); break; }
      seen.add(days[j]!.slug);
    }
  }

  // (2) Consecutive days differ in DOMAIN across the interleaved head. The parked tail
  //     (last `parked` entries) is a deliberate exception, ~(len - parked) days out.
  const headLen = len - q.parked;
  let consecSameHead = 0;
  for (let i = 1; i < headLen; i++) if (days[i]!.domain === days[i - 1]!.domain) consecSameHead++;
  if (consecSameHead > 0) fails.push(`${consecSameHead} consecutive same-domain day-pairs in the head (expected 0)`);

  // (3) Wrap: day len returns to queue[0].
  if (days[len]!.slug !== q.models[0]!.slug) fails.push(`day ${len} did not wrap to queue[0]`);

  // (4) The exact recorded failure cannot recur: signal-vs-noise repeats are >= 100 days apart.
  const sig = 'signal-vs-noise-information-quality';
  const firstSig = days.findIndex((d) => d.slug === sig);
  if (firstSig !== -1) {
    const nextSig = days.findIndex((d, i) => i > firstSig && d.slug === sig);
    if (nextSig !== -1 && nextSig - firstSig < 100) fails.push(`${sig} recurs after only ${nextSig - firstSig} days`);
  }

  // (5) HISTORY GAP (v2 — the invariant v1's slice(-10) parking silently broke on rebuild):
  //     for every ledger play BEFORE this epoch, the slug's first scheduled replay under this
  //     queue must be >= 100 days after that play. Holds across rebuild boundaries by
  //     construction of --build's oldest-first tail; verified here so it can never regress.
  const idxBySlug = new Map(q.models.map((m, i) => [m.slug, i] as const));
  for (const r of ledger) {
    if (!r || !r.slug || !r.date || !isValidDate(r.date)) continue;
    if (utcDay(r.date) >= utcDay(q.epoch)) continue; // live-cycle rows ARE the scheduled plays
    const idx = idxBySlug.get(r.slug);
    if (idx === undefined) continue; // slug retired from catalog
    const gap = Math.round((utcDay(q.epoch) + idx * DAY_MS - utcDay(r.date)) / DAY_MS);
    if (gap < 100) {
      fails.push(`${r.slug} played ${r.date} would replay after only ${gap} days (queue index ${idx}) — parking failed`);
    }
  }

  return fails;
}

// ── --build: regenerate the domain-interleaved queue from the catalog ──────────
function parseCatalog(md: string): Model[] {
  const models: Model[] = [];
  let domain: string | null = null;
  let inCatalog = false;
  for (const ln of md.split('\n')) {
    if (ln.startsWith('## The Catalog')) { inCatalog = true; continue; }
    if (!inCatalog) continue;
    if (ln.startsWith('## ')) break;
    const dm = ln.match(/^###\s+(.+?)\s*$/);
    if (dm) { domain = dm[1].trim(); continue; }
    const mm = ln.match(/^-\s+\*\*(.+?)\*\*\s*\[slug:\s*`([^`]+)`\]/);
    if (mm && domain) models.push({ name: mm[1].trim(), slug: mm[2].trim(), domain });
  }
  return models;
}

function buildQueue(): QueueFile {
  const models = parseCatalog(fs.readFileSync(LIBRARY_PATH, 'utf8'));
  if (models.length < 100) throw new Error(`Catalog parsed only ${models.length} models — expected 100+.`);
  const byDom: Record<string, Model[]> = {};
  for (const m of models) (byDom[m.domain] ??= []).push(m);
  const domains = Object.keys(byDom).sort();
  for (const d of domains) byDom[d]!.sort((a, b) => a.slug.localeCompare(b.slug));
  const interleaved: Model[] = [];
  for (let round = 0, added = true; added; round++) {
    added = false;
    for (const d of domains) {
      const m = byDom[d]![round];
      if (m) { interleaved.push(m); added = true; }
    }
  }

  const ledger = readJSON<LedgerRow[]>(LEDGER_PATH, []);
  const today = todayET();
  // Epoch = the first unshipped day: tomorrow if anything (rotation or pre-rotation) already
  // shipped today, else today. A mid-cycle rebuild therefore starts a clean, well-defined cycle.
  const epoch = ledger.some((r) => r?.date === today) ? addDays(today, 1) : today;

  // Park every slug played in the last 100 DAYS (by date, not row count) at the tail,
  // OLDEST last-play first — so a slug played k days ago sits deep enough that its replay
  // lands >= 100 days after its last play.
  const windowStart = addDays(epoch, -100);
  const lastPlay = new Map<string, string>();
  for (const r of ledger) {
    if (!r?.slug || !r?.date || !isValidDate(r.date) || r.date >= epoch) continue;
    if (!lastPlay.has(r.slug) || r.date > lastPlay.get(r.slug)!) lastPlay.set(r.slug, r.date);
  }
  const isRecent = (slug: string) => {
    const d = lastPlay.get(slug);
    return !!d && d >= windowStart;
  };
  const head = interleaved.filter((m) => !isRecent(m.slug));
  const tail = interleaved
    .filter((m) => isRecent(m.slug))
    .sort((a, b) => lastPlay.get(a.slug)!.localeCompare(lastPlay.get(b.slug)!));

  const qf: QueueFile = { epoch, parked: tail.length, models: [...head, ...tail] };
  const fails = invariantFails(qf, ledger);
  if (fails.length) {
    throw new Error('--build produced a queue that violates the rotation invariants — refusing to write:\n  - ' + fails.join('\n  - '));
  }
  return qf;
}

// ── --selftest: prove the rotation invariants both directions ──────────────────
function selftest(): number {
  const q = loadQueueFile();
  const ledger = readJSON<LedgerRow[]>(LEDGER_PATH, []);
  const fails = invariantFails(q, ledger);
  if (fails.length) {
    console.error('SELFTEST FAIL:\n  - ' + fails.join('\n  - '));
    return 1;
  }
  console.log(
    `SELFTEST PASS — queue=${q.models.length} (epoch ${q.epoch}, ${q.parked} parked), no-repeat-in-100 ✓, ` +
      `domain rotation across ${q.models.length - q.parked} head days ✓, wrap ✓, ledger history gap >= 100 days ✓, ` +
      `the 07-19/07-21 same-slug repeat is structurally impossible ✓`,
  );
  return 0;
}

// ── main ───────────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (arg === '--selftest') {
  process.exit(selftest());
} else if (arg === '--build') {
  const q = buildQueue();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2) + '\n');
  console.log(
    `Built queue: ${q.models.length} models across ${new Set(q.models.map((m) => m.domain)).size} domains, ` +
      `epoch ${q.epoch}, ${q.parked} recently-played parked at tail → ${QUEUE_PATH}`,
  );
} else {
  let dateStr: string;
  if (arg === '--date') {
    if (!process.argv[3] || !isValidDate(process.argv[3])) {
      console.error(`Invalid --date ${JSON.stringify(process.argv[3] ?? '')} — expected a real calendar date, YYYY-MM-DD.`);
      process.exit(1);
    }
    dateStr = process.argv[3];
  } else if (arg) {
    console.error(`Unknown argument ${JSON.stringify(arg)}. Usage: [--date YYYY-MM-DD] | --selftest | --build`);
    process.exit(1);
  } else {
    dateStr = todayET();
  }

  let pick: ReturnType<typeof select>;
  try {
    pick = select(dateStr);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  // The ledger records what SHIPS. Only today's assignment is appended; any other date is a
  // peek — printed, never recorded (v1 wrote future/past rows and polluted the audit log).
  const isToday = dateStr === todayET();
  if (isToday) appendLedger(pick);
  console.log(JSON.stringify(isToday ? pick : { ...pick, peek: true }, null, 2));
}
