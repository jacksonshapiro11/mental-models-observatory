# HANDOFF — needs a push and one API call · 2026-08-09

Written by the 10:03 `daily-improvement` session. **This session had zero network egress** (`curl https://api.github.com` → HTTP 000 in 0.006s, connection refused; same for `cosmictrex.com`; re-verified at 11:0xZ, matching what the 06:18 `verify-brief-publish` session found). Everything below is done on disk and committed to local `main`. Nothing is live.

## 1. Push two commits

```bash
cd /path/to/mental-models-observatory
git log --oneline -2      # expect 88743bd, 6cef8a2
git push origin main
```

| commit | what |
|--------|------|
| `6cef8a2` | IMP-147/148 — header contract + podcast title grounding. Repairs `content/daily-updates/2026-08-08.md` and strips residual HTML comments from 9 published briefs. |
| `88743bd` | IMP-149 — a working file byte-identical to v2 reads ABSENT, not ALIVE (08-09 Critic mandate #3). |

**Until this is pushed, the live site still shows the broken 2026-08-08:** archive card with no title and no blurb, and the homepage "HOW WE START MORNINGS" rail skipping the day.

**After pushing, confirm the repair rather than assuming it:**

```bash
npx tsx scripts/published-header-gate.ts --all          # expect: PASS, all dailies
npx tsx scripts/title-grounding-gate.ts --selftest      # expect: SELFTEST PASS
```

…then load `/daily-update/2026-08-08` and check the title renders as **"The Unemployment Rate Fell the Wrong Way"**.

## 2. Correct the podcast episode title — the actual falsehood

Saturday's episode is titled **"Brief: Tesla's stock crashes after shocking reveal"**. Tesla appears nowhere in that brief (`grep -ic tesla content/daily-updates/2026-08-08.md` → **0**). It was invented by the clickbait title generator after the header defect zeroed `dailyTitle` and `lede`.

The endpoint exists and takes the correction directly:

```
POST /api/audio/update-episode
{ "date": "2026-08-08", "title": "The Unemployment Rate Fell the Wrong Way" }
```

I did not fire this blind. Without network I could not read the current episode metadata back, and a non-idempotent write to an endpoint whose response I cannot verify is how you turn one wrong title into two.

**Verify after:** the Apple Podcasts / RSS entry for 2026-08-08 should read the real title. Note that Apple polls on its own schedule and lags publication well past an hour, so absence immediately after the call is not evidence of failure.

## 3. Also owed from the 06:18 session

Confirm a **W32 weekly episode** exists in the feed. At 10:26Z the two newest episodes were ~23h old with no W32. That is weak evidence on its own (Apple lag), and the completion cron's window was tested against the real code and is correct — `isoWeekSunday('2026-W32')` → `2026-08-09`, today inside the window, with further catches at 22:00Z Sunday and 01:00Z Monday. **If W32 is still absent Monday morning, all three crons will have run and the failure is real.**

## What is already done — do not redo

- `content/daily-updates/2026-08-08.md` repaired; `dailyTitle`, `epigraph` and `lede` all parse (verified against the real parser).
- Residual HTML comments stripped from 07-14, 07-15, 07-16, 08-01, 08-03, 08-04, 08-05, 08-06, 08-07. All diffs are pure deletions — no prose was altered.
- `scripts/publish-brief.py` now strips HTML comments and blocks a malformed header, so this cannot recur through the publisher.
- Ledger rows IMP-147/148/149/150/151 and ESC-014 written; `verify-improvements.ts` exits **0**.
- Email draft for `cosmictrex11@gmail.com` created (subject: *Daily Improvements — 2026-08-09*). **It is a DRAFT, not sent** — no send tool was available to this session. It needs one click.
