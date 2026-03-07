/**
 * Upstash Redis helper for dashboard data persistence
 *
 * Replaces /tmp file storage (which doesn't persist across Vercel function instances)
 * with Upstash Redis (free tier: 10K commands/day, 256MB storage)
 *
 * Setup: npm install @upstash/redis
 * Env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  generatedAt: number;
  date: string;
  equities: Record<string, AssetSnapshot>;
  crypto: Record<string, AssetSnapshot>;
  commodities: Record<string, AssetSnapshot>;
  rates: Record<string, AssetSnapshot>;
  dxy: { value: number; rates: Record<string, number> } | null;
  fearGreed: { value: number; label: string; timestamp: number } | null;
  errors: Array<{ index: number; error: string }>;
}

export interface AssetSnapshot {
  latestClose: number;
  changes: Record<string, number>;
  mas: Record<string, number>;
}

export interface ManualFields {
  fedWatch?: string;
  etfFlows?: number;
  fedFunds?: string;
  notes?: string;
  updatedAt?: number;
}

export interface CoinGeckoGlobal {
  btcDominance: number | null;
  ethDominance: number | null;
  totalMarketCap: number | null;
  totalVolume24h: number | null;
  defiMarketCap: number | null;
  defiToEthRatio: number | null;
  defiVolume24h: number | null;
  defiDominance: number | null;
  trending: Array<{ name: string; symbol: string; rank: number; price_btc?: number }>;
  btcFundingRate: number | null;    // perpetual futures avg funding rate
  btcOpenInterest: number | null;   // total open interest USD
  corporateBtcHoldings: number | null; // total BTC held by public companies
  fetchedAt: number;
}

// ─── SINGLETON ───────────────────────────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// ─── KEYS ────────────────────────────────────────────────────────────────────

export const KEYS = {
  DAILY_SNAPSHOT: 'dashboard:snapshot:latest',
  COINGECKO_GLOBAL: 'dashboard:coingecko:global',
  MANUAL_FIELDS: 'dashboard:manual',
  PRICE_HISTORY_PREFIX: 'dashboard:history:', // + YYYY-MM-DD
};

// ─── SNAPSHOT (written once/day by cron) ─────────────────────────────────────

export async function writeSnapshot(data: DashboardSnapshot): Promise<boolean> {
  const r = getRedis();
  await r.set(KEYS.DAILY_SNAPSHOT, JSON.stringify(data));
  return true;
}

export async function readSnapshot(): Promise<DashboardSnapshot | null> {
  const r = getRedis();
  const raw = await r.get(KEYS.DAILY_SNAPSHOT);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as DashboardSnapshot;
}

// ─── COINGECKO CACHE (1-hour TTL — ~720 calls/month, well within 10K limit) ─

export async function writeCoinGeckoGlobal(data: CoinGeckoGlobal): Promise<boolean> {
  const r = getRedis();
  // TTL = 3600 seconds (1 hour)
  await r.set(KEYS.COINGECKO_GLOBAL, JSON.stringify(data), { ex: 3600 });
  return true;
}

export async function readCoinGeckoGlobal(): Promise<CoinGeckoGlobal | null> {
  const r = getRedis();
  const raw = await r.get(KEYS.COINGECKO_GLOBAL);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as CoinGeckoGlobal;
}

// ─── MANUAL FIELDS (FedWatch, ETF flows — entered via PATCH) ────────────────

export async function writeManualFields(fields: Partial<ManualFields>): Promise<ManualFields> {
  const r = getRedis();
  const existing = await readManualFields();
  const merged: ManualFields = { ...existing, ...fields, updatedAt: Date.now() };
  await r.set(KEYS.MANUAL_FIELDS, JSON.stringify(merged));
  return merged;
}

export async function readManualFields(): Promise<ManualFields> {
  const r = getRedis();
  const raw = await r.get(KEYS.MANUAL_FIELDS);
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw as ManualFields;
}

// ─── PRICE HISTORY (append daily, never overwrite) ──────────────────────────

export async function writePriceHistory(date: string, data: DashboardSnapshot): Promise<boolean> {
  const r = getRedis();
  const key = KEYS.PRICE_HISTORY_PREFIX + date;
  await r.set(key, JSON.stringify(data));
  return true;
}

export async function readPriceHistory(date: string): Promise<DashboardSnapshot | null> {
  const r = getRedis();
  const key = KEYS.PRICE_HISTORY_PREFIX + date;
  const raw = await r.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as DashboardSnapshot;
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────

export async function ping(): Promise<string> {
  const r = getRedis();
  return r.ping();
}
