#!/usr/bin/env node
/**
 * dashboard-price-audit — run the FIXED snapshot data path (adjusted 1y series + tripwires)
 * for every tracked asset and print the % changes it would publish. Use it to eyeball the
 * dashboard against any independent source, and to prove a fix before the 6 AM cron runs.
 *
 * Born 2026-07-27: the dashboard served IWF 1Y = −73% (real +6%, 4:1 split unadjusted in
 * raw-close history) and SMH 1Y = +95% (real ~+88%, gap at the year-ago baseline). This
 * tool exits 1 if ANY asset trips a scale break, a stale baseline, or fails to parse —
 * the classes that shipped those numbers.
 *
 * Run (needs normal internet — Yahoo blocks some datacenter IPs):
 *   npx tsx scripts/dashboard-price-audit.ts            # all assets
 *   npx tsx scripts/dashboard-price-audit.ts SMH IWF    # subset
 */

import {
  calculateChangesChecked,
  detectScaleBreaks,
  seriesFromYahooChart,
  mergeLatestIntoSeries,
} from '../lib/dashboard-math';

// Mirrors ASSETS in app/api/dashboard/snapshot/route.ts (primary symbols only — the audit
// checks the primary path; fallbacks are exercised by the route itself).
const ASSETS: Record<string, { yahoo: string; crypto?: boolean }> = {
  SPX: { yahoo: '%5EGSPC' }, NDX: { yahoo: '%5ENDX' }, DJI: { yahoo: '%5EDJI' }, RUT: { yahoo: '%5ERUT' },
  IGV: { yahoo: 'IGV' }, SMH: { yahoo: 'SMH' }, IWF: { yahoo: 'IWF' }, IWD: { yahoo: 'IWD' },
  XLE: { yahoo: 'XLE' }, ARKK: { yahoo: 'ARKK' },
  BTC: { yahoo: 'BTC-USD', crypto: true }, ETH: { yahoo: 'ETH-USD', crypto: true },
  SOL: { yahoo: 'SOL-USD', crypto: true }, AAVE: { yahoo: 'AAVE-USD', crypto: true },
  UNI: { yahoo: 'UNI7083-USD', crypto: true }, LINK: { yahoo: 'LINK-USD', crypto: true },
  GOLD: { yahoo: 'GC%3DF' }, SILVER: { yahoo: 'SI%3DF' }, BRENT: { yahoo: 'BZ%3DF' },
  COPPER: { yahoo: 'HG%3DF' }, NATGAS: { yahoo: 'NG%3DF' },
  US10Y: { yahoo: '%5ETNX' }, DXY: { yahoo: 'DX-Y.NYB' },
};

async function fetchSeries(symbol: string, crypto: boolean) {
  // range=2y — same window as the snapshot route (a 1y window's first bar can land AFTER
  // the pre-close 1Y target and the horizon vanishes; 2026-07-28).
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y&events=div%7Csplit`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('no chart result');
  const meta = result.meta;
  const series = seriesFromYahooChart(result, { crypto });
  let tradingDate: string | null = null;
  if (meta?.regularMarketTime) {
    tradingDate = new Intl.DateTimeFormat('en-CA', { timeZone: crypto ? 'UTC' : meta?.exchangeTimezoneName || 'America/New_York' }).format(new Date(meta.regularMarketTime * 1000));
  }
  return { series, price: meta?.regularMarketPrice as number, tradingDate };
}

(async () => {
  const only = process.argv.slice(2).map(s => s.toUpperCase());
  const names = Object.keys(ASSETS).filter(n => only.length === 0 || only.includes(n));
  let fails = 0;

  console.log('asset   price        1D       5D       1M       1Y      bars  flags');
  for (const name of names) {
    const a = ASSETS[name]!;
    try {
      const { series, price, tradingDate } = await fetchSeries(a.yahoo, !!a.crypto);
      const merged = mergeLatestIntoSeries(series, price, tradingDate);
      const breaks = detectScaleBreaks(merged, a.crypto ? 1.6 : 1.5);
      const r = calculateChangesChecked(merged.dates, merged.prices);
      const flags: string[] = [];
      if (breaks.length) { flags.push(`SCALE-BREAK[${breaks.map(b => `${b.date}×${b.ratio}`).join(',')}]`); fails++; }
      if (r.staleBaselines.length) { flags.push(`STALE[${r.staleBaselines.join(',')}]`); fails++; }
      const f = (v?: number) => (v == null ? '     —' : String(v).padStart(6));
      console.log(
        `${name.padEnd(7)} ${String(price).padStart(9)}  ${f(r.changes['1D'])}%  ${f(r.changes['5D'])}%  ${f(r.changes['1M'])}%  ${f(r.changes['1Y'])}%   ${String(merged.prices.length).padStart(4)}  ${flags.join(' ') || 'ok'}`,
      );
    } catch (err) {
      console.log(`${name.padEnd(7)} FETCH FAILED: ${err instanceof Error ? err.message : err}`);
      fails++;
    }
    await new Promise(res => setTimeout(res, 350));
  }

  console.log(fails ? `\n✗ ${fails} problem(s) — do not trust the affected rows` : '\n✅ all assets clean (no scale breaks, no stale baselines)');
  process.exit(fails ? 1 : 0);
})();
