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
