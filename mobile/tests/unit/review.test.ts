import { describe, it, expect } from 'vitest';
import { shouldRequestReview } from '../../src/lib/client/review';

describe('shouldRequestReview', () => {
  it('does not trigger on the first save', () => {
    expect(shouldRequestReview(1)).toBe(false);
  });

  it('triggers on the second save', () => {
    expect(shouldRequestReview(2)).toBe(true);
  });

  it('then triggers every 5 saves (7, 12, 17...)', () => {
    expect(shouldRequestReview(7)).toBe(true);
    expect(shouldRequestReview(12)).toBe(true);
    expect(shouldRequestReview(17)).toBe(true);
  });

  it('stays quiet between trigger points', () => {
    for (const n of [3, 4, 5, 6, 8, 9, 10, 11, 13]) {
      expect(shouldRequestReview(n)).toBe(false);
    }
  });

  it('handles zero and negative defensively', () => {
    expect(shouldRequestReview(0)).toBe(false);
    expect(shouldRequestReview(-3)).toBe(false);
  });
});
