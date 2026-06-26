#!/usr/bin/env node
/**
 * Export Redis subscribers to a beehiiv-compatible CSV.
 *
 * For the free tier (no API post creation), you can still bulk-import
 * subscribers via the beehiiv web UI: Subscribers → Import → Upload CSV.
 *
 * Usage:
 *   npx tsx scripts/export-subscribers-csv.ts
 *   # → writes subscribers-export-{date}.csv in project root
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const REDIS_KEY_SUBSCRIBERS = 'subscribers:emails';
const REDIS_KEY_SUB_META = 'subscribers:meta:';

async function main() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const emails = await redis.smembers(REDIS_KEY_SUBSCRIBERS);
  console.log(`📋 Found ${emails.length} subscriber(s) in Redis`);

  if (emails.length === 0) {
    console.log('Nothing to export.');
    return;
  }

  // beehiiv accepts: email, first_name, last_name, utm_source, utm_medium, utm_campaign,
  //   referring_site, custom_field:{name}. At minimum, `email` is required.
  const rows: string[] = ['email,utm_source,utm_medium,subscribed_at'];

  for (const email of emails) {
    const meta = await redis.hgetall<Record<string, string>>(REDIS_KEY_SUB_META + email);
    const source = (meta?.source ?? 'legacy').replace(/[",\n]/g, '');
    const subscribedAt = meta?.subscribedAt ?? '';
    rows.push(`${csvEscape(email)},${csvEscape(source)},api_import,${csvEscape(subscribedAt)}`);
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const outPath = path.join(process.cwd(), `subscribers-export-${dateSlug}.csv`);
  fs.writeFileSync(outPath, rows.join('\n') + '\n');

  console.log(`\n✅ Exported ${emails.length} subscriber(s) to:`);
  console.log(`   ${outPath}`);
  console.log('\n  NEXT STEPS:');
  console.log('    1. beehiiv → Subscribers → Import');
  console.log('    2. Upload the CSV');
  console.log('    3. Map columns: email → Email, utm_source → UTM Source');
  console.log('    4. Set "Send welcome email" = OFF (these are existing subs)');
  console.log('    5. Confirm import');
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

main().catch((err) => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
