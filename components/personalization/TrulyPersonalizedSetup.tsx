'use client';

import { UserProfile } from '@/types/user';
import { ArrowRight, Brain, Lightbulb, MessageCircle, Target, Zap } from 'lucide-react';
import { useState } from 'react';

interface TrulyPersonalizedSetupProps {
  onComplete: (profile: UserProfile & { personalContext: any }) => void;
  onSkip: () => void;
}

export default function TrulyPersonalizedSetup({ onComplete, onSkip }: TrulyPersonalizedSetupProps) {
  const [step, setStep] = useState(1);
  const [responses, setResponses] = useState<any>({});
  const [currentResponse, setCurrentResponse] = useState('');

  // Dynamic questions that adapt based on previous answers
  const getNextQuestion = () => {
    switch (step) {
      case 1:
        return {
          question: "What's a specific challenge you're facing right now that better thinking could help with?",
          placeholder: "e.g., 'I'm starting a business but struggle with making decisions under uncertainty' or 'I want to understand why people behave irrationally in my team'",
          followUp: "Be as specific as possible - this helps us find the most relevant mental models for your situation."
        };
      
      case 2:
        return {
          question: `Interesting! When you think about ${responses.challenge ? 'this challenge' : 'problems like this'}, what usually trips you up the most?`,
          placeholder: "e.g., 'I overthink everything' or 'I don't know how to weigh different factors' or 'I get overwhelmed by too many options'",
          followUp: "Understanding your thinking patterns helps us identify which frameworks will be most useful."
        };
      
      case 3:
        return {
          question: "What's your learning style? How do you best absorb new concepts?",
          options: [
            { 
              id: 'story-driven', 
              label: 'Stories & Examples', 
              desc: 'I learn best through real-world stories and concrete examples',
              icon: MessageCircle 
            },
            { 
              id: 'principle-first', 
              label: 'Principles First', 
              desc: 'Give me the core logic, then I can apply it myself',
              icon: Brain 
            },
            { 
              id: 'hands-on', 
              label: 'Learning by Doing', 
              desc: 'I need to try things out and experiment to understand',
              icon: Target 
            },
            { 
              id: 'connection-based', 
              label: 'Building Connections', 
              desc: 'I learn by seeing how new ideas connect to what I already know',
              icon: Lightbulb 
            }
          ]
        };
      
      case 4:
        return {
          question: `Given your ${responses.learningStyle || 'learning preferences'}, how much time can you realistically dedicate to this?`,
          options: [
            { 
              id: 'micro-learning', 
              label: '5-10 minutes daily', 
              desc: 'Quick insights I can apply immediately',
              time: '5min'
            },
            { 
              id: 'focused-sessions', 
              label: '15-30 minutes, 2-3x per week', 
              desc: 'Deeper dives when I have focused time',
              time: '15min'
            },
            { 
              id: 'intensive-learning', 
              label: '1+ hour weekly', 
              desc: 'I want to really master these concepts',
              time: '30min'
            }
          ]
        };
      
      case 5:
        return {
          question: "One last thing - what would success look like for you?",
          placeholder: responses.challenge 
            ? `e.g., 'I can confidently make decisions about ${responses.challenge}' or 'I understand the key factors that drive success in this area'`
            : "e.g., 'I make better decisions under pressure' or 'I can see patterns others miss'",
          followUp: "This helps us prioritize which mental models will have the biggest impact for you."
        };
      
      default:
        return null;
    }
  };

  const handleTextResponse = (value: string) => {
    const questionKey = step === 1 ? 'challenge' : 
                      step === 2 ? 'thinkingPattern' : 
                      step === 5 ? 'successDefinition' : 'response';
    
    setResponses({ ...responses, [questionKey]: value });
  };

  const handleOptionSelect = (optionId: string, optionData: any) => {
    const questionKey = step === 3 ? 'learningStyle' : 
                      step === 4 ? 'timeCommitment' : 'selection';
    
    setResponses({ 
      ...responses, 
      [questionKey]: optionId,
      [`${questionKey}Data`]: optionData 
    });
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
      setCurrentResponse('');
    } else {
      // Generate truly personalized profile
      const personalizedProfile: UserProfile & { personalContext: any } = {
        // Standard profile fields
        experience: responses.thinkingPattern?.includes('overthink') ? 'some' : 
                   responses.thinkingPattern?.includes('overwhelmed') ? 'new' : 'experienced',
        interests: extractInterests(responses.challenge),
        goals: responses.challenge?.includes('business') || responses.challenge?.includes('work') ? 'work' : 
               responses.challenge?.includes('team') || responses.challenge?.includes('people') ? 'teaching' : 'learning',
        timeAvailable: responses.timeCommitmentData?.time || '15min',
        preferredDifficulty: 'mixed',
        createdAt: Date.now(),
        lastActive: Date.now(),
        
        // Rich personal context
        personalContext: {
          specificChallenge: responses.challenge,
          thinkingPattern: responses.thinkingPattern,
          learningStyle: responses.learningStyle,
          learningStyleData: responses.learningStyleData,
          timeCommitment: responses.timeCommitment,
          timeCommitmentData: responses.timeCommitmentData,
          successDefinition: responses.successDefinition,
          
          // Derived insights
          primaryFocus: derivePrimaryFocus(responses),
          recommendedApproach: deriveRecommendedApproach(responses),
          personalizedReason: generatePersonalizedReason(responses)
        }
      };
      
      onComplete(personalizedProfile);
    }
  };

  // Helper functions to extract insights from responses
  const extractInterests = (challenge: string) => {
    const interests = [];
    if (challenge?.toLowerCase().includes('business') || challenge?.toLowerCase().includes('startup')) interests.push('business');
    if (challenge?.toLowerCase().includes('decision') || challenge?.toLowerCase().includes('choose')) interests.push('decisions');
    if (challenge?.toLowerCase().includes('team') || challenge?.toLowerCase().includes('people')) interests.push('psychology');
    if (challenge?.toLowerCase().includes('creative') || challenge?.toLowerCase().includes('innovation')) interests.push('creativity');
    if (challenge?.toLowerCase().includes('system') || challenge?.toLowerCase().includes('complex')) interests.push('systems');
    return interests.length > 0 ? interests : ['learning'];
  };

  const derivePrimaryFocus = (responses: any) => {
    if (responses.challenge?.includes('decision')) return 'decision-making';
    if (responses.challenge?.includes('business') || responses.challenge?.includes('startup')) return 'business-strategy';
    if (responses.challenge?.includes('team') || responses.challenge?.includes('people')) return 'human-psychology';
    if (responses.challenge?.includes('creative') || responses.challenge?.includes('innovation')) return 'creative-thinking';
    return 'general-thinking';
  };

  const deriveRecommendedApproach = (responses: any) => {
    const approach = {
      contentStyle: responses.learningStyle === 'story-driven' ? 'example-heavy' :
                   responses.learningStyle === 'principle-first' ? 'concept-focused' :
                   responses.learningStyle === 'hands-on' ? 'application-oriented' : 'connection-based',
      
      pacing: responses.timeCommitment === 'micro-learning' ? 'bite-sized' :
              responses.timeCommitment === 'intensive-learning' ? 'comprehensive' : 'balanced',
      
      difficulty: responses.thinkingPattern?.includes('overthink') ? 'structured' :
                 responses.thinkingPattern?.includes('overwhelmed') ? 'simplified' : 'challenging'
    };
    
    return approach;
  };

  const generatePersonalizedReason = (responses: any) => {
    const challenge = responses.challenge || 'your thinking challenges';
    const style = responses.learningStyleData?.desc || 'your learning style';
    
    return `Based on your specific challenge with ${challenge} and your preference for ${style.toLowerCase()}, I've identified the mental models that will give you the biggest breakthrough in the shortest time.`;
  };

  const canProceed = () => {
    const currentQuestion = getNextQuestion();
    if (!currentQuestion) return false;
    
    if (currentQuestion.options) {
      const questionKey = step === 3 ? 'learningStyle' : 'timeCommitment';
      return responses[questionKey];
    } else {
      const questionKey = step === 1 ? 'challenge' : 
                        step === 2 ? 'thinkingPattern' : 
                        'successDefinition';
      return responses[questionKey] && responses[questionKey].length > 10;
    }
  };

  const currentQuestion = getNextQuestion();
  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-foundational-50 via-neutral-25 to-accent-50 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-foundational-100 text-foundational-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Brain className="h-4 w-4" />
              <span>Question {step} of 5</span>
            </div>
            <h2 className="text-3xl font-bold text-neutral-800 mb-2">
              Let's Get Personal
            </h2>
            <p className="text-neutral-600">
              No generic questions - just tell me about your specific situation
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 rounded-full h-3 mb-8">
            <div 
              className="bg-gradient-to-r from-foundational-500 to-foundational-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-neutral-800 mb-4">
              {currentQuestion.question}
            </h3>
            
            {currentQuestion.followUp && (
              <p className="text-neutral-600 mb-6 text-sm">
                {currentQuestion.followUp}
              </p>
            )}

            {/* Text Input Questions */}
            {!currentQuestion.options && (
              <div className="space-y-4">
                <textarea
                  value={currentResponse}
                  onChange={(e) => {
                    setCurrentResponse(e.target.value);
                    handleTextResponse(e.target.value);
                  }}
                  placeholder={currentQuestion.placeholder}
                  className="w-full p-4 border-2 border-neutral-200 rounded-lg focus:border-foundational-500 focus:outline-none resize-none"
                  rows={4}
                />
                <p className="text-xs text-neutral-500">
                  The more specific you are, the better I can personalize your experience
                </p>
              </div>
            )}

            {/* Option-based Questions */}
            {currentQuestion.options && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option: any) => {
                  const Icon = option.icon;
                  const isSelected = responses[step === 3 ? 'learningStyle' : 'timeCommitment'] === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSelect(option.id, option)}
                      className={`p-6 rounded-lg border-2 transition-all duration-200 text-left hover:shadow-md ${
                        isSelected
                          ? 'border-foundational-500 bg-foundational-50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="p-2 rounded-lg bg-foundational-100">
                          <Icon className="h-5 w-5 text-foundational-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-800 mb-1">{option.label}</div>
                          <div className="text-sm text-neutral-600">{option.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={onSkip}
              className="text-neutral-600 hover:text-neutral-800 font-medium transition-colors"
            >
              Skip for now
            </button>
            
            <div className="flex space-x-3">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="btn btn-outline"
                >
                  Back
                </button>
              )}
              
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="btn btn-primary group"
              >
                {step === 5 ? (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Create My Personal Guide
                  </>
                ) : (
                  <>
                    Next Question
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
