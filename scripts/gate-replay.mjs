#!/usr/bin/env node
/**
 * gate-replay.mjs — TEST A GATE BEFORE IT GOES LIVE.
 *
 * WHY (2026-08-01, Jackson): every gate this week was verified by hand, one at a time, which is
 * why the fixes went whack-a-mole — fix one, discover the next in production. There was no way to
 * ask "if I ship this gate, what does it do to briefs we already accepted?" without a live night.
 *
 * This replays gates over already-published briefs and their drafts and tabulates the result, so
 * a new or retuned gate is calibrated against history BEFORE it can block anything. A gate that
 * fires on days you accepted is mistuned; a gate that stays silent on a day you rejected is blind.
 *
 *   node scripts/gate-replay.mjs                 # last 7 briefs, all replayable gates
 *   node scripts/gate-replay.mjs --days 14
 *   node scripts/gate-replay.mjs --gate validate-brief
 */
import { execSync } from 'child_process';
import fs from 'fs';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 7;
const ONLY = args.includes('--gate') ? args[args.indexOf('--gate') + 1] : null;

// kind: 'published' = takes a brief file · 'dated' = takes a BRIEF_DATE
const GATES = [
  { name: 'validate-brief',           kind: 'published' },
  { name: 'ceiling-lint',             kind: 'published' },
  { name: 'predraft-correction-gate', kind: 'dated', extra: ['--stage', 'v2'] },
  { name: 'predraft-consumption-gate',kind: 'dated' },
  { name: 'provenance-gate',          kind: 'dated' },
  { name: 'weekday-date-consistency', kind: 'published' },
].filter(g => (!ONLY || g.name === ONLY) && fs.existsSync(`scripts/${g.name}.ts`));

const dates = fs.readdirSync('content/daily-updates')
  .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-DAYS)
  .map(f => f.replace('.md', ''));

const run = (cmd) => {
  try { return { out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }), code: 0 }; }
  catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status ?? 1 }; }
};

// Count findings by severity. ceiling-lint emits advisory flags as "⚠" (not 🔴/🟡/✗),
// so the original harness showed `·` on every day while the gate was actually firing —
// the 3a diagnosis on 2026-08-01 (model-canonical-example FLAG on published + v2, invisible
// to replay). Soft markers (🟡 word budgets, ⚠ ceiling flags) must not be mistaken for
// silence OR for hard blocks.
const HARD = /🔴|✗ /g;
const SOFT = /🟡|⚠/g;

const results = {};
for (const g of GATES) {
  results[g.name] = {};
  for (const d of dates) {
    const target = g.kind === 'published' ? `content/daily-updates/${d}.md` : d;
    const extra = (g.extra || []).join(' ');
    const { out, code } = run(`node --experimental-strip-types scripts/${g.name}.ts ${target} ${extra}`);
    if (code === 2) { results[g.name][d] = '–'; continue; }
    const hard = (out.match(HARD) || []).length;
    const soft = (out.match(SOFT) || []).length;
    // Prefer hard count when the gate blocked OR emitted hard markers; else soft (advisory).
    if (hard) results[g.name][d] = `${code ? 'F' : 'f'}${hard}`;
    else if (soft) results[g.name][d] = `f${soft}`;
    else results[g.name][d] = '·';
  }
}

const w = Math.max(...GATES.map(g => g.name.length)) + 2;
console.log('\nGATE REPLAY — ' + dates[0] + ' → ' + dates[dates.length - 1] + '\n');
console.log(' '.repeat(w) + dates.map(d => d.slice(5).padStart(7)).join(''));
for (const g of GATES) console.log(g.name.padEnd(w) + dates.map(d => (results[g.name][d] || '?').padStart(7)).join(''));
console.log(`
  ·  clean      F{n}  hard findings + gate BLOCKS      f{n}  advisory only (🟡 / ⚠)      –  not applicable

  Read it like this: a row that is mostly '·' with F on the days you disliked is well tuned.
  A row that is F everywhere is mistuned and will be ignored. A row that is '·' everywhere has
  either nothing to catch or is blind — check it fires on a known-bad fixture before trusting it.
  Soft ceilings (word budgets) and ceiling-lint FLAGs show as f{n}, not F{n} and not silence.
`);
