# Twitter Posting System - Clean & Simple

**Automated 3x daily posting to @Cosmic_t_rex**

---

## 🎯 How It Works

1. **You provide**: Weekly markdown file with 21 tweet threads
2. **System parses**: Extracts threads and schedules 3/day (9am, 12pm, 5pm EST)
3. **Auto-posts**: GitHub Action runs every 3 hours, posts any due tweets
4. **Catch-up logic**: Missed tweets still get posted
5. **History tracking**: All posted tweets saved for records

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

# 2. Parse and schedule
npm run parse-weekly-tweets tweets/weekly-markdown/2024-12-04.md
```

That's it! System will auto-post 3x/day.

### Manual Post (Testing)

```bash
npm run post-scheduled-tweet
```

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

```markdown
## PROMPT 1: Model Name

**Tweet 1:**
\```
[tweet text]
\```

**Tweet 2:**
\```
[tweet text]
\```

**Tweet 3:**
\```
[tweet text]
\```
```

See: `tweets/weekly-markdown/2024-11-27.md` for example

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

**Runs**: Every 3 hours automatically

**Manual trigger**:
1. Go to Actions tab
2. Select "Post Tweets Automatically"
3. Click "Run workflow"

**Monitor**:
- Actions: https://github.com/YOUR_USERNAME/mental-models-observatory/actions
- Twitter: https://twitter.com/Cosmic_t_rex

---

## 📊 Current Status

**Commands**:
```bash
# Add new week
npm run parse-weekly-tweets tweets/weekly-markdown/yyyy-mm-dd.md

# Post now (testing)
npm run post-scheduled-tweet

# Test Twitter auth
npm run test:twitter:post
```

**Files to Keep Forever**:
- ✅ `tweets/weekly-markdown/*.md` - Your originals
- ✅ `tweets/posted/*.json` - Post history

**Files to Delete After All Posted**:
- 🗑️ `tweets/queue/pending.json` - Temporary queue

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
- ✅ GitHub Secrets added (4 secrets)
- ✅ Test tweet posted successfully  
- ✅ Weekly automation ready
- ⏳ Ready for your first weekly markdown!

---

**Simple. Clean. Automatic.**

