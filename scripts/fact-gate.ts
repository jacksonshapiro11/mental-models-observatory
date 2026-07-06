#!/usr/bin/env node --experimental-strip-types
/**
 * fact-gate.ts — the TRUTH gate for the daily brief.
 *
 * Role in the pipeline (June 19 update): this is a DETECTOR, not a publish
 * kill-switch. It produces the worklist the editorial agents (Writer, Take,
 * Editor, Critic, Morning Updater) must clear by VERIFYING each claim against a
 * primary source and CORRECTING or STRIKING what's wrong — never by stopping the
 * product. validate-brief.ts spawns it (--allow-unverified) so a real
 * CONTRADICTION trips the mechanical stage, and the morning fix-loop
 * ("loop fixes until clean — never halt") then auto-corrects before publish.
 *
 * It does the following, all mechanical (zero network):
 *
 *   1. OFFICE-HOLDER CHECK. Cross-checks named office-holders against
 *      system/current-facts.json. Catches "Powell, Fed chair" after Powell's
 *      term ended. Distinguishes present-tense errors from historical refs.
 *
 *   2. MARKET CLAIM EXTRACTION. Deterministically pulls every market number +
 *      its direction into a structured ledger ({date}-factcheck.json).
 *
 *   3. SUPERLATIVE EXTRACTION + ARCHIVE BACKSTOP (added June 19 — the gold
 *      "$4,355 new high" miss). Pulls every claim of an extreme ("record /
 *      all-time high / new high / highest / lowest / weakest since …") and
 *      cross-checks it against our OWN last ~14 published briefs. If the brief
 *      claims gold hit a "new high near $4,355" but our archive recorded gold
 *      at $4,370, that is a contradiction by our own record — HARD FAIL. Also
 *      flags any stated price that deviates sharply from our recent archive
 *      (the June 18 WTI $89.60-vs-$76 fabrication class) for verification.
 *
 *   4. TRUTH CROSS-CHECK. If a {date}-truth.json file is present (produced when
 *      an editorial agent records what it verified against primary sources),
 *      compares each extracted claim's DIRECTION and magnitude to ground truth.
 *
 * Gate logic:
 *   - Any registry contradiction (e.g. Powell-as-current-chair)        -> FAIL
 *   - Any superlative contradicted by our own archive                  -> FAIL
 *   - Any truth contradiction (direction mismatch on any claim)        -> FAIL
 *   - Any CRITICAL claim left UNVERIFIED (no truth entry), unless
 *     --allow-unverified                                               -> FAIL
 *   - A stated price far from our recent archive                       -> FLAG (verify)
 *   FAIL -> exit 1 (details + worklist written). FLAG is advisory.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fact-gate.ts <brief.md> [--truth <truth.json>] [--allow-unverified] [--archive-days N]
 *
 * Exit codes: 0 pass · 1 fact failure (details printed + ledger written) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

type Tier = 'critical' | 'standard';
type Status = 'PASS' | 'FAIL' | 'UNVERIFIED';
type Finding = { check: string; severity: 'FAIL' | 'FLAG'; message: string };

interface Claim {
  key: string;
  asset: string;
  tier: Tier;
  claimType?: 'market' | 'superlative';
  direction: 'up' | 'down' | 'flat' | 'unknown';
  magnitudePct: number | null;
  level: string | null;
  section: string;
  sentence: string;
  status: Status;
  superlative?: string;
  superlativeKind?: 'high' | 'low' | 'other';
  truthDirection?: string;
  truthValue?: string;
  truthSource?: string;
}

// ---------------------------------------------------------------------------
// Asset lexicon. `key` is the join key against truth.json and is stable.
// Order matters: futures variants are matched and consumed before the plain
// index so "Nasdaq 100 futures" is not double-counted as "Nasdaq". "Brent
// crude" is consumed by `brent` before `wti`'s crude/oil alternates can grab it.
// ---------------------------------------------------------------------------
const ASSETS: { key: string; asset: string; tier: Tier; re: RegExp }[] = [
  { key: 'sp500_futures', asset: 'S&P 500 futures', tier: 'critical', re: /S&P\s*500\s*futures|S&P\s*futures|ES\s*futures/gi },
  { key: 'nasdaq_futures', asset: 'Nasdaq 100 futures', tier: 'critical', re: /Nasdaq(?:\s*100)?\s*futures|NQ\s*futures/gi },
  { key: 'dow_futures', asset: 'Dow futures', tier: 'critical', re: /\bDow(?:\s*Jones)?\s*futures\b/gi },
  { key: 'sp500', asset: 'S&P 500', tier: 'critical', re: /S&P\s*500(?!\s*futures)/gi },
  { key: 'nasdaq', asset: 'Nasdaq', tier: 'critical', re: /\bNasdaq\b(?!\s*(?:100\s*)?futures)/gi },
  { key: 'dow', asset: 'Dow', tier: 'standard', re: /\bDow(?:\s*Jones)?\b(?!\s*futures)/gi },
  { key: 'russell', asset: 'Russell 2000', tier: 'standard', re: /Russell\s*2000/gi },
  { key: 'kospi', asset: 'Kospi', tier: 'standard', re: /Kospi/gi },
  { key: 'hang_seng', asset: 'Hang Seng', tier: 'standard', re: /Hang\s*Seng/gi },
  { key: 'ust10', asset: '10-year yield', tier: 'critical', re: /10-?year(?:\s*yield)?|10Y|10-?yr/gi },
  { key: 'brent', asset: 'Brent crude', tier: 'standard', re: /Brent(?:\s*crude)?/gi },
  { key: 'wti', asset: 'WTI', tier: 'standard', re: /WTI|West\s*Texas|\bcrude\b|\boil\b/gi },
  { key: 'silver', asset: 'silver', tier: 'standard', re: /\bsilver\b/gi },
  { key: 'gold', asset: 'gold', tier: 'standard', re: /\bgold\b/gi },
  { key: 'eth', asset: 'Ethereum', tier: 'standard', re: /\bETH\b|Ethereum/gi },
  { key: 'btc', asset: 'Bitcoin', tier: 'standard', re: /\bBTC\b|Bitcoin/gi },
];

// Plausibility bands for clean $-price assets. ONLY these enter the archive and
// the numeric backstops — indices (level vs %) and yields (sub-100, no $) are too
// noisy to compare mechanically and are left to editorial verification.
const PRICE_BANDS: Record<string, [number, number]> = {
  gold: [1000, 9999],
  silver: [5, 200],
  wti: [20, 200],
  brent: [20, 200],
  btc: [10000, 250000],
  eth: [200, 20000],
};

const UP_WORDS = ['up', 'rose', 'rises', 'rising', 'gained', 'gains', 'surged', 'surges', 'jumped', 'jumps', 'climbed', 'climbs', 'rallied', 'rallies', 'advanced', 'advances', 'higher', 'soared', 'popped', 'rebounded', 'recovers', 'recovering'];
const DOWN_WORDS = ['down', 'fell', 'falls', 'falling', 'lost', 'loses', 'dropped', 'drops', 'plunged', 'plunges', 'crashed', 'crashes', 'sank', 'sinks', 'slid', 'slides', 'declined', 'declines', 'lower', 'tumbled', 'tumbles', 'slumped', 'sold off', 'selloff', 'sell-off'];

// Superlative / claim-of-extreme detector. Each alternate is a phrase that
// ASSERTS an extreme — the class the gold "new highs" error belonged to and
// that nothing in the pipeline verified.
const SUPERLATIVE_RE = new RegExp([
  'new\\s+(?:record\\s+)?(?:highs?|lows?)',
  'record\\s+(?:highs?|lows?|\\$?\\d)',
  'all[-\\s]?time\\s+(?:highs?|lows?)',
  '(?:multi[-\\s]?(?:year|month|week|decade)|\\d+[-\\s]?(?:year|month|week|day|session))[-\\s]?(?:highs?|lows?)',
  '(?:this\\s+)?(?:week|month|year|session|quarter)(?:[’\']s)?\\s+(?:highs?|lows?)',
  'highest\\b', 'lowest\\b',
  '(?:most|fewest|biggest|largest|smallest|strongest|weakest|fastest|slowest)\\s+since',
  'first\\s+time\\s+since',
  'never\\s+(?:been|seen)\\b',
].join('|'), 'gi');

function stripComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, '');
}

function sectionOf(body: string, idx: number): string {
  // Nearest preceding heading.
  const before = body.slice(0, idx);
  const heads = [...before.matchAll(/^#{1,3}\s*▸?\s*(.+)$/gm)];
  return heads.length ? heads[heads.length - 1][1].trim() : '(preamble)';
}

function sentenceAround(body: string, idx: number): string {
  let start = idx;
  while (start > 0 && !'.!?\n'.includes(body[start - 1])) start--;
  let end = idx;
  while (end < body.length && !'.!?\n'.includes(body[end])) end++;
  return body.slice(start, end + 1).replace(/\s+/g, ' ').trim();
}

function detectDirection(window: string): { dir: 'up' | 'down' | 'unknown'; mag: number | null } {
  const lower = window.toLowerCase();
  // Signed percent takes priority if explicit.
  const signed = window.match(/([+−-])\s*(\d+(?:\.\d+)?)\s*%/);
  let dir: 'up' | 'down' | 'unknown' = 'unknown';
  if (signed) dir = signed[1] === '+' ? 'up' : 'down';
  if (dir === 'unknown') {
    const firstUp = UP_WORDS.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? Infinity;
    const firstDown = DOWN_WORDS.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? Infinity;
    if (firstUp < firstDown) dir = 'up';
    else if (firstDown < firstUp) dir = 'down';
  }
  const magMatch = window.match(/(\d+(?:\.\d+)?)\s*%/);
  const mag = magMatch ? parseFloat(magMatch[1]) : null;
  return { dir, mag };
}

// First plausible price/level near an asset mention: skip percentages, accept
// the first $-prefixed number or any number >= 100 (filters "up 12%" noise).
function valueNear(text: string, fromIdx: number, span = 80): number | null {
  const after = text.slice(fromIdx, Math.min(text.length, fromIdx + span));
  const nums = [...after.matchAll(/(\$)?\s*([\d,]{1,9}(?:\.\d+)?)(\s*%)?/g)];
  for (const n of nums) {
    if (n[3]) continue; // a percentage, not a level
    const v = parseFloat(n[2].replace(/,/g, ''));
    if (isNaN(v) || v <= 0) continue;
    if (n[1] || v >= 100) return v; // $-prefixed or large enough to be a price/level
  }
  return null;
}

function extractClaims(body: string): Claim[] {
  const claims: Claim[] = [];
  const consumed: [number, number][] = [];
  const overlaps = (s: number, e: number) => consumed.some(([a, b]) => s < b && e > a);

  for (const a of ASSETS) {
    a.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = a.re.exec(body)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      // Direction window: 60 chars after the asset mention (covers "futures down 2.6%").
      const window = body.slice(end, Math.min(body.length, end + 60));
      const { dir, mag } = detectDirection(window);
      if (dir === 'unknown' && mag === null) continue; // mention without a move; not a checkable claim
      consumed.push([start, end]);
      const levelMatch = window.match(/(?:to|near|at)\s*\$?([\d,]+(?:\.\d+)?)/);
      claims.push({
        key: a.key,
        asset: a.asset,
        tier: a.tier,
        claimType: 'market',
        direction: dir === 'unknown' ? 'unknown' : dir,
        magnitudePct: mag,
        level: levelMatch ? levelMatch[1] : null,
        section: sectionOf(body, start),
        sentence: sentenceAround(body, start),
        status: 'UNVERIFIED',
      });
      // one claim per asset is enough for the gate (first occurrence, usually the Dashboard/lede)
      break;
    }
  }
  return claims;
}

function superlativeKind(phrase: string): 'high' | 'low' | 'other' {
  const p = phrase.toLowerCase();
  // Temporal ("…since YYYY", "first time since", "never"): the trailing number is a
  // YEAR not a price — verify editorially, but skip the numeric archive comparison.
  if (/\bsince\b/.test(p) || /first\s+time/.test(p) || /\bnever\b/.test(p)) return 'other';
  // No \b after the root so plurals match ("highs", "lows", "highest").
  if (/high|record|all-?time|most|biggest|largest|strongest|fastest/.test(p)) return 'high';
  if (/low|fewest|smallest|weakest|slowest/.test(p)) return 'low';
  return 'other';
}

// Extract claims-of-extreme across the WHOLE body (not first-occurrence-per-asset).
function extractSuperlatives(body: string): Claim[] {
  const out: Claim[] = [];
  let m: RegExpExecArray | null;
  SUPERLATIVE_RE.lastIndex = 0;
  while ((m = SUPERLATIVE_RE.exec(body)) !== null) {
    const phrase = m[0].replace(/\s+/g, ' ').trim();
    const idx = m.index;
    const sentence = sentenceAround(body, idx);
    // Which asset is this extreme about? The asset mention CLOSEST to the phrase
    // by character distance — a Dashboard line packs several assets into one
    // sentence, so "nearest in sentence" mis-attributes (it tagged gold's high to
    // the 10-year). Search a tight window and pick the minimum-distance asset.
    const winBase = Math.max(0, idx - 70);
    const win = body.slice(winBase, Math.min(body.length, idx + phrase.length + 20));
    const phraseRel = idx - winBase;
    let assetKey: string | null = null;
    let assetName: string | null = null;
    let best = Infinity;
    for (const a of ASSETS) {
      a.re.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = a.re.exec(win)) !== null) {
        const dist = Math.abs(mm.index - phraseRel);
        if (dist < best) { best = dist; assetKey = a.key; assetName = a.asset; }
      }
    }
    // Value asserted as the extreme: nearest level after the phrase, else in-window.
    let value = valueNear(body, idx, 60) ?? valueNear(win, 0, win.length);
    // Band-sanity: if attributed to a $-price asset, the value must be plausible.
    if (value != null && assetKey && PRICE_BANDS[assetKey]) {
      const [lo, hi] = PRICE_BANDS[assetKey];
      if (value < lo || value > hi) value = null;
    }
    out.push({
      key: assetKey ? `superlative:${assetKey}` : `superlative:${phrase.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      asset: assetName ?? '(unattributed)',
      tier: 'standard',
      claimType: 'superlative',
      direction: 'unknown',
      magnitudePct: null,
      level: value != null ? String(value) : null,
      section: sectionOf(body, idx),
      sentence,
      status: 'UNVERIFIED',
      superlative: phrase,
      superlativeKind: superlativeKind(phrase),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Archive (zero-network): our own last ~N published briefs in content/daily-updates.
// Used to disprove false superlatives and flag price fabrications by our own record.
// ---------------------------------------------------------------------------
function findArchiveDir(briefPath: string): string | null {
  let dir = path.dirname(briefPath);
  for (let i = 0; i < 6; i++) {
    const cand = path.join(dir, 'content', 'daily-updates');
    if (fs.existsSync(cand)) return cand;
    dir = path.dirname(dir);
  }
  const cwdCand = path.join(process.cwd(), 'content', 'daily-updates');
  return fs.existsSync(cwdCand) ? cwdCand : null;
}

// Per-archive-file: first IN-BAND value for each $-price asset. Scanning all
// mentions + band-filtering rejects garbage (a "gold" mention near a $60,000 BTC
// figure, a "BTC" mention near a 124.9 dominance %).
function assetValuesIn(text: string): Record<string, number> {
  const stripped = stripComments(text);
  const out: Record<string, number> = {};
  for (const a of ASSETS) {
    const band = PRICE_BANDS[a.key];
    if (!band) continue; // only clean $-price assets enter the archive
    a.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = a.re.exec(stripped)) !== null) {
      const v = valueNear(stripped, m.index + m[0].length, 90);
      if (v != null && v >= band[0] && v <= band[1]) { out[a.key] = v; break; }
    }
  }
  return out;
}

interface ArchivePoint { date: string; value: number; }
function loadArchive(briefPath: string, briefDate: string | null, days: number): Record<string, ArchivePoint[]> {
  const dir = findArchiveDir(briefPath);
  const archive: Record<string, ArchivePoint[]> = {};
  if (!dir) return archive;
  let files: string[];
  try { files = fs.readdirSync(dir); } catch { return archive; }
  const dated = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)) // exclude -light
    .map((f) => ({ f, d: f.slice(0, 10) }))
    .filter((x) => (briefDate ? x.d < briefDate : true)) // strictly prior briefs; never self
    .sort((a, b) => (a.d < b.d ? 1 : -1)) // newest first
    .slice(0, days);
  for (const { f, d } of dated) {
    let txt: string;
    try { txt = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    const vals = assetValuesIn(txt);
    for (const [k, v] of Object.entries(vals)) {
      (archive[k] ??= []).push({ date: d, value: v });
    }
  }
  return archive;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// A wrong fact in a thesis/lede position can't be patched — the section was built
// on it (the gold-06-18 Take). Tell the agent where a rewrite (not a number-swap) is required.
function loadBearingNote(section: string): string {
  if (/\bTAKE\b/i.test(section)) return ' LOAD-BEARING (Take premise): if wrong, REGENERATE the Take from scratch — the framework was built on it; do not just swap the number.';
  return ' If load-bearing (the section thesis/lede), REWRITE the section on a verified premise; patch or strike only if incidental.';
}

// Superlative contradictions (FAIL) + price-vs-archive deviations (FLAG).
function archiveBackstop(superlatives: Claim[], briefPrices: Record<string, number>, archive: Record<string, ArchivePoint[]>): Finding[] {
  const findings: Finding[] = [];

  // 1. Superlatives contradicted by our own record.
  for (const s of superlatives) {
    const k = s.key.replace(/^superlative:/, '');
    const value = s.level != null ? parseFloat(String(s.level).replace(/,/g, '')) : null;
    if (value == null || s.superlativeKind === 'other') continue;
    const pts = archive[k];
    if (!pts || !pts.length) continue;
    if (s.superlativeKind === 'high') {
      const higher = pts.filter((p) => p.value > value * 1.001).sort((a, b) => b.value - a.value);
      if (higher.length) {
        s.status = 'FAIL';
        findings.push({
          check: 'superlative-archive',
          severity: 'FAIL',
          message: `${s.asset} "${s.superlative}"${value ? ` near ${value}` : ''} is NOT a high by our own record — our ${higher[0].date} brief had ${s.asset} at ${higher[0].value}. Superlative contradicted by our archive. Verify vs PRIMARY source, then correct or strike.${loadBearingNote(s.section)} Section: ${s.section}. "${s.sentence.slice(0, 150)}"`,
        });
      }
    } else if (s.superlativeKind === 'low') {
      const lower = pts.filter((p) => p.value < value * 0.999).sort((a, b) => a.value - b.value);
      if (lower.length) {
        s.status = 'FAIL';
        findings.push({
          check: 'superlative-archive',
          severity: 'FAIL',
          message: `${s.asset} "${s.superlative}"${value ? ` near ${value}` : ''} is NOT a low by our own record — our ${lower[0].date} brief had ${s.asset} at ${lower[0].value}. Superlative contradicted by our archive. Verify vs PRIMARY source, then correct or strike.${loadBearingNote(s.section)} Section: ${s.section}. "${s.sentence.slice(0, 150)}"`,
        });
      }
    }
  }

  // 2. Stated prices that deviate sharply from our recent archive (fabrication class).
  // Scans the brief's own stated $-prices (incl. bare prices with no direction word,
  // which is how the June 18 WTI $89.60 fabrication was phrased).
  const devThreshold = (k: string) => (['btc', 'eth'].includes(k) ? 0.18 : 0.08);
  for (const [k, lvl] of Object.entries(briefPrices)) {
    const pts = archive[k];
    if (!pts || pts.length < 2) continue;
    const recent = pts.slice(0, 3); // newest-first; recent regime, robust to one stale outlier
    if (recent.length < 2) continue;
    const med = median(recent.map((p) => p.value));
    if (med == null || !(med > 0)) continue; // !(med > 0) also rejects NaN
    const dev = Math.abs(lvl - med) / med;
    if (dev > devThreshold(k)) {
      const asset = ASSETS.find((a) => a.key === k)?.asset ?? k;
      findings.push({
        check: 'price-vs-archive',
        severity: 'FLAG',
        message: `${asset} stated near ${lvl} deviates ${(dev * 100).toFixed(0)}% from our last-${recent.length} archive median ${med} (${recent.map((p) => `${p.date}:${p.value}`).join(', ')}). Possible fabrication/stale — verify vs PRIMARY source.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Office-holder check (zero network).
// ---------------------------------------------------------------------------
const HISTORICAL_MARKERS = /\b(19\d{2}|20[01]\d|202[0-5])\b|\b(years?\s+ago|back\s+in|in\s+the\s+past|has\s+done\s+this\s+before|did\s+this\s+before|historically|previously|former|ex-|during\s+the)\b/i;
// Narrower marker for the descriptor check, where "former"/"ex-" is the TRIGGER and
// must not also count as a past-tense signal (else every hit self-classifies historical).
const HISTORICAL_PERIOD = /\b(19\d{2}|20[01]\d|202[0-5])\b|\b(years?\s+ago|back\s+in|in\s+the\s+past|out\s+of\s+office|during\s+(?:his|her|the)|at\s+the\s+time|then[- ]|previously)\b/i;

function checkOfficeHolders(body: string, registry: any): { findings: Finding[]; checked: number } {
  const findings: Finding[] = [];
  const facts = registry?.facts ?? [];
  for (const f of facts) {
    const ctx = new RegExp(f.context_regex, 'i');
    const window = f.proximity_chars ?? 240;
    for (const wrong of f.wrong_values ?? []) {
      const re = new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const near = body.slice(Math.max(0, m.index - window), Math.min(body.length, m.index + window));
        if (!ctx.test(near)) continue; // wrong value present but not in office-holder context -> fine
        const sentence = sentenceAround(body, m.index);
        const historical = HISTORICAL_MARKERS.test(sentence);
        findings.push({
          check: 'office-holder',
          severity: historical ? 'FLAG' : 'FAIL',
          message:
            `"${wrong}" appears in ${f.label} context but the current ${f.label} is "${f.value}" (since ${f.effective}).` +
            (historical
              ? ` Sentence looks historical — verify it is past-tense, not a claim about the present: "${sentence.slice(0, 140)}"`
              : ` HARD FAIL — reads as a present-tense claim: "${sentence.slice(0, 140)}"`),
        });
      }
    }
    // Descriptor mismatch: the CURRENT holder labelled with a stale qualifier
    // ("former president Trump" while Trump is the sitting president — true of 2021-25,
    // false now). Catches the trap generally, not just exact wrong_values phrasings.
    if (f.holder) {
      const holderRe = new RegExp(`\\b(?:${f.holder})\\b`, 'gi');
      const staleBefore = /\b(?:former|ex|ex-|one-?time|previous|outgoing|erstwhile)\b[-\s]+(?:u\.?s\.?\s+)?(?:president|vice\s+president|vp|treasury\s+secretary|secretary(?:\s+of\s+the\s+treasury)?|fed(?:eral reserve)?\s+chair|chair(?:man|woman)?|governor|senator)?\s*$/i;
      let hm: RegExpExecArray | null;
      while ((hm = holderRe.exec(body)) !== null) {
        const pre = body.slice(Math.max(0, hm.index - 32), hm.index);
        if (!staleBefore.test(pre)) continue;
        const near = body.slice(Math.max(0, hm.index - window), Math.min(body.length, hm.index + window));
        if (!ctx.test(near)) continue;
        const sentence = sentenceAround(body, hm.index);
        const historical = HISTORICAL_PERIOD.test(sentence); // 'former' is the trigger here, not a date marker
        findings.push({
          check: 'office-holder',
          severity: historical ? 'FLAG' : 'FAIL',
          message:
            `Stale descriptor on a sitting office-holder — ${f.value} IS the current ${f.label} (since ${f.effective}); "former/ex/previous" reads as if they no longer hold it.` +
            (historical
              ? ` Looks historical — verify it refers to a past period, not the present: "${sentence.slice(0, 150)}"`
              : ` HARD FAIL — present-tense: "${sentence.slice(0, 150)}"`),
        });
      }
    }
  }
  return { findings, checked: facts.length };
}

// ---------------------------------------------------------------------------
// Truth cross-check.
// ---------------------------------------------------------------------------
function crossCheck(claims: Claim[], truth: any): Finding[] {
  const findings: Finding[] = [];
  const t = truth?.claims ?? {};
  for (const c of claims) {
    const tv = t[c.key];
    if (!tv) continue; // handled by the unverified-critical gate
    c.truthDirection = tv.direction;
    c.truthValue = tv.value;
    c.truthSource = tv.source;
    if (tv.direction && c.direction !== 'unknown' && tv.direction !== c.direction) {
      c.status = 'FAIL';
      findings.push({
        check: 'truth-direction',
        severity: 'FAIL',
        message: `${c.asset}: brief says "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''}, ground truth is "${tv.direction}"${tv.value ? ` (${tv.value})` : ''}. ${tv.source ? `Source: ${tv.source}. ` : ''}Section: ${c.section}.${loadBearingNote(c.section)} Sentence: "${c.sentence.slice(0, 160)}"`,
      });
    } else if (tv.magnitudePct != null && c.magnitudePct != null && Math.abs(tv.magnitudePct - c.magnitudePct) > (tv.tolerancePct ?? 1.0)) {
      c.status = 'FAIL';
      findings.push({
        check: 'truth-magnitude',
        severity: c.tier === 'critical' ? 'FAIL' : 'FLAG',
        message: `${c.asset}: brief says ${c.magnitudePct}%, ground truth ${tv.magnitudePct}% (>${tv.tolerancePct ?? 1.0}pp off). Section: ${c.section}.`,
      });
    } else {
      c.status = 'PASS';
    }
  }
  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const briefArg = args.find((a) => !a.startsWith('--'));
  const truthIdx = args.indexOf('--truth');
  const truthArg = truthIdx >= 0 ? args[truthIdx + 1] : null;
  const allowUnverified = args.includes('--allow-unverified');
  const archiveDaysIdx = args.indexOf('--archive-days');
  const archiveDays = archiveDaysIdx >= 0 ? parseInt(args[archiveDaysIdx + 1], 10) || 14 : 14;

  if (!briefArg) {
    console.error('Usage: fact-gate.ts <brief.md> [--truth <truth.json>] [--allow-unverified] [--archive-days N]');
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) {
    console.error(`File not found: ${briefPath}`);
    process.exit(2);
  }
  const body = stripComments(fs.readFileSync(briefPath, 'utf8'));

  // Registry (zero-network). Resolve relative to repo root (script lives in scripts/).
  const registryPath = path.join(path.dirname(briefPath), '..', '..', 'system', 'current-facts.json');
  const altRegistry = path.join(process.cwd(), 'system', 'current-facts.json');
  let registry: any = { facts: [] };
  for (const p of [registryPath, altRegistry]) {
    if (fs.existsSync(p)) { registry = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
  }

  // Optional truth file. Default convention: daily-briefs/{date}-truth.json next to brief.
  // Weekly files ("2026-W27-jun-28-jul-04.md" / "2026-W27-light.md") carry a week id
  // instead of a date — without this fallback the ledger fell to cwd/factcheck.json
  // and the weekly chain produced no ledger at all (W27 gap, wired 2026-07-05).
  let truth: any = null;
  const dateMatch =
    path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/) ??
    path.basename(briefPath).match(/(\d{4}-W\d{1,2})/i);
  const briefDate = dateMatch ? dateMatch[1] : null;
  const defaultTruth = briefDate ? path.join(path.dirname(briefPath), `${briefDate}-truth.json`) : null;
  const truthPath = truthArg
    ? (path.isAbsolute(truthArg) ? truthArg : path.join(process.cwd(), truthArg))
    : defaultTruth && fs.existsSync(defaultTruth) ? defaultTruth : null;
  if (truthPath && fs.existsSync(truthPath)) truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));

  const findings: Finding[] = [];

  // 1. Office-holders
  const office = checkOfficeHolders(body, registry);
  findings.push(...office.findings);

  // 2. Extract market claims
  const claims = extractClaims(body);

  // 3. Extract superlatives (claims of extreme)
  const superlatives = extractSuperlatives(body);

  // 4. Archive backstop (zero-network): disprove false superlatives + flag price fabrications.
  const archive = loadArchive(briefPath, briefDate, archiveDays);
  const archiveAssetsKnown = Object.keys(archive).length;
  const briefPrices = assetValuesIn(body);
  findings.push(...archiveBackstop(superlatives, briefPrices, archive));

  // 5. Truth cross-check (if truth present)
  if (truth) findings.push(...crossCheck(claims, truth));

  // 6. Unverified-critical gate (market claims only; superlatives are flagged for verification, not blocked here)
  const unverifiedCritical = claims.filter((c) => c.tier === 'critical' && c.status === 'UNVERIFIED');
  if (!allowUnverified) {
    for (const c of unverifiedCritical) {
      findings.push({
        check: 'unverified-critical',
        severity: 'FAIL',
        message: `CRITICAL claim not verified against ground truth — ${c.asset} "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''} (${c.section}). No truth entry. "No number from memory": verify it and record {date}-truth.json, or pass --allow-unverified for a dry run.`,
      });
    }
  }

  const allClaims = [...claims, ...superlatives];

  // Ledger output (the worklist the editorial agents clear by verify-and-correct).
  const ledger = {
    brief: path.basename(briefPath),
    generated: new Date().toISOString(),
    truthFile: truthPath ? path.basename(truthPath) : null,
    summary: {
      claims: claims.length,
      superlatives: superlatives.length,
      pass: allClaims.filter((c) => c.status === 'PASS').length,
      fail: allClaims.filter((c) => c.status === 'FAIL').length,
      unverified: allClaims.filter((c) => c.status === 'UNVERIFIED').length,
      officeHolderFacts: office.checked,
      archiveAssetsKnown,
    },
    findings,
    claims: allClaims,
  };
  const ledgerPath = briefDate
    ? path.join(path.dirname(briefPath), `${briefDate}-factcheck.json`)
    : path.join(process.cwd(), 'factcheck.json');
  try { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); } catch { /* read-only fs is fine */ }

  const fails = findings.filter((f) => f.severity === 'FAIL');
  const flags = findings.filter((f) => f.severity === 'FLAG');

  console.log(`fact-gate — ${path.basename(briefPath)}`);
  console.log(`  market claims: ${claims.length} · superlatives: ${superlatives.length} (${ledger.summary.pass} pass, ${ledger.summary.fail} fail, ${ledger.summary.unverified} unverified)`);
  console.log(`  archive: ${archiveAssetsKnown} assets known from our last ${archiveDays} briefs`);
  console.log(`  truth file: ${truthPath ? path.basename(truthPath) : 'NONE (critical claims will block unless --allow-unverified)'}`);
  console.log(`  ledger: ${ledgerPath}`);
  if (flags.length) {
    console.log(`\n  ${flags.length} FLAG (verify):`);
    for (const f of flags) console.log(`   ⚠ [${f.check}] ${f.message}`);
  }
  if (fails.length === 0) {
    console.log(`\n✅ FACT-GATE PASS`);
    process.exit(0);
  }
  console.log(`\n❌ FACT-GATE FAIL — ${fails.length} issue(s):`);
  for (const f of fails) console.log(`   ✗ [${f.check}] ${f.message}`);
  process.exit(1);
}

main();
