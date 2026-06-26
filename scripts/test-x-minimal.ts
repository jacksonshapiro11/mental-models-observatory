#!/usr/bin/env node
/**
 * Minimal Twitter auth test — bypasses our client entirely.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import { TwitterApi } from 'twitter-api-v2';

async function main() {
  const appKey = process.env.TWITTER_API_KEY!;
  const appSecret = process.env.TWITTER_API_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;

  console.log('Credentials:');
  console.log(`  appKey length: ${appKey.length}`);
  console.log(`  appSecret length: ${appSecret.length}`);
  console.log(`  accessToken length: ${accessToken.length}`);
  console.log(`  accessSecret length: ${accessSecret.length}`);
  console.log(`  appKey starts: ${appKey.slice(0, 6)}`);
  console.log(`  accessToken starts: ${accessToken.slice(0, 10)}`);

  // Check for whitespace or newlines that would corrupt credentials
  if (appKey !== appKey.trim()) console.log('⚠️  appKey has whitespace!');
  if (appSecret !== appSecret.trim()) console.log('⚠️  appSecret has whitespace!');
  if (accessToken !== accessToken.trim()) console.log('⚠️  accessToken has whitespace!');
  if (accessSecret !== accessSecret.trim()) console.log('⚠️  accessSecret has whitespace!');

  console.log('\nCreating client...');

  const client = new TwitterApi({
    appKey: appKey.trim(),
    appSecret: appSecret.trim(),
    accessToken: accessToken.trim(),
    accessTokenSecret: accessSecret.trim(),
  });

  console.log('Client created. Testing v2.me()...');

  try {
    const me = await client.v2.me();
    console.log(`\n✅ Authenticated as @${me.data.username}`);
  } catch (err: any) {
    console.log(`\n❌ v2.me() failed: ${err.code} — ${err.message}`);
    if (err.data) console.log('   Detail:', JSON.stringify(err.data));

    // Try v1 verify as fallback diagnostic
    console.log('\nTrying v1.verifyCredentials()...');
    try {
      const v1me = await client.v1.verifyCredentials();
      console.log(`✅ v1 auth works! @${v1me.screen_name}`);
      console.log('   → The credentials ARE valid. The issue is v2 API access tier.');
      console.log('   → Check developer.x.com → your Project → what access level is shown?');
    } catch (v1err: any) {
      console.log(`❌ v1 also failed: ${v1err.code} — ${v1err.message}`);
      if (v1err.data) console.log('   Detail:', JSON.stringify(v1err.data));
      console.log('\n   → Credentials may be invalid or expired. Regenerate Access Token and Secret.');
    }
  }
}

main();
