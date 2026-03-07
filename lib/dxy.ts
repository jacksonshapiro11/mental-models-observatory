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
    const fetches = DXY_COMPONENTS.map(async ({ pair, symbol }) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${pair}&token=${finnhubKey}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Finnhub ${symbol}: ${res.status}`);
      const data = await res.json();
      return { symbol, rate: data.c as number };
    });

    const results = await Promise.allSettled(fetches);
    const rates: ForexRates = {};
    let failures = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        rates[result.value.symbol] = result.value.rate;
      } else {
        failures++;
        console.warn('DXY forex fetch failed:', result.reason?.message);
      }
    }

    if (failures > 0) {
      console.warn(`DXY: ${failures}/6 forex pairs failed`);
      return null;
    }

    const value = calculateDXY(rates);
    if (value === null) return null;

    return { value, rates, timestamp: Date.now() };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('DXY: forex fetch timed out');
    } else {
      console.error('DXY: unexpected error:', err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
