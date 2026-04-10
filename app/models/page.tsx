'use client';

import { getAllDomains, getAllModels } from '@/lib/data';
import { ProgressTracker } from '@/lib/progress-tracker';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type DomainTreatment = 'A' | 'B' | 'C' | 'D';

// Treatment styling
const TREATMENTS: Record<DomainTreatment, { bg: string; border: string; card: string; text: string; cardBorder: string }> = {
  A: {
    bg: 'bg-white',
    border: 'border-ct-pink',
    card: 'bg-[#FAFAF6]',
    text: 'text-text-primary',
    cardBorder: 'border-[#e8e8e4]',
  },
  B: {
    bg: 'bg-ct-dark',
    border: 'border-ct-yellow',
    card: 'bg-[#141416]',
    text: 'text-white',
    cardBorder: 'border-[#222]',
  },
  C: {
    bg: 'bg-ct-yellow',
    border: 'border-ct-dark',
    card: 'bg-white',
    text: 'text-ct-dark',
    cardBorder: 'border-2 border-ct-dark',
  },
  D: {
    bg: 'bg-[#E8FFF5]',
    border: 'border-[#00885a]',
    card: 'bg-white',
    text: 'text-text-primary',
    cardBorder: 'border-[0.5px] border-[#e8e8e4]',
  },
};

function getTreatmentForIndex(index: number): DomainTreatment {
  const treatments: DomainTreatment[] = ['A', 'B', 'C', 'D'];
  return treatments[index % 4] as DomainTreatment;
}

function ModelCard({ model, treatment, domainIndex }: { model: any; treatment: DomainTreatment; domainIndex: number }) {
  const treatment_style = TREATMENTS[treatment as DomainTreatment];
  const accentColor = ['#FF2E63', '#FFE600', '#00885a', '#7C5CFC'][domainIndex % 4];

  const cardClass = treatment === 'B' ? 'text-[#eee]' : 'text-text-primary';
  const descClass = treatment === 'B' ? 'text-[#888]' : 'text-text-secondary';
  const labelClass = treatment === 'B' ? 'text-[#555]' : 'text-text-muted';

  return (
    <Link
      href={`/models/${model.slug}`}
      className={`group block ${treatment_style.card} ${treatment_style.cardBorder} border rounded-sm overflow-hidden hover:shadow-lg transition-all duration-300`}
    >
      {/* Top accent bar */}
      <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }}></div>

      {/* Content */}
      <div className="p-3">
        <div className={`text-[9px] uppercase tracking-wider font-medium mb-1.5 ${labelClass}`}>
          {model.domain}
        </div>
        <h3 className={`text-[13px] font-medium mb-2 group-hover:opacity-75 transition-opacity ${cardClass}`}>
          {model.name}
        </h3>
        <p className={`text-[11px] leading-[1.4] mb-2.5 line-clamp-3 ${descClass}`}>
          {model.description}
        </p>

        {/* Tags */}
        <div className="flex gap-1 flex-wrap mb-2">
          {model.tags?.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
                treatment === 'B'
                  ? 'bg-[#1a1a1d] text-[#888] border border-[#222]'
                  : treatment === 'C'
                  ? 'bg-ct-yellow text-ct-dark border border-ct-dark'
                  : 'bg-[#e8e8e4] text-[#666]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className={`text-[9px] font-mono uppercase ${treatment === 'B' ? 'text-[#555]' : 'text-text-muted'}`}>
          {model.difficulty || 'intermediate'}
        </div>
      </div>
    </Link>
  );
}

export default function ModelsPage() {
  const models = getAllModels();
  const domains = getAllDomains();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [viewedModelSlugs, setViewedModelSlugs] = useState<string[]>([]);

  // Load viewed models from progress tracker
  useEffect(() => {
    const progress = ProgressTracker.getProgress();
    setViewedModelSlugs(progress.modelsViewed.map(m => m.slug));
  }, []);

  // Group models by domain
  const modelsByDomain = useMemo(() => {
    const grouped: Record<string, typeof models> = {};
    const sortedDomains = domains
      .filter(d => models.some(m => m.domainSlug === d.slug))
      .sort((a, b) => a.name.localeCompare(b.name));

    sortedDomains.forEach(domain => {
      const domainModels = models.filter(m => m.domainSlug === domain.slug);
      if (selectedDomain === '' || domain.slug === selectedDomain) {
        grouped[domain.slug] = domainModels.filter(
          m =>
            searchQuery === '' ||
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
    });
    return grouped;
  }, [models, domains, searchQuery, selectedDomain]);

  const allFilteredModels = Object.values(modelsByDomain).flat();
  const domainArray = Object.keys(modelsByDomain).map(slug => domains.find(d => d.slug === slug)!);

  return (
    <div className="min-h-screen">
      {/* 1. DARK HERO */}
      <section className="bg-ct-dark px-4 py-6 border-b-[3px] border-ct-yellow">
        <div className="max-w-4xl mx-auto">
          <div className="font-mono text-[10px] text-ct-yellow uppercase tracking-wider mb-2">The observatory</div>
          <h1 className="text-[22px] font-medium text-white mb-1.5">Mental models observatory</h1>
          <p className="text-[13px] text-[#666] leading-[1.5] mb-4">
            Thinking frameworks across all domains of knowledge. Referenced daily in the brief — explored deeper here.
          </p>
          <div className="flex gap-4 font-mono text-[12px]">
            <span>
              <span className="text-ct-yellow font-medium">{models.length}</span>{' '}
              <span className="text-[#555]">models</span>
            </span>
            <span>
              <span className="text-ct-yellow font-medium">{domains.length}</span>{' '}
              <span className="text-[#555]">domains</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. YELLOW SEARCH BAR */}
      <section className="bg-ct-yellow px-4 py-3 border-b-[3px] border-ct-dark">
        <div className="max-w-4xl mx-auto flex items-center gap-2 bg-white border-2 border-ct-dark px-3 py-2.5 rounded-sm">
          <Search className="w-4 h-4 text-[#999]" />
          <input
            type="text"
            placeholder="Search models, domains, or applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-[14px] text-ct-dark bg-transparent outline-none placeholder-[#888]"
          />
          <span className="font-mono text-[11px] text-[#888]">{allFilteredModels.length}</span>
        </div>
      </section>

      {/* 3. WHITE FILTER CHIPS */}
      <section className="bg-white px-4 py-3 border-b border-[#e8e8e4]">
        <div className="max-w-4xl mx-auto flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          <button
            onClick={() => setSelectedDomain('')}
            className={`px-2.5 py-1 text-[11px] font-medium whitespace-nowrap rounded-sm transition-all ${
              selectedDomain === ''
                ? 'bg-ct-pink text-white'
                : 'bg-white text-[#666] border border-[#ddd]'
            }`}
          >
            All
          </button>
          {domainArray.map((domain, idx) => (
            <button
              key={domain.slug}
              onClick={() => setSelectedDomain(domain.slug)}
              className={`px-2.5 py-1 text-[11px] font-medium whitespace-nowrap rounded-sm transition-all ${
                selectedDomain === domain.slug
                  ? 'bg-ct-dark text-ct-yellow'
                  : 'bg-white text-[#666] border border-[#ddd]'
              }`}
            >
              {domain.name}
            </button>
          ))}
        </div>
      </section>

      {/* 4. DOMAIN SECTIONS WITH ALTERNATING TREATMENTS */}
      <div>
        {allFilteredModels.length > 0 ? (
          domainArray.map((domain, domainIndex) => {
            const treatment = getTreatmentForIndex(domainIndex);
            const treatment_style = TREATMENTS[treatment];
            const domainModels = modelsByDomain[domain.slug] || [];

            return (
              <section
                key={domain.slug}
                className={`${treatment_style.bg} px-4 py-4 border-t-[3px] ${treatment_style.border}`}
              >
                <div className="max-w-4xl mx-auto">
                  <div
                    className={`text-[10px] tracking-[0.08em] uppercase font-medium mb-3 ${
                      treatment === 'B' ? 'text-ct-yellow' : 'text-[#999]'
                    }`}
                  >
                    {domain.name}{' '}
                    <span className={`font-mono ${treatment === 'B' ? 'text-[#555]' : 'text-[#666]'}`}>
                      {domainModels.length}
                    </span>
                  </div>

                  {/* 2-column grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {domainModels.map((model, idx) => (
                      <ModelCard
                        key={model.slug}
                        model={model}
                        treatment={treatment}
                        domainIndex={domainIndex}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <section className="bg-white px-4 py-16 text-center">
            <Search className="w-12 h-12 text-[#ccc] mx-auto mb-4" />
            <h3 className="text-base font-medium text-text-primary mb-2">No models found</h3>
            <p className="text-[13px] text-text-secondary mb-6">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => setSelectedDomain('')}
              className="px-4 py-2 bg-ct-dark text-ct-yellow text-sm font-medium rounded-sm hover:opacity-90 transition-opacity"
            >
              Clear filters
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
