import { getWeeklyLightBySlug, getAllWeeklyLightSlugs } from '@/lib/weekly-light-parser';
import SuperBriefViewer from '@/components/super-brief/SuperBriefViewer';
import { ArticleJsonLd } from '@/components/seo/JsonLd';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllWeeklyLightSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brief = getWeeklyLightBySlug(slug);
  const title = brief?.dailyTitle
    ? `${brief.dailyTitle} — Cosmic Trex Weekly Light`
    : `Weekly Light — ${slug}`;
  const description = brief?.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `The week in about twelve minutes. The story that defined the week, the biggest moves across the world, and our standing calls.`;

  return {
    title,
    description,
    alternates: { canonical: `/weekly-super/${slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/weekly-super/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function WeeklySuperSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const brief = getWeeklyLightBySlug(slug);

  if (!brief) {
    notFound();
  }

  const title = brief.dailyTitle || `Weekly Light — ${slug}`;
  const description = brief.lede
    ? brief.lede.replace(/\*\*/g, '').substring(0, 160)
    : `The week in about twelve minutes.`;

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={description}
        datePublished={slug}
        url={`/weekly-super/${slug}`}
      />
      <SuperBriefViewer brief={brief} fullBriefBasePath="/weekly" selfBasePath="/weekly-super" />
    </>
  );
}
