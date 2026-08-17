## Git Push (Safe Push Protocol)

Scheduled tasks run in isolated cloud sessions and frequently leave stale lock files and push commits that the local copy doesn't have. This causes `git push` to fail. When Jackson asks to push, commit, or deploy code — or hits any git lock/rejected error — always give him the full sequence below. Never give partial commands — every step exists because a previous failure taught us it's needed.

### Sacred rule: past briefs are never deleted

- **Never delete tracked brief files.** Never run `rm` on `content/daily-updates/*.md`.
- **Never commit deletions** of `content/daily-updates/*.md` unless you are intentionally unpublishing a specific brief (almost never).
- Scheduled tasks push briefs via API; local copies are often **untracked duplicates**. Use `scripts/repo-hygiene.sh` to remove only those — it never touches tracked files.
- If rebase conflicts on brief files, sync **from** remote — do not delete:
  ```bash
  git checkout --theirs content/daily-updates/
  # or
  git restore --source=origin/main content/daily-updates/
  ```

### The Full Sequence (always all steps, always this order)

```bash
# 1. Kill ALL lock files at any depth (not just index.lock — HEAD.lock, refs locks, etc.)
find .git -name "*.lock" -delete

# 2. Fetch remote and remove only untracked duplicate briefs (never tracked files).
#    These cause "untracked working tree files would be overwritten" errors during rebase.
git fetch origin
git stash
scripts/repo-hygiene.sh
git pull --rebase
#    If pull still fails on untracked briefs, run repo-hygiene.sh again after fetch, then retry.

# 3. Pop the stash to restore unstaged changes (like data/daily-signal.json)
git stash pop

# 4. Stage and commit only the specific files Jackson wants to push
git add <specific-files>
git commit -m "<message>"

# 5. Pull again (in case new commits arrived) and push
git pull --rebase && git push
```

### Simplified version (paste-ready for Jackson)

When giving Jackson commands, collapse it to this:

```bash
find .git -name "*.lock" -delete
git fetch origin
git stash
scripts/repo-hygiene.sh
git pull --rebase
git stash pop
git add <specific-files>
git commit -m "<message>"
git push
```

### After API publish (`publish.py`)

Scheduled tasks push briefs via the GitHub REST API — **not** your local clone. That leaves untracked copies under `content/daily-updates/` and causes rebase conflicts. After a morning publish (or anytime `git status` shows dozens of untracked briefs):

```bash
git fetch origin
scripts/repo-hygiene.sh   # removes untracked duplicates that match origin/main
git pull --rebase origin main
```

See `REPO_WORKFLOW.md` for the full dual-path explanation.

### 🔴 E1 — WHERE A STALE LOCK MAY GO (owner rule 2026-08-16)

`rm` is refused inside a Cowork-mounted working folder, so a cloud session cannot run step 1 as
written. **`mv` is permitted, and moving a lock aside is equivalent to deleting it** — but the
destination is not free:

**A stale lock moves ONLY to a destination OUTSIDE `.git` — `/tmp/` or `_to_delete/`. Nothing is ever
renamed or parked INSIDE `.git`.**

**Receipt:** git's own fallback does exactly the forbidden thing. When it cannot unlink
`.git/refs/heads/main.lock` it renames it to `main.lock.stale-<nanoseconds>` **in place**, and
`refs/heads/` is a directory where every filename is parsed as a ref. The junk refs accumulate, `git
gc` and `git repack` abort on `bad object refs/heads/main.lock.stale-…`, and fetch stays broken until
someone cleans it out by hand — **312 files, two days.**

So: if you must move a lock, move it out of the repository's `.git` entirely, and check afterwards
that `git rev-parse refs/heads/main` still resolves and `ls .git/refs/heads` holds only real branch
names.

🔴 **BEFORE YOU DELETE A JUNK REF, CHECK WHAT IT POINTS AT.** A renamed `refs/heads/main.lock` holds
the value main was *about to* be set to, so a junk ref can be the ONLY thing keeping a real commit
reachable. Run this first, every time:

```bash
git merge-base --is-ancestor <sha> HEAD && echo "safe to delete" || echo "STOP — unreachable work"
git branch recovered-<sha> <sha>      # if unreachable: give it a real ref BEFORE deleting anything
```

**Receipt, 2026-08-16:** `refs/heads/main.lock.stale-1786188190657235913` pointed at `2812706` —
*gates: IMP-141/142/143/144, the 2026-08-08 Critic mandates*, **768 insertions across four gate
scripts, not in main's history and not reproduced anywhere else.** Eight days of it existing only
because a lock file got renamed into `refs/heads/`. A successful `git gc --prune` would have
destroyed it.

### 🔴 D — THE SCRATCH-INDEX COMMIT HELPER: RESET OUTSIDE THE EXPORTED INDEX

A cloud session commits against a COPY of the index (`GIT_INDEX_FILE=$HOME/.idx-$$`) because the
mount refuses the lock unlinks git needs. **The bug was never the copy. It was leaving the variable
exported afterwards.**

```bash
#  WRONG — and it produced a false "1,045 staged deletions" alarm twice
export GIT_INDEX_FILE="$IDX"
git add <files>; git commit ...
git reset -q            # ← still on the SCRATCH index; the real one stays stale
rm -f "$IDX"            # ← now the exported path does not exist: git reads an EMPTY index
git diff --cached ...   # ← every tracked file reads as DELETED. Nothing is wrong. Everything looks wrong.

#  RIGHT
export GIT_INDEX_FILE="$IDX"
git add <files>
git diff --cached --name-status | grep -c '^D'   # hard gate: any D aborts
git commit -F - <<'MSG' … MSG
unset GIT_INDEX_FILE; rm -f "$IDX"   # ← unset FIRST, and only then
git reset -q                          # ← refreshes the REAL index against the new HEAD
```

**Two occurrences, both false alarms, both costing a full verification round to disprove.** The
lesson generalises past git: **a verification command that inherits the environment of the operation
it is verifying is not an independent check.**

### Why each step exists

- **`find .git -name "*.lock" -delete`** — Scheduled tasks leave lock files at unpredictable depths (`.git/index.lock`, `.git/HEAD.lock`, `.git/refs/heads/main.lock`). The `rm -f .git/*.lock` approach misses nested locks, and zsh glob errors when `refs/heads/*.lock` has no matches. `find` handles all cases silently.
- **`git fetch origin`** — Hygiene script compares local files to `origin/main`. Without fetch, it may skip duplicates or leave stale copies.
- **`git stash`** — `data/daily-signal.json` and other tracked files get modified locally. `git pull --rebase` refuses to run with unstaged changes. Stashing them first unblocks the rebase.
- **`scripts/repo-hygiene.sh`** — Removes **only untracked** local brief copies that are byte-identical to `origin/main`. Never deletes tracked files. Never bulk-deletes by glob.
- **`git stash pop`** — Restores the stashed changes so they're available for commit or continued work.
- **`git pull --rebase`** (not `git pull`) — Plain `git pull` creates merge commits. Rebase replays Jackson's commits on top of the remote changes for clean linear history.
- **Never `git add .` or `git add -A`** — The `system/` directory contains internal editorial files that must never be committed.

### Common errors and what causes them

| Error | Root cause | Fix |
|---|---|---|
| `Unable to create '.git/index.lock': File exists` | Scheduled task crashed mid-operation | `find .git -name "*.lock" -delete` |
| `Unable to create '.git/HEAD.lock': File exists` | Same — but nested lock file | Same `find` command |
| `cannot pull with rebase: You have unstaged changes` | `data/daily-signal.json` or other tracked file modified locally | `git stash` before pull, `git stash pop` after |
| `untracked working tree files would be overwritten by checkout` | Local untracked briefs duplicate what remote already has | `git fetch origin && scripts/repo-hygiene.sh` then retry pull — **never** `rm content/daily-updates/*.md` |
| `rebase conflict` on `content/daily-updates/` | Local and remote brief versions diverged | `git checkout --theirs content/daily-updates/` or `git restore --source=origin/main content/daily-updates/` — sync from remote, do not delete |
| `rejected: non-fast-forward` / `remote contains work` | Scheduled tasks pushed commits Jackson doesn't have | `git pull --rebase` before push |
| `zsh: no matches found: .git/refs/heads/*.lock` | zsh strict glob — no lock files at that path | Use `find` instead of glob patterns |
