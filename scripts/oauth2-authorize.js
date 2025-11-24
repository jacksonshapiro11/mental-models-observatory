#!/usr/bin/env node

/**
 * OAuth 2.0 with PKCE Authorization Flow for Twitter
 * Step 1: Get authorization URL and start the flow
 */

require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const crypto = require('crypto');
const http = require('http');
const { TwitterApi } = require('twitter-api-v2');

// Generate PKCE code verifier and challenge
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

async function startOAuth2Flow() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  
  if (!clientId) {
    console.error('❌ TWITTER_CLIENT_ID not found in .env.local');
    console.error('\n📋 To get your Client ID:');
    console.error('   1. Go to: https://developer.twitter.com/en/portal/dashboard');
    console.error('   2. Select your app → Settings → User authentication settings');
    console.error('   3. Copy the "Client ID" and add to .env.local:');
    console.error('      TWITTER_CLIENT_ID=your_client_id_here');
    process.exit(1);
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  
  // Save code verifier for later use
  require('fs').writeFileSync('.oauth2-temp.json', JSON.stringify({ codeVerifier }));
  
  const client = new TwitterApi({ clientId });
  
  const callbackURL = 'http://localhost:3001/callback';
  
  // Generate authorization URL
  const { url, codeVerifier: cv, state } = client.generateOAuth2AuthLink(callbackURL, {
    scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  });
  
  // Save code verifier
  require('fs').writeFileSync('.oauth2-temp.json', JSON.stringify({ codeVerifier: cv, state }));
  
  console.log('🔐 OAuth 2.0 Authorization Flow Started\n');
  console.log('📋 Step 1: Authorize the app');
  console.log('   Open this URL in your browser:\n');
  console.log(`   ${url}\n`);
  console.log('📋 Step 2: After authorizing, you\'ll be redirected to localhost');
  console.log('   Copy the FULL redirect URL from your browser\n');
  console.log('🚀 Starting callback server on http://localhost:3001...\n');
  
  // Start a simple server to catch the callback
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/callback')) {
      const url = new URL(req.url, 'http://localhost:3001');
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      
      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        return;
      }
      
      try {
        // Load saved data
        const { codeVerifier, state } = JSON.parse(
          require('fs').readFileSync('.oauth2-temp.json', 'utf8')
        );
        
        // Verify state
        if (state !== returnedState) {
          throw new Error('State mismatch - possible CSRF attack');
        }
        
        // Exchange code for tokens
        const client = new TwitterApi({ clientId });
        const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
          code,
          codeVerifier,
          redirectUri: callbackURL,
        });
        
        // Test the token
        const me = await loggedClient.v2.me();
        
        // Save tokens to .env.local
        const envContent = require('fs').readFileSync('.env.local', 'utf8');
        let newContent = envContent;
        
        // Add or update OAuth 2.0 tokens
        if (newContent.includes('TWITTER_OAUTH2_ACCESS_TOKEN=')) {
          newContent = newContent.replace(
            /TWITTER_OAUTH2_ACCESS_TOKEN=.*/,
            `TWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}`
          );
        } else {
          newContent += `\n# OAuth 2.0 Tokens\nTWITTER_OAUTH2_ACCESS_TOKEN=${accessToken}\n`;
        }
        
        if (newContent.includes('TWITTER_OAUTH2_REFRESH_TOKEN=')) {
          newContent = newContent.replace(
            /TWITTER_OAUTH2_REFRESH_TOKEN=.*/,
            `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken || ''}`
          );
        } else {
          newContent += `TWITTER_OAUTH2_REFRESH_TOKEN=${refreshToken || ''}\n`;
        }
        
        require('fs').writeFileSync('.env.local', newContent);
        
        // Clean up temp file
        require('fs').unlinkSync('.oauth2-temp.json');
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>✅ Authorization Successful!</h1>
              <p>Authenticated as: <strong>@${me.data.username}</strong></p>
              <p>You can close this window and return to your terminal.</p>
            </body>
          </html>
        `);
        
        console.log('\n✅ Authorization successful!');
        console.log(`   Authenticated as: @${me.data.username}`);
        console.log('   Tokens saved to .env.local\n');
        console.log('🧪 Test posting with: npm run test:twitter:post\n');
        
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
        
      } catch (error) {
        console.error('❌ Authorization failed:', error.message);
        res.writeHead(500);
        res.end('Authorization failed: ' + error.message);
        server.close();
        process.exit(1);
      }
    }
  });
  
  server.listen(3001, () => {
    console.log('✅ Server ready. Please authorize in your browser...\n');
  });
}

startOAuth2Flow();

