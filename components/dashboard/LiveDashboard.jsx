'use client';

/**
 * THE DAILY BRIEF — Live Financial Dashboard
 * Zine Terminal design system · cosmictrex.com
 *
 * Architecture:
 * - Client-side React component polling a Next.js API route every 60s
 * - API route aggregates: Binance (crypto) + Finnhub (equities) + CoinGecko (market metrics) + Alternative.me (Fear & Greed)
 * - Daily reference prices (for % changes, MAs) fetched once/day and cached server-side
 * - All API keys hidden server-side; CDN caches responses for 60s
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 60_000;
const API_ENDPOINT = '/api/dashboard/live';

// ─── CT DESIGN TOKENS ───────────────────────────────────────────────────────
const CT = {
  dark: '#0D0D0D',
  yellow: '#FFE600',
  pink: '#FF2E63',
  greenData: '#00FF41',
  greenDisc: '#00885a',
  // Dark surface shades
  surface1: '#141416',
  surface2: '#1a1a1e',
  border: '#222',
  borderSubtle: '#333',
  // Text on dark
  textPrimary: '#f0f0ec',
  textSecondary: '#aaa',
  textMuted: '#666',
  textDim: '#555',
};

// ─── STYLES (CT design system) ──────────────────────────────────────────────
const styles = {
  container: {
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
    color: CT.textPrimary,
    maxWidth: '1200px',
    margin: '0 auto',
    overflowX: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${CT.border}`,
  },
  freshness: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '10px',
    color: CT.textMuted,
    letterSpacing: '0.04em',
  },
  dot: (status) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: status === 'live' ? CT.greenData : status === 'stale' ? CT.yellow : CT.pink,
    boxShadow: status === 'live' ? `0 0 8px ${CT.greenData}` : 'none',
  }),
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: CT.textMuted,
    marginBottom: '10px',
    marginTop: '24px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    textAlign: 'right',
    padding: '6px 10px',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: CT.textDim,
    borderBottom: `1px solid ${CT.border}`,
  },
  thLeft: {
    textAlign: 'left',
    padding: '6px 10px',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: CT.textDim,
    borderBottom: `1px solid ${CT.border}`,
  },
  td: {
    textAlign: 'right',
    padding: '7px 10px',
    borderBottom: `1px solid ${CT.surface1}`,
    fontVariantNumeric: 'tabular-nums',
    color: CT.textSecondary,
  },
  tdLeft: {
    textAlign: 'left',
    padding: '7px 10px',
    borderBottom: `1px solid ${CT.surface1}`,
    fontWeight: 600,
    color: CT.textPrimary,
  },
  ticker: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tickerDot: (color) => ({
    width: '3px',
    height: '14px',
    borderRadius: '1px',
    background: color,
  }),
  change: (value) => ({
    color: value > 0 ? CT.greenData : value < 0 ? CT.pink : CT.textMuted,
    fontWeight: value !== 0 ? 500 : 400,
  }),
  maCell: {
    color: CT.textDim,
    fontSize: '11px',
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginTop: '8px',
    padding: '12px 0',
    borderTop: `1px solid ${CT.border}`,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricLabel: {
    fontSize: '9px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: CT.textDim,
    fontWeight: 600,
  },
  metricValue: {
    fontSize: '13px',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    color: CT.textPrimary,
  },
  contextNote: {
    fontSize: '13px',
    fontFamily: "'Source Sans 3', system-ui, sans-serif",
    color: CT.textSecondary,
    lineHeight: 1.65,
    marginTop: '12px',
    padding: '12px 14px',
    background: CT.surface1,
    borderLeft: `2px solid ${CT.yellow}`,
    fontStyle: 'italic',
  },
  analysisTimestamp: {
    fontSize: '10px',
    color: CT.textDim,
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: `1px solid ${CT.border}`,
    fontStyle: 'italic',
    letterSpacing: '0.03em',
  },
  tabBar: {
    display: 'flex',
    gap: '2px',
  },
  tab: (active) => ({
    padding: '4px 10px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: active ? CT.yellow : CT.textMuted,
    background: active ? CT.surface2 : 'transparent',
    border: `1px solid ${active ? CT.borderSubtle : 'transparent'}`,
    borderRadius: '0',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
  }),
  errorBanner: {
    padding: '10px 12px',
    background: '#1c1007',
    border: `1px solid ${CT.yellow}`,
    fontSize: '11px',
    color: CT.yellow,
    marginBottom: '16px',
    letterSpacing: '0.03em',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: CT.textMuted,
    fontSize: '11px',
    letterSpacing: '0.08em',
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
        <div style={styles.tabBar}>
          <button style={styles.tab(activeTab === 'equities')} onClick={() => setActiveTab('equities')}>Equities</button>
          <button style={styles.tab(activeTab === 'crypto')} onClick={() => setActiveTab('crypto')}>Crypto</button>
          <button style={styles.tab(activeTab === 'commodities')} onClick={() => setActiveTab('commodities')}>Commodities</button>
        </div>
        <div style={styles.freshness}>
          <div style={styles.dot(status)} />
          <span>{status === 'live' ? 'LIVE' : status === 'stale' ? 'STALE' : 'OFF'}</span>
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
                        <div style={styles.tickerDot(CT.yellow)} />
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
            <PriceRow asset="S&P 500" data={equities.SPX} color={CT.yellow} priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Nasdaq 100" data={equities.NDX} color={CT.pink} priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Dow" data={equities.DJI} color={CT.textSecondary} priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="Russell 2000" data={equities.RUT} color={CT.greenDisc} priceOpts={{ prefix: '', decimals: 0 }} />
            <PriceRow asset="IGV (SaaS)" data={equities.IGV} color="#8b5cf6" priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="SMH (Semis)" data={equities.SMH} color={CT.pink} priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="Growth (IWF)" data={equities.IWF} color={CT.greenData} priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="Value (IWD)" data={equities.IWD} color={CT.yellow} priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="XLE (Energy)" data={equities.XLE} color={CT.greenDisc} priceOpts={{ prefix: '$', decimals: 2 }} />
            <PriceRow asset="ARKK" data={equities.ARKK} color="#8b5cf6" priceOpts={{ prefix: '$', decimals: 2 }} />
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
            <PriceRow asset="BTC" data={crypto.BTC} color={CT.yellow} />
            <PriceRow asset="ETH" data={crypto.ETH} color="#8b5cf6" />
            <PriceRow asset="SOL" data={crypto.SOL} color={CT.greenDisc} />
            <PriceRow asset="AAVE" data={crypto.AAVE} color={CT.pink} />
            <PriceRow asset="UNI" data={crypto.UNI} color={CT.pink} />
            <PriceRow asset="LINK" data={crypto.LINK} color={CT.yellow} />
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
              color: (meta.cryptoMeta.fearGreed?.value || 50) < 25 ? CT.pink :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 45 ? CT.yellow :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 55 ? CT.textMuted :
                     (meta.cryptoMeta.fearGreed?.value || 50) < 75 ? CT.greenData : CT.greenData,
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
                color: meta.cryptoMeta.btcFundingRate > 0.01 ? CT.greenData :
                       meta.cryptoMeta.btcFundingRate < -0.01 ? CT.pink : CT.textMuted,
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
          <span style={{ fontSize: '12px', color: CT.textSecondary, lineHeight: 1.6 }}>
            {meta.cryptoMeta.trending.map((t, i) => (
              <span key={i}>
                <span style={{ color: CT.textPrimary, fontWeight: 500 }}>{t.symbol}</span>
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
      <div style={{ fontSize: '11px', color: CT.textDim, padding: '4px 0 8px', lineHeight: 1.4, letterSpacing: '0.02em' }}>
        Prices reflect front-month futures contracts and may diverge from spot prices.
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
            <PriceRow asset="Gold" data={commodities.GOLD} color={CT.yellow} />
            <PriceRow asset="Silver" data={commodities.SILVER} color={CT.textSecondary} />
            <PriceRow asset="Brent" data={commodities.BRENT} color={CT.pink} />
            <PriceRow asset="Copper" data={commodities.COPPER} color={CT.yellow} />
            <PriceRow asset="Nat Gas" data={commodities.NATGAS} color={CT.greenDisc} />
            <PriceRow asset="10Y" data={rates.US10Y} color={CT.pink} priceOpts={{ prefix: '', suffix: '%' }} />
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
