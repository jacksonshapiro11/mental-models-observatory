/**
 * /api/webhooks/resend — Resend email event webhook
 *
 * Stores delivery events in Redis (`metrics:email:{date}`) for future dashboard.
 * Verifies Svix signature when RESEND_WEBHOOK_SECRET is set.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { todayET } from '@/lib/publish-date';

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
  };
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function verifySvixSignature(payload: string, headers: Headers, secret: string): boolean {
  const msgId = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!msgId || !timestamp || !signature) return false;

  const signed = `${msgId}.${timestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', secretBytes).update(signed).digest('base64');

  for (const part of signature.split(' ')) {
    const [, sig] = part.split(',');
    if (!sig) continue;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // continue
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (webhookSecret && !verifySvixSignature(rawBody, req.headers, webhookSecret)) {
    console.warn('[webhooks/resend] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dateTag = event.data?.tags?.find((t) => t.name === 'date')?.value;
  const dateKey = dateTag || todayET();
  const redisKey = `metrics:email:${dateKey}`;

  try {
    const r = getRedis();
    const existing = (await r.get<Record<string, number>>(redisKey)) || {};
    const type = event.type || 'unknown';
    const updated = { ...existing, [type]: (existing[type] || 0) + 1 };
    await r.set(redisKey, updated);
    console.log(`[webhooks/resend] ${type} → ${redisKey}`);
  } catch (err) {
    console.error('[webhooks/resend] Redis error:', err);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
