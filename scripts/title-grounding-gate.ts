/**
 * title-grounding-gate — acceptance test for the generated-podcast-title
 * grounding guard (IMP-148), plus a standing regression over every published
 * episode title in the feed.
 *
 * THE INCIDENT IT EXISTS FOR (2026-08-09 daily-improvement session):
 * Saturday 2026-08-08's episode published as "Brief: Tesla's stock crashes
 * after shocking reveal". Tesla appears nowhere in that brief —
 * `grep -ic tesla content/daily-updates/2026-08-08.md` → 0, same for the light.
 * Cause chain, each link verified: an Editor `<!-- BRIEF VALIDATION REPORT -->`
 * block was promoted into the published file at lines 3-39 → `parseDailyBrief`
 * only accepts an epigraph within the first 5 lines (`i < 5`), so dailyTitle,
 * epigraph and lede all returned "" → `lib/audio/full-generate.ts` took its
 * `rawMarkdown.slice(0, 500)` fallback → a gpt-4o prompt that demands power
 * words and a named company, at temperature 0.8, was handed a masthead and a
 * list of gate exit codes, and invented one.
 *
 * Usage:
 *   npx tsx scripts/title-grounding-gate.ts --selftest
 *   npx tsx scripts/title-grounding-gate.ts --episodes   (regression over the feed)
 *
 * Exit: 0 clean · 1 an ungrounded published title · 2 selftest fail
 */
import fs from 'fs';
import path from 'path';
import { ungroundedTitleTokens } from '../lib/audio/title-grounding.ts';

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');

function readBrief(date: string): string | null {
  const p = path.join(CONTENT_DIR, `${date}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function selftest(): number {
  let fail = 0;
  const say = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✓' : '✗ FAIL:'} ${msg}`);
    if (!ok) fail = 1;
  };

  const brief0808 = readBrief('2026-08-08');
  if (!brief0808) {
    console.log('  ✗ FAIL: content/daily-updates/2026-08-08.md missing');
    return 1;
  }

  // ── DIRECTION 1: must FIRE on the real published falsehood ────────────────
  const tesla = ungroundedTitleTokens(
    "Tesla's stock crashes after shocking reveal",
    brief0808
  );
  say(
    tesla.includes('Tesla'),
    `fires on the real 08-08 episode title — ungrounded: [${tesla.join(', ')}]`
  );

  // A second invented entity, same shape. NOTE: the first draft of this case
  // used "Nvidia" and the gate stayed silent — correctly, because NVIDIA is in
  // the 08-08 Vistra bullet (`grep -ic nvidia` → 1). The checker was right and
  // the test was wrong. Netflix is verified absent (`grep -ic netflix` → 0).
  const invented = ungroundedTitleTokens(
    'Netflix breaks and nobody saw it',
    brief0808
  );
  say(
    invented.includes('Netflix'),
    `fires on an invented company — ungrounded: [${invented.join(', ')}]`
  );

  // ── DIRECTION 2: must stay SILENT on titles the brief actually supports ───
  // The brief's own editorial headline — names no entity at all.
  say(
    ungroundedTitleTokens('The Unemployment Rate Fell the Wrong Way', brief0808)
      .length === 0,
    'silent on the real 08-08 daily title'
  );
  // Entities the 08-08 brief genuinely covers, in clickbait form.
  say(
    ungroundedTitleTokens('Vistra hits a record and OpenAI unravels', brief0808)
      .length === 0,
    'silent on entities the brief really covers (Vistra, OpenAI)'
  );
  // Power words and sentence-initial function words must never count as entities.
  say(
    ungroundedTitleTokens('Nobody Saw What Crashes Next', brief0808).length ===
      0,
    'silent on prompt power-words with no entity'
  );

  // ── DIRECTION 3: every real daily title is grounded in its own brief ──────
  // Guards against the guard: if this ever fires, the checker is too strict and
  // would start rejecting good generated titles.
  const bad: string[] = [];
  let checked = 0;
  for (const f of fs.readdirSync(CONTENT_DIR).sort()) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!m || m[1]! < '2026-07-07') continue;
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
    const titleLine = raw.split('\n').find(l => l.startsWith('### '));
    if (!titleLine) continue;
    checked++;
    const un = ungroundedTitleTokens(titleLine.replace(/^###\s+/, ''), raw);
    if (un.length > 0) bad.push(`${m[1]} [${un.join(', ')}]`);
  }
  say(
    bad.length === 0,
    bad.length === 0
      ? `no false positives across ${checked} real daily titles`
      : `${bad.length}/${checked} real titles wrongly flagged: ${bad.slice(0, 5).join(' · ')}`
  );

  console.log(
    fail === 0
      ? '✅ title-grounding-gate SELFTEST PASS'
      : '❌ title-grounding-gate SELFTEST FAIL'
  );
  return fail;
}

/** Regression over the published episode feed — catches an already-shipped lie. */
function checkEpisodes(): number {
  const candidates = [
    path.join(process.cwd(), 'content/episodes.json'),
    path.join(process.cwd(), 'public/episodes.json'),
    path.join(process.cwd(), 'data/episodes.json'),
  ];
  const file = candidates.find(p => fs.existsSync(p));
  if (!file) {
    console.log(
      'ℹ️  no local episodes.json (metadata lives in blob storage) — ' +
        'selftest is the binding leg; run --episodes in an environment that has it.'
    );
    return 0;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const eps: { date?: string; title?: string }[] = Array.isArray(raw)
    ? raw
    : (raw.episodes ?? []);
  let fail = 0;
  for (const e of eps) {
    if (!e?.date || !e?.title) continue;
    const brief = readBrief(e.date.slice(0, 10));
    if (!brief) continue;
    const un = ungroundedTitleTokens(e.title, brief);
    if (un.length > 0) {
      console.log(
        `❌ ${e.date}: episode title ${JSON.stringify(e.title)} names ` +
          `[${un.join(', ')}] — absent from the brief.`
      );
      fail = 1;
    }
  }
  if (fail === 0) console.log(`✅ all ${eps.length} episode titles grounded`);
  return fail;
}

const args = process.argv.slice(2);
if (args[0] === '--episodes') process.exit(checkEpisodes());
process.exit(selftest() === 0 ? 0 : 2);
