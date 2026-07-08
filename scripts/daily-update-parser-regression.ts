/**
 * Parser regression — new bold-date header format + old ##/### format.
 *
 * Run: npx tsx scripts/daily-update-parser-regression.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDailyBrief, isDisplayDateLine } from '../lib/daily-update-parser';
import { validateDisplayDateMatchesSlug } from '../lib/brief-date';

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? `\n      ${detail}` : ''}`);
  if (!ok) failures++;
}

const NEW_FORMAT_HEADER = `# MARKETS, MEDITATIONS & MENTAL MODELS

*Every plan I have ever made looked different after the first hour of actually doing it.*

**Tuesday, July 7, 2026**

## 4,800 Out, 6,000 In

*NATO opens in Ankara with $140 billion pledged for Ukraine.*

---

# ▸ THE DASHBOARD
`;

const OLD_FORMAT_HEADER = `# MARKETS, MEDITATIONS & MENTAL MODELS

*The question that changes everything.*

## Monday, June 1, 2026

### Dell's $60 Billion Question

*Dell reported AI server revenue of $16.1 billion.*

---

# ▸ THE DASHBOARD
`;

console.log('── isDisplayDateLine ──');
check('bold date line', isDisplayDateLine('**Tuesday, July 7, 2026**'));
check('## date line', isDisplayDateLine('## Monday, June 1, 2026'));
check('headline ## rejected', !isDisplayDateLine('## 4,800 Out, 6,000 In'));
check('section marker rejected', !isDisplayDateLine('## ▸ OVERNIGHT'));

console.log('── parseDailyBrief: new format ──');
const newParsed = parseDailyBrief(NEW_FORMAT_HEADER, '2026-07-07');
check('displayDate', newParsed.displayDate === 'Tuesday, July 7, 2026', `got "${newParsed.displayDate}"`);
check('dailyTitle', newParsed.dailyTitle === '4,800 Out, 6,000 In', `got "${newParsed.dailyTitle}"`);
check(
  'displayDate matches slug',
  validateDisplayDateMatchesSlug(newParsed.displayDate, '2026-07-07').ok,
);

console.log('── parseDailyBrief: old format ──');
const oldParsed = parseDailyBrief(OLD_FORMAT_HEADER, '2026-06-01');
check('displayDate', oldParsed.displayDate === 'Monday, June 1, 2026', `got "${oldParsed.displayDate}"`);
check('dailyTitle', oldParsed.dailyTitle === "Dell's $60 Billion Question", `got "${oldParsed.dailyTitle}"`);
check(
  'displayDate matches slug',
  validateDisplayDateMatchesSlug(oldParsed.displayDate, '2026-06-01').ok,
);

console.log('── live brief on disk (2026-07-07.md) ──');
const livePath = path.join(process.cwd(), 'content/daily-updates/2026-07-07.md');
if (fs.existsSync(livePath)) {
  const live = fs.readFileSync(livePath, 'utf8');
  const liveParsed = parseDailyBrief(live, '2026-07-07');
  check('live displayDate', liveParsed.displayDate === 'Tuesday, July 7, 2026', `got "${liveParsed.displayDate}"`);
  check('live dailyTitle', liveParsed.dailyTitle === '4,800 Out, 6,000 In', `got "${liveParsed.dailyTitle}"`);
  check(
    'live slug validation',
    validateDisplayDateMatchesSlug(liveParsed.displayDate, '2026-07-07').ok,
  );
} else {
  console.log('SKIP  live 2026-07-07.md not found');
}

console.log('── bad header would fail validation ──');
const badParsed = parseDailyBrief('## 4,800 Out, 6,000 In\n\n---\n', '2026-07-07');
// Parser falls back to slug-derived date when no date line found
check(
  'fallback displayDate from slug when header missing',
  badParsed.displayDate === 'Tuesday, July 7, 2026',
  `got "${badParsed.displayDate}"`,
);

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASS' : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
