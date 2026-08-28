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
  claimType?:
    | 'market'
    | 'superlative'
    | 'event'
    | 'aggregate'
    | 'entity-count'
    | 'effective-date'
    | 'ai-product'
    | 'yoy'
    | 'headline'
    | 'byline'
    | 'source-conclusion';
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
  {
    key: 'sp500_futures',
    asset: 'S&P 500 futures',
    tier: 'critical',
    re: /S&P\s*500\s*futures|S&P\s*futures|ES\s*futures/gi,
  },
  {
    key: 'nasdaq_futures',
    asset: 'Nasdaq 100 futures',
    tier: 'critical',
    re: /Nasdaq(?:\s*100)?\s*futures|NQ\s*futures/gi,
  },
  {
    key: 'dow_futures',
    asset: 'Dow futures',
    tier: 'critical',
    re: /\bDow(?:\s*Jones)?\s*futures\b/gi,
  },
  {
    key: 'sp500',
    asset: 'S&P 500',
    tier: 'critical',
    re: /S&P\s*500(?!\s*futures)/gi,
  },
  {
    key: 'nasdaq',
    asset: 'Nasdaq',
    tier: 'critical',
    re: /\bNasdaq\b(?!\s*(?:100\s*)?futures)/gi,
  },
  {
    key: 'dow',
    asset: 'Dow',
    tier: 'standard',
    re: /\bDow(?:\s*Jones)?\b(?!\s*futures)/gi,
  },
  {
    key: 'russell',
    asset: 'Russell 2000',
    tier: 'standard',
    re: /Russell\s*2000/gi,
  },
  { key: 'kospi', asset: 'Kospi', tier: 'standard', re: /Kospi/gi },
  {
    key: 'hang_seng',
    asset: 'Hang Seng',
    tier: 'standard',
    re: /Hang\s*Seng/gi,
  },
  {
    key: 'ust10',
    asset: '10-year yield',
    tier: 'critical',
    re: /10-?year(?:\s*yield)?|10Y|10-?yr/gi,
  },
  {
    key: 'brent',
    asset: 'Brent crude',
    tier: 'standard',
    re: /Brent(?:\s*crude)?/gi,
  },
  {
    key: 'wti',
    asset: 'WTI',
    tier: 'standard',
    re: /WTI|West\s*Texas|\bcrude\b|\boil\b/gi,
  },
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

const UP_WORDS = [
  'up',
  'rose',
  'rises',
  'rising',
  'gained',
  'gains',
  'surged',
  'surges',
  'jumped',
  'jumps',
  'climbed',
  'climbs',
  'rallied',
  'rallies',
  'advanced',
  'advances',
  'higher',
  'soared',
  'popped',
  'rebounded',
  'recovers',
  'recovering',
];
const DOWN_WORDS = [
  'down',
  'fell',
  'falls',
  'falling',
  'lost',
  'loses',
  'dropped',
  'drops',
  'plunged',
  'plunges',
  'crashed',
  'crashes',
  'sank',
  'sinks',
  'slid',
  'slides',
  'declined',
  'declines',
  'lower',
  'tumbled',
  'tumbles',
  'slumped',
  'sold off',
  'selloff',
  'sell-off',
];

// Superlative / claim-of-extreme detector. Each alternate is a phrase that
// ASSERTS an extreme — the class the gold "new highs" error belonged to and
// that nothing in the pipeline verified.
const SUPERLATIVE_RE = new RegExp(
  [
    'new\\s+(?:record\\s+)?(?:highs?|lows?)',
    'record\\s+(?:highs?|lows?|\\$?\\d)',
    'all[-\\s]?time\\s+(?:highs?|lows?)',
    '(?:multi[-\\s]?(?:year|month|week|decade)|\\d+[-\\s]?(?:year|month|week|day|session))[-\\s]?(?:highs?|lows?)',
    "(?:this\\s+)?(?:week|month|year|session|quarter)(?:[’']s)?\\s+(?:highs?|lows?)",
    'highest\\b',
    'lowest\\b',
    '(?:most|fewest|biggest|largest|smallest|strongest|weakest|fastest|slowest)\\s+since',
    'first\\s+time\\s+since',
    'never\\s+(?:been|seen)\\b',
  ].join('|'),
  'gi'
);

// Terms of art that CONTAIN a superlative word but assert nothing empirical, so no archive
// or primary source can adjudicate them. Every entry requires a RECEIPT — a real false
// positive on a real brief — because a suppression list is how a truth gate goes blind.
//   2026-07-13 (IMP-045): "the highest-and-best use of that land has shifted to AI
//   infrastructure" (Prologis/Segro bullet) was extracted as a market superlative and sent
//   to the Morning Truth Gate as a claim to verify. It is a real-estate term of art. A gate
//   that hands the operator a worklist of non-claims is training them to skim the worklist —
//   which is the same failure as the 133%-overlap validator (IMP-042), one day earlier.
const SUPERLATIVE_TERM_OF_ART: RegExp[] = [/highest[-\s]?and[-\s]?best\s+use/i];

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
  return body
    .slice(start, end + 1)
    .replace(/\s+/g, ' ')
    .trim();
}

// "%" or the word "percent"/"pct" — editorial prose almost always uses the word.
// Do NOT put \b after "%" — "%" is non-word, so \b fails before a space/end.
const PCT_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/i;

function detectDirection(window: string): {
  dir: 'up' | 'down' | 'unknown';
  mag: number | null;
} {
  const lower = window.toLowerCase();
  // Signed percent takes priority if explicit.
  const signed = window.match(
    /([+−-])\s*(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/i
  );
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
        const re = new RegExp(
          `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        );
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
  const overlaps = (s: number, e: number) =>
    consumed.some(([a, b]) => s < b && e > a);

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
  if (/\bsince\b/.test(p) || /first\s+time/.test(p) || /\bnever\b/.test(p))
    return 'other';
  // No \b after the root so plurals match ("highs", "lows", "highest").
  if (/high|record|all-?time|most|biggest|largest|strongest|fastest/.test(p))
    return 'high';
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
    const toaCtx = body.slice(
      Math.max(0, idx - 5),
      Math.min(body.length, idx + 40)
    );
    if (SUPERLATIVE_TERM_OF_ART.some(re => re.test(toaCtx))) continue;
    const sentence = sentenceAround(body, idx);
    // Which asset is this extreme about? The asset mention CLOSEST to the phrase
    // by character distance — a Dashboard line packs several assets into one
    // sentence, so "nearest in sentence" mis-attributes (it tagged gold's high to
    // the 10-year). Search a tight window and pick the minimum-distance asset.
    const winBase = Math.max(0, idx - 70);
    const win = body.slice(
      winBase,
      Math.min(body.length, idx + phrase.length + 20)
    );
    const phraseRel = idx - winBase;
    let assetKey: string | null = null;
    let assetName: string | null = null;
    let best = Infinity;
    for (const a of ASSETS) {
      a.re.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = a.re.exec(win)) !== null) {
        const dist = Math.abs(mm.index - phraseRel);
        if (dist < best) {
          best = dist;
          assetKey = a.key;
          assetName = a.asset;
        }
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
      key: assetKey
        ? `superlative:${assetKey}`
        : `superlative:${phrase.toLowerCase().replace(/[^a-z]+/g, '-')}`,
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
function valueNearAttributed(
  text: string,
  fromIdx: number,
  span: number,
  selfKey: string
): number | null {
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
      if (v != null && v >= band[0] && v <= band[1]) {
        out[a.key] = v;
        break;
      }
    }
  }
  return out;
}

interface ArchivePoint {
  date: string;
  value: number;
}
function loadArchive(
  briefPath: string,
  briefDate: string | null,
  days: number
): Record<string, ArchivePoint[]> {
  const dir = findArchiveDir(briefPath);
  const archive: Record<string, ArchivePoint[]> = {};
  if (!dir) return archive;
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return archive;
  }
  const dated = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)) // exclude -light
    .map(f => ({ f, d: f.slice(0, 10) }))
    .filter(x => (briefDate ? x.d < briefDate : true)) // strictly prior briefs; never self
    .sort((a, b) => (a.d < b.d ? 1 : -1)) // newest first
    .slice(0, days);
  for (const { f, d } of dated) {
    let txt: string;
    try {
      txt = fs.readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue;
    }
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
  if (/\bTAKE\b/i.test(section))
    return ' LOAD-BEARING (Take premise): if wrong, REGENERATE the Take from scratch — the framework was built on it; do not just swap the number.';
  return ' If load-bearing (the section thesis/lede), REWRITE the section on a verified premise; patch or strike only if incidental.';
}

// ---------------------------------------------------------------------------
// Dramatic-event reuse (zero-network). Catches "yesterday's halt as today's Overnight."
// ---------------------------------------------------------------------------
// Require an ACTIVATION (triggered/tripped/activated…), not the bare mechanism noun
// (07-06 Take said "blunted by … circuit breakers" as structure — that must stay silent).
const DRAMATIC_EVENT_RE = new RegExp(
  [
    '(?:triggered|tripped|activated|issued|hit)\\b[^.\\n]{0,60}circuit\\s+breaker',
    'circuit\\s+breaker\\b[^.\\n]{0,60}(?:triggered|tripped|activated|issued|hit)',
    '(?:trading\\s+halt|halt(?:ed|ing)\\s+(?:trade|trading)(?:\\s+for)?)',
    '(?:buy|sell)[- ]?side\\s+sidecar\\s+(?:was\\s+)?(?:triggered|activated|issued)',
    '(?:triggered|activated|issued)\\b[^.\\n]{0,40}(?:buy|sell)[- ]?side\\s+sidecar',
  ].join('|'),
  'gi'
);

const VENUE_PATTERNS: { key: string; re: RegExp }[] = [
  {
    key: 'kospi',
    re: /\bKOSPI\b|\bKospi\b|South\s+Korea(?:'s)?|Korea(?:'s)?\s+(?:KOSPI|market|bourse)/i,
  },
  { key: 'nikkei', re: /\bNikkei\b/i },
  { key: 'hang_seng', re: /\bHang\s+Seng\b/i },
  { key: 'shanghai', re: /\bShanghai\b|\bCSI\s*300\b/i },
  { key: 'nyse', re: /\bNYSE\b|\bNew\s+York\s+Stock\s+Exchange\b/i },
  { key: 'nasdaq', re: /\bNasdaq\b/i },
];

// Explicit past-date anchors that make a recycled event legitimate history, not Overnight news.
const PAST_DATE_ANCHOR_RE =
  /\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:'s)?\s+(?:close|session|selloff|rout|crash|halt|plunge)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b|\byesterday\b|\bearlier\s+this\s+week\b|\blast\s+(?:tuesday|wednesday|thursday|friday|monday|week)\b/i;

function venueNear(text: string, idx: number, radius = 220): string | null {
  const start = Math.max(0, idx - radius);
  const window = text.slice(start, Math.min(text.length, idx + radius));
  for (const v of VENUE_PATTERNS) {
    if (v.re.test(window)) return v.key;
  }
  return null;
}

function extractDramaticEvents(body: string): {
  venue: string;
  idx: number;
  sentence: string;
  section: string;
  pastDated: boolean;
}[] {
  const out: {
    venue: string;
    idx: number;
    sentence: string;
    section: string;
    pastDated: boolean;
  }[] = [];
  DRAMATIC_EVENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DRAMATIC_EVENT_RE.exec(body)) !== null) {
    const venue = venueNear(body, m.index);
    if (!venue) continue;
    const sentence = sentenceAround(body, m.index);
    const section = sectionOf(body, m.index);
    const ctx = body.slice(
      Math.max(0, m.index - 120),
      Math.min(body.length, m.index + m[0].length + 160)
    );
    out.push({
      venue,
      idx: m.index,
      sentence,
      section,
      pastDated:
        PAST_DATE_ANCHOR_RE.test(sentence) || PAST_DATE_ANCHOR_RE.test(ctx),
    });
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

/** FAIL when a dramatic halt/breaker is presented as fresh but already shipped recently. */
function dramaticEventReuse(
  body: string,
  briefPath: string,
  briefDate: string | null,
  lookbackDays = 5
): Finding[] {
  const findings: Finding[] = [];
  const current = extractDramaticEvents(body).filter(e => !e.pastDated);
  if (!current.length || !briefDate) return findings;

  const dir = findArchiveDir(briefPath);
  if (!dir) return findings;
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return findings;
  }

  const priors = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => ({ f, d: f.slice(0, 10) }))
    .filter(
      x => x.d < briefDate && daysBetween(x.d, briefDate) <= lookbackDays
    );

  for (const ev of current) {
    if (findings.some(f => f.message.startsWith(`${ev.venue} `))) continue; // one FAIL per venue
    for (const { f, d } of priors) {
      let priorTxt: string;
      try {
        priorTxt = fs.readFileSync(path.join(dir, f), 'utf8');
      } catch {
        continue;
      }
      const priorHits = extractDramaticEvents(priorTxt).filter(
        p => p.venue === ev.venue
      );
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
  ...ASSETS.filter(a =>
    [
      'kospi',
      'hang_seng',
      'nasdaq',
      'sp500',
      'dow',
      'russell',
      'btc',
      'eth',
      'gold',
      'wti',
      'brent',
    ].includes(a.key)
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
      const ctx = body.slice(
        Math.max(0, start - 120),
        Math.min(body.length, end + 160)
      );
      const pastDated =
        PAST_DATE_ANCHOR_RE.test(sentence) || PAST_DATE_ANCHOR_RE.test(ctx);
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
    if (!isNaN(la) && !isNaN(lb) && la >= 100 && Math.abs(la - lb) / la < 0.002)
      return true;
  }
  return false;
}

/** FAIL when a material % move is presented as fresh but already shipped within ~3 days. */
function storyFingerprintReuse(
  body: string,
  briefPath: string,
  briefDate: string | null,
  lookbackDays = 3
): Finding[] {
  const findings: Finding[] = [];
  const current = extractStoryFingerprints(body).filter(e => !e.pastDated);
  if (!current.length || !briefDate) return findings;

  const dir = findArchiveDir(briefPath);
  if (!dir) return findings;
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return findings;
  }

  const priors = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map(f => ({ f, d: f.slice(0, 10) }))
    .filter(
      x => x.d < briefDate && daysBetween(x.d, briefDate) <= lookbackDays
    );

  for (const fp of current) {
    if (
      findings.some(
        f =>
          f.check === 'story-fingerprint-reuse' &&
          f.message.startsWith(`${fp.asset} `)
      )
    )
      continue;
    for (const { f, d } of priors) {
      let priorTxt: string;
      try {
        priorTxt = fs.readFileSync(path.join(dir, f), 'utf8');
      } catch {
        continue;
      }
      const priorHits = extractStoryFingerprints(priorTxt).filter(p =>
        fingerprintsMatch(fp, p)
      );
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
type CalEvent = {
  id: string;
  event: string;
  referenceMonth?: string;
  releaseDate: string;
  timeET?: string;
  source: string;
};

const SCHEDULED_EVENTS: { id: string; label: string; re: RegExp }[] = [
  {
    id: 'cpi',
    label: 'CPI',
    re: /\bCPI\b|consumer price index|inflation (?:print|report|release|number)/i,
  },
  { id: 'ppi', label: 'PPI', re: /\bPPI\b|producer price index/i },
  { id: 'pce', label: 'PCE', re: /\bPCE\b|personal consumption expenditures/i },
  {
    id: 'payrolls',
    label: 'the payrolls report',
    re: /\bNFP\b|nonfarm payrolls|non-farm payrolls|jobs report|employment report/i,
  },
  {
    id: 'fomc',
    label: 'the FOMC decision',
    re: /\bFOMC\b|Fed(?:eral Reserve)?\s+(?:rate\s+)?(?:decision|meeting|minutes)|rate decision/i,
  },
  {
    id: 'gdp',
    label: 'the GDP print',
    re: /\bGDP\s+(?:print|report|release|data)\b|gross domestic product/i,
  },
  {
    id: 'retail_sales',
    label: 'retail sales',
    re: /retail sales (?:print|report|release|data)/i,
  },
  {
    id: 'jobless_claims',
    label: 'jobless claims',
    re: /jobless claims|initial claims/i,
  },
];

// The load-bearing, falsifiable-today class: the print lands in THIS session.
const SAME_SESSION_RE =
  /\b(?:lands?|arrives?|prints?|drops?|hits? the tape|is out|comes? out)\s+(?:today|this (?:morning|session))\b|\b(?:today|this session)(?:['’]s)?\s+(?:\w+\s+){0,2}(?:print|release|report)\b|\bin the same session\b|\barriv\w*\s+simultaneously\b|\bland\s+in\s+the\s+same\s+session\b|\bsame session\b/i;
const RELEASE_VERB_RE =
  /\b(?:lands?|arrives?|prints?|drops?|is (?:released|out)|comes? out|hits? the tape)\b/i;
const TOMORROW_RE = /\btomorrow\b/i;
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function loadEventCalendar(briefPath: string): CalEvent[] {
  for (const p of [
    path.join(process.cwd(), 'system', 'event-calendar.json'),
    path.join(path.dirname(briefPath), '..', 'system', 'event-calendar.json'),
  ]) {
    try {
      if (fs.existsSync(p))
        return (JSON.parse(fs.readFileSync(p, 'utf8')).events ??
          []) as CalEvent[];
    } catch {
      /* a malformed calendar must not take the brief down; the (b) leg still blocks */
    }
  }
  return [];
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function scheduledEventClaims(
  body: string,
  calendar: CalEvent[],
  briefDate: string | null
): { claims: Claim[]; findings: Finding[] } {
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
        .filter(
          c => c.id === ev.id && (!briefDate || c.releaseDate >= briefDate)
        )
        .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))[0];

      // What date does the SENTENCE assert? Only three forms are unambiguous enough to
      // adjudicate mechanically; anything else is left to the (b) leg.
      let assertedDate: string | null = null;
      if (sameSession && briefDate) assertedDate = briefDate;
      else if (TOMORROW_RE.test(text) && briefDate)
        assertedDate = addDays(briefDate, 1);

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
        const wd = WEEKDAYS.findIndex(d =>
          new RegExp(`\\b${d}\\b`, 'i').test(text)
        );
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
const AGGREGATE_CONNECTIVE_RE =
  /\b(?:combined|in aggregate|collectively|between them|all told|taken together)\b/i;
const AGG_MONEY_RE =
  /(?:\$|USD\s*)\s?\d[\d,.]*\s*(?:trillion|billion|million|tn\b|bn\b|mn\b)/i;
const AGG_METRIC_RE =
  /\b(?:net income|profits?|earnings|revenues?|premiums?|deposits|assets under management|sales|income|payouts?|buybacks?|dividends?)\b/i;
const AGG_GROUP_RE =
  /\bthe\s+(?:two|three|four|five|six|seven|eight|nine|ten|top\s+\w+|largest|biggest)\s+(?:[\w.-]+\s+){0,3}(?:banks?|lenders?|firms?|hyperscalers?|labs?|companies|carriers?|insurers?|automakers?|majors?|players?|producers?|retailers?|airlines?|utilities|miners?|telecoms?)\b/i;
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
const FOOTPRINT_NOUN =
  'stores?|supermarkets?|locations?|branches|outlets?|restaurants?|dealerships?|warehouses?|plants?|sites?|factories|hotels?|clinics?|hospitals?|dealers?';
const ENTITY_COUNT_RE = new RegExp(
  `\\b(\\d{1,3}(?:,\\d{3})+|\\d{2,})[-\\s]?(${FOOTPRINT_NOUN})\\b`,
  'i'
);

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
const EFFECTIVE_VERB_RE =
  /\b(?:takes?\s+effect|took\s+effect|go(?:es)?\s+into\s+effect|went\s+into\s+effect|com(?:es|ing)?\s+into\s+force|came\s+into\s+force|becomes?\s+effective|became\s+effective|is\s+now\s+in\s+force|effective\s+(?:date|today|immediately|as\s+of))\b/i;
const REG_NOUN_RE =
  /\b(?:act|law|rule|regulations?|directive|mandate|framework|statute|ordinance|ban|tariffs?|provision|requirement|standard|amendment|bill)\b/i;

function effectiveDateClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    if (!EFFECTIVE_VERB_RE.test(text)) continue;
    if (!REG_NOUN_RE.test(text)) continue;
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 44);
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
// NAMED-STATUTE THRESHOLD CHECK (IMP-189 — the 08-17 Critic's mandate #1, RC2).
//
// WORKED FAILURE. 08-17 AI&T-1 shipped: "California's SB 53 exempts any company below $500 million
// in revenue OR MODEL TRAINING COSTS from coverage at all." Two errors in one clause, and the
// unit's whole conclusion rested on them: the $500M test is ANNUAL GROSS REVENUE ONLY ("model
// training costs" is an SB 1047 criterion, a different bill), and it SORTS DUTIES rather than gating
// coverage — coverage is the 10^26 FLOP frontier-model definition. The dependent sentence, "Every
// firm deploying the same agents below it owes no disclosure to anyone", was false on the same
// ground. Every gate passed: the numeral $500 million is real, it is simply attached to the wrong
// test in the wrong bill. A statute's number is the one fact in a brief that is FREE to check and
// catastrophic to recall — the bill text is a URL, and no amount of fluency substitutes for opening
// it. This is the 07-10 fluent/false pattern wearing a citation.
//
// FIX (the emission-contract pattern — entity-count / effective-date / source-conclusion). A named
// statute or docket cited in the same sentence as a MONETARY OR PROPORTIONAL THRESHOLD becomes a
// CRITICAL claim keyed `statute:<slug>`, resolvable only by a truth row. Unresolved → the existing
// --require-resolved rail blocks it at the Morning Truth Gate. The power is the requirement, not the
// parsing: a Writer who must paste the bill text's own words cannot quietly invert the test.
//
// NON-FIRE DISCIPLINE (this gate runs nightly; a storm is paid for every night). The threshold must
// sit in the SAME SENTENCE as the citation, and a DATE is not a threshold. Receipt, the same brief:
// Signal-2's "FERC approved PRC-029-1 in Order No. 909 on 24 July 2025. It takes effect 1 October
// 2026…" — correctly sourced, no monetary or proportional threshold attached — stays SILENT, and
// its effective date is already carried by the effective-date rail. Measured across the real
// 08-13…08-17 v2 files: ≤1 claim per brief.
// ---------------------------------------------------------------------------
const STATUTE_CITE_RE = new RegExp(
  String.raw`\b(?:(?:SB|AB|HB|HR)\s?\.?\s?\d{1,4}` +
    String.raw`|H\.R\.\s?\d{1,5}|S\.\s?\d{1,5}` +
    String.raw`|Order\s+No\.?\s?\d{1,4}` +
    String.raw`|Executive\s+Order\s+\d{4,5}` +
    String.raw`|PRC-\d{1,3}(?:-\d{1,2})?` +
    String.raw`|\d{1,2}\s?CFR(?:\s?§?\s?[\d.]+)?` +
    String.raw`|\d{1,3}\s?FR\s?\d{2,6}` +
    String.raw`|Regulation\s+\(EU\)\s+\d{4}\/\d{2,4}` +
    String.raw`|Directive\s+\d{4}\/\d{1,4}(?:\/[A-Z]{2,3})?)\b`,
  'g'
);
/** A THRESHOLD, not a date. "24 July 2025" must never trip this. */
const STATUTE_THRESHOLD_RE = new RegExp(
  String.raw`[$£€]\s?\d` +
    String.raw`|\d+(?:\.\d+)?\s*(?:%|percent\b|pct\b|basis points\b|bps\b)` +
    String.raw`|\b\d+(?:\.\d+)?\s*(?:million|billion|trillion|bn|tn)\b` +
    String.raw`|\b10\s?\^\s?\d+|\b10\*\*\d+|\bFLOPs?\b`,
  'i'
);

export function statuteThresholdClaims(
  body: string,
  _briefDate: string | null
): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    if (!STATUTE_THRESHOLD_RE.test(text)) continue;
    for (const cite of text.matchAll(STATUTE_CITE_RE)) {
      const slug = cite[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 24);
      const key = `statute:${slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push({
        key,
        asset: `named statute (${cite[0].trim()})`,
        tier: 'critical',
        claimType: 'statute-threshold',
        direction: 'unknown',
        magnitudePct: null,
        level: null,
        section: sectionOf(stripped, idx),
        sentence: text.trim(),
        status: 'UNVERIFIED',
      });
    }
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
const SRC_EVIDENCE_NOUN =
  'reports?|study|studies|survey|evaluation|paper|audit|analysis|assessment|findings|whitepaper|working paper|index|talk|presentation|reconstruction|briefing|dataset|census';
const SRC_NAMED = String.raw`[A-Z][A-Za-z.&'’-]{2,}(?:\s+[A-Z][A-Za-z.&'’-]+){0,3}`;
const SRC_POSSESSIVE_RE = new RegExp(
  String.raw`\b(${SRC_NAMED})(?:'s|’s)\s+(?:[a-z0-9-]+\s+){0,3}(?:${SRC_EVIDENCE_NOUN})\b`
);
const SRC_BY_RE = new RegExp(
  String.raw`\b(?:${SRC_EVIDENCE_NOUN})\s+(?:by|from|published by)\s+(${SRC_NAMED})`
);
const SRC_ATTRIBUTIVE_RE = new RegExp(
  String.raw`\b(?:By|According to|Per)\s+(${SRC_NAMED})(?:'s|’s)?\s+(?:[a-z0-9-]+\s+){0,3}(?:${SRC_EVIDENCE_NOUN})\b`
);
const SRC_CONCLUSION_VERB_RE =
  /\b(?:found|finds|concluded|concludes|reported|reports|shows|showed|documents|documented|estimates|estimated|warns|warned|argues|argued|says|said|puts|put|counted|counts|records|recorded|has|had)\b/i;
const SRC_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|The Signal|THE TAKE|The Take|Wild Card/i;

function srcSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/**
 * NO RETROACTIVE CONDEMNATION OF THE ARCHIVE — IMP-125's lesson, and this check tripped it within
 * minutes of being written. `verify-improvements` went RED on IMP-045, whose acceptance fixture is
 * `content/daily-updates/2026-07-13.md --require-resolved`: the new extractor found ChinaTalk's
 * analysis in a brief published three weeks before this rule existed, and no truth row for it can
 * ever exist. A new claim class that back-dates itself does not raise the standard; it invalidates
 * the record and red-lights every gate whose fixture is a published file. The rule binds from the
 * day it ships forward. A null date means the caller handed us a fragment and has already chosen it.
 */
const SRC_EFFECTIVE_FROM = '2026-08-08';

export function sourceConclusionClaims(
  body: string,
  briefDate: string | null
): Claim[] {
  if (briefDate && briefDate < SRC_EFFECTIVE_FROM) return [];
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!SRC_SECTION_RE.test(section)) continue;

    const attributive = SRC_ATTRIBUTIVE_RE.exec(text);
    const possessive = attributive
      ? null
      : (SRC_POSSESSIVE_RE.exec(text) ?? SRC_BY_RE.exec(text));
    const m = attributive ?? possessive;
    if (!m) continue;
    // An attributive frame IS the report of a conclusion. Otherwise demand both a conclusion verb
    // and a numeral, so a passing mention of "the report" never becomes a blocking claim.
    if (!attributive && !(SRC_CONCLUSION_VERB_RE.test(text) && /\d/.test(text)))
      continue;

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

// ---------------------------------------------------------------------------
// ISSUER-CAUSAL CLAIMS (IMP-166 — 2026-08-13 Critic mandate #1, RC2)
//
// WORKED FAILURE, AND IT IS THE SHARPEST KIND: the source-conclusion contract (IMP-143) shipped on
// 08-13, wrote ELEVEN truth rows, and wrote ZERO of them for THE SIX — which is the only place the
// class recurred. Six of the eleven were Wild Card rows. The Wild Card was already the careful
// section. The contract fired where the discipline already existed and was silent where it did not.
//
// THE DEFECT IT COULD NOT SEE — 2026-08-13 C&C-2, live on the reader surface:
//   BRIEF  "The 66 basis points is what moved: the reserve rate fell to 3.48 percent, and that
//           alone ate a 151 percent rise in usage and left seven."
//   CIRCLE "Reserve Income of $668 million increased 5% year-over-year, primarily from the 25%
//           growth in average USDC in Circulation, partially offset by a 66 bps decline in the
//           Reserve Return Rate."
//   → numerator 151% (VOLUME) substituted for the issuer's 25% (average circulation)
//   → denominator "seven" (TOTAL revenue) substituted for the issuer's 5% (reserve income)
//   → and the bullet's own thesis is "Circle earns on the dollar, not the turns", so by its own
//     argument the 151% could not be eaten. THE BULLET REFUTES ITSELF, and every number in it is
//     real. That is why `source-conclusion` and `attributed-superlative` are both blind to it.
//
// WHY THE EXISTING LEG MISSED IT — one line, and it is the whole gap: IMP-143's trigger is a NAMED
// STUDY, INSTITUTIONAL SOURCE or ATTRIBUTED QUOTATION. An ISSUER RESULTS RELEASE is none of the
// three by its parser, so a bullet built ENTIRELY on a company's own reported numbers writes no row.
//
// FIX (same emission-contract pattern; the power is the REQUIREMENT, not the parsing): when a bullet
// names an issuer AND reasons causally about that issuer's own reported financial metric, that is a
// CRITICAL claim keyed `source-conclusion:<company>-<metric>`, resolved only by a truth row carrying
// THE ISSUER'S OWN CAUSAL SENTENCE VERBATIM plus `brief_claim_within_source_claim: y/n`. An issuer
// that explains its own number has already written your causal sentence; quote it before you improve
// it. Unresolved → the existing --require-resolved rail blocks at the Morning Truth Gate.
//
// NON-FIRE DISCIPLINE (measured, not asserted — the acceptance the mandate set): the bullet must
// carry an ISSUER FRAME (a named party with a reporting verb — reported/guided/posted/disclosed/its
// results/on its call), the SENTENCE must carry a REPORTED METRIC NOUN, a NUMERAL, and a CAUSAL or
// INFERENTIAL connective. Silent by construction on: a named STUDY with no issuer (08-13 Wild Card
// Timema — already covered by IMP-143, and a duplicate row is a storm), and reporting-sourced
// figures with no issuer and no reported-metric claim (08-13 Geo-2).
// ---------------------------------------------------------------------------
const ISSUER_METRIC_RE =
  /\b(?:revenue|revenues|income|earnings|circulation|volumes?|margins?|reserve\s+rate|interest\s+(?:expense|income)|net\s+(?:loss|income|interest)|losses?|ebitda|arr|bookings?|backlog|deposits?|fees?|yield|take\s+rate|operating\s+cash\s+flow|free\s+cash\s+flow|guidance|cost\s+line|basis\s+points?|bps)\b/i;
// An inference ABOUT a reported figure often POINTS at it rather than restating it — which is
// exactly the shape of the 08-12 CoreWeave defect ("If the quarter landed anywhere inside THAT
// RANGE, … the whole loss is financing cost"). Requiring a literal digit in the same sentence would
// make the check blind to the conditional-inference half of its own acceptance spec.
const ISSUER_QUANT_ANAPHOR_RE =
  /\b(?:that\s+(?:range|figure|margin|number|line|alone)|inside\s+that|the\s+floor\s+of|its\s+entire|the\s+largest\s+cost)\b/i;
// A named party doing the reporting. This is what separates an ISSUER from a journalist or a study.
const ISSUER_FRAME_RE = new RegExp(
  String.raw`\b(?:${SRC_NAMED})(?:'s|’s)?\s+(?:[a-z0-9-]+\s+){0,3}(?:reported|reports|guided|guides|posted|posts|disclosed|discloses|booked|books|logged|earns?|earned)\b` +
    String.raw`|\b(?:reported|guided|posted|disclosed)\s+(?:a|an|its|net|revenue|income)\b` +
    String.raw`|\bits\s+(?:own\s+)?(?:results|release|filing|earnings|quarter|guidance)\b` +
    String.raw`|\bon\s+its\s+(?:first-quarter|second-quarter|third-quarter|fourth-quarter|earnings|quarterly)\s+call\b`,
  'i'
);
// Causal + INFERENTIAL connectives. The mandate names the causal set; the 08-12 AI&T-1 receipt is a
// CONDITIONAL inference on a guided range, so the conditional forms are in the set deliberately.
const ISSUER_CAUSAL_RE =
  /\b(?:ate|eats|drove|drives|driven\s+by|offset|offsets|left|leaves|because|that\s+alone|alone\s+(?:ate|explains|accounts)|which\s+is\s+why|means\s+that|implies|accounts\s+for|attributable\s+to|primarily\s+from|so\s+the|if\s+the\s+quarter|if\s+it\s+landed|exceeds\s+its|is\s+what\s+moved)\b/i;

/** NO RETROACTIVE CONDEMNATION OF THE ARCHIVE (IMP-125). Binds from the day it ships forward. */
const ISSUER_CAUSAL_EFFECTIVE_FROM = '2026-08-12';

/** The bullet (`- **…**` block) containing `idx`. Issuer identity is bullet-scoped; the causal
 *  claim is sentence-scoped. The 08-13 receipt requires exactly this split: "Circle" is named in
 *  the bullet's first sentence and the self-refuting causal claim is four sentences later. */
function bulletAround(body: string, idx: number): string {
  const start = body.lastIndexOf('\n- ', idx);
  if (start === -1) return sentenceAround(body, idx);
  let end = body.indexOf('\n- ', idx);
  if (end === -1) end = body.indexOf('\n\n', idx);
  if (end === -1) end = body.length;
  return body.slice(start, end);
}

export function issuerCausalClaims(
  body: string,
  briefDate: string | null
): Claim[] {
  if (briefDate && briefDate < ISSUER_CAUSAL_EFFECTIVE_FROM) return [];
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  // Sentence split that does NOT break on a decimal point. The shared `[^.!?\n]+` splitter cuts
  // "fell to 3.48 percent" in half, which truncated the 08-13 receipt's own message mid-number.
  for (const s of stripped.matchAll(
    /[^\n]*?[^\s.!?][.!?]+[*”"')]*(?=\s+[*_]*[A-Z"“(]|\s*$)|[^\n]+/g
  )) {
    const text = s[0].replace(/^[\s*_-]+/, '');
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!SRC_SECTION_RE.test(section)) continue;
    // Sentence-level: a reported metric, a quantity (literal or anaphoric), and a causal connective.
    const metric = ISSUER_METRIC_RE.exec(text);
    if (!metric) continue;
    if (!/\d/.test(text) && !ISSUER_QUANT_ANAPHOR_RE.test(text)) continue;
    if (!ISSUER_CAUSAL_RE.test(text)) continue;
    // Bullet-level: an issuer frame. No issuer → this is a study or reporting, and IMP-143 owns it.
    const bullet = bulletAround(stripped, idx);
    if (!ISSUER_FRAME_RE.test(bullet)) continue;
    // The company is the bullet's first capitalised token run — its grammatical subject.
    const company =
      (/\*\*\s*([A-Z][A-Za-z.&'’-]{2,}(?:\s+[A-Z][A-Za-z.&'’-]+){0,2})/.exec(
        bullet
      ) ?? /\b([A-Z][A-Za-z.&'’-]{2,})\b/.exec(bullet))?.[1];
    if (!company) continue;
    const key = `source-conclusion:${srcSlug(company)}-${srcSlug(metric[0])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: `${company} ${metric[0]}`.replace(/\s+/g, ' ').trim(),
      tier: 'critical',
      claimType: 'source-conclusion',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section,
      sentence: text.replace(/\s+/g, ' ').trim(),
      status: 'UNVERIFIED',
    });
  }
  return claims;
}

// ---------------------------------------------------------------------------
// IMP-215 — THE REGULATORY-VACUUM LEG (2026-08-24 Critic mandate #1, RC2, NEW CLASS).
//
// WORKED FAILURE, on the night's own bytes. AI&T-2 shipped:
//     "…the enabling condition sits a level above the algorithm: AIRLINES ARE EXEMPT FROM FEDERAL
//      TRADE COMMISSION oversight of pricing practices. THAT EXEMPTION IS WHY the experiment runs
//      here rather than in ridesharing, where Consumer Reports found Uber and Lyft quoting fares
//      42 percent apart for the same trip at the same moment. … The exemption is the rule, and the
//      rule is the layer that decides who captures a technology's gains."
//
//   FACT        ✓ TRUE  — air carriers ARE carved out of FTC jurisdiction.
//   INFERENCE   ✗ FALSE — 49 U.S.C. § 41712 gives the Department of Transportation EXCLUSIVE
//                 authority to prohibit unfair or deceptive practices of air carriers, and DOT has
//                 published interpretive rules under it (14 CFR Part 399). THE AUTHORITY MOVED; IT
//                 DID NOT VANISH. A carve-out from regulator R is a REASSIGNMENT, and the whole
//                 mechanism was built on reading it as a vacuum.
//   SELF-REFUTATION — ridesharing is NOT FTC-exempt, and the bullet's own cited evidence is that
//                 the NON-EXEMPT industry is ALREADY quoting 42% spreads for the same trip at the
//                 same moment. The control case disproves the treatment inside the same paragraph.
//
// WHY NOTHING IN THE STACK SAW IT, and this is the reason it is a new class rather than a new
// pattern: every number in the bullet was true, every attribution was real, and the false step was
// an INFERENCE FROM A TRUE FACT — "exempt from R" silently read as "unregulated". `statute:` rows
// check a THRESHOLD inside a named statute. `source-conclusion:` and `issuer-causal:` check whether
// a claim is the SOURCE'S claim. `ai-product:` checks whether a product exists. Not one of them
// asks the only question that would have caught this: WHO HOLDS THE AUTHORITY INSTEAD?
//
// THE FIX IS A REQUIREMENT, NOT A PARSER (IMP-143's lesson, restated by the 08-08 Critic: THE POWER
// IS THE REQUIREMENT, NOT THE PARSING). The gate cannot know that DOT holds § 41712. It does not
// need to. It needs to make a Writer who builds a MECHANISM on a carve-out write down who holds the
// authority instead — or state on the page that nobody does. A Writer required to name the
// successor cannot conclude "unregulated" by accident, because the row is where the accident shows.
//
// NON-FIRE DISCIPLINE IS THE HALF THAT DECIDES WHETHER THIS SHIPS. The mandate names three real
// sentences from the SAME BRIEF that must stay silent, and the reason is stated in its own words:
// "a gate that fires on Geo-1, the brief's best bullet, is a gate the Writer routes around."
//   · Signal-2  "Equipment already installed may keep running, but only while it stays where it is"
//               — GRANDFATHERING. Regulation (EU) 2024/573 still applies to the equipment; it is the
//               same regulator, holding, with a transitional clause. No successor question arises.
//   · Geo-1     "the plant was too small to be legally required to tell anyone"
//               — a REPORTING THRESHOLD inside a statute that plainly still applies. Being under a
//               floor is not being outside a jurisdiction.
//   · C&C-3     "blessed by the Justice Department in a 2010 consent decree"
//               — names the regulator as PRESENT. There is no absence to succeed to.
// All three are silent because none of them carries an EXEMPTION PREDICATE bound to a NAMED
// AUTHORITY, and each is proved below to be a JUDGEMENT rather than a skip: the same sentence
// rewritten into the exemption shape FIRES.
//
// THE PREDICATE BINDS ADJACENTLY, AND THAT IS THE WHOLE FALSE-POSITIVE BUDGET. "exempt from" must
// be followed IMMEDIATELY (one determiner allowed, nothing else) by a named authority or statute.
// The archive is full of the loose forms and every one of them is innocent: "selectively EXEMPTING
// Chinese-flagged vessels FROM their Bab al-Mandeb blockade" (07-25) is a militia and a shipping
// lane, "the drone determination was later narrowed to EXEMPT toy drones" (08-07) names no
// authority at all, and "California's SB 53 does NOT EXEMPT ANYONE FROM coverage on revenue"
// (08-17) is the negation of an exemption. A matcher that scanned ahead for a capitalised word
// would have condemned all three.
// ---------------------------------------------------------------------------
const REGULATORY_VACUUM_EFFECTIVE_FROM = '2026-08-24'; // IMP-125: no retroactive condemnation.

/** The four shapes the mandate names, plus the morphology each one actually appears in. */
const REG_EXEMPT_PREDICATE_RE = new RegExp(
  [
    String.raw`\bexempt(?:ed)?\s+from\b`,
    String.raw`\bexemptions?\s+from\b`,
    String.raw`\bnot\s+subject\s+to\b`,
    String.raw`\bcarved\s+out\s+of\b`,
    String.raw`\bcarve(?:[-\s])?outs?\s+(?:of|from)\b`,
    String.raw`\boutside\s+the\s+jurisdiction\s+of\b`,
  ].join('|'),
  'gi'
);

/** Regulator ACRONYMS. A closed list on purpose: an acronym is the one authority form that carries
 *  no common noun to recognise it by, so it has to be enumerated or it cannot be seen at all. */
const REG_ACRONYM_RE =
  /^(?:FTC|SEC|DOT|DOJ|FAA|FDA|EPA|FCC|CFTC|CFPB|OSHA|FERC|NERC|OCC|FDIC|IRS|HHS|USDA|NHTSA|PCAOB|FINRA|NLRB|NRC|ITC|USTR|OFAC|GAO|CMS|FHFA|NTSB|TSA|CBP|SAMR|CSRC|PBOC|MAS|ASIC|ACCC|SEBI|RBI|SARB|CARB|CPUC|NYDFS|ESMA|EBA|EIOPA|FCA|PRA|ECB|CMA|BaFin|AMF|Ofgem|Ofcom|ICAO|IMO|WTO|EU)\b/;

/** A COMMON NOUN that makes a proper phrase an AUTHORITY rather than merely a proper noun.
 *  "exempt from Delta" is not a regulatory claim; "exempt from the Federal Trade Commission" is. */
const REG_AUTHORITY_NOUN_RE =
  /\b(?:Commissions?|Commissioners?|Comptrollers?|Agency|Agencies|Departments?|Bureaus?|Authorit(?:y|ies)|Boards?|Administration|Ministr(?:y|ies)|Regulators?|Councils?|Committees?|Tribunals?|Courts?|Congress|Parliament|Reserve|Directorate|Inspectorate|Ombudsman|Office|Secretariat|Panel|Cent(?:re|er)s?|Institutes?|Services?)\b/;

/** A NAMED STATUTE or rule instrument — the other half of the mandate's "[named regulator or
 *  statute]". Anchored, because these are read off the head of the clause, never scanned for. */
const REG_STATUTE_HEAD_RE = new RegExp(
  [
    String.raw`^\d{1,2}\s+U\.?\s?S\.?\s?C\.?(?:\s*§+\s*[\d.]+(?:\([a-z0-9]+\))*)?`,
    String.raw`^\d{1,2}\s?CFR(?:\s+Part)?(?:\s?§?\s?[\d.]+)?`,
    String.raw`^(?:Section|Sections|Article|Title|Chapter|Part)\s+\d{1,4}[A-Za-z]?\b`,
    String.raw`^Regulation\s+\(EU\)\s+\d{4}\/\d{2,4}`,
    String.raw`^Directive\s+\d{4}\/\d{1,4}(?:\/[A-Z]{2,3})?`,
    String.raw`^(?:SB|AB|HB|HR)\s?\.?\s?\d{1,4}\b`,
    String.raw`^(?:GDPR|DMA|DSA|Dodd-Frank|Sarbanes-Oxley|MiFID(?:\s?II)?|Basel\s+I{1,3}|USMCA|MiCA)\b`,
    String.raw`^[A-Z][A-Za-z.&'’-]+(?:\s+[A-Z][A-Za-z.&'’-]+){0,4}\s+(?:Act|Code|Treaty|Convention|Directive|Regulation|Rule)\b`,
  ].join('|')
);

/** A run of capitalised tokens — the shape a named body has when it is spelled out. */
const REG_PROPER_HEAD_RE =
  /^[A-Z][A-Za-z.&'’-]+(?:\s+(?:of|the|and|for)\s+[A-Z][A-Za-z.&'’-]+|\s+[A-Z][A-Za-z.&'’-]+){0,4}/;

/** THE CONSEQUENCE VERBS. The mandate's six, plus the morphology of the two that inflect.
 *  `because` is here as a MEASURED extension, not a guess: it is the connective the SAME NIGHT's
 *  super brief used for the identical defect ("…from 3 percent to 20 percent, BECAUSE airlines are
 *  exempt from Federal Trade Commission pricing oversight"), and the archive sweep below prices it
 *  — it adds exactly that one reader-facing page and nothing else across 08-01→08-24. */
const REG_CONSEQUENCE_RE = new RegExp(
  [
    String.raw`\bis\s+why\b`,
    String.raw`\bis\s+what\s+permits\b`,
    String.raw`\bis\s+what\s+lets\b`,
    String.raw`\bis\s+the\s+reason\b`,
    // enable/enables/enabled only. "ENABLING" is deliberately absent: on the 08-24 receipt itself
    // it appears as an ADJECTIVE ("the enabling condition sits a level above the algorithm"), and a
    // finding whose message quoted that as the mechanism's verb would be citing a noun phrase.
    String.raw`\benable[sd]?\b`,
    String.raw`\ballow(?:s|ed|ing)?\b`,
    String.raw`\bbecause\b`,
  ].join('|'),
  'i'
);

/** How far the consequence verb may sit from the exemption clause and still be bound to it. */
const REG_BIND_CHARS = 200;

/** The NAMED AUTHORITY, if the words IMMEDIATELY after the exemption predicate are one. Returns
 *  the authority's own name, which becomes the truth-row slug. One leading determiner is allowed
 *  and nothing else — see the non-fire discipline above; the adjacency IS the budget. */
function namedAuthorityHead(after: string): string | null {
  const head = after
    .replace(/^[\s,]*/, '')
    .replace(/^(?:the|its|their|any|all|a|an)\s+/i, '');
  const statute = REG_STATUTE_HEAD_RE.exec(head);
  if (statute) return statute[0].trim();
  const acro = REG_ACRONYM_RE.exec(head);
  if (acro) return acro[0].trim();
  const proper = REG_PROPER_HEAD_RE.exec(head);
  if (!proper) return null;
  const name = proper[0].replace(/(?:['’]s)$/, '').trim();
  // A proper noun is not an authority until a common noun says so. "exempt from Delta" is silent.
  if (!REG_AUTHORITY_NOUN_RE.test(name)) return null;
  return name;
}

/** Does the row NAME a successor authority, or ASSERT IN WORDS that none exists? Both discharge
 *  the requirement; a bare `resolved:true` discharges neither, because the row's whole content is
 *  the sentence the Writer could not otherwise be made to write. */
const REG_NO_SUCCESSOR_RE =
  /\b(?:no\s+(?:successor|other|remaining|replacement|second)?\s*(?:authority|regulator|agency|body|oversight|jurisdiction|supervisor)|nobody\s+(?:holds|has|regulates|oversees|enforces)|no\s+one\s+(?:holds|has|regulates|oversees|enforces)|none\s+exists|there\s+is\s+no\s+successor|genuinely\s+unregulated|wholly\s+unregulated|regulated\s+by\s+no\s+one)\b/i;

/**
 * THE LEG. Reader-facing prose, comments and table rows stripped. One finding per named authority
 * per brief. Advisory in the evening (the brief ships); FAIL under --require-resolved, so the
 * Morning Truth Gate — the stage that has a browser and can look up who took the authority — is
 * the stage that has to settle it. Same severity contract as IMP-205/IMP-213.
 */
export function regulatoryVacuumLeg(
  body: string,
  truth: any,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  if (briefDate && briefDate < REGULATORY_VACUUM_EFFECTIVE_FROM) return out;
  const prose = stripComments(body)
    .split('\n')
    .filter(l => !/^\s*\|/.test(l))
    .join('\n');
  const rows = Object.entries<any>(truth?.claims ?? {}).filter(([k]) =>
    k.startsWith('regulator-successor:')
  );
  const seen = new Set<string>();

  const g = new RegExp(REG_EXEMPT_PREDICATE_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = g.exec(prose)) !== null) {
    const pStart = m.index;
    const pEnd = m.index + m[0].length;
    const authority = namedAuthorityHead(prose.slice(pEnd, pEnd + 120));
    if (!authority) continue;
    // The consequence verb must be BOUND to the clause, not merely present on the page.
    const window = prose.slice(
      Math.max(0, pStart - REG_BIND_CHARS),
      pEnd + authority.length + REG_BIND_CHARS
    );
    // EVERY bound connective is named, not just the first. On the 08-24 receipt the clause is bound
    // BOTH ways — "…the story is unchanged, BECAUSE the enabling condition sits a level above the
    // algorithm: airlines are exempt from Federal Trade Commission oversight… That exemption IS WHY
    // the experiment runs here" — and a message quoting only the nearer one would hand the Writer a
    // receipt that does not contain the sentence the Critic actually indicted.
    const verbs = [
      ...new Set(
        [...window.matchAll(new RegExp(REG_CONSEQUENCE_RE.source, 'gi'))].map(
          v => v[0].trim().toLowerCase()
        )
      ),
    ];
    if (!verbs.length) continue; // an exemption stated as a fact, with no mechanism on it, is not this class

    const slug = srcSlug(authority);
    const key = `regulator-successor:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // A row may be keyed on any slug that shares a distinctive token with the authority named in
    // the prose — the same free-form match citationLocatorRail uses, for the same reason.
    const tokens = (authority.match(/[A-Za-z]{4,}/g) ?? []).map(w =>
      w.toLowerCase()
    );
    const row =
      rows.find(([k]) => k === key) ??
      rows.find(([k]) => {
        const rs = k.slice('regulator-successor:'.length).toLowerCase();
        return tokens.some(t => rs.includes(t));
      });

    const sentence = sentenceAround(prose, pStart)
      .replace(/\s+/g, ' ')
      .replace(/^[\s"“”'’*_-]+/, '') // the previous sentence's closing quote is not this one's start
      .trim();
    const cited = sentence.slice(0, 200);
    const receipt =
      `RECEIPT (2026-08-24, AI&T-2): "airlines are exempt from Federal Trade Commission oversight of ` +
      `pricing practices. That exemption is why the experiment runs here rather than in ridesharing…" ` +
      `The fact was TRUE and the inference was FALSE: 49 U.S.C. § 41712 gives DOT EXCLUSIVE authority ` +
      `over unfair or deceptive practices of air carriers, with interpretive rules at 14 CFR Part 399. ` +
      `The authority moved; it did not vanish. The bullet's own control case — ridesharing, which is ` +
      `NOT exempt and was ALREADY quoting fares 42 percent apart — refuted it in the same paragraph.`;

    if (!row) {
      out.push({
        check: 'regulator-successor-unresolved',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `A MECHANISM BUILT ON A CARVE-OUT, WITH NOBODY NAMED AS THE SUCCESSOR — the brief says the ` +
          `subject is ${m[0].trim().toLowerCase()} ${authority}, and binds that to ${verbs.map(v => `"${v}"`).join(' + ')} ` +
          `within ${REG_BIND_CHARS} characters, so the exemption is doing CAUSAL work. No \`${key}\` row ` +
          `exists in {BRIEF_DATE}-truth.json. AN EXEMPTION FROM ONE REGULATOR IS NOT AN ABSENCE OF ` +
          `REGULATION: a carve-out is usually a REASSIGNMENT, and the mechanism is only true if the ` +
          `authority actually went nowhere. MORNING GATE: add ${key} with resolved:true and either ` +
          `\`successor\` naming the body that holds it instead (plus the statute or rule that moves it) ` +
          `or a sentence stating IN WORDS that no authority does — then correct the bullet to say which. ` +
          `Naming the successor on the page is always legal and costs the mechanism nothing it honestly ` +
          `had. ${receipt} Sentence: "${cited}"`,
      });
      continue;
    }

    const [rKey, r] = row;
    const resolved = r?.resolved === true || r?.status === 'verified';
    const wording = String(
      r?.successor ?? r?.authority ?? r?.value ?? r?.claim ?? r?.match ?? ''
    ).trim();
    const source = String(r?.source ?? '').trim();
    const namesSuccessor =
      !!wording &&
      (REG_NO_SUCCESSOR_RE.test(wording) ||
        REG_AUTHORITY_NOUN_RE.test(wording) ||
        new RegExp(REG_ACRONYM_RE.source.replace(/^\^/, '\\b')).test(wording) ||
        /\b[A-Z][A-Za-z.&'’-]+(?:\s+[A-Z][A-Za-z.&'’-]+)+\b/.test(wording));
    const reasons: string[] = [];
    if (!resolved) reasons.push('the row is not resolved');
    if (!wording)
      reasons.push(
        'the row names no successor (successor/authority/value/claim/match all empty)'
      );
    else if (!namesSuccessor)
      reasons.push(
        `the row neither names an authority nor states in words that none exists ("${wording.slice(0, 80)}")`
      );
    if (!source) reasons.push('the row names no source consulted');
    if (!reasons.length) continue; // THE FIX IS NEVER PUNISHED.

    out.push({
      check: 'regulator-successor-unresolved',
      severity: requireResolved ? 'FAIL' : 'FLAG',
      message:
        `UNRESOLVED REGULATORY SUCCESSOR — "${rKey}": ${reasons.join('; ')}. The brief builds a ` +
        `mechanism on being ${m[0].trim().toLowerCase()} ${authority}, so the row must carry the ` +
        `answer to the only question that makes the mechanism true: WHO HOLDS THE AUTHORITY INSTEAD? ` +
        `Name the body and the statute that moves it, or say in words that nobody does. ${receipt} ` +
        `Sentence: "${cited}"`,
    });
  }
  return out;
}

/** Words too common to carry a conclusion's content. */
const SRC_STOPWORD = new Set([
  'about',
  'above',
  'after',
  'again',
  'against',
  'their',
  'there',
  'these',
  'those',
  'which',
  'while',
  'would',
  'could',
  'should',
  'other',
  'others',
  'between',
  'during',
  'because',
  'report',
  'reports',
  'study',
  'studies',
  'survey',
  'paper',
  'talk',
  'percent',
  'first',
  'second',
  'third',
  'where',
  'whether',
  'through',
  'under',
  'over',
  'more',
  'most',
  'than',
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
  truthClaims:
    | Record<string, { conclusion?: string; resolved?: boolean }>
    | undefined
): Finding[] {
  const out: Finding[] = [];
  if (!truthClaims) return out;
  for (const c of claims) {
    const row = truthClaims[c.key];
    const conclusion = row?.conclusion;
    if (!conclusion) continue;
    const terms = [
      ...new Set(conclusion.toLowerCase().match(/[a-z]{5,}/g) ?? []),
    ].filter(w => !SRC_STOPWORD.has(w));
    for (const term of terms) {
      const neg = new RegExp(
        String.raw`\b(?:not|no|never|without|fails?\s+to|failed\s+to|does\s+not|did\s+not|is\s+not|was\s+not|were\s+not)\s+(?:\w+\s+){0,3}${term}`,
        'i'
      );
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
      break; // one finding per claim — the point is the bullet, not a term census
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// ATTRIBUTED-SUPERLATIVE FIDELITY (IMP-165 — 2026-08-12 Critic mandate #3, RC2; also discharges
// the (a) half of IMP-151, deferred twice with a hard fuse of 2026-08-13).
//
// THE CLASS, three receipts, three different nights, one move:
//   08-09  Take lede  "the first new AMERICAN iron mine"   — the company says "in Minnesota".
//   08-12  C&C-1      "by the acquirer's own account, is THE ONLY independent supplier of
//                      commercially ready photon-counting CT detectors"
//                     — Teledyne's release says "ONE OF THE WORLD'S ONLY credible, commercially
//                       ready independent suppliers".
//   08-07  AI&T-1     the same move in the other direction (source conclusion inverted, IMP-143).
//
// Every NUMBER in all three is correct, which is why eleven green gates passed them: the existing
// `superlative-escalation-gate` compares superlatives against OUR ARCHIVE, and the archive is the
// wrong referent for a claim about what a NAMED PARTY SAID. The right referent is the party's own
// wording, and nothing in the chain held a copy of it.
//
// THE FIX IS AN EMISSION CONTRACT, not a paraphrase detector — the 08-08 Critic's rule, THE POWER
// IS THE REQUIREMENT, NOT THE PARSING. A superlative ATTRIBUTED to a named party becomes a CRITICAL
// claim resolved only by a truth row carrying that party's `quotation` verbatim. A Writer required
// to paste "one of the world's only" cannot quietly ship "the only".
//
// Then TWO binary legs over the quotation, each bound to one of the receipts above:
//   HEDGE-DELETED  — the quotation hedges the superlative ("one of", "among the", "some of the")
//                    and the brief's sentence does not. That is 08-12 C&C-1 exactly.
//   SCOPE-ADDED    — the brief's superlative carries a scope noun (American, global, world's,
//                    national, ever …) that appears nowhere in the quotation. That is 08-09 exactly.
//
// NON-FIRE DISCIPLINE. Both an ATTRIBUTION FRAME and a SCOPE SUPERLATIVE must be in the SAME
// sentence. An unattributed superlative ("Beijing's first public demonstration of sea-based
// strategic reach", sourced to CSIS) stays SILENT — it rides the archive rails. An ARGUMENT that
// contains the word "only" ("the only way to get one on a venture timeline") stays SILENT because
// no party is credited with saying it.
// ---------------------------------------------------------------------------
// IMP-172 — THE QUOTE-VERBATIM RAIL (2026-08-14 Critic mandate #2, RC2).
//
// On 2026-08-14 the brief carried a direct quotation of Gerard Manley Hopkins, a truth row keyed
// `quote-verbatim:hopkins-bluebell-inscape`, and an in-body HTML comment asserting the wording had
// been verified. The row was `resolved: false`. `fact-gate --require-resolved` EXITED 0 — because
// `quote-verbatim:` was on no rail at all — and an unverified verbatim quotation of a named writer
// reached the reader AND the podcast feed.
//
// A quotation is the one claim class where paraphrase is the defect. You may shorten with an
// ellipsis; you may never change a word inside the marks. So a `quote-verbatim:` row resolves ONLY
// by carrying the source's own wording plus a named source — `resolved: true` on its own is a
// promise, not a receipt.
//
// MEASURED THIS SESSION, and it changes what this leg can honestly claim: by the time the
// improvement session ran, the Morning Truth Gate had already set the row `resolved: true` AND
// adjudicated the Critic's content claim AGAINST it with receipts (the published journal wording
// IS "the beauty of our Lord"). So the mandate's FIRE case no longer reproduces on disk, and its
// two named SILENT cases (08-13, 08-12 Inner Games) are vacuous — those briefs carry ZERO
// quote-verbatim rows. The rail is still the real hole and it is closed here; the acceptance
// evidence is a fixture plus the live row as the clean negative, and it is labelled as such rather
// than dressed up as the mandate's original test.
const QUOTE_RAIL_EFFECTIVE_FROM = '2026-08-14'; // IMP-125: no retroactive condemnation.

export function quoteVerbatimRail(
  truth: any,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  if (briefDate && briefDate < QUOTE_RAIL_EFFECTIVE_FROM) return out;
  const claims = truth?.claims;
  if (!claims || typeof claims !== 'object') return out;

  for (const [key, row] of Object.entries<any>(claims)) {
    if (!key.startsWith('quote-verbatim:')) continue;
    const resolved = row?.resolved === true || row?.status === 'verified';
    const wording = String(row?.claim ?? row?.match ?? row?.value ?? '').trim();
    const source = String(row?.source ?? '').trim();
    const reasons: string[] = [];
    if (!resolved) reasons.push('the row is not resolved');
    if (!wording)
      reasons.push(
        'the row carries no quoted wording (claim/match/value all empty)'
      );
    if (!source) reasons.push('the row names no source');
    if (!reasons.length) continue;

    out.push({
      check: 'quote-verbatim-unresolved',
      severity: requireResolved ? 'FAIL' : 'FLAG',
      message:
        `UNRESOLVED VERBATIM QUOTATION — "${key}": ${reasons.join('; ')}. A direct quotation attributed to a named person is a ` +
        `CRITICAL claim, and it resolves only by a row carrying the SOURCE'S OWN WORDING verbatim plus a named source. ` +
        `You may shorten a quotation with an ellipsis; you may never change a word inside the marks. ` +
        `MORNING GATE: fetch the primary, paste the wording into the row, and correct the brief — or strip the quotation marks ` +
        `and paraphrase in the open. RECEIPT (2026-08-14): this row sat unresolved while the brief carried both the quotation ` +
        `AND an in-body comment asserting it had been verified; --require-resolved exited 0 and it reached the podcast feed.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// IMP-180 — THE CITATION-LOCATOR RAIL (2026-08-16 Critic mandate #2, RC2).
//
// On 2026-08-16 the Inner Game shipped:
//     "— Constantin Stanislavski, An Actor Prepares, chapter 10, 'Relaxation of Muscles'"
// "Relaxation of Muscles" is CHAPTER 6 of the sixteen-chapter Hapgood translation. Chapter 10 is
// "Communion." The staleness ledger one line above certified the replacement with "Quote
// web-verified this session" — so a NEW false fact shipped under a FRESH certification, inside a
// replacement made specifically to repair an EARLIER false receipt.
//
// WHY NO GATE SAW IT. `quoteVerbatimRail` (IMP-172) audits the WORDING inside the quotation marks
// and is structurally blind to the LOCATOR sitting beside them. fact-gate exited 1 that night on
// three unverified-critical claims and not one of them was the chapter. The verifier checked the
// sentence and never checked the address.
//
// THE PRINCIPLE: a locator is a checkable claim with exactly the standing of a word inside the
// quotation marks. "Chapter 10" asserts that a reader who opens chapter 10 finds this. It is
// falsifiable in one lookup, it is the part of a citation that signals the citer actually opened
// the book, and it is therefore the part most worth being true.
//
// THE ESCAPE HATCH IS THE CORRECT DEFAULT: naming only the WORK is always silent. An unverifiable
// chapter number should be OMITTED, never guessed — dropping the locator costs the reader nothing
// and costs the brief no authority it legitimately had.
const LOCATOR_RAIL_EFFECTIVE_FROM = '2026-08-16'; // IMP-125: no retroactive condemnation.

/** Attribution lines are em-dash-led credit lines under a pulled quotation:
 *  "— Constantin Stanislavski, An Actor Prepares, chapter 10, "Relaxation of Muscles"".
 *  Bounded to short credit lines so ordinary prose containing "page 3" can never enter. */
export function attributionLocators(
  body: string
): { line: string; kind: string; value: number }[] {
  const out: { line: string; kind: string; value: number }[] = [];
  for (const raw of body.split('\n')) {
    const t = raw.trim();
    if (!/^[—–]\s*\S/.test(t)) continue; // must be a credit line
    if (t.length > 300) continue; // a credit line, not a paragraph that opened with a dash
    const m = t.match(
      /\b(chapters?|chs?\.|books?|sections?|parts?|cantos?|pages?|pp?\.)\s*(\d{1,4})\b/i
    );
    if (!m) continue;
    out.push({
      line: t,
      kind: m[1].replace(/\.$/, '').toLowerCase(),
      value: Number(m[2]),
    });
  }
  return out;
}

export function citationLocatorRail(
  body: string,
  truth: any,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  if (briefDate && briefDate < LOCATOR_RAIL_EFFECTIVE_FROM) return out;
  const found = attributionLocators(body);
  if (!found.length) return out; // the escape hatch: cite the work and stop

  const claims = (truth?.claims ?? {}) as Record<string, any>;
  const rows = Object.entries(claims).filter(([k]) =>
    k.startsWith('quote-locator:')
  );

  for (const f of found) {
    const cited = f.line.slice(0, 160);
    // Match a row to this attribution by any distinctive token they share (the slug is free-form).
    const tokens = (f.line.match(/[A-Za-z]{5,}/g) ?? []).map(w =>
      w.toLowerCase()
    );
    const row = rows.find(([k]) => {
      const slug = k.slice('quote-locator:'.length).toLowerCase();
      return tokens.some(t => slug.includes(t));
    });

    if (!row) {
      out.push({
        check: 'citation-locator-unresolved',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `UNRESOLVED CITATION LOCATOR — the attribution asserts ${f.kind} ${f.value} and no ` +
          `\`quote-locator:\` row exists in the truth file: ${cited}. A locator is a checkable claim with ` +
          `the same standing as a word inside the quotation marks; it is falsifiable in one lookup and it ` +
          `is the part of the citation that says you opened the book. MORNING GATE: open the published ` +
          `contents, add quote-locator:{slug} with resolved:true, the locator's own value and the source ` +
          `consulted — OR delete the locator and cite the work, which is always legal. RECEIPT ` +
          `(2026-08-16): "An Actor Prepares, chapter 10, 'Relaxation of Muscles'" shipped under an ` +
          `explicit "Quote web-verified this session" certification. It is chapter 6.`,
      });
      continue;
    }

    const [key, r] = row;
    const resolved = r?.resolved === true || r?.status === 'verified';
    const rawVal = String(r?.value ?? r?.locator ?? r?.claim ?? r?.match ?? '');
    const stated = Number(rawVal.match(/\d{1,4}/)?.[0] ?? NaN);
    const source = String(r?.source ?? '').trim();

    if (Number.isFinite(stated) && stated !== f.value) {
      out.push({
        check: 'citation-locator-mismatch',
        severity: 'FAIL',
        message:
          `FALSE CITATION LOCATOR — the brief says ${f.kind} ${f.value}; the verified row "${key}" says ` +
          `${stated}. ${cited}. The truth file and the reader-facing line disagree, and the reader-facing ` +
          `line is the one that gets quoted. Correct the attribution to ${stated}, or drop the locator.`,
      });
      continue;
    }
    const reasons: string[] = [];
    if (!resolved) reasons.push('the row is not resolved');
    if (!Number.isFinite(stated))
      reasons.push('the row carries no locator value');
    if (!source) reasons.push('the row names no source consulted');
    if (reasons.length)
      out.push({
        check: 'citation-locator-unresolved',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `UNRESOLVED CITATION LOCATOR — "${key}": ${reasons.join('; ')}. ${cited}. A locator resolves only ` +
          `by a row carrying the locator's OWN VALUE plus the source consulted; resolved:true on its own is a ` +
          `promise, not a receipt. Cite the ${f.kind} you opened, or cite the work and stop.`,
      });
  }
  return out;
}

// ---------------------------------------------------------------------------
// IMP-173 — THE SETTLE-OBSERVATION RAIL (2026-08-14 Critic mandate #3, RC2, NEW CLASS).
//
// On 2026-08-13 the Dashboard asserted Brent and WTI were "both down MORE THAN 2 PERCENT". The
// Editor ran three independent web reads, none of them corroborated it, and the magnitude was
// STRUCK. The three reads were: a TheStreet live blog at 07:08 EDT, an "early Thursday" level, and
// a directional wrap. NONE OF THEM WAS A SETTLE. The Editor compared a close against three opens,
// and a verification layer made the brief less accurate.
//
// THE NEW CLASS: every previous gate protects the reader from the WRITER. This one protects the
// reader from the VERIFIER. An intraday quote is evidence about the intraday and never about the
// close — but nothing in the truth schema could express the difference, because a `price:` row
// records a VALUE and a SOURCE and no OBSERVATION TIME. Two facts that a human reads as obviously
// different ("Brent 87.38 at 07:08" vs "Brent settled 87.07") were, to every gate in the pipeline,
// the same shape of row.
//
// So: `observedAt` becomes a required field on settle/close rows. A row without one cannot resolve
// a settle claim, and a row whose timestamp precedes the session's settle cannot DISCONFIRM one.
//
// DELIBERATELY NOT BLOCKING on absence (the mandate's own doctrine, and the reason the 08-14
// content dispute is still open): when no settle-time source is reachable the correct action is
// UNRESOLVED-FACT to the Morning Truth Gate — which has a browser — never deletion in the evening,
// which does not. Absence emits ONE aggregated row per brief so the schema migration cannot storm.
// A PRESENT-BUT-PRE-SETTLE timestamp is a different animal and fails individually: that is the
// actual 08-13 defect, and it is the only thing here that can silently cost the reader a true number.
const SETTLE_RAIL_EFFECTIVE_FROM = '2026-08-14'; // IMP-125: no retroactive condemnation.

/** Minutes past midnight ET at which each row class is settled. Commodities settle first
 *  (NYMEX WTI 14:30 ET, ICE Brent 19:30 London = 14:30 ET); US equity indices close 16:00 ET. */
function settleMinutesET(key: string): number | null {
  if (/-settle-/.test(key)) return 14 * 60 + 30;
  if (/-close-/.test(key)) return 16 * 60;
  return null; // futures, spot crypto, session snapshots — not settle claims
}

export function settleObservationRail(
  truth: any,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  if (briefDate && briefDate < SETTLE_RAIL_EFFECTIVE_FROM) return out;
  const claims = truth?.claims;
  if (!claims || typeof claims !== 'object') return out;

  const missing: string[] = [];
  for (const [key, row] of Object.entries<any>(claims)) {
    if (!key.startsWith('price:')) continue;
    const settleMin = settleMinutesET(key);
    if (settleMin === null) continue;
    const sessionDate = /(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1] ?? briefDate;
    const observedAt = String(row?.observedAt ?? '').trim();

    if (!observedAt) {
      missing.push(key);
      continue;
    }

    const d = new Date(observedAt);
    if (Number.isNaN(d.getTime())) {
      out.push({
        check: 'settle-observation',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message: `UNPARSEABLE observedAt on "${key}": ${JSON.stringify(observedAt)}. Use an ISO-8601 instant (e.g. "2026-08-13T20:30:00Z"). A timestamp nobody can compare is the same as no timestamp.`,
      });
      continue;
    }
    // ET = UTC-4 during the Aug session (EDT). Comparing in minutes-past-midnight ET.
    const etMin =
      (d.getUTCHours() * 60 + d.getUTCMinutes() - 240 + 1440) % 1440;
    const etDate = new Date(d.getTime() - 240 * 60000)
      .toISOString()
      .slice(0, 10);

    if (
      sessionDate &&
      (etDate < sessionDate || (etDate === sessionDate && etMin < settleMin))
    ) {
      const hh = String(Math.floor(etMin / 60)).padStart(2, '0');
      const mm = String(etMin % 60).padStart(2, '0');
      const sh = String(Math.floor(settleMin / 60)).padStart(2, '0');
      const sm = String(settleMin % 60).padStart(2, '0');
      out.push({
        check: 'settle-observation',
        severity: 'FAIL',
        message:
          `PRE-SETTLE OBSERVATION RESOLVING A SETTLE CLAIM — "${key}" is a settle/close row, and its observedAt lands ` +
          `${etDate} ${hh}:${mm} ET, BEFORE the ${sh}:${sm} ET settle. An intraday quote is evidence about the intraday and ` +
          `NEVER about the close. THE SETTLE RULE: a magnitude on a settled instrument may be struck only by a source ` +
          `timestamped at or after that session's settle; when no settle-time source is reachable, the correct action is ` +
          `UNRESOLVED-FACT to the Morning Truth Gate, NOT deletion — the morning pass has a browser and the evening does not. ` +
          `RECEIPT (2026-08-13): the Editor struck a TRUE "both down more than 2 percent" on Brent/WTI using a 07:08 EDT live ` +
          `blog, an "early Thursday" level and a directional wrap. Brent $88.93 → $87.07 settle = −2.09%. The verification ` +
          `layer made the brief less accurate and no artifact recorded the correction as wrong.`,
      });
    }
  }

  // ── ESC-018 — THE RAIL ANNOUNCES ITS OWN STARVATION (added 2026-08-21, RC7) ──────────────────
  // NOTHING CHECKS THE CHECKER (IMP-066's lesson, arriving in a second place). This rail's ONLY
  // input is a claim key prefixed `price:`, and that prefix is a WRITER CONVENTION that no gate
  // requires. Measured across every truth file on disk the morning of 2026-08-21:
  //   08-14: 12 rows (the night IMP-173 shipped) · 08-15: 10 · 08-17: 5 · 08-18: 8
  //   08-19: **0** · 08-20: 3 · 08-21: **0**
  // TWO OF THE LAST THREE NIGHTS HAD ZERO. On those nights this rail inspected nothing, returned
  // nothing, and was indistinguishable from a rail that found nothing wrong — the exact shape of
  // IMP-064's premise registry that "silently returned zero rows while fact-gate printed PASS".
  // A gate with no input is not passing; it is absent. So it now says so, once, per brief.
  if (!Object.keys(claims).some(k => k.startsWith('price:'))) {
    out.push({
      check: 'settle-observation',
      severity: 'FLAG',
      message:
        `GATE STARVED — the truth file carries ZERO \`price:\` rows, so the settle-observation rail ` +
        `(IMP-173) inspected NOTHING this run. A gate with no input is not passing, it is ABSENT, and ` +
        `a green line here would mean only that there was nothing to read. The \`price:\` prefix is a ` +
        `writer convention that nothing enforces, and its coverage has decayed since the rail shipped ` +
        `(08-14: 12 rows · 08-15: 10 · 08-17: 5 · 08-18: 8 · 08-19: 0 · 08-20: 3 · 08-21: 0). Key every ` +
        `Dashboard level as \`price:<asset>-<settle|close|at>-<YYYY-MM-DD>\` with an \`observedAt\`, or ` +
        `this rail and IMP-205's observation-kind cross-check are both reading an empty table. ESC-018.`,
    });
  }

  if (missing.length) {
    out.push({
      check: 'settle-observation',
      severity: 'FLAG',
      message:
        `UNRESOLVED-FACT: ${missing.length} settle/close price row(s) carry no observedAt — ${missing.join(', ')}. ` +
        `A price row without an observation timestamp CANNOT resolve a settle claim, because nothing distinguishes ` +
        `"Brent 87.38 at 07:08 EDT" from "Brent settled 87.07" once the value is in the row. Add observedAt as an ISO-8601 ` +
        `instant naming when the figure was OBSERVED (not when the page was published). MORNING GATE: this is a schema ` +
        `migration, not a blocker — the brief always ships.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// IMP-205 — THE OBSERVATION-KIND LEG (2026-08-21 Critic mandate #3, RC2).
//
// 2026-08-21 Dashboard, Crypto: "…it OPENED Thursday at $69,289.44, up 7.1 percent from Wednesday's
// OPEN, trading $71,980.32 BY 9:15 ET while ether OPENED at $2,251.93". Bitcoin has no open and no
// close. Same page, same night: Equities carried four correct CLOSES and Commodities two correct
// SETTLES, and the sentence said "settled". THE DASHBOARD KNOWS HOW TO DO THIS — it did it twice on
// the same page. Third consecutive night the Dashboard carried the brief's worst data defect
// (E-DASHBOARD-INFERENCE-01, opened 08-20).
//
// WHY EVERY EXISTING LEG WAS SILENT, and it is not the reason you would guess:
//   • IMP-173's settle-observation asks whether an `observedAt` PRECEDES an instrument's settle.
//     For a continuously-traded asset there IS no settle to compare against, so it is silent by
//     construction — that is the Critic's diagnosis and it is correct.
//   • IMP-196 asks whether a level is stale against the archive — it checks the NUMBER, and nothing
//     checked the SENTENCE built on it.
//   • AND A THIRD REASON THE CRITIC COULD NOT SEE: settleObservationRail keys exclusively off
//     `price:` claim rows, and THAT SCHEMA IS DECAYING. Measured this session across every truth
//     file on disk: `price:` rows appear on 2026-08-14 (12 rows — the night IMP-173 shipped), then
//     10 · 5 · 8 · **0** · 3 · **0**. TWO OF THE LAST THREE NIGHTS HAD ZERO `price:` ROWS, including
//     08-21 itself. A leg hung off that key would have been BORN DEAD and still passed a synthetic
//     selftest forever. See ESC-018.
//
// So this leg reads the READER-FACING DASHBOARD PROSE, which is where the mandate's own
// discriminator lives ("unless the reader-facing sentence states the observation time") and which
// exists on every brief regardless of truth-file schema drift. Truth rows are consulted when
// present, never depended on.
//
// ONE LEG — THE CATEGORY ERROR: a session verb (opened / closed / Wednesday's open) bound to an
// instrument that never closes. NO TIMESTAMP REPAIRS THIS — an asset with no open did not open — so
// the fix is to rewrite the observation ("was trading $71,980.32 at 09:15 ET"), not to date the
// fiction. This is why the mandate's "unless the reader-facing sentence states the observation time"
// is NOT wired as an escape on this leg: on 08-21 the "$71,980.32 by 9:15 ET" clause states its age
// and is CORRECT, while "opened Thursday at $69,289.44" states a day and is still a category error.
//
// A SECOND LEG WAS BUILT AND THEN DELETED, and the deletion is the more useful record. It flagged
// any crypto level with no stated observation age — the mandate's other half. Swept across all 171
// published briefs judged in force it produced 231 flags on 150 nights, essentially all of them the
// legacy `| Asset | Price | 1D | …` Dashboard TABLE and ordinary prose ("Vitalik sold ~$18M in ETH
// over recent weeks"). That is a flag generator, not a gate. PROXY DISCIPLINE (Ceiling Doctrine §9):
// build for the RECURRING class, and every proxy pays a Goodhart tax. The recurring class here — the
// third consecutive night of E-DASHBOARD-INFERENCE-01 — is the category error, and that is all this
// ships. If unstated age recurs on its own, it earns its own check then.
const OBSERVATION_KIND_EFFECTIVE_FROM = '2026-08-21'; // IMP-125: no retroactive condemnation.

/** Instruments that trade continuously (crypto, FX) — loaded from system/entity-bindings.json,
 *  the registry the mandate names. Falls back to a documented literal only if the file or the key
 *  is unreadable, so a registry edit changes behaviour and a registry outage does not silence the
 *  gate. */
function continuouslyTradedMatchers(): { id: string; re: RegExp }[] {
  const fallback = [
    { id: 'bitcoin', re: /\b(?:bitcoin|BTC)\b/i },
    { id: 'ether', re: /\b(?:ether|ethereum|ETH)\b/i },
  ];
  try {
    const p = path.join(process.cwd(), 'system', 'entity-bindings.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rows = Array.isArray(j?.continuouslyTraded)
      ? j.continuouslyTraded
      : null;
    if (!rows || !rows.length) return fallback;
    const out: { id: string; re: RegExp }[] = [];
    for (const r of rows) {
      const key = String(r?.key ?? '').trim();
      if (!key) continue;
      try {
        out.push({ id: String(r?.id ?? key), re: new RegExp(key, 'i') });
      } catch {
        /* a malformed pattern is skipped, never fatal — one bad row cannot dark the gate */
      }
    }
    return out.length ? out : fallback;
  } catch {
    return fallback;
  }
}

/** The Dashboard's `### <label>` sub-blocks, in order. Comments stripped: the reader never sees them. */
function dashboardBlocks(brief: string): { label: string; text: string }[] {
  const reader = brief.replace(/<!--[\s\S]*?-->/g, ' ');
  const m = reader.match(/^#\s*▸\s*THE DASHBOARD\s*$/m);
  if (!m || m.index == null) return [];
  const rest = reader.slice(m.index + m[0].length);
  const end = rest.match(/^#\s*▸/m);
  const region = end && end.index != null ? rest.slice(0, end.index) : rest;
  const out: { label: string; text: string }[] = [];
  const parts = region.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    out.push({
      label: part.slice(0, nl).trim(),
      text: part.slice(nl + 1).trim(),
    });
  }
  return out;
}

// SESSION VERBS — the vocabulary of an instrument that HAS a session. `open` as a NOUN is included
// deliberately ("from Wednesday's open"): the 08-21 defect used the verb and the noun in one
// sentence, and the noun is the more confident of the two.
//
// CALIBRATED AGAINST ALL 171 PUBLISHED BRIEFS JUDGED IN FORCE — not against the handful of recent
// nights, which is what made the first build look clean. Three corrections came out of that sweep:
//   • BARE `close`/`closes` DELETED — 11 of 28 leg-A hits, zero true positives. "if BTC CLOSES above
//     the 200-period EMA" (02-27) is standard candle-close chart language about a future bar, and
//     "The weekly CLOSE matters" is a convention, not a claimed session level. The defect is an
//     asserted past observation, so only the past-tense/possessive forms survive.
//   • `settle`/`settles` present-tense DELETED for the same reason.
//   • Bare co-occurrence in a sentence was not enough: 03-09's "Gold … floor held at $5,094
//     intraday, CLOSED ~$5,131" fired because BTC was named elsewhere in the same sentence. GOLD
//     closes; the verb has to be bound to the 24/7 instrument, so the instrument must appear within
//     PROXIMITY_CHARS before the verb.
const SESSION_VERB_RE =
  /\b(?:opened|reopened|closed|settled)\b|\b(?:the|its|his|her|a|yesterday's|today's|Monday's|Tuesday's|Wednesday's|Thursday's|Friday's|Saturday's|Sunday's)\s+(?:open|close|settle)\b|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:open|close)\b/i;
/** How far before a session verb the instrument may sit and still be its subject. */
const PROXIMITY_CHARS = 60;
// A stated observation time: a clock reading, or an explicit trailing-window phrase. "early Monday",
// "this morning" and "on the session" are ages a reader can act on for a 24/7 asset; "Thursday" alone
// is not, but a bare weekday only ever reaches leg (B) when no session verb is present.
// A DAY-PART is a stated age even without a clock: "early Monday", "this morning", "late Thursday"
// all give the reader a window they can act on. Calibrated on the real archive — WITHOUT the weekday
// alternation this leg flagged 2026-08-17's "Bitcoin traded at $63,445 EARLY MONDAY", which states
// its age in the compliant way and is exactly the silence a storm-free gate has to hold.
const STATED_OBSERVATION_TIME_RE =
  /\b\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:ET|EDT|EST|UTC|GMT|London|Singapore|HKT)?\b|\bas of\b|\bat\s+(?:the\s+)?time\s+of\s+writing\b|\b(?:this|early|late|mid-?)\s+(?:morning|afternoon|evening|today|yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b|\b(?:over|across|on)\s+(?:the\s+)?(?:past|trailing|last)\s+(?:twenty-four|24)\s*(?:-|\s)?\s*hours?\b|\btwenty-four\s+hours?\b|\b24h\b|\bon the session\b|\bintraday\b|\bthis morning\b/i;
// A money level or an index handle — the thing whose age is in question.
const LEVEL_RE = /[$€£¥]\s?\d[\d,]*(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/;

// ---------------------------------------------------------------------------
// IMP-213 — THE SESSION-CALENDAR LEG (2026-08-23 Critic mandate #1, RC2).
//
// 2026-08-23 Dashboard, Commodities & Rates: "Gold futures CLOSED SATURDAY'S SESSION at $4,680.60,
// up 2.39 percent". BRIEF_DATE 2026-08-23 is a Sunday; the sentence describes 2026-08-22, a
// SATURDAY, and COMEX gold holds no Saturday session. The last session before publication was
// Friday 2026-08-21 and it closed $4,661.60 / +1.97% — so the brief printed a level $19.00 high and
// a move 42bp fat, attributed to a session that does not exist. On the SAME PAGE the Crypto entry
// was correct ("was trading $78,352 by late afternoon in New York, up 3.9 percent over the trailing
// 24 hours"): a level, an instant and a trailing window, with no session verb. The Dashboard knows
// how to do this. It did it one sub-section away.
//
// WHY IMP-205 WAS SILENT, and it is the mirror image of what IMP-205 was built for: that leg fires
// when a 24/7 INSTRUMENT IS GIVEN A SESSION VERB. This is a SESSION-TRADED INSTRUMENT GIVEN A
// SESSION ITS VENUE DOES NOT HOLD. Gold legitimately closes, so every verb-vs-instrument leg passes
// it by construction; nothing anywhere asked whether the NAMED DAY was a trading day. Two halves of
// one question, and only one half had a gate — which is E-DASHBOARD-INFERENCE-01 re-opening in its
// mirror image four nights after it was closed.
//
// THE VENUE MODEL IS DELIBERATELY WEEKENDS-ONLY, AND THAT IS A SCOPE DECISION, NOT AN OVERSIGHT.
// The mandate names "plus the CME holiday list". THERE IS NO HOLIDAY CALENDAR ANYWHERE IN THIS
// REPO — measured this session: the only `holiday` token in scripts/ or lib/ is a comment string in
// dashboard-math-gate.ts. A holiday list typed from memory is a guess, and a guessed holiday reds a
// correct sentence, which trains the next session to skim the gate's output — the same failure as
// the bare-year price-vs-archive defect (08-11) and IMP-165's "never" false positive. Saturdays and
// Sundays are not a guess: no equity, futures or FX-fixing venue in this brief's universe holds a
// weekend session, in any year, under any calendar. That single rule catches the incident and
// cannot be wrong. When a verified holiday list lands in the repo as data, this leg extends by one
// lookup and the comment changes with it.
const SESSION_CALENDAR_EFFECTIVE_FROM = '2026-08-23'; // IMP-125: no retroactive condemnation.

// Instruments whose venue HOLDS A SESSION — so a named day is a checkable claim about that venue.
// SMALL ON PURPOSE: instruments only, never companies and never the bare word "markets". "The plant
// closed Saturday" and "Microsoft closed the deal Saturday" are ordinary English about a firm, not a
// falsifiable claim about a trading venue, and a list that reached them would buy nothing this leg
// needs. Bare "oil" is excluded for the same reason ("the oil the strait carries"); the futures
// contracts are named instead.
const SESSION_TRADED_RE = new RegExp(
  [
    // Metals and energy futures — COMEX / NYMEX / ICE
    String.raw`\bgold\b`,
    String.raw`\bsilver\b`,
    String.raw`\b(?:platinum|palladium)\b`,
    String.raw`\bcopper\b`,
    String.raw`\b(?:crude|WTI|Brent)\b`,
    String.raw`\bnatural gas\b`,
    String.raw`\b(?:gasoline|heating oil)\b`,
    // Equity indices — NYSE / Nasdaq / the overseas cash sessions this brief quotes
    String.raw`\bS&P\s*500\b`,
    String.raw`\bNasdaq\b`,
    String.raw`\bDow(?:\s+Jones)?\b`,
    String.raw`\bRussell\s*2000\b`,
    String.raw`\bVIX\b`,
    String.raw`\b(?:Nikkei|Topix|Hang\s+Seng|Shanghai\s+Composite|KOSPI|FTSE|DAX|CAC|Stoxx)\b`,
    // Rates — CME futures and cash Treasuries
    String.raw`\bTreasur(?:y|ies)\b`,
    String.raw`\b(?:two|five|ten|thirty)-year\b`,
    String.raw`\b(?:2|5|10|30)-year\b`,
    String.raw`\bfed\s+funds\s+futures\b`,
    String.raw`\bSOFR\b`,
  ].join('|'),
  'i'
);
// PAST-TENSE ONLY. "if gold CLOSES above $4,700" is a chart convention about a future bar, not an
// asserted observation — the same correction IMP-205's archive sweep forced on its own verb list.
const SESSION_CALENDAR_VERB_RE =
  /\b(?:closed|settled|opened|reopened|finished|ended)\b/i;
// A DIRECT OBJECT that makes the verb ordinary English about a firm or a place rather than a claim
// about a venue: "closed the deal", "closed the investigation", "closed the gap", "closed the
// plant", "closed the Strait of Hormuz". Deliberately does NOT list week/month/quarter/year/session
// — "the S&P closed the WEEK down 1.4 percent" is market usage and must still be judged.
const NON_MARKET_OBJECT_RE =
  /^[\s,]*(?:the|its|their|his|her|a|an|that|this)?\s*(?:deal|acquisition|transaction|merger|takeover|purchase|sale|round|financing|investigation|inquiry|probe|lawsuit|case|gap|discount|plant|factory|mine|refinery|smelter|terminal|pipeline|port|strait|border|crossing|school|store|branch|office|loophole|chapter|door|file|set|inventory|account|position\b(?!s? (?:in|at)\b))\b/i;
// A DAY NAMED NEXT TO THE VERB. The binding window is what keeps this leg off the four non-market
// uses of "closed" on the very page that carried the defect, and off one live near-miss: M&M-2's
// "…has Brent below $76 a barrel by year-end, from above $91 now, a fall of roughly 17 percent with
// the Strait of Hormuz still effectively CLOSED" names a session-traded instrument AND a date ("18
// August") in one sentence, and BOTH sit far outside the windows — the instrument ~130 chars before
// the verb, the date ~120. A leg that scored sentence-level co-occurrence would have condemned it.
const DAY_BIND_BEFORE = 45; // "…on Friday to 7,674.37 and still closed…" — 31 chars, inside.
const DAY_BIND_AFTER = 45; // "closed Saturday's session…" — 7 chars, inside.
/** How far back an EXPLICIT calendar date may sit and still be the session this brief reports. */
const SESSION_CAL_LOOKBACK_DAYS = 10;
const SESSION_CAL_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const SESSION_DAY_TOKEN_RE = new RegExp(
  [
    String.raw`\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b(?:['’]s)?`,
    String.raw`\b\d{1,2}\s+(?:${SESSION_CAL_MONTHS.join('|')})\b`,
    String.raw`\b(?:${SESSION_CAL_MONTHS.join('|')})\s+\d{1,2}\b`,
    String.raw`\b\d{4}-\d{2}-\d{2}\b`,
  ].join('|'),
  'gi'
);
// A magnitude — the thing a fabricated session actually costs the reader. IMP-205 requires the same
// (LEVEL_RE); a percent move is added because "gold closed Saturday up 2.4 percent" is the identical
// defect wearing no dollar sign.
const SESSION_CAL_MAGNITUDE_RE = new RegExp(
  `${LEVEL_RE.source}|\\d+(?:\\.\\d+)?\\s*(?:percent|%)`,
  'i'
);

/** The weekday index (0=Sunday … 6=Saturday) of a day token, plus how it was read.
 *  A WEEKDAY NAME RESOLVES TO ITSELF — "Saturday" is a Saturday in every week of every year, so no
 *  date arithmetic is done and none can go wrong. Only an EXPLICIT calendar date needs a year, and
 *  the only honest source of one is the brief's own date; that is the whole reason this leg reads
 *  `briefDate`. A date that would land far in the brief's future is read as the prior year. */
function sessionDayWeekday(
  token: string,
  briefDate: string | null
): { wd: number; resolved: string } | null {
  const t = token
    .trim()
    .toLowerCase()
    .replace(/['’]s$/, '');
  const wdIdx = WEEKDAYS.indexOf(t);
  if (wdIdx >= 0) return { wd: wdIdx, resolved: WEEKDAYS[wdIdx]! };
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${t}T12:00:00Z`);
    if (isNaN(d.getTime())) return null;
    return { wd: d.getUTCDay(), resolved: t };
  }
  let day: number | null = null;
  let mon: number | null = null;
  const dm = t.match(
    new RegExp(`^(\\d{1,2})\\s+(${SESSION_CAL_MONTHS.join('|')})$`)
  );
  const md = t.match(
    new RegExp(`^(${SESSION_CAL_MONTHS.join('|')})\\s+(\\d{1,2})$`)
  );
  if (dm) {
    day = Number(dm[1]);
    mon = SESSION_CAL_MONTHS.indexOf(dm[2]!);
  } else if (md) {
    mon = SESSION_CAL_MONTHS.indexOf(md[1]!);
    day = Number(md[2]);
  }
  if (day == null || mon == null || mon < 0) return null;
  if (!briefDate) return null; // no year, no honest resolution — stay silent
  let year = Number(briefDate.slice(0, 4));
  const mk = (y: number) =>
    `${y}-${String(mon! + 1).padStart(2, '0')}-${String(day!).padStart(2, '0')}`;
  if (mk(year) > briefDate) {
    // A date the brief could not have observed yet is last year's, not next week's.
    const daysAhead =
      (new Date(`${mk(year)}T12:00:00Z`).getTime() -
        new Date(`${briefDate}T12:00:00Z`).getTime()) /
      86400000;
    if (daysAhead > 5) year -= 1;
  }
  const d = new Date(`${mk(year)}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return { wd: d.getUTCDay(), resolved: mk(year) };
}

/** THE LEG. Reader-facing prose, comments and table rows stripped. Returns one finding per
 *  offending sentence. 24/7 instruments are handed back to IMP-205 untouched — the same registry
 *  read, not a second list to drift. */
function sessionCalendarLeg(
  brief: string,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  if (briefDate && briefDate < SESSION_CALENDAR_EFFECTIVE_FROM) return out;
  const continuous = continuouslyTradedMatchers();
  const prose = stripComments(brief)
    .split('\n')
    .filter(l => !/^\s*\|/.test(l))
    .join('\n');
  const seen = new Set<string>();
  // LINES FIRST, THEN SENTENCES. Markdown separators ("*", "###", "---") are not sentence
  // terminators, so splitting on punctuation alone welds a Dashboard sub-heading onto the tail of
  // the paragraph above it — which both muddies the quoted receipt and lets an instrument on one
  // line bind to a verb on the next.
  for (const s of prose.split(/\n+/).flatMap(l => l.split(/(?<=[.!?])\s+/))) {
    if (!SESSION_TRADED_RE.test(s)) continue;
    if (!SESSION_CAL_MAGNITUDE_RE.test(s)) continue;
    const g = new RegExp(SESSION_CALENDAR_VERB_RE.source, 'gi');
    let vm: RegExpExecArray | null;
    while ((vm = g.exec(s)) !== null) {
      const vStart = vm.index;
      const vEnd = vm.index + vm[0].length;
      const before = s.slice(Math.max(0, vStart - PROXIMITY_CHARS), vStart);
      // The instrument must be the verb's SUBJECT, within the mandate's 60 characters.
      if (!SESSION_TRADED_RE.test(before)) continue;
      // 24/7 bound to the same verb is IMP-205's finding, not this one. One defect, one row.
      if (continuous.some(c => c.re.test(before))) continue;
      // "Gold Fields closed the acquisition on Saturday" is a company closing a deal, not COMEX
      // holding a session. The direct object is what tells them apart.
      if (NON_MARKET_OBJECT_RE.test(s.slice(vEnd, vEnd + 40))) continue;
      // The named day must be bound to the verb too, or it is some other sentence's date.
      //
      // 🔴 SCANNED OVER THE WHOLE SENTENCE, NEVER OVER A SLICE. The first build windowed the
      // string first and matched inside it, and the cut end of the slice manufactured a word
      // boundary that does not exist in the text: 2026-03-13's "Brent CLOSED above $100 for the
      // first time SINCE AUGUST 2022" fell exactly 45 characters out, so the window ended mid-year
      // and "August 2022" was read as "August 2" — a Sunday, a FAIL, on a true sentence. One false
      // positive in 300 published files is still a false positive on the TRUE leg, and that is the
      // failure that teaches the next session to skim the gate. Positions are absolute now and the
      // token must match in full against the real neighbouring characters.
      const dg = new RegExp(SESSION_DAY_TOKEN_RE.source, 'gi');
      let best: { token: string; dist: number } | null = null;
      let dm: RegExpExecArray | null;
      while ((dm = dg.exec(s)) !== null) {
        const start = dm.index;
        if (start < vStart - DAY_BIND_BEFORE) continue;
        if (start > vEnd + DAY_BIND_AFTER) break;
        const dist =
          start >= vEnd
            ? start - vEnd
            : Math.max(0, vStart - (start + dm[0].length));
        if (!best || dist < best.dist) best = { token: dm[0], dist };
      }
      if (!best) continue; // no named day is no claim about a calendar
      const day = sessionDayWeekday(best.token, briefDate);
      if (!day) continue;
      if (day.wd !== 0 && day.wd !== 6) continue; // weekday: the venue was open, stay silent
      // AN EXPLICIT DATE MUST BE A DAY THE BRIEF COULD BE REPORTING. A daily brief's session verbs
      // describe the last few days; "the first time since August 22" is a historical reference and
      // a gate that condemned it would be doing arithmetic on a fact the sentence never asserted.
      // Weekday NAMES are exempt from this test — they carry no year to be wrong about.
      if (/^\d/.test(day.resolved) && briefDate) {
        const back =
          (new Date(`${briefDate}T12:00:00Z`).getTime() -
            new Date(`${day.resolved}T12:00:00Z`).getTime()) /
          86400000;
        if (back < 0 || back > SESSION_CAL_LOOKBACK_DAYS) continue;
      }
      const sentence = s.replace(/\s+/g, ' ').trim();
      const key = sentence.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      const dayName = WEEKDAYS[day.wd]!.replace(/^./, c => c.toUpperCase());
      out.push({
        check: 'session-calendar',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `A SESSION THAT DOES NOT EXIST — "${vm[0]}" is bound to a session-traded instrument and to ` +
          `"${best.token.trim()}", which is a ${dayName}${day.resolved !== WEEKDAYS[day.wd] ? ` (${day.resolved})` : ''}. ` +
          `NO EQUITY, FUTURES OR FX-FIXING VENUE HOLDS A WEEKEND SESSION, so there is no close, settle or ` +
          `open on that day to report and the level attached to it was not observed anywhere. Re-anchor to ` +
          `the LAST SESSION and say so ("Friday's close"), or rewrite as a level plus its instant. ` +
          `RECEIPT (2026-08-23): "Gold futures closed Saturday's session at $4,680.60, up 2.39 percent" — ` +
          `Friday 2026-08-21 settled $4,661.60, +1.97%, so the fabricated session cost the reader $19.00 on ` +
          `the level and 42bp on the move. On the SAME PAGE the Crypto entry was correct. Sentence: "${sentence.slice(0, 180)}"`,
      });
    }
  }
  return out;
}

export function checkObservationKind(
  brief: string,
  truth: any,
  briefDate: string | null,
  requireResolved: boolean
): { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] {
  const out: { check: string; severity: 'FAIL' | 'FLAG'; message: string }[] =
    [];
  // IMP-213 runs FIRST and on its own date shield: it is the inverse question (a session-traded
  // instrument given a day its venue does not hold) and must not be gated behind IMP-205's
  // Dashboard scoping or its 08-21 effective date.
  out.push(...sessionCalendarLeg(brief, briefDate, requireResolved));
  if (briefDate && briefDate < OBSERVATION_KIND_EFFECTIVE_FROM) return out;
  const matchers = continuouslyTradedMatchers();
  if (!matchers.length) return out;

  for (const block of dashboardBlocks(brief)) {
    // Sentence-scoped, so one correct clause cannot launder an incorrect one and one incorrect
    // clause cannot condemn a correct one. Both directions matter: on 08-21 the SAME PARAGRAPH
    // holds the defect and a compliant "by 9:15 ET" observation.
    // Markdown TABLE rows are excluded. The Dashboard was a `| Asset | Price | 1D | …` table for
    // most of the archive, and a table cell is a schema, not a sentence making an observation —
    // firing on 150 nights of legacy format would bury the one night that matters.
    const prose = block.text
      .split('\n')
      .filter(l => !/^\s*\|/.test(l))
      .join('\n');
    const sentences = prose.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const named = matchers.filter(m => m.re.test(s));
      if (!named.length) continue;
      if (!LEVEL_RE.test(s)) continue; // a sentence with no level makes no observation
      const ids = [...new Set(named.map(n => n.id))].join(', ');

      // EVERY session verb whose SUBJECT is the 24/7 instrument, not just the first — the 08-21
      // defect used three ("Wednesday close", "opened", "Wednesday's open") in one sentence, and a
      // message naming one of them would send the Editor to fix a quarter of the problem.
      const verbs: string[] = [];
      const g = new RegExp(SESSION_VERB_RE.source, 'gi');
      let vm: RegExpExecArray | null;
      while ((vm = g.exec(s)) !== null) {
        const before = s.slice(
          Math.max(0, vm.index - PROXIMITY_CHARS),
          vm.index
        );
        if (!named.some(n => n.re.test(before))) continue; // gold closes; bitcoin does not
        const v = vm[0].replace(/\s+/g, ' ').trim();
        if (!verbs.includes(v)) verbs.push(v);
      }
      if (verbs.length) {
        out.push({
          check: 'observation-kind',
          severity: requireResolved ? 'FAIL' : 'FLAG',
          message:
            `WRONG OBSERVATION KIND FOR A CONTINUOUSLY-TRADED INSTRUMENT — Dashboard "${block.label}" ` +
            `describes ${ids} with ${verbs.length} session verb(s) [${verbs.join(' · ')}]: "${s.replace(/\s+/g, ' ').trim().slice(0, 180)}". ` +
            `AN INSTRUMENT THAT NEVER CLOSES HAS NO OPEN, NO CLOSE AND NO SETTLE, so this is a category error and ` +
            `NO TIMESTAMP REPAIRS IT — dating a fiction does not make it an observation. Rewrite as a level plus its ` +
            `instant ("was trading $71,980.32 at 09:15 ET") or as a stated window ("up 7.1% over the trailing 24 hours ` +
            `to 09:15 ET"). RECEIPT (2026-08-21): "it opened Thursday at $69,289.44, up 7.1 percent from Wednesday's ` +
            `open … while ether opened at $2,251.93" — and on the SAME PAGE, Equities carried four correct closes and ` +
            `Commodities two correct settles. The Dashboard knows how to do this; it did it twice on the same page.`,
        });
      }
    }
  }

  // Truth rows are corroboration when present, never the gate's spine — `price:` rows appeared on
  // 08-14 and were absent on two of the six nights since (ESC-018), so depending on them would make
  // this leg silently conditional on a schema nobody enforces.
  const claims = truth?.claims;
  if (claims && typeof claims === 'object') {
    for (const [key, row] of Object.entries<any>(claims)) {
      if (!/^price:/.test(key)) continue;
      if (!matchers.some(m => m.re.test(key))) continue;
      if (!/-(?:open|close|settle)-/.test(key)) continue;
      out.push({
        check: 'observation-kind',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `TRUTH ROW ASSERTS A SESSION EVENT FOR A CONTINUOUSLY-TRADED INSTRUMENT — "${key}" is keyed as an ` +
          `open/close/settle row, and that instrument has none. Re-key it to the instant observed ` +
          `(price:<asset>-at-<ISO instant>) and carry observedAt. Row: ${JSON.stringify(row).slice(0, 160)}`,
      });
    }
  }
  return out;
}

const ATTR_SUPERLATIVE_EFFECTIVE_FROM = '2026-08-12';
const ATTR_FRAME_RE = new RegExp(
  [
    String.raw`by\s+(?:the\s+)?[\w'’&.-]+(?:\s+[\w'’&.-]+){0,3}(?:'s|’s)\s+own\s+(?:account|telling|description|words|reckoning)`,
    String.raw`(?:according|per)\s+to\s+(?:the\s+)?[A-Za-z][\w'’&.-]*`,
    String.raw`(?:the\s+)?(?:company|acquirer|buyer|seller|issuer|operator|agency|regulator|ministry|department|firm|maker|vendor|developer|lab)\s+(?:says|said|claims|claimed|calls|called|describes|described|bills|billed|touts|touted)`,
    String.raw`[A-Z][\w'’&.-]*(?:\s+[A-Z][\w'’&.-]*){0,3}\s+(?:says|said|claims|claimed|calls|called|describes|described|bills|billed|touts|touted)\s+(?:it|itself|them|the\s+\w+)`,
    String.raw`(?:in|on)\s+(?:its|their|his|her)\s+own\s+(?:account|telling|release|filing|words)`,
  ].join('|'),
  'i'
);
// SCOPE superlatives — claims about the EXTENT of a set, which is what a party's own wording can
// be checked against. Deliberately NOT the market-extreme family (highs/lows/since), which
// extractSuperlatives already owns against the archive.
const ATTR_SUPERLATIVE_RE =
  /\b(?:the\s+only|the\s+sole|the\s+first|the\s+largest|the\s+biggest|the\s+leading|the\s+world's|the\s+world’s|the\s+nation's|the\s+nation’s|the\s+country's|the\s+country’s|the\s+single|unique(?:ly)?)\b/i;
// A hedge the SOURCE used and the brief may have dropped.
const ATTR_HEDGE_RE =
  /\b(?:one\s+of|among\s+the|some\s+of\s+the|amongst\s+the|a\s+handful\s+of|few\s+of)\b/i;
// Scope nouns the BRIEF may have added. Each must survive in the quotation.
//
// 🔴 WORD BOUNDARIES, NOT SUBSTRINGS — this list shipped as bare `includes()` for about four
// minutes and immediately produced a FALSE POSITIVE on the very file it was built from: `ever`
// matched inside "Teledyne has n[ever] built", so a bullet the Morning Truth Gate had already
// corrected to the source's exact hedge was reported as WIDENED. A false positive on the TRUE
// leg is not harmless — it trains the next session to skim the gate's output, which is the same
// failure as the `price-vs-archive` bare-year defect (2026-08-11) and the 133%-overlap validator
// (IMP-042). Every token is now anchored, and the selftest pins the "never" case forever.
const ATTR_SCOPE_TOKENS: { label: string; re: RegExp }[] = [
  { label: 'American', re: /\bamerican?\b/i },
  { label: 'U.S.', re: /\b(?:u\.s\.|us|usa|united states)\b/i },
  { label: 'global', re: /\bglobal(?:ly)?\b/i },
  { label: "world's", re: /\bworld[’']s\b|\bworldwide\b|\bin the world\b/i },
  { label: 'national', re: /\bnational(?:ly)?\b|\bnationwide\b/i },
  { label: 'domestic', re: /\bdomestic(?:ally)?\b/i },
  { label: 'European', re: /\beuropean?\b/i },
  { label: 'Chinese', re: /\bchinese\b|\bchina\b/i },
  { label: 'ever', re: /\bever\b/i },
];

export function attributedSuperlativeClaims(
  body: string,
  briefDate: string | null
): Claim[] {
  if (briefDate && briefDate < ATTR_SUPERLATIVE_EFFECTIVE_FROM) return [];
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!SRC_SECTION_RE.test(section)) continue;
    if (!ATTR_FRAME_RE.test(text)) continue;
    if (!ATTR_SUPERLATIVE_RE.test(text)) continue;
    const sup = ATTR_SUPERLATIVE_RE.exec(text)![0].replace(/\s+/g, ' ').trim();
    const key = `attributed-superlative:${srcSlug(text.slice(0, 90))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      key,
      asset: sup,
      tier: 'critical',
      claimType: 'superlative',
      direction: 'unknown',
      magnitudePct: null,
      level: null,
      section,
      sentence: text.replace(/\s+/g, ' ').trim(),
      status: 'UNVERIFIED',
      superlative: sup,
      superlativeKind: 'other',
    });
  }
  return claims;
}

/**
 * Given a resolved truth row carrying the attributed party's `quotation`, FAIL when the brief
 * deleted the source's hedge or added a scope the source never claimed.
 */
export function attributedSuperlativeFidelity(
  claims: Claim[],
  truthClaims:
    | Record<string, { quotation?: string; resolved?: boolean }>
    | undefined
): Finding[] {
  const out: Finding[] = [];
  for (const c of claims) {
    const q = truthClaims?.[c.key]?.quotation;
    if (!q) continue; // no row → the unresolved-before-publish rail already owns it
    const quote = q.toLowerCase();
    const brief = c.sentence.toLowerCase();

    if (ATTR_HEDGE_RE.test(quote) && !ATTR_HEDGE_RE.test(brief)) {
      out.push({
        severity: 'FAIL',
        check: 'attributed-superlative-hedge-deleted',
        message:
          `ATTRIBUTED SUPERLATIVE HARDENED — the brief credits a named party with "${c.superlative}", but that party HEDGED it. ` +
          `Source said: "${q.slice(0, 220)}". Brief says: "${c.sentence.slice(0, 220)}". ` +
          `2026-08-12 receipt: C&C-1 printed "by the acquirer's own account, is the only independent supplier" against Teledyne's ` +
          `"one of the world's only credible, commercially ready independent suppliers" — and the bullet's entire chokepoint thesis ` +
          `rested on the singularity the brief added. Restore the hedge or drop the attribution.`,
        section: c.section,
      });
      continue;
    }

    const added = ATTR_SCOPE_TOKENS.filter(
      t => t.re.test(brief) && !t.re.test(quote)
    ).map(t => t.label);
    if (added.length) {
      out.push({
        severity: 'FAIL',
        check: 'attributed-superlative-scope-added',
        message:
          `ATTRIBUTED SUPERLATIVE WIDENED — the brief's "${c.superlative}" carries scope [${added.join(', ')}] that the attributed party's own wording does not. ` +
          `Source said: "${q.slice(0, 220)}". Brief says: "${c.sentence.slice(0, 220)}". ` +
          `2026-08-09 receipt: the Take lede read "the first new AMERICAN iron mine" where the company, in three identically-worded sources, ` +
          `said "in Minnesota". Narrow the claim to the source's scope, or cite the source that supports the wider one.`,
        section: c.section,
      });
    }
  }
  return out;
}

const AI_ACTION_RE =
  /\b(?:announced|unveiled|launched|released|shipped|deployed|introduced|debuted|rolled\s+out|(?:the\s+)?(?:deployment|rollout|roll-out|launch|release)\s+of)\b/i;
const AI_PRODUCT_NOUN_RE =
  /\b(?:tools?|models?|chips?|robots?|humanoids?|platforms?|systems?|apps?|assistants?|agents?|processors?|accelerators?|features?|updates?|apis?|software|hardware|devices?|drones?|silicon|frameworks?)\b/i;
const AI_HEDGE_RE =
  /\b(?:reportedly|rumored|is\s+(?:still\s+)?developing|are\s+(?:still\s+)?developing|is\s+building|are\s+building|plans?\s+to|planning\s+to|expected\s+to|set\s+to|said\s+to|in\s+talks|considering|exploring|working\s+on|is\s+expected|are\s+expected|would\s+(?:launch|release|deploy|ship|build|introduce))\b/i;

function aiProductClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const section = sectionOf(stripped, idx);
    if (!/AI\s*&\s*Tech|AI\s+and\s+Tech|AI&T/i.test(section)) continue; // AI & Tech section only
    if (!AI_ACTION_RE.test(text)) continue; // a definite product/deployment action verb
    if (!AI_PRODUCT_NOUN_RE.test(text)) continue; // on a product/deployment noun (not earnings/hiring)
    if (AI_HEDGE_RE.test(text)) continue; // an honest hedge is not the false-certainty class
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
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
const RELATIVE_SHIFT_RE =
  /\b(?:yesterday(?!['’]s)|last night|this morning|overnight|earlier today)\b/i;
const EVENT_ACTION_RE =
  /\b(?:became|becomes|sign(?:ed|s)?|ban(?:ned|s)?|announce(?:d|s)?|launch(?:ed|es)?|struck|strikes?|attack(?:ed|s)?|approve(?:d|s)?|file(?:d|s)?|reject(?:ed|s)?|pass(?:ed|es)?|rule(?:d|s)?|vote(?:d|s)?|acquire(?:d|s)?|unveil(?:ed|s)?|impose(?:d|s)?|seize(?:d|s)?|halt(?:ed|s)?|resign(?:ed|s)?|order(?:ed|s)?)\b/i;

function relativeDateFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
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
const YOY_REFERENT_RE =
  /\b(?:year[-\s]?over[-\s]?year|year[-\s]?on[-\s]?year|yoy|(?:a|one)\s+year\s+(?:earlier|ago)|(?:last|prior|previous)\s+year|year[-\s]ago|same\s+(?:quarter|period)\s+(?:a\s+year\s+ago|last\s+year))\b/i;
const YOY_PCT_RE = /\d+(?:\.\d+)?\s*(?:%|percent)/i; // no trailing \b: "%" is non-word, so "22% " has no boundary after it
const YOY_MONEY_RE = /(?:\$|USD\s*)\s?\d[\d,.]*/i;
const YOY_METRIC_RE =
  /\b(?:revenues?|earnings|per[-\s]share|EPS|net income|profits?|sales|income|backlog|orders?|bookings?|deliveries|shipments?|volumes?|deposits|premiums?|guidance)\b/i;
// Scoped to the analytical bullets + Take, where a fabricated COMPANY earnings/revenue YoY is the
// class (GM=M&M, STLD=C&C). A Signal/Discovery citing a legitimate industry YoY stat ("machine orders
// 29% ahead of last year") is a different risk and stays off the critical rails (mirrors ai-product's
// AI&T scoping — and it keeps the 07-13 Signal's real USMTO figures from blocking --require-resolved).
const YOY_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|THE TAKE|The Take/i;

function yoyComparisonClaims(body: string, _briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    // per-line: a YoY claim spans decimals ("$3.69 from $2.01"), which a split on "." fragments
    const idx = offset;
    offset += text.length + 1;
    if (!YOY_REFERENT_RE.test(text)) continue; // an explicit prior-year referent
    const pct = text.match(YOY_PCT_RE);
    if (!pct) continue; // and a percentage delta
    if (!YOY_MONEY_RE.test(text) && !YOY_METRIC_RE.test(text)) continue; // a financial claim, not trivia
    if (!YOY_SECTION_RE.test(sectionOf(stripped, idx))) continue; // the analytical-bullet + Take fabrication class only
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
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
const EARN_METRIC_RE =
  /\b(?:revenues?|sales|earnings|EPS|per[-\s]share|net income|profits?|free cash flow|FCF|operating income)\b/i;
const EARN_EXPECT_RE =
  /\b(?:consensus|estimates?|expected|expectations?|forecasts?|the\s+street|analysts?)\b|(?:vs\.?|versus)\s+\$?\d/i;
const EARN_BEATMISS_RE =
  /\b(?:beats?|missed?|topped|edged\s+(?:past|out)|came\s+in\s+(?:above|below|ahead|light)|fell\s+short|surpass(?:ed|es)|exceeded|trailed|lagged|outpaced)\b/i;
const EARN_MONEY_RE = /(?:\$|USD\s*)\s?\d[\d,.]*/i;
const EARN_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T/i;
// EFFECTIVE-DATE SCOPE (IMP-086). This claim class is NEW as of 2026-07-22. The --require-resolved
// regression fixtures (07-13, 07-17, the W28 weekly) predate it and were morning-verified under the
// legs that existed then; retroactively extracting earnings claims from them would fail their truth
// gate for a class that did not exist at publish and give zero reader benefit (they cannot be
// re-published). Enforce from the introduction date FORWARD, on DAILY briefs only — a fresh
// quarterly print is a daily phenomenon; the weekly recaps beats narratively (W28's "NVIDIA's April
// 2024 beat" is not a fresh print). A YYYY-MM-DD date >= this; weekly "2026-Wnn" and null are out.
const EARNINGS_LEG_EFFECTIVE = '2026-07-22';

// ---------------------------------------------------------------------------
// SERIES-EXTREMUM ATTESTATION (IMP-202, 2026-08-20 — the 08-20 Critic's mandate #1: a LOAD-BEARING
// SUPERLATIVE THAT WAS FALSE IN BOTH OF ITS PARTS AND REACHED THE READER).
// (The mandate named this `seriesExtremumFindings`; it is implemented as a CRITICAL CLAIM leg for
// the same reason `bylineAttributionFindings` became `bylineAttributionClaims` — the mandate's own
// remedy is "emit UNRESOLVED-FACT unless {BRIEF_DATE}-truth.json carries a `series:` row", and the
// claim rails ARE that mechanism. A Finding is advisory; a critical claim BLOCKS on
// --require-resolved, which is what "must not reach the reader" means.)
//
// WORKED FAILURE. The 08-20 M&M-3 published: "The personal savings rate ended June at 2.7 percent,
// NEAR THE LOWEST IN A SERIES BEGINNING IN 1947." Two false claims in one clause:
//   • FRED PSAVERT — the monthly personal saving rate series BEGINS JANUARY 1959, not 1947.
//   • Record low is 1.4% (July 2005). 2.7% is a ~FOUR-YEAR low, nowhere near a series low.
//   • And false a third way: April 2026 already printed 2.6%, so 2.7% is not even the 2026 low.
// It was LOAD-BEARING — the bullet's conclusion ("a household with no buffer … does not behave like
// the median household") needs the buffer to be historically extreme, and it is not. Eleven green
// gates passed it because every existing superlative leg compares a superlative against OUR ARCHIVE
// (`archiveBackstop`, `superlative-escalation-gate`), and the archive is the wrong referent: it
// knows what we have printed, not when a federal series began or what its record is.
//
// ⭐ THE GENERALISABLE POINT, which is why this is a leg and not a one-off string: A SERIES' START
// DATE AND ITS RECORD ARE FACTS ABOUT THE SERIES, NOT ABOUT TODAY'S DATUM. The datum can be
// verified from the release the brief already read; the extremum frame cannot, and it is the half
// the Writer reaches for from memory. The bullet reached for an extremum it did not need.
//
// FIRE CONDITION (all three): an EXTREMUM construction + a NUMERIC LEVEL + an UNBOUNDED-history or
// SERIES-START anchor. Resolved under `series:<slug>`, so the Morning Truth Gate must name the
// series identifier, its real start date and its real extremum before publish.
//
// NON-FIRE DISCIPLINE — the calibration IS the gate, and the mandate specified it with three cases:
//   • "the first such split since SEPTEMBER 2016, when George, Mester and Rosengren dissented"
//     (08-20 M&M-2) stays SILENT: an event-recurrence claim with a NAMED, DATED COMPARABLE is
//     bounded, checkable and was verified true. A gate that punishes the one historical claim done
//     correctly teaches the Writer to stop doing it right.
//   • "$80 million of gross profit, MORE THAN the consolidated total" (08-20 C&C-2) stays SILENT:
//     an internal comparison, no extremum.
//   • "a FOUR-YEAR low" stays SILENT — a bounded horizon is the compliant repair, and the whole
//     point of the mandate is that a four-year low is a four-year low and says so.
// ---------------------------------------------------------------------------
const SERIES_EXTREMUM_RE =
  /\b(?:record\s+(?:low|high)|all[-\s]?time\s+(?:low|high|peak)|(?:near(?:ly)?\s+(?:the\s+)?|the\s+)?(?:lowest|highest|weakest|strongest|deepest)\b|never\s+been\s+(?:lower|higher)|first\s+(?:time\s+)?on\s+record|unprecedented)/i;
// A series-start year ("in a series beginning in 1947", "since 1947", "dating to 1913") or an
// unbounded-history phrase. Either one converts a datum into a claim about the whole series.
const SERIES_UNBOUNDED_RE =
  /\b(?:in\s+a\s+series\s+(?:beginning|starting|dating)\s+(?:back\s+)?(?:in|to)\s+\d{4}|since\s+the\s+series\s+(?:began|started)|since\s+records?\s+(?:began|start)|on\s+record\b|in\s+(?:recorded\s+)?history|ever\s+recorded|all[-\s]?time|since\s+(?:18|19|20)\d{2}\b|dating\s+(?:back\s+)?to\s+(?:18|19|20)\d{2}\b)/i;
// HARD SILENCERS. A superlative BOUNDED by a named dated comparable or an explicit horizon is a
// different (and checkable) species of claim, and it is the compliant form this gate wants more of.
const SERIES_BOUNDED_RE =
  /\bsince\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:18|19|20)\d{2}\b|\bsince\s+(?:early|mid|late|last)\s+\w+|\bsince\s+Q[1-4]\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)[-\s](?:year|month|week|quarter|decade)s?\s+(?:low|high|peak|trough)\b|\bin\s+(?:more\s+than\s+)?(?:a|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:year|month|decade)s?\b/i;
const SERIES_LEVEL_RE =
  /\d+(?:\.\d+)?\s*(?:%|percent|percentage\s+points?|basis\s+points?|bp)\b|(?:\$|USD\s*)\s?\d[\d,.]*/i;
const SERIES_SECTION_RE =
  /Markets\s*&\s*Macro|Companies\s*&\s*Crypto|AI\s*&\s*Tech|AI&T|Geopolitics|THE TAKE|The Take|The Signal/i;
// Enforced from the introduction date FORWARD (mirrors EARNINGS_LEG_EFFECTIVE): the
// --require-resolved regression fixtures predate this leg and cannot be re-published.
const SERIES_LEG_EFFECTIVE = '2026-08-20';

export function seriesExtremumClaims(
  body: string,
  briefDate: string | null
): Claim[] {
  const claims: Claim[] = [];
  if (
    !briefDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) ||
    briefDate < SERIES_LEG_EFFECTIVE
  ) {
    return claims;
  }
  const stripped = stripComments(body);
  const seen = new Set<string>();
  for (const s of stripped.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const text = s[0];
    const idx = s.index ?? 0;
    const ext = text.match(SERIES_EXTREMUM_RE);
    if (!ext) continue;
    if (!SERIES_UNBOUNDED_RE.test(text)) continue; // bounded or unanchored: not a claim about a series
    if (SERIES_BOUNDED_RE.test(text)) continue; // named dated comparable / explicit horizon → compliant
    if (!SERIES_LEVEL_RE.test(text)) continue; // an extremum with no level is rhetoric, not a datum
    if (!SERIES_SECTION_RE.test(sectionOf(stripped, idx))) continue;
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const key = `series:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = text.match(/\b(?:18|19|20)\d{2}\b/);
    claims.push({
      key,
      asset: `series extremum (${ext[0].trim().toLowerCase()}${start ? `, asserted anchor ${start[0]}` : ''})`,
      tier: 'critical',
      claimType: 'superlative',
      direction: 'unknown',
      magnitudePct: null,
      level: text.match(SERIES_LEVEL_RE)?.[0] ?? null,
      section: sectionOf(stripped, idx),
      sentence: text.trim().slice(0, 220),
      status: 'UNVERIFIED',
      superlative: ext[0].trim(),
      superlativeKind: superlativeKind(ext[0]),
    });
  }
  return claims;
}

function earningsResultClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  if (
    !briefDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) ||
    briefDate < EARNINGS_LEG_EFFECTIVE
  )
    return claims;
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    // per-line: "revenue $2.56B vs $1.84B consensus" spans decimals a "." split would fragment
    const idx = offset;
    offset += text.length + 1;
    if (!EARN_METRIC_RE.test(text)) continue; // an earnings-result metric
    if (!EARN_MONEY_RE.test(text)) continue; // carrying a $ figure
    if (!EARN_EXPECT_RE.test(text) && !EARN_BEATMISS_RE.test(text)) continue; // vs an expectation OR a beat/miss verdict
    if (!EARN_SECTION_RE.test(sectionOf(stripped, idx))) continue; // the analytical earnings bullets only
    const slug = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
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
const CORP_EVENT_VERB_RE =
  /\b(?:reports?|reporting|opens?|hosts?|holds?|unveils?|launches?|kicks?\s+off|presents?|convenes?|reveals?|announces?)\b/i;
const CORP_EVENT_NOUN_RE =
  /\b(?:conference|earnings|results|keynote|summit|investor\s+day|analyst\s+day|product|launch|quarter|Q[1-4])\b/i;
const CORP_WHEN_RE =
  /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i; // weekdays only; forward "today/tomorrow" is owned by scheduledEventClaims + relativeDateFindings

function corporateEventDateFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    const idx = offset;
    offset += text.length + 1;
    if (!CORP_EVENT_VERB_RE.test(text)) continue;
    const when = text.match(CORP_WHEN_RE);
    if (!when) continue;
    if (!CORP_EVENT_NOUN_RE.test(text)) continue;
    if (SCHEDULED_EVENTS.some(e => e.re.test(text))) continue; // macro release owned by scheduledEventClaims
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
// DATED-EVENT WEEKDAY (IMP-161, 2026-08-11 — the 08-11 Critic's mandate #2, RC2).
//
// WORKED FAILURE. The 08-11 brief's C&C-2 lead sentence — its first eight words — read
// "Delaware told Verisk on Monday it may not walk away from a $2.35 billion acquisition."
// The Chancery ruling issued **Friday 2026-08-07** (Reuters, Kanishka Singh, dateline Aug 7:
// "The judge said on Friday"); Monday was Verisk's RESPONSE statement. The error then propagated
// into the payoff, whose whole frame was "all abundant on Monday."
//
// 🔴 THE CRITIC'S DIAGNOSIS WAS WRONG, AND THE PRESCRIBED FIX WOULD NOT HAVE CAUGHT IT. The
// mandate reads: the gate "fired ONCE per section" and must be "keyed by bullet index rather than
// by section." Measured instead of assumed: `corporateEventDateFindings` keys on
// `corp-event:{section}:{first 28 chars of the line}`, so two different bullets in one section
// ALREADY produce two keys — re-keying by bullet index changes nothing. The real reason C&C-2 was
// never examined is VOCABULARY. That check demands a scheduled-event VERB
// (reports/opens/hosts/unveils/launches/…) AND an event NOUN (conference/earnings/keynote/Q_/…).
// C&C-2's verbs are told/found/ordered/signed/walked and its nouns are acquisition/deal/merger.
// It matches neither list and could not have fired under any keying. Receipt: `fact-gate` on the
// real `daily-briefs/2026-08-11-v2.md` emits exactly ONE corporate-event-date row, on C&C-1
// (Archer/Boeing), and zero on C&C-2. Applying the mandate literally would have shipped a green
// gate and the same falsehood — which is why this is a new check, not a re-key.
//
// THE CHECK. `corporate-event-date` covers a company's SCHEDULED FUTURE event. This covers the
// other half: a named actor's COMPLETED action pinned to a weekday, where the weekday is a fact
// about the SOURCE'S DATELINE and never about the reading date.
//
// SCOPING — the discriminator is the preposition "on", and it is doing real work. A brief names
// weekdays constantly for market data ("S&P finished Monday flat", "Monday's session", "closed
// Friday at a record"); flagging those is a noise storm that trains the reader to skim the gate.
//   FIRE   : "on <weekday>" + an ACTION verb (told/ruled/published/signed/announced/…)
//   SILENT : forward markers — "by Sunday", "Watch Sunday", "through Sunday's lapse", "lapses on
//            Sunday", "until Friday" — a computed future date is not an event claim
//   SILENT : no "on" — "finished Monday flat", "Monday's brief", "percent higher on Monday"
//            (no action verb)
//   SILENT : any line `corporate-event-date` already owns — one row per bullet, never two
// ---------------------------------------------------------------------------
const DATED_ON_WEEKDAY_RE =
  /\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
// Completed actions by a named actor: legal, corporate, communicative. NOT market verbs
// (closed/finished/rose/fell) — those are owned by the price and truth-direction checks.
const DATED_EVENT_ACTION_RE =
  /\b(?:told|said|ruled|found|ordered|granted|denied|approved|rejected|blocked|dismissed|upheld|sued|charged|fined|indicted|announced|published|filed|released|signed|issued|voted|agreed|confirmed|acquired|bought|sold|resigned|stepped\s+down|died|met|struck|imposed|lifted|banned|seized|arrested|withdrew|halted|suspended|terminated|awarded|settled)\b/i;
// A forward/span marker anywhere before the weekday turns it into a schedule, not a dateline.
const DATED_FORWARD_RE =
  /\b(?:by|through|until|till|before|ahead\s+of|watch|expects?|expected|due|scheduled|upcoming|next|will\s+\w+|lapses?|expires?|begins?|starts?)\b[^.]{0,45}\bon\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

function datedEventWeekdayFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  // Lines corporate-event-date already owns — never emit a second row for the same bullet.
  const owned = new Set(
    corporateEventDateFindings(body, _briefDate).map(f =>
      f.message.slice(0, 200)
    )
  );
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    const idx = offset;
    offset += text.length + 1;
    const when = text.match(DATED_ON_WEEKDAY_RE);
    if (!when) continue;
    if (!DATED_EVENT_ACTION_RE.test(text)) continue;
    if (DATED_FORWARD_RE.test(text)) continue;
    if (SCHEDULED_EVENTS.some(e => e.re.test(text))) continue; // macro release owned elsewhere
    // Suppress if corporate-event-date already produced a row quoting this same line.
    const snippet = text.trim().slice(0, 140);
    if ([...owned].some(m => m.includes(snippet.slice(0, 60)))) continue;
    const section = sectionOf(stripped, idx);
    const key = `dated-event:${section}:${text.trim().slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      check: 'dated-event-weekday',
      severity: 'FLAG',
      message: `DATED-EVENT WEEKDAY — a completed action is pinned to "${when[1]}" in ${section}: "${snippet}". A weekday attached to a court ruling, a filing, an announcement or a statement is a fact about the SOURCE'S DATELINE, never about the reading date. MORNING GATE: resolve this row against a dated primary and rewrite the weekday if it is wrong. UNRESOLVED-FACT if no primary confirms it. Receipt: the 08-11 C&C-2 lead read "Delaware told Verisk on Monday"; the Chancery ruling issued Friday 2026-08-07 (Reuters, dateline Aug 7, "The judge said on Friday") and Monday was Verisk's response statement — the error propagated into the payoff's "all abundant on Monday" frame.`,
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
const SEGMENT_METRIC_RE =
  /\b(?:data[-\s]?cent(?:er|re)|cloud|gaming|client|enterprise|embedded|networking|automotive)\s+(?:gpu|cpu|accelerator|silicon|chips?|processors?|npu|asics?)\s+(?:revenues?|sales|billings?)\b/i;

function segmentMetricFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const text of stripped.split('\n')) {
    const idx = offset;
    offset += text.length + 1;
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
const STOCK_SUBJECT_RE =
  /\b(?:the stock|the shares|its shares|the share price|its share price|the equity|shares)\b/i;
const STOCK_MOVE_VERB_RE =
  /\b(fell|rose|dropped?|gained?|surged?|slid|slide|jumped?|sank|sunk|plunged?|climbed?|tumbled?|soared?|slipped?|rallied|declined?|shed|lost|popped?|cratered?)\b/i;
const STOCK_YOY_REFERENT_RE =
  /\b(a year earlier|year[- ]over[- ]year|yoy\b|from (?:a|last) year|versus last year|vs\.? last year|year[- ]ago)\b/i;
function stockMoveReactionFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  const stripped = stripComments(body);
  const seen = new Set<string>();
  let offset = 0;
  for (const line of stripped.split('\n')) {
    const idx = offset;
    offset += line.length + 1;
    if (!EARN_SECTION_RE.test(sectionOf(stripped, idx))) continue; // M&M / C&C / AI&T only
    // Scan EACH explicit-equity-subject occurrence and bind the % that sits in the SAME clause
    // (a ~70-char window after the subject). This is why a distant metric % on the same long
    // bullet ("RPO surged 84% … shares held a 9% gain") is not misread as the stock move: the
    // window around "shares" carries the 9%, not the 84%. The explicit subject is also why an
    // index move ("S&P fell 1.2%") and a name-only move ("Micron surged 12%") stay silent.
    const subjRe = new RegExp(STOCK_SUBJECT_RE.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = subjRe.exec(line)) !== null) {
      const win = line.slice(m.index, m.index + 70);
      if (!STOCK_MOVE_VERB_RE.test(win)) continue; // a move verb near the subject
      const pctM = win.match(PCT_RE);
      if (!pctM) continue; // a % bound to that clause
      if (STOCK_YOY_REFERENT_RE.test(line.slice(m.index, m.index + 110)))
        continue; // a YoY — owned by yoy
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
  const m = body.match(/^#{1,3}\s*▸?\s*THE TAKE\s*$/im);
  if (m?.index === undefined) return null;
  const start = m.index + m[0].length;
  const after = body.slice(start);
  const nxt = after.search(/^#\s*▸/m);
  return { start, end: nxt === -1 ? body.length : start + nxt };
}
const TAKE_SHARE_OF_WORLD_RE =
  /(\d+(?:\.\d+)?)\s*(?:%|percent\b)\s+of\s+(?:the\s+world'?s?|all\b|global\b|the\s+global\b|the\s+entire\b)/i;
const TAKE_FULL_PERIOD_RE =
  /\b(?:in|for|across|over|against)\s+all\s+of\s+((?:20\d\d)|last year)\b|\bfor\s+the\s+full\s+year\s+(20\d\d)\b/i;
const TAKE_BENCHMARK_CMP_RE =
  /\b(?:larger|bigger|greater|more)\s+than\s+the\s+(?:entire|whole|combined|total)\s+[A-Za-z]/i;
const TAKE_FIGURE_RE =
  /[$€£¥]\s?\d[\d,.]*\s*(?:billion|million|trillion|bn\b|mn\b)?|\b\d[\d,.]*\s*(?:billion|million|trillion|barrels?|tonnes?|tons?|units?|trucks?)\b/i;
function takeExtraordinaryFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
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
    const idx = offset;
    offset += line.length + 1;
    if (idx < region.start || idx >= region.end) continue;
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const s = sentence.trim();
      if (!s) continue;
      const shareM = s.match(TAKE_SHARE_OF_WORLD_RE);
      if (shareM)
        push(
          'share-of-world',
          idx,
          s,
          `A share-of-the-whole superlative (${shareM[0].trim()}) requires a denominator somebody publishes — this is the class IMP-107's corroboration gate misses, because its noun set is issuance/supply/market.`
        );
      const periodM = s.match(TAKE_FULL_PERIOD_RE);
      if (periodM && TAKE_FIGURE_RE.test(s))
        push(
          'full-period-baseline',
          idx,
          s,
          `A full-period aggregate ("${periodM[0].trim()}") used as a comparison BASELINE is the single most error-prone figure in a Take: a YTD sum relabelled as an annual total inverts the comparison it is carrying.`
        );
      const cmpM = s.match(TAKE_BENCHMARK_CMP_RE);
      if (cmpM)
        push(
          'benchmark-comparison',
          idx,
          s,
          `A "${cmpM[0].trim()}…" comparison asserts two magnitudes at once — the claim AND the benchmark — and neither is sourced by the sentence.`
        );
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
const HEADLINE_DATELINE_RE =
  /^(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*(?:[–—-]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{1,2})?,?\s+20\d\d$/i;
const HEADLINE_WORDNUM_RE =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\b/i;
const HEADLINE_PRICE_RE =
  /\$\s?\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:%|percent\b)|\b\d[\d,]*\.\d+\b|\b\d{1,3}(?:,\d{3})+\b/g;
// The head region ends at the Dashboard: everything above it is title + payoff intro.
function headlineRegion(body: string): string {
  const d = body.search(/^#\s*▸\s*THE DASHBOARD/m);
  return d === -1 ? body.slice(0, 4000) : body.slice(0, d);
}
// The Daily Title is the first ##/### heading above the Dashboard that is not the date line.
// (Heading level drifted between ## and ### across the archive; both are accepted.)
function dailyTitleMatch(
  body: string
): { raw: string; title: string; idx: number } | null {
  const head = headlineRegion(body);
  for (const m of head.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)) {
    const title = m[1]!.trim();
    if (HEADLINE_DATELINE_RE.test(title)) continue;
    return { raw: m[0], title, idx: m.index! };
  }
  return null;
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
function headlineAnchorClaims(body: string, briefDate: string | null): Claim[] {
  const claims: Claim[] = [];
  // DAILY BRIEFS ONLY, and only from the enforcement epoch forward. A week id ("2026-W28") has no
  // Daily Title and no watch line — running the extractor over a Weekly produced junk claims off its
  // "July 5-11, 2026" date-range heading.
  if (
    !briefDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) ||
    briefDate < HEADLINE_EPOCH
  )
    return claims;
  const head = headlineRegion(body);
  const tm = dailyTitleMatch(body);
  if (!tm) return claims;

  // (a) THE DAILY TITLE. Any digit or cardinal word-numeral in the title. A bare 4-digit YEAR is
  // excluded — "The 2026 Problem" names a period, not a measurement, and nothing is resolvable there.
  const titleDigits = (tm.title.match(/\d[\d,.]*/g) || []).filter(
    n => !/^20\d\d$/.test(n)
  );
  const titleWords =
    tm.title.match(new RegExp(HEADLINE_WORDNUM_RE.source, 'gi')) || [];
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
    for (const n of [...new Set(window.match(HEADLINE_PRICE_RE) || [])].slice(
      0,
      3
    )) {
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
const BYLINE_OUTLET_RE =
  /\b(Bloomberg|Reuters|the FT|the Financial Times|the Journal|the WSJ|the Times|the New York Times|CNBC|Axios|Politico)(?:['’]s)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g;
function bylineAttributionClaims(
  body: string,
  briefDate: string | null
): Claim[] {
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
const DERIVED_PRICE_FRAME_RE =
  /\b(?:clos(?:e|ed|ing)|settle(?:s|d|ment)?|price|high|low)\b(?:\s+\w+){0,2}\s+of\s+(\$\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)\s+(?:IPO\s+price|offer(?:ing)?\s+price|strike|clos(?:e|ing)\b)/gi;
// A magnitude unit word disqualifies a figure as a PRICE POINT: "$60 billion" is a deal size.
const DERIVED_MAGNITUDE_UNIT_RE =
  /^\s*(?:billion|trillion|million|thousand|bn\b|tn\b|mn\b|k\b|b\b|m\b)/i;
// A percentage-CHANGE claim: the change verb PRECEDES the figure (within 40 chars). Digits only —
// a word numeral ("seventy percent") is not reliably a computed change and stays off this leg.
const DERIVED_PCT_CHANGE_RE =
  /\b(?:fallen|fell|falls|risen|rose|rises|dropp?(?:ed|ing)?|declin(?:ed|ing|e)|gained?|lost|losing|slid|slipp?ed|surged|jumped|plunged|climbed|sank|shed|down|up|off)\b[^.]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/gi;

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
function framedPrices(
  text: string
): { raw: string; value: number; idx: number }[] {
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

function derivedArithmeticClaims(
  body: string,
  briefDate: string | null
): Claim[] {
  const claims: Claim[] = [];
  // ENFORCEMENT EPOCH, same discipline as IMP-116/117: the truth files of published briefs cannot
  // carry a `derived:*` key, so the archive is read, never condemned.
  if (
    !briefDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) ||
    briefDate < DERIVED_EPOCH
  )
    return claims;
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
function derivedPercentageInconsistencies(
  bullet: string,
  tolerancePp = 3
): { pct: number; best: number | null; prices: number[] }[] {
  const prices = [...new Set(framedPrices(bullet).map(p => p.value))];
  if (prices.length < 2) return [];
  const candidates: number[] = [];
  for (const a of prices)
    for (const b of prices) {
      if (a === b) continue;
      candidates.push(Math.abs((b - a) / a) * 100);
    }
  const out: { pct: number; best: number | null; prices: number[] }[] = [];
  for (const m of bullet.matchAll(DERIVED_PCT_CHANGE_RE)) {
    const pct = parseFloat(m[1]!);
    if (!Number.isFinite(pct)) continue;
    let best: number | null = null;
    for (const c of candidates)
      if (best === null || Math.abs(c - pct) < Math.abs(best - pct)) best = c;
    if (best !== null && Math.abs(best - pct) > tolerancePp)
      out.push({ pct, best, prices });
  }
  return out;
}

function derivedPercentageFindings(
  body: string,
  _briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  for (const b of bulletRegions(body)) {
    for (const bad of derivedPercentageInconsistencies(b.text)) {
      findings.push({
        check: 'derived-percentage-inconsistent',
        severity: 'FLAG',
        message: `derived-percentage-inconsistent — the bullet claims a ${bad.pct}% change, but no ordered pair of the prices it prints (${bad.prices.map(p => `$${p}`).join(', ')}) produces it; the nearest is ${bad.best!.toFixed(1)}%, off by ${Math.abs(bad.best! - bad.pct).toFixed(1)}pp. A bullet whose analytical claim IS a computation must recompute from a verified input, not renumber. Section: ${sectionOf(body, b.idx)}. "${b.text.replace(/\s+/g, ' ').slice(0, 180)}"`,
      });
    }
  }
  return findings;
}

// ─── IMP-208 — COMPOSITION RECONCILIATION (2026-08-22 Critic mandate #1, RC2) ────────────────
//
// THE FAILURE. AI&T-3 printed four numbers about ONE release and they did not describe the same
// world: total Korean exports +61.5% in the first twenty days of August · semiconductors ~47% of
// everything Korea ships · semiconductors +~200% · "strip semiconductors out and the rest of
// Korean exports grew roughly 10 percent". Run the decomposition and the headline total refutes
// the bullet's own residual:
//
//     total +61.5%  ->  ex-semiconductor +14.5%   ← the bullet says 10
//     total +56.0%  ->  ex-semiconductor  +9.3%   ← reconciles with the bullet's own residual
//
// The Korea Herald reported +56% on the SAME customs release. The two subsidiary figures were
// independently verified and both CHECK OUT. So the odd number was the headline — and the bullet
// carried its own refutation onto the page. `validate-brief`, `fact-gate`, `ceiling-lint` and
// `novelty-gate` all exited 0, because every one of them checks numbers AGAINST THE OUTSIDE WORLD
// or AGAINST THE ARCHIVE and not one of them checks them AGAINST EACH OTHER. A bullet that prints
// both a total and its residual has published an equation; nothing on disk ran it.
//
// WHAT THIS CHECKS. Inside a SINGLE bullet — one bullet is one argument, the same unit
// `derivedPercentageFindings` uses — find all four terms of a composition statement:
//   (a) a composite growth rate,  (b) a component's share of the composite,
//   (c) that component's growth rate,  (d) an EXPLICIT residual for the remainder.
// Recompute (d) from (a)(b)(c) on CURRENT-period shares and FAIL on divergence > 2pp. The message
// prints the recomputed value AND all four inputs so the Writer can see which of the four is the
// odd one out — the fix on 08-22 was to strike ONE number, not to renumber the other three.
//
// THE ARITHMETIC, and why current-period shares. The share a brief prints is always the
// component's share of the CURRENT total ("semiconductors are 47 percent of everything Korea
// ships"), never of the base-period total. So: T1 = 1+g; C1 = s·T1; C0 = C1/(1+c); R0 = 1-C0;
// R1 = T1-C1; r = R1/R0 - 1. That reproduces the mandate's receipts to two decimals (61.5/47.2/199
// -> 14.45; 56.0/47.2/199 -> 9.28), and the selftest pins BOTH so a "simplification" of this
// formula into the base-share version cannot land silently.
//
// ANTI-NOISE — THE EXPLICIT RESIDUAL IS THE WHOLE TRIGGER, AND IT IS MEASURED.
// The tempting construction ("a bullet with four percentages") is a flag generator: the SAME PAGE
// carries M&M-2, which prints $102.20, ~$170, +28%, +47%, $4.10/$3.83, $5.45/$5.05 — six
// magnitudes that are not a composite-and-residual set, and a gate that fires there is a gate the
// Writer learns to route around. So the trigger is the rarest and most self-announcing term:
// an EXPLICIT EXCLUSION ("strip X out", "excluding X", "ex-X", "net of X") that is followed in the
// same sentence by a growth rate and names an aggregate noun. Measured across 20,850 bullets in
// every published brief AND every draft in the repo: 5 bullets reach the exclusion clause, all 5
// are this one Korea story's lineage, and exactly 2 assemble a complete four-tuple — the v1 and
// v1.5 copies of the defect. FALSE-POSITIVE FLOOR ACROSS 300 PUBLISHED FILES: 0.
//
// SEVERITY. Advisory FLAG in the evening (the brief always ships) and FAIL under
// --require-resolved, the `checkObservationKind` pattern — because unlike a price, this defect
// needs no source to resolve: the reader can run the equation, so the Morning Truth Gate can too.
const COMPOSITION_EFFECTIVE_FROM = '2026-08-22';

// An EXPLICIT exclusion of a named component. Deliberately NOT "without"/"minus"/"other than
// that" — the loose members of this family appear in ordinary prose ("produces this print without
// an extra wafer", in the very bullet that fails) and buy nothing, because a real composition
// bullet announces its subtraction.
const COMPOSITION_EXCLUSION_RE =
  /\b(?:strip(?:ping|ped|s)?|exclud(?:e|es|ed|ing)|net\s+of|leav(?:e|ing)\s+out|set(?:ting)?\s+aside|apart\s+from|back(?:ing)?\s+out)\s+(?:out\s+)?(?:the\s+|its\s+|all\s+)?([A-Za-z][A-Za-z-]{3,28})|\bex-([A-Za-z][A-Za-z-]{3,28})/i;
// A growth rate: a genuine CHANGE verb PRECEDING the figure. "run at 180 to 200 percent" and
// "a 200 percent growth rate is partly a base effect" are rates DESCRIBED, not changes CLAIMED,
// and both sit in the 08-22 bullet — reading either as the composite would misattribute the odd
// number and send the Editor to correct a true sentence.
const COMPOSITION_GROWTH_RE =
  /\b(?:grew|grow(?:s|ing|n)?|rose|ris(?:e|es|ing|en)|increas(?:e|es|ed|ing)|expand(?:s|ed|ing)?|climb(?:s|ed|ing)?|advanc(?:e|es|ed|ing)|gain(?:s|ed|ing)?|jump(?:s|ed|ing)?|surg(?:e|es|ed|ing)|up)\b[^.;:]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|percent\b)/i;
// A SHARE of the composite, in any of the three shapes a brief actually writes.
const COMPOSITION_SHARE_RE =
  /(\d+(?:\.\d+)?)\s*(?:%|percent)\s+(?:of|share)\b|\bshare\s+of\b[^.;:]{0,40}?(\d+(?:\.\d+)?)\s*(?:%|percent)|\bat\s+(\d+(?:\.\d+)?)\s*(?:%|percent)\s+concentration/i;
// The aggregate the composite growth is ABOUT. Requiring the residual clause and the composite
// clause to name the SAME aggregate is what stops two unrelated growth rates in one bullet from
// being read as a decomposition.
const COMPOSITION_AGGREGATE_RE =
  /\b(exports?|imports?|shipments?|sales|revenues?|turnover|output|production|orders?|bookings?|deliveries|spending|capex|billings|volumes?|the\s+index|the\s+total|the\s+basket)\b/i;

export interface CompositionUnit {
  component: string; // the excluded component, as the bullet names it
  aggregate: string; // the composite noun both clauses must share
  compositePct: number; // (a) the headline growth rate
  sharePct: number; // (b) the component's share of the CURRENT total
  componentPct: number; // (c) the component's growth rate
  residualPct: number; // (d) the residual the bullet states outright
  compositeSentence: string;
  residualSentence: string;
}

/** The residual growth implied by (composite growth, current-period share, component growth). */
export function reconcileResidualGrowth(
  compositePct: number,
  sharePct: number,
  componentPct: number
): number | null {
  const g = compositePct / 100;
  const s = sharePct / 100;
  const c = componentPct / 100;
  if (!(s > 0 && s < 1)) return null; // a share is a proper fraction or it is not a share
  if (c <= -1 || g <= -1) return null; // a total cannot shrink by more than itself
  const T1 = 1 + g;
  const C1 = s * T1;
  const C0 = C1 / (1 + c);
  const R0 = 1 - C0;
  const R1 = T1 - C1;
  if (R0 <= 0 || R1 < 0) return null; // degenerate: the component alone exceeded the base total
  return (R1 / R0 - 1) * 100;
}

/** Sentences of one bullet, with the markdown lead-in bolding removed. */
function compositionSentences(bullet: string): string[] {
  return bullet
    .replace(/\*\*/g, '')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);
}

/** Every complete composition-and-residual set stated inside ONE bullet. Pure — no disk. */
export function compositionUnits(bullet: string): CompositionUnit[] {
  const sents = compositionSentences(bullet);
  // (d) FIRST, because the explicit residual is the trigger: no subtraction announced, no equation.
  let component = '';
  let aggregate = '';
  let residualPct: number | null = null;
  let residualIdx = -1;
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i]!;
    const ex = s.match(COMPOSITION_EXCLUSION_RE);
    if (!ex || ex.index == null) continue;
    const term = (ex[1] ?? ex[2] ?? '').trim();
    if (!term) continue;
    // The rate must come AFTER the exclusion — otherwise "a 200 percent growth rate … without an
    // extra wafer" reads backwards as a residual.
    const g = s.slice(ex.index + ex[0].length).match(COMPOSITION_GROWTH_RE);
    if (!g) continue;
    const agg = s.match(COMPOSITION_AGGREGATE_RE);
    if (!agg) continue;
    component = term;
    aggregate = agg[1]!;
    residualPct = parseFloat(g[1]!);
    residualIdx = i;
    break;
  }
  if (!component || residualPct == null || !Number.isFinite(residualPct))
    return [];

  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stem = component.toLowerCase().replace(/(?:ies|es|s)$/, '');
  const componentRe = new RegExp('\\b' + esc(stem), 'i');
  const aggregateRe = new RegExp('\\b' + esc(aggregate), 'i');

  // (b) and (c) live wherever the bullet talks about the COMPONENT.
  let sharePct: number | null = null;
  let componentPct: number | null = null;
  for (let i = 0; i < sents.length; i++) {
    if (i === residualIdx) continue;
    const s = sents[i]!;
    if (!componentRe.test(s)) continue;
    if (sharePct == null) {
      const m = s.match(COMPOSITION_SHARE_RE);
      if (m) sharePct = parseFloat((m[1] ?? m[2] ?? m[3])!);
    }
    if (componentPct == null) {
      const m = s.match(COMPOSITION_GROWTH_RE);
      if (m) componentPct = parseFloat(m[1]!);
    }
  }

  // (a) is the growth rate of the aggregate in a sentence that is NOT about the component. This is
  // the term the 08-22 published bullet deleted rather than corrected — which is exactly why the
  // published copy must stay silent here: three of four terms is not an equation.
  let compositePct: number | null = null;
  let compositeSentence = '';
  for (let i = 0; i < sents.length; i++) {
    if (i === residualIdx) continue;
    const s = sents[i]!;
    if (componentRe.test(s)) continue;
    if (!aggregateRe.test(s)) continue;
    const m = s.match(COMPOSITION_GROWTH_RE);
    if (!m) continue;
    compositePct = parseFloat(m[1]!);
    compositeSentence = s.trim();
    break;
  }

  if (
    compositePct == null ||
    sharePct == null ||
    componentPct == null ||
    !Number.isFinite(compositePct) ||
    !Number.isFinite(sharePct) ||
    !Number.isFinite(componentPct)
  )
    return [];

  return [
    {
      component,
      aggregate,
      compositePct,
      sharePct,
      componentPct,
      residualPct,
      compositeSentence,
      residualSentence: sents[residualIdx]!.trim(),
    },
  ];
}

/** IMP-208 — a bullet that prints both a total and its residual has published an equation. */
export function checkCompositionReconciliation(
  body: string,
  briefDate: string | null,
  requireResolved = false,
  tolerancePp = 2
): Finding[] {
  const findings: Finding[] = [];
  // NO RETROACTIVE CONDEMNATION (IMP-125): the archive is read, never condemned.
  if (
    !briefDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(briefDate) ||
    briefDate < COMPOSITION_EFFECTIVE_FROM
  )
    return findings;
  const stripped = stripComments(body);
  for (const b of bulletRegions(stripped)) {
    for (const u of compositionUnits(b.text)) {
      const implied = reconcileResidualGrowth(
        u.compositePct,
        u.sharePct,
        u.componentPct
      );
      if (implied == null) continue;
      const divergence = Math.abs(implied - u.residualPct);
      if (divergence <= tolerancePp) continue;
      findings.push({
        check: 'composition-reconciliation',
        severity: requireResolved ? 'FAIL' : 'FLAG',
        message:
          `UNRESOLVED-FACT: composition-reconciliation — THIS BULLET CONTRADICTS ITS OWN ARITHMETIC. ` +
          `It states a composite growth of ${u.compositePct}% for ${u.aggregate}, a ${u.sharePct}% share for ` +
          `${u.component}, ${u.componentPct}% growth for ${u.component}, and an explicit ex-${u.component} ` +
          `residual of ${u.residualPct}%. Those four cannot all be true: ${u.compositePct}/${u.sharePct}/${u.componentPct} ` +
          `implies a residual of ${implied.toFixed(1)}%, which is ${divergence.toFixed(1)}pp from the ${u.residualPct}% printed. ` +
          `ONE OF THE FOUR IS THE ODD NUMBER — find it before publish; do not renumber the other three to fit. ` +
          `Solve backwards for each in turn: the composite that would produce a ${u.residualPct}% residual, the share that ` +
          `would, the component rate that would. Whichever the source supports is the survivor. RECEIPT (2026-08-22, the ` +
          `defect that shipped): AI&T-3 printed 61.5% total / 47% semiconductors / +200% semiconductors / "roughly 10 ` +
          `percent" ex-semiconductors. 61.5 implies 14.5; 56.0 implies 9.3; The Korea Herald reported 56% on the same ` +
          `customs release and BOTH subsidiary figures verified independently — the headline was the odd number and the ` +
          `fix was to STRIKE it, not to renumber the residual. Section: ${sectionOf(stripped, b.idx)}. ` +
          `Composite clause: "${u.compositeSentence.replace(/\s+/g, ' ').slice(0, 150)}". ` +
          `Residual clause: "${u.residualSentence.replace(/\s+/g, ' ').slice(0, 150)}".`,
      });
    }
  }
  return findings;
}

// ─── IMP-196 — DASHBOARD LEVEL RECENCY (2026-08-19 Critic mandate #1, RC2, root RC5) ─────────
//
// THE FAILURE: the 08-19 Dashboard printed *"the thirty-year Treasury yield HELD its 2007 high
// near 5.31 percent"* and built the day's conclusion on it — *"today the long end held while gold
// gave ground, which makes it a trade about the cost of capital."* 5.31 was MONDAY's print.
// Tuesday made a NEW 19-year intraday high at 5.33 and then closed DOWN more than 2bp at ~5.285
// (CNBC, both days). The level was stale, the verb was wrong, and the paragraph's conclusion was
// the exact inverse of what the session did.
//
// It got there through a DECLARATION. The v2's own owed-block, written before the error, reads:
// "NO TREASURY LEVEL PUBLISHES TONIGHT, 5th consecutive day … attributed to five same-week
// secondary confirmations, not to a primary print." Five confirmations all confirming the same
// week — and the week moved. **A declaration is not a check.** Nothing on disk compared the
// number about to be printed against the number already printed.
//
// WHAT THIS CHECKS: for each instrument named in the Dashboard, take the PRECISE level attached
// to it. If that exact level already appears against the same instrument in any of the last 3
// published Dashboards, AND the sentence carrying it attaches a directional or stasis verb
// (held / rose / fell / unchanged / sat at / topped), emit UNRESOLVED-FACT naming the instrument,
// the repeated level, and the brief it repeats from.
//
// WHY "PRECISE" IS PART OF THE TEST, AND NOT A LOOPHOLE. Built to fire on ANY repeated number,
// this flags the 08-19 Dashboard's *"WTI ran to roughly $84 and Brent touched $91"* against the
// 08-18 Dashboard's *"Brent near $91 and WTI near $84"* — two ROUNDED crude levels that recur
// across days for the ordinary reason that crude spent two days near those handles. A gate whose
// first live night produces two false alarms beside one true one is a flag generator, and the
// ledger's proxy-discipline rule (rule 6) exists because that pace is the documented anti-pattern.
// A rounded whole-dollar handle repeating is not evidence of staleness; 5.31 repeating to the
// cent, under "held", is. So: ≥1 decimal place, or ≥4 significant digits.
const DASH_VERB_RE =
  /\b(held|holds|holding|rose|rises|fell|falls|unchanged|flat at|sat at|sits at|stayed at|remains? at|topped|tops)\b/i;

// One entry per instrument the Dashboard actually prices. `pct: true` means the instrument's
// LEVEL is quoted as a percentage (a yield), so a percent token near it is a level, not a change.
const DASH_INSTRUMENTS: { key: string; re: RegExp; pct: boolean }[] = [
  {
    key: 'thirty-year Treasury yield',
    re: /\b(?:thirty|30)[-\s]year\s+(?:treasury|bond|yield|us treasury)/i,
    pct: true,
  },
  {
    key: 'ten-year Treasury yield',
    re: /\b(?:ten|10)[-\s]year\s+(?:treasury|note|yield|us treasury)/i,
    pct: true,
  },
  {
    key: 'two-year Treasury yield',
    re: /\b(?:two|2)[-\s]year\s+(?:treasury|note|yield)/i,
    pct: true,
  },
  { key: 'gold', re: /\bgold\b/i, pct: false },
  { key: 'silver', re: /\bsilver\b/i, pct: false },
  { key: 'WTI', re: /\bWTI\b/i, pct: false },
  { key: 'Brent', re: /\bBrent\b/i, pct: false },
  { key: 'bitcoin', re: /\bbitcoin\b/i, pct: false },
  { key: 'ether', re: /\bether(?:eum)?\b/i, pct: false },
  { key: 'the S&P 500', re: /\bS&P\s*500\b/i, pct: false },
  { key: 'the Nasdaq', re: /\bNasdaq\b/i, pct: false },
  { key: 'the Dow', re: /\bDow\b/i, pct: false },
];

/**
 * The Dashboard region of a brief — everything under `# ▸ THE DASHBOARD` up to the next `# ▸`.
 *
 * Done by index, not by one regex. The obvious form — `/^#\s*▸\s*THE DASHBOARD\s*$([\s\S]*?)
 * (?=^#\s*▸|\s*$)/m` — returns the EMPTY STRING on every real brief, because under `/m` the
 * alternative `\s*$` matches immediately at the start of the lazy capture (the newline ending the
 * header line satisfies `\s*`, and `$` then holds). It compiles, it runs, it silently reads no
 * Dashboard at all. Caught here on 2026-08-19 only because the mandate came with a case that had
 * to FIRE; a check whose only test was "stays silent on healthy briefs" would have shipped green
 * and inert. That is the argument for both-direction receipts in one line.
 */
export function dashboardRegion(body: string): string {
  const src = stripComments(body);
  const m = src.match(/^#[ \t]*▸[ \t]*THE DASHBOARD[ \t]*$/m);
  if (!m || m.index == null) return '';
  const from = m.index + m[0].length;
  const rest = src.slice(from);
  const next = rest.match(/^#[ \t]*▸/m);
  return next && next.index != null ? rest.slice(0, next.index) : rest;
}

/** A level is PRECISE if it carries a decimal, or has 4+ significant digits (64,170 / 4,387.25). */
function isPreciseLevel(raw: string): boolean {
  if (raw.includes('.')) return true;
  return raw.replace(/[^0-9]/g, '').replace(/^0+/, '').length >= 4;
}

export interface DashLevel {
  instrument: string;
  level: string;
  sentence: string;
}

/**
 * (instrument → precise level) pairs printed in a Dashboard. The level is the FIRST precise
 * number after the instrument's name that is not closer to some OTHER instrument's name — the
 * same nearest-owner discipline `valueNearAttributed` enforces, and for the same reason: the
 * 07-13 receipt in this file is a gate committing the transposition class it exists to catch.
 */
export function dashboardLevels(region: string): DashLevel[] {
  const out: DashLevel[] = [];
  for (const inst of DASH_INSTRUMENTS) {
    const re = new RegExp(inst.re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(region)) !== null) {
      const from = m.index + m[0].length;
      let window = region.slice(from, from + 120);
      // Stop at the next instrument named — a number past it belongs to that one, not this.
      let cut = window.length;
      for (const other of DASH_INSTRUMENTS) {
        if (other.key === inst.key) continue;
        const om = new RegExp(other.re.source, 'i').exec(window);
        if (om && om.index < cut) cut = om.index;
      }
      window = window.slice(0, cut);
      // A $-price for everything; a percent ONLY for the yield instruments, where the percent
      // IS the level. Elsewhere a percent is a change ("gold slipped 0.60 percent") and must
      // never enter the archive as a level.
      const pm = inst.pct
        ? window.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b)/i)
        : window.match(/\$\s?(\d[\d,]*(?:\.\d+)?)/);
      if (!pm) continue;
      const raw = pm[1]!.replace(/,/g, '');
      if (!isPreciseLevel(raw)) continue;
      // CONTEXT IS A WINDOW, NOT A SENTENCE. `sentenceAround` breaks on `.`, and every level in
      // a Dashboard is a decimal — so it returns "…held its 2007 high near 5." and, for the next
      // instrument, the orphan fragment "31 percent and gold spot slipped 0." A verb-adjacency
      // test run on debris is a coin flip. The window spans the clause on both sides of the name.
      out.push({
        instrument: inst.key,
        level: raw,
        sentence: region
          .slice(Math.max(0, m.index - 40), Math.min(region.length, from + 140))
          .replace(/\s+/g, ' ')
          .trim(),
      });
      break; // first precise level per instrument per Dashboard
    }
  }
  return out;
}

function dashboardLevelStalenessFindings(
  body: string,
  briefPath: string,
  briefDate: string | null
): Finding[] {
  const findings: Finding[] = [];
  const region = dashboardRegion(body);
  if (!region) return findings;
  const dir = findArchiveDir(briefPath);
  if (!dir) return findings;

  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return findings;
  }
  const prior = files
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)) // never the -light siblings
    .map(f => ({ f, d: f.slice(0, 10) }))
    .filter(x => (briefDate ? x.d < briefDate : true)) // strictly prior; never self
    .sort((a, b) => (a.d < b.d ? 1 : -1))
    .slice(0, 3); // "the last 3 published briefs", per the mandate

  const seen = new Map<string, { date: string; sentence: string }>();
  for (const { f, d } of prior) {
    let txt: string;
    try {
      txt = fs.readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue;
    }
    for (const lv of dashboardLevels(dashboardRegion(txt))) {
      const k = `${lv.instrument}|${lv.level}`;
      if (!seen.has(k)) seen.set(k, { date: d, sentence: lv.sentence });
    }
  }

  for (const lv of dashboardLevels(region)) {
    const hit = seen.get(`${lv.instrument}|${lv.level}`);
    if (!hit) continue;
    if (!DASH_VERB_RE.test(lv.sentence)) continue;
    const verb = lv.sentence.match(DASH_VERB_RE)![0];
    findings.push({
      check: 'dashboard-level-staleness',
      severity: 'FLAG',
      message:
        `UNRESOLVED-FACT: dashboard-level-staleness — the Dashboard prints ${lv.instrument} at ${lv.level} ` +
        `and attaches the verb "${verb}", but ${lv.level} is the level THIS BRIEF ALREADY PUBLISHED for ` +
        `${lv.instrument} on ${hit.date} ("${hit.sentence.slice(0, 140)}"). A repeated precise level under a ` +
        `directional or stasis verb is a claim about TODAY'S session made out of an EARLIER session's number. ` +
        `Resolve against a same-session primary or a dated-today secondary before publish. If no such source ` +
        `exists, the level may be printed only as "as of ${hit.date}" — never with a verb describing today's ` +
        `move. Receipt, 2026-08-19: "the thirty-year Treasury yield held its 2007 high near 5.31 percent" was ` +
        `Monday's print; Tuesday made a new 19-year high at 5.33 and CLOSED DOWN more than 2bp. The brief's ` +
        `own owed-block had DECLARED that no Treasury level would publish. A declaration is not a check. ` +
        `Section: ${sectionOf(body, body.indexOf(lv.sentence.slice(0, 40)))}.`,
    });
  }
  return findings;
}

// Superlative contradictions (FAIL) + price-vs-archive deviations (FLAG).
function archiveBackstop(
  superlatives: Claim[],
  briefPrices: Record<string, number>,
  archive: Record<string, ArchivePoint[]>
): Finding[] {
  const findings: Finding[] = [];

  // 1. Superlatives contradicted by our own record.
  for (const s of superlatives) {
    const k = s.key.replace(/^superlative:/, '');
    const value =
      s.level != null ? parseFloat(String(s.level).replace(/,/g, '')) : null;
    if (value == null || s.superlativeKind === 'other') continue;
    const pts = archive[k];
    if (!pts || !pts.length) continue;
    if (s.superlativeKind === 'high') {
      const higher = pts
        .filter(p => p.value > value * 1.001)
        .sort((a, b) => b.value - a.value);
      if (higher.length) {
        s.status = 'FAIL';
        findings.push({
          check: 'superlative-archive',
          severity: 'FAIL',
          message: `${s.asset} "${s.superlative}"${value ? ` near ${value}` : ''} is NOT a high by our own record — our ${higher[0].date} brief had ${s.asset} at ${higher[0].value}. Superlative contradicted by our archive. Verify vs PRIMARY source, then correct or strike.${loadBearingNote(s.section)} Section: ${s.section}. "${s.sentence.slice(0, 150)}"`,
        });
      }
    } else if (s.superlativeKind === 'low') {
      const lower = pts
        .filter(p => p.value < value * 0.999)
        .sort((a, b) => a.value - b.value);
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
  const devThreshold = (k: string) =>
    ['btc', 'eth'].includes(k) ? 0.18 : 0.08;
  for (const [k, lvl] of Object.entries(briefPrices)) {
    const pts = archive[k];
    if (!pts || pts.length < 2) continue;
    const recent = pts.slice(0, 3); // newest-first; recent regime, robust to one stale outlier
    if (recent.length < 2) continue;
    const med = median(recent.map(p => p.value));
    if (med == null || !(med > 0)) continue; // !(med > 0) also rejects NaN
    const dev = Math.abs(lvl - med) / med;
    if (dev > devThreshold(k)) {
      const asset = ASSETS.find(a => a.key === k)?.asset ?? k;
      findings.push({
        check: 'price-vs-archive',
        severity: 'FLAG',
        message: `${asset} stated near ${lvl} deviates ${(dev * 100).toFixed(0)}% from our last-${recent.length} archive median ${med} (${recent.map(p => `${p.date}:${p.value}`).join(', ')}). Possible fabrication/stale — verify vs PRIMARY source.`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Office-holder check (zero network).
// ---------------------------------------------------------------------------
const HISTORICAL_MARKERS =
  /\b(19\d{2}|20[01]\d|202[0-5])\b|\b(years?\s+ago|back\s+in|in\s+the\s+past|has\s+done\s+this\s+before|did\s+this\s+before|historically|previously|former|ex-|during\s+the)\b/i;
// Narrower marker for the descriptor check, where "former"/"ex-" is the TRIGGER and
// must not also count as a past-tense signal (else every hit self-classifies historical).
const HISTORICAL_PERIOD =
  /\b(19\d{2}|20[01]\d|202[0-5])\b|\b(years?\s+ago|back\s+in|in\s+the\s+past|out\s+of\s+office|during\s+(?:his|her|the)|at\s+the\s+time|then[- ]|previously)\b/i;

function checkOfficeHolders(
  body: string,
  registry: any
): { findings: Finding[]; checked: number } {
  const findings: Finding[] = [];
  const facts = registry?.facts ?? [];
  for (const f of facts) {
    const ctx = new RegExp(f.context_regex, 'i');
    const window = f.proximity_chars ?? 240;
    for (const wrong of f.wrong_values ?? []) {
      const re = new RegExp(
        `\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi'
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const near = body.slice(
          Math.max(0, m.index - window),
          Math.min(body.length, m.index + window)
        );
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
      const staleBefore =
        /\b(?:former|ex|ex-|one-?time|previous|outgoing|erstwhile)\b[-\s]+(?:u\.?s\.?\s+)?(?:president|vice\s+president|vp|treasury\s+secretary|secretary(?:\s+of\s+the\s+treasury)?|fed(?:eral reserve)?\s+chair|chair(?:man|woman)?|governor|senator)?\s*$/i;
      let hm: RegExpExecArray | null;
      while ((hm = holderRe.exec(body)) !== null) {
        const pre = body.slice(Math.max(0, hm.index - 32), hm.index);
        if (!staleBefore.test(pre)) continue;
        const near = body.slice(
          Math.max(0, hm.index - window),
          Math.min(body.length, hm.index + window)
        );
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
  id: string;
  key: string;
  scope: string | null;
  correctRe: string;
  correct: string;
  wrongRe: string;
  note?: string;
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
  name: string;
  path: string | null;
  state: 'ok' | 'missing' | 'malformed' | 'empty';
  rows: number;
  badRows: string[];
  detail?: string;
};

/** Pure read of ONE registry file → rows + health. Exported shape so the selftest can
 *  exercise it against a scratch file directly rather than fighting cwd resolution. */
function readRegistryFile<T>(
  name: string,
  p: string | null,
  key: string
): { rows: T[]; health: RegistryHealth } {
  if (!p || !fs.existsSync(p)) {
    return {
      rows: [],
      health: { name, path: null, state: 'missing', rows: 0, badRows: [] },
    };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return {
      rows: [],
      health: {
        name,
        path: p,
        state: 'malformed',
        rows: 0,
        badRows: [],
        detail: (e as Error).message.split('\n')[0],
      },
    };
  }
  const rows = (parsed?.[key] ?? []) as T[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rows: [],
      health: { name, path: p, state: 'empty', rows: 0, badRows: [] },
    };
  }
  return {
    rows,
    health: { name, path: p, state: 'ok', rows: rows.length, badRows: [] },
  };
}

function loadRegistry<T>(
  name: string,
  file: string,
  key: string,
  briefPath: string
): { rows: T[]; health: RegistryHealth } {
  const candidates = [
    path.join(process.cwd(), 'system', file),
    path.join(path.dirname(briefPath), '..', '..', 'system', file),
  ];
  const found = candidates.find(p => fs.existsSync(p)) ?? null;
  return readRegistryFile<T>(name, found, key);
}

/** A registry that cannot be read is a FAIL, not an empty list. Fails LOUD, never open. */
function registryFindings(healths: RegistryHealth[]): Finding[] {
  const out: Finding[] = [];
  for (const h of healths) {
    if (h.state === 'ok' && h.badRows.length === 0) continue;
    const why =
      h.state === 'missing'
        ? `not found (looked in system/)`
        : h.state === 'malformed'
          ? `failed to parse: ${h.detail ?? 'invalid JSON'}`
          : h.state === 'empty'
            ? `parsed but contains ZERO rows`
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
  return loadRegistry<Binding>(
    'entity-bindings.json',
    'entity-bindings.json',
    'bindings',
    briefPath
  ).rows;
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

function entityAttribution(
  body: string,
  bindings: Binding[],
  health?: RegistryHealth
): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const b of bindings) {
    // IMP-136: schema BEFORE compilation. `new RegExp(undefined)` is legal and empty,
    // so the try/catch below can never catch this class — it has to be rejected by shape.
    const schemaErrs = bindingSchemaErrors(b);
    if (schemaErrs.length) {
      if (health)
        health.badRows.push(
          `${b.id ?? '(unnamed row)'} [missing/blank: ${schemaErrs.join(', ')}]`
        );
      continue;
    }
    let keyRe: RegExp,
      wrongRe: RegExp,
      correctRe: RegExp,
      scopeRe: RegExp | null;
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
      if (scopeRe && !scopeRe.test(sentence)) continue; // binding doesn't apply here
      if (!wrongRe.test(sentence)) continue; // no confusable entity present
      if (correctRe.test(sentence)) continue; // true owner is named -> fine
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
const HARMONIZE_RE =
  /harmoni[sz]\w*|align(?:ed|ing)?\s+(?:to|with)\s+the\s+published|defer(?:red|ring)?\s+to\s+the\s+published|match(?:ed|ing)?\s+the\s+published/i;
const PUBLISHED_REF_RE =
  /published\s+(?:record|brief|figure|number)|the\s+published\s+\d{2}-\d{2}|prior\s+brief|yesterday'?s?\s+brief|our\s+archive/i;
const PRIMARY_SOURCE_RE =
  /https?:\/\/|primary source|verified against|per (?:Reuters|Bloomberg|the FT|the WSJ|CNBC|AP|Al Jazeera)|company filing|press release|8-K|prospectus/i;
// IMP-EDITOR-2026-08-02: NEGATION GUARD. The gate reads the QG log for a CONFESSION of
// harmonizing. A QG that OBEYS the rule must disclose the contradiction it declined to
// resolve by preference — and that disclosure necessarily contains the words "harmonize"
// and "the published brief". Without this guard the gate FAILs the compliant QG for
// pasting the receipt the rule demands, which is the same class as the 2026-08-01
// provenance-gate CHECK A finding (a zero-absence record read as four absence assertions).
// Two gates, one night, one shape: a negated declaration read as an admission.
// Scoped tightly — only an EXPLICIT negation of the harmonizing verb clears the line.
const HARMONIZE_NEGATED_RE =
  /\b(?:did|do|does|would|will|could)\s+(?:\*{0,2}not\*{0,2}|n[o']t)\s+\w{0,12}\s?harmoni[sz]|\bnot\s+harmoni[sz]|\bno\s+harmoni[sz]|\brefused\s+to\s+harmoni[sz]|\bdeclined\s+to\s+harmoni[sz]|\bwithout\s+harmoni[sz]|\bnever\s+harmoni[sz]|\bharmoni[sz]\w*\s*[:=]\s*\**\s*(?:none|no|n\/a|nil)\b|\bno\s+sentence\s+was\s+moved\s+toward\s+the\s+published\s+record|\b(?:never|not)\s+to\s+the\s+\*{0,2}published\s+record/i;
// ^ 2026-08-13 (morning pass): the RULE'S OWN HEADING was firing the gate. The QG log
// prints "### QG TRUTH RULE — HARMONIZE TO THE SOURCE, NEVER TO THE PUBLISHED RECORD
// (IMP-033)" as a section title; it carries the verb + the published referent, and the
// negation form it uses ("never TO THE PUBLISHED RECORD") was not the form the regex
// recognised ("never HARMONIZE"). A statement of the rule was read as a confession of
// breaking it, and it hard-FAILed a night whose QG had explicitly complied ("the QG did
// NOT resolve toward what we printed"). Same class as the price-vs-archive bare-year
// false positive (CARRY 2026-08-11): a false positive on the TRUE leg trains the next
// session to skim the gate. The real 07-11 confession ("QG harmonized v1.5 to the
// published record") contains no such negation and still FAILs — self-test okThFire.
// ^ 2026-08-15 (brief-editor pass), THIRD instance of this same class: the 08-16 QG
// wrote the compliant disclosure as "No harmonization performed and none owed" on a
// line that also names "The published 08-15 brief" — and the negation list carried
// "not harmoniz" and "never harmoniz" but NOT the plainest English form, "NO
// harmonization". A compliant QG was FAILed for pasting the receipt the rule demands,
// for the third time in a fortnight, each time on a different surface form of the same
// negation. Added `\bno\s+harmoni[sz]`. This strictly narrows FALSE POSITIVES and
// loosens nothing: the real 07-11 confession carries no negation of any form and the
// self-test's okThFire leg still FAILs it (verified in-pass, both directions).

function carriesUnresolvedHarmonization(line: string): boolean {
  // Negation belongs to its clause, not the whole line. A compliant
  // "harmonization: none" cannot launder a later confession after "but" or ";".
  const clauses = line
    .split(/\s*(?:;|\bbut\b|\bhowever\b)\s*/i)
    .filter(Boolean);
  return clauses.some(
    clause =>
      HARMONIZE_RE.test(clause) &&
      PUBLISHED_REF_RE.test(clause) &&
      !PRIMARY_SOURCE_RE.test(clause) &&
      !HARMONIZE_NEGATED_RE.test(clause)
  );
}

// ---------------------------------------------------------------------------
// DERIVED-FIGURE CONTRADICTION (IMP-193, 2026-08-18 Critic mandate #2 — RC2).
//
// WORKED FAILURE, and it is the ugliest shape a truth failure takes: the system computed a number,
// noticed the number disagreed with what the world publishes, chose its own arithmetic, and then
// DELETED the published figure so nothing downstream could see the disagreement. The 08-18
// cc-predraft status line read:
//
//   "C1 arithmetic catch — 12.9% x $371,500 = $47.9k contradicts the widely-printed $55k/home,
//    $55k omitted from prose per IMP-120"
//
// and its body: "The depth treatment below therefore prints the percentage and the ASP and derives
// ~$48,000, and omits the $55,000 entirely." The lead of a top slot then shipped "Lennar is
// spending roughly $48,000 a house to close a sale." Four published sources put the per-home
// incentive near $55,000 and the ASP at $371,000; 12.9% reconciles to $55,000 only against a
// ~$426,000 GROSS price, i.e. the pre-draft applied the incentive rate to the price NET of
// incentives. The error was ~$7,000 a house, in the headline, and every gate exited 0 — because
// the only figure on the page was internally consistent with the only other figure on the page.
//
// THE RULE THIS ENCODES: when your arithmetic disagrees with published sources, the arithmetic is
// the HYPOTHESIS, not the finding. Print the published figure and reconcile in the body, or drop
// the number. What may never happen is the third thing: ship the derivation and suppress its rival.
//
// SCOPE, deliberately tight so it accuses only this shape:
//   • PRE-DRAFTS ONLY, never the intel packet. The mandate is explicit that AI&T-1's "$2 trillion"
//     must stay silent — that was a correct SELECTION between two sourced estimates ($2tn Azhar
//     over $2.4tn WSJ), recorded at intel-packet line 626. A selection is not a derivation, and a
//     gate that cannot tell them apart punishes the one place the judgment was made correctly.
//   • the line must carry a derivation marker (=, x, computed, derives, arithmetic catch,
//     contradicts, does not reconcile);
//   • the two figures must be within a factor of 3 of each other — rival measurements of ONE
//     quantity, not the unrelated magnitudes every bullet prints;
//   • exactly one of the two may appear in the brief. If both appear, the reconciliation is on the
//     page and there is nothing to hide; if neither appears, the pre-draft's caution was heeded.
// FLAG, resolved at the Morning Truth Gate — the evening session has no browser to adjudicate
// which figure is right, and the whole point is that the arithmetic alone cannot settle it.

// TWO MARKERS, BOTH REQUIRED — a derivation AND a declared conflict with something published.
// The first build asked only for a derivation marker, and `=`, `x` and "computed" are ubiquitous
// in a pre-draft's rung notes: it produced three false rows on 2026-08-15 by pairing Riot's cost
// to mine ($49,912) against its underwater basis ($18,964) and its contracted NOI ($40,719) —
// three different quantities that merely sat within a factor of three of one another. What makes
// the 08-18 case a defect is not that a division happened; it is that the pre-draft SAID the
// result disagreed with the published figure and then dropped the published figure. So the line
// has to say so: "not the '$55,000 per home' the coverage repeats", "omits the $55,000 entirely".
const DERIVATION_MARKER_RE =
  /(arithmetic catch|\bcomputed?\b|\bderive[sd]?\b|=|\s[x×]\s)/i;
const CONTRADICTION_MARKER_RE =
  /(contradicts?\b|do(?:es)? not reconcile|\bomit(?:s|ted|ting)?\b|\bsuppress(?:es|ed)?\b|widely[- ]printed|coverage repeats|\bnot the\b|\binstead of\b)/i;

/** `$47.9k` → 47900, `$55,000` → 55000, `$371,500` → 371500, `$1.8 billion` → 1.8e9. */
function derivedMoneyValues(text: string): Array<{ v: number; raw: string }> {
  const MUL: Record<string, number> = {
    k: 1e3,
    thousand: 1e3,
    m: 1e6,
    mn: 1e6,
    million: 1e6,
    bn: 1e9,
    b: 1e9,
    billion: 1e9,
    tn: 1e12,
    trillion: 1e12,
  };
  const out: Array<{ v: number; raw: string }> = [];
  for (const m of text.matchAll(
    /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mn|million|bn|billion|tn|trillion|m|b)?\b/gi
  )) {
    const n = parseFloat(m[1]!.replace(/,/g, ''));
    if (!isFinite(n)) continue;
    const mul = m[2] ? (MUL[m[2]!.toLowerCase()] ?? 1) : 1;
    out.push({ v: n * mul, raw: m[0]!.trim().replace(/[.,;:]$/, '') });
  }
  return out;
}

/** Present in the brief within 2% — "$47,900" derived and "roughly $48,000" printed are one figure. */
function briefCarries(v: number, briefValues: number[]): boolean {
  return briefValues.some(b => b > 0 && Math.abs(b - v) / v <= 0.02);
}

// ── 🔴 SETTLED-CLOSE LEG — E-INTRADAY-FOR-CLOSE-01 (R3, 2026-08-29) ──────────────────────────
//
// THE DEFECT, RECURRING ONE BRIEF LATER AND WIDER, which is why it is an EMERGENCY rather than a
// finding: after the 16:00 ET settle, the close is available — and three units on 2026-08-28 (plus
// the 08-27 pair before them) shipped INTRADAY marks wearing SETTLED-SESSION VERBS.
//
//   SHIPPED "rose about 21 percent on Thursday"    · settled CRM close +22.60%  ($252.10)
//   SHIPPED "finished 5.8 percent off its high"    · settled MU  close  −1.14%  (actual 4.08% off)
//   SHIPPED 8.55%/$227.58 and 3.33%                · settled NVDA +8.74% / AVGO +4.49%
//
// Market close 16:00 ET; the editor's SUCCESS line was 19:51 ET. The numbers were not unavailable —
// they were unfetched, and a session verb asserted a vintage the value did not have.
//
// **THE RULE THE VERBS ENCODE: a settled verb is a claim about a FINISHED session. If the session
// has closed, the close is the number.** An intraday mark may still be printed — but only with the
// hour on it ("at 10:43 ET"), never with a session verb and never as "on Thursday".
//
// 🔴 MEASURED STATE, 2026-08-28 (updated after C2 landed the discriminator).
//
//   nights with recorded closes: 1 (2026-08-28, 4 rows) -> 2 findings, BOTH contradicting a
//                                recorded close. Precision where the discriminator exists: 2/2.
//   nights without:              4 -> 8 findings, precision NOT COMPUTABLE. With no close on
//                                record, "settled verb + number" only says the sentence asserts a
//                                vintage nobody verified — which is true of the good sentences too.
//
// So the leg has two modes and reports which one it is in. Where a close is recorded it names the
// CONTRADICTION ("quotes 21 percent, settled close +22.6%") and is a defect report. Where none is,
// it is an advisory that a vintage went unchecked. **The escalation closes when the evening-truth
// pass writes close: rows nightly, not before** — the same night that happens, every clean sentence
// falls out of this list by construction rather than by tuning.
//
// SCOPE, deliberately narrow so it can be believed: it fires only when all three coincide — a
// settled-session verb, a numeric move or level bound to it, and a file written more than
// SETTLE_GRACE_MIN after the session's 16:00 ET close. An hour-stamped mark is exempt because it
// tells the reader its own vintage, which is the whole remedy.
export const SETTLE_GRACE_MIN = 60;
export const SETTLED_VERB_RE =
  /\b(closed|finished|ended|settled|ran to|rose[^.]{0,60}\bon (?:Monday|Tuesday|Wednesday|Thursday|Friday)|fell[^.]{0,60}\bon (?:Monday|Tuesday|Wednesday|Thursday|Friday)|gained[^.]{0,60}\bon (?:Monday|Tuesday|Wednesday|Thursday|Friday)|lost[^.]{0,60}\bon (?:Monday|Tuesday|Wednesday|Thursday|Friday))\b/i;
/** An hour-stamped mark declares its own vintage and is exactly what the rule asks for. */
export const HOUR_STAMP_RE =
  /\b(?:at\s+)?\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?|ET|EDT|EST)\b/i;
export const NUMERIC_MOVE_RE =
  /(\d+(?:\.\d+)?\s*percent|\d+(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?)/i;
/** Intraday self-labels: a bullet that says it is a live/provisional mark is not asserting a close. */
export const INTRADAY_LABEL_RE =
  /\b(intraday|post-?market|pre-?market|overnight|as of \d|live price|provisional)\b/i;
/**
 * "Closed" is not only a market word. MEASURED on the real briefs: the first cut flagged
 * *"Copper, the London crypto custodian ... closed a $200 million round"* — a financing close, not a
 * session close. A verb that means two things needs the other word in the sentence to disambiguate,
 * so a finding must ALSO carry market context.
 */
export const FINANCING_RE =
  /\b(closed|completed|raised)\b[^.]{0,60}\b(seed|series\s+[A-F]|round|financing|funding|raise|deal|acquisition|placement|valuation)\b/i;
export const HISTORICAL_RE =
  /\b(in|by|since|during|through)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)?\s*(?:19|20)\d{2}\b|\bover the (?:year|decade|month)\b|\bthat week\b|\ba year ago\b/i;
export const MARKET_CONTEXT_RE =
  /\b(shares?|stock|ticker|index|futures?|the session|trading|market|close|closing|spot|yield|contract|[A-Z]{2,5}\s*[+-]?\d)\b/;

/**
 * THE DISCRIMINATOR, LOADED (C2, 2026-08-28). A `close:{TICKER}:{YYYY-MM-DD}` claim in the night's
 * truth.json is the record that somebody FETCHED the settled close rather than guessing it. Until
 * these rows existed, this leg could not tell a settled verb on the right number from one on an
 * intraday number, and shipped advisory for exactly that reason.
 *
 * A row counts only when `resolved` is true. An unresolved close row is a claim that was LOOKED FOR
 * and not found — which is the opposite of an exemption.
 */
export interface RecordedClose {
  key: string;
  pct: number | null;
  value: number | null;
  names: string[];
}

export function loadRecordedCloses(truthPath: string): Set<string> {
  const out = new Set<string>();
  if (!fs.existsSync(truthPath)) return out;
  let doc: { claims?: Record<string, { resolved?: boolean }> };
  try {
    doc = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
  } catch {
    return out;
  }
  for (const [k, v] of Object.entries(doc.claims ?? {})) {
    const m = /^close:([A-Za-z.\-]{1,8}):(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (!m || !v || v.resolved !== true) continue;
    out.add(m[1]!.toUpperCase());
  }
  return out;
}

/**
 * 🔴 THE EXEMPTION HAD TO BE NUMERIC, AND FINDING OUT WHY IS THE POINT OF C2.
 *
 * The specified rule — exempt any instrument whose close was recorded — was wired first and
 * measured immediately: it would have exempted **the Salesforce sentence**, whose whole defect is
 * that it says *"rose about 21 percent"* while the close it is exempted by is **+22.60%**.
 * **Recording a close does not mean the prose used it**, so an instrument-level exemption hides
 * exactly the sentence the leg exists to catch.
 *
 * A sentence is therefore exempt only when its own number MATCHES the recorded close. Everything
 * else is flagged — and now flagged with a reason a reader can act on ("quotes 21 percent, settled
 * close 22.60 percent") instead of "asserts a vintage nobody verified".
 */
export function recordedCloses(truthPath: string): RecordedClose[] {
  if (!fs.existsSync(truthPath)) return [];
  let doc: {
    claims?: Record<
      string,
      {
        resolved?: boolean;
        magnitudePct?: number | null;
        value?: number | null;
        names?: string[];
      }
    >;
  };
  try {
    doc = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
  } catch {
    return [];
  }
  const out: RecordedClose[] = [];
  for (const [k, v] of Object.entries(doc.claims ?? {})) {
    const m = /^close:([A-Za-z.\-]{1,8}):(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (!m || !v || v.resolved !== true) continue;
    out.push({
      key: m[1]!.toUpperCase(),
      pct: typeof v.magnitudePct === 'number' ? v.magnitudePct : null,
      value: typeof v.value === 'number' ? v.value : null,
      names: [m[1]!.toUpperCase(), ...(v.names ?? [])],
    });
  }
  return out;
}

export const CLOSE_PCT_TOLERANCE = 0.15; // percentage points — a rounding difference, not a rewrite

/** The recorded close a sentence is about, if any. */
export function closeFor(
  sentence: string,
  closes: RecordedClose[]
): RecordedClose | null {
  for (const c of closes)
    for (const n of c.names)
      if (
        new RegExp(
          `\\b${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`,
          'i'
        ).test(sentence)
      )
        return c;
  return null;
}

/** Does the sentence quote a number consistent with the recorded close? */
export function agreesWithClose(sentence: string, c: RecordedClose): boolean {
  if (c.pct === null) return false;
  const target = Math.abs(c.pct);
  for (const m of sentence.matchAll(/(\d+(?:\.\d+)?)\s*(?:percent|%)/gi))
    if (Math.abs(Number(m[1]) - target) <= CLOSE_PCT_TOLERANCE) return true;
  if (c.value !== null)
    for (const m of sentence.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g))
      if (
        Math.abs(Number(m[1]!.replace(/,/g, '')) - c.value) <=
        Math.max(0.02, c.value * 0.001)
      )
        return true;
  return false;
}

export interface SettledCloseFinding {
  sentence: string;
  verb: string;
  value: string;
  recorded?: string;
}

/**
 * Sentences that bind a settled-session verb to a number, in a file written after the session had
 * settled. `resolved` carries `close:<ticker>:<date>` rows from {BRIEF_DATE}-truth.json — a unit
 * whose close was actually fetched and recorded is not guessing, and is exempt.
 */
export function settledCloseFindings(
  body: string,
  minutesAfterClose: number,
  resolved: Set<string> = new Set(),
  closes: RecordedClose[] = []
): SettledCloseFinding[] {
  if (minutesAfterClose <= SETTLE_GRACE_MIN) return [];
  const out: SettledCloseFinding[] = [];
  for (const raw of body.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (!sentence || sentence.length > 600) continue;
    const v = SETTLED_VERB_RE.exec(sentence);
    if (!v) continue;
    const n = NUMERIC_MOVE_RE.exec(sentence);
    if (!n) continue;
    if (HOUR_STAMP_RE.test(sentence)) continue; // declares its own vintage
    if (INTRADAY_LABEL_RE.test(sentence)) continue; // says it is not a close
    if (FINANCING_RE.test(sentence)) continue; // a financing close, not a session close
    // A statement about a PAST period is not a claim about yesterday's session. Measured false
    // positives this removes: "traded to a 49 percent discount in December 2022 and closed it",
    // "up 82.68 percent over the year", "unit prices fell from $32 in 1961".
    if (HISTORICAL_RE.test(sentence)) continue;
    // NOTE: an earlier cut also required MARKET_CONTEXT_RE here. It dropped the Micron receipt —
    // "Micron opened up 3.1 percent ... and finished 5.8 percent off its high" names no ticker,
    // no "shares", no "session". Requiring market vocabulary rejected a named defect to exclude one
    // financing sentence the FINANCING_RE already handles. The narrower filter was the wrong one.
    // Any standalone uppercase token may be the instrument. Matching broadly is safe here BECAUSE
    // the exemption is keyed on the RESOLVED set — a spurious match ("ET", "GDP") only matters if
    // someone recorded a close under that name. The earlier form required the ticker to be followed
    // by a number with no lowercase between, which "CRM closed up 22.60 percent" never satisfies:
    // the exemption existed and could never fire.
    const ticks = sentence.match(/\b[A-Z]{1,5}\b/g) ?? [];
    if (ticks.some(tk => resolved.has(tk))) continue; // legacy set-based exemption (ticker in prose)
    const rc = closes.length ? closeFor(sentence, closes) : null;
    if (rc && agreesWithClose(sentence, rc)) continue; // quotes the recorded close: correct usage
    out.push({
      sentence: sentence.slice(0, 200),
      verb: v[0].slice(0, 40),
      value: n[0],
      // When a close IS on record and the sentence disagrees with it, say what it disagrees with.
      // "asserts a vintage nobody verified" is a worry; "quotes 21 percent, settled close 22.60"
      // is a defect someone can fix in one edit.
      recorded:
        rc && rc.pct !== null
          ? `${rc.key} settled ${rc.pct > 0 ? '+' : ''}${rc.pct}%`
          : undefined,
    });
  }
  return out;
}

export function derivedFigureContradictionFindings(
  body: string,
  predrafts: Array<[string, string]>
): Finding[] {
  const findings: Finding[] = [];
  const briefValues = derivedMoneyValues(body).map(m => m.v);
  const seen = new Set<string>();
  for (const [label, draft] of predrafts) {
    for (const line of draft.replace(/<!--[\s\S]*?-->/g, ' ').split('\n')) {
      if (!DERIVATION_MARKER_RE.test(line)) continue;
      if (!CONTRADICTION_MARKER_RE.test(line)) continue;
      const vals = derivedMoneyValues(line);
      if (vals.length < 2) continue;
      for (let i = 0; i < vals.length; i++)
        for (let j = i + 1; j < vals.length; j++) {
          const a = vals[i]!;
          const b = vals[j]!;
          if (a.v === b.v || !a.v || !b.v) continue;
          const ratio = Math.max(a.v, b.v) / Math.min(a.v, b.v);
          if (ratio > 3) continue; // unrelated magnitudes, not rival readings of one quantity
          const aIn = briefCarries(a.v, briefValues);
          const bIn = briefCarries(b.v, briefValues);
          if (aIn === bIn) continue; // both on the page (reconciled) or neither (caution heeded)
          const shipped = aIn ? a : b;
          const suppressed = aIn ? b : a;
          // One row per SUPPRESSED figure. The 08-18 pre-draft states the same conflict twice
          // ("$47,900, not the $55,000" and "derives ~$48,000, and omits the $55,000"); that is one
          // defect and one morning-gate resolution, not two.
          const key = `${label}:${Math.round(suppressed.v)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          findings.push({
            check: 'derived-figure-contradiction',
            severity: 'FLAG',
            message:
              `UNRESOLVED-FACT: DERIVED FIGURE SHIPPED, ITS RIVAL SUPPRESSED — the ${label} pre-draft names ` +
              `${shipped.raw} and ${suppressed.raw} on one derivation line, and the brief prints ${shipped.raw} ` +
              `while ${suppressed.raw} appears nowhere. Line: "${line.replace(/\s+/g, ' ').trim().slice(0, 220)}…". ` +
              `MORNING GATE: verify which figure the published sources carry. When the system's own arithmetic ` +
              `disagrees with what is published, the arithmetic is the HYPOTHESIS — print the published figure and ` +
              `reconcile in the body, or drop the number; never ship the derivation with its rival deleted. ` +
              `Receipt, 2026-08-18 C&C-1: "12.9% x $371,500 = $47.9k contradicts the widely-printed $55k/home, ` +
              `$55k omitted from prose" — "roughly $48,000 a house" led a top slot, and 12.9% reconciles to ` +
              `$55,000 only against a ~$426,000 GROSS price. The rate had been applied to the price NET of ` +
              `incentives; the error was ~$7,000 a house, in the headline, at gate exit 0.`,
          });
        }
    }
  }
  return findings;
}

/** Every on-disk pre-draft for the night, as [label, contents]. Pre-drafts ONLY — see scope note. */
export function loadPredrafts(
  briefPath: string,
  briefDate: string | null
): Array<[string, string]> {
  if (!briefDate) return [];
  const out: Array<[string, string]> = [];
  for (const suffix of [
    'cc-predraft',
    'take-draft',
    'signal-draft',
    'discovery-draft',
  ]) {
    for (const dir of [
      path.dirname(briefPath),
      path.join(path.dirname(briefPath), '..', 'daily-briefs'),
      path.join(process.cwd(), 'daily-briefs'),
    ]) {
      const p = path.join(dir, `${briefDate}-${suffix}.md`);
      if (fs.existsSync(p)) {
        out.push([
          suffix.replace(/-.*/, '').toUpperCase(),
          fs.readFileSync(p, 'utf8'),
        ]);
        break;
      }
    }
  }
  return out;
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
    const c = line
      .trim()
      .split('|')
      .map(s => s.trim());
    if (c.length < 8 || !/^COR-\d+/.test(c[1] ?? '')) continue;
    if (c[2] === briefDate) ids.push(c[1]!);
  }
  return ids;
}

function truthHarmonization(
  qg: string | null,
  briefDate: string | null = null
): Finding[] {
  if (!qg) return [];
  const resolved = correctionsLoggedOn(briefDate);
  const findings: Finding[] = [];
  for (const raw of qg.split('\n')) {
    const line = raw.trim();
    if (!line || line.length < 40) continue;
    if (!carriesUnresolvedHarmonization(line)) continue;
    findings.push(
      resolved.length > 0
        ? {
            check: 'truth-harmonization',
            severity: 'FLAG',
            message: `QG harmonized to the published record — RESOLVED this session (${resolved.join(', ')} in system/Corrections_Ledger.md; the archive was corrected, not the truth). Kept as an advisory record of the decision. QG line: "${line.slice(0, 140)}"`,
          }
        : {
            check: 'truth-harmonization',
            severity: 'FAIL',
            message: `QG HARMONIZED TO THE PUBLISHED RECORD — a published number is a CLAIM, not a citation. 07-11 receipt: the draft had SK Hynix's raise RIGHT ($26.5B) and the QG rewrote it to the published (false) $28B to remove a cross-day contradiction, manufacturing a falsehood from a true sentence. Resolve the contradiction against a PRIMARY SOURCE, or cut/restate the contested figure — then correct the published brief and log it in system/Corrections_Ledger.md (that row is what clears this gate). QG line: "${line.slice(0, 220)}"`,
          }
    );
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
    if (
      tv.direction &&
      c.direction !== 'unknown' &&
      tv.direction !== c.direction
    ) {
      c.status = 'FAIL';
      findings.push({
        check: 'truth-direction',
        severity: 'FAIL',
        message: `${c.asset}: brief says "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''}, ground truth is "${tv.direction}"${tv.value ? ` (${tv.value})` : ''}. ${tv.source ? `Source: ${tv.source}. ` : ''}Section: ${c.section}.${loadBearingNote(c.section)} Sentence: "${c.sentence.slice(0, 160)}"`,
      });
    } else if (
      tv.magnitudePct != null &&
      c.magnitudePct != null &&
      Math.abs(tv.magnitudePct - c.magnitudePct) > (tv.tolerancePct ?? 1.0)
    ) {
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
  const magWord = detectDirection(
    ' triggered a circuit breaker and closed down 4.91 percent after'
  );
  const magSym = detectDirection(' futures down 2.6% into the close');

  const okFire = fire.some(
    f => f.check === 'dramatic-event-reuse' && f.severity === 'FAIL'
  );
  const okSilentDated = silentDated.length === 0;
  const okSilentFirst = silentFirst.length === 0;
  const okFpFire = fpFire.some(
    f => f.check === 'story-fingerprint-reuse' && f.severity === 'FAIL'
  );
  const okFpNikkei = fpFire.some(f => /Nikkei/i.test(f.message));
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
    ? entityAttribution(
        stripComments(fs.readFileSync(draft11Path, 'utf8')),
        bindings
      )
    : [];
  const eaSilent = fs.existsSync(pub11Path)
    ? entityAttribution(
        stripComments(fs.readFileSync(pub11Path, 'utf8')),
        bindings
      )
    : [];
  const okEaFire = eaFire.some(
    f =>
      f.check === 'entity-attribution' &&
      /BCRED/i.test(f.message) &&
      f.severity === 'FAIL'
  );
  const okEaSilent = eaSilent.length === 0;
  // Synthetic twin of the 07-10 JGB transposition (right number, wrong tenor) + its corrected form.
  const jgbFire = entityAttribution(
    "Japan's long-end JGB yields hit a wall: the 30-year touched 2.88 percent, the highest since September 1996, as the YCC framework strained.",
    bindings
  );
  const jgbSilent = entityAttribution(
    "Japan's 10-year JGB touched 2.88 percent, the highest since September 1996, while the 30-year held near 4.03 percent.",
    bindings
  );
  const okJgbFire = jgbFire.some(f => f.check === 'entity-attribution');
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
    return readRegistryFile<Binding>(
      'entity-bindings.json',
      regFile,
      'bindings'
    ).health;
  };
  // SILENT on a healthy registry.
  const okRegOk = (() => {
    const h = healthOf(
      JSON.stringify({
        bindings: [
          {
            id: 'x',
            key: 'K',
            scope: null,
            correctRe: 'A',
            correct: 'A',
            wrongRe: 'B',
          },
        ],
      })
    );
    return (
      h.state === 'ok' && h.rows === 1 && registryFindings([h]).length === 0
    );
  })();
  // FIRES on malformed / empty / missing — the three ways the layer goes blind.
  const okRegMalformed = (() => {
    const h = healthOf('{ "bindings": [ BROKEN ] }');
    return (
      h.state === 'malformed' &&
      registryFindings([h]).some(
        f => f.check === 'registry-integrity' && f.severity === 'FAIL'
      )
    );
  })();
  const okRegEmpty = (() => {
    const h = healthOf(JSON.stringify({ bindings: [] }));
    return (
      h.state === 'empty' &&
      registryFindings([h]).some(f => f.check === 'registry-integrity')
    );
  })();
  const okRegMissing = (() => {
    fs.rmSync(regFile, { force: true });
    const h = readRegistryFile<Binding>(
      'entity-bindings.json',
      regFile,
      'bindings'
    ).health;
    return (
      h.state === 'missing' &&
      registryFindings([h]).some(f => f.check === 'registry-integrity')
    );
  })();
  // The REAL registries on disk must be healthy — this is the check running in anger.
  const okRegRealHealthy = (() => {
    const b = loadRegistry<Binding>(
      'entity-bindings.json',
      'entity-bindings.json',
      'bindings',
      pub11Path
    );
    const c = loadRegistry<any>(
      'current-facts.json',
      'current-facts.json',
      'facts',
      pub11Path
    );
    return registryFindings([b.health, c.health]).length === 0;
  })();
  // A row with an unusable regex is reported, never silently skipped.
  const okRegBadRow = (() => {
    const bad: Binding[] = [
      {
        id: 'bad-row',
        key: '([unclosed',
        scope: null,
        correctRe: 'A',
        correct: 'A',
        wrongRe: 'B',
      },
    ];
    const h: RegistryHealth = {
      name: 'entity-bindings.json',
      path: null,
      state: 'ok',
      rows: 1,
      badRows: [],
    };
    entityAttribution('some body text', bad, h);
    return (
      h.badRows.includes('bad-row') &&
      registryFindings([h]).some(f => f.check === 'registry-integrity')
    );
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
    const prose = {
      id: 'aisi-shaped-row',
      entity: 'X',
      correct: 'Y',
      wrong: ['Meta'],
      note: 'n',
    };
    const h: RegistryHealth = {
      name: 'entity-bindings.json',
      path: null,
      state: 'ok',
      rows: 1,
      badRows: [],
    };
    entityAttribution(
      'some body text about Meta',
      [prose as unknown as Binding],
      h
    );
    return (
      h.badRows.some(r => /aisi-shaped-row/.test(r) && /key/.test(r)) &&
      registryFindings([h]).some(
        f => f.check === 'registry-integrity' && f.severity === 'FAIL'
      )
    );
  })();
  const okSchemaBlankRe = (() => {
    const blank: Binding[] = [
      {
        id: 'blank-re',
        key: 'Meta',
        scope: null,
        correctRe: '',
        correct: 'Y',
        wrongRe: '  ',
      },
    ];
    const h: RegistryHealth = {
      name: 'entity-bindings.json',
      path: null,
      state: 'ok',
      rows: 1,
      badRows: [],
    };
    entityAttribution('some body text about Meta', blank, h);
    return h.badRows.some(
      r => /blank-re/.test(r) && /correctRe/.test(r) && /wrongRe/.test(r)
    );
  })();
  // The zero-width GUARD, tested directly: a key that legally matches empty must not park
  // lastIndex. Bounded body, so a regressed guard shows up as a selftest that never returns
  // — which is the honest signal, since that is exactly the production symptom.
  const okZeroWidthTerminates = (() => {
    const zw: Binding[] = [
      {
        id: 'zero-width',
        key: 'q*',
        scope: null,
        correctRe: 'Nvidia',
        correct: 'Nvidia',
        wrongRe: 'TSMC',
      },
    ];
    const h: RegistryHealth = {
      name: 'entity-bindings.json',
      path: null,
      state: 'ok',
      rows: 1,
      badRows: [],
    };
    entityAttribution('TSMC shipped a record quarter.', zw, h);
    return h.badRows.length === 0; // schema-valid, and it RETURNED
  })();
  // The REPAIRED real binding does the job it was written for: fires on the false 08-07
  // sentence, silent on the corrected one. A row that only parses is not a row that works.
  const realBindings = loadRegistry<Binding>(
    'entity-bindings.json',
    'entity-bindings.json',
    'bindings',
    pub11Path
  ).rows;
  const okAisiFire = entityAttribution(
    '## AI & Tech\n\nThree frontier labs have now disclosed models attacking real internet targets during AISI safety evaluations, and Anthropic, OpenAI and Meta are the three.',
    realBindings
  ).some(
    f => f.check === 'entity-attribution' && /Meta|three/i.test(f.message)
  );
  const okAisiSilent =
    entityAttribution(
      "## AI & Tech\n\nAISI reported 19 unsanctioned actions across one cyber challenge; 17 came from a single model, Anthropic's Mythos 5, with 2 from OpenAI's GPT-5.6-Sol.",
      realBindings
    ).length === 0;

  // --- IMP-033: truth-harmonization guard. REAL QG logs, both directions.
  const qg11 = fs.existsSync(
    path.join(root, 'daily-briefs/2026-07-11-quality-gate-log.md')
  )
    ? fs.readFileSync(
        path.join(root, 'daily-briefs/2026-07-11-quality-gate-log.md'),
        'utf8'
      )
    : null;
  const qg10 = fs.existsSync(
    path.join(root, 'daily-briefs/2026-07-10-quality-gate-log.md')
  )
    ? fs.readFileSync(
        path.join(root, 'daily-briefs/2026-07-10-quality-gate-log.md'),
        'utf8'
      )
    : null;
  // briefDate=null => no correction row in scope => the OPEN-DEBT state the gate must block.
  const thFire = truthHarmonization(qg11, null);
  const thSilent = truthHarmonization(qg10, null);
  const okThFire = thFire.some(
    f => f.check === 'truth-harmonization' && f.severity === 'FAIL'
  );
  const okThSilent = thSilent.length === 0;
  // A harmonization RESOLVED against a primary source is legal -> must stay silent.
  const okThSourced =
    truthHarmonization(
      'QG harmonized the SK Hynix figure to the published record after verifying against https://reuters.com/... — $26.5B confirmed.',
      null
    ).length === 0;
  const okThNominal =
    truthHarmonization(
      'Truth harmonization: none. No sentence was moved toward the published record; the discrepancy remains routed for primary verification.',
      null
    ).length === 0;
  const okThMixed = truthHarmonization(
    'Truth harmonization: none against the published record; but the QG later harmonized the disputed figure to the published brief without a source.',
    null
  ).some(f => f.check === 'truth-harmonization' && f.severity === 'FAIL');
  // THE CURE: once the archive correction is logged for that date (COR-001/002 on 2026-07-11),
  // the FAIL downgrades to an advisory FLAG — otherwise the gate blocks every re-run of a day
  // it already fixed, and sessions learn to route around it.
  const thResolved = truthHarmonization(qg11, '2026-07-11');
  const okThResolved =
    thResolved.length > 0 && thResolved.every(f => f.severity === 'FLAG');

  // --- IMP-044: scheduled-event date. Both directions, on the two REAL 07-13 artifacts. ---
  const jul13Draft = path.join(root, 'daily-briefs/2026-07-13-v2.md'); // the falsehood as drafted
  const jul13Pub = path.join(root, 'content/daily-updates/2026-07-13.md'); // the morning's rebuild
  const cal = loadEventCalendar(jul13Pub);
  const okCalLoad = cal.some(
    c => c.id === 'cpi' && c.releaseDate === '2026-07-14'
  );
  let okEvFire = false,
    okEvSilent = false,
    evFireN = 0,
    evSilentFindings: Finding[] = [];
  if (fs.existsSync(jul13Draft) && fs.existsSync(jul13Pub)) {
    // FIRES on the real evening draft: "CPI and the first post-Hormuz tape land in the same session."
    const evFire = scheduledEventClaims(
      fs.readFileSync(jul13Draft, 'utf8'),
      cal,
      '2026-07-13'
    );
    evFireN = evFire.findings.length;
    okEvFire =
      evFire.findings.some(
        f => f.check === 'scheduled-event-date' && f.severity === 'FAIL'
      ) &&
      // and it must ALSO ride the critical rails, so a calendar-less event still blocks at publish
      evFire.claims.some(c => c.key === 'event:cpi' && c.tier === 'critical');
    // SILENT on the published rebuild: "it lands tomorrow morning" + "June CPI lands Tuesday at 8:30".
    const evSilent = scheduledEventClaims(
      fs.readFileSync(jul13Pub, 'utf8'),
      cal,
      '2026-07-13'
    );
    evSilentFindings = evSilent.findings;
    okEvSilent =
      evSilent.findings.length === 0 &&
      evSilent.claims.some(c => c.key === 'event:cpi' && c.tier === 'standard');
  }
  // A same-session assertion with NO calendar entry must still become a CRITICAL claim —
  // this is the leg that makes coverage independent of the calendar's completeness.
  const evNoCal = scheduledEventClaims(
    'The FOMC decision lands today, and the tape has not priced it.',
    [],
    '2026-07-13'
  );
  const okEvNoCal =
    evNoCal.findings.length === 0 &&
    evNoCal.claims.some(
      c =>
        c.key === 'event:fomc' &&
        c.tier === 'critical' &&
        c.status === 'UNVERIFIED'
    );
  // A weekday that contradicts the calendar is a falsehood even without "today"/"tomorrow".
  const evWrongDay = scheduledEventClaims(
    'June CPI lands Monday at 8:30 and the market is not ready.',
    cal,
    '2026-07-13'
  );
  const okEvWrongDay = evWrongDay.findings.some(
    f => f.check === 'scheduled-event-date' && f.severity === 'FAIL'
  );

  // --- IMP-045: the gate's own transposition + the term-of-art false positive. ---
  let okWtiAttrib = false,
    okToa = false,
    wtiGot: number | undefined;
  if (fs.existsSync(jul13Pub)) {
    const pubBody = fs.readFileSync(jul13Pub, 'utf8');
    // "The oil market … Brent is bid about 4% to $79" must NOT assign 79 to WTI; the brief's
    // real WTI print is $74.41 ("WTI bid to roughly $74.41 and Brent to $79.14").
    const prices = assetValuesIn(pubBody);
    wtiGot = prices.wti;
    // Brent legitimately resolves from the intro ("Brent is bid about 4% to $79"); WTI must
    // resolve from its OWN print ($74.41), never from Brent's number sitting after "oil market".
    okWtiAttrib =
      prices.wti === 74.41 && prices.brent >= 79 && prices.brent <= 79.2;
    // "the highest-and-best use of that land" is a real-estate term of art, not a superlative.
    okToa = !extractSuperlatives(pubBody).some(
      s =>
        /highest[-\s]and[-\s]best/i.test(s.sentence) &&
        /^highest$/i.test(s.superlative ?? '')
    );
  }
  // The suppression must be surgical: a REAL superlative in the same shape still extracts.
  const okToaNarrow =
    extractSuperlatives(
      'The 10-year JGB printed its highest yield since Sept 1996 at 2.900%.'
    ).length > 0;

  // --- IMP-056: aggregate-claim gate. Both directions on REAL artifacts. ---
  // FIRE: the 07-15 C&C-1 lede ("Combined Q2 net income across … cleared roughly $49 billion,
  // up 39% YoY") becomes a CRITICAL claim on the unresolved-before-publish rails.
  const jul15Pub = path.join(root, 'content/daily-updates/2026-07-15.md');
  let okAggFire = false,
    okAggResolves = false,
    aggKey = '';
  if (fs.existsSync(jul15Pub)) {
    const agg15 = aggregateClaims(
      fs.readFileSync(jul15Pub, 'utf8'),
      '2026-07-15'
    );
    const c = agg15.find(x => /^aggregate:/.test(x.key));
    aggKey = c?.key ?? '';
    okAggFire =
      !!c &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED' &&
      /49/.test(c.key) &&
      c.magnitudePct === 39;
    // RESOLVES: once the Morning Truth Gate records the aggregate under its key (independent
    // source), the same claim flips to PASS and the gate goes silent.
    const fakeTruth: any = {
      claims: {
        [aggKey]: {
          value: '5 big banks $49B combined, +39% YoY',
          source: 'https://finance.yahoo.com/…5-big-banks-earned-49…',
        },
      },
    };
    for (const a of agg15) if (fakeTruth.claims[a.key]) a.status = 'PASS';
    okAggResolves =
      !!aggKey &&
      agg15
        .filter(x => /^aggregate:/.test(x.key))
        .every(x => x.status === 'PASS');
  }
  // SILENT: a single-entity figure is not a sum across constituents.
  const okAggSingle =
    aggregateClaims(
      'JPMorgan posted net income of $21.2 billion, up 41% year over year.',
      '2026-07-15'
    ).length === 0;
  // SILENT: the 07-13 "$1.045 trillion in total FY2026 Pentagon resources" is one entity's own
  // total — "in total" is deliberately NOT a connective. (Regression IMP-045 --require-resolved.)
  const jul13PubAgg = path.join(root, 'content/daily-updates/2026-07-13.md');
  const okAggSilent13 =
    !fs.existsSync(jul13PubAgg) ||
    aggregateClaims(fs.readFileSync(jul13PubAgg, 'utf8'), '2026-07-13')
      .length === 0;

  // --- IMP-058: relative-date referent. Both directions on the REAL 07-16 artifacts + synthetic edges. ---
  // FIRE: the 07-16 editor working file still carries the pre-correction Take lead
  // ("Yesterday New York became the first state to ban…" — EO 62 was signed 07-14).
  const jul16Work = path.join(root, 'daily-briefs/2026-07-16-v2.working.md');
  const jul16Pub = path.join(root, 'content/daily-updates/2026-07-16.md');
  const relWorkFire = fs.existsSync(jul16Work)
    ? relativeDateFindings(fs.readFileSync(jul16Work, 'utf8'), '2026-07-16')
    : [];
  const okRelWorkFire = relWorkFire.some(
    f =>
      f.check === 'relative-date-referent' && /New York|became/i.test(f.message)
  );
  // SILENT on the corrected published Take sentence ("This week New York became…").
  const okRelPubSilentNY =
    !fs.existsSync(jul16Pub) ||
    !relativeDateFindings(fs.readFileSync(jul16Pub, 'utf8'), '2026-07-16').some(
      f => /New York/i.test(f.message)
    );
  // FIRE (synthetic): the exact failure sentence.
  const okRelSynthFire =
    relativeDateFindings(
      'Yesterday New York became the first state to ban new hyperscale data centers outright.',
      '2026-07-16'
    ).length > 0;
  // SILENT (synthetic): the corrected stable form does not shift.
  const okRelSynthStable =
    relativeDateFindings(
      'This week New York became the first state to ban new hyperscale data centers outright.',
      '2026-07-16'
    ).length === 0;
  // SILENT (synthetic): a forward watch carries no past-relative word.
  const okRelSynthWatch =
    relativeDateFindings(
      'Watch the August 12 CPI for the first honest print.',
      '2026-07-16'
    ).length === 0;
  // SILENT (synthetic): possessive "yesterday's" is the Dashboard's stable idiom.
  const okRelSynthPoss =
    relativeDateFindings(
      "The S&P closed at 7,572, up from yesterday's open.",
      '2026-07-16'
    ).length === 0;
  // SILENT (synthetic): a market-move recap is the Writer's device, not a dated event.
  const okRelSynthMarket =
    relativeDateFindings(
      'Yesterday the bond market rallied on soft inflation.',
      '2026-07-16'
    ).length === 0;

  // --- IMP-069: entity-count + regulatory effective-date. Both directions on the REAL 07-18 v2
  //     error sentences (the class that shipped 3 briefs running) + non-fire discipline. ---
  const jul18v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-18-v2.md');
  const jul18pub = path.join(
    process.cwd(),
    'content',
    'daily-updates',
    '2026-07-18.md'
  );
  const ecFire = entityCountClaims(
    'Kroger is acquiring Giant Eagle at roughly 0.18 times revenue for a 470-store regional grocer.',
    '2026-07-18'
  );
  const okEcFire = ecFire.some(
    c =>
      c.key === 'entity-count:470-store' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED'
  );
  const okEcSilent =
    entityCountClaims(
      'Giant Eagle generates about $9 billion in annual sales, 170-plus projects await rules, and the report showed 97 billion hours.',
      '2026-07-18'
    ).length === 0;
  const okEcReal =
    !fs.existsSync(jul18v2) ||
    entityCountClaims(fs.readFileSync(jul18v2, 'utf8'), '2026-07-18').some(
      c => c.key === 'entity-count:470-store' && c.tier === 'critical'
    );
  // The CORRECTED published brief still extracts its count (197-supermarket): the gate forces the
  // corrected number to be RESOLVED too — it is not waved through because it happens to be right.
  const okEcPubResolvable =
    !fs.existsSync(jul18pub) ||
    entityCountClaims(fs.readFileSync(jul18pub, 'utf8'), '2026-07-18').some(c =>
      /^entity-count:197-supermarket/.test(c.key)
    );
  const edFire = effectiveDateClaims(
    "The GENIUS Act's stablecoin framework takes effect today, and the six agencies have not finished the rules.",
    '2026-07-18'
  );
  const okEdFire = edFire.some(
    c =>
      c.claimType === 'effective-date' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED'
  );
  // "The deadline … falls today" is a DEADLINE, not an effective date (the corrected 07-18 phrasing):
  // "falls" is not an effective-verb, so it stays SILENT. This distinction IS the fix.
  const okEdSilentDeadline =
    effectiveDateClaims(
      "The GENIUS Act's deadline for federal regulators to finalize stablecoin rules falls today, one year after it was signed.",
      '2026-07-18'
    ).length === 0;
  const okEdSilentBare =
    effectiveDateClaims(
      'The new ad tier was highly effective and cost-effective across the quarter.',
      '2026-07-18'
    ).length === 0;
  const okEdReal =
    !fs.existsSync(jul18v2) ||
    effectiveDateClaims(fs.readFileSync(jul18v2, 'utf8'), '2026-07-18').some(
      c => c.tier === 'critical' && /takes effect today/i.test(c.sentence)
    );

  // --- IMP-189 (08-17 mandate #1, RC2): NAMED-STATUTE THRESHOLDS. Both directions, asserted against
  //     the two REAL sentences the mandate names — one that must FAIL, one that must stay SILENT. ---
  const aug17v2 = path.join(process.cwd(), 'daily-briefs', '2026-08-17-v2.md');
  const aug17Statutes = fs.existsSync(aug17v2)
    ? statuteThresholdClaims(fs.readFileSync(aug17v2, 'utf8'), '2026-08-17')
    : [];
  // (a) THE SENTENCE THAT WAS FALSE. Wrong criterion (revenue only; "model training costs" is
  //     SB 1047) and wrong effect (the $500M line sorts duties; coverage is the 10^26 FLOP test).
  const okStatFire = statuteThresholdClaims(
    "California's SB 53 exempts any company below $500 million in revenue or model training costs from coverage at all.",
    '2026-08-17'
  ).some(
    c =>
      c.key === 'statute:sb53' &&
      c.claimType === 'statute-threshold' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED'
  );
  // (b) THE SENTENCE THAT WAS RIGHT — the mandate's own "must PASS" case. Correctly sourced, and no
  //     monetary or proportional threshold attached, so this check has no business speaking. Its
  //     effective date is already carried by the effective-date rail; two gates on one clause is how
  //     a nightly storm starts.
  const okStatSilentPrc =
    statuteThresholdClaims(
      'FERC approved PRC-029-1 in Order No. 909 on 24 July 2025. It takes effect 1 October 2026, and it requires inverter-based resources to ride through voltage disturbances.',
      '2026-08-17'
    ).length === 0;
  // (c) A DATE IS NOT A THRESHOLD. The single most likely false-fire, stated as its own assertion.
  const okStatSilentDate =
    statuteThresholdClaims(
      'Order No. 909 was signed on 24 July 2025 and amended on 3 August 2026.',
      '2026-08-17'
    ).length === 0;
  // (d) ON THE REAL FILE: exactly one claim in the brief that shipped the error, and it is that one.
  const okStatReal =
    !fs.existsSync(aug17v2) ||
    (aug17Statutes.length === 1 && aug17Statutes[0]!.key === 'statute:sb53');
  // (e) THE CONTRACT CLOSES: the morning's truth row (bill text URL + the statute's own words)
  //     resolves it. Without a row it rides --require-resolved into the Morning Truth Gate.
  const aug17Truth = path.join(
    process.cwd(),
    'daily-briefs',
    '2026-08-17-truth.json'
  );
  const okStatResolves =
    !fs.existsSync(aug17Truth) ||
    (() => {
      const t = JSON.parse(fs.readFileSync(aug17Truth, 'utf8')) as {
        claims?: Record<string, { resolved?: boolean; source?: string }>;
      };
      const row = t.claims?.['statute:sb53'];
      return (
        !!row && row.resolved === true && /https?:\/\//.test(row.source ?? '')
      );
    })();
  // (f) THE FLOP GATE IS A THRESHOLD TOO — a coverage test with no currency in it.
  const okStatFlop =
    statuteThresholdClaims(
      'SB 53 defines a frontier model as one trained using more than 10^26 FLOPs.',
      '2026-08-17'
    ).length === 1;

  // --- IMP-143 (08-07 mandate #2, re-prescribed 08-08 as #2a): SOURCE CONCLUSIONS. Both directions,
  //     asserted against the REAL artifact the Critic named — 08-08 AI&T-1, whose whole causal spine
  //     rests on a reconstruction of a conference talk that no layer ever had to write down. ---
  const aug08v2 = path.join(process.cwd(), 'daily-briefs', '2026-08-08-v2.md');
  const aug08truth = path.join(
    process.cwd(),
    'daily-briefs',
    '2026-08-08-truth.json'
  );
  const scReal = fs.existsSync(aug08v2)
    ? sourceConclusionClaims(fs.readFileSync(aug08v2, 'utf8'), '2026-08-08')
    : [];
  // FIRE: the Black Hat talk claim is extracted as CRITICAL and UNVERIFIED.
  const scAit1 = scReal.find(c => /Mowshowitz|Black Hat/i.test(c.sentence));
  const okScFireReal =
    !!scAit1 && scAit1.tier === 'critical' && scAit1.status === 'UNVERIFIED';
  // …and it is genuinely UNRESOLVED against the REAL truth file — the block is real, not notional.
  const realTruth = fs.existsSync(aug08truth)
    ? JSON.parse(fs.readFileSync(aug08truth, 'utf8'))
    : { claims: {} };
  const okScUnresolvedReal = !!scAit1 && !realTruth?.claims?.[scAit1.key];
  // SILENT: the SAME claim resolves once the Writer records the source's own conclusion.
  const okScResolves =
    !!scAit1 &&
    (() => {
      const c = { ...scAit1 };
      const t = {
        claims: {
          [c.key]: {
            resolved: true,
            conclusion: 'Agent load took the package repository down.',
          },
        },
      } as any;
      if (t.claims[c.key]) c.status = 'PASS';
      return c.status === 'PASS';
    })();
  // NON-FIRE DISCIPLINE: a bare citation or a bare count is NOT a source conclusion.
  const okScSilentBare =
    sourceConclusionClaims(
      '## The Signal\n\nRoughly three-quarters of US merchant carbon dioxide is byproduct (C&EN, 2023), and Epoch AI counted roughly 2,500 high and critical CVEs in July.',
      '2026-08-08'
    ).length === 0;
  // NON-FIRE: a passing mention of a report with no conclusion verb and no numeral stays silent.
  const okScSilentMention =
    sourceConclusionClaims(
      "## AI & Tech\n\nThe committee's report is expected before the recess.",
      '2026-08-08'
    ).length === 0;
  // NO STORM: fact-gate runs nightly, so the fire rate is asserted, not assumed.
  const scRates = [
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
  ]
    .map(d => path.join(process.cwd(), 'daily-briefs', `${d}-v2.md`))
    .filter(p => fs.existsSync(p))
    .map(
      p =>
        sourceConclusionClaims(
          fs.readFileSync(p, 'utf8'),
          path.basename(p).slice(0, 10)
        ).length
    );
  const okScNoStorm = scRates.length > 0 && Math.max(...scRates) <= 3;
  // ARCHIVE SAFETY (IMP-125's lesson — this check tripped it in-session): a new claim class must
  // NOT back-date itself onto published briefs, whose truth rows can never be written. Asserted on
  // the exact file that went RED: IMP-045's acceptance fixture.
  const jul13pub = path.join(
    process.cwd(),
    'content/daily-updates/2026-07-13.md'
  );
  const okScNoRetro =
    !fs.existsSync(jul13pub) ||
    sourceConclusionClaims(fs.readFileSync(jul13pub, 'utf8'), '2026-07-13')
      .length === 0;
  // …and the guard must not be a blanket off-switch: the SAME text dated today still extracts.
  const okScRetroNotBlanket =
    !fs.existsSync(jul13pub) ||
    sourceConclusionClaims(fs.readFileSync(jul13pub, 'utf8'), '2026-08-08')
      .length > 0;

  // INVERSION LEG, both directions: the literal 08-07 defect — the brief negating what its own
  // source asserts — with every number in the sentence still true.
  const invClaim: Claim = {
    key: 'source-conclusion:test',
    asset: "Wallace's Black Hat talk",
    tier: 'critical',
    claimType: 'source-conclusion',
    direction: 'unknown',
    magnitudePct: null,
    level: null,
    section: '## AI & Tech',
    sentence: 'The evaluation did not detect the intrusion for ten weeks.',
    status: 'UNVERIFIED',
  };
  const okScInvFire =
    sourceConclusionInversions([invClaim], {
      'source-conclusion:test': {
        resolved: true,
        conclusion: 'The evaluation detect flagged the run within hours.',
      },
    }).length === 1;
  const okScInvSilent =
    sourceConclusionInversions(
      [
        {
          ...invClaim,
          sentence: 'The evaluation detected the intrusion within hours.',
        },
      ],
      {
        'source-conclusion:test': {
          resolved: true,
          conclusion: 'The evaluation detected the run within hours.',
        },
      }
    ).length === 0;
  const okScInvNoRow =
    sourceConclusionInversions([invClaim], {
      'source-conclusion:test': { resolved: true },
    }).length === 0;

  // --- IMP-074: AI&T definite-product / deployment claims. FIRE on the 07-19 fabrication SHAPES (the
  //     Critic's quoted sentences), SILENT on the corrected hedged forms, non-AI&T sections, and analysis. ---
  const aiFireMsft = aiProductClaims(
    '## AI & Tech\n\nMicrosoft announced Project Perception, an AI security tool built to undercut its rivals.',
    '2026-07-19'
  );
  const okAiFireMsft = aiFireMsft.some(
    c =>
      c.claimType === 'ai-product' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED'
  );
  const aiFireAtlas = aiProductClaims(
    '## AI & Tech\n\nThe deployment of Boston Dynamics Atlas humanoid robots on the assembly line marks the first such automotive rollout.',
    '2026-07-19'
  );
  const okAiFireAtlas = aiFireAtlas.some(
    c => c.claimType === 'ai-product' && c.tier === 'critical'
  );
  // SILENT: the CORRECTED 07-19 sentences differ from the fabrication by exactly the hedge word.
  const okAiSilentHedgeMsft =
    aiProductClaims(
      '## AI & Tech\n\nMicrosoft is reportedly developing Project Perception, an AI security tool that routes each task to the cheapest model.',
      '2026-07-19'
    ).length === 0;
  const okAiSilentPlanAtlas =
    aiProductClaims(
      "## AI & Tech\n\nHyundai's union struck over the company's plan to put Boston Dynamics Atlas humanoid robots on the line; no units run yet.",
      '2026-07-19'
    ).length === 0;
  // SILENT: an action verb, but the hedge wins ("reportedly launched" is not the false-certainty class).
  const okAiSilentHedgeVerb =
    aiProductClaims(
      '## AI & Tech\n\nMicrosoft reportedly launched a new security tool for enterprises.',
      '2026-07-19'
    ).length === 0;
  // SILENT: analysis prose with no product-action verb.
  const okAiSilentAnalysis =
    aiProductClaims(
      '## AI & Tech\n\nContinuous security is an economics problem before it is a detection problem.',
      '2026-07-19'
    ).length === 0;
  // SILENT: scoping — the same definite product claim OUTSIDE AI&T does not fire here.
  const okAiSilentOther =
    aiProductClaims(
      '## Companies & Crypto\n\nAcme launched a new payments platform for merchants this week.',
      '2026-07-19'
    ).length === 0;
  // REAL ARTIFACT: the shipped-corrected 07-19 v2 no longer carries the fabrication shapes.
  const jul19v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-19-v2.md');
  const okAiRealCorrected =
    !fs.existsSync(jul19v2) ||
    !aiProductClaims(fs.readFileSync(jul19v2, 'utf8'), '2026-07-19').some(c =>
      /announced Project Perception|deployment of Boston Dynamics/i.test(
        c.sentence
      )
    );

  // --- IMP-081: YoY-comparison. Both directions on the REAL 07-21 published sentences (GM fabrication
  //     that SHIPPED + STLD restored-guidance) + non-fire discipline. ---
  const jul21pub = path.join(
    process.cwd(),
    'content',
    'daily-updates',
    '2026-07-21.md'
  );
  // IMP-086 (2026-07-22): the REAL-artifact anchor for the GM YoY moved to the immutable v2. The
  // published 07-21 file was CORRECTED post-publish (archive-corrections gate #18: "roughly 22% above
  // last year" → "roughly 2% below last year's $47.1 billion", mtime 21:19 07-21), so a test pinned to
  // the published file silently began FAILING the selftest — and therefore verify-improvements — the
  // moment the fix it was built to demand actually landed. A real-artifact test must point at an
  // artifact that PRESERVES the failure; daily-briefs/2026-07-21-v2.md is that immutable evening draft.
  const jul21v2 = path.join(process.cwd(), 'daily-briefs', '2026-07-21-v2.md');
  const yoyGm = yoyComparisonClaims(
    '## Markets & Macro\n\nGM carries a consensus of $46 billion in revenue, roughly 22% above last year.',
    '2026-07-21'
  );
  const okYoyGmFire = yoyGm.some(
    c =>
      c.claimType === 'yoy' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED' &&
      c.magnitudePct === 22
  );
  const yoyStld = yoyComparisonClaims(
    '## Companies & Crypto\n\nthe roughly 85% jump in per-share earnings to about $3.69 from $2.01 a year earlier.',
    '2026-07-21'
  );
  const okYoyStldFire = yoyStld.some(
    c => c.claimType === 'yoy' && c.tier === 'critical'
  );
  // RESOLVES: once the Morning Truth Gate records the prior-year actual under the key, it flips to PASS.
  const yoyKey = yoyGm[0]?.key ?? '';
  const fakeYoyTruth: any = {
    claims: {
      [yoyKey]: {
        value: 'GM Q2 2025 revenue $47.1B → $45.96B is DOWN 2.4%',
        source: 'https://investor.gm.com',
      },
    },
  };
  for (const c of yoyGm) if (fakeYoyTruth.claims[c.key]) c.status = 'PASS';
  const okYoyResolves = !!yoyKey && yoyGm.every(c => c.status === 'PASS');
  // SILENT: a spot ratio with no prior-year referent (the AMD run-rate line + an ownership %) — in-section, so it proves the CONTENT guard, not the section scope.
  const okYoySilentRatio =
    yoyComparisonClaims(
      "## AI & Tech\n\nAMD's data-center revenue is roughly 8% of NVIDIA's annualized run rate, and BitMine owns 4.8% of all ether.",
      '2026-07-21'
    ).length === 0;
  // SILENT: a bare intraday move ("up about half a percent", "more than 1%") has no prior-year referent.
  const okYoySilentMove =
    yoyComparisonClaims(
      '## Markets & Macro\n\nS&P futures pointed higher, up about half a percent with the Nasdaq up more than 1%.',
      '2026-07-21'
    ).length === 0;
  // SILENT (scope): a legitimate industry YoY in the Signal stays off the critical rails (the 07-13 USMTO class).
  const okYoyScopeSignal =
    yoyComparisonClaims(
      '## The Signal\n\nMachine-tool orders are running nearly 29% ahead of last year.',
      '2026-07-21'
    ).length === 0;
  // REAL: the shipped 07-21 v2 carries the GM YoY fabrication as an extractable critical claim (decimals
  // and all). Anchored to v2, NOT the published file, which was corrected post-publish (see note above).
  const okYoyReal =
    !fs.existsSync(jul21v2) ||
    yoyComparisonClaims(fs.readFileSync(jul21v2, 'utf8'), '2026-07-21').some(
      c =>
        c.tier === 'critical' &&
        /22\s*%/.test(c.sentence) &&
        /above last year/i.test(c.sentence)
    );

  // --- IMP-082: corporate scheduled-event weekday. FIRE on AMD's real conference-day line, SILENT on
  //     a macro release (owned by scheduledEventClaims) and on a bare weekday with no event. ---
  const okCorpFire = corporateEventDateFindings(
    'AMD opens its Advancing AI 2026 conference Tuesday, expected to unveil the MI450 accelerator.',
    '2026-07-21'
  ).some(f => f.check === 'corporate-event-date');
  const okCorpSilentMacro =
    corporateEventDateFindings(
      'June CPI lands Tuesday at 8:30, and the tape has not priced it.',
      '2026-07-21'
    ).length === 0;
  const okCorpSilentBare =
    corporateEventDateFindings(
      "The S&P closed at 7,443 on Monday's modest decline.",
      '2026-07-21'
    ).length === 0;
  const okCorpReal =
    !fs.existsSync(jul21pub) ||
    corporateEventDateFindings(fs.readFileSync(jul21pub, 'utf8'), '2026-07-21')
      .length > 0;

  // --- IMP-161 (08-11 Critic mandate #2): dated-event weekday. THE ACCEPTANCE IS ON THE REAL v2,
  //     both directions, because the fixture version of this bug is the one that already passed. ---
  const aug11v2 = path.join(process.cwd(), 'daily-briefs', '2026-08-11-v2.md');
  const dew = (s: string) =>
    datedEventWeekdayFindings(s, '2026-08-11').map(f => f.message);
  // FIRE — the exact sentence that shipped false.
  const okDewFire =
    dew(
      '- **Delaware told Verisk on Monday it may not walk away from a $2.35 billion acquisition.** Chancery judge Bonnie David found the termination invalid.'
    ).length === 1;
  // SILENT — forward markers. A computed future date is not an event claim; a gate that flags
  // them is noise, and noise is how a gate's output stops being read.
  const okDewSilentFwd =
    dew(
      'Watch Sunday, when the memorandum covering the current arrangement lapses on Sunday.'
    ).length === 0 &&
    dew(
      'It is a domestic audience or the actual answer, and by Sunday you will know which.'
    ).length === 0;
  // SILENT — market data. The brief names weekdays constantly for prices; none are dateline claims.
  const okDewSilentMkt =
    dew("The S&P finished Monday flat against Friday's record close.")
      .length === 0 &&
    dew('The index closed a fifth of a percentage point higher on Monday.')
      .length === 0 &&
    dew("Monday's brief counted the same six.").length === 0;
  // REAL FILE, FIRE: the shipped v2 must produce a row naming Verisk. This is the receipt that
  // distinguishes this check from the one the mandate asked for — corporate-event-date emits
  // ZERO rows on this sentence and always would have.
  const aug11src = fs.existsSync(aug11v2)
    ? fs.readFileSync(aug11v2, 'utf8')
    : '';
  const okDewRealFire =
    !aug11src ||
    datedEventWeekdayFindings(aug11src, '2026-08-11').some(f =>
      /Delaware told Verisk on Monday/i.test(f.message)
    );
  // REAL FILE, NO DOUBLE-COUNT: C&C-1 (Archer/Boeing) is owned by corporate-event-date; this
  // check must not emit a second row for the same bullet.
  const okDewNoDupe =
    !aug11src ||
    !datedEventWeekdayFindings(aug11src, '2026-08-11').some(f =>
      /Archer Aviation bought/i.test(f.message)
    );

  // --- IMP-202 (08-20 Critic mandate #1): SERIES-EXTREMUM ATTESTATION. The mandate specified the
  //     acceptance itself — "three cases, two directions, or it is not a gate" — so these are its
  //     cases, on the real 08-20 bytes, not synthetic ones. ---
  const sec = (s: string, d = '2026-08-20') =>
    seriesExtremumClaims(`## Markets & Macro\n\n- ${s}`, d);
  // FIRE — the sentence that PUBLISHED, false in both parts.
  const okSeriesFire =
    sec(
      'The personal savings rate ended June at 2.7 percent, near the lowest in a series beginning in 1947.'
    ).length === 1;
  const okSeriesNamesAnchor =
    sec(
      'The personal savings rate ended June at 2.7 percent, near the lowest in a series beginning in 1947.'
    )[0]?.asset.includes('1947') === true;
  // SILENT — an event-recurrence claim with a NAMED, DATED comparable, and it was verified TRUE.
  // A gate that punishes the one historical claim tonight that was done correctly teaches the
  // Writer to stop doing it right.
  const okSeriesSilentDated =
    sec(
      'Three dissents in the same direction is the first such split since September 2016, when George, Mester and Rosengren dissented for a hike and the Fed delivered one that December.'
    ).length === 0;
  // SILENT — an internal comparison. No extremum, no series.
  const okSeriesSilentInternal =
    sec(
      'The segment turned $80 million of gross profit, more than the consolidated total.'
    ).length === 0;
  // SILENT — the COMPLIANT REPAIR. A bounded horizon is what the mandate asks the Writer to write
  // instead ("a four-year low is a four-year low and says so"), so it must never fire.
  const okSeriesSilentBounded =
    sec('The personal savings rate ended June at 2.7 percent, a four-year low.')
      .length === 0 &&
    sec(
      'The personal savings rate ended June at 2.7 percent, against 4.6 percent a year earlier.'
    ).length === 0;
  // SILENT — before the leg's effective date (the --require-resolved regression fixtures predate
  // it and cannot be re-published; mirrors EARNINGS_LEG_EFFECTIVE).
  const okSeriesSilentPre =
    sec(
      'The personal savings rate ended June at 2.7 percent, near the lowest in a series beginning in 1947.',
      '2026-07-13'
    ).length === 0;
  // CRITICAL RAIL — the claim must land unverified-and-critical, which is what blocks publish.
  const okSeriesCritical = (() => {
    const c = sec(
      'The personal savings rate ended June at 2.7 percent, near the lowest in a series beginning in 1947.'
    )[0];
    return (
      c?.tier === 'critical' &&
      c?.status === 'UNVERIFIED' &&
      c.key.startsWith('series:')
    );
  })();

  // --- IMP-083: segment-metric attribution. FIRE on AMD's compound "data-center GPU revenue, $X",
  //     SILENT on a single-qualifier disclosed segment ("Data Center revenue of $X"). ---
  const okSegFire = segmentMetricFindings(
    "AMD's data-center GPU revenue, $7.7 billion in the trailing year through Q1, is roughly 8% of NVIDIA's run rate.",
    '2026-07-21'
  ).some(f => f.check === 'segment-metric-attribution');
  const okSegSilentDisclosed =
    segmentMetricFindings(
      'AMD reported Data Center revenue of $12.8 billion, up sharply on AI demand.',
      '2026-07-21'
    ).length === 0;

  // IMP-101 (restored 07-31): stock-move reaction magnitude surfaced for the morning truth gate.
  const okSmFire = stockMoveReactionFindings(
    '## Companies & Crypto\nGE Vernova beat, but the stock fell 8 percent because core EPS came in at $2.47 against a $3.18 estimate.',
    '2026-07-26'
  ).some(f => f.check === 'stock-move-reaction');
  const okSmSilentYoy =
    stockMoveReactionFindings(
      '## Companies & Crypto\nRevenue rose 12 percent year over year to $48 billion.',
      '2026-07-26'
    ).length === 0;
  const okSmSilentIndex =
    stockMoveReactionFindings(
      '## Markets & Macro\nThe S&P fell 1.2 percent on the print.',
      '2026-07-26'
    ).length === 0;
  const okSmSilentName =
    stockMoveReactionFindings(
      '## Companies & Crypto\nMicron surged 12 percent after the guide.',
      '2026-07-26'
    ).length === 0;
  // Precision: on a long bullet carrying a metric % AND a stock-move %, the flag must quote the
  // STOCK move (10%), not the first metric % on the line (37%) — the real 07-31 Amazon shape.
  const smAmzn = stockMoveReactionFindings(
    '## AI & Tech\n- **Amazon posted its first $200 billion quarter, AWS grew 37% to $42.23 billion, and the stock rose about 10% after hours.** Filler.',
    '2026-07-31'
  );
  const okSmPrecise = smAmzn.some(
    f =>
      f.check === 'stock-move-reaction' &&
      /\b10\s*%/.test(f.message) &&
      !/\b37\s*%/.test(f.message)
  );

  // --- IMP-115: the Take's publicly-unverifiable load-bearing figure. FIRE on all three real
  //     shapes (07-31 v2 "55% of the world's total", 08-01 "in all of 2025", 07-30 v2 "larger than
  //     the entire IEA reserve release"); SILENT outside the Take, and SILENT on an ordinary
  //     sourced Take figure. Real artifacts where they exist, fixtures otherwise. ---
  const takeWrap = (s: string) => `# ▸ THE TAKE\n\n${s}\n`;
  const teShare = takeExtraordinaryFindings(
    takeWrap(
      "China's autonomous mining fleet went from 562 trucks to 2,090 in a single year, roughly 55% of the world's total and the largest battery-electric autonomous fleet on earth."
    ),
    '2026-07-31'
  );
  const okTeShare = teShare.some(
    f =>
      f.check === 'take-extraordinary-claim' && /share-of-world/.test(f.message)
  );
  const tePeriod = takeExtraordinaryFindings(
    takeWrap(
      'Capital deployed reached roughly $1.6 billion year to date against roughly $1.6 billion in all of 2025.'
    ),
    '2026-08-01'
  );
  const okTePeriod = tePeriod.some(f => /full-period-baseline/.test(f.message));
  const teCmp = takeExtraordinaryFindings(
    takeWrap(
      "The Chinese import withdrawal, a discretionary cut larger than the entire IEA reserve release during the 2022 crisis, is the deferred curve's anchor."
    ),
    '2026-07-30'
  );
  const okTeCmp = teCmp.some(f => /benchmark-comparison/.test(f.message));
  // Scoping: the identical sentence in a SIX bullet is NOT this failure class (the Six is priced and
  // sourced bullet-by-bullet; the Take is the load-bearing argument). Zero findings outside the Take.
  const okTeScoped =
    takeExtraordinaryFindings(
      "## Markets & Macro\n\nChina refines roughly 55% of the world's rare earths.",
      '2026-07-31'
    ).length === 0;
  const okTeSilentOrdinary =
    takeExtraordinaryFindings(
      takeWrap(
        'Constellation Software deployed $809 million in Q1 2026, and organic recurring revenue decelerated to 4% FX-neutral.'
      ),
      '2026-08-01'
    ).length === 0;
  // REAL artifacts: the 07-31 v2 Take (pre-morning-gate, where the truck claim still lives) and the
  // published 08-01 Take (where the $1.6B/2025 baseline shipped and the Critic sourced it WRONG).
  const v2_0731 = path.join(process.cwd(), 'daily-briefs', '2026-07-31-v2.md');
  const okTeReal31 =
    !fs.existsSync(v2_0731) ||
    takeExtraordinaryFindings(
      fs.readFileSync(v2_0731, 'utf8'),
      '2026-07-31'
    ).some(f => /world'?s total|55\s*%/.test(f.message));
  const pub_0801 = path.join(
    process.cwd(),
    'content',
    'daily-updates',
    '2026-08-01.md'
  );
  const okTeReal01 =
    !fs.existsSync(pub_0801) ||
    takeExtraordinaryFindings(
      fs.readFileSync(pub_0801, 'utf8'),
      '2026-08-01'
    ).some(f => /all of 2025/.test(f.message));

  // --- IMP-086: earnings-result vs consensus. FIRE on the real 07-22 fabricated EQT shape (the "beat"
  //     that was a miss) AND the real published 07-22 EQT line; RESOLVE to PASS with truth; SILENT on a
  //     bare YoY (owned by yoy), a guidance line, and a stock-price move. ---
  const jul22pub = path.join(
    process.cwd(),
    'content',
    'daily-updates',
    '2026-07-22.md'
  );
  const earnFab = earningsResultClaims(
    '## Companies & Crypto\n\nEQT posted Q2 revenue of $2.56 billion against a $1.84 billion consensus, a 39% beat, with adjusted EPS of $0.45 versus $0.41 expected.',
    '2026-07-22'
  );
  const okEarnFire = earnFab.some(
    c =>
      c.claimType === 'earnings' &&
      c.tier === 'critical' &&
      c.status === 'UNVERIFIED'
  );
  const earnKey = earnFab[0]?.key ?? '';
  const fakeEarnTruth: any = {
    claims: {
      [earnKey]: {
        value: 'EQT Q2 revenue $1.81B; adj EPS $0.39 MISSED ~$0.42',
        source: 'https://www.marketscreener.com',
      },
    },
  };
  for (const c of earnFab) if (fakeEarnTruth.claims[c.key]) c.status = 'PASS';
  const okEarnResolves = !!earnKey && earnFab.every(c => c.status === 'PASS');
  const okEarnSilentYoy =
    earningsResultClaims(
      '## Markets & Macro\n\nGM reported Q2 revenue of $48.03 billion, up 1.9% year over year, with adjusted EPS of $3.57.',
      '2026-07-22'
    ).length === 0;
  const okEarnSilentGuidance =
    earningsResultClaims(
      '## Companies & Crypto\n\nEQT raised full-year output guidance by roughly 90 Bcfe while trimming capital spending.',
      '2026-07-22'
    ).length === 0;
  const okEarnSilentMove =
    earningsResultClaims(
      '## Markets & Macro\n\nMicron surged 12% after Bank of America reiterated a buy with a $1,550 target.',
      '2026-07-22'
    ).length === 0;
  const okEarnReal =
    !fs.existsSync(jul22pub) ||
    earningsResultClaims(fs.readFileSync(jul22pub, 'utf8'), '2026-07-22').some(
      c => c.tier === 'critical' && /EQT|1\.81 billion|0\.39/i.test(c.sentence)
    );

  // ── IMP-165 (08-12 Critic mandate #3, RC2; discharges IMP-151(a)) ────────────────────────────
  // Both directions, on REAL artifacts and on the two synthetic receipts the deferred row named.
  const aug12v2 = path.join(process.cwd(), 'daily-briefs/2026-08-12-v2.md');
  const attrReal = fs.existsSync(aug12v2)
    ? attributedSuperlativeClaims(
        fs.readFileSync(aug12v2, 'utf8'),
        '2026-08-12'
      )
    : [];
  // FIRE leg 1 — the real C&C-1 sentence is extracted as a CRITICAL claim.
  const okAttrRealFire =
    !fs.existsSync(aug12v2) ||
    attrReal.some(
      c =>
        c.tier === 'critical' &&
        /acquirer|photon[- ]counting|independent supplier/i.test(c.sentence)
    );
  // …and it is UNRESOLVED against the real truth file, so --require-resolved blocks it.
  const attrCC1 = attrReal.find(c => /independent supplier/i.test(c.sentence));
  const realTruth12 = (() => {
    try {
      return JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'daily-briefs/2026-08-12-truth.json'),
          'utf8'
        )
      );
    } catch {
      return null;
    }
  })();
  // The STRONGEST both-directions leg available, because both files are real and share one key:
  // v2 shipped "THE ONLY independent supplier"; the published file carries the morning gate's
  // correction, "one of the world's only". Same bullet, same claim key, same truth row —
  // the draft must FAIL hedge-deleted and the published file must be SILENT. A gate that can
  // tell those two apart is measuring the claim, not the sentence.
  const okAttrRealUnresolved =
    !fs.existsSync(aug12v2) ||
    (!!attrCC1 &&
      !!realTruth12?.claims?.[attrCC1.key]?.quotation &&
      attributedSuperlativeFidelity([attrCC1], realTruth12.claims).some(
        f => f.check === 'attributed-superlative-hedge-deleted'
      ));

  // FIRE leg 2 — HEDGE-DELETED, the 08-12 defect stated against the source's own words.
  const hedgeClaim = attributedSuperlativeClaims(
    "## Companies & Crypto\n\nThe target, by the acquirer's own account, is the only independent supplier of commercially ready photon-counting CT detectors.",
    '2026-08-12'
  );
  const okAttrHedge =
    hedgeClaim.length === 1 &&
    attributedSuperlativeFidelity(hedgeClaim, {
      [hedgeClaim[0]!.key]: {
        resolved: true,
        quotation:
          "one of the world's only credible, commercially ready independent suppliers of photon-counting CT detectors",
      },
    }).some(f => f.check === 'attributed-superlative-hedge-deleted');

  // FIRE leg 3 — SCOPE-ADDED, the 08-09 Take lede IMP-151 was deferred on twice.
  const scopeClaim = attributedSuperlativeClaims(
    '## THE TAKE\n\nAccording to Cleveland-Cliffs, it is the first new American iron mine in seventy years.',
    '2026-08-12'
  );
  const okAttrScope =
    scopeClaim.length === 1 &&
    attributedSuperlativeFidelity(scopeClaim, {
      [scopeClaim[0]!.key]: {
        resolved: true,
        quotation: 'the first new iron mine in Minnesota in seventy years',
      },
    }).some(f => f.check === 'attributed-superlative-scope-added');

  // SILENT leg 1 — the source's hedge survives in the brief. This is correct behaviour and a gate
  // that flags it is worthless (IMP-151's own words about the Fastmarkets pair).
  const okAttrSilentFaithful = (() => {
    const c = attributedSuperlativeClaims(
      "## Companies & Crypto\n\nThe target, by the acquirer's own account, is one of the world's only independent suppliers of photon-counting CT detectors.",
      '2026-08-12'
    );
    return (
      c.length === 1 &&
      attributedSuperlativeFidelity(c, {
        [c[0]!.key]: {
          resolved: true,
          quotation:
            "one of the world's only credible, commercially ready independent suppliers",
        },
      }).length === 0
    );
  })();

  // SILENT leg 2 — an UNATTRIBUTED superlative (08-09 Geo-1, sourced to CSIS) is not this class.
  const okAttrSilentUnattributed =
    attributedSuperlativeClaims(
      '## Geopolitics\n\nThe sortie was Beijing’s first public demonstration of sea-based strategic reach, per CSIS imagery.',
      '2026-08-12'
    ).length === 0;

  // SILENT leg 3 — an ARGUMENT containing "the only" credits nobody with saying it (08-09 Take).
  const okAttrSilentArgument =
    attributedSuperlativeClaims(
      '## THE TAKE\n\nBuying the incumbent is the only way to get one on a venture timeline.',
      '2026-08-12'
    ).length === 0;

  // SILENT leg 4 — tonight's Discovery and Signal-2, the two clean negatives the mandate named,
  // measured on the real file so the silent leg cannot be tuned.
  const okAttrSilentCleanSections =
    !fs.existsSync(aug12v2) ||
    !attrReal.some(c => /Discovery|Signal/i.test(c.section));

  // SILENT leg 5 — THE `never` FALSE POSITIVE, pinned to the real published file. Bare substring
  // matching found "ever" inside "Teledyne has never built" and reported a bullet the morning gate
  // had already corrected to the source's exact words. This leg exists so it can never come back.
  const pub12 = path.join(process.cwd(), 'content/daily-updates/2026-08-12.md');
  const okAttrNoNeverFp = (() => {
    if (!fs.existsSync(pub12)) return true;
    const cl = attributedSuperlativeClaims(
      fs.readFileSync(pub12, 'utf8'),
      '2026-08-12'
    );
    let truthPub: any = null;
    try {
      truthPub = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'daily-briefs/2026-08-12-truth.json'),
          'utf8'
        )
      );
    } catch {
      return true;
    }
    return attributedSuperlativeFidelity(cl, truthPub?.claims).length === 0;
  })();

  // NO-STORM leg — this must not become a nightly worklist. Measured across the real v2 window.
  const attrRates = ['2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12']
    .map(d => path.join(process.cwd(), `daily-briefs/${d}-v2.md`))
    .filter(f => fs.existsSync(f))
    .map(
      f =>
        attributedSuperlativeClaims(fs.readFileSync(f, 'utf8'), '2026-08-12')
          .length
    );
  const okAttrNoStorm = attrRates.length === 0 || Math.max(...attrRates) <= 3;

  // NO-RETRO leg — the rule binds from 2026-08-12 forward; the archive cannot be condemned by it.
  const okAttrNoRetro =
    attributedSuperlativeClaims(
      "## Companies & Crypto\n\nThe target, by the acquirer's own account, is the only independent supplier.",
      '2026-07-13'
    ).length === 0;

  // ── IMP-166 (08-13 Critic mandate #1, RC2): issuer-causal ────────────────────────────────────
  // Every leg is the mandate's own acceptance spec, on the real files it named. The mandate's
  // diagnosis was VERIFIED before building to it (Apply_Improvements / CARRY 2026-08-11 row 60):
  // `grep -c issuerCausal scripts/fact-gate.ts` was 0 and the 08-13 truth file really does carry
  // ZERO source-conclusion rows for Companies & Crypto — the stated mechanism reproduced.
  const aug13v2 = path.join(process.cwd(), 'daily-briefs/2026-08-13-v2.md');
  const issuer13 = fs.existsSync(aug13v2)
    ? issuerCausalClaims(fs.readFileSync(aug13v2, 'utf8'), '2026-08-13')
    : [];
  // FIRE leg 1 — the real C&C-2 sentence that substituted a 151% VOLUME rise for the issuer's own
  // 25% average-circulation growth, and refuted its own thesis doing it.
  const okIssuerFireCircle =
    !fs.existsSync(aug13v2) ||
    issuer13.some(
      c =>
        c.tier === 'critical' &&
        /66 basis points/i.test(c.sentence) &&
        /151 percent/i.test(c.sentence)
    );
  // …and it is UNRESOLVED against the real 08-13 truth file, so --require-resolved blocks it at the
  // Morning Truth Gate. This is the leg that proves the GAP existed: the contract wrote 11 rows and
  // none of them was this one.
  const realTruth13 = (() => {
    try {
      return JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'daily-briefs/2026-08-13-truth.json'),
          'utf8'
        )
      );
    } catch {
      return null;
    }
  })();
  const okIssuerUnresolved =
    !fs.existsSync(aug13v2) ||
    !realTruth13 ||
    issuer13.every(c => !realTruth13.claims?.[c.key]);
  // FIRE leg 2 — the 08-12 AI&T-1 conditional inference on a GUIDED range, the mandate's second
  // named FIRE case. This is why the quantity test accepts an anaphor as well as a digit.
  const okIssuerFireCoreWeave =
    !fs.existsSync(aug12v2) ||
    issuerCausalClaims(fs.readFileSync(aug12v2, 'utf8'), '2026-08-12').some(
      c =>
        /coreweave/i.test(c.key) ||
        /guidance for one cost line/i.test(c.sentence)
    );
  // SILENT leg 1 — tonight's Wild Card Timema bullet. A named STUDY, correctly carrying the
  // source's own leading alternative, ALREADY covered by IMP-143. A duplicate row is a storm.
  const okIssuerSilentTimema =
    !fs.existsSync(aug13v2) ||
    !issuer13.some(c => /Wild Card/i.test(c.section));
  // SILENT leg 2 — tonight's Geo-2. Figures from reporting: no issuer, no reported-metric claim.
  const okIssuerSilentGeo =
    !fs.existsSync(aug13v2) ||
    !issuer13.some(c => /Geopolitic/i.test(c.section));
  // NO-STORM leg — the mandate's ceiling is ≤2 new rows per brief. Measured with the date gate
  // LIFTED across the real 08-04…08-13 window, so the silence is a property of the trigger and not
  // an artifact of EFFECTIVE_FROM: max observed 2, mean 0.6.
  const issuerRates = [
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
  ]
    .map(d => path.join(process.cwd(), `daily-briefs/${d}-v2.md`))
    .filter(f => fs.existsSync(f))
    .map(
      f => issuerCausalClaims(fs.readFileSync(f, 'utf8'), '2026-08-13').length
    );
  const okIssuerNoStorm =
    issuerRates.length === 0 || Math.max(...issuerRates) <= 2;
  // SILENT leg 3 — a STUDY with a causal verb and a metric-shaped noun is not an issuer claim.
  const okIssuerSilentStudy =
    issuerCausalClaims(
      '## Wild Card\n\nBangor University reported that a million years of asexual reproduction left the machinery intact in 3 species.',
      '2026-08-13'
    ).length === 0;
  // NO-RETRO leg — binds from 2026-08-12 forward (IMP-125).
  const okIssuerNoRetro =
    issuerCausalClaims(
      '## Companies & Crypto\n\nCircle reported revenue of $701 million, and that alone ate a 151 percent rise in volume.',
      '2026-07-13'
    ).length === 0;

  // ---------------- IMP-180 — THE CITATION-LOCATOR RAIL (2026-08-16 mandate #2) ----------------
  // Every leg below runs against REAL FILES ON DISK, not fixtures: the defect is a chapter number
  // that shipped, and a fixture cannot prove a rail bites the thing that actually reached readers.
  const locStrip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '');
  const locRead = (f: string): string | null => {
    const fp = path.join(process.cwd(), f);
    return fs.existsSync(fp) ? locStrip(fs.readFileSync(fp, 'utf8')) : null;
  };
  const loc0816 = locRead('daily-briefs/2026-08-16-v2.md');
  const loc0814 = locRead('daily-briefs/2026-08-14-v2.md');
  // FIRE: the shipped "chapter 10" with no quote-locator row anywhere.
  const okLocFire =
    loc0816 === null ||
    citationLocatorRail(loc0816, null, '2026-08-16', false).filter(
      f => f.check === 'citation-locator-unresolved'
    ).length === 1;
  // ESCALATES: add the TRUE row (chapter 6) and the disagreement becomes a hard FAIL.
  const okLocMismatch =
    loc0816 === null ||
    citationLocatorRail(
      loc0816,
      {
        claims: {
          'quote-locator:stanislavski-actor-prepares-relaxation': {
            value: 6,
            resolved: true,
            source:
              'An Actor Prepares, Hapgood translation, published 16-chapter contents',
          },
        },
      },
      '2026-08-16',
      false
    ).some(
      f => f.check === 'citation-locator-mismatch' && f.severity === 'FAIL'
    );
  // SILENT: a resolved row that AGREES with the shipped locator.
  const okLocAgrees =
    loc0816 === null ||
    citationLocatorRail(
      loc0816,
      {
        claims: {
          'quote-locator:stanislavski-actor-prepares-relaxation': {
            value: 10,
            resolved: true,
            source: 'published contents',
          },
        },
      },
      '2026-08-16',
      false
    ).length === 0;
  // SILENT: 08-14's Hopkins attribution names the WORK and no locator — the correct default, and
  // the clean negative on a real file. (This also covers the same brief's Model attribution.)
  const okLocSilentWork =
    loc0814 === null ||
    citationLocatorRail(loc0814, null, '2026-08-16', false).length === 0;
  // NO STORM, measured with the EFFECTIVE_FROM shield DELIBERATELY OFF so the silence is the
  // rail's and not the date's: 08-09…08-15 must produce ≤1 finding in total.
  let locStorm = 0;
  for (const d of ['09', '10', '11', '12', '13', '14', '15']) {
    const b = locRead(`daily-briefs/2026-08-${d}-v2.md`);
    if (b) locStorm += citationLocatorRail(b, null, null, false).length;
  }
  const okLocNoStorm = locStorm <= 1;
  // NO RETRO: the same firing file, dated before EFFECTIVE_FROM, is silent (IMP-125).
  const okLocNoRetro =
    loc0816 === null ||
    citationLocatorRail(loc0816, null, '2026-08-15', false).length === 0;
  // The extractor itself must not read ordinary prose as a credit line.
  const okLocNotProse =
    attributionLocators(
      'The Fed published a 40-page review; see page 12 for the dissent.\n'
    ).length === 0 &&
    attributionLocators('— Marcus Aurelius, Meditations, book 4\n').length ===
      1;

  console.log(
    `  [IMP-180] FIRE on the REAL 2026-08-16 v2 ("An Actor Prepares, chapter 10", no quote-locator row): ${okLocFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-180] ESCALATES to FAIL once the true row (chapter 6) exists: ${okLocMismatch ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-180] SILENT when a resolved row AGREES with the shipped locator: ${okLocAgrees ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-180] SILENT on 2026-08-14 v2 (Hopkins + the Model name works, not locators): ${okLocSilentWork ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-180] NO STORM across 08-09…08-15 with the date shield OFF: ${okLocNoStorm ? '✓' : '✗'} (${locStorm} finding(s))`
  );
  console.log(
    `  [IMP-180] NO RETRO: same file dated 2026-08-15 is silent: ${okLocNoRetro ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-180] extractor reads credit lines, not prose ("see page 12"): ${okLocNotProse ? '✓' : '✗'}`
  );

  console.log('fact-gate --selftest');
  console.log(
    `  [IMP-081] FIRE: GM "$46 billion in revenue, 22% above last year" is a CRITICAL yoy claim: ${okYoyGmFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-081] FIRE: STLD "85% jump … $3.69 from $2.01 a year earlier" (spans decimals): ${okYoyStldFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-081] RESOLVES to PASS once truth carries yoy:<slug>: ${okYoyResolves ? '✓' : '✗'} (key=${yoyKey.slice(0, 32)})`
  );
  console.log(
    `  [IMP-081] SILENT on a spot ratio ("8% of NVIDIA's run rate", "4.8% of all ether"): ${okYoySilentRatio ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-081] SILENT on a bare intraday move ("up about half a percent"): ${okYoySilentMove ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-081] SILENT (scope) on a Signal industry YoY ("machine orders 29% ahead of last year"): ${okYoyScopeSignal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-081] FIRE on the REAL published 07-21 (the GM YoY that shipped): ${okYoyReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-082] FIRE: "AMD opens its … conference Tuesday" is a corporate-event-date FLAG: ${okCorpFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-082] SILENT on a macro release ("CPI lands Tuesday" — owned by scheduledEventClaims): ${okCorpSilentMacro ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-082] SILENT on a bare weekday with no event verb ("Monday's decline"): ${okCorpSilentBare ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-082] FIRE on the REAL published 07-21 (AMD/GM weekday event): ${okCorpReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-161] FIRE: "Delaware told Verisk on Monday" is a dated-event-weekday FLAG: ${okDewFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-202] FIRE: "2.7 percent, near the lowest in a series beginning in 1947" is a CRITICAL series claim naming the asserted anchor: ${okSeriesFire && okSeriesNamesAnchor && okSeriesCritical ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-202] SILENT: dated comparable ("first such split since September 2016") · internal comparison ("more than the consolidated total") · bounded horizon ("a four-year low") · pre-effective-date: ${okSeriesSilentDated && okSeriesSilentInternal && okSeriesSilentBounded && okSeriesSilentPre ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-161] SILENT on forward markers ("Watch Sunday", "by Sunday you will know"): ${okDewSilentFwd ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-161] SILENT on market weekdays ("finished Monday flat", "Monday's brief"): ${okDewSilentMkt ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-161] FIRE on the REAL 2026-08-11-v2.md at C&C-2 (corporate-event-date emits ZERO there): ${okDewRealFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-161] NO DOUBLE-COUNT on C&C-1 (owned by corporate-event-date): ${okDewNoDupe ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-083] FIRE: "data-center GPU revenue, $7.7 billion" is a segment-metric FLAG: ${okSegFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-083] SILENT on a disclosed single-qualifier segment ("Data Center revenue of $12.8B"): ${okSegSilentDisclosed ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-101] FIRE: "the stock fell 8 percent" (07-26 GE Vernova) is a stock-move FLAG: ${okSmFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-101] SILENT on a YoY / index move ("S&P fell 1.2%") / name-only move ("Micron surged 12%"): ${okSmSilentYoy && okSmSilentIndex && okSmSilentName ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-101] PRECISION: quotes the stock move (10%), not the metric % (37%), on a mixed bullet: ${okSmPrecise ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] FIRE: "55% of the world's total" (07-31 Take) is a share-of-world FLAG: ${okTeShare ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] FIRE: "in all of 2025" as a comparison baseline (08-01 Take, sourced WRONG) is a full-period FLAG: ${okTePeriod ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] FIRE: "larger than the entire IEA reserve release" (07-30 Take) is a benchmark FLAG: ${okTeCmp ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] SCOPED: SILENT on the identical sentence in a Six bullet: ${okTeScoped ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] SILENT on an ordinary sourced Take figure ($809M in Q1 2026, 4% FXN): ${okTeSilentOrdinary ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-115] FIRE on the REAL 07-31 v2 Take and the REAL published 08-01 Take: ${okTeReal31 && okTeReal01 ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-086] FIRE: EQT "$2.56B against a $1.84B consensus … $0.45 versus $0.41 expected" is a CRITICAL earnings claim: ${okEarnFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-086] RESOLVES to PASS once truth carries earnings:<slug>: ${okEarnResolves ? '✓' : '✗'} (key=${earnKey.slice(0, 32)})`
  );
  console.log(
    `  [IMP-086] SILENT on a bare YoY ("revenue $48.03B, up 1.9% YoY" — owned by yoy): ${okEarnSilentYoy ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-086] SILENT on a guidance line and a stock-price move: ${okEarnSilentGuidance && okEarnSilentMove ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-086] FIRE on the REAL published 07-22 (the EQT earnings line): ${okEarnReal ? '✓' : '✗'}`
  );
  console.log(
    `  FIRE: 07-16 working file "Yesterday New York became…" is a relative-date FLAG: ${okRelWorkFire ? '✓' : '✗'} (${relWorkFire.length} finding(s))`
  );
  console.log(
    `  SILENT on the corrected published Take ("This week New York became…"): ${okRelPubSilentNY ? '✓' : '✗'}`
  );
  console.log(
    `  FIRE on synthetic "Yesterday New York became…": ${okRelSynthFire ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on the stable form "This week New York became…": ${okRelSynthStable ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on a forward watch ("Watch the August 12 CPI"): ${okRelSynthWatch ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on possessive "yesterday's open": ${okRelSynthPoss ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on a market-move recap ("Yesterday the bond market rallied"): ${okRelSynthMarket ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] FIRE: "470-store regional grocer" is a CRITICAL entity-count claim: ${okEcFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] SILENT on "$9B sales / 170-plus projects / 97 billion hours" (no footprint noun): ${okEcSilent ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] FIRE on the REAL 07-18 v2 (470-store): ${okEcReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] the corrected published brief still extracts 197-supermarket (must resolve): ${okEcPubResolvable ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] FIRE: "the framework takes effect today" is a CRITICAL effective-date claim: ${okEdFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] SILENT on "the deadline … falls today" (a deadline ≠ an effective date): ${okEdSilentDeadline ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-189] FIRE: SB 53 + "$500 million" is a CRITICAL statute-threshold claim: ${okStatFire ? '✓' : '✗'}\n` +
      `  [IMP-189] SILENT on the correctly-sourced "PRC-029-1 in Order No. 909" (no threshold attached): ${okStatSilentPrc ? '✓' : '✗'}\n` +
      `  [IMP-189] SILENT when the only numbers are DATES: ${okStatSilentDate ? '✓' : '✗'}\n` +
      `  [IMP-189] a FLOP coverage test counts as a threshold: ${okStatFlop ? '✓' : '✗'}\n` +
      `  [IMP-189] REAL 08-17 v2: exactly one statute claim, statute:sb53 (${aug17Statutes.length} found): ${okStatReal ? '✓' : '✗'}\n` +
      `  [IMP-189] the morning truth row resolves it, with the bill text URL: ${okStatResolves ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] SILENT on bare "highly effective / cost-effective": ${okEdSilentBare ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-069] FIRE on the REAL 07-18 v2 ("takes effect today"): ${okEdReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] FIRE on the REAL 08-08 AI&T-1 source conclusion (${scAit1 ? scAit1.key : 'NOT FOUND'}): ${okScFireReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] …and it is UNRESOLVED against the real 2026-08-08-truth.json: ${okScUnresolvedReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] RESOLVES once the source's own conclusion is recorded: ${okScResolves ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] SILENT on a bare citation / bare count (C&EN, Epoch AI): ${okScSilentBare ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] SILENT on a passing mention with no conclusion verb: ${okScSilentMention ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] NO STORM — per-brief claims across 08-04…08-08: [${scRates.join(', ')}] (max 3): ${okScNoStorm ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] does NOT back-date onto the published 2026-07-13 archive (IMP-125's lesson): ${okScNoRetro ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] …and the date guard is not a blanket off-switch — same text, today's date, still extracts: ${okScRetroNotBlanket ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] SOURCE CONCLUSION INVERTED fires when the brief negates its source: ${okScInvFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] …silent when the brief AGREES with the recorded conclusion: ${okScInvSilent ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-143] …silent when no conclusion was recorded (no phantom findings): ${okScInvNoRow ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] FIRE: "Microsoft announced Project Perception" is a CRITICAL ai-product claim: ${okAiFireMsft ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] FIRE: "the deployment of ... Atlas ... robots" is a CRITICAL ai-product claim: ${okAiFireAtlas ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on the corrected "is reportedly developing Project Perception" (hedge): ${okAiSilentHedgeMsft ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on the corrected "plan to put ... Atlas ... robots" (future plan): ${okAiSilentPlanAtlas ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on "reportedly launched" (hedge beats the action verb): ${okAiSilentHedgeVerb ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on AI&T analysis prose (no product-action verb): ${okAiSilentAnalysis ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on a definite product claim OUTSIDE AI&T (scoping): ${okAiSilentOther ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-074] SILENT on the shipped-corrected REAL 07-19 v2 (no fabrication shape): ${okAiRealCorrected ? '✓' : '✗'}`
  );
  console.log(
    `  FIRE: 07-15 C&C-1 "combined … $49 billion, up 39%" is a CRITICAL aggregate claim: ${okAggFire ? '✓' : '✗'} (key=${aggKey})`
  );
  console.log(
    `  RESOLVES to PASS once truth carries aggregate:<magnitude>: ${okAggResolves ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on a single-entity figure ("JPMorgan … $21.2 billion"): ${okAggSingle ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on 07-13 "$1.045 trillion in total" (not a constituent sum): ${okAggSilent13 ? '✓' : '✗'}`
  );
  console.log(
    `  event-calendar loads (CPI 2026-07-14, BLS): ${okCalLoad ? '✓' : '✗'} (${cal.length} event(s))`
  );
  console.log(
    `  FAIL on real 07-13 DRAFT "CPI … land in the same session": ${okEvFire ? '✓' : '✗'} (${evFireN} finding(s))`
  );
  console.log(
    `  SILENT on real 07-13 PUBLISHED ("lands tomorrow" / "Tuesday"): ${okEvSilent ? '✓' : '✗'} (${evSilentFindings.length} finding(s))`
  );
  console.log(
    `  same-session claim with NO calendar entry still rides critical rails: ${okEvNoCal ? '✓' : '✗'}`
  );
  console.log(
    `  FAIL on a weekday that contradicts the calendar: ${okEvWrongDay ? '✓' : '✗'}`
  );
  console.log(
    `  price attributed to the NEAREST asset (WTI=74.41, not Brent's 79): ${okWtiAttrib ? '✓' : '✗'} (wti=${wtiGot})`
  );
  console.log(
    `  "highest-and-best use" is not a superlative: ${okToa ? '✓' : '✗'}`
  );
  console.log(
    `  a real "highest since 1996" still extracts: ${okToaNarrow ? '✓' : '✗'}`
  );
  console.log(
    `  FAIL on real 07-10 KOSPI Overnight reuse: ${okFire ? '✓' : '✗'} (${fire.length} finding(s))`
  );
  console.log(
    `  SILENT on real 07-09 ("on Tuesday" dated): ${okSilentDated ? '✓' : '✗'} (${silentDated.length} finding(s))`
  );
  console.log(
    `  SILENT on real 07-07 (first occurrence): ${okSilentFirst ? '✓' : '✗'} (${silentFirst.length} finding(s))`
  );
  console.log(
    `  FAIL on real 07-10 story-fingerprint reuse: ${okFpFire ? '✓' : '✗'} (${fpFire.length} finding(s))`
  );
  console.log(
    `  FAIL includes Nikkei −2.1% companion: ${okFpNikkei ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT story-fp on dated 07-09: ${okFpSilentDated ? '✓' : '✗'} (${fpSilentDated.length} finding(s))`
  );
  console.log(
    `  SILENT story-fp on first-occurrence 07-07: ${okFpSilentFirst ? '✓' : '✗'} (${fpSilentFirst.length} finding(s))`
  );
  console.log(
    `  magnitude parses "4.91 percent": ${okMagWord ? '✓' : '✗'} (got ${magWord.mag}/${magWord.dir})`
  );
  console.log(
    `  magnitude parses "2.6%": ${okMagSym ? '✓' : '✗'} (got ${magSym.mag}/${magSym.dir})`
  );
  console.log(
    `  entity-bindings registry loads: ${okBindingsLoad ? '✓' : '✗'} (${bindings.length} binding(s))`
  );
  console.log(
    `  FAIL on real 07-11 draft "BlackRock's BCRED": ${okEaFire ? '✓' : '✗'} (${eaFire.length} finding(s))`
  );
  console.log(
    `  SILENT on real 07-11 PUBLISHED (corrected to Blackstone): ${okEaSilent ? '✓' : '✗'} (${eaSilent.length} finding(s))`
  );
  console.log(
    `  FAIL on the 07-10 JGB transposition (30Y given the 10Y's record): ${okJgbFire ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on the correctly-attributed JGB sentence: ${okJgbSilent ? '✓' : '✗'}`
  );
  console.log(
    `  FAIL on real 07-11 QG harmonize-to-published-record: ${okThFire ? '✓' : '✗'} (${thFire.length} finding(s))`
  );
  console.log(
    `  SILENT on real 07-10 QG log (no harmonization): ${okThSilent ? '✓' : '✗'} (${thSilent.length} finding(s))`
  );
  console.log(
    `  SILENT when harmonization cites a primary source: ${okThSourced ? '✓' : '✗'}`
  );
  console.log(
    `  SILENT on nominal compliance ("harmonization: none"): ${okThNominal ? '✓' : '✗'}`
  );
  console.log(
    `  FIRE when nominal compliance precedes a later confession on the same line: ${okThMixed ? '✓' : '✗'}`
  );
  console.log(
    `  DOWNGRADES to FLAG once the archive correction is logged (COR row): ${okThResolved ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] registry-integrity SILENT on a healthy registry: ${okRegOk ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] FAIL when the premise registry is MALFORMED (the 07-17 blind-gate case): ${okRegMalformed ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] FAIL when the premise registry is EMPTY: ${okRegEmpty ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] FAIL when the premise registry is MISSING: ${okRegMissing ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] an unusable binding row is REPORTED, not silently skipped: ${okRegBadRow ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-136] binding-schema: the 05:26 prose-shaped row (no key) is a NAMED badRow + registry FAIL: ${okSchemaMissingKey ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-136] binding-schema: blank correctRe/wrongRe are reported by FIELD NAME: ${okSchemaBlankRe ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-136] zero-width guard: a key matching empty TERMINATES (was an infinite loop): ${okZeroWidthTerminates ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-136] the REPAIRED aisi binding FIREs on "Anthropic, OpenAI and Meta are the three": ${okAisiFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-136] …and is SILENT on AISI's true finding (Mythos 5, 17 of 19): ${okAisiSilent ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-064] the REAL registries on disk are healthy right now: ${okRegRealHealthy ? '✓' : '✗'}`
  );

  // ── IMP-116: HEADLINE ANCHORS — the title numeral and the watch-line price ─────────────────
  const HA_BAD = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n**Sunday, August 2, 2026**\n\n### Ten Ships Through Hormuz\n\n*Hormuz got counted. Watch Sunday evening's Asian crude reopen against Friday's $84.67 WTI settle, because a gap of more than a few dollars is not the market pricing a war.*\n\n---\n\n# ▸ THE DASHBOARD\n\n### Equities\n\n*The S&P 500 rose 1.2% to 7,000.*\n`;
  const HA_CLEAN = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n**Sunday, August 2, 2026**\n\n### What Won't Reverse\n\n*Two inflation channels stack into the meeting. Watch the FOMC decision and Monday's oil open after the Jazan strike.*\n\n---\n\n# ▸ THE DASHBOARD\n\n### Equities\n\n*The S&P 500 rose 1.2% to 7,000.*\n`;
  const haBad = headlineAnchorClaims(HA_BAD, '2026-08-02');
  const okHaTitle = haBad.some(
    c => c.section === 'Daily Title' && /Ten/i.test(String(c.level))
  );
  const okHaWatch = haBad.some(
    c => /watch line/i.test(c.section) && String(c.level).includes('84.67')
  );
  const okHaCritical = haBad.every(
    c => c.tier === 'critical' && c.status === 'UNVERIFIED'
  );
  // SILENT on a title with no numeral and a watch line with no price (a bare calendar watch).
  const okHaClean = headlineAnchorClaims(HA_CLEAN, '2026-08-02').length === 0;
  // The date line is never mistaken for the title (older briefs used `## {weekday}, {month} {d}, {yyyy}`)
  // and neither is the Weekly's date-range heading (`## July 5-11, 2026`). A bare year is not a claim.
  const okHaDateline =
    headlineAnchorClaims(
      `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n## Saturday, June 20, 2026\n\nBody.\n\n# ▸ THE DASHBOARD\n`,
      '2026-08-05'
    ).length === 0;
  const okHaWeekRange =
    headlineAnchorClaims(
      `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n## July 5-11, 2026\n\nBody.\n\n# ▸ THE DASHBOARD\n`,
      '2026-08-05'
    ).length === 0;
  const okHaYear =
    headlineAnchorClaims(
      `# H\n\n### The 2026 Problem\n\n*No watch line here.*\n\n# ▸ THE DASHBOARD\n`,
      '2026-08-05'
    ).length === 0;
  // ENFORCEMENT EPOCH: the archive is read, never condemned. A pre-epoch brief and a WEEKLY (week id)
  // extract nothing, so re-running --require-resolved over history cannot red-fail it.
  const okHaEpoch = headlineAnchorClaims(HA_BAD, '2026-07-17').length === 0;
  const okHaWeekly = headlineAnchorClaims(HA_BAD, '2026-W31').length === 0;
  // ACCEPTANCE GATE, real artifact: the 08-02 v2's title "Ten" and the intro's $84.67 both extract.
  const v2_0802 = path.join(process.cwd(), 'daily-briefs/2026-08-02-v2.md');
  let okHaReal = true;
  if (fs.existsSync(v2_0802)) {
    const real = headlineAnchorClaims(
      stripComments(fs.readFileSync(v2_0802, 'utf8')),
      '2026-08-02'
    );
    okHaReal =
      real.some(
        c => c.section === 'Daily Title' && /^Ten$/i.test(String(c.level))
      ) && real.some(c => String(c.level).includes('84.67'));
  }
  // FALSE-POSITIVE DISCIPLINE: a bare calendar watch ("Watch August 7 to 10") stays off the rails.
  const okHaNoDate =
    headlineAnchorClaims(
      `# H\n\n### Pay Went Backwards\n\n*Watch August 7 to 10 for the memory tell.*\n\n# ▸ THE DASHBOARD\n`,
      '2026-08-05'
    ).filter(c => /watch line/i.test(c.section)).length === 0;

  // ── IMP-117: BYLINE PAIRINGS — outlet bound to a person is a checkable pairing ─────────────
  const byBad = bylineAttributionClaims(
    `# ▸ THE SIX\n\n## Markets & Macro\n\n**A scheduling story.** Bloomberg's Colby Smith reported Friday evening that Warsh is considering fewer meetings.\n`,
    '2026-08-02'
  );
  const okByFire =
    byBad.length === 1 &&
    byBad[0]!.tier === 'critical' &&
    /Colby Smith/.test(byBad[0]!.asset);
  const okBySilentOrg =
    bylineAttributionClaims(
      `Kpler's daily series shows ten crossings.`,
      '2026-08-05'
    ).length === 0;
  const okBySilentNoPossessive =
    bylineAttributionClaims(
      `Bloomberg puts the residual near $10 billion.`,
      '2026-08-05'
    ).length === 0;
  const okBySilentBarePerson =
    bylineAttributionClaims(
      `Jim Bianco supplied the tradable version.`,
      '2026-08-05'
    ).length === 0;
  const okByEpoch =
    bylineAttributionClaims(
      `Bloomberg's Colby Smith reported Friday evening.`,
      '2026-07-17'
    ).length === 0;
  // ACCEPTANCE GATE, real artifact: fires on the 08-02 v2's "Bloomberg's Colby Smith".
  let okByReal = true;
  if (fs.existsSync(v2_0802)) {
    okByReal = bylineAttributionClaims(
      stripComments(fs.readFileSync(v2_0802, 'utf8')),
      '2026-08-02'
    ).some(c => /Colby Smith/.test(c.asset));
  }

  // ── IMP-120: DERIVED ARITHMETIC — the price the bullet COMPUTES FROM ───────────────────────
  const DA_CC1 = `- **SpaceX floated the exchange ratio on its $60 billion purchase of Cursor, so the deal costs its own shareholders more every time the stock falls, and it has fallen about 45 percent.** At the June 16 closing high of $211.39 that was roughly 3.4 percent dilution. At Friday July 31's close of $123.54, under the $135 IPO price, the same money is about seventy percent more shares.\n`;
  const daCc1 = derivedArithmeticClaims(DA_CC1, '2026-08-03');
  const okDaFire =
    ['$211.39', '$123.54', '$135'].every(p => daCc1.some(c => c.level === p)) &&
    daCc1.every(c => c.tier === 'critical' && c.status === 'UNVERIFIED');
  // SILENT where a price is quoted but NOT framed as a price point the sentence computes from.
  const okDaSilentSettledAt =
    derivedArithmeticClaims(
      `The market's price on it is Brent, which settled at $87.93 on Friday after gaining roughly 24 percent in July.`,
      '2026-08-03'
    ).length === 0;
  const okDaSilentMagnitude =
    derivedArithmeticClaims(
      `The national debt is up $3.6 trillion in thirteen months, roughly $15 billion a day of new supply.`,
      '2026-08-03'
    ).length === 0;
  // "price of $60 billion" is a DEAL SIZE, not a price point — the magnitude unit disqualifies it.
  const okDaSilentDealSize =
    derivedArithmeticClaims(
      `Cursor changed hands at a price of $60 billion in all-stock consideration.`,
      '2026-08-03'
    ).length === 0;
  // ENFORCEMENT EPOCH: a pre-epoch brief and a WEEKLY extract nothing — the archive is read, not condemned.
  const okDaEpoch = derivedArithmeticClaims(DA_CC1, '2026-07-17').length === 0;
  const okDaWeekly = derivedArithmeticClaims(DA_CC1, '2026-W31').length === 0;
  // LEG (b), the OFFLINE half: $211.39 → $123.54 is 41.6%, printed as "about 45 percent" (3.4pp).
  const daInc = derivedPercentageInconsistencies(DA_CC1);
  const okDaPctFire =
    daInc.length === 1 &&
    daInc[0]!.pct === 45 &&
    Math.abs(daInc[0]!.best! - 41.56) < 0.1;
  // ...and the OTHER two percentages in the SAME failing bullet stay silent: "3.4 percent dilution"
  // is a ratio, not a price change (no change verb precedes it), and "seventy percent more shares"
  // reconciles at 71.1%. A detector that flags the whole bullet has learned nothing.
  const okDaPctNarrow = !daInc.some(x => x.pct === 3.4 || x.pct === 70);
  // CO-PRESENCE IS NOT DERIVATION. The first design keyed on ≥2 BARE prices and swept 31 false
  // positives across 16 of 40 briefs, this shape being the commonest. Framed-prices-only kills it.
  const okDaPctCoPresence =
    derivedPercentageInconsistencies(
      `- **Crude repriced.** Brent crude settled at $78.19, up 5.4 percent, and WTI at $73.52, up 4.4 percent, a sharp single-session repricing.\n`
    ).length === 0;
  // ACCEPTANCE GATE, real artifacts: fires on the 08-03 v2's C&C-1 and ONLY there; and the
  // PUBLISHED 08-03 (corrected to $225.64/$108.37 at the morning gate) no longer flags.
  const v2_0803 = path.join(process.cwd(), 'daily-briefs/2026-08-03-v2.md');
  let okDaReal = true,
    okDaRealScoped = true;
  if (fs.existsSync(v2_0803)) {
    const realBody = stripComments(fs.readFileSync(v2_0803, 'utf8'));
    const realClaims = derivedArithmeticClaims(realBody, '2026-08-03');
    okDaReal =
      realClaims.some(c => c.level === '$123.54') &&
      derivedPercentageFindings(realBody, '2026-08-03').length === 1;
    // SILENT on the two correct derivations the Critic named: M&M-2's $3.6tn/$15bn-a-day and
    // Geo-1's $87.93 / "roughly 24 percent in July".
    okDaRealScoped = !realClaims.some(c =>
      /87\.93|3\.6|15/.test(String(c.level))
    );
  }

  console.log(
    `  [IMP-120] FIRES on C&C-1's three framed prices ($211.39/$123.54/$135): ${okDaFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] SILENT on "settled at $87.93" (quoted, not computed from): ${okDaSilentSettledAt ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] SILENT on "$3.6 trillion … $15 billion a day" (magnitudes): ${okDaSilentMagnitude ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] SILENT on "a price of $60 billion" (deal size, not a price point): ${okDaSilentDealSize ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] EPOCH: pre-epoch brief and WEEKLY extract nothing: ${okDaEpoch && okDaWeekly ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] OFFLINE LEG fires on 41.6%-printed-as-45%: ${okDaPctFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] and stays SILENT on the same bullet's 3.4% dilution + 70% share count: ${okDaPctNarrow ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] CO-PRESENCE IS NOT DERIVATION — Brent/WTI two-price two-percent bullet silent: ${okDaPctCoPresence ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] REAL 08-03 v2: $123.54 rides the critical rails, exactly 1 pct flag: ${okDaReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-120] REAL 08-03 v2: M&M-2 and Geo-1's correct figures stay off the rails: ${okDaRealScoped ? '✓' : '✗'}`
  );

  console.log(
    `  [IMP-116] FIRES on the title numeral "Ten": ${okHaTitle ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] FIRES on the watch-line anchor $84.67: ${okHaWatch ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] headline anchors ride the CRITICAL rails: ${okHaCritical ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] SILENT on a numberless title + a priceless watch line: ${okHaClean ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] the date line is never read as the title: ${okHaDateline ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] the Weekly's "July 5-11, 2026" range heading is not a title: ${okHaWeekRange ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] a bare YEAR in a title is not a claim ("The 2026 Problem"): ${okHaYear ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] EPOCH: a pre-2026-08-02 brief extracts nothing (the archive is read, not condemned): ${okHaEpoch ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] EPOCH: a WEEKLY (week id) extracts nothing: ${okHaWeekly ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] EPOCH: a pre-epoch brief extracts no byline claim: ${okByEpoch ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] SILENT on a bare calendar watch ("August 7 to 10"): ${okHaNoDate ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-116] REAL 08-02 v2: title "Ten" AND intro $84.67 both extract: ${okHaReal ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] FIRES on "Bloomberg's Colby Smith" (outlet+person pairing): ${okByFire ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] SILENT on "Kpler's daily series" (organisation, no person): ${okBySilentOrg ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] SILENT on "Bloomberg puts the residual…" (outlet, no possessive): ${okBySilentNoPossessive ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] SILENT on "Jim Bianco" (person, no outlet): ${okBySilentBarePerson ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-117] REAL 08-02 v2: fires on the Colby Smith pairing: ${okByReal ? '✓' : '✗'}`
  );

  console.log(
    `  [IMP-165] FIRE on the REAL 2026-08-12-v2.md C&C-1 attributed superlative: ${okAttrRealFire ? '✓' : '✗'} (${attrReal.length} claim(s))`
  );
  console.log(
    `  [IMP-165] …and the DRAFT's "the only" FAILS hedge-deleted against the same truth row the PUBLISHED file passes: ${okAttrRealUnresolved ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] FIRE: HEDGE-DELETED — "the only" against a source that said "one of the world's only": ${okAttrHedge ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165/151] FIRE: SCOPE-ADDED — "first new AMERICAN iron mine" against "in Minnesota": ${okAttrScope ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] SILENT when the brief keeps the source's hedge: ${okAttrSilentFaithful ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165/151] SILENT on an UNATTRIBUTED superlative (Geo-1 / CSIS): ${okAttrSilentUnattributed ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165/151] SILENT on an ARGUMENT containing "the only" (the Take's venture-timeline line): ${okAttrSilentArgument ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] FIRE on the REAL 2026-08-13-v2.md C&C-2 issuer-causal claim (151% volume for the issuer's 25% circulation): ${okIssuerFireCircle ? '✓' : '✗'} (${issuer13.length} row(s))`
  );
  console.log(
    `  [IMP-166] ...and UNRESOLVED against the real 2026-08-13-truth.json (the gap: 11 rows, none for C&C): ${okIssuerUnresolved ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] FIRE on the 2026-08-12 AI&T-1 conditional inference on a GUIDED range: ${okIssuerFireCoreWeave ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] SILENT on the 08-13 Wild Card Timema study (IMP-143 owns it; a duplicate row is a storm): ${okIssuerSilentTimema ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] SILENT on the 08-13 Geopolitics section (reporting figures, no issuer): ${okIssuerSilentGeo ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] SILENT on a named STUDY with a causal verb and a metric-shaped noun: ${okIssuerSilentStudy ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-166] NO STORM across the real 08-04..08-13 window, date gate lifted (<=2/brief): ${okIssuerNoStorm ? '✓' : '✗'} (rates ${issuerRates.join('/')})`
  );
  console.log(
    `  [IMP-166] NO RETRO — silent on a pre-2026-08-12 date: ${okIssuerNoRetro ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] SILENT on tonight's Discovery and Signal-2, the mandate's two clean negatives: ${okAttrSilentCleanSections ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] SILENT on the REAL published 2026-08-12 ("Teledyne has NEVER built" is not the scope noun "ever"): ${okAttrNoNeverFp ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] NO STORM: max ${attrRates.length ? Math.max(...attrRates) : 0} claim(s)/brief across the real 08-09…08-12 v2 window: ${okAttrNoStorm ? '✓' : '✗'}`
  );
  console.log(
    `  [IMP-165] NO RETRO: silent on a pre-2026-08-12 brief date (IMP-125's rule): ${okAttrNoRetro ? '✓' : '✗'}`
  );
  // ── IMP-193 (2026-08-18 Critic mandate #2, RC2): DERIVED-FIGURE CONTRADICTION, both directions
  // on real artifacts. FIRE = the night the derivation shipped and the published rival was deleted.
  // SILENT = eight further nights, plus the two cases the mandate explicitly protects: C&C-2's
  // $1.8B/$30B → "roughly six cents" (a derivation contradicting nothing) and AI&T-1's "$2 trillion"
  // (a SELECTION between two sourced estimates, recorded in the intel packet — which this check
  // never reads, by design). "The gate must not punish the one place tonight where this judgment
  // was made correctly."
  const dfcOn = (d: string) => {
    const p = path.join(root, `daily-briefs/${d}-v2.md`);
    if (!fs.existsSync(p)) return null;
    return derivedFigureContradictionFindings(
      fs.readFileSync(p, 'utf8'),
      loadPredrafts(p, d)
    );
  };
  const dfc18 = dfcOn('2026-08-18');
  const okDfcFire =
    dfc18 !== null &&
    dfc18.length === 1 &&
    /\$55,000/.test(dfc18[0]!.message) &&
    /\$47,900|\$48,000/.test(dfc18[0]!.message);
  console.log(
    `  [IMP-193] FIRES on REAL 08-18 C&C-1 (derived ~$48k from 12.9% x a NET ASP, said it contradicted the widely-printed $55k/home, omitted the $55k, and the $48k led a top slot at gate exit 0): ${okDfcFire ? '✓' : '✗'}${dfc18 && !okDfcFire ? ` (got ${dfc18.length})` : ''}`
  );
  const dfcNoisy: string[] = [];
  for (const d of [
    '2026-08-17',
    '2026-08-16',
    '2026-08-15',
    '2026-08-14',
    '2026-08-13',
    '2026-08-12',
    '2026-08-11',
    '2026-08-10',
  ]) {
    const r = dfcOn(d);
    if (r && r.length) dfcNoisy.push(`${d}:${r.length}`);
  }
  const okDfcNoStorm = dfcNoisy.length === 0;
  console.log(
    `  [IMP-193] NO STORM: silent across eight healthy nights — a derivation marker alone is ubiquitous in pre-draft rung notes (08-15 paired Riot's $49,912 cost-to-mine against its $18,964 basis and $40,719 NOI); the DECLARED conflict is what makes it a defect: ${okDfcNoStorm ? '✓' : '✗'}${dfcNoisy.length ? ` (got ${dfcNoisy.join(', ')})` : ''}`
  );

  // ── IMP-196 — DASHBOARD LEVEL RECENCY, both directions on the real files ─────────────────────
  // The mandate named its own receipts, so they are the fixtures: the v2 that shipped the false
  // sentence must FIRE, the corrected published copy must be SILENT, and eight healthy nights
  // must stay quiet. The middle case is the one that matters most — it proves the check keys on
  // STALENESS and not merely on the presence of a Treasury level, which the 5-day blackout would
  // otherwise have made indistinguishable.
  const dlsOn = (p: string, d: string): Finding[] => {
    const f = path.join(root, p);
    return fs.existsSync(f)
      ? dashboardLevelStalenessFindings(fs.readFileSync(f, 'utf8'), f, d)
      : [];
  };
  const dls19v2 = dlsOn('daily-briefs/2026-08-19-v2.md', '2026-08-19');
  const okDlsFire =
    dls19v2.length === 1 &&
    /thirty-year Treasury yield/.test(dls19v2[0]!.message) &&
    /5\.31/.test(dls19v2[0]!.message) &&
    /"held"/.test(dls19v2[0]!.message);
  console.log(
    `  [IMP-196] FIRES on REAL 08-19 v2 (Dashboard printed MONDAY's 5.31 as Tuesday's under "held", while Tuesday made a new 19-year high at 5.33 and closed DOWN >2bp — the day's conclusion was built on the inverted move): ${okDlsFire ? '✓' : '✗'}${dls19v2.length !== 1 ? ` (got ${dls19v2.length})` : ''}`
  );
  const dls19pub = dlsOn('content/daily-updates/2026-08-19.md', '2026-08-19');
  const okDlsSilent = dls19pub.length === 0;
  console.log(
    `  [IMP-196] SILENT on the CORRECTED published 08-19 (same instrument, same slot, level now 5.33 and verb "topped" — keys on staleness, not on the presence of a Treasury level): ${okDlsSilent ? '✓' : '✗'}${dls19pub.length ? ` (got ${dls19pub.length})` : ''}`
  );
  const dlsNoisy: string[] = [];
  for (const d of [
    '2026-08-18',
    '2026-08-17',
    '2026-08-15',
    '2026-08-14',
    '2026-08-13',
    '2026-08-12',
    '2026-08-11',
    '2026-08-10',
  ]) {
    const r = dlsOn(`content/daily-updates/${d}.md`, d);
    if (r.length) dlsNoisy.push(`${d}:${r.length}`);
  }
  const okDlsNoStorm = dlsNoisy.length === 0;
  console.log(
    `  [IMP-196] NO STORM: silent across eight healthy nights — the precision floor (a decimal, or 4+ significant digits) is what buys this, since rounded crude handles like "$84"/"$91" legitimately repeat across days and firing on them would make the gate a flag generator on its first live night: ${okDlsNoStorm ? '✓' : '✗'}${dlsNoisy.length ? ` (got ${dlsNoisy.join(', ')})` : ''}`
  );

  // ── IMP-205 (08-21 Critic mandate #3, RC2): OBSERVATION KIND ─────────────────────────────────
  // Four cases, two directions, all on tonight's real bytes, exactly as the mandate specified.
  const ok0821v2 = path.join(process.cwd(), 'daily-briefs/2026-08-21-v2.md');
  const okBody0821 = fs.existsSync(ok0821v2)
    ? fs.readFileSync(ok0821v2, 'utf8')
    : '';
  const okFindings = okBody0821
    ? checkObservationKind(okBody0821, null, '2026-08-21', true)
    : [];
  // FIRE — the Crypto entry: two `opened` verbs, a possessive `Wednesday's open`, and a
  // `Wednesday close` for an asset that has none.
  const okObsFire =
    okFindings.length === 1 &&
    okFindings[0]!.severity === 'FAIL' &&
    /"Crypto"/.test(okFindings[0]!.message);
  console.log(
    `  [IMP-205] FIRES on the 08-21 Dashboard Crypto entry — a session verb bound to a 24/7 instrument: ${okObsFire ? '✓' : '✗'} (${okFindings.length} finding(s))`
  );
  // And it must name EVERY session verb, not the first — the Editor cannot fix a quarter of a
  // sentence it was only told a quarter about.
  const okObsAllVerbs =
    okFindings.length === 1 &&
    /Wednesday close/.test(okFindings[0]!.message) &&
    /opened/.test(okFindings[0]!.message) &&
    /Wednesday's open/.test(okFindings[0]!.message);
  console.log(
    `  [IMP-205] and it names all three session verbs [Wednesday close · opened · Wednesday's open]: ${okObsAllVerbs ? '✓' : '✗'}`
  );
  // SILENT — Equities (four correct closes) and Commodities & Rates (two settles, "settled"), on
  // the SAME PAGE as the defect. These are the only silence tests that mean anything: the
  // Dashboard demonstrably knows how to do this, twice, on the page where it got it wrong.
  const okObsSilentSamePage =
    okFindings.filter(f => /"Equities"|"Commodities/.test(f.message)).length ===
    0;
  console.log(
    `  [IMP-205] SILENT on the same page's Equities (4 closes) and Commodities & Rates (2 settles): ${okObsSilentSamePage ? '✓' : '✗'}`
  );
  // SILENT — the published 2026-08-19 Dashboard, whose crude handles are settle-shaped and whose
  // crypto entry says "traded near $64,170 … on the session".
  const p0819 = path.join(process.cwd(), 'content/daily-updates/2026-08-19.md');
  const okObsSilent0819 = fs.existsSync(p0819)
    ? checkObservationKind(
        fs.readFileSync(p0819, 'utf8'),
        null,
        '2026-08-21',
        true
      ).length === 0
    : false;
  console.log(
    `  [IMP-205] SILENT on the published 2026-08-19 Dashboard, judged IN FORCE (not merely exempt): ${okObsSilent0819 ? '✓' : '✗'}`
  );
  // NO-STORM / TRUE-POSITIVE PIN — every published brief, judged in force. This leg was rebuilt
  // three times against the archive and each rebuild is recorded in the header comment; the final
  // shape is a PINNED SET rather than a zero, because the archive genuinely contains this defect and
  // a gate asserting zero here would be asserting something false.
  //
  // THE FINDING THAT CAME OUT OF IT: E-DASHBOARD-INFERENCE-01 is not three nights old. Six earlier
  // published Dashboards carry the same category error — "BTC CLOSED at $67,468 Tuesday" (06-03),
  // "BTC OPENED at $63,310 Monday" (06-09), "Bitcoin SETTLED near $64,200" (07-19), "Ether carried a
  // $1,880 valuation into SUNDAY'S CLOSE" (08-04), and on 08-07 a sentence all but byte-identical to
  // 08-21's: "Ether OPENED at $1,906.96, up 2.1 percent against WEDNESDAY'S OPEN". Seven occurrences
  // clears the PROXY DISCIPLINE's recurring-class bar (≥2) with room to spare.
  //
  // The set is pinned EXACTLY: a new date appearing here is a false friend to diagnose, and a date
  // disappearing means the gate stopped seeing a defect it used to catch. Either way it reds.
  const OBS_KNOWN_TRUE_POSITIVES = [
    '2026-06-01',
    '2026-06-03',
    '2026-06-09',
    '2026-07-19',
    '2026-08-04',
    '2026-08-07',
  ];
  const obsHits: string[] = [];
  for (const f of fs
    .readdirSync(path.join(process.cwd(), 'content/daily-updates'))
    .filter(x => /^2026-\d\d-\d\d\.md$/.test(x))
    .filter(x => x.slice(0, 10) !== '2026-08-21')) {
    const b = fs.readFileSync(
      path.join(process.cwd(), 'content/daily-updates', f),
      'utf8'
    );
    if (checkObservationKind(b, null, '2026-08-21', true).length)
      obsHits.push(f.slice(0, 10));
  }
  const obsUnexpected = obsHits.filter(
    d => !OBS_KNOWN_TRUE_POSITIVES.includes(d)
  );
  const obsMissing = OBS_KNOWN_TRUE_POSITIVES.filter(d => !obsHits.includes(d));
  const okObsNoStorm = obsUnexpected.length === 0 && obsMissing.length === 0;
  console.log(
    `  [IMP-205] NO STORM / TRUE-POSITIVE PIN: the archive fires on exactly the 6 known real instances of this defect and nothing else: ${okObsNoStorm ? '✓' : '✗'}${obsUnexpected.length ? ` (UNEXPECTED: ${obsUnexpected.join(', ')})` : ''}${obsMissing.length ? ` (STOPPED CATCHING: ${obsMissing.join(', ')})` : ''}`
  );
  // NO-RETRO — IMP-125: the rule binds from 2026-08-21 forward, and the boundary is a real switch,
  // proven on the SAME BYTES read both ways.
  const okObsNoRetro =
    okBody0821 !== '' &&
    checkObservationKind(okBody0821, null, '2026-08-20', true).length === 0 &&
    checkObservationKind(okBody0821, null, '2026-08-21', true).length === 1;
  console.log(
    `  [IMP-205] NO RETRO: the same 08-21 bytes are EXEMPT judged as 08-20 and FIRE judged as 08-21: ${okObsNoRetro ? '✓' : '✗'}`
  );
  // The registry is load-bearing, not decorative — the mandate names entity-bindings.json as the
  // home for the continuously-traded flag, so prove the gate actually reads it.
  const okObsRegistry = (() => {
    try {
      const j = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'system/entity-bindings.json'),
          'utf8'
        )
      );
      return (
        Array.isArray(j?.continuouslyTraded) &&
        j.continuouslyTraded.length >= 2 &&
        j.continuouslyTraded.some((r: any) => /bitcoin/i.test(String(r?.id)))
      );
    } catch {
      return false;
    }
  })();
  console.log(
    `  [IMP-205] the continuously-traded roster is READ FROM system/entity-bindings.json, not hardcoded: ${okObsRegistry ? '✓' : '✗'}`
  );

  // ── IMP-213 (08-23 Critic mandate #1, RC2): SESSION CALENDAR ─────────────────────────────────
  // Both directions, exactly the cases the mandate specified. The SILENT cases are INLINE FIXTURES
  // rather than directory sweeps (Ledger rule 9: a selftest assertion is world-state-independent),
  // and each of the two Dashboard silences is proved to be a JUDGEMENT rather than a skip — the
  // same bytes with one weekday changed must FIRE. A gate that is quiet because it never looked is
  // indistinguishable from a gate that is quiet because the sentence was right, and only the second
  // one is worth shipping.
  //
  // FALSE-POSITIVE MEASUREMENT (run once, 2026-08-23, NOT pinned as an assertion because the
  // directories grow nightly): 300 published files and 360 drafts judged with the date shield off →
  // exactly ONE hit, tonight's real defect. The single false positive that measurement DID surface
  // is recorded in the leg's own comment (2026-03-13's "since August 2022", read as "August 2" by a
  // truncated window) and is pinned below as a permanent regression test.
  const scOn = (text: string, d = '2026-08-23', rr = true) =>
    checkObservationKind(text, null, d, rr).filter(
      f => f.check === 'session-calendar'
    );
  // FIRE — the mandate's receipt, on the night's REAL bytes, whole file.
  const scCalRealPath = path.join(root, 'daily-briefs/2026-08-23-v1.5.md');
  const scCalReal = fs.existsSync(scCalRealPath)
    ? scOn(fs.readFileSync(scCalRealPath, 'utf8'))
    : [];
  const okScRealFire =
    scCalReal.length === 1 &&
    scCalReal[0]!.severity === 'FAIL' &&
    /Saturday/.test(scCalReal[0]!.message) &&
    /Gold futures closed Saturday/.test(scCalReal[0]!.message);
  console.log(
    `  [IMP-213] FIRES on the REAL 2026-08-23 v1.5 Dashboard/Commodities — "Gold futures closed Saturday's session at $4,680.60" on a Sunday brief, and ONCE on the whole file: ${okScRealFire ? '✓' : '✗'}${scCalReal.length !== 1 ? ` (got ${scCalReal.length})` : ''}`
  );
  // The same sentence as an inline fixture, so this receipt outlives the draft file.
  const SC_GOLD =
    "*Gold futures closed Saturday's session at $4,680.60, up 2.39 percent.*";
  const scGold = scOn(SC_GOLD);
  const okScGold =
    scGold.length === 1 &&
    /"closed" is bound to a session-traded instrument/.test(
      scGold[0]!.message
    ) &&
    /which is a Saturday/.test(scGold[0]!.message);
  console.log(
    `  [IMP-213] …and on the sentence alone as a frozen fixture, naming both the verb binding and the day: ${okScGold ? '✓' : '✗'}`
  );
  // SILENT — the same page's Equities. Friday is a session; the venue was open.
  const SC_SPX =
    '*The S&P 500 gained 0.4 percent on Friday to 7,674.37 and still closed the week down 1.4 percent, with the VIX finishing at 15.13 after a 5.5 percent drop.*';
  // SILENT — the same page's rates clause. "ended Friday" IS a session verb here and IS judged.
  const SC_FFR =
    '*Fed funds futures ended Friday putting the odds of a September rate hike above 40 percent.*';
  const okScSilentSamePage =
    scOn(SC_SPX).length === 0 && scOn(SC_FFR).length === 0;
  console.log(
    `  [IMP-213] SILENT on the same page's two CORRECT session verbs — "gained 0.4 percent on Friday … closed the week" and "fed funds futures ended Friday": ${okScSilentSamePage ? '✓' : '✗'}`
  );
  // …AND THE SILENCE IS A JUDGEMENT, NOT A SKIP. One weekday changed, nothing else.
  const SC_SPX_SUN = SC_SPX.replace('on Friday', 'on Sunday');
  const SC_FFR_SUN = SC_FFR.replace('ended Friday', 'ended Sunday');
  const okScSwap =
    SC_SPX_SUN !== SC_SPX &&
    SC_FFR_SUN !== SC_FFR &&
    scOn(SC_SPX_SUN).length === 1 &&
    scOn(SC_FFR_SUN).length === 1;
  console.log(
    `  [IMP-213] …and that silence is a JUDGEMENT, not a skip: the same two sentences with Friday->Sunday and nothing else changed both FIRE: ${okScSwap ? '✓' : '✗'}`
  );
  // SILENT — the Crypto entry, which names no session at all, and the harder case: a 24/7
  // instrument GIVEN a Saturday session is IMP-205's row, not this one. The mirror sentence with a
  // session-traded metal in the same slot must fire, or the exclusion is just a dead branch.
  const SC_CRYPTO =
    '*Bitcoin ran to roughly $79,500 before dawn on Saturday, gave back about $3,000 in six minutes, and was trading $78,352 by late afternoon in New York, up 3.9 percent over the trailing 24 hours.*';
  const SC_BTC_SESSION =
    "*With gold at $4,661.60, bitcoin closed Saturday's session at $78,352, up 3.9 percent.*";
  const SC_SILVER_SESSION = SC_BTC_SESSION.replace('bitcoin', 'silver');
  const okScCrypto =
    scOn(SC_CRYPTO).length === 0 &&
    scOn(SC_BTC_SESSION).length === 0 &&
    scOn(SC_SILVER_SESSION).length === 1;
  console.log(
    `  [IMP-213] SILENT on the Dashboard Crypto entry AND on a 24/7 asset handed a Saturday session (IMP-205's row, read from the same registry) — while the identical sentence with silver FIRES: ${okScCrypto ? '✓' : '✗'}`
  );
  // SILENT — the four non-market uses of "closed" on the very page that carried the defect, plus
  // the Inner Game application line. Verbatim bytes from 2026-08-23-v1.5.md.
  const SC_NON_MARKET = [
    'The median Bloomberg analyst forecast as of 18 August has Brent below $76 a barrel by year-end, from above $91 now, a fall of roughly 17 percent with the Strait of Hormuz still effectively closed.',
    'Neither country closed the Strait of Hormuz.',
    'The second person is doing what the anthropologist Claude Lévi-Strauss called bricolage: building from a closed and heterogeneous set of things that happen to be at hand, rather than from an open set specified by the project.',
    'It is the closed set staying closed after the world has opened it.',
    '*Application: before you solve anything, ask whether your inventory is closed by the world or closed by you.*',
  ];
  const scNonMarketHits = SC_NON_MARKET.filter(t => scOn(t).length > 0);
  const okScNonMarket = scNonMarketHits.length === 0;
  console.log(
    `  [IMP-213] SILENT on all ${SC_NON_MARKET.length} non-market uses of "closed" on the same page (M&M-2's Hormuz clause names Brent AND "18 August" in one sentence — both outside their binding windows): ${okScNonMarket ? '✓' : '✗'}${scNonMarketHits.length ? ` (got ${scNonMarketHits.length})` : ''}`
  );
  // SILENT — ordinary corporate/physical English, where a session-traded token IS bound to the verb
  // and only the direct object separates a venue from a firm.
  const SC_OBJECTS = [
    'Gold Fields closed the acquisition on Saturday for $4.68 billion.',
    'The plant closed Saturday after a $40 million write-down.',
    "Gold's discount to spot closed the gap on Saturday, worth $19.00 an ounce.",
    'Gold Fields closed the investigation on Saturday, six months and $4 million later.',
  ];
  const okScObjects = SC_OBJECTS.every(t => scOn(t).length === 0);
  console.log(
    `  [IMP-213] SILENT on "closed the deal / the plant closed / closed the gap / closed the investigation" — the direct object is what separates a firm from a venue: ${okScObjects ? '✓' : '✗'}`
  );
  // EXPLICIT DATES resolve against the brief's own date — the only place this leg does arithmetic.
  const okScExplicit =
    scOn('*Gold futures settled at $4,680.60 on 22 August, up 2.39 percent.*')
      .length === 1 &&
    scOn('*Gold futures settled at $4,661.60 on 21 August, up 1.97 percent.*')
      .length === 0;
  console.log(
    `  [IMP-213] EXPLICIT DATES resolve against BRIEF_DATE: "on 22 August" (a Saturday) FIRES and "on 21 August" (the Friday that actually settled $4,661.60) is SILENT: ${okScExplicit ? '✓' : '✗'}`
  );
  // REGRESSION PIN — the one false positive the 660-file calibration produced, kept forever.
  const okScHistorical =
    scOn(
      "- **Brent closed above $100 for the first time since August 2022 — and the IEA's historic 400M barrel reserve release did nothing.**"
    ).length === 0 &&
    scOn(
      '*If gold closes above $4,700 on Saturday it confirms the breakout at $4,680.60.*'
    ).length === 0;
  console.log(
    `  [IMP-213] REGRESSION PIN: SILENT on 2026-03-13's "for the first time since August 2022" (the build that windowed the string before matching read it as "August 2", a Sunday) and on forward chart talk ("if gold closes above"): ${okScHistorical ? '✓' : '✗'}`
  );
  // NO RETRO (IMP-125) — the boundary is a real switch, proven on the SAME BYTES read both ways.
  const okScCalNoRetro =
    scOn(SC_GOLD, '2026-08-22').length === 0 &&
    scOn(SC_GOLD, '2026-08-23').length === 1;
  console.log(
    `  [IMP-213] NO RETRO: the same bytes are EXEMPT judged as 08-22 and FIRE judged as 08-23: ${okScCalNoRetro ? '✓' : '✗'}`
  );
  // The severity contract, matching IMP-205: advisory in the evening, blocking at the Truth Gate.
  const okScSeverity =
    scOn(SC_GOLD, '2026-08-23', false)[0]?.severity === 'FLAG' &&
    scOn(SC_GOLD, '2026-08-23', true)[0]?.severity === 'FAIL';
  console.log(
    `  [IMP-213] SEVERITY: FLAG in the evening (the brief ships), FAIL under --require-resolved (a session that does not exist never reaches a reader): ${okScSeverity ? '✓' : '✗'}`
  );

  // ── IMP-215 (08-24 Critic mandate #1, RC2): THE REGULATORY-VACUUM LEG ────────────────────────
  // Both directions, on the night's REAL bytes wherever a real example exists — the FIRE case is
  // the published file and the draft, not a fixture, and the three SILENT cases are verbatim
  // sentences lifted from the SAME brief. The mandate is explicit about why the silences carry as
  // much weight as the fire: "a gate that fires on Geo-1, the brief's best bullet, is a gate the
  // Writer routes around." Each silence is therefore proved to be a JUDGEMENT — the same sentence
  // rewritten into the exemption shape must FIRE — and the repair case proves THE FIX IS NEVER
  // PUNISHED, which is the property that decides whether a Writer fixes the bullet or deletes it.
  const rvOn = (
    text: string,
    truth: any = null,
    d: string | null = '2026-08-24',
    rr = true
  ) => regulatoryVacuumLeg(text, truth, d, rr);

  // 1. FIRE on the real AI&T-2 bytes — exemption clause bound to a consequence verb, no row.
  const rvPubPath = path.join(root, 'content/daily-updates/2026-08-24.md');
  const rvDraftPath = path.join(root, 'daily-briefs/2026-08-24-v1.5.md');
  const rvPub = fs.existsSync(rvPubPath)
    ? fs.readFileSync(rvPubPath, 'utf8')
    : '';
  const rvDraft = fs.existsSync(rvDraftPath)
    ? fs.readFileSync(rvDraftPath, 'utf8')
    : '';
  const rvPubHits = rvOn(rvPub);
  const rvDraftHits = rvOn(rvDraft);
  const okRvRealFire =
    rvPubHits.length === 1 &&
    rvDraftHits.length === 1 &&
    rvPubHits[0]!.severity === 'FAIL' &&
    /regulator-successor:federal-trade-commission/.test(
      rvPubHits[0]!.message
    ) &&
    /"because" \+ "is why"/.test(rvPubHits[0]!.message) &&
    /airlines are exempt from Federal Trade Commission/.test(
      rvPubHits[0]!.message
    );
  console.log(
    `  [IMP-215] FIRES on the REAL 2026-08-24 AI&T-2 — "airlines are exempt from Federal Trade Commission oversight … That exemption is why" — in BOTH the published file and v1.5, ONCE each, naming the missing regulator-successor:federal-trade-commission row: ${okRvRealFire ? '✓' : '✗'}${rvPubHits.length !== 1 || rvDraftHits.length !== 1 ? ` (published ${rvPubHits.length}, v1.5 ${rvDraftHits.length})` : ''}`
  );

  // 2. THE FIX IS NEVER PUNISHED. Same bytes, one truth row added naming the successor.
  const RV_TRUTH_DOT = {
    claims: {
      'regulator-successor:federal-trade-commission': {
        resolved: true,
        successor:
          'US Department of Transportation — 49 U.S.C. § 41712 grants DOT EXCLUSIVE authority to prohibit unfair or deceptive practices of air carriers; interpretive rules at 14 CFR Part 399.',
        source: '49 U.S.C. § 41712 + 14 CFR Part 399, read 2026-08-24',
      },
    },
  };
  const RV_TRUTH_NONE = {
    claims: {
      'regulator-successor:federal-trade-commission': {
        resolved: true,
        successor:
          'No successor authority exists at the federal level; the practice is regulated by no one.',
        source: 'checked 2026-08-24',
      },
    },
  };
  // …and a BARE `resolved:true` is a promise, not a receipt: it must still fire. So must a row
  // that answers with a word rather than an authority — "unclear" is not a successor.
  const RV_TRUTH_BARE = {
    claims: {
      'regulator-successor:federal-trade-commission': { resolved: true },
    },
  };
  const RV_TRUTH_EMPTY_WORD = {
    claims: {
      'regulator-successor:federal-trade-commission': {
        resolved: true,
        successor: 'unclear',
        source: 'checked 2026-08-24',
      },
    },
  };
  const rvBareHits = rvOn(rvPub, RV_TRUTH_BARE);
  const rvWordHits = rvOn(rvPub, RV_TRUTH_EMPTY_WORD);
  const okRvFixNotPunished =
    rvOn(rvPub, RV_TRUTH_DOT).length === 0 &&
    rvOn(rvDraft, RV_TRUTH_DOT).length === 0 &&
    rvOn(rvPub, RV_TRUTH_NONE).length === 0 &&
    rvBareHits.length === 1 &&
    /the row names no successor/.test(rvBareHits[0]!.message) &&
    /the row names no source consulted/.test(rvBareHits[0]!.message) &&
    rvWordHits.length === 1 &&
    /neither names an authority nor states in words that none exists/.test(
      rvWordHits[0]!.message
    );
  console.log(
    `  [IMP-215] SILENT on the SAME BYTES once a regulator-successor: row NAMES DOT (and equally when it states IN WORDS that none exists) — THE FIX IS NEVER PUNISHED — while a bare resolved:true, and a row answering "unclear", both still FIRE: ${okRvFixNotPunished ? '✓' : '✗'}`
  );

  // 3–5. THE THREE SILENCES, verbatim from the same brief. None carries an exemption predicate
  // bound to a named authority, and each is a different reason why not.
  const RV_SIGNAL2 =
    'Regulation (EU) 2024/573, in force since 11 March 2024, bars F-gases in new switchgear at 24 kV and below from 2026 and works up the voltage classes until it reaches the high-voltage fleet in 2032. Equipment already installed may keep running, but only while it stays where it is and stays the size it is. Move it or expand it and it counts as new.';
  const RV_GEO1 =
    '- **A British power station was reportedly shut down for four days by hackers linked to Iran, and the government’s own defence is the most revealing sentence in the story: the plant was too small to be legally required to tell anyone.** What is not in doubt is the official explanation, from an unnamed government source: "We have thresholds for important generators to legally notify us of cyber activity, and this site is nowhere near." The reporting threshold is the attack surface. An adversary optimising for maximum signal and minimum escalation aims at exactly the rung your statute declined to count, which is why escalation ladders built from legal categories keep missing the step that gets taken.';
  const RV_CC3 =
    'That is the Live Nation and Ticketmaster structure, blessed by the Justice Department in a 2010 consent decree and sued by that same department in May 2024 to break it apart. Mari is building the identical shape from the other end while the precedent sits in front of a judge.';
  const okRvSilentGrandfather = rvOn(RV_SIGNAL2).length === 0;
  console.log(
    `  [IMP-215] SILENT on Signal-2's "Equipment already installed may keep running, but only while it stays where it is" — GRANDFATHERING under Regulation (EU) 2024/573, the same regulator still holding, so no successor question arises: ${okRvSilentGrandfather ? '✓' : '✗'}`
  );
  const okRvSilentGeo = rvOn(RV_GEO1).length === 0;
  console.log(
    `  [IMP-215] SILENT on Geo-1's "the plant was too small to be legally required to tell anyone" — a REPORTING THRESHOLD inside a statute that plainly still applies; a gate that fired on the brief's best bullet is a gate the Writer routes around: ${okRvSilentGeo ? '✓' : '✗'}`
  );
  const okRvSilentPresent = rvOn(RV_CC3).length === 0;
  console.log(
    `  [IMP-215] SILENT on C&C-3's "blessed by the Justice Department in a 2010 consent decree" — names the regulator as PRESENT, so there is no absence to succeed to: ${okRvSilentPresent ? '✓' : '✗'}`
  );

  // …AND ALL THREE SILENCES ARE JUDGEMENTS, NOT SKIPS. Rewritten into the exemption shape — one
  // clause changed in each, everything else identical — every one of them FIRES.
  const RV_SIGNAL2_SWAP = RV_SIGNAL2.replace(
    'Equipment already installed may keep running',
    'Equipment already installed is exempt from the European Chemicals Agency, which is why it may keep running'
  );
  const RV_GEO1_SWAP = RV_GEO1.replace(
    'too small to be legally required to tell anyone',
    'outside the jurisdiction of the National Cyber Security Centre, which is the reason it was not legally required to tell anyone'
  );
  const RV_CC3_SWAP = RV_CC3.replace(
    'blessed by the Justice Department in a 2010 consent decree',
    'not subject to the Justice Department, which is why the 2010 consent decree bound nobody'
  );
  const okRvSwap =
    RV_SIGNAL2_SWAP !== RV_SIGNAL2 &&
    RV_GEO1_SWAP !== RV_GEO1 &&
    RV_CC3_SWAP !== RV_CC3 &&
    rvOn(RV_SIGNAL2_SWAP).length === 1 &&
    rvOn(RV_GEO1_SWAP).length === 1 &&
    rvOn(RV_CC3_SWAP).length === 1;
  console.log(
    `  [IMP-215] …and those three silences are JUDGEMENTS, not skips: each sentence rewritten into the «exempt from / outside the jurisdiction of / not subject to [named authority]» shape, one clause changed, FIRES: ${okRvSwap ? '✓' : '✗'}`
  );

  // THE ADJACENCY BUDGET. Every loose form in the real archive is innocent, and the leg's entire
  // false-positive control is that the predicate must bind IMMEDIATELY to a named authority.
  const RV_LOOSE = [
    // 07-25: a militia and a shipping lane, not a regulator.
    'The Houthis are selectively exempting Chinese-flagged vessels from their blockade of Bab al-Mandeb, which is why non-exempt ships pay roughly $1 million to reroute around the Cape.',
    // 08-07: names no authority at all.
    'Chan’s own record supports him: the drone determination was later narrowed to exempt toy drones.',
    // 08-17: the NEGATION of an exemption, and it carries a consequence verb.
    'California’s SB 53 does not exempt anyone from coverage on revenue, which is why coverage turns on the model.',
    // 07-18: an exemption named as a noun, with no predicate and no mechanism.
    'The increase applies outside the USMCA exemption, which still covers more than 85% of bilateral trade.',
    // 07-28: an exemption that was CLOSED — the opposite claim.
    'The entire model was a fiscal arbitrage: ultra-cheap parcels shipped duty-free from China under the US de minimis exemption. Once Washington closed that exemption in 2025, the moat converted into a tariff bill the company now absorbs.',
    // 08-17: a request to be exempted, with no authority named after it.
    'A generator owner whose plant was in service before the effective date may ask to be exempted, but only for a documented hardware limitation.',
    // A proper noun is not an authority: a vendor cannot hold jurisdiction.
    'Delta is exempt from Fetcherr, which is why it can price each seat.',
  ];
  const rvLooseHits = RV_LOOSE.filter(t => rvOn(t).length > 0);
  const okRvLoose = rvLooseHits.length === 0;
  console.log(
    `  [IMP-215] SILENT on all ${RV_LOOSE.length} LOOSE forms from the real archive ("exempting X from their blockade", "narrowed to exempt toy drones", "does NOT exempt anyone from coverage", "outside the USMCA exemption", "closed that exemption", "may ask to be exempted", "exempt from Fetcherr") — the predicate must bind IMMEDIATELY to a NAMED AUTHORITY: ${okRvLoose ? '✓' : '✗'}${rvLooseHits.length ? ` (got ${rvLooseHits.length})` : ''}`
  );

  // 6. REGRESSION PIN — every published brief from 2026-08-01 onward, date shield OFF, no truth
  // rows anywhere, which is the maximum-fire configuration. The count is REPORTED, and the ceiling
  // is asserted rather than the exact number, because the directory grows nightly (IMP-213's
  // lesson: a selftest assertion must not be a hostage to tomorrow's publish).
  const rvSweepDir = path.join(root, 'content/daily-updates');
  const rvSweepFires: string[] = [];
  let rvSweepFiles = 0;
  let rvSweepDaily = 0;
  for (const f of fs
    .readdirSync(rvSweepDir)
    .filter(x => /^2026-\d\d-\d\d(?:-light)?\.md$/.test(x))
    .sort()) {
    if (f.slice(0, 10) < '2026-08-01') continue;
    rvSweepFiles++;
    if (!/-light\.md$/.test(f)) rvSweepDaily++;
    const hits = regulatoryVacuumLeg(
      fs.readFileSync(path.join(rvSweepDir, f), 'utf8'),
      null,
      '2026-08-24', // date shield OFF: judge the whole window by tonight's rule
      true
    );
    if (hits.length) rvSweepFires.push(`${f}:${hits.length}`);
  }
  // EVERY FIRE INSPECTED AND NAMED. Both are the 08-24 defect: the daily's AI&T-2 and the super
  // brief's restatement of the same sentence ("…from 3 percent to 20 percent, BECAUSE airlines are
  // exempt from Federal Trade Commission pricing oversight"). Two reader-facing pages, one defect,
  // and the second one is the reason `because` is in the consequence set.
  const okRvSweep =
    rvSweepFires.length <= 2 &&
    rvSweepFires.every(x => x.startsWith('2026-08-24'));
  console.log(
    `  [IMP-215] REGRESSION SWEEP: ${rvSweepFires.length} fire(s) across ${rvSweepFiles} published files from 2026-08-01 (${rvSweepDaily} dailies + ${rvSweepFiles - rvSweepDaily} super briefs) with the date shield OFF — [${rvSweepFires.join(', ') || 'none'}] — and BOTH are tonight's own defect (2026-08-24.md AI&T-2; 2026-08-24-light.md restating it): ${okRvSweep ? '✓' : '✗'}`
  );

  // NO RETRO (IMP-125) + the severity contract, on the SAME BYTES read both ways.
  const okRvNoRetro =
    rvOn(rvPub, null, '2026-08-23').length === 0 &&
    rvOn(rvPub, null, '2026-08-24').length === 1;
  const okRvSeverity =
    rvOn(rvPub, null, '2026-08-24', false)[0]?.severity === 'FLAG' &&
    rvOn(rvPub, null, '2026-08-24', true)[0]?.severity === 'FAIL';
  console.log(
    `  [IMP-215] NO RETRO: the same bytes are EXEMPT judged as 08-23 and FIRE judged as 08-24 · SEVERITY: FLAG in the evening (the brief ships), FAIL under --require-resolved (the Morning Truth Gate has a browser and must settle it): ${okRvNoRetro && okRvSeverity ? '✓' : '✗'}`
  );

  // ── ESC-018: the settle-observation rail must announce its own starvation ─────────────────────
  // Both directions, and the FIRE case is a REAL truth file, not a fixture: 2026-08-21's own truth
  // file carries zero `price:` rows, which is the whole reason this escalation exists.
  const starveReal = (() => {
    const p = path.join(process.cwd(), 'daily-briefs/2026-08-21-truth.json');
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  })();
  const okStarveFire =
    starveReal != null &&
    settleObservationRail(starveReal, '2026-08-21', false).some(f =>
      /GATE STARVED/.test(f.message)
    );
  console.log(
    `  [ESC-018] the settle-observation rail FLAGS ITS OWN STARVATION on the real 2026-08-21 truth file (0 price: rows): ${okStarveFire ? '✓' : '✗'}`
  );
  const okStarveSilent = !settleObservationRail(
    {
      claims: {
        'price:brent-settle-2026-08-20': {
          observedAt: '2026-08-20T19:00:00Z',
        },
      },
    },
    '2026-08-21',
    false
  ).some(f => /GATE STARVED/.test(f.message));
  console.log(
    `  [ESC-018] SILENT the moment ONE price: row exists — starvation, not emptiness, is what it reports: ${okStarveSilent ? '✓' : '✗'}`
  );
  // And it must not condemn the pre-rail archive (IMP-125).
  const okStarveNoRetro = !settleObservationRail(
    { claims: {} },
    '2026-07-01',
    false
  ).some(f => /GATE STARVED/.test(f.message));
  console.log(
    `  [ESC-018] NO RETRO: silent before SETTLE_RAIL_EFFECTIVE_FROM: ${okStarveNoRetro ? '✓' : '✗'}`
  );

  // ── IMP-208 — COMPOSITION RECONCILIATION (08-22 Critic mandate #1, RC2) ──────────────────────
  // Three cases, two directions, all on the night's REAL bytes, exactly as the mandate specified.
  // The arithmetic is pinned FIRST and separately: if the decomposition formula ever regresses to
  // base-period shares, these two lines red before any file is read, and the failure names itself
  // instead of arriving as a mysterious silence on a fixture.
  const cr145 = reconcileResidualGrowth(61.5, 47.2, 199);
  const cr93 = reconcileResidualGrowth(56.0, 47.2, 199);
  const okCrMath =
    cr145 != null &&
    cr93 != null &&
    Math.abs(cr145 - 14.5) < 0.3 &&
    Math.abs(cr93 - 9.3) < 0.3;
  console.log(
    `  [IMP-208] THE ARITHMETIC: current-period decomposition reproduces the mandate's receipts — 61.5/47.2/199 -> ${cr145?.toFixed(2)} (expect 14.5) and 56.0/47.2/199 -> ${cr93?.toFixed(2)} (expect 9.3): ${okCrMath ? '✓' : '✗'}`
  );

  const crOn = (p: string, d: string): Finding[] => {
    const f = path.join(root, p);
    return fs.existsSync(f)
      ? checkCompositionReconciliation(fs.readFileSync(f, 'utf8'), d)
      : [];
  };
  // FIRE — the v1.5 that carried the defect into the Editor. 61.5 / 47 / 200 / "roughly 10".
  const crFire = crOn('daily-briefs/2026-08-22-v1.5.md', '2026-08-22');
  const okCrFire =
    crFire.length === 1 &&
    crFire[0]!.check === 'composition-reconciliation' &&
    /61\.5/.test(crFire[0]!.message) &&
    /implies a residual of 14\.6%/.test(crFire[0]!.message) &&
    /4\.6pp/.test(crFire[0]!.message);
  console.log(
    `  [IMP-208] FIRES on the REAL 2026-08-22 v1.5 AI&T-3 (61.5 total / 47% semis / +200% semis / "roughly 10 percent" residual -> implied 14.6, off by 4.6pp): ${okCrFire ? '✓' : '✗'}${crFire.length !== 1 ? ` (got ${crFire.length})` : ''}`
  );
  // SILENT — the CORRECTED form. The published bullet struck the headline total outright ("We
  // print no headline growth total"), so the published bytes no longer contain a four-tuple at
  // all; that is its own (weaker) silence case below. The mandate's 56.0 variant therefore has to
  // be CONSTRUCTED, and it is constructed the only honest way: by substituting 61.5 -> 56.0 in the
  // REAL fire bytes and changing nothing else, so the only difference between FIRE and SILENT is
  // the one number the Critic said was wrong.
  const crFireBody = fs.readFileSync(
    path.join(root, 'daily-briefs/2026-08-22-v1.5.md'),
    'utf8'
  );
  const crCorrected = crFireBody.replace(
    'exports rose 61.5 percent',
    'exports rose 56.0 percent'
  );
  const crSilentCorrected = checkCompositionReconciliation(
    crCorrected,
    '2026-08-22'
  );
  const okCrSilentCorrected =
    crCorrected !== crFireBody && crSilentCorrected.length === 0;
  console.log(
    `  [IMP-208] SILENT on the CORRECTED 56.0 form (same bytes, one number changed -> implied 9.4 vs the printed 10, 0.6pp): ${okCrSilentCorrected ? '✓' : '✗'}${crSilentCorrected.length ? ` (got ${crSilentCorrected.length})` : ''}`
  );
  // SILENT — the PUBLISHED 08-22, where the fix was to strike the total rather than renumber the
  // residual. Three of four terms is not an equation and must not be scored as one.
  const crPub = crOn('content/daily-updates/2026-08-22.md', '2026-08-22');
  const okCrSilentPublished = crPub.length === 0;
  console.log(
    `  [IMP-208] SILENT on the PUBLISHED 2026-08-22 (headline total struck; 3 of 4 terms is not an equation): ${okCrSilentPublished ? '✓' : '✗'}${crPub.length ? ` (got ${crPub.length})` : ''}`
  );
  // SILENT — M&M-2 ON THE SAME PAGE. Six magnitudes in one bullet ($102.20, ~$170, +28%, +47%,
  // $4.10/$3.83, $5.45/$5.05) that are NOT a composite-and-residual set. A gate that fires on any
  // bullet with four numbers is a gate the Writer learns to route around, so this is asserted at
  // the BULLET level, not merely at the page level — a page-level silence could hide a fire here
  // behind a fire elsewhere.
  const crMm2 = (() => {
    for (const p of [
      'content/daily-updates/2026-08-22.md',
      'daily-briefs/2026-08-22-v1.5.md',
    ]) {
      const f = path.join(root, p);
      if (!fs.existsSync(f)) continue;
      const bullet = bulletRegions(
        stripComments(fs.readFileSync(f, 'utf8'))
      ).find(b => /shortage stopped being about crude/i.test(b.text));
      if (!bullet) return null;
      if (compositionUnits(bullet.text).length) return false;
    }
    return true;
  })();
  const okCrSilentMm2 = crMm2 === true;
  console.log(
    `  [IMP-208] SILENT on the SAME PAGE's M&M-2 diesel bullet — six magnitudes, no composite-and-residual set — in BOTH the v1.5 and published copies: ${okCrSilentMm2 ? '✓' : '✗'}`
  );
  // FALSE-POSITIVE FLOOR — every published brief in the archive, July and August, judged as if the
  // rule had always bound. The floor is the gate's licence to FAIL at the Morning Truth Gate.
  const crFloorHits: string[] = [];
  let crFloorFiles = 0;
  for (const f of fs
    .readdirSync(path.join(root, 'content/daily-updates'))
    .filter(x => /^2026-\d\d-\d\d(?:-light)?\.md$/.test(x))
    .sort()) {
    crFloorFiles++;
    if (f.slice(0, 10) === '2026-08-22') continue; // tonight is the receipt, not the floor
    const hits = checkCompositionReconciliation(
      fs.readFileSync(path.join(root, 'content/daily-updates', f), 'utf8'),
      '2026-08-22' // date shield OFF: judge the whole archive by tonight's rule
    );
    if (hits.length) crFloorHits.push(`${f}:${hits.length}`);
  }
  const okCrFloor = crFloorHits.length === 0;
  console.log(
    `  [IMP-208] FALSE-POSITIVE FLOOR = 0 across ${crFloorFiles} published files with the date shield OFF: ${okCrFloor ? '✓' : '✗'}${crFloorHits.length ? ` (got ${crFloorHits.join(', ')})` : ''}`
  );
  // NO RETRO (IMP-125) — the boundary is a real switch, proven on the SAME BYTES read both ways.
  const okCrNoRetro =
    checkCompositionReconciliation(crFireBody, '2026-08-21').length === 0 &&
    checkCompositionReconciliation(crFireBody, '2026-08-22').length === 1;
  console.log(
    `  [IMP-208] NO RETRO: the same v1.5 bytes are EXEMPT judged as 08-21 and FIRE judged as 08-22: ${okCrNoRetro ? '✓' : '✗'}`
  );
  // The severity contract: advisory in the evening, blocking at the Morning Truth Gate.
  const okCrSeverity =
    checkCompositionReconciliation(crFireBody, '2026-08-22', false)[0]
      ?.severity === 'FLAG' &&
    checkCompositionReconciliation(crFireBody, '2026-08-22', true)[0]
      ?.severity === 'FAIL';
  console.log(
    `  [IMP-208] SEVERITY: FLAG in the evening (the brief ships), FAIL under --require-resolved (nothing publishes carrying its own refutation): ${okCrSeverity ? '✓' : '✗'}`
  );

  // ── SETTLED-CLOSE LEG (R3, 2026-08-29) — E-INTRADAY-FOR-CLOSE-01 ──────────────────────────
  // Fires on BOTH named 08-28 receipts, on the real bytes. See the leg's scope note: the pattern
  // half is proven here; the discriminator half (a recorded close) does not exist on disk yet, so
  // this ships ADVISORY and the escalation stays OPEN.
  const sc28 = locRead('daily-briefs/2026-08-28-v2.md');
  const scFindings = sc28 ? settledCloseFindings(sc28, 231) : [];
  const okR3Fire =
    !sc28 ||
    (scFindings.some(f =>
      /finished 5\.8 percent off its high/i.test(f.sentence)
    ) &&
      scFindings.some(f =>
        /rose about 21 percent on Thursday/i.test(f.sentence)
      ));
  // Before the settle + grace, nothing fires — an intraday brief is allowed intraday marks.
  const okR3Grace =
    !sc28 || settledCloseFindings(sc28, SETTLE_GRACE_MIN).length === 0;
  // An hour-stamped mark declares its own vintage and is exactly the remedy the rule asks for.
  const okR3HourStamp =
    settledCloseFindings(
      'Micron finished 5.8 percent off its high at 10:43 ET.',
      231
    ).length === 0 &&
    settledCloseFindings('Micron finished 5.8 percent off its high.', 231)
      .length === 1;
  // A FINANCING close is not a session close (the Copper false positive, from the real bytes).
  const okR3Financing =
    settledCloseFindings(
      'Copper, the London crypto custodian, closed a $200 million funding round this week.',
      231
    ).length === 0;
  // A statement about a PAST period is not a claim about yesterday's session.
  const okR3Historical =
    settledCloseFindings(
      "Grayscale's trust traded to a 49 percent discount in December 2022 and closed it by converting.",
      231
    ).length === 0;
  // THE EXEMPTION, wired and waiting: a ticker whose close WAS recorded is not guessing.
  const okR3Resolved =
    settledCloseFindings('CRM closed up 22.60 percent.', 231).length === 1 &&
    settledCloseFindings('CRM closed up 22.60 percent.', 231, new Set(['CRM']))
      .length === 0;
  // ── C2: THE NUMERIC DISCRIMINATOR, on the real truth rows ──────────────────────────────────
  const c2Closes = recordedCloses(
    path.join(root, 'daily-briefs/2026-08-28-truth.json')
  );
  const okC2Load =
    c2Closes.length === 4 &&
    c2Closes.some(c => c.key === 'CRM' && c.pct === 22.6);
  const crm = c2Closes.find(c => c.key === 'CRM')!;
  const mu = c2Closes.find(c => c.key === 'MU')!;
  // A sentence quoting the recorded close is CORRECT USAGE and must fall out.
  const okC2Agrees =
    agreesWithClose('Salesforce closed up 22.60 percent on Thursday.', crm) &&
    !agreesWithClose('Salesforce rose about 21 percent on Thursday.', crm);
  // 🔴 THE REJECTED DESIGN, pinned so it cannot come back: exempting every sentence about a
  // recorded INSTRUMENT would have exempted the Salesforce defect itself.
  const okC2NotInstrumentLevel =
    !!closeFor('Salesforce rose about 21 percent on Thursday.', c2Closes) &&
    settledCloseFindings(
      'Salesforce rose about 21 percent on Thursday.',
      231,
      new Set(),
      c2Closes
    ).length === 1;
  // …and the finding NAMES what it contradicts.
  const okC2Names =
    settledCloseFindings(
      'Salesforce rose about 21 percent on Thursday.',
      231,
      new Set(),
      c2Closes
    )[0]?.recorded === 'CRM settled +22.6%';
  // Company name, not ticker — the prose never says "MU".
  const okC2ByName =
    !!closeFor('Micron finished 5.8 percent off its high.', c2Closes) &&
    mu.names.includes('Micron');
  // An UNRESOLVED close row is a close that was looked for and NOT found — never an exemption.
  const okC2Unresolved =
    recordedCloses(path.join(root, 'daily-briefs/2026-08-27-truth.json'))
      .length === 0;

  const ok =
    okCrMath &&
    okCrFire &&
    okCrSilentCorrected &&
    okCrSilentPublished &&
    okCrSilentMm2 &&
    okCrFloor &&
    okCrNoRetro &&
    okCrSeverity &&
    okStarveFire &&
    okStarveSilent &&
    okStarveNoRetro &&
    okObsFire &&
    okObsAllVerbs &&
    okObsSilentSamePage &&
    okObsSilent0819 &&
    okObsNoStorm &&
    okObsNoRetro &&
    okObsRegistry &&
    okScRealFire &&
    okScGold &&
    okScSilentSamePage &&
    okScSwap &&
    okScCrypto &&
    okScNonMarket &&
    okScObjects &&
    okScExplicit &&
    okScHistorical &&
    okScCalNoRetro &&
    okScSeverity &&
    okRvRealFire &&
    okRvFixNotPunished &&
    okRvSilentGrandfather &&
    okRvSilentGeo &&
    okRvSilentPresent &&
    okRvSwap &&
    okRvLoose &&
    okRvSweep &&
    okRvNoRetro &&
    okRvSeverity &&
    okDaFire &&
    okDaSilentSettledAt &&
    okDaSilentMagnitude &&
    okDaSilentDealSize &&
    okDaEpoch &&
    okDaWeekly &&
    okDaPctFire &&
    okDaPctNarrow &&
    okDaPctCoPresence &&
    okDaReal &&
    okDaRealScoped &&
    okHaTitle &&
    okHaWatch &&
    okHaCritical &&
    okHaClean &&
    okHaDateline &&
    okHaNoDate &&
    okHaReal &&
    okHaWeekRange &&
    okHaYear &&
    okHaEpoch &&
    okHaWeekly &&
    okByEpoch &&
    okByFire &&
    okBySilentOrg &&
    okBySilentNoPossessive &&
    okBySilentBarePerson &&
    okByReal &&
    okFire &&
    okSilentDated &&
    okSilentFirst &&
    okFpFire &&
    okFpNikkei &&
    okFpSilentDated &&
    okFpSilentFirst &&
    okMagWord &&
    okMagSym &&
    okBindingsLoad &&
    okEaFire &&
    okEaSilent &&
    okJgbFire &&
    okJgbSilent &&
    okThFire &&
    okThSilent &&
    okThSourced &&
    okThNominal &&
    okThMixed &&
    okThResolved &&
    okCalLoad &&
    okEvFire &&
    okEvSilent &&
    okEvNoCal &&
    okEvWrongDay &&
    okWtiAttrib &&
    okToa &&
    okToaNarrow &&
    okAggFire &&
    okAggResolves &&
    okAggSingle &&
    okAggSilent13 &&
    okRelWorkFire &&
    okRelPubSilentNY &&
    okRelSynthFire &&
    okRelSynthStable &&
    okRelSynthWatch &&
    okRelSynthPoss &&
    okRelSynthMarket &&
    okRegOk &&
    okRegMalformed &&
    okRegEmpty &&
    okRegMissing &&
    okRegBadRow &&
    okRegRealHealthy &&
    okSchemaMissingKey &&
    okSchemaBlankRe &&
    okZeroWidthTerminates &&
    okAisiFire &&
    okAisiSilent &&
    okEcFire &&
    okEcSilent &&
    okEcReal &&
    okEcPubResolvable &&
    okEdFire &&
    okEdSilentDeadline &&
    okStatFire &&
    okStatSilentPrc &&
    okStatSilentDate &&
    okStatFlop &&
    okStatReal &&
    okStatResolves &&
    okEdSilentBare &&
    okEdReal &&
    okScFireReal &&
    okScUnresolvedReal &&
    okScResolves &&
    okScSilentBare &&
    okScSilentMention &&
    okScNoStorm &&
    okScInvFire &&
    okScInvSilent &&
    okScInvNoRow &&
    okScNoRetro &&
    okScRetroNotBlanket &&
    okAiFireMsft &&
    okAiFireAtlas &&
    okAiSilentHedgeMsft &&
    okAiSilentPlanAtlas &&
    okAiSilentHedgeVerb &&
    okAiSilentAnalysis &&
    okAiSilentOther &&
    okAiRealCorrected &&
    okYoyGmFire &&
    okYoyStldFire &&
    okYoyResolves &&
    okYoySilentRatio &&
    okYoySilentMove &&
    okYoyScopeSignal &&
    okYoyReal &&
    okCorpFire &&
    okCorpSilentMacro &&
    okCorpSilentBare &&
    okCorpReal &&
    okDewFire &&
    okSeriesFire &&
    okSeriesNamesAnchor &&
    okSeriesCritical &&
    okSeriesSilentDated &&
    okSeriesSilentInternal &&
    okSeriesSilentBounded &&
    okSeriesSilentPre &&
    okDewSilentFwd &&
    okDewSilentMkt &&
    okDewRealFire &&
    okDewNoDupe &&
    okSegFire &&
    okSegSilentDisclosed &&
    okSmFire &&
    okSmSilentYoy &&
    okSmSilentIndex &&
    okSmSilentName &&
    okSmPrecise &&
    okTeShare &&
    okTePeriod &&
    okTeCmp &&
    okTeScoped &&
    okTeSilentOrdinary &&
    okTeReal31 &&
    okTeReal01 &&
    okEarnFire &&
    okEarnResolves &&
    okEarnSilentYoy &&
    okEarnSilentGuidance &&
    okEarnSilentMove &&
    okEarnReal &&
    okAttrRealFire &&
    okAttrRealUnresolved &&
    okAttrHedge &&
    okAttrScope &&
    okAttrSilentFaithful &&
    okAttrSilentUnattributed &&
    okAttrSilentArgument &&
    okIssuerFireCircle &&
    okIssuerUnresolved &&
    okIssuerFireCoreWeave &&
    okIssuerSilentTimema &&
    okIssuerSilentGeo &&
    okIssuerSilentStudy &&
    okIssuerNoStorm &&
    okIssuerNoRetro &&
    okAttrSilentCleanSections &&
    okAttrNoNeverFp &&
    okAttrNoStorm &&
    okAttrNoRetro &&
    okLocFire &&
    okLocMismatch &&
    okLocAgrees &&
    okLocSilentWork &&
    okLocNoStorm &&
    okLocNoRetro &&
    okLocNotProse &&
    okDfcFire &&
    okDfcNoStorm &&
    okDlsFire &&
    okDlsSilent &&
    okDlsNoStorm &&
    okR3Fire &&
    okR3Grace &&
    okR3HourStamp &&
    okR3Financing &&
    okR3Historical &&
    okR3Resolved &&
    okC2Load &&
    okC2Agrees &&
    okC2NotInstrumentLevel &&
    okC2Names &&
    okC2ByName &&
    okC2Unresolved;
  console.log(
    `  [C2] close: rows load (${okC2Load ? '✓' : '✗'}) · a sentence quoting the recorded close falls out (${okC2Agrees ? '✓' : '✗'}) · instrument-level exemption REJECTED, the Salesforce defect still fires (${okC2NotInstrumentLevel ? '✓' : '✗'}) · the finding names what it contradicts (${okC2Names ? '✓' : '✗'}) · matched by company NAME not ticker (${okC2ByName ? '✓' : '✗'}) · a night with no rows exempts nothing (${okC2Unresolved ? '✓' : '✗'})`
  );
  console.log(
    `  [R3] settled-close FIRES on both named 08-28 receipts (Micron, Salesforce): ${okR3Fire ? '✓' : '✗'} · silent before settle+grace: ${okR3Grace ? '✓' : '✗'} · hour-stamp exempt: ${okR3HourStamp ? '✓' : '✗'} · financing close exempt: ${okR3Financing ? '✓' : '✗'} · historical period exempt: ${okR3Historical ? '✓' : '✗'} · recorded-close exemption wired: ${okR3Resolved ? '✓' : '✗'}`
  );
  if (ok) {
    console.log(
      '\n✅ SELFTEST PASS — gate bites the 07-10/07-11/07-13 failures (reuse, transposition, entity misattribution, harmonize-to-published, release-date falsehood) and stays silent on the corrected/healthy cases — including its own two false positives.'
    );
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  if (!okEvSilent)
    for (const f of evSilentFindings)
      console.error(
        `  unexpected event finding on the PUBLISHED 07-13 brief: ${f.message.slice(0, 200)}`
      );
  if (!okFpSilentDated) {
    for (const f of fpSilentDated)
      console.error(`  unexpected: ${f.message.slice(0, 160)}`);
  }
  if (!okEaSilent)
    for (const f of eaSilent)
      console.error(
        `  unexpected entity finding on the PUBLISHED brief: ${f.message.slice(0, 200)}`
      );
  if (!okThSilent)
    for (const f of thSilent)
      console.error(
        `  unexpected harmonization finding on 07-10 QG: ${f.message.slice(0, 160)}`
      );
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    process.exit(selftest());
  }
  const briefArg = args.find(a => !a.startsWith('--'));
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
  const archiveDays =
    archiveDaysIdx >= 0 ? parseInt(args[archiveDaysIdx + 1], 10) || 14 : 14;

  if (!briefArg) {
    console.error(
      'Usage: fact-gate.ts <brief.md> [--truth <truth.json>] [--allow-unverified] [--archive-days N]'
    );
    console.error('       fact-gate.ts --selftest');
    process.exit(2);
  }
  const briefPath = path.isAbsolute(briefArg)
    ? briefArg
    : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) {
    console.error(`File not found: ${briefPath}`);
    process.exit(2);
  }
  const body = stripComments(fs.readFileSync(briefPath, 'utf8'));

  // Registry (zero-network). Resolve relative to repo root (script lives in scripts/).
  // IMP-064: loaded through loadRegistry so that missing/malformed/empty is a reported
  // STATE, not a silent `{ facts: [] }` that switches the office-holder layer off while
  // the gate keeps printing PASS.
  const factsReg = loadRegistry<any>(
    'current-facts.json',
    'current-facts.json',
    'facts',
    briefPath
  );
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
        path.join(
          process.cwd(),
          'daily-briefs',
          'weekly',
          `${briefDate}-truth.json`
        ),
        path.join(process.cwd(), 'daily-briefs', `${briefDate}-truth.json`),
      ]
    : [];
  const defaultTruth = truthCandidates.find(p => fs.existsSync(p)) ?? null;
  const truthPath = truthArg
    ? path.isAbsolute(truthArg)
      ? truthArg
      : path.join(process.cwd(), truthArg)
    : defaultTruth;
  if (truthPath && fs.existsSync(truthPath))
    truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));

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

  // 3d-quinquies. NAMED-STATUTE THRESHOLDS (IMP-189 — 08-17 Critic mandate #1, RC2). "SB 53 exempts
  // any company below $500 million in revenue or model training costs from coverage" was wrong in
  // both its criterion and its effect, and the unit's conclusion rested on it. A statute cited beside
  // a monetary or proportional threshold now resolves only against the bill's own text.
  const statuteClaims = statuteThresholdClaims(body, briefDate);
  for (const e of statuteClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3d-bis. SOURCE CONCLUSIONS (IMP-143 — the 08-07 mandate #2, re-prescribed 08-08 as #2a after
  // it vanished without code, row or deferral). A bullet leaning on a named source's report/study/
  // talk must record that source's OWN conclusion; unresolved blocks at the Morning Truth Gate,
  // and a resolved row whose conclusion the brief NEGATES is a hard finding.
  const sourceConclusions = sourceConclusionClaims(body, briefDate);
  for (const e of sourceConclusions)
    if (truth?.claims?.[e.key]) e.status = 'PASS';
  findings.push(
    ...sourceConclusionInversions(
      sourceConclusions,
      truth?.claims as
        | Record<string, { conclusion?: string; resolved?: boolean }>
        | undefined
    )
  );

  // 3d-ter. ATTRIBUTED SUPERLATIVES (IMP-165 — 08-12 Critic mandate #3, RC2; discharges IMP-151(a)).
  // A superlative credited to a named party is resolved only by that party's verbatim wording; a
  // deleted hedge or an added scope is a hard finding. No row → the --require-resolved rail blocks
  // it at the Morning Truth Gate exactly like any other unresolved CRITICAL claim.
  const attrSuperlatives = attributedSuperlativeClaims(body, briefDate);
  for (const e of attrSuperlatives)
    if (truth?.claims?.[e.key]) e.status = 'PASS';
  findings.push(
    ...attributedSuperlativeFidelity(
      attrSuperlatives,
      truth?.claims as
        | Record<string, { quotation?: string; resolved?: boolean }>
        | undefined
    )
  );

  // 3d-quater. ISSUER-CAUSAL CLAIMS (IMP-166 — 08-13 Critic mandate #1, RC2). IMP-143's contract
  // wrote 11 rows on 08-13 and ZERO for the Six, which is the only place the class recurred: C&C-2
  // substituted a 151% VOLUME rise for the issuer's own 25% average-circulation growth and refuted
  // its own thesis doing it. An issuer results release is not a study, so nothing wrote a row. Now a
  // bullet that reasons causally about an issuer's own reported metric must carry the ISSUER'S OWN
  // causal sentence verbatim, under the same --require-resolved rail.
  const issuerCausals = issuerCausalClaims(body, briefDate);
  for (const e of issuerCausals) if (truth?.claims?.[e.key]) e.status = 'PASS';

  // 3d-quinquies. THE REGULATORY-VACUUM LEG (IMP-215 — 08-24 Critic mandate #1, RC2, NEW CLASS).
  // Wired at the issuer-causal site because it is the same question one level up: the issuer leg
  // asks whether a CAUSAL claim about a company's own number is the company's claim; this asks
  // whether a CAUSAL claim built on a regulatory carve-out is true at all. 08-24 AI&T-2 built a
  // mechanism on "airlines are exempt from Federal Trade Commission oversight" when 49 U.S.C.
  // § 41712 had merely moved that authority to DOT — a FALSE INFERENCE FROM A TRUE FACT, which is
  // the one shape every number-checking rail in this file is blind to by construction. Emits a
  // FINDING rather than a Claim (the row it demands is a requirement on the WRITER, not a value to
  // reconcile), so it rides the same severity contract as IMP-205/IMP-213: FLAG in the evening,
  // FAIL under --require-resolved.
  findings.push(
    ...regulatoryVacuumLeg(body, truth, briefDate, requireResolved).map(f => ({
      check: f.check,
      severity: f.severity as any,
      message: f.message,
    }))
  );

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

  // 3k. SERIES EXTREMUM (IMP-202, the 08-20 Critic's mandate #1). "2.7 percent, near the lowest in
  // a series beginning in 1947" was false in BOTH parts (PSAVERT begins 1959; record low 1.4% in
  // 2005) and load-bearing for the bullet's conclusion. Every prior superlative leg compares against
  // OUR ARCHIVE, which cannot know when a federal series began. A series' start date and its record
  // are facts about the SERIES, not about today's datum → CRITICAL, resolved under `series:<slug>`.
  const seriesClaims = seriesExtremumClaims(body, briefDate);
  for (const e of seriesClaims) if (truth?.claims?.[e.key]) e.status = 'PASS';

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
  const bindReg = loadRegistry<Binding>(
    'entity-bindings.json',
    'entity-bindings.json',
    'bindings',
    briefPath
  );
  findings.push(...entityAttribution(body, bindReg.rows, bindReg.health));

  // 4d-i. REGISTRY INTEGRITY (IMP-064) — the premise layer must prove it loaded. A
  // registry that is missing, malformed, empty, or carrying unusable rows silently
  // disables the only checks that read the SUBJECT of a claim, and the gate would
  // otherwise report PASS on premises nobody verified. Nothing checks the checker;
  // now something does. Evaluated AFTER entityAttribution so bad rows are counted.
  findings.push(...registryFindings([bindReg.health, factsReg.health]));

  // 4e. Truth-harmonization guard (QG log): the gate that manufactured a falsehood by
  // "aligning" a true draft figure to a false published one. A published number is a claim.
  findings.push(
    ...truthHarmonization(findQgLog(briefPath, briefDate), briefDate)
  );

  // 4f. Relative-date referent (IMP-058): a past-relative word ("yesterday", "overnight", …)
  // on a dated EVENT shifts its referent between the evening write and the morning read. The
  // 07-16 "Yesterday New York became the first state to ban…" was an EO signed two days earlier.
  // Advisory — the Morning Truth Gate resolves it; the brief always ships.
  findings.push(...relativeDateFindings(body, briefDate));

  // 4g. Corporate scheduled-event weekday (IMP-082): "AMD opens its conference Tuesday" (a Wed-Thu
  // event) — a company earnings/conference date pinned to a weekday, checkable in one fetch. Advisory;
  // the Morning Truth Gate confirms the absolute date and rewrites the weekday if wrong.
  findings.push(...corporateEventDateFindings(body, briefDate));

  // 4h. Dated-event weekday (IMP-161, 08-11 Critic mandate #2): a named actor's COMPLETED action
  // pinned to a weekday — "Delaware told Verisk on Monday" for a Friday ruling. One row per
  // bullet, requiring per-row resolution at the Morning Truth Gate. Complements 4g, which covers
  // only a company's SCHEDULED event and could never have seen this class.
  findings.push(...datedEventWeekdayFindings(body, briefDate));

  // 4h. Segment-metric attribution (IMP-083): "AMD's data-center GPU revenue, $7.7 billion" — a
  // compound segment+chip line AMD does not disclose, shipped as if it were a reported metric.
  // Advisory; the Morning Truth Gate confirms the line is reported or the figure is labeled/sourced.
  findings.push(...segmentMetricFindings(body, briefDate));
  findings.push(...stockMoveReactionFindings(body, briefDate)); // IMP-101 (restored)
  findings.push(...takeExtraordinaryFindings(body, briefDate)); // IMP-115
  // IMP-120 leg (b): the offline half — a bullet that contradicts its own printed prices.
  findings.push(...derivedPercentageFindings(body, briefDate));

  // 4i. Derived-figure contradiction (IMP-193, 08-18 Critic mandate #2): the brief ships a figure
  // its own pre-draft COMPUTED, and the published rival that pre-draft named is nowhere on the
  // page. derivedPercentageFindings sees a bullet contradicting ITSELF; this sees a bullet made
  // consistent by deletion — the failure that stays invisible precisely because it tidied up.
  findings.push(
    ...derivedFigureContradictionFindings(
      body,
      loadPredrafts(briefPath, briefDate)
    )
  );

  // 4j. Dashboard level recency (IMP-196, 08-19 Critic mandate #1): a precise level repeated from
  // one of the last 3 published Dashboards, under a verb describing today's move. The archive
  // rails above ask whether a price is PLAUSIBLE; this asks whether it is TODAY'S.
  findings.push(...dashboardLevelStalenessFindings(body, briefPath, briefDate));

  // 4k. Composition reconciliation (IMP-208, 08-22 Critic mandate #1): a bullet stating a
  // composite growth rate, a component's share, that component's growth AND an explicit residual
  // has published an equation — recompute it. Every other leg checks numbers against the outside
  // world or the archive; this is the only one that checks them against EACH OTHER. FAIL under
  // --require-resolved, because this defect needs no source to resolve.
  findings.push(
    ...checkCompositionReconciliation(body, briefDate, requireResolved)
  );

  // 5. Truth cross-check (if truth present)
  if (truth) findings.push(...crossCheck(claims, truth));

  // 6. Unverified-critical gate (market + scheduled-event claims; superlatives are flagged for
  // verification, not blocked here). Event claims join the critical rails deliberately: a
  // same-session release-date assertion is exactly as load-bearing as a price, and on 07-13 it
  // was more so — it was a section's entire premise.
  const unverifiedCritical = [
    ...claims,
    ...eventClaims,
    ...aggClaims,
    ...entityCounts,
    ...effectiveDates,
    ...aiProducts,
    ...yoyClaims,
    ...earningsClaims,
    ...headlineClaims,
    ...bylineClaims,
    ...derivedClaims,
    ...seriesClaims,
    ...sourceConclusions,
    ...issuerCausals,
    ...attrSuperlatives,
    ...statuteClaims, // IMP-189
  ].filter(c => c.tier === 'critical' && c.status === 'UNVERIFIED');
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
  const truthBypass =
    !truth &&
    (claims.length > 0 ||
      superlatives.length > 0 ||
      eventClaims.length > 0 ||
      aggClaims.length > 0 ||
      entityCounts.length > 0 ||
      effectiveDates.length > 0 ||
      aiProducts.length > 0 ||
      yoyClaims.length > 0 ||
      earningsClaims.length > 0 ||
      headlineClaims.length > 0 ||
      bylineClaims.length > 0 ||
      derivedClaims.length > 0 ||
      seriesClaims.length > 0 ||
      sourceConclusions.length > 0 ||
      issuerCausals.length > 0);
  if (truthBypass) {
    findings.push({
      check: 'truth-bypass',
      severity: requireResolved ? 'FAIL' : 'FLAG',
      message: `TRUTH BYPASS — no truth file loaded; ${claims.length} market claim(s) + ${superlatives.length} superlative(s) ride entirely unverified. The gate has verified NOTHING about this brief. Before publish, the Morning Updater must write {BRIEF_DATE}-truth.json from refreshed market data and re-run with --require-resolved. Verify the ASSET as well as the number — the 07-10 failure was a transposition (the 10Y JGB's record attributed to the 30Y), which a number-only re-check cannot catch.`,
    });
  }
  // IMP-172 — THE QUOTE-VERBATIM RAIL (2026-08-14 Critic mandate #2, RC2).
  findings.push(
    ...quoteVerbatimRail(truth, briefDate, requireResolved).map(f => ({
      check: f.check,
      severity: f.severity as any,
      message: f.message,
    }))
  );
  // IMP-180 — THE CITATION-LOCATOR RAIL (2026-08-16 Critic mandate #2, RC2).
  findings.push(
    ...citationLocatorRail(body, truth, briefDate, requireResolved).map(f => ({
      check: f.check,
      severity: f.severity as any,
      message: f.message,
    }))
  );
  // IMP-173 — THE SETTLE-OBSERVATION RAIL (2026-08-14 Critic mandate #3, RC2, new class).
  findings.push(
    ...settleObservationRail(truth, briefDate, requireResolved).map(f => ({
      check: f.check,
      severity: f.severity as any,
      message: f.message,
    }))
  );
  // IMP-205 — THE OBSERVATION-KIND LEG (2026-08-21 Critic mandate #3, RC2).
  findings.push(
    ...checkObservationKind(body, truth, briefDate, requireResolved).map(f => ({
      check: f.check,
      severity: f.severity as any,
      message: f.message,
    }))
  );

  if (requireResolved) {
    for (const c of unverifiedCritical) {
      findings.push({
        check: 'unresolved-before-publish',
        severity: 'FAIL',
        message: `MORNING TRUTH GATE — critical claim still unverified at publish time: ${c.asset} "${c.direction}"${c.magnitudePct ? ` ${c.magnitudePct}%` : ''} (${c.section}). Verify against the refreshed tape and record it in {BRIEF_DATE}-truth.json, correct the sentence, or strip the number. Do not publish a critical number nobody checked.`,
      });
    }
  }

  const allClaims = [
    ...claims,
    ...superlatives,
    ...eventClaims,
    ...aggClaims,
    ...entityCounts,
    ...effectiveDates,
    ...aiProducts,
    ...yoyClaims,
    ...earningsClaims,
    ...headlineClaims,
    ...bylineClaims,
    ...derivedClaims,
    ...seriesClaims,
    ...sourceConclusions,
    ...issuerCausals,
    ...attrSuperlatives,
    ...statuteClaims, // IMP-189
  ];

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
      bylines: bylineClaims.length, // IMP-117
      derivedPrices: derivedClaims.length, // IMP-120
      seriesExtrema: seriesClaims.length, // IMP-202
      sourceConclusions: sourceConclusions.length, // IMP-143
      issuerCausals: issuerCausals.length, // IMP-166
      statuteThresholds: statuteClaims.length, // IMP-189
      pass: allClaims.filter(c => c.status === 'PASS').length,
      fail: allClaims.filter(c => c.status === 'FAIL').length,
      unverified: allClaims.filter(c => c.status === 'UNVERIFIED').length,
      officeHolderFacts: office.checked,
      archiveAssetsKnown,
      truthBypass,
      unresolvedCritical: unverifiedCritical.length,
      // IMP-064: the premise layer's proof of life, on the record in every ledger.
      registries: [bindReg.health, factsReg.health].map(h => ({
        name: h.name,
        state: h.state,
        rows: h.rows,
        badRows: h.badRows,
      })),
      registryBlind: [bindReg.health, factsReg.health].some(
        h => h.state !== 'ok' || h.badRows.length > 0
      ),
    },
    findings,
    claims: allClaims,
  };
  const ledgerPath = briefDate
    ? path.join(path.dirname(briefPath), `${briefDate}-factcheck.json`)
    : path.join(process.cwd(), 'factcheck.json');
  try {
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  } catch {
    /* read-only fs is fine */
  }

  const fails = findings.filter(f => f.severity === 'FAIL');
  const flags = findings.filter(f => f.severity === 'FLAG');

  console.log(`fact-gate — ${path.basename(briefPath)}`);
  console.log(
    `  market claims: ${claims.length} · superlatives: ${superlatives.length} · scheduled events: ${eventClaims.length} · aggregates: ${aggClaims.length} · entity-counts: ${entityCounts.length} · effective-dates: ${effectiveDates.length} · ai-products: ${aiProducts.length} · earnings: ${earningsClaims.length} · headline-anchors: ${headlineClaims.length} · bylines: ${bylineClaims.length} · derived-prices: ${derivedClaims.length} · series-extrema: ${seriesClaims.length} · source-conclusions: ${sourceConclusions.length} · issuer-causals: ${issuerCausals.length} · attributed-superlatives: ${attrSuperlatives.length} · statute-thresholds: ${statuteClaims.length} (${ledger.summary.pass} pass, ${ledger.summary.fail} fail, ${ledger.summary.unverified} unverified)`
  );
  console.log(
    `  archive: ${archiveAssetsKnown} assets known from our last ${archiveDays} briefs`
  );
  console.log(
    `  truth file: ${truthPath ? path.basename(truthPath) : 'NONE (critical claims will block unless --allow-unverified)'}`
  );
  // IMP-064: the premise layer states its own health on every run. A silent registry
  // is how a truth gate goes blind while reporting PASS.
  console.log(
    `  premise registries: ${[bindReg.health, factsReg.health]
      .map(
        h =>
          `${h.name} ${h.state === 'ok' && !h.badRows.length ? `${h.rows} rows ✓` : `${h.state.toUpperCase()}${h.badRows.length ? ` +${h.badRows.length} bad row(s)` : ''} ✗`}`
      )
      .join(' · ')}`
  );
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

// Direct-invocation guard (added 2026-08-12 — IMP-165). `main()` ran unconditionally, so this
// module could not be imported: any sibling gate that wanted `attributedSuperlativeClaims`
// got a usage banner and process.exit(2) instead. Same guard validate-brief.ts already uses.
const invokedDirectly =
  !!process.argv[1] && path.resolve(process.argv[1]).endsWith('fact-gate.ts');
if (invokedDirectly) main();
