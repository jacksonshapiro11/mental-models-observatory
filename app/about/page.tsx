import Link from 'next/link';
import { Brain, BookOpen, Users, Target, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
            About Mental Models Observatory
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A comprehensive collection of intellectual frameworks designed to improve 
            decision-making, problem-solving, and understanding across all domains of knowledge.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
          <div className="prose prose-lg text-gray-600">
            <p>
              Mental models are thinking tools that help us understand the world and make better decisions. 
              They represent how something works in the real world and provide a framework for 
              understanding complex concepts.
            </p>
            <p>
              Our mission is to create the most comprehensive, well-sourced, and accessible collection 
              of mental models organized by domain of knowledge. Every model includes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Core principles and fundamental concepts</li>
              <li>Real-world examples and case studies</li>
              <li>Practical applications across different fields</li>
              <li>Complete source attribution and references</li>
              <li>Connections to related models and frameworks</li>
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">What Makes Us Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Brain className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Systematic Organization
                </h3>
                <p className="text-gray-600">
                  Models are organized across 40 distinct domains of knowledge, 
                  making it easy to find relevant frameworks for any field or situation.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <BookOpen className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Complete Source Transparency
                </h3>
                <p className="text-gray-600">
                  Every model includes full attribution to original sources, 
                  integrated with Readwise for comprehensive reference tracking.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Target className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Practical Applications
                </h3>
                <p className="text-gray-600">
                  Each model includes concrete examples and applications, 
                  showing how to use these frameworks in real-world situations.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Community Driven
                </h3>
                <p className="text-gray-600">
                  Built for learners, researchers, and practitioners who want to 
                  improve their thinking and decision-making capabilities.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How to Use */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">How to Use This Site</h2>
          <div className="space-y-6">
            <div className="card">
              <div className="card-content">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Start with Domains</h3>
                </div>
                <p className="text-gray-600">
                  Browse our 40 knowledge domains to find areas that interest you or 
                  relate to your current challenges.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Explore Models</h3>
                </div>
                <p className="text-gray-600">
                  Each mental model page includes principles, examples, applications, 
                  and complete source references for deeper learning.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-content">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Apply and Practice</h3>
                </div>
                <p className="text-gray-600">
                  Use the practical applications and examples to start incorporating 
                  these frameworks into your own thinking and decision-making.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Improve Your Thinking?
            </h2>
            <p className="text-gray-600 mb-6">
              Start exploring our collection of mental models and frameworks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                Browse All Models
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
