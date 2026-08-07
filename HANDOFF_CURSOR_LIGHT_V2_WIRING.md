# Handoff → Cursor · Super Brief two-tier · wiring is DONE, needs validate + push

**Written by Claude (Cowork) 2026-08-05 evening. Everything below is on Jackson's disk now.**
Your job: type-check, lint, sanity-read the diff, then push. Jackson has approved the push.

---

## 🔴 FIRST — the same stale-branch trap as last time

`git status` on Jackson's Mac shows a **`.git/index.lock` that the cloud bridge could not remove**
("Operation not permitted" — the bridge runs as a different uid). On your local Mac you have
permission: `rm -f .git/index.lock` if git complains it's locked, then proceed.

Local `main` is **5 commits ahead of origin** (your validate-brief counter-case work: `9a26143`,
`c0d3370`, `42ed7de`, `e67a68c`, plus `2c601ee`). Those go up with this push.

**`git pull --rebase origin main` FIRST.** Per `REPO_WORKFLOW.md`, remote may hold `brief:` commits
(publish.py API path) that show locally as brief-file *deletions* — if any `content/daily-updates/*.md`
shows deleted after the rebase, STOP, do not push, restore from `origin/main`.

---

## What this change does (one paragraph)

The Super Brief spec has always said 1,300–1,600 words / 5–7 min. June hit it; July–August ran ~2,200
(40% over) because **nothing enforced it** and the live *generator* itself still said 1,700–2,200. And
the one-treatment-per-story format silently dropped 38–50% of the full brief's Six and the Signal
almost every day. This wires the **two-tier** fix: `## ▸ THE UPDATE` drops to **4–5 deep stories**, a
new `## ▸ THE LINE` carries **every other full-brief story** as a one-liner, and a new `## ▸ THE TAKE`
carries the dated call. A word-count rail now prints every run and can block **only** inside the
generator's own loop — **the brief always ships**.

---

## Files changed — tracked (these are the push)

| File | What changed | How to verify |
|---|---|---|
| `scripts/brief-light-format-gate.ts` | **Task 1.** Word count (strip HTML comments → whitespace tokens), prints count + min@160wpm every run. 🟡 advisory outside 1,300–1,600, 🔴 >1,900 **blocks only under `--enforce-length`**; `LENGTH-OVERRIDE` escape hatch; `LIGHT_LEN_EPOCH=2026-08-06`. Also: TWO-TIER contract (requires THE LINE + THE TAKE) for briefs dated ≥ `LIGHT_V2_EPOCH=2026-08-07`; THE STORY OF THE DAY stays **optional**. | see "Verify" below |
| `lib/brief-light-parser.ts` | `sectionMetaFor`: ids `the-line`, `the-take`. | parser test below |
| `scripts/brief-light-craft-gate.ts` | Epoch-gated to v2: word band advisory-only (length has ONE home = format gate), 4–5 deep stories, "The Take" removed from cross-product bans (the light now HAS one), THE STORY OF THE DAY lede segment exempted from the repetition counter (it previews ≤4 items by design), THE LINE item check. | archive A/B below |
| `components/super-brief/SuperBriefViewer.tsx` | **New render blocks** for THE LINE (item run) and THE TAKE (dark card). Without this the site parses the sections then renders nothing. | `npm run build` |
| `lib/email/render-brief.ts` | THE LINE renders as a compact item run (`renderLineItems`), not full paragraphs. | build |
| `lib/audio/text-preprocessor.ts` | `the-line`/`the-take` added to `LIGHT_SECTION_ORDER` (else they'd play AFTER The Model), transitions, GPT per-section instructions, and `formatLineSectionForSpeech()` — a `...` beat between LINE items in **both** the GPT and faithful-voicing paths (🔴 the "sounds like a list being recited" risk). | audio dry-run below |
| `lib/substack/post-builder.ts` | `SECTION_STRIPS` + two new PNGs. | — |
| `public/substack-section-the-line.png`, `-the-take.png` | New 1456×108 header strips, matched to the existing set. | eyeball |

## Files changed — local-only (`system/`, gitignored — NOT in the push)

- `system/Brief_Light_Generator.md` — **edited in place** (v2 delta folded in; all earned rules audited present: NO NEW ATOMS ×8, NO MONOLITHS, anti-clustering, reach-forward, predictions-ledger, Counter_Case_Standard, at-most-twice, Craft Standard, Freshness, STANDALONE LEGIBILITY, Life Note). Budget corrected 1,700–2,200 → **1,300–1,600**. Backup: `Brief_Light_Generator.md.bak-pre-v2-20260805`.
- `system/task-bodies-snapshot/brief-light/SKILL.md` — refreshed to the two-tier body + a header note that it is a manual snapshot with no auto-sync.

## Outside the repo — needs a human (Jackson)

- `~/Documents/Claude/Scheduled/brief-light/SKILL.md` — the **live task body**, the thing that actually
  decides the outcome. Delivered as a file in this session (Claude couldn't reach that folder). Jackson
  drops it in. Step 3 → "4–5 deep + every remaining story in THE LINE"; Step 4 → run the gate under
  `--enforce-length`, don't self-grade; 1,300–1,600 kept.

---

## Verify (all run clean in the cloud already; re-run locally)

```bash
# 0. type + lint (authoritative — full graph incl. the .tsx and preprocessor)
npm run type-check && npm run lint

# 1. word rail: archive is never condemned, current regime is flagged
for f in 2026-06-15 2026-06-20 2026-07-31 2026-08-04 2026-08-05; do
  node --experimental-strip-types scripts/brief-light-format-gate.ts content/daily-updates/$f-light.md | grep "LIGHT LENGTH"; done
# June ✅, July/Aug 🔴 — all still exit 0 at the publish path (no --enforce-length). Confirm.

# 2. the brief always ships: publish path exit unchanged vs the ORIGINAL gate on the last 10 lights.
#    (Claude confirmed exit codes SAME on 2026-06-10/15/20, 07-25/31, 08-04/05.)

# 3. two-tier contract fires only in the epoch: a post-epoch old-format file must FAIL structure
#    but STILL exit 0 without the flag (ships), and hard-fail WITH the flag.
```

**Attack surface worth your time** (same spirit as your CC_ARGUMENT break): the craft gate's
repetition exemption keys the lede segment by the **Daily Title** string (that's how
`splitIntoSegments` names the title block). If a future light's Daily Title is empty or duplicated as
a section name, the exemption could over- or under-fire. Try to break it.

---

## Sequence (matches the work order)

1. `npm run type-check && npm run lint` → green.
2. `git pull --rebase origin main` (clear `.git/index.lock` first if needed; verify no brief deletions).
3. Read the diff. The two new PNGs + 7 code files are the surface.
4. Commit in logical chunks (never `git add .`):
   - `feat(light): word-count rail on brief-light-format-gate (advisory; blocks only under --enforce-length)`
   - `feat(light): wire THE LINE + THE TAKE across parser, gates, viewer, email, audio, substack`
   - `chore(light): two substack section strips`
5. `git pull --rebase && git push origin main`.

**Do NOT flip the format by yourself.** The flip is the live task body (Jackson) + generator (already
done, local). The code is backward-compatible: shipping it changes nothing about today's brief; it only
means that when a two-tier `-light.md` appears (first is 2026-08-07), every surface renders it.

---

## What Claude could NOT verify from the cloud (so you must)

- **Real audio.** `api.openai.com` is not in the cloud sandbox's egress allowlist, and `device_bash`
  has no network — so the actual `gpt-4o-mini-tts` MP3 could not be generated here. Claude verified the
  audio **script** (order, intro/outro gates, 9 `...` beats for 9 LINE items) and rendered a **robotic
  espeak** proxy for rhythm only. **Please generate one real dry-run** before or right after the first
  two-tier episode and listen to THE LINE: `AUDIO_FAITHFUL_VOICING` is on, so the page is voiced
  verbatim — the beat is the only thing standing between 10 one-liners and a recited list.
- **`npm run build`** (the Next.js graph) — Claude type-checked every isolatable file clean but did not
  run the full build; the `.tsx` viewer edit wants a real build.
