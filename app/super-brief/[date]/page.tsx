import { getBriefLightByDate } from '@/lib/brief-light-parser';
import SuperBriefViewer from '@/components/super-brief/SuperBriefViewer';
import { ArticleJsonLd } from '@/components/seo/JsonLd';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const brief = getBriefLightByDate(date);
  const title = brief?.dailyTitle
    ? `${brief.dailyTitle} — Cosmic Trex Super Brief`
    : `Super Brief — ${date}`;
  const description = brief?.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Compressed daily intelligence brief for ${date}. The essential market signals in 3 minutes.`;

  return {
    title,
    description,
    alternates: { canonical: `/super-brief/${date}` },
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: date,
      url: `/super-brief/${date}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function SuperBriefDatePage({ params }: PageProps) {
  const { date } = await params;
  const brief = getBriefLightByDate(date);

  if (!brief) {
    notFound();
  }

  const title = brief.dailyTitle || `Super Brief — ${date}`;
  const description = brief.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Compressed daily intelligence brief for ${date}.`;

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={date}
        url={`/super-brief/${date}`}
      />
      <SuperBriefViewer brief={brief} />
    </>
  );
}
