/**
 * weekly-window — is The Weekly the site's current front-page product?
 *
 * On zoom-out Sundays the daily is HELD and the Weekly publishes instead
 * (system/Pipeline_Controller.md → "ZOOM-OUT DAY"). From the Weekly's Sunday
 * until a NEWER daily publishes, /daily-update and /super-brief should surface
 * the Weekly — not Saturday's daily. The moment Monday's daily lands, the daily
 * wins again automatically. No flags, no cron: pure comparison of what's on disk.
 *
 * Fail-safe preserved: if the weekly publish failed and the held daily was
 * force-published dated the same Sunday, the daily wins (dailyDate >= sunday),
 * matching the Controller's "site is never empty" rule.
 */

import { getAllBriefDates, getAllWeeklySlugs } from './daily-update-parser';
import { getLatestBriefLight } from './brief-light-parser';
import { getAllWeeklyLightSlugs } from './weekly-light-parser';
import { todayET } from './publish-date';

/** Sunday (last day) of an ISO week id like "2026-W27" → "2026-07-05". */
export function isoWeekSunday(weekId: string): string | null {
  const m = /^(\d{4})-W(\d{1,2})$/i.exec(weekId.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;

  // ISO 8601: Jan 4 is always in week 1; weeks run Mon–Sun.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const isoWeekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const sunday = new Date(jan4);
  sunday.setUTCDate(jan4.getUTCDate() - (isoWeekday - 1) + (week - 1) * 7 + 6);
  return sunday.toISOString().slice(0, 10);
}

/**
 * Weekly wins iff its Sunday has arrived (ET) and no daily is dated on/after it.
 */
function weeklyIsCurrent(weeklySunday: string | null, latestDailyDate: string | null): boolean {
  if (!weeklySunday) return false;
  if (weeklySunday > todayET()) return false;
  if (latestDailyDate && latestDailyDate >= weeklySunday) return false;
  return true;
}

/** Week id /daily-update should show instead of the latest daily, or null. */
export function currentWeeklyFullSlug(): string | null {
  const slug = getAllWeeklySlugs()[0];
  if (!slug) return null;
  const latestDaily = getAllBriefDates()[0] ?? null;
  return weeklyIsCurrent(isoWeekSunday(slug), latestDaily) ? slug : null;
}

/** Week id /super-brief should show instead of the latest daily light, or null. */
export function currentWeeklyLightSlug(): string | null {
  const slug = getAllWeeklyLightSlugs()[0];
  if (!slug) return null;
  const latestLight = getLatestBriefLight();
  return weeklyIsCurrent(isoWeekSunday(slug), latestLight?.date ?? null) ? slug : null;
}
