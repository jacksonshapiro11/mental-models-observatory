/**
 * publish-date — single source of truth for "today's reading date".
 *
 * Brief files are named `content/daily-updates/YYYY-MM-DD-light.md` (and
 * `YYYY-MM-DD.md` for the full brief), dated for the READING date in
 * America/New_York. Every PUSH channel — email, X, and the podcast audio — must
 * target THIS date and SKIP if the file for it is missing. It must never fall
 * back to the newest file on disk.
 *
 * Why this exists: the old pattern `getBriefLightByDate(date) || getLatestBriefLight()`
 * (and `?date ? getByDate : getLatest`) made the whole system lag a day. When a
 * brief was missed, the cron and the email grabbed YESTERDAY's file and shipped
 * it as today's, then stayed one day behind until a fresh file appeared — and any
 * late backfill shifted the entire sequence. A missed day should be a clean GAP
 * (no email, no episode that morning), not a permanent lag.
 *
 * Manual backfill (an explicit `?date=` / `--date=`) is a deliberate human choice
 * and is always allowed — that path does not skip.
 */

/**
 * Today's reading date as `YYYY-MM-DD` in America/New_York — the exact string the
 * brief filename uses. `en-CA` renders ISO `YYYY-MM-DD`; using `Intl` directly
 * (no `new Date(localeString)` round-trip) avoids the server-timezone drift that
 * the older `toLocaleString → new Date → toISOString` helpers were exposed to.
 */
export function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/**
 * Resolve which brief date a push channel should act on.
 *
 *  - explicit `override` present → use it, `manual: true` (deliberate backfill —
 *    if the file is missing the caller should ERROR, because the human asked for
 *    a specific date that isn't there).
 *  - no override (the cron / automatic path) → today's reading date,
 *    `manual: false` (if the file is missing the caller should SKIP cleanly and
 *    never fall back to an older brief).
 */
export function resolvePublishDate(override?: string | null): { date: string; manual: boolean } {
  if (override && override.trim()) return { date: override.trim(), manual: true };
  return { date: todayET(), manual: false };
}

/**
 * Freshness regression-tripwire for the automatic path. Returns true when a brief
 * that the auto path is about to ship is NOT today's — which can only happen if a
 * stale "latest" fallback gets reintroduced. Manual backfills are exempt.
 */
export function isStaleForAutoPublish(briefDate: string, manual: boolean): boolean {
  return !manual && briefDate !== todayET();
}
