/**
 * Thin accessor for the Weekly Light (the weekly super brief).
 *
 * The weekly light shares the EXACT header contract of the daily Brief Light
 * (so it reuses parseBriefLight + SuperBriefViewer) with ONE added section:
 * `## ▸ OUR CALLS` (mapped in brief-light-parser.ts → id `our-calls`).
 *
 * File: content/daily-updates/weekly/{YYYY-Www}-light.md
 * URL slug: the week id (e.g. "2026-W26").
 */

import fs from 'fs';
import path from 'path';
import { parseBriefLight, type BriefLight } from '@/lib/brief-light-parser';

const WEEKLY_CONTENT_DIR = path.join(process.cwd(), 'content/daily-updates/weekly');

export function getWeeklyLightBySlug(slug: string): BriefLight | null {
  const filePath = path.join(WEEKLY_CONTENT_DIR, `${slug}-light.md`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseBriefLight(content, slug);
}

export function hasWeeklyLight(slug: string): boolean {
  return fs.existsSync(path.join(WEEKLY_CONTENT_DIR, `${slug}-light.md`));
}

/** All published weekly-light slugs (week ids), newest first. */
export function getAllWeeklyLightSlugs(): string[] {
  if (!fs.existsSync(WEEKLY_CONTENT_DIR)) return [];
  return fs.readdirSync(WEEKLY_CONTENT_DIR)
    .filter(f => f.endsWith('-light.md'))
    .map(f => f.replace('-light.md', ''))
    .sort()
    .reverse();
}
