/**
 * Pure math for dashboard price series — extracted from the snapshot route so the
 * calculations are testable without network or Redis (scripts/dashboard-math-gate.ts).
 *
 * WHY THIS EXISTS (2026-07-27): the dashboard shipped IWF 1Y = −73% (real: +6%) and
 * SMH 1Y = +95% (real: +88%). Root causes, confirmed against ground truth:
 *   1. SPLITS — Redis price history stored RAW closes; IWF split 4:1 on 2026-04-29, so
 *      the year-ago baseline was a pre-split $434 against a post-split $116 live price.
 *      The 50D/200D/200W MAs silently blended both scales.
 *   2. GAPS — the calendar lookback takes the closest trading day ≤ target; a hole in
 *      history around the target let SMH's 1Y baseline land weeks early (275.7 ≈ mid-June
 *      2025 instead of late-July 2025), overstating 1Y by ~7pp.
 *   3. DIVIDENDS — raw closes drift ~1-3pp/yr vs the adjusted series every other source
 *      quotes (IGV, XLE class).
 * The fixes: changes are computed from Yahoo's own ADJUSTED, gap-free 1y series
 * (snapshot route), history is seeded from adjclose (seed-prices.mjs), and the
 * tripwires below refuse to publish a number across an unexplained cliff or a stale
 * baseline. Every rule here ships with a mechanical check in dashboard-math-gate.ts.
 */

// Change period definitions:
//   tradingDays = count back N entries in the asset's own date array (skips weekends/holidays)
//   months/years = calendar offset (March 27 → Feb 27, March 27 → March 27 last year)
// This matches Yahoo Finance: 1D and 5D are trading days, 1M and 1Y are calendar.
export const CHANGE_PERIODS: Record<string, { tradingDays?: number; days?: number; months?: number; years?: number }> = {
  '1D': { tradingDays: 1 },
  '5D': { days: 7 },
  '1M': { months: 1 },
  '1Y': { years: 1 },
};

// MA periods in trading days (industry standard)
export const MA_PERIODS: Record<string, number> = { '50D': 50, '200D': 200, '200W': 1000 };

export interface PriceSeries {
  dates: string[];   // YYYY-MM-DD, ascending
  prices: number[];  // same length as dates
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/** Index of the baseline entry for a period, or -1. Exported so the gate can test the
 *  calendar lookup (incl. gap behavior) directly. */
export function findBaselineIndex(
  dates: string[],
  latestIdx: number,
  period: { tradingDays?: number; days?: number; months?: number; years?: number },
): number {
  if (period.tradingDays) return latestIdx - period.tradingDays;

  const dateStr = dates[latestIdx];
  if (!dateStr) return -1;
  const parts = dateStr.split('-').map(Number);
  let ty = parts[0]!, tm = parts[1]!, td = parts[2]!;
  if (period.years) ty -= period.years;
  if (period.months) {
    tm -= period.months;
    if (tm < 1) { ty -= 1; tm += 12; }
  }
  if (period.days) td -= period.days;
  const maxDay = new Date(ty, tm, 0).getDate();
  if (td > maxDay) td = maxDay;
  const targetStr = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;

  let lo = 0, hi = latestIdx - 1, bestIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid]! <= targetStr) {
      bestIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return bestIdx;
}

/** Calendar target date string for a period relative to the latest date (for gap checks). */
export function targetDateFor(
  latestDate: string,
  period: { days?: number; months?: number; years?: number },
): string {
  const parts = latestDate.split('-').map(Number);
  let ty = parts[0]!, tm = parts[1]!, td = parts[2]!;
  if (period.years) ty -= period.years;
  if (period.months) {
    tm -= period.months;
    if (tm < 1) { ty -= 1; tm += 12; }
  }
  if (period.days) td -= period.days;
  const maxDay = new Date(ty, tm, 0).getDate();
  if (td > maxDay) td = maxDay;
  return `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const toUTC = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round(Math.abs(toUTC(a) - toUTC(b)) / 86_400_000);
}

export interface ChangeResult {
  changes: Record<string, number>;
  /** Labels whose baseline landed suspiciously far before the calendar target (a history
   *  gap — the SMH +95-vs-+88 class). The caller should not publish these. */
  staleBaselines: string[];
}

/** Max calendar days a 1M/1Y baseline may precede its target before it is a gap artifact.
 *  Real markets never close for more than ~5 consecutive days; 10 is generous. */
export const MAX_BASELINE_GAP_DAYS = 10;

export function calculateChangesChecked(dates: string[], prices: number[]): ChangeResult {
  const out: ChangeResult = { changes: {}, staleBaselines: [] };
  if (!dates || !prices || prices.length < 2) return out;

  const latestIdx = prices.length - 1;
  const latest = prices[latestIdx]!;

  for (const [label, period] of Object.entries(CHANGE_PERIODS)) {
    let bestIdx = findBaselineIndex(dates, latestIdx, period);

    // WINDOW-EDGE RULE (2026-07-28, found live by Cursor): when the fetch window starts at
    // "now − range" but the latest EQUITY bar is the prior close, the calendar target can
    // fall 1-3 days BEFORE the first bar (Tue 6 AM: latest = Mon 07-27, 1Y target = Sun
    // 2025-07-27, first bar = Mon 2025-07-28) → no bar ≤ target → 1Y silently vanished.
    // The honest baseline is the EARLIEST bar when it sits within the same tolerance we
    // apply on the other side — Yahoo's own 1y % uses exactly that bar. Beyond the
    // tolerance the horizon is omitted, never fabricated.
    if (!period.tradingDays && bestIdx < 0 && dates.length > 0) {
      const target = targetDateFor(dates[latestIdx]!, period);
      if (dates[0]! > target && daysBetween(dates[0]!, target) <= MAX_BASELINE_GAP_DAYS) {
        bestIdx = 0;
      }
    }

    if (bestIdx < 0 || prices[bestIdx] == null || prices[bestIdx]! <= 0) continue;

    // Gap tripwire for calendar periods: a baseline weeks before its target is a hole in
    // the data, and the % computed across it is wrong.
    if (!period.tradingDays) {
      const target = targetDateFor(dates[latestIdx]!, period);
      const gap = daysBetween(dates[bestIdx]!, target);
      if (dates[bestIdx]! < target && gap > MAX_BASELINE_GAP_DAYS) {
        out.staleBaselines.push(label);
        continue;
      }
    }

    out.changes[label] = round(((latest - prices[bestIdx]!) / prices[bestIdx]!) * 100, 2);
  }

  return out;
}

/** Back-compat wrapper (history-array path). */
export function calculateChanges(dates: string[], prices: number[]): Record<string, number> {
  return calculateChangesChecked(dates, prices).changes;
}

export function calculateMAs(prices: number[]): Record<string, number> {
  if (!prices || prices.length < 50) return {};
  const mas: Record<string, number> = {};
  for (const [label, period] of Object.entries(MA_PERIODS)) {
    if (prices.length >= period) {
      const slice = prices.slice(-period);
      const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
      mas[label] = round(avg, 2);
    } else if (prices.length >= Math.floor(period * 0.8)) {
      const avg = prices.reduce((sum, v) => sum + v, 0) / prices.length;
      mas[label] = round(avg, 2);
    }
  }
  return mas;
}

export interface ScaleBreak { index: number; date: string; ratio: number }

/** Detect unexplained cliffs in a price series — adjacent closes whose ratio exceeds the
 *  threshold. A real asset does not halve or double overnight without a split/rebase; an
 *  ADJUSTED series never shows one at all. Any hit means the series mixes scales (the IWF
 *  4:1 class) and every stat computed across it is garbage. */
export function detectScaleBreaks(series: PriceSeries, maxJumpRatio = 1.5): ScaleBreak[] {
  const breaks: ScaleBreak[] = [];
  for (let i = 1; i < series.prices.length; i++) {
    const a = series.prices[i - 1];
    const b = series.prices[i];
    if (a == null || b == null || a <= 0 || b <= 0) continue;
    const ratio = b > a ? b / a : a / b;
    if (ratio > maxJumpRatio) {
      breaks.push({ index: i, date: series.dates[i] ?? '?', ratio: round(ratio, 3) });
    }
  }
  return breaks;
}

/** Build a {dates, prices} series from a Yahoo v8 chart result, preferring the ADJUSTED
 *  close (split + dividend adjusted — the convention every quoted % uses) and falling back
 *  to the raw close per bar. Dates are exchange-timezone trading dates. */
export function seriesFromYahooChart(
  result: {
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }>; adjclose?: Array<{ adjclose?: Array<number | null> }> };
    meta?: { exchangeTimezoneName?: string };
  },
  opts?: { crypto?: boolean },
): PriceSeries {
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const tz = opts?.crypto ? 'UTC' : result.meta?.exchangeTimezoneName || 'America/New_York';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

  const series: PriceSeries = { dates: [], prices: [] };
  for (let i = 0; i < timestamps.length; i++) {
    const price = adj?.[i] ?? closes[i];
    if (price == null || price <= 0) continue;
    const date = fmt.format(new Date(timestamps[i]! * 1000));
    // Collapse duplicate dates (intraday partial bars) — keep the latest value
    if (series.dates.length > 0 && series.dates[series.dates.length - 1] === date) {
      series.prices[series.prices.length - 1] = round(price, 4);
    } else {
      series.dates.push(date);
      series.prices.push(round(price, 4));
    }
  }
  return series;
}

/** Merge the live/latest quote into a daily series: replace today's bar or append. */
export function mergeLatestIntoSeries(series: PriceSeries, latestPrice: number, tradingDate: string | null): PriceSeries {
  if (!latestPrice || latestPrice <= 0 || !tradingDate) return series;
  const dates = [...series.dates];
  const prices = [...series.prices];
  if (dates.length > 0 && dates[dates.length - 1] === tradingDate) {
    prices[prices.length - 1] = latestPrice;
  } else if (dates.length === 0 || dates[dates.length - 1]! < tradingDate) {
    dates.push(tradingDate);
    prices.push(latestPrice);
  }
  return { dates, prices };
}
