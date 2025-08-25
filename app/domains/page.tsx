import Link from 'next/link';
import { getAllDomains } from '@/lib/data';
import { ArrowRight, Search } from 'lucide-react';

export default function DomainsPage() {
  const domains = getAllDomains();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Knowledge Domains
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Explore mental models organized by domain of knowledge. Each domain contains 
            carefully curated frameworks and thinking tools.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search domains..."
              className="input pl-10 w-full"
            />
          </div>
        </div>

        {/* Domains Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/domains/${domain.slug}`}
              className="group card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="card-header">
                <div className="flex items-center space-x-3">
                  <div 
                    className="h-12 w-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: domain.color }}
                  >
                    <span className="text-white font-bold text-lg">
                      {domain.icon === 'puzzle' && '🧩'}
                      {domain.icon === 'target' && '🎯'}
                      {domain.icon === 'network' && '🌐'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="card-title text-xl group-hover:text-blue-600 transition-colors">
                      {domain.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {domain.models.length} models
                    </p>
                  </div>
                </div>
              </div>
              <div className="card-content">
                <p className="text-gray-600 mb-4">
                  {domain.description}
                </p>
                <div className="flex items-center text-blue-600 group-hover:text-blue-700 transition-colors">
                  <span className="text-sm font-medium">Explore models</span>
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
              <div className="text-2xl font-bold text-gray-900">{domains.length}</div>
              <div className="text-sm text-gray-600">Domains</div>
            </div>
            <div className="w-px h-8 bg-gray-200"></div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {domains.reduce((acc, domain) => acc + domain.models.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Mental Models</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
