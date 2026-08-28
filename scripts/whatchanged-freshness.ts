#!/usr/bin/env npx tsx
/**
 * whatchanged-freshness.ts — IMP-183
 *
 * WHY THIS EXISTS
 * ---------------
 * `## WHAT CHANGED TODAY` in `system/Current_Worldview_v5.md` silently skipped
 * 2026-08-12 and 2026-08-13 (flagged 2026-08-14), and then silently skipped
 * 2026-08-15 and 2026-08-16 (found 2026-08-17). In every case the Big Story and
 * Tomorrow's Headline review blocks for those days EXIST, with their count lines
 * — the reviews ran; only the synthesis was never appended.
 *
 * That is now the THIRD observation of one drift (first: the 2026-07-11
 * section-integrity flag, whose prescribed fix was never mechanised). Per the
 * 2026-08-14 CARRY row: "a third prose flag is worthless. Fix: `system-update`
 * exits non-zero if the newest date in `## WHAT CHANGED TODAY` is not the run's
 * BRIEF_DATE."
 *
 * This is that check. A rule without a mechanical check is an unenforced rule,
 * and an unenforced rule about record-keeping decays fastest of all, because
 * nothing downstream notices a missing entry.
 *
 * WHAT IT CHECKS
 * --------------
 *   A. The `## WHAT CHANGED TODAY` section exists and contains at least one
 *      dated entry heading of the form `**Month D, YYYY:**`.
 *   B. The NEWEST such date equals the BRIEF_DATE passed on argv.
 *   C. (advisory) Reports any gap between the newest date and the one before it,
 *      so a skipped day is visible even on a run that is itself current.
 *
 * Deliberately NOT checked: entry content or length. This gate answers one
 * question — "did today's synthesis get written down?" — and a gate that
 * answers one question is one you keep reading.
 *
 * USAGE
 *   npx tsx scripts/whatchanged-freshness.ts 2026-08-17
 *   npx tsx scripts/whatchanged-freshness.ts --selftest
 *
 * EXIT 0 = the newest entry is the brief date. EXIT 1 = it is not, or the
 * section is missing/unparseable.
 */

import * as fs from 'fs';
import * as path from 'path';

const WORLDVIEW = path.join(process.cwd(), 'system', 'Current_Worldview_v5.md');
const SECTION_HEADING = '## WHAT CHANGED TODAY';

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export interface DatedEntry {
  iso: string;
  raw: string;
  line: number;
}

/**
 * Extract every dated WHAT CHANGED TODAY entry heading, in EITHER of the two
 * conventions the file actually uses. Matching is anchored to the start of a
 * line so that a date appearing mid-prose inside an entry is never mistaken for
 * an entry heading — that distinction is the whole reason this parses headings
 * rather than grepping for dates.
 *
 * TWO CONVENTIONS, AND WHY BOTH ARE PARSED (2026-08-19, IMP-WCT-2)
 * ----------------------------------------------------------------
 * Convention A: `**Month D, YYYY:**` inside the `## WHAT CHANGED TODAY` section.
 * Convention B: `### WHAT CHANGED TODAY — YYYY-MM-DD` as its own heading, which
 *   sessions have written since 2026-07-03 and which physically lands INSIDE
 *   `## TOMORROW'S HEADLINES` (the H2 above it), not under the canonical H2.
 *
 * The original gate parsed only Convention A, inside only that one section. So
 * every night a session happened to write Convention B, the gate reported the
 * synthesis "was not written" and the NEXT session, reading only one series,
 * logged a 🔴 record-keeping failure against a day that HAD been written.
 *
 * That is what actually happened. The union of both series covers 2026-08-07
 * through 2026-08-18 with ZERO gaps, yet four consecutive reviews escalated a
 * "fourth failure of the same prose instruction," a CARRY row was opened, and
 * this gate was built — all on top of a phantom. The record never failed; the
 * READING of the record failed, because two conventions coexist and each
 * session greps for one.
 *
 * This function therefore asks the question the rule MEANT — "did today's
 * synthesis get written down anywhere in this file?" — rather than "is it in
 * the one place and shape I expected?". Same lesson as `tree-status.ts`
 * (CLAUDE.md, CARRY+TREE): a check that draws a conclusion about X by
 * measuring Y manufactures a RED that teaches the next session to skim.
 */
export function parseEntries(body: string): DatedEntry[] {
  const lines = body.split('\n');
  const out: DatedEntry[] = [];
  const seen = new Set<string>();
  const push = (iso: string, raw: string, line: number) => {
    const key = `${iso}|${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ iso, raw, line });
  };

  // ---- Convention A: `**Month D, YYYY:**` under `## WHAT CHANGED TODAY` ----
  const start = lines.findIndex(l => l.trim() === SECTION_HEADING);
  if (start !== -1) {
    // Section runs to the next top-level `## ` heading.
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        end = i;
        break;
      }
    }
    const reA = /^\*\*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}):?\*\*/;
    for (let i = start + 1; i < end; i++) {
      const m = reA.exec(lines[i].trim());
      if (!m) continue;
      const mo = MONTHS[m[1].toLowerCase()];
      if (!mo) continue;
      const iso = `${m[3]}-${String(mo).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
      push(iso, lines[i].trim(), i + 1);
    }
  }

  // ---- Convention B: `### WHAT CHANGED TODAY — YYYY-MM-DD`, anywhere ----
  // Scanned over the WHOLE file on purpose: these headings sit under
  // `## TOMORROW'S HEADLINES`, so a section-scoped scan cannot see them, and
  // "which H2 is it filed under" is not the question this gate is asking.
  const reB = /^###\s+WHAT CHANGED TODAY\s*[—–-]\s*(\d{4})-(\d{2})-(\d{2})\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const m = reB.exec(lines[i].trim());
    if (!m) continue;
    push(`${m[1]}-${m[2]}-${m[3]}`, lines[i].trim(), i + 1);
  }

  return out;
}

export interface Verdict {
  ok: boolean;
  newest: string | null;
  expected: string;
  gapDays: number | null;
  previous: string | null;
  reason: string;
  grace?: boolean;
}

/**
 * PRODUCER-DEADLINE GRACE (added 2026-08-20 — IMP-201, RC7)
 * ---------------------------------------------------------
 * The entry for BRIEF_DATE is written by the `system-update` task, scheduled
 * **09:36 AM ET** (Pipeline_Controller schedule). `verify-improvements.ts` — and
 * `pipeline-health-check`, which runs it — can fire at any hour. So a gate that
 * demands today's entry at 07:03 ET is not measuring record-keeping; it is
 * measuring **what time it is**, and it manufactures a RED on every run that
 * lands before the producing task's own deadline. This session's registry read
 * `2 FAIL` at 07:03 ET against a log that was healthy (newest 08-19, previous
 * 08-18, gap 1d) and whose 08-20 entry was not yet due for another two and a
 * half hours.
 *
 * That is the FOURTH instance of one class in this repository, and the ledger
 * names the other three: IMP-200 (a `run:` leg pinned to a literal date, which
 * reddened precisely when the record went current), IMP-195 (a parser reading
 * one cell and reporting three LANDED mandates as UNCOVERED), and the CARRY/TREE
 * receipt of 2026-08-13 (a bare `git status` calling published-and-live briefs
 * untracked for four consecutive tasks). The cost is never the false alarm
 * itself — it is that the next REAL red gets skimmed.
 *
 * The remedy is the one already proven on this exact class: IMP-104's SAME-DAY
 * GRACE for `gate-input-freshness.ts` ("a human-maintained log cannot have
 * recorded today's brief until its scheduled append step runs").
 *
 * SEMANTICS — ask the question the rule MEANT, which is *is the record
 * delinquent?*, not *is today's entry present right now?*:
 *   • run ON BrIEF_DATE and BEFORE the deadline → required newest = BRIEF_DATE-1
 *     (yesterday's entry must exist; today's is not yet owed).
 *   • run on BRIEF_DATE at/after the deadline, or any run for a past date
 *     → required newest = BRIEF_DATE, exactly as before.
 * A newest entry AHEAD of the requirement always passes, so writing early is
 * never punished. A missing YESTERDAY still FIRES at any hour of the day, which
 * is the drift this gate was built for (08-12/08-13, 08-15/08-16) — the grace
 * window narrows the claim by one day, it does not switch the gate off.
 */
export const DEADLINE_HOUR_ET = 10;

function etParts(d = new Date()): { date: string; hour: number } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(d)
  );
  return { date, hour };
}

function shiftDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export interface EvalNow {
  date: string;
  hour: number;
}

/** The entry date this run is entitled to demand, and whether grace applied. */
export function requiredNewest(
  briefDate: string,
  now: EvalNow,
  deadlineHourET = DEADLINE_HOUR_ET
): { required: string; grace: boolean } {
  if (now.date === briefDate && now.hour < deadlineHourET) {
    return { required: shiftDays(briefDate, -1), grace: true };
  }
  return { required: briefDate, grace: false };
}

export function evaluate(
  body: string,
  briefDate: string,
  now?: EvalNow
): Verdict {
  const clock = now ?? etParts();
  const { required, grace } = requiredNewest(briefDate, clock);
  const entries = parseEntries(body);
  if (entries.length === 0) {
    return {
      ok: false,
      newest: null,
      expected: required,
      gapDays: null,
      previous: null,
      grace,
      reason:
        'no dated entries found under `## WHAT CHANGED TODAY` (section missing or format changed)',
    };
  }
  const sorted = [...entries].map(e => e.iso).sort();
  const newest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  let gapDays: number | null = null;
  if (previous) {
    const d = (Date.parse(newest) - Date.parse(previous)) / 86_400_000;
    gapDays = Math.round(d);
  }

  // ISO dates compare correctly as strings. `<` not `!==`: an entry AHEAD of the
  // requirement (written early, or written during the grace window) must pass.
  if (newest < required) {
    return {
      ok: false,
      newest,
      expected: required,
      gapDays,
      previous,
      grace,
      reason: grace
        ? `newest WHAT CHANGED TODAY entry is ${newest}, expected at least ${required} — the record is DELINQUENT (today's ${briefDate} entry is not yet due; system-update writes it 09:36 ET)`
        : `newest WHAT CHANGED TODAY entry is ${newest}, expected ${required} — today's synthesis was not written`,
    };
  }
  return {
    ok: true,
    newest,
    expected: required,
    gapDays,
    previous,
    grace,
    reason: grace
      ? `newest entry ${newest} satisfies the pre-deadline requirement (${required}); today's ${briefDate} entry is not yet due`
      : 'newest entry matches BRIEF_DATE',
  };
}

/* ------------------------------------------------------------------ */
/* SELFTEST — held-out acceptance, run in BOTH directions.            */
/* A check that only ever fires is as useless as one that never does. */
/* ------------------------------------------------------------------ */

function selftest(): number {
  let pass = 0;
  let fail = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) {
      pass++;
      console.log(`  ✅ ${name}`);
    } else {
      fail++;
      console.log(`  ❌ ${name}`);
    }
  };

  // Reconstruction of the file as it stood at 07:0x ET on 2026-08-17: the
  // 08-15 and 08-16 syntheses were never appended, so the newest entry is
  // August 14. This is the REAL failure case, not a synthetic one.
  const broken = [
    '## BIG STORIES',
    '',
    '### Active',
    '',
    '## WHAT CHANGED TODAY',
    '',
    '**August 14, 2026:**',
    '',
    'Body prose that itself mentions August 16, 2026 in passing.',
    '',
    '**August 13, 2026:**',
    '',
    'more body',
    '',
    '## FRAMEWORKS LIBRARY',
    '',
  ].join('\n');

  const repaired = broken.replace(
    '**August 14, 2026:**',
    "**August 17, 2026:**\n\nToday's synthesis.\n\n**August 14, 2026:**"
  );

  console.log('whatchanged-freshness --selftest');
  console.log('\nDIRECTION 1 — must FIRE on the real 2026-08-17 07:0x state:');
  const v1 = evaluate(broken, '2026-08-17');
  assert(
    'FAILS when newest entry (Aug 14) != BRIEF_DATE (2026-08-17)',
    v1.ok === false
  );
  assert('names the newest date it actually found', v1.newest === '2026-08-14');
  assert(
    'mid-prose "August 16, 2026" is NOT parsed as an entry heading',
    v1.newest !== '2026-08-16'
  );

  console.log('\nDIRECTION 2 — must go SILENT once the entry is written:');
  const v2 = evaluate(repaired, '2026-08-17');
  assert('PASSES once the 2026-08-17 entry is appended', v2.ok === true);
  assert('newest is 2026-08-17', v2.newest === '2026-08-17');
  assert(
    'advisory gap reports the 3-day skip (08-14 → 08-17)',
    v2.gapDays === 3
  );

  console.log(
    '\nDIRECTION 3 — healthy consecutive days stay silent and report gap 1:'
  );
  const healthy = broken
    .replace('**August 14, 2026:**', '**August 14, 2026:**')
    .replace('**August 13, 2026:**', '**August 13, 2026:**');
  const v3 = evaluate(healthy, '2026-08-14');
  assert(
    'PASSES on a file whose newest entry IS the brief date',
    v3.ok === true
  );
  assert('gap between Aug 14 and Aug 13 is 1 day', v3.gapDays === 1);

  console.log(
    '\nDIRECTION 4 — a missing section is a FAIL, not a pass by absence:'
  );
  const noSection = '## BIG STORIES\n\n### Active\n';
  const v4 = evaluate(noSection, '2026-08-17');
  assert('FAILS when the section is absent', v4.ok === false);
  assert('says why rather than throwing', /no dated entries/.test(v4.reason));

  // DIRECTION 5 — IMP-201. The real 2026-08-20 07:03 ET state: the log is
  // healthy (newest 08-19, gap 1d) and today's entry is not due until
  // system-update runs at 09:36 ET. The gate FAILED anyway, reddening the whole
  // registry. Grace must silence THAT and nothing else.
  const wcFile = (dates: string[]) =>
    [
      '## WHAT CHANGED TODAY',
      '',
      ...dates.flatMap(d => [`### WHAT CHANGED TODAY — ${d}`, '', 'body', '']),
      '## FRAMEWORKS LIBRARY',
      '',
    ].join('\n');
  const current = wcFile(['2026-08-19', '2026-08-18']); // healthy at 07:03 ET on 08-20
  const behind = wcFile(['2026-08-18', '2026-08-17']); // yesterday genuinely missing
  const early = wcFile(['2026-08-20', '2026-08-19']); // today already written
  const EARLY = { date: '2026-08-20', hour: 7 };
  const AFTER = { date: '2026-08-20', hour: 10 };

  console.log(
    '\nDIRECTION 5 — producer-deadline grace (system-update writes the entry at 09:36 ET):'
  );
  const v5a = evaluate(current, '2026-08-20', EARLY);
  assert(
    "SILENT at 07:03 ET when newest is yesterday — today's entry is not yet owed",
    v5a.ok === true
  );
  assert(
    'the pre-deadline requirement is stated as 2026-08-19, not 2026-08-20',
    v5a.expected === '2026-08-19'
  );
  const v5b = evaluate(current, '2026-08-20', AFTER);
  assert(
    'FIRES at 10:03 ET on the SAME file — after the deadline the entry IS owed',
    v5b.ok === false
  );
  const v5c = evaluate(behind, '2026-08-20', EARLY);
  assert(
    'FIRES at 07:03 ET when YESTERDAY is missing too — grace narrows the claim by one day, it does not switch the gate off',
    v5c.ok === false
  );
  const v5d = evaluate(early, '2026-08-20', EARLY);
  assert(
    "SILENT at 07:03 ET when today's entry was already written — writing early is never punished",
    v5d.ok === true
  );
  const v5e = evaluate(current, '2026-08-19', EARLY);
  assert(
    'a BRIEF_DATE in the past gets NO grace (backfill runs demand the exact date)',
    v5e.grace === false && v5e.ok === true
  );
  assert(
    'requiredNewest is a pure function of clock position and returns the grace flag',
    requiredNewest('2026-08-20', EARLY).required === '2026-08-19' &&
      requiredNewest('2026-08-20', AFTER).required === '2026-08-20'
  );

  console.log(
    `\nwhatchanged-freshness --selftest: ${pass} passed, ${fail} failed`
  );
  return fail === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ */

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();

  const briefDate = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!briefDate) {
    console.error(
      'usage: whatchanged-freshness.ts <BRIEF_DATE:YYYY-MM-DD> | --selftest'
    );
    return 1;
  }

  if (!fs.existsSync(WORLDVIEW)) {
    console.error(`whatchanged-freshness — FAIL: ${WORLDVIEW} not found`);
    return 1;
  }

  const body = fs.readFileSync(WORLDVIEW, 'utf-8');
  const v = evaluate(body, briefDate);

  console.log('whatchanged-freshness — system/Current_Worldview_v5.md');
  console.log(`  BRIEF_DATE      ${briefDate}`);
  console.log(
    `  required newest ${v.expected}${v.grace ? "  (GRACE — before system-update's 09:36 ET deadline, today's entry is not yet owed)" : ''}`
  );
  console.log(`  newest entry    ${v.newest ?? '(none)'}`);
  if (v.previous)
    console.log(`  previous entry  ${v.previous}  (gap ${v.gapDays}d)`);

  if (!v.ok) {
    console.error(`\n❌ WHATCHANGED-FRESHNESS FAIL — ${v.reason}`);
    console.error(
      '   The Big Story and TH review blocks can exist while the synthesis does not.'
    );
    console.error(
      '   Write the entry. Do NOT backfill missed days from review blocks —'
    );
    console.error('   reconstruction is not record (CARRY 2026-08-14).');
    return 1;
  }

  if (v.gapDays !== null && v.gapDays > 1) {
    console.log(
      `\n⚠️  ADVISORY: ${v.gapDays - 1} day(s) skipped before this entry (${v.previous} → ${v.newest}).`
    );
    console.log(
      '   Not a failure for THIS run — the gap is historical and backfill is forbidden.'
    );
  }

  console.log('\n✅ WHATCHANGED-FRESHNESS PASS');
  return 0;
}

// C1 CLASS (2026-08-28): `require.main === module` is a CJS idiom. Under `npx tsx` it works; under
// the production runner `node --experimental-strip-types` it throws before main() ever runs — so
// this script has been exiting 1 on every nightly invocation while reading green in every check.
if (process.argv[1] && process.argv[1].includes('whatchanged-freshness'))
  process.exit(main());
