> # 🔴 SUPERSEDED-BY-MIGRATION — 2026-08-20
>
> **This manifest is closed. Do not install from it.** The body it describes has moved into the repo
> under the selection-judge pattern:
>
> `BODY_brief-editor_REPLACEMENT.md` → **`system/task-bodies/brief-editor/SKILL.md`**
>
> - `git mv`, recorded as **R100** — a pure rename, history preserved.
> - sha256 **before and after**: `fb60597a722dc008774556bffdad1f6b66aa94086fc8e702edc4873a2504f354`,
>   byte-identical, and equal to the hash this manifest declared.
> - 🔴 **The destination is inside gitignored `system/`.** It is tracked ONLY because `git mv` moved an
>   already-tracked file; `.gitignore` governs untracked files. **A plain `mv` + `git add` would have
>   silently no-opped and deleted the body from version control entirely** — the 2026-08-15 failure,
>   with the source deleted in the same commit. Verified before the move, not after.
> - Consequence to know: the file is now **tracked-but-ignored**. If it ever leaves the index it
>   cannot be re-added without `git add -f`. `system/task-bodies/selection-judge/SKILL.md` has been
>   in this state since `548868b` and is the precedent this follows.
>
> **The owner repoints the app task himself.** Nothing under `~/Documents/Claude/Scheduled/` was
> touched by this session.

---

# INSTALL MANIFEST — 2026-08-19

**One round. All of it or none of it.** Piecemeal installs are how a canonical filename ends up with a
stale occupant, which this system has already paid for once.

**Scope: ONE file.** Parts 3 and 4 of `WORK_ORDER_EXCELLENCE.md` were determined **doctrine-viable**
and need no install; Part 2 is the only part that requires a task body, because a read-back loop has to
run at a fixed point in the pipeline relative to publish, and a generator can only say how to write —
not when to run a loop.

| # | source in repo | target path | bytes | sha256 |
|---|---|---|---|---|
| 1 | `BODY_brief-editor_REPLACEMENT.md` | `~/Documents/Claude/Scheduled/brief-editor/SKILL.md` | 15872 | `fb60597a722dc008774556bffdad1f6b66aa94086fc8e702edc4873a2504f354` |

## Procedure

1. **Back up first, dated:** `cp <target> <target>.bak-2026-08-19`
2. Paste the source file over the target **in full** — never a partial merge.
3. **Confirm the hash on the installed file** and paste the output back:
   `shasum -a 256 <target>` — it must equal the sha256 above, character for character.
4. If any hash disagrees, **stop and report.** Do not install the rest.

## What this body changes

- **`--product=full` on every read-back command.** Without it the full brief overwrites the light
  brief's graded state for the same date.
- **The segmenter contract, written where the operator acts:** it was verified against the real
  2026-08-19 brief on 2026-08-19 (24/24 against the claims sidecar; it previously returned 19/24).
  A count or label mismatch is a finding, and a zero-unit return is never a pass.
- **The actuation law, inherited verbatim:** unanimous-of-3 for this surface's first seven nights then
  majority; **direction inversions at 2-of-3 immediately from night one**; graded bytes equal shipped
  bytes; every pass with rewrite authority sits inside the loop's jurisdiction.

**The app wrapper needs no change.** This replaces the body the wrapper loads.
