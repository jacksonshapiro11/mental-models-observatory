/**
 * X/Twitter Post Generator
 *
 * Generates a 3-post sequence optimized for X's algorithm:
 *
 *   Post 1: THE HOOK — Single most shareable insight from the brief.
 *           Must stand alone. Must make people screenshot it.
 *           No link. No "good morning." No branding. Just the insight.
 *           280 chars max (works with or without Premium).
 *
 *   Post 2: THE DEPTH — Self-reply with 2-3 more compressed insights
 *           from different domains (shows breadth). Plus the mental model
 *           as a one-liner. This rewards people who click into the thread.
 *           280 chars max.
 *
 *   Post 3: THE LINK — Self-reply with meditation quote + brief link.
 *           Link ONLY lives here. Avoids the 30-50% reach penalty on
 *           the main post. Earns the click with the emotional hook.
 *           280 chars max.
 *
 * Why this format:
 * - All engagement concentrates on Post 1 (algorithm's primary signal)
 * - First 30 min engagement velocity decides reach — hook must be instant
 * - Links in main post = 30-50% reach penalty (confirmed 2025-2026 data)
 * - Each post is independently valuable (screenshot-worthy)
 * - 3 posts > 7 posts: most people drop off after post 3 in threads
 *
 * Design principle: Kobeissi Letter model.
 * Substantive content formatted for maximum legibility.
 * Anti-clickbait content using clickbait mechanics.
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

// ─── Brief parsing ────────────────────────────────────────────────────────

interface ParsedBrief {
  date: string;
  displayDate: string;
  dailyTitle: string;
  lede: string;
  epigraph: string;
  updateHeadlines: string[];
  updateBodies: string[];
  interestingThings: string[];
  interestingBodies: string[];
  modelName: string;
  modelBody: string;
  meditationQuote: string;
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
        result.epigraph = line.slice(1, -1).replace(/^[""“”]+/, '').replace(/[""“”]+$/, '').trim();
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

    let endIdx = markdown.length;
    const afterStart = markdown.indexOf('\n', startIdx);
    const rest = markdown.slice(afterStart);
    const nextSection = rest.match(/\n## ▸/);
    if (nextSection && nextSection.index !== undefined) {
      endIdx = afterStart + nextSection.index;
    }

    const content = markdown.slice(afterStart, endIdx);

    if (sec.type === 'update' || sec.type === 'interesting') {
      const headlineRegex = /^\*\*(.+?)\*\*\s*$/gm;
      let match;
      while ((match = headlineRegex.exec(content)) !== null) {
        const headline = match[1]!;
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

// ─── Text utilities ───────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // bold
    .replace(/\*([^*]+)\*/g, '$1')               // italic
    .replace(/\n/g, ' ')                         // newlines
    .replace(/\s+/g, ' ')                        // collapse whitespace
    .trim();
}

/**
 * Extract the single most concrete, surprising sentence from a paragraph.
 * Looks for sentences with numbers, dollar signs, or percentages first
 * (these are the screenshot-worthy facts). Falls back to first sentence.
 */
function extractKillerLine(body: string): string {
  const clean = stripMarkdown(body);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];

  // Prioritize sentences with hard numbers — these get screenshots
  const withNumbers = sentences.filter(s =>
    /\$[\d,.]+|\d+%|\d+\s*(billion|million|trillion)/i.test(s)
  );
  if (withNumbers[0]) return withNumbers[0].trim();

  // Next priority: sentences with surprising contrasts or specifics
  const withContrast = sentences.filter(s =>
    /but |however |while |despite |not |yet /i.test(s)
  );
  if (withContrast[0]) return withContrast[0].trim();

  // Default to first sentence
  return (sentences[0] || clean).trim();
}

/**
 * Compress a paragraph to fit in a tweet alongside a headline.
 * Takes the first N sentences that fit.
 */
function compressToFit(body: string, availableChars: number): string {
  const clean = stripMarkdown(body);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let result = '';
  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > availableChars) break;
    result = candidate;
  }
  return result || sentences[0]?.trim().slice(0, availableChars) || '';
}

function truncate(text: string, maxLen: number = MAX_TWEET_LENGTH): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen - 1);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const cutPoint = Math.max(lastPeriod, lastQuestion);
  if (cutPoint > maxLen * 0.5) {
    return truncated.slice(0, cutPoint + 1);
  }
  return truncated.trimEnd() + '…';
}

// ─── Post composition ─────────────────────────────────────────────────────

/**
 * Generate a 3-post X sequence: Hook → Depth → Link
 *
 * The hook is the single most important thing. It needs to:
 * 1. Stop the scroll (surprising, specific, concrete)
 * 2. Stand completely alone (no context needed)
 * 3. Make someone look smart for sharing it
 * 4. Fit in 280 chars (algorithm gives full reach)
 *
 * We pick the hook by scanning all stories for the most concrete,
 * number-rich, surprising single insight. The daily title is the
 * frame, but the hook line is what stops the scroll.
 */
export function generateThread(markdown: string, dateSlug: string): GeneratedThread {
  const brief = parseBriefForThread(markdown, dateSlug);
  const superBriefUrl = `${SITE_URL}/super-brief`;
  const tweets: Tweet[] = [];

  // ── POST 1: THE HOOK ─────────────────────────────────────────────────
  //
  // Format: Daily title + lede. The lede is editorially crafted to pair
  // with the title — that's its whole job. Using it preserves coherence.
  //
  // The title stops the scroll. The lede delivers the "here's why you
  // should care" in 1-2 sentences. Together they're the hook.
  //
  // Only fall back to extracted killer lines if no lede exists.

  let hookText = '';

  // Build killer lines index (used for hook fallback AND for Post 2 filtering)
  const allKillerLines: { line: string; source: string }[] = [];
  for (let i = 0; i < brief.updateBodies.length; i++) {
    const line = extractKillerLine(brief.updateBodies[i] || '');
    if (line) allKillerLines.push({ line, source: brief.updateHeadlines[i] || '' });
  }
  for (let i = 0; i < brief.interestingBodies.length; i++) {
    const line = extractKillerLine(brief.interestingBodies[i] || '');
    if (line) allKillerLines.push({ line, source: brief.interestingThings[i] || '' });
  }
  allKillerLines.sort((a, b) => {
    const scoreA = (a.line.match(/\$|%|billion|million|trillion/gi) || []).length;
    const scoreB = (b.line.match(/\$|%|billion|million|trillion/gi) || []).length;
    return scoreB - scoreA;
  });

  // Primary: title + compressed lede (editorially coherent)
  if (brief.lede) {
    const titleWithBreak = `${brief.dailyTitle}\n\n`;
    const available = MAX_TWEET_LENGTH - titleWithBreak.length;
    const compressed = compressToFit(brief.lede, available);
    if (compressed) {
      hookText = `${titleWithBreak}${compressed}`;
    }
  }

  // Fallback: title + best killer line (if no lede or it didn't fit)
  if (!hookText && allKillerLines[0]) {
    const candidate = `${brief.dailyTitle}\n\n${allKillerLines[0].line}`;
    if (candidate.length <= MAX_TWEET_LENGTH) {
      hookText = candidate;
    }
  }

  // Last resort: title alone
  if (!hookText) {
    hookText = brief.dailyTitle;
  }

  tweets.push({ text: truncate(hookText), index: 0 });

  // ── POST 2: THE DEPTH ────────────────────────────────────────────────
  //
  // Self-reply that rewards the click-through. Shows the BREADTH of the
  // brief: headlines from different domains. Each headline is a standalone
  // curiosity gap. The mental model closes it out.
  //
  // Format:
  //   Also in today's brief:
  //   → [Headline 1]
  //   → [Headline 2]
  //   → [Headline 3]
  //   → Model: [Name]

  const depthLines: string[] = [];

  // Strategy: 2 update headlines + 1 interesting thing + model
  // The interesting thing is typically the most viral-friendly content
  // (weird science, surprising discoveries — things people RT to look smart).
  // 2 updates show breadth, the interesting thing is the share magnet.
  const usedSource = allKillerLines[0]?.source || '';
  const remainingHeadlines = brief.updateHeadlines.filter(h => h !== usedSource);
  for (let i = 0; i < Math.min(remainingHeadlines.length, 2); i++) {
    depthLines.push(`→ ${remainingHeadlines[i]}`);
  }

  // Add the interesting thing — this is the share magnet
  if (brief.interestingThings[0]) {
    depthLines.push(`→ ${brief.interestingThings[0]}`);
  }

  // Add model as closer
  if (brief.modelName) {
    depthLines.push(`→ Model: ${brief.modelName}`);
  }

  if (depthLines.length > 0) {
    let depthText = `Also today:\n\n${depthLines.join('\n')}`;

    // If too long, trim headlines from the middle
    while (depthText.length > MAX_TWEET_LENGTH && depthLines.length > 2) {
      // Remove the line before the model (least important)
      depthLines.splice(depthLines.length - 2, 1);
      depthText = `Also today:\n\n${depthLines.join('\n')}`;
    }

    // If still too long, truncate individual headlines
    if (depthText.length > MAX_TWEET_LENGTH) {
      const truncatedLines = depthLines.map(line => {
        if (line.length > 60) return line.slice(0, 57) + '…';
        return line;
      });
      depthText = `Also today:\n\n${truncatedLines.join('\n')}`;
    }

    tweets.push({ text: truncate(depthText), index: 1 });
  }

  // ── POST 3: THE LINK ─────────────────────────────────────────────────
  //
  // Self-reply with the meditation quote (emotional hook that makes people
  // pause) + link. This is the only post with a URL.
  //
  // The meditation quote earns the click by shifting register — from
  // information to wisdom. People who made it this far are primed to
  // subscribe.

  if (brief.meditationQuote) {
    // Quote + link
    const quoteClean = stripMarkdown(brief.meditationQuote);
    // Take first sentence of quote if it's too long
    const quoteSentences = quoteClean.match(/[^.!?]+[.!?]+/g) || [quoteClean];
    const shortQuote = quoteSentences[0]?.trim() || quoteClean;

    let ctaText = `"${shortQuote}"\n\nFull brief — free, every morning:\n${superBriefUrl}`;

    if (ctaText.length > MAX_TWEET_LENGTH) {
      // Shorten the quote further
      const veryShort = shortQuote.slice(0, MAX_TWEET_LENGTH - superBriefUrl.length - 50) + '…';
      ctaText = `"${veryShort}"\n\nFull brief — free, every morning:\n${superBriefUrl}`;
    }

    tweets.push({ text: truncate(ctaText), index: tweets.length });
  } else {
    const ctaText = `50+ sources. One brief. Every morning.\n\nRead today's:\n${superBriefUrl}`;
    tweets.push({ text: truncate(ctaText), index: tweets.length });
  }

  return {
    date: dateSlug,
    dailyTitle: brief.dailyTitle,
    tweets,
  };
}

// ─── File accessors ───────────────────────────────────────────────────────

export function generateThreadFromDate(dateSlug: string): GeneratedThread | null {
  // Prefer the light brief (its section markers match our parser: ## ▸ THE UPDATE, etc.)
  // The full brief uses different markers (# ▸ THE SIX) that this parser doesn't handle.
  const lightPublished = path.join(CONTENT_DIR, `${dateSlug}-light.md`);
  const lightDraft = path.join(process.cwd(), 'daily-briefs', `${dateSlug}-light.md`);
  const fullPath = path.join(CONTENT_DIR, `${dateSlug}.md`);

  let filePath: string;
  if (fs.existsSync(lightPublished)) {
    filePath = lightPublished;
  } else if (fs.existsSync(lightDraft)) {
    filePath = lightDraft;
  } else if (fs.existsSync(fullPath)) {
    filePath = fullPath;
  } else {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return generateThread(content, dateSlug);
}

export function generateThreadForLatest(): GeneratedThread | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;

  // Try light briefs first — they match our parser's section markers
  const lightFiles = fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('-light.md'))
    .sort()
    .reverse();

  if (lightFiles[0]) {
    const dateSlug = lightFiles[0].replace('-light.md', '');
    return generateThreadFromDate(dateSlug);
  }

  // Fall back to full briefs
  const fullFiles = fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();

  const latest = fullFiles[0];
  if (!latest) return null;

  const dateSlug = latest.replace('.md', '');
  return generateThreadFromDate(dateSlug);
}
