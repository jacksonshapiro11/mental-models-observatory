/**
 * RSS 2.0 podcast feed generator with iTunes namespace extensions.
 *
 * Generates valid XML that Apple Podcasts, Overcast, Pocket Casts, and
 * every other podcast app can subscribe to. Episodes are read from Redis
 * where audio generation stores metadata.
 */

import { Redis } from '@upstash/redis';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EpisodeMetadata {
  date: string;           // "2026-03-02"
  title: string;          // "Daily Brief — Monday, March 2, 2026"
  description: string;    // Brief lede / summary
  audioUrl: string;       // Vercel Blob CDN URL
  duration: number;       // Seconds
  fileSize: number;       // Bytes
  generatedAt: string;    // ISO timestamp
}

// ─── Redis keys ─────────────────────────────────────────────────────────────

const AUDIO_KEYS = {
  /** Sorted set of all episode dates (score = unix timestamp) */
  EPISODE_INDEX: 'audio:episodes',
  /** Individual episode metadata: audio:episode:YYYY-MM-DD */
  EPISODE_PREFIX: 'audio:episode:',
};

// ─── Redis helpers ──────────────────────────────────────────────────────────

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

/** Store episode metadata after audio generation */
export async function writeEpisodeMetadata(episode: EpisodeMetadata): Promise<void> {
  const r = getRedis();
  const key = AUDIO_KEYS.EPISODE_PREFIX + episode.date;
  const score = new Date(episode.date).getTime();

  await Promise.all([
    r.set(key, JSON.stringify(episode)),
    r.zadd(AUDIO_KEYS.EPISODE_INDEX, { score, member: episode.date }),
  ]);
}

/** Read episode metadata for a specific date */
export async function readEpisodeMetadata(date: string): Promise<EpisodeMetadata | null> {
  const r = getRedis();
  const key = AUDIO_KEYS.EPISODE_PREFIX + date;
  const raw = await r.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as EpisodeMetadata;
}

/** Get all episode dates, most recent first */
export async function getAllEpisodeDates(limit = 100): Promise<string[]> {
  const r = getRedis();
  // ZREVRANGE returns highest scores first (most recent dates)
  const dates = await r.zrange(AUDIO_KEYS.EPISODE_INDEX, 0, limit - 1, { rev: true });
  return dates as string[];
}

/** Get all episodes with full metadata, most recent first */
export async function getAllEpisodes(limit = 50): Promise<EpisodeMetadata[]> {
  const dates = await getAllEpisodeDates(limit);
  if (dates.length === 0) return [];

  const r = getRedis();
  const keys = dates.map(d => AUDIO_KEYS.EPISODE_PREFIX + d);

  // Batch fetch all episode metadata
  const results = await Promise.all(keys.map(k => r.get(k)));

  return results
    .filter((raw): raw is string | EpisodeMetadata => raw !== null)
    .map(raw => (typeof raw === 'string' ? JSON.parse(raw) : raw) as EpisodeMetadata);
}

// ─── RSS XML generation ─────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function toRfc2822Date(dateStr: string): string {
  const d = new Date(dateStr + 'T11:00:00Z'); // Publish time: 11:00 UTC
  return d.toUTCString();
}

interface FeedConfig {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  coverImageUrl: string;
  author: string;
  email: string;
  language: string;
  category: string;
  subcategory?: string;
  explicit: boolean;
}

const DEFAULT_CONFIG: FeedConfig = {
  title: 'Markets, Meditations, and Mental Models',
  description: 'Your daily guide to an increasingly complex world. Markets, crypto, AI, geopolitics, and the mental models that connect them — from Cosmic Trex, where ancient wisdom meets the cutting edge.',
  siteUrl: 'https://www.cosmictrex.com',
  feedUrl: 'https://www.cosmictrex.com/api/podcast/feed',
  coverImageUrl: 'https://www.cosmictrex.com/podcast-cover.jpg',
  author: 'Cosmic Trex',
  email: 'jacksonshapiro11@gmail.com',
  language: 'en-us',
  category: 'Business',
  subcategory: 'Investing',
  explicit: false,
};

function generateEpisodeXml(episode: EpisodeMetadata): string {
  const pubDate = toRfc2822Date(episode.date);
  const duration = formatDuration(episode.duration);

  return `    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description)}</description>
      <enclosure url="${escapeXml(episode.audioUrl)}" length="${episode.fileSize}" type="audio/mpeg" />
      <guid isPermaLink="false">daily-brief-${episode.date}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:episode>${parseInt(episode.date.replace(/-/g, ''), 10)}</itunes:episode>
      <itunes:explicit>no</itunes:explicit>
    </item>`;
}

/**
 * Generate the full RSS 2.0 podcast feed XML.
 */
export async function generatePodcastFeed(config?: Partial<FeedConfig>): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const episodes = await getAllEpisodes(100);

  const lastBuildDate = episodes.length > 0
    ? toRfc2822Date(episodes[0]!.date)
    : new Date().toUTCString();

  const episodeXml = episodes.map(generateEpisodeXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(cfg.title)}</title>
    <link>${escapeXml(cfg.siteUrl)}</link>
    <description>${escapeXml(cfg.description)}</description>
    <language>${cfg.language}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(cfg.feedUrl)}" rel="self" type="application/rss+xml" />

    <itunes:author>${escapeXml(cfg.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(cfg.author)}</itunes:name>
      <itunes:email>${escapeXml(cfg.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(cfg.coverImageUrl)}" />
    <itunes:category text="${escapeXml(cfg.category)}"${cfg.subcategory ? `>
      <itunes:category text="${escapeXml(cfg.subcategory)}" />
    </itunes:category>` : ' />'}
    <itunes:explicit>${cfg.explicit ? 'yes' : 'no'}</itunes:explicit>
    <itunes:type>episodic</itunes:type>

${episodeXml}
  </channel>
</rss>`;
}

// ─── Exports ────────────────────────────────────────────────────────────────

export { AUDIO_KEYS };
