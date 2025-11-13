# Auto-Posting Setup Guide

**Fully automated posting to Twitter/X. Zero manual work.**

> **Focus: Twitter/X Only**  
> We're starting with Twitter/X because it's perfect for mental models content (threads work great).  
> LinkedIn can be added later if you want to reach a professional audience.

---

## 🚀 Quick Setup

### 1. Get Twitter/X API Keys

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Apply for a developer account (if you don't have one)
3. Create a new app/project
4. Get your API credentials:
   - **API Key** (Consumer Key)
   - **API Secret** (Consumer Secret)
   - **Access Token**
   - **Access Token Secret**

> **Note**: Twitter API access may require approval. Free tier allows 1,500 tweets/month.

### 2. Add to Environment Variables

Add to `.env.local`:

```env
# Twitter/X API
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret

# Site URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 3. Add to GitHub Secrets (for automation)

Go to your repo → Settings → Secrets and variables → Actions

Add these secrets:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

### 4. Test It

```bash
# Dry run (test without posting)
npm run post-content:dry-run

# Actually post
npm run post-content
```

---

## 🤖 How It Works

### Automatic Daily Posting

1. **GitHub Actions** runs daily at 2 AM UTC
2. Generates new content for the day
3. **Automatically posts** to Twitter/X
4. Saves results to `marketing-content/[date]/post-results-[date].json`

### Manual Posting

```bash
# Post today's content to Twitter
npm run post-content

# Dry run (test without posting)
npm run post-content:dry-run
```

---

## 📊 What Gets Posted

### Twitter/X
- **Format**: Threads (5-10 tweets per model)
- **Content**: 
  - Hook tweet with model name
  - Explanation of the model
  - Key principles
  - Real-world applications
  - Best quote from books
  - Call-to-action with link
- **Timing**: 
  - 5 seconds between tweets in a thread
  - 1 minute between different models (rate limiting)
- **Rate limits**: Respects Twitter's API limits (1,500 tweets/month on free tier)

---

## ⚙️ Configuration

### Posting Schedule

Edit `.github/workflows/generate-content.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Change time here (UTC)
```

### Rate Limiting

Edit `scripts/auto-post-content.js`:

```javascript
// Wait between models (default: 60 seconds)
await new Promise(resolve => setTimeout(resolve, 60000));

// Wait between tweets in thread (default: 5 seconds)
await new Promise(resolve => setTimeout(resolve, 5000));
```

### Posting Frequency

By default, posts one model per day. To change:

Edit `scripts/auto-post-content.js`:
```javascript
// Post multiple models per day
for (const model of dayContent.models.slice(0, 2)) { // Post first 2 models
  // ...
}
```

---

## 🛡️ Safety Features

### Dry Run Mode
Always test first:
```bash
npm run post-content:dry-run
```

### Error Handling
- Failed posts are logged
- Results saved to JSON files
- Continues with next post if one fails

### Rate Limiting
- Automatic delays between posts
- Respects API rate limits
- Won't spam your accounts

---

## 📝 Posting Results

After posting, check:

```
marketing-content/[date]/post-results-[date].json
```

Contains:
- Success/failure for each post
- Tweet IDs (for Twitter)
- Error messages (if any)
- Timestamps

---

## 🔧 Troubleshooting

### "Twitter API keys not configured"
- Add keys to `.env.local`
- Or add to GitHub Secrets for automation

### "Rate limit exceeded"
- Increase delays in `auto-post-content.js`
- Post fewer models per day
- Use Buffer API instead (see below)

### "Failed to post"
- Check API keys are valid
- Check rate limits
- Review error in `post-results-[date].json`

### Posts not appearing
- Check API permissions
- Verify access tokens are valid
- Check Twitter/LinkedIn developer dashboards

---

## 🎯 Alternative: Buffer API

If you prefer using Buffer (easier setup):

1. Get Buffer API token
2. Use Buffer's API instead of direct posting
3. Buffer handles scheduling and rate limiting

See `scripts/platforms/buffer-client.js` (to be created if needed)

---

## ✅ Checklist

- [ ] Twitter API keys obtained
- [ ] Keys added to `.env.local`
- [ ] Keys added to GitHub Secrets
- [ ] Tested with `npm run post-content:dry-run`
- [ ] Verified posts appear on Twitter
- [ ] GitHub Actions workflow enabled

## 💡 Future: Adding LinkedIn

If you want to add LinkedIn later (great for reaching executives, consultants, professionals):

1. LinkedIn has a strong professional audience for mental models
2. Content format works well (thought leadership)
3. API is more complex but doable
4. Can reuse the same generated content

Just let me know when you're ready and I'll add it back!

---

## 🚀 You're Done!

Once configured:
1. Content generates automatically (daily)
2. Content posts automatically (daily)
3. Results are saved automatically
4. **Zero manual work required**

Just monitor the results occasionally to ensure everything is working.

---

**Questions?** Check the error logs in `post-results-[date].json` for details.

