#!/usr/bin/env node

/**
 * SIMPLER APPROACH: Write refreshed tokens to a file that can be committed
 * This avoids the complexity of updating GitHub Secrets via API
 */

const fs = require('fs');
const path = require('path');

// Read tokens from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('No token updates needed');
  process.exit(0);
}

const envContent = fs.readFileSync(envPath, 'utf8');

const accessTokenMatch = envContent.match(/TWITTER_OAUTH2_ACCESS_TOKEN=(.+)/);
const refreshTokenMatch = envContent.match(/TWITTER_OAUTH2_REFRESH_TOKEN=(.+)/);

if (accessTokenMatch && refreshTokenMatch) {
  // Write to a secure tokens file (gitignored)
  const tokensPath = path.join(process.cwd(), '.tokens.json');
  const tokens = {
    accessToken: accessTokenMatch[1],
    refreshToken: refreshTokenMatch[1],
    updatedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  console.log('✅ Tokens saved to .tokens.json');
  console.log('⚠️  You need to manually update GitHub Secrets with these values');
} else {
  console.log('No token updates found');
}

