/**
 * X/Twitter Thread Generator
 *
 * Parses a published daily brief and extracts the sharpest insights
 * into a tweet thread format for automated posting.
 *
 * Thread structure:
 *   1. Hook tweet — the daily title + lede (grabs attention)
 *   2. Lead story — the most important update, compressed
 *   3. Second story — the second update, compressed
 *   4. Interesting thing — the most compelling discovery
 *   5. Model + CTA — the mental model + link to full brief
 *
 * Each tweet stays under 280 chars. The thread tells a story
 * that stands alone but makes you want the full brief.
 */

import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://cosmictrex.com';
const MAX_TWEET_LENGTH = 280;
const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');

export interface Tweet {
  text: string;
  index: number;
}

export interface GeneratedThread {
  date: string;
  dailyTitle: string;
  tweets: Tweet[];
}

// ─── Brief parsing (works on the full published brief) ─────────────────────

interface ParsedBrief {
  date: string;
  displayDate: string;
  dailyTitle: string;
  lede: string;
  epigraph: string;
  updateHeadlines: string[];       // Bold **Headline** from THE UPDATE
  updateBodies: string[];          // First paragraph after each headline
  interestingThings: string[];     // Bold headlines from INTERESTING THINGS
  interestingBodies: string[];     // First paragraph after each
  modelName: string;               // ### Model Name
  modelBody: string;               // First paragraph of THE MODEL
  meditationQuote: string;         // The blockquote from THE MEDITATION
}

function parseBriefForThread(markdown: string, dateSlug: string): ParsedBrief {
  const result: ParsedBrief = {
    date: dateSlug,
    displayDate: '',
    dailyTitle: '',
    lede: '',
    epigraph: '',
    updateHeadlines: [],
    updateBodies: [],
    interestingThings: [],
    interestingBodies: [],
    modelName: '',
    modelBody: '',
    meditationQuote: '',
  };

  const lines = markdown.split('\n');

  // Extract header fields
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = (lines[i] ?? '').trim();
    if (line.startsWith('## ') && !line.includes('▸') && !result.displayDate) {
      result.displayDate = line.replace('## ', '');
    }
    if (line.startsWith('### ') && !line.includes('▸') && !result.dailyTitle) {
      result.dailyTitle = line.replace('### ', '');
    }
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      if (!result.dailyTitle && !result.epigraph) {
        result.epigraph = line.slice(1, -1).replace(/^[""\u201C\u201D]+/, '').replace(/[""\u201C\u201D]+$/, '').trim();
      } else if (result.dailyTitle && !result.lede) {
        result.lede = line.slice(1, -1);
      }
    }
    if (line.includes('## ▸')) break;
  }

  // Extract sections by marker
  const sections = [
    { marker: '## ▸ THE UPDATE', type: 'update' },
    { marker: '## ▸ INTERESTING THINGS', type: 'interesting' },
    { marker: '## ▸ THE MODEL', type: 'model' },
    { marker: '## ▸ THE MEDITATION', type: 'meditation' },
  ];

  for (const sec of sections) {
    const startIdx = markdown.indexOf(sec.marker);
    if (startIdx === -1) continue;

    // Find end (next ## ▸ or end)
    let endIdx = markdown.length;
    const afterStart = markdown.indexOf('\n', startIdx);
    const rest = markdown.slice(afterStart);
    const nextSection = rest.match(/\n## ▸/);
    if (nextSection && nextSection.index !== undefined) {
      endIdx = afterStart + nextSection.index;
    }

    const content = markdown.slice(afterStart, endIdx);

    if (sec.type === 'update' || sec.type === 'interesting') {
      // Extract **Bold Headlines** and first paragraph after each
      const headlineRegex = /^\*\*(.+?)\*\*\s*$/gm;
      let match;
      while ((match = headlineRegex.exec(content)) !== null) {
        const headline = match[1]!;
        // Get the paragraph after the headline
        const afterHeadline = content.slice(match.index + match[0].length).trim();
        const firstParagraph = afterHeadline.split(/\n\s*\n/)[0]?.trim() || '';

        if (sec.type === 'update') {
          result.updateHeadlines.push(headline);
          result.updateBodies.push(firstParagraph);
        } else {
          result.interestingThings.push(headline);
          result.interestingBodies.push(firstParagraph);
        }
      }
    }

    if (sec.type === 'model') {
      const modelMatch = content.match(/^### (.+)$/m);
      if (modelMatch) result.modelName = modelMatch[1]!;
      // First paragraph after the ### heading
      const afterHeading = content.slice(content.indexOf(result.modelName) + result.modelName.length).trim();
      result.modelBody = afterHeading.split(/\n\s*\n/)[0]?.trim() || '';
    }

    if (sec.type === 'meditation') {
      const quoteMatch = content.match(/^\*"(.+?)"\*/m) || content.match(/^> (.+)/m);
      if (quoteMatch) result.meditationQuote = quoteMatch[1]!;
    }
  }

  return result;
}

// ─── Tweet composition ─────────────────────────────────────────────────────

function truncateToTweet(text: string, maxLen: number = MAX_TWEET_LENGTH): string {
  if (text.length <= maxLen) return text;
  // Cut at last sentence boundary before limit
  const truncated = text.slice(0, maxLen - 1);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const cutPoint = Math.max(lastPeriod, lastQuestion);
  if (cutPoint > maxLen * 0.5) {
    return truncated.slice(0, cutPoint + 1);
  }
  return truncated.trimEnd() + '…';
}

function compressForTweet(body: string, maxSentences: number = 3): string {
  // Strip markdown formatting
  let clean = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // bold
    .replace(/\*([^*]+)\*/g, '$1')              // italic
    .replace(/\n/g, ' ')                        // newlines
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .trim();

  // Take first N sentences
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

export function generateThread(markdown: string, dateSlug: string): GeneratedThread {
  const brief = parseBriefForThread(markdown, dateSlug);
  const briefUrl = `${SITE_URL}/daily-update`;
  const tweets: Tweet[] = [];
  let index = 0;

  // Tweet 1: Hook — Daily Title + compressed lede
  const hook = brief.lede
    ? `${brief.dailyTitle}\n\n${compressForTweet(brief.lede, 2)}`
    : brief.dailyTitle;
  tweets.push({ text: truncateToTweet(hook), index: index++ });

  // Tweet 2: Lead story
  if (brief.updateHeadlines[0] && brief.updateBodies[0]) {
    const story = `${brief.updateHeadlines[0]}\n\n${compressForTweet(brief.updateBodies[0], 2)}`;
    tweets.push({ text: truncateToTweet(story), index: index++ });
  }

  // Tweet 3: Second story (if exists)
  if (brief.updateHeadlines[1] && brief.updateBodies[1]) {
    const story = `${brief.updateHeadlines[1]}\n\n${compressForTweet(brief.updateBodies[1], 2)}`;
    tweets.push({ text: truncateToTweet(story), index: index++ });
  }

  // Tweet 4: Most compelling Interesting Thing
  if (brief.interestingThings[0] && brief.interestingBodies[0]) {
    const thing = `${brief.interestingThings[0]}\n\n${compressForTweet(brief.interestingBodies[0], 2)}`;
    tweets.push({ text: truncateToTweet(thing), index: index++ });
  }

  // Tweet 5: Model + CTA
  if (brief.modelName) {
    const modelTweet = brief.modelBody
      ? `Today's mental model: ${brief.modelName}\n\n${compressForTweet(brief.modelBody, 2)}\n\nFull brief ↓\n${briefUrl}`
      : `Today's mental model: ${brief.modelName}\n\nFull brief ↓\n${briefUrl}`;
    tweets.push({ text: truncateToTweet(modelTweet), index: index++ });
  } else {
    // Fallback CTA without model
    tweets.push({
      text: truncateToTweet(`50+ sources scanned. One brief. Every morning.\n\n${briefUrl}`),
      index: index++,
    });
  }

  return {
    date: dateSlug,
    dailyTitle: brief.dailyTitle,
    tweets,
  };
}

// ─── File accessor ─────────────────────────────────────────────────────────

export function generateThreadFromDate(dateSlug: string): GeneratedThread | null {
  // Try light brief first, fall back to full brief
  const lightPath = path.join(process.cwd(), 'daily-briefs', `${dateSlug}-light.md`);
  const fullPath = path.join(CONTENT_DIR, `${dateSlug}.md`);

  let filePath: string;
  if (fs.existsSync(lightPath)) {
    filePath = lightPath;
  } else if (fs.existsSync(fullPath)) {
    filePath = fullPath;
  } else {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return generateThread(content, dateSlug);
}

export function generateThreadForLatest(): GeneratedThread | null {
  // Find latest published brief
  if (!fs.existsSync(CONTENT_DIR)) return null;

  const files = fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();

  const latest = files[0];
  if (!latest) return null;

  const dateSlug = latest.replace('.md', '');
  return generateThreadFromDate(dateSlug);
}
