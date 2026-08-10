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
| **TTD / beat-rate** | *(added 2026-08-09 from an owner mark)* The unit asserts a counterintuitive inversion — analyst estimates are the managed number, the guide is the real commitment — in seven words with no unpacking. **Unpack it or drop it.** It graded TRANSMITTED 3/3 with so-what OK and the owner still bounced off it, which is the exact signature phase two exists to catch. |

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

---

# PARTS 9–11 — RESERVED

Deliberately unallocated. Phase-one addenda land here in sequence so phase two keeps the number the
owner gave it. An empty slot is cheaper than a renumbering.

---

# PART 12 — PHASE TWO: DEPTH

**Opened by owner ruling, 2026-08-09: "Transmission was phase one. Substance is phase two."** Phase
one asked whether the meaning arrived. Phase two asks whether the meaning was worth arriving.

**The receipt that phase one is blind to this.** Every unit in PART 7's claim-quality queue graded
**TRANSMITTED**. China, Medicare, Atlassian and AISI all landed cleanly in three readers' heads and
the owner rejected all four anyway. Five of six are one defect — **the unit reports a mechanism and
declines to say what it means** — and the read-back cannot see it, because a finished sentence about
an unfinished thought transmits perfectly. Phase one measures arrival. Nothing yet measures whether
anything was sent.

**Two instruments, one new model pass.** The Question Test rides the existing Reader as a third
output. The Challenger is the only new pass, and it is capped at six units a night.

## 12.1 — THE QUESTION TEST (reader side)

Readers already state CLAIM and WHY. They now state one more thing: **the one question they would
still ask.** A question is a hole in the unit, reported by the only party qualified to find it — the
person who read it once and has no idea what the writer knew.

The output line becomes: `U<n> CLAIM: … | WHY: … | Q: …`

**The Grader classifies the question. No new pass.** Four classes, each earned from an owner mark on
2026-08-07:

| class | the question it names | owner receipt |
|---|---|---|
| **INTENT** | why did the actor do this | China — *"I don't get why China did this — that's what we're missing."* |
| **INCIDENCE** | who wins, who loses, who pays | Medicare — *"Who does this benefit, who is making money, who does it hurt?"* |
| **MECHANISM** | why did the stated effect follow | Atlassian — *"Why did it go up — we're missing the deeper point."* |
| **READ** | which of the live readings is ours | AISI — *"Is this saying Mythos's safety language is terrible, or generalising that frontier AI is just smarter?"* |

Anything else logs as **OTHER** and never fires a flag until it earns a row here from a real owner
mark. **The taxonomy grows from marks, not from imagination.**

**A DEPTH FLAG fires when two of three readers ask a question of the same class about the same
unit.** The flag carries **all three questions verbatim** — the class is the index, the question is
the evidence. A depth flag on a unit that graded TRANSMITTED 3/3 is the normal case and the entire
point of the instrument.

## 12.2 — THE CHALLENGER (writer side)

One pass, three fixed attacks, run **after the claims are logged and before the draft is final**, on
a bounded set: **The Take, every LINE unit, and any unit already carrying a depth flag — six units
maximum, Take first.** It sees the unit, its logged `claim`, and its logged `so_what`. It does not
see the rest of the brief, for the same reason the Readers do not.

1. **The unfinished-thought attack.** Name the step between the mechanism and the meaning that this
   unit skips. If there is none, say so plainly.
2. **The so-what attack.** Does the logged `so_what` follow from the logged `claim`, or is it pasted
   on? Test: **if the claim were false, would the so_what change?** If not, it is decoration.
3. **The novelty attack.** Has this claim, or its framing, run before? Cite the prior brief or the
   Take log, or state that it is new.

**The writer answers every attack, three dispositions, all recorded:** **ANSWERED** (the unit
changed — which marks it **DIRTY**, and dirty units re-enter the read-back, law 1 below) ·
**DECLINED** (one line of reason; a good unit survives an attack and the record should say so) ·
**DEFERRED** (to PART 7's queue, with the story named).

## 12.3 — ACCEPTANCE CRITERIA (exists ≠ runs)

| item | the criterion | the proof | where it shows |
|---|---|---|---|
| **`so_what` required in the sidecar** | `prepare` exits non-zero on any row whose `so_what` is missing or under four words — the guard `claim` already has, as `UNGRADEABLE_SO_WHAT` | selftest case asserting the throw, plus a negative control: strip one `so_what` from a copy of a live claims file, re-run `prepare`, expect exit 1 | nightly status line `sowhat-validated=N/N` |
| **the challenger is visible** | every challenged unit's ledger row carries a non-empty `challenge` array of `{attack, response, disposition}` | query A below, run against `system/readback-ledger.json` | nightly report and weekly rollup |
| **flags carry the question** | every depth-flag row carries `class` and `questions` with one verbatim string per reader | query B below returns `0` malformed **and prints its denominator** | nightly report |

**The two queries, copy-pasteable, denominators included** (`DATE` is the ledger date):

```bash
# A — challenger rows exist and are non-empty.  Prints  challenged/total.
jq -r --arg d DATE '[.[]|select(.date==$d and .product!="probe")] | "\(map(select((.challenge//[])|length>0))|length)/\(length) challenged"' system/readback-ledger.json

# B — every depth flag carries its questions verbatim.  Prints  malformed/flags.
jq -r --arg d DATE '[.[]|select(.date==$d)|select(.depth_flag!=null)] | "\(map(select(((.depth_flag.questions)//[])|length<2))|length)/\(length) malformed"' system/readback-ledger.json
```

**A zero is a claim and needs the same proof as a one.** Any nightly query that returns zero prints
the denominator it searched. Receipt: the `owner_mark` filter that reported a clean zero because
every row carried the key with a null value — a false clean-zero is the exists ≠ runs failure
wearing a query.

## 12.4 — THE CALIBRATION BAR (written before building)

**Fixture, both arms named in advance.** Sensitivity: the **shipped** 2026-08-07 super brief —
`daily-briefs/2026-08-07-light.md`, units **2 China, 6 Atlassian, 7 Medicare, 12 AISI** in
`STAGE0_CALIBRATION_TABLE_2026-08-07.md`'s numbering. Specificity: **Sunday 2026-08-09** —
`daily-briefs/2026-08-09-light.md`, the six units the owner read and did not mark, each
TRANSMITTED 3/3 with so-what OK 3/3: **`update-2`, `line-4`, `line-5`, `markets-minute`, `model`,
`interesting-2`.** **Three replicas each arm.**

**The bar:**

- **Sensitivity — 4/4, at matching class, in at least two of three replicas per unit.** A flag of the
  wrong class is a miss, not a partial. The instrument has to find the hole the owner found, not
  merely be uneasy about the unit.
- **Specificity — at most one false flag across all eighteen unit-replicas** (six units × three).
- **Challenger, same fixture:** on the four, at least one attack per unit that names the missing
  step, owner-judged; on the six, no attack the owner calls noise.

**Until both pass, neither instrument has any authority.** Flags and attacks are written with
`"status":"UNCALIBRATED"` **in the ledger row itself**, not only in the report; they cannot trigger a
redraft and cannot make a response mandatory. **Report the table in phase one's format:** unit ·
owner's question · replica 1 / 2 / 3 class fired · verdict.

## 12.5 — TEMPLATE DISCIPLINE: RECALIBRATION EVENT R2 (2026-08-10)

**Two pending changes, one event. Never two recalibrations where one suffices.**

- **(a) The entity flag** — owner ruling 2026-08-08, deferred deliberately so it would not orphan the
  34 owner labels mid-week. The Reader emits `ENTITY?` naming any actor it cannot identify from the
  passage alone. Receipt: neither audio reader could identify Helix; both produced a claim with a
  hole where the actor should be.
- **(b) The Question Test's third output** (12.1).

Both land in **one** edit to `READER_TEMPLATE`. **Old `TEMPLATE_HASH 8362e5b17930dd37` retires
here.** The new hash is printed by `--selftest`, recorded in this section by amendment on the day it
lands, and stamped into every ledger row as `promptHash` — so pre-R2 and post-R2 rows can never mix
silently.

**Re-run before authority: the 08-07 pair-3 calibration against the new template, three replicas —
shipped versus rewrite, re-establishing the 80% / 94% baseline. Report the delta.** A move over five
points on either arm goes to the owner before either instrument proceeds. An instrument is not
allowed to quietly become a different instrument.

**PENDING TEMPLATE CHANGES (queue):** empty after R2. Anything new queues here and waits for the
next event.

## 12.6 — ADVISORY FIRST, WITH THE TRIGGER WRITTEN NOW

**Nights 1–7 — logged only.** No response required, no redraft triggered, nothing blocks. A night is
a read-back run carrying a post-R2 `promptHash`; **the count is by hash, not by calendar, so a
skipped night does not advance it.** On the current schedule that is ledger dates **2026-08-11
through 2026-08-17** (R2 lands in the day on 08-10; the 08-10 evening run drafts BRIEF_DATE 08-11).

**Night 8 — ledger date 2026-08-18 — actuation begins**, or earlier only by owner ruling:

- every challenged unit must carry a response; a missing response is a **residual row**.
- every 2-of-3 depth flag must be **answered in the unit or declined in the ledger with a reason**.
- **If the calibration bar has not passed by night 8, actuation does not begin.** The clock does not
  confer authority. Calibration does.
- **Nothing in phase two blocks publication. THE BRIEF ALWAYS SHIPS.**

## 12.7 — REPLACE, NOT ADD

| removed | why the phase-two instrument does it better | replaced by |
|---|---|---|
| **Critic Phase 1, Take test — Contrarian Test** | asks whether a Take disagrees with consensus, from inside the writer's own context | challenger attack 3, with the record in hand |
| **Critic Phase 1, Take test — Action Test** | "would I do anything differently" is the so-what question put to the one party who cannot answer it honestly | Question Test (INCIDENCE / READ) + challenger attack 2 |
| **Critic Phase 1, Discomfort Question — "What's missing that matters?"** | the Critic guessing what a reader would miss. Three readers now say it, verbatim, in their own words | depth flags |
| **Critic Phase 3, item 7 — "What I wanted instead", for any unit the challenger attacked** | a second, parallel wish-list written after publication, which changed nothing | the Critic **adjudicates** the existing attack-and-response record instead of generating a new one |
| **Light critic check 4 — the "read / turn" half (WARN)** | a prose judgment about whether a story has a read; a fact-only story now produces a reader question | depth flags. The BLOCK-if-pervasive escalation stays, driven by flag count |

**Net: five checks out, two instruments in — net −3, one new model pass.** Eight Take tests become
six; five Discomfort Questions become four. **If the net check count rises, it was implemented
wrong** (PART 8, guard 6).

**Consequential edits, to land with the removals:** the Take-novelty rubric's *"passes all eight
tests INCLUDING anchor test"* reads **"all six tests"** from R2 — the anchor test stays mandatory and
the 1–5 scale is otherwise untouched. **Verify before landing that `scripts/ceiling-scorecard.ts`
does not key off the test count**; Must-Read is a fixed conjunction and must not move by accident.

## 12.8 — THE STANDING META-RULES, AS LAW

1. **Any pass with rewrite authority sits inside the loop's jurisdiction.** Third instance of the
   class made it permanent. Phase two: an ANSWERED challenge marks its unit DIRTY, and the Morning
   Truth Gate diffs its own changes and re-reads what it changed.
2. **A canonical filename is a staging slot.** The superseded occupant is renamed out of the pattern
   the moment it is superseded. A stale file at a canonical name is invisible by construction.
3. **Anything synthetic is labeled in the artifact, not only in the report.** Phase two: uncalibrated
   flags carry `"status":"UNCALIBRATED"` in the row; fixtures carry the label in the file.
4. **Anything inferred is labeled "inferred" in the report.** Receipt: three mis-reports in three
   days, all inference presented as measurement, all benign, all caught only by checking.
5. **A zero is a claim** (12.3).
6. **THE BRIEF ALWAYS SHIPS.** Any error, any timeout, any ambiguity that cannot be resolved in two
   minutes: skip, log the reason, hand off.

## 12.9 — HOW PHASE TWO FAILS

1. **The challenger becomes a rubber stamp** — bland attacks, blanket declines. Guard: the decline
   rate is a reported number. A week above 90% declines is a challenger failure, not a writer
   vindication.
2. **The Question Test measures curiosity, not holes.** Readers always have a question. Guard: the
   2-of-3 same-class rule and the specificity bar. **If strong units flag, the instrument is broken,
   not the brief.**
3. **Depth flags become a length ratchet** — every flag answered by adding a sentence, and the brief
   inflates back into the thing phase one fixed. Guard: answering a flag may not raise the unit's
   word count on net, and the length bands stay live and blocking.
4. **The writer games the so_what** with one true of anything. Guard: the counterfactual in attack 2,
   `UNGRADEABLE_SO_WHAT` on the mechanical side, and the monthly extraction audit.
5. **Two instruments, one bill** — cost and latency against a 19:06 handoff. Guard: six-unit cap,
   Take first, hard fallback.
6. **The writer learns to write for the challenger.** Guard: the owner's marks stay the constitution
   and the four classes only grow from marks.

## 12.10 — ORDER OF LANDING

**P0** — this section. **No instrument builds before its contract exists.**
**P1** — `so_what` required and validated in `prepare`, with its selftest case and negative control.
Mechanical, no template change, lands independently of R2.
**P2** — R2: entity flag + Question Test in one template edit; new hash recorded; pair-3 re-run and
the delta reported.
**P3** — the calibration bar, both arms, three replicas, table reported.
**P4** — the challenger, built only after P3 passes.
**P5** — advisory nights 1–7, then the night-8 trigger.
