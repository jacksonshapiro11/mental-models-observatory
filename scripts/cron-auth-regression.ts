/**
 * Mechanical check: cron auth accepts Vercel cron markers + Bearer secrets.
 * Run: npx tsx scripts/cron-auth-regression.ts
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getCronAuthPath, isCronAuthorized } from '../lib/cron-auth';

process.env.CRON_SECRET = 'test-cron-secret';
process.env.SNAPSHOT_SECRET = 'test-snapshot-secret';

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

function main() {
  // Unauthorized
  assert.equal(getCronAuthPath(req('https://example.com/api/publish/complete')), null);
  assert.equal(isCronAuthorized(req('https://example.com/api/publish/complete')), false);

  // Vercel cron markers
  assert.equal(
    getCronAuthPath(req('https://example.com/x', { 'x-vercel-cron': '1' })),
    'x-vercel-cron',
  );
  assert.equal(
    getCronAuthPath(req('https://example.com/x', { 'x-vercel-cron-schedule': '55 9 * * *' })),
    'x-vercel-cron-schedule',
  );
  assert.equal(
    getCronAuthPath(req('https://example.com/x', { 'user-agent': 'vercel-cron/1.0' })),
    'user-agent-vercel-cron',
  );

  // Bearer + query secret
  assert.equal(
    getCronAuthPath(
      req('https://example.com/x', { authorization: 'Bearer test-cron-secret' }),
    ),
    'bearer-cron',
  );
  assert.equal(
    getCronAuthPath(
      req('https://example.com/x', { authorization: 'Bearer test-snapshot-secret' }),
    ),
    'bearer-snapshot',
  );
  assert.equal(
    getCronAuthPath(req('https://example.com/x?secret=test-snapshot-secret')),
    'snapshot-secret',
  );

  // Wrong secret
  assert.equal(
    getCronAuthPath(req('https://example.com/x', { authorization: 'Bearer wrong' })),
    null,
  );

  console.log('cron-auth-regression: PASS');
}

main();
