# Mental Models Observatory — Project Rules

## OPERATING DOCTRINE — how every session thinks (MANDATORY, all models, all tasks, chats included)

**Read `system/Operating_Doctrine.md` before any non-trivial work.** Six moves, in order, each bound to an artifact (Jackson, 2026-07-06: "we need more breadth and depth of thinking... wired in consistently"):

1. **ORIENT** — load EVERY manifest doc for your task type, not one or two files. You have not oriented until you can name the enforcement chain your work touches.
2. **TRACE** — grep the rule/behavior across `system/`, `scripts/`, `lib/`; list every layer it lives in BEFORE touching any. A fix applied to fewer layers than the rule inhabits is a scheduled regression.
3. **DIAGNOSE** — root cause with receipts: fetch the actual artifact (script, gate output, price, page the user saw), never conclude from a log line. Classify bug vs drift vs policy — their fixes differ. Re-verify any stored fact as of NOW ("existence is not currency" — the STRC lesson).
4. **BUILD** — every layer in one pass; every new rule ships WITH its mechanical check (a prose-only rule is unenforced); the simplest thing that closes the WHOLE hole.
5. **VERIFY** — both directions: prove the fix bites on the real failure case AND stays silent on healthy cases; verify output contracts on disk before any SUCCESS line.
6. **LOG** — changelog/calibration entry with the worked failure, so the next session inherits the lesson instead of re-learning it.

Tempo: depth ≠ slowness. Batch reads, parallelize searches, keep the time budget — time-box research, never comprehension. Don't stop at the first plausible answer; check it against a third fact first. This applies to interactive chats exactly as much as scheduled tasks: think through the system WITH Jackson before building, and never ship a conclusion without its receipt.

## Execution Mode: CONTINUOUS (automated tasks)

All automated and scheduled tasks in this project are continuous and autonomous. Do NOT pause between tool calls waiting for user input. Chain all research, writing, and file operations in a single uninterrupted execution pass. If a tool call returns results, immediately process them and make the next call. The only acceptable stopping point is task completion (file saved) or an unrecoverable error.

Specific rules:
- **Batch independent searches together.** If you need market data for equities, crypto, and commodities, send all three searches in one message. Do not search iteratively when searches are independent.
- **Do not ask clarifying questions during scheduled tasks.** Make reasonable choices and keep moving.
- **Set an internal time budget.** If research is taking more than 5 tool-call rounds, stop researching and write with what you have. Approximately right beats exactly stalled.
- **Never treat a tool result as a stopping point.** Every tool result is an intermediate input to the next action. Process it and continue immediately.
- **Collapse phases when possible.** Read multiple files in parallel. Search multiple queries in parallel. Write the full output in one pass rather than section by section.

This applies to all automated tasks: scheduled brief generation, intelligence sweeps, editing passes, system updates. For interactive work with Jackson, default to momentum over pausing, but the global CLAUDE.md preferences apply — ask if genuinely unsure on consequential decisions.

## How This System Works (read this first)

This is a daily financial intelligence brief with a fully automated editorial pipeline. Before doing anything, understand the architecture:

- `system/ARCHITECTURE.md` — File map and system structure overview
- `system/Pipeline_Controller.md` — Chief of Staff. Orchestrates everything. Start here to understand what runs when.
- `system/Operating_Doctrine.md` — HOW every session thinks. The six moves above, with artifact bindings and worked failures.
- `system/Workflow_v3.md` — The operational sequence: intelligence → ideas → architecture → writing → editing → critique → publish
- `system/Editorial_Bible_v11.md` — Voice, section definitions, routing rules
- `system/System_Change_Guide.md` — **Read this before making ANY change to the brief, audio, or editorial pipeline.** Maps the full enforcement chain so every fix propagates to all layers in one pass.

The brief is produced by a chain: Architect → Writer → Validator → Editor → Critic. Most rules are enforced at multiple layers. The audio pipeline (`lib/audio/text-preprocessor.ts` + `app/api/audio/generate/route.ts`) is separate and has its own enforcement. When Jackson asks to change something, trace the full chain before touching any file.

---

## Standing Rulings (Jackson, 2026-07-10 — every session, every task)

1. **THE FOUR-PART TEST:** every sentence of content — **TRUE** (verified: number AND asset AND window; truth is disqualifying — a lie is unpublishable regardless of craft) → **IMPORTANT** → **WELL-EXPLAINED** → **NOVEL**. Canon: `system/Ceiling_Doctrine.md` §0.
2. **THE STRUCTURE IS FROZEN:** sections, order, rhythm are fixed. All improvement effort = content quality within the structure. Structural proposals only when Jackson explicitly opens the question.
3. **The Intro Summary is the payoff** — written LAST from the finished sections, placed first (regime + MECHANISM/TENSION conclusion + watch). No threading; no `<!-- throughline -->` markers.
4. **Nothing critical publishes unverified:** the Morning Truth Gate (`fact-gate --require-resolved` + `{date}-truth.json`) blocks publish; Critic `UNRESOLVED-FACT:` lines must be resolved before the reader sees them.

## System Document Manifest

The `system/` directory contains the editorial pipeline, intelligence infrastructure, and operational docs. These are the routing-critical documents — load based on what you're doing.

### Pipeline Operations (load for any brief-related work)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| Pipeline_Controller.md | Master orchestrator — date computation, pipeline state, self-healing | Starting any scheduled task, diagnosing failures, "is this working?" |
| Operating_Doctrine.md | The six-move working method, artifact-bound | Any non-trivial work, scheduled or interactive |
| Workflow_v3.md | Operational sequence and stage definitions | Understanding stage order, debugging pipeline flow |
| Editorial_Bible_v11.md | Voice, section definitions, formatting, routing rules | Writing, editing, or reviewing brief content |
| Brief_Architect.md | Section architecture, structure decisions | Architecting a brief |
| Brief_Writer.md | Writing instructions, voice application | Writing brief sections |
| Brief_Validator.md | Validation checks between writing and editing | QA before editor pass |
| Brief_Editor.md | Editing standards, transition quality | Editing a brief |
| Brief_Critic.md | Independent quality assessment criteria | Critic pass |
| Ceiling_Doctrine.md | **§0: THE FOUR-PART TEST (true → important → well-explained → novel; truth disqualifying) + THE STRUCTURE FREEZE — Jackson's standing rulings, 2026-07-10.** Payoff intro, fixed Must-Read conjunction, dual bar, proxy discipline | ANY content-quality, improvement, or editorial-rule work |
| Change_Record_2026-07-10.md | Full record of the v0.5 rollout + truth incident + hardening | Understanding why today's rules exist; any change touching payoff/truth/ceiling layers |

### Intelligence & Research (load for intel gathering)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| SOURCE_NETWORK.md | All intelligence sources, access methods, quality ratings | Intelligence sweeps, source health checks |
| Intelligence_Processor.md | How to process raw intelligence into usable intel | Processing gathered intelligence |
| Intelligence_Synthesizer.md | How to synthesize processed intel into brief inputs | Building brief from intel |
| Current_Worldview_v5.md | Current macro/market worldview that frames all analysis | Any analytical or editorial work |
| Market_Data_Collector.md | Market data sources and collection methods | Gathering market data |

### Content Generators (load for specific brief sections)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| Markets_Macro_Generator.md | Markets & macro section generation | Writing markets section |
| Companies_Crypto_Generator.md | Companies & crypto section generation | Writing companies section |
| Geopolitics_Generator.md | Geopolitics section generation | Writing geopolitics section |
| AI_Tech_Generator.md | AI & tech section generation | Writing AI section |
| Inner_Game_Generator.md | Inner game / mental models section | Writing inner game section |
| Discovery_Generator.md | Discovery section generation | Writing discovery section |
| Wild_Card_Generator.md | Wild card section generation | Writing wild card section |
| Asset_Spotlight_Generator.md | Asset spotlight generation | Writing asset spotlight |
| Take_Generator.md | Hot take / thesis generation | Writing takes |
| Signal_Generator.md | Signal detection and scoring | Signal identification |
| Weekly_Generator.md | The Weekly (Sunday zoom-out) full issue | Drafting or reviewing the Weekly |
| Weekly_Light_Generator.md | The Weekly's super brief | Drafting or reviewing the weekly light |
| Weekly_Predictions_Generator.md | Isolated Saturday predictions pre-draft (chains, consensus & edge, expressions) | Predictions pre-draft, grading, alpha marks |

### Predictions & Alpha (load for any predictions work)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| Weekly_Predictions_Ledger.md | Append-only book of every call, graded | Making, grading, or rechecking calls |
| Prediction_Calibration_Log.md | Miss autopsies, standing lessons, confidence buckets | Before making any call (Q8); after grading |
| Prediction_Alpha_Ledger.md | Paper track record vs SPY — the 3%-alpha scoreboard | Opening/closing expressions, weekly marks |

### System Change & Improvement (load for fixes and upgrades)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| System_Change_Guide.md | Full enforcement chain mapping for propagating changes | ANY change to brief, audio, or pipeline |
| Daily_Update_Guide.md | Feedback classification, file mapping, change log | Processing Jackson's feedback about briefs |
| Quality_Tracker_final.md | Quality scores and trends | Quality reviews, trend analysis |
| Root_Cause_Library.md | Categorized failure patterns and fixes | Debugging quality issues |
| Accountability_Cycle.md | Meta feedback loop — proves the system is improving, behavior verification | Weekly reviews, stalled quality, recurring issues despite fixes |
| Improvement_Ledger.md | Single source of truth — every improvement + escalation as a machine-verified row (`scripts/verify-improvements.ts`) | Every 10:03 improve-and-apply session; evening ledger context-load; Sunday accountability |
| Apply_Improvements.md | The 10:03 atomic improve-and-apply executor spec (analyze → apply → ledger → verify) | Running or debugging the improve-and-apply session |

### Distribution & Growth (load for publishing and outreach)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| X_Post_Generator.md | X/Twitter post generation from brief content | Creating social posts |
| X_Distribution_Pipeline.md | Distribution workflow and scheduling | Planning distribution |
| Brief_Email.md | Email distribution of briefs | Email-related work |
| Audio_Pipeline.md | TTS pipeline, voice settings, preprocessing | Audio generation or fixes |
| Substack_Distribution.md | Daily Substack auto-publish of the super brief (GH Action + unofficial API; draft/publish modes) | Substack work, publish failures, distribution changes |

### Strategic (load for planning and system design)

| Document | Purpose | Load when... |
|----------|---------|-------------|
| SYSTEM_OVERVIEW.md | High-level system architecture | Orientation, onboarding, major redesigns |
| Complexity_Map.md | Where complexity lives in the system | Architectural decisions |
| Model_Library.md | Mental models used in analysis | Content ideation, model application |
| Portfolio_Idea_Universe_v2.md | Investment idea universe and tracking | Portfolio-related content |
| Thesis_Tracker.md | Active theses and their status | Thesis validation, accountability |
| World_Briefing_Book.md | Longer-form geopolitical/macro reference | Deep analytical work |

---

## Git Commit Policy

Three categories — know which one you're touching:

### 1. Published content (commit freely)
- `content/daily-updates/` — Final daily briefs
- `public/audio/` — Published audio files

### 2. Website & app code (commit freely)
- `app/` — Next.js routes, API endpoints, pages
- `components/` — React components
- `lib/` — Parsers, audio pipeline, utilities
- `scripts/` — Build/test scripts
- `public/` — Images, podcast cover, static assets
- Config files — `package.json`, `tsconfig.json`, `next.config.*`, `.gitignore`, `tailwind.config.*`

### 3. Internal — NEVER commit
- `system/` — All operational files
- `daily-briefs/` — Draft versions, critic passes, editor logs
- `daily-intelligence/` — Raw intelligence gathering
- `skills/` — Synced skill copies
- `.claude/skills/` — Claude skill files

**The process is the secret sauce. The code that renders the product is not — it ships.**

When running `git add`, always add specific files by path — never `git add -A` or `git add .`. Decision rule: "Does this reveal how the brief is *produced*?" → don't commit. "Does this reveal how the brief is *rendered*?" → commit it.

## Daily Updates & Feedback

**When Jackson sends feedback about the brief or audio: IMMEDIATELY read `system/Daily_Update_Guide.md`.** It classifies every type of feedback, maps it to the right file(s), documents the current audio architecture, and includes a change log of recent fixes.

## System Change Protocol

**When Jackson asks to fix, change, or improve anything about the brief, audio, or editorial pipeline: IMMEDIATELY read `system/System_Change_Guide.md` before making any changes.** Maps the full enforcement chain so every change propagates to all layers in one pass. Do not make partial fixes.

---

## Improvement Loop — Reality Check

A scheduled improvement is NOT done until, in order: (1) a `system/Improvement_Ledger.md` row exists with target files + a named mechanical check; (2) the check is implemented — `scripts/`/`lib/` for Critical/High, or an Editor REJECT gate with a binary procedure for RC1; (3) `scripts/verify-improvements.ts` exits 0 including the new row (it proves the check passes AND nothing prior regressed). "Applied ✅" without gate output is theater — proof is the exit code.

- **10:03 AM `daily-improvement` is the ONE atomic improve-and-apply session** (analyze → prescribe with the acceptance gate → apply → ledger → verify). `apply-brief-improvements` (1:02 PM) is RETIRED (disabled 2026-07-06).
- **Interactive fixes** (Jackson's feedback, via `Daily_Update_Guide.md`) are a valid — currently the highest-closure — fast path: they log to the SAME ledger (an IMP row + `verify-improvements.ts`), same accountability.
- **The evening brief chain does not re-analyze** — `brief-draft` reads the ledger (rows applied in the last 7 days) for context only.
- **`pipeline-health-check` runs `verify-improvements.ts` daily** — warn-only (never blocks the brief); a red run outranks every green narrative in the same report.
- The `skills/` mirror is dead (2026-06-12); never sync it.

---

## Changelog

| Date | Change | SF Code | Reason |
|------|--------|---------|--------|
| 2026-07-24 | v2.4 — Substack distribution leg: manifest row + `system/Substack_Distribution.md` | — | Jackson: daily super brief auto-publishes to Substack (title = thesis headline, Spotify show + full-brief links, draft-first rollout). Script on main; workflow file pending PAT Workflows permission. |
| 2026-07-10 | v2.3 — Standing Rulings block (four-part test, structure freeze, payoff intro, morning truth gate) + manifest rows for Ceiling_Doctrine.md and Change_Record_2026-07-10.md | — | Jackson's rulings after the 07-10 truth incident ("abject lies… terrifies me") and the v0.5 rollout; every fresh session must inherit them without archaeology. |
| 2026-07-06 | v2.2 — Improvement-loop spine wired into CLAUDE.md: Reality Check block + manifest rows for Improvement_Ledger.md and Apply_Improvements.md | — | Interactive sessions were not inheriting the ledger/verify discipline (memo item #10). Now a fresh chat orients to the atomic 10:03 session, the ledger, and warn-only health-check verify. |
| 2026-07-06 | v2.1 — Operating Doctrine wired in (top section + manifest rows for Doctrine, Weekly generators, Predictions & Alpha docs) | — | Jackson: sessions (scheduled AND chats) need consistent breadth/depth — six moves, artifact-bound. Doctrine also lives at the top of Pipeline_Controller. |
| 2026-05-22 | v2.0 — Restructured for Claude Code scaffold | — | Added System Document Manifest. Scoped continuous execution mode to automated tasks. Original content preserved. |

---

## CARRY + TREE (added 2026-08-10, FINAL WORK ORDER)

**CARRY (item 3):** At session start, read `system/CARRY.md`; execute or explicitly park every OPEN item before taking new work. Items leave CARRY.md only by receipt or owner kill; anything discovered mid-task becomes one line there, not a new thread.

**TREE (item 1) — REVISED 2026-08-14 (IMP-174).** Every nightly pipeline-status file must include the output of **`npx tsx scripts/tree-status.ts`** under a `TREE` header. If it exits non-zero, the file's first line is `RED: UNCOMMITTED WORK`.

**Do NOT use bare `git status --porcelain` for this.** It reads a WORKING TREE and the rule draws a conclusion about a REMOTE, and those are different questions. `publish.py` pushes through the GitHub REST API and creates **no local commit**, so the local HEAD sits permanently behind `origin/main` and `git status` reports published-and-live reader-facing briefs as untracked **forever**. On the night of 2026-08-13 four consecutive tasks escalated "three nights of PUBLISHED content exist ONLY in this working tree" for 08-11/12/13; all six files were live on `origin/main` the whole time, and the 08-14 Critic called the resulting RED "the largest single risk in the repository tonight." A rule that manufactures a RED every night does not raise the alarm — it teaches the next session to skim it.

`tree-status.ts` asks the question the rule meant: **is this content safe somewhere canonical?** It classifies each dirty path as `PUBLISHED-LIVE` (on origin/main and identical once internal comments are stripped), `PUBLISHED-DIVERGED` (on origin/main but the bytes differ — the truncated-publish case that existence checks pass green), `PUBLISHED-ABSENT` (reader-facing and NOT on the remote — the real alarm), `COMMITTED-AT-HEAD` (content is in a commit; only the index is stale), `INTERNAL-BY-POLICY` (`system/`, `daily-briefs/`, `daily-intelligence/` — dirt here is the git policy working), or `UNCOMMITTED-CODE`. Only the last three RED verdicts exit non-zero. Canonical state lives in commits **for code** and on `origin/main` **for published content** — never in a working tree, and never in the index.
