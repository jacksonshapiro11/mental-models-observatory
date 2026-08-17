#!/usr/bin/env -S node --experimental-strip-types
/**
 * latest-brief-parity-gate.ts — does the UNDATED route resolve to today's edition?
 * (added 2026-08-15 — IMP-178, RC5. Source: the 2026-08-15 verify-brief-publish FAIL.)
 *
 * ─── WHAT HAPPENED ────────────────────────────────────────────────────────────
 * On the morning of 2026-08-15 the site's `/daily-update` route — the "Full Brief" link in the nav
 * on EVERY page and the homepage's primary CTA — served **edition 2026-07-04**, six weeks stale.
 * Not an appearance: the page's own footer read "Edition 2026-07-04" and its share/email links were
 * hard-coded to /daily-update/2026-07-04, so the route RESOLVED to July. Meanwhile
 * /daily-update/2026-08-15 rendered the day's brief correctly and in full, /super-brief resolved
 * correctly, the homepage carried the 8/15 lede, and EVERY EXISTING CHECK PASSED GREEN.
 *
 * The gap the incident exposed: **nothing in the system asserts that the UNDATED routes render
 * today's edition.** Every gate we own verifies the DATED artifact — the file, its bytes, its
 * publication to origin/main — and is structurally blind to the URL readers actually click.
 *
 * ─── WHAT THIS GATE DOES AND DOES NOT PROVE ───────────────────────────────────
 * 🔴 READ THIS BEFORE TRUSTING A GREEN RUN. This gate checks the RESOLUTION LAYER — the pure
 * filesystem logic behind the undated routes — on the local tree. It does NOT and CANNOT check the
 * DEPLOYED RENDER: cosmictrex.com is not on the sandbox egress allowlist (CONNECT → 403,
 * X-Proxy-Error: blocked-by-allowlist), so no local session can fetch the page a reader sees.
 *
 * The 08-15 incident had two candidate causes with opposite fixes: (a) a stale CDN/edge response,
 * which remains the best-supported reading — `app/daily-update/page.tsx` is force-dynamic, the
 * deployed filesystem was provably current, and /super-brief shares the identical shape and was
 * correct; or (b) a resolution bug. **This gate closes (b) and is blind to (a).** A green run here
 * is not a statement about what the reader is being served. Closing (a) needs an egress allowlist
 * entry or an off-sandbox probe, and that is an owner decision — filed as ESC-017.
 *
 * What it did find, on the way: `getLatestBrief()` filtered `.md && !-light` while
 * `getAllBriefDates()` filtered `/^\d{4}-\d{2}-\d{2}\.md$/`, and getLatestBrief's own comment
 * claimed the two were in parity. Any stray .md in content/daily-updates that sorted high would
 * have become "Today's Daily Brief" — and uppercase filenames sort ABOVE digits, so a README.md
 * dropped in that directory would have taken the site's primary CTA outright. That asymmetry is now
 * fixed in lib/daily-update-parser.ts and this gate keeps it fixed.
 *
 * Usage:
 *   node --experimental-strip-types scripts/latest-brief-parity-gate.ts            # check the tree
 *   node --experimental-strip-types scripts/latest-brief-parity-gate.ts --selftest # both directions
 *   node --experimental-strip-types scripts/latest-brief-parity-gate.ts --date 2026-08-15
 *
 * Exit codes: 0 pass · 1 fail · 2 usage. Warn-level in pipeline-health-check; never blocks a brief.
 */
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates');
const DATE_MD = /^\d{4}-\d{2}-\d{2}\.md$/;

export interface ParityFinding {
  check: string;
  message: string;
}

/** The strict resolver — what getAllBriefDates() answers. */
export function strictLatest(files: string[]): string | null {
  const d = files.filter(f => DATE_MD.test(f)).sort().reverse();
  return d[0] ? d[0]!.replace('.md', '') : null;
}

/** The historical loose resolver — what getLatestBrief() used to answer. Kept so the selftest can
 *  prove the divergence is real rather than asserting it. */
export function looseLatest(files: string[]): string | null {
  const d = files
    .filter(f => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();
  return d[0] ? d[0]!.replace('.md', '') : null;
}

/**
 * The parity contract, evaluated over a filename list so it is testable without touching disk.
 * `today` is optional: when the tree contains an edition for that date, the undated route MUST
 * resolve to it — that is the reader-facing question the 08-15 incident asked.
 */
export function checkParity(files: string[], today?: string): ParityFinding[] {
  const out: ParityFinding[] = [];
  const strict = strictLatest(files);
  const loose = looseLatest(files);

  if (strict === null) {
    out.push({
      check: 'latest-brief-empty',
      message:
        'NO DATE-SHAPED BRIEF FOUND in content/daily-updates — the undated /daily-update route has nothing to resolve to and will render the "No briefs yet" empty state.',
    });
    return out;
  }

  if (loose !== strict) {
    const winner = files
      .filter(f => f.endsWith('.md') && !f.includes('-light'))
      .sort()
      .reverse()[0];
    out.push({
      check: 'latest-brief-resolver-divergence',
      message:
        `RESOLVER DIVERGENCE — a loose filter would resolve the undated route to "${loose}" (file: ${winner}) while the ` +
        `strict date filter resolves to "${strict}". A non-date .md file in content/daily-updates can take the site's ` +
        `primary "Full Brief" link. Remove the stray file, or move it out of the content directory.`,
    });
  }

  if (today && files.includes(`${today}.md`) && strict !== today) {
    out.push({
      check: 'latest-brief-not-today',
      message:
        `UNDATED ROUTE WOULD NOT SERVE TODAY — content/daily-updates/${today}.md exists, but the undated route ` +
        `resolves to "${strict}". This is the 2026-08-15 shape: the dated artifact is perfect and the URL readers ` +
        `actually click serves an older edition.`,
    });
  }

  return out;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };

  const real = fs.existsSync(CONTENT_DIR) ? fs.readdirSync(CONTENT_DIR) : [];

  // ── SILENT on the real, healthy tree. ──
  t(
    real.length > 0 && checkParity(real).length === 0,
    `SILENT on the real content directory (${real.filter(f => DATE_MD.test(f)).length} dated editions, newest ${strictLatest(real)})`
  );
  t(
    strictLatest(real) === looseLatest(real),
    'SILENT: strict and loose agree on the tree as it stands today — the divergence below is constructed, not currently live'
  );

  // ── FIRES on the exact stray-file shape the loose filter admitted. ──
  // README.md is the sharp case: 'R' (0x52) sorts ABOVE '2' (0x32), so it wins outright.
  const withReadme = [...real, 'README.md'];
  t(
    looseLatest(withReadme) === 'README' && strictLatest(withReadme) === strictLatest(real),
    'THE DIVERGENCE IS REAL: with a README.md present the loose filter resolves to "README" while the strict filter is unmoved — uppercase sorts above digits'
  );
  t(
    checkParity(withReadme).some(f => f.check === 'latest-brief-resolver-divergence'),
    'FIRES: a stray README.md in content/daily-updates is caught as a resolver divergence'
  );
  // MEASURED, NOT ASSUMED: a "-old.md" suffix sorts BELOW "2026-08-15.md" ('-' 0x2D < '.' 0x2E), so
  // it never wins and this gate does not claim to catch it. What DOES win is anything sorting above
  // a digit — every lowercase filename, and any future-dated draft. Both are realistic here: drafts
  // in this pipeline are routinely dated tomorrow.
  // THE FIXTURE DATE IS DERIVED, NEVER HARDCODED (fixed 2026-08-17 — IMP-185, RC2).
  // This leg was written as `'2026-08-16-draft.md'`, which was future-dated ON THE DAY IT WAS
  // WRITTEN and therefore won the loose resolver. Then 2026-08-17.md published, the fixture stopped
  // sorting above the newest edition, the divergence it constructed evaporated, and the assertion
  // red-failed IMP-178 and ESC-017 — a gate reporting itself broken because the calendar moved, not
  // because anything regressed. A fixture that encodes "later than the tree" as a literal has a
  // shelf life; deriving it from the tree's own newest edition cannot expire.
  const dayAfter = (d: string): string => {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  };
  const newest = strictLatest(real); // e.g. '2026-08-17'
  const futureDraft = `${dayAfter(newest)}-draft.md`; // always sorts above `newest`.md
  const belowSuffix = `${newest}-old.md`; // '-' (0x2D) < '.' (0x2E) → always sorts below
  // Split into named legs: an ANDed assertion that fails tells you nothing about WHICH shape broke.
  t(
    checkParity([...real, 'index.md']).some(
      f => f.check === 'latest-brief-resolver-divergence'
    ),
    'FIRES on a lowercase "index.md" — every lowercase name sorts above a digit and wins'
  );
  t(
    checkParity([...real, futureDraft]).some(
      f => f.check === 'latest-brief-resolver-divergence'
    ),
    `FIRES on a future-dated draft ("${futureDraft}", derived from the tree's newest edition — drafts here are routinely dated tomorrow)`
  );
  t(
    looseLatest([...real, belowSuffix]) === strictLatest(real),
    `correctly does NOT claim to catch "${belowSuffix}", which sorts below and never wins`
  );

  // ── The 08-15 shape, reconstructed: today's edition exists but the route resolves elsewhere. ──
  t(
    checkParity(['2026-07-04.md', '2026-08-15.md'], '2026-08-15').length === 0,
    'SILENT: today\'s edition present AND newest — the healthy case'
  );
  t(
    checkParity(['2026-07-04.md'], '2026-08-15').length === 0,
    'SILENT: no edition for today (a weekend or an unpublished day) is NOT a failure — this gate never manufactures a red for a day that has no brief'
  );

  // ── The live tree, against today. ──
  const today = new Date().toISOString().slice(0, 10);
  t(
    checkParity(real, today).every(f => f.check !== 'latest-brief-not-today'),
    `SILENT on the live tree for ${today} (either today's edition is the newest, or there is none)`
  );

  console.log(`\nlatest-brief-parity-gate selftest — ${11 - fails}/11 assertions passed`);
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ verified in BOTH directions on the real content directory.\n' +
      '  SCOPE REMINDER: this proves RESOLUTION, not the DEPLOYED RENDER (see header; ESC-017).'
  );
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`latest-brief-parity-gate — content dir not found: ${CONTENT_DIR}`);
    return 2;
  }
  const di = args.indexOf('--date');
  const today =
    di > -1 && args[di + 1] ? args[di + 1]! : new Date().toISOString().slice(0, 10);
  const files = fs.readdirSync(CONTENT_DIR);
  const findings = checkParity(files, today);

  console.log(
    `latest-brief-parity-gate — undated route resolves to "${strictLatest(files)}" · checked against ${today}`
  );
  for (const f of findings) console.error(`  ✗ [${f.check}] ${f.message}`);
  if (findings.length) {
    console.error(
      `\n❌ LATEST-BRIEF PARITY FAIL — ${findings.length} finding(s). The undated /daily-update route is the site's primary Full Brief link.`
    );
    return 1;
  }
  console.log(
    '\n✅ LATEST-BRIEF PARITY PASS — the undated route resolves to the newest dated edition.\n' +
      '   SCOPE: resolution only. This gate cannot see the deployed render (egress-blocked); see ESC-017.'
  );
  return 0;
}

if (/latest-brief-parity-gate\.ts$/.test(process.argv[1] ?? '')) process.exit(main());
