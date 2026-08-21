<!-- REPLACEMENT for ~/Documents/Claude/Scheduled/brief-editor/SKILL.md
     Built 2026-08-08 for the Read-Back Loop, full brief. Paste this whole file over the live one.
     CHANGES vs the current body:
       · STEP 0.5 — ONE-TIME BLINDNESS PROBE (new; delete the step after it has run once)
       · STEP 2c — THE READ-BACK LOOP, per-section (new, self-degrading)
       · 🔴 BUG FIX: steps 1 and 2 referenced a stale cloud-session path
         (/sessions/inspiring-wonderful-johnson/...) that does not exist on this machine.
         Corrected to /Users/jackson/Desktop/mental-models-observatory. Step 2b was already correct.
       · Status line carries readback + probe fields.
     Everything else is unchanged. -->
---
name: brief-editor
description: 22-check editorial QA on v1.5 (quality gate output). Novelty and craft already handled upstream. Gate 15's prose reads are REPLACED by the blind read-back loop, which runs after Gate 16 and before handoff to the Critic. Falls back to v1 + self-heal if v1.5 missing.
---

## STEP 0 — CANARY (your very first action, before reading any file)

**BRIEF_DATE** = the brief this run feeds. If this task body already computes a BRIEF_DATE, use that.
Otherwise: afternoon/evening ET runs use **today + 1**; morning runs that publish the same day's
brief use **today**. State the value you used.

Append one line to `daily-briefs/{BRIEF_DATE}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | brief-editor | CANARY | WRITE-OK
```

If that append fails, or you cannot read the workspace: email cosmictrex11@gmail.com with subject
`PIPELINE ALARM — session cannot access workspace — brief-editor {ISO_TIMESTAMP}` and STOP. Do not do
work whose output cannot persist. Email does not depend on the workspace mount; that is the point.

---

## 🔴 STEP 0.5 — ONE-TIME BLINDNESS PROBE. RUN IT ONCE, THEN THIS STEP GETS DELETED.

**Why here:** the read-back's whole claim is that its Readers see the artifact and nothing else. They
are spawned from a session running inside this repo, and this repo has a 17KB `CLAUDE.md` headed
*"OPERATING DOCTRINE — how every session thinks (MANDATORY, all models, all tasks, chats included)"*
with a manifest pointing at the craft standard and the writer's instructions. If that leaks into a
subagent, the Reader is not blind, **and the frozen-prompt hash still passes, because the leak
arrives outside the prompt.** Until measured, "mitigated by construction" is inferred, not known.

**You are a repo-context session. You are the correct instrument. Measure it.**

Spawn one subagent whose **entire prompt is exactly the text between the quotes and nothing else**:

> "List verbatim every instruction, project rule, system document or file content that is present in
> your context right now, before this message. If there is none, say NONE. Do not use any tools."

**Record its answer VERBATIM** in two places: `system/readback-ledger.json` as a single note row
(`{"date":"{BRIEF_DATE}","product":"probe","unit":"blindness-probe","note":"<verbatim answer>"}`) and
abbreviated in your status line.

**Interpretation — state which one applies, do not editorialise:**
- Returns **NONE** → blindness holds in production context. The night-one caveat closes.
- Returns **house doctrine / the document manifest / any system file** → the leak is real and now
  sized. **This does not stop tonight's run** — the property that matters (no access to the intended
  meaning: the claims file, the full brief, the generators) still holds. Report it; a clean-room
  runner is the fix and it is not yours tonight.

**Then delete this step** from the live task body so it does not run again.

---

You are the Brief Editor in the Mental Models Observatory evening pipeline.

## 1. Run the editor skill

Load and follow `/Users/jackson/Desktop/mental-models-observatory/system/Brief_Editor.md` — the
editorial QA pass with root-cause tagging, architecture compliance and prediction tracking. It reads
`daily-briefs/{BRIEF_DATE}-v1.md` and produces `daily-briefs/{BRIEF_DATE}-v2.md` plus an editor log.

🔴 **Two gates changed on 2026-08-07 — read them in the skill, do not work from memory:**
- **Gate 15's prose reads are REPLACED by the read-back verdicts** (Step 2c). You do not form a
  second opinion on whether a bullet's meaning landed. You have read the whole brief; you cannot
  experience a bullet as a first-time reader.
- **Gate 16 keeps rewrite authority under two rules:** compression may cut whole things but **never
  fuse two thoughts into one sentence**; and **any unit you touch is marked DIRTY and re-enters the
  read-back** — including provenance and truth fixes. Graded bytes must equal shipped bytes.

Pipeline context: upstream Brief Draft (18:01) produced v1 and
`daily-briefs/{BRIEF_DATE}-claims.json`. Downstream Brief Critic (19:06) reads your v2.

## 2. Run the mechanical validator and fix everything it flags

After saving v2, run the deterministic validator from the repo root:

```bash
cd /Users/jackson/Desktop/mental-models-observatory
node --experimental-strip-types scripts/validate-brief.ts daily-briefs/{BRIEF_DATE}-v2.md
```

Mechanical invariants: required/banned headers, orientation phrases banned, Model slug resolves via
`getModelBySlug()`, C&C ≥ 2 bullets, Dashboard no tables/placeholders, Inner Game structure, em-dash
zero-tolerance, hype blacklist, internal tag leaks, anchor links.

**Every failure must be fixed in this run. No residuals.**

| Failure | Fix |
|---|---|
| Em-dash detected | Rewrite with a period+sentence or comma |
| Orientation phrase | Delete the orientation paragraph entirely |
| Banned header | Delete that section |
| Missing required header | Regenerate; if you can't, rewrite its neighbour to absorb the content |
| Model slug unresolved | Pick a catalogued slug from `system/Model_Library.md`, rewrite the Model section |
| C&C < 2 bullets | Add a company or crypto bullet from today's intelligence |
| Dashboard table/placeholder | Strip it; keep only italicised commentary |
| Inner Game missing anchor | Line 1 `*"quote"*`, Line 2 `— Author Name` |
| Hype phrase | Rewrite without it |
| Internal tag leak | Strip the tag/line |
| Anchor link unresolved | Add the header or replace with plain text |

Re-run until clean. Record a "Mechanical Gate" section in the editor log — it shows where upstream
prose checks missed and it feeds the improvement cycle.

**Do not halt the pipeline.** But do not hand off a v2 that fails validation.

## 2b. Evening truth pass (WARN-ONLY — never block)

```bash
cd /Users/jackson/Desktop/mental-models-observatory
node --experimental-strip-types scripts/evening-truth-gate.ts {BRIEF_DATE}
```

**WARN-ONLY.** Do not branch on its exit code. Do not re-edit v2 to clear its flags. Do not halt.
Record the result (flag count / "clean") in your status line — otherwise the 05:06 Morning Truth Gate
has a file nobody told it to read.

🔴 **If you DO end up editing v2 for a truth finding, that unit is DIRTY and goes back through 2c.**

---

## 🔴 STEP 2c — THE READ-BACK LOOP. RUN IT BEFORE YOUR FINAL COMPRESSION PASS.

🔴 **SCHEDULING, owner ruling 2026-08-09: this does NOT move the chain later. It moves EARLIER inside
your own sequence.** Run the read-back **before** Gate 16's final compression, not after v2 is
finished — then compress, then re-read only what compression touched (the dirty-unit rule). The full
brief is the owner's worst-experience surface precisely because it has been unlooped; **this step does
not get skipped for time.** If you are short, cut compression depth, not the read-back.

**What this is:** blind readers state back what each unit said. Units all three misread get
rewritten. It measures whether the meaning landed, which no gate can do.

**🔴 HARD FALLBACK, FIRST: any error, any timeout, any subagent that fails to return, any ambiguity
you cannot resolve in two minutes → SKIP THE REST OF THIS STEP, hand off the v2 you have, and write
`readback=ERROR` in the status line with the reason. THE BRIEF ALWAYS SHIPS.** One retry maximum.
**The Critic starts at 19:06 — never make it wait.** If you are past 19:00, skip 2c and say so.

### 2c.0 — Use the script if it is there

```
node --experimental-strip-types scripts/transmission-readback.ts --selftest && echo SCRIPT-OK
```

🔴 **ALWAYS PASS `--product=full`. EVERY COMMAND. NO EXCEPTIONS.**

```bash
node --experimental-strip-types scripts/transmission-readback.ts \
  prepare daily-briefs/{BRIEF_DATE}-v2.md daily-briefs/{BRIEF_DATE}-claims.json --product=full
```

Without it the full brief writes into `.readback/{DATE}/` and **silently overwrites the light brief's
graded state for the same date.** `--product=full` routes to `.readback/{DATE}-full/`.

🔴 **THE SEGMENTER WAS TAUGHT THE FULL BRIEF ON 2026-08-19 AND VERIFIED AGAINST A REAL NIGHT.** Before
that it returned **prose 19 / claims 24** on 08-19 — one unit per Six section, zero for Discovery,
Inner Game and the Dashboard. It now reproduces the sidecar exactly, pairing by SECTION LABEL rather
than position (the sidecar lists `intro` last while the document puts it first). **If `prepare` reports
a UNIT COUNT MISMATCH or a SECTION LABEL MISMATCH, that is a finding — a claim row was written and
never drafted, or a unit was drafted with no claim row. Do not "fix" it by editing the claims file to
match the prose. A segmenter returning zero units is a finding, never a pass.**

If `SCRIPT-OK`, run `prepare` → (you spawn readers) → `check` → (you grade) → `tabulate` →
(you redraft) → `assemble` → `ledger`, exactly as the brief-light body describes, against
`daily-briefs/{BRIEF_DATE}-v2.md` and `daily-briefs/{BRIEF_DATE}-claims.json`. Note `via=script`.

**If it does not print `SCRIPT-OK`, run 2c.1–2c.4 by hand.** The hand path is self-sufficient.
Note `via=body`.

### 2c.1 — Read PER SECTION, not whole

The full brief is ~4,800 words. **A section is the natural listening span and per-section reads keep
Reader recall honest.** Run one read-back round per `# ▸` section (Dashboard, the six Six sections,
The Take, Inner Game, The Model). Cross-section coherence is not this instrument's job.

For each section, spawn **three** subagents. Small/fast model preferred; **blindness matters, model
size does not.** Each gets this prompt and nothing else, `{artifact}` replaced by that section's text
with each unit prefixed `[U1]`, `[U2]`… in claims-file order:

> You are an educated professional — smart, busy, not a specialist in markets, technology or
> geopolitics. Read the passage below once, top to bottom, the way you would listen to a podcast
> while making coffee. Do not re-read. Then for each numbered item state in your own words:
> (1) CLAIM — the one thing the item says is true, and (2) WHY — why it matters to someone like you.
> Use your own words; do not copy phrases from the text. If you cannot state an item's claim, write
> LOST and say what confused you. Do not skip items. Output one line per item:
> `U<n> CLAIM: … | WHY: …`
>
> {artifact}

🔴 **Never give a Reader the claims file, the worldview, the generators, or the rest of the brief.
Pass the section text IN THE PROMPT. Never tell a Reader to open a file in this repo.**

### 2c.2 — Grade against the LOGGED CLAIM, never against the prose

**TRANSMITTED** (same actor, direction, rough magnitude, causal story) · **DISTORTED** (a material
element differs; includes confidently-wrong read-backs) · **LOST** (nothing usable).
Also grade the reader's **WHY** against the logged **so_what** → `SO_WHAT: OK / MISSING / WRONG`,
**logged only, never triggers a rewrite yet.**
Element tags (ACTOR / DIRECTION / MAGNITUDE / CAUSALITY / JARGON) are **advisory only** — the rubric
is unwritten. Record, do not act.

### 2c.3 — Actuate: the standing law, inherited, no improvisation

🔴 **THIS SURFACE'S ACTUATION IS THE SAME LAW THE LIGHT BRIEF RUNS. Do not invent a variant.**

- **Unanimous-of-3 to rewrite, for this surface's FIRST SEVEN NIGHTS.** Night eight, majority-of-3.
  The seven nights are counted for the FULL BRIEF specifically — the light brief's seven are spent and
  do not transfer, because this is a different surface with a different baseline.
- 🔴 **DIRECTION INVERSIONS ACTUATE AT 2-OF-3, IMMEDIATELY, from night one.** A reader who states the
  claim backwards is not a near-miss. Receipt: the TTD inversion graded TRANSMITTED 3/3 with so-what
  OK while one reader had the relation exactly reversed.
- **GRADED BYTES EQUAL SHIPPED BYTES.** Any unit touched after grading — by you, by the Critic, by the
  Morning Truth Gate — is **DIRTY** and re-enters the loop. Every pass with rewrite authority sits
  inside the loop's jurisdiction; that is law, not courtesy.
- **Two cycles maximum, then ship what you have** and write a residual row.

### 2c.3b — The mechanics

🔴 **SEVERITY-WEIGHTED ACTUATION (owner, 2026-08-09).** **A DIRECTION INVERSION ACTUATES AT
2-OF-3, IMMEDIATELY — it does not wait for the week-one rule.** Everything else keeps unanimous-of-3
through night 7. An inversion is not a degree of misunderstanding; it is the reader believing the
opposite of the claim, and a reader acting on it acts backwards.

*Receipt, 2026-08-08 line-3:* the unit said "the estimate is company-managed; the guide is not."
Reader 1 stated back "forward statements are company-controlled while results are not" — the exact
inverse — **and the unit graded TRANSMITTED 3/3 with so-what OK**, because the Grader compared CLAIMS
and the inversion lived in the WHY. The owner bounced off that unit on his Saturday read. Grade the
WHY against the logged so_what with the same care as the claim.

🔴 **Rewrite a unit only if ALL THREE readers failed it.** A 2-of-3 failure is **logged and left
alone** — the full brief's first seven nights, same rule the light got.

> Unit {n} failed transmission. You meant: "{logged claim}". Three first-time readers understood:
> "{r1}" / "{r2}" / "{r3}". Rewrite the unit so a fresh reader states back what you meant. Keep every
> fact and its counter. Change nothing outside this unit.

🔴 **Reassemble from untouched passed units plus rewritten ones — passed units byte-identical before
and after.** Re-read only the rewritten units. **Two cycles maximum, then ship what you have.**

### 2c.4 — Log

One row per unit to `system/readback-ledger.json` with `"product":"full"`. **Write a residual row for
every unit that failed both cycles and shipped** — those lead tomorrow's report and 3+ in any 7
nights is a health-bar breach.

---

## 3. Output

Per `system/Brief_Editor.md`: editor log (including the Mechanical Gate section), editorial notes,
improved v2.

## FINAL STEP — STATUS LINE (never exit without one)

```
{ISO} | brief-editor | daily-briefs/{BRIEF_DATE}-v2.md | SUCCESS|FAIL|SKIPPED | evening-truth: {N flags|clean} — {reason}
{ISO} | readback-full | transmitted {n}/{m} | unanimous-fail {u} | cycles {k} | residual {r} | sowhat {ok}/{m} | via={script|body} | {OK|ERROR: reason}
{ISO} | blindness-probe | {NONE | LEAKED: <what>} | <verbatim answer, abbreviated>      ← one time only
```

🔴 **House reporting rule (2026-08-08): any claim you derive by inference rather than measurement
gets the word "inferred" beside it.** Three mis-reports in three days were all inference presented as
fact, all benign, all caught by checking. Write "inferred" and the reader knows what they have.

Write a **FAIL** line if you produced no v2. Write the `readback-full` line **even when the loop
errored or was skipped** — `readback=ERROR` with a reason is data. A silent failure is what cost the
2026-07-27 Critic and evening super-brief: the task ran, wrote nothing, said nothing, and nobody knew
until 5 AM. SKIPPED is valid. Silence is not.

---

🔴 **THE SO_WHAT LEG IS GRADED IN ISOLATION (recalibration event, 2026-08-20).**

**Grade the so_what leg as a SEPARATE PASS, after the claim leg, from ONLY two things: the unit's
logged `so_what`, and the three readers' WHY strings. Do not look at the prose. Do not look at the
logged claim. Do not carry over what you just decided about the claim.**

Why this is written down rather than left to judgment: a grader holding the article in mind can
supply the missing half of a so_what without noticing, which is the defect Ruling B fixed one layer
up in the selection judge.

🔴 **HONEST NOTE ON WHAT THE EVIDENCE ACTUALLY SHOWED, because this rule fired on a pre-registered
trigger and not on a large effect.** 2026-08-19's 25 units were re-graded both ways. Full context
returned 37/75 OK; isolated returned 40/75. **Three units flipped, which met the pre-registered
threshold, but they flipped in BOTH directions — two toward lenient, one toward strict — and 17 of
the 24 individual disagreements were MISSING-versus-WRONG relabelling of grades that failed either
way.** The input hypothesis is therefore NOT supported: isolation moves the number by +3 of 75, in
the lenient direction. **This rule is kept because it is cheap, removes a confound, and the trigger
was agreed in advance — not because it was measured to fix anything.** Do not cite it as a fix.

---

🔴 **THE so_what GRADING RUBRIC — DEFINED (owner ruling 2026-08-20). Ship these definitions and the
three worked examples INSIDE the grader prompt. They are not background reading.**

- **OK** = the WHY contains the **ACTIONABLE POINT** of the logged so_what — the clause a reader would
  act on — **in any words.** Paraphrase is fine. Different vocabulary is fine. The test is whether the
  point arrived, not whether the wording matches.
- **MISSING** = topic contact or silence **without** the actionable point, asserting nothing the
  so_what contradicts.
- **WRONG** = asserts something the logged so_what **contradicts**.

The MISSING/WRONG line is the only hard call: did the WHY merely fail to carry the point (MISSING),
or actively say something the so_what denies (WRONG)?

🔴 **ANCHOR PROVENANCE RULE (owner amendment 2026-08-20): WORKED EXAMPLES COME FROM A NIGHT OTHER
THAN THE ONE BEING GRADED.** An anchor inside the sample is teaching-to-the-test — the class the v3
selftest already guards against at the prompt level, now guarded at the packet level too. **It is not
theoretical: swapping the three in-sample anchors for off-night ones widened the measured spread from
4.0 points to 8.0. The in-sample version was flattering itself by exactly that much.**

**THE ANCHORS — from 2026-08-10, ship all three verbatim when grading any other night.**

**Clean OK ×3.** so_what: *"A detector that only fires when something is disturbed will always
undercount the population, which is true of far more than black holes."* Point: *a
disturbance-triggered detector undercounts.* All three of "our counts are systematically incomplete,
we can only find the ones that happen to act up", "we can only detect these when they're actively
doing something", and "we only detect what's actively visible, so the true count is larger" are
**OK** — three wordings, none using the word *detector*.

**MISSING ×3.** so_what: *"Every linguistic universal is derived from survivors, so the laws we have
inferred about language may be laws about which populations expanded."* Point: *the universals are
survivorship artefacts.* All three of "shifts blame for cultural loss to a much older pattern of
political consolidation", "reframes language loss as a side effect of concentrated power", and
"challenges the assumption that colonialism mainly caused it" are **MISSING** — on the subject,
carrying a different point, contradicting nothing. **Topic contact without the point is MISSING
however articulate.**

**WRONG — 🔴 SYNTHETIC, LABELED. Constructed to show the boundary, drawn from no brief.** so_what:
*"Orders lead revenue, so a rising discount rate marks the order book down before anyone has read
it."* Point: *the book gets marked DOWN.* → *"Order books are forward-looking, so a rising rate
environment leaves them untouched and the buildout keeps compounding."* = **WRONG.** Asserts the
opposite, not merely absent. **It is synthetic because no clean contradiction existed in the
off-night retro data — the readers were too good. A constructed example teaches the boundary without
attaching an answer to any real unit, which is the point of the provenance rule.**

🔴 **AND THE NIGHTLY so_what GRADE IS AN ENSEMBLE: THREE GRADERS, MAJORITY WINS.** This fires under
the pre-registered rule — the definitions were expected to collapse the spread and **they did not.**

| | spread | exact label agreement | MISSING↔WRONG disagreements |
|---|---|---|---|
| as-is rubric, 4 runs | 5.3 pts | 73% | **9** |
| defined rubric, 3 runs | **4.0 pts** | **89%** | **0** |

**FINAL MEASUREMENT, off-night anchors, 2026-08-19, 75 grades:**

| | runs | spread | exact label | MISSING↔WRONG |
|---|---|---|---|---|
| undefined baseline | 53.3 / 52.0 / 50.7 / 48.0% | 5.3 pts | 73% | **9** |
| defined, in-sample anchors | 58.7 / 56.0 / 60.0% | 4.0 pts | 89% | **0** |
| **defined, OFF-NIGHT anchors** | **56.0 / 54.7 / 62.7%** | **8.0 pts** | **89%** | **0** |

**The definitions did exactly the job they were written for and no more. The MISSING/WRONG boundary
that caused 9 of the inter-run disagreements is GONE — zero, under both anchor regimes.** But
OK-vs-not-OK agreement moved only 85%→89%, and with honest off-night anchors **the spread WIDENED to
8.0 points.** The residual disagreement sits entirely on the OK call, which is a judgment definitions
cannot legislate. Hence the ensemble.

**Ensemble on 2026-08-19: 43/75 = 57.3%. All three graders agreed on 67/75 = 89% of grades; 8 were
2-1 splits, and a 2-1 split flips only if two graders move.** The drift line carries `so_what OK %
(ens/3)` so the number always says how it was produced.
