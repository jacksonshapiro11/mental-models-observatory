#!/usr/bin/env node --experimental-strip-types
/**
 * selfheal-verification-gate.ts — A SELF-HEAL MAY NOT INVENT A PRICED FACT.
 * (IMP-077, 2026-07-20. Closes the 07-20 Critic mandate #3 / the RC2 half of E-WRITER-TRUTH-01.)
 *
 * WORKED FAILURE. On 2026-07-20 the Critic ran an Editor pass on v1.5 (a SELF-HEAL) and, in doing
 * so, INTRODUCED specifics that were not in v1.5 and were never web-verified:
 *   Geo-1  v1.5: "The Zircon is Russia's most expensive conventional weapon ... spending six in a
 *                single night is a burn rate the stockpile cannot sustain"   (NO unit cost)
 *   Geo-1  v2  : "Each costs an estimated $5 million; spending ten ... is roughly a $50 million
 *                expenditure ..."                                            (unit cost INVENTED)
 * Plus a Nokia prototype count in the Model. The Critic could only emit `UNRESOLVED-FACT`; the
 * morning gate caught both by READING (a human backstop). fact-gate knows prices, superlatives,
 * event-dates, aggregates and relative-dates but has NO notion of a weapon/hardware UNIT COST, so
 * "Each costs an estimated $X" is load-bearing, trivially fabricable, and was ungated. The Critic:
 * "A self-heal that introduces unverified claims is not a self-heal; it is a new source of error."
 *
 * THE PRIMITIVE (RC2): a self-heal has no web-verification budget, so it must not introduce a
 * PRICED SPECIFIC (a unit cost / per-unit magnitude / derived expenditure) that v1.5 did not carry
 * unless that magnitude is either (a) resolved in {DATE}-truth.json, or (b) named in a Critic
 * `UNRESOLVED-FACT:` line so the Morning Truth Gate must resolve it. A new priced specific that is
 * NEITHER verified NOR flagged rode to the reader as a fact nobody checked -> FAIL.
 *
 * Scope is deliberately the low-noise unit-cost fingerprint (a money magnitude sitting next to
 * cost/costs/apiece/each/per/expenditure), NOT a full v1.5->v2 number diff — the Dashboard and
 * carried figures ($47B Anthropic, $30M Kimi, $400M Citadel: present in BOTH files) never trip it,
 * so the operator is handed the real fabrication risk, not a worklist of non-claims (IMP-042/045).
 *
 * Usage: node --experimental-strip-types scripts/selfheal-verification-gate.ts <DATE>
 *        node --experimental-strip-types scripts/selfheal-verification-gate.ts --v15 a.md --v2 b.md --critic c.md --truth t.json
 *        node --experimental-strip-types scripts/selfheal-verification-gate.ts --selftest
 * Exit: 0 no unverified new priced specific · 1 a self-heal invented one · 2 usage/parse error
 */
import * as fs from 'fs';
import * as path from 'path';

const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:million|billion|trillion|bn|m)\b/gi;
const COST_CUE =
  /(each|per\s+\w+|apiece|a\s+piece|expenditure|costs?\b|priced)/i;

export interface PricedClaim {
  token: string;
  window: string;
  entities: string[];
}

/** Priced-specificity claims = a money magnitude with a unit-cost cue within ~120 chars. */
export function pricedClaims(text: string): PricedClaim[] {
  const out: PricedClaim[] = [];
  const t = text.replace(/\s+/g, ' ');
  for (const m of t.matchAll(MONEY)) {
    const i = m.index ?? 0;
    const window = t.slice(Math.max(0, i - 120), Math.min(t.length, i + 120));
    if (!COST_CUE.test(window)) continue;
    const entities = [...window.matchAll(/\b[A-Z][a-zA-Z]{4,}\b/g)]
      .map(e => e[0])
      .filter(
        w =>
          !/^(Each|Russia|Every|These|Their|While|Where|About|Under|After|Which)$/.test(
            w
          )
      );
    out.push({
      token: m[0].replace(/\s+/g, ' ').trim(),
      window: window.trim(),
      entities,
    });
  }
  return out;
}

/** UNRESOLVED-FACT text from a Critic report (only the flag lines, not the whole report). */
function unresolvedFactText(criticMd: string): string {
  return criticMd
    .split('\n')
    .filter(l => /UNRESOLVED-FACT/i.test(l))
    .join('\n');
}

function moneyTokensIn(text: string): Set<string> {
  return new Set(
    [...text.replace(/\s+/g, ' ').matchAll(MONEY)].map(m =>
      m[0].replace(/\s+/g, ' ').trim().toLowerCase()
    )
  );
}

export interface Finding {
  token: string;
  window: string;
  reason: string;
}

/**
 * A new priced specific FAILs when it is in v2, absent from v1.5, and NEITHER
 * resolved in truth NOR named in a Critic UNRESOLVED-FACT line.
 */
export function unverifiedNewPricedClaims(
  v15: string,
  v2: string,
  criticMd: string,
  truthJson: string
): Finding[] {
  const v15Money = moneyTokensIn(v15);
  const uf = unresolvedFactText(criticMd);
  const ufLower = uf.toLowerCase();
  const ufFlagsCostClass =
    /each costs|unit cost|costs an estimated|per (?:unit|missile|weapon)|apiece/i.test(
      uf
    );
  const truth = truthJson.toLowerCase();
  const findings: Finding[] = [];
  for (const claim of pricedClaims(v2)) {
    const tok = claim.token.toLowerCase();
    if (v15Money.has(tok)) continue; // carried from v1.5 — not introduced by the pass
    const verified = truth.includes(tok);
    const flaggedByEntity = claim.entities.some(e =>
      ufLower.includes(e.toLowerCase())
    );
    const flagged = ufFlagsCostClass || flaggedByEntity;
    if (!verified && !flagged) {
      findings.push({
        token: claim.token,
        window: claim.window,
        reason: `NEW priced specific "${claim.token}" appears in v2 but not v1.5, is not resolved in truth.json, and is not named in any Critic UNRESOLVED-FACT line. A self-heal/editor pass invented a unit cost the reader will take as fact. Verify it against a primary source (write it to {DATE}-truth.json) or mark it UNRESOLVED-FACT so the Morning Truth Gate must resolve it — never ship an unchecked magnitude.`,
      });
    }
  }
  return findings;
}

function readOr(p: string | undefined): string {
  return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function runOnDate(root: string, date: string): number {
  const v15 = readOr(path.join(root, `daily-briefs/${date}-v1.5.md`));
  const v2 = readOr(path.join(root, `daily-briefs/${date}-v2.md`));
  const critic = readOr(path.join(root, `daily-briefs/${date}-critic.md`));
  const truth = readOr(path.join(root, `daily-briefs/${date}-truth.json`));
  if (!v2) {
    console.error(`FAIL: no v2 on disk for ${date}`);
    return 2;
  }
  if (!v15) {
    console.log(
      `selfheal-verification-gate — ${date}: no v1.5 (not a self-heal/two-stage night); nothing to diff.`
    );
    return 0;
  }
  const findings = unverifiedNewPricedClaims(v15, v2, critic, truth);
  console.log(
    `selfheal-verification-gate — ${date}: ${findings.length} unverified new priced specific(s)`
  );
  for (const f of findings)
    console.error(`  ✗ ${f.reason}\n     context: …${f.window}…`);
  return findings.length ? 1 : 0;
}

function selftest(): number {
  const root = process.cwd();

  // (1) Synthetic FIRES: a self-heal invents a unit cost nobody flagged or verified.
  const synV15 =
    "Geopolitics. The Sarmat is Russia's heaviest ICBM, deployed in small numbers.";
  const synV2 =
    "Geopolitics. The Sarmat is Russia's heaviest ICBM. Each costs an estimated $9 million apiece, so a six-strike night is a $54 million expenditure.";
  const synCriticNoFlag =
    '## Phase 2\nSection ratings look fine. No unresolved items.';
  const fires = unverifiedNewPricedClaims(synV15, synV2, synCriticNoFlag, '{}');
  const okFires = fires.some(f => /\$9 million/i.test(f.token));

  // (2) Same claim, but the Critic FLAGGED it -> gate SILENT (the safety net worked).
  const synCriticFlag =
    'UNRESOLVED-FACT: Geo-1: "Each costs an estimated $9 million" — Sarmat unit cost added during self-heal without source verification.';
  const okSilentWhenFlagged =
    unverifiedNewPricedClaims(synV15, synV2, synCriticFlag, '{}').length === 0;

  // (3) A single new priced specific RESOLVED in truth.json -> gate SILENT.
  //     (synV2 above carries TWO magnitudes; isolate the truth-verified path with one so the test
  //      proves the truth leg, not the second-magnitude catch that (1) already proves.)
  const synV2one =
    "Geopolitics. The Sarmat is Russia's heaviest ICBM. Each costs an estimated $9 million apiece.";
  const okSilentWhenVerified =
    unverifiedNewPricedClaims(
      synV15,
      synV2one,
      synCriticNoFlag,
      '{"claims":[{"text":"$9 million Sarmat unit cost","status":"resolved"}]}'
    ).length === 0;

  // (4) A carried figure (present in BOTH v1.5 and v2) is never "introduced" -> SILENT, no noise.
  const carriedV15 =
    'AI. Anthropic is on track for roughly $47 billion in revenue.';
  const carriedV2 =
    'AI. Anthropic is on track for roughly $47 billion in revenue, its listing bid underway.';
  const okNoNoiseCarried =
    unverifiedNewPricedClaims(carriedV15, carriedV2, '', '{}').length === 0;

  // (5) A new magnitude with NO cost cue (e.g., a valuation) is out of scope -> SILENT.
  const valV2 = 'AI. The round valued the venue at about $20 billion.';
  const okNoNoiseValuation =
    unverifiedNewPricedClaims('AI. A funding round closed.', valV2, '', '{}')
      .length === 0;

  // (6) THE REAL 07-20 ARTIFACTS: the self-heal invented the Zircon unit cost, and the Critic
  // FLAGGED it (UNRESOLVED-FACT) / the morning gate resolved it -> the gate must be SILENT on the
  // caught case (it fires only when the net FAILS).
  let okReal = true;
  const v15p = path.join(root, 'daily-briefs/2026-07-20-v1.5.md');
  const v2p = path.join(root, 'daily-briefs/2026-07-20-v2.md');
  const crp = path.join(root, 'daily-briefs/2026-07-20-critic.md');
  const trp = path.join(root, 'daily-briefs/2026-07-20-truth.json');
  if (fs.existsSync(v15p) && fs.existsSync(v2p)) {
    const real = unverifiedNewPricedClaims(
      fs.readFileSync(v15p, 'utf8'),
      fs.readFileSync(v2p, 'utf8'),
      readOr(crp),
      readOr(trp)
    );
    okReal = real.length === 0; // Zircon $5M/$50M were flagged by the Critic + resolved by morning
    // And prove the fingerprint IS detected in the real v2 (so silence is "flagged", not "blind"):
    const detected = pricedClaims(fs.readFileSync(v2p, 'utf8')).some(c =>
      /\$5 million|\$50 million/i.test(c.token)
    );
    okReal = okReal && detected;
  }

  console.log('selfheal-verification-gate --selftest');
  console.log(
    `  FIRES on a self-heal that invents an unflagged, unverified unit cost: ${okFires ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT when the Critic flagged it UNRESOLVED-FACT: ${okSilentWhenFlagged ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT when truth.json resolved it: ${okSilentWhenVerified ? '✓' : '✗'}`
  );
  console.log(
    `  no noise on a figure carried from v1.5: ${okNoNoiseCarried ? '✓' : '✗'}`
  );
  console.log(
    `  out of scope: a magnitude with no cost cue (valuation): ${okNoNoiseValuation ? '✓' : '✗'}`
  );
  console.log(
    `  real 07-20: fingerprint detected AND silent (Critic-flagged + morning-resolved): ${okReal ? '✓' : '✗'}`
  );

  const ok =
    okFires &&
    okSilentWhenFlagged &&
    okSilentWhenVerified &&
    okNoNoiseCarried &&
    okNoNoiseValuation &&
    okReal;
  if (ok) {
    console.log(
      '\n✅ SELFTEST PASS — a self-heal that invents a priced fact now FAILs unless it is verified or flagged for the morning gate.'
    );
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  return 1;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const flag = (n: string) => {
    const i = args.indexOf(n);
    return i > -1 ? args[i + 1] : undefined;
  };
  if (flag('--v2')) {
    const findings = unverifiedNewPricedClaims(
      readOr(flag('--v15')),
      readOr(flag('--v2')),
      readOr(flag('--critic')),
      readOr(flag('--truth'))
    );
    console.log(
      `selfheal-verification-gate — ${findings.length} unverified new priced specific(s)`
    );
    for (const f of findings)
      console.error(`  ✗ ${f.reason}\n     context: …${f.window}…`);
    return findings.length ? 1 : 0;
  }
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error(
      'usage: selfheal-verification-gate.ts <DATE> | --v15 a --v2 b --critic c --truth t | --selftest'
    );
    return 2;
  }
  return runOnDate(process.cwd(), date);
}

process.exit(main());
