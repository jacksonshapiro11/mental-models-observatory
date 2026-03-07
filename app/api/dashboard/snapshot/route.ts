/**
 * /api/dashboard/snapshot — App Router
 *
 * GET: Runs ONCE per day at 6 AM ET via cron. Fetches 400 days of history,
 * calculates MAs and reference prices, writes to Upstash, appends to price history.
 *
 * PATCH: Manual field updates (FedWatch, ETF flows) during evening session.
 *
 * Protected by SNAPSHOT_SECRET header or query param.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  writeSnapshot,
  writeManualFields,
  writePriceHistory,
  type DashboardSnapshot,
} from '@/lib/upstash';
import { calculateDXY } from '@/lib/dxy';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY!;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY!;
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET!;

const TIMEOUT = 8000;

const PERIODS: Record<string, number> = { '1D': 1, '5D': 5, '1M': 30, '1Y': 365 };
const MA_PERIODS: Record<string, number> = { '50D': 50, '200D': 200, '200W': 1400 };

// ─── AUTH HELPER ─────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  return secret === SNAPSHOT_SECRET;
}

// ─── GET: Full Snapshot Regeneration ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await generateSnapshot();
    await writeSnapshot(snapshot);

    const today = new Date().toISOString().slice(0, 10);
    await writePriceHistory(today, snapshot);

    return NextResponse.json({
      ok: true,
      date: today,
      assets:
        Object.keys(snapshot.equities || {}).length +
        Object.keys(snapshot.crypto || {}).length +
        Object.keys(snapshot.commodities || {}).length,
      errors: snapshot.errors,
    });
  } catch (err) {
    console.error('Snapshot generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Manual Field Update ──────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const allowed = ['fedWatch', 'etfFlows', 'fedFunds', 'notes'] as const;
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) filtered[key] = body[key];
    }
    const result = await writeManualFields(filtered);
    return NextResponse.json({ ok: true, fields: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 }
    );
  }
}

// ─── SNAPSHOT GENERATION ─────────────────────────────────────────────────────

async function generateSnapshot(): Promise<DashboardSnapshot> {
  const now = Date.now();
  const results = await Promise.allSettled([
    fetchEquityHistory(),
    fetchCryptoHistory(),
    fetchCommodities(),
    fetchRates(),
    fetchForexForDXY(),
    fetchFearGreed(),
  ]);

  const [equityResult, cryptoResult, commodityResult, rateResult, forexResult, fgResult] = results;

  return {
    generatedAt: now,
    date: new Date().toISOString().slice(0, 10),
    equities: equityResult.status === 'fulfilled' ? equityResult.value : {},
    crypto: cryptoResult.status === 'fulfilled' ? cryptoResult.value : {},
    commodities: commodityResult.status === 'fulfilled' ? commodityResult.value : {},
    rates: rateResult.status === 'fulfilled' ? rateResult.value : {},
    dxy: forexResult.status === 'fulfilled' ? forexResult.value : null,
    fearGreed: fgResult.status === 'fulfilled' ? fgResult.value : null,
    errors: results
      .map((r, i) => r.status === 'rejected' ? { index: i, error: r.reason?.message || 'Unknown' } : null)
      .filter((e): e is { index: number; error: string } => e !== null),
  };
}

// ─── ETF-TO-INDEX MULTIPLIER CALIBRATION ─────────────────────────────────────
// Hardcoded multipliers drift over time (QQQ×43.5 was off by 6%).
// We auto-calibrate daily by fetching actual index levels from Yahoo Finance
// and comparing to ETF prices. Falls back to last known good multipliers.

const DEFAULT_MULTIPLIERS: Record<string, number> = { SPY: 10, QQQ: 40.95, DIA: 100, IGV: 1, SMH: 1, IWM: 1, IWF: 1, IWD: 1, XLE: 1, ARKK: 1 };

async function calibrateMultipliers(): Promise<Record<string, number>> {
  const indices = [
    { etf: 'SPY', yahoo: '%5EGSPC' },  // ^GSPC (S&P 500)
    { etf: 'QQQ', yahoo: '%5ENDX' },   // ^NDX (Nasdaq 100)
    { etf: 'DIA', yahoo: '%5EDJI' },   // ^DJI (Dow Jones)
    // IGV and SMH are tracked at ETF price directly (multiplier = 1), no calibration needed
  ];

  const multipliers = { ...DEFAULT_MULTIPLIERS };

  try {
    // Fetch current ETF prices from Finnhub
    const etfPrices: Record<string, number> = {};
    for (const { etf } of indices) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${etf}&token=${FINNHUB_KEY}`;
      const res = await fetchWithTimeout(url, 4000);
      const data = await res.json();
      if (data.c > 0) etfPrices[etf] = data.c;
    }

    // Fetch actual index levels from Yahoo Finance (unofficial but stable)
    for (const { etf, yahoo } of indices) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?interval=1d&range=1d`;
        const res = await fetchWithTimeout(url, 4000);
        const data = await res.json();
        const indexPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        const etfPrice = etfPrices[etf];

        if (indexPrice > 0 && etfPrice != null && etfPrice > 0) {
          multipliers[etf] = round(indexPrice / etfPrice, 4);
          console.log(`Calibrated ${etf} multiplier: ${multipliers[etf]} (index=${indexPrice}, etf=${etfPrice})`);
        }
      } catch (err) {
        console.warn(`Yahoo calibration for ${etf} failed, using default:`, err);
      }
    }
  } catch (err) {
    console.warn('Multiplier calibration failed, using defaults:', err);
  }

  return multipliers;
}

// ─── EQUITY HISTORY (Finnhub candles for SPY, QQQ, DIA) ─────────────────────

async function fetchEquityHistory() {
  // Auto-calibrate multipliers from actual index levels
  const multipliers = await calibrateMultipliers();

  const etfs = [
    { symbol: 'SPY', name: 'SPX', multiplier: multipliers.SPY ?? 10 },
    { symbol: 'QQQ', name: 'NDX', multiplier: multipliers.QQQ ?? 40.95 },
    { symbol: 'DIA', name: 'DJI', multiplier: multipliers.DIA ?? 100 },
    { symbol: 'IGV', name: 'IGV', multiplier: 1 },   // SaaS/Software ETF — tracks at ETF price
    { symbol: 'SMH', name: 'SMH', multiplier: 1 },   // Semiconductor ETF — tracks at ETF price
    { symbol: 'IWM', name: 'IWM', multiplier: 1 },   // Russell 2000 (small cap risk appetite)
    { symbol: 'IWF', name: 'IWF', multiplier: 1 },   // Russell 1000 Growth
    { symbol: 'IWD', name: 'IWD', multiplier: 1 },   // Russell 1000 Value
    { symbol: 'XLE', name: 'XLE', multiplier: 1 },   // Energy Select SPDR (Iran/oil thesis)
    { symbol: 'ARKK', name: 'ARKK', multiplier: 1 }, // ARK Innovation (speculative tech proxy)
  ];

  const to = Math.floor(Date.now() / 1000);
  const from = to - 400 * 86400;

  const results: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number>; multiplier: number }> = {};

  for (const etf of etfs) {
    try {
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${etf.symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      const data = await res.json();

      if (data.s !== 'ok' || !data.c || data.c.length < 50) {
        console.warn(`Finnhub candle ${etf.symbol}: insufficient data`);
        continue;
      }

      const closes = data.c.map((p: number) => p * etf.multiplier);
      const latest = closes[closes.length - 1];

      results[etf.name] = {
        latestClose: round(latest, 0),
        changes: calculateChanges(closes),
        mas: calculateMAs(closes),
        multiplier: etf.multiplier, // Store so live endpoint can use it
      };
    } catch (err) {
      console.warn(`Equity history ${etf.symbol} failed:`, err);
    }
  }

  return results;
}

// ─── CRYPTO HISTORY (CoinGecko market_chart) ─────────────────────────────────

async function fetchCryptoHistory() {
  const coins = [
    { id: 'bitcoin', name: 'BTC' },
    { id: 'ethereum', name: 'ETH' },
    { id: 'solana', name: 'SOL' },
    { id: 'aave', name: 'AAVE' },
    { id: 'uniswap', name: 'UNI' },
    { id: 'chainlink', name: 'LINK' },
  ];

  const results: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number> }> = {};

  for (const coin of coins) {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=400&x_cg_demo_key=${COINGECKO_KEY}`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      const data = await res.json();

      if (!data.prices || data.prices.length < 50) {
        console.warn(`CoinGecko ${coin.id}: insufficient data`);
        continue;
      }

      const closes = data.prices.map(([, price]: [number, number]) => price);
      const latest = closes[closes.length - 1];

      results[coin.name] = {
        latestClose: round(latest, 2),
        changes: calculateChanges(closes),
        mas: calculateMAs(closes),
      };
    } catch (err) {
      console.warn(`Crypto history ${coin.id} failed:`, err);
    }

    // Small delay between CoinGecko calls to avoid rate limiting
    await sleep(200);
  }

  return results;
}

// ─── COMMODITIES (Alpha Vantage: Gold, Silver, Brent) ────────────────────────

async function fetchCommodities() {
  const commodities = [
    { function: 'GOLD', name: 'GOLD' },
    { function: 'SILVER', name: 'SILVER' },
    { function: 'BRENT', name: 'BRENT' },
    { function: 'COPPER', name: 'COPPER' },
    { function: 'NATURAL_GAS', name: 'NATGAS' },
  ];

  const results: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number> }> = {};

  for (const commodity of commodities) {
    try {
      const url = `https://www.alphavantage.co/query?function=${commodity.function}&interval=daily&apikey=${ALPHA_VANTAGE_KEY}`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      const data = await res.json();

      if (!data.data || data.data.length < 50) {
        console.warn(`Alpha Vantage ${commodity.function}: insufficient data`);
        continue;
      }

      const closes = data.data
        .filter((d: { value: string }) => d.value !== '.' && d.value != null)
        .map((d: { value: string }) => parseFloat(d.value))
        .reverse(); // oldest-first for MA calculation

      const latest = closes[closes.length - 1];

      results[commodity.name] = {
        latestClose: round(latest, 2),
        changes: calculateChanges(closes),
        mas: calculateMAs(closes),
      };
    } catch (err) {
      console.warn(`Commodity ${commodity.name} failed:`, err);
    }
  }

  return results;
}

// ─── RATES (FRED: 10Y Treasury, Fed Funds) ───────────────────────────────────

async function fetchRates() {
  const series = [
    { id: 'DGS10', name: 'US10Y' },
    { id: 'DFF', name: 'FEDFUNDS' },
  ];

  const results: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number> }> = {};

  for (const s of series) {
    try {
      const key = process.env.FRED_API_KEY || 'DEMO_KEY';
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${key}&file_type=json&sort_order=desc&limit=500`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      const data = await res.json();

      if (!data.observations || data.observations.length < 10) {
        console.warn(`FRED ${s.id}: insufficient data`);
        continue;
      }

      const closes = data.observations
        .filter((o: { value: string }) => o.value !== '.')
        .map((o: { value: string }) => parseFloat(o.value))
        .reverse();

      const latest = closes[closes.length - 1];

      results[s.name] = {
        latestClose: round(latest, 2),
        changes: calculateChanges(closes),
        mas: calculateMAs(closes),
      };
    } catch (err) {
      console.warn(`FRED ${s.id} failed:`, err);
    }
  }

  return results;
}

// ─── FOREX FOR DXY SNAPSHOT ──────────────────────────────────────────────────

async function fetchForexForDXY() {
  const pairs = ['OANDA:EUR_USD', 'OANDA:USD_JPY', 'OANDA:GBP_USD', 'OANDA:USD_CAD', 'OANDA:USD_SEK', 'OANDA:USD_CHF'];
  const symbolMap: Record<string, string> = {
    'OANDA:EUR_USD': 'EURUSD', 'OANDA:USD_JPY': 'USDJPY', 'OANDA:GBP_USD': 'GBPUSD',
    'OANDA:USD_CAD': 'USDCAD', 'OANDA:USD_SEK': 'USDSEK', 'OANDA:USD_CHF': 'USDCHF',
  };

  const rates: Record<string, number> = {};
  const fetches = pairs.map(async (pair) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${pair}&token=${FINNHUB_KEY}`;
    const res = await fetchWithTimeout(url, 4000);
    const data = await res.json();
    const key = symbolMap[pair];
    if (key) rates[key] = data.c;
  });

  await Promise.allSettled(fetches);
  const dxyValue = calculateDXY(rates);

  return dxyValue ? { value: dxyValue, rates } : null;
}

// ─── FEAR & GREED ────────────────────────────────────────────────────────────

async function fetchFearGreed() {
  try {
    const url = 'https://api.alternative.me/fng/?limit=1';
    const res = await fetchWithTimeout(url, 4000);
    const data = await res.json();
    if (data.data && data.data[0]) {
      return {
        value: parseInt(data.data[0].value),
        label: data.data[0].value_classification,
        timestamp: parseInt(data.data[0].timestamp) * 1000,
      };
    }
    return null;
  } catch (err) {
    console.warn('Fear & Greed fetch failed:', err);
    return null;
  }
}

// ─── CALCULATION HELPERS ─────────────────────────────────────────────────────

function calculateChanges(closes: number[]): Record<string, number> {
  if (!closes || closes.length < 2) return {};

  const latest = closes[closes.length - 1]!;
  const changes: Record<string, number> = {};

  for (const [label, daysBack] of Object.entries(PERIODS)) {
    const idx = closes.length - 1 - daysBack;
    if (idx >= 0 && closes[idx] != null && closes[idx] > 0) {
      changes[label] = round(((latest - closes[idx]!) / closes[idx]!) * 100, 2);
    }
  }

  return changes;
}

function calculateMAs(closes: number[]): Record<string, number> {
  if (!closes || closes.length < 50) return {};

  const mas: Record<string, number> = {};

  for (const [label, period] of Object.entries(MA_PERIODS)) {
    if (closes.length >= period) {
      const slice = closes.slice(-period);
      const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
      mas[label] = round(avg, 2);
    } else if (label === '200W' && closes.length >= 200) {
      const weekly: number[] = [];
      for (let i = closes.length - 1; i >= 0; i -= 7) {
        weekly.push(closes[i]!);
        if (weekly.length >= 200) break;
      }
      if (weekly.length >= 50) {
        const avg = weekly.reduce((sum, v) => sum + v, 0) / weekly.length;
        mas[label] = round(avg, 2);
      }
    }
  }

  return mas;
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
