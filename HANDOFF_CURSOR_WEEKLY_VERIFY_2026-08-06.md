# Handoff → Cursor · verify the weekly two-tier build (and today's residue)

**Written by Claude (Cowork) 2026-08-06 afternoon. Verify-first: change nothing until the checklist is green.**
Full receipts and context: `WEEKLY_TWO_TIER_VERIFICATION_2026-08-06.md` · runbook: `WORK_ORDER_WEEKLY_TWO_TIER.md`.

## What is in the working tree (unpushed) and what it must NOT do

Two tracked files modified: `scripts/brief-light-format-gate.ts`, `scripts/brief-light-craft-gate.ts`.
They add a weekly two-tier contract behind `WEEKLY_V2_EPOCH = '2026-W33'` (inert — no W33+ file exists) and
replace the daily craft gate's name-keyed lede repetition exemption with a **positional** one (this part IS
live behavior for tonight's 8/7 daily generation, which runs gates from this tree). New tracked-candidate
files at root: `SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md` + the two docs above. Local-only
(`system/`, not yours to verify beyond existence): `Weekly_Light_Generator.md` edited in place with a
🔴 pre-W33 STOP guard at the top (backup `…​.bak-pre-v2-20260806`), `task-bodies-snapshot/weekly-draft/SKILL.md`
updated. My session scratch is in `_to_delete/session-2026-08-06/`.

**The one invariant everything below tests: nothing behaves differently for any existing file.**

## Independent re-verification checklist — run each, every result must match

```bash
# 1. types + audio contract on this tree
npm run type-check                                    # exit 0
npx tsx scripts/audio-gate-regression.ts              # ALL CHECKS PASS

# 2. weekly example passes both gates in-band AT A DATED NAME (gate keys off YYYY-W##-light.md)
cp SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md /tmp/2026-W33-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/2026-W33-light.md --enforce-length
#   → ✅ 2,296 words ≈ 14.3 min (target 2,000-2,400) · FORMAT GATE PASSED (TWO-TIER WEEKLY) · 5 stories
node --experimental-strip-types scripts/brief-light-craft-gate.ts /tmp/2026-W33-light.md \
     content/daily-updates/weekly/2026-W31-jul-26-aug-01.md
#   → CRAFT GATE PASSED, and NO orphan-number warning (NO NEW ATOMS holds against the real full Weekly)

# 3. archive exit parity — old gates (origin/main) vs this tree, exits identical on EVERY file
git show origin/main:scripts/brief-light-format-gate.ts > /tmp/old-f.ts
git show origin/main:scripts/brief-light-craft-gate.ts  > /tmp/old-c.ts   # imports ../lib — run from repo root
for f in content/daily-updates/2026-0*-light.md content/daily-updates/weekly/2026-W*-light.md; do
  a=$(node --experimental-strip-types /tmp/old-f.ts "$f" >/dev/null 2>&1; echo $?); b=$(node --experimental-strip-types scripts/brief-light-format-gate.ts "$f" >/dev/null 2>&1; echo $?)
  c=$(node --experimental-strip-types /tmp/old-c.ts "$f" >/dev/null 2>&1; echo $?); d=$(node --experimental-strip-types scripts/brief-light-craft-gate.ts "$f" >/dev/null 2>&1; echo $?)
  [ "$a$c" = "$b$d" ] || echo "DIFF $f fmt $a→$b craft $c→$d"
done   # → no output. (old-c.ts import trick: if the ../lib resolve fails from /tmp, copy old-c.ts into scripts/ under a temp name instead)
# I verified a span sample + both weeklies (all SAME) and 62/62 dailies on the pre-positional gate pair;
# your full sweep on THIS pair is the completing evidence.

# 4. the daily two-tier example is unmoved
cp SUPER_BRIEF_TWO_TIER_EXAMPLE_2026-08-05.md /tmp/2026-08-07-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/2026-08-07-light.md --enforce-length  # PASS (TWO-TIER)
node --experimental-strip-types scripts/brief-light-craft-gate.ts  /tmp/2026-08-07-light.md content/daily-updates/2026-08-05.md  # PASS

# 5. the positional lede fix — reproduce the break-fix matrix (the 08-06 adversarial finding)
# Take /tmp/2026-08-07-light.md, plant "$318 billion" in three sections, and check four variants:
#   (a) title "### The Line", figure in THE LINE + THE UPDATE + MARKETS MINUTE  → craft gate FAILS (old gate PASSED — the under-fire hole)
#   (b) empty title "### ", figure in lede + UPDATE + MM                        → craft gate PASSES (old gate FAILED — the over-fire hole)
#   (c) normal title, figure in lede + UPDATE + MM                              → PASSES (lede exempt by design)
#   (d) normal title, figure in UPDATE + MM + THE CLOSE                         → FAILS (real duplication still caught)

# 6. D1 regression — the weekly keeps the "The Take" ban
#   Add the prose sentence 'The Take covers this.' to /tmp/2026-W33-light.md → craft gate must FAIL (cross-product).

# 7. pre-epoch weekly names stay on the old contract
cp SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md /tmp/2026-W30-light.md
node --experimental-strip-types scripts/brief-light-format-gate.ts /tmp/2026-W30-light.md   # PASSED (SELECTION), not TWO-TIER WEEKLY
```

## Adversarial targets (worth your break attempt)

1. **The W-epoch key.** `weeklyFromPath` requires `\d{4}-W\d{2}` and compares strings. Year boundary
   (2026-W52 → 2027-W01) orders correctly, but a NON-zero-padded name (`2026-W7-light.md`) doesn't match
   → silently pre-epoch. The pipeline zero-pads today — confirm nothing writes single-digit weeks, or
   widen the regex to `W\d{1,2}` with a pad-normalize in both gates.
2. **The positional strip.** It removes the block from the first non-▸ `###` line to the first `## ▸`
   header. Try to construct a light where that window swallows too much (a `###` inside the masthead?)
   or too little (title below the first section?) and mis-counts repetition either way.
3. **The example's provenance.** Spot-check 5 numbers in the W31 example against the full Weekly by hand;
   the gate's number probe is a net, not a proof.

## After everything is green — allowed actions (each separately, nothing else)

- **Commit + push the two gate files** (safe now: weekly branch inert until W33, daily positional fix is
  strictly-better and parity-proven): `feat(light): weekly two-tier contract behind WEEKLY_V2_EPOCH=2026-W33; harden lede repetition exemption to positional (fixes empty-title over-fire + section-name-title under-fire)`.
  Optionally a second commit for `SUPER_BRIEF_WEEKLY_TWO_TIER_EXAMPLE_2026-W31.md` + the two docs:
  `docs(light): weekly two-tier work order, verification record, worked W31 example`.
- **Do NOT** touch `system/` (the STOP guard at the top of `Weekly_Light_Generator.md` must survive), do
  not flip any epoch, and per REPO_WORKFLOW: `git pull --rebase` first, watch for brief-file deletion
  illusions, never `git add .` (the W27 factcheck json and `_to_delete/` stay out).
- **Hygiene, if you have ten minutes:** move `content/daily-updates/2026-07-29-editor-log.md` out of
  `content/` (it breaks local sitemap prerender), decide the W27 factcheck json (commit or revert), and
  answer: which registry row is the 146th in your `146 rows · 145 checks passed · 0 FAIL` run?

**Report format: per-item PASS/FAIL with the actual output line, anything that didn't match, and your own
verdict on pushing. Receipts, not assertions.**
