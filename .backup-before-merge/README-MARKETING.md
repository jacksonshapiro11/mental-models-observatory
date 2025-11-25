# Marketing Content Automation Scripts

## Quick Start

```bash
# Generate 30 days of all content formats
npm run generate-content

# Generate schedules for posting
npm run schedule-content
```

That's it. Everything is automated.

## What These Scripts Do

### `generate-marketing-content.js`

**Purpose**: Generate all marketing content from your mental models data

**Generates**:
- Twitter/X threads (ready to post)
- Quote cards (JSON for visual design)
- Visual model cards (design specs)
- Newsletter content (structured)
- Blog post outlines (complete structure)
- Video scripts (60-second format)

**Output**: `marketing-content/[date]/` folder with all content

**Options**:
```bash
--days N          # Days to generate (default: 30)
--format FORMAT   # Specific format: twitter, quotes, newsletter, blog, video, visual, all
--output DIR      # Output directory (default: ./marketing-content)
```

### `auto-schedule-content.js`

**Purpose**: Create posting schedules from generated content

**Generates**:
- Buffer/Hootsuite CSV import
- Twitter native scheduler JSON
- Newsletter schedule JSON

**Output**: `marketing-content/[date]/schedules/` folder

**Options**:
```bash
--input DIR       # Input directory (default: ./marketing-content)
--platform PLATFORM  # buffer, twitter, newsletter, all
```

## File Structure

After running both scripts:

```
marketing-content/
└── 2025-01-15/
    ├── day-1.json              # All content for day 1
    ├── day-2.json              # All content for day 2
    ├── twitter-day-1.txt       # Ready-to-post threads
    ├── quotes-day-1.json       # Quote data
    ├── summary.json            # Overview
    └── schedules/
        ├── buffer-import.csv   # Import to Buffer
        ├── twitter-schedule.json
        └── newsletter-schedule.json
```

## Usage Examples

### Generate 60 days of content
```bash
npm run generate-content -- --days=60
```

### Generate only Twitter threads
```bash
npm run generate-content -- --format=twitter
```

### Generate schedules for Buffer
```bash
npm run schedule-content -- --platform=buffer
```

## Automation

### GitHub Actions
See `.github/workflows/generate-content.yml` - runs daily automatically.

### Local Cron
```bash
# Add to crontab (crontab -e)
0 0 * * * cd /path/to/project && npm run generate-content -- --days=7
```

## Customization

Edit the generator functions in `generate-marketing-content.js`:
- `generateTwitterThread()` - Twitter format
- `generateQuoteCards()` - Quote format
- `generateNewsletterContent()` - Newsletter format
- etc.

## Troubleshooting

**"Could not import parse-all-domains"**
```bash
npm install ts-node --save-dev
```

**TypeScript import errors**
The script has a fallback parser. If issues persist, ensure Node.js 18+.

**No content generated**
Check that `lib/readwise-data.ts` exists and has models.

## Next Steps

1. Run `npm run generate-content`
2. Review output in `marketing-content/`
3. Import schedules to your posting tool
4. Set up automation (GitHub Actions or cron)
5. Iterate on templates based on performance

For full documentation, see [MARKETING_AUTOMATION.md](../MARKETING_AUTOMATION.md).

