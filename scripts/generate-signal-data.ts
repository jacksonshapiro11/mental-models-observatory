#!/usr/bin/env ts-node
/**
 * Generate daily-signal.json from the latest published brief.
 *
 * Run during morning publish:
 *   npx ts-node scripts/generate-signal-data.ts
 *   OR: npx tsx scripts/generate-signal-data.ts
 *
 * This translates the latest brief's content into the landing page's
 * signal data format. No AI needed — it's a deterministic extraction.
 */

import fs from 'fs';
import path from 'path';

// ─── Paths ──────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'daily-signal.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLatestBriefFile(): string | null {
  if (!fs.existsSync(CONTENT_DIR)) return null;
  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();
  return files[0] || null;
}

function extractSection(content: string, marker: string): string {
  const idx = content.indexOf(marker);
  if (idx === -1) return '';
  const afterMarker = content.indexOf('\n', idx);
  if (afterMarker === -1) return '';

  // Find end: next # ▸ or --- or end of file
  const rest = content.slice(afterMarker + 1);
  const nextSection = rest.search(/^# ▸ /m);
  const nextHr = rest.indexOf('\n---\n');
  let end = rest.length;
  if (nextSection !== -1) end = Math.min(end, nextSection);
  if (nextHr !== -1) end = Math.min(end, nextHr);

  return rest.slice(0, end).trim();
}

function extractTitle(sectionContent: string): string {
  const match = sectionContent.match(/^###\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function extractFirstParagraph(sectionContent: string, minLen = 40): string {
  for (const line of sectionContent.split('\n')) {
    const t = line.trim();
    if (t.length >= minLen && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('>')) {
      return t;
    }
  }
  return '';
}

// ─── Signal color assignment ────────────────────────────────────────────────

function assignColor(domain: string, text: string): 'red' | 'green' | 'yellow' {
  const lower = text.toLowerCase();
  // Red signals: conflict, crisis, decline, kill, strike, crash
  if (/kill|strike|crash|declin|crisis|collapses?|war|attack|bomb|invasion/.test(lower)) return 'red';
  // Green signals: growth, rally, surge, record, launch, partnership
  if (/growth|rally|surge|record|launch|partner|breakthrough|gain|rise|profit/.test(lower)) return 'green';
  // Default: yellow (caution/watch)
  return 'yellow';
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const latestFile = getLatestBriefFile();
  if (!latestFile) {
    console.error('[signal-gen] No brief files found in', CONTENT_DIR);
    process.exit(1);
  }

  const dateSlug = latestFile.replace('.md', '');
  const content = fs.readFileSync(path.join(CONTENT_DIR, latestFile), 'utf-8');
  console.log(`[signal-gen] Processing ${latestFile}`);

  // ─── Extract header info ──────────────────────────────────────────────
  let displayDate = '';
  let dailyTitle = '';
  let epigraph = '';
  let lede = '';

  const headerLines = content.split('\n').slice(0, 25);
  let foundDate = false;
  for (const line of headerLines) {
    const t = line.trim();
    if (t.startsWith('## ') && !displayDate) {
      displayDate = t.replace('## ', '');
      foundDate = true;
    }
    if (t.startsWith('### ') && !dailyTitle && !t.includes('▸')) {
      dailyTitle = t.replace('### ', '');
    }
    if (t.startsWith('*') && t.endsWith('*') && !t.startsWith('**') && !epigraph) {
      epigraph = t.slice(1, -1).replace(/^[""\u201C\u201D]+/, '').replace(/[""\u201C\u201D]+$/, '').trim();
    }
    // Lede: italic paragraph after the title (starts with * and is long)
    if (foundDate && dailyTitle && t.startsWith('*') && !t.startsWith('**') && t.length > 100 && !lede) {
      lede = t.replace(/^\*/, '').replace(/\*$/, '').trim();
    }
    if (t === '---' && foundDate) break;
  }

  // ─── Extract headline from daily title or lede ────────────────────────
  const headline = dailyTitle || 'Daily Intelligence Brief';

  // ─── Extract TLDR from lede ───────────────────────────────────────────
  const tldr = lede || `${displayDate} — Markets, meditations, and mental models.`;

  // ─── Extract signals from The Six section ─────────────────────────────
  // Format: ## Domain Name \n\n - **Bold lead sentence.** Body text...
  const sixContent = extractSection(content, '# ▸ THE SIX');
  const signals: Array<{ text: string; color: 'red' | 'green' | 'yellow'; domain: string; terminalLine: string }> = [];

  if (sixContent) {
    let currentDomain = '';
    const sixLines = sixContent.split('\n');

    for (let i = 0; i < sixLines.length; i++) {
      const line = sixLines[i]?.trim() || '';

      // Domain headers: ## Markets & Macro, ## Companies & Crypto, etc.
      if (line.startsWith('## ') && !line.includes('▸')) {
        currentDomain = line.replace('## ', '').trim();
        continue;
      }

      // Signal bullets: - **Bold lead sentence.** ...
      if (line.startsWith('- **') && currentDomain) {
        // Extract the bold lead as terminal line
        const boldMatch = line.match(/- \*\*(.+?)\*\*/);
        const boldLead = boldMatch ? boldMatch[1].trim() : '';

        // Terminal line: use bold lead, truncated
        let terminalLine = boldLead;
        if (terminalLine.length > 70) {
          terminalLine = terminalLine.slice(0, 67).replace(/\s+\S*$/, '') + '...';
        }

        // Full text: combine bold lead + rest of body (may span lines)
        let fullText = line.replace(/^- /, '').replace(/\*\*/g, '');

        // Collect continuation lines until next bullet, heading, or blank line + heading
        for (let j = i + 1; j < sixLines.length; j++) {
          const nextLine = sixLines[j]?.trim() || '';
          if (nextLine.startsWith('- **') || nextLine.startsWith('## ') || nextLine.startsWith('# ▸')) break;
          if (nextLine === '' && (sixLines[j + 1]?.trim() || '').startsWith('## ')) break;
          if (nextLine === '' && (sixLines[j + 1]?.trim() || '').startsWith('- **')) break;
          if (nextLine) fullText += ' ' + nextLine;
        }

        // Truncate full text for display
        const text = fullText.length > 300
          ? fullText.slice(0, 297).replace(/\s+\S*$/, '') + '…'
          : fullText;

        signals.push({
          text,
          color: assignColor(currentDomain, boldLead),
          domain: currentDomain,
          terminalLine,
        });
      }
    }
  }

  // ─── Extract The Take ─────────────────────────────────────────────────
  const takeContent = extractSection(content, '# ▸ THE TAKE');
  const takeTitle = extractTitle(takeContent);
  const takeSubtitleMatch = takeContent.match(/^####\s+(.+)$/m);
  const takeSubtitle = takeSubtitleMatch ? takeSubtitleMatch[1].trim() : '';
  const takePreview = extractFirstParagraph(takeContent);

  // Extract framework line if present
  let framework = '';
  const fwMatch = takeContent.match(/\*\*Framework:\*\*\s*(.+)/i)
    || takeContent.match(/\*\*[^*]*Framework[^*]*:\*\*\s*(.+)/i);
  if (fwMatch) framework = fwMatch[1].trim();

  // ─── Extract Inner Game ───────────────────────────────────────────────
  const innerContent = extractSection(content, '# ▸ INNER GAME');
  let innerQuote = '';
  let innerAttribution = '';
  const quoteMatch = innerContent.match(/\*"([^*]+)"\*/);
  if (quoteMatch) {
    innerQuote = quoteMatch[1].trim();
    const afterQ = innerContent.slice(innerContent.indexOf(quoteMatch[0]) + quoteMatch[0].length);
    const attrMatch = afterQ.match(/[—–-]\s*(.+?)(?:\n|$)/);
    if (attrMatch) innerAttribution = attrMatch[1].replace(/\*/g, '').trim();
  }
  if (!innerQuote) {
    // Use first substantial paragraph
    const lines = innerContent.split('\n').filter(l => l.trim().length > 20);
    innerQuote = lines[0]?.replace(/^\*+|\*+$/g, '').trim() || '';
  }

  // Action: look for "Today's practice:" or last paragraph
  let innerAction = '';
  const actionMatch = innerContent.match(/\*\*Today's practice:\*\*\s*(.+?)(?:\n\n|$)/s);
  if (actionMatch) {
    innerAction = actionMatch[1].trim();
  } else {
    const paras = innerContent.split('\n\n').filter(p => p.trim().length > 30);
    if (paras.length > 1) innerAction = paras[paras.length - 1]?.trim() || '';
  }

  // ─── Extract The Model ────────────────────────────────────────────────
  const modelContent = extractSection(content, '# ▸ THE MODEL');
  const modelName = extractTitle(modelContent);
  const modelSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const modelPreview = extractFirstParagraph(modelContent);

  // ─── Count editions ───────────────────────────────────────────────────
  const editionCount = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('-light'))
    .length;

  // ─── Build output ─────────────────────────────────────────────────────
  const signalData = {
    date: dateSlug,
    edition: editionCount,
    format: 'full',
    lifeNote: epigraph,
    headline,
    tldr,
    signals: signals.slice(0, 6),
    take: {
      title: takeTitle,
      subtitle: takeSubtitle,
      preview: takePreview,
      framework,
    },
    innerGame: {
      quote: innerQuote,
      attribution: innerAttribution,
      action: innerAction,
    },
    model: {
      name: modelName,
      slug: modelSlug,
      preview: modelPreview,
    },
    updatedAt: new Date().toISOString(),
    briefUrl: '/daily-update',
  };

  // Write output
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(signalData, null, 2), 'utf-8');

  console.log(`[signal-gen] ✓ Written to ${OUTPUT_FILE}`);
  console.log(`[signal-gen]   date: ${dateSlug}`);
  console.log(`[signal-gen]   headline: ${headline}`);
  console.log(`[signal-gen]   signals: ${signals.length}`);
  console.log(`[signal-gen]   take: ${takeTitle}`);
  console.log(`[signal-gen]   model: ${modelName}`);
}

main();
