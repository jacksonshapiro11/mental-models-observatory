# For Cursor — what changed, why, and what you can actually verify

**Read this before the other handoffs.** It states plainly what is checkable by you and what is not,
so nothing gets reported as verified when it wasn't.

---

## 🔴 FIRST — the push diff shows brief DELETIONS. Do not push on a stale branch.

`git diff --stat origin/main..HEAD` currently shows `content/daily-updates/2026-08-04.md`,
`2026-08-05.md` and their `-light` files as **deleted (-167, -161, -69, -69)**.

**They are not deleted.** Remote has four brief commits local does not (`e201298`, `e561783`,
`ae0fb0e`, `37a5f4b`) — `publish.py` commits briefs on the remote via the API and local git never
duplicates that. This is the documented two-histories split in `REPO_WORKFLOW.md`.

**`git pull --rebase origin main` MUST come first, and after it those deletions must be GONE.**
If any brief file still shows as deleted after the rebase, **STOP and report** — do not push.
`REPO_WORKFLOW.md`: *"Never delete past briefs. Do not commit deletions of brief files."*

---

## What you CAN verify: `scripts/validate-brief.ts`

Four commits. `d8bd450` is yours; the rest are mine.

### `a39798a` — Take counter-case: the word floor deleted

`checkTakeCounterCase` required the counter to be **≥30% of The Take by word count**, blocking.
**Nothing verified an objection was present**, so 30% of hedging passed. It was gamed in the obvious
direction — 08-04 editor log: *"The Take — main case only — which raises the counter-case ratio
(39.1%)."* **The ratio was hit by compressing the case.**

Now: **PRESENCE stays blocking** and additionally accepts an explicit *"no serious argument against
this one."* Banned form, first person and a proportion **ceiling** are ADVISORY.

### `352b251` — enforced at every call site, ONE implementation

`counterCaseAdvisories()` is called for The Take, each Signal idea, and every Six forward read.
**Do not inline copies per section** — that is the drift the standard exists to prevent.

Sweep, trailing 30 briefs, re-run after the refactor: Take first-person 46% · Take proportion 43% ·
Six forward-read observable-only 33% · Signal observable-only 30% · Signal first-person 6% ·
**declared "no serious argument" 0/30**. All advisory — firing on half of accepted work is far too
hot to block.

*Method note: the first implementation flagged Take banned-form at 26%. The refactor dropped it to 0
— those were **false positives**; the Take was arguing and the narrow regex could not see it. The
sweep was re-run, not carried forward. A sweep result is only valid for the implementation that
produced it.*

### `f4e69cc`-adjacent — a stale comment corrected

A comment named the Signal ceiling as 220/250 after it was retuned to 300/340. Same class as the
soft/hard label swap you caught: the constant right, the prose beside it wrong.

### Verify

```bash
node --experimental-strip-types scripts/validate-brief.ts --selftest      # PASS

node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/2026-08-05.md; echo $?
# exit 0, 🟡 counter-case advisories printed

# 10-brief A/B — swap CONTENTS at the same path, never a renamed copy.
# A renamed copy makes the old validator skip checks and fake a clean baseline; it cost me a
# false 7-regression scare earlier in this engagement.
```
**Expect zero exit-code changes.** `2026-08-04` exits 1 before and after — that is your
`estimate-vintage` check on the EBRI $92.4bn frame, not this work.

---

## What you CANNOT verify: everything under `system/`

`system/` is gitignored (`.gitignore:14`, "NEVER push"). **You cannot see any of it.** Please do not
report the documentation as checked — say explicitly that it was out of scope.

Changed there today, on Jackson's disk only:

| file | what |
|---|---|
| `Constitution.md` | **NEW** — Jackson's four rules, ranked, each with its receipt |
| `Counter_Case_Standard.md` | **NEW** — the single home; operational form of `Deep_Analysis_Standard` beat two |
| `Change_Record_2026-08-05.md` | **NEW** — full write-up including my own errors |
| `Brief_Light_Generator_v2.md` | **NEW, NOT LIVE** — written as a *diff* against v1 |
| `Brief_Editor.md` | Gate 16 Compression to Budget; 30% floor SUPERSEDED; Model setup ≤100w |
| `Brief_Validator.md` ×2 · `Brief_Writer.md` · `Take_Generator.md` · `take-task-spec.md` ×2 | 30% floor **SUPERSEDED** |
| `Signal_Generator.md` · `Brief_Length_Standard.md` · `tasks/brief-draft.md` | Signal 2 ideas × 300/340 |
| `Source_Network_Scanner.md` | Phase 1.5 rotation guarantee |

**Why that supersession mattered:** the code said ceiling while **six documents still mandated the
floor**. The agents read the documents. The Writer would have kept writing to 35% forever while the
validator quietly measured something else.

---

## The one thing I'd most like you to attack

**`CC_ARGUMENT` is a regex standing in for "does this passage contain an argument."** That is a
proxy, and proxies are the failure class this entire engagement removed — `Root_Cause_Library.md`
**PATTERN 8, THE COUNTABLE PROXY**, states the test: *"can this check be satisfied by a change that
does not move the reader?"*

It has already produced one false-positive class. **Try to break it.** If you can write a passage
with no real objection that passes, or a real objection that fails, that is worth more than the push.

Second: the thresholds (~15% promotion, ~40% ceiling, ~30% declared-none) are **partly taste**. The
sweep measured today's rates; it did not establish those are the right lines.

---

## Also worth a look, since I only swept `system/`

**What else in the repo states a rule the code no longer enforces?** I found six such documents inside
`system/`. I did not sweep `scripts/`, `lib/`, `app/` or `.claude/` for the same class — a comment,
a docstring or a task body asserting a threshold that has since moved.

---

## Open, not done

Super Brief v2 wiring (eight consumers — `HANDOFF_CURSOR_LIGHT_V2.md`) · counter-case promotion after
a re-sweep · the ~2.19M-token living doc at +17k/day · the escalation router · roster expansion.
