/**
 * /api/dashboard/snapshot — App Router
 *
 * GET: Runs ONCE per day at 6 AM ET via cron.
 *   - Fetches today's prices from Yahoo Finance (same source as seed-prices.mjs)
 *   - Reads historical data from Redis (populated by seed-prices.mjs)
 *   - Calculates % changes and MAs using per-asset trading day lookback
 *   - Writes to Upstash: dashboard:snapshot:latest + dashboard:history:YYYY-MM-DD
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
import { fetchDXY } from '@/lib/dxy';
import { Redis } from '@upstash/redis';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET!;

const TIMEOUT = 8000;

// Per-asset trading day lookback (matches seed-prices.mjs)
const PERIODS: Record<string, number> = { '1D': 1, '5D': 5, '1M': 21, '1Y': 252 };
const MA_PERIODS: Record<string, number> = { '50D': 50, '200D': 200, '200W': 1000 };

// All assets we track — matches seed-prices.mjs exactly
const ASSETS: Record<string, { yahoo: string; actual: string | null; fallbackMultiplier: number; category: string }> = {
  // Equities (ETF proxies → actual index for calibration)
  SPX:    { yahoo: 'SPY',   actual: '%5EGSPC',  fallbackMultiplier: 10,    category: 'equities' },
  NDX:    { yahoo: 'QQQ',   actual: '%5ENDX',   fallbackMultiplier: 40.95, category: 'equities' },
  DJI:    { yahoo: 'DIA',   actual: '%5EDJI',   fallbackMultiplier: 100,   category: 'equities' },
  IGV:    { yahoo: 'IGV',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  SMH:    { yahoo: 'SMH',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  IWM:    { yahoo: 'IWM',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  IWF:    { yahoo: 'IWF',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  IWD:    { yahoo: 'IWD',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  XLE:    { yahoo: 'XLE',   actual: null,        fallbackMultiplier: 1,     category: 'equities' },
  ARKK:   { yahoo: 'ARKK',  actual: null,        fallbackMultiplier: 1,     category: 'equities' },

  // Crypto (direct price, multiplier always 1)
  BTC:    { yahoo: 'BTC-USD',       actual: null, fallbackMultiplier: 1, category: 'crypto' },
  ETH:    { yahoo: 'ETH-USD',       actual: null, fallbackMultiplier: 1, category: 'crypto' },
  SOL:    { yahoo: 'SOL-USD',       actual: null, fallbackMultiplier: 1, category: 'crypto' },
  AAVE:   { yahoo: 'AAVE-USD',      actual: null, fallbackMultiplier: 1, category: 'crypto' },
  UNI:    { yahoo: 'UNI7083-USD',   actual: null, fallbackMultiplier: 1, category: 'crypto' },
  LINK:   { yahoo: 'LINK-USD',      actual: null, fallbackMultiplier: 1, category: 'crypto' },

  // Commodities (ETF proxies → actual futures for calibration)
  GOLD:   { yahoo: 'GLD',   actual: 'GC%3DF',  fallbackMultiplier: 10,  category: 'commodities' },
  SILVER: { yahoo: 'SLV',   actual: 'SI%3DF',  fallbackMultiplier: 1,   category: 'commodities' },
  BRENT:  { yahoo: 'BNO',   actual: 'BZ%3DF',  fallbackMultiplier: 1,   category: 'commodities' },
  COPPER: { yahoo: 'CPER',  actual: 'HG%3DF',  fallbackMultiplier: 1,   category: 'commodities' },
  NATGAS: { yahoo: 'UNG',   actual: 'NG%3DF',  fallbackMultiplier: 1,   category: 'commodities' },

  // Rates (Treasury yields — direct, multiplier always 1)
  US10Y:  { yahoo: '%5ETNX', actual: null, fallbackMultiplier: 1, category: 'rates' },
};

// ─── AUTH ────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  if (secret === SNAPSHOT_SECRET) return true;
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || SNAPSHOT_SECRET;
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ─── DIAGNOSTICS ─────────────────────────────────────────────────────────────

const _warnings: string[] = [];
function warn(msg: string) {
  console.warn(msg);
  _warnings.push(msg);
}

// ─── GET: Daily Snapshot ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    _warnings.length = 0;
    const snapshot = await generateSnapshot();
    await writeSnapshot(snapshot);

    const today = snapshot.date;
    await writePriceHistory(today, snapshot);

    const debug = req.nextUrl.searchParams.get('debug') === 'true';

    return NextResponse.json({
      ok: true,
      date: today,
      assets:
        Object.keys(snapshot.equities || {}).length +
        Object.keys(snapshot.crypto || {}).length +
        Object.keys(snapshot.commodities || {}).length,
      errors: snapshot.errors,
      ...(debug && {
        breakdown: {
          equities: Object.keys(snapshot.equities || {}),
          crypto: Object.keys(snapshot.crypto || {}),
          commodities: Object.keys(snapshot.commodities || {}),
          rates: Object.keys(snapshot.rates || {}),
          dxy: snapshot.dxy ? 'ok' : 'missing',
          fearGreed: snapshot.fearGreed ? 'ok' : 'missing',
        },
        warnings: [..._warnings],
      }),
    });
  } catch (err) {
    console.error('Snapshot generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', warnings: [..._warnings] },
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

async function generateSnapshot(): Promise<DashboardSnapshot & { _warnings?: string[] }> {
  const now = Date.now();

  // Step 1: Fetch today's prices from Yahoo Finance for all assets
  console.log('[snapshot] Fetching today\'s prices from Yahoo Finance...');
  const todayPrices = await fetchAllYahooPrices();
  console.log(`[snapshot] Got prices for ${Object.keys(todayPrices).length} assets`);

  // Step 2: Read historical data from Redis (populated by seed-prices.mjs)
  console.log('[snapshot] Reading historical data from Redis...');
  const history = await readRecentHistory(1500);
  console.log(`[snapshot] Found ${history.length} historical days in Redis`);

  if (history.length < 50) {
    warn(`Only ${history.length} history days in Redis — need at least 50 for MAs. Run: node scripts/seed-prices.mjs`);
  }

  // Step 3: Build per-asset price arrays from history
  const assetPrices = buildAssetPriceArrays(history);

  // Step 4: Append today's prices to the arrays
  const today = new Date().toISOString().slice(0, 10);
  for (const [name, data] of Object.entries(todayPrices)) {
    if (!assetPrices[name]) {
      assetPrices[name] = { dates: [], prices: [], category: ASSETS[name]?.category || 'equities' };
    }
    const arr = assetPrices[name]!;
    if (arr.dates.length === 0 || arr.dates[arr.dates.length - 1] !== today) {
      arr.dates.push(today);
      arr.prices.push(data.adjustedPrice);
    } else {
      // Update today's price with the latest
      arr.prices[arr.prices.length - 1] = data.adjustedPrice;
    }
  }

  // Step 5: Calculate changes and MAs for each asset
  const equities: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number>; multiplier: number }> = {};
  const crypto: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number>; multiplier: number }> = {};
  const commodities: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number>; multiplier: number }> = {};
  const rates: Record<string, { latestClose: number; changes: Record<string, number>; mas: Record<string, number>; multiplier: number }> = {};

  const categoryMap: Record<string, typeof equities> = { equities, crypto, commodities, rates };

  for (const [name, arr] of Object.entries(assetPrices)) {
    if (arr.prices.length === 0) continue;

    const latest = arr.prices[arr.prices.length - 1]!;
    const changes = calculateChanges(arr.prices);
    const mas = calculateMAs(arr.prices);
    const multiplier = todayPrices[name]?.multiplier ?? ASSETS[name]?.fallbackMultiplier ?? 1;

    const cat = categoryMap[arr.category];
    if (cat) {
      cat[name] = { latestClose: round(latest, 2), changes, mas, multiplier };
    }
  }

  // Step 6: Fetch metadata (DXY via Finnhub, Fear & Greed)
  const [dxyResult, fgResult] = await Promise.allSettled([
    FINNHUB_KEY ? fetchDXY(FINNHUB_KEY, TIMEOUT) : Promise.resolve(null),
    fetchFearGreed(),
  ]);

  return {
    generatedAt: now,
    date: today,
    equities,
    crypto,
    commodities,
    rates,
    dxy: dxyResult.status === 'fulfilled' ? dxyResult.value : null,
    fearGreed: fgResult.status === 'fulfilled' ? fgResult.value : null,
    errors: [],
    _warnings: [..._warnings],
  };
}

// ─── YAHOO FINANCE FETCH ─────────────────────────────────────────────────────
// Same approach as seed-prices.mjs — free, no API key needed

interface YahooPriceResult {
  adjustedPrice: number;
  multiplier: number;
}

async function fetchAllYahooPrices(): Promise<Record<string, YahooPriceResult>> {
  const results: Record<string, YahooPriceResult> = {};

  for (const [name, asset] of Object.entries(ASSETS)) {
    try {
      const etfPrice = await fetchYahooCurrentPrice(asset.yahoo);
      if (etfPrice == null || etfPrice <= 0) {
        warn(`Yahoo ${name} (${asset.yahoo}): no price`);
        continue;
      }

      let multiplier = asset.fallbackMultiplier;
      if (asset.actual) {
        try {
          const actualPrice = await fetchYahooCurrentPrice(asset.actual);
          if (actualPrice != null && actualPrice > 0 && etfPrice > 0) {
            multiplier = round(actualPrice / etfPrice, 4);
            console.log(`[snapshot] Calibrate ${name}: ${asset.yahoo}=${etfPrice} × ${multiplier} = ${round(etfPrice * multiplier, 2)} (actual: ${actualPrice})`);
          }
        } catch (err) {
          warn(`Yahoo calibration ${name} (${asset.actual}) failed: ${err instanceof Error ? err.message : err}`);
        }
      }

      results[name] = {
        adjustedPrice: round(etfPrice * multiplier, 2),
        multiplier,
      };
    } catch (err) {
      warn(`Yahoo ${name} (${asset.yahoo}) failed: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(200);
  }

  return results;
}

async function fetchYahooCurrentPrice(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const res = await fetchWithTimeout(url, TIMEOUT, { 'User-Agent': 'Mozilla/5.0' });
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === 'number' && price > 0 ? price : null;
}

// ─── READ HISTORICAL DATA FROM REDIS ─────────────────────────────────────────

interface HistoryEntry {
  date: string;
  equities: Record<string, { latestClose: number; multiplier?: number }>;
  crypto: Record<string, { latestClose: number }>;
  commodities: Record<string, { latestClose: number; multiplier?: number }>;
  rates: Record<string, { latestClose: number }>;
}

async function readRecentHistory(maxDays: number): Promise<HistoryEntry[]> {
  const r = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  // Generate date keys for last maxDays calendar days
  const keys: string[] = [];
  const now = Date.now();
  for (let i = 0; i < maxDays; i++) {
    const date = new Date(now - i * 86400000).toISOString().slice(0, 10);
    keys.push(`dashboard:history:${date}`);
  }

  // Batch read using pipeline
  const batchSize = 100;
  const entries: HistoryEntry[] = [];

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const pipeline = r.pipeline();
    for (const key of batch) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();

    for (const raw of results) {
      if (!raw) continue;
      try {
        const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (entry && entry.date) {
          entries.push(entry as HistoryEntry);
        }
      } catch {
        // Skip malformed entries
      }
    }
  }

  // Sort chronologically (oldest first)
  entries.sort((a, b) => a.date.localeCompare(b.date));

  return entries;
}

// ─── BUILD PER-ASSET PRICE ARRAYS ────────────────────────────────────────────

interface AssetPriceArray {
  dates: string[];
  prices: number[];
  category: string;
}

function buildAssetPriceArrays(history: HistoryEntry[]): Record<string, AssetPriceArray> {
  const arrays: Record<string, AssetPriceArray> = {};

  for (const entry of history) {
    const categories: { cat: string; assets: Record<string, { latestClose: number }> }[] = [
      { cat: 'equities', assets: entry.equities || {} },
      { cat: 'crypto', assets: entry.crypto || {} },
      { cat: 'commodities', assets: entry.commodities || {} },
      { cat: 'rates', assets: entry.rates || {} },
    ];

    for (const { cat, assets } of categories) {
      for (const [name, data] of Object.entries(assets)) {
        if (!data || data.latestClose == null || data.latestClose <= 0) continue;
        if (!arrays[name]) {
          arrays[name] = { dates: [], prices: [], category: cat };
        }
        arrays[name]!.dates.push(entry.date);
        arrays[name]!.prices.push(data.latestClose);
      }
    }
  }

  return arrays;
}

// ─── CALCULATION HELPERS ─────────────────────────────────────────────────────

function calculateChanges(prices: number[]): Record<string, number> {
  if (!prices || prices.length < 2) return {};

  const latest = prices[prices.length - 1]!;
  const changes: Record<string, number> = {};

  for (const [label, daysBack] of Object.entries(PERIODS)) {
    const idx = prices.length - 1 - daysBack;
    if (idx >= 0 && prices[idx] != null && prices[idx]! > 0) {
      changes[label] = round(((latest - prices[idx]!) / prices[idx]!) * 100, 2);
    }
  }

  return changes;
}

function calculateMAs(prices: number[]): Record<string, number> {
  if (!prices || prices.length < 50) return {};

  const mas: Record<string, number> = {};

  for (const [label, period] of Object.entries(MA_PERIODS)) {
    if (prices.length >= period) {
      const slice = prices.slice(-period);
      const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
      mas[label] = round(avg, 2);
    } else if (prices.length >= Math.floor(period * 0.8)) {
      // Allow partial MA if we have at least 80% of the data
      const avg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
      mas[label] = round(avg, 2);
    }
  }

  return mas;
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
    warn(`Fear & Greed fetch failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithTimeout(url: string, timeout: number, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {
    signal: controller.signal,
    headers: headers ? { ...headers } : undefined,
  }).finally(() => clearTimeout(timer));
}
