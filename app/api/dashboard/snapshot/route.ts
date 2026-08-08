/**
 * /api/dashboard/snapshot — App Router
 *
 * GET: Cron twice on weekdays — morning 09:00 UTC (~5 AM ET) and after-close
 *   21:00 UTC (~5 PM ET). After-close refreshes snapshotDate + 5D/1M/1Y/MAs/US10Y
 *   so horizons match the day's close. Live refreshes spot + ALL % horizons from
 *   stored absolute baselines (except changeProxy assets like NATGAS→UNG).
 *   - Fetches today's prices from Yahoo Finance (same source as seed-prices.mjs)
 *   - Reads historical data from Redis (populated by seed-prices.mjs)
 *   - Calculates % changes (1D/5D trading sessions; 1M/1Y calendar — Yahoo chartPreviousClose)
 *     and stores absolute baselines so live can recompute every horizon
 *   - Writes to Upstash: dashboard:snapshot:latest + dashboard:history:YYYY-MM-DD
 *
 * PATCH: Manual field updates (FedWatch, ETF flows) during evening session.
 *
 * Protected by SNAPSHOT_SECRET header or query param.
 */

import { fetchDXY, fetchDXYFromYahoo, type DXYResult } from '@/lib/dxy';
import { isCronAuthorized } from '@/lib/cron-auth';
import {
  writeManualFields,
  writePriceHistory,
  writeSnapshot,
  readHistoryBundle,
  writeHistoryBundle,
  type DashboardSnapshot,
  type PriceHistoryEntry,
} from '@/lib/upstash';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;

const TIMEOUT = 8000;

// 2026-07-28: the 1y-series fetches made this route exceed Vercel's ~10s default function
// limit (every other long route here already exports maxDuration; this one never did because
// the old range=1d fetches squeaked under). The timeout was silent from the dashboard's side —
// the cron 504'd and the stale snapshot just stayed. 120s is ~6× the batched worst case.
export const maxDuration = 120;

// Change/MA math lives in lib/dashboard-math.ts (pure, gated by scripts/dashboard-math-gate.ts).
// 2026-07-27: % changes are now computed from Yahoo's own ADJUSTED 1y series per asset —
// split-proof (IWF 4:1 served 1Y=−73% vs real +6%), gap-proof (SMH's baseline landed weeks
// early, +95% vs real ~+88%), dividend-consistent. Redis history remains the source for MAs
// only, with a scale-break tripwire so a corrupted window is withheld instead of shipped.
import {
  MA_PERIODS,
  calculateChangesChecked,
  calculateMAs,
  detectScaleBreaks,
  backAdjustScaleBreaks,
  seriesFromYahooChart,
  mergeLatestIntoSeries,
  type PriceSeries,
} from '@/lib/dashboard-math';

// All assets we track — matches seed-prices.mjs exactly
// Primary: actual index/futures symbols (direct prices, no multiplier math)
// Fallback: ETF proxy × multiplier if actual symbol fails
// changeYahoo (optional): continuous series used ONLY for % changes — spot stays on `yahoo`.
//   NATGAS: NG=F continuous front-month rolls cliff (~×1.9 on 2026-01-29); UNG is the
//   continuous Henry Hub proxy so 5D/1M/1Y can publish without raising maxJumpRatio.
type AssetConfig = {
  yahoo: string;
  fallback: string | null;
  fallbackMultiplier: number;
  category: string;
  changeYahoo?: string;
};
const ASSETS: Record<string, AssetConfig> = {
  // Equities — actual index symbols (direct prices)
  SPX: {
    yahoo: '%5EGSPC',
    fallback: 'SPY',
    fallbackMultiplier: 10,
    category: 'equities',
  },
  NDX: {
    yahoo: '%5ENDX',
    fallback: 'QQQ',
    fallbackMultiplier: 40.95,
    category: 'equities',
  },
  DJI: {
    yahoo: '%5EDJI',
    fallback: 'DIA',
    fallbackMultiplier: 100,
    category: 'equities',
  },
  RUT: {
    yahoo: '%5ERUT',
    fallback: 'IWM',
    fallbackMultiplier: 10,
    category: 'equities',
  },
  IGV: {
    yahoo: 'IGV',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },
  SMH: {
    yahoo: 'SMH',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },
  IWF: {
    yahoo: 'IWF',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },
  IWD: {
    yahoo: 'IWD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },
  XLE: {
    yahoo: 'XLE',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },
  ARKK: {
    yahoo: 'ARKK',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'equities',
  },

  // Crypto (direct price, multiplier always 1)
  BTC: {
    yahoo: 'BTC-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },
  ETH: {
    yahoo: 'ETH-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },
  SOL: {
    yahoo: 'SOL-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },
  AAVE: {
    yahoo: 'AAVE-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },
  UNI: {
    yahoo: 'UNI7083-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },
  LINK: {
    yahoo: 'LINK-USD',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'crypto',
  },

  // Commodities — actual futures symbols (direct prices)
  GOLD: {
    yahoo: 'GC%3DF',
    fallback: 'GLD',
    fallbackMultiplier: 10,
    category: 'commodities',
  },
  SILVER: {
    yahoo: 'SI%3DF',
    fallback: 'SLV',
    fallbackMultiplier: 1,
    category: 'commodities',
  },
  BRENT: {
    yahoo: 'BZ%3DF',
    fallback: 'BNO',
    fallbackMultiplier: 1,
    category: 'commodities',
  },
  COPPER: {
    yahoo: 'HG%3DF',
    fallback: 'CPER',
    fallbackMultiplier: 1,
    category: 'commodities',
  },
  NATGAS: {
    yahoo: 'NG%3DF',
    fallback: 'UNG',
    fallbackMultiplier: 1,
    category: 'commodities',
    changeYahoo: 'UNG',
  },

  // Rates (Treasury yields — direct, multiplier always 1)
  US10Y: {
    yahoo: '%5ETNX',
    fallback: null,
    fallbackMultiplier: 1,
    category: 'rates',
  },
};

// ─── DIAGNOSTICS ─────────────────────────────────────────────────────────────

const _warnings: string[] = [];
function warn(msg: string) {
  console.warn(msg);
  _warnings.push(msg);
}

// ─── GET: Daily Snapshot ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
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
      {
        error: err instanceof Error ? err.message : 'Unknown error',
        warnings: [..._warnings],
      },
      { status: 500 }
    );
  }
}

// ─── PATCH: Manual Field Update ──────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!isCronAuthorized(req)) {
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

async function generateSnapshot(): Promise<
  DashboardSnapshot & { _warnings?: string[] }
> {
  const now = Date.now();

  // Step 1: Fetch today's prices from Yahoo Finance for all assets
  console.log("[snapshot] Fetching today's prices from Yahoo Finance...");
  const todayPrices = await fetchAllYahooPrices();
  console.log(
    `[snapshot] Got prices for ${Object.keys(todayPrices).length} assets`
  );

  // Step 2: Read historical data from Redis (populated by seed-prices.mjs)
  console.log('[snapshot] Reading historical data from Redis...');
  const history = await readRecentHistory(1500);
  console.log(`[snapshot] Found ${history.length} historical days in Redis`);

  if (history.length < 50) {
    warn(
      `Only ${history.length} history days in Redis — need at least 50 for MAs. Run: node scripts/seed-prices.mjs`
    );
  }

  // Step 3: Build per-asset price arrays from history
  const assetPrices = buildAssetPriceArrays(history);

  // Step 4: Append today's prices to the arrays
  // Use the actual trading date from Yahoo's regularMarketTime (not wall-clock time).
  // Cron runs at 6 AM ET, so Yahoo returns yesterday's closing price — and the
  // tradingDate from Yahoo will correctly be yesterday's date.
  // Fallback: current ET date if Yahoo didn't provide a trading date.
  const fallbackDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date());

  // Determine the canonical snapshot date from equity trading dates (most reliable)
  const equityDates = Object.values(todayPrices)
    .map(d => d.tradingDate)
    .filter((d): d is string => d != null);
  // Most common trading date across all assets = the actual market date
  const today = mode(equityDates) || fallbackDate;
  console.log(
    `[snapshot] Using trading date: ${today} (fallback would be: ${fallbackDate})`
  );

  for (const [name, data] of Object.entries(todayPrices)) {
    if (!assetPrices[name]) {
      assetPrices[name] = {
        dates: [],
        prices: [],
        category: ASSETS[name]?.category || 'equities',
      };
    }
    const arr = assetPrices[name]!;
    // Use the per-asset trading date if available, otherwise the canonical date
    const assetDate = data.tradingDate || today;
    if (
      arr.dates.length === 0 ||
      arr.dates[arr.dates.length - 1] !== assetDate
    ) {
      arr.dates.push(assetDate);
      arr.prices.push(data.adjustedPrice);
    } else {
      // Update this date's price with the latest
      arr.prices[arr.prices.length - 1] = data.adjustedPrice;
    }
  }

  // Step 5: Calculate changes and MAs for each asset
  type AssetOut = {
    latestClose: number;
    changes: Record<string, number>;
    baselines: Record<string, number>;
    mas: Record<string, number>;
    multiplier: number;
    changeProxy?: boolean;
  };
  const equities: Record<string, AssetOut> = {};
  const crypto: Record<string, AssetOut> = {};
  const commodities: Record<string, AssetOut> = {};
  const rates: Record<string, AssetOut> = {};

  const categoryMap: Record<string, typeof equities> = {
    equities,
    crypto,
    commodities,
    rates,
  };

  for (const [name, arr] of Object.entries(assetPrices)) {
    if (arr.prices.length === 0) continue;

    const latest = arr.prices[arr.prices.length - 1]!;
    const multiplier =
      todayPrices[name]?.multiplier ?? ASSETS[name]?.fallbackMultiplier ?? 1;
    const jumpRatio = arr.category === 'crypto' ? 1.6 : 1.5;
    const changeProxy = Boolean(ASSETS[name]?.changeYahoo);

    // % changes: PRIMARY source is the freshly-fetched ADJUSTED 1y series (split/dividend/
    // gap-proof); Redis history is only the fallback when the fetch failed. Either path runs
    // the tripwires — a series with an unexplained cliff or a stale baseline publishes
    // NOTHING for the affected horizon rather than a wrong number. (2026-07-27: IWF −73%.)
    // Absolute baselines ship with the snapshot so live can recompute every horizon from
    // the price on screen (2026-07-29: frozen 5D/1M/1Y next to moved live price).
    let changes: Record<string, number> = {};
    let baselines: Record<string, number> = {};
    const fetched = todayPrices[name];
    let usedSeries = false;
    if (fetched?.series) {
      // changeSeriesPrice: when % changes use a continuous proxy (NATGAS→UNG), merge that
      // proxy's own quote — never NG=F dollars into an UNG series (instant scale break).
      const mergePrice = fetched.changeSeriesPrice ?? fetched.adjustedPrice;
      const merged = mergeLatestIntoSeries(
        fetched.series,
        mergePrice,
        fetched.tradingDate
      );
      const breaks = detectScaleBreaks(merged, jumpRatio);
      if (breaks.length > 0) {
        warn(
          `${name}: ${breaks.length} scale break(s) in fetched series [${breaks.map(b => `${b.date}×${b.ratio}`).join(', ')}] — changes withheld`
        );
        usedSeries = true; // do NOT fall back to raw history, it is wronger
      } else {
        const r = calculateChangesChecked(merged.dates, merged.prices);
        if (r.staleBaselines.length > 0) {
          warn(
            `${name}: stale baseline for ${r.staleBaselines.join(', ')} — those horizons withheld`
          );
        }
        changes = r.changes;
        baselines = r.baselines;
        usedSeries = true;
      }
    }
    if (!usedSeries) {
      const histSeries = { dates: arr.dates, prices: arr.prices };
      const breaks = detectScaleBreaks(histSeries, jumpRatio);
      if (breaks.length > 0) {
        warn(
          `${name}: history-fallback series has ${breaks.length} scale break(s) — changes withheld (re-seed: node scripts/seed-prices.mjs)`
        );
      } else {
        const r = calculateChangesChecked(arr.dates, arr.prices);
        if (r.staleBaselines.length > 0) {
          warn(
            `${name}: history-fallback stale baseline for ${r.staleBaselines.join(', ')} — withheld`
          );
        }
        changes = r.changes;
        baselines = r.baselines;
      }
    }

    // MAs: Redis history is the only source deep enough (200W = 1000 trading days) — but a
    // window that crosses a scale break (raw pre-split closes) produces a blended-scale MA,
    // so each window is checked and a corrupted MA is withheld, never shipped.
    // changeYahoo assets (NATGAS): front-month roll cliffs are *explained* — Panama
    // back-adjust into current-contract units so 200D/200W can publish (UNG stays for %).
    const maSource = ASSETS[name]?.changeYahoo
      ? backAdjustScaleBreaks(
          { dates: arr.dates, prices: arr.prices },
          jumpRatio
        )
      : { dates: arr.dates, prices: arr.prices };
    const allMas = calculateMAs(maSource.prices);
    const mas: Record<string, number> = {};
    for (const [label, period] of Object.entries(MA_PERIODS)) {
      if (allMas[label] == null) continue;
      const window = {
        dates: maSource.dates.slice(-period),
        prices: maSource.prices.slice(-period),
      };
      const wBreaks = detectScaleBreaks(window, jumpRatio);
      if (wBreaks.length > 0) {
        warn(
          `${name}: ${label} MA window crosses a scale break [${wBreaks.map(b => `${b.date}×${b.ratio}`).join(', ')}] — withheld (re-seed: node scripts/seed-prices.mjs)`
        );
        continue;
      }
      mas[label] = allMas[label]!;
    }

    const cat = categoryMap[arr.category];
    if (cat) {
      const entry: AssetOut = {
        latestClose: round(latest, 2),
        changes,
        baselines,
        mas,
        multiplier,
      };
      if (changeProxy) entry.changeProxy = true;
      cat[name] = entry;
    }
  }

  // Step 6: Fetch metadata (DXY via Finnhub → Yahoo fallback, Fear & Greed)
  const [dxyResult, fgResult] = await Promise.allSettled([
    FINNHUB_KEY ? fetchDXY(FINNHUB_KEY, TIMEOUT) : Promise.resolve(null),
    fetchFearGreed(),
  ]);

  let dxyData = dxyResult.status === 'fulfilled' ? dxyResult.value : null;
  if (!dxyData) {
    console.log(
      '[snapshot] DXY Finnhub failed, trying Yahoo Finance fallback...'
    );
    try {
      dxyData = await fetchDXYFromYahoo(TIMEOUT);
      if (dxyData)
        console.log(`[snapshot] DXY Yahoo fallback: ${dxyData.value}`);
    } catch (err) {
      console.warn('[snapshot] DXY Yahoo fallback failed:', err);
    }
  }

  // DXY real 1Y change from its own adjusted series. (2026-07-27: the live route was
  // computing "yoyChange" against YESTERDAY's snapshot value — a 1-day move labeled YoY
  // on the dashboard. The honest number comes from the index's 1y series.)
  let dxySnapshot: (DXYResult & { yoyChange?: number | null }) | null = dxyData;
  if (dxyData) {
    let yoyChange: number | null = null;
    try {
      const dxySeries = await fetchYahooSeriesWithMeta('DX-Y.NYB', false);
      if (dxySeries?.series) {
        const merged = mergeLatestIntoSeries(
          dxySeries.series,
          dxyData.value,
          dxySeries.tradingDate
        );
        const breaks = detectScaleBreaks(merged, 1.5);
        if (breaks.length === 0) {
          yoyChange =
            calculateChangesChecked(merged.dates, merged.prices).changes[
              '1Y'
            ] ?? null;
        } else {
          warn(`DXY: scale break in series — yoyChange withheld`);
        }
      }
    } catch (err) {
      warn(
        `DXY 1Y series fetch failed: ${err instanceof Error ? err.message : err}`
      );
    }
    dxySnapshot = { ...dxyData, yoyChange };
  }

  return {
    generatedAt: now,
    date: today,
    equities,
    crypto,
    commodities,
    rates,
    dxy: dxySnapshot,
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
  /** Full ADJUSTED daily series used for % changes (fallback-symbol series is
   *  pre-multiplied) — source of truth for horizons since 2026-07-27. May be a
   *  continuous proxy (changeYahoo) while adjustedPrice stays on the spot symbol. */
  series: PriceSeries | null;
  /** Latest quote for `series` when it comes from changeYahoo (not adjustedPrice). */
  changeSeriesPrice?: number;
}

async function fetchAllYahooPrices(): Promise<
  Record<string, YahooPriceResult>
> {
  const results: Record<string, YahooPriceResult> = {};

  // Batched with limited concurrency (2026-07-28): serial fetch + 200ms sleeps × 22 assets
  // × 1y payloads blew past the function limit. Four at a time keeps Yahoo happy and the
  // whole sweep under ~8s; each asset's primary→fallback ladder stays serial within its task.
  const CONCURRENCY = 4;

  async function fetchOne(name: string, asset: AssetConfig): Promise<void> {
    const isCrypto = asset.category === 'crypto';
    try {
      // Try primary symbol first (actual index/futures — direct price, no multiplier)
      const primary = await fetchYahooSeriesWithMeta(asset.yahoo, isCrypto);
      if (primary && primary.price > 0) {
        let series = primary.series;
        let changeSeriesPrice: number | undefined;
        // NATGAS-class: spot stays on front-month futures; % changes use continuous proxy.
        if (asset.changeYahoo) {
          try {
            const proxy = await fetchYahooSeriesWithMeta(
              asset.changeYahoo,
              isCrypto
            );
            if (
              proxy?.series &&
              proxy.series.prices.length >= 30 &&
              proxy.price > 0
            ) {
              series = proxy.series;
              changeSeriesPrice = proxy.price;
              console.log(
                `[snapshot] ${name}: spot ${asset.yahoo}=${primary.price}; % changes from ${asset.changeYahoo} (${proxy.series.prices.length} bars, date: ${primary.tradingDate})`
              );
            } else {
              warn(
                `${name}: changeYahoo ${asset.changeYahoo} thin/missing — using primary series (may hit scale-break)`
              );
              console.log(
                `[snapshot] ${name}: ${asset.yahoo} = ${primary.price} (direct, date: ${primary.tradingDate}, series: ${primary.series?.prices.length ?? 0} bars)`
              );
            }
          } catch (err) {
            warn(
              `${name}: changeYahoo ${asset.changeYahoo} failed (${err instanceof Error ? err.message : err}) — using primary series`
            );
            console.log(
              `[snapshot] ${name}: ${asset.yahoo} = ${primary.price} (direct, date: ${primary.tradingDate}, series: ${primary.series?.prices.length ?? 0} bars)`
            );
          }
        } else {
          console.log(
            `[snapshot] ${name}: ${asset.yahoo} = ${primary.price} (direct, date: ${primary.tradingDate}, series: ${primary.series?.prices.length ?? 0} bars)`
          );
        }
        results[name] = {
          adjustedPrice: round(primary.price, 2),
          multiplier: 1,
          tradingDate: primary.tradingDate,
          series,
          ...(changeSeriesPrice != null ? { changeSeriesPrice } : {}),
        };
        return;
      }
    } catch (err) {
      warn(
        `Yahoo ${name} primary (${asset.yahoo}) failed: ${err instanceof Error ? err.message : err}`
      );
    }

    // Fallback: use ETF proxy × multiplier (series pre-multiplied so all math stays consistent)
    if (asset.fallback) {
      try {
        const fallback = await fetchYahooSeriesWithMeta(
          asset.fallback,
          isCrypto
        );
        if (fallback && fallback.price > 0) {
          const adjusted = round(fallback.price * asset.fallbackMultiplier, 2);
          warn(
            `[snapshot] ${name}: using fallback ${asset.fallback}=${fallback.price} × ${asset.fallbackMultiplier} = ${adjusted}`
          );
          results[name] = {
            adjustedPrice: adjusted,
            multiplier: asset.fallbackMultiplier,
            tradingDate: fallback.tradingDate,
            series: fallback.series
              ? {
                  dates: fallback.series.dates,
                  prices: fallback.series.prices.map(p =>
                    round(p * asset.fallbackMultiplier, 4)
                  ),
                }
              : null,
          };
        }
      } catch (err) {
        warn(
          `Yahoo ${name} fallback (${asset.fallback}) failed: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  const entries = Object.entries(ASSETS);
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const chunk = entries.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(([name, asset]) => fetchOne(name, asset))
    );
    if (i + CONCURRENCY < entries.length) await sleep(150);
  }

  return results;
}

async function fetchYahooSeriesWithMeta(
  symbol: string,
  isCrypto: boolean
): Promise<{
  price: number;
  tradingDate: string | null;
  series: PriceSeries | null;
} | null> {
  // 2y of ADJUSTED daily closes + the live quote in ONE request — the % changes come from
  // this self-consistent series (split/dividend/gap-proof), not from stored raw history.
  // range=2y (2026-07-28): range=1y is anchored to NOW, but the 1Y lookback is anchored to
  // the LAST CLOSE — pre-close the calendar target can precede the window's first bar and
  // the 1Y vanished. A 2y window puts every 1Y/1M target deep inside the data.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y&events=div%7Csplit`;
  const res = await fetchWithTimeout(url, TIMEOUT, {
    'User-Agent': 'Mozilla/5.0',
  });
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const meta = result?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number' || price <= 0) return null;

  // Extract the actual trading date from Yahoo's regularMarketTime (Unix timestamp)
  // Convert using the exchange's timezone to get the correct trading date
  let tradingDate: string | null = null;
  if (meta?.regularMarketTime) {
    const tz = meta?.exchangeTimezoneName || 'America/New_York';
    tradingDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
      new Date(meta.regularMarketTime * 1000)
    );
  }

  let series: PriceSeries | null = null;
  try {
    series = seriesFromYahooChart(result, { crypto: isCrypto });
    if (series.prices.length < 30) series = null; // too thin to trust for calendar changes
  } catch {
    series = null;
  }

  return { price, tradingDate, series };
}

// ─── READ HISTORICAL DATA FROM REDIS ─────────────────────────────────────────

type HistoryEntry = PriceHistoryEntry;

async function readRecentHistory(maxDays: number): Promise<HistoryEntry[]> {
  // Fast path: single bundled key (1 Redis command vs up to 1500 per-key GETs)
  const bundle = await readHistoryBundle();
  if (bundle.length >= 50) {
    console.log(`[snapshot] Loaded ${bundle.length} days from history bundle`);
    return bundle.slice(-maxDays);
  }

  console.log(
    '[snapshot] History bundle empty/small — falling back to per-day keys'
  );
  const entries = await readRecentHistoryPerKey(maxDays);
  if (entries.length > 0) {
    await writeHistoryBundle(entries).catch(err => {
      console.warn('[snapshot] Failed to backfill history bundle:', err);
    });
  }
  return entries;
}

async function readRecentHistoryPerKey(
  maxDays: number
): Promise<HistoryEntry[]> {
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
    let results: unknown[];
    try {
      results = await pipeline.exec();
    } catch (err) {
      console.error('[snapshot] Redis history batch read failed:', err);
      break;
    }

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

function buildAssetPriceArrays(
  history: HistoryEntry[]
): Record<string, AssetPriceArray> {
  const arrays: Record<string, AssetPriceArray> = {};

  for (const entry of history) {
    const categories: {
      cat: string;
      assets: Record<string, { latestClose: number }>;
    }[] = [
      { cat: 'equities', assets: entry.equities || {} },
      { cat: 'crypto', assets: entry.crypto || {} },
      { cat: 'commodities', assets: entry.commodities || {} },
      { cat: 'rates', assets: entry.rates || {} },
    ];

    for (const { cat, assets } of categories) {
      for (const [name, data] of Object.entries(assets)) {
        if (!data || data.latestClose == null || data.latestClose <= 0)
          continue;
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
// calculateChangesChecked / calculateMAs / detectScaleBreaks live in @/lib/dashboard-math
// (pure + gated by scripts/dashboard-math-gate.ts).

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
    warn(
      `Fear & Greed fetch failed: ${err instanceof Error ? err.message : err}`
    );
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

function fetchWithTimeout(
  url: string,
  timeout: number,
  headers?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {
    signal: controller.signal,
    ...(headers ? { headers: { ...headers } } : {}),
  }).finally(() => clearTimeout(timer));
}
