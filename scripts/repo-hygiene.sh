#!/usr/bin/env bash
# repo-hygiene.sh — safe cleanup of known local junk. Does not touch tracked files
# or content/daily-updates/*.md (use git pull after API publish for those).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Removing git lock files (if any)..."
find .git -name "*.lock" -delete 2>/dev/null || true

echo "Removing email preview / draft HTML..."
rm -f email-preview-*.html email-draft-body-*.html email-mockup.html draft-body-*.html welcome-email.html 2>/dev/null || true

echo "Removing FUSE hidden files..."
find content/daily-updates -name '.fuse_hidden*' -delete 2>/dev/null || true

echo "Removing temp extractors at repo root..."
rm -f _extract.ts _extract_digests.py _tmp_extract.py _tmp_extract2.py _tmp_parse.py _tmp_reformat.sh \
  tmp_copy_file.sh tmp_extract_tweets.py tmp_jq_extract.py \
  extract_tweets.py extract_tweets_temp.py extract_zvi.py extract_zvi_content.py 2>/dev/null || true

echo "Removing teaser-out/ (regenerate with render-teaser.ts)..."
rm -rf teaser-out/ 2>/dev/null || true

echo "Removing untracked duplicate briefs that already exist on origin/main..."
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  for f in content/daily-updates/2026-*.md; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    if git cat-file -e "origin/main:content/daily-updates/$base" 2>/dev/null; then
      if diff -q "$f" <(git show "origin/main:content/daily-updates/$base") >/dev/null 2>&1; then
        rm -f "$f"
        echo "  removed duplicate: $base"
      fi
    fi
  done
else
  echo "  (skip — origin/main not available; run git fetch first)"
fi

echo "Done. Run 'git status' to see remaining changes."
