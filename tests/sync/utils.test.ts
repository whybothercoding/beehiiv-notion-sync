import { withRetry, RateLimiter } from '../../src/sync/utils';

describe('withRetry', () => {
  it('returns the result on first-attempt success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    expect(await withRetry(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    expect(await withRetry(fn, 3, 0)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows the last error when retries run out', async () => {
    const errors = [new Error('first'), new Error('second'), new Error('third')];
    let i = 0;
    const fn = jest.fn().mockImplementation(() => Promise.reject(errors[i++]));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow('third');
  });
});

describe('RateLimiter', () => {
  it('executes a task and returns its result', async () => {
    const limiter = new RateLimiter(3, 0);
    const result = await limiter.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('propagates errors from the task', async () => {
    const limiter = new RateLimiter(3, 0);
    await expect(
      limiter.execute(() => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom');
  });

  it('never exceeds the concurrency limit', async () => {
    const limiter = new RateLimiter(2, 0);
    let concurrent = 0;
    let maxSeen = 0;
    const task = async () => {
      concurrent++;
      maxSeen = Math.max(maxSeen, concurrent);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      concurrent--;
    };
    await Promise.all([
      limiter.execute(task),
      limiter.execute(task),
      limiter.execute(task),
      limiter.execute(task),
    ]);
    expect(maxSeen).toBeLessThanOrEqual(2);
  });

  it('executes all queued tasks', async () => {
    const limiter = new RateLimiter(2, 0);
    const results: number[] = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) => limiter.execute(() => {
        results.push(n);
        return Promise.resolve(n);
      }))
    );
    expect(results).toHaveLength(5);
  });
});
