'use client';

import ReadwiseHighlights from '@/components/content/ReadwiseHighlights';
import WhatsNextModal from '@/components/guide/WhatsNextModal';
import { getAllModels } from '@/lib/data';
import { DEFAULT_LEARNING_PATHS } from '@/lib/user-profile';
import { LearningPath } from '@/types/user';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, Clock, Plus, Settings, Star, Target, X } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PathPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PathPage({ params }: PathPageProps) {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [completedModels, setCompletedModels] = useState<Set<string>>(new Set());
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customPath, setCustomPath] = useState<LearningPath | null>(null);
  const [showWhatsNext, setShowWhatsNext] = useState(false);

  useEffect(() => {
    const loadPath = async () => {
      const resolvedParams = await params;
      
      // First check for dynamic paths in sessionStorage
      const dynamicPathsData = sessionStorage.getItem('dynamic_paths');
      console.log('Looking for path ID:', resolvedParams.id);
      console.log('Dynamic paths data:', dynamicPathsData);
      
      if (dynamicPathsData) {
        try {
          const dynamicPaths = JSON.parse(dynamicPathsData);
          console.log('Parsed dynamic paths:', dynamicPaths);
          const foundDynamicPath = dynamicPaths.find((p: any) => p.id === resolvedParams.id);
          console.log('Found dynamic path:', foundDynamicPath);
          
          if (foundDynamicPath) {
            // Convert dynamic path to LearningPath format
            const convertedPath: LearningPath = {
              id: foundDynamicPath.id,
              title: foundDynamicPath.title,
              description: foundDynamicPath.description,
              difficulty: foundDynamicPath.difficulty === 'gentle' ? 'beginner' : 
                         foundDynamicPath.difficulty === 'moderate' ? 'intermediate' : 'advanced',
              estimatedTime: foundDynamicPath.estimatedTotalTime,
              models: foundDynamicPath.models.map((m: any) => m.model.slug),
              domains: foundDynamicPath.models.map((m: any) => m.model.domainSlug).filter(Boolean),
              tags: foundDynamicPath.pathType ? [foundDynamicPath.pathType] : [],
              icon: '🎯'
            };
            setPath(convertedPath);
            return;
          }
        } catch (error) {
          console.error('Error parsing dynamic paths:', error);
        }
      }
      
      // Fallback to default paths
      const foundPath = DEFAULT_LEARNING_PATHS.find(p => p.id === resolvedParams.id);
      if (!foundPath) {
        notFound();
      }
      setPath(foundPath);
    };
    loadPath();
  }, [params]);

  if (!path) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foundational-600"></div>
      </div>
    );
  }

  const allModels = getAllModels();
  const pathModels = path.models.map(slug => 
    allModels.find(model => model.slug === slug)
  ).filter(Boolean);

  const currentModel = pathModels[currentModelIndex];
  const progress = (completedModels.size / pathModels.length) * 100;

  const markModelComplete = (modelSlug: string) => {
    setCompletedModels(prev => new Set(prev).add(modelSlug));
  };

  const nextModel = () => {
    // Auto-mark current model as complete when they hit next
    if (currentModel) {
      setCompletedModels(prev => new Set(prev).add(currentModel.slug));
    }
    
    if (currentModelIndex < pathModels.length - 1) {
      setCurrentModelIndex(currentModelIndex + 1);
    }
  };
  
  const finishPath = () => {
    // Mark final model as complete
    if (currentModel) {
      setCompletedModels(prev => {
        const newSet = new Set(prev).add(currentModel.slug);
        // Show What's Next modal after state update
        setTimeout(() => setShowWhatsNext(true), 100);
        return newSet;
      });
    }
  };

  const prevModel = () => {
    if (currentModelIndex > 0) {
      setCurrentModelIndex(currentModelIndex - 1);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-specialized-100 text-specialized-800';
      case 'intermediate': return 'bg-accent-100 text-accent-800';
      case 'advanced': return 'bg-practical-100 text-practical-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center text-neutral-600 hover:text-neutral-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Observatory
            </Link>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-neutral-500">
                {completedModels.size} of {pathModels.length} completed
              </span>
              <div className="w-32 h-2 bg-neutral-200 rounded-full">
                <div 
                  className="h-2 bg-foundational-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Path Overview Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sticky top-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-foundational-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">{path.icon}</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-neutral-800">{path.title}</h1>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficulty)}`}>
                    {path.difficulty}
                  </span>
                </div>
              </div>
              
              <p className="text-neutral-600 text-sm mb-6">{path.description}</p>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center space-x-2 text-sm text-neutral-500">
                  <Clock className="w-4 h-4" />
                  <span>{path.estimatedTime}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-neutral-500">
                  <BookOpen className="w-4 h-4" />
                  <span>{pathModels.length} mental models</span>
                </div>
              </div>

              <button
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="w-full btn btn-outline mb-4"
              >
                <Settings className="w-4 h-4 mr-2" />
                Customize This Path
              </button>

              {/* Model Progress List */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-800 mb-3">Learning Path</h3>
                {pathModels.filter((model): model is NonNullable<typeof model> => Boolean(model)).map((model, index) => (
                  <button
                    key={model.id}
                    onClick={() => setCurrentModelIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      index === currentModelIndex
                        ? 'border-foundational-300 bg-foundational-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        completedModels.has(model.slug)
                          ? 'bg-foundational-600 text-white'
                          : index === currentModelIndex
                          ? 'bg-foundational-100 text-foundational-600'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {completedModels.has(model.slug) ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-800 truncate">
                          {model.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {model.domain}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Path Customizer */}
              {showCustomizer && (
                <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <h4 className="text-sm font-semibold text-neutral-800 mb-3">Customize Your Path</h4>
                  <p className="text-xs text-neutral-600 mb-4">
                    Add or remove models to create your perfect learning journey
                  </p>
                  
                  <div className="space-y-3">
                    <div className="text-xs text-neutral-500">
                      Current models: {pathModels.length}
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // Add a random model from available models
                          const allModels = getAllModels();
                          const availableModels = allModels.filter(m => !pathModels.some(pm => pm?.slug === m.slug));
                          if (availableModels.length > 0) {
                            const randomModel = availableModels[Math.floor(Math.random() * availableModels.length)];
                            if (randomModel) {
                              const newPath = {
                                ...path,
                                models: [...path.models, randomModel.slug]
                              };
                              setCustomPath(newPath);
                            }
                          }
                        }}
                        className="btn btn-sm btn-outline"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Model
                      </button>
                      
                      <button
                        onClick={() => {
                          // Remove last model
                          if (pathModels.length > 1) {
                            const newModels = path.models.slice(0, -1);
                            const newPath = {
                              ...path,
                              models: newModels
                            };
                            setCustomPath(newPath);
                          }
                        }}
                        disabled={pathModels.length <= 1}
                        className="btn btn-sm btn-outline disabled:opacity-50"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Remove
                      </button>
                    </div>
                    
                    {customPath && (
                      <div className="pt-3 border-t border-neutral-200">
                        <button
                          onClick={() => {
                            setPath(customPath);
                            setCustomPath(null);
                            setShowCustomizer(false);
                          }}
                          className="btn btn-sm btn-primary w-full"
                        >
                          Apply Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentModel && (
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-foundational-600 font-medium">
                        Model {currentModelIndex + 1} of {pathModels.length}
                      </span>
                      {completedModels.has(currentModel.slug) && (
                        <span className="inline-flex items-center space-x-1 text-xs bg-foundational-100 text-foundational-800 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          <span>Completed</span>
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-800 mb-2">
                      {currentModel.name}
                    </h2>
                    <p className="text-neutral-600">{currentModel.domain}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentModel.difficulty)}`}>
                      {currentModel.difficulty}
                    </span>
                  </div>
                </div>

                {/* Model Content */}
                <div className="space-y-8">
                  {/* Description */}
                  <div className="prose prose-neutral max-w-none">
                    <p className="text-lg text-neutral-700 leading-relaxed">
                      {currentModel.description}
                    </p>
                  </div>
                  
                  {/* Key Principles */}
                  {currentModel.principles && currentModel.principles.length > 0 && (
                    <div className="bg-foundational-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                        <Star className="w-5 h-5 text-accent-500 mr-2" />
                        Key Principles
                      </h3>
                      <ul className="space-y-3">
                        {currentModel.principles.map((principle, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-accent-100 text-accent-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <span className="text-neutral-700 leading-relaxed">{principle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Examples */}
                  {currentModel.examples && currentModel.examples.length > 0 && (
                    <div className="bg-accent-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                        <BookOpen className="w-5 h-5 text-accent-600 mr-2" />
                        Real-World Examples
                      </h3>
                      <div className="space-y-4">
                        {currentModel.examples.map((example, index) => (
                          <div key={index} className="bg-white rounded-lg p-4 border border-accent-200">
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-accent-100 text-accent-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                                {index + 1}
                              </div>
                              <p className="text-neutral-700 leading-relaxed">{example}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Applications */}
                  {currentModel.applications && currentModel.applications.length > 0 && (
                    <div className="bg-practical-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                        <Target className="w-5 h-5 text-practical-600 mr-2" />
                        How to Apply This
                      </h3>
                      <ul className="space-y-3">
                        {currentModel.applications.map((application, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-practical-100 text-practical-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <span className="text-neutral-700 leading-relaxed">{application}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Curated Insights from Readwise */}
                  <div className="bg-specialized-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center">
                      <BookOpen className="w-5 h-5 text-specialized-600 mr-2" />
                      Curated Insights from Readwise
                    </h3>
                    <ReadwiseHighlights modelSlug={currentModel.slug} />
                  </div>
                </div>

                {/* Completion Celebration */}
                {completedModels.size === pathModels.length && (
                  <div className="bg-gradient-to-r from-accent-50 to-foundational-50 rounded-lg p-6 border border-accent-200">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Star className="w-8 h-8 text-accent-600" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-800 mb-2">
                        🎉 Congratulations!
                      </h3>
                      <p className="text-neutral-600 mb-4">
                        You've completed the <strong>{path.title}</strong> learning path! 
                        You now have a solid foundation in these mental models.
                      </p>
                      <div className="flex items-center justify-center space-x-4 text-sm text-neutral-500">
                        <span>✅ {pathModels.length} models mastered</span>
                        <span>⏱️ {path.estimatedTime} invested</span>
                        <span>🎯 {path.difficulty} level completed</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
                  <button
                    onClick={prevModel}
                    disabled={currentModelIndex === 0}
                    className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </button>

                  <div className="flex items-center space-x-3">
                    {completedModels.has(currentModel.slug) && (
                      <span className="inline-flex items-center px-3 py-2 rounded-lg bg-foundational-100 text-foundational-800 text-sm font-medium">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completed
                      </span>
                    )}
                  </div>

                  {currentModelIndex === pathModels.length - 1 ? (
                    <button
                      onClick={finishPath}
                      className="btn btn-primary"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Finish Path
                    </button>
                  ) : (
                    <button
                      onClick={nextModel}
                      className="btn btn-primary"
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* What's Next Modal */}
      {showWhatsNext && path && (
        <WhatsNextModal
          completedPath={path}
          completedModels={Array.from(completedModels)}
          onClose={() => setShowWhatsNext(false)}
        />
      )}
    </div>
  );
}