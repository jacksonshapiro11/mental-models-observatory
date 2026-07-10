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
    const firstUp = UP_WORDS.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? Infinity;
    const firstDown = DOWN_WORDS.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? Infinity;
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

  console.log('fact-gate --selftest');
  console.log(`  FAIL on real 07-10 KOSPI Overnight reuse: ${okFire ? '✓' : '✗'} (${fire.length} finding(s))`);
  console.log(`  SILENT on real 07-09 ("on Tuesday" dated): ${okSilentDated ? '✓' : '✗'} (${silentDated.length} finding(s))`);
  console.log(`  SILENT on real 07-07 (first occurrence): ${okSilentFirst ? '✓' : '✗'} (${silentFirst.length} finding(s))`);
  console.log(`  FAIL on real 07-10 story-fingerprint reuse: ${okFpFire ? '✓' : '✗'} (${fpFire.length} finding(s))`);
  console.log(`  FAIL includes Nikkei −2.1% companion: ${okFpNikkei ? '✓' : '✗'}`);
  console.log(`  SILENT story-fp on dated 07-09: ${okFpSilentDated ? '✓' : '✗'} (${fpSilentDated.length} finding(s))`);
  console.log(`  SILENT story-fp on first-occurrence 07-07: ${okFpSilentFirst ? '✓' : '✗'} (${fpSilentFirst.length} finding(s))`);
  console.log(`  magnitude parses "4.91 percent": ${okMagWord ? '✓' : '✗'} (got ${magWord.mag}/${magWord.dir})`);
  console.log(`  magnitude parses "2.6%": ${okMagSym ? '✓' : '✗'} (got ${magSym.mag}/${magSym.dir})`);

  const ok =
    okFire && okSilentDated && okSilentFirst &&
    okFpFire && okFpNikkei && okFpSilentDated && okFpSilentFirst &&
    okMagWord && okMagSym;
  if (ok) {
    console.log('\n✅ SELFTEST PASS — gate bites the 07-10 failure and stays silent on dated/first-occurrence healthy cases.');
    return 0;
  }
  console.error('\n❌ SELFTEST FAIL');
  if (!okFpSilentDated) {
    for (const f of fpSilentDated) console.error(`  unexpected: ${f.message.slice(0, 160)}`);
  }
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

  // 4b. Dramatic-event reuse (zero-network): yesterday's halt as today's Overnight.
  findings.push(...dramaticEventReuse(body, briefPath, briefDate));

  // 4c. Story-fingerprint reuse (zero-network): 3-day-old % moves restated as fresh.
  findings.push(...storyFingerprintReuse(body, briefPath, briefDate));

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

  // 6b. TRUTH BYPASS accounting (added 2026-07-10). A missing truth file with critical claims on
  // board means the gate verified NOTHING — that state must be LOUD in every mode, and it must
  // BLOCK in --require-resolved mode. Unverified ≠ verified; an empty truth source is an
  // infrastructure failure, not a clean pass. (07-10 receipt: 6 market claims + 7 superlatives,
  // 0 pass / 0 fail / 13 unverified, truthFile null → published. Among them: the 30Y-JGB
  // superlative that was actually the 10Y's record — right number, wrong asset.)
  const truthBypass = !truth && (claims.length > 0 || superlatives.length > 0);
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
      truthBypass,
      unresolvedCritical: unverifiedCritical.length,
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
