import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// ─── Config ────────────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per IP per minute
const REDIS_KEY_SUBSCRIBERS = 'subscribers:emails';       // Redis Set of emails
const REDIS_KEY_SUB_META = 'subscribers:meta:';           // Hash per email
const REDIS_KEY_RATE_LIMIT = 'subscribers:ratelimit:';    // Rate limit per IP

// ─── Redis singleton ──────────────────────────────────────────────────────────

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

// ─── Rate limiting (Redis-backed, survives restarts) ──────────────────────────

async function isRateLimited(ip: string): Promise<boolean> {
  const r = getRedis();
  const key = REDIS_KEY_RATE_LIMIT + hashIP(ip);

  try {
    const count = await r.incr(key);
    if (count === 1) {
      // First request in window — set TTL
      await r.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
    }
    return count > RATE_LIMIT_MAX;
  } catch {
    // If Redis is down, fail open (allow request)
    return false;
  }
}

// ─── Email validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateEmail(email: unknown): { valid: boolean; sanitized: string; error?: string } {
  if (typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'Email is required.' };
  }

  const sanitized = email.trim().toLowerCase();

  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Email is required.' };
  }
  if (sanitized.length > 254) {
    return { valid: false, sanitized: '', error: 'Email is too long.' };
  }

  // Reject injection vectors
  if (/[\r\n\0\t]/.test(sanitized)) {
    return { valid: false, sanitized: '', error: 'Invalid email.' };
  }

  if (!EMAIL_REGEX.test(sanitized)) {
    return { valid: false, sanitized: '', error: 'Please enter a valid email address.' };
  }

  // Block disposable/throwaway domains
  const domain = sanitized.split('@')[1] ?? '';
  const disposable = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'dispostable.com', 'tempail.com', 'fakeinbox.com', 'trashmail.com',
    'maildrop.cc', '10minutemail.com',
  ];
  if (disposable.includes(domain)) {
    return { valid: false, sanitized: '', error: 'Please use a permanent email address.' };
  }

  return { valid: true, sanitized };
}

// ─── IP hashing ───────────────────────────────────────────────────────────────

function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }

  // Honeypot check — if the hidden field has a value, it's a bot
  if (body.website && typeof body.website === 'string' && body.website.length > 0) {
    // Silently accept but don't store — don't tip off the bot
    return NextResponse.json({ success: true, message: "You're in." });
  }

  // Validate email
  const { valid, sanitized, error } = validateEmail(body.email);
  if (!valid) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Source tracking
  const source = typeof body.source === 'string' && body.source.length < 50
    ? body.source
    : 'unknown';

  const r = getRedis();

  try {
    // Check if already subscribed (Redis Set — O(1) lookup)
    const exists = await r.sismember(REDIS_KEY_SUBSCRIBERS, sanitized);

    if (exists) {
      // Don't reveal whether the email exists — just say success
      return NextResponse.json({ success: true, message: "You're in." });
    }

    // Add to subscribers set + store metadata atomically via pipeline
    const pipeline = r.pipeline();
    pipeline.sadd(REDIS_KEY_SUBSCRIBERS, sanitized);
    pipeline.hset(REDIS_KEY_SUB_META + sanitized, {
      email: sanitized,
      subscribedAt: new Date().toISOString(),
      source,
      ip: hashIP(ip),
    });
    await pipeline.exec();

    return NextResponse.json({ success: true, message: "You're in." });
  } catch (err) {
    console.error('[subscribe] Redis error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// ─── GET handler — subscriber count (no emails exposed) ────────────────────────

export async function GET() {
  try {
    const r = getRedis();
    const count = await r.scard(REDIS_KEY_SUBSCRIBERS);
    return NextResponse.json({ count, source: 'redis' });
  } catch (err) {
    console.error('[subscribe] Redis read error:', err);
    return NextResponse.json({ count: 0, source: 'error' });
  }
}
