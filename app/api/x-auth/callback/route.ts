/**
 * /api/x-auth/callback — OAuth 2.0 callback from X
 *
 * Exchanges the auth code for access + refresh tokens,
 * stores them in Redis for the distribute route to use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { Redis } from '@upstash/redis';
import {
  X_OAUTH_PENDING_KEY,
  parseRedisJson,
  writeXTokensToRedis,
} from '@/lib/social/x-oauth';

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return NextResponse.json(
      { error: `Authorization denied: ${oauthError}` },
      { status: 400 },
    );
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const pendingRaw = await redis.get(X_OAUTH_PENDING_KEY);
  const pending = parseRedisJson<{ codeVerifier: string; state: string }>(pendingRaw);

  if (!pending) {
    return NextResponse.json(
      { error: 'No pending auth found. Start over at /api/x-auth?secret=YOUR_SNAPSHOT_SECRET' },
      { status: 400 },
    );
  }

  if (pending.state !== state) {
    return NextResponse.json({ error: 'State mismatch' }, { status: 400 });
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'TWITTER_CLIENT_ID not configured' }, { status: 500 });
  }

  const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  const callbackUrl = `${req.nextUrl.origin}/api/x-auth/callback`;

  try {
    const client = new TwitterApi({ clientId, clientSecret });
    const result = await client.loginWithOAuth2({
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: callbackUrl,
    });

    await writeXTokensToRedis({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    await redis.del(X_OAUTH_PENDING_KEY);

    const me = await result.client.v2.me();

    return NextResponse.json({
      success: true,
      user: me.data.username,
      message: `Authenticated as @${me.data.username}. Tokens stored in Redis. The distribute route will use them automatically.`,
      nextStep: 'Optional: update TWITTER_OAUTH2_ACCESS_TOKEN and TWITTER_OAUTH2_REFRESH_TOKEN in Vercel as backup seeds.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Token exchange failed: ${msg}` }, { status: 500 });
  }
}
