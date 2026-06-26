#!/usr/bin/env node
/**
 * Send the daily Brief Light email to all subscribers via Resend.
 *
 * Replaces publish-to-beehiiv.ts. Uses Redis subscriber list + Resend for delivery.
 *
 * Usage:
 *   npx tsx scripts/send-daily-email.ts                    # today's brief
 *   npx tsx scripts/send-daily-email.ts --date=2026-04-24  # specific date
 *   npx tsx scripts/send-daily-email.ts --dry-run          # render + count, no send
 *   npx tsx scripts/send-daily-email.ts --test=you@example.com  # send to one address only
 *
 * Env:
 *   RESEND_API_KEY, EMAIL_FROM_ADDRESS (optional),
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();
import { getBriefLightByDate } from '../lib/brief-light-parser';
import { resolvePublishDate } from '../lib/publish-date';
import { renderBriefEmail } from '../lib/email/render-brief';
import { sendEmail, sendBatch } from '../lib/email/resend-client';
import { Redis } from '@upstash/redis';

// ─── Args ──────────────────────────────────────────────────────────────────

interface Args {
  date?: string;
  dryRun: boolean;
  testEmail?: string;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--date=')) args.date = arg.slice('--date='.length);
    else if (arg.startsWith('--test=')) args.testEmail = arg.slice('--test='.length);
  }
  return args;
}

// ─── Subscriber fetching ───────────────────────────────────────────────────

async function getSubscribers(): Promise<string[]> {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const emails = await redis.smembers('subscribers:emails');
  return emails as string[];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // 1. Load brief. Auto path targets TODAY and skips if missing — never falls
  //    back to an older brief. An explicit --date= is a deliberate backfill.
  const { date: targetDate, manual } = resolvePublishDate(args.date);
  const brief = getBriefLightByDate(targetDate);
  if (!brief) {
    if (manual) {
      console.error(`❌ No brief light found for ${targetDate}`);
      process.exit(1);
    }
    console.log(`⏭️  No brief for ${targetDate} (today) — skipping send. Not falling back to an older brief.`);
    process.exit(0);
  }

  console.log(`📰 Brief: ${brief.date} — "${brief.dailyTitle}"`);
  console.log(`   Sections: ${brief.sections.map((s) => s.label).join(', ')}`);

  // 2. Render email HTML
  const rendered = renderBriefEmail(brief);
  console.log(`\n📧 Subject:      ${rendered.subject}`);
  console.log(`📧 Preview:      ${rendered.previewText}`);
  console.log(`📧 HTML size:    ${(rendered.html.length / 1024).toFixed(1)} KB`);

  // 3. Get recipients
  let recipients: string[];

  if (args.testEmail) {
    recipients = [args.testEmail];
    console.log(`\n🧪 Test mode: sending to ${args.testEmail} only`);
  } else {
    recipients = await getSubscribers();
    console.log(`\n👥 Subscribers: ${recipients.length}`);
  }

  if (recipients.length === 0) {
    console.log('⚠️  No subscribers found. Nothing to send.');
    return;
  }

  // 4. Send
  if (args.dryRun) {
    console.log('\n🏃 Dry run — not sending.');
    console.log(`   Would send to ${recipients.length} recipient(s)`);
    return;
  }

  if (args.testEmail) {
    // Single test send
    const result = await sendEmail({
      to: args.testEmail,
      subject: rendered.subject,
      html: rendered.html,
      tags: [
        { name: 'type', value: 'daily-brief' },
        { name: 'date', value: brief.date },
      ],
    });

    if (result.success) {
      console.log(`\n✅ Test email sent (id: ${result.id})`);
    } else {
      console.error(`\n❌ Send failed: ${result.error}`);
      process.exit(1);
    }
  } else {
    // Batch send to all subscribers
    console.log(`\n🚀 Sending to ${recipients.length} subscribers...`);
    const result = await sendBatch(recipients, rendered.subject, rendered.html, {
      tags: [
        { name: 'type', value: 'daily-brief' },
        { name: 'date', value: brief.date },
      ],
    });

    console.log(`\n✅ Sent: ${result.sent}/${result.total}`);
    if (result.failed.length > 0) {
      console.log(`❌ Failed: ${result.failed.length}`);
      result.failed.forEach((f) => console.log(`   ${f.email}: ${f.error}`));
    }
  }
}

main().catch((err) => {
  console.error('❌ Email send failed:', err);
  process.exit(1);
});
