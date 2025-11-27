# Twitter Automation - Clean & Simple

**Automated weekly posting of mental model threads to @Cosmic_t_rex**

---

## 🎯 How It Works

1. **Queue System**: Pre-generated tweets stored in `tweet-queue/`
2. **Auto-Posting**: GitHub Action posts 1 thread per week
3. **Token Refresh**: Automatically refreshes OAuth tokens (never expires)
4. **Tracking**: Posted tweets moved to `tweet-queue/posted/`

---

## 🚀 Setup (One Time)

### 1. Generate Tweet Queue

```bash
npm run generate-tweet-queue
```

This creates `tweet-queue/` with ready-to-post tweets.

### 2. Add GitHub Secrets

Go to: https://github.com/YOUR_USERNAME/mental-models-observatory/settings/secrets/actions

Add these 4 secrets:
- `TWITTER_CLIENT_ID` 
- `TWITTER_CLIENT_SECRET`
- `TWITTER_OAUTH2_ACCESS_TOKEN`
- `TWITTER_OAUTH2_REFRESH_TOKEN`

(You already have these from the initial setup)

### 3. Enable GitHub Action

The workflow `auto-post-weekly-tweet.yml` will automatically:
- Post every Monday at 9am UTC
- Can also be triggered manually anytime

---

## 📅 Posting Schedule

**Automatic**: Every Monday at 9am UTC

**Manual**: 
1. Go to: https://github.com/YOUR_USERNAME/mental-models-observatory/actions/workflows/auto-post-weekly-tweet.yml
2. Click "Run workflow"
3. Click green "Run workflow" button

---

## 📁 File Structure

```
tweet-queue/
├── 001-competitive-advantage-sustainable-moats.json  ← Next to post
├── 002-another-model.json
├── 003-another-model.json
└── posted/
    └── 001-competitive-advantage-sustainable-moats.json  ← Already posted
```

---

## 🔧 Commands

```bash
# Generate new tweet queue
npm run generate-tweet-queue

# Manually post next tweet (for testing)
npm run post-next-tweet

# Test Twitter auth
npm run test:twitter:post
```

---

## ✨ Features

- ✅ **Auto token refresh** - Never expires
- ✅ **Queue management** - Post in order
- ✅ **Track posted tweets** - No duplicates
- ✅ **Character validation** - All tweets under 280 chars
- ✅ **Thread support** - Properly threaded 3-tweet sequences
- ✅ **Error handling** - Retries with new tokens

---

## 📊 Monitoring

**Check posted tweets**:
- Twitter: https://twitter.com/Cosmic_t_rex
- Queue: `tweet-queue/posted/`

**Check pending tweets**:
- Queue: `tweet-queue/*.json`

**Check GitHub Actions**:
- Actions tab: https://github.com/YOUR_USERNAME/mental-models-observatory/actions

---

## 🎨 Adding More Tweets

Edit `scripts/generate-tweet-queue.js` and add more models to the `mentalModels` array:

```javascript
{
  id: 'model-slug',
  name: 'Model Name',
  scenario: 'Your scenario text...',
  bookQuote: {
    text: 'Quote text',
    book: 'Book Name',
    author: 'Author Name'
  },
  summary: 'One sentence summary'
}
```

Then run: `npm run generate-tweet-queue`

---

## ✅ Current Status

- ✅ OAuth 2.0 with auto-refresh configured
- ✅ Test tweet posted successfully
- ✅ Weekly automation ready
- ⏳ Need to generate full queue of 119 models

---

**Next**: Generate the full queue of all 119 mental models!

