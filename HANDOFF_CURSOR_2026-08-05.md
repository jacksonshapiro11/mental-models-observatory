# Handoff → Cursor · 2026-08-05

**Three commits to verify and push.** `origin/main` was `59950f4` when this started.

| commit | file | what |
|---|---|---|
| `d8bd450` | (yours) | IMP-126 itemization-sum, IMP-127 estimate-vintage, IMP-128 gate self-report, IMP-129 anchor forensics |
| `a39798a` | `scripts/validate-brief.ts` | Take counter-case: replace the gameable word floor |
| `352b251` | `scripts/validate-brief.ts` | counter-case enforced at every call site, one implementation |

Full reasoning: `system/Change_Record_2026-08-05.md` (gitignored — on Jackson's disk).

---

## Why the counter-case changed

`checkTakeCounterCase` required the counter to be **≥30% of The Take by word count**, blocking.
**Nothing verified an objection was present**, so 30% of hedging passed. And it was gamed in the
obvious direction — 08-04 editor log: *"The Take — **main case only** — which raises the counter-case
ratio (39.1%)."* **The ratio was hit by compressing the case, not by strengthening the counter.**

A metric satisfiable without the thing it measures changing is the failure class this whole
engagement has been about.

## What replaced it

**PRESENCE stays blocking**, and now also accepts an explicit *"no serious argument against this one."*
Everything else is **ADVISORY**:

- **Banned form** — an observable (`**Watch:**`, "the tell") standing where an argument belongs
- **First person** in the counter
- **Proportion CEILING** (~40%, and never longer than the case) — replacing the floor

`counterCaseAdvisories()` is **one helper called from three sites**: The Take, each Signal idea, every
Six forward read. Do not inline copies per section — that is the drift this exists to prevent.

**Net effect versus the old check is a LOOSENING.** Deliberate: tomorrow's pipeline was live when it
landed, so nothing could get stricter mid-run.

## The sweep (trailing 30 briefs, re-run after the refactor)

| where | check | fired |
|---|---|---|
| The Take | first person | 46% |
| The Take | proportion over ceiling | 43% |
| The Six | forward read, observable only | 33% |
| The Signal | observable with no argument | 30% |
| The Signal | first person | **6%** |
| all | declared "no serious argument" | **0/30** |

**Zero declarations in thirty briefs** — the old floor made "no strong objection today" unsayable, so
a counter was manufactured nightly. Everything stays advisory until trailing-30 rates fall under ~15%;
promotion order is in `Counter_Case_Standard.md`, Signal first-person first.

*Note on method: the first implementation flagged The Take's banned form at 26%. Refactoring onto the
shared helper dropped it to 0 — those were **false positives**, the Take was arguing and the narrow
regex could not see it. The sweep was re-run after the change rather than carried forward. A sweep
result is only valid for the implementation that produced it.*

---

## Verify

```bash
node --experimental-strip-types scripts/validate-brief.ts --selftest            # PASS

node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/2026-08-05.md; echo $?
# exit 0, with 🟡 counter-case advisories printed

# 10-brief A/B — swap CONTENTS at the same path, never a renamed copy
# (a renamed copy makes the old validator skip checks and fake a clean baseline)
cp scripts/validate-brief.ts /tmp/new.ts
git show HEAD~2:scripts/validate-brief.ts > scripts/validate-brief.ts
for d in 2026-07-21 2026-07-26 2026-07-28 2026-07-29 2026-07-31 2026-08-01 2026-07-22 2026-07-30 2026-08-03 2026-08-05; do
  node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/$d.md >/dev/null 2>&1; echo $?; done > /tmp/o
cp /tmp/new.ts scripts/validate-brief.ts
for d in 2026-07-21 2026-07-26 2026-07-28 2026-07-29 2026-07-31 2026-08-01 2026-07-22 2026-07-30 2026-08-03 2026-08-05; do
  node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/$d.md >/dev/null 2>&1; echo $?; done > /tmp/n
diff /tmp/o /tmp/n        # expect identical
```

**Expected: zero exit-code changes.** That is my result. `2026-08-04` exits 1 both before and after —
it is your `estimate-vintage` check on the EBRI $92.4bn frame, not this change.

Then: `git pull --rebase origin main && git push origin main`. Never `git add .`.

---

## Not in these commits — on Jackson's disk only (`system/` is gitignored)

`Constitution.md` · `Counter_Case_Standard.md` · `Change_Record_2026-08-05.md` ·
`Brief_Light_Generator_v2.md` (**not live**) · Gate 16 in `Brief_Editor.md` · Scanner Phase 1.5 ·
Signal 300/340 in four prose homes.

---

## Please push back rather than rubber-stamp

Every exchange in this engagement has found a real defect in the other's work — you caught the
soft/hard label swap and the `selectedVoice` build break; I caught the dead `SIGNAL_UNIT` branch and a
calibration figure I had asserted instead of measured. **Two specific things worth attacking here:**

1. **`CC_ARGUMENT` is a regex standing in for "does this contain an argument."** That is a proxy, and
   proxies are what we spent the week removing. It already produced one false-positive class. Try to
   break it.
2. **The advisory thresholds (~15% promotion, ~40% ceiling, ~30% declared-none) are still partly
   taste.** The sweep measured current rates; it did not establish that those are the right lines.

## Open, not done

Super Brief v2 wiring (eight consumers — see `HANDOFF_CURSOR_LIGHT_V2.md`) · counter-case promotion
after a re-sweep · the ~2.19M-token living doc, +17k/day · the escalation router · roster expansion.
