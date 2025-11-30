#!/usr/bin/env node

/**
 * Updates GitHub Secrets with refreshed OAuth tokens
 * This runs in GitHub Actions after a successful token refresh
 * Uses GitHub CLI (gh) which is simpler and pre-installed in Actions runners
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function updateSecret(secretName, secretValue) {
  // Use GitHub CLI (gh) which is pre-installed in GitHub Actions
  // This requires GITHUB_TOKEN to be set (automatically available in Actions)
  try {
    console.log(`🔐 Updating secret: ${secretName}`);
    
    // Use gh secret set command (simplest approach)
    // Note: GITHUB_TOKEN must have write access to secrets
    // If it doesn't work, we'll need a PAT stored as GITHUB_PAT secret
    const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    
    if (!token) {
      console.error('❌ Missing GITHUB_TOKEN or GITHUB_PAT');
      return false;
    }
    
    // Use gh secret set with stdin to avoid exposing secret in command line
    // Set GH_TOKEN for authentication
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const gh = spawn('gh', ['secret', 'set', secretName], {
        env: { ...process.env, GH_TOKEN: token },
        stdio: ['pipe', 'inherit', 'inherit']
      });
      
      gh.stdin.write(secretValue);
      gh.stdin.end();
      
      gh.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`gh secret set exited with code ${code}`));
        }
      });
      
      gh.on('error', reject);
    });
    
    console.log(`✅ Updated ${secretName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${secretName}:`, error.message);
    console.error('💡 Note: GITHUB_TOKEN may not have permission to update secrets.');
    console.error('   Consider using a PAT stored as GITHUB_PAT secret with repo scope.');
    return false;
  }
}

async function main() {
  // Read new refresh token from .token-update.json (created by post-from-queue.js)
  const tokenUpdatePath = path.join(process.cwd(), '.token-update.json');
  
  if (!fs.existsSync(tokenUpdatePath)) {
    console.log('ℹ️  No token update needed - refresh token was not rotated');
    return;
  }

  const tokenUpdate = JSON.parse(fs.readFileSync(tokenUpdatePath, 'utf8'));
  
  if (!tokenUpdate.refreshToken) {
    console.log('ℹ️  No refresh token in update file');
    return;
  }

  console.log('🔄 Updating GitHub Secret with rotated refresh token...\n');

  const updated = await updateSecret('TWITTER_OAUTH2_REFRESH_TOKEN', tokenUpdate.refreshToken);

  if (updated) {
    console.log('\n✅ Refresh token secret updated! Future runs will use the new token.');
    // Clean up the update file
    fs.unlinkSync(tokenUpdatePath);
  } else {
    console.error('\n⚠️  Failed to update refresh token secret.');
    console.error('   The new token is saved in .token-update.json');
    console.error('   You may need to manually update GitHub Secrets.');
    console.error('   Or set up a GITHUB_PAT secret with repo scope for automatic updates.');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

