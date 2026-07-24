# The Weekly + Weekly Light — Build Summary & Handoff

Two new products: **The Weekly** (full brief at a week horizon) and the **Weekly Light** (its super brief). Publish Sunday as the single zoom-out, holding that day's daily back. Same form and voice as the daily, wider lens. Both render on the site and read as audio. Saturday-draft / Sunday-publish, hold model (silence ships).

Status: **content + website + audio-rendering + weekly publisher are BUILT and verified. Three things remain (below).** `tsc --noEmit` is clean; both W26 calibration examples parse with all sections.

---

## DONE — content (internal `system/` docs, do NOT commit)
- `system/Weekly_Generator.md` — full weekly generator, inlined W26 gold-standard example, predictions look-back.
- `system/Weekly_Light_Generator.md` — weekly super-brief generator, inlined W26-light example.
- `system/Weekly_Predictions_Ledger.md` — existing rich ledger kept; example predictions reconciled to it.
- `daily-briefs/2026-W26-weekly-EXAMPLE.md`, `daily-briefs/2026-W26-weekly-light-EXAMPLE.md` — calibration examples.
- `system/Pipeline_Controller.md` — new "THE WEEKLY" section: hold model, both products, ZOOM-OUT DAY = 2026-07-05, publish commands, morning-chain behavior.

## DONE — website + audio code (commit these; verified: typecheck clean, W26 parses)
- `lib/daily-update-parser.ts` — added `# ▸ THE SIGNAL` + `# ▸ THE PREDICTIONS` to `SECTION_DEFS` and the `BriefSection['type']` union; added `getWeeklyBySlug` / `getAllWeeklySlugs` / `resolveWeeklyFile` (read `content/daily-updates/weekly/`). Harmless to the daily.
- `lib/weekly-light-parser.ts` **(new)** — `getWeeklyLightBySlug` / `getAllWeeklyLightSlugs`; reuses `parseBriefLight`.
- `lib/brief-light-parser.ts` — added `## ▸ OUR CALLS` → id `our-calls`; hardened the header scan to skip HTML comment lines (this fixed a real bug where the weekly-light title parsed empty).
- `components/daily-update/BriefViewer.tsx` — renders `the-signal` (generic) and `the-predictions` (The-Take prose treatment) + section styling.
- `components/super-brief/SuperBriefViewer.tsx` — renders `## ▸ OUR CALLS`; added optional props `fullBriefBasePath` / `selfBasePath` that DEFAULT to the daily paths (so the daily super brief is unchanged) and are overridden to `/weekly` and `/weekly-super` by the weekly route.
- `app/weekly/[slug]/page.tsx` **(new)** — full weekly route, reuses `BriefViewer`.
- `app/weekly-super/[slug]/page.tsx` **(new)** — weekly-light route, reuses `SuperBriefViewer`.
- `lib/audio/text-preprocessor.ts` — `WEEKLY_AUDIO_SECTIONS` (adds THE SIGNAL + THE PREDICTIONS), an `isWeekly` branch, and `our-calls` in the light path. **Daily audio unchanged** (Signal still omitted there).
- `scripts/publish-weekly.py` **(new)** — publishes both weekly files (validates sections + em-dash ban, robust /tmp-clone push). Dry-run tested.

Slugs/paths: full = `content/daily-updates/weekly/{YYYY-Www}-{mon-dd-dd}.md` → `/weekly/{YYYY-Www}`; light = `content/daily-updates/weekly/{YYYY-Www}-light.md` → `/weekly-super/{YYYY-Www}`.

---

## REMAINING — 3 things for Cursor

### 1. Deploy the code
Commit + push the DONE code files above (all typecheck-clean). Do **not** commit `system/` or `daily-briefs/` (internal, per repo policy).
Also delete two throwaway test files left in the repo root (the sandbox blocked `rm`): `__wk_test.ts`, `__weekly_parser_selftest.ts`.
Staged test fixtures `content/daily-updates/weekly/2026-W26-jun-21-27.md` and `-light.md` exist — publish them as the first live weekly, or delete and wait for W27.

### 2. Archive the old W12 weekly (before the route goes live)
`content/daily-updates/weekly/2026-W12-mar-16-22.md` is the retired recap format. Through the new parser it returns an **empty title / 6 partial sections**, so `/weekly/2026-W12` would render title-less. Move it out of `content/daily-updates/weekly/` (e.g. an archive folder). Same for `content/daily-updates/monthly/2026-03-month-1.md` if a monthly route is ever added.

### 3. Wire `/api/publish/complete` for weekly audio + email (the only unfinished code)
This REUSES the existing daily audio/email code — just thread a weekly slug + `isWeekly` through. The preprocessor already supports `isWeekly`; only the callers hardcode the daily date/paths.
- `app/api/publish/complete/route.ts` — accept `?weekly={slug}`. When present, resolve via `getWeeklyBySlug` / `getWeeklyLightBySlug` (not the daily getters) and pass the slug + `isWeekly: true` to the audio generators.
- `lib/audio/full-generate.ts` (`generateFullBriefAudio`) and `lib/audio/light-generate.ts` (`generateLightAudio`) — accept an optional weekly slug; read `content/daily-updates/weekly/{slug}(-light).md` and pass `isWeekly` into `preprocessBriefForTTS` / `preprocessBriefLightForTTS` (both already take it).
- `lib/audio/podcast-feed.ts` — key the weekly episode by slug (e.g. episode id `weekly-{slug}`).
- `lib/distribute/run-if-needed.ts` — send the weekly email (weekly subject + `/weekly/{slug}` link).
**Cannot be tested in Cowork** (GPT-4o + TTS + live email), so watch the first Sunday run.

Optional: I built `scripts/publish-weekly.py` because the sandbox blocks edits to `.claude/`. If you prefer ONE publisher, the equivalent change to `.claude/skills/publish-brief/scripts/publish.py` is: (a) add `REQUIRED_SECTIONS_WEEKLY_LIGHT = ["# WEEKLY LIGHT"]`; (b) in `publish_brief`, detect a `\d{4}-W\d{1,2}` filename → `repo_path = content/daily-updates/weekly/{basename}`, skip the date/staleness guard; (c) pass `is_weekly` to `validate_brief_content` so the light accepts `# WEEKLY LIGHT`; (d) don't fire the daily `trigger_publish_complete` for a weekly.

---

## Publish command (once deployed)
```
python scripts/publish-weekly.py 2026-W27          # publishes full + light → Vercel deploys the routes
# then, after #3 is wired:
curl -X POST "{SITE_URL}/api/publish/complete?weekly=2026-W27"   # weekly audio + email
```

## Verify
- `npm run type-check` (stays clean).
- `getWeeklyBySlug('2026-W26')` → title "The Capitulation", 8 sections (incl. `the-signal`, `the-predictions`).
- `getWeeklyLightBySlug('2026-W26')` → title "The Capitulation", 7 sections (incl. `our-calls`).
- Load `/weekly/2026-W26` and `/weekly-super/2026-W26` and eyeball the render (this is the one thing not yet visually confirmed).

## How it runs (cadence)
- **Sat 2 PM** `weekly-draft` → full Weekly, then Weekly Light (both generators).
- **Sat 8 PM** `weekly-critic` → v2 of both, emails Jackson. Hold model: silence ships Sunday.
- **Sun (zoom-out day 2026-07-05, then Sundays)** — daily intelligence + generation still run, but the daily is HELD; the Weekly + Light publish instead. `brief-morning` and `verify-brief-publish` read `Pipeline_Controller.md` and must honor the "THE WEEKLY" section (hold the daily, publish the weekly, treat no-daily as correct). The `weekly-critic` task summary still says "publish on reply" — the Controller overrides it, but confirm the tasks obey.
