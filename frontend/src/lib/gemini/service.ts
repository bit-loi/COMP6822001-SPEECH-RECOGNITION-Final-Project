import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  EmotionalAnalysis,
  AdaptiveHint,
  TaskBreakdown,
  AnalyzeEmotionalStateInput,
  GenerateAdaptiveHintInput,
  BreakdownTaskInput,
  EmotionalAnalysisSchema,
  AdaptiveHintSchema,
  TaskBreakdownSchema,
  GeminiAPIError,
  ValidationError,
  RateLimitError,
} from './types';
import { RateLimiter, retryWithBackoff, withGracefulDegradation } from './utils';

/**
 * AmbatuCode Gemini Service
 * 
 * A robust service for AI-powered emotional analysis and adaptive learning
 * designed specifically for neurodivergent developers.
 * 
 * Features:
 * - Emotional state detection from code and messages
 * - Adaptive hints based on cognitive state and preferences
 * - Task breakdown with time estimates
 * - Rate limiting and error handling
 * - Graceful degradation
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private rateLimiter: RateLimiter;

  /**
   * Initialize the Gemini service
   * 
   * @param apiKey - Google Gemini API key
   * @param rateLimit - Maximum requests per minute (default: 60)
   */
  constructor(apiKey: string, rateLimit: number = 60) {
    if (!apiKey) {
      throw new ValidationError('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    // Rate limiter: allow rateLimit requests per minute
    this.rateLimiter = new RateLimiter(rateLimit, rateLimit / 60);
  }

  /**
   * Analyze emotional state from user's code and message
   * 
   * Detects patterns indicating:
   * - Frustration: repeated similar attempts, error patterns
   * - Confusion: unclear direction, asking basic questions
   * - Focus: consistent progress, clear goals
   * - Overwhelm: too many errors, complex problems
   * - Flow: smooth progress, minimal errors
   * 
   * Considers neurodivergent patterns like hyperfocus and task switching.
   * 
   * @param input - Code and user message to analyze
   * @returns Emotional analysis with recommendations
   * 
   * @example
   * ```typescript
   * const analysis = await service.analyzeEmotionalState({
   *   code: 'const x = 1; const x = 2; // why isn't this working?',
   *   userMessage: 'I keep getting the same error and I don\'t understand why'
   * });
   * 
   * console.log(analysis.emotionalState); // 'frustrated'
   * console.log(analysis.recommendedAction); // 'Take a short break...'
   * ```
   */
  async analyzeEmotionalState(
    input: AnalyzeEmotionalStateInput
  ): Promise<EmotionalAnalysis> {
    // Validate input
    const validatedInput = input;

    const prompt = this.buildEmotionalAnalysisPrompt(validatedInput);

    const analysis = await retryWithBackoff(async () => {
      if (!this.rateLimiter.tryConsume()) {
        throw new RateLimitError();
      }

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const parsed = JSON.parse(this.extractJSON(text));
        
        // Validate with Zod
        return EmotionalAnalysisSchema.parse(parsed);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new GeminiAPIError('Failed to parse AI response', 500, true);
        }
        throw error;
      }
    });

    return analysis;
  }

  /**
   * Generate adaptive hint based on context and user preferences
   * 
   * Adapts explanation style based on:
   * - Current emotional state (frustrated → shorter, encouraging)
   * - ADHD: time estimates, clear action items, chunked information
   * - Autism: explicit examples, no ambiguity, structured format
   * - Dyslexia: plain language, avoid jargon, clear formatting
   * 
   * @param context - Problem context and user preferences
   * @returns Adaptive hint with code examples and next steps
   * 
   * @example
   * ```typescript
   * const hint = await service.generateAdaptiveHint({
   *   code: 'function add(a, b) { return a + b }',
   *   problem: 'How do I add type safety?',
   *   emotionalState: analysis,
   *   userPreferences: { adhd: true, autism: false, dyslexia: false }
   * });
   * 
   * console.log(hint.explanation);
   * console.log(hint.nextSteps); // Time-estimated steps for ADHD
   * ```
   */
  async generateAdaptiveHint(
    context: GenerateAdaptiveHintInput
  ): Promise<AdaptiveHint> {
    // Validate input
    const validatedContext = context;

    const prompt = this.buildAdaptiveHintPrompt(validatedContext);

    const hint = await retryWithBackoff(async () => {
      if (!this.rateLimiter.tryConsume()) {
        throw new RateLimitError();
      }

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = JSON.parse(this.extractJSON(text));
        return AdaptiveHintSchema.parse(parsed);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new GeminiAPIError('Failed to parse AI response', 500, true);
        }
        throw error;
      }
    });

    return hint;
  }

  /**
   * Break down a complex task into manageable subtasks
   * 
   * Creates a structured breakdown with:
   * - Clear, actionable subtasks
   * - Time estimates for planning
   * - Dependency tracking
   * - Complexity ratings
   * 
   * Adapts to user preferences:
   * - ADHD: smaller chunks, realistic time estimates
   * - Autism: explicit dependencies, clear structure
   * - Dyslexia: simple language, clear descriptions
   * 
   * @param input - Task description and user preferences
   * @returns Task breakdown with subtasks and estimates
   * 
   * @example
   * ```typescript
   * const breakdown = await service.breakdownTask({
   *   task: 'Build a REST API with authentication',
   *   preferences: { adhd: true, autism: false, dyslexia: false }
   * });
   * 
   * breakdown.subtasks.forEach(task => {
   *   console.log(`${task.description} - ${task.estimatedMinutes} min`);
   * });
   * ```
   */
  async breakdownTask(
    input: BreakdownTaskInput
  ): Promise<TaskBreakdown> {
    // Validate input
    const validatedInput = input;

    const prompt = this.buildTaskBreakdownPrompt(validatedInput);

    const breakdown = await retryWithBackoff(async () => {
      if (!this.rateLimiter.tryConsume()) {
        throw new RateLimitError();
      }

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = JSON.parse(this.extractJSON(text));
        return TaskBreakdownSchema.parse(parsed);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new GeminiAPIError('Failed to parse AI response', 500, true);
        }
        throw error;
      }
    });

    return breakdown;
  }

  /**
   * Build prompt for emotional state analysis
   */
  private buildEmotionalAnalysisPrompt(input: AnalyzeEmotionalStateInput): string {
    const previousAttemptsContext = input.previousAttempts
      ? `\n\nPrevious attempts:\n${input.previousAttempts.join('\n')}`
      : '';

    const timeContext = input.timeSpent
      ? `\n\nTime spent on this problem: ${input.timeSpent} minutes`
      : '';

    return `You are an expert at analyzing developer emotional states and cognitive load, with special attention to neurodivergent patterns.

Analyze the following code and user message to determine their emotional state:

CODE:
\`\`\`
${input.code}
\`\`\`

USER MESSAGE:
"${input.userMessage}"
${previousAttemptsContext}${timeContext}

Consider these patterns:
- FRUSTRATION: Repeated similar attempts, expressing annoyance, error patterns, "why won't this work?"
- CONFUSION: Unclear direction, asking basic questions, uncertain language, "I don't understand"
- FOCUSED: Clear goals, methodical approach, specific questions, making progress
- OVERWHELMED: Too many errors, complex problems, scattered attempts, "too much"
- FLOW: Smooth progress, minimal errors, building on previous work, engaged

Also consider neurodivergent patterns:
- Hyperfocus (autism/ADHD): Deep dive into details, losing track of time
- Task switching difficulty (ADHD): Multiple incomplete attempts
- Pattern recognition (autism): Seeking explicit rules and structure

Return a JSON object with this exact structure:
{
  "emotionalState": "frustrated" | "confused" | "focused" | "overwhelmed" | "flow",
  "intensity": <number 0-10>,
  "cognitiveLoad": <number 0-100>,
  "indicators": ["<specific indicator 1>", "<specific indicator 2>", ...],
  "recommendedAction": "<specific actionable recommendation>"
}

Recommended actions should be:
- For frustrated: "Take a 5-minute break, then try a different approach"
- For confused: "Let's break this down step by step"
- For focused: "You're on the right track, keep going"
- For overwhelmed: "Let's simplify - focus on just one thing first"
- For flow: "Great momentum! Consider documenting your approach"

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Build prompt for adaptive hint generation
   */
  private buildAdaptiveHintPrompt(context: GenerateAdaptiveHintInput): string {
    const emotionalContext = context.emotionalState
      ? `\n\nCurrent emotional state: ${context.emotionalState.emotionalState} (intensity: ${context.emotionalState.intensity}/10, cognitive load: ${context.emotionalState.cognitiveLoad}%)`
      : '';

    const preferencesContext = this.buildPreferencesContext(context.userPreferences);

    return `You are an expert programming tutor who adapts explanations for neurodivergent learners.

PROBLEM:
"${context.problem}"

CURRENT CODE:
\`\`\`
${context.code}
\`\`\`
${emotionalContext}

USER PREFERENCES:
${preferencesContext}

${context.context ? `ADDITIONAL CONTEXT:\n${context.context}\n` : ''}

Generate an adaptive hint following these guidelines:

${this.getAdaptiveGuidelines(context)}

Return a JSON object with this exact structure:
{
  "explanation": "<clear, adapted explanation>",
  "codeExample": "<optional code example if helpful>",
  "nextSteps": [
    { "step": "<specific action>", "estimatedTime": <minutes> },
    ...
  ],
  "difficulty": "simplified" | "standard" | "detailed"
}

Guidelines for next steps:
- Each step should be concrete and actionable
- Include realistic time estimates (5-30 minutes per step)
- For ADHD: keep steps small (5-15 min each)
- For autism: be explicit about what success looks like
- Order steps by dependencies

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Build preferences context description
   */
  private buildPreferencesContext(preferences: any): string {
    const prefs = [];
    if (preferences.adhd) prefs.push('ADHD');
    if (preferences.autism) prefs.push('Autism');
    if (preferences.dyslexia) prefs.push('Dyslexia');
    return prefs.length > 0 ? prefs.join(', ') : 'None specified';
  }

  /**
   * Get adaptive guidelines based on context
   */
  private getAdaptiveGuidelines(context: GenerateAdaptiveHintInput): string {
    const guidelines = [];

    // Emotional state adaptations
    if (context.emotionalState) {
      switch (context.emotionalState.emotionalState) {
        case 'frustrated':
          guidelines.push('- Keep explanation SHORT and encouraging');
          guidelines.push('- Focus on ONE clear next step');
          guidelines.push('- Validate their effort');
          break;
        case 'confused':
          guidelines.push('- Use concrete analogies and visual examples');
          guidelines.push('- Break down into very small steps');
          guidelines.push('- Avoid assumptions about prior knowledge');
          break;
        case 'overwhelmed':
          guidelines.push('- Simplify to the absolute minimum');
          guidelines.push('- Focus on just the next immediate action');
          guidelines.push('- Reassure that complexity is normal');
          break;
        case 'focused':
          guidelines.push('- Provide detailed technical explanation');
          guidelines.push('- Include edge cases and best practices');
          guidelines.push('- Encourage exploration');
          break;
        case 'flow':
          guidelines.push('- Be concise, they\'re in the zone');
          guidelines.push('- Provide just enough to keep momentum');
          guidelines.push('- Suggest documentation or testing');
          break;
      }
    }

    // Neurodivergent adaptations
    if (context.userPreferences.adhd) {
      guidelines.push('- Include time estimates for each step (crucial for ADHD)');
      guidelines.push('- Use bullet points and clear structure');
      guidelines.push('- Keep paragraphs short (2-3 sentences max)');
    }

    if (context.userPreferences.autism) {
      guidelines.push('- Be explicit and literal, no ambiguity');
      guidelines.push('- Provide concrete examples, not abstract concepts');
      guidelines.push('- Clearly state what success looks like');
    }

    if (context.userPreferences.dyslexia) {
      guidelines.push('- Use plain language, avoid jargon');
      guidelines.push('- Keep sentences short and simple');
      guidelines.push('- Use consistent terminology');
    }

    return guidelines.join('\n');
  }

  /**
   * Build prompt for task breakdown
   */
  private buildTaskBreakdownPrompt(input: BreakdownTaskInput): string {
    const preferencesContext = this.buildPreferencesContext(input.preferences);
    const complexityHint = input.complexity
      ? `\n\nExpected complexity: ${input.complexity}`
      : '';

    return `You are an expert at breaking down programming tasks into manageable subtasks, with special consideration for neurodivergent developers.

TASK:
"${input.task}"

USER PREFERENCES:
${preferencesContext}${complexityHint}

Break this task down following these guidelines:

${this.getBreakdownGuidelines(input.preferences)}

Return a JSON object with this exact structure:
{
  "subtasks": [
    {
      "id": "task-1",
      "description": "<clear, actionable description>",
      "estimatedMinutes": <realistic time estimate>,
      "dependencies": ["<task-id>", ...],
      "complexity": "low" | "medium" | "high"
    },
    ...
  ],
  "totalEstimate": <sum of all estimated minutes>
}

Guidelines:
- Each subtask should be completable in one sitting (15-60 minutes)
- For ADHD preferences: aim for 15-30 minute chunks
- Dependencies should reference task IDs (empty array if no dependencies)
- Descriptions should be specific and actionable
- Order tasks logically by dependencies

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Get breakdown guidelines based on preferences
   */
  private getBreakdownGuidelines(preferences: any): string {
    const guidelines = [
      '- Create clear, actionable subtasks',
      '- Include realistic time estimates',
      '- Identify dependencies between tasks',
    ];

    if (preferences.adhd) {
      guidelines.push('- Keep subtasks small (15-30 minutes each)');
      guidelines.push('- Provide frequent completion points for dopamine hits');
      guidelines.push('- Be realistic about time estimates (ADHD time blindness)');
    }

    if (preferences.autism) {
      guidelines.push('- Make dependencies explicit and clear');
      guidelines.push('- Use consistent structure for all subtasks');
      guidelines.push('- Define clear success criteria for each task');
    }

    if (preferences.dyslexia) {
      guidelines.push('- Use simple, clear language in descriptions');
      guidelines.push('- Avoid technical jargon where possible');
      guidelines.push('- Keep descriptions concise');
    }

    return guidelines.join('\n');
  }

  /**
   * Extract JSON from AI response that might contain markdown or extra text
   */
  private extractJSON(text: string): string {
    // Try to find JSON in markdown code blocks
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // Try to find JSON in regular code blocks
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object directly
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    // Return as-is and let JSON.parse fail with a clear error
    return text.trim();
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { tokens: number; maxTokens: number } {
    return {
      tokens: Math.floor(this.rateLimiter.getTokenCount()),
      maxTokens: 60, // This should match the constructor parameter
    };
  }
}

/**
 * Create a singleton instance of GeminiService
 */
let geminiServiceInstance: GeminiService | null = null;

/**
 * Get or create the Gemini service instance
 * 
 * @param apiKey - Optional API key (required for first call)
 * @returns GeminiService instance
 */
export function getGeminiService(apiKey?: string): GeminiService {
  if (!geminiServiceInstance) {
    const key = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
      throw new ValidationError(
        'Gemini API key must be provided or set in NEXT_PUBLIC_GEMINI_API_KEY'
      );
    }
    geminiServiceInstance = new GeminiService(key);
  }
  return geminiServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGeminiService(): void {
  geminiServiceInstance = null;
}
