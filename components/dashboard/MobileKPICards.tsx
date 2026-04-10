'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Mobile-only 2x2 KPI card grid for the Dashboard section.
 * Shows compact price + 1D change for key assets.
 * "Show full dashboard" toggle expands to the full LiveDashboard table.
 * Hidden on desktop (md+) where the full table is always visible.
 */

interface AssetData {
  price?: number;
  changes?: Record<string, number>;
}

interface DashboardData {
  equities?: Record<string, AssetData>;
  crypto?: Record<string, AssetData>;
  commodities?: Record<string, AssetData>;
  rates?: Record<string, AssetData>;
}

const KPI_ASSETS = [
  { key: 'SPX', label: 'S&P 500', category: 'equities' as const, pricePrefix: '', decimals: 0 },
  { key: 'BTC', label: 'BTC', category: 'crypto' as const, pricePrefix: '$', decimals: 0 },
  { key: 'GOLD', label: 'Gold', category: 'commodities' as const, pricePrefix: '$', decimals: 0 },
  { key: 'BRENT', label: 'Brent', category: 'commodities' as const, pricePrefix: '$', decimals: 2 },
];

function formatKPIPrice(value: number | undefined, prefix: string, decimals: number): string {
  if (value == null) return '—';
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}`;
}

function formatKPIChange(value: number | undefined): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function MobileKPICards({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/live');
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch {
        // silent — cards will show "—"
      }
    };
    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div>
      {/* Mobile KPI cards — hidden on md+ */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {KPI_ASSETS.map((asset) => {
            const categoryData = data?.[asset.category] as Record<string, AssetData> | undefined;
            const assetData = categoryData?.[asset.key];
            const price = assetData?.price;
            const change = assetData?.changes?.['1D'];
            const isPositive = change != null && change > 0;
            const isNegative = change != null && change < 0;

            return (
              <div
                key={asset.key}
                className="bg-[#141416] border border-[#222] p-3"
              >
                <div className="text-[9px] font-mono text-[#555] uppercase tracking-[0.08em] font-semibold mb-1">
                  {asset.label}
                </div>
                <div className="text-lg font-mono font-semibold text-[#f0f0ec] tabular-nums">
                  {formatKPIPrice(price, asset.pricePrefix, asset.decimals)}
                </div>
                <div
                  className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 ${
                    isPositive ? 'text-ct-green-data' : isNegative ? 'text-ct-pink' : 'text-[#555]'
                  }`}
                >
                  {isPositive ? '▲ ' : isNegative ? '▼ ' : ''}{formatKPIChange(change)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Toggle to show full dashboard */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[10px] font-mono font-semibold text-ct-yellow uppercase tracking-[0.06em] py-2 border border-[#222] hover:bg-[#141416] transition-colors mb-4"
        >
          {expanded ? 'Hide full dashboard ▲' : 'Show full dashboard ▼'}
        </button>

        {/* Full dashboard (collapsed by default on mobile) */}
        {expanded && children}
      </div>

      {/* Desktop: always show full dashboard */}
      <div className="hidden md:block">
        {children}
      </div>
    </div>
  );
}
