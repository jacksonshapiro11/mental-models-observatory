import ReadwiseClient from '@/lib/readwise-client';
import { 
  ReadwiseHighlight,
  ReadwiseBook,
  ReadwiseResponse,
  GetHighlightsParams, 
  GetBooksParams 
} from '@/types/readwise';

// Re-export types from the new comprehensive type definitions
export type {
  ReadwiseHighlight,
  ReadwiseBook,
  ReadwiseResponse,
  ReadwiseTag,
  GetHighlightsParams,
  GetBooksParams,
  ReadwiseError,
  CacheEntry,
  RequestOptions
} from '@/types/readwise';

/**
 * Fetch highlights from Readwise API using the new client
 */
export async function fetchHighlights(
  token: string,
  pageSize: number = 1000,
  pageCursor?: string
): Promise<ReadwiseResponse<ReadwiseHighlight>> {
  const client = new ReadwiseClient(token);
  const params: GetHighlightsParams = {
    page_size: pageSize,
    ...(pageCursor && { page_cursor: pageCursor })
  };
  return client.getHighlights(params);
}

/**
 * Fetch books from Readwise API using the new client
 */
export async function fetchBooks(
  token: string,
  pageSize: number = 1000,
  pageCursor?: string
): Promise<ReadwiseResponse<ReadwiseBook>> {
  const client = new ReadwiseClient(token);
  const params: GetBooksParams = {
    page_size: pageSize,
    ...(pageCursor && { page_cursor: pageCursor })
  };
  return client.getBooks(params);
}

/**
 * Fetch all highlights from Readwise (handles pagination)
 */
export async function fetchAllHighlights(token: string): Promise<ReadwiseHighlight[]> {
  const client = new ReadwiseClient(token);
  return client.getAllHighlights();
}

/**
 * Fetch all books from Readwise (handles pagination)
 */
export async function fetchAllBooks(token: string): Promise<ReadwiseBook[]> {
  const client = new ReadwiseClient(token);
  return client.getAllBooks();
}

// Re-export utility functions from the new utilities module
export {
  filterHighlightsByTags,
  groupHighlightsByBook,
  searchHighlights,
  getUniqueTags,
  filterHighlightsByDateRange,
  getRecentHighlights,
  sortHighlights,
  getHighlightStats,
  exportHighlights
} from '@/lib/readwise-utils';
