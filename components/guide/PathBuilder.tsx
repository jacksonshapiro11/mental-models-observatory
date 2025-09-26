'use client';

import { getAllDomains, getAllModels } from '@/lib/data';
import { LearningPath } from '@/types/user';
import { Plus, Save, Target, X } from 'lucide-react';
import { useState } from 'react';

interface PathBuilderProps {
  onPathCreated: (path: LearningPath) => void;
  onClose: () => void;
}

export default function PathBuilder({ onPathCreated, onClose }: PathBuilderProps) {
  const [pathTitle, setPathTitle] = useState('');
  const [pathDescription, setPathDescription] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');

  const allModels = getAllModels();
  const allDomains = getAllDomains();

  const filteredModels = allModels.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addModel = (modelSlug: string) => {
    if (!selectedModels.includes(modelSlug)) {
      setSelectedModels([...selectedModels, modelSlug]);
    }
  };

  const removeModel = (modelSlug: string) => {
    setSelectedModels(selectedModels.filter(slug => slug !== modelSlug));
  };

  const createPath = () => {
    if (!pathTitle.trim() || selectedModels.length === 0) return;

    const selectedModelsData = selectedModels.map(slug => 
      allModels.find(model => model.slug === slug)
    ).filter(Boolean);

    const estimatedTime = selectedModels.length * 5; // 5 minutes per model
    const domains = [...new Set(selectedModelsData.map(model => model.domainSlug))];
    const tags = [...new Set(selectedModelsData.flatMap(model => model.tags))];

    const newPath: LearningPath = {
      id: `custom-${Date.now()}`,
      title: pathTitle,
      description: pathDescription || `A custom learning path with ${selectedModels.length} mental models`,
      difficulty: selectedDifficulty,
      estimatedTime: `${estimatedTime}-${estimatedTime + 5} minutes`,
      models: selectedModels,
      domains,
      tags: tags.slice(0, 5), // Limit to 5 tags
      icon: '🎯'
    };

    onPathCreated(newPath);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-foundational-100 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-foundational-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-800">Build Your Learning Path</h2>
              <p className="text-sm text-neutral-600">Create a custom learning journey</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Path Details */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Path Title
                </label>
                <input
                  type="text"
                  value={pathTitle}
                  onChange={(e) => setPathTitle(e.target.value)}
                  placeholder="e.g., My Decision Making Journey"
                  className="w-full p-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Description
                </label>
                <textarea
                  value={pathDescription}
                  onChange={(e) => setPathDescription(e.target.value)}
                  placeholder="Describe what this path will help you learn..."
                  className="w-full p-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Difficulty Level
                </label>
                <div className="flex space-x-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedDifficulty(level)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDifficulty === level
                          ? getDifficultyColor(level)
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Models */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Selected Models ({selectedModels.length})
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedModels.map((modelSlug) => {
                    const model = allModels.find(m => m.slug === modelSlug);
                    if (!model) return null;
                    
                    return (
                      <div key={modelSlug} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-800 truncate">
                            {model.name}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {model.domain}
                          </div>
                        </div>
                        <button
                          onClick={() => removeModel(modelSlug)}
                          className="text-neutral-400 hover:text-red-500 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Model Search */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Search Models
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, domain, or tags..."
                  className="w-full p-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredModels.slice(0, 20).map((model) => (
                  <div
                    key={model.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedModels.includes(model.slug)
                        ? 'border-foundational-300 bg-foundational-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    onClick={() => addModel(model.slug)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-800">
                          {model.name}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {model.domain}
                        </div>
                        <div className="text-xs text-neutral-600 mt-1 line-clamp-2">
                          {model.description}
                        </div>
                      </div>
                      {selectedModels.includes(model.slug) && (
                        <div className="ml-2 text-foundational-600">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            {selectedModels.length} models selected • Estimated time: {selectedModels.length * 5}-{selectedModels.length * 5 + 5} minutes
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={createPath}
              disabled={!pathTitle.trim() || selectedModels.length === 0}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              Create Path
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

