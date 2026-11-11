'use client';

import { useState, useCallback } from 'react';
import {
  getGeminiService,
  EmotionalAnalysis,
  AdaptiveHint,
  TaskBreakdown,
  GeminiAPIError,
  RateLimitError,
  ValidationError,
} from '@/lib/gemini';

/**
 * Hook for analyzing emotional state
 * 
 * @example
 * ```tsx
 * function CodeEditor() {
 *   const { analysis, loading, error, analyze } = useEmotionalAnalysis();
 *   
 *   const handleAnalyze = async () => {
 *     const result = await analyze(code, userMessage);
 *     if (result.emotionalState === 'frustrated') {
 *       showEncouragement();
 *     }
 *   };
 * }
 * ```
 */
export function useEmotionalAnalysis() {
  const [analysis, setAnalysis] = useState<EmotionalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = useCallback(
    async (
      code: string,
      userMessage: string,
      options?: {
        previousAttempts?: string[];
        timeSpent?: number;
      }
    ): Promise<EmotionalAnalysis> => {
      setLoading(true);
      setError(null);

      try {
        const gemini = getGeminiService();
        const result = await gemini.analyzeEmotionalState({
          code,
          userMessage,
          previousAttempts: options?.previousAttempts,
          timeSpent: options?.timeSpent,
        });

        setAnalysis(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    loading,
    error,
    analyze,
    reset,
  };
}

/**
 * Hook for generating adaptive hints
 * 
 * @example
 * ```tsx
 * function HintPanel() {
 *   const { hint, loading, generateHint } = useAdaptiveHint();
 *   const preferences = { lowEnergy: true, explicitSteps: false, plainLanguage: false };
 *   
 *   const handleGetHint = async () => {
 *     await generateHint({
 *       code,
 *       problem: "How do I fix this?",
 *       userPreferences: preferences,
 *     });
 *   };
 * }
 * ```
 */
export function useAdaptiveHint() {
  const [hint, setHint] = useState<AdaptiveHint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateHint = useCallback(
    async (context: {
      code: string;
      problem: string;
      emotionalState?: EmotionalAnalysis;
      userPreferences: {
        lowEnergy: boolean;
        explicitSteps: boolean;
        plainLanguage: boolean;
      };
      context?: string;
    }): Promise<AdaptiveHint> => {
      setLoading(true);
      setError(null);

      try {
        const gemini = getGeminiService();
        const result = await gemini.generateAdaptiveHint(context);

        setHint(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setHint(null);
    setError(null);
  }, []);

  return {
    hint,
    loading,
    error,
    generateHint,
    reset,
  };
}

/**
 * Hook for breaking down tasks
 * 
 * @example
 * ```tsx
 * function TaskPlanner() {
 *   const { breakdown, loading, breakdownTask } = useTaskBreakdown();
 *   
 *   const handleBreakdown = async () => {
 *     const result = await breakdownTask({
 *       task: "Build a REST API",
 *       preferences: { lowEnergy: true, explicitSteps: false, plainLanguage: false },
 *     });
 *     
 *     result.subtasks.forEach(task => {
 *       console.log(`${task.description} - ${task.estimatedMinutes}min`);
 *     });
 *   };
 * }
 * ```
 */
export function useTaskBreakdown() {
  const [breakdown, setBreakdown] = useState<TaskBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const breakdownTask = useCallback(
    async (input: {
      task: string;
      preferences: {
        lowEnergy: boolean;
        explicitSteps: boolean;
        plainLanguage: boolean;
      };
      complexity?: 'low' | 'medium' | 'high';
    }): Promise<TaskBreakdown> => {
      setLoading(true);
      setError(null);

      try {
        const gemini = getGeminiService();
        const result = await gemini.breakdownTask(input);

        setBreakdown(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setBreakdown(null);
    setError(null);
  }, []);

  return {
    breakdown,
    loading,
    error,
    breakdownTask,
    reset,
  };
}

/**
 * Combined hook for all Gemini features
 * 
 * @example
 * ```tsx
 * function AIAssistant() {
 *   const gemini = useGemini();
 *   
 *   const handleAnalyze = async () => {
 *     const analysis = await gemini.analyzeEmotion(code, message);
 *     const hint = await gemini.getHint({
 *       code,
 *       problem: "Help!",
 *       emotionalState: analysis,
 *       userPreferences: preferences,
 *     });
 *   };
 * }
 * ```
 */
export function useGemini() {
  const emotionalAnalysis = useEmotionalAnalysis();
  const adaptiveHint = useAdaptiveHint();
  const taskBreakdown = useTaskBreakdown();

  const [rateLimitStatus, setRateLimitStatus] = useState({ tokens: 60, maxTokens: 60 });

  const updateRateLimitStatus = useCallback(() => {
    try {
      const gemini = getGeminiService();
      const status = gemini.getRateLimitStatus();
      setRateLimitStatus(status);
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
    }
  }, []);

  const isRateLimited = rateLimitStatus.tokens < 1;

  return {
    // Emotional analysis
    emotionalAnalysis: emotionalAnalysis.analysis,
    analyzeEmotion: emotionalAnalysis.analyze,
    emotionLoading: emotionalAnalysis.loading,
    emotionError: emotionalAnalysis.error,
    resetEmotion: emotionalAnalysis.reset,

    // Adaptive hints
    hint: adaptiveHint.hint,
    getHint: adaptiveHint.generateHint,
    hintLoading: adaptiveHint.loading,
    hintError: adaptiveHint.error,
    resetHint: adaptiveHint.reset,

    // Task breakdown
    taskBreakdown: taskBreakdown.breakdown,
    breakdownTask: taskBreakdown.breakdownTask,
    breakdownLoading: taskBreakdown.loading,
    breakdownError: taskBreakdown.error,
    resetBreakdown: taskBreakdown.reset,

    // Rate limiting
    rateLimitStatus,
    updateRateLimitStatus,
    isRateLimited,

    // Global loading state
    isLoading:
      emotionalAnalysis.loading ||
      adaptiveHint.loading ||
      taskBreakdown.loading,

    // Global error state
    hasError:
      !!emotionalAnalysis.error ||
      !!adaptiveHint.error ||
      !!taskBreakdown.error,

    // Reset all
    resetAll: () => {
      emotionalAnalysis.reset();
      adaptiveHint.reset();
      taskBreakdown.reset();
    },
  };
}

/**
 * Hook for handling Gemini errors with user-friendly messages
 */
export function useGeminiErrorHandler() {
  const getErrorMessage = useCallback((error: Error): string => {
    if (error instanceof RateLimitError) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (error instanceof ValidationError) {
      return `Invalid input: ${error.message}`;
    }

    if (error instanceof GeminiAPIError) {
      if (error.statusCode === 503) {
        return 'AI service is temporarily unavailable. Please try again later.';
      }
      if (error.statusCode === 401) {
        return 'API key is invalid. Please check your configuration.';
      }
      return `AI service error: ${error.message}`;
    }

    return 'An unexpected error occurred. Please try again.';
  }, []);

  const getErrorSeverity = useCallback(
    (error: Error): 'error' | 'warning' | 'info' => {
      if (error instanceof RateLimitError) {
        return 'warning';
      }

      if (error instanceof ValidationError) {
        return 'warning';
      }

      if (error instanceof GeminiAPIError && error.retryable) {
        return 'warning';
      }

      return 'error';
    },
    []
  );

  const shouldRetry = useCallback((error: Error): boolean => {
    if (error instanceof GeminiAPIError) {
      return error.retryable;
    }
    return false;
  }, []);

  return {
    getErrorMessage,
    getErrorSeverity,
    shouldRetry,
  };
}
