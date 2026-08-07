# Handoff → Cursor · 2026-08-03 · brief-length rail

**One local commit, unpushed: `be7fdf0`. One file: `scripts/validate-brief.ts`.**
`origin/main` is still `13444cf`. Verify before you push. Try to falsify, not confirm.

---

## 1. What this fixes, in one paragraph

The 08-03 brief ran **8,241 words / 52 min** against a 30-minute product and `validate-brief`
**exited 0** with sixteen 🟡 findings. Every length check in the file was advisory. Root cause is
not architecture: until 08-01 the Writer bypassed its pre-drafts and the Quality Gate rewrote ~38%
of the body nightly. Rewriting compresses, so length was governed by accident. The bypass was fixed,
QG rewrite went to 0% and was scored as the engagement's headline win — and that was the removal of
the only stage in the pipeline holding rewrite authority (`Workflow_v3.md:141`). Nothing replaced it.
This commit gives length one blocking rail, deletes a blind duplicate check, and revives dead code.

Measured, not asserted: per-section word counts across 45 briefs show pre-drafted sections at
**1.18×** July and Writer-authored sections at **2.00×** — 87% of the growth is in sections the
Writer generates itself (M&M 3.15×, Geopolitics 3.14×; The Take 1.01×, Discovery 1.01×).

## 2. The change

| Change | Why |
|---|---|
| **`brief-length` 🔴 >5,500 words** | The one blocking rail. A whole-file word count cannot be gamed by adding units and cannot go blind on markup. |
| **Epoch-gated to `2026-08-04`** | The archive is read, never condemned. This is the mistake IMP-125 had to undo. |
| **`<!-- LENGTH-OVERRIDE: reason -->` clears it** | "The brief always ships." A long day is a declared, countable decision. |
| **`checkSixBulletWordCeiling` DELETED** | It matched only `- **` lines, so it found **zero** units in M&M and Geopolitics — the two sections carrying the whole overrun — and it was the **only** length check with a blocking HARD FAIL. `checkSixSectionWordBudget` does the job format-agnostically. |
| **`SIX_SECTIONS` gains The Signal + The Wild Card** | `SIGNAL_UNIT/SIGNAL_HARD` (220/250) were **unreachable dead code**: `isSignal` could never fire because `sectionName` could never be `'The Signal'`. |
| **Section budget uses the section's own unit ceiling** | Was `3 × UNIT_HARD` for everything; would have condemned a compliant Signal (3×250, not 3×180) the moment it was added. Message now reports the number it computes (said `×160`, computed `×180`). |
| **`NAMED_SECTION_BUDGETS` rebuilt off the JULY MEDIAN** | Was "July MAX + 12%". `▸ THE MODEL` was 780 against its own July median of **414** — a section that had doubled still passed as "within normal range". |
| **`checkAISectionMinBullets` made format-agnostic** | As a **FLOOR** counting only `- **`, prose composition counts 0 units and **HARD-STOPS a good brief** at the 7:00 PM gate. A blind ceiling ships bloat; a blind floor halts the pipeline. |

Net **−33 lines** (77 insertions, 110 deletions). This is mostly a deletion.

**Calibration:** the 28 published July briefs ran min 4,135 · median **4,924 (30.8 min)** · max 6,846.
5,500 would have fired on **4/28 (14%)**. 5,200 would have fired on 25% of work Jackson accepted —
which is how a gate earns the right to be ignored.

## 3. Verify BEFORE you push — five checks

```bash
# 1. Scope: exactly one file, nothing staged, nothing from system/
git show --name-only --oneline HEAD          # → scripts/validate-brief.ts ONLY
git diff --cached --name-only                # → empty
git ls-files system/                         # → empty (system/ is gitignored, line 14)

# 2. Selftest
node --experimental-strip-types scripts/validate-brief.ts --selftest    # → PASS

# 3. Epoch behaves: 08-03 must NOT fail on length; a post-epoch copy MUST
node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/2026-08-03.md \
  | grep 'BRIEF LENGTH'                      # → 🔴 line printed, but NO brief-length failure
cp content/daily-updates/2026-08-03.md /tmp/2026-08-04.md
node --experimental-strip-types scripts/validate-brief.ts /tmp/2026-08-04.md \
  | grep brief-length                        # → 🔴 HARD FAIL present

# 4. Override clears it — placed INSIDE a section, never above the first heading (IMP-123)
#    Insert `<!-- LENGTH-OVERRIDE: <20+ char reason> -->` after `## ▸ OVERNIGHT`, re-run,
#    expect `⚪ LENGTH-OVERRIDE accepted` and NO brief-length failure.

# 5. ARCHIVE REGRESSION — the one that matters
```

**⚠️ Trap I hit on check 5, do not repeat it.** I first A/B'd by copying the old validator to
`scripts/_tmp_validate_old.ts` and running both. It reported **7 retroactive failures**. They were
fake: run under a different filename the old validator silently skips checks and returns a false
`exit 0`. **A/B only by swapping file contents at the same path:**

```bash
git stash list; cp scripts/validate-brief.ts /tmp/new.ts
git show HEAD~1:scripts/validate-brief.ts > scripts/validate-brief.ts
for d in 2026-07-21 2026-07-26 2026-07-27 2026-07-28 2026-07-29 2026-07-31 2026-08-01 2026-07-22 2026-07-30 2026-08-03; do
  node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/$d.md >/dev/null 2>&1; echo "$d OLD=$?"; done > /tmp/old.txt
cp /tmp/new.ts scripts/validate-brief.ts
for d in 2026-07-21 2026-07-26 2026-07-27 2026-07-28 2026-07-29 2026-07-31 2026-08-01 2026-07-22 2026-07-30 2026-08-03; do
  node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/$d.md >/dev/null 2>&1; echo "$d NEW=$?"; done > /tmp/new.txt
paste /tmp/old.txt /tmp/new.txt
```
**Expected: all ten identical.** That is my result. If any row differs, do not push — report it.

## 4. Push (per `REPO_WORKFLOW.md`)

```bash
git pull --rebase origin main     # never push on a stale branch
git push origin main
```
**Never `git add .`** — the `b3512c2` incident (a pathspec-less commit swept a stale index and
reverted IMP-108/101/110) is why. My commit used an explicit pathspec.

## 5. Things you must know that are NOT in the commit

1. **`system/Brief_Editor.md` was edited on disk and is NOT in git** — `system/` is gitignored
   (`.gitignore:14`). I added **Gate 16 — Compression to Budget**, the second draft: cut in
   `Craft_Standard.md` order, **prefer cutting a UNIT whole over shrinking every unit** (a Six
   subsection is 2-3 units; on 08-03 M&M ran 5 at 406/314/410/382, in July it ran 2), and the
   `LENGTH-OVERRIDE` escape hatch. Also corrected the "Word ceilings" line, which still claimed
   `>180 🔴` blocks — it does not, and did not.
   **Residual risk: this file has no version control. If it is overwritten, the second draft
   silently disappears and nothing will notice.** Worth a backup convention.
2. **`system/Brief_Writer.md` and `system/tasks/brief-draft.md` — I did not touch them.** They
   already carried the 160/180 + "2-3 bullets, not 4-5" + 4,800-word text when I arrived.
3. **PRE-EXISTING, NOT MINE, NOT FIXED:** 7 of the 10 most recent briefs fail `validate-brief` on
   `model-recency` / `model-rotation-assigned`. Present on `HEAD~1` too. Needs its own look.
4. **Cleanup:** `_to_delete/` holds a temp file and three stale git `*.lock` files that git could not
   unlink through the remote bridge. **They are cleared from `.git/` — the repo is healthy** — but
   delete `_to_delete/` yourself; I cannot remove files.

## 6. What I check after you push

- `gitshow:scripts/validate-brief.ts:brief-length` resolves on `origin/main` — the fix exists in the
  committed tree by this repo's own standard, not just on someone's disk.
- Tonight's brief: **does it land under 5,500?** My prediction on record, before it runs — the prose
  targets alone were never going to do it, and now something blocks. If it ships over 5,500 with no
  declared override, the rail did not fire and I want to know why.

## 7. What was deliberately NOT built

No new generators. No Architect allocation layer. No per-section craft critics. No changes to the
four pre-drafts. The diagnosis was a missing number and a missing rewrite pass, not an architecture
problem — and the four pre-drafted sections are the only ones that did not drift.
