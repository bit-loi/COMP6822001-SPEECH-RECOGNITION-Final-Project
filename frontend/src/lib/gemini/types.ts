import { z } from 'zod';

/**
 * Emotional states that can be detected from user behavior
 */
export const EmotionalStateEnum = z.enum([
  'frustrated',
  'confused',
  'focused',
  'overwhelmed',
  'flow',
]);

export type EmotionalState = z.infer<typeof EmotionalStateEnum>;

/**
 * User preferences for accessibility and communication adaptations
 */
export const UserPreferencesSchema = z.object({
  lowEnergy: z.boolean().default(false),
  explicitSteps: z.boolean().default(false),
  plainLanguage: z.boolean().default(false),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Result of emotional state analysis
 */
export const EmotionalAnalysisSchema = z.object({
  emotionalState: EmotionalStateEnum,
  intensity: z.number().min(0).max(10),
  cognitiveLoad: z.number().min(0).max(100),
  indicators: z.array(z.string()),
  recommendedAction: z.string(),
});

export type EmotionalAnalysis = z.infer<typeof EmotionalAnalysisSchema>;

/**
 * Difficulty level for explanations
 */
export const DifficultyLevelEnum = z.enum(['simplified', 'standard', 'detailed']);

export type DifficultyLevel = z.infer<typeof DifficultyLevelEnum>;

/**
 * Next step in a learning path
 */
export const NextStepSchema = z.object({
  step: z.string(),
  estimatedTime: z.number().min(0), // in minutes
});

export type NextStep = z.infer<typeof NextStepSchema>;

/**
 * Adaptive hint generated for the user
 */
export const AdaptiveHintSchema = z.object({
  explanation: z.string(),
  codeExample: z.string().optional(),
  nextSteps: z.array(NextStepSchema),
  difficulty: DifficultyLevelEnum,
});

export type AdaptiveHint = z.infer<typeof AdaptiveHintSchema>;

/**
 * Task complexity level
 */
export const ComplexityEnum = z.enum(['low', 'medium', 'high']);

export type Complexity = z.infer<typeof ComplexityEnum>;

/**
 * A subtask in a task breakdown
 */
export const SubtaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  estimatedMinutes: z.number().min(0),
  dependencies: z.array(z.string()),
  complexity: ComplexityEnum,
});

export type Subtask = z.infer<typeof SubtaskSchema>;

/**
 * Task breakdown result
 */
export const TaskBreakdownSchema = z.object({
  subtasks: z.array(SubtaskSchema),
  totalEstimate: z.number().min(0),
});

export type TaskBreakdown = z.infer<typeof TaskBreakdownSchema>;

/**
 * Input for emotional state analysis
 */
export const AnalyzeEmotionalStateInputSchema = z.object({
  code: z.string(),
  userMessage: z.string(),
  previousAttempts: z.array(z.string()).optional(),
  timeSpent: z.number().optional(), // in minutes
});

export type AnalyzeEmotionalStateInput = z.infer<typeof AnalyzeEmotionalStateInputSchema>;

/**
 * Input for generating adaptive hints
 */
export const GenerateAdaptiveHintInputSchema = z.object({
  code: z.string(),
  problem: z.string(),
  emotionalState: EmotionalAnalysisSchema.optional(),
  userPreferences: UserPreferencesSchema,
  context: z.string().optional(),
});

export type GenerateAdaptiveHintInput = z.infer<typeof GenerateAdaptiveHintInputSchema>;

/**
 * Input for task breakdown
 */
export const BreakdownTaskInputSchema = z.object({
  task: z.string(),
  preferences: UserPreferencesSchema,
  complexity: ComplexityEnum.optional(),
});

export type BreakdownTaskInput = z.infer<typeof BreakdownTaskInputSchema>;

/**
 * API Error types
 */
export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

export class RateLimitError extends GeminiAPIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends GeminiAPIError {
  constructor(message: string) {
    super(message, 400, false);
    this.name = 'ValidationError';
  }
}
