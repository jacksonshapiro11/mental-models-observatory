> 🔴 **SUPERSEDED 2026-08-07 by `WORK_ORDER_READBACK.md` (FINAL).** Kept as history and as citable evidence. Do not implement from this file — where it disagrees with the FINAL work order, the FINAL work order wins.

# HANDOFF — The Read-Back Loop: findings, conclusions, and open questions

**For: an independent reviewer with no prior context.**
**From: the working session, 2026-08-07.**
**Status: a design has been approved in direction. Implementation has not started. One live
experiment has been run. I want this torn apart before anyone writes code.**

This document is self-contained. Every number in it is measured, not estimated, unless marked
otherwise. It is written in the style it argues for — short sentences, one claim each — which is
either a useful demonstration or an annoying affectation, and you should say which.

---

# PART 1 — THE SITUATION

## What the product is

A daily newsletter, produced entirely by a pipeline of LLM agents running as scheduled tasks.
Two artifacts a night:

- **The full brief** — ~5,000 words, ~30 minutes read, published to a website and emailed.
- **The super brief** — ~1,700 words, ~10 minutes, also produced as audio via a GPT-4o rewrite and
  a TTS pass. This is the flagship. Most consumption is listening.

The pipeline is elaborate: ~12 scheduled tasks from 5:45 PM to 9:01 PM, 20+ mechanical gates, a
152-row improvement registry, and several LLM "critic" passes. It has been running for roughly six
months and improving itself nightly via an automated improvement loop.

## The complaint that started this

The owner's collaborator gave three pieces of feedback on the same day:

1. **Big and material:** "We're making the wording too complex. Our arguments aren't easily
   digestible. This shows a lack of knowledge on our side, pushing the complexity onto listeners
   instead of internalizing it ourselves."
2. **Small and mechanical:** the intro quote should come first in the super brief.
3. **A factual error:** a claim about Federal Reserve vote arithmetic that was, in his words,
   "slop that is not thought out."

## The factual error, because it matters later

The brief said a September rate hike needs 7 of 12 FOMC votes, that the hawkish base is 3 (three
named regional presidents who dissented for a hike on July 29), and therefore that **"reaching seven
means Kevin Warsh turning four colleagues who just voted the other way in public."**

Warsh is the Fed Chair. He voted with the nine who held. So four *more votes* are needed, but one of
them is his own — he needs to turn **three** colleagues, not four. Worse than the off-by-one: the
sentence casts Warsh as the hawks' whip while the roll call in the previous sentence puts him on the
other side of the vote.

The true version is *"Warsh reverses his own vote and brings three of his governors with him."**It is shorter, plainer, and more interesting than the false one.** Hold that thought.

**Two things about how the error got in, both verified in the pipeline logs:**

- **A gate wrote it.** The quality-gate pass correctly killed a different false claim ("a six-six tie
  goes to the Chair") and, in the same edit, authored the replacement and explicitly promoted it as
  *"the bullet's edge-sizing number."* Corrections enter downstream of every check.
- **The right test was applied in one direction only.** The same log reads: *"Also self-refuting
  inside its own sentence: if a 6-6 tie went to the Chair, a hike would need six votes plus the
  Chair, not the seven the same sentence asserts."* That reasoning kills the Warsh claim too. It ran
  on the claim being killed, never on the claim being written.
- **No gate could have caught it.** Every gate checks atoms against sources — office-holders, market
  numbers, superlatives, event reuse. The critic verified "12 voters / 7 for a majority / no casting
  vote ✅" and the full dissent roster. Every atom passed. The error lives in the *relation between*
  verified atoms, and a relation has no source to check against.

---

# PART 2 — THE MEASUREMENTS

All computed over the published archive. Re-runnable.

## 2.1 The degradation is in sentence architecture, not length

**Full brief, n=159:**

| period | words | mean sentence | >30-word sentences | negation-framed |
|---|---:|---:|---:|---:|
| Feb–Mar | 5,731 | **15.4** | 9% | **2%** |
| April | 5,829 | 22.4 | 22% | 10% |
| May | 5,465 | 23.5 | 24% | 15% |
| June | 5,007 | 26.2 | 31% | 17% |
| July | 5,003 | 26.5 | 33% | 19% |
| August | 6,447 | 24.6 | 30% | **22%** |

**Read row one against row five.** February's brief was *longer* than July's — 5,731 words against
5,003 — and its sentences were **40% shorter**. Negation-framing ("X is not A, it is B") went from 2%
of sentences to 22%, an eleven-fold rise, while word count went sideways.

**Super brief, n=115:**

| period | words | items | mean sentence | >30-word | negation |
|---|---:|---:|---:|---:|---:|
| Mar–Apr | 1,284 | 7.1 | 18.1 | 12% | 7% |
| May | 1,421 | 7.1 | **17.1** | **10%** | **10%** |
| June | 1,584 | 7.4 | 20.0 | 18% | 13% |
| July | 2,153 | 10 | 22.6 | 25% | 17% |
| **2026-08-07** | **1,872** | **17** | **23.0** | **30%** | **29%** |

Two facts that rule out the easy explanations:

- **June rules out item count.** 7.4 items at 1,584 words — near the old count, in band on length —
  and already at 20.0 mean sentence.
- **2026-08-01 rules out length.** 2,192 words, 11 items, and **17.1 mean sentence with 9% long**.
  Long and clear, same pipeline, same month.

## 2.2 A clarity rewrite makes the artifact longer

I hand-rewrote the whole 2026-08-07 super brief. Same 17 items. No item dropped, no fact added or
lost. Applied one discipline: one claim per sentence, concrete noun before abstraction, the right
answer before the wrong one.

| | words | items | sentences | mean sentence | >30w | negation | longest |
|---|---:|---:|---:|---:|---:|---:|---:|
| shipped | 1,872 | 17 | 79 | 23.0 | 30% | 29% | 61 |
| rewrite | **1,945** | 17 | **101** | **18.7** | **19%** | **19%** | **49** |

**The rewrite is 73 words longer.** Words per idea barely moved. Sentences per idea rose 28%. Clarity
was not bought with brevity; it was bought by cutting the same content into more sentences.

## 2.3 A spec defect that mechanically explains the density

The super brief generator's own section budgets, summed:

| | min | max |
|---|---:|---:|
| sum of all section budgets | **1,635** | **1,999** |
| stated total | **1,300** | **1,600** |

**The floor of the spec is 35 words above the ceiling of the spec.** Nobody ever added the column.
The writer is handed a budget it cannot satisfy, so something gives every night — and the thing that
gives is explanation, because it is the only line item with no number attached.

## 2.4 The standard already existed and was scoped away

The system contains a **Transmission Gate**, well written, canonical, asking exactly the right
question: *"Would an educated professional outside this domain follow every line on one read, without
re-reading and without hitting needless jargon?"*

It applies **only** to the weekly deep dive and one long-form section. A line in the craft standard
explicitly excludes the two products under complaint. And the doc's own codification checklist lists
"propagate the Transmission Gate to the Editor" as still **proposed** — never done.

The complaint is the predicted consequence of an unfinished propagation, and the system wrote down
the prediction.

## 2.5 The critic has been grading the wrong contract

The super brief moved to a two-tier format (4–5 deep items + 8–12 one-line items) on Aug 6. Its
adversarial critic still demands **"5-7 stories, dominant first… fewer than 5 stories → BLOCK."**
File mtimes confirm the critic was never updated. The one human-judgment craft pass on the flagship
product has been judging a 17-item artifact against a 5-item spec for three nights.

---

# PART 3 — THE DESIGN UNDER REVIEW

Approved in direction. Not built.

**The principle.** Every existing critic failed for four reasons: (a) it shares the writer's context,
so curse-of-knowledge fills every gap; (b) it judges by checklist, and box-ticking passes; (c) its
output is vague — "too complex" gives a writer nothing to do; (d) it sits after drafting, where a
gate can only refuse or trim, and a constitutional rule forbids refusing (the brief always ships) —
so it logs, and the log changes nothing.

Therefore the critic must be **blind** (a fresh model that has seen only the artifact), **falsifiable**
(a stated-back claim compared to recorded intent, not an opinion), and **inside the drafting loop**
(where rewrite is still possible). Gates keep only what gates are good at: format, provenance,
arithmetic. **No sentence-length targets and no blocking enforcement.** One long sentence that
transmits, passes.

**The instrument.** One script that never calls a model, plus two blind subagents spawned by the
existing scheduled tasks (so cost lands on the subscription plan, not a metered API):

- **The Reader** — a Haiku-class subagent. Input: the artifact text and nothing else. Output: for
  each unit, in its own words, (a) the claim and (b) why it matters. If it cannot state one: LOST.
  Deliberately small — a stronger reader hides transmission failures. Two replicas; **a unit fails if
  either reader fails it.** A content-word overlap guard rejects parroted read-backs.
- **The Grader** — a Sonnet-class subagent. Input: the *recorded intent* and the read-back. **Not the
  artifact prose** — a grader that can re-read the unit will "see what it meant" and excuse the
  distortion. Grades: TRANSMITTED / DISTORTED / LOST, defaulting to DISTORTED when unsure. A fourth
  outcome, UNGRADEABLE_CLAIM, is charged to the writer when the recorded intent is itself mush.

**Claim-first drafting.** Before drafting any unit, the writer states its claim in one breath —
named actor, direction, why it matters — and logs it to a sidecar JSON. Then builds the unit around
that sentence. If it cannot be said in one breath, the thinking is not finished.

**The loop.** Draft → mechanical gates → read-back → redraft only the failed units (passed units
frozen by the assembly, not by instruction) → re-read → **two cycles maximum, then publish
regardless.** Residual distortions are logged.

**Rollout.** Stage 0 build + calibrate against five known-answer archive pairs; Stage 1 unrelated bug
fixes; Stage 2 claim-first live with three nights of shadow mode; Stage 3 flip the loop in-line;
Stage 4 full brief; Stage 5 audio seam. No new scheduled tasks — three existing ones change.

---

# PART 4 — A PRIOR INDEPENDENT REVIEW, AND WHAT I DID WITH IT

An earlier independent pass raised four flaws. I am relaying them because they are good and because I
want you to challenge them too, not ratify them.

1. **The measurement triangle has an unmeasured side.** Three legs exist: claim↔prose, prose↔read-back,
   claim↔read-back. The system only ever grades the third, and **the writer authors both ends of it.**
   The degenerate fixed point is a unit that is its claim sentence plus padding. Transmission rates
   climb while informational ambition thins.
2. **The noise floor is unmeasured and the OR-rule doubles it.** If per-reader false-failure is p,
   either-fails gives ~2p. At p=0.10 that's ~19% composed — roughly 3 false failures a night on 17
   units, with maybe half the redraft list being noise, each one burning one of only two cycles. Also:
   the two readers are the same model with the same prompt, so their errors correlate — the OR buys
   less sensitivity than independence math implies while doubling the idiosyncratic noise. And
   "passed units frozen" means units that got *lucky* are immortalized while units that got unlucky
   are rewritten — selection on noise.
3. **The Reader does not simulate the reader the principle describes.** It has the whole artifact in
   context while writing every read-back. It is not listening once; it is doing open-book extraction.
   The leniency leak the design guards against by keeping the model small enters through the context
   window instead. Separately, 17 claim-plus-why pairs is a long structured generation for a small
   model, so late units may fail for output position rather than for prose.
4. **Calibration validates the wrong level.** The five pairs are *artifact-level rankings*; the loop
   consumes *unit-level verdicts*. Worse, a trivial function counting long negation-framed sentences
   would rank all five pairs correctly, because they differ grossly along exactly those axes. The
   Grader — the component making the actual judgment — is never tested against ground truth at all.
   And no test-retest reliability number exists, so "materially below" and "one week stable" are
   vibes.

**Also raised, and I think correct:** the design deletes the style metrics for anti-accretion purity,
but those metrics are the smoke detector that found this fire. They failed as targets and succeeded
as instruments. And: **claim-first drafting is the treatment, filed as plumbing** — it attacks the
pathology at generation time, before any reader runs, and the rollout accidentally builds the
experiment that would isolate it.

**What I accepted:** all four flaws, the metrics-as-monitors reversal, and the claim-first point —
which I have since promoted to my central recommendation (Part 7).

**What I want challenged:** whether flaw 3's two effects (open-book leniency, output-position
degradation) actually cancel, and whether the OR-rule's noise cost is real once you see the live data
in Part 6, which shows tighter replica agreement than p=0.10 would predict.

---

# PART 5 — WHAT I VERIFIED AGAINST THE ACTUAL REPOSITORY

Five checks. Four found problems.

**5.1 The design's blindness is broken by default.** A 17KB `CLAUDE.md` sits at the repo root,
headed *"OPERATING DOCTRINE — how every session thinks (MANDATORY, all models, all tasks, chats
included)"*, carrying the four-part content test and a manifest pointing at the craft standard, the
editorial bible, and the writer's instructions. Any subagent spawned from a session in that directory
inherits it. **The frozen-prompt hash check still passes, because the leak arrives outside the
prompt.** My own experiment (Part 6) was clean only because it ran from a different container.

**5.2 The schedule claim is wrong.** The design asserts the super-brief task is "self-contained and
outside the chain" and needs no schedule change. It runs at **7:15 PM**, with the email task at
**7:34** — nineteen minutes, and the task already spends most of that on generation plus three inline
gates plus a critic. The design prescribes a careful slack measurement for the full brief and exempts
the light from it. That exemption is unsupported.

**5.3 No subagent has ever run in this pipeline.** Zero matches for subagent / Task tool / spawn
across every task body and the pipeline controller. The design rests on a capability the system has
never exercised. Probably fine. Unproven.

**5.4 A file placement error.** A calibration artifact is directed to the *published* content
directory, which is read by the site parser, the social thread generator, a health checker, and the
publish script. The repo's own convention puts worked examples at root.

**5.5 One claim checked out.** The design says a "~25 word" sentence cap already exists, is violated
nightly, and is measured by nothing. Confirmed — it is in the voice section, and last night's brief
had a 61-word sentence.

---

# PART 6 — THE LIVE EXPERIMENT

I ran the sharpest calibration pair for real before writing any code. Six blind Haiku subagents,
three replicas per artifact, each given one file, told nothing about a comparison, instructed to make
exactly one read call and use no other tools. Prompt was the design's template verbatim plus a unit
numbering instruction.

Pair: the shipped 2026-08-07 super brief versus my hand rewrite of it. Same 17 units, same facts.
This is the only pair in the calibration set that controls for content.

## 6.1 The headline: the Warsh unit

**Shipped** (contains "…turning four colleagues"):

> R1: "the actual voting math requires seven of twelve votes with a recent composition that favors
> the lower probability, masking structural difficulty behind average odds"
> R2: "the actual committee vote requires seven of twelve members to pass and currently only three
> want a hike"
> R3: "the Fed only needs seven of twelve votes, so a tied vote means no increase, and the voting
> bloc may not have those seven"

**Rewrite** (contains "…reverses his own vote and brings three of his governors"):

> R1: "it requires the Fed Chair to reverse his current position and bring governors with him to get
> seven votes"
> R2: "the Chair and his appointed governors together have enough votes to block one"
> R3: "basic arithmetic shows it would require the Fed chair to reverse his recent vote and flip
> three board governors"

**0/3 versus 3/3 on naming the actor.** One reader recovered the exact number.

**And the finding I did not expect: not one shipped-version reader stated back the false claim.** The
error did not transmit as an error. It transmitted as *nothing*. The unit was abstract enough that
"four colleagues" never reached a head to be wrong in.

**This is the strongest argument for the design and the design does not know it.** The read-back
catches the correctness failure and the clarity failure with one instrument — not by fact-checking,
but because both failures have the same signature: no actor comes back. It also retroactively
explains why every atom-level gate missed the error. There was no wrong atom to catch.

## 6.2 A systematic distortion no existing gate can see

Intent: *Burger King's 8.5% gain is share, not weather — proven by its sibling brand falling 5.1%
under the same parent.* The claim is that BK is winning.

All three shipped readers inverted it identically: "internal cannibalization rather than net growth,
**making it unsustainable**" / "money moving between sister brands **creates no value**" / "reveals
the growth is **hollow**." The culprit is a closing line, *"The money walked across the street,"* with
no anchor before it.

All three rewrite readers got it right. The rewrite's only relevant change was adding *"Nothing about
the economy explains that."*

**Every fact in the shipped unit is true and sourced.** No gate in this system can see this class.

## 6.3 The bug the run found in twenty minutes

Units were marked by bold-lead, which is what the existing parser keys on. Unit 17 landed on an
`[→ Explore this model]` **hyperlink line.**

> One reader answered: **"LOST. This is only a hyperlink; no independent claim is presented here."**

She was right, and the instrument would have scored her a transmission failure. Two other readers
answered unit 17 with the section's actual argument — which lives in unlabeled prose the segmenter
never marked — so they "passed" a unit that does not exist by reading one that was never assigned.

**Four of the super brief's eight sections are not bold-led at all**, including the dated falsifiable
call, which is arguably the highest-stakes prose in the product. A bold-lead segmenter gives them no
unit and never grades them.

## 6.4 Honest caveats on this experiment

1. **I wrote the rewrite.** The read-backs are raw and unedited; the tallies are my judgment and I am
   not neutral.
2. **The Grader was not run at all.** It remains the one component with zero validation.
3. **Replica agreement was high** — tighter than a 10% per-reader error rate would predict. That is
   weak evidence against the OR-rule concern, on one pair, and is not a noise measurement.
4. **Open-book leniency was not controlled for.** These readers had the full text in context while
   writing every read-back.
5. **Position effects were not isolated.** Read-backs for units 13–17 are visibly thinner than 1–5
   across all six readers. That could be the prose or it could be output position. A shuffle test
   settles it in one run and has not been done.

---

# PART 7 — MY CONCLUSIONS, WITH CONFIDENCE

**High confidence.**

1. **Length and transmission are independent axes**, and six months of optimizing the measurable one
   while nothing watched the other is the whole story. Feb was longer and clearer than July.
2. **The correctness failure and the clarity failure are one failure.** The Warsh sentence is what an
   unfinished thought looks like when it happens to be checkable. Both were caused by writing at an
   abstraction level above where the fact lives. Both are fixed by the same move.
3. **The read-back instrument detects real differences that no existing gate can see**, on the two
   units I examined closely, with 3/3 replica agreement.
4. **Segmentation must be inverted.** Let the claims file *define* the units and have the parser
   validate against it, rather than deriving units from markup. This single change fixes the
   hyperlink bug, the four ungraded sections, and the unit-identity drift that whole-unit deletions
   would otherwise cause.

**Medium confidence.**

5. **Claim-first drafting is doing most of the work, and the plan buries it.** My rewrite transmitted
   better, and what I actually did in each unit was: figure out what it claims, then say that first
   in plain words. That is claim-first, applied by hand. The read-back proved the *measurement*
   works; it did not prove the *loop* is what produces the improvement.
   **Therefore my central recommendation: ship claim-first plus the read-back in shadow mode, and do
   not build the redraft loop until shadow data shows claim-first alone is insufficient.** Stage 2
   already runs claim-first for three nights before the loop turns on. That is an experiment. Extend
   it to two weeks and read it.
6. **Majority-of-3 should replace either-of-2.** The asymmetry is decisive even without knowing p: a
   missed distortion gets logged and another chance tomorrow; a false failure burns one of only two
   cycles tonight and rewrites good prose.
7. **The Grader should name which element broke** — actor, direction, magnitude, or causality. It
   already defines TRANSMITTED in exactly those four terms and then collapses to one word. Naming the
   element costs nothing and converts a symptom into a diagnosis. Without it, the writer's blunt
   inverse is "restate the claim earlier and more literally," which flattens voice while the numbers
   go green.
8. **Keep the style metrics as passive monitors.** They found this fire. Delete the enforcement, keep
   the charts, or there is no detector for the next slow slide — including the flattening this design
   can itself cause.

**Low confidence / genuinely unresolved.**

9. Whether a Haiku reader is the right proxy for a human listener at all, or whether it measures
   something adjacent that correlates today and drifts later.
10. Whether the writer will overfit to the reader, and how fast. The plan calls this a watch-item.
11. Whether open-book leniency and output-position degradation partly cancel, leaving the instrument
    accidentally well-calibrated. I have no way to guess and one shuffle test would tell us.

---

# PART 8 — THE OPEN DECISIONS

1. **Units defined by the claims file, or derived by the parser?** (I say claims file.)
2. **Majority-of-3, and does the Grader emit the broken element?** (I say yes to both.)
3. **Claim-first alone first, or the full loop?** (I say claim-first alone, measured for two weeks.)
4. **What gets deleted?** The system already has 20+ gates and its own improvement log says *"the
   checking layer is now a bigger attack surface than the writing layer"* — four of five recent fixes
   were defects *in gates*. This plan adds. Its anti-accretion guard is one sentence.
5. **The nineteen-minute window** on the super-brief task — measure and move the email task, or
   redesign the loop to fit.

---

# PART 9 — WHAT I WANT FROM YOU

Reason from mechanism. Disagree with me specifically where you disagree.

1. **Attack conclusion 5, my central recommendation.** Is "claim-first alone, measured" actually
   separable from the loop, or does claim-first decay without an enforcement signal — the way every
   other instruction in this system has decayed? The system's own history is that instructions
   without measurement fail and the honest, careful sentence is the one most likely to break a
   checker. Which side of that does claim-first land on?

2. **The Part 6.1 finding — the false claim transmitting as nothing.** Is this a general property or
   an artifact of one unit? If general, it implies something larger: that a comprehension measure is
   also a correctness measure for the entire class of errors that live *between* verified facts —
   the class that atom-checking gates structurally cannot see. That would be a bigger claim than the
   work order makes and I want to know if it survives scrutiny.

3. **The incentive geometry.** The writer authors both the claim and the prose, and only their
   agreement is measured. I have proposed a periodic extraction-mode audit as the counterweight. Is
   that sufficient, or does this design have a Goodhart failure that cannot be patched from inside?

4. **The alternative nobody has argued.** The owner reads the brief every morning and his ear is the
   real ground truth. Is there a cheaper design where thirty seconds of his attention *is* the
   measurement — for instance, marking the one unit he had to re-read — with the LLM instrument used
   only to scale what his marks teach it? Argue for it or against it properly.

5. **The deletion question.** Given twenty-plus gates and a six-month degradation none of them
   caught, is the correct move to add a better detector, or to delete most of them and rely on one
   outcome measure plus a human? Nobody has argued the aggressive version and I suspect it deserves
   a real hearing.

6. **What am I not seeing?** I have been inside this problem for a day, I was wrong once already in a
   way that took a correction to fix, and I authored one of the two artifacts I used as evidence.
   Name the thing I am too close to.
