// Performance optimization: Cache Readwise API responses
import { ReadwiseHighlight } from './readwise-highlights';

interface CachedHighlight {
  highlight: ReadwiseHighlight;
  timestamp: number;
}

// In-memory cache for Readwise API responses
const highlightCache = new Map<number, CachedHighlight>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 1000; // Prevent memory bloat

// Rate limiting for API calls
let lastApiCall = 0;
const MIN_API_INTERVAL = 100; // 100ms between calls

export async function getCachedHighlight(
  highlightId: number,
  fetchFunction: (id: number) => Promise<ReadwiseHighlight | null>
): Promise<ReadwiseHighlight | null> {
  // Check cache first
  const cached = highlightCache.get(highlightId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.highlight;
  }
  
  // Rate limiting - prevent too many API calls
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall));
  }
  
  try {
    // Fetch fresh data
    lastApiCall = Date.now();
    const highlight = await fetchFunction(highlightId);
    
    if (highlight) {
      // Clean cache if it's getting too large
      if (highlightCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest 20% of entries
        const entries = Array.from(highlightCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        for (let i = 0; i < toRemove; i++) {
          highlightCache.delete(entries[i][0]);
        }
      }
      
      // Cache the result
      highlightCache.set(highlightId, {
        highlight,
        timestamp: now
      });
    }
    
    return highlight;
  } catch (error) {
    console.error(`Error fetching highlight ${highlightId}:`, error);
    return null;
  }
}

// Clear cache (useful for development/debugging)
export function clearHighlightCache(): void {
  highlightCache.clear();
}

// Get cache stats (for monitoring)
export function getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
  return {
    size: highlightCache.size,
    maxSize: MAX_CACHE_SIZE
  };
}
