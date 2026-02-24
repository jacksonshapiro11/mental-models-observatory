import { getBriefByDate, getAllBriefDates } from '@/lib/daily-update-parser';
import BriefViewer from '@/components/daily-update/BriefViewer';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ date: string }>;
}

export async function generateStaticParams() {
  const dates = getAllBriefDates();
  return dates.map((date) => ({ date }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Daily Update — ${date} | Mental Models Observatory`,
    description: `Daily market intelligence brief for ${date}.`,
  };
}

export default async function DailyUpdateDatePage({ params }: PageProps) {
  const { date } = await params;
  const brief = getBriefByDate(date);

  if (!brief) {
    notFound();
  }

  return <BriefViewer brief={brief} />;
}
