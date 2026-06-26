/**
 * /api/unsubscribe — One-click email unsubscribe
 *
 * GET ?email=...&token=... — HMAC-signed token (UNSUBSCRIBE_SECRET or SNAPSHOT_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';

const REDIS_KEY_SUBSCRIBERS = 'subscribers:emails';
const REDIS_KEY_SUB_META = 'subscribers:meta:';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function htmlPage(title: string, message: string): NextResponse {
  const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Cosmic Trex</title>
<style>body{font-family:Georgia,serif;background:#faf8f3;color:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
.card{max-width:420px;background:#fff;padding:40px;border:1px solid #e8e2d5;text-align:center;}
h1{font-size:22px;margin:0 0 12px;}p{font-size:15px;line-height:1.6;color:#3d3629;margin:0;}</style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token');

  if (!email || !token) {
    return htmlPage('Invalid link', 'This unsubscribe link is missing required parameters.');
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return htmlPage('Invalid link', 'This unsubscribe link is invalid or has expired.');
  }

  try {
    const r = getRedis();
    const removed = await r.srem(REDIS_KEY_SUBSCRIBERS, email);
    if (removed) {
      await r.hset(REDIS_KEY_SUB_META + email, {
        unsubscribedAt: new Date().toISOString(),
      });
      console.log('[unsubscribe] removed:', email);
    }
    return htmlPage("You're unsubscribed", "You won't receive any more emails from Cosmic Trex.");
  } catch (err) {
    console.error('[unsubscribe] error:', err);
    return htmlPage('Something went wrong', 'Please try again or reply to any email to unsubscribe manually.');
  }
}
