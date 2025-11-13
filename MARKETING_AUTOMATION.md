# Marketing Content Automation

**Fully automated content generation from your mental models data. Zero manual work required.**

---

## 🚀 Quick Start

```bash
# Generate 30 days of content (all formats)
npm run generate-content

# Generate 60 days of content
npm run generate-content -- --days=60

# Generate only Twitter threads
npm run generate-content -- --format=twitter

# Generate schedules for posting
npm run schedule-content

# Auto-post to social media (after setting up API keys)
npm run post-content
```

**That's it. Everything is automated - including posting!**

> **NEW: Full Auto-Posting**  
> See [AUTO_POSTING_SETUP.md](./AUTO_POSTING_SETUP.md) to set up automatic posting to Twitter/X and LinkedIn.

---

## 📁 What Gets Generated

After running `npm run generate-content`, you'll find:

```
marketing-content/
└── 2025-01-15/                    # Date-stamped folder
    ├── day-1.json                  # All content for day 1
    ├── day-2.json                  # All content for day 2
    ├── ...
    ├── twitter-day-1.txt           # Ready-to-post Twitter threads
    ├── quotes-day-1.json           # Quote cards data
    ├── summary.json                # Overview
    └── schedules/                  # After running schedule-content
        ├── buffer-import.csv       # Import to Buffer/Hootsuite
        ├── twitter-schedule.json   # Twitter native scheduler
        └── newsletter-schedule.json # Email schedule
```

---

## 📊 Content Formats Generated

### 1. Twitter/X Threads
- **File**: `twitter-day-N.txt`
- **Format**: Ready-to-post thread format
- **Content**: 5-10 tweet threads explaining each model
- **Includes**: Hook, explanation, principles, applications, examples, CTA

### 2. Quote Cards
- **File**: `quotes-day-N.json`
- **Format**: JSON with quote data
- **Content**: Top 5 highlights per model
- **Use**: Design visual quote cards in Canva/Figma

### 3. Visual Model Cards
- **File**: `day-N.json` → `visualCard` field
- **Format**: JSON with design specs
- **Content**: Model name, description, principles, quote, colors
- **Use**: Auto-generate visual cards (or use as design brief)

### 4. Newsletter Content
- **File**: `day-N.json` → `newsletter` field
- **Format**: Structured newsletter content
- **Content**: Model of the week with highlights, principles, applications
- **Use**: Copy into your email platform

### 5. Blog Post Outlines
- **File**: `day-N.json` → `blog` field
- **Format**: Complete blog post structure
- **Content**: Title, SEO, outline, sections, tags
- **Use**: Expand into full blog posts

### 6. Video Scripts
- **File**: `day-N.json` → `video` field
- **Format**: 60-second video script
- **Content**: Hook, explanation, example, CTA with timing
- **Use**: Record videos or use for TikTok/Reels

---

## ⚙️ Configuration

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Command Options

```bash
# Generate content
npm run generate-content [options]

Options:
  --days N          Number of days to generate (default: 30)
  --format FORMAT   Specific format: twitter, quotes, newsletter, blog, video, visual, all
  --output DIR      Output directory (default: ./marketing-content)

# Generate schedules
npm run schedule-content [options]

Options:
  --input DIR       Input directory (default: ./marketing-content)
  --platform PLATFORM  buffer, twitter, newsletter, all
```

---

## 📅 Automated Scheduling

### Option 1: Buffer/Hootsuite (CSV Import)

1. Run `npm run schedule-content`
2. Open `marketing-content/[date]/schedules/buffer-import.csv`
3. Import into Buffer/Hootsuite
4. Add your profile IDs
5. Review and publish

### Option 2: Twitter Native Scheduler

1. Run `npm run schedule-content -- --platform=twitter`
2. Use `twitter-schedule.json` with Twitter's scheduler
3. Or use a tool like [TweetDeck](https://tweetdeck.twitter.com)

### Option 3: GitHub Actions (Fully Automated)

See `AUTOMATION_SETUP.md` for GitHub Actions workflow that:
- Generates content daily
- Commits to a branch
- Creates PRs for review
- (Optional) Auto-posts via API

---

## 🎨 Visual Content Generation

The system generates **design specifications** for visual content. You can:

1. **Manual Design**: Use the `visualCard` data in Canva/Figma
2. **Automated Design**: Use Canva API or similar to auto-generate images
3. **Template-Based**: Create templates and batch-generate

### Visual Card Data Structure

```json
{
  "design": {
    "header": "Model Name",
    "icon": "🧠",
    "color": "#6366f1",
    "description": "Short description...",
    "bullets": ["Principle 1", "Principle 2", "Principle 3"],
    "quote": {
      "text": "Best quote...",
      "author": "Author Name",
      "book": "Book Title"
    },
    "difficulty": "beginner",
    "domain": "Domain Name"
  }
}
```

---

## 📧 Newsletter Automation

### Setup

1. Generate content: `npm run generate-content`
2. Generate schedule: `npm run schedule-content -- --platform=newsletter`
3. Use `newsletter-schedule.json` with your email platform

### Email Platform Integration

**Substack/ConvertKit/Email Service:**
- Use the `newsletter` field from `day-N.json`
- Copy content into your platform
- Schedule for the date specified

**Automated (Advanced):**
- Use email platform API
- Create script to auto-send from JSON
- See `scripts/auto-send-newsletter.js` (to be created)

---

## 🔄 Daily Automation

### GitHub Actions (Recommended)

Create `.github/workflows/generate-content.yml`:

```yaml
name: Generate Marketing Content

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  workflow_dispatch:  # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run generate-content -- --days=7
      - run: npm run schedule-content
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: 'Auto-generate marketing content'
          file_pattern: 'marketing-content/**'
```

### Local Cron (Alternative)

```bash
# Add to crontab (crontab -e)
0 0 * * * cd /path/to/project && npm run generate-content -- --days=7 && npm run schedule-content
```

---

## 📈 Content Calendar

After generating content, check:

```
marketing-content/content-calendar.csv
```

This CSV shows:
- Date
- Model name
- Available formats (Twitter, Quotes, Visual, etc.)
- URL

Import into Google Calendar, Notion, or your project management tool.

---

## 🎯 Best Practices

### 1. Start Small
- Generate 7 days first
- Review content quality
- Adjust templates if needed
- Then scale to 30+ days

### 2. Review Before Posting
- Content is auto-generated but should be reviewed
- Check for accuracy
- Ensure tone matches your brand
- Add personal touches if desired

### 3. Batch Processing
- Generate monthly content in one go
- Review all at once
- Schedule everything
- Set and forget

### 4. A/B Testing
- Try different hooks
- Test different formats
- See what resonates
- Iterate on templates

---

## 🔧 Customization

### Modify Content Templates

Edit `scripts/generate-marketing-content.js`:

- **Twitter threads**: Modify `generateTwitterThread()`
- **Quote cards**: Modify `generateQuoteCards()`
- **Newsletters**: Modify `generateNewsletterContent()`
- **Blog posts**: Modify `generateBlogPostOutline()`
- **Video scripts**: Modify `generateVideoScript()`

### Add New Formats

1. Create new generator function
2. Add to `generateAllContent()`
3. Update command options
4. Test and deploy

---

## 🐛 Troubleshooting

### "Could not import parse-all-domains"

**Solution**: Install ts-node:
```bash
npm install ts-node --save-dev
```

### "No content directory found"

**Solution**: Run `npm run generate-content` first

### TypeScript Import Errors

**Solution**: The script has a fallback that parses TS files directly. If issues persist, ensure Node.js 18+ is installed.

### Content Quality Issues

**Solution**: 
- Review generated content
- Adjust templates in the script
- Add validation/filtering logic
- Use AI to refine (optional enhancement)

---

## 🚀 Next Steps

1. **Generate your first batch**: `npm run generate-content`
2. **Review the output**: Check `marketing-content/` folder
3. **Set up scheduling**: Use Buffer, Twitter, or your preferred tool
4. **Automate**: Set up GitHub Actions or cron
5. **Iterate**: Adjust templates based on performance

---

## 📝 Notes

- **Zero manual work**: Everything is generated from your data
- **Fully customizable**: Edit templates to match your brand
- **Scalable**: Generate months of content in seconds
- **Platform-agnostic**: Works with any social media/email platform
- **Version controlled**: All content is saved and trackable

---

**Questions?** Check the generated content first - it's self-documenting with clear structure and examples.

