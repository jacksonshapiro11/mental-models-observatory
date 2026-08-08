#!/usr/bin/env node --experimental-strip-types
/**
 * adverse-datum-gate.ts — IMP-144 (2026-08-08, RC6). Critic mandate #1, 2026-08-08.
 *
 * THE FAILURE THIS EXISTS FOR. Three bullets in one brief withheld the figure most adverse to
 * their own thesis, and every figure they DID print was true:
 *
 *   M&M-2  argued "87 percent beat … beating has stopped carrying information" and offered The
 *          Trade Desk as its example. TTD MISSED Q2 revenue ($715.1M vs $752.6M consensus, adj.
 *          EPS −17%). The one example offered is not an instance of the phenomenon.
 *   AI&T-2 argued Alphabet's build "has stopped being capex and started being leverage" without
 *          printing TTM free cash flow of ≈ +$53B or ≈ $240B of cash and securities.
 *   M&M-1  argued "the economy lost 920,000 jobs" without printing that private payrolls ROSE
 *          30,000 while government FELL 53,000 — the composition inside its own release.
 *
 * WHY THE EXISTING GATES CANNOT SEE IT. `fact-gate` checks whether printed numbers are true; all
 * of these were. `reaction-symmetry-gate` (IMP-138, built for this defect one night earlier) FAILs
 * only on asymmetric PRICE REACTIONS across ≥2 companies in one bullet, and none of the three has
 * that shape. The class is wider and simpler: **a bullet asserts a directional thesis and does not
 * print the figure that cuts against it.**
 *
 * THE RULE IS A DISCLOSURE REQUIREMENT, NOT A JUDGEMENT. The gate never decides whether a figure
 * is adverse — it cannot know that, and a gate that tried would be a bias detector nobody could
 * calibrate. It asks only: did this bullet, which makes a strong directional claim, disclose a
 * counterweight at all? Two ways to satisfy it, both cheap and both honest:
 *
 *   (a) THE CONTRACT (the strong path): `{DATE}-truth.json` carries a `counterDatum` for the
 *       claim, and the bullet PRINTS that figure. The power is the requirement, not the parsing —
 *       a Writer required to record the strongest opposing figure from its own source cannot
 *       quietly omit it.
 *   (b) THE SELF-DISCLOSURE (the escape hatch): the bullet states its own counter in the open —
 *       "The counter is the same fact read forward: this book has not seen a downturn" (C&C-2,
 *       2026-08-08). A bullet that already does this right is never touched.
 *
 * NO ORPHAN (ESC-013 — E-GATE-INPUT-ORPHAN-01, three gates in one night blocked on inputs no
 * layer emits). The truth-contract leg is ADDITIVE: with no truth file, or no counterDatum rows,
 * the textual leg still operates and the gate is fully functional. It is never waiting on an
 * input nobody writes.
 *
 * Usage: node --experimental-strip-types scripts/adverse-datum-gate.ts <brief.md> [--truth <truth.json>]
 *        node --experimental-strip-types scripts/adverse-datum-gate.ts --selftest
 * Exit:  0 clean · 1 an undisclosed adverse datum · 2 usage error
 * Wired into: system/Brief_Editor.md Gate 1 · system/Markets_Macro_Generator.md ·
 *             system/AI_Tech_Generator.md · system/Companies_Crypto_Generator.md.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface AdverseFinding {
  check: 'adverse-datum' | 'adverse-datum-contract';
  severity: 'FAIL';
  message: string;
  bullet: string;
  thesis: string;
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

/**
 * THE TRIGGER. Strong directional claims about a named entity or an aggregate — the shapes the
 * 08-08 Critic named, and no more. Derived from, and measured against, the real 2026-08-08 v2:
 * 3 of 11 bullets trigger, and they are exactly the Critic's three receipts. Widening this beyond
 * "the thesis asserts a state CHANGE or a NEGATION about the world" buys false positives, and
 * every false positive here punishes a bullet for making an argument at all.
 *
 * A BARE "has stopped" IS EXCLUDED, and the reason is a real false positive caught in testing: the
 * 08-08 Wild Card bullet on the Atlantic circulation ("nearly shut down 3.4 million years ago")
 * matched it. That bullet reports a physical process, not a thesis about how the world now works,
 * and there is no adverse datum for it to withhold. The trigger must be the CLAIM SHAPE — a state
 * change asserted about an entity or an aggregate — never the verb alone.
 */
const THESIS_RE =
  /\b(?:has stopped (?:being|carrying|measuring|working|tracking)|stopped being \w+ and started being|is no longer|are no longer|does not measure|do not measure|the economy lost|has become the|is now the only)\b/i;

/**
 * THE ESCAPE HATCH. Explicit counter-disclosure. Deliberately NARROW: these are phrases a writer
 * uses when consciously turning the argument against itself, not connectives that appear in any
 * comparison. "against" and "but" are excluded on purpose — M&M-2 is full of "against" clauses
 * ("87 percent against 82 percent a year ago") and every one of them supports its thesis. The
 * 08-08 M&M-1 bullet contains "stood on the other side of this exact instrument failure", which
 * is a historical aside, not a concession — so "on the other side" is excluded too. A marker that
 * a supporting clause can satisfy is not a counter-disclosure requirement; it is a loophole.
 */
const COUNTER_RE =
  /\b(?:the counter (?:is|to this|here)|counter-case|the countervailing|cuts the other way|cuts against (?:this|it|the thesis)|the bear case|what would falsify|the falsifier|the objection|the case against|the risk to this|argues the other way|to be fair|the strongest figure against)\b/i;

/**
 * SCOPE. The mandate names three generators — Markets & Macro, Companies & Crypto, AI & Tech —
 * plus Geopolitics and the Take, which make the same kind of claim. The Wild Card, Discovery,
 * Model and Inner Game are NOT in scope, and that is not squeamishness: the second false positive
 * caught in testing was the 08-08 Wild Card bullet on Atlantic circulation, which matched
 * "is no longer" while reporting a palaeoclimate finding. There is no withheld market figure in a
 * three-million-year-old ocean current. A disclosure rule aimed at argument should not be pointed
 * at reportage.
 */
const IN_SCOPE_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|THE TAKE|The Take/i;

/** Bullets: a markdown list item that opens with a bold hook, inside an in-scope section.
 *  A fragment with no headings at all (a single bullet handed to the gate, as in the selftest and
 *  in the Editor's per-bullet use) is treated as in scope — the caller has already chosen it. */
export function bullets(body: string): string[] {
  const clean = stripHtmlComments(body);
  const split = (s: string) =>
    s.split(/\n(?=\s*[-*]\s+\*\*)/).filter(b => /^\s*[-*]\s+\*\*/.test(b));
  const lines = clean.split('\n');
  const headingIdx = lines
    .map((l, i) => (/^#{1,6}\s/.test(l) ? i : -1))
    .filter(i => i >= 0);
  if (!headingIdx.length) return split(clean);

  const out: string[] = [];
  for (let k = 0; k < headingIdx.length; k++) {
    const start = headingIdx[k]!;
    const end = k + 1 < headingIdx.length ? headingIdx[k + 1]! : lines.length;
    if (!IN_SCOPE_SECTION_RE.test(lines[start]!)) continue;
    out.push(...split(lines.slice(start + 1, end).join('\n')));
  }
  return out;
}

/** Does this bullet disclose a counter in the open? (Exported so the selftest can prove WHY.) */
export function counterDisclosures(bullet: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(COUNTER_RE.source, 'gi');
  while ((m = re.exec(bullet)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard (IMP-136's class)
    out.push(m[0]);
  }
  return out;
}

/** Every numeric token in a bullet, normalised for comparison against a recorded counterDatum. */
function numerals(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,.]*/g))
    out.add(m[0].replace(/[,]/g, '').replace(/\.0+$/, ''));
  return out;
}

export interface TruthCounter {
  bullet?: string;
  counterDatum?: string;
}

export function adverseDatum(
  body: string,
  truthClaims?: Record<string, TruthCounter> | undefined
): AdverseFinding[] {
  const findings: AdverseFinding[] = [];
  const bs = bullets(body);

  for (const bullet of bs) {
    const t = THESIS_RE.exec(bullet);
    if (!t) continue; // no directional thesis, nothing to counter
    if (counterDisclosures(bullet).length) continue; // the bullet already prints its own counter

    findings.push({
      check: 'adverse-datum',
      severity: 'FAIL',
      message:
        `UNDISCLOSED ADVERSE DATUM — this bullet asserts a directional thesis ("${t[0]}") and prints no counterweight. ` +
        `Either state the strongest figure from your OWN source that cuts against the claim, or say in the open why none exists. ` +
        `2026-08-08 receipts: M&M-2 argued "beating has stopped carrying information" and offered The Trade Desk, which MISSED Q2 revenue ` +
        `($715.1M vs $752.6M consensus) — the one example given was not an instance of the phenomenon; AI&T-2 argued Alphabet's build ` +
        `"has stopped being capex and started being leverage" while TTM free cash flow was still ≈ +$53B on ≈ $240B of cash. ` +
        `Every number in both was TRUE — the omission was the argument. Record it as counterDatum in {DATE}-truth.json and print it.`,
      bullet: bullet.slice(0, 200).replace(/\s+/g, ' '),
      thesis: t[0],
    });
  }

  // THE CONTRACT LEG (additive — absent truth rows never disable the gate). Once the Writer has
  // recorded the strongest opposing figure, printing it stops being optional.
  if (truthClaims) {
    for (const [key, row] of Object.entries(truthClaims)) {
      const cd = row?.counterDatum;
      if (!cd) continue;
      const wanted = numerals(cd);
      if (!wanted.size) continue;
      const target = row.bullet
        ? bs.find(b =>
            b.toLowerCase().includes(row.bullet!.toLowerCase().slice(0, 40))
          )
        : undefined;
      const haystack = target ?? stripHtmlComments(body);
      const printed = numerals(haystack);
      const missing = [...wanted].filter(n => !printed.has(n));
      if (missing.length === wanted.size) {
        findings.push({
          check: 'adverse-datum-contract',
          severity: 'FAIL',
          message:
            `RECORDED COUNTER-DATUM NOT PRINTED — {DATE}-truth.json records "${key}" with counterDatum "${cd}", and none of its figures ` +
            `(${[...wanted].join(', ')}) appears in ${target ? 'the bullet it belongs to' : 'the brief'}. The Writer found the number that ` +
            `cuts against the thesis and then left it out of the text. Print it, or withdraw the thesis it contradicts.`,
          bullet: (target ?? '').slice(0, 200).replace(/\s+/g, ' '),
          thesis: key,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
function sectionBlock(body: string, heading: RegExp): string | null {
  const lines = stripHtmlComments(body).split('\n');
  const start = lines.findIndex(l => /^#{1,6}\s/.test(l) && heading.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(l => /^#{1,6}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function pickBullet(
  body: string,
  heading: RegExp,
  pick: (b: string) => boolean
): string | null {
  const block = sectionBlock(body, heading);
  if (block === null) return null;
  return bullets(block).find(pick) ?? null;
}

function selftest(): number {
  const root = process.cwd();
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  const v2Path = path.join(root, 'daily-briefs/2026-08-08-v2.md');
  if (!fs.existsSync(v2Path)) {
    console.error(`SELFTEST FAIL — missing fixture: ${v2Path}`);
    return 1;
  }
  const v2 = fs.readFileSync(v2Path, 'utf8');

  // ── FIRE, on the two bullets the Critic's acceptance gate names, off the real file. ──
  const mm2 = pickBullet(
    v2,
    /Markets\s*&\s*Macro/i,
    b => /87 percent/.test(b) && /Trade Desk/.test(b)
  );
  t(
    !!mm2,
    '[fixture] the real M&M-2 "87 percent beat" bullet was located in 2026-08-08-v2.md'
  );
  t(
    mm2 ? adverseDatum(mm2).length === 1 : false,
    'FIRES on the REAL M&M-2 — thesis "has stopped carrying", no counterweight (TTD missed Q2 revenue)'
  );

  const ait2 = pickBullet(
    v2,
    /AI\s*&\s*Tech/i,
    b => /Alphabet/.test(b) && /free cash flow/i.test(b)
  );
  t(
    !!ait2,
    '[fixture] the real AI&T-2 Alphabet free-cash-flow bullet was located'
  );
  t(
    ait2 ? adverseDatum(ait2).length === 1 : false,
    'FIRES on the REAL AI&T-2 — "has stopped being capex and started being leverage", no TTM FCF or cash printed'
  );

  // The Critic named a third receipt; it is not in the acceptance gate, but it must not escape.
  const mm1 = pickBullet(v2, /Markets\s*&\s*Macro/i, b =>
    /Nonfarm payrolls/.test(b)
  );
  t(
    mm1 ? adverseDatum(mm1).length === 1 : false,
    'FIRES on the REAL M&M-1 — "the economy lost 920,000 jobs" with no private/government composition'
  );
  t(
    mm1 ? counterDisclosures(mm1).length === 0 : false,
    '…and for the RIGHT reason: "stood on the other side of" is a historical aside, not a counter-disclosure'
  );

  // ── SILENT, on the two the Critic says already do it right. ──
  const cc2 = pickBullet(
    v2,
    /Companies\s*&\s*Crypto/i,
    b => /Grab/.test(b) && /lending/.test(b)
  );
  t(!!cc2, '[fixture] the real C&C-2 Grab lending bullet was located');
  t(
    cc2 ? adverseDatum(cc2).length === 0 : false,
    'SILENT on the real C&C-2 (Grab), which prints its own counter'
  );
  t(
    cc2 ? counterDisclosures(cc2).length > 0 : false,
    '…and the escape hatch is what does it: "The counter is the same fact read forward" is detected'
  );

  const signal = sectionBlock(v2, /The Signal/i);
  t(
    signal ? adverseDatum(signal).length === 0 : false,
    'SILENT on the real Signal-1, which prints exposure on both sides'
  );

  // ── WHOLE-BRIEF FIRE RATE. A gate that fires on a third of the brief every night gets ignored.
  const all = adverseDatum(v2);
  t(
    all.length === 3,
    `whole-brief fire rate on the real 08-08 v2 is exactly the Critic's 3 receipts (got ${all.length})`
  );
  t(
    bullets(v2).length >= 7,
    `[fixture] the gate scanned every IN-SCOPE bullet: ${bullets(v2).length} of 11 (Wild Card excluded by design)`
  );
  const wild = sectionBlock(v2, /Wild Card/i);
  t(
    wild ? adverseDatum(`## The Wild Card\n${wild}`).length === 0 : false,
    'SILENT on the whole real Wild Card section — "is no longer" about a 3.4-million-year-old ocean current is reportage, not a withheld figure'
  );

  // ── THE MINIMAL PAIR: identical bullets differing ONLY by the disclosed counter.
  const bare =
    '- **A hook.** The build has stopped being capex and started being leverage, and the guide went up again.';
  const withCounter =
    bare +
    ' The counter is that trailing free cash flow is still positive at $53 billion.';
  t(
    adverseDatum(bare).length === 1,
    'FIRES on the minimal pair without a counter'
  );
  t(
    adverseDatum(withCounter).length === 0,
    'SILENT on the same sentence once the counter is printed (the fix)'
  );

  // ── THE CONTRACT LEG, both directions, and its graceful degradation (ESC-013).
  //     The minimal pair here differs ONLY in whether the RECORDED figure reaches the page: both
  //     bullets satisfy the textual leg (each prints a counter), so only the contract leg can move.
  const truthRow = {
    'ait-2': {
      bullet: 'A hook.',
      counterDatum: 'TTM free cash flow +$53 billion',
    },
  };
  const counterButNotTheFigure =
    '- **A hook.** The build has stopped being capex and started being leverage. The counter is that the balance sheet is still unusually strong.';
  const contractFinds = adverseDatum(counterButNotTheFigure, truthRow);
  t(
    contractFinds.length === 1 &&
      contractFinds[0]!.check === 'adverse-datum-contract',
    'CONTRACT: a recorded counterDatum ($53B) that never reaches the page FAILS, even though the bullet prints A counter'
  );
  const printedBullet =
    '- **A hook.** The build has stopped being capex. The counter is trailing free cash flow of $53 billion.';
  t(
    adverseDatum(printedBullet, truthRow).length === 0,
    'CONTRACT: …and passes once that same recorded figure is printed'
  );
  t(
    adverseDatum(counterButNotTheFigure, undefined).length === 0,
    'NO ORPHAN: with NO truth file the same bullet is CLEAN — the contract is additive, never a blocker (ESC-013)'
  );
  t(
    adverseDatum(bare, {}).length === 1,
    'NO ORPHAN: an EMPTY truth object does not disable the textual leg'
  );

  const total = 19;
  console.log(
    `\nadverse-datum-gate selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ adverse-datum-gate verified in BOTH directions on the real 2026-08-08 v2.'
  );
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const briefPath = args.find(a => !a.startsWith('--'));
  if (!briefPath || !fs.existsSync(briefPath)) {
    console.error(
      'usage: adverse-datum-gate.ts <brief.md> [--truth <truth.json>]'
    );
    return 2;
  }
  const ti = args.indexOf('--truth');
  let truthClaims: Record<string, TruthCounter> | undefined;
  if (ti > -1 && args[ti + 1] && fs.existsSync(args[ti + 1]!)) {
    try {
      truthClaims = JSON.parse(fs.readFileSync(args[ti + 1]!, 'utf8'))?.claims;
    } catch {
      truthClaims = undefined;
    }
  }
  const findings = adverseDatum(
    fs.readFileSync(briefPath, 'utf8'),
    truthClaims
  );
  console.log(`adverse-datum-gate — ${path.basename(briefPath)}`);
  for (const f of findings)
    console.error(`  ✗ [${f.check}] ${f.message}\n      "${f.bullet}"`);
  if (findings.length) {
    console.error(
      `\n❌ ADVERSE-DATUM FAIL — ${findings.length} bullet(s) assert a thesis without disclosing what cuts against it.`
    );
    return 1;
  }
  console.log(
    '\n✅ ADVERSE-DATUM PASS — every directional thesis prints its counterweight.'
  );
  return 0;
}

// Only take over the process when RUN, not when IMPORTED.
if (/adverse-datum-gate\.ts$/.test(process.argv[1] ?? '')) process.exit(main());
