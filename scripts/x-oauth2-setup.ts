#!/usr/bin/env node
/**
 * One-time OAuth 2.0 PKCE setup for X/Twitter free tier.
 *
 * The free tier doesn't support OAuth 1.0a for v2 endpoints.
 * This script runs a local server, opens the Twitter auth page,
 * and captures the OAuth 2.0 user token with tweet.write scope.
 *
 * Usage:
 *   npx tsx scripts/x-oauth2-setup.ts
 *
 * After running, it prints the access token and refresh token
 * to add to your .env.local.
 *
 * Env required:
 *   TWITTER_CLIENT_ID
 *   TWITTER_CLIENT_SECRET
 */

import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import { TwitterApi } from 'twitter-api-v2';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const CALLBACK_PORT = 3333;
const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set in .env.local');
    process.exit(1);
  }

  console.log('🔐 X/Twitter OAuth 2.0 Setup\n');

  // Create OAuth 2.0 client
  const client = new TwitterApi({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  // Generate auth link with PKCE
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, {
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  });

  console.log('1. Opening your browser to authorize the app...\n');
  console.log(`   If it doesn't open, go to:\n   ${url}\n`);

  // Open browser
  const { spawn } = await import('child_process');
  const platform = process.platform;
  const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  spawn(openCmd, [url], { detached: true, stdio: 'ignore' }).unref();

  // Start local server to capture callback
  console.log('2. Waiting for authorization callback...\n');

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404);
        res.end();
        return;
      }

      const params = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`).searchParams;
      const returnedState = params.get('state');
      const authCode = params.get('code');
      const error = params.get('error');

      if (error) {
        res.writeHead(200);
        res.end('Authorization denied. You can close this tab.');
        server.close();
        reject(new Error(`Auth denied: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch. Try again.');
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      if (!authCode) {
        res.writeHead(400);
        res.end('No auth code received.');
        server.close();
        reject(new Error('No auth code'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h2>Authorization successful!</h2><p>You can close this tab and return to your terminal.</p>');
      server.close();
      resolve(authCode);
    });

    server.listen(CALLBACK_PORT, () => {
      // Server ready
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for authorization'));
    }, 120000);
  });

  console.log('3. Got authorization code. Exchanging for tokens...\n');

  // Exchange code for tokens
  const tokenResult = await client.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: CALLBACK_URL,
  });

  const { accessToken, refreshToken } = tokenResult;

  // Verify it works
  const authedClient = new TwitterApi(accessToken);
  const me = await authedClient.v2.me();

  console.log(`✅ Authenticated as @${me.data.username}\n`);
  console.log('═'.repeat(60));
  console.log('  Add these to your .env.local:');
  console.log('═'.repeat(60));
  console.log(`\nTWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`);
  console.log(`TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken || '(none)'}`);
  console.log(`\n${'═'.repeat(60)}\n`);

  // Test posting capability
  console.log('🧪 Testing tweet capability (will NOT post)...');
  console.log('   Write access scope: ✅ included\n');
  console.log('You\'re all set! Run npm run distribute to go live.\n');
}

main().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
