/**
 * Dynamic sitemap for Cosmic Trex
 *
 * Auto-includes every daily brief, super brief, mental model, blog post,
 * and core page. Submitted to Google Search Console via robots metadata.
 *
 * Next.js convention: app/sitemap.ts exports a default function returning
 * MetadataRoute.Sitemap — Next auto-serves it at /sitemap.xml.
 */

import { MetadataRoute } from 'next';
import { getAllBriefDates } from '@/lib/daily-update-parser';
import { getAllModels } from '@/lib/data';
import fs from 'fs';
import path from 'path';

function getAllBriefLightDates(): string[] {
  const dir = path.join(process.cwd(), 'content/daily-updates');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('-light.md'))
    .map(f => f.replace('-light.md', ''))
    .sort()
    .reverse();
}

function getAllBlogSlugs(): string[] {
  const dir = path.join(process.cwd(), 'blog/posts');
  if (!fs.existsSync(dir)) return [];
  const slugs: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const match = content.match(/slug:\s*(.+)/);
    if (match?.[1]) slugs.push(match[1].trim());
  }
  return slugs;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cosmictrex.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Core pages
  const corePages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/daily-update`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/super-brief`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/archive`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/models`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/subscribe`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ];

  // Daily briefs
  const briefDates = getAllBriefDates();
  const briefPages: MetadataRoute.Sitemap = briefDates.map((date) => ({
    url: `${SITE_URL}/daily-update/${date}`,
    lastModified: new Date(date),
    changeFrequency: 'never' as const,
    priority: 0.8,
  }));

  // Super briefs (light)
  const lightDates = getAllBriefLightDates();
  const lightPages: MetadataRoute.Sitemap = lightDates.map((date) => ({
    url: `${SITE_URL}/super-brief/${date}`,
    lastModified: new Date(date),
    changeFrequency: 'never' as const,
    priority: 0.6,
  }));

  // Mental models
  const models = getAllModels();
  const modelPages: MetadataRoute.Sitemap = models.map((model) => ({
    url: `${SITE_URL}/models/${model.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Blog posts
  const blogSlugs = getAllBlogSlugs();
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...corePages, ...briefPages, ...lightPages, ...modelPages, ...blogPages];
}
