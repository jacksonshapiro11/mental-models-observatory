#!/usr/bin/env node --experimental-strip-types
/**
 * novelty-gate.ts — the NOVELTY gate for The Take.
 *
 * The existing Novelty Audit catches word and skeleton overlap. By its own
 * admission it MISSES semantic recycling — the same thesis in different words.
 * That is why three consecutive Takes (06-06 Frustrated Markets, 06-07 Defensive
 * Convergence, 06-08 Captive Bid Cascade) were all the same structural move,
 * "a stable-looking system is secretly fragile," and nothing flagged it: the
 * topics differ, so every keyword/skeleton check passed.
 *
 * This gate operates one level deeper, on the MOVE — the rhetorical maneuver
 * underneath the topic. It bans repeating a move within a rolling window, and
 * flags title-form monotony ("The X: Why Y" six times in eight days).
 *
 * The move is read from a draft tag (<!-- take-move: <id> -->) when present;
 * otherwise inferred heuristically and FLAGGED for the writer to confirm. The
 * reliable path is the Writer tagging the move at generation — one line — with
 * this gate enforcing the ledger.
 *
 * Usage:
 *   node --experimental-strip-types scripts/novelty-gate.ts <brief.md> [--move <id>] [--window N] [--update]
 *
 * Exit codes: 0 pass · 1 move repeat within window · 2 usage error
 */
import * as fs from 'fs';
import * as path from 'path';

const MOVE_HEURISTICS: { move: string; re: RegExp }[] = [
  { move: 'stability-is-illusory', re: /\b(stabilit|stable|fragil|looks? (?:healthy|fine|calm|stable)|never (?:stable|was)|losing the buyers|made (?:it|them) stable|against (?:itself|themselves)|frustrat|illusion of)/i },
  { move: 'inversion', re: /\b(invert|inversion|the opposite|backwards|upside[- ]down|reverse(?:s|d)?)\b/i },
  { move: 'hidden-precondition', re: /\b(precondition|never measured|hidden (?:cause|driver|variable)|silently|underneath the)\b/i },
  { move: 'measurement-gap', re: /\b(verification gap|mismeasur|the metric|revision|the number (?:is|was) (?:lying|wrong)|gap between (?:the )?(?:number|metric))/i },
  { move: 'categorical-split', re: /\b(speciation|two (?:different )?(?:species|categories|industries|things)|death (?:certificate|and birth)|splitting into|bifurcat)/i },
  { move: 'demand-mirage', re: /\b(without customers|demand (?:without|with no)|mirage|revenue without|no (?:real )?foundation)/i },
  { move: 'mechanism-reframe', re: /\b(not (?:protectionism|a bubble|what it looks)|actually a (?:different )?mechanism|reframe)/i },
];

function inferMove(text: string): string | null {
  for (const h of MOVE_HEURISTICS) if (h.re.test(text)) return h.move;
  return null;
}

function titleForm(title: string): string {
  const t = title.trim();
  const hasColon = t.includes(':');
  const why = /:\s*why\b/i.test(t) || /\bwhy\b/i.test(t.split(':')[1] ?? '');
  const startsThe = /^the\b/i.test(t);
  if (startsThe && hasColon && why) return 'The-X-colon-Why';
  if (startsThe && hasColon) return 'The-X-colon';
  if (hasColon && why) return 'X-colon-Why';
  if (startsThe) return 'The-X';
  return 'other';
}

function extractTakeTitle(body: string): string | null {
  const start = body.indexOf('# ▸ THE TAKE');
  if (start === -1) return null;
  const rest = body.slice(start + '# ▸ THE TAKE'.length);
  const m = rest.match(/^\s*##\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function main() {
  const args = process.argv.slice(2);
  const briefArg = args.find((a) => !a.startsWith('--'));
  const moveArg = args.includes('--move') ? args[args.indexOf('--move') + 1] : null;
  const window = args.includes('--window') ? parseInt(args[args.indexOf('--window') + 1], 10) : 4;
  const update = args.includes('--update');

  if (!briefArg) { console.error('Usage: novelty-gate.ts <brief.md> [--move <id>] [--window N] [--update]'); process.exit(2); }
  const briefPath = path.isAbsolute(briefArg) ? briefArg : path.join(process.cwd(), briefArg);
  if (!fs.existsSync(briefPath)) { console.error(`File not found: ${briefPath}`); process.exit(2); }
  const body = fs.readFileSync(briefPath, 'utf8');
  const dateMatch = path.basename(briefPath).match(/(\d{4}-\d{2}-\d{2})/);
  const today = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  // Ledger
  const ledgerCandidates = [
    path.join(path.dirname(briefPath), '..', '..', 'system', 'take-ledger.json'),
    path.join(process.cwd(), 'system', 'take-ledger.json'),
  ];
  let ledgerPath = ledgerCandidates.find((p) => fs.existsSync(p)) ?? ledgerCandidates[1];
  const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { history: [] };
  const history: { date: string; title: string; move: string; title_form: string }[] = ledger.history ?? [];

  const title = extractTakeTitle(body) ?? '(no title found)';
  const tagMatch = body.match(/<!--\s*take-move:\s*([a-z0-9-]+)\s*-->/i);
  const firstPara = (() => {
    const start = body.indexOf('# ▸ THE TAKE');
    return start === -1 ? title : body.slice(start, start + 1200);
  })();
  const inferred = inferMove(`${title}\n${firstPara}`);
  const move = moveArg || (tagMatch ? tagMatch[1] : null) || inferred || 'unclassified';
  const moveSource = moveArg ? 'cli' : tagMatch ? 'draft-tag' : inferred ? 'inferred' : 'none';
  const form = titleForm(title);

  console.log(`novelty-gate — ${path.basename(briefPath)}`);
  console.log(`  take title : "${title}"`);
  console.log(`  move       : ${move}  (${moveSource})`);
  console.log(`  title form : ${form}`);

  const failures: string[] = [];
  const flags: string[] = [];

  // Move-repeat within rolling window (by distinct prior dates)
  const recent = history.filter((h) => h.date < today).slice(-window);
  const clash = recent.filter((h) => h.move === move);
  if (move !== 'unclassified' && clash.length > 0) {
    failures.push(
      `MOVE REPEAT: "${move}" already used ${clash.length}x in the last ${window} Takes — ${clash.map((c) => `${c.date} (${c.title})`).join(', ')}. ` +
      `This is the same rhetorical maneuver under a different topic. Reframe the Take around a different structural move, or pick a different thesis.`
    );
  }
  if (moveSource === 'inferred') {
    flags.push(`Move was INFERRED, not tagged. Add <!-- take-move: ${move} --> to the draft so the gate is deterministic, then re-run.`);
  }
  if (move === 'unclassified') {
    flags.push(`Move could not be classified. Tag the draft with <!-- take-move: <id> --> (see system/take-ledger.json _moves).`);
  }

  // Title-form monotony over last 5 (including today)
  const formsRecent = [...recent.map((h) => h.title_form), form].slice(-5);
  const theCount = formsRecent.filter((f) => f.startsWith('The-')).length;
  const whyCount = formsRecent.filter((f) => f.endsWith('Why')).length;
  if (theCount >= 4) flags.push(`Title-form monotony: ${theCount}/5 recent Take titles start with "The…". Vary the title structure.`);
  if (whyCount >= 3) flags.push(`Title-form monotony: ${whyCount}/5 recent Take titles use the ": Why…" construction.`);

  if (flags.length) { console.log(`\n  ${flags.length} FLAG (review):`); for (const f of flags) console.log(`   ⚠ ${f}`); }

  if (failures.length === 0) {
    if (update && move !== 'unclassified') {
      history.push({ date: today, title, move, title_form: form });
      ledger.history = history;
      try { fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)); console.log(`\n  ledger updated: ${path.basename(ledgerPath)}`); } catch { /* read-only */ }
    }
    console.log(`\n✅ NOVELTY-GATE PASS`);
    process.exit(0);
  }
  console.log(`\n❌ NOVELTY-GATE FAIL:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
  process.exit(1);
}

main();
