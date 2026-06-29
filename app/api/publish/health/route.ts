/**
 * GET /api/publish/health — Check if today's briefs are on the deployed site.
 *
 * Returns { date, fullBrief, lightBrief, ready }.
 * No auth required (read-only filesystem check).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDeployedBriefHealth } from '@/lib/publish/brief-health';
import { todayET } from '@/lib/publish-date';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')?.trim() || todayET();
  const health = checkDeployedBriefHealth(date);
  return NextResponse.json(health, { status: health.ready ? 200 : 503 });
}
