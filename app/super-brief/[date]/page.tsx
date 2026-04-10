import { getBriefLightByDate } from '@/lib/brief-light-parser';
import SuperBriefViewer from '@/components/super-brief/SuperBriefViewer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Super Brief — ${date} | Mental Models Observatory`,
    description: `Compressed daily intelligence brief for ${date}.`,
  };
}

export default async function SuperBriefDatePage({ params }: PageProps) {
  const { date } = await params;
  const brief = getBriefLightByDate(date);

  if (!brief) {
    notFound();
  }

  return <SuperBriefViewer brief={brief} />;
}
