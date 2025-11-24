# Twitter Automation Pipeline - Complete Guide

## 🎯 Overview

This is a fully automated Twitter/X content pipeline for posting mental models content weekly. The system generates content, schedules it, and posts it automatically.

**What it does:**
- Generates AI-assisted Twitter content from mental models
- Creates 3-tweet threads per model
- Schedules posts throughout the week
- Posts automatically via Twitter API

---

## 📋 Prerequisites

1. **Twitter Developer Account** with:
   - Essential or Elevated access tier (Free tier won't work for posting)
   - OAuth 2.0 enabled
   - App with "Read and Write" permissions

2. **Node.js** installed

3. **Environment variables** configured (see Setup below)

---

## 🚀 Quick Start

### Step 1: Initial Setup

#### 1.1 Get Twitter Credentials

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Create/select your app
3. Go to **Settings** → **User authentication settings**
4. Enable **OAuth 2.0**
5. Set:
   - **Type of App**: Web App, Automated App or Bot
   - **App permissions**: Read and Write
   - **Callback URI**: `http://localhost:3000/callback`
   - **Website URL**: `https://www.cosmictrex.xyz`
6. Save and copy:
   - **Client ID**
   - **Client Secret**

#### 1.2 Authorize Your App

```bash
# Add credentials to .env.local first (see below)
npm run twitter:auth
```

Follow the prompts:
1. Open the authorization URL in your browser
2. Click "Authorize app"
3. Copy the redirect URL (even if page doesn't load)
4. Paste it back into terminal
5. ✅ Done! Tokens are saved automatically

#### 1.3 Configure Environment Variables

Create/update `.env.local`:

```bash
# Twitter OAuth 2.0 Credentials
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here

# OAuth 2.0 Access Token (auto-generated after authorization)
TWITTER_OAUTH2_ACCESS_TOKEN=auto_generated_after_auth

# Site URL
NEXT_PUBLIC_SITE_URL=https://www.cosmictrex.xyz
```

---

## 📝 Content Generation Pipeline

### Weekly Content Generation

#### Option 1: Generate for 1 Week (7 models, 3 tweets each)

```bash
npm run generate-prompts --week=7
```

This creates prompts in `monthly-prompts/YYYY-MM/` for AI-assisted content generation.

#### Option 2: Generate for 2 Weeks (14 models, 3 tweets each)

```bash
npm run generate-prompts --week=14
```

### Process AI Responses

1. **Copy prompts** from `monthly-prompts/YYYY-MM/BATCH_PROMPTS.md`
2. **Run through AI** (Claude/GPT) - paste the prompts
3. **Save AI response** to `monthly-prompts/YYYY-MM/AI_RESPONSE.md`
4. **Process responses**:

```bash
npm run process-responses
```

This creates `scenarios.json` with all the generated content.

### Parse Tweets into Posting Format

```bash
npm run parse-tweets
```

This:
- Reads the AI-generated content
- Splits into 3 separate tweets per model
- Creates `posting-schedule.json` with weekly schedule
- Schedules threads for Mon/Wed/Fri at 9am, 2pm, 7pm

---

## 📅 Weekly Posting Schedule

The system automatically schedules:
- **3 threads per model** (one per model)
- **Spread across the week**: Monday, Wednesday, Friday
- **Times**: 9am, 2pm, 7pm (spread out to avoid overlap)
- **All models scheduled within the same week**

### Schedule Format

The `posting-schedule.json` looks like:

```json
{
  "2024-11-25T09:00:00": {
    "model": "Confirmation Bias",
    "thread": [
      { "text": "Tweet 1: Scenario", "order": 1 },
      { "text": "Tweet 2: Quote", "order": 2 },
      { "text": "Tweet 3: Invitation + Link", "order": 3 }
    ]
  }
}
```

---

## 🤖 Automated Posting

### Manual Posting (Test)

```bash
# Test posting a single tweet
npm run test:twitter:post

# Post scheduled tweets (dry run - shows what would post)
npm run post-tweets:force --dry-run

# Post scheduled tweets (actually posts)
npm run post-tweets:force
```

### Automated Weekly Posting

The system posts tweets as connected threads:
- **Tweet 1** posts first
- **Tweet 2** replies to Tweet 1
- **Tweet 3** replies to Tweet 2
- Creates a visible thread on Twitter

**Posting Logic:**
- Checks `posting-schedule.json`
- Finds tweets scheduled for current time
- Posts them as connected threads
- Waits between tweets (5 seconds)
- Logs all activity

---

## 📂 File Structure

```
├── scripts/
│   ├── generate-prompts.js          # Generate AI prompts for content
│   ├── process-ai-responses.js      # Process AI responses into scenarios
│   ├── parse-tweets-from-markdown.js # Parse tweets into posting format
│   ├── post-scheduled-tweets.js    # Post scheduled tweets
│   ├── test-post-simple.js          # Test single tweet posting
│   ├── oauth2-authorize-manual.js   # OAuth 2.0 authorization
│   └── platforms/
│       └── twitter-client.js        # Twitter API client
├── monthly-prompts/
│   └── YYYY-MM/
│       ├── BATCH_PROMPTS.md         # Prompts for AI
│       ├── AI_RESPONSE.md           # AI-generated content
│       └── TWITTER_CONTENT_FINAL.md # Final cleaned tweets
├── posting-schedule.json            # Weekly posting schedule
├── scenarios.json                   # Generated scenarios
└── .env.local                       # Credentials (not in git)
```

---

## 🔄 Complete Weekly Workflow

### Week 1: Setup (One-time)

1. ✅ Set up Twitter Developer account
2. ✅ Run `npm run twitter:auth` to authorize
3. ✅ Test with `npm run test:twitter:post`

### Week 2+: Weekly Content Cycle

**Monday:**
```bash
# 1. Generate prompts for the week
npm run generate-prompts --week=7

# 2. Copy prompts to AI (Claude/GPT)
# Open: monthly-prompts/YYYY-MM/BATCH_PROMPTS.md
# Paste into AI, get response

# 3. Save AI response
# Save to: monthly-prompts/YYYY-MM/AI_RESPONSE.md

# 4. Process responses
npm run process-responses

# 5. Parse into posting format
npm run parse-tweets

# 6. Review schedule
cat posting-schedule.json
```

**Tuesday-Sunday:**
- Tweets post automatically based on schedule
- Or run manually: `npm run post-tweets:force`

---

## 🛠️ Available Commands

### Content Generation
```bash
npm run generate-prompts          # Generate prompts (default: 7 models)
npm run generate-prompts:twice   # Generate for 14 models
npm run generate-prompts:month   # Generate for full month
npm run process-responses         # Process AI responses
npm run parse-tweets              # Parse into posting format
```

### Twitter Operations
```bash
npm run twitter:auth              # Authorize OAuth 2.0
npm run test:twitter:post        # Test posting
npm run post-tweets               # Post scheduled tweets
npm run post-tweets:force         # Force post (ignore time checks)
```

### Testing
```bash
npm run test:twitter:read         # Test read access
npm run test:twitter:post         # Test post access
```

---

## 🔧 Troubleshooting

### "401 Unauthorized"
- **Issue**: OAuth 2.0 token expired or invalid
- **Fix**: Re-run `npm run twitter:auth`

### "403 Forbidden"
- **Issue**: App doesn't have write permissions or wrong access tier
- **Fix**: 
  - Check app has "Read and Write" permissions
  - Verify you have Essential or Elevated tier (not Free)

### "Callback URL mismatch"
- **Issue**: Twitter callback URL doesn't match
- **Fix**: Update Twitter Developer Portal → Settings → Callback URI to match what's in the script

### Tweets not posting
- **Check**: `posting-schedule.json` exists and has entries
- **Check**: Current time matches scheduled times
- **Try**: `npm run post-tweets:force` to bypass time checks

### Content generation fails
- **Check**: `lib/readwise-data.ts` and `lib/parse-all-domains.ts` exist
- **Check**: Data files are properly formatted
- **Try**: `npm install ts-node --save-dev` if TypeScript loading fails

---

## 📊 Content Framework

All tweets follow the structure defined in `TWITTER_CONTENT_FRAMEWORK.md`:

**Tweet 1: Scenario**
- Real-world situation where the model applies
- Concrete, relatable example
- ~200-250 characters

**Tweet 2: Quote**
- Curated highlight from Readwise
- Most relevant quote for the model
- Includes attribution

**Tweet 3: Invitation + Link**
- Connection between scenario and quote
- Invitation to explore more
- Link to model page on site

---

## 🔐 Security Notes

- ✅ `.env.local` is in `.gitignore` (never commit credentials)
- ✅ OAuth 2.0 tokens are stored locally only
- ✅ Client Secret should never be shared
- ⚠️ Regenerate tokens if compromised

---

## 🚀 Next Steps

1. **Set up GitHub Actions** for automated weekly posting
2. **Add error notifications** (email/Slack when posts fail)
3. **Analytics tracking** (track engagement per model)
4. **A/B testing** (test different tweet formats)

---

## 📚 Additional Resources

- **Twitter Content Framework**: `TWITTER_CONTENT_FRAMEWORK.md`
- **Troubleshooting Guide**: `TWITTER_SETUP_TROUBLESHOOTING.md`
- **OAuth 2.0 Setup**: `OAUTH2_PKCE_SETUP.md`

---

## ✅ Success Checklist

- [ ] Twitter Developer account with Essential/Elevated access
- [ ] OAuth 2.0 enabled and configured
- [ ] App authorized (`npm run twitter:auth` successful)
- [ ] Test tweet posted successfully
- [ ] Content generation working
- [ ] Posting schedule created
- [ ] Ready for weekly automation!

---

**Questions?** Check the troubleshooting section or review the individual script files for detailed implementation.

