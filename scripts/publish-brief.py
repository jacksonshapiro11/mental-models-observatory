#!/usr/bin/env python3
"""
Publish a Daily Brief markdown file to GitHub via the REST API.
Vercel auto-deploys on push.

Usage:
    python scripts/publish-brief.py <markdown_file_path>
    python scripts/publish-brief.py <markdown_file_path> --date 2026-02-24
    python scripts/publish-brief.py <markdown_file_path> --dry-run

Requires GITHUB_TOKEN env var with repo scope.
"""

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import threading
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

REPO = "jacksonshapiro11/mental-models-observatory"
BRANCH_MAIN = "main"
BRANCH_DRAFT = "draft"
API_BASE = f"https://api.github.com/repos/{REPO}/contents"

# Post-publish pipeline config
SITE_URL = os.environ.get("SITE_URL", "https://www.cosmictrex.com")
# Poll /api/publish/health until lightBrief is on the deployed filesystem, then
# POST complete. Blind 90s waits raced Vercel deploys (Jul 8 morning: skipped).
PUBLISH_HEALTH_POLL_INTERVAL = 10   # seconds between health checks
PUBLISH_HEALTH_TIMEOUT = 300        # give up after 5 min; failsafe cron retries
PUBLISH_HEALTH_INITIAL_DELAY = 15   # brief pause before first poll (push → deploy start)

# Retry config — tuned to fit inside brief-morning's 45s bash budget.
# Worst case all-fail: 2 attempts × (8s API + 12s git) + 3s backoff = ~43s.
# Success path is unaffected (succeeds in <2s).
MAX_RETRIES = 2

# Set the first time api.github.com fails at the CONNECTION level (see github_request). Once true,
# every later REST call in this process returns ({}, 0) immediately so the git clone fallback gets
# the time budget instead of the timeout loop. IMP-194.
_API_TUNNEL_BLOCKED = False
RETRY_BACKOFF_BASE = 3  # seconds — doubles each attempt (3, 6)

# Pre-publish validation: required sections in full brief
# These use the actual production format: "# ▸ SECTION_NAME"
REQUIRED_SECTIONS_FULL = ["# MARKETS, MEDITATIONS & MENTAL MODELS", "# ▸ THE SIX", "# ▸ THE TAKE", "# ▸ INNER GAME"]
REQUIRED_SECTIONS_LIGHT = ["# BRIEF LIGHT"]
MIN_BRIEF_SIZE = 2000       # full brief should be at least 2KB
MIN_LIGHT_SIZE = 500        # light brief should be at least 500B


def load_env_file():
    """Load variables from .env.local if it exists (fallback for sandboxed environments)."""
    # Walk up from script location to find the repo root with .env.local
    search_dirs = [
        os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'),  # from .claude/skills/publish-brief/scripts/
        os.getcwd(),
    ]
    for base in search_dirs:
        env_path = os.path.join(os.path.abspath(base), '.env.local')
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, _, value = line.partition('=')
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if key and value and key not in os.environ:
                            os.environ[key] = value
            return


def get_token():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        # Try loading from .env.local (Cowork VM doesn't inherit host shell env)
        load_env_file()
        token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: GITHUB_TOKEN environment variable not set.")
        print("Add GITHUB_TOKEN=<your-token> to .env.local in the repo root,")
        print("or set it in your shell environment.")
        print("Create a token at https://github.com/settings/tokens (needs 'repo' scope).")
        sys.exit(1)
    return token


def github_request(url, token, method="GET", data=None):
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "publish-brief-skill",
    }
    if data:
        headers["Content-Type"] = "application/json"

    req = Request(url, headers=headers, method=method)
    if data:
        req.data = json.dumps(data).encode("utf-8")

    # TUNNEL SHORT-CIRCUIT (IMP-194, 2026-08-18 — RC7 pipeline integrity).
    #
    # The 8s per-request timeout below stopped ONE call from hanging forever; it did not stop the
    # SCRIPT from paying that timeout on every one of the dozen-plus API calls a publish makes,
    # twice, before the git fallback ever runs. When the sandbox proxy refuses api.github.com —
    # which it does, permanently, `curl` to it returns HTTP 000 — the whole budget is spent
    # discovering the same fact over and over. Receipts, two consecutive sessions on 2026-08-18:
    # `brief-morning`'s first publish.py invocation TIMED OUT at 178s inside this loop; the full
    # brief survived on the git fallback but the companion LIGHT brief did not, and the run was
    # killed before printing any sentinel — the 2026-05-15 silent-failure shape exactly. The light
    # reached origin/main thirteen minutes late, so the 05:45 ET audio cron ran against a 404 and
    # the podcast episode fell through to a retry cron. `verify-brief-publish` then HUNG over eight
    # minutes in the same loop and had to be killed.
    #
    # A connection-level failure to api.github.com is a fact about the NETWORK, not about the
    # request, so it is true for every subsequent call in this process. Learn it once. HTTP errors
    # are NOT treated this way on purpose: a 403 or a 404 means we REACHED GitHub and got an
    # answer, which the callers are written to interpret.
    global _API_TUNNEL_BLOCKED
    if _API_TUNNEL_BLOCKED:
        return {}, 0
    try:
        with urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except HTTPError as e:
        body = e.read().decode("utf-8")
        return json.loads(body) if body else {}, e.code
    except (URLError, TimeoutError, OSError) as e:
        _API_TUNNEL_BLOCKED = True
        print(
            f"⚠️  api.github.com unreachable ({type(e).__name__}: {e}). "
            "Short-circuiting the REST path for the rest of this run and going straight to the "
            "git clone fallback — the tunnel does not reopen mid-publish, and re-proving that "
            "costs the budget the fallback needs."
        )
        return {}, 0


def ensure_branch_exists(branch, token):
    """Create branch from main if it doesn't exist."""
    # Get main branch SHA
    url = f"https://api.github.com/repos/{REPO}/git/ref/heads/{BRANCH_MAIN}"
    result, status = github_request(url, token)
    if status != 200:
        print(f"ERROR: Could not get main branch ref")
        return False
    main_sha = result["object"]["sha"]

    # Check if draft branch exists
    url = f"https://api.github.com/repos/{REPO}/git/ref/heads/{branch}"
    result, status = github_request(url, token)
    if status == 200:
        # Branch exists — update it to match main
        url = f"https://api.github.com/repos/{REPO}/git/refs/heads/{branch}"
        data = {"sha": main_sha, "force": True}
        result, status = github_request(url, token, method="PATCH", data=data)
        return status == 200
    else:
        # Create branch from main
        url = f"https://api.github.com/repos/{REPO}/git/refs"
        data = {"ref": f"refs/heads/{branch}", "sha": main_sha}
        result, status = github_request(url, token, method="POST", data=data)
        return status == 201


def get_existing_file_sha(path, token, branch=None):
    """Check if file already exists and get its SHA (needed for updates)."""
    branch = branch or BRANCH_MAIN
    url = f"{API_BASE}/{path}?ref={branch}"
    result, status = github_request(url, token)
    if status == 200:
        return result.get("sha")
    return None


def strip_internal_tags(content):
    """Strip internal editorial/process tags that must never reach production.

    These tags are used during the editorial pipeline (critic, editor, QA)
    and belong in daily-briefs/ working copies, NOT in published output.
    This function is the hard gate — it runs on every publish, no exceptions.
    """
    original_len = len(content)
    # [EDITOR: ...] — editorial QA annotations
    content = re.sub(r'\s*\[EDITOR:[^\]]*\]', '', content)
    # [CRITIC: ...] — critic pass annotations (if any leak)
    content = re.sub(r'\s*\[CRITIC:[^\]]*\]', '', content)
    # [QA: ...] — QA annotations (if any leak)
    content = re.sub(r'\s*\[QA:[^\]]*\]', '', content)
    # [INTERNAL: ...] — any internal notes
    content = re.sub(r'\s*\[INTERNAL:[^\]]*\]', '', content)

    # <!-- ... --> — HTML comments. Process/meta markup (BRIEF VALIDATION REPORT,
    # take-move, INNER-GAME-COMPOUNDING, DEPTH-TREATMENT) belongs on the v2 draft
    # in daily-briefs/, never on the reader surface.
    #
    # ADDED 2026-08-09 (IMP-147). scripts/reader-surface-gate.ts has banned these
    # since 2026-07-21 and exits 1 on them correctly — but NOTHING CALLED IT:
    # `grep -n "publish-gate\|reader-surface" scripts/publish-brief.py` returned 0
    # hits, so publish-gate.sh was an orphan wrapper and every leak shipped. Nine
    # published briefs carried residual comments (07-14, 07-15, 07-16, 08-01,
    # 08-03, 08-04, 08-05, 08-06, 08-07) and on 08-08 a 37-line Editor validation
    # block landed in the header region, where it pushed the epigraph past the
    # parser's 5-line window and zeroed dailyTitle/epigraph/lede. The podcast then
    # published "Brief: Tesla's stock crashes after shocking reveal" for a brief
    # that never mentions Tesla.
    #
    # STRIP rather than BLOCK, deliberately: this runs on the nightly hot path, a
    # comment leak is never load-bearing on the reader surface (novelty-gate reads
    # take-move off the *draft*, not the published file), and a blocking check here
    # would have failed the run instead of fixing it. The structural defect that a
    # strip cannot repair — a header that does not parse — IS blocked, in
    # validate_brief_content() below.
    content, n_comments = re.subn(r'<!--[\s\S]*?-->\n?', '', content)
    if n_comments:
        content = re.sub(r'\n{3,}', '\n\n', content)

    chars_removed = original_len - len(content)
    if chars_removed > 0:
        detail = f"{n_comments} HTML comment(s), " if n_comments else ""
        print(f"⚠️  STRIPPED internal markup ({detail}{chars_removed} chars removed). "
              f"These should be removed before the file reaches publish.")
    return content


def validate_brief_content(content, is_light=False):
    """Pre-publish validation: check file isn't empty/truncated and has required sections."""
    errors = []

    # Size check
    min_size = MIN_LIGHT_SIZE if is_light else MIN_BRIEF_SIZE
    if len(content) < min_size:
        errors.append(f"Content too small ({len(content)} bytes, minimum {min_size}). File may be truncated.")

    # Required sections check
    required = REQUIRED_SECTIONS_LIGHT if is_light else REQUIRED_SECTIONS_FULL
    for section in required:
        if section not in content:
            errors.append(f"Missing required section: '{section}'")

    # Sanity: should start with a markdown heading
    stripped = content.strip()
    if not stripped.startswith("#"):
        errors.append("File doesn't start with a markdown heading — may be corrupted.")

    # HEADER CONTRACT (added 2026-08-09 — IMP-147, the fabricated-podcast-title incident)
    #
    # lib/daily-update-parser.ts accepts an epigraph ONLY inside the first 5 lines
    # (`i < 5`). When anything displaces the header, parseDailyBrief returns EMPTY
    # STRINGS for dailyTitle, epigraph and lede — it does not throw, warn, or log.
    # Every consumer then degrades silently and differently: the archive card loses
    # its title and blurb, the homepage rail skips the day, and lib/audio/full-generate.ts
    # falls through to an LLM clickbait title generator. On 2026-08-08 that generator
    # was handed raw markdown (because lede was empty too) and invented a company:
    # the published episode was "Brief: Tesla's stock crashes after shocking reveal"
    # for a brief where `grep -ic tesla` returns 0.
    #
    # The shape below is the contract, verified against the archive: masthead →
    # italic epigraph → `## <date or week>` → `### <editorial title>`. It holds for
    # both dailies and the weekly (whose masthead carries ": THE WEEKLY" and whose
    # date line reads "## Week of ..."). Light briefs use a different masthead and
    # are exempt. This is the BLOCKING half of the pair whose non-blocking half is
    # the comment strip in strip_internal_tags(); the parser-bound TS twin is
    # scripts/published-header-gate.ts (run it with `npx tsx`, --selftest covers
    # both directions plus the whole post-2026-07-07 archive).
    if not is_light:
        head = [ln.strip() for ln in stripped.split("\n") if ln.strip()][:4]
        if len(head) < 4:
            errors.append("Header contract: fewer than 4 non-empty lines before the body — file may be truncated.")
        else:
            masthead, epigraph, dateline, title = head
            if not re.match(r'^#\s+\S', masthead):
                errors.append(f"Header contract: line 1 must be the masthead heading, got {masthead[:60]!r}")
            if not re.match(r'^\*[^*].*\*$', epigraph):
                errors.append(
                    "Header contract: the line after the masthead must be the italic epigraph "
                    f"(*...*), got {epigraph[:60]!r}. parseDailyBrief only looks in the first 5 "
                    "lines — anything here zeroes dailyTitle/epigraph/lede silently."
                )
            if not re.match(r'^##\s+\S', dateline):
                errors.append(f"Header contract: expected the '## <date>' line third, got {dateline[:60]!r}")
            if not re.match(r'^###\s+\S', title):
                errors.append(
                    f"Header contract: expected the '### <daily title>' line fourth, got {title[:60]!r}. "
                    "An empty dailyTitle routes the podcast episode title to an LLM generator."
                )

    if errors:
        print(f"❌ PRE-PUBLISH VALIDATION FAILED:")
        for e in errors:
            print(f"   • {e}")
        return False

    print(f"✅ Pre-publish validation passed ({len(content):,} bytes, {'light' if is_light else 'full'} brief)")
    return True


def retry_with_backoff(func, *args, max_retries=MAX_RETRIES, **kwargs):
    """Retry a function with exponential backoff. Returns the function's return value or False."""
    for attempt in range(1, max_retries + 1):
        result = func(*args, **kwargs)
        if result is not False:
            return result
        if attempt < max_retries:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            print(f"⚠️  Attempt {attempt}/{max_retries} failed. Retrying in {wait}s...")
            time.sleep(wait)
        else:
            print(f"❌ All {max_retries} attempts failed.")
    return False


def publish_via_git(content, repo_path, brief_date, token, branch="main"):
    """Fallback: clone to /tmp, commit, push via git CLI.

    Used when the GitHub REST API is unreachable (e.g. proxy blocks the tunnel).
    The /tmp directory has full permissions — no lock file risk.
    """
    clone_url = f"https://x-access-token:{token}@github.com/{REPO}.git"
    tmp_dir = tempfile.mkdtemp(prefix="mmo-publish-")

    def _redact(text):
        """SECURITY 2026-08-03 (verify-brief-publish). clone_url embeds the PAT, so git
        errors printed verbatim leaked the token into pipeline logs and the status file.
        Every print of git output on this path MUST go through here."""
        text = str(text or "")
        return text.replace(token, "***REDACTED***") if token else text

    try:
        print(f"FALLBACK: Cloning to {tmp_dir} ...")
        subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, clone_url, tmp_dir],
            check=True, capture_output=True, text=True, timeout=120,
        )

        # Write the brief
        target = os.path.join(tmp_dir, repo_path)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w") as f:
            f.write(content)

        # Configure git identity
        subprocess.run(["git", "config", "user.email", "jacksonshapiro11@gmail.com"],
                        cwd=tmp_dir, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Jackson Shapiro"],
                        cwd=tmp_dir, check=True, capture_output=True)

        # Stage, commit, push
        subprocess.run(["git", "add", repo_path],
                        cwd=tmp_dir, check=True, capture_output=True)

        commit_msg = f"brief: {brief_date}"
        # FIXED 2026-07-13 (brief-morning). `git commit` exits 1 with "nothing to commit,
        # working tree clean" when the file we just wrote is byte-identical to what is ALREADY
        # on the branch. That is the SUCCESS state (the content is live), but check=True turned
        # it into a CalledProcessError, the fallback returned False, and publish.py printed
        # PUBLISH_RESULT=FAILURE over a brief that was already published. This is the exact
        # mirror of the 2026-05-15 false-positive: a false NEGATIVE that cries wolf and sends
        # someone chasing a publish that already happened.
        # Receipt: 2026-07-13. api.github.com 403'd on the sandbox proxy, the full brief was
        # already live from an earlier attempt, and this line reported FAILURE on a healthy publish.
        result = subprocess.run(
            ["git", "commit", "-m", commit_msg],
            cwd=tmp_dir, check=False, capture_output=True, text=True,
        )
        if result.returncode != 0:
            combined = (result.stdout or "") + (result.stderr or "")
            if "nothing to commit" in combined or "working tree clean" in combined:
                print("Already current: remote content is byte-identical. Nothing to commit.")
                print(f"Verified live on {branch} via git fallback.")
                return True
            # A real commit failure. Surface the REASON, not just the exit code — the 07-13 log
            # said only "returned non-zero exit status 1", which is undiagnosable from the log.
            print(f"GIT FALLBACK FAILED at commit (exit {result.returncode}).")
            if combined.strip():
                print(f"  git said: {_redact(combined.strip())}")
            return False
        print(f"Committed: {result.stdout.strip()}")

        result = subprocess.run(
            ["git", "push", "origin", branch],
            cwd=tmp_dir, check=True, capture_output=True, text=True, timeout=120,
        )
        print(f"Pushed to {branch} via git fallback.")
        return True

    except subprocess.CalledProcessError as e:
        print(f"GIT FALLBACK FAILED: {_redact(e)}")
        if e.stderr:
            print(f"  stderr: {_redact(e.stderr).strip()}")
        return False
    except Exception as e:
        print(f"GIT FALLBACK FAILED: {_redact(e)}")
        return False
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def publish_brief(markdown_path, brief_date=None, dry_run=False, draft=False, correction=False):
    token = get_token()
    branch = BRANCH_DRAFT if draft else BRANCH_MAIN

    # Read the markdown file
    with open(markdown_path, "r") as f:
        content = f.read()

    # HARD GATE: Strip internal editorial tags before publishing.
    # These belong in daily-briefs/ working copies, never in production.
    content = strip_internal_tags(content)

    # Determine the date for the filename
    if brief_date is None:
        # Default to today. publish.py runs in the MORNING — at that point, today's
        # calendar date IS the publication date. The brief was written last night and
        # saved with today's date (e.g. written March 19 evening → saved as 2026-03-20,
        # published morning of March 20). Always prefer passing --date explicitly.
        brief_date = date.today().isoformat()
        print(f"WARNING: No --date provided. Defaulting to today ({brief_date}).")
        print(f"If this is wrong, re-run with --date YYYY-MM-DD.")

    # Validate date format
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", brief_date):
        print(f"ERROR: Invalid date format '{brief_date}'. Use YYYY-MM-DD.")
        sys.exit(1)

    # STALENESS GUARD: refuse to publish a brief dated strictly in the past (yesterday
    # or earlier). Publishing yesterday's brief would silently replace a live brief or
    # skip a day. Today and future dates are valid publish targets.
    # This is NOT the same as the overwrite guard — it checks the DATE of the brief
    # itself, not whether a file already exists.
    brief_date_obj = date.fromisoformat(brief_date)
    if brief_date_obj < date.today() and not draft and not dry_run:
        if correction:
            # CORRECTION PATH (added 2026-07-11, IMP-035). The staleness guard exists to
            # stop a stale NEW brief from silently replacing a live one or skipping a day.
            # It must NOT stop us from repairing a published falsehood — that is the one
            # legitimate back-dated write, and the Corrections Ledger mandates it.
            # Before this flag existed the guard's own error message pointed at an override
            # that did not exist, so COR-001/002 ($28B -> $26.5B) sat live for 24h+ AFTER
            # the system had proven them false. Detection without a repair path is theater.
            print(f"CORRECTION MODE: overwriting published brief {brief_date} (staleness guard bypassed).")
            print(f"  This must correspond to a row in system/Corrections_Ledger.md.")
        else:
            print(f"ERROR: Staleness guard triggered.")
            print(f"  Attempted publish date: {brief_date}")
            print(f"  Today: {date.today().isoformat()}")
            print(f"  Refusing to publish a brief dated in the past — this would overwrite")
            print(f"  a live brief or publish stale content.")
            print(f"  If this is an intentional correction of a published falsehood, log it")
            print(f"  in system/Corrections_Ledger.md and re-run with:")
            print(f"      --date {brief_date} --correction")
            sys.exit(1)

    # Target path in repo — detect if this is a Brief Light file
    is_light = markdown_path.endswith("-light.md") or "-light" in os.path.basename(markdown_path)
    if is_light:
        repo_path = f"content/daily-updates/{brief_date}-light.md"
    else:
        repo_path = f"content/daily-updates/{brief_date}.md"

    if dry_run:
        print(f"DRY RUN — would publish to: {repo_path} on branch '{branch}'")
        print(f"Content length: {len(content)} characters")
        print(f"First 200 chars:\n{content[:200]}")
        return

    # --- PRE-PUBLISH VALIDATION ---
    if not validate_brief_content(content, is_light=is_light):
        print("Aborting publish due to validation failure.")
        print("Fix the file and re-run, or inspect the content for corruption/truncation.")
        return False

    # If draft mode, ensure the draft branch exists
    if draft:
        print(f"Setting up draft branch '{branch}'...")
        if not ensure_branch_exists(branch, token):
            print("ERROR: Could not create/update draft branch")
            return False

    # --- PUBLISH WITH RETRY ---
    def _attempt_publish():
        """Single publish attempt: tries API first, falls back to git clone."""
        api_failed = False
        try:
            # Encode content as base64
            encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")

            # Check if file already exists on target branch
            sha = get_existing_file_sha(repo_path, token, branch)

            # Build the request
            commit_prefix = "Draft: " if draft else "Brief: "
            data = {
                "message": f"{commit_prefix}{brief_date}",
                "content": encoded,
                "branch": branch,
            }
            if sha:
                data["sha"] = sha
                print(f"Updating existing brief for {brief_date} on '{branch}'...")
            else:
                print(f"Creating new brief for {brief_date} on '{branch}'...")

            # Push to GitHub
            url = f"{API_BASE}/{repo_path}"
            result, status = github_request(url, token, method="PUT", data=data)

            if status in (200, 201):
                html_url = result.get("content", {}).get("html_url", "")
                print(f"Published via API! {html_url}")
                return True
            else:
                print(f"API ERROR (HTTP {status}): {json.dumps(result, indent=2)}")
                api_failed = True

        except (URLError, OSError) as e:
            print(f"API CONNECTION ERROR: {e}")
            print("GitHub REST API unreachable (likely proxy/network issue).")
            api_failed = True

        # --- FALLBACK PATH: git clone to /tmp ---
        if api_failed:
            print("Attempting git clone fallback...")
            git_ok = publish_via_git(content, repo_path, brief_date, token, branch)
            if git_ok:
                return True
            print("Both API and git fallback failed for this attempt.")
            return False

    # Retry the full publish (API → git fallback) up to MAX_RETRIES times
    publish_ok = retry_with_backoff(_attempt_publish)
    if publish_ok is False:
        print(f"❌ ALL {MAX_RETRIES} PUBLISH ATTEMPTS FAILED. Brief NOT published.")
        print("Manual intervention required.")
        return False

    # --- POST-PUBLISH (runs regardless of which path succeeded) ---
    if draft:
        print(f"Vercel preview deployment will be available shortly.")
        print(f"Check Vercel dashboard or PR for preview URL.")
    else:
        print(f"Vercel will auto-deploy. Brief live at: /daily-update")

        # Trigger full publish pipeline only on main publish (not draft, not light-only).
        # publish/complete runs full podcast + super brief audio + email + X + marketing in parallel.
        # When publishing just the light file, skip — full brief publish or failsafe cron handles it.
        if not os.environ.get("SKIP_PIPELINE") and not os.environ.get("SKIP_AUDIO") and not is_light:
            trigger_publish_complete(brief_date)

    return True


def wait_for_deployed_brief(brief_date, timeout=None, interval=None):
    """Poll GET /api/publish/health until lightBrief is true on the live site.

    complete checks the deployed Vercel filesystem (getBriefLightByDate), NOT GitHub.
    Returns True when ready, False on timeout. Never assumes localhost.
    """
    timeout = timeout if timeout is not None else PUBLISH_HEALTH_TIMEOUT
    interval = interval if interval is not None else PUBLISH_HEALTH_POLL_INTERVAL
    health_url = f"{SITE_URL}/api/publish/health?date={brief_date}"
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
            req = Request(health_url, method="GET", headers={"User-Agent": "publish-brief-skill"})
            with urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            # Health returns 503 when not ready — body still has the JSON flags.
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
        ready = bool(body.get("ready"))
        print(f"  health poll #{attempt}: fullBrief={full} lightBrief={light} ready={ready}")
        if light:
            return True
        time.sleep(interval)

    print(
        f"ALERT: Deploy health timeout after {timeout}s — lightBrief still false for {brief_date}. "
        f"NOT calling complete (would skip). Failsafe cron at ~5:55 AM ET will retry."
    )
    return False


def trigger_publish_complete(brief_date):
    """Wait until the brief is on the deployed site, then POST /api/publish/complete."""
    secret = os.environ.get("SNAPSHOT_SECRET")
    if not secret:
        print("Note: SNAPSHOT_SECRET not set — skipping publish pipeline trigger.")
        print("Pipeline will run via Vercel failsafe cron (~5:55 AM ET) instead.")
        return

    def _trigger():
        if not wait_for_deployed_brief(brief_date):
            print(
                f"ALERT: publish/complete NOT fired for {brief_date} — deploy never showed lightBrief. "
                "Relying on Vercel cron failsafe (55 9 * * * UTC)."
            )
            return

        url = f"{SITE_URL}/api/publish/complete?secret={secret}&date={brief_date}"
        print(f"Deploy ready — POSTing {SITE_URL}/api/publish/complete?date={brief_date}")
        try:
            req = Request(url, method="POST", headers={"User-Agent": "publish-brief-skill"})
            with urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                status = resp.status
                if result.get("skipped"):
                    # Should be rare after health poll; still alert loudly — do not treat as success.
                    print(
                        f"ALERT: Pipeline SKIPPED for {brief_date}: {result.get('reason', 'unknown')} "
                        f"(HTTP {status}). Failsafe cron will retry."
                    )
                elif result.get("success"):
                    print(f"Publish pipeline complete for {brief_date}!")
                    full = result.get("fullAudio", {})
                    light = result.get("lightAudio", {})
                    dist = result.get("distribute", {})
                    print(f"  Full podcast: {full.get('status', 'n/a')}")
                    print(f"  Super brief audio: {light.get('status', 'n/a')}")
                    if dist.get("email"):
                        print(f"  Email: {dist['email'].get('details', dist['email'].get('success'))}")
                    if dist.get("x"):
                        print(f"  X: {dist['x'].get('details', dist['x'].get('success'))}")
                else:
                    print(f"Pipeline partial/failed (HTTP {status}): {json.dumps(result, indent=2)[:500]}")
                    print("Failsafe cron at ~5:55 AM ET will retry missing steps.")
        except HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8")[:500]
            except Exception:
                pass
            # complete returns 409 when skipped — surface clearly
            if e.code == 409 or '"skipped":true' in body.replace(" ", "").lower():
                print(f"ALERT: Pipeline SKIPPED (HTTP {e.code}) for {brief_date}: {body}")
            else:
                print(f"Publish pipeline trigger failed (HTTP {e.code}): {body or e}")
            print("Failsafe cron at ~5:55 AM ET will retry.")
        except Exception as e:
            print(f"Publish pipeline trigger failed: {e}")
            print("Failsafe cron at ~5:55 AM ET will retry.")

    # Join the worker — do NOT fire-and-forget. brief-morning agents exit on
    # PUBLISH_RESULT=SUCCESS and kill the process; a background thread never
    # finishes health-poll → complete (Jul 10 2026: content live, audio missing).
    thread = threading.Thread(target=_trigger, daemon=False)
    thread.start()
    print(
        f"Publish pipeline running (poll {SITE_URL}/api/publish/health then complete; "
        f"timeout {PUBLISH_HEALTH_TIMEOUT}s)..."
    )
    thread.join(timeout=PUBLISH_HEALTH_TIMEOUT + 330)
    if thread.is_alive():
        print(
            f"ALERT: publish/complete thread still running after join timeout for {brief_date}. "
            "Failsafe cron / GitHub Action should recover."
        )
    else:
        print(f"Publish pipeline thread finished for {brief_date}.")


def find_companion_file(markdown_path, brief_date):
    """Given a brief file, find its companion (light ↔ full) if it exists."""
    dirname = os.path.dirname(markdown_path)
    is_light = "-light" in os.path.basename(markdown_path)

    if is_light:
        # This is the light file — companion is the full brief
        companion = os.path.join(dirname, f"{brief_date}.md")
    else:
        # This is the full brief — companion is the light file
        companion = os.path.join(dirname, f"{brief_date}-light.md")

    if os.path.exists(companion):
        return companion
    return None


def _git_verify_file(brief_date, filename_suffix, branch="main"):
    """Verify a file exists on GitHub via git (fallback when REST API is blocked).

    Returns True if the file exists on the remote branch, False otherwise.
    Added June 12 — E-PUBLISH-PATH-01: REST API returns 403 in this VM (INC-009),
    killing verify_published and its sentinel every morning. Git verification is
    the proven fallback (the morning pass already uses fresh clones).
    """
    path = f"content/daily-updates/{brief_date}{filename_suffix}"
    try:
        result = subprocess.run(
            ["git", "cat-file", "-e", f"origin/{branch}:{path}"],
            capture_output=True, timeout=15
        )
        if result.returncode == 0:
            return True
        subprocess.run(["git", "fetch", "--depth=5", "origin", branch],
                       capture_output=True, timeout=30)
        result = subprocess.run(
            ["git", "cat-file", "-e", f"origin/{branch}:{path}"],
            capture_output=True, timeout=15
        )
        return result.returncode == 0
    except Exception:
        return None


def verify_published(brief_date, token, branch="main", auto_fix=False, content_dir=None):
    """Post-publish verification: check that BOTH files exist on GitHub.

    If auto_fix=True and content_dir is provided, will attempt to publish
    any missing files from the local content directory.
    """
    full_path = f"content/daily-updates/{brief_date}.md"
    light_path = f"content/daily-updates/{brief_date}-light.md"

    try:
        full_ok = get_existing_file_sha(full_path, token, branch) is not None
        light_ok = get_existing_file_sha(light_path, token, branch) is not None
    except (HTTPError, URLError, OSError) as e:
        print(f"\n⚠️  REST API verification failed ({e}). Falling back to git verification.")
        full_ok = _git_verify_file(brief_date, ".md", branch)
        light_ok = _git_verify_file(brief_date, "-light.md", branch)
        if full_ok is None:
            print("  Git verification also failed. Cannot confirm publish status.")
            full_ok = False
        if light_ok is None:
            light_ok = False

    print(f"\n{'='*50}")
    print(f"POST-PUBLISH VERIFICATION ({brief_date})")
    print(f"  Full brief:  {'✅ LIVE' if full_ok else '❌ MISSING'}")
    print(f"  Super brief: {'✅ LIVE' if light_ok else '❌ MISSING'}")
    print(f"{'='*50}")

    if (not full_ok or not light_ok) and auto_fix and content_dir:
        print(f"\n🔧 AUTO-FIX: Attempting to publish missing files...")

        if not full_ok:
            local_full = os.path.join(content_dir, f"{brief_date}.md")
            if os.path.exists(local_full):
                print(f"  Found local full brief: {local_full}")
                result = publish_brief(local_full, brief_date, dry_run=False, draft=(branch != "main"))
                if result is not False:
                    full_ok = True
                    print(f"  ✅ Full brief recovered and published!")
                else:
                    print(f"  ❌ Failed to recover full brief.")
            else:
                print(f"  ❌ No local full brief found at {local_full}")

        if not light_ok:
            local_light = os.path.join(content_dir, f"{brief_date}-light.md")
            if os.path.exists(local_light):
                print(f"  Found local super brief: {local_light}")
                old_skip = os.environ.get("SKIP_PIPELINE")
                os.environ["SKIP_PIPELINE"] = "1"  # Don't double-trigger pipeline
                result = publish_brief(local_light, brief_date, dry_run=False, draft=(branch != "main"))
                if old_skip is None and "SKIP_PIPELINE" in os.environ:
                    del os.environ["SKIP_PIPELINE"]
                elif old_skip is not None:
                    os.environ["SKIP_PIPELINE"] = old_skip
                if result is not False:
                    light_ok = True
                    print(f"  ✅ Super brief recovered and published!")
                else:
                    print(f"  ❌ Failed to recover super brief.")
            else:
                print(f"  ❌ No local super brief found at {local_light}")

    if not full_ok or not light_ok:
        print(f"⚠️  WARNING: Not all files published successfully!")
        return False

    if auto_fix:
        print(f"✅ All files verified live on GitHub.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish a Daily Brief to GitHub")
    parser.add_argument("file", nargs="?", help="Path to the markdown file (not needed with --verify)")
    parser.add_argument("--date", help="Brief date (YYYY-MM-DD), defaults to today")
    parser.add_argument("--dry-run", action="store_true", help="Preview without publishing")
    parser.add_argument("--draft", action="store_true", help="Publish to draft branch for preview (not live)")
    parser.add_argument("--correction", action="store_true",
                        help="Intentionally overwrite an already-published (past-dated) brief to "
                             "repair a proven falsehood. Requires a row in system/Corrections_Ledger.md.")
    parser.add_argument("--only", action="store_true",
                        help="Publish ONLY this file (skip companion auto-detection)")
    parser.add_argument("--verify", action="store_true",
                        help="Verify today's briefs are on GitHub; auto-publish any missing ones")
    parser.add_argument("--content-dir",
                        help="Local directory containing brief files (for --verify auto-fix)")
    args = parser.parse_args()

    # --- VERIFY-ONLY MODE ---
    if args.verify:
        brief_date = args.date or date.today().isoformat()
        token = get_token()
        branch = BRANCH_DRAFT if args.draft else BRANCH_MAIN
        content_dir = args.content_dir or os.path.join(
            os.path.dirname(__file__), '..', '..', '..', '..', 'content', 'daily-updates'
        )
        content_dir = os.path.abspath(content_dir)
        print(f"🔍 Verifying briefs for {brief_date} (content dir: {content_dir})")
        ok = verify_published(brief_date, token, branch, auto_fix=True, content_dir=content_dir)
        sys.exit(0 if ok else 1)

    # --- NORMAL PUBLISH MODE ---
    if not args.file:
        parser.error("file is required (unless using --verify)")

    if not os.path.exists(args.file):
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    # Determine date early so we can find the companion
    brief_date = args.date
    if not brief_date:
        brief_date = date.today().isoformat()

    # --- Publish the primary file ---
    result = publish_brief(args.file, args.date, args.dry_run, args.draft, args.correction)

    # --- Auto-detect and publish companion file ---
    if not args.only and not args.dry_run and result is not False:
        companion = find_companion_file(args.file, brief_date)
        if companion:
            is_light = "-light" in os.path.basename(args.file)
            companion_type = "full brief" if is_light else "super brief"
            print(f"\n{'='*50}")
            print(f"AUTO-PUBLISHING companion {companion_type}: {os.path.basename(companion)}")
            print(f"{'='*50}")
            # Publish companion — skip pipeline on companion (full brief triggers once)
            old_skip = os.environ.get("SKIP_PIPELINE")
            if "-light" not in os.path.basename(companion):
                pass  # companion is full brief — let it trigger pipeline
            else:
                os.environ["SKIP_PIPELINE"] = "1"
            publish_brief(companion, args.date, args.dry_run, args.draft, args.correction)
            if old_skip is None and "SKIP_PIPELINE" in os.environ:
                del os.environ["SKIP_PIPELINE"]
            elif old_skip is not None:
                os.environ["SKIP_PIPELINE"] = old_skip
        else:
            is_light = "-light" in os.path.basename(args.file)
            missing_type = "full brief" if is_light else "super brief"
            print(f"\n⚠️  WARNING: No companion {missing_type} found for {brief_date}.")
            print(f"   Expected at: {os.path.dirname(args.file)}/{brief_date}{'' if is_light else '-light'}.md")
            print(f"   Only one file will be published. Use --only to suppress this warning.")

    # --- Post-publish verification ---
    final_ok = (result is not False)
    if not args.dry_run and result is not False:
        token = get_token()
        branch = BRANCH_DRAFT if args.draft else BRANCH_MAIN
        content_dir = os.path.dirname(os.path.abspath(args.file))
        verified = verify_published(brief_date, token, branch, auto_fix=True, content_dir=content_dir)
        final_ok = bool(verified)

    # --- FINAL SENTINEL (June 12 fix: wrapped in try/finally so it ALWAYS prints) ---
    # The sentinel must be unkillable — if verify_published crashes (INC-009 proxy 403),
    # the sentinel still prints based on push outcome, not verify outcome.
    try:
        if args.dry_run:
            print("PUBLISH_RESULT=DRY_RUN")
        elif final_ok:
            print(f"PUBLISH_RESULT=SUCCESS brief={brief_date}")
        else:
            print(f"PUBLISH_RESULT=FAILURE brief={brief_date} reason=publish_or_verify_failed")
            sys.exit(2)
    except SystemExit:
        raise  # let sys.exit(2) through
    except Exception as e:
        print(f"PUBLISH_RESULT=FAILURE brief={brief_date} reason=sentinel_error:{e}")
        sys.exit(2)
