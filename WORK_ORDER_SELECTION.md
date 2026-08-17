# WORK ORDER — SELECTION · PHASE A

**Order dated 2026-08-11. Executed 2026-08-15.** Four days separate them, so "the last 7 nights" is
the seven days ending 2026-08-15. Noted rather than silently re-dated.

**`WORK_ORDER_READBACK.md` is frozen and is not amended by this document.** Transmission (phase one)
asked whether a unit's meaning arrived. Depth (phase two) asked whether it was worth arriving.
**Selection asks the question underneath both: should this item have been picked at all.**

---

# PART 0 — THE ORDER, AS GIVEN

**PHASE A ONLY. Advisory. ZERO changes to live task bodies, generators, or anything that ships.
Phases B and C are pre-registered below and NOT authorized. Receipt table only; discoveries become
CARRY lines.**

- **ITEM 1 — SELECTION JUDGE.** `scripts/selection-judge.ts` on the read-back pattern: frozen prompt
  and hash, selftests, append-only ledger, denominators printed. Blind rules: the judge sees
  `Selection_Standard.md`, the shipped artifact, the briefing book and the take-ledger — **never
  generator rationale.** Per unit it grades **(a) belief-change** — the judge states it in one
  sentence or grades NO-STAKES; **(b) repetition** — advances a prior take, or REPEAT, against the
  take-ledger and cooldowns; **(c) reach** — pays with a transferable mechanism, or UNPAID-REACH.
  Verdicts SOUND / REPEAT / UNPAID-REACH / NO-STAKES, advisory. **DONE WHEN:** selftests pass
  including one known-answer case; a full run on the 08-10 brief completes with denominators.
- **ITEM 2 — RETRO RUN + CALIBRATION PACKET.** Run the judge over every archived night in the last 7
  (print which exist). Rows to `system/selection-ledger.json`. Then
  `SELECTION_CALIBRATION_2026-08-11.md`: judge grade per unit, blank owner column; the owner's known
  complaints (repetition, obscure, missing-boat) must appear among the graded units so his marks can
  test the judge. **DONE WHEN:** ledger rows and calibration table exist, denominators on both.
- **ITEM 3 — NIGHTLY FEEDBACK LOOP (advisory).** `BODY_selection-judge_NEW.md`: a NEW scheduled task
  (post-publish ~07:30) that grades last night's shipped brief, appends ledger rows, and adds ONE
  line to pipeline-status. Never blocks, never rewrites, never touches an existing task. The owner
  creates the task. **DONE WHEN:** the body exists; a dry run of its exact commands completes clean.
- **ITEM 4 — DOCUMENT.** This file, carrying the order and the pre-registrations. CARRY rows point at
  it. `WORK_ORDER_READBACK.md` stays frozen. Commit and push everything, tree clean at the end.

---

# PART 1 — RECEIPTS

| item | done | receipt |
|---|---|---|
| **1 · judge built** | ✅ | `scripts/selection-judge.ts`, `TEMPLATE_HASH fe0f152158ac9ebf`, prettier clean, `scripts/` is outside eslint and tsconfig so those two checks do not cover it |
| **1 · selftests** | ✅ | **19/19**, both directions: segmentation, `**Watch:**` exclusion, Dashboard exclusion, id uniqueness, and five grammar failures each caught — missing unit, REPEAT naming nothing, UNPAID-REACH with no reason, NO-STAKES carrying a belief sentence, a verdict with no belief sentence |
| **1 · known-answer case** | ✅ | the 2026-08-14 / 2026-08-01 hydro-relicensing repeat. Four assertions: the prior thesis is in the corpus the 08-14 judge reads, the re-run carries the same load-bearing actor, the graded night is excluded from its own priors, and no later night leaks in |
| **1 · full run on 08-10** | ✅ | 17 units · 454 prior leads / 30 nights · 37 take moves · 75 take history · `PROMPT_HASH a4ff7aae45a59cf9` |
| **2 · nights that exist** | ✅ | window 2026-08-09 → 2026-08-15. **08-09 has no full brief (Sunday); the other six do.** 08-10 (17), 08-11 (17), 08-12 (17), 08-13 (17), 08-14 (18), 08-15 (18) |
| **2 · ledger** | ✅ | `system/selection-ledger.json`, **104 rows**, one per unit, judge model recorded per row |
| **2 · denominators** | ✅ | **101 SOUND (97.1%) · 2 REPEAT (1.9%) · 1 UNPAID-REACH (1.0%) · 0 NO-STAKES (0.0%)** |
| **2 · calibration packet** | ✅ | `SELECTION_CALIBRATION_2026-08-11.md`, 104 rows with a blank OWNER column, all three complaint classes located, missing-boat lines per night |
| **3 · body** | ✅ | `BODY_selection-judge_NEW.md`. New task only; nothing existing touched |
| **3 · dry run** | ✅ | prepare on 08-08 live (17 units) · record with no judge output refuses correctly · record on a recorded night hits the double-record guard · tally prints · the status line appends to a scratch file. **Ledger unchanged at 104 rows** |
| **4 · document** | ✅ | this file |
| **4 · tree clean** | see PART 4 | the push path from this session is a standing CARRY item |

## The one leg that already passed

**2026-08-14 `signal:2` — the judge returned REPEAT and named `2026-08-01 signal:2` unprompted**, with
the shared FERC framing, the shared "roughly a third by 2030" claim and the shared IDACORP ticker.
That is the repeat where `novelty-gate` exited 0, the Critic graded it B and the quality gate was
clean. **Every production instrument passed it; this one did not.** The repeat was documented before
the judge existed and the judge was never told about it, which is what makes it held-out rather than
a demonstration.

## The number I trust least

**Zero NO-STAKES in 104 units, and 97.1 percent SOUND.** A judge that passes almost everything is the
shape of the Critic that rated nine of ten briefs Must-Read and was described in its own doctrine as
captured by the system it was evaluating. Two readings are open — the selection is genuinely strong,
or the judge is lenient — and **nothing in Phase A can separate them.** The owner's marks can.

---

# PART 2 — WHAT WAS BUILT

**`scripts/selection-judge.ts`** — mechanical half, never calls a model. `prepare` segments the
shipped brief into selection units, builds the blind packet and prints both hashes; `record`
validates the returned verdicts against the grammar and appends the ledger; `tally` prints the one
status line. Guards: a night already in the ledger is refused without `--force`; a missing verdicts
file is reported as an absence, not a clean sheet; zero segmented units is a hard stop.

**`system/Selection_Standard.md`** — the three legs and the four verdicts, derived from Ceiling
Doctrine v0.5 §1/§2/§5 plus the take-ledger's structural-move doctrine. **It did not exist before
today** (see PART 4).

**The blind packet** — the standard, the shipped artifact with unit ids prefixed, a prior-lead corpus
built mechanically from the 30 published briefs strictly earlier than the graded night, and the
take-ledger's moves and history. **No drafts, no take-draft, no quality-gate log, no critic report,
no predraft manifest.** The judges also ran in a clean container with no access to this repository at
all, which is the clean-room runner a standing CARRY row asks for, arrived at by accident of where
subagents run.

**A selection unit is a thing somebody chose to spend a slot on:** each Six bullet, each Signal item
with its `**Watch:**` folded in, the Take, Inner Game, the Model, Discovery. **The Dashboard is
excluded — it is data, not a choice.**

---

# PART 3 — PRE-REGISTERED, NOT AUTHORIZED

Written down now so that if they are ever built, they are built against a bar set before the results
were known.

## PHASE B — the writer-side candidate funnel

3-5 angles per deep slot, each with a belief-change one-liner; the losers are logged, not discarded.
One batched install round. **This is the only thing that makes the missed-boat class visible**, since
every instrument in Phase A reads only what shipped.

**GATE: the hindsight audit report delivered AND the owner's 16 blind marks in.** Neither has
happened. Phase B does not begin on the strength of a good Phase A result.

## PHASE C — any actuation authority

**GATE: the judge reproduces the owner's selection marks at the same calibration bar transmission
met.** Until then it only reports. No verdict from this instrument may block a publish, trigger a
rewrite, or be cited as quality evidence in any report.

**What "the same bar" means, so it cannot be renegotiated later:** sensitivity — it flags what he
flags; specificity — it stays quiet on what he passes; and both measured on marks he made without
seeing the judge's grades.

---

# PART 4 — DISCOVERIES → CARRY

Each of these is a CARRY row in `system/CARRY.md` dated 2026-08-15 pointing back at this file.

1. **`system/Selection_Standard.md` did not exist.** The order names it as an input the judge reads.
   I derived it and **every grade in the ledger inherits whatever is wrong with my reading.**
   Ratification owed before Phase C.
2. **The judge is lenient and the leniency is measured** — 0 NO-STAKES in 104 units. Calibration owed
   against the owner's marks.
3. **The order's "briefing book" input is NOT satisfied as written.** `World_Briefing_Book.md` is
   4.0 MB and the Tomorrow's Headlines register inside `Current_Worldview_v5.md` is 1.1 MB; neither
   fits in a prompt. The judge reads a mechanically-built prior-lead corpus with entity and figure
   fingerprints instead. **It caught the known repeat, so the substitute works for that class** — but
   it is a substitute, and the register of every thesis we have advanced is still unread by any
   instrument, which is a standing CARRY row of its own.
4. **Two segmenters now exist.** `transmission-readback.ts` splits the light brief by bold-led
   blocks; the full brief's Six bullets are list items, which that segmenter returns as one unit per
   section. `selection-judge.ts` carries its own. **If the two ever disagree about the same artifact,
   that disagreement is the defect.** Factoring one out touches shipping code, which this order
   forbids.
5. **Missing-boat is structurally invisible** to any instrument that reads only what shipped. Phase A
   cannot see it, Phase B is the only thing that can, and the calibration packet asks him for it
   directly instead of pretending otherwise.
6. **A leads-only corpus was blind to the repeat it was built to catch.** The 08-01 and 08-14
   relicensing units share no lead wording; "relicensing" appears only in their bodies and in one
   `**Watch:**` block. Caught by the known-answer case failing on the first run. Fixed by fingerprints
   and by folding `**Watch:**` into its Signal item.
7. **The file-staging bridge needs device paths, not session-mount paths.** Operational, cheap, cost
   two failed calls.

---

# PART 5 — HOW THIS FAILS

1. **The standard is mine, not his.** Every grade inherits it. Guard: ratification before Phase C,
   and the packet says so on its face.
2. **The judge is agreeable.** 97.1% SOUND. Guard: his marks, and a specificity leg that treats a
   quiet judge as a broken one rather than a good day.
3. **A blind judge cannot see a slot that was never filled.** Guard: pre-registered Phase B; until
   then, say it out loud everywhere the grades appear.
4. **The grades get cited as quality evidence before they mean anything.** Guard: the phrase is
   written into the nightly body — a SOUND verdict is evidence this judge did not object, nothing
   more.
5. **Repetition drifts into a novelty tax.** An update is not a repeat, and a system that punishes
   returning to a live story will stop compounding its theses. Guard: the standard says it; the ledger
   records what was named as the prior so a wrong REPEAT is auditable.
6. **Accretion.** Phase A adds one script, one standard and one advisory task. **It removes nothing,
   and it is allowed to remove nothing, because it has no authority yet.** The day it gains authority
   it inherits the read-back's rule: if net check count rises, it was implemented wrong.

---

# PART 6 — THE CONSOLIDATED ORDER OF 2026-08-16 (executed; this closes the work-order sequence)

**No new work orders after this. The weekly drift report is ONE line against the DECREE row in
`system/CARRY.md`. Day 30 is a design conversation, not an order.**

## C3 — CURIOSITY, AND THE MUNGER ROW CLOSING INTO IT

**The Part 12 reader-question check IS the curiosity detector.** It was pre-registered in
`WORK_ORDER_READBACK.md` PART 12.1 as the Question Test — a third Reader output, `Q:`, the one
question a reader would still ask. **Under this decree its purpose is renamed and kept: an unanswered
question is a hole when the unit failed, and it is CURIOSITY when the unit succeeded.** The same
signal, read against whether the unit landed. Question quality is logged with the panel. **Advisory.
Actuates nothing.**

**The Munger register row closes here, gate lifted by owner ruling.** It was blocked on the 16 blind
marks. It is now the last clause of the Clarity Standard, live tonight in `Craft_Standard.md`,
`Register_Standard.md` and both generators: *plain words, named actors, last line a rule of thumb the
reader could repeat at dinner.* The 16 marks are still owed — they calibrate, they no longer gate.

## THE PANEL, AS IT NOW STANDS

| reader | asks | hash | actuates |
|---|---|---|---|
| 3 × calibrated | did the meaning arrive | `TEMPLATE_HASH 8362e5b17930dd37` | yes, unanimous only |
| 1 × hurried | did it arrive in three minutes | `HURRIED_HASH ffa38d225eb2c135` | no |
| 1 × assumed-knowledge | **what did the writer assume I already knew** | own frozen hash, printed by `prepare` | no |
| question leg | what would I still ask | inside the reader template | no |

**Three of the four are advisory and that is correct.** A panel where everything actuates is a panel
that stops being an instrument and becomes a committee.

## WHAT DID NOT LAND, AND WHY

**D2 — the regenerated calibration packet.** The six ratified prompts are built on disk at
`INSTRUMENT_HASH 96c582e31dcd5ba7`; the judges run in a cloud container and **file staging is refused
with `session_stale_relogin`.** Blocked on one desktop re-auth. **The 08-11 packet is void as of
today, so there is currently no valid calibration packet** — that is the one real gap left by this
order.

---

# PART 7 — PHASE B CHANNEL DETERMINED, AND THE NIGHTLY JUDGE'S STANDING ARRANGEMENT (2026-08-17)

## ITEM 8 — the candidate log ships by DOCTRINE, as ADVISORY, now

**Measured before deciding.** All four deep slots already write a nightly pre-draft artifact:
`cc-predraft` (65 files), `signal-draft` (138), `take-draft` (109), `discovery-draft` (138). **The
tasks exist. The files exist. Only the C&C pre-draft logs candidates** — 5 a night, roughly 3
allocated, **so its losers have been on disk since May.** Signal, Take and Discovery draft the winner
directly and log zero.

**Therefore: logging is a DOCTRINE change, not a task-body install.** The pre-draft tasks read their
generator docs; adding "3-5 candidate angles, one line each, losers marked" to
`system/Signal_Generator.md`, `system/Take_Generator.md` and the Discovery generator makes the pool
exist tonight, with no install and no scheduler change. **Shipped as ADVISORY.**

**What still needs a task body, and therefore waits for the batched round:** *surfacing.* Showing the
losers to the owner in the nightly status line — so the pool is visible without opening four files —
is a status-line change inside task bodies. **That is the half that waits.**

**Phase B's gate is unchanged.** This is the candidate log arriving early as an artifact, not Phase B
opening. The funnel becomes Phase B when the losers are surfaced and the tie-break is enforced rather
than advised.

**Item 7 is embedded as its selection tie-break:** consequence outranks cleverness; an obscure pick
must beat the bigger story on insight, never on novelty.

## ITEM 12 — the nightly judge, standing arrangement

Until the owner rules on the API-key question, **the safe half is official rather than a nightly
SKIPPED.**

- **STEP 1 `prepare` ALWAYS runs, and the status line ALWAYS prints the mechanical numbers.** Volume
  against the band needs no judge, and it is **the binding decree number** — the one showing red on
  most nights. A task that prints nothing because the graded half is unavailable throws away the half
  that works.
- **Grading steps are marked PENDING CLEAN-CONTAINER BATCH.** This session grades accumulated packets
  in its clean container whenever the owner pings *"grade the backlog."* **Provenance stays
  clean-container, and those rows never pool with any in-session run.**
- **The blindness probe stays in the body as a standing check.**

**Why the batch is not a workaround.** The clean container is the *better* provenance: judges there
have no repository access at all, which is the clean-room runner a standing CARRY row has been asking
for since 08-10. The nightly path would have to reach that bar anyway.

