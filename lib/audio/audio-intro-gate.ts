/**
 * Blocking audio intro date audit — validates spoken date matches brief slug.
 */

import {
  assertAudibleYearIntact,
  extractIntroFromFullScript,
  validateDisplayDateMatchesSlug,
  validateIntroDate,
  type DateValidationResult,
} from '../brief-date';

export { validateIntroDate, extractIntroFromFullScript } from '../brief-date';

export interface AudioIntroAuditResult {
  ok: boolean;
  errors: string[];
}

/** Run intro date + displayDate + audible-year defense-in-depth checks before TTS. */
export function auditAudioIntro(
  fullScript: string,
  dateSlug: string,
  displayDate: string
): AudioIntroAuditResult {
  const errors: string[] = [];

  const displayCheck = validateDisplayDateMatchesSlug(displayDate, dateSlug);
  if (!displayCheck.ok && displayCheck.message) {
    errors.push(`displayDate: ${displayCheck.message}`);
  }

  const intro = extractIntroFromFullScript(fullScript);
  const introCheck = validateIntroDate(intro, dateSlug);
  if (!introCheck.ok && introCheck.message) {
    errors.push(`intro-date: ${introCheck.message}`);
  }

  // Catches the Jul 8 class: parser accepts "twenty-six" as 2026, but the ear hears
  // the wrong year. Require the full century phrase still present in the script.
  const audibleYear = assertAudibleYearIntact(fullScript, dateSlug);
  if (!audibleYear.ok && audibleYear.message) {
    errors.push(`audible-year: ${audibleYear.message}`);
  }

  return { ok: errors.length === 0, errors };
}

export function auditAudioIntroOrThrow(
  fullScript: string,
  dateSlug: string,
  displayDate: string
): void {
  const result = auditAudioIntro(fullScript, dateSlug, displayDate);
  if (!result.ok) {
    throw new Error(
      `Audio intro date audit failed: ${result.errors.join(' | ')}`
    );
  }
}

// ─── Outro audit ─────────────────────────────────────────────────────────────

/** Normalize for tail comparison: lowercase, alphanumeric words only — tolerant of the
 *  regex-normalize/pronunciation passes that run after stitching. */
function normalizeTail(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Blocking outro audit: the finished script must END with the deterministic sign-off.
 *  (2026-07-27: the W30 weekly light shipped ending on a GPT-invented goodbye — the written
 *  close was discarded upstream and nothing checked the tail, so the episode "just cut off".
 *  An episode that does not end with the house sign-off does not ship.) */
export function auditAudioOutro(
  fullScript: string,
  expectedSignOff: string
): AudioIntroAuditResult {
  const script = normalizeTail(fullScript);
  const expected = normalizeTail(expectedSignOff);
  const tail = expected.length > 80 ? expected.slice(-80) : expected;
  if (script.endsWith(tail)) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `outro: script does not end with the expected sign-off ("…${tail.slice(-50)}") — actual ending: "…${script.slice(-70)}"`,
    ],
  };
}

export function auditAudioOutroOrThrow(
  fullScript: string,
  expectedSignOff: string,
  label = 'audio'
): void {
  const result = auditAudioOutro(fullScript, expectedSignOff);
  if (!result.ok) {
    throw new Error(
      `[${label}] Audio outro audit failed: ${result.errors.join(' | ')}`
    );
  }
}

export function formatAuditFailure(result: AudioIntroAuditResult): string {
  return result.errors.join(' | ');
}

export type { DateValidationResult };
