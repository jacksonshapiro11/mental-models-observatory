#!/usr/bin/env node --experimental-strip-types
/**
 * gate-input-freshness.ts — A GATE IS ONLY AS LIVE AS THE ARTIFACT IT READS.
 * (IMP-066, 2026-07-17. Closes the "MECHANICAL CHECK OWED" surfaced to the 10:03 session by
 * the 07-17 system-update pass, which found the failure and correctly refused to fix it on a
 * post-publish logging path.)
 *
 * WORKED FAILURE. The **Geo-Lead Theater Log** (system/Thesis_Tracker.md) records which theater
 * LEADS the Geopolitics section each day. The Quality Gate's ENTITY-PERSISTENCE CAP reads it:
 * >=5 consecutive days as Geo lead forces mandatory compression. On 2026-07-17 the log was found
 * DEAD FOR 20 DAYS — last row 2026-06-27, while briefs published every day through 07-17.
 *
 * The gate was not broken. It was *defeated by an unmaintained input*: it read a 06-27
 * "CAP CLEARED" status forever and returned clean no matter what the briefs actually did. For
 * 20 days the Iran-persistence cap was decorative — a green check the whole chain trusted.
 * Nobody noticed, because NOTHING CHECKS THE CHECKER.
 *
 * This is the same shape as IMP-064 (the premise registry that silently returned zero rows and
 * let fact-gate print "PASS"), arriving from a different direction. The doctrine's own lesson:
 * a rule enforced by an artifact is only as live as that artifact, and an artifact with no
 * mechanical freshness check decays silently — the next 20-day gap is SCHEDULED, not possible.
 *
 * THE CHECK. For each registered gate-input: the newest date recorded in the input must be >=
 * the newest published brief date. If briefs have shipped that the input never recorded, the
 * gate reading it is running on stale ground and we say so, loudly, with the gap in days.
 *
 * Deliberately NOT an appender. An auto-appender would guess which theater led — a judgment
 * call — and a gate that fabricates its own input is worse than one that admits it is stale.
 * This fails loudly and names the file and the reader; a human or the system-update pass writes
 * the true row.
 *
 * Usage: node --experimental-strip-types scripts/gate-input-freshness.ts [--selftest]
 * Exit: 0 all inputs current · 1 any input stale · 2 usage/parse error
 */
import * as fs from 'fs';
import * as path from 'path';

type Finding = { check: string; severity: 'FAIL'; message: string };

interface InputSpec {
  /** Human name of the log/registry. */
  name: string;
  /** Repo-relative file that carries it. */
  file: string;
  /** Heading that opens the section holding the dated rows. */
  sectionHeader: string;
  /** Who READS this input — named in the failure so the blast radius is never a mystery. */
  reader: string;
  /** What goes stale-silent when it is not maintained. */
  consequence: string;
}

/** The registry. One row per artifact that a gate reads and a human maintains. */
export const GATE_INPUTS: InputSpec[] = [
  {
    name: 'Geo-Lead Theater Log',
    file: 'system/Thesis_Tracker.md',
    sectionHeader: '### Geo-Lead Theater Log',
    reader:
      "the Quality Gate's ENTITY-PERSISTENCE CAP (system/Novelty_Audit.md, system/Geopolitics_Generator.md)",
    consequence:
      'the >=5-consecutive-days Geo-lead compression cap cannot fire — it re-reads the last recorded status forever and returns clean regardless of what the briefs do. Found dead 20 days (06-27 -> 07-17) on 2026-07-17.',
  },
];

const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

/** Newest date in the dated rows under `sectionHeader`. Null if the section or its rows are absent. */
export function newestDateInSection(
  body: string,
  sectionHeader: string
): string | null {
  const start = body.indexOf(sectionHeader);
  if (start === -1) return null;
  const rest = body.slice(start + sectionHeader.length);
  // Section ends at the next heading of the same or higher level.
  const endRel = rest.search(/\n#{1,3}\s/);
  const section = endRel === -1 ? rest : rest.slice(0, endRel);
  const dates: string[] = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue; // dated ROWS only, not prose mentioning a date
    const m = t.match(DATE_RE);
    if (m) dates.push(m[1]!);
  }
  if (dates.length === 0) return null;
  return dates.sort()[dates.length - 1]!;
}

/** Today's date on the America/New_York reading clock — the date the system publishes against. */
export function nyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Newest PUBLISHED daily brief date (content/daily-updates/YYYY-MM-DD.md; companions excluded).
 *
 * A FUTURE-DATED file on disk is NOT published — it is tomorrow's draft. The pipeline's cadence is
 * evening-write -> morning-publish (`brief-draft` writes {tomorrow}.md ~8 PM ET; `brief-morning`
 * publishes it), so from ~8 PM every night tomorrow's draft sits on disk. No human-maintained log
 * can have recorded a brief nobody has read yet, so counting it made EVERY evening run report a
 * stale input — a false positive with a nightly period.
 *
 * FIXED 2026-07-17 21:40 ET (IMP-068), first night this gate existed to meet an evening draft:
 * it shipped ~10 AM (selftest green at 10:12, disk held only published briefs) and went red at
 * 20:00 when brief-draft wrote 2026-07-18.md. This function is NAMED `newestPublishedBrief` and its
 * docstring CLAIMED "published" while it read the working directory — the exact class the gate was
 * built to police ("a gate is only as live as the artifact it reads") and the 07-11 corrections-gate
 * lesson ("a gate that reads the working copy proves only that we MEANT to fix it"). Deliberately
 * NOT reading origin/main: this gate is warn-only and must run offline in the sandbox; the reading
 * clock is sufficient and cannot fail closed on a network blip.
 */
export function newestPublishedBrief(
  root: string,
  today: string = nyToday()
): string | null {
  const dir = path.join(root, 'content/daily-updates');
  if (!fs.existsSync(dir)) return null;
  const dates = fs
    .readdirSync(dir)
    .map(f => f.match(/^(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
    .filter((d): d is string => !!d)
    .filter(d => d <= today) // a future-dated draft on disk is not published
    .sort();
  return dates.length ? dates[dates.length - 1]! : null;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00Z').getTime() -
      new Date(a + 'T00:00:00Z').getTime()) /
      86400000
  );
}

function prevDay(d: string): string {
  return new Date(new Date(d + 'T00:00:00Z').getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * THE ONE-DAY GRACE (IMP-104 prescribed 2026-07-27, ACTUALLY SHIPPED 2026-08-10).
 *
 * The threshold a human-maintained log is graded against is the newest brief published STRICTLY
 * BEFORE today — not the newest brief on disk. The cadence is morning-publish (~05:20 ET) → the
 * geo-lead row is appended by a LATER scheduled step (10:03 `append-geo-lead.ts` / Apply_Improvements
 * Phase 6). Between those two clocks the log is legitimately one day behind today's brief, and
 * grading against `newestPublishedBrief` made the gate FAIL every single morning — a false positive
 * with a DAILY period, which is precisely how a genuine catch gets written off as known noise.
 *
 * FORENSIC NOTE, kept because it is the lesson: IMP-104's ledger row (2026-07-27) claims this
 * function was added and "verified both directions". It was not. `git log -S freshnessThreshold
 * --all` returns EMPTY — the string was never in any commit and was not in the working file either.
 * The row stayed green for two weeks only because Phase 6 runs `append-geo-lead.ts` FIRST, making
 * the log current before verify ever read it; the morning of 2026-08-10 the registry was read
 * before that append and the ghost fix was exposed. IMP-104's check was `run:<selftest>` with no
 * `grep:` leg, so ledger rule 7's revert-detection could not see the absence. Both are fixed here.
 *
 * The grace is exactly ONE day and no more: a log two days behind still FIRES (see selftest), and
 * the original 06-27 → 07-17 twenty-day dead-log window still FIRES. Grace ≠ blindness.
 */
export function freshnessThreshold(
  root: string,
  today: string = nyToday()
): string | null {
  return newestPublishedBrief(root, prevDay(today));
}

/** The shipped comparison, exported so the selftest exercises the real one and not a copy. */
export function isStale(newestRow: string, threshold: string): boolean {
  return newestRow < threshold;
}

export function checkInputs(
  root: string,
  inputs: InputSpec[] = GATE_INPUTS,
  today: string = nyToday()
): Finding[] {
  const out: Finding[] = [];
  const latestBrief = freshnessThreshold(root, today);
  if (!latestBrief) return out; // no published briefs (fresh clone / sandbox) — nothing to be stale against
  for (const spec of inputs) {
    const p = path.join(root, spec.file);
    if (!fs.existsSync(p)) {
      out.push({
        check: 'gate-input-missing',
        severity: 'FAIL',
        message: `GATE INPUT MISSING — ${spec.name} (${spec.file}) does not exist, but it is read by ${spec.reader}. Consequence: ${spec.consequence}`,
      });
      continue;
    }
    const newest = newestDateInSection(
      fs.readFileSync(p, 'utf8'),
      spec.sectionHeader
    );
    if (!newest) {
      out.push({
        check: 'gate-input-unreadable',
        severity: 'FAIL',
        message: `GATE INPUT UNREADABLE — ${spec.name}: no dated rows found under "${spec.sectionHeader}" in ${spec.file}. It is read by ${spec.reader}. Consequence: ${spec.consequence}`,
      });
      continue;
    }
    if (isStale(newest, latestBrief)) {
      const gap = daysBetween(newest, latestBrief);
      out.push({
        check: 'gate-input-stale',
        severity: 'FAIL',
        message: `GATE INPUT STALE — ${spec.name} is current through ${newest}, but the newest published brief is ${latestBrief} (${gap} day${gap === 1 ? '' : 's'} of briefs it never recorded). It is read by ${spec.reader}. Consequence: ${spec.consequence} FIX: append the missing row(s) from the published briefs — do not guess; read what actually led the section. A gate is only as live as the artifact it reads.`,
      });
    }
  }
  return out;
}

function selftest(): number {
  const root = process.cwd();

  // SILENT on a log current through the latest brief.
  const fresh = `### Geo-Lead Theater Log\n\n| Date | Theater |\n|---|---|\n| 2026-07-16 | Iran |\n| 2026-07-17 | Iran |\n\n### Next\n`;
  const okFresh =
    newestDateInSection(fresh, '### Geo-Lead Theater Log') === '2026-07-17';

  // FIRES on the REAL 20-day gap: the log as it stood before the 07-17 rebuild (last row 06-27)
  // against a 07-17 brief. This is the exact decorative-gate window.
  const dead = `### Geo-Lead Theater Log\n\n| Date | Theater |\n|---|---|\n| 2026-06-26 | Iran |\n| 2026-06-27 | AI Policy |\n\n### Next\n`;
  const okDead =
    newestDateInSection(dead, '### Geo-Lead Theater Log') === '2026-06-27' &&
    daysBetween('2026-06-27', '2026-07-17') === 20;

  // Prose dates must NOT count as maintenance — only dated ROWS. (A "Status (rebuilt 2026-07-17)"
  // paragraph is exactly the kind of line that would have made the dead log look alive.)
  const proseOnly = `### Geo-Lead Theater Log\n\nStatus (rebuilt 2026-07-17): all current.\n\n| Date | Theater |\n|---|---|\n| 2026-06-27 | AI Policy |\n\n### Next\n`;
  const okProse =
    newestDateInSection(proseOnly, '### Geo-Lead Theater Log') === '2026-06-27';

  // Absent section / no rows → null (reported as unreadable, never silently "fresh").
  const okAbsent =
    newestDateInSection('# Something else\n', '### Geo-Lead Theater Log') ===
    null;
  const okNoRows =
    newestDateInSection(
      '### Geo-Lead Theater Log\n\nNo table yet.\n\n### Next\n',
      '### Geo-Lead Theater Log'
    ) === null;

  // Synthetic end-to-end: a stale input FAILs and names its reader.
  const tmpFindings = checkInputs(root, [
    {
      name: 'Synthetic Log',
      file: 'system/Thesis_Tracker.md',
      sectionHeader: '### __no_such_section__',
      reader: 'nobody',
      consequence: 'n/a',
    },
  ]);
  const okUnreadable = tmpFindings.some(
    f => f.check === 'gate-input-unreadable'
  );

  // A FUTURE-DATED DRAFT ON DISK IS NOT PUBLISHED (the 20:00 regression, IMP-068).
  // Both directions, against the real content/daily-updates:
  //   (a) on the evening clock, tomorrow's draft must NOT count as published;
  //   (b) once that date IS today, the same file MUST count — the fix must not blind the gate.
  const evening = newestPublishedBrief(root, '2026-07-17');
  const morning = newestPublishedBrief(root, '2026-07-18');
  const okFutureExcluded = evening !== null && evening <= '2026-07-17';
  const okNotBlinded = morning === '2026-07-18' && morning > (evening ?? '');
  // And the reading clock must be America/New_York, not UTC: 2026-07-18T00:30Z IS still 07-17 in NY.
  // Using UTC here would re-introduce the identical bug every night between 8 PM and midnight ET.
  const okNyClock = nyToday(new Date('2026-07-18T00:30:00Z')) === '2026-07-17';

  // THE ONE-DAY GRACE, BOTH DIRECTIONS ON REAL ARTIFACTS (IMP-154 — the fix IMP-104 claimed and
  // never shipped; replayed here against the exact 2026-08-10 07:03 ET state that exposed it).
  //
  // (a) It DOES something. 2026-08-10.md is on disk and IS counted as published — that is the
  //     value the OLD code graded the log against, and it is why the gate was RED this morning.
  //     The threshold is now strictly earlier. If this leg ever goes ✗ the grace is a no-op again.
  const graceIsNotANoop =
    newestPublishedBrief(root, '2026-08-10') === '2026-08-10' &&
    (freshnessThreshold(root, '2026-08-10') ?? '9999') < '2026-08-10';
  // (b) A log current through the last brief-before-today is SILENT this morning — the false-RED
  //     with a DAILY period (publish ~05:20 ET → 10:03 append) is closed. Replayed on the real
  //     pre-append state: the Geo-Lead Theater Log's newest row was 2026-08-09.
  const threshold0810 = freshnessThreshold(root, '2026-08-10')!;
  const okGraceHolds = isStale('2026-08-09', threshold0810) === false;
  // (c) ...but the grace is ONE PUBLISHED BRIEF, not a blanket. Two behind still FIRES, and the
  //     original 20-day dead-log window still FIRES against its own day's threshold.
  const okGraceNotBlind =
    isStale('2026-08-07', threshold0810) === true &&
    isStale('2026-06-27', freshnessThreshold(root, '2026-07-17')!) === true;
  // (d) WEEKEND HOLE: 2026-08-09 was a Sunday — the daily was HELD and no 2026-08-09.md exists.
  //     The threshold must walk back to the newest brief that ACTUALLY published (08-08), never
  //     to a calendar day with no artifact. A gate that grades against a file that does not
  //     exist is the decorative-input failure this whole script was built to police.
  const okWeekendHole =
    !fs.existsSync(path.join(root, 'content/daily-updates/2026-08-09.md')) &&
    threshold0810 === '2026-08-08';

  // THE REAL REGISTRY, RIGHT NOW: this is the check running in anger.
  const real = checkInputs(root);
  const okRealClean = real.length === 0;

  console.log('gate-input-freshness --selftest');
  console.log(`  reads the newest dated ROW: ${okFresh ? '✓' : '✗'}`);
  console.log(
    `  FIRES on the real 06-27 -> 07-17 dead-log window (20 days): ${okDead ? '✓' : '✗'}`
  );
  console.log(
    `  prose dates do NOT count as maintenance (rows only): ${okProse ? '✓' : '✗'}`
  );
  console.log(
    `  absent section -> null (never silently "fresh"): ${okAbsent ? '✓' : '✗'}`
  );
  console.log(`  section with no rows -> null: ${okNoRows ? '✓' : '✗'}`);
  console.log(
    `  unreadable input FAILs and names its reader: ${okUnreadable ? '✓' : '✗'}`
  );
  console.log(
    `  tomorrow's draft on disk is NOT "published" (20:00 regression): ${okFutureExcluded ? '✓' : '✗'}`
  );
  console.log(
    `  ...but the same file DOES count once its date arrives (not blinded): ${okNotBlinded ? '✓' : '✗'}`
  );
  console.log(
    `  reading clock is America/New_York, not UTC: ${okNyClock ? '✓' : '✗'}`
  );
  console.log(
    `  freshnessThreshold GRACE is not a no-op (today publishes, yesterday grades): ${graceIsNotANoop ? '✓' : '✗'}`
  );
  console.log(
    `  a log current through YESTERDAY is SILENT this morning (no daily false-RED): ${okGraceHolds ? '✓' : '✗'}`
  );
  console.log(
    `  ...but TWO briefs behind still FIRES (grace is one brief, not blindness): ${okGraceNotBlind ? '✓' : '✗'}`
  );
  console.log(
    `  weekend hole: Monday grades against Saturday's brief, not a Sunday that never published: ${okWeekendHole ? '✓' : '✗'}`
  );
  console.log(
    `  the REAL registered inputs are current right now: ${okRealClean ? '✓' : '✗'}${okRealClean ? '' : `\n${real.map(f => `      ✗ ${f.message}`).join('\n')}`}`
  );

  const ok =
    okFresh &&
    okDead &&
    okProse &&
    okAbsent &&
    okNoRows &&
    okUnreadable &&
    okFutureExcluded &&
    okNotBlinded &&
    okNyClock &&
    graceIsNotANoop &&
    okGraceHolds &&
    okGraceNotBlind &&
    okWeekendHole &&
    okRealClean;
  if (ok) {
    console.log(
      '\n✅ SELFTEST PASS — a gate input that stops being maintained now FAILs loudly instead of quietly making its gate decorative.'
    );
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  return 1;
}

function main(): number {
  if (process.argv.includes('--selftest')) return selftest();
  const root = process.cwd();
  const findings = checkInputs(root);
  const latest = newestPublishedBrief(root);
  console.log(
    `gate-input-freshness — newest published brief: ${latest ?? 'none'}`
  );
  for (const spec of GATE_INPUTS) {
    const p = path.join(root, spec.file);
    const newest = fs.existsSync(p)
      ? newestDateInSection(fs.readFileSync(p, 'utf8'), spec.sectionHeader)
      : null;
    console.log(`  ${spec.name}: current through ${newest ?? 'UNREADABLE'}`);
  }
  if (findings.length === 0) {
    console.log(
      '\n✅ GATE-INPUT-FRESHNESS PASS — every registered gate input is current.'
    );
    return 0;
  }
  console.log(
    `\n❌ GATE-INPUT-FRESHNESS FAIL — ${findings.length} stale input(s):`
  );
  for (const f of findings) console.log(`   ✗ [${f.check}] ${f.message}`);
  return 1;
}

process.exit(main());
