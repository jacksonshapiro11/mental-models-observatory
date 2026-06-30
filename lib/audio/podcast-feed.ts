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
  /** Pre-built manifest — avoids zrange + N GETs on every feed request */
  EPISODE_MANIFEST: 'audio:episodes:manifest',
  /** Brief Light episodes — separate index and prefix */
  LIGHT_EPISODE_INDEX: 'audio:episodes:light',
  LIGHT_EPISODE_PREFIX: 'audio:episode:light:',
  LIGHT_EPISODE_MANIFEST: 'audio:episodes:light:manifest',
};

// ─── Redis helpers ──────────────────────────────────────────────────────────

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

/** Parse an episode date → sortable numeric score. Strips suffixes like "-light",
 *  falls back to current time if unparseable, never returns NaN (Upstash rejects null scores). */
function parseEpisodeJson(raw: unknown): EpisodeMetadata | null {
  if (!raw) return null;
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as EpisodeMetadata;
  } catch {
    return null;
  }
}

async function readEpisodeManifest(manifestKey: string, limit: number): Promise<EpisodeMetadata[] | null> {
  try {
    const r = getRedis();
    const raw = await r.get(manifestKey);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return null;
    return (parsed as EpisodeMetadata[]).slice(0, limit);
  } catch (err) {
    console.error(`[podcast-feed] readEpisodeManifest failed for ${manifestKey}:`, err);
    return null;
  }
}

async function upsertEpisodeManifest(manifestKey: string, episode: EpisodeMetadata, limit = 100): Promise<void> {
  try {
    const r = getRedis();
    const existing = (await readEpisodeManifest(manifestKey, limit)) || [];
    const without = existing.filter((e) => e.date !== episode.date);
    const updated = [episode, ...without]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    await r.set(manifestKey, JSON.stringify(updated));
  } catch (err) {
    console.error(`[podcast-feed] upsertEpisodeManifest failed for ${manifestKey}:`, err);
  }
}

async function loadEpisodesFromIndex(
  indexKey: string,
  prefix: string,
  limit: number,
): Promise<EpisodeMetadata[]> {
  const r = getRedis();
  const dates = (await r.zrange(indexKey, 0, limit - 1, { rev: true })) as string[];
  if (dates.length === 0) return [];

  const pipeline = r.pipeline();
  for (const d of dates) {
    pipeline.get(prefix + d);
  }
  const results = await pipeline.exec();

  return results
    .map((raw) => parseEpisodeJson(raw))
    .filter((ep): ep is EpisodeMetadata => ep !== null);
}

function scoreForEpisodeDate(date: string): number {
  // Strip common suffixes (e.g. "2026-04-14-light" → "2026-04-14")
  const isoCandidate = date.replace(/-(light|super|v\d+)$/i, '');
  const t = new Date(isoCandidate).getTime();
  if (Number.isFinite(t)) return t;
  // Last resort: use now() so the write still succeeds instead of crashing the pipeline.
  console.warn(`[podcast-feed] Unparseable episode date "${date}", using Date.now() as score`);
  return Date.now();
}

/** Store episode metadata after audio generation */
export async function writeEpisodeMetadata(episode: EpisodeMetadata): Promise<void> {
  try {
    const r = getRedis();
    const key = AUDIO_KEYS.EPISODE_PREFIX + episode.date;
    const score = scoreForEpisodeDate(episode.date);

    await Promise.all([
      r.set(key, JSON.stringify(episode)),
      r.zadd(AUDIO_KEYS.EPISODE_INDEX, { score, member: episode.date }),
      upsertEpisodeManifest(AUDIO_KEYS.EPISODE_MANIFEST, episode),
    ]);
  } catch (err) {
    console.error(`[podcast-feed] writeEpisodeMetadata failed for ${episode.date}:`, err);
    throw err;
  }
}

/** Read episode metadata for a specific date */
export async function readEpisodeMetadata(date: string): Promise<EpisodeMetadata | null> {
  try {
    const r = getRedis();
    const key = AUDIO_KEYS.EPISODE_PREFIX + date;
    const raw = await r.get(key);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as EpisodeMetadata);
  } catch (err) {
    console.error(`[podcast-feed] readEpisodeMetadata failed for ${date}:`, err);
    return null;
  }
}

// ─── Brief Light episode helpers ────────────────────────────────────────────

/** Store Brief Light episode metadata after audio generation */
export async function writeLightEpisodeMetadata(episode: EpisodeMetadata): Promise<void> {
  const r = getRedis();
  const key = AUDIO_KEYS.LIGHT_EPISODE_PREFIX + episode.date;
  const score = scoreForEpisodeDate(episode.date);

  await Promise.all([
    r.set(key, JSON.stringify(episode)),
    r.zadd(AUDIO_KEYS.LIGHT_EPISODE_INDEX, { score, member: episode.date }),
    upsertEpisodeManifest(AUDIO_KEYS.LIGHT_EPISODE_MANIFEST, episode),
  ]);
}

/** Read Brief Light episode metadata for a specific date */
export async function readLightEpisodeMetadata(date: string): Promise<EpisodeMetadata | null> {
  try {
    const r = getRedis();
    const key = AUDIO_KEYS.LIGHT_EPISODE_PREFIX + date;
    const raw = await r.get(key);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as EpisodeMetadata);
  } catch (err) {
    console.error(`[podcast-feed] readLightEpisodeMetadata failed for ${date}:`, err);
    return null;
  }
}

/** Get all episode dates, most recent first */
export async function getAllEpisodeDates(limit = 100): Promise<string[]> {
  try {
    const r = getRedis();
    const dates = await r.zrange(AUDIO_KEYS.EPISODE_INDEX, 0, limit - 1, { rev: true });
    return dates as string[];
  } catch (err) {
    console.error('[podcast-feed] getAllEpisodeDates failed:', err);
    return [];
  }
}

/** Get all episodes with full metadata, most recent first */
export async function getAllEpisodes(limit = 50): Promise<EpisodeMetadata[]> {
  try {
    const fromManifest = await readEpisodeManifest(AUDIO_KEYS.EPISODE_MANIFEST, limit);
    if (fromManifest && fromManifest.length > 0) {
      return fromManifest;
    }

    const episodes = await loadEpisodesFromIndex(
      AUDIO_KEYS.EPISODE_INDEX,
      AUDIO_KEYS.EPISODE_PREFIX,
      limit,
    );
    if (episodes.length > 0) {
      await getRedis().set(AUDIO_KEYS.EPISODE_MANIFEST, JSON.stringify(episodes)).catch(() => {});
    }
    return episodes;
  } catch (err) {
    console.error('[podcast-feed] getAllEpisodes failed:', err);
    return [];
  }
}

/** Get all Brief Light episode dates, most recent first */
export async function getAllLightEpisodeDates(limit = 100): Promise<string[]> {
  try {
    const r = getRedis();
    const dates = await r.zrange(AUDIO_KEYS.LIGHT_EPISODE_INDEX, 0, limit - 1, { rev: true });
    return dates as string[];
  } catch (err) {
    console.error('[podcast-feed] getAllLightEpisodeDates failed:', err);
    return [];
  }
}

/** Get all Brief Light episodes with full metadata, most recent first */
export async function getAllLightEpisodes(limit = 50): Promise<EpisodeMetadata[]> {
  try {
    const fromManifest = await readEpisodeManifest(AUDIO_KEYS.LIGHT_EPISODE_MANIFEST, limit);
    if (fromManifest && fromManifest.length > 0) {
      return fromManifest;
    }

    const episodes = await loadEpisodesFromIndex(
      AUDIO_KEYS.LIGHT_EPISODE_INDEX,
      AUDIO_KEYS.LIGHT_EPISODE_PREFIX,
      limit,
    );
    if (episodes.length > 0) {
      await getRedis()
        .set(AUDIO_KEYS.LIGHT_EPISODE_MANIFEST, JSON.stringify(episodes))
        .catch(() => {});
    }
    return episodes;
  } catch (err) {
    console.error('[podcast-feed] getAllLightEpisodes failed:', err);
    return [];
  }
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
  siteUrl: 'https://cosmictrex.com',
  feedUrl: 'https://cosmictrex.com/api/podcast/feed',
  coverImageUrl: 'https://cosmictrex.com/podcast-cover.jpg',
  author: 'Cosmic Trex',
  email: 'cosmictrex11@gmail.com',
  language: 'en-us',
  category: 'Business',
  subcategory: 'Investing',
  explicit: false,
};

function generateEpisodeXml(episode: EpisodeMetadata, coverImageUrl: string, variant: 'brief' | 'super-brief' = 'brief'): string {
  const pubDate = toRfc2822Date(episode.date);
  const duration = formatDuration(episode.duration);
  const guidPrefix = variant === 'super-brief' ? 'super-brief' : 'daily-brief';
  const titlePrefix = variant === 'super-brief' ? 'Super Brief' : 'Brief';
  const displayTitle = `${titlePrefix}: ${episode.title.replace(/^(Daily Brief|Super Brief|Brief Light)\s*[—–-]\s*/i, '')}`;

  return `    <item>
      <title>${escapeXml(displayTitle)}</title>
      <description>${escapeXml(episode.description)}</description>
      <enclosure url="${escapeXml(episode.audioUrl)}" length="${episode.fileSize}" type="audio/mpeg" />
      <guid isPermaLink="false">${guidPrefix}-${episode.date}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:duration>${duration}</itunes:duration>
      <itunes:image href="${escapeXml(coverImageUrl)}" />
      <itunes:explicit>no</itunes:explicit>
    </item>`;
}

/**
 * Generate the full RSS 2.0 podcast feed XML.
 */
export async function generatePodcastFeed(config?: Partial<FeedConfig>): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Fetch both full and super brief episodes
  const [fullEpisodes, lightEpisodes] = await Promise.all([
    getAllEpisodes(100),
    getAllLightEpisodes(100),
  ]);

  // Tag each with variant and merge
  const tagged: Array<{ ep: EpisodeMetadata; variant: 'brief' | 'super-brief' }> = [
    ...fullEpisodes.map(ep => ({ ep, variant: 'brief' as const })),
    ...lightEpisodes.map(ep => ({ ep, variant: 'super-brief' as const })),
  ];

  // Sort by date descending, briefs before super briefs on the same day
  tagged.sort((a, b) => {
    const dateCompare = b.ep.date.localeCompare(a.ep.date);
    if (dateCompare !== 0) return dateCompare;
    return a.variant === 'brief' ? -1 : 1;
  });

  const lastBuildDate = tagged.length > 0
    ? toRfc2822Date(tagged[0]!.ep.date)
    : new Date().toUTCString();

  const episodeXml = tagged.map(({ ep, variant }) => generateEpisodeXml(ep, cfg.coverImageUrl, variant)).join('\n');

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
