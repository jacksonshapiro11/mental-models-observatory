'use client';

import { useEffect, useState } from 'react';

interface PriceData {
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  source: string;
}

interface PortfolioPrices {
  prices: Record<string, PriceData>;
  updatedAt: string;
}

/* Map portfolio tickers to API response keys */
const TICKER_MAP: Record<string, string> = {
  'AEM': 'AEM',
  'SK Hynix (000660.KS)': 'SK_HYNIX',
  'SK HYNIX (000660.KS)': 'SK_HYNIX',
  'BTC': 'BTC',
  'LLY / NVO': 'LLY',    // We'll show both
  'LLY': 'LLY',
  'NVO': 'NVO',
  'BRK.B': 'BRK.B',
  'AAVE': 'AAVE',
  'APO': 'APO',
  'KSA': 'KSA',
  'FCX': 'FCX',
  'NOW': 'NOW',
  'CTRA': 'CTRA',
  'Short TLT': 'TLT',
  'TLT': 'TLT',
  'CMPS': 'CMPS',
  'LINK': 'LINK',
  'TDOC': 'TDOC',
};

/* For the metabolic basket, we want to show both LLY and NVO */
const BASKET_TICKERS = ['LLY', 'NVO'];

export function useLivePrices() {
  const [data, setData] = useState<PortfolioPrices | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchPrices() {
      try {
        const res = await fetch('/api/portfolio/live');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return { data, loading };
}

/* Inline price badge for a single ticker */
export function PriceBadge({ ticker, prices, isShort }: { ticker: string; prices: Record<string, PriceData> | undefined; isShort?: boolean }) {
  const key = TICKER_MAP[ticker] ?? ticker;
  const p = prices?.[key];
  if (!p) return null;

  // For short positions, invert the color logic
  const effectiveChange = isShort ? -p.changePercent : p.changePercent;
  const isUp = effectiveChange > 0;
  const isFlat = Math.abs(p.changePercent) < 0.01;

  const colorClass = isFlat
    ? 'text-neutral-500 dark:text-neutral-400'
    : isUp
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-500 dark:text-red-400';

  const arrow = isFlat ? '' : isUp ? '▲' : '▼';
  const sign = p.change >= 0 ? '+' : '';

  // Format price — crypto gets fewer decimals for display
  const isCrypto = p.source === 'binance';
  const displayPrice = isCrypto && p.price > 100
    ? p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : isCrypto && p.price > 1
      ? p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : p.price.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono font-semibold text-neutral-800 dark:text-[var(--espresso-h1)]">
        ${displayPrice}
      </span>
      <span className={`font-mono text-xs ${colorClass}`}>
        {arrow} {sign}{p.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

/* Basket price display — shows both LLY and NVO */
export function BasketPriceBadge({ prices }: { prices: Record<string, PriceData> | undefined }) {
  if (!prices) return null;

  const entries = BASKET_TICKERS.map(t => ({ ticker: t, data: prices[t] })).filter(e => e.data);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {entries.map(({ ticker, data }) => {
        if (!data) return null;
        const isUp = data.changePercent > 0;
        const isFlat = Math.abs(data.changePercent) < 0.01;
        const colorClass = isFlat
          ? 'text-neutral-500 dark:text-neutral-400'
          : isUp
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-500 dark:text-red-400';
        const arrow = isFlat ? '' : isUp ? '▲' : '▼';
        const sign = data.change >= 0 ? '+' : '';

        return (
          <div key={ticker} className="flex items-center gap-2 text-sm">
            <span className="text-xs text-neutral-400 dark:text-neutral-500 w-8">{ticker}</span>
            <span className="font-mono font-semibold text-neutral-800 dark:text-[var(--espresso-h1)]">
              ${data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className={`font-mono text-xs ${colorClass}`}>
              {arrow} {sign}{data.changePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Last updated timestamp */
export function PriceTimestamp({ updatedAt }: { updatedAt: string | undefined }) {
  if (!updatedAt) return null;
  const d = new Date(updatedAt);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <span className="text-xs text-neutral-400 dark:text-[var(--espresso-body)]/40">
      Prices as of {time}
    </span>
  );
}
