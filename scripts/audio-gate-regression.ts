/**
 * audio-gate-regression — proves the 2026-07-05 audio fixes against the EXACT
 * failure strings pulled from the shipped W27 and 2026-07-04 scripts
 * (blob: audio/weekly-2026-W27.txt, audio/daily-brief-2026-07-04.txt).
 *
 * Run: npx tsx scripts/audio-gate-regression.ts
 * Exits non-zero on any failure — wire into any pre-deploy check as needed.
 *
 * What this verifies (deterministic layer):
 *   1. collapseDoubledWords fixes the artifacts that shipped ("the the E.C.B.",
 *      "crude crude", "a the Bank of Japan") without touching legit doubles.
 *   2. lookupSection resolves the header drift that silently killed the Wild Card
 *      transition in BOTH products ("## The Wild Card" vs map key "Wild Card").
 *   3. Weekly transition overrides + sign-offs are weekly-flavored (no "today's
 *      brief" / "back tomorrow" on a Sunday weekly).
 *   4. enforceScriptRules strips the banned lead + filler-moral ending that
 *      shipped in the W27 light, and trips the substance floor on gutted output.
 *
 * What this cannot verify: the GPT-4o scriptwriter's prose quality. That layer is
 * BOUNDED by the gate (strip/warn/regenerate), not proven — judge it on the next
 * generated episode.
 */

import {
  collapseDoubledWords,
  canonicalSectionKey,
  lookupSection,
  enforceScriptRules,
  SECTION_TRANSITIONS,
  WEEKLY_TRANSITION_OVERRIDES,
  DAILY_SIGN_OFF,
  WEEKLY_SIGN_OFF,
} from '../lib/audio/text-preprocessor';
import {
  buildDeterministicIntroPrefix,
  buildDeterministicLightIntroPrefix,
  calendarDateFromSlug,
  formatDisplayDateFromSlug,
  formatSpokenDateFromSlug,
  isoWeekSunday,
  resolveDisplayDate,
  validateIntroDate,
  validateDisplayDateMatchesSlug,
  assertAudibleYearIntact,
} from '../lib/brief-date';
import { auditAudioIntro } from '../lib/audio/audio-intro-gate';
import { _test as preprocessorTest } from '../lib/audio/text-preprocessor';

const { regexNormalize } = preprocessorTest;

let failures = 0;
function check(name: string, actual: unknown, predicate: (a: unknown) => boolean, detail?: string) {
  const ok = predicate(actual);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got: ${JSON.stringify(actual)}${detail ? `\n      want: ${detail}` : ''}`}`);
  if (!ok) failures++;
}

console.log('── 1. Doubled words / article collisions (verbatim from shipped scripts) ──');

check(
  'W27 full: "at the the E.C.B.\'s Sintra forum"',
  collapseDoubledWords('as the new Fed chair downplayed forward guidance at the the E.C.B.’s Sintra forum'),
  a => a === 'as the new Fed chair downplayed forward guidance at the E.C.B.’s Sintra forum',
);
check(
  'W27 light: "WTI crude crude oil eased"',
  collapseDoubledWords('Meanwhile, WTI crude crude oil eased from 70 dollars toward 68'),
  a => a === 'Meanwhile, WTI crude oil eased from 70 dollars toward 68',
);
check(
  'W27 full: "a the Bank of Japan hike" (expansion of "a BOJ hike")',
  collapseDoubledWords('We thought a the Bank of Japan hike would strengthen the yen'),
  a => a === 'We thought the Bank of Japan hike would strengthen the yen',
);
check(
  'W27 light: "the the Bank of Japan-yen pair"',
  collapseDoubledWords('On the other hand, the the Bank of Japan-yen pair was a miss'),
  a => a === 'On the other hand, the Bank of Japan-yen pair was a miss',
);
check(
  'negative control: legit "had had" preserved',
  collapseDoubledWords('If we had had the data sooner, the call changes'),
  a => a === 'If we had had the data sooner, the call changes',
);
check(
  'negative control: clean sentence untouched',
  collapseDoubledWords('The ten-year yield ran 4.39 to 4.47 and back.'),
  a => a === 'The ten-year yield ran 4.39 to 4.47 and back.',
);
check(
  'Jul 8 audible-year: "twenty twenty-six" must NOT collapse to "twenty-six"',
  collapseDoubledWords('It\'s Wednesday, July eighth, twenty twenty-six.'),
  a => a === 'It\'s Wednesday, July eighth, twenty twenty-six.',
);
check(
  'Jul 8 audible-year: full deterministic prefix survives collapse',
  collapseDoubledWords(buildDeterministicIntroPrefix('2026-07-08', 'Test Title')),
  a => {
    const s = a as string;
    // Must keep the century form; reject decade-only mangling ("..., twenty-six.")
    return s.includes('twenty twenty-six') && !/,\s*twenty-six\./.test(s);
  },
);
check(
  'year double still collapses when NOT a hyphenated decade (the the stays fixed)',
  collapseDoubledWords('the the market'),
  a => a === 'the market',
);

console.log('── 2. Section-name drift (the silent Wild Card cold start) ──');

check(
  'canonical: "The Six: The Wild Card" === "The Six: Wild Card"',
  canonicalSectionKey('The Six: The Wild Card') === canonicalSectionKey('The Six: Wild Card'),
  a => a === true,
);
check(
  'transition resolves for the REAL W27/07-04 name "The Six: The Wild Card"',
  lookupSection(SECTION_TRANSITIONS, 'The Six: The Wild Card'),
  a => typeof a === 'string' && (a as string).includes('Wild Card'),
  'the Wild Cards transition string',
);
check(
  'transition still resolves for the original key form "The Six: Wild Card"',
  lookupSection(SECTION_TRANSITIONS, 'The Six: Wild Card'),
  a => typeof a === 'string' && (a as string).includes('Wild Card'),
);
check(
  'unknown section resolves to undefined (so the cold-start warning fires)',
  lookupSection(SECTION_TRANSITIONS, 'The Six: Completely New Section'),
  a => a === undefined,
);

console.log('── 3. Weekly framing (no daily voice on the Sunday product) ──');

check(
  'weekly override exists for Wild Card and says "week", not "today"',
  lookupSection(WEEKLY_TRANSITION_OVERRIDES, 'The Six: The Wild Card'),
  a => typeof a === 'string' && /week/i.test(a as string) && !/today/i.test(a as string),
);
check(
  'weekly override for Inner Game replaces "today\'s markets"',
  lookupSection(WEEKLY_TRANSITION_OVERRIDES, 'Inner Game'),
  a => typeof a === 'string' && !/today/i.test(a as string),
);
check(
  'WEEKLY_SIGN_OFF has no "today\'s brief" and no "back tomorrow with more"',
  WEEKLY_SIGN_OFF,
  a => !/today's brief/i.test(a as string) && !/back tomorrow with more/i.test(a as string),
);
check(
  'WEEKLY_SIGN_OFF opens with a bridge (never lands cold)',
  WEEKLY_SIGN_OFF,
  a => /^And that closes out the week\./.test(a as string),
);
check(
  'DAILY_SIGN_OFF unchanged (daily voice preserved)',
  DAILY_SIGN_OFF,
  a => /today's brief/i.test(a as string) && /back tomorrow/i.test(a as string),
);

console.log('── 4. Script gate: banned leads, filler endings, substance floor ──');

const w27LightLead =
  'Let’s dive into some fascinating stories from this week that are worth remembering. ' +
  'First up, Strategy’s stabilizer ran in reverse. Its preferred shares hit a record low around seventy-four fifty-seven.';
const leadResult = enforceScriptRules('Interesting Things', w27LightLead, '');
check(
  'W27 light banned lead (curly-apostrophe "Let’s dive into...") is stripped, content survives',
  leadResult.script,
  a => (a as string).startsWith('First up, Strategy') && !/dive into/i.test(a as string),
  'script starting at "First up, Strategy" with the lead sentence gone',
);

const w27LightEnding =
  'And the senior-housing shortage of 2028 locked itself in: starts fell to about one thousand seventy-six units. ' +
  'These stories highlight the complex and interconnected nature of today’s global landscape.';
const endingResult = enforceScriptRules('Interesting Things', w27LightEnding, '');
check(
  'W27 light filler-moral ending ("These stories highlight...") is stripped',
  endingResult.script,
  a => !(a as string).includes('These stories highlight') && (a as string).includes('senior-housing shortage'),
);

const genericIntroLead =
  'Here are some fascinating stories from this week worth remembering. ' +
  'First up, Strategy’s stabilizer ran in reverse.';
const introLeadResult = enforceScriptRules('Interesting Things', genericIntroLead, '');
check(
  'generic double-intro lead (not on the banned list) is stripped too',
  introLeadResult.script,
  a => (a as string).startsWith('First up, Strategy'),
  'script starting at "First up" — announce-y lead gone even without a banned phrase',
);

const guttedSource = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
const guttedScript = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
check(
  'substance floor trips on a gutted teaching section (The Model, 20% of source)',
  enforceScriptRules('The Model', guttedScript, guttedSource).needsRetry,
  a => a === true,
);
check(
  'substance floor does NOT trip on healthy compression (The Model, 70% of source)',
  enforceScriptRules('The Model', Array.from({ length: 210 }, (_, i) => `word${i}`).join(' '), guttedSource).needsRetry,
  a => a === false,
);
check(
  'banned phrase mid-body is warned, not silently ignored',
  enforceScriptRules('The Take', 'The setup matters here. But here’s where it gets interesting: the appeal.', ''),
  a => (a as { warnings: string[] }).warnings.some(w => w.includes('banned phrase')),
);

console.log('── 5. Intro date gate (July 7 displayDate/audio bug) ──');

check(
  'spoken date format for 2026-07-07',
  formatSpokenDateFromSlug('2026-07-07'),
  a => a === 'Tuesday, July seventh, twenty twenty-six',
);
check(
  'deterministic intro prefix includes spoken date + title',
  buildDeterministicIntroPrefix('2026-07-07', '4,800 Out, 6,000 In'),
  a => (a as string).includes('July seventh') && (a as string).includes('4,800 Out, 6,000 In'),
);
check(
  'validateIntroDate PASS on deterministic prefix + lede hook',
  validateIntroDate(
    `${buildDeterministicIntroPrefix('2026-07-07', '4,800 Out, 6,000 In')}\n\nNATO opens in Ankara with $140 billion pledged.`,
    '2026-07-07',
  ).ok,
  a => a === true,
);
check(
  'validateIntroDate FAIL on wrong year',
  validateIntroDate('Welcome. It is Tuesday, July seventh, twenty twenty-five.', '2026-07-07').ok,
  a => a === false,
);
check(
  'validateDisplayDateMatchesSlug rejects headline-as-date',
  validateDisplayDateMatchesSlug('4,800 Out, 6,000 In', '2026-07-07').ok,
  a => a === false,
);
check(
  'auditAudioIntro PASS on stitched intro sample',
  auditAudioIntro(
    `${buildDeterministicIntroPrefix('2026-07-07', '4,800 Out, 6,000 In')}\n\nHook lede here.\n\n...\n\nOK, let's get started with today's brief.`,
    '2026-07-07',
    'Tuesday, July 7, 2026',
  ).ok,
  a => a === true,
);

console.log('── 6. Audible year + light hard-inject (Jul 8 "July 8th 26" class) ──');

const jul8Prefix = buildDeterministicIntroPrefix('2026-07-08', 'Pipeline Fix');
const jul8Collapsed = collapseDoubledWords(jul8Prefix);
check(
  'assertAudibleYearIntact PASS when century phrase present',
  assertAudibleYearIntact(jul8Collapsed, '2026-07-08').ok,
  a => a === true,
);
check(
  'assertAudibleYearIntact FAIL on collapsed "twenty-six" (the old silent pass)',
  assertAudibleYearIntact(
    'Welcome. It\'s Wednesday, July eighth, twenty-six. Today\'s episode: Pipeline Fix.',
    '2026-07-08',
  ).ok,
  a => a === false,
);
check(
  'validateIntroDate FAIL on collapsed decade-only year (no longer parses as 2026)',
  validateIntroDate(
    'Welcome. It\'s Wednesday, July eighth, twenty-six.',
    '2026-07-08',
  ).ok,
  a => a === false,
);
check(
  'regexNormalize preserves twenty twenty-six through full normalize path',
  regexNormalize(jul8Prefix),
  a => (a as string).includes('twenty twenty-six'),
);
check(
  'light hard-inject prefix includes Super Brief + century year + title',
  buildDeterministicLightIntroPrefix('2026-07-08', 'Pipeline Fix'),
  a =>
    (a as string).includes('Welcome to the Super Brief') &&
    (a as string).includes('twenty twenty-six') &&
    (a as string).includes('Pipeline Fix'),
);
check(
  'auditAudioIntro FAIL on collapsed year even if month/day match',
  auditAudioIntro(
    'Welcome to Markets, Meditations, and Mental Models. It\'s Wednesday, July eighth, twenty-six.\n\nHook.\n\n...\n\nOK, let\'s get started with today\'s brief.',
    '2026-07-08',
    'Wednesday, July 8, 2026',
  ).ok,
  a => a === false,
);
check(
  'light-intro residual welcome/date stripped by enforceScriptRules',
  enforceScriptRules(
    'light-intro',
    'Welcome to the Super Brief. It\'s Wednesday, July eighth. NATO opens with a big pledge.',
    '',
  ).script,
  a => !(a as string).toLowerCase().includes('welcome') && !(a as string).toLowerCase().includes('wednesday'),
);

console.log('── 7. Weekly ISO week slugs (W28 Invalid Date class) ──');

const WEEK_CASES: { week: string; sunday: string; weekday: string }[] = [
  { week: '2026-W26', sunday: '2026-06-28', weekday: 'Sunday' },
  { week: '2026-W27', sunday: '2026-07-05', weekday: 'Sunday' },
  { week: '2026-W28', sunday: '2026-07-12', weekday: 'Sunday' },
];

for (const { week, sunday, weekday } of WEEK_CASES) {
  check(
    `${week} calendarDateFromSlug → Sunday ${sunday}`,
    calendarDateFromSlug(week),
    a => a === sunday,
  );
  check(
    `${week} isoWeekSunday matches`,
    isoWeekSunday(week),
    a => a === sunday,
  );
  const display = formatDisplayDateFromSlug(week);
  check(
    `${week} formatDisplayDateFromSlug is not Invalid Date`,
    display,
    a => typeof a === 'string' && !(a as string).includes('Invalid') && (a as string).startsWith(weekday),
    display,
  );
  check(
    `${week} spoken date has century year (no Invalid Date)`,
    formatSpokenDateFromSlug(week),
    a =>
      typeof a === 'string' &&
      !(a as string).includes('Invalid') &&
      (a as string).includes('twenty twenty-six') &&
      (a as string).toLowerCase().startsWith('sunday'),
  );
  const resolved = resolveDisplayDate('Week of July 5 to 11, 2026', week);
  check(
    `${week} resolveDisplayDate recovers from weekly headline header`,
    resolved,
    a => typeof a === 'string' && !(a as string).includes('Invalid') && validateDisplayDateMatchesSlug(a as string, week).ok,
  );
  const fullPrefix = buildDeterministicIntroPrefix(week, 'The Rent Moved Downstairs');
  const lightPrefix = buildDeterministicLightIntroPrefix(week, 'The Rent Moved Downstairs');
  check(
    `${week} full intro audit PASS (hard-inject + displayDate)`,
    auditAudioIntro(`${fullPrefix}\n\nHook.\n\n...\n\nOK, let's jump into the week's Six.`, week, resolved).ok,
    a => a === true,
  );
  check(
    `${week} light intro audit PASS (hard-inject + displayDate)`,
    auditAudioIntro(`${lightPrefix}\n\nHook.\n\n...\n\n`, week, resolved).ok,
    a => a === true,
  );
}

check(
  'daily YYYY-MM-DD still formats unchanged',
  formatDisplayDateFromSlug('2026-07-07'),
  a => a === 'Tuesday, July 7, 2026',
);

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASS' : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
