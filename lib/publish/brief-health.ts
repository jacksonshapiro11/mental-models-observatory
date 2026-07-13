/**
 * Brief publish health — deployed site + optional GitHub API verification.
 */

import { getBriefByDate, getWeeklyBySlug } from '@/lib/daily-update-parser';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { getWeeklyLightBySlug } from '@/lib/weekly-light-parser';
import { todayET } from '@/lib/publish-date';

const GITHUB_REPO = 'jacksonshapiro11/mental-models-observatory';
const GITHUB_BRANCH = 'main';

export interface BriefHealth {
  date: string;
  fullBrief: boolean;
  lightBrief: boolean;
  ready: boolean;
  /** Present when health was checked for a weekly slug (?weekly=YYYY-Www). */
  weekly?: string;
}

export interface GitHubBriefStatus {
  fullBrief: boolean | null;
  lightBrief: boolean | null;
  tokenAvailable: boolean;
}

export function checkDeployedBriefHealth(date: string = todayET()): BriefHealth {
  const fullBrief = !!getBriefByDate(date);
  const lightBrief = !!getBriefLightByDate(date);
  return {
    date,
    fullBrief,
    lightBrief,
    ready: fullBrief && lightBrief,
  };
}

/** Deployed-FS health for a Weekly slug (full + light). ready = light present (audio gate). */
export function checkDeployedWeeklyHealth(weeklySlug: string): BriefHealth {
  const fullBrief = !!getWeeklyBySlug(weeklySlug);
  const lightBrief = !!getWeeklyLightBySlug(weeklySlug);
  return {
    date: weeklySlug,
    weekly: weeklySlug,
    fullBrief,
    lightBrief,
    ready: lightBrief,
  };
}

async function githubFileExists(path: string, token: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'mmo-publish-health',
    },
    signal: AbortSignal.timeout(10_000),
  });
  return resp.ok;
}

export async function checkGitHubBriefHealth(date: string): Promise<GitHubBriefStatus> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { fullBrief: null, lightBrief: null, tokenAvailable: false };
  }

  const [fullBrief, lightBrief] = await Promise.all([
    githubFileExists(`content/daily-updates/${date}.md`, token),
    githubFileExists(`content/daily-updates/${date}-light.md`, token),
  ]);

  return { fullBrief, lightBrief, tokenAvailable: true };
}

export interface BackupStatus extends BriefHealth {
  github?: GitHubBriefStatus;
  issues: string[];
  recommendations: string[];
}

export async function evaluatePublishBackup(date: string = todayET()): Promise<BackupStatus> {
  const deployed = checkDeployedBriefHealth(date);
  const github = await checkGitHubBriefHealth(date);
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!deployed.fullBrief) {
    issues.push(`Full brief missing on deployed site for ${date}`);
  }
  if (!deployed.lightBrief) {
    issues.push(`Super brief missing on deployed site for ${date}`);
  }

  if (github.tokenAvailable) {
    if (github.fullBrief && !deployed.fullBrief) {
      issues.push('Full brief exists on GitHub main but not yet deployed — possible Vercel deploy lag');
      recommendations.push('Wait a few minutes for Vercel deploy, or check Vercel dashboard');
    } else if (github.fullBrief === false) {
      issues.push('Full brief missing on GitHub main');
      recommendations.push(
        'Re-run publish.py locally or trigger brief-morning-verify scheduled task: publish.py --verify',
      );
    }

    if (github.lightBrief && !deployed.lightBrief) {
      issues.push('Super brief exists on GitHub main but not yet deployed — possible Vercel deploy lag');
    } else if (github.lightBrief === false) {
      issues.push('Super brief missing on GitHub main');
      recommendations.push(
        'Re-run publish.py locally or trigger brief-morning-verify: publish.py --verify --content-dir content/daily-updates',
      );
    }
  } else if (!deployed.ready) {
    recommendations.push(
      'Set GITHUB_TOKEN on Vercel for remote verification, or run publish.py --verify locally',
    );
    recommendations.push(
      'Cannot auto-push from Vercel — brief files must be published via publish.py from a machine with local copies',
    );
  }

  if (issues.length === 0) {
    recommendations.push('Content publish healthy — pipeline can proceed');
  }

  return {
    ...deployed,
    github,
    issues,
    recommendations,
  };
}
