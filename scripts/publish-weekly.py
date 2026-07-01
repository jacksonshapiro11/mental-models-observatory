#!/usr/bin/env python3
"""
Publish THE WEEKLY (full + light) to GitHub. Vercel auto-deploys on push.

The Weekly is slug-addressed (e.g. 2026-W27), lives under
content/daily-updates/weekly/, and ships as two files:
    {slug}-{mon-dd-dd}.md   (full weekly)
    {slug}-light.md         (weekly light / super brief)

This is a focused sibling of .claude/skills/publish-brief/scripts/publish.py.
It exists because that publisher is date-addressed (content/daily-updates/{date}.md)
and the interactive agent cannot edit files under .claude/. Same robust transport:
clone to /tmp, commit, push (avoids the repo's stale .git/index.lock).

Usage:
    python scripts/publish-weekly.py 2026-W27            # publish both files for the week
    python scripts/publish-weekly.py 2026-W27 --dry-run  # validate + preview, no push
    python scripts/publish-weekly.py 2026-W27 --file content/daily-updates/weekly/2026-W27-light.md

Requires GITHUB_TOKEN (falls back to .env.local at repo root, like publish.py).
After a successful publish, trigger audio + email:
    POST {SITE_URL}/api/publish/complete?weekly=2026-W27
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
import shutil

REPO = "jacksonshapiro11/mental-models-observatory"
BRANCH_MAIN = "main"
WEEKLY_DIR = "content/daily-updates/weekly"

# Full weekly masthead is "# MARKETS, MEDITATIONS & MENTAL MODELS: THE WEEKLY";
# the base string below is a substring of it, so this matches.
REQUIRED_FULL = ["# MARKETS, MEDITATIONS & MENTAL MODELS", "# ▸ THE SIX", "# ▸ THE TAKE", "# ▸ THE PREDICTIONS", "# ▸ INNER GAME"]
REQUIRED_LIGHT = ["# WEEKLY LIGHT", "## ▸ THE UPDATE", "## ▸ OUR CALLS"]
MIN_FULL_SIZE = 2000
MIN_LIGHT_SIZE = 500


def repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def load_env_file():
    env_path = os.path.join(repo_root(), ".env.local")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k = k.strip(); v = v.strip().strip('"').strip("'")
                    if k and v and k not in os.environ:
                        os.environ[k] = v


def get_token():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        load_env_file()
        token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: GITHUB_TOKEN not set (checked env and .env.local).")
        sys.exit(1)
    return token


def resolve_files(slug, explicit_file=None):
    """Return the list of repo-relative weekly files to publish for a slug."""
    weekly_abs = os.path.join(repo_root(), WEEKLY_DIR)
    if explicit_file:
        rel = os.path.relpath(os.path.abspath(explicit_file), repo_root())
        return [rel]
    if not os.path.isdir(weekly_abs):
        print(f"ERROR: {WEEKLY_DIR} does not exist.")
        sys.exit(1)
    files = []
    for name in sorted(os.listdir(weekly_abs)):
        if not name.endswith(".md") or not name.startswith(slug):
            continue
        files.append(os.path.join(WEEKLY_DIR, name))
    full = [f for f in files if not f.endswith("-light.md")]
    light = [f for f in files if f.endswith("-light.md")]
    if not full and not light:
        print(f"ERROR: no files found for {slug} in {WEEKLY_DIR}.")
        sys.exit(1)
    return full + light


def validate(rel_path):
    abs_path = os.path.join(repo_root(), rel_path)
    with open(abs_path, "r") as f:
        content = f.read()
    is_light = rel_path.endswith("-light.md")
    required = REQUIRED_LIGHT if is_light else REQUIRED_FULL
    min_size = MIN_LIGHT_SIZE if is_light else MIN_FULL_SIZE
    errors = []
    if len(content) < min_size:
        errors.append(f"too small ({len(content)}B < {min_size}B)")
    for sec in required:
        if sec not in content:
            errors.append(f"missing '{sec}'")
    if "—" in content:
        errors.append("contains an em-dash (—) — banned in output")
    label = "light" if is_light else "full"
    if errors:
        print(f"❌ {rel_path} ({label}): " + "; ".join(errors))
        return False
    print(f"✅ {rel_path} ({label}): {len(content):,}B, sections present, no em-dash")
    return True


def publish_via_git(rel_paths, slug, token, dry_run=False):
    clone_url = f"https://x-access-token:{token}@github.com/{REPO}.git"
    tmp = tempfile.mkdtemp(prefix="mmo-weekly-")
    try:
        print(f"Cloning {BRANCH_MAIN} → {tmp} ...")
        subprocess.run(["git", "clone", "--depth", "1", "--branch", BRANCH_MAIN, clone_url, tmp],
                       check=True, capture_output=True, text=True, timeout=30)
        for rel in rel_paths:
            src = os.path.join(repo_root(), rel)
            dst = os.path.join(tmp, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
        subprocess.run(["git", "config", "user.email", "jacksonshapiro11@gmail.com"], cwd=tmp, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Jackson Shapiro"], cwd=tmp, check=True, capture_output=True)
        for rel in rel_paths:
            subprocess.run(["git", "add", rel], cwd=tmp, check=True, capture_output=True)
        status = subprocess.run(["git", "status", "--porcelain"], cwd=tmp, capture_output=True, text=True)
        if not status.stdout.strip():
            print("No changes to publish (files identical to what's live).")
            return True
        if dry_run:
            print(f"DRY RUN — would commit + push {len(rel_paths)} file(s) for {slug}:")
            for rel in rel_paths:
                print(f"   • {rel}")
            print(status.stdout.strip())
            return True
        subprocess.run(["git", "commit", "-m", f"weekly: {slug}"], cwd=tmp, check=True, capture_output=True, text=True)
        subprocess.run(["git", "push", "origin", BRANCH_MAIN], cwd=tmp, check=True, capture_output=True, text=True, timeout=30)
        print(f"Pushed {len(rel_paths)} file(s) for {slug}. Vercel will deploy → /weekly/{slug} and /weekly-super/{slug}.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"GIT FAILED: {e}\n  stderr: {(e.stderr or '').strip()}")
        return False
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="Week id, e.g. 2026-W27")
    ap.add_argument("--file", help="Publish one explicit file instead of resolving both")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not re.match(r"^\d{4}-W\d{1,2}$", args.slug):
        print(f"ERROR: '{args.slug}' is not a week id (expected e.g. 2026-W27).")
        sys.exit(1)

    files = resolve_files(args.slug, args.file)
    print(f"Weekly publish for {args.slug}: {len(files)} file(s)")
    if not all(validate(f) for f in files):
        print("Aborting — validation failed.")
        sys.exit(1)

    token = get_token()
    ok = publish_via_git(files, args.slug, token, dry_run=args.dry_run)
    if not ok:
        sys.exit(1)
    if not args.dry_run:
        site = os.environ.get("SITE_URL", "https://www.cosmictrex.com")
        print(f"\nNext: trigger audio + email →\n  POST {site}/api/publish/complete?weekly={args.slug}")


if __name__ == "__main__":
    main()
