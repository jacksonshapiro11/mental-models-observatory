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

// All assets we track, mapped to Yahoo Finance symbols.
// Primary: use actual index/futures symbols directly (no ETF proxy math).
// Fallback: ETF proxy is available if the actual symbol fails on Yahoo.
const ASSETS = {
  // Equities — actual index symbols (direct prices, no multiplier needed)
  SPX:    { yahoo: '^GSPC',  fallback: 'SPY',  fallbackMultiplier: 10,    category: 'equities' },
  NDX:    { yahoo: '^NDX',   fallback: 'QQQ',  fallbackMultiplier: 40.95, category: 'equities' },
  DJI:    { yahoo: '^DJI',   fallback: 'DIA',  fallbackMultiplier: 100,   category: 'equities' },
  RUT:    { yahoo: '^RUT',   fallback: 'IWM',  fallbackMultiplier: 10,    category: 'equities' },
  IGV:    { yahoo: 'IGV',    fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  SMH:    { yahoo: 'SMH',    fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  IWF:    { yahoo: 'IWF',    fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  IWD:    { yahoo: 'IWD',    fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  XLE:    { yahoo: 'XLE',    fallback: null,    fallbackMultiplier: 1,     category: 'equities' },
  ARKK:   { yahoo: 'ARKK',   fallback: null,    fallbackMultiplier: 1,     category: 'equities' },

  // Crypto (direct price, multiplier always 1)
  BTC:    { yahoo: 'BTC-USD',      fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  ETH:    { yahoo: 'ETH-USD',      fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  SOL:    { yahoo: 'SOL-USD',      fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  AAVE:   { yahoo: 'AAVE-USD',     fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  UNI:    { yahoo: 'UNI7083-USD',  fallback: null, fallbackMultiplier: 1, category: 'crypto' },
  LINK:   { yahoo: 'LINK-USD',     fallback: null, fallbackMultiplier: 1, category: 'crypto' },

  // Commodities — actual futures symbols (direct prices, no ETF proxy math)
  GOLD:   { yahoo: 'GC=F',   fallback: 'GLD',  fallbackMultiplier: 10,  category: 'commodities' },
  SILVER: { yahoo: 'SI=F',   fallback: 'SLV',  fallbackMultiplier: 1,   category: 'commodities' },
  BRENT:  { yahoo: 'BZ=F',   fallback: 'BNO',  fallbackMultiplier: 1,   category: 'commodities' },
  COPPER: { yahoo: 'HG=F',   fallback: 'CPER', fallbackMultiplier: 1,   category: 'commodities' },
  NATGAS: { yahoo: 'NG=F',   fallback: 'UNG',  fallbackMultiplier: 1,   category: 'commodities' },

  // Rates (Treasury yields — direct, multiplier always 1)
  US10Y:  { yahoo: '^TNX',   fallback: null,   fallbackMultiplier: 1,   category: 'rates' },
};

// ─── Yahoo Finance fetch ─────────────────────────────────────────────────────

// Convert Unix timestamp to YYYY-MM-DD in the exchange's timezone.
// US equities/commodities/rates → America/New_York; crypto → UTC (24/7 market)
function timestampToTradingDate(ts, category) {
  const d = new Date(ts * 1000);
  const tz = category === 'crypto' ? 'UTC' : 'America/New_York';
  // Format in the exchange timezone to get the correct trading date
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts; // en-CA format is YYYY-MM-DD
}

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
  // Detect category from exchangeTimezoneName or symbol pattern
  const tzName = result.meta?.exchangeTimezoneName || '';
  const isCrypto = tzName === 'UTC' || symbol.includes('-USD');
  const category = isCrypto ? 'crypto' : 'equities'; // equities/commodities/rates all use ET

  // Build date → price map using exchange-timezone-aware dates
  const history = {};
  for (let i = 0; i < timestamps.length; i++) {
    const date = timestampToTradingDate(timestamps[i], category);
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

// Step 1: Fetch price histories from Yahoo Finance
// Primary: use actual index/futures symbols directly (no multiplier math)
// Fallback: if actual symbol fails, use ETF proxy × fallbackMultiplier
const allHistories = {};
const assetNames = Object.keys(ASSETS);

for (const name of assetNames) {
  const asset = ASSETS[name];
  let history = null;
  let usedFallback = false;

  // Try primary symbol first (actual index/futures)
  try {
    process.stdout.write(`  Fetching ${name} (${asset.yahoo})...`);
    history = await fetchYahooHistory(asset.yahoo, DAYS);
    console.log(` ${Object.keys(history).length} days`);
  } catch (err) {
    console.log(` FAILED: ${err.message}`);
  }
  await new Promise(r => setTimeout(r, 300));

  // If primary failed and we have a fallback ETF, try that
  if ((!history || Object.keys(history).length === 0) && asset.fallback) {
    try {
      process.stdout.write(`  Fetching ${name} fallback (${asset.fallback})...`);
      const etfHistory = await fetchYahooHistory(asset.fallback, DAYS);
      // Apply fallback multiplier to convert ETF price → approximate index level
      history = {};
      for (const [date, price] of Object.entries(etfHistory)) {
        history[date] = Math.round(price * asset.fallbackMultiplier * 100) / 100;
      }
      usedFallback = true;
      console.log(` ${Object.keys(history).length} days (via ${asset.fallback} × ${asset.fallbackMultiplier})`);
    } catch (err) {
      console.log(` FALLBACK FAILED: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  if (history && Object.keys(history).length > 0) {
    allHistories[name] = {
      history,
      category: asset.category,
      usedFallback,
      // multiplier is always 1 for direct prices, or fallbackMultiplier if ETF was used
      multiplier: usedFallback ? asset.fallbackMultiplier : 1,
    };
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
// Change periods matching Yahoo Finance conventions:
//   tradingDays = count back N entries in the asset's date array (skips weekends/holidays)
//   months/years = calendar offset with closest-trading-day lookup
const CHANGE_PERIODS = {
  '1D': { tradingDays: 1 },
  '5D': { days: 7 },
  '1M': { months: 1 },
  '1Y': { years: 1 },
};
// MA periods remain in trading days (industry standard)
const MA_PERIODS = { '50D': 50, '200D': 200, '200W': 1000 };

function round(v, d) { const m = Math.pow(10, d); return Math.round(v * m) / m; }

// Helper: get the price for a period ago for a specific asset.
// tradingDays: count back N entries in the date array (handles weekends + holidays)
// months/years: calendar offset with closest-trading-day binary search
function getCalendarLookbackPrice(assetDates, history, currentDate, period) {
  const currentIdx = binarySearch(assetDates, currentDate);
  if (currentIdx < 0) return null;

  let bestIdx = -1;

  if (period.tradingDays) {
    // Simple array index lookback — each entry IS a trading day
    bestIdx = currentIdx - period.tradingDays;
  } else {
    // Calendar date lookback with binary search
    // Parse date components directly to avoid timezone issues
    const [y, m, d] = currentDate.split('-').map(Number);
    let ty = y, tm = m, td = d;
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

    let lo = 0, hi = currentIdx - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (assetDates[mid] <= targetStr) {
        bestIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  }

  if (bestIdx < 0) return null;
  const price = history[assetDates[bestIdx]];
  if (price == null || price <= 0) return null;
  return round(price, 2);
}

// Helper: calculate MA using asset's own trading days
// Prices are already in actual units (no multiplier needed)
function calcMA(assetDates, history, currentDate, period) {
  const idx = binarySearch(assetDates, currentDate);
  if (idx < 0 || idx < period - 1) return null;
  let sum = 0, count = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const d = assetDates[i];
    const p = history[d];
    if (p != null) {
      sum += p;
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
    const price = data.history[date];
    if (price == null) continue;

    const assetDates = perAssetDates[name];

    // Calculate changes using per-asset trading day lookback
    // Prices are already in actual units (direct from Yahoo index/futures)
    const changes = {};
    for (const [label, period] of Object.entries(CHANGE_PERIODS)) {
      const pastPrice = getCalendarLookbackPrice(assetDates, data.history, date, period);
      if (pastPrice != null && pastPrice > 0) {
        changes[label] = round(((price - pastPrice) / pastPrice) * 100, 2);
      }
    }

    // Calculate MAs using per-asset trading days
    const mas = {};
    for (const [label, period] of Object.entries(MA_PERIODS)) {
      const ma = calcMA(assetDates, data.history, date, period);
      if (ma != null) {
        mas[label] = ma;
      }
    }

    snapshot[data.category][name] = {
      latestClose: round(price, 2),
      changes,
      mas,
      multiplier: data.multiplier,
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
    const price = data.history[assetLatestDate];
    if (price == null) continue;

    // Prices are already in actual units — no multiplier math needed
    const changes = {};
    for (const [label, period] of Object.entries(CHANGE_PERIODS)) {
      const pastPrice = getCalendarLookbackPrice(assetDates, data.history, assetLatestDate, period);
      if (pastPrice != null && pastPrice > 0) {
        changes[label] = round(((price - pastPrice) / pastPrice) * 100, 2);
      }
    }

    const mas = {};
    for (const [label, period] of Object.entries(MA_PERIODS)) {
      const ma = calcMA(assetDates, data.history, assetLatestDate, period);
      if (ma != null) mas[label] = ma;
    }

    latestSnapshot[data.category][name] = { latestClose: round(price, 2), changes, mas, multiplier: data.multiplier };
  }

  await redisSet('dashboard:snapshot:latest', JSON.stringify(latestSnapshot));
  console.log('Written latest snapshot to dashboard:snapshot:latest');
} else {
  console.log(`\nDRY RUN complete — would write ${sortedDates.length} snapshots to Redis`);
}

console.log('\nDone!');
