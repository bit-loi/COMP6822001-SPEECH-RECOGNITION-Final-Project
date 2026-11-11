import { GeminiAPIError, RateLimitError } from './types';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
export const calculateBackoffDelay = (
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number => {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
};

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a retryable error
      if (error instanceof GeminiAPIError && !error.retryable) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, config);
      console.warn(
        `Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`,
        error
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / this.refillInterval) * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to consume a token
   * 
   * @returns true if token was consumed, false if rate limit exceeded
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available and consume it
   */
  async consume(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time
    const tokensNeeded = 1 - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * this.refillInterval;

    await sleep(waitTime);
    this.tokens = 0; // Consume the token
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Create a rate-limited version of a function
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  rateLimiter: RateLimiter
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!rateLimiter.tryConsume()) {
      throw new RateLimitError('Rate limit exceeded. Please try again later.');
    }
    return await fn(...args);
  }) as T;
}

/**
 * Graceful degradation wrapper
 * Returns a fallback value if the function fails after all retries
 */
export async function withGracefulDegradation<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await retryWithBackoff(fn);
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    console.error('Function failed after retries, using fallback:', error);
    return fallback;
  }
}
