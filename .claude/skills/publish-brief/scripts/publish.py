#!/usr/bin/env python3
"""
Publish a Daily Brief markdown file to GitHub via the REST API.
Vercel auto-deploys on push.

Usage:
    python publish.py <markdown_file_path>
    python publish.py <markdown_file_path> --date 2026-02-24
    python publish.py <markdown_file_path> --dry-run

Requires GITHUB_TOKEN env var with repo scope.
"""

import argparse
import base64
import json
import os
import re
import sys
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import HTTPError

REPO = "jacksonshapiro11/mental-models-observatory"
BRANCH = "main"
API_BASE = f"https://api.github.com/repos/{REPO}/contents"


def get_token():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: GITHUB_TOKEN environment variable not set.")
        print("Create a personal access token at https://github.com/settings/tokens")
        print("It needs 'repo' scope (or 'Contents: Read and write' for fine-grained).")
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

    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except HTTPError as e:
        body = e.read().decode("utf-8")
        return json.loads(body) if body else {}, e.code


def get_existing_file_sha(path, token):
    """Check if file already exists and get its SHA (needed for updates)."""
    url = f"{API_BASE}/{path}?ref={BRANCH}"
    result, status = github_request(url, token)
    if status == 200:
        return result.get("sha")
    return None


def publish_brief(markdown_path, brief_date=None, dry_run=False):
    token = get_token()

    # Read the markdown file
    with open(markdown_path, "r") as f:
        content = f.read()

    # Determine the date for the filename
    if brief_date is None:
        brief_date = date.today().isoformat()

    # Validate date format
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", brief_date):
        print(f"ERROR: Invalid date format '{brief_date}'. Use YYYY-MM-DD.")
        sys.exit(1)

    # Target path in repo
    repo_path = f"content/daily-updates/{brief_date}.md"

    if dry_run:
        print(f"DRY RUN — would publish to: {repo_path}")
        print(f"Content length: {len(content)} characters")
        print(f"First 200 chars:\n{content[:200]}")
        return

    # Encode content as base64
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")

    # Check if file already exists
    sha = get_existing_file_sha(repo_path, token)

    # Build the request
    data = {
        "message": f"Brief: {brief_date}",
        "content": encoded,
        "branch": BRANCH,
    }
    if sha:
        data["sha"] = sha
        print(f"Updating existing brief for {brief_date}...")
    else:
        print(f"Creating new brief for {brief_date}...")

    # Push to GitHub
    url = f"{API_BASE}/{repo_path}"
    result, status = github_request(url, token, method="PUT", data=data)

    if status in (200, 201):
        html_url = result.get("content", {}).get("html_url", "")
        print(f"Published! {html_url}")
        print(f"Vercel will auto-deploy. Brief live at: /daily-update")
        return True
    else:
        print(f"ERROR (HTTP {status}): {json.dumps(result, indent=2)}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish a Daily Brief to GitHub")
    parser.add_argument("file", help="Path to the markdown file")
    parser.add_argument("--date", help="Brief date (YYYY-MM-DD), defaults to today")
    parser.add_argument("--dry-run", action="store_true", help="Preview without publishing")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    publish_brief(args.file, args.date, args.dry_run)
