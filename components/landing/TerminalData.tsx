'use client';

import { useEffect, useState, useRef } from 'react';

interface MarketData {
  equities?: Record<string, { price: number | null; changes?: Record<string, number> }>;
  crypto?: Record<string, { price: number | null; changes?: Record<string, number> }>;
  commodities?: Record<string, { price: number | null; changes?: Record<string, number> }>;
  rates?: Record<string, { price: number | null; changes?: Record<string, number> }>;
  meta?: Record<string, unknown>;
}

const REFRESH_INTERVAL = 60000; // 60 seconds

// Fallback data if API fails
const FALLBACK_DATA: MarketData = {
  equities: {
    SPX: { price: 6905, changes: { '1D': 0.22 } },
  },
  crypto: {
    BTC: { price: 65500, changes: { '1D': 4.2 } },
  },
  commodities: {
    GOLD: { price: 5183, changes: { '1D': 0.8 } },
    BRENT: { price: 66, changes: { '1D': -17.0 } },
  },
  rates: {
    US10Y: { price: 3.72, changes: {} },
  },
  meta: {
    dxy: { value: 97.66 },
  },
};

interface FormatPriceOptions {
  decimals?: number;
  prefix?: string;
}

function formatPrice(value: number | null, opts: FormatPriceOptions = {}): string {
  if (value == null) return '—';
  const { decimals = 2, prefix = '$' } = opts;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}`;
}

function formatChange(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function getChangeColor(value: number | null | undefined): string {
  if (value == null) return 'text-text-on-dark-muted';
  return value > 0 ? 'text-ct-green-data' : value < 0 ? 'text-ct-pink' : 'text-text-on-dark-muted';
}

export function TerminalData() {
  const [data, setData] = useState<MarketData>(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/dashboard/live');
      if (!response.ok) throw new Error('API error');
      const result: MarketData = await response.json();
      setData(result);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch live data:', err);
      setData(FALLBACK_DATA);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchData();

    // Set up interval
    const interval = setInterval(fetchData, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const spx = data.equities?.SPX;
  const btc = data.crypto?.BTC;
  const gold = data.commodities?.GOLD;
  const brent = data.commodities?.BRENT;
  const us10y = data.rates?.US10Y;
  const dxyValue = (data.meta?.dxy as { value?: number })?.value;

  const spxChange = spx?.changes?.['1D'];
  const btcChange = btc?.changes?.['1D'];
  const goldChange = gold?.changes?.['1D'];
  const brentChange = brent?.changes?.['1D'];

  return (
    <div className="space-y-2 text-text-on-dark-muted mt-6">
      <div className="flex justify-between items-start max-w-xs">
        <span>S&P 500</span>
        <span className="text-right">
          <span className={spx?.price ? 'text-ct-green-data' : 'text-text-on-dark-muted'}>
            {spx?.price ? formatPrice(spx.price, { decimals: 0 }) : '—'}
          </span>
          {' '}
          <span className={getChangeColor(spxChange)}>
            {formatChange(spxChange)}
          </span>
        </span>
      </div>
      <div className="flex justify-between items-start max-w-xs">
        <span>BTC</span>
        <span className="text-right">
          <span className={btc?.price ? 'text-ct-green-data' : 'text-text-on-dark-muted'}>
            {btc?.price ? formatPrice(btc.price) : '—'}
          </span>
          {' '}
          <span className={getChangeColor(btcChange)}>
            {formatChange(btcChange)}
          </span>
        </span>
      </div>
      <div className="flex justify-between items-start max-w-xs">
        <span>Gold</span>
        <span className="text-right">
          <span className={gold?.price ? 'text-ct-green-data' : 'text-text-on-dark-muted'}>
            {gold?.price ? formatPrice(gold.price, { decimals: 0 }) : '—'}
          </span>
          {' '}
          <span className={getChangeColor(goldChange)}>
            {formatChange(goldChange)}
          </span>
        </span>
      </div>
      <div className="flex justify-between items-start max-w-xs">
        <span>Brent</span>
        <span className="text-right">
          <span className={brent?.price ? 'text-ct-green-data' : 'text-text-on-dark-muted'}>
            {brent?.price ? formatPrice(brent.price, { decimals: 0 }) : '—'}
          </span>
          {' '}
          <span className={getChangeColor(brentChange)}>
            {formatChange(brentChange)}
          </span>
        </span>
      </div>
      <div className="flex justify-between items-start max-w-xs">
        <span>10Y</span>
        <span className="text-right">
          {us10y?.price ? `${us10y.price.toFixed(2)}%` : '—'}
        </span>
      </div>
      <div className="flex justify-between items-start max-w-xs">
        <span>DXY</span>
        <span className="text-right">
          {dxyValue ? dxyValue.toFixed(2) : '—'}
        </span>
      </div>
    </div>
  );
}
