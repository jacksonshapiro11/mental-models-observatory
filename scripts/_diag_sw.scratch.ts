import { rollCall } from './pipeline-slot-attendance.js';
const root=process.cwd();
for (const [d,expected] of [['2026-08-01',2],['2026-08-03',1],['2026-08-05',1],['2026-08-12',1],['2026-08-21',1]] as [string,number][]) {
  const rc:any = rollCall({docRoot:root,date:d});
  console.log(`${d}: expected ${expected} absent | NOW absent=[${rc.absent.map((a:any)=>a.task).join(', ')||'—'}]`);
  for (const [k,v] of rc.crossBoard) console.log(`     RESCUED ${k}  <-  ${String(v).slice(0,110)}`);
}
