/**
 * tree-status.ts — what is ACTUALLY at risk in this working tree.
 *
 * IMP-174 (2026-08-14). Closes CARRY row 1 and the 08-14 06:22 `verify-brief-publish` finding.
 *
 * THE DEFECT THIS REPLACES. The TREE rule (CLAUDE.md, added 2026-08-10) says: put
 * `git status --porcelain` in every nightly pipeline-status file, and if it is non-empty, write
 * `RED: UNCOMMITTED WORK`. That rule reads a WORKING TREE and draws a conclusion about a REMOTE,
 * and those are different questions. `publish.py` pushes through the GitHub REST API and creates
 * NO local commit, so the local HEAD sits permanently behind origin/main and `git status` reports
 * published-and-live reader-facing files as untracked FOREVER.
 *
 * COST, MEASURED: on the night of 2026-08-13 four consecutive tasks — the Critic, brief-light, and
 * the TREE blocks they wrote — escalated "three nights of PUBLISHED reader-facing content exist
 * ONLY in this working tree" for 2026-08-11/12/13. FALSE. All six files were live on origin/main
 * the whole time (aa1db95, 3889f28/068f7ac, ad7b059/265c9af). The 08-14 Critic called the resulting
 * RED "the largest single risk in the repository tonight". A rule that manufactures a RED every
 * single night does not raise the alarm — it teaches the next session to skim it.
 *
 * AND THE SECOND HOLE, from the same morning: `publish.py --verify` / `verify_published()` checks
 * EXISTENCE only (`git cat-file -e`), never bytes. A TRUNCATED publish passes it green. So this
 * script compares CONTENT, not presence — local-minus-HTML-comments against the remote blob,
 * because publish strips internal `<!-- … -->` blocks on the way out.
 *
 * Usage: npx tsx scripts/tree-status.ts [--no-fetch]
 *        npx tsx scripts/tree-status.ts --selftest
 * Exit:  0 clean · 1 real uncommitted work or a published/remote content mismatch · 2 usage
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';

/** Paths the git policy says are PUBLISHED to the reader (pushed by publish.py, not by commit). */
const PUBLISHED_RE = /^content\/daily-updates\/|^public\/audio\//;
/** Paths the git policy says must NEVER be committed. Dirt here is correct, not risk. */
const NEVER_COMMIT_RE =
  /^system\/|^daily-briefs\/|^daily-intelligence\/|^skills\/|^\.claude\/skills\//;

export type Verdict =
  | 'PUBLISHED-LIVE' // on origin/main and byte-identical → not at risk
  | 'PUBLISHED-DIVERGED' // on origin/main but the bytes differ → RED
  | 'PUBLISHED-ABSENT' // reader-facing and NOT on origin/main → RED, the real alarm
  | 'INTERNAL-BY-POLICY' // never-commit path → not at risk
  | 'COMMITTED-AT-HEAD' // dirty per the index, but the CONTENT is already in a commit
  | 'UNCOMMITTED-CODE'; // real uncommitted work → RED

export interface TreeRow {
  path: string;
  status: string;
  verdict: Verdict;
  note: string;
}

const git = (args: string[]): string => {
  try {
    // NEVER inherit GIT_INDEX_FILE. Sessions on this mount set it to a scratch path so git's
    // lock-unlinks survive the delete gate (CARRY 08-10 row 21) — and an EMPTY scratch index makes
    // `git status` report every tracked file in the repo as DELETED. Caught in testing: 828 paths
    // "at risk" on a tree with 11 dirty ones. A status tool that inherits a write-path hack is
    // measuring the hack.
    const env = { ...process.env };
    delete env.GIT_INDEX_FILE;
    return execFileSync('git', args, {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return '';
  }
};

/** publish.py strips internal HTML comments, so the remote copy is local-minus-comments. */
export function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Whitespace-normalised compare. Stripping a `<!-- … -->` block leaves the blank line that framed
 * it, so a raw string compare calls an identical publish DIVERGED — the exact false positive this
 * script exists to stop making. Collapse whitespace runs; a truncated publish is missing WORDS,
 * and no amount of whitespace normalisation can hide those.
 */
export function sameContent(local: string, remote: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, ' ').trim();
  return n(stripComments(local)) === n(remote) || n(local) === n(remote);
}

export function classify(
  path: string,
  status: string,
  onRemote: (p: string) => string | null,
  readLocal: (p: string) => string | null,
  onHead: (p: string) => string | null = () => null
): TreeRow {
  if (NEVER_COMMIT_RE.test(path))
    return {
      path,
      status,
      verdict: 'INTERNAL-BY-POLICY',
      note: 'never-commit path (git policy) — dirt here is correct',
    };

  if (PUBLISHED_RE.test(path)) {
    const remote = onRemote(path);
    if (remote === null)
      return {
        path,
        status,
        verdict: 'PUBLISHED-ABSENT',
        note: 'reader-facing and NOT on origin/main — this is the alarm the TREE rule was written for',
      };
    const local = readLocal(path);
    if (local === null)
      return {
        path,
        status,
        verdict: 'PUBLISHED-LIVE',
        note: 'on origin/main; local copy unreadable (deleted locally) — the reader is served',
      };
    return sameContent(local, remote)
      ? {
          path,
          status,
          verdict: 'PUBLISHED-LIVE',
          note: 'on origin/main and byte-identical once internal comments are stripped',
        }
      : {
          path,
          status,
          verdict: 'PUBLISHED-DIVERGED',
          note: 'on origin/main but the BYTES DIFFER — existence checks pass this; a truncated publish looks exactly like it',
        };
  }

  // THE SAME MISTAKE ONE LAYER DOWN, caught in testing on this script's own first live run: the
  // index is not the question either. Sessions on this mount commit through a scratch
  // GIT_INDEX_FILE, which leaves the real index stale, so `git status` reports files whose content
  // IS in a commit as `MM`. Ask the question that matters — is this content in a commit? — and ask
  // it of HEAD, not of the index.
  const atHead = onHead(path);
  const localNow = readLocal(path);
  if (atHead !== null && localNow !== null && sameContent(localNow, atHead))
    return {
      path,
      status,
      verdict: 'COMMITTED-AT-HEAD',
      note: 'content is already in a commit; only the index is stale (scratch-index commits leave it so)',
    };

  return {
    path,
    status,
    verdict: 'UNCOMMITTED-CODE',
    note: 'real uncommitted work — commit it or explain it',
  };
}

export function treeStatus(opts: { fetch?: boolean } = {}): TreeRow[] {
  if (opts.fetch !== false) git(['fetch', 'origin', 'main']);
  const porcelain = git(['status', '--porcelain']);
  const rows: TreeRow[] = [];
  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue;
    const status = line.slice(0, 2);
    let p = line.slice(3).trim();
    if (p.includes(' -> ')) p = p.split(' -> ').pop()!.trim();
    p = p.replace(/^"|"$/g, '');
    rows.push(
      classify(
        p,
        status,
        q => {
          const blob = git(['show', `origin/main:${q}`]);
          return blob === '' ? null : blob;
        },
        q => (fs.existsSync(q) ? fs.readFileSync(q, 'utf8') : null),
        q => {
          const blob = git(['show', `HEAD:${q}`]);
          return blob === '' ? null : blob;
        }
      )
    );
  }
  return rows;
}

const RED: Verdict[] = [
  'UNCOMMITTED-CODE',
  'PUBLISHED-DIVERGED',
  'PUBLISHED-ABSENT',
];

function selftest(): number {
  let fails = 0;
  const t = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
    if (!ok) fails++;
  };
  const remote = (m: Record<string, string>) => (p: string) => m[p] ?? null;
  const local = (m: Record<string, string>) => (p: string) => m[p] ?? null;

  const body = '# Brief\n\ntext\n';
  const withComments = '# Brief\n\n<!-- INTERNAL: notes -->\ntext\n';

  t(
    classify(
      'content/daily-updates/2026-08-14.md',
      '??',
      remote({ 'content/daily-updates/2026-08-14.md': body }),
      local({ 'content/daily-updates/2026-08-14.md': withComments })
    ).verdict === 'PUBLISHED-LIVE',
    'THE FALSE-RED CLASS IS GONE: an UNTRACKED published brief that is live on origin/main reads PUBLISHED-LIVE, not RED (comments stripped)'
  );
  t(
    classify(
      'content/daily-updates/2026-08-14.md',
      '??',
      remote({ 'content/daily-updates/2026-08-14.md': '# Brief\n' }),
      local({ 'content/daily-updates/2026-08-14.md': withComments })
    ).verdict === 'PUBLISHED-DIVERGED',
    'BITES ON TRUNCATION: same path, remote missing the body → PUBLISHED-DIVERGED (an existence check passes this)'
  );
  t(
    classify(
      'content/daily-updates/2026-08-15.md',
      '??',
      remote({}),
      local({ 'content/daily-updates/2026-08-15.md': body })
    ).verdict === 'PUBLISHED-ABSENT',
    'THE REAL ALARM SURVIVES: reader-facing content absent from origin/main → PUBLISHED-ABSENT'
  );
  t(
    classify('system/Improvement_Ledger.md', ' M', remote({}), local({}))
      .verdict === 'INTERNAL-BY-POLICY',
    'NEVER-COMMIT paths are not risk: a dirty system/ file is the git policy working, not a RED'
  );
  t(
    classify('daily-briefs/2026-08-14-v2.md', '??', remote({}), local({}))
      .verdict === 'INTERNAL-BY-POLICY',
    'daily-briefs/ likewise — the process is the secret sauce and is never committed'
  );
  t(
    classify('scripts/fact-gate.ts', ' M', remote({}), local({})).verdict ===
      'UNCOMMITTED-CODE',
    'REAL uncommitted code still goes RED — the rule is narrowed, not disarmed'
  );
  t(
    sameContent(withComments, body) && !sameContent('# A\n', '# B\n'),
    'sameContent: comment-stripping equality holds, and genuinely different bytes still differ'
  );

  t(
    classify(
      'scripts/fact-gate.ts',
      'MM',
      remote({}),
      local({ 'scripts/fact-gate.ts': 'export const x = 1;\n' }),
      local({ 'scripts/fact-gate.ts': 'export const x = 1;\n' })
    ).verdict === 'COMMITTED-AT-HEAD',
    'STALE-INDEX FALSE POSITIVE CLOSED: `MM` on a file whose content matches HEAD is COMMITTED-AT-HEAD, not RED (scratch-index commits leave the index stale)'
  );
  t(
    classify(
      'scripts/fact-gate.ts',
      'MM',
      remote({}),
      local({ 'scripts/fact-gate.ts': 'export const x = 2;\n' }),
      local({ 'scripts/fact-gate.ts': 'export const x = 1;\n' })
    ).verdict === 'UNCOMMITTED-CODE',
    'AND IT STILL BITES: the same path with content that DIFFERS from HEAD is UNCOMMITTED-CODE'
  );

  const total = 9;
  console.log(`\ntree-status selftest — ${total - fails}/${total} assertions passed`);
  if (fails) {
    console.error('✗ SELFTEST FAILED');
    return 1;
  }
  console.log(
    '✓ tree-status verified in BOTH directions — the false RED is gone and truncation still bites.'
  );
  return 0;
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const rows = treeStatus({ fetch: !args.includes('--no-fetch') });
  const red = rows.filter(r => RED.includes(r.verdict));

  console.log('TREE');
  if (!rows.length) {
    console.log('  clean working tree');
    console.log('\n✅ TREE GREEN — nothing dirty.');
    return 0;
  }
  for (const v of [
    'PUBLISHED-ABSENT',
    'PUBLISHED-DIVERGED',
    'UNCOMMITTED-CODE',
    'PUBLISHED-LIVE',
    'COMMITTED-AT-HEAD',
    'INTERNAL-BY-POLICY',
  ] as Verdict[]) {
    const g = rows.filter(r => r.verdict === v);
    if (!g.length) continue;
    console.log(`\n  ${v} (${g.length}) — ${g[0]!.note}`);
    for (const r of g) console.log(`    ${r.status} ${r.path}`);
  }
  if (red.length) {
    console.error(
      `\n🔴 RED: ${red.length} path(s) genuinely at risk. Canonical state lives in commits (code) or on origin/main (published content).`
    );
    return 1;
  }
  console.log(
    `\n✅ TREE GREEN — ${rows.length} dirty path(s), NONE at risk: published content verified live on origin/main by CONTENT, internal paths dirty by policy. ` +
      `A bare \`git status\` reads this state as RED and is wrong.`
  );
  return 0;
}

if (/tree-status\.ts$/.test(process.argv[1] ?? '')) process.exit(main());
