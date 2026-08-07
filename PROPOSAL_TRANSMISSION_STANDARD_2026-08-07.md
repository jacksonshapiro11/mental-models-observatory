> 🔴 **SUPERSEDED 2026-08-07 by `WORK_ORDER_READBACK.md` (FINAL).** Kept as history and as citable evidence. Do not implement from this file — where it disagrees with the FINAL work order, the FINAL work order wins.

# PROPOSAL — The Transmission Standard

**Status: proposal only. Nothing implemented. Nothing on disk changed.**
**Date: 2026-08-07 · Scope: full brief + super brief + weekly, all surfaces**

This document obeys the standard it proposes. Short sentences. One idea each. If it is hard to read,
reject it on its own terms.

---

# PART 0 — THE MEASUREMENT

The premise was tested before the plan was written. Three measurements, all re-runnable.

## 0.1 The complexity is not length. It is sentence architecture.

Every published brief and super brief, scored on four axes.

**Full brief (`content/daily-updates/YYYY-MM-DD.md`, n=159):**

| period | words | mean sentence | >30-word sentences | negation-framed sentences |
|---|---:|---:|---:|---:|
| Feb–Mar | 5,731 | **15.4** | 9% | **2%** |
| April | 5,829 | 22.4 | 22% | 10% |
| May | 5,465 | 23.5 | 24% | 15% |
| June | 5,007 | 26.2 | 31% | 17% |
| July | 5,003 | 26.5 | 33% | 19% |
| August | 6,447 | 24.6 | 30% | **22%** |

**Read the first and last rows together.** February's brief was **longer** than July's — 5,731 words
against 5,003 — and its sentences were **40% shorter**. Negation-framing went from 2% of sentences to
22%, an eleven-fold rise, while the word count went sideways.

Length did not cause this. Length did not fix it either.

**Super brief (`content/daily-updates/YYYY-MM-DD-light.md`, n=115):**

| period | words | items | mean sentence | >30-word | negation-framed |
|---|---:|---:|---:|---:|---:|
| Mar–Apr | 1,284 | 7.1 | 18.1 | 12% | 7% |
| May | 1,421 | 7.1 | **17.1** | **10%** | **10%** |
| June | 1,584 | 7.4 | 20.0 | 18% | 13% |
| July | 2,153 | 10 | 22.6 | 25% | 17% |
| Aug (pre-two-tier) | 2,227 | 11 | 20.0 | 15% | 15% |
| **2026-08-07** | **1,872** | **17** | **23.0** | **30%** | **29%** |

Two things this kills:

1. **June is the proof.** June ran 7.4 items at 1,584 words — in band on length, near the old item
   count — and already at 20.0 mean sentence with 18% long sentences. The degradation predates
   two-tier by two months and predates the length inflation by one.
2. **2026-08-01 is the counter-proof.** 2,192 words, 11 items, and **17.1 mean sentence with 9% long**.
   Long and clear, on the same day, in the same pipeline. The two axes are independent.

## 0.2 A clarity rewrite does not shorten anything

Today's super brief was rewritten by hand at the proposed standard. Same 17 items. No item dropped,
no atom added, no atom lost.

| | words | items | sentences | mean sentence | >30w | negation | longest |
|---|---:|---:|---:|---:|---:|---:|---:|
| shipped | 1,872 | 17 | 79 | 23.0 | 30% | 29% | 61 |
| rewrite | 1,945 | 17 | 101 | **18.7** | **19%** | **19%** | **49** |

**The rewrite is 73 words longer.** That is the finding. Clarity was not bought with words. It was
bought by cutting the same content into 22 more sentences — one idea per sentence instead of two or
three. Words per idea barely moved. Sentences per idea went up 28%.

Worked file: `2026-08-07-light-REWRITE.md`.

## 0.3 What this means for the plan

- Do not touch the word rails. 1,300–1,600 and ~4,800 stay exactly as they are.
- Do not cut items. THE LINE stays. The deep tier stays. Coverage stays.
- The dial is **sentences per idea**, and nothing in the system measures it.

One honest caveat carried through the whole document: a deliberate, careful rewrite by hand landed at
18.7 / 19% / 19%. Better than today. Still short of May's 17.1 / 10% / 10%. **The target is reachable
but not on the first pass.** Every threshold below is proposed advisory-first for that reason.

---

# PART 1 — WHAT "SIMPLE" MEANS HERE

Not shorter. Not dumber. Not fewer stories.

**A sentence is simple when the reader can hold its whole claim without holding anything unresolved.**

That is the whole definition and it has three consequences.

1. **One claim per sentence.** A second claim forces the reader to park the first.
2. **The concrete noun before the abstract one.** "Medicare redrew the payment boundary" parks a
   referent. "Medicare put 700 hospitals on one fixed payment per patient" does not.
3. **The right answer before the wrong one.** "X is not A, it is B" makes the reader load A, then
   discard it. State B.

This is the Mark Twain standard made operational. The short letter takes longer because finding the
one-claim sentence is the work. Compression is not that work. Compression removes words and leaves the
inferential steps for the reader. Distillation removes the steps.

**They look identical on the page and they are opposites in the listener's head.**

---

# PART 2 — THE SIX WASTE FORMS, WITH RECEIPTS

Every example is verbatim from `2026-08-07-light.md` or `content/daily-updates/2026-08-07.md`.

### W1 — Restatement in technical register
The headline states the claim in plain words. The body restates it in jargon.

> **Headline:** "…what moved was not who goes to a nursing home but how long they stay."
> **Body:** "Under the earlier bundle the nursing-home share of discharges held while the average stay fell."

Fifteen of that item's 45 words are the headline said again, harder. **33% waste at constant length.**

### W2 — Negation-framing
> "Supply does not set the price. Whether the holder is a seller does."
> "The binding constraint was never the object. It was permission to use it."
> "Acedia is not the failure to move, it is the inability to stop."

Good once. At 29% of sentences it is a tic, it flattens every unit into one voice, and each instance
makes the listener load a wrong answer first. **Proposed budget: one per unit, never two in a row.**

### W3 — Abstraction before instance
> "American concrete is buying a growing share of its key ingredient out of ash ponds…"

The reader carries "key ingredient" unresolved into the next clause. Name the thing first.

### W4 — Orphaned stakes
> "That equity is priced on occupancy."
> "Prior expansions added collateral by adding risk."

No company. No referent. The reader cannot use the sentence, so the words are spent and return nothing.

### W5 — Compound headlines
> "**The market prices a September rate rise at a coin flip and nobody counts the votes, and a hike needs seven of twelve.**"

Three propositions, two conjunctions, one bold line. The bold line is the one thing a skimmer reads.
**Proposed: one claim per bold headline, no exceptions.**

### W6 — The counter in the last position
All four deep items on 08-07 end on the counter-case ("though…"). `Counter_Case_Standard.md` mandates
a ceiling on the counter's **length** and says nothing about its **position**. So the last thing the
listener hears is always the doubt, and the conclusion never gets to stay in the room.

### And the one that ties back to Wednesday's error

W1 and W3 are how "Warsh turning four colleagues" survived. The sentence was abstract enough that
nobody pictured twelve chairs. The true version — *"Warsh reverses his own vote and brings three of his
governors with him"* — is **shorter, simpler, and more interesting.** Correctness and clarity failed
together because they have the same cause.

---

# PART 3 — THE METRICS

Four mechanical proxies. Targets are **our own numbers from our own best work**, not borrowed from
broadcast style guides.

| metric | full-brief target | super-brief target | derived from | today |
|---|---:|---:|---|---:|
| mean sentence length | **≤18** | **≤18** | Feb–Mar 15.4 / May 17.1 | 22.8 / 23.0 |
| share of sentences >30 words | **≤12%** | **≤12%** | Feb–Mar 9% / May 10% | 27% / 30% |
| share negation-framed | **≤12%** | **≤12%** | Feb–Mar 2% / May 10% | 22% / 29% |
| longest sentence | **≤45** | **≤40** | May max ~45 | 61 |

**These are proxies and they are not the bar.** A unit can hit all four and still be unreadable. Their
only job is to make drift visible before a human notices it — which is exactly what did not happen
between February and August. The real bar is the qualitative test in Part 4.1.

**Proposed enforcement posture, and this is deliberate:**
- **Advisory for 14 days**, printing every run, on both products.
- Then set the blocking threshold at the **measured 14-day 75th percentile**, not at the target.
- Ratchet monthly toward the target.
- **Never blocking at the publish path.** Constitution I. The brief always ships. Enforcement lives in
  the generation loop under `--enforce-transmission`, exactly like `--enforce-length`.

---

# PART 4 — FILE BY FILE: THE SHARED STANDARD

These six files are upstream of both products. They change once and both inherit.

## 4.1 `system/Constitution.md` — Rule II

**Current (lines 23–35).** "Limit complexity — in the design and in the writing… **In the writing:**
one idea per unit. A 400-word block can carry three ideas and hide a weak one in the middle."

**The gap.** The unit is the smallest thing the Constitution governs. Every waste form in Part 2 lives
*below* the unit, inside the sentence. The law stops one level too high.

**Proposed change.** Extend the existing sentence, add nothing new:

> **In the writing:** one idea per unit, **and one claim per sentence.** A 400-word block can carry
> three ideas and hide a weak one in the middle; a 40-word sentence can carry three claims and hide
> a false one in the subordinate clause. *Compression moves work to the reader. Distillation removes
> the work. They look the same on the page.*

**Effect.** Gives every downstream doc a single citation. Nothing else in this proposal needs to argue
for itself; it all points here.

**Risk.** Rule accretion — the system's documented disease (`Root_Cause_Library` Pattern 4). Mitigated:
this is an amendment to an existing clause, not a fifth rule. **Net rule count unchanged.**

## 4.2 `system/Craft_Standard.md` — the contradiction, then Test 4

**Two changes. The first is a bug fix and it matters more than the addition.**

### (a) Fix the guardrail that is being read as license

**Current (lines 73–78), "THE GUARDRAIL: SUBSTANCE OVER STYLE":**

> "A long sentence that builds understanding and connects ideas across domains is better than a short
> sentence that sounds clever but says nothing. **The goal is never to be short.** … **The best bullets
> in the Brief Light are long, analytical, and substantive.**"

This was written to stop clever-but-empty one-liners. It is being applied to sentence length. The doc
defends a 61-word sentence in a spoken product, and it directly contradicts `Brief_Light_Generator.md`,
which asks for 36-word line items.

**Proposed change.** Keep the intent, name the level it operates at:

> "The goal is never to be short **at the level of the unit**. Cut ideas, not explanation. **At the
> level of the sentence the opposite holds: a sentence carrying two claims is one sentence too few.**
> Long bullets, short sentences. That combination is what February's briefs did and it is the
> combination we lost."

**Effect.** Removes the only sentence in the corpus that can be cited to defend the current prose.
This is the single highest-leverage line in the proposal.

### (b) Add Test 4 — The Transmission Test

**Current:** three tests — Insight, Grab, World. All three judge the *writer's thinking*. **None judges
whether the reader received it.** Grab is the closest and it measures pull, not comprehension.

**Proposed addition, after Test 3:**

> ### Test 4 — The Transmission Test
> Read the unit aloud once. Then say the claim in your own words without looking.
> If you cannot, the reader cannot, and the unit has not been written yet.
> Three specific failures this catches:
> - **A second claim in a sentence.** Split it.
> - **A pronoun or definite article whose referent is more than one sentence back.** Name it again.
> - **The wrong answer stated before the right one** ("X is not A, it is B"). State B.
>
> This is not a brevity test. The rewrite that passes is often longer.

**Effect.** Gives the Editor, the Critic, and both light critics one citable name. Currently the only
vocabulary for this failure is "too complex," which is not actionable.

**Risk.** Four tests instead of three is accretion. **Proposed subtraction to hold the count:** Test 2
(Grab) and Test 4 overlap on the "does the reader keep going" question. Merge Grab's *how to check*
paragraph into Test 4 and leave Grab as the pull test only. Net documented checks: unchanged.

## 4.3 `system/Deep_Analysis_Standard.md` — un-scope the gate that already exists

**This is the most important finding in the whole review.**

The system already contains the exact standard being asked for. Lines 51–55:

> **Transmission Gate (new).** Governs beats four and five. One gate, three questions:
> - *Clarity.* Would an educated professional outside this domain follow every line **on one read**,
>   without re-reading and without hitting needless jargon?
> - *So-what.* Does every claim that touches the reader's money, job, or choices travel all the way to
>   the consequence they feel?
> - *Monday.* If the reader closes this and nothing about their week changes, it failed.

It is well written. It is canonical. And it is **deliberately scoped away from the two products under
complaint.** `Craft_Standard.md` line 14: *"Short Dashboard and Six bullets are governed by this Craft
Standard alone."* The Transmission Gate applies only to the weekly deep dive and the Take.

Worse: the doc's own codification checklist (lines 87–95) lists four propagation steps. **Item 3 —
"Editor check: one Transmission Gate check replacing, not adding to, the overlapping prose checks
already in Brief_Editor.md" — is still marked *proposed*.** It was never done.

**The complexity complaint is the predicted consequence of an unfinished propagation, and the system
wrote down the prediction.**

**Proposed changes.**
1. Change the scope line to: *"The Clarity question governs **every unit of every product**. So-what
   and Monday remain scoped to deep-analysis pieces."*
2. Update `Craft_Standard.md` line 14 to match.
3. Close codification item 3 by doing it (see 5.2).

**Effect.** Zero new standards written. One existing standard extended to where it was always needed.
This is the cheapest change in the document and probably the largest.

## 4.4 `system/Counter_Case_Standard.md` — add position

**Current:** four tests — Attribution, Cost, Frame-not-forecast, and **PROPORTION — A CEILING, NOT A
FLOOR** (line 120): the counter never runs longer than the case.

Length is governed. **Position is not.** So all four deep items on 08-07 end on doubt.

**Proposed addition to the PROPORTION test:**

> **POSITION.** The counter never occupies the last sentence of a unit. Recency is the strongest slot
> a spoken product has, and it belongs to the claim. Order: case → counter → the one line that states
> what you still believe. If the counter is genuinely stronger than the claim, the unit's claim is
> wrong and the counter is the item.

**Effect.** The reader gets to keep the conclusion. Mechanically checkable (5.5, check 15).

**Risk.** Could be gamed by appending a hollow re-assertion after every counter. Mitigation: the
closing line must pass Test 3 (World) — a truth about how the world works, not a restatement.

## 4.5 `system/Brief_Length_Standard.md` — the firewall

**Current:** an excellent doc about word budgets, four places that now agree, and the rules that keep
generation in line.

**The risk it creates:** it is the only quality-adjacent doc in the system with hard numbers in it.
Numbers attract optimization. Part 0 shows the pipeline has been optimizing length while transmission
degraded underneath, unmeasured.

**Proposed addition, new §7:**

> ## 7. Length is not the clarity dial
> Measured across 159 briefs: mean sentence length rose from 15.4 (Feb–Mar) to 26.5 (July) while word
> count fell from 5,731 to 5,003. **We got shorter and harder to read at the same time.** A hand rewrite
> of the 08-07 super brief at full clarity came in **73 words longer.**
> Length and transmission are independent axes. When a unit fails the Transmission Test, cutting words
> is the wrong instrument and usually makes it worse, because the first thing compression removes is
> the explanation. Fix the sentence architecture. Then, separately, check the budget.

**Effect.** Stops the next person — human or agent — from reading the length rail as the quality bar.
This is the guardrail against exactly the mistake made at the start of this session.

## 4.6 `system/What_Great_Looks_Like.md` — re-anchor on our own work

**Proposed change.** Add a section with **three verbatim units from the Feb–March briefs** (mean
sentence 15.4, negation 2%) beside their nearest August equivalents, with the four metrics printed
under each.

**Effect.** The standard becomes recognisable rather than described. This system's own doctrine:
*"Demonstrate, do not name."* (`Deep_Analysis_Standard.md`, "Finished, not drafted".)

---

# PART 5 — FILE BY FILE: THE SUPER BRIEF

## 5.1 `system/Brief_Light_Generator.md` — the arithmetic does not close

**This is a live defect, independent of everything else in this proposal.**

The section budgets, added up:

| section | min | max |
|---|---:|---:|
| header + THE STORY OF THE DAY | 85 | 110 |
| THE UPDATE (4–5 × ~145) | 580 | 725 |
| THE LINE (8–12 × ~36) | 288 | 432 |
| MARKETS MINUTE | 75 | 90 |
| THE TAKE | 110 | 110 |
| INTERESTING THINGS (95 + 2×36) | 167 | 167 |
| MEDITATION + MODEL + CLOSE | 330 | 365 |
| **SUM** | **1,635** | **1,999** |
| **STATED TOTAL** | **1,300** | **1,600** |

**The floor of the spec is 35 words above the ceiling of the spec.** The maximum is 99 words above the
1,900 hard-block. Nobody added the column.

The writer is handed a budget it cannot satisfy. Something must give every night, and the thing that
gives is explanation — because it is the only line item with no number attached to it. This is a
complete mechanical explanation for why the product got denser without anyone deciding it should.

**Proposed changes.**

**(a) Make the arithmetic close, without cutting a single item.** Reconciled table:

| section | proposed | change |
|---|---:|---|
| header + STORY OF THE DAY | 85–100 | −10 at the top; today's lede is a 56-word list |
| THE UPDATE (4 × 120–135) | 480–540 | 145 → ~128; the words come out of W1 restatement, not explanation |
| THE LINE (8–12 × 40–46) | 320–430 | 36 → 43; **the line tier gets bigger, not smaller** |
| MARKETS MINUTE | 75–90 | unchanged |
| THE TAKE | 100–115 | unchanged in substance |
| INTERESTING THINGS | 150–170 | −17 at the floor |
| MEDITATION + MODEL + CLOSE | 300–345 | −30 at the floor |
| **SUM** | **1,510–1,790** | |
| **STATED TOTAL** | **1,300–1,600** | |

Still not closed at the top. **Two honest options, and this is the one number that needs your call:**
- **Option A:** raise the stated band to **1,450–1,750** (≈9–11 min) and keep the 1,900 hard ceiling.
  The spec then describes what the product actually is. Nothing is cut.
- **Option B:** hold 1,300–1,600 and make THE LINE elastic at 6–12 items, with the count set by what
  the day actually produced rather than by a floor.

I lean A. The band was set for a 5–7 item product and never revisited when the product became 17
items. A budget that has been missed every night for two months is not a constraint, it is a fiction.
Option A is not relaxing a constraint; it is writing down the constraint that already exists so the
arithmetic can be enforced for the first time.

**(b) Add sentence architecture to the section (new, after "Hard Constraints"):**

> **SENTENCE ARCHITECTURE (this product is heard, not skimmed).**
> One claim per sentence. One claim per bold headline. Target 18 words per sentence, hard cap 40.
> At most one "not X, but Y" construction per unit.
> A body sentence may not restate its own headline in more technical words. If the body needs to say
> the headline again, the headline was not written in plain enough words.
> Name the company, the agency, or the person before the abstraction that describes them.

**(c) Swap the reference example.** Currently `SUPER_BRIEF_DRAFT_2026-08-05.md`. Replace with the
worked rewrite at the new standard.

**Effect.** The generator stops asking for the impossible. The line tier gets *more* room per item,
which is where transmission is worst.

## 5.2 `system/Brief_Light_Critic.md` — a stale contract, and it is failing silently

**Live bug.** Check 2, verbatim:

> **Breadth (BLOCK).** 5-7 stories, dominant first. At least 4-5 distinct domains. No theme owns 2+
> stories… If breadth collapsed (one theme dominates, or **fewer than 5 stories**), BLOCK.

**This is the pre-two-tier contract.** File mtimes: `Brief_Light_Critic.md` Aug 5 23:11,
`Brief_Light_Generator.md` Aug 6 01:54. The generator moved to 4–5 deep + 8–12 line. The critic was
never updated.

Consequence: the critic has been judging a 17-item two-tier product against a 5–7-item single-tier
contract for three nights. Check 3 ("the three Craft tests, **per story**") is being applied to a
"story" the spec no longer defines. **The one adversarial craft pass on the super brief has been
running against the wrong document since the format changed.**

**Proposed changes.**
1. Rewrite check 2 to the two-tier contract: 4–5 deep, 8–12 line, ≥4 distinct domains across the deep
   tier, Signal holds a deep slot.
2. Add check 3b, **Transmission (BLOCK on systemic failure)**: apply Test 4 to every deep item and a
   sample of five line items. Two or more failures → BLOCK. Name the sentence and the waste form.
3. Add to the verdict file: the four metrics, printed, every night. Measurement before enforcement.

**Effect.** Restores the one human-judgement pass on this product. **This is the highest-value single
change in Part 5 and it is nearly free.**

## 5.3 `system/task-bodies-snapshot/brief-light/SKILL.md`

**Step 3** currently carries the generation instruction. **Proposed:** add the five sentence-architecture
rules verbatim from 5.1(b). Do not point at the generator — inline them.

**Why inline.** `WORK_ORDER_SUPER_BRIEF.md` Task 3 records the receipt: *"a task body contradicted a
system doc for seven consecutive nights and the task body won every time, because the task body is
the prompt."* A rule that lives only in a doc the task reads is a rule with a seven-night failure rate.

## 5.4 `~/Documents/Claude/Scheduled/brief-light/SKILL.md` — 🔴 LIVE, OUTSIDE THE REPO

**Not reachable from this session.** Only the repo is mounted.

**This is the file that actually runs tonight.** Everything in 5.1–5.3 is inert until this file
matches. The repo snapshot is a copy with no sync — `WORK_ORDER_SUPER_BRIEF.md` Task 3 flags it:
*"a stale copy that looks authoritative is worse than none."*

**Proposed:** you place it, same as the two-tier flip. And separately: either put the snapshot on a
sync check or delete it. It has now been a trap twice.

## 5.5 `scripts/brief-light-craft-gate.ts` — four new checks

Existing checks 1–12. Proposed 13–16, all mechanical, all zero-network, all advisory for 14 days.

**Check 13 — sentence architecture.** Compute the four metrics. Print every run. Under
`--enforce-transmission`, fail above threshold. Name the five worst sentences with word counts, so the
output is a worklist rather than a score.

**Check 14 — headline claim count.** A bold headline containing two independent clauses joined by
`and`/`but`/`,` and → warn, print the headline. Catches W5.

**Check 15 — counter in final position.** A unit whose last sentence opens with or ends on
`though` / `but` / `that said` / `the counter` → warn. Catches W6 and enforces 4.4.

**Check 16 — headline restatement.** Content-word overlap between a body sentence and its own headline
above ~60% → warn. Catches W1, the largest single waste form measured.

**Also proposed, unrelated but cheap:** check 8 (NO NEW ATOMS) matches on digits only —
`/\$?\d[\d,]*(?:\.\d+)?…/`. House style spells small numbers as words. "three of twelve" and "four
colleagues" are invisible to it. Add a spelled-number branch. This is the check that could have seen
Wednesday's vote error and structurally cannot.

**Risk, and it is real.** `2026-08-07-improvements.md` states it plainly: *"the checking layer is now
a bigger attack surface than the writing layer"* — four of five improvements that day were defects in
gates. And: *"when a check reads prose, the honest and careful sentence is the one most likely to break
it."* Four new prose-reading checks is exactly the wrong direction if they are treated as blockers.

**Mitigations, all three required:**
- Advisory-only for 14 days. No exceptions.
- Every check ships with a both-directions selftest and a false-positive control, per the IMP standard.
- **Check 16 is the highest-risk of the four** (a legitimate headline echo is normal writing). If its
  measured false-positive rate exceeds ~20% over the 14 days, drop it rather than tune it.

## 5.6 `scripts/brief-light-format-gate.ts`

**Change:** none to logic. If Option A in 5.1(a) is chosen, update `LIGHT_LEN_TARGET_HI` 1600 → 1750
and `LIGHT_LEN_TARGET_LO` 1300 → 1450. Leave `LIGHT_LEN_HARD` at 1,900 and leave the epoch alone —
never condemn the archive.

---

# PART 6 — FILE BY FILE: THE FULL BRIEF

The full brief is worse on every metric (Part 0.1) and has more surface area. Same standard, more files.

## 6.1 `system/Section_Generator_Core.md` — the chassis, and the leverage point

Line 53 is a section headed **"Craft Standard (the quality bar — every bullet)"**. Every section
generator inherits from here.

**Proposed:** add Test 4 and the five sentence-architecture rules **once, here.** Then add a one-line
pointer to each of the eight section generators rather than restating.

**Effect.** Eight files' worth of behaviour from one edit. Also the correct home per the Constitution's
own design rule: *"Four documents stating one number means three will drift."*

**Files receiving the pointer only:** `Markets_Macro_Generator.md`, `Companies_Crypto_Generator.md`,
`AI_Tech_Generator.md`, `Geopolitics_Generator.md`, `Wild_Card_Generator.md`, `Signal_Generator.md`,
`Discovery_Generator.md`, `Inner_Game_Generator.md`.

## 6.2 `system/Brief_Writer.md` (77k)

**Proposed:** one insertion where the length number lives, and nowhere else.

`Brief_Length_Standard.md` §4 rule 5 already establishes the principle: *"Any threshold the Writer must
hit belongs in the Writer's prompt. Enforcement downstream is a catch, not a substitute."* The four
transmission metrics are thresholds. They belong here, beside the 160/180.

**Also proposed:** rule 1 of that same section reads *"Write to length. Never write long and compress
after."* Add the parallel: **"Write in single-claim sentences. Never write compound and split after."**
Same logic, and splitting after is how W1 restatement gets created.

## 6.3 `system/Brief_Editor.md` (110k) — Gates 15 and 16

**Gate 15 (Craft)** currently runs Insight / Grab / World plus a dead-hedge scan.
**Proposed:** add Test 4 as the fourth read, and — per `Deep_Analysis_Standard.md` codification item 3
— it must **replace, not add to**, the overlapping prose checks already in the gate. Hold the count.

**Gate 16 (Compression to Budget)** is where the danger is. It is the only stage with rewrite authority
and its instruction is to compress. Left alone, it will hit budget by merging sentences, which raises
mean sentence length and makes transmission worse while the length metric goes green.

**This is the mechanism that most plausibly produced the Feb→July degradation.** Gate 16 was created to
fix a length regression. Length improved. Sentence length rose 40%.

**Proposed addition to Gate 16:**

> **Compression may never merge two sentences into one.** Cut a unit whole, cut a corroborating figure,
> cut the second explanation. Joining two sentences with "and" hits the word target and fails the
> reader, and it is how mean sentence length went from 15.4 to 26.5 while the brief got shorter.
> Re-run the transmission metrics after compression. If mean sentence length rose, the compression was
> the wrong kind and must be redone.

**Effect.** Closes the loop that made length and clarity trade against each other.

## 6.4 `system/Brief_Critic.md` (53k)

**Proposed:** add Transmission to the craft mandate, at the same severity as the existing craft checks,
and require the four metrics in the Critic's report.

**Note on scope discipline:** the Critic already issues 3 mandates a night and yesterday's #2 is already
carried forward and late. Adding a fifth judgement axis to an overloaded pass may buy nothing.
**Recommend: metrics reporting only in the Critic. The judgement lives in the Editor (6.3) and the
light critic (5.2), which are the stages that can actually fix the prose.**

## 6.5 `scripts/validate-brief.ts`

**Proposed:** the same four metrics as 5.5, same advisory-first posture, same `--enforce-transmission`
flag, same publish-path silence. One implementation shared with the light gate — extract to
`lib/transmission-metrics.ts` and call it from both.

**Why shared:** `Counter_Case_Standard.md` line 159 records the receipt for this exact mistake:
*"One implementation, not four."* Four copies of a metric will drift within a month.

## 6.6 `system/Take_Generator.md`

The Take is already governed by `Deep_Analysis_Standard.md` and therefore already under the
Transmission Gate. **Proposed:** no change beyond confirming the pointer resolves. Listed for
completeness, not because it needs work.

## 6.7 Task bodies — repo snapshots **and** live copies

Repo snapshots to update: `brief-draft`, `brief-editor`, `brief-critic`, `brief-quality-gate`,
`take-draft`, `weekly-draft`, `brief-light`.

**Live counterparts under `~/Documents/Claude/Scheduled/` are outside the repo and you must place them.**
Same rule as 5.4: the task body is the prompt, and the task body wins.

**Proposed minimum:** `brief-draft` and `brief-light` tonight. The rest can follow.

---

# PART 7 — FILE BY FILE: WEEKLY, AUDIO, SURFACES

## 7.1 `system/Weekly_Light_Generator.md` and `system/Weekly_Generator.md`

Same treatment as 5.1. The weekly two-tier is **inert until `2026-W33`**, so this is the cheapest
possible moment to fix it — before a single weekly ships in the format.

**Check the weekly's arithmetic the same way.** Band 2,000–2,400 / 2,700 hard, 5 deep + 9–16 line.
Rough sum: 5×145 + 12×36 + fixed ≈ 2,300. **Closes.** The weekly's numbers appear sound; the daily's
do not. Verify before shipping.

## 7.2 `lib/audio/text-preprocessor.ts` — `SECTION_INSTRUCTIONS`

**Not previously suspected. It belongs on the list.**

The section rewrite prompts sent to GPT-4o contain, verbatim:

- header comment: *"DO NOT OVERSIMPLIFY. The listener is smart. Keep the nuance…"*
- `The Dashboard`: *"Keep the full analytical depth. Simplify language, not thinking."*
- `The Take`: *"Give it full treatment, don't compress… Keep ALL the nuance."*
- `The Signal`: *"Do not over-simplify."*
- `Discovery`: *"Stay very close to the written text."*

**Five anti-simplification instructions. Zero instructions about sentence length.** The audio layer —
the one surface where sentence length matters most, because a listener cannot re-read — is instructed
against simplifying and never instructed to shorten a sentence.

The instructions are not wrong. *"Simplify the language, not the thinking"* is exactly right. But it
appears once, against four blunter "keep everything" directives, and the model will weight the blunt
ones.

**Proposed change.** Add to the shared header comment, so it applies to every section:

> **One claim per sentence.** Never join two of the written sentences into one. Splitting a written
> sentence into two is always allowed and usually right. The listener cannot re-read. Simplify the
> sentence, never the thinking.

**Effect.** Potentially large and entirely untested. The audio script is a distinct artifact from the
markdown and nothing currently measures its sentence length.

## 7.3 `scripts/audio-gate-regression.ts`

**Proposed:** add a check that computes mean sentence length on the **produced script**, not the
markdown, and warns if it exceeds the source by more than ~10%.

**Effect.** Detects the failure mode where a clarity fix in the markdown is undone by the GPT rewrite
before it reaches a listener's ear. Nothing watches this seam today.

## 7.4 `components/super-brief/SuperBriefViewer.tsx` and `components/daily-update/BriefViewer.tsx`

Carried over from Wednesday's item 2 — the intro quote.

The epigraph is already first in the markdown and already first in the audio (hard-injected before the
welcome/date prefix in `text-preprocessor.ts`). It is **not** first on the web. Both viewers render
`displayDate → product label → dailyTitle → epigraph → lede`.

**Proposed:** move the `brief.epigraph` block above the `brief.dailyTitle` block. ~line 328 in
`SuperBriefViewer.tsx`, ~line 1392 in `BriefViewer.tsx`.

**The real fix:** four surfaces render this brief and each chose its own order independently. Propose
one exported ordering constant consumed by viewer, email, and audio. Otherwise the next fix is also
three fixes.

---

# PART 8 — THE CORRECTNESS GAP, FOLDED IN

From Wednesday's review. Same root cause, so it belongs in the same pass.

## 8.1 `count:` truth rows — generalize IMP-137, do not copy it

IMP-137 built `causal-sequence-gate.ts` for inverted orderings and wrote down the transferable insight:
*"The power is the REQUIREMENT, not the parsing — the Writer cannot invert an ordering it is required
to record."*

**Proposed:** one more relation type, `count:`, for roll calls and N-of-M claims. The row records
total, threshold, current-for (named), the actor, and whether the actor is inside the current-for set.
The gate does arithmetic on the row. It never parses the prose.

You cannot fill in `actor: Warsh, in_current_for: false` and still write "four colleagues." **Filling
the row is the catch. The gate only forces you to fill it.**

## 8.2 Corrections are drafts

The vote error was written by the quality gate at T1, promoted to *"the bullet's edge-sizing number,"*
and shipped without re-verification.

`2026-08-07-improvements.md` already states the fix, about a different incident that morning:
**"A green exit code is a statement about the past, not a warranty on the artifact you just edited."**

**Proposed:** whatever the QG or Editor writes re-enters the same checks as first-draft text.
`Brief_Editor.md` and the `brief-quality-gate` task body.

## 8.3 The self-refutation test, made bidirectional

The 08-07 QG log applied exactly the right reasoning to the claim it killed: *"self-refuting inside its
own sentence."* It did not apply it to the claim it wrote.

**Proposed:** one line in the QG task body. Zero code. Catches this exact instance.

## 8.4 Why this belongs in a clarity proposal

The true sentence — *"Warsh reverses his own vote and brings three of his governors with him"* — is
shorter, plainer, and more interesting than the false one. **The clarity pass and the correctness pass
are the same pass.** Abstraction is where both failures hide.

---

# PART 9 — SEQUENCING, AND HOW THIS FAILS

## 9.1 Proposed order

**Stage 0 — measure, change nothing (1 day).**
Build `lib/transmission-metrics.ts`. Wire it advisory into both gates. Print nightly. Backfill the
archive. You get a baseline and a trend line before touching a single rule.

**Stage 1 — the free wins (same day).**
4.3 un-scope the Transmission Gate · 5.2 fix the stale light critic · 4.2(a) fix the guardrail
contradiction · 5.1(a) fix the arithmetic. **All four are corrections of existing defects. None adds a
rule. None needs code.**

**Stage 2 — the standard (day 2).**
4.1 Constitution · 4.2(b) Test 4 · 4.4 counter position · 4.5 length firewall · 6.1 chassis ·
6.2 Writer · 6.3 Editor Gates 15/16.

**Stage 3 — task bodies (day 2, requires you).**
5.4 and 6.7. The live files. Nothing before this is live until this happens.

**Stage 4 — gates with teeth (day 15+).**
Threshold set at the measured 75th percentile, not the target. Ratchet monthly.

**Stage 5 — audio and correctness (week 2).**
7.2, 7.3, 8.1–8.3.

## 9.2 The three ways this fails

**1. It becomes rule accretion.** Twenty-plus detectors and a 152-row registry already exist, and the
improvements file says the checking layer is now the bigger attack surface. **Guard: every addition in
this document names a subtraction or replaces an existing check. If net rule count rises, it was
implemented wrong** — `Deep_Analysis_Standard.md`'s own instruction.

**2. The gates get gamed toward the metric.** Mean sentence length is trivially satisfied by chopping
prose into staccato fragments, which reads worse than what we have now. **Guard: the metrics are
advisory and diagnostic. The bar is Test 4, which is a human read. If the metrics ever go green while
the product gets worse, delete the metrics.** They are instruments, not the standard.

**3. The live task bodies never get placed** and the whole thing is inert while the repo says green.
This has happened before, is documented, and is the single most likely failure. **Guard: Stage 0
prints the metrics nightly. If the numbers do not move within three days of Stage 3, the task body did
not land.**

## 9.3 What I am uncertain about

- **The negation-frame metric is the weakest of the four.** The regex catches legitimate contrastive
  writing. February's 2% suggests the signal is real, but it needs the 14-day baseline before anyone
  trusts it.
- **The audio layer (7.2) is untested and could matter more than everything else combined**, because
  the primary consumption is listening and nothing has ever measured the produced script.
- **My rewrite hit 18.7, not 17.1.** A careful hand pass did not reach the target. Either the target is
  wrong or it takes more than one pass. I do not know which yet, and Stage 0 is how we find out.
- **The 08-07 Take, at 145 words against a ~110 budget, and the Model at 149 against ~115** suggest the
  section-budget drift is wider than the two sections I checked. Worth a full audit before 5.1(a) is
  finalised.

---

# PART 10 — THE COMPLETE FILE LIST

| # | file | change | stage | needs Jackson |
|---|---|---|---|---|
| 1 | `system/Constitution.md` | Rule II: one claim per sentence | 2 | |
| 2 | `system/Craft_Standard.md` | fix guardrail contradiction; add Test 4; merge Grab | 1/2 | |
| 3 | `system/Deep_Analysis_Standard.md` | un-scope Clarity to all products; close codification #3 | 1 | |
| 4 | `system/Counter_Case_Standard.md` | add POSITION test | 2 | |
| 5 | `system/Brief_Length_Standard.md` | new §7 firewall | 2 | |
| 6 | `system/What_Great_Looks_Like.md` | Feb/Aug side-by-side with metrics | 2 | |
| 7 | `system/Brief_Light_Generator.md` | close the arithmetic; sentence architecture; new example | 1/2 | **band call** |
| 8 | `system/Brief_Light_Critic.md` | fix stale check 2; add Transmission; print metrics | 1 | |
| 9 | `system/task-bodies-snapshot/brief-light/SKILL.md` | inline the rules in Step 3 | 2 | |
| 10 | `~/Documents/Claude/Scheduled/brief-light/SKILL.md` | 🔴 LIVE — same | 3 | **yes** |
| 11 | `scripts/brief-light-craft-gate.ts` | checks 13–16; spelled-number branch on check 8 | 0/4 | |
| 12 | `scripts/brief-light-format-gate.ts` | band constants only, if Option A | 2 | **band call** |
| 13 | `lib/transmission-metrics.ts` | **NEW** — one implementation, both products | 0 | |
| 14 | `system/Section_Generator_Core.md` | Test 4 + architecture at the chassis | 2 | |
| 15–22 | the 8 section generators | one-line pointer each | 2 | |
| 23 | `system/Brief_Writer.md` | metrics beside the 160/180; write-in-single-claims rule | 2 | |
| 24 | `system/Brief_Editor.md` | Gate 15 Test 4 (replacing); Gate 16 no-merge rule | 2 | |
| 25 | `system/Brief_Critic.md` | metrics reporting only | 2 | |
| 26 | `scripts/validate-brief.ts` | call shared metrics; `--enforce-transmission` | 0/4 | |
| 27 | `system/Take_Generator.md` | confirm pointer resolves; no change expected | 2 | |
| 28–33 | 6 repo task-body snapshots | inline rules | 2 | |
| 34–39 | 6 LIVE task bodies | 🔴 outside repo | 3 | **yes** |
| 40 | `system/Weekly_Light_Generator.md` | same as #7; **inert until W33 — free window** | 2 | |
| 41 | `system/Weekly_Generator.md` | same | 2 | |
| 42 | `lib/audio/text-preprocessor.ts` | one-claim rule in `SECTION_INSTRUCTIONS` header | 5 | |
| 43 | `scripts/audio-gate-regression.ts` | script-vs-source sentence-length delta | 5 | |
| 44 | `components/super-brief/SuperBriefViewer.tsx` | epigraph above title | 1 | |
| 45 | `components/daily-update/BriefViewer.tsx` | same | 1 | |
| 46 | `lib/brief-render-order.ts` | **NEW** — one ordering constant, 4 consumers | 5 | |
| 47 | `scripts/count-relation-gate.ts` | **NEW** — `count:` truth rows | 5 | |
| 48 | `system/entity-bindings.json` schema | `count:` row type | 5 | |
| 49 | `system/task-bodies-snapshot/brief-quality-gate/SKILL.md` | corrections-are-drafts; bidirectional self-refutation | 5 | |
| 50 | `system/Improvement_Ledger.md` | rows for each of the above | all | |

**Two decisions needed from you before Stage 1:**
1. **The band** — Option A (1,450–1,750, write down the real product) or Option B (hold 1,300–1,600,
   make THE LINE elastic). Everything in #7 and #12 hangs on it.
2. **Whether the Critic (#25) gets a judgement role or reporting only.** I recommend reporting only.
