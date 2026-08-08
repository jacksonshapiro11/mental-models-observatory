#!/usr/bin/env node

/**
 * OAuth 2.0 with Production URL
 * Step 1: Generate authorization URL
 */

require('dotenv').config({
  path: require('path').join(process.cwd(), '.env.local'),
});
const crypto = require('crypto');
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

async function generateAuthURL() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cosmictrex.xyz';

  if (!clientId) {
    console.error('❌ TWITTER_CLIENT_ID not found in .env.local');
    process.exit(1);
  }

  console.log('🔐 OAuth 2.0 Production Authorization\n');

  const client = new TwitterApi({ clientId });
  const callbackURL = `${siteUrl}/api/auth/twitter/callback`;

  try {
    // Generate authorization URL
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      callbackURL,
      {
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      }
    );

    // Save code verifier and state for later
    const authData = {
      codeVerifier,
      state,
      callbackURL,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync('.oauth2-data.json', JSON.stringify(authData, null, 2));

    console.log('✅ Authorization URL generated!\n');
    console.log('📋 Step 1: Update Twitter Developer Portal');
    console.log(`   Go to: https://developer.twitter.com/en/portal/dashboard`);
    console.log(`   → Your App → Settings → User authentication settings`);
    console.log(`   → Set Callback URL to: ${callbackURL}`);
    console.log(`   → Save\n`);
    console.log('📋 Step 2: Open this URL in your browser:\n');
    console.log(url);
    console.log('\n📋 Step 3: After authorizing:');
    console.log("   → You'll be redirected to your site");
    console.log('   → Copy the authorization code and state displayed');
    console.log('   → Run: npm run twitter:complete-auth');
    console.log('   → Paste the code and state\n');
  } catch (error) {
    console.error('❌ Failed to generate auth URL:', error.message);
    process.exit(1);
  }
}

generateAuthURL();
