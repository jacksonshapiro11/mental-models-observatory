# Twitter Posting System - Clean & Simple

> **⚠️ NOTE: This document describes the automated posting system which has been archived.**
> 
> **For the current simplified manual workflow, see [MANUAL_TWEET_WORKFLOW.md](./MANUAL_TWEET_WORKFLOW.md)**

**Automated 3x daily posting to [@Cosmic_t_rex](https://twitter.com/Cosmic_t_rex)**

---

## 🎯 How It Works

1. **You provide**: Weekly markdown file with 21 tweet threads (3 tweets each)
2. **System parses**: Extracts threads and schedules 3/day (9am, 12pm, 5pm EST)
3. **Auto-posts**: GitHub Action runs every 3 hours, posts any due tweets
4. **Catch-up logic**: Missed tweets still get posted
5. **History tracking**: All posted tweets saved for records
6. **Token refresh**: Automatic OAuth 2.0 refresh keeps auth valid for 60 days

---

## 📁 Folder Structure

```
tweets/
├── weekly-markdown/          ← KEEP FOREVER (your originals)
│   ├── 2024-11-27.md
│   └── 2024-12-04.md
├── queue/
│   └── pending.json          ← Delete after all posted
└── posted/                   ← Track history
    ├── 2024-11-27.json
    └── 2024-11-28.json
```

---

## 🚀 Usage

### Add New Week of Tweets

```bash
# 1. Save your markdown file
mv your-file.md tweets/weekly-markdown/2024-12-04.md

# 2. Parse and schedule (validates character limits!)
npm run queue-weekly-tweets tweets/weekly-markdown/2024-12-04.md

# 3. Commit and push
git add tweets/
git commit -m "📅 Queued tweets for week of 2024-12-04"
git push
```

That's it! GitHub Actions will auto-post 3x/day.

### Manual Post (Testing Locally)

```bash
npm run post-from-queue
```

This posts any tweets that are scheduled for now or earlier.

---

## 📅 Posting Schedule

- **Frequency**: 3 tweets/day
- **Times**: 9am, 12pm, 5pm EST
- **Days**: Monday - Sunday (7 days/week)
- **21 threads** = 7 days of content

### Catch-Up Logic

If script misses 12pm posting and runs at 1pm:
- ✅ Still posts the 12pm tweet
- ✅ Won't skip it

GitHub Action runs every 3 hours to catch any missed posts.

---

## 📋 Markdown Format

Each thread has 3 tweets, separated by `SUB TWEET N` markers:

```markdown
## PROMPT 1: Model Name

**Tweet 1:**

\```
SUB TWEET 1
[First tweet - scenario + model name + takeaway]
Max 280 characters

SUB TWEET 2
[Second tweet - book quote + connection]
Max 280 characters

SUB TWEET 3
[Third tweet - mission statement + URL]
Max 280 characters
\```
```

**Important**: Each `SUB TWEET N` section must be ≤280 characters!

See: `tweets/weekly-markdown/2024-11-27.md` for complete example with 21 threads

---

## ✨ Features

- ✅ **Auto token refresh** - Never expires
- ✅ **Catch-up posting** - Missed tweets still post
- ✅ **Smart queuing** - New batches append after previous finish
- ✅ **History tracking** - All posts recorded
- ✅ **Clean archives** - Weekly markdowns kept forever
- ✅ **Character validation** - All tweets under 280 chars

---

## 🔧 GitHub Action

**Workflow**: `.github/workflows/post-tweets-automatically.yml`

**Schedule**: Every 3 hours (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC)

**Manual trigger**:
1. Go to [Actions tab](https://github.com/jacksonshapiro11/mental-models-observatory/actions)
2. Select "Post Tweets Automatically"
3. Click "Run workflow"
4. Watch it post in real-time!

### 📊 What to Monitor

**GitHub Actions Dashboard**:
- URL: https://github.com/jacksonshapiro11/mental-models-observatory/actions/workflows/post-tweets-automatically.yml
- **Check every few days** to ensure:
  - ✅ Workflow runs succeed (green checkmarks)
  - ✅ Queue file updates automatically (commits pushed)
  - ✅ No authentication errors

**Twitter Account**:
- URL: https://twitter.com/Cosmic_t_rex
- Verify tweets are posting 3x/day

**What Success Looks Like**:
```
✅ Thread posted successfully
   Tweet 1: Posted (ID: 123456789)
   Tweet 2: Posted (ID: 123456790) 
   Tweet 3: Posted (ID: 123456791)
   
View: https://twitter.com/Cosmic_t_rex/status/123456789
```

**What Failure Looks Like**:
```
❌ Token refresh failed: Request failed with code 400
```
→ Time to re-authorize (see TWITTER_TOKEN_MAINTENANCE.md)

### 🚨 Important: Automatic Queue Updates

After each successful post, GitHub Actions will:
1. ✅ Mark the thread as posted in `tweets/queue/pending.json`
2. ✅ Save post record to `tweets/posted/YYYY-MM-DD.json`
3. ✅ **Automatically commit and push** these changes back to the repo

**You should see new commits** like:
- `🐦 Posted scheduled tweet`

If commits stop appearing = permissions issue (should be fixed now!)

---

## 📊 Current Status

**Active Queue**: `tweets/queue/pending.json`
- Check to see remaining threads
- Updates automatically after each post

**Commands**:
```bash
# Add new week of tweets
npm run queue-weekly-tweets tweets/weekly-markdown/yyyy-mm-dd.md

# Post scheduled tweets now (local testing)
npm run post-from-queue

# Test Twitter auth
node scripts/quick-twitter-auth.js
```

**Files to Keep Forever**:
- ✅ `tweets/weekly-markdown/*.md` - Your originals (source of truth)
- ✅ `tweets/posted/*.json` - Post history (for tracking)

**Files That Auto-Update**:
- 🔄 `tweets/queue/pending.json` - Temporary queue (updates after each post)

**Monitor These**:
1. **GitHub Actions**: https://github.com/jacksonshapiro11/mental-models-observatory/actions/workflows/post-tweets-automatically.yml
   - Should run every 3 hours
   - Should show green checkmarks
   - Should commit queue updates
2. **Twitter**: https://twitter.com/Cosmic_t_rex
   - Should post 3 threads/day
   - 9am, 12pm, 5pm EST

---

## 🧹 Maintenance

**After all 21 threads posted**:
1. Check `tweets/posted/` to confirm all posted
2. Delete `tweets/queue/pending.json`
3. Keep `tweets/weekly-markdown/*.md` forever

**Next week**:
1. Add new markdown file
2. Parse it
3. System continues automatically

---

## ✅ Setup Checklist

- ✅ OAuth 2.0 with auto-refresh configured
- ✅ GitHub Secrets added (4 secrets):
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`
  - `TWITTER_OAUTH2_ACCESS_TOKEN`
  - `TWITTER_OAUTH2_REFRESH_TOKEN`
- ✅ GitHub Actions write permissions enabled
- ✅ Test tweet posted successfully  
- ✅ Weekly automation running
- ✅ First week queued (21 threads)

---

## 🔄 Maintenance (Every ~60 Days)

When refresh token expires, you'll get GitHub Actions notifications. Quick fix:

```bash
# 1. Re-authorize (2 minutes)
node scripts/quick-twitter-auth.js

# 2. Update GitHub Secrets
# Copy new tokens from .env.local to:
# https://github.com/jacksonshapiro11/mental-models-observatory/settings/secrets/actions

# 3. Done! Good for another 60 days
```

See [TWITTER_TOKEN_MAINTENANCE.md](TWITTER_TOKEN_MAINTENANCE.md) for details.

---

## 📈 Weekly Workflow

**Every Monday** (or whenever you want new content):

```bash
# 1. Create new markdown with 21 threads
vim tweets/weekly-markdown/2024-12-09.md

# 2. Queue it up
npm run queue-weekly-tweets tweets/weekly-markdown/2024-12-09.md

# 3. Commit and push
git add tweets/
git commit -m "📅 Queued tweets for week of 2024-12-09"
git push

# 4. Done! System posts 3x/day for 7 days
```

**New tweets start AFTER previous week finishes** - no overlap!

---

**Simple. Clean. Automatic.** 🚀

