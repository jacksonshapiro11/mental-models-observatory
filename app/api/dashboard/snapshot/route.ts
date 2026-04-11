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

import { fetchDXY, fetchDXYFromYahoo } from '@/lib/dxy';
import {
  writeManualFields,
  writePriceHistory,
  writeSnapshot,
  type DashboardSnapshot,
} from '@/lib/upstash';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET!;

const TIMEOUT = 8000;

// Change period definitions:
//   tradingDays = count back N entries in the asset's own date array (skips weekends/holidays)
//   months/years = calendar offset (March 27 → Feb 27, March 27 → March 27 last year)
// This matches Yahoo Finance: 1D and 5D are trading days, 1M and 1Y are calendar.
const CHANGE_PERIODS: Record<string, { tradingDays?: number; days?: number; months?: number; years?: number }> = {
  '1D': { tradingDays: 1 },
  '5D': { days: 7 },
  '1M': { months: 1 },
  '1Y': { years: 1 },
};
// MA periods remain in trading days (industry standard)
const MA_PERIODS: Record<string, number> = { '50D': 50, '200D': 200, '200W': 1000 };

// All assets we track — matches seed-prices.mjs exactly
// Primary: actual index/futures symbols (direct prices, no multiplier math)
// Fallback: ETF proxy × multiplier if actual symbol fails
const ASSETS: Record<string, { yahoo: string; fallback: string | null; fallbackMultiplier: number; category: string }> = {
  // Equities — actual index symbols (direct prices)
  SPX:    { yahoo: '%5EGSPC',  fallback: 'SPY',  fallbackMultiplier: 10,    category: 'equities' },
  NDX:    { yahoo: '%5ENDX',   fallback: 'QQQ',  fallbackMultiplier: 40.95, category: 'equities' },
  DJI:    { yahoo: '%5EDJI',   fallback: 'DIA',  fallbackMultiplier: 100,   category: 'equities' },
  RUT:    { yahoo: '%5ERUT',   fallback: 'IWM',  fallbackMultiplier: 10,    category: 'equities' },
  IGV:    { yahoo: 'IGV',      fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  SMH:    { yahoo: 'SMH',      fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  IWF:    { yahoo: 'IWF',      fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  IWD:    { yahoo: 'IWD',      fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  XLE:    { yahoo: 'XLE',      fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  ARKK:   { yahoo: 'ARKK',     fallback: null,    fallbackMultiplier: 1,     category: 'equities' },

  // Crypto (direct price, multiplier always 1)
  BTC:    { yahoo: 'BTC-USD',       fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  ETH:    { yahoo: 'ETH-USD',       fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  SOL:    { yahoo: 'SOL-USD',       fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  AAVE:   { yahoo: 'AAVE-USD',      fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  UNI:    { yahoo: 'UNI7083-USD',   fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  LINK:   { yahoo: 'LINK-USD',      fallback: null, fallbackMultiplier: 1, category: 'crypto' },

  // Commodities — actual futures symbols (direct prices)
  GOLD:   { yahoo: 'GC%3DF',   fallback: 'GLD',  fallbackMultiplier: 10,  category: 'commodities' },
  SILVER: { yahoo: 'SI%3DF',   fallback: 'SLV',  fallbackMultiplier: 1,   category: 'commodities' },
  BRENT:  { yahoo: 'BZ%3DF',   fallback: 'BNO',  fallbackMultiplier: 1,   category: 'commodities' },
  COPPER: { yahoo: 'HG%3DF',   fallback: 'CPER', fallbackMultiplier: 1,   category: 'commodities' },
  NATGAS: { yahoo: 'NG%3DF',   fallback: 'UNG',  fallbackMultiplier: 1,   category: 'commodities' },

  // Rates (Treasury yields — direct, multiplier always 1)
  US10Y:  { yahoo: '%5ETNX',   fallback: null,   fallbackMultiplier: 1, category: 'rates' },
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
  // Use the actual trading date from Yahoo's regularMarketTime (not wall-clock time).
  // Cron runs at 6 AM ET, so Yahoo returns yesterday's closing price — and the
  // tradingDate from Yahoo will correctly be yesterday's date.
  // Fallback: current ET date if Yahoo didn't provide a trading date.
  const fallbackDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  // Determine the canonical snapshot date from equity trading dates (most reliable)
  const equityDates = Object.values(todayPrices)
    .map(d => d.tradingDate)
    .filter((d): d is string => d != null);
  // Most common trading date across all assets = the actual market date
  const today = mode(equityDates) || fallbackDate;
  console.log(`[snapshot] Using trading date: ${today} (fallback would be: ${fallbackDate})`);

  for (const [name, data] of Object.entries(todayPrices)) {
    if (!assetPrices[name]) {
      assetPrices[name] = { dates: [], prices: [], category: ASSETS[name]?.category || 'equities' };
    }
    const arr = assetPrices[name]!;
    // Use the per-asset trading date if available, otherwise the canonical date
    const assetDate = data.tradingDate || today;
    if (arr.dates.length === 0 || arr.dates[arr.dates.length - 1] !== assetDate) {
      arr.dates.push(assetDate);
      arr.prices.push(data.adjustedPrice);
    } else {
      // Update this date's price with the latest
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
    const changes = calculateChanges(arr.dates, arr.prices);
    const mas = calculateMAs(arr.prices);
    const multiplier = todayPrices[name]?.multiplier ?? ASSETS[name]?.fallbackMultiplier ?? 1;

    const cat = categoryMap[arr.category];
    if (cat) {
      cat[name] = { latestClose: round(latest, 2), changes, mas, multiplier };
    }
  }

  // Step 6: Fetch metadata (DXY via Finnhub → Yahoo fallback, Fear & Greed)
  const [dxyResult, fgResult] = await Promise.allSettled([
    FINNHUB_KEY ? fetchDXY(FINNHUB_KEY, TIMEOUT) : Promise.resolve(null),
    fetchFearGreed(),
  ]);

  let dxyData = dxyResult.status === 'fulfilled' ? dxyResult.value : null;
  if (!dxyData) {
    console.log('[snapshot] DXY Finnhub failed, trying Yahoo Finance fallback...');
    try {
      dxyData = await fetchDXYFromYahoo(TIMEOUT);
      if (dxyData) console.log(`[snapshot] DXY Yahoo fallback: ${dxyData.value}`);
    } catch (err) {
      console.warn('[snapshot] DXY Yahoo fallback failed:', err);
    }
  }

  return {
    generatedAt: now,
    date: today,
    equities,
    crypto,
    commodities,
    rates,
    dxy: dxyData,
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
  tradingDate: string | null; // actual trading date from Yahoo response
}

async function fetchAllYahooPrices(): Promise<Record<string, YahooPriceResult>> {
  const results: Record<string, YahooPriceResult> = {};

  for (const [name, asset] of Object.entries(ASSETS)) {
    try {
      // Try primary symbol first (actual index/futures — direct price, no multiplier)
      const primary = await fetchYahooCurrentPriceWithMeta(asset.yahoo);
      if (primary && primary.price > 0) {
        console.log(`[snapshot] ${name}: ${asset.yahoo} = ${primary.price} (direct, date: ${primary.tradingDate})`);
        results[name] = {
          adjustedPrice: round(primary.price, 2),
          multiplier: 1,
          tradingDate: primary.tradingDate,
        };
        await sleep(200);
        continue;
      }
    } catch (err) {
      warn(`Yahoo ${name} primary (${asset.yahoo}) failed: ${err instanceof Error ? err.message : err}`);
    }

    await sleep(200);

    // Fallback: use ETF proxy × multiplier
    if (asset.fallback) {
      try {
        const fallback = await fetchYahooCurrentPriceWithMeta(asset.fallback);
        if (fallback && fallback.price > 0) {
          const adjusted = round(fallback.price * asset.fallbackMultiplier, 2);
          warn(`[snapshot] ${name}: using fallback ${asset.fallback}=${fallback.price} × ${asset.fallbackMultiplier} = ${adjusted}`);
          results[name] = {
            adjustedPrice: adjusted,
            multiplier: asset.fallbackMultiplier,
            tradingDate: fallback.tradingDate,
          };
        }
      } catch (err) {
        warn(`Yahoo ${name} fallback (${asset.fallback}) failed: ${err instanceof Error ? err.message : err}`);
      }
      await sleep(200);
    }
  }

  return results;
}

async function fetchYahooCurrentPriceWithMeta(symbol: string): Promise<{ price: number; tradingDate: string | null } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const res = await fetchWithTimeout(url, TIMEOUT, { 'User-Agent': 'Mozilla/5.0' });
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number' || price <= 0) return null;

  // Extract the actual trading date from Yahoo's regularMarketTime (Unix timestamp)
  // Convert using the exchange's timezone to get the correct trading date
  let tradingDate: string | null = null;
  if (meta?.regularMarketTime) {
    const tz = meta?.exchangeTimezoneName || 'America/New_York';
    tradingDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(meta.regularMarketTime * 1000));
  }

  return { price, tradingDate };
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

// Calculate % changes matching Yahoo Finance conventions:
//   tradingDays: count back N entries in the date array (1D, 5D)
//   months/years: calendar offset with closest-trading-day lookup (1M, 1Y)
function calculateChanges(dates: string[], prices: number[]): Record<string, number> {
  if (!dates || !prices || prices.length < 2) return {};

  const latestIdx = prices.length - 1;
  const latest = prices[latestIdx]!;
  const changes: Record<string, number> = {};

  for (const [label, period] of Object.entries(CHANGE_PERIODS)) {
    let bestIdx = -1;

    if (period.tradingDays) {
      // Simple array index lookback — each entry IS a trading day
      bestIdx = latestIdx - period.tradingDays;
    } else {
      // Calendar date lookback with binary search for closest trading day
      // Parse date components directly to avoid timezone issues
      const dateStr = dates[latestIdx]!;
      const parts = dateStr.split('-').map(Number);
      let ty = parts[0]!, tm = parts[1]!, td = parts[2]!;
      if (period.years) ty -= period.years;
      if (period.months) {
        tm -= period.months;
        if (tm < 1) { ty -= 1; tm += 12; }
      }
      if (period.days) td -= period.days;
      // Clamp day to valid range for target month (handles e.g. March 31 → Feb 28)
      const maxDay = new Date(ty, tm, 0).getDate();
      if (td > maxDay) td = maxDay;
      const targetStr = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;

      let lo = 0, hi = latestIdx - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dates[mid]! <= targetStr) {
          bestIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
    }

    if (bestIdx >= 0 && prices[bestIdx] != null && prices[bestIdx]! > 0) {
      changes[label] = round(((latest - prices[bestIdx]!) / prices[bestIdx]!) * 100, 2);
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

// Return the most common element in an array
function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithTimeout(url: string, timeout: number, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {
    signal: controller.signal,
    ...(headers ? { headers: { ...headers } } : {}),
  }).finally(() => clearTimeout(timer));
}
