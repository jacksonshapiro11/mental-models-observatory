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

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASS' : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
