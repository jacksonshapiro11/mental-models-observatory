#!/usr/bin/env node --experimental-strip-types
/**
 * Deterministic mechanical validator for daily briefs.
 *
 * Runs the Brief Validator's mechanical checks as code, not prompt. Exits
 * non-zero on any failure. The prompt-level Brief_Validator.md now only owns
 * the judgment-requiring checks (domain diversity, rehash, Discovery
 * independence, data-point dedup). Everything else is enforced here.
 *
 * Usage:
 *   node --experimental-strip-types scripts/validate-brief.ts daily-briefs/2026-04-14-v1.md
 *   node --experimental-strip-types scripts/validate-brief.ts content/daily-updates/2026-04-14.md
 *
 * Exit codes:
 *   0 — all mechanical checks pass
 *   1 — one or more checks failed (details printed)
 *   2 — usage error (file not found, etc.)
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
// Import READWISE_MODELS directly (avoiding lib/data.ts which uses extensionless imports
// incompatible with Node --experimental-strip-types). This is equivalent to calling
// getModelBySlug from lib/data.ts.
import { READWISE_MODELS, READWISE_DOMAINS } from '../lib/readwise-data.ts';
import { checkRepetition } from '../lib/repetition-check.ts';
import {
  extractDisplayDateFromLine,
  isDisplayDateLine,
  validateDisplayDateMatchesSlug,
} from '../lib/brief-date.ts';
function getModelBySlug(slug: string) {
  return READWISE_MODELS.find((m: any) => m.slug === slug);
}
// M2 (July 5): domain slug set for slug-type disambiguation
const DOMAIN_SLUGS = new Set((READWISE_DOMAINS as any[]).map((d: any) => d.slug));

type Failure = { check: string; message: string };

const REQUIRED_HEADERS = [
  '# ▸ THE DASHBOARD',
  '### Equities',
  '### Crypto',
  '### Commodities & Rates',
  '# ▸ THE SIX',
  '## Markets & Macro',
  '## Companies & Crypto',
  '## AI & Tech',
  '## Geopolitics',
  '## The Wild Card',
  '## The Signal',
  '# ▸ THE TAKE',
  '# ▸ INNER GAME',
  '# ▸ THE MODEL',
  '# ▸ DISCOVERY',
];

const BANNED_HEADERS = [
  '## Deep Read',
  '## Deep Listen',
  '# ▸ ASSET SPOTLIGHT',
  '## Watchlist Pulse (Internal)',
  '## Worldview Updates',
];

const BANNED_ORIENTATION_PHRASES = [
  'Most publications tell you what happened',
  'Markets, Meditations & Mental Models tells you what it means',
  'tells you what it means — in three layers',
];

function stripComments(src: string): string {
  // Remove HTML comment blocks (Staleness Ledger, Validation Report)
  // Convert DEPTH-TREATMENT markers to invisible zero-width-space tokens before stripping,
  // so checkSixBulletWordCeiling can still detect them without triggering em-dash or entity checks.
  const DT_TOKEN = '​depth_treatment​';
  let result = src.replace(/<!--\s*DEPTH-TREATMENT\s*-->/g, DT_TOKEN);
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  return result;
}

function extractDisplayDateFromHeader(body: string): string | null {
  for (const line of body.split('\n').slice(0, 25)) {
    const trimmed = line.trim();
    if (isDisplayDateLine(trimmed)) {
      return extractDisplayDateFromLine(trimmed);
    }
  }
  return null;
}

function checkDisplayDateMatchesSlug(body: string, briefDate: string): Failure[] {
  const displayDate = extractDisplayDateFromHeader(body);
  if (!displayDate) {
    return [{
      check: 'display-date-slug',
      message: `No display date line in brief header (expected **Weekday, Month D, YYYY** or ## Weekday, Month D, YYYY matching ${briefDate}).`,
    }];
  }
  const result = validateDisplayDateMatchesSlug(displayDate, briefDate);
  if (!result.ok) {
    return [{
      check: 'display-date-slug',
      message: result.message ?? `displayDate does not match slug ${briefDate}.`,
    }];
  }
  return [];
}

function checkHeaders(body: string): Failure[] {
  const out: Failure[] = [];
  for (const h of REQUIRED_HEADERS) {
    if (!body.includes(h)) {
      out.push({ check: 'headers', message: `Missing required header: ${h}` });
    }
  }
  for (const h of BANNED_HEADERS) {
    if (body.includes(h)) {
      out.push({ check: 'headers', message: `Banned header present: ${h}` });
    }
  }
  return out;
}

function checkOrientationBanned(body: string): Failure[] {
  const out: Failure[] = [];
  for (const phrase of BANNED_ORIENTATION_PHRASES) {
    if (body.includes(phrase)) {
      out.push({
        check: 'orientation-banned',
        message: `Orientation paragraph phrase detected: "${phrase}". Remove the entire orientation paragraph (banned April 13, 2026).`,
      });
    }
  }
  return out;
}

function checkEmDashesNotUsedAsCommaReplacement(body: string): Failure[] {
  // Voice rule: em-dashes (—) are allowed, but triple em-dashes in a single
  // sentence often indicate Claude-voice drift. We don't reject, but flag.
  // Kept minimal — the Editor does nuanced voice work.
  return [];
}

function extractModelSection(body: string): string | null {
  const start = body.indexOf('# ▸ THE MODEL');
  const end = body.indexOf('# ▸ DISCOVERY');
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end);
}

function checkModelLink(body: string): Failure[] {
  const out: Failure[] = [];
  const section = extractModelSection(body);
  if (!section) {
    out.push({ check: 'model-link', message: 'Model section missing — cannot check link.' });
    return out;
  }
  const re = /\*\*\[→ Explore this model\]\(https:\/\/www\.cosmictrex\.com\/models\/([a-z0-9-]+)\)\*\*/;
  const m = section.match(re);
  if (!m) {
    out.push({
      check: 'model-link',
      message: 'Model section does not end with the required link. Expected `**[→ Explore this model](https://www.cosmictrex.com/models/{slug})**`.',
    });
    return out;
  }
  const slug = m[1];
  // M2 (July 5): slug-type disambiguation — reject domain slugs used as model slugs.
  // `information-theory-media-ecology` is a DOMAIN slug (lib/readwise-data.ts:259) that
  // false-PASSed when used in a model link. Domain slugs render on the website but are
  // not valid model identifiers.
  if (DOMAIN_SLUGS.has(slug)) {
    out.push({
      check: 'model-link-domain-slug',
      message: `Model link uses domain slug "${slug}" — this is a DOMAIN, not a MODEL. Use the specific model slug (e.g., the model's own slug from READWISE_MODELS, not its domainSlug). Domain slugs resolve on the website but are not valid model identifiers.`,
    });
    return out;
  }
  const model = getModelBySlug(slug);
  if (!model) {
    out.push({
      check: 'model-link',
      message: `Model slug "${slug}" does not resolve. getModelBySlug() returned undefined. Pick a slug from system/Model_Library.md — only catalogued slugs are valid.`,
    });
  }
  return out;
}

// MODEL RECENCY (added June 12 — Critic mandate #3, RC2. The June 12 v1 carried a Model slug
// published 5 days earlier; it reached v1 because a prose ledger was trusted. The validator is
// the layer that cannot be talked out of it.)
function checkModelRecency(body: string, briefDate: string): Failure[] {
  const out: Failure[] = [];
  const section = extractModelSection(body);
  if (!section) return out;
  const re = /\*\*\[→ Explore this model\]\(https:\/\/www\.cosmictrex\.com\/models\/([a-z0-9-]+)\)\*\*/;
  const m = section.match(re);
  if (!m) return out; // checkModelLink will catch this
  const slug = m[1];
  const dir = path.join(process.cwd(), 'content', 'daily-updates');
  if (!fs.existsSync(dir)) return out;

  // Resolve model to get concept name for name-based cooldown (M2, July 5)
  const resolvedModel = getModelBySlug(slug);
  const conceptName = resolvedModel ? (resolvedModel as any).name : null;

  // Compute cutoff: briefDate - 30 days (aligned to Brief_Architect.md's 30-day selection filter;
  // was 14 days, which let Stigmergy through at 21 days on June 14. E-MODEL-CONCEPT-REPEAT-02.)
  const bd = new Date(briefDate + 'T00:00:00Z');
  const cutoff = new Date(bd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const files = fs.readdirSync(dir).filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n));
  for (const f of files) {
    const d = f.slice(0, 10);
    if (d >= cutoffStr && d < briefDate) {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      // Original slug-based check
      if (content.includes(`/models/${slug}`)) {
        out.push({
          check: 'model-recency',
          message: `Model slug "${slug}" already published on ${d} (within 30 days). Hard fail — pick a different whitelist model.`,
        });
      }
      // M2 (July 5): concept-name cooldown — catches alias evasion.
      // Bateson's Double Bind re-surfaced at 17 days under slug `game-theory-strategic-interaction`;
      // the slug-only grep false-PASSed because the earlier publication used a different slug.
      // Now also grep for the model's concept NAME in the Model section of published briefs.
      if (conceptName && !content.includes(`/models/${slug}`)) {
        // Extract Model section from the published brief to check concept name
        const modelStart = content.indexOf('## 🧠 The Model');
        if (modelStart !== -1) {
          const modelEnd = content.indexOf('\n# ', modelStart + 1);
          const pubModelSection = modelEnd !== -1 ? content.slice(modelStart, modelEnd) : content.slice(modelStart);
          if (pubModelSection.includes(conceptName)) {
            out.push({
              check: 'model-recency-name',
              message: `Model concept "${conceptName}" (slug: "${slug}") appears by NAME in the Model section published on ${d} (within 30 days) — possible alias evasion. The same concept under a different slug still violates the 30-day cooldown.`,
            });
          }
        }
      }
    }
  }
  return out;
}

// AI & Tech minimum 2-bullet floor (added June 14 — E-AI-SECTION-THINNESS-01 🟡 Day 3.
// AI section shipped 1 bullet (162 words) on a weekend brief that should expand.
// The Architect is dark so no upstream layer enforces a minimum. RC6 load-shedding.)
function checkAISectionMinBullets(body: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('## AI & Tech');
  if (start === -1) return out;
  const rest = body.slice(start);
  const nextHeader = rest.indexOf('\n## ', 1);
  const section = nextHeader === -1 ? rest : rest.slice(0, nextHeader);
  // Count bold-lead bullets (lines starting with - **), same idiom as checkSixBulletWordCeiling
  const bullets = (section.match(/^- \*\*/gm) || []).length;
  if (bullets < 2) {
    out.push({
      check: 'ai-section-min-bullets',
      message: `AI & Tech has ${bullets} bullet(s); minimum is 2. RC6 load-shedding — expand coverage (a non-dominant-company second bullet) rather than compress to one.`,
    });
  }
  // AI two-bullet distinctness advisory (added June 15 — RC4, strengthens June-14 floor)
  if (bullets === 2) {
    const leads = (section.match(/^- \*\*(.+?)\*\*/gm) || []).map((s: string) => s.toLowerCase());
    if (leads.length === 2) {
      // Extract capitalized tokens (proper nouns) from each lead, excluding common stopwords
      const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'it', 'its', 'as', 'that', 'this', 'how', 'why', 'what', 'when', 'where', 'who', 'which', 'not', 'no', 'new', 'just', 'now', 'out', 'up', 'all']);
      const extractEntities = (s: string) => {
        const raw = s.replace(/^- \*\*/, '').replace(/\*\*.*/, '');
        return raw.split(/\s+/).filter((w: string) => w.length > 2 && /^[A-Z]/.test(w) && !stopwords.has(w.toLowerCase())).map((w: string) => w.toLowerCase().replace(/[^a-z]/g, ''));
      };
      const e1 = new Set(extractEntities(leads[0]));
      const e2 = new Set(extractEntities(leads[1]));
      const shared = [...e1].filter((w: string) => e2.has(w));
      if (shared.length >= 1) {
        out.push({
          check: 'ai-two-bullet-same-entity',
          message: `AI & Tech's 2 bullets appear to share a primary entity (${shared.join(', ')}) — likely one story split in two (RC4). Confirm distinct stories or give bullet 2 a different development. Advisory.`,
        });
      }
    }
  }
  return out;
}

function checkCandCBalance(body: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('## Companies & Crypto');
  if (start === -1) return out;
  // Slice until the next ## header
  const rest = body.slice(start + 1);
  const nextHeader = rest.search(/\n## /);
  const section = nextHeader === -1 ? rest : rest.slice(0, nextHeader);
  const bullets = section.split('\n').filter((l) => /^\s*[-*]\s/.test(l));
  if (bullets.length < 2) {
    out.push({
      check: 'candc-balance',
      message: `Companies & Crypto has ${bullets.length} bullet(s). Minimum 2 (≥1 company, ≥1 crypto).`,
    });
  }
  return out;
}

function checkDashboardNoTables(body: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('# ▸ THE DASHBOARD');
  const end = body.indexOf('# ▸ THE SIX');
  if (start === -1 || end === -1) return out;
  const section = body.slice(start, end);
  // Detect markdown tables: consecutive lines starting with | and containing header separator
  const lines = section.split('\n');
  let pipedLines = 0;
  for (const l of lines) {
    if (/^\|.*\|/.test(l.trim())) pipedLines++;
  }
  if (pipedLines >= 2) {
    out.push({
      check: 'dashboard-no-tables',
      message: `Dashboard appears to contain a table (${pipedLines} pipe-delimited lines). Dashboard must be commentary-only.`,
    });
  }
  // Bracket placeholder detection
  if (/\*\[.+?\]\*/.test(section)) {
    out.push({
      check: 'dashboard-no-placeholders',
      message: 'Dashboard contains bracket-placeholder text (e.g. *[Dashboard component renders ...]*). Strip before publish.',
    });
  }
  return out;
}

function checkInnerGameStructure(body: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('# ▸ INNER GAME');
  const end = body.indexOf('# ▸ THE MODEL');
  if (start === -1 || end === -1) return out;
  const section = body.slice(start, end);

  // Get non-empty content lines after the header, in order.
  const lines = section.split('\n').map((l) => l.trim());
  const headerIdx = lines.findIndex((l) => l === '# ▸ INNER GAME');
  const content = lines
    .slice(headerIdx + 1)
    .filter((l) => l.length > 0);

  // QUOTE-FIRST, ALWAYS (Jackson, 2026-07-06 — RESCINDS the April 29 multi-form
  // validation and the June 12 A-E taxonomy). The 2026-07-06 brief shipped an
  // Observation-First Inner Game with no quote — legal under the five-form policy,
  // which Jackson has overruled: "Inner game should always be in the same quote form
  // then analysis." The Generator's fixed structure (April 13) is again the only form:
  //   Line 1 = italicized quote *"..."*    Line 2 = — Author attribution
  const quoteLineRe = /^\*["“][^"”]+["”]\*$/;
  // Allow italicized work titles, parenthetical dates, commas, apostrophes in attribution.
  const attributionLineRe = /^—\s+[A-Z].+$/;
  const hasAction = /\*\*Today's (practice|action)[:\*]?/i.test(section);

  const line1 = content[0] ?? '';
  const line2 = content[1] ?? '';

  if (!quoteLineRe.test(line1)) {
    out.push({
      check: 'inner-game',
      message: `Inner Game must open QUOTE-FIRST (fixed form — the five-form taxonomy was rescinded 2026-07-06): Line 1 must be an italicized quote (*"..."*). Got: ${JSON.stringify(line1.slice(0, 120))}`,
    });
  }

  if (!attributionLineRe.test(line2)) {
    out.push({
      check: 'inner-game',
      message: `Inner Game Line 2 must be the quote's attribution (— Author). Got: ${JSON.stringify(line2.slice(0, 120))}`,
    });
  }

  if (!hasAction) {
    out.push({
      check: 'inner-game',
      message: "Inner Game missing bold action line (**Today's practice:** or **Today's action:**).",
    });
  }

  return out;
}

// ─── Inner Game concept reuse (added 2026-07-06, Jackson) ───────────────────
// "Desire paths" shipped as the 2026-07-06 Inner Game on its FOURTH appearance
// (2026-03-18, 04-16, 06-14). The cooldowns check quote SOURCES (30d) and
// recommendation DOMAINS — nothing checked concept identity against history.
// Mechanical test: distinctive repeated phrases from today's Inner Game must not
// be load-bearing in any prior published brief. A phrase is "load-bearing" when
// it appears 2+ times on both sides — rare enough to avoid stopword collisions.
const IG_STOPWORDS = new Set(['the','a','an','and','or','but','of','to','in','on','for','with','that','this','your','you','it','is','are','was','were','be','not','have','has','they','them','their','its','as','at','by','from','into','than','then','when','where','what','who','how','all','one','own','same','more','most','other','some','can','will','just','do','does','did','no','yes','we','our','us','again','over','under','out','up','down','off','about','because','so','if','any','every','each','both','very','too','only','never','always','keep','keeps','kept'])

function distinctivePhrases(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n);
      // Require every word to be a content word and the phrase to be substantial.
      if (gram.some(w => IG_STOPWORDS.has(w) || w.length < 3)) continue;
      const phrase = gram.join(' ');
      if (phrase.length < 9) continue;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([ph]) => ph);
}

function checkInnerGameConceptReuse(body: string, briefPath: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('# \u25b8 INNER GAME');
  const end = body.indexOf('# \u25b8 THE MODEL');
  if (start === -1 || end === -1) return out;
  const section = body.slice(start, end);
  const phrases = distinctivePhrases(section);
  if (phrases.length === 0) return out;

  const archiveDir = path.join(process.cwd(), 'content/daily-updates');
  if (!fs.existsSync(archiveDir)) return out;
  const selfDate = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  const priorFiles = fs.readdirSync(archiveDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && !f.startsWith(selfDate));

  // Two-pass with a CORPUS-RARITY gate (calibrated 2026-07-06 on real data):
  // a CONCEPT concentrates in few briefs ("desire paths": 3 briefs, 7x in one);
  // VOCABULARY scatters across many ("open question": all over the corpus).
  // Only rare phrases (present in <=4 prior briefs) can trigger, and the prior
  // use must be load-bearing (2+ occurrences somewhere in that brief).
  const presence = new Map<string, string[]>();          // phrase -> briefs containing it
  const loadBearing = new Map<string, [string, number]>(); // phrase -> [brief, hits]
  for (const f of priorFiles) {
    let txt: string;
    try { txt = fs.readFileSync(path.join(archiveDir, f), 'utf8').toLowerCase(); } catch { continue; }
    for (const phrase of phrases) {
      const hits = txt.split(phrase).length - 1;
      if (hits >= 1) (presence.get(phrase) ?? presence.set(phrase, []).get(phrase)!).push(f);
      if (hits >= 2 && !loadBearing.has(phrase)) loadBearing.set(phrase, [f, hits]);
    }
  }
  for (const phrase of phrases) {
    const inBriefs = presence.get(phrase) ?? [];
    if (inBriefs.length === 0 || inBriefs.length > 4) continue; // never seen, or common vocabulary
    const lb = loadBearing.get(phrase);
    if (!lb) continue;
    out.push({
      check: 'inner-game-concept-reuse',
      message: `Inner Game concept appears recycled: "${phrase}" is load-bearing here AND was a treatment in prior brief ${lb[0]} (${lb[1]}x; present in ${inBriefs.length} prior brief(s): ${inBriefs.join(', ')}). The concept must be NEW to the corpus — pick another (worked failure: "desire paths" shipped as the 2026-07-06 Inner Game on its 4th appearance).`,
    });
  }
  return out;
}

function checkInnerGameWordBudget(body: string): Failure[] {
  // Editor Gate 6 — Inner Game body budget ≤350 words.
  // Re-hardened to the mechanical layer June 14, 2026: the June 12 Editor compression
  // turned the old parsed `INNER GAME BUDGET: X/350` declaration into a read-only
  // judgment check, leaving the budget with no deterministic enforcement. This restores
  // it as a count so it cannot be re-softened by prose drift. Quote + attribution lines
  // are excluded so only the prose body counts (matches the Editor's "Body" definition).
  const out: Failure[] = [];
  const start = body.indexOf('# ▸ INNER GAME');
  const end = body.indexOf('# ▸ THE MODEL');
  if (start === -1 || end === -1) return out; // section absent — checkInnerGameStructure reports it
  const section = body.slice(start, end);

  const quoteLineRe = /^\*["“][^"”]+["”]\*$/;
  const attributionLineRe = /^—\s+[A-Z].+$/;

  const lines = section.split('\n').map((l) => l.trim());
  const headerIdx = lines.findIndex((l) => l === '# ▸ INNER GAME');
  const bodyWords = lines
    .slice(headerIdx + 1)
    .filter((l) => l.length > 0 && !quoteLineRe.test(l) && !attributionLineRe.test(l))
    .join(' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const CEILING = 350;
  const HARD_FAIL = 450;
  if (bodyWords > HARD_FAIL) {
    out.push({
      check: 'inner-game-word-budget',
      message: `🔴 HARD FAIL: Inner Game body is ${bodyWords} words (ceiling: ${CEILING}, hard fail: ${HARD_FAIL}). Compress to ≤${CEILING}.`,
    });
  } else if (bodyWords > CEILING) {
    out.push({
      check: 'inner-game-word-budget',
      message: `🟡 FLAG: Inner Game body is ${bodyWords} words (ceiling: ${CEILING}). Compress if possible.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Additional mechanical checks (added April 13, 2026 — tiering pass).
// These migrated from prose to code because prose-layer enforcement missed
// them repeatedly. Each corresponds to a prior Editor check.
// ---------------------------------------------------------------------------

function checkEmDashes(body: string): Failure[] {
  // Editor Check 16d — zero-tolerance em-dash policy.
  // Match U+2014 (—) and literal `--` outside of code blocks.
  // We strip fenced code blocks to avoid flagging markdown table separators
  // or pre-formatted content.
  const stripped = body.replace(/```[\s\S]*?```/g, '');
  const out: Failure[] = [];
  const lines = stripped.split('\n');
  const hits: { line: number; text: string }[] = [];
  lines.forEach((l, i) => {
    if (/[\u2014]/.test(l) || /(?<!-)--(?!-)/.test(l)) {
      // Skip lines that are pure attribution for the Inner Game (start with `— `)
      if (/^—\s+[A-Z]/.test(l.trim())) return;
      // Skip horizontal rule lines
      if (/^-{3,}$/.test(l.trim())) return;
      hits.push({ line: i + 1, text: l.trim().slice(0, 160) });
    }
  });
  if (hits.length > 0) {
    const sample = hits.slice(0, 5).map((h) => `L${h.line}: ${h.text}`).join('\n    ');
    out.push({
      check: 'em-dash',
      message: `Em-dash usage detected (${hits.length} line(s)). Zero-tolerance rule. Replace with period+sentence, comma, or restructure.\n    ${sample}${hits.length > 5 ? `\n    ... +${hits.length - 5} more` : ''}`,
    });
  }
  return out;
}

const HYPE_PHRASES = [
  'buckle up',
  'strap in',
  'game-changer',
  'game changer',
  "here's where it gets wild",
  'here is where it gets wild',
  'this is huge',
  'to the moon',
  'mind-blowing',
  'crushing it',
  'absolute unit',
];

function checkHypePhrases(body: string): Failure[] {
  const out: Failure[] = [];
  const lower = body.toLowerCase();
  const hits = HYPE_PHRASES.filter((p) => lower.includes(p));
  if (hits.length > 0) {
    out.push({
      check: 'hype-phrases',
      message: `Hype phrases detected: ${hits.map((h) => `"${h}"`).join(', ')}. These are banned per Editor Check 16b.`,
    });
  }
  return out;
}

function checkInternalTagLeak(body: string): Failure[] {
  // Editor output rule + Morning Updater Step 6: internal pipeline annotations
  // must never reach the published file.
  const patterns: { name: string; re: RegExp }[] = [
    { name: 'EDITOR tag', re: /\[EDITOR:[^\]]*\]/ },
    { name: 'CRITIC tag', re: /\[CRITIC:[^\]]*\]/ },
    { name: 'QA tag', re: /\[QA:[^\]]*\]/ },
    { name: 'INTERNAL tag', re: /\[INTERNAL:[^\]]*\]/ },
    { name: 'VERIFIED tag', re: /\[VERIFIED:[^\]]*\]/ },
    { name: 'MODEL SELECTION declaration', re: /^MODEL SELECTION:/m },
    { name: 'INNER GAME STRUCTURE declaration', re: /^INNER GAME STRUCTURE:/m },
  ];
  const out: Failure[] = [];
  for (const p of patterns) {
    const m = body.match(p.re);
    if (m) {
      out.push({
        check: 'internal-tag-leak',
        message: `${p.name} present in brief. Strip before publish (should have been caught at Editor output or Morning Updater Step 6). Match: ${JSON.stringify(m[0].slice(0, 120))}`,
      });
    }
  }
  return out;
}

function checkAnchorLinks(body: string): Failure[] {
  // Editor Check 6 — anchor links must resolve.
  // Collect all heading slugs (GitHub-style: lowercase, spaces->dashes, strip punctuation)
  const out: Failure[] = [];
  const headings = body.match(/^#{1,6}\s+.+$/gm) ?? [];
  const slugSet = new Set<string>();
  for (const h of headings) {
    const txt = h.replace(/^#{1,6}\s+/, '').trim();
    const slug = txt
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) slugSet.add(slug);
  }
  // Also allow short well-known anchors used by the site renderer.
  // GitHub slugifies "Markets & Macro" → "markets--macro" (ampersand dropped,
  // spaces around it become double-dash). Site renderer mirrors this.
  const knownAnchors = [
    'dashboard', 'the-six', 'the-take', 'inner-game', 'the-model', 'discovery',
    'markets--macro', 'companies--crypto', 'ai--tech', 'geopolitics',
    'the-wild-card', 'the-signal',
  ];
  for (const a of knownAnchors) slugSet.add(a);

  const linkRe = /\]\(#([a-z0-9-]+)\)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(body)) !== null) {
    const target = m[1];
    if (!slugSet.has(target) && !seen.has(target)) {
      seen.add(target);
      out.push({
        check: 'anchor-link',
        message: `Anchor link [...](#${target}) has no matching heading in the brief.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// NEW MECHANICAL CHECKS — added April 20, 2026
// These close the 6 structural gaps Jackson identified. They enforce rules
// that previously existed only as prose with judgment exemptions that got
// rationalized away (RC4 pattern). Now they're code. Code doesn't rationalize.
// ---------------------------------------------------------------------------

/**
 * Extract Six subsection bullets as { section, leadEntity, leadSentence }[].
 * A "lead entity" is the bold text at the start of each bullet.
 */
function extractSixBullets(body: string): { section: string; leadSentence: string; boldLead: string }[] {
  const sixStart = body.indexOf('# ▸ THE SIX');
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  if (sixStart === -1 || sixEnd === -1) return [];
  const sixBody = body.slice(sixStart, sixEnd);

  const results: { section: string; leadSentence: string; boldLead: string }[] = [];
  let currentSection = '';

  for (const line of sixBody.split('\n')) {
    // Track current subsection
    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }
    // Match bullets with bold leads: - **bold text...**
    const bulletMatch = line.match(/^- \*\*(.+?)\*\*/);
    if (bulletMatch && currentSection) {
      results.push({
        section: currentSection,
        leadSentence: bulletMatch[1],
        boldLead: bulletMatch[1],
      });
    }
  }
  return results;
}

/**
 * Check 3c2-CODE: Entity Lead Single-Home.
 * No entity name may appear as a lead (in bold opening) of bullets in 2+ Six subsections.
 * The "different analytical angle" defense is dead. Same entity, two subsections = FAIL.
 */
function checkEntityLeadSingleHome(body: string): Failure[] {
  const out: Failure[] = [];
  const bullets = extractSixBullets(body);

  // Extract lead entity: first proper noun / capitalized multi-word name from bold lead
  // Heuristic: find capitalized words/phrases that look like entity names
  const entityPattern = /\b([A-Z][a-zA-Z&']+(?:\s+[A-Z][a-zA-Z&']+){0,3})\b/g;

  // Map entity → set of sections it leads in
  const entitySections: Map<string, Set<string>> = new Map();

  // Skip generic words, geopolitical terms that naturally cross sections (topics, not entities),
  // days/months, sentence starters, and analyst names (people aren't "entities" in this check —
  // the check targets companies, protocols, assets, and organizations).
  const SKIP_WORDS = new Set([
    'The', 'A', 'An', 'If', 'When', 'But', 'And', 'Or', 'This', 'That', 'Its', 'For',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
    'What', 'Why', 'How', 'Where', 'Who', 'Not', 'More', 'Most', 'After', 'Before',
    // Geopolitical topics — these naturally appear across M&M and Geopolitics.
    // Entity dedup targets SPECIFIC entities (companies, protocols, people-as-subjects),
    // not broad geopolitical topics. Topic saturation is checked by Check 3a.
    'Iran', 'Iraq', 'China', 'Russia', 'Ukraine', 'Israel', 'Gaza', 'Taiwan',
    'Trump', 'Biden', 'Putin', 'Zelensky', 'Vance',
    'NATO', 'OPEC', 'American', 'European', 'Gulf', 'Asian', 'Round',
    'Congress', 'Pentagon', 'Treasury', 'Fed', 'White House',
    // Generic financial/descriptive terms
    'Wall Street', 'Main Street', 'Scientists', 'Earnings',
    // Analyst names (tracked by source dedup, not entity dedup)
    'Goldman Sachs', 'Charlie Bilello', 'Peter Zeihan', 'Brad Setser',
    'Luke Gromen', 'Ryan Cummings', 'Robin Brooks', 'Jim Bianco',
    'Stanford', 'MIT', 'Harvard',
    'Philadelphia', 'Washington',
  ]);

  for (const b of bullets) {
    const matches = b.boldLead.matchAll(entityPattern);
    for (const m of matches) {
      const entity = m[1];
      if (SKIP_WORDS.has(entity)) continue;
      // Only track 3+ char entities
      if (entity.length < 3) continue;
      if (!entitySections.has(entity)) entitySections.set(entity, new Set());
      entitySections.get(entity)!.add(b.section);
    }
  }

  for (const [entity, sections] of entitySections) {
    if (sections.size >= 2) {
      out.push({
        check: 'entity-lead-single-home',
        message: `Entity "${entity}" leads bullets in ${sections.size} subsections: ${[...sections].join(', ')}. Each entity may lead bullets in only ONE subsection. The "different angle" defense is not valid. Merge into best-fit section and replace the other slot.`,
      });
    }
  }
  return out;
}

/**
 * Check 3c2b-CODE: Event Lead Single-Home.
 * No specific event may lead (be the bold opening of) bullets in 2+ sections.
 * Detects shared event phrases across section leads.
 */
function checkEventLeadSingleHome(body: string): Failure[] {
  const out: Failure[] = [];
  const bullets = extractSixBullets(body);

  // Also check The Take opening and Signal items
  const takeStart = body.indexOf('# ▸ THE TAKE');
  const takeEnd = body.indexOf('# ▸ INNER GAME');
  const signalStart = body.indexOf('## The Signal');
  const signalEnd = body.indexOf('---', signalStart > -1 ? signalStart + 1 : 0);

  // Extract key event phrases from bold leads (3+ word sequences)
  // Compare all pairs of section leads for shared event descriptions
  interface LeadItem { section: string; text: string }
  const allLeads: LeadItem[] = bullets.map(b => ({ section: b.section, text: b.boldLead.toLowerCase() }));

  // Add Signal items
  if (signalStart !== -1) {
    const sigBody = body.slice(signalStart, signalEnd > signalStart ? signalEnd : undefined);
    const sigBolds = sigBody.matchAll(/\*\*(.+?)\*\*/g);
    let sigIdx = 1;
    for (const m of sigBolds) {
      allLeads.push({ section: `Signal ${sigIdx}`, text: m[1].toLowerCase() });
      sigIdx++;
    }
  }

  // Check for shared event phrases (4+ word overlapping sequences) across different sections
  for (let i = 0; i < allLeads.length; i++) {
    for (let j = i + 1; j < allLeads.length; j++) {
      if (allLeads[i].section === allLeads[j].section) continue;
      // Find shared 4-grams
      const words_i = allLeads[i].text.split(/\s+/);
      const words_j = allLeads[j].text.split(/\s+/);
      const ngrams_i = new Set<string>();
      for (let k = 0; k <= words_i.length - 4; k++) {
        ngrams_i.add(words_i.slice(k, k + 4).join(' '));
      }
      for (let k = 0; k <= words_j.length - 4; k++) {
        const ngram = words_j.slice(k, k + 4).join(' ');
        if (ngrams_i.has(ngram)) {
          out.push({
            check: 'event-lead-single-home',
            message: `Shared event phrase "${ngram}" found in leads of "${allLeads[i].section}" and "${allLeads[j].section}". Each event gets ONE home section. The other section must lead with a different event or structural angle.`,
          });
          // Only report first shared phrase per pair
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Check 4b-CODE: Take Counter-Case Percentage.
 * Counter-case must be ≥30% of total Take words.
 * No more relying on prose-layer measurement that erodes.
 */
function checkTakeCounterCase(body: string): Failure[] {
  const out: Failure[] = [];
  const takeStart = body.indexOf('# ▸ THE TAKE');
  const takeEnd = body.indexOf('# ▸ INNER GAME');
  if (takeStart === -1 || takeEnd === -1) return out;

  const takeBody = body.slice(takeStart, takeEnd);
  const totalWords = takeBody.split(/\s+/).filter(w => w.length > 0).length;

  // Find counter-case section: "Where this might be wrong" or "Where this breaks" or similar
  const counterHeaders = [
    'where this might be wrong',
    'where this breaks',
    'where this could be wrong',
    'the counter-case',
    'counter-case',
    'what could go wrong',
  ];

  let counterStart = -1;
  const takeLower = takeBody.toLowerCase();
  for (const h of counterHeaders) {
    const idx = takeLower.indexOf(h);
    if (idx !== -1) {
      counterStart = idx;
      break;
    }
  }

  if (counterStart === -1) {
    out.push({
      check: 'take-counter-case',
      message: `No counter-case section found in The Take. Look for "Where this might be wrong" or equivalent header. Counter-case is mandatory and must be ≥30% of total Take words.`,
    });
    return out;
  }

  const counterBody = takeBody.slice(counterStart);
  const counterWords = counterBody.split(/\s+/).filter(w => w.length > 0).length;
  const pct = (counterWords / totalWords * 100).toFixed(1);

  if (counterWords / totalWords < 0.30) {
    out.push({
      check: 'take-counter-case',
      message: `Take counter-case is ${pct}% (${counterWords}/${totalWords} words). Minimum is 30%. EXPAND the counter-case with additional evidence for the opposing view, a second falsification test, or expansion of existing reasoning. Do NOT shrink the main Take to hit the ratio.`,
    });
  }
  return out;
}

/**
 * Check 14g-CODE: Signal Staleness vs Yesterday's Published Brief.
 * Compares Signal items in the current brief against yesterday's published brief.
 * Requires access to the content/daily-updates/ directory.
 */
// --- Signal named investable entities (June 16, 2026; settled ≥1 June 18) ---
// Every Signal must name at least one investable entity (ticker/company/ETF) so the reader knows
// who's exposed. Floor is ≥1, full stop (Jackson June 18: "one is fine, they're investable concepts").
// The original ≥2 idea was dropped — it over-failed every brief, and the validator has no advisory
// channel (every pushed failure exits non-zero).
// The consistent Earns-Space→Essential gap in Signal is "structural story, no named company."
function checkSignalNamedEntities(body: string): Failure[] {
  const out: Failure[] = [];
  const start = body.indexOf('## The Signal');
  if (start === -1) return out;
  const rest = body.slice(start);
  const nextSection = rest.indexOf('\n---', 1);
  const section = nextSection === -1 ? rest.slice(0, 3000) : rest.slice(0, nextSection);
  // Split into individual Signal items by bold-lead pattern (**bold opener at start of line or - **)
  const bulletMatches = section.split(/(?=^(?:- )?\*\*[A-Z])/m).filter(b => /^(?:- )?\*\*[A-Z]/.test(b));
  for (let i = 0; i < bulletMatches.length; i++) {
    const bullet = bulletMatches[i];
    // Count distinct capitalized tickers (1-5 uppercase letters) and proper-noun company names
    const stopwords = new Set(['the', 'signal', 'six', 'take', 'model', 'inner', 'game', 'discovery', 'wild', 'card', 'dashboard', 'markets', 'macro', 'companies', 'crypto', 'geopolitics', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'essential', 'bloomberg', 'reuters', 'then', 'when', 'what', 'this', 'that', 'these', 'those', 'their', 'there', 'here', 'more', 'most', 'some', 'first', 'second', 'third', 'last', 'next', 'both', 'each', 'every', 'other', 'another', 'between', 'from', 'into', 'over', 'under', 'after', 'before', 'since', 'until', 'while', 'with', 'about', 'against', 'during']);
    // Match tickers (2-5 uppercase) and proper nouns (capitalized words not at sentence start after ". ")
    const tickerPattern = /\b[A-Z]{2,5}\b/g;
    const tickers = new Set<string>();
    let m;
    while ((m = tickerPattern.exec(bullet)) !== null) {
      const t = m[0];
      if (!stopwords.has(t.toLowerCase()) && !/^(GDP|CPI|PCE|PPI|PMI|ETF|IPO|DPO|SEC|FDA|FCC|BOJ|ECB|IMF|NATO|FOMC|OPEC|NYSE|USDA|BTC|ETH|SOL|USD|EUR|GBP|JPY|CNY|API|CEO|CFO|COO|CTO|AI|US|UK|EU|G7|Q[1-4]|MT|MW|GW|TWh|ARPU|CLO|CRE|REIT|DeFi|LME|COMEX|DRC|EV|EVs|COVID|OECD|WTO|WHO|UN|ESG|PE|VC|YoY|MoM|QoQ|YTD|IPOs|SPR|CAGR|TAM|SAM|SOM|EBITDA|P\/E|EPS|ROE|ROA|ROIC|R&D|M&A|EM|DM|CMBS|ABS|MBS|SOFR|OTC|OIS|YCC|QE|QT|ISM|WTI|NYMEX|ICE|TTM|URA|SMR|NRC|DOE|EPA|FTC|CFPB|IRS|FDIC|OCC|DOJ|GAO|CBO|NSA|DEA|CBP|ICB|IEA|EBRD|ADB|AIIB|IMO|ICC|CAB|BIS|PBOC|RBI|RBA|BOE|SNB|RBNZ|BOC|CBR|SAMA|BRICS)$/.test(t)) {
        tickers.add(t);
      }
    }
    if (tickers.size < 1) {
      out.push({
        check: 'signal-missing-named-investable',
        message: `Signal item ${i + 1} names no investable entity (found: none) — name at least one ticker/company/ETF (who's exposed). Hard fail.`,
      });
    }
  }
  return out;
}

// --- Deterministic ledger-truth check (June 17, 2026) ---
// E-WRITER-LEDGER-INTEGRITY-01 🔴: Writer fabricated "no take-draft existed" on 06-12, 06-13, 06-17 (4th+).
// Prose-integrity rules don't constrain the fabrication. This mechanical check catches it.
function checkLedgerTruth(body: string, briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];

  // Component draft types to check
  const components = ['take', 'signal', 'discovery', 'cc-predraft'];
  const lower = body.toLowerCase();

  for (const comp of components) {
    // Check for absence claims in the brief/ledger text
    const absencePatterns = [
      new RegExp(`no\\s+${comp}[- ]?draft`, 'i'),
      new RegExp(`${comp}[- ]?draft\\s+absent`, 'i'),
      new RegExp(`${comp}[- ]?draft\\s+did\\s+not\\s+exist`, 'i'),
      new RegExp(`${comp}[- ]?draft\\s+not\\s+found`, 'i'),
    ];
    const claimsAbsent = absencePatterns.some(p => p.test(body));
    if (claimsAbsent) {
      const draftPath = path.join(briefDir, `${bd}-${comp}-draft.md`);
      if (fs.existsSync(draftPath)) {
        const stats = fs.statSync(draftPath);
        out.push({
          check: 'ledger-fabrication',
          message: `Brief claims no ${comp}-draft existed but daily-briefs/${bd}-${comp}-draft.md is on disk (${stats.size} bytes) — E-WRITER-LEDGER-INTEGRITY-01, 4th+ occurrence. Use the real draft.`,
        });
      }
    }
  }
  return out;
}

function checkSignalStaleness(body: string, briefDir: string, absPathForSignal: string): Failure[] {
  const out: Failure[] = [];

  // Find yesterday's published brief.
  // The brief being validated is for BRIEF_DATE (extracted from filename).
  // Yesterday = the most recent published file with a date BEFORE the brief's date.
  const publishedDir = path.join(briefDir, '..', 'content', 'daily-updates');
  if (!fs.existsSync(publishedDir)) return out; // Can't check without published briefs

  // Extract brief date from the file being validated
  const briefDateMatch = path.basename(absPathForSignal).match(/(\d{4}-\d{2}-\d{2})/);
  const briefDate = briefDateMatch ? briefDateMatch[1] : '';

  const publishedFiles = fs.readdirSync(publishedDir)
    .filter(f => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();
  if (publishedFiles.length === 0) return out;

  // Find the most recent published brief BEFORE this brief's date
  let yesterdayFilename = '';
  for (const f of publishedFiles) {
    const fDate = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
    if (fDate && fDate < briefDate) {
      yesterdayFilename = f;
      break;
    }
  }
  if (!yesterdayFilename) {
    // Fallback: if no date extracted, use second most recent
    if (publishedFiles.length >= 2) yesterdayFilename = publishedFiles[1];
    else return out;
  }

  const yesterdayFile = path.join(publishedDir, yesterdayFilename);
  const yesterdayBody = stripComments(fs.readFileSync(yesterdayFile, 'utf8'));

  // Extract Signal content from yesterday
  const yesterdaySignalStart = yesterdayBody.indexOf('## The Signal');
  if (yesterdaySignalStart === -1) return out;
  // Signal ends at the next --- or # header
  const yesterdaySignalEnd = yesterdayBody.indexOf('\n---', yesterdaySignalStart + 1);
  const yesterdaySignal = yesterdayBody.slice(
    yesterdaySignalStart,
    yesterdaySignalEnd > -1 ? yesterdaySignalEnd : yesterdaySignalStart + 3000
  ).toLowerCase();

  // Extract Signal content from today
  const todaySignalStart = body.indexOf('## The Signal');
  if (todaySignalStart === -1) return out;
  const todaySignalEnd = body.indexOf('\n---', todaySignalStart + 1);
  const todaySignal = body.slice(
    todaySignalStart,
    todaySignalEnd > -1 ? todaySignalEnd : todaySignalStart + 3000
  ).toLowerCase();

  // Extract bold leads from both
  const extractBolds = (text: string): string[] => {
    const matches = text.matchAll(/\*\*(.+?)\*\*/g);
    return [...matches].map(m => m[1]);
  };

  const yesterdayBolds = extractBolds(yesterdaySignal);
  const todayBolds = extractBolds(todaySignal);

  // Also check yesterday's full Six section for Signal topic overlap
  const yesterdaySixStart = yesterdayBody.indexOf('# ▸ THE SIX');
  const yesterdaySixEnd = yesterdayBody.indexOf('# ▸ THE TAKE');
  const yesterdaySix = yesterdaySixStart > -1 && yesterdaySixEnd > -1
    ? yesterdayBody.slice(yesterdaySixStart, yesterdaySixEnd).toLowerCase()
    : '';

  // Check for shared 3-word sequences between today's Signal and yesterday's Signal
  for (const todayBold of todayBolds) {
    const todayWords = todayBold.split(/\s+/);
    for (const yBold of yesterdayBolds) {
      const yWords = yBold.split(/\s+/);
      const yNgrams = new Set<string>();
      for (let k = 0; k <= yWords.length - 3; k++) {
        yNgrams.add(yWords.slice(k, k + 3).join(' '));
      }
      for (let k = 0; k <= todayWords.length - 3; k++) {
        const ngram = todayWords.slice(k, k + 3).join(' ');
        if (yNgrams.has(ngram)) {
          out.push({
            check: 'signal-staleness',
            message: `Signal topic overlap with yesterday's published brief (${yesterdayFilename}). Shared phrase: "${ngram}". Today's Signal must cover topics NOT in yesterday's Signals. Replace with a Signal from a different domain.`,
          });
          break;
        }
      }
    }
  }

  // Check today's Signal leads against yesterday's Six section (any subsection)
  for (const todayBold of todayBolds) {
    const todayWords = todayBold.split(/\s+/);
    // Look for key topic words from today's Signal in yesterday's Six
    const keyWords = todayWords.filter(w =>
      w.length > 4 &&
      !['which', 'their', 'about', 'these', 'those', 'would', 'could', 'should',
        'after', 'before', 'between', 'under', 'through', 'global', 'percent',
        'billion', 'million', 'market', 'trade',
      ].includes(w)
    );
    // If 6+ key topic words from a Signal bold also appear in yesterday's Six, flag
    // (threshold raised from 4 to 6 to reduce false positives from generic financial vocabulary)
    const matchCount = keyWords.filter(w => yesterdaySix.includes(w)).length;
    if (matchCount >= 6 && keyWords.length > 0) {
      out.push({
        check: 'signal-staleness-vs-six',
        message: `Signal topic may overlap with yesterday's Six section. ${matchCount} key words from Signal lead "${todayBold.slice(0, 80)}..." found in yesterday's Six (${yesterdayFilename}). Verify this is a genuinely new signal, not yesterday's news in future tense.`,
      });
    }
  }

  return out;
}

/**
 * Check DASHBOARD-SENTENCE-CEILING: Each Dashboard sub-section ≤ 2 sentences.
 * This was prose-only with repeated violations (3rd consecutive brief exceeding).
 * Now it's code.
 */
function checkDashboardSentenceCeiling(body: string): Failure[] {
  const out: Failure[] = [];
  const dashStart = body.indexOf('# ▸ THE DASHBOARD');
  const dashEnd = body.indexOf('# ▸ THE SIX');
  if (dashStart === -1 || dashEnd === -1) return out;

  const dashBody = body.slice(dashStart, dashEnd);
  const subsections = ['### Equities', '### Crypto', '### Commodities & Rates'];

  for (let i = 0; i < subsections.length; i++) {
    const secStart = dashBody.indexOf(subsections[i]);
    if (secStart === -1) continue;
    const secEnd = i < subsections.length - 1
      ? dashBody.indexOf(subsections[i + 1], secStart)
      : dashBody.length;
    const secBody = dashBody.slice(secStart + subsections[i].length, secEnd > secStart ? secEnd : undefined);

    // Extract italic commentary (content between * markers)
    const italicMatch = secBody.match(/\*([^*]+)\*/);
    if (!italicMatch) continue;
    const commentary = italicMatch[1].trim();

    // Count sentences: protect abbreviations (D.R., U.S., decimals), then split on . ! ? followed by space or end
    const cleaned = commentary
      .replace(/\b([A-Z])\.([A-Z])\./g, '$1$2_ABBR')  // D.R. → DR_ABBR, U.S. → US_ABBR
      .replace(/\d+\.\d+/g, 'NUM_ABBR');               // 7,109.25 → NUM_ABBR
    const sentences = cleaned.split(/[.!?]+(?:\s|$)/).filter(s => s.trim().length > 0);
    if (sentences.length > 2) {
      out.push({
        check: 'dashboard-sentence-ceiling',
        message: `Dashboard "${subsections[i]}" has ${sentences.length} sentences (max 2). Compress to 2 regime-only sentences. Remove any WHY-analysis (geopolitical causation, event explanations) — that belongs in The Six.`,
      });
    }
  }
  return out;
}

/**
 * Check 16a-CODE: Wild Card Staleness vs Last 3 Published Briefs.
 * Compares Wild Card items in the current brief against the last 3 published briefs.
 * Wild Cards have a history of repeating from 1-3 days ago, so we check a wider window.
 * Requires access to the content/daily-updates/ directory.
 */
function checkWildCardStaleness(body: string, briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];

  // Find the Wild Card section
  const wcStart = body.indexOf('## The Wild Card');
  const wcEnd = body.indexOf('## The Signal');
  if (wcStart === -1 || wcEnd === -1 || wcEnd < wcStart) return out;
  const wildCardBody = body.slice(wcStart, wcEnd).toLowerCase();

  // Extract Wild Card item bold leads (the **...**  text at the start of each item)
  const extractBolds = (text: string): string[] => {
    const matches = text.matchAll(/\*\*(.+?)\*\*/g);
    return [...matches].map(m => m[1]);
  };
  const todayBolds = extractBolds(wildCardBody);
  if (todayBolds.length === 0) return out;

  // Access published briefs
  const publishedDir = path.join(briefDir, '..', 'content', 'daily-updates');
  if (!fs.existsSync(publishedDir)) return out;

  // Extract brief date from the file being validated
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  const briefDate = briefDateMatch ? briefDateMatch[1] : '';

  const publishedFiles = fs.readdirSync(publishedDir)
    .filter(f => f.endsWith('.md') && !f.includes('-light'))
    .sort()
    .reverse();
  if (publishedFiles.length === 0) return out;

  // Find the last 3 published briefs BEFORE this brief's date
  const recentBriefs: { filename: string; date: string }[] = [];
  for (const f of publishedFiles) {
    const fDate = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
    if (fDate && fDate < briefDate) {
      recentBriefs.push({ filename: f, date: fDate });
      // Expanded from 3 to 5 (June 13 — E-WILDCARD-RECENCY-01 🟡.
      // JWST 3I/ATLAS methane ran 06-06 and 06-11 — 3-brief window missed the 7-day-apart repeat)
      if (recentBriefs.length >= 5) break;
    }
  }
  if (recentBriefs.length === 0) return out;

  // For each recent brief, extract Wild Card section content
  const recentWildCards: { filename: string; content: string }[] = [];
  for (const brief of recentBriefs) {
    const briefPath = path.join(publishedDir, brief.filename);
    const briefContent = stripComments(fs.readFileSync(briefPath, 'utf8')).toLowerCase();
    const wcStartInBrief = briefContent.indexOf('## the wild card');
    if (wcStartInBrief === -1) continue;
    const wcEndInBrief = briefContent.indexOf('## the signal', wcStartInBrief);
    const wcSectionContent = briefContent.slice(
      wcStartInBrief,
      wcEndInBrief > -1 ? wcEndInBrief : wcStartInBrief + 3000
    );
    recentWildCards.push({ filename: brief.filename, content: wcSectionContent });
  }

  // For each today's Wild Card bold, extract significant keywords and check against recent briefs
  const commonWords = new Set([
    'which', 'their', 'about', 'these', 'those', 'would', 'could', 'should',
    'after', 'before', 'between', 'under', 'through', 'global', 'percent',
    'billion', 'million', 'market', 'scientists', 'researchers', 'system',
    'from', 'with', 'that', 'this', 'have', 'been', 'more', 'some', 'other',
    'being', 'most', 'what', 'than', 'only', 'just', 'also', 'new',
    'energy', 'using', 'device', 'devices', 'without', 'material', 'materials',
    'allows', 'first', 'single', 'found', 'discovery', 'finding', 'published',
    'entire', 'across', 'breaking', 'making', 'including', 'currently',
    'control', 'process', 'direct', 'directly', 'production', 'produce',
  ]);

  for (const todayBold of todayBolds) {
    const todayWords = todayBold.split(/\s+/);
    // Extract significant keywords: words >5 chars, not in common list
    const significantKeywords = todayWords.filter(w =>
      w.length > 5 &&
      !commonWords.has(w)
    );

    if (significantKeywords.length === 0) continue;

    // Check against each recent brief's Wild Card section
    for (const recentWc of recentWildCards) {
      const matchCount = significantKeywords.filter(w =>
        recentWc.content.includes(w)
      ).length;

      // If 6+ significant keywords match, it's likely a repeat
      // (raised from 5 to 6 to reduce false positives from generic science vocabulary)
      if (matchCount >= 6) {
        const truncated = todayBold.length > 80
          ? todayBold.slice(0, 80) + '...'
          : todayBold;
        out.push({
          check: 'wild-card-staleness',
          message: `Wild Card item may be a repeat from recent brief (${recentWc.filename}). ${matchCount} key words from Wild Card lead "${truncated}" found in that brief's Wild Card section. Wild Card items must not repeat within a 3-day window.`,
        });
        break; // Only report first match per today's item
      }
    }
  }

  // ENTITY KEYWORD CHECK (added June 13 — E-WILDCARD-RECENCY-01 🟡.
  // The JWST 3I/ATLAS methane item ran 06-06, 06-11, and reached v1 on 06-13
  // labeled BREAKING. Bold-lead matching didn't catch it because the lead text
  // differed across days. Entity matching catches the underlying subject.)
  const entityPattern = /\b(?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+|[A-Z]{2,}[\w-]*|\d[A-Z]\/[A-Z]+)\b/g;
  const extractEntities = (text: string): Set<string> => {
    const raw = text.match(entityPattern) || [];
    const genericEntities = new Set([
      'the', 'and', 'for', 'new', 'its', 'has', 'who', 'how',
      'wild card', 'breaking', 'signal', 'discovery',
    ]);
    return new Set(raw
      .filter(m => m.length >= 3 && !genericEntities.has(m.toLowerCase()))
      .map(m => m.toLowerCase()));
  };

  // Use the original (non-lowercased) Wild Card body for entity extraction
  const origWcBody = body.slice(wcStart, wcEnd);
  const todayEntities = extractEntities(origWcBody);

  for (const recentWC of recentWildCards) {
    // Read the original (non-lowercased) content for entity extraction
    const briefPath2 = path.join(publishedDir, recentBriefs.find(b =>
      recentWC.filename === b.filename)?.filename ?? '');
    let origRecentWc = recentWC.content; // fallback to lowercased
    try {
      const origContent = stripComments(fs.readFileSync(briefPath2, 'utf8'));
      const origWcStart = origContent.indexOf('## The Wild Card');
      const origWcEnd = origContent.indexOf('## The Signal', origWcStart > -1 ? origWcStart : 0);
      if (origWcStart > -1 && origWcEnd > origWcStart) {
        origRecentWc = origContent.slice(origWcStart, origWcEnd);
      }
    } catch { /* use fallback */ }

    const recentEntities = extractEntities(origRecentWc);
    const overlap = [...todayEntities].filter(e => recentEntities.has(e));
    if (overlap.length >= 2) {
      out.push({
        check: 'wild-card-entity-staleness',
        message: `Wild Card shares ${overlap.length} entity keywords with ${recentWC.filename}: [${overlap.slice(0, 5).join(', ')}]. Likely cross-day repeat — verify and replace if same underlying story.`,
      });
    }
  }

  return out;
}

// CHECK: Six bullet word count ceiling (added May 11, 2026 — Critic mandate #3)
// All bullets in M&M, C&C, AI&T, Geopolitics must be ≤170 words (160 target + 10 grace).
// >200 words = 🔴 HARD FAIL.
// DEPTH-TREATMENT override (added June 10 — Critic mandate #3, RC5+RC3):
// Bullets marked with <!-- DEPTH-TREATMENT --> get 350-word ceiling instead of 170.
// This resolves the three-way ceiling contradiction (validator 170, QG 220, Editor 350).
// Canonical ceiling for depth-treated bullets: 350.
function checkSixBulletWordCeiling(body: string): Failure[] {
  const out: Failure[] = [];
  const sixStart = body.indexOf('# ▸ THE SIX');
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  if (sixStart === -1 || sixEnd === -1) return out;
  const sixBody = body.slice(sixStart, sixEnd);

  // Split into subsections by ## headers
  const SIX_SECTIONS = ['Markets & Macro', 'Companies & Crypto', 'AI & Tech', 'Geopolitics'];

  for (const sectionName of SIX_SECTIONS) {
    const sectionPattern = new RegExp(`## ${sectionName.replace(/&/g, '&')}\\b`);
    const sectionMatch = sixBody.match(sectionPattern);
    if (!sectionMatch || sectionMatch.index === undefined) continue;

    const startIdx = sectionMatch.index + sectionMatch[0].length;
    // Find next ## header or end of six body
    const remaining = sixBody.slice(startIdx);
    const nextHeader = remaining.search(/\n## /);
    const sectionText = nextHeader === -1 ? remaining : remaining.slice(0, nextHeader);

    // Extract bullets (lines starting with - **)
    const lines = sectionText.split('\n');
    let bulletIdx = 0;
    let currentBullet = '';

    const flushBullet = () => {
      if (!currentBullet.trim()) return;
      bulletIdx++;
      const words = currentBullet.trim().split(/\s+/).filter(w => w.length > 0).length;
      // Check for DEPTH-TREATMENT marker (added June 10 — canonical ceiling 350)
      // stripComments converts <!-- DEPTH-TREATMENT --> to a ZWS-delimited token to avoid
      // triggering em-dash and entity checks while remaining detectable here.
      const isDepthTreated = currentBullet.includes('<!-- DEPTH-TREATMENT -->') ||
                             currentBullet.includes('​depth_treatment​') ||
                             currentBullet.includes('INVESTMENT TARGET');
      const ceiling = isDepthTreated ? 350 : 170;
      const hardFail = isDepthTreated ? 400 : 200;
      if (words > hardFail) {
        out.push({
          check: 'six-bullet-word-ceiling',
          message: `🔴 HARD FAIL: ${sectionName} bullet ${bulletIdx} is ${words} words (ceiling: ${ceiling}, hard fail: ${hardFail}). Must compress.${isDepthTreated ? ' (DEPTH-TREATMENT ceiling applied)' : ''}`,
        });
      } else if (words > ceiling) {
        out.push({
          check: 'six-bullet-word-ceiling',
          message: `🟡 FLAG: ${sectionName} bullet ${bulletIdx} is ${words} words (ceiling: ${ceiling}). Compress if possible.${isDepthTreated ? ' (DEPTH-TREATMENT ceiling applied)' : ''}`,
        });
      }
    };

    for (const line of lines) {
      if (/^- \*\*/.test(line)) {
        flushBullet();
        currentBullet = line;
      } else if (currentBullet && /^\s/.test(line) && line.trim()) {
        // Continuation line of current bullet
        currentBullet += ' ' + line.trim();
      } else if (line.trim() === '') {
        // Empty line might end a bullet or separate paragraphs within a bullet
        // Keep accumulating — bullets can span multiple paragraphs
      }
    }
    flushBullet(); // Last bullet
  }

  return out;
}

/**
 * CHECK: Editorial placeholder text in any section (May 12, 2026).
 * E-WILDCARD-PLACEHOLDER-01 🔴 EMERGENCY.
 *
 * Catches [WILD CARD REPLACEMENT NEEDED], [EDITOR NOTE:], [TODO:], [INSERT],
 * [REPLACEMENT], and any bracket-enclosed ALL-CAPS instruction pattern.
 * Previously only Dashboard was checked (lines 173-177). Now covers the
 * entire brief so no editorial instructions can reach readers.
 */
function checkEditorialPlaceholders(body: string): Failure[] {
  const out: Failure[] = [];

  // Hard fail: known editorial instruction patterns
  const hardPatterns = /\[([A-Z][A-Z\s]*(NEEDED|NOTE|TODO|REPLACEMENT|INSERT))\]/gi;
  let match: RegExpExecArray | null;
  while ((match = hardPatterns.exec(body)) !== null) {
    out.push({
      check: 'no-editorial-placeholders',
      message: `🔴 HARD FAIL: Editorial placeholder text found: "${match[0]}". Must be resolved before publish.`,
    });
  }

  // Soft flag: any bracket-enclosed text that is 3+ consecutive uppercase letters
  // (not on the acronym whitelist). This catches unknown instruction patterns.
  const acronymWhitelist = new Set([
    'AI', 'US', 'UK', 'EU', 'GDP', 'CPI', 'ETF', 'IPO', 'CEO', 'CFO',
    'FOMC', 'PBOC', 'OPEC', 'NATO', 'GCC', 'UAE', 'IMF', 'BIS', 'FSB',
    'SEC', 'DOJ', 'FDA', 'EPA', 'TSMC', 'ASML', 'DRAM', 'IBIT', 'MOVE',
    'BTC', 'ETH', 'SOL', 'DXY', 'WTI', 'YTD', 'MoM', 'YoY', 'QoQ',
    'TIPS', 'PCE', 'PPI', 'NFP', 'BLS', 'BEA', 'CBOE', 'ICE', 'CME',
    'TLDR', 'DVN', 'TVL', 'CCIP', 'OFT', 'SRT', 'CDS', 'TAM', 'JEPA',
    'GGUF', 'RWA', 'EUV', 'NYT', 'CDC', 'ABA', 'CFR', 'CSIS', 'RAND',
    'WASDE', 'USDA', 'CENTCOM', 'ICBM',
  ]);
  const broadPattern = /\[([A-Z]{3,}[A-Z\s]*)\]/g;
  while ((match = broadPattern.exec(body)) !== null) {
    const inner = match[1].trim();
    if (!acronymWhitelist.has(inner)) {
      out.push({
        check: 'bracket-instruction-warning',
        message: `🟡 FLAG: Bracket-enclosed all-caps text "${match[0]}" — verify this is an acronym, not an editorial instruction.`,
      });
    }
  }

  return out;
}

// --- Adjacent-sentence dedup (June 6, 2026) ---
// E-MM1-DUPLICATE-SENTENCE. M&M 1 had "The labor market is confirming inflation,
// not fighting it" twice consecutively — merge artifact from v1.5 quality gate
// content being pasted into v2 by the Editor. RC2 (Verification Gap).
function checkAdjacentSentenceDedup(body: string): Failure[] {
  const out: Failure[] = [];
  // Split body into sections by ## headers, # headers, and horizontal rules (---)
  // so that adjacent-sentence dedup does not compare across major section boundaries.
  const sections = body.split(/^(?:#{1,2}\s|---\s*$)/m);
  for (const section of sections) {
    const sectionName = section.split('\n')[0].trim();
    // Extract sentences (split on period/exclamation/question followed by space or newline)
    const text = section.replace(/\n/g, ' ');
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    for (let i = 0; i < sentences.length - 1; i++) {
      const a = sentences[i].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const b = sentences[i + 1].toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      // Check if one is substring of other
      if (a.length > 20 && b.length > 20) {
        if (b.includes(a) || a.includes(b)) {
          out.push({
            check: 'adjacent-sentence-dedup',
            message: `Adjacent duplicate in ${sectionName}: "${sentences[i].trim().substring(0, 60)}..." is contained within the next sentence. Likely merge artifact.`
          });
        }
        // Check 80% word overlap
        const wordsA = a.split(/\s+/);
        const wordsB = b.split(/\s+/);
        const shorter = Math.min(wordsA.length, wordsB.length);
        if (shorter >= 5) {
          const shared = wordsA.filter(w => wordsB.includes(w)).length;
          const overlap = shared / shorter;
          if (overlap >= 0.8) {
            out.push({
              check: 'adjacent-sentence-dedup',
              message: `Adjacent duplicate in ${sectionName}: ${Math.round(overlap * 100)}% word overlap between consecutive sentences. First: "${sentences[i].trim().substring(0, 50)}..."`
            });
          }
        }
      }
    }
  }
  return out;
}

// --- Signal pair label presence-check (July 1, 2026) ---
// E-SIGNAL-TOPIC-FAMILIARITY-01 🟡 Day 2. If the QG log's SIGNAL PAIR line shows
// a consensus/INVALID Signal, assert the published brief contains a `Context signal:` label.
function checkSignalPairLabel(body: string, briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];
  const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
  if (!fs.existsSync(qgLog)) return out;
  const qgContent = fs.readFileSync(qgLog, 'utf8');
  // Check if any Signal was marked INVALID or consensus in the QG log
  const pairLine = qgContent.match(/SIGNAL PAIR:.*?(INVALID|consensus|well-covered|label)/i);
  if (pairLine && /INVALID|consensus|well-covered/i.test(pairLine[0])) {
    // A consensus Signal exists — check if the brief has the Context signal: label
    const signalStart = body.indexOf('## The Signal');
    if (signalStart !== -1) {
      const signalSection = body.slice(signalStart, body.indexOf('\n---', signalStart + 1));
      if (!signalSection.includes('Context signal:')) {
        out.push({
          check: 'signal-pair-unlabeled-consensus',
          message: `🟡 FLAG: QG log shows a consensus/well-covered Signal but the brief contains no 'Context signal:' label. Per the SIGNAL PAIR STANDARD, a consensus Signal must be explicitly labeled so the reader knows it is context, not an undercovered thesis.`,
        });
      }
    }
  }
  // --- DESK-QUOTE CHECK presence assertion (July 3, 2026 — E-SIGNAL-TOPIC-FAMILIARITY-01 Day 4) ---
  // The QG must log a SIGNAL DESK-QUOTE CHECK line per Signal.
  if (!qgContent.includes('SIGNAL DESK-QUOTE CHECK:')) {
    out.push({
      check: 'signal-desk-quote-check-missing',
      message: `🔴 FAIL: QG log missing 'SIGNAL DESK-QUOTE CHECK:' line — the desk-quote register check did not run. The QG must grep each Signal body against the MAJOR-DESK REGISTER (Signal_Generator.md) and log the result before the brief passes.`,
    });
  }
  // Flag if a desk-quote hit was found but Signal lacks Context label
  const deskHitMatch = qgContent.match(/SIGNAL DESK-QUOTE CHECK:.*?auto-INVALID/i);
  if (deskHitMatch) {
    const signalStart = body.indexOf('## The Signal');
    if (signalStart !== -1) {
      const signalSection = body.slice(signalStart, body.indexOf('\n---', signalStart + 1));
      if (!signalSection.includes('Context signal:')) {
        out.push({
          check: 'signal-desk-quote-hit-unlabeled',
          message: `🔴 FAIL: QG log shows a Signal with a major-desk quote stating the thesis (auto-INVALID) but the brief contains no 'Context signal:' label. A desk-quoted Signal must be replaced or labeled per the DESK-QUOTE AUTO-FAIL rule.`,
        });
      }
    }
  }
  // Flag prohibited qualifier verdict states (July 3, 2026)
  if (/VALID\s*\(borderline\)|VALID\s*\(partial\)|VALID\s*\(weak\)/i.test(qgContent)) {
    out.push({
      check: 'signal-prohibited-verdict-qualifier',
      message: `🔴 FAIL: QG log contains a prohibited verdict qualifier (borderline/partial/weak). Warrant states must be exactly VALID or INVALID — qualifiers are prohibited per the ENUMERATED VERDICTS rule (July 3).`,
    });
  }
  return out;
}

// --- QG Inner Game audit completeness check (July 1, 2026) ---
// E-QG-INNERCHECK-GAP-01 🟡. The QG Inner Game audit failed to bind on two
// consecutive days (06-30 tradition-cooldown, 07-01 forbidden-source). Per the
// escalation rule ("a rule that fails twice escalates to a layer that can't skip it"),
// enforcement moves to a deterministic presence-check — the exact move that
// resolved convergence (E-CONVERGENCE-ASSEMBLY-01).
function checkQGInnerGameAudit(briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];
  const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
  if (!fs.existsSync(qgLog)) return out;
  const qgContent = fs.readFileSync(qgLog, 'utf8');
  // Assert INNER GAME FORBIDDEN-CHECK line exists
  if (!qgContent.includes('INNER GAME FORBIDDEN-CHECK:')) {
    out.push({
      check: 'qg-inner-game-forbidden-check-missing',
      message: `🔴 FAIL: QG log missing 'INNER GAME FORBIDDEN-CHECK:' line — the forbidden-source check did not run. The QG must grep the Inner Game source against the FORBIDDEN list (Inner_Game_Generator.md:41) and log the result before the brief passes.`,
    });
  }
  // Assert INNER GAME TRADITION line exists with pasted grep evidence
  if (!qgContent.includes('INNER GAME TRADITION:')) {
    out.push({
      check: 'qg-inner-game-tradition-check-missing',
      message: `🔴 FAIL: QG log missing 'INNER GAME TRADITION:' line — the 30-day tradition grep did not run. The QG must grep the Inner Game tradition over the trailing 30 days and paste the result before the brief passes.`,
    });
  }
  // --- CONCEPT-INVERSION presence assertion (July 3, 2026 — E-INNER-GAME-CONCEPT-01 Day 71+) ---
  // The QG must log a CONCEPT-INVERSION line naming the reader assumption inverted.
  if (!qgContent.includes('CONCEPT-INVERSION:')) {
    out.push({
      check: 'qg-inner-game-concept-inversion-missing',
      message: `🔴 FAIL: QG log missing 'CONCEPT-INVERSION:' line — the concept inversion test did not run. The QG must state the reader assumption the Inner Game concept contradicts and log PASS or confirmatory before the brief passes.`,
    });
  }
  // --- RECOMMENDATION DOMAIN validity assertion (July 5, 2026 — upgraded from presence-only) ---
  // E-INNER-GAME-CONCEPT-01 Day 73. The July-4 presence assertion was defeated on first
  // exercise: the QG back-filled the line with invented vocabulary ("practical action / craft
  // execution"), a contradicted last-7 list, and an un-updated ledger. Presence-checking is
  // dead; validity-checking is the replacement. This asserts: (1) line exists, (2) domain
  // token is one of the 8 enumerated taxonomy tokens verbatim, (3) domain is not in the
  // trailing 7 entries from the ledger file, (4) ledger has a row for BRIEF_DATE.
  const DOMAIN_TAXONOMY = [
    'decision-timing', 'attention-perception', 'body-somatic', 'social-relational',
    'creative-process', 'emotional-regulation', 'identity-narrative', 'environment-design',
  ];
  const domainLineMatch = qgContent.match(/RECOMMENDATION DOMAIN:\s*today='([^']+)'/);
  if (!domainLineMatch) {
    out.push({
      check: 'qg-inner-game-recommendation-domain-missing',
      message: `🔴 FAIL: QG log missing 'RECOMMENDATION DOMAIN:' line — the recommendation-domain test did not run. The QG must classify the Inner Game's practical recommendation domain and verify it differs from the trailing 7 entries before the brief passes.`,
    });
  } else {
    const todayDomain = domainLineMatch[1].trim();
    // (i) Token must be exactly one of the 8 enumerated taxonomy tokens
    if (!DOMAIN_TAXONOMY.includes(todayDomain)) {
      out.push({
        check: 'qg-inner-game-recommendation-domain-invalid-token',
        message: `🔴 FAIL: non-taxonomy domain token '${todayDomain}' — AUTO-VOID per RECOMMENDATION-DOMAIN TEST. The QG must classify against the enumerated taxonomy in Inner_Game_Generator.md: ${DOMAIN_TAXONOMY.join(', ')}.`,
      });
    }
    // (ii) Check trailing-7 in the ledger file
    const igGenPath = path.resolve(briefDir, '..', 'system', 'Inner_Game_Generator.md');
    if (fs.existsSync(igGenPath)) {
      const igContent = fs.readFileSync(igGenPath, 'utf8');
      // Parse ledger rows: | YYYY-MM-DD | domain |
      const ledgerRows: { date: string; domain: string }[] = [];
      const ledgerRe = /\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+?)\s*\|/g;
      // Find rows after "RECOMMENDATION-DOMAIN LEDGER"
      const ledgerStart = igContent.indexOf('RECOMMENDATION-DOMAIN LEDGER');
      if (ledgerStart !== -1) {
        const ledgerSection = igContent.slice(ledgerStart);
        let m: RegExpExecArray | null;
        while ((m = ledgerRe.exec(ledgerSection)) !== null) {
          const rowDomain = m[2].trim().replace(/\(.*\)/, '').trim(); // strip footnotes
          if (rowDomain && rowDomain !== '(no brief)' && rowDomain !== 'Domain') {
            ledgerRows.push({ date: m[1], domain: rowDomain });
          }
        }
      }
      // Check trailing-7 repeat (exclude today's own row — we want the 7 entries BEFORE today)
      const trailing7 = ledgerRows.filter(r => r.date !== bd).slice(-7);
      const trailing7Domains = trailing7.map(r => r.domain);
      if (DOMAIN_TAXONOMY.includes(todayDomain) && trailing7Domains.includes(todayDomain)) {
        const repeatRow = trailing7.find(r => r.domain === todayDomain);
        out.push({
          check: 'qg-inner-game-recommendation-domain-trailing7-repeat',
          message: `🔴 FAIL: trailing-7 repeat — domain '${todayDomain}' used ${repeatRow?.date ?? 'recently'}. The recommendation domain must differ from ALL trailing 7 entries.`,
        });
      }
      // Check ledger has a row for BRIEF_DATE
      if (!ledgerRows.some(r => r.date === bd)) {
        out.push({
          check: 'qg-inner-game-recommendation-domain-ledger-not-updated',
          message: `🔴 FAIL: ledger not updated — no row for ${bd} in the RECOMMENDATION-DOMAIN LEDGER. The RECOMMENDATION-DOMAIN TEST requires updating the ledger in the same pass.`,
        });
      }
    }
  }
  return out;
}

// --- Convergence class presence-check (July 3, 2026) ---
// E-CONVERGENCE-ASSEMBLY-01 🟡 Day 2. When the QG log records a synthesis designation,
// assert a CONVERGENCE CLASS line exists and reads MECHANISM — a designated synthesis
// with a THEME class or missing class line is a hard fail.
function checkConvergenceClass(briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];
  const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
  if (!fs.existsSync(qgLog)) return out;
  const qgContent = fs.readFileSync(qgLog, 'utf8');
  // Check if a synthesis designation exists
  const hasSynthesis = qgContent.includes('SYNTHESIS DESIGNATION:') &&
    !qgContent.includes('not triggered');
  if (hasSynthesis) {
    if (!qgContent.includes('CONVERGENCE CLASS:')) {
      out.push({
        check: 'convergence-class-missing',
        message: `🔴 FAIL: QG log has a SYNTHESIS DESIGNATION but no 'CONVERGENCE CLASS:' line. Per the MECHANISM-VS-THEME CLASSIFICATION rule (July 3), every synthesis must be classified as MECHANISM or THEME before designation.`,
      });
    } else if (/CONVERGENCE CLASS:.*THEME/i.test(qgContent)) {
      out.push({
        check: 'convergence-theme-claimed-as-assembly',
        message: `🔴 FAIL: QG log classifies the convergence as THEME but has a SYNTHESIS DESIGNATION. Only MECHANISM-class convergences may proceed to synthesis. A THEME may shape the intro/title but must not be claimed as assembly.`,
      });
    }
  }
  return out;
}

// --- Model pool-size floor (July 1, 2026) ---
// E-MODEL-WHITELIST-EXHAUSTION-01 🟡 Day 4, escalated to CRITICAL.
// Presence-only advisory: warns when the resolving slug count is below the
// sustainable floor for a 30-day cooldown.
function checkModelPoolFloor(): Failure[] {
  const out: Failure[] = [];
  const whitelistPath = path.join(process.cwd(), 'system', 'Model_Tier3_Whitelist.md');
  if (!fs.existsSync(whitelistPath)) return out;
  const wl = fs.readFileSync(whitelistPath, 'utf8');
  // Count active rows (not demoted/quarantined) by matching table rows with slugs
  const rows = wl.match(/^\|\s*\d+\s*\|(?!.*DEMOTED|.*QUARANTINED).*`[a-z0-9-]+`/gm) || [];
  // Extract unique resolving slugs (exclude the 3 known domain-only quarantined slugs)
  const domainOnly = new Set([
    'simple-rules-generating-complex-behavior',
    'creativity-innovation',
    'information-theory-media-ecology',
  ]);
  const slugs = new Set<string>();
  for (const row of rows) {
    const m = row.match(/`([a-z0-9-]+)`/);
    if (m && !domainOnly.has(m[1])) slugs.add(m[1]);
  }
  const floor = 30; // 2 × (30-day cooldown / 14) ≈ 30 for daily publication
  if (slugs.size < floor) {
    out.push({
      check: 'model-pool-below-floor',
      message: `🟡 MODEL POOL BELOW FLOOR: ${slugs.size} resolving slugs vs ${floor} minimum for a 30-day cooldown. Exhaustion Protocol will recur — expand Model_Tier3_Whitelist.md by vetting READWISE_MODELS entries against the 6-point standard.`,
    });
  }
  return out;
}

// --- Model standalone check (July 4, 2026 — E-MODEL-STANDALONE-VIOLATION-01) ---
// Grep the Model section for temporal-anchor tokens that violate the standalone test.
function checkModelStandalone(body: string): Failure[] {
  const out: Failure[] = [];
  // Extract Model section (between "## The Model" or "### The Model" and the next ## or ### heading)
  const modelMatch = body.match(/#{2,3}\s+(?:The\s+)?Model[\s\S]*?(?=\n#{2,3}\s|\n## |$)/i);
  if (!modelMatch) return out;
  const modelText = modelMatch[0];
  // Check for temporal-anchor tokens
  const temporalPattern = /\b(this week|this morning|today'?s|yesterday'?s|tonight|right now|this quarter)\b/gi;
  const temporalHits = modelText.match(temporalPattern);
  if (temporalHits && temporalHits.length > 0) {
    out.push({
      check: 'model-standalone-violation',
      message: `🔴 FAIL: Model contains temporal-anchor tokens that violate standalone test: ${temporalHits.map(h => `"${h}"`).join(', ')}. The Model must be readable six months from now with zero context about today's events.`,
    });
  }
  return out;
}

// --- Data-point repetition: the "at most twice" rule (July 1, 2026) ---
// Makes Brief_Validator Check 9 (data-point dedup) MECHANICAL. It was prose-only, so the
// same figure could still land in the lede, the Dashboard, and a Six bullet — the March 31
// "52% to 2.2%" failure, and the July 1 repeat where the yen "162" and the "$23.5 billion"
// quarter-end bid each appeared in three sections (heard three times in the first minutes of
// audio). A load-bearing data point may appear in AT MOST TWO sections (the lede preview plus
// its single home story); 3+ = FAIL. Timeless sections (Model, Inner Game, Discovery) are
// excluded — they may borrow a number for a standalone example.
function checkDataPointRepetition(body: string): Failure[] {
  const rep = checkRepetition(body);
  return rep.findings.map((f) => ({
    check: 'data-point-repetition',
    message: `"${f.display}" appears in ${f.sections.length} sections (rule: at most twice): ${f.sections.join(' · ')}. Keep it in the lede preview + its home story; reference it elsewhere without restating the figure.`,
  }));
}

// --- AI&T Differentiation check (July 5, 2026 — E-AI-SECTION-CONSENSUS-01) ---
// Critic mandate #1: at least one AI&T bullet must carry a named non-wire element.
// DARK-LAYER REROUTE off Brief_Architect.md, Day 32+.
function checkQGAITDifferentiation(briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];
  const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
  if (!fs.existsSync(qgLog)) return out;
  const qgContent = fs.readFileSync(qgLog, 'utf8');
  // Assert AI&T DIFFERENTIATION line exists
  if (!qgContent.includes('AI&T DIFFERENTIATION:')) {
    out.push({
      check: 'qg-ait-differentiation-missing',
      message: `🔴 FAIL: QG log missing 'AI&T DIFFERENTIATION:' line — the wire test did not run. The QG must classify each AI&T bullet as CONSENSUS or DIFFERENTIATED with a named non-wire element.`,
    });
  } else {
    // Validate the line has proper structure: at least one DIFFERENTIATED token or a replacement action
    const diffLine = qgContent.split('\n').find(l => l.includes('AI&T DIFFERENTIATION:'));
    if (diffLine) {
      const hasPass = /→\s*(PASS|🔴 all-consensus → replaced)/.test(diffLine);
      const hasDifferentiated = /DIFFERENTIATED:/.test(diffLine);
      if (!hasPass) {
        out.push({
          check: 'qg-ait-differentiation-invalid-verdict',
          message: `🔴 FAIL: AI&T DIFFERENTIATION line missing verdict (PASS or replacement action). The line must end with '→ PASS (≥1 DIFFERENTIATED)' or '→ 🔴 all-consensus → replaced b<N>'.`,
        });
      }
      if (hasPass && /PASS/.test(diffLine) && !hasDifferentiated) {
        out.push({
          check: 'qg-ait-differentiation-pass-without-evidence',
          message: `🔴 FAIL: AI&T DIFFERENTIATION PASS verdict without any 'DIFFERENTIATED:' token — a PASS requires at least one bullet classified DIFFERENTIATED with a named non-wire element.`,
        });
      }
    }
  }
  return out;
}

function main() {
  const [, , argPath] = process.argv;
  if (!argPath) {
    console.error('Usage: validate-brief.ts <path-to-brief.md>');
    process.exit(2);
  }
  const absPath = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  const body = stripComments(raw);
  const briefDir = path.dirname(absPath);

  const failures: Failure[] = [];
  // --- Header display date must match filename slug (July 7, 2026 — parser/audio date bug) ---
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (briefDateMatch) {
    failures.push(...checkDisplayDateMatchesSlug(body, briefDateMatch[1]));
  }
  // --- Original mechanical checks ---
  failures.push(...checkHeaders(body));
  failures.push(...checkOrientationBanned(body));
  failures.push(...checkModelLink(body));
  // Model recency: extract brief date from filename for the 14-day window check
  const recencyDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (recencyDateMatch) {
    failures.push(...checkModelRecency(body, recencyDateMatch[1]));
  }
  failures.push(...checkCandCBalance(body));
  failures.push(...checkDashboardNoTables(body));
  failures.push(...checkInnerGameStructure(body));
  failures.push(...checkInnerGameWordBudget(body));
  failures.push(...checkInnerGameConceptReuse(body, absPath));
  failures.push(...checkEmDashes(body));
  failures.push(...checkHypePhrases(body));
  failures.push(...checkInternalTagLeak(body));
  failures.push(...checkAnchorLinks(body));
  // --- NEW structural checks (April 20, 2026) ---
  // These close the 6 gaps Jackson identified. They prevent rationalization
  // by encoding rules as code instead of prose.
  failures.push(...checkEntityLeadSingleHome(body));
  failures.push(...checkEventLeadSingleHome(body));
  failures.push(...checkTakeCounterCase(body));
  failures.push(...checkSignalStaleness(body, briefDir, absPath));
  failures.push(...checkWildCardStaleness(body, briefDir, absPath));
  failures.push(...checkDashboardSentenceCeiling(body));
  // --- Six bullet word ceiling (May 11, 2026) ---
  failures.push(...checkSixBulletWordCeiling(body));
  // --- AI section minimum 2-bullet floor (June 14, 2026) ---
  failures.push(...checkAISectionMinBullets(body));
  // --- Signal named investable entities (June 16, 2026) ---
  // Critic mandate #3: every Signal must name ≥2 investable entities.
  failures.push(...checkSignalNamedEntities(body));
  failures.push(...checkLedgerTruth(body, briefDir, absPath));
  // --- Editorial placeholder detection — ALL sections (May 12, 2026) ---
  // E-WILDCARD-PLACEHOLDER-01 🔴 EMERGENCY. Two [WILD CARD REPLACEMENT NEEDED]
  // placeholders survived into v2 on May 12. Previous check only covered Dashboard.
  // Now checks entire brief for bracket-enclosed editorial instructions.
  failures.push(...checkEditorialPlaceholders(body));
  // --- Adjacent-sentence dedup (June 6, 2026) ---
  // Catches merge artifacts where quality gate closing rewrites echo bullet body phrases.
  failures.push(...checkAdjacentSentenceDedup(body));
  // --- Data-point repetition / "at most twice" (July 1, 2026) ---
  // Mechanizes Brief_Validator Check 9: no load-bearing figure in 3+ sections.
  failures.push(...checkDataPointRepetition(body));
  // --- Signal pair label check (July 1, 2026 — E-SIGNAL-TOPIC-FAMILIARITY-01) ---
  failures.push(...checkSignalPairLabel(body, briefDir, absPath));
  // --- QG Inner Game audit completeness (July 1, 2026 — E-QG-INNERCHECK-GAP-01) ---
  failures.push(...checkQGInnerGameAudit(briefDir, absPath));
  // --- Model pool-size floor (July 1, 2026 — E-MODEL-WHITELIST-EXHAUSTION-01) ---
  failures.push(...checkModelPoolFloor());
  // --- Convergence class check (July 3, 2026 — E-CONVERGENCE-ASSEMBLY-01) ---
  failures.push(...checkConvergenceClass(briefDir, absPath));
  // --- Model standalone check (July 4, 2026 — E-MODEL-STANDALONE-VIOLATION-01) ---
  failures.push(...checkModelStandalone(body));
  // --- AI&T differentiation check (July 5, 2026 — E-AI-SECTION-CONSENSUS-01) ---
  failures.push(...checkQGAITDifferentiation(briefDir, absPath));

  // --- QG-must-have-run integrity check (June 16, 2026) ---
  // E-PIPELINE-SEQUENCING-01: if validating a v2, assert that the quality gate ran.
  // A v2 without a quality-gate-log means the QG was skipped — hard fail.
  {
    const briefBasename = path.basename(absPath);
    if (briefBasename.includes('-v2')) {
      const dateMatch = briefBasename.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const bd = dateMatch[1];
        const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
        const pipelineStatus = path.join(briefDir, `${bd}-pipeline-status.md`);
        let qgRan = false;
        if (fs.existsSync(qgLog)) {
          qgRan = true;
        } else if (fs.existsSync(pipelineStatus)) {
          const ps = fs.readFileSync(pipelineStatus, 'utf8');
          if (/brief-quality-gate\s*\|.*\|\s*SUCCESS/i.test(ps)) {
            qgRan = true;
          }
        }
        if (!qgRan) {
          failures.push({
            check: 'v2-without-quality-gate',
            message: `v2 produced with no quality-gate-log for ${bd} — the QG was skipped (E-PIPELINE-SEQUENCING-01). Run the QG on v1 to produce v1.5 before finalizing v2.`,
          });
        }
      }
    }
  }

  // --- TRUTH + NOVELTY gates (added June 8, 2026 — see system/Truth_And_Novelty_Gates.md) ---
  // The structural validator above checks format/voice/dedup but verifies NO facts.
  // These two gates close that hole. They run as SEPARATE processes so their
  // blocking is mechanical and cannot be talked past by the narrative layer:
  //   fact-gate.ts    — office-holders vs system/current-facts.json + market
  //                     numbers/directions vs {date}-truth.json ground truth.
  //   novelty-gate.ts — bans repeating The Take's structural MOVE within a window.
  // Here we run fact-gate with --allow-unverified so this stage fails only on
  // real CONTRADICTIONS (and office-holder errors); the strict publish-gate
  // (scripts/publish-gate.sh) additionally blocks unverified-critical numbers.
  // Defensive: skip a gate if its script is absent rather than crash.
  const scriptsDir = path.join(process.cwd(), 'scripts');
  let subGateFailed = false;
  const subGates: { file: string; extra: string[] }[] = [
    { file: 'fact-gate.ts', extra: ['--allow-unverified'] },
    { file: 'novelty-gate.ts', extra: [] },
    // assembly-gate is ADVISORY here (no --strict → exits 0 and prints its
    // "named not cashed out" finding without failing this stage). The Editor Gate
    // and the Critic are REQUIRED to resolve any assembly finding — that's where it binds.
    { file: 'assembly-gate.ts', extra: [] },
  ];
  for (const g of subGates) {
    const gp = path.join(scriptsDir, g.file);
    if (!fs.existsSync(gp)) continue;
    const r = spawnSync(process.execPath, ['--experimental-strip-types', gp, absPath, ...g.extra], { encoding: 'utf8' });
    if (r.stdout) console.log(`\n--- ${g.file} ---\n${r.stdout.trim()}`);
    if (r.stderr && r.stderr.trim()) console.error(r.stderr.trim());
    if (r.status !== 0) subGateFailed = true;
  }

  // --- FALSE-POSITIVE OVERRIDE support (July 5, 2026 — M1) ---
  // Read the editor log for evidence-bound overrides. A matching override downgrades
  // a staleness/entity/dedup failure to advisory (logged, non-blocking).
  // Checks eligible for override: signal-staleness, wildcard-staleness, entity-lead-*,
  // adjacent-sentence-dedup, data-point-repetition.
  const overrideEligiblePrefixes = [
    'signal-staleness', 'wildcard-staleness', 'entity-lead', 'event-lead',
    'adjacent-sentence-dedup', 'data-point-repetition',
  ];
  {
    const dateMatchOverride = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatchOverride) {
      const editorLog = path.join(briefDir, `${dateMatchOverride[1]}-editor-log.md`);
      if (fs.existsSync(editorLog)) {
        const elContent = fs.readFileSync(editorLog, 'utf8');
        const overrideLines = elContent.split('\n').filter(l => l.includes('FALSE-POSITIVE OVERRIDE:'));
        if (overrideLines.length > 0) {
          // For each override, check if it names a check that has a matching failure
          const overriddenChecks: string[] = [];
          for (const ol of overrideLines) {
            // Extract check name: FALSE-POSITIVE OVERRIDE: [check-name] [evidence]
            const checkMatch = ol.match(/FALSE-POSITIVE OVERRIDE:\s*\[([^\]]+)\]/);
            if (checkMatch) {
              overriddenChecks.push(checkMatch[1].trim().toLowerCase());
            }
          }
          // Downgrade matching failures
          for (let i = failures.length - 1; i >= 0; i--) {
            const f = failures[i];
            const isEligible = overrideEligiblePrefixes.some(p => f.check.startsWith(p));
            if (isEligible) {
              const isOverridden = overriddenChecks.some(oc =>
                f.check.toLowerCase().includes(oc) || oc.includes(f.check.toLowerCase())
              );
              if (isOverridden) {
                console.log(`  🟡 [${f.check}] DOWNGRADED to advisory — FALSE-POSITIVE OVERRIDE with evidence in editor log.`);
                failures.splice(i, 1);
              }
            }
          }
        }
      }
    }
  }

  if (failures.length === 0 && !subGateFailed) {
    console.log(`\n✅ validate-brief PASS — ${path.basename(absPath)}`);
    process.exit(0);
  }

  if (failures.length > 0) {
    console.log(`\n❌ validate-brief FAIL — ${path.basename(absPath)} — ${failures.length} structural issue(s):`);
    for (const f of failures) {
      console.log(`  [${f.check}] ${f.message}`);
    }
  }
  if (subGateFailed) {
    console.log(`\n❌ validate-brief FAIL — truth/novelty gate failed (details above).`);
  }
  process.exit(1);
}

main();
