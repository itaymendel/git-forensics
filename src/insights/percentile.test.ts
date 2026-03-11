import { describe, it, expect } from 'vitest';
import {
  percentileRank,
  createPercentileRanker,
  createInvertedPercentileRanker,
} from './percentile.js';

describe('percentileRank', () => {
  it('should return 0 for empty distribution', () => {
    expect(percentileRank(42, [])).toBe(0);
  });

  it('should return 50 for single element equal to value', () => {
    expect(percentileRank(5, [5])).toBe(50);
  });

  it('should return 100 when value is above all elements', () => {
    // 3 below, 0 equal → (3 + 0) / 3 * 100 = 100
    expect(percentileRank(10, [1, 2, 3])).toBe(100);
  });

  it('should return 0 when value is below all elements', () => {
    // 0 below, 0 equal → 0
    expect(percentileRank(0, [1, 2, 3])).toBe(0);
  });

  it('should compute correct percentile with no ties', () => {
    // value=3, dist=[1,2,3,4,5]: 2 below, 1 equal → (2 + 0.5) / 5 * 100 = 50
    expect(percentileRank(3, [1, 2, 3, 4, 5])).toBe(50);
  });

  it('should handle ties using midrank formula', () => {
    // value=3, dist=[1,3,3,3,5]: 1 below, 3 equal → (1 + 1.5) / 5 * 100 = 50
    expect(percentileRank(3, [1, 3, 3, 3, 5])).toBe(50);
  });

  it('should handle all identical values', () => {
    // All same: 0 below, 4 equal → (0 + 2) / 4 * 100 = 50
    expect(percentileRank(5, [5, 5, 5, 5])).toBe(50);
  });

  it('should handle large distribution', () => {
    const dist = Array.from({ length: 100 }, (_, i) => i + 1);
    // value=50: 49 below, 1 equal → (49 + 0.5) / 100 * 100 = 49.5
    expect(percentileRank(50, dist)).toBe(49.5);
    // value=100: 99 below, 1 equal → (99 + 0.5) / 100 * 100 = 99.5
    expect(percentileRank(100, dist)).toBe(99.5);
  });
});

describe('createPercentileRanker', () => {
  it('should create a reusable ranker', () => {
    const rank = createPercentileRanker([10, 20, 30, 40, 50]);
    expect(rank(30)).toBe(50);
    expect(rank(50)).toBe(90);
    expect(rank(10)).toBe(10);
  });

  it('should handle empty values', () => {
    const rank = createPercentileRanker([]);
    expect(rank(42)).toBe(0);
  });
});

describe('createInvertedPercentileRanker', () => {
  it('should give higher percentile to lower values', () => {
    const rank = createInvertedPercentileRanker([0.1, 0.3, 0.5, 0.7, 0.9]);
    // 0.1 is lowest → should have highest percentile
    // 4 above, 1 equal → (4 + 0.5) / 5 * 100 = 90
    expect(rank(0.1)).toBe(90);
    // 0.9 is highest → should have lowest percentile
    // 0 above, 1 equal → (0 + 0.5) / 5 * 100 = 10
    expect(rank(0.9)).toBe(10);
  });

  it('should return 50 for middle value', () => {
    const rank = createInvertedPercentileRanker([0.1, 0.3, 0.5, 0.7, 0.9]);
    // 0.5: 2 above, 1 equal → (2 + 0.5) / 5 * 100 = 50
    expect(rank(0.5)).toBe(50);
  });

  it('should return 0 for empty values', () => {
    const rank = createInvertedPercentileRanker([]);
    expect(rank(0.5)).toBe(0);
  });

  it('should handle all identical values', () => {
    const rank = createInvertedPercentileRanker([0.5, 0.5, 0.5]);
    // 0 above, 3 equal → (0 + 1.5) / 3 * 100 = 50
    expect(rank(0.5)).toBe(50);
  });
});
