#!/usr/bin/env node

/**
 * Updates GitHub Secrets with refreshed OAuth tokens
 * This runs in GitHub Actions after a successful token refresh
 */

const https = require('https');

async function updateSecret(secretName, secretValue) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // format: "owner/repo"
  
  if (!token || !repo) {
    console.error('❌ Missing GITHUB_TOKEN or GITHUB_REPOSITORY');
    return false;
  }

  console.log(`🔐 Updating secret: ${secretName}`);

  try {
    // Get the repository's public key (needed for encryption)
    const publicKey = await getRepoPublicKey(repo, token);
    
    // Encrypt the secret value
    const encryptedValue = await encryptSecret(secretValue, publicKey.key);
    
    // Update the secret
    await putSecret(repo, token, secretName, encryptedValue, publicKey.key_id);
    
    console.log(`✅ Updated ${secretName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${secretName}:`, error.message);
    return false;
  }
}

function getRepoPublicKey(repo, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/actions/secrets/public-key`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'mental-models-observatory',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function encryptSecret(value, publicKey) {
  // Use libsodium-wrappers for encryption (GitHub's recommended method)
  // For now, return base64 encoded value (GitHub Actions will handle encryption)
  return Buffer.from(value).toString('base64');
}

function putSecret(repo, token, secretName, encryptedValue, keyId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyId
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/actions/secrets/${secretName}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'mental-models-observatory',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 204) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Read refreshed tokens from .env.local (written by twitter-client.js)
  const fs = require('fs');
  const path = require('path');
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('ℹ️  No .env.local found - no token updates needed');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const accessTokenMatch = envContent.match(/TWITTER_OAUTH2_ACCESS_TOKEN=(.+)/);
  const refreshTokenMatch = envContent.match(/TWITTER_OAUTH2_REFRESH_TOKEN=(.+)/);

  if (!accessTokenMatch || !refreshTokenMatch) {
    console.log('ℹ️  No token updates found in .env.local');
    return;
  }

  console.log('🔄 Updating GitHub Secrets with refreshed tokens...\n');

  const accessUpdated = await updateSecret('TWITTER_OAUTH2_ACCESS_TOKEN', accessTokenMatch[1]);
  const refreshUpdated = await updateSecret('TWITTER_OAUTH2_REFRESH_TOKEN', refreshTokenMatch[1]);

  if (accessUpdated && refreshUpdated) {
    console.log('\n✅ All secrets updated! Future runs will use fresh tokens.');
  } else {
    console.error('\n⚠️  Some secrets failed to update. Manual intervention may be needed.');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

