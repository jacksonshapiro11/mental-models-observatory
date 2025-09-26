# Quick Reference Guide - Mental Models Observatory

## 🎯 System Status
- **Models**: 119/119 working (100% success)
- **Readwise Integration**: Complete
- **Deployment**: Ready for production

## Essential Commands

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### Testing Readwise Integration
```bash
# Test all 119 models
node scripts/check-real-model-slugs.js

# Test specific model
curl "http://localhost:3000/api/readwise/highlights/model-slug-here"

# System health check
curl "http://localhost:3000/api/readwise/debug"
```

## Critical Files

### Core System Files
- `lib/parse-all-domains.ts` - **MAIN**: Slug mapping & parsing system
- `lib/readwise-highlights.ts` - API integration & caching
- `components/content/ReadwiseHighlights.tsx` - Display component
- `app/api/readwise/highlights/[modelSlug]/route.ts` - API endpoint

### Data Sources
- `Readwise website notes/` - 15+ domain files with highlight data
- `lib/readwise-data.ts` - Static framework (119 models)

### Documentation
- `docs/DEVELOPMENT_GUIDE.md` - Complete development process
- `docs/TECHNICAL_ARCHITECTURE.md` - System architecture details
- `docs/DEPLOYMENT_GUIDE.md` - Deployment instructions

## Environment Variables

### Required
```env
READWISE_API_TOKEN=your_token_here
```

### Recommended
```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME="Mental Models Observatory"
```

## Common Tasks

### Adding a New Model
1. Add to `lib/readwise-data.ts` (static framework)
2. Ensure highlight data exists in `Readwise website notes/`
3. Add slug mapping in `MODEL_SLUG_MAPPINGS` if needed
4. Test: `curl "/api/readwise/highlights/new-model-slug"`

### Debugging Model Not Working
1. Check slug mapping in `MODEL_SLUG_MAPPINGS`
2. Verify highlight data exists in domain files
3. Test API endpoint directly
4. Check browser console for errors

### Updating Slug Mappings
**Location**: `lib/parse-all-domains.ts` → `MODEL_SLUG_MAPPINGS`

```typescript
const MODEL_SLUG_MAPPINGS: Record<string, string> = {
  'static-framework-slug': 'readwise-curation-slug',
  // Add new mappings here
};
```

## Architecture Quick Reference

### Data Flow
```
Domain Files → Parser → Slug Mapper → API → Component → Display
```

### Key Components
- **Parser**: Handles 15+ different file formats
- **Mapper**: Bridges static framework ↔ Readwise data
- **API**: Caches responses, handles errors
- **Component**: Displays rich metadata

### Caching
- **File cache**: 5 minutes
- **API cache**: 1 hour
- **Rate limiting**: 100ms between calls

## Troubleshooting

### Model Not Showing Highlights
```bash
# 1. Test API directly
curl "http://localhost:3000/api/readwise/highlights/problem-slug"

# 2. Check if slug mapping exists
grep "problem-slug" lib/parse-all-domains.ts

# 3. Check if highlight data exists
grep -r "problem-slug" "Readwise website notes/"
```

### JSON Parsing Errors
- Check `fixJsonSyntax()` function in `lib/parse-all-domains.ts`
- Most common: trailing commas, unterminated strings
- Auto-fixed by robust parsing system

### Build/Deploy Issues
```bash
# Local build test
npm run build

# Type check
npm run type-check

# Environment check
echo $READWISE_API_TOKEN
```

## Success Metrics

### Model Coverage
- **Target**: 119/119 models ✅
- **Check**: `node scripts/check-real-model-slugs.js`

### Performance
- **API response**: <1 second
- **Page load**: <3 seconds
- **Cache hit rate**: >80%

### Quality
- **Highlights per model**: 10+ average
- **Error rate**: <1%
- **User experience**: Self-contained, no external navigation

## Key Learnings

### Technical
1. **Two datasets problem**: Static framework vs Readwise had zero overlap
2. **Conservative mapping**: Quality over quantity for slug mappings
3. **Robust parsing**: Handle 15+ file formats with various corruption
4. **Comprehensive caching**: Balance performance with freshness

### Process
1. **Script-driven debugging**: Automate testing and analysis
2. **Incremental approach**: Fix components independently
3. **Conservative deployment**: High-confidence changes only
4. **Comprehensive documentation**: Capture all organizational knowledge

## Emergency Procedures

### Rollback Deployment
1. Revert to previous Vercel deployment
2. Check logs for error details
3. Fix issues in development
4. Redeploy with fixes

### System Health Check
```bash
# Quick health check
curl "https://your-domain/api/readwise/debug"

# Test random models
for model in memento-mori-death-as-teacher first-principles-reasoning exponential-vs-linear-thinking; do
  echo "Testing $model:"
  curl -s "https://your-domain/api/readwise/highlights/$model" | jq '.curatedHighlights | length'
done
```

## Contact & Resources

### Documentation
- **Complete guides**: `/docs/` folder
- **Code comments**: Inline documentation
- **Git history**: Full development log

### Tools
- **GitHub**: Repository and issues
- **Vercel**: Deployment platform
- **Readwise**: Data source

---

**Last Updated**: Latest changes include 100% model success rate achievement
**Status**: Production ready with comprehensive documentation
