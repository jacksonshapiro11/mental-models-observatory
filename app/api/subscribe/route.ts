import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────────

const SUBSCRIBERS_FILE = path.join(process.cwd(), 'data', 'subscribers.json');
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 requests per IP per minute

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// Resets on server restart — fine for this scale.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── Email validation ──────────────────────────────────────────────────────────

// Strict-ish email regex — catches the real attacks without being overly pedantic.
// Rejects: no @, multiple @, dots at start/end of domain, absurdly long strings,
// special chars used in injection attempts (newlines, commas, semicolons).
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateEmail(email: unknown): { valid: boolean; sanitized: string; error?: string } {
  if (typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'Email is required.' };
  }

  // Trim and lowercase
  const sanitized = email.trim().toLowerCase();

  // Length checks — prevent absurdly long payloads
  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Email is required.' };
  }
  if (sanitized.length > 254) {
    return { valid: false, sanitized: '', error: 'Email is too long.' };
  }

  // Reject newlines, null bytes, and other injection vectors
  if (/[\r\n\0\t]/.test(sanitized)) {
    return { valid: false, sanitized: '', error: 'Invalid email.' };
  }

  // Format check
  if (!EMAIL_REGEX.test(sanitized)) {
    return { valid: false, sanitized: '', error: 'Please enter a valid email address.' };
  }

  // Block disposable/throwaway domains (lightweight check — expand as needed)
  const domain = sanitized.split('@')[1] ?? '';
  const disposable = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email', 'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'dispostable.com'];
  if (disposable.includes(domain)) {
    return { valid: false, sanitized: '', error: 'Please use a permanent email address.' };
  }

  return { valid: true, sanitized };
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

interface Subscriber {
  email: string;
  subscribedAt: string; // ISO timestamp
  source: string;       // which form they signed up from
  ip: string;           // hashed for analytics, not stored raw
}

interface SubscriberStore {
  subscribers: Subscriber[];
  lastUpdated: string;
}

function hashIP(ip: string): string {
  // Simple one-way hash — enough to detect duplicates per IP without storing raw IPs
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return `ip_${Math.abs(hash).toString(36)}`;
}

function readStore(): SubscriberStore {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const raw = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
      return JSON.parse(raw) as SubscriberStore;
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { subscribers: [], lastUpdated: new Date().toISOString() };
}

function writeStore(store: SubscriberStore): void {
  const dir = path.dirname(SUBSCRIBERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  if (isRateLimited(ip)) {
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
    return NextResponse.json({ success: true, message: 'You\'re in.' });
  }

  // Validate email
  const { valid, sanitized, error } = validateEmail(body.email);
  if (!valid) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Source tracking — which form did they use?
  const source = typeof body.source === 'string' && body.source.length < 50
    ? body.source
    : 'unknown';

  // Read current subscribers, check for duplicates, store
  const store = readStore();
  const alreadyExists = store.subscribers.some(s => s.email === sanitized);

  if (alreadyExists) {
    // Don't reveal whether the email exists — just say success
    return NextResponse.json({ success: true, message: 'You\'re in.' });
  }

  store.subscribers.push({
    email: sanitized,
    subscribedAt: new Date().toISOString(),
    source,
    ip: hashIP(ip),
  });

  writeStore(store);

  return NextResponse.json({ success: true, message: 'You\'re in.' });
}

// ─── GET handler — subscriber count (no emails exposed) ────────────────────────

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    count: store.subscribers.length,
    lastUpdated: store.lastUpdated,
  });
}
