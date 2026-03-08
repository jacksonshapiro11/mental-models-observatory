---
name: System Updater
description: "Apply approved changes to the Daily Brief's persistent documents — Worldview, Thesis Tracker, and Quality Tracker. Handles all document maintenance: logging evidence, updating confidence, recording predictions, tracking Watchlist history, maintaining rotation logs (Take, Deep Read, Inner Game, Discovery, Model), appending Quality Tracker entries, managing Big Stories and Tomorrow's Headlines lifecycle, and running weekly reviews. Reader must approve changes first. WHEN TO USE: when the reader says 'update the worldview', 'log this', 'apply changes', 'approve these updates', after reviewing proposed changes from the brief, after Brief Critic generates a Quality Tracker entry, during weekly reviews. WHEN NOT TO USE: for generating content (use upstream skills), for QA (use Brief Editor, Brief Critic), for proposing changes (those come from the brief via Brief Writer)."
---

# System Updater

Maintain the persistent memory. The reader controls what enters the permanent record.

## Project files this skill modifies

- **Worldview** (`Current_Worldview_v5.md`) — regime, theses, Big Stories, Tomorrow's Headlines, Frameworks Library
- **Thesis Tracker** (`Thesis_Tracker.md`) — evidence logs, predictions, Watchlist history, all rotation logs, Market Intuition, performance summary
- **Quality Tracker** (`Quality_Tracker_final.md`) — daily Critic entries, weekly dashboard

## Update procedures

### Worldview
- Regime: update paragraph + date
- Thesis confidence: update label + raise/lower conditions + log reasoning in Tracker simultaneously
- Big Stories: update current state + date. Add new (next number). Resolve (move to Resolved with outcome).
- Tomorrow's Headlines: update description, add new, or promote to Big Story ("Materialized → BS #N")
- Frameworks Library: name + date + 2-3 sentence description + application
- "What Changed Today": dated one-line-per-change summary

### Thesis Tracker
- Evidence: `| Date | Evidence | Impact (Established/Strengthened/Weakened/Neutral) |`
- Predictions: new with check date, or resolve with outcome (Right/Wrong/Partial)
- Watchlist History: `| Date | Asset | Price at flag | Thesis expression | Current | Status |`
- Take Log: `| Date | Topic | Framework | Key insight |`
- Deep Read Log: `| Date | Source + Title | Format | Connected to |`
- Inner Game Log: `| Date | Tradition | Theme | Action | Connected to prior? |`
- Discovery Log: `| Date | Finding | Domain | Key reframe | Connected later? |`
- Market Intuition: asset patterns, regime observations, key levels
- Performance Summary: update all counts

### Quality Tracker
- Daily: append full Critic entry
- Weekly (Sundays): verdicts tally, section leaderboard, error frequency, patterns, narrative

## Rules

1. **Confirm approval.** Reader must explicitly approve.
2. Check for conflicts with existing entries
3. Preserve structure — add within, don't reorganize
4. Date everything
5. Cross-reference: Worldview change → Tracker should reflect evidence too

## Weekly review

**Quality Tracker:** Which sections consistently Essential/Skippable? Recurring errors? Verdict trend?
**Thesis Tracker:** Most evidence? Stalled 2+ weeks? Predictions due? Watchlist outcomes? Take gaps? Greenshoots strengthening?
**Meta:** Getting better at predicting, or just at writing?
