/**
 * gate-attendance.ts — THE GATE WIRING ROLL CALL (work order 2026-08-28, item 4).
 *
 * THE CLASS THIS ENDS, on its 4th occurrence: a gate is written, tested, documented as binding —
 * and connected to nothing. The measurement that forced this file: of 49 `scripts/*gate*.ts` on
 * disk, **9 have no executable invocation in any task body**, and `novelty-gate` is the sharpest
 * case — named "the binding novelty check" in SIX prose places across `system/`, stamped `PASS` on
 * the boards, and invoked by nobody. The boards were reporting a gate that does not run.
 *
 * Same shape as pipeline-slot-attendance, deliberately — that instrument is proven, and the failure
 * mode is identical: something is supposed to happen on a schedule, and nothing notices when it
 * doesn't. Two legs:
 *
 *   SWEEP (nightly)      — for each rostered gate, does the board carry its exit stamp, written by
 *                          one of the tasks the manifest names? Rostered gate with no stamp -> RED
 *                          on the next morning's summary.
 *   ORPHAN (creation)    — any scripts/*-gate.ts absent from the manifest and not explicitly
 *                          retired -> ORPHAN. Wired into verify-improvements so a NEW gate cannot
 *                          be born disconnected.
 *
 * Advisory by default (exit 0). `--red` returns 1 for a caller that wants the non-zero exit.
 */
import * as fs from 'fs';
import * as path from 'path';

export const MANIFEST = 'system/gate-manifest.json';
const DB = (root: string) => path.join(root, 'daily-briefs');
export const boardPath = (root: string, date: string) =>
  path.join(DB(root), `${date}-pipeline-status.md`);

export interface ManifestRow { gate: string; tasks: string[]; wired?: boolean; note?: string; stamp?: string[] }
export interface Manifest {
  _effective_from?: string;
  classes: Record<string, ManifestRow[]>;
  retired: Record<string, string>;
  unrostered_unretired?: { gates: string[] };
}

export function loadManifest(root: string): Manifest {
  return JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf-8'));
}

/** A line's owning task is field 2 — never a substring of the payload (IMP-184). */
export function lineTask(raw: string): string | null {
  const f = raw.split('|');
  if (f.length < 2) return null;
  if (!/^\s*\[?\s*\d{4}-\d{2}-\d{2}T[\d:]+(?:Z|[+-]\d{2}:?\d{2})?\s*\]?\s*$/.test(f[0]!)) return null;
  return f[1]!.trim() || null;
}

export interface GateFinding {
  cls: string; gate: string; expected: string[]; wired: boolean; note?: string; line: string;
}

/**
 * Which rostered gates left no stamp on this board.
 *
 * A STAMP IS A MENTION BY AN EXPECTED TASK, not proof the gate ran — this instrument can only see
 * what the board says, exactly like the slot roll call, and it carries the same scope limit:
 * IT ANSWERS "DID ANYONE SAY IT RAN", NOT "DID IT RUN". `novelty-gate` is the standing proof that
 * those differ: it is stamped by three tasks on a board and invoked by no body on disk. That is
 * what `wired: false` records, and why a stamped-but-unwired gate is reported RED anyway.
 */
export function sweep(root: string, date: string): { findings: GateFinding[]; unwired: GateFinding[]; checked: number } {
  const man = loadManifest(root);
  const bp = boardPath(root, date);
  const lines = fs.existsSync(bp) ? fs.readFileSync(bp, 'utf-8').split('\n') : [];
  const findings: GateFinding[] = [], unwired: GateFinding[] = [];
  let checked = 0;
  for (const [cls, rows] of Object.entries(man.classes)) {
    for (const r of rows) {
      checked++;
      const stamped = lines.some(l => {
        const t = lineTask(l);
        if (!t || !r.tasks.includes(t)) return false;
        const payload = l.split('|').slice(4).join('|');
        // The board's own vocabulary, not the filename. See `_stamp_note` in the manifest.
        return [r.gate, ...(r.stamp ?? [])].some(a => payload.includes(a));
      });
      const base = { cls, gate: r.gate, expected: r.tasks, wired: r.wired !== false, note: r.note };
      if (!stamped)
        findings.push({ ...base, line: `MISSING-GATE: ${r.gate} (${cls}) — no exit stamp from ${r.tasks.join(' or ')} on ${date}` });
      else if (r.wired === false)
        unwired.push({ ...base, line: `STAMPED-BUT-UNWIRED: ${r.gate} (${cls}) — the board says it ran; no body invokes it` });
    }
  }
  return { findings, unwired, checked };
}

/** Gates on disk that the manifest neither rosters nor retires. */
export function orphans(root: string): { orphans: string[]; rostered: string[]; retired: string[]; onDisk: string[] } {
  const man = loadManifest(root);
  const onDisk = fs
    .readdirSync(path.join(root, 'scripts'))
    .filter(f => /gate.*\.ts$/.test(f) && !/\.bak|scratch/.test(f))
    .map(f => f.replace(/\.ts$/, ''))
    .sort();
  const rostered = [...new Set(Object.values(man.classes).flat().map(r => r.gate))].sort();
  const retired = Object.keys(man.retired).sort();
  const known = new Set([...rostered, ...retired, ...(man.unrostered_unretired?.gates ?? [])]);
  return { orphans: onDisk.filter(g => !known.has(g)), rostered, retired, onDisk };
}

// ---------- selftest ----------
function main(): void {
  const root = process.cwd();
  const argv = process.argv.slice(2);

  if (argv.includes('--selftest')) {
    let pass = 0, fail = 0;
    const t = (name: string, ok: boolean) => {
      ok ? pass++ : fail++;
      console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${name}`);
    };
    const man = loadManifest(root);
    t('[manifest] loads and carries all four artifact classes', ['draft', 'v2', 'light', 'publish'].every(k => k in man.classes));
    t('[manifest] every rostered row names at least one task that must stamp it', Object.values(man.classes).flat().every(r => r.tasks.length > 0));

    // SILENT on the green night it was seeded from — anything else means the seed is wrong.
    const green = sweep(root, '2026-08-27');
    // GREEN MEANS: every row the manifest claims is WIRED left a stamp on the night it was seeded
    // from. It does NOT mean zero findings — the `wired: false` rows are known-RED by construction
    // until item 5 connects them, and a selftest that demanded total silence would have to launder
    // them green to pass. The pin is therefore two-sided: no wired row missing, and the only
    // missing rows are the ones the manifest already declares unwired.
    const missedWired = green.findings.filter(f => f.wired);
    t(
      `[sweep] every WIRED row stamped on 2026-08-27, the green night the manifest was seeded from — ${green.checked} rostered row(s), ${missedWired.length} wired row(s) missing`,
      missedWired.length === 0
    );
    t(
      `[sweep] and the only missing row is one the manifest already declares unwired — novelty-gate on the light surface, which item 5 connects (${green.findings.map(f => f.gate + '/' + f.cls).join(', ') || 'none'})`,
      green.findings.every(f => !f.wired) && green.findings.some(f => f.gate === 'novelty-gate' && f.cls === 'light')
    );
    // 🔴 …and NOT silent about the gate that is stamped by nobody's code.
    t(
      `[sweep] but it does NOT call novelty-gate healthy — stamped on 08-27 by three tasks, invoked by no body: ${green.unwired.length} STAMPED-BUT-UNWIRED`,
      green.unwired.some(u => u.gate === 'novelty-gate')
    );
    // MUST FIRE on a board where a rostered gate genuinely left no stamp.
    const empty = sweep(root, '1999-01-01');
    t(
      `[sweep] FIRES on a board with no lines at all — every rostered gate reported missing (${empty.findings.length}/${empty.checked})`,
      empty.findings.length === empty.checked && empty.checked > 0
    );
    t(
      '[sweep] the emitted line matches the mandated shape: "MISSING-GATE: {gate} ({class}) — no exit stamp from {tasks} on {date}"',
      /^MISSING-GATE: [a-z0-9-]+ \([a-z0-9]+\) — no exit stamp from .+ on \d{4}-\d{2}-\d{2}$/.test(empty.findings[0]!.line)
    );
    // A stamp only counts from an EXPECTED task — a narration by anyone else is not attendance.
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gate-att-'));
    fs.mkdirSync(path.join(tmp, 'daily-briefs'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'system'), { recursive: true });
    fs.copyFileSync(path.join(root, MANIFEST), path.join(tmp, MANIFEST));
    fs.writeFileSync(
      boardPath(tmp, '2026-01-01'),
      '2026-01-01T00:00:00Z | brief-feedback | x.md | SUCCESS | register-gate EXIT 0 and fact-gate EXIT 0\n'
    );
    const wrongTask = sweep(tmp, '2026-01-01');
    t(
      '[sweep] a gate named by a task the manifest does NOT expect is not credited — brief-feedback narrating register-gate is not brief-morning running it',
      wrongTask.findings.some(f => f.gate === 'register-gate')
    );

    const o = orphans(root);
    t(
      `[orphan] every gate on disk is rostered, retired, or explicitly backlogged — ${o.onDisk.length} on disk, ${o.orphans.length} orphan(s): ${o.orphans.join(', ') || 'none'}`,
      o.orphans.length === 0
    );
    // The orphan leg must actually be capable of firing, or it is decoration.
    const tmp2 = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gate-orph-'));
    fs.mkdirSync(path.join(tmp2, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp2, 'system'), { recursive: true });
    fs.copyFileSync(path.join(root, MANIFEST), path.join(tmp2, MANIFEST));
    fs.writeFileSync(path.join(tmp2, 'scripts', 'brand-new-gate.ts'), '// born disconnected\n');
    t(
      '[orphan] FIRES on a gate that is neither rostered nor retired — a new gate cannot be born connected to nothing',
      orphans(tmp2).orphans.includes('brand-new-gate')
    );

    console.log(`\n${fail ? '❌' : '✅'} gate-attendance --selftest: ${pass}/${pass + fail} assertions passed.`);
    process.exit(fail ? 1 : 0);
  }

  if (argv.includes('--orphans')) {
    const o = orphans(root);
    console.log(`gate-attendance --orphans · ${o.onDisk.length} gate script(s) on disk · ${o.rostered.length} rostered · ${o.retired.length} retired`);
    const man2 = loadManifest(root);
    const backlog = man2.unrostered_unretired?.gates ?? [];
    if (!o.orphans.length) {
      console.log('✅ NO ORPHANS — every gate on disk is rostered, retired, or explicitly backlogged.');
      // Said out loud, because "no orphans" is otherwise bought with a list nobody reads.
      console.log(
        `\n🟡 BUT THE BACKLOG IS THE REAL NUMBER: ${backlog.length} gate(s) exist, are NOT retired, and belong to NO artifact class.\n` +
          `   They are "explicitly backlogged", which is a promise to classify them, not a classification:\n` +
          `   ${backlog.join(', ')}\n` +
          `   Each needs a class or a retirement reason. Until then each one runs on no night.`
      );
    }
    else {
      for (const g of o.orphans) console.log(`ORPHAN-GATE: scripts/${g}.ts — in no artifact class and not retired`);
      console.log(`\n🔴 ${o.orphans.length} orphan(s). A gate that belongs to no artifact class runs on no night.`);
    }
    process.exit(argv.includes('--red') && o.orphans.length ? 1 : 0);
  }

  const date = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) {
    console.log('gate-attendance.ts — the gate wiring roll call.');
    console.log('  gate-attendance <DATE> [--red] | --orphans [--red] | --selftest');
    process.exit(2);
  }
  const s = sweep(root, date);
  console.log(`gate-attendance ${date} — ${s.checked} rostered gate-row(s) across ${Object.keys(loadManifest(root).classes).length} artifact classes`);
  console.log(`   stamped ${s.checked - s.findings.length} · MISSING ${s.findings.length} · STAMPED-BUT-UNWIRED ${s.unwired.length}`);
  for (const f of s.findings) console.log(f.line);
  for (const u of s.unwired) {
    console.log(u.line);
    if (u.note) console.log(`   ${u.note}`);
  }
  if (!s.findings.length && !s.unwired.length)
    console.log('\n✅ FULL GATE ATTENDANCE — every rostered gate left a stamp, and every stamp has a body behind it.');
  else
    console.log(
      `\n🔴 RED for the next morning's summary. A rostered gate with no stamp did not run; a stamp with no\n` +
        `   body behind it is worse — the board reported a gate that is connected to nothing.`
    );
  process.exit(argv.includes('--red') && (s.findings.length || s.unwired.length) ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('gate-attendance')) main();
