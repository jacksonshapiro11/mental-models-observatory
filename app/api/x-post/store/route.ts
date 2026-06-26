/**
 * /api/x-post/store — Stores generated X post content in Redis
 *
 * Called by the daily-x-post scheduled task after generating the post.
 * The distribute cron later reads from Redis and posts to X via OAuth 2.0.
 *
 * POST body: { date: "YYYY-MM-DD", mainPost: "...", reply: "..." }
 * Protected by SNAPSHOT_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { parseRedisJson } from '@/lib/social/x-oauth';

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  if (!snapshotSecret) return false;

  const secret =
    req.headers.get('x-snapshot-secret') ||
    req.nextUrl.searchParams.get('secret');
  if (secret === snapshotSecret) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === snapshotSecret) return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, mainPost, reply } = body;

  if (!date || !mainPost) {
    return NextResponse.json(
      { error: 'Missing required fields: date, mainPost' },
      { status: 400 }
    );
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const key = `x-post:${date}`;
  const value = {
    mainPost,
    reply:
      reply ||
      `**Every morning we connect what Wall Street missed, what your feed won't show you, and what it actually means for your life.**\n\nMost media steals your time. We give it back. Our algorithm works for you. Daily brief, daily podcast, 119 mental models — long form, short form, text, audio. We meet you where you are, every single morning.\n\nNo ads. No sponsors. No agenda. Just a principled guide to a complex world. Like this or share it with a friend.\n\ncosmictrex.com/super-brief`,
    storedAt: new Date().toISOString(),
  };

  // Store with 7-day TTL (no need to keep old posts forever)
  await redis.set(key, JSON.stringify(value), { ex: 7 * 24 * 60 * 60 });

  console.log(`[x-post/store] Stored x-post for ${date} (${mainPost.length} chars)`);

  return NextResponse.json({ success: true, date, key });
}
