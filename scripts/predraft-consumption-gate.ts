#!/usr/bin/env node --experimental-strip-types
/**
 * predraft-consumption-gate.ts — THE WRITER MUST CONSUME ITS INPUTS.
 *
 * THE FAILURE THIS EXISTS TO KILL (2026-07-12 Critic, 🔴 EMERGENCY, the most serious
 * generation-layer failure in tracking history):
 *
 *   All four component pre-drafts — take-draft, signal-draft, discovery-draft,
 *   cc-predraft — were generated, gate-passed, and sitting on disk. The Writer read
 *   NONE of them. It authored substitutes for every one:
 *
 *     component  | on disk (gate-passed)                  | what v1 shipped
 *     -----------|----------------------------------------|---------------------------------
 *     Take       | "The Preference Ceiling" (Hsinchu/TSMC) | "The Chokepoint Premium" (SK Hynix/NVIDIA)
 *     Signal     | Millrose land banks / streaming CPM     | solid-state batteries / electricians
 *     Discovery  | original antigenic sin (immune imprint) | "The Frames You Cannot See Through"
 *     C&C        | Prologis / Aave / Backpack              | SK Hynix / Kroger / BTC weekend band
 *
 *   The substitutes carried 5 fabricated or false claims. The take-draft had explicitly
 *   BANNED the AI-capex trigger family (5/9 frequency) and the Writer wrote an
 *   AI-infrastructure Take. The intelligence file had explicitly pre-killed a Fed-cut
 *   sentence ("that line must not survive contact with tonight's draft") and the Writer
 *   wrote it. The quality gate then rewrote ~85% of the brief back to the pre-drafts and
 *   produced a Must-Read — the catch layer doing the production layer's job. A Must-Read
 *   that required an 85% rewrite is not a system working; it is a system saved by its net.
 *
 * WHY A GATE AND NOT A RULE: RC1 (default override). The pre-drafts, the intelligence
 * file, and the rotation checks all fired correctly and were all ignored. Root Cause
 * Library: a Writer instruction that loses to a default behavior has a documented ~0%
 * behavior-change rate. The only thing a Writer cannot ignore is an exit code.
 *
 * AND IT IS NOT DAY 1 (found while building this gate — run it over the archive):
 *   07-08  Take + C&C bypassed
 *   07-09  Take + Discovery bypassed — AND THESE PUBLISHED. The take-draft's "Formation Gate"
 *          and the discovery-draft's language paper were discarded for a self-authored Take
 *          ("Floor Migration") and Discovery ("The Janitor Shift"). The QG did not restore them.
 *          Nothing in the pipeline noticed. Nothing ever has.
 *   07-10  clean · 07-11  clean
 *   07-12  ALL FOUR bypassed (the day it became visible, because the QG's 85% rewrite was too
 *          large for the Critic to miss)
 * Three of the last five briefs shipped at least one component the pipeline did not design.
 * The Critic logged this as Day 1 of E-WRITER-COMPONENT-BYPASS-01; it is Day 5 of a class that
 * was invisible because no artifact compared v1 to the pre-drafts. This gate is that comparison.
 *
 * CHECK A — PRE-DRAFT CONSUMPTION (RC1, Critical)
 *   For every component pre-draft on disk, the corresponding v1 section must intersect it
 *   on at least one anchor (the Take's declared framework or trigger entity; the Signal's
 *   lead entities; the Discovery's title entities; any cc-predraft candidate's entities).
 *   EMPTY INTERSECTION = FAIL. This is deliberately the weakest possible bar: it does not
 *   ask the Writer to keep the pre-draft's prose, only to have READ it. 07-12 cleared zero
 *   of four. 07-11 cleared four of four with room to spare.
 *
 * CHECK B — PRE-KILL VIOLATION (RC1, Critical)
 *   The intelligence file kills claims before the draft exists ("DO NOT USE", "must not
 *   survive contact with tonight's draft", "is now FALSE", "REJECTED SOURCES"). Those kills
 *   were prose addressed to no one. Now they are patterns:
 *     - CONTRACT (preferred): the synthesizer emits `KILL-PATTERN: /regex/i :: reason`
 *       lines. The gate tests each against v1 and FAILs on a match. Semantic kills (the
 *       Fed-cut sentence) are only mechanizable this way — a grep of the prose cannot
 *       know that "swap markets have two Fed cuts embedded" IS "the market prices cuts".
 *     - LEGACY (no contract needed): any double-quoted literal inside a kill-vocabulary
 *       sentence becomes a banned literal (catches the "Brent $112.93 / WTI $108.21"
 *       rejected-source class the same day it is flagged).
 *     - ADOPTION FLAG: kill prose present but zero KILL-PATTERN lines → FLAG (advisory).
 *
 * Usage:
 *   node --experimental-strip-types scripts/predraft-consumption-gate.ts --selftest
 *   node --experimental-strip-types scripts/predraft-consumption-gate.ts 2026-07-12
 *   node --experimental-strip-types scripts/predraft-consumption-gate.ts 2026-07-12 --advisory
 *   node --experimental-strip-types scripts/predraft-consumption-gate.ts --v1 <path> --take <path> ...
 *
 * Exit: 0 clean (or --advisory) · 1 any FAIL · 2 usage error.
 * HARD GATE at brief-draft (Pipeline_Controller step 6.5): on FAIL the Writer regenerates
 * the offending section FROM the pre-draft and re-runs. One regeneration; if it still FAILs,
 * the section is REPLACED with the pre-draft body verbatim and a PREDRAFT-BYPASS line is
 * written to pipeline-status so the Editor and Critic see it. The brief always ships — but
 * it ships with its inputs.
 *
 * Wired into: Pipeline_Controller.md (brief-draft gate 6.5, morning spot-check),
 * Brief_Writer.md (THE PRE-DRAFT CONTRACT), Brief_Editor.md (Gate 0), Novelty_Audit.md
 * (QG must REPORT a bypass, not silently repair it), Intelligence_Synthesizer.md
 * (KILL-PATTERN emission). Ledger IMP-038 / IMP-039.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Severity = 'FAIL' | 'FLAG';
interface Finding { check: string; severity: Severity; component: string; message: string; }

// ---------- text helpers ----------
function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Pre-draft bodies begin at the first markdown header; everything above is metadata. */
function bodyFrom(md: string): string {
  const stripped = stripComments(md);
  const lines = stripped.split('\n');
  const i = lines.findIndex(l => /^#{1,6}\s/.test(l));
  return (i === -1 ? stripped : lines.slice(i).join('\n'));
}

function extractSection(md: string, startRe: RegExp, stopRe = /^#{1,2}\s|^#\s*▸/): string {
  const lines = stripComments(md).split('\n');
  const i = lines.findIndex(l => startRe.test(l));
  if (i === -1) return '';
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (stopRe.test(l)) break;
    out.push(l);
  }
  return out.join('\n');
}

/**
 * Words that are capitalized for reasons other than being an entity: sentence starts, title
 * case, weekday/month names, and our own section vocabulary. An anchor drawn from this set is
 * not evidence of anything — "Answer" from the Discovery's title-cased headline matched the
 * word "answer" in a completely unrelated Discovery, and "Tel" (from Tel Aviv) matched inside
 * "Intel". Both were false passes in the first build of this gate.
 */
const STOP = new Set([
  'the','this','that','these','those','and','but','or','if','when','while','because','so','it','its',
  'he','she','they','we','you','in','on','at','for','from','to','by','with','as','of','is','are','was','were',
  'be','been','not','no','yes','every','each','what','which','who','why','how','there','here','one','two','three',
  'first','second','third','read','write','watch','note','primary','framework','domain','pass','fail','both','all',
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday','january','february','march','april','may',
  'june','july','august','september','october','november','december','usa','america','american',
  'take','signal','discovery','companies','crypto','markets','market','macro','geopolitics','model','inner','game',
  'dashboard','wild','card','context','today','yesterday','tomorrow','last','next','over','under',
  // common English words that show up capitalized at sentence/headline start
  'answer','answers','question','questions','price','prices','pricing','still','about','after','before','during',
  'however','instead','another','between','without','within','through','against','across','until','since','more',
  'most','less','best','worst','real','only','even','just','also','than','then','will','would','could','should',
  'week','weeks','month','months','year','years','days','time','times','world','people','thing','things','value',
  'here','their','them','have','has','had','does','done','make','made','give','given','same','other','others',
  'much','many','some','none','never','always','again','once','twice','into','onto','upon','were','being','where',
  'story','stories','number','numbers','point','points','case','cases','side','sides','part','parts','line','lines',
  'move','moves','call','calls','rate','rates','data','name','names','fact','facts','idea','ideas','work','works',
]);

/**
 * Anchors = distinctive proper nouns and acronyms (>=4 chars, word-boundary matched) plus the
 * pre-draft's headline as a whole phrase. Header lines are NOT tokenized: title case turns
 * every word in "The Answer That Arrives Too Fast to Be Right" into a fake proper noun.
 *
 * The gate is an INTERSECTION test, so a spurious anchor can only cause a false PASS, never a
 * false FAIL. That asymmetry is deliberate: this gate hard-stops the pipeline, so it must be
 * impossible for it to be wrong in the direction that stops a healthy brief.
 */
function anchors(text: string): string[] {
  const out = new Set<string>();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    const header = line.match(/^#{1,6}\s+(.+)$/);
    if (header) {
      const title = header[1]!.replace(/[▸#*]/g, '').trim().toLowerCase();
      if (title.length >= 8) out.add(title); // whole headline as one phrase anchor
      continue;
    }
    const runRe = /\b([A-Z][A-Za-z0-9&.'’-]{1,}(?:\s+[A-Z][A-Za-z0-9&.'’-]{1,}){0,3})\b/g;
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(line))) {
      const run = m[1]!.trim();
      const toks = run.split(/\s+/);
      for (const t of toks) {
        const norm = t.replace(/[.,;:'’]+$/, '').toLowerCase();
        if (norm.length < 4) continue;      // "LEN", "Tel", "AI" are noise, not identity
        if (STOP.has(norm)) continue;
        out.add(norm);
      }
      const full = run.toLowerCase();
      if (toks.length > 1 && full.length >= 8 && !toks.every(t => STOP.has(t.toLowerCase()))) out.add(full);
    }
  }
  return [...out];
}

function esc(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Word-boundary containment. Substring matching is how "Tel" passed for "Intel". */
function intersect(anchorList: string[], haystack: string): string[] {
  const hay = haystack.toLowerCase();
  return anchorList.filter(a => new RegExp(`(^|[^a-z0-9])${esc(a)}([^a-z0-9]|$)`, 'i').test(hay));
}

// ---------- component specs ----------
interface Component {
  name: string;
  draftPath: string | null;
  /** anchors the v1 section must intersect */
  anchorsOf: (draft: string) => string[];
  /** the v1 section to test */
  sectionOf: (v1: string) => string;
}

/**
 * Structural sub-headers that EVERY Take carries (the counter-case / call template). They are
 * boilerplate, never the framework identity, so a shared "**Where this breaks.**" is not evidence
 * the Writer CONSUMED the pre-draft — it is evidence they both used the house template.
 *
 * THE 07-18 BYPASS THIS EXISTS TO KILL (Critic mandate #3, RC1; E-WRITER-COMPONENT-BYPASS-01 4th+):
 * the take-draft was "The Withdrawal Option" (Netflix); the Writer shipped "The Alarm That Won't
 * Attenuate" (TSMC/DeepSeek). The gate PASSED the bypass because takeFramework's old `{3,60}` bold
 * match SKIPPED the framework's long lead bold ("**The Withdrawal Option: every voluntarily…**",
 * ~260 chars) and grabbed the first SHORT bold instead — the boilerplate "**Where this breaks.**",
 * which the substituted Take also carried. Excluding boilerplate makes the gate STRICTER (fewer
 * anchors ⇒ an empty intersection ⇒ a FAIL), which for an INTERSECTION test is the SAFE direction:
 * it can only convert a false PASS into a correct FAIL, never a healthy brief into a false stop.
 */
const TAKE_BOILERPLATE = new Set([
  'where this breaks', 'falsified if', 'the call', 'the trade', 'the setup', 'the discriminator',
  'what would change my mind', 'the counter-case', 'the counter case', 'where i could be wrong',
  'the projection', 'the wager', 'the bet',
]);

function takeFramework(raw: string): string[] {
  const out: string[] = [];
  const meta = raw.match(/^Framework:\s*(.+)$/m);
  if (meta) {
    // "Costly-Signal Collapse (Spence 1973 ...)" -> "Costly-Signal Collapse"
    const name = meta[1]!.split('(')[0]!.trim().replace(/[.:;]$/, '');
    if (name.length >= 4) out.push(name.toLowerCase());
  }
  const body = bodyFrom(raw);
  // The framework's lead bold can run a full sentence ("**The Withdrawal Option: every voluntarily
  // published number…**") — far past the old 60-char cap, so the old regex skipped it and matched
  // the first SHORT bold, which is the boilerplate counter-case header. Scan EVERY bold, reduce it
  // to its framework-name lead (the clause before the first colon/period), drop boilerplate, and
  // take the first real one. The cap is wide enough to reach the closing ** of a sentence-length bold.
  for (const m of body.matchAll(/\*\*([A-Z][^*]{3,400}?)\*\*/g)) {
    const lead = m[1]!.trim().split(/[:.]/)[0]!.trim().replace(/[.:;,]$/, '');
    const norm = lead.toLowerCase();
    if (norm.length < 4) continue;
    if (TAKE_BOILERPLATE.has(norm)) continue; // a template sub-header is not the framework
    out.push(norm);
    break;
  }
  const trig = raw.match(/^Primary trigger entity:\s*(.+)$/m);
  if (trig) out.push(...anchors(trig[1]!));
  return [...new Set(out)];
}

function buildComponents(dir: string, date: string): Component[] {
  const p = (suffix: string) => {
    const f = path.join(dir, `${date}-${suffix}.md`);
    return fs.existsSync(f) ? f : null;
  };
  return [
    {
      // The Take's identity IS its framework name — declared in the pre-draft metadata and bolded
      // in its lead. The Writer's job is to PLACE the pre-written Take, not re-derive one. Body
      // anchors are excluded on purpose: the Take's counter-case cites the day's other entities
      // (Israel, Korea, NVIDIA), and an incidental collision there is not evidence of consumption.
      name: 'Take',
      draftPath: p('take-draft'),
      anchorsOf: (d) => takeFramework(d),
      sectionOf: (v1) => extractSection(v1, /▸\s*THE TAKE/i, /^#\s*▸/),
    },
    {
      name: 'Signal',
      draftPath: p('signal-draft'),
      anchorsOf: (d) => anchors(bodyFrom(d)),
      sectionOf: (v1) => extractSection(v1, /^##\s+The Signal/i, /^#\s*▸/),
    },
    {
      name: 'Discovery',
      draftPath: p('discovery-draft'),
      anchorsOf: (d) => {
        const body = bodyFrom(d);
        const title = body.match(/^###\s+(.+)$/m);
        const a = anchors(body);
        if (title) a.push(title[1]!.trim().toLowerCase());
        return a;
      },
      sectionOf: (v1) => extractSection(v1, /▸\s*DISCOVERY/i, /^#\s*▸/),
    },
    {
      name: 'C&C',
      draftPath: p('cc-predraft'),
      anchorsOf: (d) => {
        // Candidate headlines are the load-bearing entities; the surrounding analysis is
        // full of comparison entities the Writer may legitimately not use.
        const heads = [...stripComments(d).matchAll(/^##\s*Candidate\s*\d+:\s*(.+)$/gim)].map(m => m[1]!);
        return heads.length ? [...new Set(heads.flatMap(h => anchors(h)))] : anchors(bodyFrom(d));
      },
      sectionOf: (v1) => extractSection(v1, /^##\s+Companies\s*&\s*Crypto/i, /^##\s|^#\s*▸/),
    },
  ];
}

// ---------- override protocol ----------
/**
 * Bypass must be POSSIBLE (the Architect may legitimately reject a pre-draft) but never SILENT.
 * A declared override — `PREDRAFT-OVERRIDE: <component> :: <reason of 20+ chars>` in v1 or in the
 * architect log — downgrades FAIL to FLAG. The override is counted, lands in pipeline-status, and
 * is graded by the Critic. This is the whole design: it converts a default behavior into a
 * conscious, attributable act, which is the only thing that has ever moved an RC1 failure.
 *
 * Honest residual: the Writer can emit the marker itself. That is acceptable — the failure class
 * was never dishonesty, it was FORGETTING. A declaration it must author is a declaration it must
 * think about, and the override RATE is now a trend line the improvement loop reads.
 */
export function overrideFor(component: string, v1: string, architectLog: string | null): string | null {
  const hay = v1 + '\n' + (architectLog ?? '');
  const alias = component === 'C&C' ? '(?:C&C|CC|Companies\\s*&\\s*Crypto)' : esc(component);
  const re = new RegExp(`PREDRAFT-OVERRIDE:\\s*${alias}\\s*::\\s*(.+)`, 'i');
  const m = hay.match(re);
  if (!m) return null;
  const reason = m[1]!.trim().replace(/-->.*$/, '').trim();
  return reason.length >= 20 ? reason : null; // a token is not a reason
}

// ---------- wholesale-bypass guard (IMP-073, 2026-07-19) ----------
/**
 * THE 07-19 BYPASS THIS EXISTS TO KILL (Critic mandate #2, RC1; E-WRITER-PREDRAFT-DISCOVERY
 * escalated to EMERGENCY — 07-15/07-16/07-18/07-19, the QG rescuing at ~47% rewrite). The Take-regex
 * fix (IMP-070) made Check A finally SEE the bypass — and the Writer answered by DECLARING a
 * `PREDRAFT-OVERRIDE` (or a fabricated "NONE FOUND") for ALL FOUR components at once. Every FAIL
 * downgraded to an advisory FLAG, `fails.length === 0`, and the BLOCKING Gate 6.5 exited 0 while the
 * reader got a brief the pipeline never designed. The override protocol had handed the default
 * behavior a way to author its own green light.
 *
 * A per-component override is a legitimate editorial act: the Architect may reject ONE stale
 * pre-draft. Overriding the WHOLE SLATE is not selection — it is abandoning the pre-draft system,
 * and no per-component reason excuses it. So a wholesale bypass is a FAIL that a declaration CANNOT
 * downgrade. RC1 primitive: the only thing a default behavior cannot ignore is an exit code, and
 * IMP-070 alone left the exit code purchasable with four comment lines.
 *
 * Threshold: >=3 of the components with a testable pre-draft not consumed, OR every pre-draft present
 * (>=2) not consumed. One or two overrides on a four-slate stay per-component FLAGs (selective, and
 * the Critic grades them); three-or-more, or all-of-them, is the wholesale class that shipped
 * 07-15 -> 07-19. The guard rides ALONGSIDE the per-component findings; it never rewrites them.
 */
export function isWholesaleBypass(notConsumed: number, present: number): boolean {
  if (notConsumed < 2) return false;
  return notConsumed >= 3 || (present >= 2 && notConsumed === present);
}

// ---------- Check A ----------
export function checkPredraftConsumption(v1: string, comps: Component[], architectLog: string | null = null): Finding[] {
  const findings: Finding[] = [];
  let present = 0;       // pre-drafts the gate could actually test (section + anchors both resolved)
  let notConsumed = 0;   // of those, how many share ZERO anchors with v1 — bypassed OR overridden
  const bypassed: string[] = [];
  for (const c of comps) {
    if (!c.draftPath) continue; // no pre-draft on disk → nothing to consume
    const draft = fs.readFileSync(c.draftPath, 'utf8');
    const section = c.sectionOf(v1);
    if (!section.trim()) {
      findings.push({
        check: 'A', severity: 'FLAG', component: c.name,
        message: `pre-draft exists (${path.basename(c.draftPath)}) but no ${c.name} section found in v1 — section extraction miss or a missing section.`,
      });
      continue;
    }
    const a = c.anchorsOf(draft);
    if (a.length === 0) {
      findings.push({
        check: 'A', severity: 'FLAG', component: c.name,
        message: `no anchors extractable from ${path.basename(c.draftPath)} — the gate cannot prove consumption either way.`,
      });
      continue;
    }
    present++;
    const hit = intersect(a, section);
    if (hit.length === 0) {
      notConsumed++;
      bypassed.push(c.name);
      const override = overrideFor(c.name, v1, architectLog);
      if (override) {
        findings.push({
          check: 'A', severity: 'FLAG', component: c.name,
          message:
            `PRE-DRAFT OVERRIDDEN (declared). v1's ${c.name} does not use ${path.basename(c.draftPath)}. ` +
            `Stated reason: "${override}". Counted; the Editor and Critic grade the override.`,
        });
        continue;
      }
      findings.push({
        check: 'A', severity: 'FAIL', component: c.name,
        message:
          `PRE-DRAFT BYPASSED. v1's ${c.name} section shares ZERO anchors with the gate-passed ` +
          `${path.basename(c.draftPath)}. The pre-draft was written, gated, and ignored. ` +
          `Pre-draft anchors (first 8): ${a.slice(0, 8).join(', ')}. ` +
          `REQUIRED: rewrite the ${c.name} FROM the pre-draft, or declare ` +
          `\`PREDRAFT-OVERRIDE: ${c.name} :: <reason>\`. The pre-draft is the input, not a suggestion.`,
      });
    }
  }
  // WHOLESALE guard (IMP-073): abandoning the whole slate is not a per-component decision and a
  // declaration cannot buy it a green light. This FAIL rides ALONGSIDE the per-component findings
  // (which keep their own FLAG/FAIL verdicts) and is NOT downgradable.
  if (isWholesaleBypass(notConsumed, present)) {
    findings.push({
      check: 'A-WHOLESALE', severity: 'FAIL', component: 'ALL',
      message:
        `WHOLESALE PRE-DRAFT BYPASS. ${notConsumed} of ${present} on-disk pre-drafts share ZERO anchors with v1 ` +
        `(${bypassed.join(', ')}). A per-component PREDRAFT-OVERRIDE excuses rejecting ONE stale pre-draft; ` +
        `it cannot excuse abandoning the pre-draft system. This FAIL is NOT downgradable by declarations ` +
        `(the 07-15 -> 07-19 class: four "NONE FOUND"/override lines authored a green light over a brief the ` +
        `pipeline never designed). REQUIRED: rebuild the bypassed sections FROM their pre-drafts, or the brief ` +
        `ships with the pre-draft bodies verbatim and one \`PREDRAFT-BYPASS: <component>\` line each in pipeline-status.`,
    });
  }
  return findings;
}

// ---------- Check B ----------
const KILL_VOCAB = /\b(do not use|do not publish|must not survive|is now false|are now false|blacklist|rejected sources?|pre-kill)\b/i;

export interface KillPattern { source: string; re: RegExp; reason: string; origin: 'contract' | 'legacy'; }

export function extractKillPatterns(intel: string): { patterns: KillPattern[]; killProseLines: number; contractLines: number } {
  const patterns: KillPattern[] = [];
  let killProseLines = 0;
  let contractLines = 0;

  for (const rawLine of intel.split('\n')) {
    const line = rawLine.trim();

    // 1. CONTRACT: KILL-PATTERN: /regex/flags :: reason   (or a plain literal)
    const contract = line.match(/KILL-PATTERN:\s*(.+)$/i);
    if (contract) {
      contractLines++;
      const rest = contract[1]!.replace(/-->\s*$/, '').trim();
      const [patPart, ...reasonParts] = rest.split('::');
      const reason = reasonParts.join('::').trim() || 'pre-killed by the intelligence file';
      const pat = patPart!.trim();
      const slash = pat.match(/^\/(.*)\/([gimsuy]*)$/);
      try {
        const re = slash
          ? new RegExp(slash[1]!, (slash[2] || '') + (slash[2]?.includes('i') ? '' : 'i'))
          : new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        patterns.push({ source: pat, re, reason, origin: 'contract' });
      } catch {
        // an unparseable pattern is itself a finding, surfaced by the caller as a FLAG
      }
      continue;
    }

    // 2. LEGACY: quoted literals inside a kill-vocabulary sentence.
    if (KILL_VOCAB.test(line)) {
      killProseLines++;
      const quoted = [...line.matchAll(/[“"']([^“”"']{5,90})[”"']/g)].map(m => m[1]!.trim());
      for (const q of quoted) {
        // Skip meta-quotes (a quoted directive rather than a quoted claim).
        if (KILL_VOCAB.test(q)) continue;
        if (!/[a-zA-Z]/.test(q)) continue;
        patterns.push({
          source: q,
          re: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'),
          reason: 'quoted claim inside a kill directive in the intelligence file',
          origin: 'legacy',
        });
      }
    }
  }
  return { patterns, killProseLines, contractLines };
}

export function checkPreKill(v1: string, intel: string | null): Finding[] {
  const findings: Finding[] = [];
  if (!intel) return findings;
  const { patterns, killProseLines, contractLines } = extractKillPatterns(intel);
  const body = stripComments(v1);

  for (const p of patterns) {
    const m = body.match(p.re);
    if (m) {
      findings.push({
        check: 'B', severity: 'FAIL', component: 'v1',
        message:
          `PRE-KILLED CLAIM SHIPPED. The intelligence file killed this before the draft existed ` +
          `[${p.origin}] "${p.source}" — reason: ${p.reason}. v1 contains: "${m[0].slice(0, 90)}". ` +
          `REQUIRED: cut or re-source the sentence. A pre-kill is not advice.`,
      });
    }
  }

  if (killProseLines > 0 && contractLines === 0) {
    findings.push({
      check: 'B', severity: 'FLAG', component: 'intel',
      message:
        `KILL-CONTRACT NOT ADOPTED: ${killProseLines} kill-directive line(s) in prose, zero KILL-PATTERN lines. ` +
        `Semantic kills (e.g. "any sentence that says the market prices cuts is now FALSE") cannot be grepped — ` +
        `the synthesizer must emit \`KILL-PATTERN: /regex/i :: reason\` for each. Until it does, only quoted literals are enforced.`,
    });
  }
  return findings;
}

// ---------- runner ----------
function run(v1Path: string, dir: string, date: string, intelPath: string | null): Finding[] {
  const v1 = fs.readFileSync(v1Path, 'utf8');
  const comps = buildComponents(dir, date);
  const intel = intelPath && fs.existsSync(intelPath) ? fs.readFileSync(intelPath, 'utf8') : null;
  const logPath = path.join(dir, `${date}-architect-log.md`);
  const architectLog = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : null;
  return [...checkPredraftConsumption(v1, comps, architectLog), ...checkPreKill(v1, intel)];
}

function resolveV1(dir: string, date: string): string | null {
  for (const s of ['-v1.md', '-v1-pre-quality-gate.md']) {
    const f = path.join(dir, `${date}${s}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

/**
 * THE SHIP-STAGE (IMP-084, 2026-07-21). The gate ran only on v1 — the Writer's own output — and was
 * "blocking" only by INSTRUCTING the Writer session to re-run it. An LLM that ignores its pre-drafts
 * also ignores that instruction: on 07-21 the wholesale bypass sailed through the Writer AND survived
 * the QG into v1.5 (the QG did not restore — the Editor did, 3/4), and the un-restored DISCOVERY
 * bypass SHIPPED. The fix is to run the gate on the artifacts that flow DOWNSTREAM — v1.5 at the QG→
 * Editor handoff, v2 at publish — because those layers demonstrably run and gating their OUTPUT does
 * not depend on the Writer's goodwill. Default stays v1 for back-compat.
 */
function resolveStage(dir: string, date: string, stage: string): string | null {
  if (stage === 'v2') { const f = path.join(dir, `${date}-v2.md`); return fs.existsSync(f) ? f : null; }
  if (stage === 'v1.5') { const f = path.join(dir, `${date}-v1.5.md`); return fs.existsSync(f) ? f : null; }
  return resolveV1(dir, date);
}

// ---------- selftest ----------
function selftest(): number {
  const root = process.cwd();
  const dir = path.join(root, 'daily-briefs');
  const intelDir = path.join(root, 'daily-intelligence');
  // Fixtures go to the OS tmpdir, never the repo mount: the Cowork mount forbids unlink,
  // and a selftest that litters the pipeline's own input directory is a landmine.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predraft-gate-'));
  const results: { name: string; pass: boolean; detail: string }[] = [];
  const assert = (name: string, pass: boolean, detail = '') => results.push({ name, pass, detail });

  // --- REAL ARTIFACT 1: 07-12 v1 must FIRE on all four components (the EMERGENCY) ---
  const v1_12 = resolveV1(dir, '2026-07-12');
  if (v1_12) {
    const f = checkPredraftConsumption(fs.readFileSync(v1_12, 'utf8'), buildComponents(dir, '2026-07-12'));
    const failed = f.filter(x => x.severity === 'FAIL').map(x => x.component);
    for (const c of ['Take', 'Signal', 'Discovery', 'C&C']) {
      assert(`A FIRES on REAL 07-12 ${c} (pre-draft bypassed)`, failed.includes(c), `failed=[${failed.join(',')}]`);
    }
  } else {
    assert('A: 07-12 v1 present', false, 'fixture missing');
  }

  // --- REAL ARTIFACT 2: 07-11 and 07-10 v1 must be SILENT (the Writer consumed all four) ---
  for (const d of ['2026-07-11', '2026-07-10']) {
    const v1h = resolveV1(dir, d);
    if (v1h) {
      const f = checkPredraftConsumption(fs.readFileSync(v1h, 'utf8'), buildComponents(dir, d));
      const failed = f.filter(x => x.severity === 'FAIL');
      assert(`A SILENT on REAL ${d.slice(5)} (healthy: all pre-drafts consumed)`, failed.length === 0,
        failed.map(x => `${x.component}`).join(',') || 'clean');
    } else {
      assert(`A: ${d} v1 present`, false, 'fixture missing');
    }
  }

  // --- REAL ARTIFACT 3: the class is CHRONIC, not Day 1. 07-09's Writer discarded the
  //     take-draft ("The Formation Gate" -> shipped "Floor Migration") and the discovery-draft
  //     ("Why the Languages Spoken by Millions Are the Simplest" -> shipped "The Janitor Shift"),
  //     and unlike 07-12 the QG did NOT restore them: both substitutes PUBLISHED. If this gate had
  //     existed, it would have fired three days earlier. Asserting it, so a future refactor that
  //     silently narrows the gate to the 07-12 shape fails here. ---
  const v1_09 = resolveV1(dir, '2026-07-09');
  if (v1_09) {
    const f = checkPredraftConsumption(fs.readFileSync(v1_09, 'utf8'), buildComponents(dir, '2026-07-09'));
    const failed = f.filter(x => x.severity === 'FAIL').map(x => x.component);
    assert('A FIRES on REAL 07-09 Take + Discovery (chronic bypass — these PUBLISHED)',
      failed.includes('Take') && failed.includes('Discovery'), `failed=[${failed.join(',')}]`);
  }

  // --- REAL ARTIFACT 4: 07-18 Take bypass (E-WRITER-COMPONENT-BYPASS-01 4th+ occurrence, IMP-070).
  //     The take-draft was "The Withdrawal Option" (Netflix); v1 shipped "The Alarm That Won't
  //     Attenuate" (TSMC/DeepSeek). The gate MISSED this until the boilerplate fix: takeFramework's
  //     old 60-char bold cap skipped the framework's long lead and matched "**Where this breaks.**",
  //     a counter-case header the substitute also carried, so the intersection was non-empty and the
  //     bypass PASSED — the Critic caught it by hand. With boilerplate excluded, the only Take anchors
  //     are the framework name + trigger entity (Netflix/NFLX), which the substitute does not carry. ---
  const v1_18 = resolveV1(dir, '2026-07-18');
  if (v1_18) {
    const f = checkPredraftConsumption(fs.readFileSync(v1_18, 'utf8'), buildComponents(dir, '2026-07-18'));
    const takeFailed = f.some(x => x.severity === 'FAIL' && x.component === 'Take');
    assert('A FIRES on REAL 07-18 Take (boilerplate "where this breaks" no longer rescues a bypass)',
      takeFailed, `findings=[${f.map(x => x.component + ':' + x.severity).join(',') || 'none'}]`);
  }

  // --- OVERRIDE PROTOCOL: a declared override downgrades FAIL -> FLAG; a token does not ---
  if (v1_12) {
    const raw = fs.readFileSync(v1_12, 'utf8');
    const withOverride = `<!-- PREDRAFT-OVERRIDE: Take :: the take-draft's fertility data failed morning verification -->\n` + raw;
    const f = checkPredraftConsumption(withOverride, buildComponents(dir, '2026-07-12'));
    const take = f.find(x => x.component === 'Take');
    assert('A: declared override downgrades Take FAIL to FLAG', take?.severity === 'FLAG', take?.severity ?? 'none');

    const withToken = `<!-- PREDRAFT-OVERRIDE: Take :: n/a -->\n` + raw;
    const f2 = checkPredraftConsumption(withToken, buildComponents(dir, '2026-07-12'));
    const take2 = f2.find(x => x.component === 'Take');
    assert('A: a reasonless override does NOT suppress the FAIL', take2?.severity === 'FAIL', take2?.severity ?? 'none');
  }

  // --- WHOLESALE-OVERRIDE GUARD (IMP-073, 2026-07-19 — the 07-19 bypass that shipped): declaring an
  //     override for the WHOLE slate cannot buy a green light. Unit thresholds + integrated, both ways. ---
  assert('WHOLESALE: 4 of 4 not consumed is wholesale', isWholesaleBypass(4, 4) === true);
  assert('WHOLESALE: 3 of 4 not consumed is wholesale', isWholesaleBypass(3, 4) === true);
  assert('WHOLESALE: all present (2 of 2) not consumed is wholesale', isWholesaleBypass(2, 2) === true);
  assert('WHOLESALE: 2 of 4 is NOT wholesale (selective override stays per-component)', isWholesaleBypass(2, 4) === false);
  assert('WHOLESALE: 1 of 4 is NOT wholesale', isWholesaleBypass(1, 4) === false);
  assert('WHOLESALE: 0 of 4 (healthy) is NOT wholesale', isWholesaleBypass(0, 4) === false);
  if (v1_12) {
    const raw = fs.readFileSync(v1_12, 'utf8');
    const allOver =
      `<!-- PREDRAFT-OVERRIDE: Take :: the take-draft failed morning verification this evening -->\n` +
      `<!-- PREDRAFT-OVERRIDE: Signal :: the signal-draft's lead entity was pre-killed by the intel file -->\n` +
      `<!-- PREDRAFT-OVERRIDE: Discovery :: the discovery-draft duplicated a prior domain and was rejected -->\n` +
      `<!-- PREDRAFT-OVERRIDE: C&C :: the cc-predraft candidates were all stale by publish tonight -->\n` + raw;
    const fWhole = checkPredraftConsumption(allOver, buildComponents(dir, '2026-07-12'));
    assert('WHOLESALE FIRES on 07-12 with ALL FOUR declared overrides (declarations cannot downgrade the slate)',
      fWhole.some(x => x.severity === 'FAIL' && x.component === 'ALL'),
      `findings=[${fWhole.map(x => x.component + ':' + x.severity).join(',')}]`);
    // the wholesale FAIL rides ALONGSIDE the per-component verdict — the Take's own declaration still
    // downgrades ITS finding to FLAG; the guard does not rewrite it, it adds to it.
    assert('WHOLESALE: the per-component override still downgrades its own finding to FLAG',
      fWhole.some(x => x.component === 'Take' && x.severity === 'FLAG'), '');
  }
  // SILENT: a healthy brief (all four pre-drafts consumed) raises NO wholesale FAIL.
  const v1_11w = resolveV1(dir, '2026-07-11');
  if (v1_11w) {
    const fHealthy = checkPredraftConsumption(fs.readFileSync(v1_11w, 'utf8'), buildComponents(dir, '2026-07-11'));
    assert('WHOLESALE SILENT on healthy 07-11 (nothing bypassed → no wholesale FAIL)',
      !fHealthy.some(x => x.component === 'ALL'),
      fHealthy.filter(x => x.component === 'ALL').map(x => x.severity).join(',') || 'clean');
  }

  // --- SHIP-STAGE (IMP-084, 2026-07-21): the gate must bite the artifacts that flow DOWNSTREAM, not
  //     just the Writer's v1. On 07-21 the wholesale bypass SURVIVED the QG into v1.5 (the QG did not
  //     restore — the Editor did, 3/4), and the un-restored DISCOVERY bypass SHIPPED in v2. Gating v1.5
  //     (QG handoff) and v2 (publish) is the enforcement, because those layers demonstrably run. Both
  //     directions proven on the REAL 07-21 artifacts. ---
  const v15_21 = path.join(dir, '2026-07-21-v1.5.md');
  if (fs.existsSync(v15_21)) {
    const f = checkPredraftConsumption(fs.readFileSync(v15_21, 'utf8'), buildComponents(dir, '2026-07-21'));
    assert('SHIP-STAGE: wholesale bypass SURVIVED the QG into the REAL 07-21 v1.5 (the receipt the ship-gate exists for)',
      f.some(x => x.severity === 'FAIL' && x.component === 'ALL'),
      `findings=[${f.map(x => x.component + ':' + x.severity).join(',') || 'none'}]`);
  }
  const v2_21 = path.join(dir, '2026-07-21-v2.md');
  if (fs.existsSync(v2_21)) {
    const f = checkPredraftConsumption(fs.readFileSync(v2_21, 'utf8'), buildComponents(dir, '2026-07-21'));
    assert('SHIP-STAGE: the DISCOVERY bypass SURVIVED the Editor into the REAL 07-21 v2 (it shipped un-gated)',
      f.some(x => x.severity === 'FAIL' && x.component === 'Discovery'),
      `findings=[${f.map(x => x.component + ':' + x.severity).join(',') || 'none'}]`);
  }
  // resolveStage maps each stage to the right artifact.
  assert('SHIP-STAGE: resolveStage maps v2 → -v2.md',
    (resolveStage(dir, '2026-07-21', 'v2') ?? '').endsWith('2026-07-21-v2.md'));
  assert('SHIP-STAGE: resolveStage maps v1.5 → -v1.5.md',
    (resolveStage(dir, '2026-07-21', 'v1.5') ?? '').endsWith('2026-07-21-v1.5.md'));

  // --- B CONTRACT: the REAL 07-12 v1 vs the KILL-PATTERN the 07-11 intel directive
  //     ("any brief sentence that says 'the market prices cuts' is now FALSE. That line
  //      must not survive contact with tonight's draft") WOULD have emitted under the contract.
  //     The Critic: "Today's v1 would have hard-failed on the Fed sentence alone." Proven here.
  if (v1_12) {
    const intelFixture =
      'KILL-PATTERN: /two Fed cuts embedded|market prices cuts|swap markets have two Fed cuts/i :: ' +
      'the crowded side flipped from dovish to hawkish; any sentence saying the market prices cuts is FALSE\n';
    const f = checkPreKill(fs.readFileSync(v1_12, 'utf8'), intelFixture);
    assert('B FIRES on REAL 07-12 v1 (pre-killed Fed-cut sentence, contract pattern)',
      f.some(x => x.severity === 'FAIL' && /Fed cuts/i.test(x.message)),
      f.map(x => x.severity).join(',') || 'none');
    // and SILENT when the pattern does not match the draft
    const f2 = checkPreKill(fs.readFileSync(v1_12, 'utf8'),
      'KILL-PATTERN: /the Bank of Japan has abandoned yield curve control/i :: fabricated mechanism\n');
    assert('B SILENT on a contract pattern the draft does not contain',
      !f2.some(x => x.severity === 'FAIL'), f2.map(x => x.message.slice(0, 30)).join('|') || 'clean');
  }

  // --- B LEGACY on the REAL 07-12 intelligence file (the rejected-source price class) ---
  const intel12 = path.join(intelDir, '2026-07-12-intelligence.md');
  if (fs.existsSync(intel12) && v1_12) {
    const intelText = fs.readFileSync(intel12, 'utf8');
    const { patterns } = extractKillPatterns(intelText);
    assert('B LEGACY extracts banned literals from the REAL 07-12 intel (REJECTED SOURCES)',
      patterns.some(p => /Brent/i.test(p.source)), patterns.slice(0, 3).map(p => p.source).join(' | ') || 'none');

    // FIRE direction: the real v1 with the rejected price injected (the fabrication we were warned about).
    const injected = fs.readFileSync(v1_12, 'utf8').replace(
      /## Markets & Macro/, '## Markets & Macro\n\n- **Brent $112.93 / WTI $108.21 on the Hormuz closure.**');
    const fFire = checkPreKill(injected, intelText);
    assert('B FIRES on a v1 carrying a REJECTED-SOURCE price from the real intel file',
      fFire.some(x => x.severity === 'FAIL' && /Brent/i.test(x.message)), fFire.map(x => x.severity).join(',') || 'none');

    // SILENT direction: the real v1 (the Writer did not use the rejected prices).
    const fSilent = checkPreKill(fs.readFileSync(v1_12, 'utf8'), intelText);
    assert('B SILENT on the REAL 07-12 v1 (rejected prices correctly unused)',
      !fSilent.some(x => x.severity === 'FAIL'),
      fSilent.filter(x => x.severity === 'FAIL').map(x => x.message.slice(0, 60)).join('|') || 'clean');

    // ADOPTION FLAG fires (the real intel has kill prose and no KILL-PATTERN lines yet).
    assert('B FLAGS un-mechanized kill prose (contract not yet adopted)',
      fSilent.some(x => x.severity === 'FLAG' && /KILL-CONTRACT NOT ADOPTED/.test(x.message)), '');
  }

  // --- A must not false-fire when a section legitimately keeps only ONE anchor ---
  // Synthetic: a v1 whose Take keeps the framework name and nothing else.
  try {
    fs.writeFileSync(path.join(tmp, '2026-01-01-take-draft.md'),
      '<!-- TAKE DRAFT METADATA\nFramework: Costly-Signal Collapse (Spence 1973)\nPrimary trigger entity: AI-in-education\n-->\n\n# ▸ THE TAKE\n\n**Costly-Signal Collapse.** A signal transmits information only when it is differentially costly.\n');
    const v1min = '# ▸ THE TAKE\n\n**Costly-Signal Collapse.** Something entirely rewritten, with no other shared nouns whatsoever.\n\n# ▸ INNER GAME\n';
    const f = checkPredraftConsumption(v1min, buildComponents(tmp, '2026-01-01'));
    assert('A SILENT when v1 keeps only the framework name (minimum legitimate consumption)',
      f.filter(x => x.severity === 'FAIL').length === 0, JSON.stringify(f.map(x => x.component)));

    const v1none = '# ▸ THE TAKE\n\n**The Chokepoint Premium.** Two monopolists sell complementary goods.\n\n# ▸ INNER GAME\n';
    const f2 = checkPredraftConsumption(v1none, buildComponents(tmp, '2026-01-01'));
    assert('A FIRES on a wholly substituted Take (synthetic control)',
      f2.some(x => x.severity === 'FAIL' && x.component === 'Take'), '');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* tmpdir cleanup is best-effort */ }
  }

  console.log('predraft-consumption-gate --selftest');
  let failed = 0;
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail && !r.pass ? ` — ${r.detail}` : ''}`);
    if (!r.pass) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} assertions passed.`);
  if (failed) {
    console.error('✗ SELFTEST FAILED — the gate does not bite the real failure or false-fires on a healthy one.');
    return 1;
  }
  console.log('✓ Both directions proven on REAL artifacts (07-12 fires, 07-11 silent).');
  return 0;
}

// ---------- main ----------
function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const advisory = args.includes('--advisory');
  const si = args.indexOf('--stage');
  const stage = si >= 0 && ['v1', 'v1.5', 'v2'].includes(args[si + 1] ?? '') ? args[si + 1]! : 'v1';
  const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!dateArg) {
    console.error('Usage: predraft-consumption-gate.ts <YYYY-MM-DD> [--stage v1|v1.5|v2] [--advisory]');
    console.error('       predraft-consumption-gate.ts --selftest');
    return 2;
  }
  const root = process.cwd();
  const dir = path.join(root, 'daily-briefs');
  const v1Path = resolveStage(dir, dateArg, stage);
  if (!v1Path) {
    console.error(`No ${stage} artifact found for ${dateArg} in daily-briefs/ (v1 looks for -v1.md / -v1-pre-quality-gate.md; v1.5 → -v1.5.md; v2 → -v2.md)`);
    return 2;
  }
  const intelPath = path.join(root, 'daily-intelligence', `${dateArg}-intelligence.md`);

  const findings = run(v1Path, dir, dateArg, fs.existsSync(intelPath) ? intelPath : null);
  const fails = findings.filter(f => f.severity === 'FAIL');
  const flags = findings.filter(f => f.severity === 'FLAG');

  console.log(`predraft-consumption-gate — ${path.basename(v1Path)} · ${fails.length} FAIL · ${flags.length} FLAG`);
  for (const f of findings) {
    console.log(`  ${f.severity === 'FAIL' ? '✗' : '⚠'} [${f.check}] ${f.component}: ${f.message}`);
  }
  if (!findings.length) console.log('  ✓ every on-disk pre-draft is present in v1; no pre-killed claim shipped.');

  if (fails.length && !advisory) {
    console.error(
      '\n✗ PRE-DRAFT / PRE-KILL GATE FAILED. The Writer did not consume its inputs.\n' +
      '  Regenerate the offending section(s) FROM the pre-draft and re-run. One regeneration; if it still\n' +
      '  fails, replace the section with the pre-draft body verbatim and write PREDRAFT-BYPASS to pipeline-status.');
    return 1;
  }
  return 0;
}

process.exit(main());
