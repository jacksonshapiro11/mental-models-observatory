import { getWeeklyBySlug, getAllWeeklySlugs } from '@/lib/daily-update-parser';
import BriefViewer from '@/components/daily-update/BriefViewer';
import { ArticleJsonLd } from '@/components/seo/JsonLd';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllWeeklySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brief = getWeeklyBySlug(slug);
  const title = brief?.dailyTitle
    ? `${brief.dailyTitle} — Cosmic Trex Weekly`
    : `The Weekly — ${slug}`;
  const description = brief?.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Weekly market intelligence brief for ${slug}. Markets, geopolitics, AI, crypto, and macro — the seven-day arc, filtered through mental models.`;

  return {
    title,
    description,
    alternates: { canonical: `/weekly/${slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/weekly/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function WeeklySlugPage({ params }: PageProps) {
  const { slug } = await params;
  const brief = getWeeklyBySlug(slug);

  if (!brief) {
    notFound();
  }

  const title = brief.dailyTitle || `The Weekly — ${slug}`;
  const description = brief.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `Weekly market intelligence brief for ${slug}.`;

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={slug}
        url={`/weekly/${slug}`}
      />
      <BriefViewer brief={brief} />
    </>
  );
}
