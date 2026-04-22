import axios from 'axios';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      let delay = baseDelayMs * Math.pow(2, attempt);

      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        }
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeCount = 0;

  constructor(
    private maxConcurrent: number,
    private delayMs: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          await sleep(this.delayMs);
          const next = this.queue.shift();
          if (next) next();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}
