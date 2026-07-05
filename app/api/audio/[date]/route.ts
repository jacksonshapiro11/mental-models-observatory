/**
 * /api/audio/[date] — Audio metadata endpoint
 *
 * GET /api/audio/2026-03-02 → daily episode metadata
 * GET /api/audio/2026-W27 → weekly full episode (maps to weekly-2026-W27 in Redis)
 *
 * Used by the website audio player to find the MP3 URL for a given brief date.
 *
 * In production: reads from Redis (populated by /api/audio/generate).
 * In development: falls back to checking public/audio/ for local test files.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';
import { resolveFullEpisodeKey } from '@/lib/audio/episode-keys';

function localFilenameForFullEpisode(episodeKey: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(episodeKey)) {
    return `daily-brief-${episodeKey}.mp3`;
  }
  if (/^weekly-\d{4}-W\d/i.test(episodeKey)) {
    return `${episodeKey}.mp3`;
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const episodeKey = resolveFullEpisodeKey(date);

  if (!episodeKey) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD or a weekly slug like 2026-W27.' },
      { status: 400 }
    );
  }

  try {
    // Try Redis first (production path)
    try {
      const episode = await readEpisodeMetadata(episodeKey);
      if (episode) {
        return NextResponse.json(episode, {
          headers: {
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800',
          },
        });
      }
    } catch (redisErr) {
      // Redis unavailable (common in local dev) — fall through to local file check
      console.warn(`[audio] Redis lookup failed for ${episodeKey}, checking local files:`, redisErr);
    }

    // Dev fallback: check for local MP3 in public/audio/
    const localFilename = localFilenameForFullEpisode(episodeKey);
    if (localFilename) {
      const localPath = path.join(process.cwd(), 'public', 'audio', localFilename);

      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        const estimatedDuration = Math.round(stats.size / (128000 / 8));
        const origin = req.nextUrl.origin;

        return NextResponse.json({
          date: episodeKey,
          title: /^weekly-/i.test(episodeKey)
            ? `The Weekly — ${date.replace(/^weekly-/, '')}`
            : `Daily Brief — ${episodeKey}`,
          description: 'Locally generated audio (test)',
          audioUrl: `${origin}/audio/${localFilename}`,
          duration: estimatedDuration,
          fileSize: stats.size,
          generatedAt: stats.mtime.toISOString(),
        });
      }
    }

    return NextResponse.json(
      { error: 'No audio available for this date', date: episodeKey },
      { status: 404 }
    );
  } catch (err) {
    console.error(`[audio] Metadata fetch failed for ${episodeKey}:`, err);
    return NextResponse.json(
      { error: 'Failed to fetch audio metadata' },
      { status: 500 }
    );
  }
}
