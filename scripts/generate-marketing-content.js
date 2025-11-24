#!/usr/bin/env node

/**
 * Automated Marketing Content Generator
 * 
 * Generates all marketing content formats from mental models data:
 * - Twitter/X threads
 * - Quote cards (text)
 * - Visual card descriptions
 * - Newsletter content
 * - Blog post outlines
 * - Video scripts
 * 
 * Usage:
 *   node scripts/generate-marketing-content.js [options]
 * 
 * Options:
 *   --days N          Generate content for next N days (default: 30)
 *   --format FORMAT   Generate only specific format (twitter, quotes, newsletter, all)
 *   --output DIR      Output directory (default: ./marketing-content)
 */

const fs = require('fs');
const path = require('path');

// Try to import data - if TypeScript files aren't directly importable,
// we'll parse them as text (like other scripts do)
let READWISE_MODELS, READWISE_DOMAINS, getModelHighlightsFromAllDomains;

try {
  // Try direct require (works if TypeScript is compiled or using ts-node)
  const readwiseData = require('../lib/readwise-data');
  const parseDomains = require('../lib/parse-all-domains');
  READWISE_MODELS = readwiseData.READWISE_MODELS;
  READWISE_DOMAINS = readwiseData.READWISE_DOMAINS;
  getModelHighlightsFromAllDomains = parseDomains.getModelHighlightsFromAllDomains;
} catch (error) {
  // Fallback: Parse TypeScript files as text (like export-all-models-simple.js)
  console.log('⚠️  Direct import failed, parsing TypeScript files...');
  
  const readwiseDataPath = path.join(__dirname, '..', 'lib', 'readwise-data.ts');
  const content = fs.readFileSync(readwiseDataPath, 'utf8');
  
  // Extract READWISE_MODELS array
  const modelsMatch = content.match(/export const READWISE_MODELS: MentalModel\[\] = \[([\s\S]*?)\n\];/);
  if (modelsMatch) {
    const modelsArrayContent = '[' + modelsMatch[1] + '\n]';
    READWISE_MODELS = JSON.parse(modelsArrayContent);
  }
  
  // Extract READWISE_DOMAINS array
  const domainsMatch = content.match(/export const READWISE_DOMAINS: Domain\[\] = \[([\s\S]*?)\n\];/);
  if (domainsMatch) {
    const domainsArrayContent = '[' + domainsMatch[1] + '\n]';
    READWISE_DOMAINS = JSON.parse(domainsArrayContent);
  }
  
  // Import parse function (this should work as it's a .ts file with exports)
  try {
    const parseDomains = require('../lib/parse-all-domains');
    getModelHighlightsFromAllDomains = parseDomains.getModelHighlightsFromAllDomains;
  } catch (e) {
    console.error('❌ Could not import parse-all-domains. Make sure to run: npm install ts-node --save-dev');
    process.exit(1);
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cosmictrex.xyz';

/**
 * Generate Twitter/X thread following TWITTER_CONTENT_FRAMEWORK.md
 * 
 * NEW FORMAT: 3 complete tweets per model
 * Each tweet: Scenario + Quote + Connection
 * All 3 tweets about the same model
 */

// Tweet 3 options pool (from framework)
const TWEET3_OPTIONS = [
  // Options 1-10: Humble journey (use 80% of time)
  "I read a lot. Wanted to remember what mattered.\n\nBuilt this to help me think clearer. Maybe it helps you.\n\ncosmictrex.xyz",
  "Signal gets buried under noise.\n\nI enjoy organizing ideas. This is what came out of it.\n\ncosmictrex.xyz",
  "Information overload is real.\n\nSpent time filtering what I read. See if any of it resonates.\n\ncosmictrex.xyz",
  "We all keep re-learning the same things.\n\nI organized them here. Take what's useful.\n\ncosmictrex.xyz",
  "Most content is noise.\n\nI like reading. This is my attempt to find signal.\n\ncosmictrex.xyz",
  "Hard to know what actually matters.\n\nI'm trying to figure it out. Maybe you are too.\n\ncosmictrex.xyz",
  "Good ideas get buried fast.\n\nI pulled them together here. See what clicks.\n\ncosmictrex.xyz",
  "Couldn't keep track of what I was learning.\n\nBuilt this to fix that. Use what helps.\n\ncosmictrex.xyz",
  "Core ideas buried in endless repackaging.\n\nTried to get back to the core. Take what fits.\n\ncosmictrex.xyz",
  "Started keeping notes for myself.\n\nOrganized them into this. Explore if you want.\n\ncosmictrex.xyz",
  // Options 11-12: Time-based (use 20% of time)
  "Ideas to help you think better.\n\nBased on 125 days of content. Organized here.\n\ncosmictrex.xyz",
  "Ideas to help you think clearer.\n\nMore than 3000 hours of reading. See what resonates.\n\ncosmictrex.xyz"
];

function selectTweet3() {
  // 80% humble journey, 20% time-based
  if (Math.random() < 0.8) {
    const humbleOptions = TWEET3_OPTIONS.slice(0, 10);
    return humbleOptions[Math.floor(Math.random() * humbleOptions.length)];
  } else {
    const timeOptions = TWEET3_OPTIONS.slice(10, 12);
    return timeOptions[Math.floor(Math.random() * timeOptions.length)];
  }
}

function shortenHighlight(text, maxLength = 200) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Find natural break point
  const shortened = text.substring(0, maxLength);
  const lastPeriod = shortened.lastIndexOf('.');
  const lastComma = shortened.lastIndexOf(',');
  
  if (lastPeriod > maxLength * 0.7) {
    return text.substring(0, lastPeriod + 1);
  } else if (lastComma > maxLength * 0.7) {
    return text.substring(0, lastComma) + '...';
  } else {
    return shortened + '...';
  }
}

function selectBestHighlight(highlights) {
  if (!highlights?.curatedHighlights || highlights.curatedHighlights.length === 0) {
    return null;
  }
  
  // Sort by relevance + quality scores
  const sorted = [...highlights.curatedHighlights].sort((a, b) => {
    const scoreA = (a.relevanceScore || 0) + (a.qualityScore || 0);
    const scoreB = (b.relevanceScore || 0) + (b.qualityScore || 0);
    return scoreB - scoreA;
  });
  
  return sorted[0];
}

function generateConnection(model, highlight) {
  // One sentence connecting highlight back to scenario
  // Keep under 50 characters, simple and punchy
  const connections = [
    "Consequences of consequences.",
    "Every yes is a no to something else.",
    "Most people aren't out to get you. They're just winging it.",
    "Dead mutual funds don't show up in performance rankings.",
    "Don't take advice from anyone who won't pay if they're wrong.",
    "Strip away assumptions. Start with what's actually true.",
    "Most of what you do doesn't move the needle.",
    "Buffett passed on tech stocks for decades. Outside his circle."
  ];
  
  // For now, pick random. Could be smarter based on model/highlight
  return connections[Math.floor(Math.random() * connections.length)];
}

function generateTwitterThread(model, highlights) {
  const url = `${SITE_URL}/models/${model.slug}`;
  
  // Need 3 different highlights for 3 tweets
  if (!highlights?.curatedHighlights || highlights.curatedHighlights.length < 3) {
    console.warn(`⚠️  Need at least 3 highlights for ${model.name}, found ${highlights?.curatedHighlights?.length || 0}`);
    return null;
  }
  
  // Select top 3 highlights (sorted by quality)
  const sortedHighlights = [...highlights.curatedHighlights].sort((a, b) => {
    const scoreA = (a.relevanceScore || 0) + (a.qualityScore || 0);
    const scoreB = (b.relevanceScore || 0) + (b.qualityScore || 0);
    return scoreB - scoreA;
  });
  
  const selectedHighlights = sortedHighlights.slice(0, 3);
  
  // Load scenarios if available
  let scenarios = [];
  try {
    const scenariosPath = path.join(__dirname, '..', 'scenarios.json');
    if (fs.existsSync(scenariosPath)) {
      const scenariosData = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
      const modelScenarios = scenariosData[model.slug];
      if (modelScenarios && modelScenarios.scenarios && modelScenarios.scenarios.length >= 3) {
        scenarios = modelScenarios.scenarios.slice(0, 3).map(s => s.text);
      }
    }
  } catch (e) {
    // Continue without scenarios
  }
  
  // Generate 3 complete tweets (scenario + quote + connection + invitation + URL)
  const thread = [];
  
  for (let i = 0; i < 3; i++) {
    const highlight = selectedHighlights[i];
    const scenario = scenarios[i] || model.description.substring(0, 120) + '...';
    const shortenedQuote = shortenHighlight(highlight.text || highlight.curatorReason || '', 200);
    const connection = generateConnection(model, highlight);
    const invitation = selectTweet3(); // Get invitation/mission
    
    const tweet = `${scenario}\n\n${model.name}.\n\nFrom ${highlight.book.title} by ${highlight.book.author}:\n\n"${shortenedQuote}"\n\n${connection}\n\n${invitation}\n\n${url}`;
    
    thread.push({
      number: i + 1,
      text: tweet.length > 280 ? tweet.substring(0, 277) + '...' : tweet,
      charCount: Math.min(tweet.length, 280),
      highlightUsed: {
        readwiseId: highlight.readwiseId,
        book: highlight.book.title,
        author: highlight.book.author
      }
    });
  }
  
  return {
    model: model.name,
    slug: model.slug,
    url,
    thread,
    totalTweets: 3,
    totalChars: thread.reduce((sum, t) => sum + t.charCount, 0),
    highlightsUsed: thread.map(t => t.highlightUsed)
  };
}

/**
 * Generate quote cards (text descriptions for visual design)
 */
function generateQuoteCards(model, highlights) {
  if (!highlights?.curatedHighlights || highlights.curatedHighlights.length === 0) {
    return [];
  }

  return highlights.curatedHighlights.slice(0, 5).map((highlight, idx) => ({
    id: `quote-${model.slug}-${idx + 1}`,
    model: model.name,
    modelSlug: model.slug,
    quote: highlight.text || '',
    book: highlight.book.title,
    author: highlight.book.author,
    relevanceScore: highlight.relevanceScore,
    qualityScore: highlight.qualityScore,
    designNote: `Visual: Large quote text, smaller attribution, model name as header, ${model.domainSlug} domain color`,
    url: `${SITE_URL}/models/${model.slug}`
  }));
}

/**
 * Generate visual model card description
 */
function generateVisualCard(model, highlights) {
  const topHighlight = highlights?.curatedHighlights?.[0];
  const domain = READWISE_DOMAINS.find(d => d.slug === model.domainSlug);

  return {
    id: `card-${model.slug}`,
    model: model.name,
    slug: model.slug,
    url: `${SITE_URL}/models/${model.slug}`,
    design: {
      header: model.name,
      icon: domain?.icon || '🧠',
      color: domain?.color || '#6366f1',
      description: model.description.substring(0, 150),
      bullets: model.principles?.slice(0, 3).map(p => p.substring(0, 100)) || [],
      quote: topHighlight ? {
        text: topHighlight.text?.substring(0, 120) || '',
        author: topHighlight.book.author,
        book: topHighlight.book.title
      } : null,
      difficulty: model.difficulty,
      domain: domain?.name || model.domain
    },
    caption: `🧠 ${model.name}\n\n${model.description.substring(0, 200)}\n\n${model.principles?.[0]?.substring(0, 150) || ''}\n\nLearn more: ${SITE_URL}/models/${model.slug}`,
    hashtags: ['#MentalModels', '#DecisionMaking', model.difficulty ? `#${model.difficulty}` : ''].filter(Boolean)
  };
}

/**
 * Generate newsletter content
 */
function generateNewsletterContent(model, highlights, weekNumber) {
  const topHighlights = highlights?.curatedHighlights?.slice(0, 3) || [];
  const domain = READWISE_DOMAINS.find(d => d.slug === model.domainSlug);

  return {
    week: weekNumber,
    date: new Date(Date.now() + weekNumber * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subject: `Mental Model of the Week: ${model.name}`,
    preview: model.description.substring(0, 100),
    content: {
      header: `🧠 Mental Model of the Week: ${model.name}`,
      introduction: `Welcome to week ${weekNumber} of your mental models journey. This week we're exploring ${model.name}, a ${model.difficulty || 'intermediate'} model from the ${domain?.name || model.domain} domain.`,
      whatItIs: {
        title: 'What is it?',
        content: model.description
      },
      keyPrinciples: {
        title: 'Key Principles',
        items: model.principles?.slice(0, 5) || []
      },
      howToUse: {
        title: 'How to Use It',
        items: model.applications?.slice(0, 3) || []
      },
      insights: {
        title: 'Insights from Books',
        highlights: topHighlights.map(h => ({
          quote: h.text || '',
          book: h.book.title,
          author: h.book.author,
          whyItMatters: h.curatorReason
        }))
      },
      nextSteps: {
        title: 'Go Deeper',
        content: `Read the full model with all ${highlights?.curatedHighlights?.length || 0} curated highlights: ${SITE_URL}/models/${model.slug}`,
        relatedModels: model.relatedModels?.slice(0, 3) || []
      }
    }
  };
}

/**
 * Generate blog post outline
 */
function generateBlogPostOutline(model, highlights) {
  const domain = READWISE_DOMAINS.find(d => d.slug === model.domainSlug);
  
  return {
    title: `${model.name}: A Complete Guide`,
    slug: `complete-guide-${model.slug}`,
    seoTitle: `${model.name} Explained: Mental Model Guide | Mental Models Observatory`,
    metaDescription: model.description.substring(0, 155),
    url: `${SITE_URL}/models/${model.slug}`,
    outline: {
      introduction: {
        hook: `Why do smart people make bad decisions? Often, it's because they're missing ${model.name}.`,
        what: model.description,
        why: `Understanding ${model.name} helps you ${model.applications?.[0]?.substring(0, 100) || 'make better decisions'}.`
      },
      whatItIs: {
        title: `What is ${model.name}?`,
        content: model.description,
        principles: model.principles || []
      },
      howItWorks: {
        title: 'How It Works',
        principles: model.principles?.map((p, idx) => ({
          number: idx + 1,
          principle: p,
          explanation: p // Could be expanded
        })) || []
      },
      applications: {
        title: 'Real-World Applications',
        items: model.applications?.map((app, idx) => ({
          number: idx + 1,
          application: app,
          example: model.examples?.[idx] || null
        })) || []
      },
      examples: {
        title: 'Examples',
        items: model.examples || []
      },
      insights: {
        title: 'Insights from Books',
        highlights: highlights?.curatedHighlights?.slice(0, 5).map(h => ({
          quote: h.text || '',
          book: h.book.title,
          author: h.book.author,
          context: h.curatorReason
        })) || []
      },
      relatedModels: {
        title: 'Related Mental Models',
        models: model.relatedModels || []
      },
      conclusion: {
        title: 'Key Takeaways',
        points: [
          model.description,
          model.principles?.[0] || '',
          model.applications?.[0] || ''
        ].filter(Boolean)
      }
    },
    tags: [...(model.tags || []), 'mental-models', model.difficulty || 'intermediate', domain?.slug || model.domainSlug],
    estimatedReadTime: Math.ceil((model.description.length + (model.principles?.join('').length || 0) + (model.applications?.join('').length || 0)) / 200) + ' min'
  };
}

/**
 * Generate video script (60-second format)
 */
function generateVideoScript(model, highlights) {
  const topHighlight = highlights?.curatedHighlights?.[0];
  
  return {
    model: model.name,
    slug: model.slug,
    duration: '60 seconds',
    script: {
      hook: {
        time: '0-10s',
        text: `Why do smart people make bad decisions? Often, it's because they're missing ${model.name}.`,
        visual: 'Text overlay: "Why Smart People Make Bad Decisions"'
      },
      explanation: {
        time: '10-30s',
        text: `${model.name} is ${model.description.substring(0, 150)}. The key idea: ${model.principles?.[0]?.substring(0, 100) || ''}`,
        visual: 'Animated diagram showing the concept'
      },
      example: {
        time: '30-50s',
        text: `Here's how it works: ${model.applications?.[0]?.substring(0, 150) || model.examples?.[0]?.substring(0, 150) || ''}`,
        visual: 'Real-world example with graphics'
      },
      cta: {
        time: '50-60s',
        text: `Want to learn more? Check out the full model at cosmictrex.xyz. Link in description.`,
        visual: 'Website URL, subscribe button'
      }
    },
    thumbnail: {
      text: `${model.name} Explained`,
      subtitle: 'Mental Models',
      design: 'Bold text, model icon, domain color'
    },
    description: `${model.name}: ${model.description}\n\nFull model: ${SITE_URL}/models/${model.slug}\n\n#MentalModels #DecisionMaking #CriticalThinking`
  };
}

/**
 * Main generation function
 */
function generateAllContent(days = 30, format = 'all') {
  const outputDir = path.join(process.cwd(), 'marketing-content');
  const dateDir = path.join(outputDir, new Date().toISOString().split('T')[0]);
  
  // Create directories
  [outputDir, dateDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const models = READWISE_MODELS;
  const modelsPerDay = Math.ceil(models.length / days);
  const content = {
    generated: new Date().toISOString(),
    days,
    totalModels: models.length,
    formats: {}
  };

  // Generate content for each model
  for (let day = 0; day < days; day++) {
    const startIdx = day * modelsPerDay;
    const endIdx = Math.min(startIdx + modelsPerDay, models.length);
    const dayModels = models.slice(startIdx, endIdx);
    
    const dayContent = {
      date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dayNumber: day + 1,
      models: []
    };

    for (const model of dayModels) {
      const highlights = getModelHighlightsFromAllDomains(model.slug);
      
      const modelContent = {
        model: model.name,
        slug: model.slug,
        url: `${SITE_URL}/models/${model.slug}`
      };

      if (format === 'all' || format === 'twitter') {
        modelContent.twitter = generateTwitterThread(model, highlights);
      }

      if (format === 'all' || format === 'quotes') {
        modelContent.quotes = generateQuoteCards(model, highlights);
      }

      if (format === 'all' || format === 'visual') {
        modelContent.visualCard = generateVisualCard(model, highlights);
      }

      if (format === 'all' || format === 'newsletter') {
        modelContent.newsletter = generateNewsletterContent(model, highlights, Math.floor(day / 7) + 1);
      }

      if (format === 'all' || format === 'blog') {
        modelContent.blog = generateBlogPostOutline(model, highlights);
      }

      if (format === 'all' || format === 'video') {
        modelContent.video = generateVideoScript(model, highlights);
      }

      dayContent.models.push(modelContent);
    }

    // Save daily content
    const dayFile = path.join(dateDir, `day-${day + 1}.json`);
    fs.writeFileSync(dayFile, JSON.stringify(dayContent, null, 2));

    // Also save individual formats for easy access
    if (format === 'all' || format === 'twitter') {
      const twitterFile = path.join(dateDir, `twitter-day-${day + 1}.txt`);
      const twitterText = dayContent.models.map(m => {
        if (!m.twitter) return '';
        return `=== ${m.model} ===\n\n${m.twitter.thread.map(t => `Tweet ${t.number} (${t.charCount} chars):\n${t.text}\n`).join('\n')}\n\nHashtags: ${m.twitter.hashtags.join(' ')}\n\nURL: ${m.url}\n\n${'='.repeat(50)}\n\n`;
      }).join('\n');
      fs.writeFileSync(twitterFile, twitterText);
    }

    if (format === 'all' || format === 'quotes') {
      const quotesFile = path.join(dateDir, `quotes-day-${day + 1}.json`);
      const allQuotes = dayContent.models.flatMap(m => m.quotes || []);
      fs.writeFileSync(quotesFile, JSON.stringify(allQuotes, null, 2));
    }
  }

  // Save summary
  const summaryFile = path.join(dateDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    ...content,
    totalDays: days,
    modelsPerDay: modelsPerDay,
    outputDirectory: dateDir
  }, null, 2));

  // Generate content calendar
  const calendarFile = path.join(outputDir, 'content-calendar.csv');
  const calendarRows = ['Date,Model,Slug,Twitter,Quotes,Visual,Newsletter,Blog,Video,URL'];
  
  for (let day = 0; day < days; day++) {
    const dayFile = path.join(dateDir, `day-${day + 1}.json`);
    if (fs.existsSync(dayFile)) {
      const dayContent = JSON.parse(fs.readFileSync(dayFile, 'utf8'));
      dayContent.models.forEach(model => {
        calendarRows.push([
          dayContent.date,
          model.model,
          model.slug,
          model.twitter ? 'Yes' : 'No',
          model.quotes?.length > 0 ? 'Yes' : 'No',
          model.visualCard ? 'Yes' : 'No',
          model.newsletter ? 'Yes' : 'No',
          model.blog ? 'Yes' : 'No',
          model.video ? 'Yes' : 'No',
          model.url
        ].join(','));
      });
    }
  }
  
  fs.writeFileSync(calendarFile, calendarRows.join('\n'));

  console.log(`✅ Generated marketing content for ${days} days`);
  console.log(`📁 Output directory: ${dateDir}`);
  console.log(`📊 Total models: ${models.length}`);
  console.log(`📅 Content calendar: ${calendarFile}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review content in ${dateDir}`);
  console.log(`2. Use Twitter threads from twitter-day-*.txt files`);
  console.log(`3. Design visual cards from visualCard data`);
  console.log(`4. Schedule posts using content-calendar.csv`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='))?.split('=')[1] || args.find(arg => arg === '--days') ? args[args.indexOf('--days') + 1] : null;
const formatArg = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || args.find(arg => arg === '--format') ? args[args.indexOf('--format') + 1] : 'all';
const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || args.find(arg => arg === '--output') ? args[args.indexOf('--output') + 1] : null;

const days = parseInt(daysArg || '30', 10);
const format = formatArg || 'all';

generateAllContent(days, format);

