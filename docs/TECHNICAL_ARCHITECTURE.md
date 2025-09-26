# Technical Architecture - Mental Models Observatory

## System Overview

The Mental Models Observatory is built on Next.js 14 with a sophisticated Readwise integration system that achieved 100% model coverage through a comprehensive slug mapping architecture.

## Core Architecture Challenge

### The Fundamental Problem
We discovered two completely separate datasets with **zero initial overlap**:

1. **Static Framework** (`lib/readwise-data.ts`): 119 models with generic slugs
   - Example: `time-mortality-awareness-1a`, `physics-fundamental-constraints-2b`
   - Systematic naming: `domain-name-##letter` pattern

2. **Readwise Curation Data** (`Readwise website notes/`): Rich highlight data with descriptive slugs  
   - Example: `memento-mori-death-as-teacher`, `energy-core-resource-ultimate-constraint`
   - Descriptive naming: Human-readable, semantic slugs

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SLUG MAPPING SYSTEM                         │
│                 (lib/parse-all-domains.ts)                     │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Static Framework  │    │  MODEL_SLUG_MAPPINGS │    │  Readwise Curation │
│                     │───▶│                     │◀───│                     │
│ Generic Slugs       │    │  70+ Manual Mappings │    │ Descriptive Slugs   │
│ time-mortality-1a   │    │                     │    │ memento-mori-death  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Data Flow Architecture

### 1. File Parsing Layer
```typescript
// 15+ domain files in various formats
Readwise website notes/
├── domains-26-30-curation.md      // Markdown with JSON blocks
├── domain_13_curation.md          // Pure JSON (despite .md extension)
├── psychology-domain6-highlights.json  // Standard JSON array
├── domain8-philosophy-highlights.txt   // JSON in .txt file
├── domains_9_10_11_12 curation.txt    // Nested JSON structure
└── missing_models.md               // User-curated final models
```

### 2. Parsing Strategy
```typescript
function parseAllDomainFiles() {
  // Auto-detect file format
  if (content.startsWith('[') || content.startsWith('{')) {
    return parseJsonFile(content);  // Pure JSON
  } else if (content.includes('```json')) {
    return parseMarkdownFile(content);  // Markdown with JSON blocks
  } else {
    return parseTextFile(content);  // Text file with JSON content
  }
}
```

### 3. JSON Cleaning Pipeline
```typescript
function fixJsonSyntax(jsonString: string): string {
  return jsonString
    .replace(/^\uFEFF/, '')                    // Remove BOM
    .replace(/,(\s*[}\]])/g, '$1')            // Remove trailing commas
    .replace(/[\x00-\x1F\x7F]/g, '')         // Remove control characters
    .replace(/,(\s*)$/, '')                   // Remove final trailing comma
    .replace(/([^\\])"([^"]*)"([^,}\]:])/g, '$1"$2\\"$3'); // Fix unescaped quotes
}
```

### 4. Slug Mapping System
```typescript
const MODEL_SLUG_MAPPINGS: Record<string, string> = {
  // Tier 1: Time & Mortality (1a-1d)
  'time-mortality-awareness-1a': 'memento-mori-death-as-teacher',
  'time-mortality-awareness-1b': 'time-scarcity-priority-setting',
  
  // Tier 2: Physics & Constraints (2a-2e)  
  'physics-fundamental-constraints-2a': 'thermodynamics-entropy-constraints',
  'energy-resource-flows-3a': 'energy-core-resource-ultimate-constraint',
  
  // High-confidence semantic matches (55+ mappings)
  'competitive-advantage-sustainable-moats': 'sustainable-competitive-advantages',
  'probabilistic-thinking-base-rate-neglect': 'base-rate-neglect',
  'systems-thinking-feedback-loops': 'feedback-loops-reinforcing-balancing',
  // ... 70+ total mappings
};
```

## Component Architecture

### Frontend Integration
```typescript
// Model Page Integration
function ModelPage({ slug }: { slug: string }) {
  return (
    <div>
      <ModelContent />
      <ReadwiseHighlights modelSlug={slug} />  {/* Seamless integration */}
    </div>
  );
}

// ReadwiseHighlights Component
function ReadwiseHighlights({ modelSlug }: { modelSlug: string }) {
  const [highlights, setHighlights] = useState<CuratedHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/readwise/highlights/${modelSlug}`)
      .then(res => res.json())
      .then(data => setHighlights(data.curatedHighlights));
  }, [modelSlug]);
  
  // Render rich metadata with error handling
}
```

### API Layer
```typescript
// GET /api/readwise/highlights/[modelSlug]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ modelSlug: string }> }
) {
  const { modelSlug } = await params;
  
  // 1. Get highlights from all domain files
  const highlights = await getModelHighlightsFromAllDomains(modelSlug);
  
  // 2. Apply caching (5-minute TTL)
  // 3. Return structured data with metadata
  
  return Response.json({
    modelSlug,
    curatedHighlights: highlights,
    totalCount: highlights.length
  });
}
```

## Caching Architecture

### Multi-Layer Caching Strategy
```typescript
// 1. File Parsing Cache (5-minute TTL)
const fileCache = new Map<string, { data: any; timestamp: number }>();

// 2. API Response Cache (1-hour TTL)  
const apiCache = new Map<string, { response: any; timestamp: number }>();

// 3. Component-Level Caching
const [cachedHighlights, setCachedHighlights] = useState(new Map());
```

### Cache Key Strategy
```typescript
// File cache keys
const fileKey = `parse_${fileName}_${lastModified}`;

// API cache keys  
const apiKey = `highlights_${modelSlug}`;

// Cache invalidation
if (Date.now() - cached.timestamp > TTL) {
  cache.delete(key);  // Automatic cleanup
}
```

## Error Handling & Resilience

### JSON Parsing Resilience
```typescript
function parseWithFallback(content: string): ModelHighlights[] {
  try {
    return JSON.parse(fixJsonSyntax(content));
  } catch (error) {
    // Fallback: Extract partial models with regex
    return extractPartialModels(content);
  }
}

function extractPartialModels(content: string): ModelHighlights[] {
  // Last resort: Find complete JSON objects with regex
  const jsonObjectRegex = /\{[^{}]*"readwiseId"[^{}]*\}/g;
  const matches = content.match(jsonObjectRegex) || [];
  
  return matches
    .map(match => {
      try { return JSON.parse(match); } 
      catch { return null; }
    })
    .filter(Boolean);
}
```

### API Error Handling
```typescript
// Graceful degradation
try {
  const highlights = await getModelHighlights(modelSlug);
  return { success: true, highlights };
} catch (error) {
  console.error(`Error fetching highlights for ${modelSlug}:`, error);
  return { success: false, highlights: [], error: error.message };
}
```

## Performance Optimizations

### Rate Limiting Strategy
```typescript
// 100ms delay between API calls to respect Readwise limits
async function makeReadwiseRequest(url: string) {
  await new Promise(resolve => setTimeout(resolve, 100));
  return fetch(url);
}
```

### Memory Management
```typescript
// Automatic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > TTL) {
      cache.delete(key);
    }
  }
}, 60000); // Cleanup every minute
```

### Bundle Optimization
- **Dynamic imports**: Load parsing logic only when needed
- **Component memoization**: Prevent unnecessary re-renders
- **API response compression**: Reduce payload sizes

## Data Models & Interfaces

### Core Interfaces
```typescript
interface ModelHighlights {
  readwiseId: string;
  modelTitle: string;
  domain: string;
  curatedHighlights: CuratedHighlight[];
}

interface CuratedHighlight {
  readwiseID: number;
  bookTitle: string;
  author: string;
  relevanceScore: number;
  qualityScore: number;
  insight: string;
  curator: string;
}
```

### API Response Format
```typescript
interface HighlightsResponse {
  modelSlug: string;
  curatedHighlights: CuratedHighlight[];
  totalCount: number;
  cached: boolean;
  lastUpdated: string;
}
```

## Deployment Architecture

### Environment Configuration
```typescript
// Required environment variables
const config = {
  READWISE_API_TOKEN: process.env.READWISE_API_TOKEN!,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600000'), // 1 hour
};
```

### Production Considerations
- **Vercel deployment**: Optimized for serverless functions
- **Edge caching**: Utilize Vercel's edge network
- **Environment isolation**: Separate dev/staging/prod configurations
- **Error monitoring**: Comprehensive logging and alerting

## Monitoring & Analytics

### Performance Metrics
```typescript
interface SystemMetrics {
  totalModels: number;
  workingModels: number;
  successRate: number;
  averageHighlightsPerModel: number;
  cacheHitRate: number;
  apiResponseTime: number;
}
```

### Debug Endpoints
```typescript
// GET /api/readwise/debug
{
  systemHealth: 'healthy',
  modelCoverage: '119/119 (100%)',
  cacheStats: { size: 45, hitRate: '87%' },
  lastUpdated: '2024-01-01T00:00:00Z'
}
```

## Future Architecture Considerations

### Scalability Enhancements
1. **Redis caching**: Persistent cache for production
2. **Database integration**: Store processed highlights
3. **CDN integration**: Static asset optimization
4. **Microservices**: Split parsing and API services

### Data Pipeline Improvements
1. **Automated testing**: CI/CD validation of all 119 models
2. **Real-time sync**: Webhook integration with Readwise
3. **Analytics**: User interaction tracking
4. **A/B testing**: Optimize highlight display

This architecture successfully achieved 100% model coverage while maintaining performance, reliability, and maintainability.
