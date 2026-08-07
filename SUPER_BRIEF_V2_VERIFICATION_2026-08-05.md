# Super Brief v2 (two-tier) — Verification Record

**Date:** 2026-08-05 evening · **Author:** Claude (Cowork session) · **For:** independent review before/after Cursor's push

This document is written so a **fresh reviewer with no prior context** can confirm the work is correct.
It states the mandate, exactly what changed, the re-runnable evidence, what is *not* verified, and a
checklist to re-verify independently. Ethos borrowed from `CURSOR_VERIFY_2026-08-05.md`: **receipts, not
assertions.** Every claim below has a command you can run.

Companion docs: `WORK_ORDER_SUPER_BRIEF.md` (the mandate), `HANDOFF_CURSOR_LIGHT_V2_WIRING.md` (the push
runbook), `SUPER_BRIEF_TWO_TIER_EXAMPLE_2026-08-05.md` (a full worked brief, both gates green).

---

## TL;DR

The Super Brief was converted from a one-tier selection format (5–7 stories, no length enforcement,
running ~2,200 words / 40% over spec and silently dropping 38–50% of the full brief's stories) to a
**two-tier** format: **THE UPDATE** = 4–5 deep stories, new **THE LINE** = every other full-brief story
as a one-liner, new **THE TAKE** = the dated call. A **word-count rail** was added to the format gate
(prints every run; blocks only inside the generator's own loop; the brief always ships). All consumers
were wired (parser, website viewer, email, audio, Substack, both gates). The generator spec and the live
task body were rewritten to the new structure and the correct 1,300–1,600 budget.

**Status:** code is staged in the working tree and **verified green on Jackson's machine** (tsc 0 errors,
eslint clean, audio regression 100% pass, archive exit-code parity identical). **Not yet pushed** — Cursor
does that per `HANDOFF_CURSOR_LIGHT_V2_WIRING.md`. Two human steps remain (Cursor push; Jackson places the
live `SKILL.md`). One check is unrunnable in the cloud sandbox (`npm run build`; real TTS audio).

---

## The mandate (from WORK_ORDER_SUPER_BRIEF.md)

- **Task 1** — add a word-count check to `scripts/brief-light-format-gate.ts`; target 1,300–1,600; print
  count + minutes every run; advisory > 1,600, blocking > 1,900 **only** under `--enforce-length`; never
  block publication; enforcement epoch = ship day onward; copy the `validate-brief.ts` `brief-length`
  pattern.
- **Task 2** — fold `system/Brief_Light_Generator_v2.md` into the live `system/Brief_Light_Generator.md`
  **in place** (preserve all earned rules); two-tier structure; the Signal takes a deep slot daily; the
  inviolable "length comes out of depth, never coverage" rule; the lede's three tests; correct the budget
  from 1,700–2,200 to 1,300–1,600.
- **Task 3** — update the live task body `~/Documents/Claude/Scheduled/brief-light/SKILL.md`; refresh the
  `system/task-bodies-snapshot/brief-light/SKILL.md` copy.
- **Task 4** — wire the two new sections across the consumers before flipping the format.

**Definition of Done:** (1) lands 1,300–1,600 and the gate says so; (2) every Six story + both Signal
ideas + the Take appear in a tier; (3) a length failure has never prevented publication; (4) the audio
has been listened to.

---

## What changed — file by file

### Tracked code (this is the push — 7 modified + 2 new)

| File | Change | Epoch-gated? |
|---|---|---|
| `scripts/brief-light-format-gate.ts` | **Task 1 word rail** (strip HTML comments → whitespace tokens; print count + min@160wpm every run; 🟡 outside 1,300–1,600, 🔴 > 1,900 blocks **only** under `--enforce-length`; `LENGTH-OVERRIDE` escape hatch). **Plus** the two-tier contract: requires `## ▸ THE LINE` + `## ▸ THE TAKE` and 4–5 deep stories for briefs dated ≥ epoch. THE STORY OF THE DAY stays **optional** (absent by design 40–60% of days). | `LIGHT_LEN_EPOCH='2026-08-06'`, `LIGHT_V2_EPOCH='2026-08-07'` |
| `scripts/brief-light-craft-gate.ts` | For v2 briefs: word band advisory-only (length has ONE enforcement home = the format gate); 4–5 deep stories; "The Take" removed from cross-product bans (the light now *has* one); the Daily-Title lede segment exempted from the repetition counter (it previews ≤4 items by design); a THE LINE item check. | `LIGHT_V2_EPOCH='2026-08-07'` |
| `lib/brief-light-parser.ts` | `sectionMetaFor`: explicit ids `the-line`, `the-take`. | n/a (backward-compatible) |
| `components/super-brief/SuperBriefViewer.tsx` | **New render blocks** for THE LINE (item run) and THE TAKE (dark card). Without this the site parsed the sections and rendered nothing. | n/a |
| `lib/email/render-brief.ts` | THE LINE renders as a compact item run (`renderLineItems`), not full paragraphs. | n/a |
| `lib/audio/text-preprocessor.ts` | `the-line`/`the-take` added to `LIGHT_SECTION_ORDER` (else they'd play *after* The Model), transitions, GPT per-section instructions, and `formatLineSectionForSpeech()` — a `...` beat between LINE items in **both** the GPT and faithful-voicing paths. | n/a |
| `lib/substack/post-builder.ts` | `SECTION_STRIPS` entries for the two sections. | n/a |
| `public/substack-section-the-line.png`, `-the-take.png` | New 1456×108 header strips, matched to the existing set. | n/a |

### Local-only (`system/`, gitignored — NOT pushed)

- `system/Brief_Light_Generator.md` — **edited in place.** Earned rules audited present after the fold-in
  (grep counts): NO NEW ATOMS ×8, NO MONOLITHS, anti-clustering, reach-forward, predictions-ledger,
  Counter_Case_Standard, at-most-twice, Craft Standard, Freshness, STANDALONE LEGIBILITY, Life Note,
  verbatim Daily Title. Budget corrected 1,700–2,200 → **1,300–1,600**. Backup:
  `system/Brief_Light_Generator.md.bak-pre-v2-20260805`.
- `system/task-bodies-snapshot/brief-light/SKILL.md` — refreshed to the two-tier body + a header note that
  it is a manual snapshot with no auto-sync.

### Outside the repo (Jackson, by hand)

- `~/Documents/Claude/Scheduled/brief-light/SKILL.md` — the **live task body** (delivered as a file in the
  session; the sandbox could not reach that folder). This is the file that actually flips generation.

---

## Verification evidence (re-runnable)

All of the following were run on **Jackson's machine** (device bridge) with the repo's real toolchain.

**1. Type + lint + audio regression — clean.**
```
npm run type-check        → exit 0, 0 error lines (full project, incl. the .tsx and the 128KB preprocessor)
npm run lint              → exit 0 (touched files)
npx tsx scripts/audio-gate-regression.ts   → "✅ ALL CHECKS PASS"
```

**2. Word rail never changes a publish-path exit (the "brief always ships" proof).**
Old gate vs new gate, exit code, last 10 lights + 3 June:
```
2026-06-10 SAME(1)  2026-06-15 SAME(1)  2026-06-20 SAME(1)   ← June: pre-existing missing-THE-CLOSE fail
2026-07-25 SAME(0)  2026-07-27 SAME(0)  2026-07-28 SAME(0)
2026-07-29 SAME(0)  2026-07-30 SAME(0)  2026-07-31 SAME(0)
2026-08-01 SAME(0)  2026-08-03 SAME(0)  2026-08-04 SAME(0)  2026-08-05 SAME(0)
```
The rail only *adds* a printed LIGHT LENGTH line; it never contributes to a non-zero exit at the publish
path. Measured lengths confirm the problem statement: June 1,500 / 1,520 / 1,604; July–Aug 2,045–2,298.

**3. The publish path never runs the light gates at all.**
```
grep -rn "brief-light-(format|craft)-gate" scripts/publish-brief.py scripts/publish-gate.sh \
     app/api/publish/complete/route.ts lib/distribute/handler.ts   → (none)
```
`publish-brief.py` validates the light only against `REQUIRED_SECTIONS_LIGHT = ["# BRIEF LIGHT"]` + a
500-byte floor. So the light gates run **only** inside the generation task's Step 4 — they cannot block a
morning publish even in principle. This is stronger than "length won't block."

**4. Two-tier example passes both gates in-band (device).**
```
scripts/brief-light-format-gate.ts SUPER_BRIEF_TWO_TIER_EXAMPLE_2026-08-05.md --enforce-length
  → ✅ LIGHT LENGTH: 1,596 words ≈ 10.0 min ; ✓ FORMAT GATE PASSED (TWO-TIER)  (5 stories)
scripts/brief-light-craft-gate.ts  <same> content/daily-updates/2026-08-05.md
  → ✓ CRAFT GATE PASSED  (1596 words, 0 em-dashes)
```

**5. Parser extracts the new sections, in order.**
```
ids: the-update, the-line, markets-minute, the-take, interesting-things, the-meditation, the-model, the-close
has the-line: true | has the-take: true
```

**6. Coverage — every full-brief story appears in a tier.** Token-probe of the example against the 08-05
full brief: **17/17 stories present** (lead/aviation, Hormuz, construction, AMD, Bitdeer, Aramco, crude,
JOLTS, Hyperliquid, ColdCard, BofA capex, icebreaker, AT&T copper, larkspur, Mars, raider ant, aquaculture/Take).

**7. Audio (deterministic parts).** Faithful voicing is the production default
(`lib/audio/light-generate.ts` `FAITHFUL_VOICING=true`). On the example: section order Update → **Line** →
Markets Minute → **Take** → Interesting → Meditation → Model → Close; **9 `...` beats for 9 LINE items**;
intro + outro sign-off audits PASS.

**8. Substack strips wired + graceful.** `app/api/substack/publish/route.ts` uploads
`${SITE_URL}/${SECTION_STRIPS[key]}` for each section label present; the two new keys resolve to the new
PNGs (valid 1456×108 RGB) once deployed, and `composeSubstackDoc` falls back to a text heading if a strip
is missing.

**9. No missed consumers.** Swept all 30+ files referencing the light or its section shape. Only these
hardcode section shape, and all are handled or benign: parser/viewer/email/audio/substack/gates (wired);
`lib/marketing/generate-daily-pack.ts` + OG route (read only THE UPDATE / title / lede, which persist);
`scripts/publish-substack.py` (renders sections generically); `thread-generator.ts` (marker-based);
`publish-weekly.py` (weekly is undated → pre-epoch → old contract, unchanged).

---

## Definition of Done — item by item

1. **Lands 1,300–1,600 and the gate says so** — ✅ example 1,596, format gate green; rail prints on every run.
2. **Every Six story + both Signal ideas + the Take in a tier** — ✅ 17/17 on the example; the task body, the
   generator, and the craft gate now each demand a per-day coverage diff. *(Caveat: verified on the worked
   example; the first real nightly generation is 8/7 and enforces this itself.)*
3. **A length failure has never prevented publication** — ✅ archive exit parity identical; the publish path
   never runs the gate; the task body now says "declare a LENGTH-OVERRIDE and save — never withhold."
4. **Audio listened to** — ⚠️ **partial.** Script + order + beats + intro/outro gates verified; a robotic
   espeak A/B was produced for rhythm. The real `gpt-4o-mini-tts` MP3 **could not** be generated (the cloud
   sandbox blocks `api.openai.com` egress; `device_bash` has no network). **One real dry-run listen is
   still owed** — assigned to Cursor post-push.

---

## What is NOT verified (honest gaps)

- **`npm run build`** (Next.js production build) — `tsc --noEmit` and ESLint pass on the `.tsx`, but the full
  build was not run in the sandbox. Cursor must run it; it's in the runbook.
- **Real audio acoustics** — see DoD #4. Deterministic checks pass; a human/real-TTS listen is owed.
- **A real nightly two-tier generation** — coverage/length were proven on a hand-built example, not on the
  live generator's output. The first real one (8/7) is the true end-to-end test; the gates + task body are
  set up to catch a miss.

---

## Open items / follow-ups

- **Cursor:** `npm run build`; commit the 9 files in 3 chunks; `git pull --rebase` (watch the two-histories
  brief-deletion illusion; clear a stale `.git/index.lock` if present); push. Then generate + **listen** to
  one real dry-run.
- **Jackson:** drop the delivered `brief-light-SKILL.md` into `~/Documents/Claude/Scheduled/brief-light/`
  **before Thu 8/6 ~8 PM ET** (the generation run for 8/7).
- **Decision open:** whether to regenerate tonight's old-format 8/6 draft as two-tier (only safe if the push
  deploys before Thu ~5:20 AM). Default: leave 8/6 as-is; 8/7 is the first two-tier issue.
- **Epoch note:** if 8/6 is regenerated as two-tier, roll `LIGHT_V2_EPOCH` back to `2026-08-06` in both gates.

---

## Independent re-verification checklist (for the reviewer chat)

Run these; every one should match the stated result.
```
# 1. compiles + lints + audio contract
npm run type-check && npm run lint
npx tsx scripts/audio-gate-regression.ts                       # ALL CHECKS PASS

# 2. the two-tier example passes both gates in-band
cp SUPER_BRIEF_TWO_TIER_EXAMPLE_2026-08-05.md /tmp/2026-08-07-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/2026-08-07-light.md --enforce-length   # PASS ~1,596
node --experimental-strip-types scripts/brief-light-craft-gate.ts  /tmp/2026-08-07-light.md content/daily-updates/2026-08-05.md   # PASS

# 3. word rail is advisory-only at the publish path across the archive (exit unchanged vs before)
for f in content/daily-updates/2026-0{6,7,8}-*-light.md; do \
  node --experimental-strip-types scripts/brief-light-format-gate.ts "$f" >/dev/null 2>&1; echo "$? $f"; done
#   → June files exit 1 (pre-existing missing THE CLOSE), July/Aug exit 0. No file's exit changed.

# 4. publish path cannot block on the light gate
grep -rn "brief-light-format-gate\|brief-light-craft-gate" scripts/publish-brief.py scripts/publish-gate.sh   # (none)

# 5. earned rules survived the generator fold-in (local-only file)
grep -c "NO NEW ATOMS" system/Brief_Light_Generator.md                 # ≥ 1
grep -c "1,700-2,200\|5-7 stories" system/Brief_Light_Generator.md     # 0  (old budget gone)
```
**Adversarial target** (worth breaking): the craft gate's repetition exemption keys the lede segment by
the **Daily Title** string. If a light's Daily Title is empty, or collides with a section name, the
exemption could over- or under-fire. Try to construct a light that makes it wrong.

---

## Deploy timeline & the two flips

Two independent flips on two clocks:
- **Generation** (evening, local files): the live `SKILL.md` + generator decide whether the draft *has* the
  tiers. Deadline: the new `SKILL.md` in place before **Thu 8/6 ~8 PM ET**.
- **Rendering** (morning publish/deploy, pushed code): decides whether the surfaces *show* them. Deadline:
  the push deployed before **Fri 8/7 ~5:20 AM ET** (when the first two-tier brief, 8/7, publishes).

The code is backward-compatible, so shipping it early renders old-format briefs fine. Thursday's 8/6
publish is old-format regardless (it was generated tonight, pre-flip).

---

## Addendum — THE LINE spoken cues (follow-up, later on 2026-08-05)

After the push, THE LINE audio was strengthened. A pause alone risked sounding like a recited list,
because story *sections* get a spoken transition **and** a `...` beat while the LINE one-liners only got
the beat. Fix: each item after the first now gets a short **rotating spoken cue** (Next / Also / Then /
Elsewhere / One more / On a different front) right after the beat, so the boundary is *heard*, not just
paused — the treatment sections already get. **Audio-only**: `formatLineSectionForSpeech()` is called only
in the audio preprocessor, so the website and email render the items unchanged.

Files (a small follow-up commit on top of `fb0a1e3`):
- `lib/audio/text-preprocessor.ts` — `LINE_ITEM_CUES` + the cue logic in `formatLineSectionForSpeech()`.
- `scripts/audio-gate-regression.ts` — test now asserts every item keeps a beat AND a cue between them.

Verified: full `tsc --noEmit` exit 0; `audio-gate-regression` → ALL CHECKS PASS; the real example's LINE
transcript shows the eight cues rotating with no adjacent repeat, item 1 cue-less (the section lead-in
introduces it). **Still owed:** one real ash-voice dry-run listen — the only remaining human check, and
now the whole point of generating it.
