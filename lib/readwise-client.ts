import {
  ReadwiseHighlight,
  ReadwiseBook,
  ReadwiseResponse,
  GetHighlightsParams,
  GetBooksParams,
  ReadwiseError,
  CacheEntry,
  RequestOptions
} from '@/types/readwise';

class ReadwiseClient {
  private baseURL = 'https://readwise.io/api/v2';
  private token: string;
  private cache = new Map<string, CacheEntry<unknown>>();
  private requestQueue: Promise<unknown>[] = [];
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000;
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Get highlights with pagination and filtering
   */
  async getHighlights(params?: GetHighlightsParams): Promise<ReadwiseResponse<ReadwiseHighlight>> {
    const cacheKey = `highlights:${JSON.stringify(params)}`;
    const cached = this.getFromCache<ReadwiseResponse<ReadwiseHighlight>>(cacheKey);
    if (cached) return cached;

    const response = await this.makeRequest<ReadwiseResponse<ReadwiseHighlight>>(
      '/highlights/',
      params
    );

    this.setCache(cacheKey, response);
    return response;
  }

  /**
   * Get books with pagination and filtering
   */
  async getBooks(params?: GetBooksParams): Promise<ReadwiseResponse<ReadwiseBook>> {
    const cacheKey = `books:${JSON.stringify(params)}`;
    const cached = this.getFromCache<ReadwiseResponse<ReadwiseBook>>(cacheKey);
    if (cached) return cached;

    const response = await this.makeRequest<ReadwiseResponse<ReadwiseBook>>(
      '/books/',
      params
    );

    this.setCache(cacheKey, response);
    return response;
  }

  /**
   * Get highlights by book ID
   */
  async getHighlightsByBook(bookId: number): Promise<ReadwiseResponse<ReadwiseHighlight>> {
    return this.getHighlights({ book_id: bookId });
  }

  /**
   * Get a single book by ID
   */
  async getBookById(bookId: number): Promise<ReadwiseBook> {
    const cacheKey = `book:${bookId}`;
    const cached = this.getFromCache<ReadwiseBook>(cacheKey);
    if (cached) return cached;

    const response = await this.makeRequest<ReadwiseBook>(`/books/${bookId}/`);
    this.setCache(cacheKey, response);
    return response;
  }

  /**
   * Search highlights by text
   */
  async searchHighlights(query: string): Promise<ReadwiseHighlight[]> {
    const cacheKey = `search:${query}`;
    const cached = this.getFromCache<ReadwiseHighlight[]>(cacheKey);
    if (cached) return cached;

    const response = await this.makeRequest<ReadwiseResponse<ReadwiseHighlight>>(
      '/highlights/',
      { search: query }
    );

    this.setCache(cacheKey, response.results);
    return response.results;
  }

  /**
   * Get recent highlights (updated after a specific date)
   */
  async getRecentHighlights(sinceDate: string): Promise<ReadwiseResponse<ReadwiseHighlight>> {
    return this.getHighlights({ updated__gt: sinceDate });
  }

  /**
   * Get all highlights (handles pagination automatically)
   */
  async getAllHighlights(): Promise<ReadwiseHighlight[]> {
    const allHighlights: ReadwiseHighlight[] = [];
    let nextCursor: string | null = null;

    do {
      const response = await this.getHighlights({
        page_size: 1000,
        ...(nextCursor && { page_cursor: nextCursor })
      });
      
      allHighlights.push(...response.results);
      nextCursor = response.next;
    } while (nextCursor);

    return allHighlights;
  }

  /**
   * Get all books (handles pagination automatically)
   */
  async getAllBooks(): Promise<ReadwiseBook[]> {
    const allBooks: ReadwiseBook[] = [];
    let nextCursor: string | null = null;

    do {
      const response = await this.getBooks({
        page_size: 1000,
        ...(nextCursor && { page_cursor: nextCursor })
      });
      
      allBooks.push(...response.results);
      nextCursor = response.next;
    } while (nextCursor);

    return allBooks;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Make a request to the Readwise API with error handling and retries
   */
  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY
    } = options;

    // Rate limiting
    await this.enforceRateLimit();

    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Token ${this.token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Readwise API error: ${response.status} ${response.statusText} - ${errorData.detail || errorData.message || 'Unknown error'}`
          );
        }

        const data = await response.json();
        this.logRequest('success', endpoint, response.status);
        return data as T;

      } catch (error) {
        lastError = error as Error;
        this.logRequest('error', endpoint, 0, error as Error);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }

        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Enforce rate limiting (1 request per second)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await this.sleep(delay);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get data from cache if it exists and is not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.logCache('miss', key);
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      this.logCache('expired', key);
      return null;
    }

    this.logCache('hit', key);
    return entry.data;
  }

  /**
   * Set data in cache
   */
  private setCache<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    };
    
    this.cache.set(key, entry);
    this.logCache('set', key);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log request information
   */
  private logRequest(type: 'success' | 'error', endpoint: string, status: number, error?: Error): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      type,
      endpoint,
      status,
      error: error?.message
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ReadwiseClient] ${JSON.stringify(logData)}`);
    }
  }

  /**
   * Log cache operations
   */
  private logCache(operation: 'hit' | 'miss' | 'set' | 'expired', key: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ReadwiseClient Cache] ${operation}: ${key}`);
    }
  }
}

export default ReadwiseClient;
