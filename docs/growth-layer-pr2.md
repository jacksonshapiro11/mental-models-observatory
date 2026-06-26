# Growth Layer PR2 — Amplify

Implementation reference for Cosmic Trex (mental-models-observatory). PR2 ships on top of **PR1** (`fe60b7a`): publish/complete orchestrator, distribute dedup, welcome email, unsubscribe, Vercel Analytics, X OAuth.

**Product shift:** Super Brief (`-light.md`, ~3 min) is the primary surface. Full brief (`/daily-update`, ~8 min) is the deep edition.

**Brand:** Terminal/zine aesthetic. CT palette: dark `#0D0D0D`, yellow `#FFE600`, pink `#FF2E63`, green data `#00FF41`.

---

## Purpose

Make Super Brief easier to **share**, **preview on social**, **discover from homepage/nav**, and **attribute new subscribers** — without changing brief content or adding new platforms.

| PR1 (Ship) | PR2 (Amplify) |
|------------|---------------|
| Publish pipeline, email, X distribute | ShareBar on brief pages |
| Welcome + unsubscribe | Dynamic OG for Super Brief |
| Analytics, X OAuth | Homepage/nav hierarchy |
| | `?ref=` subscriber attribution |

---

## What was built

### 1. ShareBar

**Files:** `components/share/ShareBar.tsx`, integrated in `components/super-brief/SuperBriefViewer.tsx`, `components/daily-update/BriefViewer.tsx`

Client component with three share actions:

| Action | Behavior |
|--------|----------|
| **Share on X** | Opens `twitter.com/intent/tweet` with title prefill + canonical page URL |
| **Copy link** | `navigator.clipboard.writeText` with 2s “Copied!” feedback; `execCommand` fallback |
| **Email** | `mailto:` with subject (includes display date when set) and one-line pitch + URL |

**Props:** `title`, `path` (e.g. `/super-brief/2026-06-26`), optional `displayDate`, `variant` (`light` \| `dark`, default `light`).

**Placement:**
- **Super Brief:** after “The close”, before yellow “Read the full brief →” CTA (`variant` default light).
- **Full Brief:** after all sections, before pink subscribe CTA (`variant="dark"`).

URL resolution uses `window.location.origin + path` on client; falls back to `https://cosmictrex.com${path}` before hydration.

---

### 2. Dynamic OG images (Super Brief only)

**Files:**
- `app/api/og/super-brief/[date]/route.tsx` — `ImageResponse` route (1200×630 PNG)
- `lib/og-super-brief.ts` — metadata helper
- `app/super-brief/[date]/page.tsx` — `generateMetadata` wires OG + Twitter cards
- `app/super-brief/page.tsx` — hub uses latest brief date for OG when available

**Data resolution (in order):**
1. `getBriefLightByDate(date)` from `lib/brief-light-parser.ts` (`content/daily-updates/{date}-light.md`)
2. **Redis fallback:** `readMarketingPack(date)` from `lib/marketing/distribute-log.ts` (`marketing:pack:{date}`) — uses `dailyTitle`, `ogDescription`; display date derived from slug
3. No data → `404`

**Image layout:** CT terminal/zine card — dark background, yellow CT pill + `cosmic_trex` mono, “Super Brief · {displayDate}”, serif-weight headline, optional lede excerpt (~140 chars, markdown stripped), yellow footer bar with tagline + `cosmictrex.com` in pink.

**Metadata helper:**

```ts
import { superBriefOgImage } from '@/lib/og-super-brief';
// returns [{ url: `/api/og/super-brief/${date}`, width: 1200, height: 630, alt: ... }]
```

Wired into `openGraph.images` and `twitter.images` (`summary_large_image`) on dated and hub super-brief pages.

**Known gap:** Full brief OG (`/daily-update/[date]`) stays static/generic until v1.1.

---

### 3. Homepage + navigation + sitemap

**Homepage (`app/page.tsx`):**
- Primary CTA → `/super-brief` — “Read today's super brief →”
- Subline: “3 minutes · essential market signals”
- Secondary CTA → `/daily-update` — “Read the full brief →”

**Navigation (`components/layout/Navigation.tsx`):**
- Order: Super Brief → Full Brief → Archive → Models → About
- Renamed “Brief” → “Full Brief” (href unchanged: `/daily-update`)

**Footer (`components/layout/Footer.tsx`):** same link order and “Full Brief” label for consistency.

**Sitemap (`app/sitemap.ts`):** priorities reflect Super Brief as primary:

| URL pattern | Priority |
|-------------|----------|
| `/` | 1.0 |
| `/super-brief` (hub) | **0.9** |
| `/daily-update` (hub) | **0.7** |
| `/super-brief/{date}` | **0.85** |
| `/daily-update/{date}` | **0.7** |

---

### 4. Referral attribution (`?ref=`)

**Files:** `components/subscribe/SubscribeForm.tsx`, `app/api/subscribe/route.ts`

**Capture path:**
- User lands on any page with `?ref=partner-name` (e.g. `/subscribe?ref=partner`, `/super-brief?ref=partner`)
- `SubscribeForm` reads `ref` via `useSearchParams` (wrapped in `Suspense`)
- Optional prop `attribution` overrides URL value
- POST body includes `attribution` when set

**API storage:**
- `sanitizeAttribution()` — alphanumeric + hyphen, max 100 chars (`bad!!code` → `badcode`)
- Stored in Redis hash `subscribers:meta:{email}` as field `attribution`
- Console log: `ref:{attribution}` on new subscribe
- **Not** exposed in GET `/api/subscribe` (count only)
- No rewards, no email copy changes — attribution only

Existing `source` values unchanged: `hero`, `footer-cta`, `super-brief`, `daily-brief`, `subscribe-page`.

---

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/og/super-brief/[date]` | GET | Dynamic 1200×630 OG image for Super Brief edition |
| `/api/subscribe` | POST | Stores `attribution` in `subscribers:meta` when present |

---

## Components

| Component | Type | Role |
|-----------|------|------|
| `ShareBar` | client | X intent, copy link, mailto |
| `SubscribeForm` | client | Captures `?ref=` and POSTs attribution |
| `SuperBriefViewer` | client | Mounts ShareBar (light) |
| `BriefViewer` | client | Mounts ShareBar (dark) |

---

## Out of scope (PR2)

- LinkedIn, Bluesky, or other share targets
- Admin dashboard for attribution
- Dynamic OG for full brief (`/daily-update/[date]`) — v1.1
- Beehiiv or legacy email paths
- Brief markdown content changes
- Referral rewards / credit system
- Share-click Analytics events

---

## Testing / verification

```bash
npm run build   # must pass with zero type errors
```

**Manual checks:**

- [ ] **ShareBar — Super Brief:** `/super-brief` or dated URL. Share section above “Read the full brief”. X intent, copy, mailto all work.
- [ ] **ShareBar — Full Brief:** `/daily-update/{date}`. Dark variant above subscribe CTA.
- [ ] **OG route:** `GET /api/og/super-brief/{latest-date}` → 1200×630 PNG with daily title. Invalid date → 404.
- [ ] **OG metadata:** Page source or [opengraph.xyz](https://www.opengraph.xyz/) on `/super-brief/{date}` — `og:image` → `/api/og/super-brief/{date}`.
- [ ] **Homepage:** Primary CTA → `/super-brief`; “3 minutes” subline visible; secondary → `/daily-update`.
- [ ] **Nav:** “Super Brief” first, “Full Brief” second.
- [ ] **Sitemap:** `/sitemap.xml` — `/super-brief` priority 0.9, `/daily-update` hub 0.7.
- [ ] **Attribution:** `/subscribe?ref=testpartner` → submit email → Redis `subscribers:meta:{email}` has `attribution: testpartner`.
- [ ] **Sanitize:** `?ref=bad!!code` → stored as `badcode`.
- [ ] **Regression:** Subscribe without `?ref=` unchanged. PR1 paths untouched.

---

## Deployment notes

1. **No new env vars** — Redis/Resend already configured from PR1.
2. **OG runtime:** `export const runtime = 'nodejs'` on OG route. Uses system fonts (no custom font fetch required).
3. **Redis OG fallback:** Covers publish lag when `-light.md` is on remote but local/Vercel build hasn't pulled yet, or when pack exists from `generateDailyPack` before filesystem sync.
4. **Vercel:** OG images generate on-demand at `/api/og/super-brief/[date]`; no build-time asset needed.
5. **Push workflow:** `git pull --rebase origin main && git push origin main` per `REPO_WORKFLOW.md`.

---

## PR1 context (do not re-implement)

- `POST /api/publish/complete` — parallel audio, email, X, marketing pack
- Distribute dedup via Redis step logs
- Welcome email (`lib/email/welcome.ts`)
- HMAC unsubscribe (`/api/unsubscribe`)
- X OAuth (`/api/x-auth`, `lib/social/x-oauth.ts`)
- `marketing:pack:{date}` from `lib/marketing/generate-daily-pack.ts`

---

## File index

| File | Change |
|------|--------|
| `components/share/ShareBar.tsx` | **New** — share UI |
| `app/api/og/super-brief/[date]/route.tsx` | **New** — dynamic OG |
| `lib/og-super-brief.ts` | **New** — metadata helper |
| `components/super-brief/SuperBriefViewer.tsx` | ShareBar mount |
| `components/daily-update/BriefViewer.tsx` | ShareBar mount (dark) |
| `app/super-brief/[date]/page.tsx` | OG metadata |
| `app/super-brief/page.tsx` | Hub OG metadata |
| `app/page.tsx` | CTA hierarchy + 3-min copy |
| `components/layout/Navigation.tsx` | Nav reorder + rename |
| `components/layout/Footer.tsx` | Link order + rename |
| `app/sitemap.ts` | Priority bump for Super Brief |
| `components/subscribe/SubscribeForm.tsx` | `?ref=` capture |
| `app/api/subscribe/route.ts` | Attribution storage |
