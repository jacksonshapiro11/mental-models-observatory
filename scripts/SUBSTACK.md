# Substack auto-upload (daily light brief)

Standalone GitHub Action + `scripts/publish-substack.py`. Does **not** hook into
`lib/distribute` (email/X) — failures here never block the brief.

## What posts

The **light brief** (`content/daily-updates/{date}-light.md`), verbatim, with a
link block prepended (Spotify show + full brief on cosmictrex). Title = thesis
headline (same convention as the email subject).

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

### 3. Land the workflow file

If `git push` of `.github/workflows/publish-substack.yml` fails with a Workflows
permission error: github.com → Settings → Developer settings → Fine-grained
tokens → your repo token → Repository permissions → **Workflows: Read and write**.

Or paste the file via the GitHub UI: Add file → Create new file → path
`.github/workflows/publish-substack.yml` → commit to `main`.

## Test for 2026-07-24

1. Secrets set (at least `SUBSTACK_PUBLICATION_URL` + auth).
2. Actions → **Publish to Substack** → Run workflow → date `2026-07-24`.
3. Open Substack editor — expect a **draft** titled from today's thesis.
4. Local dry-run (no secrets needed):  
   `python3 scripts/publish-substack.py --date=2026-07-24 --dry-run`  
   Writes `daily-briefs/2026-07-24-substack-post.md` (gitignored via daily-briefs/).

## Idempotency

Slug `brief-{date}` — re-runs skip if that draft/post already exists.
