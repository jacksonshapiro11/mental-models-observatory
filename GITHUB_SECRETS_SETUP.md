# GitHub Secrets Setup for Twitter Posting

## Add these secrets to your GitHub repository:

Go to: `https://github.com/YOUR_USERNAME/mental-models-observatory/settings/secrets/actions`

Click "New repository secret" for each:

### Required Secrets:

1. **TWITTER_CLIENT_ID**
   ```
   UHdwdGpYemthZENqdXdJcjBrZFU6MTpjaQ
   ```

2. **TWITTER_CLIENT_SECRET**
   ```
   IKlLagygnVHj2J-cNFo_puvRmMU7VA9v-yXpSWsumazrCotmdO
   ```

3. **TWITTER_OAUTH2_ACCESS_TOKEN**
   - Run locally: `npm run twitter:auth`
   - Complete OAuth flow
   - Copy token from `.env.local` after "TWITTER_OAUTH2_ACCESS_TOKEN="

4. **TWITTER_OAUTH2_REFRESH_TOKEN** (optional but recommended)
   - Copy from `.env.local` after "TWITTER_OAUTH2_REFRESH_TOKEN="

---

## To run the GitHub Action:

1. Go to: `Actions` tab in your GitHub repo
2. Select "Test Twitter Post" workflow
3. Click "Run workflow"
4. Click the green "Run workflow" button

The action will:
- ✅ Install dependencies
- ✅ Test posting "Hello world"
- ✅ Post a mental model tweet thread

---

## Workflow Location:

`.github/workflows/test-twitter-post.yml`

