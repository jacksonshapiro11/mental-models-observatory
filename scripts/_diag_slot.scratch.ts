import { rollCall, selfHealBlindness } from './pipeline-slot-attendance.js';
const root = process.cwd();
for (const d of ['2026-08-21','2026-08-22','2026-08-23','2026-08-24']) {
  const rc: any = rollCall({ docRoot: root, date: d });
  console.log(`${d}: exempt=${rc.exempt} absent=[${rc.absent.map((a:any)=>a.task).join(', ')}]`);
}
const bl: any = selfHealBlindness(root);
console.log('\nselfHealBlindness keys:', Object.keys(bl).join(', '));
console.log('boards=%s token=%s coverage=%s', bl.boards, bl.token, bl.coverage);
for (const k of Object.keys(bl)) {
  const v = (bl as any)[k];
  if (Array.isArray(v)) console.log(`  ${k}[${v.length}]:`, v.slice(0,8).map((x:any)=>typeof x==='string'?x.slice(0,130):JSON.stringify(x).slice(0,130)));
}
