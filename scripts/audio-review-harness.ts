/**
 * Independent review harness — Changes A & B (text-preprocessor.ts), 2026-07-24.
 * Run: npx tsx harness/run.ts
 */
import fs from 'fs';
import path from 'path';
import {
  extractNamedEntities,
  enforceScriptRules,
  extractVerbatimQuote,
  restoreVerbatimQuote,
  canonicalSectionKey,
  _test,
} from '../lib/audio/text-preprocessor.ts';

const { regexNormalize, extractRawContent } = _test as any;
const DIR = path.join(__dirname, '..', 'content', 'daily-updates');

// Fixture briefs are untracked local files — skip cleanly in checkouts that lack them.
if (
  !fs.existsSync(path.join(DIR, '2026-07-23.md')) ||
  !fs.existsSync(path.join(DIR, '2026-07-24.md'))
) {
  console.log(
    'SKIP — fixture briefs 2026-07-23/24 not present in this checkout (harness is fixture-pinned to those days)'
  );
  process.exit(0);
}

let fails = 0;
function verdict(name: string, ok: boolean, detail = '') {
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
  if (!ok) fails++;
}

const stub = (date: string, dd: string) => ({
  date,
  displayDate: dd,
  dailyTitle: 'X',
  epigraph: '',
  lede: '',
  sections: [] as any[],
});

function parseFull(date: string, dd: string) {
  const raw = fs.readFileSync(path.join(DIR, `${date}.md`), 'utf8');
  const { parsed } = extractRawContent(stub(date, dd), raw, false);
  return parsed.sections as { name: string; content: string }[];
}

function lightSection(file: string, header: string): string {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const i = raw.indexOf(header);
  if (i === -1) return '';
  const rest = raw.slice(i + header.length);
  const j = rest.search(/\n## /);
  return (j === -1 ? rest : rest.slice(0, j)).trim();
}

// GPT-style FAITHFUL scripts (full substance by construction):
// straight = markdown stripped, tickers/abbrevs expanded (regexNormalize does what the prompt demands)
// curly    = same, but with GPT-4o's documented curly-apostrophe typography
const gptifyStraight = (s: string) => regexNormalize(s);
const gptifyCurly = (s: string) => regexNormalize(s).replace(/'/g, '’');

console.log(
  '══ PART 1: entity check on REAL sections with FAITHFUL scripts (false-positive hunt) ══'
);
const days: [string, string][] = [
  ['2026-07-23', 'Thursday, July 23, 2026'],
  ['2026-07-24', 'Friday, July 24, 2026'],
];
let guarded = 0,
  total = 0;
for (const [date, dd] of days) {
  for (const sec of parseFull(date, dd)) {
    total++;
    const ents = extractNamedEntities(sec.content);
    if (ents.length >= 5) guarded++;
    const apostroEnts = ents.filter(e => e.includes("'"));
    for (const [label, script] of [
      ['straight', gptifyStraight(sec.content)],
      ['curly', gptifyCurly(sec.content)],
    ] as const) {
      const r = enforceScriptRules(sec.name, script, sec.content);
      const hay = r.script.toLowerCase();
      const dropped = ents.filter(e => !hay.includes(e));
      const flagged = ents.length >= 5 && dropped.length / ents.length > 0.3;
      if (flagged || r.needsRetry) {
        console.log(
          `  *** ${date} "${sec.name}" [${label}] FLAGGED on a faithful script: ents=${ents.length} dropped=${dropped.length} [${dropped.slice(0, 8).join(', ')}] apostropheEnts=${apostroEnts.length}`
        );
      }
    }
    console.log(
      `  ${date} "${sec.name}": words=${sec.content.split(/\s+/).filter(Boolean).length} ents=${ents.length} apostrophe-ents=${apostroEnts.length}${apostroEnts.length ? ` {${apostroEnts.join(', ')}}` : ''}`
    );
  }
}
console.log(
  `  sections total=${total}, guarded by entity check (>=5 ents)=${guarded}`
);

console.log(
  '\n══ PART 2: entity check BITES on kept-length gutting the word floor cannot see ══'
);
{
  const sec = parseFull('2026-07-24', 'Friday, July 24, 2026').find(s =>
    /Geopolitics|Companies/.test(s.name)
  )!;
  const paras = sec.content.split(/\n\n+/);
  const keep = paras.slice(0, Math.ceil(paras.length / 2)).join('\n\n');
  const totalW = sec.content.split(/\s+/).filter(Boolean).length;
  const keptW = keep.split(/\s+/).filter(Boolean).length;
  const padN = Math.max(0, Math.ceil(totalW * 0.62) - keptW);
  const pad = Array(Math.ceil(padN / 9))
    .fill('and the wider read here still points the same way as before')
    .join(' ');
  const gutted = regexNormalize(keep) + ' ' + pad;
  const r = enforceScriptRules(sec.name, gutted, sec.content);
  const ratio = (gutted.split(/\s+/).filter(Boolean).length / totalW).toFixed(
    2
  );
  verdict(
    `"${sec.name}" half-the-stories-dropped but ratio=${ratio} → flagged`,
    r.needsRetry,
    r.warnings.find(w => w.includes('GUTTED')) ?? 'no warning'
  );
}

console.log(
  '\n══ PART 3: retry selection prefers the PASSING attempt (2026-07-24 fix) ══'
);
{
  const sec = parseFull('2026-07-24', 'Friday, July 24, 2026').find(s =>
    /Companies/.test(s.name)
  )!;
  const ents = extractNamedEntities(sec.content);
  // FIRST attempt: full length but names paraphrased away (+ padding so it's the LONGER one)
  let first = gptifyStraight(sec.content);
  for (const e of ents)
    first = first.replace(
      new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      'the group'
    );
  first +=
    ' ' +
    Array(20)
      .fill('and the wider read here still points the same way as before')
      .join(' ');
  // SECOND attempt: faithful, all entities, slightly shorter in chars
  const second = gptifyStraight(sec.content);
  const c1 = enforceScriptRules(sec.name, first, sec.content);
  const c2 = enforceScriptRules(sec.name, second, sec.content);
  verdict(
    'first(flagged) longer than second(passing)',
    c1.script.length > c2.script.length && c1.needsRetry && !c2.needsRetry,
    `len1=${c1.script.length} len2=${c2.script.length} retry1=${c1.needsRetry} retry2=${c2.needsRetry}`
  );
  // The shipped selection logic, verbatim from rewriteSectionChecked:
  const preferred = !c2.needsRetry
    ? c2
    : c2.script.length > c1.script.length
      ? c2
      : c1;
  verdict(
    'FIXED: selection keeps the passing attempt over the longer flagged one',
    preferred === c2 && !preferred.needsRetry,
    'pre-fix, length-alone kept the flagged attempt and forced a needless fallback'
  );
}

console.log(
  '\n══ PART 4: extractVerbatimQuote on real + synthetic meditations ══'
);
{
  const igName = 'Inner Game';
  for (const [date, dd] of days) {
    const ig = parseFull(date, dd).find(s =>
      canonicalSectionKey(s.name).includes('inner game')
    );
    const q = ig ? extractVerbatimQuote(igName, ig.content) : null;
    verdict(
      `${date} full Inner Game: quote extracted`,
      !!q,
      q ? `spoken="${q.spoken.slice(0, 90)}..."` : 'NULL'
    );
    if (q) {
      verdict(
        `${date} masked has marker once, quote text gone`,
        q.masked.includes('[[VERBATIM_QUOTE]]') &&
          !q.masked.includes(q.spoken.slice(1, 40))
      );
    }
  }
  // 07-21 is a REAL quote-free meditation (Musonius Rufus, prose only) — null is the correct
  // outcome there, not a miss. The other three carry quotes and must extract.
  for (const f of [
    '2026-07-20-light.md',
    '2026-07-23-light.md',
    '2026-07-24-light.md',
  ]) {
    const med = lightSection(f, '## ▸ THE MEDITATION');
    const q = med ? extractVerbatimQuote('The Meditation', med) : null;
    verdict(
      `${f} light meditation: quote extracted`,
      !!q,
      q ? `"${q.spoken.slice(0, 70)}..."` : `NULL (header found=${!!med})`
    );
  }
  {
    const med = lightSection('2026-07-21-light.md', '## ▸ THE MEDITATION');
    if (med)
      verdict(
        '2026-07-21-light (quote-free Musonius day): correctly null',
        extractVerbatimQuote('The Meditation', med) === null
      );
  }
  const S = (n: string, c: string) => extractVerbatimQuote(n, c);
  verdict(
    'no-quote meditation → null (silent)',
    S(
      'The Meditation',
      'Just prose about attention.\n\nMore prose, no epigraph at all here.'
    ) === null
  );
  verdict(
    'non-meditation section → null',
    S('The Take', '"A long quoted line that would otherwise match easily."') ===
      null
  );
  verdict(
    'legacy "The Six: Inner Game" covered',
    !!S(
      'The Six: Inner Game',
      '*"A quote long enough to pass the length check."*\n\n— Someone'
    )
  );
  const multi = S(
    'The Meditation',
    '*"To see what is in front of one\'s nose\nneeds a constant struggle."*\n\n— George Orwell\n\nProse.'
  );
  verdict(
    'MULTI-LINE quote → null → falls back to GPT-owned (gap)',
    multi === null,
    'wrapped quotes are unprotected'
  );
  const noDash = S(
    'The Meditation',
    '*"A quote long enough to pass the length check."*\n\nGeorge Orwell, 1946\n\nProse.'
  );
  verdict(
    'attribution without dash → quote-only spoken, attribution left for GPT',
    !!noDash &&
      !noDash.spoken.includes('Orwell') &&
      noDash.masked.includes('George Orwell')
  );
  // KNOWN LIMITATION: a bare ">" continuation line between quote and attribution halts the
  // attribution scan (first non-empty line has no dash), so the quote extracts but the
  // attribution stays GPT-owned. Current briefs never use blockquote meditations.
  const blockq = S(
    'The Meditation',
    '> "A blockquote quote long enough to pass the check."\n>\n> — Someone Famous\n\nProse.'
  );
  verdict(
    'blockquote quote extracted; attribution stays GPT-owned (documented limitation)',
    !!blockq &&
      !blockq.spoken.includes('Someone Famous') &&
      blockq.masked.includes('Someone Famous')
  );
  const two = S(
    'The Meditation',
    '*"First epigraph quote long enough here."*\n\n— A. Author\n\nProse.\n\n*"Second full-line quote also long enough."*\n\nEnd.'
  );
  verdict(
    'two standalone quotes → only FIRST protected (second stays GPT-owned)',
    !!two && two.masked.includes('Second full-line quote')
  );
  const curly = S(
    'The Meditation',
    '*“Curly quoted meditation line long enough.”*\n\n— X Y'
  );
  verdict('curly-quoted line extracted', !!curly);
}

console.log('\n══ PART 5: restoreVerbatimQuote marker-leak / scrub stress ══');
{
  const SPOKEN =
    '"Attention is the rarest and purest form of generosity." Simone Weil, First and Last Notebooks (posthumous, 1970).';
  const count = (s: string) => s.split(SPOKEN).length - 1;
  const noMarkerWords = (s: string) => !/verbatim[_\s]*quote/i.test(s);
  let o = restoreVerbatimQuote(
    'Setup here. [[VERBATIM_QUOTE]] Reflection after.',
    SPOKEN
  );
  verdict(
    'kept marker → restored once, no leak',
    count(o) === 1 && noMarkerWords(o)
  );
  o = restoreVerbatimQuote(
    'Setup sentence lands first. Then reflection continues without any marker.',
    SPOKEN
  );
  verdict(
    'dropped marker → injected after 1st sentence',
    count(o) === 1 && noMarkerWords(o) && o.indexOf(SPOKEN) > 5
  );
  o = restoreVerbatimQuote('Setup. [VERBATIM QUOTE] After.', SPOKEN);
  verdict('single-bracket variant handled', count(o) === 1 && noMarkerWords(o));
  o = restoreVerbatimQuote(
    '[[VERBATIM_QUOTE]] then later again [[VERBATIM_QUOTE]] end.',
    SPOKEN
  );
  verdict(
    'double marker → spoken once, second scrubbed',
    count(o) === 1 && noMarkerWords(o)
  );
  o = restoreVerbatimQuote(
    'She kept a verbatim quote pinned above her desk. It mattered to her daily.',
    SPOKEN
  );
  verdict(
    'bare phrase in legit prose: scrubbed+injected (MANGLES sentence?)',
    count(o) === 1,
    JSON.stringify(o.slice(0, 130))
  );
  o = restoreVerbatimQuote(
    'Mr. Murdoch was a difficult figure. The rest of the reflection follows here.',
    SPOKEN
  );
  verdict(
    'abbrev "Mr." fallback-injects mid-name?',
    true,
    JSON.stringify(o.slice(0, 110))
  );
  o = restoreVerbatimQuote(
    'VERBATIM_QUOTE\n\nReflection paragraph continues here after the bare-word marker line.',
    SPOKEN
  );
  verdict(
    'bare unbracketed marker (e.g. after regexNormalize fallback strips brackets) → still restored once',
    count(o) === 1 && noMarkerWords(o),
    JSON.stringify(o.slice(0, 90))
  );
}

console.log(
  '\n══ PART 6: quote masking vs word-floor arithmetic (real 07-24 Inner Game) ══'
);
{
  const ig = parseFull('2026-07-24', 'Friday, July 24, 2026').find(s =>
    canonicalSectionKey(s.name).includes('inner game')
  )!;
  const q = extractVerbatimQuote('Inner Game', ig.content)!;
  const w = (s: string) => s.split(/\s+/).filter(Boolean).length;
  console.log(
    `  full=${w(ig.content)}w masked=${w(q.masked)}w quoteShare=${((100 * (w(ig.content) - w(q.masked))) / w(ig.content)).toFixed(1)}%`
  );
  // The real flow: script is checked AFTER restore, against the FULL content → no distortion.
  const restoredFaithful = restoreVerbatimQuote(
    gptifyStraight(q.masked),
    q.spoken
  );
  const r = enforceScriptRules('Inner Game', restoredFaithful, ig.content);
  verdict(
    'restored faithful script passes floor vs FULL source',
    !r.needsRetry,
    `ratio=${(w(restoredFaithful) / w(ig.content)).toFixed(2)}`
  );
}

console.log(
  '\n══ PART 7: regexNormalize double-application (fallback path is normalized twice) ══'
);
{
  const sec = parseFull('2026-07-24', 'Friday, July 24, 2026').find(s =>
    /Markets & Macro/.test(s.name)
  )!;
  const once = regexNormalize(sec.content);
  const twice = regexNormalize(once);
  if (once === twice) verdict('idempotent on Markets & Macro', true);
  else {
    let i = 0;
    while (once[i] === twice[i]) i++;
    verdict(
      'NOT idempotent',
      false,
      `first divergence @${i}: "${once.slice(i - 40, i + 40)}" vs "${twice.slice(i - 40, i + 40)}"`
    );
  }
}

console.log(
  `\n${fails === 0 ? 'HARNESS: all assertions OK' : `HARNESS: ${fails} finding(s) confirmed above`}`
);
