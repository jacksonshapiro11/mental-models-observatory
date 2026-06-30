/**
 * US equity market hours (Eastern Time) for dashboard cron guards and adaptive polling.
 * Crypto trades 24/7 but equity-driven refresh urgency follows the US session.
 */

export type MarketStatus = 'pre' | 'open' | 'after' | 'closed';

/** Parse wall-clock components in America/New_York without locale string round-trips. */
export function getETParts(now = new Date()): { year: number; month: number; day: number; dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function formatETDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
}

export function isWeekendET(now = new Date()): boolean {
  const { dayOfWeek } = getETParts(now);
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/** NYSE full-day closures (early-close days still run snapshot). */
const NYSE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

export function isUSMarketHoliday(now = new Date()): boolean {
  return NYSE_HOLIDAYS.has(formatETDate(now));
}

export function getMarketStatus(now = new Date()): MarketStatus {
  const { dayOfWeek, minutes } = getETParts(now);

  if (dayOfWeek === 0 || dayOfWeek === 6) return 'closed';
  if (isUSMarketHoliday(now)) return 'closed';

  // Pre-market 4:00 AM – 9:30 AM ET
  if (minutes >= 240 && minutes < 570) return 'pre';
  // Regular session 9:30 AM – 4:00 PM ET
  if (minutes >= 570 && minutes < 960) return 'open';
  // After-hours 4:00 PM – 8:00 PM ET
  if (minutes >= 960 && minutes < 1200) return 'after';
  return 'closed';
}

/** Client + server poll interval for /api/dashboard/live. */
export function getDashboardPollIntervalMs(status?: MarketStatus): number {
  switch (status ?? getMarketStatus()) {
    case 'open':
      return 60_000; // 1 min during regular session
    case 'pre':
    case 'after':
      return 20 * 60_000; // 20 min pre/after-hours
    case 'closed':
      return 45 * 60_000; // 45 min nights/weekends/holidays
  }
}

/** CDN s-maxage for /api/dashboard/live — longer off-hours, shared across readers. */
export function getLiveDashboardCacheSeconds(status?: MarketStatus): number {
  switch (status ?? getMarketStatus()) {
    case 'open':
      return 120; // 2 min during regular session
    case 'pre':
    case 'after':
      return 30 * 60; // 30 min pre/after-hours
    case 'closed':
      return 60 * 60; // 60 min nights/weekends/holidays
  }
}
