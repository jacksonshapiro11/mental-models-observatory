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
import { fetchDXY, fetchDXYFromYahoo, type DXYResult } from '@/lib/dxy';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY!;
const TIMEOUT = 5000;

// Indices fetched directly from Yahoo Finance (actual prices, no multiplier)
const INDEX_SYMBOLS = [
  { yahoo: '%5EGSPC', name: 'SPX', decimals: 0 },
  { yahoo: '%5ENDX',  name: 'NDX', decimals: 0 },
  { yahoo: '%5EDJI',  name: 'DJI', decimals: 0 },
  { yahoo: '%5ERUT',  name: 'RUT', decimals: 0 },  // Russell 2000
] as const;

// ETFs fetched from Finnhub (direct prices, no multiplier needed)
const ETF_PROXIES = [
  { symbol: 'IGV', name: 'IGV' },   // SaaS/Software ETF (Thesis 1)
  { symbol: 'SMH', name: 'SMH' },   // Semiconductor ETF (Thesis 4, BS #7)
  { symbol: 'IWF', name: 'IWF' },   // Russell 1000 Growth
  { symbol: 'IWD', name: 'IWD' },   // Russell 1000 Value
  { symbol: 'XLE', name: 'XLE' },   // Energy Select SPDR (Iran/oil)
  { symbol: 'ARKK', name: 'ARKK' }, // ARK Innovation (speculative tech)
] as const;

// All equity names (indices + ETFs) for response building
const ALL_EQUITY_NAMES = [...INDEX_SYMBOLS.map(i => i.name), ...ETF_PROXIES.map(e => e.name)];

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
    // - Indices (SPX/NDX/DJI): Yahoo Finance actual index prices (no ETF proxy math)
    // - ETFs: Finnhub real-time quotes (direct prices, multiplier=1)
    // - Commodities: Yahoo Finance futures (actual futures prices, ~15min delay but no ETF tracking error)
    const [cryptoPrices, indexPrices, etfPrices, commodityPrices, dxyResult, coinGeckoGlobal] =
      await Promise.allSettled([
        fetchCryptoPrices(),
        fetchIndexPrices(),
        fetchETFPrices(),
        fetchCommodityPrices(),
        fetchDXY(FINNHUB_KEY, TIMEOUT),
        fetchCoinGeckoGlobalCached(),
      ]);

    // Merge index prices (Yahoo) and ETF prices (Finnhub) into one equityPrices map
    const mergedEquityPrices = {
      ...(indexPrices.status === 'fulfilled' ? indexPrices.value : {}),
      ...(etfPrices.status === 'fulfilled' ? etfPrices.value : {}),
    };

    // DXY: try Finnhub first, fall back to Yahoo Finance if Finnhub fails
    let dxyData: DXYResult | null = dxyResult.status === 'fulfilled' ? dxyResult.value : null;
    if (!dxyData) {
      console.log('[live] DXY Finnhub failed, trying Yahoo Finance fallback...');
      try {
        dxyData = await fetchDXYFromYahoo(TIMEOUT);
        if (dxyData) console.log(`[live] DXY Yahoo fallback succeeded: ${dxyData.value}`);
      } catch (err) {
        console.warn('[live] DXY Yahoo fallback also failed:', err);
      }
    }

    const response = buildResponse({
      cryptoPrices: cryptoPrices.status === 'fulfilled' ? cryptoPrices.value : {},
      equityPrices: mergedEquityPrices,
      commodityPrices: commodityPrices.status === 'fulfilled' ? commodityPrices.value : {},
      dxy: dxyData,
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
  cryptoPrices: Record<string, { price: number; prevClose: number; source: string }>;
  equityPrices: Record<string, { price: number; prevClose: number; source: string }>;
  commodityPrices: Record<string, { price: number; prevClose: number; source: string }>;
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
  for (const name of ALL_EQUITY_NAMES) {
    const live = equityPrices[name];
    const ref = snapshot?.equities?.[name];
    equities[name] = {
      price: live?.price ?? ref?.latestClose ?? null,
      changes: mergeChanges(live?.price ?? null, ref ?? null, live?.prevClose),
      mas: ref?.mas || {},
    };
  }

  const crypto: Record<string, unknown> = {};
  for (const pair of CRYPTO_PAIRS) {
    const live = cryptoPrices[pair.name];
    const ref = snapshot?.crypto?.[pair.name];
    // Use Binance prevClosePrice (midnight UTC) for 1D; fall back to snapshot if unavailable
    const prevClose = (live?.prevClose && live.prevClose > 0) ? live.prevClose : undefined;
    crypto[pair.name] = {
      price: live?.price ?? ref?.latestClose ?? null,
      changes: mergeChanges(live?.price ?? null, ref ?? null, prevClose),
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
      changes: mergeChanges(live?.price ?? null, ref ?? null, live?.prevClose),
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

function mergeChanges(livePrice: number | null, snapshotRef: AssetRef | null, prevClose?: number | null): Record<string, number> {
  if (!snapshotRef || !snapshotRef.changes) return {};

  const changes = { ...snapshotRef.changes };

  // For 1D change: use prevClose from the live data source (yesterday's actual close)
  // rather than snapshot.latestClose (which may be stale or from a different time).
  const baseline = prevClose ?? snapshotRef.latestClose;
  if (livePrice && baseline && baseline > 0) {
    changes['1D'] = round(((livePrice - baseline) / baseline) * 100, 2);
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

async function fetchCryptoPrices(): Promise<Record<string, { price: number; prevClose: number; source: string }>> {
  const results: Record<string, { price: number; prevClose: number; source: string }> = {};

  // Try Binance first (real-time, no API key needed)
  // Use /ticker/24hr instead of /ticker/price to get prevClosePrice (midnight UTC close)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const fetches = CRYPTO_PAIRS.map(async ({ symbol, name }) => {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`);
      const data = await res.json();
      results[name] = {
        price: parseFloat(data.lastPrice),
        prevClose: parseFloat(data.prevClosePrice),  // midnight UTC close
        source: 'binance',
      };
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
            results[name] = { price: data[cgId].usd, prevClose: 0, source: 'coingecko' };
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

// ─── INDEX PRICES (Yahoo Finance — actual index values, no ETF proxy) ────────
// SPX, NDX, DJI fetched directly. ~15min delay on Yahoo free tier,
// but 100% accurate prices (no multiplier drift or ETF tracking error).

async function fetchIndexPrices(): Promise<Record<string, { price: number; prevClose: number; source: string }>> {
  const results: Record<string, { price: number; prevClose: number; source: string }> = {};

  try {
    const fetches = INDEX_SYMBOLS.map(async ({ yahoo, name, decimals }) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?interval=1d&range=1d`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (!res.ok) throw new Error(`Yahoo ${name}: ${res.status}`);
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
      if (price && price > 0) {
        results[name] = {
          price: round(price, decimals),
          prevClose: prevClose ? round(prevClose, decimals) : round(price, decimals),
          source: 'yahoo',
        };
      }
    });
    await Promise.allSettled(fetches);
  } catch (err) {
    console.error('Index fetch error:', err);
  }

  const sources = Object.entries(results).map(([k, v]) => `${k}:${v.price}`).join(', ');
  console.log(`[live] Index prices: ${sources || 'NONE — using snapshot'}`);

  return results;
}

// ─── ETF PRICES (Finnhub — direct quotes, no multiplier) ────────────────────
// ETFs like IGV, SMH, IWM etc. — their price IS the price, multiplier=1.

async function fetchETFPrices(): Promise<Record<string, { price: number; prevClose: number; source: string }>> {
  const results: Record<string, { price: number; prevClose: number; source: string }> = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const fetches = ETF_PROXIES.map(async ({ symbol, name }) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Finnhub ${symbol}: ${res.status}`);
      const data = await res.json();
      results[name] = {
        price: round(data.c, 2),
        prevClose: round(data.pc, 2),
        source: 'finnhub',
      };
    });

    await Promise.allSettled(fetches);
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') console.error('ETF fetch error:', err);
  } finally {
    clearTimeout(timer);
  }

  return results;
}

// ─── COMMODITY PRICES (Yahoo Finance futures → snapshot fallback) ────────────
// Uses actual futures symbols (GC=F, SI=F, BZ=F, HG=F, NG=F) for accurate prices
// without ETF tracking error, contango drag, or expense ratio distortion.
// ~15 minute delay on Yahoo free tier, but far more accurate than ETF proxies.

async function fetchCommodityPrices(): Promise<Record<string, { price: number; prevClose: number; source: string }>> {
  const results: Record<string, { price: number; prevClose: number; source: string }> = {};

  try {
    const fetches = COMMODITY_FUTURES.map(async ({ yahoo, name }) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahoo}?interval=1d&range=1d`;
      const res = await fetchWithTimeout(url, TIMEOUT);
      if (!res.ok) throw new Error(`Yahoo ${name}: ${res.status}`);
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice ?? meta?.previousClose;
      const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
      if (price && price > 0) {
        results[name] = { price: round(price, 2), prevClose: prevClose ? round(prevClose, 2) : round(price, 2), source: 'yahoo' };
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
