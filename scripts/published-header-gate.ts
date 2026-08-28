/**
 * published-header-gate — blocks publish when a reader-surface brief's HEADER
 * does not parse into the four fields every downstream consumer reads.
 *
 * FAILURE CLASS (2026-08-08, live in the public feed for ~24h):
 * The Editor's `<!-- BRIEF VALIDATION REPORT ... -->` block was promoted into
 * content/daily-updates/2026-08-08.md, occupying lines 3-39. `parseDailyBrief`
 * only accepts an epigraph inside the first 5 lines (`i < 5`), so dailyTitle,
 * epigraph AND lede all came back "". Nothing errored. The consequences were
 * silent and plural:
 *   · the archive card rendered with no title and no blurb (1 of 161);
 *   · the homepage "HOW WE START MORNINGS" rail skipped the day entirely;
 *   · lib/audio/full-generate.ts saw an empty dailyTitle, fell through to its
 *     clickbait title generator, was handed raw markdown because lede was ALSO
 *     empty, and published a podcast episode titled "Brief: Tesla's stock
 *     crashes after shocking reveal" — for a brief in which `grep -ic tesla`
 *     returns 0. A FABRICATED HEADLINE at the point a listener first meets
 *     the product.
 *
 * WHY A NEW GATE, GIVEN reader-surface-gate ALREADY EXISTS:
 * reader-surface-gate is correct and exits 1 on this file. It was never wired
 * into the executor — scripts/publish-brief.py does not call it or
 * publish-gate.sh (verified 2026-08-09: `grep -n "publish-gate\|reader-surface"
 * scripts/publish-brief.py` → 0 hits). This gate is bound to the REAL PARSER
 * rather than to a re-implementation of the header shape, so it cannot drift
 * from the contract it protects: if the parser's rules change, this gate
 * changes with them. It is the paired TS half of the Python enforcement added
 * to publish-brief.py in the same pass (IMP-147).
 *
 * Usage:
 *   node --experimental-strip-types scripts/published-header-gate.ts <file.md>
 *   node --experimental-strip-types scripts/published-header-gate.ts --all
 *   node --experimental-strip-types scripts/published-header-gate.ts --selftest
 *
 * Exit: 0 clean · 1 header contract violated · 2 usage / selftest fail
 */
import fs from 'fs';
import path from 'path';
import { parseDailyBrief } from '../lib/daily-update-parser.ts';

export type HeaderFinding = { check: string; message: string };

/** The fields every reader surface (web, RSS, audio, email, Substack, X) reads. */
const REQUIRED_FIELDS = ['dailyTitle', 'epigraph', 'lede'] as const;

/**
 * The archive-regression leg applies the contract only to the era in which the
 * contract exists. RECEIPT (measured 2026-08-09, `--all` across 160 published
 * dailies): 44 briefs dated 2026-02-23 → 2026-04-10 predate the `### Daily
 * Title` line entirely — the masthead was "# THE DAILY BRIEF" and the header ran
 * epigraph → date → lede with no editorial headline, so an empty dailyTitle is
 * CORRECT for them. 2026-05-26 / 07-02 / 07-04 / 07-06 use the transitional
 * `**bold date**` + `#`/`##` title shape. From 2026-07-07 the modern contract
 * (masthead → italic epigraph → `## <Weekday, Month D, YYYY>` → `### <Title>`)
 * is uniform, and every failure inside it is a real defect: on this date the
 * only two were 08-08 (the fabricated-podcast-title incident) and 08-05 (same
 * class, epigraph lost to a `take-move` comment, live and unnoticed for 4 days).
 * Both were repaired in the IMP-147 pass. Raise this constant only with a
 * receipt; never to make a red leg green.
 */
const CONTRACT_ERA_START = '2026-07-07';

export function checkPublishedHeader(
  raw: string,
  dateSlug: string
): HeaderFinding[] {
  const out: HeaderFinding[] = [];

  // 1. Residual process markup anywhere in the header region is what causes the
  //    parse to fall through. Check it explicitly so the message names the cause,
  //    not just the symptom.
  const headerRegion = raw.split('\n').slice(0, 12).join('\n');
  if (/<!--/.test(headerRegion)) {
    const m = raw.match(/<!--[\s\S]{0,120}/);
    out.push({
      check: 'header-process-markup',
      message:
        'An HTML comment opens inside the header region (first 12 lines). ' +
        'The epigraph/title/lede parse window is the first 5 lines — a comment ' +
        'block here silently zeroes all three. Editor validation reports belong ' +
        `on daily-briefs/*-v2.md only. Match: ${JSON.stringify(
          (m?.[0] ?? '').replace(/\s+/g, ' ')
        )}`,
    });
  }

  // 2. The contract itself, asserted through the real consumer.
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = parseDailyBrief(raw, dateSlug) as unknown as Record<
      string,
      unknown
    >;
  } catch (err) {
    out.push({
      check: 'parser-threw',
      message: `parseDailyBrief threw on this file: ${String(err)}`,
    });
    return out;
  }

  for (const field of REQUIRED_FIELDS) {
    const v = String(parsed?.[field] ?? '').trim();
    if (!v) {
      out.push({
        check: `empty-${field}`,
        message:
          `parseDailyBrief returned an EMPTY ${field}. Downstream this is not ` +
          `an error, it is a silent fallback: the archive card loses its ` +
          `${field === 'dailyTitle' ? 'title' : field}, and an empty ` +
          `dailyTitle+lede routes the podcast episode title to an LLM ` +
          `clickbait generator fed raw markdown (see lib/audio/full-generate.ts).`,
      });
    }
  }

  return out;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function slugOf(file: string): string {
  const m = path.basename(file).match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? '';
}

function runFile(file: string): HeaderFinding[] {
  const raw = fs.readFileSync(file, 'utf8');
  return checkPublishedHeader(raw, slugOf(file));
}

function report(file: string, findings: HeaderFinding[]): void {
  if (findings.length === 0) {
    console.log(`✅ PUBLISHED-HEADER PASS — ${path.basename(file)}`);
    return;
  }
  console.log(
    `❌ PUBLISHED-HEADER FAIL — ${path.basename(file)} — ${findings.length} issue(s):`
  );
  for (const f of findings) console.log(`  [${f.check}] ${f.message}`);
}

const HEALTHY = `# MARKETS, MEDITATIONS & MENTAL MODELS

*An epigraph line that carries the day.*

## Saturday, August 8, 2026

### A Real Daily Title

*A lede paragraph that summarises the day and gives the reader the payoff.*

---

# ▸ THE SIX

## Markets & Macro

- **A bullet.** Body text.
`;

const BROKEN = `# MARKETS, MEDITATIONS & MENTAL MODELS

<!-- BRIEF VALIDATION REPORT — 2026-08-08-v2.md (EDITOR PASS)

MECHANICAL GATE OUTPUT (pasted, not asserted):
validate-brief.ts   EXIT=0 PASS
fact-gate.ts        EXIT=1 (5 unverified-critical)
assembly-gate.ts    EXIT=0 PASS
ceiling-lint.ts     EXIT=0 PASS
-->

*An epigraph line that carries the day.*

## Saturday, August 8, 2026

### A Real Daily Title

*A lede paragraph that summarises the day and gives the reader the payoff.*

---

# ▸ THE SIX

## Markets & Macro

- **A bullet.** Body text.
`;

function selftest(): number {
  let fail = 0;

  // Direction 1: the gate must FIRE on the real failure shape.
  const broken = checkPublishedHeader(BROKEN, '2026-08-08');
  const firedOnMarkup = broken.some(f => f.check === 'header-process-markup');
  const firedOnEmpty = broken.some(f => f.check.startsWith('empty-'));
  if (!firedOnMarkup || !firedOnEmpty) {
    console.log(
      `  ✗ FAIL: broken header produced ${broken.length} finding(s); ` +
        `expected both header-process-markup AND empty-* ` +
        `(markup=${firedOnMarkup}, empty=${firedOnEmpty})`
    );
    fail = 1;
  } else {
    console.log(
      `  ✓ fires on the 08-08 shape (${broken.length} findings: ${broken
        .map(f => f.check)
        .join(', ')})`
    );
  }

  // Direction 2: the gate must stay SILENT on a healthy header.
  const healthy = checkPublishedHeader(HEALTHY, '2026-08-08');
  if (healthy.length !== 0) {
    console.log(
      `  ✗ FAIL: healthy header produced ${healthy.length} finding(s): ` +
        healthy.map(f => f.check).join(', ')
    );
    fail = 1;
  } else {
    console.log('  ✓ silent on a healthy header');
  }

  // Direction 3: regression against the real archive. Every published daily
  // brief on disk must satisfy the contract. This is the leg that catches a
  // parser change drifting away from the shape publish-brief.py enforces.
  const dir = path.join(process.cwd(), 'content/daily-updates');
  let checked = 0;
  const bad: string[] = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(f)) continue; // dailies only, not -light/-factcheck
      if (f.slice(0, 10) < CONTRACT_ERA_START) continue; // see CONTRACT_ERA_START receipt
      checked++;
      if (runFile(path.join(dir, f)).length > 0) bad.push(f);
    }
  }
  if (bad.length > 0) {
    console.log(
      `  ✗ FAIL: ${bad.length}/${checked} published dailies violate the header contract: ${bad
        .slice(0, 8)
        .join(', ')}${bad.length > 8 ? ' …' : ''}`
    );
    fail = 1;
  } else {
    console.log(
      `  ✓ all ${checked} published dailies since ${CONTRACT_ERA_START} satisfy the contract`
    );
  }

  console.log(
    fail === 0
      ? '✅ published-header-gate SELFTEST PASS'
      : '❌ published-header-gate SELFTEST FAIL'
  );
  return fail;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'usage: published-header-gate.ts <file.md> | --all | --selftest'
    );
    process.exit(2);
  }

  if (args[0] === '--selftest') process.exit(selftest() === 0 ? 0 : 2);

  if (args[0] === '--all') {
    const dir = path.join(process.cwd(), 'content/daily-updates');
    let fail = 0;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(f)) continue;
      const full = path.join(dir, f);
      const findings = runFile(full);
      if (findings.length > 0) {
        report(full, findings);
        fail = 1;
      }
    }
    if (fail === 0) console.log('✅ PUBLISHED-HEADER PASS — all dailies');
    process.exit(fail);
  }

  const findings = runFile(args[0]!);
  report(args[0]!, findings);
  process.exit(findings.length > 0 ? 1 : 0);
}

const invoked = process.argv[1] ?? '';
if (invoked.includes('published-header-gate')) main();
