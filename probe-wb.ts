import * as fs from 'fs';
import { checkWatchBinding } from './scripts/assembly-gate.ts';
for (const d of ['2026-08-18','2026-08-16','2026-08-17','2026-08-15','2026-08-14','2026-08-13','2026-08-12']) {
  const p = `daily-briefs/${d}-v2.md`;
  if (!fs.existsSync(p)) { console.log(d, 'MISSING'); continue; }
  const r = checkWatchBinding(fs.readFileSync(p,'utf8'));
  console.log(`${d}: ${r.length ? 'FLAG' : 'silent'}`);
  if (r.length) console.log('   ', r[0]!.slice(0, 340));
}
