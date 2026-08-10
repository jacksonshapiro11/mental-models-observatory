# HANDOFF — CURSOR: the clean push, 2026-08-08

**v4.4 — OWNER'S RULING on formatting scope (2026-08-08): the full-tree check revealed the repo was never globally formatted and CI's format:check has been red since it existed. Prettier and lint now enforce CODE ONLY (app, components, lib, src, hooks, types, scripts); everything else is ignored by policy, and Cursor holds bounded authority to add ignore entries for failing paths OUTSIDE that scope without stopping. Inside-scope failures: format them (prettier) or stop with the list (lint). v4.3's parity-first structure and all prior rulings unchanged.**

**Owner: Cursor executes every step. The working session verifies after and touches nothing until
Cursor reports done. One owner per step; nobody else touches the tree.**

## 🕐 EXECUTION WINDOW

**After the morning publish completes, before the evening pipeline starts.** Not before — the morning
publish pushes `2026-08-08` brief content to origin via the GitHub API, and rebasing against a moving
remote is how this gets messy. Not after — the evening chain begins at 17:45 and nothing should be
mid-rebase when it does.

🔴 **HARD CARVE-OUT: `weekly-draft` builds at 14:00. No active rebase from 13:45 until the weekly
completes.** If the push is not finished by 13:45, **pause cleanly** — finish the command you are in,
leave the tree in a committed or fully-stashed state, and resume after the weekly reports SUCCESS. Do
not carry a half-finished rebase across it. A conflicted working tree during the W32 build is how a
publish night turns into a recovery night.

**Also before the push, and before 14:00: 🔴 Jackson pastes `BODY_weekly_REPLACEMENT.md`** into
`~/Documents/Claude/Scheduled/weekly-draft/SKILL.md`. Outside the repo, zero conflict with anything
here — noted only so the ordering is visible to whoever is watching the clock.

## Local state at handoff

7 commits ahead of `origin/main`, nothing pushed, tracked tree clean. `HEAD = 6cadc1d`.

- `6926ae5` — read-back loop night one: P0 fixes + `transmission-readback.ts` + claim-first
- `6cadc1d` — `feat(audio)`: one-claim-per-sentence rule in `SECTION_INSTRUCTIONS`

## 📦 WHAT THIS PUSH CARRIES — read this before you start

`origin/main..HEAD` touches **156 files.** Hygiene (step 1) untracks **102** of them, leaving **~54**:
the real payload plus a set of scratch working documents at repo root — handoffs, labeling sheets,
proposals, verdicts.

🔴 **Those root-level scratch docs are accepted. Origin gains them. Do not improvise cleanup
mid-push.** Deciding what is worth keeping is a separate judgement on a separate day; making that
call inside a rebase is how a push turns into an incident. If something looks like it does not
belong, **note it and finish the push** — do not remove it.

---

# 🔴 STEP 0 — CLEAR THE GIT LOCKS. NOTHING ELSE WORKS UNTIL THIS RUNS.

The cloud session that made `6cadc1d` could not unlink its own lock files — the documented sandbox
limitation. **Four locks are on disk and every index-dependent git command is dead:**

```
.git/index.lock   .git/HEAD.lock   .git/index.s2.lock   .git/objects/maintenance.lock
```

Measured, not assumed: `git status` → **exit 128**. `git add` → **exit 128**. `git log`, `git show`,
`git cat-file` → exit 0 (object reads don't need the index).

**🔴 Confirm no process HOLDS the locks. A lock held by a running operation is real, and deleting
it corrupts that operation. (v4.1: the `pgrep -fl git` test is RETIRED — it matches the executor's
own IDE helpers, `gitWorker.js`, and background daemons that never touch these locks, so it can
never pass when Cursor is the operator. Test the locks themselves.)**

```bash
cd ~/Desktop/mental-models-observatory
lsof .git/index.lock .git/HEAD.lock .git/index.s2.lock .git/objects/maintenance.lock 2>/dev/null
# Read the output. EXEMPT and safe to proceed past: com.apple.* system daemons
# (mds, mdworker*, fseventsd — Spotlight/metadata indexers) with read-mode handles;
# they scan every file on the Mac and do not own git locks. Git locks bind by the
# file's EXISTENCE, not by open handles; deleting under a reader is safe.
# REAL holder = any git-family process, or any process with the lock open for
# write (FD column ends in w or u) → STOP and report the full lsof line verbatim.
find .git -name "*.lock" -delete
git status --porcelain | head        # must now exit 0
```

If `git status` still exits 128 after the delete, stop and report. Do not force anything.

**Standing note for the whole push:** the IDE's background git integration can transiently create
`index.lock` between commands. If any git command fails on an existing `index.lock`: run `lsof`
on it; if unheld, delete it and retry that command ONCE. A second failure → stop and report.

**Why last night still worked:** the nightly chain does no local git, and `publish-brief.py` only
runs `git cat-file` and `git fetch` locally (object/ref level, index-free) while its add/commit/push
happen inside a temp clone. The locks blocked humans, not the pipeline.

---

# STEP 1 — HYGIENE (one commit, `chore:`)

## 1a0 — PARITY FILES FIRST (v4.3). All three, before any gate runs.

**Why first:** `tsc`, `eslint` and `prettier` scan the DISK. Untracking a directory removes it from
git, not from disk, so every "must be clean" gate below fails until these three files exist. CI runs
on a fresh checkout where the scratch dirs are absent — these files make local mean what CI means.

**Current index state is correct — keep it.** The `_to_delete/` untracking and `.gitignore` edit
already staged from the earlier attempt belong to this same chore commit.

**(1) `tsconfig.json` — replace the `exclude` array (currently `node_modules, scripts, zz_Old`) with:**

```json
  "exclude": [
    "node_modules",
    "scripts",
    "zz_Old",
    "_to_delete",
    "_to_delete2",
    ".worktrees",
    ".next-old",
    ".readback"
  ]
```

**(2) `eslint.config.mjs` — extend the `ignores` array (after `"test-*.html",`) with:**

```js
      "_to_delete/**",
      "_to_delete2/**",
      ".worktrees/**",
      ".next-old/**",
      ".readback/**",
      "*.bak-*",
```

**(3) Create `.prettierignore` (does not exist) with exactly:**

```
node_modules/
.next/
.next-old/
out/
build/
_to_delete/
_to_delete2/
.worktrees/
.readback/
zz_Old/
*.bak-*
```

All three are correct to have permanently, not just for this push. They join the chore commit.

## 1a. Untrack `_to_delete/` — **86 tracked files**

This is what has been reddening `npm run type-check` independently of last night's work:
`_to_delete/session-2026-08-06/craft-new.ts(28,59): error TS2307`. CI runs bare `tsc --noEmit`, so
**CI is red the moment anything is pushed** unless this is fixed first.

```bash
git rm -r --cached _to_delete
echo "_to_delete/" >> .gitignore
npm run type-check        # MUST be clean — passes now because 1a0's tsconfig exclude covers the on-disk scratch dirs
```

## 1b. Drop the worktree gitlinks **and prune the registrations**

Committed as mode `160000` with no `.gitmodules`. **Actively fatal today** — `git status` emits
`fatal: not a git repository: .../.git/worktrees/land-substack-workflow`.

🔴 **`rm --cached` alone does not fix this.** The fatal comes from broken registrations inside
`.git/worktrees/`, which the index knows nothing about. Prune, then re-check.

```bash
git rm --cached .worktrees/land-substack-workflow .worktrees/weekly-publish-fix
grep -q "^\.worktrees/" .gitignore || echo ".worktrees/" >> .gitignore

git worktree prune -v         # clears the broken registrations in .git/worktrees/
git worktree list             # should list only the main working tree

git status 2>&1 | grep -i fatal && echo "🔴 STILL FATAL — stop and report" || echo "✅ no fatal"
```

## 1c. Clear the noise — **named files only, never a blind pipe**

🔴 **The sacred rule outranks tidiness. Anything under `content/daily-updates/` stays tracked, full
stop.** List before you remove; never pipe `git ls-files` into `git rm`.

**The five tracked `.bak` files, verified — none is under `content/daily-updates/`:**

```
BODY_brief-light_REPLACEMENT.md.bak-20260807-1949
BODY_brief-light_REPLACEMENT.md.bak-rb2-20260807-1938
lib/audio/light-generate.ts.bak-readback-20260807-1932
scripts/brief-light-craft-gate.ts.bak-rb2-20260807-1938
scripts/brief-light-format-gate.ts.bak-readback-20260807-1929
```

**Re-verify that list yourself before removing** — it was taken at handoff time and the evening run
may have added more:

```bash
git ls-files | grep '\.bak-'                                  # READ IT
git ls-files | grep '\.bak-' | grep '^content/daily-updates/' # MUST be empty
```

Then remove **by name**, one line each — no `xargs`, no globbing into `git rm`:

```bash
git rm --cached BODY_brief-light_REPLACEMENT.md.bak-20260807-1949
git rm --cached BODY_brief-light_REPLACEMENT.md.bak-rb2-20260807-1938
git rm --cached lib/audio/light-generate.ts.bak-readback-20260807-1932
git rm --cached scripts/brief-light-craft-gate.ts.bak-rb2-20260807-1938
git rm --cached scripts/brief-light-format-gate.ts.bak-readback-20260807-1929
git rm --cached .gittest_5
grep -q "^\*\.bak-\*" .gitignore || echo "*.bak-*" >> .gitignore
```

## 1d. Prettier on the five touched files — **then hold the hash**

Deferred deliberately last night; reformatting verified-working code hours before a live run was the
wrong trade. It is the right trade now. CI runs `prettier --check .`, which **currently fails on all
five**.

```bash
npx prettier --write \
  scripts/transmission-readback.ts \
  scripts/brief-light-craft-gate.ts \
  scripts/brief-light-format-gate.ts \
  lib/audio/light-generate.ts \
  lib/audio/text-preprocessor.ts
```

### 1d-SCOPE (v4.4) — the enforcement ruling

- **ENFORCEMENT SCOPE** (formatted and checked): `app/ components/ lib/ src/ hooks/ types/ scripts/`
- **EVERYTHING ELSE is legacy, generated, or content — never format-enforced.** Extend
  `.prettierignore` (and the eslint `ignores` for anything containing js/ts) with: `content/`,
  `daily-briefs/`, `daily-intelligence/`, `docs/`, `blog/`, `examples/`, `data/`, `public/`,
  `marketing-content/`, `tweets/`, `tweet-queue/`, `.backup-before-merge/`, `.tmp-verify/`,
  `ui-staging/`, `tsx-501/`, `zz_Old/`, `*.md`, `temp-*.json`, `daily-update-*.jsx`, `mockup-*`,
  `test-*`, `reptest.mjs`, `_tmp_*`. (`temp-models.json` is malformed JSON — ignore it, note it
  for a cleanup day, do not repair it mid-push.)
- **AUTHORIZATION:** you may add ignore entries for ANY failing path OUTSIDE the enforcement scope
  without stopping. You may NOT ignore anything INSIDE the scope: inside-scope prettier failures
  get `npx prettier --write <file>`; inside-scope LINT errors are a STOP with the file list.
- Then run `npx prettier --write app components lib src hooks types scripts` followed by
  `npx prettier --check .` — **MUST pass.**
- The selftest/hash/gate re-verification below applies after ANY write that touches `scripts/`.
```bash
# (verification block below unchanged)
```

🔴 **Then re-verify behaviour. Prettier can reflow a regex or a template literal, and the read-back
loop runs on these tonight:**

```bash
node --experimental-strip-types scripts/transmission-readback.ts --selftest
```

**Three things must be true:** `15/15 passed`, `SCRIPT-OK`, and —

### 🔴 `TEMPLATE_HASH 8362e5b17930dd37`

**If that hash changed, STOP. Do not commit, do not push, do not "fix the formatting back."** The
Reader prompt is a frozen template; a changed hash means the prompt changed, and a changed prompt is
a **recalibration event** under `WORK_ORDER_READBACK.md` Part 5 — the calibration table, the owner's
34 labels, and the 80% baseline were all measured against `8362e5b17930dd37`. Prettier touching a
template literal is exactly how that happens silently. Report it and hand back.

Then the gates:

```bash
node --experimental-strip-types scripts/brief-light-format-gate.ts daily-briefs/2026-08-08-light.md   # exit 0
node --experimental-strip-types scripts/brief-light-craft-gate.ts daily-briefs/2026-08-08-light.md daily-briefs/2026-08-08-v2.md  # exit 0
```

## 1e. Untrack `_to_delete2/` — **8 files, missed in v1 of this handoff**

Not in the original hygiene list. Surfaced by the file-count audit. Includes lock-file debris and
**`_to_delete2/2026-08-07-light.md`, a scratch copy of a light brief.**

🔴 **It is a copy at `_to_delete2/`, not the published file — the sacred rule protects
`content/daily-updates/`, and nothing there is being touched. Confirm the path before removing.**

```bash
git ls-files _to_delete2          # READ IT — confirm nothing is under content/
git rm -r --cached _to_delete2
echo "_to_delete2/" >> .gitignore
```

**Commit 1a–1e together:**
`chore: local/CI parity files; untrack _to_delete + _to_delete2; prune worktree gitlinks; bak noise; prettier pass`

---

# STEP 2 — THE THREE DEPLOYED-CODE ITEMS

## 2a. Epigraph / render order — **not yet built. Cursor writes this.**

Both viewers render `date → product label → dailyTitle → epigraph → lede`. The markdown and the audio
already put the epigraph **first**. The web is the only surface that does not.

**Move the `brief.epigraph` block above the `brief.dailyTitle` block in both files:**

| file | dailyTitle block | epigraph block |
|---|---:|---:|
| `components/super-brief/SuperBriefViewer.tsx` | line **328** | line **333** |
| `components/daily-update/BriefViewer.tsx` | line **1386** | line **1392** |

Swap the two JSX blocks in each. Nothing else — same classNames, same conditionals.

**Then remove the reason this recurs.** Four surfaces render this brief and each chose its own order
independently, so fixing one is not fixing it. Create `lib/brief-render-order.ts` exporting a single
ordering constant; have both viewers consume it. `lib/email/render-brief.ts` (`renderEpigraph`, lines
65/121) is the third consumer and already leads with the epigraph — it should read the same constant
rather than agreeing by accident.

## 2b. `lib/audio/light-generate.ts` — revert the local-write, persist the script URL

The local-write shipped in `6926ae5` on a wrong assumption: **audio generation runs on Vercel, not
locally.** Only `app/api/audio/light/generate/route.ts` and `lib/publish/weekly-complete.ts` call
`generateLightAudio`; no local script does. On Vercel the filesystem is read-only outside `/tmp`, so
`mkdirSync` throws, the `try/catch` swallows it, and nothing is written. Harmless, and dead.

1. **Revert** the `// 2026-08-07 read-back prerequisite` block (the `daily-briefs/audio-scripts/`
   write) added in `6926ae5`.
2. **Replace it** with persistence of the *script* blob URL. The script's `put()` already returns a
   `blob.url` that is discarded; only the *audio* blob's URL is kept (`audioUrl`, ~line 225). Store
   the script URL alongside it — same shape, same store.

**Try the shortcut first, per the owner's ruling.** The script path is deterministic
(`audio/brief-light-{date}.txt`, `addRandomSuffix: false`), so with the blob **store hostname** the
URL can be constructed with no code change at all. The hostname is not in the repo and two fetches of
the public feed returned binary, so it needs **one observed URL** — the next successful audio run
yields it. **Do not treat 2b as a prerequisite for the dual read-back until construction has been
tried and failed.**

## 2c. `lib/audio/text-preprocessor.ts` — already committed in `6cadc1d`

No work. Verify it survives the prettier pass.

**Commit 2a (+2b if built):** `feat(viewer): epigraph leads the hero; single render-order constant`

---

# 🔴 STEP 2.5 — THE FULL LOCAL CI MIRROR. ALL FOUR GREEN BEFORE ANY PUSH.

```bash
npm run type-check && npm run lint && npx prettier --check . && npm run build
```

**Nothing is pushed until all four pass on the Mac.** `lint` and `build` have never been verified
locally in this work, and **`build` is the first real test of the 2a viewer code** — a JSX block swap
either compiles or it does not, and it must fail here rather than in public.

## 🔴 Read this before you run it — the mirror will fail for a reason that is not your code

**Untracking a directory does not delete it.** After step 1, `_to_delete/` (86 files) and
`_to_delete2/` (8) are gone from the index but **still on disk**, and:

- **`eslint.config.mjs` ignores `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`,
  `scripts/**`, `temp-*.json`, `test-*.html` — and nothing else.** It does **not** ignore
  `_to_delete/`, `_to_delete2/`, `.worktrees/`, `.next-old/`, or `.readback/`. Lint walks all of them.
  (`scripts/**` being ignored is why `transmission-readback.ts` and the gates are not linted — that is
  correct and expected, not a gap.)
- **There is no `.prettierignore` at all.** `prettier --check .` walks the entire tree including every
  scratch directory.

**So the local mirror can go red on files CI will never see** — CI runs on a fresh checkout where the
untracked directories do not exist. Local failing while CI would pass is the worst possible signal at
push time: it looks like a break and it is not.

**The parity files were created in Steps 1a0 + 1d-SCOPE — verify they exist; do NOT duplicate. The 1d-SCOPE authorization applies to lint here too: failing paths OUTSIDE the enforcement scope may be added to the eslint ignores without stopping; lint errors INSIDE app/components/lib/src/hooks/types are a stop with the file list.**

**Then run the mirror. If `build` fails, the failure is 2a — fix it here.** If `lint` or
`prettier --check` fails on a path you did not touch and did not just ignore, stop and report rather
than widening the ignore list to make red go green.

---

# STEP 3 — PUSH, PER THE HOUSE PROTOCOL

`git-push-protocol.md`, full sequence, all steps, in order. **Never a partial sequence.**

```bash
find .git -name "*.lock" -delete
git fetch origin
git stash
scripts/repo-hygiene.sh
git pull --rebase
git stash pop
git add <the specific files from steps 1 and 2>     # 🔴 never `git add .`
git commit -m "<conventional message>"
git pull --rebase && git push
```

🔴 **Sacred rule:** never delete tracked brief files; never commit deletions under
`content/daily-updates/`. `publish.py` commits briefs on the remote via API — the two histories are
intentionally separate. If the rebase conflicts on brief files, sync **from** remote:
`git restore --source=origin/main content/daily-updates/`.

**Verified at handoff: this push contains ZERO deletions under `content/daily-updates/`.** The four
`content/` entries are three additions (`2026-07-29-editor-log.md`, `2026-W28`/`2026-W31`
factcheck JSONs) and one modification (`2026-W27-factcheck.json`). **If a `D` appears under
`content/daily-updates/` at any point, stop — something went wrong in the rebase.**

**Expect a non-trivial rebase:** origin is 7 commits behind local, and the morning publish will have
pushed `2026-08-08` brief content via the API in between.

---

# STEP 4 — CI AND DEPLOY VERIFICATION

CI (`ci.yml`) runs on push: `npm ci` → `type-check` → `lint` → `format:check` → `build`.

1. **All five green.** `type-check` and `format:check` are the two that were failing before step 1 —
   if either is red, step 1 did not take.
2. **Vercel deploys on push.** Confirm production succeeded on the **custom domain**, not just
   `*.vercel.app`.
3. **Deployment Protection stays `Preview only`** (`REPO_WORKFLOW.md`, Jul 10 2026). If it flips to
   protecting production, the Vercel cron and GHA publish-complete both break — **401 from our own
   auth is fine; 302 is fatal.**
4. **Viewer fix live:** open `/super-brief` and `/daily-update`, confirm the epigraph renders above
   the daily title.
5. **Audio still generates** — 2b touches that path. Confirm the next episode appears in the feed
   with a playable URL.
6. **Report the script blob URL** from that run. That single URL unblocks the dual read-back.

---

# STEP 5 — REPORT, THEN HAND BACK

Post to the working session: pushed SHA · CI result per job · deploy URL · viewer fix visible y/n ·
audio generated y/n · script blob URL if observed · **`TEMPLATE_HASH` after the prettier pass** ·
**the four local CI results from step 2.5** ·
anything you noted but deliberately did not clean up.

🔴 **On your report, tree ownership returns to the working session.** It has same-day `scripts/`
work queued behind you — per-section mode for `transmission-readback.ts`, then two live task bodies
written to repo root before the 17:45 chain. **After you report, Cursor touches nothing.** If
something still looks wrong, say so in the report; do not go back in and fix it.

**The working session does not touch the tree before that report.**

---

# NOT IN THIS PUSH

- **`system/`** — gitignored, local-only, by design.
- **The live task body** (`~/Documents/Claude/Scheduled/brief-light/SKILL.md`) — outside the repo,
  already placed and SHA-verified. Not Cursor's to touch.
- **`.readback/`** — gitignored working dir: prompts, raw read-backs, grades, diffs.
- **`system/readback-ledger.json`** — under gitignored `system/`. Whether it should be tracked is a
  separate decision, not this push.
- **The full-brief read-back loop** — out of *push* scope, but **not out of the day.** The working
  session builds it in `system/` while you push (gitignored, zero overlap), and takes `scripts/` up
  the moment you hand the tree back. Do not touch `scripts/transmission-readback.ts`.
- **The weekly wiring** (`Weekly_Light_Generator.md`, `BODY_weekly_REPLACEMENT.md`) — same: `system/`
  and repo-root docs, same day, not yours.
- **Element rubric, May-era re-measure** — later work, not deployed code.

---

# THE FIVE THAT STOP EVERYTHING

1. A git-family process or write-mode holder on any `.git` lock → **wait, don't delete locks.** (com.apple.* read-only indexers are exempt.)
2. `git status` still exits 128 after the delete → **stop and report.**
3. `TEMPLATE_HASH ≠ 8362e5b17930dd37` after prettier → **stop. Recalibration event, not formatting.**
4. A `D` under `content/daily-updates/` at any point → **stop. Sacred rule.**
5. Any of the four local CI checks red after the ignore fix → **stop. Do not push red.**

Everything else: note it, finish the push, hand back.
