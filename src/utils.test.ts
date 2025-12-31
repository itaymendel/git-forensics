import { describe, it, expect } from 'vitest';
import { withTopN } from './utils.js';

describe('withTopN', () => {
  it('returns all items when topN is falsy (undefined, 0, negative)', () => {
    expect(withTopN([1, 2, 3])).toEqual([1, 2, 3]);
    expect(withTopN([1, 2, 3], 0)).toEqual([1, 2, 3]);
    expect(withTopN([1, 2, 3], -5)).toEqual([1, 2, 3]);
  });

  it('returns first N items when topN is positive', () => {
    expect(withTopN([1, 2, 3, 4, 5], 2)).toEqual([1, 2]);
  });

  it('returns all items when topN exceeds array length', () => {
    expect(withTopN([1, 2], 10)).toEqual([1, 2]);
  });
});
