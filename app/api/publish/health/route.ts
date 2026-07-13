/**
 * GET /api/publish/health — Check if briefs are on the deployed site.
 *
 * Query:
 *   ?date=YYYY-MM-DD   — daily (default: today ET)
 *   ?weekly=YYYY-Www   — weekly full + light (takes precedence)
 *
 * Returns { date, fullBrief, lightBrief, ready [, weekly] }.
 * No auth required (read-only filesystem check).
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDeployedBriefHealth, checkDeployedWeeklyHealth } from '@/lib/publish/brief-health';
import { todayET } from '@/lib/publish-date';

export async function GET(req: NextRequest) {
  const weekly = req.nextUrl.searchParams.get('weekly')?.trim() || null;
  if (weekly) {
    const health = checkDeployedWeeklyHealth(weekly);
    return NextResponse.json(health, { status: health.ready ? 200 : 503 });
  }

  const date = req.nextUrl.searchParams.get('date')?.trim() || todayET();
  const health = checkDeployedBriefHealth(date);
  return NextResponse.json(health, { status: health.ready ? 200 : 503 });
}
