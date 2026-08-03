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

const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=30').split('=')[1]) || 30;
const ROOT = process.cwd();
const ROSTER = path.join(ROOT, 'system/SOURCE_NETWORK.md');
const BRIEFS = path.join(ROOT, 'content/daily-updates');

if (!fs.existsSync(ROSTER)) { console.error(`missing ${ROSTER}`); process.exit(2); }

// ── roster extraction ────────────────────────────────────────────────────────────────────────
// Two shapes in the file: markdown tables whose first column is a source name, and Twitter-list
// rows carrying "✅ Handle Name" accounts.
const rosterRaw = fs.readFileSync(ROSTER, 'utf8');
const names = new Set();
const retired = new Set();
const rowOf = new Map();   // source -> its remaining roster cells (URL, search pattern, ...)
let inListTable = false;   // the Twitter-LIST table's col 1 is a LIST name ("Equities"), not a source
for (const line of rosterRaw.split('\n')) {
  const t = line.trim();
  if (!t.startsWith('|')) { if (t) inListTable = false; continue; }
  if (/^\|[\s|:-]+\|?$/.test(t)) continue;                       // separator row
  const cells = t.split('|').map((c) => c.trim()).filter(Boolean);
  if (!cells.length) continue;
  const first = cells[0].replace(/\*\*/g, '').trim();
  if (/^List Name$/i.test(first)) { inListTable = true; continue; }
  if (/^(Source|Name|Channel|Tier|Category)$/i.test(first)) { inListTable = false; continue; }
  // Accounts inside the list table ARE sources; the list name itself is not.
  for (const m of t.matchAll(/✅\s*([A-Z][A-Za-z0-9.'&\- ]{2,30}?)(?=\s*[(,|]|$)/g)) {
    const acct = m[1].trim();
    const letters = acct.replace(/[^A-Za-z]/g, '');
    if (!/[a-z]/.test(letters) && letters.length > 5) continue;   // "PIPELINE FIX APPLIED" is a status, not an account
    names.add(acct);
  }
  if (inListTable) continue;
  // ~~strikethrough~~ in the roster means ALREADY RETIRED — reporting those as failures is noise.
  if (/~~/.test(cells[0])) { retired.add(first.replace(/~~/g, '').trim()); continue; }
  // Status/annotation rows that are not sources at all ("PIPELINE FIX APPLIED", "✅ Live").
  if (!/[a-z]/.test(first.replace(/[^A-Za-z]/g, '')) && first.replace(/[^A-Za-z]/g, '').length > 5) continue;
  if (first && first.length > 1 && first.length < 60) { names.add(first); rowOf.set(first, cells.slice(1)); }
}
// entries that are obviously not sources
const SKIP = /^(—|-|N\/A|TBD|Live|Status|URL|What it provides|Search pattern|Accounts to Add|Confirmed Accounts)$/i;
const roster = [...names].filter((n) => !SKIP.test(n));

// ── published briefs in window ───────────────────────────────────────────────────────────────
const files = fs.readdirSync(BRIEFS).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-days);
if (!files.length) { console.error('no briefs found'); process.exit(2); }
const corpus = files.map((f) => fs.readFileSync(path.join(BRIEFS, f), 'utf8')).join('\n');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── the CONSIDERATION layer ──────────────────────────────────────────────────────────────────
// Publication is the wrong test on its own. A source that was swept, read, and correctly judged
// not worth a bullet is working exactly as intended; a source nothing ever LOOKED AT is invisible
// and its roster row is a lie. The daily intelligence files are where "considered" is recorded, so
// scoring against them separates "we decided against it" from "we never saw it".
const INTEL = path.join(ROOT, 'daily-intelligence');
const from = files[0].slice(0, 10);
let intelCorpus = '', intelFiles = [];
if (fs.existsSync(INTEL)) {
  intelFiles = fs.readdirSync(INTEL)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-intelligence\.md$/.test(f) && f.slice(0, 10) >= from)
    .sort();
  intelCorpus = intelFiles.map((f) => fs.readFileSync(path.join(INTEL, f), 'utf8')).join('\n');
}

// A roster entry is often "Person / Outlet" ("Charlie Bilello / Creative Planning") while the brief
// writes only "Charlie Bilello". Matching the full string calls a LIVE source dead, so score each
// component separately and take the best. Components under 4 chars are too collision-prone to use.
const hits = roster.map((n) => {
  const parts = n.split(/\s*[/|]\s*/).map((p) => p.trim()).filter((p) => p.length >= 4);
  // FIRST component only. Roster entries are "Person / Outlet", and scoring the outlet counts the
  // company as a STORY SUBJECT rather than as a source: "Jack Clark / Anthropic" scored 45 on
  // "Anthropic" across a month of AI coverage in which Jack Clark was never cited once.
  const probe = parts.length ? parts[0] : n;
  const re = () => new RegExp(`(?<![A-Za-z])${esc(probe)}(?![A-Za-z])`, 'gi');
  const c = (corpus.match(re()) || []).length;
  const i = intelCorpus ? (intelCorpus.match(re()) || []).length : 0;
  return { name: n, n: c, intel: i, via: probe };
}).sort((a, b) => b.n - a.n);

const live = hits.filter((h) => h.n > 0);
const dead = hits.filter((h) => h.n === 0);
const considered = hits.filter((h) => h.n === 0 && h.intel > 0);   // swept, read, judged: WORKING
const unseen     = hits.filter((h) => h.n === 0 && h.intel === 0); // nothing ever looked: BROKEN

// ── producing-but-unlisted ───────────────────────────────────────────────────────────────────
// Outlets and agencies that routinely carry brief claims. Not NER — a deliberate, auditable list.
const CANDIDATES = ['EPA','FDA','USDA','EIA','OCC','CFTC','FERC','NHTSA','FAA','NOAA','CDC','NIH','GAO','CBO',
  'Reuters','Bloomberg','Nikkei','Al Jazeera','NPR','Axios','Semafor','Politico','The Information','Barron\'s',
  'Economist','Financial Times','CNBC','Associated Press','Kyodo','Xinhua','TASS','Handelsblatt','Le Monde'];
const rosterLower = new Set(roster.map((r) => r.toLowerCase()));
const unlisted = CANDIDATES.map((c) => {
  const re = new RegExp(`(?<![A-Za-z])${esc(c)}(?![A-Za-z])`, 'gi');
  return { name: c, n: (corpus.match(re) || []).length, onRoster: rosterLower.has(c.toLowerCase()) };
}).filter((c) => c.n > 0 && !c.onRoster).sort((a, b) => b.n - a.n);

// ── report ───────────────────────────────────────────────────────────────────────────────────
const pct = (x, y) => (y ? ((x / y) * 100).toFixed(0) : '0');
console.log(`\nSOURCE CONVERSION — ${files.length} briefs (${files[0].slice(0,10)} → ${files.at(-1).slice(0,10)})\n`);
console.log(`  roster entries parsed : ${roster.length}   (+${retired.size} already struck through, excluded)`);
console.log(`  appear in a brief     : ${live.length} (${pct(live.length, roster.length)}%)`);
console.log(`  NEVER appear (DEAD)   : ${dead.length} (${pct(dead.length, roster.length)}%)`);
console.log(`  producing but UNLISTED: ${unlisted.length}\n`);
if (intelCorpus) {
  console.log(`  ── against the CONSIDERATION layer (${intelFiles.length} intelligence files) ──`);
  console.log(`  PUBLISHED  (reached a brief)          : ${live.length} (${pct(live.length, roster.length)}%)`);
  console.log(`  CONSIDERED (in intel, not published)  : ${considered.length} (${pct(considered.length, roster.length)}%)  <- working as intended`);
  console.log(`  🔴 NEVER SEEN (in neither)            : ${unseen.length} (${pct(unseen.length, roster.length)}%)  <- the only real failure\n`);
} else {
  console.log('  ⚠ no daily-intelligence/ files in window — cannot separate "excluded" from "never seen"\n');
}

if (!process.argv.includes('--quiet')) {
  console.log('  TOP CONVERTERS (roster entries earning their place)');
  live.slice(0, 12).forEach((h) => console.log(`    ${String(h.n).padStart(4)}  ${h.name}${h.via !== h.name ? `   (matched "${h.via}")` : ''}`));
  console.log('\n  🔴 PRODUCING BUT NOT ON THE ROSTER — add these, they are already working');
  if (unlisted.length) unlisted.forEach((c) => console.log(`    ${String(c.n).padStart(4)}  ${c.name}`));
  else console.log('    (none)');
  if (intelCorpus) {
    // WHY was it never seen? A row with no URL and no search pattern cannot be executed by anything;
    // that is a broken roster row, not a dead source, and it is the cheapest of these to fix.
    const noPattern = (n) => {
      const cells = rowOf.get(n) || [];
      const meat = cells.slice(0, 2).map((c) => c.replace(/[—\-\s`]/g, '')).join('');
      return meat.length === 0;
    };
    const broken = unseen.filter((u) => noPattern(u.name));
    const scannable = unseen.filter((u) => !noPattern(u.name));
    console.log('\n  🔴 NEVER SEEN — absent from the intelligence files too. Nothing is looking at these.');
    console.log(`\n    (a) NO URL AND NO SEARCH PATTERN — ${broken.length}. Nothing could ever find these; the roster row`);
    console.log('        is incomplete. Cheapest fix on the board: fill in the row or delete it.');
    console.log(`        ${broken.map((d) => d.name).join(' · ') || '(none)'}`);
    console.log(`\n    (b) HAS a pattern but was never swept — ${scannable.length}. This is the real coverage gap.`);
    console.log(`        ${scannable.map((d) => d.name).join(' · ') || '(none)'}`);
    console.log('\n  ⚪ CONSIDERED then dropped — swept and judged. No action needed; this is the system working.');
    console.log(`    ${considered.slice(0, 20).map((d) => `${d.name} (${d.intel})`).join(' · ')}${considered.length > 20 ? ` … +${considered.length - 20} more` : ''}`);
  } else {
    console.log('\n  ⚪ DEAD — zero appearances. Retire, or fix the search pattern.');
    console.log(`    ${dead.slice(0, 40).map((d) => d.name).join(' · ')}`);
  }
}
console.log('\n  The roster is not a wish list. An entry that never converts costs a sweep slot every day.');
console.log('  Derive membership from published conversion, the way sync-model-whitelist derives the model pool.\n');
