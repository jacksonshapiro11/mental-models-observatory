# WORK ORDER — Weekly Light: two-tier conversion (BUILT — awaiting flip)

> **Status: BUILT 2026-08-06 · GATES PUSHED same day (`8d160a4`, Cursor-verified) · INERT until
> WEEKLY_V2_EPOCH = `2026-W33`.** The gate code is on `origin/main`; the edited generator, updated
> task-body snapshot, and the verified worked example are on disk (generator/snapshot are gitignored
> local files; the example + docs await their own commit). Nothing weekly is live: no `YYYY-W##-light.md`
> dated ≥ W33 exists, so both gates read every current weekly against the OLD selection contract (proven:
> 120-file archive exit parity, 0 changes). "Implement" = mirror Step 5b into the live weekly-draft task
> body at flip time, then let the first W33+ weekly flip.
> Written by Claude (Cowork), same template as `WORK_ORDER_SUPER_BRIEF.md` (daily, executed 2026-08-05).
> Full receipts: `WEEKLY_TWO_TIER_VERIFICATION_2026-08-06.md`. **You need no prior context.**

**Repo:** `/Users/jackson/Desktop/mental-models-observatory`
**Built artifacts (in the working tree now):**
- `scripts/brief-light-format-gate.ts`, `scripts/brief-light-craft-gate.ts` — **tracked; the push.** Weekly epoch + bands + positional lede fix.
- `SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md` — the worked example (repo root), both gates green in-band at 2,296 words, NO-NEW-ATOMS clean vs the W31 full weekly.
- `system/Weekly_Light_Generator.md` — **edited in place** (gitignored, local-only); backup `…​.bak-pre-v2-20260806`.
- `system/task-bodies-snapshot/weekly-draft/SKILL.md` — updated snapshot (Step 5b: generate two-tier light + gate it).

**Decisions locked (were D1-D4, now resolved):** no THE TAKE (OUR CALLS is the calls home) · length 2,000-2,400 / 2,700 hard · deep tier 4-5 with the contrarian catch holding a slot · **epoch `2026-W33`** · **THE LINE band 9-16** (a real curated week yields ~9-14 residue items, below the daily's per-day count; W31 material produced 9).

---

## FLIP CRITERIA (the code is built; this is when to turn it ON)

The build is done. Flip (commit + push the gates, place the live generator/task-body edits) only after:
**(1)** ≥3-5 consecutive daily two-tier issues shipped with both gates green and no manual rescue,
**(2)** one real TTS episode listened end-to-end and THE LINE cadence confirmed acceptable (the weekly
runs 9-16 line items vs the daily's ~9 — more list to get through, so the rotating cue matters more),
**(3)** no craft-gate false blocks logged on the dailies. The epoch is already `2026-W33`; if the flip
slips past that week, bump `WEEKLY_V2_EPOCH` in BOTH gates to the first un-generated ISO week so no
already-written weekly is retroactively judged by the new contract. Then:
- ✅ **DONE 2026-08-06:** the two gate files are pushed (`8d160a4`, Cursor-verified: 120-file archive parity
  0 diffs, both examples green, positional-lede matrix confirmed, Take-ban regression confirmed) — the daily
  positional lede fix is therefore already live; the weekly contract stays inert until a W33+ file exists;
- place the edited `system/Weekly_Light_Generator.md` (already in the tree) and mirror the `weekly-draft`
  Step 5b edit into the LIVE task body at `~/Documents/Claude/Scheduled/weekly-draft/SKILL.md` (outside the
  repo — the same hand-placement the daily `brief-light` SKILL.md needed);
- generate the first W33 weekly to a scratch path, run both gates + the coverage diff, read it, listen.

Tasks 1-4 below are the record of what was built (all DONE) and the verification to re-run.

---

## THE PROBLEM IN ONE PARAGRAPH

The weekly light (`content/daily-updates/weekly/{YYYY}-W{NN}-light.md`, generated Saturdays by the
`weekly-draft` task per `system/Weekly_Light_Generator.md`) is the daily light's v1 format plus OUR CALLS:
~6-7 selected stories, full treatment or nothing. Measured: **W30 = 2,399 words, W31 = 2,398 words — one
and two words under the craft gate's 2,400 hard ceiling.** It is being written *to the bound*, and the
rest of the week's stories evaporate exactly the way the daily's did (the failure the daily two-tier fixed
on 08-05: 38-50% of stories silently dropped). A week has more residue than a day; the breadth tier is
worth more here, not less.

---

## ALREADY PAID FOR — the daily conversion did the consumer work. Receipts:

- **Parser:** `lib/weekly-light-parser.ts` is a shim that delegates section mapping to
  `lib/brief-light-parser.ts` `sectionMetaFor`, which already maps `the-line` / `the-take` (and `our-calls`).
- **Website:** `SuperBriefViewer.tsx` renders both lights; THE LINE item-run + THE TAKE card blocks shipped 08-06.
- **Audio:** `lib/audio/light-generate.ts` imports `getWeeklyLightBySlug` from the same shim;
  `LIGHT_SECTION_ORDER` in `text-preprocessor.ts` already orders `the-line` (after the-update) and
  `the-take` (after markets-minute), with `our-calls` after interesting-things; `formatLineSectionForSpeech()`
  beats are regression-tested (`scripts/audio-gate-regression.ts` check 10); `WEEKLY_SIGN_OFF` outro gate intact.
- **Email / Substack:** `render-brief.ts` `renderLineItems` keys on section id; `SECTION_STRIPS` already
  has THE LINE / THE TAKE / OUR CALLS PNGs; `composeSubstackDoc` falls back to a text heading if a strip is missing.
- **Publish path:** `publish-weekly.py` treats `-light.md` generically; no section-shape coupling.

**Net: zero consumer changes. The conversion is gates (Task 1, the only push) + generator (Task 2, local)
+ task body (Task 3, local) + a worked example (Task 4).** Notably, a two-tier weekly inside the 2,000-2,400
band would have passed even the OLD selection gates (v1 bounds 1,500-2,400, 4+ deep stories) — the gate work
(now pushed, `8d160a4`) makes the contract *explicit* rather than unblocking the flip, and the generator's
pre-W33 STOP guard is what prevents an accidental early flip in the meantime.

---

## THE STRUCTURE (defaults; Decisions D1-D3 below)

| Section | Words | Change |
|---|---|---|
| header + lede (Title verbatim from the full Weekly) | ~100-130 | unchanged; three-tests + written-LAST rule imported from the daily generator |
| `## ▸ THE UPDATE` | **4-5 deep × ~145** | was ~6-7 × ~170. The week's strongest contrarian catch (Signal-class) holds one slot |
| **`## ▸ THE LINE`** | **9-16 × ~36** | **NEW** — every other full-Weekly story; the week's residue, ordered by consequence |
| `## ▸ MARKETS MINUTE` | 75-90 | unchanged (week-view read) |
| `## ▸ OUR CALLS` | 120-180 | unchanged — **remains the calls home** (grades + next week/month/year); no separate THE TAKE (D1) |
| `## ▸ INTERESTING THINGS` | 1 × ~95 + 2 × ~36 | unchanged; own line tier; MAIN-STORY routing test stays |
| `## ▸ THE MEDITATION` · `THE MODEL` · `THE CLOSE` | ~330 | unchanged; MODEL keeps `### [Model Name]` header |
| **TOTAL** | **2,000-2,400** (~13-15 min) | was pinned at ~2,398-2,399; hard ceiling 2,700 (D2) |

**THE INVIOLABLE RULE carries over verbatim: length comes out of depth, never coverage.** Cut order:
shorten LINE items toward the ~36 floor → shorten already-covered sections → move a deep item to THE LINE.
Dropping a story is last and needs a logged reason.

---

## TASK 1 — Gates learn W-dates (the ONLY tracked-code change; commit + push)

**Files:** `scripts/brief-light-format-gate.ts`, `scripts/brief-light-craft-gate.ts`.

1. Add alongside `briefDateFromPath` in both gates:
   `weeklyFromPath(file)`: match `/(\d{4}-W\d{2})-light\.md$/` → `'2026-W31'` style key, `''` if no match.
   `const WEEKLY_V2_EPOCH = '2026-W33';` (as pushed). `isWeeklyV2 = wk !== '' && wk >= WEEKLY_V2_EPOCH`
   (string compare is safe within a century; keep it in sync across both gates, same as `LIGHT_V2_EPOCH`).
   **As pushed in `8d160a4`, `weeklyFromPath` also normalizes single-digit slugs (`2027-W7` → `2027-W07`)
   and rejects week numbers outside 1-53** — Cursor found other weekly consumers accept unpadded slugs,
   which would have silently evaded the epoch (the fail-open class this repo hunts).
2. **Format gate:** add `WEEKLY_V2_REQUIRED` = Update · **Line** · Markets Minute · **Our Calls** ·
   Interesting Things · Meditation · Model · Close (no TAKE per D1). Deep-story bounds 4-5 (fail <4, warn >5);
   reuse the existing THE LINE item check. Undated scratch files stay pre-epoch: measured, never failed.
3. **Craft gate:** for `isWeeklyV2` — word band advisory 2,000-2,400 (enforcement stays in the
   format gate under `--enforce-length`, hard 2,700: ONE home per rule); deep bounds 4-5; lede-segment
   repetition exemption extended to weekly-v2. 🔴 **Do NOT blanket-reuse `isV2` for the cross-product ban:**
   the daily v2 lifted the "The Take" ban because the daily light *has* one; the weekly light does NOT (D1),
   so the ban must stay active for weekly-v2. Split the flag (`isDailyV2` / `isWeeklyV2`) where the
   `CROSS_PRODUCT_REFS` list is built.
4. **Fold in the lede-exemption hardening** (from the 08-06 adversarial verification): key the repetition
   exemption by *position* — the segment between the date line and the first `## ▸` header — instead of by
   Daily-Title string match. Demonstrated failure modes of the current name-keying: a title that is a
   substring of a section name (e.g. "The Line") silently exempts that whole section (under-fire); an empty
   title drops the exemption and blocks a legitimate lede (over-fire). Fixing it here covers both lights at once.

**Verify (mirror the 08-05 method):** old-gate-vs-new A/B across `content/daily-updates/weekly/*-light.md`
AND all 62 daily lights — **zero exit-code changes** (every archive file is pre-epoch by date). Then a
worked two-tier example copied to `/tmp/{WEEKLY_V2_EPOCH}-light.md` passes both gates in-band, and the same
content at `/tmp/2026-W30-light.md` (pre-epoch name) is judged by the old contract.

## TASK 2 — `system/Weekly_Light_Generator.md`: edit IN PLACE (gitignored, no push)

Same discipline as the daily fold-in: **do not restate the file; change only what the structure table
requires.** Back up first (`.bak-pre-v2-{date}`). Earned rules that must survive — audit by grep after:
Title **verbatim** from the full Weekly (shared episode name) · OUR CALLS format (grades + week/month/year,
one line each) · INTERESTING THINGS MAIN-STORY routing test + 2-3 differentiated bold-led items ·
THE MODEL `### [Model Name]` header + Explore link verbatim · STANDALONE LEGIBILITY (no full-only-section
references — the W27 "Take's call" incident) · no em-dashes, zero tolerance · Craft Standard three tests ·
NO NEW ATOMS (everything traces to the published full Weekly). Import from the daily generator: the
deep-tier consequence × contestability ranking + "conclusion is falsifiable or it's a line item" · THE LINE
item shape (bold conclusion-first headline + one sentence, one scaled fact + one implication, ~36-word
floor) · the lede three tests + written-LAST + yields-to-OUR-CALLS'-idea · the cut-order rule.

## TASK 3 — `weekly-draft` task body (live + snapshot)

The body is already thin (it defers to the generator — keep it that way). Two changes:
1. OUTPUT CONTRACT line: "Weekly Light **in the two-tier format**" so the contract names the structure.
2. Add the gate step (the daily's Step-4 pattern, do-NOT-self-grade language):
   `node --experimental-strip-types scripts/brief-light-format-gate.ts daily-briefs/weekly/{YYYY}-W{NN}-light.md --enforce-length`
   `node --experimental-strip-types scripts/brief-light-craft-gate.ts daily-briefs/weekly/{YYYY}-W{NN}-light.md daily-briefs/weekly/{YYYY}-W{NN}-v1.md`
   plus the coverage diff: every full-Weekly story in a tier; any miss needs a logged reason in the status line.
   *(Note: the draft path must carry the `{YYYY}-W{NN}-light.md` name for the epoch to engage — it does.)*
3. Refresh `system/task-bodies-snapshot/weekly-draft/SKILL.md` and note the sync date in its header comment.

## TASK 4 — Worked example before the first live run

Build one two-tier weekly light by hand from the most recent real Weekly (the `SUPER_BRIEF_DRAFT_2026-08-05.md`
move — it caught the budget math being wrong before any code did). Run it through both gates at the dated
scratch path. Read it end to end; listen to an espeak proxy of THE LINE at week-length (9-16 items is the
untested rhythm — the daily maxes ~9).

---

## DECISIONS (defaults chosen; overturn deliberately, in writing)

- **D1 — No separate `## ▸ THE TAKE` in the weekly light.** OUR CALLS already carries the week's new dated
  call plus the grades; a TAKE would duplicate it. Consequence: the craft-gate "The Take" cross-product ban
  STAYS ON for weekly-v2 (Task 1.3). Alternative if overturned: add THE TAKE after MARKETS MINUTE, keep OUR
  CALLS as pure scoreboard, lift the ban for weekly-v2 too — then update `WEEKLY_V2_REQUIRED` and this table.
- **D2 — Budget 2,000-2,400 target / 2,700 hard (~13-15 min).** The first draft of this order proposed
  1,800-2,200/2,500 before measuring the weekly's soul sections (Meditation 250-350, Model ~200 — both far
  longer than the daily's); the worked W31 example landed at a measured **2,296** with 5 deep + 9 line +
  everything else intact, which is the honest center of the band. Same length as today's pinned 2,398-2,399,
  ~double the coverage — the daily conversion's exact trade.
- **D3 — Deep tier 4-5 with the week's contrarian catch holding one slot** (the weekly analog of the daily's
  Signal-takes-a-slot rule).
- **D4 — `WEEKLY_V2_EPOCH = '2026-W33'`, pushed in `8d160a4`.** If the live-task-body flip slips past W33,
  roll the constant in BOTH gates (and the generator's STOP guard) to the first un-generated week in one
  change. Rolls independently of the daily epochs — the two products flip on their own clocks.

---

## DEFINITION OF DONE

1. Weekly light lands in the 2,000-2,400 band and the format gate prints it.
2. **Every** full-Weekly story appears in a tier; misses have logged reasons.
3. Archive exit-code parity across all weekly + daily lights: zero changes (proven by A/B, not asserted).
4. A length failure has never blocked a Sunday publish (`publish-weekly.py` runs no light gate — keep it that way).
5. The first real two-tier weekly's audio has been **listened to**, THE LINE rhythm specifically.

## Independent re-verification checklist (for the reviewer chat, post-execution)

```
# 1. compiles + regression
npm run type-check && npx tsx scripts/audio-gate-regression.ts

# 2. worked example passes both gates in-band at a post-epoch W-name
cp SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md /tmp/2026-W33-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/{WEEKLY_V2_EPOCH}-light.md --enforce-length
node --experimental-strip-types scripts/brief-light-craft-gate.ts  /tmp/{WEEKLY_V2_EPOCH}-light.md <full-weekly path>

# 3. archive parity — weekly AND daily, old gate vs new, zero exit changes
for f in content/daily-updates/weekly/*-light.md content/daily-updates/2026-0*-light.md; do ...A/B...; done

# 4. the Take ban still fires on a weekly-v2 file containing "The Take" in prose (D1 regression)
# 5. lede-exemption positional fix: title "The Line" no longer exempts THE LINE section (08-06 adversarial case A2)
```

**Adversarial target for the reviewer:** ✅ **RESOLVED 2026-08-06** — Cursor's independent verification hit
exactly this: single-digit week slugs (`2027-W7`) initially evaded the epoch; both gates now normalize to
`W07` and validate weeks 1-53 (in `8d160a4`, counter-test activates TWO-TIER WEEKLY). Year-boundary string
ordering (2026-W52 → 2027-W01) verified correct. Remaining watch: any scratch/draft path that fails to carry
the `-light.md` W-name at gate time silently runs pre-epoch — the task body's Step 5b uses the dated name.
