#!/usr/bin/env node
/**
 * dashboard-math-gate — proves the dashboard price math bites on the classes that shipped
 * wrong on 2026-07-27 and stays silent on healthy series.
 *
 * The shipped failures (ground-truthed):
 *   IWF 1Y served −73.13% vs real +6.6% — 4:1 split on 2026-04-29, raw-close history.
 *   SMH 1Y served +94.99% vs real ~+88% — gap at the year-ago boundary, baseline landed weeks early.
 *   DXY "YoY" 0.18 — a vs-yesterday number mislabeled (fixed in the routes, not covered here).
 *
 * Run: npx tsx scripts/dashboard-math-gate.ts   (exit 0/1)
 */

import {
  calculateChangesChecked,
  detectScaleBreaks,
  backAdjustScaleBreaks,
  seriesFromYahooChart,
  mergeLatestIntoSeries,
  calculateMAs,
  recomputeChangesFromLive,
  type PriceSeries,
} from '../lib/dashboard-math';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n      ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Weekday (Mon-Fri) dates from start to end inclusive, YYYY-MM-DD. */
function weekdays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  const stop = new Date(end + 'T00:00:00Z');
  while (d <= stop) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

console.log('── 1. Healthy series: correct 1Y, silent tripwires ──');
{
  const dates = weekdays('2025-07-24', '2026-07-24');
  const prices = dates.map((_, i) => 100 * (1 + (0.20 * i) / (dates.length - 1))); // smooth +20%
  const r = calculateChangesChecked(dates, prices);
  check('1Y ≈ +20 on a smooth +20% year', Math.abs((r.changes['1Y'] ?? 0) - 20) < 1.0, `got ${r.changes['1Y']}`);
  check('no stale baselines on gap-free data', r.staleBaselines.length === 0, r.staleBaselines.join(','));
  check('no scale breaks on smooth data', detectScaleBreaks({ dates, prices }).length === 0);
}

console.log('── 2. The IWF class: 4:1 split in a raw-close series ──');
{
  const dates = weekdays('2025-07-24', '2026-07-24');
  const splitIdx = dates.findIndex(d => d >= '2026-04-29');
  const prices = dates.map((_, i) => (i < splitIdx ? 434 : 108.5 + (8 * (i - splitIdx)) / (dates.length - splitIdx)));
  const series: PriceSeries = { dates, prices };
  const raw = calculateChangesChecked(dates, prices);
  check('raw split-broken series reproduces the shipped −73% class', (raw.changes['1Y'] ?? 0) < -70, `got ${raw.changes['1Y']}`);
  const breaks = detectScaleBreaks(series);
  check('tripwire DETECTS the 4:1 cliff (so the route refuses to publish)', breaks.length === 1 && breaks[0]!.ratio > 3.5, JSON.stringify(breaks));
  check('MA window over the cliff is also detected (blended-scale MAs never ship)', detectScaleBreaks({ dates: dates.slice(-200), prices: prices.slice(-200) }).length === 1);
  // The fix: an ADJUSTED series is continuous — no break, sane 1Y.
  const adjPrices = dates.map((_, i) => (434 / 4) * (1 + (0.065 * i) / (dates.length - 1)));
  const adj = calculateChangesChecked(dates, adjPrices);
  check('adjusted series: no breaks, 1Y ≈ +6.5', detectScaleBreaks({ dates, prices: adjPrices }).length === 0 && Math.abs((adj.changes['1Y'] ?? 0) - 6.5) < 1.0, `got ${adj.changes['1Y']}`);
}

console.log('── 3. The SMH class: gap at the year-ago boundary ──');
{
  const all = weekdays('2025-05-01', '2026-07-24');
  // Hole from 2025-06-20 through 2025-08-10 — the 1Y target (2025-07-24) falls inside it.
  const dates = all.filter(d => d < '2025-06-20' || d > '2025-08-10');
  const prices = dates.map((_, i) => 280 + (260 * i) / (dates.length - 1));
  const r = calculateChangesChecked(dates, prices);
  check('1Y baseline inside a data hole is flagged STALE, not published', r.staleBaselines.includes('1Y'), `stale=${r.staleBaselines.join(',')} changes=${JSON.stringify(r.changes)}`);
  check('1M/1D unaffected by the old gap', r.changes['1M'] != null && r.changes['1D'] != null);
}

console.log('── 4. Yahoo chart parsing prefers ADJUSTED close ──');
{
  const result = {
    timestamp: [1753324800, 1753411200, 1753497600], // 2025-07-24..26-ish UTC
    indicators: {
      quote: [{ close: [434.0, 436.0, 438.0] }],          // raw (pre-split scale)
      adjclose: [{ adjclose: [108.5, 109.0, 109.5] }],    // adjusted (real scale)
    },
    meta: { exchangeTimezoneName: 'America/New_York' },
  };
  const s = seriesFromYahooChart(result);
  check('adjclose preferred over raw close', s.prices.every(p => p < 200), JSON.stringify(s.prices));
  check('bar count preserved', s.prices.length === 3);
}

console.log('── 5. Latest-quote merge ──');
{
  const base: PriceSeries = { dates: ['2026-07-23', '2026-07-24'], prices: [100, 101] };
  const replaced = mergeLatestIntoSeries(base, 102, '2026-07-24');
  check('same-day quote replaces the last bar', replaced.prices[1] === 102 && replaced.prices.length === 2);
  const appended = mergeLatestIntoSeries(base, 103, '2026-07-27');
  check('new-day quote appends', appended.prices.length === 3 && appended.dates[2] === '2026-07-27');
  const stale = mergeLatestIntoSeries(base, 99, '2026-07-22');
  check('older quote never rewrites history', stale.prices.length === 2 && stale.prices[1] === 101);
}

console.log('── 7. The 2026-07-28 window-edge class: first bar lands AFTER the 1Y target ──');
{
  // Exactly the live failure: series fetched Tue morning starts Mon 2025-07-28; the latest
  // equity bar is Mon 2026-07-27; the 1Y target (Sun 2025-07-27) precedes the first bar.
  const dates = weekdays('2025-07-28', '2026-07-27');
  const prices = dates.map((_, i) => 100 * (1 + (0.20 * i) / (dates.length - 1)));
  const r = calculateChangesChecked(dates, prices);
  check('1Y PRESENT via the earliest-bar rule (was: silently missing)', r.changes['1Y'] != null && Math.abs(r.changes['1Y']! - 20) < 1.0, `got ${r.changes['1Y']}`);
  check('window-edge baseline is not flagged stale', !r.staleBaselines.includes('1Y'), r.staleBaselines.join(','));
  // Both directions: a window starting WEEKS after the target must still omit, never fabricate.
  const lateDates = weekdays('2025-08-21', '2026-07-27');
  const latePrices = lateDates.map((_, i) => 100 + i * 0.05);
  const late = calculateChangesChecked(lateDates, latePrices);
  check('first bar 25 days after target → 1Y omitted, not fabricated', late.changes['1Y'] == null, `got ${late.changes['1Y']}`);
}

console.log('── 6. MAs unchanged on healthy data ──');
{
  const prices = Array.from({ length: 210 }, (_, i) => 100 + i * 0.1);
  const mas = calculateMAs(prices);
  check('50D/200D computed', mas['50D'] != null && mas['200D'] != null);
  check('50D of a rising series sits below the latest', mas['50D']! < prices[prices.length - 1]!);
}

console.log('── 8. The NATGAS class: futures roll cliff — continuous proxy publishes horizons ──');
{
  // NG=F continuous front-month cliff (live: 2026-01-29 ×1.904). Tripwire must still fire
  // on the raw futures series; the fix is UNG for % changes, NOT raising maxJumpRatio.
  const dates = weekdays('2025-07-24', '2026-07-24');
  const cliffIdx = dates.findIndex(d => d >= '2026-01-29');
  const ngPrices = dates.map((_, i) => (i < cliffIdx ? 4.8 : 2.5 + (0.2 * (i - cliffIdx)) / Math.max(1, dates.length - cliffIdx)));
  const ngBreaks = detectScaleBreaks({ dates, prices: ngPrices });
  check('NG=F-like roll cliff is DETECTED (threshold stays 1.5)', ngBreaks.length === 1 && ngBreaks[0]!.ratio > 1.5, JSON.stringify(ngBreaks));
  // Continuous proxy (UNG-class): no cliff → 5D/1M/1Y all present.
  const ungPrices = dates.map((_, i) => 14 * (1 + (0.10 * i) / (dates.length - 1)));
  const ungBreaks = detectScaleBreaks({ dates, prices: ungPrices });
  const ung = calculateChangesChecked(dates, ungPrices);
  check('UNG-like continuous series: no scale breaks', ungBreaks.length === 0);
  check('UNG-like continuous series: 5D/1M/1Y all publish', ung.changes['5D'] != null && ung.changes['1M'] != null && ung.changes['1Y'] != null, JSON.stringify(ung.changes));
  // Both directions: never merge futures dollars into the ETF series (instant invented cliff).
  const mixed = mergeLatestIntoSeries({ dates: dates.slice(0, -1), prices: ungPrices.slice(0, -1) }, ngPrices[ngPrices.length - 1]!, dates[dates.length - 1]!);
  check('mixing NG=F spot into UNG series creates a DETECTABLE break (caller must merge proxy quote)', detectScaleBreaks(mixed).length >= 1);

  // MAs: raw NG=F 200D window crosses the roll → withheld; Panama back-adjust clears it
  // so 200D/200W publish in current-contract units (spot stays NG=F; % stays UNG).
  const ngSeries = { dates, prices: ngPrices };
  const raw200 = { dates: dates.slice(-200), prices: ngPrices.slice(-200) };
  check('raw NG=F 200D MA window still trips', detectScaleBreaks(raw200).length === 1);
  const adj = backAdjustScaleBreaks(ngSeries);
  check('back-adjust clears NG=F roll cliffs', detectScaleBreaks(adj).length === 0);
  const adjMas = calculateMAs(adj.prices);
  check('back-adjusted NG=F publishes 50D and 200D MAs', adjMas['50D'] != null && adjMas['200D'] != null, JSON.stringify(adjMas));
  check('back-adjust preserves latest (current contract) price', adj.prices[adj.prices.length - 1] === ngPrices[ngPrices.length - 1]);
}

console.log('── 9. Live merge: multi-day % must move with live price (2026-07-29) ──');
{
  // The shipped failure: SMH live ~$504 with frozen morning 1Y +82.3% (Jul 28 snapshot)
  // while (504.22 − adj₁ᵧ) / adj₁ᵧ ≈ +72.68%. Frozen snapshot % next to a new price MUST fail.
  const baselines = { '1D': 500, '5D': 490, '1M': 450, '1Y': 291.4 }; // 504.22 vs 291.4 ≈ +72.99%
  const frozen1Y = 82.3; // what the old mergeChanges left on screen
  const live = 504.22;
  const recomputed = recomputeChangesFromLive(live, baselines, { prevClose: 500 });
  check('1Y recomputed from live + baseline ≈ +73 (not frozen +82)', Math.abs((recomputed['1Y'] ?? 0) - 72.99) < 0.5, `got ${recomputed['1Y']}`);
  check('frozen snapshot 1Y next to moved live price is the FAIL class', Math.abs(frozen1Y - (recomputed['1Y'] ?? 0)) > 5);
  check('5D and 1M also move with live price', recomputed['5D'] != null && recomputed['1M'] != null);
  check('1D prefers live prevClose over stored 1D baseline', recomputed['1D'] === roundPct(live, 500), `got ${recomputed['1D']}`);
  // Both directions: missing baseline → omit, never invent.
  const partial = recomputeChangesFromLive(live, { '1D': 500, '1Y': 291.4 });
  check('missing 5D/1M baselines are omitted, not fabricated', partial['5D'] == null && partial['1M'] == null && partial['1Y'] != null);
  // calculateChangesChecked must expose baselines for the snapshot to store.
  const dates = weekdays('2025-07-24', '2026-07-24');
  const prices = dates.map((_, i) => 100 * (1 + (0.20 * i) / (dates.length - 1)));
  const r = calculateChangesChecked(dates, prices);
  check('calculateChangesChecked returns baselines for every published horizon', Object.keys(r.changes).every(k => r.baselines[k] != null && r.baselines[k]! > 0));
  const fromBaselines = recomputeChangesFromLive(prices[prices.length - 1]!, r.baselines);
  check('recompute from stored baselines matches snapshot changes', Object.keys(r.changes).every(k => Math.abs((fromBaselines[k] ?? 0) - r.changes[k]!) < 0.02), JSON.stringify({ snap: r.changes, live: fromBaselines }));
}

function roundPct(live: number, baseline: number): number {
  return Math.round(((live - baseline) / baseline) * 10000) / 100;
}

console.log('── 10. 5D = 5 trading sessions (Yahoo), not 7 calendar days ──');
{
  // Normal midweek: cal-7 and td-5 often coincide — not a proof. Holiday weeks diverge.
  // MLK week 2026: latest Fri Jan 23; cal-7 → Jan 16; 5 sessions → Jan 15 (Jan 19 closed).
  const dates = weekdays('2026-01-02', '2026-01-23').filter(d => d !== '2026-01-19');
  const prices = dates.map((_, i) => 100 + i); // distinct per bar so baselines differ
  const r = calculateChangesChecked(dates, prices);
  const latestIdx = dates.length - 1;
  const td5Idx = latestIdx - 5;
  check('5D baseline is exactly 5 sessions back (not calendar-7)', r.baselines['5D'] === prices[td5Idx], `base=${r.baselines['5D']} expected=${prices[td5Idx]} @ ${dates[td5Idx]}`);
  check('calendar-7 would have picked a DIFFERENT bar this holiday week', dates[td5Idx] !== '2026-01-16', `td5date=${dates[td5Idx]}`);
  // Crypto-shaped series (every calendar day): 5 tradingDays ≈ 5 calendar days.
  const cryptoDates: string[] = [];
  const d0 = new Date('2026-07-01T00:00:00Z');
  for (let i = 0; i < 40; i++) {
    const x = new Date(d0); x.setUTCDate(d0.getUTCDate() + i);
    cryptoDates.push(x.toISOString().slice(0, 10));
  }
  const cryptoPrices = cryptoDates.map((_, i) => 1000 + i);
  const cr = calculateChangesChecked(cryptoDates, cryptoPrices);
  const cLatest = cryptoDates.length - 1;
  check('crypto 5D = 5 daily bars back (24/7 series)', cr.baselines['5D'] === cryptoPrices[cLatest - 5], `base=${cr.baselines['5D']} @ expected idx ${cLatest - 5}`);
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASS' : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
