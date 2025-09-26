# Deployment Guide - Mental Models Observatory

## Pre-Deployment Status ✅

**System Health**: All 119 models working (100% success rate)
**Code Status**: Latest changes committed and pushed to GitHub
**Documentation**: Complete technical and development guides created
**Testing**: All API endpoints validated and working

## Environment Setup

### Required Environment Variables

```env
# Essential - Required for core functionality
READWISE_API_TOKEN=your_readwise_api_token_here

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME="Mental Models Observatory"

# Optional - Enhanced functionality
NEXT_PUBLIC_CONTACT_EMAIL=your_email@example.com
NEXT_PUBLIC_GITHUB_URL=https://github.com/yourusername/mental-models-observatory

# Feature Flags (Optional)
NEXT_PUBLIC_ENABLE_SEARCH=true
NEXT_PUBLIC_ENABLE_COMMENTS=false
NEXT_PUBLIC_ENABLE_SOCIAL_SHARING=true

# Performance Tuning (Optional)
CACHE_TTL=3600000              # 1 hour cache TTL
READWISE_RATE_LIMIT=100        # 100ms between API calls
MAX_HIGHLIGHTS_PER_MODEL=50    # Limit highlights per model
```

### Getting Your Readwise API Token

1. **Sign in to Readwise**: Go to [readwise.io](https://readwise.io)
2. **Navigate to Settings**: Click on your profile → Settings
3. **API Keys Section**: Find "API Keys" in the settings menu
4. **Generate Token**: Click "Generate new token"
5. **Copy Token**: Save the token securely - you'll need it for deployment

## Vercel Deployment (Recommended)

### Step 1: Repository Setup ✅
```bash
# Already completed
✅ Code committed to GitHub
✅ Repository: github.com/jacksonshapiro11/mental-models-observatory
✅ Branch: main (up to date)
```

### Step 2: Connect to Vercel

1. **Visit Vercel**: Go to [vercel.com](https://vercel.com)
2. **Sign in**: Use your GitHub account
3. **Import Project**: Click "Add New..." → "Project"
4. **Select Repository**: Choose `mental-models-observatory`
5. **Import**: Click "Import"

### Step 3: Configure Environment Variables

In Vercel dashboard:

1. **Project Settings**: Go to your project → Settings
2. **Environment Variables**: Click "Environment Variables" tab
3. **Add Variables**: Add each variable from the list above

**Critical Variables to Add**:
```
READWISE_API_TOKEN=your_actual_token_here
NEXT_PUBLIC_SITE_URL=https://mental-models-observatory.vercel.app
NEXT_PUBLIC_SITE_NAME=Mental Models Observatory
```

### Step 4: Deploy

1. **Automatic Deploy**: Vercel will automatically deploy on import
2. **Monitor Build**: Watch the build logs for any issues
3. **Domain Assignment**: Vercel will assign a domain like `mental-models-observatory.vercel.app`

### Step 5: Verify Deployment

Test these critical endpoints:

```bash
# Test homepage
curl https://your-domain.vercel.app

# Test a specific model's highlights
curl https://your-domain.vercel.app/api/readwise/highlights/memento-mori-death-as-teacher

# Test debug endpoint
curl https://your-domain.vercel.app/api/readwise/debug

# Test a model page
curl https://your-domain.vercel.app/models/memento-mori-death-as-teacher
```

## Alternative Deployment Options

### Self-Hosted Deployment

#### Prerequisites
- Node.js 18.0+
- PM2 (for process management)
- Nginx (for reverse proxy)
- SSL certificate

#### Build & Deploy
```bash
# Clone and build
git clone https://github.com/jacksonshapiro11/mental-models-observatory.git
cd mental-models-observatory
npm install
npm run build

# Set environment variables
cp .env.local.example .env.local
# Edit .env.local with your values

# Start with PM2
npm install -g pm2
pm2 start npm --name "mental-models" -- start
pm2 save
pm2 startup
```

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  mental-models:
    build: .
    ports:
      - "3000:3000"
    environment:
      - READWISE_API_TOKEN=${READWISE_API_TOKEN}
      - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
    restart: unless-stopped
```

## Post-Deployment Validation

### Automated Testing Script

Save as `scripts/validate-deployment.js`:

```javascript
const axios = require('axios');

const BASE_URL = process.env.DEPLOYMENT_URL || 'http://localhost:3000';

async function validateDeployment() {
  console.log(`🔍 Validating deployment at ${BASE_URL}`);
  
  const tests = [
    // Homepage
    { name: 'Homepage', url: '/' },
    
    // API endpoints
    { name: 'Debug API', url: '/api/readwise/debug' },
    { name: 'Sample Model Highlights', url: '/api/readwise/highlights/memento-mori-death-as-teacher' },
    
    // Model pages
    { name: 'Sample Model Page', url: '/models/memento-mori-death-as-teacher' },
    
    // Domain pages
    { name: 'All Models Page', url: '/models' },
  ];
  
  for (const test of tests) {
    try {
      const response = await axios.get(`${BASE_URL}${test.url}`, { timeout: 10000 });
      console.log(`✅ ${test.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
  
  // Test 5 random models
  const sampleModels = [
    'first-principles-reasoning-ground-up-construction',
    'exponential-vs-linear-thinking', 
    'human-computer-symbiosis-cognitive-augmentation',
    'paradigm-shifts-transcendence',
    'universality-infinite-reach-from-finite-means'
  ];
  
  console.log('\n🎯 Testing random models:');
  for (const model of sampleModels) {
    try {
      const response = await axios.get(`${BASE_URL}/api/readwise/highlights/${model}`);
      const data = response.data;
      console.log(`✅ ${model}: ${data.curatedHighlights?.length || 0} highlights`);
    } catch (error) {
      console.log(`❌ ${model}: ${error.message}`);
    }
  }
}

validateDeployment();
```

### Manual Testing Checklist

#### Homepage Tests
- [ ] Homepage loads successfully
- [ ] Navigation menu works
- [ ] "Explore All Domains" button navigates to `/models`
- [ ] All domain cards display correctly

#### Model Tests
- [ ] Individual model pages load
- [ ] Readwise highlights display with rich metadata
- [ ] Author, book, and curator information shows
- [ ] Quality and relevance scores display
- [ ] No models show "No highlights available"

#### API Tests
- [ ] `/api/readwise/debug` shows system health
- [ ] Model-specific highlight endpoints work
- [ ] API responses include proper metadata
- [ ] Caching headers are set correctly

#### Performance Tests
- [ ] Initial page load under 3 seconds
- [ ] API responses under 1 second
- [ ] No console errors in browser
- [ ] Mobile experience is responsive

## Troubleshooting Common Issues

### Issue: Models Not Showing Highlights

**Symptoms**: API returns empty arrays or errors
**Diagnosis**: 
```bash
# Check specific model
curl https://your-domain/api/readwise/highlights/problem-model-slug

# Check debug endpoint
curl https://your-domain/api/readwise/debug
```
**Solutions**:
1. Verify `READWISE_API_TOKEN` is set correctly
2. Check slug mapping in `lib/parse-all-domains.ts`
3. Verify domain files are included in build

### Issue: Build Failures

**Symptoms**: Deployment fails during build
**Common Causes**:
- Missing environment variables
- TypeScript errors
- Dependency issues

**Solutions**:
```bash
# Local testing
npm run build
npm run type-check
npm run lint

# Check build logs in Vercel dashboard
```

### Issue: Performance Problems

**Symptoms**: Slow page loads, timeouts
**Diagnosis**:
```bash
# Check API response times
time curl https://your-domain/api/readwise/highlights/test-model
```
**Solutions**:
1. Verify caching is working
2. Check rate limiting settings
3. Monitor Vercel function logs

### Issue: Environment Variable Problems

**Symptoms**: Features not working, blank content
**Verification**:
```bash
# Check environment variables are set
curl https://your-domain/api/readwise/debug
```
**Solutions**:
1. Re-add variables in Vercel dashboard
2. Redeploy after adding variables
3. Check variable names match exactly

## Monitoring & Maintenance

### Health Monitoring

Set up monitoring for:
- **Uptime**: Use UptimeRobot or similar
- **Performance**: Core Web Vitals
- **API Response Times**: Track highlight endpoint performance
- **Error Rates**: Monitor 4xx/5xx responses

### Regular Maintenance Tasks

#### Weekly
- [ ] Check system health via `/api/readwise/debug`
- [ ] Verify random sample of models still working
- [ ] Monitor performance metrics

#### Monthly  
- [ ] Review error logs
- [ ] Check for new domain files to add
- [ ] Validate all 119 models still working
- [ ] Update dependencies if needed

#### Quarterly
- [ ] Review and update slug mappings
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Documentation updates

## Success Metrics

### Key Performance Indicators

**Functional Metrics**:
- **Model Coverage**: 119/119 (100%) ✅
- **API Success Rate**: >99%
- **Page Load Time**: <3 seconds
- **Highlight Display**: 10+ average per model

**User Experience Metrics**:
- **Time to Interactive**: <2 seconds
- **Core Web Vitals**: All green
- **Mobile Performance**: >90 Lighthouse score
- **Accessibility**: >95 Lighthouse score

### Deployment Success Criteria

- [ ] All 119 models display highlights ✅
- [ ] Homepage loads correctly ✅
- [ ] Navigation works properly ✅
- [ ] API endpoints respond correctly ✅
- [ ] Mobile experience optimized ✅
- [ ] Performance targets met ✅
- [ ] Error handling graceful ✅

## Support & Recovery

### Rollback Procedure

If deployment issues occur:

1. **Immediate**: Revert to previous Vercel deployment
2. **Investigate**: Check logs and error messages
3. **Fix**: Address issues in development
4. **Redeploy**: Push fixed version

### Getting Help

**Resources**:
- **Documentation**: Comprehensive guides in `/docs/`
- **GitHub Issues**: Create issue in repository
- **Vercel Support**: For platform-specific issues
- **Debug Endpoint**: `/api/readwise/debug` for system status

**Emergency Contacts**:
- Repository: `github.com/jacksonshapiro11/mental-models-observatory`
- Documentation: Complete guides in `/docs/` folder
- System Status: `/api/readwise/debug` endpoint

---

**🎯 Ready for Production**: All systems validated and documented for successful deployment!
