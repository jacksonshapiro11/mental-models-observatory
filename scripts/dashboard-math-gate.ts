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
  seriesFromYahooChart,
  mergeLatestIntoSeries,
  calculateMAs,
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

console.log('── 6. MAs unchanged on healthy data ──');
{
  const prices = Array.from({ length: 210 }, (_, i) => 100 + i * 0.1);
  const mas = calculateMAs(prices);
  check('50D/200D computed', mas['50D'] != null && mas['200D'] != null);
  check('50D of a rising series sits below the latest', mas['50D']! < prices[prices.length - 1]!);
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASS' : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
