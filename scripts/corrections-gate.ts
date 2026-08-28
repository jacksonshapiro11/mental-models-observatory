#!/usr/bin/env node --experimental-strip-types
/**
 * corrections-gate.ts — proves that every falsehood we CAUGHT actually got FIXED
 * in the published archive. (IMP-034, 2026-07-11.)
 *
 * WHY THIS EXISTS: on 2026-07-11 the pipeline proved its own published 07-10 brief
 * false (SK Hynix "$28 billion" — the pre-pricing target, not the $26.5B raise),
 * corrected the NEW brief before publish... and left the OLD one live. The Quality
 * Gate log literally said "issue a correction to BOTH briefs." Nobody did, because
 * "issue a correction" was prose addressed to no one. Detection without repair is
 * not a truth system; it is a system that knows it is lying.
 *
 * WHAT IT CHECKS: for every row in system/Corrections_Ledger.md —
 *   1. the target file exists;
 *   2. the WRONG text is GONE from it   (an unapplied correction = an open falsehood);
 *   3. the CORRECT text is PRESENT      (guards against a deletion that fixed nothing).
 * Backticked spans in the ledger's wrong/correct cells are the literal needles; prose
 * outside them is commentary for humans and is ignored.
 *
 * ...and it checks all three against BOTH copies (v2, IMP-035, 2026-07-11):
 *   LOCAL     — the working file on disk.
 *   PUBLISHED — the blob actually on origin/main, which is what the READER sees.
 *
 * WHY v2 EXISTS: v1 read only the local file. On the night of 2026-07-11 the SK Hynix
 * correction (COR-001/002) was applied on disk, the ledger said `applied`, and this gate
 * printed "✓ Every logged correction has landed in the published file" — while the live
 * 07-10 page still said "$28 billion". The fix was never pushed, because publish.py's
 * staleness guard refused every back-dated write and pointed at an override that did not
 * exist. Three layers all reported done; the falsehood stayed live for 36 hours.
 * A gate that reads the working copy proves only that we MEANT to fix it. The reader does
 * not read our working copy. PUBLISHED is the only copy that can lie to anyone.
 *
 * A published state we cannot PROVE is treated as a failure, not a pass. Green must mean
 * "the reader sees the truth" — never "we could not check."
 *
 * Usage:
 *   node --experimental-strip-types scripts/corrections-gate.ts              # local + published
 *   node --experimental-strip-types scripts/corrections-gate.ts --local-only # skip network
 *   node --experimental-strip-types scripts/corrections-gate.ts --selftest
 *
 * Exit: 0 all corrections landed in BOTH copies · 1 an open falsehood is live (or the
 *       published state is unprovable) · 2 usage/parse error
 * Wired into: verify-improvements.ts (IMP-034/035 rows) + pipeline-health-check (daily).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

interface Row {
  id: string;
  found: string;
  file: string;
  wrong: string;
  correct: string;
  source: string;
  applied: string;
}

/** The literal needle is the FIRST backticked span in a cell; everything else is prose. */
function needle(cell: string): string | null {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1].trim() : null;
}

export function parseLedger(md: string): Row[] {
  const rows: Row[] = [];
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const c = t.split('|').map(s => s.trim());
    if (c.length < 8) continue;
    if (!/^COR-\d+/.test(c[1] ?? '')) continue; // skips header + divider
    rows.push({
      id: c[1]!,
      found: c[2]!,
      file: c[3]!,
      wrong: c[4]!,
      correct: c[5]!,
      source: c[6]!,
      applied: c[7]!,
    });
  }
  return rows;
}

export function checkRow(
  r: Row,
  readFile: (p: string) => string | null
): string[] {
  const fails: string[] = [];
  const body = readFile(r.file);
  if (body === null) return [`${r.id}: target file missing: ${r.file}`];

  const wrong = needle(r.wrong);
  const correct = needle(r.correct);
  if (!wrong || !correct) {
    return [
      `${r.id}: malformed row — wrong/correct cells must each contain a \`backticked\` literal (got wrong=${wrong ? 'ok' : 'MISSING'}, correct=${correct ? 'ok' : 'MISSING'})`,
    ];
  }
  if (body.includes(wrong)) {
    fails.push(
      `${r.id}: OPEN FALSEHOOD — the wrong text is STILL LIVE in ${r.file}: "${wrong.slice(0, 90)}". We proved this false on ${r.found} (${r.source.slice(0, 70)}) and never fixed the file. Apply the correction.`
    );
  }
  if (!body.includes(correct)) {
    fails.push(
      `${r.id}: correction NOT PRESENT in ${r.file} — expected "${correct.slice(0, 90)}". The wrong text may have been deleted rather than corrected; the reader is owed the true figure, not a hole.`
    );
  }
  if (!r.applied.trim() && fails.length === 0) {
    fails.push(
      `${r.id}: file is correct but 'applied' is empty — log the date; an unlogged correction is an unverifiable one.`
    );
  }
  return fails;
}

/* ---------------------------------------------------------------------------
 * IMP-199 — THE COMPANION SWEEP (2026-08-19, RC3). A CORRECTION APPLIED TO ONE PRODUCT DOES NOT
 * REACH THE OTHER, AND NOTHING COMPARED THEM.
 *
 * WHAT HAPPENED, this morning. The 08-19 Morning Truth Gate proved two claims false and corrected
 * the FULL brief — "the report rates overall AUTONOMY risk low, up from very low" (it was
 * MISALIGNMENT risk in high-stakes settings) and the Signal's "500 to 999 band at 109 percent"
 * (uncorroborable; the HRA Council's own release names the 50+ FTE band). Both corrections landed
 * in `content/daily-updates/2026-08-19.md`. Then `-light.md` PUBLISHED BOTH FALSEHOODS ANYWAY,
 * because the morning pass corrects the full brief and nothing was checking the companion for the
 * same defect. It was caught by eye, republished, and re-diffed — twenty minutes after the system
 * had already proven the claims false. As the session's own status line put it: *"a truth fix
 * applied to the full brief does not propagate to -light.md and no gate compares them."*
 *
 * THIS IS THE SECOND OCCURRENCE, WHICH IS WHY IT GETS CODE AND NOT PROSE. COR-012/013 (2026-08-16)
 * record the identical shape: the published 2026-08-14 brief **and its -light.md** both asserted a
 * cancelled SEC vote as a future event. The class was visible in the ledger three days ago with no
 * gate attached to it.
 *
 * WHY THE EXISTING GATE COULD NOT SEE IT: `checkRow` reads `r.file` — ONE path. A correction row
 * names the product it was written against, so the companion is outside the gate's field of view
 * by construction. Every layer reported done, and one of the two reader surfaces stayed false.
 * That is the 2026-07-11 blindness arriving through a THIRD seam: v1 read the wrong COPY, v2 read
 * only one FORM (IMP-179), and this read only one PRODUCT.
 *
 * THE ASYMMETRY IS DELIBERATE. Only the WRONG text is checked in the companion. The `correct`
 * literal is NOT required there — the light is a compression and legitimately omits most claims,
 * so demanding the corrected sentence appear in it would red the registry on every correction to
 * a full-brief-only passage. What must never be true is that a sentence we have PROVEN FALSE is
 * live on a reader surface. Absence is a valid fix for the companion; falsehood is not.
 */
export function companionOf(file: string): string | null {
  const m = file.match(
    /^(content\/daily-updates\/\d{4}-\d{2}-\d{2})(-light)?\.md$/
  );
  if (!m) return null;
  return m[2] ? `${m[1]}.md` : `${m[1]}-light.md`;
}

export function checkCompanion(
  r: Row,
  readFile: (p: string) => string | null
): string[] {
  const companion = companionOf(r.file);
  if (!companion) return [];
  const body = readFile(companion);
  if (body === null) return []; // no companion published that day — not a failure
  const wrong = needle(r.wrong);
  if (!wrong) return []; // malformed rows are already reported by checkRow
  if (!body.includes(wrong)) return [];
  return [
    `${r.id}: OPEN FALSEHOOD IN THE COMPANION — the wrong text is corrected in ${r.file} but STILL LIVE ` +
      `in ${companion}: "${wrong.slice(0, 90)}". We proved this false on ${r.found} ` +
      `(${r.source.slice(0, 70)}) and fixed one of the two reader surfaces. ` +
      `A correction applied to one product is not a correction; the reader of the other product is ` +
      `still being lied to. Apply it to the companion and re-publish, or cut the sentence there — ` +
      `absence is a valid fix for a companion, falsehood is not. ` +
      `RECEIPT, 2026-08-19: the Morning Truth Gate corrected "autonomy risk low, up from very low" and ` +
      `the Signal's "109 percent" in the full brief, and -light.md published both anyway, twenty minutes ` +
      `after the system had proven them false. Second occurrence — COR-012/013 (2026-08-14) is the first.`,
  ];
}

/* ---------------------------------------------------------------------------
 * IMP-188 — TWO ROWS, ONE SENTENCE, INCOMPATIBLE PRESCRIPTIONS (2026-08-17, RC3).
 *
 * WHAT HAPPENED. COR-014 and COR-016 both corrected the SAME Hormuz-continuity sentence in the SAME
 * published file, and their prescribed wordings diverged mid-sentence:
 *   COR-014 …since Iran's late-February closure, WITH THE MEMORANDUM'S 60-DAY SAFE-PASSAGE WINDOW…
 *   COR-016 …since Iran's late-February closure; THE DECLARED STATUS HAS FLIPPED REPEATEDLY, WITH…
 * `checkRow` requires each row's `correct` literal to be a substring of the file. The characters
 * after "closure" cannot be both, so **satisfying either row necessarily broke the other and the
 * gate could never exit 0.** It had been RED for two days, and the RED read "a claim we PROVED false
 * is still live" — which was not true after 2026-08-17's morning pass. Both paths had been corrected;
 * what remained was an unsatisfiable constraint wearing the costume of a live falsehood.
 *
 * THAT IS THE EXPENSIVE PART, and it is the CARRY/TREE lesson again (2026-08-14, IMP-174): a gate
 * that manufactures a red nobody can clear does not raise an alarm, it teaches the next session to
 * skim reds. Two sessions read this one and neither could close it, because the fix was not in the
 * file — it was in the pair.
 *
 * SO THE PAIR IS NOW CHECKED. Any two OPEN rows targeting the same file whose `correct` literals
 * share a prefix and then diverge are reported as CONFLICTING PRESCRIPTIONS — a distinct, named
 * verdict that tells the reader to merge the rows rather than to edit the file. Resolution on
 * 2026-08-17: publish COR-016's fuller dated record (a strict superset of COR-014's content) and
 * shorten COR-014's expected literal to the clause both wordings share.
 * --------------------------------------------------------------------------- */
/** The longest common prefix of two strings. */
function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}
/**
 * CONFLICTING PRESCRIPTIONS: two rows on one file whose corrections cannot both be substrings.
 * The signature is a SUBSTANTIAL shared prefix (≥40 chars — the same sentence) followed by a
 * divergence, with neither literal containing the other (nesting is fine: a shorter literal inside
 * a longer one is satisfied by the same bytes).
 */
export function conflictingPrescriptions(rows: Row[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!,
        b = rows[j]!;
      if (a.file !== b.file) continue;
      const ca = needle(a.correct),
        cb = needle(b.correct);
      if (!ca || !cb) continue;
      if (ca.includes(cb) || cb.includes(ca)) continue; // nested — both can hold
      const pre = commonPrefix(ca, cb);
      if (pre.length < 40) continue;
      out.push(
        `${a.id} + ${b.id}: CONFLICTING PRESCRIPTIONS — both rows correct the SAME SENTENCE in ${a.file}, ` +
          `sharing ${pre.length} characters ("…${pre.slice(-50)}") and then diverging. No file can satisfy both, ` +
          `so this pair can never exit 0 and editing the file cannot fix it. MERGE THE ROWS: publish one sentence ` +
          `carrying every verified fact, then point both \`correct\` literals at a clause the published wording ` +
          `actually contains. A gate that manufactures a red nobody can clear teaches the next session to skim reds.`
      );
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * IMP-179 — THE FORMAT SEAM AND THE ID SEAM (2026-08-16, brief-morning receipt, RC1).
 *
 * WHAT HAPPENED THIS MORNING. The Sunday Morning Truth Gate proved two published briefs false
 * and logged the corrections as PROSE BULLETS — matching the style of the entries already sitting
 * under "Withdrawn" — instead of pipe-table rows. `parseLedger` requires a line to start with `|`
 * and to carry >=8 cells, so those entries were INVISIBLE: the gate printed
 *   "corrections-gate — 9 logged correction(s) · 0 open"
 * while `2026-08-14-light.md` still carried a proven falsehood on the live reader surface.
 *
 * That is the 2026-07-11 blindness arriving through a FORMAT seam instead of a transport seam.
 * v1 read the wrong COPY (working tree, not origin/main). v2 fixed the copy and still reads only
 * one FORM. A gate whose parser silently drops what it cannot parse reports "0 open" for
 * "0 found", and those two sentences mean opposite things.
 *
 * ...and in the same session the ids COLLIDED: COR-006 and COR-007 were allocated to the new
 * corrections while both were already taken by the 07-17 TSMC and 07-21 GM rows, because nothing
 * anywhere allocates or validates an id. A ledger whose primary key is assigned by eyeball is a
 * ledger where two different falsehoods can share one row's provenance.
 *
 * TWO LEGS, both SILENT on the repaired ledger as it stands today, both FIRING on the exact
 * states this morning produced:
 *   PROSE-ONLY  — a COR id that appears in a prose bullet but has NO pipe-table row is a
 *                 correction this gate cannot check. Unparseable is not the same as absent, and
 *                 the difference is a reader being lied to.
 *   ID INTEGRITY — table ids must be UNIQUE and CONTIGUOUS from COR-001. A duplicate means two
 *                 corrections share a key; a gap means a row was allocated and lost.
 * ------------------------------------------------------------------------- */

/** Ids declared in PROSE (bolded bullets, headings, narrative) rather than in the pipe table.
 *  We only count a mention that LOOKS LIKE A DECLARATION — a bolded id at the head of a bullet or
 *  a heading — so ordinary cross-references ("see COR-001") are not mistaken for new entries. */
export function parseProseIds(md: string): string[] {
  const out = new Set<string>();
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (t.startsWith('|')) continue; // the table is the parseable form; that is the point
    // "- **COR-010 / COR-011 (logged ...)" · "**COR-005 ...**" · "### COR-012"
    const m = t.match(
      /^(?:[-*]\s+)?(?:\*\*|#{1,6}\s*)\s*((?:COR-\d+\s*(?:\/|,|and)?\s*)+)/i
    );
    if (!m) continue;
    for (const id of m[1].match(/COR-\d+/gi) ?? []) out.add(id.toUpperCase());
  }
  return [...out];
}

/** A correction recorded in a form the parser drops is an unchecked correction. */
export function checkProseOnly(rows: Row[], md: string): string[] {
  const tableIds = new Set(rows.map(r => r.id.toUpperCase()));
  const fails: string[] = [];
  for (const id of parseProseIds(md)) {
    if (tableIds.has(id)) continue;
    fails.push(
      `${id}: PROSE-ONLY CORRECTION — declared in narrative form with no pipe-table row, so this gate ` +
        `cannot read its target file, its wrong text or its corrected text, and CANNOT PROVE the reader ` +
        `is no longer being lied to. Unparseable is not the same as absent. RECEIPT (2026-08-16): two ` +
        `corrections logged this way printed "0 open" while a proven falsehood was still live in ` +
        `content/daily-updates/2026-08-14-light.md. Move it into the table: | id | found | brief_file | ` +
        `\`wrong\` | \`correct\` | source | applied |.`
    );
  }
  return fails;
}

/** The ledger's primary key must actually be a key. */
export function checkIdIntegrity(rows: Row[]): string[] {
  const fails: string[] = [];
  const seen = new Map<string, string>();
  for (const r of rows) {
    const id = r.id.toUpperCase();
    const prior = seen.get(id);
    if (prior !== undefined) {
      fails.push(
        `${id}: DUPLICATE ID — allocated twice (first found ${prior}, again found ${r.found}). Two different ` +
          `falsehoods now share one provenance key, so "which correction is COR-${id.slice(4)}" has two answers ` +
          `and neither is auditable. RECEIPT (2026-08-16): COR-006/COR-007 were re-used for new corrections ` +
          `while already held by the 07-17 TSMC and 07-21 GM rows, because nothing allocates ids. Renumber the ` +
          `newer row to the next free id.`
      );
      continue;
    }
    seen.set(id, r.found);
  }
  const nums = [...seen.keys()]
    .map(k => Number(k.slice(4)))
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (nums.length) {
    const missing: number[] = [];
    for (let n = 1; n <= nums[nums.length - 1]!; n++)
      if (!nums.includes(n)) missing.push(n);
    if (missing.length)
      fails.push(
        `ID GAP — no table row for ${missing.map(n => `COR-${String(n).padStart(3, '0')}`).join(', ')}, ` +
          `though higher ids exist. Either the row was allocated and lost, or it lives in prose the parser drops. ` +
          `A gap is the shape a silently-deleted correction leaves behind; close it or record the withdrawal ` +
          `as a table row with its wrong/correct literals intact.`
      );
  }
  return fails;
}

/**
 * Reads the file as it exists on origin/main — the copy the reader actually sees.
 *
 * Publishing goes through publish.py, which writes to GitHub via the REST API or a /tmp
 * clone and NEVER commits locally. So the local repo's HEAD says nothing about what is
 * live, and a cached origin/main ref may be stale. We therefore prove currency first:
 * `git ls-remote` (network read, no local writes — safe on the Cowork mount, which
 * cannot delete a stale .git/index.lock) must agree with the cached ref before we trust
 * `git show`. If it does not agree, the published state is UNPROVEN — and unproven is a
 * failure, because "I could not check" is exactly the state that let a known lie sit live.
 */
const UNPROVEN = Symbol('unproven');
type Published = string | null | typeof UNPROVEN;

function makePublishedReader(): (p: string) => Published {
  const git = (args: string[], cwd?: string): string =>
    execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 120_000,
      cwd,
    }).trim();

  // FAST PATH: if the cached origin/main ref already equals the remote HEAD, the local
  // object store is authoritative and `git show` is a true published receipt — no network
  // beyond the ls-remote, no writes anywhere.
  try {
    const remote = git(['ls-remote', 'origin', 'main']).split(/\s+/)[0]!;
    const cached = git(['rev-parse', 'origin/main']);
    if (remote && remote === cached) {
      return p => {
        try {
          return git(['show', `origin/main:${p}`]);
        } catch {
          return null;
        }
      };
    }
    console.error(
      `  · cached origin/main (${cached.slice(0, 7)}) is behind remote HEAD (${remote.slice(0, 7)}) — expected, since publish.py pushes via API//tmp clone and never commits locally. Reading the published tree directly.`
    );
  } catch {
    console.error(
      '  ! could not reach origin — published state cannot be proven.'
    );
    return () => UNPROVEN;
  }

  // SLOW PATH: read the published tree from a disposable blobless clone. We do NOT run
  // `git fetch` on the Cowork mount: an interrupted fetch strands .git/index.lock, which
  // the mount's permissions cannot delete, bricking every later git op (Repo_Operations).
  // A /tmp clone has full permissions and is thrown away.
  try {
    const url = git(['remote', 'get-url', 'origin']).replace(
      /https:\/\/[^@]*@/,
      'https://'
    );
    let token = process.env.GITHUB_TOKEN ?? '';
    if (!token) {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        token = (
          fs
            .readFileSync(envPath, 'utf8')
            .match(/^GITHUB_TOKEN\s*=\s*["']?([^"'\r\n]+)/m)?.[1] ?? ''
        ).trim();
      }
    }
    const auth = token
      ? url.replace('https://', `https://x-access-token:${token}@`)
      : url;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corrgate-'));
    git([
      'clone',
      '--filter=blob:none',
      '--depth',
      '1',
      '--branch',
      'main',
      '--quiet',
      auth,
      dir,
    ]);
    return p => {
      const fp = path.join(dir, p);
      return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
    };
  } catch (e) {
    // Never swallow this: a silent clone failure is indistinguishable from a passing gate.
    const msg = String((e as Error)?.message ?? e).replace(
      /x-access-token:[^@]*@/g,
      'x-access-token:***@'
    );
    console.error(
      `  ! could not clone the published tree — published state cannot be proven: ${msg.slice(0, 160)}`
    );
    return () => UNPROVEN;
  }
}

function selftest(): number {
  const FIXED =
    'raising roughly $26.5 billion, the largest foreign IPO in US history';
  const BROKEN =
    'raising roughly 28 billion dollars, the largest foreign IPO in US history';
  const row: Row = {
    id: 'COR-TEST',
    found: '2026-07-11',
    file: 'fake.md',
    wrong: '`raising roughly 28 billion dollars`',
    correct: '`raising roughly $26.5 billion`',
    source: 'selftest',
    applied: '2026-07-11',
  };
  const cases: Array<[string, boolean, () => boolean]> = [
    [
      'FAILs when the false text is still live (the real 07-10 state)',
      true,
      () => checkRow(row, () => BROKEN).length > 0,
    ],
    [
      'SILENT once the correction is applied (the real 07-10 state now)',
      false,
      () => checkRow(row, () => FIXED).length > 0,
    ],
    [
      'FAILs when the wrong text was deleted but no correction landed',
      true,
      () =>
        checkRow(row, () => 'SK Hynix listed on the Nasdaq under SKHY.')
          .length > 0,
    ],
    [
      'FAILs on a missing target file',
      true,
      () => checkRow(row, () => null).length > 0,
    ],
    // THE 2026-07-11 REGRESSION. This is the exact state v1 called green: the working copy
    // was corrected, the ledger said `applied`, and the live page still said "$28 billion".
    // The two-reader design must FIRE on the published copy even when local is spotless.
    [
      'FAILs when LOCAL is fixed but PUBLISHED still carries the falsehood (the 07-11 blindness)',
      true,
      () =>
        checkRow(row, () => FIXED).length === 0 &&
        checkRow(row, () => BROKEN).length > 0,
    ],
    // IMP-179 — THE FORMAT SEAM. This is the literal 2026-08-16 state: the correction exists,
    // it is written down, a human can read it — and the parser drops it, so the gate says 0 open.
    [
      'FAILs on a correction declared in PROSE with no table row (the 08-16 format seam)',
      true,
      () =>
        checkProseOnly(
          [row],
          '- **COR-099 / COR-100 (logged 2026-08-16).** The published brief said X; it is false.\n'
        ).length > 0,
    ],
    [
      'SILENT when the same prose entry ALSO has its table row (commentary, not a new correction)',
      false,
      () =>
        checkProseOnly(
          [{ ...row, id: 'COR-099' }],
          '- **COR-099 (logged AND applied 2026-08-16).** Commentary on a row that exists.\n'
        ).length > 0,
    ],
    [
      'SILENT on an ordinary cross-reference mid-sentence (no storm on prose that merely cites)',
      false,
      () =>
        checkProseOnly(
          [],
          'The rule that created this ledger is visible in COR-001 and COR-002.\n'
        ).length > 0,
    ],
    // IMP-179 — THE ID SEAM. COR-006/007 were re-used on 08-16 while already held.
    [
      'FAILs on a duplicate id (the 08-16 re-use)',
      true,
      () =>
        checkIdIntegrity([
          { ...row, id: 'COR-006', found: '2026-07-17' },
          { ...row, id: 'COR-006', found: '2026-08-16' },
        ]).length > 0,
    ],
    [
      'FAILs on a gap in the id sequence (a row allocated and lost)',
      true,
      () =>
        checkIdIntegrity([
          { ...row, id: 'COR-001' },
          { ...row, id: 'COR-003' },
        ]).length > 0,
    ],
    [
      'SILENT on a unique, contiguous id sequence',
      false,
      () =>
        checkIdIntegrity([
          { ...row, id: 'COR-001' },
          { ...row, id: 'COR-002' },
        ]).length > 0,
    ],
    // The live ledger must pass BOTH new legs — green here means the real file is well-formed.
    [
      'the LIVE ledger has no prose-only correction and no id collision',
      false,
      () => {
        const p = path.join(process.cwd(), 'system/Corrections_Ledger.md');
        if (!fs.existsSync(p)) return false;
        const md = fs.readFileSync(p, 'utf8');
        const rs = parseLedger(md);
        return checkProseOnly(rs, md).length + checkIdIntegrity(rs).length > 0;
      },
    ],
    // --- IMP-188: CONFLICTING PRESCRIPTIONS. The fixture is the REAL 08-14/08-16 pair, verbatim. ---
    [
      'FIRES on two rows correcting the SAME sentence with wordings that diverge (the real COR-014/COR-016 pair)',
      true,
      () =>
        conflictingPrescriptions([
          {
            ...row,
            id: 'COR-014',
            file: 'content/daily-updates/2026-08-15.md',
            correct:
              "`The American blockade of Iran's ports, first imposed 13 April, was lifted by the June 17 memorandum and reimposed in early August; Hormuz has been shut or conditional since Iran's late-February closure, with the memorandum's 60-day safe-passage window the last real opening`",
          },
          {
            ...row,
            id: 'COR-016',
            file: 'content/daily-updates/2026-08-15.md',
            correct:
              "`The American blockade of Iran's ports, first imposed 13 April, was lifted by the June 17 memorandum and reimposed in early August; Hormuz has been shut or conditional since Iran's late-February closure; the declared status has flipped repeatedly, with a 17 April reopening`",
          },
        ]).length > 0,
    ],
    [
      'SILENT when one literal NESTS inside the other — the same bytes satisfy both (the 08-17 resolution)',
      false,
      () =>
        conflictingPrescriptions([
          {
            ...row,
            id: 'COR-014',
            file: 'content/daily-updates/2026-08-15.md',
            correct:
              "`Hormuz has been shut or conditional since Iran's late-February closure`",
          },
          {
            ...row,
            id: 'COR-016',
            file: 'content/daily-updates/2026-08-15.md',
            correct:
              "`Hormuz has been shut or conditional since Iran's late-February closure; the declared status has flipped repeatedly`",
          },
        ]).length > 0,
    ],
    [
      'SILENT on two rows in DIFFERENT files, however similar their corrections',
      false,
      () =>
        conflictingPrescriptions([
          {
            ...row,
            id: 'COR-001',
            file: 'a.md',
            correct: '`' + 'x'.repeat(60) + 'AAA`',
          },
          {
            ...row,
            id: 'COR-002',
            file: 'b.md',
            correct: '`' + 'x'.repeat(60) + 'BBB`',
          },
        ]).length > 0,
    ],
    [
      'SILENT on two unrelated corrections in one file (short shared prefix)',
      false,
      () =>
        conflictingPrescriptions([
          {
            ...row,
            id: 'COR-001',
            file: 'a.md',
            correct: '`The Fed held rates at 4.25 percent`',
          },
          {
            ...row,
            id: 'COR-002',
            file: 'a.md',
            correct: '`Brent settled at $82.40 on Friday`',
          },
        ]).length > 0,
    ],
    [
      'the LIVE ledger now carries NO conflicting pair (COR-014 repointed 2026-08-17)',
      false,
      () => {
        const p = path.join(process.cwd(), 'system/Corrections_Ledger.md');
        if (!fs.existsSync(p)) return false;
        return (
          conflictingPrescriptions(parseLedger(fs.readFileSync(p, 'utf8')))
            .length > 0
        );
      },
    ],
    [
      'parses the live ledger',
      false,
      () => {
        const p = path.join(process.cwd(), 'system/Corrections_Ledger.md');
        if (!fs.existsSync(p)) return true;
        return parseLedger(fs.readFileSync(p, 'utf8')).length === 0; // fires (=true) if it parses to zero rows
      },
    ],
    // ── IMP-199 — THE COMPANION SWEEP, both directions on the real 08-19 incident ─────────────
    // The fixture is verbatim from this morning: the full brief was corrected and the light
    // published the same falsehood anyway. Reader-facing text, one product true, one false.
    [
      'IMP-199 FIRES when the full brief is corrected and the COMPANION LIGHT still carries the falsehood (the real 2026-08-19 state at 05:20 ET)',
      true,
      () => {
        const r: Row = {
          id: 'COR-TEST-COMPANION',
          found: '2026-08-19',
          file: 'content/daily-updates/2026-08-19.md',
          wrong: '`rates overall autonomy risk low, up from very low`',
          correct: '`raised misalignment risk in high-stakes settings`',
          source: 'Morning Truth Gate (Unite.AI, OECD.AI, SiliconANGLE)',
          applied: '2026-08-19',
        };
        return (
          checkCompanion(r, p =>
            p.endsWith('-light.md')
              ? 'The report rates overall autonomy risk low, up from very low.'
              : 'The report raised misalignment risk in high-stakes settings.'
          ).length > 0
        );
      },
    ],
    [
      'IMP-199 SILENT once the companion is corrected too (the state after the second push)',
      false,
      () => {
        const r: Row = {
          id: 'COR-TEST-COMPANION',
          found: '2026-08-19',
          file: 'content/daily-updates/2026-08-19.md',
          wrong: '`rates overall autonomy risk low, up from very low`',
          correct: '`raised misalignment risk in high-stakes settings`',
          source: 'Morning Truth Gate',
          applied: '2026-08-19',
        };
        return (
          checkCompanion(
            r,
            () => 'The report raised misalignment risk in high-stakes settings.'
          ).length > 0
        );
      },
    ],
    [
      'IMP-199 SILENT when the companion omits the passage entirely — absence is a valid fix for a compression, and the `correct` literal is deliberately NOT required there',
      false,
      () => {
        const r: Row = {
          id: 'COR-TEST-COMPANION',
          found: '2026-08-19',
          file: 'content/daily-updates/2026-08-19.md',
          wrong: '`rates overall autonomy risk low, up from very low`',
          correct: '`raised misalignment risk in high-stakes settings`',
          source: 'Morning Truth Gate',
          applied: '2026-08-19',
        };
        return (
          checkCompanion(r, () => 'A brief with no Anthropic line at all.')
            .length > 0
        );
      },
    ],
    [
      'IMP-199 SILENT when no companion exists that day (a missing light is a publish question, not a truth one)',
      false,
      () => {
        const r: Row = {
          id: 'COR-TEST-COMPANION',
          found: '2026-08-19',
          file: 'content/daily-updates/2026-08-19.md',
          wrong: '`rates overall autonomy risk low`',
          correct: '`raised misalignment risk`',
          source: 'Morning Truth Gate',
          applied: '2026-08-19',
        };
        return checkCompanion(r, () => null).length > 0;
      },
    ],
    [
      'IMP-199 the mapping is SYMMETRIC — a row written against the light points back at the full brief',
      true,
      () => {
        const r: Row = {
          id: 'COR-TEST-COMPANION-REV',
          found: '2026-08-19',
          file: 'content/daily-updates/2026-08-19-light.md',
          wrong: '`the 500 to 999 band at 109 percent`',
          correct: '`applicable large employers, 50 or more FTEs`',
          source: 'Morning Truth Gate (HRA Council)',
          applied: '2026-08-19',
        };
        return (
          companionOf(r.file) === 'content/daily-updates/2026-08-19.md' &&
          checkCompanion(
            r,
            () => 'growth ran hottest in the 500 to 999 band at 109 percent'
          ).length > 0
        );
      },
    ],
    [
      'IMP-199 SILENT on the LIVE ledger against the LIVE files — every logged correction is clean in BOTH products right now',
      false,
      () => {
        const p = path.join(process.cwd(), 'system/Corrections_Ledger.md');
        if (!fs.existsSync(p)) return false;
        const readLocal = (f: string): string | null => {
          const fp = path.join(process.cwd(), f);
          return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
        };
        return parseLedger(fs.readFileSync(p, 'utf8')).some(
          r => checkCompanion(r, readLocal).length > 0
        );
      },
    ],
  ];
  let fails = 0;
  for (const [name, shouldFire, fn] of cases) {
    const fired = fn();
    const ok = fired === shouldFire;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} — ${name} (expected ${shouldFire ? 'FIRE' : 'SILENT'}, got ${fired ? 'FIRE' : 'SILENT'})`
    );
    if (!ok) fails++;
  }
  console.log(
    `\ncorrections-gate selftest — ${cases.length - fails}/${cases.length} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ Both directions verified: an unapplied correction FAILs, an applied one is silent.'
  );
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();
  const localOnly = argv.includes('--local-only');

  const ledgerPath = path.join(process.cwd(), 'system/Corrections_Ledger.md');
  if (!fs.existsSync(ledgerPath)) {
    console.error(`FAIL: corrections ledger not found: ${ledgerPath}`);
    return 2;
  }
  const rows = parseLedger(fs.readFileSync(ledgerPath, 'utf8'));
  const readLocal = (p: string): string | null => {
    const fp = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  };

  const fails: string[] = [];
  // IMP-179 — read the FORM and the KEY before reading any copy. A row the parser drops is a
  // correction nobody checked, and a duplicated id is a correction nobody can find.
  const ledgerMd = fs.readFileSync(ledgerPath, 'utf8');
  fails.push(...checkProseOnly(rows, ledgerMd).map(f => `[LEDGER]    ${f}`));
  fails.push(...checkIdIntegrity(rows).map(f => `[LEDGER]    ${f}`));
  // IMP-188: a pair no file can satisfy. Named separately so the verdict says "merge the rows",
  // not "apply the correction" — the 08-15/16/17 red said the latter and it was unactionable.
  fails.push(...conflictingPrescriptions(rows).map(f => `[LEDGER]    ${f}`));
  for (const r of rows)
    fails.push(...checkRow(r, readLocal).map(f => `[LOCAL]     ${f}`));
  // IMP-199: the OTHER product. A row names one file; the day ships two reader surfaces.
  for (const r of rows)
    fails.push(...checkCompanion(r, readLocal).map(f => `[COMPANION] ${f}`));

  // THE COPY THAT CAN LIE TO A READER. Never skipped silently.
  if (localOnly) {
    console.error(
      '  ! --local-only: the PUBLISHED archive was NOT checked. This proves only that we meant to fix it.'
    );
  } else {
    const readPublished = makePublishedReader();
    for (const r of rows) {
      const body = readPublished(r.file);
      if (body === UNPROVEN) {
        fails.push(
          `[PUBLISHED] ${r.id}: UNPROVEN — could not read ${r.file} from origin/main. We cannot show the reader sees the truth, so this is RED, not green. (v1 of this gate went green on the working copy while the live page still carried the falsehood — never again.)`
        );
        continue;
      }
      fails.push(
        ...checkRow(r, () => body as string | null).map(f => `[PUBLISHED] ${f}`)
      );
      // IMP-199 on the copy that can lie to a reader. The 08-19 light was PUBLISHED false while
      // the full brief on the same commit was true, so the companion sweep has to run here too —
      // a local-only companion check would have gone green on exactly that morning.
      fails.push(
        ...checkCompanion(r, p => {
          const b = readPublished(p);
          return b === UNPROVEN ? null : (b as string | null);
        }).map(f => `[PUB/COMPANION] ${f}`)
      );
    }
  }

  const open = fails.length;
  console.log(
    `corrections-gate — ${rows.length} logged correction(s) · ${open} open · scope: LOCAL${localOnly ? '' : ' + PUBLISHED (origin/main)'}`
  );
  for (const f of fails) console.error(`  ✗ ${f}`);
  if (open) {
    console.error(
      '\n✗ CORRECTIONS GATE FAILED — a claim we PROVED false is still live in the published archive (or we could not prove otherwise). Detection without repair is not a truth system.'
    );
    return 1;
  }
  console.log(
    `\n✓ Every logged correction has landed${localOnly ? ' on disk' : ' in the file the READER actually sees (origin/main)'}.`
  );
  return 0;
}

process.exit(main());
