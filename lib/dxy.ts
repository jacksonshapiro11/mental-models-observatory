/**
 * Synthetic DXY (US Dollar Index) Calculator
 *
 * DXY is an ICE proprietary product, but its composition and weights are public.
 * We calculate it from 6 forex pairs available free from Finnhub.
 *
 * Formula:
 *   DXY = 50.14348112 × (EURUSD^-0.576) × (USDJPY^0.136) × (GBPUSD^-0.119)
 *         × (USDCAD^0.091) × (USDSEK^0.042) × (USDCHF^0.036)
 *
 * Accuracy: tracks ICE DXY within ~0.1%
 */

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface DXYComponent {
  pair: string;
  symbol: string;
  weight: number;
  type: 'inverted' | 'direct';
}

export interface DXYResult {
  value: number;
  rates: Record<string, number>;
  timestamp: number;
}

export type ForexRates = Record<string, number>;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const DXY_CONSTANT = 50.14348112;

export const DXY_COMPONENTS: DXYComponent[] = [
  { pair: 'OANDA:EUR_USD', symbol: 'EURUSD', weight: -0.576, type: 'inverted' },
  { pair: 'OANDA:USD_JPY', symbol: 'USDJPY', weight: 0.136, type: 'direct' },
  { pair: 'OANDA:GBP_USD', symbol: 'GBPUSD', weight: -0.119, type: 'inverted' },
  { pair: 'OANDA:USD_CAD', symbol: 'USDCAD', weight: 0.091, type: 'direct' },
  { pair: 'OANDA:USD_SEK', symbol: 'USDSEK', weight: 0.042, type: 'direct' },
  { pair: 'OANDA:USD_CHF', symbol: 'USDCHF', weight: 0.036, type: 'direct' },
];

const REQUIRED_PAIRS = ['EURUSD', 'USDJPY', 'GBPUSD', 'USDCAD', 'USDSEK', 'USDCHF'];

// ─── CALCULATION ─────────────────────────────────────────────────────────────

/**
 * Calculate DXY from forex rates
 */
export function calculateDXY(rates: ForexRates): number | null {
  if (!rates) return null;

  for (const pair of REQUIRED_PAIRS) {
    if (rates[pair] == null || rates[pair] <= 0) {
      console.warn(`DXY: missing or invalid rate for ${pair}`);
      return null;
    }
  }

  let dxy = DXY_CONSTANT;
  for (const { symbol, weight } of DXY_COMPONENTS) {
    dxy *= Math.pow(rates[symbol]!, weight);
  }

  return Math.round(dxy * 100) / 100;
}

/**
 * Fetch all 6 forex pairs from Finnhub and calculate DXY
 */
export async function fetchDXY(finnhubKey: string, timeout = 4000): Promise<DXYResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    // Stagger requests slightly to avoid Finnhub rate limit bursts
    const fetches = DXY_COMPONENTS.map(async ({ pair, symbol }, idx) => {
      // 50ms stagger between requests to reduce rate-limit risk
      if (idx > 0) await new Promise(r => setTimeout(r, 50 * idx));
      const url = `https://finnhub.io/api/v1/quote?symbol=${pair}&token=${finnhubKey}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const status = res.status;
        const body = await res.text().catch(() => '');
        throw new Error(`Finnhub ${symbol}: HTTP ${status} — ${body.slice(0, 100)}`);
      }
      const data = await res.json();
      if (!data.c || data.c <= 0) {
        throw new Error(`Finnhub ${symbol}: returned invalid rate c=${data.c} (full response: ${JSON.stringify(data).slice(0, 100)})`);
      }
      return { symbol, rate: data.c as number };
    });

    const results = await Promise.allSettled(fetches);
    const rates: ForexRates = {};
    const failedPairs: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        rates[result.value.symbol] = result.value.rate;
      } else {
        failedPairs.push(DXY_COMPONENTS[i]!.symbol);
        console.warn(`DXY forex fetch failed [${DXY_COMPONENTS[i]!.symbol}]:`, result.reason?.message);
      }
    }

    if (failedPairs.length > 0) {
      console.warn(`DXY: ${failedPairs.length}/6 forex pairs failed: ${failedPairs.join(', ')}. Cannot calculate DXY.`);
      return null;
    }

    const value = calculateDXY(rates);
    if (value === null) return null;

    return { value, rates, timestamp: Date.now() };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('DXY: forex fetch timed out after', timeout, 'ms');
    } else {
      console.error('DXY: unexpected error:', err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback: Fetch DXY directly from Yahoo Finance (DX-Y.NYB)
 * Used when Finnhub forex pairs fail (rate limits, timeouts, etc.)
 */
export async function fetchDXYFromYahoo(timeout = 5000): Promise<DXYResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=1d&interval=1m';
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`DXY Yahoo fallback: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const quote = data?.chart?.result?.[0]?.meta;
    const price = quote?.regularMarketPrice;

    if (!price || price <= 0) {
      console.warn('DXY Yahoo fallback: no valid price in response');
      return null;
    }

    console.log(`DXY Yahoo fallback: ${price.toFixed(2)}`);
    return { value: Math.round(price * 100) / 100, rates: {}, timestamp: Date.now() };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('DXY Yahoo fallback: timed out');
    } else {
      console.warn('DXY Yahoo fallback error:', err);
    }
    return null;
  }
}
