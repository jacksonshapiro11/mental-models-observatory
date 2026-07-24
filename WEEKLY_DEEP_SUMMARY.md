# The Weekly + Weekly Light — Deep Build Summary

Context for a fresh chat. This is the full picture of two new products added to the Mental Models Observatory (cosmictrex.com, "Markets, Meditations & Mental Models"): **The Weekly** and its super brief, the **Weekly Light**. Covers the editorial system (the hard part), the content contracts, the code, the pipeline, and the current state.

---

## 1. What the products are

**The Weekly** is the daily brief at a week horizon. Not a recap, not a digest, the *same product* as the daily (the biggest stories with good analysis) zoomed out to a week: the week's biggest stories, in full breadth across every domain, each told at week-view (the seven-day arc plus where it is pointed now), in the daily's exact form and voice. Masthead → Life Note → Week-of date → Title → narrative lede → THE DASHBOARD → THE SIX (Markets & Macro, Companies & Crypto, AI & Tech, Geopolitics, The Wild Card) → THE SIGNAL → THE TAKE → THE PREDICTIONS → INNER GAME → THE MODEL → DISCOVERY. Roughly 4,800–5,500 words, ~30–35 min audio.

**The Weekly Light** is the Weekly's super brief, exactly as the daily "Brief Light" is to the daily: story-of-the-week lede, a 6–7 story week-view breadth scan (THE UPDATE), MARKETS MINUTE, INTERESTING THINGS, a compressed **OUR CALLS** predictions nod, then the soul sections (Meditation, Model, Close). ~2,000–2,600 words, ~12 min.

Both publish **Sunday** as the single "zoom-out" product; the daily is held that one day (see pipeline).

---

## 2. The editorial system (the hard-won core — do not regress this)

These principles were converged over many iterations and are the actual value. A fresh session should treat them as load-bearing.

- **NO NEW ATOMS.** Every derivative product (daily light, the Weekly, the Weekly Light) only *selects, compresses, and reframes* its source; it never introduces a fact, number, superlative, or call the source did not make. The Weekly traces to the seven full daily briefs; the Weekly Light traces to the published Weekly. This makes QA cheap (verify provenance, not truth).

- **THE UNIT GATE — every story must be consequential AND differentiated.** Consequential = structurally big beyond the week (loud ≠ big; a clever constructed angle ≠ a big story). Differentiated = no two stories are the same trade, theme, or mechanism. Breadth comes from distinct big stories, never from padding a section with one theme. The three failure modes: (a) the same trade told three ways (a rate repricing shows up in the front end, the curve, gold, the dollar — that is ONE story with the rest as *tells*, not four); (b) thematically adjacent stories that should merge; (c) the random/minor story (cut it, free the slot for a real one).

- **WEEK-VIEW, NOT A DAILY SNAPSHOT.** Each story is the week's *arc* (how it moved across seven days) plus "**what it changes**", how the development changes the event itself and the situation it affects, stated concretely and outward (not "how our view shifted"). Lifting a daily summary in is the "recap trap" failure.

- **RECAP OVER DELTA.** The product is the big stories told well. The "change"/delta lives *inside* the stories (a genuine change just *is* one of the big stories), NOT as a separate meta-layer. We explicitly rejected a "how our worldview changed" section, a trend-synthesis "through-line" open, and a "models in motion" instrument-check. That over-intellectualizing (adding smart meta-frames that colonize the product) is the specific reflex to resist. The lede names the week's big changes plainly; that is enough.

- **NORMAL BRIEF VOICE, NO TEMPLATES.** Varied claim headlines like the daily's Six ("The Cut Got Priced Out in Five Sessions"). BANNED: the "The week..." headline template and any labeled "Outlook:" section — the forward read is woven into the prose and ends the bullet naturally.

- **BALANCE / NO COLONIZATION.** No single thread (usually AI) takes over the issue. It can lead the *narrative* in the intro if earned, but the body and especially the predictions stay broad.

- **NO DUPLICATES / SINGLE-HOME.** Each story has one home. The Take's subject is not also a Six bullet.

- **NO EM-DASHES (zero tolerance — the #1 AI tell).** En-dash "–" for attributions, colons/commas elsewhere.

- **PREDICTIONS = A CONVICTION BOOK.** One standing call per horizon (next week / next month / next year), spanning domains, each with one direction, a date/window, and a single pre-registered **kill switch**. Each issue runs a **look-back** (grade every due call HIT/MISS/OPEN with the receipt) then **the book** (make/carry the calls). Append-only ledger; restate a call only when conviction actually moves; at least one call specific enough to embarrass us if wrong; no hedged calls. "Silence ships" hold model. The existing ledger (W0–W26, ~50 graded calls with a running tally) was KEPT, not reset — going "lean" (one open call per horizon) from here, legacy calls graded on their clocks.

---

## 3. Content contracts (the generators + calibration examples) — internal `system/`, never committed

- `system/Weekly_Generator.md` — the long prompt for the full Weekly. Encodes everything in §2, reads the seven full daily briefs as input, and inlines a gold-standard example. Replaced an older heavy "predictions-deep-dive" weekly (archived in `system/zzOld/`).
- `system/Weekly_Light_Generator.md` — the long prompt for the Weekly Light. Same `## ▸` header engine as the daily Brief Light plus one section (OUR CALLS). Inlines its own gold-standard example.
- `system/Weekly_Predictions_Ledger.md` — the append-only conviction book (kept from before; example calls reconciled to it).
- `daily-briefs/2026-W26-weekly-EXAMPLE.md` and `daily-briefs/2026-W26-weekly-light-EXAMPLE.md` — the calibration references (week of June 21–27, 2026, title "The Capitulation"). The full example: 12 distinct stories (Markets & Macro 2, Companies & Crypto 4, AI 2, Geopolitics 2, Wild Card 2), Signal = housing supply cliff + grain-oriented electrical steel, Take = "Plaza 2.0" (G-7 currency lever), predictions = oil/geo, MiCA/crypto, AI-policy.

**The machine-readable header contracts** (the parser and audio key off these exact markers):
- Full Weekly: `# MARKETS, MEDITATIONS & MENTAL MODELS: THE WEEKLY`, `## Week of ...`, `### {Title}`, then `# ▸ THE DASHBOARD`, `# ▸ THE SIX`, `# ▸ THE SIGNAL`, `# ▸ THE TAKE`, `# ▸ THE PREDICTIONS`, `# ▸ INNER GAME`, `# ▸ THE MODEL`, `# ▸ DISCOVERY`.
- Weekly Light: `# WEEKLY LIGHT`, `## Week of ...`, `### {Title}`, then `## ▸ THE UPDATE`, `## ▸ MARKETS MINUTE`, `## ▸ INTERESTING THINGS`, `## ▸ OUR CALLS`, `## ▸ THE MEDITATION`, `## ▸ THE MODEL`, `## ▸ THE CLOSE`.

---

## 4. Website + audio code (committable app code; VERIFIED: `tsc --noEmit` clean, both examples parse)

Design principle: the weekly REUSES the daily engines, plus the new sections.
- **Full Weekly** reuses the daily parser + viewer, adds two sections:
  - `lib/daily-update-parser.ts` — added `# ▸ THE SIGNAL` (`the-signal`) and `# ▸ THE PREDICTIONS` (`the-predictions`) to `SECTION_DEFS` and the type union; added `getWeeklyBySlug` / `getAllWeeklySlugs` / `resolveWeeklyFile` (read `content/daily-updates/weekly/`).
  - `components/daily-update/BriefViewer.tsx` — renders `the-signal` (generic) and `the-predictions` (The-Take prose treatment) + styling.
  - `app/weekly/[slug]/page.tsx` (new) — route, reuses `BriefViewer`.
- **Weekly Light** reuses the daily super-brief engine, adds one section:
  - `lib/weekly-light-parser.ts` (new) — `getWeeklyLightBySlug` / `getAllWeeklyLightSlugs`; wraps `parseBriefLight`.
  - `lib/brief-light-parser.ts` — added `## ▸ OUR CALLS` (`our-calls`); hardened the header scan to skip HTML comment lines (fixed a real bug: the weekly-light title parsed empty because a calibration comment contained "## ▸").
  - `components/super-brief/SuperBriefViewer.tsx` — renders OUR CALLS; added optional `fullBriefBasePath` / `selfBasePath` props defaulting to the daily paths (daily super brief unchanged), overridden to `/weekly` and `/weekly-super`.
  - `app/weekly-super/[slug]/page.tsx` (new) — route, reuses `SuperBriefViewer`.
- **Audio**: `lib/audio/text-preprocessor.ts` — `WEEKLY_AUDIO_SECTIONS` (adds THE SIGNAL + THE PREDICTIONS), an `isWeekly` branch, and `our-calls` in the light path. The daily audio is unchanged (Signal stays omitted there). Verified: with `isWeekly`, the extraction includes Predictions + Signal text.
- **Publisher**: `scripts/publish-weekly.py` (new) — publishes both weekly files (validates required sections + em-dash ban; robust clone-to-/tmp push). Dry-run tested. Built as a sibling of the daily `publish.py` because the interactive agent can't edit files under `.claude/`.

Slug/paths: full `content/daily-updates/weekly/{YYYY-Www}-{mon-dd-dd}.md` → `/weekly/{YYYY-Www}`; light `content/daily-updates/weekly/{YYYY-Www}-light.md` → `/weekly-super/{YYYY-Www}`. Slug = ISO week id (e.g. `2026-W27`).

---

## 5. The pipeline (`system/Pipeline_Controller.md`, loaded first by every scheduled task)

Added a "THE WEEKLY" section encoding:
- **Cadence.** Sat 2 PM `weekly-draft` runs the full Weekly generator then the Weekly Light generator (both products). Sat 8 PM `weekly-critic` reviews both, produces v2, emails Jackson.
- **Hold model (silence ships).** Not gated: if Jackson replies with edits they're applied, otherwise both publish by default Sunday. This supersedes the old "calibration: publish only on reply."
- **ZOOM-OUT DAY = 2026-07-05 (then every Sunday once proven).** On a zoom-out day the daily intelligence + generation still run (they feed the worldview and next week's Weekly), but the daily is HELD (not published). `brief-morning` publishes the approved Weekly + Light instead of the daily; `verify-brief-publish` verifies `/weekly/{slug}` and fires weekly audio and treats "no daily today" as correct (not a self-heal trigger). Fail-safe: the held daily is kept, so if the weekly publish fails the daily can still go out. Self-reverting: single date; Monday the daily resumes.
- **Publish commands.** `python scripts/publish-weekly.py {slug}` then `POST {SITE_URL}/api/publish/complete?weekly={slug}`.

---

## 6. Current state — done vs remaining

**DONE and verified:** all content (both generators + both calibration examples + the reconciled ledger); the full website + audio-rendering code (routes, parsers, viewers, audio section-handling) with `tsc --noEmit` clean and both W26 examples parsing with all sections; the weekly publisher (dry-run tested); the Controller orchestration.

**REMAINING (handed to Cursor, which has full repo access and can run the audio):**
1. **Deploy the code** (commit the app files above; do not commit `system/` or `daily-briefs/`). Delete two throwaway test files at repo root: `__wk_test.ts`, `__weekly_parser_selftest.ts`.
2. **Archive the old `2026-W12` weekly** (`content/daily-updates/weekly/2026-W12-mar-16-22.md`) — it's the retired recap format and renders title-less through the new parser.
3. **Wire `/api/publish/complete` for weekly audio + email.** This REUSES the daily audio/email code; only the callers hardcode the daily date. Thread a weekly slug + `isWeekly` through: `app/api/publish/complete/route.ts` (accept `?weekly={slug}`, use the weekly getters), `lib/audio/full-generate.ts` + `lib/audio/light-generate.ts` (read the weekly path, pass `isWeekly` — the preprocessor already supports it), `lib/audio/podcast-feed.ts` (weekly episode keyed by slug), `lib/distribute/run-if-needed.ts` (weekly email). Untestable in the sandbox (GPT-4o + TTS + live email); watch the first run.

**Not yet visually confirmed:** the actual on-page render of `/weekly/{slug}` and `/weekly-super/{slug}` (data + compile are proven; pixels are not). A preview deploy or the first live push is the way to confirm "displayed well."

---

## 7. Key file map

| File | Role | Committable? |
|---|---|---|
| `system/Weekly_Generator.md` | Full weekly generator (prompt + inlined example) | No (internal) |
| `system/Weekly_Light_Generator.md` | Weekly-light generator (prompt + inlined example) | No (internal) |
| `system/Weekly_Predictions_Ledger.md` | Conviction book (append-only) | No (internal) |
| `system/Pipeline_Controller.md` | Orchestration: hold model, zoom-out day, publish | No (internal) |
| `daily-briefs/2026-W26-weekly-EXAMPLE.md` | Full calibration example | No (internal) |
| `daily-briefs/2026-W26-weekly-light-EXAMPLE.md` | Light calibration example | No (internal) |
| `lib/daily-update-parser.ts` | Full parser + weekly getters + Signal/Predictions | Yes |
| `lib/weekly-light-parser.ts` | Weekly-light getters | Yes |
| `lib/brief-light-parser.ts` | Light parser + OUR CALLS + comment-skip fix | Yes |
| `components/daily-update/BriefViewer.tsx` | Renders Signal + Predictions | Yes |
| `components/super-brief/SuperBriefViewer.tsx` | Renders OUR CALLS + base-path props | Yes |
| `app/weekly/[slug]/page.tsx` | Full weekly route | Yes |
| `app/weekly-super/[slug]/page.tsx` | Weekly-light route | Yes |
| `lib/audio/text-preprocessor.ts` | WEEKLY_AUDIO_SECTIONS + isWeekly + our-calls | Yes |
| `scripts/publish-weekly.py` | Weekly publisher (both files) | Yes |
