# Handoff → Cursor · Super Brief v2 (two-tier) · wiring

> ⛔ **SUPERSEDED 2026-08-05.** The nine-consumer wiring described below is **DONE**. This file is kept
> for history only. Use instead:
> - `HANDOFF_CURSOR_LIGHT_V2_WIRING.md` — the actual push runbook (validate → commit → push).
> - `SUPER_BRIEF_V2_VERIFICATION_2026-08-05.md` — what changed, the evidence, and a re-check checklist.
> - `SUPER_BRIEF_TWO_TIER_EXAMPLE_2026-08-05.md` — a full worked brief, both gates green, 1,596 words.
>
> The one correction to the text below: there turned out to be a **9th** consumer, the craft gate
> (`scripts/brief-light-craft-gate.ts`), whose 1,500-word floor and "The Take" cross-product ban would
> have fought the new format. It was wired too.

**(historical) NOTHING IS LIVE. Tonight's `brief-light` runs v1, unchanged.** No commits to push for this.
`system/` is gitignored, so the two new documents exist on Jackson's disk only.

- `system/Brief_Light_Generator_v2.md` — the spec (NOT wired)
- `system/Brief_Light_Generator.md.bak-pre-v2-20260805` — backup of live v1
- `SUPER_BRIEF_DRAFT_2026-08-05.md` — a complete v2 brief built from the real 08-05 material

---

## Why

v1 makes a binary choice per story: full ~170-word treatment or the story does not appear. At a
~1,200-word budget that is seven stories, and the rest evaporate. Measured against the full brief:

| | Six leads | missing from Super Brief |
|---|---|---|
| 2026-08-05 | 16 | **6 (38%)** |
| 2026-08-04 | 16 | **8 (50%)** |

**The Signal was dropped essentially every day** — on 08-04, both ideas, zero entity overlap. The
Take survived. Nobody chose that; the format ran out of room and the selection was arbitrary. Losses
included *"S&P 500 earnings grew 47.4 percent, the fastest since 2021"* on 08-04.

v2 adds a breadth tier so a story can be present without being deep. Same day, same material:
**17 of 17 stories at 10.3 minutes**, against v1's 9 of 17 at 14.2.

## What changes in the artifact

**TWO new sections, not three:** **`## ▸ THE LINE`** (after THE UPDATE) and **`## ▸ THE TAKE`**
(after MARKETS MINUTE). THE UPDATE drops from 5–7 stories to **4 deep items**. INTERESTING THINGS
keeps its own section and gains its own line tier.

**There is no new "THE READ" section.** The first draft of this proposal invented one — then the
audit found v1 already has **THE STORY OF THE DAY**, a story-thesis lede doing the same job. v2 only
adds tests and a written-last rule to the existing lede. That removes a section, a PNG, a parser
entry and a chunk of this list.

New order: [lede] · UPDATE · **LINE** · MARKETS MINUTE · **TAKE** · INTERESTING THINGS · MEDITATION · MODEL · CLOSE

## The nine consumers — all need wiring before this can run

1. **`lib/brief-light-parser.ts`** — three new sections.
2. **`scripts/brief-light-format-gate.ts`** — extend the required list and order. THE READ must be
   **optional**; it is absent by design on days with no honest pattern, and a gate that requires it
   will manufacture one.
3. **`lib/substack/post-builder.ts`** — `SECTION_STRIPS` maps each section to a PNG. **Two new
   assets required**: `substack-section-the-line.png`, `substack-section-the-take.png`. Confirm what
   the builder does with an unmapped section before assuming it degrades gracefully.
4. **`lib/email/render-brief.ts`** — THE LINE needs its own treatment; it is a run of short items,
   not paragraphs.
5. **`lib/audio/text-preprocessor.ts`** — **most likely to be wrong and least likely to be caught.**
   THE LINE is 8–10 items of ~36 words each. Read with paragraph pacing it will sound like a list
   being recited. It needs a beat between items. Listen to a dry run before shipping.
6. **`lib/repetition-check.ts`** — 🔴 the lede now restates up to four items by name, by design.
   Confirm the existing lede is already exempt; if it is not, exempt it. The failure would read as a
   quality problem rather than a config gap.
7. **`scripts/brief-light-craft-gate.ts`** — the new rules are mechanical; see §"Mechanically
   checkable" in the spec. The high-value ones are the tease detector, the banned counter-case form,
   and coverage-vs-the-full-brief.
8. **`lib/social/thread-generator.ts`** — verify.
9. **`scripts/publish-weekly.py`** — verify; the weekly light may share this parser.

## Read the spec as a DIFF

`Brief_Light_Generator_v2.md` is written as a delta: **everything in v1 applies except where v2 says
otherwise.** That is deliberate. The first draft restated v1 from scratch and silently dropped twelve
earned rules including 🔴 NO NEW ATOMS, no-monoliths and the predictions-ledger requirement. Do not
"tidy" it into a standalone document — the deferral clause is the safety property.

## Sequence

1. Wire 1, 2, 6 first — parser, gate, repetition exemption. Without 6 every v2 brief fails.
2. Generate a v2 brief to a scratch path and read it end to end. **Do not publish.**
3. Listen to the audio. Item 5 is the risk.
4. Substack assets (3), email (4), then the craft gate (7).
5. Only then point the `brief-light` task at `Brief_Light_Generator_v2.md`.

## Three rules worth understanding, not just implementing

**Coverage is inviolable.** Length comes out of depth, never out of coverage. A line costs 36 words
— fourteen seconds. A story not run is a total loss. Order of cuts: shorten lines, then shorten
already-covered sections, then move a deep item to the line. Dropping a story is last and needs a
logged reason.

**The lede is written LAST and is never directive.** Stories are selected on merit before any read
is attempted. The read describes the finished set; it may never cause an inclusion, an exclusion, or
a change to an item's conclusion. A read that selects its own evidence cannot be falsified. It is
absent whenever fewer than three stories genuinely instance it, and **the absence should be printed**.
It also yields entirely when its idea is the same as THE TAKE's — never say one thing twice.
Track the rate — above ~80% of days means it is being manufactured.

**The counter-case is not "watch X by date Y".** That form is banned: it can be written by someone
who never read the story, it defers the work, and nobody scores it. A counter names an *argument*,
attributes it to a holder or a fact, contains no first person, attacks the frame rather than the
forecast, and never runs longer than the case it answers. "No serious argument against this one" is
a legal and preferred output when true.
