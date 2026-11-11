'use client';

import { EmotionalAnalysis } from '@/lib/gemini';
import { 
  Brain, 
  Zap, 
  Coffee, 
  AlertCircle, 
  Sparkles,
  TrendingUp 
} from 'lucide-react';

interface EmotionalStateIndicatorProps {
  analysis: EmotionalAnalysis;
  className?: string;
}

/**
 * Visual indicator for emotional state
 * Shows current state, intensity, and cognitive load
 */
export function EmotionalStateIndicator({ 
  analysis, 
  className = '' 
}: EmotionalStateIndicatorProps) {
  const getStateConfig = (state: string) => {
    switch (state) {
      case 'frustrated':
        return {
          icon: AlertCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Frustrated',
          emoji: '😤',
        };
      case 'confused':
        return {
          icon: Brain,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: 'Confused',
          emoji: '🤔',
        };
      case 'focused':
        return {
          icon: Zap,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          label: 'Focused',
          emoji: '🎯',
        };
      case 'overwhelmed':
        return {
          icon: AlertCircle,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
          label: 'Overwhelmed',
          emoji: '😰',
        };
      case 'flow':
        return {
          icon: Sparkles,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: 'In Flow',
          emoji: '🚀',
        };
      default:
        return {
          icon: Brain,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: 'Unknown',
          emoji: '🤷',
        };
    }
  };

  const config = getStateConfig(analysis.emotionalState);
  const Icon = config.icon;

  const getCognitiveLoadColor = (load: number) => {
    if (load < 40) return 'bg-green-500';
    if (load < 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-xl p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`${config.bgColor} p-2 rounded-lg`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold">{config.emoji}</span>
              <h3 className={`font-semibold ${config.color}`}>{config.label}</h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Intensity: {analysis.intensity}/10
            </p>
          </div>
        </div>
      </div>

      {/* Cognitive Load Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Cognitive Load</span>
          <span>{analysis.cognitiveLoad}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${getCognitiveLoadColor(analysis.cognitiveLoad)} transition-all duration-500`}
            style={{ width: `${analysis.cognitiveLoad}%` }}
          />
        </div>
      </div>

      {/* Indicators */}
      {analysis.indicators.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-2">Indicators:</p>
          <ul className="space-y-1">
            {analysis.indicators.slice(0, 3).map((indicator, index) => (
              <li key={index} className="text-xs text-gray-300 flex items-start">
                <span className="text-gray-500 mr-2">•</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Action */}
      <div className={`${config.bgColor} rounded-lg p-3 border ${config.borderColor}`}>
        <div className="flex items-start space-x-2">
          <Coffee className={`w-4 h-4 ${config.color} mt-0.5 flex-shrink-0`} />
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1">Recommendation</p>
            <p className="text-sm text-gray-200">{analysis.recommendedAction}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for toolbar/header
 */
export function EmotionalStateBadge({ 
  analysis 
}: { 
  analysis: EmotionalAnalysis 
}) {
  const getStateConfig = (state: string) => {
    switch (state) {
      case 'frustrated':
        return { emoji: '😤', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'confused':
        return { emoji: '🤔', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'focused':
        return { emoji: '🎯', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'overwhelmed':
        return { emoji: '😰', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      case 'flow':
        return { emoji: '🚀', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      default:
        return { emoji: '🤷', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  const config = getStateConfig(analysis.emotionalState);

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border ${config.color} text-sm`}>
      <span>{config.emoji}</span>
      <span className="capitalize">{analysis.emotionalState}</span>
      <span className="text-xs opacity-70">{analysis.intensity}/10</span>
    </div>
  );
}

/**
 * Loading skeleton for emotional state
 */
export function EmotionalStateLoading() {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 animate-pulse">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 bg-gray-700 rounded-lg" />
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-16" />
        </div>
      </div>
      <div className="h-2 bg-gray-700 rounded-full mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-700 rounded w-3/4" />
      </div>
    </div>
  );
}
