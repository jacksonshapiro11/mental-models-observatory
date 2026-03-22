import { NextResponse } from 'next/server';
import { getAllBriefDates, getBriefByDate } from '@/lib/daily-update-parser';

export async function GET() {
  const dates = getAllBriefDates(); // already sorted newest first

  const briefs = dates.map((date) => {
    const brief = getBriefByDate(date);
    if (!brief) return null;
    return {
      date: brief.date,
      displayDate: brief.displayDate,
      epigraph: brief.epigraph,
      lede: brief.lede,
      sectionCount: brief.sections.length,
      sections: brief.sections.map(s => s.label),
    };
  }).filter(Boolean);

  return NextResponse.json(briefs);
}
