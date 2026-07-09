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
  displayDate: string,
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
  displayDate: string,
): void {
  const result = auditAudioIntro(fullScript, dateSlug, displayDate);
  if (!result.ok) {
    throw new Error(`Audio intro date audit failed: ${result.errors.join(' | ')}`);
  }
}

export function formatAuditFailure(result: AudioIntroAuditResult): string {
  return result.errors.join(' | ');
}

export type { DateValidationResult };
