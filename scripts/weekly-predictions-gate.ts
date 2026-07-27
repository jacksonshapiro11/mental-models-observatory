#!/usr/bin/env node
/**
 * weekly-predictions-gate — mechanical enforcement of THE PREDICTIONS presentation contract.
 *
 * WHY (Jackson, 2026-07-27): W30 shipped 1,345 words of ledger apparatus inline — consensus
 * audits, attrition notes, tally caveats stacked into 200-word bullets — and the three calls
 * drowned ("word vomit... impossible to keep track"). W29 was 1,222 words: chronic, not a
 * one-off. The rigor machinery (chains, base rates, alpha marks) is right and stays — in the
 * pre-draft archive. The PAGE is a briefing with a fixed architecture; this gate is the
 * mechanical leg of the PRESENTATION CONTRACT in system/Weekly_Generator.md.
 *
 * THE CONTRACT (four blocks, in order):
 *   1. One italic framing line (≤45 words).
 *   2. **The scoreboard.** One bullet per graded call: bold "Name — HIT/MISS/EARLY." lead,
 *      flowing prose, the one receipt number. ≤65 words per bullet.
 *   3. **The book.** EXACTLY three bullets — Next week / Next month / Next year — each with a
 *      bold horizon lead and an italic *Kill switch:* clause. ≤85 words per call.
 *   4. Registered & watching: one short paragraph, ≤130 words.
 *   Total section ≤780 words. No paragraph anywhere in the section >130 words.
 *
 * USAGE:
 *   npx tsx scripts/weekly-predictions-gate.ts <weekly-md-or-predictions-draft.md>   (exit 1 on FAIL)
 *   npx tsx scripts/weekly-predictions-gate.ts --selftest                            (bite + silence, exit 0/1)
 */

import * as fs from 'fs';

interface Flag { check: string; message: string }

const SECTION_HEADER = /^# ▸ THE PREDICTIONS\s*$/m;
const NEXT_TOP_HEADER = /^# ▸ /m;

const TOTAL_WORD_CAP = 780;
const FRAME_WORD_CAP = 45;
const SCOREBOARD_BULLET_CAP = 65;
const BOOK_BULLET_CAP = 85;
const PARAGRAPH_CAP = 130;

const BOOK_LEAD_RE = /^-\s+\*\*Next (week|month|year)\b/i;
const KILL_SWITCH_RE = /\*Kill switch:/i;
const VERDICT_RE = /\*\*[^*]+—\s*(HIT|MISS|EARLY|OPEN|WRONG)\b/i;

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
    section = next && next.index !== undefined ? after.slice(0, next.index) : after;
  } else {
    // Pre-draft mode: the lift-ready text is the top of the file; the reasoning archive
    // (chains, conviction table, metadata) lives below a "## " divider or the metadata block.
    const stop = body.search(/^## |^<!-- PREDRAFT METADATA|CHAIN OF REASONING/m);
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
      message: `THE PREDICTIONS runs ${total} words (cap ${TOTAL_WORD_CAP}). The page is a briefing; the apparatus (audits, sizing, tally hygiene, meta-commentary) belongs in the predictions pre-draft archive with the chains.`,
    });
  }

  // Framing line: first non-empty line must be a single italic line, ≤45 words.
  const firstLine = lines.map(l => l.trim()).find(l => l.length > 0) ?? '';
  const isItalicFrame = /^\*[^*].*\*$/.test(firstLine);
  if (!isItalicFrame) {
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

  // Bullets: a bullet is a "- " line plus any following non-blank, non-bullet lines.
  const bullets: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^-\s+/.test(lines[i] ?? '')) {
      let b = lines[i]!;
      while (i + 1 < lines.length && (lines[i + 1] ?? '').trim() && !/^-\s+/.test(lines[i + 1] ?? '') && !/^\*\*/.test((lines[i + 1] ?? '').trim())) {
        b += ' ' + lines[++i]!.trim();
      }
      bullets.push(b);
    }
  }

  const bookBullets = bullets.filter(b => BOOK_LEAD_RE.test(b));
  const otherBullets = bullets.filter(b => !BOOK_LEAD_RE.test(b));

  // The book: exactly three calls, one per horizon, each with a kill switch, each capped.
  const horizons = new Set(bookBullets.map(b => b.match(BOOK_LEAD_RE)![1]!.toLowerCase()));
  if (bookBullets.length !== 3 || horizons.size !== 3) {
    flags.push({
      check: 'pred-book-count',
      message: `THE BOOK must carry exactly three calls — one each for Next week / Next month / Next year (bold horizon leads). Found ${bookBullets.length} book bullet(s) across ${horizons.size} horizon(s).`,
    });
  }
  for (const b of bookBullets) {
    const lead = b.slice(0, 60).replace(/\s+/g, ' ');
    if (!KILL_SWITCH_RE.test(b)) {
      flags.push({ check: 'pred-kill-switch', message: `Book call missing its italic *Kill switch:* clause: "${lead}…"` });
    }
    if (words(b) > BOOK_BULLET_CAP) {
      flags.push({ check: 'pred-book-cap', message: `Book call runs ${words(b)} words (cap ${BOOK_BULLET_CAP}): "${lead}…" — the call, one plain why, the kill switch. The rest is archive material.` });
    }
  }

  // Scoreboard bullets: bold verdict lead, hard word cap. (The 07-26 failure mode was a
  // 200-word bullet carrying the call, the receipt, the consensus audit, AND the meta-note.)
  for (const b of otherBullets) {
    const lead = b.slice(0, 60).replace(/\s+/g, ' ');
    if (words(b) > SCOREBOARD_BULLET_CAP) {
      flags.push({ check: 'pred-bullet-cap', message: `Scoreboard bullet runs ${words(b)} words (cap ${SCOREBOARD_BULLET_CAP}): "${lead}…" — verdict, what we said, what happened, ONE number. Audits and asides go to the archive.` });
    }
    if (!VERDICT_RE.test(b)) {
      flags.push({ check: 'pred-verdict-lead', message: `Scoreboard bullet must open with a bold "Name — HIT/MISS/EARLY" lead: "${lead}…"` });
    }
  }

  // No paragraph anywhere may exceed the cap (catches run-on closing paragraphs).
  for (const para of section.split(/\n\n+/)) {
    const p = para.trim();
    if (!p || p.startsWith('-') || p.startsWith('#')) continue;
    if (words(p) > PARAGRAPH_CAP) {
      flags.push({ check: 'pred-paragraph-cap', message: `Paragraph runs ${words(p)} words (cap ${PARAGRAPH_CAP}): "${p.slice(0, 70).replace(/\s+/g, ' ')}…"` });
    }
  }

  return flags;
}

// ─── Selftest fixtures ─────────────────────────────────────────────────────────

/** Distilled from the REAL shipped W30 section: one 150+-word bullet stacking the call, the
 *  receipt, the consensus audit, and the meta-note; a two-call book; a missing kill switch;
 *  no framing line. Every one of those must FIRE. */
const BAD_FIXTURE = `# ▸ THE PREDICTIONS

**The look-back (due or triggered this window).**

- **Lumber front-runs the tariff (W29-1): HIT, and the first expressed win in the alpha book.** The call said a dated cost increase on 30 percent of US supply, announced two weeks before it binds, forces every yard to buy early: a close above $640 by Friday July 24, from $625.52. Futures closed Friday at $654.53, up 4.6 percent from entry, after a week spent in the mid-650s; Madison's cash index rose 1 percent to $554 the same week, so the physical market confirmed what the curve did. Kill conditions checked first, per the standing law: no close below $605 anywhere in the window, and the tariff was never delayed, the declined renewal on July 20 reinforced the wall instead. The paper long closed 5.2 points ahead of a falling S&P. The consensus audit is the satisfying part: on registration day the tape had filed this under shelter CPI for spring 2027 and futures fell on the tariff news; within six sessions the market converged to our reading. That is what an alpha window looks like when it exists and gets taken.

**The book (standing calls, across domains).**

- **Next week (macro and rates): the hold outlasts the wall.** The FOMC meets July 28-29 against the strangest stack of the year: July-hike odds at 36 percent, a jobless-claims print at 187,000, the lowest of 2026, a tariff wall on 60 economies that went effective Thursday, and an oil impulse that cracked 4 percent on Friday. We say the committee holds, and the front end walks the hike back inside the week, because the fast channel that built the hike case is draining while the slow channel cannot print a number before autumn: the two-year closes Friday July 31 at or below 4.28. *Kill switch: the Fed delivers a hike on July 29, or Brent closes above $103 before Friday.*
- **Next month (geopolitics): peace signals are not signatures.** No signed, binding US-Iran framework before August 22, because the blockers are named and a framework needs all three ladders to come down at once while signals bring down one.

# ▸ INNER GAME
`;

/** The reformatted W30 — same grades, receipts, calls, and kill switches, presented per the
 *  contract. Must produce ZERO flags. */
const GOOD_FIXTURE = `# ▸ THE PREDICTIONS

*Three calls came due this week and all three hit, including the book's first closed profit. One early-season crop leg missed, and it leaves a lesson that is now law.*

**The scoreboard.**

- **Lumber front-runs the tariff — HIT, the first expressed win.** We said a dated cost increase on 30 percent of US supply would force yards to buy early, with a close above $640 by July 24. Futures closed at $654.53, up 4.6 percent from entry and 5.2 points ahead of a falling S&P. (W29-1)
- **The ten-year takes out 4.65 — HIT, five weeks early.** Registered in June as term premium returning once the Fed's map was gone. It printed 4.71 on Thursday, the highest since January 2025. The honest note: the driver was oil repricing the rate path, and the channel is named in the ledger. (W25-3)
- **The June macro call — HIT on all three legs.** The BOJ hiked to 1.0 percent, the Fed held with a hike alive on the table, and the ten-year cleared 4.65 with four days to spare. One flag: this row and W25-3 graded on the same move. (W0-1)
- **Crop conditions — MISS, conceded cleanly.** The call needed mid-July conditions below the five-year average; USDA printed corn at 67 and soybeans at 66, at or above it. There was never an instrument behind the call, and that is the lesson: no physical-series call ships without a named reading. (W0-8)

**The book.**

- **Next week — the hold outlasts the wall.** The Fed holds on July 29 and the front end walks the hike back inside the week, because the fast channel behind the hike case is draining while tariff inflation cannot print a number before autumn: the two-year closes Friday at or below 4.28. *Kill switch: a hike is delivered, or Brent closes above $103 first.*
- **Next month — peace signals are not signatures.** No signed, binding US-Iran framework before August 22. Friday's oil crack priced the beginning of the end and we are taking the other side, because all three blockers have to come down at once and signals bring down one. *Kill switch: a signed document published by both governments inside the window.*
- **Next year — the deterrent gets a document.** By July 2027, at least one European government formalizes an independent-deterrent step in a signed document, a sharing expansion, a framework, or a stated umbrella, not a speech. Carried at the book's lowest confidence. *Kill switch: mid-2027 arrives with only speeches and study groups.* (W29-7)

**Registered and watching.** Three new calls entered the ledger this week: the emigration-retention mechanism (W30-3), the UK ten-year holding above the US through Q2 2027 (W30-4), and a gigawatt-scale sodium-ion order by the Q1 2027 reports (W30-5), each with its chain and kill switch filed. On the clock: the AI-repricing family grades August 1 with no extension, helium retires if silent past August 4, and Oracle and the AI-no-new-high pair grade on the July 31 letters.

# ▸ INNER GAME
`;

function selftest(): number {
  let fails = 0;
  const expectBad = ['pred-frame', 'pred-bullet-cap', 'pred-book-count', 'pred-kill-switch', 'pred-book-cap'];
  const badFlags = lintPredictions(extractPredictionsSection(BAD_FIXTURE)!);
  for (const c of expectBad) {
    const fired = badFlags.some(f => f.check === c);
    console.log(`  ${fired ? 'PASS' : 'FAIL'} — ${c} fires on the W30-shaped bad fixture`);
    if (!fired) fails++;
  }
  const goodFlags = lintPredictions(extractPredictionsSection(GOOD_FIXTURE)!);
  const clean = goodFlags.length === 0;
  console.log(`  ${clean ? 'PASS' : 'FAIL'} — zero flags on the reformatted W30 (got: ${goodFlags.map(f => f.check).join(', ') || 'none'})`);
  if (!clean) fails++;
  console.log(`\nweekly-predictions-gate selftest — ${expectBad.length + 1 - fails}/${expectBad.length + 1} assertions passed`);
  return fails ? 1 : 0;
}

// ─── main ──────────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (arg === '--selftest') {
  process.exit(selftest());
} else if (!arg) {
  console.error('Usage: weekly-predictions-gate.ts <weekly.md | predictions-draft.md> | --selftest');
  process.exit(2);
} else {
  if (!fs.existsSync(arg)) {
    console.error(`File not found: ${arg}`);
    process.exit(2);
  }
  const section = extractPredictionsSection(fs.readFileSync(arg, 'utf8'));
  if (!section) {
    console.error('✗ No THE PREDICTIONS section found (and file does not read as a predictions pre-draft).');
    process.exit(1);
  }
  const flags = lintPredictions(section);
  console.log(`weekly-predictions-gate — ${arg} — ${flags.length} FAIL${flags.length === 1 ? '' : 'S'} (section: ${section.split(/\s+/).filter(Boolean).length} words)`);
  for (const f of flags) console.log(`  ✗ [${f.check}] ${f.message}`);
  if (flags.length) {
    console.error('\n✗ THE PREDICTIONS violates the presentation contract — restructure per system/Weekly_Generator.md before shipping.');
    process.exit(1);
  }
  console.log('✅ PRESENTATION CONTRACT PASS');
  process.exit(0);
}
