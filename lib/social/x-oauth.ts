/**
 * X/Twitter OAuth 2.0 token management
 *
 * Tokens rotate on every refresh (single-use refresh tokens).
 * Redis (x-oauth:tokens) is the source of truth after first auth;
 * env vars seed initial values from Vercel / .env.local.
 */

import { Redis } from '@upstash/redis';
import { TwitterApi } from 'twitter-api-v2';

export const X_OAUTH_REDIS_KEY = 'x-oauth:tokens';
export const X_OAUTH_PENDING_KEY = 'x-oauth:pending';

export interface XOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  updatedAt?: string;
}

export function parseRedisJson<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function readXTokensFromRedis(): Promise<XOAuthTokens | null> {
  const redis = getRedis();
  if (!redis) return null;

  const raw = await redis.get(X_OAUTH_REDIS_KEY);
  const parsed = parseRedisJson<XOAuthTokens>(raw);
  if (!parsed?.accessToken) return null;
  return parsed;
}

export async function writeXTokensToRedis(tokens: XOAuthTokens): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  await redis.set(
    X_OAUTH_REDIS_KEY,
    JSON.stringify({
      ...tokens,
      updatedAt: tokens.updatedAt || new Date().toISOString(),
    }),
  );
  return true;
}

export async function loadXOAuthTokens(): Promise<{
  tokens: XOAuthTokens | null;
  source: 'redis' | 'env' | null;
}> {
  const fromRedis = await readXTokensFromRedis();
  if (fromRedis?.accessToken) {
    return { tokens: fromRedis, source: 'redis' };
  }

  const accessToken = process.env.TWITTER_OAUTH2_ACCESS_TOKEN;
  if (!accessToken) {
    return { tokens: null, source: null };
  }

  return {
    tokens: {
      accessToken,
      refreshToken: process.env.TWITTER_OAUTH2_REFRESH_TOKEN,
    },
    source: 'env',
  };
}

export function hasXOAuthConfig(): boolean {
  return Boolean(process.env.TWITTER_CLIENT_ID);
}

export async function hasXPostingCredentials(): Promise<boolean> {
  if (!hasXOAuthConfig()) return false;
  const { tokens } = await loadXOAuthTokens();
  return Boolean(tokens?.accessToken);
}

/**
 * Refresh OAuth 2.0 tokens and persist the rotated refresh token to Redis.
 * Returns the access token to use for posting.
 */
export async function refreshAndPersistXTokens(
  current: XOAuthTokens,
): Promise<{ accessToken: string; refreshed: boolean }> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    throw new Error('TWITTER_CLIENT_ID not set');
  }

  if (!current.refreshToken) {
    return { accessToken: current.accessToken, refreshed: false };
  }

  const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  const authClient = new TwitterApi({ clientId, clientSecret });
  const refreshResult = await authClient.refreshOAuth2Token(current.refreshToken);

  const nextTokens: XOAuthTokens = {
    accessToken: refreshResult.accessToken,
    refreshToken: refreshResult.refreshToken || current.refreshToken,
    updatedAt: new Date().toISOString(),
  };

  await writeXTokensToRedis(nextTokens);

  return { accessToken: nextTokens.accessToken, refreshed: true };
}

export function createXPostingClient(accessToken: string): TwitterApi {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (clientId) {
    return new TwitterApi(accessToken, { clientId });
  }
  return new TwitterApi(accessToken);
}

export async function resolveXPostingClient(): Promise<{
  client: TwitterApi;
  tokenSource: 'redis' | 'env';
  refreshed: boolean;
}> {
  const { tokens, source } = await loadXOAuthTokens();
  if (!tokens?.accessToken) {
    throw new Error(
      'No X OAuth 2.0 tokens found. Run OAuth at /api/x-auth or set TWITTER_OAUTH2_ACCESS_TOKEN.',
    );
  }

  let accessToken = tokens.accessToken;
  let refreshed = false;

  if (tokens.refreshToken) {
    try {
      const result = await refreshAndPersistXTokens(tokens);
      accessToken = result.accessToken;
      refreshed = result.refreshed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[x-oauth] Token refresh failed, trying existing access token: ${msg}`);
    }
  }

  return {
    client: createXPostingClient(accessToken),
    tokenSource: source || 'env',
    refreshed,
  };
}
