# Gemini Service - Usage Examples

## Quick Start

```typescript
import { getGeminiService } from '@/lib/gemini';

// Get service instance (uses NEXT_PUBLIC_GEMINI_API_KEY from env)
const gemini = getGeminiService();
```

## 1. Analyze Emotional State

Detect developer's emotional state from their code and messages:

```typescript
import { getGeminiService } from '@/lib/gemini';

const gemini = getGeminiService();

// Analyze a frustrated developer
const analysis = await gemini.analyzeEmotionalState({
  code: `
    const data = fetch('/api/users');
    console.log(data); // undefined???
    
    // tried this too
    const data2 = await fetch('/api/users');
    // still not working!
  `,
  userMessage: "Why isn't this working? I've tried everything!",
  previousAttempts: [
    "fetch('/api/users').then(res => console.log(res))",
    "const data = fetch('/api/users'); data.json()",
  ],
  timeSpent: 45, // minutes
});

console.log(analysis);
// {
//   emotionalState: 'frustrated',
//   intensity: 7,
//   cognitiveLoad: 75,
//   indicators: [
//     'Multiple similar attempts with same error',
//     'Expressing frustration in comments',
//     'Extended time on single problem'
//   ],
//   recommendedAction: 'Take a 5-minute break, then let\'s review async/await basics together'
// }
```

### Different Emotional States

```typescript
// Confused state
const confused = await gemini.analyzeEmotionalState({
  code: 'const x = [1,2,3]; x.map()',
  userMessage: 'What does map do exactly?',
});
// emotionalState: 'confused'

// Flow state
const flow = await gemini.analyzeEmotionalState({
  code: `
    // Implemented user auth ✓
    // Added validation ✓
    // Now adding rate limiting
    const limiter = rateLimit({ windowMs: 15 * 60 * 1000 });
  `,
  userMessage: 'Adding rate limiting to complete the security layer',
});
// emotionalState: 'flow'

// Overwhelmed state
const overwhelmed = await gemini.analyzeEmotionalState({
  code: 'lots of complex code with many errors...',
  userMessage: 'There are so many errors I don\'t know where to start',
});
// emotionalState: 'overwhelmed'
```

## 2. Generate Adaptive Hints

Get personalized hints based on emotional state and neurodivergent preferences:

```typescript
import { getGeminiService } from '@/lib/gemini';

const gemini = getGeminiService();

// For a developer with ADHD who is frustrated
const hint = await gemini.generateAdaptiveHint({
  code: `
    function calculateTotal(items) {
      let total = 0;
      for (let i = 0; i < items.length; i++) {
        total += items[i].price;
      }
      return total;
    }
  `,
  problem: 'How can I make this more functional?',
  emotionalState: {
    emotionalState: 'frustrated',
    intensity: 6,
    cognitiveLoad: 70,
    indicators: ['Stuck on same problem'],
    recommendedAction: 'Take a break',
  },
  userPreferences: {
    adhd: true,
    autism: false,
    dyslexia: false,
  },
});

console.log(hint);
// {
//   explanation: "Let's use reduce() - it's perfect for summing values! Here's the pattern...",
//   codeExample: "const total = items.reduce((sum, item) => sum + item.price, 0);",
//   nextSteps: [
//     { step: "Replace the for loop with reduce()", estimatedTime: 5 },
//     { step: "Test with sample data", estimatedTime: 3 },
//     { step: "Add error handling for missing prices", estimatedTime: 7 }
//   ],
//   difficulty: "simplified"
// }
```

### Different Preference Combinations

```typescript
// Autism preference - explicit and structured
const autismHint = await gemini.generateAdaptiveHint({
  code: 'async function getData() { /* ... */ }',
  problem: 'When should I use async/await vs promises?',
  userPreferences: {
    adhd: false,
    autism: true,
    dyslexia: false,
  },
});
// Returns: Very explicit rules, concrete examples, clear success criteria

// Dyslexia preference - simple language
const dyslexiaHint = await gemini.generateAdaptiveHint({
  code: 'const memoizedCallback = useCallback(() => {}, []);',
  problem: 'What is memoization?',
  userPreferences: {
    adhd: false,
    autism: false,
    dyslexia: true,
  },
});
// Returns: Plain language, no jargon, short sentences

// Combined preferences
const combinedHint = await gemini.generateAdaptiveHint({
  code: '/* complex code */',
  problem: 'Help me refactor this',
  userPreferences: {
    adhd: true,
    autism: true,
    dyslexia: true,
  },
});
// Returns: Short, clear, explicit, with time estimates
```

## 3. Break Down Tasks

Split complex tasks into manageable subtasks:

```typescript
import { getGeminiService } from '@/lib/gemini';

const gemini = getGeminiService();

// Break down a task for someone with ADHD
const breakdown = await gemini.breakdownTask({
  task: 'Build a REST API with user authentication and rate limiting',
  preferences: {
    adhd: true,
    autism: false,
    dyslexia: false,
  },
});

console.log(breakdown);
// {
//   subtasks: [
//     {
//       id: "task-1",
//       description: "Set up Express server with basic routing",
//       estimatedMinutes: 15,
//       dependencies: [],
//       complexity: "low"
//     },
//     {
//       id: "task-2",
//       description: "Create user model and database schema",
//       estimatedMinutes: 20,
//       dependencies: ["task-1"],
//       complexity: "medium"
//     },
//     {
//       id: "task-3",
//       description: "Implement user registration endpoint",
//       estimatedMinutes: 25,
//       dependencies: ["task-2"],
//       complexity: "medium"
//     },
//     {
//       id: "task-4",
//       description: "Add JWT token generation",
//       estimatedMinutes: 20,
//       dependencies: ["task-3"],
//       complexity: "medium"
//     },
//     {
//       id: "task-5",
//       description: "Implement login endpoint with token",
//       estimatedMinutes: 15,
//       dependencies: ["task-4"],
//       complexity: "low"
//     },
//     {
//       id: "task-6",
//       description: "Add rate limiting middleware",
//       estimatedMinutes: 15,
//       dependencies: ["task-1"],
//       complexity: "low"
//     },
//     {
//       id: "task-7",
//       description: "Test all endpoints with Postman",
//       estimatedMinutes: 20,
//       dependencies: ["task-5", "task-6"],
//       complexity: "low"
//     }
//   ],
//   totalEstimate: 130
// }

// Use the breakdown
breakdown.subtasks.forEach(task => {
  console.log(`📋 ${task.description}`);
  console.log(`   ⏱️  ${task.estimatedMinutes} minutes`);
  console.log(`   🔗 Depends on: ${task.dependencies.join(', ') || 'none'}`);
  console.log(`   📊 Complexity: ${task.complexity}`);
  console.log('');
});
```

## Error Handling

```typescript
import { 
  getGeminiService, 
  GeminiAPIError, 
  RateLimitError, 
  ValidationError 
} from '@/lib/gemini';

const gemini = getGeminiService();

try {
  const analysis = await gemini.analyzeEmotionalState({
    code: 'const x = 1;',
    userMessage: 'Help me',
  });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded. Please wait a moment.');
    // Show user-friendly message
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
    // Fix input and retry
  } else if (error instanceof GeminiAPIError) {
    console.error('API error:', error.message);
    if (error.retryable) {
      // Retry logic is already built-in
      console.log('Will retry automatically...');
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Rate Limit Status

```typescript
const gemini = getGeminiService();

// Check rate limit status
const status = gemini.getRateLimitStatus();
console.log(`Tokens available: ${status.tokens}/${status.maxTokens}`);

// The service automatically handles rate limiting
// Requests will wait if rate limit is exceeded
```

## React Hook Example

```typescript
// hooks/useGeminiAnalysis.ts
import { useState } from 'react';
import { getGeminiService, EmotionalAnalysis } from '@/lib/gemini';

export function useGeminiAnalysis() {
  const [analysis, setAnalysis] = useState<EmotionalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyze = async (code: string, message: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const gemini = getGeminiService();
      const result = await gemini.analyzeEmotionalState({
        code,
        userMessage: message,
      });
      setAnalysis(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { analysis, loading, error, analyze };
}

// Usage in component
function CodeEditor() {
  const { analysis, loading, analyze } = useGeminiAnalysis();

  const handleAnalyze = async () => {
    const result = await analyze(code, userMessage);
    
    if (result.emotionalState === 'frustrated') {
      // Show encouragement
      showEncouragement(result.recommendedAction);
    }
  };

  return (
    <div>
      {analysis && (
        <div className="emotional-state">
          State: {analysis.emotionalState}
          Intensity: {analysis.intensity}/10
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Cache Results

```typescript
const cache = new Map<string, EmotionalAnalysis>();

async function getCachedAnalysis(code: string, message: string) {
  const key = `${code}-${message}`;
  
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  
  const gemini = getGeminiService();
  const result = await gemini.analyzeEmotionalState({ code, userMessage: message });
  cache.set(key, result);
  
  return result;
}
```

### 2. Debounce API Calls

```typescript
import { debounce } from 'lodash';

const debouncedAnalyze = debounce(async (code: string, message: string) => {
  const gemini = getGeminiService();
  return await gemini.analyzeEmotionalState({ code, userMessage: message });
}, 1000);
```

### 3. Progressive Enhancement

```typescript
async function getHintWithFallback(context: any) {
  const gemini = getGeminiService();
  
  try {
    return await gemini.generateAdaptiveHint(context);
  } catch (error) {
    // Fallback to basic hint
    return {
      explanation: "Try breaking the problem into smaller steps.",
      nextSteps: [
        { step: "Identify the core issue", estimatedTime: 5 },
        { step: "Research the solution", estimatedTime: 10 },
        { step: "Implement and test", estimatedTime: 15 },
      ],
      difficulty: "standard" as const,
    };
  }
}
```

## Testing

```typescript
import { GeminiService, resetGeminiService } from '@/lib/gemini';

describe('GeminiService', () => {
  beforeEach(() => {
    resetGeminiService();
  });

  it('should detect frustration', async () => {
    const service = new GeminiService(process.env.GEMINI_API_KEY!);
    
    const result = await service.analyzeEmotionalState({
      code: 'const x = 1; const x = 2; // why???',
      userMessage: 'This keeps failing!',
    });
    
    expect(result.emotionalState).toBe('frustrated');
    expect(result.intensity).toBeGreaterThan(5);
  });
});
```
