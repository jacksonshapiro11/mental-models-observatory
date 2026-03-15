/**
 * /api/audio/update-episode — Update episode metadata (title, description)
 *
 * POST with JSON body: { date, title?, description? }
 * Auth: SNAPSHOT_SECRET via query param or header
 *
 * Also supports GET with query params for quick browser fixes:
 *   ?date=2026-03-15&title=New Title&secret=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { readEpisodeMetadata, writeEpisodeMetadata } from '@/lib/audio/podcast-feed';

function isAuthorized(req: NextRequest): boolean {
  const snapshotSecret = process.env.SNAPSHOT_SECRET;
  if (!snapshotSecret) return false;
  const secret = req.headers.get('x-snapshot-secret') || req.nextUrl.searchParams.get('secret');
  return secret === snapshotSecret;
}

async function handleUpdate(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Support both JSON body (POST) and query params (GET)
  let date: string | null = null;
  let title: string | null = null;
  let description: string | null = null;

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      date = body.date;
      title = body.title;
      description = body.description;
    } catch {
      // Fall through to query params
    }
  }

  // Query params override or supplement body
  date = date || req.nextUrl.searchParams.get('date');
  title = title || req.nextUrl.searchParams.get('title');
  description = description || req.nextUrl.searchParams.get('description');

  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  const episode = await readEpisodeMetadata(date);
  if (!episode) {
    return NextResponse.json({ error: `No episode found for ${date}` }, { status: 404 });
  }

  const updates: string[] = [];
  if (title) {
    episode.title = title;
    updates.push(`title → "${title}"`);
  }
  if (description) {
    episode.description = description;
    updates.push(`description → "${description.slice(0, 50)}..."`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided (title or description)' }, { status: 400 });
  }

  await writeEpisodeMetadata(episode);

  return NextResponse.json({
    status: 'updated',
    date,
    updates,
    episode,
  });
}

export async function POST(req: NextRequest) {
  return handleUpdate(req);
}

export async function GET(req: NextRequest) {
  return handleUpdate(req);
}
