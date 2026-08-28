# AUDIT RESULTS — FOUR QUESTIONS, ONE FILE — 2026-08-28

**Run by the review session on owner instruction ("run everything now"). Receipts inline; every number re-derived from the boards, ledgers, logs, and shipped files staged 2026-08-28 evening. Decisions queued at the end of each section; nothing here changes behavior by itself.**

---

## 1. EDITOR VALUE COMPARISON — what six editor-less nights actually cost

**Design.** Present nights: 08-17..20, 08-27, 08-28. Degraded nights: 08-21 (no trace), 08-22 (selfheal, real edits), 08-23/24 (no v2), 08-25 (selfheal stamp), 08-26 (v2 byte-identical). Confound, stated: 08-27+ also gained the so_what ensemble and the full-brief read-back, so late present-nights are better-instrumented for two reasons.

**The flat line that matters most:** read-back transmission was **indistinguishable across modes** — 92–96% majority-transmitted every night, zero residuals except one (08-24), regardless of whether an editor ran. The editor adds nothing measurable to *transmission*; that is the writer's and QG's product.

**Bucket (a) — what the editor catches when present** (from its own logs): 5–10 concrete actions/night — fact-flag routing (4 routed 08-18), settle-rule magnitude checks, weekday-date fixes, payoff-class consistency, and the one demonstrated *judgment* class: **restoring meaning the QG deleted** (08-27: two carried clauses restored, including the delivering sentence of the Warsh unit; 08-28: caught the claims-file/QG timing hole). Character of the work: predominantly rule-application; occasionally editorial judgment.

**Bucket (b) — caught late by critic/selfheal on absent nights** (redundancy working; cost = latency and risk, not zero): 08-22 selfheal struck 2 Critic UNRESOLVED-FACT atoms **pre-publish** — zero reader-facing latency that night. Critic unresolved-counts show **no spike on absent nights** (range 6–17 absent vs 8–20 present). The morning layer published-and-verified every single day in both modes.

**Bucket (c) — slipped to readers on absent nights that present nights would have stopped: approximately nothing attributable.** The genuine reader-facing defects of the window ship-dated to *absent* nights are the mislabeled "v2" stamps (integrity, not prose) and the 08-26 light duplicate — which is the light loop's defect, outside editor jurisdiction. Meanwhile **two reader-facing defect classes shipped on EDITOR nights** (unauthorized redrafts 08-20; intraday-for-close verbs 08-27/28 ×3 units). The editor does not catch novel classes either.

**Verdict, for the owner.** On this sample the editor is **insurance plus micro-hygiene, not a measurable quality driver**: its unique demonstrated value is the carried-clause restoration class (~2 catches/week) and same-night latency on truth flags; its cost is ~200–300k tokens/night (~25% of the core chain) at opus. The data supports a concrete, reversible test: **run the editor on sonnet for one week.** Its catch profile is rule-shaped, the morning gate backstops it, and the read-back + critic now measure exactly the thing that would degrade. If carried-clause-restoration catches disappear, flip back. **QUEUED: owner decision — sonnet-editor trial week, yes/no.**

---

## 2. SELECTION AUDIT — 8 nights of picked-vs-available

**The recommendation IS the selection.** Across 08-21..28, the shipped C&C bullets are almost exactly the predraft's recommended primary + secondary every night; candidates ranked 3+ shipped **once in eight nights** (08-26 #3). The Architect's "selection optionality" (4–6 candidates per night) is not being exercised — the predraft's ranker is the real selector, and 2–3 candidates per night are dead weight written and never used.

**The mix misses its own target in the direction the owner already sensed.** selection-judge's mechanical counts, nightly, against target **70/12/18** (core / thesis-tier / reach): measured **65–76 / 5–6 / 18–30**. The middle tier is starved **every night** (5–6% vs 12%); the reach tier overshoots on multiple nights (24%, and **30% on 08-26 with reach count 6 against a floor of 3**). "Some of it should be out-there but it can't all be that" is now a measured fact: the floor-3 reach quota functions as a target, and the thesis-tier is being crowded out from both sides.

**selection-judge is half-built.** Every night since 08-16 reads `grading=PENDING-BATCH — no verdicts`; the `tally` step requires `.selection/<date>/verdicts.json`, which has never existed. The instrument counts; it has never judged. The mechanical mix data above is real; the quality grading it was built for has not started.

**Story cooldown: working but with weekday-entities.** The C3 rebuild produces real keys and one true collision class, but `friday|rates`, `tuesday|rates`, `secretary|…` show weekdays and titles still passing as entities. One stopword list away from clean.

**QUEUED:** (1) owner: cut predraft candidate count 5→3 (token saving, no observed loss) OR instruct the Architect to justify one non-recommended pick per week — pick one; (2) working chat: make selection-judge's verdict step actually runnable (define who writes verdicts.json — likely the Saturday deep run); (3) working chat: weekday/title stopwords in the story-key extractor; (4) owner, later: whether 70/12/18 is even the right target — the system has never hit it.

---

## 3. DELETION-REVIEW ATTRIBUTION TABLE (day-30 input; NO retirements without owner)

Catch-adjacent events per gate across the 12 boards (08-17..28), mentions in parentheses:

| gate | catches | note |
|---|---|---|
| fact-gate | 19 (82) | the workhorse |
| predraft-consumption-gate | 15 (19) | high hit-rate |
| assembly-gate | 14 (39) | includes the invariant era |
| provenance-gate | 13 (23) | fabrication catches |
| novelty-gate | 10 (33) | newly wired; counts inflated by wiring chatter |
| pipeline-integrity-gate | 3 (7) | |
| six-conversion-gate | 3 (16) | |
| register-gate | 2 (11) | |
| brief-light-craft-gate | 1 (7) | |
| published-header-gate | 1 (7) | **tail-risk guard — low frequency ≠ low value; it exists for the Tesla class** |
| brief-light-format-gate | 0 (8) | demotion candidate |
| declaration-binding-gate | 0 (6) | currently defective anyway (§4) |

12 meta/retired entries already documented in the manifest, including gate-attendance's self-catch. **Rule for the review when it happens: frequency-zero is a demotion signal only for gates whose failure class is recoverable; catastrophic-class guards (published-header) are judged on unique coverage, not count.** Table waits for the owner's day-30 session (~Sept 6).

---

## 4. DECLARATION-BINDING ADJUDICATION — defect, do NOT bless the two nights

The 08-26/27 "newly firing" findings are **product rhetoric being read as writer declarations**. Receipt: the flagged strings — *"Huh, I had that backwards," not "yes, obviously."* — are the Inner Game unit's own prose (the Xunzi/Mencius passage, present three times in 2026-08-27-v2.md), quoted inside the VALIDATION REPORT block, where the extractor picks quoted spans up as declarations. A quotation inside a declarations block is evidence, not a declaration.

**Explicit call (A4-compliant, names a measurement not a category): a line inside the declarations block whose flagged content lies within quotation marks or a blockquote is excluded from binding.** Fix is one extractor change + two selftest legs (quoted-prose excluded; a real unquoted declaration still binds — use 08-27's genuine declarations as the fixture). The two nights stay OUT of the blessed named set. **QUEUED: working chat, ~30 min.**

---

## CARRY LINES ADDED WITH THIS FILE

| date | finding | owner | status |
|---|---|---|---|
| 2026-08-28 | Sonnet-editor trial week: editor comp shows rule-shaped catch profile, flat transmission across modes; reversible test, instruments in place to detect degradation | owner decision | OPEN |
| 2026-08-28 | Predraft candidates 5→3 or mandated non-recommended pick: rec-primary shipped 8/8 nights, cands 3+ shipped 1/8 — optionality is unexercised | owner decision | OPEN |
| 2026-08-28 | selection-judge verdict step has never run (PENDING-BATCH since 08-16, verdicts.json never written) — define the writer (Saturday deep run) and run it | working chat | OPEN |
| 2026-08-28 | Story-key extractor: weekday/title stopwords (friday, tuesday, secretary passing as entities) | working chat | OPEN |
| 2026-08-28 | declaration-binding extractor: exclude quoted spans inside declaration blocks; two firing nights adjudicated DEFECT, not blessed | working chat | OPEN |
| 2026-08-28 | Mix target 70/12/18 never hit (thesis tier starved 5–6% nightly, reach overshoots to 30%) — owner to re-set or enforce after selection-judge grades | owner, on return | OPEN |
