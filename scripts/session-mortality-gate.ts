#!/usr/bin/env node --experimental-strip-types
/**
 * session-mortality-gate.ts — A SESSION THAT WROTE A CANARY AND NEVER WROTE A VERDICT LEAVES A
 * RECORD THAT CANNOT DISTINGUISH FINISHED WORK FROM A CORPSE. UNTIL NOW NOTHING COULD SAY SO.
 *
 * IMP-214 · 2026-08-25 · RC3 · the enforcement half of the task-spec rule "FINAL STEP — STATUS
 * LINE (never exit without one)", which has been prose since it was written.
 *
 * ── THE FAILURE, WITH RECEIPTS ────────────────────────────────────────────────────────────
 * Two consecutive `daily-improvement` sessions opened correctly and then evaporated:
 *
 *   daily-briefs/2026-08-23-pipeline-status.md:43
 *     2026-08-23T07:03:17-04:00 | daily-improvement | CANARY | WRITE-OK      ← and NOTHING after
 *   daily-briefs/2026-08-24-pipeline-status.md:27
 *     2026-08-24T11:03:21Z      | daily-improvement | CANARY | WRITE-OK      ← and NOTHING after
 *
 * No terminal status line. No `{date}-improvements.md` on disk for either day. No ledger row
 * dated 2026-08-23 or 2026-08-24 (the ledger runs IMP-208…IMP-211/ESC-019 on 08-22, then jumps
 * straight to 08-25). Six Critical Critic mandates — 08-23 #1–3 and 08-24 #1–3 — were neither
 * applied nor deferred, and `verify-improvements.ts` exited 0 every morning throughout, because
 * every check it ran graded rows that EXIST and the mandate-coverage check had gone blind on the
 * same days (IMP-212). Two independent blind spots overlapped and the result was a green
 * registry sitting on top of a two-day outage of the system's own immune response.
 *
 * The canary is the point. The task spec put it FIRST precisely so a session that cannot write
 * would be visible — and it worked, both canaries landed. What was missing is the other half:
 * nobody ever went back and asked whether the session that opened the file also closed it.
 *
 * ── WHAT THE FIRST LIVE SCAN ACTUALLY FOUND — BIGGER, AND MORE INTERESTING, THAN THE HUNCH ─
 * 23 unterminated sessions across the 7 elapsed days, not 2, and `pipeline-health-check` — the
 * task that runs `verify-improvements.ts` daily — is among them on ALL FIVE of 08-20…08-24.
 *
 * They are NOT all the same event, and saying so would be the overclaim this gate must avoid:
 *   • 08-20 / 08-21 / 08-22 `daily-improvement` — the WORK LANDED. `{date}-improvements.md` is on
 *     disk for each, and the ledger carries IMP-201…204 (08-20), IMP-205…207 + ESC-018 (08-21),
 *     IMP-208…211 + ESC-019 (08-22). These sessions did their job and skipped the last line.
 *   • 08-23 / 08-24 `daily-improvement` — NOTHING landed. No improvements file, no ledger row.
 *
 * THAT IS PRECISELY THE HARM. From the record alone the two cases are INDISTINGUISHABLE — same
 * canary, same silence — so the missing line does not merely omit a formality, it destroys the
 * only signal that separates a healthy session from a dead one. Three days of skipping the rule
 * harmlessly is what made the fourth and fifth days invisible. This is why the gate keys on the
 * CONTRACT (canary ⇒ verdict) rather than trying to guess liveness from artifacts: an
 * artifact-sniffing check would have to know every slot's output path, and would have called
 * 08-20 healthy for the same reason it called 08-23 healthy — by looking somewhere else.
 *
 * ── WHY THIS SHAPE, AND NOT "CHECK THE IMPROVEMENTS FILE EXISTS" ──────────────────────────
 * An existence check on one artifact answers one slot's question and rots the moment an output
 * path changes. CANARY-without-verdict is slot-agnostic: it is the same question for
 * `brief-draft`, `brief-critic`, `intel-sweep`, `system-update` and everything added later, it
 * needs no per-slot registry to maintain, and it keys on the two lines the spec ALREADY
 * mandates. SKIPPED counts as a verdict — a session that decides not to work and says so is
 * healthy, and the spec says as much ("SKIPPED is a valid, useful outcome. Silence is not").
 *
 * ── TIME INDEPENDENCE (ledger rule 9, IMP-211) ────────────────────────────────────────────
 * `--scan` measures a RECORD — what the producers wrote — so its exit code moves with the world
 * and it belongs on a `world:` leg (warn channel), never on `run:`. `--selftest` runs entirely
 * on in-memory fixtures, so it answers the only question the ledger asks: is the detector real?
 * That is the `run:` leg. Today's live scan FAILS, correctly, on 08-23 and 08-24 — a `run:` leg
 * pointed at it would red the registry for a defect in the record rather than in the code, which
 * is the exact mistake IMP-211 was written to stop.
 *
 * ── TODAY IS EXCLUDED, DELIBERATELY ───────────────────────────────────────────────────────
 * A canary written this morning by a session still running is not a dead session, it is a live
 * one. Grading today would fire on every in-flight task — a false-positive storm, and the
 * fastest way to make a gate ignored (the same reasoning that scopes mandate coverage to fully
 * elapsed cycles). Deaths become visible at the next date rollover, which is soon enough: the
 * cost being prevented here is a SILENT two-day gap, not a two-hour one.
 *
 * Usage:
 *   session-mortality-gate.ts [--scan] [days]   # default: scan the last 7 elapsed days
 *   session-mortality-gate.ts --selftest
 *
 * Exit codes: 0 clean · 1 at least one UNTERMINATED SESSION in the window · 2 usage error.
 */
import * as fs from 'fs';
import * as path from 'path';

export const MORTALITY_WINDOW_DAYS = 7;

const VERDICT = /^(SUCCESS|FAIL|SKIPPED)$/i;

export interface SlotState {
  slot: string;
  canary: string | null; // the raw canary line
  terminal: boolean;
}

/**
 * Per-slot liveness for ONE pipeline-status file.
 *
 * A line is a CANARY when some field is exactly `CANARY`; it is TERMINAL when some field is
 * exactly SUCCESS / FAIL / SKIPPED. Field-exact, not substring: a status line whose free-text
 * reason happens to contain the word "FAIL" (they routinely do — they quote gate output) must
 * not be able to discharge a different slot's canary, and a path containing "SUCCESS" must not
 * either.
 */
export function parseStatusFile(md: string): SlotState[] {
  const byslot = new Map<string, SlotState>();
  for (const raw of md.split('\n')) {
    const f = raw.split('|').map(x => x.trim());
    if (f.length < 3) continue;
    const slot = f[1];
    if (!slot) continue;
    const rest = f.slice(2);
    const isCanary = rest.some(x => /^CANARY$/i.test(x));
    const isTerminal = rest.some(x => VERDICT.test(x));
    if (!isCanary && !isTerminal) continue;
    const cur = byslot.get(slot) ?? { slot, canary: null, terminal: false };
    if (isCanary && !cur.canary) cur.canary = raw.trim();
    if (isTerminal) cur.terminal = true;
    byslot.set(slot, cur);
  }
  return [...byslot.values()];
}

/** Slots in this file that opened with a canary and never recorded a verdict (UNTERMINATED). */
export function deadSlots(md: string): string[] {
  return parseStatusFile(md)
    .filter(s => s.canary && !s.terminal)
    .map(s => s.slot)
    .sort();
}

export interface Death {
  date: string;
  slot: string;
}

export function scan(
  dbDir: string,
  today: string,
  days: number = MORTALITY_WINDOW_DAYS
): { deaths: Death[]; filesRead: string[] } {
  const deaths: Death[] = [];
  const filesRead: string[] = [];
  if (!fs.existsSync(dbDir)) return { deaths, filesRead };
  const floor = new Date(Date.parse(today + 'T00:00:00Z') - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const dates = fs
    .readdirSync(dbDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f))
    .map(f => f.slice(0, 10))
    // TODAY IS EXCLUDED: a canary with no verdict today is an in-flight session, not a corpse.
    .filter(d => d < today && d >= floor)
    .sort();
  for (const d of dates) {
    const p = path.join(dbDir, `${d}-pipeline-status.md`);
    filesRead.push(p);
    for (const slot of deadSlots(fs.readFileSync(p, 'utf8'))) {
      deaths.push({ date: d, slot });
    }
  }
  return { deaths, filesRead };
}

// ── selftest ────────────────────────────────────────────────────────────────────────────────
function selftest(): number {
  let pass = 0;
  const results: string[] = [];
  const assert = (cond: boolean, label: string) => {
    if (cond) {
      pass++;
      results.push(`  ✓ ${label}`);
    } else {
      results.push(`  ✗ ${label}`);
    }
  };

  // The REAL 08-23 shape: a canary and nothing else. This is the case the gate exists for.
  const realDead =
    '2026-08-23T05:06:10-0400 | brief-morning | content/x.md | SUCCESS | fine\n' +
    '2026-08-23T07:03:17-04:00 | daily-improvement | CANARY | WRITE-OK\n';
  assert(
    deadSlots(realDead).join(',') === 'daily-improvement',
    'FIRES on the real 08-23 shape — canary, no verdict — and names ONLY the unterminated slot'
  );

  // The healthy shape: canary THEN verdict. Must be silent, or the gate is useless.
  const healthy =
    '2026-08-25T07:03:20-0400 | daily-improvement | CANARY | WRITE-OK\n' +
    '2026-08-25T09:41:02-0400 | daily-improvement | daily-briefs/x-improvements.md | SUCCESS | done\n';
  assert(
    deadSlots(healthy).length === 0,
    'SILENT when the canary is followed by SUCCESS'
  );

  assert(
    deadSlots(
      '2026-08-25T07:03:20-0400 | s | CANARY | WRITE-OK\n2026-08-25T08:00:00-0400 | s | none | SKIPPED | nothing to do\n'
    ).length === 0,
    'SILENT on SKIPPED — a session that declines and says so is healthy, per the task spec'
  );
  assert(
    deadSlots(
      '2026-08-25T07:03:20-0400 | s | CANARY | WRITE-OK\n2026-08-25T08:00:00-0400 | s | none | FAIL | broke\n'
    ).length === 0,
    'SILENT on FAIL — an admitted failure is the CONTRACT working; silence is the defect'
  );

  // The discipline that makes the check trustworthy: verdicts are FIELD-EXACT.
  assert(
    deadSlots(
      '2026-08-25T07:03:20-0400 | s | CANARY | WRITE-OK\n' +
        '2026-08-25T08:00:00-0400 | other | out.md | SUCCESS | the gate did not FAIL anywhere\n'
    ).join(',') === 's',
    "another slot's SUCCESS line cannot discharge this slot's canary"
  );
  assert(
    deadSlots(
      '2026-08-25T07:03:20-0400 | s | CANARY | WRITE-OK\n' +
        '2026-08-25T08:00:00-0400 | s | notes: the FAIL earlier was transient | WRITE-OK\n'
    ).join(',') === 's',
    'the word FAIL inside a free-text field does NOT count as a verdict (field-exact match)'
  );

  // Multiple deaths in one file, and a slot that never opened is not a death.
  assert(
    deadSlots(
      '00 | a | CANARY | WRITE-OK\n00 | b | CANARY | WRITE-OK\n00 | c | out | SUCCESS | ok\n'
    ).join(',') === 'a,b',
    'reports EVERY unterminated slot, and a slot with only a verdict is not one'
  );
  assert(
    deadSlots('').length === 0,
    'an empty status file yields no deaths (no phantom RED)'
  );

  // Window arithmetic, on a real directory, without depending on what the producers wrote.
  const dbDir = path.join(process.cwd(), 'daily-briefs');
  if (fs.existsSync(dbDir)) {
    const wide = scan(dbDir, '2026-08-25', 7);
    assert(
      wide.filesRead.every(p => !p.includes('2026-08-25-')),
      'TODAY is excluded from the scan — an in-flight canary is not an unterminated session'
    );
    const narrow = scan(dbDir, '2026-08-25', 1);
    assert(
      narrow.filesRead.length <= wide.filesRead.length,
      'a narrower window reads no more files than a wider one'
    );
    // The historical receipt, asserted as history: these two deaths are on disk and are why this
    // gate exists. Pinned to fixed dates, so this leg cannot drift with tomorrow's record.
    const hist = scan(dbDir, '2026-08-25', 7).deaths.filter(
      d =>
        d.slot === 'daily-improvement' &&
        (d.date === '2026-08-23' || d.date === '2026-08-24')
    );
    assert(
      hist.length === 2,
      'detects BOTH historical no-work days (daily-improvement, 08-23 and 08-24) — the founding receipt'
    );
  }

  console.log(results.join('\n'));
  const total = results.length;
  console.log(
    `session-mortality-gate selftest: ${pass}/${total} ${pass === total ? 'PASS' : 'FAIL'}`
  );
  return pass === total ? 0 : 1;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────
function main(argv: string[]): number {
  if (argv.includes('--selftest')) return selftest();
  const nums = argv.filter(a => /^\d+$/.test(a));
  const days = nums.length ? parseInt(nums[0]!, 10) : MORTALITY_WINDOW_DAYS;
  const today = new Date().toISOString().slice(0, 10);
  const dbDir = path.join(process.cwd(), 'daily-briefs');
  const { deaths, filesRead } = scan(dbDir, today, days);
  console.log(
    `session-mortality-gate — ${filesRead.length} elapsed day(s) in a ${days}d window (today excluded)`
  );
  if (!deaths.length) {
    console.log(
      '✓ no UNTERMINATED SESSION: every canary in the window is matched by a verdict line.'
    );
    return 0;
  }
  for (const d of deaths) {
    console.log(
      `  ✗ UNTERMINATED SESSION — ${d.slot} wrote a CANARY on ${d.date} and never wrote a status line. ` +
        `No SUCCESS, no FAIL, no SKIPPED. This does NOT prove the session died — it proves the record ` +
        `cannot tell you whether it did, which is the same thing to everyone downstream. ` +
        `Per the task spec's FINAL STEP, silence is not an outcome: write a FAIL line if the run produced nothing.`
    );
  }
  console.log(
    `\n✗ ${deaths.length} UNTERMINATED SESSION(S). Receipt for why this is a gate: daily-improvement left this ` +
      `exact trace on 08-20, 08-21 and 08-22 while its work LANDED (improvements file + ledger rows on disk), ` +
      `then on 08-23 and 08-24 while NOTHING landed — six Critical Critic mandates undischarged — and the record ` +
      `looked identical all five days. verify-improvements exited 0 every morning throughout.`
  );
  return 1;
}

if (process.argv[1] && /session-mortality-gate\.ts$/.test(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
