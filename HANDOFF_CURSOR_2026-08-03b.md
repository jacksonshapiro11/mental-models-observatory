# Handoff → Cursor · 2026-08-03 (update b) · supersedes nothing, adds to `HANDOFF_CURSOR_2026-08-03.md`

**To push: `be7fdf0`, `3ff3357`, `c7a045a`, `5a92a78`.** `origin/main` still `13444cf`.
`system/` now has its own **local-only** git repo — never push it, it has no remote by design.

---

## A. Corrections to `Status check — 2026-08-03 EOD`

That doc is mostly right. Issues 2 and 3 verify. **Two things in it are wrong and one is now stale.**

**A1 — Issue 1's stated cause is falsified.** The doc blames the 54 KB `--stamp` manifest setting a
long register. Per-section word counts across 45 briefs say otherwise:

| | Jul median | Aug median | × |
|---|---|---|---|
| Sections **with** a pre-draft (Take, Signal, Discovery, C&C) | 2,176 | 2,564 | **1.18** |
| Sections the **Writer authors** (M&M, Geo, AI&T, Wild Card, Model, Inner Game, Overnight, Dash) | 2,532 | 5,070 | **2.00** |

The Take **1.01×**. Discovery **1.01×**. C&C **1.09×**. M&M **3.15×**. Geopolitics **3.14×**.
**87% of the growth is in sections the Writer generates itself.** If a long context were setting the
register globally it would have lifted the imported sections too; they did not move at all. The doc
cites M&M as "the tell," but M&M is what *both* hypotheses predict — the imported sections are the
discriminator and they point the other way. Mechanism is **displacement**: the Writer used to spend
its output budget authoring The Take and The Signal (the bypass); those now arrive finished and the
budget went to what it still authors. **Do not shrink the manifest — it is not the cause.**

**A2 — "length is ADVISORY, never blocks" is no longer true.** `be7fdf0` makes `brief-length` a
🔴 HARD FAIL above 5,500 words, epoch-gated to 2026-08-04. The doc's check #2 expects `exit 0` on
`2026-08-03.md` — it still passes, but only because 08-03 is *pre-epoch*. Do not read that as
"advisory is working."

**A3 — the quality test in that doc does not measure what it claims.**
`grep -ci essential daily-briefs/2026-08-04-critic.md` counts **lines**, is case-insensitive, and
matches the word wherever it appears in rubric prose. It returns ~14-44 on files whose real Essential
count is 4. Use the verdict table instead:
```bash
grep -cE '^\|[^|]+\|\s*\**\s*Essential\s*\**\s*\|' daily-briefs/2026-08-04-critic.md
```

## B. The quality question, measured

**Length bought volume, not quality.**

| Brief | Words | Essential | Earns Space |
|---|---|---|---|
| 2026-07-20 | 4,431 | **5** | 10 |
| 2026-07-22 | 4,240 | **4** | 11 |
| 2026-07-23 | 4,821 | **4** | 12 |
| 2026-08-01 | 7,496 | **4** | 14 |
| 2026-08-03 | 8,241 | **4** | 15 |

~3,400 extra words → **zero extra Essentials**, ~4 extra mid-tier items. Compressing to ~4,900
should hold Essentials at 4-5 and shed Earns Space. *Caveat: n=2 on the August side and the Critic
recalibrated its default rating downward on 08-03 — read this as "no evidence length buys
Essentials", not proof it cannot.*

**Sources are the one real gain and must be protected — measured as DENSITY, not raw count.** Raw
count rises with length on its own and collapses the moment you compress, so it is useless as a
target. Distinct named sources per 1,000 words: **Jul 0.36 → Aug 0.69** (median 2 sources at 4,924 w
→ 5.5 at 7,868 w). Density roughly **doubled** — a real reporting improvement, not a word-count
artifact. Hold 0.69/1k through compression and a 4,800-word brief carries **~3.3 distinct sources,
still well above July's 2**. `Brief_Editor.md` Gate 16 carries this as the target, plus: when two
units rest on the same source cut the weaker first, and a unit carrying the brief's only appearance
of a source is the last thing to go. Compression removes duplication, not coverage.

**On "expanding the source network": adding names to the roster is not the lever.** `SOURCE_NETWORK.md`
has ~188 roster entries, 31% never appear in a brief, and **EPA / FDA / USDA / EIA — which carry the
strongest section — are on none of them** (verified). A roster that is already 31% unused does not get
better by growing. Derive it from observed published attributions ranked by conversion, the same fix
`sync-model-whitelist.ts` already applied to models. That is item D5, not a blocker.

## C. Verify then push

Run all five checks in `HANDOFF_CURSOR_2026-08-03.md` §3 — **including the A/B trap warning**
(copying the old validator to a different filename fakes a clean baseline; A/B only by swapping file
contents at the same path). Then:
```bash
git pull --rebase origin main && git push origin main     # never `git add .`
```

## D. Open, in priority order — not fixed

1. **🔴 Two Vercel env vars, from the status doc.** `AUDIO_FAITHFUL_VOICING=1`, `TTS_VOICE=ash`.
   Confirmed independently: `grep -ril FAITHFUL-VOICING daily-briefs/ content/` returns **empty**,
   so the GPT path ran every night. Real code, real commit, never switched on.
2. **The living doc** — ~2.19M tokens, +17k/day, read by ~30 tasks. The original usage question and
   the only compounding item. Nobody has verified what fraction any task actually ingests.
3. **"Exists but never runs."** `--stamp`, `checkModelAssigned`, `select-daily-model`, and the Signal
   ceiling `be7fdf0` just revived were all real code nothing invoked. `gitshow:` proves code exists;
   nothing proves it *runs*. Two sweeps close it: static (exported symbol with zero reference outside
   its own file) and dynamic (every check reports the unit count it examined; reconcile that nothing
   examined zero). `persistence-gate.ts` is the natural home — the status doc reaches the same
   conclusion from the env-var side.
4. **Escalation router.** ESC-006 (19 days) and ESC-009 (4 weeks) were both misdiagnosed and routed
   to Jackson. Underlying bugs fixed; the router that misrouted them was not. Two rules: an
   escalation claiming an external blocker must state the evidence the resource is actually absent,
   and recurrence triggers re-diagnosis rather than re-send.
5. **Source roster** — 31% never appears; the strongest section runs on EPA/FDA/USDA/EIA, none on the
   roster. Same bug as the model whitelist, already solved once by `sync-model-whitelist.ts`
   ("the catalog is the pool"). Derive the roster from observed published attributions.
6. **Audio ledger** — 21 incidents, 15 with no row. Choosing a fix from a 29% sample.
7. **Archive replay gives false failures.** `model-recency` / `model-rotation-assigned` fail on old
   briefs because the checks are time-dependent and the ledger has advanced. Not a live bug — 08-03
   passes — but it is what made a clean change look like 7 regressions. Any archive replay needs an
   as-of date.

## E. `system/` version control

`system/` is gitignored on purpose (`.gitignore:14`, "NEVER push") and holds every prompt, with no
history — the 26 `.bak-pre-sysupdate` files were hand-rolled version control. It now has a **local**
git repo: 170 files, **zero remotes**, invisible to the parent. Gate 16 and the corrected word-ceiling
line are in that history. Do not add a remote to it without deciding it is private.

## G. Added after the first handoff — audio + sources (commit `3ff3357`)

**G1 — Will the faithful-voice path work? Yes, with one asymmetry, verified in code.**

| Env var | Reaches | Evidence |
|---|---|---|
| `TTS_VOICE=ash` | **Both** full brief and Super Brief | `light-generate.ts:146`, `full-generate.ts:195` — `process.env.TTS_VOICE \|\| 'onyx'` |
| `AUDIO_FAITHFUL_VOICING=1` | **Super Brief ONLY** | `light-generate.ts:110` reads it. `full-generate.ts:161` hardcodes `skipLlmCleanup: false` — the env var cannot reach the full brief. |

So setting both gives you the ash voice everywhere and the un-distilled script on the Super Brief
only. That matches the EOD status doc. **The full brief stays GPT-distilled until someone changes
`full-generate.ts:161`, which is a code change, not a config change.**

**Both generators now self-report.** They log `VOICE=… · FAITHFUL-VOICING=…` every run;
`full-generate` prints `N/A` and says why, so nobody reads a set env var as covering both paths.
This is the fix for the actual failure: correct code, correctly committed, never switched on, and
**nothing anywhere reported the gap** — discoverable only by listening. After tonight,
`grep 'FAITHFUL-VOICING' <run log>` answers it in one line.

**G2 — Are we CONSIDERING every source? 84% yes. And we found why the other 16% is not.**

Publication is the wrong test alone. A source swept, read, and judged not worth a bullet is working
as designed. A source nothing ever looked at is invisible. `daily-intelligence/` records "considered",
so scoring the roster against it separates the two. `node scripts/source-conversion.mjs --days=30`:

| | count | read as |
|---|---|---|
| roster entries (4 struck-through excluded) | **161** | |
| **PUBLISHED** — reached a brief | **54 (34%)** | earning their place |
| **CONSIDERED** — in intel, not published | **81 (50%)** | ✅ the system working |
| 🔴 **NEVER SEEN** — neither | **26 (16%)** | the only real failure |
| producing but **not on the roster at all** | **17** | already working, unlisted |

**ROOT CAUSE, and it is structural.** `Source_Network_Scanner.md` **Phase 1 is a HARDCODED list of
~13 sources.** Phases 2 and 3 fire only when a source is bound to an ACTIVE thesis or Big Story. With
161 roster entries that means **13 are guaranteed a sweep and ~148 are reachable only by
coincidence.** A good source with no active thesis pointing at it is structurally unreachable —
forever — regardless of quality. **Nothing rotated.** That is the entire explanation, and it is not a
roster-content problem, so adding or removing names would not have touched it.

**FIX SHIPPED — Scanner Phase 1.5, the rotation guarantee.** `--rotate=N` emits the N least-surfaced
roster sources *with their search patterns*, so the Scanner runs a list rather than making a judgement
call. At 8 per sweep across 6 sweeps a day the whole roster is considered every **~3-4 days** for 8
searches per sweep. Two log lines (`ROTATION SWEPT:` / `ROTATION HITS:`) make it auditable — a slot
that produces nothing across many cycles is evidence the row's search pattern is wrong or the source
is dead, which is the input to any later prune-or-expand decision. **Deliberately a coverage
guarantee, not a publication target: excluding a source on the day is fine, never seeing it is not.**

**Cursor — attack this, the measurement is the weak part.** Roster names and prose names diverge
arbitrarily, and I hit that failure three separate times while building it:
- Matching `"Charlie Bilello / Creative Planning"` whole called a live source dead — the brief writes
  `"Charlie Bilello"`.
- Scoring only the first component called **Citrini Research (84 intel mentions)**, **hildobby Dune
  (60)** and **Latent Space (7)** never-seen.
- Scoring all components called `"Jack Clark / Anthropic"` a top converter on **45 hits of the
  company** in a month where Clark was never cited once — it was counting a story SUBJECT.

Current build scores every component with a narrow `SUBJECT_ORGS` denylist and always prints which
name matched. **The 26 is an UPPER BOUND, not a fact** — `"Citrini Research"` may still read unseen
while `"Citrini"` shows 84. Eyeball each entry before retiring it. **The rotation slate is robust to
all of this**: it ranks by observed mentions, so anything actually being seen under another name
carries a high count and falls off the slate by itself. That is why the fix does not depend on the
number being exact — and it is why the fix shipped and the roster edit did not.

The first version of this measurement would have reported that **85% of the roster was dead.** It is
16%. A measurement not checked against a case you already know the answer to is not a measurement.

**Explicitly NOT done, by Jackson's call: no roster edits.** The 17 already-working unlisted sources
(Reuters 17 · FDA 13 · Bloomberg 7 · USDA 6 · Nikkei 6 · FERC 5 · CNBC 5 · EIA 4 · OCC 3 · CFTC 3 ·
Axios 3 · The Information 3 · EPA 2 · FAA · CDC · Al Jazeera · Economist) and the 8 rows with no URL
and no search pattern (Jason Furman · Alexander Stahel · Pierre Andurand · Apricitas Economics ·
Russell Napier · Goehring & Rozencwajg · BlackRock BGRI · Oliver Patel) are **expansion**, a separate
pass. This one was about using what is already there.

## F. Not built, deliberately

No new generators, no Architect allocation layer, no per-section critics, no changes to the four
pre-drafts. The four pre-drafted sections are the only ones that did not drift.
