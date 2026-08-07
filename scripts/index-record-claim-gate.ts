#!/usr/bin/env node --experimental-strip-types
/**
 * index-record-claim-gate.ts — ONE INDEX, ONE CONFIRMATION (IMP-132, 2026-08-05, RC2).
 *
 * THE FAILURE THIS EXISTS TO KILL. On 2026-08-05 the Daily Title read "Three Records and One Leg",
 * the payoff intro read "The S&P, the Dow and the Nasdaq closed at records", and the Dashboard said
 * the same. Only TWO indexes closed at records: the S&P at 7,737 and the Dow at 54,086. The Nasdaq
 * rose 2.59 percent — the biggest move of the three, which is exactly the trap — and closed about
 * 2 percent BELOW its early-June high. The Editor named the risk in its own Validation Report
 * ("'Three' ... must be verified as three, not two and not four") and shipped it anyway, because
 * no gate in the chain could check a per-index record claim. The morning pass caught it and struck
 * the falsehood in four places across two files, hours after the evening chain had passed it clean.
 *
 * THE RULE (system/Market_Data_Collector.md — THE PER-INDEX RECORD RULE): a record close is captured
 * per index or not at all. "The indexes hit records" is never a capture. A GROUP claim expands to N
 * SEPARATE claims — each named index needs its own resolved:true entry in {DATE}-truth.json whose
 * note affirms a record. An index that merely ROSE MOST ON THE DAY is not thereby at a record, and a
 * recovering index is the standing trap.
 *
 * TWO CHECKS:
 *   A. PER-INDEX — every index named inside a record frame must carry its own affirmative,
 *      resolved confirmation. Enumerations ("the S&P, the Dow and the Nasdaq closed at records")
 *      expand to one claim per index. Explicit NEGATIONS ("the Nasdaq ... without setting a record
 *      of its own") are not assertions and are never flagged — that is the corrected 08-05 sentence
 *      and it must stay silent, or the gate just teaches writers to delete true qualifiers.
 *   B. TITLE NUMERAL — a Daily Title that COUNTS records ("Three Records and One Leg") is checked
 *      against the number of indexes actually confirmed at records in truth.json.
 *
 * Non-index records are out of scope by construction: "record annual pace" for data-center
 * construction and AMD's "record $11,536 million" name no index, so no sentence of theirs is ever
 * evaluated. The gate reads only what claims an INDEX set a record.
 *
 * Usage:
 *   node --experimental-strip-types scripts/index-record-claim-gate.ts YYYY-MM-DD [--brief <path>]
 *   node --experimental-strip-types scripts/index-record-claim-gate.ts --selftest
 *   node --experimental-strip-types scripts/index-record-claim-gate.ts --sweep [N]
 * Exit: 0 clean · 1 violation · 2 usage / no brief / no truth file (never a silent pass).
 * Wired into: system/Morning_Updater.md Step 4 (resolve-first list), system/Market_Data_Collector.md,
 * system/Brief_Editor.md Gate 17, system/Brief_Validator.md.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface IndexDef { key: string; label: string; re: RegExp }

/** Canonical index vocabulary. `key` MUST match the truth.json claim key the Morning Updater writes. */
export const INDEXES: IndexDef[] = [
  { key: 'sp500', label: 'S&P 500', re: /\bS&P(?:\s*500)?\b/gi },
  { key: 'dow', label: 'Dow', re: /\bDow(?:\s+Jones)?\b/gi },
  { key: 'nasdaq', label: 'Nasdaq', re: /\bNasdaq(?:\s*(?:100|Composite))?\b/gi },
  { key: 'russell', label: 'Russell 2000', re: /\bRussell(?:\s*2000)?\b/gi },
];

/**
 * A CLOSE-TYPE record frame. Deliberately NOT the bare word "record": "record revenue",
 * "record annual pace" and "record backlog" are ordinary superlatives about non-index things and
 * are handled by superlative-escalation-gate. This gate only bites the claim "this index is AT a
 * record".
 */
export const RECORD_FRAME =
  /(?:closed?\s+(?:at|on)\s+(?:a\s+|new\s+|its\s+|the\s+)?records?|at\s+(?:a|its|another)\s+record\b|record\s+clos(?:e|ing)|record\s+high|all-?time\s+high|set\s+(?:a|an|the|new|another)\s+records?|hit\s+(?:a|an|the|new|another)\s+records?|notched\s+(?:a|an|another)\s+records?|to\s+(?:a|another)\s+record\b|posted\s+(?:a|another)\s+record\s+clos)/i;

/** "without setting a record of its own", "not a record", "below its record", "shy of its high". */
export const RECORD_NEGATION =
  /\b(?:without|not|no|never|nor|shy\s+of|short\s+of|below|beneath|under|absent|failed\s+to|stopped\s+short\s+of|fell\s+short\s+of)\b[^.;]{0,70}?(?:record|all-?time\s+high)/i;

/** Connective tissue between members of an enumeration: "the S&P, the " / " and the ". */
const CONNECTIVE_ONLY = /^[\s,;]*(?:and|&|,)?[\s,;]*(?:the\s+)?$/i;

export interface Violation { kind: 'per-index' | 'title'; msg: string }

export function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, ' ');
}

/** The Daily Title is the first `### ` heading in the brief body. */
export function dailyTitle(md: string): string {
  const m = stripComments(md).split('\n').find((l) => /^###\s+\S/.test(l));
  return m ? m.replace(/^###\s+/, '').trim() : '';
}

const NUMWORD: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** A truth.json claim counts as an affirmative index-record confirmation only if all three hold. */
export function claimConfirmsRecord(claim: unknown): boolean {
  if (!claim || typeof claim !== 'object') return false;
  const c = claim as { resolved?: unknown; note?: unknown };
  if (c.resolved !== true) return false;
  const note = typeof c.note === 'string' ? c.note : '';
  if (/\bnot\s+a\s+record\b|\bno\s+record\b|\bbelow\s+its\b|\bshy\s+of\b|\bnot\s+at\s+a\s+record\b/i.test(note)) return false;
  return /record|all-?time\s+high/i.test(note);
}

interface Mention { key: string; label: string; pos: number }

/** Every index mention in a sentence, in reading order. */
export function mentionsIn(sentence: string): Mention[] {
  const out: Mention[] = [];
  for (const idx of INDEXES) {
    const re = new RegExp(idx.re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(sentence)) !== null) out.push({ key: idx.key, label: idx.label, pos: m.index });
  }
  return out.sort((a, b) => a.pos - b.pos);
}

/**
 * Which indexes does this sentence ASSERT are at records?
 * Each mention owns the text from itself to the next mention. A mention whose window is pure
 * connective tissue is an enumeration member and INHERITS the verdict of the mention that follows
 * it — that is how "the S&P, the Dow and the Nasdaq closed at records" becomes three claims.
 */
export function assertedIndexes(sentence: string): Mention[] {
  const ms = mentionsIn(sentence);
  if (ms.length === 0) return [];
  const frame: boolean[] = [];
  const neg: boolean[] = [];
  const windows: string[] = [];
  for (let i = 0; i < ms.length; i++) {
    const start = ms[i]!.pos;
    const end = i + 1 < ms.length ? ms[i + 1]!.pos : sentence.length;
    const w = sentence.slice(start, end);
    windows.push(w);
    frame.push(RECORD_FRAME.test(w));
    neg.push(RECORD_NEGATION.test(w));
  }
  // Backward pass: enumeration members inherit from their successor.
  for (let i = ms.length - 2; i >= 0; i--) {
    if (frame[i]) continue;
    const tail = windows[i]!.replace(new RegExp(`^\\s*(?:${INDEXES.map((x) => x.re.source).join('|')})`, 'i'), '');
    if (CONNECTIVE_ONLY.test(tail)) { frame[i] = frame[i + 1]!; neg[i] = neg[i + 1]!; }
  }
  const out: Mention[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ms.length; i++) {
    if (!frame[i] || neg[i]) continue;
    if (seen.has(ms[i]!.key)) continue;
    seen.add(ms[i]!.key);
    out.push(ms[i]!);
  }
  return out;
}

export function checkBrief(md: string, truth: { claims?: Record<string, unknown> }): Violation[] {
  const v: Violation[] = [];
  const claims = truth.claims ?? {};
  const body = stripComments(md);

  // CHECK A — every asserted index carries its own affirmative, resolved confirmation.
  const sentences = body.split(/(?<=[.!?])\s+|\n/).filter((s) => s.trim().length > 0);
  const reported = new Set<string>();
  for (const s of sentences) {
    if (!RECORD_FRAME.test(s)) continue;
    for (const m of assertedIndexes(s)) {
      if (reported.has(m.key)) continue;
      if (claimConfirmsRecord(claims[m.key])) continue;
      reported.add(m.key);
      const why = claims[m.key] === undefined
        ? 'no per-index confirmation in truth.json'
        : (claims[m.key] as { resolved?: unknown }).resolved !== true
          ? 'claim present but resolved:false'
          : 'claim resolved but its note does not affirm a record';
      v.push({ kind: 'per-index', msg: `${m.label}: record asserted, ${why} (claim key "${m.key}") — "${s.trim().slice(0, 150)}"` });
    }
  }

  // CHECK B — a Daily Title that counts records is checked against the confirmed count.
  const title = dailyTitle(md);
  const tm = title.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+records?\b/i);
  if (tm) {
    const claimed = NUMWORD[tm[1]!.toLowerCase()] ?? Number(tm[1]);
    const confirmed = INDEXES.filter((i) => claimConfirmsRecord(claims[i.key])).length;
    if (claimed !== confirmed) {
      v.push({ kind: 'title', msg: `title numeral "${tm[1]}" vs ${confirmed} confirmed record${confirmed === 1 ? '' : 's'} in truth.json — Daily Title: "${title}"` });
    }
  }
  return v;
}

function resolveBrief(date: string, explicit?: string): string | null {
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  for (const p of [`content/daily-updates/${date}.md`, `daily-briefs/${date}-v2.md`, `daily-briefs/${date}-v1.5.md`]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function runOne(date: string, explicit?: string, quiet = false): number {
  const bp = resolveBrief(date, explicit);
  const tp = `daily-briefs/${date}-truth.json`;
  if (!bp) { if (!quiet) console.error(`index-record-claim-gate: no brief found for ${date}`); return 2; }
  if (!fs.existsSync(tp)) { if (!quiet) console.error(`index-record-claim-gate: no truth file ${tp} — cannot evaluate; a missing truth file is NOT a pass`); return 2; }
  const md = fs.readFileSync(bp, 'utf8');
  const truth = JSON.parse(fs.readFileSync(tp, 'utf8'));
  const v = checkBrief(md, truth);
  if (!quiet) {
    console.log(`index-record-claim-gate ${date} — brief ${bp} · truth ${tp}`);
    if (v.length === 0) console.log('  ✓ every index-record assertion carries its own resolved confirmation, and the title numeral matches.');
    for (const x of v) console.log(`  ✗ [${x.kind}] ${x.msg}`);
  }
  return v.length ? 1 : 0;
}

function sweep(n: number): number {
  const dir = 'content/daily-updates';
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-n);
  let hit = 0, evaluated = 0;
  for (const f of files) {
    const d = f.replace('.md', '');
    if (!fs.existsSync(`daily-briefs/${d}-truth.json`)) continue;
    evaluated++;
    const r = runOne(d, undefined, true);
    if (r === 1) { hit++; console.log(`  ✗ ${d}`); runOne(d); }
  }
  console.log(`\nSWEEP — ${hit} of ${evaluated} evaluated briefs (last ${n} on disk) carry an unconfirmed index-record claim.`);
  return 0;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? '✓' : '✗'} ${label}`); if (!ok) fails++; };
  const TRUTH = { claims: {
    sp500: { resolved: true, note: 'RECORD CLOSE — confirmed' },
    dow: { resolved: true, note: 'RECORD CLOSE, first above 54,000 — confirmed' },
    nasdaq: { resolved: true, note: 'NOT A RECORD. Closed ~2% BELOW its early-June high.' },
  } };
  const fire = '### Three Records and One Leg\n\n*The S&P, the Dow and the Nasdaq all closed at records, with the Nasdaq leading.*';
  const clean = '### Two Records and One Leg\n\n*The S&P closed at a record 7,737 and the Dow at a record 54,086, while the Nasdaq\'s 2.59 percent led the session without setting a record of its own, the Russell sitting between them.*';

  const vf = checkBrief(fire, TRUTH);
  t(vf.some((x) => x.kind === 'per-index' && /Nasdaq/.test(x.msg)), 'FIRES on the real 08-05 group claim (Nasdaq inside "closed at records")');
  t(vf.some((x) => x.kind === 'title' && /"Three"/.test(x.msg) && /2 confirmed/.test(x.msg)), 'FIRES on the real Daily Title numeral (Three vs 2 confirmed)');
  // Assert on the flagged KEYS, not on message text — the message quotes the source sentence,
  // which itself names every index in the enumeration.
  const flaggedKeys = vf.filter((x) => x.kind === 'per-index').map((x) => (x.msg.match(/claim key "(\w+)"/) ?? [])[1]);
  t(flaggedKeys.length === 1 && flaggedKeys[0] === 'nasdaq', 'flags ONLY the unconfirmed index — the two real records are not touched');

  const vc = checkBrief(clean, TRUTH);
  t(vc.length === 0, 'SILENT on the corrected 08-05 sentence (explicit negation is not an assertion)');

  t(assertedIndexes('The S&P, the Dow and the Nasdaq all closed at records').length === 3,
    'a GROUP claim expands to N separate claims, never one');
  t(assertedIndexes("the Nasdaq's 2.59 percent led the session without setting a record of its own").length === 0,
    'an explicit negation asserts nothing');
  t(checkBrief('AMD posted a record $11,536 million of revenue and data-center construction hit a record annual pace.', TRUTH).length === 0,
    'non-index records (revenue, construction pace) are out of scope');
  t(checkBrief('The S&P rose 0.4 percent and the Dow fell 0.1 percent.', TRUTH).length === 0,
    'an ordinary move sentence is not a record claim');
  t(checkBrief('### Two Records and One Leg', { claims: { sp500: { resolved: true, note: 'record' }, dow: { resolved: false, note: 'record' } } })
    .some((x) => x.kind === 'title'), 'an UNRESOLVED claim does not count toward the confirmed total');
  t(checkBrief('The Nasdaq closed at a record.', { claims: { nasdaq: { resolved: true, note: 'confirmed up 2.6%' } } })
    .some((x) => /note does not affirm a record/.test(x.msg)), 'a resolved claim whose note never says "record" is not a confirmation');
  t(claimConfirmsRecord({ resolved: true, note: 'RECORD CLOSE' }) && !claimConfirmsRecord({ resolved: true, note: 'NOT A RECORD' }),
    'claimConfirmsRecord reads the note, both directions');

  // Hermetic file-level round trip: the CLI path must agree with the pure function.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irc-'));
  fs.writeFileSync(path.join(tmp, 'b.md'), fire);
  const v2 = checkBrief(fs.readFileSync(path.join(tmp, 'b.md'), 'utf8'), TRUTH);
  t(v2.length === vf.length, 'file round-trip agrees with the in-memory check');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\nindex-record-claim-gate selftest — ${12 - fails}/12 assertions passed`);
  if (fails) { console.error('❌ SELFTEST FAIL'); return 1; }
  console.log('✅ SELFTEST PASS — one index, one confirmation; a counted title is checked against the count.');
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) process.exit(selftest());
else if (argv.includes('--sweep')) {
  const n = Number(argv[argv.indexOf('--sweep') + 1]);
  process.exit(sweep(Number.isFinite(n) && n > 0 ? n : 30));
} else {
  const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) { console.error('usage: index-record-claim-gate.ts YYYY-MM-DD [--brief <path>] | --selftest | --sweep [N]'); process.exit(2); }
  const bi = argv.indexOf('--brief');
  process.exit(runOne(date, bi >= 0 ? argv[bi + 1] : undefined));
}
