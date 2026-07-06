#!/usr/bin/env node --experimental-strip-types
/**
 * quality-gate-timestamp.ts — the STALE-ARTIFACT gate (closes ESC-002 / E-QG-BYPASS-01).
 *
 * The failure (2026-07-04, recurred twice): the Critic evaluated a STALE intermediate —
 * an older v2 — twice, because the OWED-EDITOR GUARD lived only in prose and never fired.
 * When the artifact the Critic ingests is OLDER than the latest quality-gate output, the
 * Critic is grading a superseded draft and every downstream verdict is wrong, silently.
 *
 * This gate makes that condition an EXIT CODE instead of a paragraph. Healthy =
 * critic-input mtime >= reference (quality-gate log) mtime. Stale = input older than the
 * reference, i.e. the ingest predates the newest gate result.
 *
 * Ships-first posture (Jackson, 2026-07-06: "the brief should always be shipped"): DEFAULT
 * is advisory — it prints a loud STALE finding and exits 0, so it can be wired into the
 * Critic's ingest as a WARN + self-heal (re-point at the fresh artifact) without ever
 * blocking publication. Pass --strict to make stale a hard exit 1 where fail-closed is wanted.
 *
 * Usage:
 *   quality-gate-timestamp.ts --artifact <critic-input> --reference <qg-log> [--strict]
 *   quality-gate-timestamp.ts --selftest        # proves both directions; exit 0 iff correct
 *
 * Exit: 0 fresh / advisory-stale / selftest-ok · 1 stale+--strict or selftest-fail · 2 usage
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface Verdict { stale: boolean; artifactMs: number; referenceMs: number; }

function evaluate(artifactPath: string, referencePath: string): Verdict {
  const artifactMs = fs.statSync(artifactPath).mtimeMs;
  const referenceMs = fs.statSync(referencePath).mtimeMs;
  return { stale: artifactMs < referenceMs, artifactMs, referenceMs };
}

// Proves the gate BITES on the stale case AND stays SILENT on the fresh case (Doctrine move 5).
function selftest(): number {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-ts-'));
  const art = path.join(dir, 'critic-input.md');
  const ref = path.join(dir, 'quality-gate.log');
  fs.writeFileSync(art, 'critic input'); fs.writeFileSync(ref, 'qg log');
  const now = Date.now() / 1000, older = now - 120, newer = now;

  // HEALTHY: input newer than reference => not stale.
  fs.utimesSync(ref, older, older); fs.utimesSync(art, newer, newer);
  const healthy = evaluate(art, ref);

  // FAILURE (the ESC-002 bug): input older than reference => stale.
  fs.utimesSync(ref, newer, newer); fs.utimesSync(art, older, older);
  const failure = evaluate(art, ref);

  fs.rmSync(dir, { recursive: true, force: true });

  const ok = healthy.stale === false && failure.stale === true;
  console.log('quality-gate-timestamp --selftest');
  console.log(`  healthy case (input newer): stale=${healthy.stale} (expect false) ${healthy.stale === false ? '✓' : '✗'}`);
  console.log(`  failure case (input older): stale=${failure.stale} (expect true)  ${failure.stale === true ? '✓' : '✗'}`);
  if (ok) { console.log('\n✅ SELFTEST PASS — gate bites on the stale case AND stays silent on the fresh case.'); return 0; }
  console.error('\n❌ SELFTEST FAIL — the stale-artifact gate is not discriminating correctly.'); return 1;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();
  const strict = argv.includes('--strict');
  const get = (flag: string): string | undefined => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : undefined; };
  const artifact = get('--artifact');
  const reference = get('--reference');
  if (!artifact || !reference) {
    console.error('Usage: quality-gate-timestamp.ts --artifact <critic-input> --reference <qg-log> [--strict] | --selftest');
    return 2;
  }
  for (const p of [artifact, reference]) {
    if (!fs.existsSync(p)) { console.error(`quality-gate-timestamp: file not found: ${p}`); return 2; }
  }
  const v = evaluate(artifact, reference);
  const fmt = (ms: number) => new Date(ms).toISOString();
  console.log('quality-gate-timestamp');
  console.log(`  artifact  (critic input): ${artifact}  @ ${fmt(v.artifactMs)}`);
  console.log(`  reference (quality gate): ${reference}  @ ${fmt(v.referenceMs)}`);
  if (!v.stale) { console.log('\n✅ FRESH — critic input is at least as new as the latest quality-gate output.'); return 0; }
  const drift = Math.round((v.referenceMs - v.artifactMs) / 1000);
  const msg = `STALE ARTIFACT — critic input predates the latest quality-gate output by ${drift}s. The Critic would grade a superseded draft (E-QG-BYPASS-01). Re-point the Critic at the freshest artifact before evaluating.`;
  if (strict) { console.error(`\n❌ ${msg}`); return 1; }
  console.log(`\n⚠ ${msg}\n(advisory: exit 0 so the brief still ships — wire as WARN + self-heal; use --strict to fail closed.)`);
  return 0;
}

process.exit(main());
