import ReadwiseClient from '@/lib/readwise-client';
import { ReadwiseHighlight, ReadwiseBook } from '@/types/readwise';

/**
 * Create a singleton Readwise client instance
 */
let readwiseClient: ReadwiseClient | null = null;

export function getReadwiseClient(): ReadwiseClient {
  if (!readwiseClient) {
    const token = process.env.READWISE_API_TOKEN;
    if (!token) {
      throw new Error('Readwise API token not configured');
    }
    readwiseClient = new ReadwiseClient(token);
  }
  return readwiseClient;
}

/**
 * Filter highlights by tags
 */
export function filterHighlightsByTags(
  highlights: ReadwiseHighlight[],
  tags: string[]
): ReadwiseHighlight[] {
  if (!tags.length) return highlights;
  
  return highlights.filter(highlight => {
    const highlightTags = highlight.tags.map(tag => tag.name.toLowerCase());
    return tags.some(tag => highlightTags.includes(tag.toLowerCase()));
  });
}

/**
 * Group highlights by book
 */
export function groupHighlightsByBook(
  highlights: ReadwiseHighlight[],
  books: ReadwiseBook[]
): Record<number, { book: ReadwiseBook; highlights: ReadwiseHighlight[] }> {
  const bookMap = new Map(books.map(book => [book.id, book]));
  const grouped: Record<number, { book: ReadwiseBook; highlights: ReadwiseHighlight[] }> = {};

  highlights.forEach(highlight => {
    const book = bookMap.get(highlight.book_id);
    if (book) {
      if (!grouped[highlight.book_id]) {
        grouped[highlight.book_id] = { book, highlights: [] };
      }
      const group = grouped[highlight.book_id];
      if (group) {
        group.highlights.push(highlight);
      }
    }
  });

  return grouped;
}

/**
 * Search highlights by text content
 */
export function searchHighlights(
  highlights: ReadwiseHighlight[],
  searchTerm: string
): ReadwiseHighlight[] {
  const term = searchTerm.toLowerCase();
  return highlights.filter(highlight => 
    highlight.text.toLowerCase().includes(term) ||
    (highlight.note && highlight.note.toLowerCase().includes(term))
  );
}

/**
 * Get unique tags from highlights
 */
export function getUniqueTags(highlights: ReadwiseHighlight[]): string[] {
  const tagSet = new Set<string>();
  
  highlights.forEach(highlight => {
    highlight.tags.forEach(tag => {
      tagSet.add(tag.name);
    });
  });
  
  return Array.from(tagSet).sort();
}

/**
 * Get highlights by date range
 */
export function filterHighlightsByDateRange(
  highlights: ReadwiseHighlight[],
  startDate: string,
  endDate?: string
): ReadwiseHighlight[] {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  return highlights.filter(highlight => {
    const highlightDate = new Date(highlight.highlighted_at);
    return highlightDate >= start && highlightDate <= end;
  });
}

/**
 * Get recent highlights (last N days)
 */
export function getRecentHighlights(
  highlights: ReadwiseHighlight[],
  days: number = 7
): ReadwiseHighlight[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return highlights.filter(highlight => {
    const highlightDate = new Date(highlight.highlighted_at);
    return highlightDate >= cutoffDate;
  });
}

/**
 * Sort highlights by various criteria
 */
export function sortHighlights(
  highlights: ReadwiseHighlight[],
  sortBy: 'date' | 'location' | 'text' = 'date',
  direction: 'asc' | 'desc' = 'desc'
): ReadwiseHighlight[] {
  return [...highlights].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.highlighted_at).getTime() - new Date(b.highlighted_at).getTime();
        break;
      case 'location':
        comparison = (a.location || 0) - (b.location || 0);
        break;
      case 'text':
        comparison = a.text.localeCompare(b.text);
        break;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Get statistics about highlights
 */
export function getHighlightStats(highlights: ReadwiseHighlight[]) {
  const totalHighlights = highlights.length;
  const totalBooks = new Set(highlights.map(h => h.book_id)).size;
  const totalTags = getUniqueTags(highlights).length;
  const favorites = highlights.filter(h => h.is_favorite).length;
  
  const dateRange = highlights.length > 0 ? {
    earliest: new Date(Math.min(...highlights.map(h => new Date(h.highlighted_at).getTime()))),
    latest: new Date(Math.max(...highlights.map(h => new Date(h.highlighted_at).getTime())))
  } : null;
  
  return {
    totalHighlights,
    totalBooks,
    totalTags,
    favorites,
    dateRange
  };
}

/**
 * Export highlights to various formats
 */
export function exportHighlights(
  highlights: ReadwiseHighlight[],
  format: 'json' | 'csv' | 'txt' = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(highlights, null, 2);
    
    case 'csv':
      const headers = ['id', 'text', 'note', 'location', 'highlighted_at', 'book_id', 'tags'];
      const rows = highlights.map(h => [
        h.id,
        `"${h.text.replace(/"/g, '""')}"`,
        h.note ? `"${h.note.replace(/"/g, '""')}"` : '',
        h.location || '',
        h.highlighted_at,
        h.book_id,
        h.tags.map(t => t.name).join(';')
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    case 'txt':
      return highlights.map(h => 
        `${h.text}\n${h.note ? `Note: ${h.note}\n` : ''}---\n`
      ).join('\n');
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
