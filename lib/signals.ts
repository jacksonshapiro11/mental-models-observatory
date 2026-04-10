import { getLatestBrief } from '@/lib/daily-update-parser';

/**
 * Extract short signal lines from the latest brief's lede paragraph.
 * Splits on commas and "and" to create punchy terminal-style fragments.
 * Falls back to static signals if no brief is available.
 */
export function getLatestSignals(): string[] {
  const FALLBACK = [
    'markets moving on macro data',
    'geopolitical tension elevated',
    'AI infrastructure spending accelerates',
    'cross-domain signals forming',
  ];

  try {
    const brief = getLatestBrief();
    if (!brief?.lede) return FALLBACK;

    // The lede is typically one long sentence with commas separating key events
    // Split on ", and " first, then on ", " for remaining fragments
    const raw = brief.lede
      .replace(/\*\*/g, '') // strip markdown bold
      .replace(/\*/g, '')   // strip markdown italic
      .replace(/\[.*?\]\(.*?\)/g, (match: string): string => {
        // Extract link text only
        const text = match.match(/\[(.*?)\]/);
        return text && text[1] ? text[1] : '';
      });

    // Split into clauses
    let clauses = raw
      .split(/,\s*and\s+|,\s+and\s+/)
      .flatMap(c => c.split(/,\s+(?=[A-Z])/))
      .map(c => c.trim())
      .filter(c => c.length > 10 && c.length < 120);

    // Lowercase the first letter for terminal aesthetic, truncate if too long
    clauses = clauses.map(c => {
      const truncated = c.length > 80 ? c.slice(0, 77) + '...' : c;
      return truncated.charAt(0).toLowerCase() + truncated.slice(1);
    });

    // Cap at 5 signals
    return clauses.slice(0, 5).length > 0 ? clauses.slice(0, 5) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
