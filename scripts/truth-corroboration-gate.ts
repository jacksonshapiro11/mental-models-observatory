#!/usr/bin/env node --experimental-strip-types
/**
 * truth-corroboration-gate.ts — EXTRAORDINARY-CLAIM CORROBORATION guard
 * (NEW 2026-07-29 — IMP-107; the 07-29 Critic's mandate #3, RC2).
 *
 * WORKED FAILURE (the receipt): the 07-29 brief's strongest section (AI&T-1, the analytical
 * spine and the payoff's MECHANISM anchor) rested on "$182 billion in IG bonds, up more than
 * 1,300% year-over-year, about 15% of total US corporate IG supply." The Critic flagged it
 * (mandate #3): "extraordinary quantitative assertions ... if the 1,300% is wrong, the synthesis
 * collapses." The Morning Truth Gate marked it VERIFIED and PUBLISHED it — but against a SINGLE
 * source (one Benzinga URL). A from-scratch cross-check on 07-29 could NOT independently
 * corroborate the exact figure: mainstream sources carried adjacent-but-different numbers
 * ($159B / +47% for a five-company / five-month basket; $244B by mid-2026; +11.8% aggregate IG
 * growth). The claim may well be right on a specific six-company 2026 basket — but a load-bearing
 * "+1,300%" resolved on ONE source is exactly the truth-precision risk the Critic named, and the
 * kind of extraordinary multiplier that demands corroboration, not a single citation.
 *
 * THE RULE (a truth FLOOR, proxy-discipline-exempt — mechanize same-day): a truth.json claim that
 * is BOTH (a) EXTRAORDINARY — an increase/change of >=300% (a >=4x multiplier), OR a "N% of
 * (all|total|the entire) ... (issuance|supply|market|debt|bonds|economy|GDP)" share-of-national-
 * whole superlative — AND (b) marked resolved:true, MUST cite >=2 distinct source URLs. A single
 * source is SINGLE-SOURCE-EXTRAORDINARY: the Morning Truth Gate must add a second independent
 * corroborating source (or downgrade the figure to what two sources agree on) before resolved:true.
 *
 * This is NARROW BY DESIGN — it does NOT demand two sources for ordinary claims. A normal price
 * (S&P +0.21% on one CNBC cite), a 20% or 47% YoY, an ordinary earnings result: all SILENT. Only a
 * genuinely extraordinary, load-bearing magnitude trips it. Record/all-time-high superlatives are
 * OWNED by fact-gate's archive-superlative check, so they are deliberately NOT re-triggered here
 * (no double-jeopardy, no over-firing).
 *
 * ADVISORY, exit 0 always (the brief already shipped; this raises resolution QUALITY, it never
 * blocks): SELF-CLEARS the instant a second source URL is added to the claim. Wired into:
 * Morning_Updater Step 4m (the truth gate seeks the 2nd source), Pipeline_Controller morning gate
 * (spot check), daily pipeline-health-check.
 *
 * Usage:
 *   node --experimental-strip-types scripts/truth-corroboration-gate.ts <truth.json | YYYY-MM-DD>
 *   node --experimental-strip-types scripts/truth-corroboration-gate.ts --selftest
 *
 * Exit: 0 always (advisory), except --selftest failure (1) / usage (2).
 */
import * as fs from 'fs';
import * as path from 'path';

interface Claim {
  value?: string;
  source?: string;
  resolved?: boolean;
  [k: string]: unknown;
}
interface TruthFile {
  date?: string;
  claims?: Record<string, Claim>;
}
interface Warn {
  key: string;
  reason: string;
  sources: number;
  excerpt: string;
}

// ---------- extraordinary-magnitude detection ----------
// (a) An increase/change of >=300% — a >=4x multiplier. Commas stripped so "1,300%" reads 1300.
//     The number must be immediately bound to % / percent (never a bare "$1,300").
const PCT_RE = /\b(\d{3,}(?:\.\d+)?)\s*(?:%|percent\b)/gi;
function hasExtraordinaryMultiplier(value: string): boolean {
  const stripped = value.replace(/,/g, '');
  let m: RegExpExecArray | null;
  PCT_RE.lastIndex = 0;
  while ((m = PCT_RE.exec(stripped)) !== null) {
    if (parseFloat(m[1]) >= 300) return true;
  }
  return false;
}
// (b) A share-of-national-whole superlative: "15% of total US corporate IG supply",
//     "15% of all US corporate bond issuance", "a fifth of the entire ... market".
const SHARE_RE =
  /\b\d{1,3}(?:\.\d+)?\s*(?:%|percent)\s+of\s+(?:all|total|the total|the entire|every)\b[^.]*\b(issuance|supply|market|debt|bonds?|economy|gdp|lending|deposits?|reserves?)\b/i;
function hasShareOfWhole(value: string): boolean {
  return SHARE_RE.test(value);
}

function isExtraordinary(value: string): boolean {
  return hasExtraordinaryMultiplier(value) || hasShareOfWhole(value);
}

// ---------- source counting ----------
// truth.json's `source` is a single string today; a corroborated claim carries >=2 URLs
// (space / comma / semicolon / newline separated). Count distinct http(s) URLs.
function countSources(source: string | undefined): number {
  if (!source) return 0;
  const urls = source.match(/https?:\/\/[^\s,;)"']+/gi) || [];
  return new Set(urls.map(u => u.replace(/[.,;]+$/, ''))).size;
}

// ---------- the gate ----------
export function scan(truth: TruthFile): Warn[] {
  const warns: Warn[] = [];
  const claims = truth.claims || {};
  for (const [key, c] of Object.entries(claims)) {
    const value = String(c.value ?? '');
    if (!value) continue;
    // Only claims the gate resolved as TRUE are load-bearing on the reader; an unresolved claim
    // is already blocked upstream by fact-gate --require-resolved.
    if (c.resolved !== true) continue;
    if (!isExtraordinary(value)) continue;
    const n = countSources(c.source);
    if (n < 2) {
      warns.push({
        key,
        reason: hasExtraordinaryMultiplier(value)
          ? 'extraordinary multiplier (>=300% change)'
          : 'share-of-national-whole superlative',
        sources: n,
        excerpt: value.slice(0, 140),
      });
    }
  }
  return warns;
}

function resolveTruthPath(arg: string): string {
  if (arg.endsWith('.json'))
    return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  // a bare YYYY-MM-DD
  return path.join(process.cwd(), 'daily-briefs', `${arg}-truth.json`);
}

// ---------- selftest ----------
// The REAL 07-29 shape (the $182B / +1,300% / 15% single-source claim) must FIRE; a two-source
// version must be SILENT; an ordinary single-source price/YoY must be SILENT.
const FIXTURE_BAD: TruthFile = {
  date: '2026-07-29',
  claims: {
    'yoy:ai-giants-ig-bonds': {
      value:
        'Six hyperscalers issued a COMBINED ~$182 billion of IG bonds in 2026, a ~1,300% increase from the prior year and ~15% of all US corporate bond issuance YTD. Brief VERIFIED.',
      resolved: true,
      source:
        'https://www.benzinga.com/markets/equities/26/07/60490919/big-techs-182-billion-ai-debt-spree',
    },
    sp500: {
      value: 'S&P 500 CLOSED +0.21% to 7,428.78 on Tuesday. Brief VERIFIED.',
      resolved: true,
      source:
        'https://www.cnbc.com/2026/07/27/stock-market-today-live-updates.html',
    },
  },
};
const FIXTURE_GOOD: TruthFile = {
  date: '2026-07-29',
  claims: {
    // same extraordinary claim, now corroborated by a SECOND independent source -> SILENT
    'yoy:ai-giants-ig-bonds': {
      value:
        'Six hyperscalers issued a COMBINED ~$182 billion of IG bonds in 2026, a ~1,300% increase and ~15% of all US corporate bond issuance YTD.',
      resolved: true,
      source:
        'https://www.benzinga.com/... https://www.bloomberg.com/news/big-tech-ig-supply',
    },
    // a share-of-whole superlative, two sources -> SILENT
    'aggregate:tokenized-treasuries': {
      value:
        'On-chain tokenized Treasuries reached 22% of the total tokenized-RWA market.',
      resolved: true,
      source: 'https://rwa.xyz/a ; https://dune.com/b',
    },
    // an ORDINARY YoY (47%), one source -> SILENT (below the 300% bar)
    'yoy:hyperscaler-5mo': {
      value:
        'Five cloud firms sold $159 billion of bonds in the first five months, 47% more than a year earlier.',
      resolved: true,
      source: 'https://cryptobriefing.com/ai-hyperscalers-159b-debt-issuance/',
    },
    // an UNRESOLVED extraordinary claim -> SILENT here (fact-gate --require-resolved owns it)
    'yoy:speculative': {
      value: 'A startup claims 900% growth.',
      resolved: false,
      source: 'https://example.com/one',
    },
  },
};

function selftest(): number {
  let fails = 0;
  const bad = scan(FIXTURE_BAD);
  const firesOn182 = bad.some(
    w => w.key === 'yoy:ai-giants-ig-bonds' && w.sources < 2
  );
  console.log(
    `  ${firesOn182 ? 'PASS' : 'FAIL'} — FIRES on the real 07-29 $182B/+1,300%/15% single-source claim`
  );
  if (!firesOn182) fails++;

  const spared = !bad.some(w => w.key === 'sp500');
  console.log(
    `  ${spared ? 'PASS' : 'FAIL'} — SILENT on an ordinary single-source price (S&P +0.21%)`
  );
  if (!spared) fails++;

  const good = scan(FIXTURE_GOOD);
  const silentTwoSource = !good.some(w => w.key === 'yoy:ai-giants-ig-bonds');
  console.log(
    `  ${silentTwoSource ? 'PASS' : 'FAIL'} — SILENT once the extraordinary claim carries a 2nd source (self-clears)`
  );
  if (!silentTwoSource) fails++;

  const silentShareTwo = !good.some(
    w => w.key === 'aggregate:tokenized-treasuries'
  );
  console.log(
    `  ${silentShareTwo ? 'PASS' : 'FAIL'} — SILENT on a share-of-whole superlative with 2 sources`
  );
  if (!silentShareTwo) fails++;

  const silentOrdinaryYoy = !good.some(w => w.key === 'yoy:hyperscaler-5mo');
  console.log(
    `  ${silentOrdinaryYoy ? 'PASS' : 'FAIL'} — SILENT on an ordinary 47% YoY (below the >=300% bar)`
  );
  if (!silentOrdinaryYoy) fails++;

  const silentUnresolved = !good.some(w => w.key === 'yoy:speculative');
  console.log(
    `  ${silentUnresolved ? 'PASS' : 'FAIL'} — SILENT on an UNRESOLVED extraordinary claim (fact-gate --require-resolved owns it)`
  );
  if (!silentUnresolved) fails++;

  // direct predicate checks
  const p1 = isExtraordinary('up more than 1,300% year-over-year') === true;
  const p2 =
    isExtraordinary('about 15% of total US corporate IG supply') === true;
  const p3 = isExtraordinary('rose 47% from a year earlier') === false;
  const p4 = isExtraordinary('the stock fell 8 percent') === false;
  for (const [ok, label] of [
    [p1, '"1,300%" is extraordinary'],
    [p2, '"15% of total US IG supply" is extraordinary'],
    [p3, '"47%" is NOT extraordinary'],
    [p4, '"fell 8 percent" is NOT extraordinary'],
  ] as [boolean, string][]) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — predicate: ${label}`);
    if (!ok) fails++;
  }

  const total = 10;
  console.log(
    `\ntruth-corroboration-gate selftest — ${total - fails}/${total} assertions passed`
  );
  if (fails) {
    console.error(
      '✗ SELFTEST FAILED — the extraordinary-claim corroboration guard no longer bites both directions.'
    );
    return 1;
  }
  console.log(
    '✓ Extraordinary-claim corroboration guard verified in both directions.'
  );
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selftest());
  const arg = args.find(a => !a.startsWith('--'));
  if (!arg) {
    console.error(
      'Usage: truth-corroboration-gate.ts <truth.json | YYYY-MM-DD> | --selftest'
    );
    process.exit(2);
  }
  const p = resolveTruthPath(arg);
  if (!fs.existsSync(p)) {
    console.error(`Truth file not found: ${p}`);
    process.exit(2);
  }
  let truth: TruthFile;
  try {
    truth = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Could not parse ${p}: ${(e as Error).message}`);
    process.exit(2);
  }
  const warns = scan(truth);
  console.log(
    `truth-corroboration-gate — ${path.basename(p)} — ${warns.length} SINGLE-SOURCE-EXTRAORDINARY warning${warns.length === 1 ? '' : 's'}`
  );
  for (const w of warns) {
    console.log(
      `  ⚠ SINGLE-SOURCE-EXTRAORDINARY [${w.key}] (${w.reason}, ${w.sources} source${w.sources === 1 ? '' : 's'}): "${w.excerpt}…" — add a 2nd independent corroborating source before resolved:true, or downgrade the figure to what two sources agree on.`
    );
  }
  console.log(
    `\n✅ TRUTH-CORROBORATION ${warns.length ? 'OK — advisory (brief always ships); the morning gate must source the flagged claim(s) twice' : 'CLEAN — every extraordinary resolved claim carries >=2 sources'}.`
  );
  process.exit(0);
}

main();
