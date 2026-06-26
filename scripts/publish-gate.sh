#!/usr/bin/env bash
# publish-gate.sh — the single hard gate before publish.
#
# Chains the four mechanical gates. Any non-zero exit blocks publish.
#   1. validate-brief.ts  — structure / voice / dedup (existing)
#   2. fact-gate.ts       — TRUTH (strict: also blocks unverified-critical numbers)
#   3. novelty-gate.ts    — NOVELTY (bans repeating The Take's structural move)
#   4. relevance-gate.ts  — RELEVANCE (each section traces to today's intel)
#
# publish.py must run this and refuse to push unless it exits 0.
# Wire into Pipeline_Controller morning step: replace the bare
# "re-run mechanical validator" call with this wrapper.
#
# Usage: scripts/publish-gate.sh content/daily-updates/2026-06-08.md
set -uo pipefail
BRIEF="${1:?usage: publish-gate.sh <brief.md>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUN=(node --experimental-strip-types)
fail=0

echo "════════════ 1/4 STRUCTURAL ════════════"
"${RUN[@]}" scripts/validate-brief.ts "$BRIEF" || fail=1
echo ""; echo "════════════ 2/4 TRUTH (strict) ════════════"
"${RUN[@]}" scripts/fact-gate.ts "$BRIEF" || fail=1
echo ""; echo "════════════ 3/4 NOVELTY ════════════"
"${RUN[@]}" scripts/novelty-gate.ts "$BRIEF" || fail=1
echo ""; echo "════════════ 4/4 RELEVANCE ════════════"
"${RUN[@]}" scripts/relevance-gate.ts "$BRIEF" || fail=1

echo ""
if [ "$fail" -eq 0 ]; then
  echo "✅ PUBLISH-GATE PASS — $BRIEF"
else
  echo "❌ PUBLISH-GATE FAIL — $BRIEF — DO NOT PUBLISH. Fix the issues above and re-run."
fi
exit $fail
