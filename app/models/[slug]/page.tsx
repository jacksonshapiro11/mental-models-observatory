import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getModelBySlug, getRelatedModels } from '@/lib/data';
import { ArrowLeft, ArrowRight, BookOpen, Users, Target, Lightbulb } from 'lucide-react';

interface ModelPageProps {
  params: {
    slug: string;
  };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  const relatedModels = getRelatedModels(slug);

  if (!model) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/models" className="hover:text-gray-900 transition-colors">
              Models
            </Link>
            <span>→</span>
            <Link 
              href={`/domains/${model.domainSlug}`} 
              className="hover:text-gray-900 transition-colors"
            >
              {model.domain}
            </Link>
            <span>→</span>
            <span className="text-gray-900">{model.name}</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              model.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
              model.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {model.difficulty}
            </div>
            <Link 
              href={`/domains/${model.domainSlug}`}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {model.domain}
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-4">
            {model.name}
          </h1>
          <p className="text-xl text-gray-600">
            {model.description}
          </p>
        </div>

        {/* Core Principles */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <Target className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Core Principles</h2>
          </div>
          <div className="space-y-4">
            {model.principles.map((principle, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>
                <p className="text-gray-700">{principle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <Lightbulb className="h-6 w-6 text-yellow-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Examples</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {model.examples.map((example, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{example}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Applications */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <Users className="h-6 w-6 text-green-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {model.applications.map((application, index) => (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">{application}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sources */}
        {model.sources.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center mb-6">
              <BookOpen className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Sources</h2>
            </div>
            <div className="space-y-4">
              {model.sources.map((source) => (
                <div key={source.id} className="card">
                  <div className="card-content">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{source.title}</h3>
                        <p className="text-gray-600 text-sm">by {source.author}</p>
                        <p className="text-gray-500 text-xs mt-1 capitalize">{source.type}</p>
                      </div>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Source
                        </a>
                      )}
                    </div>
                    {source.highlights.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Highlights:</h4>
                        <div className="space-y-2">
                          {source.highlights.map((highlight, index) => (
                            <blockquote key={index} className="border-l-4 border-blue-200 pl-4 italic text-gray-700 text-sm">
                              "{highlight}"
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        <section className="mb-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Topics</h3>
          <div className="flex flex-wrap gap-2">
            {model.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Related Models */}
        {relatedModels.length > 0 && (
          <section className="mb-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Related Models</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedModels.slice(0, 4).map((relatedModel) => (
                <Link
                  key={relatedModel.id}
                  href={`/models/${relatedModel.slug}`}
                  className="group card hover:shadow-md transition-all duration-200"
                >
                  <div className="card-content">
                    <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {relatedModel.name}
                    </h4>
                    <p className="text-gray-600 text-sm mt-1">{relatedModel.domain}</p>
                    <p className="text-gray-600 text-sm mt-2">{relatedModel.description}</p>
                    <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors mt-3">
                      <span className="text-sm font-medium">Learn more</span>
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t border-gray-200">
          <Link
            href={`/domains/${model.domainSlug}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {model.domain}
          </Link>
          <Link
            href="/models"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            All Models
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
