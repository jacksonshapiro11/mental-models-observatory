#!/usr/bin/env node
/**
 * weekly-predictions-gate — mechanical enforcement of THE PREDICTIONS presentation contract.
 *
 * WHY (Jackson, 2026-07-27): W30 shipped 1,345 words of ledger apparatus inline — consensus
 * audits, attrition notes, tally caveats stacked into 200-word bullets — and the calls drowned
 * ("word vomit... impossible to keep track"). W29 was 1,222: chronic. Jackson's spec for what a
 * published call IS: "just the call, the expression of the call — i.e. what changes if this
 * call is right — then the result."
 *
 * THE CONTRACT (system/Weekly_Generator.md, PRESENTATION CONTRACT): every call is one bullet,
 * a fixed TRIPLET of bold-labeled sentences —
 *   **The call:** direction + level + date.
 *   **If right:** what changes — the observable/tradable expression that pays.
 *   **The result:** verdict + the number (graded), or "open — grades {date}. Wrong if {…}."
 * ≤75 words per bullet. Blocks in order: italic framing line → **The scoreboard.** →
 * **The book.** (exactly three horizon calls) → optional New on the book + *Watching:* line.
 * Total ≤700 words. Audits, sizing, meta-commentary live in the pre-draft archive, never here.
 *
 * USAGE:
 *   npx tsx scripts/weekly-predictions-gate.ts <weekly-md-or-predictions-draft.md>   (exit 1 on FAIL)
 *   npx tsx scripts/weekly-predictions-gate.ts --selftest                            (bite + silence, exit 0/1)
 */

import * as fs from 'fs';

interface Flag {
  check: string;
  message: string;
}

const SECTION_HEADER = /^# ▸ THE PREDICTIONS\s*$/m;
const NEXT_TOP_HEADER = /^# ▸ /m;

const TOTAL_WORD_CAP = 720; // contract says ≤700; small buffer for connective tissue
const FRAME_WORD_CAP = 45;
const BULLET_WORD_CAP = 80; // contract says ≤75; buffer for the trailing ledger ID
const PARAGRAPH_CAP = 130;

const SCOREBOARD_HEADER_RE = /^\*\*The scoreboard\.?\*\*/im;
const BOOK_HEADER_RE = /^\*\*The book\b/im;
const BOOK_LEAD_RE = /^-\s+\*\*Next (week|month|year)\b/i;
const CALL_RE = /\*\*The call:\*\*/i;
const IF_RIGHT_RE = /\*\*If right:\*\*/i;
const RESULT_RE = /\*\*The result:\*\*/i;
const VERDICT_RE = /\*\*The result:\*\*\s*(HIT|MISS|EARLY|WRONG)\b/i;
const WRONG_IF_RE = /\bWrong if\b/i;

function words(s: string): number {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Slice THE PREDICTIONS out of a full weekly md, or treat a predictions pre-draft as the
 *  section itself (stopping at the chains/metadata archive below the fold). */
export function extractPredictionsSection(body: string): string | null {
  const m = body.match(SECTION_HEADER);
  let section: string;
  if (m && m.index !== undefined) {
    const after = body.slice(m.index + m[0].length);
    const next = after.match(NEXT_TOP_HEADER);
    section =
      next && next.index !== undefined ? after.slice(0, next.index) : after;
  } else {
    const stop = body.search(
      /^## |^<!-- PREDRAFT METADATA|CHAIN OF REASONING/m
    );
    section = stop === -1 ? body : body.slice(0, stop);
  }
  const trimmed = section.trim();
  return trimmed.length > 40 ? trimmed : null;
}

export function lintPredictions(section: string): Flag[] {
  const flags: Flag[] = [];
  const lines = section.split('\n');

  // Total budget — the "word vomit" ceiling.
  const total = words(section);
  if (total > TOTAL_WORD_CAP) {
    flags.push({
      check: 'pred-total-words',
      message: `THE PREDICTIONS runs ${total} words (cap ${TOTAL_WORD_CAP}). The page is call → if-right → result; the apparatus (audits, sizing, tally hygiene, meta-commentary) belongs in the pre-draft archive.`,
    });
  }

  // Framing line: first non-empty line must be a single italic line.
  const firstLine = lines.map(l => l.trim()).find(l => l.length > 0) ?? '';
  if (!/^\*[^*].*\*$/.test(firstLine)) {
    flags.push({
      check: 'pred-frame',
      message: `Section must OPEN with one italic framing line (the week's record in plain speech, ≤${FRAME_WORD_CAP} words). Got: ${JSON.stringify(firstLine.slice(0, 80))}`,
    });
  } else if (words(firstLine) > FRAME_WORD_CAP) {
    flags.push({
      check: 'pred-frame',
      message: `Framing line runs ${words(firstLine)} words (cap ${FRAME_WORD_CAP}) — one breath, not a paragraph.`,
    });
  }

  // Required blocks.
  const sbIdx = section.search(SCOREBOARD_HEADER_RE);
  const bookIdx = section.search(BOOK_HEADER_RE);
  if (sbIdx === -1 || bookIdx === -1 || bookIdx < sbIdx) {
    flags.push({
      check: 'pred-blocks',
      message: `Section must carry the fixed blocks in order: **The scoreboard.** then **The book.** (found scoreboard=${sbIdx !== -1}, book=${bookIdx !== -1}).`,
    });
  }

  // Bullets with block attribution.
  type B = { text: string; inBook: boolean };
  const bullets: B[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^-\s+/.test(line)) {
      let b = line;
      while (
        i + 1 < lines.length &&
        (lines[i + 1] ?? '').trim() &&
        !/^-\s+/.test(lines[i + 1] ?? '') &&
        !/^\*\*/.test((lines[i + 1] ?? '').trim())
      ) {
        b += ' ' + (lines[++i] ?? '').trim();
      }
      bullets.push({ text: b, inBook: bookIdx !== -1 && offset > bookIdx });
    }
    offset += line.length + 1;
  }

  // "New on the book" / Watching material sits AFTER the book's three bullets and is exempt
  // from the triplet (one-line registrations); the book bullets themselves are the Next-* ones.
  const bookBullets = bullets.filter(b => BOOK_LEAD_RE.test(b.text));
  const scoreboardBullets = bullets.filter(
    b => !b.inBook && !BOOK_LEAD_RE.test(b.text)
  );

  // The book: exactly three calls, one per horizon.
  const horizons = new Set(
    bookBullets.map(b => b.text.match(BOOK_LEAD_RE)![1]!.toLowerCase())
  );
  if (bookBullets.length !== 3 || horizons.size !== 3) {
    flags.push({
      check: 'pred-book-count',
      message: `THE BOOK must carry exactly three calls — one each for Next week / Next month / Next year. Found ${bookBullets.length} across ${horizons.size} horizon(s).`,
    });
  }

  // Triplet discipline: every scoreboard + book bullet is call → if-right → result, in order.
  for (const b of [...scoreboardBullets, ...bookBullets]) {
    const lead = b.text.slice(0, 55).replace(/\s+/g, ' ');
    const ci = b.text.search(CALL_RE);
    const ii = b.text.search(IF_RIGHT_RE);
    const ri = b.text.search(RESULT_RE);
    if (ci === -1 || ii === -1 || ri === -1 || !(ci < ii && ii < ri)) {
      flags.push({
        check: 'pred-triplet',
        message: `Every call is the fixed triplet — **The call:** … **If right:** … **The result:** … in that order. Violation: "${lead}…"`,
      });
    }
    if (words(b.text) > BULLET_WORD_CAP) {
      flags.push({
        check: 'pred-bullet-cap',
        message: `Call bullet runs ${words(b.text)} words (cap ${BULLET_WORD_CAP}): "${lead}…" — one sentence per label; the rest is archive material.`,
      });
    }
  }

  // Scoreboard results carry a verdict; book results carry the Wrong-if falsifier.
  for (const b of scoreboardBullets) {
    if (RESULT_RE.test(b.text) && !VERDICT_RE.test(b.text)) {
      flags.push({
        check: 'pred-verdict',
        message: `Scoreboard result must open with the verdict (HIT/MISS/EARLY): "${b.text.slice(0, 55).replace(/\s+/g, ' ')}…"`,
      });
    }
  }
  for (const b of bookBullets) {
    if (!WRONG_IF_RE.test(b.text)) {
      flags.push({
        check: 'pred-wrong-if',
        message: `Book call's result must carry its "Wrong if {condition}" falsifier: "${b.text.slice(0, 55).replace(/\s+/g, ' ')}…"`,
      });
    }
  }

  // No paragraph anywhere may exceed the cap (catches run-on closing paragraphs).
  for (const para of section.split(/\n\n+/)) {
    const p = para.trim();
    if (!p || p.startsWith('-') || p.startsWith('#')) continue;
    if (words(p) > PARAGRAPH_CAP) {
      flags.push({
        check: 'pred-paragraph-cap',
        message: `Paragraph runs ${words(p)} words (cap ${PARAGRAPH_CAP}): "${p.slice(0, 70).replace(/\s+/g, ' ')}…"`,
      });
    }
  }

  return flags;
}

// ─── Selftest fixtures ─────────────────────────────────────────────────────────

/** Distilled from the REAL shipped W30: no framing line, no scoreboard block, a 150+-word
 *  bullet with no triplet labels, a two-call book, a call with no falsifier. All must FIRE. */
const BAD_FIXTURE = `# ▸ THE PREDICTIONS

**The look-back (due or triggered this window).**

- **Lumber front-runs the tariff (W29-1): HIT, and the first expressed win in the alpha book.** The call said a dated cost increase on 30 percent of US supply, announced two weeks before it binds, forces every yard to buy early: a close above $640 by Friday July 24, from $625.52. Futures closed Friday at $654.53, up 4.6 percent from entry, after a week spent in the mid-650s; Madison's cash index rose 1 percent to $554 the same week, so the physical market confirmed what the curve did. Kill conditions checked first, per the standing law: no close below $605 anywhere in the window, and the tariff was never delayed, the declined renewal on July 20 reinforced the wall instead. The paper long closed 5.2 points ahead of a falling S&P. The consensus audit is the satisfying part: on registration day the tape had filed this under shelter CPI for spring 2027 and futures fell on the tariff news; within six sessions the market converged to our reading.

**The book (standing calls, across domains).**

- **Next week (macro and rates): the hold outlasts the wall.** The FOMC meets July 28-29 against the strangest stack of the year: July-hike odds at 36 percent, a jobless-claims print at 187,000, the lowest of 2026, a tariff wall on 60 economies that went effective Thursday, and an oil impulse that cracked 4 percent on Friday. We say the committee holds, and the front end walks the hike back inside the week, because the fast channel that built the hike case is draining while the slow channel cannot print a number before autumn: the two-year closes Friday July 31 at or below 4.28. *Kill switch: the Fed delivers a hike on July 29, or Brent closes above $103 before Friday.*
- **Next month (geopolitics): peace signals are not signatures.** No signed, binding US-Iran framework before August 22, because the blockers are named and a framework needs all three ladders to come down at once while signals bring down one.

# ▸ INNER GAME
`;

/** The reformatted W30 in Jackson's triplet — same grades, receipts, calls, and falsifiers.
 *  Must produce ZERO flags; doubles as the exemplar. */
const GOOD_FIXTURE = `# ▸ THE PREDICTIONS

*Three calls came due this week and all three hit, including the book's first closed profit. One early-season crop leg missed and its lesson is now law.*

**The scoreboard.**

- **Lumber front-runs the tariff (W29-1).** **The call:** a dated tariff on 30 percent of US supply forces yards to buy early — lumber closes above $640 by July 24. **If right:** futures rally into the tariff date and the paper long beats the S&P over the window. **The result:** HIT — closed $654.53, up 4.6 percent from entry, 5.2 points ahead of a falling S&P.
- **The ten-year takes out 4.65 (W25-3).** **The call:** with the Fed's map removed, term premium pushes the ten-year through 4.65 before the September FOMC. **If right:** the long end reprices on the next shock and the level breaks early. **The result:** HIT, five weeks early — 4.71 printed Thursday, the highest since January 2025; the channel was oil, named in the ledger.
- **The June macro call (W0-1).** **The call:** the BOJ hikes, the Fed holds with a hike alive, and the ten-year takes out 4.65 before the next meetings. **If right:** all three legs land inside the window. **The result:** HIT on all three — the BOJ at 1.0 percent, the Fed hold, and 4.65 cleared with four days to spare.
- **Crop conditions (W0-8, leg one).** **The call:** mid-July USDA crop conditions print below the five-year average. **If right:** grain supply tightens into the fall and the food-commodity legs firm. **The result:** MISS — corn at 67 and soybeans at 66, at or above average. The lesson is law: no physical-series call without a named instrument reading.

**The book.**

- **Next week — the hold outlasts the wall (W30-1).** **The call:** the Fed holds on July 29 and the front end walks the hike back — the two-year closes Friday at or below 4.28. **If right:** the hike premium drains out of the front end inside the week. **The result:** open — grades July 31. Wrong if a hike lands, or Brent closes above $103 first.
- **Next month — peace signals are not signatures (W30-2).** **The call:** no signed, binding US-Iran framework before August 22. **If right:** the war premium holds in oil and freight while the signals fade unpriced. **The result:** open — grades August 22. Wrong if a signed document is published by both governments inside the window.
- **Next year — the deterrent gets a document (W29-7, carried).** **The call:** by July 2027 at least one European government formalizes an independent-deterrent step in a signed document, not a speech. **If right:** European defense procurement rerates around a named nuclear framework. **The result:** open — grades July 2027, at the book's lowest confidence. Wrong if mid-2027 arrives with only speeches and study groups.

**New on the book.** Registered this week, chains and conditions in the ledger: the emigration-retention mechanism floats within twelve months (W30-3); the UK ten-year holds above the US through Q2 2027 (W30-4); a gigawatt-scale sodium-ion order prints by the Q1 2027 reports (W30-5).

*Watching: the AI-repricing family grades August 1, no extension; helium retires if silent past August 4; Oracle and the AI-no-new-high pair grade on the July 31 letters.*

# ▸ INNER GAME
`;

function selftest(): number {
  let fails = 0;
  const expectBad = [
    'pred-frame',
    'pred-blocks',
    'pred-triplet',
    'pred-book-count',
    'pred-wrong-if',
    'pred-bullet-cap',
  ];
  const badFlags = lintPredictions(extractPredictionsSection(BAD_FIXTURE)!);
  for (const c of expectBad) {
    const fired = badFlags.some(f => f.check === c);
    console.log(
      `  ${fired ? 'PASS' : 'FAIL'} — ${c} fires on the W30-shaped bad fixture`
    );
    if (!fired) fails++;
  }
  const goodFlags = lintPredictions(extractPredictionsSection(GOOD_FIXTURE)!);
  const clean = goodFlags.length === 0;
  console.log(
    `  ${clean ? 'PASS' : 'FAIL'} — zero flags on the triplet-form W30 (got: ${goodFlags.map(f => f.check).join(', ') || 'none'})`
  );
  if (!clean) fails++;
  console.log(
    `\nweekly-predictions-gate selftest — ${expectBad.length + 1 - fails}/${expectBad.length + 1} assertions passed`
  );
  return fails ? 1 : 0;
}

// ─── main ──────────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (arg === '--selftest') {
  process.exit(selftest());
} else if (!arg) {
  console.error(
    'Usage: weekly-predictions-gate.ts <weekly.md | predictions-draft.md> | --selftest'
  );
  process.exit(2);
} else {
  if (!fs.existsSync(arg)) {
    console.error(`File not found: ${arg}`);
    process.exit(2);
  }
  const section = extractPredictionsSection(fs.readFileSync(arg, 'utf8'));
  if (!section) {
    console.error(
      '✗ No THE PREDICTIONS section found (and file does not read as a predictions pre-draft).'
    );
    process.exit(1);
  }
  const flags = lintPredictions(section);
  console.log(
    `weekly-predictions-gate — ${arg} — ${flags.length} FAIL${flags.length === 1 ? '' : 'S'} (section: ${section.split(/\s+/).filter(Boolean).length} words)`
  );
  for (const f of flags) console.log(`  ✗ [${f.check}] ${f.message}`);
  if (flags.length) {
    console.error(
      '\n✗ THE PREDICTIONS violates the presentation contract (call → if-right → result) — restructure per system/Weekly_Generator.md before shipping.'
    );
    process.exit(1);
  }
  console.log('✅ PRESENTATION CONTRACT PASS');
  process.exit(0);
}
