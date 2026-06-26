import { createHmac, timingSafeEqual } from 'crypto';

const SITE_URL = 'https://cosmictrex.com';

function getSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SNAPSHOT_SECRET || null;
}

export function generateUnsubscribeToken(email: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('base64url');
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildUnsubscribeUrl(email: string): string | null {
  const token = generateUnsubscribeToken(email);
  if (!token) return null;
  const params = new URLSearchParams({ email, token });
  return `${SITE_URL}/api/unsubscribe?${params.toString()}`;
}
