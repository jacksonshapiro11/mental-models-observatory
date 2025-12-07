#!/usr/bin/env node

/**
 * Quick Twitter OAuth - Just paste the callback URL
 */

const readline = require('readline');
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function quickAuth() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET in .env.local');
    process.exit(1);
  }

  const client = new TwitterApi({ clientId });
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink('http://localhost:3000/callback', {
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
  });

  console.log('🔐 Twitter OAuth 2.0\n');
  console.log('1️⃣  Open this URL:\n');
  console.log(url);
  console.log('\n2️⃣  After authorizing, paste the redirect URL below:\n');

  rl.question('Redirect URL: ', async (redirectUrl) => {
    try {
      const urlObj = new URL(redirectUrl);
      const code = urlObj.searchParams.get('code');
      const returnedState = urlObj.searchParams.get('state');

      if (!code) {
        console.error('❌ No code in URL');
        rl.close();
        process.exit(1);
      }

      if (returnedState !== state) {
        console.error('❌ State mismatch');
        rl.close();
        process.exit(1);
      }

      console.log('\n⏳ Exchanging code for token...\n');

      const authClient = new TwitterApi({
        clientId,
        clientSecret
      });

      const { accessToken, refreshToken, expiresIn } = await authClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: 'http://localhost:3000/callback'
      });

      // Get user info
      const userClient = new TwitterApi(accessToken);
      const me = await userClient.v2.me();

      console.log(`✅ Authorized as: @${me.data.username}`);

      // Save to .env.local
      let envContent = fs.readFileSync('.env.local', 'utf8');
      
      if (envContent.includes('TWITTER_OAUTH2_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/TWITTER_OAUTH2_ACCESS_TOKEN=.*/, `TWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`);
      } else {
        envContent += `\nTWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}\n`;
      }
      
      if (refreshToken) {
        if (envContent.includes('TWITTER_OAUTH2_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/TWITTER_OAUTH2_REFRESH_TOKEN=.*/, `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken}\n`;
        }
      }

      fs.writeFileSync('.env.local', envContent);

      console.log('✅ Tokens saved to .env.local\n');
      console.log('🧪 Test with: npm run test:twitter:post\n');

      rl.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      rl.close();
      process.exit(1);
    }
  });
}

quickAuth();

