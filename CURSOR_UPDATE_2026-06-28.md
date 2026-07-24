# Super Brief Restore + Related Fixes — Update for Cursor (2026-06-28)

This closes the loop on the "Super Brief Product Direction" conversation. The product-shape question is resolved, the generator is rebuilt, craft enforcement is added to the light brief, the website archive got a brief/super-brief toggle, and a separate morning-email double-send bug was diagnosed, fixed, and deployed. Full state below.

---

## 1. Product direction — RESOLVED

**Decision: restore the pre-ideas-first selection format, refined. The 3-idea tournament is retired.**

Diagnosis, with proof — the ideas-first switch (2026-06-20) didn't shorten the brief, it *narrowed* it:
- `2026-06-18-light.md` (old selection): ~1,610 words, **6 stories across 6 domains** (Fed, Iran, EU crypto, JPMorgan/AI, gold, Nuvei), each `fact → structural read → turn`, under a causal story-thesis lede ("signal detachment").
- `2026-06-27-light.md` (ideas-first): ~1,714 words, **3 deep idea-essays + one "Also Moving" paragraph** — Taiwan demoted to a footnote, The Take dropped entirely.
- Same length, half the world. Length was never the problem; allocation/aperture was.

**The model is two jobs:**
1. **Story-thesis of the day** — one defining story plus the causal "why the world moved," written to the 06-18 bar. Makes the Daily Title legible.
2. **Breadth scan** — 5-7 other highest-leverage stories across domains, each with our angle and a "turn" (the tell / the "but maybe"), not wire headlines. One cross-story synthesis is allowed *when the day genuinely supports it*, but it's one slot inside breadth, never the whole product.

**Core invariant — NO NEW ATOMS.** The super brief is a lossy compression of the full brief: it may select, compress, and reframe; it may never introduce a fact, number, superlative, or call the full brief didn't make. Markets Minute is derived only from the Dashboard. This structurally removes the Markets Minute drift, false superlatives, and title-content disconnects that hit the ideas-first version.

Reference example: `content/daily-updates/2026-06-18-light.md`. Both prior specs are archived in `system/zzOld/` (`Brief_Light_Generator_2026-06-20_pre-ideas-first.md` and `Brief_Light_Generator_ideas-first_wip.md`).

---

## 2. Files changed

**Generation pipeline** (`system/` is gitignored + loaded at runtime; `scripts/` is committable):
- `system/Brief_Light_Generator.md` — **rewritten.** Story-thesis lede, 5-7 story breadth, no-new-atoms spine, one-synthesis rule, signal-vs-noise invalidations logged to the predictions ledger, and an **extended Meditation** (carries the full Inner Game, not the old 50-100 word compression — this was the one explicit content change requested).
- `system/Brief_Light_Critic.md` — **NEW.** Judgment pass: story-thesis lede, breadth/anti-monolith, the three Craft Standard tests per story, no-new-atoms (claims + superlatives), title coherence.
- `scripts/brief-light-format-gate.ts` — **UPDATED to be format-aware.** It previously only accepted ideas-first headers (`THE IDEAS` / `ALSO MOVING`); a restored selection brief (`THE UPDATE`) would have **failed at publish**. Now detects the format from the lead header and asserts the matching contract for both.
- `scripts/brief-light-craft-gate.ts` — **NEW.** Mechanical, blocks ship on: em-dashes, word budget (1,700-2,200), story count (5-7), 4-sentence Markets Minute, banned filler. Plus a NO-NEW-ATOMS number-provenance check that diffs every load-bearing figure against the full brief (`node ... brief-light-craft-gate.ts <light.md> <full-brief.md>`).
- `system/Pipeline_Controller.md` — the evening `brief-light` row updated to run format gate → craft gate → critic inline.
- `daily-briefs/2026-06-27-light-NEWSPEC.md` — **proof.** 06-27 regenerated under the new spec (~2,000 words, 6 stories / 6 domains, both gates pass, zero orphan numbers). Includes the two-catalyst KOSPI fix: the Asian semiconductor rout (Samsung/SK Hynix −12%, KOSPI −5.8%) then the OpenAI IPO-delay rumor in the US session.

**Website** (committable, needs a deploy to show on the live site):
- `lib/brief-light-parser.ts` — added `getAllBriefLightDates()`.
- `app/archive/page.tsx` — loads both full + super-brief archives, passes both to the client.
- `components/archive/ArchiveClient.tsx` — **NEW Brief / Super Brief toggle.** Switching swaps the list; search and month filters operate on the active set; cards link to `/daily-update/[date]` or `/super-brief/[date]` with matching badges.
- `app/api/distribute/route.ts` — email double-send fix (see §4).

---

## 3. Pipeline & compatibility (no new task, no backfill)

- The evening `brief-light` task loads `system/` at runtime, so it picks up the rewritten generator and runs the gates + critic **inline**. **No new scheduled task** (Pipeline Controller Rule 13: skills compound, tasks trigger). The task's scheduler description metadata still says "5-7 min" — cosmetic only; substance comes from the generator.
- Website renderer (`SuperBriefViewer.tsx`) already branches on `the-update` (commented "legacy selection format"); audio (`lib/audio/light-generate.ts`) feeds **every** parsed section to TTS with no hardcoded ideas-first list. Both already handle the selection format. **No backfill, and no render/audio push needed.** Old ideas-first briefs and new selection briefs coexist.
- First brief under the new spec: the 2026-06-28 edition.

---

## 4. Email double-send — FIXED & DEPLOYED

**Root cause:** two Vercel crons (`vercel.json`, times in UTC; EDT = UTC−4):
- `/api/distribute` → `0 11 * * *` = **7:00 AM ET** (main send)
- `/api/distribute/retry` → `0 12,14 * * *` = **8:00 AM & 10:00 AM ET** (retries)

The 7am `/api/distribute` sent the newsletter but never wrote `distribute:log:{date}` (neither the route nor `runDistribute` called `writeStepLog`). The 8am retry uses `stepFailed = !entry || status === 'failed'`, so a *missing* entry counted as failed → it re-sent to the whole list. The 8am run then wrote the log, which is why the 10am retry correctly skipped. Net effect: two sends, 7am + 8am.

**Fix:** `app/api/distribute/route.ts` now writes the send outcome via `writeStepLog` after `runDistribute` (mirrors the retry route). The 8am retry now sees `email: success` and skips.

**Deployed:** commit `e5395ef` on `main` (Vercel auto-deploys). Pushed via a fresh `/tmp` clone because the local checkout had a stale `.git/index.lock` and the published briefs are write-protected; only `app/api/distribute/route.ts` changed on `main`.

**Caveat:** this fixes the everyday double-send (normal all-success case). One edge remains, pre-existing and separate: a *partial-failure* send makes the retry re-send to everyone, not only the failed recipients.

---

## 5. Deployment state & open items

**On `main` (deployed):**
- `5d1c8aa` — archive full/super-brief toggle + light-brief gate scripts + `getAllBriefLightDates`.
- `e5395ef` — email double-send fix.

**Local-only (not committed):** all `system/` docs (gitignored, runtime-loaded) and the `daily-briefs/2026-06-27-light-NEWSPEC.md` proof.

**Open / follow-ups:**
- The published `content/daily-updates/2026-06-27-light.md` is still the old ideas-first version — the new one is a draft proof, the published file was not overwritten. Decide whether to replace it.
- Cosmetic copy: the TTS voice instruction in `lib/audio/light-generate.ts` still says "ideas-first"; the `/super-brief` page copy says "3 minutes" (now ~10).
- The everyday email double-send is fixed; the partial-failure retry-resends-all behavior is still open.
- Stale `.git/index.lock` in the local checkout couldn't be removed (permission) — `rm -f .git/index.lock` locally if git feels stuck.
