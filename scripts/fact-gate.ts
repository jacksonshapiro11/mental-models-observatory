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
 *   5. DRAMATIC-EVENT REUSE (added 2026-07-10 — KOSPI circuit-breaker class).
 *      Circuit breakers / trading halts / sidecars presented as FRESH (Overnight
 *      or undated present tense) while an identical venue+event already shipped
 *      in a prior brief within ~5 days → FAIL. Past-date anchors ("on Tuesday",
 *      "July 7") silence the check. Worked failure: 07-10 Overnight restated
 *      Tuesday 07-07's KOSPI halt (−4.91% / >8% intraday / sixth of 2026) while
 *      Thu 07-09 closed +0.62% and Fri 07-10 was rallying ~5%.
 *
 *   6. STORY-FINGERPRINT REUSE (added 2026-07-10 — "don't repeat 3-day-old
 *      stories as fresh"). Same asset/company + direction + magnitude (±0.4pp)
 *      presented as FRESH while our archive already printed that move within
 *      ~3 days → FAIL. Catches the companion class: Jul 10 Overnight also
 *      restated Tuesday's "Nikkei fell 2.1 percent" without dating it. Past-date
 *      anchors silence. First occurrence and correctly dated follow-ups stay silent.
 *
 * Gate logic:
 *   - Any registry contradiction (e.g. Powell-as-current-chair)        -> FAIL
 *   - Any superlative contradicted by our own archive                  -> FAIL
 *   - Any truth contradiction (direction mismatch on any claim)        -> FAIL
 *   - Any CRITICAL claim left UNVERIFIED (no truth entry), unless
 *     --allow-unverified                                               -> FAIL
 *   - Dramatic market event reused as fresh from a prior brief         -> FAIL
 *   - Story fingerprint (same % move) reused undated within ~3 days    -> FAIL
 *   - A stated price far from our recent archive                       -> FLAG (verify)
 *   FAIL -> exit 1 (details + worklist written). FLAG is advisory.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fact-gate.ts <brief.md> [--truth <truth.json>] [--allow-unverified] [--archive-days N]
 *   node --experimental-strip-types scripts/fact-gate.ts --selftest
 *
 * Exit codes: 0 pass · 1 fact failure (details printed + ledger written) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type Tier = 'critical' | 'standard';
type Status = 'PASS' | 'FAIL' | 'UNVERIFIED';
type Finding = { check: string; severity: 'FAIL' | 'FLAG'; message: string };

interface Claim {
  key: string;
  asset: string;
  tier: Tier;
  claimType?: 'market' | 'superlative' | 'event' | 'aggregate' | 'entity-count' | 'effective-date' | 'ai-product' | 'yoy' | 'headline' | 'byline' | 'source-conclusion';
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

// Terms of art that CONTAIN a superlative word but assert nothing empirical, so no archive
// or primary source can adjudicate them. Every entry requires a RECEIPT — a real false
// positive on a real brief — because a suppression list is how a truth gate goes blind.
//   2026-07-13 (IMP-045): "the highest-and-best use of that land has shifted to AI
//   infrastructure" (Prologis/Segro bullet) was extracted as a market superlative and sent
//   to the Morning Truth Gate as a claim to verify. It is a real-estate term of art. A gate
//   that hands the operator a worklist of non-claims is training them to skim the worklist —
//   which is the same failure as the 133%-overlap validator (IMP-042), one day earlier.
const SUPERLATIVE_TERM_OF_ART: RegExp[] = [
  /highest[-\s]?and[-\s]?best\s+use/i,
];

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

// "%" or the word "percent"/"pct" — editorial prose almost always uses the word.
// Do NOT put \b after "%" — "%" is non-word, so \b fails before a space/end.
const PCT_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/i;

function detectDirection(window: string): { dir: 'up' | 'down' | 'unknown'; mag: number | null } {
  const lower = window.toLowerCase();
  // Signed percent takes priority if explicit.
  const signed = window.match(/([+−-])\s*(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/i);
  let dir: 'up' | 'down' | 'unknown' = 'unknown';
  if (signed) dir = signed[1] === '+' ? 'up' : 'down';
  if (dir === 'unknown') {
    // WORD-BOUNDARY MATCH (fixed 2026-07-17 — brief-morning).
    // Was `lower.indexOf(w)`, a raw substring scan: UP_WORDS contains 'up', so
    // "Iran supply risk" matched 'up' at index 1 and scored WTI as UP while the
    // brief said "held ~$80, steadied". Same trap for output/upside/support/group
    // and for 'down' inside downside/downturn. A direction read from the middle of
    // an unrelated word is not a direction read. Multi-word entries ('sold off')
    // are escaped and bounded on the outer edges only.
    const firstIdx = (words: string[]): number => {
      let best = Infinity;
      for (const w of words) {
        const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const m = re.exec(lower);
        if (m && m.index < best) best = m.index;
      }
      return best;
    };
    const firstUp = firstIdx(UP_WORDS);
    const firstDown = firstIdx(DOWN_WORDS);
    if (firstUp < firstDown) dir = 'up';
    else if (firstDown < firstUp) dir = 'down';
  }
  const magMatch = window.match(PCT_RE);
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
      // Direction window: 100 chars after the asset mention (covers "closed down 4.91 percent after…").
      const window = body.slice(end, Math.min(body.length, end + 100));
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
    // Term-of-art guard (IMP-045): "highest-and-best use" is not a claim of extreme.
    const toaCtx = body.slice(Math.max(0, idx - 5), Math.min(body.length, idx + 40));
    if (SUPERLATIVE_TERM_OF_ART.some((re) => re.test(toaCtx))) continue;
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
// A number belongs to the NEAREST asset named before it. If another asset is named between
// this asset's mention and the number, the number is that asset's — not ours.
//
// IMP-045 (2026-07-13). THE GATE COMMITTED THE TRANSPOSITION CLASS IT EXISTS TO CATCH.
// `wti`'s lexicon aliases the generic nouns `crude` and `oil`. The 07-13 intro reads:
//   "The oil market has already returned the first verdict this morning: Brent is bid
//    about 4% to $79 while 34 ships transit a strait that normally carries 88…"
// `oil` matched, `valueNear` scanned forward 90 chars, found Brent's $79, and assigned it
// to WTI — then `break` ensured the brief's ACTUAL WTI print ("WTI bid to roughly $74.41",
// two sections later) was never read. The gate FLAGged "WTI stated near 79 deviates…" — a
// false alarm, on a morning whose whole job was separating true numbers from false ones.
// Right number, wrong asset, produced BY the check built for right-number-wrong-asset.
function valueNearAttributed(text: string, fromIdx: number, span: number, selfKey: string): number | null {
  const after = text.slice(fromIdx, Math.min(text.length, fromIdx + span));
  let cut = after.length;
  for (const a of ASSETS) {
    if (a.key === selfKey) continue;
    a.re.lastIndex = 0;
    const mm = a.re.exec(after);
    if (mm && mm.index < cut) cut = mm.index;
  }
  const window = after.slice(0, cut);
  return valueNear(window, 0, window.length);
}

function assetValuesIn(text: string): Record<string, number> {
  const stripped = stripComments(text);
  const out: Record<string, number> = {};
  for (const a of ASSETS) {
    const band = PRICE_BANDS[a.key];
    if (!band) continue; // only clean $-price assets enter the archive
    a.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = a.re.exec(stripped)) !== null) {
      const v = valueNearAttributed(stripped, m.index + m[0].length, 90, a.key);
      // A rejected candidate does not end the search — keep scanning for a mention of THIS
      // asset that actually owns a number ("oil market … Brent $79" rejected, "WTI … $74.41" kept).
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

// ---------------------------------------------------------------------------
// Dramatic-event reuse (zero-network). Catches "yesterday's halt as today's Overnight."
// ---------------------------------------------------------------------------
// Require an ACTIVATION (triggered/tripped/activated…), not the bare mechanism noun
// (07-06 Take said "blunted by … circuit breakers" as structure — that must stay silent).
const DRAMATIC_EVENT_RE = new RegExp([
  '(?:triggered|tripped|activated|issued|hit)\\b[^.\\n]{0,60}circuit\\s+breaker',
  'circuit\\s+breaker\\b[^.\\n]{0,60}(?:triggered|tripped|activated|issued|hit)',
  '(?:trading\\s+halt|halt(?:ed|ing)\\s+(?:trade|trading)(?:\\s+for)?)',
  '(?:buy|sell)[- ]?side\\s+sidecar\\s+(?:was\\s+)?(?:triggered|activated|issued)',
  '(?:triggered|activated|issued)\\b[^.\\n]{0,40}(?:buy|sell)[- ]?side\\s+sidecar',
].join('|'), 'gi');

const VENUE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: 'kospi', re: /\bKOSPI\b|\bKospi\b|South\s+Korea(?:'s)?|Korea(?:'s)?\s+(?:KOSPI|market|bourse)/i },
  { key: 'nikkei', re: /\bNikkei\b/i },
  { key: 'hang_seng', re: /\bHang\s+Seng\b/i },
  { key: 'shanghai', re: /\bShanghai\b|\bCSI\s*300\b/i },
  { key: 'nyse', re: /\bNYSE\b|\bNew\s+York\s+Stock\s+Exchange\b/i },
  { key: 'nasdaq', re: /\bNasdaq\b/i },
];

// Explicit past-date anchors that make a recycled event legitimate history, not Overnight news.
const PAST_DATE_ANCHOR_RE = /\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:'s)?\s+(?:close|session|selloff|rout|crash|halt|plunge)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\byesterday\b|\bearlier\s+this\s+week\b|\blast\s+(?:tuesday|wednesday|thursday|friday|monday|week)\b/i;

function venueNear(text: string, idx: number, radius = 220): string | null {
  const start = Math.max(0, idx - radius);
  const window = text.slice(start, Math.min(text.length, idx + radius));
  for (const v of VENUE_PATTERNS) {
    if (v.re.test(window)) return v.key;
  }
  return null;
}

function extractDramaticEvents(body: string): { venue: string; idx: number; sentence: string; section: string; pastDated: boolean }[] {
  const out: { venue: string; idx: number; sentence: string; section: string; pastDated: boolean }[] = [];
  DRAMATIC_EVENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DRAMATIC_EVENT_RE.exec(body)) !== null) {
    const venue = venueNear(body, m.index);
    if (!venue) continue;
    const sentence = sentenceAround(body, m.index);
    const section = sectionOf(body, m.index);
    const ctx = body.slice(Math.max(0, m.index - 120), Math.min(body.length, m.index + m[0].length + 160));
    out.push({
      venue,
      idx: m.index,
      sentence,
      section,
      pastDated: PAST_DATE_ANCHOR_RE.test(sentence) || PAST_DATE_ANCHOR_RE.test(ctx),
    });
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

/** FAIL when a dramatic halt/breaker is presented as fresh but already shipped recently. */
function dramaticEventReuse(body: string, briefPath: string, briefDate: string | null, lookbackDays = 5): Finding[] {
  const findings: Finding[] = [];
  const current = extractDramaticEvents(body).filter((e) => !e.pastDated);
  if (!current.length || !briefDate) return findings;

  const dir = findArchiveDir(briefPath);
  if (!dir) return findings;
  let files: string[];
  try { files = fs.readdirSync(dir); } catch { return findings; }

  const priors = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ f, d: f.slice(0, 10) }))
    .filter((x) => x.d < briefDate && daysBetween(x.d, briefDate) <= lookbackDays);

  for (const ev of current) {
    if (findings.some((f) => f.message.startsWith(`${ev.venue} `))) continue; // one FAIL per venue
    for (const { f, d } of priors) {
      let priorTxt: string;
      try { priorTxt = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
      const priorHits = extractDramaticEvents(priorTxt).filter((p) => p.venue === ev.venue);
      if (!priorHits.length) continue;
      findings.push({
        check: 'dramatic-event-reuse',
        severity: 'FAIL',
        message: `${ev.venue} dramatic market event ("${ev.sentence.slice(0, 100)}…") is presented as FRESH in ${ev.section}, but our ${d} brief already reported the same venue+event class. Yesterday's halt as today's Overnight is 🔴 — either date it explicitly ("on Tuesday" / "July 7") as history, or verify a NEW halt against a primary source and rewrite. Worked failure: 2026-07-10 restated 07-07's KOSPI circuit breaker while Korea was rebounding.`,
      });
      break; // one finding per current venue is enough
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Story-fingerprint reuse (zero-network). Catches "Tuesday's Nikkei −2.1% as
// Friday Overnight" — the broader freshness class beyond circuit breakers.
// ---------------------------------------------------------------------------
// Named companies that ship as story leads even when not in the ASSETS lexicon.
const STORY_ENTITIES: { key: string; asset: string; re: RegExp }[] = [
  { key: 'nikkei', asset: 'Nikkei', re: /\bNikkei\b/gi },
  { key: 'samsung', asset: 'Samsung', re: /\bSamsung(?:\s+Electronics)?\b/gi },
  { key: 'sk_hynix', asset: 'SK Hynix', re: /\bSK\s*Hynix\b/gi },
  { key: 'micron', asset: 'Micron', re: /\bMicron\b/gi },
  { key: 'tsmc', asset: 'TSMC', re: /\bTSMC\b/gi },
  { key: 'nvidia', asset: 'NVIDIA', re: /\bNVIDIA\b|\bNvidia\b/gi },
];

const STORY_MOVE_ASSETS = [
  ...ASSETS.filter((a) =>
    ['kospi', 'hang_seng', 'nasdaq', 'sp500', 'dow', 'russell', 'btc', 'eth', 'gold', 'wti', 'brent'].includes(a.key)
  ),
  ...STORY_ENTITIES,
];

interface StoryFingerprint {
  key: string;
  asset: string;
  direction: 'up' | 'down';
  magnitudePct: number;
  level: string | null;
  sentence: string;
  section: string;
  pastDated: boolean;
}

const MIN_STORY_MAG = 1.5; // ignore sub-1.5% noise; material moves only
const MAG_TOLERANCE = 0.4; // 4.91 vs 4.9, 2.1 vs 2.12

function extractStoryFingerprints(body: string): StoryFingerprint[] {
  const out: StoryFingerprint[] = [];
  const seen = new Set<string>();
  for (const a of STORY_MOVE_ASSETS) {
    a.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = a.re.exec(body)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const window = body.slice(end, Math.min(body.length, end + 110));
      const { dir, mag } = detectDirection(window);
      if (dir !== 'up' && dir !== 'down') continue;
      if (mag == null || mag < MIN_STORY_MAG) continue;
      const levelMatch = window.match(/(?:to|near|at)\s*\$?([\d,]+(?:\.\d+)?)/);
      const sentence = sentenceAround(body, start);
      const ctx = body.slice(Math.max(0, start - 120), Math.min(body.length, end + 160));
      const pastDated = PAST_DATE_ANCHOR_RE.test(sentence) || PAST_DATE_ANCHOR_RE.test(ctx);
      const dedupe = `${a.key}|${dir}|${mag}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({
        key: a.key,
        asset: a.asset,
        direction: dir,
        magnitudePct: mag,
        level: levelMatch ? levelMatch[1].replace(/,/g, '') : null,
        sentence,
        section: sectionOf(body, start),
        pastDated,
      });
    }
  }
  return out;
}

function fingerprintsMatch(a: StoryFingerprint, b: StoryFingerprint): boolean {
  if (a.key !== b.key || a.direction !== b.direction) return false;
  if (Math.abs(a.magnitudePct - b.magnitudePct) <= MAG_TOLERANCE) return true;
  // Same close level is also a fingerprint (68,257 vs 68,256) even if mag wording drifts.
  if (a.level && b.level) {
    const la = parseFloat(a.level);
    const lb = parseFloat(b.level);
    if (!isNaN(la) && !isNaN(lb) && la >= 100 && Math.abs(la - lb) / la < 0.002) return true;
  }
  return false;
}

/** FAIL when a material % move is presented as fresh but already shipped within ~3 days. */
function storyFingerprintReuse(body: string, briefPath: string, briefDate: string | null, lookbackDays = 3): Finding[] {
  const findings: Finding[] = [];
  const current = extractStoryFingerprints(body).filter((e) => !e.pastDated);
  if (!current.length || !briefDate) return findings;

  const dir = findArchiveDir(briefPath);
  if (!dir) return findings;
  let files: string[];
  try { files = fs.readdirSync(dir); } catch { return findings; }

  const priors = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ f, d: f.slice(0, 10) }))
    .filter((x) => x.d < briefDate && daysBetween(x.d, briefDate) <= lookbackDays);

  for (const fp of current) {
    if (findings.some((f) => f.check === 'story-fingerprint-reuse' && f.message.startsWith(`${fp.asset} `))) continue;
    for (const { f, d } of priors) {
      let priorTxt: string;
      try { priorTxt = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
      const priorHits = extractStoryFingerprints(priorTxt).filter((p) => fingerprintsMatch(fp, p));
      if (!priorHits.length) continue;
      findings.push({
        check: 'story-fingerprint-reuse',
        severity: 'FAIL',
        message: `${fp.asset} ${fp.direction} ${fp.magnitudePct}% ("${fp.sentence.slice(0, 100)}…") is presented as FRESH in ${fp.section}, but our ${d} brief already reported the same move fingerprint. Recycled 3-day-old tape as today's news is 🔴 — date it explicitly ("on Tuesday" / "${d}") as history, or verify a NEW move against a primary source and rewrite. Worked failure: 2026-07-10 Overnight restated 07-07's Nikkei −2.1% / KOSPI −4.91% while Asia was rebounding.`,
      });
      break;
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// SCHEDULED-EVENT DATE CHECK (IMP-044, 2026-07-13 — closes IMP-043's stated residual).
//
// WORKED FAILURE. The 07-13 evening chain built its Markets & Macro LEAD, its Dashboard
// Commodities line and the Light on one sentence: "CPI and the first post-Hormuz tape land
// in the same session." June CPI lands TUESDAY 2026-07-14 (BLS Schedule of Releases —
// primary source, one fetch away). Architect, Writer, Quality Gate, Editor and Critic all
// passed it, and factcheck.json never even EXTRACTED it: fact-gate knew about prices and
// superlatives and had no notion of a RELEASE DATE. "X prints today" is load-bearing (it was
// the bullet's entire premise), trivially checkable, and was ungated. The morning pass caught
// it and REBUILT the section — a human backstop where a gate belongs.
//
// TWO LEGS, and the second is why coverage does not depend on the calendar being complete:
//   (a) CALENDAR CONTRADICTION → FAIL. The brief says the print lands on day D; the
//       primary-sourced system/event-calendar.json says otherwise. Loud, early, at draft time.
//   (b) UNRESOLVED SAME-SESSION ASSERTION → a CRITICAL claim on the existing rails. With no
//       calendar entry, "lands today" still becomes an unverified critical claim, so
//       --require-resolved hard-fails it at the Morning Truth Gate exactly like an unverified
//       price. An empty calendar degrades the check from EARLY to BLOCKING — never to silent.
// ---------------------------------------------------------------------------
type CalEvent = { id: string; event: string; referenceMonth?: string; releaseDate: string; timeET?: string; source: string };

const SCHEDULED_EVENTS: { id: string; label: string; re: RegExp }[] = [
  { id: 'cpi', label: 'CPI', re: /\bCPI\b|consumer price index|inflation (?:print|report|release|number)/i },
  { id: 'ppi', label: 'PPI', re: /\bPPI\b|producer price index/i },
  { id: 'pce', label: 'PCE', re: /\bPCE\b|personal consumption expenditures/i },
  { id: 'payrolls', label: 'the payrolls report', re: /\bNFP\b|nonfarm payrolls|non-farm payrolls|jobs report|employment report/i },
  { id: 'fomc', label: 'the FOMC decision', re: /\bFOMC\b|Fed(?:eral Reserve)?\s+(?:rate\s+)?(?:decision|meeting|minutes)|rate decision/i },
  { id: 'gdp', label: 'the GDP print', re: /\bGDP\s+(?:print|report|release|data)\b|gross domestic product/i },
  { id: 'retail_sales', label: 'retail sales', re: /retail sales (?:print|report|release|data)/i },
  { id: 'jobless_claims', label: 'jobless claims', re: /jobless claims|initial claims/i },
];

// The load-bearing, falsifiable-today class: the print lands in THIS session.
const SAME_SESSION_RE = /\b(?:lands?|arrives?|prints?|drops?|hits? the tape|is out|comes? out)\s+(?:today|this (?:morning|session))\b|\b(?:today|this session)(?:['’]s)?\s+(?:\w+\s+){0,2}(?:print|release|report)\b|\bin the same session\b|\barriv\w*\s+simultaneously\b|\bland\s+in\s+the\s+same\s+session\b|\bsame session\b/i;
const RELEASE_VERB_RE = /\b(?:lands?|arrives?|prints?|drops?|is (?:released|out)|comes? out|hits? the tape)\b/i;
const TOMORROW_RE = /\btomorrow\b/i;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function loadEventCalendar(briefPath: string): CalEvent[] {
  for (const p of [
    path.join(process.cwd(), 'system', 'event-calendar.json'),
    path.join(path.dirname(briefPath), '..', 'system', 'event-calendar.json'),
  ]) {
    try {
      if (fs.existsSync(p)) return (JSON.parse(fs.readFileSync(p, 'utf8')).events ?? []) as CalEvent[];
    } catch { /* a malformed calendar must not take the brief down; the (b) leg still blocks */ }
  }
  return [];
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function scheduledEventClaims(body: string, calendar: CalEvent[], briefDate: string | null): { claims: Claim[]; findings: Finding[] } {
  const claims: Claim[] = [];
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();

  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    if (!RELEASE_VERB_RE.test(text) && !SAME_SESSION_RE.test(text)) continue;

    for (const ev of SCHEDULED_EVENTS) {
      if (!ev.re.test(text)) continue;
      const sameSession = SAME_SESSION_RE.test(text);
      const cal = calendar
        .filter((c) => c.id === ev.id && (!briefDate || c.releaseDate >= briefDate))
        .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))[0];

      // What date does the SENTENCE assert? Only three forms are unambiguous enough to
      // adjudicate mechanically; anything else is left to the (b) leg.
      let assertedDate: string | null = null;
      if (sameSession && briefDate) assertedDate = briefDate;
      else if (TOMORROW_RE.test(text) && briefDate) assertedDate = addDays(briefDate, 1);

      const key = `${ev.id}:${assertedDate ?? 'undated'}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // (a) CALENDAR CONTRADICTION — a date we hold on primary-source authority.
      if (cal && assertedDate && cal.releaseDate !== assertedDate) {
        findings.push({
          check: 'scheduled-event-date',
          severity: 'FAIL',
          message: `RELEASE-DATE FALSEHOOD — the brief asserts ${ev.label} lands ${assertedDate === briefDate ? 'in THIS session' : `on ${assertedDate}`}; the calendar has the next ${ev.label} release on ${cal.releaseDate}${cal.timeET ? ` at ${cal.timeET} ET` : ''}${cal.referenceMonth ? ` (reference month ${cal.referenceMonth})` : ''} — primary source: ${cal.source}. A release date is a checkable fact. If this claim is the SECTION'S PREMISE, a number-swap is not a fix: rebuild the section on the true date (Morning_Updater premise rule). Section: ${sectionOf(stripped, idx)}. "${text.trim().slice(0, 160)}"`,
        });
      } else if (cal && !assertedDate) {
        // A named weekday is checkable too, and it is how the corrected 07-13 brief phrases it.
        const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`, 'i').test(text));
        if (wd >= 0) {
          const calWd = new Date(`${cal.releaseDate}T12:00:00Z`).getUTCDay();
          if (calWd !== wd) {
            findings.push({
              check: 'scheduled-event-date',
              severity: 'FAIL',
              message: `RELEASE-DATE FALSEHOOD — the brief puts ${ev.label} on a ${WEEKDAYS[wd]}; the calendar has it on ${cal.releaseDate}, a ${WEEKDAYS[calWd]} — primary source: ${cal.source}. Section: ${sectionOf(stripped, idx)}. "${text.trim().slice(0, 160)}"`,
            });
          }
        }
      }

      // (b) THE CLAIM ITSELF — critical when it asserts THIS session (the class that shipped
      // on 07-13); standard otherwise. Rides the existing unverified-critical /
      // unresolved-before-publish rails, so a missing calendar entry blocks rather than passes.
      claims.push({
        key: `event:${ev.id}`,
        asset: ev.label,
        tier: sameSession ? 'critical' : 'standard',
        claimType: 'event',
        direction: 'unknown',
        magnitudePct: null,
        level: assertedDate ?? null,
        section: sectionOf(stripped, idx),
        sentence: text.trim(),
        status: 'UNVERIFIED',
      });
    }
  }
  return { claims, findings };
}

// ---------------------------------------------------------------------------
// AGGREGATE-CLAIM CHECK (IMP-056, 2026-07-15 — the 07-15 Critic's mandate #1).
//
// WORKED FAILURE. The 07-15 C&C-1 LEDE said: "Combined Q2 net income across JPMorgan,
// Bank of America, Goldman, Wells, and Citi cleared roughly $49 billion, up 39% year over
// year." The number was TRUE (Quartz/Yahoo attest the combined $49B/+39%), but it rode to
// publish INSIDE a superlative claim's prose value — the Critic could not resolve it and
// emitted UNRESOLVED-FACT, because fact-gate knew market prices, superlatives and event
// dates and had NO notion of an AGGREGATE. The Critic's specific fear — the aggregate's
// +39% being a single constituent's growth copied up — was real even though today's was a
// coincidence (Goldman's REVENUE also grew 39%). A combined figure built from named
// constituents, with an optional YoY %, is load-bearing and independently checkable.
//
// FIX (mirrors the scheduled-event leg (b), IMP-044): extract it as a CRITICAL claim on the
// existing unverified-critical / unresolved-before-publish rails, so --require-resolved
// requires a dedicated truth entry `aggregate:<magnitude>` resolved against an INDEPENDENT
// AGGREGATE source (not a side-mention inside a constituent's prose). Coverage does not
// depend on any registry being complete — an unresolved aggregate BLOCKS at the Morning
// Truth Gate exactly like an unverified price.
//
// NON-FIRE DISCIPLINE. Bare "total"/"in total" is EXCLUDED from the connective list on
// purpose: the 07-13 brief's "$1.045 trillion in total FY2026 Pentagon resources" is a
// single entity's own total, not a sum across named constituents, and must stay silent
// (IMP-045's check runs --require-resolved on the 07-13 brief). The trigger requires a
// COMBINING connective AND a money magnitude AND aggregation context (a financial metric
// noun or an "the N largest <plural>" group) in the same sentence.
// ---------------------------------------------------------------------------
const AGGREGATE_CONNECTIVE_RE = /\b(?:combined|in aggregate|collectively|between them|all told|taken together)\b/i;
const AGG_MONEY_RE = /(?:\$|USD\s*)\s?\d[\d,.]*\s*(?:trillion|billion|million|tn\b|bn\b|mn\b)/i;
const AGG_METRIC_RE = /\b(?:net income|profits?|earnings|revenues?|premiums?|deposits|assets under management|sales|income|payouts?|buybacks?|dividends?)\b/i;
const AGG_GROUP_RE = /\bthe\s+(?:two|three|four|five|six|seven|eight|nine|ten|top\s+\w+|largest|biggest)\s+(?:[\w.-]+\s+){0,3}(?:banks?|lenders?|firms?|hyperscalers?|labs?|companies|carriers?|insurers?|automakers?|majors?|players?|producers?|retailers?|airlines?|utilities|miners?|telecoms?)\b/i;
const AGG_YOY_RE = /\bup\s+(\d+(?:\.\d+)?)\s*(?:%|percent)/i;

function aggregateClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    if (!AGGREGATE_CONNECTIVE_RE.test(text)) continue;
    const money = text.match(AGG_MONEY_RE);
    if (!money) continue;
    // A SUM ACROSS CONSTITUENTS, not one entity's own total: require a financial-metric noun
    // or a "the N largest <plural>" group in the same sentence.
    if (!AGG_METRIC_RE.test(text) && !AGG_GROUP_RE.test(text)) continue;

    const moneyDisplay = money[0].replace(/\s+/g, ' ').trim();
    const slug = moneyDisplay.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const key = `aggregate:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const yoy = text.match(AGG_YOY_RE);
    claims.push({
      key,
      asset: `aggregate ${moneyDisplay}`,
      tier: 'critical',
      claimType: 'aggregate',
      direction: 'unknown',
      magnitudePct: yoy ? parseFloat(yoy[1]) : null,
      level: moneyDisplay,
      section: sectionOf(stripped, idx),
      sentence: text.trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// ENTITY-COUNT CHECK (IMP-069, 2026-07-18 — the 07-18 Critic's mandate #1, the FLOOR half).
//
// WORKED FAILURE. The 07-18 C&C-1 LEDE priced the Kroger/Giant Eagle deal "at roughly 0.18 times
// revenue for a 470-store regional grocer." Kroger's OWN IR release says 197 supermarkets + 11
// pharmacies (208 locations); 470 folds GetGo convenience/gas stations into a grocery count,
// overstating the footprint >2x. The number is load-bearing — it frames the SCALE of the deal —
// and checkable in one Kroger-IR fetch. Architect, Writer, QG, Editor and Critic all passed it;
// fact-gate knew prices, superlatives, event-dates and aggregates but had NO notion of an ENTITY
// COUNT, so nothing extracted it. The morning pass corrected it to "197-supermarket" only because
// the Critic emitted UNRESOLVED-FACT — a human backstop where a gate belongs. 3rd consecutive brief
// (07-16/07-17/07-18) to ship a confirmed factual error to v2; §0 makes truth disqualifying, so the
// class is mechanized the SAME DAY (a floor item, exempt from the ceiling observation window).
//
// FIX (mirrors aggregate / scheduled-event leg b). A physical-footprint count attached to a company
// or a deal — "470-store", "197-supermarket", "1,200 locations" — is extracted as a CRITICAL claim
// on the existing unresolved-before-publish rails, so --require-resolved forces a dedicated truth
// entry (entity-count:<n>-<noun>) resolved against the company's OWN filing, not a memory number.
//
// NON-FIRE DISCIPLINE. A footprint NOUN is required, so "$9 billion in annual sales", "97 billion
// hours" and "170-plus projects" (no footprint noun) stay SILENT. Scoped to physical-footprint
// nouns (store/supermarket/location/branch/outlet/restaurant/dealership/warehouse/plant/site/
// factory/hotel/clinic/hospital) — the scale-framing class that broke — not every count.
// ---------------------------------------------------------------------------
const FOOTPRINT_NOUN = 'stores?|supermarkets?|locations?|branches|outlets?|restaurants?|dealerships?|warehouses?|plants?|sites?|factories|hotels?|clinics?|hospitals?|dealers?';
const ENTITY_COUNT_RE = new RegExp(`\\b(\\d{1,3}(?:,\\d{3})+|\\d{2,})[-\\s]?(${FOOTPRINT_NOUN})\\b`, 'i');

function entityCountClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const m = text.match(ENTITY_COUNT_RE);
    if (!m) continue;
    const count = m[1]!.replace(/,/g, '');
    const noun = m[2]!.toLowerCase();
    const key = `entity-count:${count}-${noun}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: `${m[1]} ${noun}`,
      tier: 'critical',
      claimType: 'entity-count',
      direction: 'unknown',
      magnitudePct: null,
      level: count,
      section: sectionOf(stripped, idx),
      sentence: text.trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// REGULATORY EFFECTIVE-DATE CHECK (IMP-069, 2026-07-18 — the 07-18 Critic's mandate #1).
//
// WORKED FAILURE. The 07-18 C&C-4 LEAD said "The GENIUS Act's stablecoin framework takes effect
// today." July 18 2026 is the one-year STATUTORY DEADLINE for the six agencies to publish
// implementing regulations; the framework's EFFECTIVE date is the earlier of 18 months after
// enactment (2027-01-18) or 120 days after final rules (OCC Bulletin 2026-3, FDIC/Treasury). "Takes
// effect today" conflates the rulemaking deadline with the compliance date — a material distinction
// for issuers, and the section's void thesis is actually ABOUT the deadline. Checkable in one OCC
// fetch. Nothing extracted it; the morning pass reframed it only because the Critic flagged it.
//
// FIX. An assertion that a named law/rule/framework/tariff/ban BECOMES OPERATIVE on a date ("takes
// effect", "goes into effect", "comes into force", "becomes effective", "effective date/today") is
// extracted as a CRITICAL claim on the unresolved-before-publish rails, so --require-resolved forces
// a truth entry sourced to the statute/agency, not memory.
//
// NON-FIRE DISCIPLINE. A regulatory NOUN (act/law/rule/regulation/framework/statute/directive/
// mandate/ordinance/ban/tariff/provision/requirement) must sit in the same sentence, so bare
// "highly effective"/"cost-effective" stays SILENT — and so does "the deadline … falls today" (a
// DEADLINE, not an effective date: the corrected 07-18 phrasing), because "falls" is not an
// effective-verb. That distinction is the whole point of the fix.
// ---------------------------------------------------------------------------
const EFFECTIVE_VERB_RE = /\b(?:takes?\s+effect|took\s+effect|go(?:es)?\s+into\s+effect|went\s+into\s+effect|com(?:es|ing)?\s+into\s+force|came\s+into\s+force|becomes?\s+effective|became\s+effective|is\s+now\s+in\s+force|effective\s+(?:date|today|immediately|as\s+of))\b/i;
const REG_NOUN_RE = /\b(?:act|law|rule|regulations?|directive|mandate|framework|statute|ordinance|ban|tariffs?|provision|requirement|standard|amendment|bill)\b/i;

function effectiveDateClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    if (!EFFECTIVE_VERB_RE.test(text)) continue;
    if (!REG_NOUN_RE.test(text)) continue;
    const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
    const key = `effective-date:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: 'regulatory effective date',
      tier: 'critical',
      claimType: 'effective-date',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section: sectionOf(stripped, idx),
      sentence: text.trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// AI&T DEFINITE-PRODUCT-CLAIM CHECK (IMP-074, 2026-07-19 — the 07-19 Critic's mandate #1).
//
// WORKED FAILURE. Two AI&T bullets shipped to v2 on fluent, sophisticated, FALSE premises:
//   AI&T-2: "Microsoft announced Project Perception" — Microsoft was only "reportedly" developing it,
//           and the described consensus architecture ("three models, flag when two agree") was
//           fabricated; the real product is a cost-routing system. The section's whole insight was
//           built on the invented architecture.
//   AI&T-1: "the deployment of Boston Dynamics Atlas humanoid robots on the assembly line" — NO Atlas
//           units are deployed at any Korean plant; the strike was PRE-EMPTIVE, over a future PLAN.
// This is the 07-10 "fluent/false" pattern, and §0 makes truth disqualifying. The AI&T sections ship
// v1-original (no pre-draft, un-gated), so fact-gate knew prices, superlatives, event-dates, aggregates,
// entity-counts and effective-dates but had NO notion of a PRODUCT/DEPLOYMENT assertion. 4th consecutive
// brief (07-16/17/18/19) with a confirmed factual error to v2 — a FLOOR class, mechanized the SAME day.
//
// FIX (mirrors entity-count / effective-date). A DEFINITE, UNHEDGED corporate product or deployment
// assertion in the AI & Tech section — an action verb (announced / unveiled / launched / released /
// shipped / deployed / introduced / debuted / rolled out, or "the deployment/rollout/launch of") on a
// product noun (tool / model / chip / robot / platform / system / app / agent / processor / feature /
// API / humanoid / …) — becomes a CRITICAL claim `ai-product:<slug>` on the unresolved-before-publish
// rails, so --require-resolved forces a truth entry sourced to the VENDOR'S OWN announcement/filing.
// It does not need to KNOW the claim is false; it forces the claim to be CHECKED, which is exactly the
// step the un-gated AI&T section skipped.
//
// NON-FIRE DISCIPLINE (this IS the calibration — the fabrication and its correction differ by exactly
// this word). A HEDGE in the sentence ("reportedly", "is/are developing", "plans to", "planning to",
// "expected to", "set to", "said to", "rumored", "in talks", "considering", "exploring", "working on")
// stays SILENT: an honest hedge is not the false-certainty class that shipped. The CORRECTED 07-19
// sentences ("Microsoft is reportedly developing Project Perception…" and "the company's plan to put
// Atlas robots on the line") must PASS. Analysis prose with no product-action verb stays SILENT. Scoped
// to the AI & Tech section so product mentions in the Take/Six do not flood the morning worklist.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SOURCE-CONCLUSION CHECK (IMP-143 — the 08-07 Critic's mandate #2, RE-PRESCRIBED by the 08-08
// Critic's mandate #2a after the original produced no code, no ledger row and no deferral record).
//
// WORKED FAILURE, TWICE. 08-07 AI&T-1 "states the inverse of its own source's headline finding" —
// the bullet's thesis sentence asserted the NEGATION of the study it cited as evidence, and every
// gate in the stack passed it, because every number in it was true. 08-08 AI&T-1 then shipped as a
// top-slot C for the same reason: its whole causal spine — "what surfaced it was not a control, an
// alert or a red team; agent load took Artifactory down" — rests on Zvi Mowshowitz's reconstruction
// of Eric Wallace's Black Hat talk, a source conclusion the Writer never had to write down, so
// nothing could check whether the bullet's claim was the source's claim.
//
// FIX (mirrors entity-count / effective-date / yoy — the emission-contract pattern, and the reason
// it works is stated by the 08-08 Critic: THE POWER IS THE REQUIREMENT, NOT THE PARSING. A Writer
// required to record the source's own conclusion verbatim cannot quietly invert it). When a bullet
// leans on a NAMED source's report / study / survey / evaluation / paper / talk / reconstruction,
// that becomes a CRITICAL claim keyed `source-conclusion:<slug>`, resolved only by a truth row
// carrying the source's own summary sentence. Unresolved → the existing --require-resolved rail
// blocks it at the Morning Truth Gate.
//
// AND THE INVERSION LEG: once the truth row carries `conclusion`, an explicit NEGATION in the
// brief of a content term the conclusion ASSERTS is a hard finding — the literal 08-07 defect,
// now mechanical rather than left to the Critic's reading.
//
// NON-FIRE DISCIPLINE (fact-gate runs nightly; a storm here would be paid for every night). Two
// triggers, both narrow: (a) a POSSESSIVE named source + evidence noun in a sentence that also
// carries BOTH a conclusion verb AND a numeral — the "X's study found N" shape; or (b) an
// ATTRIBUTIVE FRAME ("By / According to / Per X's reconstruction …"), where the sentence is by
// construction reporting someone else's conclusion. Measured across the real 08-04…08-08 v2
// files: 1 claim per brief. A bare citation with no evidence noun — "(C&EN, 2023)", "Epoch AI
// counted roughly 2,500 CVEs" — stays SILENT; those ride the existing number rails.
// ---------------------------------------------------------------------------
const SRC_EVIDENCE_NOUN = 'reports?|study|studies|survey|evaluation|paper|audit|analysis|assessment|findings|whitepaper|working paper|index|talk|presentation|reconstruction|briefing|dataset|census';
const SRC_NAMED = String.raw`[A-Z][A-Za-z.&'’-]{2,}(?:\s+[A-Z][A-Za-z.&'’-]+){0,3}`;
const SRC_POSSESSIVE_RE = new RegExp(String.raw`\b(${SRC_NAMED})(?:'s|’s)\s+(?:[a-z0-9-]+\s+){0,3}(?:${SRC_EVIDENCE_NOUN})\b`);
const SRC_BY_RE = new RegExp(String.raw`\b(?:${SRC_EVIDENCE_NOUN})\s+(?:by|from|published by)\s+(${SRC_NAMED})`);
const SRC_ATTRIBUTIVE_RE = new RegExp(String.raw`\b(?:By|According to|Per)\s+(${SRC_NAMED})(?:'s|’s)?\s+(?:[a-z0-9-]+\s+){0,3}(?:${SRC_EVIDENCE_NOUN})\b`);
const SRC_CONCLUSION_VERB_RE = /\b(?:found|finds|concluded|concludes|reported|reports|shows|showed|documents|documented|estimates|estimated|warns|warned|argues|argued|says|said|puts|put|counted|counts|records|recorded|has|had)\b/i;
const SRC_SECTION_RE = /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|The Signal|THE TAKE|The Take|Wild Card/i;

function srcSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

export function sourceConclusionClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!SRC_SECTION_RE.test(section)) continue;

    const attributive = SRC_ATTRIBUTIVE_RE.exec(text);
    const possessive = attributive ? null : (SRC_POSSESSIVE_RE.exec(text) ?? SRC_BY_RE.exec(text));
    const m = attributive ?? possessive;
    if (!m) continue;
    // An attributive frame IS the report of a conclusion. Otherwise demand both a conclusion verb
    // and a numeral, so a passing mention of "the report" never becomes a blocking claim.
    if (!attributive && !(SRC_CONCLUSION_VERB_RE.test(text) && /\d/.test(text))) continue;

    const phrase = m[0].replace(/\s+/g, ' ').trim();
    const key = `source-conclusion:${srcSlug(phrase)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: phrase,
      tier: 'critical',
      claimType: 'source-conclusion',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section,
      sentence: text.trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

/** Words too common to carry a conclusion's content. */
const SRC_STOPWORD = new Set([
  'about', 'above', 'after', 'again', 'against', 'their', 'there', 'these', 'those', 'which',
  'while', 'would', 'could', 'should', 'other', 'others', 'between', 'during', 'because',
  'report', 'reports', 'study', 'studies', 'survey', 'paper', 'talk', 'percent', 'first',
  'second', 'third', 'where', 'whether', 'through', 'under', 'over', 'more', 'most', 'than',
]);

/**
 * THE INVERSION LEG. Given a resolved truth row carrying the source's own conclusion sentence,
 * FAIL when the brief explicitly NEGATES a content term that conclusion asserts. This is the
 * 08-07 defect stated mechanically: "the bullet's thesis sentence asserted the negation of its
 * own source's lead finding." Bounded and conservative — an explicit negator within three words
 * of the term, not a sentiment model.
 */
export function sourceConclusionInversions(
  claims: Claim[],
  truthClaims: Record<string, { conclusion?: string; resolved?: boolean }> | undefined,
): Finding[] {
  const out: Finding[] = [];
  if (!truthClaims) return out;
  for (const c of claims) {
    const row = truthClaims[c.key];
    const conclusion = row?.conclusion;
    if (!conclusion) continue;
    const terms = [...new Set(conclusion.toLowerCase().match(/[a-z]{5,}/g) ?? [])]
      .filter((w) => !SRC_STOPWORD.has(w));
    for (const term of terms) {
      const neg = new RegExp(String.raw`\b(?:not|no|never|without|fails?\s+to|failed\s+to|does\s+not|did\s+not|is\s+not|was\s+not|were\s+not)\s+(?:\w+\s+){0,3}${term}`, 'i');
      if (!neg.test(c.sentence)) continue;
      out.push({
        severity: 'FAIL',
        check: 'source-conclusion-inverted',
        message:
          `SOURCE CONCLUSION INVERTED — the brief negates "${term}", which its own cited source ASSERTS. ` +
          `Source (${c.asset}) concluded: "${conclusion.slice(0, 200)}". Brief: "${c.sentence.slice(0, 200)}". ` +
          `2026-08-07 receipt: AI&T-1 stated the inverse of its own source's headline finding and every gate passed it, ` +
          `because every NUMBER in it was true. Restate the claim as the source made it, or cite the source that supports yours.`,
        section: c.section,
      });
      break;   // one finding per claim — the point is the bullet, not a term census
    }
  }
  return out;
}

const AI_ACTION_RE = /\b(?:announced|unveiled|launched|released|shipped|deployed|introduced|debuted|rolled\s+out|(?:the\s+)?(?:deployment|rollout|roll-out|launch|release)\s+of)\b/i;
const AI_PRODUCT_NOUN_RE = /\b(?:tools?|models?|chips?|robots?|humanoids?|platforms?|systems?|apps?|assistants?|agents?|processors?|accelerators?|features?|updates?|apis?|software|hardware|devices?|drones?|silicon|frameworks?)\b/i;
const AI_HEDGE_RE = /\b(?:reportedly|rumored|is\s+(?:still\s+)?developing|are\s+(?:still\s+)?developing|is\s+building|are\s+building|plans?\s+to|planning\s+to|expected\s+to|set\s+to|said\s+to|in\s+talks|considering|exploring|working\s+on|is\s+expected|are\s+expected|would\s+(?:launch|release|deploy|ship|build|introduce))\b/i;

function aiProductClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!/AI\s*&\s*Tech|AI\s+and\s+Tech|AI&T/i.test(section)) continue; // AI & Tech section only
    if (!AI_ACTION_RE.test(text)) continue;       // a definite product/deployment action verb
    if (!AI_PRODUCT_NOUN_RE.test(text)) continue; // on a product/deployment noun (not earnings/hiring)
    if (AI_HEDGE_RE.test(text)) continue;         // an honest hedge is not the false-certainty class
    const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    const key = `ai-product:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: 'AI&T product/deployment claim',
      tier: 'critical',
      claimType: 'ai-product',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section,
      sentence: text.trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// RELATIVE-DATE REFERENT CHECK (IMP-058, 2026-07-16 — the 07-16 Critic's mandate #1).
//
// WORKED FAILURE. The 07-16 Take LEAD said: "Yesterday New York became the first state to
// ban new hyperscale data centers outright." Governor Hochul's EO 62 was signed 2026-07-14;
// the brief is WRITTEN the evening of 07-15 and READ the morning of 07-16, so "yesterday"
// resolves to 07-15 for the reader — the event was TWO days earlier. The Morning Updater
// caught it (→ "This week") ONLY because the Critic happened to emit an UNRESOLVED-FACT line;
// nothing mechanical surfaced it, and the FLI "seven labs" (→ "nine") rode the same luck.
// A past-relative word ("yesterday", "last night", "this morning", "overnight", "earlier
// today") is the one class whose referent SHIFTS between the write date and the read date —
// a structural hazard of an evening-written, morning-read brief. It must be SURFACED every
// run, not left to whether the Critic happens to notice.
//
// FIX (advisory FLAG, never a publish-block — the brief always ships). Surface every past-
// relative date word that sits in a sentence asserting a discrete EVENT (a named actor did
// something: became / signed / banned / struck / launched / approved / …), so the Morning
// Truth Gate must confirm the ABSOLUTE date and rewrite to a stable form (a weekday, "this
// week", or the ISO date) if the referent moved. RC2 (verification gap) mechanized at the
// truth layer, independent of the Critic. FLOOR item (a date) — exempt from the ceiling
// observation window; mechanized the same day per proxy discipline.
//
// NON-FIRE DISCIPLINE. (a) Possessive "yesterday's close" is the Dashboard's stable idiom for
// the prior session and is EXCLUDED. (b) A pure market-move recap ("Yesterday the bond market
// rallied") carries no discrete-event verb and stays SILENT — the rhetorical two-print pairing
// is the Writer's device, not a dated news event, and the Dashboard's job IS the prior session.
// (c) STABLE references ("this week", "Monday", "July 14") do not shift and are not flagged.
// (d) Forward "today/tomorrow" release assertions are already owned by scheduledEventClaims.
// ---------------------------------------------------------------------------
const RELATIVE_SHIFT_RE = /\b(?:yesterday(?!['’]s)|last night|this morning|overnight|earlier today)\b/i;
const EVENT_ACTION_RE = /\b(?:became|becomes|sign(?:ed|s)?|ban(?:ned|s)?|announce(?:d|s)?|launch(?:ed|es)?|struck|strikes?|attack(?:ed|s)?|approve(?:d|s)?|file(?:d|s)?|reject(?:ed|s)?|pass(?:ed|es)?|rule(?:d|s)?|vote(?:d|s)?|acquire(?:d|s)?|unveil(?:ed|s)?|impose(?:d|s)?|seize(?:d|s)?|halt(?:ed|s)?|resign(?:ed|s)?|order(?:ed|s)?)\b/i;

function relativeDateFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const rel = text.match(RELATIVE_SHIFT_RE);
    if (!rel) continue;
    if (!EVENT_ACTION_RE.test(text)) continue; // a discrete dated event, not a market-move recap
    const word = rel[0].toLowerCase();
    const key = `${word}:${sectionOf(stripped, idx)}:${text.trim().slice(0, 24).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      check: 'relative-date-referent',
      severity: 'FLAG',
      message: `RELATIVE-DATE REFERENT — "${rel[0]}" modifies a dated event in ${sectionOf(stripped, idx)}: "${text.trim().slice(0, 140)}". This brief is written the evening before it is read, so "${word}" shifts by a day at the reader. MORNING GATE: confirm the event's ABSOLUTE date and, if the referent moved, rewrite to a stable form (a weekday, "this week", or the ISO date). Receipt: the 07-16 "Yesterday New York became the first state to ban…" was an EO signed two days before the read date, corrected to "This week".`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// YoY-COMPARISON CHECK (IMP-081, 2026-07-21 — the 07-21 Critic's mandate #1, the FABRICATION
// that SHIPPED TO THE READER).
//
// WORKED FAILURE. The 07-21 M&M-2 LEDE said GM carries "a consensus estimate of $3.13 per share
// and $45.96 billion in revenue, roughly 22% above last year." GM's Q2 2025 revenue was $47.1B
// (GM IR / CNBC / GM Authority) — so $45.96B is DOWN ~2.4%, not up 22%. The "22% above last year"
// is a FABRICATED year-over-year delta. It rode through Writer, QG, Editor and Critic, and — unlike
// STLD and AMD, which the morning pass caught — the GM YoY was NOT in the morning reconcile list, so
// the fabrication PUBLISHED. fact-gate knew market prices, superlatives, event-dates, aggregates,
// entity-counts, effective-dates and AI products, but had NO notion of a YoY COMPARISON: the stated
// $45.96B consensus is roughly right, and the fabrication lived entirely in the RELATIONAL claim
// ("22% above last year") that no leg extracted. §0 makes truth disqualifying; a fabricated stat
// that reached the reader is the worst outcome the gate exists to prevent. FLOOR class, mechanized
// the SAME DAY.
//
// FIX (mirrors aggregate / entity-count leg). A financial magnitude paired with an explicit
// prior-year referent AND a percentage — "$X in revenue, N% above last year", "up N% year over
// year", "N% jump … from $Y a year earlier" — is extracted as a CRITICAL claim `yoy:<slug>` on the
// unresolved-before-publish rails, so --require-resolved forces the Morning Truth Gate to resolve
// BOTH the prior-year actual AND the delta against a primary source, not a number from memory. It
// also catches the STLD class the same run ("roughly 85% jump … to about $3.69 from $2.01 a year
// earlier" — a restored pre-draft carrying guidance, corrected by the morning only by luck).
//
// NON-FIRE DISCIPLINE. An explicit YoY REFERENT is required, so a bare percentage — "up half a
// percent on the day", "roughly 8% of NVIDIA's run rate", "an mNAV of 0.6", "4.8% of all ether" —
// stays SILENT. A financial-metric noun OR a $ figure must sit in the sentence, so a non-financial
// "20% more than last year" trivia stays silent. The referent is the whole calibration: it is the
// difference between a comparative claim (checkable, load-bearing) and a spot ratio.
// ---------------------------------------------------------------------------
const YOY_REFERENT_RE = /\b(?:year[-\s]?over[-\s]?year|year[-\s]?on[-\s]?year|yoy|(?:a|one)\s+year\s+(?:earlier|ago)|(?:last|prior|previous)\s+year|year[-\s]ago|same\s+(?:quarter|period)\s+(?:a\s+year\s+ago|last\s+year))\b/i;
const YOY_PCT_RE = /\d+(?:\.\d+)?\s*(?:%|percent)/i; // no trailing \b: "%" is non-word, so "22% " has no boundary after it
const YOY_MONEY_RE = /(?:\$|USD\s*)\s?\d[\d,.]*/i;
const YOY_METRIC_RE = /\b(?:revenues?|earnings|per[-\s]share|EPS|net income|profits?|sales|income|backlog|orders?|bookings?|deliveries|shipments?|volumes?|deposits|premiums?|guidance)\b/i;
// Scoped to the analytical bullets + Take, where a fabricated COMPANY earnings/revenue YoY is the
// class (GM=M&M, STLD=C&C). A Signal/Discovery citing a legitimate industry YoY stat ("machine orders
// 29% ahead of last year") is a different risk and stays off the critical rails (mirrors ai-product's
// AI&T scoping — and it keeps the 07-13 Signal's real USMTO figures from blocking --require-resolved).
const YOY_SECTION_RE = /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|THE TAKE|The Take/i;

function yoyComparisonClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {           // per-line: a YoY claim spans decimals ("$3.69 from $2.01"), which a split on "." fragments
    const idx = offset; offset += text.length + 1;
    if (!YOY_REFERENT_RE.test(text)) continue;          // an explicit prior-year referent
    const pct = text.match(YOY_PCT_RE);
    if (!pct) continue;                                  // and a percentage delta
    if (!YOY_MONEY_RE.test(text) && !YOY_METRIC_RE.test(text)) continue; // a financial claim, not trivia
    if (!YOY_SECTION_RE.test(sectionOf(stripped, idx))) continue;        // the analytical-bullet + Take fabrication class only
    const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    const key = `yoy:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: 'year-over-year comparison',
      tier: 'critical',
      claimType: 'yoy',
      direction: 'unknown',
      magnitudePct: parseFloat(pct[0]),
      level: null,
      section: sectionOf(stripped, idx),
      sentence: text.trim().slice(0, 200),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// EARNINGS-RESULT vs CONSENSUS CHECK (IMP-086, 2026-07-22 — the 07-22 Critic's mandate #1: the
// FABRICATION that reached v2 and was caught only by the morning read; and the reader-facing
// enforcement for mandate #2, the stale-pre-draft class).
//
// WORKED FAILURE. The 07-22 C&C-1 said EQT posted Q2 "revenue of $2.56 billion against a $1.84
// billion consensus" (a "39% beat") with "adjusted EPS of $0.45 versus $0.41 expected" and "$240
// million" FCF. EVERY number was fabricated: actual revenue $1.81B (inline on a LOWERED consensus),
// non-GAAP EPS $0.39 (MISSED ~$0.42), FCF $330M (GuruFocus / MarketScreener / StockTitan). The
// company MISSED; the brief invented a BEAT — a SIGN REVERSAL — and it contaminated the intro
// ("EQT beat"). The cc-predraft was CONSUMED but written before the release, so the pre-release
// estimates rode through Writer, QG, Editor and Critic; the morning pass caught it by READING.
// fact-gate knew prices, superlatives, event-dates, aggregates, entity-counts, effective-dates,
// ai-products, YoY and corporate-event weekdays — but had NO notion of an EARNINGS RESULT stated
// against CONSENSUS/EXPECTED, the single most common quarterly-print claim shape, and the one whose
// failure mode (beat↔miss) reverses the sign of the event. §0 makes truth disqualifying.
//
// FIX (mirrors the yoy / aggregate legs). An earnings-result metric (revenue / EPS / net income /
// profit / FCF / sales / operating income) + a $ figure + EITHER an analyst-expectation referent
// (consensus / estimate / expected / forecast / the Street / analysts) OR an explicit BEAT/MISS
// verb (beat / missed / topped / edged past / came in above|below | fell short | surpassed | lagged)
// is a CRITICAL claim `earnings:<slug>` on the unresolved-before-publish rails, so --require-resolved
// forces the Morning Truth Gate to resolve the ACTUAL result AND the beat/miss verdict against the
// company's own release before publish. This is ALSO the reader-facing enforcement for the stale-
// pre-draft class (E-PREDRAFT-STALE-DATA-01): a pre-release estimate consumed as an actual cannot
// reach the reader while its earnings claim is unresolved.
//
// NON-FIRE DISCIPLINE. The expectation referent OR a beat/miss verb MUST co-occur with the metric
// and a $ figure — so a bare YoY ("revenue $48.03B, up 1.9% year over year", owned by
// yoyComparisonClaims) and a plain guidance line ("raised full-year output guidance by 90 Bcfe")
// stay SILENT, and a stock-price move with no earnings metric ("Micron surged 12% after a BofA
// upgrade") stays SILENT. Scoped to the analytical earnings bullets (M&M/C&C/AI&T); a Signal/Take
// citing a macro "consensus" (the 07-13 Take's "$29B war cost … consensus reads a war") is out of
// scope and stays off the critical rails — mirrors yoy's Signal exclusion.
// ---------------------------------------------------------------------------
const EARN_METRIC_RE = /\b(?:revenues?|sales|earnings|EPS|per[-\s]share|net income|profits?|free cash flow|FCF|operating income)\b/i;
const EARN_EXPECT_RE = /\b(?:consensus|estimates?|expected|expectations?|forecasts?|the\s+street|analysts?)\b|(?:vs\.?|versus)\s+\$?\d/i;
const EARN_BEATMISS_RE = /\b(?:beats?|missed?|topped|edged\s+(?:past|out)|came\s+in\s+(?:above|below|ahead|light)|fell\s+short|surpass(?:ed|es)|exceeded|trailed|lagged|outpaced)\b/i;
const EARN_MONEY_RE = /(?:\$|USD\s*)\s?\d[\d,.]*/i;
const EARN_SECTION_RE = /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T/i;
// EFFECTIVE-DATE SCOPE (IMP-086). This claim class is NEW as of 2026-07-22. The --require-resolved
// regression fixtures (07-13, 07-17, the W28 weekly) predate it and were morning-verified under the
// legs that existed then; retroactively extracting earnings claims from them would fail their truth
// gate for a class that did not exist at publish and give zero reader benefit (they cannot be
// re-published). Enforce from the introduction date FORWARD, on DAILY briefs only — a fresh
// quarterly print is a daily phenomenon; the weekly recaps beats narratively (W28's "NVIDIA's April
// 2024 beat" is not a fresh print). A YYYY-MM-DD date >= this; weekly "2026-Wnn" and null are out.
const EARNINGS_LEG_EFFECTIVE = '2026-07-22';

function earningsResultClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  if (!briefDate || !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) || briefDate < EARNINGS_LEG_EFFECTIVE) return claims;
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {           // per-line: "revenue $2.56B vs $1.84B consensus" spans decimals a "." split would fragment
    const idx = offset; offset += text.length + 1;
    if (!EARN_METRIC_RE.test(text)) continue;            // an earnings-result metric
    if (!EARN_MONEY_RE.test(text)) continue;             // carrying a $ figure
    if (!EARN_EXPECT_RE.test(text) && !EARN_BEATMISS_RE.test(text)) continue; // vs an expectation OR a beat/miss verdict
    if (!EARN_SECTION_RE.test(sectionOf(stripped, idx))) continue;           // the analytical earnings bullets only
    const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    const key = `earnings:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: 'earnings result vs consensus',
      tier: 'critical',
      claimType: 'earnings',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section: sectionOf(stripped, idx),
      sentence: text.trim().slice(0, 200),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// CORPORATE SCHEDULED-EVENT WEEKDAY CHECK (IMP-082, 2026-07-21 — the 07-21 Critic's mandate #2).
//
// WORKED FAILURE. The 07-21 AI&T-1 said "AMD opens its Advancing AI 2026 conference Tuesday." The
// conference is July 22-23 (Wednesday-Thursday; AMD's own event page — and the v1.5 staleness
// ledger itself recorded "event July 22-23"). Tuesday is the READING date. The morning pass caught
// it (→ Wednesday) only because it happened to look; scheduledEventClaims covers macro releases
// (CPI/FOMC/…) but has NO notion of a CORPORATE event — an earnings report or a product conference
// pinned to a weekday. A weekday attached to a company's scheduled event is checkable in one fetch
// and, like a relative date, its referent can be wrong at the reader.
//
// FIX (advisory FLAG, mirrors relative-date; the brief always ships). A scheduled-event verb
// (reports/opens/hosts/unveils/launches/…) + a weekday (or today/tomorrow) + an event noun
// (conference/earnings/keynote/Q_/…) surfaces a FLAG so the Morning Truth Gate confirms the
// ABSOLUTE date against the event's own source and rewrites the weekday if it is wrong. Not a
// publish-block: a wrong weekday is a timing miss, not an unverified critical price.
//
// NON-FIRE DISCIPLINE. A macro release (CPI/FOMC/…) is owned by scheduledEventClaims and excluded.
// A weekday with no scheduled-event verb ("Monday's close", "by Friday") stays SILENT — an event
// verb AND a weekday AND an event noun must co-occur.
// ---------------------------------------------------------------------------
const CORP_EVENT_VERB_RE = /\b(?:reports?|reporting|opens?|hosts?|holds?|unveils?|launches?|kicks?\s+off|presents?|convenes?|reveals?|announces?)\b/i;
const CORP_EVENT_NOUN_RE = /\b(?:conference|earnings|results|keynote|summit|investor\s+day|analyst\s+day|product|launch|quarter|Q[1-4])\b/i;
const CORP_WHEN_RE = /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i; // weekdays only; forward "today/tomorrow" is owned by scheduledEventClaims + relativeDateFindings

function corporateEventDateFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    const idx = offset; offset += text.length + 1;
    if (!CORP_EVENT_VERB_RE.test(text)) continue;
    const when = text.match(CORP_WHEN_RE);
    if (!when) continue;
    if (!CORP_EVENT_NOUN_RE.test(text)) continue;
    if (SCHEDULED_EVENTS.some((e) => e.re.test(text))) continue; // macro release owned by scheduledEventClaims
    const key = `corp-event:${sectionOf(stripped, idx)}:${text.trim().slice(0, 28).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      check: 'corporate-event-date',
      severity: 'FLAG',
      message: `CORPORATE-EVENT WEEKDAY — a company's scheduled event is pinned to "${when[0]}" in ${sectionOf(stripped, idx)}: "${text.trim().slice(0, 140)}". This brief is written the evening before it is read, and a weekday for an earnings date or a conference is checkable in one fetch. MORNING GATE: confirm the ABSOLUTE date against the event's own source and rewrite the weekday if it is wrong. Receipt: the 07-21 "AMD opens its Advancing AI 2026 conference Tuesday" was a July 22-23 (Wed-Thu) event, corrected to "Wednesday".`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// SEGMENT-METRIC ATTRIBUTION CHECK (IMP-083, 2026-07-21 — the 07-21 Critic's mandate #3, the
// UNVERIFIABLE that SHIPPED).
//
// WORKED FAILURE. The 07-21 AI&T-1 said "AMD's data-center GPU revenue, $7.7 billion in the
// trailing year through Q1, is roughly 8% of NVIDIA's annualized run rate." AMD does NOT separately
// disclose GPU revenue WITHIN its Data Center segment — Data Center is the reported line ($5.8B in
// Q1'26); a "data-center GPU revenue" figure is a proxy presented as a disclosed metric. It shipped
// to the reader. The DOUBLE qualifier — a segment word (data-center/cloud/gaming/…) AND a chip-type
// word (GPU/CPU/accelerator/…) in front of "revenue" — is the tell: the single-qualifier line
// ("Data Center revenue") is disclosed; the compound is almost never broken out.
//
// FIX (advisory FLAG + AI_Tech_Generator rubric; per proxy discipline, n=1 and fuzzy → NOT a
// blocking detector). Surface a compound segment+chip "revenue, $X" attribution so the Morning
// Truth Gate confirms the company actually reports that line (or the figure is labeled estimated/
// implied and sourced). Non-blocking — the brief ships; the gate makes the check unskippable.
//
// NON-FIRE DISCIPLINE. A SINGLE qualifier ("Data Center revenue of $12.8 billion") is a disclosed
// segment and stays SILENT; the compound (segment + chip-type + revenue) and a $ figure are
// required to fire.
// ---------------------------------------------------------------------------
const SEGMENT_METRIC_RE = /\b(?:data[-\s]?cent(?:er|re)|cloud|gaming|client|enterprise|embedded|networking|automotive)\s+(?:gpu|cpu|accelerator|silicon|chips?|processors?|npu|asics?)\s+(?:revenues?|sales|billings?)\b/i;

function segmentMetricFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    const idx = offset; offset += text.length + 1;
    if (!SEGMENT_METRIC_RE.test(text)) continue;
    if (!YOY_MONEY_RE.test(text)) continue; // a number is being attributed to the sub-segment line
    const key = `segment-metric:${sectionOf(stripped, idx)}:${text.trim().slice(0, 28).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      check: 'segment-metric-attribution',
      severity: 'FLAG',
      message: `SEGMENT-METRIC ATTRIBUTION — a compound segment+chip revenue line is attributed a figure in ${sectionOf(stripped, idx)}: "${text.trim().slice(0, 140)}". A single-qualifier segment ("Data Center revenue") is disclosed; a compound ("data-center GPU revenue") is almost never broken out. MORNING GATE: confirm the company actually reports this exact line in its filings, or label the figure "estimated"/"implied" and source it. Receipt: the 07-21 AMD "data-center GPU revenue, $7.7 billion" is not a disclosed AMD metric (Data Center = $5.8B in Q1'26).`,
    });
  }
  return findings;
}

// IMP-101 (E-STOCK-REACTION-01, 07-26 — restored + committed 07-31 by IMP-111; the 07-29 uncommitted-
// rebase had reverted it). The evening pipeline extracts an earnings RESULT (earningsResultClaims)
// and a YoY (yoy), but a bare STOCK-PRICE REACTION magnitude was extracted by NOTHING — so "the stock
// fell 8 percent" (07-26 GE Vernova, actually 6-7%) rode into an A-graded top slot unverified. This
// surfaces an explicit-equity move % in M&M/C&C/AI&T as an advisory FLAG for the morning truth gate.
// The DISCRIMINATOR is an explicit equity SUBJECT ("the stock/shares/share price/the equity") — which
// is exactly why it stays SILENT on a YoY (owned by yoy), an INDEX move ("S&P fell 1.2%"), and a
// NAME-ONLY move ("Micron surged 12%", scoped out at n=1).
const STOCK_SUBJECT_RE = /\b(?:the stock|the shares|its shares|the share price|its share price|the equity|shares)\b/i;
const STOCK_MOVE_VERB_RE = /\b(fell|rose|dropped?|gained?|surged?|slid|slide|jumped?|sank|sunk|plunged?|climbed?|tumbled?|soared?|slipped?|rallied|declined?|shed|lost|popped?|cratered?)\b/i;
const STOCK_YOY_REFERENT_RE = /\b(a year earlier|year[- ]over[- ]year|yoy\b|from (?:a|last) year|versus last year|vs\.? last year|year[- ]ago)\b/i;
function stockMoveReactionFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const line of stripped.split('\n')) {
    const idx = offset; offset += line.length + 1;
    if (!EARN_SECTION_RE.test(sectionOf(stripped, idx))) continue;   // M&M / C&C / AI&T only
    // Scan EACH explicit-equity-subject occurrence and bind the % that sits in the SAME clause
    // (a ~70-char window after the subject). This is why a distant metric % on the same long
    // bullet ("RPO surged 84% … shares held a 9% gain") is not misread as the stock move: the
    // window around "shares" carries the 9%, not the 84%. The explicit subject is also why an
    // index move ("S&P fell 1.2%") and a name-only move ("Micron surged 12%") stay silent.
    const subjRe = new RegExp(STOCK_SUBJECT_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = subjRe.exec(line)) !== null) {
      const win = line.slice(m.index, m.index + 70);
      if (!STOCK_MOVE_VERB_RE.test(win)) continue;                   // a move verb near the subject
      const pctM = win.match(PCT_RE);
      if (!pctM) continue;                                           // a % bound to that clause
      if (STOCK_YOY_REFERENT_RE.test(line.slice(m.index, m.index + 110))) continue; // a YoY — owned by yoy
      const key = `stock-move:${sectionOf(stripped, idx)}:${win.slice(0, 30).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        check: 'stock-move-reaction',
        severity: 'FLAG',
        message: `STOCK-MOVE REACTION — an explicit equity move of ${pctM[0]} in ${sectionOf(stripped, idx)}: "${win.trim().slice(0, 120)}…". The evening pipeline verifies the earnings RESULT and the YoY but NOT a bare stock-price reaction magnitude (07-26 GE Vernova "the stock fell 8 percent" was 6-7%). MORNING GATE: confirm the exact move against the session close and correct an imprecise figure.`,
      });
    }
  }
  return findings;
}

// IMP-115 (carry-forward, deferred #1 from the 07-31 improvement report; ≥3 occurrences → a real
// FLOOR/truth gap, proxy-discipline exempt). THE TAKE shipped a publicly-unverifiable load-bearing
// quantitative claim into v2 on THREE consecutive days, each caught only by the Critic's manual read
// — no mechanical detector fired:
//   07-30: China's "5M bpd discretionary cut, larger than the entire IEA reserve release"
//   07-31: "from 562 trucks to 2,090 … roughly 55% of the world's total"
//   08-01: "against roughly $1.6 billion in all of 2025" — 🔴 the Critic sourced this as WRONG
//          (~$1.6B is the 2026 YTD sum, which EXCEEDS all of 2025; the comparison inverted).
// Why the existing gates miss it: IMP-107's truth-corroboration gate needs a ≥300% change or a
// share-of-national-whole in {issuance, supply, market}; `aggregate` needs a cross-entity connective;
// `yoy` needs a prior-year referent. THREE narrow signatures, TAKE-SCOPED (the documented failure
// class, and the scoping is what keeps the false-positive rate at zero across the archive):
//   (a) SHARE-OF-WORLD    — "N% of the world's / of all / of global <anything>"
//   (b) FULL-PERIOD BASE  — a money/quantity figure vs "in all of <year> / for the full year <year>"
//   (c) BENCHMARK COMPARE — "larger/bigger than the entire <Named benchmark>"
// Advisory FLAG: the brief always ships; the Morning Truth Gate must resolve or soften each line.
// The Take's body sits under its own TITLE sub-heading ("### The Effective-Coverage Collapse"), so
// sectionOf() returns the title, not "THE TAKE" — scope by the REGION between the `▸ THE TAKE`
// heading and the next top-level `▸` heading instead.
function takeRegion(body: string): { start: number; end: number } | null {
  const m = body.match(/^#{1,3}\s*▸?\s*THE TAKE\s*$/mi);
  if (m?.index === undefined) return null;
  const start = m.index + m[0].length;
  const after = body.slice(start);
  const nxt = after.search(/^#\s*▸/m);
  return { start, end: nxt === -1 ? body.length : start + nxt };
}
const TAKE_SHARE_OF_WORLD_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent\b)\s+of\s+(?:the\s+world'?s?|all\b|global\b|the\s+global\b|the\s+entire\b)/i;
const TAKE_FULL_PERIOD_RE = /\b(?:in|for|across|over|against)\s+all\s+of\s+((?:20\d\d)|last year)\b|\bfor\s+the\s+full\s+year\s+(20\d\d)\b/i;
const TAKE_BENCHMARK_CMP_RE = /\b(?:larger|bigger|greater|more)\s+than\s+the\s+(?:entire|whole|combined|total)\s+[A-Za-z]/i;
const TAKE_FIGURE_RE = /[$€£¥]\s?\d[\d,.]*\s*(?:billion|million|trillion|bn\b|mn\b)?|\b\d[\d,.]*\s*(?:billion|million|trillion|barrels?|tonnes?|tons?|units?|trucks?)\b/i;
function takeExtraordinaryFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  const push = (sig: string, idx: number, quote: string, why: string) => {
    const key = `${sig}:${quote.slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      check: 'take-extraordinary-claim',
      severity: 'FLAG',
      message: `TAKE EXTRAORDINARY CLAIM (${sig}) — "${quote.slice(0, 170)}". ${why} The Take is the brief's load-bearing argument; a figure that carries it must be resolvable to a source. MORNING GATE: resolve it against a citable source, SOFTEN it (drop the precision), or CUT it. Receipts: 07-30 China 5M bpd vs the IEA release, 07-31 "562 → 2,090 trucks, 55% of the world's total", 08-01 "roughly $1.6 billion in all of 2025" — which was WRONG (that sum is 2026 YTD and EXCEEDS all of 2025).`,
    });
  };
  const region = takeRegion(stripped);
  if (!region) return findings;
  let offset = 0;
  for (const line of stripped.split('\n')) {
    const idx = offset; offset += line.length + 1;
    if (idx < region.start || idx >= region.end) continue;
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const s = sentence.trim();
      if (!s) continue;
      const shareM = s.match(TAKE_SHARE_OF_WORLD_RE);
      if (shareM) push('share-of-world', idx, s, `A share-of-the-whole superlative (${shareM[0].trim()}) requires a denominator somebody publishes — this is the class IMP-107's corroboration gate misses, because its noun set is issuance/supply/market.`);
      const periodM = s.match(TAKE_FULL_PERIOD_RE);
      if (periodM && TAKE_FIGURE_RE.test(s)) push('full-period-baseline', idx, s, `A full-period aggregate ("${periodM[0].trim()}") used as a comparison BASELINE is the single most error-prone figure in a Take: a YTD sum relabelled as an annual total inverts the comparison it is carrying.`);
      const cmpM = s.match(TAKE_BENCHMARK_CMP_RE);
      if (cmpM) push('benchmark-comparison', idx, s, `A "${cmpM[0].trim()}…" comparison asserts two magnitudes at once — the claim AND the benchmark — and neither is sourced by the sentence.`);
    }
  }
  return findings;
}

// ── IMP-116 (2026-08-02 Critic mandate #1, 🔴, RC5+RC2): HEADLINE ANCHORS ────────────────────
// RECEIPT: the three most-read numerals in the 08-02 brief all failed a from-scratch check and
// NONE of them was extracted. The title said "Ten Ships Through Hormuz" (Kpler's own 31 July
// publication: 5 vessels in the 24h window to 21:00 UTC, and 12 crossings on 28 July against the
// brief's "eleven Tuesday"). The Dashboard opened on the Magnificent Seven at "exactly 0.0%" YTD
// (the tracked series: −3.39% as of 07-29). The payoff told the reader to watch Sunday's crude
// reopen against a "$84.67" WTI settle that could not be retrieved, with Brent at $92.27 Friday
// morning. `fact-gate` extracted 4 market claims and not one of them was any of these, because the
// extraction surface is the ASSET LEXICON: a numeral only becomes a claim if it sits next to a
// known asset name. The title and the watch line are load-bearing by CONSTRUCTION, not by lexicon
// membership — the title is the claim the reader remembers and the watch anchor is the only
// instruction the issue gives. A wrong title cannot be fixed after publish; a wrong watch anchor
// invalidates the instruction.
//
// THE RULE: any numeral in (a) the Daily Title heading or (b) the Intro Summary sentence carrying
// `watch` is a CRITICAL claim unconditionally, resolved under `headline:<slug>` in {date}-truth.json.
// FALSE-POSITIVE SWEEP over the trailing 40 published briefs: 6 title-numeral days and 7
// watch-price days — the extractor is targeted, not a storm, and every hit is a number a reader
// is guaranteed to see ("Nine Ships Through the Needle", "22 Hours and $49 Billion", "4,800 Out,
// 6,000 In"). Watch-line extraction is PRICE-SHAPED ($ amounts, percentages, decimal levels,
// comma-grouped levels) so a bare calendar date ("Watch August 7 to 10") does not ride the
// critical rails — the class that matters is the price the reader will check.
// ENFORCEMENT EPOCH. A new claim class may not retroactively condemn artifacts that shipped before
// it existed: the truth files of published briefs predate `headline:*` and can never carry those
// keys, so re-running `--require-resolved` over the archive would red-fail history for the crime of
// being old. (This was not theory — `verify-improvements.ts` caught exactly that on first run: the
// IMP-045/061/062 archive acceptance gates went RED on 07-13 and 07-17. The gate that audits the
// improvement loop earned its keep.) Enforcement begins with the first brief drafted under the rule.
const HEADLINE_EPOCH = '2026-08-02';
// A heading that is a DATE or a DATE RANGE is never the Daily Title. Two live shapes: the older
// daily format's `## Saturday, June 20, 2026`, and the Weekly's `## July 5-11, 2026`.
const HEADLINE_DATELINE_RE = /^(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*(?:[–—-]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{1,2})?,?\s+20\d\d$/i;
const HEADLINE_WORDNUM_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\b/i;
const HEADLINE_PRICE_RE = /\$\s?\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:%|percent\b)|\b\d[\d,]*\.\d+\b|\b\d{1,3}(?:,\d{3})+\b/g;
// The head region ends at the Dashboard: everything above it is title + payoff intro.
function headlineRegion(body: string): string {
  const d = body.search(/^#\s*▸\s*THE DASHBOARD/m);
  return d === -1 ? body.slice(0, 4000) : body.slice(0, d);
}
// The Daily Title is the first ##/### heading above the Dashboard that is not the date line.
// (Heading level drifted between ## and ### across the archive; both are accepted.)
function dailyTitleMatch(body: string): { raw: string; title: string; idx: number } | null {
  const head = headlineRegion(body);
  for (const m of head.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)) {
    const title = m[1]!.trim();
    if (HEADLINE_DATELINE_RE.test(title)) continue;
    return { raw: m[0], title, idx: m.index! };
  }
  return null;
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function headlineAnchorClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  // DAILY BRIEFS ONLY, and only from the enforcement epoch forward. A week id ("2026-W28") has no
  // Daily Title and no watch line — running the extractor over a Weekly produced junk claims off its
  // "July 5-11, 2026" date-range heading.
  if (!briefDate || !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) || briefDate < HEADLINE_EPOCH) return claims;
  const head = headlineRegion(body);
  const tm = dailyTitleMatch(body);
  if (!tm) return claims;

  // (a) THE DAILY TITLE. Any digit or cardinal word-numeral in the title. A bare 4-digit YEAR is
  // excluded — "The 2026 Problem" names a period, not a measurement, and nothing is resolvable there.
  const titleDigits = (tm.title.match(/\d[\d,.]*/g) || []).filter((n) => !/^20\d\d$/.test(n));
  const titleWords = tm.title.match(new RegExp(HEADLINE_WORDNUM_RE.source, 'gi')) || [];
  for (const n of [...titleDigits, ...titleWords]) {
    claims.push({
      key: `headline:title:${slugify(String(n))}`,
      asset: `DAILY TITLE numeral "${n}"`,
      tier: 'critical',
      claimType: 'headline',
      direction: 'unknown',
      magnitudePct: null,
      level: String(n),
      section: 'Daily Title',
      sentence: tm.title,
      status: 'UNVERIFIED',
    });
  }

  // (b) THE WATCH LINE of the payoff intro. Price-shaped numerals only, and only those inside a
  // 240-char WINDOW after the `watch` token — the ANCHOR, not every number in the paragraph. The
  // window exists because the intro's closing sentence is sometimes a run-on (07-17 carried ten
  // price-shaped numerals in one sentence; only the first, "above 66%", is the threshold the
  // reader is told to check). Capped at 3: a watch instruction with four anchors has no anchor.
  const intro = head.slice(tm.idx + tm.raw.length);
  for (const sentence of intro.split(/(?<=[.!?])\s+/)) {
    const w = sentence.match(/\bwatch\b/i);
    if (!w || w.index === undefined) continue;
    const window = sentence.slice(w.index, w.index + 240);
    for (const n of [...new Set(window.match(HEADLINE_PRICE_RE) || [])].slice(0, 3)) {
      claims.push({
        key: `headline:watch:${slugify(String(n))}`,
        asset: `INTRO WATCH anchor "${String(n).trim()}"`,
        tier: 'critical',
        claimType: 'headline',
        direction: 'unknown',
        magnitudePct: null,
        level: String(n).trim(),
        section: 'Intro Summary (watch line)',
        sentence: sentence.trim().slice(0, 300),
        status: 'UNVERIFIED',
      });
    }
  }
  return claims;
}

// ── IMP-117 (2026-08-02 Critic mandate #3, 🔴, RC2): BYLINE ATTRIBUTION ──────────────────────
// RECEIPT: M&M-4 credited "Bloomberg's Colby Smith reported Friday evening". Colby Smith is the
// NEW YORK TIMES' Federal Reserve correspondent (independently re-verified 2026-08-02: NYT
// announced the hire from the FT in January 2025); Bloomberg's own headline on the same story
// reads "Warsh Considering Reducing Number of Fed Meetings, NYT Reports" — the brief credited the
// aggregator, not the reporting outlet. This is the 07-10 transposition lesson applied to
// attribution: every number in the sentence was right and the SUBJECT was wrong, and nothing in
// the chain checks a pairing that is not asset+number. An outlet-bound reporter name is a
// CHECKABLE PAIRING — one search resolves it — so it rides the critical rails under
// `byline:<outlet>-<person>`. Narrow by construction: the possessive binds a named OUTLET to a
// PERSON, so "Kpler's daily series" (no person), "Bloomberg puts the residual near $10 billion"
// (no possessive) and "Jim Bianco" (no outlet) are all silent. FALSE-POSITIVE SWEEP: 0 hits
// across the trailing 40 published briefs — this fires on the failure and nothing else.
// (The 08-02 mandate named this `bylineAttributionFindings`; it is implemented as a CRITICAL
// CLAIM rather than a Finding so it rides the truth rails and SELF-CLEARS the moment the Morning
// Truth Gate records the correct outlet — the same shape as every other checkable pairing.)
const BYLINE_OUTLET_RE = /\b(Bloomberg|Reuters|the FT|the Financial Times|the Journal|the WSJ|the Times|the New York Times|CNBC|Axios|Politico)(?:['’]s)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g;
function bylineAttributionClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  // Same enforcement epoch as IMP-116: a truth file written before this rule cannot carry a
  // `byline:*` key, so the archive is read, never condemned.
  if (!briefDate || briefDate < HEADLINE_EPOCH) return claims;
  const seen = new Set<string>();
  for (const m of body.matchAll(BYLINE_OUTLET_RE)) {
    const outlet = m[1]!.trim();
    const person = m[2]!.trim();
    const key = `byline:${slugify(`${outlet}-${person}`)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: `BYLINE pairing "${outlet}'s ${person}"`,
      tier: 'critical',
      claimType: 'byline',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section: sectionOf(body, m.index!),
      sentence: sentenceAround(body, m.index!),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ── IMP-120 (2026-08-03 Critic mandate #1, 🔴, RC2): DERIVED ARITHMETIC ──────────────────────
// RECEIPT: C&C-1 — the one bullet in the brief that is nothing but arithmetic — printed "At Friday
// July 31's close of $123.54, under the $135 IPO price, the same money is about seventy percent
// more shares" and "it has fallen about 45 percent". SpaceX closed 2026-07-31 at $108.37 (a new
// closing low, ~52% off the confirmed $225.64 high). `fact-gate` extracted 3 market claims and NONE
// was this price, because the extraction surface is the ASSET LEXICON: a numeral is only checkable
// if it stands next to a name the archive already knows, and SpaceX is not among the 5 archive-known
// assets. This is IMP-116's root cause one class over — that fix widened the surface to titles and
// watch lines; it still did not include A PRICE THE BRIEF PERFORMS ARITHMETIC ON.
//
// TWO LEGS, deliberately different in kind:
//
// (a) `derivedArithmeticClaims` — a currency numeral bound to a POSSESSIVE/TEMPORAL PRICE FRAME
//     ("close of $123.54", "closing high of $211.39", "$135 IPO price") is a CRITICAL claim
//     INDEPENDENT OF ASSET-ARCHIVE MEMBERSHIP. **The arithmetic is the warrant, not the ticker.**
//     Narrow by construction: the frame is a price NOUN bound by `of` (or a price noun trailing the
//     figure), so "settled at $87.93" (Geo-1, correct) and "$3.6 trillion in thirteen months"
//     (M&M-2, correct) are both silent — neither is a quoted price the sentence then computes from.
//
// (b) `derivedPercentageFindings` — the OFFLINE half, and the one that needed no web access at all.
//     Within a SINGLE bullet carrying ≥2 FRAMED prices (leg (a)'s frames, not every currency
//     numeral), a percentage-CHANGE claim that cannot be reconciled with ANY ordered pair of those
//     prices to within 3pp is internally falsifiable: $211.39 → $123.54 is 41.6%, printed as
//     "about 45 percent". The bullet contradicted its own two printed numbers before reality was
//     consulted. ADVISORY (FLAG, never FAIL): the recon is a heuristic, and a derivation whose
//     inputs live in an adjacent bullet would otherwise block a true brief.
//
// ANTI-NOISE — MEASURED, AND THE FIRST DESIGN WAS THROWN AWAY BECAUSE THE MEASUREMENT SAID SO.
// The obvious construction (≥2 BARE prices in the bullet) swept **31 flags across 16 of the
// trailing 40 briefs** — every one a false positive, because a bullet routinely prints two
// unrelated prices and two unrelated percentages ("Brent settled at $78.19, up 5.4 percent, and
// WTI at $73.52, up 4.4 percent"): co-presence is not derivation. The pair set is therefore
// restricted to prices the sentence itself FRAMES as quoted price points — a close, a high, an IPO
// price — which is the only shape where a change percentage is a claim ABOUT those two numbers.
// Re-swept: **1 flag across 40 briefs, and it is C&C-1.** Additionally the change VERB must PRECEDE
// the percentage, so "roughly 3.4 percent dilution" (a ratio, not a price change) and "about
// seventy percent more shares" (which reconciles at 71.1% anyway) stay silent inside the very
// bullet that fails.
const DERIVED_EPOCH = '2026-08-03';
// A price NOUN bound to the figure: "<price-noun> [word] [word] of $X" or "$X <price-noun>".
const DERIVED_PRICE_FRAME_RE = /\b(?:clos(?:e|ed|ing)|settle(?:s|d|ment)?|price|high|low)\b(?:\s+\w+){0,2}\s+of\s+(\$\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)\s+(?:IPO\s+price|offer(?:ing)?\s+price|strike|clos(?:e|ing)\b)/gi;
// A magnitude unit word disqualifies a figure as a PRICE POINT: "$60 billion" is a deal size.
const DERIVED_MAGNITUDE_UNIT_RE = /^\s*(?:billion|trillion|million|thousand|bn\b|tn\b|mn\b|k\b|b\b|m\b)/i;
// A percentage-CHANGE claim: the change verb PRECEDES the figure (within 40 chars). Digits only —
// a word numeral ("seventy percent") is not reliably a computed change and stays off this leg.
const DERIVED_PCT_CHANGE_RE = /\b(?:fallen|fell|falls|risen|rose|rises|dropp?(?:ed|ing)?|declin(?:ed|ing|e)|gained?|lost|losing|slid|slipp?ed|surged|jumped|plunged|climbed|sank|shed|down|up|off)\b[^.]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/gi;

/** Bullets of THE SIX and its neighbours: a markdown list item is the unit of one argument. */
function bulletRegions(body: string): { text: string; idx: number }[] {
  const out: { text: string; idx: number }[] = [];
  for (const m of body.matchAll(/^[-*]\s+\*\*[\s\S]*?(?=\n\s*\n|$)/gm)) {
    out.push({ text: m[0], idx: m.index! });
  }
  return out;
}

/** Every price the text FRAMES as a quoted price point (a close, a high, an IPO price). Shared by
 *  both legs so the claim surface and the reconciliation surface can never drift apart. */
function framedPrices(text: string): { raw: string; value: number; idx: number }[] {
  const out: { raw: string; value: number; idx: number }[] = [];
  const re = new RegExp(DERIVED_PRICE_FRAME_RE.source, 'gi');
  for (const m of text.matchAll(re)) {
    const raw = (m[1] ?? m[2] ?? '').replace(/\s+/g, '');
    if (!raw) continue;
    const after = text.slice(m.index! + m[0].length);
    if (DERIVED_MAGNITUDE_UNIT_RE.test(after)) continue; // "price of $60 billion" is a deal size
    const value = parseFloat(raw.replace(/[$,]/g, ''));
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ raw, value, idx: m.index! });
  }
  return out;
}

function derivedArithmeticClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  // ENFORCEMENT EPOCH, same discipline as IMP-116/117: the truth files of published briefs cannot
  // carry a `derived:*` key, so the archive is read, never condemned.
  if (!briefDate || !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) || briefDate < DERIVED_EPOCH) return claims;
  const seen = new Set<string>();
  for (const p of framedPrices(body)) {
    const key = `derived:price:${slugify(p.raw)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: `COMPUTED-FROM price "${p.raw}"`,
      tier: 'critical',
      claimType: 'derived-price',
      direction: 'unknown',
      magnitudePct: null,
      level: p.raw,
      section: sectionOf(body, p.idx),
      sentence: sentenceAround(body, p.idx),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

/** Pure function — the arithmetic assertion, testable without a disk. */
function derivedPercentageInconsistencies(bullet: string, tolerancePp = 3): { pct: number; best: number | null; prices: number[] }[] {
  const prices = [...new Set(framedPrices(bullet).map((p) => p.value))];
  if (prices.length < 2) return [];
  const candidates: number[] = [];
  for (const a of prices) for (const b of prices) {
    if (a === b) continue;
    candidates.push(Math.abs((b - a) / a) * 100);
  }
  const out: { pct: number; best: number | null; prices: number[] }[] = [];
  for (const m of bullet.matchAll(DERIVED_PCT_CHANGE_RE)) {
    const pct = parseFloat(m[1]!);
    if (!Number.isFinite(pct)) continue;
    let best: number | null = null;
    for (const c of candidates) if (best === null || Math.abs(c - pct) < Math.abs(best - pct)) best = c;
    if (best !== null && Math.abs(best - pct) > tolerancePp) out.push({ pct, best, prices });
  }
  return out;
}

function derivedPercentageFindings(body: string, _briefDate: string | null): Finding[] {
  const findings: Finding[] = [];
  for (const b of bulletRegions(body)) {
    for (const bad of derivedPercentageInconsistencies(b.text)) {
      findings.push({
        check: 'derived-percentage-inconsistent',
        severity: 'FLAG',
        message: `derived-percentage-inconsistent — the bullet claims a ${bad.pct}% change, but no ordered pair of the prices it prints (${bad.prices.map((p) => `$${p}`).join(', ')}) produces it; the nearest is ${bad.best!.toFixed(1)}%, off by ${Math.abs(bad.best! - bad.pct).toFixed(1)}pp. A bullet whose analytical claim IS a computation must recompute from a verified input, not renumber. Section: ${sectionOf(body, b.idx)}. "${b.text.replace(/\s+/g, ' ').slice(0, 180)}"`,
      });
    }
  }
  return findings;
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
// ENTITY-ATTRIBUTION (added 2026-07-11 — IMP-032). THE TRANSPOSITION CLASS.
//
// Two consecutive days, one shape: the number was RIGHT and the named entity was
// WRONG. 07-10: the 10-year JGB's "highest since Sept 1996" record was written as
// the 30-year (and the Critic called it the best M&M bullet). 07-11: "BlackRock's
// BCRED" — BCRED is BLACKSTONE's fund — inside a depth bullet on private-credit
// gating. Every existing check is number-shaped, so both walked through: the digits
// were correct. This check binds a distinguishing KEY (fund ticker, reactor
// designation, a record) to the entity that actually owns it, and FAILs when the key
// appears in a sentence next to a known-confusable entity WITHOUT its true owner.
//
// Registry: system/entity-bindings.json. The compounding rule (Morning_Updater,
// Brief_Editor): every entity error the truth chain corrects gets appended there in
// the same session, so a caught error becomes a permanent guard.
// ---------------------------------------------------------------------------
interface Binding {
  id: string; key: string; scope: string | null;
  correctRe: string; correct: string; wrongRe: string; note?: string;
}

// REGISTRY INTEGRITY (IMP-064, 2026-07-17). The load path below used to be:
//   try { return JSON.parse(...).bindings ?? []; } catch { return []; }
// — a malformed or missing registry returned ZERO ROWS and the gate carried on and
// printed "✅ FACT-GATE PASS". PROVEN 2026-07-17 on the real 07-17 v2: with the registry
// intact the gate FAILs on both the TSMC "strongest quarter in semiconductor history"
// misattribution and the "Brazil holds the rotating BRICS presidency" office-holder
// error; with ONE stray character in entity-bindings.json those two falsehoods produce
// "✅ FACT-GATE PASS", exit 0. The premise layer is the ONLY thing in the chain that
// reads SUBJECTS rather than digits — the 07-17 post-mortem: "three of the four
// falsehoods were premises, not figures" — and it could be switched off by a typo,
// silently, failing OPEN toward publish.
//
// Same shape as the Geo-Lead Theater Log found dead 20 days on 07-17 while the QG's
// ENTITY-PERSISTENCE CAP gate read it: NOTHING CHECKS THE CHECKER. A gate that cannot
// prove it loaded its own ammunition is decorative, and a decorative truth gate is
// worse than none — it produces a green check that the whole chain trusts.
//
// The load now reports HEALTH, and a registry that cannot be read is itself a FAIL.
type RegistryHealth = {
  name: string; path: string | null;
  state: 'ok' | 'missing' | 'malformed' | 'empty';
  rows: number; badRows: string[]; detail?: string;
};

/** Pure read of ONE registry file → rows + health. Exported shape so the selftest can
 *  exercise it against a scratch file directly rather than fighting cwd resolution. */
function readRegistryFile<T>(
  name: string, p: string | null, key: string,
): { rows: T[]; health: RegistryHealth } {
  if (!p || !fs.existsSync(p)) {
    return { rows: [], health: { name, path: null, state: 'missing', rows: 0, badRows: [] } };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return {
      rows: [], health: {
        name, path: p, state: 'malformed', rows: 0, badRows: [],
        detail: (e as Error).message.split('\n')[0],
      },
    };
  }
  const rows = (parsed?.[key] ?? []) as T[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: [], health: { name, path: p, state: 'empty', rows: 0, badRows: [] } };
  }
  return { rows, health: { name, path: p, state: 'ok', rows: rows.length, badRows: [] } };
}

function loadRegistry<T>(
  name: string, file: string, key: string, briefPath: string,
): { rows: T[]; health: RegistryHealth } {
  const candidates = [
    path.join(process.cwd(), 'system', file),
    path.join(path.dirname(briefPath), '..', '..', 'system', file),
  ];
  const found = candidates.find((p) => fs.existsSync(p)) ?? null;
  return readRegistryFile<T>(name, found, key);
}

/** A registry that cannot be read is a FAIL, not an empty list. Fails LOUD, never open. */
function registryFindings(healths: RegistryHealth[]): Finding[] {
  const out: Finding[] = [];
  for (const h of healths) {
    if (h.state === 'ok' && h.badRows.length === 0) continue;
    const why =
      h.state === 'missing' ? `not found (looked in system/)`
      : h.state === 'malformed' ? `failed to parse: ${h.detail ?? 'invalid JSON'}`
      : h.state === 'empty' ? `parsed but contains ZERO rows`
      : `has ${h.badRows.length} unusable row(s): ${h.badRows.join(', ')}`;
    out.push({
      check: 'registry-integrity',
      severity: 'FAIL',
      message: `PREMISE REGISTRY BLIND — ${h.name} ${why}. This registry is the only layer that checks the SUBJECT of a claim rather than its digits (entity misattribution, stale office-holders). While it is unreadable those checks silently do not run and this gate will report PASS on premises nobody verified. 2026-07-17 receipt: one stray character in entity-bindings.json turned two live falsehoods (TSMC "strongest quarter in semiconductor history"; "Brazil holds the rotating BRICS presidency") into "✅ FACT-GATE PASS", exit 0. Repair the file — do NOT bypass this to publish.`,
    });
  }
  return out;
}

function loadBindings(briefPath: string): Binding[] {
  return loadRegistry<Binding>('entity-bindings.json', 'entity-bindings.json', 'bindings', briefPath).rows;
}

/**
 * SCHEMA VALIDATION — IMP-136 (2026-08-07, RC7). A row is executable only if its three
 * pattern fields are non-empty strings. Returns the missing/blank field names.
 *
 * Why this exists, with the receipt: on 2026-08-07 at 05:26 the Morning Updater appended
 * `aisi-cyber-incident-2026-07` in a PROSE shape it invented on the spot — `entity`,
 * `wrong: ["Meta", "three frontier labs"]`, `source` — instead of the executable shape
 * (`key`, `scope`, `correctRe`, `wrongRe`). `b.key` was therefore `undefined`, and
 * `new RegExp(undefined, 'gi')` does not throw: it compiles to `/(?:)/gi`, the EMPTY
 * pattern. The `try/catch` below only ever guarded against a regex that THROWS. An empty
 * pattern matches zero-width at every position, `exec` sets `lastIndex` to the end of the
 * match, the end equals the start, `lastIndex` never advances — and the `while` loop below
 * spins forever. Measured, not inferred: `fact-gate` on the real published
 * `content/daily-updates/2026-08-07.md` ran 150s of pure CPU and printed nothing.
 *
 * The blast radius is the reason this is Critical rather than tidy. `fact-gate --selftest`
 * is the `run:` leg of ELEVEN ledger rows, so `verify-improvements.ts` — the system's only
 * mechanical proof that any improvement is real — could no longer terminate, and the
 * evening `brief-draft` would have hung on its own truth gate. One malformed data row took
 * out the truth layer and the accountability layer at once, and it was written by the same
 * session that reported its fact-gate run green one minute later.
 *
 * So: a row that cannot enforce is a LOUD registry-integrity FAIL, exactly like a row whose
 * regex throws. Never silent, and — see the zero-width guard in the loop — never a hang.
 */
function bindingSchemaErrors(b: Binding): string[] {
  const missing: string[] = [];
  for (const f of ['key', 'correctRe', 'wrongRe'] as const) {
    const v = (b as unknown as Record<string, unknown>)[f];
    if (typeof v !== 'string' || v.trim() === '') missing.push(f);
  }
  return missing;
}

function entityAttribution(body: string, bindings: Binding[], health?: RegistryHealth): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const b of bindings) {
    // IMP-136: schema BEFORE compilation. `new RegExp(undefined)` is legal and empty,
    // so the try/catch below can never catch this class — it has to be rejected by shape.
    const schemaErrs = bindingSchemaErrors(b);
    if (schemaErrs.length) {
      if (health) health.badRows.push(`${b.id ?? '(unnamed row)'} [missing/blank: ${schemaErrs.join(', ')}]`);
      continue;
    }
    let keyRe: RegExp, wrongRe: RegExp, correctRe: RegExp, scopeRe: RegExp | null;
    try {
      keyRe = new RegExp(b.key, 'gi');
      wrongRe = new RegExp(b.wrongRe, 'i');
      correctRe = new RegExp(b.correctRe, 'i');
      scopeRe = b.scope ? new RegExp(b.scope, 'i') : null;
    } catch {
      // A malformed row must never CRASH the truth gate — but it must never be SILENT
      // either (IMP-064). Before this, a bad regex here removed one guard from the
      // registry with no output at all: the row existed, looked maintained, and
      // enforced nothing. Report it; the caller turns it into a registry-integrity FAIL.
      if (health) health.badRows.push(b.id ?? '(unnamed row)');
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = keyRe.exec(body)) !== null) {
      // IMP-136 ZERO-WIDTH GUARD — belt-and-braces behind the schema check above. Any
      // key that can match empty (`a*`, `x|`, `(?:)`) parks lastIndex and spins forever.
      // The schema check stops the known cause; this stops the CLASS, so no future
      // registry edit can hang the truth gate no matter what pattern it carries.
      if (m.index === keyRe.lastIndex) keyRe.lastIndex++;
      const sentence = sentenceAround(body, m.index);
      if (scopeRe && !scopeRe.test(sentence)) continue;   // binding doesn't apply here
      if (!wrongRe.test(sentence)) continue;              // no confusable entity present
      if (correctRe.test(sentence)) continue;             // true owner is named -> fine
      const wrong = sentence.match(wrongRe)?.[0] ?? 'a confusable entity';
      const dedupe = `${b.id}:${wrong}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      findings.push({
        check: 'entity-attribution',
        severity: 'FAIL',
        message: `ENTITY MISATTRIBUTION — "${m[0]}" belongs to ${b.correct}, but this sentence attributes it to "${wrong}" and never names ${b.correct}. Section: ${sectionOf(body, m.index)}.${loadBearingNote(sectionOf(body, m.index))} ${b.note ?? ''} Sentence: "${sentence.slice(0, 180)}" — verify against a primary source and correct the ENTITY; the number being right does not make the claim true.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// TRUTH-HARMONIZATION GUARD (added 2026-07-11 — IMP-033). E-QG-TRUTH-HARMONIZATION-01.
//
// The worst receipt of the 07-11 cycle: the Writer got SK Hynix RIGHT ($26.5B) and the
// Quality Gate rewrote it to the WRONG published figure ($28B) to remove a cross-day
// contradiction with the 07-10 brief — a gate that MANUFACTURED a falsehood out of a
// true sentence. A published number is a CLAIM, not a citation. When today's draft
// contradicts our own archive, the only legal resolutions are: verify against a primary
// source, or cut/restate the contested figure — never "align to what we already printed."
//
// Reads the QG log (it is the artifact where the harmonization decision is recorded) and
// FAILs when a harmonization to the published record carries no primary-source evidence.
// ---------------------------------------------------------------------------
const HARMONIZE_RE = /harmoni[sz]\w*|align(?:ed|ing)?\s+(?:to|with)\s+the\s+published|defer(?:red|ring)?\s+to\s+the\s+published|match(?:ed|ing)?\s+the\s+published/i;
const PUBLISHED_REF_RE = /published\s+(?:record|brief|figure|number)|the\s+published\s+\d{2}-\d{2}|prior\s+brief|yesterday'?s?\s+brief|our\s+archive/i;
const PRIMARY_SOURCE_RE = /https?:\/\/|primary source|verified against|per (?:Reuters|Bloomberg|the FT|the WSJ|CNBC|AP|Al Jazeera)|company filing|press release|8-K|prospectus/i;
// IMP-EDITOR-2026-08-02: NEGATION GUARD. The gate reads the QG log for a CONFESSION of
// harmonizing. A QG that OBEYS the rule must disclose the contradiction it declined to
// resolve by preference — and that disclosure necessarily contains the words "harmonize"
// and "the published brief". Without this guard the gate FAILs the compliant QG for
// pasting the receipt the rule demands, which is the same class as the 2026-08-01
// provenance-gate CHECK A finding (a zero-absence record read as four absence assertions).
// Two gates, one night, one shape: a negated declaration read as an admission.
// Scoped tightly — only an EXPLICIT negation of the harmonizing verb clears the line.
const HARMONIZE_NEGATED_RE = /\b(?:did|do|does|would|will|could)\s+(?:\*{0,2}not\*{0,2}|n[o']t)\s+\w{0,12}\s?harmoni[sz]|\bnot\s+harmoni[sz]|\brefused\s+to\s+harmoni[sz]|\bdeclined\s+to\s+harmoni[sz]|\bwithout\s+harmoni[sz]|\bnever\s+harmoni[sz]|\bharmoni[sz]\w*\s*[:=]\s*\**\s*(?:none|no|n\/a|nil)\b|\bno\s+sentence\s+was\s+moved\s+toward\s+the\s+published\s+record/i;

function carriesUnresolvedHarmonization(line: string): boolean {
  // Negation belongs to its clause, not the whole line. A compliant
  // "harmonization: none" cannot launder a later confession after "but" or ";".
  const clauses = line.split(/\s*(?:;|\bbut\b|\bhowever\b)\s*/i).filter(Boolean);
  return clauses.some(clause =>
    HARMONIZE_RE.test(clause)
    && PUBLISHED_REF_RE.test(clause)
    && !PRIMARY_SOURCE_RE.test(clause)
    && !HARMONIZE_NEGATED_RE.test(clause),
  );
}

function findQgLog(briefPath: string, briefDate: string | null): string | null {
  if (!briefDate) return null;
  const name = `${briefDate}-quality-gate-log.md`;
  for (const p of [
    path.join(path.dirname(briefPath), name),
    path.join(path.dirname(briefPath), '..', 'daily-briefs', name),
    path.join(process.cwd(), 'daily-briefs', name),
  ]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return null;
}

/**
 * THE CURE IS THE CORRECTION ROW. A harmonization-to-published is an OPEN DEBT, not a
 * permanent stain: it FAILs until the session resolves it against a primary source and
 * logs the archive fix in system/Corrections_Ledger.md (a row `found` on this brief's
 * date). Then it downgrades to an advisory FLAG — the historical record of what the QG
 * did, with the receipt of how it was closed. Without this escape the gate would block
 * every re-run of a day it already fixed, which teaches sessions to route around it.
 */
function correctionsLoggedOn(briefDate: string | null): string[] {
  if (!briefDate) return [];
  const p = path.join(process.cwd(), 'system', 'Corrections_Ledger.md');
  if (!fs.existsSync(p)) return [];
  const ids: string[] = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const c = line.trim().split('|').map((s) => s.trim());
    if (c.length < 8 || !/^COR-\d+/.test(c[1] ?? '')) continue;
    if (c[2] === briefDate) ids.push(c[1]!);
  }
  return ids;
}

function truthHarmonization(qg: string | null, briefDate: string | null = null): Finding[] {
  if (!qg) return [];
  const resolved = correctionsLoggedOn(briefDate);
  const findings: Finding[] = [];
  for (const raw of qg.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 40) continue;
    if (!carriesUnresolvedHarmonization(line)) continue;
    findings.push(resolved.length > 0 ? {
      check: 'truth-harmonization',
      severity: 'FLAG',
      message: `QG harmonized to the published record — RESOLVED this session (${resolved.join(', ')} in system/Corrections_Ledger.md; the archive was corrected, not the truth). Kept as an advisory record of the decision. QG line: "${line.slice(0, 140)}"`,
    } : {
      check: 'truth-harmonization',
      severity: 'FAIL',
      message: `QG HARMONIZED TO THE PUBLISHED RECORD — a published number is a CLAIM, not a citation. 07-11 receipt: the draft had SK Hynix's raise RIGHT ($26.5B) and the QG rewrote it to the published (false) $28B to remove a cross-day contradiction, manufacturing a falsehood from a true sentence. Resolve the contradiction against a PRIMARY SOURCE, or cut/restate the contested figure — then correct the published brief and log it in system/Corrections_Ledger.md (that row is what clears this gate). QG line: "${line.slice(0, 220)}"`,
    });
  }
  return findings;
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

function selftest(): number {
  const root = process.cwd();
  const jul10 = path.join(root, 'content/daily-updates/2026-07-10.md');
  const jul09 = path.join(root, 'content/daily-updates/2026-07-09.md');
  const jul07 = path.join(root, 'content/daily-updates/2026-07-07.md');
  for (const p of [jul10, jul09, jul07]) {
    if (!fs.existsSync(p)) {
      console.error(`SELFTEST FAIL — missing fixture: ${p}`);
      return 1;
    }
  }

  const jul10Body = fs.readFileSync(jul10, 'utf8');
  const jul09Body = fs.readFileSync(jul09, 'utf8');
  const jul07Body = fs.readFileSync(jul07, 'utf8');

  const fire = dramaticEventReuse(jul10Body, jul10, '2026-07-10');
  const silentDated = dramaticEventReuse(jul09Body, jul09, '2026-07-09');
  const silentFirst = dramaticEventReuse(jul07Body, jul07, '2026-07-07');

  const fpFire = storyFingerprintReuse(jul10Body, jul10, '2026-07-10');
  const fpSilentDated = storyFingerprintReuse(jul09Body, jul09, '2026-07-09');
  const fpSilentFirst = storyFingerprintReuse(jul07Body, jul07, '2026-07-07');

  // Percent-word magnitude: "4.91 percent" must parse (the 07-10 hole).
  const magWord = detectDirection(' triggered a circuit breaker and closed down 4.91 percent after');
  const magSym = detectDirection(' futures down 2.6% into the close');

  const okFire = fire.some((f) => f.check === 'dramatic-event-reuse' && f.severity === 'FAIL');
  const okSilentDated = silentDated.length === 0;
  const okSilentFirst = silentFirst.length === 0;
  const okFpFire = fpFire.some((f) => f.check === 'story-fingerprint-reuse' && f.severity === 'FAIL');
  const okFpNikkei = fpFire.some((f) => /Nikkei/i.test(f.message));
  const okFpSilentDated = fpSilentDated.length === 0;
  const okFpSilentFirst = fpSilentFirst.length === 0;
  const okMagWord = magWord.mag === 4.91 && magWord.dir === 'down';
  const okMagSym = magSym.mag === 2.6 && magSym.dir === 'down';

  // --- IMP-032: entity attribution. REAL artifacts, both directions.
  // FIRE  = the 07-11 pre-morning draft ("BlackRock's BCRED" — survived Writer, QG and Editor).
  // SILENT= the 07-11 PUBLISHED brief (Morning Truth Gate corrected it to "Blackstone's BCRED").
  const draft11Path = path.join(root, 'daily-briefs/2026-07-11-v1.5.md');
  const pub11Path = path.join(root, 'content/daily-updates/2026-07-11.md');
  const bindings = loadBindings(pub11Path);
  const okBindingsLoad = bindings.length > 0;
  const eaFire = fs.existsSync(draft11Path)
    ? entityAttribution(stripComments(fs.readFileSync(draft11Path, 'utf8')), bindings) : [];
  const eaSilent = fs.existsSync(pub11Path)
    ? entityAttribution(stripComments(fs.readFileSync(pub11Path, 'utf8')), bindings) : [];
  const okEaFire = eaFire.some((f) => f.check === 'entity-attribution' && /BCRED/i.test(f.message) && f.severity === 'FAIL');
  const okEaSilent = eaSilent.length === 0;
  // Synthetic twin of the 07-10 JGB transposition (right number, wrong tenor) + its corrected form.
  const jgbFire = entityAttribution("Japan's long-end JGB yields hit a wall: the 30-year touched 2.88 percent, the highest since September 1996, as the YCC framework strained.", bindings);
  const jgbSilent = entityAttribution("Japan's 10-year JGB touched 2.88 percent, the highest since September 1996, while the 30-year held near 4.03 percent.", bindings);
  const okJgbFire = jgbFire.some((f) => f.check === 'entity-attribution');
  const okJgbSilent = jgbSilent.length === 0;

  // --- IMP-064: REGISTRY INTEGRITY. The premise layer must prove it loaded.
  // Receipt (2026-07-17): one stray character in entity-bindings.json turned the real
  // 07-17 v2's TSMC "semiconductor history" misattribution AND the "Brazil holds the
  // rotating BRICS presidency" office-holder error into "✅ FACT-GATE PASS", exit 0.
  // Both directions, on a scratch registry so the real one is never touched.
  const regTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-reg-'));
  const regFile = path.join(regTmp, 'entity-bindings.json');
  // readRegistryFile is the pure leg loadRegistry delegates to — testing it directly
  // means the scratch file is genuinely read, instead of cwd silently resolving the
  // REAL registry and the assertion passing for the wrong reason (caught on first run).
  const healthOf = (s: string) => {
    fs.writeFileSync(regFile, s);
    return readRegistryFile<Binding>('entity-bindings.json', regFile, 'bindings').health;
  };
  // SILENT on a healthy registry.
  const okRegOk = (() => {
    const h = healthOf(JSON.stringify({ bindings: [{ id: 'x', key: 'K', scope: null, correctRe: 'A', correct: 'A', wrongRe: 'B' }] }));
    return h.state === 'ok' && h.rows === 1 && registryFindings([h]).length === 0;
  })();
  // FIRES on malformed / empty / missing — the three ways the layer goes blind.
  const okRegMalformed = (() => {
    const h = healthOf('{ "bindings": [ BROKEN ] }');
    return h.state === 'malformed' && registryFindings([h]).some((f) => f.check === 'registry-integrity' && f.severity === 'FAIL');
  })();
  const okRegEmpty = (() => {
    const h = healthOf(JSON.stringify({ bindings: [] }));
    return h.state === 'empty' && registryFindings([h]).some((f) => f.check === 'registry-integrity');
  })();
  const okRegMissing = (() => {
    fs.rmSync(regFile, { force: true });
    const h = readRegistryFile<Binding>('entity-bindings.json', regFile, 'bindings').health;
    return h.state === 'missing' && registryFindings([h]).some((f) => f.check === 'registry-integrity');
  })();
  // The REAL registries on disk must be healthy — this is the check running in anger.
  const okRegRealHealthy = (() => {
    const b = loadRegistry<Binding>('entity-bindings.json', 'entity-bindings.json', 'bindings', pub11Path);
    const c = loadRegistry<any>('current-facts.json', 'current-facts.json', 'facts', pub11Path);
    return registryFindings([b.health, c.health]).length === 0;
  })();
  // A row with an unusable regex is reported, never silently skipped.
  const okRegBadRow = (() => {
    const bad: Binding[] = [{ id: 'bad-row', key: '([unclosed', scope: null, correctRe: 'A', correct: 'A', wrongRe: 'B' }];
    const h: RegistryHealth = { name: 'entity-bindings.json', path: null, state: 'ok', rows: 1, badRows: [] };
    entityAttribution('some body text', bad, h);
    return h.badRows.includes('bad-row') && registryFindings([h]).some((f) => f.check === 'registry-integrity');
  })();
  fs.rmSync(regTmp, { recursive: true, force: true });

  // --- IMP-136 (2026-08-07, RC7): A ROW THAT CANNOT ENFORCE IS LOUD, AND NEVER HANGS.
  // The 05:26 Morning Updater appended a binding in a prose shape with no `key` at all.
  // `new RegExp(undefined)` does not throw — it compiles to /(?:)/gi — so okRegBadRow's
  // try/catch above could not see it, and the exec loop spun on a zero-width match. Proven
  // cost: fact-gate on the real published 2026-08-07.md burned 150s of CPU and printed
  // nothing, which also stalled the 11 ledger rows that use `--selftest` as their run leg.
  // Both directions: the malformed shape is REPORTED, and a zero-width-capable key TERMINATES.
  const okSchemaMissingKey = (() => {
    // Byte-for-byte the shape the Morning Updater actually wrote (id/entity/correct/wrong[]/note).
    const prose = { id: 'aisi-shaped-row', entity: 'X', correct: 'Y', wrong: ['Meta'], note: 'n' };
    const h: RegistryHealth = { name: 'entity-bindings.json', path: null, state: 'ok', rows: 1, badRows: [] };
    entityAttribution('some body text about Meta', [prose as unknown as Binding], h);
    return h.badRows.some((r) => /aisi-shaped-row/.test(r) && /key/.test(r))
      && registryFindings([h]).some((f) => f.check === 'registry-integrity' && f.severity === 'FAIL');
  })();
  const okSchemaBlankRe = (() => {
    const blank: Binding[] = [{ id: 'blank-re', key: 'Meta', scope: null, correctRe: '', correct: 'Y', wrongRe: '  ' }];
    const h: RegistryHealth = { name: 'entity-bindings.json', path: null, state: 'ok', rows: 1, badRows: [] };
    entityAttribution('some body text about Meta', blank, h);
    return h.badRows.some((r) => /blank-re/.test(r) && /correctRe/.test(r) && /wrongRe/.test(r));
  })();
  // The zero-width GUARD, tested directly: a key that legally matches empty must not park
  // lastIndex. Bounded body, so a regressed guard shows up as a selftest that never returns
  // — which is the honest signal, since that is exactly the production symptom.
  const okZeroWidthTerminates = (() => {
    const zw: Binding[] = [{ id: 'zero-width', key: 'q*', scope: null, correctRe: 'Nvidia', correct: 'Nvidia', wrongRe: 'TSMC' }];
    const h: RegistryHealth = { name: 'entity-bindings.json', path: null, state: 'ok', rows: 1, badRows: [] };
    entityAttribution('TSMC shipped a record quarter.', zw, h);
    return h.badRows.length === 0; // schema-valid, and it RETURNED
  })();
  // The REPAIRED real binding does the job it was written for: fires on the false 08-07
  // sentence, silent on the corrected one. A row that only parses is not a row that works.
  const realBindings = loadRegistry<Binding>('entity-bindings.json', 'entity-bindings.json', 'bindings', pub11Path).rows;
  const okAisiFire = entityAttribution(
    '## AI & Tech\n\nThree frontier labs have now disclosed models attacking real internet targets during AISI safety evaluations, and Anthropic, OpenAI and Meta are the three.',
    realBindings,
  ).some((f) => f.check === 'entity-attribution' && /Meta|three/i.test(f.message));
  const okAisiSilent = entityAttribution(
    '## AI & Tech\n\nAISI reported 19 unsanctioned actions across one cyber challenge; 17 came from a single model, Anthropic\'s Mythos 5, with 2 from OpenAI\'s GPT-5.6-Sol.',
    realBindings,
  ).length === 0;

  // --- IMP-033: truth-harmonization guard. REAL QG logs, both directions.
  const qg11 = fs.existsSync(path.join(root, 'daily-briefs/2026-07-11-quality-gate-log.md'))
    ? fs.readFileSync(path.join(root, 'daily-briefs/2026-07-11-quality-gate-log.md'), 'utf8') : null;
  const qg10 = fs.existsSync(path.join(root, 'daily-briefs/2026-07-10-quality-gate-log.md'))
    ? fs.readFileSync(path.join(root, 'daily-briefs/2026-07-10-quality-gate-log.md'), 'utf8') : null;
  // briefDate=null => no correction row in scope => the OPEN-DEBT state the gate must block.
  const thFire = truthHarmonization(qg11, null);
  const thSilent = truthHarmonization(qg10, null);
  const okThFire = thFire.some((f) => f.check === 'truth-harmonization' && f.severity === 'FAIL');
  const okThSilent = thSilent.length === 0;
  // A harmonization RESOLVED against a primary source is legal -> must stay silent.
  const okThSourced = truthHarmonization(
    'QG harmonized the SK Hynix figure to the published record after verifying against https://reuters.com/... — $26.5B confirmed.', null
  ).length === 0;
  const okThNominal = truthHarmonization(
    'Truth harmonization: none. No sentence was moved toward the published record; the discrepancy remains routed for primary verification.', null
  ).length === 0;
  const okThMixed = truthHarmonization(
    'Truth harmonization: none against the published record; but the QG later harmonized the disputed figure to the published brief without a source.', null
  ).some(f => f.check === 'truth-harmonization' && f.severity === 'FAIL');
  // THE CURE: once the archive correction is logged for that date (COR-001/002 on 2026-07-11),
  // the FAIL downgrades to an advisory FLAG — otherwise the gate blocks every re-run of a day
  // it already fixed, and sessions learn to route around it.
  const thResolved = truthHarmonization(qg11, '2026-07-11');
  const okThResolved = thResolved.length > 0 && thResolved.every((f) => f.severity === 'FLAG');

  // --- IMP-044: scheduled-event date. Both directions, on the two REAL 07-13 artifacts. ---
  const jul13Draft = path.join(root, 'daily-briefs/2026-07-13-v2.md');       // the falsehood as drafted
  const jul13Pub = path.join(root, 'content/daily-updates/2026-07-13.md');   // the morning's rebuild
  const cal = loadEventCalendar(jul13Pub);
  const okCalLoad = cal.some((c) => c.id === 'cpi' && c.releaseDate === '2026-07-14');
  let okEvFire = false, okEvSilent = false, evFireN = 0, evSilentFindings: Finding[] = [];
  if (fs.existsSync(jul13Draft) && fs.existsSync(jul13Pub)) {
    // FIRES on the real evening draft: "CPI and the first post-Hormuz tape land in the same session."
    const evFire = scheduledEventClaims(fs.readFileSync(jul13Draft, 'utf8'), cal, '2026-07-13');
    evFireN = evFire.findings.length;
    okEvFire =
      evFire.findings.some((f) => f.check === 'scheduled-event-date' && f.severity === 'FAIL') &&
      // and it must ALSO ride the critical rails, so a calendar-less event still blocks at publish
      evFire.claims.some((c) => c.key === 'event:cpi' && c.tier === 'critical');
    // SILENT on the published rebuild: "it lands tomorrow morning" + "June CPI lands Tuesday at 8:30".
    const evSilent = scheduledEventClaims(fs.readFileSync(jul13Pub, 'utf8'), cal, '2026-07-13');
    evSilentFindings = evSilent.findings;
    okEvSilent =
      evSilent.findings.length === 0 &&
      evSilent.claims.some((c) => c.key === 'event:cpi' && c.tier === 'standard');
  }
  // A same-session assertion with NO calendar entry must still become a CRITICAL claim —
  // this is the leg that makes coverage independent of the calendar's completeness.
  const evNoCal = scheduledEventClaims('The FOMC decision lands today, and the tape has not priced it.', [], '2026-07-13');
  const okEvNoCal = evNoCal.findings.length === 0 && evNoCal.claims.some((c) => c.key === 'event:fomc' && c.tier === 'critical' && c.status === 'UNVERIFIED');
  // A weekday that contradicts the calendar is a falsehood even without "today"/"tomorrow".
  const evWrongDay = scheduledEventClaims('June CPI lands Monday at 8:30 and the market is not ready.', cal, '2026-07-13');
  const okEvWrongDay = evWrongDay.findings.some((f) => f.check === 'scheduled-event-date' && f.severity === 'FAIL');

  // --- IMP-045: the gate's own transposition + the term-of-art false positive. ---
  let okWtiAttrib = false, okToa = false, wtiGot: number | undefined;
  if (fs.existsSync(jul13Pub)) {
    const pubBody = fs.readFileSync(jul13Pub, 'utf8');
    // "The oil market … Brent is bid about 4% to $79" must NOT assign 79 to WTI; the brief's
    // real WTI print is $74.41 ("WTI bid to roughly $74.41 and Brent to $79.14").
    const prices = assetValuesIn(pubBody);
    wtiGot = prices.wti;
    // Brent legitimately resolves from the intro ("Brent is bid about 4% to $79"); WTI must
    // resolve from its OWN print ($74.41), never from Brent's number sitting after "oil market".
    okWtiAttrib = prices.wti === 74.41 && prices.brent >= 79 && prices.brent <= 79.2;
    // "the highest-and-best use of that land" is a real-estate term of art, not a superlative.
    okToa = !extractSuperlatives(pubBody).some((s) => /highest[-\s]and[-\s]best/i.test(s.sentence) && /^highest$/i.test(s.superlative ?? ''));
  }
  // The suppression must be surgical: a REAL superlative in the same shape still extracts.
  const okToaNarrow = extractSuperlatives('The 10-year JGB printed its highest yield since Sept 1996 at 2.900%.').length > 0;

  // --- IMP-056: aggregate-claim gate. Both directions on REAL artifacts. ---
  // FIRE: the 07-15 C&C-1 lede ("Combined Q2 net income across … cleared roughly $49 billion,
  // up 39% YoY") becomes a CRITICAL claim on the unresolved-before-publish rails.
  const jul15Pub = path.join(root, 'content/daily-updates/2026-07-15.md');
  let okAggFire = false, okAggResolves = false, aggKey = '';
  if (fs.existsSync(jul15Pub)) {
    const agg15 = aggregateClaims(fs.readFileSync(jul15Pub, 'utf8'), '2026-07-15');
    const c = agg15.find((x) => /^aggregate:/.test(x.key));
    aggKey = c?.key ?? '';
    okAggFire = !!c && c.tier === 'critical' && c.status === 'UNVERIFIED' && /49/.test(c.key) && c.magnitudePct === 39;
    // RESOLVES: once the Morning Truth Gate records the aggregate under its key (independent
    // source), the same claim flips to PASS and the gate goes silent.
    const fakeTruth: any = { claims: { [aggKey]: { value: '5 big banks $49B combined, +39% YoY', source: 'https://finance.yahoo.com/…5-big-banks-earned-49…' } } };
    for (const a of agg15) if (fakeTruth.claims[a.key]) a.status = 'PASS';
    okAggResolves = !!aggKey && agg15.filter((x) => /^aggregate:/.test(x.key)).every((x) => x.status === 'PASS');
  }
  // SILENT: a single-entity figure is not a sum across constituents.
  const okAggSingle = aggregateClaims('JPMorgan posted net income of $21.2 billion, up 41% year over year.', '2026-07-15').length === 0;
  // SILENT: the 07-13 "$1.045 trillion in total FY2026 Pentagon resources" is one entity's own
  // total — "in total" is deliberately NOT a connective. (Regression IMP-045 --require-resolved.)
  const jul13PubAgg = path.join(root, 'content/daily-updates/2026-07-13.md');
  const okAggSilent13 = !fs.existsSync(jul13PubAgg) || aggregateClaims(fs.readFileSync(jul13PubAgg, 'utf8'), '2026-07-13').length === 0;

  // --- IMP-058: relative-date referent. Both directions on the REAL 07-16 artifacts + synthetic edges. ---
  // FIRE: the 07-16 editor working file still carries the pre-correction Take lead
  // ("Yesterday New York became the first state to ban…" — EO 62 was signed 07-14).
  const jul16Work = path.join(root, 'daily-briefs/2026-07-16-v2.working.md');
  const jul16Pub = path.join(root, 'content/daily-updates/2026-07-16.md');
  const relWorkFire = fs.existsSync(jul16Work)
    ? relativeDateFindings(fs.readFileSync(jul16Work, 'utf8'), '2026-07-16') : [];
  const okRelWorkFire = relWorkFire.some((f) => f.check === 'relative-date-referent' && /New York|became/i.test(f.message));
  // SILENT on the corrected published Take sentence ("This week New York became…").
  const okRelPubSilentNY = !fs.existsSync(jul16Pub) ||
    !relativeDateFindings(fs.readFileSync(jul16Pub, 'utf8'), '2026-07-16').some((f) => /New York/i.test(f.message));
  // FIRE (synthetic): the exact failure sentence.
  const okRelSynthFire = relativeDateFindings('Yesterday New York became the first state to ban new hyperscale data centers outright.', '2026-07-16').length > 0;
  // SILENT (synthetic): the corrected stable form does not shift.
  const okRelSynthStable = relativeDateFindings('This week New York became the first state to ban new hyperscale data centers outright.', '2026-07-16').length === 0;
  // SILENT (synthetic): a forward watch carries no past-relative word.
  const okRelSynthWatch = relativeDateFindings('Watch the August 12 CPI for the first honest print.', '2026-07-16').length === 0;
  // SILENT (synthetic): possessive "yesterday's" is the Dashboard's stable idiom.
  const okRelSynthPoss = relativeDateFindings("The S&P closed at 7,572, up from yesterday's open.", '2026-07-16').length === 0;
  // SILENT (synthetic): a market-move recap is the Writer's device, not a dated event.
  const okRelSynthMarket = relativeDateFindings('Yesterday the bond market rallied on soft inflation.', '2026-07-16').length === 0;

  // --- IMP-069: entity-count + regulatory effective-date. Both directions on the REAL 07-18 v2
  //     error sentences (the class that shipped 3 briefs running) + non-fire discipline. ---
  const jul18v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-18-v2.md');
  const jul18pub = path.join(process.cwd(), 'content', 'daily-updates', '2026-07-18.md');
  const ecFire = entityCountClaims('Kroger is acquiring Giant Eagle at roughly 0.18 times revenue for a 470-store regional grocer.', '2026-07-18');
  const okEcFire = ecFire.some((c) => c.key === 'entity-count:470-store' && c.tier === 'critical' && c.status === 'UNVERIFIED');
  const okEcSilent = entityCountClaims('Giant Eagle generates about $9 billion in annual sales, 170-plus projects await rules, and the report showed 97 billion hours.', '2026-07-18').length === 0;
  const okEcReal = !fs.existsSync(jul18v2) || entityCountClaims(fs.readFileSync(jul18v2, 'utf8'), '2026-07-18').some((c) => c.key === 'entity-count:470-store' && c.tier === 'critical');
  // The CORRECTED published brief still extracts its count (197-supermarket): the gate forces the
  // corrected number to be RESOLVED too — it is not waved through because it happens to be right.
  const okEcPubResolvable = !fs.existsSync(jul18pub) || entityCountClaims(fs.readFileSync(jul18pub, 'utf8'), '2026-07-18').some((c) => /^entity-count:197-supermarket/.test(c.key));
  const edFire = effectiveDateClaims("The GENIUS Act's stablecoin framework takes effect today, and the six agencies have not finished the rules.", '2026-07-18');
  const okEdFire = edFire.some((c) => c.claimType === 'effective-date' && c.tier === 'critical' && c.status === 'UNVERIFIED');
  // "The deadline … falls today" is a DEADLINE, not an effective date (the corrected 07-18 phrasing):
  // "falls" is not an effective-verb, so it stays SILENT. This distinction IS the fix.
  const okEdSilentDeadline = effectiveDateClaims("The GENIUS Act's deadline for federal regulators to finalize stablecoin rules falls today, one year after it was signed.", '2026-07-18').length === 0;
  const okEdSilentBare = effectiveDateClaims('The new ad tier was highly effective and cost-effective across the quarter.', '2026-07-18').length === 0;
  const okEdReal = !fs.existsSync(jul18v2) || effectiveDateClaims(fs.readFileSync(jul18v2, 'utf8'), '2026-07-18').some((c) => c.tier === 'critical' && /takes effect today/i.test(c.sentence));

  // --- IMP-143 (08-07 mandate #2, re-prescribed 08-08 as #2a): SOURCE CONCLUSIONS. Both directions,
  //     asserted against the REAL artifact the Critic named — 08-08 AI&T-1, whose whole causal spine
  //     rests on a reconstruction of a conference talk that no layer ever had to write down. ---
  const aug08v2 = path.join(process.cwd(), 'daily-briefs', '2026-08-08-v2.md');
  const aug08truth = path.join(process.cwd(), 'daily-briefs', '2026-08-08-truth.json');
  const scReal = fs.existsSync(aug08v2) ? sourceConclusionClaims(fs.readFileSync(aug08v2, 'utf8'), '2026-08-08') : [];
  // FIRE: the Black Hat talk claim is extracted as CRITICAL and UNVERIFIED.
  const scAit1 = scReal.find((c) => /Mowshowitz|Black Hat/i.test(c.sentence));
  const okScFireReal = !!scAit1 && scAit1.tier === 'critical' && scAit1.status === 'UNVERIFIED';
  // …and it is genuinely UNRESOLVED against the REAL truth file — the block is real, not notional.
  const realTruth = fs.existsSync(aug08truth) ? JSON.parse(fs.readFileSync(aug08truth, 'utf8')) : { claims: {} };
  const okScUnresolvedReal = !!scAit1 && !realTruth?.claims?.[scAit1.key];
  // SILENT: the SAME claim resolves once the Writer records the source's own conclusion.
  const okScResolves = !!scAit1 && (() => {
    const c = { ...scAit1 };
    const t = { claims: { [c.key]: { resolved: true, conclusion: 'Agent load took the package repository down.' } } } as any;
    if (t.claims[c.key]) c.status = 'PASS';
    return c.status === 'PASS';
  })();
  // NON-FIRE DISCIPLINE: a bare citation or a bare count is NOT a source conclusion.
  const okScSilentBare = sourceConclusionClaims('## The Signal\n\nRoughly three-quarters of US merchant carbon dioxide is byproduct (C&EN, 2023), and Epoch AI counted roughly 2,500 high and critical CVEs in July.', '2026-08-08').length === 0;
  // NON-FIRE: a passing mention of a report with no conclusion verb and no numeral stays silent.
  const okScSilentMention = sourceConclusionClaims("## AI & Tech\n\nThe committee's report is expected before the recess.", '2026-08-08').length === 0;
  // NO STORM: fact-gate runs nightly, so the fire rate is asserted, not assumed.
  const scRates = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08']
    .map((d) => path.join(process.cwd(), 'daily-briefs', `${d}-v2.md`))
    .filter((p) => fs.existsSync(p))
    .map((p) => sourceConclusionClaims(fs.readFileSync(p, 'utf8'), null).length);
  const okScNoStorm = scRates.length > 0 && Math.max(...scRates) <= 3;
  // INVERSION LEG, both directions: the literal 08-07 defect — the brief negating what its own
  // source asserts — with every number in the sentence still true.
  const invClaim: Claim = {
    key: 'source-conclusion:test', asset: "Wallace's Black Hat talk", tier: 'critical',
    claimType: 'source-conclusion', direction: 'unknown', magnitudePct: null, level: null,
    section: '## AI & Tech', sentence: 'The evaluation did not detect the intrusion for ten weeks.', status: 'UNVERIFIED',
  };
  const okScInvFire = sourceConclusionInversions([invClaim],
    { 'source-conclusion:test': { resolved: true, conclusion: 'The evaluation detect flagged the run within hours.' } }).length === 1;
  const okScInvSilent = sourceConclusionInversions([{ ...invClaim, sentence: 'The evaluation detected the intrusion within hours.' }],
    { 'source-conclusion:test': { resolved: true, conclusion: 'The evaluation detected the run within hours.' } }).length === 0;
  const okScInvNoRow = sourceConclusionInversions([invClaim], { 'source-conclusion:test': { resolved: true } }).length === 0;

  // --- IMP-074: AI&T definite-product / deployment claims. FIRE on the 07-19 fabrication SHAPES (the
  //     Critic's quoted sentences), SILENT on the corrected hedged forms, non-AI&T sections, and analysis. ---
  const aiFireMsft = aiProductClaims('## AI & Tech\n\nMicrosoft announced Project Perception, an AI security tool built to undercut its rivals.', '2026-07-19');
  const okAiFireMsft = aiFireMsft.some((c) => c.claimType === 'ai-product' && c.tier === 'critical' && c.status === 'UNVERIFIED');
  const aiFireAtlas = aiProductClaims('## AI & Tech\n\nThe deployment of Boston Dynamics Atlas humanoid robots on the assembly line marks the first such automotive rollout.', '2026-07-19');
  const okAiFireAtlas = aiFireAtlas.some((c) => c.claimType === 'ai-product' && c.tier === 'critical');
  // SILENT: the CORRECTED 07-19 sentences differ from the fabrication by exactly the hedge word.
  const okAiSilentHedgeMsft = aiProductClaims('## AI & Tech\n\nMicrosoft is reportedly developing Project Perception, an AI security tool that routes each task to the cheapest model.', '2026-07-19').length === 0;
  const okAiSilentPlanAtlas = aiProductClaims("## AI & Tech\n\nHyundai's union struck over the company's plan to put Boston Dynamics Atlas humanoid robots on the line; no units run yet.", '2026-07-19').length === 0;
  // SILENT: an action verb, but the hedge wins ("reportedly launched" is not the false-certainty class).
  const okAiSilentHedgeVerb = aiProductClaims('## AI & Tech\n\nMicrosoft reportedly launched a new security tool for enterprises.', '2026-07-19').length === 0;
  // SILENT: analysis prose with no product-action verb.
  const okAiSilentAnalysis = aiProductClaims('## AI & Tech\n\nContinuous security is an economics problem before it is a detection problem.', '2026-07-19').length === 0;
  // SILENT: scoping — the same definite product claim OUTSIDE AI&T does not fire here.
  const okAiSilentOther = aiProductClaims('## Companies & Crypto\n\nAcme launched a new payments platform for merchants this week.', '2026-07-19').length === 0;
  // REAL ARTIFACT: the shipped-corrected 07-19 v2 no longer carries the fabrication shapes.
  const jul19v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-19-v2.md');
  const okAiRealCorrected = !fs.existsSync(jul19v2)
    || !aiProductClaims(fs.readFileSync(jul19v2, 'utf8'), '2026-07-19').some((c) => /announced Project Perception|deployment of Boston Dynamics/i.test(c.sentence));

  // --- IMP-081: YoY-comparison. Both directions on the REAL 07-21 published sentences (GM fabrication
  //     that SHIPPED + STLD restored-guidance) + non-fire discipline. ---
  const jul21pub = path.join(process.cwd(), 'content', 'daily-updates', '2026-07-21.md');
  // IMP-086 (2026-07-22): the REAL-artifact anchor for the GM YoY moved to the immutable v2. The
  // published 07-21 file was CORRECTED post-publish (archive-corrections gate #18: "roughly 22% above
  // last year" → "roughly 2% below last year's $47.1 billion", mtime 21:19 07-21), so a test pinned to
  // the published file silently began FAILING the selftest — and therefore verify-improvements — the
  // moment the fix it was built to demand actually landed. A real-artifact test must point at an
  // artifact that PRESERVES the failure; daily-briefs/2026-07-21-v2.md is that immutable evening draft.
  const jul21v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-21-v2.md');
  const yoyGm = yoyComparisonClaims('## Markets & Macro\n\nGM carries a consensus of $46 billion in revenue, roughly 22% above last year.', '2026-07-21');
  const okYoyGmFire = yoyGm.some((c) => c.claimType === 'yoy' && c.tier === 'critical' && c.status === 'UNVERIFIED' && c.magnitudePct === 22);
  const yoyStld = yoyComparisonClaims('## Companies & Crypto\n\nthe roughly 85% jump in per-share earnings to about $3.69 from $2.01 a year earlier.', '2026-07-21');
  const okYoyStldFire = yoyStld.some((c) => c.claimType === 'yoy' && c.tier === 'critical');
  // RESOLVES: once the Morning Truth Gate records the prior-year actual under the key, it flips to PASS.
  const yoyKey = yoyGm[0]?.key ?? '';
  const fakeYoyTruth: any = { claims: { [yoyKey]: { value: 'GM Q2 2025 revenue $47.1B → $45.96B is DOWN 2.4%', source: 'https://investor.gm.com' } } };
  for (const c of yoyGm) if (fakeYoyTruth.claims[c.key]) c.status = 'PASS';
  const okYoyResolves = !!yoyKey && yoyGm.every((c) => c.status === 'PASS');
  // SILENT: a spot ratio with no prior-year referent (the AMD run-rate line + an ownership %) — in-section, so it proves the CONTENT guard, not the section scope.
  const okYoySilentRatio = yoyComparisonClaims("## AI & Tech\n\nAMD's data-center revenue is roughly 8% of NVIDIA's annualized run rate, and BitMine owns 4.8% of all ether.", '2026-07-21').length === 0;
  // SILENT: a bare intraday move ("up about half a percent", "more than 1%") has no prior-year referent.
  const okYoySilentMove = yoyComparisonClaims('## Markets & Macro\n\nS&P futures pointed higher, up about half a percent with the Nasdaq up more than 1%.', '2026-07-21').length === 0;
  // SILENT (scope): a legitimate industry YoY in the Signal stays off the critical rails (the 07-13 USMTO class).
  const okYoyScopeSignal = yoyComparisonClaims('## The Signal\n\nMachine-tool orders are running nearly 29% ahead of last year.', '2026-07-21').length === 0;
  // REAL: the shipped 07-21 v2 carries the GM YoY fabrication as an extractable critical claim (decimals
  // and all). Anchored to v2, NOT the published file, which was corrected post-publish (see note above).
  const okYoyReal = !fs.existsSync(jul21v2) || yoyComparisonClaims(fs.readFileSync(jul21v2, 'utf8'), '2026-07-21').some((c) => c.tier === 'critical' && /22\s*%/.test(c.sentence) && /above last year/i.test(c.sentence));

  // --- IMP-082: corporate scheduled-event weekday. FIRE on AMD's real conference-day line, SILENT on
  //     a macro release (owned by scheduledEventClaims) and on a bare weekday with no event. ---
  const okCorpFire = corporateEventDateFindings('AMD opens its Advancing AI 2026 conference Tuesday, expected to unveil the MI450 accelerator.', '2026-07-21').some((f) => f.check === 'corporate-event-date');
  const okCorpSilentMacro = corporateEventDateFindings('June CPI lands Tuesday at 8:30, and the tape has not priced it.', '2026-07-21').length === 0;
  const okCorpSilentBare = corporateEventDateFindings("The S&P closed at 7,443 on Monday's modest decline.", '2026-07-21').length === 0;
  const okCorpReal = !fs.existsSync(jul21pub) || corporateEventDateFindings(fs.readFileSync(jul21pub, 'utf8'), '2026-07-21').length > 0;

  // --- IMP-083: segment-metric attribution. FIRE on AMD's compound "data-center GPU revenue, $X",
  //     SILENT on a single-qualifier disclosed segment ("Data Center revenue of $X"). ---
  const okSegFire = segmentMetricFindings("AMD's data-center GPU revenue, $7.7 billion in the trailing year through Q1, is roughly 8% of NVIDIA's run rate.", '2026-07-21').some((f) => f.check === 'segment-metric-attribution');
  const okSegSilentDisclosed = segmentMetricFindings('AMD reported Data Center revenue of $12.8 billion, up sharply on AI demand.', '2026-07-21').length === 0;

  // IMP-101 (restored 07-31): stock-move reaction magnitude surfaced for the morning truth gate.
  const okSmFire = stockMoveReactionFindings('## Companies & Crypto\nGE Vernova beat, but the stock fell 8 percent because core EPS came in at $2.47 against a $3.18 estimate.', '2026-07-26').some((f) => f.check === 'stock-move-reaction');
  const okSmSilentYoy = stockMoveReactionFindings('## Companies & Crypto\nRevenue rose 12 percent year over year to $48 billion.', '2026-07-26').length === 0;
  const okSmSilentIndex = stockMoveReactionFindings('## Markets & Macro\nThe S&P fell 1.2 percent on the print.', '2026-07-26').length === 0;
  const okSmSilentName = stockMoveReactionFindings('## Companies & Crypto\nMicron surged 12 percent after the guide.', '2026-07-26').length === 0;
  // Precision: on a long bullet carrying a metric % AND a stock-move %, the flag must quote the
  // STOCK move (10%), not the first metric % on the line (37%) — the real 07-31 Amazon shape.
  const smAmzn = stockMoveReactionFindings('## AI & Tech\n- **Amazon posted its first $200 billion quarter, AWS grew 37% to $42.23 billion, and the stock rose about 10% after hours.** Filler.', '2026-07-31');
  const okSmPrecise = smAmzn.some((f) => f.check === 'stock-move-reaction' && /\b10\s*%/.test(f.message) && !/\b37\s*%/.test(f.message));

  // --- IMP-115: the Take's publicly-unverifiable load-bearing figure. FIRE on all three real
  //     shapes (07-31 v2 "55% of the world's total", 08-01 "in all of 2025", 07-30 v2 "larger than
  //     the entire IEA reserve release"); SILENT outside the Take, and SILENT on an ordinary
  //     sourced Take figure. Real artifacts where they exist, fixtures otherwise. ---
  const takeWrap = (s: string) => `# ▸ THE TAKE\n\n${s}\n`;
  const teShare = takeExtraordinaryFindings(takeWrap("China's autonomous mining fleet went from 562 trucks to 2,090 in a single year, roughly 55% of the world's total and the largest battery-electric autonomous fleet on earth."), '2026-07-31');
  const okTeShare = teShare.some((f) => f.check === 'take-extraordinary-claim' && /share-of-world/.test(f.message));
  const tePeriod = takeExtraordinaryFindings(takeWrap('Capital deployed reached roughly $1.6 billion year to date against roughly $1.6 billion in all of 2025.'), '2026-08-01');
  const okTePeriod = tePeriod.some((f) => /full-period-baseline/.test(f.message));
  const teCmp = takeExtraordinaryFindings(takeWrap('The Chinese import withdrawal, a discretionary cut larger than the entire IEA reserve release during the 2022 crisis, is the deferred curve\'s anchor.'), '2026-07-30');
  const okTeCmp = teCmp.some((f) => /benchmark-comparison/.test(f.message));
  // Scoping: the identical sentence in a SIX bullet is NOT this failure class (the Six is priced and
  // sourced bullet-by-bullet; the Take is the load-bearing argument). Zero findings outside the Take.
  const okTeScoped = takeExtraordinaryFindings("## Markets & Macro\n\nChina refines roughly 55% of the world's rare earths.", '2026-07-31').length === 0;
  const okTeSilentOrdinary = takeExtraordinaryFindings(takeWrap('Constellation Software deployed $809 million in Q1 2026, and organic recurring revenue decelerated to 4% FX-neutral.'), '2026-08-01').length === 0;
  // REAL artifacts: the 07-31 v2 Take (pre-morning-gate, where the truck claim still lives) and the
  // published 08-01 Take (where the $1.6B/2025 baseline shipped and the Critic sourced it WRONG).
  const v2_0731 = path.join(process.cwd(), 'daily-briefs', '2026-07-31-v2.md');
  const okTeReal31 = !fs.existsSync(v2_0731) || takeExtraordinaryFindings(fs.readFileSync(v2_0731, 'utf8'), '2026-07-31').some((f) => /world'?s total|55\s*%/.test(f.message));
  const pub_0801 = path.join(process.cwd(), 'content', 'daily-updates', '2026-08-01.md');
  const okTeReal01 = !fs.existsSync(pub_0801) || takeExtraordinaryFindings(fs.readFileSync(pub_0801, 'utf8'), '2026-08-01').some((f) => /all of 2025/.test(f.message));

  // --- IMP-086: earnings-result vs consensus. FIRE on the real 07-22 fabricated EQT shape (the "beat"
  //     that was a miss) AND the real published 07-22 EQT line; RESOLVE to PASS with truth; SILENT on a
  //     bare YoY (owned by yoy), a guidance line, and a stock-price move. ---
  const jul22pub = path.join(process.cwd(), 'content', 'daily-updates', '2026-07-22.md');
  const earnFab = earningsResultClaims('## Companies & Crypto\n\nEQT posted Q2 revenue of $2.56 billion against a $1.84 billion consensus, a 39% beat, with adjusted EPS of $0.45 versus $0.41 expected.', '2026-07-22');
  const okEarnFire = earnFab.some((c) => c.claimType === 'earnings' && c.tier === 'critical' && c.status === 'UNVERIFIED');
  const earnKey = earnFab[0]?.key ?? '';
  const fakeEarnTruth: any = { claims: { [earnKey]: { value: 'EQT Q2 revenue $1.81B; adj EPS $0.39 MISSED ~$0.42', source: 'https://www.marketscreener.com' } } };
  for (const c of earnFab) if (fakeEarnTruth.claims[c.key]) c.status = 'PASS';
  const okEarnResolves = !!earnKey && earnFab.every((c) => c.status === 'PASS');
  const okEarnSilentYoy = earningsResultClaims('## Markets & Macro\n\nGM reported Q2 revenue of $48.03 billion, up 1.9% year over year, with adjusted EPS of $3.57.', '2026-07-22').length === 0;
  const okEarnSilentGuidance = earningsResultClaims('## Companies & Crypto\n\nEQT raised full-year output guidance by roughly 90 Bcfe while trimming capital spending.', '2026-07-22').length === 0;
  const okEarnSilentMove = earningsResultClaims('## Markets & Macro\n\nMicron surged 12% after Bank of America reiterated a buy with a $1,550 target.', '2026-07-22').length === 0;
  const okEarnReal = !fs.existsSync(jul22pub) || earningsResultClaims(fs.readFileSync(jul22pub, 'utf8'), '2026-07-22').some((c) => c.tier === 'critical' && /EQT|1\.81 billion|0\.39/i.test(c.sentence));

  console.log('fact-gate --selftest');
  console.log(`  [IMP-081] FIRE: GM "$46 billion in revenue, 22% above last year" is a CRITICAL yoy claim: ${okYoyGmFire ? '✓' : '✗'}`);
  console.log(`  [IMP-081] FIRE: STLD "85% jump … $3.69 from $2.01 a year earlier" (spans decimals): ${okYoyStldFire ? '✓' : '✗'}`);
  console.log(`  [IMP-081] RESOLVES to PASS once truth carries yoy:<slug>: ${okYoyResolves ? '✓' : '✗'} (key=${yoyKey.slice(0, 32)})`);
  console.log(`  [IMP-081] SILENT on a spot ratio ("8% of NVIDIA's run rate", "4.8% of all ether"): ${okYoySilentRatio ? '✓' : '✗'}`);
  console.log(`  [IMP-081] SILENT on a bare intraday move ("up about half a percent"): ${okYoySilentMove ? '✓' : '✗'}`);
  console.log(`  [IMP-081] SILENT (scope) on a Signal industry YoY ("machine orders 29% ahead of last year"): ${okYoyScopeSignal ? '✓' : '✗'}`);
  console.log(`  [IMP-081] FIRE on the REAL published 07-21 (the GM YoY that shipped): ${okYoyReal ? '✓' : '✗'}`);
  console.log(`  [IMP-082] FIRE: "AMD opens its … conference Tuesday" is a corporate-event-date FLAG: ${okCorpFire ? '✓' : '✗'}`);
  console.log(`  [IMP-082] SILENT on a macro release ("CPI lands Tuesday" — owned by scheduledEventClaims): ${okCorpSilentMacro ? '✓' : '✗'}`);
  console.log(`  [IMP-082] SILENT on a bare weekday with no event verb ("Monday's decline"): ${okCorpSilentBare ? '✓' : '✗'}`);
  console.log(`  [IMP-082] FIRE on the REAL published 07-21 (AMD/GM weekday event): ${okCorpReal ? '✓' : '✗'}`);
  console.log(`  [IMP-083] FIRE: "data-center GPU revenue, $7.7 billion" is a segment-metric FLAG: ${okSegFire ? '✓' : '✗'}`);
  console.log(`  [IMP-083] SILENT on a disclosed single-qualifier segment ("Data Center revenue of $12.8B"): ${okSegSilentDisclosed ? '✓' : '✗'}`);
  console.log(`  [IMP-101] FIRE: "the stock fell 8 percent" (07-26 GE Vernova) is a stock-move FLAG: ${okSmFire ? '✓' : '✗'}`);
  console.log(`  [IMP-101] SILENT on a YoY / index move ("S&P fell 1.2%") / name-only move ("Micron surged 12%"): ${okSmSilentYoy && okSmSilentIndex && okSmSilentName ? '✓' : '✗'}`);
  console.log(`  [IMP-101] PRECISION: quotes the stock move (10%), not the metric % (37%), on a mixed bullet: ${okSmPrecise ? '✓' : '✗'}`);
  console.log(`  [IMP-115] FIRE: "55% of the world's total" (07-31 Take) is a share-of-world FLAG: ${okTeShare ? '✓' : '✗'}`);
  console.log(`  [IMP-115] FIRE: "in all of 2025" as a comparison baseline (08-01 Take, sourced WRONG) is a full-period FLAG: ${okTePeriod ? '✓' : '✗'}`);
  console.log(`  [IMP-115] FIRE: "larger than the entire IEA reserve release" (07-30 Take) is a benchmark FLAG: ${okTeCmp ? '✓' : '✗'}`);
  console.log(`  [IMP-115] SCOPED: SILENT on the identical sentence in a Six bullet: ${okTeScoped ? '✓' : '✗'}`);
  console.log(`  [IMP-115] SILENT on an ordinary sourced Take figure ($809M in Q1 2026, 4% FXN): ${okTeSilentOrdinary ? '✓' : '✗'}`);
  console.log(`  [IMP-115] FIRE on the REAL 07-31 v2 Take and the REAL published 08-01 Take: ${okTeReal31 && okTeReal01 ? '✓' : '✗'}`);
  console.log(`  [IMP-086] FIRE: EQT "$2.56B against a $1.84B consensus … $0.45 versus $0.41 expected" is a CRITICAL earnings claim: ${okEarnFire ? '✓' : '✗'}`);
  console.log(`  [IMP-086] RESOLVES to PASS once truth carries earnings:<slug>: ${okEarnResolves ? '✓' : '✗'} (key=${earnKey.slice(0, 32)})`);
  console.log(`  [IMP-086] SILENT on a bare YoY ("revenue $48.03B, up 1.9% YoY" — owned by yoy): ${okEarnSilentYoy ? '✓' : '✗'}`);
  console.log(`  [IMP-086] SILENT on a guidance line and a stock-price move: ${okEarnSilentGuidance && okEarnSilentMove ? '✓' : '✗'}`);
  console.log(`  [IMP-086] FIRE on the REAL published 07-22 (the EQT earnings line): ${okEarnReal ? '✓' : '✗'}`);
  console.log(`  FIRE: 07-16 working file "Yesterday New York became…" is a relative-date FLAG: ${okRelWorkFire ? '✓' : '✗'} (${relWorkFire.length} finding(s))`);
  console.log(`  SILENT on the corrected published Take ("This week New York became…"): ${okRelPubSilentNY ? '✓' : '✗'}`);
  console.log(`  FIRE on synthetic "Yesterday New York became…": ${okRelSynthFire ? '✓' : '✗'}`);
  console.log(`  SILENT on the stable form "This week New York became…": ${okRelSynthStable ? '✓' : '✗'}`);
  console.log(`  SILENT on a forward watch ("Watch the August 12 CPI"): ${okRelSynthWatch ? '✓' : '✗'}`);
  console.log(`  SILENT on possessive "yesterday's open": ${okRelSynthPoss ? '✓' : '✗'}`);
  console.log(`  SILENT on a market-move recap ("Yesterday the bond market rallied"): ${okRelSynthMarket ? '✓' : '✗'}`);
  console.log(`  [IMP-069] FIRE: "470-store regional grocer" is a CRITICAL entity-count claim: ${okEcFire ? '✓' : '✗'}`);
  console.log(`  [IMP-069] SILENT on "$9B sales / 170-plus projects / 97 billion hours" (no footprint noun): ${okEcSilent ? '✓' : '✗'}`);
  console.log(`  [IMP-069] FIRE on the REAL 07-18 v2 (470-store): ${okEcReal ? '✓' : '✗'}`);
  console.log(`  [IMP-069] the corrected published brief still extracts 197-supermarket (must resolve): ${okEcPubResolvable ? '✓' : '✗'}`);
  console.log(`  [IMP-069] FIRE: "the framework takes effect today" is a CRITICAL effective-date claim: ${okEdFire ? '✓' : '✗'}`);
  console.log(`  [IMP-069] SILENT on "the deadline … falls today" (a deadline ≠ an effective date): ${okEdSilentDeadline ? '✓' : '✗'}`);
  console.log(`  [IMP-069] SILENT on bare "highly effective / cost-effective": ${okEdSilentBare ? '✓' : '✗'}`);
  console.log(`  [IMP-069] FIRE on the REAL 07-18 v2 ("takes effect today"): ${okEdReal ? '✓' : '✗'}`);
  console.log(`  [IMP-143] FIRE on the REAL 08-08 AI&T-1 source conclusion (${scAit1 ? scAit1.key : 'NOT FOUND'}): ${okScFireReal ? '✓' : '✗'}`);
  console.log(`  [IMP-143] …and it is UNRESOLVED against the real 2026-08-08-truth.json: ${okScUnresolvedReal ? '✓' : '✗'}`);
  console.log(`  [IMP-143] RESOLVES once the source's own conclusion is recorded: ${okScResolves ? '✓' : '✗'}`);
  console.log(`  [IMP-143] SILENT on a bare citation / bare count (C&EN, Epoch AI): ${okScSilentBare ? '✓' : '✗'}`);
  console.log(`  [IMP-143] SILENT on a passing mention with no conclusion verb: ${okScSilentMention ? '✓' : '✗'}`);
  console.log(`  [IMP-143] NO STORM — per-brief claims across 08-04…08-08: [${scRates.join(', ')}] (max 3): ${okScNoStorm ? '✓' : '✗'}`);
  console.log(`  [IMP-143] SOURCE CONCLUSION INVERTED fires when the brief negates its source: ${okScInvFire ? '✓' : '✗'}`);
  console.log(`  [IMP-143] …silent when the brief AGREES with the recorded conclusion: ${okScInvSilent ? '✓' : '✗'}`);
  console.log(`  [IMP-143] …silent when no conclusion was recorded (no phantom findings): ${okScInvNoRow ? '✓' : '✗'}`);
  console.log(`  [IMP-074] FIRE: "Microsoft announced Project Perception" is a CRITICAL ai-product claim: ${okAiFireMsft ? '✓' : '✗'}`);
  console.log(`  [IMP-074] FIRE: "the deployment of ... Atlas ... robots" is a CRITICAL ai-product claim: ${okAiFireAtlas ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on the corrected "is reportedly developing Project Perception" (hedge): ${okAiSilentHedgeMsft ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on the corrected "plan to put ... Atlas ... robots" (future plan): ${okAiSilentPlanAtlas ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on "reportedly launched" (hedge beats the action verb): ${okAiSilentHedgeVerb ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on AI&T analysis prose (no product-action verb): ${okAiSilentAnalysis ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on a definite product claim OUTSIDE AI&T (scoping): ${okAiSilentOther ? '✓' : '✗'}`);
  console.log(`  [IMP-074] SILENT on the shipped-corrected REAL 07-19 v2 (no fabrication shape): ${okAiRealCorrected ? '✓' : '✗'}`);
  console.log(`  FIRE: 07-15 C&C-1 "combined … $49 billion, up 39%" is a CRITICAL aggregate claim: ${okAggFire ? '✓' : '✗'} (key=${aggKey})`);
  console.log(`  RESOLVES to PASS once truth carries aggregate:<magnitude>: ${okAggResolves ? '✓' : '✗'}`);
  console.log(`  SILENT on a single-entity figure ("JPMorgan … $21.2 billion"): ${okAggSingle ? '✓' : '✗'}`);
  console.log(`  SILENT on 07-13 "$1.045 trillion in total" (not a constituent sum): ${okAggSilent13 ? '✓' : '✗'}`);
  console.log(`  event-calendar loads (CPI 2026-07-14, BLS): ${okCalLoad ? '✓' : '✗'} (${cal.length} event(s))`);
  console.log(`  FAIL on real 07-13 DRAFT "CPI … land in the same session": ${okEvFire ? '✓' : '✗'} (${evFireN} finding(s))`);
  console.log(`  SILENT on real 07-13 PUBLISHED ("lands tomorrow" / "Tuesday"): ${okEvSilent ? '✓' : '✗'} (${evSilentFindings.length} finding(s))`);
  console.log(`  same-session claim with NO calendar entry still rides critical rails: ${okEvNoCal ? '✓' : '✗'}`);
  console.log(`  FAIL on a weekday that contradicts the calendar: ${okEvWrongDay ? '✓' : '✗'}`);
  console.log(`  price attributed to the NEAREST asset (WTI=74.41, not Brent's 79): ${okWtiAttrib ? '✓' : '✗'} (wti=${wtiGot})`);
  console.log(`  "highest-and-best use" is not a superlative: ${okToa ? '✓' : '✗'}`);
  console.log(`  a real "highest since 1996" still extracts: ${okToaNarrow ? '✓' : '✗'}`);
  console.log(`  FAIL on real 07-10 KOSPI Overnight reuse: ${okFire ? '✓' : '✗'} (${fire.length} finding(s))`);
  console.log(`  SILENT on real 07-09 ("on Tuesday" dated): ${okSilentDated ? '✓' : '✗'} (${silentDated.length} finding(s))`);
  console.log(`  SILENT on real 07-07 (first occurrence): ${okSilentFirst ? '✓' : '✗'} (${silentFirst.length} finding(s))`);
  console.log(`  FAIL on real 07-10 story-fingerprint reuse: ${okFpFire ? '✓' : '✗'} (${fpFire.length} finding(s))`);
  console.log(`  FAIL includes Nikkei −2.1% companion: ${okFpNikkei ? '✓' : '✗'}`);
  console.log(`  SILENT story-fp on dated 07-09: ${okFpSilentDated ? '✓' : '✗'} (${fpSilentDated.length} finding(s))`);
  console.log(`  SILENT story-fp on first-occurrence 07-07: ${okFpSilentFirst ? '✓' : '✗'} (${fpSilentFirst.length} finding(s))`);
  console.log(`  magnitude parses "4.91 percent": ${okMagWord ? '✓' : '✗'} (got ${magWord.mag}/${magWord.dir})`);
  console.log(`  magnitude parses "2.6%": ${okMagSym ? '✓' : '✗'} (got ${magSym.mag}/${magSym.dir})`);
  console.log(`  entity-bindings registry loads: ${okBindingsLoad ? '✓' : '✗'} (${bindings.length} binding(s))`);
  console.log(`  FAIL on real 07-11 draft "BlackRock's BCRED": ${okEaFire ? '✓' : '✗'} (${eaFire.length} finding(s))`);
  console.log(`  SILENT on real 07-11 PUBLISHED (corrected to Blackstone): ${okEaSilent ? '✓' : '✗'} (${eaSilent.length} finding(s))`);
  console.log(`  FAIL on the 07-10 JGB transposition (30Y given the 10Y's record): ${okJgbFire ? '✓' : '✗'}`);
  console.log(`  SILENT on the correctly-attributed JGB sentence: ${okJgbSilent ? '✓' : '✗'}`);
  console.log(`  FAIL on real 07-11 QG harmonize-to-published-record: ${okThFire ? '✓' : '✗'} (${thFire.length} finding(s))`);
  console.log(`  SILENT on real 07-10 QG log (no harmonization): ${okThSilent ? '✓' : '✗'} (${thSilent.length} finding(s))`);
  console.log(`  SILENT when harmonization cites a primary source: ${okThSourced ? '✓' : '✗'}`);
  console.log(`  SILENT on nominal compliance ("harmonization: none"): ${okThNominal ? '✓' : '✗'}`);
  console.log(`  FIRE when nominal compliance precedes a later confession on the same line: ${okThMixed ? '✓' : '✗'}`);
  console.log(`  DOWNGRADES to FLAG once the archive correction is logged (COR row): ${okThResolved ? '✓' : '✗'}`);
  console.log(`  [IMP-064] registry-integrity SILENT on a healthy registry: ${okRegOk ? '✓' : '✗'}`);
  console.log(`  [IMP-064] FAIL when the premise registry is MALFORMED (the 07-17 blind-gate case): ${okRegMalformed ? '✓' : '✗'}`);
  console.log(`  [IMP-064] FAIL when the premise registry is EMPTY: ${okRegEmpty ? '✓' : '✗'}`);
  console.log(`  [IMP-064] FAIL when the premise registry is MISSING: ${okRegMissing ? '✓' : '✗'}`);
  console.log(`  [IMP-064] an unusable binding row is REPORTED, not silently skipped: ${okRegBadRow ? '✓' : '✗'}`);
  console.log(`  [IMP-136] binding-schema: the 05:26 prose-shaped row (no key) is a NAMED badRow + registry FAIL: ${okSchemaMissingKey ? '✓' : '✗'}`);
  console.log(`  [IMP-136] binding-schema: blank correctRe/wrongRe are reported by FIELD NAME: ${okSchemaBlankRe ? '✓' : '✗'}`);
  console.log(`  [IMP-136] zero-width guard: a key matching empty TERMINATES (was an infinite loop): ${okZeroWidthTerminates ? '✓' : '✗'}`);
  console.log(`  [IMP-136] the REPAIRED aisi binding FIREs on "Anthropic, OpenAI and Meta are the three": ${okAisiFire ? '✓' : '✗'}`);
  console.log(`  [IMP-136] …and is SILENT on AISI's true finding (Mythos 5, 17 of 19): ${okAisiSilent ? '✓' : '✗'}`);
  console.log(`  [IMP-064] the REAL registries on disk are healthy right now: ${okRegRealHealthy ? '✓' : '✗'}`);

  // ── IMP-116: HEADLINE ANCHORS — the title numeral and the watch-line price ─────────────────
  const HA_BAD = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n**Sunday, August 2, 2026**\n\n### Ten Ships Through Hormuz\n\n*Hormuz got counted. Watch Sunday evening's Asian crude reopen against Friday's $84.67 WTI settle, because a gap of more than a few dollars is not the market pricing a war.*\n\n---\n\n# ▸ THE DASHBOARD\n\n### Equities\n\n*The S&P 500 rose 1.2% to 7,000.*\n`;
  const HA_CLEAN = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n**Sunday, August 2, 2026**\n\n### What Won't Reverse\n\n*Two inflation channels stack into the meeting. Watch the FOMC decision and Monday's oil open after the Jazan strike.*\n\n---\n\n# ▸ THE DASHBOARD\n\n### Equities\n\n*The S&P 500 rose 1.2% to 7,000.*\n`;
  const haBad = headlineAnchorClaims(HA_BAD, '2026-08-02');
  const okHaTitle = haBad.some((c) => c.section === 'Daily Title' && /Ten/i.test(String(c.level)));
  const okHaWatch = haBad.some((c) => /watch line/i.test(c.section) && String(c.level).includes('84.67'));
  const okHaCritical = haBad.every((c) => c.tier === 'critical' && c.status === 'UNVERIFIED');
  // SILENT on a title with no numeral and a watch line with no price (a bare calendar watch).
  const okHaClean = headlineAnchorClaims(HA_CLEAN, '2026-08-02').length === 0;
  // The date line is never mistaken for the title (older briefs used `## {weekday}, {month} {d}, {yyyy}`)
  // and neither is the Weekly's date-range heading (`## July 5-11, 2026`). A bare year is not a claim.
  const okHaDateline = headlineAnchorClaims(
    `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n## Saturday, June 20, 2026\n\nBody.\n\n# ▸ THE DASHBOARD\n`, '2026-08-05',
  ).length === 0;
  const okHaWeekRange = headlineAnchorClaims(
    `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n## July 5-11, 2026\n\nBody.\n\n# ▸ THE DASHBOARD\n`, '2026-08-05',
  ).length === 0;
  const okHaYear = headlineAnchorClaims(
    `# H\n\n### The 2026 Problem\n\n*No watch line here.*\n\n# ▸ THE DASHBOARD\n`, '2026-08-05',
  ).length === 0;
  // ENFORCEMENT EPOCH: the archive is read, never condemned. A pre-epoch brief and a WEEKLY (week id)
  // extract nothing, so re-running --require-resolved over history cannot red-fail it.
  const okHaEpoch = headlineAnchorClaims(HA_BAD, '2026-07-17').length === 0;
  const okHaWeekly = headlineAnchorClaims(HA_BAD, '2026-W31').length === 0;
  // ACCEPTANCE GATE, real artifact: the 08-02 v2's title "Ten" and the intro's $84.67 both extract.
  const v2_0802 = path.join(process.cwd(), 'daily-briefs/2026-08-02-v2.md');
  let okHaReal = true;
  if (fs.existsSync(v2_0802)) {
    const real = headlineAnchorClaims(stripComments(fs.readFileSync(v2_0802, 'utf8')), '2026-08-02');
    okHaReal = real.some((c) => c.section === 'Daily Title' && /^Ten$/i.test(String(c.level))) &&
               real.some((c) => String(c.level).includes('84.67'));
  }
  // FALSE-POSITIVE DISCIPLINE: a bare calendar watch ("Watch August 7 to 10") stays off the rails.
  const okHaNoDate = headlineAnchorClaims(
    `# H\n\n### Pay Went Backwards\n\n*Watch August 7 to 10 for the memory tell.*\n\n# ▸ THE DASHBOARD\n`, '2026-08-05',
  ).filter((c) => /watch line/i.test(c.section)).length === 0;

  // ── IMP-117: BYLINE PAIRINGS — outlet bound to a person is a checkable pairing ─────────────
  const byBad = bylineAttributionClaims(`# ▸ THE SIX\n\n## Markets & Macro\n\n**A scheduling story.** Bloomberg's Colby Smith reported Friday evening that Warsh is considering fewer meetings.\n`, '2026-08-02');
  const okByFire = byBad.length === 1 && byBad[0]!.tier === 'critical' && /Colby Smith/.test(byBad[0]!.asset);
  const okBySilentOrg = bylineAttributionClaims(`Kpler's daily series shows ten crossings.`, '2026-08-05').length === 0;
  const okBySilentNoPossessive = bylineAttributionClaims(`Bloomberg puts the residual near $10 billion.`, '2026-08-05').length === 0;
  const okBySilentBarePerson = bylineAttributionClaims(`Jim Bianco supplied the tradable version.`, '2026-08-05').length === 0;
  const okByEpoch = bylineAttributionClaims(`Bloomberg's Colby Smith reported Friday evening.`, '2026-07-17').length === 0;
  // ACCEPTANCE GATE, real artifact: fires on the 08-02 v2's "Bloomberg's Colby Smith".
  let okByReal = true;
  if (fs.existsSync(v2_0802)) {
    okByReal = bylineAttributionClaims(stripComments(fs.readFileSync(v2_0802, 'utf8')), '2026-08-02')
      .some((c) => /Colby Smith/.test(c.asset));
  }

  // ── IMP-120: DERIVED ARITHMETIC — the price the bullet COMPUTES FROM ───────────────────────
  const DA_CC1 = `- **SpaceX floated the exchange ratio on its $60 billion purchase of Cursor, so the deal costs its own shareholders more every time the stock falls, and it has fallen about 45 percent.** At the June 16 closing high of $211.39 that was roughly 3.4 percent dilution. At Friday July 31's close of $123.54, under the $135 IPO price, the same money is about seventy percent more shares.\n`;
  const daCc1 = derivedArithmeticClaims(DA_CC1, '2026-08-03');
  const okDaFire = ['$211.39', '$123.54', '$135'].every((p) => daCc1.some((c) => c.level === p)) &&
                   daCc1.every((c) => c.tier === 'critical' && c.status === 'UNVERIFIED');
  // SILENT where a price is quoted but NOT framed as a price point the sentence computes from.
  const okDaSilentSettledAt = derivedArithmeticClaims(
    `The market's price on it is Brent, which settled at $87.93 on Friday after gaining roughly 24 percent in July.`, '2026-08-03').length === 0;
  const okDaSilentMagnitude = derivedArithmeticClaims(
    `The national debt is up $3.6 trillion in thirteen months, roughly $15 billion a day of new supply.`, '2026-08-03').length === 0;
  // "price of $60 billion" is a DEAL SIZE, not a price point — the magnitude unit disqualifies it.
  const okDaSilentDealSize = derivedArithmeticClaims(
    `Cursor changed hands at a price of $60 billion in all-stock consideration.`, '2026-08-03').length === 0;
  // ENFORCEMENT EPOCH: a pre-epoch brief and a WEEKLY extract nothing — the archive is read, not condemned.
  const okDaEpoch = derivedArithmeticClaims(DA_CC1, '2026-07-17').length === 0;
  const okDaWeekly = derivedArithmeticClaims(DA_CC1, '2026-W31').length === 0;
  // LEG (b), the OFFLINE half: $211.39 → $123.54 is 41.6%, printed as "about 45 percent" (3.4pp).
  const daInc = derivedPercentageInconsistencies(DA_CC1);
  const okDaPctFire = daInc.length === 1 && daInc[0]!.pct === 45 && Math.abs(daInc[0]!.best! - 41.56) < 0.1;
  // ...and the OTHER two percentages in the SAME failing bullet stay silent: "3.4 percent dilution"
  // is a ratio, not a price change (no change verb precedes it), and "seventy percent more shares"
  // reconciles at 71.1%. A detector that flags the whole bullet has learned nothing.
  const okDaPctNarrow = !daInc.some((x) => x.pct === 3.4 || x.pct === 70);
  // CO-PRESENCE IS NOT DERIVATION. The first design keyed on ≥2 BARE prices and swept 31 false
  // positives across 16 of 40 briefs, this shape being the commonest. Framed-prices-only kills it.
  const okDaPctCoPresence = derivedPercentageInconsistencies(
    `- **Crude repriced.** Brent crude settled at $78.19, up 5.4 percent, and WTI at $73.52, up 4.4 percent, a sharp single-session repricing.\n`).length === 0;
  // ACCEPTANCE GATE, real artifacts: fires on the 08-03 v2's C&C-1 and ONLY there; and the
  // PUBLISHED 08-03 (corrected to $225.64/$108.37 at the morning gate) no longer flags.
  const v2_0803 = path.join(process.cwd(), 'daily-briefs/2026-08-03-v2.md');
  let okDaReal = true, okDaRealScoped = true;
  if (fs.existsSync(v2_0803)) {
    const realBody = stripComments(fs.readFileSync(v2_0803, 'utf8'));
    const realClaims = derivedArithmeticClaims(realBody, '2026-08-03');
    okDaReal = realClaims.some((c) => c.level === '$123.54') &&
               derivedPercentageFindings(realBody, '2026-08-03').length === 1;
    // SILENT on the two correct derivations the Critic named: M&M-2's $3.6tn/$15bn-a-day and
    // Geo-1's $87.93 / "roughly 24 percent in July".
    okDaRealScoped = !realClaims.some((c) => /87\.93|3\.6|15/.test(String(c.level)));
  }

  console.log(`  [IMP-120] FIRES on C&C-1's three framed prices ($211.39/$123.54/$135): ${okDaFire ? '✓' : '✗'}`);
  console.log(`  [IMP-120] SILENT on "settled at $87.93" (quoted, not computed from): ${okDaSilentSettledAt ? '✓' : '✗'}`);
  console.log(`  [IMP-120] SILENT on "$3.6 trillion … $15 billion a day" (magnitudes): ${okDaSilentMagnitude ? '✓' : '✗'}`);
  console.log(`  [IMP-120] SILENT on "a price of $60 billion" (deal size, not a price point): ${okDaSilentDealSize ? '✓' : '✗'}`);
  console.log(`  [IMP-120] EPOCH: pre-epoch brief and WEEKLY extract nothing: ${okDaEpoch && okDaWeekly ? '✓' : '✗'}`);
  console.log(`  [IMP-120] OFFLINE LEG fires on 41.6%-printed-as-45%: ${okDaPctFire ? '✓' : '✗'}`);
  console.log(`  [IMP-120] and stays SILENT on the same bullet's 3.4% dilution + 70% share count: ${okDaPctNarrow ? '✓' : '✗'}`);
  console.log(`  [IMP-120] CO-PRESENCE IS NOT DERIVATION — Brent/WTI two-price two-percent bullet silent: ${okDaPctCoPresence ? '✓' : '✗'}`);
  console.log(`  [IMP-120] REAL 08-03 v2: $123.54 rides the critical rails, exactly 1 pct flag: ${okDaReal ? '✓' : '✗'}`);
  console.log(`  [IMP-120] REAL 08-03 v2: M&M-2 and Geo-1's correct figures stay off the rails: ${okDaRealScoped ? '✓' : '✗'}`);

  console.log(`  [IMP-116] FIRES on the title numeral "Ten": ${okHaTitle ? '✓' : '✗'}`);
  console.log(`  [IMP-116] FIRES on the watch-line anchor $84.67: ${okHaWatch ? '✓' : '✗'}`);
  console.log(`  [IMP-116] headline anchors ride the CRITICAL rails: ${okHaCritical ? '✓' : '✗'}`);
  console.log(`  [IMP-116] SILENT on a numberless title + a priceless watch line: ${okHaClean ? '✓' : '✗'}`);
  console.log(`  [IMP-116] the date line is never read as the title: ${okHaDateline ? '✓' : '✗'}`);
  console.log(`  [IMP-116] the Weekly's "July 5-11, 2026" range heading is not a title: ${okHaWeekRange ? '✓' : '✗'}`);
  console.log(`  [IMP-116] a bare YEAR in a title is not a claim ("The 2026 Problem"): ${okHaYear ? '✓' : '✗'}`);
  console.log(`  [IMP-116] EPOCH: a pre-2026-08-02 brief extracts nothing (the archive is read, not condemned): ${okHaEpoch ? '✓' : '✗'}`);
  console.log(`  [IMP-116] EPOCH: a WEEKLY (week id) extracts nothing: ${okHaWeekly ? '✓' : '✗'}`);
  console.log(`  [IMP-117] EPOCH: a pre-epoch brief extracts no byline claim: ${okByEpoch ? '✓' : '✗'}`);
  console.log(`  [IMP-116] SILENT on a bare calendar watch ("August 7 to 10"): ${okHaNoDate ? '✓' : '✗'}`);
  console.log(`  [IMP-116] REAL 08-02 v2: title "Ten" AND intro $84.67 both extract: ${okHaReal ? '✓' : '✗'}`);
  console.log(`  [IMP-117] FIRES on "Bloomberg's Colby Smith" (outlet+person pairing): ${okByFire ? '✓' : '✗'}`);
  console.log(`  [IMP-117] SILENT on "Kpler's daily series" (organisation, no person): ${okBySilentOrg ? '✓' : '✗'}`);
  console.log(`  [IMP-117] SILENT on "Bloomberg puts the residual…" (outlet, no possessive): ${okBySilentNoPossessive ? '✓' : '✗'}`);
  console.log(`  [IMP-117] SILENT on "Jim Bianco" (person, no outlet): ${okBySilentBarePerson ? '✓' : '✗'}`);
  console.log(`  [IMP-117] REAL 08-02 v2: fires on the Colby Smith pairing: ${okByReal ? '✓' : '✗'}`);

  const ok =
    okDaFire && okDaSilentSettledAt && okDaSilentMagnitude && okDaSilentDealSize &&
    okDaEpoch && okDaWeekly && okDaPctFire && okDaPctNarrow && okDaPctCoPresence &&
    okDaReal && okDaRealScoped &&
    okHaTitle && okHaWatch && okHaCritical && okHaClean && okHaDateline && okHaNoDate && okHaReal &&
    okHaWeekRange && okHaYear && okHaEpoch && okHaWeekly && okByEpoch &&
    okByFire && okBySilentOrg && okBySilentNoPossessive && okBySilentBarePerson && okByReal &&
    okFire && okSilentDated && okSilentFirst &&
    okFpFire && okFpNikkei && okFpSilentDated && okFpSilentFirst &&
    okMagWord && okMagSym &&
    okBindingsLoad && okEaFire && okEaSilent && okJgbFire && okJgbSilent &&
    okThFire && okThSilent && okThSourced && okThNominal && okThMixed && okThResolved &&
    okCalLoad && okEvFire && okEvSilent && okEvNoCal && okEvWrongDay &&
    okWtiAttrib && okToa && okToaNarrow &&
    okAggFire && okAggResolves && okAggSingle && okAggSilent13 &&
    okRelWorkFire && okRelPubSilentNY && okRelSynthFire && okRelSynthStable &&
    okRelSynthWatch && okRelSynthPoss && okRelSynthMarket &&
    okRegOk && okRegMalformed && okRegEmpty && okRegMissing && okRegBadRow && okRegRealHealthy &&
    okSchemaMissingKey && okSchemaBlankRe && okZeroWidthTerminates && okAisiFire && okAisiSilent &&
    okEcFire && okEcSilent && okEcReal && okEcPubResolvable &&
    okEdFire && okEdSilentDeadline && okEdSilentBare && okEdReal &&
    okScFireReal && okScUnresolvedReal && okScResolves && okScSilentBare && okScSilentMention &&
    okScNoStorm && okScInvFire && okScInvSilent && okScInvNoRow &&
    okAiFireMsft && okAiFireAtlas && okAiSilentHedgeMsft && okAiSilentPlanAtlas &&
    okAiSilentHedgeVerb && okAiSilentAnalysis && okAiSilentOther && okAiRealCorrected &&
    okYoyGmFire && okYoyStldFire && okYoyResolves && okYoySilentRatio && okYoySilentMove && okYoyScopeSignal && okYoyReal &&
    okCorpFire && okCorpSilentMacro && okCorpSilentBare && okCorpReal &&
    okSegFire && okSegSilentDisclosed &&
    okSmFire && okSmSilentYoy && okSmSilentIndex && okSmSilentName && okSmPrecise &&
    okTeShare && okTePeriod && okTeCmp && okTeScoped && okTeSilentOrdinary && okTeReal31 && okTeReal01 &&
    okEarnFire && okEarnResolves && okEarnSilentYoy && okEarnSilentGuidance && okEarnSilentMove && okEarnReal;
  if (ok) {
    console.log('\n✅ SELFTEST PASS — gate bites the 07-10/07-11/07-13 failures (reuse, transposition, entity misattribution, harmonize-to-published, release-date falsehood) and stays silent on the corrected/healthy cases — including its own two false positives.');
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  if (!okEvSilent) for (const f of evSilentFindings) console.error(`  unexpected event finding on the PUBLISHED 07-13 brief: ${f.message.slice(0, 200)}`);
  if (!okFpSilentDated) {
    for (const f of fpSilentDated) console.error(`  unexpected: ${f.message.slice(0, 160)}`);
  }
  if (!okEaSilent) for (const f of eaSilent) console.error(`  unexpected entity finding on the PUBLISHED brief: ${f.message.slice(0, 200)}`);
  if (!okThSilent) for (const f of thSilent) console.error(`  unexpected harmonization finding on 07-10 QG: ${f.message.slice(0, 160)}`);
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    process.exit(selftest());
  }
  const briefArg = args.find((a) => !a.startsWith('--'));
  const truthIdx = args.indexOf('--truth');
  const truthArg = truthIdx >= 0 ? args[truthIdx + 1] : null;
  const allowUnverified = args.includes('--allow-unverified');
  // --require-resolved (added 2026-07-10 — the MORNING TRUTH GATE mode; overrides --allow-unverified.
  // Receipt: the 07-10 brief published with truthFile:null and ALL 13 extracted claims UNVERIFIED —
  // "fact-gate PASS" meant "no contradictions found against nothing." In this mode the gate FAILS
  // unless (a) a truth file exists and (b) every critical market claim is verified PASS against it.
  // The Morning Updater writes {date}-truth.json from its refreshed market data, then runs this
  // mode; publish is blocked until it exits 0.)
  const requireResolved = args.includes('--require-resolved');
  const archiveDaysIdx = args.indexOf('--archive-days');
  const archiveDays = archiveDaysIdx >= 0 ? parseInt(args[archiveDaysIdx + 1], 10) || 14 : 14;

  if (!briefArg) {
    console.error('Usage: fact-gate.ts <brief.md> [--truth <truth.json>] [--allow-unverified] [--archive-days N]');
    console.error('       fact-gate.ts --selftest');
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) {
    console.error(`File not found: ${briefPath}`);
    process.exit(2);
  }
  const body = stripComments(fs.readFileSync(briefPath, 'utf8'));

  // Registry (zero-network). Resolve relative to repo root (script lives in scripts/).
  // IMP-064: loaded through loadRegistry so that missing/malformed/empty is a reported
  // STATE, not a silent `{ facts: [] }` that switches the office-holder layer off while
  // the gate keeps printing PASS.
  const factsReg = loadRegistry<any>('current-facts.json', 'current-facts.json', 'facts', briefPath);
  const registry: any = { facts: factsReg.rows };

  // Optional truth file. Default convention: daily-briefs/{date}-truth.json next to brief.
  // Weekly files ("2026-W27-jun-28-jul-04.md" / "2026-W27-light.md") carry a week id
  // instead of a date — without this fallback the ledger fell to cwd/factcheck.json
  // and the weekly chain produced no ledger at all (W27 gap, wired 2026-07-05).
  let truth: any = null;
  const dateMatch =
    path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/) ??
    path.basename(briefPath).match(/(\d{4}-W\d{1,2})/i);
  const briefDate = dateMatch ? dateMatch[1] : null;
  // Truth-file search path. The PUBLISHED file lives in content/daily-updates/(weekly/), but the
  // truth ledger is written into daily-briefs/(weekly/) — so a published weekly resolved to NO truth
  // file and rode unverified. Receipt (IMP-037, 2026-07-12): W28 reached Sunday morning with
  // truthFile:null and 13 unverified claims; "fact-gate PASS" meant "no contradictions vs nothing" —
  // the exact 07-10 receipt, reproduced in the weekly lane one day after it was closed in the daily
  // lane. The weekly now gets the daily's truth floor: --require-resolved hard-fails a Weekly whose
  // {week-id}-truth.json does not exist. (IMP-040)
  const truthCandidates = briefDate
    ? [
        path.join(path.dirname(briefPath), `${briefDate}-truth.json`),
        path.join(process.cwd(), 'daily-briefs', 'weekly', `${briefDate}-truth.json`),
        path.join(process.cwd(), 'daily-briefs', `${briefDate}-truth.json`),
      ]
    : [];
  const defaultTruth = truthCandidates.find((p) => fs.existsSync(p)) ?? null;
  const truthPath = truthArg
    ? (path.isAbsolute(truthArg) ? truthArg : path.join(process.cwd(), truthArg))
    : defaultTruth;
  if (truthPath && fs.existsSync(truthPath)) truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));

  const findings: Finding[] = [];

  // 1. Office-holders
  const office = checkOfficeHolders(body, registry);
  findings.push(...office.findings);

  // 2. Extract market claims
  const claims = extractClaims(body);

  // 3. Extract superlatives (claims of extreme)
  const superlatives = extractSuperlatives(body);

  // 3b. Scheduled-event dates (IMP-044). "CPI lands in this session" is a fact with a
  // primary source; until 07-13 nothing in the chain extracted it, let alone checked it.
  const calendar = loadEventCalendar(briefPath);
  const eventScan = scheduledEventClaims(body, calendar, briefDate);
  const eventClaims = eventScan.claims;
  findings.push(...eventScan.findings);
  // The Morning Truth Gate records a verified release date under `event:<id>`.
  for (const e of eventClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3c. Aggregate claims (IMP-056). "Combined $X across A, B, C, up Y%" is load-bearing and
  // rode to publish unextracted on 07-15. Extract it as a CRITICAL claim on the same rails,
  // resolved under `aggregate:<magnitude>` against an INDEPENDENT aggregate source.
  const aggClaims = aggregateClaims(body, briefDate);
  for (const a of aggClaims) if (truth?.claims?.[a.key]) a.status = 'PASS';

  // 3d. Entity-count + regulatory effective-date (IMP-069, the 07-18 Critic's mandate #1). "470-store
  // regional grocer" and "the framework takes effect today" were load-bearing, checkable in one fetch,
  // and UNGATED — three consecutive briefs shipped a confirmed factual error to v2. Both extract as
  // CRITICAL claims on the unresolved-before-publish rails and resolve under their own truth key.
  const entityCounts = entityCountClaims(body, briefDate);
  for (const e of entityCounts) if (truth?.claims?.[e.key]) e.status = 'PASS';
  const effectiveDates = effectiveDateClaims(body, briefDate);
  for (const e of effectiveDates) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3d-bis. SOURCE CONCLUSIONS (IMP-143 — the 08-07 mandate #2, re-prescribed 08-08 as #2a after
  // it vanished without code, row or deferral). A bullet leaning on a named source's report/study/
  // talk must record that source's OWN conclusion; unresolved blocks at the Morning Truth Gate,
  // and a resolved row whose conclusion the brief NEGATES is a hard finding.
  const sourceConclusions = sourceConclusionClaims(body, briefDate);
  for (const e of sourceConclusions) if (truth?.claims?.[e.key]) e.status = 'PASS';
  findings.push(...sourceConclusionInversions(
    sourceConclusions,
    truth?.claims as Record<string, { conclusion?: string; resolved?: boolean }> | undefined,
  ));

  // 3e. AI&T definite-product / deployment claims (IMP-074, the 07-19 Critic's mandate #1). "Microsoft
  // announced Project Perception" (reportedly-developing) and "the deployment of Atlas robots" (none
  // deployed) shipped to v2 un-gated — the AI&T section has no pre-draft and no fact rail. A definite,
  // unhedged product/deployment assertion becomes a CRITICAL claim resolved under `ai-product:<slug>`.
  const aiProducts = aiProductClaims(body, briefDate);
  for (const e of aiProducts) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3f. YoY-comparison claims (IMP-081, the 07-21 Critic's mandate #1). GM's "$45.96 billion in
  // revenue, roughly 22% above last year" was a FABRICATED delta (Q2'25 was $47.1B → DOWN ~2.4%)
  // that the morning reconcile missed and PUBLISHED. A financial magnitude + a prior-year referent
  // + a percentage is a CRITICAL claim resolved under `yoy:<slug>` against the prior-year actual.
  const yoyClaims = yoyComparisonClaims(body, briefDate);
  for (const e of yoyClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3g. Earnings-result vs consensus (IMP-086, the 07-22 Critic's mandate #1). EQT's "$2.56B against
  // a $1.84B consensus, a 39% beat … EPS $0.45 versus $0.41 expected" was FABRICATED (actual: revenue
  // $1.81B, EPS $0.39 MISSED) — a beat↔miss sign reversal that reached v2 and was caught only by the
  // morning read. A metric + $ + (an expectation referent OR a beat/miss verb) in M&M/C&C/AI&T is a
  // CRITICAL claim resolved under `earnings:<slug>` against the company's own release. Also the
  // reader-facing gate for a stale pre-draft consumed as an actual (E-PREDRAFT-STALE-DATA-01).
  const earningsClaims = earningsResultClaims(body, briefDate);
  for (const e of earningsClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3h. HEADLINE ANCHORS (IMP-116, the 08-02 Critic's mandate #1). The Daily Title numeral and the
  // Intro's watch-line price are the two strings a reader is guaranteed to see, and the asset-lexicon
  // extraction surface could not see either. Load-bearing by construction → CRITICAL, resolved under
  // `headline:<slug>`. RESOLVE-FIRST at the morning gate: a wrong title cannot be fixed after publish.
  const headlineClaims = headlineAnchorClaims(body, briefDate);
  for (const e of headlineClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3i. BYLINE PAIRINGS (IMP-117, the 08-02 Critic's mandate #3). "Bloomberg's Colby Smith" — the
  // reporter is the NYT's. A checkable pairing that no number-shaped check can see; the 07-10
  // transposition class applied to attribution. CRITICAL, resolved under `byline:<slug>`.
  const bylineClaims = bylineAttributionClaims(body, briefDate);
  for (const e of bylineClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3j. DERIVED ARITHMETIC (IMP-120, the 08-03 Critic's mandate #1). A price the bullet COMPUTES
  // FROM is load-bearing regardless of whether the archive knows the asset — the arithmetic is the
  // warrant, not the ticker. C&C-1 ran a dilution ladder off a $123.54 close that was $108.37.
  const derivedClaims = derivedArithmeticClaims(body, briefDate);
  for (const e of derivedClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 4. Archive backstop (zero-network): disprove false superlatives + flag price fabrications.
  const archive = loadArchive(briefPath, briefDate, archiveDays);
  const archiveAssetsKnown = Object.keys(archive).length;
  const briefPrices = assetValuesIn(body);
  findings.push(...archiveBackstop(superlatives, briefPrices, archive));

  // 4b. Dramatic-event reuse (zero-network): yesterday's halt as today's Overnight.
  findings.push(...dramaticEventReuse(body, briefPath, briefDate));

  // 4c. Story-fingerprint reuse (zero-network): 3-day-old % moves restated as fresh.
  findings.push(...storyFingerprintReuse(body, briefPath, briefDate));

  // 4d. Entity attribution (zero-network): right number, WRONG entity — the 07-10 JGB
  // transposition and the 07-11 BlackRock/BCRED class. No number-shaped check can see these.
  const bindReg = loadRegistry<Binding>('entity-bindings.json', 'entity-bindings.json', 'bindings', briefPath);
  findings.push(...entityAttribution(body, bindReg.rows, bindReg.health));

  // 4d-i. REGISTRY INTEGRITY (IMP-064) — the premise layer must prove it loaded. A
  // registry that is missing, malformed, empty, or carrying unusable rows silently
  // disables the only checks that read the SUBJECT of a claim, and the gate would
  // otherwise report PASS on premises nobody verified. Nothing checks the checker;
  // now something does. Evaluated AFTER entityAttribution so bad rows are counted.
  findings.push(...registryFindings([bindReg.health, factsReg.health]));

  // 4e. Truth-harmonization guard (QG log): the gate that manufactured a falsehood by
  // "aligning" a true draft figure to a false published one. A published number is a claim.
  findings.push(...truthHarmonization(findQgLog(briefPath, briefDate), briefDate));

  // 4f. Relative-date referent (IMP-058): a past-relative word ("yesterday", "overnight", …)
  // on a dated EVENT shifts its referent between the evening write and the morning read. The
  // 07-16 "Yesterday New York became the first state to ban…" was an EO signed two days earlier.
  // Advisory — the Morning Truth Gate resolves it; the brief always ships.
  findings.push(...relativeDateFindings(body, briefDate));

  // 4g. Corporate scheduled-event weekday (IMP-082): "AMD opens its conference Tuesday" (a Wed-Thu
  // event) — a company earnings/conference date pinned to a weekday, checkable in one fetch. Advisory;
  // the Morning Truth Gate confirms the absolute date and rewrites the weekday if wrong.
  findings.push(...corporateEventDateFindings(body, briefDate));

  // 4h. Segment-metric attribution (IMP-083): "AMD's data-center GPU revenue, $7.7 billion" — a
  // compound segment+chip line AMD does not disclose, shipped as if it were a reported metric.
  // Advisory; the Morning Truth Gate confirms the line is reported or the figure is labeled/sourced.
  findings.push(...segmentMetricFindings(body, briefDate));
  findings.push(...stockMoveReactionFindings(body, briefDate)); // IMP-101 (restored)
  findings.push(...takeExtraordinaryFindings(body, briefDate)); // IMP-115
  // IMP-120 leg (b): the offline half — a bullet that contradicts its own printed prices.
  findings.push(...derivedPercentageFindings(body, briefDate));

  // 5. Truth cross-check (if truth present)
  if (truth) findings.push(...crossCheck(claims, truth));

  // 6. Unverified-critical gate (market + scheduled-event claims; superlatives are flagged for
  // verification, not blocked here). Event claims join the critical rails deliberately: a
  // same-session release-date assertion is exactly as load-bearing as a price, and on 07-13 it
  // was more so — it was a section's entire premise.
  const unverifiedCritical = [...claims, ...eventClaims, ...aggClaims, ...entityCounts, ...effectiveDates, ...aiProducts, ...yoyClaims, ...earningsClaims, ...headlineClaims, ...bylineClaims, ...derivedClaims, ...sourceConclusions].filter((c) => c.tier === 'critical' && c.status === 'UNVERIFIED');
  if (!allowUnverified) {
    for (const c of unverifiedCritical) {
      findings.push({
        check: 'unverified-critical',
        severity: 'FAIL',
        message: `CRITICAL claim not verified against ground truth — ${c.asset} "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''} (${c.section}). No truth entry. "No number from memory": verify it and record {date}-truth.json, or pass --allow-unverified for a dry run.`,
      });
    }
  }

  // 6b. TRUTH BYPASS accounting (added 2026-07-10). A missing truth file with critical claims on
  // board means the gate verified NOTHING — that state must be LOUD in every mode, and it must
  // BLOCK in --require-resolved mode. Unverified ≠ verified; an empty truth source is an
  // infrastructure failure, not a clean pass. (07-10 receipt: 6 market claims + 7 superlatives,
  // 0 pass / 0 fail / 13 unverified, truthFile null → published. Among them: the 30Y-JGB
  // superlative that was actually the 10Y's record — right number, wrong asset.)
  const truthBypass = !truth && (claims.length > 0 || superlatives.length > 0 || eventClaims.length > 0 || aggClaims.length > 0 || entityCounts.length > 0 || effectiveDates.length > 0 || aiProducts.length > 0 || yoyClaims.length > 0 || earningsClaims.length > 0 || headlineClaims.length > 0 || bylineClaims.length > 0 || derivedClaims.length > 0 || sourceConclusions.length > 0);
  if (truthBypass) {
    findings.push({
      check: 'truth-bypass',
      severity: requireResolved ? 'FAIL' : 'FLAG',
      message: `TRUTH BYPASS — no truth file loaded; ${claims.length} market claim(s) + ${superlatives.length} superlative(s) ride entirely unverified. The gate has verified NOTHING about this brief. Before publish, the Morning Updater must write {BRIEF_DATE}-truth.json from refreshed market data and re-run with --require-resolved. Verify the ASSET as well as the number — the 07-10 failure was a transposition (the 10Y JGB's record attributed to the 30Y), which a number-only re-check cannot catch.`,
    });
  }
  if (requireResolved) {
    for (const c of unverifiedCritical) {
      findings.push({
        check: 'unresolved-before-publish',
        severity: 'FAIL',
        message: `MORNING TRUTH GATE — critical claim still unverified at publish time: ${c.asset} "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''} (${c.section}). Verify against the refreshed tape and record it in {BRIEF_DATE}-truth.json, correct the sentence, or strip the number. Do not publish a critical number nobody checked.`,
      });
    }
  }

  const allClaims = [...claims, ...superlatives, ...eventClaims, ...aggClaims, ...entityCounts, ...effectiveDates, ...aiProducts, ...yoyClaims, ...earningsClaims, ...headlineClaims, ...bylineClaims, ...derivedClaims, ...sourceConclusions];

  // Ledger output (the worklist the editorial agents clear by verify-and-correct).
  const ledger = {
    brief: path.basename(briefPath),
    generated: new Date().toISOString(),
    truthFile: truthPath ? path.basename(truthPath) : null,
    summary: {
      claims: claims.length,
      superlatives: superlatives.length,
      scheduledEvents: eventClaims.length,
      aggregates: aggClaims.length,
      entityCounts: entityCounts.length,
      effectiveDates: effectiveDates.length,
      aiProducts: aiProducts.length,
      earnings: earningsClaims.length,
      headlineAnchors: headlineClaims.length, // IMP-116
      bylines: bylineClaims.length,           // IMP-117
      derivedPrices: derivedClaims.length,    // IMP-120
      sourceConclusions: sourceConclusions.length,   // IMP-143
      pass: allClaims.filter((c) => c.status === 'PASS').length,
      fail: allClaims.filter((c) => c.status === 'FAIL').length,
      unverified: allClaims.filter((c) => c.status === 'UNVERIFIED').length,
      officeHolderFacts: office.checked,
      archiveAssetsKnown,
      truthBypass,
      unresolvedCritical: unverifiedCritical.length,
      // IMP-064: the premise layer's proof of life, on the record in every ledger.
      registries: [bindReg.health, factsReg.health].map((h) => ({
        name: h.name, state: h.state, rows: h.rows, badRows: h.badRows,
      })),
      registryBlind: [bindReg.health, factsReg.health].some(
        (h) => h.state !== 'ok' || h.badRows.length > 0,
      ),
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
  console.log(`  market claims: ${claims.length} · superlatives: ${superlatives.length} · scheduled events: ${eventClaims.length} · aggregates: ${aggClaims.length} · entity-counts: ${entityCounts.length} · effective-dates: ${effectiveDates.length} · ai-products: ${aiProducts.length} · earnings: ${earningsClaims.length} · headline-anchors: ${headlineClaims.length} · bylines: ${bylineClaims.length} · derived-prices: ${derivedClaims.length} · source-conclusions: ${sourceConclusions.length} (${ledger.summary.pass} pass, ${ledger.summary.fail} fail, ${ledger.summary.unverified} unverified)`);
  console.log(`  archive: ${archiveAssetsKnown} assets known from our last ${archiveDays} briefs`);
  console.log(`  truth file: ${truthPath ? path.basename(truthPath) : 'NONE (critical claims will block unless --allow-unverified)'}`);
  // IMP-064: the premise layer states its own health on every run. A silent registry
  // is how a truth gate goes blind while reporting PASS.
  console.log(`  premise registries: ${[bindReg.health, factsReg.health].map((h) =>
    `${h.name} ${h.state === 'ok' && !h.badRows.length ? `${h.rows} rows ✓` : `${h.state.toUpperCase()}${h.badRows.length ? ` +${h.badRows.length} bad row(s)` : ''} ✗`}`,
  ).join(' · ')}`);
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
