# WORK ORDER — WEEKEND CADENCE + MODEL RIGHTSIZING — 2026-08-26

**Owner-executed in ONE app sitting (~10 minutes), all in the desktop scheduler. Cursor is not involved — nothing here is repo work except the receipts. Run this AFTER the ESC-020 handoff's Stage 3 lands (the canary body below invokes the unedited-promotion script Stage 3 builds).**

**Principle: use the scheduler's own weekly slot wherever "weekly" is the whole ask; the step-0 body gate is only for shapes the scheduler can't express (skip-Saturday, daily-canary-plus-Saturday-deep).**

---

## A. PLAIN WEEKLY FLIPS (scheduler change only, no body trick needed)

| task | new schedule | body change |
|---|---|---|
| daily-improvement | weekly · Saturday 08:00 | paste addendum A1 below |
| system-update | weekly · Saturday 09:00 | none |
| selection-judge | weekly · Saturday 09:30 | none — weekly hindsight grading is better than nightly anyway |

**A1 — paste at the top of daily-improvement's body:**
> **WEEKLY DEEP RUN (cadence ruling 2026-08-26).** This task now runs Saturdays only and processes the WHOLE WEEK: every escalation, ESC, and 🔴 line in the last 7 pipeline-status files, the week's ledger rows, and verify-improvements in full. Nightly incident CAPTURE did not move — tasks still log escalations in their own status lines; this session is where they convert. The held-out acceptance leg applies to every new detector (CARRY row 1): proven against a night it was not built from, or not proven.

## B. BODY-GATED SHAPES (paste the step-0 block; schedule stays daily)

**B1 — pipeline-health-check → daily canary + Saturday deep. Replace its body's opening with:**
> **STEP 0 — DAILY CANARY (every day, ≤5 minutes, then STOP unless Saturday).** Check, with current naming conventions (`-v1-pre-quality-gate.md`, `-v1.5.md`; intelligence filed by gathering date): (1) last night's expected artifacts exist; (2) run `node --experimental-strip-types scripts/editor-handoff-gate.ts --unedited-promotion <last-night>` — RED if it fires; (3) count selfheal firings in last night's status file — any firing is RED and leads the summary; (4) `git status --porcelain` under a TREE header — non-empty prints `RED: UNCOMMITTED WORK`. Email ONLY on red; a green canary writes one status line and stops.
> **STEP 1 — SATURDAY ONLY:** produce the full deep health report (the current body below).

**B2 — daily-portfolio-monitor, paste as step 0:**
> **STEP 0 — SATURDAY SKIP (cadence ruling 2026-08-26).** If today is Saturday: write one status line — `SKIPPED (Saturday; markets closed Fri close → Sun run covers the weekend)` — and stop. The Sunday run reports the whole weekend, as it already does.

**B3 — daily-x-post: DISABLE the task** (pause, don't delete) until the outbound distribution gate exists (CARRY row 2). It is public, LLM-generated, and ungated — the one spend that is both risk and cost with no review loop.

## C. MODEL FLIPS (same sitting, per-task setting)

| set to | tasks | why |
|---|---|---|
| sonnet | the 4 opus intel sweeps EXCEPT 4 and 6 (two are already sonnet — this finishes 1/2/3/5) | collection, re-judged downstream; the two sonnet sweeps ran unnoticed for weeks |
| keep opus | sweeps 4 + 6, brief-draft, quality-gate, brief-editor, brief-critic, take-draft, brief-morning, daily-portfolio-monitor, daily-improvement | rewrite authority, judgment, or money attached |
| haiku | daily-brief-email-draft, verify-brief-publish (and x-post if ever re-enabled) | reformatting and checking only |

## D. NOT CHANGING (deliberate)

- **brief-critic stays daily** — it is the only independent daily reader while the Editor recovers, and it caught the editor failure. Revisit with a unique-catch count after the Editor is verified back.
- **Sweeps stay daily** — collection is the moat; the Moderna miss argues for more sweep attention, not less. The lever there is model, not cadence.
- **Phase 2 (optional, only if Saturdays feel heavy):** a 07:00 Saturday "week-packet" collector that pre-reads the week's status files once, so the 08:00/09:00/09:30 trio consumes one packet instead of each re-reading everything. Not in v1 — three moving parts beat four until proven otherwise.

## RECEIPTS (check the following Monday)

| check | where |
|---|---|
| Sat status file shows improvement + system-update + selection-judge ran; weekdays show none | pipeline-status Sat vs Mon–Fri |
| Weekday status files each carry one canary line (TREE header present, no deep report) | pipeline-status any weekday |
| Saturday portfolio line reads SKIPPED; Sunday line covers the weekend | pipeline-status Sat + Sun |
| Sweep model flips visible in output quality nowhere (that's the point) | nobody notices |
