export interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string;
  location?: number;
  location_type?: string;
  highlighted_at: string;
  book_id: number;
  url?: string;
  color?: string;
  updated: string;
  created: string;
}

export interface ReadwiseBook {
  id: number;
  title: string;
  author: string;
  category: string;
  source: string;
  num_highlights: number;
  last_highlight_at: string;
  updated: string;
  cover_image_url?: string;
  highlights_url: string;
  source_url?: string;
  asin?: string;
  tags: string[];
}

export interface ReadwiseResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

/**
 * Fetch highlights from Readwise API
 */
export async function fetchHighlights(
  token: string,
  pageSize: number = 1000,
  pageCursor?: string
): Promise<ReadwiseResponse<ReadwiseHighlight>> {
  const baseUrl = 'https://readwise.io/api/v2/highlights/';
  const params = new URLSearchParams({
    page_size: pageSize.toString(),
  });

  if (pageCursor) {
    params.append('page_cursor', pageCursor);
  }

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch books from Readwise API
 */
export async function fetchBooks(
  token: string,
  pageSize: number = 1000,
  pageCursor?: string
): Promise<ReadwiseResponse<ReadwiseBook>> {
  const baseUrl = 'https://readwise.io/api/v2/books/';
  const params = new URLSearchParams({
    page_size: pageSize.toString(),
  });

  if (pageCursor) {
    params.append('page_cursor', pageCursor);
  }

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all highlights from Readwise (handles pagination)
 */
export async function fetchAllHighlights(token: string): Promise<ReadwiseHighlight[]> {
  const allHighlights: ReadwiseHighlight[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await fetchHighlights(token, 1000, nextCursor);
    allHighlights.push(...response.results);
    nextCursor = response.next || undefined;
  } while (nextCursor);

  return allHighlights;
}

/**
 * Fetch all books from Readwise (handles pagination)
 */
export async function fetchAllBooks(token: string): Promise<ReadwiseBook[]> {
  const allBooks: ReadwiseBook[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await fetchBooks(token, 1000, nextCursor);
    allBooks.push(...response.results);
    nextCursor = response.next || undefined;
  } while (nextCursor);

  return allBooks;
}

/**
 * Filter highlights by tags
 */
export function filterHighlightsByTags(
  highlights: ReadwiseHighlight[],
  _tags: string[]
): ReadwiseHighlight[] {
  return highlights.filter(_highlight => {
    // This would need to be implemented based on how tags are stored
    // For now, we'll return all highlights
    return true;
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
 * Search highlights by text
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
