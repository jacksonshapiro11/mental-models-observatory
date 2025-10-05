'use client';

import ConversationalInterface from '@/components/guide/ConversationalInterface';
import PathBuilder from '@/components/guide/PathBuilder';
import { DEFAULT_LEARNING_PATHS } from '@/lib/user-profile';
import { ArrowRight, BookOpen, Clock, MessageSquare, Plus, Search, Target } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversationalInterface, setShowConversationalInterface] = useState(false);
  const [showPathBuilder, setShowPathBuilder] = useState(false);
  const [customPaths, setCustomPaths] = useState<any[]>([]);

  const allPaths = [...DEFAULT_LEARNING_PATHS, ...customPaths];
  const filteredPaths = allPaths.filter(path =>
    path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-specialized-100 text-specialized-800';
      case 'intermediate': return 'bg-accent-100 text-accent-800';
      case 'advanced': return 'bg-practical-100 text-practical-800';
      default: return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getPathIcon = (path: any) => {
    const iconMap: { [key: string]: any } = {
      '🎯': Target,
      '📈': Target,
      '💡': Target,
      '🌐': Target,
      '👥': Target,
      '📚': BookOpen
    };
    
    const IconComponent = iconMap[path.icon];
    return IconComponent ? <IconComponent className="w-6 h-6" /> : <span className="text-xl">{path.icon}</span>;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-neutral-800 mb-4">
              Learning Paths
            </h1>
            <p className="text-xl text-neutral-600 mb-8">
              Choose a learning path or ask the AI assistant for help
            </p>
            
            {/* Search and Conversational Interface Toggle */}
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search learning paths..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConversationalInterface(true)}
                  className="btn btn-primary"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ask AI Assistant
                </button>
                <button
                  onClick={() => setShowPathBuilder(true)}
                  className="btn btn-outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Build Custom Path
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modals */}
        {showConversationalInterface && (
          <ConversationalInterface onClose={() => setShowConversationalInterface(false)} />
        )}
        
        {showPathBuilder && (
          <PathBuilder 
            onPathCreated={(path) => {
              setCustomPaths(prev => [...prev, path]);
              setShowPathBuilder(false);
            }}
            onClose={() => setShowPathBuilder(false)} 
          />
        )}

        {/* Learning Paths Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPaths.map((path) => (
            <Link
              key={path.id}
              href={`/guide/path/${path.id}`}
              className="group bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-foundational-300 transition-all duration-200"
            >
              <div className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-12 h-12 bg-foundational-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-foundational-200 transition-colors">
                    {getPathIcon(path)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-neutral-800 group-hover:text-foundational-600 transition-colors">
                        {path.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(path.difficulty)}`}>
                        {path.difficulty}
                      </span>
                    </div>
                    <p className="text-neutral-600 text-sm line-clamp-2">
                      {path.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-neutral-500">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{path.estimatedTime}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{path.models.length} models</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-foundational-600 group-hover:translate-x-1 transition-all" />
                </div>
                
                <div className="mt-3 flex flex-wrap gap-1">
                  {path.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-md text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredPaths.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">No paths found</h3>
            <p className="text-neutral-600">Try adjusting your search terms or browse all available paths.</p>
          </div>
        )}
      </div>
    </div>
  );
}
