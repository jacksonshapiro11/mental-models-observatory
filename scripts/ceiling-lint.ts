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

interface Flag { check: string; where: string; message: string }

// ---------- structure extraction ----------
function introOf(brief: string): string {
  // The intro = the LAST italic paragraph before the first section marker (---, # ▸, ## ▸).
  // (The Life Note is also italic but sits earlier; taking the last italic block gets the intro.)
  const head = brief.split(/^(?:---|#\s*▸|##\s*▸)/m)[0];
  const italics = head.split(/\n\s*\n/).map(p => p.trim())
    .filter(p => /^\*[^*].*\*$/s.test(p) && p.length > 60);
  return italics.length ? italics[italics.length - 1] : '';
}

interface Bullet { section: string; text: string }
function sixBullets(brief: string): Bullet[] {
  const m = brief.match(/^#\s*▸\s*THE SIX\s*$([\s\S]*?)(?=^##\s+The Wild Card|^#\s*▸)/m);
  if (!m) return [];
  const region = m[1];
  const bullets: Bullet[] = [];
  let section = '';
  for (const line of region.split('\n')) {
    const h = line.match(/^##\s+(.+)/);
    if (h) { section = h[1].trim(); continue; }
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
const PREVIEW_RE = /\b(we(?:'|’)ll cover|we will cover|coming up|in this brief|today we(?:'|’)ll|today we will|below,? we|let(?:'|’)s dive|read on for)\b/i;
function checkPreviewPadding(intro: string): Flag | null {
  const m = intro.match(PREVIEW_RE);
  if (!m) return null;
  return { check: 'intro-preview-padding', where: 'Intro Summary', message: `Intro contains preview padding ("${m[0]}") — the payoff intro states the conclusion; it never announces the menu.` };
}

const WATCH_RE = /\b(watch|the tell\b|to confirm\b|resolves?\b|would confirm|next (?:session|week|month)|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow)\b/i;
function checkWatchMissing(intro: string): Flag | null {
  if (!intro) return null;
  if (WATCH_RE.test(intro)) return null;
  return { check: 'intro-watch-missing', where: 'Intro Summary', message: `Intro has no watch line — the payoff ends on one observable that advances or resolves the conclusion (dated when possible). Add it from the day's strongest resolvable thread.` };
}

const LABEL_RE = /\b(the through[- ]?line\s*:|the theme\s*:|the pattern\s*:|the common thread\b|the takeaway\s*:)/i;
function checkThroughlineLabel(intro: string): Flag | null {
  const m = intro.match(LABEL_RE);
  if (!m) return null;
  return { check: 'intro-throughline-label', where: 'Intro Summary', message: `Intro announces a label ("${m[0].trim()}") instead of stating the conclusion directly — the THEME counterfeit's signature. State the mechanism/tension itself ("BECAUSE X… / A and B are arguing over C"), not the fact that one exists.` };
}

function hasNonDateNumeral(text: string): boolean {
  // Strip pure years, "July 10"-style dates, ordinal dates, and time-of-day.
  const stripped = text
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ');
  return /\d/.test(stripped);
}
function checkNumberPresence(bullets: Bullet[], take: string): Flag[] {
  const flags: Flag[] = [];
  bullets.forEach((b, i) => {
    if (!hasNonDateNumeral(b.text)) {
      flags.push({ check: 'number-presence', where: `${b.section} bullet ${i + 1}`, message: `Six bullet carries zero non-date numerals ("${b.text.slice(2, 60)}…") — every Take/Six bullet needs ≥1 number that isn't a date (the pricing/magnitude rung's floor).` });
    }
  });
  if (take.trim() && !hasNonDateNumeral(take)) {
    flags.push({ check: 'number-presence', where: 'The Take', message: 'The Take carries zero non-date numerals — the mechanism needs at least one magnitude.' });
  }
  return flags;
}

const SIGNIF_RE = /\b(this matters|the significance)\b/gi;
const CAUSAL_RE = /\b(because|drives?|drove|forces?|forced|so that|which means|implies|implying|since|therefore|→)\b/i;
function checkHollowSignificance(body: string): Flag[] {
  const flags: Flag[] = [];
  let m: RegExpExecArray | null;
  while ((m = SIGNIF_RE.exec(body)) !== null) {
    const tail = body.slice(m.index, m.index + 160); // ~15 words of lookahead
    if (!CAUSAL_RE.test(tail)) {
      flags.push({ check: 'hollow-significance', where: `…${body.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')}…`, message: `"${m[0]}" with no causal connector within ~15 words — significance must be shown (because/drives/forces/which means), never announced.` });
    }
  }
  return flags;
}

function fourGrams(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 15);
  const grams = new Set<string>();
  for (let i = 0; i + 4 <= words.length; i++) grams.add(words.slice(i, i + 4).join(' '));
  return grams;
}
function checkThematicEcho(bullets: Bullet[]): Flag[] {
  const flags: Flag[] = [];
  for (let i = 0; i < bullets.length; i++) {
    for (let j = i + 1; j < bullets.length; j++) {
      const a = fourGrams(bullets[i].text); const b = fourGrams(bullets[j].text);
      let shared = 0; for (const g of a) if (b.has(g)) shared++;
      if (shared >= 2) {
        flags.push({ check: 'thematic-echo', where: `${bullets[i].section} × ${bullets[j].section}`, message: `Two Six bullets open on the same phrasing (${shared} shared 4-grams) — the noun-swapped meta-sentence is the one-note counterfeit. Each bullet leads with its OWN thesis.` });
      }
    }
  }
  return flags;
}

function lint(brief: string): Flag[] {
  const intro = introOf(brief);
  const bullets = sixBullets(brief);
  const take = takeBody(brief);
  const flags: Flag[] = [];
  const pv = checkPreviewPadding(intro); if (pv) flags.push(pv);
  const wm = checkWatchMissing(intro); if (wm) flags.push(wm);
  const tl = checkThroughlineLabel(intro); if (tl) flags.push(tl);
  flags.push(...checkNumberPresence(bullets, take));
  flags.push(...checkHollowSignificance(brief));
  flags.push(...checkThematicEcho(bullets));
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

- **SK Hynix priced its ADS at $149 with demand at seven times the offering, raising roughly 28 billion dollars.** The oversubscription implies dollar-denominated access to HBM supply commands a premium above the arbitrage cost.

## AI & Tech

- **OpenAI moved GPT-5.6 Sol to general availability at 750 tokens per second alongside two cheaper tiers.** The three-tier menu forces customers to self-sort downward, which means volume revenue detaches from the frontier.

## Geopolitics

- **CENTCOM struck roughly 90 targets and Iran answered with 10 ballistic missiles at Al-Azraq.** Jordan's obligation to respond drives a third-party variable neither capital calibrated for.

---

## The Wild Card

- **A detection algorithm built for Mars found 73 undocumented calderas on the seafloor.**

# ▸ THE TAKE

**Yield-Contingent Demand.** Securitize fell roughly 35 percent from its debut because core tokenization revenue was flat at about $11 million while the acquired lines drove the headline, which means the category's demand curve tracks the front-end yield, not adoption.
`;

function selftest(): number {
  const badFlags = lint(BAD_FIXTURE);
  const cleanFlags = lint(CLEAN_FIXTURE);
  const expectBad = ['intro-preview-padding', 'intro-watch-missing', 'intro-throughline-label', 'number-presence', 'hollow-significance', 'thematic-echo'];
  let fails = 0;
  for (const check of expectBad) {
    const fired = badFlags.some(f => f.check === check);
    console.log(`  ${fired ? 'PASS' : 'FAIL'} — ${check} fires on the rigged bad brief`);
    if (!fired) fails++;
  }
  const cleanOk = cleanFlags.length === 0;
  console.log(`  ${cleanOk ? 'PASS' : 'FAIL'} — zero flags on the payoff-grade clean brief${cleanOk ? '' : ` (got: ${cleanFlags.map(f => f.check).join(', ')})`}`);
  if (!cleanOk) fails++;
  console.log(`\nceiling-lint selftest — ${expectBad.length + 1 - fails}/${expectBad.length + 1} assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED — a lint check no longer bites both directions.'); return 1; }
  console.log('✓ All 6 lint checks verified in both directions.');
  return 0;
}

function main() {
  if (process.argv.slice(2).includes('--selftest')) process.exit(selftest());
  const briefArg = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!briefArg) { console.error('Usage: ceiling-lint.ts <brief.md> | --selftest'); process.exit(2); }
  const p = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(p)) { console.error(`File not found: ${p}`); process.exit(2); }
  const flags = lint(fs.readFileSync(p, 'utf8'));
  console.log(`ceiling-lint — ${path.basename(p)} — ${flags.length} FLAG${flags.length === 1 ? '' : 's'}`);
  for (const f of flags) console.log(`  ⚠ [${f.check}] ${f.where}: ${f.message}`);
  console.log(`\n✅ CEILING-LINT PASS${flags.length ? ' (flags advisory — QG/Editor act on them; the brief always ships)' : ' (clean)'}`);
  process.exit(0);
}

main();
