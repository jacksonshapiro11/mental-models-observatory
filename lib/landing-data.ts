import { getAllBriefDates, getBriefByDate } from '@/lib/daily-update-parser';

/**
 * Pull real archive takes from published briefs for the landing page.
 * Returns the most recent N takes with title, date, and excerpt.
 */
export interface ArchiveTake {
  title: string;
  date: string;
  excerpt: string;
}

export function getRecentArchiveTakes(count = 3): ArchiveTake[] {
  const dates = getAllBriefDates().slice(0, count + 5); // grab extra in case some lack takes
  const takes: ArchiveTake[] = [];

  for (const dateSlug of dates) {
    if (takes.length >= count) break;
    const brief = getBriefByDate(dateSlug);
    if (!brief) continue;

    const takeSection = brief.sections.find(s => s.type === 'the-take');
    if (!takeSection) continue;

    // Extract title from first ### heading in the take content
    const titleMatch = takeSection.content.match(/^###\s+(.+)$/m);
    if (!titleMatch || !titleMatch[1]) continue;

    const title = titleMatch[1].trim();

    // Extract first meaningful paragraph as excerpt (skip headings, subtitles, empty lines)
    const lines = takeSection.content.split('\n');
    let excerpt = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length > 40 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('---') &&
        !trimmed.startsWith('>')
      ) {
        excerpt = trimmed.length > 160
          ? trimmed.slice(0, 157).replace(/\s+\S*$/, '') + '…'
          : trimmed;
        break;
      }
    }

    if (!excerpt) {
      excerpt = title;
    }

    takes.push({ title, date: dateSlug, excerpt });
  }

  return takes;
}

/**
 * Pull Inner Game content from the latest brief.
 */
export interface InnerGameData {
  quote: string;
  attribution: string;
  action: string;
}

export function getLatestInnerGame(): InnerGameData | null {
  const dates = getAllBriefDates();
  for (const dateSlug of dates.slice(0, 3)) {
    const brief = getBriefByDate(dateSlug);
    if (!brief) continue;

    const section = brief.sections.find(s => s.type === 'inner-game');
    if (!section?.content) continue;

    const content = section.content;

    // Extract quote — look for italic text or blockquote
    let quote = '';
    let attribution = '';
    const quoteMatch = content.match(/\*"([^*]+)"\*/);
    if (quoteMatch && quoteMatch[1]) {
      quote = quoteMatch[1].trim();
      // Attribution often follows on same or next line
      const afterQuote = content.slice(content.indexOf(quoteMatch[0]) + quoteMatch[0].length);
      const attrMatch = afterQuote.match(/[—–-]\s*(.+?)(?:\n|$)/);
      if (attrMatch && attrMatch[1]) {
        attribution = attrMatch[1].replace(/\*/g, '').trim();
      }
    }

    // If no quote format, just use first substantial paragraph
    if (!quote) {
      const lines = content.split('\n').filter(l => l.trim().length > 20);
      quote = lines[0]?.replace(/^\*+|\*+$/g, '').trim() ?? '';
    }

    // Extract action — look for "Today's practice:" or "Action:" or bold text
    let action = '';
    const actionMatch = content.match(/\*\*Today's practice:\*\*\s*(.+?)(\n\n|$)/)
      || content.match(/\*\*Action:\*\*\s*(.+?)(\n\n|$)/);
    if (actionMatch && actionMatch[1]) {
      action = actionMatch[1].trim();
    } else {
      // Use last substantial paragraph as action
      const paragraphs = content.split('\n\n').filter(p => p.trim().length > 30);
      if (paragraphs.length > 1) {
        action = paragraphs[paragraphs.length - 1]?.trim() ?? '';
      }
    }

    return { quote, attribution, action };
  }
  return null;
}

/**
 * Pull Discovery/Model content from the latest brief.
 */
export interface DiscoveryData {
  name: string;
  preview: string;
}

export function getLatestDiscovery(): DiscoveryData | null {
  const dates = getAllBriefDates();
  for (const dateSlug of dates.slice(0, 3)) {
    const brief = getBriefByDate(dateSlug);
    if (!brief) continue;

    const section = brief.sections.find(s => s.type === 'the-model' || s.type === 'discovery');
    if (!section?.content) continue;

    // Extract name from ### heading
    const nameMatch = section.content.match(/^###\s+(.+)$/m);
    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'Today\'s Model';

    // Extract first substantial paragraph as preview
    const lines = section.content.split('\n');
    let preview = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length > 40 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('---')
      ) {
        preview = trimmed.length > 200
          ? trimmed.slice(0, 197).replace(/\s+\S*$/, '') + '…'
          : trimmed;
        break;
      }
    }

    return { name, preview: preview || name };
  }
  return null;
}

/**
 * Get edition count from published briefs.
 */
export function getEditionCount(): number {
  return getAllBriefDates().length;
}
