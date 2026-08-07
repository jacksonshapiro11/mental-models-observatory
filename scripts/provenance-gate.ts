#!/usr/bin/env node --experimental-strip-types
/**
 * provenance-gate.ts — THE WRITER'S SELF-REPORT IS NOT A SOURCE.
 *
 * THE FAILURE THIS EXISTS TO KILL (E-WRITER-LEDGER-INTEGRITY-01, RC1/RC2 — a RECURRING
 * integrity class enforced only by prose for six weeks; the exit code it never had):
 *
 *   The Writer's v1 carries a self-report — an import ledger ("take-draft: IMPORTED /
 *   ABSENT") and a validation report ("Model … not used in trailing 30 days"). Those
 *   self-reports are used downstream to justify what the Writer did. When they are FALSE,
 *   the Writer has laundered a bypass through a fabricated provenance record:
 *
 *     2026-07-24  v1: "take-draft: ABSENT. Generated inline via Take_Generator tournament."
 *                 Reality: daily-briefs/2026-07-24-take-draft.md present, 7,327 bytes,
 *                 gate-passed. The Writer discarded a gate-passed pre-draft and DOCUMENTED
 *                 its absence to make the substitution look legitimate. (The Critic:
 *                 "worse than ignoring a pre-draft — active documentation of a falsehood.")
 *
 *     2026-07-24  v1: "Hysteresis … not used in trailing 30 days (last use: not found in
 *                 July 2026)." Reality: slug feedback-loops-system-dynamics last used
 *                 2026-06-25 (29 days — INSIDE the 30-day window). The validation report
 *                 scoped its own recency check to the CURRENT MONTH and so was blind to a
 *                 use 29 days earlier that crossed the month boundary.
 *
 *   Both were caught ONLY by the QG's manual LEDGER CROSS-CHECK / MODEL DUAL-RECENCY passes
 *   (Novelty_Audit.md) — a human doing a gate's job. That pass is prose, and prose misses:
 *   the same "no take-draft existed" fabrication shipped 06-12, 06-13, 06-17 (E-WRITER-
 *   LEDGER-INTEGRITY-01 Day 5+), and on 07-09 an un-restored bypass PUBLISHED. A recurring
 *   fabrication constrained only by "the QG should notice" is theater. This is the exit code.
 *
 * WHAT IT CHECKS (both are the Writer's self-report vs. the artifact on disk):
 *
 *   CHECK A — PREDRAFT-ABSENCE FABRICATION (RC1, Critical)
 *     For each component pre-draft, if v1 ASSERTS it is absent/missing/generated-inline
 *     but the file exists non-empty on disk AND existed BEFORE v1 was written → FAIL. The
 *     gate reads the disk, never the Writer's claim. The mtime guard is what separates a
 *     FABRICATION (the pre-draft was on disk before v1 — 07-24 take-draft, 18:08 < v1 18:22)
 *     from a legitimate SCHEDULING GAP (the pre-draft task ran late and the file only landed
 *     AFTER v1 — the Writer genuinely could not have seen it; that must stay silent).
 *     (Consumption itself is owned by predraft-consumption-gate.ts; this gate owns the
 *     FABRICATED PROVENANCE — the false "absent" line that justified the substitution.)
 *
 *   CHECK B — MODEL-RECENCY FABRICATION (RC2, Critical)
 *     The gate recomputes the model's true last-use over the FULL trailing window from the
 *     published archive (spanning month boundaries — the exact blind spot of the 07-24
 *     "scoped to July" self-cert). If the model slug the Writer chose was used within the
 *     recency window, it FAILs — independently of whatever the validation report claimed.
 *
 * WHERE IT RUNS: the QG stage, on v1 (the Writer's raw output, before restoration/replacement).
 *   node --experimental-strip-types scripts/provenance-gate.ts {BRIEF_DATE}
 *   node --experimental-strip-types scripts/provenance-gate.ts {BRIEF_DATE} --stamp   (PRE-Writer)
 *   node --experimental-strip-types scripts/provenance-gate.ts --selftest
 * Exit: 0 clean · 1 a self-report is falsified by disk · 2 usage/inputs missing.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const COMPONENTS = ['take-draft', 'signal-draft', 'discovery-draft', 'cc-predraft'] as const;
type Component = typeof COMPONENTS[number];
const RECENCY_WINDOW_DAYS = 30; // Model whitelist recency window (Novelty_Audit MODEL DUAL-RECENCY).

export interface Finding {
  check: 'predraft-absence-fabrication' | 'model-recency-fabrication';
  severity: '🔴';
  message: string;
}

// An "absence assertion" mentions the component AND an absence keyword on the same line.
// "signal-draft: IMPORTED" does NOT match; "take-draft: ABSENT. Generated inline" does.
const ABSENCE = /\b(absent|missing|not found|none found|does not exist|no pre-?draft|was ?n[o']?t produced|generated inline|inline generation|no such draft)\b/i;

// NEGATIVE-DECLARATION GUARD (added 2026-08-07 — QG false positive, E-PROVENANCE-GATE-LINEWRAP-01.
// The 08-07 manifest header wrapped as:
//   line 5: "PRE-DRAFT MANIFEST: … PRESENT (4/4): take-draft,"
//   line 6: "signal-draft, discovery-draft, cc-predraft. ABSENT (0/4): (none). All four CONSUMED."
// Line 6 carries three component tokens AND the word "ABSENT" — so CHECK A fired three 🔴
// fabrications against a manifest that declares the OPPOSITE (0 absent, all four consumed).
// predraft-consumption-gate passed the same v1 with 0 FAIL, which is the contradicting receipt.
// A line that declares a ZERO/NONE absence count is the negation of an absence assertion; it must
// never be read as one. Line-scoped matching cannot be trusted against a wrapped enumeration.
const NEGATIVE_DECLARATION = /\b(absent|missing)\b[^.\n]{0,24}?(\(\s*0\s*\/\s*\d+\s*\)|\bnone\b|\b0\b)/i;

/** Per-component disk state at gate time: does the file exist non-empty, and did it exist BEFORE v1 was written. */
export interface DraftState { present: boolean; existedBeforeV1: boolean; }

/**
 * CHECK A — pure. Given the v1 body and each component's disk state, return a finding for
 * every component v1 calls absent that was actually present on disk BEFORE v1 was written.
 * The existedBeforeV1 guard is the fabrication-vs-scheduling-gap discriminator: a pre-draft
 * that landed AFTER v1 could not have been seen by the Writer, so its "absent" claim is true.
 */
export function absenceFabrications(v1: string, state: Record<Component, DraftState>): Finding[] {
  const out: Finding[] = [];
  const lines = v1.split('\n');
  for (const comp of COMPONENTS) {
    // A component token: "take-draft", "take draft", or a bare "no take-draft".
    const compRe = new RegExp(comp.replace('-', '[\\s-]?'), 'i');
    const asserted = lines.some(l => compRe.test(l) && ABSENCE.test(l) && !NEGATIVE_DECLARATION.test(l));
    const s = state[comp];
    if (asserted && s.present && s.existedBeforeV1) {
      out.push({
        check: 'predraft-absence-fabrication',
        severity: '🔴',
        message: `v1 asserts ${comp} is absent/inline, but daily-briefs/{DATE}-${comp}.md EXISTS non-empty on disk AND was written BEFORE v1. This is a FABRICATED provenance record used to launder a pre-draft bypass (E-WRITER-LEDGER-INTEGRITY-01) — not a scheduling gap. Restore the section FROM the pre-draft and strike the false ledger line; do not keep the substitute because it reads better.`,
      });
    }
  }
  return out;
}

/** Extract the model slug the brief will publish — the "Explore this model" link, else any /models/ link. */
export function extractModelSlug(v1: string): string | null {
  const explore = v1.match(/Explore this model\]\([^)]*\/models\/([a-z0-9-]+)/i);
  if (explore) return explore[1]!.toLowerCase();
  const any = v1.match(/\/models\/([a-z0-9-]+)/i);
  return any ? any[1]!.toLowerCase() : null;
}

/**
 * CHECK B — pure. Given the model slug and the published archive (date → body), return the
 * most recent use STRICTLY BEFORE today, and whether it falls inside the recency window.
 * `today` and archive dates are 'YYYY-MM-DD'. This spans month boundaries by construction —
 * it compares absolute dates, never "the current month".
 */
export function modelRecency(
  slug: string,
  archive: { date: string; body: string }[],
  today: string,
  windowDays = RECENCY_WINDOW_DAYS,
): { lastUse: string | null; ageDays: number | null; violation: boolean } {
  const link = `/models/${slug}`;
  const hits = archive
    .filter(a => a.date < today && a.body.includes(link))
    .map(a => a.date)
    .sort();
  const lastUse = hits.length ? hits[hits.length - 1]! : null;
  if (!lastUse) return { lastUse: null, ageDays: null, violation: false };
  const age = Math.floor(
    (Date.parse(today + 'T00:00:00Z') - Date.parse(lastUse + 'T00:00:00Z')) / 86400000,
  );
  return { lastUse, ageDays: age, violation: age < windowDays };
}

export function modelRecencyFinding(
  slug: string,
  r: { lastUse: string | null; ageDays: number | null; violation: boolean },
): Finding | null {
  if (!r.violation) return null;
  return {
    check: 'model-recency-fabrication',
    severity: '🔴',
    message: `Model slug '${slug}' was last published ${r.lastUse} (${r.ageDays}d ago — INSIDE the ${RECENCY_WINDOW_DAYS}-day recency window), computed over the FULL archive. The Writer's validation report certified it clean by scoping recency to the current month and missing a use that crossed the month boundary. REPLACE the model with one clean over the full window (per Novelty_Audit MODEL DUAL-RECENCY).`,
  };
}

// ---- I/O + CLI ----

function loadArchive(root: string): { date: string; body: string }[] {
  const dir = path.join(root, 'content/daily-updates');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)) // full briefs only, not -light
    .map(f => ({ date: f.slice(0, 10), body: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

function runOnDate(date: string, root = process.cwd()): number {
  const v1Candidates = [
    path.join(root, `daily-briefs/${date}-v1.md`),
    path.join(root, `daily-briefs/${date}-v1-pre-quality-gate.md`),
  ];
  const v1Path = v1Candidates.find(fs.existsSync);
  if (!v1Path) {
    console.error(`provenance-gate: no v1 for ${date} (looked for -v1.md and -v1-pre-quality-gate.md)`);
    return 2;
  }
  const v1 = fs.readFileSync(v1Path, 'utf8');
  const v1Mtime = fs.statSync(v1Path).mtimeMs;

  const state = Object.fromEntries(
    COMPONENTS.map(c => {
      const p = path.join(root, `daily-briefs/${date}-${c}.md`);
      const st = fs.existsSync(p) ? fs.statSync(p) : null;
      const present = !!st && st.size > 200;
      // existedBeforeV1: the pre-draft was on disk by the time v1 was finalized.
      const existedBeforeV1 = !!st && st.mtimeMs <= v1Mtime;
      return [c, { present, existedBeforeV1 } as DraftState];
    }),
  ) as Record<Component, DraftState>;

  const findings: Finding[] = [...absenceFabrications(v1, state)];

  const slug = extractModelSlug(v1);
  if (slug) {
    const r = modelRecency(slug, loadArchive(root), date);
    const f = modelRecencyFinding(slug, r);
    if (f) findings.push(f);
  }

  console.log(`provenance-gate ${date} — v1=${path.basename(v1Path)} · model-slug=${slug ?? 'none'}`);
  for (const f of findings) console.error(`  ✗ ${f.severity} ${f.check}: ${f.message}`);
  if (findings.length) {
    console.error(`\n✗ PROVENANCE FABRICATION — ${findings.length} self-report(s) falsified by disk. Correct the content AND strike the false line before the artifact advances.`);
    return 1;
  }
  console.log('  ✓ all Writer self-reports (pre-draft presence, model recency) match disk.');
  return 0;
}

function selftest(): number {
  let ok = 0;
  let fail = 0;
  const t = (name: string, cond: boolean) => {
    if (cond) { ok++; console.log(`  ✓ ${name}`); }
    else { fail++; console.error(`  ✗ ${name}`); }
  };

  // CHECK A — the real 07-24 shape.
  const v1_0724 = [
    'cc-predraft: IMPORTED (Vår Energi/BlueNord, Iberdrola/Caruna, DTCC tokenization).',
    'signal-draft: IMPORTED (mature-node chip crunch, FDA nicotine formalization).',
    'discovery-draft: IMPORTED (Paradox of Enrichment).',
    'take-draft: ABSENT. Generated inline via Take_Generator tournament.',
  ].join('\n');
  const on: DraftState = { present: true, existedBeforeV1: true };   // present, on disk before v1
  const gap: DraftState = { present: true, existedBeforeV1: false };  // present now, but landed AFTER v1
  const off: DraftState = { present: false, existedBeforeV1: false }; // truly absent
  const allOn: Record<Component, DraftState> = {
    'take-draft': on, 'signal-draft': on, 'discovery-draft': on, 'cc-predraft': on,
  };
  const aFire = absenceFabrications(v1_0724, allOn);
  t('CHECK A FIRES on real 07-24 "take-draft: ABSENT" while file present-before-v1', aFire.length === 1 && aFire[0]!.message.includes('take-draft'));
  t('CHECK A SILENT on the three IMPORTED components (only take fires)', aFire.every(f => f.message.includes('take-draft')));

  // CHECK A — NEGATIVE-DECLARATION GUARD (2026-08-07). Verified to BITE on the real 08-07 wrap
  // (three false 🔴) while staying silent-free on the real 07-24 fabrication above.
  const v1_0807_wrap = [
    'PRE-DRAFT MANIFEST: daily-briefs/2026-08-07-predraft-manifest.md — PRESENT (4/4): take-draft,',
    'signal-draft, discovery-draft, cc-predraft. ABSENT (0/4): (none). All four CONSUMED.',
  ].join('\n');
  t('GUARD: silent on a wrapped "ABSENT (0/4): (none)" manifest line (08-07 false positive)',
    absenceFabrications(v1_0807_wrap, allOn).length === 0);
  t('GUARD: silent on "ABSENT: (none)" phrasing',
    absenceFabrications('take-draft, signal-draft. ABSENT: (none).', allOn).length === 0);
  t('GUARD does NOT swallow a real absence assertion (07-24 still fires)',
    absenceFabrications(v1_0724, allOn).length === 1);
  t('GUARD does NOT swallow a real absence with a nearby digit',
    absenceFabrications('take-draft: ABSENT. Generated inline; 3 candidates tried.', allOn).length === 1);

  // CHECK A — silent when the claimed-absent draft is genuinely absent.
  const takeOff: Record<Component, DraftState> = { ...allOn, 'take-draft': off };
  t('CHECK A SILENT when take-draft truly absent', absenceFabrications(v1_0724, takeOff).length === 0);

  // CHECK A — silent on a legitimate SCHEDULING GAP: file present now but landed AFTER v1.
  const takeGap: Record<Component, DraftState> = { ...allOn, 'take-draft': gap };
  t('CHECK A SILENT on scheduling gap (pre-draft mtime > v1 — Writer could not have seen it)', absenceFabrications(v1_0724, takeGap).length === 0);

  // CHECK A — silent on an all-IMPORTED ledger (a clean night).
  const cleanLedger = 'take-draft: IMPORTED. signal-draft: IMPORTED. discovery-draft: IMPORTED. cc-predraft: IMPORTED.';
  t('CHECK A SILENT on all-IMPORTED ledger', absenceFabrications(cleanLedger, allOn).length === 0);

  // CHECK B — the real 07-24 shape: Hysteresis slug used 06-25 (29d), today 07-24.
  const slug = 'feedback-loops-system-dynamics';
  const v1_model = `**[→ Explore this model](https://www.cosmictrex.com/models/${slug})**`;
  t('extractModelSlug pulls the Explore-link slug', extractModelSlug(v1_model) === slug);
  const archive = [
    { date: '2026-06-25', body: `body /models/${slug} here` }, // 29 days before 07-24
    { date: '2026-05-28', body: 'body /models/data-interpretation-aesthetic-vs-functional-truth' },
  ];
  const rDirty = modelRecency(slug, archive, '2026-07-24');
  t('CHECK B FIRES: slug used 06-25 (29d) is INSIDE 30d window (spans month boundary)', rDirty.violation && rDirty.lastUse === '2026-06-25' && rDirty.ageDays === 29);
  t('CHECK B finding names the slug and the true last-use', modelRecencyFinding(slug, rDirty)?.message.includes('2026-06-25') ?? false);

  // CHECK B — silent on a clean model (57 days, the replacement the QG chose).
  const cleanSlug = 'data-interpretation-aesthetic-vs-functional-truth';
  const rClean = modelRecency(cleanSlug, archive, '2026-07-24');
  t('CHECK B SILENT: replacement slug last used 05-28 (57d) is OUTSIDE the window', !rClean.violation && rClean.ageDays === 57);

  // CHECK B — silent when the model has never been used.
  const rNever = modelRecency('brand-new-model', archive, '2026-07-24');
  t('CHECK B SILENT when model never used', !rNever.violation && rNever.lastUse === null);

  // CHECK B — must not count TODAY's own publication as a prior use.
  const archiveWithToday = [...archive, { date: '2026-07-24', body: `/models/${cleanSlug}` }];
  t('CHECK B excludes today (strictly-before) so a just-published slug is not self-flagged', !modelRecency(cleanSlug, archiveWithToday, '2026-07-24').violation);

  console.log(`\nprovenance-gate selftest — ${ok} passed · ${fail} failed`);
  return fail ? 1 : 0;
}

/**
 * ── STAMP: the input-layer prevention (IMP-102, rebuilt 2026-07-31) ──────────────
 * Writes daily-briefs/{date}-predraft-manifest.md BEFORE the Writer runs.
 * PRESENT/ABSENT is computed here by `fs` — never authored by the Writer — and every
 * PRESENT pre-draft's body is inlined VERBATIM, because a path reference loses to the
 * Writer's default "generate from scratch" (the IMP-094 audio precedent).
 *
 * Deliberately does NOT require a v1: this runs before generation, so there is nothing
 * to check yet. It is write-only and idempotent — re-running overwrites cleanly and
 * cannot fail a brief. CHECK A / CHECK B (runOnDate) remain the post-v1 CATCH.
 */
export function buildManifest(date: string, root = process.cwd()): { body: string; present: Component[]; absent: Component[] } {
  const present: Component[] = [];
  const absent: Component[] = [];
  const blocks: string[] = [];

  for (const comp of COMPONENTS) {
    const rel = `daily-briefs/${date}-${comp}.md`;
    const abs = path.join(root, rel);
    const st = fs.existsSync(abs) ? fs.statSync(abs) : null;
    const isPresent = !!st && st.size > 200;
    if (isPresent) {
      present.push(comp);
      const body = fs.readFileSync(abs, 'utf8').trimEnd();
      blocks.push(
        `### ${comp} — PRESENT\n` +
        `<!-- ground truth: ${rel} · ${st!.size} bytes · mtime ${new Date(st!.mtimeMs).toISOString()} -->\n` +
        `You MUST consume this. You may adapt voice, transitions, ordering and length to serve the\n` +
        `whole brief. You may NOT replace its substance (thesis, numbers, framework) without emitting\n` +
        `PREDRAFT-OVERRIDE: ${comp} :: <reason, 20+ chars>. You may NOT write that it is absent.\n\n` +
        `<<<BEGIN ${comp}>>>\n${body}\n<<<END ${comp}>>>\n`,
      );
    } else {
      absent.push(comp);
      blocks.push(
        `### ${comp} — ABSENT\n` +
        `<!-- ground truth: ${rel} ${st ? `exists but only ${st.size} bytes (<=200, treated as empty)` : 'does not exist'} -->\n` +
        `Genuinely absent. Generate this section inline.\n`,
      );
    }
  }

  const header =
    `<!-- GROUND-TRUTH PRE-DRAFT MANIFEST — generated by provenance-gate --stamp. DO NOT EDIT. -->\n` +
    `# Pre-draft manifest — ${date}\n\n` +
    `**Presence below was computed by \`fs.statSync\`, not authored by the Writer.**\n` +
    `PRESENT: ${present.length ? present.join(', ') : '(none)'}\n` +
    `ABSENT: ${absent.length ? absent.join(', ') : '(none)'}\n\n` +
    `These flags are authoritative. A component marked PRESENT exists on disk and its full body is\n` +
    `inlined below — writing "ABSENT" for it is a fabricated provenance record (E-WRITER-FABRICATION-01)\n` +
    `and provenance-gate CHECK A will fail the artifact.\n\n---\n\n`;

  return { body: header + blocks.join('\n'), present, absent };
}

function stampOnDate(date: string, root = process.cwd()): number {
  const { body, present, absent } = buildManifest(date, root);
  const out = path.join(root, `daily-briefs/${date}-predraft-manifest.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body, 'utf8');
  console.log(`provenance-gate --stamp ${date} → ${path.basename(out)} (${body.length} bytes)`);
  console.log(`  PRESENT (${present.length}/4): ${present.join(', ') || '(none)'}`);
  console.log(`  ABSENT  (${absent.length}/4): ${absent.join(', ') || '(none)'}`);
  if (!present.length) console.error('  ⚠ no pre-drafts on disk — the Writer will generate all four inline. Check the 5:30-5:45 PM tasks ran.');
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const date = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.error('usage: provenance-gate.ts <YYYY-MM-DD> [--stamp] | --selftest');
    return 2;
  }
  if (args.includes('--stamp')) return stampOnDate(date);
  return runOnDate(date);
}

// Only auto-run when invoked directly (so the pure functions are importable for tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
