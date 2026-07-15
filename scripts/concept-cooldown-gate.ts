/**
 * concept-cooldown-gate — stops the house-crutch concepts from recurring as a Model or
 * Take FRAME (Jackson, 2026-07-15: "why do you mention hysteresis so much").
 *
 * "hysteresis" (and its cousins return-point memory / path-dependence) is catalogued in
 * Current_Worldview_v5 as a standing lens, so the system keeps reaching for it: it ran as
 * the Model on 2026-05-22 AND 2026-06-25 (34 days apart, just outside the Model's 30-day
 * slug cooldown) and again framed the 07-14 Take. The Model recency check is slug-based and
 * does not see Takes; this closes both gaps with a wider, name-based window.
 *
 * VIOLATION (exit 1): a WATCH concept appears in THIS brief's Model or Take region AND in a
 * prior brief's Model or Take region within the recent corpus window.
 *
 * Run:  npx tsx scripts/concept-cooldown-gate.ts <brief-file.md> [--window N] [--warn]
 *       npx tsx scripts/concept-cooldown-gate.ts --selftest
 *   --warn : report but exit 0 (advisory). Default is exit 1 on a violation.
 */
import fs from 'fs';
import path from 'path';

const WATCH = [
  'hysteresis',
  'return-point memory',
  'return point memory',
  'path-dependence',
  'path dependence',
  'path-dependent',
];

const CONTENT_DIR = 'content/daily-updates';

function regionFrom(body: string, startRes: RegExp[], stopRe: RegExp): string {
  for (const sr of startRes) {
    const m = body.match(sr);
    if (m && m.index != null) {
      const rest = body.slice(m.index + m[0].length);
      const stop = rest.search(stopRe);
      return stop >= 0 ? rest.slice(0, stop) : rest;
    }
  }
  return '';
}

/** The Model + Take regions, daily OR weekly headers. */
export function framingRegion(body: string): string {
  const model = regionFrom(
    body,
    [/^#+\s*(?:🧠\s*)?The Model\b.*$/im, /^#\s*▸\s*THE MODEL\b.*$/im],
    /\n"+\s|\n#\s?▸/,
  );
  const take = regionFrom(
    body,
    [/^#+\s*(?:🎯\s*)?The Take\b.*$/im, /^#\s*▸\s*THE TAKE\b.*$/im],
    /\n#+\s|\n#\s?▸/,
  );
  return `${model}\n${take}`;
}

export function watchHits(text: string): string[] {
  const lc = text.toLowerCase();
  return WATCH.filter((w) => lc.includes(w));
}

function recentDailies(currentBasename: string, window: number): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const daily = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f !== currentBasename)
    .sort()
    .reverse()
    .slice(0, window);
  return daily.map((f) => path.join(CONTENT_DIR, f));
}

function run(file: string, window: number, warnOnly: boolean): number {
  const body = fs.readFileSync(file, 'utf-8');
  const here = watchHits(framingRegion(body));
  if (here.length === 0) {
    console.log('✅ concept-cooldown-gate: no watched concept used as a Model/Take frame.');
    return 0;
  }
  const violations: string[] = [];
  const corpus = recentDailies(path.basename(file), window);
  for (const term of here) {
    const priorUses: string[] = [];
    for (const cf of corpus) {
      try {
        if (watchHits(framingRegion(fs.readFileSync(cf, 'utf-8'))).includes(term)) {
          priorUses.push(path.basename(cf).replace('.md', ''));
        }
      } catch {
        /* skip unreadable */
      }
    }
    if (priorUses.length) {
      violations.push(
        `"${term}" is a Model/Take frame here AND in ${priorUses.length} of the last ${window} briefs (${priorUses.slice(0, 5).join(', ')}). It is a house crutch — pick a fresh model/frame.`,
      );
    }
  }
  if (!violations.length) {
    console.log(
      `✅ concept-cooldown-gate: watched concept(s) present (${here.join(', ')}) but not reused within the last ${window} briefs.`,
    );
    return 0;
  }
  console.log(`${warnOnly ? '⚠️ ' : '❌'} CONCEPT COOLDOWN ${warnOnly ? 'FLAG' : 'VIOLATION'}(S):`);
  for (const v of violations) console.log('   - ' + v);
  return warnOnly ? 0 : 1;
}

function selftest(): number {
  let fail = 0;
  const t = (n: string, c: boolean) => {
    console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
    if (!c) fail++;
  };
  const dailyModel =
    '## The Take\nSome argument about Dixit 1989 hysteresis under sunk costs.\n## 🧠 The Model\n### Tensegrity\nA structure held by balanced tension.\n## Discovery\nx';
  t('framingRegion pulls Model + Take', /Tensegrity/.test(framingRegion(dailyModel)) && /Dixit/.test(framingRegion(dailyModel)));
  t('watchHits finds hysteresis in Take frame', watchHits(framingRegion(dailyModel)).includes('hysteresis'));
  const clean = '## 🧠 The Model\n### Tensegrity\nBalanced tension, no watched concept.\n## Discovery\nx';
  t('clean brief has no watch hits', watchHits(framingRegion(clean)).length === 0);
  const weekly = '# ▸ THE MODEL\n### Return-Point Memory\nDisordered solids recall their largest excursion.\n# ▸ DISCOVERY\nx';
  t('weekly headers detected; return-point memory caught', watchHits(framingRegion(weekly)).includes('return-point memory'));
  t('discovery-only mention NOT counted as frame', watchHits(framingRegion('## Discovery\nA note on hysteresis in glasses.\n')).length === 0);
  console.log(`\n${fail === 0 ? '✅ selftest PASS' : `❌ ${fail} FAIL`}`);
  return fail === 0 ? 0 : 1;
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') process.exit(selftest());
const file = args.find((a) => !a.startsWith('--'));
const warnOnly = args.includes('--warn');
const wi = args.indexOf('--window');
const window = wi >= 0 ? parseInt(args[wi + 1], 10) || 45 : 45;
if (!file) {
  console.error('usage: concept-cooldown-gate.ts <file.md> [--window N] [--warn] | --selftest');
  process.exit(2);
}
process.exit(run(file, window, warnOnly));
