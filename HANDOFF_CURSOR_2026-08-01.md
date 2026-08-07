# Full handoff — Cursor — 2026-08-01

**This is the single live document.** It supersedes `PIPELINE_UPDATE_2026-07-31.md` and
`CURSOR_2026-08-01.md`. Move both to `_to_delete/`.

Verify §1 independently. Execute §4. Report §3 and §5. Nothing here is trusted because it is
written down — three "applied" fixes this week turned out never to have existed.

---

## 1. Landed and proven in production

The 07-31 root cause: the `brief-draft` task body instructed the Writer to author The Take and
The Signal from their generators, while `system/Brief_Writer.md` said five times over that they
are IMPORTS. The Writer obeyed its prompt for 7+ nights; the Quality Gate rebuilt the sections
afterward. That rebuild **was** the 38% median rewrite.

| Metric | Before | 2026-08-01 |
|---|---|---|
| QG-REWRITE-SCALE | 38% median (48% on 07-31, 85% peak) | **0%** — 0/16 bullets |
| Pre-drafts consumed | 0–1 of 4, 7+ nights of bypass | **4/4, zero overrides** |
| `brief-draft` status lines | 0 in 21 days | **CANARY + SUCCESS** |
| Canary coverage | 2 of 34 tasks | **21 tasks** |
| Model pool eligible | ~6 | **119** (whitelist 144 rows, 0 queue models unlisted) |
| Dead `skills/*` references | 28 across 11 bodies | **0** |

**Verify — do not trust the table:**
```bash
git log --oneline -8          # 8816290 2cea2bc 3243ca7 21a1330 + 05c7beb a07c63f 1e2ea34 e462bc5
node --experimental-strip-types scripts/predraft-correction-gate.ts --selftest   # 7/7
node --experimental-strip-types scripts/provenance-gate.ts --selftest            # 11/11
node --experimental-strip-types scripts/ceiling-lint.ts --selftest               # 20/20
node --experimental-strip-types scripts/verify-improvements.ts                   # exit 0, 119+ rows
node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/2026-07-30.md; echo $?   # 0
node scripts/gate-replay.mjs --days 7
git show HEAD:scripts/ceiling-lint.ts | grep -c cc-pricing-rung    # 5 — not 0
```

Last check matters: `b3512c2` once deleted that detector by committing without a pathspec.

---

## 2. Built today, NOT yet run in a live pipeline

All advisory or additive, so the downside is bounded. Tonight is the first real test.

- **`8816290`** `checkSixSectionWordBudget` — format-agnostic. The old ceiling only measured lines
  starting with `- **`; on 08-01 the Writer wrote M&M (1,147 w) and Geopolitics (958 w) as prose, so
  it found **zero bullets, measured nothing, reported zero violations** and the Editor logged "Word
  ceilings 0 violations." This splits each subsection on blank lines — a bullet and a bare paragraph
  are both measured, so it cannot go blind. Section budget is the **allowed** unit count (3 × 170),
  not the count shipped, or writing more units would raise your own budget.
- **`2cea2bc`** `checkNamedSectionWordBudget` — Signal 960, Wild Card 730, Take 640, Model 780,
  Discovery 550. Before this, the only caps outside the Six were Inner Game (350) and the Dashboard
  sentence ceiling. THE SIGNAL and THE WILD CARD sit inside THE SIX but were not in the subsection
  list; THE TAKE / MODEL / DISCOVERY had no cap anywhere. Budgets = max across 07-28..07-31 + ~12%.
- **`3243ca7`** `predraft-correction-gate.ts` (**CHECK C**) — extracts a pre-draft's own recorded
  corrections (`"X" ... FIXED to "Y"`, `"X" -> "Y"`) and fails if a superseded value survives.
  Existing gates verify PRESENCE and CONSUMPTION, never *which version*.
- **`3243ca7`** `gate-replay.mjs` — replays gates over published briefs so a new gate is calibrated
  against history **before** it can block. This is the fix for the whack-a-mole.
- **`21a1330`** — length is a **SOFT ceiling**. Both budget checks print and never block.

**Length is advisory. Confirm it stays that way:** no `word-budget` finding may appear in any
"structural issues" block. On 07-28 / 07-31 / 08-01 the only structural issues are
`model-rotation-assigned`, `data-point-repetition`, `catalyst-enumeration` — all pre-existing.

---

## 3. Cursor investigates and reports

**3a. `ceiling-lint` may be blind.** `gate-replay` shows `·` on all seven days, but it FLAGS
`model-canonical-example` when run against `daily-briefs/2026-08-01-v2.md`. The harness points it at
`content/daily-updates/`. Either wrong artifact or blind on published files. By the harness's own
rule a row silent everywhere is untrustworthy. **Diagnose before anyone relies on that row.**

**3b. `validate-brief` fires on 6 of 7 days.** Break the findings down by check name so we can see
which sub-checks are signal and which are noise. A gate that always fires gets ignored.

**3c. Live error on the site.** The take-draft corrected `"largest first quarter ever" -> "on record"`
(unsupported superlative — an analyst characterization, not a Constellation statement).
`content/daily-updates/2026-08-01.md` says **"ever."** Found by CHECK C on its first run; no layer
caught it. Needs a published correction.

**3d. Intel volume.** 08-01 came in at 90 KB against a ~245 KB median (07-31 was 368 KB). Saturday
muddies it and the sweeps were upgraded back to Opus after. Check Mon–Wed: a weekday under 150 KB
means the sweeps need another look.

---

## 4. Cursor builds and commits

| Task | Detail |
|---|---|
| **`--strict-cc-pricing`** | IMP-108's hardening, **never built**. The string appears once in the ledger as a future name. Its 07-30 trigger fired into the `daily-improvement` cycle gap (that cycle produced no rows and no report). Build as a `ceiling-lint` leg + Editor REJECT, mirroring `--strict-cc` (IMP-099) and `--strict-ait` (IMP-071). **Hold until 3 clean nights** so QG-REWRITE-SCALE stays a clean instrument. |
| **Snapshot refresh** | `system/task-bodies-snapshot/` predates the telemetry write, so it no longer reflects the live bodies. Re-run `cp -R ~/Documents/Claude/Scheduled …` so future audits diff against reality. |
| **Wire `persistence-gate`** | New (`scripts/persistence-gate.ts`, selftest 6/6). Makes standing rules 1 and 4 mechanical: UNCOMMITTED-TRACKED-CODE and UNPUSHED-COMMITS. Add as a **warn-only** leg of `pipeline-health-check` so the "13 commits unpushed for four days" condition surfaces daily instead of being noticed by a human. Never block a brief on it. |
| Whatever 3a/3b produce | Commit with the diagnosis in the message |

**Commit rules:** always `git commit -- <explicit paths>`, never bare. Never commit anything under
`system/` — gitignored by policy, it is the secret sauce.

---

## 5. Tasks sticking out — report, do not delete

Live `Scheduled/` holds 31 directories; `Pipeline_Controller` documents 29. Reconcile and report.
An unregistered directory is inert; deleting a registered one breaks a task.

| Task | Issue | Action |
|---|---|---|
| **`apply-brief-improvements`** | Controller says RETIRED/disabled 2026-07-06. Body still present and now carries CANARY + status. **If still registered it has burned a daily Opus session for 8 weeks.** | Jackson checks the scheduler |
| **`daily-brief-email-draft`** | **RETIRED 2026-08-01** (Beehiiv killed). Body is SKIPPED stub; email is Resend/`brief-email` only. | Unregister in Claude scheduler if still listed |
| **`brief-validate-mechanical`** | Documented as a 7:00 PM blocking hard-stop. **No directory.** The Editor runs `validate-brief` inline so coverage exists, but the documented gate does not. | Reconcile the doc or register it |
| **`pipeline-watchdog`** | Documented, never registered. Now finally has signal to read — 21 canary lines and real status lines. | Register ~9:30 PM, Haiku |
| `wave01-swap-verification` | One-shot June 12 leftover | Confirm unregistered |
| `daily-portfolio-monitor`, `daily-x-post`, `source-health-check-monthly` | Present, absent from the Controller's tables | Document or retire |
| `brief-feedback-2`, `brief-feedback-3`, `weekend-roadmap-review` | Directories gone since the 07-31 snapshot — Jackson deleted them. | **If still registered with no body, those runs will fail.** Confirm. |

---

## 6. Still open — Jackson

| # | Item | Why it matters |
|---|---|---|
| 1 | 🔴 **13 unpushed commits**, fourth day | Everything this week exists only on this Mac. This is the exact condition that erased `--stamp` and cost 19 days. |
| 2 | **Publish the "largest first quarter ever" correction** | Live on the site now |
| 3 | **Register `pipeline-watchdog`** | Only worth doing now that telemetry exists |
| 4 | **`E-TRUTH-BYPASS-EVENING-01`** — 9 mentions on 08-01 alone, 11+ recurrences | The **largest unaddressed escalation.** There is no truth enforcement on the evening chain; the 5:06 AM Morning Truth Gate is the only mechanical floor, and it is a single point of failure. Routed to you under the structure freeze — it needs a yes or no. |
| 5 | Merge `pipeline-health-check` into `daily-improvement` | 10:03 already runs `verify-improvements`; 11:06 runs it again an hour later. Keep the zero-write alarm on a leg that does not depend on the workspace — move it to `pipeline-watchdog`. |
| 6 | Delete `_to_delete/` | ~173 MB |
| 7 | **Living-doc split** | ~2.19M tokens growing ~17k/day. The largest untouched item from the original audit and the real remaining usage work. Design: state layer (~25 KB, rewritten daily) + 30-day rolling window + monthly archive + a pointer index so depth stays reachable without loading it. Nothing deleted. **Trigger: 5 clean nights.** |

---

## 6b. Task bodies — AUDITED CLEAN, no further work needed

Against the refreshed snapshot (31 live bodies, all carrying CANARY):

- **All file paths resolve.** `daily-brief-email-draft` retired 2026-08-01 (Beehiiv killed); no longer calls missing `publish-to-beehiiv.ts`.
- **No body instructs a task to generate a pre-drafted section.** The generator references that
  remain are correct: `take-draft`→`Take_Generator`, `cc-predraft`→`CC_PreDraft_Generator`,
  `signal-discovery-draft`→`Signal_/Discovery_Generator`. **`brief-draft` has none** — that was the
  7-night bypass and it is gone.
- **No retired section (Asset Spotlight / Deep Read / Orientation / TLDR) is referenced as live.**
- **Every body carries a status contract.**

Nothing further to change in the bodies.

## 7. Standing rules — each one caused a failure this week

1. **Any session editing a tracked script commits it in the same session.** The nightly
   `pull --rebase` reverts uncommitted edits. Three Critical fixes were lost this way, including
   IMP-102's `--stamp`, which produced a 19-day escalation for code that did not exist.
2. **Always commit with an explicit pathspec.** `b3512c2` omitted it, swept in a stale index, and
   silently deleted `cc-pricing-rung`, `stockMoveReaction` and the `executeCheck` legs.
3. **New or retuned gate → `gate-replay.mjs` first.** A gate that fires on accepted days is
   mistuned; one silent on a rejected day is blind.
4. **A fix is not done until it exists in the committed tree.** `verify-improvements` now has a
   `gitshow:` leg (`1e2ea34`) that proves this. All three phantom fixes would have been caught in
   one run. **Rules 1 and 4 are now mechanical** — `scripts/persistence-gate.ts`.

---

## 8. The numbers

- **QG-REWRITE-SCALE** — 38% median → **0%**. Hold under 20%. If it climbs, the 07-31 diagnosis is
  wrong and everything built on it should be reopened.
- **BRIEF LENGTH** — advisory readout, every night. 08-01 was 7,495 words ≈ 47 min against a 30-min
  target. Watch it trend toward ~4,800.
- **Canary count** in `{date}-pipeline-status.md` — should stay near 21. A drop means telemetry was
  reverted.
