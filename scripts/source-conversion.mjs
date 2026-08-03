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
  for (const m of t.matchAll(/✅\s*([A-Z][A-Za-z0-9.'&\- ]{2,30}?)(?=\s*[(,|]|$)/g)) names.add(m[1].trim());
  if (inListTable) continue;
  if (first && first.length > 1 && first.length < 60) names.add(first);
}
// entries that are obviously not sources
const SKIP = /^(—|-|N\/A|TBD|Live|Status|URL|What it provides|Search pattern|Accounts to Add|Confirmed Accounts)$/i;
const roster = [...names].filter((n) => !SKIP.test(n));

// ── published briefs in window ───────────────────────────────────────────────────────────────
const files = fs.readdirSync(BRIEFS).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-days);
if (!files.length) { console.error('no briefs found'); process.exit(2); }
const corpus = files.map((f) => fs.readFileSync(path.join(BRIEFS, f), 'utf8')).join('\n');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A roster entry is often "Person / Outlet" ("Charlie Bilello / Creative Planning") while the brief
// writes only "Charlie Bilello". Matching the full string calls a LIVE source dead, so score each
// component separately and take the best. Components under 4 chars are too collision-prone to use.
const hits = roster.map((n) => {
  const parts = n.split(/\s*[/|]\s*/).map((p) => p.trim()).filter((p) => p.length >= 4);
  // FIRST component only. Roster entries are "Person / Outlet", and scoring the outlet counts the
  // company as a STORY SUBJECT rather than as a source: "Jack Clark / Anthropic" scored 45 on
  // "Anthropic" across a month of AI coverage in which Jack Clark was never cited once.
  const probe = parts.length ? parts[0] : n;
  const c = (corpus.match(new RegExp(`(?<![A-Za-z])${esc(probe)}(?![A-Za-z])`, 'gi')) || []).length;
  return { name: n, n: c, via: probe };
}).sort((a, b) => b.n - a.n);

const live = hits.filter((h) => h.n > 0);
const dead = hits.filter((h) => h.n === 0);

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
console.log(`  roster entries parsed : ${roster.length}`);
console.log(`  appear in a brief     : ${live.length} (${pct(live.length, roster.length)}%)`);
console.log(`  NEVER appear (DEAD)   : ${dead.length} (${pct(dead.length, roster.length)}%)`);
console.log(`  producing but UNLISTED: ${unlisted.length}\n`);

if (!process.argv.includes('--quiet')) {
  console.log('  TOP CONVERTERS (roster entries earning their place)');
  live.slice(0, 12).forEach((h) => console.log(`    ${String(h.n).padStart(4)}  ${h.name}${h.via !== h.name ? `   (matched "${h.via}")` : ''}`));
  console.log('\n  🔴 PRODUCING BUT NOT ON THE ROSTER — add these, they are already working');
  if (unlisted.length) unlisted.forEach((c) => console.log(`    ${String(c.n).padStart(4)}  ${c.name}`));
  else console.log('    (none)');
  console.log('\n  ⚪ DEAD — zero appearances in the window. Retire, or fix the search pattern.');
  console.log(`    ${dead.slice(0, 40).map((d) => d.name).join(' · ')}${dead.length > 40 ? ` … +${dead.length - 40} more` : ''}`);
}
console.log('\n  The roster is not a wish list. An entry that never converts costs a sweep slot every day.');
console.log('  Derive membership from published conversion, the way sync-model-whitelist derives the model pool.\n');
