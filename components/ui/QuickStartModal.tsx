'use client';

import { HelpCircle, X } from 'lucide-react';
import { useEffect } from 'react';

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickStartModal({ isOpen, onClose }: QuickStartModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foundational-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-foundational-600" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-800">Quick Start Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-2 hover:bg-neutral-100 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* What Is This */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">What Is This?</h3>
            <p className="text-neutral-600">
              119 powerful mental models with curated insights from 1,000+ books. Your cognitive toolkit for better thinking.
            </p>
          </div>

          {/* Why Care */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">Why Care?</h3>
            <p className="text-neutral-600">
              Mental models = how you think. Most people use 2-3. Elite thinkers use dozens. This is your shortcut.
            </p>
          </div>

          {/* How to Start */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-3">How to Start (Pick One)</h3>
            
            <div className="space-y-4">
              {/* Guided Paths */}
              <div className="bg-foundational-50 border border-foundational-200 rounded-lg p-4">
                <h4 className="font-semibold text-foundational-800 mb-2">🚀 Fastest Way (Guided Paths)</h4>
                <ol className="text-sm text-neutral-600 space-y-1 list-decimal list-inside">
                  <li>Homepage → "Start Your Journey"</li>
                  <li>Answer 3 quick questions</li>
                  <li>Get personalized path → Start learning</li>
                  <li>5-10 minutes per model</li>
                </ol>
              </div>

              {/* Browse Mode */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="font-semibold text-neutral-800 mb-2">📚 Browse Mode</h4>
                <ol className="text-sm text-neutral-600 space-y-1 list-decimal list-inside">
                  <li>"Browse Domains" → Pick a topic</li>
                  <li>Explore models</li>
                  <li>Learn at your own pace</li>
                </ol>
              </div>

              {/* Direct Search */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h4 className="font-semibold text-neutral-800 mb-2">🔍 Direct Search</h4>
                <ol className="text-sm text-neutral-600 space-y-1 list-decimal list-inside">
                  <li>Search bar → Type your challenge</li>
                  <li>Jump to relevant models</li>
                  <li>Filter by difficulty</li>
                </ol>
              </div>
            </div>
          </div>

          {/* What's on Each Page */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">What's on Each Page?</h3>
            <ul className="text-neutral-600 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Explanation</strong> - What it is</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Principles</strong> - The core ideas</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Applications</strong> - How to use it</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Insights</strong> - Best quotes from books (curated & rated)</span>
              </li>
            </ul>
          </div>

          {/* Pro Tips */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">Pro Tips</h3>
            <ul className="space-y-2">
              <li className="flex items-start text-neutral-600">
                <span className="text-green-500 mr-2">✓</span>
                <span>Start with 1 model/week</span>
              </li>
              <li className="flex items-start text-neutral-600">
                <span className="text-green-500 mr-2">✓</span>
                <span>Read the curated insights (that's where magic happens)</span>
              </li>
              <li className="flex items-start text-neutral-600">
                <span className="text-green-500 mr-2">✓</span>
                <span>Track progress (green checkmarks = viewed)</span>
              </li>
              <li className="flex items-start text-neutral-600">
                <span className="text-green-500 mr-2">✓</span>
                <span>Connect related models over time</span>
              </li>
            </ul>
          </div>

          {/* The Goal */}
          <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-accent-800 mb-2">The Goal</h3>
            <p className="text-neutral-700">
              Not to memorize 119 models. To internalize a few so well they change how you see the world.
            </p>
            <p className="text-neutral-700 font-semibold mt-2">
              Start with one. Build from there.
            </p>
          </div>
        </div>

        {/* Footer with CTA */}
        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 rounded-b-2xl flex flex-col sm:flex-row gap-3 justify-between items-center">
          <a
            href="/about"
            className="btn btn-outline btn-md w-full sm:w-auto"
          >
            Tell Me More
          </a>
          <button
            onClick={onClose}
            className="btn btn-primary btn-md w-full sm:w-auto"
          >
            Got It, Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}

