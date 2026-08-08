#!/usr/bin/env node --experimental-strip-types
/**
 * killed-thesis-gate.ts — A THESIS KILLED AT SELECTION MUST NOT SHIP IN ANOTHER SECTION.
 *
 * IMP-134 · 2026-08-06 Critic mandate #2 · RC3 · the kill list was written by one stage and read
 * by nobody.
 *
 * ── THE FAILURE ────────────────────────────────────────────────────────────────────────────────
 * The take-draft tournament scores five candidates and kills four, in writing:
 *
 *   3. Rerouting is not risk reduction (Houthis re-targeting the diversion route; Iran having
 *      struck both Hormuz bypasses) — 2/4. KILLED ON GREP: this is the Apr 11 2026 Take
 *      (Redundancy Elimination Framework), same mechanism and partly the same evidence.
 *
 * Four hours later the 2026-08-06 v1 closed Geo-1 with: "Rerouting is not risk reduction when the
 * adversary re-targets the route you rerouted to." Verbatim, in a different section. The archive
 * check ran, returned the right answer, wrote it down, and the answer went into a prose comment
 * that no downstream stage opens. The Take was protected from repetition; the brief was not.
 *
 * ── WHY AN N-GRAM AND NOT A TOPIC MATCH ────────────────────────────────────────────────────────
 * The obvious implementation — flag a section that shares terms with a killed candidate — would
 * fire on every Geopolitics section covering the Houthi tanker story, because the kill was of a
 * THESIS, not of a TOPIC. Geo-1 is *supposed* to cover the news the killed Take was drawn from;
 * what it may not do is deliver that Take's conclusion. So the check is a contiguous word
 * sequence: 4+ consecutive words from the killed thesis clause, carrying 3+ non-stopwords,
 * reappearing in the draft. "Rerouting is not risk reduction" trips it. "Houthis attacked a
 * tanker near Yanbu" does not, and must not.
 *
 * That precision is the whole design. A repetition detector that also fires on legitimate coverage
 * gets waived by the third day, and a gate everyone waives is worse than no gate: it costs
 * attention and buys nothing.
 *
 * ── OUTPUTS ────────────────────────────────────────────────────────────────────────────────────
 * `--emit` writes `daily-briefs/{DATE}-killed-theses.json` — the kill list as data, one row per
 * killed candidate, so the tournament's own work becomes readable by anything downstream. The
 * gate does not depend on that file existing: it parses the take-draft directly, because a check
 * that needs a future stage to remember to write an artifact is a check with a prose dependency.
 *
 * Usage:
 *   killed-thesis-gate.ts <YYYY-MM-DD> [--stage v1|v2] [--emit]
 *   killed-thesis-gate.ts --selftest
 *
 * Exit codes: 0 clean (or no kill list on disk) · 1 a killed thesis was reproduced · 2 usage error.
 */
import * as fs from 'fs';
import * as path from 'path';

const EPOCH = '2026-08-07';
const STOP = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'not',
  'no',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'from',
  'as',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'you',
  'your',
]);
const MIN_NGRAM = 4; // consecutive words
const MIN_CONTENT = 3; // of which at least this many are not stopwords

export type Kill = { n: number; thesis: string; reason: string };

function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<!--[\s\S]*$/g, ' ');
}

export function norm(s: string): string[] {
  return stripHtmlComments(s)
    .toLowerCase()
    .replace(/\bre-([a-z])/g, 're$1')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Parse the tournament's kill lines. Shape (2026-08-06 take-draft, TOURNAMENT block):
 *   `  3. <thesis> (<evidence>) — 2/4. KILLED ON GREP: <reason>`
 * The thesis is the candidate's title: everything before the first parenthesis or em-dash.
 */
export function parseKills(takeDraft: string): Kill[] {
  const out: Kill[] = [];
  for (const line of takeDraft.split('\n')) {
    if (!/\bKILLED\b/.test(line)) continue;
    const m = /^\s*(\d+)\.\s*(.+)$/.exec(line);
    if (!m) continue;
    const body = m[2]!;
    const thesis = body
      .split(/\s+[—–-]\s+|\s*\(/)[0]!
      .trim()
      .replace(/^["“]|["”]$/g, '');
    const reason = (/\bKILLED[^:]*:\s*(.+)$/.exec(body)?.[1] ?? '').trim();
    if (thesis.length >= 12)
      out.push({ n: parseInt(m[1]!, 10), thesis, reason });
  }
  return out;
}

export type Reuse = { thesis: string; phrase: string; section: string };

/** Section heading immediately above a word index, so the finding names where it shipped. */
function sectionAt(draft: string, needle: string): string {
  const i = draft.toLowerCase().indexOf(needle.toLowerCase());
  if (i === -1) return '(unknown section)';
  const before = draft.slice(0, i).split('\n');
  for (let j = before.length - 1; j >= 0; j--)
    if (/^#{1,6}\s/.test(before[j]!))
      return before[j]!.replace(/^#+\s*/, '').trim();
  return '(unknown section)';
}

export function findReuse(draft: string, kills: Kill[]): Reuse[] {
  const visibleDraft = stripHtmlComments(draft);
  const hay = ` ${norm(visibleDraft).join(' ')} `;
  const out: Reuse[] = [];
  for (const k of kills) {
    const words = norm(k.thesis);
    let hit: string | null = null;
    for (let len = words.length; len >= MIN_NGRAM && !hit; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const gram = words.slice(i, i + len);
        if (gram.filter(w => !STOP.has(w)).length < MIN_CONTENT) continue;
        if (hay.includes(` ${gram.join(' ')} `)) {
          hit = gram.join(' ');
          break;
        }
      }
    }
    if (hit)
      out.push({
        thesis: k.thesis,
        phrase: hit,
        section: sectionAt(visibleDraft, hit),
      });
  }
  return out;
}

function readFirst(...paths: string[]): { body: string; path: string } | null {
  for (const p of paths)
    if (fs.existsSync(p)) return { body: fs.readFileSync(p, 'utf8'), path: p };
  return null;
}

function runOne(
  date: string,
  stage: string,
  emit: boolean,
  quiet = false
): number {
  const dir = path.join(process.cwd(), 'daily-briefs');
  const missing = (detail: string): number => {
    const blocks = date >= EPOCH;
    if (!quiet)
      console.log(
        `killed-thesis-gate — ${date}: ${detail}. ${blocks ? 'IN EPOCH — cannot enforce, blocking.' : `Pre-${EPOCH} — reported only.`}`
      );
    return blocks ? 1 : 0;
  };
  const td = readFirst(path.join(dir, `${date}-take-draft.md`));
  if (!td) return missing('take-draft is missing');
  const kills = parseKills(td.body);
  if (kills.length === 0)
    return missing(
      'take-draft parsed to zero killed candidates (format drift or an incomplete tournament)'
    );

  if (emit) {
    const outPath = path.join(dir, `${date}-killed-theses.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ date, source: path.basename(td.path), kills }, null, 2) +
        '\n'
    );
    if (!quiet)
      console.log(
        `  emitted ${path.basename(outPath)} — ${kills.length} killed candidate(s) now machine-readable`
      );
  }

  const draft =
    stage === 'v2'
      ? readFirst(path.join(dir, `${date}-v2.md`))
      : readFirst(
          path.join(dir, `${date}-v1.md`),
          path.join(dir, `${date}-v1-pre-quality-gate.md`)
        );
  if (!draft) return missing(`${stage} draft is missing`);

  const reuse = findReuse(draft.body, kills);
  if (!quiet) {
    console.log(
      `killed-thesis-gate — ${date} ${stage} (${kills.length} killed candidate(s) in ${path.basename(td.path)})`
    );
    for (const r of reuse) {
      console.log(
        `  🔴 [killed-thesis-reuse] "${r.thesis}" was killed at selection and its conclusion shipped in ${r.section}.`
      );
      console.log(`      reproduced phrase: "${r.phrase}"`);
      console.log(
        '      The tournament already did this research and already said no. Replace the conclusion, or overturn the kill in writing — do not let it in through another door.'
      );
    }
    if (!reuse.length)
      console.log('  ✅ no killed thesis reproduced in the draft.');
  }
  return reuse.length ? 1 : 0;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  // VERBATIM from daily-briefs/2026-08-06-take-draft.md (TOURNAMENT block).
  const TD = `TOURNAMENT
  1. The Maintenance Economy (EPB net-vs-gross investment, 23c of the gross dollar) — 2/4. KILLED: loudest analytical thread in the file; the insight is Basmajian's, so kill-Q5 fails.
  3. Rerouting is not risk reduction (Houthis re-targeting the diversion route; Iran having struck both Hormuz bypasses) — 2/4. KILLED ON GREP: this is the Apr 11 2026 Take (Redundancy Elimination Framework), same mechanism.
  5. The Enumerability Condition — 4/4. SELECTED.`;
  const kills = parseKills(TD);
  t(
    kills.length === 2 &&
      kills[1]!.thesis === 'Rerouting is not risk reduction',
    '[IMP-134] parses the kill list out of the tournament prose (2 kills, thesis extracted without its evidence parenthetical)'
  );
  t(
    !kills.some(k => /Enumerability/.test(k.thesis)),
    '[IMP-134] does NOT treat the SELECTED candidate as killed'
  );

  // VERBATIM from daily-briefs/2026-08-06-v1-pre-quality-gate.md, Geo-1's closer.
  const GEO = `## Geopolitics\n**A second chokepoint escalated to a sunk vessel on Wednesday.** Houthi spokesman Yahya Saree said the Saudi product tanker Wafa was struck off Yanbu, the eighth tanker targeted since the movement declared a maritime blockade on July 22. Rerouting is not risk reduction when the adversary re-targets the route you rerouted to.`;
  const r = findReuse(GEO, kills);
  t(
    r.length === 1 &&
      /rerouting is not risk reduction/.test(r[0]!.phrase) &&
      /Geopolitics/.test(r[0]!.section),
    '[IMP-134] FIRES on the real 08-06 Geo-1 closer — a thesis killed on grep, shipped in another section'
  );

  // THE FALSE-POSITIVE CASE, and the reason the check is an n-gram: the same topic, same actors,
  // same news — WITHOUT the killed conclusion — is exactly what Geo-1 is supposed to contain.
  const TOPIC_ONLY = `## Geopolitics\n**A second chokepoint escalated to a sunk vessel.** The Houthis struck the Wafa off Yanbu after the kingdom diverted ships away from Bab el-Mandeb, and Brent gave back its gain the same afternoon. The shipowner's question is what a war-risk premium is worth when the underwriter cannot name the safe route.`;
  t(
    findReuse(TOPIC_ONLY, kills).length === 0,
    '[IMP-134] SILENT on the same topic, actors and evidence without the killed conclusion — the kill was of a thesis, not a subject'
  );
  t(
    findReuse(
      '## Markets & Macro\nThe risk is not reduction of supply but of the route.',
      kills
    ).length === 0,
    '[IMP-134] SILENT on scattered shared words that are not a contiguous phrase'
  );
  t(
    findReuse(
      '## Geopolitics\n<!-- Rerouting is not risk reduction when the route moves. -->\nVisible prose reaches a different conclusion.',
      kills
    ).length === 0,
    '[IMP-134] SILENT when the killed thesis appears only inside an HTML comment'
  );
  t(
    findReuse(
      '## Geopolitics\nRe-routing is not risk reduction when the adversary follows the diversion.',
      kills
    ).length === 1,
    '[IMP-134] FIRES through the visible re-routing/rerouting hyphen variant'
  );

  // Live acceptance legs: the Critic asked for SILENT on 08-05 and 08-04.
  for (const d of ['2026-08-05', '2026-08-04']) {
    t(
      runOne(d, 'v1', false, true) === 0,
      `[IMP-134] EXIT 0 on the real ${d} v1 (the Critic's silent-case acceptance leg)`
    );
  }
  const live = runOne('2026-08-06', 'v1', false, true);
  t(
    live === 1,
    '[IMP-134] EXIT 1 on the real 2026-08-06 v1 — the acceptance case, end to end on disk'
  );
  t(
    runOne('2099-01-01', 'v1', false, true) === 1,
    '[IMP-134] FAILS CLOSED in epoch when the take-draft is missing'
  );

  console.log(
    `\nkilled-thesis-gate selftest — ${fails ? 'FAILED' : 'PASS'} (parse + reuse + topic-only silence verified both directions)`
  );
  return fails ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error(
      'Usage: killed-thesis-gate.ts <YYYY-MM-DD> [--stage v1|v2] [--emit] | --selftest'
    );
    return 2;
  }
  const si = args.indexOf('--stage');
  const stage = si === -1 ? 'v1' : args[si + 1] || '';
  if (!['v1', 'v2'].includes(stage)) {
    console.error('--stage must be v1 or v2');
    return 2;
  }
  return runOne(date, stage, args.includes('--emit'));
}

const invokedDirectly =
  !!process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('killed-thesis-gate.ts');
if (invokedDirectly) process.exit(main());
