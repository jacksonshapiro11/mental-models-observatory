/**
 * sync-model-whitelist.ts — THE CATALOG IS THE POOL.
 *
 * WHY (2026-07-31, Jackson): the rotation queue assigns the daily model from all 119
 * catalog models (select-daily-model.ts, IMP-095), but Brief_Editor Gate 8.1 hard-REJECTs
 * any concept absent from Model_Tier3_Whitelist.md — a hand-curated 54-row obscurity list
 * last touched 2026-07-01. Only 32 of the 119 queue models were on it, and 26 of those sat
 * inside the 30-day cooldown, leaving an effective pool of ~6. The system logged that as
 * E-MODEL-POOL-EXHAUSTION-01 "BINDING CONSTRAINT, data-layer expansion only Jackson can do"
 * (ESC-009, 4+ weeks). The catalog was never short. The gate was.
 *
 * WHAT: appends every queue model missing from the whitelist into a CATALOG TIER table.
 * Additive only — the 54 curated rows and their SLUG-TO-CONCEPT BINDING LOCK entries are
 * never touched, reordered, or rewritten. Idempotent: re-running adds only what is new.
 *
 *   node --experimental-strip-types scripts/sync-model-whitelist.ts          (report only)
 *   node --experimental-strip-types scripts/sync-model-whitelist.ts --write  (apply)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const QUEUE = path.join(ROOT, 'data/model-rotation-queue.json');
const WL = path.join(ROOT, 'system/Model_Tier3_Whitelist.md');
const MARKER = '## Catalog Tier — every rotation-queue model (auto-synced)';

export interface QModel { name: string; slug: string; domain: string }

export function missingFromWhitelist(models: QModel[], wl: string): QModel[] {
  return models.filter(m => !wl.includes(m.slug));
}

export function catalogTable(models: QModel[]): string {
  const rows = models
    .map(m => `| ${m.name} | ${m.domain} | \`${m.slug}\` |`)
    .join('\n');
  return `${MARKER}

Assigned by \`data/model-rotation-queue.json\` (\`select-daily-model.ts\`). These are eligible
under the same 30-day cooldown as the curated tier. A model here has no pre-bound author or
canonical example, so the SLUG-TO-CONCEPT BINDING LOCK does not apply — the slug is the concept.
The bar is the explanation, not the obscurity.

| Concept | Domain | Slug |
|---|---|---|
${rows}
`;
}

function main(): number {
  const write = process.argv.includes('--write');
  const models: QModel[] = JSON.parse(fs.readFileSync(QUEUE, 'utf8')).models;
  let wl = fs.readFileSync(WL, 'utf8');
  const missing = missingFromWhitelist(models, wl);

  console.log(`queue models: ${models.length}`);
  console.log(`already present: ${models.length - missing.length}`);
  console.log(`missing: ${missing.length}`);
  if (!missing.length) { console.log('✓ whitelist already covers the catalog.'); return 0; }
  if (!write) { console.log('\n(report only — pass --write to apply)'); return 0; }

  const idx = wl.indexOf(MARKER);
  const curated = (idx === -1 ? wl : wl.slice(0, idx)).trimEnd();
  const catalogModels = missingFromWhitelist(models, curated);
  fs.writeFileSync(WL, `${curated}\n\n---\n\n${catalogTable(catalogModels)}`, 'utf8');
  console.log(`✓ catalog tier rebuilt: ${catalogModels.length} models. Total eligible pool: ${models.length}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
