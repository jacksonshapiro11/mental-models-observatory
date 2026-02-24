---
name: publish-brief
description: "Publish a Daily Brief to the Mental Models Observatory website. Use this skill whenever the user wants to publish, push, deploy, or upload a daily brief/update to the website. Also trigger when the user says 'publish today's brief', 'push the brief to GitHub', 'deploy the daily update', or any variation of getting a brief markdown file onto the live site. This skill handles the full flow: saving the brief as markdown, pushing it to GitHub via API, and confirming Vercel deployment."
---

# Publish Daily Brief

This skill publishes a Daily Brief markdown file to the Mental Models Observatory GitHub repo. Vercel auto-deploys on push, making the brief live at `/daily-update`.

## How It Works

1. The brief markdown gets saved as `content/daily-updates/YYYY-MM-DD.md` in the repo
2. A Python script pushes it via the GitHub REST API (no git clone needed)
3. Vercel detects the push and auto-deploys
4. The site's parser picks up the new file and renders it

## Prerequisites

A GitHub personal access token with `repo` scope must be available as `GITHUB_TOKEN`. If the token isn't set, guide the user:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select the `repo` scope
4. Copy the token
5. Set it: `export GITHUB_TOKEN=ghp_...`

For fine-grained tokens, the token needs "Contents: Read and write" permission on the `jacksonshapiro11/mental-models-observatory` repository.

## Publishing Flow

### If the brief markdown already exists as a file:

```bash
export GITHUB_TOKEN=ghp_your_token_here
python /path/to/publish-brief/scripts/publish.py /path/to/brief.md
```

Optional flags:
- `--date 2026-02-24` — override the date (defaults to today)
- `--dry-run` — preview what would happen without pushing

### If the brief was just generated in conversation:

1. Save the brief content to a temporary markdown file
2. Run the publish script on that file
3. Confirm the push succeeded

Example:
```bash
# Save the brief
cat > /tmp/daily-brief.md << 'BRIEF_EOF'
[paste or pipe brief content here]
BRIEF_EOF

# Publish
export GITHUB_TOKEN=ghp_your_token_here
python .claude/skills/publish-brief/scripts/publish.py /tmp/daily-brief.md
```

### If updating an existing brief:

The script detects if a file already exists for that date and updates it (using the SHA for the GitHub API's required update mechanism). Just run the same command — it handles create vs update automatically.

## Brief Format Requirements

The markdown file must follow the section structure the parser expects. Each section starts with `# ▸ SECTION NAME`. The recognized sections are:

- `# ▸ THE DASHBOARD`
- `# ▸ THE SIX`
- `# ▸ THE TAKE`
- `# ▸ THE BIG STORIES`
- `# ▸ TOMORROW'S HEADLINES`
- `# ▸ THE WATCHLIST`
- `# ▸ DISCOVERY`
- `# ▸ WORLDVIEW UPDATES`
- `# ▸ FULL REFERENCE: BIG STORIES`
- `# ▸ FULL REFERENCE: TOMORROW'S HEADLINES`

Before the first section, include:
- An italic line for the epigraph/life note
- A bold `**News TLDR:**` line for the day's headline

## Target Repository

- **Repo:** `jacksonshapiro11/mental-models-observatory`
- **Branch:** `main`
- **Path:** `content/daily-updates/YYYY-MM-DD.md`
- **Deploy:** Vercel auto-deploys on push to main

## Design Note

The Daily Brief is ephemeral by design — `/daily-update` always shows only the latest brief. Past briefs are stored in the repo for internal worldview tracking but are not discoverable on the site. There's a hidden archive route at `/daily-update/[date]` as an easter egg, but no links point to it.
