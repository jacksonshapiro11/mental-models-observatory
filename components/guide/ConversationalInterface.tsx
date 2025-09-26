'use client';

import { getAllDomains, getAllModels } from '@/lib/data';
import { DEFAULT_LEARNING_PATHS } from '@/lib/user-profile';
import { ArrowRight, BookOpen, Brain, Send, Target } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recommendations?: {
    models: any[];
    paths: any[];
    domains: any[];
  };
}

interface ConversationalInterfaceProps {
  onClose: () => void;
}

export default function ConversationalInterface({ onClose }: ConversationalInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! What mental models or learning challenges can I help you with?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const findRelevantContent = (query: string) => {
    const queryLower = query.toLowerCase();
    const allModels = getAllModels();
    const allDomains = getAllDomains();
    
    // Enhanced keyword matching with broader search
    const keywords = queryLower.split(' ').filter(word => word.length > 2);
    
    const relevantModels = allModels.filter(model => {
      const modelText = `${model.name} ${model.description} ${model.tags.join(' ')} ${model.principles.join(' ')}`.toLowerCase();
      return keywords.some(keyword => modelText.includes(keyword)) ||
             modelText.includes(queryLower) ||
             // Fallback: if no matches, include some foundational models
             (keywords.length === 0 && ['probabilistic-thinking-base-rate-neglect', 'cognitive-biases-systematic-errors', 'models-as-mental-procedures-operating-systems'].includes(model.slug));
    });

    const relevantPaths = DEFAULT_LEARNING_PATHS.filter(path => {
      const pathText = `${path.title} ${path.description} ${path.tags.join(' ')}`.toLowerCase();
      return keywords.some(keyword => pathText.includes(keyword)) ||
             pathText.includes(queryLower);
    });

    // If no specific matches, return foundational paths
    const finalPaths = relevantPaths.length > 0 ? relevantPaths : DEFAULT_LEARNING_PATHS.slice(0, 3);
    const finalModels = relevantModels.length > 0 ? relevantModels : allModels.filter(m => m.difficulty === 'beginner').slice(0, 5);

    return {
      models: finalModels.slice(0, 5),
      paths: finalPaths.slice(0, 3),
      domains: allDomains.slice(0, 3)
    };
  };

  const generateResponse = (userQuery: string) => {
    const recommendations = findRelevantContent(userQuery);
    const queryLower = userQuery.toLowerCase();
    
    // Generate contextual response based on query type
    let response = "";
    
    if (queryLower.includes('10 best') || queryLower.includes('top 10') || (queryLower.includes('best') && queryLower.includes('critical'))) {
      response = "Here are the 10 most critical mental models and learning paths to master for thinking excellence:";
    } else if (queryLower.includes('best') || queryLower.includes('top') || queryLower.includes('critical') || queryLower.includes('essential')) {
      response = "Here are the most critical mental models and learning paths to master:";
    } else if (queryLower.includes('learn') && (queryLower.includes('ton') || queryLower.includes('lot') || queryLower.includes('everything'))) {
      response = "Great! Here's a comprehensive selection of mental models and learning paths to build your thinking toolkit:";
    } else if (queryLower.includes('decision') || queryLower.includes('choice')) {
      response = "For better decision-making, these mental models will help you think more clearly:";
    } else if (queryLower.includes('business') || queryLower.includes('strategy')) {
      response = "For business and strategy, these frameworks will give you competitive advantages:";
    } else if (queryLower.includes('system') || queryLower.includes('complex')) {
      response = "For systems thinking and complexity, these models will help you see the bigger picture:";
    } else if (queryLower.includes('lead') || queryLower.includes('team')) {
      response = "For leadership and influence, these mental models will help you work with people effectively:";
    } else if (queryLower.includes('learn') || queryLower.includes('skill')) {
      response = "For learning and skill development, these models will accelerate your growth:";
    } else {
      response = "Based on your question, here are some relevant mental models and learning paths:";
    }

    return { response, recommendations };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Simulate AI processing time
      setTimeout(() => {
        try {
          const { response, recommendations } = generateResponse(currentInput);
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: response,
            timestamp: new Date(),
            recommendations
          };

          setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
          console.error('Error generating response:', error);
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: "I'm here to help! Here are some mental models and learning paths that might be useful:",
            timestamp: new Date(),
            recommendations: {
              models: getAllModels().slice(0, 3),
              paths: DEFAULT_LEARNING_PATHS.slice(0, 2),
              domains: getAllDomains().slice(0, 2)
            }
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
      }, 800); // Reduced from 1000ms to 800ms for faster response
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-foundational-100 rounded-full flex items-center justify-center">
              <Brain className="w-5 h-5 text-foundational-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-800">AI Learning Assistant</h2>
              <p className="text-sm text-neutral-600">Get personalized mental model recommendations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`rounded-lg p-4 ${
                  message.type === 'user' 
                    ? 'bg-foundational-600 text-white' 
                    : 'bg-neutral-100 text-neutral-800'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                
                {/* Recommendations */}
                {message.recommendations && (
                  <div className="mt-4 space-y-4">
                    {/* Learning Paths */}
                    {message.recommendations.paths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          Recommended Learning Paths
                        </h4>
                        <div className="space-y-2">
                          {message.recommendations.paths.map((path) => (
                            <Link
                              key={path.id}
                              href={`/guide/path/${path.id}`}
                              className="block p-3 bg-white border border-neutral-200 rounded-lg hover:border-foundational-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="font-medium text-neutral-800">{path.title}</h5>
                                  <p className="text-sm text-neutral-600">{path.description}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-neutral-400" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Models */}
                    {message.recommendations.models.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center">
                          <BookOpen className="w-4 h-4 mr-1" />
                          Relevant Mental Models
                        </h4>
                        <div className="space-y-2">
                          {message.recommendations.models.map((model) => (
                            <div key={model.id} className="p-3 bg-white border border-neutral-200 rounded-lg">
                              <h5 className="font-medium text-neutral-800">{model.name}</h5>
                              <p className="text-sm text-neutral-600">{model.description}</p>
                              <p className="text-xs text-neutral-500 mt-1">{model.domain}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-neutral-100 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foundational-600"></div>
                  <span className="text-neutral-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 border-t border-neutral-200">
          <div className="flex space-x-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about mental models, learning strategies, or specific challenges..."
              className="flex-1 p-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-foundational-500 focus:border-transparent resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="btn btn-primary self-end disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Decision making",
              "Business strategy", 
              "Learning skills",
              "Systems thinking"
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInputValue(suggestion)}
                className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1 rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
