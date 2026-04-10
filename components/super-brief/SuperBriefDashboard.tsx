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

// ── Top 8 assets + 10Y — compact, dynamic ──────────────────────────────────

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

export function SuperBriefDashboard() {
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
    <section className="bg-ct-dark px-4 py-3">
      <div className="max-w-lg mx-auto grid grid-cols-3 gap-2">
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
            priceStr = `${asset.prefix}${priceStr}${asset.suffix || ''}`;
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
    </section>
  );
}
