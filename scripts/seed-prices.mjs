/**
 * Seed historical price data into Redis.
 *
 * Uses Yahoo Finance (free, no API key) to pull daily closes for all tracked
 * assets, then writes one Redis key per date with all prices for that day.
 *
 * Usage:
 *   node scripts/seed-prices.mjs              # seed 400 days
 *   node scripts/seed-prices.mjs --days=90    # seed 90 days
 *   node scripts/seed-prices.mjs --dry-run    # print without writing to Redis
 *
 * This only needs to run ONCE. After that, the daily snapshot cron appends
 * one row per day automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── Load .env.local ─────────────────────────────────────────────────────────

const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('ERROR: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required');
  process.exit(1);
}

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
// Request 1500 calendar days (~1050 trading days) to cover 200W MA (1000 trading days)
const DAYS = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '1500');

// All assets we track, mapped to Yahoo Finance ETF proxy symbols.
// For calibrated assets, we also fetch the actual index/futures price
// and back-solve: multiplier = actual_price / etf_price (per day).
const ASSETS = {
  // Equities (ETF proxies → actual index for calibration)
  SPX:    { yahoo: 'SPY',   actual: '^GSPC',  fallbackMultiplier: 10,    category: 'equities' },
  NDX:    { yahoo: 'QQQ',   actual: '^NDX',   fallbackMultiplier: 40.95, category: 'equities' },
  DJI:    { yahoo: 'DIA',   actual: '^DJI',   fallbackMultiplier: 100,   category: 'equities' },
  IGV:    { yahoo: 'IGV',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  SMH:    { yahoo: 'SMH',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  IWM:    { yahoo: 'IWM',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  IWF:    { yahoo: 'IWF',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  IWD:    { yahoo: 'IWD',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  XLE:    { yahoo: 'XLE',   actual: null,     fallbackMultiplier: 1,     category: 'equities' },
  ARKK:   { yahoo: 'ARKK',  actual: null,     fallbackMultiplier: 1,     category: 'equities' },

  // Crypto (no proxy — direct price, multiplier always 1)
  BTC:    { yahoo: 'BTC-USD',  actual: null, fallbackMultiplier: 1, category: 'crypto' },
  ETH:    { yahoo: 'ETH-USD',  actual: null, fallbackMultiplier: 1, category: 'crypto' },
  SOL:    { yahoo: 'SOL-USD',  actual: null, fallbackMultiplier: 1, category: 'crypto' },
  AAVE:   { yahoo: 'AAVE-USD', actual: null, fallbackMultiplier: 1, category: 'crypto' },
  UNI:    { yahoo: 'UNI7083-USD',  actual: null, fallbackMultiplier: 1, category: 'crypto' },
  LINK:   { yahoo: 'LINK-USD', actual: null, fallbackMultiplier: 1, category: 'crypto' },

  // Commodities (ETF proxies → actual futures for calibration)
  GOLD:   { yahoo: 'GLD',   actual: 'GC=F',  fallbackMultiplier: 10,  category: 'commodities' },
  SILVER: { yahoo: 'SLV',   actual: 'SI=F',  fallbackMultiplier: 1,   category: 'commodities' },
  BRENT:  { yahoo: 'BNO',   actual: 'BZ=F',  fallbackMultiplier: 1,   category: 'commodities' },
  COPPER: { yahoo: 'CPER',  actual: 'HG=F',  fallbackMultiplier: 1,   category: 'commodities' },
  NATGAS: { yahoo: 'UNG',   actual: 'NG=F',  fallbackMultiplier: 1,   category: 'commodities' },

  // Rates (Treasury yields — direct, multiplier always 1)
  US10Y:  { yahoo: '^TNX',  actual: null,    fallbackMultiplier: 1,   category: 'rates' },
};

// ─── Yahoo Finance fetch ─────────────────────────────────────────────────────

async function fetchYahooHistory(symbol, days) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=1d`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!res.ok) {
    throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: no result`);

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];

  // Build date → price map
  const history = {};
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    const price = closes[i];
    if (price != null && price > 0) {
      history[date] = Math.round(price * 100) / 100;
    }
  }

  return history;
}

// ─── Redis write ─────────────────────────────────────────────────────────────

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`Seeding ${DAYS} days of price history${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

// Step 1: Fetch all ETF proxy histories from Yahoo Finance
const allHistories = {};
const actualHistories = {};  // actual index/futures prices for calibration
const assetNames = Object.keys(ASSETS);

for (const name of assetNames) {
  const asset = ASSETS[name];
  try {
    process.stdout.write(`  Fetching ${name} (${asset.yahoo})...`);
    const history = await fetchYahooHistory(asset.yahoo, DAYS);
    const days = Object.keys(history).length;
    allHistories[name] = { history, category: asset.category, fallbackMultiplier: asset.fallbackMultiplier };
    console.log(` ${days} days`);
  } catch (err) {
    console.log(` FAILED: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 300));

  // Also fetch the actual index/futures for calibration
  if (asset.actual) {
    try {
      process.stdout.write(`  Fetching ${name} actual (${asset.actual})...`);
      const actualHistory = await fetchYahooHistory(asset.actual, DAYS);
      actualHistories[name] = actualHistory;
      console.log(` ${Object.keys(actualHistory).length} days`);
    } catch (err) {
      console.log(` FAILED (will use fallback multiplier): ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

console.log('');

// Step 2: Build per-asset sorted date arrays (needed because crypto trades weekends but equities don't)
// Using global index-based lookback would land on weekend dates for equities → null → dashes
const allDates = new Set();
const perAssetDates = {};  // { SPX: ['2022-01-03', '2022-01-04', ...], BTC: [...], ... }

for (const [name, data] of Object.entries(allHistories)) {
  const dates = Object.keys(data.history).sort();
  perAssetDates[name] = dates;
  for (const date of dates) {
    allDates.add(date);
  }
}

const sortedDates = [...allDates].sort();
console.log(`Found ${sortedDates.length} unique calendar dates`);
console.log(`Range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}\n`);

// Build per-date price records and calculate changes + MAs
// PERIODS are in trading days (not calendar days) — must count per-asset
const PERIODS = { '1D': 1, '5D': 5, '1M': 21, '1Y': 252 };
const MA_PERIODS = { '50D': 50, '200D': 200, '200W': 1000 };

function round(v, d) { const m = Math.pow(10, d); return Math.round(v * m) / m; }

// Helper: get the Nth-previous trading day price for a specific asset
function getNthPrevPrice(assetDates, history, currentDate, n, actual, fallbackMult) {
  // Find the index of currentDate in this asset's sorted dates
  const idx = binarySearch(assetDates, currentDate);
  if (idx < 0) return null;
  const pastIdx = idx - n;
  if (pastIdx < 0) return null;
  const pastDate = assetDates[pastIdx];
  const pastEtf = history[pastDate];
  if (pastEtf == null || pastEtf <= 0) return null;
  let mult = fallbackMult;
  if (actual && actual[pastDate] != null && pastEtf > 0) {
    mult = actual[pastDate] / pastEtf;
  }
  return round(pastEtf * mult, 2);
}

// Helper: calculate MA using asset's own trading days
function calcMA(assetDates, history, currentDate, period, actual, fallbackMult) {
  const idx = binarySearch(assetDates, currentDate);
  if (idx < 0 || idx < period - 1) return null;
  let sum = 0, count = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const d = assetDates[i];
    const p = history[d];
    if (p != null) {
      let m = fallbackMult;
      if (actual && actual[d] != null && p > 0) {
        m = actual[d] / p;
      }
      sum += p * m;
      count++;
    }
  }
  if (count < period * 0.8) return null; // Require 80% of trading days
  return round(sum / count, 2);
}

function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

let written = 0;
for (let dateIdx = 0; dateIdx < sortedDates.length; dateIdx++) {
  const date = sortedDates[dateIdx];
  const snapshot = {
    generatedAt: new Date(date).getTime(),
    date,
    equities: {},
    crypto: {},
    commodities: {},
    rates: {},
    dxy: null,
    fearGreed: null,
    errors: [],
  };

  for (const [name, data] of Object.entries(allHistories)) {
    const etfPrice = data.history[date];
    if (etfPrice == null) continue;

    const assetDates = perAssetDates[name];
    const actual = actualHistories[name];

    // Calibrate: if we have the actual price for this date, back-solve multiplier
    let multiplier = data.fallbackMultiplier;
    if (actual && actual[date] != null && etfPrice > 0) {
      multiplier = round(actual[date] / etfPrice, 4);
    }

    const adjustedPrice = round(etfPrice * multiplier, 2);

    // Calculate changes using per-asset trading day lookback
    const changes = {};
    for (const [label, periodDays] of Object.entries(PERIODS)) {
      const pastPrice = getNthPrevPrice(assetDates, data.history, date, periodDays, actual, data.fallbackMultiplier);
      if (pastPrice != null && pastPrice > 0) {
        changes[label] = round(((adjustedPrice - pastPrice) / pastPrice) * 100, 2);
      }
    }

    // Calculate MAs using per-asset trading days
    const mas = {};
    for (const [label, period] of Object.entries(MA_PERIODS)) {
      const ma = calcMA(assetDates, data.history, date, period, actual, data.fallbackMultiplier);
      if (ma != null) {
        mas[label] = ma;
      }
    }

    snapshot[data.category][name] = {
      latestClose: adjustedPrice,
      changes,
      mas,
      multiplier,
    };
  }

  // Write to Redis
  const key = `dashboard:history:${date}`;
  const assetCount = Object.keys(snapshot.equities).length +
    Object.keys(snapshot.crypto).length +
    Object.keys(snapshot.commodities).length +
    Object.keys(snapshot.rates).length;

  if (assetCount === 0) continue;

  if (DRY_RUN) {
    if (dateIdx === 0 || dateIdx === sortedDates.length - 1) {
      console.log(`  ${date}: ${assetCount} assets (${Object.keys(snapshot.equities).length} eq, ${Object.keys(snapshot.crypto).length} crypto, ${Object.keys(snapshot.commodities).length} comm, ${Object.keys(snapshot.rates).length} rates)`);
    }
  } else {
    try {
      await redisSet(key, JSON.stringify(snapshot));
      written++;
      if (written % 50 === 0 || dateIdx === sortedDates.length - 1) {
        process.stdout.write(`  Written ${written} days...\r`);
      }
    } catch (err) {
      console.error(`  FAILED writing ${date}: ${err.message}`);
    }
  }
}

console.log('');

if (!DRY_RUN) {
  // Also write the latest date as the current snapshot
  const latestDate = sortedDates[sortedDates.length - 1];
  const latestKey = `dashboard:history:${latestDate}`;
  console.log(`\nWritten ${written} daily snapshots to Redis`);
  console.log(`Latest: ${latestDate}`);

  // Write the latest as the active snapshot too
  const latestSnapshot = {
    generatedAt: Date.now(),
    date: latestDate,
    equities: {},
    crypto: {},
    commodities: {},
    rates: {},
    dxy: null,
    fearGreed: null,
    errors: [],
  };

  for (const [name, data] of Object.entries(allHistories)) {
    const assetDates = perAssetDates[name];
    if (!assetDates || assetDates.length === 0) continue;

    // Use each asset's OWN most recent date (equities = last weekday, crypto = today)
    // This prevents missing equities entirely if seed is run on a weekend
    const assetLatestDate = assetDates[assetDates.length - 1];
    const etfPrice = data.history[assetLatestDate];
    if (etfPrice == null) continue;

    const actual = actualHistories[name];
    let multiplier = data.fallbackMultiplier;
    if (actual && actual[assetLatestDate] != null && etfPrice > 0) {
      multiplier = round(actual[assetLatestDate] / etfPrice, 4);
    }

    const adjustedPrice = round(etfPrice * multiplier, 2);

    // Use per-asset trading day lookback (same as per-date loop)
    const changes = {};
    for (const [label, periodDays] of Object.entries(PERIODS)) {
      const pastPrice = getNthPrevPrice(assetDates, data.history, assetLatestDate, periodDays, actual, data.fallbackMultiplier);
      if (pastPrice != null && pastPrice > 0) {
        changes[label] = round(((adjustedPrice - pastPrice) / pastPrice) * 100, 2);
      }
    }

    const mas = {};
    for (const [label, period] of Object.entries(MA_PERIODS)) {
      const ma = calcMA(assetDates, data.history, assetLatestDate, period, actual, data.fallbackMultiplier);
      if (ma != null) mas[label] = ma;
    }

    latestSnapshot[data.category][name] = { latestClose: adjustedPrice, changes, mas, multiplier };
  }

  await redisSet('dashboard:snapshot:latest', JSON.stringify(latestSnapshot));
  console.log('Written latest snapshot to dashboard:snapshot:latest');
} else {
  console.log(`\nDRY RUN complete — would write ${sortedDates.length} snapshots to Redis`);
}

console.log('\nDone!');
