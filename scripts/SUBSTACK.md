# Substack auto-upload (daily light brief)

Standalone GitHub Action + `scripts/publish-substack.py`. Does **not** hook into
`lib/distribute` (email/X) — failures here never block the brief.

## What posts

The **light brief** (`content/daily-updates/{date}-light.md`), verbatim, with a
link block prepended (Spotify show + full brief on cosmictrex). Title = thesis
headline (same convention as the email subject).

## Triggers (hands-off once cookie auth is set)

1. **Push** of `content/daily-updates/*-light.md` to `main` (primary — fires when the brief lands)
2. **Weekday cron** `45 14 * * 1-5` UTC (~10:45 ET) as backup if the push event is missed
3. **workflow_dispatch** for manual backfill / test

Default mode is **publish** (web + Substack subscriber email). Set repo Variable
`SUBSTACK_MODE=draft` only if you need a temporary draft-only rollback.

## One-time setup (Jackson)

### 1. Secrets — GitHub → Settings → Secrets and variables → Actions

| Secret | Required? | Notes |
|--------|-----------|-------|
| `SUBSTACK_PUBLICATION_URL` | **Yes** (master switch) | e.g. `https://cosmictrex.substack.com`. Absent → workflow no-ops. |
| `SUBSTACK_COOKIES_STRING` | **Yes for CI** | Cloudflare blocks password login from GitHub runners. Browser DevTools → Application → Cookies → `substack.com` → copy as `substack.sid=…; substack.lli=…`. |
| `SUBSTACK_EMAIL` + `SUBSTACK_PASSWORD` | Local only | Optional local fallback; **will fail in Actions** with Cloudflare challenge. |

### 2. Variables (optional overrides)

| Variable | Default | Notes |
|----------|---------|-------|
| `SUBSTACK_MODE` | `publish` | Workflow + script default to publish even if unset. Set `draft` to pause live posts. |
| `SUBSTACK_SEND_EMAIL` | `true` | Publish mode only. Matches Substack UI “Publish” (emails Substack list). Set `false` for web-only. **Dual-send:** Resend may still email the Cosmic Trex list separately — Subscribers on both lists get two emails. |

Recommended (optional, documents intent): repo Variable `SUBSTACK_MODE=publish`.

### 3. Landing the workflow file

Needs a token/credential with **Workflows: Read and write** (classic PAT scope `workflow`).
Push with keychain/SSH — not a remote URL that embeds a PAT missing `workflow`.

## Test

1. `SUBSTACK_PUBLICATION_URL` + `SUBSTACK_COOKIES_STRING` set.
2. Actions → **Publish to Substack** → Run workflow → date `YYYY-MM-DD` → expect a **live** post.
3. Local publish (uses `.env.local` cookies):
   `python3 scripts/publish-substack.py --date=YYYY-MM-DD --mode=publish`
4. Local dry-run (no secrets needed):
   `python3 scripts/publish-substack.py --date=YYYY-MM-DD --dry-run`
   Writes `daily-briefs/{date}-substack-post.md` (gitignored via daily-briefs/).

## Idempotency

Slug `brief-{date}` — re-runs skip if that **published** post already exists.
If a **draft** already exists and mode is `publish`, the script publishes that draft
in place (does not create a duplicate).
