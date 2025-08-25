import Link from 'next/link';
import { getAllModels, getAllDomains } from '@/lib/data';
import { ArrowRight, Search, Filter } from 'lucide-react';

export default function ModelsPage() {
  const models = getAllModels();
  const domains = getAllDomains();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Mental Models
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Discover powerful thinking frameworks across all domains of knowledge. 
            Each model includes principles, examples, and practical applications.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search mental models..."
                className="input pl-10 w-full"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <select className="input w-auto">
              <option value="">All Domains</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.slug}>
                  {domain.name}
                </option>
              ))}
            </select>
            <select className="input w-auto">
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        {/* Models Grid */}
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
                      {model.domain}
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
                  {model.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                      +{model.tags.length - 3} more
                    </span>
                  )}
                </div>
                <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors">
                  <span className="text-sm font-medium">Learn more</span>
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-8 bg-white rounded-lg px-8 py-4 shadow-sm">
            <div>
              <div className="text-2xl font-bold text-gray-900">{models.length}</div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{domains.length}</div>
              <div className="text-sm text-gray-600">Domains</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {models.filter(m => m.difficulty === 'beginner').length}
              </div>
              <div className="text-sm text-gray-600">Beginner Friendly</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
