/**
 * /api/podcast/feed — Public RSS podcast feed
 *
 * Returns RSS 2.0 XML with iTunes namespace extensions.
 * Subscribe to this URL in any podcast app (Overcast, Apple Podcasts, etc.)
 *
 * No authentication required — this is a public feed.
 * CDN caches 1 hour (podcast apps poll often; manifest stays fresh on publish).
 */

import { NextResponse } from 'next/server';
import { generatePodcastFeed } from '@/lib/audio/podcast-feed';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const feedXml = await generatePodcastFeed();

    return new NextResponse(feedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('[podcast] Feed generation failed:', err);
    return NextResponse.json(
      { error: 'Feed generation failed' },
      { status: 500 }
    );
  }
}
