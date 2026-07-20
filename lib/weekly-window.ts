/**
 * weekly-window — is The Weekly the site's current front-page product?
 *
 * On zoom-out Sundays the daily is HELD and the Weekly publishes instead
 * (system/Pipeline_Controller.md → "ZOOM-OUT DAY"). From the Weekly's Sunday
 * until a NEWER daily publishes, /daily-update and /super-brief should surface
 * the Weekly — not Saturday's daily. The moment Monday's daily lands, the daily
 * wins again automatically. No flags, no cron: pure comparison of what's on disk.
 *
 * Same-day daily does NOT suppress the Weekly (W29 2026-07-19: zoom-out Sunday
 * daily shipped in the morning and hid The Weekly all day via `>=`). Prefer the
 * Weekly when it exists for that Sunday. If the Weekly is missing entirely, this
 * helper returns false and the normal latest-daily path fills the site ("never
 * empty").
 */

import { getAllBriefDates, getAllWeeklySlugs } from './daily-update-parser';
import { getLatestBriefLight } from './brief-light-parser';
import { getAllWeeklyLightSlugs } from './weekly-light-parser';
import { todayET } from './publish-date';
import { isoWeekSunday } from './brief-date';

/** Re-export — calendar math lives in brief-date (audio intro + weekly window share it). */
export { isoWeekSunday };

/**
 * Weekly wins iff its Sunday has arrived (ET) and no NEWER daily has published.
 * A daily dated the same Sunday does not win — zoom-out day prefers The Weekly.
 */
export function weeklyIsCurrent(
  weeklySunday: string | null,
  latestDailyDate: string | null,
  today: string = todayET(),
): boolean {
  if (!weeklySunday) return false;
  if (weeklySunday > today) return false;
  if (latestDailyDate && latestDailyDate > weeklySunday) return false;
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
