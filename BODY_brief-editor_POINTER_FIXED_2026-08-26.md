---
name: brief-editor
description: 22-check editorial QA on v1.5 (quality gate output). Novelty and craft already handled upstream. Gate 15's prose reads are REPLACED by the blind read-back loop, which runs after Gate 16 and before handoff to the Critic. Falls back to v1 + self-heal if v1.5 missing.
---

Read /Users/jackson/Desktop/mental-models-observatory/system/task-bodies/brief-editor/SKILL.md
and execute it exactly as written. If that file is missing or unreadable, do
NOT stop the pipeline: email the PIPELINE ALARM per the canary rule, then
edit tonight's draft using system/Section_Generator_Core.md and
system/Craft_Standard.md directly as your spec — the brief always ships.
