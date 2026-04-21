/**
 * /feed.xml — Public RSS feed for daily briefs
 *
 * Standard RSS 2.0 feed for the daily brief articles.
 * This is separate from the podcast feed at /api/podcast/feed.
 *
 * Use this URL in RSS-to-social tools (Hypefury, Typefully, FlowPost)
 * to auto-post when a new brief publishes.
 */

import { NextResponse } from 'next/server';
import { getAllBriefDates, getBriefByDate } from '@/lib/daily-update-parser';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cosmictrex.com';

export const dynamic = 'force-dynamic';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  try {
    const dates = getAllBriefDates();
    // Include the 30 most recent briefs in the feed
    const recentDates = dates.slice(0, 30);

    const items = recentDates
      .map((date) => {
        const brief = getBriefByDate(date);
        if (!brief) return null;

        const title = brief.dailyTitle || `Daily Brief — ${date}`;
        const description = brief.lede
          ? brief.lede.replace(/\*\*/g, '').substring(0, 300)
          : `Cosmic Trex daily market intelligence brief for ${brief.displayDate || date}.`;
        const link = `${SITE_URL}/daily-update/${date}`;
        const pubDate = new Date(date).toUTCString();

        return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>cosmictrex11@gmail.com (Cosmic Trex)</author>
    </item>`;
      })
      .filter(Boolean)
      .join('\n');

    const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Cosmic Trex — Daily Brief</title>
    <link>${SITE_URL}</link>
    <description>Daily financial intelligence brief. Markets, geopolitics, AI, crypto, and macro — filtered through mental models.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/podcast-cover.jpg</url>
      <title>Cosmic Trex</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

    return new NextResponse(feedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err) {
    console.error('[feed.xml] Feed generation failed:', err);
    return NextResponse.json(
      { error: 'Feed generation failed' },
      { status: 500 }
    );
  }
}
