#!/usr/bin/env bash
# Golden-master regression harness for the DETERMINISTIC brief gates.
#   bash scripts/golden-master.sh snapshot   # capture/refresh the baseline
#   bash scripts/golden-master.sh check      # re-run + diff vs baseline (exit 1 on drift)
# green = behavior preserved. red = behavior changed -> intended (re-snapshot) or regression (fix).
# Covers validate-brief.ts (structure, word ceilings, recency, dedup, counter-case...) + the
# novelty/idea-shape gate it spawns. EXCLUDES fact-gate (network -> not reproducible) and the
# agentic stages (Architect/Writer/QG/Editor -> verify by rule-audit + the live nightly run).
set -uo pipefail
cd "$(dirname "$0")/.."
SNAP_DIR="scripts/golden-master"
CORPUS=(daily-briefs/2026-06-1[3-5]-v2.md)
RUN="node --experimental-strip-types scripts/validate-brief.ts"
norm() {
  sed -e "s#$PWD#.#g" \
      -e 's#/sessions/[^ ]*/mnt/[A-Za-z0-9._-]*/##g' \
      -e 's/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T[0-9:.]*Z/<TS>/g' \
      -e '/^--- fact-gate\.ts ---/,/^--- novelty-gate\.ts ---/{/^--- novelty-gate\.ts ---/!d;}' \
      -e '/^--- assembly-gate\.ts ---/,/validate-brief/{/validate-brief/!d;}' \
      -e '/fact-gate/Id' -e '/FACT-GATE/Id' -e '/claims extracted/Id' \
      -e '/assembly-gate/Id' -e '/ASSEMBLY-GATE/Id' \
      -e '/truth file:/Id' -e '/ledger:/Id'
}
mode="${1:-check}"; mkdir -p "$SNAP_DIR"
if [ "$mode" = "snapshot" ]; then
  n=0; for b in "${CORPUS[@]}"; do [ -f "$b" ] || continue
    $RUN "$b" 2>&1 | norm > "$SNAP_DIR/$(basename "$b" .md).txt"; n=$((n+1)); done
  echo "snapshot written: $n briefs -> $SNAP_DIR/"; exit 0
fi
shopt -s nullglob; snaps=("$SNAP_DIR"/*.txt)
[ ${#snaps[@]} -gt 0 ] || { echo "no snapshots; run snapshot first"; exit 2; }
fail=0; pass=0
for snap in "${snaps[@]}"; do
  brief="daily-briefs/$(basename "$snap" .txt).md"
  [ -f "$brief" ] || { echo "missing $brief (skip)"; continue; }
  if diff -q <($RUN "$brief" 2>&1 | norm) "$snap" >/dev/null; then pass=$((pass+1))
  else fail=$((fail+1)); echo "DRIFT: $(basename "$snap" .txt)"; diff <($RUN "$brief" 2>&1 | norm) "$snap" | head -14; fi
done
echo "---"
if [ "$fail" -eq 0 ]; then echo "GOLDEN-MASTER CLEAN: $pass/$pass match baseline"
else echo "GOLDEN-MASTER DRIFT: $fail changed, $pass unchanged"; exit 1; fi
