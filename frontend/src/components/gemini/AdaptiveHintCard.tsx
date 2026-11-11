'use client';

import { AdaptiveHint } from '@/lib/gemini';
import { 
  Lightbulb, 
  Code2, 
  Clock, 
  CheckCircle2,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
import { useState } from 'react';

interface AdaptiveHintCardProps {
  hint: AdaptiveHint;
  className?: string;
  onStepComplete?: (stepIndex: number) => void;
}

/**
 * Card displaying adaptive hint with code examples and next steps
 */
export function AdaptiveHintCard({ 
  hint, 
  className = '',
  onStepComplete 
}: AdaptiveHintCardProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [copiedCode, setCopiedCode] = useState(false);

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'simplified':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          label: 'Simplified',
          icon: '🌱',
        };
      case 'detailed':
        return {
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          label: 'Detailed',
          icon: '🔬',
        };
      default:
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          label: 'Standard',
          icon: '📚',
        };
    }
  };

  const config = getDifficultyConfig(hint.difficulty);

  const handleStepToggle = (index: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
      onStepComplete?.(index);
    }
    setCompletedSteps(newCompleted);
  };

  const handleCopyCode = async () => {
    if (hint.codeExample) {
      await navigator.clipboard.writeText(hint.codeExample);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const totalTime = hint.nextSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

  return (
    <div className={`bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Hint</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                {config.icon} {config.label}
              </span>
              <span className="text-xs text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                ~{totalTime} min total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mb-4">
        <p className="text-gray-300 text-sm leading-relaxed">
          {hint.explanation}
        </p>
      </div>

      {/* Code Example */}
      {hint.codeExample && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-300">Code Example</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="text-xs text-gray-400 hover:text-purple-400 transition-colors flex items-center space-x-1"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300">
              <code>{hint.codeExample}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Next Steps */}
      {hint.nextSteps.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-gray-300">Next Steps</span>
            <span className="text-xs text-gray-500">
              ({completedSteps.size}/{hint.nextSteps.length} completed)
            </span>
          </div>
          <div className="space-y-2">
            {hint.nextSteps.map((step, index) => {
              const isCompleted = completedSteps.has(index);
              return (
                <button
                  key={index}
                  onClick={() => handleStepToggle(index)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isCompleted
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/30 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-600 flex items-center justify-center">
                          <span className="text-xs text-gray-500">{index + 1}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-300'}`}>
                        {step.step}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          ~{step.estimatedTime} min
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {hint.nextSteps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Progress</span>
            <span>{Math.round((completedSteps.size / hint.nextSteps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${(completedSteps.size / hint.nextSteps.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for hint card
 */
export function AdaptiveHintLoading() {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gray-700 rounded-lg" />
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-32" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-700 rounded w-5/6" />
        <div className="h-4 bg-gray-700 rounded w-4/6" />
      </div>
      <div className="h-24 bg-gray-700 rounded-lg mb-4" />
      <div className="space-y-2">
        <div className="h-12 bg-gray-700 rounded-lg" />
        <div className="h-12 bg-gray-700 rounded-lg" />
        <div className="h-12 bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Compact hint display for sidebar
 */
export function AdaptiveHintCompact({ hint }: { hint: AdaptiveHint }) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3">
      <div className="flex items-start space-x-2 mb-2">
        <Lightbulb className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-300 leading-relaxed">
          {hint.explanation.slice(0, 100)}
          {hint.explanation.length > 100 && '...'}
        </p>
      </div>
      {hint.nextSteps.length > 0 && (
        <div className="text-xs text-gray-500 flex items-center">
          <ChevronRight className="w-3 h-3 mr-1" />
          {hint.nextSteps.length} steps • ~
          {hint.nextSteps.reduce((sum, s) => sum + s.estimatedTime, 0)} min
        </div>
      )}
    </div>
  );
}
