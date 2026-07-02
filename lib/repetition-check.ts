/**
 * repetition-check.ts — the mechanical "at most twice" data-point gate.
 *
 * The rule (Jackson, 2026-07-01): "We can't talk about the same story 3 times — at most
 * mentioned twice." This is the same failure Brief_Validator Check 9 was born from
 * (March 31: "rate hike odds from 52% to 2.2%" in the lede, Dashboard, AND Markets & Macro —
 * the listener heard the same data point three times in the first 15 minutes). That rule
 * lived only as PROSE in the daily Validator and never got a mechanical check, and the
 * Weekly / Light selection products never inherited it at all — so the 2026-07-01 super
 * brief repeated the yen (162) and the $23.5B mechanical bid across the lede, THE UPDATE,
 * and MARKETS MINUTE. This module makes the rule CODE, shared by validate-brief.ts (full +
 * weekly) and brief-light-craft-gate.ts (light).
 *
 * What it does: split the brief into header-delimited sections (the lede counts as one),
 * extract each section's signature DATA POINTS (money, percentages, and distinctive price
 * levels — the atoms that actually repeat), and FAIL any atom that appears in 3+ distinct
 * sections. "At most twice" = at most two sections. Zero network, deterministic.
 */

export interface RepetitionFinding {
  atom: string;              // canonical key, e.g. "162" or "$23.5 billion" or "79 percent"
  display: string;           // a representative surface form for the message
  sections: string[];        // the distinct sections it appeared in (in order)
}

export interface RepetitionResult {
  ok: boolean;
  findings: RepetitionFinding[];
}

interface Segment {
  name: string;
  text: string;
}

/** Split a brief into header-delimited segments. Any line starting with 1-3 '#' opens a new
 *  segment; the pre-header preamble (masthead) and the title+lede block each become their own
 *  segment, so a number previewed in the lede and restated in two sections trips the gate. */
export function splitIntoSegments(markdown: string): Segment[] {
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let currentName = 'PREAMBLE';
  let currentLines: string[] = [];

  const push = () => {
    const text = currentLines.join('\n').trim();
    if (text.length > 0) segments.push({ name: currentName, text });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // A header line (1-3 hashes) opens a new segment. Skip horizontal rules.
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      push();
      currentName = headerMatch[2]!.replace(/▸/g, '').trim() || headerMatch[1]!;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  push();
  return segments;
}

const MONEY_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*(trillion|billion|million|bn|mn|k)?\b/gi;
const MONEY_WORD_RE = /\b([\d,]+(?:\.\d+)?)\s+(trillion|billion|million)\b/gi;
const PERCENT_RE = /\b([\d,]+(?:\.\d+)?)\s*(?:%|percent)\b/gi;
// Distinctive bare numbers: thousands-separated (52,319), 3+ straight digits (162, 4000),
// or a decimal level (4.44). Small counts ("5 sessions", "9 to 0", "50 to 48") are ignored.
const BARE_NUM_RE = /\b(\d{1,3}(?:,\d{3})+|\d{3,}|\d+\.\d+)\b/g;

const UNIT_INITIAL: Record<string, string> = {
  trillion: 't', billion: 'b', million: 'm', bn: 'b', mn: 'm', k: 'k',
};

function isYear(raw: string): boolean {
  return /^(19|20)\d{2}$/.test(raw); // 1985, 2026 — not data points to dedup
}

/** Extract the set of canonical data-point atoms present in one chunk of text. */
export function extractDataAtoms(text: string): Map<string, string> {
  const atoms = new Map<string, string>(); // key -> representative surface form
  let masked = text;

  const record = (key: string, display: string) => {
    if (!atoms.has(key)) atoms.set(key, display.trim());
  };

  // Money with $ (mask so the inner number isn't double-counted as a bare number)
  masked = masked.replace(MONEY_RE, (m, num: string, unit?: string) => {
    const u = unit ? (UNIT_INITIAL[unit.toLowerCase()] ?? '') : '';
    record(`money:${num.replace(/,/g, '')}${u}`, m);
    return ' '.repeat(m.length);
  });
  // Number + spelled unit without $ (e.g. "23.5 billion")
  masked = masked.replace(MONEY_WORD_RE, (m, num: string, unit: string) => {
    const u = UNIT_INITIAL[unit.toLowerCase()] ?? '';
    record(`money:${num.replace(/,/g, '')}${u}`, m);
    return ' '.repeat(m.length);
  });
  // Percentages (glyph or spelled "percent")
  masked = masked.replace(PERCENT_RE, (m, num: string) => {
    record(`pct:${num.replace(/,/g, '')}`, m);
    return ' '.repeat(m.length);
  });
  // Distinctive bare numbers on what remains
  let bm: RegExpExecArray | null;
  BARE_NUM_RE.lastIndex = 0;
  while ((bm = BARE_NUM_RE.exec(masked)) !== null) {
    const raw = bm[1]!;
    const normalized = raw.replace(/,/g, '');
    if (isYear(normalized)) continue;
    record(`num:${normalized}`, raw);
  }
  return atoms;
}

/**
 * Run the repetition gate. Fails any data-point atom that appears in `maxSections`+1 or more
 * distinct sections (default: 3+, i.e. more than "twice"). Sections in `ignoreSections`
 * (matched case-insensitively as a substring of the header) are excluded from counting —
 * used for timeless sections (the Model, the Meditation/Inner Game, Discovery) that legitimately
 * borrow a number for a standalone example.
 */
export function checkRepetition(
  markdown: string,
  opts: { maxSections?: number; ignoreSections?: string[] } = {},
): RepetitionResult {
  const maxSections = opts.maxSections ?? 2;
  const ignore = (opts.ignoreSections ?? ['THE MODEL', 'INNER GAME', 'THE MEDITATION', 'DISCOVERY'])
    .map(s => s.toUpperCase());

  const segments = splitIntoSegments(markdown).filter(
    s => !ignore.some(ig => s.name.toUpperCase().includes(ig)),
  );

  // atom key -> { sections: ordered distinct section names, display }
  const seen = new Map<string, { sections: string[]; display: string }>();
  for (const seg of segments) {
    const atoms = extractDataAtoms(seg.text);
    for (const [key, display] of atoms) {
      const entry = seen.get(key) ?? { sections: [], display };
      if (!entry.sections.includes(seg.name)) entry.sections.push(seg.name);
      seen.set(key, entry);
    }
  }

  const findings: RepetitionFinding[] = [];
  for (const [key, entry] of seen) {
    if (entry.sections.length > maxSections) {
      findings.push({ atom: key, display: entry.display, sections: entry.sections });
    }
  }
  // Most-repeated first
  findings.sort((a, b) => b.sections.length - a.sections.length);
  return { ok: findings.length === 0, findings };
}

/** Format findings as a human worklist (used by both gates). */
export function formatRepetitionFindings(findings: RepetitionFinding[]): string {
  return findings
    .map(
      f =>
        `  • "${f.display}" appears in ${f.sections.length} sections: ${f.sections.join(' · ')}\n` +
        `    → keep it in at most two (the lede preview + its home story); reference it elsewhere without restating the figure.`,
    )
    .join('\n');
}
