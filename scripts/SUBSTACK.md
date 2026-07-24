# Substack auto-upload (daily light brief)

Standalone GitHub Action + `scripts/publish-substack.py`. Does **not** hook into
`lib/distribute` (email/X) — failures here never block the brief.

## What posts

The **light brief** (`content/daily-updates/{date}-light.md`), verbatim, with a
link block prepended (Spotify show + full brief on cosmictrex). Title = thesis
headline (same convention as the email subject).

## Triggers (hands-off once secrets are set)

1. **Push** of `content/daily-updates/*-light.md` to `main` (primary — fires when the brief lands)
2. **Weekday cron** `45 14 * * 1-5` UTC (~10:45 ET) as backup if the push event is missed
3. **workflow_dispatch** for manual backfill / test

Default mode is **draft**. Flip repo Variable `SUBSTACK_MODE=publish` after clean draft eyeballs.

## One-time setup (Jackson)

### 1. Secrets — GitHub → Settings → Secrets and variables → Actions

| Secret | Required? | Notes |
|--------|-----------|-------|
| `SUBSTACK_PUBLICATION_URL` | **Yes** (master switch) | e.g. `https://cosmictrex.substack.com`. Absent → workflow no-ops. |
| `SUBSTACK_EMAIL` + `SUBSTACK_PASSWORD` | One auth path | Set a password on the Substack account first (magic-link-only accounts can't login from CI). |
| `SUBSTACK_COOKIES_STRING` | Alt auth | Prefer if password login hits captcha from GitHub runners. DevTools → Application → Cookies → `substack.com` → copy as `substack.sid=…; substack.lli=…`. |

### 2. Variables (optional)

| Variable | Default | Notes |
|----------|---------|-------|
| `SUBSTACK_MODE` | `draft` | Flip to `publish` after 1–3 clean draft eyeballs. |
| `SUBSTACK_SEND_EMAIL` | `true` (script) | Publish mode only. Consider `false` while Resend still mails the list. |

### 3. Landing the workflow file

Needs a token/credential with **Workflows: Read and write** (classic PAT scope `workflow`, or fine-grained → Repository permissions → Workflows).

If push still fails: github.com → Settings → Developer settings → Personal access tokens → your token → enable Workflows, then re-push.
Or paste via GitHub UI: Add file → Create new file → path `.github/workflows/publish-substack.yml`.

## Test

1. Secrets set (at least `SUBSTACK_PUBLICATION_URL` + auth).
2. Actions → **Publish to Substack** → Run workflow → date `YYYY-MM-DD`.
3. Open Substack editor — expect a **draft** titled from that day's thesis.
4. Local dry-run (no secrets needed):
   `python3 scripts/publish-substack.py --date=YYYY-MM-DD --dry-run`
   Writes `daily-briefs/{date}-substack-post.md` (gitignored via daily-briefs/).

## Idempotency

Slug `brief-{date}` — re-runs skip if that draft/post already exists.
