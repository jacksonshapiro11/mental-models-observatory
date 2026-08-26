import * as fs from 'fs'; import * as path from 'path';
import { selfHealedTask } from './pipeline-slot-attendance.js';
const db = path.join(process.cwd(), 'daily-briefs');
const files = fs.readdirSync(db).filter(f=>/^\d{4}-\d{2}-\d{2}-pipeline-status\.md$/.test(f)).sort();
const cov: string[] = [];
for (const f of files) {
  for (const line of fs.readFileSync(path.join(db,f),'utf8').split('\n')) {
    const t = (selfHealedTask as any)(line);
    if (t) cov.push(`${f.slice(0,10)}  ${t}  ::  ${line.slice(0,120)}`);
  }
}
console.log(`COVERAGE LINES = ${cov.length}`);
cov.forEach(c=>console.log('  '+c));
