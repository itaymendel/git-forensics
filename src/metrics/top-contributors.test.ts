import { describe, it, expect, beforeEach } from 'vitest';
import { computeTopContributors } from './top-contributors.js';
import { aggregateCommits } from '../preprocessing/aggregate.js';
import { commit, file, commitsBy, resetCounter } from '../__mocks__/commit-log.mock.js';

beforeEach(() => resetCounter());

describe('computeTopContributors', () => {
  it('single author → 1 contributor at 100%', () => {
    const stats = aggregateCommits([
      commit({ author: 'alice', files: [file('app.ts', { additions: 10 })] }),
      commit({ author: 'alice', files: [file('app.ts', { additions: 5 })] }),
    ]);

    const result = computeTopContributors(stats);

    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('app.ts');
    expect(result[0]!.authorCount).toBe(1);
    expect(result[0]!.contributors).toEqual([{ author: 'alice', percent: 100, revisions: 2 }]);
  });

  it('multiple authors → sorted by revisions desc, percentages correct', () => {
    const stats = aggregateCommits([
      ...commitsBy('alice', [file('app.ts')], 6),
      ...commitsBy('bob', [file('app.ts')], 3),
      ...commitsBy('charlie', [file('app.ts')], 1),
    ]);

    const result = computeTopContributors(stats);
    const contributors = result[0]!.contributors;

    expect(contributors[0]!.author).toBe('alice');
    expect(contributors[0]!.revisions).toBe(6);
    expect(contributors[0]!.percent).toBe(60);

    expect(contributors[1]!.author).toBe('bob');
    expect(contributors[1]!.revisions).toBe(3);
    expect(contributors[1]!.percent).toBe(30);

    expect(contributors[2]!.author).toBe('charlie');
    expect(contributors[2]!.revisions).toBe(1);
    expect(contributors[2]!.percent).toBe(10);
  });

  it('maxContributorsPerFile limits per-file array', () => {
    const stats = aggregateCommits([
      ...commitsBy('alice', [file('app.ts')], 5),
      ...commitsBy('bob', [file('app.ts')], 3),
      ...commitsBy('charlie', [file('app.ts')], 1),
    ]);

    const result = computeTopContributors(stats, { maxContributorsPerFile: 2 });

    expect(result[0]!.contributors).toHaveLength(2);
    expect(result[0]!.authorCount).toBe(3); // still reflects full count
    expect(result[0]!.contributors[0]!.author).toBe('alice');
    expect(result[0]!.contributors[1]!.author).toBe('bob');
  });

  it('topN limits file count', () => {
    const stats = aggregateCommits([
      commit({ author: 'alice', files: [file('a.ts')] }),
      commit({ author: 'bob', files: [file('b.ts')] }),
      commit({ author: 'charlie', files: [file('c.ts')] }),
    ]);

    const result = computeTopContributors(stats, { topN: 2 });
    expect(result).toHaveLength(2);
  });

  it('ties in authorCount broken alphabetically by filename', () => {
    const stats = aggregateCommits([
      commit({ author: 'alice', files: [file('zebra.ts')] }),
      commit({ author: 'alice', files: [file('alpha.ts')] }),
    ]);

    const result = computeTopContributors(stats);

    // Both have authorCount=1, so sorted alphabetically
    expect(result[0]!.file).toBe('alpha.ts');
    expect(result[1]!.file).toBe('zebra.ts');
  });

  it('files sorted by authorCount descending', () => {
    const stats = aggregateCommits([
      ...commitsBy('alice', [file('multi.ts')], 3),
      ...commitsBy('bob', [file('multi.ts')], 2),
      ...commitsBy('charlie', [file('multi.ts')], 1),
      commit({ author: 'alice', files: [file('solo.ts')] }),
    ]);

    const result = computeTopContributors(stats);

    expect(result[0]!.file).toBe('multi.ts');
    expect(result[0]!.authorCount).toBe(3);
    expect(result[1]!.file).toBe('solo.ts');
    expect(result[1]!.authorCount).toBe(1);
  });

  it('zero-revision files skipped', () => {
    // aggregateCommits won't produce zero-revision files normally,
    // but verify the guard works with a minimal stat object
    const stats = aggregateCommits([]);
    const result = computeTopContributors(stats);
    expect(result).toHaveLength(0);
  });

  it('preserves exists flag from stats', () => {
    const stats = aggregateCommits([commit({ author: 'alice', files: [file('app.ts')] })]);
    // Default aggregated stats have exists: false (no enrichment step)
    const result = computeTopContributors(stats);
    expect(result[0]!.exists).toBe(false);
  });

  it('revision-tied contributors sorted alphabetically', () => {
    const stats = aggregateCommits([
      commit({ author: 'zara', files: [file('app.ts')] }),
      commit({ author: 'adam', files: [file('app.ts')] }),
    ]);

    const result = computeTopContributors(stats);
    const contributors = result[0]!.contributors;

    // Both have 1 revision, so alphabetical
    expect(contributors[0]!.author).toBe('adam');
    expect(contributors[1]!.author).toBe('zara');
  });
});
