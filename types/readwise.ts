export interface ReadwiseHighlight {
  id: number;
  text: string;
  note: string | null;
  location: number;
  location_type: 'page' | 'location';
  highlighted_at: string;
  updated: string;
  external_id: string | null;
  end_location: number | null;
  url: string | null;
  book_id: number;
  tags: ReadwiseTag[];
  is_favorite: boolean;
  is_discard: boolean;
  readwise_url: string;
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
  cover_image_url: string;
  highlights_url: string;
  source_url: string | null;
  asin: string | null;
  tags: ReadwiseTag[];
}

export interface ReadwiseTag {
  id: number;
  name: string;
}

export interface ReadwiseResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface GetHighlightsParams {
  page_size?: number;
  page_cursor?: string;
  book_id?: number;
  updated__gt?: string;
  search?: string;
}

export interface GetBooksParams {
  page_size?: number;
  page_cursor?: string;
  category?: string;
  source?: string;
}

export interface ReadwiseError {
  code: string;
  message: string;
  details?: unknown;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}
