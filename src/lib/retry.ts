// src/lib/retry.ts
/**
 * Retry Utility for Critical Operations
 * 
 * Provides configurable retry logic with exponential backoff
 * for unreliable operations (network calls, database connections, etc.)
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors, timeouts,rate limits, 5xx errors
    if (!error) return false;
    const status = error.status || error.statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") return true;
    return false;
  },
  onRetry: () => {},
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @example
 * const data = await withRetry(() => fetch('/api/data').then(r => r.json()));
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error)) {
        throw error;
      }
      
      // Call onRetry hook
      opts.onRetry?.(attempt, error, delayMs);
      
      // Wait before retrying
      await sleep(delayMs);
      
      // Exponential backoff
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Retry configuration presets for different scenarios
 */
export const RETRY_PRESETS = {
  // For rapid API polling (game status)
  fast: {
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  },
  
  // For standard API calls
  standard: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },
  
  // For critical operations (database, blockchain)
  critical: {
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  
  // For very slow external services
  slow: {
    maxAttempts: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  },
};

export default { withRetry, RETRY_PRESETS };