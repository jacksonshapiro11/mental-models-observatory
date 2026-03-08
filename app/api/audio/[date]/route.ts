/**
 * /api/audio/[date] — Audio metadata endpoint
 *
 * GET /api/audio/2026-03-02 → returns episode metadata (audioUrl, duration, etc.)
 * Used by the website audio player to find the MP3 URL for a given brief date.
 *
 * In production: reads from Redis (populated by /api/audio/generate).
 * In development: falls back to checking public/audio/ for local test files.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { readEpisodeMetadata } from '@/lib/audio/podcast-feed';

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
      const episode = await readEpisodeMetadata(date);
      if (episode) {
        return NextResponse.json(episode, {
          headers: {
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=172800',
          },
        });
      }
    } catch (redisErr) {
      // Redis unavailable (common in local dev) — fall through to local file check
      console.warn(`[audio] Redis lookup failed for ${date}, checking local files:`, redisErr);
    }

    // Dev fallback: check for local MP3 in public/audio/
    const localFilename = `daily-brief-${date}.mp3`;
    const localPath = path.join(process.cwd(), 'public', 'audio', localFilename);

    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      const estimatedDuration = Math.round(stats.size / (128000 / 8));
      const origin = req.nextUrl.origin;

      return NextResponse.json({
        date,
        title: `Daily Brief — ${date}`,
        description: 'Locally generated audio (test)',
        audioUrl: `${origin}/audio/${localFilename}`,
        duration: estimatedDuration,
        fileSize: stats.size,
        generatedAt: stats.mtime.toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'No audio available for this date', date },
      { status: 404 }
    );
  } catch (err) {
    console.error(`[audio] Metadata fetch failed for ${date}:`, err);
    return NextResponse.json(
      { error: 'Failed to fetch audio metadata' },
      { status: 500 }
    );
  }
}
