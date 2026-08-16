<!-- BODY for a NEW scheduled task. Nothing existing is touched by installing this.
     Suggested slot: 07:30 ET daily, AFTER the morning publish (05:15) and after the
     post-publish distribution has fired. The owner creates the task; this file is only its body.
     Built 2026-08-15 under WORK_ORDER_SELECTION.md, PHASE A. ADVISORY ONLY. -->
---
name: selection-judge
description: Grades last night's SHIPPED brief on SELECTION — was each item worth the slot. Blind to every draft and every rationale. Appends to system/selection-ledger.json and adds ONE line to the pipeline status. Never blocks, never rewrites, never edits a published file.
---

## WHAT THIS TASK MAY NOT DO

Read this before anything else. **It is advisory and it has no authority.**

- **It never edits the brief.** Not the published file, not a draft, not a single character.
- **It never blocks anything.** Every step is best-effort. On any error it writes a status line saying
  so and exits.
- **It never touches another task's files or body.** Its entire footprint is `.selection/`,
  `system/selection-ledger.json`, and one appended line in the pipeline status file.
- **It runs after publish, on purpose.** Grading before publish would create pressure to act on the
  grade, and the grade is not calibrated yet.

## STEP 0 — CANARY (first action, before reading anything)

**BRIEF_DATE** = the brief published this morning, i.e. **today's date** in ET. State the value used.

Append one line to `daily-briefs/{BRIEF_DATE}-pipeline-status.md`:

```
{ISO_TIMESTAMP} | selection-judge | CANARY | WRITE-OK
```

If that append fails, or the workspace is unreadable: email cosmictrex11@gmail.com with subject
`PIPELINE ALARM — session cannot access workspace — selection-judge {ISO_TIMESTAMP}` and STOP.

## STEP 1 — PREPARE THE BLIND PACKET

```bash
cd /Users/jackson/Desktop/mental-models-observatory
node --experimental-strip-types scripts/selection-judge.ts prepare content/daily-updates/{BRIEF_DATE}.md
```

It prints the unit count, the size of the prior corpus with its window, and both hashes. **Record the
TEMPLATE_HASH in your status line.** A TEMPLATE_HASH other than `fe0f152158ac9ebf` means the judge
prompt changed and the ledger's older rows were graded by a different instrument — say so.

If it exits non-zero, stop here and write the status line. A brief that segments to zero units means
the markup moved and the parser is blind; that is a finding, not a reason to guess.

## STEP 2 — ONE BLIND JUDGE

Read `.selection/{BRIEF_DATE}/judge-prompt.txt` and spawn **one** subagent whose **entire prompt is
the contents of that file**, followed by nothing except this line:

> Output the JSON object described above and nothing else. No preamble, no code fence.

🔴 **PASS THE TEXT. NEVER PASS THE PATH.** A judge told to open a file is a judge that can open other
files, and the next file it opens is the draft that explains why we picked the thing it is grading.

🔴 **Known and bounded leak.** A subagent spawned from a session inside this repo inherits the house
doctrine in `CLAUDE.md`; the blindness probe measured that and it is on the record. **What leaks is
doctrine, not rationale** — no drafts, no take-draft, no quality-gate log, no critic report. The
blindness that makes this instrument valid is intact. Do not treat that as a reason to relax the
rule above.

Small/fast model is fine. **Blindness matters; model size does not.**

## STEP 3 — RECORD

Write the returned JSON verbatim to `.selection/{BRIEF_DATE}/verdicts.json`, then:

```bash
node --experimental-strip-types scripts/selection-judge.ts record {BRIEF_DATE} --model={the model you used}
```

The grammar is checked before anything is written: every unit must be graded, a REPEAT must name what
it repeats, an UNPAID-REACH must say what went unpaid, a NO-STAKES must not carry a belief sentence.
**A grammar failure writes nothing.** Fix the JSON and re-run, or record the failure and move on.

`ALREADY RECORDED` means this night is in the ledger and the task is being retried. **That is the
guard doing its job. Do not pass `--force`.** Note it and continue.

## STEP 4 — ONE LINE IN THE PIPELINE STATUS

```bash
node --experimental-strip-types scripts/selection-judge.ts tally {BRIEF_DATE}
```

Append its output, and only its output, as one line:

```
{ISO_TIMESTAMP} | selection-judge | SELECTION: 14 units — 11 SOUND, 2 REPEAT, 1 UNPAID-REACH
```

**One line. No commentary, no recommendations, no mandates.** Anything that reads like an instruction
to tomorrow's writer is out of scope for a phase that only reports.

## FINAL STEP — STATUS LINE (never exit without one)

```
{ISO} | selection-judge | {BRIEF_DATE} | SUCCESS|FAIL|SKIPPED | units {n} | {tally} | template {hash} | model {name}
```

🔴 **House reporting rule: anything derived by inference rather than measurement is labelled
"inferred".**

Write the line **even when the run errored or was skipped** — `SKIPPED — {reason}` is data. A silent
failure is what cost the 2026-07-27 Critic and the evening super brief: the task ran, wrote nothing,
said nothing, and nobody knew until morning.

## WHAT THE GRADES DO NOT MEAN YET

The judge has graded 104 units and passed 97 percent of them, with **zero NO-STAKES**. Until the
owner's marks come back on `SELECTION_CALIBRATION_2026-08-11.md`, a SOUND verdict is **not** evidence
the slot was earned — it is evidence this judge did not object. **Do not cite these grades as quality
evidence anywhere.** Actuation authority is Phase C and it is gated on the judge reproducing his
marks.
