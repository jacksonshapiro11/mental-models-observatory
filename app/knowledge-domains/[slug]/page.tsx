import { getDomainBySlug, getModelsByDomain } from '@/lib/data';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface DomainPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function DomainPage({ params }: DomainPageProps) {
  const { slug } = await params;
  const domain = getDomainBySlug(slug);
  const models = getModelsByDomain(slug);

  if (!domain) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/knowledge-domains"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Domains
          </Link>
        </div>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center space-x-4 mb-6">
            <div 
              className={`h-16 w-16 rounded-xl ${
                domain.tier === 1 ? 'bg-blue-900' :
                domain.tier === 2 ? 'bg-orange-600' :
                domain.tier === 3 ? 'bg-green-800' :
                domain.tier === 4 ? 'bg-purple-400' :
                'bg-gray-500'
              }`}
            >
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
                {domain.name}
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {models.length} mental models
              </p>
            </div>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl">
            {domain.description}
          </p>
        </div>

        {/* Models Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Mental Models</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="card-header">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="card-title text-lg group-hover:text-blue-600 transition-colors">
                        {model.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {model.difficulty} level
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      model.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      model.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {model.difficulty}
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  <p className="text-gray-600 text-sm mb-4">
                    {model.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors">
                    <BookOpen className="mr-1 h-4 w-4" />
                    <span className="text-sm font-medium">Learn more</span>
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Domain Info */}
        <div className="bg-gray-50 rounded-lg p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About This Domain</h3>
          <p className="text-gray-600 mb-6">
            {domain.description} This collection of mental models provides frameworks 
            for understanding and working within this domain effectively.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{models.length}</div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {models.filter(m => m.difficulty === 'beginner').length}
              </div>
              <div className="text-sm text-gray-600">Beginner Friendly</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {new Set(models.flatMap(m => m.tags)).size}
              </div>
              <div className="text-sm text-gray-600">Related Topics</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
