import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  withTimeout,
  ReviewError,
  ErrorCodes,
  isReviewError,
  formatError,
} from '../src/utils/error-handler.js';

describe('withRetry', () => {
  it('returns the result immediately on success (no retry needed)', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 5);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary failure');
      return 'success';
    });
    const result = await withRetry(fn, 5, 5);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws ReviewError with RETRY_EXHAUSTED after all retries fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 2, 5)).rejects.toMatchObject({
      code: ErrorCodes.RETRY_EXHAUSTED,
    });
    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('withTimeout', () => {
  it('resolves normally when the function completes before the timeout', async () => {
    const fn = () => new Promise((resolve) => setTimeout(() => resolve('done'), 10));
    const result = await withTimeout(fn, 200);
    expect(result).toBe('done');
  });

  it('rejects with AGENT_TIMEOUT when the function takes too long', async () => {
    const fn = () => new Promise((resolve) => setTimeout(() => resolve('too late'), 300));
    await expect(withTimeout(fn, 20, 'took too long')).rejects.toMatchObject({
      code: ErrorCodes.AGENT_TIMEOUT,
    });
  });
});

describe('isReviewError / formatError', () => {
  it('identifies ReviewError instances correctly', () => {
    const err = new ReviewError('bad', ErrorCodes.VALIDATION_FAILED);
    expect(isReviewError(err)).toBe(true);
    expect(isReviewError(new Error('plain'))).toBe(false);
    expect(isReviewError('just a string')).toBe(false);
  });

  it('formats a ReviewError with its error code prefix', () => {
    const err = new ReviewError('bad thing happened', ErrorCodes.AGENT_TIMEOUT);
    expect(formatError(err)).toBe('[AGENT_TIMEOUT] bad thing happened');
  });

  it('formats a plain Error and non-Error values', () => {
    expect(formatError(new Error('oops'))).toBe('oops');
    expect(formatError('a string error')).toBe('a string error');
  });
});
