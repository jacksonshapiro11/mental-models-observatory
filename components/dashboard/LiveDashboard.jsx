'use client';

/**
 * THE DAILY BRIEF — Live Financial Dashboard
 *
 * A production-grade live pricing dashboard for cosmictrex.com
 * 
 * Architecture:
 * - Client-side React component polling a Next.js API route every 60s
 * - API route aggregates: Binance (crypto) + Finnhub (equities) + CoinGecko (market metrics) + Alternative.me (Fear & Greed)
 * - Daily reference prices (for % changes, MAs) fetched once/day and cached server-side
 * - All API keys hidden server-side; CDN caches responses for 60s
 * 
 * Drop this component into your Next.js pages/components directory.
 * Pair with the API routes in /api/dashboard/live.js and /api/dashboard/snapshot.js
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 60_000; // 60 seconds
const API_ENDPOINT = '/api/dashboard/live';

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = {
  container: {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    background: '#0a0a0b',
    color: '#e4e4e7',
    padding: '24px',
    borderRadius: '12px',
    maxWidth: '1200px',
    margin: '0 auto',
    overflowX: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #1e1e22',
  },
  title: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#71717a',
  },
  freshness: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: '#71717a',
  },
  dot: (status) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: status === 'live' ? '#22c55e' : status === 'stale' ? '#eab308' : '#ef4444',
    boxShadow: status === 'live' ? '0 0 6px #22c55e' : 'none',
  }),
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '2.5px',
    textTransform: 'uppercase',
    color: '#52525b',
    marginBottom: '12px',
    marginTop: '28px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'right',
    padding: '6px 12px',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#52525b',
    borderBottom: '1px solid #1e1e22',
  },
  thLeft: {
    textAlign: 'left',
    padding: '6px 12px',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#52525b',
    borderBottom: '1px solid #1e1e22',
  },
  td: {
    textAlign: 'right',
    padding: '8px 12px',
    borderBottom: '1px solid #111113',
    fontVariantNumeric: 'tabular-nums',
  },
  tdLeft: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid #111113',
    fontWeight: 600,
    color: '#fafafa',
  },
  ticker: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tickerDot: (color) => ({
    width: '4px',
    height: '16px',
    borderRadius: '2px',
    background: color,
  }),
  change: (value) => ({
    color: value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#71717a',
    fontWeight: value !== 0 ? 500 : 400,
  }),
  maCell: {
    color: '#71717a',
    fontSize: '12px',
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '8px',
    padding: '12px 0',
    borderTop: '1px solid #1e1e22',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '10px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#52525b',
  },
  metricValue: {
    fontSize: '13px',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  contextNote: {
    fontSize: '12px',
    color: '#71717a',
    lineHeight: 1.5,
    marginTop: '12px',
    padding: '12px',
    background: '#111113',
    borderRadius: '6px',
    borderLeft: '2px solid #27272a',
  },
  analysisTimestamp: {
    fontSize: '11px',
    color: '#52525b',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #1e1e22',
    fontStyle: 'italic',
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
  },
  tab: (active) => ({
    padding: '4px 12px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: active ? '#e4e4e7' : '#52525b',
    background: active ? '#1e1e22' : 'transparent',
    border: '1px solid',
    borderColor: active ? '#27272a' : 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  }),
  errorBanner: {
    padding: '12px',
    background: '#1c1007',
    border: '1px solid #854d0e',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#fbbf24',
    marginBottom: '16px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: '#52525b',
    fontSize: '12px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatPrice(value, opts = {}) {
  if (value == null) return '—';
  const { prefix = '$', decimals = 2, suffix = '' } = opts;
  const formatted = Math.abs(value) >= 1000
    ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value.toFixed(decimals);
  return `${prefix}${formatted}${suffix}`;
}

function formatChange(value) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatMA(value, priceOpts = {}) {
  if (value == null) return '~';
  return formatPrice(value, { decimals: 0, ...priceOpts });
}

function timeAgo(timestamp) {
  if (!timestamp) return 'never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getFreshnessStatus(timestamp) {
  if (!timestamp) return 'error';
  const age = Date.now() - timestamp;
  if (age < 120_000) return 'live';
  if (age < 300_000) return 'stale';
  return 'error';
}

// ─── PRICE ROW COMPONENT ────────────────────────────────────────────────────

function PriceRow({ asset, data, color, priceOpts = {} }) {
  const { price, changes = {}, mas = {} } = data || {};
  
  return (
    <tr>
      <td style={styles.tdLeft}>
        <div style={styles.ticker}>
          <div style={styles.tickerDot(color)} />
          {asset}
        </div>
      </td>
      <td style={styles.td}>
        {formatPrice(price, priceOpts)}
      </td>
      <td style={{ ...styles.td, ...styles.change(changes['1D']) }}>
        {formatChange(changes['1D'])}
      </td>
      <td style={{ ...styles.td, ...styles.change(changes['5D']) }}>
        {formatChange(changes['5D'])}
      </td>
      <td style={{ ...styles.td, ...styles.change(changes['1M']) }}>
        {formatChange(changes['1M'])}
      </td>
      <td style={{ ...styles.td, ...styles.change(changes['1Y']) }}>
        {formatChange(changes['1Y'])}
      </td>
      <td style={{ ...styles.td, ...styles.maCell }}>
        {formatMA(mas['50D'], priceOpts)}
      </td>
      <td style={{ ...styles.td, ...styles.maCell }}>
        {formatMA(mas['200D'], priceOpts)}
      </td>
      <td style={{ ...styles.td, ...styles.maCell }}>
        {formatMA(mas['200W'], priceOpts)}
      </td>
    </tr>
  );
}

// ─── MOBILE SCROLL WRAPPER ──────────────────────────────────────────────────
// Allows wide tables to scroll horizontally on small screens without
// touching any of the table rendering logic.

const scrollWrapper = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  margin: '0 -16px',
  padding: '0 16px',
};

function ScrollableTable({ children }) {
  return <div style={scrollWrapper}>{children}</div>;
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────

export default function LiveDashboard({ analysisTimestamp = /** @type {string|null} */ (null), contextNotes = /** @type {string|null} */ (null), equityNotes = /** @type {string|null} */ (null), cryptoNotes = /** @type {string|null} */ (null), commodityNotes = /** @type {string|null} */ (null) }) {
  const [data, setData] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('equities');
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINT);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(Date.now());
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
      setError(err.message);
      // Keep showing stale data if we have it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const status = getFreshnessStatus(lastFetch);

  if (loading && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  const { equities = {}, crypto = {}, commodities = {}, rates = {}, meta = {} } = data || {};

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.title}>▸ The Dashboard</div>
          <div style={styles.tabBar}>
            <button style={styles.tab(activeTab === 'equities')} onClick={() => setActiveTab('equities')}>Equities</button>
            <button style={styles.tab(activeTab === 'crypto')} onClick={() => setActiveTab('crypto')}>Crypto</button>
            <button style={styles.tab(activeTab === 'commodities')} onClick={() => setActiveTab('commodities')}>Commodities</button>
          </div>
        </div>
        <div style={styles.freshness}>
          <div style={styles.dot(status)} />
          <span>{status === 'live' ? 'Live' : status === 'stale' ? 'Stale' : 'Disconnected'}</span>
          <span>· {timeAgo(lastFetch)}</span>
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          ⚠ Data may be delayed: {error}
        </div>
      )}

      {/* ═══ EQUITIES TAB ═══ */}
      {activeTab === 'equities' && <>

      {/* Futures (pre-market only) */}
      {meta.marketStatus === 'pre' && data.futures && (
        <>
          <div style={styles.sectionLabel}>Futures</div>
          <ScrollableTable>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thLeft}>Index</th>
                  <th style={styles.th}>Level</th>
                  <th style={styles.th}>Change</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.futures).map(([name, info]) => (
                  <tr key={name}>
                    <td style={styles.tdLeft}>
                      <div style={styles.ticker}>
                        <div style={styles.tickerDot('#3b82f6')} />
                        {name}
                      </div>
                    </td>
                    <td style={styles.td}>{formatPrice(info.price, { prefix: '', decimals: 0 })}</td>
                    <td style={{ ...styles.td, ...styles.change(info.change) }}>
                      {formatChange(info.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </>
      )}

      {/* Equities */}
      <div style={styles.sectionLabel}>Equities</div>
      <ScrollableTable>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thLeft}>Index</th>
              <th style={styles.th}>Price</th>
              <th style={styles.th}>1D</th>
              <th style={styles.th}>5D</th>
              <th style={styles.th}>1M</th>
              <th style={styles.th}>1Y</th>
              <th style={styles.th}>50D</th>
              <th style={styles.th}>200D</th>
              <th style={styles.th}>200W</th>
            </tr>
          </thead>
          <tbody>
            <PriceRow asset="S&P 500" data={equities.SPX} color="#3b82f6" priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Nasdaq 100" data={equities.NDX} color="#8b5cf6" priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Dow" data={equities.DJI} color="#06b6d4" priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Russell 2000" data={equities.RUT} color="#10b981" priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="IGV (SaaS)" data={equities.IGV} color="#f472b6" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="SMH (Semis)" data={equities.SMH} color="#a78bfa" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="Growth (IWF)" data={equities.IWF} color="#22d3ee" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="Value (IWD)" data={equities.IWD} color="#fb923c" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="XLE (Energy)" data={equities.XLE} color="#84cc16" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="ARKK" data={equities.ARKK} color="#e879f9" priceOpts={{ prefix: '$', decimals: 2 }} />
          </tbody>
        </table>
      </ScrollableTable>

      {/* Equity context notes */}
      {equityNotes && (
        <div style={styles.contextNote}>{equityNotes}</div>
      )}

      </>}

      {/* ═══ CRYPTO TAB ═══ */}
      {activeTab === 'crypto' && <>

      {/* Crypto */}
      <div style={styles.sectionLabel}>Crypto</div>
      <ScrollableTable>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thLeft}>Asset</th>
              <th style={styles.th}>Price</th>
              <th style={styles.th}>1D</th>
              <th style={styles.th}>5D</th>
              <th style={styles.th}>1M</th>
              <th style={styles.th}>1Y</th>
              <th style={styles.th}>50D</th>
              <th style={styles.th}>200D</th>
              <th style={styles.th}>200W</th>
            </tr>
          </thead>
          <tbody>
            <PriceRow asset="BTC" data={crypto.BTC} color="#f59e0b" />
            <PriceRow asset="ETH" data={crypto.ETH} color="#6366f1" />
            <PriceRow asset="SOL" data={crypto.SOL} color="#14b8a6" />
            <PriceRow asset="AAVE" data={crypto.AAVE} color="#9333ea" />
            <PriceRow asset="UNI" data={crypto.UNI} color="#ec4899" />
            <PriceRow asset="LINK" data={crypto.LINK} color="#2563eb" />
          </tbody>
        </table>
      </ScrollableTable>

      {/* Crypto context notes */}
      {cryptoNotes && (
        <div style={styles.contextNote}>{cryptoNotes}</div>
      )}

      {/* Crypto metrics row 1: Market structure */}
      {meta.cryptoMeta && (
        <div style={styles.metricsRow}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>BTC Dom</span>
            <span style={styles.metricValue}>{meta.cryptoMeta.btcDominance?.toFixed(1)}%</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>ETH Dom</span>
            <span style={styles.metricValue}>{meta.cryptoMeta.ethDominance?.toFixed(1)}%</span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Total Mkt Cap</span>
            <span style={styles.metricValue}>
              ${meta.cryptoMeta.totalMarketCap ? (meta.cryptoMeta.totalMarketCap / 1e12).toFixed(2) + 'T' : '—'}
            </span>
          </div>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Fear & Greed</span>
            <span style={{
              ...styles.metricValue,
              color: (meta.cryptoMeta.fearGreed?.value || 50) < 25 ? '#ef4444' :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 45 ? '#f59e0b' :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 55 ? '#71717a' :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 75 ? '#22c55e' : '#22c55e',
            }}>
              {meta.cryptoMeta.fearGreed?.value ?? '—'} ({meta.cryptoMeta.fearGreed?.label ?? '—'})
            </span>
          </div>
          {meta.cryptoMeta.etfFlows != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>ETF Flows (prev day)</span>
              <span style={{
                ...styles.metricValue,
                ...styles.change(meta.cryptoMeta.etfFlows),
              }}>
                {meta.cryptoMeta.etfFlows > 0 ? '+' : ''}
                ${(meta.cryptoMeta.etfFlows / 1e6).toFixed(0)}M
              </span>
            </div>
          )}
        </div>
      )}

      {/* Crypto metrics row 2: DeFi + Derivatives + Treasury */}
      {meta.cryptoMeta && (meta.cryptoMeta.defiMarketCap || meta.cryptoMeta.btcFundingRate != null) && (
        <div style={styles.metricsRow}>
          {meta.cryptoMeta.defiMarketCap && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>DeFi Mkt Cap</span>
              <span style={styles.metricValue}>
                ${(meta.cryptoMeta.defiMarketCap / 1e9).toFixed(1)}B
              </span>
            </div>
          )}
          {meta.cryptoMeta.defiDominance != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>DeFi Dom</span>
              <span style={styles.metricValue}>{meta.cryptoMeta.defiDominance.toFixed(1)}%</span>
            </div>
          )}
          {meta.cryptoMeta.defiToEthRatio != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>DeFi/ETH Ratio</span>
              <span style={styles.metricValue}>{meta.cryptoMeta.defiToEthRatio.toFixed(2)}%</span>
            </div>
          )}
          {meta.cryptoMeta.btcFundingRate != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>BTC Funding</span>
              <span style={{
                ...styles.metricValue,
                color: meta.cryptoMeta.btcFundingRate > 0.01 ? '#22c55e' :
                       meta.cryptoMeta.btcFundingRate < -0.01 ? '#ef4444' : '#71717a',
              }}>
                {meta.cryptoMeta.btcFundingRate > 0 ? '+' : ''}{(meta.cryptoMeta.btcFundingRate * 100).toFixed(4)}%
              </span>
            </div>
          )}
          {meta.cryptoMeta.btcOpenInterest != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>BTC OI</span>
              <span style={styles.metricValue}>
                ${(meta.cryptoMeta.btcOpenInterest / 1e9).toFixed(1)}B
              </span>
            </div>
          )}
          {meta.cryptoMeta.corporateBtcHoldings != null && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>Corp BTC Holdings</span>
              <span style={styles.metricValue}>
                {(meta.cryptoMeta.corporateBtcHoldings / 1000).toFixed(0)}K BTC
              </span>
            </div>
          )}
        </div>
      )}

      {/* Trending coins (narrative gauge) */}
      {meta.cryptoMeta?.trending && meta.cryptoMeta.trending.length > 0 && (
        <div style={{ ...styles.metricsRow, flexDirection: 'column', gap: '4px' }}>
          <span style={styles.metricLabel}>Trending (24h)</span>
          <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.6 }}>
            {meta.cryptoMeta.trending.map((t, i) => (
              <span key={i}>
                <span style={{ color: '#e4e4e7', fontWeight: 500 }}>{t.symbol}</span>
                {i < meta.cryptoMeta.trending.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      </>}

      {/* ═══ COMMODITIES TAB ═══ */}
      {activeTab === 'commodities' && <>

      {/* Commodities & Rates */}
      <div style={styles.sectionLabel}>Commodities & Rates</div>
      <div style={{ fontSize: '0.8em', color: '#a1a1aa', padding: '4px 0 8px', lineHeight: 1.4 }}>
        Prices reflect front-month futures contracts and may diverge from spot prices, particularly for oil and natural gas.
      </div>
      <ScrollableTable>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thLeft}>Asset</th>
              <th style={styles.th}>Price</th>
              <th style={styles.th}>1D</th>
              <th style={styles.th}>5D</th>
              <th style={styles.th}>1M</th>
              <th style={styles.th}>1Y</th>
              <th style={styles.th}>50D</th>
              <th style={styles.th}>200D</th>
              <th style={styles.th}>200W</th>
            </tr>
          </thead>
          <tbody>
            <PriceRow asset="Gold" data={commodities.GOLD} color="#eab308" />
            <PriceRow asset="Silver" data={commodities.SILVER} color="#a1a1aa" />
            <PriceRow asset="Brent" data={commodities.BRENT} color="#78716c" />
            <PriceRow asset="Copper" data={commodities.COPPER} color="#d97706" />
            <PriceRow asset="Nat Gas" data={commodities.NATGAS} color="#059669" />
            <PriceRow asset="10Y" data={rates.US10Y} color="#f43f5e" priceOpts={{ prefix: '', suffix: '%' }} />
          </tbody>
        </table>
      </ScrollableTable>

      {/* Commodity context notes */}
      {commodityNotes && (
        <div style={styles.contextNote}>{commodityNotes}</div>
      )}

      {/* Bottom metrics row */}
      {(meta.dxy || meta.fedWatch || meta.fedFunds) && (
        <div style={styles.metricsRow}>
          {meta.dxy && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>DXY</span>
              <span style={styles.metricValue}>
                {meta.dxy.value?.toFixed(2)}
                {meta.dxy.yoyChange != null && (
                  <span style={{ ...styles.change(meta.dxy.yoyChange), fontSize: '11px', marginLeft: '6px' }}>
                    {formatChange(meta.dxy.yoyChange)} YoY
                  </span>
                )}
              </span>
            </div>
          )}
          {meta.fedWatch && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>CME FedWatch</span>
              <span style={styles.metricValue}>{meta.fedWatch}</span>
            </div>
          )}
          {meta.fedFunds && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>Fed Funds</span>
              <span style={styles.metricValue}>{meta.fedFunds}</span>
            </div>
          )}
        </div>
      )}

      </>}

      {/* Legacy single context notes (fallback) */}
      {contextNotes && !equityNotes && !cryptoNotes && !commodityNotes && (
        <div style={styles.contextNote}>{contextNotes}</div>
      )}

      {/* Analysis timestamp */}
      {analysisTimestamp && (
        <div style={styles.analysisTimestamp}>
          Analysis below reflects market conditions as of {analysisTimestamp}
        </div>
      )}
    </div>
  );
}
