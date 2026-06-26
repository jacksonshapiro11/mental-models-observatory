#!/usr/bin/env node --experimental-strip-types
/**
 * Regenerate the catalog section of system/Model_Library.md from lib/readwise-data.ts.
 *
 * Usage: node --experimental-strip-types scripts/regenerate-model-library.ts
 *
 * This reads all 119+ models from readwise-data.ts, groups them by domain, and emits
 * the catalog block. The hand-curated sections above "## The Catalog" are preserved
 * — this script only rewrites the catalog itself and the header count.
 *
 * If you add, rename, or remove a model in readwise-data.ts, run this script and
 * commit the resulting Model_Library.md change in the same PR.
 */
import * as fs from 'fs';
import * as path from 'path';
import { READWISE_MODELS } from '../lib/readwise-data.ts';

const LIBRARY_PATH = path.join(__dirname, '..', 'system', 'Model_Library.md');
const CATALOG_MARKER = '## The Catalog';
const FOOTER_MARKER = '## Regeneration Procedure';

function firstSentence(desc: string): string {
  const m = (desc || '').replace(/\s+/g, ' ').match(/^[^.!?]*[.!?]/);
  return m ? m[0].trim() : (desc || '').slice(0, 180);
}

function buildCatalog(): string {
  const byDomain: Record<string, { name: string; slug: string; gloss: string }[]> = {};
  for (const m of READWISE_MODELS) {
    const d = m.domain || 'Other';
    if (!byDomain[d]) byDomain[d] = [];
    byDomain[d].push({ name: m.name, slug: m.slug, gloss: firstSentence(m.description || '') });
  }
  const domainCount = Object.keys(byDomain).length;
  const modelCount = READWISE_MODELS.length;

  let out = `${CATALOG_MARKER} (${modelCount} models, ${domainCount} domains)\n\n`;
  out += 'Every entry has the format: **Model Name** [slug: `verified-slug`] — one-line gloss. The slug is the exact value `getModelBySlug()` must resolve.\n\n';
  for (const d of Object.keys(byDomain).sort()) {
    out += `### ${d}\n`;
    for (const m of byDomain[d]) {
      out += `- **${m.name}** [slug: \`${m.slug}\`] — ${m.gloss}\n`;
    }
    out += '\n';
  }
  return out;
}

function main() {
  const existing = fs.readFileSync(LIBRARY_PATH, 'utf8');
  const catIdx = existing.indexOf(CATALOG_MARKER);
  const footIdx = existing.indexOf(FOOTER_MARKER);
  if (catIdx === -1 || footIdx === -1 || footIdx < catIdx) {
    console.error('Could not find catalog markers in Model_Library.md. Expected:\n  "## The Catalog" ... "## Regeneration Procedure"');
    process.exit(2);
  }
  const before = existing.slice(0, catIdx);
  const after = existing.slice(footIdx);
  const catalog = buildCatalog();
  const next = before + catalog + '---\n\n' + after;
  fs.writeFileSync(LIBRARY_PATH, next);
  console.log(`Rewrote ${LIBRARY_PATH} — ${READWISE_MODELS.length} models across ${new Set(READWISE_MODELS.map(m => m.domain)).size} domains.`);
}

main();
