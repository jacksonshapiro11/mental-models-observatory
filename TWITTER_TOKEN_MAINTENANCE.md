# Twitter OAuth Token Maintenance

## How Token Refresh Works

### Token Lifecycle
- **Access Token**: Expires after ~2 hours
- **Refresh Token**: Expires after ~60 days (or when you re-authorize)

### Proactive Token Refresh (Guaranteed Freshness)
**We ALWAYS refresh the token at the start of each run** to guarantee a fresh token:

1. **Every GitHub Actions run**:
   - ✅ Token is refreshed BEFORE attempting to post
   - ✅ Fresh token is guaranteed (good for 2 hours)
   - ✅ No expired tokens during posting
   - ✅ Works for the entire 60-day refresh token period

2. **Backup reactive refresh**: If refresh fails, we fail fast with clear error

### Why This Works
- Access tokens expire after ~2 hours
- We run 3x/day with 3-5 hour gaps between runs
- **Proactive refresh ensures we always start with a fresh token**
- No need to wait for 401 errors - we prevent them entirely

## The One Limitation

**GitHub Actions can't update its own secrets** without special setup.

This means:
- ✅ Token is refreshed at start of each run (proactive)
- ✅ Fresh token guaranteed for entire posting process
- ✅ Works autonomously for full 60-day period
- ❌ Can't automatically update GitHub Secrets (but we don't need to - refresh happens each run)

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

