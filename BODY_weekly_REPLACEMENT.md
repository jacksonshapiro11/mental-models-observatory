<!-- REPLACEMENT for ~/Documents/Claude/Scheduled/weekly-draft/SKILL.md
     Built 2026-08-07 for the Read-Back Loop. Paste this whole file over the live one.
     🔴 PASTE BEFORE THE 14:00 SATURDAY BUILD — this is the dress rehearsal for W33.
     Changes vs the 2026-08-06 snapshot: STEP 4b CLAIM-FIRST (new) · STEP 5c READ-BACK LOOP (new,
     self-degrading) · status line carries readback fields. Everything else is unchanged. -->
---
name: weekly-draft
description: "Saturday 2 PM: draft The Weekly per system/Weekly_Generator.md. IMPORTS the predictions pre-draft (never generates the book on the spot; fallback + failure log if missing). CLAIM-FIRST is mandatory for the Weekly Light: every unit's claim and so_what are written BEFORE the unit is drafted. A blind read-back loop runs before the run is declared done. OUTPUT CONTRACT: full v1 AND Weekly Light AND ledger-updated verified on disk, fact-gate run — or the run has not succeeded. No publishing (Sunday auto-publishes; no approval gate)."
---

## STEP 0 — CANARY (your very first action, before reading any file)

**BRIEF_DATE** = the brief this run feeds. If this task body already computes a BRIEF_DATE, use that.
Otherwise: afternoon/evening ET runs use **today + 1**; morning runs that publish the same day's
brief use **today**. State the value you used.

Append one line to `daily-briefs/{BRIEF_DATE}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | weekly-draft | CANARY | WRITE-OK
```

If that append fails, or you cannot read the workspace: email cosmictrex11@gmail.com with subject
`PIPELINE ALARM — session cannot access workspace — weekly-draft {ISO_TIMESTAMP}` and STOP. Do not do
work whose output cannot persist. Email does not depend on the workspace mount; that is the point.

You are drafting this week's issue of The Weekly for the Mental Models Observatory project at
/Users/jackson/Desktop/mental-models-observatory.

1. Load `system/Pipeline_Controller.md` first and run its standard checks.
2. Load `system/Weekly_Generator.md` and execute it END TO END, in order: STEP 0 (week + worldview
   snapshot) through STEP 12 (through-line and open, written last), then run THE GATES (E, H, L, R,
   T, U, M, N, Q, S) and fix every failure before declaring done. The generator contains the
   candidate-table procedure, the Unit Gate, the Our Call format, the worked examples, and the exact
   output templates. Do not improvise around it; if the spec fights the week, follow Rule 10 (fix the
   standard, log it in Failure Modes + changelog) rather than silently deviating.
3. Read the FAILURE MODES section before writing. The recap trap, the hedged call, and denominator
   blindness are documented for a reason.
4. Run continuously per project CLAUDE.md: no pausing between steps, no clarifying questions. Process
   input files one at a time per STEP 1's pyramid order.
5. Output per the generator's OUTPUT section: `daily-briefs/weekly/{YYYY}-W{NN}-v1.md` with the full
   metadata header, updated `system/Weekly_Predictions_Ledger.md`, updated `system/trend-ledger.json`,
   the worldview snapshot in `system/worldview-snapshots/`, and a status line appended to
   `daily-briefs/weekly/{YYYY}-W{NN}-pipeline-status.md`.

---

## STEP 4b — 🔴 CLAIM-FIRST FOR THE WEEKLY LIGHT. BEFORE YOU WRITE ANY OF IT.

**Step zero of every unit, not a review step.** After the full Weekly v1 is on disk and you have
chosen the Light's units, and **before drafting a single sentence of the Light**, write two lines per
unit:

1. **CLAIM** — what the unit says is true, in one breath, the way you would say it across a table.
   **A named actor and a direction.** Not a topic. Not a question.
2. **SO_WHAT** — why it matters to a smart, busy non-specialist: what they now know, do, or watch.

**If you cannot say the claim in one breath, you have not finished thinking. Do not start the unit.**

**🔴 A unit that reports a mechanism must say what it means. State the so-what or do not run the
unit.** Measured 2026-08-07 on the daily super brief: of the units Jackson rejected on a blind read,
**8 of 11 were rejected for exactly this** — *"I don't get the so what"* — and every one had already
passed a cold reader's comprehension check.

Write **before drafting**, one row per unit, in the order the units will appear:

`daily-briefs/weekly/{YYYY}-W{NN}-light-claims.json`
```json
[{"unit":"update-1","section":"THE UPDATE","claim":"...","so_what":"..."},
 {"unit":"our-calls","section":"OUR CALLS","claim":"...","so_what":"..."}]
```

🔴 **The claims file DEFINES the units.** Every unit gets a row — including `MARKETS MINUTE`,
`OUR CALLS`, the meditation body and `THE CLOSE`, none of which are bold-led and none of which any
parser has ever assigned a unit to. On 2026-08-07 Jackson's harshest verdict on the daily —
*"unclear to me in every way"* — landed on exactly such a unit.

---

## STEP 5b — WEEKLY LIGHT, then GATE it — do NOT self-grade

After v1 is on disk, generate the Weekly Light per **`system/Weekly_Light_Generator.md`** to
`daily-briefs/weekly/{YYYY}-W{NN}-light.md`, building each unit around the claim you already wrote.

**🔴 WHICH FORMAT: check the epoch, do not assume.** The two-tier weekly contract is gated at
`WEEKLY_V2_EPOCH = 2026-W33`. A week slug **below** W33 runs the OLD single-tier selection format;
W33 and above run two-tier. The format gate prints which contract it applied — believe it.

**If two-tier applies (W33+):**

1. **THE UPDATE = 4-5 deep stories** (consequence × contestability; each conclusion falsifiable, with
   a counter-case per `system/Counter_Case_Standard.md`; the week's strongest contrarian catch holds
   one slot). **The counter never occupies the last sentence** — end on what you still believe.
2. **`## ▸ THE LINE` = every other full-Weekly story as a one-liner** (bold conclusion-first headline
   + one sentence, 9-16 items, ordered by consequence). Coverage is the point: a story not run is a
   total loss; dropping one is the LAST resort and needs a logged reason in the status line.
3. **OUR CALLS stays the weekly's calls home.** **There is no THE TAKE section in the weekly light.**
4. Section order: `THE UPDATE` · `THE LINE` · `MARKETS MINUTE` · `OUR CALLS` · `INTERESTING THINGS` ·
   `THE MEDITATION` · `THE MODEL` · `THE CLOSE`.
5. Title verbatim from the full Weekly; Life Note matches; the lede (STORY OF THE WEEK) is written
   LAST and never directive.

**One claim per sentence.** There is no word cap on sentences. A long sentence that transmits, passes.
Whether it transmits is decided in Step 5c, not by counting.

Then run the gates and believe them (length target 2,000-2,400, hard 2,700):

```
node --experimental-strip-types scripts/brief-light-format-gate.ts daily-briefs/weekly/{YYYY}-W{NN}-light.md --enforce-length
node --experimental-strip-types scripts/brief-light-craft-gate.ts  daily-briefs/weekly/{YYYY}-W{NN}-light.md daily-briefs/weekly/{YYYY}-W{NN}-v1.md
```

- Over the hard ceiling it FAILS **only here, under `--enforce-length`**. At the publish path nothing
  blocks on length; 🔴 THE WEEKLY ALWAYS SHIPS.
- **When over budget, cut depth, never coverage.** Dropping a story is last.
- **Coverage check:** diff the light against the full Weekly — every Six/Signal story and each Wild
  Card appears in one of the tiers. Any miss needs a logged reason.
- Fix any FAIL and re-run both gates until clean.

---

## STEP 5c — 🔴 THE READ-BACK LOOP (new, 2026-08-07)

**What this is:** three blind readers state back what each unit said. Units all three misread get
rewritten. This measures whether the meaning landed, which no gate can do.

**🔴 HARD FALLBACK, READ THIS FIRST. Any error, any timeout, any subagent that fails to return, any
ambiguity you cannot resolve in two minutes → SKIP THE REST OF THIS STEP, keep the draft you have,
and write `readback=ERROR` in the status line with the reason. THE WEEKLY ALWAYS SHIPS.** One retry
maximum. Never let this step delay the run past your normal finish time. **The weekly-critic at 8 PM
is downstream of you — do not make it wait.**

### 5c.0 — Use the script if it is there

```
node --experimental-strip-types scripts/transmission-readback.ts --selftest && echo SCRIPT-OK
```

**⚠ KNOWN SHIM — the script derives its working directory from a `YYYY-MM-DD` pattern, which a
`2026-W32` slug does not match.** Weekly slug support is owed and is being added with per-section
mode. Until then, run `prepare` against a dated copy — nothing else changes:

```
mkdir -p .readback/_in
cp daily-briefs/weekly/{YYYY}-W{NN}-light.md .readback/_in/{SATURDAY_YYYY-MM-DD}-light.md
cp daily-briefs/weekly/{YYYY}-W{NN}-light-claims.json .readback/_in/claims.json

node --experimental-strip-types scripts/transmission-readback.ts prepare \
     .readback/_in/{SATURDAY_YYYY-MM-DD}-light.md .readback/_in/claims.json
```

Then `check` / `tabulate` / `assemble` / `ledger` with `{SATURDAY_YYYY-MM-DD}` as the date argument,
exactly as the daily body describes. **`assemble` writes the rebuilt artifact to
`.readback/{DATE}/assembled.md` — copy it back over the weekly light path, not the other way round.**

**If `--selftest` does not print `SCRIPT-OK`, ignore 5c.0 entirely and run 5c.1–5c.4 by hand.** The
hand path is complete and self-sufficient. Note which you used: `via=script` or `via=body`.

### 5c.1 — Spawn three blind Readers

Three subagents. Small/fast model preferred; **blindness matters, model size does not.** Each gets
this prompt and nothing else, with `{artifact}` replaced by the full text of the light with each unit
prefixed `[U1]`, `[U2]`… in claims-file order:

> You are an educated professional — smart, busy, not a specialist in markets, technology or
> geopolitics. Read the brief below once, top to bottom, the way you would listen to a podcast while
> making coffee. Do not re-read. Then for each numbered item state in your own words: (1) CLAIM — the
> one thing the item says is true, and (2) WHY — why it matters to someone like you. Use your own
> words; do not copy phrases from the text. If you cannot state an item's claim, write LOST and say
> what confused you. Do not skip items. Output one line per item: `U<n> CLAIM: … | WHY: …`
>
> {artifact}

🔴 **Do not give a Reader the full Weekly, the claims file, the worldview, or any system document.
Pass the artifact text IN THE PROMPT. Never tell a Reader to read a file in this repo** — a session
here inherits `CLAUDE.md`, which carries house doctrine and would break blindness.

### 5c.2 — Grade

Compare each read-back against that unit's **logged claim** (never against the prose):

- **TRANSMITTED** — same actor, direction, rough magnitude, causal story.
- **DISTORTED** — a material element differs. Includes confidently-wrong read-backs.
- **LOST** — nothing usable came back.

Also grade the second leg: the reader's **WHY** against the unit's logged **so_what** →
`SO_WHAT: OK / MISSING / WRONG`. **Logged only — it never triggers a rewrite yet.**

Element tags (ACTOR / DIRECTION / MAGNITUDE / CAUSALITY / JARGON) are **advisory only** — the rubric
is not written. Record, do not act.

### 5c.3 — Actuate: unanimous only, two cycles max

🔴 **A unit is rewritten only if ALL THREE readers failed it.** A 2-of-3 failure is **logged and left
alone** — the same first-seven-runs rule the daily is under.

For each unanimously-failed unit, rewrite **only that unit**:

> Unit {n} failed transmission. You meant: "{logged claim}". Three first-time readers understood:
> "{r1}" / "{r2}" / "{r3}". Rewrite the unit so a fresh reader states back what you meant. Keep every
> fact and its counter. Change nothing outside this unit.

🔴 **Reassemble from the untouched passed units plus the rewritten ones — passed units must be
byte-identical before and after.** Re-read only the rewritten units. **Two cycles maximum, then keep
what you have.**

### 5c.4 — Log

Append one row per unit to `system/readback-ledger.json` with `"product":"weekly"` (or let the script
write it). **Write a residual line for every unit that failed both cycles and stayed** — those lead
the next report.

---

## STEP 6 — CALIBRATION MODE

**CALIBRATION MODE IS ON: do not publish anything to content/, do not git commit, do not email.** The
weekly-critic task at 8 PM handles review and the email package.

🔴 **Especially do not git commit today.** A push is running in this repo on 2026-08-08 under a
separate owner. Your job writes files; it does not touch git.

## FINAL STEP — STATUS LINE (never exit without one)

Append to `daily-briefs/weekly/{YYYY}-W{NN}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | weekly-draft | {output_paths} | SUCCESS|FAIL|SKIPPED | {reason incl. light word count + coverage}
{ISO_TIMESTAMP} | readback-weekly | transmitted {n}/{m} | unanimous-fail {u} | cycles {k} | residual {r} | sowhat {ok}/{m} | via={script|body} | {OK|ERROR: reason}
```

Write a **FAIL** line if you produced no output. Write the `readback-weekly` line **even when the loop
errored or was skipped** — `readback=ERROR` with a reason is data; silence is not.
