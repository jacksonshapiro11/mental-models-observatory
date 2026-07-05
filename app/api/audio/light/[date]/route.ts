/**
 * /api/audio/light/[date] — Brief Light audio metadata endpoint
 *
 * GET /api/audio/light/2026-04-06 → daily super brief episode metadata
 * GET /api/audio/light/2026-W27 → weekly light episode (maps to weekly-light-2026-W27)
 *
 * Used by SuperBriefAudioPlayer on daily and weekly light pages.
 *
 * In production: reads from Redis (populated by /api/audio/generate?variant=light).
 * In development: falls back to checking public/audio/ for local test files.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { readLightEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { resolveLightEpisodeKey } from '@/lib/audio/episode-keys';

function localFilenameForLightEpisode(episodeKey: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(episodeKey)) {
    return `brief-light-${episodeKey}.mp3`;
  }
  if (/^weekly-light-\d{4}-W\d/i.test(episodeKey)) {
    return `${episodeKey}.mp3`;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const episodeKey = resolveLightEpisodeKey(date);

  if (!episodeKey) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD or a weekly slug like 2026-W27.' },
      { status: 400 }
    );
  }

  try {
    // Try Redis first (production path)
    try {
      const episode = await readLightEpisodeMetadata(episodeKey);
      if (episode) {
        return NextResponse.json(episode, {
          headers: {
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800',
          },
        });
      }
    } catch (redisErr) {
      console.warn(`[audio:light] Redis lookup failed for ${episodeKey}, checking local files:`, redisErr);
    }

    // Dev fallback: check for local MP3 in public/audio/
    const localFilename = localFilenameForLightEpisode(episodeKey);
    if (localFilename) {
      const localPath = path.join(process.cwd(), 'public', 'audio', localFilename);

      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const estimatedDuration = Math.round(stats.size / (128000 / 8));
        const origin = req.nextUrl.origin;

        return NextResponse.json({
          date: episodeKey,
          title: /^weekly-light-/i.test(episodeKey)
            ? `Weekly Light — ${date.replace(/^weekly-light-/, '')}`
            : `Super Brief — ${episodeKey}`,
          description: 'Brief Light audio (test)',
          audioUrl: `${origin}/audio/${localFilename}`,
          duration: estimatedDuration,
          fileSize: stats.size,
          generatedAt: stats.mtime.toISOString(),
        });
      }
    }

    return NextResponse.json(
      { error: 'No Brief Light audio available for this date', date: episodeKey },
      { status: 404 }
    );
  } catch (err) {
    console.error(`[audio:light] Metadata fetch failed for ${episodeKey}:`, err);
    return NextResponse.json(
      { error: 'Failed to fetch Brief Light audio metadata' },
      { status: 500 }
    );
  }
}
