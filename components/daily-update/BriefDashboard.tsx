'use client';

import { useState, useEffect, useRef } from 'react';

interface AssetData {
  price?: number;
  changes?: Record<string, number>;
}

interface DashboardData {
  equities?: Record<string, AssetData>;
  crypto?: Record<string, AssetData>;
  commodities?: Record<string, AssetData>;
  rates?: Record<string, AssetData>;
  meta?: Record<string, unknown>;
}

// ── Same 9 core assets as SuperBriefDashboard, wider layout for full brief ──

const ASSETS = [
  // Row 1: Indices
  { key: 'SPX', label: 'S&P', category: 'equities' as const, prefix: '', decimals: 0 },
  { key: 'NDX', label: 'NDX', category: 'equities' as const, prefix: '', decimals: 0 },
  { key: 'DJI', label: 'DOW', category: 'equities' as const, prefix: '', decimals: 0 },
  // Row 2: Crypto
  { key: 'BTC', label: 'BTC', category: 'crypto' as const, prefix: '$', decimals: 0 },
  { key: 'ETH', label: 'ETH', category: 'crypto' as const, prefix: '$', decimals: 0 },
  { key: 'SOL', label: 'SOL', category: 'crypto' as const, prefix: '$', decimals: 0 },
  // Row 3: Commodities + Rate
  { key: 'GOLD', label: 'Gold', category: 'commodities' as const, prefix: '$', decimals: 0 },
  { key: 'BRENT', label: 'Oil', category: 'commodities' as const, prefix: '$', decimals: 2 },
  { key: 'US10Y', label: '10Y', category: 'rates' as const, prefix: '', decimals: 2, suffix: '%' },
];

export function BriefDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/live');
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div>
      {/* Desktop: single row of 9, Mobile: 3×3 grid */}
      <div className="hidden sm:grid grid-cols-9 gap-3 max-w-5xl mx-auto">
        {ASSETS.map((asset) => {
          const categoryData = data?.[asset.category] as Record<string, AssetData> | undefined;
          const assetData = categoryData?.[asset.key];
          const price = assetData?.price;
          const change = assetData?.changes?.['1D'];
          const isPositive = change != null && change > 0;
          const isNegative = change != null && change < 0;

          let priceStr = loading ? '—' : price != null ? price.toLocaleString('en-US', {
            minimumFractionDigits: asset.decimals,
            maximumFractionDigits: asset.decimals,
          }) : '—';

          if (price != null) {
            priceStr = `${asset.prefix}${priceStr}${(asset as { suffix?: string }).suffix || ''}`;
          }

          let changeStr = '—';
          if (change != null) {
            changeStr = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
          }

          return (
            <div key={asset.key} className="text-center py-1">
              <div className="font-mono text-[9px] text-[#555] uppercase tracking-wider">{asset.label}</div>
              <div className="font-mono text-[16px] font-medium text-white leading-tight">{priceStr}</div>
              <div
                className={`font-mono text-[10px] ${
                  isPositive ? 'text-ct-green-data' : isNegative ? 'text-ct-pink' : 'text-[#555]'
                }`}
              >
                {changeStr}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: 3×3 grid (matches super brief) */}
      <div className="sm:hidden grid grid-cols-3 gap-2 max-w-lg mx-auto">
        {ASSETS.map((asset) => {
          const categoryData = data?.[asset.category] as Record<string, AssetData> | undefined;
          const assetData = categoryData?.[asset.key];
          const price = assetData?.price;
          const change = assetData?.changes?.['1D'];
          const isPositive = change != null && change > 0;
          const isNegative = change != null && change < 0;

          let priceStr = loading ? '—' : price != null ? price.toLocaleString('en-US', {
            minimumFractionDigits: asset.decimals,
            maximumFractionDigits: asset.decimals,
          }) : '—';

          if (price != null) {
            priceStr = `${asset.prefix}${priceStr}${(asset as { suffix?: string }).suffix || ''}`;
          }

          let changeStr = '—';
          if (change != null) {
            changeStr = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
          }

          return (
            <div key={asset.key} className="text-center">
              <div className="font-mono text-[9px] text-[#555]">{asset.label}</div>
              <div className="font-mono text-[14px] font-medium text-white">{priceStr}</div>
              <div
                className={`font-mono text-[10px] ${
                  isPositive ? 'text-ct-green-data' : isNegative ? 'text-ct-pink' : 'text-[#555]'
                }`}
              >
                {changeStr}
              </div>
            </div>
          );
        })}
      </div>

      {/* CoinGecko attribution */}
      <p className="text-[10px] text-[#555] mt-3 max-w-5xl mx-auto">
        Crypto data provided by <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#888]">CoinGecko</a>
      </p>
    </div>
  );
}
