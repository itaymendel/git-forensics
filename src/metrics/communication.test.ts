import { describe, it, expect, beforeEach } from 'vitest';
import { computeCommunication } from './communication.js';
import { aggregateCommits } from '../preprocessing/aggregate.js';
import { commit, file, resetCounter, commitsBy, SCENARIOS } from '../__mocks__/commit-log.mock.js';

describe('computeCommunication', () => {
  beforeEach(() => resetCounter());

  // Algorithm: strength = sharedEntities / avgRevisions * 100
  it('should calculate strength using shared entities and average revisions', () => {
    // Alice: 6 revisions, Bob: 4 revisions, 2 shared files → strength = 40%
    const commits = SCENARIOS.sharedFiles();

    const stats = aggregateCommits(commits);
    const result = computeCommunication(stats, { minSharedEntities: 1 });

    expect(result.length).toBe(1);
    expect(result[0]!.sharedEntities).toBe(2);
    expect(result[0]!.strength).toBe(40);
  });

  it('should count unique files touched, not revision count', () => {
    // Alice touches shared.ts 10 times, Bob 1 time → sharedEntities = 1 file
    const commits = [
      ...commitsBy('alice', [file('shared.ts')], 10),
      commit({ author: 'bob', files: [file('shared.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCommunication(stats, { minSharedEntities: 1 });

    expect(result[0]!.sharedEntities).toBe(1);
  });

  it('should find authors with shared files', () => {
    const commits = [
      commit({ author: 'alice', files: [file('shared1.ts'), file('shared2.ts')] }),
      commit({ author: 'bob', files: [file('shared1.ts'), file('shared2.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCommunication(stats, { minSharedEntities: 1 });

    expect(result.length).toBe(1);
    expect(result[0]!.author1).toBe('alice');
    expect(result[0]!.author2).toBe('bob');
    expect(result[0]!.sharedEntities).toBe(2);
  });

  it('should filter by minSharedEntities', () => {
    const commits = [
      commit({ author: 'alice', files: [file('shared.ts')] }),
      commit({ author: 'bob', files: [file('shared.ts')] }),
    ];

    const stats = aggregateCommits(commits);

    // Only 1 shared file, but minSharedEntities is 2 (default)
    expect(computeCommunication(stats)).toEqual([]);
    // With minSharedEntities = 1, should find the pair
    expect(computeCommunication(stats, { minSharedEntities: 1 }).length).toBe(1);
  });

  it('should sort by sharedEntities descending', () => {
    const sharedFiles = [file('f1.ts'), file('f2.ts'), file('f3.ts')];
    const commits = [
      // alice and bob share 3 files
      commit({ author: 'alice', files: sharedFiles }),
      commit({ author: 'bob', files: sharedFiles }),
      // charlie shares only 2 files with alice/bob
      commit({ author: 'charlie', files: [file('f1.ts'), file('f2.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCommunication(stats, { minSharedEntities: 1 });

    expect(result.length).toBe(3);
    expect(result[0]!.sharedEntities).toBe(3); // alice-bob
    expect(result[1]!.sharedEntities).toBe(2);
    expect(result[2]!.sharedEntities).toBe(2);
  });

  it('should return empty array for single author', () => {
    const commits = [commit({ author: 'solo', files: [file('solo.ts', { additions: 100 })] })];

    const stats = aggregateCommits(commits);
    expect(computeCommunication(stats)).toEqual([]);
  });

  it('should respect topN limit', () => {
    const sharedFiles = [file('f1.ts'), file('f2.ts'), file('f3.ts')];
    const commits = ['alice', 'bob', 'charlie', 'diana'].map((author) =>
      commit({ author, files: sharedFiles })
    );

    const stats = aggregateCommits(commits);

    // 4 authors = 6 pairs (4 choose 2)
    expect(computeCommunication(stats, { minSharedEntities: 1 }).length).toBe(6);
    expect(computeCommunication(stats, { minSharedEntities: 1, topN: 2 }).length).toBe(2);
  });

  it('should handle authors with no shared files', () => {
    const commits = [
      commit({ author: 'alice', files: [file('alice-only.ts')] }),
      commit({ author: 'bob', files: [file('bob-only.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    expect(computeCommunication(stats, { minSharedEntities: 1 })).toEqual([]);
  });

  it('should order author names alphabetically in pairs', () => {
    const commits = [
      commit({ author: 'zack', files: [file('shared.ts'), file('shared2.ts')] }),
      commit({ author: 'alice', files: [file('shared.ts'), file('shared2.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeCommunication(stats, { minSharedEntities: 1 });

    expect(result[0]!.author1).toBe('alice');
    expect(result[0]!.author2).toBe('zack');
  });
});
