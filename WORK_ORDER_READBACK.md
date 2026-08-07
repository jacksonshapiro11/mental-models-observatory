# WORK ORDER — THE READ-BACK LOOP · **FINAL**

**Status: FINAL. Deliberation closed 2026-08-07 by owner ruling. This is the single canonical
document.** It consolidates the original work order, the review verdict, the verdict addendum, and
the Stage 0 calibration riders. Where any superseded document disagrees with this one, **this one
wins.**

**Superseded — do not implement from these, they are history:**
`PROPOSAL_TRANSMISSION_STANDARD_2026-08-07.md` · `RESPONSE_TO_REVIEW_2026-08-07.md` ·
`HANDOFF_TO_FABLE_2026-08-07.md` · `VERDICT_ADDENDUM_READBACK.md` · the prose-quality half of any
earlier work order. **Evidence, still live and citable:**
`STAGE0_CALIBRATION_TABLE_2026-08-07.md` · `STAGE0_READBACK_EVIDENCE_2026-08-07.md` ·
`LABELING_SHEET_2026-08-07.md` + its key · `SUPER_BRIEF_REWRITE_2026-08-07_TRANSMISSION.md`.

---

# PART 0 — WHY

**Measured across 159 published briefs.** Mean sentence length rose 15.4 → 26.5 words while the brief
got *shorter* (5,731 → 5,003). Negation-framed sentences went 2% → 22%. **Length and transmission are
independent axes**, and only length had a number attached, so only length got optimised.

**The instrument's premise, proven on 2026-08-07.** A hand rewrite of that night's super brief — same
17 items, no fact added or lost — came in **73 words longer** and cut mean sentence length 23.0 → 18.7
using 22 more sentences. Six blind readers then discriminated the two versions 0/3 vs 3/3 on the
units that mattered. On Jackson's own blind labels the rewrite beat the shipped brief **94% to 80%.**

**The finding the design did not anticipate.** On the unit carrying a real factual error — "Warsh
turning four colleagues" — **not one reader stated the false claim back. It transmitted as nothing.**
The error and the muddle have the same signature: no actor comes back. One instrument catches both,
because they are one failure — a thought the writer never finished.

**The bound on that finding.** A crisply stated *wrong* relation transmits perfectly. Comprehension
measures transmission, not truth. **The `count:` truth rows stay.** Read-back catches the
vague-wrong; count rows catch the crisp-wrong.

**Why every existing critic failed:** it shares the writer's context (curse of knowledge), it judges
by checklist (box-ticking passes), its output is vague ("too complex" is not an action), and it sits
after drafting where a gate can only refuse — which Constitution I forbids — so it logs, and the log
changes nothing.

**So the critic must be blind, falsifiable, and inside the drafting loop.** Gates keep only mechanical
truth: format, provenance, arithmetic. **No sentence-length targets. No blocking on style.** One long
sentence that transmits, passes.

---

# PART 1 — THE INSTRUMENT

## 1.1 Reader (blind)
Three subagents, small/fast model preferred. **Blindness matters; model size does not.** Input: the
artifact text, passed **in the prompt**. Nothing else — no full brief, no claims file, no worldview,
no system docs. Output per unit: the claim in its own words, and why it matters. Cannot state one →
`LOST` plus what confused it.

🔴 **Never tell a Reader to read a file in this repo.** A session here inherits `CLAUDE.md` — 17KB of
house doctrine marked "MANDATORY, all models, all tasks" — which breaks blindness while the frozen-
prompt hash still passes. Passing the artifact inline is the mitigation and it is not optional.

## 1.2 Grading
Compare each read-back to the unit's **logged claim**, never to the prose. A grader that can re-read
the unit will see what it meant and excuse the distortion.

- **TRANSMITTED** — same actor, direction, rough magnitude, causal story.
- **DISTORTED** — a material element differs; includes confidently-wrong read-backs.
- **LOST** — nothing usable.
- **UNGRADEABLE_CLAIM** — the logged intent is itself mush. Charged to the writer.

**Validated 2026-08-07:** 16/16 on the binary — 7/7 faithful paraphrases TRANSMITTED, 9/9 corruptions
DISTORTED, no over-strictness from "default to DISTORTED."

**Not validated:** the element tag. It collapsed to CAUSALITY on 7 of 9, **ACTOR zero times**, on
cases built as clean actor swaps. Jackson's labels failed the same taxonomy from the other end — five
tags in 34 units, prose 29 times, and the one ACTOR he used meant "the explanation is missing," which
is CAUSALITY. He invented a sixth category unprompted: **JARGON**.
**→ Element tags are ADVISORY ONLY until the rubric ships. Amendment 7's per-element bar is
unscoreable and no number should be reported for it.**

## 1.3 The second leg — SO_WHAT
The Reader already produces a why-it-matters string and nothing has ever graded it. **Grade it against
the logged `so_what`: OK / MISSING / WRONG.**

**This is the largest single finding of the calibration.** Of the units Jackson rejected, **8 of 11
were rejected for "I don't get the so-what" — and every one had passed transmission 3/3 or 6/6.** The
so-what axis was invisible to the instrument on 100% of the units he rejected.

Logged from night one. **Starts driving rewrites after ~3 nights of baseline.**

## 1.4 Units are defined by the claims file
The parser **validates** coverage; it does not derive units from markup. Every unit has a claim row;
every claim row maps to prose. This covers `THE TAKE`, `MARKETS MINUTE` and the meditation practice —
none of which are bold-led and none of which any parser has ever assigned.

**Justified by the owner's own worst label:** *"unclear to me in every way"* landed on THE TAKE.

---

# PART 2 — THE LOOP (super brief, live)

Generate claim-first → mechanical gates → **read-back → targeted redraft → re-read** → critic →
publish.

- **Nights 1–7: unanimous-of-3 to actuate.** A 2-of-3 failure is logged and left alone. Relaxes to
  majority at night 8; the week's deferred 2/3 units are reviewed in the first rollup.
  *Justification: in the only unit-level data that exists, every severe failure was unanimous, and the
  Reader's residual error is leniency rather than false alarm — so the cost of waiting is misses, not
  flattening.*
- **Two cycles maximum, then ship.** Constitution I.
- **Passed units frozen by the assembly**, not by instruction. Byte-identical before and after.
- **Corrections are drafts** — anything a later stage rewrites re-enters the read-back.
- 🔴 **HARD FALLBACK: any error, timeout or non-returning subagent → ship the pre-loop draft and write
  `readback=ERROR` with the reason.** One retry maximum. A missed read-back costs one night of data.

**Redraft instruction (verbatim):**
> Unit {n} failed transmission. You meant: "{claim}". Three first-time readers understood: "{r1}" /
> "{r2}" / "{r3}". Rewrite the unit so a fresh reader states back what you meant. Keep every fact and
> its counter. Change nothing outside this unit.

**The light critic is slimmed:** its prose-craft check is **replaced** by read-back verdicts. It keeps
NO NEW ATOMS provenance, the two-tier contract, title coherence, freshness.

**Full brief (P3, tomorrow):** same loop at the end of `brief-editor`, after Gate 16. Gate 15's prose
reads replaced. Gate 16 keeps rewrite authority under two rules — **compression may cut whole things
but never fuse two thoughts into one sentence**, and **every unit it touches is marked dirty and
re-enters the read-back.**

## Measured slack (2026-08-07, from pipeline-status timestamps)
Documented schedule says brief-light 19:15 → brief-email 19:34. **Actual, seven nights: brief-light
starts ~19:46 EDT, brief-email fires ~19:59 — 13.5 minutes.** Tighter than documented.
**But `brief-email` sends v2 + critic and does not depend on the light** (08-05: light ran to 20:15,
email had already gone at 19:59). **A light overrun delays publish/Substack, not the chain. No task
moves tonight.** Re-measure after the loop's first week.

---

# PART 3 — CLAIM-FIRST DRAFTING

**Before drafting any unit**, write and log two lines: **CLAIM** (one breath, named actor, direction)
and **SO_WHAT** (why a busy non-specialist cares). If you cannot say the claim in one breath, the
thinking is not finished — do not start the unit.

🔴 **Standing line, now in the generator and the writer prompt:**
> **A unit that reports a mechanism must say what it means. State the so-what or do not run the unit.**

Sidecars: `content/daily-updates/[DATE]-light-claims.json`, `[DATE]-claims.json`.
Schema: `{unit, section, claim, so_what}`.

**Guard against claims-gaming** (the writer authors both ends of the measured leg): monthly
extraction-mode audit — a careful reader extracts what the prose actually claims, diffed against the
sidecar, divergence charged to the writer.

---

# PART 4 — CALIBRATION RESULT (Stage 0, 2026-08-07)

| gate | result |
|---|---|
| Rewrite beats shipped, owner-blind | **YES — 94% vs 80%** |
| Instrument matches owner labels ≥85% | **81% raw / 88% under the owner's own weighting rule.** Conditional pass — report both |
| Grader binary ≥90% | **100% (16/16)** |
| Grader per-element ≥80% | **UNSCOREABLE** — rubric owed |
| Health-bar baseline | **80% shipped** → 85% proposed, phased |
| So-what leg needed | **Confirmed — 8 of 11 rejections** |
| Units defined by claims | **Confirmed by the owner's worst label** |

**Residual-error shape:** all remaining disagreements run one way — readers passed units the owner
failed. **Leniency, not false alarm.** Safe direction for a system that actuates on failure.

**Health bar: 85%, phased.** Reported-only during the unanimity week; live at night 8. Baseline
derivation is the calibration table. 🔴 Owner signs the number. **Caveat: one brief, n=15 scoreable
shipped units, an unusually loaded night — re-measure on the May era before freezing.**

**Residual consumer rule.** Any unit failing both cycles and shipping anyway is (a) the top item of
the next morning's summary during week one, (b) permanently first in the weekly rollup, (c) **3+ in
any 7 nights is a health-bar breach.** "They log and the log changes nothing" does not get to happen
one level up.

---

# PART 5 — GOVERNANCE

- **`system/readback-ledger.json`** — append-only, one row per unit per night: date, product, unit,
  claim, per-replica grades, final grade, element, so_what, cycle, outcome, owner mark. The script
  writes it; nobody edits it. Consumers: weekly rollup, monthly extraction audit, the +30-night
  deletion review, and the daily-improvement task.
- **The daily-improvement task may PROPOSE but not APPLY** changes to Reader/Grader prompts, the
  writer prompt, the claims schema, or any threshold. All 🔴 owner-signed, ledger-cited, listed in the
  weekly rollup. The door is the same width on both sides of the instrument.
- **Prompt changes require recalibration.** Monthly regardless.
- **Style metrics stay as nightly diagnostics** — mean sentence length, >30-word share, negation
  share, plus the 45-word spoken-product tripwire. Printed, never blocking. They are the smoke
  detector that found this fire; they failed as targets and succeeded as instruments.
- **Deletion review: first live night + 30.** Every check shows a unique catch or dies. Target net
  check count −30%.
- **The owner's mark** — naming a unit he had to re-read logs it as labeled ground truth. Optional,
  welcome, never load-bearing.

---

# PART 6 — TONIGHT'S EXECUTION ORDER

**P0 — live before the run.** Stage 1 fixes · claim-first in the generator · the so-what standing
line · `BODY_brief-light_REPLACEMENT.md` at repo root for 🔴 paste.
**P1 — loop live if green by run time, else measurement-only.** Unanimous-of-3, two cycles, frozen
passed units, advisory element tags, hard fallback.
**P2 — measuring only.** So-what leg logged · ledger writes · audio local-write deploys (dual
read-back runs tomorrow on the first captured script).
**P3 — tomorrow.** Full-brief loop · May-era re-measure then freeze the bar · element rubric +
forced-choice · shuffle + test-retest · deletion clock started tonight.

---

# PART 7 — CLAIM-QUALITY QUEUE (standing work-orders)

Content, not prose. Route to the Critic / corrections lane wherever these stories recur.

| claim | owed |
|---|---|
| **SpaceX** | Owner disputes the conclusion: sell-the-news with prior liquidity is the better read; this was not the first real liquidity event. **Re-argue or correct.** |
| **China** | The *why*. We described the instrument and never gave the intent. |
| **Medicare** | Winners and losers, named. Also the only unit where the shipped version put the owner on the wrong actor. |
| **Atlassian** | Why the tape took it up 20% on a halved guide. The unit states the paradox and stops. |
| **AISI** | Commit to a read — misalignment in one lab, or frontier capability generally. |
| **FOMC** | Corrected framing, plus its `count:` row. |

**The pattern, for the Critic:** five of six are the same defect — **the unit reports a mechanism and
declines to say what it means.** No prose gate catches this. It is the WELL-EXPLAINED rung of the
four-part test going unenforced.

---

# PART 8 — HOW THIS FAILS

1. **Writer overfits to the Reader.** Guard: owner ear-flags logged as instrument bugs; rotate the
   Reader model and recalibrate if they cluster.
2. **Grader drifts lenient.** Guard: default-to-DISTORTED, false-positive control, monthly recal.
3. **Reader parrots instead of comprehending.** Guard: content-word overlap check, entities and
   numbers excluded from the count.
4. **Vague claims game the match.** Guard: UNGRADEABLE_CLAIM + the monthly extraction audit.
5. **Redraft churn.** Guard: frozen passed units, two-cycle cap, dirty units always re-read.
6. **Accretion.** Guard: this ships as a replacement — Gate 15's prose reads, the light critic's craft
   check, and all style thresholds come out. **If net check count rises, it was implemented wrong.**
7. **The instrument measures Haiku-agreement, not human clarity.** Guard: the owner's labels are the
   constitution; the ledger accretes new labels from his marks.
