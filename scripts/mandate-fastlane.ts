/**
 * mandate-fastlane.ts — MANDATE URGENCY GETS A SAME-MORNING LANE (work order W4, 2026-08-28).
 *
 * THE PROBLEM IT SOLVES, in the system's own words: conversion of Critic mandates into ledger rows
 * happens on Saturday. That cadence is fine for the WORK. It is not fine for the SILENCE — a
 * Critical mandate raised on Tuesday sat unnamed until the weekend, and the 08-28 Critic had to
 * write "THIS IS 08-27 MANDATE #1 RECURRING ONE BRIEF LATER, WIDER" because nothing between the two
 * briefs said the first one was still open.
 *
 * **CONVERSION STILL WAITS FOR SATURDAY. SILENCE NEVER DOES.** This leg runs in the daily canary,
 * reads last night's Critic, and says out loud what is unconverted — one CARRY line and a red email
 * the same morning. A mandate that RECURS from a prior brief is an EMERGENCY, because a repeat is
 * evidence the first one was never received rather than merely unfinished.
 */
import * as fs from 'fs';
import * as path from 'path';
// 🔴 C1 (2026-08-28): this was `require('os')` inline. `npx tsx` transpiles to CJS and it worked;
// the nightly path runs `node --experimental-strip-types`, which is true ESM, where `require` is
// not defined — so the selftest printed its passes and then the PROCESS died, and every caller
// read FAILURE from a passing run. **A selftest is only evidence under the runner that actually
// invokes it**; green under one runner proved nothing about the one the pipeline uses.
import * as os from 'os';

export const CRITICAL_RC = 2; // RC1-RC2 are the top ranks the Critic uses; RC3+ are lower
export interface Mandate {
  n: number;
  title: string;
  rc: number | null;
  critical: boolean;
  recurring: boolean;
  recurrenceNote?: string;
}

/** Parse the `## MUST BE BETTER TOMORROW` block. Its `### N. TITLE — RC{n}.` shape is the contract. */
export function parseMandates(md: string): Mandate[] {
  const start = md.indexOf('## MUST BE BETTER TOMORROW');
  if (start < 0) return [];
  const rest = md.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const block = end < 0 ? rest : rest.slice(0, end);
  const out: Mandate[] = [];
  for (const m of block.matchAll(/^###\s+(\d+)\.\s*(.+)$/gm)) {
    const title = m[2]!.replace(/^🔴\s*/, '').trim();
    const rcM = title.match(/\bRC(\d+)\b/);
    const rc = rcM ? Number(rcM[1]) : null;
    // "RECURRING", "AGAIN", "N CONSECUTIVE NIGHTS", "STILL" — a repeat states itself in this system.
    const rec =
      /\b(RECURRING|RECURS|AGAIN|CONSECUTIVE NIGHTS|SECOND NIGHT|STILL (?:OPEN|UNFIXED|NOT))\b/i.exec(
        title
      );
    out.push({
      n: Number(m[1]),
      title,
      rc,
      // A mandate with NO RC is treated as critical. An unranked mandate is unranked, not minor —
      // defaulting it downward is how the quiet ones stay quiet.
      critical: rc === null || rc <= CRITICAL_RC,
      recurring: !!rec,
      recurrenceNote: rec ? rec[0] : undefined,
    });
  }
  return out;
}

/**
 * Has any ledger ROW, in any state, cited this Critic date IN A CELL? Orphaned is worse than
 * starved — starved means logged and not fed; orphaned means never logged, and every other check
 * is blind to it.
 *
 * A substring match on the whole file was the first cut and it is the SEGMENTER-BUG false green one
 * more time: the date string appears in prose, in other rows' narratives, in verification commands.
 * A citation is a CELL that IS the date (or a cell naming that date's Critic), not the date
 * appearing somewhere in a 300KB file.
 */
export function converted(ledgerMd: string, date: string): boolean {
  const short = date.slice(5); // 08-27
  for (const line of ledgerMd.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim());
    if (cells.some(c => c === date)) return true;
    if (cells.some(c => new RegExp(`^${short} Critic mandate`, 'i').test(c)))
      return true;
  }
  return false;
}

export interface FastLaneResult {
  date: string;
  mandates: Mandate[];
  unconvertedCritical: Mandate[];
  recurring: Mandate[];
  carry: string[];
  email: string | null;
}

export function fastLane(root: string, date: string): FastLaneResult {
  const cf = path.join(root, 'daily-briefs', `${date}-critic.md`);
  const mandates = fs.existsSync(cf)
    ? parseMandates(fs.readFileSync(cf, 'utf-8'))
    : [];
  const lp = path.join(root, 'system/Improvement_Ledger.md');
  const ledger = fs.existsSync(lp) ? fs.readFileSync(lp, 'utf-8') : '';
  const isConverted = converted(ledger, date);
  const unconvertedCritical = isConverted
    ? []
    : mandates.filter(m => m.critical);
  const recurring = mandates.filter(m => m.recurring);
  const carry = [
    ...unconvertedCritical.map(
      m =>
        `- **FAST-LANE ${date} · 🔴 CRITICAL MANDATE #${m.n} UNCONVERTED** — ${m.title.slice(0, 150)} · no ledger row cites ${date}. Conversion waits for Saturday; naming it does not.`
    ),
    ...recurring.map(
      m =>
        `- **FAST-LANE ${date} · 🚨 EMERGENCY — MANDATE #${m.n} RECURS** (${m.recurrenceNote}) — ${m.title.slice(0, 150)} · a repeat is evidence the first one was never RECEIVED, not merely unfinished.`
    ),
  ];
  const email =
    carry.length === 0
      ? null
      : `🔴 PIPELINE ALARM — ${unconvertedCritical.length} unconverted CRITICAL mandate(s)` +
        `${recurring.length ? ` and ${recurring.length} RECURRING (EMERGENCY)` : ''} from ${date}\n` +
        `   To: cosmictrex11@gmail.com\n` +
        carry.map(c => `   ${c}`).join('\n');
  return { date, mandates, unconvertedCritical, recurring, carry, email };
}

function main(): void {
  const argv = process.argv.slice(2);
  const root = process.cwd();

  if (argv.includes('--selftest')) {
    let pass = 0,
      fail = 0;
    const t = (n: string, ok: boolean) => {
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${n}`);
    };

    const m27 = parseMandates(
      fs.readFileSync(
        path.join(root, 'daily-briefs/2026-08-27-critic.md'),
        'utf-8'
      )
    );
    t(
      `[parse] the 08-27 Critic's MUST BE BETTER block parses to its 3 mandates — ${m27.length}`,
      m27.length === 3
    );
    t(
      '[parse] and each carries its RC rank off the heading',
      m27.every(m => m.rc !== null)
    );
    // MEASURED, not assumed: the 08-27 block is RC2 / RC2 / RC5. All three are UNCOVERED — no
    // ledger row cites 08-27 — but only two are CRITICAL, and that distinction is the whole design:
    // the fast lane exists to break the SILENCE on the urgent ones, not to move Saturday.
    t(
      `[parse] 08-27 is RC2/RC2/RC5 — 2 critical, 1 not, all three uncovered (${m27.map(m => '#' + m.n + ':RC' + m.rc).join(' ')})`,
      m27.filter(m => m.critical).length === 2 &&
        m27.some(m => m.rc === 5 && !m.critical)
    );
    t(
      '[parse] and the RC5 one is NOT promoted to the fast lane — a lane that carries everything is Saturday with extra steps',
      !m27.find(m => m.rc === 5)!.critical
    );

    // 🔴 THE RECURRENCE W4 EXPECTS. 08-28 mandate #1 says so in its own heading.
    const m28 = parseMandates(
      fs.readFileSync(
        path.join(root, 'daily-briefs/2026-08-28-critic.md'),
        'utf-8'
      )
    );
    const rec = m28.filter(m => m.recurring);
    t(
      `[W4] the 08-28 state carries EXACTLY ONE recurrence, and it is mandate #1 — ${rec.map(r => '#' + r.n).join(', ') || 'none'}`,
      rec.length === 1 && rec[0]!.n === 1
    );
    t(
      '[W4] and the recurrence is the intraday-for-close defect — the one E-INTRADAY-FOR-CLOSE-01 names',
      /INTRADAY MARKS WEARING SESSION VERBS/i.test(rec[0]!.title)
    );

    const fl = fastLane(root, '2026-08-28');
    t(
      '[W4] the leg FIRES on the 08-28 state',
      fl.carry.length > 0 && !!fl.email
    );
    t(
      '[W4] its email is addressed and says EMERGENCY for the recurrence',
      /cosmictrex11@gmail.com/.test(fl.email!) && /EMERGENCY/.test(fl.email!)
    );
    t(
      '[W4] and the CARRY line says WHY a repeat outranks an unfinished one — it was never received',
      fl.carry.some(c => /never RECEIVED/.test(c))
    );

    // SILENT on clean: a critic with no mandates, and one whose date the ledger already cites.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fastlane-'));
    fs.mkdirSync(path.join(tmp, 'daily-briefs'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'system'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'daily-briefs', '2026-01-01-critic.md'),
      '## VERDICT\nfine\n'
    );
    fs.writeFileSync(
      path.join(tmp, 'system/Improvement_Ledger.md'),
      '| IMP-1 | nothing |\n'
    );
    t(
      '[W4] SILENT on a Critic with no MUST BE BETTER block at all',
      fastLane(tmp, '2026-01-01').carry.length === 0
    );
    fs.writeFileSync(
      path.join(tmp, 'daily-briefs', '2026-01-02-critic.md'),
      '## MUST BE BETTER TOMORROW\n\n### 1. A THING WENT WRONG — RC2.\n\nbody\n'
    );
    t(
      '[W4] FIRES when a critical mandate has no ledger row citing its date',
      fastLane(tmp, '2026-01-02').unconvertedCritical.length === 1
    );
    fs.writeFileSync(
      path.join(tmp, 'system/Improvement_Ledger.md'),
      '| IMP-2 | 2026-01-02 | converted |\n'
    );
    t(
      '[W4] and goes SILENT once the ledger cites that date — the lane is about silence, not about the work being finished',
      fastLane(tmp, '2026-01-02').carry.length === 0
    );
    fs.writeFileSync(
      path.join(tmp, 'daily-briefs', '2026-01-03-critic.md'),
      '## MUST BE BETTER TOMORROW\n\n### 1. A THING WENT WRONG WITH NO RANK.\n\nbody\n'
    );
    t(
      '[W4] an UNRANKED mandate is treated as CRITICAL — defaulting it downward is how the quiet ones stay quiet',
      parseMandates(
        fs.readFileSync(
          path.join(tmp, 'daily-briefs', '2026-01-03-critic.md'),
          'utf-8'
        )
      )[0]!.critical
    );

    console.log(
      `\n${fail ? '❌' : '✅'} mandate-fastlane --selftest: ${pass}/${pass + fail} assertions passed.`
    );
    process.exit(fail ? 1 : 0);
  }

  const date =
    argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
    new Date().toISOString().slice(0, 10);
  const r = fastLane(root, date);
  console.log(
    `mandate-fastlane ${date} — ${r.mandates.length} mandate(s), ${r.unconvertedCritical.length} unconverted CRITICAL, ${r.recurring.length} RECURRING`
  );
  if (!r.carry.length) {
    console.log(
      '✅ nothing owed a same-morning line — conversion may wait for Saturday.'
    );
    process.exit(0);
  }
  for (const c of r.carry) console.log(c);
  console.log(`\n📧 SEND NOW:\n${r.email}`);
  console.log(
    `\n   Append the CARRY line(s) to system/CARRY.md this morning. Conversion still waits for Saturday; silence never does.`
  );
  process.exit(argv.includes('--red') ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('mandate-fastlane')) main();
