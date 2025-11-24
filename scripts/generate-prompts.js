#!/usr/bin/env node

/**
 * Generate AI Prompts for Scenario Generation
 * 
 * Creates context-rich prompts with model data, highlights, and framework rules
 * Saves prompts to files for batch processing or manual review
 * 
 * Usage:
 *   node scripts/generate-prompts.js [options]
 * 
 * Options:
 *   --days N          Generate prompts for N days (default: 30)
 *   --model SLUG      Generate for specific model
 *   --output DIR      Output directory (default: ./monthly-prompts)
 */

const fs = require('fs');
const path = require('path');

// Import data - handle TypeScript files
let READWISE_MODELS, READWISE_DOMAINS, getModelHighlightsFromAllDomains;

try {
  // Try direct require (works if TypeScript is compiled or using ts-node)
  const readwiseData = require('../lib/readwise-data');
  const parseDomains = require('../lib/parse-all-domains');
  READWISE_MODELS = readwiseData.READWISE_MODELS;
  READWISE_DOMAINS = readwiseData.READWISE_DOMAINS;
  getModelHighlightsFromAllDomains = parseDomains.getModelHighlightsFromAllDomains;
} catch (error) {
  // Fallback: Parse TypeScript files as text (like other scripts)
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
  
  // Import parse function - use ts-node to load TypeScript
  try {
    require('ts-node/register');
    const parseDomains = require('../lib/parse-all-domains');
    getModelHighlightsFromAllDomains = parseDomains.getModelHighlightsFromAllDomains;
  } catch (e) {
    console.error('❌ Could not load parse-all-domains:', e.message);
    console.error('   Make sure ts-node is installed: npm install ts-node --save-dev');
    process.exit(1);
  }
}

// Load framework rules
const FRAMEWORK_PATH = path.join(__dirname, '..', 'TWITTER_CONTENT_FRAMEWORK.md');
let frameworkRules = '';
if (fs.existsSync(FRAMEWORK_PATH)) {
  frameworkRules = fs.readFileSync(FRAMEWORK_PATH, 'utf8');
}

// Refined prompt template
function createPromptTemplate(model, highlights, frameworkRules) {
  const topHighlights = highlights?.curatedHighlights?.slice(0, 3) || [];
  const domain = READWISE_DOMAINS.find(d => d.slug === model.domainSlug);
  
  // Extract relevant framework sections
  const voiceSection = frameworkRules.match(/## Voice & Tone([\s\S]*?)---/)?.[1] || '';
  const scenarioSection = frameworkRules.match(/## Tweet 1: The Scenario([\s\S]*?)---/)?.[1] || '';
  const examplesSection = frameworkRules.match(/## Complete Thread Examples([\s\S]*?)---/)?.[1] || '';
  
  const prompt = `You are generating a Twitter thread scenario for a mental model. Follow these exact guidelines:

## Framework Rules

${voiceSection}

${scenarioSection}

## Model Context

**Model Name:** ${model.name}
**Description:** ${model.description}
**Domain:** ${domain?.name || model.domain}
**Difficulty:** ${model.difficulty || 'intermediate'}

**Key Principles:**
${model.principles?.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join('\n') || 'N/A'}

**Applications:**
${model.applications?.slice(0, 2).map((a, i) => `${i + 1}. ${a}`).join('\n') || 'N/A'}

## Curated Highlights (USE THESE - Pick 3 different ones)

${topHighlights.map((h, i) => `
**Highlight ${i + 1}:**
From "${h.book.title}" by ${h.book.author}
Readwise ID: ${h.readwiseId}
Relevance: ${h.relevanceScore}/10 | Quality: ${h.qualityScore}/10

${h.text ? `Actual quote: "${h.text}"` : `Note: Quote text not available. Use the curator reason below as context for what the quote is about.`}

Why it matters: ${h.curatorReason}
`).join('\n')}

**IMPORTANT:** 
- You must use 3 DIFFERENT highlights from the list above. One per tweet.
- If actual quote text is provided, use it (shorten to 100-200 chars if needed)
- If only curator reason is provided, create a quote that matches the curator's description and the book's style
- Always attribute to the correct book and author

## Examples from Framework

${examplesSection.substring(0, 1000)}

## Your Task

Generate 3 complete tweets for this model. Each tweet combines a scenario with a quote from the curated highlights.

**Format for each tweet:**
\`\`\`
[2-4 sentence concrete scenario]

[Model name].

From [Book Title] by [Author Name]:

"[Shortened quote from curated highlights - 100-200 chars]"

[One sentence connecting quote to scenario]

[Invitation/mission - rotate from these 10 options]:
- I read a lot. Wanted to remember what mattered. Built this to help me think clearer. Maybe it helps you.
- Signal gets buried under noise. I enjoy organizing ideas. This is what came out of it.
- Information overload is real. Spent time filtering what I read. See if any of it resonates.
- We all keep re-learning the same things. I organized them here. Take what's useful.
- Most content is noise. I like reading. This is my attempt to find signal.
- Hard to know what actually matters. I'm trying to figure it out. Maybe you are too.
- Good ideas get buried fast. I pulled them together here. See what clicks.
- Couldn't keep track of what I was learning. Built this to fix that. Use what helps.
- Core ideas buried in endless repackaging. Tried to get back to the core. Take what fits.
- Started keeping notes for myself. Organized them into this. Explore if you want.

https://www.cosmictrex.xyz/models/${model.slug}
\`\`\`

**Rules:**
1. **3 different scenarios** - Each in a different life domain (relationships, work, shopping, health, parenting, money, etc.)
2. **Use curated highlights ONLY** - Pick 3 different highlights from the list above
3. **Concrete, never abstract** - Real situations people experience
4. **Show, don't explain** - Let them connect the dots
5. **2-4 sentences MAX** for scenario portion
6. **Shorten quotes** if needed (keep meaning intact)
7. **One connection sentence** per tweet (ties quote to scenario)
8. **Include invitation/mission** - Use one of the 10 options above, rotate them across the 3 tweets
9. **Always include URL** - https://www.cosmictrex.xyz/models/${model.slug}

**Voice:**
- Buddhist teacher at a truck stop - Detached but helpful
- Humble, not guru voice
- Two truckers talking, not expert to student

Generate 3 complete tweets now, each with scenario + quote + connection.`;

  return prompt;
}

// Generate prompts for a model
function generatePromptForModel(model) {
  const highlights = getModelHighlightsFromAllDomains(model.slug);
  
  if (!highlights || !highlights.curatedHighlights || highlights.curatedHighlights.length === 0) {
    console.warn(`⚠️  No highlights for ${model.name}, skipping`);
    return null;
  }
  
  const prompt = createPromptTemplate(model, highlights, frameworkRules);
  
  return {
    model: model.name,
    slug: model.slug,
    prompt,
    highlightCount: highlights.curatedHighlights.length,
    generatedAt: new Date().toISOString()
  };
}

// Generate weekly prompts (random selection)
function generateWeeklyPrompts(modelsPerWeek = 7) {
  const outputDir = path.join(process.cwd(), 'monthly-prompts');
  const weekDir = path.join(outputDir, `week-${new Date().toISOString().split('T')[0]}`);
  
  if (!fs.existsSync(weekDir)) {
    fs.mkdirSync(weekDir, { recursive: true });
  }
  
  // Randomly select models
  const allModels = [...READWISE_MODELS];
  const shuffled = allModels.sort(() => Math.random() - 0.5);
  const selectedModels = shuffled.slice(0, modelsPerWeek);
  
  console.log(`📝 Generating prompts for ${modelsPerWeek} models (${modelsPerWeek === 7 ? '1 per day' : '2 per day'})...\n`);
  
  const allPrompts = [];
  
  for (let i = 0; i < selectedModels.length; i++) {
    const model = selectedModels[i];
    const promptData = generatePromptForModel(model);
    
    if (promptData) {
      allPrompts.push(promptData);
      
      // Save individual prompt file
      const dayNumber = Math.floor(i / (modelsPerWeek === 7 ? 1 : 2)) + 1;
      const promptFile = path.join(weekDir, `model-${i + 1}-${model.slug}.txt`);
      fs.writeFileSync(promptFile, promptData.prompt);
      
      console.log(`✅ ${i + 1}/${modelsPerWeek}: ${model.name}`);
    }
  }
  
  // Save index
  const indexFile = path.join(weekDir, 'index.json');
  fs.writeFileSync(indexFile, JSON.stringify({
    generated: new Date().toISOString(),
    modelsPerWeek,
    totalPrompts: allPrompts.length,
    postingFrequency: modelsPerWeek === 7 ? 'once per day' : 'twice per day',
    models: allPrompts.map(p => ({ name: p.model, slug: p.slug }))
  }, null, 2));
  
  // Create batch prompt file (all prompts in one file for easy copy-paste)
  const batchFile = path.join(weekDir, 'batch-prompts.txt');
  
  // Create AI prompt instructions (always include at top)
  const aiPromptInstructions = `I need you to generate 3 complete Twitter tweets for each mental model. I'm providing you with a batch file containing prompts, each with full context about a mental model.

For each prompt in the batch file:

1. Read the model context, principles, applications, and curated highlights
2. Generate exactly 3 complete tweets (each combines scenario + quote + connection + invitation + URL)

**Format for each tweet:**
\`\`\`
[2-4 sentence concrete scenario]

[Model name].

From [Book Title] by [Author Name]:

"[Shortened quote from curated highlights - 100-200 chars]"

[One sentence connecting quote to scenario]

[Invitation/mission - use one of these 10 options, rotate them across the 3 tweets]:
- I read a lot. Wanted to remember what mattered. Built this to help me think clearer. Maybe it helps you.
- Signal gets buried under noise. I enjoy organizing ideas. This is what came out of it.
- Information overload is real. Spent time filtering what I read. See if any of it resonates.
- We all keep re-learning the same things. I organized them here. Take what's useful.
- Most content is noise. I like reading. This is my attempt to find signal.
- Hard to know what actually matters. I'm trying to figure it out. Maybe you are too.
- Good ideas get buried fast. I pulled them together here. See what clicks.
- Couldn't keep track of what I was learning. Built this to fix that. Use what helps.
- Core ideas buried in endless repackaging. Tried to get back to the core. Take what fits.
- Started keeping notes for myself. Organized them into this. Explore if you want.

https://www.cosmictrex.xyz/models/[model-slug]
\`\`\`

**Critical Requirements:**
- 3 different scenarios - Each in a different life domain (relationships, work, shopping, health, parenting, money, etc.)
- Use 3 different curated highlights - One per tweet, from the highlights provided
- Concrete, never abstract - Real situations people experience
- Show, don't explain - Let them connect the dots
- 2-4 sentences MAX for scenario portion
- Include invitation/mission at the end of each tweet (rotate from the 10 options)
- Always include the URL at the very end

**Voice Guidelines:**
- Buddhist teacher at a truck stop - Detached but helpful
- Humble, not guru voice
- Two truckers talking, not expert to student
- Short and punchy - Respect their time

**What to NEVER do:**
- Don't use guru voice ("Most people don't know...")
- Don't be self-aggrandizing ("We built a lighthouse...")
- Don't make up quotes (ONLY use curated highlights provided)
- Don't be abstract or academic
- Don't repeat the same highlight across the 3 tweets

**Output Format:**
For each model, provide:
1. Model name
2. Three complete tweets (numbered 1, 2, 3)
3. Each tweet in the exact format above (scenario + quote + connection + invitation + URL)

All 3 tweets are about the same model, posted the same day. Each tweet is standalone (not a thread).

Process all prompts in the batch file. Be consistent, concrete, and relatable.`;
  
  const batchContent = `${aiPromptInstructions}\n\n${'='.repeat(80)}\n\nBATCH PROMPTS - Process each one below\n${'='.repeat(80)}\n\n${allPrompts.map((p, i) => 
    `\n${'='.repeat(80)}\n\nPROMPT ${i + 1}: ${p.model}\n${'='.repeat(80)}\n\n${p.prompt}\n`
  ).join('\n')}`;
  
  fs.writeFileSync(batchFile, batchContent);
  
  // Create posting schedule
  const scheduleFile = path.join(weekDir, 'posting-schedule.json');
  const schedule = [];
  const startDate = new Date();
  
  for (let i = 0; i < allPrompts.length; i++) {
    const dayNumber = Math.floor(i / (modelsPerWeek === 7 ? 1 : 2)) + 1;
    const isSecondPost = modelsPerWeek === 14 && i % 2 === 1;
    const postDate = new Date(startDate);
    postDate.setDate(postDate.getDate() + dayNumber - 1);
    
    schedule.push({
      day: dayNumber,
      date: postDate.toISOString().split('T')[0],
      time: isSecondPost ? 'afternoon' : 'morning',
      model: allPrompts[i].model,
      slug: allPrompts[i].slug
    });
  }
  
  fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2));
  
  console.log(`\n✅ Generated ${allPrompts.length} prompts`);
  console.log(`📁 Output: ${weekDir}`);
  console.log(`📅 Posting: ${modelsPerWeek === 7 ? 'Once per day' : 'Twice per day'} for ${Math.ceil(modelsPerWeek / (modelsPerWeek === 7 ? 1 : 2))} days`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review prompts in: ${weekDir}`);
  console.log(`   2. Run through Claude/GPT (batch or individual)`);
  console.log(`   3. Save results to scenarios.json`);
  console.log(`   4. Run: npm run generate-content`);
  
  return { outputDir: weekDir, prompts: allPrompts };
}

// Generate batch prompts for a month (legacy function, kept for compatibility)
function generateMonthlyPrompts(days = 30) {
  const outputDir = path.join(process.cwd(), 'monthly-prompts');
  const monthDir = path.join(outputDir, new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM
  
  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir, { recursive: true });
  }
  
  const models = READWISE_MODELS;
  const modelsPerDay = Math.ceil(models.length / days);
  const allPrompts = [];
  
  console.log(`📝 Generating prompts for ${days} days...\n`);
  
  for (let day = 0; day < days; day++) {
    const startIdx = day * modelsPerDay;
    const endIdx = Math.min(startIdx + modelsPerDay, models.length);
    const dayModels = models.slice(startIdx, endIdx);
    
    const dayPrompts = [];
    
    for (const model of dayModels) {
      const promptData = generatePromptForModel(model);
      if (promptData) {
        dayPrompts.push(promptData);
        
        // Save individual prompt file
        const promptFile = path.join(monthDir, `day-${day + 1}-${model.slug}.txt`);
        fs.writeFileSync(promptFile, promptData.prompt);
      }
    }
    
    // Save day summary
    const dayFile = path.join(monthDir, `day-${day + 1}-summary.json`);
    fs.writeFileSync(dayFile, JSON.stringify({
      day: day + 1,
      date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      models: dayPrompts.map(p => ({ name: p.model, slug: p.slug }))
    }, null, 2));
    
    allPrompts.push(...dayPrompts);
    console.log(`Day ${day + 1}: ${dayPrompts.length} prompts generated`);
  }
  
  // Save master index
  const indexFile = path.join(monthDir, 'index.json');
  fs.writeFileSync(indexFile, JSON.stringify({
    generated: new Date().toISOString(),
    days,
    totalPrompts: allPrompts.length,
    models: allPrompts.map(p => ({ name: p.model, slug: p.slug }))
  }, null, 2));
  
  // Create batch prompt file (all prompts in one file for easy copy-paste)
  const batchFile = path.join(monthDir, 'batch-prompts.txt');
  const batchContent = allPrompts.map((p, i) => 
    `\n${'='.repeat(80)}\n\nPROMPT ${i + 1}: ${p.model}\n${'='.repeat(80)}\n\n${p.prompt}\n`
  ).join('\n');
  fs.writeFileSync(batchFile, batchContent);
  
  console.log(`\n✅ Generated ${allPrompts.length} prompts`);
  console.log(`📁 Output: ${monthDir}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review prompts in: ${monthDir}`);
  console.log(`   2. Run through Claude/GPT (batch or individual)`);
  console.log(`   3. Save results to scenarios.json`);
  console.log(`   4. Run: npm run generate-content`);
  
  return { outputDir: monthDir, prompts: allPrompts };
}

// Main execution
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='))?.split('=')[1] || 
                (args.includes('--days') ? args[args.indexOf('--days') + 1] : null);
const weekArg = args.find(arg => arg.startsWith('--week='))?.split('=')[1] || 
                (args.includes('--week') ? args[args.indexOf('--week') + 1] : null);
const modelArg = args.find(arg => arg.startsWith('--model='))?.split('=')[1] || 
                 (args.includes('--model') ? args[args.indexOf('--model') + 1] : null);
const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 
                  (args.includes('--output') ? args[args.indexOf('--output') + 1] : null);

if (modelArg) {
  // Single model
  const model = READWISE_MODELS.find(m => m.slug === modelArg);
  if (!model) {
    console.error(`❌ Model not found: ${modelArg}`);
    process.exit(1);
  }
  
  const promptData = generatePromptForModel(model);
  if (promptData) {
    console.log(`\n📝 Prompt for: ${model.name}\n`);
    console.log(promptData.prompt);
    
    // Save to file
    const outputDir = outputArg || path.join(process.cwd(), 'monthly-prompts', 'single');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const file = path.join(outputDir, `${model.slug}-prompt.txt`);
    fs.writeFileSync(file, promptData.prompt);
    console.log(`\n✅ Saved to: ${file}`);
  }
} else if (weekArg) {
  // Weekly generation (random selection)
  const modelsPerWeek = parseInt(weekArg, 10);
  if (modelsPerWeek !== 7 && modelsPerWeek !== 14) {
    console.error('❌ --week must be 7 (once per day) or 14 (twice per day)');
    process.exit(1);
  }
  generateWeeklyPrompts(modelsPerWeek);
} else {
  // Monthly generation (legacy, all models)
  const days = parseInt(daysArg || '30', 10);
  generateMonthlyPrompts(days);
}

