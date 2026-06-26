import { Redis } from '@upstash/redis';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { generateThreadFromDate } from '@/lib/social/thread-generator';

const SITE_URL = 'https://cosmictrex.com';

export interface DailyMarketingPack {
  subject: string;
  previewText: string;
  xPosts: string[];
  ogTitle: string;
  ogDescription: string;
  dailyTitle: string;
  storedAt: string;
}

function extractSubject(brief: ReturnType<typeof getBriefLightByDate>): string {
  if (!brief) return '';
  const update = brief.sections.find((s) => s.id === 'the-update');
  if (update) {
    const match = update.content.match(/^\*\*(.+?)\*\*\s*$/m);
    if (match?.[1]) return match[1].trim();
  }
  return brief.dailyTitle || `Brief — ${brief.displayDate}`;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
}

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

/**
 * Build and store the daily marketing pack in Redis (`marketing:pack:{date}`).
 * Best-effort — callers should not block distribution on failure.
 */
export async function generateDailyPack(date: string): Promise<{
  success: boolean;
  pack?: DailyMarketingPack;
  error?: string;
}> {
  const brief = getBriefLightByDate(date);
  if (!brief) {
    return { success: false, error: `No brief light found for ${date}` };
  }

  const subject = extractSubject(brief);
  const previewText = truncate(brief.lede || brief.epigraph, 140);
  const thread = generateThreadFromDate(date);
  const xPosts = thread?.tweets.map((t) => t.text) ?? [];

  const pack: DailyMarketingPack = {
    subject,
    previewText,
    xPosts,
    ogTitle: `${brief.dailyTitle} — Cosmic Trex`,
    ogDescription: previewText,
    dailyTitle: brief.dailyTitle,
    storedAt: new Date().toISOString(),
  };

  try {
    const r = getRedis();
    await r.set(`marketing:pack:${date}`, pack);
    console.log(`[marketing-pack] Stored pack for ${date} (${SITE_URL})`);
    return { success: true, pack };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
