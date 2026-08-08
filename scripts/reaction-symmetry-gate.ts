#!/usr/bin/env node --experimental-strip-types
/**
 * reaction-symmetry-gate.ts — IMP-138 (2026-08-07, RC6). Critic mandate #3, 2026-08-07.
 *
 * THE FAILURE THIS EXISTS FOR. AI&T-2 on 2026-08-07 was built as a two-sided comparison of
 * two software companies reporting an hour apart. It printed Cloudflare's price reaction —
 * "rose 14.9 percent" — and withheld Atlassian's, in a bullet whose thesis is that Atlassian
 * is the one "still paying for" the transition. Atlassian closed the same after-hours session
 * UP 35.71% to $149.51, and Cannon-Brookes announced a $250M on-market purchase.
 *
 * Every number the bullet printed was TRUE. That is the whole point. This is not a fact
 * failure and no fact-checking gate can see it: it is an EVIDENCE-SELECTION failure, where
 * the consensus rung is supplied for the company that agrees with the thesis and suppressed
 * for the company that refutes it — same night, same session, same bullet. As the Critic put
 * it: an absent rung is a gap, an asymmetric one is an argument.
 *
 * THE RULE IS SYMMETRIC BY CONSTRUCTION, which is why it is cheap to obey and hard to game:
 *   printing NO reactions  → legal (the bullet is not making a market-reaction argument)
 *   printing ALL reactions → legal (the reader can see both sides)
 *   printing SOME          → FAIL, naming the companies whose reaction is missing
 *
 * The gate never asks whether a reaction is favourable — it cannot know that, and a gate that
 * tried would be a bias detector nobody could calibrate. It asks only whether the same
 * question was put to every company in the comparison. Selection bias needs asymmetry to
 * operate; remove the asymmetry and the bias has nowhere to live.
 *
 * THE HARD PART, and where a naive version would produce a false-positive storm: a percentage
 * move is not necessarily a PRICE move. "Burger King's US comparable sales rose 8.5 percent"
 * and "Cloudflare ... rose 14.9 percent" are the same six words in the same shape and mean
 * completely different things. So a move is classified as a METRIC (silent) whenever its own
 * clause names the thing that moved — sales, comps, revenue, margin, EPS, growth, traffic,
 * orders, volume — and as a PRICE REACTION only when it does not. That single discrimination
 * is what keeps the gate silent on C&C-2, which named FOUR restaurant reporters and printed
 * four percentage moves, every one of them a comp.
 *
 * Usage: node --experimental-strip-types scripts/reaction-symmetry-gate.ts <brief.md>
 *        node --experimental-strip-types scripts/reaction-symmetry-gate.ts --selftest
 * Exit:  0 symmetric · 1 asymmetric disclosure · 2 usage error
 * Wired into: system/Brief_Editor.md Gate 1 · system/AI_Tech_Generator.md ·
 *             system/Companies_Crypto_Generator.md (generation-layer rule).
 */
import * as fs from 'fs';
import * as path from 'path';

export interface SymmetryFinding {
  check: 'reaction-symmetry';
  severity: 'FAIL';
  message: string;
  bullet: string;
  withReaction: string[];
  withoutReaction: string[];
}

/** IMP-131's lesson: never grade the Editor's commentary about a section as if it were the section. */
export function stripHtmlComments(md: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = md.indexOf('<!--', i);
    if (start === -1) {
      out += md.slice(i);
      break;
    }
    out += md.slice(i, start);
    const end = md.indexOf('-->', start);
    const body = end === -1 ? md.slice(start) : md.slice(start, end + 3);
    out += body.replace(/[^\n]/g, ' ');
    if (end === -1) break;
    i = end + 3;
  }
  return out;
}

/** Words that look like a company because they start a sentence or a section. */
const NOT_A_COMPANY = new Set([
  'The',
  'This',
  'That',
  'These',
  'Those',
  'Two',
  'Three',
  'Four',
  'One',
  'Both',
  'It',
  'Its',
  'But',
  'And',
  'A',
  'An',
  'In',
  'On',
  'At',
  'For',
  'From',
  'With',
  'By',
  'As',
  'If',
  'When',
  'What',
  'Which',
  'Who',
  'Whether',
  'Every',
  'Each',
  'Their',
  'They',
  'He',
  'She',
  'We',
  'You',
  'US',
  'U.S.',
  'American',
  'America',
  'Wall',
  'Street',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Adjusted',
  'Revenue',
  'Earnings',
  'Cloud',
  'Data',
  'Center',
  'Free',
  'Cash',
  'Flow',
  'Watch',
  'Nothing',
  'Supply',
  'Whether',
  'Same',
  'Meanwhile',
  'Analysts',
  'Consensus',
  'Guidance',
  'Management',
]);

/**
 * A company name is a PROPER noun. An abstract common noun is capitalised only because it
 * begins a sentence, and English marks it morphologically. Caught in testing on the real
 * repaired v2: "Commoditisation reached the layer that just beat." was scored a third
 * reporter with no price reaction, which would have failed a bullet that is now correctly
 * symmetric — a false positive that punishes the fix, the worst kind for a gate to carry.
 */
const ABSTRACT_NOUN_SUFFIX =
  /(?:ation|isation|ization|ment|ness|ity|ism|ology|ance|ence|ship|hood|dom|sion)$/i;

const REPORT_VERB = String.raw`reported|printed|beat|guided|posted|delivered|reporting|raised|logged|booked`;
const REPORT_NOUN = String.raw`comparable sales|comps|revenue of|earnings of|quarterly revenue|Q[1-4] revenue|full-year guidance|in the quarter`;

/** Entities that are the SUBJECT of a reporting act inside this bullet. */
export function extractReporters(bullet: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(
    String.raw`\b([A-Z][A-Za-z.&'’-]*(?:\s+[A-Z][A-Za-z.&'’-]*){0,2})(?:'s|’s)?[^.;]{0,45}?\b(?:${REPORT_VERB}|${REPORT_NOUN})\b`,
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(bullet)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard (IMP-136's class)
    const name = m[1]!.trim();
    const head = name.split(/\s+/)[0]!;
    if (NOT_A_COMPANY.has(head) || NOT_A_COMPANY.has(name)) continue;
    if (name.length < 3) continue;
    if (!name.includes(' ') && ABSTRACT_NOUN_SUFFIX.test(name)) continue; // "Commoditisation", not a company
    found.add(name);
  }
  return [...found];
}

const MOVE_VERB = String.raw`rose|fell|jumped|surged|slid|dropped|climbed|gained|sank|plunged|popped|tumbled|rallied|slipped`;
/** A metric noun in the SAME clause means the percentage describes the business, not the tape. */
const METRIC_NOUN =
  /\b(?:comparable sales|comps?|same-store|revenue|sales|margin|earnings|EPS|growth|traffic|orders?|volume|bookings|billings|ARR|backlog|output|production|yield|share of|deposits|assets)\b/i;
const SHARE_WORD =
  /\b(?:shares?|stock|the tape|after hours|after-hours|in after-hours trading)\b/i;

interface Move {
  index: number;
  isReaction: boolean;
}

/** Every percentage move in the bullet, classified METRIC vs PRICE REACTION. */
export function extractMoves(bullet: string): Move[] {
  const out: Move[] = [];
  const re = new RegExp(
    String.raw`\b(?:${MOVE_VERB})\s+(?:about\s+|roughly\s+|more than\s+|nearly\s+)?\d+(?:\.\d+)?\s*(?:percent|%)`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(bullet)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++;
    // The clause is the move plus what precedes it back to the last clause boundary.
    const before = bullet.slice(0, m.index);
    const boundary = Math.max(
      before.lastIndexOf(','),
      before.lastIndexOf(';'),
      before.lastIndexOf('. '),
      before.lastIndexOf(' and '),
      before.lastIndexOf(' then '),
      before.lastIndexOf(' while '),
      -1
    );
    const clause = bullet.slice(boundary + 1, m.index + m[0].length);
    const isReaction = SHARE_WORD.test(clause) || !METRIC_NOUN.test(clause);
    out.push({ index: m.index, isReaction });
  }
  return out;
}

export function reactionSymmetry(body: string): SymmetryFinding[] {
  const findings: SymmetryFinding[] = [];
  const clean = stripHtmlComments(body);
  const bullets = clean
    .split(/\n(?=\s*[-*]\s+\*\*)/)
    .filter(b => /^\s*[-*]\s+\*\*/.test(b));

  for (const bullet of bullets) {
    const reporters = extractReporters(bullet);
    if (reporters.length < 2) continue; // no comparison to be asymmetric about

    const moves = extractMoves(bullet).filter(mv => mv.isReaction);
    if (moves.length === 0) continue; // printing NO reactions is legal

    // Attribute each reaction to the nearest reporter named before it.
    const withReaction = new Set<string>();
    for (const mv of moves) {
      let best: string | null = null;
      let bestIdx = -1;
      for (const r of reporters) {
        const idx = bullet.lastIndexOf(r, mv.index);
        if (idx > bestIdx) {
          bestIdx = idx;
          best = r;
        }
      }
      if (best) withReaction.add(best);
    }
    const without = reporters.filter(r => !withReaction.has(r));
    if (withReaction.size === 0 || without.length === 0) continue; // all-or-nothing is legal

    findings.push({
      check: 'reaction-symmetry',
      severity: 'FAIL',
      message:
        `ASYMMETRIC REACTION DISCLOSURE — this bullet compares ${reporters.length} companies reporting the same ` +
        `event class and prints a price reaction for ${[...withReaction].join(', ')} but NOT for ` +
        `${without.join(', ')}. Symmetric by construction: print none, or print all. ` +
        `2026-08-07 receipt: AI&T-2 printed Cloudflare "+14.9 percent" and withheld Atlassian's +35.7% to $149.51 ` +
        `in the same after-hours session — in a bullet arguing Atlassian was "still paying for" the transition. ` +
        `Every number was true; the SELECTION was the argument. Print the missing reaction and price the disagreement.`,
      bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
      withReaction: [...withReaction],
      withoutReaction: without,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
function sectionBullets(
  body: string,
  heading: RegExp,
  pick: (b: string) => boolean
): string | null {
  const lines = stripHtmlComments(body).split('\n');
  const start = lines.findIndex(l => /^#{1,6}\s/.test(l) && heading.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(l => /^#{1,6}\s/.test(l));
  const block = (end === -1 ? rest : rest.slice(0, end)).join('\n');
  const bullets = block
    .split(/\n(?=\s*[-*]\s+\*\*)/)
    .filter(b => /^\s*[-*]\s+\*\*/.test(b));
  return bullets.find(pick) ?? null;
}

function selftest(): number {
  const root = process.cwd();
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  // FIXTURE NOTE, stated plainly because it changes what "the real file" means. The Critic
  // evaluated v2, but the 05:27 Morning Truth Gate REPAIRED v2 in place — today's v2 prints
  // "Atlassian jumped more than 20 percent in after-hours trade", so the asymmetry is gone
  // from it. Asserting FIRE on v2 would be unsatisfiable, and preserving a defect in an
  // artifact just to keep a test red is the anti-pattern IMP-132 named. The pre-repair text
  // survives on disk in daily-briefs/2026-08-07-v1.5.md — so FIRE is proved on v1.5 (the
  // artifact the failure actually lived in) and SILENT on v2 (the same bullet, repaired).
  // Both legs are real files; neither is invented.
  const v15Path = path.join(root, 'daily-briefs/2026-08-07-v1.5.md');
  const v2Path = path.join(root, 'daily-briefs/2026-08-07-v2.md');
  for (const p of [v15Path, v2Path]) {
    if (!fs.existsSync(p)) {
      console.error(`SELFTEST FAIL — missing fixture: ${p}`);
      return 1;
    }
  }
  const v15 = fs.readFileSync(v15Path, 'utf8');
  const v2 = fs.readFileSync(v2Path, 'utf8');

  // FIRE — the real pre-repair AI&T-2 bullet, unmodified, off disk.
  const ait2Bad = sectionBullets(
    v15,
    /AI\s*&\s*Tech/i,
    b => /Cloudflare/.test(b) && /Atlassian/.test(b)
  );
  t(
    !!ait2Bad,
    '[fixture] the pre-repair AI&T-2 Cloudflare/Atlassian bullet was located in 2026-08-07-v1.5.md'
  );
  const ait2Findings = ait2Bad ? reactionSymmetry(ait2Bad) : [];
  t(
    ait2Findings.length === 1 &&
      ait2Findings[0]!.withoutReaction.some(n => /Atlassian/.test(n)),
    'FIRES on the REAL pre-repair AI&T-2 and NAMES Atlassian as the company missing a reaction'
  );

  // SILENT — the SAME bullet after this morning's repair printed Atlassian's move.
  const ait2Fixed = sectionBullets(
    v2,
    /AI\s*&\s*Tech/i,
    b => /Cloudflare/.test(b) && /Atlassian/.test(b)
  );
  t(
    ait2Fixed ? reactionSymmetry(ait2Fixed).length === 0 : false,
    'SILENT on the SAME bullet in the repaired v2 — the gate confirms the real fix, on real files'
  );

  // SILENT — the real C&C-2 restaurant bullet: FOUR reporters, four percentage moves, all comps.
  const cc2 = sectionBullets(
    v2,
    /Companies\s*&\s*Crypto/i,
    b => /Burger King/.test(b) && /Popeyes/.test(b)
  );
  t(
    !!cc2,
    "[fixture] the real C&C-2 Burger King/Popeyes/Papa John's bullet was located"
  );
  t(
    cc2 ? reactionSymmetry(cc2).length === 0 : false,
    'SILENT on the real C&C-2 — three reporters, zero PRICE reactions (the percentages are comps)'
  );
  t(
    cc2 ? extractReporters(cc2).length >= 2 : false,
    '…and it is silent for the RIGHT reason: the reporters ARE detected, the moves are classified METRIC'
  );

  // SILENT — C&C-1, a single-company unlock story.
  const cc1 = sectionBullets(
    v2,
    /Companies\s*&\s*Crypto/i,
    b => /SpaceX/.test(b) && /911/.test(b)
  );
  t(
    cc1 ? reactionSymmetry(cc1).length === 0 : true,
    'SILENT on the real C&C-1 SpaceX unlock bullet (no two-company earnings comparison)'
  );

  // SILENT — printing ALL reactions is legal.
  const bothPrinted =
    '- **Two software companies reported an hour apart.** Cloudflare printed revenue of $696.1 million and rose 14.9 percent. ' +
    'Atlassian reported $1.766 billion in the quarter and rose 35.7 percent after hours.';
  t(
    reactionSymmetry(bothPrinted).length === 0,
    'SILENT when BOTH reporters get a reaction (symmetry restored = the fix)'
  );

  // FIRE — the synthetic minimal pair, proving the rule and not the fixture.
  const onePrinted =
    '- **Two software companies reported an hour apart.** Cloudflare printed revenue of $696.1 million and rose 14.9 percent. ' +
    'Atlassian reported $1.766 billion in the quarter and guided fiscal 2027 growth to roughly 13 percent.';
  t(
    reactionSymmetry(onePrinted).length === 1,
    'FIRES on the minimal pair that differs ONLY by the withheld reaction'
  );

  const total = 9;
  console.log(
    `\nreaction-symmetry-gate selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ reaction-symmetry-gate verified in BOTH directions on the real 2026-08-07 v2.'
  );
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const briefPath = args.find(a => !a.startsWith('--'));
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error('usage: reaction-symmetry-gate.ts <brief.md>');
    return 2;
  }
  const findings = reactionSymmetry(fs.readFileSync(briefPath, 'utf8'));
  console.log(`reaction-symmetry-gate — ${path.basename(briefPath)}`);
  for (const f of findings)
    console.error(`  ✗ [${f.check}] ${f.message}\n      "${f.bullet}"`);
  if (findings.length) {
    console.error(
      `\n❌ REACTION-SYMMETRY FAIL — ${findings.length} bullet(s) print a reaction for some reporters and not others.`
    );
    return 1;
  }
  console.log(
    '\n✅ REACTION-SYMMETRY PASS — every multi-reporter bullet prints all reactions or none.'
  );
  return 0;
}

// Only take over the process when RUN, not when IMPORTED — otherwise any test or sibling
// gate that reuses these detectors inherits an exit(2) on import.
if (/reaction-symmetry-gate\.ts$/.test(process.argv[1] ?? ''))
  process.exit(main());
