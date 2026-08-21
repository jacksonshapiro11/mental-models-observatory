<!-- REPLACEMENT for ~/Documents/Claude/Scheduled/brief-light/SKILL.md
     Built 2026-08-07 for the Read-Back Loop, night one. Paste this whole file over the live one.
     Changes vs the 2026-08-05 body: Step 3a CLAIM-FIRST (new) · band 1,300-1,600 → 1,450-1,750 ·
     Step 4b READ-BACK LOOP (new, self-degrading) · status line carries readback fields.
     The loop needs NO new script. If scripts/transmission-readback.ts exists it is used for the
     ledger; if it does not, this body writes the ledger rows itself. Either way the loop runs. -->
---
name: brief-light
description: Generate Brief Light — compressed two-tier version of the full brief from the edited v2 draft (4-5 deep stories + THE LINE breadth tier; every full-brief story appears). CLAIM-FIRST is mandatory: every unit's claim and so_what are written BEFORE the unit is drafted. A blind read-back loop runs before publish. CRAFT STANDARD: system/Craft_Standard.md is MANDATORY reading. FRESHNESS MANDATE: no 4+ word overlap with yesterday's Markets Minute.
---

## STEP 0 — CANARY (your very first action, before reading any file)

**BRIEF_DATE** = the brief this run feeds. If this task body already computes a BRIEF_DATE, use that.
Otherwise: afternoon/evening ET runs use **today + 1**; morning runs that publish the same day's
brief use **today**. State the value you used.

Append one line to `daily-briefs/{BRIEF_DATE}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | brief-light | CANARY | WRITE-OK
```

If that append fails, or you cannot read the workspace: email cosmictrex11@gmail.com with subject
`PIPELINE ALARM — session cannot access workspace — brief-light {ISO_TIMESTAMP}` and STOP. Do not do
work whose output cannot persist. Email does not depend on the workspace mount; that is the point.

## Step 1: Load the skill

Read `system/Brief_Light_Generator.md`. This is the complete specification. Follow it exactly. Where
this task body and that file disagree, THE GENERATOR WINS — report the discrepancy in the status line
instead of improvising.

## Step 2: Compute the date and find the v2 draft

BRIEF_DATE = today + 1 day (the reading date, same as the full brief).

**CRITICAL: be thorough. Do NOT conclude the draft doesn't exist after one failed search.** Glob can
silently fail on path resolution. Try ALL of these before concluding anything:

1. `Read` the absolute path `/Users/jackson/Desktop/mental-models-observatory/daily-briefs/{BRIEF_DATE}-v2.md`
2. `**/daily-briefs/{BRIEF_DATE}-v2.md`
3. `**/daily-briefs/{BRIEF_DATE}*.md`
4. `**/daily-briefs/2026-*.md` and scan for your date

If you find v2, use it. If only v1 exists, use v1.

---

## Step 3a — 🔴 CLAIM-FIRST. DO THIS BEFORE YOU WRITE ANY PROSE.

**This is step zero of every unit, not a review step.** Read the full brief end to end, choose your
units, then — before drafting a single sentence of the light — write two lines per unit:

1. **CLAIM** — what the unit says is true, in one breath, the way you would say it across a table.
   **A named actor and a direction.** Not a topic. Not a question. Not "X is interesting."
2. **SO_WHAT** — why it matters to a smart, busy non-specialist. What they now know, do, or watch.

**If you cannot say the claim in one breath, you have not finished thinking. Do not start the unit.**

**🔴 A unit that reports a mechanism must say what it means. State the so-what or do not run the
unit.** Measured on 2026-08-07: of the units Jackson rejected on a blind read, **8 of 11 were
rejected for exactly this** — *"I don't get the so what"* — and every one had already passed a cold
reader's comprehension check. Describing a mechanism and declining to interpret it is the most common
defect in this product. It is a thinking failure, not a writing failure.

Write the file **before drafting**, one row per unit, in the order the units will appear:

`daily-briefs/{BRIEF_DATE}-light-claims.json`
```json
[{"unit":"update-1","section":"THE UPDATE","claim":"...","so_what":"..."},
 {"unit":"line-1","section":"THE LINE","claim":"...","so_what":"..."},
 {"unit":"take","section":"THE TAKE","claim":"...","so_what":"..."}]
```

🔴 **The claims file DEFINES the units.** Every unit gets a row — including `THE TAKE`, `MARKETS
MINUTE` and the meditation practice, which are not bold-led and which no parser has ever assigned.
On 2026-08-07 Jackson's harshest verdict — *"unclear to me in every way"* — landed on THE TAKE,
the one unit nothing had ever graded.

## Step 3: Generate the Brief Light (two-tier)

Now draft, building each unit around the claim you already wrote.

1. **Rank every story by consequence × contestability.** A story earns depth because its conclusion
   could be wrong — and the item must say how.
2. **Select 4–5 deep stories for THE UPDATE.** 🔴 THE SIGNAL TAKES ONE DEEP SLOT EVERY DAY. Max 1
   story per dominant theme (NO MONOLITHS), different domains, anti-clustering. Each deep item:
   conclusion-first **bold headline** · case · counter-case per `system/Counter_Case_Standard.md`.
   **The counter never occupies the last sentence** — end on what you still believe.
3. **Then EVERY remaining full-brief story becomes a one-line item in `## ▸ THE LINE`** — bold
   conclusion-first headline + one sentence carrying one scaled fact and one implication, ordered by
   consequence. Coverage is the point. Dropping a story is the LAST resort and needs a logged reason.
4. **MARKETS MINUTE** from the Dashboard only, freshness-checked against yesterday. Exactly 4 sentences.
5. **`## ▸ THE TAKE`** — five beats, one sentence each. Keep the dated call + falsifier. Log to
   `system/predictions-ledger.json`.
6. **INTERESTING THINGS** keeps its own tier: 1 long + 2 line items.
7. **THE MEDITATION · THE MODEL · THE CLOSE** per the generator's budgets.
8. **THE STORY OF THE DAY is written LAST**, from the finished set. It may never cause a story to be
   included, excluded or re-angled. Absence is normal — print it.
9. Life Note matches the full brief exactly. Daily Title verbatim.

**One claim per sentence.** There is no word cap on sentences any more. A long sentence that
transmits, passes. Whether it transmits is decided in Step 4b, not by counting.

Section order: `THE UPDATE` · `THE LINE` · `MARKETS MINUTE` · `THE TAKE` · `INTERESTING THINGS` ·
`THE MEDITATION` · `THE MODEL` · `THE CLOSE`.

## Step 4: Mechanical gates — run them, do NOT self-grade

Length target is **1,450–1,750 words** (~9–11 min). Hard ceiling 1,900. Run the repo gates:

```
node --experimental-strip-types scripts/brief-light-format-gate.ts daily-briefs/{BRIEF_DATE}-light.md --enforce-length
node --experimental-strip-types scripts/brief-light-craft-gate.ts daily-briefs/{BRIEF_DATE}-light.md daily-briefs/{BRIEF_DATE}-v2.md
```

- `--enforce-length` exists only in this loop. At the publish path nothing blocks on length.
  🔴 THE BRIEF ALWAYS SHIPS.
- **When over budget, cut depth, never coverage:** shorten THE LINE items → shorten already-covered
  sections → move a deep item down to THE LINE. Dropping a story is last and needs a logged reason.
- **Coverage check:** diff against the full brief — every Six story, both Signal ideas, the Take.
- Fix any FAIL and re-run until clean.

---

## Step 4b — 🔴 THE READ-BACK LOOP (new, 2026-08-07 — night one)

**What this is:** three blind readers state back what each unit said. Units all three misread get
rewritten. This measures whether the meaning landed, which no gate can do.

**🔴 HARD FALLBACK, READ THIS FIRST. Any error, any timeout, any subagent that fails to return, any
ambiguity you cannot resolve in two minutes → SKIP THE REST OF THIS STEP, ship the draft you already
have, and write `readback=ERROR` in the status line with the reason. The brief always ships. A missed
read-back costs one night of data. A missed brief costs the product.** Do not retry more than once.
Do not let this step delay publish past your normal finish time.

### 4b.0 — Use the script if it is there

```
node --experimental-strip-types scripts/transmission-readback.ts --selftest && echo SCRIPT-OK
```

**If that prints `SCRIPT-OK`, the script owns the mechanical half and you own only the model half.**
Run these in order; each prints what to do next:

```
# 1. segment + freeze the prompt  (writes .readback/{BRIEF_DATE}/, prints PROMPT_HASH)
node --experimental-strip-types scripts/transmission-readback.ts prepare \
     daily-briefs/{BRIEF_DATE}-light.md daily-briefs/{BRIEF_DATE}-light-claims.json

# 2. YOU spawn 3 blind Readers on .readback/{BRIEF_DATE}/reader-prompt.txt (verbatim, whole file)
#    save each raw reply to .readback/{BRIEF_DATE}/readback-1.txt … -3.txt

# 3. parrot guard — names any read-back that must be re-run with a sterner paraphrase instruction
node --experimental-strip-types scripts/transmission-readback.ts check {BRIEF_DATE}

# 4. YOU grade (4b.2) and write .readback/{BRIEF_DATE}/grades.json
# 5. tabulate — prints the unanimous-fail list, rates, and what to redraft
node --experimental-strip-types scripts/transmission-readback.ts tabulate {BRIEF_DATE}

# 6. YOU write redrafts to .readback/{BRIEF_DATE}/redrafts.json  ({"unit-id": "new prose", …})
# 7. assemble — rebuilds the artifact and ASSERTS every passed unit is byte-identical
node --experimental-strip-types scripts/transmission-readback.ts assemble {BRIEF_DATE}

# 8. ledger
node --experimental-strip-types scripts/transmission-readback.ts ledger {BRIEF_DATE}
```

**If `--selftest` does not print `SCRIPT-OK`, ignore this sub-step entirely and run 4b.1–4b.4 by
hand.** The hand path below is complete and self-sufficient; the script is an accelerant, not a
dependency. Note which path you took in the status line: `via=script` or `via=body`.

### 4b.1 — Spawn three blind Readers

Spawn **three** subagents. Use a small/fast model if you can set one; if you cannot, the default is
fine — **blindness matters, model size does not.** Each gets this prompt and nothing else, with
`{artifact}` replaced by the full text of the light with each unit prefixed `[U1]`, `[U2]`… in claims-file
order:

> You are an educated professional — smart, busy, not a specialist in markets, technology or
> geopolitics. Read the brief below once, top to bottom, the way you would listen to a podcast while
> making coffee. Do not re-read. Then for each numbered item state in your own words: (1) CLAIM — the
> one thing the item says is true, and (2) WHY — why it matters to someone like you. Use your own
> words; do not copy phrases from the text. If you cannot state an item's claim, write LOST and say
> what confused you. Do not skip items. Output one line per item: `U<n> CLAIM: … | WHY: …`
>
> {artifact}

🔴 **Do not give a Reader the full brief, the claims file, the worldview, or any system document.**
Pass the artifact text in the prompt. Do not tell it to read a file in this repo — a session in this
repo inherits `CLAUDE.md`, which carries house doctrine and would break blindness.

### 4b.2 — Grade

For each unit, compare each read-back against that unit's **logged claim** (not against the prose):

- **TRANSMITTED** — same actor, same direction, same rough magnitude, same causal story. Someone
  acting on the read-back would act correctly.
- **DISTORTED** — a material element differs. Includes confidently-wrong read-backs.
- **LOST** — nothing usable came back.

Also grade the second leg: compare the reader's **WHY** against the unit's logged **so_what** →
`SO_WHAT: OK / MISSING / WRONG`. **Tonight the so-what grade is LOGGED ONLY — it never triggers a
rewrite.** It starts driving rewrites after ~3 nights of baseline.

Element tags (ACTOR / DIRECTION / MAGNITUDE / CAUSALITY / JARGON) print as **advisory only tonight** —
the rubric is not written yet, so do not act on the tag, just record it.


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

### 4b.3 — Actuate: unanimous only, two cycles max

🔴 **SEVERITY-WEIGHTED ACTUATION (owner, 2026-08-09).** **A DIRECTION INVERSION ACTUATES AT
2-OF-3, IMMEDIATELY — it does not wait for the week-one rule.** Everything else keeps unanimous-of-3
through night 7. An inversion is not a degree of misunderstanding; it is the reader believing the
opposite of the claim, and a reader acting on it acts backwards.

*Receipt, 2026-08-08 line-3:* the unit said "the estimate is company-managed; the guide is not."
Reader 1 stated back "forward statements are company-controlled while results are not" — the exact
inverse — **and the unit graded TRANSMITTED 3/3 with so-what OK**, because the Grader compared CLAIMS
and the inversion lived in the WHY. The owner bounced off that unit on his Saturday read. Grade the
WHY against the logged so_what with the same care as the claim.

🔴 **A unit is rewritten only if ALL THREE readers failed it** (DISTORTED or LOST). A 2-of-3 failure
is **logged and left alone** tonight — that is the nights-1–7 rule, and it is deliberate.

For each unanimously-failed unit, rewrite **only that unit**, with this instruction to yourself:

> Unit {n} failed transmission. You meant: "{logged claim}". Three first-time readers understood:
> "{read-back 1}" / "{read-back 2}" / "{read-back 3}". Rewrite the unit so a fresh reader states back
> what you meant. Keep every fact and its counter. Change nothing outside this unit.

🔴 **Reassemble the artifact from the untouched passed units plus the rewritten ones. Passed units
must be byte-identical before and after.** Then re-read only the rewritten units (one more Reader
round on those units alone). **Two cycles maximum, then ship whatever you have.**

### 4b.4 — Log

Append one JSON object per unit per cycle to `system/readback-ledger.json` (create the file as a JSON
array if it does not exist; if `scripts/transmission-readback.ts` exists, use it instead and let it write):

```json
{"date":"{BRIEF_DATE}","product":"light","unit":"update-1","claim":"…","grades":["TRANSMITTED","DISTORTED","TRANSMITTED"],
 "final":"PASS","element":"—","so_what":"OK","cycle":0,"outcome":"held","owner_mark":null}
```

Write a residual line for **every unit that failed both cycles and shipped anyway** — those are the
rows Jackson reads first tomorrow. Put them at the top of your run summary.

---

## Step 5: Judgment pass and save

Run `system/Brief_Light_Critic.md` against the draft with the full brief as source of truth. Its
prose-craft check is **replaced** by the read-back verdicts — do not re-judge prose. It keeps: NO NEW
ATOMS provenance, the two-tier contract, title coherence, freshness.

Save to `daily-briefs/{BRIEF_DATE}-light.md`. It moves to `content/daily-updates/` when the full
brief publishes in the morning.

## FINAL STEP — STATUS LINE (never exit without one)

Append to `daily-briefs/{BRIEF_DATE}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | brief-light | {output_path} | SUCCESS|FAIL|SKIPPED | {reason}
{ISO_TIMESTAMP} | readback-light | transmitted {n}/{m} | unanimous-fail {u} | cycles {k} | residual {r} | sowhat {ok}/{m} | {OK|ERROR: reason}
```

Write a **FAIL** line if you produced no output. Write the `readback-light` line **even when the loop
errored or was skipped** — `readback=ERROR` with a reason is data; silence is not. A silent failure is
what cost the 2026-07-27 Critic and evening super-brief: the task ran, wrote nothing, said nothing,
and nobody knew until 5 AM.

---

**ADDENDUM 2026-08-10 (FINAL WORK ORDER item 4) — THE HURRIED READER, ADVISORY.** `prepare` (step 4b.0) now also writes `hurried-prompt.txt` and prints `HURRIED_HASH`. After spawning the three calibrated Readers, ALSO spawn ONE hurried Reader the same way — pass the prompt file's TEXT, same blindness rules — save its raw reply to `readback-hurried.txt`, and write its grades to `hurried-grades.json` as `{"<unit-id>":{"grade":"TRANSMITTED|DISTORTED|LOST","sowhat":"OK|MISSING|WRONG"}}` BEFORE running `ledger`. It is ADVISORY: it never triggers a redraft, never counts toward actuation, and lands only in the `hurried_read` ledger field. It measures the "in a hurry" half of the success criterion and earns actuation only through the owner-marks calibration bar, like everything else.
