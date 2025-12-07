# Manual Tweet Workflow

**Simple workflow for generating and manually posting weekly tweets**

---

## 🎯 Quick Start

1. **Generate weekly markdown** (or use existing one)
2. **Queue tweets from markdown**: `npm run queue-weekly-tweets tweets/weekly-markdown/YYYY-MM-DD.md`
3. **View queued tweets**: `npm run view-queued-tweets`
4. **Copy and post manually** to Twitter

That's it!

---

## 📋 Detailed Steps

### 1. Generate Weekly Content

You can generate prompts for AI-assisted content creation:

```bash
# Generate prompts for 1 week (7 models)
npm run generate-prompts --week=7

# Or generate for 2 weeks
npm run generate-prompts --week=14
```

This creates prompts in `monthly-prompts/YYYY-MM/` that you can run through AI (Claude/GPT) to generate tweet content.

### 2. Process AI Responses

After getting AI responses:

```bash
npm run process-responses
```

This processes the AI-generated content into a format ready for parsing.

### 3. Queue Tweets from Markdown

Once you have your weekly markdown file (or use an existing one):

```bash
npm run queue-weekly-tweets tweets/weekly-markdown/2024-12-04.md
```

This script:
- ✅ Parses the markdown file
- ✅ Validates character limits (280 chars per tweet)
- ✅ Schedules tweets (3/day at 9am, 12pm, 5pm EST)
- ✅ Saves to `tweets/queue/pending.json`

### 4. View Queued Tweets

To see what's queued and ready to post:

```bash
npm run view-queued-tweets
```

This shows:
- 📅 Scheduled date and time
- 📝 Full tweet text (ready to copy)
- 📊 Summary of queued vs posted tweets

### 5. Post Manually

Copy the tweets from the viewer and post them manually to Twitter. The format shows:
- Each thread with all tweets numbered
- Character counts for validation
- Scheduled dates/times for reference

---

## 📁 File Structure

```
tweets/
├── weekly-markdown/          ← Your source markdown files
│   ├── 2024-11-27.md
│   └── 2024-12-04.md
├── queue/
│   └── pending.json          ← Queued tweets (auto-generated)
└── posted/                   ← Archive of posted tweets (optional)
    └── 2024-11-27.json
```

---

## 📝 Markdown Format

Your markdown files should follow this format:

```markdown
## PROMPT 1: Model Name

**Tweet 1:**

```
SUB TWEET 1
[First tweet content - max 280 chars]

SUB TWEET 2
[Second tweet content - max 280 chars]

SUB TWEET 3
[Third tweet content - max 280 chars]
```

## PROMPT 2: Another Model Name

**Tweet 1:**

```
SUB TWEET 1
...
```
```

Each `## PROMPT` section represents one model with one thread (3 tweets).

---

## 🔧 Available Scripts

- `npm run queue-weekly-tweets <file>` - Queue tweets from markdown
- `npm run view-queued-tweets` - View queued tweets for manual posting
- `npm run generate-prompts --week=7` - Generate prompts for AI
- `npm run process-responses` - Process AI responses

---

## 📦 Archived Components

The following have been archived (moved to `.github/workflows/archived/` and `scripts/archived/`):
- GitHub Actions workflows for automated posting
- Automated posting scripts
- OAuth/token management scripts

These can be restored later if you want to re-enable automation.

---

## 💡 Tips

- **Character limits**: The queue script validates 280 chars per tweet
- **Scheduling**: Tweets are scheduled 3/day (9am, 12pm, 5pm EST)
- **Threads**: Each model gets one thread with 3 tweets
- **Queue management**: The queue appends to existing items, so you can queue multiple weeks

---

## 🆘 Troubleshooting

**"No queued tweets found"**
- Run `npm run queue-weekly-tweets` first with your markdown file

**"File not found"**
- Make sure your markdown file is in `tweets/weekly-markdown/` or provide full path

**"Tweet over 280 chars"**
- The script will show which tweets are too long - edit the markdown and re-queue

