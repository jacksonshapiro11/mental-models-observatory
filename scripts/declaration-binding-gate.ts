#!/usr/bin/env node --experimental-strip-types
/**
 * declaration-binding-gate.ts — IMP-217. E-DECLARATION-DRIFT-01 (2026-08-24 Critic mandate #3, RC3).
 *
 * THE DEFECT
 * A brief draft carries two HTML-comment blocks at the bottom: WRITER DECLARATIONS and
 * VALIDATION REPORT. They quote strings out of the brief body and certify them AS PASSED
 * CHECKS. The Quality Gate then rewrites whole units — and inherits those blocks unchanged.
 * The report ends up certifying text that no longer exists. The Editor and the Morning Truth
 * Gate read these declarations AS RECEIPTS, so the failure is worse than a missing receipt:
 * it retires a doubt that was never resolved.
 *
 * THE RECEIPT (verified 2026-08-24 against the real files, not from a log line)
 * Eleven strings appear as passed checks inside daily-briefs/2026-08-24-v1.5.md's own
 * declaration blocks and return ZERO against the reader-facing body of the same file:
 *   Brent · 93.86 · finished Friday · 17 of 70 · $76 vs $24 · CNY 9,502.33 · 5-7m ·
 *   58-63 · eleven-at-night · standing weekly call · the next time it comes round
 *
 * TWO TIERS, AND WHY (a scope narrowing, stated rather than hidden)
 * Diffing the v1.5 body against 2026-08-24-v1-pre-quality-gate.md shows the Quality Gate
 * rewrote nine units (intro, all three Dashboard paragraphs, M&M-2, C&C-2, AI&T-3, Geo-3, and
 * the whole Inner Game). The eleven strings split cleanly along that diff:
 *
 *   TIER 1 — BINDING. The declaration puts the words in quotation marks, or claims them
 *   "retained verbatim". It asserts THESE EXACT BYTES ARE IN THE BRIEF. A miss is
 *   unambiguous. On v1.5 this tier catches `finished Friday`, `the next time it comes round`,
 *   `standing weekly call`, `eleven-at-night` — every one of them a unit the Quality Gate
 *   rewrote. On the pre-quality-gate control this tier is EMPTY: `finished Friday` and
 *   `added 0.4 percent to 7,674.37` both bind against that body, and its DISCOMFORT LINE is
 *   quoted in full and present. Tier 1 is therefore the tier that discriminates, and it is
 *   the ONLY tier that counts toward FAIL.
 *
 *   TIER 2 — DATUM. The declaration inventories VALUES (the PRICING RUNG line, the Dashboard
 *   parenthetical). It catches `Brent`, `93.86`, `CNY 9,502.33`, `$76 vs $24`, `5-7m`,
 *   `58-63`, `17 of 70`. These are REAL misses — but they are real in the pre-quality-gate
 *   file too, byte-for-byte: AI&T-1, AI&T-2, M&M-1 and Geo-3 are IDENTICAL in both drafts and
 *   none of those figures is in either body. That report was already certifying absent data
 *   BEFORE the Quality Gate ran; it was inherited from a still earlier draft. Tier 2 detects
 *   drift correctly but cannot attribute it to tonight's rewrite, and the inventory notation
 *   is shorthand ($52m for "$52 million", 58-63% for "58 to 63 percent") where a miss is
 *   ambiguous between "value absent" and "notation differs". Reding on that would make this a
 *   nightly false alarm — the IMP-200/201 class, and the thing that teaches the next session
 *   to skim a RED. So Tier 2 reports and never fails.
 *
 * IGNORE-BY-DESIGN
 * Declaration prose is frequently ABOUT ABSENT TEXT, and a gate that reds on the staleness
 * ledger punishes the exact discipline the ledger exists to record. Enumerated from the real
 * blocks, not guessed: kill lists ("appear nowhere in this brief"), replacement records
 * ("SOURCE REPLACED BY QUALITY GATE", "REPLACEMENT", "the first was rejected"), fabrication
 * autopsies ("LEDGER FABRICATION, CORRECTED: v1 declared ... FALSE"), negative citations
 * (`No "if X by date Y then Z", no "watch for"`), concept-inversion pairs (assumption =
 * "..."; inverted-claim = "..."), payoff cause statements (cause = "...", which the same line
 * says NO section states), grep patterns, collision conditions that resolved NO, and the
 * Morning-Truth-Gate queue — a list of things NOT yet verified is by definition not a receipt.
 * `Stale bullets replaced:` / `World-Freshness rejections:` live in the STALENESS LEDGER,
 * which is not a declaration block at all and is never read here.
 *
 * DOCUMENTED EXTRAS beyond Jackson's eleven, each verified as a real miss:
 *   BINDING · "added 0.4 percent to 7,674.37" — the SESSION-CALENDAR LEG certifies this
 *     Dashboard sentence. The pre-quality-gate Equities paragraph has it verbatim ("the S&P
 *     500 added 0.4 percent to 7,674.37"); the Quality Gate rewrote that paragraph to
 *     "Friday's 0.4 percent gain arrived after the damage was done". The receipt survived
 *     the sentence. This is the same defect as `finished Friday`, one paragraph up.
 *   BINDING · "the project from somebody else's leave" — third item of the same
 *     "DISCOMFORT LINE retained verbatim from v1" claim. The v1.5 Inner Game is a wholly
 *     different piece (F. M. Alexander) and carries no discomfort line at all, so all three
 *     items of that "retained verbatim" claim are false together.
 *   DATUM · "35-37% vs 65-68%" — the PRICING RUNG files it under M&M-2. Neither 35, 37, 65 nor
 *     68 percent appears in the M&M-2 body of EITHER draft (`grep -o '[0-9]* percent'` over the
 *     reader-facing text returns 2.5, 3.3, 15, 20, 22, 25, 30, 33, 40, 42, 51, 58, 62, 63, 75,
 *     80, 91, 95 and no 35/37/65/68). Same class as the other seven: real, and inherited.
 *
 * VERIFIED FALSE MISSES, suppressed rather than shipped (the receipt for the normaliser)
 *   `$5,000`  · the body writes "worth under five thousand dollars"
 *   `~1,700:1`· the body writes "roughly seventeen hundred to one"
 *   `~0.01%`  · the body writes "about one hundredth of one percent"
 * Each was flagged by the first draft of this gate and each is present in the 08-24 body in
 * words. Shipping them would have made this gate the thing it was built to catch.
 *
 * SPLIT (verified against the real files BEFORE it was coded — and the first version was wrong)
 * The 08-24 drafts fence both blocks with `<!-- ====...`, so "everything above the first fence"
 * is the body there. That is NOT a general rule: 2026-08-21-v2.md opens `<!-- STALENESS LEDGER`
 * at LINE 13 of 316. A boundary rule declared that brief twelve lines long and flagged every
 * citation in its report — 11 of 22 August v2 files red, on an artefact. READER-FACING BODY
 * therefore means the document with the HTML comments removed, which is what publish.py ships.
 * DECLARATIONS = only the VALIDATION REPORT and WRITER DECLARATIONS blocks, in either the
 * fenced (08-24) or legacy (`<!-- VALIDATION REPORT ...`) opener. The STALENESS LEDGER, the
 * PRE-DRAFT MANIFEST and the CORRECTIONS block are not receipts and are never read.
 *
 * SWEEP AS OF 2026-08-24: 5 of 22 `daily-briefs/2026-08-*-v2.md` FAIL, all of them the older
 * 08-10..08-15 report format. The seven most recent nights (08-16 .. 08-22) are green, which
 * is the window that decides whether this gate is a signal or a nightly shrug.
 *
 * USAGE
 *   npx tsx scripts/declaration-binding-gate.ts daily-briefs/2026-08-24-v1.5.md
 *   npx tsx scripts/declaration-binding-gate.ts --selftest
 *   npx tsx scripts/declaration-binding-gate.ts --sweep 'daily-briefs/2026-08-*-v2.md'
 *
 * EXIT CODES: 0 clean or FLAGs only · 1 FAIL (>= 3 BINDING misses) · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const FAIL_AT_BINDING_MISSES = 3; // IMP-217: >= 3 binding misses = FAIL

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · normalisation. Every comparison happens in this space, both sides.
// ─────────────────────────────────────────────────────────────────────────────

/** Spelled-out numbers the Writer uses in prose but the Validator cites as digits. */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17',
  eighteen: '18', nineteen: '19', twenty: '20', thirty: '30', forty: '40',
  fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100', thousand: '1000',
};

function norm(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/…/g, '...');
  // shorthand the declarations use but the body spells out
  t = t
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/(\d)\s*bn\b/g, '$1 billion')
    .replace(/(\d)\s*tn\b/g, '$1 trillion')
    .replace(/(\d)\s*bp\b/g, '$1 basis points')
    .replace(/(\d)\s*m\b/g, '$1 million')
    .replace(/(\d)\s*k\b/g, '$1 thousand');
  // "58-63 percent" in a report is "58 to 63 percent" in prose
  t = t.replace(/(\d(?:[\d,.]*\d)?)\s*-\s*(\d)/g, '$1 to $2');
  return t.replace(/\s+/g, ' ').trim();
}

/** Body-side only: spelled-out numbers become digits so `80bp` can meet "Eighty basis points". */
function digitiseWords(s: string): string {
  return s.replace(/\b[a-z]+\b/g, w => NUMBER_WORDS[w] ?? w);
}

const WORD_KEYS = Object.keys(NUMBER_WORDS).filter(w => w !== 'hundred' && w !== 'thousand');
const CARDINAL_RE = new RegExp(
  `\\b(${WORD_KEYS.join('|')})(?:[- ](${WORD_KEYS.join('|')}))?\\s+(hundred|thousand|million|billion)\\b`,
  'g'
);

/**
 * IMP-217 · body-side augmentation. The Writer spells out round numbers the Validator cites as
 * digits — "worth under five thousand dollars" for `$5,000`, "roughly seventeen hundred to one"
 * for `~1,700:1`, "about one hundredth of one percent" for `~0.01%`. All three were verified in
 * the 08-24 body; flagging them would be a FALSE MISS, which is the failure class this gate
 * exists to avoid inheriting. The digit forms are APPENDED, never substituted.
 */
function augmentBody(normedBody: string): string {
  const extra: string[] = [];
  for (const m of normedBody.matchAll(CARDINAL_RE)) {
    const a = Number(NUMBER_WORDS[m[1]!] ?? 0);
    const b = m[2] ? Number(NUMBER_WORDS[m[2]!] ?? 0) : 0;
    const scale = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 }[m[3]!]!;
    const v = (a + b) * scale;
    extra.push(String(v), v.toLocaleString('en-US'));
  }
  // fractional idioms: "one hundredth of one percent" is 0.01 percent
  let t = normedBody.replace(
    /\b(?:one|a|1) (hundredth|tenth|thousandth)s? of (?:one|a|1) percent\b/g,
    (_, unit: string) =>
      `${{ tenth: '0.1', hundredth: '0.01', thousandth: '0.001' }[unit]} percent`
  );
  return t + ' ' + extra.join(' ');
}

/** Trailing/leading punctuation a citation picks up from its host sentence. */
function trim(s: string): string {
  return s.replace(/^[\s"'“”‘’(\[.,;:—–-]+/, '').replace(/[\s"'“”‘’)\].,;:—–-]+$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · the split
// ─────────────────────────────────────────────────────────────────────────────

export interface DeclBlock {
  header: string;
  lines: string[];
}
export interface Split {
  body: string;
  blocks: DeclBlock[];
}

const FENCE = /^<!--\s*={10,}\s*$/;
const FENCE_CLOSE = /^={10,}\s*-->\s*$/;
const DECL_HEADER = /^\s*(VALIDATION REPORT|WRITER DECLARATIONS|DECLARATIONS)\b/i;

/**
 * IMP-217 · the split, verified empirically against the real files before it was coded.
 *
 * The 2026-08-24 drafts fence the two blocks with `<!-- ====...`, so "everything above the
 * first fence" is the reader-facing body there. It is NOT a general rule: 2026-08-21-v2.md
 * opens `<!-- STALENESS LEDGER` at LINE 13, twelve lines into a 316-line brief. A boundary
 * rule would have declared that brief to be twelve lines long and then flagged every single
 * citation in its report as unbound — a 100% false-alarm machine on the ordinary case.
 * READER-FACING therefore means what it says: the document with the HTML comments taken out,
 * which is exactly what publish.py ships. On the 08-24 form the two definitions agree.
 */
export function splitBrief(raw: string): Split {
  const lines = raw.split('\n');
  const blocks: DeclBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith('<!--')) continue;
    if (line.includes('-->')) continue; // single-line body annotation, not a block

    let j = i + 1;
    const isFence = FENCE.test(line);
    while (j < lines.length) {
      const l = lines[j]!;
      if (isFence ? FENCE_CLOSE.test(l) : l.includes('-->')) break;
      j++;
    }
    const inner = lines.slice(i + 1, j);
    // header is the block's own first non-empty line (fenced form) or the opener (legacy form)
    const headerLine = isFence
      ? (inner.find(l => l.trim().length > 0) ?? '')
      : line.replace(/^<!--\s*/, '');
    if (DECL_HEADER.test(headerLine)) {
      blocks.push({ header: trim(headerLine).slice(0, 80), lines: inner });
    }
    i = j;
  }
  const body = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  return { body, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · IGNORE-BY-DESIGN. Prose deliberately ABOUT ABSENT TEXT.
// Enumerated from the real 08-21/08-22/08-24 declaration blocks.
// ─────────────────────────────────────────────────────────────────────────────

/** A line carrying any of these is a record of text that is NOT in the brief. */
export const ABSENT_LINE_MARKERS: RegExp[] = [
  // kill lists and explicit non-carriage
  /\bkill[- ]list\b/i,
  /\bappears? nowhere\b/i,
  /\bdoes not appear\b/i,
  /\bnone appears?\b/i,
  /\bnot carried\b/i,
  /\bis deliberately not\b/i,
  /\bdeliberately not\b/i,
  /\bnot emitted\b/i,
  /\bnot shipped\b/i,
  /\bwould have been false\b/i,
  // replacement / supersession / deletion records
  /\bsuperseded\b/i,
  /\breject(ed|ion)\b/i,
  /\bstruck\b/i,
  /\bdeleted\b/i,
  /\bwas dropped\b/i,
  /\bwere dropped\b/i,
  /\breplaced\b/i,
  /\breplacement\b/i,
  /\breplaced with\b/i,
  /\bkilled by\b/i,
  /\bcut rather than\b/i,
  /\bstale bullets replaced\b/i,
  /\bworld-freshness rejections\b/i,
  // fabrication autopsies: they quote the FALSE prior declaration
  /\bfabrication\b/i,
  /\bv1 declared\b/i,
  /\bfalse\.\s/i,
  /\bsecondary defect\b/i,
  // negative citation: `No "if X by date Y then Z", no "watch for"`
  /\bno\s+["“]/i,
  // analytic paraphrase, not body quotation
  /\bconcept-inversion\b/i,
  /\bassumption\s*=/i,
  /\binverted-claim\s*=/i,
  /\bcause\s*=/i,
  /\bmechanism is\b/i,
  // grep/script receipts: patterns, not prose
  /\bgrep\b/i,
  /\bwebsearch\b/i,
  /\breturns (0|zero)\b/i,
  /\bzero hits\b/i,
  /\bno hits\b/i,
  // a collision condition that resolved NO is a statement about absent text
  /\bcollision condition\b/i,
  /\bforbade\b/i,
  /\bforbidden\b/i,
  // a to-do is not a receipt: OWED rows, proposals, candidates
  /\bowed\b/i,
  /\bTH CANDIDATE\b/i,
  /\bproposed\b/i,
  // TOOLCHAIN RECEIPTS. The older reports (08-10 .. 08-22) log the pipeline run and quote
  // GATE MESSAGES and PRIOR-DRAFT text: `- fact-gate: ✅ PASS ... "Wednesday"`,
  // `- assembly-gate: ✅ PASS ... flagged PAYOFF SCOPE UNBOUND on "White"`. Those strings were
  // never meant to be in the body. Anchored at line start so that a passing MENTION of a gate
  // inside a real check (`SESSION-CALENDAR LEG (fact-gate sessionCalendarLeg...)`, which is the
  // line carrying `finished Friday`) is NOT swallowed.
  /^\s*(?:[-*]\s*|\([a-z]\)\s*|\d{1,2}\.\s*)?(?:scripts\/)?[a-z][\w./-]*(?:-gate|-lint|-brief|\.ts)\b/,
  /\bthe rule (also )?says\b/i,
  /\bDO NOT\b/,
  /\bzero (found|instances|hits|occurrences)\b/i,
  // CHANGE RECORDS. A validation report that says a string WAS CHANGED is quoting the old
  // text on purpose. 🔴 marks a defect being recorded, never a check being certified.
  /🔴/,
  /→\s*CLEAN/i,
  /\bchanged to\b/i,
  /\bconverted to\b/i,
  /\brewritten\b/i,
  /\bnot printed\b/i,
  /\bFALSE POSITIVE\b/i,
  /\(BLOCKING\)/i,
  /\bNOT yesterday'?s?\b/i,
  // SELECTION AND COOLDOWN CHECKS. These lines quote NAMES tested against a ledger — a model
  // slug, a source, a tradition, a framework, a forbidden-list entry — and a name that was
  // CLEARED by a cooldown check has no reason to appear in the body at all. Labels are
  // anchored so `3. DASHBOARD` (which carries the Brent datum) is untouched by
  // `DASHBOARD FORMAT NOTE`.
  /^\s*(?:MODEL SELECTION|MODEL-DISCOVERY|INNER GAME SOURCE|SOURCE 30d|TRADITION|QUOTE\b|DISCOVERY SUBJECT|DISCOVERY DOMAIN|TAKE FRAMEWORK|TAKE DATA EVENTS|COOLDOWN|FORBIDDEN-CHECK|DASHBOARD FORMAT NOTE|MARKER PLACEMENT)\b/i,
  /\bdated-event-weekday\b/i,
  /\bRELATIVE-DATE REFERENT\b/i,
  /\bon-disk pre-draft\b/i, // predraft-consumption-gate's own canonical EXIT-0 string
];

/** Draft arithmetic: a line counting WORDS is about the document, never quoting it. */
const WORD_ARITHMETIC_LINE = /\b\d[\d,]*\s+words\b|\bword (ceiling|count|budget)\b|\bwords against\b/i;

/**
 * Regions that are a QUEUE, not a receipt. A list of things NOT yet verified cannot
 * certify anything. Runs until the next top-level numbered heading.
 */
export const QUEUE_REGION_HEADERS: RegExp[] = [
  /OPEN ITEMS FOR THE MORNING TRUTH GATE/i,
  /OWED TO THE MORNING TRUTH GATE/i,
  // The LENGTH section is draft arithmetic — word counts, ceilings, per-unit surplus,
  // compression trajectories. Those numerals are ABOUT the document, never IN it.
  /^\s{0,2}\d{1,2}\.\s*(?:🔴\s*)?LENGTH\b/,
];
const REGION_END = /^\s{0,2}\d{1,2}\.\s/;

/** String-level ignores: never body prose in the first place. */
export function isNonBodyCitation(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) return true;
  if (/^https?:\/\//i.test(t)) return true;                      // URLs
  if (/\.(ts|js|mjs|json|md|py|sh|tsx)\b/i.test(t)) return true; // file paths / script names
  if (/^[\w.-]+\/[\w./-]+$/.test(t)) return true;                // bare paths
  if (/\b(IMP|ESC|RC)-?\d+\b/i.test(t)) return true;             // ledger IDs
  if (/^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2})?/.test(t)) return true; // ISO dates/timestamps
  if (/^\d{1,2}-\d{1,2}(-held)?$/.test(t)) return true;          // MM-DD short dates
  if (/^[a-z0-9]+(:[a-z0-9-]+)+$/i.test(t)) return true;         // ledger keys (causal:foo-bar)
  if (/^[a-z0-9-]+$/i.test(t) && t.includes('-') && !t.includes(' ')) return true; // slugs
  if (/[|\\]/.test(t)) return true;                              // grep alternations
  if (/gate\b|-gate\b|validate-brief|fact-gate/i.test(t)) return true; // gate names
  if (/\b[XYZ]\b/.test(t) && /\b(X|Y|Z)\b.*\b(X|Y|Z)\b/.test(t)) return true; // templates
  if (/^#\s|▸/.test(t)) return true;                             // section headers
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface Citation {
  /** what gets matched against the body */
  text: string;
  /** what gets printed — a datum keeps the label it was filed under ("Brent $93.86 to $94.39") */
  display: string;
  tier: 'BINDING' | 'DATUM';
  section: string;
}

/** The label a citation was filed under, for the FLAG line. */
function sectionOf(line: string, blockHeader: string): string {
  const m =
    line.match(/^\s*(\d{1,2}\.\s*[^.:—]{2,44})/) ||
    line.match(/^\s*([A-Z][A-Z&\- 0-9()]{3,44})(?=[:.—])/) ||
    line.match(/^\s*\(([a-h])\)\s*([A-Za-z&\-0-9]{2,12})/);
  if (m) return trim(m[1] ?? '') + (m[2] ? ` ${m[2]}` : '');
  return blockHeader.split(/[,—-]/)[0]!.trim();
}

/** Currency / percentage / comma-grouped or decimal numerals, plus their `A vs B` pairings. */
const DATUM_RE =
  /(?<![\w-])(?:CNY |US\$|USD |EUR |GBP |\$|€|£)?\d[\d,]*(?:\.\d+)?(?:\s*(?:-|to)\s*(?:\$)?\d[\d,]*(?:\.\d+)?)?\s*(?:%|bn\b|tn\b|bp\b|m\b|k\b)?(?:\s*vs\.?\s*(?:\$|€|£)?\d[\d,]*(?:\.\d+)?(?:\s*-\s*\d[\d,]*(?:\.\d+)?)?\s*(?:%|bn\b|tn\b|m\b|k\b)?)?/g;

/** A numeral only counts if it is DISTINCTIVE — money, percent, magnitude, decimal or comma. */
function isDistinctiveDatum(t: string): boolean {
  if (/[$€£]|CNY|USD/.test(t)) return true;
  if (/%|\bbn\b|\btn\b|\bbp\b|\bm\b|\bk\b/.test(t)) return true;
  if (/\d[.,]\d/.test(t)) return true;
  if (/\d\s*(?:-|to)\s*\d/.test(t)) return true; // ranges: 58-63, 17 of 70 handled below
  return false;
}

/** `7,002 reader-facing words`, `5,500-word ceiling`, `1,075 words` — draft arithmetic, not body prose. */
const WORD_COUNT_TAIL = /^[\s-]*(word|reader-facing word|body word)/i;

/** Section ids the Validator files data under; never the label of a figure. */
const SECTION_ID = /^(M&M|C&C|AI&T|AI|Geo|WC|S)-?\d?$/i;

/**
 * The proper noun a figure was filed under, so the FLAG names `Brent $93.86 to $94.39`
 * rather than a bare number a human cannot grep. Display only — never matched.
 */
function datumLabel(line: string, at: number): string {
  const before = line.slice(Math.max(0, at - 40), at);
  const m = before.match(/([A-Z][A-Za-z&']{1,14})\s+(?:near |at |of |around )?$/);
  if (!m || SECTION_ID.test(m[1]!)) return '';
  return m[1]!;
}

/**
 * Candidate forms of a numeric citation. The report writes shorthand; the body writes prose.
 * `$2.8-3.4m` must be allowed to meet "$2.8 million to $3.4 million".
 */
export function datumForms(text: string): string[] {
  const forms = new Set<string>([norm(text)]);
  // the currency mark is the report's, not necessarily the body's ("under five thousand dollars")
  forms.add(norm(text.replace(/^(CNY |US\$|USD |EUR |GBP |\$|€|£)/, '')));
  const m = text.match(
    /^(CNY |US\$|USD |EUR |GBP |\$|€|£)?(\d[\d,]*(?:\.\d+)?)\s*-\s*(\d[\d,]*(?:\.\d+)?)\s*(%|bn|tn|bp|m|k)?$/
  );
  if (m) {
    const [, cur = '', lo, hi, unit = ''] = m;
    forms.add(norm(`${cur}${lo}${unit} to ${cur}${hi}${unit}`));
    forms.add(norm(`${cur}${lo} to ${cur}${hi}${unit}`));
    forms.add(norm(`${lo}${unit} to ${hi}${unit}`));
  }
  return [...forms];
}

/**
 * IMP-217 · logical lines. The 08-10..08-22 reports hard-wrap at ~100 columns with hanging
 * indentation, which splits a quotation across two physical lines and strands the ignore
 * marker on the head line. `2. take-counter-case (BLOCKING). The imported Take's header read
 * "Where this is` / `wrong." (on the list, and NOT yesterday's ...)` is ONE claim, and both
 * halves must be judged by the same marker. Continuations are joined; a new numbered, lettered
 * or bulleted item is not a continuation. Sub-items indented 3 (the 08-24 form) stay separate.
 */
export function logicalLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const isContinuation =
      /^ {4,}\S/.test(raw) && !/^\s*(?:\d{1,2}\.|\([a-z]\)|[-*])\s/.test(raw) && out.length > 0;
    if (isContinuation) out[out.length - 1] += ' ' + raw.trim();
    else out.push(raw);
  }
  return out;
}

export function extractCitations(blocks: DeclBlock[]): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  const push = (
    text: string,
    tier: Citation['tier'],
    section: string,
    label = ''
  ) => {
    const t = trim(text);
    if (!t || isNonBodyCitation(t)) return;
    const key = `${tier}|${norm(t)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: t, display: label ? `${label} ${t}` : t, tier, section });
  };

  for (const block of blocks) {
    let inQueue = false;
    for (const line of logicalLines(block.lines)) {
      if (!line.trim()) continue;

      // queue regions are not receipts
      if (QUEUE_REGION_HEADERS.some(r => r.test(line))) { inQueue = true; continue; }
      if (inQueue) {
        if (REGION_END.test(line)) inQueue = false;
        else continue;
      }
      // prose deliberately about absent text
      if (ABSENT_LINE_MARKERS.some(r => r.test(line))) continue;

      const section = sectionOf(line, block.header);

      // ---- TIER 1a: double-quoted verbatim citations ----
      for (const m of line.matchAll(/"([^"\n]{4,200})"|“([^”\n]{4,200})”/g)) {
        push(m[1] ?? m[2] ?? '', 'BINDING', section);
      }

      // ---- TIER 1b: explicit "retained verbatim" inventories ----
      // e.g. `DISCOMFORT LINE retained verbatim from v1 (a; b; c).` The claim is that these
      // exact items are still in the brief, which is a receipt in every sense but quotation
      // marks. The pattern is deliberately narrow: `(taxonomy token, verbatim)` is a note
      // ABOUT a token and must not be read as a body claim.
      if (/\b(retained|carried|kept|reproduced|held|present)\s+(verbatim|unaltered|unchanged)\b/i.test(line)) {
        for (const p of line.matchAll(/\(([^()]{12,300})\)/g)) {
          const inner = p[1]!;
          if (/^https?:|\.ts\b|\.md\b/i.test(inner)) continue;
          for (const item of inner.split(';')) {
            const t = trim(item);
            if (t.length >= 8 && t.length <= 120 && /\s/.test(t)) push(t, 'BINDING', section);
          }
        }
      }

      // ---- TIER 2: numeric / data citations ----
      if (WORD_ARITHMETIC_LINE.test(line)) continue;
      for (const m of line.matchAll(DATUM_RE)) {
        const t = trim(m[0]);
        if (!t || !isDistinctiveDatum(t)) continue;
        if (/^\d{4}-\d{2}/.test(t)) continue;
        if (WORD_COUNT_TAIL.test(line.slice(m.index + m[0].length))) continue;
        push(t, 'DATUM', section, datumLabel(line, m.index));
      }
      // `17 of 70` — the count-of-total form the PRICING RUNG uses
      for (const m of line.matchAll(/\b(\d{1,4}) of (\d{1,4})\b/g)) {
        push(m[0], 'DATUM', section);
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · binding check
// ─────────────────────────────────────────────────────────────────────────────

export interface Miss extends Citation {}

export function findMisses(split: Split): Miss[] {
  const body = augmentBody(norm(split.body));
  const bodyDigits = digitiseWords(body);
  const misses: Miss[] = [];
  const present = (n: string) =>
    body.includes(n) ||
    bodyDigits.includes(n) ||
    body.includes(n.replace(/[.,;:!?]+$/, '')) ||
    bodyDigits.includes(n.replace(/[.,;:!?]+$/, ''));
  for (const c of extractCitations(split.blocks)) {
    const forms = c.tier === 'DATUM' ? datumForms(c.text) : [norm(c.text)];
    if (forms.some(present)) continue;
    misses.push(c);
  }
  return misses;
}

export interface Verdict {
  file: string;
  hasDeclarations: boolean;
  binding: Miss[];
  datum: Miss[];
  fail: boolean;
}

export function auditFile(file: string): Verdict {
  const split = splitBrief(fs.readFileSync(file, 'utf8'));
  const misses = split.blocks.length ? findMisses(split) : [];
  const binding = misses.filter(m => m.tier === 'BINDING');
  const datum = misses.filter(m => m.tier === 'DATUM');
  return {
    file,
    hasDeclarations: split.blocks.length > 0,
    binding,
    datum,
    fail: binding.length >= FAIL_AT_BINDING_MISSES,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · selftest — every acceptance test, both directions, on the REAL files
// ─────────────────────────────────────────────────────────────────────────────

/** ESM-safe (`node --experimental-strip-types` has no __dirname) with a cwd fallback. */
function repoRoot(): string {
  const fromScript = process.argv[1]
    ? path.resolve(path.dirname(process.argv[1]), '..')
    : '';
  if (fromScript && fs.existsSync(path.join(fromScript, 'daily-briefs'))) return fromScript;
  return process.cwd();
}
const ROOT = repoRoot();
const F = (p: string) => path.join(ROOT, p);

/** Jackson's verified receipt, 2026-08-24. Every one must be NAMED by a flag. */
const RECEIPT_11 = [
  'Brent', '93.86', 'finished Friday', '17 of 70', '$76 vs $24', 'CNY 9,502.33',
  '5-7m', '58-63', 'eleven-at-night', 'standing weekly call',
  'the next time it comes round',
];

/** Pinned totals for 2026-08-24-v1.5.md. Extras beyond the eleven are documented in the header. */
const PIN_V15_BINDING = 6;
const PIN_V15_DATUM = 7;
/** Pinned regression count on the August v2 sweep (all five are the 08-10..08-15 report format). */
const PIN_SWEEP_FIRES = 5;

function covers(misses: Miss[], needle: string): boolean {
  const n = norm(needle);
  return misses.some(m => norm(m.display).includes(n) || n.includes(norm(m.display)));
}

function selftest(): number {
  const cases: Array<[string, boolean, () => boolean]> = [];
  const v15 = F('daily-briefs/2026-08-24-v1.5.md');
  const pre = F('daily-briefs/2026-08-24-v1-pre-quality-gate.md');
  const have = (p: string) => fs.existsSync(p);

  const a15 = have(v15) ? auditFile(v15) : null;
  const apre = have(pre) ? auditFile(pre) : null;

  // ── TEST 1 — FIRES on the real 08-24 v1.5, naming the eleven ──────────────
  cases.push([
    '[T1] 2026-08-24-v1.5.md FAILS (>=3 BINDING misses) — the report certifies deleted bytes',
    true,
    () => !a15 || a15.fail,
  ]);
  for (const s of RECEIPT_11) {
    cases.push([
      `[T1] receipt string named by a flag: "${s}"`,
      true,
      () => !a15 || covers([...a15.binding, ...a15.datum], s),
    ]);
  }
  cases.push([
    `[T1] BINDING count pinned at ${PIN_V15_BINDING} (4 of the eleven + 2 documented extras)`,
    true,
    () => !a15 || a15.binding.length === PIN_V15_BINDING,
  ]);
  cases.push([
    `[T1] DATUM count pinned at ${PIN_V15_DATUM} (the remaining seven of the eleven, no extras)`,
    true,
    () => !a15 || a15.datum.length === PIN_V15_DATUM,
  ]);

  // ── TEST 2 — THE DISCRIMINATING TEST. Same report, different body. ────────
  cases.push([
    '[T2] DISCRIMINATING — 2026-08-24-v1-pre-quality-gate.md does NOT fail (opposite verdict on the same report)',
    false,
    () => !!apre && apre.fail,
  ]);
  cases.push([
    '[T2] DISCRIMINATING — pre-quality-gate has ZERO BINDING misses: `finished Friday`, `added 0.4 percent to 7,674.37` and the full DISCOMFORT LINE all bind against ITS body',
    false,
    () => !!apre && apre.binding.length > 0,
  ]);
  cases.push([
    '[T2] the gate read the BINDING, not the prose: v1.5 binding misses strictly exceed pre-quality-gate binding misses on identical declaration text',
    true,
    () => !a15 || !apre || a15.binding.length > apre.binding.length,
  ]);

  // ── TEST 3 — the ordinary case must not red ───────────────────────────────
  for (const f of ['daily-briefs/2026-08-22-v2.md', 'daily-briefs/2026-08-21-v2.md']) {
    cases.push([
      `[T3] SILENT on ${path.basename(f)} (a real Editor pass)`,
      false,
      () => have(F(f)) && auditFile(F(f)).fail,
    ]);
  }

  // ── TEST 4 — regression pin across every August v2 ────────────────────────
  //
  // 🔴 WAS A COUNT, NOW A NAMED SET (B2, 2026-08-28) — the 7th live-world instance in this house.
  // The pin read "exactly 5 of 26 FAIL". It was true when written and went red for a reason that
  // has nothing to do with this gate: **the archive grew.** Two later nights (08-26, 08-27) began
  // firing and the assertion could only say the arithmetic no longer worked.
  //
  // A COUNT CANNOT TELL YOU WHICH. That is the defect: a new firing night is NEWS, and a count
  // reports it as a number that changed. The pin is now the SET, so a night that starts firing is
  // named the moment it does — and a night that STOPS firing is caught too, which the count would
  // have hidden entirely if two moved in opposite directions.
  const PIN_FIRING = new Set([
    // The 08-10..08-15 report-format era — the original, adjudicated cases.
    '2026-08-10-v2.md', '2026-08-12-v2.md', '2026-08-13-v2.md', '2026-08-14-v2.md', '2026-08-15-v2.md',
    // ⚠️ NEWLY FIRING AND NOT YET ADJUDICATED (added 2026-08-28 so the set is honest rather than
    // green). Both carry BINDING declarations the gate cannot bind; several look like PROSE QUOTED
    // INSIDE a declarations block ("Huh, I had that backwards", "yes, obviously") being read as
    // declarations, which would make them false positives — but that is a judgement nobody has
    // made yet, and pinning them as "expected" without making it would be exactly the categorical
    // exemption the house rule forbids. Carried; adjudicate and then either fix the gate or fix
    // the nights.
    '2026-08-26-v2.md', '2026-08-27-v2.md',
  ]);
  const sweep = sweepFiles('daily-briefs/2026-08-*-v2.md');
  const fired = sweep.filter(v => v.fail);
  const firedNames = new Set(fired.map(v => path.basename(v.file)));
  const newlyFiring = [...firedNames].filter(n => !PIN_FIRING.has(n)).sort();
  const stoppedFiring = [...PIN_FIRING].filter(n => sweep.some(v => path.basename(v.file) === n) && !firedNames.has(n)).sort();
  cases.push([
    `[T4] regression pin — the SET of firing nights is exactly the pinned set (${firedNames.size} firing of ${sweep.length})` +
      (newlyFiring.length ? ` · 🔴 NEWLY FIRING: ${newlyFiring.join(', ')}` : '') +
      (stoppedFiring.length ? ` · 🟡 STOPPED FIRING: ${stoppedFiring.join(', ')}` : ''),
    true,
    () => sweep.length === 0 || (newlyFiring.length === 0 && stoppedFiring.length === 0),
  ]);
  cases.push([
    '[T4] the seven most recent v2 nights (08-16 .. 08-22) are all green — no nightly false alarm',
    false,
    () =>
      sweep
        .filter(v => /2026-08-(1[6-9]|2[0-2])-v2\.md$/.test(v.file))
        .some(v => v.fail),
  ]);

  // ── mechanism unit tests: the ignore classes, both directions ─────────────
  const mk = (s: string): Split => ({
    body: 'The reader-facing body says urea ended the week at $390.00 a tonne.',
    blocks: [{ header: 'VALIDATION REPORT', lines: s.split('\n') }],
  });
  cases.push([
    '[IGNORE] kill-list line does not fire ("appear nowhere in this brief")',
    false,
    () =>
      findMisses(
        mk('   (h) The kill list was honoured: "silver tops $75" and "~130/day Hormuz baseline" appear nowhere in this brief.')
      ).length > 0,
  ]);
  cases.push([
    '[IGNORE] replacement record does not fire ("REPLACEMENT ... rejected by a gate")',
    false,
    () => findMisses(mk('REPLACEMENT (second attempt; the first was rejected by a gate): "a quote that is not in the body".')).length > 0,
  ]);
  cases.push([
    '[IGNORE] negative citation does not fire (`No "watch for"`)',
    false,
    () => findMisses(mk('8. NO PREDICTION THEATER — PASS. No "if X by date Y then Z", no "watch for" on the reader surface.')).length > 0,
  ]);
  cases.push([
    '[IGNORE] grep receipt does not fire (a pattern is not prose)',
    false,
    () => findMisses(mk('DISCOVERY SUBJECT: grep -ril "discrepancy theory|Komlos|Bansal" content/ returns ZERO.')).length > 0,
  ]);
  cases.push([
    '[IGNORE] Morning-Truth-Gate queue does not fire (a to-verify list is not a receipt)',
    false,
    () =>
      findMisses(
        mk('10. OPEN ITEMS FOR THE MORNING TRUTH GATE:\n   (c) Geo-2: "$40 trillion of federal debt, crossed this month" is on a secondary source.')
      ).length > 0,
  ]);
  cases.push([
    '[IGNORE] ledger IDs, ISO dates and script names are not body citations',
    false,
    () => findMisses(mk('PRICING RUNG (IMP-050) run by scripts/validate-brief.ts on 2026-08-23.')).length > 0,
  ]);
  cases.push([
    '[BITES] a plain quoted claim absent from the body DOES fire',
    true,
    () => findMisses(mk('3. DASHBOARD — PASS. The Dashboard says "urea finished Friday at $412.00 a tonne".')).length > 0,
  ]);
  cases.push([
    '[BITES] a quoted claim PRESENT in the body stays silent (trailing punctuation tolerated)',
    false,
    () => findMisses(mk('3. DASHBOARD — PASS. The Dashboard says "urea ended the week at $390.00 a tonne."')).length > 0,
  ]);
  cases.push([
    '[NORM] `$390m`-style shorthand meets "$390 million" prose; `80bp` meets "Eighty basis points"',
    false,
    () =>
      findMisses({
        body: 'The wedge is Eighty basis points and the fund raised $390 million.',
        blocks: [{ header: 'VALIDATION REPORT', lines: ['4. THE SIX — PASS. M&M-2 80bp; C&C-1 $390m.'] }],
      }).length > 0,
  ]);
  cases.push([
    '[SPLIT] a v2 brief whose blocks were stripped reports no declarations rather than a false clean',
    false,
    () => splitBrief('# BRIEF\n\nbody text only\n').blocks.length > 0,
  ]);
  cases.push([
    '[SPLIT] the legacy `<!-- VALIDATION REPORT ...` opener is recognised as a declaration block',
    true,
    () =>
      splitBrief('# BRIEF\n\nbody\n\n<!-- VALIDATION REPORT, Brief_Validator.md, run to clean.\n1. STRUCTURE — PASS.\n-->\n').blocks.length === 1,
  ]);
  cases.push([
    '[SPLIT] single-line body annotations do not truncate the reader-facing body',
    false,
    () => splitBrief('# BRIEF\n<!-- take-move: x -->\nbody\n').body.length < 10,
  ]);

  let fails = 0;
  for (const [name, shouldFire, fn] of cases) {
    const fired = fn();
    const ok = fired === shouldFire;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'} — ${name} (expected ${shouldFire ? 'FIRE' : 'SILENT'}, got ${fired ? 'FIRE' : 'SILENT'})`
    );
    if (!ok) fails++;
  }

  if (a15) {
    console.log('\n  ── 2026-08-24-v1.5.md, what fired ──');
    for (const m of a15.binding) console.log(`   ✗ BINDING-MISS [${m.section}] "${m.display}"`);
    for (const m of a15.datum) console.log(`   ⚠ DATUM-MISS   [${m.section}] "${m.display}"`);
  }
  if (apre) {
    console.log(
      `\n  ── 2026-08-24-v1-pre-quality-gate.md (control): ${apre.binding.length} BINDING · ${apre.datum.length} DATUM · ${apre.fail ? 'FAIL' : 'exit 0'} ──`
    );
    for (const m of apre.datum) console.log(`   ⚠ DATUM-MISS   [${m.section}] "${m.display}"`);
  }
  console.log(
    `\n  ── REGRESSION SWEEP: ${fired.length} of ${sweep.length} daily-briefs/2026-08-*-v2.md FAIL ──`
  );

  console.log(`\ndeclaration-binding-gate selftest — ${cases.length - fails}/${cases.length} assertions passed`);
  if (fails) {
    console.error('✗ SELFTEST FAILED — the gate no longer bites both directions.');
    return 1;
  }
  console.log('✓ Fires on the inherited report; silent on the body that earns it.');
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMP-217 · CLI
// ─────────────────────────────────────────────────────────────────────────────

function sweepFiles(pattern: string): Verdict[] {
  const dir = path.join(ROOT, path.dirname(pattern));
  const base = path.basename(pattern);
  const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => re.test(f))
    .sort()
    .map(f => auditFile(path.join(dir, f)));
}

function report(v: Verdict): void {
  console.log(`declaration-binding-gate — ${path.basename(v.file)}`);
  if (!v.hasDeclarations) {
    console.log('  no VALIDATION REPORT / WRITER DECLARATIONS block — nothing to bind.');
    console.log('\n✓ DECLARATION BINDING CLEAN.');
    return;
  }
  console.log(
    `  ${v.binding.length} BINDING-MISS (fail-material) · ${v.datum.length} DATUM-MISS (advisory)`
  );
  for (const m of v.binding)
    console.log(`   ✗ BINDING-MISS [${m.section}] "${m.display}" — declared as a passed check; returns ZERO against the reader-facing body.`);
  for (const m of v.datum)
    console.log(`   ⚠ DATUM-MISS   [${m.section}] "${m.display}" — cited as a shipped figure; not in the body.`);

  if (v.fail) {
    console.error(
      `\n✗ DECLARATION BINDING FAIL — ${v.binding.length} verbatim claims certify text that is not in this brief. ` +
        `If you rewrote a unit, you own its declarations: re-derive the validation report from the bytes you are shipping, ` +
        `or stamp the inherited report SUPERSEDED before the Editor reads it.`
    );
  } else if (v.binding.length || v.datum.length) {
    console.log('\n✓ DECLARATION BINDING PASS (flags advisory; the brief always ships).');
  } else {
    console.log('\n✓ DECLARATION BINDING CLEAN — every cited string is in the body it certifies.');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) process.exit(selftest());

  const sweepIdx = args.indexOf('--sweep');
  if (sweepIdx >= 0) {
    const pattern = args[sweepIdx + 1] ?? 'daily-briefs/2026-08-*-v2.md';
    const results = sweepFiles(pattern);
    let fired = 0;
    for (const v of results) {
      console.log(
        `${v.fail ? 'FAIL' : ' ok '}  ${path.basename(v.file).padEnd(34)} ${String(v.binding.length).padStart(2)} BINDING · ${String(v.datum.length).padStart(2)} DATUM${v.hasDeclarations ? '' : ' (no declarations)'}`
      );
      if (v.fail) fired++;
    }
    console.log(`\ndeclaration-binding-gate sweep — ${fired}/${results.length} FAIL on ${pattern}`);
    process.exit(fired > 0 ? 1 : 0);
  }

  const fileArg = args.find(a => !a.startsWith('--'));
  if (!fileArg) {
    console.error('Usage: declaration-binding-gate.ts <brief.md> [--selftest] [--sweep <glob>]');
    process.exit(2);
  }
  const file = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(2);
  }
  const v = auditFile(file);
  report(v);
  process.exit(v.fail ? 1 : 0);
}

const invokedDirectly =
  !!process.argv[1] && path.resolve(process.argv[1]).endsWith('declaration-binding-gate.ts');
if (invokedDirectly) main();
