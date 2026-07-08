#!/usr/bin/env node --experimental-strip-types
/**
 * Standalone audio intro date gate — validates a script file or stdin snippet.
 *
 * Usage:
 *   node --experimental-strip-types scripts/audio-intro-gate.ts 2026-07-07 path/to/script.txt
 *   cat script.txt | node --experimental-strip-types scripts/audio-intro-gate.ts 2026-07-07 -
 */
import * as fs from 'fs';
import { auditAudioIntro } from '../lib/audio/audio-intro-gate.ts';
import { formatDisplayDateFromSlug } from '../lib/brief-date.ts';

function main() {
  const [, , dateSlug, scriptPath] = process.argv;
  if (!dateSlug || !scriptPath) {
    console.error('Usage: audio-intro-gate.ts <YYYY-MM-DD> <script-file|- > [displayDate]');
    process.exit(2);
  }

  const displayDate = process.argv[4] || formatDisplayDateFromSlug(dateSlug);
  const script =
    scriptPath === '-'
      ? fs.readFileSync(0, 'utf8')
      : fs.readFileSync(scriptPath, 'utf8');

  const result = auditAudioIntro(script, dateSlug, displayDate);
  if (result.ok) {
    console.log(`✅ audio-intro-gate PASS — ${dateSlug}`);
    process.exit(0);
  }

  console.error(`❌ audio-intro-gate FAIL — ${dateSlug}:`);
  for (const e of result.errors) console.error(`  ${e}`);
  process.exit(1);
}

main();
