# 🧠 Mental Models Observatory

A beautiful, comprehensive website showcasing a 40-domain mental models framework with full source transparency through Readwise integration.

## 🎯 Project Overview

The Mental Models Observatory is a curated collection of intellectual frameworks organized across 40 domains of knowledge. Each mental model includes:

- **Core Principles**: Fundamental concepts and rules
- **Real-world Examples**: Practical applications and case studies
- **Source Attribution**: Complete transparency through Readwise integration
- **Related Models**: Connections to other frameworks
- **Difficulty Levels**: Beginner, intermediate, and advanced classifications

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
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   ├── api/               # API routes
│   │   └── readwise/      # Readwise API integration
│   ├── domains/           # Domain pages
│   │   └── [slug]/        # Dynamic domain routes
│   └── models/            # Model pages
│       └── [slug]/        # Dynamic model routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Layout components
│   └── content/          # Content-specific components
├── lib/                  # Utility libraries
│   ├── utils.ts          # General utilities
│   ├── readwise.ts       # Readwise API functions
│   └── data.ts           # Data management
├── types/                # TypeScript type definitions
├── data/                 # Static data files
├── styles/               # Additional styles
└── public/               # Static assets
```

## 🎨 Design System

The project uses a custom design system built with Tailwind CSS:

### Colors
- **Primary**: Blue (#0ea5e9) - Main brand color
- **Secondary**: Gray (#64748b) - Supporting elements
- **Accent**: Yellow (#eab308) - Highlights and CTAs
- **Success**: Green (#22c55e) - Positive states
- **Warning**: Orange (#f59e0b) - Caution states
- **Error**: Red (#ef4444) - Error states

### Typography
- **Sans**: Inter - Primary text
- **Serif**: Merriweather - Headings and quotes
- **Mono**: JetBrains Mono - Code and technical content

### Components
- Responsive cards with hover effects
- Animated transitions with Framer Motion
- Accessible form elements
- Consistent spacing and layout

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

The project automatically fetches highlights from Readwise. To add source attribution:

1. Tag your highlights in Readwise with relevant tags
2. The API will fetch and display them on model pages
3. Update the `filterHighlightsByTags` function in `lib/readwise.ts` to match your tagging system

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

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
