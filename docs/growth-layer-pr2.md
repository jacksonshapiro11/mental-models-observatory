# Growth Layer PR2 — Amplify

Self-contained implementation spec. Start from **`main` @ `fe60b7a`** (PR1 deployed: publish/complete orchestrator, distribute dedup, welcome email, unsubscribe, Analytics, X OAuth).

**Product:** Cosmic Trex — Super Brief is the primary surface (3-minute read, `-light.md`). Full brief remains the deep edition.

**Brand:** Terminal/zine aesthetic on marketing pages. CT palette: dark `#0D0D0D`, yellow `#FFE600`, pink `#FF2E63`, green data `#00FF41`.

---

## Goal

Make Super Brief easier to share, preview on social, discover from the homepage/nav, and attribute new subscribers — without changing brief content or adding new platforms.

---

## Out of scope (do not implement in PR2)

- LinkedIn, Bluesky, or other share targets
- Admin dashboard for attribution
- Dynamic OG for full brief (`/daily-update/[date]`) — defer to v1.1
- Beehiiv or any legacy email path
- Brief markdown content changes
- Referral rewards / credit system (store attribution only)

---

## Files to read before implementing

Read these first to match existing patterns:

| File | Why |
|------|-----|
| `app/page.tsx` | Homepage hero CTAs and copy |
| `components/layout/Navigation.tsx` | Nav link order and labels |
| `app/super-brief/page.tsx` | Latest super brief route |
| `app/super-brief/[date]/page.tsx` | Dated super brief + metadata |
| `components/super-brief/SuperBriefViewer.tsx` | Super Brief layout, subscribe CTA placement |
| `components/daily-update/BriefViewer.tsx` | Full brief layout, section rhythm |
| `components/subscribe/SubscribeForm.tsx` | Client subscribe POST shape |
| `app/api/subscribe/route.ts` | Redis subscriber storage |
| `app/sitemap.ts` | Priority values for brief routes |
| `lib/marketing/generate-daily-pack.ts` | `marketing:pack:{date}` shape in Redis |
| `lib/marketing/distribute-log.ts` | `readMarketingPack()` helper |
| `lib/brief-light-parser.ts` | `getBriefLightByDate()`, `BriefLight` type |
| `app/globals.css` | CT color tokens |

---

## 1. ShareBar component

### Create

**New file:** `components/share/ShareBar.tsx` (`'use client'`)

**Props:**

```ts
interface ShareBarProps {
  title: string;           // dailyTitle or fallback label
  path: string;            // path only, e.g. /super-brief/2026-06-26
  displayDate?: string;    // e.g. "Thursday, June 26, 2026"
  variant?: 'light' | 'dark'; // default 'light'
}
```

**Behavior:**

1. **X intent** — open `https://twitter.com/intent/tweet` with:
   - `text`: optional prefill from daily title, e.g. `"${title}"\n\nFrom today's Markets, Meditations & Mental Models:`
   - `url`: absolute page URL (build from `window.location.origin + path` on client; fallback `https://cosmictrex.com${path}` for SSR/href generation before hydration)

2. **Copy link** — `navigator.clipboard.writeText(url)` with 2s “Copied!” feedback; fallback `document.execCommand('copy')` for older browsers.

3. **Email** — `mailto:?subject=...&body=...` with subject including display date when available, body containing the URL and one-line pitch.

**Design (match existing brief CTAs):**

- Section wrapper: `font-mono` label “Share”, serif subhead “Know someone who'd want this?”
- Three buttons in a centered flex row: **Share on X** (primary), **Copy link**, **Email**
- **Light variant** (Super Brief): white bg, `border-t-[3px] border-ct-dark`, primary btn `bg-ct-dark text-ct-yellow`, secondary `border-ct-dark`
- **Dark variant** (Full Brief): `bg-ct-dark border-ct-yellow`, primary `bg-ct-yellow text-ct-dark`, secondary white/outline
- Button sizing: `font-mono text-[11px] font-semibold px-3.5 py-2 border-[1.5px]`

### Integrate

**`components/super-brief/SuperBriefViewer.tsx`**

- Import `ShareBar`
- Place **after** the last content section (e.g. “The close”) and **before** the yellow “Read the full brief →” CTA block
- Props: `title={brief.dailyTitle || 'Super Brief'}`, `path={`/super-brief/${brief.date}`}`, `displayDate={brief.displayDate}`, default `variant`

**`components/daily-update/BriefViewer.tsx`**

- Import `ShareBar`
- Place **after** all section blocks and **before** the pink subscribe CTA
- Props: `title={brief.dailyTitle || 'Daily Brief'}`, `path={`/daily-update/${brief.date}`}`, `displayDate={brief.displayDate}`, `variant="dark"`

---

## 2. Dynamic OG images (Super Brief only)

### Route

**New file:** `app/api/og/super-brief/[date]/route.tsx`

- Use `ImageResponse` from `next/og` (already bundled with Next.js — no separate `@vercel/og` install required)
- `export const runtime = 'nodejs'`
- Params: `{ date: string }` (YYYY-MM-DD)

**Data resolution (in order):**

1. `getBriefLightByDate(date)` from `lib/brief-light-parser.ts` — reads `content/daily-updates/{date}-light.md`
2. If null, **Redis fallback:** `readMarketingPack(date)` from `lib/marketing/distribute-log.ts` — key `marketing:pack:{date}`. Use `ogTitle`, `ogDescription`, `dailyTitle` from pack; derive display date from `date` slug if needed.
3. If still no data → `404`

**Image layout (1200×630):**

Terminal/zine OG card matching CT brand:

- Background `#0D0D0D`
- Top row: CT pill (`#FFE600` on dark) + `cosmic_trex` in mono gray
- Center: label `Super Brief · {displayDate}` in yellow mono uppercase
- Headline: `dailyTitle` (white, large serif-style weight via inline styles)
- Optional lede/epigraph excerpt (gray italic, ~140 chars, strip markdown)
- Footer bar: yellow top border, left tagline “Markets, Meditations & Mental Models”, right `cosmictrex.com` in pink mono

Return `new ImageResponse(jsx, { width: 1200, height: 630 })`.

### Metadata helper

**New file:** `lib/og-super-brief.ts`

```ts
export function superBriefOgImage(date: string): Metadata['openGraph']['images']
// returns [{ url: `/api/og/super-brief/${date}`, width: 1200, height: 630, alt: ... }]
```

### Wire metadata

**`app/super-brief/[date]/page.tsx`**

In `generateMetadata`, add to `openGraph.images` and `twitter.images`:

```ts
import { superBriefOgImage } from '@/lib/og-super-brief';

openGraph: { ..., images: superBriefOgImage(date) },
twitter: { card: 'summary_large_image', ..., images: [`/api/og/super-brief/${date}`] },
```

**`app/super-brief/page.tsx`** (latest / hub)

When `getLatestBriefLight()` returns a brief, use that brief's `date` for OG image URLs so `/super-brief` shares today's card.

**Known gap:** Full brief OG (`/daily-update/[date]`) stays static/generic until v1.1. Do not block PR2 on it.

---

## 3. Homepage + navigation + sitemap

### Homepage (`app/page.tsx`)

**Hero CTA hierarchy (right/zine column):**

| Current (main) | PR2 target |
|----------------|------------|
| Primary → `/daily-update` “Read today's brief →” | Primary → **`/super-brief`** “Read today's super brief →” |
| Secondary → `/super-brief` “Read the super brief →” | Secondary → **`/daily-update`** “Read the full brief →” |

**Copy:** Hero body/TLDR should mention **3 minutes** for the super brief path where natural (e.g. super brief = 3 min, full brief = 8 min). At minimum, the primary CTA area should communicate “3 minutes” — either in the button subline or adjacent helper text. Do not rewrite the entire homepage; focus the hierarchy shift.

Keep existing CT button classes (`bg-ct-dark text-ct-yellow`, secondary `bg-ct-pink`).

### Navigation (`components/layout/Navigation.tsx`)

**`NAV_LINKS` order and labels on main:**

```ts
{ label: 'Brief', href: '/daily-update' },
{ label: 'Super Brief', href: '/super-brief' },
```

**PR2 target:**

```ts
{ label: 'Super Brief', href: '/super-brief' },
{ label: 'Full Brief', href: '/daily-update' },  // renamed from "Brief"
```

Super Brief stays first. Rename only the full-brief label — href unchanged.

### Sitemap (`app/sitemap.ts`)

Adjust priorities to reflect Super Brief as primary:

| URL pattern | Current priority (main) | PR2 priority |
|-------------|-------------------------|--------------|
| `/super-brief` (hub) | 0.8 | **0.9** |
| `/daily-update` (hub) | 0.9 | **0.7** |
| `/super-brief/{date}` (each edition) | 0.6 | **0.85** (optional but recommended — above full brief editions) |
| `/daily-update/{date}` | 0.8 | **0.7** (optional alignment) |

Core pages (`/`, `/archive`, `/models`, etc.) unchanged unless needed for consistency.

---

## 4. Referral attribution

### Subscribe links — `?ref=` param

Any link that sends users to subscribe should support optional referral codes:

- `/subscribe?ref=partner-name`
- Brief pages with subscribe forms inherit `?ref=` from the **current page URL** (user lands on `/super-brief?ref=x`, form captures it)

No need to append `?ref=` to every internal link in PR2 — only ensure the **capture path works** when present.

### SubscribeForm (`components/subscribe/SubscribeForm.tsx`)

- Wrap inner logic in `Suspense` (required for `useSearchParams`)
- Read `const refFromUrl = searchParams.get('ref')`
- Optional prop `attribution?: string` — prop overrides URL
- On POST to `/api/subscribe`, include `attribution` in JSON body when set:

```json
{ "email": "...", "source": "hero", "attribution": "partner-name", "website": "" }
```

Existing `source` values stay: `hero`, `footer-cta`, `super-brief`, `daily-brief`, `subscribe-page`.

### Subscribe API (`app/api/subscribe/route.ts`)

Add sanitization and storage (main already has `subscribers:meta:{email}` hash with `email`, `subscribedAt`, `source`, `ip`):

```ts
function sanitizeAttribution(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const cleaned = value.trim().slice(0, 100).replace(/[^\w-]/g, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

const attribution = sanitizeAttribution(body.attribution ?? body.ref);
// in pipeline.hset: ...(attribution ? { attribution } : {}),
```

- Alphanumeric + hyphen only, max 100 chars
- Store field `attribution` in Redis hash — **no rewards, no downstream email changes**
- Log `ref:{attribution}` in console on new subscribe
- Do not expose attribution in GET `/api/subscribe` (count only)

---

## Implementation checklist

Single consolidated commit recommended.

| # | Task | File(s) |
|---|------|---------|
| 1 | Create ShareBar | `components/share/ShareBar.tsx` |
| 2 | Mount ShareBar on super brief | `components/super-brief/SuperBriefViewer.tsx` |
| 3 | Mount ShareBar on full brief | `components/daily-update/BriefViewer.tsx` |
| 4 | OG image route | `app/api/og/super-brief/[date]/route.tsx` |
| 5 | OG metadata helper | `lib/og-super-brief.ts` |
| 6 | Wire OG into super brief pages | `app/super-brief/[date]/page.tsx`, `app/super-brief/page.tsx` |
| 7 | Homepage CTA swap + 3-min copy | `app/page.tsx` |
| 8 | Nav reorder + rename | `components/layout/Navigation.tsx` |
| 9 | Sitemap priorities | `app/sitemap.ts` |
| 10 | SubscribeForm `?ref=` capture | `components/subscribe/SubscribeForm.tsx` |
| 11 | Subscribe API attribution storage | `app/api/subscribe/route.ts` |

---

## Test plan

Run after implementation:

- [ ] `npm run build` passes with zero type errors
- [ ] **ShareBar — Super Brief:** open `/super-brief` (or latest dated URL). Share section visible above “Read the full brief”. “Share on X” opens intent with title prefill + correct URL. “Copy link” copies canonical URL. “Email” opens mail client with subject/body.
- [ ] **ShareBar — Full Brief:** open `/daily-update/{date}`. Dark variant ShareBar above subscribe CTA. Same three actions work.
- [ ] **OG route:** `GET /api/og/super-brief/{latest-date}` returns 1200×630 PNG with daily title. Invalid date → 404.
- [ ] **OG metadata:** View page source or use [opengraph.xyz](https://www.opengraph.xyz/) on `/super-brief/{date}` — `og:image` points to `/api/og/super-brief/{date}`.
- [ ] **Homepage:** Primary CTA links to `/super-brief`; secondary to `/daily-update`. Copy mentions 3-minute super brief.
- [ ] **Nav:** “Super Brief” first, “Full Brief” second (not “Brief”).
- [ ] **Sitemap:** `/sitemap.xml` shows `/super-brief` priority 0.9, `/daily-update` priority 0.7.
- [ ] **Attribution:** Visit `/subscribe?ref=testpartner`, submit email. Confirm Redis hash `subscribers:meta:{email}` contains `attribution: testpartner` (via Upstash console or existing debug path). Re-submit same email → still success, no duplicate leak.
- [ ] **Attribution sanitize:** `?ref=bad!!code` → stored as `badcode` or rejected per sanitizer.
- [ ] **Regression:** Existing subscribe flow without `?ref=` unchanged. PR1 paths (welcome email, unsubscribe, distribute) untouched.

---

## Implementation notes

1. **Branch from fresh main:** `git pull --rebase origin main` before starting. Baseline commit: `fe60b7a`.
2. **One commit:** `feat: growth layer PR2 amplify — share, OG, homepage, attribution` (or similar conventional message).
3. **Build gate:** `npm run build` must pass before push.
4. **Push:** `git pull --rebase origin main && git push origin main` per `REPO_WORKFLOW.md`.
5. **Never read `.env`** — Redis/Resend keys already configured on Vercel from PR1.
6. **OG fonts:** `ImageResponse` uses system fonts unless you load custom fonts via `fetch` + `arrayBuffer`. PR2 can ship with system/serif fallbacks; custom Fraunces/JetBrains loading is a nice-to-have, not a blocker.
7. **Redis OG fallback:** Only needed when `-light.md` is missing but `marketing:pack:{date}` exists (publish lag). Primary path is always filesystem parser.
8. **Analytics:** PR1 Analytics events are out of scope unless you add share-click events later — do not add in PR2 unless explicitly requested.

---

## PR1 context (already on main — do not re-implement)

For reference only; PR2 builds on top:

- `POST /api/publish/complete` — parallel audio, email, X, marketing pack
- Distribute dedup via Redis step logs
- Welcome email on subscribe (`lib/email/welcome.ts`)
- HMAC unsubscribe (`/api/unsubscribe`, footer links)
- X OAuth token storage (`/api/x-auth`, `lib/social/x-oauth.ts`)
- `marketing:pack:{date}` written by `lib/marketing/generate-daily-pack.ts`

---

## Acceptance criteria

PR2 is done when:

1. Users can share any super brief or full brief edition via X, copy link, or email from an on-brand ShareBar.
2. Super brief URLs render dynamic OG images with the day's title when shared on X/Slack/iMessage.
3. Homepage and nav treat Super Brief as the primary product surface.
4. `?ref=` on subscribe URLs is captured and stored in `subscribers:meta` for future analytics.
5. `npm run build` passes; changes are on `main`.
