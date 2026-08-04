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
import { select as selectDailyModel } from './select-daily-model.ts';
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
  // so checkSixSectionWordBudget can still detect them without triggering em-dash or entity checks.
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

// MODEL ROTATION ASSIGNMENT (2026-07-24 — IMP-095 wiring; aligned 2026-08-01).
// The daily model is ASSIGNED by select-daily-model.ts (queue walk + cooldown / lifetime-use
// skips). validate-brief previously used naive queue[(date-epoch)%len], so it demanded slugs the
// selector would never hand the Writer (07-29: validator wanted cultural-transmission; selector
// skipped it on a 19-day cooldown → false HARD FAIL). Now checkModelAssigned calls select() so
// "assigned" means what the Writer was told to teach. Escape hatch: FALSE-POSITIVE-OVERRIDE
// with evidence in the editor log — never silently.
function checkModelAssigned(body: string, briefDate: string): Failure[] {
  const out: Failure[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(briefDate)) return out; // weekly briefs are exempt
  const qp = path.join(process.cwd(), 'data', 'model-rotation-queue.json');
  if (!fs.existsSync(qp)) return out; // rotation not deployed in this checkout

  let assigned: ReturnType<typeof selectDailyModel>;
  try {
    assigned = selectDailyModel(briefDate);
  } catch {
    return out; // pre-epoch / malformed — no jurisdiction
  }

  const section = extractModelSection(body);
  const m = section?.match(/\*\*\[→ Explore this model\]\(https:\/\/www\.cosmictrex\.com\/models\/([a-z0-9-]+)\)\*\*/);
  if (!m) return out; // checkModelLink owns the missing-link failure
  if (m[1] !== assigned.slug) {
    const skipBit = assigned.skipNote
      ? ` Selector skipped the raw queue slot (skippedFrom=${assigned.skippedFrom}): ${assigned.skipNote}.`
      : '';
    out.push({
      check: 'model-rotation-assigned',
      message:
        `Model slug "${m[1]}" is not the rotation's assignment for ${briefDate} — the assigned model is ` +
        `"${assigned.slug}" (${assigned.name ?? 'unknown'}, ${assigned.domain ?? 'unknown domain'}).` +
        skipBit +
        ` The model is ASSIGNED, not chosen (Model_Library Usage Rule 4): run \`node --experimental-strip-types ` +
        `scripts/select-daily-model.ts --date ${briefDate}\` and teach that slug. If today genuinely cannot ` +
        `teach it, declare a FALSE-POSITIVE OVERRIDE: [model-rotation-assigned] with evidence in the editor log.`,
    });
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
  // FORMAT-AGNOSTIC unit count (2026-08-03). This counted only `- **` lines. On 08-03 the Writer
  // composed Markets & Macro and Geopolitics as bold-lead PROSE with no list marker; the day AI &
  // Tech is written the same way, this floor would count 0 units and HARD-STOP a perfectly good
  // brief at the 7:00 PM mechanical gate. A ceiling that goes blind ships bloat; a FLOOR that goes
  // blind halts the pipeline. Units are blocks separated by blank lines, the same split
  // checkSixSectionWordBudget uses, so both directions stay honest about markup.
  const units = section.split(/\n\s*\n/).map((u: string) => u.trim())
    .filter((u: string) => u.length > 0 && !/^#{1,6} /.test(u) && !/^<!--/.test(u) && !/^-{3,}$/.test(u));
  const bullets = units.length;
  if (bullets < 2) {
    out.push({
      check: 'ai-section-min-bullets',
      message: `AI & Tech has ${bullets} bullet(s); minimum is 2. RC6 load-shedding — expand coverage (a non-dominant-company second bullet) rather than compress to one.`,
    });
  }
  // AI two-bullet distinctness advisory (added June 15 — RC4, strengthens June-14 floor)
  if (bullets === 2) {
    const leads = (section.match(/^(?:- )?\*\*(.+?)\*\*/gm) || []).map((s: string) => s.toLowerCase());
    if (leads.length === 2) {
      // Extract capitalized tokens (proper nouns) from each lead, excluding common stopwords
      const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'it', 'its', 'as', 'that', 'this', 'how', 'why', 'what', 'when', 'where', 'who', 'which', 'not', 'no', 'new', 'just', 'now', 'out', 'up', 'all']);
      const extractEntities = (s: string) => {
        const raw = s.replace(/^(?:- )?\*\*/, '').replace(/\*\*.*/, '');
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

// `raw` is passed UNSTRIPPED on purpose. The 07-13 Editor DID declare its deviation —
// `<!-- INNER-GAME-FIGURE-FIRST: DELIBERATE DEVIATION. No verifiable English translation… -->`
// was sitting in v2 the whole time — but `body` is stripComments(raw), so the validator could not
// see the declaration it was punishing the Editor for making. The gate was blind to its own escape
// hatch. (IMP-047)
function checkInnerGameStructure(body: string, raw: string = body): Failure[] {
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

  // FIGURE-FIRST FALLBACK (IMP-047, 2026-07-13). QUOTE-FIRST (IMP-006) is the fixed form — but on
  // 07-13 it collided with the truth chain and the truth chain lost. No verified English translation
  // of the Al-Ghazali passage could be confirmed in-session, so the Editor had exactly two moves:
  // break a mandatory structural rule, or put quotation marks around words it could not source. It
  // did both in sequence — shipped a "(paraphrased)" quote to v2.working, refused to promote it,
  // and its final v2 quietly dropped to unquoted prose, which this validator then FAILED twice.
  // A rule that leaves fabrication as the only compliant path is a broken rule. FIGURE-FIRST is now
  // the sanctioned escape: name the thinker, state the argument in our own voice, no quotation
  // marks — DECLARED, never silent, so the rotation stays honest and the drift is visible.
  const figureFirst = /<!--\s*(?:INNER-GAME-)?FIGURE-FIRST:[\s\S]{15,}?-->/i.test(raw);
  if (figureFirst) {
    // The declaration must be true: an unquoted section may not smuggle a quotation back in.
    const smuggled = section.match(/^\*["“][^"”]{40,}["”]\*$/m);
    if (smuggled) {
      out.push({
        check: 'inner-game-quote-unverifiable',
        message: `Inner Game declares FIGURE-FIRST (no verified quotation) but still opens on a quoted line: ${JSON.stringify(smuggled[0].slice(0, 120))}. Pick one — a verified quote, or our own voice.`,
      });
    }
    if (!hasAction) {
      out.push({ check: 'inner-game', message: `Inner Game must carry a **Today's practice** line.` });
    }
    return out;
  }

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

  // QUOTATION MARKS ARE A TRUTH CLAIM (IMP-047, 2026-07-13 — Critic mandate #3).
  // The 07-13 brief shipped: *"The student who attacks his own nature with a heroic regimen does
  // not transform…"* — Al-Ghazali, Ihya' Ulum al-Din (PARAPHRASED, Disciplining the Soul).
  // The Editor wrote the hedge for intellectual honesty, having failed to confirm any published
  // English translation in-session, and then REFUSED TO PROMOTE v2 over it. The Critic's self-heal
  // shipped it anyway (IMP-046). But the hedge is not a fix: a parenthetical cannot undo quotation
  // marks. Inside them, we are asserting the thinker WROTE these words. "(paraphrased)" is a
  // confession that we cannot source them — a fabricated quotation with a footnote.
  // THE FALLBACK IS FIGURE-FIRST, not a hedged quote: name the thinker, state the argument in our
  // own voice, no quotation marks. We lose the quote, not the truth. (Four-part test: TRUE is
  // disqualifying — it outranks the form.)
  const HEDGED_ATTRIBUTION_RE = /\b(paraphras\w*|attributed to|adapted from|as rendered|characteriz\w*|loosely|in substance|after the manner)\b/i;
  if (quoteLineRe.test(line1) && HEDGED_ATTRIBUTION_RE.test(line2)) {
    out.push({
      check: 'inner-game-quote-unverifiable',
      message: `Inner Game ships QUOTATION MARKS around words it admits are not the source's: attribution reads ${JSON.stringify(line2.slice(0, 140))}. A hedge in the attribution does not license a quote — inside quotation marks we assert the thinker wrote these words, and "(paraphrased)" says we could not verify that. Either quote a VERIFIED published translation (record the source in {date}-truth.json), or drop to FIGURE-FIRST: name the thinker and state the argument in our own voice, unquoted. Losing the quote is cheap; a fabricated quotation is not.`,
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
    // ANCHOR TARGETS ARE NOT PROSE (IMP-065, 2026-07-17 — applying IMP-063(a), which the
    // morning pass prescribed at 05:28 and correctly refused to apply on the publish path).
    // THE DEADLOCK: checkAnchorLinks sanctions `markets--macro`, `companies--crypto` and
    // `ai--tech` — the real GitHub slugs for the "Markets & Macro" headings, mirrored by the
    // site renderer, and therefore the ONLY strings that actually resolve. This check then
    // banned literal `--` with zero tolerance, so 3 of the 12 sanctioned anchors HARD-FAILED
    // the validator if used — while Morning_Updater instructs the Overnight to "anchor-link
    // any Big-Story touch". The three most-linked sections were unlinkable. Every prior brief
    // silently routed around it (07-13 used only `#geopolitics`, a single-word slug); on 07-17
    // the Overnight tripped it on `[Markets & Macro](#markets--macro)` and was rewritten to a
    // prose pointer to get past the gate.
    // WHY THIS IS AN EXEMPTION AND NOT A LOOPHOLE: the em-dash rule is a VOICE rule ("they are
    // an AI tell"). A URL fragment is not voice — nobody reads it, the audio pipeline never
    // speaks it, and its spelling is dictated by the heading, which is frozen. The rule was
    // matching characters in the one place it has no meaning, and a gate that forces the
    // operator to rewrite correct output is how a gate teaches people to route around it
    // (the IMP-042 lesson; IMP-045 one lane over).
    // Blank the anchor TARGET only: `](#markets--macro)` → `]()`. Link TEXT and surrounding
    // prose are still scanned, so `[Markets -- Macro](#markets--macro)` still FAILs.
    const scan = l.replace(/\]\(#[a-z0-9-]+\)/gi, ']()');
    if (/[\u2014]/.test(scan) || /(?<!-)--(?!-)/.test(scan)) {
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
    // Payoff-intro placeholder (2026-07-10, Ceiling Doctrine v0.5 §4): the Writer drafts
    // sections first with a placeholder intro and MUST replace it before the Validator.
    // A surviving placeholder is a floor failure — the front door of the product is broken.
    // This is the mechanical leg of the written-last rule (prose-only rules are unenforced).
    { name: 'PAYOFF placeholder (intro was never written last)', re: /\[PAYOFF[^\]]*\]/i },
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
/**
 * checkSixSectionWordBudget — FORMAT-AGNOSTIC length enforcement (2026-08-01, Jackson).
 *
 * WHY: checkSixBulletWordCeiling only measures lines starting with `- **`. On 2026-08-01 the
 * Writer composed Markets & Macro (1,147 words) and Geopolitics (958 words) as prose, so the
 * check found ZERO bullets, measured nothing, and reported zero violations. The Editor logged
 * "Word ceilings 0 violations" on a brief with ~290-word units. A gate that can silently measure
 * nothing will eventually measure nothing.
 *
 * This measures EVERY unit regardless of markup: subsections are split into blocks on blank
 * lines, so a `- **Lead**` bullet and a bare prose paragraph are both units. It also always
 * reports the unit count, so blindness is visible instead of silent.
 */
/**
 * checkNamedSectionWordBudget — caps the sections nothing else caps (2026-08-01, Jackson).
 *
 * checkSixSectionWordBudget covers only the four Six subsections. THE SIGNAL and THE WILD CARD
 * live inside THE SIX but are not in that list, and THE TAKE / THE MODEL / DISCOVERY had no word
 * cap anywhere. On 2026-08-01 that left The Signal (1,193 w vs a 741 trailing median) and The
 * Model (759 vs 486) completely unmeasured — together +725 words, second only to M&M.
 *
 * Budgets: the documented target where one exists (Take "~400 words", Brief_Writer), otherwise
 * the trailing-week median with ~30% headroom, so a normal brief is silent and a blowout is not.
 * Format-agnostic: measures the whole section, never looks for a markup shape.
 */
const NAMED_SECTION_BUDGETS: Record<string, number> = {
  // Rebuilt 2026-08-03 off the JULY MEDIAN — the 30-minute product we are trying to get back —
  // not the July MAX + 12% the previous table used. Calibrating a ceiling to the top of the
  // period you are correcting ratifies the regression: THE MODEL's old 780 was 1.9x its own
  // July median of 414, so a section that had doubled still passed as "within normal range".
  // The Signal and The Wild Card moved OUT of this table: they are Six subsections, now measured
  // per-unit by checkSixSectionWordBudget where the 220/250 Signal ceiling already lived.
  '▸ THE TAKE':     640,  // July median 577
  '▸ THE MODEL':    480,  // July median 414   (was 780)
  '▸ DISCOVERY':    540,  // July median 478
};

function checkNamedSectionWordBudget(body: string): Failure[] {
  const out: Failure[] = [];
  for (const [name, budget] of Object.entries(NAMED_SECTION_BUDGETS)) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = body.match(new RegExp(`\\n#{1,2} ${esc}\\b`));
    if (!m || m.index === undefined) continue;
    const rest = body.slice(m.index + m[0].length);
    const next = rest.search(/\n#{1,2} ▸|\n## /);
    const text = next === -1 ? rest : rest.slice(0, next);
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > Math.round(budget * 1.15)) {
      out.push({ check: 'named-section-word-budget',
        message: `OVER: ${name} is ${words} words against a ${budget}-word soft ceiling. Compress.` });
    } else if (words > budget) {
      out.push({ check: 'named-section-word-budget',
        message: `NEAR: ${name} is ${words} words against a ${budget}-word soft ceiling.` });
    }
  }
  return out;
}

function checkSixSectionWordBudget(body: string): Failure[] {
  const out: Failure[] = [];
  const sixStart = body.indexOf('# ▸ THE SIX');
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  if (sixStart === -1 || sixEnd === -1) return out;
  const sixBody = body.slice(sixStart, sixEnd);
  // The Signal and The Wild Card are Six subsections and belong here. They were missing until
  // 2026-08-03, which is why SIGNAL_UNIT/SIGNAL_HARD below were unreachable dead code: the
  // isSignal branch could never fire because sectionName could never be 'The Signal'. Jackson
  // caught the same omission once already (the first length fix covered four of six).
  const SIX_SECTIONS = ['Markets & Macro', 'Companies & Crypto', 'AI & Tech', 'Geopolitics', 'The Wild Card', 'The Signal'];
  // Jackson, 2026-08-03: target ~160/bullet, hard ceiling 180. The Signal runs a little longer.
  const UNIT = 160, UNIT_HARD = 180, DEPTH = 350, DEPTH_HARD = 400;
  // Signal, retuned 2026-08-04 (Jackson). The Signal runs TWO IDEAS, each a bold one-line header
  // plus one body block. On 08-04 the bodies ran 393 and 426 words -- 2.5x a Six bullet, ~2.7 min of
  // audio on a single forming trend, and it dragged. July ran ~330/idea. 300/340 spends exactly the
  // ENUMERATION budget (listing five states where three make the point) which is item 1 on
  // Craft_Standard's compression order; going below ~270 would start on the second explanation, and
  // in a Signal idea the second explanation IS the mechanism -- the thing that makes a forming trend
  // legible and separates a Signal from an Overnight item. That is the line where it stops being free.
  const SIGNAL_UNIT = 300, SIGNAL_HARD = 340;

  for (const sectionName of SIX_SECTIONS) {
    const m = sixBody.match(new RegExp(`## ${sectionName}\\b`));
    if (!m || m.index === undefined) continue;
    const rest = sixBody.slice(m.index + m[0].length);
    const nextHeader = rest.search(/\n#{1,2} /);
    const text = nextHeader === -1 ? rest : rest.slice(0, nextHeader);

    const units = text.split(/\n\s*\n/)
      .map(u => u.trim())
      .filter(u => u.length > 0 && !/^#{1,6} /.test(u) && !/^<!--/.test(u));
    if (units.length === 0) continue;

    let total = 0, depthUnits = 0;
    units.forEach((u, i) => {
      const words = u.split(/\s+/).filter(Boolean).length;
      total += words;
      const depth = u.includes('<!-- DEPTH-TREATMENT -->') || u.includes('\u200Bdepth_treatment\u200B') || u.includes('INVESTMENT TARGET');
      const isSignal = /Signal/i.test(sectionName);
      const ceil = depth ? DEPTH : isSignal ? SIGNAL_UNIT : UNIT;
      const hard = depth ? DEPTH_HARD : isSignal ? SIGNAL_HARD : UNIT_HARD;
      if (depth) depthUnits++;
      if (words > hard) {
        out.push({ check: 'six-section-word-budget',
          message: `OVER: ${sectionName} unit ${i + 1}/${units.length} is ${words} words (soft ceiling ${ceil}). Compress or split.${depth ? ' (DEPTH-TREATMENT)' : ''}` });
      } else if (words > ceil) {
        out.push({ check: 'six-section-word-budget',
          message: `OVER: ${sectionName} unit ${i + 1}/${units.length} is ${words} words (ceiling ${ceil}). Compress.${depth ? ' (DEPTH-TREATMENT)' : ''}` });
      }
    });

    // The Six runs 2-3 units per section ("elastic by the day", Editorial Bible), so the section
    // budget is the ALLOWED count (3) x the unit ceiling — not the count actually shipped.
    // Otherwise writing more units raises your own budget, which is the failure mode being fixed.
    // The section budget must use THIS section's unit ceiling, not the default: The Signal runs
    // to 250/unit, so 3 x 180 would have condemned a compliant Signal the moment it was added.
    const sectionUnitHard = /Signal/i.test(sectionName) ? SIGNAL_HARD : UNIT_HARD;
    // The Signal is 2 IDEAS, not 3 units, so the generic 3-unit budget would never bind on it
    // (3 x 340 = 1,020 against a section that should run ~665). Its two bold one-line headers are
    // real blocks but are not ideas, hence the small headline allowance.
    const isSignalSection = /Signal/i.test(sectionName);
    const allowedUnits = isSignalSection ? 2 : 3;
    const headlineAllowance = isSignalSection ? 80 : 0;
    const budget = allowedUnits * sectionUnitHard + headlineAllowance + Math.min(depthUnits, 2) * (DEPTH - sectionUnitHard);
    if (total > budget) {
      out.push({ check: 'six-section-word-budget',
        message: `OVER: ${sectionName} totals ${total} words across ${units.length} unit(s) against a ${budget}-word section budget (${allowedUnits} x ${sectionUnitHard}${depthUnits ? ` + ${Math.min(depthUnits, 2)} depth-treatment` : ''}). The Six runs 2-3 units per section; compress or cut a unit.` });
    }
  }
  return out;
}

// checkSixBulletWordCeiling — REMOVED 2026-08-03.
// It measured only lines starting with `- **`. On 08-01 and 08-03 the Writer composed
// Markets & Macro and Geopolitics as bold-lead PROSE, so the ONLY length check with a
// blocking HARD FAIL found zero bullets in the two sections carrying the entire overrun
// and reported no violations on an 8,241-word brief. checkSixSectionWordBudget below does
// the same job format-agnostically and always prints its unit count, so blindness is
// visible instead of silent. Two checks measuring one thing, one of them blind, is worse
// than one check that sees: the blind one was the one with teeth.

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
        // Check 80% word overlap.
        // FIXED 2026-07-13 (brief-morning): this counted DUPLICATE stopwords in the longer
        // sentence against the shorter sentence's length, so a long sentence containing "the"
        // four times scored 4 shared words against a 5-word follower. Overlap could exceed
        // 100% (the 07-13 run reported "133%"), which is arithmetically impossible for a real
        // overlap ratio and is the tell that the metric was broken. Three false FAILs on clean
        // prose ("The spend is not disappearing." / "The distinction is felt, not calculated.")
        // would have forced a morning rewrite of good sentences to satisfy a broken check.
        // Fix: compare UNIQUE CONTENT words only. The substring check above still catches the
        // real merge artifacts this gate exists for.
        const STOPWORDS = new Set([
          'the', 'a', 'an', 'is', 'it', 'of', 'to', 'and', 'in', 'that', 'not', 'on', 'for',
          'as', 'at', 'by', 'be', 'are', 'was', 'were', 'this', 'its', 'with', 'or', 'but',
          'from', 'so', 'than', 'then', 'only', 'one', 'you', 'your', 'they', 'their', 'has',
          'have', 'had', 'what', 'which', 'when', 'where', 'who', 'will', 'would', 'can',
        ]);
        const contentWords = (s: string) =>
          [...new Set(s.split(/\s+/).filter((w) => w && !STOPWORDS.has(w)))];
        const wordsA = contentWords(a);
        const wordsB = contentWords(b);
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

// --- Payoff class contract check (reworked 2026-07-10 — Ceiling Doctrine v0.5 §4; was the
// July 3 Convergence-class presence-check). Convergence-threading is RETIRED
// (E-CONVERGENCE-ASSEMBLY-01 CLOSED-SUPERSEDED): the synthesis now lives in the Intro
// Summary (the payoff), written last. This check asserts the QG's PAYOFF log contract:
//   1. LEGACY DRIFT: an executed SYNTHESIS DESIGNATION in the QG log means the QG ran the
//      retired spec — same hard-fail semantics as the old check (drift detection).
//   2. THEME/INVENTORY shipped un-rewritten: a 'PAYOFF CLASS: THEME|INVENTORY' line whose
//      action reads 'none-needed'/'already payoff-grade' violates PASS 1g step 4 (the QG
//      MUST rewrite a label/inventory intro toward MECHANISM/TENSION or parallel-tracks).
//   3. Identified-not-executed: a MECHANISM/TENSION payoff class with no PAYOFF EXECUTION
//      line = the gate was skipped (same failure shape the old execution checkpoint caught).
// --- Pre-draft bypass DISCLOSURE (added 2026-07-12 — IMP-038, E-WRITER-COMPONENT-BYPASS-01).
// The bypass gate lives at brief-draft and Editor Gate 0. This is the leg that does not depend on
// an agent reading prose: the validator is a HARD STOP at 7:00 PM, and it will not pass a brief
// whose v1 ignored a gate-passed pre-draft SILENTLY.
//
// It does not require the pre-draft to win — the QG may legitimately restore it, and the Architect
// may legitimately override it. It requires the bypass to be DISCLOSED (PREDRAFT-BYPASS /
// PREDRAFT-OVERRIDE / a restored-from-pre-draft log line). On 07-12 the QG rewrote ~85% of the
// brief back to the pre-drafts, logged none of it, and the brief scored MUST-READ: the worst
// generation failure in tracking history was invisible in every artifact except a side-by-side
// human read. On 07-09 the bypass was not repaired at all — it PUBLISHED. Silence is the bug.
function checkPredraftBypassDisclosure(briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const bd = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!bd) return out;

  const v1 = ['-v1.md', '-v1-pre-quality-gate.md']
    .map((s) => path.join(briefDir, `${bd}${s}`))
    .find((p) => fs.existsSync(p));
  if (!v1) return out; // no v1 on disk (published-file validation) → nothing to compare

  const gate = path.join(process.cwd(), 'scripts', 'predraft-consumption-gate.ts');
  if (!fs.existsSync(gate)) return out;
  const res = spawnSync('node', ['--experimental-strip-types', gate, bd, '--advisory'],
    { encoding: 'utf8', timeout: 60000 });
  const stdout = res.stdout ?? '';
  const bypassed = [...stdout.matchAll(/\[A\] (\w[\w&]*): PRE-DRAFT BYPASSED/g)].map((m) => m[1]);
  if (bypassed.length === 0) return out;

  // Disclosure may live in any artifact the humans and downstream gates actually read.
  const disclosureFiles = [
    path.join(briefDir, `${bd}-quality-gate-log.md`),
    path.join(briefDir, `${bd}-editor-log.md`),
    path.join(briefDir, `${bd}-pipeline-status.md`),
    v1,
  ];
  const disclosed = disclosureFiles
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  const undisclosed = bypassed.filter(
    (c) => !new RegExp(`PREDRAFT-(BYPASS|OVERRIDE)[^\\n]*${c!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(disclosed)
      && !new RegExp(`PREDRAFT-(BYPASS|OVERRIDE)`, 'i').test(disclosed),
  );
  if (undisclosed.length) {
    out.push({
      check: 'predraft-bypass-undisclosed',
      message:
        `🔴 FAIL: v1 authored substitutes for gate-passed pre-draft(s) [${undisclosed.join(', ')}] and NOTHING in the ` +
        `pipeline said so. The pre-drafts carry the rotation checks, the ban lists, and the primary verification; ` +
        `the substitutes carry none of them (07-12: five fabricated claims). Either restore the section from ` +
        `daily-briefs/${bd}-{component}-draft.md and log \`PREDRAFT-BYPASS REPAIRED: {component}\`, or declare ` +
        `\`PREDRAFT-OVERRIDE: {component} :: {reason}\`. A silent bypass is not publishable — not because the prose ` +
        `is bad, but because nobody knows it happened.`,
    });
  }
  return out;
}

function checkConvergenceClass(briefDir: string, absPath: string): Failure[] {
  const out: Failure[] = [];
  const briefDateMatch = path.basename(absPath).match(/(\d{4}-\d{2}-\d{2})/);
  if (!briefDateMatch) return out;
  const bd = briefDateMatch[1];
  const qgLog = path.join(briefDir, `${bd}-quality-gate-log.md`);
  if (!fs.existsSync(qgLog)) return out;
  const qgContent = fs.readFileSync(qgLog, 'utf8');

  // 1. Legacy drift: the retired body-threading gate executed.
  const hasSynthesis = qgContent.includes('SYNTHESIS DESIGNATION:') &&
    !qgContent.includes('not triggered');
  if (hasSynthesis) {
    out.push({
      check: 'retired-synthesis-designation-executed',
      message: `🔴 FAIL: QG log contains an executed SYNTHESIS DESIGNATION — the body-threading synthesis gate was RETIRED 2026-07-10 (Ceiling Doctrine v0.5; the synthesis lives in the Intro Summary now). The QG ran a stale spec: reload system/Novelty_Audit.md (PASS 1g PAYOFF CHECK) and remove the body cross-reference.`,
    });
  }

  // 2 + 3. New payoff-class contract (fires only on the new grammar; silent on old logs).
  const payoffLine = qgContent.match(/PAYOFF CLASS:\s*([^\n]*)/i);
  if (payoffLine) {
    const line = payoffLine[1];
    const cls = /MECHANISM/i.test(line) ? 'MECHANISM' : /TENSION/i.test(line) ? 'TENSION'
      : /THEME/i.test(line) ? 'THEME' : /INVENTORY/i.test(line) ? 'INVENTORY' : 'UNKNOWN';
    const noRewrite = /action\s*=\s*\[?\s*(none-needed|already payoff-grade)/i.test(line);
    if ((cls === 'THEME' || cls === 'INVENTORY') && noRewrite) {
      out.push({
        check: 'payoff-theme-shipped-unrewritten',
        message: `🔴 FAIL: QG log classifies the intro payoff as ${cls} with action=none-needed/already-payoff-grade. PASS 1g step 4 REQUIRES the rewrite: a THEME label or headline inventory may not stand as the intro's conclusion — rewrite to the sweep's MECHANISM/TENSION candidate or to the parallel-tracks lead (strongest story + watch).`,
      });
    }
    if ((cls === 'MECHANISM' || cls === 'TENSION') && !/PAYOFF EXECUTION:/i.test(qgContent)) {
      out.push({
        check: 'payoff-identified-not-executed',
        message: `🔴 FAIL: QG log has PAYOFF CLASS: ${cls} but no 'PAYOFF EXECUTION:' line — the payoff was identified but the execution checkpoint (classify → rewrite-if-owed → verify watch → log) did not run. Equivalent to not running the gate.`,
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

// ── IMP-113 (2026-08-01 Critic mandate #2, 🔴, RC2): CATALYST ENUMERATION ─────────────────────
// RECEIPT: 08-01 M&M-2 framed the record Kospi session as "the two available explanations imply
// opposite trades" and rested its whole architecture on "the discriminator does not exist until
// August 7-10". The discriminator DID exist on Friday and the wire had it: hedge fund Situational
// Awareness completed its deleveraging, foreign investors net bought W7.22tn against ~$5.7bn of
// retail selling, and Samsung and SK Hynix both reported strong earnings. Three reported catalysts,
// zero named, in a bullet whose value proposition IS enumerating catalysts. Same failure shape as
// the 07-31 Take fleet data: the Writer reasoning from a frame instead of from the tape.
//
// THE GATE: a Six bullet that frames COMPETING EXPLANATIONS must contain at least one ATTRIBUTED
// CATALYST inside the same bullet — a named fund/desk, a flow figure, an earnings reference, or a
// wire source. Deliberately narrow: the trigger is the competing-explanation architecture itself, so
// an ordinary bullet is untouched, and the clear is satisfiable only by naming what was reported.
// Override-eligible (evidence in the editor log) — a genuine "the wire reported nothing" case has a
// DECLARED path, never silence.
const COMPETING_FRAME_RE = /\btwo (?:available |possible |competing )?(?:explanations|readings|stories|interpretations)\b|\bthe two readings\b|\bopposite trades\b|\bthe other read\b|\bthe second reading\b|\btwo ways to read\b/i;
const CATALYST_NAMED_FUND_RE = /\b(?:hedge fund|asset manager|the desk at)\s+[A-Z]|\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\s+(?:Capital|Management|Partners|Advisors|Securities|Asset Management)\b/;
const CATALYST_FLOW_RE = /\bnet (?:bought|sold|buying|selling|purchases|inflows?|outflows?)\b|\b(?:inflows?|outflows?|net flows?)\s+of\b|\bforeign (?:investors?|buying|selling)\b[^.]{0,60}\d/i;
const CATALYST_EARNINGS_RE = /\b(?:reported|posted|printed)\s+(?:strong\s+|weak\s+|record\s+)?(?:earnings|results|revenue|profit|a beat|a miss)\b|\bearnings (?:beat|miss|report|print)\b|\bEPS\b/i;
const CATALYST_WIRE_RE = /\b(?:Reuters|Bloomberg|Nikkei|Yonhap|Associated Press|Dow Jones|Wall Street Journal|WSJ|Financial Times|CNBC|AFP|Xinhua|Kyodo)\b/;
function hasAttributedCatalyst(bullet: string): boolean {
  return CATALYST_NAMED_FUND_RE.test(bullet) || CATALYST_FLOW_RE.test(bullet) ||
         CATALYST_EARNINGS_RE.test(bullet) || CATALYST_WIRE_RE.test(bullet);
}
export function checkCatalystEnumeration(body: string): Failure[] {
  const out: Failure[] = [];
  const sixStart = body.indexOf('# ▸ THE SIX');
  if (sixStart === -1) return out;
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  const sixBody = body.slice(sixStart, sixEnd === -1 ? undefined : sixEnd);
  let section = '';
  let idx = 0;
  for (const block of sixBody.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    const h = b.match(/^##\s+(.+)$/m);
    if (h && /^##/.test(b)) { section = h[1]!.trim(); idx = 0; continue; }
    if (!/^(?:-\s*)?\*\*/.test(b)) continue;
    idx++;
    if (!COMPETING_FRAME_RE.test(b)) continue;
    if (hasAttributedCatalyst(b)) continue;
    out.push({
      check: 'catalyst-enumeration',
      message: `🔴 FAIL: ${section || 'Six'} bullet ${idx} frames COMPETING EXPLANATIONS ("${(b.match(COMPETING_FRAME_RE) || [''])[0]}") but names NO attributed catalyst — no named fund/desk, no flow figure, no earnings reference, no wire source anywhere in the bullet. A bullet whose value proposition is enumerating explanations must first name the proximate cause(s) actually reported and dispose of each one (adopted / rejected with a stated reason / folded in) before proposing an alternative frame. If the wire genuinely reported no cause, say so in the bullet, or declare FALSE-POSITIVE OVERRIDE: [catalyst-enumeration] with the evidence in the editor log.`,
    });
  }
  return out;
}

// ── IMP-118 (2026-08-02 Critic mandate #2, 🔴, RC5): PRECEDENT ANALOGY ────────────────────────
// RECEIPT: E-WRITER-CATALYST-OMISSION-01 Day 2 — it recurred ONE DAY after IMP-113 shipped, one
// bullet UPSTREAM of the bullet IMP-113 fixed. 08-02 M&M-1 (the brief's lede and the payoff's
// anchor) told the reader to "price the base rate of non-execution" because "this same option …
// reached the order stage once before and Trump paused it in late March" — and never named the
// proximate cause of THIS escalation: Iran's 29 July missile attack on US forces in Jordan (IRGC
// hit Muwaffaq Salti Air Base and a CENTCOM centre; Jordan intercepted five missiles), after which
// Trump said the US would "be hitting them hard" and ran a "heavy wave" of strikes on Thursday.
// Verified: Al Jazeera 2026-07-29, Forbes 2026-07-29, NPR 2026-07-30. A precedent analogy is a
// STRONGER claim than a competing-explanation frame — it asserts the causal setup is unchanged —
// so it needs the current cause on the page even more.
//
// WHY THE CLEAR IS A DECLARATION, NOT A CONTENT TEST (the honest part). IMP-113's model — trigger
// on the frame, clear on an attributed catalyst — CANNOT work here, and this was tested rather
// than assumed: the real 08-02 M&M-1 satisfies every content-based clear-condition available. It
// carries three wire sources (WSJ, CBS, NBC), a dated actor action ("ordered … at 21:24 UTC
// Friday"), and an explicit what-changed enumeration ("two things argue that base rate is now
// weaker and one argues the tail is fatter"). `hasAttributedCatalyst()` returns TRUE on it. What
// is missing is a FACT ABOUT THE WORLD — the Jordan attack — and no regex knows the Jordan attack
// happened. Any auto-clear tuned to fire here would be an arbitrary discriminator, which is a
// Goodhart trap with a false-positive tail. So the gate does the one thing it CAN do honestly: it
// makes a rare, high-damage shape MANDATORY TO DECLARE. The Editor either adds the proximate cause
// to the bullet or writes the override naming the most recent dated event in that theatre and the
// source that carried it — the check that was skipped becomes a check on the record.
// FALSE-POSITIVE COST, measured: 0 trigger hits across the trailing 30 published briefs. This
// shape appears roughly once a month; the declaration is cheap and the omission is not.
const PRECEDENT_ANALOGY_RE = /\b(?:the )?base rate of\b|\breached (?:the|this) (?:order|same) stage (?:once )?before\b|\bthis same (?:option|play|sequence)\b|\bthe last time this\b|\bpaused it in\b|\bwithdrawn once\b/i;
export function checkPrecedentAnalogy(body: string): Failure[] {
  const out: Failure[] = [];
  const sixStart = body.indexOf('# ▸ THE SIX');
  if (sixStart === -1) return out;
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  const sixBody = body.slice(sixStart, sixEnd === -1 ? undefined : sixEnd);
  let section = '';
  let idx = 0;
  for (const block of sixBody.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    const h = b.match(/^##\s+(.+)$/m);
    if (h && /^##/.test(b)) { section = h[1]!.trim(); idx = 0; continue; }
    if (!/^(?:-\s*)?\*\*/.test(b)) continue;
    idx++;
    const m = b.match(PRECEDENT_ANALOGY_RE);
    if (!m) continue;
    out.push({
      check: 'precedent-analogy',
      message: `🔴 FAIL: ${section || 'Six'} bullet ${idx} prices a PRECEDENT ANALOGY ("${m[0]}") — it asserts the causal setup is unchanged since a prior instance and instructs the reader to price that base rate. A precedent is a claim that the setup is the SAME; earn it by naming what is DIFFERENT. Before this ships, sweep the wire for the proximate event that triggered THIS instance (the subject event's own report does not count, and neither does commentary about it) and put it in the bullet. If the sweep genuinely returns nothing new, declare FALSE-POSITIVE OVERRIDE: [precedent-analogy] in the editor log, naming the most recent dated event in that theatre and the source that carried it. Receipt: 08-02 M&M-1 built its whole read on the late-March pause and omitted Iran's 29 July missile attack on US forces in Jordan (Al Jazeera 2026-07-29, NPR 2026-07-30).`,
    });
  }
  return out;
}

// ── IMP-122 (2026-08-03 Critic mandate #3, 🟡, RC5): THE HOOK'S NUMERATOR ─────────────────────
// RECEIPT: 08-03 AI&T-3 opened "Two frontier labs' own models breached SIX real organizations
// during safety evaluations" and the body substantiates THREE — "Anthropic's three incidents out of
// 141,006 runs… a 0.002 percent rate". The second lab's contribution is never enumerated; indeed
// the bullet's own payload is that the OpenAI model "was internal-only, never released, and
// therefore outside every safety framework". The reader is handed a numerator the paragraph never
// reaches, and the 0.002% rate — correctly computed from 3/141,006 — is arithmetically inconsistent
// with a six-organization claim.
//
// GENERALISES IMP-116's RATIO RULE FROM RATIOS TO COUNTS: a numerator the body never reaches is the
// same failure as a numerator without a denominator. The bold hook is the sentence most readers
// retain and often the only one they read; a count in it is a PROMISE THE BODY MUST PAY.
//
// NARROW BY CONSTRUCTION — the entity-noun set is exactly the Critic's, not a wider guess. That is
// why the three negatives it names are silent for a structural reason rather than a tuned one:
// Geo-3's "About 49,000 people", Wild Card 2's "Nine American schools" and AI&T-2's "Four position
// documents" carry nouns outside the set. Widening the set to catch them would buy false positives
// on every count the body legitimately leaves as an aggregate. Override-eligible, so a genuinely
// substantiated count that the regex cannot see has a DECLARED path, never silence.
const HOOK_ENTITY_NOUN = 'organi[sz]ations?|companies|firms|systems|countries|agencies|banks';
// `(?<![-\w])` is load-bearing, not decoration: without it the sweep flagged 2026-07-25's
// "**Twenty-five** US tech companies" because `\bfive\b` matches inside a hyphenated compound.
const HOOK_COUNT_RE = new RegExp(String.raw`(?<![-\w])(six|five|four|three|two|\d+)\s+(?:\w+\s+){0,2}?(${HOOK_ENTITY_NOUN})\b`, 'i');
// THE ENUMERABLE RANGE. A hook count is a PROMISE only when the body could plausibly pay it item by
// item. "Crypto venture participation fell to **150 firms** in July" (07-29) is a market statistic,
// not an enumeration owed — demanding the body list 150 firms is a category error. Floor of 3 for
// the mirror reason: a two-item hook is paid in prose essentially every time ("the one that…, the
// one that…" — 08-01 C&C-2), so a count of two carries no gap worth detecting. Both bounds were set
// by the false-positive sweep, not by taste.
const HOOK_COUNT_MIN = 3;
const HOOK_COUNT_MAX = 10;
/** A comma-separated run of proper nouns / acronyms — the body naming the entities it promised.
 *  An item may carry an internal lowercase connective ("Bank **of** America"): without that the
 *  07-15 list "JPMorgan, Bank of America, Goldman, Wells, and Citi" counted 4 of its 5 members and
 *  the gate flagged a bullet that had named every bank it promised. */
const NAMED_ITEM = String.raw`[A-Z][A-Za-z&.'’-]*(?:\s+(?:of|the|de|van|von|und|&)\s+[A-Z][A-Za-z&.'’-]*|\s+[A-Z][A-Za-z&.'’-]*){0,2}`;
const NAMED_LIST_RE = new RegExp(String.raw`${NAMED_ITEM}(?:,\s+(?:and\s+)?${NAMED_ITEM}){2,}`, 'g');
const CARDINAL: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toCount = (s: string): number | null => {
  const w = CARDINAL[s.toLowerCase()];
  if (w) return w;
  const n = parseInt(s.replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
/** The bold hook is the leading `**…**` run of the bullet; the body is everything after it. */
function splitHook(bullet: string): { hook: string; body: string } | null {
  const m = bullet.match(/\*\*([\s\S]*?)\*\*/);
  if (!m) return null;
  return { hook: m[1]!, body: bullet.slice(m.index! + m[0].length) };
}
export function checkHookNumeratorSubstantiation(body: string): Failure[] {
  const out: Failure[] = [];
  const sixStart = body.indexOf('# ▸ THE SIX');
  if (sixStart === -1) return out;
  const sixEnd = body.indexOf('# ▸ THE TAKE');
  const sixBody = body.slice(sixStart, sixEnd === -1 ? undefined : sixEnd);
  let section = '';
  let idx = 0;
  for (const block of sixBody.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    const h = b.match(/^##\s+(.+)$/m);
    if (h && /^##/.test(b)) { section = h[1]!.trim(); idx = 0; continue; }
    if (!/^(?:-\s*)?\*\*/.test(b)) continue;
    idx++;
    const parts = splitHook(b);
    if (!parts) continue;
    const m = parts.hook.match(HOOK_COUNT_RE);
    if (!m) continue;
    const claimed = toCount(m[1]!);
    if (claimed === null || claimed < HOOK_COUNT_MIN || claimed > HOOK_COUNT_MAX) continue;
    const noun = m[2]!;
    // THE BODY PAYS THE PROMISE two ways. (1) THE NUMERATOR REAPPEARS in the body's accounting —
    // deliberately not "bound to the same noun", and this was learned from the artifact: this
    // morning's CORRECTED AI&T-3 reads "three real outside organizations" in the hook and pays it
    // with "Anthropic's **three** incidents out of 141,006 runs". A noun-bound test flags the fixed
    // bullet, which would make the gate an obstacle to its own repair. (2) An ENUMERATION SUMS to
    // it. Over-delivery is not a defect, so ≥ clears.
    const numeralWord = Object.entries(CARDINAL).find(([, v]) => v === claimed)?.[0] ?? '';
    const reappearsRe = new RegExp(String.raw`(?<![-\w])(?:${claimed}${numeralWord ? `|${numeralWord}` : ''})\b`, 'i');
    const bodyCounts = [...parts.body.matchAll(
      new RegExp(String.raw`(?<![-\w])(one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s+(?:\w+\s+){0,2}?(?:${HOOK_ENTITY_NOUN})\b`, 'gi'),
    )].map((x) => toCount(x[1]!) ?? 0);
    const reappears = reappearsRe.test(parts.body);
    const summed = bodyCounts.length > 1 && bodyCounts.reduce((a, c) => a + c, 0) >= claimed;
    // (3) ENUMERATION BY NAME — the well-written case, and the sweep's last two false positives
    // were both exactly it: 07-18's "six agencies" pays with "The OCC, FDIC, Fed, SEC, CFTC, and
    // Treasury", 07-15's "five largest US banks" with "JPMorgan, Bank of America, Goldman, Wells,
    // and Citi". A body that NAMES all N has paid the promise more completely than one that
    // restates the number, so this must clear or the gate punishes the best version of the bullet.
    const named = Math.max(0, ...[...parts.body.matchAll(NAMED_LIST_RE)].map((x) => x[0].split(',').length));
    if (reappears || summed || named >= claimed) continue;
    out.push({
      check: 'hook-numerator',
      message: `🔴 FAIL: ${section || 'Six'} bullet ${idx}'s BOLD HOOK asserts a count of ${claimed} ${noun} ("${m[0]}") and the body never reaches it — no restatement of ${claimed} ${noun}, and no enumeration summing to ${claimed}${bodyCounts.length ? ` (the body accounts for ${bodyCounts.reduce((a, c) => a + c, 0)})` : ' (the body names no count against that noun at all)'}. The hook is the sentence most readers retain and often the only one they read: a count in it is a promise the body must pay. Either enumerate the remainder or restate the hook at the number you can substantiate. Generalises IMP-116's RATIO RULE from ratios to counts — a numerator the body never reaches is the same failure as a numerator without a denominator. If the remainder IS substantiated somewhere the check cannot see it, declare FALSE-POSITIVE OVERRIDE: [hook-numerator] naming where. Receipt: 08-03 AI&T-3 claimed "six real organizations" and substantiated three (Anthropic, 3 incidents / 141,006 runs), while its own payload was that the second lab's model was never released.`,
    });
  }
  return out;
}

// ── IMP-123 (2026-08-03 pipeline defect, RC3 → mechanised): MARKER PLACEMENT ──────────────────
// RECEIPT: the Editor wrote `<!-- take-move: orthogonal-compliance -->` on LINE 1 of
// daily-briefs/2026-08-03-v2.md. `publish.py`'s corruption guard ("File doesn't start with a
// markdown heading — may be corrupted") rejected the file, and the brief lost a full publish
// attempt on a morning that was already fighting a network failure. This is NOT day one: the same
// marker sits on line 1 of daily-briefs/2026-08-02-v2.md. Nothing upstream caught either.
//
// THE DISCRIMINATOR IS CLEAN AND MEASURED: **0 of the trailing 60 published briefs carry any HTML
// comment before the first heading.** The rule is therefore absolute and needs no tuning — a marker
// is metadata about a section, so it belongs INSIDE that section (the 08-01 precedent puts
// `take-move` inside The Take), and nothing whatsoever belongs above the document's own title.
// HARD FAIL, and deliberately not override-eligible: this is a file-format invariant that a
// downstream consumer enforces by refusing to publish, not a judgment call.
export function checkMarkerPlacement(body: string): Failure[] {
  const out: Failure[] = [];
  const firstHeading = body.search(/^#/m);
  const preamble = firstHeading === -1 ? body : body.slice(0, firstHeading);
  for (const m of preamble.matchAll(/<!--([\s\S]*?)-->/g)) {
    out.push({
      check: 'marker-placement',
      message: `🔴 FAIL: an HTML marker (\`<!--${m[1]!.trim().slice(0, 60)}-->\`) sits BEFORE the document's first markdown heading. \`publish.py\` treats a file that does not start with a heading as CORRUPTED and refuses to publish it — this cost the 2026-08-03 brief a full publish attempt during a network incident, and the identical marker is on line 1 of the 08-02 v2. A marker is metadata about a section and belongs INSIDE that section (\`take-move\` goes in The Take — see the 08-01 precedent). 0 of the trailing 60 published briefs carry a comment above the first heading; there is no legitimate case. Move it, do not override it.`,
    });
  }
  // DELIBERATELY NOT CHECKED: where `take-move` sits *relative to* `# ▸ THE TAKE`. The first draft
  // of this gate asserted the marker must live INSIDE the Take section and the archive said no —
  // 07-15, 07-16 and 08-01 all place it immediately ABOVE the `# ▸ THE TAKE` heading, after the
  // `---` rule, and 07-02 puts it under the document title. That is a convention this session
  // invented, not one the system has; enforcing it would have failed 4 of 60 published briefs on
  // day one. The invariant that IS real, is measured, and is the one a downstream consumer
  // actually enforces is the single rule above: nothing above the first heading.
  return out;
}

// ── IMP-113 selftest — fixtures + the REAL 08-01 acceptance gate (fires on M&M-2, silent on M&M-3)
function selftestValidator(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`); if (!ok) fails++; };
  const wrap = (mm: string) => `# ▸ THE SIX\n\n## Markets & Macro\n\n${mm}\n\n# ▸ THE TAKE\n\n**A take.** Body.\n`;
  const BAD = `**A record move, and the two available explanations imply opposite trades.** Part of it is mechanical: the name had fallen 58% into the session. The other read is that a dated forecast came due, and the discriminator does not exist until August 7.`;
  const GOOD_WIRE = `**A record move, and the two available explanations imply opposite trades.** Reuters reported the forced seller had finished; the other read is that a dated forecast came due.`;
  const GOOD_FLOW = `**A record move, and the two available explanations imply opposite trades.** Foreign investors net bought 7.22 trillion won against retail selling; the other read is a dated forecast coming due.`;
  const ORDINARY = `**The Employment Cost Index landed Friday with private compensation up 3.3%.** Benefits ran 3.8% against wages at 3.1%, a 70bp gap.`;
  t(checkCatalystEnumeration(wrap(BAD)).length === 1, '[IMP-113] FIRES on competing-explanation framing with no attributed catalyst');
  t(checkCatalystEnumeration(wrap(GOOD_WIRE)).length === 0, '[IMP-113] SILENT when the bullet cites a wire source (Reuters)');
  t(checkCatalystEnumeration(wrap(GOOD_FLOW)).length === 0, '[IMP-113] SILENT when the bullet carries a flow figure (net bought)');
  t(checkCatalystEnumeration(wrap(ORDINARY)).length === 0, '[IMP-113] SILENT on an ordinary bullet with no competing-explanation framing');
  // ACCEPTANCE GATE, real artifact: fires on the published 08-01 M&M-2, silent on 08-01 M&M-3.
  const real = path.join(process.cwd(), 'content/daily-updates/2026-08-01.md');
  if (fs.existsSync(real)) {
    const f = checkCatalystEnumeration(stripComments(fs.readFileSync(real, 'utf8')));
    t(f.length === 1 && /bullet 2\b/.test(f[0]!.message), `[IMP-113] REAL 08-01: fires on M&M-2 and ONLY M&M-2 (got ${f.length}: ${f.map(x => x.message.slice(0, 40)).join('; ')})`);
    const mm3 = fs.readFileSync(real, 'utf8').split(/\n\s*\n/).find(b => /Japan and Korea intervened jointly/.test(b)) || '';
    t(!!mm3 && hasAttributedCatalyst(mm3), '[IMP-113] REAL 08-01 M&M-3 carries an attributed catalyst (Barraud, citing Reuters) → SILENT');
  }

  // ── IMP-118 PRECEDENT ANALOGY — fixtures + the REAL 08-02 acceptance gate ───────────────────
  const PREC_BAD = `**The order lands in the one stretch of the week when nothing can take the other side.** The print is a bet on the base rate of non-execution, because this same option reached the order stage once before and Trump paused it in late March.`;
  const PREC_NONE = `**The Employment Cost Index landed Friday with private compensation up 3.3%.** Benefits ran 3.8% against wages at 3.1%, a 70bp gap that has not closed since 2022.`;
  t(checkPrecedentAnalogy(wrap(PREC_BAD)).length === 1, '[IMP-118] FIRES on a precedent-analogy bullet pricing a base rate');
  t(checkPrecedentAnalogy(wrap(PREC_NONE)).length === 0, '[IMP-118] SILENT on an ordinary bullet with no precedent framing');
  // The IMP-113 fixtures must stay in their own lane — a competing-explanation frame is NOT a
  // precedent analogy, so the two gates never double-charge the same bullet.
  t(checkPrecedentAnalogy(wrap(BAD)).length === 0, '[IMP-118] SILENT on the IMP-113 competing-explanation fixture (no double-jeopardy)');
  // ACCEPTANCE GATE, real artifacts: fires on the real 08-02 M&M-1; silent on the real 08-02 M&M-3
  // and on the real published 08-01 (whose M&M-2 is IMP-113's case, already fixed).
  const v2 = path.join(process.cwd(), 'daily-briefs/2026-08-02-v2.md');
  if (fs.existsSync(v2)) {
    const f = checkPrecedentAnalogy(stripComments(fs.readFileSync(v2, 'utf8')));
    t(f.length === 1 && /bullet 1\b/.test(f[0]!.message),
      `[IMP-118] REAL 08-02 v2: fires on M&M-1 and ONLY M&M-1 (got ${f.length}: ${f.map(x => x.message.slice(0, 46)).join('; ')})`);
    const mm3 = fs.readFileSync(v2, 'utf8').split(/\n\s*\n/).find(b => /Japan spent roughly \$53 billion/.test(b)) || '';
    t(!!mm3 && !PRECEDENT_ANALOGY_RE.test(mm3), '[IMP-118] REAL 08-02 M&M-3 (Setser/Pettis/BOJ) does NOT trigger → SILENT');
  }
  const pub01 = path.join(process.cwd(), 'content/daily-updates/2026-08-01.md');
  if (fs.existsSync(pub01)) {
    t(checkPrecedentAnalogy(stripComments(fs.readFileSync(pub01, 'utf8'))).length === 0,
      '[IMP-118] REAL published 08-01: SILENT (the IMP-113 bullet is not a precedent analogy)');
  }
  // FALSE-POSITIVE SWEEP, on the record: 0 hits across the trailing 30 published briefs.
  {
    const dir = path.join(process.cwd(), 'content/daily-updates');
    let hits = 0, swept = 0;
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter(x => /^2026-\d\d-\d\d\.md$/.test(x)).sort().slice(-30)) {
        swept++;
        hits += checkPrecedentAnalogy(stripComments(fs.readFileSync(path.join(dir, f), 'utf8'))).length;
      }
    }
    t(hits === 0, `[IMP-118] FALSE-POSITIVE SWEEP: ${hits} flag(s) across the trailing ${swept} published briefs (expected 0)`);
  }

  // ── IMP-122: THE HOOK'S NUMERATOR — a count in the hook is a promise the body must pay ────────
  {
    const v2_0803 = path.join(process.cwd(), 'daily-briefs/2026-08-03-v2.md');
    if (fs.existsSync(v2_0803)) {
      const raw0803 = stripComments(fs.readFileSync(v2_0803, 'utf8'));
      const f = checkHookNumeratorSubstantiation(raw0803);
      t(f.length === 1 && /count of 6 organi/i.test(f[0]!.message),
        `[IMP-122] REAL 08-03 v2: fires on AI&T-3's "six real organizations" and ONLY it (got ${f.length}: ${f.map(x => x.message.slice(0, 60)).join('; ')})`);
      // The three negatives the Critic named, asserted individually so a future widening of the
      // noun set cannot silently break them.
      const blockWith = (needle: string) => raw0803.split(/\n\s*\n/).find(b => b.includes(needle)) || '';
      for (const [needle, label] of [
        ['49,000 people crossed', 'Geo-3 "About 49,000 people" (substantiated)'],
        ['Nine American schools', 'Wild Card 2 "Nine American schools" (three states, eight districts)'],
        ['Four position documents', 'AI&T-2 "Four position documents" (all four enumerated)'],
      ] as [string, string][]) {
        const blk = blockWith(needle);
        const parts = blk ? splitHook(blk) : null;
        t(!!blk && (!parts || !HOOK_COUNT_RE.test(parts.hook)), `[IMP-122] SILENT on ${label}`);
      }
      // SUBSTANTIATION CLEARS: the same bullet with the body naming the remainder must go silent.
      const paid = `# ▸ THE SIX\n\n## AI & Tech\n\n- **Two frontier labs' own models breached six real organizations during safety evaluations.** Anthropic accounts for three organizations and OpenAI for three organizations, enumerated below.\n`;
      t(checkHookNumeratorSubstantiation(paid).length === 0, '[IMP-122] SILENT once the body enumerates 3 + 3 = the hook\'s six');
      const restated = `# ▸ THE SIX\n\n## AI & Tech\n\n- **Models breached six real organizations.** All six organizations were notified.\n`;
      t(checkHookNumeratorSubstantiation(restated).length === 0, '[IMP-122] SILENT when the body restates the same count against the same noun');
    }
    // FALSE-POSITIVE SWEEP across the trailing 30 published briefs.
    const dir = path.join(process.cwd(), 'content/daily-updates');
    let hits = 0, swept = 0;
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter(x => /^2026-\d\d-\d\d\.md$/.test(x)).sort().slice(-30)) {
        swept++;
        hits += checkHookNumeratorSubstantiation(stripComments(fs.readFileSync(path.join(dir, f), 'utf8'))).length;
      }
    }
    t(hits === 0, `[IMP-122] FALSE-POSITIVE SWEEP: ${hits} flag(s) across the trailing ${swept} published briefs (expected 0 — three substantiation paths: restated numeral, summed enumeration, named list)`);
  }

  // ── IMP-123: MARKER PLACEMENT — the line-1 marker that cost a publish attempt ──────────────────
  {
    const line1 = `<!-- take-move: orthogonal-compliance -->\n# MARKETS, MEDITATIONS & MENTAL MODELS\n\n# ▸ THE TAKE\n\nBody.\n`;
    t(checkMarkerPlacement(line1).some(f => /BEFORE the document's first markdown heading/.test(f.message)),
      '[IMP-123] FIRES on a marker above the first heading (the publish.py corruption signature)');
    const inside = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\n# ▸ THE TAKE\n\n<!-- take-move: effective-n-collapse -->\n\nBody.\n`;
    t(checkMarkerPlacement(inside).length === 0, '[IMP-123] SILENT when take-move sits inside The Take (the 08-01 precedent)');
    // The ARCHIVE'S OWN CONVENTION, asserted so a future session cannot "tidy" it into a failure:
    // take-move sits immediately ABOVE `# ▸ THE TAKE` (07-15, 07-16, 08-01) — that is CLEAN.
    const above = `# MARKETS, MEDITATIONS & MENTAL MODELS\n\nIntro.\n\n---\n\n<!-- take-move: effective-n-collapse -->\n\n# ▸ THE TAKE\n\nBody.\n`;
    t(checkMarkerPlacement(above).length === 0,
      '[IMP-123] SILENT when take-move sits just above `# ▸ THE TAKE` (the archive\'s actual convention, 3 of 4 occurrences)');
    // ACCEPTANCE GATE on the REAL artifacts: fires on the 08-03 and 08-02 v2 files (both line 1),
    // and is SILENT on the PUBLISHED 08-03 where the morning pass moved it into The Take.
    for (const [p, want, label] of [
      ['daily-briefs/2026-08-03-v2.md', true, 'REAL 08-03 v2 (marker on line 1 — cost a publish attempt)'],
      ['daily-briefs/2026-08-02-v2.md', true, 'REAL 08-02 v2 (same marker, line 1 — this is Day 2, not Day 1)'],
      ['content/daily-updates/2026-08-03.md', false, 'REAL published 08-03 (marker moved into The Take)'],
      ['content/daily-updates/2026-08-01.md', false, 'REAL published 08-01 (clean)'],
    ] as [string, boolean, string][]) {
      const abs = path.join(process.cwd(), p);
      if (!fs.existsSync(abs)) continue;
      const n = checkMarkerPlacement(fs.readFileSync(abs, 'utf8')).length;
      t(want ? n > 0 : n === 0, `[IMP-123] ${want ? 'FIRES' : 'SILENT'} on ${label}${want ? '' : ` (got ${n})`}`);
    }
    // FALSE-POSITIVE SWEEP: 0 of the trailing 60 published briefs carry a pre-heading comment.
    const dir = path.join(process.cwd(), 'content/daily-updates');
    let hits = 0, swept = 0;
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter(x => /^2026-\d\d-\d\d\.md$/.test(x)).sort().slice(-60)) {
        swept++;
        hits += checkMarkerPlacement(fs.readFileSync(path.join(dir, f), 'utf8')).length;
      }
    }
    t(hits === 0, `[IMP-123] FALSE-POSITIVE SWEEP: ${hits} flag(s) across the trailing ${swept} published briefs (expected 0)`);
  }

  console.log(`\nvalidate-brief selftest — ${fails ? 'FAILED' : 'PASS'} (catalyst-enumeration + precedent-analogy + hook-numerator + marker-placement verified both directions)`);
  return fails ? 1 : 0;
}

function main() {
  if (process.argv.slice(2).includes('--selftest')) process.exit(selftestValidator());
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
    // Rotation assignment gate (2026-07-24 — IMP-095 wiring): the taught model must be the
    // rotation's assignment for this date. Recency stays as the concept-name backstop.
    failures.push(...checkModelAssigned(body, recencyDateMatch[1]));
  }
  failures.push(...checkCandCBalance(body));
  failures.push(...checkDashboardNoTables(body));
  failures.push(...checkInnerGameStructure(body, raw));
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
  // --- Six section word budget: see the single format-agnostic check below ---
  {
    // SOFT CEILING — advisory only, never blocks (Jackson, 2026-08-01: "I don't want a strict
    // word budget I just want a soft ceiling"). The Editor compresses on these; the brief ships.
    const soft = [...checkSixSectionWordBudget(body), ...checkNamedSectionWordBudget(body)];
    for (const f of soft) console.log(`  🟡 [${f.check}] ${f.message}`);
    if (soft.length) console.log(`🟡 LENGTH ADVISORY — ${soft.length} section(s) over their soft ceiling. Compress where you can; this does NOT block the brief.`);
  }
  {
    // BRIEF LENGTH — the ONE blocking length rail (2026-08-03, Jackson).
    //
    // WHY IT BLOCKS: until today every length check in this file was advisory. The 2026-08-03
    // brief ran 8,241 words / 52 minutes against a 30-minute product and `validate-brief` exited
    // 0 with sixteen 🟡 findings. Sixteen advisories that never fail are a log, not a gate.
    //
    // WHY *ONE* RAIL AND NOT TWELVE: per-section ceilings can be satisfied while the brief still
    // runs long (write more units), and they go blind when markup changes. A whole-file word count
    // cannot be gamed and cannot go blind. Sections stay advisory — they tell the Writer WHERE;
    // this tells the Editor WHETHER.
    //
    // CALIBRATION: the 28 published July briefs — the 30-minute product we are getting back —
    // ran min 4,135 / median 4,924.5 (30.8 min) / max 6,846. A 5,500 ceiling would have fired on
    // 5 of those 28 (18%) — the over-5,500 set is 5,506 / 5,687 / 5,799 / 5,972 / 6,846. Rare
    // enough to mean something when it fires. 5,200 would have fired on 7/28 (25%) of work Jackson
    // accepted, which is how a gate earns the right to be ignored (IMP-125).
    //
    // CORRECTED 2026-08-03 (Cursor review). This comment said 4/28 (14%). That number was read off
    // a 5,600 measurement and never computed at 5,500; 5,506 sits eight words over the line. The
    // rail is unchanged — asserting a figure instead of measuring it is the precise failure this
    // whole engagement was about, so the receipt stays in the file.
    //
    // ENFORCEMENT EPOCH: the archive is read, never condemned. Briefs dated before 2026-08-04
    // are measured and reported, never failed — the mistake IMP-125 had to undo.
    //
    // ESCAPE HATCH: `<!-- LENGTH-OVERRIDE: <reason, 20+ chars> -->`. The brief ALWAYS ships; a
    // genuinely long day is a declared, countable editorial decision, not a silent drift. The
    // improvement loop counts overrides the same way it counts PREDRAFT-OVERRIDE.
    const w = body.split(/\s+/).filter(Boolean).length;
    const mins = Math.round(w / 160);
    const LEN_TARGET = 4800, LEN_SOFT = 5000, LEN_HARD = 5500, LEN_EPOCH = '2026-08-04';
    const lenDate = briefDateMatch ? briefDateMatch[1] : '';
    const lenOverride = /<!--\s*LENGTH-OVERRIDE:\s*([^>]{20,}?)\s*-->/.exec(raw);
    const mark = w > LEN_HARD ? '🔴' : w > LEN_SOFT ? '🟡' : '✅';
    console.log(`${mark} BRIEF LENGTH: ${w.toLocaleString()} words ≈ ${mins} min audio (target 30 min ≈ ${LEN_TARGET.toLocaleString()} words, ceiling ${LEN_HARD.toLocaleString()})`);
    // ── THE BRIEF ALWAYS SHIPS ────────────────────────────────────────────────────────────────
    // Length blocks ONLY under --enforce-length, which the EDITOR passes inside its own compression
    // loop (Gate 16). Everywhere else -- and specifically at the 7:00 PM `brief-validate-mechanical`
    // gate, where Pipeline_Controller treats a non-zero exit as a HARD STOP with no critic, no light
    // and no email -- it prints loudly and returns nothing.
    //
    // WHY: a length rail that can stop publication is worse than the problem it fixes. The failure
    // it prevents is a 52-minute brief; the failure it would CAUSE is no brief at all. Those are not
    // comparable, and "the brief always ships" is the standing rule that already rejected a blocking
    // audio-fidelity gate. Put the block where someone can still fix it -- the Editor can compress,
    // the 7 PM gate can only refuse -- and make the unenforced path impossible to miss instead.
    const enforceLength = process.argv.includes('--enforce-length');
    if (w > LEN_HARD && lenDate >= LEN_EPOCH) {
      if (lenOverride) {
        console.log(`  ⚪ LENGTH-OVERRIDE accepted — ${lenOverride[1].trim()}`);
      } else if (!enforceLength) {
        console.log(`  🔴 OVER BUDGET by ${(w - LEN_HARD).toLocaleString()} words (${mins} min vs 30). NOT BLOCKING — the brief always ships.`);
        console.log(`     The Editor owns this at Gate 16 (\`validate-brief <file> --enforce-length\`). If you are seeing this`);
        console.log(`     at the 7:00 PM gate, Gate 16 did not compress and did not declare — that is the thing to fix, not the brief.`);
      } else {
        failures.push({
          check: 'brief-length',
          message: `🔴 HARD FAIL: brief is ${w.toLocaleString()} words ≈ ${mins} min against a 30-minute product (target ${LEN_TARGET.toLocaleString()}, ceiling ${LEN_HARD.toLocaleString()}). This is the second draft, not a trim. Cut in Craft_Standard order: numbers without scale, then corroborating figures, then the second explanation of the same idea. Never the conclusion, never the one scaled/sourced/dated figure the unit turns on. Prefer cutting a UNIT over shrinking every unit: a Six subsection is 2-3 units. If today genuinely needs the length, declare it: <!-- LENGTH-OVERRIDE: <reason, 20+ chars> -->`,
        });
      }
    }
  }
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
  failures.push(...checkPredraftBypassDisclosure(briefDir, absPath));
  // --- Model standalone check (July 4, 2026 — E-MODEL-STANDALONE-VIOLATION-01) ---
  failures.push(...checkModelStandalone(body));
  // --- AI&T differentiation check (July 5, 2026 — E-AI-SECTION-CONSENSUS-01) ---
  failures.push(...checkQGAITDifferentiation(briefDir, absPath));
  // --- Catalyst enumeration (August 1, 2026 — IMP-113, 08-01 Critic mandate #2, RC2) ---
  failures.push(...checkCatalystEnumeration(body));
  failures.push(...checkPrecedentAnalogy(body)); // IMP-118
  failures.push(...checkHookNumeratorSubstantiation(body)); // IMP-122
  // IMP-123 runs on the RAW file — the markers ARE the subject, and `body` has had them stripped.
  failures.push(...checkMarkerPlacement(raw));

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
    // assembly-gate (the PAYOFF gate since 2026-07-10) is ADVISORY here — exits 0 and
    // prints leftover-marker / payoff-class / fresh-frame-sweep FLAGs without failing
    // this stage. Editor Gate 14 and the Critic are REQUIRED to resolve them.
    { file: 'assembly-gate.ts', extra: [] },
    // ceiling-lint (added 2026-07-10, Ceiling Doctrine v0.5 §9) is ADVISORY — exits 0,
    // FLAGs the intro/section counterfeits (preview padding, missing watch, through-line
    // label, numberless bullets, hollow significance, thematic echo). This spawn is the
    // mechanical wiring that guarantees it runs every night; Editor Gate 14(e) acts on it.
    { file: 'ceiling-lint.ts', extra: [] },
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
    // Rotation assignment (2026-07-24): override-eligible so a genuine editorial emergency has
    // a DECLARED path around the assignment — evidence in the editor log, never silence.
    'model-rotation',
    // Catalyst enumeration (2026-08-01, IMP-113): override-eligible so "the wire genuinely reported
    // no proximate cause" has a DECLARED path with evidence, never a silent pass.
    'catalyst-enumeration',
    // Precedent analogy (2026-08-02, IMP-118): the clear IS the declaration — the Editor either
    // puts the current proximate cause in the bullet or names, on the record, the most recent
    // dated event in that theatre and its source. Never a silent pass.
    'precedent-analogy',
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

// Run only as an entry point, so the exported checks can be imported by a test/sweep harness
// without main() hijacking the process (added 2026-08-01 with IMP-113).
const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]).endsWith('validate-brief.ts');
if (invokedDirectly) main();
