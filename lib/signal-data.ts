import fs from 'fs';
import path from 'path';
import { getLatestBrief, getAllBriefDates } from '@/lib/daily-update-parser';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SignalItem {
  text: string;
  color: 'red' | 'green' | 'yellow';
  domain: string;
  terminalLine: string;
}

export interface SignalData {
  date: string;
  edition: number;
  format: string;
  lifeNote: string;
  headline: string;
  tldr: string;
  signals: SignalItem[];
  take: {
    title: string;
    subtitle: string;
    preview: string;
    framework: string;
  };
  innerGame: {
    quote: string;
    attribution: string;
    action: string;
  };
  model: {
    name: string;
    slug: string;
    preview: string;
  };
  updatedAt: string;
  briefUrl: string;
}

// ─── Extraction helpers ─────────────────────────────────────────────────────

function extractSectionContent(markdown: string, marker: string): string {
  const idx = markdown.indexOf(marker);
  if (idx === -1) return '';
  const afterMarker = markdown.indexOf('\n', idx);
  if (afterMarker === -1) return '';

  const rest = markdown.slice(afterMarker + 1);
  const nextSection = rest.search(/^# ▸ /m);
  const nextHr = rest.indexOf('\n---\n');
  let end = rest.length;
  if (nextSection !== -1) end = Math.min(end, nextSection);
  if (nextHr !== -1) end = Math.min(end, nextHr);

  return rest.slice(0, end).trim();
}

function extractTitle(sectionContent: string): string {
  const match = sectionContent.match(/^###\s+(.+)$/m);
  return match && match[1] ? match[1].trim() : '';
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

function assignColor(text: string): 'red' | 'green' | 'yellow' {
  const lower = text.toLowerCase();
  if (/kill|strike|crash|declin|crisis|collapses?|war|attack|bomb|invasion/.test(lower)) return 'red';
  if (/growth|rally|surge|record|launch|partner|breakthrough|gain|rise|profit/.test(lower)) return 'green';
  return 'yellow';
}

// ─── Signal extraction from The Six ─────────────────────────────────────────

function extractSignals(markdown: string): SignalItem[] {
  const sixContent = extractSectionContent(markdown, '# ▸ THE SIX');
  const signals: SignalItem[] = [];
  if (!sixContent) return signals;

  let currentDomain = '';
  const lines = sixContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();

    // Domain headers: ## Markets & Macro, ## Companies & Crypto, etc.
    if (line.startsWith('## ') && !line.includes('▸')) {
      currentDomain = line.replace('## ', '').trim();
      continue;
    }

    // Signal bullets: - **Bold lead sentence.** ...
    if (line.startsWith('- **') && currentDomain) {
      const boldMatch = line.match(/- \*\*(.+?)\*\*/);
      const boldLead = boldMatch && boldMatch[1] ? boldMatch[1].trim() : '';

      let terminalLine = boldLead;
      if (terminalLine.length > 70) {
        terminalLine = terminalLine.slice(0, 67).replace(/\s+\S*$/, '') + '...';
      }

      let fullText = line.replace(/^- /, '').replace(/\*\*/g, '');

      // Collect continuation lines
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = (lines[j] ?? '').trim();
        if (nextLine.startsWith('- **') || nextLine.startsWith('## ') || nextLine.startsWith('# ▸')) break;
        if (nextLine === '' && ((lines[j + 1] ?? '').trim().startsWith('## ') || (lines[j + 1] ?? '').trim().startsWith('- **'))) break;
        if (nextLine) fullText += ' ' + nextLine;
      }

      const text = fullText.length > 300
        ? fullText.slice(0, 297).replace(/\s+\S*$/, '') + '…'
        : fullText;

      signals.push({
        text,
        color: assignColor(boldLead),
        domain: currentDomain,
        terminalLine,
      });
    }
  }

  return signals;
}

// ─── Inner Game extraction ──────────────────────────────────────────────────

function extractInnerGame(markdown: string): { quote: string; attribution: string; action: string } {
  const content = extractSectionContent(markdown, '# ▸ INNER GAME');
  if (!content) return { quote: '', attribution: '', action: '' };

  let quote = '';
  let attribution = '';

  const quoteMatch = content.match(/\*"([^*]+)"\*/);
  if (quoteMatch && quoteMatch[1]) {
    quote = quoteMatch[1].trim();
    const afterQuote = content.slice(content.indexOf(quoteMatch[0]) + quoteMatch[0].length);
    const attrMatch = afterQuote.match(/[—–-]\s*(.+?)(?:\n|$)/);
    if (attrMatch && attrMatch[1]) {
      attribution = attrMatch[1].replace(/\*/g, '').trim();
    }
  }

  if (!quote) {
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    quote = lines[0]?.replace(/^\*+|\*+$/g, '').trim() ?? '';
  }

  let action = '';
  const actionMatch = content.match(/\*\*Today's practice:\*\*\s*(.+?)(\n\n|$)/);
  if (actionMatch && actionMatch[1]) {
    action = actionMatch[1].trim();
  } else {
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 30);
    if (paragraphs.length > 1) {
      action = paragraphs[paragraphs.length - 1]?.trim() ?? '';
    }
  }

  return { quote, attribution, action };
}

// ─── Model extraction ───────────────────────────────────────────────────────

function extractModel(markdown: string): { name: string; slug: string; preview: string } {
  const content = extractSectionContent(markdown, '# ▸ THE MODEL');
  const name = extractTitle(content);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const preview = extractFirstParagraph(content);
  return { name, slug, preview: preview || name };
}

// ─── Main: generate signal data from latest brief ───────────────────────────

function generateFromBrief(): SignalData | null {
  const brief = getLatestBrief();
  if (!brief) return null;

  const markdown = brief.raw;
  const editionCount = getAllBriefDates().length;

  // Extract TLDR from lede (strip bold label if present)
  const tldr = brief.lede
    ? brief.lede.replace(/^\*\*[^*]+\*\*\s*/, '').trim()
    : '';

  // Extract take
  const takeContent = extractSectionContent(markdown, '# ▸ THE TAKE');
  const takeTitle = extractTitle(takeContent);
  const takeSubMatch = takeContent.match(/^####\s+(.+)$/m);
  const takeSubtitle = takeSubMatch && takeSubMatch[1] ? takeSubMatch[1].trim() : '';
  const takePreview = extractFirstParagraph(takeContent);
  let framework = '';
  const fwMatch = takeContent.match(/\*\*(?:[^*]*)?Framework(?:[^*]*):\*\*\s*(.+)/i);
  if (fwMatch && fwMatch[1]) framework = fwMatch[1].trim();

  return {
    date: brief.date,
    edition: editionCount,
    format: 'full',
    lifeNote: brief.epigraph,
    headline: brief.dailyTitle || 'Daily Intelligence Brief',
    tldr: tldr || `${brief.displayDate} — Markets, meditations, and mental models.`,
    signals: extractSignals(markdown),
    take: {
      title: takeTitle,
      subtitle: takeSubtitle,
      preview: takePreview,
      framework,
    },
    innerGame: extractInnerGame(markdown),
    model: extractModel(markdown),
    updatedAt: new Date().toISOString(),
    briefUrl: '/daily-update',
  };
}

// ─── Public API (backward-compatible) ───────────────────────────────────────

// Try JSON file first (for backward compat), fall back to live generation
const SIGNAL_FILE = path.join(process.cwd(), 'data', 'daily-signal.json');

export function getSignalData(): SignalData | null {
  // Check if JSON file exists and is from today
  try {
    if (fs.existsSync(SIGNAL_FILE)) {
      const raw = fs.readFileSync(SIGNAL_FILE, 'utf-8');
      const data = JSON.parse(raw) as SignalData;
      // Use the file if it matches the latest brief date
      const brief = getLatestBrief();
      if (brief && data.date === brief.date) {
        return data;
      }
    }
  } catch {
    // Fall through to live generation
  }

  // Generate live from the latest brief
  return generateFromBrief();
}

export function getSignalDataSync(): SignalData | null {
  return getSignalData();
}
