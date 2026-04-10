'use client';

import { useEffect, useState } from 'react';

interface AssetPrice {
  price: number | null;
  changes?: Record<string, number>;
}

interface MarketData {
  equities?: Record<string, AssetPrice>;
  crypto?: Record<string, AssetPrice>;
  commodities?: Record<string, AssetPrice>;
  rates?: Record<string, AssetPrice>;
  meta?: Record<string, unknown>;
}

const REFRESH_INTERVAL = 60000;

const FALLBACK_DATA: MarketData = {
  equities: {
    SPX: { price: 6905, changes: { '1D': 0.22 } },
    NDX: { price: 21200, changes: { '1D': 0.35 } },
    DJI: { price: 42500, changes: { '1D': 0.15 } },
    RUT: { price: 2050, changes: { '1D': -0.30 } },
  },
  crypto: {
    BTC: { price: 65500, changes: { '1D': 4.2 } },
    ETH: { price: 3200, changes: { '1D': 2.1 } },
    SOL: { price: 145, changes: { '1D': 3.5 } },
  },
  commodities: {
    GOLD: { price: 5183, changes: { '1D': 0.8 } },
    SILVER: { price: 31, changes: { '1D': 1.2 } },
    BRENT: { price: 66, changes: { '1D': -17.0 } },
    COPPER: { price: 4.5, changes: { '1D': -0.5 } },
    NATGAS: { price: 2.1, changes: { '1D': 1.8 } },
  },
  rates: {
    US10Y: { price: 3.72, changes: {} },
  },
  meta: {
    dxy: { value: 97.66 },
  },
};

function formatPrice(value: number | null, decimals = 2, prefix = ''): string {
  if (value == null) return '—';
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${formatted}`;
}

function formatChange(value: number | null): string {
  if (value == null) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getChangeColor(value: number | null): string {
  if (value == null) return 'text-text-on-dark-muted';
  return value > 0 ? 'text-ct-green-data' : value < 0 ? 'text-ct-pink' : 'text-text-on-dark-muted';
}

function TickerItem({ label, price, change }: { label: string; price: string; change: number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-text-on-dark font-semibold">{label}</span>
      <span className="text-text-on-dark">{price}</span>
      {change != null && (
        <span className={getChangeColor(change)}>{formatChange(change)}</span>
      )}
    </span>
  );
}

function Dot() {
  return <span className="text-text-on-dark-muted mx-2">·</span>;
}

export function TickerBar() {
  const [data, setData] = useState<MarketData>(FALLBACK_DATA);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard/live');
        if (!response.ok) throw new Error('API error');
        const result: MarketData = await response.json();
        setData(result);
      } catch {
        setData(FALLBACK_DATA);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ── Equities ──
  const spx = data.equities?.SPX;
  const ndx = data.equities?.NDX;
  const dji = data.equities?.DJI;
  const rut = data.equities?.RUT;
  const igv = data.equities?.IGV;
  const smh = data.equities?.SMH;
  const iwf = data.equities?.IWF;
  const iwd = data.equities?.IWD;
  const xle = data.equities?.XLE;
  const arkk = data.equities?.ARKK;

  // ── Crypto ──
  const btc = data.crypto?.BTC;
  const eth = data.crypto?.ETH;
  const sol = data.crypto?.SOL;
  const aave = data.crypto?.AAVE;
  const uni = data.crypto?.UNI;
  const link = data.crypto?.LINK;

  // ── Commodities ──
  const gold = data.commodities?.GOLD;
  const silver = data.commodities?.SILVER;
  const brent = data.commodities?.BRENT;
  const copper = data.commodities?.COPPER;
  const natgas = data.commodities?.NATGAS;

  // ── Rates & Meta ──
  const us10y = data.rates?.US10Y;
  const dxyValue = (data.meta?.dxy as { value?: number })?.value;

  const items = (
    <>
      {/* Indices */}
      <TickerItem label="S&P" price={formatPrice(spx?.price ?? null, 0)} change={spx?.changes?.['1D']} />
      <Dot />
      <TickerItem label="NDX" price={formatPrice(ndx?.price ?? null, 0)} change={ndx?.changes?.['1D']} />
      <Dot />
      <TickerItem label="DOW" price={formatPrice(dji?.price ?? null, 0)} change={dji?.changes?.['1D']} />
      <Dot />
      <TickerItem label="RUT" price={formatPrice(rut?.price ?? null, 0)} change={rut?.changes?.['1D']} />
      <Dot />

      {/* ETFs (only render if data exists) */}
      {smh?.price != null && <><TickerItem label="SMH" price={formatPrice(smh.price, 0, '$')} change={smh.changes?.['1D']} /><Dot /></>}
      {igv?.price != null && <><TickerItem label="IGV" price={formatPrice(igv.price, 0, '$')} change={igv.changes?.['1D']} /><Dot /></>}
      {iwf?.price != null && <><TickerItem label="IWF" price={formatPrice(iwf.price, 0, '$')} change={iwf.changes?.['1D']} /><Dot /></>}
      {iwd?.price != null && <><TickerItem label="IWD" price={formatPrice(iwd.price, 0, '$')} change={iwd.changes?.['1D']} /><Dot /></>}
      {xle?.price != null && <><TickerItem label="XLE" price={formatPrice(xle.price, 0, '$')} change={xle.changes?.['1D']} /><Dot /></>}
      {arkk?.price != null && <><TickerItem label="ARKK" price={formatPrice(arkk.price, 0, '$')} change={arkk.changes?.['1D']} /><Dot /></>}

      {/* Crypto */}
      <TickerItem label="BTC" price={formatPrice(btc?.price ?? null, 0, '$')} change={btc?.changes?.['1D']} />
      <Dot />
      <TickerItem label="ETH" price={formatPrice(eth?.price ?? null, 0, '$')} change={eth?.changes?.['1D']} />
      <Dot />
      <TickerItem label="SOL" price={formatPrice(sol?.price ?? null, 0, '$')} change={sol?.changes?.['1D']} />
      <Dot />
      {aave?.price != null && <><TickerItem label="AAVE" price={formatPrice(aave.price, 0, '$')} change={aave.changes?.['1D']} /><Dot /></>}
      {uni?.price != null && <><TickerItem label="UNI" price={formatPrice(uni.price, 2, '$')} change={uni.changes?.['1D']} /><Dot /></>}
      {link?.price != null && <><TickerItem label="LINK" price={formatPrice(link.price, 2, '$')} change={link.changes?.['1D']} /><Dot /></>}

      {/* Commodities */}
      <TickerItem label="Gold" price={formatPrice(gold?.price ?? null, 0, '$')} change={gold?.changes?.['1D']} />
      <Dot />
      <TickerItem label="Silver" price={formatPrice(silver?.price ?? null, 2, '$')} change={silver?.changes?.['1D']} />
      <Dot />
      <TickerItem label="Oil" price={formatPrice(brent?.price ?? null, 0, '$')} change={brent?.changes?.['1D']} />
      <Dot />
      <TickerItem label="Copper" price={formatPrice(copper?.price ?? null, 2, '$')} change={copper?.changes?.['1D']} />
      <Dot />
      {natgas?.price != null && <><TickerItem label="NatGas" price={formatPrice(natgas.price, 2, '$')} change={natgas.changes?.['1D']} /><Dot /></>}

      {/* Rates & FX */}
      <TickerItem label="10Y" price={us10y?.price ? `${us10y.price.toFixed(2)}%` : '—'} change={null} />
      <Dot />
      <TickerItem label="DXY" price={dxyValue ? dxyValue.toFixed(2) : '—'} change={null} />
    </>
  );

  return (
    <div className="bg-ct-dark overflow-hidden">
      <div className="font-mono text-[10px] py-1.5 whitespace-nowrap animate-ticker">
        <div className="inline-flex gap-0 ticker-content">
          {/* Duplicate content for seamless loop */}
          <span className="inline-flex items-center gap-0 px-4">{items}</span>
          <span className="inline-flex items-center gap-0 px-4">{items}</span>
        </div>
      </div>
    </div>
  );
}
