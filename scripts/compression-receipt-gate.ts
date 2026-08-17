#!/usr/bin/env node --experimental-strip-types
/**
 * compression-receipt-gate.ts — IMP-182 (2026-08-16 Critic mandate #1, RC1).
 *
 * A COMPRESSION RECEIPT IS A CLAIM ABOUT A DIFF, AND NOTHING ON THIS PIPELINE RAN THE DIFF.
 *
 * WHAT SHIPPED ON 2026-08-16. Gate 16 appended a LENGTH-OVERRIDE comment to v2 asserting:
 *
 *     "Gate 16 compressed 5,995 to 5,584 reader-facing words ... with ZERO units cut whole and
 *      zero conclusions removed."
 *
 * The actual v1.5 → v2 diff, computed on comment-stripped bodies, removed 66 sentences, among them:
 *
 *   M&M-1  lost its designated non-canonical dated parallel — "The last time the tenor paid more
 *          was August 2001, at 5.52 percent, after which the thirty-year auction was suspended for
 *          almost five years." The receipt NAMES THIS SENTENCE as the reason M&M-1 could not be cut,
 *          in a comment appended to the file it is no longer in.
 *   SIG-2  lost its denominator — "against a SAM population of roughly 550,000 registered entities".
 *   AI&T-2 lost the O-Ring MECHANISM, reduced to a name-drop.
 *   GEO-1  lost the statute's counter-instances and its scope limits — a compression that made a
 *          historical claim STRONGER by deleting the brief's own qualifications.
 *
 * GATE STATE THAT NIGHT: validate-brief EXIT=0 · ceiling-lint EXIT=0 · assembly-gate EXIT=0 ·
 * adverse-datum-gate EXIT=0 · novelty-gate EXIT=0. Every gate green on the FINAL artifact, and not
 * one of them reads v1.5. The pipeline can check the brief; it could not check the brief's account
 * of itself. That is the whole class: a SELF-REPORT is an assertion about two files, and a system
 * that reads only one of them cannot grade it.
 *
 * THE TRIGGER IS THE CLAIM, NOT THE COMPRESSION. This gate is silent on every brief that does not
 * assert a no-loss compression — which is all of 2026-08-01 through 2026-08-15. Compressing hard is
 * legal. Cutting a unit is legal. Telling the next session you cut nothing, when you cut a dated
 * parallel, is what this gate exists to stop.
 *
 * THE ESCAPE HATCH IS THE DESIGN. A receipt that ENUMERATES what it removed goes silent, item by
 * item. The gate does not reward compressing less; it rewards naming what you cut. Assert nothing
 * and you are free; assert "zero conclusions removed" and the diff has to agree.
 *
 * Usage:
 *   node --experimental-strip-types scripts/compression-receipt-gate.ts <DATE|v2-path>
 *   node --experimental-strip-types scripts/compression-receipt-gate.ts 2026-08-16 --warn-only
 *   node --experimental-strip-types scripts/compression-receipt-gate.ts --selftest
 *
 * Exit: 0 clean (or --warn-only) · 1 a no-loss receipt is contradicted by its own diff · 2 usage.
 * Wired into: system/Brief_Editor.md Gate 16 (blocking) + pipeline-health-check (--warn-only).
 */
import * as fs from 'fs';
import * as path from 'path';

export interface Finding {
  // WARN added 2026-08-17 (IMP-186): a protection claim with no literal in it is neither kept nor
  // lost, and reporting it as either would be a lie in one of the two available directions.
  kind: 'FAIL' | 'UNRESOLVED-FACT' | 'WARN';
  klass: string;
  sentence: string;
  message: string;
}

/** The reader-facing body: HTML comments are internal and are stripped on publish. */
export function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Every HTML comment, joined — where a compression self-report lives. */
export function commentsOf(md: string): string {
  return (md.match(/<!--[\s\S]*?-->/g) ?? []).join('\n');
}

/**
 * The assertion this gate grades. Deliberately narrow: it must claim that NOTHING was lost.
 * "Compressed 5,995 to 5,584 words" alone asserts a count, not a preservation, and is out of scope.
 */
export const NO_LOSS_RE =
  /\b(?:zero|no|0)\s+(?:units?\s+cut\s+whole|units?\s+cut|conclusions?\s+(?:removed|lost|cut|dropped))\b|\bnothing\s+(?:was\s+)?(?:removed|lost|cut)\b/i;

export function assertsNoLoss(v2raw: string): string | null {
  for (const c of (v2raw.match(/<!--[\s\S]*?-->/g) ?? [])) {
    if (NO_LOSS_RE.test(c)) return c;
  }
  return NO_LOSS_RE.test(v2raw) ? v2raw : null;
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9$%.,'" -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function sentences(body: string): string[] {
  return body
    .split('\n')
    .filter(l => !/^\s*(?:#|\||>|```|---)/.test(l))
    .join(' ')
    .split(/(?<=[.?!])\s+(?=[A-Z"“(])/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.split(/\s+/).length >= 6);
}

const CONTENT_STOP = new Set([
  'the','a','an','and','or','but','of','to','in','on','at','by','for','from','with','as','is',
  'was','were','are','be','been','that','this','it','its','which','than','then','so','not','no',
  'their','there','they','you','we','he','she','his','her','has','have','had','will','would',
  'can','could','more','most','less','least','about','into','over','under','after','before',
]);
const words = (s: string): string[] =>
  norm(s)
    .split(/[^a-z0-9$%.]+/)
    .filter(w => w.length > 2 && !CONTENT_STOP.has(w));

/**
 * Sentences present in v1.5 and absent from v2.
 *
 * THE NEAR-DUPLICATE GUARD IS SENTENCE-SCOPED ON PURPOSE, and getting this wrong is the whole
 * difficulty of the check. A first cut asked "do this sentence's content words appear ANYWHERE in
 * v2?" — and in a 5,500-word brief the answer is almost always yes, so it silently swallowed the
 * very sentence the mandate was built on ("The last time the tenor paid more was August 2001, at
 * 5.52 percent…": every one of `tenor`, `auction`, `percent`, `years` survives elsewhere, and the
 * PRECEDENT does not). A removal is the disappearance of a SENTENCE, so the comparison has to be
 * against the best-matching sentence in v2, not against the document's vocabulary.
 */
export function removedSentences(v15body: string, v2body: string): string[] {
  const v2norm = norm(v2body);
  const v2sets = sentences(v2body).map(s => new Set(words(s)));
  const out: string[] = [];
  for (const s of sentences(v15body)) {
    const n = norm(s);
    if (!n || v2norm.includes(n)) continue;
    const ws = words(s);
    if (!ws.length) continue;
    // An Editor REWRITE keeps ≥80% of ONE sentence's content words in ONE surviving sentence.
    // This gate has no opinion about rewrites — only about disappearances.
    let best = 0;
    for (const set of v2sets) {
      const kept = ws.filter(w => set.has(w)).length / ws.length;
      if (kept > best) best = kept;
      if (best >= 0.8) break;
    }
    if (best >= 0.8) continue;
    out.push(s);
  }
  return out;
}

const DENOM_RE =
  /\b(?:against|out of|of)\s+(?:a\s+|an\s+|the\s+)?(?:[a-z]+\s+){0,3}(?:population|base|universe|total|pool|denominator|sample|cohort|installed base)\b/i;
const MECHANISM_RE =
  /\b(?:where|because|so that|which means|meaning that|multiplies|compounds?|compounded|rather than adds|the mechanism|works by)\b/i;
const NAME_STOP = new Set([
  'The','A','An','But','And','So','That','This','It','In','On','At','By','For','From','With','As',
  'If','When','What','Which','Who','No','Not','Every','Each','One','Two','Three','Four','Five',
  'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February',
  'March','April','May','June','July','August','September','October','November','December',
]);
function properTokens(s: string): string[] {
  const out = new Set<string>();
  const ws = s.split(/\s+/);
  for (let i = 0; i < ws.length; i++) {
    const raw = ws[i]!.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!raw || raw.length < 2) continue;
    if (!/^[A-Z][A-Za-z]*(?:-[A-Z][A-Za-z]*)?$/.test(raw)) continue;
    if (NAME_STOP.has(raw)) continue;
    if (i === 0) continue;
    out.add(raw);
  }
  return [...out];
}

/**
 * A CLAUSE-LEVEL LEG, and the reason it exists is worth stating: the 08-16 SAM denominator was cut
 * from INSIDE a sentence that otherwise survived, so a sentence-level diff scores that sentence a
 * rewrite and sees nothing. "2,295 entities, of which 1,530 are small businesses, against a SAM
 * population of roughly 550,000 registrants" became the same sentence minus its base. A share
 * without its denominator is not a smaller claim; it is an unfalsifiable one, and it is precisely
 * the kind of loss a word-count-driven compression reaches for first.
 */
export function lostDenominators(v15body: string, v2body: string): Finding[] {
  const v2n = norm(v2body);
  const out: Finding[] = [];
  const re = new RegExp(DENOM_RE.source + '[^.]{0,80}?', 'gi');
  for (const m of v15body.matchAll(
    /\b(?:against|out of|of)\s+(?:a\s+|an\s+|the\s+)?(?:[a-z]+\s+){0,3}(?:population|base|universe|total|pool|denominator|sample|cohort)\s+of\s+(?:roughly\s+|about\s+|some\s+|nearly\s+)?\**([\d][\d,\.]{3,})/gi
  )) {
    const num = m[1]!.replace(/[.,]$/, '');
    if (v2n.includes(norm(num))) continue;
    out.push({
      kind: 'FAIL',
      klass: 'denominator-removed',
      sentence: m[0].slice(0, 200),
      message: `the denominator (${num}) was removed from a surviving sentence and appears nowhere in v2 — a share without its base is not a smaller claim, it is an unfalsifiable one`,
    });
  }
  void re;
  return out;
}

// ── A CATEGORY QUALIFIER IS NOT CONNECTIVE FAT (added 2026-08-17 — IMP-187, 08-17 mandate #2, RC6) ─
// The gate above has a stated blind spot — "An Editor REWRITE keeps ≥80% of ONE sentence's content
// words … This gate has no opinion about rewrites" — and 08-17 walked straight through it:
//   v1.5: "Four labs AND INSTITUTES disclosed AI containment failures inside three weeks…"
//   v2:   "Four labs disclosed AI containment failures inside three weeks…"
//   Gate 16's own receipt classified the deletion as class (3) "QUALIFIERS AND CONNECTIVE FAT".
// Two words, 97% overlap, therefore a rewrite, therefore invisible. But the unit's own ledger
// enumerates AISI (a government safety institute) + Anthropic + OpenAI ×2 — so "and institutes" was
// the words that made the cardinal TRUE, and the reader-facing body ends up naming ONE organisation
// against a count of four. This is the 08-16 lead-overclaim mandate recurring through the COMPRESSION
// layer instead of the drafting layer, which is exactly why the 08-16 drafting-layer fix could not
// catch it — and it is the second consecutive night of the class (ESC-D).
// A conjunct dropped from a counted noun phrase changes what the number counts. Under length
// pressure that is the cheapest-looking cut on the page and the only one that can turn a true
// sentence false without touching a digit.
const CARDINAL_WORD = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
/** "four labs and institutes", "three banks or insurers" — a cardinal governing a coordination. */
const COUNTED_CONJUNCT_RE = new RegExp(
  String.raw`\b(${CARDINAL_WORD}|\d{1,3})\s+((?:[a-z]{3,}\s+){0,2}[a-z]{3,})\s+(?:and|or)\s+([a-z]{3,})\b`,
  'gi'
);
export function cardinalConjunctCuts(
  v15body: string,
  v2body: string
): Finding[] {
  const v2sents = sentences(v2body);
  const v2sets = v2sents.map(s => new Set(words(s)));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const s of sentences(v15body)) {
    const ws = words(s);
    if (!ws.length) continue;
    const matches = [...s.matchAll(COUNTED_CONJUNCT_RE)];
    if (!matches.length) continue;
    // The SURVIVING counterpart — the same sentence, rewritten. Below 0.55 it is a different
    // sentence and its disappearance is `removedSentences`' business, not this check's.
    let best = -1,
      bestScore = 0;
    for (let i = 0; i < v2sets.length; i++) {
      const kept = ws.filter(w => v2sets[i]!.has(w)).length / ws.length;
      if (kept > bestScore) (bestScore = kept), (best = i);
    }
    if (best < 0 || bestScore < 0.55) continue;
    const survivor = v2sents[best]!;
    const survivorN = norm(survivor);
    for (const m of matches) {
      const cardinal = m[1]!.toLowerCase();
      const head = m[2]!.trim().split(/\s+/).pop()!.toLowerCase();
      const conjunct = m[3]!.toLowerCase();
      // Only when the COUNT SURVIVES and the second category does NOT. A cut that also drops the
      // number is a normal rewrite: it no longer promises anything it cannot pay.
      if (!survivorN.includes(cardinal)) continue;
      if (survivorN.includes(conjunct)) continue;
      const key = `${cardinal}-${head}-${conjunct}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: 'FAIL',
        klass: 'cardinal-conjunct-deleted',
        sentence: s.slice(0, 220),
        message:
          `the compression kept the cardinal "${cardinal}" and deleted the second category it counts ` +
          `("${head} AND ${conjunct}" → "${head}"). A conjunct dropped from a counted noun phrase is a ` +
          `SEMANTIC cut, never "qualifiers and connective fat": it changes what the number counts, and it ` +
          `can turn a true sentence false without touching a digit. Restore the category, or restate the ` +
          `count at the number the narrower noun can actually pay`,
      });
    }
  }
  return out;
}

export function classify(removed: string[], v2body: string): Finding[] {
  const v2n = norm(v2body);
  // MEMBERSHIP, NOT SUBSTRING. A first cut asked `v2n.includes(word)` against the whole document,
  // which made almost nothing ever "lost": "rate" is inside "corporate", "adds" is inside "address".
  // The O-Ring mechanism scored 100% surviving under that test. A word survives when it survives as
  // a WORD.
  const v2words = new Set(words(v2body));
  const v2sentences = sentences(v2body);
  // A hyphenated name ("O-Ring") normalizes into its parts, so survival is tested per PART. Asking
  // `v2words.has('o-ring')` returned false while the phrase was plainly sitting in v2 — which made
  // the mechanism leg unfirable on the exact case it was built for.
  const survivesInV2 = (tok: string): boolean => {
    const parts = words(tok);
    return parts.length > 0 && parts.every(p => v2words.has(p));
  };
  const out: Finding[] = [];
  for (const s of removed) {
    // (a) A DATED PARALLEL — the historical precedent that made the claim non-canonical.
    const years = (s.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) ?? []).filter(
      y => !new RegExp(`\\b${y}\\b`).test(v2n)
    );
    if (years.length) {
      out.push({
        kind: 'FAIL',
        klass: 'dated-parallel-removed',
        sentence: s,
        message: `a dated parallel (${years.join(', ')}) was removed and the year appears nowhere in v2 — the precedent is the reason the claim was not canonical, and it is gone`,
      });
      continue;
    }
    // (b) A DENOMINATOR — a rate without its base is a different number.
    if (DENOM_RE.test(s)) {
      const bigs = (s.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{4,}\b/g) ?? []).filter(
        n => !v2n.includes(norm(n))
      );
      if (bigs.length) {
        out.push({
          kind: 'FAIL',
          klass: 'denominator-removed',
          sentence: s,
          message: `the denominator (${bigs.join(', ')}) was removed while its numerator survives — a share without its base is not a smaller claim, it is an unfalsifiable one`,
        });
        continue;
      }
    }
    // (c) A FRAMEWORK MECHANISM whose NAME survives — the name-drop.
    if (MECHANISM_RE.test(s)) {
      const survivors = properTokens(s).filter(survivesInV2);
      const lost = words(s).filter(w => !v2words.has(w));
      // "REDUCED TO A NAME-DROP", made measurable. A raw count of lost words is the wrong ruler:
      // the real O-Ring case loses only 5 unique content words of 28, because the replacement keeps
      // the memorable half ("quality multiplies rather than adds") and drops the half that does the
      // explaining ("output requires many TASKS", "COMPOUNDED across a long CHAIN", "an ENORMOUS
      // difference"). What actually changed is the LENGTH of the sentence the name now sits in.
      // So: the name survives, its surviving home is materially shorter, and some of the mechanism
      // is gone. A framework you name without its mechanism borrows the authority and skips the work.
      const homeLen = Math.max(
        0,
        ...v2sentences
          .filter(t => survivors.some(n => new RegExp(`\\b${n}\\b`).test(t)))
          .map(t => words(t).length)
      );
      const shrunk = homeLen > 0 && homeLen < 0.6 * words(s).length;
      if (survivors.length && lost.length >= 3 && shrunk) {
        out.push({
          kind: 'FAIL',
          klass: 'mechanism-removed-name-survives',
          sentence: s,
          message: `the mechanism was removed while the name (${survivors.slice(0, 3).join(', ')}) survives in a sentence ${homeLen}/${words(s).length} the length — a framework reduced to a name-drop borrows the authority without doing the work (lost: ${lost.slice(0, 6).join(', ')})`,
        });
        continue;
      }
    }
    // (d) AN ATTRIBUTED SOURCE that vanished — not a FAIL, a question for the morning.
    const gone = properTokens(s).filter(t => !survivesInV2(t));
    if (gone.length && /\b(?:said|says|told|according to|wrote|found|reported|estimates?|comments?|papers?|study|survey)\b/i.test(s)) {
      out.push({
        kind: 'UNRESOLVED-FACT',
        klass: 'attributed-source-removed',
        sentence: s,
        message: `an attributed source (${gone.slice(0, 3).join(', ')}) was removed and appears nowhere in v2 — corroboration is a conclusion's load path`,
      });
    }
  }
  return out;
}

/**
 * THE ESCAPE HATCH. A receipt that names what it cut is silent on that item. Matching is on the
 * finding's own distinctive tokens (years, magnitudes, names) appearing inside the self-report —
 * enumerate the loss and the gate agrees with you.
 */
export function suppressEnumerated(
  findings: Finding[],
  receipt: string
): Finding[] {
  const r = norm(receipt);
  return findings.filter(f => {
    const keys = [
      ...(f.sentence.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) ?? []),
      ...(f.sentence.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? []),
      ...(f.message.match(/\(([^)]+)\)/)?.[1]?.split(/,\s*/) ?? []),
    ]
      .map(k => norm(k))
      .filter(Boolean);
    if (!keys.length) return true;
    return !keys.some(k => r.includes(k));
  });
}

// ── CHECK P — THE PROTECTION CLAIM IS EXECUTED, NOT READ (added 2026-08-17 — IMP-186, RC2) ──────
// 08-17 Critic mandate #3 / ESC-C. The Gate 16 receipt said, in the same block this gate already
// grades one clause further up:
//   "PROTECTED AND VERIFIED PRESENT IN v2: … every scaled sourced figure (7,785.76; … $17.5m; …)"
// and `grep -c "7,785.76" daily-briefs/2026-08-17-v2.md` → 0, `grep -c "17.5"` → 0, while this gate
// exited 0. The reader-facing consequence was a Dashboard Equities entry containing NO PRICE — the
// S&P close the receipt certified as protected is the one that went missing. The word "VERIFIED"
// was doing no work: nothing in this file had ever looked at that list.
//
// A receipt is a claim ABOUT A FILE. Anything in one that cannot be executed against the file is
// not a receipt, it is a sentiment — so this check reports THREE outcomes, not two, and says which:
//   FAIL        a checkable literal is asserted present and is ABSENT from the comment-stripped body
//   UNCHECKABLE a clause with no literal in it ("every unit conclusion") — counted and named, never
//               silently credited; an unfalsifiable clause is the failure mode, not an excuse
//   present     found
const PROTECTED_RE =
  /PROTECTED AND VERIFIED PRESENT IN v2\s*:([^\n]*)/i;
/** A figure we hold to the letter: currency, decimals, comma-thousands, percents, multipliers. */
const FIGURE_RE =
  /^[$£€]?\d[\d,]*(?:\.\d+)?(?:x|%|bn|m|k)?$/i;
const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const DATEISH_RE = new RegExp(`\\d{1,2}[\\d/]*\\s+(?:${MONTHS})`, 'i');

type ProtectedClaim = {
  literal: string;
  checkable: boolean;
  present: boolean;
};

// A FIGURE IS THE SAME FIGURE IN EITHER DRESS (calibrated 2026-08-17, first run of CHECK P).
// The first cut of this check reported SEVEN false protection claims on the 08-17 receipt. Five were
// its own fault: the receipt enumerates figures in compact form ("$635m", "68%/$3.8bn", "3.95x",
// "$500m") while the reader-facing body writes them out ("roughly $635 million", "fell 68 percent to
// $3.8 billion", "3.95 times deposits", "below $500 million"). Those figures were never missing.
// A gate that is wrong five times out of seven does not raise an alarm, it trains the next session
// to skim past it — the Goodhart tax the Proxy Discipline warns about, paid in full on day one.
// So: compare the NUMERIC CORE plus any spelling of its unit, and treat a bare core as sufficient
// only when it is distinctive (≥4 digits — "7,785.76", "141,006"), never for a short one like "68"
// that matches something on every page.
const UNIT_WORDS: Record<string, string[]> = {
  m: ['m', ' million', 'million', 'mn'],
  bn: ['bn', ' billion', 'billion', 'b'],
  k: ['k', ' thousand', 'thousand'],
  x: ['x', ' times', ' x', '-times'],
  '%': ['%', ' percent', ' per cent', 'pct'],
};
export function figureVariants(tok: string): string[] {
  const t = tok.trim();
  const m = t.match(/^([$£€]?)([\d][\d,]*(?:\.\d+)?)\s*(x|%|bn|mn|m|k)?$/i);
  if (!m) return [t];
  const core = m[2]!;
  const unit = (m[3] ?? '').toLowerCase().replace(/^mn$/, 'm');
  const out = [t];
  for (const w of UNIT_WORDS[unit] ?? []) out.push(core + w);
  const digits = core.replace(/\D/g, '').length;
  if (!unit || digits >= 4) out.push(core);
  return out;
}

/** Split the PROTECTED line into the individual things it claims are present. */
export function protectedClaims(v2raw: string): ProtectedClaim[] {
  const line = v2raw.match(PROTECTED_RE)?.[1];
  if (!line) return [];
  const body = stripComments(v2raw);
  const bodyN = norm(body);
  const out: ProtectedClaim[] = [];
  const seen = new Set<string>();
  const push = (literal: string, checkable: boolean, present: boolean) => {
    const key = `${literal}`;
    if (!literal || seen.has(key)) return;
    seen.add(key);
    out.push({ literal, checkable, present });
  };
  // (1) QUOTED STRINGS — a receipt that quotes a conclusion is quoting it verbatim, or lying.
  for (const m of line.matchAll(/[“"]([^”"]{6,})[”"]/g)) {
    const q = m[1]!.trim();
    push(q, true, bodyN.includes(norm(q)));
  }
  // (2) FIGURES AND DATES, from the parenthetical enumerations. Split on ; and , — the receipt's own
  //     separators — then keep only tokens that carry a digit, which is what "literal" means here.
  const stripQuoted = line.replace(/[“"][^”"]*[”"]/g, ' ');
  /** Present iff the figure appears in ANY spelling of itself. */
  const figurePresent = (tok: string): boolean =>
    figureVariants(tok).some(v => bodyN.includes(norm(v)));
  for (const group of stripQuoted.matchAll(/\(([^)]*)\)/g)) {
    // Split on the receipt's own separators — but NEVER on a comma between digits, or "7,785.76"
    // becomes "7" and "785.76" and the gate reports a literal the receipt never wrote.
    for (const rawTok of group[1]!.split(/;|,(?!\d)/)) {
      const tok = rawTok
        .replace(/^\s*(?:and|every|all)\s+/i, '')
        // An INTERNAL UNIT ID is an address, not content. The receipt attributes each protected
        // conclusion to its unit ("M&M-1's …", "AI&T-3's …", "Geo-2's …") and those ids appear
        // nowhere in reader-facing prose by design, so a naive read reported three of them absent.
        .replace(/^\s*(?:[A-Z][A-Za-z&]{0,6}-\d+|Signal \d+|Take|Dashboard)(?:'s)?\s*/, '')
        .trim();
      if (!tok || !/\d/.test(tok)) continue;
      // Compound figures ("3.95x/1.74x", "68%/$3.8bn") are asserted as a unit but survive as
      // parts — accept either, so the gate never manufactures a red over a slash.
      const parts = tok.split('/').map(p => p.trim()).filter(Boolean);
      const isFigure = FIGURE_RE.test(tok) || (parts.length > 1 && parts.every(p => FIGURE_RE.test(p)));
      if (isFigure) {
        push(
          tok,
          true,
          figurePresent(tok) || (parts.length > 1 && parts.every(figurePresent))
        );
      } else if (DATEISH_RE.test(tok)) {
        // TOLERANT, deliberately: "1 Oct 2026" may publish as "1 October 2026". Require the day
        // number and the month's first three letters together, not the receipt's exact spelling.
        const day = tok.match(/\d{1,2}/)?.[0] ?? '';
        const mon = tok.match(new RegExp(MONTHS, 'i'))?.[0]?.slice(0, 3) ?? '';
        const near = new RegExp(`\\b${day}\\b[^.]{0,30}?${mon}|${mon}[^.]{0,30}?\\b${day}\\b`, 'i');
        push(tok, true, near.test(body));
      } else {
        // A DESCRIPTION IS NOT A LITERAL, AND THIS GATE DOES NOT ADJUDICATE DESCRIPTIONS.
        // Calibrated 2026-08-17 against the real receipt: "AI&T-3's 10%/35% sizing test" IS in the
        // body — as "Under 10 percent of that incremental revenue … over 35 percent" — and
        // "16 of 18 strikes" is there as "of eighteen projectile strikes", spelled out. Holding a
        // paraphrase to the letter would have red-failed two claims the brief honoured, and a gate
        // that is wrong about live content gets switched off within the week. So a digit-bearing
        // PHRASE is UNCHECKABLE: reported, counted, never credited as kept. The pressure that
        // creates is the right one — it pushes the receipt toward figures and quotations, which are
        // the only two things a receipt can actually be held to.
        push(tok, false, false);
      }
    }
  }
  // (3) THE PROSE CLAUSES — named, counted, never credited.
  for (const clause of stripQuoted.replace(/\([^)]*\)/g, ' ').split(';')) {
    const c = clause.replace(/\s+/g, ' ').trim().replace(/[.,]$/, '');
    if (c.length < 8 || /\d/.test(c)) continue;
    push(c, false, false);
  }
  return out;
}

export function checkProtectedList(v2raw: string): Finding[] {
  const claims = protectedClaims(v2raw);
  if (!claims.length) return [];
  const out: Finding[] = [];
  for (const c of claims.filter(c => c.checkable && !c.present)) {
    out.push({
      kind: 'FAIL',
      klass: 'protection-claim-false',
      sentence: c.literal,
      message:
        `the receipt certifies "${c.literal}" as PROTECTED AND VERIFIED PRESENT IN v2 and it does not ` +
        `appear in the comment-stripped body — either restore it or strike it from the list. ` +
        `"VERIFIED" is a claim about this file and this is the file`,
    });
  }
  const unchecked = claims.filter(c => !c.checkable);
  if (unchecked.length) {
    out.push({
      kind: 'WARN',
      klass: 'protection-claim-unexecutable',
      sentence: unchecked.map(c => c.literal).join(' | ').slice(0, 200),
      message:
        `${unchecked.length} of ${claims.length} protection claims carry no literal to check ` +
        `(no quote, no figure, no date), so nothing in them can be executed against the file — ` +
        `they are credited as neither kept nor lost`,
    });
  }
  return out;
}

export function auditPair(
  v15raw: string,
  v2raw: string
): { receipt: string | null; findings: Finding[] } {
  const receipt = assertsNoLoss(v2raw);
  if (!receipt) return { receipt: null, findings: [] };
  const v15b = stripComments(v15raw);
  const v2b = stripComments(v2raw);
  const findings = suppressEnumerated(
    [
      ...classify(removedSentences(v15b, v2b), v2b),
      ...lostDenominators(v15b, v2b),
    ],
    receipt
  );
  return { receipt, findings };
}

// ---------------------------------------------------------------------------
function resolvePair(arg: string): { v15: string; v2: string } {
  const d = arg.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!d) throw new Error(`cannot read a brief date out of "${arg}"`);
  const dir = arg.includes('/') ? path.dirname(arg) : 'daily-briefs';
  return {
    v15: path.join(process.cwd(), dir, `${d}-v1.5.md`),
    v2: path.join(process.cwd(), dir, `${d}-v2.md`),
  };
}

function selftest(): number {
  let fails = 0,
    total = 0;
  const assert = (ok: boolean, label: string) => {
    total++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };
  const read = (f: string): string | null => {
    const fp = path.join(process.cwd(), f);
    return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  };

  // ── CHECK P (IMP-186) — the 08-17 mandate's acceptance list, on the real receipt. ──
  const p2 = read('daily-briefs/2026-08-17-v2.md');
  if (p2) {
    const pf = checkProtectedList(p2).filter(f => f.klass === 'protection-claim-false');
    const lits = pf.map(f => f.sentence).sort();
    // DIRECTION 1 — FIRES on exactly the two the Critic found by hand, and on nothing else. The
    // "nothing else" half is load-bearing: the first cut of this check reported SEVEN, five of them
    // figures the brief had honoured in longhand.
    assert(
      lits.length === 2 && lits.includes('7,785.76') && lits.includes('$17.5m'),
      `[IMP-186] FIRES on the real 08-17 receipt for EXACTLY 7,785.76 and $17.5m (got ${lits.length}: ${lits.join(', ') || 'none'})`
    );
    // DIRECTION 2 — struck from the list, the gate goes silent. The mandate's own escape hatch:
    // restore the string to the body, or stop certifying it. Either closes the claim honestly.
    const struck = p2.replace('7,785.76; ', '').replace('$17.5m; ', '');
    assert(
      checkProtectedList(struck).filter(f => f.klass === 'protection-claim-false').length === 0,
      '[IMP-186] SILENT once those two literals are struck from the PROTECTED list'
    );
    // DIRECTION 2b — restored to the BODY, the gate goes silent too.
    const restored = p2.replace(
      /\n## /,
      '\nEquities: the S&P 500 closed at 7,785.76 on Friday; the fund marked $17.5m.\n\n## '
    );
    assert(
      checkProtectedList(restored).filter(f => f.klass === 'protection-claim-false').length === 0,
      '[IMP-186] SILENT once those two literals are restored to the reader-facing body'
    );
    // A figure in longhand is the SAME figure — the calibration that took this from 7 findings to 2.
    assert(
      figureVariants('$635m').some(v => 'roughly $635 million of launch capital'.includes(v)) &&
        figureVariants('68%').some(v => 'deposits fell 68 percent to'.includes(v)) &&
        figureVariants('3.95x').some(v => 'is 3.95 times deposits'.includes(v)),
      '[IMP-186] a compact figure is satisfied by its longhand ($635m ↔ $635 million, 68% ↔ 68 percent, 3.95x ↔ 3.95 times)'
    );
    // …but a short bare core is NOT enough on its own, or the check goes silent on real absences.
    assert(
      !figureVariants('68%').includes('68') && figureVariants('7,785.76').includes('7,785.76'),
      '[IMP-186] a 2-digit core never matches bare (would hit on every page); a distinctive one may'
    );
    // A comma inside a number is not a separator — the bug that reported "785.76".
    assert(
      protectedClaims(p2).some(c => c.literal === '7,785.76') &&
        !protectedClaims(p2).some(c => c.literal === '785.76'),
      '[IMP-186] "7,785.76" is one literal, not "7" and "785.76"'
    );
    // Prose and paraphrase are UNCHECKABLE — named and counted, never credited as kept.
    const unex = checkProtectedList(p2).find(f => f.klass === 'protection-claim-unexecutable');
    assert(
      !!unex && /5 of 28/.test(unex.message),
      `[IMP-186] the unexecutable clauses are counted, not credited (got: ${unex?.message.slice(0, 40) ?? 'none'})`
    );
    // CHECK P does not hide behind the no-loss claim: a receipt can compress honestly and still
    // certify an absent price, which is what 08-17 did.
    const noNoLoss = p2.replace(NO_LOSS_RE, 'compressed 9,334 to 7,879 words');
    assert(
      assertsNoLoss(noNoLoss) === null &&
        checkProtectedList(noNoLoss).filter(f => f.kind === 'FAIL').length === 2,
      '[IMP-186] CHECK P still bites when the v2 makes NO no-loss claim at all'
    );
  } else {
    assert(false, '[IMP-186] 2026-08-17-v2.md must be on disk — CHECK P is asserted against it');
  }

  // ── IMP-187 — the 08-17 mandate #2 conjunct leg, on the real ait_1 diff. ──
  const c15 = read('daily-briefs/2026-08-17-v1.5.md');
  const c2 = read('daily-briefs/2026-08-17-v2.md');
  if (c15 && c2) {
    const cc = cardinalConjunctCuts(stripComments(c15), stripComments(c2));
    assert(
      cc.length === 1 && /labs AND institutes/.test(cc[0]!.message),
      `[IMP-187] FIRES on the real 08-17 ait_1 diff — "Four labs and institutes" → "Four labs" (got ${cc.length})`
    );
    // The BLIND SPOT this closes, stated as an assertion: the same cut is invisible to the
    // removed-sentence check, because 97% of the sentence survived.
    assert(
      !removedSentences(stripComments(c15), stripComments(c2)).some(s =>
        /Four labs and institutes/i.test(s)
      ),
      '[IMP-187] …and removedSentences CANNOT see it (a 2-word cut is a rewrite) — this is the hole'
    );
    // NON-FIRE: measured across 08-13…08-16, four real pairs, zero findings. A cut that also drops
    // the number is a normal rewrite and stays silent; so does a coordination with no cardinal.
    assert(
      cardinalConjunctCuts(
        'Four labs and institutes disclosed containment failures.',
        'Several labs disclosed containment failures.'
      ).length === 0,
      '[IMP-187] SILENT when the compression drops the COUNT too (it no longer promises anything)'
    );
    assert(
      cardinalConjunctCuts(
        'Labs and institutes disclosed containment failures this month.',
        'Labs disclosed containment failures this month.'
      ).length === 0,
      '[IMP-187] SILENT with no cardinal governing the coordination — the number is the whole risk'
    );
    assert(
      cardinalConjunctCuts(
        'Four labs and institutes disclosed containment failures.',
        'Four labs and institutes disclosed containment failures.'
      ).length === 0,
      '[IMP-187] SILENT when nothing was cut'
    );
  } else {
    assert(false, '[IMP-187] the 2026-08-17 v1.5/v2 pair must be on disk');
  }

  // ── The mandate's own acceptance list, on the real files. ──
  const a15 = read('daily-briefs/2026-08-16-v1.5.md');
  const a2 = read('daily-briefs/2026-08-16-v2.md');
  if (a15 && a2) {
    const r = auditPair(a15, a2);
    assert(
      r.receipt !== null,
      '[IMP-182] the 2026-08-16 v2 carries a no-loss compression receipt (the trigger)'
    );
    assert(
      r.findings.length >= 3,
      `[IMP-182] FIRES on the real 08-16 v1.5→v2 pair with ≥3 findings (got ${r.findings.length}: ${r.findings.map(f => f.klass).join(', ')})`
    );
    assert(
      r.findings.some(f => f.klass === 'dated-parallel-removed'),
      "[IMP-182] catches M&M-1's removed dated parallel (the sentence the receipt names as uncuttable)"
    );
    // THE ESCAPE HATCH, proved on a real repair rather than asserted: rewrite the SAME receipt to
    // enumerate what it cut and the gate goes silent on those items.
    const enumerated = a2.replace(
      /with ZERO units cut whole and zero conclusions removed/,
      'with ZERO units cut whole; REMOVED AND NAMED: the August 2001 / 5.52 percent dated parallel in M&M-1, the 550,000 SAM denominator in Signal-2, and the O-Ring mechanism sentence in AI&T-2'
    );
    const after = auditPair(a15, enumerated);
    assert(
      after.findings.length < r.findings.length,
      `[IMP-182] ESCAPE HATCH — a receipt that ENUMERATES its losses is silenced on them (${r.findings.length} → ${after.findings.length})`
    );
  }

  // SILENT on 08-15, whose editor log claims specific rewrites and asserts no no-loss compression.
  const b15 = read('daily-briefs/2026-08-15-v1.5.md');
  const b2 = read('daily-briefs/2026-08-15-v2.md');
  if (b15 && b2) {
    const r = auditPair(b15, b2);
    assert(
      r.receipt === null && r.findings.length === 0,
      `[IMP-182] SILENT on the real 2026-08-15 pair — no no-loss assertion, so nothing to grade (got ${r.findings.length})`
    );
  }

  // NO STORM across every held-out pair the mandate named.
  let storm = 0;
  const stormy: string[] = [];
  for (const d of ['09', '10', '11', '12', '13', '14']) {
    const x = read(`daily-briefs/2026-08-${d}-v1.5.md`);
    const y = read(`daily-briefs/2026-08-${d}-v2.md`);
    if (!x || !y) continue;
    const n = auditPair(x, y).findings.length;
    if (n) stormy.push(`08-${d}:${n}`);
    storm += n;
  }
  assert(
    storm <= 2,
    `[IMP-182] NO STORM across the 08-09…08-14 pairs (${storm} finding(s)${stormy.length ? ` — ${stormy.join(', ')}` : ''}, ceiling 2)`
  );

  // Unit legs — the trigger must be the CLAIM, and a word count is not a claim.
  assert(
    assertsNoLoss('<!-- compressed 5,995 to 5,584 reader-facing words -->') ===
      null,
    '[IMP-182] a bare word-count receipt asserts a count, not a preservation — out of scope'
  );
  assert(
    assertsNoLoss('<!-- ZERO units cut whole and zero conclusions removed -->') !==
      null,
    '[IMP-182] "zero conclusions removed" IS the assertion this gate grades'
  );
  assert(
    removedSentences(
      'The thirty-year auction was suspended for almost five years after 2001.',
      'The thirty-year auction was suspended for roughly five years after 2001.'
    ).length === 0,
    '[IMP-182] an Editor REWRITE that keeps the content words is not a removal'
  );

  console.log(
    `\ncompression-receipt-gate selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ Both directions verified: a no-loss receipt contradicted by its own diff FAILS; a receipt that names what it cut, and every brief that claims nothing, are silent.'
  );
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();
  const warnOnly = argv.includes('--warn-only');
  const target = argv.find(a => !a.startsWith('--'));
  if (!target) {
    console.error(
      'Usage: compression-receipt-gate.ts <YYYY-MM-DD | path/to/YYYY-MM-DD-v2.md> [--warn-only]\n       compression-receipt-gate.ts --selftest'
    );
    return 2;
  }
  let pair;
  try {
    pair = resolvePair(target);
  } catch (e) {
    console.error(`FAIL: ${(e as Error).message}`);
    return 2;
  }
  if (!fs.existsSync(pair.v15) || !fs.existsSync(pair.v2)) {
    console.log(
      `compression-receipt-gate — no v1.5/v2 pair on disk for ${target}; nothing to diff.`
    );
    return 0;
  }
  const v2raw = fs.readFileSync(pair.v2, 'utf8');
  const { receipt, findings: lossFindings } = auditPair(
    fs.readFileSync(pair.v15, 'utf8'),
    v2raw
  );
  // CHECK P runs on its OWN claim (IMP-186). It must NOT sit behind the no-loss early return: the
  // PROTECTED list is a separate assertion, and a v2 that compresses honestly ("11 units cut") can
  // still certify an absent price — which is exactly what 08-17 did.
  const protectedFindings = checkProtectedList(v2raw);
  // IMP-187 also runs UNCONDITIONALLY: a conjunct cut from a counted noun phrase is false whether or
  // not the receipt claims anything, and it must not be dodgeable by omitting the no-loss sentence.
  const conjunctFindings = cardinalConjunctCuts(
    stripComments(fs.readFileSync(pair.v15, 'utf8')),
    stripComments(v2raw)
  );
  const findings = [...lossFindings, ...protectedFindings, ...conjunctFindings];
  if (!receipt && !protectedFindings.length && !conjunctFindings.length) {
    console.log(
      `compression-receipt-gate — ${path.basename(pair.v2)} makes no no-loss compression claim. SILENT (compressing hard is legal; only the claim is graded).`
    );
    return 0;
  }
  const hard = findings.filter(f => f.kind === 'FAIL');
  console.log(
    `compression-receipt-gate — ${path.basename(pair.v15)} → ${path.basename(pair.v2)} · ${findings.length} finding(s) · ${hard.length} FAIL`
  );
  for (const f of findings) {
    console.error(
      `  ${f.kind === 'FAIL' ? '✗' : '⚠'} [${f.klass}] ${f.message}\n      "${f.sentence.slice(0, 190)}${f.sentence.length > 190 ? '…' : ''}"`
    );
  }
  if (hard.length && !warnOnly) {
    if (protectedFindings.some(f => f.kind === 'FAIL'))
      console.error(
        '\n✗ CHECK P — THE PROTECTION CLAIM IS FALSE. The receipt lists strings as "VERIFIED PRESENT IN v2" ' +
          'that are not in v2. A receipt is a claim about a file; if it cannot be executed against the file it ' +
          'does not belong in one. Restore the string to the body, or strike it from the list — not both, not neither.'
      );
    console.error(
      '\n✗ COMPRESSION RECEIPT FAILED — v2 asserts a no-loss compression that its own diff contradicts. ' +
        'Run the diff or do not make the claim: naming what you removed is ALWAYS legal; asserting you removed ' +
        'nothing is legal only after the diff agrees. Rewrite the receipt to enumerate these losses, or restore them.'
    );
    return 1;
  }
  if (!findings.length)
    console.log('\n✓ The no-loss receipt agrees with its own diff.');
  else if (warnOnly)
    console.log('\n! --warn-only: findings reported, exit forced to 0.');
  return 0;
}

// Only run as a CLI. Without this guard, importing any exported helper (the selftest of another
// gate, a future harness) executes main() and exits the importing process with a usage banner —
// the same guard fact-gate.ts and validate-brief.ts already carry.
const invokedDirectly =
  !!process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('compression-receipt-gate.ts');
if (invokedDirectly) process.exit(main());
