#!/usr/bin/env node
/**
 * source-conversion.mjs — measure the source roster against what actually gets published.
 *
 * WHY: `system/SOURCE_NETWORK.md` is a HAND-MAINTAINED roster, and a hand-maintained list drifts
 * from reality in both directions. On 2026-08-03: ~188 roster entries, a large share never appear
 * in a brief, while EPA / FDA / USDA / EIA — which carry the strongest section — are on NONE of
 * them. That is the same shape as the Tier-3 model whitelist (119 models in the queue, 32 on a
 * stale hand-curated list, effective pool ~6), which was dissolved by deriving the pool from the
 * catalog instead of maintaining it by hand.
 *
 * This script does NOT edit the roster — URLs and search patterns cannot be derived. It measures,
 * so the edit is informed instead of guessed:
 *   DEAD      roster entry with zero appearances in the window  -> retire, or fix its search pattern
 *   PRODUCING source appearing in briefs but absent from the roster -> add it, it is already working
 *
 * Usage: node scripts/source-conversion.mjs [--days 30] [--quiet]
 */
import fs from 'node:fs';
import path from 'node:path';

const days =
  Number(
    (process.argv.find(a => a.startsWith('--days=')) || '--days=30').split(
      '='
    )[1]
  ) || 30;
const ROOT = process.cwd();
const ROSTER = path.join(ROOT, 'system/SOURCE_NETWORK.md');
const BRIEFS = path.join(ROOT, 'content/daily-updates');

if (!fs.existsSync(ROSTER)) {
  console.error(`missing ${ROSTER}`);
  process.exit(2);
}

// ── roster extraction ────────────────────────────────────────────────────────────────────────
// Two shapes in the file: markdown tables whose first column is a source name, and Twitter-list
// rows carrying "✅ Handle Name" accounts.
const rosterRaw = fs.readFileSync(ROSTER, 'utf8');
const names = new Set();
const retired = new Set();
const rowOf = new Map(); // source -> its remaining roster cells (URL, search pattern, ...)
let inListTable = false; // the Twitter-LIST table's col 1 is a LIST name ("Equities"), not a source
for (const line of rosterRaw.split('\n')) {
  const t = line.trim();
  if (!t.startsWith('|')) {
    if (t) inListTable = false;
    continue;
  }
  if (/^\|[\s|:-]+\|?$/.test(t)) continue; // separator row
  const cells = t
    .split('|')
    .map(c => c.trim())
    .filter(Boolean);
  if (!cells.length) continue;
  const first = cells[0].replace(/\*\*/g, '').trim();
  if (/^List Name$/i.test(first)) {
    inListTable = true;
    continue;
  }
  if (/^(Source|Name|Channel|Tier|Category)$/i.test(first)) {
    inListTable = false;
    continue;
  }
  // Accounts inside the list table ARE sources; the list name itself is not.
  for (const m of t.matchAll(
    /✅\s*([A-Z][A-Za-z0-9.'&\- ]{2,30}?)(?=\s*[(,|]|$)/g
  )) {
    const acct = m[1].trim();
    const letters = acct.replace(/[^A-Za-z]/g, '');
    if (!/[a-z]/.test(letters) && letters.length > 5) continue; // "PIPELINE FIX APPLIED" is a status, not an account
    names.add(acct);
  }
  if (inListTable) continue;
  // ~~strikethrough~~ in the roster means ALREADY RETIRED — reporting those as failures is noise.
  if (/~~/.test(cells[0])) {
    retired.add(first.replace(/~~/g, '').trim());
    continue;
  }
  // Status/annotation rows that are not sources at all ("PIPELINE FIX APPLIED", "✅ Live").
  if (
    !/[a-z]/.test(first.replace(/[^A-Za-z]/g, '')) &&
    first.replace(/[^A-Za-z]/g, '').length > 5
  )
    continue;
  if (first && first.length > 1 && first.length < 60) {
    names.add(first);
    rowOf.set(first, cells.slice(1));
  }
}
// entries that are obviously not sources
const SKIP =
  /^(—|-|N\/A|TBD|Live|Status|URL|What it provides|Search pattern|Accounts to Add|Confirmed Accounts)$/i;
const roster = [...names].filter(n => !SKIP.test(n));

// ── published briefs in window ───────────────────────────────────────────────────────────────
const files = fs
  .readdirSync(BRIEFS)
  .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
  .sort()
  .slice(-days);
if (!files.length) {
  console.error('no briefs found');
  process.exit(2);
}
const corpus = files
  .map(f => fs.readFileSync(path.join(BRIEFS, f), 'utf8'))
  .join('\n');
const SUBJECT_ORGS = new Set([
  'anthropic',
  'openai',
  'hugging face',
  'brookings',
  'cambridge',
  'google',
  'microsoft',
  'meta',
  'apple',
  'nvidia',
  'deepmind',
  'schwab',
  'blackrock',
  'goldman',
  'jpmorgan',
  'citi',
]);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── the CONSIDERATION layer ──────────────────────────────────────────────────────────────────
// Publication is the wrong test on its own. A source that was swept, read, and correctly judged
// not worth a bullet is working exactly as intended; a source nothing ever LOOKED AT is invisible
// and its roster row is a lie. The daily intelligence files are where "considered" is recorded, so
// scoring against them separates "we decided against it" from "we never saw it".
const INTEL = path.join(ROOT, 'daily-intelligence');
const from = files[0].slice(0, 10);
let intelCorpus = '',
  intelFiles = [];
if (fs.existsSync(INTEL)) {
  intelFiles = fs
    .readdirSync(INTEL)
    .filter(
      f =>
        /^\d{4}-\d{2}-\d{2}-intelligence\.md$/.test(f) && f.slice(0, 10) >= from
    )
    .sort();
  intelCorpus = intelFiles
    .map(f => fs.readFileSync(path.join(INTEL, f), 'utf8'))
    .join('\n');
}

// A roster entry is often "Person / Outlet" ("Charlie Bilello / Creative Planning") while the brief
// writes only "Charlie Bilello". Matching the full string calls a LIVE source dead, so score each
// component separately and take the best. Components under 4 chars are too collision-prone to use.
let hits = roster
  .map(n => {
    const parts = n
      .split(/\s*[/|]\s*/)
      .map(p => p.trim())
      .filter(p => p.length >= 4);
    // Score EVERY component and take the best, because the roster name and the prose name diverge in
    // both directions. First-component-only called "Citrini Research" (84 intel mentions), "hildobby
    // Dune" (60) and "Shawn Wang / Latent Space" (7) unseen. All-components-max called "Jack Clark /
    // Anthropic" a top converter on 45 hits of the COMPANY in AI coverage where Clark was never cited.
    // SUBJECT_ORGS is the narrow denylist for that second failure: outfits that appear constantly as
    // story subjects, so a match on them says nothing about whether the SOURCE was consulted.
    // `via` is always reported — this cannot be fully automated (roster names differ arbitrarily from
    // prose names), so the output is a list to eyeball, not a number to trust blindly.
    // A roster name with no separator but a GENERIC TRAILING WORD is written short in prose:
    // "Citrini Research" -> "Citrini" (84 intel hits, and the slate was re-sweeping it every cycle),
    // "hildobby Dune" -> "hildobby", "Asterisk Magazine" -> "Asterisk". Only strip a known generic
    // suffix — probing the leading token of any two-word name would match "Russell Napier" against
    // the Russell 2000. Found by Cursor review; the previous "the slate is robust to this" was wrong.
    const GENERIC_TAIL =
      /\s+(Research|Magazine|Dune|Podcast|Capital|Analytics|Advisors|Partners|Group|Media|Seminars|Analysis|Economics|Letter|Report)$/i;
    // NB: split() returns a 1-element array when there is no separator, so gating the suffix rule on
    // `parts.length` made it dead code — "Citrini Research" never got probed as "Citrini" and kept
    // re-appearing on the rotation slate. Expand EVERY candidate, not just the no-separator case.
    const base = parts.length ? parts : [n];
    // "Outlet (Person)" — "Founders (David Senra)", "Not Boring (Packy McCormick)" — is written in
    // prose as either half. Probe both. (Cursor review: both were sitting on the rotation slate.)
    const cand = base.flatMap(p => {
      const out = GENERIC_TAIL.test(p) ? [p, p.replace(GENERIC_TAIL, '')] : [p];
      const paren = p.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      // Only the PERSON half. The outlet half of "Founders (David Senra)" is the word "Founders",
      // which matches generic business prose 100+ times a month and would fake a converter. The
      // parenthetical is a proper name and is safe. Narrower is right when the cost of a false
      // positive is "we stop sweeping a source we are not actually seeing".
      if (paren) out.push(paren[2].trim());
      return out;
    });
    let best = 0,
      bestI = 0,
      via = n;
    for (const p of cand) {
      if (SUBJECT_ORGS.has(p.toLowerCase())) continue;
      const mk = () => new RegExp(`(?<![A-Za-z])${esc(p)}(?![A-Za-z])`, 'gi');
      const i = intelCorpus ? (intelCorpus.match(mk()) || []).length : 0;
      const c = (corpus.match(mk()) || []).length;
      if (i + c > best + bestI) {
        best = c;
        bestI = i;
        via = p;
      }
    }
    return { name: n, n: best, intel: bestI, via };
  })
  .sort((a, b) => b.n - a.n);

// DEDUPE: distinct roster rows can resolve to the same probe ("Robin Brooks" and "Robin Brooks /
// Brookings"; "Glassnode / On-chain Data" and "James Check / Glassnode"), which double-counted them
// as converters and inflated the published total. One probe, one source. (Cursor review.)
const seenVia = new Map();
for (const h of hits) {
  const k = h.via.toLowerCase();
  const prev = seenVia.get(k);
  if (!prev) seenVia.set(k, h);
  else {
    prev.dupes = (prev.dupes || 1) + 1;
    h.dupe = true;
  }
}
const dupeCount = hits.filter(h => h.dupe).length;
hits = hits.filter(h => !h.dupe);

const live = hits.filter(h => h.n > 0);
const dead = hits.filter(h => h.n === 0);
const considered = hits.filter(h => h.n === 0 && h.intel > 0); // swept, read, judged: WORKING
const unseen = hits.filter(h => h.n === 0 && h.intel === 0); // nothing ever looked: BROKEN

// ── producing-but-unlisted ───────────────────────────────────────────────────────────────────
// Outlets and agencies that routinely carry brief claims. Not NER — a deliberate, auditable list.
const CANDIDATES = [
  'EPA',
  'FDA',
  'USDA',
  'EIA',
  'OCC',
  'CFTC',
  'FERC',
  'NHTSA',
  'FAA',
  'NOAA',
  'CDC',
  'NIH',
  'GAO',
  'CBO',
  'Reuters',
  'Bloomberg',
  'Nikkei',
  'Al Jazeera',
  'NPR',
  'Axios',
  'Semafor',
  'Politico',
  'The Information',
  "Barron's",
  'Economist',
  'Financial Times',
  'CNBC',
  'Associated Press',
  'Kyodo',
  'Xinhua',
  'TASS',
  'Handelsblatt',
  'Le Monde',
];
const rosterLower = new Set(roster.map(r => r.toLowerCase()));
const unlisted = CANDIDATES.map(c => {
  const re = new RegExp(`(?<![A-Za-z])${esc(c)}(?![A-Za-z])`, 'gi');
  return {
    name: c,
    n: (corpus.match(re) || []).length,
    onRoster: rosterLower.has(c.toLowerCase()),
  };
})
  .filter(c => c.n > 0 && !c.onRoster)
  .sort((a, b) => b.n - a.n);

// ── ROTATION MODE ────────────────────────────────────────────────────────────────────────────
// The real mechanism behind "never seen": Source_Network_Scanner.md Phase 1 is a HARDCODED list of
// ~13 sources swept every session. Phases 2-3 fire only when a source is bound to an ACTIVE thesis
// or Big Story. So of ~161 roster entries, 13 are guaranteed and the rest are reachable only by
// coincidence. Nothing rotates, so a source outside Phase 1 with no active thesis is structurally
// unreachable no matter how good it is.
//
// --rotate N emits the N least-recently-seen roster entries WITH their search patterns, so the
// Scanner has something mechanical to run instead of a judgement call. At N=8 across 6 sweeps a day
// the whole roster is considered every ~3-4 days, at a cost of 8 searches per sweep.
const rot = process.argv.find(a => a.startsWith('--rotate'));
if (rot) {
  const N = Number(rot.split('=')[1]) || 8;
  const stale = [...unseen, ...considered]
    .sort((a, b) => a.intel - b.intel)
    .slice(0, N);
  console.log(
    `\nROTATION SLATE — ${stale.length} least-recently-seen roster sources.`
  );
  console.log(
    'Run these in addition to Phase 1. They are the ones nothing else will reach.\n'
  );
  for (const st of stale) {
    const cells = rowOf.get(st.name) || [];
    const pattern =
      cells.find(c => /`/.test(c)) ||
      cells[1] ||
      cells[0] ||
      '(no search pattern on the roster row)';
    console.log(
      `  ${st.name}\n      ${pattern.replace(/`/g, '')}\n      seen in intel: ${st.intel} · in briefs: ${st.n}`
    );
  }
  console.log('');
  process.exit(0);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
const pct = (x, y) => (y ? ((x / y) * 100).toFixed(0) : '0');
console.log(
  `\nSOURCE CONVERSION — ${files.length} briefs (${files[0].slice(0, 10)} → ${files.at(-1).slice(0, 10)})\n`
);
console.log(
  `  roster entries parsed : ${roster.length}   (+${retired.size} struck through, ${dupeCount} duplicate rows collapsed)`
);
console.log(
  `  appear in a brief     : ${live.length} (${pct(live.length, roster.length)}%)`
);
console.log(
  `  NEVER appear (DEAD)   : ${dead.length} (${pct(dead.length, roster.length)}%)`
);
console.log(`  producing but UNLISTED: ${unlisted.length}\n`);
if (intelCorpus) {
  console.log(
    `  ── against the CONSIDERATION layer (${intelFiles.length} intelligence files) ──`
  );
  console.log(
    `  PUBLISHED  (reached a brief)          : ${live.length} (${pct(live.length, roster.length)}%)`
  );
  console.log(
    `  CONSIDERED (in intel, not published)  : ${considered.length} (${pct(considered.length, roster.length)}%)  <- working as intended`
  );
  console.log(
    `  🔴 NEVER SEEN (in neither)            : ${unseen.length} (${pct(unseen.length, roster.length)}%)  <- the only real failure\n`
  );
} else {
  console.log(
    '  ⚠ no daily-intelligence/ files in window — cannot separate "excluded" from "never seen"\n'
  );
}

if (!process.argv.includes('--quiet')) {
  console.log('  TOP CONVERTERS (roster entries earning their place)');
  live
    .slice(0, 12)
    .forEach(h =>
      console.log(
        `    ${String(h.n).padStart(4)}  ${h.name}${h.via !== h.name ? `   (matched "${h.via}")` : ''}`
      )
    );
  console.log(
    '\n  🔴 PRODUCING BUT NOT ON THE ROSTER — add these, they are already working'
  );
  if (unlisted.length)
    unlisted.forEach(c =>
      console.log(`    ${String(c.n).padStart(4)}  ${c.name}`)
    );
  else console.log('    (none)');
  if (intelCorpus) {
    // WHY was it never seen? A row with no URL and no search pattern cannot be executed by anything;
    // that is a broken roster row, not a dead source, and it is the cheapest of these to fix.
    const noPattern = n => {
      const cells = rowOf.get(n) || [];
      const meat = cells
        .slice(0, 2)
        .map(c => c.replace(/[—\-\s`]/g, ''))
        .join('');
      return meat.length === 0;
    };
    const broken = unseen.filter(u => noPattern(u.name));
    const scannable = unseen.filter(u => !noPattern(u.name));
    console.log(
      '\n  🔴 NEVER SEEN — absent from the intelligence files too. Nothing is looking at these.'
    );
    console.log(
      `\n    (a) NO URL AND NO SEARCH PATTERN — ${broken.length}. Nothing could ever find these; the roster row`
    );
    console.log(
      '        is incomplete. Cheapest fix on the board: fill in the row or delete it.'
    );
    console.log(`        ${broken.map(d => d.name).join(' · ') || '(none)'}`);
    console.log(
      `\n    (b) HAS a pattern but was never swept — ${scannable.length}. This is the real coverage gap.`
    );
    console.log(
      `        ${scannable.map(d => d.name).join(' · ') || '(none)'}`
    );
    console.log(
      '\n  ⚪ CONSIDERED then dropped — swept and judged. No action needed; this is the system working.'
    );
    console.log(
      `    ${considered
        .slice(0, 20)
        .map(d => `${d.name} (${d.intel})`)
        .join(
          ' · '
        )}${considered.length > 20 ? ` … +${considered.length - 20} more` : ''}`
    );
  } else {
    console.log(
      '\n  ⚪ DEAD — zero appearances. Retire, or fix the search pattern.'
    );
    console.log(
      `    ${dead
        .slice(0, 40)
        .map(d => d.name)
        .join(' · ')}`
    );
  }
}
console.log(
  '\n  The roster is not a wish list. An entry that never converts costs a sweep slot every day.'
);
console.log(
  '  Derive membership from published conversion, the way sync-model-whitelist derives the model pool.\n'
);
