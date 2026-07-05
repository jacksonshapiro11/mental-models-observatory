/**
 * Redis / podcast episode keys for daily and weekly brief audio.
 *
 * Daily full/light episodes use YYYY-MM-DD. Weekly episodes use
 * weekly-{slug} and weekly-light-{slug} where slug is e.g. 2026-W27.
 */

const DAILY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKLY_SLUG_RE = /^\d{4}-W\d{1,2}$/i;
const WEEKLY_FULL_KEY_RE = /^weekly-\d{4}-W\d{1,2}$/i;
const WEEKLY_LIGHT_KEY_RE = /^weekly-light-\d{4}-W\d{1,2}$/i;

export function isWeeklySlug(value: string): boolean {
  return WEEKLY_SLUG_RE.test(value);
}

export function weeklyFullEpisodeKey(slug: string): string {
  return `weekly-${slug}`;
}

export function weeklyLightEpisodeKey(slug: string): string {
  return `weekly-light-${slug}`;
}

/** Normalize a URL param or brief.date into a full-brief Redis episode key. */
export function resolveFullEpisodeKey(value: string): string | null {
  if (DAILY_DATE_RE.test(value)) return value;
  if (WEEKLY_FULL_KEY_RE.test(value)) return value;
  if (WEEKLY_SLUG_RE.test(value)) return weeklyFullEpisodeKey(value);
  return null;
}

/** Normalize a URL param or brief.date into a light-brief Redis episode key. */
export function resolveLightEpisodeKey(value: string): string | null {
  if (DAILY_DATE_RE.test(value)) return value;
  if (WEEKLY_LIGHT_KEY_RE.test(value)) return value;
  if (WEEKLY_SLUG_RE.test(value)) return weeklyLightEpisodeKey(value);
  return null;
}
