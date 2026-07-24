// inner-game-compounding-gate.ts (IMP-057, 2026-07-15 — the 07-15 Critic's mandate #2).
//
// WORKED FAILURE. The 07-15 Dōgen entry ("To study the self is to forget the self") was a
// competent standalone — and that was the whole problem. Ceiling Doctrine §7 (Jackson,
// 2026-07-10: "more big picture and integrated with the past to build") requires each Inner
// Game entry to name, in one clause, where it sits relative to prior entries: does it EXTEND
// a prior entry, TENSION one, or OPEN a new room? The 07-15 entry referenced nothing. The
// Critic: "Dōgen's 'forget the self' TENSIONS Beck's 'effort is the obstacle' (07-11) — that
// tension IS the philosophy being built, and it's absent." E-INNER-GAME-CONCEPT-01 is D80+:
// the section has never hit Essential in the tracking window, and the instruction to compound
// has lived in Inner_Game_Generator.md as prose that the Writer's default (a fresh, standalone
// fortune cookie) overrides — RC1. Per Root Cause Library Pattern 1, a Writer rule that fails
// escalates to a mechanical gate + an Editor REJECT.
//
// THE CHECK. A STRUCTURAL PROXY (the IMP-014 assumption-inversion pattern): it forces the
// Writer to DECLARE the placement; it cannot certify the compounding is *good* — the Critic
// judges that. The declaration is an HTML comment in the section (invisible to the reader,
// exactly like INNER-GAME-FIGURE-FIRST, IMP-047):
//
//   <!-- INNER-GAME-COMPOUNDING: TENSIONS 2026-07-11 Beck (effort-as-obstacle vs trying-becomes-invisible) -->
//   <!-- INNER-GAME-COMPOUNDING: EXTENDS 2026-07-08 Bonanno (the unnarrated interval) -->
//   <!-- INNER-GAME-COMPOUNDING: OPENS mortality/finitude -->
//
// EXTENDS/TENSIONS must name a referent (a prior date or concept); OPENS must name an axis.
// The gate lives in its OWN script, not validate-brief.ts, on purpose: validate-brief is run
// by IMP-042's ledger check against the 07-13 published brief, which predates the marker and
// would regress. This gate's enforcement is the Editor Gate 6 REJECT + the morning gate; it
// bites going forward, not retroactively.

import * as fs from 'fs';
import * as path from 'path';

type Finding = { check: string; severity: 'FAIL'; message: string };

const SECTION_HEADER_RE = /^#{1,3}\s*(?:▸\s*)?INNER\s*GAME\b/im;
// Valid declaration: EXTENDS/TENSIONS + a referent (≥3 chars), or OPENS + an axis (≥3 chars).
const COMPOUNDING_MARKER_RE = /<!--\s*INNER-GAME-COMPOUNDING:\s*(EXTENDS|TENSIONS|OPENS)\b\s*([^>]{3,}?)\s*-->/i;

/** Extract the Inner Game section body: from its header to the next top-level (`#`/`##`/`###`) header. */
export function innerGameSection(body: string): string | null {
  const lines = body.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_HEADER_RE.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// WRONG-ARTIFACT DETECTION (IMP-065, 2026-07-17 — applying IMP-063(b)).
// This gate fired on EVERY published brief since it shipped, and the finding was a lie.
// Controller morning gate 24 pointed it at `content/daily-updates/{DATE}.md`, but the rung
// is an HTML comment and the evening staging strips ALL comments on the copy to
// content/daily-updates/ — receipt (2026-07-17): the v2 carries 10 HTML comments including a
// correctly-declared `TENSIONS Beck→Dōgen→Arendt→Heschel`; the published file carries ZERO.
// So the gate reported "missing compounding rung" on a brief whose rung was present and
// correct, every single day, and its "pipeline failure" signal was pure noise. A backstop
// that cannot distinguish "the Writer skipped the rung" from "you handed me a file where the
// rung cannot exist" is not a backstop — it is a daily false alarm, and a false alarm is how
// a real one gets ignored (the IMP-042/IMP-045 lesson: a gate that hands the operator a
// worklist of non-claims trains them to skim, and the skimmed worklist is where the real
// failure hides). The rung is INTERNAL editorial control, exactly like INNER-GAME-FIGURE-FIRST;
// it belongs in the Editor's artifact and must never reach the reader — and its own canonical
// text contains an em-dash, so injecting it into the published file would trip the em-dash
// check too. The fix is therefore to check the artifact where the rung LIVES (the v2) and to
// make this gate say so when it is aimed at one where the rung CANNOT live.
function commentsStripped(body: string): boolean {
  return !/<!--/.test(body);
}

// TENSIONS BODY-ENGAGEMENT (IMP-091, 2026-07-23 — the 07-23 Critic's mandate #3, RC4). A TENSIONS
// rung that NAMES a prior figure but never brings that figure into the reader-facing body is a
// declaration, not the synthesis Ceiling Doctrine §7 asks for. 07-23 receipt: the rung declared
// "TENSIONS Musonius" and the body developed only Murdoch — the word "Musonius" never appears in the
// prose the reader sees; the tension was stated, not explored (2nd consecutive day after 07-22
// Butler). The compounding-rung Writer rule (IMP-057) produced the DECLARATION and stopped, and a
// Writer rule that fails twice escalates to a gate (Apply_Improvements Phase 5). This is a STRUCTURAL
// proxy, NOT a word-count (Root Cause Library Pattern 8 — a count is gamed): it cannot certify the
// synthesis is GOOD (the Critic judges that), but it forces the prior figure into the body, the first
// concrete step of exploration. TWO EXEMPTIONS keep the false-positive rate at zero: (1) an ARC rung
// (contains "→", a multi-day chain whose active node IS today's entry, e.g. 07-16 Beck→…→Arendt) is
// not a two-body tension; (2) a CONCEPT-ONLY tension (no capitalized proper-noun referent) has no
// figure to require.
function tensionEngagementFinding(kind: string, referentAndGloss: string, section: string): Finding | null {
  if (!/TENSIONS/i.test(kind)) return null;
  if (/→|->/.test(referentAndGloss)) return null; // arc chain — exempt
  const referentSeg = referentAndGloss.split('(')[0]!.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}-\d{1,2}\b/g, ' ');
  const names = (referentSeg.match(/\b[A-Z][A-Za-z]{3,}\b/g) || []).filter((w) => !/^(RUNG|TENSIONS|EXTENDS|OPENS)$/i.test(w));
  if (names.length === 0) return null; // concept-only tension — no proper-noun referent to require
  const prose = section.replace(/<!--[\s\S]*?-->/g, ''); // reader-facing body, comments removed
  const engaged = names.some((n) => new RegExp(`\\b${n}\\b`).test(prose));
  if (engaged) return null;
  return {
    check: 'inner-game-compounding-tension-unengaged',
    severity: 'FAIL',
    message: `TENSIONS declared but NOT EXPLORED — the rung names ${names.join('/')} as the prior figure in tension with today's entry, but that figure never appears in the section body: the tension is stated in a comment the reader never sees while the prose develops only today's thinker. Ceiling Doctrine §7: the compounding rung's value is the SYNTHESIS. Spend 2-3 sentences in the body on what it means that BOTH hold — name the prior figure and resolve or sharpen the tension. (2026-07-23 receipt: "TENSIONS Musonius", body all Murdoch, zero "Musonius"; 2nd consecutive day after 07-22 Butler. A chained arc rung with "→" is exempt.)`,
  };
}

export function checkInnerGameCompounding(body: string): Finding[] {
  const section = innerGameSection(body);
  if (section == null) return []; // absence of the section is validate-brief's job, not this gate's
  const m = section.match(COMPOUNDING_MARKER_RE);
  if (m) {
    // IMP-091: a valid marker is necessary but no longer sufficient — a TENSIONS rung must ENGAGE
    // its named prior figure in the body, not merely declare it in a comment (the 07-23 gap).
    const engage = tensionEngagementFinding(m[1]!, m[2]!, section);
    return engage ? [engage] : [];
  }
  // The file has an Inner Game section but NOT A SINGLE HTML comment anywhere: this is a
  // staged/published artifact whose comments were stripped, not a brief missing its rung.
  // Report the aiming error; never manufacture a content failure out of a plumbing one.
  if (commentsStripped(body)) {
    return [{
      check: 'inner-game-compounding-wrong-artifact',
      severity: 'FAIL',
      message: `WRONG ARTIFACT — this file contains an Inner Game section but zero HTML comments, so the INNER-GAME-COMPOUNDING rung cannot be present in it: the staging step strips all comments on the copy to content/daily-updates/. The rung is internal editorial control (like INNER-GAME-FIGURE-FIRST) and must never reach the reader. Point this gate at the Editor's artifact where the rung lives — "daily-briefs/{BRIEF_DATE}-v2.md" — not at the published brief. (IMP-063(b)/IMP-065: aimed at the published file, this gate fired a false "missing rung" on every brief since 2026-07-15.)`,
    }];
  }
  // MISPLACED ≠ MISSING (IMP-065, 2026-07-17). The rung is declared SOMEWHERE in the file but
  // not inside the section. These are different failures with different fixes, and conflating
  // them cost a real catch: on 07-17 the Editor declared a correct, rich TENSIONS rung
  // (Beck→Dōgen→Arendt→Heschel) up in the control-comment block at the TOP of v2, ~100 lines
  // above the section. The CRITIC grepped the file, saw it, and reported "compounding rung
  // present and explicit". This GATE scoped to the section, did not see it, and said "missing".
  // Both were right about different things, nobody reconciled them, and the morning wrote the
  // FAIL off as IMP-063(b)'s "known false alarm" — so a genuine PLACEMENT REGRESSION on the
  // rung's second night was dismissed as noise. That is the true cost of a noisy gate, in this
  // system's own words (IMP-045): a worklist of non-claims trains the operator to skim, and the
  // skimmed worklist is where the real failure hides. 07-16 proves the spec is achievable —
  // rung@107 inside section 105-122, clean.
  const fileMarker = body.match(COMPOUNDING_MARKER_RE);
  if (fileMarker) {
    const line = body.slice(0, body.indexOf(fileMarker[0])).split('\n').length;
    return [{
      check: 'inner-game-compounding-misplaced',
      severity: 'FAIL',
      message: `MISPLACED compounding rung — the declaration is valid ("${fileMarker[1].toUpperCase()}") but sits at line ${line}, OUTSIDE the Inner Game section. Inner_Game_Generator's assembly format puts it INSIDE the section, directly under the header and above the anchoring quote; a declaration in the control-comment block at the top of v2 is not attached to the entry it describes, and only the section is what the Editor's Gate 6 and this gate read. FIX: move the existing comment verbatim into the Inner Game section. Do NOT rewrite the rung and do NOT treat this as a missing rung — the thinking is done, the placement is wrong. (2026-07-17 receipt: declared at line 93, section at 191-208; the Critic greps the file and called it "present and explicit", this gate scopes to the section and called it "missing". 07-16 did it correctly: rung@107 inside section 105-122.)`,
    }];
  }
  // Present but undeclared: report whether a malformed marker was attempted, for a useful message.
  const attempted = /<!--\s*INNER-GAME-COMPOUNDING:/i.test(section);
  return [{
    check: 'inner-game-compounding-rung',
    severity: 'FAIL',
    message: attempted
      ? `Inner Game carries a malformed INNER-GAME-COMPOUNDING marker. Required form: "<!-- INNER-GAME-COMPOUNDING: EXTENDS|TENSIONS <prior date/concept> -->" or "<!-- INNER-GAME-COMPOUNDING: OPENS <axis> -->".`
      : `Inner Game is missing its compounding rung (Ceiling Doctrine §7). Declare where this entry sits relative to prior Inner Games: "<!-- INNER-GAME-COMPOUNDING: TENSIONS 2026-07-11 Beck (effort-as-obstacle) -->" (EXTENDS/TENSIONS name a referent; OPENS names an axis). Consecutive OPENS with no EXTEND/TENSION is drift, not building. This section is constructing a philosophy of life entry by entry — each entry must know where it sits in that construction.`,
  }];
}

function selftest(): number {
  const root = process.cwd();
  // IMP-065 FIXTURE CORRECTION. This assertion used to read the PUBLISHED 07-15 brief
  // (content/daily-updates/2026-07-15.md) — an artifact whose comments are stripped at
  // staging, so the rung could never have been in it. The test passed, but for the wrong
  // reason: it was asserting the gate's own daily false alarm. The honest fixture is the
  // EDITOR's artifact, where the rung lives or fails to. Receipts: 2026-07-15-v2.md carries
  // 1 comment and NO rung (the real miss the 07-15 Critic mandated); 2026-07-17-v2.md carries
  // 10 comments including a declared TENSIONS (Beck→Dōgen→Arendt→Heschel).
  const v2Jul15 = path.join(root, 'daily-briefs/2026-07-15-v2.md');
  const v2Jul17 = path.join(root, 'daily-briefs/2026-07-17-v2.md');
  const pubJul17 = path.join(root, 'content/daily-updates/2026-07-17.md');

  // FIRE on the REAL 07-15 v2 (Dōgen, no compounding declaration — the Critic's finding).
  let okFire = false, fireN = 0;
  if (fs.existsSync(v2Jul15)) {
    const f = checkInnerGameCompounding(fs.readFileSync(v2Jul15, 'utf8'));
    fireN = f.length;
    okFire = f.some((x) => x.check === 'inner-game-compounding-rung' && x.severity === 'FAIL');
  } else {
    okFire = true; // fixture absent in some sandboxes — do not fail the whole gate on that
  }

  // MISPLACED (not "missing") on the REAL 07-17 v2 — a valid rung declared ~100 lines above
  // the section, in the control-comment block. The regression the morning dismissed as noise.
  const okMisplaced = !fs.existsSync(v2Jul17)
    || checkInnerGameCompounding(fs.readFileSync(v2Jul17, 'utf8'))
      .some((x) => x.check === 'inner-game-compounding-misplaced');

  // SILENT on the REAL 07-16 v2 — rung@107 inside section 105-122. The spec IS achievable,
  // and this is the night IMP-057's ledger row claims it was exercised clean. It was.
  const v2Jul16 = path.join(root, 'daily-briefs/2026-07-16-v2.md');
  const okRealSilent = !fs.existsSync(v2Jul16)
    || checkInnerGameCompounding(fs.readFileSync(v2Jul16, 'utf8')).length === 0;

  // WRONG ARTIFACT on the REAL published 07-17 — zero comments, so the rung cannot be there.
  // This is the false alarm the gate fired every morning; it must now name the aiming error
  // instead of inventing a missing rung.
  const okWrongArtifact = !fs.existsSync(pubJul17)
    || checkInnerGameCompounding(fs.readFileSync(pubJul17, 'utf8'))
      .some((x) => x.check === 'inner-game-compounding-wrong-artifact');

  // SILENT on a declared TENSIONS marker (the exact fix the Critic prescribed).
  const withTension = `# ▸ INNER GAME\n\n*"To study the self is to forget the self."*\n— Dōgen\n\n<!-- INNER-GAME-COMPOUNDING: TENSIONS 2026-07-11 Beck (effort-as-obstacle vs trying-becomes-invisible) -->\n\nBeck's effort-as-obstacle keeps surfacing here: to force presence is to lose it. Body paragraph.\n\n**Today's practice: do it without checking on it.**\n\n# ▸ THE MODEL\n`;
  const okSilentTension = checkInnerGameCompounding(withTension).length === 0;

  // SILENT on a declared EXTENDS and a declared OPENS.
  const withExtends = withTension.replace(/TENSIONS 2026-07-11 Beck \(effort-as-obstacle vs trying-becomes-invisible\)/, 'EXTENDS 2026-07-08 Bonanno (the unnarrated interval)');
  const okSilentExtends = checkInnerGameCompounding(withExtends).length === 0;
  const withOpens = withTension.replace(/TENSIONS 2026-07-11 Beck \(effort-as-obstacle vs trying-becomes-invisible\)/, 'OPENS mortality/finitude');
  const okSilentOpens = checkInnerGameCompounding(withOpens).length === 0;

  // FIRE on a malformed (empty) marker — a bare tag must not satisfy the gate.
  const malformed = withTension.replace(/TENSIONS 2026-07-11 Beck \(effort-as-obstacle vs trying-becomes-invisible\)/, '');
  const okMalformed = checkInnerGameCompounding(malformed).some((x) => x.check === 'inner-game-compounding-rung');

  // FIRE on a section with a real entry but NO rung — modelled as a real v2 would be: the
  // rung is gone but OTHER editorial comments remain. (IMP-065: before this, the synthetic
  // stripped the file's only comment, making it indistinguishable from a published artifact
  // whose comments were stripped at staging — the two failures a backstop must never conflate.)
  const noMarker = withTension.replace(/<!-- INNER-GAME-COMPOUNDING:[^>]*-->\n\n/, '<!-- DEPTH-TREATMENT -->\n\n');
  const okNoMarker = checkInnerGameCompounding(noMarker).some((x) => x.check === 'inner-game-compounding-rung');

  // SILENT when there is no Inner Game section at all (that is validate-brief's failure to report).
  const okNoSection = checkInnerGameCompounding('# ▸ THE DASHBOARD\n\nEquities up.\n').length === 0;

  // IMP-091 — TENSIONS BODY-ENGAGEMENT. FIRE when the rung names a prior figure the body never
  // engages (the real 07-23 shape: "TENSIONS Musonius", body all Murdoch, zero "Musonius").
  const tensionUnengaged = `# ▸ INNER GAME\n\n<!-- INNER-GAME-COMPOUNDING: TENSIONS Musonius 07-21 (both say the capacity precedes the moment; somatic vs perceptual) -->\n\n*"We act rightly when the time comes."*\n— Iris Murdoch\n\nMurdoch argued moral life is habitual attention, not dramatic choice. The prose develops only Murdoch and never returns to the prior figure.\n\n**Today's practice: ten minutes of actual thought.**\n\n# ▸ THE MODEL\n`;
  const okTensionUnengaged = checkInnerGameCompounding(tensionUnengaged).some((x) => x.check === 'inner-game-compounding-tension-unengaged');
  // SILENT once the body actually engages the prior figure (names Musonius and resolves the tension).
  const tensionEngaged = tensionUnengaged.replace('never returns to the prior figure.', 'returns to Musonius: where Musonius builds readiness in the trained body, Murdoch builds it in the quality of attention — two descriptions of one practice of preparation.');
  const okTensionEngaged = checkInnerGameCompounding(tensionEngaged).length === 0;
  // ARC EXEMPTION — a chained "→" rung (07-16 Beck→…→Arendt) is not a two-body tension → SILENT.
  const arcRung = `# ▸ INNER GAME\n\n<!-- INNER-GAME-COMPOUNDING: TENSIONS 2026-07-11 Beck (effort) → 2026-07-16 Arendt (promise-as-ground). RUNG: the arc moves outward. -->\n\n*"..."*\n— Hannah Arendt\n\nArendt moves identity outward to the bond of the promise.\n\n**Today's practice: keep one promise.**\n\n# ▸ THE MODEL\n`;
  const okArcExempt = checkInnerGameCompounding(arcRung).length === 0;

  console.log('inner-game-compounding-gate --selftest');
  console.log(`  FIRE on the real 07-15 v2 Inner Game (no declaration): ${okFire ? '✓' : '✗'} (${fireN} finding(s))`);
  console.log(`  [IMP-065] SILENT on the real 07-16 v2 (rung declared INSIDE the section): ${okRealSilent ? '✓' : '✗'}`);
  console.log(`  [IMP-065] MISPLACED (not "missing") on the real 07-17 v2 (rung@93, section@191): ${okMisplaced ? '✓' : '✗'}`);
  console.log(`  [IMP-065] WRONG-ARTIFACT (not "missing rung") on the real PUBLISHED 07-17: ${okWrongArtifact ? '✓' : '✗'}`);
  console.log(`  SILENT on a declared TENSIONS marker: ${okSilentTension ? '✓' : '✗'}`);
  console.log(`  SILENT on a declared EXTENDS marker: ${okSilentExtends ? '✓' : '✗'}`);
  console.log(`  SILENT on a declared OPENS marker: ${okSilentOpens ? '✓' : '✗'}`);
  console.log(`  FIRE on a malformed (empty) marker: ${okMalformed ? '✓' : '✗'}`);
  console.log(`  FIRE on a section with no marker: ${okNoMarker ? '✓' : '✗'}`);
  console.log(`  SILENT when the section is absent (validate-brief's job): ${okNoSection ? '✓' : '✗'}`);
  console.log(`  [IMP-091] FIRE on a TENSIONS whose prior figure is absent from the body: ${okTensionUnengaged ? '✓' : '✗'}`);
  console.log(`  [IMP-091] SILENT once the body engages the prior figure: ${okTensionEngaged ? '✓' : '✗'}`);
  console.log(`  [IMP-091] SILENT on an arc ("→") rung (exempt): ${okArcExempt ? '✓' : '✗'}`);

  const ok = okFire && okSilentTension && okSilentExtends && okSilentOpens && okMalformed && okNoMarker && okNoSection
    && okRealSilent && okMisplaced && okWrongArtifact
    && okTensionUnengaged && okTensionEngaged && okArcExempt;
  if (ok) {
    console.log('\n✅ SELFTEST PASS — the gate FIRES on an undeclared/malformed Inner Game compounding rung and stays SILENT on a valid EXTENDS/TENSIONS/OPENS declaration.');
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selftest());
  const briefArg = args.find((a) => !a.startsWith('--'));
  if (!briefArg) {
    console.error('Usage: inner-game-compounding-gate.ts <brief.md>');
    console.error('       inner-game-compounding-gate.ts --selftest');
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) { console.error(`File not found: ${briefPath}`); process.exit(2); }
  const findings = checkInnerGameCompounding(fs.readFileSync(briefPath, 'utf8'));
  console.log(`inner-game-compounding-gate — ${path.basename(briefPath)}`);
  if (findings.length === 0) { console.log('\n✅ PASS — Inner Game carries a declared compounding rung.'); process.exit(0); }
  console.log(`\n❌ FAIL — ${findings.length} issue(s):`);
  for (const f of findings) console.log(`   ✗ [${f.check}] ${f.message}`);
  process.exit(1);
}

main();
