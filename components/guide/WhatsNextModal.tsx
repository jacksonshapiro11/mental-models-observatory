'use client';

import { getAllModels } from '@/lib/data';
import { LearningPath } from '@/types/user';
import { ArrowRight, Book, Compass, Layers, Lightbulb, Target, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface WhatsNextModalProps {
  completedPath: LearningPath;
  completedModels: string[];
  onClose: () => void;
}

interface NextStepOption {
  id: string;
  type: 'deeper' | 'adjacent' | 'new' | 'apply';
  title: string;
  description: string;
  reason: string;
  icon: any;
  color: string;
  paths: Array<{
    id: string;
    title: string;
    description: string;
    modelCount: number;
  }>;
}

export default function WhatsNextModal({ completedPath, completedModels, onClose }: WhatsNextModalProps) {
  const [nextSteps, setNextSteps] = useState<NextStepOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    console.log('WhatsNextModal mounted', { completedPath, completedModels });
    generateNextSteps();
  }, [completedPath, completedModels]);

  const generateNextSteps = () => {
    const allModels = getAllModels();
    
    // Analyze what they just learned
    const completedModelObjects = completedModels
      .map(slug => allModels.find(m => m.slug === slug))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    
    const completedDomains = [...new Set(completedModelObjects.map(m => m.domainSlug).filter(Boolean))];
    const completedTags = [...new Set(completedModelObjects.flatMap(m => m.tags || []))];
    
    const options: NextStepOption[] = [];
    
    // 1. GO DEEPER - Advanced models in the same domains
    const deeperModels = allModels.filter(m => 
      completedDomains.includes(m.domainSlug || '') && 
      !completedModels.includes(m.slug) &&
      (m.slug.includes('advanced') || m.slug.includes('complex'))
    );
    
    if (deeperModels.length >= 2) {
      options.push({
        id: 'deeper',
        type: 'deeper',
        title: 'Go Deeper',
        description: 'Master advanced concepts in the domains you just explored',
        reason: `You've built a foundation in ${completedDomains.slice(0, 2).join(' and ')}. Ready for the next level?`,
        icon: Layers,
        color: 'from-blue-500 to-blue-600',
        paths: [{
          id: 'deep-dive-custom',
          title: `Advanced ${completedPath.title}`,
          description: 'Build on what you learned with more sophisticated models',
          modelCount: Math.min(deeperModels.length, 5)
        }]
      });
    }
    
    // 2. ADJACENT - Related domains/tags
    const adjacentModels = allModels.filter(m => 
      !completedModels.includes(m.slug) &&
      !completedDomains.includes(m.domainSlug || '') &&
      (m.tags || []).some(tag => completedTags.includes(tag))
    );
    
    if (adjacentModels.length >= 2) {
      const adjacentTags = [...new Set(adjacentModels.flatMap(m => m?.tags || []))].slice(0, 3);
      options.push({
        id: 'adjacent',
        type: 'adjacent',
        title: 'Explore Adjacent Areas',
        description: 'Discover related models that complement what you learned',
        reason: `Based on your interest in ${completedTags.slice(0, 2).join(' and ')}, these will expand your toolkit.`,
        icon: Compass,
        color: 'from-purple-500 to-purple-600',
        paths: [{
          id: 'adjacent-custom',
          title: `${completedTags[0] ? completedTags[0].charAt(0).toUpperCase() + completedTags[0].slice(1) : 'Related'} Models`,
          description: 'Connect the dots with complementary mental models',
          modelCount: Math.min(adjacentModels.length, 5)
        }]
      });
    }
    
    // 3. NEW TERRITORY - Completely different domains
    const newDomains = [...new Set(allModels.map(m => m.domainSlug).filter(d => d && !completedDomains.includes(d)))];
    const newModels = allModels.filter(m => 
      newDomains.includes(m.domainSlug || '') && 
      !completedModels.includes(m.slug)
    );
    
    if (newModels.length >= 2) {
      options.push({
        id: 'new',
        type: 'new',
        title: 'New Territory',
        description: 'Branch out into completely different areas of thinking',
        reason: 'Broaden your perspective by exploring models from different disciplines.',
        icon: Zap,
        color: 'from-orange-500 to-orange-600',
        paths: [
          {
            id: 'decision-maker',
            title: 'Decision Making Foundations',
            description: 'Master the art of better choices',
            modelCount: 4
          },
          {
            id: 'system-thinker',
            title: 'Systems & Complexity',
            description: 'Understand interconnected systems',
            modelCount: 4
          }
        ].filter(p => p.id !== completedPath.id)
      });
    }
    
    // 4. APPLY IT - Practical application focus
    const practicalModels = allModels.filter(m => 
      !completedModels.includes(m.slug) &&
      (m.slug.includes('application') || m.slug.includes('practical') || m.tags?.includes('work'))
    );
    
    if (practicalModels.length >= 2) {
      options.push({
        id: 'apply',
        type: 'apply',
        title: 'Apply What You Learned',
        description: 'Practical models to put your knowledge into action',
        reason: 'Turn theory into practice with real-world application frameworks.',
        icon: Target,
        color: 'from-green-500 to-green-600',
        paths: [{
          id: 'application-custom',
          title: 'Practical Applications',
          description: 'Use your new mental models in real situations',
          modelCount: Math.min(practicalModels.length, 4)
        }]
      });
    }
    
    setNextSteps(options);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'deeper': return Layers;
      case 'adjacent': return Compass;
      case 'new': return Zap;
      case 'apply': return Target;
      default: return Book;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-foundational-600 to-accent-600 text-white p-8 rounded-t-xl">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Lightbulb className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center mb-2">What's Next?</h2>
          <p className="text-center text-white/90 text-lg">
            You've mastered <strong>{completedModels.length} models</strong> in the {completedPath.title} path.
            <br />How would you like to continue your learning journey?
          </p>
        </div>

        {/* Options */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {nextSteps.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedOption === option.id;
              
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={`text-left p-6 rounded-xl border-2 transition-all ${
                    isSelected 
                      ? 'border-foundational-500 bg-foundational-50 shadow-lg scale-105' 
                      : 'border-neutral-200 hover:border-foundational-300 hover:shadow-md'
                  }`}
                >
                  <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${option.color} text-white mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-neutral-800 mb-2">
                    {option.title}
                  </h3>
                  <p className="text-sm text-neutral-600 mb-3">
                    {option.description}
                  </p>
                  <div className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    💡 <strong>Why this?</strong> {option.reason}
                  </div>
                  
                  {isSelected && option.paths.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-200">
                      <p className="text-xs font-semibold text-neutral-700 mb-2">Available paths:</p>
                      <div className="space-y-2">
                        {option.paths.map((path) => (
                          <div key={path.id} className="text-xs bg-white p-2 rounded border border-neutral-200">
                            <div className="font-medium text-neutral-800">{path.title}</div>
                            <div className="text-neutral-500">{path.description} • {path.modelCount} models</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
            <Link
              href="/"
              className="btn btn-ghost"
            >
              Back to Home
            </Link>
            
            {selectedOption ? (
              <Link
                href={`/guide/results?continue=${selectedOption}`}
                className="btn btn-primary group"
              >
                Continue Learning
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <button
                disabled
                className="btn btn-primary opacity-50 cursor-not-allowed"
              >
                Select an option to continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

