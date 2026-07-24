# Improvement-Loop Spine — Session Handoff

**Date:** 2026-07-06
**Session:** Interactive (Cowork) — executed Jackson's "Improvement Loop Spine — Item-by-Item Update Spec" (the 18-item memo)
**Status:** Spine LIVE and mechanically green. `verify-improvements.ts` → 14 rows · 14 checks · 0 FAIL · 0 warn · exit 0.
**Internal doc** — do NOT commit (reveals how the brief is produced; git policy category 3).

---

## Bottom line

The improvement loop now has a working mechanical spine end to end: a single source-of-truth ledger, a verify script that gates it, an atomic 10:03 improve-and-apply session, and — new this session — the ESC-002 stale-artifact gate, both **built and wired** into the live Critic. Every stale doc layer was scrubbed in one pass, and all five scheduled task bodies were updated via the `update_scheduled_task` MCP.

Of the memo's 18 items, **16 are fully done**, **1 is partial** (the git commit — a host-owned lock blocks it; it's your one manual step), and **1 is done-at-runtime with a cosmetic remainder** (`pipeline-health-check`).

---

## What shipped

### 1. ESC-002 gate — the one real piece of engineering (`#15`)

**New file:** `scripts/quality-gate-timestamp.ts`

Closes E-QG-BYPASS-01: the class where the Critic graded a stale intermediate `v2` twice because the OWED-EDITOR GUARD lived only in prose. The gate compares the Critic's input artifact mtime against the latest quality-gate output; healthy = input ≥ reference, stale = input older (it's grading a superseded draft).

Proven four ways:
- `--selftest` → exit 0 (asserts it flags the stale case AND stays silent on the fresh case)
- fresh input → exit 0, prints FRESH
- stale input `--strict` → exit 1
- stale input (default/advisory) → exit 0, prints the STALE warning

**Ships-first posture:** advisory by default (exit 0) so it can be wired into the Critic without ever blocking a publish; `--strict` fails closed where wanted.

**Wired into `brief-critic`:** before evaluating, it runs the gate against `{DATE}-v2.md` vs the freshest of `{DATE}-v1.5.md`/`{DATE}-v1.md`; on STALE it self-heals (re-runs the Editor on the current v1 to regenerate a fresh v2), logs the guard firing, then evaluates. Never blocks the brief.

Ledger: added **IMP-011** (the gate) and converted **ESC-002** from a check-less High warn into a passing, wired row.

### 2. Scheduled task bodies — updated via `update_scheduled_task` MCP

| Task | Change |
|------|--------|
| `apply-brief-improvements` | Body replaced with a RETIREMENT STUB ("do not run"). Already disabled; now also stubbed. (`#5`) |
| `daily-improvement` | Body rewritten to the ATOMIC analyze→prescribe→apply→ledger→**verify-exit-0** flow, thin-pointer to `Apply_Improvements.md`, with the acceptance gate + email-summary step preserved. (`#4`) |
| `brief-draft` | Added a mandatory FIRST step: load improvement context from `Improvement_Ledger.md` (rows applied ≤7 days + open High/Critical) + yesterday's critic mandates; context-only, no prescribing. It previously loaded NONE. (`#6`) |
| `brief-critic` | Wired the ESC-002 stale-artifact gate into pipeline-state validation (advisory + self-heal). Also repointed its dead `skills/*/SKILL.md` load paths → `system/` (Pipeline_Controller, Operating_System, Brief_Critic, Prediction_Accountability, Escalation_Mechanism, Root_Cause_Library). (`#15`) |

> Note on access: `~/Documents/Claude/Scheduled/**/SKILL.md` cannot be **read** from this session (filesystem EPERM + protected-location mount block), but `update_scheduled_task` **writes** them fine. Bodies were authored/updated from the canonical `system/` specs and, for the two brief-pipeline tasks, from the current bodies Jackson pasted.

### 3. System docs — every stale layer scrubbed in one pass

All references to the retired analyze/apply split, "observe & log," and the dead `skills/` sync were removed and repointed to the atomic 10:03 model and the ledger:

- `SYSTEM_MAP.html` — improvement-loop flow box (was "daily-improvement (observe & log) → apply-brief-improvements (weekly consolidation)"; now the atomic flow + apply-brief RETIRED + verify-daily-warn-only)
- `system/ARCHITECTURE.md` — improvement-loop line
- `system/Workflow_v3.md` — brief-draft reads the LEDGER (not report prose); "1:02 PM" → "10:03 AM"
- `system/Pipeline_Controller.md` — daytime-tasks list (removed apply-brief); Reality Check evening-ledger-only one-liner
- `system/Apply_Improvements.md` — frontmatter cadence (Step 0 → 10:03 atomic); escalation-register → ledger; dead skills-sync line; retired-task note
- `system/System_Change_Guide.md` — Improvement Pipeline Changes table (3 rows) + the improve-and-apply enforcement-chain binding (`#14`)
- `CLAUDE.md` — Improvement Loop Reality Check block + `Improvement_Ledger.md`/`Apply_Improvements.md` manifest rows + changelog v2.2 (`#10`)
- `system/Accountability_Cycle.md` — Dimension 2 pulls from the ledger + verify output, cites row ids (`#12`)
- `system/Quality_Tracker_final.md` — WEEKLY DASHBOARD one-line ledger summary (`#13`)
- `system/Escalation_Mechanism.md` — escalations live as ledger ESC-* rows, 30-day fuse (`#17`)
- `system/Root_Cause_Library.md` — default closure layer per cause (`#17`)
- `system/Brief_Architect.md` — Architect input: open ESC rows in the ledger (`#6`)

### 4. Ledger + verification

- `system/Improvement_Ledger.md` — IMP-011 added; ESC-002 updated (check-less → wired); changelog v2/v3/v4.
- `verify-improvements.ts` re-run green after every batch (14/14, 0 warn); whole-system consistency greps came back clean (no live stale instructions remain).

---

## 18-item memo scorecard

| # | Item | Status |
|---|------|--------|
| 1 | Git reconcile | **PARTIAL** — spine code staged + commit written; blocked by stale host lock (your manual step). Rebase deferred. |
| 2 | `verify-improvements.ts` spine | DONE (14/14 green) |
| 3 | `pipeline-health-check` wire | DONE at runtime (already runs verify); cosmetic `skills/` step in body remains — optional |
| 4 | `daily-improvement` atomic | DONE (body rewritten) |
| 5 | `apply-brief-improvements` retire | DONE (disabled + stubbed) |
| 6 | Evening ledger-read | DONE (Workflow_v3 + Apply_Improvements + Brief_Architect + brief-draft body) |
| 7 | Ledger single source of truth | DONE |
| 8 | `Apply_Improvements` consolidation | DONE |
| 9 | `Pipeline_Controller` sync | DONE |
| 10 | `CLAUDE.md` | DONE (root); `.claude/CLAUDE.md` divergence flagged |
| 11 | `SYSTEM_MAP.html` | DONE |
| 12 | `Accountability_Cycle` | DONE |
| 13 | `Quality_Tracker` | DONE |
| 14 | `System_Change_Guide` bind | DONE |
| 15 | ESC-002 gate | DONE — built, proven 4 ways, wired into brief-critic |
| 16 | `Daily_Update_Guide` fast path | DONE (was already implemented — confirmed) |
| 17 | Escalation / Root-Cause pointers | DONE |
| 18 | gitignore policy | DONE — decision: stay local; `system/` not committed |

**Your five decisions, as implemented:** health check warn-only but **page on FAIL**; **no** historical IMP backfill; ESC-002 **built** (not wontfixed); **no** task rename; **no** atomic-session split.

---

## What's left

1. **The git commit — your one manual step.** A 17-hour-stale, host-owned `.git/index.lock` blocks it (I can't remove it from the sandbox). On your Mac:
   ```bash
   cd ~/Desktop/mental-models-observatory
   rm -f .git/index.lock
   git add scripts/verify-improvements.ts scripts/audio-gate-regression.ts scripts/quality-gate-timestamp.ts \
           lib/audio/text-preprocessor.ts scripts/brief-light-craft-gate.ts scripts/fact-gate.ts scripts/validate-brief.ts
   git commit -m "improvement spine + ESC-002 quality-gate-timestamp"
   ```
   Until then the code passes verify **on disk** but isn't in git history. The rebase onto `origin/main` (7 behind) is a separate, more careful step — flag me when you want it.

2. **`pipeline-health-check`** — one cosmetic dead `skills/` step; its description already runs verify, so non-blocking. Paste its body and I'll clean it in 30 seconds, or skip it.

3. **`.claude/CLAUDE.md` vs root `CLAUDE.md`** — they've diverged (root has Operating Doctrine + Reality Check; `.claude/` is older v2.0). Merge or keep separate is your call. Both are untracked.

4. **Flag, not a task — `brief-draft` pre-draft import.** The live `brief-draft` body generates Signal/Take/etc. inline from the generator skills, but its task *description* and your 5:34–5:52 PM pre-draft tasks (`take-draft`, `signal-discovery-draft`, `cc-predraft`) imply it should *import* those drafts. If it regenerates instead of importing, that's a topic-contamination risk the pre-drafts exist to prevent. Separate from the spine — worth your eyes.

---

## Sanity-checks (I authored these from pasted/spec text)

- **`brief-critic` paths** — I changed `skills/*` → `system/Pipeline_Controller.md`, `system/Operating_System.md`, `system/Brief_Critic.md`, `system/Prediction_Accountability.md`, `system/Escalation_Mechanism.md`, `system/Root_Cause_Library.md`. All exist; confirm they're the canonical files you intend.
- **`brief-draft`** — I only *added* the ledger-context step; nothing else in the body changed.
- **`daily-improvement`** — rewritten as a thin-pointer to `Apply_Improvements.md`; preserved the email-summary-to-cosmictrex11@gmail.com step and the retroactive-critic protocol reference.

---

## How to verify (any session)

```bash
cd ~/Desktop/mental-models-observatory
npx tsx scripts/verify-improvements.ts                 # expect: 14 rows · 14 checks · 0 FAIL · 0 warn · exit 0
npx tsx scripts/quality-gate-timestamp.ts --selftest   # expect: SELFTEST PASS · exit 0
```

Scheduled state (via the scheduled-tasks MCP `list_scheduled_tasks`): `apply-brief-improvements` = disabled; `daily-improvement` = 10:03 daily, enabled; `pipeline-health-check` = 11:06 daily, enabled and runs verify.

---

## Where it's logged

- `system/Improvement_Ledger.md` — changelog v1–v4 (this session is v2/v3/v4); rows IMP-011 + ESC-002.
- `system/Daily_Update_Guide.md` — Step 3b (interactive-fix → ledger) already in place.
- This handoff file.
