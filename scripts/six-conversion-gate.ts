#!/usr/bin/env node --experimental-strip-types
/**
 * six-conversion-gate.ts — the "Six Conversion" detectors.
 *
 * The 2026-07-07 Critic named the binding constraint on Must-Read as SIX
 * CONVERSION: the assembly is strong, but individual sections stop at "Earns
 * Space" because they DESCRIBE instead of RANK, SERVE THE TAKE instead of
 * standing independent, and CONFIRM a truism instead of INVERTING an
 * assumption. Three MUST-BE-BETTER mandates, three days of prose that did not
 * land (M&M "rank the disagreement" was mandated 07-06 AND 07-07 and NOT LANDED
 * both times). Per Root Cause Library, a Writer/Generator rule that fails twice
 * escalates to a mechanical/Editor gate. This is that gate.
 *
 * It is ADVISORY by default (the brief always ships — Pipeline_Controller Rule 1);
 * findings feed the Editor as REJECT-and-replace signals. --strict exits non-zero
 * (for opt-in hard enforcement). --selftest is the mechanical PROOF the acceptance
 * gate requires: it asserts each detector BITES on the real failure text (07-07 for
 * A/B/C, 07-08 for D/E/F, 07-09 for G/H, 07-10 for I/J) AND stays SILENT on a healthy counter-fixture.
 * Exit 0 iff all twenty-one assertions pass.
 *
 * Checks:
 *   A. M&M analytical-evasion (RC4/RC1) — data contradiction hedged without a ranking verdict.
 *   B. AI&T Take-dependency  (RC3)     — >=2 AI&T bullet leads center on Take entities.
 *   C. Inner Game inversion  (RC5)     — section lacks an assumption->inversion scaffold.
 *   D. C&C domain concentration (RC5)  — every Companies & Crypto bullet is crypto/DeFi (zero corporate).
 *   E. Geo cross-theater synthesis (RC4) — >=3 theaters as parallel tracks, no connecting-mechanism bullet.
 *   F. Signal undercoverage (RC4)      — a Signal ships as labeled "Context signal" / lacks an undercoverage warrant.
 *  (D/E/F added 2026-07-08 from the 07-08 Critic's three MUST-BE-BETTER mandates. E/F are
 *   STRUCTURAL PROXIES like C — they force the frame; the Critic still judges the substance.)
 *   G. Take assembled-known ceiling (RC4) - Take names NO specialized-literature concept (all building blocks intro-course-level).
 *   H. Discovery mainstream mechanism (RC4) - Discovery mechanism is a mainstream-longevity term with no beyond-mainstream novelty warrant.
 *   (G/H added 2026-07-09 from the 07-09 Critic mandates #1 and #3; STRUCTURAL PROXIES, Editor may waive a false-fire with a logged reason.)
 *   I. M&M gold-regime fatigue (RC4)   - an M&M gold bullet restates the regime ("the regime call stands", "noise within it") without naming the trigger that would break it.
 *   J. AI&T consensus synthesis (RC4)  - the AI&T synthesis lands on "value migrates from the model layer to the application layer" without specifying WHERE value differentially accrues.
 *   (I/J added 2026-07-10 from the 07-10 Critic mandates #1 and #2; STRUCTURAL PROXIES like C/E/G/H — the Editor may waive a false-fire with a logged reason.)
 *
 * Usage:
 *   npx tsx scripts/six-conversion-gate.ts --selftest         # proof, exit 0/1
 *   npx tsx scripts/six-conversion-gate.ts <brief.md>         # advisory report, exit 0
 *   npx tsx scripts/six-conversion-gate.ts <brief.md> --strict # exit 1 if any finding
 *
 * Wired into: Brief_Editor.md (REJECT gate 4.5), Markets_Macro_Generator.md,
 * AI_Tech_Generator.md, Inner_Game_Generator.md, CC_PreDraft_Generator.md,
 * Geopolitics_Generator.md, Signal_Generator.md, Brief_Architect.md,
 * Pipeline_Controller.md morning spot-check; ledger IMP-012/013/014/015/016/017/020/021.
 */
import * as fs from 'fs';

// ---------- section extraction ----------
function extractSection(md: string, startRe: RegExp): string {
  const lines = md.split('\n');
  const i = lines.findIndex(l => startRe.test(l));
  if (i === -1) return '';
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (/^#{1,6}\s/.test(l)) break;   // next header ends the section
    if (/^---\s*$/.test(l)) break;    // section divider ends the section
    out.push(l);
  }
  return out.join('\n');
}

// ---------- Check A: M&M analytical evasion ----------
const MM_EVASION = [
  'unreliable as a standalone', 'either report unreliable', 'make either report unreliable',
  'both may be unreliable', 'both reports unreliable', 'both readings unreliable',
  'neither reading is reliable', 'neither report is reliable', 'too close to call',
  'hard to say which', 'impossible to say which', 'no way to know which',
  'either could be right', 'take your pick', 'the jury is out',
  "can't tell which", 'cannot tell which', 'anyone’s guess', "anyone's guess",
];
// Ranking verdicts = the section commits to WHICH read to trust. NOTE: deferral
// phrases ("watch X for the tie-break", "wait for") are deliberately NOT ranking —
// the 07-07 bullet deferred to JOLTS and the Critic still ruled it evasion.
const MM_RANKING = [
  'more reliable', 'more trustworthy', 'more credible', 'more accurate',
  'the better read', 'better read is', 'the reliable read is', 'the truer read',
  'is the truer', 'trust the', 'we trust', 'believe the', 'defer to the',
  'weight the', 'we side with', 'side with the', 'leans toward', 'lean toward',
  'the signal to trust', 'carries more weight', 'weigh the', 'the more telling',
  'discount the', 'we discount', 'favor the', 'the read that wins',
];
function checkMM(section: string): string | null {
  if (!section.trim()) return null;
  const lc = section.toLowerCase();
  const evasion = MM_EVASION.find(p => lc.includes(p.toLowerCase()));
  if (!evasion) return null;
  const ranked = MM_RANKING.some(p => lc.includes(p.toLowerCase()));
  if (ranked) return null; // hedged but also ranked -> analysis happened, benefit of doubt
  return `M&M hedges a data contradiction ("${evasion}") without ranking which read to trust. RANK it: name the more reliable indicator, why, and the investment implication.`;
}

// ---------- Check B: AI&T Take-dependency ----------
const LEAD_STOP = new Set([
  'The','A','An','This','That','These','Those','In','On','At','When','After','Before',
  'Two','Both','Its','Their','His','Her','As','With','For','But','And','If','While','Now',
]);
function leadEntity(bold: string): string | null {
  // first Capitalized proper-noun token in the bolded lead, skipping leading stopwords
  const toks = bold.match(/[A-Z][a-zA-Z0-9]+/g);
  if (!toks) return null;
  for (const t of toks) { if (!LEAD_STOP.has(t)) return t; }
  return null;
}
function boldLeads(section: string): string[] {
  const leads: string[] = [];
  for (const line of section.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue;
    const m = line.match(/\*\*(.+?)\*\*/);
    if (m) leads.push(m[1]!);
  }
  return leads;
}
function checkAIT(aitSection: string, takeSection: string): string | null {
  if (!aitSection.trim() || !takeSection.trim()) return null;
  const leads = boldLeads(aitSection);
  const ents = leads.map(leadEntity).filter((e): e is string => !!e);
  if (ents.length < 2) return null;
  const overlap = ents.filter(e => new RegExp(`\\b${e}\\b`).test(takeSection));
  if (overlap.length >= 2) {
    return `AI&T serves the Take, not the reader: ${overlap.length} of ${ents.length} bullet leads (${[...new Set(overlap)].join(', ')}) are the Take's own subjects. Allocate >=1 AI&T bullet to a story with NO connection to the Take's thesis.`;
  }
  return null;
}

// ---------- Check C: Inner Game inversion ----------
const INVERSION = [
  'you would assume', "you'd assume", 'you assume', 'you would think', "you'd think",
  'you think', 'you would expect', "you'd expect", 'you might expect', 'you expect',
  'it seems obvious', 'seems obvious', 'the intuition', 'intuitively', 'conventional wisdom',
  'most people believe', 'most people think', 'we assume', 'we tend to', 'you tend to',
  'counterintuitive', 'counterintuitively', 'the opposite is true', 'the reverse is true',
  'but in fact', 'turns out', 'is backwards', 'the surprise', 'contrary to', 'against intuition',
  'not what you', 'the twist', 'wrong about', "you're wrong", 'you are wrong',
  'the mistake', 'you would guess',
];
function checkInnerGame(section: string): string | null {
  if (!section.trim()) return null;
  const lc = section.toLowerCase();
  const hasInversion = INVERSION.some(p => lc.includes(p.toLowerCase()));
  if (hasInversion) return null;
  return `Inner Game confirms an idea instead of inverting one — no assumption->inversion scaffold present. Start from a belief the reader holds and demonstrate it is WRONG (e.g. "You'd assume X. Actually Y.").`;
}

// ---------- shared bullet helper ----------
function bulletLines(section: string): string[] {
  return section.split('\n').filter(l => /^\s*[-*]\s/.test(l));
}

// ---------- Check D: C&C domain concentration ----------
// Companies & Crypto must not be 100% crypto/DeFi — it is a two-domain section by
// definition. Fires when every bullet is crypto/DeFi (zero corporate/industrial).
// 07-08: all 3 C&C bullets were crypto (Coinbase FCA, UK FCA, Solana RWA) on the day
// Samsung posted the best semiconductor quarter in 40 years. Clean mechanical count.
const CRYPTO_TERMS = [
  'crypto', 'bitcoin', 'btc', 'ethereum', 'defi', 'stablecoin', 'tokeniz',
  'solana', 'coinbase', 'blockchain', 'on-chain', 'onchain', 'web3',
  'digital asset', 'real-world asset', ' rwa', 'binance', 'staking', 'mica',
  'ondo ', 'genius act', 'crypto-native', 'kraken', 'ripple', ' xrp', 'dogecoin',
];
function isCrypto(bullet: string): boolean {
  const lc = bullet.toLowerCase();
  return CRYPTO_TERMS.some(t => lc.includes(t));
}
function checkCC(section: string): string | null {
  if (!section.trim()) return null;
  const bullets = bulletLines(section);
  if (bullets.length < 2) return null; // need >=2 bullets to call it concentration
  const crypto = bullets.filter(isCrypto).length;
  if (crypto === bullets.length) {
    return `Companies & Crypto is ${crypto}/${bullets.length} crypto/DeFi with zero corporate coverage. Reallocate >=1 bullet to a non-crypto corporate/industrial story (earnings, M&A, a margin/cycle read, a business-model shift) — mandatory on any day a major industrial/technology company reports.`;
  }
  return null;
}

// ---------- Check E: Geo cross-theater synthesis (structural proxy) ----------
// The Geo section shows the full board; on a multi-theater day it should carry ONE
// bullet that CONNECTS two theaters via a shared mechanism instead of running them as
// parallel tracks. Keyed on the PRESENCE of an integration construct (not raw theater
// co-occurrence — on 07-08 the NATO summit was the backdrop across several bullets, so
// naive two-theater counting false-silences). This is a floor; the Critic judges truth.
const GEO_SYNTHESIS = [
  'two fronts of the same', 'the same fault line', 'the same fault', 'the through-line',
  'the through line', 'the common thread', 'the connective tissue', 'the same vacuum',
  'the same weakness', 'the same pressure', 'exploits the same', 'probing the same',
  'testing the same', 'the same crisis', 'ties the two', 'across both theaters',
  'across two theaters', 'links the two', 'the link between', 'connect the two',
  'connects the two', 'the same actor', 'the same underlying', 'the same fracture',
  'mirror image', 'the same opening', 'the same rift', 'both theaters', 'two theaters',
  'the same story playing out', 'the same dynamic in',
];
function checkGeo(section: string): string | null {
  if (!section.trim()) return null;
  const bullets = bulletLines(section);
  if (bullets.length < 3) return null; // synthesis is expected only on multi-theater days
  const lc = section.toLowerCase();
  if (GEO_SYNTHESIS.some(p => lc.includes(p))) return null;
  return `Geopolitics runs ${bullets.length} theaters as parallel tracks with no cross-theater synthesis. Add ONE bullet (or clause) that CONNECTS two theaters via a shared mechanism, e.g. "Hormuz and NATO are two fronts of the same test — the alliance pledging to protect shipping lanes just had its strongest member question its worth, the opening Iran is probing." (A single synthesis bullet naming two theaters does NOT violate the max-1-bullet-per-theater rule.)`;
}

// ---------- Check F: Signal undercoverage ambition (structural proxy) ----------
// For Must-Read BOTH Signals must be genuinely undercovered ("no desk has assembled
// this"). The system already self-labels a well-covered signal "Context signal:" per
// Signal_Generator's BOTH-SIGNALS LABEL RULE — that label is its own admission the
// ambition floor was not met. Fires on the label OR on a signal lacking an
// undercoverage warrant. Non-gameable: removing the label to dodge the gate trips the
// existing Signal_Generator 🔴 label rule.
const UNDERCOVERAGE = [
  'nobody has noticed', 'almost nobody', 'no one has noticed', 'has noticed', 'unnoticed',
  'no major desk', 'no desk has', 'undercovered', 'under-covered', 'no one has assembled',
  'has not been assembled', 'no one has connected', 'nobody is connecting', 'the market still prices',
  'undercoverage', 'rarely assembles', 'rarely assembled', 'no desk assembles',
  'the market has filed', 'filed under', 'investors miss', 'most investors miss', 'the market hasn',
  'not yet priced', 'mispriced', 'overlooked', 'no one is writing', 'the trade no one',
  'consensus misses', 'the market is not pricing', 'still prices', 'no one else has', 'few are pricing',
];
function signalBlocks(section: string): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const l of section.split('\n')) {
    if (/^\s*(?:[-*]\s+)?\*\*/.test(l)) { // a bold-lead line (bare **… or "- **…") starts a new signal block
      if (cur.length) blocks.push(cur.join('\n'));
      cur = [l];
    } else if (cur.length) {
      cur.push(l);
    }
  }
  if (cur.length) blocks.push(cur.join('\n'));
  return blocks;
}
function checkSignal(section: string): string | null {
  if (!section.trim()) return null;
  const blocks = signalBlocks(section);
  if (blocks.length < 2) return null; // need the pair to require BOTH undercovered
  const contextLabeled = /context signal/i.test(section);
  const undercovered = blocks.filter(b => {
    const lc = b.toLowerCase();
    return UNDERCOVERAGE.some(p => lc.includes(p)) && !/context signal/i.test(b);
  }).length;
  if (contextLabeled || undercovered < blocks.length) {
    return `Signal section: ${undercovered}/${blocks.length} signals carry an undercoverage warrant${contextLabeled ? ' (one is a labeled "Context signal" — the system\'s own admission it is well-covered)' : ''}. For Must-Read BOTH signals must be genuinely undercovered ("no desk has assembled this"). Replace the context/consensus signal from the bench with an undercovered structural thesis, or accept it ships as labeled context.`;
  }
  return null;
}

// ---------- deep section extractor (keeps a "### subhead" body) ----------
// The Take and Discovery each carry a "### title" under their "# ▸ SECTION" header, and
// the generic extractSection() truncates on that "###" line — so a naive extract of THE
// TAKE returns an empty stub. extractDeep captures from the section header to the next
// TOP-LEVEL "# " header or a "---" divider, keeping the "###" subhead and its prose.
function extractDeep(md: string, startRe: RegExp): string {
  const lines = md.split('\n');
  const i = lines.findIndex(l => startRe.test(l));
  if (i === -1) return '';
  const out: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (/^#\s/.test(l)) break;        // next TOP-LEVEL header ends it ("###" subheads are kept)
    if (/^---\s*$/.test(l)) break;    // section divider ends it
    out.push(l);
  }
  return out.join('\n');
}

// ---------- Check G: Take assembled-known ceiling (structural proxy) ----------
// The Take hits a "novelty ceiling" when every building block is an intro-course concept
// (07-07 deployment premium, 07-08 demand-driven substitution, 07-09 adjustment cost
// asymmetry — 3 consecutive per the Critic; the 4th trips E-TAKE-ASSEMBLED-KNOWN-CEILING-01
// to red). The Editor's prose "component test" (Take_Generator/Gate 5) failed to hold it,
// so per Root Cause Library it escalates to a mechanical gate. PROXY: the Take must NAME
// >=1 concept from a specialized literature (beyond intro econ/strategy). Fires when none
// is present. Non-destructive: advisory, and the Editor waives a genuine specialist concept
// the list missed with a logged reason. The Critic still judges true novelty.
const SPECIALIZED_CONCEPTS = [
  'hysteresis', 'path dependence', 'path-dependence', 'path dependency', 'increasing returns',
  'reflexivity', 'reflexive loop', 'mimetic', 'girard', 'schelling', 'focal point',
  'common knowledge', 'nash equilibrium', 'minsky', 'hyperbolic discounting', 'time inconsistency',
  'adverse selection', 'moral hazard', 'principal-agent', 'goodhart', "campbell's law",
  'lucas critique', 'coase', 'baumol', 'cost disease', 'veblen', 'convexity',
  "jensen's inequality", 'antifragile', 'antifragil', 'power law', 'fat tail', 'fat-tail',
  'tail risk', 'kurtosis', 'ergodic', 'ergodicity', 'kelly criterion', 'lindy',
  'regime shift', 'phase transition', 'self-organized criticality', 'bifurcation',
  "gresham's law", 'gresham', 'triffin', "metcalfe's law", 'metcalfe', 'cantillon',
  'wicksellian', 'knightian uncertainty', 'bayesian updating', 'martingale',
  'prospect theory', 'ricardian equivalence', 'endogeneity',
];
function checkTake(section: string): string | null {
  const body = section.trim();
  if (body.replace(/\s+/g, ' ').length < 300) return null; // too short to assess (or extraction miss) -> no false-fire
  const lc = body.toLowerCase();
  if (SPECIALIZED_CONCEPTS.some(t => lc.includes(t))) return null; // names a specialized concept -> silent
  return `Take reaches its assembled-known ceiling: no concept from a specialized literature is named — every building block reads as intro-course-level (the 07-07/08/09 pattern; 4th consecutive trips the escalation to red). Keep the assembly, but ground it in >=1 non-introductory concept (e.g. hysteresis from labor economics, reflexivity from Soros, path-dependence from Arthur/David, regime shifts from complex systems). If the Take already carries a genuine specialist component the list missed, the Editor waives with a logged reason.`;
}

// ---------- Check H: Discovery mainstream mechanism (structural proxy) ----------
// Discovery's Illuminating streak plateaus when the mechanism is one a follower of popular
// longevity content (Attia/Sinclair/Huberman) already knows — 07-09 shipped AMPK-ULK1
// autophagy, precise but mainstream. PROXY: when the Discovery mechanism is a mainstream-
// longevity term, it must carry an explicit beyond-mainstream novelty warrant. Fires on a
// mainstream term WITHOUT such a warrant. Scoped: silent on non-longevity Discoveries (no
// mainstream term present). Advisory; the Editor waives a false-fire with a logged reason.
const MAINSTREAM_LONGEVITY = [
  'autophagy', 'ampk', 'mtor', 'mtorc', 'nad+', ' nad ', 'sirtuin', 'sirt1', 'senolytic',
  'senescent', 'senescence', 'rapamycin', 'metformin', 'telomere', 'telomerase',
  'mitochondrial biogenesis', 'zone 2', 'zone two', 'vo2 max', 'vo2max', 'blue zone',
  'caloric restriction', 'time-restricted', 'intermittent fasting', 'cold plunge',
  'cold exposure', 'heat shock', 'hormesis', 'spermidine', 'resveratrol', 'glp-1', 'glp1',
];
const NOVELTY_WARRANT = [
  'unknown to', 'unfamiliar even to', 'even the longevity', 'even longevity', 'surprises even',
  'beyond the autophagy', 'past the autophagy', 'not the autophagy story', "hasn't reached",
  'has not reached', 'not yet in the mainstream', 'ahead of the popular', 'no popular',
  'not in the popular', 'the popular version misses', 'the popular-science version',
  'few in the longevity', 'no wellness', 'rarely discussed even', 'not covered even',
];
function checkDiscovery(section: string): string | null {
  const body = section.trim();
  if (body.replace(/\s+/g, ' ').length < 200) return null;
  const lc = body.toLowerCase();
  if (!MAINSTREAM_LONGEVITY.some(t => lc.includes(t))) return null; // out of scope (not a longevity topic) -> silent
  if (NOVELTY_WARRANT.some(p => lc.includes(p))) return null;        // explicitly framed beyond mainstream -> silent
  return `Discovery leans on a mainstream-longevity mechanism (autophagy/AMPK/mTOR/etc.) the Attia/Sinclair/Huberman audience already knows, with no beyond-mainstream novelty warrant. Precision on a known pathway is not novelty. Surface a mechanism that surprises a reader who follows BOTH science and popular longevity content, or state explicitly why this one does (the warrant). The Editor waives a genuinely obscure mechanism that merely mentions a mainstream term with a logged reason.`;
}

// ---------- Check I: M&M gold-regime fatigue (structural proxy) ----------
// The gold-regime read (gold = real-rate asset, not fear asset) is correct, but run as an
// M&M bullet for a 3rd consecutive day it restates "the regime holds" and admits its own
// data is "noise within the regime" — a Neutral bullet that adds nothing over yesterday
// (07-10 M&M-3, the first Neutral in 38+ days). The 2-day topic cap was followed technically.
// PROXY: an M&M GOLD bullet that restates the regime as holding/noise MUST name the trigger
// that would BREAK it (what rate path / flow / event flips gold back to a fear asset). Fires
// when a gold bullet carries regime-restatement language and no break-trigger. Silent when
// gold is cut to the Dashboard (no M&M gold bullet) OR the bullet names the break-trigger.
const GOLD_FATIGUE = [
  'the regime call from yesterday stands', 'the regime call stands', 'the regime from yesterday',
  'the regime holds', 'the regime stands', 'the dynamic holds', 'the framework holds',
  'fits the same framework', 'the same framework', 'confirms the regime', 'consistent with the regime',
  'noise within it', 'noise within the regime', 'the recovery is noise', 'within the regime',
  'nothing new for the regime', 'the same regime as yesterday',
];
const GOLD_BREAK = [
  'fear asset again', 'behave as a fear asset', 'behaves as a fear asset', 'act as a fear asset',
  'acts as a fear asset', 'revert to a fear asset', 'flip gold', 'flips gold',
  'flip back to a fear asset', 'flips back to a fear asset', 'break the regime', 'breaks the regime',
  'would break', 'the trigger that', 'regime breaks if', 'regime breaks when', 'the regime breaks',
  'safe-haven bid returns', 'safe haven bid returns', 'the level that flips', 'what would make gold',
  'gold rallies as a fear', 'reassert',
];
function goldBullets(section: string): string[] {
  return bulletLines(section).filter(b => {
    const m = b.match(/\*\*(.+?)\*\*/);
    const lead = m ? m[1]! : '';
    return /\bgold\b/i.test(lead) || ((b.toLowerCase().match(/\bgold\b/g) || []).length >= 2);
  });
}
function checkGoldRegime(section: string): string | null {
  if (!section.trim()) return null;
  const gb = goldBullets(section);
  if (gb.length === 0) return null; // gold not an M&M bullet (cut to Dashboard) -> silent
  const lc = gb.join('\n').toLowerCase();
  const fatigue = GOLD_FATIGUE.find(p => lc.includes(p));
  if (!fatigue) return null; // fresh gold analysis, not a regime-restatement -> silent
  if (GOLD_BREAK.some(p => lc.includes(p))) return null; // names the break-trigger -> silent
  return `M&M runs a gold bullet that restates the regime ("${fatigue}") without naming the trigger that would BREAK it. A 3rd-day "the regime holds / noise within it" bullet is padding (07-10 M&M-3 was the first Neutral in 38+ days). Either cut gold to a Dashboard sentence, or the bullet must name the specific trigger — what rate path, flow, or event flips gold back to a fear asset.`;
}

// ---------- Check J: AI&T consensus synthesis (structural proxy) ----------
// On a model-launch day the AI&T synthesis bullet is the raw material for an original read,
// but 07-10 AI&T-3 landed on the prevailing VC thesis — "value migrates from the model layer
// to the application layer" — a conclusion the target reader already holds (the Critic's "most
// conventional take in the brief"). PROXY: when the synthesis claims the model->application
// migration, it MUST specify WHERE inside the application/pricing layer value differentially
// accrues (which sub-layer captures margin vs volume vs neither). Fires on the migration claim
// with no stratification. Editor waives a genuinely non-consensus synthesis with a logged reason.
const CONSENSUS_MIGRATION = [
  'migrating from the model layer', 'migrates from the model layer', 'migrate from the model layer',
  'model layer to the application layer', 'value migrates to the application',
  'value moves to the application layer', 'value accrues to the application layer',
  'application layer wins', 'value is migrating to the application',
];
const STRATIFICATION = [
  'is already stratifying', 'stratifying into', 'stratifies into', 'already stratified',
  'captures the volume', 'capture the volume', 'captures the highest margin', 'capture the highest margin',
  'captures neither', 'capture neither', 'duopoly forming', 'tools-plus-menu', 'tools plus menu',
  'not model-plus-chat', 'different sub-layers', 'which sub-layer', 'the specific stratum',
  'where inside it', 'where in the application layer', 'margin and volume are accruing',
];
function checkAITConsensus(section: string): string | null {
  if (!section.trim()) return null;
  const lc = section.toLowerCase();
  const consensus = CONSENSUS_MIGRATION.find(p => lc.includes(p));
  if (!consensus) return null; // no model->application migration claim -> out of scope, silent
  if (STRATIFICATION.some(p => lc.includes(p))) return null; // specifies WHERE value accrues -> silent
  return `AI&T synthesis lands on the consensus "value migrates to the application layer" ("${consensus}") without specifying WHERE inside the application/pricing layer value differentially accrues — the non-consensus move the launch day's raw material supports (which sub-layer captures margin vs volume vs neither; e.g. developer tools capture margin, enterprise menus capture volume, consumer chat captures neither). Name the stratification, or the Editor waives a genuinely non-consensus synthesis with a logged reason.`;
}

// ---------- runner ----------
interface Finding { check: string; msg: string; }
function runBrief(md: string): Finding[] {
  const mm     = extractSection(md, /^##\s+Markets\s*&\s*Macro/i);
  const ait    = extractSection(md, /^##\s+AI\s*&\s*Tech/i);
  const take   = extractSection(md, /THE TAKE/i);
  const inner  = extractSection(md, /INNER GAME/i);
  const cc     = extractSection(md, /^##\s+Companies\s*&\s*Crypto/i);
  const geo    = extractSection(md, /^##\s+Geopolitics/i);
  const signal = extractSection(md, /^##\s+The\s+Signal/i);
  const takeD  = extractDeep(md, /^#.*THE TAKE/i);
  const disc   = extractDeep(md, /^#.*DISCOVERY/i);
  const out: Finding[] = [];
  const a = checkMM(mm);             if (a) out.push({ check: 'A/M&M-ranking (RC4)', msg: a });
  const b = checkAIT(ait, take);     if (b) out.push({ check: 'B/AI&T-independence (RC3)', msg: b });
  const c = checkInnerGame(inner);   if (c) out.push({ check: 'C/InnerGame-inversion (RC5)', msg: c });
  const d = checkCC(cc);             if (d) out.push({ check: 'D/C&C-domain-diversity (RC5)', msg: d });
  const e = checkGeo(geo);           if (e) out.push({ check: 'E/Geo-cross-theater (RC4)', msg: e });
  const f = checkSignal(signal);     if (f) out.push({ check: 'F/Signal-undercoverage (RC4)', msg: f });
  const g = checkTake(takeD);        if (g) out.push({ check: 'G/Take-non-intro-component (RC4)', msg: g });
  const h = checkDiscovery(disc);    if (h) out.push({ check: 'H/Discovery-mainstream-mechanism (RC4)', msg: h });
  const i = checkGoldRegime(mm);     if (i) out.push({ check: 'I/M&M-gold-regime-fatigue (RC4)', msg: i });
  const j = checkAITConsensus(ait);  if (j) out.push({ check: 'J/AI&T-consensus-synthesis (RC4)', msg: j });
  return out;
}

// ---------- selftest (the mechanical proof) ----------
// FIRE fixtures are VERBATIM from the published 2026-07-07 brief (real regressions).
const FIRE_MM = `## Markets & Macro
- **ISM Services hit 54.0, the strongest reading since February, with employment expanding at 51.2, while Friday's NFP showed the labor force shrinking by 720,000.** The two reports measure the same economy and arrived 48 hours apart, yet their labor reads point in opposite directions. The simplest reconciliation is that workers are flowing into services and out of goods. But the magnitude of the mismatch is wide enough to make either report unreliable as a standalone. Watch JOLTS for the tie-break.
## Companies & Crypto`;
const SILENT_MM = `## Markets & Macro
- **ISM Services hit 54.0 while Friday's NFP showed the labor force shrinking by 720,000.** The two disagree, but the NFP is the more reliable read here: the household survey's sampling error is wide, while the establishment payroll print is corroborated by tax-withholding data. Trust the payrolls contraction; position for a softer services number next month.
## Companies & Crypto`;

const FIRE_AIT = `## AI & Tech
- **Microsoft cut 4,800 employees, launched a 6,000-person AI deployment arm called Frontier.** This is a recomposition, not a layoff.
- **OpenAI launched DeployCo with more than $4 billion in funding and folded in Tomoro.** The bet is switching costs.
- **Fable's subsidized pricing ends today: the API moves from $3/$15 to $10/$50.** The first lab to force full-cost inference.
## Geopolitics`;
const TAKE_FIXTURE = `# ▸ THE TAKE
**The Deployment Premium.** Microsoft created Frontier. OpenAI launched DeployCo. Fable's subsidized pricing ended. Two labs converged on deployment as the margin layer.
---`;
const SILENT_AIT = `## AI & Tech
- **Nvidia's next accelerator quietly doubled memory bandwidth, resetting the training-cost curve.** A supply story, not a deployment story.
- **TSMC pulled in its Arizona timeline, shifting where leading-edge capacity physically sits.** Geography as leverage.
- **Fable's subsidized pricing ends today.** Full-cost inference arrives.
## Geopolitics`;

const FIRE_INNER = `# ▸ INNER GAME
*"In visual perception a color is almost never seen as it really is."*
Albers proved perception is never direct; it is always a relationship between the thing and its context. This transfers to how you read any number. The number has not changed. The context surrounding it changes how it lands, and the mind does the adjustment silently.
---`;
const SILENT_INNER = `# ▸ INNER GAME
*"..."*
You would assume that focusing harder improves your read of a number. It turns out the opposite is true: the harder you stare at a single datapoint, the more the surrounding context distorts it. The intuition is backwards. Name the surround first, then the number.
---`;

// D/E/F FIRE fixtures are from the published 2026-07-08 brief (real regressions the
// 07-08 Critic named as MUST-BE-BETTER); SILENT fixtures are healthy counter-cases.
const FIRE_CC = `## Companies & Crypto
- **Coinbase secured UK Financial Conduct Authority authorization to offer traditional investments alongside crypto, making it the first major crypto-native exchange to cross the regulatory bridge in both directions.** The play is the same one Robinhood ran in the other direction.
- **The same FCA framework that authorized Coinbase sets a hard clock for everyone else: a mandatory authorization gateway opens September 2026.** The UK has overtaken the US on regulatory clarity for crypto.
- **Solana's tokenized real-world asset ecosystem hit $3.41 billion, an all-time high driven by on-chain treasury tokens and structured credit products.** RWA tokenization on a single blockchain now matters for institutional allocation.
## AI & Tech`;
const SILENT_CC = `## Companies & Crypto
- **Samsung posted its best semiconductor quarter in 40 years, but the HBM margin question is whether record memory pricing reset the cycle or merely pulled demand forward.** DRAM supply-demand now carries DeepSeek's inference-chip plans as a new variable.
- **Coinbase secured UK FCA authorization to offer traditional investments alongside crypto.** First-mover compliance advantage in a regulated market.
- **Solana's tokenized real-world asset ecosystem hit $3.41 billion on on-chain treasury tokens.** Institutional cash management, not retail speculation.
## AI & Tech`;

const FIRE_GEO = `## Geopolitics
- **IRGC-linked missiles struck the Al Rekayyat, a Nakilat-owned Qatari LNG carrier, near the Strait of Hormuz, and a Saudi-flagged tanker was separately damaged in the same corridor on July 7.** The immediate question is whether Qatar's Al Udeid basing agreement becomes a bargaining chip in the nuclear talks.
- **Russia launched 68 missiles and 351 drones at Kyiv overnight, killing at least 19 people, timed to the opening day of NATO's Ankara summit.** The timing is not coincidence but communication.
- **Trump arrived at NATO's Ankara summit calling allied nations "disloyal" and pushing for sharply higher defense-spending targets.** The 5% target faces the same constraint the 2% target did: production capacity.
- **China conducted its first publicly acknowledged submarine-launched ballistic missile test into the Pacific Ocean, and the United States was not notified in advance.** The absence of US notification is the signal within the signal.
## The Wild Card`;
const SILENT_GEO = `## Geopolitics
- **IRGC missiles struck a Qatari LNG carrier near Hormuz while Trump called NATO "disloyal" in Ankara — two fronts of the same test.** The through-line: the alliance that pledges to protect global shipping lanes just had its most powerful member question its worth, and that is the same opening Iran is probing in the Gulf.
- **Russia launched 68 missiles at Kyiv timed to the summit's opening.** Communication by timing.
- **China tested a submarine-launched ballistic missile into the Pacific without notifying Washington.** Second-strike credibility.
## The Wild Card`;

const FIRE_SIGNAL = `## The Signal
**The legal machinery that rations water for the American Southwest expires this December with no replacement agreed, and the market still prices Western water as free and infinite.**
Almost nobody outside the basin has noticed the hard deadline. The market has filed the whole thing under "environmental story, not a trade."

**Context signal: connecting an ordinary phone straight to a satellite is about to stop being a novelty and become a standard feature.**
The comfortable read is that satellite-to-phone service is a neat wilderness gimmick. The structure says it is a substitution event.
---`;
const SILENT_SIGNAL = `## The Signal
**The legal machinery that rations Western water expires this December, and the market still prices it as free.**
Almost nobody outside the basin has noticed; no major desk has assembled this into a trade.

**A quiet FDA rule change is about to reprice generic-drug supply chains, and few are pricing the coming shortage.**
Investors miss that the rule reroutes the economics to two named survivors; no desk has connected it yet.
---`;

// Regression fixture for the Check F parser gap (surfaced 2026-07-09): the live Signal
// used "- **...**" bullet leads, which the old signalBlocks regex missed, so F
// false-silenced despite a "Context signal:" label. Asserts F now bites the bulleted format.
const FIRE_SIGNAL_BULLET = `## The Signal

- **Oil at $78 sets off an agricultural cost cascade that reprices fertilizer within 6 to 8 weeks.**
Nitrogen fertilizer is essentially solidified natural gas. *Undercoverage: financial media rarely assembles the oil-to-nitrogen-to-farm-margin timing chain into a single dated window.*

- **Context signal: European defense budgets are set to roughly double, and the market has already bought the prime contractors.**
The unpriced question is whether Europe's factories can convert order books into delivered hardware. *Context label rationale: the buy-the-primes trade is now wire-covered.*
---`;

// G/H FIRE fixtures are from the published 2026-07-09 brief (the real regressions the
// 07-09 Critic named as MUST-BE-BETTER #1 and #3 — Take assembled-known 3rd consecutive,
// Discovery mainstream mechanism); trimmed for length, the failing property preserved.
// SILENT fixtures are healthy counter-cases (Take grounded in a specialist concept; a
// Discovery carrying an explicit beyond-mainstream novelty warrant).
const FIRE_TAKE = `# ▸ THE TAKE


### Floor Migration: Why Every Reversal Lands Higher

Three floors moved this week and none of them will return to where they started.

Oil settled at $78.19 after the Iran ceasefire collapsed. Even if a new ceasefire is announced tomorrow, Brent will not return to the mid-$60s where it sat two weeks ago. The insurance premiums on Hormuz-transiting tankers have already been repriced, and shipping contracts rerouted through the Cape of Good Hope. The floor has migrated from the mid-$60s to the low-$70s, and the cost of moving it back exceeds the cost of living with it where it landed.

Rate hike probability for September jumped from 62 percent to above 70 percent. Even if July CPI comes in soft, the narrative floor for tightening has moved. When the question itself changes, a single soft data print cannot change it back.

NATO defense spending commitments roughly doubled their previous target. These are procurement contracts with 3- to 5-year lead times. Once the orders are signed, the spending floor is locked by industrial contracts that penalize cancellation.

The mechanism in all three cases is adjustment cost asymmetry. It costs more to undo a restructuring than it cost to enact it. This asymmetry is what makes each shock permanent: the floor migrates because returning it to the original position requires paying the adjustment cost twice. One mechanism, three boards.
---`;
const SILENT_TAKE = `# ▸ THE TAKE


### Floor Migration: Why Every Reversal Lands Higher

Three floors moved this week and none will return. Oil will not fall back to the mid-$60s; the September rate narrative shifted from "if" to "how fast"; NATO procurement contracts are signed. The surface mechanism is adjustment cost asymmetry, but the deeper structure is hysteresis: the labor-economics result that a large enough shock moves the equilibrium itself, so the system does not return to its prior state even after the shock clears. This is path dependence, where the order of events changes the destination and not merely the route, and it is why each floor holds until a structural break resets it.
---`;

const FIRE_DISC = `# ▸ DISCOVERY

### The Janitor Shift

The conventional story about exercise and aging is that physical activity builds muscle and strengthens bones. Recent molecular evidence suggests it is largely wrong about the mechanism.

The key is a pathway called AMPK-ULK1. When you exercise, the temporary energy deficit activates AMP-activated protein kinase (AMPK), which triggers ULK1, which initiates autophagy: the process by which a cell digests its own damaged components. Misfolded proteins, dysfunctional mitochondria, and oxidized lipid membranes get tagged, disassembled, and recycled.

Exercise's primary benefit in aging is subtraction, not addition. You are activating a cleanup crew that removes damage faster than it accumulates. The mechanism also explains the dose-response curve: moderate exercise sustains AMPK activation long enough to trigger a full autophagic cycle, while extreme exercise overwhelms the machinery.
---`;
const SILENT_DISC = `# ▸ DISCOVERY

### The Janitor Shift

Everyone in longevity circles knows exercise triggers autophagy through AMPK. The finding here is one unknown to even the longevity-literate reader, unfamiliar even to the Attia and Sinclair audience: the ULK1 step is gated by a circadian phosphorylation switch that no popular-science account has reached, which is why identical workouts clear different amounts of cellular debris depending on the hour. The mechanism surprises even readers who follow both the science and the popular longevity content.
---`;

// I/J FIRE fixtures are VERBATIM from the published 2026-07-10 brief (the real regressions the
// 07-10 Critic named as MUST-BE-BETTER #1 and #2 — gold-regime Neutral, AI&T consensus synthesis).
// SILENT fixtures are healthy counter-cases (a gold bullet naming the break-trigger; an AI&T
// synthesis that stratifies WHERE value accrues, per the Critic's own suggested rewrite).
const FIRE_GOLD = `## Markets & Macro
- **Gold recovered to roughly $4,109, bouncing from Wednesday's war-day dip to $4,050, and the recovery matters less than what the dip revealed.** Yesterday this section explained why gold fell when missiles flew: gold in this rate regime is a real-rate asset, not a fear asset, and when geopolitical risk and rate-hike odds rise together, the dollar bid from tightening expectations overwhelms the safe-haven bid. Wednesday's modest recovery fits the same framework; oil pulled back slightly, which eased the rate-hike impulse by a fraction, and gold tracked the relief. The dynamic holds: as long as the September hike remains above 70 percent probability, gold's ceiling is set by real rates, not geopolitical fear. The regime call from yesterday stands, and the recovery is noise within it.
## Companies & Crypto`;
const SILENT_GOLD = `## Markets & Macro
- **Gold recovered to roughly $4,109, and the regime call from yesterday stands.** Gold remains a real-rate asset while the September hike holds above 70 percent. But the specific trigger that would break the regime is now nameable: if the front end starts pricing Fed cuts — a sub-60-percent September probability or a soft core-CPI print — gold flips back to a fear asset and rallies on the next geopolitical shock. Watch the 2-year yield; a break below 4.2 percent is the level that flips gold from real-rate-capped to haven-bid.
## Companies & Crypto`;

const FIRE_AITCON = `## AI & Tech
- **Two frontier-class models launched within 24 hours of each other, and neither moved the other's stock. That is the signal.** When frontier-model releases stop generating competitive panic, the market has reclassified them from events to cadence. The analogy is smartphone launches: the early iPhones were events; the recent ones are inventory management. AI model releases are crossing that same threshold. The implication for investors: value in AI infrastructure is migrating from the model layer, where each new release merely matches the prior state of the art, to the application layer, where durable margin lives in the workflow that uses the model, not the model itself. The combined tell of OpenAI's three-tier menu and xAI's Cursor integration confirms this: both labs are racing toward the application and pricing layers.
## Geopolitics`;
const SILENT_AITCON = `## AI & Tech
- **Two frontier-class models launched within 24 hours, and yes, value is migrating from the model layer — but the question the consensus skips is WHERE inside the application layer it lands.** The application layer is already stratifying: developer tools capture the highest margin (Cursor, trained into the workflow), enterprise compute menus capture the volume (OpenAI's three-tier Sol/Terra/Luna), and consumer chat captures neither. The duopoly forming is tools-plus-menu, not model-plus-chat. Margin and volume are accruing to different sub-layers, so "own the application layer" is already the wrong altitude.
## Geopolitics`;

function selftest(): number {
  const cases: Array<[string, boolean, () => string | null]> = [
    ['A M&M fires on real evasion',   true,  () => checkMM(extractSection(FIRE_MM,   /^##\s+Markets/i))],
    ['A M&M silent when ranked',      false, () => checkMM(extractSection(SILENT_MM, /^##\s+Markets/i))],
    ['B AI&T fires on Take-serving',  true,  () => checkAIT(extractSection(FIRE_AIT, /^##\s+AI/i), extractSection(TAKE_FIXTURE, /THE TAKE/i))],
    ['B AI&T silent when independent',false, () => checkAIT(extractSection(SILENT_AIT,/^##\s+AI/i), extractSection(TAKE_FIXTURE, /THE TAKE/i))],
    ['C InnerGame fires on truism',   true,  () => checkInnerGame(extractSection(FIRE_INNER,  /INNER GAME/i))],
    ['C InnerGame silent on inversion',false,() => checkInnerGame(extractSection(SILENT_INNER,/INNER GAME/i))],
    ['D C&C fires on all-crypto',     true,  () => checkCC(extractSection(FIRE_CC,   /^##\s+Companies/i))],
    ['D C&C silent with corporate',   false, () => checkCC(extractSection(SILENT_CC, /^##\s+Companies/i))],
    ['E Geo fires on parallel tracks',true,  () => checkGeo(extractSection(FIRE_GEO, /^##\s+Geopolitics/i))],
    ['E Geo silent on synthesis',     false, () => checkGeo(extractSection(SILENT_GEO,/^##\s+Geopolitics/i))],
    ['F Signal fires on context-label',true, () => checkSignal(extractSection(FIRE_SIGNAL,  /^##\s+The\s+Signal/i))],
    ['F Signal silent when both undercovered',false,() => checkSignal(extractSection(SILENT_SIGNAL,/^##\s+The\s+Signal/i))],
    ['F Signal fires on bulleted context-label (07-09)',true,() => checkSignal(extractSection(FIRE_SIGNAL_BULLET,/^##\s+The\s+Signal/i))],
    ['G Take fires on assembled-known',        true,  () => checkTake(extractDeep(FIRE_TAKE,   /^#.*THE TAKE/i))],
    ['G Take silent with specialist concept',  false, () => checkTake(extractDeep(SILENT_TAKE, /^#.*THE TAKE/i))],
    ['H Discovery fires on mainstream mechanism',true,() => checkDiscovery(extractDeep(FIRE_DISC,  /^#.*DISCOVERY/i))],
    ['H Discovery silent with novelty warrant', false,() => checkDiscovery(extractDeep(SILENT_DISC,/^#.*DISCOVERY/i))],
    ['I gold fires on regime-restatement',      true,  () => checkGoldRegime(extractSection(FIRE_GOLD,   /^##\s+Markets/i))],
    ['I gold silent when break-trigger named',  false, () => checkGoldRegime(extractSection(SILENT_GOLD, /^##\s+Markets/i))],
    ['J AI&T fires on consensus migration',     true,  () => checkAITConsensus(extractSection(FIRE_AITCON,  /^##\s+AI/i))],
    ['J AI&T silent when stratified',           false, () => checkAITConsensus(extractSection(SILENT_AITCON,/^##\s+AI/i))],
  ];
  let fails = 0;
  for (const [name, shouldFire, fn] of cases) {
    const res = fn();
    const fired = res !== null;
    const ok = fired === shouldFire;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name} (expected ${shouldFire ? 'FIRE' : 'SILENT'}, got ${fired ? 'FIRE' : 'SILENT'})`);
    if (!ok) { fails++; if (res) console.log(`         detector said: ${res}`); }
  }
  console.log(`\nsix-conversion-gate selftest — ${cases.length - fails}/${cases.length} assertions passed`);
  if (fails) { console.error('✗ SELFTEST FAILED — a detector no longer bites both directions.'); return 1; }
  console.log('✓ All detectors verified in both directions (fires on the real failure, silent on healthy).');
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const file = args.find(a => !a.startsWith('--'));
  if (!file) { console.error('usage: six-conversion-gate.ts <brief.md> [--strict] | --selftest'); return 2; }
  if (!fs.existsSync(file)) { console.error(`FAIL: brief not found: ${file}`); return 2; }
  const findings = runBrief(fs.readFileSync(file, 'utf8'));
  const strict = args.includes('--strict');
  if (findings.length === 0) {
    console.log(`six-conversion-gate — ${file}: CLEAN (0 findings). All ten conversion checks (A-J) cleared.`);
    return 0;
  }
  console.log(`six-conversion-gate — ${file}: ${findings.length} finding(s) [${strict ? 'STRICT' : 'ADVISORY'}]`);
  for (const f of findings) console.log(`  ▸ ${f.check}: ${f.msg}`);
  console.log(strict ? '\n✗ STRICT: conversion findings present.' : '\nADVISORY: Editor must REJECT-and-replace each finding before v2 (brief still ships).');
  return strict ? 1 : 0;
}
process.exit(main());
