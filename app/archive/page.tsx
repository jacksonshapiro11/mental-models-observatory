import { getAllBriefDates, getBriefByDate, getAllWeeklySlugs, getWeeklyBySlug } from '@/lib/daily-update-parser';
import { getAllWeeklyLightSlugs, getWeeklyLightBySlug } from '@/lib/weekly-light-parser';
import { getAllBriefLightDates, getBriefLightByDate } from '@/lib/brief-light-parser';
import ArchiveClient from '@/components/archive/ArchiveClient';
import type { ArchiveBrief } from '@/components/archive/ArchiveClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Brief Archive',
  description: 'Every published edition of the Cosmic Trex daily intelligence brief — full briefs and super briefs. Markets, meditations, and mental models, published daily since February 2026.',
  alternates: { canonical: '/archive' },
  openGraph: {
    title: 'Daily Brief Archive — Cosmic Trex',
    description: 'Every published edition of the Cosmic Trex daily intelligence brief.',
    url: '/archive',
  },
};

export default function ArchivePage() {
  const briefs: ArchiveBrief[] = getAllBriefDates()
    .map((date) => {
      const brief = getBriefByDate(date);
      if (!brief) return null;
      return {
        date: brief.date,
        displayDate: brief.displayDate,
        dailyTitle: brief.dailyTitle || '',
        epigraph: brief.epigraph,
        lede: brief.lede,
        sectionCount: brief.sections.length,
        sections: brief.sections.map((s) => s.label),
      };
    })
    .filter((b): b is ArchiveBrief => b !== null);

  const superBriefs: ArchiveBrief[] = getAllBriefLightDates()
    .map((date) => {
      const brief = getBriefLightByDate(date);
      if (!brief) return null;
      return {
        date: brief.date,
        displayDate: brief.displayDate,
        dailyTitle: brief.dailyTitle || '',
        epigraph: brief.epigraph,
        lede: brief.lede,
        sectionCount: brief.sections.length,
        sections: brief.sections.map((s) => s.label),
      };
    })
    .filter((b): b is ArchiveBrief => b !== null);

  const weeklyBriefs: ArchiveBrief[] = getAllWeeklySlugs()
    .map((slug) => {
      const brief = getWeeklyBySlug(slug);
      if (!brief) return null;
      return {
        date: slug,
        displayDate: brief.displayDate,
        dailyTitle: brief.dailyTitle || '',
        epigraph: brief.epigraph || '',
        lede: brief.lede || '',
        sectionCount: brief.sections.length,
        sections: brief.sections.map((s) => s.label),
      };
    })
    .filter((b): b is ArchiveBrief => b !== null);

  const weeklyLightBriefs: ArchiveBrief[] = getAllWeeklyLightSlugs()
    .map((slug) => {
      const brief = getWeeklyLightBySlug(slug);
      if (!brief) return null;
      return {
        date: slug,
        displayDate: brief.displayDate,
        dailyTitle: brief.dailyTitle || '',
        epigraph: brief.epigraph || '',
        lede: (brief as { lede?: string }).lede || '',
        sectionCount: brief.sections.length,
        sections: brief.sections.map((s) => s.label),
      };
    })
    .filter((b): b is ArchiveBrief => b !== null);

  return (
    <div className="min-h-screen bg-surface-reading">
      {/* Dark Header — server-rendered, always visible to crawlers */}
      <div className="bg-ct-dark">
        <div className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-mono text-2xl font-bold text-ct-yellow mb-2">
              THE ARCHIVE
            </h1>
            <p className="text-text-on-dark text-sm mb-6">
              Every published edition of Markets, Meditations &amp; Mental Models
            </p>
            <p className="text-text-on-dark-muted text-xs font-mono">
              {briefs.length}+ full briefs · {superBriefs.length}+ super briefs · {weeklyBriefs.length}+ weeklies | Published daily since February 2026
            </p>
          </div>
        </div>
      </div>

      {/* Main Content — interactive filtering + brief/super-brief toggle is client-side */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <ArchiveClient briefs={briefs} superBriefs={superBriefs} weeklyBriefs={weeklyBriefs} weeklyLightBriefs={weeklyLightBriefs} />
        </div>
      </div>
    </div>
  );
}
