#!/usr/bin/env node

/**
 * OAuth 2.0 Manual Authorization Flow
 * Simpler approach - just generate the URL and handle the code manually
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const crypto = require('crypto');
const { TwitterApi } = require('twitter-api-v2');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function manualOAuth2Flow() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('❌ TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET not found in .env.local');
    process.exit(1);
  }

  console.log('🔐 OAuth 2.0 Manual Authorization Flow\n');
  
  const client = new TwitterApi({ 
    clientId,
    clientSecret 
  });
  
  // Use the callback URL you have set in Twitter
  const callbackURL = 'http://localhost:3000/callback';
  
  try {
    // Generate authorization URL
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackURL, {
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    });
    
    console.log('📋 Step 1: Open this URL in your browser:\n');
    console.log(url);
    console.log('\n📋 Step 2: Authorize the app');
    console.log('   (You\'ll be redirected to a page that might not load - that\'s OK!)');
    console.log('\n📋 Step 3: Copy the FULL URL from your browser address bar');
    console.log('   It will look like: http://localhost:3000/callback?state=...&code=...\n');
    
    const redirectUrl = await question('Paste the full redirect URL here: ');
    
    // Extract the code from the URL (decode URL-encoded characters)
    const urlParams = new URL(redirectUrl);
    const code = decodeURIComponent(urlParams.searchParams.get('code'));
    const returnedState = decodeURIComponent(urlParams.searchParams.get('state'));
    
    if (!code) {
      console.error('❌ No authorization code found in URL');
      process.exit(1);
    }
    
    if (state !== returnedState) {
      console.error('❌ State mismatch - possible security issue');
      process.exit(1);
    }
    
    console.log('\n✅ Code received! Exchanging for access token...\n');
    
    // Exchange code for tokens
    const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackURL,
    });
    
    // Test the token
    const me = await loggedClient.v2.me();
    
    console.log('✅ Authorization successful!');
    console.log(`   Authenticated as: @${me.data.username}\n`);
    
    // Save tokens to .env.local
    const fs = require('fs');
    let envContent = fs.readFileSync('.env.local', 'utf8');
    
    // Add or update OAuth 2.0 tokens
    if (envContent.includes('TWITTER_OAUTH2_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /TWITTER_OAUTH2_ACCESS_TOKEN=.*/,
        `TWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      envContent += `\n# OAuth 2.0 Access Token\nTWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}\n`;
    }
    
    if (envContent.includes('TWITTER_OAUTH2_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /TWITTER_OAUTH2_REFRESH_TOKEN=.*/,
        `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken || ''}`
      );
    } else {
      if (refreshToken) {
        envContent += `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken}\n`;
      }
    }
    
    fs.writeFileSync('.env.local', envContent);
    
    console.log('✅ Tokens saved to .env.local\n');
    console.log('🧪 Test posting with: npm run test:twitter:post\n');
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Authorization failed:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
    rl.close();
    process.exit(1);
  }
}

manualOAuth2Flow();

