import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/rateLimiter';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('allows the first request', () => {
    const identifier = 'ip-127.0.0.1';
    const result = checkRateLimit(identifier, 60000, 5);
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('allows requests within limit', () => {
    const identifier = 'ip-test-2';
    checkRateLimit(identifier, 60000, 3);
    const result2 = checkRateLimit(identifier, 60000, 3);
    const result3 = checkRateLimit(identifier, 60000, 3);
    
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
    
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('blocks requests exceeding limit', () => {
    const identifier = 'ip-test-3';
    checkRateLimit(identifier, 60000, 2);
    checkRateLimit(identifier, 60000, 2); // Reached max
    
    const blocked = checkRateLimit(identifier, 60000, 2); // Exceeds max
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets limit after window expires', () => {
    const identifier = 'ip-test-4';
    checkRateLimit(identifier, 1000, 1);
    
    // Blocked
    expect(checkRateLimit(identifier, 1000, 1).allowed).toBe(false);
    
    // Fast forward time by 1001ms
    vi.advanceTimersByTime(1001);
    
    // Should be allowed again
    const resetResult = checkRateLimit(identifier, 1000, 1);
    expect(resetResult.allowed).toBe(true);
    expect(resetResult.remaining).toBe(0);
  });

  it('maintains independent limits for different identifiers', () => {
    const userA = 'user-a';
    const userB = 'user-b';
    
    checkRateLimit(userA, 60000, 1);
    
    // User A is blocked
    expect(checkRateLimit(userA, 60000, 1).allowed).toBe(false);
    
    // User B should still be allowed
    expect(checkRateLimit(userB, 60000, 1).allowed).toBe(true);
  });
});
