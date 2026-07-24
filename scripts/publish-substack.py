#!/usr/bin/env python3
"""
Publish the daily Brief Light (super brief) to Substack.

The Substack post = the super brief, verbatim, with a link block prepended:
  🎧 Listen on Spotify (show page — the day's episode lands there as Spotify
     ingests the RSS feed)
  📖 Read the full brief on cosmictrex.com/daily-update/{date}

Runs from GitHub Actions (publish-substack.yml) after the light brief lands on
main, or manually. Uses the unofficial python-substack client (Substack has no
official publishing API), which drives the same internal draft→publish
endpoints the web editor uses.

Usage:
  python3 scripts/publish-substack.py                       # today (ET), mode from env
  python3 scripts/publish-substack.py --date=2026-07-24
  python3 scripts/publish-substack.py --mode=draft          # create draft only
  python3 scripts/publish-substack.py --mode=publish        # publish (+email per SUBSTACK_SEND_EMAIL)
  python3 scripts/publish-substack.py --dry-run             # build post + HTML preview, no network
  python3 scripts/publish-substack.py --file=path/to.md     # explicit source file (testing)

Env (GitHub secrets in CI; .env.local is read as a fallback for local runs):
  SUBSTACK_EMAIL / SUBSTACK_PASSWORD   login auth (set a password on the account
                                       first — new Substack accounts are magic-link only)
  SUBSTACK_COOKIES_STRING              alternative auth: cookie header string from a
                                       logged-in browser session, e.g.
                                       "substack.sid=...; substack.lli=..."
                                       (use if password login hits a captcha in CI)
  SUBSTACK_PUBLICATION_URL             e.g. https://cosmictrex.substack.com
  SUBSTACK_MODE                        draft | publish     (default: draft)
  SUBSTACK_SEND_EMAIL                  true | false        (default: true; publish mode only)

Exit codes: 0 = published / drafted / cleanly skipped (already posted, no brief
today, or not configured). 1 = real failure — CI goes red, fix and re-run via
workflow_dispatch.

Failure runbook:
  - Login/captcha error → switch to SUBSTACK_COOKIES_STRING (browser DevTools →
    Application → Cookies → substack.com → copy substack.sid + substack.lli).
  - Cookie expired (401s after months of working) → refresh the cookie secret.
  - Node-schema / API errors after a Substack change → bump python-substack pin
    in publish-substack.yml; the post can always be published by hand meanwhile.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = REPO_ROOT / "content" / "daily-updates"
OUT_DIR = REPO_ROOT / "daily-briefs"

SPOTIFY_SHOW_URL = "https://open.spotify.com/show/0MhCdB3jidaoJ25kg7zr6O"
SITE_URL = "https://www.cosmictrex.com"

ET = ZoneInfo("America/New_York")


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    log(f"❌ {msg}")
    log("PUBLISH_RESULT=FAILURE")
    sys.exit(1)


# ─── Env loading (mirrors their dotenv pattern for local runs) ────────────────

def load_env_local() -> None:
    """Fill os.environ from .env.local for any SUBSTACK_* keys not already set."""
    env_file = REPO_ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("SUBSTACK_") and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


# ─── Brief Light parsing (mirrors lib/brief-light-parser.ts) ─────────────────

SECTION_HEADER_RE = re.compile(r"^##\s*▸\s*(.+?)\s*$")
BOLD_LINE_RE = re.compile(r"^\*\*(.+?)\*\*\s*$")


def parse_light(markdown: str) -> dict:
    lines = markdown.split("\n")
    epigraph = ""
    display_date = ""
    daily_title = ""
    lede = ""
    found_title = False

    for line in lines[:25]:
        line = line.strip()
        if line.startswith("<!--"):
            continue
        if (line.startswith("*") and line.endswith("*") and not line.startswith("**")
                and not epigraph and not found_title):
            epigraph = line[1:-1].strip().strip('"“”').strip()
        if line.startswith("## ") and not display_date and "▸" not in line:
            display_date = line[3:].strip()
        if line.startswith("### ") and not daily_title and "▸" not in line:
            daily_title = line[4:].strip()
            found_title = True
        if (found_title and line.startswith("*") and line.endswith("*")
                and not line.startswith("**") and not lede):
            lede = line[1:-1].strip()
        if "## ▸" in line:
            break

    # First bold-only line after the first section header = thesis headline
    # (matches renderBriefEmail's extractSubject: strongest subject line).
    thesis = ""
    in_sections = False
    for raw in lines:
        if SECTION_HEADER_RE.match(raw.strip()):
            in_sections = True
            continue
        if in_sections:
            m = BOLD_LINE_RE.match(raw.strip())
            if m:
                candidate = m.group(1).strip()
                # Skip bold link-only lines like **[→ Explore this model](…)**
                if not candidate.startswith("["):
                    thesis = candidate
                    break

    return {
        "epigraph": epigraph,
        "displayDate": display_date,
        "dailyTitle": daily_title,
        "lede": lede,
        "thesis": thesis,
    }


def truncate(text: str, n: int) -> str:
    text = text.strip()
    if len(text) <= n:
        return text
    return text[: n - 1].rstrip() + "…"


# ─── Post assembly ───────────────────────────────────────────────────────────

def build_post(markdown: str, date_slug: str) -> dict:
    meta = parse_light(markdown)

    title = meta["thesis"] or meta["dailyTitle"] or f"Brief — {meta['displayDate'] or date_slug}"
    subtitle = truncate(meta["lede"] or meta["epigraph"], 200)

    full_brief_url = f"{SITE_URL}/daily-update/{date_slug}"
    link_block = (
        f"🎧 [Listen on Spotify]({SPOTIFY_SHOW_URL}) · "
        f"📖 [Read the full brief on cosmictrex.com]({full_brief_url})"
    )

    # Body = source minus the '# BRIEF LIGHT' masthead and the date heading
    # (Substack shows title + date itself). Everything else ships verbatim.
    body_lines = []
    for raw in markdown.split("\n"):
        stripped = raw.strip()
        if stripped == "# BRIEF LIGHT":
            continue
        if (stripped.startswith("## ") and "▸" not in stripped
                and meta["displayDate"] and stripped[3:].strip() == meta["displayDate"]):
            continue
        body_lines.append(raw)
    body = "\n".join(body_lines).strip()

    post_markdown = f"{link_block}\n\n{body}\n"

    return {
        "title": title,
        "subtitle": subtitle,
        "slug": f"brief-{date_slug}",
        "markdown": post_markdown,
        "meta": meta,
    }


# ─── Dry-run preview ─────────────────────────────────────────────────────────

def write_preview(post: dict, date_slug: str, out_dir: Path) -> tuple[Path, Path]:
    from markdown_it import MarkdownIt

    out_dir.mkdir(parents=True, exist_ok=True)
    md_path = out_dir / f"{date_slug}-substack-post.md"
    md_path.write_text(
        f"<!-- title: {post['title']} -->\n"
        f"<!-- subtitle: {post['subtitle']} -->\n"
        f"<!-- slug: {post['slug']} -->\n\n" + post["markdown"]
    )

    body_html = MarkdownIt("commonmark").render(post["markdown"])
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{post['title']}</title>
<style>
  body {{ margin:0; background:#fff; font-family: Georgia, 'Times New Roman', serif; color:#1a1a1a; }}
  .frame {{ max-width: 680px; margin: 0 auto; padding: 48px 20px 96px; }}
  .pub {{ font-size:13px; letter-spacing:1.5px; text-transform:uppercase; color:#888; margin-bottom:28px; }}
  h1.title {{ font-size: 34px; line-height:1.15; margin: 0 0 10px; }}
  .subtitle {{ font-size: 19px; color:#6b6b6b; line-height:1.4; margin-bottom: 14px; }}
  .byline {{ font-size: 14px; color:#888; border-bottom:1px solid #eee; padding-bottom:20px; margin-bottom:28px; }}
  .post {{ font-size: 17px; line-height: 1.6; }}
  .post h2 {{ font-size: 24px; margin: 36px 0 12px; }}
  .post h3 {{ font-size: 20px; margin: 28px 0 10px; }}
  .post a {{ color: #364db8; }}
  .post blockquote {{ border-left: 3px solid #ddd; margin: 20px 0; padding: 2px 0 2px 18px; color:#444; }}
  .post hr {{ border: none; border-top: 1px solid #e5e5e5; margin: 32px 0; }}
  .note {{ background:#fffbe8; border:1px solid #f0e6b8; border-radius:8px; padding:12px 16px; font-size:14px; color:#7a6a1f; margin-bottom:32px; }}
</style></head>
<body><div class="frame">
  <div class="note">PREVIEW — this is what the Substack post will contain (styling approximates Substack's reader).</div>
  <div class="pub">Cosmic Trex</div>
  <h1 class="title">{post['title']}</h1>
  <div class="subtitle">{post['subtitle']}</div>
  <div class="byline">Cosmic Trex · {post['meta']['displayDate'] or date_slug} · slug: {post['slug']}</div>
  <div class="post">{body_html}</div>
</div></body></html>"""
    html_path = out_dir / f"{date_slug}-substack-preview.html"
    html_path.write_text(html)
    return md_path, html_path


# ─── Substack client ─────────────────────────────────────────────────────────

def make_api(publication_url: str):
    from substack import Api

    cookies = os.environ.get("SUBSTACK_COOKIES_STRING", "").strip()
    email = os.environ.get("SUBSTACK_EMAIL", "").strip()
    password = os.environ.get("SUBSTACK_PASSWORD", "").strip()

    if cookies:
        log("🔑 Auth: cookies string")
        return Api(cookies_string=cookies, publication_url=publication_url)
    if email and password:
        log(f"🔑 Auth: password login ({email})")
        return Api(email=email, password=password, publication_url=publication_url)
    raise RuntimeError(
        "No Substack credentials: set SUBSTACK_EMAIL + SUBSTACK_PASSWORD "
        "or SUBSTACK_COOKIES_STRING"
    )


def extract_posts(resp) -> list:
    """Substack endpoints return either a list or {'posts': [...]} — normalize."""
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("posts", "drafts", "items"):
            if isinstance(resp.get(key), list):
                return resp[key]
    return []


def already_exists(api, post: dict, date_slug: str) -> str | None:
    """Return a human description if a post/draft for this date already exists."""
    slug = post["slug"]
    try:
        published = extract_posts(api.get_published_posts(offset=0, limit=25))
        for p in published:
            if p.get("slug") == slug or (p.get("title") or "").strip() == post["title"]:
                return f"published post id={p.get('id')} slug={p.get('slug')}"
    except Exception as e:  # noqa: BLE001 — idempotency check is best-effort
        log(f"⚠️  Could not check published posts ({e}) — continuing")
    try:
        drafts = extract_posts(api.get_drafts(filter="draft", offset=0, limit=25))
        for d in drafts:
            if d.get("slug") == slug or (d.get("draft_title") or "").strip() == post["title"]:
                return f"existing draft id={d.get('id')}"
    except Exception as e:  # noqa: BLE001
        log(f"⚠️  Could not check drafts ({e}) — continuing")
    return None


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="Brief date YYYY-MM-DD (default: today ET)")
    ap.add_argument("--mode", choices=["draft", "publish"], help="Override SUBSTACK_MODE")
    ap.add_argument("--dry-run", action="store_true", help="Build post + preview, no network")
    ap.add_argument("--file", help="Explicit source markdown (testing)")
    args = ap.parse_args()

    load_env_local()

    date_slug = args.date or dt.datetime.now(ET).strftime("%Y-%m-%d")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_slug):
        fail(f"Bad date: {date_slug}")

    if args.file:
        src = Path(args.file)
    else:
        src = CONTENT_DIR / f"{date_slug}-light.md"

    if not src.exists():
        # Mirrors resolvePublishDate: never fall back to an older brief.
        if args.date or args.file:
            fail(f"No light brief at {src}")
        log(f"⏭️  No light brief for {date_slug} (today) — nothing to post. Skipping.")
        log("PUBLISH_RESULT=SKIPPED reason=no-brief")
        return

    markdown = src.read_text()
    if len(markdown) < 2000:
        fail(f"Light brief suspiciously small ({len(markdown)} bytes) — refusing to post")

    post = build_post(markdown, date_slug)
    log(f"📰 {date_slug} — \"{post['title']}\"")
    log(f"   subtitle: {post['subtitle'][:80]}…")
    log(f"   slug:     {post['slug']}")
    log(f"   body:     {len(post['markdown'])} chars")

    if args.dry_run:
        md_path, html_path = write_preview(post, date_slug, OUT_DIR)
        log(f"🏃 Dry run — wrote {md_path.name} + {html_path.name} (no network)")
        log("PUBLISH_RESULT=DRY_RUN")
        return

    publication_url = os.environ.get("SUBSTACK_PUBLICATION_URL", "").strip().rstrip("/")
    if not publication_url:
        log("⏭️  SUBSTACK_PUBLICATION_URL not set — Substack leg not configured. Skipping.")
        log("PUBLISH_RESULT=SKIPPED reason=not-configured")
        return

    mode = args.mode or os.environ.get("SUBSTACK_MODE", "draft").strip().lower()
    if mode not in ("draft", "publish"):
        fail(f"Bad mode: {mode}")
    send_email = os.environ.get("SUBSTACK_SEND_EMAIL", "true").strip().lower() != "false"

    try:
        api = make_api(publication_url)
    except Exception as e:  # noqa: BLE001
        fail(f"Substack auth failed: {e}\n   (See failure runbook at top of this script.)")

    existing = already_exists(api, post, date_slug)
    if existing:
        log(f"⏭️  Already on Substack: {existing}. Skipping (idempotent).")
        log("PUBLISH_RESULT=SKIPPED reason=already-exists")
        return

    log(f"🚀 Creating {'and publishing' if mode == 'publish' else 'draft'} "
        f"(send_email={send_email if mode == 'publish' else 'n/a'})…")
    try:
        result = api.create_draft_from_markdown(
            title=post["title"],
            subtitle=post["subtitle"],
            markdown=post["markdown"],
            slug=post["slug"],
            audience="everyone",
            prepublish=(mode == "publish"),
            publish=(mode == "publish"),
            send=send_email,
            share_automatically=False,
        )
    except Exception as e:  # noqa: BLE001
        fail(f"Substack API call failed: {e}\n   (See failure runbook at top of this script.)")

    draft = result.get("draft") or {}
    draft_id = draft.get("id")
    if mode == "publish":
        pub = result.get("publish") or {}
        post_slug = pub.get("slug") or post["slug"]
        log(f"✅ Published: {publication_url}/p/{post_slug} (email={'sent' if send_email else 'off'})")
        log(f"PUBLISH_RESULT=SUCCESS mode=publish id={pub.get('id') or draft_id}")
    else:
        log(f"✅ Draft created: {publication_url.replace('.substack.com', '.substack.com')}"
            f"/publish/post/{draft_id}")
        log("   Review it in the Substack editor, then publish — or flip SUBSTACK_MODE to 'publish'.")
        log(f"PUBLISH_RESULT=SUCCESS mode=draft id={draft_id}")


if __name__ == "__main__":
    main()
