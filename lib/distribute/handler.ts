/**
 * Shared distribute logic — email + X posting.
 * Called by /api/distribute, /api/publish/complete, and /api/distribute/retry.
 */

import { Redis } from '@upstash/redis';
import { getBriefLightByDate } from '@/lib/brief-light-parser';
import { renderBriefEmail } from '@/lib/email/render-brief';
import { sendEmail } from '@/lib/email/resend-client';
import { resolveXPostContent } from '@/lib/social/x-post-content';
import { hasXPostingCredentials, resolveXPostingClient } from '@/lib/social/x-oauth';

export interface ChannelResult {
  success: boolean;
  details: string;
  tweetId?: string;
}

export interface DistributeOptions {
  dateSlug: string;
  dryRun?: boolean;
  channel?: 'email' | 'x' | null;
}

export interface DistributeResults {
  email?: ChannelResult;
  x?: ChannelResult;
}

export async function distributeEmail(
  dateSlug: string,
  dryRun: boolean,
): Promise<ChannelResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, details: 'RESEND_API_KEY not set' };
  }

  const brief = getBriefLightByDate(dateSlug);
  if (!brief) {
    return { success: false, details: `No brief light found for ${dateSlug}` };
  }

  const rendered = renderBriefEmail(brief);
  console.log(`[distribute] Email subject: ${rendered.subject}`);

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const recipients = (await redis.smembers('subscribers:emails')) as string[];
  console.log(`[distribute] Subscribers: ${recipients.length}`);

  if (recipients.length === 0) {
    return { success: true, details: 'No subscribers' };
  }

  if (dryRun) {
    return { success: true, details: `Would send to ${recipients.length} subscriber(s)` };
  }

  let sent = 0;
  let failed = 0;

  for (const email of recipients) {
    const personalized = renderBriefEmail(brief, email);
    const result = await sendEmail({
      to: email,
      subject: personalized.subject,
      html: personalized.html,
      tags: [
        { name: 'type', value: 'daily-brief' },
        { name: 'date', value: brief.date },
      ],
    });
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    success: failed === 0,
    details: `Sent ${sent}/${recipients.length}${failed > 0 ? `, ${failed} failed` : ''}`,
  };
}

export async function distributeX(dateSlug: string, dryRun: boolean): Promise<ChannelResult> {
  if (!(await hasXPostingCredentials())) {
    return {
      success: false,
      details:
        'Twitter OAuth 2.0 not configured. Set TWITTER_CLIENT_ID + tokens (env or /api/x-auth).',
    };
  }

  const content = await resolveXPostContent(dateSlug);
  if (!content) {
    return {
      success: false,
      details: `No x-post content available for ${dateSlug} (Redis empty, no brief found for thread generator)`,
    };
  }

  const { posts, source } = content;
  console.log(
    `[distribute] Using ${source}: ${posts.length} posts (${posts.map((p) => p.length).join('/')} chars)`,
  );

  if (dryRun) {
    return {
      success: true,
      details: `[${source}] Would post ${posts.length} tweets:\n\n${posts.join('\n\n--- REPLY ---\n\n')}`,
    };
  }

  let client;
  try {
    const resolved = await resolveXPostingClient();
    client = resolved.client;
    console.log(
      `[distribute] Token source: ${resolved.tokenSource}${resolved.refreshed ? ' (refreshed)' : ''}`,
    );
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : String(authErr);
    return { success: false, details: `X auth failed: ${msg}` };
  }

  try {
    const firstResult = await client.v2.tweet(posts[0]!);
    const firstTweetId = firstResult.data.id;
    let lastTweetId = firstTweetId;
    console.log(`[distribute] Post 1/${posts.length} published: ${lastTweetId} [${source}]`);

    for (let i = 1; i < posts.length; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));
      const replyResult = await client.v2.reply(posts[i]!, lastTweetId);
      lastTweetId = replyResult.data.id;
      console.log(`[distribute] Post ${i + 1}/${posts.length} published: ${lastTweetId}`);
    }

    return {
      success: true,
      details: `[${source}] Published ${posts.length} posts: https://x.com/i/status/${firstTweetId}`,
      tweetId: firstTweetId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      details: `X posting failed: ${msg}`,
    };
  }
}

export async function runDistribute(options: DistributeOptions): Promise<DistributeResults> {
  const { dateSlug, dryRun = false, channel = null } = options;
  const results: DistributeResults = {};

  if (!channel || channel === 'email') {
    try {
      results.email = await distributeEmail(dateSlug, dryRun);
    } catch (err) {
      results.email = {
        success: false,
        details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    console.log(
      `[distribute] Email: ${results.email.success ? '✅' : '❌'} ${results.email.details}`,
    );
  }

  if (!channel || channel === 'x') {
    try {
      results.x = await distributeX(dateSlug, dryRun);
    } catch (err) {
      results.x = {
        success: false,
        details: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    console.log(`[distribute] X: ${results.x.success ? '✅' : '❌'} ${results.x.details}`);
  }

  return results;
}
