/**
 * AmbatuCode Gemini Service
 * 
 * AI-powered emotional analysis and adaptive learning for neurodivergent developers
 */

// Main service
export { GeminiService, getGeminiService, resetGeminiService } from './service';

// Types and schemas
export type {
  EmotionalState,
  EmotionalAnalysis,
  UserPreferences,
  AdaptiveHint,
  DifficultyLevel,
  NextStep,
  TaskBreakdown,
  Subtask,
  Complexity,
  AnalyzeEmotionalStateInput,
  GenerateAdaptiveHintInput,
  BreakdownTaskInput,
} from './types';

export {
  EmotionalStateEnum,
  EmotionalAnalysisSchema,
  UserPreferencesSchema,
  AdaptiveHintSchema,
  DifficultyLevelEnum,
  NextStepSchema,
  TaskBreakdownSchema,
  SubtaskSchema,
  ComplexityEnum,
  AnalyzeEmotionalStateInputSchema,
  GenerateAdaptiveHintInputSchema,
  BreakdownTaskInputSchema,
  GeminiAPIError,
  RateLimitError,
  ValidationError,
} from './types';

// Utilities
export {
  RateLimiter,
  retryWithBackoff,
  withRateLimit,
  withGracefulDegradation,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
} from './utils';

export type { RetryConfig } from './utils';
