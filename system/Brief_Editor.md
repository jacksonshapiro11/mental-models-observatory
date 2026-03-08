---
name: Brief Editor
description: "Run the full 22-check editorial QA pass on a Daily Brief draft. Covers price verification (using Market Data Collector verification rules), contamination checks, routing enforcement, Take novelty, Watchlist freshness, anchor links, reader continuity, framework summaries, compounding language, rotation checks, section completeness, subsection breadth, missed stories (using Source Network Scanner for domain checks), hierarchy, readability/voice, and cross-domain connections. Outputs improved brief (v2) with inline [EDITOR:] markers. WHEN TO USE: when 'run the editor' is invoked after Brief Writer produces v1, when checking specific sections, when v2→v3 revision needed. WHEN NOT TO USE: for generating content (use upstream skills + Brief Writer), for overall evaluation (use Brief Critic), for document updates (use System Updater), for morning updates (use Morning Updater)."
---

# Brief Editor

Senior editor pass. 22 checks. Fix every error directly in the output.

## Project files

- **Editor v2** (`Editor_v2.md`) — the complete editor system with all 22 checks detailed. **Read this for full check specifications.**
- **Thesis Tracker** (`Thesis_Tracker.md`) — needed for checks 3-9, 11-13 (Take Log, Watchlist History, rotation logs, active theses)
- **Editorial Bible** (`Editorial_Bible_v8.md`) — voice, structure, routing rules
- **Source Network** (`references/SOURCE_NETWORK.md`) — for Check 18 (missed stories), checking against source domains

## Related skills

- **Market Data Collector** (`Market_Data_Collector.md`) — Check 1 uses its verification rules (🔴 >2%, 🟡 0.5-2%, ✅ <0.5%)
- **Source Network Scanner** (`Source_Network_Scanner.md`) — Check 18 (missed stories) uses its domain scan approach to verify comprehensive coverage

## 22 checks in sequence

### Part A — Non-Negotiable QA (1-17)

1. **Price verification** — web search every number per Market Data Collector verification rules
2. **Inner Game contamination** — zero market content. Wellness publication test.
3. **Routing enforcement** — Big Story in Six = one-line pointer only. TH evidence = pointer. Theme in 3+ sections = 🔴.
4. **Take novelty** — not in last 3 Take Log entries. Teaching framework, not reporting. Summary present.
5. **Watchlist freshness** — all new today. Each has thesis tag + data signal. Full format.
6. **Anchor links** — all internal links work. Orientation, Big Story pointers, TH pointers.
7. **Reader continuity** — no re-explaining. "Strengthened/weakened" language.
8. **Framework summaries** — every named framework has 1-2 sentence parenthetical.
9. **Compounding language** — references prior Takes, thesis evolution, prediction outcomes.
10. **Deep Read diversity** — 3 recs. Topic/length/format/connection diversity. No repeats from log. **URLs included.**
11. **Inner Game rotation** — different tradition + theme from recent log.
12. **Discovery domain** — different from recent log.
13. **Model format** — verbatim from observatory, correct slug, different domain.
14. **Section completeness** — all required sections present.
15. **Discovery contamination** — Science Magazine Test.
16. **Life Note contamination** — no market content, investing metaphors, fortune cookie.
17. **Six subsection breadth** — each domain covers breadth. 3+ bullets same topic = 🔴.

### Part B — Editorial Read (18-22)

18. **Missed stories** — web search across domains (informed by Source Network Scanner approach). Source network gaps?
19. **Story hierarchy** — Take on right topic? TLDR captures lead? Six ordered by significance?
20. **Readability and voice** — kill dead prose, compress, add POV, add second-order insight.
21. **Cross-domain connections** — at least one present. Obvious missing ones?
22. **Accumulation** — Big Stories reference history? Take builds on prior? Watchlist evolving?

## Output

1. **Change log** — 🔴 critical / 🟡 editorial / 📝 notes / ✅ clean
2. **Editorial notes** — summary of all dimensions
3. **Improved brief (v2)** — full brief with ALL fixes applied, every change marked `[EDITOR: description]`

Full specifications: see `Editor_v2.md`.
