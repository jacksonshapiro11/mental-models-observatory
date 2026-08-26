import * as fs from 'fs';
import { splitIntoSegments, checkRepetition, formatRepetitionFindings } from './lib/repetition-check';
const f = process.argv[2];
const md = fs.readFileSync(f,'utf8').replace(/<!--[\s\S]*?-->/g,'');
const segs = splitIntoSegments(md);
console.log('segments:', segs.length, segs.map((s:any)=>s.section||s.name||'?').join(' | '));
const r = checkRepetition(segs as any);
console.log(r.ok ? '✅ at-most-twice PASS' : '❌ at-most-twice FAIL');
if(!r.ok) console.log(formatRepetitionFindings(r.findings));
