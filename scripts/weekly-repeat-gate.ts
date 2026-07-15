/**
 * weekly-repeat-gate — warn-level checks for the two W28 "repeat" failure modes
 * (Jackson, 2026-07-15):
 *   A. THEME-DOUBLE: a theme (seeded with defense/military) that appears in BOTH the
 *      Predictions and the Six in the same issue — single-home broken at the issue level.
 *   B. CARRY-IS-COPY: a carried standing call whose prose is a near-verbatim copy of last
 *      week's, with no dated "This week" delta line.
 *
 * Warn-level: prints FLAGS and ALWAYS exits 0 (never blocks a Sunday publish). A FLAG is
 * the writer's worklist, exactly like fact-gate's FLAGs.
 *
 * Run:  npx tsx scripts/weekly-repeat-gate.ts <weekly-file.md>
 *       npx tsx scripts/weekly-repeat-gate.ts --selftest
 */
import fs from 'fs';
import path from 'path';

const STOP = new Set(
  'the a an of to in on for and or but with without into over under from by at as is are was were be been this that these those it its their our we you they week weekly year month next now not no more most than then so because what which who whose about after before between during within'.split(
    /\s+/,
  ),
);

/** Seeded theme lexicons. Kept deliberately narrow to avoid firing on ubiquitous topics
 *  (AI, rates). Defense is the theme the W28 doubling actually happened on; add more only
 *  when a real doubling recurs on that theme. */
const THEMES: Record<string, string[]> = {
  'defense/military': [
    'defense', 'defence', 'military', 'rearm', 'rearms', 'rearmament', 'munitions',
    'warfare', 'deterrent', 'troops', 'fighter jet', 'missile', 'drone strike', 'war-powers',
  ],
};

function region(body: string, startMarkers: string[], stopRe: RegExp): string {
  for (const sm of startMarkers) {
    const i = body.indexOf(sm);
    if (i >= 0) {
      const rest = body.slice(i + sm.length);
      const stop = rest.search(stopRe);
      return stop >= 0 ? rest.slice(0, stop) : rest;
    }
  }
  return '';
}

export function predictionsRegion(body: string): string {
  return region(body, ['# ▸ THE PREDICTIONS', 'THE PREDICTIONS'], /\n#\s?▸/);
}
export function sixRegion(body: string): string {
  return region(body, ['# ▸ THE SIX', 'THE SIX'], /\n#\s?▸\s?THE SIGNAL|\n#\s?▸\s?THE TAKE/);
}

export function sixHeadlines(body: string): string[] {
  const out: string[] = [];
  const re = /^\s*(?:[-*]\s*)?\*\*(.+?)\*\*/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push(m[1].trim());
  return out;
}

export function predictionCalls(body: string): { horizon: string; text: string }[] {
  const calls: { horizon: string; text: string }[] = [];
  const re = /\*\*Next (week|month|year)\b([\s\S]*?)(?=\n-\s*\*\*Next |\n#|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    calls.push({ horizon: `next ${m[1].toLowerCase()}`, text: m[2].replace(/\s+/g, ' ').trim() });
  }
  return calls;
}

export function keywords(text: string): Set<string> {
  const words = (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w));
  return new Set(words);
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function hasTheme(text: string, terms: string[]): boolean {
  return terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
}

function isoWeekPrev(slug: string): string | null {
  const m = slug.match(/(\d{4})-W(\d{1,2})/i);
  if (!m) return null;
  const y = +m[1], w = +m[2];
  return w > 1 ? `${y}-W${String(w - 1).padStart(2, '0')}` : null;
}
function findWeekly(dir: string, slug: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const f = fs
    .readdirSync(dir)
    .find((n) => n.startsWith(slug) && n.endsWith('.md') && !n.includes('-light') && !n.includes('factcheck'));
  return f ? path.join(dir, f) : null;
}

function run(file: string): number {
  const body = fs.readFileSync(file, 'utf-8');
  const flags: string[] = [];
  const predText = predictionsRegion(body) || body;
  const sixText = sixRegion(body) || body;

  // Check A — theme in BOTH Predictions and the Six
  for (const [theme, terms] of Object.entries(THEMES)) {
    if (hasTheme(predText, terms) && hasTheme(sixText, terms)) {
      flags.push(
        `A/THEME-DOUBLE: "${theme}" appears in BOTH the Predictions and the Six this issue. Single-home at the issue level — give the topic one home or fold it into the call's delta. (W28: Europe-defense year call + a defense/war Six story.)`,
      );
    }
  }

  // Check B — near-verbatim carried call vs previous weekly, no delta
  const slug = (path.basename(file).match(/\d{4}-W\d{1,2}/i) || [])[0];
  const prevSlug = slug ? isoWeekPrev(slug) : null;
  const prevFile = prevSlug ? findWeekly(path.dirname(file), prevSlug) : null;
  if (prevFile) {
    const prevPreds = predictionCalls(predictionsRegion(fs.readFileSync(prevFile, 'utf-8')));
    for (const c of predictionCalls(predText)) {
      const prev = prevPreds.find((p) => p.horizon === c.horizon);
      if (!prev) continue;
      const j = jaccard(keywords(c.text), keywords(prev.text));
      const hasDelta = /this week\b/i.test(c.text);
      if (j >= 0.85 && !hasDelta) {
        flags.push(
          `B/CARRY-IS-COPY: the "${c.horizon}" call is ${(j * 100).toFixed(0)}% identical to ${prevSlug} with no dated "This week" delta. Rewrite it around what the week added.`,
        );
      }
    }
  } else if (slug) {
    console.log(`[weekly-repeat] note: no previous weekly found for ${slug}; carry check skipped.`);
  }

  if (flags.length) {
    console.log(`⚠️  ${flags.length} WEEKLY REPEAT FLAG(S) (warn-level, not blocking):`);
    for (const f of flags) console.log('   - ' + f);
  } else {
    console.log('✅ weekly-repeat-gate: no theme-double or carried-call copy flagged.');
  }
  return 0;
}

function selftest(): number {
  let fail = 0;
  const t = (n: string, c: boolean) => {
    console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`);
    if (!c) fail++;
  };
  const w28 =
    '# ▸ THE SIX\n## Geopolitics\n- **Cheap Autonomy Is Rewriting Both the Politics and the Reach of War.** The Senate passed a war-powers rebuke and Ukraine fought the first all-robotic ground assault; a missile complex was struck.\n# ▸ THE SIGNAL\nx\n# ▸ THE PREDICTIONS\n- **Next year (geopolitics and defense): Europe rearms whether or not Washington stays.** By mid-2027 a European defense prime backlog inflects. *Kill switch: US re-anchors.*';
  t('sixRegion isolates the Six', /Autonomy/.test(sixRegion(w28)) && !/rearms/.test(sixRegion(w28)));
  t('predictionsRegion isolates predictions', /rearms/.test(predictionsRegion(w28)));
  t('theme-double fires on W28 defense pattern', hasTheme(predictionsRegion(w28), THEMES['defense/military']) && hasTheme(sixRegion(w28), THEMES['defense/military']));
  const noDef =
    '# ▸ THE SIX\n- **China Exported a Million Cars.** trade story\n# ▸ THE SIGNAL\nx\n# ▸ THE PREDICTIONS\n- **Next week (crypto): BTC breaks 55k.** *Kill switch: flows.*';
  t('no false-positive when defense absent', !(hasTheme(predictionsRegion(noDef), THEMES['defense/military']) && hasTheme(sixRegion(noDef), THEMES['defense/military'])));
  t('predictionCalls parses horizons', predictionCalls(predictionsRegion(w28))[0].horizon === 'next year');
  t('jaccard identical = 1', jaccard(keywords('alpha beta gamma delta'), keywords('alpha beta gamma delta')) === 1);
  t('this-week delta detected', /this week\b/i.test('This week hardened it from three directions'));
  console.log(`\n${fail === 0 ? '✅ selftest PASS' : `❌ ${fail} FAIL`}`);
  return fail === 0 ? 0 : 1;
}

const arg = process.argv[2];
if (arg === '--selftest') process.exit(selftest());
else if (arg) process.exit(run(arg));
else {
  console.error('usage: weekly-repeat-gate.ts <file.md> | --selftest');
  process.exit(2);
}
