#!/usr/bin/env node --experimental-strip-types
/**
 * wildcard-freshness-gate.ts — A RE-SYNDICATION DATE IS NOT A PUBLICATION DATE.
 *
 * IMP-133 · 2026-08-06 Critic mandate #3 · RC2 · third consecutive night.
 *
 * ── THE FAILURE ────────────────────────────────────────────────────────────────────────────────
 * 2026-08-06 Wild Card 1: "Researchers … reported in *Nature* on August 4". The paper published
 * 2026-07-01 (University of Leicester newsroom; Nature s41586-026-10713-2). August 4 is when
 * ScienceDaily re-ran the story. 2026-08-05 Wild Card 2: ants "reported in Nature in late July";
 * the paper is July 8. 2026-08-04: the same shape again. Three nights, one mechanism — the item
 * was dated from the aggregator that surfaced it rather than from the journal that published it.
 *
 * The 08-06 instance is the one worth staring at, because the brief CAUGHT ITSELF and did not
 * notice: the very next sentence said the paper "landed on the forty-second anniversary of the
 * site's discovery," and Chengjiang was discovered 1984-07-01. The anniversary sentence is true
 * only of July 1. Both sentences were in the same paragraph, and the paragraph shipped.
 *
 * ── WHY NOTHING CAUGHT IT ──────────────────────────────────────────────────────────────────────
 * Receipt, 2026-08-06: `{DATE}-truth.json` carries 19 claims — equities, rates, crypto, five
 * superlatives, two ai-product rows, one derived price — and NOT ONE Wild Card row. The Wild Card
 * cites three journals and three dates and contributes zero claims to the truth ledger, because
 * `fact-gate` has no claim CLASS for a journal publication date: it is not a market claim, not a
 * superlative, not a scheduled event, not an aggregate. So it can never be `unverified-critical`,
 * so `--require-resolved` cannot hold it, so the Morning Truth Gate never sees it. This is not
 * three unlucky errors. It is a class with no gate and therefore a 100% pass rate, and the run of
 * three is simply how long it took for someone to look.
 *
 * The Wild Card Generator's own freshness screen is applied to CANDIDATES — items considered and
 * rejected. Nothing re-checks the item that SHIPPED. A screen that stops running at selection is
 * a screen against the wrong population.
 *
 * ── WHAT THIS GATE DOES ────────────────────────────────────────────────────────────────────────
 * Gives the class a name and a row. For every Wild Card item that names a journal AND asserts a
 * publication date, require a `journal:*` row in `{DATE}-truth.json` that is:
 *   1. resolved:true                              — somebody actually checked it
 *   2. sourced to the PUBLISHER, not a syndicator — sciencedaily/phys.org/EurekAlert/SciTechDaily
 *                                                   are distribution, and their date is the date
 *                                                   THEY ran it
 *   3. carrying a `date` that MATCHES the brief's assertion — including vague windows: "late July"
 *      admits July 21-31, so a July 8 paper contradicts it (the real 08-05 ants case)
 *
 * ── EPOCH ──────────────────────────────────────────────────────────────────────────────────────
 * Every brief in the archive predates the `journal:` claim class, so an ungated version red-fails
 * the entire corpus on day one — the IMP-125 mistake, documented and not to be repeated. Briefs
 * before EPOCH are measured and REPORTED; only briefs written under the rule can fail it.
 *
 * Usage:
 *   wildcard-freshness-gate.ts <YYYY-MM-DD | path-to-brief.md> [--truth <path>]
 *   wildcard-freshness-gate.ts --sweep [n]      # how big is this, actually?
 *   wildcard-freshness-gate.ts --selftest
 *
 * Exit codes: 0 clean (or pre-epoch) · 1 finding on an in-epoch brief · 2 usage error.
 */
import * as fs from 'fs';
import * as path from 'path';

const EPOCH = '2026-08-07'; // the first brief written after this rule exists

/** Distribution, not publication. Their date is the date THEY ran it. */
const SYNDICATORS = [
  'sciencedaily.com', 'phys.org', 'eurekalert.org', 'scitechdaily.com',
  'medicalxpress.com', 'techxplore.com', 'newswise.com', 'sci.news',
];

/** Journal publishers; an issuing university is also acceptable as the primary newsroom. */
const PUBLISHER_HOSTS = [
  'nature.com', 'science.org', 'pnas.org', 'cell.com', 'sciencedirect.com',
  'thelancet.com', 'nejm.org', 'jamanetwork.com', 'elifesciences.org', 'aps.org',
  'plos.org', 'springer.com', 'springernature.com', 'wiley.com', 'oup.com',
  'cambridge.org', 'frontiersin.org', 'bmj.com', 'sagepub.com',
  'tandfonline.com', 'royalsocietypublishing.org',
];

/** Journals whose publication date is a checkable fact of record. */
const JOURNALS = [
  'Nature Communications', 'Nature Medicine', 'Nature Astronomy', 'Nature Physics', 'Nature',
  'Science Advances', 'Science', 'PNAS', 'Proceedings of the National Academy',
  'Cell Reports', 'Cell', 'Scientific Reports', 'The Lancet', 'Lancet',
  'New England Journal of Medicine', 'NEJM', 'JAMA', 'eLife', 'Physical Review Letters',
];
const JOURNAL_RE = new RegExp(`\\b(${JOURNALS.map(j => j.replace(/ /g, '\\s+')).join('|')}|PLOS\\s+\\w+|Annals\\s+of\\s+[A-Z][\\w\\s]{2,40}?)\\b`);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export type DateClaim = { text: string; month: number; dayLo: number; dayHi: number; exact: boolean; year?: number };

/**
 * Pull the date a sentence asserts. Exact days ("on August 4") pin one day; vague windows
 * ("in late July") admit a range. A range is still a claim — "late July" is FALSE of July 8.
 */
export function parseDateClaim(s: string): DateClaim | null {
  const m = MONTHS.join('|');
  const exact = new RegExp(`\\b(?:on|dated)?\\s*(?:(\\d{1,2})\\s+(${m})|(${m})\\s+(\\d{1,2}))(?:,?\\s+(20\\d{2}))?\\b`, 'i').exec(s);
  if (exact) {
    const day = parseInt((exact[1] || exact[4])!, 10);
    const mon = MONTHS.indexOf((exact[2] || exact[3])!.toLowerCase()) + 1;
    const year = exact[5] ? parseInt(exact[5], 10) : undefined;
    if (day >= 1 && day <= 31) {
      return { text: exact[0].trim(), month: mon, dayLo: day, dayHi: day, exact: true, ...(year ? { year } : {}) };
    }
  }
  const vague = new RegExp(`\\b(early|mid|late)[-\\s]+(${m})(?:,?\\s+(20\\d{2}))?\\b`, 'i').exec(s);
  if (vague) {
    const mon = MONTHS.indexOf(vague[2]!.toLowerCase()) + 1;
    const which = vague[1]!.toLowerCase();
    const [lo, hi] = which === 'early' ? [1, 10] : which === 'mid' ? [11, 20] : [21, 31];
    const year = vague[3] ? parseInt(vague[3], 10) : undefined;
    return { text: vague[0].trim(), month: mon, dayLo: lo, dayHi: hi, exact: false, ...(year ? { year } : {}) };
  }
  const bare = new RegExp(`\\bin\\s+(${m})(?:,?\\s+(20\\d{2}))?\\b`, 'i').exec(s);
  if (bare) {
    const year = bare[2] ? parseInt(bare[2], 10) : undefined;
    return { text: bare[0].trim(), month: MONTHS.indexOf(bare[1]!.toLowerCase()) + 1, dayLo: 1, dayHi: 31, exact: false, ...(year ? { year } : {}) };
  }
  return null;
}

/** The Wild Card section's items, one string per item (blank-line separated paragraphs). */
export function wildCardItems(md: string): string[] {
  const lines = md.split('\n');
  const i = lines.findIndex(l => /^#{1,6}\s.*(?:The\s+)?Wild\s*Card/i.test(l));
  if (i === -1) return [];
  const body: string[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^#{1,6}\s/.test(lines[j]!)) break;
    body.push(lines[j]!);
  }
  return body.join('\n').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0 && !/^[-*_]{3,}$/.test(s));
}

export type Row = { key: string; resolved?: boolean; source?: string; date?: string; note?: string };
export type Finding = { kind: 'unledgered-journal-date' | 'source-authority' | 'syndicator-authority' | 'date-mismatch'; journal: string; detail: string };

function sourceHost(source: string): string {
  const url = source.match(/https?:\/\/[^\s)\]}>,"']+/i)?.[0];
  if (!url) return '';
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function isPublisherAuthority(host: string): boolean {
  return PUBLISHER_HOSTS.some(d => host === d || host.endsWith(`.${d}`))
    || /\.edu(?:\.[a-z]{2})?$/.test(host)
    || /\.ac\.[a-z]{2}$/.test(host);
}

const IDENTITY_STOP = new Set([
  'journal', 'nature', 'science', 'scientific', 'reports', 'researchers', 'researcher',
  'university', 'reported', 'published', 'publication', 'paper', 'study', 'result',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'early', 'late', 'with', 'from', 'that', 'this',
]);

/** Subject terms that bind one journal row to one item, not merely to the same journal. */
function distinctiveTerms(text: string): string[] {
  return [...new Set(
    text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
      .filter(t => t.length >= 4 && !IDENTITY_STOP.has(t)),
  )];
}

export function auditWildCard(md: string, rows: Row[], briefDate?: string): Finding[] {
  const findings: Finding[] = [];
  for (const item of wildCardItems(md)) {
    const journalMatches = [...item.matchAll(new RegExp(JOURNAL_RE.source, 'g'))];
    for (const jm of journalMatches) {
      const journal = jm[1]!.trim();
    // Only the sentence that names the journal asserts the publication date; a date elsewhere in
    // the item (a discovery anniversary, a launch) is a different fact and must not be attributed.
    // Read both sides of the journal name so "On August 4, researchers reported in Nature" is owned.
    const sentenceStart = item.lastIndexOf('.', jm.index) + 1;
    const sentenceEnd = item.indexOf('.', jm.index);
    const clause = item.slice(sentenceStart, sentenceEnd === -1 ? item.length : sentenceEnd + 1);
    const claim = parseDateClaim(clause);
    if (!claim) continue;                    // journal named without a date → nothing dated to check

    const jl = journal.toLowerCase();
    const terms = distinctiveTerms(item);
    const cand = rows.filter(r => {
      if (!r.key.toLowerCase().startsWith('journal:')) return false;
      const identity = `${r.key} ${r.note ?? ''}`.toLowerCase();
      if (!identity.includes(jl)) return false;
      const rowTerms = new Set(distinctiveTerms(identity));
      return terms.some(t => rowTerms.has(t));
    });
    const row = cand.find(r => r.resolved === true) ?? cand[0];

    if (!row || row.resolved !== true) {
      findings.push({
        kind: 'unledgered-journal-date', journal,
        detail: `"${journal} … ${claim.text}" has no resolved \`journal:*\` row in the truth file. A journal publication date is a checkable fact of record and it is currently checkable by nobody: verify it against the PUBLISHER (journal DOI page or the issuing university's newsroom) and record it, or drop the date and say "recently".`,
      });
      continue;
    }
    const src = (row.source ?? '').toLowerCase();
    const host = sourceHost(src);
    const syn = SYNDICATORS.find(d => host === d || host.endsWith(`.${d}`));
    if (syn) {
      findings.push({
        kind: 'syndicator-authority', journal,
        detail: `row \`${row.key}\` dates "${journal} … ${claim.text}" to ${syn}. That is a re-syndication date — the day the aggregator ran the story, not the day the journal published it. Re-source to the publisher's own record. (This is the exact 2026-08-06 Urokodia failure: ScienceDaily ran it August 4; Nature published it July 1.)`,
      });
      continue;
    }
    if (!isPublisherAuthority(host)) {
      findings.push({
        kind: 'source-authority', journal,
        detail: `row \`${row.key}\` does not cite a recognized journal publisher or university newsroom for "${journal} … ${claim.text}" (${row.source ? `source: ${row.source}` : 'source is missing'}). A resolved flag cannot turn an unattributed or secondary source into the publication record. Cite the journal DOI page or issuing university newsroom.`,
      });
      continue;
    }
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      findings.push({
        kind: 'unledgered-journal-date', journal,
        detail: `row \`${row.key}\` is resolved and publisher-sourced but carries no ISO \`date\` field, so the brief's "${claim.text}" is corroborated by nothing comparable. Add \`"date": "YYYY-MM-DD"\` from the publisher's record.`,
      });
      continue;
    }
    const [ry, mo, dy] = row.date.split('-').map(Number);
    const expectedYear = claim.year ?? (briefDate ? parseInt(briefDate.slice(0, 4), 10) : undefined);
    if ((expectedYear !== undefined && ry !== expectedYear) || mo !== claim.month || dy! < claim.dayLo || dy! > claim.dayHi) {
      findings.push({
        kind: 'date-mismatch', journal,
        detail: `the brief says "${journal} … ${claim.text}"; the ledger's publisher record says ${row.date}. ${claim.exact ? 'Those are different dates.' : `"${claim.text}" admits days ${claim.dayLo}-${claim.dayHi} of month ${claim.month}${expectedYear ? ` in ${expectedYear}` : ''}; ${row.date} is outside it.`} One of them is wrong, and the published one is the expensive one.`,
      });
      }
    }
  }
  return findings;
}

export function loadRows(truthPath: string): Row[] {
  if (!fs.existsSync(truthPath)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
    return Object.entries(j.claims ?? {}).map(([key, v]) => ({ key, ...(v as object) })) as Row[];
  } catch { return []; }
}

function resolveBrief(arg: string): { brief: string; date: string } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    const v2 = path.join(process.cwd(), 'daily-briefs', `${arg}-v2.md`);
    const pub = path.join(process.cwd(), 'content', 'daily-updates', `${arg}.md`);
    return { brief: fs.existsSync(pub) ? pub : v2, date: arg };
  }
  const p = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  return { brief: p, date: (path.basename(p).match(/(\d{4}-\d{2}-\d{2})/) ?? ['', ''])[1]! };
}

function runOne(briefPath: string, date: string, truthOverride?: string, quiet = false): number {
  if (!fs.existsSync(briefPath)) { console.error(`File not found: ${briefPath}`); return 2; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (!quiet) console.error(`Cannot determine brief date from filename: ${briefPath}. Use a YYYY-MM-DD filename so epoch and year enforcement cannot fail open.`);
    return 2;
  }
  const truthPath = truthOverride ?? path.join(process.cwd(), 'daily-briefs', `${date}-truth.json`);
  const findings = auditWildCard(fs.readFileSync(briefPath, 'utf8'), loadRows(truthPath), date);
  const inEpoch = date >= EPOCH;
  if (!quiet) {
    console.log(`wildcard-freshness-gate — ${path.basename(briefPath)} (${inEpoch ? 'IN EPOCH — findings BLOCK' : `pre-${EPOCH} — reported, never condemned`})`);
    for (const f of findings) console.log(`  ${inEpoch ? '🔴' : '🟡'} [${f.kind}] ${f.journal}: ${f.detail}`);
    if (!findings.length) console.log('  ✅ every journal-dated Wild Card item is backed by a resolved, publisher-sourced record.');
  }
  if (findings.length && inEpoch) {
    if (!quiet) console.error('\n❌ WILD CARD FRESHNESS FAIL — a journal date is unverified or contradicted. Verify against the publisher, or drop the date.');
    return 1;
  }
  return 0;
}

function sweep(n: number): number {
  const dir = path.join(process.cwd(), 'daily-briefs');
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f)).sort().slice(-n);
  let dated = 0, unledgered = 0;
  for (const f of files) {
    const date = f.slice(0, 10);
    const fs2 = auditWildCard(fs.readFileSync(path.join(dir, f), 'utf8'), loadRows(path.join(dir, `${date}-truth.json`)), date);
    if (fs2.length) { dated++; unledgered += fs2.length; console.log(`  ${date}: ${fs2.map(x => `${x.kind}/${x.journal}`).join(', ')}`); }
  }
  console.log(`\nSWEEP — ${files.length} briefs: ${dated} carry a journal-dated Wild Card item with no publisher-verified record (${unledgered} items).`);
  console.log('That is the size of the class nobody was checking. It is not three unlucky nights.');
  return 0;
}

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`); if (!ok) fails++; };
  const wrap = (items: string) => `## The Wild Card\n\n${items}\n\n## The Signal\n`;

  // VERBATIM from daily-briefs/2026-08-06-v2.md — the item the Critic caught.
  const UROKODIA = '**A two-centimetre animal that died 518 million years ago just turned out to be carrying the first draft of a spider\'s fangs.** Researchers from Yunnan University and the University of Leicester reported in *Nature* on August 4 that X-ray tomography of *Urokodia*, from the Chengjiang fossil beds in southern China, revealed soft anatomy mummified inside the rock, including a pair of pincer-like appendages behind its stalked eyes. The paper landed on the forty-second anniversary of the site\'s discovery.';
  // VERBATIM from daily-briefs/2026-08-05-v2.md — the vague-window instance.
  const ANTS = '**Evolution appears to have built parenting out of spare parts from the hunger system.** Researchers at Rockefeller University reported in Nature in late July that two ancient signalling molecules decide whether a clonal raider ant tends the colony\'s larvae or walks away to forage: neuropeptide F pushes toward care, allatostatin A pushes toward leaving, and the balance flips as the ant ages.';
  // VERBATIM from 2026-08-06 — a correctly dated item, which must stay silent once ledgered.
  const SHROUD = '**The Shroud of Turin has now been sequenced, and what came back is a guest list rather than an answer.** An international team led from the University of Lancashire reported in *Scientific Reports* on August 4 the first PCR-free metagenomic sequencing of the official 1978 samples. They found multiple human mitochondrial lineages, skin microbes, fungi, salt-adapted archaea, and DNA from wheat, maize, bananas, peanuts, cattle, dogs, cats and Mediterranean red coral.';
  const PREPOSED = '**A publication date placed before the journal name still belongs to the publication claim.** On August 4, researchers reported in *Nature* that a result had survived replication across three independent laboratories, with enough explanatory detail to clear the item-length floor.';

  const publisherRow = (key: string, note: string, date: string): Row =>
    ({ key, note, date, resolved: true, source: 'https://www.nature.com/articles/s41586-026-10713-2' });

  // 1. THE HEADLINE CASE — no ledger row at all. This is the 2026-08-06 state of the world:
  //    19 truth claims, zero Wild Card rows.
  const a = auditWildCard(wrap(UROKODIA), []);
  t(a.length === 1 && a[0]!.kind === 'unledgered-journal-date',
    '[IMP-133] FIRES on the real 08-06 Urokodia item — "*Nature* on August 4" with no journal row in truth.json');

  // 2. The same item, ledgered against the PUBLISHER's true date → the contradiction is now visible.
  const b = auditWildCard(wrap(UROKODIA), [publisherRow('journal:urokodia', 'Nature, Urokodia chelicerae, Leicester newsroom', '2026-07-01')]);
  t(b.length === 1 && b[0]!.kind === 'date-mismatch' && /2026-07-01/.test(b[0]!.detail),
    '[IMP-133] FIRES as DATE-MISMATCH once the publisher record is present — August 4 vs July 1');

  // 3. The syndicator trap, named: resolved, dated, and sourced to the aggregator that re-ran it.
  const c = auditWildCard(wrap(UROKODIA), [{ key: 'journal:urokodia', note: 'Nature, Urokodia', date: '2026-08-04', resolved: true, source: 'https://www.sciencedaily.com/releases/2026/08/260804.htm' }]);
  t(c.length === 1 && c[0]!.kind === 'syndicator-authority' && /sciencedaily/.test(c[0]!.detail),
    '[IMP-133] FIRES on a SYNDICATOR as date authority even when the row is resolved and the dates agree');

  // 4. A generic web citation is not transformed into a publisher record by `resolved:true`.
  const c2 = auditWildCard(wrap(UROKODIA), [{
    key: 'journal:urokodia', note: 'Nature, Urokodia', date: '2026-08-04',
    resolved: true, source: 'https://example.com/random-blog',
  }]);
  t(c2.length === 1 && c2[0]!.kind === 'source-authority',
    '[IMP-133] FIRES when a resolved row cites neither a publisher nor a university newsroom');
  const unrelated = auditWildCard(wrap(UROKODIA), [publisherRow(
    'market:unrelated', 'Nature, Urokodia', '2026-08-04',
  )], '2026-08-06');
  t(unrelated.length === 1 && unrelated[0]!.kind === 'unledgered-journal-date',
    '[IMP-133] FIRES when an otherwise matching row is not in the journal:* claim class');
  const wrongPaper = auditWildCard(wrap(UROKODIA), [publisherRow(
    'journal:different-paper', 'Nature, unrelated coral fluorescence study', '2026-08-04',
  )], '2026-08-06');
  t(wrongPaper.length === 1 && wrongPaper[0]!.kind === 'unledgered-journal-date',
    '[IMP-133] FIRES when the only journal row is for a different paper');

  // 5. The vague window is still a claim — the real 08-05 ants item, "late July" against July 8.
  const d = auditWildCard(wrap(ANTS), [publisherRow('journal:raider-ants', 'Nature, clonal raider ant neuropeptide F', '2026-07-08')]);
  t(d.length === 1 && d[0]!.kind === 'date-mismatch' && /21-31/.test(d[0]!.detail),
    '[IMP-133] FIRES on the real 08-05 ants item — "in late July" admits days 21-31, the paper is July 8');

  // 6-7. BOTH DIRECTIONS. A correct date, publisher-sourced and ledgered, must be SILENT — otherwise
  //      the gate is just an alarm, and an alarm that always sounds gets turned off.
  t(auditWildCard(wrap(SHROUD), [publisherRow('journal:shroud', 'Scientific Reports, Shroud of Turin metagenomics, Lancashire', '2026-08-04')]).length === 0,
    '[IMP-133] SILENT on 08-06 item 3 (Scientific Reports, August 4) once it is ledgered against the publisher');
  t(auditWildCard(wrap(ANTS), [publisherRow('journal:raider-ants', 'Nature, clonal raider ant', '2026-07-24')]).length === 0,
    '[IMP-133] SILENT when the publisher date falls INSIDE the vague window (July 24 is "late July")');

  // 8. Dates before the journal name still belong to that sentence and must ride the gate.
  const pre = auditWildCard(wrap(PREPOSED), []);
  t(pre.length === 1 && pre[0]!.kind === 'unledgered-journal-date',
    '[IMP-133] FIRES when the publication date precedes the journal name in the same sentence');
  const wrongYear = auditWildCard(wrap(PREPOSED), [publisherRow(
    'journal:replication', 'Nature replication laboratories', '2025-08-04',
  )], '2026-08-06');
  t(wrongYear.length === 1 && wrongYear[0]!.kind === 'date-mismatch',
    '[IMP-133] FIRES when month/day match but the publisher record is from the wrong year');
  const explicitYear = parseDateClaim('Researchers reported in Nature on August 4, 2025.');
  t(explicitYear?.year === 2025,
    '[IMP-133] preserves an explicitly asserted publication year instead of discarding it');
  t(auditWildCard(wrap('Researchers in Nature on August 4 found a new fossil species.'), []).length === 1,
    '[IMP-133] FIRES on a short journal-dated paragraph instead of silently excluding it');
  const twoJournals = auditWildCard(wrap(
    'Researchers reported one result in Nature on August 4. A separate team reported another in Science on August 5.',
  ), []);
  t(twoJournals.length === 2,
    '[IMP-133] checks every journal-dated claim in an item, not only the first journal name');

  // 9. Out of scope stays out of scope: no journal named, or a journal named with no date asserted.
  t(auditWildCard(wrap('**A city rebuilt its tram network and ridership tripled.** Officials in Grenoble said the line opened on August 2 after four years of work, and the surprise was who rode it: not commuters but shift workers, whose hours the old bus timetable never fit.'), []).length === 0,
    '[IMP-133] SILENT on a dated item that names no journal — this gate owns one class, not every date');
  t(auditWildCard(wrap('**Researchers reported in *Nature* that a two-centimetre Cambrian animal carried the first draft of a spider\'s fangs, recovered by X-ray tomography from the Chengjiang beds of southern China.**'), []).length === 0,
    '[IMP-133] SILENT when a journal is named with NO date asserted — nothing dated, nothing to contradict');

  // 10. The anniversary trap: a SECOND date later in the item must not be read as the publication date.
  const e = auditWildCard(wrap(UROKODIA), [publisherRow('journal:urokodia', 'Nature, Urokodia', '2026-08-04')]);
  t(e.length === 0, '[IMP-133] SILENT when the ledger matches the JOURNAL clause — the anniversary sentence later in the item is not misread as the publication date');

  // 11. THE EPOCH IS REAL — the archive is measured, never condemned (the IMP-125 lesson).
  const dir = path.join(process.cwd(), 'daily-briefs');
  if (fs.existsSync(dir)) {
    const archive = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-v2\.md$/.test(f) && f.slice(0, 10) < EPOCH).sort().slice(-6);
    t(archive.every(f => runOne(path.join(dir, f), f.slice(0, 10), undefined, true) === 0),
      `[IMP-133] EPOCH: the trailing ${archive.length} pre-${EPOCH} v2 files exit 0 (reported, never condemned)`);
  }

  console.log(`\nwildcard-freshness-gate selftest — ${fails ? 'FAILED' : 'PASS'} (unledgered + source authority + date-mismatch + date position + vague-window verified both directions)`);
  return fails ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  if (args.includes('--sweep')) return sweep(parseInt(args[args.indexOf('--sweep') + 1] || '30', 10) || 30);
  const target = args.find(a => !a.startsWith('--'));
  if (!target) { console.error('Usage: wildcard-freshness-gate.ts <YYYY-MM-DD | path-to-brief.md> [--truth <path>] | --sweep [n] | --selftest'); return 2; }
  const ti = args.indexOf('--truth');
  const { brief, date } = resolveBrief(target);
  return runOne(brief, date, ti === -1 ? undefined : args[ti + 1]);
}

const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]).endsWith('wildcard-freshness-gate.ts');
if (invokedDirectly) process.exit(main());
