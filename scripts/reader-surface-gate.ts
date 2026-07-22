/**
 * reader-surface-gate — blocks publish when the READER artifact still carries
 * process/meta markup that belongs only on the Editor/v2 artifact.
 *
 * Failure class (2026-07-21): `<!-- INNER-GAME-FIGURE-FIRST: ... -->` shipped in
 * content/daily-updates because Format Brief was skipped AND format_brief.py
 * never stripped HTML comments anyway. validate-brief's checkInternalTagLeak
 * runs on stripComments(body), so it is blind to the leak. Viewer/parser
 * defense-in-depth hides it on the web; RSS/raw/audio/email still see it.
 *
 * Contract: content/daily-updates/** is the reader surface. Residual HTML
 * comments and [EDITOR:]/[CRITIC:] tags are floor failures here. Sidecar
 * declarations (FIGURE-FIRST, COMPOUNDING, STALENESS LEDGER) live on
 * daily-briefs/*-v2.md only.
 *
 * Usage:
 *   node --experimental-strip-types scripts/reader-surface-gate.ts <file.md>
 *   node --experimental-strip-types scripts/reader-surface-gate.ts --selftest
 *
 * Exit: 0 clean · 1 residual meta · 2 usage / selftest fail
 */
import fs from 'fs';
import path from 'path';

export type Finding = { check: string; message: string };

const BRACKET_TAGS: { name: string; re: RegExp }[] = [
  { name: 'EDITOR tag', re: /\[EDITOR:[^\]]*\]/ },
  { name: 'CRITIC tag', re: /\[CRITIC:[^\]]*\]/ },
  { name: 'QA tag', re: /\[QA:[^\]]*\]/ },
  { name: 'INTERNAL tag', re: /\[INTERNAL:[^\]]*\]/ },
  { name: 'VERIFIED tag', re: /\[VERIFIED:[^\]]*\]/ },
  { name: 'PAYOFF placeholder', re: /\[PAYOFF[^\]]*\]/i },
];

export function checkReaderSurface(raw: string): Finding[] {
  const out: Finding[] = [];
  const comment = raw.match(/<!--[\s\S]*?-->/);
  if (comment) {
    const preview = comment[0].replace(/\s+/g, ' ').slice(0, 120);
    out.push({
      check: 'residual-html-comment',
      message: `Reader artifact still contains an HTML comment (process/meta must stay on daily-briefs v2, never content/daily-updates). Match: ${JSON.stringify(preview)}`,
    });
  }
  for (const t of BRACKET_TAGS) {
    const m = raw.match(t.re);
    if (m) {
      out.push({
        check: 'residual-internal-tag',
        message: `${t.name} present on reader surface. Strip before publish. Match: ${JSON.stringify(m[0].slice(0, 120))}`,
      });
    }
  }
  return out;
}

function selftest(): number {
  let fail = 0;
  const assert = (name: string, cond: boolean) => {
    console.log(`  ${cond ? '✓' : '✗'} ${name}`);
    if (!cond) fail++;
  };

  const leak = `# ▸ INNER GAME\n\n<!-- INNER-GAME-FIGURE-FIRST: no verifiable quote -->\n\nMusonius argued...\n`;
  const clean = `# ▸ INNER GAME\n\nMusonius argued...\n`;
  const editor = `# ▸ THE TAKE\n\n[EDITOR: tighten this]\n\nBody.\n`;

  assert('FAILS on FIGURE-FIRST HTML comment (07-21 class)', checkReaderSurface(leak).some((f) => f.check === 'residual-html-comment'));
  assert('SILENT on clean Inner Game', checkReaderSurface(clean).length === 0);
  assert('FAILS on [EDITOR:] tag', checkReaderSurface(editor).some((f) => f.check === 'residual-internal-tag'));

  // Real artifact if present
  const real = path.join(process.cwd(), 'content/daily-updates/2026-07-21.md');
  if (fs.existsSync(real)) {
    const body = fs.readFileSync(real, 'utf8');
    const findings = checkReaderSurface(body);
    const hasComment = /<!--/.test(body);
    if (hasComment) {
      assert('FAILS on real 2026-07-21 while comment present', findings.some((f) => f.check === 'residual-html-comment'));
    } else {
      assert('SILENT on real 2026-07-21 after comment stripped', findings.length === 0);
    }
  }

  const healthy = path.join(process.cwd(), 'content/daily-updates/2026-07-22.md');
  if (fs.existsSync(healthy)) {
    assert('SILENT on real 2026-07-22', checkReaderSurface(fs.readFileSync(healthy, 'utf8')).length === 0);
  }

  console.log(fail === 0 ? '\n✅ reader-surface-gate selftest PASS' : `\n❌ reader-surface-gate selftest FAIL (${fail})`);
  return fail === 0 ? 0 : 1;
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) {
  process.exit(selftest());
}

const file = args[0];
if (!file) {
  console.error('usage: reader-surface-gate.ts <file.md> | --selftest');
  process.exit(2);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`file not found: ${abs}`);
  process.exit(2);
}

const findings = checkReaderSurface(fs.readFileSync(abs, 'utf8'));
if (findings.length === 0) {
  console.log(`✅ READER-SURFACE PASS — ${path.basename(abs)}`);
  process.exit(0);
}

console.log(`❌ READER-SURFACE FAIL — ${path.basename(abs)} — ${findings.length} issue(s):`);
for (const f of findings) console.log(`  [${f.check}] ${f.message}`);
console.log('\nStrip residual meta (HTML comments / internal tags) before publishing to content/daily-updates/. Gate declarations belong on daily-briefs/*-v2.md only.');
process.exit(1);
