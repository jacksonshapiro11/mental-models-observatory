#!/usr/bin/env node

/**
 * OAuth 2.0 Step 2: Complete authorization with code
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { TwitterApi } = require('twitter-api-v2');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function completeAuth() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  
  if (!clientId) {
    console.error('❌ TWITTER_CLIENT_ID not found');
    process.exit(1);
  }

  // Load saved auth data
  if (!fs.existsSync('.oauth2-data.json')) {
    console.error('❌ No authorization data found');
    console.error('   Run: npm run twitter:auth-prod first');
    process.exit(1);
  }

  const authData = JSON.parse(fs.readFileSync('.oauth2-data.json', 'utf8'));
  
  console.log('🔐 Complete Twitter Authorization\n');
  console.log('Paste the values from the callback page:\n');
  
  const code = await question('Authorization Code: ');
  const state = await question('State: ');
  
  if (!code || !state) {
    console.error('❌ Code and state are required');
    rl.close();
    process.exit(1);
  }
  
  // Verify state matches
  if (state !== authData.state) {
    console.error('❌ State mismatch - possible security issue');
    rl.close();
    process.exit(1);
  }
  
  console.log('\n✅ Exchanging code for access token...\n');
  
  try {
    const client = new TwitterApi({ clientId });
    
    const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
      code: code.trim(),
      codeVerifier: authData.codeVerifier,
      redirectUri: authData.callbackURL,
    });
    
    // Test the token
    const me = await loggedClient.v2.me();
    
    console.log('✅ Authorization successful!');
    console.log(`   Authenticated as: @${me.data.username}\n`);
    
    // Save tokens to .env.local
    let envContent = fs.readFileSync('.env.local', 'utf8');
    
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
    
    // Clean up
    fs.unlinkSync('.oauth2-data.json');
    
    console.log('✅ Tokens saved to .env.local\n');
    console.log('🧪 Test posting with: npm run test:twitter:post\n');
    
    rl.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Token exchange failed:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
    rl.close();
    process.exit(1);
  }
}

completeAuth();

