# Mental Models Observatory 🧠

A comprehensive Next.js application showcasing **119 mental models** across 40 knowledge domains, fully integrated with **1,132 curated Readwise highlights**.

---

## 📊 Project Status

- ✅ **119 mental models** with complete data (20 recently updated with expanded content)
- ✅ **1,132 curated highlights** from Readwise (100% coverage)
- ✅ **40 knowledge domains** with tier-based organization
- ✅ **Production ready** - deployed on Vercel
- ✅ **Progress tracking** - LocalStorage-based user progress with visual indicators
- ✅ **Hybrid learning paths** - 100 curated paths + dynamic path generation

---

## 🆕 Recent Updates

### December 2025 - UI/UX Enhancements
- ✅ **Espresso-Gold Dark Mode** - Sophisticated brown and gold color scheme
  - Warm espresso backgrounds (`#2a1a0f`, `#3d2815`, `#4a2f1a`) instead of black
  - Gold accents (`#D4AF37`) for highlights and interactive elements
  - Theme toggle with persistent preference
  - Fully opaque modals and components in dark mode
- ✅ **Navigation Improvements**
  - Black Home button with white text in dark mode for visibility
  - Gold header with dark brown text and accents
  - Consistent espresso-gold theme across all pages

### November 2025 - Content Enhancement
- ✅ **20 models updated** with expanded, publication-quality content:
  - 9 models regenerated from scratch (13B, 14B, 15C, 18A, 18D, 19C, 20B, 20C, 20D)
  - 11 models enhanced with detailed principles and applications (5B, 13A, 14A, 15A, 19A, 32A, 32B, 35B, 36A, 36B, 38D)
- ✅ **Quick Start Guide** added with modal on homepage
- ✅ **"What is this?"** button prominently displayed
- ✅ **Visual progress indicators** throughout the app
- ✅ **Hybrid learning path system** with curated and dynamic paths

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0+
- Readwise API token ([get yours here](https://readwise.io/access_token))

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/mental-models-observatory.git
cd mental-models-observatory
npm install

# Configure environment
cp .env.local.example .env.local
# Add your READWISE_API_TOKEN to .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📁 Project Structure

```
mental-models-observatory/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Homepage
│   ├── models/[slug]/           # Individual model pages
│   ├── knowledge-domains/       # Domain browsing
│   └── api/readwise/            # Readwise API integration
│
├── components/
│   ├── content/                 # Content display components
│   │   ├── ReadwiseHighlights.tsx   # Main highlights display
│   │   ├── HighlightBlock.tsx       # Individual highlight card
│   │   └── SourceAttribution.tsx    # Book/author metadata
│   ├── layout/                  # Navigation, headers, footers
│   └── ui/                      # Base UI components
│       ├── ThemeToggle.tsx      # Dark/light mode toggle
│       └── QuickStartModal.tsx   # "What is this?" modal
│
├── lib/
│   ├── readwise-data.ts         # SOURCE OF TRUTH - All 119 models
│   ├── parse-all-domains.ts     # Highlight parsing + slug mappings
│   ├── readwise-highlights.ts   # API integration & caching
│   └── data.ts                  # Exports for components
│
├── Readwise website notes/      # Raw curated highlights (markdown/JSON)
│   ├── mental_models_8c_6e.md
│   ├── mental_models_curation_21-24.md
│   └── [15+ other curation files]
│
├── Mental Models Description/  # Updated text content (descriptions, principles, applications)
│   ├── mental_models_rewrite_1-7.txt
│   ├── mental_models_8_24.md
│   ├── mental_models_25_38.md
│   ├── mental_models_39_40.md
│   └── regenerated_models_missing.md  # 9 regenerated models with publication-quality content
│
├── scripts/
│   ├── export-all-models-simple.js           # Generate MENTAL_MODELS_COMPLETE.md
│   ├── export-readwise-highlights-complete.js # Generate MENTAL_MODELS_READWISE_HIGHLIGHTS.md
│   ├── simple-update-by-code.js              # Update lib/readwise-data.ts from description files (by code)
│   ├── update-remaining-models.js            # Update models with case-insensitive code matching
│   ├── replace-old-models-content.js         # Replace content in existing models
│   ├── compare-substance.js                  # Compare OLD vs NEW content for substance matching
│   ├── test-all-models.js                    # Verify all models have complete data
│   └── test-all-model-pages.js               # Test all model pages load successfully
│
└── docs/                        # Comprehensive documentation
    ├── QUICK_REFERENCE.md
    ├── DEVELOPMENT_GUIDE.md
    ├── TECHNICAL_ARCHITECTURE.md
    └── readwise-integration.md
```

---

## 🎯 Core Architecture

### Data Flow

```
Readwise website notes/       →    lib/parse-all-domains.ts    →    components/
(curated markdown/JSON)            (parsing + mapping)              (display)
                                            ↓
                                   lib/readwise-data.ts
                                   (SOURCE OF TRUTH)
```

### Key Files

| File | Purpose | When to Edit |
|------|---------|--------------|
| `lib/readwise-data.ts` | **Source of truth** - all 119 models with principles, applications, examples | Adding/editing model content |
| `Mental Models Description/*.md` | Updated text content (descriptions, principles, applications) | Updating model descriptions and principles |
| `lib/parse-all-domains.ts` | Slug mappings + highlight parsing logic | Fixing model ID mismatches |
| `Readwise website notes/*.md` | Raw curated highlights from Readwise | Adding new highlights |
| `components/content/ReadwiseHighlights.tsx` | Displays highlights on model pages | Changing highlight UI |

---

## ✏️ Making Changes

### Adding a New Model

1. **Add to source of truth** (`lib/readwise-data.ts`):
```typescript
{
  id: 'unique-model-id',
  code: 'A1', // Optional domain code
  name: 'Model Name',
  slug: 'model-name-slug',
  description: 'Clear description of the model',
  domain: 'Domain Name',
  domainSlug: 'domain-slug',
  principles: ['Core principle 1', 'Core principle 2'],
  applications: ['Real-world application 1', 'Application 2'],
  examples: ['Example 1', 'Example 2'],
  relatedModels: ['related-model-slug'],
  sources: [],
  tags: ['tag1', 'tag2'],
  difficulty: 'beginner', // or 'intermediate', 'advanced'
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}
```

2. **Add curated highlights** (create new file in `Readwise website notes/`):
```markdown
## Your Model

\`\`\`json
{
  "modelId": "unique-model-id",
  "modelTitle": "Model Name",
  "modelDescription": "Description matching the model",
  "curatedHighlights": [
    {
      "readwiseId": 123456789,
      "book": {
        "title": "Book Title",
        "author": "Author Name"
      },
      "relevanceScore": 9.5,
      "qualityScore": 9.2,
      "insightType": "foundational_concept",
      "curatorReason": "Why this highlight is relevant"
    }
  ]
}
\`\`\`
```

3. **Add slug mapping** (if model ID ≠ slug) in `lib/parse-all-domains.ts`:
```typescript
const MODEL_SLUG_MAPPINGS: { [key: string]: string } = {
  'model-name-slug': 'unique-model-id',
  // ... other mappings
};
```

4. **Regenerate markdown documents**:
```bash
node scripts/export-all-models-simple.js
node scripts/export-readwise-highlights-complete.js
```

5. **Test locally**:
```bash
npm run dev
# Visit http://localhost:3000/models/model-name-slug
```

### Editing an Existing Model

**Content changes** (descriptions, principles, applications):
- **Option 1**: Edit `lib/readwise-data.ts` directly
- **Option 2**: Update files in `Mental Models Description/` then run update script:
  ```bash
  node scripts/simple-update-by-code.js
  ```
  This script matches models by their unique `code` (e.g., "14B") and updates content even if names differ.

**Highlight changes** (add/remove/edit highlights):
- Edit the relevant file in `Readwise website notes/`
- Regenerate: `node scripts/export-readwise-highlights-complete.js`

**Slug mismatch** (model not showing highlights):
- Check model slug vs. modelId in highlights
- Add mapping to `MODEL_SLUG_MAPPINGS` in `lib/parse-all-domains.ts`
- Regenerate: `node scripts/export-readwise-highlights-complete.js`

**Comparing OLD vs NEW content** (to verify substance matches):
```bash
node scripts/compare-substance.js
```
This compares existing content in `lib/readwise-data.ts` with updated content in `Mental Models Description/` to verify substance consistency even when names differ.

### UI/Design Changes

| Component | Location | Purpose |
|-----------|----------|---------|
| Model page layout | `app/models/[slug]/page.tsx` | Overall page structure |
| Highlight display | `components/content/ReadwiseHighlights.tsx` | Fetches and displays all highlights |
| Individual highlight | `components/content/HighlightBlock.tsx` | Single highlight card design |
| Navigation | `components/layout/Navigation.tsx` | Top navigation bar |
| Homepage | `app/page.tsx` | Landing page |
| Theme toggle | `components/ui/ThemeToggle.tsx` | Dark/light mode switcher |
| Quick Start modal | `components/ui/QuickStartModal.tsx` | "What is this?" modal |
| Color system | `app/globals.css` | Espresso-gold CSS variables and dark mode styles |

---

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm run start            # Start production server

# Testing
node scripts/test-all-models.js        # Verify all 119 models have complete data
node scripts/test-all-model-pages.js   # Test all model pages load successfully (requires dev server)

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # TypeScript validation

# Documentation
node scripts/export-all-models-simple.js           # Generate MENTAL_MODELS_COMPLETE.md
node scripts/export-readwise-highlights-complete.js # Generate MENTAL_MODELS_READWISE_HIGHLIGHTS.md

# Content Updates
node scripts/simple-update-by-code.js              # Update lib/readwise-data.ts from description files (by code)
node scripts/compare-substance.js                  # Compare OLD vs NEW content for substance matching
```

---

## 🎨 Design System

### Espresso-Gold Color Palette

The application features a sophisticated espresso-gold color scheme with dark mode support:

#### Light Mode
- Clean white backgrounds with blue accents
- Standard dark text on light backgrounds

#### Dark Mode (Espresso-Gold Theme)
- **Background Colors**:
  - Dark: `#2a1a0f` (warm dark brown)
  - Medium: `#3d2815` (espresso brown)
  - Light: `#4a2f1a` (lighter brown)
  - Surface: `#5a3a22` (lightest brown)
- **Text Colors**:
  - Headings: `#F5EDE3` (cream)
  - Body: `#E5DACB` (light cream)
- **Accents**:
  - Gold: `#D4AF37` (gold highlights)
  - CTA Text: `#1A1410` (dark brown)

#### Theme Implementation
- CSS custom properties in `app/globals.css`
- Theme toggle with persistent localStorage preference
- Fully opaque modals and components in dark mode
- Consistent espresso-gold theme across all pages

### Tier-Based Organization

| Tier | Color | Purpose | Example Domains |
|------|-------|---------|----------------|
| **Tier 1** | Blue (`bg-blue-900`) | Foundational thinking frameworks | Philosophy, Logic |
| **Tier 2** | Orange (`bg-orange-600`) | Practical decision tools | Business Strategy, Psychology |
| **Tier 3** | Green (`bg-green-800`) | Domain-specific expertise | Evolution, Engineering |
| **Tier 4** | Purple (`bg-purple-400`) | Advanced integration | Systems Thinking |

### Typography
- **Primary**: Inter (sans-serif)
- **Highlights**: Serif font for quotes
- **Code**: JetBrains Mono

### Key Features
- Mobile-first responsive design
- Accessibility (ARIA, keyboard navigation)
- Smooth animations via Framer Motion
- Optimized performance with caching
- Dark mode with espresso-gold theme

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

2. **Connect to Vercel**:
   - Import repository at [vercel.com](https://vercel.com)
   - Add environment variable: `READWISE_API_TOKEN`
   - Deploy automatically on push

3. **Verify deployment**:
   - Check `/api/readwise/debug` for system status
   - Test a few model pages for highlight display

### Environment Variables

```env
# Required
READWISE_API_TOKEN=your_token_here

# Optional
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME="Mental Models Observatory"
```

---

## 📚 Generated Documentation

The project includes auto-generated markdown references:

| File | Content | Update Command |
|------|---------|----------------|
| `MENTAL_MODELS_COMPLETE.md` | All 119 models with principles, applications, examples | `node scripts/export-all-models-simple.js` |
| `MENTAL_MODELS_READWISE_HIGHLIGHTS.md` | All 1,132 highlights with full metadata | `node scripts/export-readwise-highlights-complete.js` |

---

## 🔍 Troubleshooting

### Model not showing highlights

1. Check slug mapping in `lib/parse-all-domains.ts`
2. Verify modelId in highlight file matches model's `id` or `slug`
3. Regenerate highlights: `node scripts/export-readwise-highlights-complete.js`
4. Check browser console for API errors

### Testing all models

```bash
# Verify data integrity
node scripts/test-all-models.js

# Test all pages load (requires dev server running)
npm run dev  # In one terminal
node scripts/test-all-model-pages.js  # In another terminal
```

**Expected output:**
- ✅ All 119 models have complete data
- ✅ All 119 pages return 200 status codes
- ✅ No timeouts or errors

### Build errors

```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

### API errors

- Verify `READWISE_API_TOKEN` in `.env.local`
- Check rate limits: `/api/readwise/debug`
- Review logs in Vercel dashboard (production)

---

## 📖 Complete Documentation

- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Commands, common tasks, quick fixes
- **[DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)** - Detailed development workflow
- **[TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)** - System architecture deep dive
- **[readwise-integration.md](docs/readwise-integration.md)** - Readwise API documentation

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **API**: Readwise integration
- **Deployment**: Vercel

---

## 🙏 Acknowledgments

Built with data from [Readwise](https://readwise.io/) and powered by [Next.js](https://nextjs.org/).

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mental-models-observatory/issues)
- **System Status**: `/api/readwise/debug`
- **Documentation**: `/docs/` folder

---

**Built for lifelong learners** 📚
