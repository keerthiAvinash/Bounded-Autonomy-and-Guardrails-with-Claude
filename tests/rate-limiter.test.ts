import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows a request under the concurrent limit to proceed immediately', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 2, maxRequestsPerMinute: 50, maxTokensPerMinute: 100000 });
    expect(limiter.canProceed(100)).toBe(true);
    await limiter.acquire(100);
    expect(limiter.getStatus().activeRequests).toBe(1);
  });

  it('release() decrements activeRequests and never goes below zero', () => {
    const limiter = new RateLimiter();
    limiter.release();
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('canProceed returns false once maxConcurrent is reached, true again after release', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, maxRequestsPerMinute: 50, maxTokensPerMinute: 100000 });
    await limiter.acquire(100);
    expect(limiter.canProceed(100)).toBe(false);
    limiter.release();
    expect(limiter.canProceed(100)).toBe(true);
  });

  it('canProceed returns false once maxRequestsPerMinute is reached', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 2, maxTokensPerMinute: 100000 });
    await limiter.acquire(10);
    limiter.release();
    await limiter.acquire(10);
    limiter.release();
    expect(limiter.canProceed(10)).toBe(false);
  });

  it('canProceed returns false when the token budget would be exceeded', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 50, maxTokensPerMinute: 150 });
    await limiter.acquire(100);
    limiter.release();
    expect(limiter.canProceed(100)).toBe(false);
    expect(limiter.canProceed(40)).toBe(true);
  });

  it('getStatus reports correct in-window requests, tokens, and availability', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 5, maxTokensPerMinute: 1000 });
    await limiter.acquire(200);
    limiter.release();
    const status = limiter.getStatus();
    expect(status.requestsInWindow).toBe(1);
    expect(status.tokensInWindow).toBe(200);
    expect(status.availableRequests).toBe(4);
    expect(status.availableTokens).toBe(800);
  });

  it('release(actualTokens) updates the token count of the most recent request', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 10, maxRequestsPerMinute: 50, maxTokensPerMinute: 100000 });
    await limiter.acquire(1000);
    limiter.release(250);
    expect(limiter.getStatus().tokensInWindow).toBe(250);
  });

  it('acquire() makes a second caller wait for a free slot when maxConcurrent is reached', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1, maxRequestsPerMinute: 50, maxTokensPerMinute: 100000 });
    await limiter.acquire(10);

    let secondAcquired = false;
    const second = limiter.acquire(10).then(() => {
      secondAcquired = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(secondAcquired).toBe(false);

    limiter.release();
    await second;
    expect(secondAcquired).toBe(true);
  });
});
