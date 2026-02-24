# Mental Models Observatory - Project Context for Claude Code

## Project Overview

Building the "Mental Models Observatory" - a Next.js website showcasing a 40-domain intellectual framework with 200+ mental models, featuring complete source transparency through Readwise integration and AI-powered navigation.

## Technical Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design system
- **Deployment**: Vercel
- **APIs**: Readwise API for highlights integration
- **AI**: Claude Haiku for cheap conversational navigation (~$2-5/month)
- **Storage**: Browser localStorage (no backend/database)

## Architecture Decisions

**Database-Free Approach:**
- Static JSON files for framework data
- Readwise API for highlights
- Browser localStorage for user memory/personalization
- No user accounts or authentication needed

**Cost-Optimized AI:**
- Pattern matching for 70% of common queries (free)
- Claude Haiku API for complex queries ($0.00025 per 1K tokens)
- Hybrid approach keeps costs under $5/month

## Core Data Structure

```typescript
interface Domain {
  id: string
  slug: string
  title: string
  tier: 1 | 2 | 3 // Foundational, Practical, Specialized
  description: string
  integrationStatement: string
  subModels: SubModel[]
  curatedHighlights: CuratedHighlight[] // Top 10 domain-level
}

interface SubModel {
  id: string
  domainId: string
  slug: string
  title: string
  definition: string
  keyApplications: string[]
  curatedHighlights: CuratedHighlight[] // Exactly 10 best supporting highlights
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  practicalValue: number // 1-10 scale
}

interface CuratedHighlight {
  readwiseId: number
  text: string
  personalNote?: string
  book: BookReference
  relevanceScore: number // 8.5-10.0 (only highest quality)
  curatorReason: string // Why this highlight was selected
  insightType: 'definition' | 'example' | 'application' | 'counterpoint'
}
```

## Design System

**Color Palette:**
- Tier 1 (Foundational): Deep Blue (#1e40af)
- Tier 2 (Practical): Warm Red (#dc2626)
- Tier 3 (Specialized): Forest Green (#059669)
- Accent: Golden (#f59e0b)
- Text: Rich Dark (#1f2937), Medium Gray (#6b7280), Light Gray (#9ca3af)
- Backgrounds: Soft White (#fafafa), Pure White (#ffffff)

**Typography:**
- Font: Inter Variable (headings and body)
- Code/Quotes: JetBrains Mono
- Scale: Display (3.5rem) → H1 (2.25rem) → Body (1rem) → Caption (0.75rem)
- Line heights: Headings (1.2), Body (1.6), Code (1.5)

**Philosophy**: "Paul Graham's essays meets Stripe documentation" - content-first, clean, accessible

## Key Features Implementation Priority

**Phase 1 - Foundation (Prompts 1-6):**
1. Next.js project setup with TypeScript + Tailwind
2. Design system and UI component library
3. Readwise API integration
4. Core page components (Domain cards, Highlight blocks, etc.)
5. Page implementations (Landing, Domain pages, Model detail pages)
6. Data architecture with curated highlights

**Phase 2 - AI Navigation (Prompt 7):**
7. Intelligent AI navigation system combining search + conversational guidance

**Phase 3 - Polish (Prompts 8-9):**
8. Mobile-first optimization
9. Production deployment with SEO + performance optimization

## AI Navigation System

**Core Concept**: Replace complex navigation with conversational AI guide that understands user intent and provides curated journeys.

**Implementation**:
```typescript
class HybridAIGuide {
  // Pattern matching for common queries (free)
  private checkPreWrittenResponses(input: string): GuideResponse | null
  
  // Claude Haiku for complex queries (cheap)
  private async getAIResponse(input: string, context: UserContext): Promise<GuideResponse>
  
  // Browser memory for personalization
  private updateUserMemory(interaction: UserInteraction): void
}
```

**Example Interactions:**
- "I'm interested in decision making" → Curated path through decision models
- "I just read Thinking Fast and Slow" → Models building on Kahneman's work
- "Show me something surprising" → Random high-quality model discovery

**Memory System (localStorage)**:
```typescript
interface UserMemory {
  visitedModels: string[]
  searchQueries: string[]
  interests: string[] // inferred from behavior
  sessionStart: number
  lastActive: number
}
```

## File Structure

```
mental-models-observatory/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                 // Landing page
│   ├── domains/[slug]/page.tsx  // Domain pages
│   ├── models/[slug]/page.tsx   // Model detail pages
│   ├── daily-update/            // Daily Brief
│   │   ├── page.tsx            // Latest brief
│   │   ├── [date]/page.tsx     // Archive route
│   │   └── layout.tsx          // Full-bleed layout
│   └── api/
│       ├── readwise/            // Readwise API routes
│       └── ai-guide/            // AI navigation endpoint
├── content/
│   └── daily-updates/           // Daily Brief markdown files
├── components/
│   ├── ui/                      // Base UI components
│   ├── layout/                  // Layout components
│   ├── content/                 // Content-specific components
│   ├── daily-update/            // Daily Brief renderer
│   │   └── BriefViewer.tsx     // Main brief client component
│   └── navigation/              // AI guide components
├── lib/
│   ├── readwise.ts             // Readwise API client
│   ├── daily-update-parser.ts  // Brief markdown → structured data
│   ├── data.ts                 // Data management
│   ├── ai-guide.ts             // AI navigation logic
│   └── utils.ts                // Utilities
├── types/
│   ├── models.ts               // Core data types
│   ├── readwise.ts             // Readwise API types
│   └── navigation.ts           // AI guide types
└── data/
    ├── domains.json            // Framework structure
    ├── highlights.json         // Curated highlights
    └── books.json              // Book references
```

## Daily Brief System (February 2026)

A full daily intelligence brief system at `/daily-update`, driven by markdown files.

**Architecture:**
- `content/daily-updates/YYYY-MM-DD.md` — Source markdown files (one per day)
- `lib/daily-update-parser.ts` — Parses markdown into structured `DailyBrief` with typed sections
- `components/daily-update/BriefViewer.tsx` — Client component with section-specific renderers, sticky nav, progress bar, status badges
- `app/daily-update/page.tsx` — Server component loading latest brief
- `app/daily-update/[date]/page.tsx` — Hidden archive route (easter egg, not linked anywhere)
- `app/daily-update/layout.tsx` — Full-bleed layout override

**Section types:** dashboard, the-six, the-take, big-stories, tomorrows-headlines, watchlist, discovery, worldview-updates, ref-big-stories, ref-tomorrows

**Key patterns:**
- Dual-mode Tailwind classes: `text-neutral-900 dark:text-[var(--espresso-h1)]`
- Status inference from title keywords (developing, elevated, accelerating, etc.)
- `parseBlocks()` splits content into typed blocks (table, h2, h3, list, numbered-list, italic, paragraph)
- IntersectionObserver for scroll-based active section tracking
- Sticky header stacking: site header `z-[70] top-0`, progress bar `z-[60] top-[57px]`, section nav `z-50 top-[58px]`

**Design philosophy:** Ephemeral — `/daily-update` always shows today's brief only. Past briefs are stored for internal worldview tracking but are intentionally not discoverable. Hidden archive route exists as easter egg.

**Deployment:** Add markdown file to `content/daily-updates/`, git push, Vercel auto-deploys.

## Current Implementation Status

**Completed:**
- Project architecture and planning
- Detailed prompts for all phases
- Data structure design
- AI navigation system design
- Daily Brief system with markdown-driven content
- Blog feature with Word doc conversion
- Espresso-Gold dark mode theme
- Twitter automation

**Next Steps:**
1. Automate Daily Brief generation (API + scheduled workflow)
2. Dashboard data automation (price APIs)
3. Archive retrieval for internal analysis (worldview evolution tracking)

## Key Implementation Notes

**Readwise Integration:**
- Use curated highlights (10 per model) rather than raw API data
- Focus on quality over quantity for website display
- Maintain source attribution for all highlights

**AI Guide Constraints:**
- Keep costs minimal (~$5/month max)
- No user authentication required
- Works entirely in browser with localStorage
- Graceful fallback to search if AI unavailable

**Performance Targets:**
- First contentful paint < 1.5 seconds
- Lighthouse score > 95 all categories
- Mobile-first responsive design
- Accessibility compliant (WCAG 2.1 AA)

**SEO Optimization:**
- Dynamic meta tags for all pages
- Structured data for educational content
- XML sitemap generation
- Open Graph images for social sharing

## Success Criteria

**Technical:**
- Fast, beautiful website showcasing intellectual framework
- Intelligent navigation that prevents user overwhelm
- Complete source transparency for all insights
- Mobile-optimized reading experience

**User Experience:**
- Users can easily discover relevant mental models
- Clear learning paths through complex framework
- Feels like having a knowledgeable guide
- Beautiful presentation of intellectual work

**Business:**
- Minimal ongoing costs (<$10/month)
- No complex infrastructure to maintain
- Easy to update with new content
- SEO-optimized for discoverability

This context should provide everything needed to implement the Mental Models Observatory using Claude Code.