# Twitter OAuth Token Maintenance

## How Token Refresh Works

### Token Lifecycle
- **Access Token**: Expires after ~2 hours
- **Refresh Token**: Expires after ~60 days (or when you re-authorize)

### Auto-Refresh (Built-In)
Our system automatically refreshes access tokens:

1. **During GitHub Actions run**: If a tweet fails with 401, it automatically:
   - Uses the refresh token to get a new access token
   - Retries the tweet
   - ✅ Works within a single workflow run

2. **Between runs**: Tokens are stored in GitHub Secrets and persist

## The One Limitation

**GitHub Actions can't update its own secrets** without special setup.

This means:
- ✅ Auto-refresh works during a run (within 3 hours)
- ✅ Workflow runs every 3 hours (well before 2-hour expiration)
- ❌ Can't automatically update GitHub Secrets for next run

## Solution: Manual Re-Auth Every ~60 Days

When the **refresh token** expires (~60 days), you'll need to re-authorize once:

### How to Re-Authorize

1. **Run the auth script**:
   ```bash
   cd /Users/jackson/Desktop/mental-models-observatory
   node scripts/quick-twitter-auth.js
   ```

2. **Follow the prompts**:
   - Open the URL in your browser
   - Click "Authorize app"
   - Copy the redirect URL
   - Paste it back in the terminal

3. **Update GitHub Secrets** (one time):
   - Go to: https://github.com/YOUR_USERNAME/mental-models-observatory/settings/secrets/actions
   - Update these 2 secrets:
     - `TWITTER_OAUTH2_ACCESS_TOKEN`
     - `TWITTER_OAUTH2_REFRESH_TOKEN`
   - Copy values from your `.env.local` file

4. **Done!** Good for another 60 days.

## How to Know When to Re-Auth

You'll get a **GitHub Actions notification email** when tweets fail to post with:
- "Token refresh failed" error
- 401 Unauthorized

This means: Time to re-authorize (takes 2 minutes).

## Pro Tips

1. **Set a calendar reminder** for every 60 days
2. **Monitor your GitHub Actions** at: https://github.com/YOUR_USERNAME/mental-models-observatory/actions
3. **Test before each batch**: Run `npm run post-from-queue` locally before adding new weekly tweets

## Future Enhancement (Optional)

If you want true hands-free operation, you could:
- Use a service like AWS Secrets Manager or Azure Key Vault
- Store tokens in an encrypted file in a private GitHub repo
- Use GitHub API with a PAT to update secrets automatically

For a personal project, manual re-auth every 60 days is usually fine! 🎯

