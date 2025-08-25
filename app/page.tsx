import Link from 'next/link';
import { getAllDomains, getAllModels } from '@/lib/data';
import { Brain, BookOpen, Target, Users, ArrowRight, Search, Sparkles } from 'lucide-react';

export default function HomePage() {
  const domains = getAllDomains();
  const models = getAllModels();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 sm:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <div className="flex items-center space-x-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800">
                <Sparkles className="h-4 w-4" />
                <span>40 Domains of Knowledge</span>
              </div>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              Mental Models{' '}
              <span className="gradient-text">Observatory</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
              A comprehensive collection of intellectual frameworks organized across 40 domains of knowledge. 
              Each model includes core principles, real-world examples, and complete source attribution.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/domains"
                className="btn btn-primary btn-lg group"
              >
                Explore Domains
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/models"
                className="btn btn-outline btn-lg"
              >
                Browse Models
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{models.length}</div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{domains.length}</div>
              <div className="text-sm text-gray-600">Knowledge Domains</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">100+</div>
              <div className="text-sm text-gray-600">Source References</div>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">Growing</div>
              <div className="text-sm text-gray-600">Community</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Domains */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Explore Knowledge Domains
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Discover mental models organized by domain of knowledge
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {domains.slice(0, 6).map((domain) => (
              <Link
                key={domain.id}
                href={`/domains/${domain.slug}`}
                className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="card-header">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: domain.color }}
                    >
                      <span className="text-white font-bold text-sm">
                        {domain.icon === 'puzzle' && '🧩'}
                        {domain.icon === 'target' && '🎯'}
                        {domain.icon === 'network' && '🌐'}
                      </span>
                    </div>
                    <div>
                      <h3 className="card-title text-lg group-hover:text-blue-600 transition-colors">
                        {domain.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {domain.models.length} models
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card-content">
                  <p className="text-gray-600 text-sm">
                    {domain.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/domains"
              className="btn btn-outline btn-lg"
            >
              View All Domains
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Models */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Popular Mental Models
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Start with these foundational thinking frameworks
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {models.slice(0, 6).map((model) => (
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
                        {model.domain}
                      </p>
                    </div>
                    <div className={`badge badge-outline text-xs ${
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
                  <div className="flex flex-wrap gap-2">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="badge badge-secondary text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/models"
              className="btn btn-outline btn-lg"
            >
              Browse All Models
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Expand Your Thinking?
          </h2>
          <p className="mt-4 text-xl text-blue-100">
            Join thousands of learners exploring mental models for better decision-making
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/domains"
              className="btn bg-white text-blue-600 hover:bg-gray-100 btn-lg"
            >
              Start Exploring
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="btn btn-outline border-white text-white hover:bg-white hover:text-blue-600 btn-lg"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
