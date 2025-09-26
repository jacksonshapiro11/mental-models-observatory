# 🧠 Mental Models Observatory

A beautiful, comprehensive website showcasing a 40-domain mental models framework with **100% Readwise integration** - every model displays rich, curated insights from your knowledge base.

## 🎯 Project Overview

The Mental Models Observatory is a curated collection of **119 mental models** organized across 40 domains of knowledge. Each mental model includes:

- **Core Principles**: Fundamental concepts and rules
- **Real-world Examples**: Practical applications and case studies
- **🎯 Readwise Highlights**: 10+ curated insights per model with full source attribution
- **Source Attribution**: Complete transparency through Readwise integration
- **Related Models**: Connections to other frameworks
- **Difficulty Levels**: Beginner, intermediate, and advanced classifications

## 🚀 **NEW: Complete Readwise Integration**

**✅ 100% Success Rate**: All 119 models now display rich Readwise highlights!

- **10+ curated insights per model** on average
- **Full author, book, and curator information**
- **Quality and relevance scores** for each highlight
- **Deep insights** from your curated knowledge base
- **Conservative mapping approach** - only high-quality semantic matches

## 🚀 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict configuration
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **API Integration**: Readwise API for source management
- **Deployment**: Vercel (optimized)

## 📋 Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) 18.0 or later
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- [Readwise account](https://readwise.io/) with API token
- Your 40-domain mental models framework document

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mental-models-observatory.git
cd mental-models-observatory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment template and configure your variables:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Readwise API Configuration
READWISE_API_TOKEN=your_readwise_api_token_here

# Next.js Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME="Mental Models Observatory"

# Content Management
NEXT_PUBLIC_CONTACT_EMAIL=your_email@example.com
NEXT_PUBLIC_GITHUB_URL=https://github.com/yourusername/mental-models-observatory

# Feature Flags
NEXT_PUBLIC_ENABLE_SEARCH=true
NEXT_PUBLIC_ENABLE_COMMENTS=false
NEXT_PUBLIC_ENABLE_SOCIAL_SHARING=true
```

### 4. Get Your Readwise API Token

1. Go to [Readwise](https://readwise.io/) and sign in
2. Navigate to Settings → API Keys
3. Generate a new API token
4. Add it to your `.env.local` file

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
mental-models-observatory/
├── app/                    # Next.js App Router pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout (with Navigation & Footer)
│   ├── page.tsx           # Homepage
│   ├── search/            # Search functionality
│   │   └── page.tsx       # Search page
│   ├── api/               # API routes
│   │   └── readwise/      # Readwise API integration
│   ├── domains/           # Domain pages
│   │   └── [slug]/        # Dynamic domain routes
│   └── models/            # Model pages
│       └── [slug]/        # Dynamic model routes
├── components/            # React components
│   ├── ui/               # Base UI components + responsive/accessibility
│   │   ├── ResponsiveContainer.tsx
│   │   ├── ResponsiveGrid.tsx
│   │   ├── MobileOptimized.tsx
│   │   ├── AccessibilityEnhanced.tsx
│   │   └── index.ts      # All UI exports
│   ├── layout/           # Navigation, headers, layout components
│   │   ├── Navigation.tsx    # Mobile-optimized navigation
│   │   ├── PageHeader.tsx    # Tier-aware page headers
│   │   ├── ContentLayout.tsx # Flexible content layouts
│   │   ├── Breadcrumbs.tsx   # Tier-colored breadcrumbs
│   │   ├── TableOfContents.tsx
│   │   ├── SearchInterface.tsx
│   │   ├── Footer.tsx        # Comprehensive footer
│   │   └── index.ts
│   └── content/          # Domain & model specific components
│       ├── DomainCard.tsx    # Tier-styled domain cards
│       ├── SubModelCard.tsx  # Expandable model previews
│       ├── HighlightBlock.tsx # Beautiful quote display
│       ├── SourceAttribution.tsx # Book source info
│       ├── RelatedModels.tsx # Connected models carousel
│       ├── SearchResults.tsx # Advanced search results
│       └── index.ts
├── lib/                  # Utility libraries
├── types/                # TypeScript type definitions
├── data/                 # Static data files
└── public/               # Static assets
```

## ✅ Implementation Status

### 🎯 **Readwise Integration (100% Complete)**
- ✅ **All 119 models working** - Complete highlight coverage
- ✅ **Conservative mapping approach** - Only high-quality semantic matches applied
- ✅ **Comprehensive slug mapping** - Fixed 55+ broken models with proper mappings
- ✅ **Missing models resolved** - Added curated highlights for final 8 models
- ✅ **API integration** - Robust caching, error handling, and rate limiting
- ✅ **Source attribution** - Full author, book, curator information displayed

### 🎨 Content Components (Phase 4A)
- ✅ **DomainCard** - Tier-based styling, stats, hover effects, progress indicators
- ✅ **SubModelCard** - Expandable previews, difficulty badges, related model hints
- ✅ **HighlightBlock** - Beautiful typography, source attribution, copy/share features
- ✅ **SourceAttribution** - Book covers, relevance scoring, reading progress
- ✅ **RelatedModels** - Horizontal carousel, relationship types, cross-domain connections
- ✅ **SearchResults** - Grouped results, advanced filtering, snippet highlighting
- ✅ **ReadwiseHighlights** - NEW: Displays curated insights with full metadata

### 🏗️ Layout Components (Phase 4B)
- ✅ **Navigation** - Tier dropdowns, mobile hamburger, search integration, breadcrumbs
- ✅ **PageHeader** - Hero sections, tier theming, stats display, action buttons
- ✅ **ContentLayout** - Sidebar support, reading progress, mobile optimization
- ✅ **Breadcrumbs** - Tier-aware styling, truncation, home navigation
- ✅ **TableOfContents** - Auto-generation, scroll tracking, collapsible sections
- ✅ **SearchInterface** - Autocomplete, suggestions, recent searches
- ✅ **Footer** - Framework overview, tier navigation, newsletter signup

### 📱 Responsive & Accessibility Features
- ✅ **Mobile-first design** - Touch optimization, gesture support
- ✅ **Accessibility compliance** - ARIA support, keyboard navigation, screen readers
- ✅ **Performance optimization** - Lazy loading, memoization, virtual scrolling ready
- ✅ **Component library** - Fully typed, documented, reusable

## 🎨 Design System

### Tier-Based Color System
- **Foundational (Tier 1)**: Blue tones - Core thinking frameworks
- **Practical (Tier 2)**: Green tones - Applied decision tools  
- **Specialized (Tier 3)**: Purple tones - Domain-specific models
- **Accent**: Orange - Highlights and CTAs
- **Neutral**: Gray scale - Supporting elements

### Typography
- **Sans**: Inter - Primary text and UI
- **Serif**: For quotes and highlights
- **Mono**: JetBrains Mono - Code and technical content

### Component Features
- Tier-aware color coding throughout
- Smooth hover animations and transitions
- Mobile-optimized touch targets (44px minimum)
- Consistent spacing and layout patterns
- Accessible focus states and keyboard navigation

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run type-check       # TypeScript type checking
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Utilities
npm run clean            # Clean build artifacts
npm run analyze          # Analyze bundle size
```

## 📚 Adding Content

### 1. Mental Models

Add new mental models in `lib/data.ts`:

```typescript
{
  id: 'your-model-id',
  name: 'Your Model Name',
  slug: 'your-model-slug',
  description: 'Brief description of the model',
  domain: 'Domain Name',
  domainSlug: 'domain-slug',
  principles: ['Principle 1', 'Principle 2'],
  examples: ['Example 1', 'Example 2'],
  applications: ['Application 1', 'Application 2'],
  relatedModels: ['related-model-1', 'related-model-2'],
  sources: [/* source objects */],
  tags: ['tag1', 'tag2'],
  difficulty: 'intermediate',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}
```

### 2. Domains

Add new domains in `lib/data.ts`:

```typescript
{
  id: 'domain-id',
  name: 'Domain Name',
  slug: 'domain-slug',
  description: 'Domain description',
  color: '#3B82F6',
  icon: 'icon-name',
  models: ['model-1', 'model-2'],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}
```

### 3. Readwise Integration

**🎯 COMPLETE**: All 119 models now display rich Readwise highlights automatically!

The project uses a comprehensive mapping system to connect model slugs with Readwise highlights:

1. **Automatic highlight fetching** - No manual tagging required
2. **Conservative mapping approach** - Only high-quality semantic matches
3. **Comprehensive coverage** - 100% of models now working
4. **Rich metadata display** - Author, book, curator, quality scores
5. **Caching & performance** - Optimized API calls with 5-minute file cache

**Key files:**
- `lib/parse-all-domains.ts` - Main parsing logic with comprehensive slug mappings
- `lib/readwise-highlights.ts` - API integration and caching
- `components/content/ReadwiseHighlights.tsx` - Display component
- `Readwise website notes/` - Curated highlight data

## 🚀 Deployment

### Vercel (Recommended)

1. ✅ **Code pushed to GitHub** - All changes committed and pushed
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `READWISE_API_TOKEN` - Your Readwise API token
   - `NEXT_PUBLIC_SITE_URL` - Your production URL
   - `NEXT_PUBLIC_SITE_NAME` - "Mental Models Observatory"
4. Deploy automatically on push

**🎯 Ready for deployment** - All 119 models with Readwise highlights working!

## 🏆 Major Achievements

### 📊 **Readwise Integration Success**
- **Started**: 64/119 models working (54% success rate)
- **Achieved**: 119/119 models working (100% success rate)
- **Fixed**: 55+ broken models with comprehensive slug mappings
- **Added**: Curated highlights for 8 missing models
- **Approach**: Conservative mapping - only high-quality semantic matches

### 🔧 **Technical Improvements**
- **Robust JSON parsing** - Handles corrupted files with syntax fixing
- **Comprehensive caching** - 5-minute file cache, 1-hour API cache
- **Error handling** - Graceful fallbacks for API failures
- **Performance optimization** - Rate limiting and deduplication
- **Conservative approach** - Avoided overfitted mappings

### 📈 **User Experience**
- **Rich highlights** - 10+ curated insights per model on average
- **Full metadata** - Author, book, curator, quality scores
- **Self-contained learning** - No external navigation required
- **Mobile optimized** - Responsive design throughout
- **Accessibility** - ARIA support and keyboard navigation

### Manual Deployment

```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Readwise](https://readwise.io/) for source management
- [Next.js](https://nextjs.org/) for the framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Framer Motion](https://www.framer.com/motion/) for animations
- [Lucide](https://lucide.dev/) for icons

## 📞 Support

For questions or support:

- Email: [your-email@example.com](mailto:your-email@example.com)
- GitHub Issues: [Create an issue](https://github.com/yourusername/mental-models-observatory/issues)
- Documentation: [Project Wiki](https://github.com/yourusername/mental-models-observatory/wiki)

---

**Built with ❤️ for the mental models community**
