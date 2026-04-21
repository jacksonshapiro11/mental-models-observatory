import { getBriefByDate, getAllBriefDates } from '@/lib/daily-update-parser';
import BriefViewer from '@/components/daily-update/BriefViewer';
import { ArticleJsonLd } from '@/components/seo/JsonLd';
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
  const brief = getBriefByDate(date);
  const title = brief?.dailyTitle
    ? `${brief.dailyTitle} — Cosmic Trex Daily Brief`
    : `Daily Brief — ${date}`;
  const description = brief?.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Daily market intelligence brief for ${date}. Markets, geopolitics, AI, crypto, and macro — filtered through mental models.`;

  return {
    title,
    description,
    alternates: { canonical: `/daily-update/${date}` },
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: date,
      url: `/daily-update/${date}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function DailyUpdateDatePage({ params }: PageProps) {
  const { date } = await params;
  const brief = getBriefByDate(date);

  if (!brief) {
    notFound();
  }

  const title = brief.dailyTitle || `Daily Brief — ${date}`;
  const description = brief.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Daily market intelligence brief for ${date}.`;

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={date}
        url={`/daily-update/${date}`}
      />
      <BriefViewer brief={brief} />
    </>
  );
}
