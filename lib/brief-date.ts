/**
 * Shared date parsing/formatting for brief headers and audio intro gates.
 */

const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const DISPLAY_DATE_RE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/;

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Whether a header line is a human display date (bold or ##), not a title/section. */
export function isDisplayDateLine(line: string): boolean {
  const trimmed = line.trim();
  let inner = trimmed;
  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
    inner = trimmed.slice(2, -2).trim();
  } else if (trimmed.startsWith('## ')) {
    inner = trimmed.replace(/^##\s+/, '').trim();
  } else {
    return false;
  }
  if (inner.includes('▸')) return false;
  return DISPLAY_DATE_RE.test(inner);
}

/** Extract the display date string from a bold or ## date line. */
export function extractDisplayDateFromLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith('## ')) {
    return trimmed.replace(/^##\s+/, '').trim();
  }
  return trimmed;
}

/** Canonical display date from YYYY-MM-DD slug (matches OG route). */
export function formatDisplayDateFromSlug(dateSlug: string): string {
  const d = new Date(`${dateSlug}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface SlugDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: string;
  monthName: string;
}

export function parseSlugDate(dateSlug: string): SlugDateParts {
  const d = new Date(`${dateSlug}T12:00:00`);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    monthName: d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }),
  };
}

function dayToSpokenOrdinal(day: number): string {
  const spoken: Record<number, string> = {
    1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
    6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
    11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth',
    16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
    21: 'twenty-first', 22: 'twenty-second', 23: 'twenty-third', 24: 'twenty-fourth',
    25: 'twenty-fifth', 26: 'twenty-sixth', 27: 'twenty-seventh', 28: 'twenty-eighth',
    29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first',
  };
  return spoken[day] ?? String(day);
}

function twoDigitToSpoken(n: number): string {
  if (n < 20) return ONES[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return TENS[tens]!;
  return `${TENS[tens]}-${ONES[ones]}`;
}

function yearToSpoken(year: number): string {
  if (year >= 2000 && year < 2010) {
    const last = year % 10;
    return last === 0 ? 'two thousand' : `two thousand ${ONES[last]}`;
  }
  if (year >= 2010 && year < 2100) {
    const lastTwo = year % 100;
    if (lastTwo === 0) return 'two thousand';
    return `twenty ${twoDigitToSpoken(lastTwo)}`;
  }
  return String(year);
}

/** TTS-friendly spoken date, e.g. "Tuesday, July seventh, twenty twenty-six". */
export function formatSpokenDateFromSlug(dateSlug: string): string {
  const parts = parseSlugDate(dateSlug);
  return `${parts.weekday}, ${parts.monthName} ${dayToSpokenOrdinal(parts.day)}, ${yearToSpoken(parts.year)}`;
}

export function parseDisplayDate(displayDate: string): SlugDateParts | null {
  const m = displayDate.trim().match(DISPLAY_DATE_RE);
  if (!m) return null;
  const monthIdx = MONTHS.indexOf(m[2] as typeof MONTHS[number]);
  if (monthIdx === -1) return null;
  return {
    weekday: m[1]!,
    monthName: m[2]!,
    month: monthIdx + 1,
    day: parseInt(m[3]!, 10),
    year: parseInt(m[4]!, 10),
  };
}

export function displayDateLooksLikeHeadline(displayDate: string): boolean {
  if (!displayDate.trim()) return true;
  if (!WEEKDAYS.some((w) => displayDate.startsWith(w))) return true;
  return !DISPLAY_DATE_RE.test(displayDate.trim());
}

export interface DateValidationResult {
  ok: boolean;
  message?: string;
}

/** Assert parsed displayDate matches the filename slug (weekday + calendar date). */
export function validateDisplayDateMatchesSlug(
  displayDate: string,
  dateSlug: string,
): DateValidationResult {
  if (displayDateLooksLikeHeadline(displayDate)) {
    return {
      ok: false,
      message: `displayDate "${displayDate.slice(0, 80)}" looks like a headline, not a calendar date (expected weekday + month + day + year matching ${dateSlug}).`,
    };
  }

  const parsed = parseDisplayDate(displayDate);
  const expected = parseSlugDate(dateSlug);
  if (!parsed) {
    return {
      ok: false,
      message: `displayDate "${displayDate}" is not a valid "Weekday, Month D, YYYY" date line.`,
    };
  }

  if (parsed.year !== expected.year || parsed.month !== expected.month || parsed.day !== expected.day) {
    return {
      ok: false,
      message: `displayDate "${displayDate}" does not match brief slug ${dateSlug} (expected ${formatDisplayDateFromSlug(dateSlug)}).`,
    };
  }

  if (parsed.weekday !== expected.weekday) {
    return {
      ok: false,
      message: `displayDate weekday "${parsed.weekday}" does not match slug ${dateSlug} (${expected.weekday}).`,
    };
  }

  return { ok: true };
}

const MONTH_NAME_TO_NUM: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m.toLowerCase(), i + 1]),
);

const SPOKEN_ONES: Record<string, number> = Object.fromEntries(ONES.map((w, i) => [w, i]));
const SPOKEN_TENS: Record<string, number> = Object.fromEntries(
  TENS.map((w, i) => [w, i * 10]).filter(([w]) => w),
);

const SPOKEN_ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, 'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23,
  'twenty-fourth': 24, 'twenty-fifth': 25, 'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28,
  'twenty-ninth': 29, thirtieth: 30, 'thirty-first': 31,
};

function parseSpokenTwoDigits(text: string): number | null {
  const t = text.trim().replace(/-/g, ' ');
  if (!t) return null;
  const compact = t.replace(/\s+/g, '-');
  if (SPOKEN_ORDINALS[compact] !== undefined) return SPOKEN_ORDINALS[compact]!;
  const parts = t.split(/\s+/);
  if (parts.length === 1) {
    const teen = SPOKEN_ONES[parts[0]!];
    if (teen !== undefined && teen >= 10 && teen <= 19) return teen;
    const tensVal = SPOKEN_TENS[parts[0]!];
    if (tensVal !== undefined) return tensVal;
  }
  if (parts.length === 2) {
    const tensVal = SPOKEN_TENS[parts[0]!];
    const onesVal = SPOKEN_ONES[parts[1]!];
    if (tensVal !== undefined && onesVal !== undefined) return tensVal + onesVal;
  }
  return null;
}

function parseSpokenYear(text: string): number | null {
  const lower = text.toLowerCase().trim().replace(/-/g, ' ');
  const digits = lower.match(/\b(20\d{2})\b/);
  if (digits) return parseInt(digits[1]!, 10);

  const m2000 = lower.match(/^two thousand(?:\s+(\w+))?$/);
  if (m2000) {
    if (!m2000[1]) return 2000;
    const n = SPOKEN_ONES[m2000[1]!];
    if (n !== undefined) return 2000 + n;
  }

  if (lower.startsWith('twenty ')) {
    const lastTwo = parseSpokenTwoDigits(lower.slice('twenty '.length));
    if (lastTwo !== null) return 2000 + lastTwo;
  }

  const lastTwoOnly = parseSpokenTwoDigits(lower);
  if (lastTwoOnly !== null && lastTwoOnly >= 10) return 2000 + lastTwoOnly;

  return null;
}

export interface ExtractedIntroDate {
  month: number;
  day: number;
  year: number;
}

/** Extract calendar dates mentioned in intro script text (numeric + spoken forms). */
export function extractDatesFromIntroText(text: string): ExtractedIntroDate[] {
  const found: ExtractedIntroDate[] = [];
  const lower = text.toLowerCase();

  // Numeric: "July 7, 2026" / "July 7th, 2026"
  const numericRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,|\s)+(?:\s*(20\d{2}|(?:twenty|thirty)[\w\s-]+|two thousand \w+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = numericRe.exec(lower)) !== null) {
    const month = MONTH_NAME_TO_NUM[m[1]!];
    const day = parseInt(m[2]!, 10);
    let year = m[3] ? parseSpokenYear(m[3]) : null;
    if (m[3] && year === null && /^20\d{2}$/.test(m[3])) year = parseInt(m[3], 10);
    if (month && day) found.push({ month, day, year: year ?? 0 });
  }

  // Spoken ordinal day: "july seventh, twenty twenty-six"
  const spokenRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+((?:twenty-|thirty-)?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty-first|twenty-second|twenty-third|twenty-fourth|twenty-fifth|twenty-sixth|twenty-seventh|twenty-eighth|twenty-ninth|thirtieth|thirty-first))(?:,|\s)+((?:twenty|thirty)[\w\s-]+|two thousand \w+|20\d{2})/gi;
  while ((m = spokenRe.exec(lower)) !== null) {
    const month = MONTH_NAME_TO_NUM[m[1]!];
    const day = SPOKEN_ORDINALS[m[2]!];
    const year = parseSpokenYear(m[3]!);
    if (month && day && year) found.push({ month, day, year });
  }

  return found;
}

/** Validate intro script mentions the correct brief date (blocking gate). */
export function validateIntroDate(introScript: string, dateSlug: string): DateValidationResult {
  const expected = parseSlugDate(dateSlug);
  const intro = introScript.slice(0, 1200);
  const dates = extractDatesFromIntroText(intro);

  const matching = dates.filter(
    (d) => d.month === expected.month && d.day === expected.day && d.year === expected.year,
  );
  if (matching.length > 0) return { ok: true };

  const wrongYear = dates.filter(
    (d) => d.year > 0 && d.year !== expected.year && d.month === expected.month && d.day === expected.day,
  );
  if (wrongYear.length > 0) {
    return {
      ok: false,
      message: `Intro mentions ${MONTHS[expected.month - 1]} ${expected.day}, ${wrongYear[0]!.year} but brief slug is ${dateSlug} (${expected.year}).`,
    };
  }

  if (dates.length === 0) {
    return {
      ok: false,
      message: `Intro script missing a recognizable date for ${formatDisplayDateFromSlug(dateSlug)} (first 1200 chars audited).`,
    };
  }

  return {
    ok: false,
    message: `Intro date(s) [${dates.map((d) => `${MONTHS[d.month - 1]} ${d.day}, ${d.year || '?'}`).join('; ')}] do not match brief slug ${dateSlug}.`,
  };
}

/** Extract the intro portion from a full stitched script (before first section pause/transition). */
export function extractIntroFromFullScript(fullScript: string): string {
  const pauseIdx = fullScript.indexOf('\n\n...\n\n');
  const chunk = pauseIdx === -1 ? fullScript.slice(0, 1500) : fullScript.slice(0, pauseIdx);
  // Trim at first major section transition if present
  const transitionMarkers = [
    "OK, let's get started with today's brief",
    "OK, let's jump into the week's Six",
    "Let's start with the Overnight",
  ];
  let end = chunk.length;
  for (const marker of transitionMarkers) {
    const idx = chunk.indexOf(marker);
    if (idx !== -1 && idx < end) end = idx;
  }
  return chunk.slice(0, end);
}

export function buildDeterministicIntroPrefix(dateSlug: string, dailyTitle?: string): string {
  const spokenDate = formatSpokenDateFromSlug(dateSlug);
  const titlePart = dailyTitle?.trim() ? ` Today's episode: ${dailyTitle.trim()}.` : '';
  return `Welcome to Markets, Meditations, and Mental Models. It's ${spokenDate}.${titlePart}`;
}

/** Resolve displayDate from parser output with slug fallback. */
export function resolveDisplayDate(displayDate: string, dateSlug: string): string {
  const check = validateDisplayDateMatchesSlug(displayDate, dateSlug);
  if (check.ok) return displayDate.trim();
  return formatDisplayDateFromSlug(dateSlug);
}
