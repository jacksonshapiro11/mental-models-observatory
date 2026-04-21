import { getAllModels, getModelBySlug } from '@/lib/data';
import ReadwiseHighlights from '@/components/content/ReadwiseHighlights';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface ModelPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  const models = getAllModels();
  return models.map(m => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { slug } = await params;
  const model = getAllModels().find(m => m.slug === slug);
  if (!model) return { title: 'Model Not Found' };

  const title = `${model.name} — ${model.domain}`;
  const description = model.description
    ? model.description.substring(0, 160)
    : `${model.name}: a mental model from ${model.domain}. Part of the Cosmic Trex Observatory.`;

  return {
    title,
    description,
    alternates: { canonical: `/models/${slug}` },
    openGraph: {
      title: `${model.name} — Cosmic Trex Observatory`,
      description,
      url: `/models/${slug}`,
    },
  };
}

function getRelatedModels(currentSlug: string, currentDomain: string, currentTags: string[], allModels: any[]) {
  return allModels
    .filter(m => m.slug !== currentSlug)
    .map(m => ({
      ...m,
      relevance:
        (m.domain === currentDomain ? 3 : 0) +
        (m.tags || []).filter((t: string) => currentTags.includes(t)).length * 2,
      sharedTags: (m.tags || []).filter((t: string) => currentTags.includes(t)),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3);
}

export default async function ModelDetailPage({ params }: ModelPageProps) {
  const { slug } = await params;
  const allModels = getAllModels();
  const model = allModels.find(m => m.slug === slug);

  if (!model) {
    notFound();
  }

  const relatedModels = getRelatedModels(slug, model.domain, model.tags || [], allModels);
  const modelIndex = allModels.indexOf(model) + 1;

  return (
    <div className="min-h-screen">
      {/* 1. DARK HERO */}
      <section className="bg-ct-dark px-4 py-5 border-b-[3px] border-ct-pink">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/models"
            className="font-mono text-[10px] text-[#555] flex items-center gap-1 mb-4 no-underline hover:text-[#777]"
          >
            <span className="text-ct-yellow">←</span> Back to observatory
          </Link>
          <div className="text-[10px] tracking-[0.08em] uppercase text-ct-pink font-medium mb-2">
            {model.domain}
          </div>
          <h1 className="font-serif text-[22px] font-medium text-white leading-[1.25] mb-3">
            {model.name}
          </h1>
          <div className="flex gap-3 font-mono text-[10px]">
            <span className="text-[#555]">
              Level: <span className="text-[#888]">{model.difficulty || 'intermediate'}</span>
            </span>
            <span className="text-[#555]">
              Model <span className="text-[#888]">#{modelIndex}</span>
            </span>
          </div>
          {model.tags?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {model.tags.map((t: string) => (
                <span
                  key={t}
                  className="text-[9px] font-mono px-2 py-0.5 bg-[#1a1a1d] text-[#888] border border-[#222] rounded-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. WHITE DESCRIPTION */}
      <section className="bg-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] tracking-[0.08em] uppercase text-[#999] mb-2.5">Description</div>
          <p className="text-[14px] text-[#333] leading-[1.7]">{model.description}</p>
        </div>
      </section>

      {/* 3. LIGHT SURFACE APPLICATIONS */}
      {model.applications?.length > 0 && (
        <section className="bg-[#F8F8F4] px-4 py-4 border-t border-[#e8e8e4]">
          <div className="max-w-2xl mx-auto">
            <div className="text-[10px] tracking-[0.08em] uppercase text-[#999] mb-2.5">
              Applications
            </div>
            {model.applications.map((app: string, i: number) => (
              <div
                key={i}
                className="bg-white border-l-2 border-ct-yellow px-3 py-2.5 mb-1.5 text-[13px] text-[#444] leading-[1.5] italic font-serif"
              >
                {app}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. DARK BACKLINKS */}
      <section className="bg-ct-dark px-4 py-4 border-b-[3px] border-ct-yellow">
        <div className="max-w-2xl mx-auto">
          <div className="font-mono text-[10px] text-ct-yellow uppercase tracking-wider mb-3">
            Referenced in the brief
          </div>
          <p className="text-[11px] text-[#555] italic">
            Backlinks to brief references will populate as this model is used.
          </p>
        </div>
      </section>

      {/* 5. WHITE SOURCE MATERIAL — Readwise Highlights */}
      <section className="bg-white px-4 py-4 border-b border-[#e8e8e4]">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] tracking-[0.08em] uppercase text-[#999] mb-2.5">
            Source material
          </div>
          <ReadwiseHighlights modelSlug={slug} />
        </div>
      </section>

      {/* 6. YELLOW RELATED MODELS */}
      <section className="bg-ct-yellow px-4 py-4 border-b-[3px] border-ct-dark">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] tracking-[0.08em] uppercase text-ct-dark font-medium mb-3">
            Related models
          </div>
          {relatedModels.map((rm: any) => (
            <Link
              key={rm.slug}
              href={`/models/${rm.slug}`}
              className="block bg-white border-2 border-ct-dark p-3 mb-1.5 no-underline hover:shadow-md transition-shadow"
            >
              <div className="text-[9px] uppercase tracking-wider text-[#888] mb-0.5">{rm.domain}</div>
              <div className="text-[13px] font-medium text-ct-dark mb-0.5">{rm.name}</div>
              <div className="text-[11px] text-[#555] leading-[1.4] line-clamp-2">
                {rm.description}
              </div>
              {rm.sharedTags?.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {rm.sharedTags.map((t: string) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-1.5 py-0.5 bg-ct-yellow border border-ct-dark text-ct-dark rounded-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* 7. DARK EXPLORE GRID */}
      <section className="bg-ct-dark px-4 py-4">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
          <Link
            href={`/models?domain=${encodeURIComponent(model.domain)}`}
            className="py-2.5 border border-[#222] rounded-sm text-center font-mono text-[11px] text-ct-yellow no-underline hover:bg-[#1a1a1d] transition-colors"
          >
            All {model.domain} →
          </Link>
          <Link
            href="/daily-update"
            className="py-2.5 border border-[#222] rounded-sm text-center font-mono text-[11px] text-ct-pink no-underline hover:bg-[#1a1a1d] transition-colors"
          >
            Today's brief →
          </Link>
          <Link
            href="/models"
            className="py-2.5 border border-[#222] rounded-sm text-center font-mono text-[11px] text-ct-green-data no-underline hover:bg-[#1a1a1d] transition-colors"
          >
            All {allModels.length} models →
          </Link>
          <Link
            href={`/models/${allModels[Math.floor(Math.random() * allModels.length)]?.slug || 'pareto-principle'}`}
            className="py-2.5 border border-[#222] rounded-sm text-center font-mono text-[11px] text-[#ddd] no-underline hover:bg-[#1a1a1d] transition-colors"
          >
            Random model →
          </Link>
        </div>
      </section>
    </div>
  );
}
