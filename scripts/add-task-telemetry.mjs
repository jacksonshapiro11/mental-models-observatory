#!/usr/bin/env node
/**
 * add-task-telemetry.mjs — give every scheduled task the two lines the alarm layer needs.
 *
 * WHY: the Missing-Output Alarm (2026-05-16) and the zero-write alarm (2026-07-03,
 * E-ENV-ZERO-WRITE-01, after ~18 sessions fired and wrote nothing for 21 hours) both read
 * daily-briefs/{date}-pipeline-status.md. An audit on 2026-07-31 found 32 of 34 task bodies
 * never write the CANARY line and 30 of 34 never write a status line. Both alarms have been
 * reading a file almost nothing writes to.
 *
 *   node scripts/add-task-telemetry.mjs ~/Documents/Claude/Scheduled            # dry run
 *   node scripts/add-task-telemetry.mjs ~/Documents/Claude/Scheduled --write    # apply
 *
 * Backs up every file it touches to SKILL.md.bak-telemetry-{YYYY-MM-DD} first.
 * Idempotent: a body that already has both blocks is skipped.
 */
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
const write = process.argv.includes('--write');
const STAMP = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? 'manual';
if (!dir) {
  console.error(
    'usage: add-task-telemetry.mjs <ScheduledDir> [--write] [YYYY-MM-DD]'
  );
  process.exit(2);
}

const canary = task => `
## STEP 0 — CANARY (your very first action, before reading any file)

**BRIEF_DATE** = the brief this run feeds. If this task body already computes a BRIEF_DATE, use that.
Otherwise: afternoon/evening ET runs use **today + 1**; morning runs that publish the same day's
brief use **today**. State the value you used.

Append one line to \`daily-briefs/{BRIEF_DATE}-pipeline-status.md\`:

\`\`\`
{ISO_TIMESTAMP} | ${task} | CANARY | WRITE-OK
\`\`\`

If that append fails, or you cannot read the workspace: email cosmictrex11@gmail.com with subject
\`PIPELINE ALARM — session cannot access workspace — ${task} {ISO_TIMESTAMP}\` and STOP. Do not do
work whose output cannot persist. Email does not depend on the workspace mount; that is the point.
`;

const status = task => `
## FINAL STEP — STATUS LINE (never exit without one)

Append one line to \`daily-briefs/{BRIEF_DATE}-pipeline-status.md\`:

\`\`\`
{ISO_TIMESTAMP} | ${task} | {output_path} | SUCCESS|FAIL|SKIPPED | {one-line reason}
\`\`\`

Write a **FAIL** line if you produced no output. A silent failure is what cost the 2026-07-27
Critic and evening super-brief: the task ran, wrote nothing, said nothing, and nobody knew until
5 AM. SKIPPED is a valid, useful outcome. Silence is not.
`;

// Dead `skills/*/SKILL.md` mirror (archived 2026-06-12) -> live system/ files.
// 11 bodies, 28 references, incl. all six intel sweeps loading their "canonical standards"
// from files deleted seven weeks ago. Audited 2026-07-31.
const REMAP = {
  'skills/operating-system/SKILL.md':
    'system/Operating_System.md` + `system/Operating_Doctrine.md',
  'skills/source-network/SKILL.md': 'system/SOURCE_NETWORK.md',
  'skills/intelligence-processor/SKILL.md': 'system/Intelligence_Processor.md',
  'skills/morning-updater/SKILL.md': 'system/Morning_Updater.md',
  'skills/portfolio-monitor/SKILL.md': 'system/portfolio-monitor/SKILL.md',
  'skills/pipeline-controller/SKILL.md': 'system/Pipeline_Controller.md',
  'skills/brief-email/SKILL.md': 'system/Brief_Email.md',
  'skills/brief-editor/SKILL.md': 'system/Brief_Editor.md',
  'skills/brief-critic/SKILL.md': 'system/Brief_Critic.md',
  'skills/accountability-cycle/SKILL.md': 'system/Accountability_Cycle.md',
  'skills/brief-quality-gate/SKILL.md': 'system/Novelty_Audit.md',
  // Stale doc names that were never in the skills/ mirror (audited 2026-07-31):
  'system/Worldview.md': 'system/Current_Worldview_v5.md',
};

const HAS_CANARY = /canary/i;
const HAS_STATUS = /SUCCESS\|FAIL|pipeline-status/;

let changed = 0,
  skipped = 0;
for (const task of fs.readdirSync(dir).sort()) {
  const f = path.join(dir, task, 'SKILL.md');
  if (!fs.existsSync(f)) continue;
  let body = fs.readFileSync(f, 'utf8');
  const needC = !HAS_CANARY.test(body);
  const needS = !HAS_STATUS.test(body);
  let deadRefs = 0;
  let out = body;
  for (const [dead, live] of Object.entries(REMAP)) {
    const n = out.split(dead).length - 1;
    if (n) {
      deadRefs += n;
      out = out.split(dead).join(live);
    }
  }
  if (!needC && !needS && !deadRefs) {
    skipped++;
    console.log(`  skip  ${task} (already clean)`);
    continue;
  }
  if (needC) {
    // insert immediately after frontmatter so the canary is genuinely first
    const m = out.match(/^---\n[\s\S]*?\n---\n/);
    out = m
      ? out.slice(0, m[0].length) + canary(task) + out.slice(m[0].length)
      : canary(task) + out;
  }
  if (needS) out = out.trimEnd() + '\n' + status(task);

  console.log(
    `  ${write ? 'WRITE' : 'would'} ${task}  ${needC ? '+canary' : ''} ${needS ? '+status' : ''} ${deadRefs ? `+${deadRefs} dead-path` : ''}`
  );
  if (write) {
    fs.copyFileSync(f, `${f}.bak-telemetry-${STAMP}`);
    fs.writeFileSync(f, out, 'utf8');
  }
  changed++;
}
console.log(
  `\n${write ? 'updated' : 'would update'}: ${changed} · already complete: ${skipped}`
);
