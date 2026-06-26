#!/usr/bin/env node --experimental-strip-types
/**
 * Ad-hoc retirement audit for Editor / Validator / Critic checks.
 *
 * UPDATED April 13, 2026 — no longer scheduled; run when check bloat is
 * suspected. The output is diagnostic, not prescriptive.
 *
 * Reads the last 14 editor logs in daily-briefs/, counts how often each
 * numbered check appears next to a 🔴 or 🟡 marker, and emits three lists:
 *   - Never-fired checks (AMBIGUOUS — could be dead weight OR missed trigger)
 *   - Low-yield checks (fired only as 🟡 or 📝, never 🔴)
 *   - Healthy checks (fired 🔴 at least once)
 *
 * Critical: a never-fired check has two possible explanations:
 *   (a) Failure mode doesn't occur → retire
 *   (b) Failure mode occurs but check doesn't trigger → fix the check or
 *       promote to the Mechanical Gate as code
 *
 * The script cannot distinguish (a) from (b) automatically. Every entry in
 * the "Never-fired" list must be cross-checked against Jackson's recent
 * feedback and morning-update corrections before retiring.
 *
 * Usage:
 *   node --experimental-strip-types scripts/retirement-audit.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'daily-briefs');
const EDITOR_PATH = path.join(ROOT, 'system', 'Brief_Editor.md');
const LOOKBACK_DAYS = 14;

function collectChecks(editorMd: string): string[] {
  // Match "### Check N" or "\n## Check N" or numbered "N. **Name**" patterns.
  const re = /\n(\d+[a-z]?)\.\s+\*\*[^*]+\*\*/g;
  const subRe = /\*\*\(([a-z]\d?)\)\s+[^*]+\*\*/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(editorMd))) set.add(m[1]);
  while ((m = subRe.exec(editorMd))) set.add(m[1]);
  return Array.from(set).sort();
}

function listRecentLogs(): string[] {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs.readdirSync(LOG_DIR).filter((f) => /-editor-log\.md$/.test(f));
  files.sort().reverse();
  return files.slice(0, LOOKBACK_DAYS).map((f) => path.join(LOG_DIR, f));
}

function analyze() {
  const editorMd = fs.readFileSync(EDITOR_PATH, 'utf8');
  const checks = collectChecks(editorMd);
  const logs = listRecentLogs();

  // For each check, count red/yellow mentions across the log window.
  const stats: Record<string, { red: number; yellow: number; note: number }> = {};
  for (const c of checks) stats[c] = { red: 0, yellow: 0, note: 0 };

  for (const logPath of logs) {
    const txt = fs.readFileSync(logPath, 'utf8');
    // Look for "Check N" or "check N" mentions within context of 🔴/🟡/📝
    const lines = txt.split('\n');
    for (const line of lines) {
      const redMatch = line.includes('🔴');
      const yellowMatch = line.includes('🟡');
      const noteMatch = line.includes('📝');
      if (!redMatch && !yellowMatch && !noteMatch) continue;
      for (const c of checks) {
        const re = new RegExp(`[Cc]heck\\s+${c}\\b`);
        if (re.test(line)) {
          if (redMatch) stats[c].red++;
          else if (yellowMatch) stats[c].yellow++;
          else if (noteMatch) stats[c].note++;
        }
      }
    }
  }

  const neverFired: string[] = [];
  const lowYield: string[] = [];
  const healthy: string[] = [];
  for (const c of checks) {
    const s = stats[c];
    const total = s.red + s.yellow + s.note;
    if (total === 0) neverFired.push(c);
    else if (s.red === 0) lowYield.push(`${c} (🟡×${s.yellow} 📝×${s.note})`);
    else healthy.push(`${c} (🔴×${s.red} 🟡×${s.yellow} 📝×${s.note})`);
  }

  console.log(`Retirement Audit — ${logs.length} editor log(s) scanned (window: last ${LOOKBACK_DAYS} days)`);
  console.log(`Total checks discovered in Brief_Editor.md: ${checks.length}`);
  console.log('');
  console.log(`❓ Never-fired checks — AMBIGUOUS: ${neverFired.length}`);
  console.log(`   For each, ask: did the failure mode not occur, OR did it occur but escape this check?`);
  console.log(`   Cross-check against Jackson's feedback and morning updates before deciding.`);
  console.log(`   If the failure occurred and was caught elsewhere → the trigger is miscalibrated, do NOT retire.`);
  console.log(`   If the failure mode genuinely didn't occur in ${LOOKBACK_DAYS} days → candidate for retirement.`);
  for (const c of neverFired) console.log(`   - Check ${c}`);
  console.log('');
  console.log(`🟡 Low-yield checks (fired only as 🟡 or 📝, never 🔴 in window): ${lowYield.length}`);
  console.log(`   Same ambiguity applies — low severity may mean low stakes OR low detection fidelity.`);
  for (const c of lowYield) console.log(`   - Check ${c}`);
  console.log('');
  console.log(`✅ Healthy checks (fired 🔴 at least once): ${healthy.length}`);
  for (const c of healthy) console.log(`   - Check ${c}`);
  console.log('');
  console.log(`Diagnostic only. No automatic retirement recommendations. Mechanical checks in scripts/validate-brief.ts are not in this audit's scope — they're code, they don't drift.`);
}

analyze();
