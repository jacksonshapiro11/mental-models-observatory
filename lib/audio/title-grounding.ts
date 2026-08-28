/**
 * title-grounding — every entity a GENERATED podcast episode title names must
 * appear in the brief it titles.
 *
 * WORKED FAILURE (2026-08-08, live in the public feed for ~24h): an Editor
 * validation block left in the brief header made `parseDailyBrief` return an
 * empty `dailyTitle` AND an empty `lede`. `lib/audio/full-generate.ts` fell
 * through to `rawMarkdown.slice(0, 500)` — the masthead plus the validation
 * block — and handed it to a gpt-4o prompt that instructs the model to "use
 * power words: Breaks, Hits, Crashes, Secret, Nobody Saw" and to "name the
 * company, asset, or event", at temperature 0.8. Given no story, it named one
 * anyway. The published episode was "Brief: Tesla's stock crashes after
 * shocking reveal"; `grep -ic tesla` on both `content/daily-updates/2026-08-08.md`
 * and `2026-08-08-light.md` returns 0.
 *
 * The header defect is fixed upstream (scripts/publish-brief.py strip + header
 * contract, scripts/published-header-gate.ts). This module is the floor UNDER
 * that fix: a generative title on a publish path needs its own grounding check,
 * because a model can invent an entity from a perfectly well-formed lede too.
 *
 * Lives in its own file so `scripts/title-grounding-gate.ts` can import it
 * without pulling in @vercel/blob, the OpenAI client and the TTS stack.
 */

/**
 * Words that may legitimately appear capitalised in a title without naming a
 * real-world entity: sentence-initial function words, plus the power verbs the
 * title prompt itself asks the model to use.
 */
export const TITLE_NON_ENTITY: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'breaks',
  'but',
  'by',
  'crashes',
  'did',
  'does',
  'explodes',
  'for',
  'from',
  'has',
  'have',
  'hits',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'nobody',
  'not',
  'now',
  'of',
  'on',
  'one',
  'or',
  'out',
  'over',
  'saw',
  'secret',
  'that',
  'the',
  'their',
  'then',
  'they',
  'this',
  'to',
  'unravels',
  'up',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
]);

/**
 * Returns the capitalised tokens in `title` that do NOT appear anywhere in
 * `briefBody`. Empty array = the title is grounded.
 *
 * Deliberately asymmetric: this checks GENERATED titles only. A `dailyTitle`
 * lifted from the brief's own `### ` line is grounded by construction and must
 * never be routed through here — several real titles ("Improved by
 * Subtraction") name nothing at all, and that is correct.
 */
export function ungroundedTitleTokens(
  title: string,
  briefBody: string
): string[] {
  const haystack = briefBody.toLowerCase();
  const out: string[] = [];
  // Capitalised words and ALL-CAPS tickers, ignoring possessives/punctuation.
  const tokens = title.match(/\b[A-Z][A-Za-z0-9.&'’-]*\b/g) ?? [];
  for (const raw of tokens) {
    const bare = raw.replace(/['’]s$/i, '').replace(/[.,;:!?]+$/, '');
    const key = bare.toLowerCase();
    if (key.length < 3) continue;
    if (TITLE_NON_ENTITY.has(key)) continue;
    if (haystack.includes(key)) continue;
    if (!out.includes(bare)) out.push(bare);
  }
  return out;
}
