/**
 * Rate Limiter with Exponential Backoff
 *
 * Handles Gemini API rate limit errors (429) with automatic retry
 */

export interface RateLimitError {
  isRateLimit: boolean
  retryAfter?: number // seconds
  message: string
}

export class RateLimiter {
  private maxRetries = 3
  private baseDelay = 1000 // 1 second

  /**
   * Parse error to check if it's a rate limit error
   */
  parseError(error: any): RateLimitError {
    const errorMessage = error?.message || String(error)

    // Check for 429 rate limit error
    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      // Extract retryDelay from error message
      const retryMatch = errorMessage.match(/retryDelay['":\s]+(\d+)/)
      const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 24 // Default 24s from API

      return {
        isRateLimit: true,
        retryAfter,
        message: `Rate limit exceeded. Retry after ${retryAfter}s`
      }
    }

    return {
      isRateLimit: false,
      message: errorMessage
    }
  }

  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: {
      onRetry?: (attempt: number, delay: number) => void
    }
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        const rateLimitError = this.parseError(error)

        if (!rateLimitError.isRateLimit) {
          // Not a rate limit error, throw immediately
          throw error
        }

        if (attempt >= this.maxRetries) {
          // Max retries reached
          throw new Error(
            `Rate limit exceeded after ${this.maxRetries} retries. ${rateLimitError.message}`
          )
        }

        // Calculate delay: use API's retryAfter or exponential backoff
        const delay = rateLimitError.retryAfter
          ? rateLimitError.retryAfter * 1000 // Convert to milliseconds
          : this.baseDelay * Math.pow(2, attempt)

        console.log(
          `[RateLimiter] Rate limit hit. Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`
        )

        if (options?.onRetry) {
          options.onRetry(attempt + 1, delay)
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Calculate delay for next request to respect rate limits
   */
  calculateThrottle(requestsPerMinute: number): number {
    // Add 10% buffer to be safe
    const safeRPM = requestsPerMinute * 0.9
    return Math.ceil((60 * 1000) / safeRPM)
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()