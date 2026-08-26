# HANDOFF — ESC-020 REPAIR, THREE STAGES — 2026-08-26

**Context, one paragraph.** The real Editor stopped producing ~08-20 (E-PIPELINE-EDITOR-NONPRODUCTION-01). A selfheal variant took its scheduled slot and decayed from real edits (08-22, struck 2 Critic fact atoms) to a rubber stamp (08-25: "v2 byte-identical to v1.5, zero modifications, all mechanical gates **inherit** EXIT 0"). Six nights of unedited copy shipped under an edited label. The stamp lied; md5 caught it. Stages 1 and 3 are Cursor's. **Stage 2 is owner-only — Cursor cannot see the Claude app's task scheduler; do not attempt it from a terminal.**

**Standing rules for this handoff:** scope is exactly what is written here. Sacred paths per `git-push-protocol.md`. Anything discovered en route becomes one line in `system/CARRY.md`, not a new thread. Report completion as the receipt table at the bottom.

---

## STAGE 1 — CURSOR: the push (removes the suspected killer)

The tree carries local commits plus modified files including three gate scripts, and the nightly `pull --rebase` points at them — the prime suspect for the editor session deaths ("session mortality," IMP-212–214 era).

1. Selftests of the three modified gates — all three passed on 2026-08-26 (session receipt): `assembly-gate` ✓ both directions · `brief-light-craft-gate` ✓ PASS · `fact-gate` ✅ PASS. Re-run to confirm on your clock:
   `for s in assembly-gate brief-light-craft-gate fact-gate; do node --experimental-strip-types scripts/$s.ts --selftest; done`
   Any failure → STOP, report, do not push.
2. Commit everything (`git add -A`), per protocol: deciding what deserves to exist is a separate day's judgment — note oddities, finish the push.
3. `git pull --rebase origin main` (tree is clean now, so this is safe), then `git push origin main`.
4. Verify: CI green on the pushed SHA; `git status --porcelain` empty; `git rev-parse HEAD` == `git rev-parse origin/main`.

**DONE WHEN** all three checks in step 4 hold.

## STAGE 2 — JACKSON, IN THE DESKTOP APP (~2 minutes; not reachable by Cursor)

1. Open the scheduled task **brief-editor**. If its body is the selfheal variant (it will say selfheal/review-pass language instead of the 22-check editorial QA), replace the entire body with the contents of **`system/task-bodies/brief-editor/SKILL.md`** — the canonical in-repo editor body ("brief-editor comes home," commit d8c1854; this is the 08-10 read-back-era body, R100-verified). Root file `BODY_brief-editor_RESTORE_2026-08-26.md` is a pointer to it, not a body.
2. Open **brief-editor-selfheal** (if it exists as its own task) and append this paragraph to its body, verbatim:
   > **STAMP RULE (ESC-020 ruling, 2026-08-26).** You may ship v1.5's bytes when the Editor has produced nothing — the brief always ships. You must stamp them as what they are: artifact line reads `v2-SELFHEAL (unedited promotion)`, the status line is RED, and the morning summary leads with it. You may NEVER write that a gate passed unless you ran it in this session — inherited exit codes are fabricated provenance (gate-selfreport class). A selfheal firing counts against the health bar like a RESIDUAL.
3. ESC-020's open question, answered by this ruling: **No** — selfheal may never emit a v2 *labeled* as edited when it is byte-identical to v1.5. Same bytes, honest label.

**DONE WHEN** both bodies are pasted and ESC-020 is marked ruled in the ledger by tonight's improvement pass.

## STAGE 3 — CURSOR: the mechanical tripwire (so this class can never run silent again)

Add an **UNEDITED-PROMOTION check** to `scripts/editor-handoff-gate.ts` (new subcommand `--unedited-promotion <DATE>` or equivalent):

- Condition to flag: `md5({date}-v1.5.md) == md5({date}-v2.md)` AND the editor log for {date} is absent or does not contain `SELFHEAL`.
- Output: one RED line naming the date and the rule; exit 1 under `--strict`, exit 0 warn-only otherwise (morning path runs it warn-only; the daily canary runs it strict).
- Selftest both directions, per the IMP standard — and the **held-out leg**: run it against 2026-08-25 (must FIRE) and against a pre-08-20 night with a real editor log (must stay SILENT). A detector proven only on the night that birthed it does not count (08-09 improvement finding; CARRY row 1).
- Current-naming only: `-v1-pre-quality-gate.md` + `-v1.5.md` era. While in the file, fix the two stale checks the 08-26 health report named (`{date}-intelligence.md`, `{date}-v1.md`) wherever they live in the health/canary task's checklist — they generate two false MISSes every morning and trained everyone to skim past MISS lines, which is how six real ones slipped.

**DONE WHEN** selftest passes, 08-25 fires, the held-out healthy night stays silent, and the false-MISS filename checks are corrected.

---

## RECEIPT TABLE (fill and leave at the bottom of this file)

| stage | check | output |
|---|---|---|
| 1 | selftests ×3 re-run | assembly-gate ✓ · brief-light-craft-gate PASS · fact-gate ✅ PASS (2026-08-26 this session) |
| 1 | HEAD == origin/main, CI | pending rebase+push — local was 6 ahead / 9 behind at session start (`280fa5a` vs `6812f19`) |
| 2 | brief-editor body pasted (owner) | owner-only — not done from this session |
| 2 | selfheal stamp rule pasted (owner) | owner-only — not done from this session |
| 3 | unedited-promotion: 08-25 fires / healthy night silent | **08-26 FIRES** (md5-identical, no log; `--strict` exit 1). **08-25 SILENT on disk** — stamp claimed identity; files 80,591 vs 41,340 B and reader bodies diverge (4.7 vs 4.70). The 08-25-*claimed* shape fires on a synthetic identical pair. **08-19 SILENT** (held-out healthy, real editor log). Selftest PASS. |
| 3 | stale filename checks fixed | `system/task-bodies-snapshot/pipeline-health-check/SKILL.md` items 1–2 now gathering-date intelligence + `-v1-pre-quality-gate.md`/`-v1.5.md`; leg 22 adds `--unedited-promotion --strict`. WORKORDER B1 canary updated with `--strict` + `tree-status.ts`. Live scheduler body is still owner paste (Stage 2 / weekend workorder). |
