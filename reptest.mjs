import { readFileSync } from 'fs';
import { checkRepetition, formatRepetitionFindings } from './lib/repetition-check.ts';
let md = readFileSync('daily-briefs/weekly/2026-W30-v1.md','utf8');
md = md.replace(/<!--[\s\S]*?-->/g, '');
const r = checkRepetition(md, { maxSections: 2 });
if (r.ok) console.log('✅ AT-MOST-TWICE PASS — no load-bearing figure in 3+ sections');
else { console.log('❌ AT-MOST-TWICE: '+r.findings.length+' finding(s):'); console.log(formatRepetitionFindings(r.findings)); }
