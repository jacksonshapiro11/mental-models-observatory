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

After a successful push this script polls
    GET {SITE_URL}/api/publish/health?weekly={slug}
until lightBrief is on the deployed filesystem, then POSTs
    /api/publish/complete?weekly={slug}
(mirrors the daily publisher — W28 2026-07-12 shipped content with no audio
because this step only printed "Next: trigger…" and never fired).

Usage:
    python scripts/publish-weekly.py 2026-W27            # publish both files for the week
    python scripts/publish-weekly.py 2026-W27 --dry-run  # validate + preview, no push
    python scripts/publish-weekly.py 2026-W27 --file content/daily-updates/weekly/2026-W27-light.md

Requires GITHUB_TOKEN (falls back to .env.local at repo root, like publish.py).
Pipeline trigger needs SNAPSHOT_SECRET (or relies on complete-weekly cron / GHA).
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import shutil
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

REPO = "jacksonshapiro11/mental-models-observatory"
BRANCH_MAIN = "main"
WEEKLY_DIR = "content/daily-updates/weekly"
SITE_URL = os.environ.get("SITE_URL", "https://www.cosmictrex.com")

PUBLISH_HEALTH_TIMEOUT = 360
PUBLISH_HEALTH_POLL_INTERVAL = 10
PUBLISH_HEALTH_INITIAL_DELAY = 15

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


def wait_for_deployed_weekly(slug, timeout=None, interval=None):
    """Poll GET /api/publish/health?weekly= until lightBrief is on the live site."""
    timeout = timeout if timeout is not None else PUBLISH_HEALTH_TIMEOUT
    interval = interval if interval is not None else PUBLISH_HEALTH_POLL_INTERVAL
    health_url = f"{SITE_URL}/api/publish/health?weekly={slug}"
    deadline = time.time() + timeout
    attempt = 0

    if PUBLISH_HEALTH_INITIAL_DELAY > 0:
        print(f"Waiting {PUBLISH_HEALTH_INITIAL_DELAY}s for Vercel deploy to start...")
        time.sleep(PUBLISH_HEALTH_INITIAL_DELAY)

    print(f"Polling {health_url} until lightBrief=true (timeout {timeout}s)...")
    while time.time() < deadline:
        attempt += 1
        body = None
        try:
            req = Request(health_url, method="GET", headers={"User-Agent": "publish-weekly"})
            with urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            try:
                body = json.loads(e.read().decode("utf-8"))
            except Exception:
                print(f"  health poll #{attempt}: HTTP {e.code} (no JSON) — retrying")
                time.sleep(interval)
                continue
        except Exception as e:
            print(f"  health poll #{attempt}: error ({str(e)[:120]}) — retrying")
            time.sleep(interval)
            continue

        light = bool(body.get("lightBrief"))
        full = bool(body.get("fullBrief"))
        print(f"  health poll #{attempt}: fullBrief={full} lightBrief={light}")
        if light:
            return True
        time.sleep(interval)

    print(
        f"ALERT: Deploy health timeout after {timeout}s — weekly lightBrief still false for {slug}. "
        f"NOT calling complete (would skip). Failsafe: complete-weekly cron + GHA."
    )
    return False


def trigger_weekly_complete(slug):
    """Wait until Weekly Light is on the deployed site, then POST complete?weekly=."""
    load_env_file()
    secret = os.environ.get("SNAPSHOT_SECRET") or os.environ.get("CRON_SECRET")
    if not secret:
        print("Note: SNAPSHOT_SECRET/CRON_SECRET not set — skipping weekly pipeline trigger.")
        print(f"Manual recovery:\n  curl -X POST \"{SITE_URL}/api/publish/complete?weekly={slug}\" \\\n    -H \"Authorization: Bearer $CRON_SECRET\"")
        print("Failsafe: Vercel cron /api/publish/complete-weekly (15 10 * * * UTC).")
        return

    if not wait_for_deployed_weekly(slug):
        print(
            f"ALERT: publish/complete?weekly= NOT fired for {slug} — deploy never showed lightBrief. "
            "Relying on complete-weekly cron / GHA failsafe."
        )
        return

    url = f"{SITE_URL}/api/publish/complete?secret={secret}&weekly={slug}"
    print(f"Deploy ready — POSTing {SITE_URL}/api/publish/complete?weekly={slug}")
    try:
        req = Request(url, method="POST", headers={"User-Agent": "publish-weekly"})
        with urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            status = resp.status
            if result.get("skipped"):
                print(
                    f"ALERT: Weekly pipeline SKIPPED for {slug}: {result.get('reason', 'unknown')} "
                    f"(HTTP {status}). Failsafe cron will retry."
                )
            elif result.get("success"):
                print(f"Weekly publish pipeline complete for {slug}!")
                full = result.get("fullAudio", {})
                light = result.get("lightAudio", {})
                dist = result.get("distribute", {})
                print(f"  Full podcast: {full.get('status', 'n/a')}")
                print(f"  Weekly light audio: {light.get('status', 'n/a')}")
                if dist.get("email"):
                    print(f"  Email: {dist['email'].get('details', dist['email'].get('success'))}")
            else:
                print(f"Weekly pipeline partial/failed (HTTP {status}): {json.dumps(result, indent=2)[:500]}")
                print("Failsafe complete-weekly cron will retry missing steps.")
    except HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")[:500]
        except Exception:
            pass
        if e.code == 409 or '"skipped":true' in body.replace(" ", "").lower():
            print(f"ALERT: Weekly pipeline SKIPPED (HTTP {e.code}) for {slug}: {body}")
        else:
            print(f"Weekly pipeline trigger failed (HTTP {e.code}): {body or e}")
        print("Failsafe complete-weekly cron will retry.")
    except Exception as e:
        print(f"Weekly pipeline trigger failed: {e}")
        print("Failsafe complete-weekly cron will retry.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="Week id, e.g. 2026-W27")
    ap.add_argument("--file", help="Publish one explicit file instead of resolving both")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-pipeline", action="store_true", help="Push only; do not trigger audio/email")
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
    if not args.dry_run and not args.skip_pipeline and not os.environ.get("SKIP_PIPELINE"):
        trigger_weekly_complete(args.slug)
    elif not args.dry_run:
        print(f"\nSkipped pipeline. Manual:\n  curl -X POST \"{SITE_URL}/api/publish/complete?weekly={args.slug}\" \\\n    -H \"Authorization: Bearer $CRON_SECRET\"")


if __name__ == "__main__":
    main()
