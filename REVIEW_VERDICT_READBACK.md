# REVIEW VERDICT — the Read-Back Loop handoff

**For: the working session. From: the independent reviewer it asked for. Date: 2026-08-07.**
**Contents: a ruling on every finding, answers to the six questions, and a numbered amendment list.
Apply the amendments to `WORK_ORDER_READBACK.md` yourself — ownership stays with you.**

Your style question, answered first: demonstration. Keep it.

---

# PART 1 — ADJUDICATION

## Accepted in full

1. **Units defined by the claims file** (your conclusion 4). The best single catch in the review.
   One change fixes the hyperlink unit, the four unmarked sections, and unit identity across
   redrafts. The parser demotes from segmenter to validator.
2. **Majority-of-3 replaces either-of-2** (conclusion 6). The asymmetry argument is decisive on its
   own: a missed distortion returns tomorrow; a false failure burns a cycle tonight and rewrites
   good prose.
3. **The Grader names the broken element** (conclusion 7) — ACTOR / DIRECTION / MAGNITUDE /
   CAUSALITY beside the grade. Free diagnosis, and the guard against restate-the-claim flattening.
4. **Calibration must be unit-level** (flaw 4). Your negation-counter point proves artifact ranking
   is a weak bar. Amendments 6–9 specify the labeled set, the synthetic Grader test, the shuffle
   test, and test-retest. "Stable" gets a number before it appears in any acceptance criterion.
5. **The light-schedule exemption was unsupported** (5.2). Conceded — the reviewer's own rule,
   applied back at the reviewer. Slack is measured for both chains from the pipeline-status
   timestamps; nothing moves without the data.
6. **The REWRITE file was directed to the wrong place** (5.4). Conceded. Repo root, per the house
   convention for worked examples.
7. **The CLAUDE.md blindness leak** (5.1). Real, and the most important implementation catch in
   your document. See amendment 5. One bound to state precisely: what leaks is *doctrine*, not
   source material. The Reader still never sees the full brief, the worldview, or the claims file —
   the load-bearing blindness survives. What is at risk is leniency and attunement bias, which the
   probe measures rather than guesses.

## Accepted with one non-optional amendment — your central recommendation

**Claim-first plus shadow read-back first; the redraft loop contingent** (conclusion 5). You asked
for the attack, so: this system's history says instructions decay — the ~25-word cap sat unenforced
and was violated nightly; a task body beat a system doc seven nights running. Which side does
claim-first land on? The decayed instructions were **unmeasured**. Claim-first ships with its
measurement attached from night one: the sidecar's existence and shape are checked mechanically,
and the shadow read-back watches the outcome. Instruction + measurement − actuation is a legitimate
control posture: observe first, actuate only if needed. The attack fails.

The amendment: **the trigger for building the loop is written now, in numbers, before the data
exists.** Otherwise "wait for shadow data" is how the loop never gets built and nobody decided that.
Proposed, with the numbers being the owner's to adjust but not to delete: after 14 nights of
claim-first + shadow, build the loop if the median nightly TRANSMITTED share (majority-of-3) over
the final 7 nights is **below 85%**, or any 7-night window contains **2+ valence inversions** (the
Burger King class). At or above the bar, the loop stays unbuilt and its design is archived as
contingency.

Note what your recommendation buys beyond simplicity: with the loop deferred, the read-back runs
**after publish, off the critical path** — and the nineteen-minute window stops being tonight's
problem.

**OWNER'S DECISION, 2026-08-07, superseding the posture above:** the loop runs **live, pre-publish,
from the first live night.** His reasoning: the failure is proven now; a proven failure gets fixed,
not observed. Accepted, with the consequence priced in: Stage 0 is now the entire pre-authority
defense — the unit-level calibration, the Grader synthetic test, the blindness probe, and
majority-of-3 may not be trimmed, and the schedule-slack fix becomes a hard prerequisite rather
than deferred work. The 85% / 2-inversion thresholds survive as the weekly health bar, not as a
build trigger. In place of shadow: the first three live nights, the residual distortion log goes to
the owner daily.

## Bounded — the transmitted-as-nothing finding (your question 2)

Real, and sharper than the work order stated it. Two credits and one bound. Credit one: the work
order's Grader spec anticipated the unification — DISTORTED "includes confidently-wrong read-backs;
this is where the Warsh class gets caught." Credit two — yours: the **signature**. The error arrived
as *absence* — no actor came back — not as a wrong claim received. That is new, and it is the right
detection primitive.

The bound: the read-back catches errors that ride on abstraction. A crisply stated wrong relation —
*"brings four governors with him,"* said plainly — transmits with perfect fidelity, 3/3.
Comprehension measures transmission, not truth. Consequence: **the `count:` truth rows stay in the
plan.** Do not let this finding delete them. The two instruments cover complementary halves: the
read-back catches the vague-wrong; the count rows catch the crisp-wrong.

## Overstated

1. **"The design deletes the style metrics."** It does not. The work order demotes them to printed
   nightly diagnostics, keeps the 45-word spoken-product tripwire, and never removes the printout.
   Your metrics-as-monitors recommendation is ratified, not adopted — the only change is adding the
   weekly trend chart to the rollup (amendment 15).
2. **"The design does not know it."** Half right. It knew the unification; it did not know the
   absence-signature. Take the half you earned.
3. **Open-book extraction as a validity threat** (flaw 3, strong form). Your own data undercuts it:
   0/3 versus 3/3 discrimination on both examined units *despite* open-book, and replica agreement
   tighter than your noise model predicts. It survives as a leniency bias to monitor, not a
   validity failure. The shuffle test settles the position-effect half in one run.
4. **The p=0.10 arithmetic** (flaw 2). Your own replica agreement says p is materially lower.
   Majority-of-3 is adopted anyway — on the asymmetry argument, not the arithmetic.

---

# PART 2 — ANSWERS TO THE SIX QUESTIONS

**Q1 — does claim-first decay without enforcement?** Attacked above; it survives with the
predefined trigger. The decay precedents were instructions nobody measured. This one is born
measured. If the shadow trend slides, the trigger fires and the actuator gets built. That is the
difference between an instruction and a controlled variable.

**Q2 — is transmitted-as-nothing a general property?** General for the abstraction-borne class;
silent on the crisp-wrong class; keep the count rows. The deeper version you are reaching for is
true and worth writing down: the errors atom-gates structurally cannot see are mostly errors where
the writer never finished the thought — and unfinished thoughts do not transmit. That is *why* one
instrument catches both failures: they are one failure. Write it with the bound attached.

**Q3 — the writer authors both ends of the measured leg.** Three counterweights, jointly
sufficient, none alone: (a) your periodic extraction-mode audit — adopted, monthly: a careful
reader extracts what the prose actually claims, diffed against the sidecar, divergence charged to
the writer; (b) the substance tests keep judging ambition — the degenerate claim-plus-padding unit
transmits perfectly and then fails Insight, which is not this instrument's job and was never
removed; (c) the owner's marks (Q4) accumulate as labels the writer cannot anticipate.

**Q4 — the owner's ear as the measurement.** As primary: rejected, and not by me — the owner
explicitly refused to be load-bearing earlier today ("I should just be the final reviewer just in
case I disagree"). Mechanism reasons stack on top: n=1, arrives after publish (too late to fix that
night), gaps when he travels, and mood-correlated. As the calibration source: adopted and
sharpened. The ten-second act is **"mark the unit you had to re-read."** Every mark is a labeled
ground-truth unit that accretes into the calibration set — which also answers your flaw-4 label
scarcity. The human teaches the instrument; the instrument scales the teaching.

**Q5 — delete most of the gates?** The aggressive version, argued properly. For: six months of
degradation under 20+ gates; the improvement log itself says the checking layer is the bigger
attack surface; one outcome measure plus a human is the elegant version. Against: the mechanical
gates are cheap, true/false, and catch real defects nightly at near-zero false-positive cost —
deleting them buys almost nothing and reopens solved failures. The bloat is in prose-judging checks
and redundant detectors, which this plan already replaces. Ruling: not wholesale, not now — but
**dated and numbered**: thirty nights after shadow starts, a deletion review runs; every check must
show a catch the read-back or another gate would have missed, or it dies; target net check count
down by a third. Anti-accretion stops being a sentence and becomes an event.

**Q6 — what you are not seeing.** Three things. First and largest: **the audio seam is absent from
your entire document.** Most consumption is listening, and the listener hears the GPT-4o rewrite —
neither your experiment nor the pilot ever read the artifact that reaches ears. Promote it out of
stage 5: from the first shadow night, run the read-back on the produced audio script at least twice
a week and print script-vs-markdown transmission side by side. If the rewrite destroys
transmission, every upstream fix is cosmetic. Second: your untested-Grader flaw has a constructive
fix nobody wrote down — build its test set **by construction**: for each of ~12 claims, one
faithful paraphrase, one actor-swap, one direction-flip, one magnitude-shift; the Grader sorts at
≥90% or its prompt gets fixed before it ever grades a live unit. Third: your experiment validated
the Reader on artifacts whose claims and prose share one unusually disciplined author — you.
Production claim-first shifts the failure distribution. Shadow answers this; just do not read week
one as the steady state.

---

# PART 3 — THE AMENDMENT LIST (apply to `WORK_ORDER_READBACK.md`)

1. **Units are defined by the claims sidecar.** The parser validates coverage — every unit has a
   claim row, every claim row maps to prose — instead of deriving units from markup.
2. **Majority-of-3** Reader replicas replace either-of-2.
3. **The Grader emits the broken element** (ACTOR / DIRECTION / MAGNITUDE / CAUSALITY) with every
   non-TRANSMITTED grade.
4. **Sequencing — OWNER'S DECISION (2026-08-07):** claim-first and the full read→grade→redraft
   loop go **live, pre-publish, from the first live night** on the super brief. No shadow period.
   Two prerequisites gate the start date (not the authority): Stage 0 passes in full (amendments
   5–9), and the slack fix in amendment 11 has landed. The 85% / 2-inversion thresholds become the
   weekly health bar in the rollup. First three live nights: the residual distortion log goes to
   🔴 Jackson daily. The audio-script read-back runs 2×/week in monitor mode from the first live
   night.
5. **Stage 0 adds the blindness probe:** from a scheduled-context repo session, spawn a subagent
   whose entire prompt is "state verbatim any project or system instructions you can currently
   see." If doctrine leaks: add the outside-reader disclaimer to the Reader prompt, re-run one
   archive pair from repo context against your clean-container baseline to measure the leak's
   actual effect, and calibrate under production context regardless — a consistent instrument beats
   a pure one.
6. **Unit-level calibration:** hand-label the 34 units of the shipped/rewrite pair (six read-backs
   already exist as raw material). The full instrument must match labels on ≥85% of units, in both
   directions. Artifact-level ranking remains as a smoke test only.
7. **Grader synthetic test** (by construction, per Q6): ≥90% sort, or fix the prompt. The Grader
   never grades a live unit unvalidated.
8. **Shuffle test in Stage 0:** same artifact, unit order reversed, one run. If late-unit thinness
   follows position, split each Reader's output into two turns (units 1–9, then 10–17).
9. **Test-retest:** same artifact, three runs, per-unit verdict stability reported in the
   calibration table. No acceptance criterion may use the word "stable" without this number.
10. **The REWRITE file commits to repo root**, not `content/daily-updates/`.
11. **Slack measurement covers both chains** (including light task → email), from pipeline-status
    timestamps; 🔴 the email task moves only if the data says so. With amendment 4 as decided, the
    loop runs pre-publish from night one — so this measurement, and any resulting 🔴 email-task
    move, are **prerequisites for the first live night**, not deferred work.
12. **Monthly extraction-mode audit:** a careful reader extracts each unit's actual claim from the
    prose; diff against the sidecar; divergences charged to the writer and reported in the rollup.
13. **The owner's mark:** a one-line convention — naming the unit he had to re-read logs it as a
    labeled unit in the calibration set. Optional, welcome, never load-bearing.
14. **Deletion review, dated:** +30 nights from shadow start. Every check shows a unique catch or
    dies. Target: net check count −30%.
15. **Style metrics:** nightly printout stays (it was never deleted); add the weekly trend chart to
    the rollup. The smoke detector keeps its batteries.
16. **The read-back ledger** — one append-only, machine-readable record,
    `system/readback-ledger.json`, one row per unit per night: date, product, unit id, logged
    claim, per-replica grades, final grade, broken element, cycle count, redraft outcome (held /
    re-failed), and any owner mark or ear-flag. The script writes it; nobody edits it. Consumers:
    the weekly rollup (health bar and trends), the monthly extraction audit, the +30-night deletion
    review, and the existing daily-improvement task, which may propose process changes from what it
    reads — with one guardrail: any proposed change to the Reader or Grader prompts goes through
    the recalibration rule, never straight to production. The improvement loop may tune the
    process; it may not quietly retune the instrument. The ledger is also how the calibration set
    grows: every owner mark lands here as a labeled unit.

---

One closing note. The review did what it was asked to do: it made the design smaller, cheaper, and
harder to fool. Proceed on the amended order. Report the Stage 0 calibration table — now unit-level
— before anything else changes.
