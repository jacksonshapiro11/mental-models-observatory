import { getAllBriefDates, getBriefByDate } from '@/lib/daily-update-parser';

export interface LifeNote {
  text: string;
  date: string;
  dateSlug: string;
}

export function getRecentLifeNotes(count = 3): LifeNote[] {
  const dates = getAllBriefDates().slice(0, count + 2); // grab extra in case some are empty
  return dates
    .map(dateSlug => {
      const brief = getBriefByDate(dateSlug);
      if (!brief?.epigraph) return null;
      return {
        text: brief.epigraph,
        date: brief.displayDate,
        dateSlug: brief.date,
      };
    })
    .filter((note): note is LifeNote => note !== null)
    .slice(0, count);
}
