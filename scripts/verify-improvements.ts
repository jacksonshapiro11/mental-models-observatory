#!/usr/bin/env node --experimental-strip-types
/**
 * verify-improvements.ts — mechanical proof that improvements are REAL.
 *
 * Reads system/Improvement_Ledger.md and, for every row: verifies target files
 * exist, executes the named mechanical check (grep: substring present · run:
 * command exits 0), and enforces the acceptance gate (Critical/High rows need a
 * check — warn young, FAIL at 30+ days per the code-or-close rule).
 *
 * Why (Jackson's memo, 2026-07-06): the loop graded its own homework — "Applied ✅"
 * in prose, ~0% behavior change on Writer-only rules, escalations re-prescribed
 * weekly for 70+ days. This script is the exit code the loop never had. The system
 * improves when failures become exit codes; it stalls when they become paragraphs.
 *
 * Usage: npx tsx scripts/verify-improvements.ts [--ledger <path>]
 * Exit: 0 all rows verified · 1 any failure · 2 usage/parse error
 * Wired into: pipeline-health-check (daily) and the improve-and-apply task (self-check).
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

interface Row {
  id: string;
  date: string;
  source: string;
  rc: string;
  sev: string;
  summary: string;
  targets: string[];
  check: string;
  applied: string;
  verified: string;
  behavior: string;
  recur: string;
}

const AGE_FUSE_DAYS = 30; // check=none on High: WARN until this age, FAIL after.

/**
 * 🔴 STARVATION — A CRITICAL ROW MAY NOT BE DEFERRED FOR BUDGET TWICE (IMP-223, 2026-08-26 Critic
 * mandate #2b, RC7).
 *
 * The 30-day fuse is the right budget for a HIGH row and it is an amnesty for a CRITICAL one. On
 * the morning of 2026-08-26 the registry printed SEVEN Critical rows carrying `NO mechanical check`
 * — IMP-215 through IMP-220 (six Critic mandates from 08-23 and 08-24, every one deferred for
 * budget on the day it was logged) and ESC-020 (the Editor's sixth consecutive night of producing
 * nothing) — and exited **0 on all of them**, because none had yet aged 30 days. The defect ESC-020
 * describes shipped to readers that same morning: an unedited v1.5 stamped v2.
 *
 * A severity label that changes nothing about how long a row may sit is decoration. Critical now
 * means what the word means: TWO DAYS to a code gate, an Editor REJECT gate, or an explicit
 * WONT-FIX-VIA-PROSE closure. Past that the row is named STARVED, individually, and the registry
 * exits non-zero — the same treatment a broken gate gets, because an unfixed Critical and a broken
 * fix are the same thing to the reader. High and Medium keep the budget rule; they are what the
 * budget rule is FOR.
 */
export const CRITICAL_STARVE_DAYS = 2;
export type NoCheckVerdict = 'exempt' | 'warn' | 'STARVED' | 'FUSE-BLOWN';

/** The acceptance gate's verdict for a row carrying no mechanical check. Pure, so it is testable. */
export function noCheckVerdict(sev: string, closed: boolean, age: number): NoCheckVerdict {
  if (closed) return 'exempt';
  if (/^Critical$/i.test(sev.trim())) return age >= CRITICAL_STARVE_DAYS ? 'STARVED' : 'warn';
  if (/^High$/i.test(sev.trim())) return age >= AGE_FUSE_DAYS ? 'FUSE-BLOWN' : 'warn';
  return 'exempt';
}

function parseLedger(md: string): Row[] {
  const rows: Row[] = [];
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').map(c => c.trim());
    // | id | date | source | rc | sev | summary | targets | check | applied | verified | behavior | recur |
    if (cells.length < 13) continue;
    const id = cells[1]!;
    if (!/^(IMP|ESC)-\d+/.test(id)) continue; // skips header + divider
    rows.push({
      id,
      date: cells[2]!,
      source: cells[3]!,
      rc: cells[4]!,
      sev: cells[5]!,
      summary: cells[6]!,
      targets: cells[7]!
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== 'scripts/'),
      check: cells[8]!,
      applied: cells[9]!,
      verified: cells[10]!,
      behavior: cells[11]!,
      recur: cells[12]!,
    });
  }
  return rows;
}

/**
 * IS THIS ROW CLOSED? — IMP-140 (2026-08-07, RC7). The exemption predicate used to be
 * `/CLOSED/i.test(behavior)`, a bare substring match on a free-prose cell. Two ways that
 * silently let a row out of the acceptance gate and its 30-day code-or-close fuse:
 *
 *   "…flips Y when an AI&T segment figure ships as a **disCLOSED** single qualifier"  (IMP-083)
 *   "…OPEN escalation, deliberately **not closed**; carry-forward Critical"           (ESC-013)
 *
 * The second one is the alarming shape: a row can declare itself OPEN in plain English and
 * be read as CLOSED by the machine — so the louder and more honest the prose, the likelier
 * the exemption. Found today by writing exactly that sentence and noticing the registry
 * reported `0 warn` when it owed one.
 *
 * Closure is now a DECLARATION, not a word that appears somewhere: the cell must OPEN with
 * an explicit closure token (optionally behind markdown emphasis or a `Y —` grade). Prose
 * that merely mentions closing no longer closes anything.
 */
const CLOSED_RE = /^\W*(?:Y\s*[—–-]\s*)?(?:CLOSED\b|WONT-FIX-VIA-PROSE\b)/i;
export function isClosed(behavior: string): boolean {
  return CLOSED_RE.test(behavior.trim());
}

function ageDays(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
}

/**
 * ANCHOR FORENSICS — IMP-129 (2026-08-04, RC7). "Enforcement ABSENT" is two completely
 * different events wearing one message, and the fix for each is the opposite of the other:
 *
 *   REVERT      — the enforcement was lost (nightly rebase, a bad merge, a `git clean`).
 *                 The fix is to RESTORE THE CODE. Re-pointing the ledger row would launder
 *                 a real regression into a green registry.
 *   SUPERSESSION— the enforcement was deliberately replaced by something stronger, and the
 *                 row's anchor is now stale. The fix is to RE-POINT THE ROW at the surviving
 *                 enforcement. Restoring the old code would resurrect a retired gate.
 *
 * On 2026-08-04 all three RED rows were supersessions and every one of them LOOKED like a
 * revert: IMP-125's "BULLET LENGTH ADVISORY" was deleted by be7fdf0 ("delete the blind
 * bullet-ceiling duplicate") after a stronger whole-brief length rail replaced it; IMP-041's
 * and IMP-019's enforcement moved when `.claude/skills/publish-brief/scripts/publish.py`
 * became a 643-byte shim pointing at the newly TRACKED `scripts/publish-brief.py`. A session
 * that re-points on reflex is one bad night away from doing the same to a genuine revert.
 *
 * So the tool hands over the receipt instead of relying on the next session knowing the
 * protocol: on any absent anchor, print the commit that removed it. `git log -S` answers
 * "was this ever here, and what took it out" in one line, and the answer decides the fix.
 *
 * ── SHALLOW-HISTORY CORRECTION — IMP-130 (2026-08-06, RC7) ─────────────────────────────────────
 * `git log -S` cannot see past a shallow clone's grafted boundary, and it reports that the same
 * way it reports a string no commit ever added: silence, exit 0. The original function read that
 * silence as NEVER-LANDED. In THIS sandbox the checkout is shallow (13 commits) — so the receipt
 * IMP-129 exists to provide was, on 2026-08-06, a confidently wrong one: it would have told a
 * session to treat a genuine revert as an enforcement that never landed, which is the exact
 * mis-classification IMP-129 was built to prevent, wearing the badge of a receipt. THREE outcomes,
 * not two: NAMED (a commit removed it) · TRUNCATED (history cannot answer — refuse to classify)
 * · NEVER-LANDED (full history, no commit ever added it). "I cannot tell" is a legitimate verdict
 * and is strictly better than a fabricated one.
 */
type GitResult = { status: number | null; out: string; err: string };
type GitRunner = (args: string[], cwd?: string) => GitResult;

function gitStdout(args: string[], cwd?: string): GitResult {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: 30000,
    ...(cwd ? { cwd } : {}),
  });
  return {
    status: res.status,
    out: (res.stdout || '').trim(),
    err: (res.error?.message || res.stderr || '').trim(),
  };
}

export function anchorForensics(
  file: string,
  needle: string,
  cwd?: string,
  run: GitRunner = gitStdout
): string {
  const { status, out, err } = run(
    ['log', '--oneline', '-S', needle, '--', file],
    cwd
  );
  const lines = out.split('\n').filter(Boolean);
  if (status === 0 && lines.length > 0) {
    return `\n      FORENSICS: last commit touching this string in ${file} → ${lines[0]}\n      Classify before you act: REVERT (restore the code) or SUPERSESSION (re-point the row at the enforcement that replaced it, and prove the behaviour survives with a run: leg). Re-pointing a REVERT is how a regression turns green.`;
  }
  if (status !== 0) {
    return `\n      FORENSICS: GIT ERROR — \`git log -S\` could not inspect ${file} (exit ${status ?? 'unknown'}${err ? `: ${err.split('\n').slice(-1)[0]}` : ''}). This is NOT evidence of NEVER-LANDED. Restore repository/history access and re-run before classifying the missing enforcement.`;
  }
  const shallow = run(['rev-parse', '--is-shallow-repository'], cwd);
  if (shallow.status !== 0) {
    return `\n      FORENSICS: GIT ERROR — repository depth could not be determined for ${file} (exit ${shallow.status ?? 'unknown'}${shallow.err ? `: ${shallow.err.split('\n').slice(-1)[0]}` : ''}). This is NOT evidence of NEVER-LANDED. Restore repository access and re-run.`;
  }
  if (shallow.out === 'true') {
    const depth = run(['rev-list', '--count', 'HEAD'], cwd).out || '?';
    return `\n      FORENSICS: HISTORY TRUNCATED — this checkout is a SHALLOW clone (${depth} commits), so \`git log -S\` cannot see whether ${file} ever contained this string. This is NOT evidence of NEVER-LANDED and must NOT be classified as one. Run \`git fetch --unshallow\` and re-run before deciding REVERT vs SUPERSESSION; until then the correct verdict is "cannot tell".`;
  }
  return `\n      FORENSICS: git log -S finds NO commit that ever added this string to ${file}, in a FULL (non-shallow) history. Either the enforcement never landed, or it lives in a gitignored path. Treat as NEVER-LANDED, not as a revert.`;
}

// ── IMP-142 (2026-08-08 Critic mandate #2b, RC3): MANDATE COVERAGE ───────────────────────────
// THE FAILURE: the 08-07 Critic issued three mandates. #1 and #3 shipped as IMP-137/IMP-138.
// #2 produced NO code, NO ledger row and NO deferral record — it simply evaporated, and the
// defect it targeted shipped the next night as a top-slot C. The registry could not see it:
// every check it ran was on rows that EXIST, so a mandate with no row is invisible by
// construction. As the 08-08 Critic put it: **a mandate that disappears silently is worse than
// one that fails, because failure is visible.**
//
// The fix is an ABSENCE check, the kind this file previously had none of: enumerate the
// mandates the Critic actually issued, and require each to be discharged by a row — APPLIED
// (a row referencing it) or DEFERRED (a row whose `applied` cell says so, per the new
// MANDATE-DEFERRAL rule in system/Apply_Improvements.md). Anything else is UNCOVERED and RED.
//
// WHY IT GRADES YESTERDAY, NOT TODAY: the Critic for date D is written the evening of D-1; the
// session that discharges it runs 10:03 on D. pipeline-health-check runs BEFORE that. Grading
// the freshest critic would paint the registry red every single morning for a cycle that has
// not had its turn yet — a false-positive storm, and the fastest way to make a gate ignored.
// So this grades the most recent critic dated STRICTLY BEFORE today: one fully elapsed cycle.

/**
 * Mandate numbers under the Critic's MUST BE BETTER TOMORROW heading.
 *
 * IMP-212 (2026-08-25, RC7) -- THE PARSER WENT BLIND WHEN THE CRITIC CHANGED ITS OWN HEADING
 * STYLE, AND A ZERO-PARSE WAS A PASS. Receipt: `daily-briefs/2026-08-24-critic.md:430` carries
 * `## MUST BE BETTER TOMORROW` followed by `### 1.` / `### 2.` / `### 3.`; the 08-22 critic used
 * `**1.` and parsed fine. The old body did TWO things wrong on the heading form, and either one
 * alone was fatal: (a) `^#{1,3}\s+\w` treated `### 1.` as "the next top-level section" and BROKE
 * the scan on the first mandate, and (b) `^\*\*(\d+)` cannot match a heading anyway. So the
 * registry printed `none parsed` and exited 0 while SIX Critical mandates (08-23 #1-3, 08-24
 * #1-3) went undischarged across two dead sessions. `system/Brief_Critic.md:303` specifies a
 * THIRD form -- a bare `1.` -- which neither the old nor the drifted form matches.
 *
 * So: accept all three surface forms, and treat a NUMBERED heading as a mandate rather than as
 * the section terminator. The contiguous-run clamp below is the Goodhart brake -- widening the
 * match widens the false-positive surface, and a PHANTOM mandate is undischargeable by
 * construction, which would red the registry forever and teach the next session to skim it.
 */
export function parseMandates(criticMd: string): number[] {
  const lines = criticMd.split('\n');
  // The 08-07 report carries the heading TWICE; the mandates follow the LAST one.
  let start = -1;
  lines.forEach((l, i) => {
    if (/^#{1,6}\s*MUST BE BETTER TOMORROW\s*$/i.test(l.trim())) start = i;
  });
  if (start === -1) return [];
  const nums = new Set<number>();
  for (const l of lines.slice(start + 1)) {
    const heading = l.match(/^(#{1,3})\s+(.*)$/);
    // A top-level heading ends the block -- UNLESS it is itself a numbered mandate (`### 1.`).
    if (heading && !/^\**\s*\d+\s*[.)]/.test(heading[2]!)) break;
    // `### 1.` | `**1.` | `1.` -- anchored at column 0, so INDENTED sub-lists never match.
    const m = l.match(/^(?:#{1,6}\s+)?(?:\*\*)?(\d+)\s*[.)]/);
    if (m) nums.add(parseInt(m[1]!, 10));
  }
  // CONTIGUOUS-RUN CLAMP: mandates are #1..#N. Take the run from 1 and stop at the first gap, so
  // a stray unindented `5.` in a fix description cannot invent a mandate nobody can ever cover.
  const out: number[] = [];
  for (let n = 1; nums.has(n); n++) out.push(n);
  return out;
}

export interface Coverage {
  applied: number[];
  deferred: number[];
  uncovered: number[];
}

/** Which of `mandates` (issued by the {MM-DD} critic) has a ledger row discharging it? */
export function mandateCoverage(
  rows: Row[],
  criticDate: string,
  mandates: number[]
): Coverage {
  const mmdd = criticDate.slice(5); // 2026-08-07 → 08-07
  const out: Coverage = { applied: [], deferred: [], uncovered: [] };
  for (const n of mandates) {
    // The established citation form, already used by 20+ rows: "(08-07 Critic mandate #3, 🔴)".
    // Sub-lettered mandates (#1a/#1b) discharge the parent number.
    const re = new RegExp(
      `${mmdd}\\s+Critic\\s+mandate\\s+#${n}(?![0-9])`,
      'i'
    );
    // MANDATE-CITATION-CELLS (IMP-195, 2026-08-19, RC7). SEARCH `source` AND `summary`.
    //
    // THE FAILURE THIS FIXES IS A FALSE RED, WHICH IS THE MOST EXPENSIVE KIND OF GATE BUG.
    // v1 read `r.summary` only, because the 20+ rows that existed when IMP-142 was written all
    // carried the citation parenthetically inside the summary prose. On 2026-08-18 the session
    // put the citation in the column literally named `source` — "08-18 Critic mandate #1 (leg a)"
    // — which is the semantically CORRECT home, and all four rows (IMP-190/191/192/193) landed
    // with working code, both-direction tests, and the 08-19 Critic's own certification:
    // "MANDATE TRACE 3/3 LANDED with mechanical checks and both-direction tests, best landing
    // night in window." verify-improvements nonetheless printed "0 applied · 0 deferred ·
    // 3 uncovered" and exited 1, on the best mandate night in the tracked window.
    //
    // A registry that reds on work that DID land teaches the next session to skim it — the exact
    // lesson the CARRY/TREE rule paid for on 2026-08-13, when a bare `git status --porcelain`
    // manufactured "three nights of PUBLISHED content exist ONLY in this working tree" for four
    // consecutive tasks while all six files sat on origin/main the whole time. The 08-14 Critic
    // called the resulting RED "the largest single risk in the repository tonight" — not because
    // the risk was real, but because a nightly false alarm is how a real one gets missed.
    //
    // This does NOT loosen the requirement. A citation is still mandatory, still day-scoped
    // (a row citing 08-06's #1 does not discharge 08-07's), and still exact on the number
    // (#10 does not satisfy #1). Only the CELL it may live in widens, from one to two.
    const hit = rows.filter(r => re.test(r.summary) || re.test(r.source));
    if (!hit.length) {
      out.uncovered.push(n);
      continue;
    }
    if (hit.every(r => /deferred/i.test(r.applied))) out.deferred.push(n);
    else out.applied.push(n);
  }
  return out;
}

/** The most recent critic report for a FULLY ELAPSED improvement cycle (date < today). */
export function latestElapsedCritic(
  dbDir: string,
  today: string
): string | null {
  if (!fs.existsSync(dbDir)) return null;
  const dates = fs
    .readdirSync(dbDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}-critic\.md$/.test(f)) // never the -light-critic siblings
    .map(f => f.slice(0, 10))
    .filter(d => d < today)
    .sort();
  return dates.length ? dates[dates.length - 1]! : null;
}

/**
 * IMP-213 (2026-08-25, RC7) -- EVERY critic of a fully elapsed cycle inside the window, oldest
 * first. THE ONE-DAY WINDOW WAS A ONE-DAY AMNESTY: `latestElapsedCritic` grades exactly one
 * report, so a session that dies takes its whole day's mandates out of scope permanently the
 * moment the calendar turns. Receipt: the 08-23 critic's three mandates were PARSEABLE (`**1.`
 * form) and were never graded, because the 08-24 session wrote a canary and vanished, and by
 * 08-25 the window had moved past them. Debt now stays visible for MANDATE_WINDOW_DAYS.
 */
export const MANDATE_WINDOW_DAYS = 7;

export function elapsedCriticsInWindow(
  dbDir: string,
  today: string,
  days: number = MANDATE_WINDOW_DAYS
): string[] {
  if (!fs.existsSync(dbDir)) return [];
  const floor = new Date(Date.parse(today + 'T00:00:00Z') - days * 86400000)
    .toISOString()
    .slice(0, 10);
  return fs
    .readdirSync(dbDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}-critic\.md$/.test(f)) // never the -light-critic siblings
    .map(f => f.slice(0, 10))
    .filter(d => d < today && d >= floor)
    .sort();
}

/**
 * WORLD-STATE MARKER — a `world:` leg's failure string carries this prefix so main() can route
 * it to the WARN list instead of the FAIL list. Deliberately a sentinel rather than a second
 * return channel: `executeCheck` is called from three places and a signature change would have
 * been a bigger blast radius than the fix. See the `world:` block in runLeg for the full receipt.
 */
const WORLD_MARK = ' WORLD ';

/** Run ONE check leg. Returns null on pass, an error string on fail. */
function runLeg(leg: string, id: string): string | null {
  leg = leg.trim();
  if (leg.startsWith('grep:')) {
    const rest = leg.slice(5);
    const colon = rest.indexOf(':');
    if (colon === -1) return `${id}: malformed grep check: ${leg}`;
    const file = rest.slice(0, colon).trim();
    const needle = rest.slice(colon + 1).trim();
    const fp = path.join(process.cwd(), file);
    if (!fs.existsSync(fp)) return `${id}: grep target missing: ${file}`;
    if (!fs.readFileSync(fp, 'utf8').includes(needle)) {
      return (
        `${id}: enforcement text ABSENT — "${needle}" not found in ${file} (the improvement was reverted or never landed)` +
        anchorForensics(file, needle)
      );
    }
    return null;
  }
  // gitshow:<path>:<needle> — proves the pattern exists in the COMMITTED tree at HEAD,
  // not merely in the working tree. Catches the b3512c2 class: a commit that deletes an
  // enforcement while the working tree still looks fine (or the reverse — a claim that
  // "exists on disk" after an uncommitted edit that the nightly rebase will wipe).
  // Added 2026-07-31 — closes the "reverted after commit" / "never committed" blind spot
  // that let IMP-102's --stamp, ESC-009's pool, and IMP-108's strict gate sit as ledger
  // theater while the committed tree had none of them.
  if (leg.startsWith('gitshow:')) {
    const rest = leg.slice('gitshow:'.length);
    const colon = rest.indexOf(':');
    if (colon === -1) return `${id}: malformed gitshow check: ${leg}`;
    const file = rest.slice(0, colon).trim();
    const needle = rest.slice(colon + 1).trim();
    if (!file || !needle) return `${id}: malformed gitshow check: ${leg}`;
    const res = spawnSync('git', ['show', `HEAD:${file}`], {
      encoding: 'utf8',
      timeout: 30000,
    });
    if (res.status !== 0) {
      return `${id}: gitshow target missing from HEAD: ${file}\n      ${(res.stderr || '').trim().split('\n').slice(-2).join('\n      ')}`;
    }
    if (!(res.stdout || '').includes(needle)) {
      return (
        `${id}: enforcement ABSENT from committed tree — "${needle}" not in HEAD:${file} (working tree may still have it; nightly rebase will not)` +
        anchorForensics(file, needle)
      );
    }
    return null;
  }
  if (leg.startsWith('run:')) {
    const cmd = leg.slice(4).trim();
    const res = spawnSync(cmd, {
      shell: true,
      encoding: 'utf8',
      timeout: 120000,
    });
    if (res.status !== 0) {
      return `${id}: gate FAILED (exit ${res.status}): ${cmd}\n      ${(res.stderr || res.stdout || '').trim().split('\n').slice(-3).join('\n      ')}`;
    }
    return null;
  }
  // ── WORLD-STATE LEG (added 2026-08-22 — IMP-211, RC7) ─────────────────────────────────────
  // WORLD-STATE IS NOT A CODE FACT. `run:` answers "is this improvement mechanically real?"
  // A non-zero exit there means the enforcement is broken or gone, and the registry is right to
  // go RED and block. `world:` answers a DIFFERENT question — "is the record this gate guards
  // currently in contract?" — whose answer changes with the calendar, with which producer ran,
  // and with what a human wrote at 09:36 this morning. Both questions are worth asking daily.
  // Only the first one is evidence about the improvement.
  //
  // WORKED FAILURE, 2026-08-22 (the fifth instance of one class and the reason this exists):
  // this session's baseline read `4 FAIL`. Three of them — IMP-183, IMP-200, IMP-201 — were the
  // SAME leg, `run:npx tsx scripts/whatchanged-freshness.ts $(date +%F)`, and the gate was
  // RIGHT: `system-update` ran on 08-21, reported SUCCESS, named Current_Worldview_v5.md in its
  // status line, updated the file's "Last updated" stamp and wrote its Daily Big Story Review —
  // and never wrote the `**August 21, 2026:**` WHAT CHANGED TODAY entry. A real, open, unowned
  // record delinquency. It surfaced as "a logged improvement is not mechanically real", against
  // three rows whose code was untouched and working, under a banner that says do not log new
  // improvements on top of broken ones. THE ALARM WAS REAL AND EVERY WORD OF ITS FRAMING WAS
  // FALSE. The class is documented four times already — IMP-195 (a parser reading one cell
  // reported three LANDED mandates UNCOVERED), IMP-200 (a `run:` leg pinned to a literal date
  // reddened precisely when the record went current), IMP-201 (a freshness deadline of midnight
  // against a producer deadline of 09:36 ET), CARRY/TREE 2026-08-13 (a bare `git status` calling
  // published-and-live briefs untracked for four consecutive tasks) — and the cost is never the
  // false alarm itself; it is that the next REAL red gets skimmed.
  //
  // NOTHING IS SILENCED. A failing `world:` leg prints EVERY day, names the row, and carries the
  // gate's own output — it moves from the FAIL list to the WARN list, which is where a condition
  // no code change can fix belongs. `pipeline-health-check` is warn-only by design, so no
  // blocking behaviour is lost; what is gained is that a RED once again means exactly one thing.
  if (leg.startsWith('world:')) {
    const cmd = leg.slice('world:'.length).trim();
    const res = spawnSync(cmd, { shell: true, encoding: 'utf8', timeout: 120000 });
    if (res.status !== 0) {
      return (
        `${WORLD_MARK}${id}: WORLD-STATE OUT OF CONTRACT (exit ${res.status}): ${cmd}\n      ` +
        `${(res.stderr || res.stdout || '').trim().split('\n').slice(-3).join('\n      ')}\n      ` +
        `(the improvement's own code legs passed — this is the RECORD, not the GATE. Fix the record or escalate its owner.)`
      );
    }
    return null;
  }
  return `${id}: unknown check type: ${leg} (use grep:<file>:<substring> or gitshow:<file>:<substring> or run:<command> or world:<command> or none)`;
}

/**
 * A row's check may be a COMPOUND of legs joined by ` && ` — ALL must pass.
 *
 * This is the fix for the 2026-07-31 "GREEN BUT GONE" blind spot (RC7). On 07-29 the
 * nightly `pull --rebase origin main` reverted UNCOMMITTED working-tree edits to already-
 * tracked scripts (ceiling-lint.ts lost cc-deal-magnitude/model-canonical-example/
 * cc-pricing-rung; fact-gate.ts lost stockMoveReactionFindings) — four "verified ✅"
 * improvements silently vanished — yet this gate stayed GREEN because a `run:…--selftest`
 * check only asserted exit 0, and the shrunken selftest (17→11 assertions) still exits 0.
 * A code improvement now carries BOTH `run:<selftest>` (proves it still WORKS) AND
 * `grep:<file>:<check-name>` (proves the specific enforcement is STILL ON DISK). A silent
 * revert now turns the registry RED on the grep leg instead of hiding behind exit 0.
 */
function executeCheck(check: string, id: string): string[] {
  const legs = check
    .split(/\s+&&\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const fails: string[] = [];
  for (const leg of legs) {
    const f = runLeg(leg, id);
    if (f) fails.push(f);
  }
  return fails;
}

function main(): number {
  const argIdx = process.argv.indexOf('--ledger');
  const ledgerPath =
    argIdx > -1 && process.argv[argIdx + 1]
      ? process.argv[argIdx + 1]!
      : path.join(process.cwd(), 'system/Improvement_Ledger.md');
  if (!fs.existsSync(ledgerPath)) {
    console.error(`FAIL: ledger not found: ${ledgerPath}`);
    return 2;
  }

  const rows = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
  if (rows.length === 0) {
    console.error('FAIL: ledger parsed to zero rows — schema drift?');
    return 2;
  }

  const fails: string[] = [];
  const warns: string[] = [];
  let verified = 0;

  for (const r of rows) {
    const closed = isClosed(r.behavior);

    // 1. Target files exist (skip directory-ish / empty targets).
    for (const target of r.targets) {
      if (!target.includes('.')) continue;
      if (!fs.existsSync(path.join(process.cwd(), target))) {
        fails.push(`${r.id}: target file missing: ${target}`);
      }
    }

    // 2. The acceptance gate: Critical/High without a mechanical check.
    if (r.check === 'none' || r.check === '') {
      const age = ageDays(r.date);
      const verdict = noCheckVerdict(r.sev, closed, age);
      if (verdict !== 'exempt') {
        const msg = `${r.id} [${r.sev}] has NO mechanical check (age ${age}d): "${r.summary.slice(0, 80)}" — convert to a code gate or close WONT-FIX-VIA-PROSE`;
        if (verdict === 'STARVED')
          fails.push(
            `STARVED — ${msg} — a CRITICAL row may not be deferred for budget past ` +
              `${CRITICAL_STARVE_DAYS} days (IMP-223). Ship its gate, downgrade it with a reason, or close it.`
          );
        else if (verdict === 'FUSE-BLOWN')
          fails.push(msg + ` — ${AGE_FUSE_DAYS}d fuse blown, this now BLOCKS`);
        else warns.push(msg);
      }
      continue;
    }

    // 3. Execute the check (compound-aware; ALL ` && `-joined legs must pass).
    //    IMP-211: `world:` legs report the state of a RECORD, not the reality of the CODE. They
    //    are printed every run, but as warnings — a row whose code legs all pass is a row whose
    //    improvement IS mechanically real, and calling it otherwise is what teaches the next
    //    session to skim the registry.
    const checkFails = executeCheck(r.check, r.id);
    const hard = checkFails.filter(f => !f.startsWith(WORLD_MARK));
    const world = checkFails
      .filter(f => f.startsWith(WORLD_MARK))
      .map(f => f.slice(WORLD_MARK.length));
    warns.push(...world);
    if (hard.length) fails.push(...hard);
    else verified++;
  }

  // 3b. IMP-142: MANDATE COVERAGE — the absence check. A Critic mandate with no row at all is
  //     the one failure mode every check above is blind to, because they all grade rows.
  const dbDir = path.join(process.cwd(), 'daily-briefs');
  const today = new Date().toISOString().slice(0, 10);
  //     IMP-213: graded across a 7-DAY window, not one report. A one-day window is a one-day
  //     amnesty — a dead session takes its mandates permanently out of scope when the date rolls.
  const criticDates = elapsedCriticsInWindow(dbDir, today);
  const covLines: string[] = [];
  for (const criticDate of criticDates) {
    const criticMd = fs.readFileSync(
      path.join(dbDir, `${criticDate}-critic.md`),
      'utf8'
    );
    const mandates = parseMandates(criticMd);
    if (mandates.length) {
      const cov = mandateCoverage(rows, criticDate, mandates);
      covLines.push(
        `    ${criticDate}: ${cov.applied.length} applied · ${cov.deferred.length} deferred · ${cov.uncovered.length} uncovered`
      );
      for (const n of cov.uncovered) {
        fails.push(
          `MANDATE #${n} of the ${criticDate} Critic is UNCOVERED — no ledger row cites "${criticDate.slice(5)} Critic mandate #${n}" and none is marked deferred. ` +
            `A mandate that disappears silently is worse than one that fails, because failure is visible (08-08 receipt: the 08-07 mandate #2 vanished, and the defect it targeted shipped the next night as a top-slot C). ` +
            `Apply it, or log an IMP row whose applied cell reads "deferred" with the reason and carry-forward date — per the MANDATE-DEFERRAL rule in system/Apply_Improvements.md.`
        );
      }
    } else {
      //  IMP-212: A ZERO-PARSE IS AN OUTAGE OF THIS CHECK, NOT AN ABSENCE OF MANDATES, AND IT
      //  USED TO BE A PASS. On 2026-08-25 the registry printed `none parsed` and exited 0 while
      //  six Critical mandates sat undischarged. An unreadable mandate block now FAILS: the
      //  Critic is REQUIRED to emit three (Brief_Critic Phase 6 item 15), so zero is never a
      //  legitimate reading of a healthy report.
      const hasHeading = /^#{1,6}\s*MUST BE BETTER TOMORROW\s*$/im.test(criticMd);
      covLines.push(`    ${criticDate}: 0 parsed — UNREADABLE MANDATE BLOCK`);
      fails.push(
        `MANDATE BLOCK UNREADABLE in daily-briefs/${criticDate}-critic.md — ${
          hasHeading
            ? 'the MUST BE BETTER TOMORROW heading is present but no mandate could be parsed under it'
            : 'the mandatory MUST BE BETTER TOMORROW heading is ABSENT'
        }. This check grades mandates; zero parsed means it graded NOTHING, which is an OUTAGE of the check and not a clean day. ` +
          `Receipt for why this is now RED: on 2026-08-25 this line read "none parsed" and the run exited 0 while the 08-23 and 08-24 Critics' six Critical mandates went undischarged across two sessions that wrote a canary and vanished. ` +
          `Fix the Critic's mandate block to one of the three accepted forms (\`### N.\` | \`**N.\` | \`N.\` at column 0, numbered from 1) per system/Brief_Critic.md Phase 6 item 15 — do NOT silence this by narrowing the window.`
      );
    }
  }
  const coverageLine = criticDates.length
    ? `  mandates (${criticDates.length} elapsed critic(s), ${MANDATE_WINDOW_DAYS}d window):\n` +
      covLines.join('\n')
    : '';

  // 4. The theater report — behavior counts (informational, the accountability view).
  const counts = {
    rows: rows.length,
    behaviorY: rows.filter(r => /^Y/i.test(r.behavior)).length,
    pending: rows.filter(r => /pending/i.test(r.behavior)).length,
    recurred: rows.filter(
      r => parseInt(r.recur || '0', 10) > 0 && !/CLOSED/i.test(r.behavior)
    ).length,
    closedByCode: rows.filter(r => /CLOSED-BY-CODE/i.test(r.behavior)).length,
  };

  console.log(
    `verify-improvements — ${rows.length} rows · ${verified} checks passed · ${fails.length} FAIL · ${warns.length} warn`
  );
  console.log(
    `  behavior: ${counts.behaviorY} changed · ${counts.pending} pending · ${counts.recurred} recurred-open (theater candidates) · ${counts.closedByCode} closed-by-code`
  );
  if (coverageLine) console.log(coverageLine);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  if (fails.length) {
    console.error(
      '\n✗ IMPROVEMENT VERIFICATION FAILED — a logged improvement is not mechanically real. Fix the enforcement or the ledger row; do not log new improvements on top of broken ones.'
    );
    return 1;
  }
  console.log('\n✓ All ledger improvements mechanically verified.');
  return 0;
}

/** Proves the compound-check logic bites BOTH directions — non-circular (it exercises
 *  executeCheck against crafted legs, not the live ledger). IMP-110's mechanical check. */
function selftest(): number {
  const self = 'scripts/verify-improvements.ts';
  // Build the ABSENT needle at RUNTIME so it never appears as a source literal in this file
  // (a literal would make its own grep leg pass — the bug the first cut of this selftest hit).
  const absent = [
    'zz',
    Math.random().toString(36).slice(2),
    Date.now().toString(36),
    'zz',
  ].join('_');
  const cases: [string, string, boolean][] = [
    [`grep:${self}:AGE_FUSE_DAYS`, 'grep leg PASSES on a present string', true],
    [
      `grep:${self}:${absent}`,
      'grep leg FAILS on an absent string (revert catch)',
      false,
    ],
    ['run:true', 'run leg PASSES on exit 0', true],
    ['run:false', 'run leg FAILS on exit 1', false],
    [
      `run:true && grep:${self}:AGE_FUSE_DAYS`,
      'compound PASSES when ALL legs pass',
      true,
    ],
    [
      `run:true && grep:${self}:${absent}`,
      'compound FAILS when the grep-anchor is gone (the green-but-gone catch)',
      false,
    ],
    [
      `grep:${self}:AGE_FUSE_DAYS && run:false`,
      'compound FAILS when the run leg fails',
      false,
    ],
    // gitshow: proves the pattern is on HEAD (committed tree), not just the working tree.
    // AGE_FUSE_DAYS has been on HEAD since before this edit; an absent needle must fail.
    [
      `gitshow:${self}:AGE_FUSE_DAYS`,
      'gitshow leg PASSES when needle is on HEAD',
      true,
    ],
    [
      `gitshow:${self}:${absent}`,
      'gitshow leg FAILS when needle is absent from HEAD',
      false,
    ],
    // ── IMP-211: WORLD-STATE LEGS ────────────────────────────────────────────────────────────
    // Both directions of the leg ITSELF live here; the routing (warn, not fail) is asserted
    // separately below, because a leg that merely "returns a string" would satisfy this pair
    // while still blocking the registry — which is the entire defect being fixed.
    ['world:true', 'world leg PASSES on exit 0 (record in contract)', true],
    [
      'world:false',
      'world leg REPORTS on exit 1 — the alarm is not silenced, only reclassified',
      false,
    ],
    [
      `gitshow:scripts/does-not-exist-zz.ts:anything`,
      'gitshow leg FAILS when path is absent from HEAD',
      false,
    ],
  ];
  let fails = 0;
  for (const [check, label, expectPass] of cases) {
    const got = executeCheck(check, 'SELFTEST').length === 0;
    const ok = got === expectPass;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  }
  // IMP-129 — an absent anchor must arrive WITH its forensics, so the next session classifies
  // revert-vs-supersession from a receipt instead of from a hunch. Both directions.
  //
  // IMP-130 (2026-08-06) — THESE ASSERTIONS ARE NOW HERMETIC. The previous version asserted
  // against the LIVE repository (`git log -S "BULLET LENGTH ADVISORY" -- scripts/validate-brief.ts`,
  // expecting commit be7fdf0). That made the assertion a function of CLONE DEPTH rather than of the
  // logic under test: in a shallow checkout the removing commit is past the graft boundary, the
  // assertion goes RED, and — because this selftest is the `run:` leg of BOTH IMP-129 and IMP-110 —
  // it takes all 140 ledger rows down with it. That is what happened on 2026-08-06 (13-commit
  // shallow clone): 137 healthy checks were reported as a failed registry, and the morning session
  // declined to log a fix it had verified in both directions rather than "log on top of red". A
  // test that fails for reasons outside its subject is not protection, it is a tax on every future
  // session. So: build the history the assertion needs, in a throwaway repo, and prove all three
  // outcomes anywhere — NAMED, TRUNCATED, NEVER-LANDED.
  const t2 = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };
  let forensicAssertions = 0;
  {
    const msg = executeCheck(`grep:${self}:${absent}`, 'SELFTEST').join('');
    t2(/FORENSICS:/.test(msg), '[IMP-129] an absent anchor carries FORENSICS');
    forensicAssertions++;

    const scripted =
      (log: GitResult, shallow: GitResult, depth = '1'): GitRunner =>
      args =>
        args[0] === 'log'
          ? log
          : args[0] === 'rev-parse'
            ? shallow
            : { status: 0, out: depth, err: '' };
    const ok = (out: string): GitResult => ({ status: 0, out, err: '' });
    const named = anchorForensics(
      'gate.ts',
      'SENTINEL_ENFORCEMENT_STRING',
      undefined,
      scripted(ok('abc123 delete enforcement'), ok('false'))
    );
    t2(
      /FORENSICS: last commit touching this string/.test(named) &&
        /SUPERSESSION/.test(named),
      '[IMP-129] a deleted-but-once-committed anchor NAMES the commit that removed it (hermetic decision fixture)'
    );
    const never = anchorForensics(
      'gate.ts',
      `zz_${absent}`,
      undefined,
      scripted(ok(''), ok('false'))
    );
    t2(
      /Treat as NEVER-LANDED/.test(never) && !/HISTORY TRUNCATED/.test(never),
      '[IMP-129] in FULL history, a string no commit ever added is classified NEVER-LANDED, not a revert'
    );
    const trunc = anchorForensics(
      'gate.ts',
      'SENTINEL_ENFORCEMENT_STRING',
      undefined,
      scripted(ok(''), ok('true'), '13')
    );
    t2(
      /HISTORY TRUNCATED/.test(trunc) && !/Treat as NEVER-LANDED/.test(trunc),
      '[IMP-130] in a SHALLOW clone the same string is TRUNCATED, never NEVER-LANDED'
    );
    const errored = anchorForensics(
      'gate.ts',
      'SENTINEL_ENFORCEMENT_STRING',
      undefined,
      scripted(
        { status: 128, out: '', err: 'fatal: not a git repository' },
        ok('false')
      )
    );
    t2(
      /FORENSICS: GIT ERROR/.test(errored) &&
        !/Treat as NEVER-LANDED/.test(errored),
      '[IMP-130] a git failure is reported as UNKNOWN, never fabricated into NEVER-LANDED'
    );
    forensicAssertions += 4;
  }
  // IMP-140 — closure is a declaration, not a substring. Both directions, verbatim cells
  // taken from the live ledger (the two false exemptions and the three true closures).
  const closureCases: [string, boolean, string][] = [
    [
      'CLOSED-BY-CODE (IMP-007)',
      true,
      'ESC-001 verbatim: an explicit closure token closes',
    ],
    [
      '**Y — closed by code path, not by prose.** A subsequent session…',
      true,
      'ESC-010 verbatim: closure behind markdown + a Y grade still closes',
    ],
    [
      'pending — advisory leg + rubric verified both directions today; flips Y when an AI&T segment figure ships as a disclosed single qualifier',
      false,
      'IMP-083 verbatim: "disCLOSED" no longer closes a row',
    ],
    [
      'pending — OPEN escalation, deliberately not closed; carry-forward Critical for the next session',
      false,
      'ESC-013 verbatim: a row that says it is NOT closed is not closed',
    ],
    [
      'WONT-FIX-VIA-PROSE — superseded by the length rail',
      true,
      'the second legal closure token closes',
    ],
  ];
  for (const [cell, expect, label] of closureCases) {
    const got = isClosed(cell);
    console.log(`  ${got === expect ? 'PASS' : 'FAIL'} — [IMP-140] ${label}`);
    if (got !== expect) fails++;
  }
  // IMP-142 — MANDATE COVERAGE, both directions. The logic legs are HERMETIC (crafted rows, per
  // IMP-130: a selftest that fails for reasons outside its subject is a tax on every session);
  // the parse leg runs against the REAL critic reports, because "can it read the actual heading
  // the Critic actually writes" is the only part a fixture cannot honestly answer.
  let coverageAssertions = 0;
  {
    const mkRow = (id: string, summary: string, applied: string): Row => ({
      id,
      date: '2026-08-07',
      source: 'improvement',
      rc: 'RC2',
      sev: 'High',
      summary,
      targets: [],
      check: 'none',
      applied,
      verified: '',
      behavior: 'pending',
      recur: '0',
    });
    const fixtureRows = [
      mkRow('IMP-901', 'a fix (08-07 Critic mandate #1, 🔴)', '2026-08-07'),
      mkRow(
        'IMP-902',
        'another fix (08-07 Critic mandate #3, RC6)',
        '2026-08-07'
      ),
    ];
    const bare = mandateCoverage(fixtureRows, '2026-08-07', [1, 2, 3]);
    t2(
      bare.uncovered.length === 1 &&
        bare.uncovered[0] === 2 &&
        bare.applied.length === 2,
      '[IMP-142] a mandate with NO row is UNCOVERED — the real 08-07 #2 shape, on crafted rows'
    );

    const withDeferral = [
      ...fixtureRows,
      mkRow(
        'IMP-903',
        'skipped (08-07 Critic mandate #2)',
        'deferred→2026-08-08'
      ),
    ];
    const def = mandateCoverage(withDeferral, '2026-08-07', [1, 2, 3]);
    t2(
      def.uncovered.length === 0 &&
        def.deferred.length === 1 &&
        def.deferred[0] === 2,
      '[IMP-142] …and a DEFERRED row discharges it: 0 uncovered, deferred count non-zero'
    );

    const applied = [
      ...fixtureRows,
      mkRow('IMP-904', 'shipped (08-07 Critic mandate #2)', '2026-08-07'),
    ];
    const all = mandateCoverage(applied, '2026-08-07', [1, 2, 3]);
    t2(
      all.uncovered.length === 0 &&
        all.deferred.length === 0 &&
        all.applied.length === 3,
      '[IMP-142] …and when all three land: 0 uncovered, 0 deferred (the green state)'
    );

    // #1 must not be satisfied by a row citing #10 — the off-by-substring trap.
    const decoy = mandateCoverage(
      [mkRow('IMP-905', 'x (08-07 Critic mandate #10)', '2026-08-07')],
      '2026-08-07',
      [1]
    );
    t2(
      decoy.uncovered.length === 1,
      '[IMP-142] "#10" does not satisfy mandate #1 (no substring bleed)'
    );

    // …and the wrong DAY must not satisfy it either: this is how a stale row would launder a gap.
    const wrongDay = mandateCoverage(
      [mkRow('IMP-906', 'x (08-06 Critic mandate #1)', '2026-08-06')],
      '2026-08-07',
      [1]
    );
    t2(
      wrongDay.uncovered.length === 1,
      "[IMP-142] a row citing a DIFFERENT day's mandate #1 does not cover this one"
    );

    // IMP-195 — MANDATE-CITATION-CELLS, both directions.
    // POSITIVE: the real 08-18 shape. The citation lives in the `source` cell, the summary is
    // pure prose about the defect. v1 read summary only and called this UNCOVERED, reddening the
    // registry on a night the Critic certified 3/3 LANDED.
    const inSource = (id: string, source: string): Row => ({
      ...mkRow(id, 'THE PAYOFF WATCH RESOLVED A DIFFERENT BULLET.', '2026-08-18'),
      source,
    });
    const sourceCell = mandateCoverage(
      [
        inSource('IMP-190', '08-18 Critic mandate #3'),
        inSource('IMP-191', '08-18 Critic mandate #1 (leg a)'),
        inSource('IMP-193', '08-18 Critic mandate #2'),
      ],
      '2026-08-18',
      [1, 2, 3]
    );
    t2(
      sourceCell.uncovered.length === 0 && sourceCell.applied.length === 3,
      '[IMP-195] a citation in the `source` cell discharges the mandate — the real 08-18 shape'
    );

    // NEGATIVE 1: widening the cell must not widen anything else. A row whose `source` cites the
    // WRONG DAY still leaves the mandate uncovered — otherwise a stale row would launder a gap
    // through the newly-read cell, which is exactly the hole this must not open.
    const sourceWrongDay = mandateCoverage(
      [inSource('IMP-907', '08-17 Critic mandate #1')],
      '2026-08-18',
      [1]
    );
    t2(
      sourceWrongDay.uncovered.length === 1,
      "[IMP-195] …but a `source` citing a DIFFERENT day does not cover it (no laundering)"
    );

    // NEGATIVE 2: a row with no citation in EITHER cell is still UNCOVERED. This is the 08-07 #2
    // shape — the failure IMP-142 was built for — and it must survive the widening intact.
    const neitherCell = mandateCoverage(
      [inSource('IMP-908', 'pipeline defect (no critic)')],
      '2026-08-18',
      [1]
    );
    t2(
      neitherCell.uncovered.length === 1,
      '[IMP-195] …and a row citing NO mandate in either cell is still UNCOVERED (08-07 #2 shape holds)'
    );

    // REAL PARSE: both live critic reports, including the 08-07 one that carries the heading twice.
    const dbDir = path.join(process.cwd(), 'daily-briefs');
    const realParse = (d: string) =>
      fs.existsSync(path.join(dbDir, `${d}-critic.md`))
        ? parseMandates(
            fs.readFileSync(path.join(dbDir, `${d}-critic.md`), 'utf8')
          )
        : [];
    const m0807 = realParse('2026-08-07');
    const m0808 = realParse('2026-08-08');
    t2(
      JSON.stringify(m0807) === '[1,2,3]',
      `[IMP-142] parses 3 mandates from the REAL 2026-08-07 critic (got ${JSON.stringify(m0807)}; that report repeats the heading)`
    );
    t2(
      JSON.stringify(m0808) === '[1,2,3]',
      `[IMP-142] parses 3 mandates from the REAL 2026-08-08 critic (got ${JSON.stringify(m0808)})`
    );
    // …and never mistakes a -light-critic for the daily one.
    const elapsed = latestElapsedCritic(dbDir, '2026-08-08');
    t2(
      elapsed === '2026-08-07',
      `[IMP-142] the graded cycle is the last ELAPSED one, not today's (got ${elapsed})`
    );
    
    // ── IMP-212: THE HEADING-FORM REGRESSION, ON REAL BYTES, IN BOTH DIRECTIONS ──────────────
    // FIRES: the 08-24 and 08-25 critics use `### N.` — the form that returned [] and let six
    // Critical mandates through with the registry green. These two legs are the whole point.
    const m0824 = realParse('2026-08-24');
    const m0825 = realParse('2026-08-25');
    t2(
      JSON.stringify(m0824) === '[1,2,3]',
      `[IMP-212] parses 3 mandates from the REAL 2026-08-24 critic, which uses the '### N.' HEADING form that used to yield [] (got ${JSON.stringify(m0824)})`
    );
    t2(
      JSON.stringify(m0825) === '[1,2,3]',
      `[IMP-212] …and from the REAL 2026-08-25 critic, same heading form (got ${JSON.stringify(m0825)})`
    );
    // SILENT: the forms that already worked must keep working. A widened parser that breaks the
    // old shape trades one blind spot for another.
    const m0823 = realParse('2026-08-23');
    t2(
      JSON.stringify(m0823) === '[1,2,3]',
      `[IMP-212] the '**N.' bold form still parses — the 08-23 critic, unchanged (got ${JSON.stringify(m0823)})`
    );
    // The THIRD form, which system/Brief_Critic.md:303 actually specifies and neither the old nor
    // the drifted form matched: a bare numbered list.
    t2(
      JSON.stringify(
        parseMandates('## MUST BE BETTER TOMORROW\n1. a — RC2 — fix\n2. b — RC3 — fix\n3. c — RC5 — fix\n')
      ) === '[1,2,3]',
      "[IMP-212] the BARE `N.` form specified by Brief_Critic.md Phase 6 item 15 parses too"
    );
    // NEGATIVE 1 — the section terminator still terminates. Widening the mandate match must not
    // swallow the rest of the report: an UNNUMBERED heading after the block still ends it.
    t2(
      JSON.stringify(
        parseMandates(
          '## MUST BE BETTER TOMORROW\n### 1. a\n### 2. b\n## GATE VERDICTS\n### 3. not a mandate\n'
        )
      ) === '[1,2]',
      '[IMP-212] an unnumbered top-level heading still ENDS the block — `### 3.` under GATE VERDICTS is not a mandate'
    );
    // NEGATIVE 2 — the Goodhart brake. A phantom mandate is UNDISCHARGEABLE by construction, so
    // a stray unindented number in a fix description must not invent one and red the registry
    // forever. Contiguous run from 1, stop at the first gap.
    t2(
      JSON.stringify(
        parseMandates('## MUST BE BETTER TOMORROW\n### 1. a\n### 2. b\n### 3. c\n\n9. see rule 9 above\n')
      ) === '[1,2,3]',
      '[IMP-212] a stray `9.` in prose does NOT become mandate #9 (contiguous-run clamp)'
    );
    // NEGATIVE 3 — indented sub-lists are body text, not mandates.
    t2(
      JSON.stringify(
        parseMandates('## MUST BE BETTER TOMORROW\n### 1. a\n   1. sub-step\n   2. sub-step\n')
      ) === '[1]',
      '[IMP-212] an INDENTED numbered sub-list inside a mandate body is not a mandate (column-0 anchor)'
    );
    // NEGATIVE 4 — no heading at all still yields nothing to parse (main() turns this into a
    // FAIL; parseMandates itself stays a pure reader).
    t2(
      parseMandates('## SOMETHING ELSE\n### 1. a\n').length === 0,
      '[IMP-212] no MUST BE BETTER TOMORROW heading ⇒ no mandates parsed'
    );

    // ── IMP-213: THE WINDOW, WHICH IS WHY 08-23 GOT A PERMANENT AMNESTY ─────────────────────
    // The one-day window graded exactly one report; the 08-23 mandates were PARSEABLE all along
    // and were never graded, because the 08-24 session died and by 08-25 the window had moved.
    const win = elapsedCriticsInWindow(dbDir, '2026-08-25', 7);
    t2(
      win.includes('2026-08-23') && win.includes('2026-08-24'),
      `[IMP-213] a 7d window on 2026-08-25 still sees BOTH skipped days (got ${JSON.stringify(win)})`
    );
    t2(
      !win.includes('2026-08-25'),
      '[IMP-213] …and never grades TODAY, whose cycle has not had its turn (the false-positive-storm rule)'
    );
    t2(
      elapsedCriticsInWindow(dbDir, '2026-08-25', 1).length <=
        elapsedCriticsInWindow(dbDir, '2026-08-25', 7).length,
      '[IMP-213] a narrower window is a subset of a wider one (window arithmetic sane)'
    );
    coverageAssertions += 19;
  }

  // ── IMP-223: STARVATION — the Critical fuse is 2 days, not 30 (08-26 Critic mandate #2b) ────
  let starveAssertions = 0;
  {
    t2(
      noCheckVerdict('Critical', false, CRITICAL_STARVE_DAYS) === 'STARVED',
      `[IMP-223] a Critical row with no mechanical check is STARVED at ${CRITICAL_STARVE_DAYS} days`
    );
    t2(
      noCheckVerdict('Critical', false, CRITICAL_STARVE_DAYS - 1) === 'warn',
      '[IMP-223] …and SILENT (warn-only) the day it is logged — the mandate must be allowed its own session'
    );
    t2(
      noCheckVerdict('High', false, CRITICAL_STARVE_DAYS + 5) === 'warn' &&
        noCheckVerdict('Medium', false, 400) === 'exempt',
      '[IMP-223] High and Medium keep the budget rule — they are what the budget rule is FOR; only Critical loses the amnesty'
    );
    t2(
      noCheckVerdict('High', false, AGE_FUSE_DAYS) === 'FUSE-BLOWN',
      `[IMP-223] …and High still blows its ${AGE_FUSE_DAYS}-day fuse — the old rule is narrowed, not deleted`
    );
    t2(
      noCheckVerdict('Critical', true, 400) === 'exempt',
      '[IMP-223] a CLOSED Critical is exempt at any age — WONT-FIX-VIA-PROSE is a legitimate discharge, and a gate that punishes closure teaches sessions not to close'
    );
    // THE REAL LEDGER, BOTH DIRECTIONS. The mandate's own acceptance: these seven rows must be
    // silent on the day they were logged and STARVED the next morning.
    const ledger = path.join(process.cwd(), 'system', 'Improvement_Ledger.md');
    if (fs.existsSync(ledger)) {
      const rows = parseLedger(fs.readFileSync(ledger, 'utf8'));
      const named = ['IMP-215', 'IMP-216', 'IMP-217', 'IMP-218', 'IMP-219', 'IMP-220', 'ESC-020'];
      const dayAge = (rowDate: string, asOf: string) =>
        Math.floor(
          (new Date(asOf + 'T00:00:00Z').getTime() - new Date(rowDate + 'T00:00:00Z').getTime()) / 86400000
        );
      const verdictsOn = (asOf: string) =>
        rows
          .filter(r => named.includes(r.id) && (r.check === 'none' || r.check === ''))
          .map(r => noCheckVerdict(r.sev, isClosed(r.behavior), dayAge(r.date, asOf)));
      const on26 = verdictsOn('2026-08-26');
      const on27 = verdictsOn('2026-08-27');
      t2(
        on26.length > 0 && on26.every(v => v !== 'STARVED'),
        `[IMP-223] the seven 2026-08-25 Critical rows are NOT starved on 08-26, the day after they were logged (${on26.length} matched)`
      );
      t2(
        on27.length === on26.length && on27.length > 0 && on27.every(v => v === 'STARVED'),
        `[IMP-223] …and ALL of them are STARVED on 08-27 — the mandate's own acceptance, on the real ledger (${on27.filter(v => v === 'STARVED').length}/${on27.length})`
      );
      t2(
        rows.filter(r => (r.check === 'none' || r.check === '') && /^Critical$/i.test(r.sev) && !isClosed(r.behavior))
          .every(r => noCheckVerdict(r.sev, false, ageDays(r.date)) !== 'STARVED'),
        '[IMP-223] TODAY the registry is honest without being red: no Critical row is starved as of now, which is what let this leg ship the day it was written'
      );
      starveAssertions += 3;
    }
    starveAssertions += 5;
  }

  // ── IMP-211: THE ROUTING, WHICH IS THE ACTUAL SUBJECT OF THIS IMPROVEMENT ──────────────────
  // The pair above proves a `world:` leg still detects. THIS proves the detection lands in the
  // WARN channel and not the FAIL channel — the distinction the whole row exists for. Asserted
  // on the marker contract directly, because main()'s partition is three lines of `startsWith`
  // and a test that re-implemented them would prove only that I can write the same bug twice.
  let routingAssertions = 0;
  {
    const w = runLeg('world:false', 'ZZ-TEST');
    const r = runLeg('run:false', 'ZZ-TEST');
    t2(
      w !== null && w.startsWith(WORLD_MARK),
      '[IMP-211] a failing world: leg is MARKED for the warn channel — a record out of contract is not a broken improvement'
    );
    t2(
      r !== null && !r.startsWith(WORLD_MARK),
      '[IMP-211] …and a failing run: leg is NOT marked, so a genuinely broken enforcement still BLOCKS (the marker cannot be used to launder a dead gate)'
    );
    t2(
      (w ?? '').includes('WORLD-STATE OUT OF CONTRACT'),
      '[IMP-211] the warning names the condition in words, and carries the gate’s own output — nothing is silenced, only reclassified'
    );
    const okW = runLeg('world:true', 'ZZ-TEST');
    t2(
      okW === null,
      '[IMP-211] a world: leg whose record IS in contract passes silently, exactly like run:'
    );
    // The compound path: a row with a passing code leg and a failing world leg must yield
    // exactly one marked string and zero unmarked ones — i.e. that row is still VERIFIED.
    const compound = executeCheck(
      `grep:${self}:AGE_FUSE_DAYS && world:false`,
      'ZZ-TEST'
    );
    t2(
      compound.length === 1 &&
        compound.every(f => f.startsWith(WORLD_MARK)),
      '[IMP-211] a compound of (passing code leg + failing world leg) produces NO hard failure — the row stays verified and the record still gets its warning'
    );
    routingAssertions += 5;
  }

  const total =
    cases.length +
    forensicAssertions +
    closureCases.length +
    coverageAssertions +
    routingAssertions;
  console.log(
    `\nverify-improvements selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error(
      '✗ SELFTEST FAILED — compound-check logic no longer bites both directions.'
    );
    return 1;
  }
  console.log(
    '✓ compound-check (run:<selftest> && grep:<anchor> && gitshow:<anchor>) verified — a reverted enforcement now goes RED.'
  );
  return 0;
}

process.exit(process.argv.includes('--selftest') ? selftest() : main());
