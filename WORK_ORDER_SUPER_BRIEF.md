> 🔴 **SUPERSEDED 2026-08-07 by `WORK_ORDER_READBACK.md` (FINAL).** Kept as history and as citable evidence. Do not implement from this file — where it disagrees with the FINAL work order, the FINAL work order wins.

# WORK ORDER — Super Brief: make the spec real

> ✅ **EXECUTED 2026-08-05** (Cowork session). All four tasks done and verified on-machine
> (tsc 0 errors, eslint clean, audio regression 100% pass, archive exit parity identical).
> Code is staged, not yet pushed — Cursor pushes per `HANDOFF_CURSOR_LIGHT_V2_WIRING.md`.
> **Full verification record + independent re-check checklist: `SUPER_BRIEF_V2_VERIFICATION_2026-08-05.md`.**
> Remaining human steps: Cursor push + `npm run build`; Jackson places the live `SKILL.md` before the
> Thu 8/6 evening generation; one real audio dry-run listen (DoD #4, egress-blocked in the sandbox).
> The mandate below is kept verbatim as the source of truth for what was asked.

**Repo:** `/Users/jackson/Desktop/mental-models-observatory`
**You need no prior context. Everything required is in this file.**

---

## THE PROBLEM IN ONE PARAGRAPH

The Super Brief (`content/daily-updates/{DATE}-light.md`) has a written spec of **1,300–1,600 words /
5–7 minutes**. It is stated in **two** places already: the live task body
(`~/Documents/Claude/Scheduled/brief-light/SKILL.md`, Step 4) and the generator
(`system/Brief_Light_Generator.md`). **June hit it — median 1,518 words. July ran 2,183. August runs
2,232.** Forty percent over for two months.

Nothing enforces it. Step 4 of the task says *"run a word count using bash, do NOT estimate, verify
total words 1,300–1,600"* — that is an instruction to an agent to grade itself, and it has failed
every night for two months.

**Second problem, measured:** the Super Brief drops **38–50% of the full brief's Six**, and **the
Signal is dropped essentially every day** (2026-08-04: both ideas, zero overlap). It is not choosing
to drop them. The format gives each story a full ~170-word treatment or nothing, so at a ~1,200-word
budget it fits seven and the rest evaporate arbitrarily. Casualties on 08-04 included *"S&P 500
earnings grew 47.4 percent, the fastest since 2021."*

**The fix is two tiers.** Same word budget, roughly double the coverage.

---

## TASK 1 — 🔴 DO THIS FIRST. Enforce the word count that already exists.

**This alone fixes tonight. It requires no new sections, no assets, no parser work.**

**File:** `scripts/brief-light-format-gate.ts` (tracked; needs commit + push)

Add a word-count check on the generated `-light.md`:

- Strip HTML comments first (`s.replace(/<!--[\s\S]*?-->/g,'')`), then count whitespace-separated tokens.
- **Target 1,300–1,600.** Print the count and the implied minutes at 160 wpm every run.
- **🟡 advisory above 1,600. 🔴 BLOCKING above 1,900** — but see the next line.
- **🔴 THE BRIEF ALWAYS SHIPS.** A length failure must NEVER prevent publication. Follow the pattern
  already in `scripts/validate-brief.ts` (`brief-length`): the check only fails under an explicit
  `--enforce-length` flag that the *generating* step passes in its own loop. At the publish path it
  prints loudly and returns nothing. Copy that structure exactly — it exists and is tested.
- **Enforcement epoch:** only for briefs dated on or after the day you ship it. Never condemn the
  archive. `validate-brief.ts` has the pattern (`LEN_EPOCH`).

**Verify:** run against the last 10 `-light.md` files. It should flag ~every July/August one and
pass June. Confirm exit code is unchanged at the publish path.

---

## TASK 2 — Rewrite `system/Brief_Light_Generator.md` to the two-tier structure

**This is the file the task body reads** (*"Read `system/Brief_Light_Generator.md`. This is the
complete specification"*). `system/` is **gitignored** — these edits are local-only, no push.

**Do not restate the whole file.** It contains earned rules that must survive: 🔴 **NO NEW ATOMS**
(everything traces to the published full brief), the header block, project files, the Craft Standard
tests, the predictions-ledger requirement, **NO MONOLITHS**, anti-clustering, reach-forward, zero
overlap with Bloomberg/FT/WSJ framing. **Edit in place; change only what is listed below.** A prior
attempt rewrote it from scratch and silently dropped twelve of those rules.

A drafted delta already exists at `system/Brief_Light_Generator_v2.md` — **read it, then fold its
content into the live file.** It is not wired to anything and nothing reads it.

### The structure

| Section | Words | Change |
|---|---|---|
| header + THE STORY OF THE DAY | 85–110 | may now be **absent** (see rules) |
| `## ▸ THE UPDATE` | **4–5 stories × ~145** | was 5–7 × ~170 |
| **`## ▸ THE LINE`** | **8–12 × ~36** | **NEW SECTION** |
| `## ▸ MARKETS MINUTE` | 75–90 | unchanged |
| **`## ▸ THE TAKE`** | ~110 | **NEW SECTION** |
| `## ▸ INTERESTING THINGS` | 1 long ~95 + 2 × 36 | own line tier; never folded into THE LINE |
| `## ▸ THE MEDITATION` · `THE MODEL` · `THE CLOSE` | ~330 | unchanged |
| **TOTAL** | **1,300–1,600** | |

### THE INVIOLABLE RULE

**Length comes out of depth. It never comes out of coverage.** A line item costs ~36 words —
fourteen seconds. A story not run is a total loss. When over budget, in order: **shorten the lines →
shorten the already-covered sections → move a deep item down to the line.** Dropping a story is the
last resort and needs a logged reason. The deep tier is fixed; **the line tier is elastic and absorbs
the day.**

### THE UPDATE — deep tier

**Which stories earn depth:** rank by consequence × contestability. **A story earns the deep tier
because its conclusion could be wrong — and the item must say how.** If nothing would falsify it, it
is a line item no matter how good the catch.

🔴 **THE SIGNAL TAKES ONE DEEP SLOT EVERY DAY.** It is currently dropped on essentially every day.

**Conclusion first.** The headline **is** the conclusion, stated as a claim about the world with its
decisive number in it. **Test: delete everything but the bold line — does the reader still have the
takeaway?**
> ❌ *"One Census release carried three construction numbers pointing three different ways."*
> ✅ *"American capital has stopped building factories and started building server halls. Construction looks flat because those two cancel out."*

**Shape: headline ~22 · case ~85 · counter ~38.** The counter-case obeys
`system/Counter_Case_Standard.md` — banned "watch X by date Y", no first person, attributed, and it
never runs longer than the case.

### THE LINE — breadth tier (NEW)

Everything from the full brief that did not earn a deep slot. One bold conclusion-first headline,
then **one sentence carrying one scaled fact and one implication.**
> ✅ *"**Aramco earned more during the blockade than before it, because it owns 1,200 kilometres of pipe and its neighbour does not.** Net profit was $32.69 billion, up 44 percent. A chokepoint only chokes the people who have to pass through it."*
> ❌ *"Aramco reported net profit of $32.69 billion, up 44 percent."* — a ticker.

**Floor ~36 words.** Below that the analytical move dies. Market and business only. Anti-clustering
applies. Ordered by consequence, not by full-brief section.

### THE TAKE (NEW) — ~110 words

Five beats, one sentence each: mechanism · evidence · the call · where it breaks · the heuristic.
Keep the dated falsifiable call and its falsifier. Log the call to `system/predictions-ledger.json`.

### THE STORY OF THE DAY — three tests

Written **LAST**, from the finished set. **It may never cause a story to be included, excluded, or
re-angled.** If writing it makes you want to change an item, the lede is wrong, not the item.
1. State it with **no proper nouns**. If you can't, it's a summary wearing a thesis costume.
2. Count stories where the pattern **is** the story's own conclusion. **Fewer than three → no lede
   today.** Print the absence: *"Today is nine unrelated things."*
3. Name the strongest counter-instance out loud.

Yields entirely if its idea is the same as THE TAKE's. Expect it present 40–60% of days.

### A complete worked example

`SUPER_BRIEF_DRAFT_2026-08-05.md` (repo root) — a full two-tier brief built from the real 08-05
material. 17 of 17 stories, ~1,640 words. **Reference rendering, not a template to fill.**

---

## TASK 3 — 🔴 Update the LIVE task body

**File:** `~/Documents/Claude/Scheduled/brief-light/SKILL.md` — **outside the repo. Not reachable by
tools that only have the repo mounted. Someone must edit it directly.**

**This is the one that actually wins.** The engagement review's §2.1 receipt: a task body contradicted
a system doc for seven consecutive nights and the task body won every time, because the task body is
the prompt.

Changes:
1. Step 3 currently says *"Select 3-5 more stories… to fill 4-6 total."* → **"4–5 deep stories, then
   every remaining full-brief story as a one-line item in THE LINE."**
2. Add THE LINE and THE TAKE to the section list.
3. Step 4's word check → point at the gate from Task 1 rather than self-grading.
4. Keep 1,300–1,600. It was always right.

**Then refresh `system/task-bodies-snapshot/brief-light/SKILL.md`** — the snapshot is a static copy
dated 2026-08-01 with no sync. Anyone reading it believes it is live. Either sync it on a schedule or
delete it; a stale copy that looks authoritative is worse than none.

---

## TASK 4 — Wire the two new sections (8 consumers)

`## ▸ THE LINE` and `## ▸ THE TAKE` are parsed by name in eight places. **Do all of these before
pointing the generator at the new structure**, or the brief renders broken.

1. `lib/brief-light-parser.ts` — add both sections
2. `scripts/brief-light-format-gate.ts` — extend the required list and order; **the lede must be
   OPTIONAL** (a gate requiring it will manufacture one every day)
3. `lib/substack/post-builder.ts` — `SECTION_STRIPS` maps each section to a PNG. **Two new assets
   needed:** `substack-section-the-line.png`, `substack-section-the-take.png`
4. `lib/email/render-brief.ts` — THE LINE is a run of short items, not paragraphs
5. `lib/audio/text-preprocessor.ts` — 🔴 **highest risk, least likely to be caught by a test.** Ten
   36-word items read with paragraph pacing sound like a list being recited. Needs a beat between
   items. **Listen to a dry run.**
6. `lib/repetition-check.ts` — 🔴 the lede restates up to four items **by design**. Confirm it is in
   `ignoreSections`; if not, add it. Otherwise every brief fails and it looks like a quality problem.
7. `lib/social/thread-generator.ts` — verify
8. `scripts/publish-weekly.py` — verify (the weekly light may share this parser)

**Order:** 1, 2, 6 first → generate to a scratch path and read it end to end, **do not publish** →
listen to the audio → then 3, 4, 5, 7, 8.

---

## ALREADY DONE — do not redo

Live and verified in `scripts/validate-brief.ts` (full brief, not the Super Brief):
brief-length rail (Editor-loop only, epoch-gated, override-clearable) · blind `checkSixBulletWordCeiling`
deleted · Signal + Wild Card added to `SIX_SECTIONS` (the 300/340 constants were unreachable dead
code) · budgets rebuilt off the July median · `checkAISectionMinBullets` made format-agnostic ·
counter-case word floor replaced with structural checks at three call sites. Full brief went **52 → 36
minutes**. Audio self-reporting and a `selectedVoice` build break also fixed.

Docs live on disk (`system/`, gitignored): `Constitution.md` · `Counter_Case_Standard.md` ·
`Change_Record_2026-08-05.md` · Gate 16 in `Brief_Editor.md` · Scanner Phase 1.5.

**None of the Super Brief work above is deployed.** That is what this order is for.

---

## DEFINITION OF DONE

1. `-light.md` lands **1,300–1,600 words** and the gate says so.
2. **Every** Six story, both Signal ideas and the Take appear in either tier. Verify by diffing story
   coverage against that day's full brief; any miss needs a logged reason.
3. A length failure has **never** prevented publication.
4. The audio has been **listened to**, not just tested.
