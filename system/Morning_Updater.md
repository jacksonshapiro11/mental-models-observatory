---
name: Morning Updater
description: "Run the 6:30-7:00 AM morning pass on a prepared evening brief. NOT a new brief — an update layer. Checks overnight futures, Asia/Europe session moves, breaking news since 7:30 PM (including overnight source network publications like Sinocism for Asia hours), and refreshes Dashboard with pre-market data. Adds an Overnight header if material, otherwise just refreshes prices. WHEN TO USE: every morning between 6:30-7:00 AM when 'run the morning update' is invoked. This is the final step before publishing. WHEN NOT TO USE: for the evening session (use the full skill pipeline), for standalone analysis, for weekly reviews."
---

# Morning Updater

Not a new brief. An update layer on last night's prepared brief. Total time: 5-10 minutes.

## Project files

- **Last night's v2/v3 brief** — the prepared brief from the evening session
- **Worldview** (`Current_Worldview_v5.md`) — Big Stories for routing overnight developments
- **Source Network** (`references/SOURCE_NETWORK.md`) — for overnight source checks

## Related skills

This skill uses scoped versions of:
- **Market Data Collector** (`Market_Data_Collector.md`) — futures-only scope
- **Source Network Scanner** (`Source_Network_Scanner.md`) — overnight scope

## Morning pass sequence

### Step 1: Refresh pre-market data

Futures-only scope of Market Data Collector:
- `S&P 500 futures pre-market` → level + overnight change%
- `Nasdaq 100 futures pre-market` → level + change%
- `Dow futures pre-market` → level + change%
- `Bitcoin price` → current (crypto trades 24/7)
- `Gold price` → current
- `10 year treasury yield` → current

Update Dashboard Futures table. Update crypto/commodity if meaningfully moved.

### Step 2: Check overnight developments

Overnight scope of Source Network Scanner:
- `overnight market news` — broad sweep
- `Asia markets today` — Nikkei, Hang Seng, Shanghai
- `Europe markets today` — FTSE, DAX, Stoxx
- `Sinocism latest` — China news from Asia hours
- `Byrne Hobart The Diff latest` — published after evening session?
- Any source from SOURCE_NETWORK.md relevant to currently hot Big Stories

### Step 3: Assess materiality

**Material:**
- Major futures >1% overnight
- Breaking news changing a Big Story's state
- Geopolitical event readers expect to see
- Crypto >3% move
- Central bank / regulatory action in another timezone

**Not material:**
- Futures within normal range (<0.5%)
- Incremental developments on covered stories
- Asia/Europe confirming US direction

### Step 4a: If material — add Overnight header

Insert between Orientation and Dashboard:

```markdown
---

## ▸ OVERNIGHT

- [Development]. [One line context + impact.] → [Big Story #N](#big-stories) if relevant
- [Development]. [Impact.]
- Asia: [session summary]. Europe: [session summary].

---
```

Rules: facts + pointers only. If touches Big Story, anchor link. If significant enough to change a Big Story update, modify that section. If contradicts evening brief, correct it.

### Step 4b: If not material — prices only

Update Dashboard tables. Brief publishes as-is.

### Step 5: Final scan

Quick read: do numbers still make sense? Does TLDR still capture the lead? Any Big Story need a one-line addendum?

## Output

Final brief ready to publish. Publish. Done.
