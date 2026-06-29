/**
 * POST /api/publish/backup — Content publish failsafe (cron)
 *
 * Checks deployed brief health; if missing, cross-checks GitHub API when
 * GITHUB_TOKEN is available. Cannot auto-push from Vercel — returns
 * actionable status for monitoring / brief-morning-verify task.
 *
 * Schedule: ~5:50 AM ET (50 9 * * * UTC during EDT).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { evaluatePublishBackup } from '@/lib/publish/brief-health';
import { todayET } from '@/lib/publish-date';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date')?.trim() || todayET();
  const status = await evaluatePublishBackup(date);

  if (!status.ready) {
    console.error(`[publish/backup] CONTENT BACKUP ALERT for ${date}:`, {
      issues: status.issues,
      deployed: { fullBrief: status.fullBrief, lightBrief: status.lightBrief },
      github: status.github,
    });
  } else {
    console.log(`[publish/backup] Content healthy for ${date}`);
  }

  return NextResponse.json(
    {
      ...status,
      healthy: status.ready,
      alert: !status.ready,
    },
    { status: status.ready ? 200 : 503 },
  );
}

export async function GET(req: NextRequest) {
  return POST(req);
}
