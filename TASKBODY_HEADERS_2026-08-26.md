# Task-body headers — paste-ready (2026-08-26)

RULE: a scheduled task shows its description ONLY if the file's FIRST line is `---`.
Anything above it (an HTML comment, a `##` heading) hides the whole block.
Replace ONLY the header lines at the top of each task body. Never touch the body.

## brief-draft — replace lines 1-2 (`## name: brief-draft` + `description: ...`) with:

---
name: brief-draft
description: Generate the full v1 daily brief. Imports the four component pre-drafts (Take, Signal, Discovery, C&C) via the ground-truth manifest — it does not author them. Novelty rewrite handled downstream by brief-quality-gate.
---

## brief-light — delete the leading `<!-- REPLACEMENT ... -->` block so the file starts with:

---
name: brief-light
description: Generate Brief Light — compressed two-tier version of the full brief from the edited v2 draft (4-5 deep stories + THE LINE breadth tier; every full-brief story appears). CLAIM-FIRST is mandatory: every unit's claim and so_what are written BEFORE the unit is drafted. A blind read-back loop runs before publish. CRAFT STANDARD: system/Craft_Standard.md is MANDATORY reading. FRESHNESS MANDATE: no 4+ word overlap with yesterday's Markets Minute.
---

## Verify
Card shows the description text = parsed. Card blank = still broken.
