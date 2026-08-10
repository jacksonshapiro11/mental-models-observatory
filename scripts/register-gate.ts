/**
 * register-gate — flags PROCESS TALK on the reader surface. Advisory by design.
 *
 * THE FAILURE (2026-08-09, owner mark on the W32 audio). The predictions segment said the brief
 * "almost missed this." It entered UPSTREAM, in the markdown, not in the audio rewrite — the weekly
 * and the weekly light both carry it — so catching it here catches it before it can reach a
 * microphone.
 *
 * WHY THIS IS NOT A STRIPPER. Public call-grading is the product and it stays. "This call survived
 * by 5bp" is exactly what readers come for. The failure is not first person and it is not candour;
 * it is BACKSTAGE MACHINERY — the scan, the sweep, the gates, the drafting — appearing in a product
 * that is supposed to be the finished thought.
 *
 * THE WORKED EXAMPLE, VERBATIM, because it contains both at once and settles the design:
 *
 *   "Four calls came due, and the most important thing that happened is that we nearly booked a
 *    miss on a win: the FDA approved Moderna's flu vaccine on the deadline, and our own scan never
 *    saw it."
 *
 * "Four calls came due" and "booked a miss on a win" are call-grading and stay. "our own scan never
 * saw it" is the leak. An auto-stripper takes the whole sentence or leaves the whole sentence, and
 * both are wrong. Only a flag routed to the owner's ear resolves it. HIS EAR DECIDES THE BORDERLINE
 * CASES — that is not a placeholder for a better rule, it is the rule.
 *
 * THE DISCRIMINATOR, in one line: does the sentence describe a CLAIM WE MADE TO READERS, or a STEP
 * IN HOW THE BRIEF IS MADE? The first is the product. The second is backstage.
 *
 * Usage:
 *   node --experimental-strip-types scripts/register-gate.ts <file.md> [--strict]
 *   node --experimental-strip-types scripts/register-gate.ts --selftest
 *
 * Exit: 0 always, unless --strict and a LEAK was found. Advisory first.
 */
import fs from 'fs';
import path from 'path';

export type RegisterHit = {
  family: 'SCAN' | 'DRAFTING' | 'QA' | 'EFFORT';
  verdict: 'LEAK' | 'MIXED';
  match: string;
  sentence: string;
};

/** Backstage machinery. Each pattern is a production step, never a claim to a reader. */
const FAMILIES: { family: RegisterHit['family']; res: RegExp[] }[] = [
  {
    family: 'SCAN',
    res: [
      /\bour (own )?(scan|scanning|sweep|crawl|feed|sources?|system|pipeline)\b/i,
      /\b(we|our scan\w*) (never|didn't|did not|failed to) (saw|see|catch|spot|pick up)\b/i,
      /\bnever (saw|caught|spotted) it\b/i,
      /\b(almost|nearly) (missed|booked a miss)\b/i,
      /\bwe (missed|overlooked) (this|it|the news|the story)\b/i,
    ],
  },
  {
    family: 'DRAFTING',
    res: [
      /\b(as|when) we (drafted|wrote|were writing|assembled)\b/i,
      /\bthis (brief|section|segment|draft) (was|is being) (written|drafted|assembled)\b/i,
      /\bour draft\b/i,
      /\bin (today's|this) (writeup|write-up|drafting)\b/i,
    ],
  },
  {
    family: 'QA',
    res: [
      /\bour (gates?|checks?|validators?|critic|editor)\b/i,
      /\b(the )?(gate|validator|fact-?check) (caught|flagged|missed)\b/i,
      /\bwent unverified\b/i,
    ],
  },
  {
    family: 'EFFORT',
    res: [
      /\bwe should have (caught|seen|flagged|run)\b/i,
      /\bwe failed to (catch|see|flag|run)\b/i,
      /\bwe (nearly|almost) (got|had) (this|it) wrong\b/i,
      /\bmea culpa\b/i,
    ],
  },
];

/** 🔴 THE EXEMPTION THAT MUST SURVIVE. A claim made to readers, and its grading, is the product. */
const CALL_GRADING =
  /\b(we (said|called|predicted|argued|wrote last|flagged on)|our (call|calls|thesis|prediction)|calls? came due|booked a (miss|win)|survived by|we were (right|wrong) (about|on)|this call)\b/i;

const stripMd = (s: string): string =>
  s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ');

/** Sentences, roughly. Good enough: the unit of judgment here is what the owner reads aloud. */
function sentences(raw: string): string[] {
  return stripMd(raw)
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function checkRegister(raw: string): RegisterHit[] {
  const out: RegisterHit[] = [];
  for (const s of sentences(raw)) {
    for (const f of FAMILIES) {
      for (const re of f.res) {
        const m = s.match(re);
        if (!m) continue;
        out.push({
          family: f.family,
          verdict: CALL_GRADING.test(s) ? 'MIXED' : 'LEAK',
          match: m[0],
          sentence: s.length > 260 ? s.slice(0, 260) + '…' : s,
        });
        break; // one hit per family per sentence
      }
    }
  }
  return out;
}

function selftest(): number {
  let pass = 0,
    fail = 0;
  const t = (name: string, cond: boolean) => {
    if (cond) pass++;
    else {
      fail++;
      console.error(`  ✗ ${name}`);
    }
  };

  const worked =
    "Four calls came due, and the most important thing that happened is that we nearly booked a miss on a win: the FDA approved Moderna's flu vaccine on the deadline, and our own scan never saw it.";
  const w = checkRegister(worked);
  t('the worked example is caught', w.length > 0);
  t(
    'the worked example is MIXED, never a clean LEAK',
    w.every(h => h.verdict === 'MIXED')
  );
  t(
    'the worked example is caught by SCAN',
    w.some(h => h.family === 'SCAN')
  );

  const product =
    'We called the July steepener and this call survived by 5bp, which is the whole point of grading them in public.';
  t(
    'public call-grading is NOT flagged as a leak',
    !checkRegister(product).some(h => h.verdict === 'LEAK')
  );

  const leak = 'Our own scan never saw it until the wires had moved on.';
  const L = checkRegister(leak);
  t(
    'a bare backstage sentence IS a LEAK',
    L.some(h => h.verdict === 'LEAK')
  );

  const clean =
    'The Fed held rates and two governors dissented, which is the widest split since 2019.';
  t('ordinary reporting is silent', checkRegister(clean).length === 0);

  const firstPerson =
    'We think the tape is wrong about Atlassian and the guide is the tell.';
  t(
    'first person opinion is NOT process talk',
    checkRegister(firstPerson).length === 0
  );

  console.log(`\n${fail ? '✗' : '✓'} selftest ${pass}/${pass + fail} passed`);
  if (!fail) console.log('REGISTER-OK');
  return fail ? 1 : 0;
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) process.exit(selftest());
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('usage: register-gate.ts <file.md> [--strict] | --selftest');
  process.exit(2);
}
const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`file not found: ${abs}`);
  process.exit(2);
}
const hits = checkRegister(fs.readFileSync(abs, 'utf8'));
const leaks = hits.filter(h => h.verdict === 'LEAK');
const mixed = hits.filter(h => h.verdict === 'MIXED');
console.log(
  `REGISTER ${path.basename(abs)} — ${leaks.length} leak(s), ${mixed.length} mixed, ${sentences(fs.readFileSync(abs, 'utf8')).length} sentences read`
);
for (const h of [...leaks, ...mixed]) {
  console.log(
    `  [${h.verdict}] ${h.family} · matched ${JSON.stringify(h.match)}`
  );
  console.log(`      ${h.sentence}`);
}
if (!hits.length) console.log('  no process talk on the reader surface.');
else
  console.log(
    '\nFLAG, DO NOT STRIP. MIXED means the sentence carries call-grading too — the owner decides. Public call-grading stays; backstage machinery goes.'
  );
process.exit(args.includes('--strict') && leaks.length ? 1 : 0);
