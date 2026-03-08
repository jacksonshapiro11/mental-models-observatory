# Daily Brief Automation — Deployment Playbook

**Last Updated:** March 8, 2026
**Owner:** Jackson Shapiro
**System:** Cowork Scheduled Tasks on Dell Laptop (Windows)

---

## Overview

This playbook documents the complete Daily Brief automation pipeline—12 scheduled tasks running 24/7 on a Windows Dell laptop via Cowork. The pipeline:

1. **Scans intelligence sources 6x daily** (8 AM → 6 PM ET) via web search, collecting market data, crypto prices, AI news, geopolitics, and thesis-driven insights
2. **Synthesizes intelligence** (6:30 PM) into a structured brief draft (v1)
3. **Edits for quality** (7:30 PM) via 22-point editorial checklist (v2)
4. **Evaluates critically** (8:30 PM) from skeptical perspective
5. **Emails Jackson** (9:00 PM) with v2 brief and critic verdict for review
6. **Processes feedback** (midnight) from Jackson's reply, applies changes to brief and living documents
7. **Morning refresh** (5 AM) with overnight scan, high-bar materiality check, and publication to GitHub

The system maintains living documents (Editorial Bible, Current Worldview, Thesis Tracker, Source Network, Quality Tracker) that guide daily work and improve over time.

---

## Prerequisites

### Hardware & OS
- **Dell laptop** with Windows 10/11, 24/7 power (or sleep schedule that preserves network)
- **RAM:** 16 GB+ recommended (Claude sessions run in-memory via Cowork)
- **Disk:** 50 GB free (for daily files, caches, git repos)

### Software Installation
1. **Cowork** (Anthropic's local automation tool) installed and running
2. **Git** installed (for GitHub publishing)
3. **Python 3.8+** installed (for publish.py script)

### Credentials & Environment
1. **Gmail authentication**
   - Cowork must have access to `cosmictrex11@gmail.com`
   - Enable "Less secure app access" or use OAuth with Cowork

2. **GitHub token**
   - Set environment variable: `GITHUB_TOKEN=ghp_xxxx...`
   - Token needs `repo` scope (read/write to `cosmictrex.com` repo or equivalent)

3. **Optional: Audio/snapshot credentials**
   - If using voice notes: `SNAPSHOT_SECRET` for any audio API
   - Not required for text-based tasks

### Power Management
- **AC power:** Laptop plugged in 24/7
- **Sleep settings:** Set display sleep to 30 min, system sleep to NEVER (or wake-on-schedule)
- **Network:** WiFi/Ethernet always connected
- **Clock sync:** Windows system clock synchronized via NTP (set to Eastern Time)

---

## Directory Structure

```
workspace/
├── system/
│   ├── Editorial_Bible_v9.md          # Brand voice, structure, quality rules
│   ├── Current_Worldview_v5.md        # Active theses, Big Stories, Headlines
│   ├── Thesis_Tracker.md              # Thesis tracking, rotation logs, predictions
│   ├── SOURCE_NETWORK.md              # Source patterns, domain strategy
│   ├── Quality_Tracker_final.md       # Historical quality metrics, patterns
│   ├── Market_Data_Collector.md       # Skill: market data gathering
│   ├── Source_Network_Scanner.md      # Skill: source scanning instructions
│   ├── Intelligence_Synthesizer.md    # Skill: 4-lens analytical framework
│   ├── Idea_Developer.md              # Skill: take/discovery/watchlist format
│   ├── Brief_Writer.md                # Skill: brief generation per Editorial Bible
│   ├── Brief_Editor.md                # Skill: 22-check editorial QA
│   ├── Brief_Critic.md                # Skill: skeptical evaluation framework
│   ├── Morning_Updater.md             # Skill: overnight scan, materiality check
│   └── System_Updater.md              # Skill: living document maintenance
│
├── daily-intelligence/
│   ├── 2026-03-02-intelligence.md     # Accumulated findings, 1 file per day
│   ├── 2026-03-03-intelligence.md     # Added to throughout the day (6 sweeps)
│   └── ...
│
├── daily-briefs/
│   ├── 2026-03-02-v1.md               # First draft (6:30 PM)
│   ├── 2026-03-02-v2.md               # Editor pass (7:30 PM)
│   ├── 2026-03-02-critic.md           # Critic evaluation (8:30 PM)
│   ├── 2026-03-02-email-thread.txt    # Gmail thread ID for feedback lookup
│   ├── 2026-03-02-final.md            # After feedback applied (midnight)
│   └── ...
│
├── content/
│   └── daily-updates/
│       ├── 2026-03-02.md              # Final published brief
│       └── ...
│
└── .claude/skills/
    └── publish-brief/
        ├── scripts/
        │   └── publish.py             # Pushes brief to GitHub
        └── publish-brief.md           # Skill doc (if needed)
```

---

## System Files Reference

| File | Purpose | Maintained By | Update Frequency |
|------|---------|---|---|
| **Editorial_Bible_v9.md** | Voice, structure, format rules, quality standards | Jackson (manual) | Quarterly or as needed |
| **Current_Worldview_v5.md** | Active theses (1-10), Big Stories (A-E), Tomorrow's Headlines | Jackson + System (feedback task) | Daily (brief-feedback task) |
| **Thesis_Tracker.md** | Thesis rotation log, coverage tracking, outstanding predictions, quality scores | Jackson + System (feedback task) | Daily |
| **SOURCE_NETWORK.md** | Domain strategy, search patterns, source tiers, exclusions | Jackson (manual) | Monthly |
| **Quality_Tracker_final.md** | Historical metrics, brief ratings, pattern analysis | System (critic & feedback tasks) | Daily |
| **Market_Data_Collector.md** | Instructions for gathering market data (prices, yields, flows) | Jackson (manual) | As markets change |
| **Source_Network_Scanner.md** | Instructions for searching each domain | Jackson (manual) | Monthly |
| **Intelligence_Synthesizer.md** | 4-lens framework (momentum, risks, narratives, edge) | Jackson (manual) | Quarterly |
| **Idea_Developer.md** | Take/Discovery/Inner Game/Deep Reads/Watchlist format | Jackson (manual) | Quarterly |
| **Brief_Writer.md** | Generation instructions per Editorial Bible | Jackson (manual) | Quarterly |
| **Brief_Editor.md** | 22-point checklist: QA (12 checks) + Editorial (10 checks) | Jackson (manual) | Quarterly |
| **Brief_Critic.md** | Evaluation rubric, section ratings, compounding quality | Jackson (manual) | Quarterly |
| **Morning_Updater.md** | Overnight scan scope, materiality bar, dashboard refresh | Jackson (manual) | Quarterly |
| **System_Updater.md** | Guidelines for feedback application, Worldview/Thesis updates | Jackson (manual) | Quarterly |

---

## Scheduled Tasks

### Task 1: intel-sweep-1

**Task ID:** `intel-sweep-1`

**Description:** First intelligence sweep of the day (8:00 AM ET). Scans all domains and begins daily intelligence file.

**Cron Expression:** `0 8 * * 1-5` (8:00 AM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 8:00 AM ET

**Prompt:**

```
You are running the first intelligence sweep of the day for the Daily Brief automation pipeline. Your job is to scan intelligence sources across all domains and begin the accumulated intelligence file for today.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read these files:
- system/Current_Worldview_v5.md (for active theses, Big Stories, Tomorrow's Headlines)
- system/Thesis_Tracker.md (for coverage tracking, outstanding predictions)
- system/SOURCE_NETWORK.md (for domain search patterns and source tiers)

Note the active theses (numbered 1-10), Big Stories (labeled A-E), and key sources to monitor.

STEP 3: Check or create today's intelligence file
Check if daily-intelligence/$TODAY-intelligence.md exists.
- If NOT: Create it with header:
  ```
  # Intelligence Accumulation — $TODAY

  **Sources Covered:** [will list at end]
  **Deep Reads Identified:** [will list at end]
  **Thesis Coverage:** [will note coverage]

  ## Findings

  ```
- If YES: You will append to it in Step 5.

STEP 4: Conduct web searches across all domains
For EACH domain below, perform web searches and collect findings. Use the source patterns from SOURCE_NETWORK.md as a guide. Be systematic.

**MARKETS Domain:**
- Search: "S&P 500 price" (get current price, % change, high/low)
- Search: "Nasdaq composite price" (current price, % change)
- Search: "10-year US treasury yield" (current yield, 52-week range)
- Search: "gold price" (current price, recent trend)
- Search: "US dollar index DXY" (current level)
- Search: "Brent crude oil price" (current price, trend)
- Search: "Byrne Hobart latest" or "Byrne Hobart newsletter" (recent thinking)
- Search: "Lyn Alden latest" or "Lyn Alden newsletter" (recent macro analysis)
- Search: "Luke Gromen latest" or "Luke Gromen" (recent thinking on credit/flows)
- Search: "stock market unusual volume" or "market breadth"

**CRYPTO Domain:**
- Search: "Bitcoin BTC price" (current price, % 24h change)
- Search: "Ethereum ETH price" (current price, % 24h change)
- Search: "Solana SOL price" (current price, % 24h change)
- Search: "crypto fear and greed index" (current level, trend)
- Search: "Bitcoin ETF flows" (recent inflows/outflows, cumulative)
- Search: "Noelle Acheson crypto" (recent analysis)
- Search: "DeFi education news" or "DeFi latest"

**AI/TECH Domain:**
- Search: "Simon Willison latest" or "Simon Willison blog" (recent AI developments)
- Search: "SemiAnalysis latest" or "SemiAnalysis chip news" (semiconductor/AI insights)
- Search: "artificial intelligence news" (major AI developments this week)
- Search: "Latent Space AI podcast" or "Latent Space latest"
- Search: "large language model updates" (GPT, Claude, Llama developments)

**GEOPOLITICS Domain:**
- Search: "Iran latest news" (current situation, tensions)
- Search: "US China relations latest" (recent developments, tensions)
- Search: "Eurasia Group latest" (geopolitical risk assessment)
- Search: "Russia Ukraine war latest" (major developments)
- Search: "Middle East news" (Israel, Saudi, regional tensions)
- Search: "major global conflict" (any escalation/resolution)

**THESIS-DRIVEN Domain:**
For each active thesis in Current_Worldview_v5.md:
- Perform 2-3 targeted web searches for evidence, tracking, or contrary signals
- Example: If thesis is "AI adoption accelerating," search "AI enterprise adoption Q1 2026" or "enterprise AI spending"

STEP 5: Format and append findings
For EACH finding, record in this format in the intelligence file:

```
08:XX ET | [SOURCE NAME] | [FINDING/HEADLINE] | Thesis #N / BS #C | [FLAG]
Details: [2-3 sentence summary of why this matters, context]
URL: [if available]
```

FLAGS:
- `FLAG` = urgent/material (war, major market move, thesis confirmation/contradiction)
- `WATCH` = important but not urgent (developing story, tracking needed)
- `ROUTINE` = normal data (market close, expected update, incremental)

EXAMPLES:
```
08:15 ET | Bloomberg | S&P 500 up 0.8% to 5,847 | BS #D (growth narrative) | ROUTINE
Details: Markets opening strong on positive tech earnings. Breadth strong (82% of S&P up).
URL: https://...

08:22 ET | Byrne Hobart | Credit spreads tightening as Fed signals dovish lean | Thesis #3 (rate cycle inflection) | WATCH
Details: High-yield spreads 285 bps. Potential inflection signal. Watch for signal confirmation.
URL: https://...

08:45 ET | OpenAI | New o1 model released with reasoning improvements | Thesis #7 (AI acceleration) | FLAG
Details: Major AI capability jump. Reorders competitive landscape. Check market response.
URL: https://...
```

STEP 6: Identify Deep Reads
As you scan, note any findings that deserve deep investigation (typically 1-3 per sweep). These are stories with potential significance and complexity. Record at the end of the findings with URLs so the Brief Writer can dig in later.

STEP 7: Return summary
Append a summary section to the intelligence file:
```
## Sweep Summary (08:00 ET)
- Sources scanned: [list domains/sources covered]
- Key findings: [3-5 bullet points of most important items]
- Deep Reads identified: [list with URLs]
- Thesis coverage: [note which theses got coverage]
- Gaps: [any critical sources not available or missing data]
```

Output to the user:
- Confirmation that daily-intelligence/$TODAY-intelligence.md was created/appended
- Count of findings recorded
- Summary of key themes
- Any data gaps or unreachable sources

NOTES:
- All times in Eastern Time (ET) — note the local time as you work
- If a source is unreachable, note it in the "Gaps" section but continue
- Append all findings to the intelligence file — do NOT overwrite
- Be thorough but efficient; you have 2 hours until the next sweep
```

---

### Task 2: intel-sweep-2

**Task ID:** `intel-sweep-2`

**Description:** Second intelligence sweep of the day (10:00 AM ET). Appends to today's intelligence file.

**Cron Expression:** `0 10 * * 1-5` (10:00 AM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 10:00 AM ET

**Prompt:**

```
You are running the second intelligence sweep of the day for the Daily Brief automation pipeline. Your job is to scan intelligence sources and append to today's accumulated intelligence file.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read these files:
- system/Current_Worldview_v5.md (for active theses, Big Stories)
- system/Thesis_Tracker.md (for coverage tracking)
- system/SOURCE_NETWORK.md (for source patterns)

STEP 3: Verify intelligence file exists
Verify daily-intelligence/$TODAY-intelligence.md exists. If it doesn't (system error), create it with the standard header. Otherwise, you will append to it.

STEP 4: Conduct web searches across all domains
Perform the SAME domain searches as intel-sweep-1 (MARKETS, CRYPTO, AI/TECH, GEOPOLITICS, THESIS-DRIVEN), but look for:
- Updated prices/data (markets move 2 hours, crypto updates continuously)
- New stories published since 8 AM
- Continued developments on stories from sweep 1
- Market pre-reaction to corporate earnings/economic data

Use the same search terms and sources, but focus on what's CHANGED since the last sweep.

STEP 5: Format and append findings
Append findings to daily-intelligence/$TODAY-intelligence.md in the same format as sweep 1:

```
10:XX ET | [SOURCE NAME] | [FINDING/HEADLINE] | Thesis #N / BS #C | [FLAG]
Details: [summary]
URL: [if available]
```

Do NOT repeat findings from the 8 AM sweep — only add NEW findings or UPDATES to existing stories.

FLAGS remain: FLAG (urgent), WATCH (tracking), ROUTINE (normal data)

STEP 6: Update Sweep Summary
Update the "## Sweep Summary (10:00 ET)" section in the file with new findings count and key themes from this sweep.

STEP 7: Return summary
Output to the user:
- Confirmation that daily-intelligence/$TODAY-intelligence.md was appended
- Count of NEW findings recorded
- Major themes/updates since 8 AM sweep
- Any significant story developments
- Data gaps or source issues

NOTES:
- All times in Eastern Time (ET)
- Append only — do NOT remove or modify 8 AM findings
- 2-hour window until next sweep; be thorough
```

---

### Task 3: intel-sweep-3

**Task ID:** `intel-sweep-3`

**Description:** Midday intelligence sweep (12:00 PM ET). Appends to today's intelligence file.

**Cron Expression:** `0 12 * * 1-5` (12:00 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 12:00 PM ET

**Prompt:**

```
You are running the third intelligence sweep of the day (midday) for the Daily Brief automation pipeline. Your job is to scan intelligence sources and append to today's accumulated intelligence file.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read:
- system/Current_Worldview_v5.md
- system/Thesis_Tracker.md
- system/SOURCE_NETWORK.md

STEP 3: Verify intelligence file exists
Verify daily-intelligence/$TODAY-intelligence.md exists. If not, create it; otherwise append.

STEP 4: Conduct web searches across all domains
Perform searches in MARKETS, CRYPTO, AI/TECH, GEOPOLITICS, THESIS-DRIVEN domains, focusing on:
- Midday market updates (especially US equity markets at their midpoint)
- Economic data releases (economic calendar: jobless claims, inflation, PMI, etc.)
- Central bank news (Fed, ECB, BoE actions or statements)
- Crypto market movement (intraday swings)
- Earnings reports (if earnings season)
- Geopolitical escalations or resolutions
- Thesis evidence/contradictions

Search more aggressively for ECONOMIC DATA and EARNINGS, as midday is when major data drops.

STEP 5: Format and append findings
Append to daily-intelligence/$TODAY-intelligence.md:

```
12:XX ET | [SOURCE NAME] | [FINDING/HEADLINE] | Thesis #N / BS #C | [FLAG]
Details: [summary]
URL: [if available]
```

Do NOT repeat from 8 AM or 10 AM sweeps.

STEP 6: Update Sweep Summary
Add "## Sweep Summary (12:00 ET)" section with findings count and themes.

STEP 7: Return summary
Output to the user:
- Confirmation appended
- Count of new findings
- Any major economic data or earnings surprises
- Key themes at midday
- Data gaps

NOTES:
- Midday is crucial for economic data releases — prioritize US economic calendar
- All times Eastern Time
- 2-hour window until next sweep
```

---

### Task 4: intel-sweep-4

**Task ID:** `intel-sweep-4`

**Description:** Afternoon intelligence sweep (2:00 PM ET). Appends to today's intelligence file.

**Cron Expression:** `0 14 * * 1-5` (2:00 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 2:00 PM ET

**Prompt:**

```
You are running the fourth intelligence sweep of the day (afternoon) for the Daily Brief automation pipeline. Your job is to scan intelligence sources and append to today's accumulated intelligence file.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read:
- system/Current_Worldview_v5.md
- system/Thesis_Tracker.md
- system/SOURCE_NETWORK.md

STEP 3: Verify intelligence file exists
Verify daily-intelligence/$TODAY-intelligence.md exists. Append to it.

STEP 4: Conduct web searches across all domains
Perform searches in MARKETS, CRYPTO, AI/TECH, GEOPOLITICS, THESIS-DRIVEN, focusing on:
- Afternoon market momentum (US markets in their final 2 hours)
- Market reactions to morning earnings/data
- Fed speakers or central bank commentary
- Crypto afternoon action
- Breaking news from afternoon press cycles
- Geopolitical developments
- Corporate announcements (afternoon is common for news)

At 2 PM, markets are in final afternoon — watch for end-of-day positioning, late-breaking stories, and closing catalysts.

STEP 5: Format and append findings
Append to daily-intelligence/$TODAY-intelligence.md in the same format. Do NOT repeat from earlier sweeps.

STEP 6: Update Sweep Summary
Add "## Sweep Summary (14:00 ET)" section.

STEP 7: Return summary
Output to the user:
- Confirmation appended
- Count of new findings
- Market momentum summary
- Key afternoon stories
- Crypto market action
- Any last-minute developments
- Data gaps

NOTES:
- 2 hours until market close (typically 4 PM ET)
- All times Eastern Time
- Watch for afternoon spike in news volume
```

---

### Task 5: intel-sweep-5

**Task ID:** `intel-sweep-5`

**Description:** Late afternoon intelligence sweep (4:00 PM ET, market close). Appends to today's intelligence file.

**Cron Expression:** `0 16 * * 1-5` (4:00 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 4:00 PM ET

**Prompt:**

```
You are running the fifth intelligence sweep of the day (late afternoon / market close) for the Daily Brief automation pipeline. Your job is to scan intelligence sources and append to today's accumulated intelligence file. Market close data is now available.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read:
- system/Current_Worldview_v5.md
- system/Thesis_Tracker.md
- system/SOURCE_NETWORK.md

STEP 3: Verify intelligence file exists
Verify daily-intelligence/$TODAY-intelligence.md exists. Append to it.

STEP 4: Conduct web searches — MARKET CLOSE FOCUS
At 4 PM ET, US equity markets are CLOSED. Perform searches across all domains with emphasis on:

**MARKETS Domain (COMPLETE DATA NOW AVAILABLE):**
- Search: "S&P 500 close" (get final price, % change, volume, breadth, closing summary)
- Search: "Nasdaq close" (final price, % change, top movers)
- Search: "market close summary" (what drove the day, key stories)
- Search: "30-year Treasury yield" (end-of-day yield, 52-week range)
- Search: "VIX volatility index" (closing level, intraday range)
- Search: "NYSE advance decline" or "market breadth" (proportion of stocks up/down)
- Search: "corporate earnings today" (any late earnings, guidance changes)
- Search: "Fed speakers or announcements"

**CRYPTO Domain (24/7 markets):**
- Search: "Bitcoin price 4pm ET" (current price, daily change)
- Search: "Ethereum price" (current price, daily change)
- Search: "crypto market cap" (total, dominance)
- Search: "crypto volume leaders" (most active coins)

**AI/TECH, GEOPOLITICS, THESIS-DRIVEN:**
- Same searches as previous sweeps, but focus on stories that RESOLVED or clarified during the day
- End-of-day commentary on major themes

STEP 5: Format and append findings
Append findings with market close data. This is the DEFINITIVE market data for the day.

```
16:XX ET | [SOURCE NAME] | [FINDING/HEADLINE] | Thesis #N / BS #C | [FLAG]
Details: [summary]
URL: [if available]
```

STEP 6: Add market close summary
Include a "## Market Close Summary (16:00 ET)" section:
```
### Equity Markets
- S&P 500: XXXXX (+X.X%)
- Nasdaq: XXXXX (+X.X%)
- Breadth: X% up
- Volume: [note if heavy or light]

### Fixed Income
- 10Y Treasury: X.XXX%
- 30Y Treasury: X.XXX%
- HY Spread: XXX bps

### Commodities
- WTI Crude: $XXX
- Gold: $XXXX
- DXY: XXX.XX

### Crypto
- BTC: $XXXXX
- ETH: $XXXXX
- Market Cap: $X.X trillion
```

STEP 7: Update overall sweep summary
Consolidate findings count and themes.

STEP 8: Return summary
Output to the user:
- Confirmation appended
- Final market close summary (S&P, Nasdaq, VIX, Treasuries)
- Count of new findings
- Key market drivers for the day
- Breadth, volume, internals
- Top corporate earnings/news
- Crypto market summary
- Any late-breaking stories
- Data gaps

NOTES:
- This is the COMPLETE market data for the day — it is authoritative
- All times Eastern Time
- 2 hours until final pre-dinner sweep
- Market close data is critical for the brief generator
```

---

### Task 6: intel-sweep-6

**Task ID:** `intel-sweep-6`

**Description:** Final intelligence sweep (6:00 PM ET). After-hours data. Last chance for intelligence before brief generation.

**Cron Expression:** `0 18 * * 1-5` (6:00 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 6:00 PM ET

**Prompt:**

```
You are running the sixth and FINAL intelligence sweep of the day for the Daily Brief automation pipeline. Your job is to scan intelligence sources one last time before the brief generation. Focus on after-hours developments.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read living documents
From the workspace root, read:
- system/Current_Worldview_v5.md
- system/Thesis_Tracker.md
- system/SOURCE_NETWORK.md
- system/Thesis_Tracker.md (check outstanding predictions and coverage gaps)

STEP 3: Verify intelligence file exists
Verify daily-intelligence/$TODAY-intelligence.md exists. This is the FINAL append before brief generation begins at 6:30 PM.

STEP 4: Conduct web searches — AFTER-HOURS & FINAL CHECK
At 6 PM ET, stock markets are closed but global markets are active (Asia, Europe). Perform searches with focus on:

**MARKETS Domain (After-hours focus):**
- Search: "after-hours stock market" (any major after-hours moves, earnings reactions)
- Search: "futures trading" (ES, NQ, YM futures, pre-Asia sentiment)
- Search: "European markets close" (DAX, FTSE, CAC final levels if available in time)
- Search: "Asian markets opening" (Nikkei, Shanghai, Hong Kong early moves)
- Search: "Federal Reserve news" (any statements, minutes, actions released after 4 PM)
- Search: "Treasury market" (late-day moves, longer-term implications)

**CRYPTO Domain:**
- Search: "Bitcoin after-hours price" (6 PM ET price, daily summary)
- Search: "Ethereum price" (current price)
- Search: "blockchain news" (any major protocol updates, exchange news)

**AI/TECH Domain:**
- Search: "tech news after hours" (any late announcements, earnings reactions)
- Search: "AI news today summary" (consolidate day's AI developments)

**GEOPOLITICS Domain:**
- Search: "geopolitics latest" (evening/night developments from Asia, Europe, Middle East)
- Search: "breaking news conflict" (any escalation or peace developments)

**THESIS-DRIVEN Domain:**
- Targeted searches for any UNCOVERED theses (check Thesis_Tracker to see which theses didn't get coverage today)
- This is the LAST CHANCE to gather evidence

STEP 5: Format and append findings
Append to daily-intelligence/$TODAY-intelligence.md:

```
18:XX ET | [SOURCE NAME] | [FINDING/HEADLINE] | Thesis #N / BS #C | [FLAG]
Details: [summary]
URL: [if available]
```

STEP 6: Final sweep summary
Add "## Sweep Summary (18:00 ET - FINAL)" section with:
```
### Coverage Analysis
- All active theses covered? [Y/N, list any gaps]
- All Big Stories tracked? [Y/N]
- Overnight market sentiment: [positive/neutral/negative]
- Key stories emerging for overnight/next day: [list]

### Data Completeness
- Market close data: [COMPLETE]
- Crypto data: [CURRENT as of 6 PM]
- Intelligence file ready for: [brief generation starting 6:30 PM]

### Quality Notes
- Most important finding of day: [1-2 sentences]
- Most uncertain area: [brief note]
- Watch overnight for: [list 2-3 stories to monitor]
```

STEP 7: Final checklist
Verify daily-intelligence/$TODAY-intelligence.md:
- [ ] Has header with today's date
- [ ] Contains findings from all 6 sweeps
- [ ] All findings have timestamps, source, thesis/BS labels, flags
- [ ] All thesis coverage tracked
- [ ] Deep Reads identified with URLs
- [ ] No duplicate findings
- [ ] File ready for Intelligence Synthesizer to read

STEP 8: Return summary
Output to the user:
- Confirmation final sweep completed and appended
- Total findings count across all 6 sweeps
- Coverage completeness (theses, Big Stories)
- Key overnight watch items
- Critical stories for brief
- Any data gaps that couldn't be filled
- Readiness for brief generation

NOTES:
- This is the FINAL intelligence before brief generation
- Brief generation begins in 30 minutes (6:30 PM)
- Quality and completeness matter — brief depends on this
- All times Eastern Time
- Check that no critical theses were left uncovered
```

---

### Task 7: brief-draft

**Task ID:** `brief-draft`

**Description:** Full brief generation. Reads accumulated intelligence, synthesizes, and generates v1 brief per Editorial Bible structure.

**Cron Expression:** `30 18 * * 1-5` (6:30 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 6:30 PM ET

**Prompt:**

```
You are generating the Daily Brief v1 for today. You are responsible for taking 12 hours of accumulated intelligence and synthesizing it into a high-quality, actionable brief per the Editorial Bible structure. This is the first draft; it will be edited and critiqued later.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read all system files (the complete knowledge base)
From the workspace root, read ALL of these files in order:
1. system/Editorial_Bible_v9.md (structure, voice, quality rules, length targets)
2. system/Current_Worldview_v5.md (active theses, Big Stories, Tomorrow's Headlines)
3. system/Thesis_Tracker.md (coverage tracking, rotation log, Take log, Watchlist history)
4. system/SOURCE_NETWORK.md (source strategy, tiers)
5. system/Quality_Tracker_final.md (historical quality metrics, pattern analysis)

Then read the SKILL instructions:
6. system/Market_Data_Collector.md (how to gather market data for the Dashboard)
7. system/Source_Network_Scanner.md (source search patterns)
8. system/Intelligence_Synthesizer.md (4-lens analytical framework)
9. system/Idea_Developer.md (Take, Discovery, Inner Game, Deep Reads, Watchlist, Life Note, Model format)
10. system/Brief_Writer.md (generation instructions)

STEP 3: Read today's intelligence
Read daily-intelligence/$TODAY-intelligence.md completely. This contains 6 sweeps of accumulated intelligence.

STEP 4: Perform final market data collection
The intelligence file has market close data from 4 PM, but it's now 6:30 PM. Perform final web searches to:
- Get any after-hours market updates (Asia opening, Europe close if relevant)
- Confirm crypto prices current as of 6:30 PM
- Check for any late-breaking news (6-6:30 PM window)
- Verify any critical prices for the Dashboard

Search:
- "Bitcoin price 6:30 PM ET"
- "Ethereum price 6:30 PM ET"
- "S&P 500 after-hours" (if relevant)
- "Asian markets opening" (if available)
- "breaking news 6 PM" (any last-minute developments)

STEP 5: Apply Intelligence Synthesizer (4-lens framework)
Using system/Intelligence_Synthesizer.md, analyze the accumulated intelligence through 4 analytical lenses:

**LENS 1: Momentum (trends, flows, positioning)**
- What's accelerating? Decelerating?
- Where are flows (capital, attention, geopolitical)?
- Market positioning clues from the intelligence?
- Consensus vs. contrarian signals?

**LENS 2: Risks & Fragility (what could break, tail risks)**
- What system is fragile or stressed?
- Where are fault lines?
- What's priced in vs. vulnerable to surprise?
- Hidden risks in the intelligence?

**LENS 3: Narratives & Beliefs (stories, memes, what everyone believes)**
- What's the consensus narrative?
- Is there disagreement or bifurcation?
- What narrative is missing or overlooked?
- How do the stories from intelligence fit together?

**LENS 4: Edge & Information Assorters (your unique insight, what others miss)**
- What did TODAY'S intelligence reveal that markets haven't fully priced?
- Where's the asymmetry or mispricing?
- What connection haven't you seen discussed?
- What becomes clearer when you look at the full set of intelligence?

Document your thinking on all 4 lenses — this is the analytical foundation for the Take.

STEP 6: Develop the core ideas
Using system/Idea_Developer.md, develop:

**TAKE (the core insight, 1-2 sentences maximum clarity)**
- What's the most important insight from today's intelligence?
- Why does it matter?
- What should Jackson be aware of?
- Aim for one clear, defensible claim (not consensus)

**DISCOVERY (something interesting/unexpected from intelligence)**
- What did we learn today that's non-obvious?
- Could be market data, geopolitical move, AI development, etc.

**INNER GAME (psychological/emotional dimension)**
- What are markets feeling?
- What are investors wrestling with?
- Where's the anxiety, greed, complacency?

**DEEP READS (complex stories worthy of deeper analysis)**
- Identify 2-3 stories from intelligence that warrant full dives
- Get the URLs from the intelligence file
- Why are these important?

**WATCHLIST (active positions, stories to track, predictions in motion)**
- What from today warrants close monitoring over next days/weeks?
- Any theses getting stronger/weaker?
- Market signals to watch for?
- Include this for Jackson's tracking

**LIFE NOTE (non-financial insight, human/cultural observation)**
- What does today's intelligence suggest about how people are thinking/living?
- Zoomed-out cultural observation

**MODEL (simple framework to think about today's landscape)**
- Is there a simple model or heuristic that makes sense of the intelligence?
- Not complicated—just a clear way to think about it

STEP 7: Structure the brief per Editorial Bible
Using system/Editorial_Bible_v9.md, structure the brief with these sections:

```
# Daily Brief — [DATE]
**Critic Verdict:** [Will be filled by critic; leave blank for v1]

## Dashboard
### Markets
- S&P 500: [close price] ([% change])
- Nasdaq: [close price] ([% change])
- 10Y Treasury: [yield] ([change from open])
- VIX: [level]
- Gold: [price]
- BTC: [price]
- ETH: [price]

### Market Internals
- Breadth: [% up]
- Volume: [ADV comparison]
- Momentum: [brief 1-line assessment]

## The Take
[Your 1-2 sentence core insight with full explanation. Why it matters. What Jackson should watch for.]

## What Happened Today

### Markets
[Narrative summary of today's market action, key moves, drivers]

### Crypto
[Summary of crypto market, major moves, narratives]

### Technology & AI
[Key AI/tech developments, competitive shifts]

### Geopolitics
[Major geopolitical developments, tensions, resolutions]

### Macro & Economics
[Economic data, Fed action, macro implications]

## Tomorrow's Headlines
[Based on Current_Worldview_v5.md, what should Jackson watch for tomorrow?]

## Discovery
[Unexpected finding from today's intelligence. 2-3 sentences.]

## Inner Game
[What are markets feeling? Psychological state of investors and capital? 2-3 sentences.]

## Deep Reads
[2-3 complex stories worthy of deeper analysis]
- **[Story Title]**: [Why it matters + URL]
- **[Story Title]**: [Why it matters + URL]
- **[Story Title]**: [Why it matters + URL]

## Watchlist
[Active monitoring list for Jackson]
- **[Item]**: [Why it matters, what to watch for]
- **[Item]**: [Why it matters, what to watch for]
- **[Item]**: [Why it matters, what to watch for]

## Thesis Tracker Update
[Note progress on active theses]
- Thesis #1: [Evidence from today's intelligence]
- Thesis #2: [Evidence from today's intelligence]
- [etc. for all active theses with relevant coverage]

## Big Stories Tracking
[Track progress on Big Stories A-E]

## Life Note
[Cultural/human observation from today's landscape]

## Model for Today's Landscape
[Simple framework to think about today]
```

STEP 8: Quality checks before saving
Before saving v1, verify:
- [ ] Dashboard has all prices (S&P, Nasdaq, 10Y, VIX, Gold, BTC, ETH)
- [ ] All prices current as of 4-6:30 PM (note any older prices)
- [ ] Take is clear, specific, defensible (not vague)
- [ ] Each section flows from the intelligence
- [ ] All Deep Reads have URLs
- [ ] Thesis coverage included
- [ ] No internal contradictions
- [ ] Voice matches Editorial Bible
- [ ] Length appropriate (~2000-2500 words target)

STEP 9: Save v1 brief
Save to: daily-briefs/$TODAY-v1.md

Include this header:
```
# Daily Brief — [DATE]
**Version:** v1 (Generated 6:30 PM ET)
**Status:** Awaiting editorial review
**Critic Verdict:** [PENDING]
```

STEP 10: Return summary
Output to the user:
- Confirmation that daily-briefs/$TODAY-v1.md was generated
- Word count
- Sections completed
- 4-lens analysis summary (key insights from each lens)
- Take statement
- Top 3 Deep Reads identified
- Major themes in brief
- Readiness for editorial review (starting 7:30 PM)

NOTES:
- This is the FIRST draft — it will be edited and critiqued
- Quality matters — brief is the output of the whole pipeline
- All prices should be as current as possible (4-6:30 PM window)
- Deep Reads are critical — investors use these for deeper work
- Thesis coverage ensures the brief connects to Jackson's ongoing thinking
- Editorial review begins 7:30 PM; expect comments
```

---

### Task 8: brief-editor

**Task ID:** `brief-editor`

**Description:** 22-check editorial QA pass on v1. Generates v2 with detailed change tracking.

**Cron Expression:** `30 19 * * 1-5` (7:30 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 7:30 PM ET

**Prompt:**

```
You are performing the editorial review of today's Daily Brief v1. Your job is to execute the complete 22-point editorial checklist (Part A: Quality Assurance, 12 checks; Part B: Editorial, 10 checks), make corrections, and generate v2 with detailed change tracking.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read all reference documents
From the workspace root, read:
1. system/Brief_Editor.md (the complete 22-point checklist)
2. system/Editorial_Bible_v9.md (brand voice, structure, quality rules)
3. system/Thesis_Tracker.md (rotation logs, Take log, Watchlist history for context)
4. daily-briefs/$TODAY-v1.md (the brief to be edited)

STEP 3: Perform Part A: Quality Assurance (12 checks)
Run through each of these 12 checks systematically:

**CHECK 1: Price Accuracy**
- Verify ALL prices in the Dashboard section
- Web search for: "S&P 500 close today", "Nasdaq close today", "10Y Treasury yield", "VIX close", "Gold price", "BTC price", "ETH price"
- Confirm each price is accurate as of market close (4 PM ET) or as recent as possible
- If any price is wrong, note the correction needed
- [EDITOR: Accurate price data is non-negotiable]

**CHECK 2: Market Narrative Accuracy**
- Verify the market summary against actual market data
- Did the markets actually move in the way described?
- Are the drivers cited (earnings, data, Fed) actually what moved markets today?
- Web search for "market news today" and "market summary" to verify narrative

**CHECK 3: Crypto Accuracy**
- Verify BTC/ETH prices in Dashboard
- Verify any crypto narrative claims
- Web search "Bitcoin news today" and "Ethereum news today"

**CHECK 4: Geopolitics Accuracy**
- Verify any geopolitical claims against current sources
- No outdated information from old intelligence?
- Web search for any major geopolitical claims to confirm

**CHECK 5: Macro/Econ Data Accuracy**
- Any economic data cited (unemployment, inflation, PMI)?
- Verify data is accurate and dated correctly
- Web search to confirm any data releases mentioned

**CHECK 6: Thesis Tracking Accuracy**
- Check Thesis_Tracker.md: has the brief updated thesis progress correctly?
- Do the thesis evidences cited match the thesis statements?
- Are there any contradictions?

**CHECK 7: Deep Reads Validation**
- Every Deep Read should have a URL
- Spot-check 2-3 of the URLs — do they exist and are they relevant?
- Does the summary of the Deep Read match the actual content?

**CHECK 8: Dashboard Completeness**
- S&P 500: price + % change ✓
- Nasdaq: price + % change ✓
- 10Y Treasury: yield + change ✓
- VIX: level ✓
- Gold: price ✓
- BTC: price ✓
- ETH: price ✓
- Are all these present?

**CHECK 9: Take Statement Clarity**
- The Take should be 1-2 sentences maximum
- Is it a clear, specific claim (not vague)?
- Is it defensible based on today's intelligence?
- Does it point to something Jackson should actually care about?
- Or is it too obvious/consensus?

**CHECK 10: Tomorrow's Headlines Relevance**
- Does Tomorrow's Headlines section actually describe what's likely to matter tomorrow?
- Are these predictable from today's intelligence?
- Or are they just obvious/consensus?

**CHECK 11: Internal Consistency**
- Does the brief contradict itself anywhere?
- Do all sections support the Take, or do some undercut it?
- Is the Market narrative consistent with the Macro section?
- Is the Crypto section consistent with the Tech/AI section (any overlap/contradiction)?

**CHECK 12: Tone & Voice**
- Does the brief match Editorial_Bible_v9.md voice?
- Is it appropriately sophisticated for Jackson's audience?
- Any typos, grammar errors, or awkward phrasing?

STEP 4: Document Part A findings
Create a list of corrections needed from Part A checks:
```
## Part A: QA Corrections
1. [Check #, finding, correction needed]
2. [Check #, finding, correction needed]
...
```

STEP 5: Perform Part B: Editorial (10 checks)
Run through each of these 10 editorial checks:

**CHECK 13: Take Strength**
- Is the Take truly insightful, or is it obvious?
- Does it offer an angle Jackson wouldn't see elsewhere?
- Consider: is this a contrarian view, or consensus view?
- Does it drive the rest of the brief?
- [EDITOR: Weak Takes drag down the whole brief]

**CHECK 14: Missed Major Stories**
- Is there a major story from today that didn't make it into the brief?
- Web search for "major news today", "breaking news", "trending topics"
- Check yesterday's intelligence file — did we drop anything important?
- If major story missed: should it be added to the brief?

**CHECK 15: Story Selection Quality**
- Do the stories chosen for the main narrative represent today's most important moves?
- Could a reader criticize the story selection as missing the point?
- Or do the stories told add up to a coherent daily story?

**CHECK 16: Discovery Section Strength**
- Is the Discovery truly non-obvious, or is it just a fact from the intelligence?
- Does it represent something genuinely interesting/unexpected?
- [EDITOR: Discovery should surprise the reader or highlight what they missed]

**CHECK 17: Inner Game Assessment**
- Does the Inner Game section accurately capture market psychology?
- Is it insightful about investor sentiment, positioning, emotion?
- Or is it generic?
- [EDITOR: Inner Game should show understanding of crowd behavior]

**CHECK 18: Deep Reads Selection & Quality**
- Are the Deep Reads truly the most important/complex stories from today?
- Would Jackson actually want to dig into these?
- Are the explanations clear about WHY each one warrants deep reading?
- Do the URLs work and are they relevant?

**CHECK 19: Watchlist Relevance**
- Does the Watchlist represent active tracking items Jackson cares about?
- Are these things that will actually change over coming days/weeks?
- Or are some just noise?
- Are there better things to watch that were missed?

**CHECK 20: Thesis Integration**
- Do the thesis updates reflect real progress, or are they forced/generic?
- Is the brief actually advancing Jackson's thinking on his active theses?
- Or does it feel disconnected from the Thesis_Tracker?

**CHECK 21: Big Stories Tracking**
- Are the Big Stories (A-E) actually progressing, or static?
- Does the brief explain the progression clearly?
- Or are some Big Stories just mentioned without real development?

**CHECK 22: Overall Cohesion & Readability**
- Does the brief hang together as a coherent whole?
- Is there a clear narrative arc?
- Does it feel like a brief Jackson would value reading?
- Or is it fragmented/list-like?
- Is the length appropriate (target ~2000-2500 words)?

STEP 6: Document Part B findings
Create a list of editorial improvements:
```
## Part B: Editorial Improvements
1. [Check #, finding, improvement suggested]
2. [Check #, finding, improvement suggested]
...
```

STEP 7: Apply all corrections
Based on Part A + Part B findings:
1. Fix all price errors and data inaccuracies (Part A priority)
2. Strengthen Take if needed (Check 13)
3. Add any missed major stories (Check 14) or reweight story selection (Check 15)
4. Strengthen Discovery (Check 16)
5. Deepen Inner Game analysis (Check 17)
6. Review Deep Reads (Check 18) — reorder by importance or swap out weak ones
7. Refine Watchlist (Check 19)
8. Integrate thesis progress more clearly (Check 20)
9. Clarify Big Stories progression (Check 21)
10. Polish overall cohesion (Check 22)

As you make changes, mark them with [EDITOR: brief explanation of change]:

```
### Markets
[EDITOR: Updated S&P 500 price from 5847 to 5851 per market close data verified via Bloomberg]
S&P 500 rose 0.9% to 5,851, ...
```

STEP 8: Create change log
Compile a summary of all changes made:

```
## Editorial Change Log (v1 → v2)

**Part A Corrections (QA):**
- [Summary of data corrections, accuracy fixes]

**Part B Improvements (Editorial):**
- [Summary of narrative strengthening, story reweighting, etc.]

**Overall Impact:**
- [Sentence about whether v2 is materially stronger than v1]
```

STEP 9: Save v2 brief
Save to: daily-briefs/$TODAY-v2.md

Include this header:
```
# Daily Brief — [DATE]
**Version:** v2 (Editorial Pass, 7:30 PM ET)
**Status:** Awaiting critical review
**Critic Verdict:** [PENDING]

[change log inserted here]
```

Then include the full v2 brief with [EDITOR:] markers visible in the header section, but clean text in the body.

STEP 10: Return summary
Output to the user:
- Confirmation that daily-briefs/$TODAY-v2.md was generated
- Number of checks completed: 22
- Number of corrections made (Part A)
- Number of editorial improvements (Part B)
- List of major changes (data fixes, story additions, Take refinement, etc.)
- Assessment of v2 quality vs v1
- Ready for critical review (starting 8:30 PM)

NOTES:
- Data accuracy (Part A) is non-negotiable; fix any wrong prices/facts
- Editorial improvements (Part B) should strengthen narrative, not just add words
- [EDITOR:] markers help track what changed
- v2 should be noticeably better than v1 in clarity, accuracy, and insight
- Critical review begins 8:30 PM; expect skeptical questioning
```

---

### Task 9: brief-critic

**Task ID:** `brief-critic`

**Description:** Skeptical outside evaluation of v2. Generates critic report with quality scoring.

**Cron Expression:** `30 20 * * 1-5` (8:30 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 8:30 PM ET

**Prompt:**

```
You are the critical evaluator of today's Daily Brief v2. Your job is to step outside the brief-building process and assess the brief skeptically: is it high-quality? Is it insightful? Is it right? Is it worth Jackson's time? Generate a detailed critical evaluation.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read reference documents
From the workspace root, read:
1. system/Brief_Critic.md (evaluation framework, rubric, scoring)
2. system/Thesis_Tracker.md (historical quality scores, compounding evaluation notes)
3. system/Quality_Tracker_final.md (historical brief quality patterns, ratings)
4. daily-briefs/$TODAY-v2.md (the brief to be evaluated)

STEP 3: Evaluate each section with critical eye
For EACH major section of the brief, assign:
- **Quality Score:** 1-10 (1=poor, 10=excellent)
- **Insight Level:** 1-10 (1=obvious/consensus, 10=novel/original)
- **Accuracy:** 1-10 (1=errors throughout, 10=completely accurate)
- **Relevance:** 1-10 (1=not relevant to Jackson, 10=highly relevant)

**DASHBOARD:** Are prices accurate and current? All elements present?
**THE TAKE:** Is it specific, defensible, insightful? Or vague/obvious?
**WHAT HAPPENED TODAY:** Does the narrative make sense? Are the drivers real?
**TOMORROW'S HEADLINES:** Predictable? Original? Actionable?
**DISCOVERY:** Truly surprising, or just a fact?
**INNER GAME:** Deep insight into market psychology, or surface-level?
**DEEP READS:** Are these the most important stories? Are URLs valid?
**WATCHLIST:** Will these actually matter in the next 1-2 weeks?
**THESIS TRACKER UPDATE:** Does it advance Jackson's thesis thinking?
**BIG STORIES TRACKING:** Meaningful progress, or just status update?
**LIFE NOTE:** Genuine human insight, or filler?
**MODEL:** Useful framework, or over-simplified?

STEP 4: Run the five critical questions
Per Brief_Critic.md, ask these questions of the brief:

**Question 1: Is the Take correct?**
- Examine the Take statement closely
- Does the evidence in the brief actually support it?
- Could a reasonable person disagree?
- Is there counter-evidence the brief ignored?
- Verdict: [Strongly supported / Supported / Questionable / Contradicted]

**Question 2: Is the Take important?**
- Would a professional investor care about this insight?
- Does it change how Jackson should think about markets, risks, or opportunities?
- Or is it interesting but not actionable?
- Verdict: [Critical / Important / Interesting / Marginal]

**Question 3: Is the brief complete?**
- Are major stories missing?
- Are there blind spots in the coverage?
- Did the brief synthesize all the intelligence into coherent narrative?
- Verdict: [Comprehensive / Mostly complete / Notable gaps / Incomplete]

**Question 4: Are the Deep Reads worth reading?**
- Would these actually advance Jackson's understanding?
- Are they relevant to his theses and concerns?
- Or are they tangential/noise?
- Verdict: [Highly relevant / Relevant / Mixed / Off-target]

**Question 5: Does the brief reflect honest assessment?**
- Is the brief balanced, or does it push a particular narrative?
- Does it acknowledge uncertainty and disagreement?
- Or does it present one view as settled?
- Verdict: [Balanced / Mostly balanced / Leaning / One-sided]

STEP 5: Calculate Essential Test score
Per Brief_Critic.md, the Essential Test: would Jackson feel the brief was essential to read, or just nice-to-have?

Essential Test: [5 = absolutely essential | 4 = very valuable | 3 = good | 2 = interesting | 1 = not essential]

STEP 6: Assess compounding quality
Per Thesis_Tracker.md, does this brief compound Jackson's understanding of his active theses?
- Is it adding to his thesis thesis intelligence with new evidence?
- Or is it just stating the obvious?
- Grade: [High compound value | Medium | Low]

STEP 7: Compare to Quality_Tracker_final.md
How does today's brief rank vs. recent historical briefs?
- Better than average recent briefs? [Y/N, by how much?]
- Consistent quality? [Y/N]
- Any sections notably weaker/stronger than usual?

STEP 8: Identify specific weaknesses
What are the 2-3 biggest weaknesses or concerns with v2?
1. [Weakness #1 + why it matters]
2. [Weakness #2 + why it matters]
3. [Weakness #3 + why it matters, if applicable]

STEP 9: Identify specific strengths
What are the 2-3 biggest strengths or highlights of v2?
1. [Strength #1 + why it's strong]
2. [Strength #2 + why it's strong]
3. [Strength #3 + why it's strong, if applicable]

STEP 10: Generate verdict
Synthesize the evaluation into a clear verdict:

```
## VERDICT

**Overall Quality Score:** X/10

**Is this brief worth Jackson's time?** [YES / QUALIFIED YES / NO]

**Why:** [1-2 sentences explaining the verdict]

**Key Concerns:** [Bullet list of 2-3 main concerns]

**What's Strong:** [Bullet list of 2-3 main strengths]

**Recommendation for Jackson:**
[If YES: "Brief is ready. [1-line on what to focus on]"]
[If QUALIFIED YES: "Brief is good but has [main concern]. Consider [suggestion] before publishing."]
[If NO: "Brief has [main issues]. Recommend revision before publishing."]
```

STEP 11: Generate brief summary for email
Create a 2-3 sentence summary of the verdict for inclusion in the email to Jackson:

```
**Critic Verdict (Brief Summary):**
[2-3 sentences summarizing quality, recommendation, and key issues]
```

STEP 12: Save critic report
Save to: daily-briefs/$TODAY-critic.md

Include header:
```
# Brief Critic Evaluation — [DATE]
**Evaluated:** v2 (8:30 PM ET)
**Evaluator:** Critical Framework per Brief_Critic.md
**Status:** Ready for email to Jackson

[Full evaluation and verdict from Steps 3-11]
```

STEP 13: Return summary
Output to the user:
- Confirmation that daily-briefs/$TODAY-critic.md was generated
- Overall Quality Score (X/10)
- Verdict (YES / QUALIFIED YES / NO)
- The 5 Critical Questions (verdicts)
- Essential Test score (1-5)
- Top 2-3 strengths
- Top 2-3 weaknesses
- Recommendation for Jackson
- Whether brief is ready to be emailed

NOTES:
- Be genuinely skeptical; this is NOT just cheerleading the brief
- If the brief has real issues, say so clearly
- The verdict should help Jackson decide whether to approve or request changes
- Quality scoring should be calibrated to Jackson's standards (high bar)
- Compounding value matters — does this help him think better about his theses?
- This evaluation will inform Jackson's feedback (8:30-9 PM window before email sends)
```

---

### Task 10: brief-email

**Task ID:** `brief-email`

**Description:** Email v2 brief and critic verdict to Jackson for review and feedback.

**Cron Expression:** `0 21 * * 1-5` (9:00 PM Eastern, Monday-Friday)

**Schedule (human readable):** Every weekday at 9:00 PM ET

**Prompt:**

```
You are sending today's Daily Brief (v2) and critic evaluation to Jackson for review and feedback. Compose a comprehensive email with the brief, verdict, and feedback instructions.

STEP 1: Determine today's date
Use bash to get today's date in YYYY-MM-DD format. Store as $TODAY.

STEP 2: Read the brief and critic report
From the workspace root, read:
1. daily-briefs/$TODAY-v2.md (the brief to send)
2. daily-briefs/$TODAY-critic.md (the evaluation to summarize)

STEP 3: Extract key information
From the critic report, extract:
- Overall Quality Score
- Verdict (YES / QUALIFIED YES / NO)
- Brief summary statement
- Top 2-3 strengths
- Top 2-3 weaknesses
- Recommendation

STEP 4: Compose the email
Use the Gmail MCP tool (gmail_create_draft) to create an email with:

**Subject:** Daily Brief — [DATE] — Review & Feedback

**Body:**

```
[GREETING]

Your Daily Brief v2 is ready for review. Here's the critic verdict and the full brief below.

[CRITIC VERDICT SUMMARY]

Quality Score: X/10
Verdict: [YES / QUALIFIED YES / NO]

[2-3 sentence verdict summary]

**What's Strong:**
[Bullet points of 2-3 strengths]

**Areas to Watch:**
[Bullet points of 2-3 concerns]

**Next Steps:**

Please review and provide feedback by [MIDNIGHT / 11:59 PM ET]. Use these flags to indicate your intent:

- **APPROVE** — Brief is good as-is. Publish tomorrow at 5 AM.
- **CHANGE [description]** — Make specific change(s) and re-publish at 5 AM.
- **WORLDVIEW [updates]** — Update Current_Worldview_v5.md with new insights.
- **THESIS [thesis #] [update]** — Update Thesis_Tracker.md for thesis #N.
- **HOLD** — Don't publish. Wait for feedback.

You can use multiple flags (e.g., "APPROVE + WORLDVIEW [updates] + THESIS #3 [stronger evidence]").

---

[FULL BRIEF TEXT INSERTED HERE]

---

**Please reply by midnight with your feedback and flags. If no reply is received by 12:01 AM, the system will publish v2 as-is at 5 AM.**

Thanks,
Daily Brief System
```

STEP 5: Construct the email using gmail_create_draft
Use the gmail MCP tool to create the draft. The email should:
1. Have subject: "Daily Brief — [DATE] — Review & Feedback"
2. Include the critic verdict summary (Quality Score, Verdict, explanation)
3. Include top 2-3 strengths and concerns from critic report
4. Include feedback flag instructions (APPROVE, CHANGE, WORLDVIEW, THESIS, HOLD)
5. Include the FULL v2 brief text in the body
6. Indicate deadline: "Please reply by midnight (11:59 PM ET)"
7. Include fallback instruction: "If no reply by 12:01 AM, system will publish v2 as-is at 5 AM"

NOTE: The email body will be LONG (brief is 2000+ words). This is intentional — Jackson should have the full brief in his email for review.

STEP 6: Send the email
Use gmail MCP tool to send the email to cosmictrex11@gmail.com.

STEP 7: Save email thread ID
After sending, note the email thread ID for later use by the feedback processor task (brief-feedback).

Create a file: daily-briefs/$TODAY-email-thread.txt
Contents:
```
Email sent at: [timestamp]
Recipient: cosmictrex11@gmail.com
Subject: Daily Brief — [DATE] — Review & Feedback
Status: Awaiting feedback

[Gmail thread ID will be added by gmail MCP tool if available]
```

STEP 8: Return summary
Output to the user:
- Confirmation that email was sent to cosmictrex11@gmail.com
- Subject line
- Deadline for Jackson's feedback: midnight (11:59 PM ET)
- Summary of key points in email (verdict, strengths, concerns)
- Fallback instruction (if no reply, publish v2 as-is at 5 AM)
- Next step: brief-feedback task will run at midnight to check for replies

NOTES:
- Email should be comprehensive but readable
- Jackson needs the full brief in the email to review
- Feedback flags should be clear and easy to use
- Midnight deadline is firm (brief-feedback checks at 12:00 AM)
- If Jackson doesn't reply, system publishes v2 as-is (no holds)
- System will parse his reply for flags and apply changes automatically
```

---

### Task 11: brief-feedback

**Task ID:** `brief-feedback`

**Description:** Check Gmail for Jackson's feedback reply. Parse flags, apply changes to brief and living documents. Generate final version.

**Cron Expression:** `0 0 * * 2-6` (12:00 AM Eastern, Tuesday-Saturday, covering Mon-Fri briefs)

**Schedule (human readable):** Every night at midnight ET (Tuesday through Saturday, to cover feedback on Mon-Fri briefs)

**Prompt:**

```
You are processing feedback on today's Daily Brief. Your job is to check Gmail for Jackson's reply, parse his feedback flags, apply any requested changes to the brief and living documents, and generate the final brief version.

STEP 1: Determine the brief date
Since this task runs at midnight, "today" is actually tomorrow. The brief we're processing is from YESTERDAY.
Use bash to calculate: BRIEF_DATE = yesterday's date in YYYY-MM-DD format.

STEP 2: Check for Jackson's reply
Use Gmail search to look for Jackson's reply to the brief email.

Search query: "Daily Brief — [BRIEF_DATE]" AND from:cosmictrex11@gmail.com AND after:[BRIEF_DATE]

Look for:
- Subject line like: "Re: Daily Brief — [BRIEF_DATE] — Review & Feedback"
- Body containing feedback flags (APPROVE, CHANGE, WORLDVIEW, THESIS, HOLD)
- Natural language feedback and suggestions

STEP 3: Determine outcome
Check if a reply was found:

**Case A: No reply found**
→ Proceed to Step 3A

**Case B: Reply found**
→ Proceed to Step 3B

STEP 3A: No reply found (no feedback)
1. Email Jackson: "No feedback received by midnight. Publishing v2 as scheduled at 5 AM ET."
2. Copy v2 to final: `cp daily-briefs/[BRIEF_DATE]-v2.md daily-briefs/[BRIEF_DATE]-final.md`
3. Return: "No feedback received. v2 will be published as-is."
4. Exit (morning task will publish)

STEP 3B: Reply found (feedback present)
→ Proceed to Step 4

STEP 4: Parse Jackson's feedback
From his reply, extract:
1. **Flags used:** APPROVE? CHANGE? WORLDVIEW? THESIS? HOLD?
2. **Change requests:** If CHANGE flags, list specific changes
3. **Worldview updates:** If WORLDVIEW flags, list what to update
4. **Thesis updates:** If THESIS flags, note thesis # and what to update
5. **Overall sentiment:** Is he approving, requesting changes, or holding?

Example parsing:
```
Original email:
"APPROVE + WORLDVIEW [see below] + THESIS #3 [strengthen evidence]

Updates:
- Add to Tomorrow's Headlines: geopolitical risks
- Thesis #3 (interest rate inflection): Jackson notes that the 2-year yield drop yesterday is significant evidence of inflection. Add to Thesis Tracker."

Parsed result:
- Flag: APPROVE (with changes)
- Worldview change: Add geopolitical risk to Tomorrow's Headlines
- Thesis #3 change: Strengthen evidence note in Thesis_Tracker.md
```

STEP 5: Handle HOLD flag
If Jackson used HOLD flag:
1. Email: "Feedback received: HOLD. Brief will not be published. Awaiting further instructions."
2. Save reply to: daily-briefs/[BRIEF_DATE]-feedback.txt
3. Return: "HOLD received. Brief not processed. Awaiting next instruction."
4. Exit (brief-morning task will skip this brief)

STEP 6: Process CHANGE flags
If Jackson requested specific changes:
1. Read daily-briefs/[BRIEF_DATE]-v2.md
2. For each CHANGE request, apply the modification
3. Mark changes with [FEEDBACK:] tags for tracking
4. Save modified version to: daily-briefs/[BRIEF_DATE]-final.md (this becomes the final version)

STEP 7: Process WORLDVIEW flags
If Jackson requested Worldview updates:
1. Read system/Current_Worldview_v5.md
2. For each update, modify the Current_Worldview file:
   - Add/remove/modify Tomorrow's Headlines
   - Update Big Stories (A-E) status
   - Add new theses or retire old ones if noted
3. Save updated: system/Current_Worldview_v5.md
4. Log: "Updated Current_Worldview_v5.md with feedback"

STEP 8: Process THESIS flags
If Jackson requested Thesis_Tracker updates:
1. Read system/Thesis_Tracker.md
2. For each THESIS update, modify the Thesis Tracker:
   - Add evidence/comments to the specified thesis
   - Update thesis status if indicated
   - Update rotation logs if applicable
3. Save updated: system/Thesis_Tracker.md
4. Log: "Updated Thesis_Tracker.md with feedback"

STEP 9: Add Quality Tracker entry
Regardless of feedback, add an entry to system/Quality_Tracker_final.md:

```
## [BRIEF_DATE]
- Quality Score (critic): X/10
- Jackson Verdict: [APPROVE / APPROVE + Changes / HOLD]
- Changes Applied: [brief summary]
- Worldview Updates: [Y/N]
- Thesis Updates: [Y/N]
- Final Status: [PUBLISHED / HELD / etc.]
```

STEP 10: Generate final brief
If changes were applied and brief will be published:

Copy v2 to final (with changes): daily-briefs/[BRIEF_DATE]-final.md

Add header:
```
# Daily Brief — [BRIEF_DATE]
**Version:** FINAL (Feedback applied, 12:30 AM ET)
**Jackson Feedback:** [APPROVED / APPROVED WITH CHANGES]
**Status:** Ready for publication at 5 AM ET

---
[FULL BRIEF TEXT WITH CHANGES APPLIED]
```

STEP 11: Save feedback record
Save Jackson's feedback and all changes for record:

File: daily-briefs/[BRIEF_DATE]-feedback.txt
Contents:
```
Feedback received at: [timestamp]
From: Jackson

[Jackson's original feedback/flags]

---

Changes Applied:
[List of all changes made to brief, Worldview, Thesis Tracker]

Final Brief: daily-briefs/[BRIEF_DATE]-final.md
Worldview Status: [updated/unchanged]
Thesis Tracker Status: [updated/unchanged]
Quality Tracker Entry: [added]
```

STEP 12: Email Jackson confirmation
Send email confirming:
- Feedback processed
- Changes applied (if any)
- Worldview/Thesis updates made (if any)
- Brief ready for publication at 5 AM ET
- [If changes made: list the key changes for his confirmation]

Example:
```
Subject: Feedback Processed — [BRIEF_DATE]

Thanks for the feedback on today's brief.

Feedback Status: APPROVED [+ WITH CHANGES]

Changes Applied:
[Bullet list of changes made]

Worldview Updates:
[If any, list them]

Thesis Tracker Updates:
[If any, list them]

Final brief is saved and will be published at 5 AM ET.
```

STEP 13: Return summary
Output to the user:
- Feedback status: [Received / Not received / HOLD]
- Jackson's verdict: [APPROVE / APPROVE + Changes / HOLD]
- Number of changes applied (if any)
- Worldview updates: [Y/N]
- Thesis updates: [Y/N]
- Final brief: daily-briefs/[BRIEF_DATE]-final.md saved
- Ready for publication: [Y/N]
- Next step: brief-morning task at 5 AM will publish

NOTES:
- This runs at midnight ET (12:00 AM)
- It processes feedback on yesterday's brief
- Midnight is the deadline; Jackson should reply by then
- If no reply, v2 is published as-is at 5 AM (no hold)
- Changes are applied directly to the brief (no re-editing round)
- Living documents (Worldview, Thesis Tracker) are updated for future briefs
- Quality Tracker is updated daily for pattern analysis
```

---

### Task 12: brief-morning

**Task ID:** `brief-morning`

**Description:** Light overnight scan with high-bar materiality check. Refresh dashboard. Publish final brief to GitHub.

**Cron Expression:** `0 5 * * 2-6` (5:00 AM Eastern, Tuesday-Saturday, covering Mon-Fri briefs)

**Schedule (human readable):** Every morning at 5:00 AM ET (Tuesday through Saturday, to cover briefs from Mon-Fri)

**Prompt:**

```
You are running the morning publication pass for yesterday's Daily Brief. Your job is: conduct a light overnight scan, assess materiality using a HIGH BAR, optionally update the brief with overnight findings, and publish to GitHub.

STEP 1: Determine the brief date
Since this task runs at 5 AM, "today" is actually the NEXT day. The brief we're publishing is from YESTERDAY.
Use bash to calculate: BRIEF_DATE = yesterday's date in YYYY-MM-DD format.

STEP 2: Check for final brief
Verify that daily-briefs/[BRIEF_DATE]-final.md exists.
- If it exists: this is what we will publish
- If it doesn't exist, check for daily-briefs/[BRIEF_DATE]-v2.md (fallback if no feedback was processed)
- Use whichever exists

STEP 3: Read living documents
From the workspace root, read:
1. system/Current_Worldview_v5.md (Big Stories routing, context)
2. system/Morning_Updater.md (overnight scan scope, materiality framework)

STEP 4: Conduct light overnight scan
It is now 5 AM ET. The US overnight (1 AM - 5 AM) and early morning have passed. Asia trading has completed or is completing. Europe is opening.

Perform web searches for overnight developments (HIGH BAR for materiality):

**GEOPOLITICS (highest bar — only major escalations or peace breakthroughs matter):**
- Search: "breaking news overnight geopolitics" or "geopolitical crisis overnight"
- Search: "Iran news" and "US China overnight"
- Search: "conflict overnight" or "military action overnight"
- HIGH BAR: War/peace escalation, major sanctions, military action — material
- NOT material: rhetoric, diplomatic notes, incremental developments

**CRYPTO (medium bar — >5% move or major news):**
- Search: "Bitcoin price 5 AM ET" (current price vs. yesterday's close)
- Calculate 24-hour % change
- Search: "crypto news overnight" or "blockchain overnight"
- HIGH BAR: >5% move, major protocol news, exchange hack, regulatory action — material
- NOT material: normal intraday trading, minor news

**MARKETS (medium bar — >1.5% futures move or major econ data):**
- Search: "S&P 500 futures 5 AM" (ES futures price vs. 4 PM close)
- Calculate overnight % change
- Search: "economic data overnight" or "central bank overnight"
- Search: "breaking news markets overnight"
- HIGH BAR: >1.5% futures move, major central bank action, major econ surprise — material
- NOT material: normal overnight moves, expected data releases, asia/europe trading matching US direction

**BREAKING NEWS (final check):**
- Search: "major news overnight" or "breaking news today 5 AM"
- Watch for any true black swan events

STEP 5: Assess materiality
Using the HIGH BAR criteria (per Morning_Updater.md):

**MATERIAL if:**
- War/peace escalation or geopolitical shock
- >5% crypto move
- >1.5% equity futures move
- Central bank surprise
- True black swan event

**NOT MATERIAL if:**
- Normal overnight movement
- Incremental development on known story
- Asia/Europe trading just flowing with US direction
- Expected economic data
- Usual geopolitical noise

Verdict: [MATERIAL / NOT MATERIAL]

STEP 6A: If NOT material
→ Proceed to Step 7 (refresh dashboard only)

STEP 6B: If MATERIAL
→ Proceed to Step 6B continuation

STEP 6B (continued): Apply material overnight finding
If there IS a material overnight development:

1. Read the final brief: daily-briefs/[BRIEF_DATE]-final.md

2. Create an "Overnight Update" section (add as FIRST section after Dashboard):

```
## Overnight Update

[Material finding identified at 5 AM ET]

**Summary:** [1-2 sentences on what happened and why it matters]

**Impact on Brief:** [How does this change the brief's thesis/story/tomorrow's implications?]

**Key Metrics:** [If applicable: prices, impact scores, etc.]
```

3. Update Dashboard prices with any new data (Asia close, Europe opening, crypto current prices)

4. Update Tomorrow's Headlines if the material event changes what matters next

5. Save updated brief to: daily-briefs/[BRIEF_DATE]-final.md (with Overnight Update added)

STEP 7: Refresh Dashboard
Whether material or not, update the Dashboard section with current prices:

**Prices to update:**
- BTC: [current 5 AM price]
- ETH: [current 5 AM price]
- Futures: ES, NQ, YM if available
- Pre-market equity futures
- Any Asia/Europe market closes if relevant

Search:
- "Bitcoin price 5 AM ET"
- "Ethereum price 5 AM ET"
- "S&P 500 futures" (or ES futures)
- "Nasdaq futures" (or NQ futures)
- "Asian markets close" (Nikkei, Shanghai if available)

Update Dashboard section in daily-briefs/[BRIEF_DATE]-final.md with latest prices.

STEP 8: Publish to GitHub
The brief is now ready for publication.

Use the publish.py script in .claude/skills/publish-brief/scripts/:

1. Copy the final brief: `cp daily-briefs/[BRIEF_DATE]-final.md content/daily-updates/[BRIEF_DATE].md`

2. Run: `python .claude/skills/publish-brief/scripts/publish.py content/daily-updates/[BRIEF_DATE].md`

This script should:
- Push the brief to GitHub repo (cosmictrex.com/daily-updates or equivalent)
- Publish to the live website
- Return a URL where the brief is now live

Capture the URL from the script output.

STEP 9: Email Jackson publication confirmation
Send email to cosmictrex11@gmail.com:

Subject: Daily Brief Published — [BRIEF_DATE]

Body:
```
Daily Brief — [BRIEF_DATE] — is now published.

Live at: [URL from publish.py script]

[IF MATERIAL: Overnight Update applied — [1-line summary of material event]]
[IF NOT MATERIAL: Standard publication — no overnight material events]

Dashboard refreshed at 5 AM ET. Brief reflects current market conditions.

Next brief publishes tomorrow at 5 AM ET.
```

STEP 10: Update Quality Tracker
Append to system/Quality_Tracker_final.md:

```
## [BRIEF_DATE] — Published
- Published Time: 5:00 AM ET
- Overnight Material Events: [YES / NO]
- Dashboard Refreshed: YES
- GitHub URL: [published URL]
- Status: LIVE
```

STEP 11: Return summary
Output to the user:
- Confirmation brief published
- Brief date: [BRIEF_DATE]
- Publication time: 5:00 AM ET
- URL: [GitHub URL where live]
- Overnight scan result: [MATERIAL / NOT MATERIAL]
[If material: brief on what event and impact]
- Dashboard refreshed: YES
- Quality Tracker updated: YES
- Email sent to Jackson: YES

NOTES:
- HIGH BAR for materiality — only truly important overnight events get added
- Dashboard refresh is always done (good practice even if not material)
- Final brief should include overnight update header if material event found
- Publication is now complete for the previous day's brief
- System is ready for next day's intelligence sweeps (8 AM ET)
- If brief date is Mon-Fri, the system will repeat the cycle: intel sweeps → draft → editor → critic → email → feedback → publish
```

---

## Pipeline Flow Diagram

```
DAILY TIMELINE (Eastern Time)

08:00 AM  ────────────────────────────────────────────
          │ intel-sweep-1: First scan (all domains)
          │ Creates daily-intelligence/YYYY-MM-DD-intelligence.md
          │
10:00 AM  ────────────────────────────────────────────
          │ intel-sweep-2: Second scan (all domains)
          │ Appends to intelligence file
          │
12:00 PM  ────────────────────────────────────────────
          │ intel-sweep-3: Midday scan (focus on econ data, earnings)
          │ Appends to intelligence file
          │
02:00 PM  ────────────────────────────────────────────
          │ intel-sweep-4: Afternoon scan (market momentum, news)
          │ Appends to intelligence file
          │
04:00 PM  ────────────────────────────────────────────
          │ intel-sweep-5: Market close (complete market data)
          │ Appends to intelligence file (market close definitive)
          │
06:00 PM  ────────────────────────────────────────────
          │ intel-sweep-6: Final scan (after-hours, Asia opening)
          │ Final append to intelligence file (complete at end)
          │
06:30 PM  ────────────────────────────────────────────
          │ brief-draft: Generate v1 brief
          │ Reads all 12 hours of intelligence
          │ Synthesizes via 4-lens framework
          │ Creates daily-briefs/YYYY-MM-DD-v1.md
          │
07:30 PM  ────────────────────────────────────────────
          │ brief-editor: 22-point QA review
          │ Part A: Data accuracy (12 checks)
          │ Part B: Editorial quality (10 checks)
          │ Creates daily-briefs/YYYY-MM-DD-v2.md (final editorial)
          │
08:30 PM  ────────────────────────────────────────────
          │ brief-critic: Critical evaluation
          │ 5 critical questions, quality scoring
          │ Creates daily-briefs/YYYY-MM-DD-critic.md
          │
09:00 PM  ────────────────────────────────────────────
          │ brief-email: Email v2 + critic verdict to Jackson
          │ Feedback deadline: MIDNIGHT (11:59 PM ET)
          │
12:00 AM  ────────────────────────────────────────────
(Midnight)│ brief-feedback: Check for Jackson's reply
          │ Parse flags (APPROVE, CHANGE, WORLDVIEW, THESIS, HOLD)
          │ Apply changes to brief + living docs
          │ If no reply: publish v2 as-is at 5 AM
          │ Creates daily-briefs/YYYY-MM-DD-final.md
          │
05:00 AM  ────────────────────────────────────────────
(Next Day)│ brief-morning: Overnight scan + publish
          │ Light overnight scan (HIGH BAR materiality check)
          │ Refresh Dashboard prices
          │ Publish final brief to GitHub
          │ Email Jackson publication confirmation
          │
08:00 AM  ────────────────────────────────────────────
(Next Day)│ intel-sweep-1: Next day cycle begins
          │ Process repeats
```

---

## Email Protocol

### 1. Brief Email (9:00 PM ET)

**To:** cosmictrex11@gmail.com
**Subject:** Daily Brief — [DATE] — Review & Feedback

**Body includes:**
- Critic verdict and quality score
- 2-3 key strengths and concerns
- Full v2 brief text (2000+ words)
- Feedback instructions with flag options

**Flags Jackson can use:**
- `APPROVE` — brief is good as-is
- `CHANGE [description]` — make specific changes
- `WORLDVIEW [updates]` — update living Worldview doc
- `THESIS #N [update]` — update thesis tracking
- `HOLD` — don't publish yet
- Multiple flags can be combined (e.g., `APPROVE + WORLDVIEW [updates]`)

**Deadline:** Midnight (11:59 PM ET)
**Fallback:** If no reply by 12:01 AM, v2 publishes as-is at 5 AM

### 2. Feedback Confirmation Email (12:30 AM ET, if feedback received)

**To:** cosmictrex11@gmail.com
**Subject:** Feedback Processed — [DATE]

**Body includes:**
- Confirmation of feedback received
- List of changes applied (if any)
- Worldview/Thesis updates applied (if any)
- Brief ready for publication at 5 AM

### 3. Publication Confirmation Email (5:15 AM ET)

**To:** cosmictrex11@gmail.com
**Subject:** Daily Brief Published — [DATE]

**Body includes:**
- Link to live brief (GitHub/web URL)
- Overnight scan result (MATERIAL / NOT MATERIAL)
- If material: 1-line summary of overnight event that was added
- Confirmation dashboard refreshed
- Next brief timeline (publish same time next day)

### 4. No-Feedback Fallback Email (12:15 AM ET, if no reply)

**To:** cosmictrex11@gmail.com
**Subject:** No Feedback Received — [DATE] Brief

**Body:**
- No feedback received by midnight
- v2 brief publishing as-is at 5 AM ET
- Publication confirmation will follow at 5:15 AM
- If feedback is needed, reply to this email and system will process

---

## Error Handling

### Intelligence Sweep Fails
- Task retries automatically in 15 minutes
- If still fails after 3 retries: email Jackson with error log
- Fallback: manual sweep using last available intelligence

### Brief Generation Fails
- If file I/O error: retry task
- If web search fails: use cached intelligence, note gaps in brief
- If file missing: check daily-intelligence file exists; create if needed

### Editorial Review Blocks
- If prices can't be verified: hold for manual review
- If critical story can't be sourced: flag in v2 with [NEEDS VERIFICATION]
- Email Jackson if any price discrepancies found

### Critic Evaluation Fails
- Review performed; email Jackson with available evaluation
- If scoring impossible: note in report as [UNABLE TO ASSESS]

### Email Fails
- Retry sending with exponential backoff (1 min, 2 min, 4 min)
- If email can't send after 3 retries: save draft and alert Jackson
- Check Gmail auth is still valid; prompt for re-auth if needed

### Feedback Processing Fails
- If Gmail search returns no results: assume no feedback, publish v2
- If feedback parsing fails: email Jackson with raw feedback for manual processing
- If file write fails: save to temp location and retry

### Publishing Fails
- If publish.py script fails: check GitHub token validity
- If repo connection fails: queue for retry in 30 minutes
- Email Jackson with error and retry plan

### Overnight Scan Fails
- If web search unavailable: skip scan, publish v2 as-is
- If price lookups fail: use dashboard from v2 (stale but known)
- Note any scan failures in final email to Jackson

---

## Monitoring & Maintenance

### Daily Checklist (Jackson reviews each morning)

After each publication (5 AM ET email), check:

- [ ] **Brief quality:** Does published brief read well?
- [ ] **Price accuracy:** Are all prices in Dashboard correct?
- [ ] **Thesis tracking:** Did brief advance your thesis thinking?
- [ ] **Deep Reads:** Were the identified stories worth your time?
- [ ] **Tomorrow's Headlines:** Were tomorrow's actual headlines predicted?

### Weekly Review (Every Monday morning)

Check system performance:

1. **Quality Tracker Analysis**
   - Read system/Quality_Tracker_final.md
   - Are briefs consistently good quality?
   - Any pattern of issues (missing stories, weak Takes, etc.)?

2. **Thesis Tracker Review**
   - Read system/Thesis_Tracker.md
   - Are active theses progressing?
   - Any theses ready to retire or new ones to add?
   - Update Thesis Rotation if needed

3. **Worldview Refresh**
   - Read system/Current_Worldview_v5.md
   - Are Big Stories still relevant?
   - Do Tomorrow's Headlines still reflect your priorities?
   - Update Worldview if needed for next week

4. **Source Network Audit**
   - Read system/SOURCE_NETWORK.md
   - Are key sources still accessible?
   - Any sources that should be added/removed?
   - Any search patterns that need refinement?

5. **System Log Review**
   - Check for any failed tasks or errors
   - Review error handling effectiveness
   - Update System_Updater.md if needed

6. **Editorial Bible Review** (Monthly)
   - Read system/Editorial_Bible_v9.md
   - Are voice/structure rules still appropriate?
   - Any quality standards that need updating?

### Monthly Deep Dive (Last Friday of month)

1. **Quality Metrics**
   - Average Quality Score for the month
   - Trend analysis (improving/declining?)
   - Compare to historical patterns

2. **Thesis Compounding**
   - How much did this month's briefs advance your thinking?
   - New insights into your theses?
   - Any thesis predictions proven correct/incorrect?

3. **Process Improvements**
   - What worked well?
   - What broke or was difficult?
   - Any suggestions for system improvements?
   - Update living documents (Editorial Bible, Idea Developer, Brief Writer, etc.)

4. **Source Network Effectiveness**
   - Which sources proved most valuable?
   - Any sources that should be prioritized/deprioritized?
   - New sources to explore?

5. **Outlook**
   - Update Current_Worldview_v5.md for next month
   - Confirm Big Stories (retire old, add new)
   - Refresh Tomorrow's Headlines

---

## Troubleshooting

### Problem: Task doesn't run at scheduled time

**Diagnosis:**
- Check Cowork is running (should run 24/7)
- Verify laptop is powered on and connected to network
- Check system time/clock is accurate (should be set to Eastern Time, NTP synced)
- Check task is enabled in Cowork (may have been disabled)

**Solution:**
- Restart Cowork: stop and start the service
- Verify system time: `date` command should show Eastern Time
- Re-enable task if disabled: check task status in Cowork UI
- Check system sleep settings: ensure system doesn't sleep during scheduled task times

### Problem: Web searches return no results or stale data

**Diagnosis:**
- Internet connection issue (WiFi/Ethernet down)
- Search API rate limit exceeded
- Web scraping blocked by websites

**Solution:**
- Check network connection: `ping google.com`
- Wait 30 minutes for rate limits to reset
- Verify firewall isn't blocking web searches
- Use cached intelligence from daily-intelligence file if available
- Note gaps in brief with [SOURCE UNAVAILABLE]

### Problem: Gmail authentication fails

**Diagnosis:**
- Cowork OAuth token expired
- Gmail account locked or 2FA required
- Network connection to Gmail fails

**Solution:**
- Re-authenticate Gmail: check Cowork settings for Gmail auth
- Verify Jackson's credentials in Cowork
- Check Gmail account security settings
- Verify firewall allows Gmail API access
- Restart Cowork service to reset connections

### Problem: GitHub publishing fails

**Diagnosis:**
- GitHub token invalid/expired
- Repo connection fails
- GITHUB_TOKEN env var not set

**Solution:**
- Verify `echo $GITHUB_TOKEN` returns a value
- Regenerate GitHub token if expired (Settings → Developer settings → Personal access tokens)
- Check token has `repo` scope
- Verify .claude/skills/publish-brief/scripts/publish.py exists and is executable
- Test: `python .claude/skills/publish-brief/scripts/publish.py --test`

### Problem: File paths not found (daily-intelligence, daily-briefs, etc.)

**Diagnosis:**
- Working directory incorrect (cwd resets between tasks)
- Workspace path not set correctly
- Directories don't exist

**Solution:**
- All tasks should use absolute workspace paths
- Verify workspace root: `pwd` in initial task
- Create missing directories: `mkdir -p daily-intelligence daily-briefs content/daily-updates`
- Verify directory structure matches Directory Structure section above
- Update task prompts if workspace path is different

### Problem: Brief v1 has missing or incomplete intelligence

**Diagnosis:**
- One or more intelligence sweeps failed
- Intelligence file doesn't exist
- Intelligence file corrupted/truncated

**Solution:**
- Check that daily-intelligence/YYYY-MM-DD-intelligence.md was created at 8 AM
- Verify all 6 sweeps completed (check summary sections in intelligence file)
- If sweep failed, manually add missing intelligence:
  - Re-run web searches for failed sweep time window
  - Append findings to intelligence file with correct timestamp
  - Brief draft can then be re-run
- If intelligence file missing: create new one and run a makeup sweep

### Problem: Brief email doesn't arrive

**Diagnosis:**
- Gmail send failed
- Email in drafts but not sent
- Network/API issue

**Solution:**
- Check Gmail drafts folder: email may be unsent
- Manually send if present in drafts
- Verify Gmail auth still valid (may need re-auth)
- Check email address: should be cosmictrex11@gmail.com
- Verify no mail server errors in Cowork logs

### Problem: Feedback not recognized (task thinks no reply)

**Diagnosis:**
- Reply email not found by Gmail search
- Jackson's reply in wrong folder (spam, archive)
- Search query doesn't match reply subject

**Solution:**
- Check Gmail manually for reply to brief email
- Verify reply is in Inbox, not Spam or archived
- Check reply subject line: should contain "Daily Brief — [DATE]"
- Manually parse feedback and apply changes if needed
- Verify search query in task is correct: `"Daily Brief — [BRIEF_DATE]" from:cosmictrex11@gmail.com`

### Problem: Overnight scan doesn't detect material event

**Diagnosis:**
- Major news didn't appear in web search results
- Materiality bar is too high
- Search terms didn't capture the event

**Solution:**
- Manually check news sites (Bloomberg, Reuters, CNBC) for overnight events
- Adjust Morning_Updater.md materiality criteria if needed (lower bar)
- Update final brief manually with Overnight Update section
- Re-run brief-morning task for that date (use bash to repeat)

### Problem: Published brief has errors/typos

**Diagnosis:**
- Error slipped through 22-point editorial check
- Critic didn't catch it
- Last-minute change introduced error

**Solution:**
- Correct error in content/daily-updates/YYYY-MM-DD.md
- Re-run publish.py to push corrected version
- Email Jackson: "Brief correction: [describe error and fix]"
- Add note to Quality_Tracker_final.md: error corrected

### Problem: Cron expressions not working (tasks don't run)

**Diagnosis:**
- Timezone mismatch (cron running in UTC, not Eastern Time)
- Syntax error in cron expression
- System cron daemon not running

**Solution:**
- Verify system timezone: `timedatectl` (should show "Eastern Time")
- Test cron syntax: each expression should match format: `0 HH * * 1-5`
- Verify Cowork cron service is running
- Check Cowork logs for cron errors
- Manually run a task to verify Cowork can execute (test command)

---

## Next Steps to Deploy

1. **Create directory structure** on the Dell laptop:
   ```bash
   mkdir -p workspace/{system,daily-intelligence,daily-briefs,content/daily-updates,.claude/skills/publish-brief/scripts}
   ```

2. **Create/copy all system files** to `workspace/system/`:
   - Editorial_Bible_v9.md
   - Current_Worldview_v5.md
   - Thesis_Tracker.md
   - SOURCE_NETWORK.md
   - Quality_Tracker_final.md
   - All 8 skill files (Market_Data_Collector.md, etc.)

3. **Set up credentials:**
   - Authenticate Gmail in Cowork (cosmictrex11@gmail.com)
   - Set environment variable: `GITHUB_TOKEN=ghp_xxxx...`
   - Optional: set SNAPSHOT_SECRET if using audio

4. **Create publish.py script** in `.claude/skills/publish-brief/scripts/`:
   - Script should accept a file path and push to GitHub
   - Return published URL for email confirmation

5. **Set up Cowork scheduled tasks:**
   - Use the Task IDs and Cron Expressions from this playbook
   - Copy the complete prompt for each task
   - Set to run on Windows Dell laptop

6. **Verify timezone:**
   - System should be set to Eastern Time
   - All cron times are in ET (no conversion needed)

7. **Test the pipeline:**
   - Run intel-sweep-1 manually to verify web search works
   - Run brief-draft manually to verify brief generation
   - Run brief-email manually to verify email sending
   - Check that published brief arrives on GitHub

8. **Monitor first week:**
   - Review each day's brief quality
   - Check for any system errors or missing functionality
   - Adjust tasks/prompts based on what works

---

**END OF DEPLOYMENT PLAYBOOK**
