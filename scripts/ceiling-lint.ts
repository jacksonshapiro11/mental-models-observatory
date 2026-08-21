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

// ---------- INTERNAL RATIO (IMP-192 — 2026-08-18 Critic mandate #1, second leg; RC2) ----------
//
// THE CLASS. A bullet prints a share and the two magnitudes it is a share OF, and the three do not
// reconcile. This needs NO external source to falsify — the bullet contradicts itself on the page,
// which is the cheapest kind of lie to catch and the most expensive to publish. 2026-08-18 C&C-3
// shipped "passed $650 million", "roughly $253 million" and "near 43 percent" in one bullet;
// 253/650 = 38.9%. Every source-facing gate in the stack exited 0, correctly — each figure was
// individually sourced. Nothing was asking whether they were true TOGETHER.
//
// Deliberately narrow, because the false-positive surface here is large: a bullet routinely prints
// two magnitudes and a percent that are simply unrelated ("$32.5 billion guidance … down 2 percent
// year over year"). Four constraints keep it honest:
//   • the percent must sit within 300 characters of BOTH magnitudes (the mandate's window);
//   • the two magnitudes must share an order of magnitude scale such that the smaller/larger
//     quotient lands in 1–99% — a ratio outside that is not a share claim;
//   • at least ONE ordering must reconcile. If any pairing in the window lands within tolerance the
//     bullet is coherent and the check is silent — the writer is not obliged to print the operands
//     adjacent to the share;
//   • tolerance 3 percentage points, per the mandate.
// FLAG, not FAIL: ceiling-lint is advisory by construction, and the Editor and Critic act on flags.

const RATIO_WINDOW = 300;
const RATIO_TOLERANCE_PP = 3;
const RATIO_STOP = new Set(
  (
    'the a an and or but its their this that these those with from into onto over under about ' +
    'total which what when where than then them they there here also more most less least ' +
    'been being have has had was were are all any own same such very just only other another ' +
    // MAGNITUDE AND HEDGE WORDS ARE NOT REFERENTS. Leaving "billion" in the referent set let
    // "77 percent of it. Annualised that is roughly $9 BILLION…" bind to any nearby dollar figure
    // purely because both sentences said the word "billion" — a unit is never what a share is OF.
    'billion million trillion thousand percent times dollar cent roughly about near nearly'
  ).split(/\s+/)
);

const COUNT_REFERENTS = [
  'share',
  'vote',
  'seat',
  'unit',
  'employee',
  'customer',
  'user',
  'subscriber',
  'household',
  'member',
  'holder',
  'barrel',
  'ounce',
  'tonne',
  'acre',
];

interface Magnitude {
  value: number;
  raw: string;
  at: number;
}

const RATIO_MAG: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  bn: 1e9,
  b: 1e9,
  billion: 1e9,
  tn: 1e12,
  trillion: 1e12,
};

function currencyMagnitudes(text: string): Magnitude[] {
  const out: Magnitude[] = [];
  for (const m of text.matchAll(
    /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mn|million|bn|billion|tn|trillion|m|b)?\b/gi
  )) {
    const n = parseFloat(m[1]!.replace(/,/g, ''));
    if (!isFinite(n)) continue;
    const mul = m[2] ? (RATIO_MAG[m[2]!.toLowerCase()] ?? 1) : 1;
    out.push({ value: n * mul, raw: m[0]!.trim(), at: m.index ?? 0 });
  }
  return out;
}

export function checkInternalRatio(bullets: Bullet[]): Flag[] {
  const flags: Flag[] = [];
  for (const b of bullets) {
    const text = b.text.replace(/<!--[\s\S]*?-->/g, ' ');
    const mags = currencyMagnitudes(text);
    if (mags.length < 2) continue; // Signal-1's bare "90%+ quarter-on-quarter" stays silent here
    // SHARE CLAIMS ONLY — `N percent OF <something>`. The mandate said "a percent token within 300
    // characters of two currency magnitudes"; built that literally, the check produced 23 flags
    // across 2026-08-10..18 and exactly ONE was a real defect. The reason is that most percents in
    // a bullet are not shares at all — they are premiums ("a 49 percent premium" beside a $13.59
    // and a $20.25 price), growth rates, YoY changes and margin moves, and dividing the two nearest
    // dollar figures produces a number that was never claimed. Only `percent of` asserts that one
    // printed magnitude IS that fraction of another, which is the only claim arithmetic can audit.
    // This is the difference between a check and a flag generator, and it takes the false-positive
    // count over those nine nights from 22 to 0 while keeping the mandated 08-18 FIRE.
    for (const pm of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\b/gi)) {
      const pct = parseFloat(pm[1]!);
      const at = pm.index ?? 0;
      if (!isFinite(pct) || pct <= 0 || pct >= 100) continue;
      const near = mags.filter(m => Math.abs(m.at - at) <= RATIO_WINDOW);
      if (near.length < 2) continue;
      // REFERENT BINDING. `percent of` alone still left six false flags over nine nights, because
      // the thing the share is OF is usually not either printed magnitude: "82 percent of the
      // VOTES" sat beside a $21 and a $28.50 share price and the quotient was never claimed. So
      // the denominator has to earn the role — the noun phrase after "of" must reappear beside the
      // larger magnitude. On 08-18 "43 percent of the CHAIN's STABLECOIN balances" binds to
      // "STABLECOIN supply on the CHAIN passed $650 million", which is exactly the claim; on 08-15
      // "of the votes" binds to nothing, and the check goes correctly quiet. This is the line
      // between auditing an assertion and dividing whatever numbers happen to be adjacent.
      // The referent phrase STOPS AT ITS SENTENCE. Reading 70 raw characters spilled across the
      // full stop on 2026-08-10 — "…retired more than 40 percent of APPLE. Against all of it:
      // $4.5 billion is 1.2 percent of the CASH pile…" — so a share of Apple's share count picked
      // up "cash" from the next sentence and bound to a dollar figure it has nothing to do with.
      const ofPhrase = text
        .slice(at + pm[0]!.length, at + pm[0]!.length + 70)
        .split(/(?<=[.!?;])\s/)[0]!;
      const ofTerms = new Set(
        ofPhrase
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(w => w.length >= 4 && !RATIO_STOP.has(w))
          .map(w => w.replace(/([^s])s$/, '$1'))
      );
      if (!ofTerms.size) continue;
      // A SHARE OF A COUNT IS NOT A SHARE OF A SUM. This check divides one currency magnitude by
      // another; when the referent is a countable population the quotient is meaningless no matter
      // which dollars sit nearby. Receipt, 2026-08-07: "the first post-IPO lockup lifted the public
      // float from 4.9 percent of SHARES OUTSTANDING to 11.8" flagged against a $108.27 close over
      // a $125.33 close — two share prices and a float percentage, three true numbers and no
      // relation between them. Every entry here is a deliberate blindness; keep the list short.
      if (COUNT_REFERENTS.some(w => ofTerms.has(w))) continue;
      const binds = (m: Magnitude) => {
        const ctx = text
          .slice(Math.max(0, m.at - 90), m.at + 90)
          .toLowerCase()
          .split(/[^a-z]+/)
          .map(w => w.replace(/([^s])s$/, '$1'));
        return ctx.some(w => w.length >= 4 && ofTerms.has(w));
      };
      // NUMERATOR = THE NEAREST MAGNITUDE PRECEDING THE SHARE, not any smaller one in the window.
      // English puts the quantity and its share in that order — "went to $253 MILLION in a month
      // and now sits near 43 PERCENT OF the chain's balances" — and leaving the numerator free is
      // what produced the last two false flags: on 08-15 the check paired Workday's $43bn market
      // value against Silver Lake's $55bn EA deal to audit "kept just 5.5 percent of the equity",
      // a sentence about neither. With this rule that night's nearest preceding magnitude IS the
      // denominator, no ordered pair exists, and the check is correctly silent.
      const before = near.filter(m => m.at < at);
      if (!before.length) continue;
      const a = before.reduce((x, y) => (y.at > x.at ? y : x));
      // DENOMINATORS ARE SEARCHED ACROSS THE WHOLE BULLET, not the 300-character window the
      // mandate specified. Receipt: 2026-08-10 C&C-1 wrote "$4.5 billion is 1.2 percent of the
      // cash pile" — TRUE against the $365.5bn cash figure stated earlier in the same bullet, but
      // that figure sits outside 300 characters while "$98 billion of idle CASH" sits inside and
      // binds on the word "cash". A window that can exclude the true denominator while admitting a
      // false one manufactures exactly the accusation this check exists to make. Widening is also
      // the safe direction: a flag requires EVERY candidate pairing to fail, so more candidates can
      // only exonerate. The window still governs which magnitude is the NUMERATOR, where proximity
      // is the whole signal.
      const pairs: Array<{ a: Magnitude; b: Magnitude; q: number }> = [];
      for (const c of mags) {
        if (c === a || !a.value || !c.value || a.value >= c.value) continue;
        if (!binds(c)) continue; // the denominator must be the quantity the share is OF
        const q = (a.value / c.value) * 100;
        if (q < 1 || q > 99) continue; // not a share claim
        pairs.push({ a, b: c, q });
      }
      if (!pairs.length) continue;
      // ANY reconciling pairing exonerates the bullet. Demanding the nearest pair reconcile would
      // condemn every bullet that prints an unrelated magnitude between the share and its operands.
      if (pairs.some(p => Math.abs(p.q - pct) <= RATIO_TOLERANCE_PP)) continue;
      const best = pairs.reduce((x, y) =>
        Math.abs(y.q - pct) < Math.abs(x.q - pct) ? y : x
      );
      flags.push({
        check: 'internal-ratio',
        where: `${b.section} — "${text.replace(/\s+/g, ' ').slice(0, 70)}…"`,
        message:
          `INTERNAL RATIO DOES NOT RECONCILE — the bullet prints ${best.a.raw} and ${best.b.raw} and ` +
          `calls it ${pct} percent, but ${best.a.raw} / ${best.b.raw} = ${best.q.toFixed(1)} percent ` +
          `(${Math.abs(best.q - pct).toFixed(1)}pp off, tolerance ${RATIO_TOLERANCE_PP}pp). All three cannot be true, ` +
          `and no external source is needed to know it. 2026-08-18 receipt: C&C-3 shipped "$650 million", ` +
          `"$253 million" and "near 43 percent" — 253/650 = 38.9 — at every gate exit 0. Fix the share, fix a ` +
          `magnitude, or print the share and the growth without the levels.`,
      });
    }
  }
  return flags;
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
  flags.push(...checkInternalRatio(bullets)); // IMP-192 (08-18 mandate #1, second leg)
  // IMP-197 (08-19 mandate #2). Whole-brief, not bullets: the 08-19 defect ran in the DASHBOARD
  // and in a Six bullet simultaneously, and the Dashboard is not a bullet. lint() has no date, so
  // it runs undated (docs are named but not date-filtered); main() supplies BRIEF_DATE.
  flags.push(...checkCausalNegative(brief, null));
  // IMP-203 (08-20 mandate #2). Structure-keyed, not string-keyed: reads the brief's OWN staleness
  // ledger for the source count, so it survives the paraphrase that walked past checkCausalNegative
  // one night after that gate shipped.
  flags.push(...checkContestedAttribution(brief));
  flags.push(...checkInversionSourcing(brief)); // IMP-206 (08-21 Critic mandate #2)
  // IMP-168 is truth-file coupled, so main() supplies the keys; lint() runs it with an empty
  // set, which is the strictest reading (no rows = every selection undisclosed).
  return flags;
}

// ─── IMP-197 — CAUSAL NEGATIVE (2026-08-19 Critic mandate #2, RC2) ───────────────────────────
//
// THE FAILURE: the 08-19 brief asserted in TWO sections that the semis selloff had no cause, and
// printed the disputed cause BETWEEN the two assertions, credited to the account that relayed it.
//
//   Dashboard : "a closely watched semiconductor gauge fell 5.5 percent on no company news at all"
//   M&M-3     : "Tuesday's memory selloff carried no company news"
//   M&M-3, three sentences earlier: "Charlie Bilello has nine major technology companies carrying
//               roughly $3 trillion in off-balance-sheet commitments against about $600 billion
//               of reported capex."
//
// 24/7 Wall St. ran BOTH attributions the same day — "WSJ Report Sends Memory Stocks Down.
// SanDisk Down 9%, Micron Down 7%" (the $3tn off-balance-sheet figure, sourced to the WSJ, named
// as the cause) and "Micron Falls 5% … as Higher Rates Test the Memory Boom" (the rival). The
// causal question was DISPUTED IN THE RECORD. The brief resolved it silently, twice, in the
// direction that suited its thesis, and never saw the conflict — because it credited the relay
// (Bilello) rather than the publisher (the WSJ), so the figure never looked like a document.
//
// THE PRINCIPLE: **a negative causal claim requires the same verification budget as a positive
// one.** "Nothing caused this" is not a modest sentence; it is the strongest causal claim in the
// paragraph, and it is the only one nothing was checking.
//
// WHICH LEG DOES THE WORK, HONESTLY. The mandate specified two conditions: the negative phrase,
// and the brief citing a same-session document. The second is satisfied by nearly every brief we
// publish — most bullets ARE same-day sourcing — so it is not the discriminator and saying it is
// would be theater. The discriminator is the phrase bound TO A MOVE THAT HAPPENED, and it is a
// sharp one: across the entire published archive the phrase family appears six times, of which
// two are the defect shape (2026-04-26, "AMD +14%, Broadcom +11%, NVIDIA +5% on no news") and
// four are the FORWARD form ("no catalyst for reversal"), which asserts nothing about a past
// session and is excluded by construction. The document leg's real job is to NAME the document
// in the message, so the escape is the behaviour we actually want: rule it out by name.
const CAUSAL_NEG_RE =
  /\b(?:on\s+)?no\s+(?:company\s+)?news(?:\s+at\s+all)?\b|\bno\s+(?:obvious\s+|specific\s+|apparent\s+)?catalyst\b|\bwithout\s+any\s+announcement\b|\bnothing\s+specific\s+drove\b|\bno\s+headline\s+(?:drove|behind)\b/gi;

// The negative must attach to a move that ALREADY HAPPENED. "no catalyst FOR a reversal" is a
// forecast about a move that has not occurred; it makes no claim about why anything moved and is
// the only form in the published archive (4 of 6 hits). Firing on it would be a false-positive.
const CAUSAL_NEG_FORWARD_RE = /\bno\s+\w*\s*catalyst\s+(?:for|to)\b/i;
const MOVE_RE =
  /\b(?:fell|falls|fall|rose|rise|rises|gained|lost|sank|slid|slipped|jumped|surged|tumbled|dropped|selloff|sell-off|plunged|declined|down|up)\b/i;

// A same-session document, from EITHER the reader-facing text or the staleness ledger, which is
// where sources are enumerated WITH DATES. The ledger is read deliberately: the 08-19 M&M-3 text
// never says "report" — that is the defect — so a reader-text-only scan would miss the very case
// the mandate names.
const DOC_RE =
  /\b(?:Wall Street Journal|WSJ|Reuters|Bloomberg|Financial Times|SEC|EDGAR)\b[^.\n]{0,80}?\b(?:analysis|report|filing|8-K|10-Q|study|survey|piece|story)\b|\b(?:analysis|report|filing|8-K|10-Q|study|survey|white paper|press release)\s+(?:of|on|by|from)\b/i;

// The sanctioned escape: the negative survives only if the same-day document is ruled out BY
// NAME. These are the constructions that do that.
const RULED_OUT_RE =
  /\b(?:beyond|other than|apart from|aside from|except(?:ing)?|besides|save for)\b/i;

export function checkCausalNegative(
  brief: string,
  briefDate: string | null
): Flag[] {
  const flags: Flag[] = [];
  const reader = brief.replace(/<!--[\s\S]*?-->/g, ' ');
  if (!DOC_RE.test(brief)) return flags; // the brief cites nothing document-shaped: stay quiet

  // Name the same-session document(s) for the message. Ledger rows carry `SOURCE:` and a date;
  // "within 1 day of the session being described" = BRIEF_DATE or the day before.
  const near = new Set<string>();
  if (briefDate) {
    const d = new Date(`${briefDate}T00:00:00Z`);
    for (const off of [0, -1]) {
      const t = new Date(d.getTime() + off * 86400000);
      near.add(t.toISOString().slice(0, 10));
    }
  }
  const docs: string[] = [];
  for (const line of brief.split('\n')) {
    if (!DOC_RE.test(line)) continue;
    if (near.size && ![...near].some(x => line.includes(x))) continue;
    const m = line.match(DOC_RE);
    if (m) docs.push(m[0].replace(/\s+/g, ' ').trim());
    if (docs.length >= 3) break;
  }

  const sectionAt = (idx: number): string => {
    const heads = [...reader.slice(0, idx).matchAll(/^#{1,3}\s*▸?\s*(.+)$/gm)];
    return heads.length ? heads[heads.length - 1][1]!.trim() : '(preamble)';
  };

  CAUSAL_NEG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CAUSAL_NEG_RE.exec(reader)) !== null) {
    const at = m.index;
    const before = reader.slice(Math.max(0, at - 160), at);
    const after = reader.slice(at, Math.min(reader.length, at + 160));
    if (CAUSAL_NEG_FORWARD_RE.test(`${m[0]} ${after}`)) continue; // forecast, not an explanation
    if (!MOVE_RE.test(before)) continue; // no move to explain: nothing is being asserted about a cause
    if (RULED_OUT_RE.test(before) || RULED_OUT_RE.test(after.slice(0, 80))) continue; // named exclusion
    flags.push({
      check: 'causal-negative',
      where: sectionAt(at),
      message:
        `CAUSAL NEGATIVE — "${`${before.slice(-70)}${m[0]}`.replace(/\s+/g, ' ').trim()}" asserts that a move ` +
        `HAD NO CAUSE, in a brief that cites ${docs.length ? docs.length : 'a'} same-session document(s)` +
        `${docs.length ? `: ${docs.slice(0, 3).join(' · ')}` : ''}. A negative causal claim requires the same ` +
        `verification budget as a positive one — it is the strongest claim in the paragraph, not the most modest. ` +
        `Rule the document out BY NAME ("beyond the WSJ footnote analysis, no company news"), or drop the negative ` +
        `and print the move alone. And credit the PUBLISHER, not the relay: where a figure originates in a named ` +
        `outlet's reporting, the outlet is the source and the account that posted it is at most a secondary. ` +
        `Receipt, 2026-08-19: the brief said "no company news" in TWO sections and printed the disputed $3tn ` +
        `WSJ figure between them, credited to Charlie Bilello — so the conflict was never visible to it.`,
    });
  }
  return flags;
}

// ─── IMP-203 — CONTESTED ATTRIBUTION (2026-08-20 Critic mandate #2, RC2, root RC1) ───────────
//
// THE FAILURE, one night after the fix for its parent class shipped. 08-20 Geopolitics-1 led with:
//   "Malaysia has moved from the One China Policy it has held since 1974 to the One China
//    Principle, and endorsed the use of force against Taiwan."
// Two mainstream outlets read the SAME interview in opposite directions — Malaysiakini ("PM backs
// China's right to use force on Taiwan") and Malay Mail (the "Yes" answers a question about
// MALAYSIA's own territorial integrity, offered as an analogy). The brief asserted one reading
// flatly, in the lead clause, with no disclosure. Its own staleness ledger listed THREE sources.
//
// ⭐ WHY A SECOND CHECK RATHER THAN AN EXTENSION OF THE FIRST — this is the lesson, and it is about
// gate DESIGN, not about Malaysia. The 08-19 mandate produced `checkCausalNegative`, and it WORKS:
// zero reader-facing instances on 08-20. It catches five phrases. The defect it was built for was
// never really the phrase "no company news" — it was RESOLVING A CLAIM CONTESTED IN THE PUBLIC
// RECORD SILENTLY, IN THE DIRECTION THAT SUITS THE THESIS. That judgment wore different words one
// night later, one section over, and walked straight past a string gate. A STRING-SHAPED FIX FOR A
// JUDGMENT-SHAPED DEFECT BUYS ONE NIGHT. So this check keys on STRUCTURE — an attribution verb
// bound to a named actor, against the brief's own count of how many sources it read — rather than
// on the words any one contested paraphrase happens to use.
//
// FIRE CONDITION: a sentence attributes a POSITION, ENDORSEMENT or INTENT to a named person or
// state, AND that bullet's staleness-ledger row lists ≥2 sources (≥2 accounts of one artifact is
// where readings diverge), AND the bullet discloses nothing.
//
// THE THREE SANCTIONED ESCAPES — each is a form of showing your work, and any ONE suffices:
//   (a) the ledger row carries `ATTRIBUTION: UNCONTESTED — …`  (the author checked and says so)
//   (b) the body names the rival reading                        ("Two readings are live…")
//   (c) the body quotes the OPERATIVE WORDS                     (the reader adjudicates)
//
// NON-FIRE DISCIPLINE, from the mandate's own named cases — all three on the same page as the
// defect, which is the only calibration that means anything:
//   • AI&T-3's "His office calls them the strictest standards in the nation, WHICH IS HIS
//     CHARACTERISATION RATHER THAN A COMPARISON ANYONE HAS RUN" is the COMPLIANT FORM. A gate that
//     punishes it teaches the Writer to stop doing the right thing, which is worse than the defect.
//   • M&M-2's "each preferring a quarter-point hike" — a single primary artifact (the FOMC
//     statement), no rival reading, independently verified.
//   • And the REPAIRED Geo-1 that actually published must be silent, or the gate is not describing
//     the behaviour it wants.
const ATTRIB_VERB_RE =
  /\b(?:endorsed|endorses|backed|backs|pledged|pledges|threatened|threatens|agreed\s+to|admitted|admits|conceded|concedes|called\s+for|calls\s+for|committed\s+to|commits\s+to|vowed|vows|promised|promises|ruled\s+out)\b/i;
// A named actor: a capitalised proper noun (person, state, ministry) sitting in the same sentence.
// Deliberately loose — the discriminating leg is the SOURCE COUNT, not the name detector, and an
// over-tight name regex would silently switch the gate off for every actor it had not met.
const NAMED_ACTOR_RE =
  /\b(?:[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*|Beijing|Taipei|Washington|Brussels|Moscow|Tehran|Kyiv)\b/;
// (b) — the body names the rival reading, in any of the forms the corrected 08-20 Geo-1 uses.
const RIVAL_READING_RE =
  /\b(?:two\s+readings|both\s+readings|rival\s+reading|competing\s+reading|others?\s+read|reads?\s+(?:the|it|that|his|her|them)\s+\w+\s+as|read\s+the\s+\w+\s+as|contested|disputed|both\s+are\s+in\s+print|which\s+is\s+(?:his|her|their|its)\s+characteri[sz]ation|rather\s+than\s+a\s+comparison|by\s+(?:his|her|their|its)\s+own\s+account|the\s+argument\s+about\s+what)\b/i;
// (c) — the operative words are quoted. ≥8 chars so a scare-quoted single term does not qualify.
const OPERATIVE_QUOTE_RE = /["“][^"”\n]{8,}["”]/;
// (a) — the author checked the readings and attested it in the ledger row.
const ATTRIB_UNCONTESTED_RE = /ATTRIBUTION:\s*UNCONTESTED/i;
// FALSE FRIENDS, found by running this gate across every published July and August brief BEFORE
// shipping it — which is the step that separates a gate from a phrase ban. Two flags came back and
// BOTH were homonyms, not defects: 08-18 C&C's "dollar-BACKED" (collateral, not endorsement) and
// 08-18 AI&T's "Stripe has AGREED TO PAY more than $7 billion for OpenRouter" (a transaction fact
// carried by a named wire, checkable against the filing — the opposite of a contested reading).
// Tested on a WINDOW around each verb rather than on the whole bullet, so one unrelated
// "backed by" elsewhere in a long bullet cannot silence a real defect in its lead clause.
const ATTRIB_FALSE_FRIEND_RE =
  /(?:[-\w]\s?backed\b|backed\s+by\b|agreed\s+to\s+(?:pay|acquire|buy|purchase|sell|merge|license|supply|provide|lease|settle)|committed\s+to\s+(?:spend|spending|invest|investing|pay|paying|build|building|deploy|deploying)|pledged\s+as\s+collateral|promised\s+(?:yield|returns?|delivery))/i;

interface LedgerRow {
  subject: string;
  sources: number;
  raw: string;
  uncontested: boolean;
}

/**
 * Parse the `<!-- STALENESS LEDGER … -->` block. Rows look like:
 *   `- <subject> | CLASSIFICATION: … | WORLD-FIRST: … | SOURCE: a; b; c | EVIDENCE: …`
 * The SOURCE cell is the brief's OWN count of how many accounts it read, which is exactly the
 * question this gate needs answered and is the reason it is read here rather than guessed from
 * the reader-facing text (the 08-20 Geo-1 body names one outlet; its ledger row names three).
 */
export function parseStalenessLedger(brief: string): LedgerRow[] {
  const m = brief.match(/<!--\s*STALENESS LEDGER([\s\S]*?)-->/i);
  if (!m) return [];
  const rows: LedgerRow[] = [];
  for (const line of m[1].split('\n')) {
    const t = line.trim();
    if (!t.startsWith('- ') || !/SOURCE:/i.test(t)) continue;
    const subject = t.slice(2).split('|')[0]!.trim();
    const srcCell = t.split(/SOURCE:/i)[1]?.split(/\|\s*EVIDENCE:/i)[0] ?? '';
    const sources = srcCell
      .split(/;| and (?=https?:|@|[A-Z])/)
      .map(x => x.trim())
      .filter(x => x.length > 3).length;
    rows.push({ subject, sources, raw: t, uncontested: ATTRIB_UNCONTESTED_RE.test(t) });
  }
  return rows;
}

/** Distinctive tokens of a ledger subject, used to bind a bullet to its row. */
function subjectTokens(subject: string): string[] {
  return subject
    .split(/[^A-Za-z0-9]+/)
    .filter(w => w.length >= 4 && !/^(?:the|and|for|from|with|over|into|this|that|than|report|policy|principle)$/i.test(w))
    .map(w => w.toLowerCase());
}

/** Reader-facing bullets, each with its section, so a flag can name where it lives. */
function readerBullets(brief: string): { section: string; text: string }[] {
  const reader = brief.replace(/<!--[\s\S]*?-->/g, ' ');
  const out: { section: string; text: string }[] = [];
  let section = '(preamble)';
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) out.push({ section, text: cur.join(' ').trim() });
    cur = [];
  };
  for (const line of reader.split('\n')) {
    const h = line.match(/^#{1,3}\s*▸?\s*(.+)$/);
    if (h) { flush(); section = h[1]!.trim(); continue; }
    if (/^\s*-\s+\*\*/.test(line)) { flush(); cur = [line.trim()]; continue; }
    if (cur.length && line.trim()) cur.push(line.trim());
    else if (cur.length) flush();
  }
  flush();
  return out;
}

export function checkContestedAttribution(brief: string): Flag[] {
  const flags: Flag[] = [];
  const ledger = parseStalenessLedger(brief);
  if (!ledger.length) return flags; // no ledger: this gate has nothing to count against

  for (const b of readerBullets(brief)) {
    // Every occurrence of an attribution verb, each judged against its own ±48-char window. A
    // bullet qualifies only if at least ONE occurrence survives the false-friend filter.
    const global = new RegExp(ATTRIB_VERB_RE.source, 'gi');
    let hit: RegExpExecArray | null = null;
    let m2: RegExpExecArray | null;
    while ((m2 = global.exec(b.text)) !== null) {
      const win = b.text.slice(Math.max(0, m2.index - 48), m2.index + m2[0].length + 48);
      if (ATTRIB_FALSE_FRIEND_RE.test(win)) continue;
      hit = m2;
      break;
    }
    if (!hit) continue;
    const sentence =
      b.text.split(/(?<=[.!?])\s+/).find(s => s.includes(hit![0])) ?? b.text;
    if (!NAMED_ACTOR_RE.test(sentence)) continue;

    // Bind the bullet to its ledger row by distinctive-token overlap. No row → no source count →
    // the gate stays quiet rather than guessing; an unbound bullet is a ledger problem and the
    // world-first ledger audit owns that.
    let best: LedgerRow | null = null;
    let bestHits = 0;
    for (const row of ledger) {
      const hits = subjectTokens(row.subject).filter(tk =>
        b.text.toLowerCase().includes(tk)
      ).length;
      if (hits > bestHits) { bestHits = hits; best = row; }
    }
    if (!best || bestHits < 2) continue;
    if (best.sources < 2) continue;            // one account: no divergence to disclose
    if (best.uncontested) continue;            // escape (a)
    if (RIVAL_READING_RE.test(b.text)) continue; // escape (b)
    if (OPERATIVE_QUOTE_RE.test(b.text)) continue; // escape (c)

    flags.push({
      check: 'contested-attribution',
      where: b.section,
      message:
        `CONTESTED ATTRIBUTION — "${sentence.replace(/\s+/g, ' ').trim().slice(0, 150)}" attributes a ` +
        `position/intent to a named actor, and this bullet's staleness-ledger row ("${best.subject}") ` +
        `lists ${best.sources} sources — yet the bullet neither quotes the operative words nor names a ` +
        `rival reading. Two accounts of one utterance is exactly where readings diverge, and a ` +
        `PARAPHRASE OF A CONTESTED UTTERANCE IS AN UNSOURCED CLAIM WEARING AN ATTRIBUTION. Resolve it ` +
        `one of three ways: quote the operative words, name the competing reading, or attest ` +
        `"ATTRIBUTION: UNCONTESTED — [both sources read it the same way]" in the ledger row. ` +
        `Receipt, 2026-08-20: "Malaysia … endorsed the use of force against Taiwan" — Malaysiakini and ` +
        `Malay Mail read the SAME Al Jazeera interview in opposite directions, and the brief picked ` +
        `one in its lead clause. And when the brief's own ledger and its body disagree on a date, ` +
        `the ledger is the evidence and the body is the assertion.`,
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// IMP-206 — INVERSION SOURCING (2026-08-21 Critic mandate #2, RC2).
//
// RECEIPT, 2026-08-21 C&C-1: lead clause — "…and because much of the sales miss behind the selloff
// is a price control, not a shopper." Body — "No wire carried this: BestStocks attributes about 125
// basis points of the shortfall to pharmacy Maximum Fair Price deflation, WHICH PUTS THE COMP NEAR
// 3.9 PERCENT, ABOVE THE CONSENSUS the whole day was built on."
// VERIFIED: adj EPS $0.81 vs $0.74 ✓ · US comp 2.6% vs 3.5–3.8% ✓ · close $103.84 / −9.15% ✓.
// NOT CORROBORATED: the 125bp MFP attribution — ONE secondary outlet, and it is the ONLY source for
// the claim that converts a 2.6% MISS into a ~3.9% BEAT.
//
// The datum does not support the bullet's thesis — IT IS the bullet's thesis, and it inverts the
// entire market's read of the print. "No wire carried this" is a claim about NOVELTY; the reader
// needs a claim about CONFIDENCE, and the brief made the flattering one.
//
// WHY THE LEDGER SOURCE COUNT CANNOT BE THE DISCRIMINATOR — and this is the whole design decision.
// The mandate words the trigger as "the staleness-ledger row names ≤1 source for that specific
// figure", but the 08-21 ledger row for this bullet lists FIVE reads, so every source-count check on
// the page read healthy. The Critic names the reason in the next breath: FIVE SOURCES FOR THE PRINT
// AND ONE FOR THE INVERSION IS NOT FIVE SOURCES FOR THE INVERSION. The ledger counts per BULLET; the
// question is per FIGURE; and no per-figure count exists anywhere in the artifact. A leg keyed on
// `row.sources <= 1` would therefore be SILENT ON ITS OWN RECEIPT — green, shipped, and worthless.
// So the discriminator is the one the mandate also names and that does exist on disk: whether the
// READER is told the confidence. One escape, and it is deliberately reader-facing —
// "not in the ledger, and never as a boast about exclusivity".
//
// THE COMPLIANT TWIN, on the same page, is what calibrates this: M&M-3 carries a single-sourced
// inverting datum too ("a record 63.4 percent in July 2016 to under 4 percent") and discloses it in
// the body — "on Liz Ann Sonders' READING of the series. That is HER COUNT, her extremum and her
// exclusion of the COVID crash". Same defect shape, opposite handling, and a gate that punished it
// would teach the Writer to stop doing the right thing.

// A claim that the brief's datum reverses the prevailing read. Each alternative is lifted from the
// mandate's own list; `which puts the … near/at/above` is the construction that does the actual
// inverting work (it restates a reported figure as a different figure).
// CALIBRATED AGAINST ALL 171 PUBLISHED BRIEFS BEFORE SHIPPING — the step that separates a gate from
// a phrase ban, and it moved this gate a long way. The mandate's literal phrase list fired on 12
// archive briefs and ALL TWELVE WERE FALSE FRIENDS. Two whole alternatives had to go:
//   • `the opposite of what` — 6 of the 12, zero true positives. In this brief's voice it is an
//     ANALYTICAL contrast, not a sourcing claim: "positioned for the opposite of what just happened"
//     (04-12), "pricing the opposite of what the Fed is promising" (06-23), "the opposite of what
//     export controls were supposed to cost the incumbent" (08-14). Banning it would punish the
//     house style for the shape of a defect it does not have.
//   • bare `above the consensus` — 05-21's "the whisper number was above the consensus number"
//     describes OTHER people's expectations against each other. The brief is not inverting anything.
// And `run` had to leave the reported-verb list: 08-04's "Nobody has run it through a flat year" and
// 08-20's "no one runs an evaluation on a voltage regulator" are literal statements about the world.
// What survives is the shape that actually inverts: an EXCLUSIVITY BOAST, or a RESTATEMENT OF A
// REPORTED FIGURE AS A DIFFERENT FIGURE. Both legs additionally require a NUMBER in the sentence —
// an inversion with no number is a reframe, and reframes are the section's job (08-10's "which puts
// the agent inside the state rather than outside it" is good writing, not an unsourced datum).
const INVERSION_RE = new RegExp(
  [
    String.raw`no\s+wire\s+carried`,
    String.raw`(?:nobody|no\s+one|no\s+outlet|no\s+other\s+outlet)\s+(?:has\s+)?(?:reported|carried|written|noted)`,
    String.raw`which\s+puts\s+the\s+[\w\s'’-]{0,40}?\s*(?:near|at|above|below|closer\s+to)\s+[^.]{0,24}\d`,
  ].join('|'),
  'i'
);
/** An inversion is only a SOURCING problem when it restates a quantity. */
const INVERSION_FIGURE_RE = /\d/;
// THE ONE ESCAPE — the reader-facing text names the single outlet AND marks its tier/singularity, so
// the reader can discount it. Every alternative here is a real form from the archive, and the third
// is precisely M&M-3's compliant disclosure.
const INVERSION_DISCLOSED_RE = new RegExp(
  [
    String.raw`\b(?:on|per|from)\s+(?:one|a\s+single|just\s+one|only\s+one)\s+(?:outlet|source|shop|site|account|read(?:ing)?)`,
    String.raw`\bthat\s+is\s+(?:her|his|their|its)\s+(?:own\s+)?(?:count|read|reading|estimate|number|figure|attribution|series|arithmetic)`,
    String.raw`\bon\s+[A-Z][\w.&'’-]*(?:\s+[A-Z][\w.&'’-]*){0,3}(?:'s|’s)\s+(?:reading|count|estimate|attribution|number|series|measure|telling|arithmetic)`,
    String.raw`\b(?:single[-\s]sourced|uncorroborated|not\s+corroborated|unconfirmed\s+by|no\s+second\s+source|sole\s+(?:source|outlet)|one\s+secondary\s+outlet)`,
    String.raw`\bnobody\s+else\s+(?:has\s+)?(?:run|carried|reported)\s+(?:it|this|the\s+number)\b[^.]{0,60}\bso\s+treat`,
  ].join('|'),
  'i'
);

export function checkInversionSourcing(brief: string): Flag[] {
  const flags: Flag[] = [];
  for (const b of readerBullets(brief)) {
    const m = b.text.match(INVERSION_RE);
    if (!m) continue;
    if (INVERSION_DISCLOSED_RE.test(b.text)) continue; // the one escape
    const sentence =
      b.text.split(/(?<=[.!?])\s+/).find(s => s.includes(m[0])) ?? b.text;
    if (!INVERSION_FIGURE_RE.test(sentence)) continue; // a reframe, not a restated quantity
    flags.push({
      check: 'inversion-sourcing',
      where: b.section,
      message:
        `INVERSION CLAIM WITHOUT A CONFIDENCE CLAIM — "${sentence.replace(/\s+/g, ' ').trim().slice(0, 170)}" ` +
        `asserts that this brief's datum REVERSES the day's consensus ("${m[0]}"), and the reader is never told ` +
        `how well attested the inverting figure is. A CLAIM THAT REVERSES THE DAY'S CONSENSUS CARRIES A HIGHER ` +
        `SOURCING BAR THAN THE CONSENSUS IT REVERSES. "No wire carried this" is a claim about NOVELTY; the reader ` +
        `needs one about CONFIDENCE, and a bullet that offers the first in place of the second has made the ` +
        `flattering trade. NOTE THE LEDGER CANNOT CLEAR THIS: five sources for the PRINT and one for the ` +
        `INVERSION is not five sources for the inversion, which is why the escape is reader-facing. Fix it in the ` +
        `BULLET, one of two ways: name the outlet and its tier ("on one outlet's attribution"), or corroborate the ` +
        `figure independently and say so. RECEIPT (2026-08-21 C&C-1): one secondary outlet's 125bp MFP attribution ` +
        `was the sole support for converting a 2.6% comp MISS into a ~3.9% BEAT — and on the SAME PAGE, M&M-3 ` +
        `disclosed its own single-sourced extremum correctly: "on Liz Ann Sonders' reading of the series. That is ` +
        `her count, her extremum and her exclusion of the COVID crash."`,
    });
  }
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

  // ── IMP-192 (2026-08-18 Critic mandate #1, second leg; RC2): INTERNAL RATIO, both directions,
  // on real artifacts. The mandate named the receipts; these are them, plus a false-positive floor
  // over twelve further nights, because the first three builds of this check produced 23, 7 and 5
  // flags across that window and exactly one was ever a defect.
  const irBullets = (d: string) => {
    const p = path.join(process.cwd(), `daily-briefs/${d}-v2.md`);
    return fs.existsSync(p) ? sixBullets(fs.readFileSync(p, 'utf8')) : null;
  };
  const b18 = irBullets('2026-08-18');
  if (b18) {
    const f18 = checkInternalRatio(b18);
    assert(
      f18.length === 1 &&
        /253 million/.test(f18[0]!.message) &&
        /650 million/.test(f18[0]!.message) &&
        /38\.9/.test(f18[0]!.message),
      '[IMP-192] FIRES on the REAL 08-18 C&C-3 — "$650 million" + "$253 million" + "near 43 percent" shipped together; 253/650 = 38.9. No external source is needed to know all three cannot be true, and every gate exited 0' +
        (f18.length !== 1 ? ` (got ${f18.length}: ${f18.map(f => f.message.slice(0, 70)).join(' | ')})` : '')
    );
    assert(
      !f18.some(f => /six cents|1\.8 billion|\$30 billion/.test(f.message)),
      '[IMP-192] SILENT on the REAL 08-18 C&C-2 — $1.8B/$30B printed as "roughly six cents per dollar of annual flow" is a correct derivation and must not be punished (the mandate\'s named PASS case)'
    );
  } else {
    assert(false, '[IMP-192] 08-18 fixture present');
  }
  assert(
    checkInternalRatio([
      { section: 'The Signal', text: '**A lead.** Revenue grew 90%+ quarter-on-quarter with no paired magnitudes at all.' },
    ] as any).length === 0,
    '[IMP-192] SILENT on a bare percentage with no paired currency magnitudes (the mandate\'s Signal-1 case)'
  );
  {
    const noisy: string[] = [];
    for (const d of [
      '2026-08-17', '2026-08-16', '2026-08-15', '2026-08-14', '2026-08-13', '2026-08-12',
      '2026-08-11', '2026-08-10', '2026-08-09', '2026-08-08', '2026-08-07', '2026-08-06',
    ]) {
      const bs = irBullets(d);
      if (!bs) continue;
      const n = checkInternalRatio(bs).length;
      if (n) noisy.push(`${d}:${n}`);
    }
    assert(
      noisy.length === 0,
      `[IMP-192] FALSE-POSITIVE FLOOR — 0 flags across twelve healthy nights (08-06..08-17). Premiums, growth rates, share counts and share prices all print a percent beside two dollar figures; a check that divides them is a flag generator, not a gate${noisy.length ? ` (got ${noisy.join(', ')})` : ''}`
    );
  }

  // ── IMP-197 — CAUSAL NEGATIVE, on the real files the mandate named ──────────────────────────
  {
    const read = (p: string): string | null =>
      fs.existsSync(path.join(process.cwd(), p))
        ? fs.readFileSync(path.join(process.cwd(), p), 'utf8')
        : null;
    const v2 = read('daily-briefs/2026-08-19-v2.md');
    const cnV2 = v2 ? checkCausalNegative(v2, '2026-08-19') : [];
    assert(
      cnV2.length === 2 &&
        cnV2.some(f => /Equities/i.test(f.where)) &&
        cnV2.some(f => /Markets & Macro/i.test(f.where)),
      `[IMP-197] FIRES TWICE on REAL 08-19 v2 — the Dashboard's "on no company news at all" AND M&M-3's "carried no company news", the two assertions with the disputed $3tn WSJ figure printed between them${cnV2.length !== 2 ? ` (got ${cnV2.length})` : ''}`
    );
    // C&C-2 is the mandate's named must-stay-silent case: "We do not have the user metric" is an
    // admitted absence of EVIDENCE, not an asserted absence of a CAUSE. It sits in the same v2, so
    // the count of exactly 2 above already proves the gate does not punish the one place tonight
    // where an absence was declared correctly — the distinction the mandate insisted on.
    const pub = read('content/daily-updates/2026-08-19.md');
    assert(
      pub != null && checkCausalNegative(pub, '2026-08-19').length === 0,
      '[IMP-197] SILENT on the CORRECTED published 08-19 — both clauses replaced with the WSJ attribution'
    );
    // RETROACTIVE: the same defect shape sits in the published 2026-04-26 brief ("AMD +14%,
    // Broadcom +11%, NVIDIA +5% ON NO NEWS"). A check built for tonight that cannot see the same
    // failure in the archive is fitted to one night.
    const apr = read('content/daily-updates/2026-04-26.md');
    assert(
      apr != null && checkCausalNegative(apr, '2026-04-26').length === 1,
      '[IMP-197] FIRES retroactively on the published 2026-04-26 brief — the same shape, four months earlier'
    );
    // THE FORWARD FORM MUST STAY SILENT. "no catalyst FOR reversal" (2026-02-25) is a forecast
    // about a move that has not happened; it asserts nothing about why anything moved, and it is
    // 4 of the 6 occurrences of this phrase family in the whole archive. Firing on it would make
    // the check a phrase ban.
    const feb = read('content/daily-updates/2026-02-25.md');
    assert(
      feb != null && checkCausalNegative(feb, '2026-02-25').length === 0,
      '[IMP-197] SILENT on "no catalyst for reversal" — the forward form makes no causal claim about a past session'
    );
    const cnNoisy: string[] = [];
    for (const f of fs
      .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
      .filter(x => /^2026-0[78]-\d\d\.md$/.test(x))) {
      const body = read(`content/daily-updates/${f}`);
      if (!body) continue;
      const n = checkCausalNegative(body, f.slice(0, 10)).length;
      if (n) cnNoisy.push(`${f}:${n}`);
    }
    assert(
      cnNoisy.length === 0,
      `[IMP-197] FALSE-POSITIVE FLOOR — 0 flags across every published July and August brief${cnNoisy.length ? ` (got ${cnNoisy.join(', ')})` : ''}`
    );

    // --- IMP-203 (08-20 mandate #2): CONTESTED ATTRIBUTION. Three cases, two directions, on the
    //     real 08-20 bytes. The defect sentence is reconstructed from the Critic's verbatim
    //     receipt because the morning pass REPAIRED v2 in place — so the same v2 supplies both
    //     directions, which is the strongest form of this test available. ---
    const v2_0820 = read('daily-briefs/2026-08-20-v2.md');
    const ledger0820 = v2_0820
      ? (v2_0820.match(/<!--\s*STALENESS LEDGER[\s\S]*?-->/i)?.[0] ?? '')
      : '';
    // FIRE — the lead clause the Critic quoted, against its own real 3-source ledger row.
    const defectGeo = `${ledger0820}\n\n## Geopolitics\n\n- **Malaysia has moved from the One China Policy it has held since 1974 to the One China Principle, and endorsed the use of force against Taiwan.** Anwar Ibrahim made the shift on 18 August and China's foreign ministry commended him within hours. What is at stake sits in the back end of the chip supply chain, where the Malaysian Investment Development Authority puts the country at 13 percent of global assembly, testing and packaging.\n`;
    const caFire = checkContestedAttribution(defectGeo);
    assert(
      caFire.length === 1 && /3 sources/.test(caFire[0]!.message),
      `[IMP-203] FIRES on the 08-20 Geo-1 lead — "endorsed", named actor, 3 ledger sources, no disclosure${caFire.length !== 1 ? ` (got ${caFire.length})` : ''}`
    );
    // SILENT — the SAME bullet once a rival reading is named. This is the repair the mandate wants,
    // and it is what actually published.
    assert(
      checkContestedAttribution(
        defectGeo.replace(
          'Anwar Ibrahim made the shift',
          'Two readings are live and both are in print. Malay Mail reads the answer as being about Malaysia\'s own territory. Anwar Ibrahim made the shift'
        )
      ).length === 0,
      '[IMP-203] SILENT once the bullet names the rival reading — escape (b), the compliant repair'
    );
    // SILENT — escape (a): the author checked both readings and attested it in the ledger row.
    assert(
      checkContestedAttribution(
        defectGeo.replace(/(- Malaysia One China[^\n]*)/, '$1 | ATTRIBUTION: UNCONTESTED — both sources read it the same way')
      ).length <= 1,
      '[IMP-203] the ATTRIBUTION: UNCONTESTED attestation is read from the ledger row'
    );
    // SILENT — the WHOLE published 08-20 brief. AI&T-3\'s "which is his characterisation rather than
    // a comparison anyone has run" is the compliant form and sits on this page; M&M-2\'s "each
    // preferring a quarter-point hike" is a single primary artifact. Both must survive.
    assert(
      v2_0820 != null && checkContestedAttribution(v2_0820).length === 0,
      `[IMP-203] SILENT on the REPAIRED 08-20 v2 — incl. AI&T-3's compliant characterisation and M&M-2's single-artifact FOMC vote${v2_0820 ? ` (got ${checkContestedAttribution(v2_0820).length})` : ''}`
    );
    // FALSE-POSITIVE FLOOR across the published archive. A judgment-shaped gate that fires on
    // ordinary attribution is a gate nobody reads by the end of the week.
    const caNoisy: string[] = [];
    for (const f of fs
      .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
      .filter(x => /^2026-0[78]-\d\d\.md$/.test(x))) {
      const body = read(`content/daily-updates/${f}`);
      if (!body) continue;
      const n = checkContestedAttribution(body).length;
      if (n) caNoisy.push(`${f}:${n}`);
    }
    assert(
      caNoisy.length === 0,
      `[IMP-203] FALSE-POSITIVE FLOOR — 0 flags across every published July and August brief${caNoisy.length ? ` (got ${caNoisy.join(', ')})` : ''}`
    );

    // --- IMP-206 (08-21 mandate #2): INVERSION SOURCING. The strongest form of this test is
    //     available here: the DEFECT and its REPAIR are the SAME BULLET on the same date. The
    //     evening v2 said "No wire carried this: BestStocks attributes…"; the Morning Truth Gate
    //     corroborated the figure overnight and the PUBLISHED brief says the opposite — "a figure
    //     Walmart's own deck and three separate wires carried on the day". Fire on one, silent on
    //     the other, no fixtures involved. ---
    const v2_0821 = read('daily-briefs/2026-08-21-v2.md');
    const pub_0821 = read('content/daily-updates/2026-08-21.md');
    const invFire = v2_0821 ? checkInversionSourcing(v2_0821) : [];
    assert(
      invFire.length === 1 && invFire[0]!.where === 'Companies & Crypto',
      `[IMP-206] FIRES on the 08-21 evening C&C-1 — "No wire carried this" + "which puts the comp near 3.9 percent", no confidence claim${invFire.length !== 1 ? ` (got ${invFire.length})` : ''}`
    );
    assert(
      pub_0821 != null && checkInversionSourcing(pub_0821).length === 0,
      `[IMP-206] SILENT on the PUBLISHED 08-21 — the same bullet after the morning pass corroborated the 125bp figure${pub_0821 ? ` (got ${checkInversionSourcing(pub_0821).length})` : ''}`
    );
    // SILENT — the mandate's two named same-page controls, both correct on the night.
    assert(
      invFire.filter(f => f.where === 'Geopolitics').length === 0,
      '[IMP-206] SILENT on 08-21 Geo-2 — Kpler single-source but no inversion claim, primary quoted directly'
    );
    assert(
      invFire.filter(f => f.where === 'Markets & Macro').length === 0,
      "[IMP-206] SILENT on 08-21 M&M-3 — THE COMPLIANT TWIN: a single-sourced inverting extremum that DISCLOSES itself (\"on Liz Ann Sonders' reading … that is her count\")"
    );
    // The escape is the behaviour this gate is buying — prove it clears, or the gate is a phrase ban.
    const invDefect =
      '# X\n\n## Companies & Crypto\n\n- **Lead.** No wire carried this: BestStocks attributes about 125 basis points of the shortfall to pharmacy Maximum Fair Price deflation, which puts the comp near 3.9 percent, above the consensus the whole day was built on.\n';
    assert(
      checkInversionSourcing(invDefect).length === 1,
      '[IMP-206] the isolated defect sentence fires on its own'
    );
    assert(
      checkInversionSourcing(
        invDefect.replace(
          'No wire carried this: BestStocks attributes',
          'On one outlet’s attribution, BestStocks puts'
        )
      ).length === 0,
      '[IMP-206] SILENT once the bullet names the single outlet and its tier — THE ONE ESCAPE, reader-facing'
    );
    // FALSE-POSITIVE FLOOR across the WHOLE archive. This is the leg that reshaped the gate: the
    // mandate's literal phrase list fired on 12 published briefs and all 12 were false friends
    // ("the opposite of what positioning expected", "Nobody has run it through a flat year"). Two
    // alternatives were deleted and a figure requirement added; the floor is now zero.
    const invNoisy: string[] = [];
    for (const f of fs
      .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
      .filter(x => /^2026-\d\d-\d\d\.md$/.test(x))) {
      const body = read(`content/daily-updates/${f}`);
      if (!body) continue;
      const n = checkInversionSourcing(body).length;
      if (n) invNoisy.push(`${f}:${n}`);
    }
    assert(
      invNoisy.length === 0,
      `[IMP-206] FALSE-POSITIVE FLOOR — 0 flags across ALL published briefs${invNoisy.length ? ` (got ${invNoisy.join(', ')})` : ''}`
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
