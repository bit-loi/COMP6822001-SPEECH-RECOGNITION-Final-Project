# AmbatuCode Gemini Service

A robust, production-ready AI service for emotional analysis and adaptive learning, built for developers coding with limited hand mobility or energy.

## 🎯 Features

### 1. **Emotional State Analysis**
- Detects developer emotional states: frustrated, confused, focused, overwhelmed, flow
- Considers focus patterns (deep sessions, task switching, fatigue)
- Provides cognitive load metrics (0-100%)
- Offers actionable recommendations

### 2. **Adaptive Hints**
- Adjusts explanation style based on emotional state
- Customizes for low energy (time estimates, small chunks)
- Adapts for explicit-step needs (explicit examples, no ambiguity)
- Simplifies for plain-language needs (plain language, short sentences)
- Includes code examples and step-by-step guides

### 3. **Task Breakdown**
- Splits complex tasks into manageable subtasks
- Provides realistic time estimates
- Tracks dependencies between tasks
- Rates complexity levels
- Optimizes for low-effort, interruption-friendly work patterns

### 4. **Robust Error Handling**
- Exponential backoff retry logic
- Rate limiting with token bucket algorithm
- Graceful degradation on failures
- Type-safe error responses
- User-friendly error messages

## 📁 File Structure

```
src/lib/gemini/
├── index.ts              # Main exports
├── service.ts            # Core Gemini service
├── types.ts              # TypeScript types & Zod schemas
├── utils.ts              # Utilities (retry, rate limiting)
├── EXAMPLES.md           # Usage examples
└── README.md             # This file

src/hooks/
└── useGemini.ts          # React hooks

src/components/gemini/
├── index.ts              # Component exports
├── EmotionalStateIndicator.tsx
├── AdaptiveHintCard.tsx
└── TaskBreakdownView.tsx
```

## 🚀 Quick Start

### Installation

Dependencies are already installed:
- `@google/generative-ai` - Google Gemini SDK
- `zod` - Runtime validation

### Setup

1. **Get Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
   ```

2. **Import and Use**
   ```typescript
   import { getGeminiService } from '@/lib/gemini';
   
   const gemini = getGeminiService();
   ```

## 📖 Usage Examples

### Analyze Emotional State

```typescript
import { getGeminiService } from '@/lib/gemini';

const gemini = getGeminiService();

const analysis = await gemini.analyzeEmotionalState({
  code: `
    const data = fetch('/api/users');
    console.log(data); // undefined???
  `,
  userMessage: "Why isn't this working?",
  previousAttempts: ["tried await", "tried .then()"],
  timeSpent: 30, // minutes
});

console.log(analysis);
// {
//   emotionalState: 'frustrated',
//   intensity: 7,
//   cognitiveLoad: 75,
//   indicators: ['Multiple failed attempts', 'Expressing frustration'],
//   recommendedAction: 'Take a 5-minute break, then review async basics'
// }
```

### Generate Adaptive Hint

```typescript
const hint = await gemini.generateAdaptiveHint({
  code: 'function add(a, b) { return a + b }',
  problem: 'How do I add TypeScript types?',
  emotionalState: analysis, // from previous step
  userPreferences: {
    lowEnergy: true,      // Time estimates, small steps
    explicitSteps: false,
    plainLanguage: false,
  },
});

console.log(hint.explanation);
console.log(hint.codeExample);
hint.nextSteps.forEach(step => {
  console.log(`${step.step} - ${step.estimatedTime} min`);
});
```

### Break Down Task

```typescript
const breakdown = await gemini.breakdownTask({
  task: 'Build a REST API with authentication',
  preferences: {
    lowEnergy: true,
    explicitSteps: false,
    plainLanguage: false,
  },
});

breakdown.subtasks.forEach(task => {
  console.log(`${task.description} - ${task.estimatedMinutes} min`);
  console.log(`Dependencies: ${task.dependencies.join(', ')}`);
  console.log(`Complexity: ${task.complexity}`);
});
```

## 🎨 React Components

### Emotional State Indicator

```tsx
import { EmotionalStateIndicator } from '@/components/gemini';
import { useEmotionalAnalysis } from '@/hooks/useGemini';

function CodeEditor() {
  const { analysis, analyze } = useEmotionalAnalysis();
  
  return (
    <div>
      {analysis && <EmotionalStateIndicator analysis={analysis} />}
    </div>
  );
}
```

### Adaptive Hint Card

```tsx
import { AdaptiveHintCard } from '@/components/gemini';
import { useAdaptiveHint } from '@/hooks/useGemini';

function HintPanel() {
  const { hint, generateHint } = useAdaptiveHint();
  
  return (
    <div>
      {hint && (
        <AdaptiveHintCard 
          hint={hint}
          onStepComplete={(index) => console.log(`Step ${index} done!`)}
        />
      )}
    </div>
  );
}
```

### Task Breakdown View

```tsx
import { TaskBreakdownView } from '@/components/gemini';
import { useTaskBreakdown } from '@/hooks/useGemini';

function TaskPlanner() {
  const { breakdown, breakdownTask } = useTaskBreakdown();
  
  return (
    <div>
      {breakdown && (
        <TaskBreakdownView 
          breakdown={breakdown}
          onTaskComplete={(id) => console.log(`Task ${id} completed!`)}
        />
      )}
    </div>
  );
}
```

## 🎣 React Hooks

### useEmotionalAnalysis

```tsx
const { analysis, loading, error, analyze, reset } = useEmotionalAnalysis();

await analyze(code, message, {
  previousAttempts: ['attempt 1', 'attempt 2'],
  timeSpent: 45,
});
```

### useAdaptiveHint

```tsx
const { hint, loading, error, generateHint, reset } = useAdaptiveHint();

await generateHint({
  code,
  problem,
  emotionalState,
  userPreferences: { lowEnergy: true, explicitSteps: false, plainLanguage: false },
});
```

### useTaskBreakdown

```tsx
const { breakdown, loading, error, breakdownTask, reset } = useTaskBreakdown();

await breakdownTask({
  task: 'Build feature X',
  preferences: { lowEnergy: true, explicitSteps: false, plainLanguage: false },
});
```

### useGemini (Combined)

```tsx
const gemini = useGemini();

// All features in one hook
const analysis = await gemini.analyzeEmotion(code, message);
const hint = await gemini.getHint({ code, problem, emotionalState, userPreferences });
const breakdown = await gemini.breakdownTask({ task, preferences });

// Check rate limit
console.log(gemini.rateLimitStatus); // { tokens: 45, maxTokens: 60 }
console.log(gemini.isRateLimited); // false

// Global states
console.log(gemini.isLoading); // true if any request is loading
console.log(gemini.hasError); // true if any request has error
```

## 🛡️ Error Handling

### Automatic Retry

The service automatically retries failed requests with exponential backoff:

```typescript
// Automatically retries up to 3 times
const analysis = await gemini.analyzeEmotionalState({ code, userMessage });
```

### Manual Error Handling

```typescript
import { 
  GeminiAPIError, 
  RateLimitError, 
  ValidationError 
} from '@/lib/gemini';

try {
  const analysis = await gemini.analyzeEmotionalState({ code, userMessage });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  } else if (error instanceof GeminiAPIError) {
    console.error('API error:', error.message);
    console.log('Retryable:', error.retryable);
  }
}
```

### Using Error Handler Hook

```tsx
import { useGeminiErrorHandler } from '@/hooks/useGemini';

const { getErrorMessage, getErrorSeverity, shouldRetry } = useGeminiErrorHandler();

try {
  await analyze(code, message);
} catch (error) {
  const message = getErrorMessage(error);
  const severity = getErrorSeverity(error); // 'error' | 'warning' | 'info'
  const canRetry = shouldRetry(error);
  
  showToast(message, severity);
}
```

## ⚙️ Configuration

### Rate Limiting

Default: 60 requests per minute

```typescript
import { GeminiService } from '@/lib/gemini';

// Custom rate limit
const gemini = new GeminiService(apiKey, 30); // 30 requests/min
```

### Retry Configuration

```typescript
import { retryWithBackoff, DEFAULT_RETRY_CONFIG } from '@/lib/gemini';

const customConfig = {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 20000,
  backoffMultiplier: 2,
};

await retryWithBackoff(async () => {
  // your function
}, customConfig);
```

## 🧪 Testing

```typescript
import { GeminiService, resetGeminiService } from '@/lib/gemini';

describe('GeminiService', () => {
  beforeEach(() => {
    resetGeminiService(); // Reset singleton
  });

  it('should analyze emotional state', async () => {
    const service = new GeminiService(process.env.GEMINI_API_KEY!);
    
    const result = await service.analyzeEmotionalState({
      code: 'const x = 1;',
      userMessage: 'Help!',
    });
    
    expect(result.emotionalState).toBeDefined();
  });
});
```

## 📊 Type Safety

All functions use Zod for runtime validation:

```typescript
import { 
  EmotionalAnalysisSchema,
  AdaptiveHintSchema,
  TaskBreakdownSchema 
} from '@/lib/gemini';

// Validate at runtime
const validated = EmotionalAnalysisSchema.parse(data);
```

## 🎯 Best Practices

### 1. Cache Results

```typescript
const cache = new Map();

async function getCachedAnalysis(code: string, message: string) {
  const key = `${code}-${message}`;
  if (cache.has(key)) return cache.get(key);
  
  const result = await gemini.analyzeEmotionalState({ code, userMessage: message });
  cache.set(key, result);
  return result;
}
```

### 2. Debounce API Calls

```typescript
import { debounce } from 'lodash';

const debouncedAnalyze = debounce(async (code, message) => {
  return await gemini.analyzeEmotionalState({ code, userMessage: message });
}, 1000);
```

### 3. Progressive Enhancement

```typescript
async function getHintWithFallback(context: any) {
  try {
    return await gemini.generateAdaptiveHint(context);
  } catch (error) {
    // Fallback to basic hint
    return {
      explanation: "Try breaking the problem into smaller steps.",
      nextSteps: [{ step: "Start simple", estimatedTime: 10 }],
      difficulty: "standard" as const,
    };
  }
}
```

## 🔍 Debugging

### Check Rate Limit Status

```typescript
const status = gemini.getRateLimitStatus();
console.log(`Tokens: ${status.tokens}/${status.maxTokens}`);
```

### Enable Verbose Logging

The service logs warnings and errors to console automatically.

## 📚 Additional Resources

- [EXAMPLES.md](./EXAMPLES.md) - Comprehensive usage examples
- [Google Gemini Docs](https://ai.google.dev/docs)
- [Zod Documentation](https://zod.dev/)

## 🤝 Contributing

When adding new features:
1. Add types to `types.ts`
2. Add Zod schemas for validation
3. Update service methods in `service.ts`
4. Create React hooks in `useGemini.ts`
5. Build UI components in `components/gemini/`
6. Add examples to `EXAMPLES.md`

## 📝 License

Part of the AmbatuCode project.

---

**Built for developers whose hands need a break**
