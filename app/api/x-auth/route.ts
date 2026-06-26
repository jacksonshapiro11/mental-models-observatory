/**
 * /api/x-auth — X/Twitter OAuth 2.0 Authorization Flow
 *
 * Step 1: GET /api/x-auth?secret=SNAPSHOT_SECRET → Redirects to X authorization page
 * Step 2: X redirects back to /api/x-auth/callback with auth code
 * Step 3: Callback exchanges code for tokens and stores in Redis
 *
 * After auth, the distribute route reads tokens from Redis automatically.
 *
 * Only needs to be run once (or when tokens are fully expired).
 * Protected by SNAPSHOT_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { Redis } from '@upstash/redis';
import { getXOAuthCallbackUrl, X_OAUTH_PENDING_KEY } from '@/lib/social/x-oauth';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.SNAPSHOT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'TWITTER_CLIENT_ID not configured' }, { status: 500 });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: 'UPSTASH_REDIS_REST_URL/TOKEN not configured' }, { status: 500 });
  }

  const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
  const client = new TwitterApi({ clientId, clientSecret });
  const callbackUrl = getXOAuthCallbackUrl(req.nextUrl.origin);

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackUrl, {
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  });

  const redis = new Redis({ url: redisUrl, token: redisToken });
  await redis.set(
    X_OAUTH_PENDING_KEY,
    JSON.stringify({ codeVerifier, state }),
    { ex: 600 },
  );

  return NextResponse.redirect(url);
}
