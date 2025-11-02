import { ArrowRight, BookOpen, Brain, CheckCircle, Compass, HelpCircle, Lightbulb, Target } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Header */}
      <div className="bg-gradient-to-r from-foundational-600 to-foundational-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold">How to Use This</h1>
          </div>
          <p className="text-xl text-foundational-100">
            Your complete guide to mastering mental models and building better thinking habits.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* What This Is */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">What This Is</h2>
          <p className="text-lg text-neutral-600 leading-relaxed">
            A curated library of <strong>119 powerful mental models</strong> from the world's greatest thinkers—each one backed by <strong>curated insights from 1,000+ books</strong>. Think of it as your cognitive toolkit for better thinking, decision-making, and understanding reality.
            </p>
        </section>

        {/* Why You Should Care */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">Why You Should Care</h2>
          <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-4">
            <p className="text-lg text-neutral-700 leading-relaxed">
              Mental models are how you think about the world. Most people use 2-3 models unconsciously. The world's best thinkers use dozens deliberately. This gives them a massive advantage in seeing patterns others miss, making better decisions, and solving complex problems.
            </p>
          </div>
          <p className="text-neutral-600 italic">
            <strong>Example:</strong> Warren Buffett credits his success to having "a latticework of mental models" rather than any single insight.
          </p>
        </section>

        {/* How to Use This */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-800 mb-6">How to Use This (3 Ways)</h2>
          
          <div className="space-y-6">
            {/* Guided Paths */}
            <div className="bg-white border-2 border-foundational-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-foundational-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Compass className="w-5 h-5 text-foundational-600" />
              </div>
              <div>
                  <h3 className="text-xl font-bold text-neutral-800 mb-2">1. 🎯 Start with Guided Paths (Recommended)</h3>
                  <p className="text-neutral-600 mb-3"><strong>Best for:</strong> First-time visitors or specific goals</p>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-600 mb-4">
                    <li>Click <strong>"Start Your Journey"</strong> on the homepage</li>
                    <li>Tell us what you're working on (better decisions, strategic thinking, creativity, etc.)</li>
                    <li>Get a personalized learning path of 3-7 models that build on each other</li>
                    <li>Each model takes 5-10 minutes to absorb</li>
                  </ol>
                  <div className="bg-foundational-50 border border-foundational-200 rounded-lg p-3">
                    <p className="text-sm text-foundational-800">
                      <strong>Why this works:</strong> You learn models in sequence, each one building on the last.
                </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Browse by Domain */}
            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <BookOpen className="w-5 h-5 text-neutral-600" />
              </div>
              <div>
                  <h3 className="text-xl font-bold text-neutral-800 mb-2">2. 📚 Browse by Domain</h3>
                  <p className="text-neutral-600 mb-3"><strong>Best for:</strong> Exploring a specific area</p>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-600 mb-4">
                    <li>Click <strong>"Browse Domains"</strong> in the navigation</li>
                    <li>Choose a domain that interests you (Psychology, Business Strategy, Philosophy, etc.)</li>
                    <li>Explore models within that domain</li>
                    <li>Each model includes core principles, applications, and curated insights</li>
                  </ol>
                  <p className="text-sm text-neutral-600">
                    <strong>40 domains</strong> organized from foundational (Philosophy, Logic) to specialized (Neuroscience, Evolution).
                </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="bg-white border-2 border-neutral-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Target className="w-5 h-5 text-neutral-600" />
              </div>
              <div>
                  <h3 className="text-xl font-bold text-neutral-800 mb-2">3. 🔍 Search for What You Need</h3>
                  <p className="text-neutral-600 mb-3"><strong>Best for:</strong> Specific problems or interests</p>
                  <ol className="list-decimal list-inside space-y-2 text-neutral-600">
                    <li>Use the search bar to find models related to your challenge</li>
                    <li>Filter by difficulty (beginner/intermediate/advanced)</li>
                    <li>Jump directly to the models that matter most right now</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What You'll Find */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">What You'll Find on Each Model Page</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-neutral-800">Clear Explanation</h3>
              </div>
              <p className="text-sm text-neutral-600">What the model is and why it matters</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-neutral-800">Core Principles</h3>
              </div>
              <p className="text-sm text-neutral-600">The key ideas, expanded and clarified</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-neutral-800">Practical Applications</h3>
              </div>
              <p className="text-sm text-neutral-600">How to actually use this in your life/work</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-neutral-800">Curated Insights</h3>
              </div>
              <p className="text-sm text-neutral-600">Best quotes from books, quality-rated by curators</p>
            </div>
          </div>
        </section>

        {/* Pro Tips */}
        <section>
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">Pro Tips</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-accent-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-neutral-800 mb-1">Start Small</h3>
                <p className="text-neutral-600">Focus on 1-2 models per week. Let them sink in through practice.</p>
                  </div>
                </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-accent-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-neutral-800 mb-1">Track Your Progress</h3>
                <p className="text-neutral-600">Models you've viewed are marked with green checkmarks. Come back regularly to reinforce.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-accent-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-neutral-800 mb-1">Go Deep, Not Just Wide</h3>
                <p className="text-neutral-600">Read the curated insights—that's where real understanding comes from. One deeply understood model beats ten surface-level ones.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-accent-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-neutral-800 mb-1">Connect the Dots</h3>
                <p className="text-neutral-600">Look for "Related Models" at the bottom of each page. Mental models are most powerful when combined.</p>
              </div>
            </div>
          </div>
        </section>

        {/* The Long Game */}
        <section className="bg-gradient-to-br from-foundational-50 to-accent-50 rounded-2xl p-8 border border-foundational-200">
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">The Long Game</h2>
          <p className="text-lg text-neutral-700 leading-relaxed mb-4">
            This isn't a sprint. The world's best thinkers spent decades building their mental model repertoire. You're building:
          </p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-neutral-700"><strong>Better decision-making</strong> through probabilistic thinking and second-order effects</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-neutral-700"><strong>Clearer communication</strong> through understanding how ideas spread and stick</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-neutral-700"><strong>Deeper wisdom</strong> through connecting insights across disciplines</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-neutral-700"><strong>Compound returns</strong> as each model reinforces and amplifies the others</span>
            </li>
          </ul>
          <div className="bg-white/80 rounded-lg p-4 border border-foundational-300">
            <p className="text-neutral-800 font-semibold">
              Commit to one model per week for a year = 52 models = fundamentally different way of thinking.
            </p>
          </div>
        </section>

        {/* Quote */}
        <section className="text-center py-8">
          <blockquote className="text-2xl italic text-neutral-600 mb-4">
            "All models are wrong, but some are useful."
          </blockquote>
          <p className="text-neutral-500">- George Box</p>
          <p className="text-neutral-700 mt-4 max-w-2xl mx-auto">
            Mental models aren't absolute truth—they're lenses for seeing reality more clearly. The goal isn't to collect them like trophies. It's to internalize them so deeply they become second nature.
          </p>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <h2 className="text-3xl font-bold text-neutral-800 mb-4">Welcome to clearer thinking. Let's begin.</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
              href="/"
                className="btn btn-primary btn-lg group"
              >
              <Brain className="mr-2 h-5 w-5" />
              Start Your Journey
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/models"
                className="btn btn-outline btn-lg"
              >
                Browse All Models
              </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
