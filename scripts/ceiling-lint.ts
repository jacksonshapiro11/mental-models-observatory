#!/usr/bin/env node --experimental-strip-types
/**
 * ceiling-lint.ts — advisory ceiling lint (NEW 2026-07-10, Ceiling Doctrine v0.5 §9).
 *
 * Kills the mechanizable COUNTERFEITS of insight in the brief text. It does NOT grade
 * insight — that stays the Critic's judgment (the dual bar). FLAG-only, exit 0 always:
 * ceiling work never blocks the ship. Wired into: brief-quality-gate (QG acts on flags),
 * Editor Gate 14(e) (mandatory resolution), Pipeline Controller morning gate 16 (spot check).
 *
 * Checks (each calibrated on the real 2026-07-09/07-10 briefs — see --selftest):
 *   intro-preview-padding    "we'll cover / coming up / below we / today we…" in the intro
 *   intro-watch-missing      the payoff intro must carry a watch line (an observable)
 *   intro-throughline-label  "The through-line: / the theme: / the common thread" — announcing
 *                            a label instead of stating a conclusion (the THEME counterfeit's
 *                            syntactic signature; the real 07-10 intro fires this)
 *   number-presence          each Take/Six bullet needs ≥1 numeral that isn't a pure date
 *   hollow-significance      "this matters / the significance" with no causal connector within
 *                            ~15 words
 *   thematic-echo            two Six bullets opening on the same 4-grams (noun-swapped
 *                            meta-sentence slop: "Fragmentation defines X / Fragmentation
 *                            defines Y")
 *
 * Usage:
 *   node --experimental-strip-types scripts/ceiling-lint.ts <brief.md>
 *   node --experimental-strip-types scripts/ceiling-lint.ts --selftest
 *
 * Exit: 0 always (advisory), except --selftest failure (1) / usage (2).
 */
import * as fs from 'fs';
import * as path from 'path';

interface Flag {
  check: string;
  where: string;
  message: string;
}

// ---------- structure extraction ----------
function introOf(brief: string): string {
  // The intro = the LAST italic paragraph before the first section marker (---, # ▸, ## ▸).
  // (The Life Note is also italic but sits earlier; taking the last italic block gets the intro.)
  const head = brief.split(/^(?:---|#\s*▸|##\s*▸)/m)[0];
  const italics = head
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => /^\*[^*].*\*$/s.test(p) && p.length > 60);
  return italics.length ? italics[italics.length - 1] : '';
}

interface Bullet {
  section: string;
  text: string;
}
function sixBullets(brief: string): Bullet[] {
  const m = brief.match(
    /^#\s*▸\s*THE SIX\s*$([\s\S]*?)(?=^##\s+The Wild Card|^#\s*▸)/m
  );
  if (!m) return [];
  const region = m[1];
  const bullets: Bullet[] = [];
  let section = '';
  for (const line of region.split('\n')) {
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      section = h[1].trim();
      continue;
    }
    const b = line.match(/^-\s+\*\*(.+)/);
    if (b) bullets.push({ section, text: line.replace(/^-\s+/, '') });
  }
  return bullets;
}
function takeBody(brief: string): string {
  const m = brief.match(/^#\s*▸\s*THE TAKE\s*$([\s\S]*?)(?=^#\s*▸|\s*$)/m);
  return m ? m[1] : '';
}

// ---------- checks ----------
const PREVIEW_RE =
  /\b(we(?:'|’)ll cover|we will cover|coming up|in this brief|today we(?:'|’)ll|today we will|below,? we|let(?:'|’)s dive|read on for)\b/i;
function checkPreviewPadding(intro: string): Flag | null {
  const m = intro.match(PREVIEW_RE);
  if (!m) return null;
  return {
    check: 'intro-preview-padding',
    where: 'Intro Summary',
    message: `Intro contains preview padding ("${m[0]}") — the payoff intro states the conclusion; it never announces the menu.`,
  };
}

const WATCH_RE =
  /\b(watch|the tell\b|to confirm\b|resolves?\b|would confirm|next (?:session|week|month)|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow)\b/i;
function checkWatchMissing(intro: string): Flag | null {
  if (!intro) return null;
  if (WATCH_RE.test(intro)) return null;
  return {
    check: 'intro-watch-missing',
    where: 'Intro Summary',
    message: `Intro has no watch line — the payoff ends on one observable that advances or resolves the conclusion (dated when possible). Add it from the day's strongest resolvable thread.`,
  };
}

const LABEL_RE =
  /\b(the through[- ]?line\s*:|the theme\s*:|the pattern\s*:|the common thread\b|the takeaway\s*:)/i;
function checkThroughlineLabel(intro: string): Flag | null {
  const m = intro.match(LABEL_RE);
  if (!m) return null;
  return {
    check: 'intro-throughline-label',
    where: 'Intro Summary',
    message: `Intro announces a label ("${m[0].trim()}") instead of stating the conclusion directly — the THEME counterfeit's signature. State the mechanism/tension itself ("BECAUSE X… / A and B are arguing over C"), not the fact that one exists.`,
  };
}

function hasNonDateNumeral(text: string): boolean {
  // Strip pure years, "July 10"-style dates, ordinal dates, and time-of-day.
  const stripped = text
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi,
      ' '
    )
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ');
  return /\d/.test(stripped);
}
/**
 * A COUNT IS NOT A PRICE. (2026-07-14 — IMP-050, the 07-14 Critic's mandate #2.)
 *
 * WORKED FAILURE: the 07-14 Critic mandated a pricing anchor for AI&T-3 (a compliance cost, the
 * revenue at stake, an enforcement penalty). The Editor satisfied `number-presence` by writing
 * **"4 cloud providers"** and **"the 4 hyperscalers"** — the bullet's only non-date numerals — and
 * ceiling-lint printed **0 FLAGs** on the shipped brief while the Critic graded that same bullet
 * `missing: pricing`. The check was not missing; **the check was gamed**, because it counted
 * numerals instead of testing magnitude. That is constraint erosion by literal compliance (RC4),
 * and it is the second Goodhart receipt in two days (07-13 editor log: "ceiling-lint numerals
 * added — M&M-3, AI&T-1, Geo-3", while the Critic graded 5 of those bullets `missing: pricing`).
 *
 * A PRICED MAGNITUDE carries a unit of money, a percentage, basis points, or an explicit multiple —
 * the number that MOVES and WHO PAYS IT. A tally of the nouns the sentence is already about is not
 * a price. Scoped to the four analytical sections + the Take, where the pricing rung is the
 * standard; the science/discovery bullets keep the any-numeral floor, because a bumble-bee
 * cognition finding does not owe the reader a dollar sign.
 *
 * This is a FLOOR, not a rubric: it tests that a price is PRESENT, never that it is the RIGHT one.
 * The rubric leg — what a pricing rung IS — is ESC-008, due at the payoff-window close (07-18).
 */
const PRICED_RE =
  /(?:[$€£¥]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:%|percent\b|percentage points?|bps?\b|basis points?|cents?\b|dollars?\b|euros?\b)|\b\d+(?:\.\d+)?x\b|\b\d+(?:\.\d+)?-fold\b)/i;
const PRICED_SECTION_RE = /markets|macro|companies|crypto|\bai\b|tech|geopol/i;
function hasPricedMagnitude(text: string): boolean {
  return PRICED_RE.test(text);
}

function checkNumberPresence(bullets: Bullet[], take: string): Flag[] {
  const flags: Flag[] = [];
  bullets.forEach((b, i) => {
    if (!hasNonDateNumeral(b.text)) {
      flags.push({
        check: 'number-presence',
        where: `${b.section} bullet ${i + 1}`,
        message: `Six bullet carries zero non-date numerals ("${b.text.slice(2, 60)}…") — every Take/Six bullet needs ≥1 number that isn't a date (the pricing/magnitude rung's floor).`,
      });
    } else if (
      PRICED_SECTION_RE.test(b.section) &&
      !hasPricedMagnitude(b.text)
    ) {
      flags.push({
        check: 'pricing-magnitude',
        where: `${b.section} bullet ${i + 1}`,
        message: `Bullet has numerals but NO PRICED MAGNITUDE ("${b.text.slice(2, 60)}…") — no money, no %, no bps, no multiple. A COUNT IS NOT A PRICE: "4 cloud providers" is a tally of the nouns the sentence is already about (07-14 AI&T-3, which cleared number-presence and was still graded \`missing: pricing\`). Give the reader the number that MOVES and WHO PAYS IT — the compliance cost, the revenue at stake, the spread, the penalty. If no price exists, say what the number would have to be for the claim to bind. Do NOT satisfy this by adding a tally.`,
      });
    }
  });
  if (take.trim()) {
    if (!hasNonDateNumeral(take)) {
      flags.push({
        check: 'number-presence',
        where: 'The Take',
        message:
          'The Take carries zero non-date numerals — the mechanism needs at least one magnitude.',
      });
    } else if (!hasPricedMagnitude(take)) {
      flags.push({
        check: 'pricing-magnitude',
        where: 'The Take',
        message:
          'The Take has numerals but no priced magnitude (money / % / bps / multiple) — a mechanism the reader cannot price is a mechanism they cannot trade. A count is not a price.',
      });
    }
  }
  return flags;
}

const SIGNIF_RE = /\b(this matters|the significance)\b/gi;
const CAUSAL_RE =
  /\b(because|drives?|drove|forces?|forced|so that|which means|implies|implying|since|therefore|→)\b/i;
function checkHollowSignificance(body: string): Flag[] {
  const flags: Flag[] = [];
  let m: RegExpExecArray | null;
  while ((m = SIGNIF_RE.exec(body)) !== null) {
    const tail = body.slice(m.index, m.index + 160); // ~15 words of lookahead
    if (!CAUSAL_RE.test(tail)) {
      flags.push({
        check: 'hollow-significance',
        where: `…${body.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')}…`,
        message: `"${m[0]}" with no causal connector within ~15 words — significance must be shown (because/drives/forces/which means), never announced.`,
      });
    }
  }
  return flags;
}

function fourGrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 15);
  const grams = new Set<string>();
  for (let i = 0; i + 4 <= words.length; i++)
    grams.add(words.slice(i, i + 4).join(' '));
  return grams;
}
function checkThematicEcho(bullets: Bullet[]): Flag[] {
  const flags: Flag[] = [];
  for (let i = 0; i < bullets.length; i++) {
    for (let j = i + 1; j < bullets.length; j++) {
      const a = fourGrams(bullets[i].text);
      const b = fourGrams(bullets[j].text);
      let shared = 0;
      for (const g of a) if (b.has(g)) shared++;
      if (shared >= 2) {
        flags.push({
          check: 'thematic-echo',
          where: `${bullets[i].section} × ${bullets[j].section}`,
          message: `Two Six bullets open on the same phrasing (${shared} shared 4-grams) — the noun-swapped meta-sentence is the one-note counterfeit. Each bullet leads with its OWN thesis.`,
        });
      }
    }
  }
  return flags;
}

// ---------- C&C pricing + Model canonical checks (RESTORED 2026-07-31, IMP-111) ----------
// These three checks — IMP-099 cc-deal-magnitude/--strict-cc (07-25), IMP-103 model-canonical-
// example (07-26), IMP-108 cc-pricing-rung (07-29) — were built and "verified ✅" but REVERTED by
// the nightly `pull --rebase origin main` because the scripts/ edits were never committed (RC7
// persistence; see IMP-110/IMP-111 in the ledger). Restored here from the ledger specs, and each
// row's ledger check is now COMPOUND (run:<selftest> && grep:<file>:<name>) so a future revert of
// the specific check turns verify-improvements RED instead of hiding behind an exit-0 selftest.
function sectionRegion(
  brief: string,
  headerRe: RegExp,
  nextRe: RegExp
): string {
  const m = brief.match(headerRe);
  if (!m || m.index == null) return '';
  const rest = brief.slice(m.index + m[0].length);
  const n = rest.match(nextRe);
  return n && n.index != null ? rest.slice(0, n.index) : rest;
}
function ccRegion(brief: string): string {
  return sectionRegion(brief, /^##\s+Companies\s*&\s*Crypto\s*$/m, /^##\s+/m);
}
function ccItems(brief: string): string[] {
  const region = ccRegion(brief);
  if (!region.trim()) return [];
  return region
    .split(/\n(?=-\s+\*\*)/)
    .map(s => s.trim())
    .filter(s => /^-\s+\*\*/.test(s));
}
function modelSection(brief: string): string {
  return sectionRegion(brief, /^#\s*▸\s*THE MODEL\s*$/m, /^#\s*▸/m);
}

// IMP-099 (E-CC-SECTION-WEAKNESS-01, 07-25): a C&C bullet describing a DEAL must carry a deal
// magnitude — a scale money figure ($Xbn/$Xmn) OR a user/subscriber/artist count. "artists keep 100%
// of revenue" (07-25 Nina) prices the business model, not the transaction, so it does NOT satisfy.
const CC_DEAL_RE =
  /\b(acqui\w+|merger|merge[sd]?|takeover|buyout|tender offer|all-(?:stock|cash)|agreed to (?:buy|acquire)|deal to (?:buy|acquire)|to acquire|to buy out)\b/i;
const CC_MONEY_RE =
  /[$€£¥]\s?\d[\d,.]*\s*(?:billion|million|trillion|bn\b|mn\b)/i;
const CC_COUNT_RE =
  /\b\d[\d,.]*\s*(?:million|billion|thousand|k\b)?\s*(?:users?|subscribers?|artists?|customers?|members?|accounts?|creators?|developers?|merchants?|monthly actives?|MAUs?|daily actives?|listeners?|riders?)\b/i;
function checkCcDealMagnitude(brief: string): Flag[] {
  const flags: Flag[] = [];
  ccItems(brief).forEach((item, i) => {
    if (!CC_DEAL_RE.test(item)) return;
    if (CC_MONEY_RE.test(item) || CC_COUNT_RE.test(item)) return;
    flags.push({
      check: 'cc-deal-magnitude',
      where: `Companies & Crypto bullet ${i + 1}`,
      message: `A C&C bullet describes a DEAL (acquisition/merger/takeover) but carries NO deal magnitude — no scale money figure and no user/subscriber/artist count ("${item.slice(4, 64).replace(/\n/g, ' ')}…"). A percentage of the target's own revenue ("artists keep 100%") prices the business model, not the transaction. Give the price paid, the user base, or the revenue at stake.`,
    });
  });
  return flags;
}

// IMP-108 (E-CC-ESSENTIAL-DROUGHT-01, 07-29): a SECTION-LEVEL advisory — fires ONCE if the whole C&C
// section lacks ANY comparative valuation (a multiple vs a referent, a premium/discount to a named
// comparable, what the market prices/pays/values, or a dated historical precedent). A bare deal price
// ($3.8B), a TAM, and an EPS-vs-estimate do NOT satisfy it — the only clear is to price what the
// market already values.
const CC_COMPARATIVE_RE =
  /(?:\b\d+(?:\.\d+)?x\b|\b(?:premium|discount)\s+(?:to|over|vs\.?|versus)\b|\bmarket\s+(?:prices?|pays?|values?|is\s+(?:pricing|paying|valuing)|caps?|capitali)|\b(?:priced|valued|trades?|trading)\s+(?:at|around)\b[^.]*\b(?:vs\.?|versus|against|premium|discount|multiple|times)\b|\b(?:19\d\d|20[01]\d|202[0-3])\b)/i;
function checkCcPricingRung(brief: string): Flag[] {
  const region = ccRegion(brief);
  if (!region.trim()) return [];
  if (CC_COMPARATIVE_RE.test(region)) return [];
  return [
    {
      check: 'cc-pricing-rung',
      where: 'Companies & Crypto (section)',
      message: `The whole C&C section carries NO comparative valuation — no multiple vs a referent, no premium/discount to a named comparable, no "what the market prices/pays", no dated precedent with a sized outcome. Bare deal prices and EPS-vs-estimate are not comparatives. Price what the market already values (a 14x vs the group, a premium to a named peer, the historical precedent and its outcome).`,
    },
  ];
}

// IMP-103 (E-MODEL-POOL-EXHAUSTION-01, 07-26): the Model's illustration is a cached business-school
// case (Nokia/Blockbuster/Kodak/BlackBerry/MySpace/Sears/Xerox PARC). Advisory — the angle can still
// be fresh (Kodak's undeployed CCD patent), so the Editor confirms the angle is non-obvious.
const CANONICAL_MODEL_CASE_RE =
  /\b(Nokia|Blockbuster|Kodak|BlackBerry|MySpace|Sears|Xerox PARC)\b/i;
// IMP-112 (08-01 Critic mandate #1, 🔴): the 07-31 whitelist rewrite made rule 5 explicit — "a
// familiar model is fine; the ILLUSTRATION is where the section earns its novelty" — and the very
// next brief taught Levels of Emergence with the circular-track traffic jam AND "a single molecule
// has no temperature", i.e. THE two textbook emergence examples, and every gate passed it. The
// 07-26 family covered business-school cases only; the science-canon family is the other half of
// the same failure. Scoped to the Model section, so a traffic jam in a Markets bullet is untouched.
const SCIENCE_CANON_MODEL_CASE_RE =
  /\b(traffic jam|ant colon(?:y|ies)|flocking|boids|bird flock\w*|termite mound|slime mou?ld|Game of Life|Conway's|double[- ]slit|butterfly effect)\b|\bwater\b.{0,10}\bwet\b|\bmolecules?\b.{0,20}\btemperature\b/i;
function checkModelCanonicalExample(brief: string): Flag[] {
  const section = modelSection(brief);
  const m = section.match(CANONICAL_MODEL_CASE_RE);
  if (m) {
    return [
      {
        check: 'model-canonical-example',
        where: 'The Model',
        message: `The Model illustrates with "${m[0]}" — among the most overused business-school cases in existence. Under pool exhaustion the illustration is where the section earns novelty: prefer a current-brief entity living the same tradeoff, or a less-obvious anchor. If the angle is genuinely fresh (e.g. Kodak's undeployed CCD patent), confirm it is non-obvious before keeping.`,
      },
    ];
  }
  const s = section.match(SCIENCE_CANON_MODEL_CASE_RE);
  if (s) {
    return [
      {
        check: 'model-canonical-example',
        where: 'The Model',
        message: `The Model illustrates with "${s[0].trim()}" — the science-canon equivalent of Nokia: the example every popular account of emergence/complexity already uses (traffic jams, ant colonies, flocking, "a molecule has no temperature", the double slit, the butterfly effect). Whitelist rule 5: under a well-known concept the ILLUSTRATION is where the section earns its novelty. Replace it with a current-brief entity living the same mechanism, or an anchor the reader cannot predict.`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// IMP-168 — COMPARATOR SELECTION + RANGE COLLAPSE (2026-08-13 Critic mandate #2, RC2, new sub-class)
//
// WORKED FAILURE, 2026-08-13, THREE INSTANCES IN THREE SECTIONS IN ONE NIGHT — and every one is a
// TRUE statement about a REAL figure from the CITED source, which is exactly why `source-conclusion`
// and `attributed-superlative` are both blind to them. The defect is not the number. It is the
// SELECTION the brief made from inside its own source and did not disclose.
//
//   AI&T-2 — the whole claim is a 16x ratio, picked out of the source's own THREE-ROW table:
//       Meta Muse Glimmer   52 KiB    ← the brief's subject
//       Qwen3.6 27B         64 KiB    ← NEVER MENTIONED IN THE BRIEF
//       Gemma 4 31B        840 KiB    ← the brief's chosen comparator
//     52/840 = 6.2% ✓ and 840/52 = 16.2 ✓ — the arithmetic is all correct. Against Qwen3.6 27B
//     (27B vs Glimmer's 30B, at least as comparable as Gemma's 31B) the ratio is 52/64 = 81%,
//     i.e. **1.2x, not 16x**. Raschka's own framing calls Glimmer "a Gemma-like architecture"
//     running 32Q/2KV where Gemma 4 runs 32Q/16KV local — the brief compared it to the one model
//     whose KV config is LEAST like it and called the gap a finding.
//   DISCOVERY — "each a different set of TWENTY species" where the source says communities
//     "comprising **12 to 20** species". Range-top printed as a point value.
//
// THE CHECK IS AN EMISSION CONTRACT, NOT A TABLE READER — deliberately. Nothing in this repo can
// see the rows of a source's table, and a check that guesses at them would be a false-positive
// engine. So: a ratio against a single NAMED THIRD PARTY must carry a `comparator-set:<slug>` truth
// row listing every comparator the cited source itself provides; a study-sourced SET-SIZE count
// stated as a point value must carry a `source-range:<slug>` row. If your source's table has three
// rows and you print one ratio, YOU HAVE MADE A SELECTION — say so in the sentence.
//
// THE SILENT LEGS ARE WHAT MAKE IT A CHECK RATHER THAN A NUMERAL DETECTOR (mandate's own list):
//   · Geo-2's 80-to-1 ($4M interceptor vs ~$50k Shahed) — two INDEPENDENTLY sourced figures, not
//     rows of one comparator table. No single named third-party comparator frame → silent.
//   · C&C-2's 194 turns — a ratio of two of the SAME issuer's own figures. No third party → silent.
//   · Geo-2's CSIS "759 to 827" — the brief PRINTS the range. That is the behaviour the range leg
//     exists to reward, and the reason it cannot be a bare numeral detector.
const RATIO_CLAIM_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:x|×)\s+(?:the\s+)?(?:\w+\s+){0,3}\b|\babout\s+(\d+(?:\.\d+)?)\s*percent\s+of\s+a\s+comparable\b|\b(\d+)\s*-\s*to\s*-\s*(\d+)\b/i;
// A comparator FRAME: the ratio is stated AGAINST a single named third party. "against X", "vs X",
// "compared with X", "a comparable <noun>" — the shape that hides a selection.
const COMPARATOR_FRAME_RE =
  /\b(?:against|versus|vs\.?|compared\s+(?:with|to)|relative\s+to)\s+(?:about\s+|roughly\s+|some\s+)?(?:[\d.,]+\s*\w+\s+(?:for|of)\s+)?([A-Z][A-Za-z0-9.&'’-]*(?:\s+[A-Z0-9][A-Za-z0-9.&'’-]*){0,3})\b|\ba\s+comparable\s+(?:open\s+)?\w+\b/;
// Set-size nouns — a COUNT OF MEMBERS drawn from a study's set. This is the family where a range
// top gets printed as a point value, and it is narrow on purpose.
const SET_SIZE_NOUN_RE =
  /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+(species|communities|strains|genomes|samples|sites|participants|subjects|isolates|populations|cohorts|trials|cases)\b/i;
// The brief printing a range itself — the clean negative. If the range is on the page, the reader
// has the selection and nothing is hidden.
// 🔴 NO BARE HYPHEN, AND THE PAIR MUST ASCEND. The first version of this matched "2026-08" out of
// a source URL and reported a DATE as a printed range — the identical defect to `price-vs-archive`
// reading a bare year as a commodity price (CARRY 2026-08-11 row 35). A false positive on a TRUE
// leg trains the next session to skim the gate's output, so the hyphen form is gone and
// `rangeAscends` proves the two numerals are a real low→high pair.
const RANGE_PRINTED_RE =
  /\b(\d[\d,.]*)\s*(?:to|–|—)\s*(\d[\d,.]*)\b|\bbetween\s+(\d[\d,.]*)\s+and\s+(\d[\d,.]*)\b/i;
// ---------------------------------------------------------------------------
// IMP-181 — SINGLE-INSTANCE GENERALIZATION (2026-08-16 Critic mandate #3, RC2).
//
// AI&T-1 led with: "...on the right one AN OPEN-WEIGHT MODEL runs about 25 percent more expensive
// than the frontier." The bullet's own evidence, quoted verbatim by the bullet: "...on that basis
// K3 comes out roughly 25 percent more expensive." ONE named model in the evidence; an INDEFINITE
// CATEGORY in the lead. The unit also switched sets between "open-weight" (lead) and "open-source"
// (body). ceiling-lint exited 0 with zero FLAGs, because its pricing rung asks whether a MAGNITUDE
// IS PRESENT and never whether the magnitude's SUBJECT is the subject the evidence measured.
//
// The lead sentence is the one that gets quoted, screenshotted and remembered. A lead broader than
// its evidence is not a rounding error in emphasis; it is a different claim, and the wider one is
// the one that travels.
//
// UNRESOLVED-FACT, NEVER FAIL: whether a second instance exists is a browser question and the
// evening has no browser (ESC-013 orphan-input discipline). ceiling-lint is advisory by design.
//
// THE ESCAPE HATCH IS THE FIX: name the instance in the lead, or name a second instance in the
// evidence. Both make the sentence truer, neither costs a word of substance.
const INDEFINITE_CATEGORY_RE =
  /\b(an?)\s+([a-z]+(?:-[a-z]+)*\s+)?(model|sovereign|bank|issuer|index|lender|miner|utility|insurer|exchange|chipmaker)\b/i;
const MAGNITUDE_RE =
  /\b\d+(?:\.\d+)?\s*(?:percent|%|basis points|bps|times|x\b)|\$\s?\d/i;

/** Capitalized or alphanumeric product/company tokens — the "instances" a category could have.
 *  Sentence-initial words and a stoplist of connectives are excluded so ordinary prose does not
 *  read as a roll-call of names. */
const INSTANCE_STOP = new Set([
  'The','A','An','But','And','So','That','This','These','Those','It','Its','His','Her','Their',
  'He','She','They','We','You','I','In','On','At','By','For','From','With','As','If','When',
  'What','Which','Who','No','Not','Every','Each','One','Two','Three','Four','Five','Both',
  'Investment','Grade','Because','After','Before','While','Since','Until','Though','Although',
  'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February',
  'March','April','May','June','July','August','September','October','November','December',
]);
export function instanceNames(sentence: string): string[] {
  const out = new Set<string>();
  const words = sentence.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const raw = words[i]!.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, '');
    if (!raw) continue;
    if (i === 0) continue; // sentence-initial capitalization proves nothing
    // "K3", "GPT-5", "Gemini" — a capital followed by letters/digits, or a letter+digit code.
    if (!/^[A-Z][A-Za-z0-9]*(?:-[A-Z0-9][A-Za-z0-9]*)?$/.test(raw)) continue;
    if (INSTANCE_STOP.has(raw)) continue;
    out.add(raw);
  }
  return [...out];
}

/** Split a bullet into its bolded LEAD sentence and the body that follows it. */
export function leadAndBody(bulletText: string): { lead: string; body: string } {
  const m = bulletText.match(/^\*\*([\s\S]*?)\*\*\s*([\s\S]*)$/);
  if (!m) return { lead: bulletText, body: '' };
  return { lead: m[1]!.trim(), body: m[2]!.trim() };
}

export function checkSingleInstanceGeneralization(bullets: Bullet[]): Flag[] {
  const flags: Flag[] = [];
  for (const b of bullets) {
    const { lead, body } = leadAndBody(b.text);
    if (!body) continue;
    const cat = lead.match(INDEFINITE_CATEGORY_RE);
    if (!cat) continue; // the lead names its subject, or names no category — silent
    if (!MAGNITUDE_RE.test(lead)) continue; // a category without a number generalizes nothing checkable

    // Find the magnitude the lead carries, then read the body sentence(s) that carry the SAME
    // magnitude — that is the evidence the lead is standing on, and the only place worth counting.
    const mag = lead.match(/\b\d+(?:\.\d+)?\s*(?:percent|%)/i)?.[0];
    if (!mag) continue;
    const magNum = mag.match(/\d+(?:\.\d+)?/)![0];
    const support = body
      .split(/(?<=[.?!])\s+/)
      .filter(sn => new RegExp(`\\b${magNum}\\b`).test(sn));
    if (!support.length) continue; // the magnitude is not restated; a different check's business

    const named = new Set<string>();
    for (const sn of support) for (const n of instanceNames(sn)) named.add(n);
    if (named.size !== 1) continue; // 0 = nothing to count · ≥2 = the escape hatch, honoured

    const only = [...named][0]!;
    const phrase = cat[0].trim();
    flags.push({
      check: 'single-instance-generalization',
      where: b.section,
      message:
        `UNRESOLVED-FACT — the lead generalizes to "${phrase}" while the evidence for its ${mag} names ` +
        `exactly ONE instance (${only}). A lead may not be broader than its evidence: the lead sentence is ` +
        `the one that gets quoted, so the wider claim is the one that travels. Name the instance in the lead ` +
        `("${only} runs about ${mag}…"), or name a second instance in the body. RECEIPT (2026-08-16): AI&T-1 ` +
        `shipped "an open-weight model runs about 25 percent more expensive" off a single K3 measurement — ` +
        `and switched sets between "open-weight" in the lead and "open-source" in the body.`,
    });
  }
  return flags;
}

function printsRange(text: string): boolean {
  for (const m of text.matchAll(new RegExp(RANGE_PRINTED_RE, 'gi'))) {
    const lo = parseFloat((m[1] ?? m[3] ?? '').replace(/,/g, ''));
    const hi = parseFloat((m[2] ?? m[4] ?? '').replace(/,/g, ''));
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) return true;
  }
  return false;
}
// 🔴 THE DISCRIMINATOR, and it is the whole difference between a check and a numeral detector.
// The mandate's own silent list makes it explicit: Geo-2's 80-to-1 ($4M interceptor vs ~$50k
// Shahed) is "two INDEPENDENTLY sourced figures, NOT ROWS OF ONE COMPARATOR TABLE". Both cases
// print both sides of the ratio, so carrying the figures is not the discriminator. What separates
// them is that the AI&T-2 comparison was READ OFF A SINGLE SOURCE DOCUMENT that also listed the
// comparators the brief did not print — a teardown, a model card, a table, a benchmark. Without a
// source document holding the SET, there is no undisclosed selection to make.
const COMPARATOR_TABLE_SOURCE_RE =
  /\b(?:teardown|model\s+card|benchmark|leaderboard|table|spec\s+sheet|datasheet|comparison\s+(?:table|chart)|scorecard)\b/i;
// A study/source attribution in the same bullet — without one there is no source range to collapse.
const STUDY_ATTRIB_RE =
  /\b(?:study|studies|paper|per|according to|teardown|model card|counts?|reported|researchers?|team|et al\.?|University|Institute|Lab(?:oratory)?|CSIS|Nature|Science)\b/i;

export function checkComparatorSelection(
  brief: string,
  truthKeys: Set<string>
): Flag[] {
  const flags: Flag[] = [];
  const bullets = sixBullets(brief);
  const regions: { where: string; text: string }[] = bullets.map((b, i) => ({
    where: `${b.section} bullet ${i + 1}`,
    text: b.text,
  }));
  // DISCOVERY is the LAST `# ▸` section, so a next-`▸` terminator never matches and the region
  // swallowed the entire appendix (43,884 chars measured) — leaking the AI&T bullet's "teardown"
  // and "16x" into a Discovery finding. Bound it at the next horizontal rule.
  const disc = sectionRegion(
    brief,
    /^#\s*▸\s*DISCOVERY\s*$/m,
    /^---\s*$|^#\s*▸/m
  );
  if (disc.trim()) regions.push({ where: 'Discovery', text: disc });

  for (const r of regions) {
    const hasRatio = RATIO_CLAIM_RE.test(r.text);
    const frame = COMPARATOR_FRAME_RE.exec(r.text);
    // (a) COMPARATOR SELECTION — a ratio against a single named third party, no comparator-set row.
    if (hasRatio && frame && COMPARATOR_TABLE_SOURCE_RE.test(r.text)) {
      const hasRow = [...truthKeys].some(k => k.startsWith('comparator-set:'));
      if (!hasRow) {
        flags.push({
          check: 'comparator-selection',
          where: r.where,
          message: `A load-bearing RATIO is stated against a single named comparator ("${(frame[1] ?? frame[0]).slice(0, 40)}") and no \`comparator-set:<slug>\` row lists the comparators the cited SOURCE ITSELF provides. 2026-08-13 receipt: AI&T-2's entire claim was a 16x KV-cache ratio picked from the source's own three-row table — Gemma 4 31B at 840 KiB was the EXTREME, Qwen3.6 27B at 64 KiB (against which the ratio is 1.2x) was never mentioned in the brief, and every number printed was correct. If your source's table has three rows and you print one ratio, you have made a SELECTION — enumerate the set in {BRIEF_DATE}-truth.json and state the range in-body, or say why this comparator is the right one.`,
        });
      }
    }
    // (b) RANGE COLLAPSE — a study-sourced set-size COUNT printed as a point value, no source-range row.
    const setSize = SET_SIZE_NOUN_RE.exec(r.text);
    if (setSize && STUDY_ATTRIB_RE.test(r.text) && !printsRange(r.text)) {
      const hasRow = [...truthKeys].some(k => k.startsWith('source-range:'));
      if (!hasRow) {
        flags.push({
          check: 'range-collapse',
          where: r.where,
          message: `A study-sourced SET-SIZE count is printed as an exact point value ("${setSize[0]}") with no range anywhere in the unit and no \`source-range:<slug>\` row recording what the source actually stated. 2026-08-13 receipt: the Discovery printed "each a different set of TWENTY species" where Hu et al. describe communities "comprising 12 to 20 species" — the range TOP shipped as the value. Print the source's range, or record it in {BRIEF_DATE}-truth.json and say why the top is the right figure. (Geo-2's CSIS "759 to 827" is the clean negative: it prints the range, so it is silent.)`,
        });
      }
    }
  }
  return flags;
}

/** `comparator-set:*` / `source-range:*` keys present in the day's truth file. */
export function truthKeysFor(briefPath: string): Set<string> {
  const out = new Set<string>();
  const m = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return out;
  try {
    const j = JSON.parse(
      fs.readFileSync(
        path.join(path.dirname(briefPath), `${m[1]}-truth.json`),
        'utf8'
      )
    );
    for (const k of Object.keys(j?.claims ?? {})) out.add(k);
  } catch {
    /* no truth file → no rows, which is the correct default */
  }
  return out;
}

function lint(brief: string): Flag[] {
  const intro = introOf(brief);
  const bullets = sixBullets(brief);
  const take = takeBody(brief);
  const flags: Flag[] = [];
  const pv = checkPreviewPadding(intro);
  if (pv) flags.push(pv);
  const wm = checkWatchMissing(intro);
  if (wm) flags.push(wm);
  const tl = checkThroughlineLabel(intro);
  if (tl) flags.push(tl);
  flags.push(...checkNumberPresence(bullets, take));
  flags.push(...checkHollowSignificance(brief));
  flags.push(...checkThematicEcho(bullets));
  flags.push(...checkCcDealMagnitude(brief)); // IMP-099 (restored)
  flags.push(...checkCcPricingRung(brief)); // IMP-108 (restored)
  flags.push(...checkModelCanonicalExample(brief)); // IMP-103 (restored)
  flags.push(...checkSingleInstanceGeneralization(bullets)); // IMP-181
  // IMP-168 is truth-file coupled, so main() supplies the keys; lint() runs it with an empty
  // set, which is the strictest reading (no rows = every selection undisclosed).
  return flags;
}

// ---------- selftest fixtures ----------
const BAD_FIXTURE = `# MARKETS, MEDITATIONS & MENTAL MODELS

*A short life note line here to be skipped over.*

**Friday, July 10, 2026**

## The One-Note Day

*Markets moved on several fronts today and we'll cover all of it below. Fragmentation defines markets this week across every asset class. The through-line: fragmentation everywhere you look.*

---

# ▸ THE SIX

## Markets & Macro

- **Fragmentation defines markets this week as equities diverge from bonds.** This matters. The divergence continued through the session and analysts remain split on what comes next without any resolution.

## Companies & Crypto

- **Fragmentation defines markets this week as crypto splits from tech.** The split is notable and worth keeping an eye on going forward.

## AI & Tech

- **Two model launches happened and the vibe shifted.** The significance is hard to overstate. Everyone noticed the mood change and the discourse moved on.

## Geopolitics

- **Tensions rose by 40 percent on the escalation index because strikes resumed.** The index move implies repricing risk within 60 days.

- **Regulators designated AI infrastructure as systemically important, treating cloud providers the way they treat clearinghouses.** The logic is concentration: 4 cloud providers host the compute layer for most global financial services, and the 4 hyperscalers just crossed that line without asking to. [THE REAL 07-14 AI&T-3 GAMING CASE — its only numerals are a date and a TALLY; it cleared number-presence and shipped graded as missing-pricing.]

---

## The Wild Card

- **A curiosity item.**

# ▸ THE TAKE

**A framework without any magnitude.** The mechanism is described in purely qualitative terms and the reader is asked to trust the direction of the effect without a single quantity anywhere in the argument.
`;

const CLEAN_FIXTURE = `# MARKETS, MEDITATIONS & MENTAL MODELS

*A short life note line here to be skipped over.*

**Friday, July 10, 2026**

## What the Rally Ignored

*The market spent Wednesday deciding the Iran war is contained — vol came out while 90 targets burned, the Soleimani playbook. Two things sit uneasily under that bet: the tape prices Hormuz as a one-day oil story while the bigger exposure is semiconductors, and the week's biggest positions are concentrated bets that work until they break, because the protection was already sold. Watch whether the ETF inflow streak holds and SKHY keeps its premium to Seoul — same bet, two assets.*

---

# ▸ THE SIX

## Markets & Macro

- **Equities rallied 0.81 percent through a war that did not stop, and the rally itself is the signal worth reading.** Volatility contracted because options traders removed hedges, which means the repricing arrives as a gap if containment fails.

## Companies & Crypto

- **SK Hynix priced its ADS at $149 with demand at seven times the offering, raising roughly 28 billion dollars.** The book cleared at a 12x forward multiple, a premium to Micron's 9x, and the oversubscription implies dollar-denominated access to HBM supply commands a premium above the arbitrage cost.

## AI & Tech

- **OpenAI moved GPT-5.6 Sol to general availability at 750 tokens per second and cut the mid tier to $1.25 per million tokens, 40 percent below the frontier price.** The three-tier menu forces customers to self-sort downward, which means volume revenue detaches from the frontier.

## Geopolitics

- **CENTCOM struck roughly 90 targets, Iran answered with 10 ballistic missiles at Al-Azraq, and war-risk premia on Gulf hulls jumped to 1.2 percent of cargo value, about $850,000 per VLCC transit.** Jordan's obligation to respond drives a third-party variable neither capital calibrated for, and the premium is who pays for it.

---

## The Wild Card

- **A detection algorithm built for Mars found 73 undocumented calderas on the seafloor.**

# ▸ THE TAKE

**Yield-Contingent Demand.** Securitize fell roughly 35 percent from its debut because core tokenization revenue was flat at about $11 million while the acquired lines drove the headline, which means the category's demand curve tracks the front-end yield, not adoption.
`;

// IMP-071 (ESC-008 escalation, 2026-07-18). The 07-16 AI&T pricing rubric (IMP-059) bent the AI&T
// missing:pricing trend 2→1 but PLATEAUED at 1 for two consecutive days (07-17, 07-18) — a rubric
// took it as far as a rubric can. Per ESC-008's pre-authorized read-out (DUE 07-18), the residual
// gets ENFORCEMENT: an unpriced AI&T bullet is now a HARD Editor REJECT (Brief_Editor Gate 14), not
// an advisory FLAG. --strict-ait exits 1 iff an AI&T pricing-magnitude flag fires; DEFAULT mode stays
// exit-0 advisory, so the brief ALWAYS ships and only the Editor pass is gated. Anti-Goodhart: it
// reuses pricing-magnitude (money / % of a named quantity / bps / multiple), which a TALLY does not
// satisfy (the whole 07-14 lesson) — the escalation cannot be gamed by adding a count.
const AIT_WHERE_RE = /\bai\b|a\.?i\.?\s*&|\btech\b/i;
export function strictAitViolations(flags: Flag[]): Flag[] {
  return flags.filter(
    f => f.check === 'pricing-magnitude' && AIT_WHERE_RE.test(f.where)
  );
}

// IMP-099 (ESC-008 / E-CC-SECTION-WEAKNESS-01, 07-25 — restored 07-31): --strict-cc turns a
// cc-deal-magnitude FLAG into a HARD Editor REJECT (the --strict-ait pattern applied to C&C).
// Default mode stays exit-0 advisory, so the brief ALWAYS ships; --strict-cc is what Brief_Editor
// Gate 14(f) runs to gate the pass.
export function strictCcViolations(flags: Flag[]): Flag[] {
  return flags.filter(f => f.check === 'cc-deal-magnitude');
}

// IMP-112 (08-01 Critic mandate #1): --strict-model turns a model-canonical-example FLAG into a
// HARD Editor REJECT (the --strict-ait / --strict-cc pattern applied to the Model). The REJECT is
// on the ILLUSTRATION, never the concept — the fix is to re-illustrate, not to re-pick the model.
// Default mode stays exit-0 advisory so the brief ALWAYS ships.
export function strictModelViolations(flags: Flag[]): Flag[] {
  return flags.filter(f => f.check === 'model-canonical-example');
}

// Selftest fixtures for --strict-ait: an unpriced AI&T bullet (a tally, the 07-16 shape) must FIRE;
// a priced AI&T bullet ($ / multiple) must stay SILENT.
const AIT_STRICT_BAD = `# ▸ THE SIX

## AI & Tech

- **A frontier lab shipped a model and three rivals followed within eight days.** Pre-market testing becomes a capital barrier, and 4 hyperscalers now gate the field.

## The Wild Card
- **A curiosity.**
`;
const AIT_STRICT_GOOD = `# ▸ THE SIX

## AI & Tech

- **A frontier lab trained a model at an estimated $30 million against the $400 million US labs spend.** The 13x cost gap compresses the capex envelope.

## The Wild Card
- **A curiosity.**
`;

// IMP-111 fixtures for the three restored checks. CC_BAD: a deal bullet with no scale money/count
// (fires cc-deal-magnitude + --strict-cc), a section with only EPS-vs-estimate (fires cc-pricing-
// rung), and a Nokia Model illustration (fires model-canonical-example). CC_GOOD: a deal with $4.7B
// + 646,000 subs, an 8x/discount-to-Verizon/2015-precedent comparative, and a non-canonical Model.
const CC_BAD_FIXTURE = `# ▸ THE SIX

## Companies & Crypto

- **Acme agreed to acquire Beta in an all-stock merger that reshapes the sector.** The takeover ends a long rivalry, and management guided to earnings of $2.10 against a $1.90 estimate next quarter, a clean beat.

## AI & Tech

- **A filler bullet with a $30 million line and a 13x gap.** Scoped out of C&C.

# ▸ THE MODEL

### The Innovator's Trap

A classic case: Nokia dominated mobile and then missed the smartphone shift, the lesson every strategy deck repeats.
`;
const CC_GOOD_FIXTURE = `# ▸ THE SIX

## Companies & Crypto

- **AT&T agreed to acquire a regional fiber operator for $4.7 billion, adding 646,000 subscribers.** The deal trades at 8x EBITDA, a discount to Verizon's 11x, echoing the 2015 DirecTV logic that took years to pay off.

## AI & Tech

- **A filler bullet.** Scoped out of C&C.

# ▸ THE MODEL

### The Eutectic Point

A metallurgy principle: two individually safe components can fail below either one's melting point.
`;

function selftest(): number {
  let fails = 0,
    total = 0;
  const assert = (ok: boolean, label: string) => {
    total++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  // ── IMP-168 (08-13 Critic mandate #2, RC2): comparator selection + range collapse ──
  // Every leg is the mandate's own acceptance list, measured on the real v2 files it named.
  const cs13 = path.join(process.cwd(), 'daily-briefs/2026-08-13-v2.md');
  const cs13f = fs.existsSync(cs13)
    ? checkComparatorSelection(fs.readFileSync(cs13, 'utf8'), new Set())
    : [];
  assert(
    !fs.existsSync(cs13) ||
      cs13f.some(
        f => f.check === 'comparator-selection' && /AI\s*&\s*Tech/i.test(f.where)
      ),
    "[IMP-168] comparator-selection FIRES on the real 08-13 AI&T-2 (Gemma 4 the extreme of a 3-row table, Qwen absent from the body)"
  );
  assert(
    !fs.existsSync(cs13) ||
      cs13f.some(
        f => f.check === 'range-collapse' && /Discovery/i.test(f.where)
      ),
    '[IMP-168] range-collapse FIRES on the real 08-13 Discovery ("twenty species" against a stated 12-20)'
  );
  assert(
    !fs.existsSync(cs13) || !cs13f.some(f => /Geopolitic/i.test(f.where)),
    "[IMP-168] SILENT on 08-13 Geo-2 — the 80-to-1 is two INDEPENDENTLY sourced figures, and the CSIS \"759 to 827\" PRINTS its range"
  );
  assert(
    !fs.existsSync(cs13) ||
      !cs13f.some(f => /Companies\s*&\s*Crypto/i.test(f.where)),
    '[IMP-168] SILENT on 08-13 C&C-2 194 turns — a ratio of two of the SAME issuer\'s figures, no third party, no selection'
  );
  assert(
    !fs.existsSync(cs13) ||
      checkComparatorSelection(
        fs.readFileSync(cs13, 'utf8'),
        new Set(['comparator-set:muse-glimmer-kv-cache', 'source-range:hu-community-species'])
      ).length === 0,
    '[IMP-168] SILENT once the comparator-set / source-range rows exist — it is an EMISSION contract, not a table reader'
  );
  {
    const rates = [
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]
      .map(d => path.join(process.cwd(), `daily-briefs/${d}-v2.md`))
      .filter(f => fs.existsSync(f))
      .map(
        f =>
          checkComparatorSelection(fs.readFileSync(f, 'utf8'), new Set()).length
      );
    assert(
      rates.length === 0 || Math.max(...rates) <= 2,
      `[IMP-168] NO STORM across the real 08-09..08-13 window (<=2/brief): rates ${rates.join('/')}`
    );
  }
  assert(
    !printsRange('https://example.com/2026-08-13/paper'),
    '[IMP-168] a DATE is not a printed range — the bare-year false-positive class (CARRY row 35) cannot come back'
  );
  assert(
    printsRange('CSIS counts 759 to 827 PAC-3 MSE rounds against 2,330 pre-war.'),
    '[IMP-168] ...and a REAL low-to-high pair still reads as a printed range'
  );

  const badFlags = lint(BAD_FIXTURE);
  const cleanFlags = lint(CLEAN_FIXTURE);
  const expectBad = [
    'intro-preview-padding',
    'intro-watch-missing',
    'intro-throughline-label',
    'number-presence',
    'pricing-magnitude',
    'hollow-significance',
    'thematic-echo',
  ];
  for (const check of expectBad)
    assert(
      badFlags.some(f => f.check === check),
      `${check} fires on the rigged bad brief`
    );
  // The 07-14 gaming case: a bullet whose only numerals are a date and a TALLY must be caught by
  // pricing-magnitude, NOT waved through by number-presence. (IMP-050.)
  assert(
    badFlags.some(
      f =>
        f.check === 'pricing-magnitude' &&
        /Regulators designated/.test(f.message)
    ),
    `"4 cloud providers / the 4 hyperscalers" (real 07-14 AI&T-3) FLAGS as unpriced: a count is not a price`
  );
  assert(
    cleanFlags.length === 0,
    `zero flags on the payoff-grade clean brief${cleanFlags.length ? ` (got: ${cleanFlags.map(f => `${f.check}@${f.where}`).join(', ')})` : ''}`
  );
  // IMP-071 (ESC-008): --strict-ait turns an AI&T pricing-magnitude FLAG into a REJECT.
  assert(
    strictAitViolations(lint(AIT_STRICT_BAD)).length > 0,
    `--strict-ait FIRES on an unpriced AI&T bullet (a tally, the 07-16 shape)`
  );
  assert(
    strictAitViolations(lint(AIT_STRICT_GOOD)).length === 0,
    `--strict-ait SILENT on a priced AI&T bullet ($30M / 13x)`
  );

  // IMP-111 — the three checks reverted by the 07-29 uncommitted-rebase, restored + committed 07-31.
  const ccBad = lint(CC_BAD_FIXTURE),
    ccGood = lint(CC_GOOD_FIXTURE);
  assert(
    ccBad.some(f => f.check === 'cc-deal-magnitude'),
    `[IMP-099] cc-deal-magnitude FIRES on a deal bullet with no scale money/count`
  );
  assert(
    !ccGood.some(f => f.check === 'cc-deal-magnitude'),
    `[IMP-099] cc-deal-magnitude SILENT on a deal with $4.7B + 646,000 subs`
  );
  assert(
    strictCcViolations(ccBad).length > 0,
    `[IMP-099] --strict-cc FIRES on the unpriced deal (HARD Editor REJECT)`
  );
  assert(
    strictCcViolations(ccGood).length === 0,
    `[IMP-099] --strict-cc SILENT on the priced deal`
  );
  assert(
    ccBad.some(f => f.check === 'cc-pricing-rung'),
    `[IMP-108] cc-pricing-rung FIRES on a C&C section with no comparative (deal + EPS-vs-estimate only)`
  );
  assert(
    !ccGood.some(f => f.check === 'cc-pricing-rung'),
    `[IMP-108] cc-pricing-rung SILENT when a bullet carries 8x / discount to Verizon / 2015 precedent`
  );
  assert(
    ccBad.some(f => f.check === 'model-canonical-example'),
    `[IMP-103] model-canonical-example FIRES on a Nokia Model illustration`
  );
  assert(
    !ccGood.some(f => f.check === 'model-canonical-example'),
    `[IMP-103] model-canonical-example SILENT on a non-canonical Model`
  );

  // IMP-112 — the science-canon illustration family + --strict-model. Fixtures first, then the two
  // REAL published Models the 08-01 Critic named as the acceptance gate.
  const MODEL_SCI_BAD = `# ▸ THE MODEL\n\n### Levels of Emergence\n\nA team put cars on a circular track. The traffic jam that formed drifted backwards while every car moved forwards. Temperature is the famous instance, since a single molecule has no temperature.\n`;
  const MODEL_SCI_GOOD = `# ▸ THE MODEL\n\n### Levels of Emergence\n\nSoil fertility is not a property of any microbe. It is a property of a community, which is why a farmer who sterilizes a field and adds exactly the missing nutrients ends up with worse soil.\n`;
  assert(
    lint(MODEL_SCI_BAD).some(f => f.check === 'model-canonical-example'),
    `[IMP-112] model-canonical-example FIRES on the science-canon illustration (traffic jam / molecule-temperature)`
  );
  assert(
    !lint(MODEL_SCI_GOOD).some(f => f.check === 'model-canonical-example'),
    `[IMP-112] model-canonical-example SILENT on a non-canonical illustration (soil fertility)`
  );
  assert(
    strictModelViolations(lint(MODEL_SCI_BAD)).length > 0,
    `[IMP-112] --strict-model FIRES on the canonical illustration (HARD Editor REJECT)`
  );
  assert(
    strictModelViolations(lint(MODEL_SCI_GOOD)).length === 0,
    `[IMP-112] --strict-model SILENT on the fresh illustration`
  );
  // ACCEPTANCE GATE (08-01 Critic mandate #1), on real artifacts: --strict-model must bite on the
  // published 08-01 Model (traffic jam + molecule-temperature) and stay silent on the published
  // 07-28 Model (Jump to Universality — alphabets, DNA, Turing machines: none of them cached).
  for (const [d, shouldFire] of [
    ['2026-08-01', true],
    ['2026-07-28', false],
  ] as const) {
    const p = path.join(process.cwd(), `content/daily-updates/${d}.md`);
    if (!fs.existsSync(p)) continue;
    const v = strictModelViolations(lint(fs.readFileSync(p, 'utf8')));
    assert(
      shouldFire ? v.length > 0 : v.length === 0,
      `[IMP-112] --strict-model ${shouldFire ? 'FIRES' : 'SILENT'} on the REAL published ${d} Model${!shouldFire && v.length ? ` (got: ${v.map(f => f.message.slice(0, 40)).join(', ')})` : ''}`
    );
  }


  // ── IMP-181 (08-16 Critic mandate #3, RC2): a lead may not be broader than its evidence ──
  // The mandate's own acceptance list, every leg measured on real v2 files.
  const sig16 = path.join(process.cwd(), 'daily-briefs/2026-08-16-v2.md');
  const sig16f = fs.existsSync(sig16)
    ? checkSingleInstanceGeneralization(
        sixBullets(fs.readFileSync(sig16, 'utf8'))
      )
    : [];
  assert(
    !fs.existsSync(sig16) ||
      sig16f.some(f => /AI\s*&\s*Tech/i.test(f.where) && /K3/.test(f.message)),
    '[IMP-181] FIRES on the real 08-16 AI&T-1 — indefinite "an open-weight model" + 25 percent, body names only K3'
  );
  assert(
    !fs.existsSync(sig16) ||
      !sig16f.some(f => /Companies\s*&\s*Crypto/i.test(f.where)),
    '[IMP-181] SILENT on 08-16 C&C-1 — the lead says "Four companies" and the body names four (the clean negative inside the same brief)'
  );
  assert(
    !fs.existsSync(sig16) || sig16f.length === 1,
    `[IMP-181] exactly ONE finding in the whole 08-16 brief (AI&T-3 names Ben Moll and the wager specifically)${sig16f.length !== 1 ? ` (got ${sig16f.length}: ${sig16f.map(f => f.where).join(', ')})` : ''}`
  );
  // NO STORM across the held-out window the mandate named.
  let sigStorm = 0;
  for (const d of ['09', '10', '11', '12', '13', '14', '15']) {
    const fp = path.join(process.cwd(), `daily-briefs/2026-08-${d}-v2.md`);
    if (fs.existsSync(fp))
      sigStorm += checkSingleInstanceGeneralization(
        sixBullets(fs.readFileSync(fp, 'utf8'))
      ).length;
  }
  assert(
    sigStorm <= 2,
    `[IMP-181] NO STORM across 08-09…08-15 v2 (${sigStorm} finding(s), ceiling 2)`
  );
  // THE ESCAPE HATCH, proved rather than asserted: the SAME firing prose goes silent the moment
  // the lead names the instance it measured. A gate whose escape hatch is untested is a gate that
  // only knows how to punish.
  const sigFiring = [
    {
      section: 'AI & Tech',
      text: '**Warren Pies says the AI price war is measured on the wrong denominator, and on the right one an open-weight model runs about 25 percent more expensive than the frontier.** His post of 14 August: on cost per task K3 comes out roughly 25 percent more expensive.',
    },
  ];
  const sigRepaired = [
    {
      section: 'AI & Tech',
      text: '**Warren Pies says the AI price war is measured on the wrong denominator, and on the right one K3 runs about 25 percent more expensive than the frontier.** His post of 14 August: on cost per task K3 comes out roughly 25 percent more expensive.',
    },
  ];
  const sigTwo = [
    {
      section: 'AI & Tech',
      text: '**On the right denominator an open-weight model runs about 25 percent more expensive than the frontier.** On cost per task K3 comes out roughly 25 percent more expensive, and Qwen lands within a point of the same 25 percent gap.',
    },
  ];
  assert(
    checkSingleInstanceGeneralization(sigFiring).length === 1,
    '[IMP-181] FIRES on the reconstructed shipped lead (the control for the two hatches below)'
  );
  assert(
    checkSingleInstanceGeneralization(sigRepaired).length === 0,
    '[IMP-181] ESCAPE HATCH A — SILENT once the lead names the instance it measured'
  );
  assert(
    checkSingleInstanceGeneralization(sigTwo).length === 0,
    '[IMP-181] ESCAPE HATCH B — SILENT once the body names a second instance'
  );

  // Real-artifact both-directions: the shipped 07-31 v2 (mechanical PASS clean) must carry 0 of the
  // three restored flags — Apple/Coinbase/DTCC are not deals; C&C cites 2011/2000 precedents; the
  // Model is the Legibility Trap, not a canonical business case.
  const realV2 = path.join(process.cwd(), 'daily-briefs/2026-07-31-v2.md');
  if (fs.existsSync(realV2)) {
    const rf = lint(fs.readFileSync(realV2, 'utf8')).filter(f =>
      [
        'cc-deal-magnitude',
        'cc-pricing-rung',
        'model-canonical-example',
      ].includes(f.check)
    );
    assert(
      rf.length === 0,
      `restored checks SILENT on the REAL 07-31 v2 (clean)${rf.length ? ` (got: ${rf.map(f => `${f.check}@${f.where}`).join(', ')})` : ''}`
    );
  }

  console.log(
    `\nceiling-lint selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error(
      '✗ SELFTEST FAILED — a lint check no longer bites both directions.'
    );
    return 1;
  }
  console.log(
    '✓ All 10 lint checks verified in both directions (+ --strict-ait / --strict-cc gates).'
  );
  return 0;
}

function main() {
  if (process.argv.slice(2).includes('--selftest')) process.exit(selftest());
  const briefArg = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!briefArg) {
    console.error('Usage: ceiling-lint.ts <brief.md> | --selftest');
    process.exit(2);
  }
  const p = path.isAbsolute(briefArg)
    ? briefArg
    : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(p)) {
    console.error(`File not found: ${p}`);
    process.exit(2);
  }
  const flags = lint(fs.readFileSync(p, 'utf8'));
  // IMP-168 (08-13 mandate #2): comparator selection + range collapse, keyed off the day's truth file.
  flags.push(
    ...checkComparatorSelection(fs.readFileSync(p, 'utf8'), truthKeysFor(p))
  );
  console.log(
    `ceiling-lint — ${path.basename(p)} — ${flags.length} FLAG${flags.length === 1 ? '' : 's'}`
  );
  for (const f of flags)
    console.log(`  ⚠ [${f.check}] ${f.where}: ${f.message}`);
  console.log(
    `\n✅ CEILING-LINT PASS${flags.length ? ' (flags advisory — QG/Editor act on them; the brief always ships)' : ' (clean)'}`
  );

  // IMP-071 (ESC-008 escalation, 07-18): AI&T pricing is a HARD Editor REJECT. Default stays advisory
  // (exit 0) — the brief ALWAYS ships; --strict-ait is what Brief_Editor Gate 14 runs to gate the pass.
  if (process.argv.slice(2).includes('--strict-ait')) {
    const v = strictAitViolations(flags);
    if (v.length) {
      console.error(
        `\n✗ CEILING-LINT --strict-ait: ${v.length} AI&T bullet(s) UNPRICED — Editor must REJECT-and-rebuild with a priced magnitude (money / % of a named quantity / bps / multiple / the binding threshold). A tally does not satisfy it.`
      );
      for (const f of v)
        console.error(`   ✗ ${f.where}: ${f.message.slice(0, 90)}…`);
      process.exit(1);
    }
    console.log(
      '   ✅ --strict-ait: every AI&T bullet carries a priced magnitude.'
    );
  }

  // IMP-099 (ESC-008 / E-CC-SECTION-WEAKNESS-01, restored 07-31): C&C deal magnitude is a HARD Editor
  // REJECT. Default stays advisory (exit 0); --strict-cc is what Brief_Editor Gate 14(f) runs.
  if (process.argv.slice(2).includes('--strict-cc')) {
    const v = strictCcViolations(flags);
    if (v.length) {
      console.error(
        `\n✗ CEILING-LINT --strict-cc: ${v.length} C&C deal bullet(s) carry NO deal magnitude — Editor must REJECT-and-rebuild with the price paid, the user/subscriber base, or the revenue at stake. A percentage of the target's own revenue does not satisfy it.`
      );
      for (const f of v)
        console.error(`   ✗ ${f.where}: ${f.message.slice(0, 90)}…`);
      process.exit(1);
    }
    console.log(
      '   ✅ --strict-cc: every C&C deal bullet carries a deal magnitude.'
    );
  }

  // IMP-112 (08-01 Critic mandate #1): a canonical Model ILLUSTRATION is a HARD Editor REJECT.
  // Default stays advisory (exit 0); --strict-model is what Brief_Editor Gate 8/14 runs.
  if (process.argv.slice(2).includes('--strict-model')) {
    const v = strictModelViolations(flags);
    if (v.length) {
      console.error(
        `\n✗ CEILING-LINT --strict-model: the Model's illustration is canonical — Editor must REJECT-and-re-illustrate (keep the concept, change the example). Whitelist rule 5: under a well-known concept the illustration is where the section earns its novelty.`
      );
      for (const f of v)
        console.error(`   ✗ ${f.where}: ${f.message.slice(0, 120)}…`);
      process.exit(1);
    }
    console.log(
      '   ✅ --strict-model: the Model illustration is non-canonical.'
    );
  }
  process.exit(0);
}

// Direct-invocation guard (added 2026-08-13 — IMP-168, mirroring fact-gate/assembly-gate): the
// module must be importable so `checkComparatorSelection` can be exercised without a usage banner.
const invokedDirectly =
  !!process.argv[1] && path.resolve(process.argv[1]).endsWith('ceiling-lint.ts');
if (invokedDirectly) main();
