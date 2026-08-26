import * as fs from 'fs';
import { checkInternalRatio } from './scripts/ceiling-lint.ts';
// sixBullets is not exported; re-derive minimally via the same regex the module uses.
function sixBullets(brief: string) {
  const m = brief.match(/^#\s*▸\s*THE SIX\s*$([\s\S]*?)(?=^##\s+The Wild Card|^#\s*▸)/m);
  if (!m) return [];
  const out: Array<{section:string;text:string}> = [];
  let section = '';
  for (const line of m[1]!.split('\n')) {
    const h = line.match(/^##\s+(.+)/); if (h) { section = h[1]!.trim(); continue; }
    if (/^-\s+\*\*/.test(line)) out.push({ section, text: line.replace(/^-\s+/, '') });
  }
  return out;
}
for (const d of ['2026-08-18','2026-08-17','2026-08-16','2026-08-15','2026-08-14','2026-08-13','2026-08-12','2026-08-11','2026-08-10','2026-08-09','2026-08-08','2026-08-07','2026-08-06']) {
  const p = `daily-briefs/${d}-v2.md`;
  if (!fs.existsSync(p)) { console.log(d,'MISSING'); continue; }
  const f = checkInternalRatio(sixBullets(fs.readFileSync(p,'utf8')) as any);
  console.log(`${d}: ${f.length} flag(s)`);
  for (const x of f) console.log('   ', x.where.slice(0,50), '|', x.message.slice(0,150));
}
