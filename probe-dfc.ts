import * as fs from 'fs';
import { derivedFigureContradictionFindings, loadPredrafts } from './scripts/fact-gate.ts';
for (const d of ['2026-08-18','2026-08-17','2026-08-16','2026-08-15','2026-08-14','2026-08-13','2026-08-12','2026-08-11','2026-08-10']) {
  const p = `daily-briefs/${d}-v2.md`;
  if (!fs.existsSync(p)) { console.log(d,'MISSING'); continue; }
  const f = derivedFigureContradictionFindings(fs.readFileSync(p,'utf8'), loadPredrafts(p, d));
  console.log(`${d}: ${f.length}`);
  for (const x of f) console.log('   ', x.message.slice(60, 300));
}
