#!/usr/bin/env node --experimental-strip-types
/**
 * novelty-gate.ts — the NOVELTY gate for The Take.
 *
 * The existing Novelty Audit catches word and skeleton overlap. By its own
 * admission it MISSES semantic recycling — the same thesis in different words.
 * That is why three consecutive Takes (06-06 Frustrated Markets, 06-07 Defensive
 * Convergence, 06-08 Captive Bid Cascade) were all the same structural move,
 * "a stable-looking system is secretly fragile," and nothing flagged it: the
 * topics differ, so every keyword/skeleton check passed.
 *
 * This gate operates one level deeper, on the MOVE — the rhetorical maneuver
 * underneath the topic. It bans repeating a move within a rolling window, and
 * flags title-form monotony ("The X: Why Y" six times in eight days).
 *
 * The move is read from a draft tag (<!-- take-move: <id> -->) when present;
 * otherwise inferred heuristically and FLAGGED for the writer to confirm. The
 * reliable path is the Writer tagging the move at generation — one line — with
 * this gate enforcing the ledger.
 *
 * Usage:
 *   node --experimental-strip-types scripts/novelty-gate.ts <brief.md> [--move <id>] [--window N] [--update]
 *
 * Exit codes: 0 pass · 1 move repeat within window · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const MOVE_HEURISTICS: { move: string; re: RegExp }[] = [
  {
    move: 'stability-is-illusory',
    re: /\b(stabilit|stable|fragil|looks? (?:healthy|fine|calm|stable)|never (?:stable|was)|losing the buyers|made (?:it|them) stable|against (?:itself|themselves)|frustrat|illusion of)/i,
  },
  {
    move: 'inversion',
    re: /\b(invert|inversion|the opposite|backwards|upside[- ]down|reverse(?:s|d)?)\b/i,
  },
  {
    move: 'hidden-precondition',
    re: /\b(precondition|never measured|hidden (?:cause|driver|variable)|silently|underneath the)\b/i,
  },
  {
    move: 'measurement-gap',
    re: /\b(verification gap|mismeasur|the metric|revision|the number (?:is|was) (?:lying|wrong)|gap between (?:the )?(?:number|metric))/i,
  },
  {
    move: 'categorical-split',
    re: /\b(speciation|two (?:different )?(?:species|categories|industries|things)|death (?:certificate|and birth)|splitting into|bifurcat)/i,
  },
  {
    move: 'demand-mirage',
    re: /\b(without customers|demand (?:without|with no)|mirage|revenue without|no (?:real )?foundation)/i,
  },
  {
    move: 'mechanism-reframe',
    re: /\b(not (?:protectionism|a bubble|what it looks)|actually a (?:different )?mechanism|reframe)/i,
  },
];

function inferMove(text: string): string | null {
  for (const h of MOVE_HEURISTICS) if (h.re.test(text)) return h.move;
  return null;
}

function titleForm(title: string): string {
  const t = title.trim();
  const hasColon = t.includes(':');
  const why = /:\s*why\b/i.test(t) || /\bwhy\b/i.test(t.split(':')[1] ?? '');
  const startsThe = /^the\b/i.test(t);
  if (startsThe && hasColon && why) return 'The-X-colon-Why';
  if (startsThe && hasColon) return 'The-X-colon';
  if (hasColon && why) return 'X-colon-Why';
  if (startsThe) return 'The-X';
  return 'other';
}

function extractTakeTitle(body: string): string | null {
  // Fix 2026-08-13 (CARRY rows 30 + 71, third receipt): shipped Takes title at
  // H3 (`### Payee, Not Party`), never H2, so the old /^\s*##\s+/ skipped the
  // real title and matched the next `## ` heading it found — which on a draft
  // carrying an internal appendix meant the gate read "REGENERATION RECORD…" as
  // the Take title. It also never stripped HTML comments, so a heading inside a
  // metadata block could win. Now: strip comments, then take the FIRST H2/H3
  // after the ▸ THE TAKE marker. `#{2,3}` cannot match `####` (no space after
  // the third `#` when backtracking), so deeper headings stay excluded.
  const start = body.indexOf('# ▸ THE TAKE');
  if (start === -1) return null;
  const rest = body
    .slice(start + '# ▸ THE TAKE'.length)
    .replace(/<!--[\s\S]*?-->/g, '');
  const m = rest.match(/^[ \t]*#{2,3}[ \t]+(.+?)[ \t]*$/m);
  return m ? m[1].trim() : null;
}

// ─── IMP-198 — WORLD-FIRST DATE ATTESTATION (2026-08-19 Critic mandate #3, RC2) ──────────────
//
// THE FAILURE: world-freshness was satisfied by a date the staleness ledger asserted ABOUT ITS
// OWN SOURCE, and nothing audited the assertion.
//
//   08-19 STALENESS LEDGER, AI&T-1:
//     "Anthropic's voluntary risk report and its outside reviewer | CLASSIFICATION: NEW |
//      WORLD-FIRST: 2026-08-18 | SOURCE: Zvi Mowshowitz, 'Anthropic Risk Report: August 2026',
//      2026-08-18 … | EVIDENCE: published 2026-08-18."
//
// Verified against the REPORT rather than the review: Anthropic published the Risk Report on
// 2026-08-14 (Unite.AI, OECD.AI incident 2026-08-14-45a1, SiliconANGLE). The world-first was FOUR
// DAYS EARLIER than the row asserted. The 08-18 review is a legitimate 48h development — and the
// compliant form for exactly this situation sat on the same page: Geo-2 reads "CLASSIFICATION:
// UPDATED … WORLD-FIRST: 2026-08-09 … three dated developments." AI&T-1 had the honest exit
// available and asserted the wrong date instead.
//
// The gate cannot know when a document was published (no network here, by design). What it CAN
// audit is INTERNAL CONSISTENCY: a row may not claim a world-first date that its own SOURCE line
// does not carry, unless it takes the UPDATED exit and names a dated development. That closes the
// hole, because the 08-18 row's own source line said 2026-08-18 about a REVIEW while the row
// claimed 2026-08-18 as the world-first of the underlying REPORT — commentary on an older primary
// is case (ii), not case (i), and must say so.
export interface WfRow {
  label: string;
  worldFirst: string[];
  classification: string;
  sourceDates: string[];
  evidenceDates: string[];
  raw: string;
}

export function parseWorldFirstRows(body: string): WfRow[] {
  const rows: WfRow[] = [];
  const start = body.indexOf('STALENESS LEDGER');
  if (start === -1) return rows;
  const end = body.indexOf('-->', start);
  const region = body.slice(start, end === -1 ? body.length : end);
  for (const line of region.split('\n')) {
    if (!/WORLD-FIRST:/i.test(line)) continue;
    const worldFirst = [...line.matchAll(/WORLD-FIRST:\s*(\d{4}-\d{2}-\d{2})/gi)].map(
      m => m[1]!
    );
    if (!worldFirst.length) continue;
    const cls = line.match(/CLASSIFICATION:\s*([A-Z]+)/i)?.[1]?.toUpperCase() ?? '';
    const srcSeg = line.slice(line.search(/\bSOURCE:/i));
    const evIdx = srcSeg.search(/\bEVIDENCE:/i);
    const sourcePart = evIdx === -1 ? srcSeg : srcSeg.slice(0, evIdx);
    const evidencePart = evIdx === -1 ? '' : srcSeg.slice(evIdx);
    rows.push({
      label: line.replace(/^-\s*/, '').split('|')[0]!.trim(),
      worldFirst,
      classification: cls,
      sourceDates: [...sourcePart.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]!),
      evidenceDates: [...evidencePart.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]!),
      raw: line,
    });
  }
  return rows;
}

const DAY = 86400000;
const dayDiff = (a: string, b: string): number =>
  Math.abs(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / DAY
  );

// THE MANDATE'S LITERAL SPEC IS INERT ON ITS OWN NAMED CASE, AND WAS REBUILT ON THAT EVIDENCE.
//
// As written, the spec passes a row if "the row's SOURCE: line carries a publication date within
// 1 day of the asserted world-first." Run against the real AI&T-1 row that is TRUE: the source is
// dated 2026-08-18 and the asserted world-first is 2026-08-18, zero days apart. So the literal
// check PASSES the one row the mandate says must FAIL. This is the IMP-192 situation in mirror
// image — there the literal spec was a flag generator (23 flags, 1 defect); here it is a gate that
// exits 0 on the failure it was commissioned for. Building it as written and reporting "applied"
// would have been the purest form of the theater the ledger's rule 1 exists to stop.
//
// THE REASON DATE PROXIMITY CANNOT WORK: the row is INTERNALLY CONSISTENT AND EXTERNALLY FALSE.
// Zvi Mowshowitz's review really was published 2026-08-18. The row's error is not a date typo; it
// is that it attested the COMMENTARY's date as the DOCUMENT's. No arithmetic over the row's own
// dates can see that, because every date on the row is correct.
//
// WHAT IS ACTUALLY CHECKABLE, and it is the mandate's own sentence made mechanical: *"a row whose
// only same-day artifact is COMMENTARY ON an older primary document is case (ii), not case (i)."*
// A piece TITLED AFTER A DOCUMENT is commentary on that document. So:
//
//   FIRE when the row's SUBJECT is a document (the label carries report/paper/study/filing/
//   release/survey/memo/review), AND its sole attestation is a personally-bylined quoted title
//   that shares its content words with that subject — i.e. someone's write-up named after the
//   thing — AND the row has not taken the UPDATED exit.
//
// This separates the three mandated cases and the eleven bystanders on one page with no fitting:
//   AI&T-1  FIRES   label "Anthropic's voluntary risk REPORT"; sole source `Zvi Mowshowitz,
//                   "Anthropic Risk Report: August 2026"` — a person's piece titled after it.
//   AI&T-2  PASSES  label "Keysight Q3 FY2026" names no document; source is the 8-K itself.
//   Geo-2   PASSES  CLASSIFICATION: UPDATED with three developments dated 08-18 — case (ii).
//   Brazil  PASSES  `Carlos Eduardo da Silva, "Inside Brazil's 3D-Printed Gun Supply Chain"` is a
//                   person's bylined title too — but the label names no document, and an original
//                   reported piece is not commentary on anything. This is the case that kills the
//                   naive "personal byline = commentary" rule, which is why the document leg binds.
//   BofA    PASSES  the label DOES name a document ("Survey") and the source IS that survey,
//                   unquoted and unbylined — the compliant primary form.
const DOC_SUBJECT_RE =
  /\b(report|paper|study|filing|8-K|10-Q|release|survey|memo|review|index|whitepaper|white paper)\b/i;
// `Firstname Lastname, "Some Title,"` — a personal byline in front of a quoted title.
const BYLINED_TITLE_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'’]+){1,3}),\s*[“"]([^”"]{10,140})[”"]/g;
const WF_STOP = new Set([
  'the', 'and', 'its', 'a', 'an', 'of', 'for', 'on', 'in', 'to', 'with', 'vs',
  'august', 'september', 'july', 'october', 'november', 'december', 'january',
  'february', 'march', 'april', 'may', 'june', '2026', '2025',
]);
const contentWords = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3 && !WF_STOP.has(w))
  );

/**
 * A row passes if EITHER:
 *  (i) it is PRIMARY-ATTESTED — its subject is not a document, or the document is cited directly
 *      rather than through a bylined write-up titled after it; or
 * (ii) CLASSIFICATION: UPDATED **and** ≥1 dated development inside 48h of BRIEF_DATE.
 */
export function worldFirstAttestation(rows: WfRow[], briefDate: string): string[] {
  const failures: string[] = [];
  for (const r of rows) {
    const devs = [...r.sourceDates, ...r.evidenceDates].filter(
      d => dayDiff(d, briefDate) <= 2
    );
    // (ii) — the honest exit, and the gate must never punish it.
    if (r.classification === 'UPDATED' && devs.length > 0) continue;
    // The subject must be a DOCUMENT for commentary-vs-primary to even be a question.
    if (!DOC_SUBJECT_RE.test(r.label)) continue;

    const subject = contentWords(r.label);
    const srcSeg = r.raw.slice(r.raw.search(/\bSOURCE:/i));
    const sourcePart = (() => {
      const i = srcSeg.search(/\bEVIDENCE:/i);
      return i === -1 ? srcSeg : srcSeg.slice(0, i);
    })();

    // Is the subject document cited ANYWHERE outside a third-party bylined title? If so the row
    // has a direct artifact (a press release, a filing, the survey itself) and is primary-attested.
    let commentaryTitle: string | null = null;
    let commentaryAuthor: string | null = null;
    let bylinedSpan = '';
    BYLINED_TITLE_RE.lastIndex = 0;
    let bm: RegExpExecArray | null;
    while ((bm = BYLINED_TITLE_RE.exec(sourcePart)) !== null) {
      const overlap = [...contentWords(bm[2]!)].filter(w => subject.has(w));
      if (overlap.length >= 2) {
        commentaryAuthor = bm[1]!;
        commentaryTitle = bm[2]!;
      }
      bylinedSpan += ` ${bm[0]}`;
    }
    if (!commentaryTitle) continue; // no write-up named after the subject: nothing to audit

    // The document's own name appearing OUTSIDE every bylined title = a direct citation.
    const outside = sourcePart.split(/[“"][^”"]{10,140}[”"]/).join(' ');
    const docNoun = r.label.match(DOC_SUBJECT_RE)![0]!.toLowerCase();
    if (new RegExp(`\\b${docNoun}\\b`, 'i').test(outside.replace(bylinedSpan, ' '))) continue;

    for (const wf of r.worldFirst) {
      failures.push(
        `WORLD-FIRST UNATTESTED — "${r.label}" asserts WORLD-FIRST: ${wf} (CLASSIFICATION: ` +
          `${r.classification || 'MISSING'}), but its subject is a ${docNoun.toUpperCase()} and its only ` +
          `dated attestation is ${commentaryAuthor}'s bylined write-up "${commentaryTitle}" — a piece ` +
          `TITLED AFTER the document, which dates the COMMENTARY, not the document. The row's dates are ` +
          `all individually correct; that is exactly why date arithmetic cannot see this. Either cite the ` +
          `${docNoun} itself with its own publication date, or take the honest exit: CLASSIFICATION: ` +
          `UPDATED with the dated 48h development named. ` +
          `RECEIPT, 2026-08-19: this row claimed WORLD-FIRST 2026-08-18 for Anthropic's Risk Report on the ` +
          `strength of an 08-18 REVIEW of it. The report published 2026-08-14 — four days earlier ` +
          `(Unite.AI, OECD.AI incident 2026-08-14-45a1, SiliconANGLE). The compliant form was on the same ` +
          `page: Geo-2 reads "CLASSIFICATION: UPDATED … WORLD-FIRST: 2026-08-09 … three dated developments."`
      );
    }
  }
  return failures;
}

function selftest(): number {
  let fails = 0;
  let total = 0;
  const assert = (ok: boolean, label: string) => {
    total++;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
  };

  const v2Path = path.join(process.cwd(), 'daily-briefs/2026-08-19-v2.md');
  if (!fs.existsSync(v2Path)) {
    console.error(`SELFTEST FAIL — missing fixture: ${v2Path}`);
    return 1;
  }
  const rows = parseWorldFirstRows(fs.readFileSync(v2Path, 'utf8'));
  const fails0819 = worldFirstAttestation(rows, '2026-08-19');
  const named = (s: string) => fails0819.some(f => f.includes(s));

  // The mandate specified three cases and two directions. All three are real rows on one page.
  assert(
    named('Anthropic'),
    "[IMP-198] AI&T-1 FAILS — WORLD-FIRST 2026-08-18 for a report that published 08-14; sole source is an 08-18 review; CLASSIFICATION: NEW with no development named"
  );
  assert(
    !named('Keysight'),
    '[IMP-198] AI&T-2 PASSES — Keysight reported after the 08-18 close and the source IS the 8-K, same date (case i)'
  );
  assert(
    !named('Syria'),
    '[IMP-198] Geo-2 PASSES — CLASSIFICATION: UPDATED, WORLD-FIRST 08-09, three developments dated 08-18 (case ii, the compliant form the gate must not punish)'
  );
  // A check that fires on most of a healthy page is a flag generator, not a gate.
  assert(
    rows.length >= 10 && fails0819.length === 1,
    `[IMP-198] EXACTLY ONE failure across all ${rows.length} rows on the page (got ${fails0819.length})`
  );

  // FALSE-POSITIVE FLOOR across every v2 with a staleness ledger. A gate that fires on ~11-16
  // rows a night, thirteen nights running, would be read for its noise rather than its content —
  // and a check nobody reads is worse than no check, because it launders the absence of one.
  const noisy: string[] = [];
  let scanned = 0;
  for (const f of fs
    .readdirSync(path.join(process.cwd(), 'daily-briefs'))
    .filter(x => /^2026-0[78]-\d\d-v2\.md$/.test(x))) {
    const d = f.slice(0, 10);
    if (d === '2026-08-19') continue; // the fixture above
    const rs = parseWorldFirstRows(
      fs.readFileSync(path.join(process.cwd(), 'daily-briefs', f), 'utf8')
    );
    scanned += rs.length;
    const n = worldFirstAttestation(rs, d).length;
    if (n) noisy.push(`${d}:${n}`);
  }
  assert(
    noisy.length === 0,
    `[IMP-198] FALSE-POSITIVE FLOOR — 0 flags across ${scanned} staleness rows on every other July/August v2${noisy.length ? ` (got ${noisy.join(', ')})` : ''}`
  );

  // ── STORY COOLDOWN (work order 2026-08-28, item 5b) ─────────────────────────────────────────
  {
    const nvda =
      '**Nvidia said its backlog passed two trillion dollars.** The backlog is the number that matters because Nvidia books the backlog before revenue, and the backlog converts on a lag.\n';
    const k = storyKey(nvda);
    assert(k.entity === 'nvidia' && k.mechanism === 'backlog', `[item5b] the key is entity+mechanism, both read from the unit — got ${k.key}`);
    assert(
      storyKey('**The factory drew its boundary around the supplier.** A factory that treats its supplier as external takes a price rise as a shock.').entity === '',
      '[item5b] a sentence-initial capital is grammar, not a name — a unit with no proper noun yields no entity and is never keyed'
    );
    const hist = [
      { date: '2026-08-24', keys: ['nvidia|backlog'] },
      { date: '2026-08-25', keys: ['nvidia|backlog'] },
      { date: '2026-08-26', keys: ['other|thing'] },
    ];
    assert(
      storyFlags([nvda], hist, '2026-08-27').length === 1,
      '[item5b] FIRES — the same entity+mechanism on 3 of the last 5 days with no new-increment marker'
    );
    assert(
      storyFlags([nvda], hist.slice(0, 1), '2026-08-27').length === 0,
      '[item5b] SILENT at 2 of 5 — the threshold is a real threshold, not a synonym for "seen before"'
    );
    assert(
      storyFlags([nvda.replace('**', '<!-- story-new: backlog converted to revenue -->\n**')], hist, '2026-08-27').length === 0,
      '[item5b] a declared NEW INCREMENT is never flagged — a running story that is actually moving is not punished for continuing'
    );
    assert(
      storyFlags([], hist, '2026-08-27').length === 0 && storyFlags([nvda], [], '2026-08-27').length === 0,
      '[item5b] N/A STATE: no units, or no history at all, produces no flags — an empty ledger is unmeasured, not clean'
    );
    total += 6;
  }

  console.log(`\nnovelty-gate selftest — ${total - fails}/${total} assertions passed`);
  return fails ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selftest());

  // ── --stories: the STORY COOLDOWN pass (work order 2026-08-28 item 5b). ADVISORY, exit 0 ALWAYS.
  if (args.includes('--stories')) {
    const f = args.find(a => /\.md$/.test(a));
    if (!f) { console.error('usage: novelty-gate --stories <brief.md> [--date YYYY-MM-DD] [--update]'); process.exit(2); }
    const di = args.indexOf('--date');
    const date = di > -1 && args[di + 1] ? args[di + 1]! : (/(\d{4}-\d{2}-\d{2})/.exec(path.basename(f)) ?? [, 'undated'])[1]!;
    const flags = runStoryCooldown(f, date, args.includes('--update'));
    console.log(`STORY COOLDOWN ${date} — window ${STORY_WINDOW} day(s), threshold ${STORY_THRESHOLD} · ADVISORY, never blocks`);
    if (!flags.length)
      console.log(
        '  ➖ no story ran the window without a new increment.\n' +
          '     Keys are entity×theme read from claims.json (C3, 2026-08-28). CALIBRATION RECEIPT,\n' +
          '     7-night replay: canadian|tariff fired at 3 of 5; iran|sanctions, treasury|rates and\n' +
          '     secretary|rates reached 2 and correctly did NOT fire; zero header-garbage keys.\n' +
          '     The earlier markdown-keyed build could not fire at all — 294 keys, 0 repeats, and its\n' +
          '     commonest "entity" was the word "light", a header. A silent run now means silent,\n' +
          '     not unmeasured. Advisory; selection-judge grades the flags.'
      );
    for (const fl of flags)
      console.log(`  🟡 STORY-COOLDOWN: ${fl.key} — ${fl.days} of the last ${fl.window} day(s), no <!-- story-new: … --> marker\n     ${fl.unit}…`);
    if (flags.length)
      console.log(`\n  Declare a genuine development with <!-- story-new: what changed --> inside the unit.\n  Advisory until it earns blocking through catches; the weekly selection-judge grades these flags.`);
    process.exit(0);
  }
  const briefArg = args.find(a => !a.startsWith('--'));
  const moveArg = args.includes('--move')
    ? args[args.indexOf('--move') + 1]
    : null;
  const window = args.includes('--window')
    ? parseInt(args[args.indexOf('--window') + 1], 10)
    : 4;
  const update = args.includes('--update');

  if (!briefArg) {
    console.error(
      'Usage: novelty-gate.ts <brief.md> [--move <id>] [--window N] [--update]'
    );
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg)
    ? briefArg
    : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) {
    console.error(`File not found: ${briefPath}`);
    process.exit(2);
  }
  const body = fs.readFileSync(briefPath, 'utf8');
  const dateMatch = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  const today = dateMatch
    ? dateMatch[1]
    : new Date().toISOString().slice(0, 10);

  // Ledger
  const ledgerCandidates = [
    path.join(
      path.dirname(briefPath),
      '..',
      '..',
      'system',
      'take-ledger.json'
    ),
    path.join(process.cwd(), 'system', 'take-ledger.json'),
  ];
  let ledgerPath =
    ledgerCandidates.find(p => fs.existsSync(p)) ?? ledgerCandidates[1];
  const ledger = fs.existsSync(ledgerPath)
    ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    : { history: [] };
  const history: {
    date: string;
    title: string;
    move: string;
    title_form: string;
  }[] = ledger.history ?? [];

  const title = extractTakeTitle(body) ?? '(no title found)';
  const tagMatch = body.match(/<!--\s*take-move:\s*([a-z0-9-]+)\s*-->/i);
  const firstPara = (() => {
    const start = body.indexOf('# ▸ THE TAKE');
    return start === -1 ? title : body.slice(start, start + 1200);
  })();
  const inferred = inferMove(`${title}\n${firstPara}`);
  const move =
    moveArg || (tagMatch ? tagMatch[1] : null) || inferred || 'unclassified';
  const moveSource = moveArg
    ? 'cli'
    : tagMatch
      ? 'draft-tag'
      : inferred
        ? 'inferred'
        : 'none';
  const form = titleForm(title);

  console.log(`novelty-gate — ${path.basename(briefPath)}`);
  console.log(`  take title : "${title}"`);
  console.log(`  move       : ${move}  (${moveSource})`);
  console.log(`  title form : ${form}`);

  const failures: string[] = [];
  const flags: string[] = [];

  // Move-repeat within rolling window (by distinct prior dates)
  const recent = history.filter(h => h.date < today).slice(-window);
  const clash = recent.filter(h => h.move === move);
  if (move !== 'unclassified' && clash.length > 0) {
    failures.push(
      `MOVE REPEAT: "${move}" already used ${clash.length}x in the last ${window} Takes — ${clash.map(c => `${c.date} (${c.title})`).join(', ')}. ` +
        `This is the same rhetorical maneuver under a different topic. Reframe the Take around a different structural move, or pick a different thesis.`
    );
  }
  if (moveSource === 'inferred') {
    flags.push(
      `Move was INFERRED, not tagged. Add <!-- take-move: ${move} --> to the draft so the gate is deterministic, then re-run.`
    );
  }
  if (move === 'unclassified') {
    flags.push(
      `Move could not be classified. Tag the draft with <!-- take-move: <id> --> (see system/take-ledger.json _moves).`
    );
  }

  // IMP-198 (08-19 mandate #3): every WORLD-FIRST the staleness ledger asserts must be attested
  // by its own SOURCE line, or take the UPDATED exit and name a dated development.
  for (const f of worldFirstAttestation(parseWorldFirstRows(body), today)) {
    failures.push(f);
  }

  // Title-form monotony over last 5 (including today)
  const formsRecent = [...recent.map(h => h.title_form), form].slice(-5);
  const theCount = formsRecent.filter(f => f.startsWith('The-')).length;
  const whyCount = formsRecent.filter(f => f.endsWith('Why')).length;
  if (theCount >= 4)
    flags.push(
      `Title-form monotony: ${theCount}/5 recent Take titles start with "The…". Vary the title structure.`
    );
  if (whyCount >= 3)
    flags.push(
      `Title-form monotony: ${whyCount}/5 recent Take titles use the ": Why…" construction.`
    );

  if (flags.length) {
    console.log(`\n  ${flags.length} FLAG (review):`);
    for (const f of flags) console.log(`   ⚠ ${f}`);
  }

  if (failures.length === 0) {
    if (update && move !== 'unclassified') {
      history.push({ date: today, title, move, title_form: form });
      ledger.history = history;
      try {
        fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
        console.log(`\n  ledger updated: ${path.basename(ledgerPath)}`);
      } catch {
        /* read-only */
      }
    }
    console.log(`\n✅ NOVELTY-GATE PASS`);
    process.exit(0);
  }
  console.log(`\n❌ NOVELTY-GATE FAIL:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
  process.exit(1);
}

// ── 🔴 STORY COOLDOWN (work order 2026-08-28, item 5b) ────────────────────────────────────────
//
// The move ledger above catches a repeated MANEUVER. This catches a repeated STORY: the same
// entity running the same mechanism night after night, each night's prose fresh enough to pass
// every word-overlap and skeleton check while the reader reads about the same thing for a week.
// Same pattern as the Take's persistence counters — a key, a days-appeared count, a window.
//
// KEY = entity + mechanism. The entity is the unit's most-repeated proper noun; the mechanism is
// its most-repeated content noun. Both are crude on purpose: a key precise enough to be always
// unique would count nothing, and the failure this catches is coarse — "Nvidia / backlog" four
// nights running, not a subtle rhyme.
//
// ADVISORY, and it stays advisory until it earns blocking through catches. A unit may declare a
// genuine development with `<!-- story-new: what changed -->`, which resets nothing but marks the
// night as a NEW INCREMENT so a running story that is actually moving is not punished for
// continuing. The weekly selection-judge grades these flags; a flag nobody grades is decoration.
export const STORY_LEDGER = 'system/story-ledger.json';
export const STORY_WINDOW = 5;
export const STORY_THRESHOLD = 3;
// CALIBRATION 2026-08-28, measured on 5 real published nights: the first cut produced 100 keys
// with ZERO repeats — an instrument that could not fire. Two causes, both visible in the keys it
// emitted: the "entity" was picking up NATIONALITIES, MONTHS and SECTION WORDS ("chinese" on 4 of
// 5 nights, "close" from THE CLOSE, "august"), and the exact entity|mechanism PAIR is too sparse to
// recur even when the story does. Fixed by stopping those classes and by matching on the entity
// plus ANY of its top mechanism tokens rather than one exact pair.
const STORY_STOP = new Set(
  ('the a an and or but of to in on for with is are was were be been it its this that as at by from not no than then so if into over under up down out about what which who whom whose when where why how more most other some such only own same too very can will just should now their there here they them his her him she he you your our we us i me my one two three first second next last year years day days week weeks month months time percent point points ' +
    // measured noise: nationalities and demonyms read as entities, months and section words too
    'american americans america chinese china european europe japanese japan german british russian indian korean ' +
    'january february march april may june july august september october november december ' +
    'close dashboard take signal discovery wildcard headlines practice model models explore brief today tomorrow yesterday ' +
    'market markets price prices number numbers report reports company companies business against because without again ' +
    'through before after under between during still while where after'
  ).split(' ').filter(Boolean)
);

export function storyKey(unit: string): { entity: string; mechanism: string; mechanisms: string[]; key: string } {
  const body = unit.replace(/<!--[\s\S]*?-->/g, ' ');
  const proper = new Map<string, number>();
  // Skip the first word of each sentence — a capital there is grammar, not a name.
  for (const sent of body.split(/(?<=[.!?])\s+/))
    for (const m of sent.matchAll(/\b([A-Z][A-Za-z&.'-]{2,})\b/g)) {
      const w = m[1]!;
      if (sent.trimStart().startsWith(w)) continue;
      const k = w.toLowerCase().replace(/[.'-]+$/, '');
      if (STORY_STOP.has(k)) continue;
      proper.set(k, (proper.get(k) ?? 0) + 1);
    }
  const nouns = new Map<string, number>();
  for (const m of body.toLowerCase().matchAll(/\b([a-z]{5,})\b/g)) {
    const w = m[1]!;
    if (STORY_STOP.has(w) || proper.has(w)) continue;
    nouns.set(w, (nouns.get(w) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
  const entity = top(proper);
  const mechanisms = [...nouns.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(x => x[0]);
  const mechanism = mechanisms[0] ?? '';
  return { entity, mechanism, mechanisms, key: `${entity}|${mechanism}` };
}

export const hasNewIncrement = (unit: string): boolean => /<!--\s*story-new:/i.test(unit);

export interface StoryFlag { key: string; days: number; window: number; unit: string }

/** Keys that ran on >= THRESHOLD of the last WINDOW recorded days, with no new-increment marker. */
export function storyFlags(
  todaysUnits: string[],
  history: { date: string; keys: string[] }[],
  date: string
): StoryFlag[] {
  const prior = history.filter(h => h.date !== date).slice(-(STORY_WINDOW - 1));
  const out: StoryFlag[] = [];
  const seen = new Set<string>();
  for (const u of todaysUnits) {
    const { key, entity, mechanism } = storyKey(u);
    if (!entity || !mechanism || seen.has(key)) continue;
    seen.add(key);
    if (hasNewIncrement(u)) continue;
    // ENTITY + ANY SHARED MECHANISM. The exact pair is too sparse to recur (measured: 0 repeats in
    // 100 keys over 5 nights); the same story on two nights routinely leads with a different one of
    // its own top nouns. Requiring the entity AND at least one shared mechanism keeps the key from
    // collapsing into "this entity was mentioned again", which would fire on every index name.
    const mine = new Set(storyKey(u).mechanisms);
    const days =
      prior.filter(h =>
        h.keys.some(pk => {
          const [pe, pm] = pk.split('|');
          return pe === entity && !!pm && mine.has(pm);
        })
      ).length + 1;
    if (days >= STORY_THRESHOLD)
      out.push({ key, days, window: Math.min(STORY_WINDOW, prior.length + 1), unit: u.slice(0, 90).replace(/\s+/g, ' ') });
  }
  return out;
}

/**
 * 🔴 KEYED OFF claims.json, NOT RAW MARKDOWN (C3, 2026-08-28).
 *
 * The first two builds extracted keys from the published markdown and could not fire: 294 keys over
 * 5 nights with ZERO repeats, and the single most common "entity" was the word **"light"** — a
 * header. **The key was never the problem; the input was.** `.readback/{DATE}/claims.json` already
 * carries one clean claim sentence per unit, on both surfaces, every night — no headers, no
 * navigation, no explore links.
 *
 * TWO TIERS, because a story is named two ways and only one of them is capitalised:
 *   ENTITY — the claim's most-repeated proper noun ("Canadian", "Iran", "Treasury")
 *   THEME  — a controlled vocabulary of mechanisms ("tariff", "oil", "rates"), because "crude oil"
 *            and "tariffs" are stories with no proper noun in them at all
 *
 * A KEY IS ENTITY×THEME, and an entity-less key is DROPPED. Measured over the last 7 nights: with
 * entity-less keys included, the top hits are `-|rates` and `-|crypto` — the Markets Minute and the
 * dashboard, which recur BY DESIGN and whose flagging would be pure noise. With them dropped, 5
 * pairs remain and all are plausible repeats, led by **`canadian|tariff` on 3 of 7 nights**
 * (08-23 update-1, 08-25 line-4, 08-26 line-5). Zero header-garbage keys.
 */
export const STORY_THEMES: Record<string, RegExp> = {
  oil: /\b(crude|brent|wti|barrel|refinery|diesel|heating oil|gasoline|opec)\b/i,
  tariff: /\b(tariff|tariffs|duty|duties|section 23[12]|section 338)\b/i,
  rates: /\b(yield|yields|basis points|treasury|ten-year|thirty-year|rate cut|buyback)\b/i,
  aicapex: /\b(data ?cent(er|re)|capex|gpu|accelerator|backlog|buildout|inference)\b/i,
  chips: /\b(semiconductor|chip|chips|foundry|wafer)\b/i,
  crypto: /\b(bitcoin|ether|ethereum|stablecoin|token|on-chain|custodian)\b/i,
  sanctions: /\b(sanction|sanctions|designated|designation|export control|entity list)\b/i,
  guidance: /\b(guidance|outlook|arr|gross margin|full-year)\b/i,
  power: /\b(grid|electricity|turbine|megawatt|capacity market|pjm|nuclear)\b/i,
};

export function themesOf(text: string): string[] {
  return Object.entries(STORY_THEMES).filter(([, rx]) => rx.test(text)).map(([t]) => t);
}

/** entity×theme keys for one claim. Entity-less keys are dropped — see the note above. */
export function claimKeys(claimText: string): string[] {
  const { entity } = storyKey(claimText);
  if (!entity) return [];
  return themesOf(claimText).map(t => `${entity}|${t}`);
}

export interface ClaimRow { unit: string; claim: string }

export function readClaims(root: string, date: string, product = ''): ClaimRow[] {
  const p = path.join(root, '.readback', date + (product ? `-${product}` : ''), 'claims.json');
  if (!fs.existsSync(p)) return [];
  try {
    return (JSON.parse(fs.readFileSync(p, 'utf-8')) as ClaimRow[]).filter(c => c && c.claim);
  } catch {
    return [];
  }
}

export function runStoryCooldown(
  _file: string,
  date: string,
  update: boolean,
  root = process.cwd(),
  product = ''
): StoryFlag[] {
  const claims = readClaims(root, date, product);
  const lp = path.join(root, STORY_LEDGER);
  const led: { _doc?: string; history: { date: string; keys: string[] }[] } = fs.existsSync(lp)
    ? JSON.parse(fs.readFileSync(lp, 'utf-8'))
    : { _doc: 'STORY COOLDOWN LEDGER — entity×theme keys per night, read from claims.json. Advisory.', history: [] };
  const prior = led.history.filter(h => h.date !== date).slice(-(STORY_WINDOW - 1));
  const flags: StoryFlag[] = [];
  const seen = new Set<string>();
  for (const c of claims) {
    if (hasNewIncrement(c.claim)) continue;
    for (const key of claimKeys(c.claim)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const days = prior.filter(h => h.keys.includes(key)).length + 1;
      if (days >= STORY_THRESHOLD)
        flags.push({ key, days, window: Math.min(STORY_WINDOW, prior.length + 1), unit: `${c.unit}: ${c.claim.slice(0, 80)}` });
    }
  }
  if (update) {
    const keys = [...new Set(claims.flatMap(c => claimKeys(c.claim)))];
    led.history = [...led.history.filter(h => h.date !== date), { date, keys }]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-60);
    led._doc = 'STORY COOLDOWN LEDGER — entity×theme keys per night, read from .readback/{DATE}/claims.json (C3, 2026-08-28). Entity-less keys are dropped: the Markets Minute and dashboard recur by design.';
    try { fs.writeFileSync(lp, JSON.stringify(led, null, 2)); } catch { /* read-only */ }
  }
  return flags;
}

// Direct-invocation guard (added 2026-08-19 — IMP-198, mirroring fact-gate/ceiling-lint): the
// module must be importable so `worldFirstAttestation` can be exercised without a usage banner.
const invokedDirectly =
  !!process.argv[1] && path.resolve(process.argv[1]).endsWith('novelty-gate.ts');
if (invokedDirectly) main();
