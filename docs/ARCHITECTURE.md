# Mental Models Observatory — Technical Architecture

Last updated: March 8, 2026

This document covers the two major real-time features of the Mental Models Observatory: the **Live Dashboard** and the **Podcast Audio Pipeline**. Both are built on the same Next.js (App Router) stack, share Upstash Redis for state, and deploy via Vercel.

---

## Table of Contents

1. [Live Dashboard](#live-dashboard)
2. [Podcast Audio Pipeline](#podcast-audio-pipeline)
3. [Infrastructure & Environment](#infrastructure--environment)
4. [Cron Schedule](#cron-schedule)
5. [Future Plans](#future-plans)

---

## Live Dashboard

### What It Does

Displays real-time and historical price data for equities, crypto, commodities, and rates — plus calculated percentage changes (1D/5D/1M/1Y) and moving averages (50D/200D/200W). The frontend polls every 60 seconds.

### Architecture: Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  0. SEED (one-time: node scripts/seed-prices.mjs)            │
│     Fetches 1500 days from Yahoo Finance (free, no key)     │
│     Writes per-day snapshots to Redis history               │
├─────────────────────────────────────────────────────────────┤
│  1. SNAPSHOT (daily cron, 6 AM ET)                          │
│     Fetches today's prices from Yahoo Finance               │
│     Reads history from Redis → calculates changes & MAs     │
│     Calibrates ETF→index multipliers daily                  │
│     Writes to Redis: snapshot:latest + history:YYYY-MM-DD   │
├─────────────────────────────────────────────────────────────┤
│  2. LIVE (polled every 60s by frontend)                     │
│     Reads snapshot from Redis (reference data)              │
│     Fetches real-time prices: Binance (crypto), Finnhub     │
│     Merges live prices with snapshot's changes/MAs          │
│     Recalculates 1D change from live price vs latestClose   │
├─────────────────────────────────────────────────────────────┤
│  3. FRONTEND (LiveDashboard.jsx)                            │
│     Client component, polls /api/dashboard/live every 60s   │
│     Renders price tables: equities, crypto, commodities,    │
│     rates, plus metadata (DXY, Fear & Greed, market status) │
└─────────────────────────────────────────────────────────────┘
```

### Why Three Layers?

The snapshot runs once daily and does the computation (change calculations, MAs). Historical data lives in Redis, populated once by `seed-prices.mjs`. The live endpoint is lightweight — it reads the pre-computed reference data from Redis and only fetches current prices. This keeps the 60-second polling fast and cheap.

### Data Sources

| Asset Class | Seed / Snapshot Source | Live Source | Notes |
|-------------|----------------------|-------------|-------|
| Equities | Yahoo Finance (ETF proxies: SPY, QQQ, DIA, etc.) | Finnhub `/quote` | ETF price × calibrated multiplier = index value |
| Crypto | Yahoo Finance (BTC-USD, ETH-USD, etc.) | Binance (no key) `/ticker/price` | Direct prices, multiplier = 1 |
| Commodities | Yahoo Finance (ETF proxies: GLD, SLV, BNO, etc.) | From snapshot (daily data) | ETF price × calibrated multiplier vs actual futures |
| Rates | Yahoo Finance (^TNX) | From snapshot (daily data) | Treasury yields direct |
| Forex (DXY) | — | Finnhub `/quote` (6 forex pairs) | Calculated from formula |
| Fear & Greed | alternative.me `/fng` | From snapshot | No key needed |
| Crypto meta | — | CoinGecko `/global`, `/defi`, `/trending`, `/derivatives` | Cached 1hr in Redis |

### Data Seeding

Historical data is populated once by `scripts/seed-prices.mjs`, which uses **Yahoo Finance exclusively** (free, no API key). It fetches 1500 calendar days of history for all tracked assets and writes one Redis key per date (`dashboard:history:YYYY-MM-DD`), plus `dashboard:snapshot:latest` with the most recent day's data.

Run once: `node scripts/seed-prices.mjs`

Options: `--days=90` (shorter range), `--dry-run` (preview without writing)

### ETF Proxy Calibration System

We can't get real-time index values (S&P 500, Nasdaq 100, Dow Jones) from free APIs. Instead, we use ETF proxies and apply calibrated multipliers:

**Equities:** SPY→SPX, QQQ→NDX, DIA→DJI (ETF × multiplier = index value)
**Commodities:** GLD→Gold futures (GC=F), SLV→Silver futures (SI=F), BNO→Brent (BZ=F), CPER→Copper (HG=F), UNG→Natural Gas (NG=F)

**How calibration works (daily):**

1. Fetch ETF price from Yahoo Finance (e.g., SPY = $578.50)
2. Fetch actual index/futures price from Yahoo Finance (e.g., ^GSPC = 5,785)
3. Multiplier = actual / ETF = 5785 / 578.50 = 10.0000
4. Multiplier stored in snapshot alongside asset data
5. Live endpoint applies multiplier to real-time Finnhub ETF quotes

**Default multipliers** (fallback when calibration fails):
- SPY → SPX: 10, QQQ → NDX: 40.95, DIA → DJI: 100, GLD → GOLD: 10
- IGV, SMH, IWM, IWF, IWD, XLE, ARKK, SLV, BNO, CPER, UNG: 1

### Snapshot Route: `/api/dashboard/snapshot`

**File:** `app/api/dashboard/snapshot/route.ts`

**Methods:**
- `GET` — Daily snapshot regeneration (cron or manual)
- `PATCH` — Manual field updates (FedWatch, ETF flows, notes)

**Authentication:** `x-snapshot-secret` header, `?secret=` query param, or `Authorization: Bearer <CRON_SECRET>` (Vercel cron).

**What it does on GET:**

1. Fetches today's prices from Yahoo Finance for all assets (same source as seed script), with ETF→index/futures calibration
2. Reads historical data from Redis (`dashboard:history:*` keys, populated by seed-prices.mjs)
3. Builds per-asset price arrays from the historical data + today's price
4. Calculates percentage changes using **per-asset trading day lookback** (1D=1, 5D=5, 1M=21, 1Y=252 trading days — not calendar days, which matters because equities don't trade weekends but crypto does)
5. Calculates moving averages (50D=50, 200D=200, 200W=1000 trading days)
6. Fetches metadata: DXY (Finnhub forex), Fear & Greed (alternative.me)
7. Writes to Redis: `dashboard:snapshot:latest` + `dashboard:history:YYYY-MM-DD`

**Debug mode:** Add `?debug=true` to see a breakdown of which assets loaded and any warnings.

### Live Route: `/api/dashboard/live`

**File:** `app/api/dashboard/live/route.ts`

**No authentication** — this is the public-facing endpoint polled by the frontend.

**What it does:**

1. Reads the snapshot from Redis (for reference data: changes, MAs, multipliers)
2. Reads manual fields from Redis (FedWatch, ETF flows)
3. Fetches live data in parallel:
   - Crypto prices from Binance (`api.binance.com`) — 6 pairs
   - Equity prices from Finnhub — 10 ETFs, applies calibrated multipliers
   - DXY from Finnhub forex quotes
   - CoinGecko global/defi/trending/derivatives — cached 1 hour in Redis
4. Merges live prices with snapshot reference data:
   - Equities and crypto: live price replaces `latestClose`, 1D change is recalculated from live price vs snapshot's `latestClose`, 5D/1M/1Y and MAs come from snapshot unchanged
   - Commodities and rates: come straight from snapshot (daily data, no live API)
5. Returns JSON with: `{ equities, crypto, commodities, rates, meta }`

**Response caching:** `s-maxage=60, stale-while-revalidate=120` — Vercel CDN caches for 60s, so all concurrent readers share one invocation.

### CoinGecko Enriched Data

The live endpoint also fetches enriched crypto metadata from CoinGecko (cached 1 hour in Redis to stay within rate limits):

- **Global:** BTC dominance, ETH dominance, total market cap, 24h volume
- **DeFi:** DeFi market cap, DeFi-to-ETH ratio, DeFi dominance (Thesis 3: infra > assets)
- **Trending:** Top 7 trending coins (narrative/sentiment gauge)
- **Derivatives:** BTC perpetual funding rate and open interest (positioning indicator)
- **Corporate treasury:** Total corporate BTC holdings (MSTR risk monitoring)

Rate budget: ~5 calls/hour × 720 hours/month = ~3,600 calls/month (well within CoinGecko's 10K/month demo limit).

### Frontend: LiveDashboard.jsx

**File:** `components/dashboard/LiveDashboard.jsx`

Client component (`'use client'`). Polls `/api/dashboard/live` every 60 seconds. Renders four asset tables (equities, crypto, commodities, rates) with price, percentage changes (1D/5D/1M/1Y), and moving averages (50D/200D/200W) displayed as price levels. Includes market status indicator, DXY display, Fear & Greed gauge, and crypto metadata section.

Responsive: uses a `ScrollableTable` wrapper for horizontal scroll on mobile.

### Manual Fields (PATCH)

Some data isn't available via API and is entered manually during the evening brief-writing session:

- `fedWatch` — CME FedWatch tool probabilities for next meeting
- `etfFlows` — Daily Bitcoin ETF flow data
- `fedFunds` — Fed Funds rate range (e.g., "4.25-4.50%")
- `notes` — Freeform notes

Update via: `curl -X PATCH /api/dashboard/snapshot?secret=XXX -d '{"fedWatch": "..."}' -H 'Content-Type: application/json'`

---

## Podcast Audio Pipeline

### What It Does

Converts the daily brief markdown into a polished, conversational podcast episode. The audio player is embedded in the brief page on the website, and a public RSS feed lets you subscribe in any podcast app (Overcast, Apple Podcasts, etc.) — subscribe once, episodes auto-appear.

### Architecture

```
Brief markdown (content/daily-updates/YYYY-MM-DD.md)
  ↓
POST /api/audio/generate
  ↓
┌─── Text Preprocessing ─────────────────────────┐
│  1. Extract sections (skip dashboard tables,     │
│     skip reference databases)                    │
│  2. Split "The Six" at ## sub-headers (6 parts) │
│  3. Per-section GPT-4o scriptwriter rewrite      │
│     (~15 API calls per brief)                    │
│  4. Regex normalization safety net               │
└──────────────────────────────────────────────────┘
  ↓
OpenAI tts-1-hd (voice: onyx)
  ↓ chunked at 4096 chars, concatenated
Single MP3 file
  ↓
Upload to Vercel Blob (CDN)
  ↓
Store metadata in Redis (audio:episode:YYYY-MM-DD)
  ↓
Website: AudioPlayer fetches /api/audio/{date}
Podcast: /api/podcast/feed returns RSS 2.0 XML
```

### Why Per-Section LLM Rewriting?

Sending the entire 35K+ character brief to GPT-4o in one shot causes massive compression — the model outputs ~4K characters, losing most of the substantive content. By processing each section individually (and further splitting The Six into 6 sub-sections), each API call handles ~2-4K characters and the model preserves all insights, theses, and key levels.

Total API calls per brief: ~15 (1 intro + 1 dashboard + 6 for The Six + 1 each for Take, Model, Big Stories, Tomorrow's Headlines, Watchlist, Discovery).

### Text Preprocessor

**File:** `lib/audio/text-preprocessor.ts`

Two-layer approach:

**Layer 1: GPT-4o scriptwriter** — Rewrites each section as natural spoken podcast script. Per-section instructions tell the model what to emphasize (e.g., "Cover EVERY story individually" for Big Stories, "Read the epigraph EXACTLY as provided" for the intro). Key directives:
- Include ALL substantive content — no compression
- Round numbers naturally for speech (commodities to nearest dollar, indices to nearest hundred, yields keep precision, percentages round to halves)
- Expand all abbreviations and tickers
- Skip markdown formatting, emoji, reference markers

**Layer 2: Regex normalization** — Safety net that catches anything the LLM missed:
- `$1.2B` → `1.2 billion dollars`
- `25bps` → `25 basis points`
- `23.5x` → `23.5 times`
- `Q3 2025` → `third quarter 2025`
- `YoY` → `year over year`, `EBITDA` → `E.B.I.T.D.A.`
- `NVDA` → `NVIDIA`, `MSTR` → `MicroStrategy` (50+ tickers)
- Markdown stripping: bold, italic, links, headers, bullets, emoji
- Moving averages: `50D MA` → `50-day moving average`

**Section selection:**
- Included (8 sections): Dashboard (commentary only), The Six, The Take, The Model, The Big Stories, Tomorrow's Headlines, The Watchlist, Discovery
- Excluded: Worldview Updates (bookkeeping), Full Reference: Big Stories (tracking database), Full Reference: Tomorrow's Headlines (tracking database)
- Dashboard mode: `commentary-only` — extracts italic paragraphs and prose, skips price tables

### TTS Client

**File:** `lib/audio/tts-client.ts`

Provider-agnostic interface (`TTSProvider`) with an `OpenAITTSClient` implementation. Handles:
- Chunking at 4096 characters (OpenAI's per-request limit), splitting on paragraph then sentence boundaries
- Sequential chunk processing with progress callbacks
- MP3 buffer concatenation (MP3 is a streamable format — concatenating frames produces valid MP3)
- Default voice: `onyx` (deep, authoritative — good for financial news)
- Default model: `tts-1-hd`

The interface allows swapping to Google Cloud TTS or ElevenLabs later without changing the generation pipeline.

### Audio Generation Endpoint

**File:** `app/api/audio/generate/route.ts`

**Methods:** POST (also aliased to GET for Vercel cron compatibility)

**Authentication:** Same as snapshot — `SNAPSHOT_SECRET` via header, query param, or Vercel cron Bearer token.

**Query params:**
- `?date=YYYY-MM-DD` — Generate for a specific date (defaults to latest brief)
- `?force=true` — Regenerate even if audio already exists

**Pipeline:**
1. Load brief via `daily-update-parser`
2. Check Redis for existing audio (skip unless `force=true`)
3. Load raw markdown for reliable section parsing
4. Preprocess: extract sections → per-section GPT-4o rewrite → regex normalize
5. Generate audio via TTS (chunked, ~30+ API calls)
6. Upload to Vercel Blob at `audio/daily-brief-YYYY-MM-DD.mp3`
7. Store metadata in Redis at `audio:episode:YYYY-MM-DD`

**Idempotent:** Won't regenerate if audio already exists for that date (unless `force=true`).

### RSS Podcast Feed

**File:** `lib/audio/podcast-feed.ts` + `app/api/podcast/feed/route.ts`

Generates RSS 2.0 XML with iTunes and Atom namespace extensions. Any podcast app can subscribe to `https://mentalmodelsobservatory.com/api/podcast/feed`.

**Feed metadata:**
- Title: "The Daily Brief — Mental Models Observatory"
- Category: Business > Investing
- Cover art: `/podcast-cover.jpg` (needs 3000×3000 for Apple Podcasts compliance)

**Episode metadata** is stored in Redis:
- `audio:episodes` — Sorted set of all episode dates (for chronological ordering)
- `audio:episode:YYYY-MM-DD` — Individual episode metadata (URL, duration, file size, title)

**Caching:** `s-maxage=3600, stale-while-revalidate=7200` — CDN caches for 1 hour.

### Audio Metadata Endpoint

**File:** `app/api/audio/[date]/route.ts`

**GET** `/api/audio/2026-03-02` returns episode metadata (audioUrl, duration, date, etc.). Used by the website's `AudioPlayer` component to find the MP3 URL.

Falls back to checking `public/audio/` for local test files when Redis is unavailable (common in local development).

### Audio Player

**File:** `components/daily-update/AudioPlayer.tsx`

Client component embedded in the brief page between the header and first section. Features:
- Play/pause, clickable seek bar, time display
- Speed selector: 1×/1.5×/2×/2.5×/3× (defaults to 2×)
- RSS feed URL copy button (for subscribing in podcast apps)
- Graceful states: loading spinner, "Audio edition coming soon" placeholder, full player
- Uses native HTML5 `<audio>` with `preload="metadata"` — no external dependencies
- Matches the site's espresso theme (amber accent, dark mode support)

### Local Development & Testing

**Test script:** `scripts/test-audio.mjs` — Generates audio locally without needing Vercel Blob or production Redis. Mirrors the same preprocessing pipeline as the production endpoint.

**Upload script:** `scripts/upload-audio.mjs` — Uploads a local MP3 to Vercel Blob and writes metadata to Redis. Use when generating audio locally and deploying to production.

**Local playback:** Place MP3 files in `public/audio/daily-brief-YYYY-MM-DD.mp3` — the audio metadata endpoint will find them automatically when Redis is unavailable.

---

## Infrastructure & Environment

### Services

| Service | Purpose | Tier |
|---------|---------|------|
| Vercel | Hosting, CDN, cron | Pro |
| Upstash Redis | Snapshot storage, audio metadata, CoinGecko cache | Free/Pro |
| Vercel Blob | MP3 file storage | Included in Vercel Pro (1GB) |
| OpenAI | GPT-4o (scriptwriter) + tts-1-hd (audio) | Pay-as-you-go |
| Yahoo Finance | Seed + snapshot historical data (all assets) | Free, no key |
| Finnhub | Live equity quotes + forex (DXY) | Free tier |
| CoinGecko | Live crypto metadata (dominance, DeFi, trending) | Demo key (10K calls/month) |
| Binance | Live crypto prices | No key needed |

### Environment Variables

```
UPSTASH_REDIS_REST_URL   — Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN — Upstash Redis REST token
SNAPSHOT_SECRET          — Auth secret for snapshot/audio generation endpoints
CRON_SECRET              — Vercel cron secret (defaults to SNAPSHOT_SECRET)
FINNHUB_API_KEY          — Finnhub free tier API key (live equity quotes + DXY forex)
COINGECKO_API_KEY        — CoinGecko demo API key (live crypto metadata)
OPENAI_API_KEY           — OpenAI API key (GPT-4o scriptwriter + tts-1-hd audio)
BLOB_READ_WRITE_TOKEN    — Vercel Blob storage token (MP3 uploads)
```

Note: Yahoo Finance (used by seed script and snapshot cron) requires no API key. Alpha Vantage and FRED are no longer used — all historical data comes from Yahoo Finance.

### Redis Key Map

| Key | Type | Contents | Written By |
|-----|------|----------|-----------|
| `dashboard:snapshot:latest` | String (JSON) | Full snapshot with all assets, changes, MAs | Snapshot cron |
| `dashboard:history:YYYY-MM-DD` | String (JSON) | Daily price snapshot (for historical queries) | Snapshot cron, seed script |
| `dashboard:manual` | String (JSON) | FedWatch, ETF flows, notes | PATCH endpoint |
| `dashboard:coingecko:global` | String (JSON) | CoinGecko enriched data (1hr TTL) | Live endpoint |
| `audio:episodes` | Sorted Set | All episode dates (score = unix timestamp) | Audio generate |
| `audio:episode:YYYY-MM-DD` | String (JSON) | Episode metadata (URL, duration, etc.) | Audio generate, upload script |

### Monthly Cost Estimate

- Vercel Pro: $20/mo
- OpenAI (audio): ~$15/mo (tts-1-hd at ~22 episodes × ~70K chars each)
- OpenAI (scriptwriter): ~$5/mo (GPT-4o, ~15 calls/episode × 22 episodes)
- Upstash Redis: Free tier (< 10K commands/day)
- Vercel Blob: Included (< 1GB/month at ~15MB/episode × 22 episodes = 330MB)
- APIs: All free tier
- **Total: ~$40/mo**

---

## Cron Schedule

Defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/dashboard/snapshot", "schedule": "0 11 * * 1-5" },
    { "path": "/api/audio/generate",    "schedule": "30 11 * * 1-5" }
  ]
}
```

- **11:00 UTC (6:00 AM ET):** Dashboard snapshot regeneration. Fetches today's prices from Yahoo Finance, reads history from Redis, calculates changes/MAs. Runs Monday–Friday.
- **11:30 UTC (6:30 AM ET):** Audio generation. Reads the latest brief, preprocesses via GPT-4o, generates TTS audio, uploads to Blob. Runs after snapshot so the dashboard data is fresh.

---

## Future Plans

### Phase 2: Subscriber Audio

Currently personal-use only (Jackson subscribes via Overcast). Phase 2 extends to website subscribers:
- Per-subscriber private RSS feeds with token-based authentication
- Subscriber management: invite, revoke, track listens
- May use Transistor.fm if per-subscriber feed management becomes complex enough to justify $49/mo
- Alternative: custom per-subscriber feed URLs with revocable tokens in Redis

### Audio Optimization

- Current episodes run ~50 minutes at 1× speed. Target: 20-30 minutes at 2-2.5×.
- Explore section-level duration budgets in the GPT-4o scriptwriter prompt
- Test `gpt-4o-mini-tts` with natural language voice instructions (available as upgrade path from OpenAI)
- Consider voice variety: different voice for different sections, or alternating voices for dialogue-style delivery

### Dashboard Enhancements

- **Seed script improvements:** `scripts/seed-prices.mjs` handles one-time historical backfill from Yahoo Finance. Currently manual — could be automated for new asset additions.
- **Additional assets:** Easy to add new ETFs to the equity list or new coins to the crypto list. Just add entries to the config arrays in both snapshot and live routes.
- **Intraday charts:** The architecture supports adding sparkline/mini charts — Finnhub provides intraday candle data on the free tier.
- **Alerts:** Redis pub/sub or webhook when an asset crosses a key level (MA crossover, percentage threshold)

### Podcast Cover Art

Need a 3000×3000 square image for Apple Podcasts directory compliance. Should use the site's existing espresso-gold design language — dark background, amber accent, "The Daily Brief" typography.
