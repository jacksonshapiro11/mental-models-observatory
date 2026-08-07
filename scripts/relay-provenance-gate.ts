#!/usr/bin/env node --experimental-strip-types
/**
 * relay-provenance-gate.ts — A TWEET IS A LEAD, NOT A CAPTURE (IMP-133, 2026-08-05, RC2 + RC3).
 *
 * THE FAILURE THIS EXISTS TO KILL. On 2026-08-05 a top-slot bullet (M&M-2) carried three
 * load-bearing figures from a US Census construction release whose ONLY provenance was a tweet:
 * `SOURCE: US Census construction spending release, Aug 4, surfaced by @JosephPolitano`. Three of
 * those figures would not reconcile against independent reads, and one of them — office construction
 * "at its lowest level since 2011, down nearly 60 percent" — was flatly false: Census files DATA
 * CENTERS inside its Office category, so the printed Office series is at a RECORD, and only
 * office-ex-data-center is down (-11.4% y/y). Nothing in the chain flagged it: not the Critic, not
 * a gate. It was caught by hand hours before publish.
 *
 * This was the FOURTH CONSECUTIVE DAY a priority macro release reached the brief by tweet because
 * the agency fetch fails. The intel sweep itself proposed the rule two days earlier — "a tweet citing
 * a named executive, agency, or primary document is a LEAD, not a capture" — and it was never wired
 * in. Four days of identical failure is a roster problem, not a retrieval problem.
 *
 * THE RULE (system/Intelligence_Processor.md — THE LEAD RULE): a social relay of an AGENCY release
 * is a LEAD. It may not stand as the capture. Either the entry carries the agency's own URL, or the
 * figure is labelled RELAY-UNCONFIRMED and may not carry a top-slot bullet's load.
 *
 * WHAT FIRES: a provenance line that (a) names a statistical agency or one of its releases, AND
 * (b) credits a social handle, AND (c) carries no agency URL. All three, or it stays silent.
 * The 08-05 JOLTS line — `SOURCE: BLS JOLTS release 10:00 AM ET, archived at
 * bls.gov/news.release/archives/jolts_08042026.htm` — has the URL and is silent. The AMD line
 * (ir.amd.com) names no agency and is silent. A crypto-data relay (@WuBlockchain on DEX volume)
 * names no agency and is silent: this gate is scoped to official statistics, where a relay error is
 * unrecoverable because the reader cannot tell a transcription slip from a taxonomy trap.
 *
 * Usage:
 *   node --experimental-strip-types scripts/relay-provenance-gate.ts YYYY-MM-DD [--brief <path>]
 *   node --experimental-strip-types scripts/relay-provenance-gate.ts --selftest
 *   node --experimental-strip-types scripts/relay-provenance-gate.ts --sweep [N]
 * Exit: 0 clean · 1 relay-only agency provenance found · 2 usage / no brief.
 * Wired into: system/Intelligence_Processor.md (THE LEAD RULE), system/SOURCE_NETWORK.md
 * (Census C30 + BLS JOLTS registered with a working fetch method), system/Brief_Validator.md.
 */
import * as fs from 'fs';

/** Statistical agencies and their releases. A relay error here is unrecoverable for the reader. */
export const AGENCY =
  /\b(?:BLS|Bureau of Labor Statistics|BEA|Bureau of Economic Analysis|Census(?:\s+Bureau)?|Federal Reserve|FOMC|the Fed\b|US Treasury|Treasury Department|EIA|Energy Information Administration|CBO|JOLTS|CPI|PPI|PCE|nonfarm payrolls|payroll report|construction spending|factory orders|retail sales report)\b/i;

/** A social relay: a handle, or an explicit relay verb pointing at one. */
export const HANDLE = /(?:^|[\s(,])@[A-Za-z0-9_]{2,}\b|\b(?:surfaced by|relayed by|relaying|carried by|via|per)\s+@[A-Za-z0-9_]{2,}/i;

/** The agency's own address. Any .gov URL, or a bare agency domain. */
export const AGENCY_URL =
  /\b(?:https?:\/\/)?(?:www\.)?(?:bls|bea|census|federalreserve|treasury|eia|cbo|whitehouse|sec|opec)\.(?:gov|org)\b|\bhttps?:\/\/[^\s|]*\.gov\b/i;

export interface RelayHit { line: number; text: string; agency: string; handle: string }

/**
 * Provenance lines are the intel-manifest `SOURCE:` entries carried in v1/v1.5/v2. They live inside
 * an HTML comment block, so this gate deliberately does NOT strip comments — the manifest is the
 * evidence, and stripping it is how a provenance check ends up checking nothing.
 */
export function findRelayOnly(md: string): RelayHit[] {
  const out: RelayHit[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!/\bSOURCE:/i.test(l)) continue;
    // Evaluate only the SOURCE clause, not the EVIDENCE prose that follows it — an EVIDENCE note
    // may legitimately mention a handle while the capture itself is the agency's own release.
    const clause = (l.split(/\bSOURCE:/i)[1] ?? '').split(/\|\s*EVIDENCE:/i)[0] ?? '';
    if (!AGENCY.test(clause)) continue;
    if (!HANDLE.test(clause)) continue;
    if (AGENCY_URL.test(clause)) continue;
    out.push({
      line: i + 1,
      text: clause.trim().slice(0, 180),
      agency: (clause.match(AGENCY) ?? [''])[0],
      handle: (clause.match(/@[A-Za-z0-9_]{2,}/) ?? [''])[0],
    });
  }
  return out;
}

function resolveBrief(date: string, explicit?: string): string | null {
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  for (const p of [`daily-briefs/${date}-v2.md`, `daily-briefs/${date}-v1.5.md`, `daily-briefs/${date}-v1-pre-quality-gate.md`, `content/daily-updates/${date}.md`]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function runOne(date: string, explicit?: string, quiet = false): number {
  const bp = resolveBrief(date, explicit);
  if (!bp) { if (!quiet) console.error(`relay-provenance-gate: no brief found for ${date}`); return 2; }
  const hits = findRelayOnly(fs.readFileSync(bp, 'utf8'));
  if (!quiet) {
    console.log(`relay-provenance-gate ${date} — ${bp}`);
    if (hits.length === 0) console.log('  ✓ no agency figure rests on a social relay alone.');
    for (const h of hits) {
      console.log(`  ✗ L${h.line}: ${h.agency} release credited to ${h.handle} with NO agency URL — this is a LEAD, not a capture.`);
      console.log(`      ${h.text}`);
      console.log(`      FIX: fetch the agency release itself and put its URL in the SOURCE clause, or label every figure from it RELAY-UNCONFIRMED and keep it out of a top slot.`);
    }
  }
  return hits.length ? 1 : 0;
}

function sweep(n: number): number {
  const dir = 'daily-briefs';
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f)).sort().slice(-n);
  let hit = 0;
  for (const f of files) {
    const d = f.replace('-v2.md', '');
    if (runOne(d, undefined, true) === 1) { hit++; runOne(d); }
  }
  console.log(`\nSWEEP — ${hit} of ${files.length} briefs carry at least one relay-only agency figure.`);
  return 0;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) fails++; };

  const censusRelay = '- One Census release, three construction series | CLASSIFICATION: NEW | SOURCE: US Census construction spending release, Aug 4, surfaced by @JosephPolitano | EVIDENCE: release published Aug 4.';
  const jolts = '- JOLTS miss | SOURCE: BLS JOLTS release 10:00 AM ET, archived at bls.gov/news.release/archives/jolts_08042026.htm | EVIDENCE: BLS release Aug 4.';
  const amd = '- AMD cash conversion | SOURCE: ir.amd.com Q2 2026 release, 4:15 PM ET Aug 4 | EVIDENCE: primary release read in full.';
  const crypto = '- Hyperliquid gained share | SOURCE: @WuBlockchain relaying July DEX perpetuals volume, Aug 4 | EVIDENCE: SINGLE-SOURCE RELAY, flagged.';

  t(findRelayOnly(censusRelay).length === 1, 'FIRES on the real 08-05 Census line (agency + handle, no agency URL)');
  t(findRelayOnly(jolts).length === 0, 'SILENT on the same brief\'s JOLTS line (carries bls.gov)');
  t(findRelayOnly(amd).length === 0, 'SILENT on AMD (ir.amd.com — a company, not an agency)');
  t(findRelayOnly(crypto).length === 0, 'SILENT on a crypto-data relay (no agency named)');
  t(findRelayOnly(censusRelay + '\n' + jolts + '\n' + amd + '\n' + crypto).length === 1, 'exactly one hit across all four real lines together');
  t(findRelayOnly('- x | SOURCE: US Census release via @someone, see census.gov/construction/c30/current/index.html | EVIDENCE: y').length === 0,
    'an agency URL in the SOURCE clause clears the relay');
  t(findRelayOnly('- x | SOURCE: Census construction spending release, Aug 4 | EVIDENCE: relayed to us by @JosephPolitano').length === 0,
    'a handle in EVIDENCE prose does not condemn an agency-sourced capture');
  t(findRelayOnly('Some body prose mentioning @JosephPolitano and the Census release.').length === 0,
    'body prose without a SOURCE: clause is not provenance');
  t(findRelayOnly('- x | SOURCE: BEA personal income release, flagged by @econ_guy | EVIDENCE: z').length === 1,
    'generalises past Census — BEA relay also fires');

  console.log(`\nrelay-provenance-gate selftest — ${9 - fails}/9 assertions passed`);
  if (fails) { console.error('❌ SELFTEST FAIL'); return 1; }
  console.log('✅ SELFTEST PASS — a relayed agency release is a LEAD; only the agency\'s own address makes it a capture.');
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) process.exit(selftest());
else if (argv.includes('--sweep')) {
  const n = Number(argv[argv.indexOf('--sweep') + 1]);
  process.exit(sweep(Number.isFinite(n) && n > 0 ? n : 30));
} else {
  const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) { console.error('usage: relay-provenance-gate.ts YYYY-MM-DD [--brief <path>] | --selftest | --sweep [N]'); process.exit(2); }
  const bi = argv.indexOf('--brief');
  process.exit(runOne(date, bi >= 0 ? argv[bi + 1] : undefined));
}
