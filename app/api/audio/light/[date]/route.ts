/**
 * /api/audio/light/[date] — Brief Light audio metadata endpoint
 *
 * GET /api/audio/light/2026-04-06 → returns Brief Light episode metadata
 * Used by the AudioPlayer component when in "Super Brief" mode.
 *
 * In production: reads from Redis (populated by /api/audio/generate?variant=light).
 * In development: falls back to checking public/audio/ for local test files.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { readLightEpisodeMetadata } from '@/lib/audio/podcast-feed';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  try {
    // Try Redis first (production path)
    try {
      const episode = await readLightEpisodeMetadata(date);
      if (episode) {
        return NextResponse.json(episode, {
          headers: {
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800',
          },
        });
      }
    } catch (redisErr) {
      console.warn(`[audio:light] Redis lookup failed for ${date}, checking local files:`, redisErr);
    }

    // Dev fallback: check for local MP3 in public/audio/
    const localFilename = `brief-light-${date}.mp3`;
    const localPath = path.join(process.cwd(), 'public', 'audio', localFilename);

    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      const estimatedDuration = Math.round(stats.size / (128000 / 8));
      const origin = req.nextUrl.origin;

      return NextResponse.json({
        date,
        title: `Super Brief — ${date}`,
        description: 'Brief Light audio (test)',
        audioUrl: `${origin}/audio/${localFilename}`,
        duration: estimatedDuration,
        fileSize: stats.size,
        generatedAt: stats.mtime.toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'No Brief Light audio available for this date', date },
      { status: 404 }
    );
  } catch (err) {
    console.error(`[audio:light] Metadata fetch failed for ${date}:`, err);
    return NextResponse.json(
      { error: 'Failed to fetch Brief Light audio metadata' },
      { status: 500 }
    );
  }
}
