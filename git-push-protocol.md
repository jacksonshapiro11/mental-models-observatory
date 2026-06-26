## Git Push (Safe Push Protocol)

Scheduled tasks run in isolated cloud sessions and frequently leave stale lock files and push commits that the local copy doesn't have. This causes `git push` to fail. When Jackson asks to push, commit, or deploy code — or hits any git lock/rejected error — always give him the full sequence below. Never give partial commands — every step exists because a previous failure taught us it's needed.

### The Full Sequence (always all steps, always this order)

```bash
# 1. Kill ALL lock files at any depth (not just index.lock — HEAD.lock, refs locks, etc.)
find .git -name "*.lock" -delete

# 2. Delete local copies of content files the scheduled tasks already pushed to remote.
#    These cause "untracked working tree files would be overwritten" errors during rebase.
#    Check which ones conflict and remove them:
git stash
git pull --rebase 2>&1 | grep "content/daily-updates/" | xargs rm -f
#    If the pull succeeded, skip to step 5. If it failed with the untracked files error,
#    the rm above cleaned them — now retry:
git pull --rebase

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
git stash
rm -f content/daily-updates/202*.md
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
scripts/repo-hygiene.sh   # removes duplicates that match origin/main
```

See `REPO_WORKFLOW.md` for the full dual-path explanation.

### Why each step exists

- **`find .git -name "*.lock" -delete`** — Scheduled tasks leave lock files at unpredictable depths (`.git/index.lock`, `.git/HEAD.lock`, `.git/refs/heads/main.lock`). The `rm -f .git/*.lock` approach misses nested locks, and zsh glob errors when `refs/heads/*.lock` has no matches. `find` handles all cases silently.
- **`git stash`** — `data/daily-signal.json` and other tracked files get modified locally. `git pull --rebase` refuses to run with unstaged changes. Stashing them first unblocks the rebase.
- **`rm -f content/daily-updates/202*.md`** — Scheduled tasks push daily brief files to remote. If Jackson also has local copies (from running tasks or previous sessions), `git pull --rebase` fails with "untracked working tree files would be overwritten by checkout." Deleting the local copies is safe — the remote already has them.
- **`git stash pop`** — Restores the stashed changes so they're available for commit or continued work.
- **`git pull --rebase`** (not `git pull`) — Plain `git pull` creates merge commits. Rebase replays Jackson's commits on top of the remote changes for clean linear history.
- **Never `git add .` or `git add -A`** — The `system/` directory contains internal editorial files that must never be committed.

### Common errors and what causes them

| Error | Root cause | Fix |
|---|---|---|
| `Unable to create '.git/index.lock': File exists` | Scheduled task crashed mid-operation | `find .git -name "*.lock" -delete` |
| `Unable to create '.git/HEAD.lock': File exists` | Same — but nested lock file | Same `find` command |
| `cannot pull with rebase: You have unstaged changes` | `data/daily-signal.json` or other tracked file modified locally | `git stash` before pull, `git stash pop` after |
| `untracked working tree files would be overwritten by checkout` | Local content files duplicate what remote already has | `rm -f content/daily-updates/202*.md` then retry pull |
| `rejected: non-fast-forward` / `remote contains work` | Scheduled tasks pushed commits Jackson doesn't have | `git pull --rebase` before push |
| `zsh: no matches found: .git/refs/heads/*.lock` | zsh strict glob — no lock files at that path | Use `find` instead of glob patterns |
