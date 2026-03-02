import { describe, it, expect, beforeEach } from 'vitest';
import { computeCoupledPairs, createCoupledPair } from './coupled-pairs.js';
import { aggregateCommits } from '../preprocessing/aggregate.js';
import { file, resetCounter, commitsBy, SCENARIOS } from '../__mocks__/commit-log.mock.js';

describe('computeCoupledPairs', () => {
  beforeEach(() => resetCounter());

  // Algorithm: coupling uses AVERAGE formula: coChanges / ((revsA + revsB) / 2) * 100
  it('should calculate coupling using AVERAGE of revisions', () => {
    // If MIN was used: 5 / 5 = 100%. With AVERAGE: 5 / ((15 + 5) / 2) = 50%
    const commits = [
      // frequent.ts appears in 10 commits alone
      ...commitsBy('dev', [file('frequent.ts')], 10),
      // rare.ts appears in 5 commits (all with frequent.ts)
      ...commitsBy('dev', [file('frequent.ts'), file('rare.ts')], 5),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCoupledPairs(stats, { minCoChanges: 1, minCouplingPercent: 0 });

    expect(result.length).toBe(1);
    expect(result[0]!.couplingPercent).toBe(50);
  });

  it('should find files that change together', () => {
    const commits = SCENARIOS.coupledPair();

    const stats = aggregateCommits(commits);
    const result = computeCoupledPairs(stats, { minCoChanges: 3, minCouplingPercent: 50 });

    expect(result.length).toBe(1);
    expect(result[0]!.coChanges).toBe(3);
    expect(result[0]!.couplingPercent).toBe(100);
    expect([result[0]!.file1, result[0]!.file2].toSorted()).toEqual(['api.ts', 'db.ts']);
  });

  it('should filter by minCoChanges', () => {
    const commits = commitsBy('dev', [file('a.ts'), file('b.ts')], 2);

    const stats = aggregateCommits(commits);

    // Only 2 co-changes, but minCoChanges is 3
    expect(computeCoupledPairs(stats, { minCoChanges: 3, minCouplingPercent: 0 })).toEqual([]);

    // With minCoChanges = 2, should find the pair
    expect(computeCoupledPairs(stats, { minCoChanges: 2, minCouplingPercent: 0 }).length).toBe(1);
  });

  it('should filter by minCouplingPercent', () => {
    const commits = [
      // a.ts and b.ts together twice
      ...commitsBy('dev', [file('a.ts'), file('b.ts')], 2),
      // a.ts alone twice more
      ...commitsBy('dev', [file('a.ts')], 2),
    ];

    const stats = aggregateCommits(commits);

    // a.ts: 4 revisions, b.ts: 2 revisions, 2 co-changes
    // Coupling % = 2 / ((4+2)/2) = 2/3 = 67%
    const result = computeCoupledPairs(stats, { minCoChanges: 2, minCouplingPercent: 50 });
    expect(result.length).toBe(1);
    expect(result[0]!.couplingPercent).toBe(67);
  });

  it('should limit results with topN', () => {
    // 3 files always together = 3 pairs (a-b, a-c, b-c)
    const commits = commitsBy('dev', [file('a.ts'), file('b.ts'), file('c.ts')], 3);

    const stats = aggregateCommits(commits);

    expect(computeCoupledPairs(stats, { minCoChanges: 1, minCouplingPercent: 0 }).length).toBe(3);
    expect(
      computeCoupledPairs(stats, { minCoChanges: 1, minCouplingPercent: 0, topN: 2 }).length
    ).toBe(2);
  });

  it('should sort by coupling strength', () => {
    const commits = [
      // Pair a-b: 3 co-changes, 100% coupling (strongest)
      ...commitsBy('dev', [file('a.ts'), file('b.ts')], 3),
      // Pair c-d: 2 co-changes, 100% coupling (weaker due to fewer co-changes)
      ...commitsBy('dev', [file('c.ts'), file('d.ts')], 2),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCoupledPairs(stats, { minCoChanges: 2, minCouplingPercent: 0 });

    expect(result.length).toBe(2);
    // a-b should come first (higher score due to more co-changes)
    expect(result[0]!.file1).toBe('a.ts');
    expect(result[0]!.file2).toBe('b.ts');
    expect(result[1]!.file1).toBe('c.ts');
    expect(result[1]!.file2).toBe('d.ts');
  });
});

describe('createCoupledPair', () => {
  it('creates pair with canonical ordering (file1 < file2)', () => {
    const pair = createCoupledPair('z.ts', 'a.ts', 80, 5, true, true);

    expect(pair).toEqual({
      file1: 'a.ts',
      file2: 'z.ts',
      couplingPercent: 80,
      coChanges: 5,
      file1Exists: true,
      file2Exists: true,
    });
  });

  it('preserves order when already canonical', () => {
    const pair = createCoupledPair('a.ts', 'z.ts', 80, 5, true, false);

    expect(pair.file1).toBe('a.ts');
    expect(pair.file2).toBe('z.ts');
    expect(pair.file1Exists).toBe(true);
    expect(pair.file2Exists).toBe(false);
  });

  it('throws for negative coChanges', () => {
    expect(() => createCoupledPair('a.ts', 'b.ts', 50, -1, true, true)).toThrow(
      'coChanges must be non-negative'
    );
  });

  it('throws for couplingPercent outside 0-100', () => {
    expect(() => createCoupledPair('a.ts', 'b.ts', -1, 5, true, true)).toThrow(
      'couplingPercent must be 0-100'
    );
    expect(() => createCoupledPair('a.ts', 'b.ts', 101, 5, true, true)).toThrow(
      'couplingPercent must be 0-100'
    );
  });

  it('throws for self-coupling (same file)', () => {
    expect(() => createCoupledPair('same.ts', 'same.ts', 50, 5, true, true)).toThrow(
      'A file cannot be coupled with itself: same.ts'
    );
  });
});
