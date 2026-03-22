/**
 * /api/dashboard/live — App Router
 *
 * Real-time dashboard aggregator. Polled by the frontend every 60 seconds.
 * CDN caches the response for 60 seconds, so all readers share one invocation.
 *
 * Architecture:
 *   - Real-time prices: Binance (crypto) + Finnhub (equities + forex → DXY)
 *   - Cached slow data: CoinGecko /global (5-min TTL in Upstash)
 *   - Daily reference data: Snapshot from Upstash (MAs, % changes, commodities, rates)
 *   - Manual fields: FedWatch, ETF flows from Upstash
 */

import { NextResponse } from 'next/server';
import {
  readSnapshot,
  readCoinGeckoGlobal,
  writeCoinGeckoGlobal,
  readManualFields,
  type DashboardSnapshot,
  type ManualFields,
  type CoinGeckoGlobal,
} from '@/lib/upstash';
import { fetchDXY, type DXYResult } from '@/lib/dxy';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY!;
const TIMEOUT = 5000;

// Default multipliers — overridden by daily calibrated values from snapshot
const DEFAULT_MULTIPLIERS: Record<string, number> = { SPY: 10, QQQ: 40.95, DIA: 100, IGV: 1, SMH: 1, IWM: 1, IWF: 1, IWD: 1, XLE: 1, ARKK: 1 };

// Indices use multiplier: round to 0 decimals; ETFs are direct prices: 2 decimals
const INDEX_NAMES = new Set(['SPX', 'NDX', 'DJI']);

const ETF_PROXIES = [
  { symbol: 'SPY', name: 'SPX' },
  { symbol: 'QQQ', name: 'NDX' },
  { symbol: 'DIA', name: 'DJI' },
  { symbol: 'IGV', name: 'IGV' },   // SaaS/Software ETF (Thesis 1)
  { symbol: 'SMH', name: 'SMH' },   // Semiconductor ETF (Thesis 4, BS #7)
  { symbol: 'IWM', name: 'IWM' },   // Russell 2000 (small cap risk appetite)
  { symbol: 'IWF', name: 'IWF' },   // Russell 1000 Growth
  { symbol: 'IWD', name: 'IWD' },   // Russell 1000 Value
  { symbol: 'XLE', name: 'XLE' },   // Energy Select SPDR (Iran/oil)
  { symbol: 'ARKK', name: 'ARKK' }, // ARK Innovation (speculative tech)
] as const;

// Commodity futures — Yahoo Finance direct (actual futures prices, no ETF tracking error)
const COMMODITY_FUTURES = [
  { yahoo: 'GC%3DF', name: 'GOLD' },     // Gold futures
  { yahoo: 'SI%3DF', name: 'SILVER' },    // Silver futures
  { yahoo: 'BZ%3DF', name: 'BRENT' },     // Brent crude futures
  { yahoo: 'HG%3DF', name: 'COPPER' },    // Copper futures
  { yahoo: 'NG%3DF', name: 'NATGAS' },    // Natural gas futures
] as const;

const CRYPTO_PAIRS = [
  { symbol: 'BTCUSDT', name: 'BTC' },
  { symbol: 'ETHUSDT', name: 'ETH' },
  { symbol: 'SOLUSDT', name: 'SOL' },
  { symbol: 'AAVEUSDT', name: 'AAVE' },   // DeFi lending infra (Thesis 3)
  { symbol: 'UNIUSDT', name: 'UNI' },     // DEX infra (Thesis 3)
  { symbol: 'LINKUSDT', name: 'LINK' },    // Oracle infra (Thesis 3)
] as const;

// ─── GET HANDLER ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Read snapshot first — we need calibrated multipliers for equity prices
    const [snapshotResult, manualResult] = await Promise.allSettled([
      readSnapshot(),
      readManualFields(),
    ]);
    const snapshotData = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
    const manualData = manualResult.status === 'fulfilled' ? manualResult.value : {};

    // Log snapshot status for debugging
    if (!snapshotData) {
      console.warn('[live] No snapshot found in Redis — changes/MAs will be empty');
      if (snapshotResult.status === 'rejected') {
        console.error('[live] Snapshot read failed:', snapshotResult.reason);
      }
    } else {
      console.log(`[live] Snapshot loaded: ${snapshotData.date}, equities=${Object.keys(snapshotData.equities || {}).length}, crypto=${Object.keys(snapshotData.crypto || {}).length}`);
    }

    // Now fetch live data in parallel
    // - Equities: Finnhub real-time ETF quotes (indices use calibrated multiplier)
    // - Commodities: Yahoo Finance futures (actual futures prices, ~15min delay but no ETF tracking error)
    const [cryptoPrices, equityPrices, commodityPrices, dxyResult, coinGeckoGlobal] =
      await Promise.allSettled([
        fetchCryptoPrices(),
        fetchEquityPrices(snapshotData),
        fetchCommodityPrices(),
        fetchDXY(FINNHUB_KEY, TIMEOUT),
        fetchCoinGeckoGlobalCached(),
      ]);

    const response = buildResponse({
      cryptoPrices: cryptoPrices.status === 'fulfilled' ? cryptoPrices.value : {},
      equityPrices: equityPrices.status === 'fulfilled' ? equityPrices.value : {},
      commodityPrices: commodityPrices.status === 'fulfilled' ? commodityPrices.value : {},
      dxy: dxyResult.status === 'fulfilled' ? dxyResult.value : null,
      coinGecko: coinGeckoGlobal.status === 'fulfilled' ? coinGeckoGlobal.value : null,
      snapshot: snapshotData,
      manual: manualData,
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    console.error('Live dashboard error:', err);
    return NextResponse.json(
      { error: 'Dashboard temporarily unavailable' },
      { status: 500 }
    );
  }
}

// ─── BUILD RESPONSE ──────────────────────────────────────────────────────────

interface BuildResponseArgs {
  cryptoPrices: Record<string, { price: number; source: string }>;
  equityPrices: Record<string, { price: number; prevClose: number; source: string }>;
  commodityPrices: Record<string, { price: number; source: string }>;
  dxy: DXYResult | null;
  coinGecko: CoinGeckoGlobal | null;
  snapshot: DashboardSnapshot | null;
  manual: ManualFields;
}

function buildResponse({ cryptoPrices, equityPrices, commodityPrices, dxy, coinGecko, snapshot, manual }: BuildResponseArgs) {
  const now = Date.now();
  const marketStatus = getMarketStatus();

  // Merge live prices with snapshot reference data
  const equities: Record<string, unknown> = {};
  for (const etf of ETF_PROXIES) {
    const live = equityPrices[etf.name];
    const ref = snapshot?.equities?.[etf.name];
    equities[etf.name] = {
      price: live?.price ?? ref?.latestClose ?? null,
      changes: mergeChanges(live?.price ?? null, ref ?? null),
      mas: ref?.mas || {},
    };
  }

  const crypto: Record<string, unknown> = {};
  for (const pair of CRYPTO_PAIRS) {
    const live = cryptoPrices[pair.name];
    const ref = snapshot?.crypto?.[pair.name];
    crypto[pair.name] = {
      price: live?.price ?? ref?.latestClose ?? null,
      changes: mergeChanges(live?.price ?? null, ref ?? null),
      mas: ref?.mas || {},
    };
  }

  // Commodities — live Yahoo Finance futures prices with snapshot fallback
  const commodities: Record<string, unknown> = {};
  for (const name of ['GOLD', 'SILVER', 'BRENT', 'COPPER', 'NATGAS']) {
    const live = commodityPrices[name];
    const ref = snapshot?.commodities?.[name];
    commodities[name] = {
      price: live?.price ?? ref?.latestClose ?? null,
      changes: mergeChanges(live?.price ?? null, ref ?? null),
      mas: ref?.mas || {},
    };
  }

  const rates: Record<string, unknown> = {};
  const us10y = snapshot?.rates?.US10Y;
  rates.US10Y = {
    price: us10y?.latestClose ?? null,
    changes: us10y?.changes || {},
    mas: us10y?.mas || {},
  };

  // Crypto meta from CoinGecko + manual fields
  const cryptoMeta: Record<string, unknown> = {};
  if (coinGecko) {
    cryptoMeta.btcDominance = coinGecko.btcDominance ?? null;
    cryptoMeta.ethDominance = coinGecko.ethDominance ?? null;
    cryptoMeta.totalMarketCap = coinGecko.totalMarketCap ?? null;
    cryptoMeta.totalVolume24h = coinGecko.totalVolume24h ?? null;
    // DeFi metrics (Thesis 3: infra > assets)
    cryptoMeta.defiMarketCap = coinGecko.defiMarketCap ?? null;
    cryptoMeta.defiToEthRatio = coinGecko.defiToEthRatio ?? null;
    cryptoMeta.defiDominance = coinGecko.defiDominance ?? null;
    // Derivatives positioning
    cryptoMeta.btcFundingRate = coinGecko.btcFundingRate ?? null;
    cryptoMeta.btcOpenInterest = coinGecko.btcOpenInterest ?? null;
    // Trending (narrative gauge)
    if (coinGecko.trending && coinGecko.trending.length > 0) {
      cryptoMeta.trending = coinGecko.trending;
    }
    // Corporate treasury
    if (coinGecko.corporateBtcHoldings != null) {
      cryptoMeta.corporateBtcHoldings = coinGecko.corporateBtcHoldings;
    }
  }
  if (snapshot?.fearGreed) {
    cryptoMeta.fearGreed = snapshot.fearGreed;
  }
  if (manual.etfFlows != null) {
    cryptoMeta.etfFlows = manual.etfFlows;
  }

  // Build meta
  const meta: Record<string, unknown> = {
    marketStatus,
    timestamp: now,
    snapshotDate: snapshot?.date ?? null,
    cryptoMeta: Object.keys(cryptoMeta).length > 0 ? cryptoMeta : null,
  };

  if (dxy) {
    meta.dxy = {
      value: dxy.value,
      yoyChange: snapshot?.dxy?.value
        ? round(((dxy.value - snapshot.dxy.value) / snapshot.dxy.value) * 100, 2)
        : null,
    };
  } else if (snapshot?.dxy) {
    meta.dxy = { value: snapshot.dxy.value, yoyChange: null };
  }

  if (manual.fedWatch) meta.fedWatch = manual.fedWatch;
  // Manual fedFunds is expected as a string like "3.50-3.75%"
  if (manual.fedFunds) {
    meta.fedFunds = manual.fedFunds;
  } else if (snapshot?.rates?.FEDFUNDS) {
    meta.fedFunds = `${snapshot.rates.FEDFUNDS.latestClose}%`;
  }

  return { equities, crypto, commodities, rates, meta };
}

// ─── MERGE LIVE PRICE WITH SNAPSHOT REFERENCE DATA ───────────────────────────

interface AssetRef {
  latestClose: number;
  changes: Record<string, number>;
  mas: Record<string, number>;
}

function mergeChanges(livePrice: number | null, snapshotRef: AssetRef | null): Record<string, number> {
  if (!snapshotRef || !snapshotRef.changes) return {};

  const changes = { ...snapshotRef.changes };

  if (livePrice && snapshotRef.latestClose && snapshotRef.latestClose > 0) {
    const liveVsSnapshot = ((livePrice - snapshotRef.latestClose) / snapshotRef.latestClose) * 100;
    changes['1D'] = round(liveVsSnapshot, 2);
  }

  return changes;
}

// ─── CRYPTO PRICES (Binance → CoinGecko fallback) ──────────────────────────

// CoinGecko IDs for fallback pricing
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  AAVE: 'aave',
  UNI: 'uniswap',
  LINK: 'chainlink',
};

async function fetchCryptoPrices(): Promise<Record<string, { price: number; source: string }>> {
  const results: Record<string, { price: number; source: string }> = {};

  // Try Binance first (real-time, no API key needed)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const fetches = CRYPTO_PAIRS.map(async ({ symbol, name }) => {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`);
      const data = await res.json();
      results[name] = { price: parseFloat(data.price), source: 'binance' };
    });

    await Promise.allSettled(fetches);
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') console.error('Binance fetch error:', err);
  } finally {
    clearTimeout(timer);
  }

  // Fallback: if any coins are missing, try CoinGecko simple/price
  const missing = CRYPTO_PAIRS.filter(({ name }) => !results[name]).map(({ name }) => name);
  if (missing.length > 0) {
    console.warn(`[live] Binance missing ${missing.join(', ')} — falling back to CoinGecko`);
    try {
      const ids = missing.map(name => COINGECKO_IDS[name]).filter(Boolean).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&x_cg_demo_key=${COINGECKO_KEY}`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (res.ok) {
        const data = await res.json();
        for (const name of missing) {
          const cgId = COINGECKO_IDS[name];
          if (cgId && data[cgId]?.usd) {
            results[name] = { price: data[cgId].usd, source: 'coingecko' };
          }
        }
      }
    } catch (err) {
      console.error('CoinGecko fallback failed:', err);
    }
  }

  // Log what we got
  const sources = Object.entries(results).map(([k, v]) => `${k}:${v.source}`).join(', ');
  console.log(`[live] Crypto prices: ${sources || 'NONE — will use snapshot'}`);

  return results;
}

// ─── EQUITY PRICES (Finnhub via ETF proxies) ────────────────────────────────
// Uses calibrated multipliers from snapshot (recalculated daily from actual index levels)

async function fetchEquityPrices(snapshot: DashboardSnapshot | null): Promise<Record<string, { price: number; prevClose: number; source: string }>> {
  const results: Record<string, { price: number; prevClose: number; source: string }> = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const fetches = ETF_PROXIES.map(async ({ symbol, name }) => {
      // Use calibrated multiplier from snapshot, fall back to defaults
      const snapshotMultiplier = (snapshot?.equities?.[name] as unknown as Record<string, unknown>)?.multiplier as number | undefined;
      const multiplier = snapshotMultiplier ?? DEFAULT_MULTIPLIERS[symbol] ?? 10;

      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Finnhub ${symbol}: ${res.status}`);
      const data = await res.json();
      // Indices (SPX, NDX, DJI) round to 0 decimals; ETFs keep 2 decimals
      const decimals = INDEX_NAMES.has(name) ? 0 : 2;
      results[name] = {
        price: round(data.c * multiplier, decimals),
        prevClose: round(data.pc * multiplier, decimals),
        source: 'finnhub',
      };
    });

    await Promise.allSettled(fetches);
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') console.error('Equity fetch error:', err);
  } finally {
    clearTimeout(timer);
  }

  return results;
}

// ─── COMMODITY PRICES (Yahoo Finance futures → snapshot fallback) ────────────
// Uses actual futures symbols (GC=F, SI=F, BZ=F, HG=F, NG=F) for accurate prices
// without ETF tracking error, contango drag, or expense ratio distortion.
// ~15 minute delay on Yahoo free tier, but far more accurate than ETF proxies.

async function fetchCommodityPrices(): Promise<Record<string, { price: number; source: string }>> {
  const results: Record<string, { price: number; source: string }> = {};

  try {
    const fetches = COMMODITY_FUTURES.map(async ({ yahoo, name }) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?interval=1d&range=1d`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (!res.ok) throw new Error(`Yahoo ${name}: ${res.status}`);
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice ?? meta?.previousClose;
      if (price && price > 0) {
        results[name] = { price: round(price, 2), source: 'yahoo' };
      }
    });

    await Promise.allSettled(fetches);
  } catch (err) {
    console.error('Commodity fetch error:', err);
  }

  const sources = Object.entries(results).map(([k, v]) => `${k}:${v.price}`).join(', ');
  console.log(`[live] Commodity prices: ${sources || 'NONE — using snapshot'}`);

  return results;
}

// ─── COINGECKO ENRICHED DATA (cached in Upstash, 1-hour TTL) ────────────────
// Fetches 4 endpoints in parallel: /global, /global/defi, /search/trending, /derivatives
// ~4 calls/hour × 720 hours/month = ~2,880 calls/month (well within 10K limit)
// Corporate treasury fetched daily via snapshot (barely changes)

async function fetchCoinGeckoGlobalCached(): Promise<CoinGeckoGlobal | null> {
  const cached = await readCoinGeckoGlobal();
  if (cached) return cached;

  const key = COINGECKO_KEY;
  const result: CoinGeckoGlobal = {
    btcDominance: null,
    ethDominance: null,
    totalMarketCap: null,
    totalVolume24h: null,
    defiMarketCap: null,
    defiToEthRatio: null,
    defiVolume24h: null,
    defiDominance: null,
    trending: [],
    btcFundingRate: null,
    btcOpenInterest: null,
    corporateBtcHoldings: null,
    fetchedAt: Date.now(),
  };

  try {
    // Fetch all 5 endpoints in parallel (~5 calls/hour = ~3,600/month, well within 10K)
    const [globalRes, defiRes, trendingRes, derivRes, treasuryRes] = await Promise.allSettled([
      fetchWithTimeout(`https://api.coingecko.com/api/v3/global?x_cg_demo_key=${key}`, TIMEOUT),
      fetchWithTimeout(`https://api.coingecko.com/api/v3/global/decentralized_finance_defi?x_cg_demo_key=${key}`, TIMEOUT),
      fetchWithTimeout(`https://api.coingecko.com/api/v3/search/trending?x_cg_demo_key=${key}`, TIMEOUT),
      fetchWithTimeout(`https://api.coingecko.com/api/v3/derivatives?x_cg_demo_key=${key}`, TIMEOUT),
      fetchWithTimeout(`https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin?x_cg_demo_key=${key}`, TIMEOUT),
    ]);

    // 1. Global market data
    if (globalRes.status === 'fulfilled') {
      const json = await globalRes.value.json();
      if (json.data) {
        result.btcDominance = json.data.market_cap_percentage?.btc ?? null;
        result.ethDominance = json.data.market_cap_percentage?.eth ?? null;
        result.totalMarketCap = json.data.total_market_cap?.usd ?? null;
        result.totalVolume24h = json.data.total_volume?.usd ?? null;
      }
    }

    // 2. DeFi global data (Thesis 3: crypto infra > crypto assets)
    if (defiRes.status === 'fulfilled') {
      const json = await defiRes.value.json();
      if (json.data) {
        const defiMcap = json.data.defi_market_cap ? parseFloat(json.data.defi_market_cap) : null;
        const ethMcap = json.data.eth_market_cap ? parseFloat(json.data.eth_market_cap) : null;
        result.defiMarketCap = defiMcap;
        // Calculate actual ratio: DeFi market cap / ETH market cap
        // Rising = DeFi infra growing faster than ETH itself (validates Thesis 3)
        result.defiToEthRatio = (defiMcap && ethMcap && ethMcap > 0) ? round((defiMcap / ethMcap) * 100, 1) : null;
        result.defiVolume24h = json.data.trading_volume_24h ? parseFloat(json.data.trading_volume_24h) : null;
        result.defiDominance = json.data.defi_dominance ? parseFloat(json.data.defi_dominance) : null;
      }
    }

    // 3. Trending coins (sentiment/narrative gauge)
    if (trendingRes.status === 'fulfilled') {
      const json = await trendingRes.value.json();
      if (json.coins && Array.isArray(json.coins)) {
        result.trending = json.coins.slice(0, 7).map((c: { item: { name: string; symbol: string; market_cap_rank: number; price_btc?: number } }, i: number) => ({
          name: c.item?.name ?? 'Unknown',
          symbol: c.item?.symbol ?? '?',
          rank: c.item?.market_cap_rank ?? i + 1,
          price_btc: c.item?.price_btc ?? undefined,
        }));
      }
    }

    // 4. Derivatives — extract BTC perpetual funding rate and open interest
    if (derivRes.status === 'fulfilled') {
      const json = await derivRes.value.json();
      if (Array.isArray(json)) {
        // Find BTC perpetual contracts and average funding rates
        const btcPerps = json.filter((d: { symbol: string; contract_type?: string }) =>
          d.symbol?.toUpperCase().includes('BTC') &&
          (d.contract_type === 'perpetual' || d.symbol?.includes('PERP'))
        );
        if (btcPerps.length > 0) {
          const rates = btcPerps
            .map((d: { funding_rate?: number }) => d.funding_rate)
            .filter((r: number | undefined): r is number => r != null && !isNaN(r));
          if (rates.length > 0) {
            result.btcFundingRate = round(rates.reduce((s: number, r: number) => s + r, 0) / rates.length, 6);
          }
          const ois = btcPerps
            .map((d: { open_interest?: number }) => d.open_interest)
            .filter((o: number | undefined): o is number => o != null && !isNaN(o));
          if (ois.length > 0) {
            result.btcOpenInterest = round(ois.reduce((s: number, o: number) => s + o, 0), 0);
          }
        }
      }
    }

    // 5. Corporate BTC treasury (Big Story #14: MSTR risk)
    if (treasuryRes.status === 'fulfilled') {
      const json = await treasuryRes.value.json();
      if (json.total_holdings != null) {
        result.corporateBtcHoldings = json.total_holdings;
      }
    }

    await writeCoinGeckoGlobal(result);
    return result;
  } catch (err) {
    console.warn('CoinGecko enriched fetch failed:', err);
    return null;
  }
}

// ─── MARKET STATUS ───────────────────────────────────────────────────────────

function getMarketStatus(): 'pre' | 'open' | 'after' | 'closed' {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const time = et.getHours() * 60 + et.getMinutes();

  if (day === 0 || day === 6) return 'closed';
  if (time >= 240 && time < 570) return 'pre';
  if (time >= 570 && time < 960) return 'open';
  if (time >= 960 && time < 1200) return 'after';
  return 'closed';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
