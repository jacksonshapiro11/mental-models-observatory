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
