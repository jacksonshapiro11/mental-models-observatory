/**
 * /api/portfolio/live — Portfolio live prices
 *
 * Uses Yahoo Finance for ALL portfolio positions. Single source, universal
 * coverage (US equities, international stocks, crypto, ETFs, futures).
 * ~15 min delay on US equities, but simpler to maintain as positions
 * change — no per-ticker source configuration needed.
 *
 * To add/remove a position: just edit the PORTFOLIO_TICKERS array.
 *
 * CDN cached for 60 seconds — all readers share one invocation.
 */

import { NextResponse } from 'next/server';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TIMEOUT = 5000;

/**
 * All portfolio tickers mapped to Yahoo Finance symbols.
 * To add a position: add { yahoo: 'SYMBOL', ticker: 'DISPLAY_NAME' }
 * To remove: delete the line.
 */
const PORTFOLIO_TICKERS = [
  // Core
  { yahoo: 'AEM', ticker: 'AEM' },
  { yahoo: '000660.KS', ticker: 'SK_HYNIX' },
  { yahoo: 'BTC-USD', ticker: 'BTC' },
  { yahoo: 'LLY', ticker: 'LLY' },
  { yahoo: 'NVO', ticker: 'NVO' },
  { yahoo: 'BRK-B', ticker: 'BRK.B' },
  // Satellite
  { yahoo: 'AAVE-USD', ticker: 'AAVE' },
  { yahoo: 'APO', ticker: 'APO' },
  { yahoo: 'KSA', ticker: 'KSA' },
  { yahoo: 'FCX', ticker: 'FCX' },
  { yahoo: 'NOW', ticker: 'NOW' },
  { yahoo: 'CTRA', ticker: 'CTRA' },
  { yahoo: 'TLT', ticker: 'TLT' },
  // Optionality
  { yahoo: 'CMPS', ticker: 'CMPS' },
  { yahoo: 'LINK-USD', ticker: 'LINK' },
  { yahoo: 'TDOC', ticker: 'TDOC' },
] as const;

// ─── GET HANDLER ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const prices = await fetchAllPrices();

    return NextResponse.json(
      { prices, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    console.error('Portfolio live error:', err);
    return NextResponse.json(
      { error: 'Portfolio data temporarily unavailable' },
      { status: 500 }
    );
  }
}

// ─── YAHOO FINANCE FETCHER ──────────────────────────────────────────────────

interface PriceResult {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  source: string;
}

async function fetchAllPrices(): Promise<Record<string, PriceResult>> {
  const results: Record<string, PriceResult> = {};

  // Fetch all tickers in parallel
  const fetches = PORTFOLIO_TICKERS.map(async ({ yahoo, ticker }) => {
    try {
      const data = await fetchYahooQuote(yahoo);
      if (data) {
        results[ticker] = data;
      }
    } catch (err) {
      console.warn(`[portfolio] ${ticker} (${yahoo}) failed:`, err instanceof Error ? err.message : err);
    }
  });

  await Promise.allSettled(fetches);

  const loaded = Object.keys(results).length;
  console.log(`[portfolio] Yahoo Finance: ${loaded}/${PORTFOLIO_TICKERS.length} positions loaded`);

  return results;
}

async function fetchYahooQuote(symbol: string): Promise<PriceResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!res.ok) {
      console.warn(`[portfolio] Yahoo ${symbol}: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta?.regularMarketPrice || meta?.previousClose == null) {
      return null;
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // Crypto gets more decimals, equities get 2
    const isCrypto = symbol.endsWith('-USD');
    const decimals = isCrypto && price < 10 ? 4 : 2;

    return {
      price: round(price, decimals),
      prevClose: round(prevClose, decimals),
      change: round(change, decimals),
      changePercent: round(changePercent, 2),
      source: 'yahoo',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
