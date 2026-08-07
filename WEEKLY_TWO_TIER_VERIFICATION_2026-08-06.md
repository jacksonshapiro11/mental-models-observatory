# Weekly Light two-tier — Build + Verification Record

**Date:** 2026-08-06 · **Author:** Claude (Cowork session) · **Ethos:** receipts, not assertions.
**Companion:** `WORK_ORDER_WEEKLY_TWO_TIER.md` (the runbook + locked decisions). Parallels the daily's
`SUPER_BRIEF_V2_VERIFICATION_2026-08-05.md`.

This records everything done across this session: (A) re-verifying the daily two-tier deploy, (B) the
IMP-130..135 gate-hardening round, and (C) building the weekly two-tier (this file's main subject).
Every claim has a command you can re-run.

---

## A. Daily two-tier — DEPLOYED and re-verified

The daily Super Brief two-tier (4-5 deep THE UPDATE + THE LINE + THE TAKE, word-count rail, 9 consumers)
was pushed to `origin/main` and deployed to Vercel across commits `01e1cfe` / `564cd0b` / `fb0a1e3`.
Independently re-verified this session: `npm run type-check` 0 errors; audio regression ALL PASS; the
worked daily example passes both gates in-band (1,596 words); archive exit-parity **62/62 daily lights
identical** old-gate vs new; publish path runs no light gate (the brief always ships). **Status: live.**

**The one daily item still owed by a human (unchanged, on a clock):** the LIVE task body at
`~/Documents/Claude/Scheduled/brief-light/SKILL.md` must be the corrected two-tier body (frontmatter
fixed, 8-10 min labels) **before ~8 PM ET tonight**, or the nightly generator silently produces a
v1-format brief. The repo snapshot (`system/task-bodies-snapshot/brief-light/SKILL.md`) already matches.
Also owed: one real `gpt-4o-mini-tts` listen of THE LINE.

## B. Gate-hardening round (IMP-130..135) — DEPLOYED and re-verified

Commits `0339ecf` / `cf8fd74` / `41b1258` (main == origin at `41b1258`). Re-verified: tsc 0; audio
regression ALL PASS (check 10 now covers the rotating spoken cue, empty/rule-only input, multiline
normalization, spaced rules); five gate self-tests PASS; the light pipeline is **byte-identical** since
`fb0a1e3` (so A's verification carries by identity). The one A/B flip — `2026-08-06` fact-gate 1→0 — is
the intended harmonization false-positive fix (clause-scoped; silent on nominal compliance, fires on a
real later confession), and it *removes* a false blocker at the publish path rather than adding one. Only
`fact-gate.ts` of the six changed gates sits in `publish-gate.sh`; the other five run in the editor/
improvement loop where fail-closed is correct. `verify-improvements` red locally is the offline
environment (corrections-gate does a `git ls-remote` currency proof with no network here), not a defect.

## C. Weekly Light two-tier — BUILT, INERT until epoch `2026-W33`, verified

### What the weekly needed (and did NOT)

The daily conversion already wired every consumer the weekly light reuses — `lib/weekly-light-parser.ts`
delegates to the daily `sectionMetaFor` (knows `the-line`/`the-take`/`our-calls`); the viewer, audio
engine (`LIGHT_SECTION_ORDER`, cue/beat), email `renderLineItems`, and Substack strips are shared;
`publish-weekly.py` is section-shape-agnostic. **Zero consumer changes.** The build is: two gate edits
(the push), the generator edited in place (local), the task body (local), and a worked example.

### What was built — and pushed

> **Update, same day:** Cursor independently verified this build against the handoff checklist (clean-tree
> tsc PASS · audio ALL PASS · W33 example both gates green at 2,296 · **archive parity 120 files, 0 exit
> diffs** · daily example unchanged · positional-lede matrix FAIL/PASS/PASS/FAIL as specified · weekly
> "The Take" ban fires · W30 name stays SELECTION · 5 example figures hand-traced to the full W31) and
> **pushed the two gate files in `8d160a4`**, with two amendments of its own: (1) `weeklyFromPath` now
> normalizes single-digit week slugs (`2027-W7` → `2027-W07`, weeks validated 1-53) — closing the exact
> fail-open named as adversarial target #1, since other weekly consumers accept unpadded slugs; (2) the
> weekly over-ceiling console message now reports 13-15 min, not the daily 8-10. The daily positional lede
> fix is therefore **live**; the weekly contract remains inert until a W33+ file exists.

| File | Change | Tracked? |
|---|---|---|
| `scripts/brief-light-format-gate.ts` | `weeklyFromPath` + `WEEKLY_V2_EPOCH='2026-W33'`; `WEEKLY_V2_REQUIRED` (Update·**Line**·Markets·**Our Calls**·Interesting·Meditation·Model·Close — **no Take**); weekly length band 2,000-2,400 / 2,700 hard; THE LINE band **9-16** for weeklies; `# WEEKLY LIGHT` + `## Week of` masthead awareness. Daily paths resolve to the daily constants → daily behavior unchanged. | ✅ tracked (push) |
| `scripts/brief-light-craft-gate.ts` | Same epoch; weekly word band advisory 2,000-2,400; 4-5 deep; **the "The Take" cross-product ban STAYS ACTIVE for weekly** (keyed on daily `isV2`, which is false for weeklies — decision D1). **Plus the daily-side lede-exemption hardening: name-keyed → POSITIONAL** (fixes the 2026-08-06 adversarial cases, and covers both products at once). | ✅ tracked (push) |
| `SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md` | Worked two-tier weekly from the real W31 material: 5 deep + 9 THE LINE items, both gates green in-band at 2,296 words, NO-NEW-ATOMS clean. | ✅ tracked (repo root) |
| `system/Weekly_Light_Generator.md` | Edited **in place** to the two-tier spec (deep-tier rule, THE LINE section, 4-5 deep, 2,000-2,400 band, D1 no-Take, coverage-is-inviolable). Earned rules preserved. Backup `…​.bak-pre-v2-20260806`. | local-only (gitignored) |
| `system/task-bodies-snapshot/weekly-draft/SKILL.md` | New **Step 5b**: generate the two-tier light + run both gates under `--enforce-length` + coverage diff, do NOT self-grade. | local-only (gitignored) |

### Verification evidence (re-runnable on the device)

**1. Types + audio.** `npm run type-check` → 0 errors with the new gates in the tree. Audio regression →
ALL CHECKS PASS (audio untouched this build).

**2. Weekly example passes both gates in-band, at a dated `-light.md` name** (the gate keys weekly-mode
off the `YYYY-W##-light.md` filename, exactly like the daily keys off `YYYY-MM-DD-light.md` — so a
descriptively-named example must be copied to a dated name to test, same as the daily):
```
cp SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md /tmp/2026-W33-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/2026-W33-light.md --enforce-length
  → ✅ LIGHT LENGTH 2,296 words ≈ 14.3 min ; ✓ FORMAT GATE PASSED (TWO-TIER WEEKLY)  (5 stories)
node --experimental-strip-types scripts/brief-light-craft-gate.ts /tmp/2026-W33-light.md content/daily-updates/weekly/2026-W31-jul-26-aug-01.md
  → ✓ CRAFT GATE PASSED  (2296 words, 0 em-dashes)   [no orphan-number warning: NO NEW ATOMS holds]
```

**3. Archive exit-parity — deployed gates vs new, zero changes.** Span sample (June fail, July/Aug pass)
+ both weekly lights, format + craft: **all identical**. Pre-epoch weekly names read SELECTION; the daily
two-tier example still passes on the new craft gate (positional exemption didn't move its verdict).
```
2026-06-15 fmt 1/1 craft 0/0   2026-07-31 fmt 0/0 craft 0/0   2026-08-05 fmt 0/0 craft 0/0
2026-08-06 fmt 0/0 craft 0/0   W30 fmt 0/0 craft 0/0          W31 fmt 0/0 craft 0/0
/tmp/2026-W30-light.md → SELECTION (pre-epoch, archive safe)
```

**4. The adversarial target (lede repetition exemption) — both 08-06 failure modes fixed.** The daily
handoff flagged that keying the exemption on the Daily-Title *string* could over- or under-fire. Rebuilt
as **positional** (the title+lede block between the `### title` line and the first `## ▸` header). Matrix
(figure planted in 3 sections of the real example, run through the actual craft gate):

| case | OLD (name-keyed) | NEW (positional) |
|---|---|---|
| title "The Line", figure in UPDATE+LINE+MM | exit 0 — **under-fire** (section swallowed, dup missed) | exit 1 — caught ✓ |
| empty title, figure in lede+UPDATE+MM | exit 1 — **over-fire** (legit lede preview blocks) | exit 0 — exempt ✓ |
| normal title, lede preview | exit 0 (intended) | exit 0 ✓ |
| 3 real sections | exit 1 (real dup) | exit 1 — no regression ✓ |

### Locked decisions (were D1-D4)

- **D1 — No `## ▸ THE TAKE` in the weekly light.** OUR CALLS carries the week's dated call + grades; a Take
  duplicates it. So the craft gate's "The Take" cross-product ban stays ACTIVE for weekly-v2 (it keys on
  daily `isV2`, false for weeklies), and `WEEKLY_V2_REQUIRED` has OUR CALLS where the daily has THE TAKE.
- **D2 — Band 2,000-2,400 target / 2,700 hard (~13-15 min).** The old weekly ran pinned at 2,398-2,399
  (one/two words under the 2,400 selection ceiling — written *to the bound*). Two-tier trades ~200 words
  of depth for ~double the coverage.
- **D3 — Deep tier 4-5, the week's contrarian catch holds one slot** (weekly analog of Signal-takes-a-slot).
- **D4 — Epoch `2026-W33`; THE LINE band 9-16.** A curated week yields fewer atomic stories than 7 dailies
  (W31 had 14 total → 5 deep + 9 line), so the weekly band sits below the daily's 8-12-per-day.

### Honest gaps (not verified)

- **No real weekly generation yet** — coverage/length proven on a hand-built example, not the live
  `weekly-draft` output. First real two-tier weekly is the true end-to-end test.
- **No real weekly audio** — THE LINE at 9-16 items is a longer recited run than the daily's ~9; the
  rotating cue matters more here. One real listen owed at first run.
- **`npm run build` / deploy** not re-run for the weekly (the consumer code is byte-identical to the
  already-deployed daily two-tier, so risk is low, but the flip runbook says run it).
- **The generator's APPENDIX** still inlines the old W26 SELECTION example; the pointer now names the W31
  two-tier example as canonical, but the inlined appendix should be swapped when convenient.
- **The LIVE `weekly-draft` body** (`~/Documents/Claude/Scheduled/weekly-draft/SKILL.md`, outside the repo)
  is NOT updated — only the repo snapshot is. Mirror Step 5b into it at flip time (same as the daily).

---

## What is live vs staged vs owed — the one-screen truth

| | State |
|---|---|
| Daily two-tier (code) | **LIVE** on origin/main + Vercel |
| Daily positional lede fix | **LIVE** (pushed with the weekly gates in `8d160a4`) |
| Daily live task body (SKILL.md) | ⏳ **owed by ~8 PM ET tonight** — corrected file delivered, placement unconfirmed |
| IMP-130..135 gates | **LIVE** on origin/main (registry row 146 = IMP-079, per Cursor) |
| Weekly two-tier gate contract | **PUSHED** in `8d160a4` (Cursor-verified), **inert** until a W33+ file exists |
| Weekly generator + task-body snapshot | on disk, local-only (gitignored); generator carries the pre-W33 STOP guard |
| Weekly example + docs | on disk untracked — reconciled 2026-08-06 PM (W33 · 2,000-2,400/2,700 · 9-16 everywhere); ready for Cursor's docs commit |
| Weekly live task body | ⏳ owed at flip time (not tonight) |

Nothing weekly is live. The two weekly gate edits sit in the working tree next to the daily deploy; because
they are byte-identical for every daily and pre-W33 file, they are safe to ride along on the next push, and
tonight's daily generation using them changes nothing (it also picks up the daily lede-exemption hardening).
