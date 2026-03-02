import { describe, it, expect, beforeEach } from 'vitest';
import { computeRevisions } from './revisions.js';
import { computeCodeAge } from './code-age.js';
import { computeChurn } from './churn.js';
import { aggregateCommits } from '../preprocessing/aggregate.js';
import { commit, file, resetCounter, commitsBy } from '../__mocks__/commit-log.mock.js';

describe('computeRevisions', () => {
  beforeEach(() => resetCounter());

  it('should count revisions per file and sort descending', () => {
    const commits = [
      commit({
        files: [file('src/index.ts', { additions: 10 }), file('src/utils.ts', { additions: 5 })],
      }),
      commit({
        files: [file('src/index.ts', { additions: 2 }), file('src/new.ts', { additions: 20 })],
      }),
      commit({ files: [file('src/index.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeRevisions(stats);

    expect(result).toEqual([
      { file: 'src/index.ts', revisions: 3, exists: false },
      { file: 'src/new.ts', revisions: 1, exists: false },
      { file: 'src/utils.ts', revisions: 1, exists: false },
    ]);
  });

  it('should filter files below minRevisions threshold', () => {
    const commits = [
      commit({ files: [file('a.ts')] }),
      commit({ files: [file('b.ts'), file('a.ts')] }),
      commit({ files: [file('c.ts'), file('b.ts'), file('a.ts')] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeRevisions(stats, { minRevisions: 2 });

    expect(result).toHaveLength(2);
    expect(result[0]!.file).toBe('a.ts');
    expect(result[0]!.revisions).toBe(3);
  });

  it('should respect topN limit', () => {
    const commits = [commit({ files: Array.from({ length: 10 }, (_, i) => file(`file-${i}.ts`)) })];

    const stats = aggregateCommits(commits);
    expect(computeRevisions(stats, { topN: 3 })).toHaveLength(3);
  });

  describe('with complexity data', () => {
    it('should sort by score (revisions × complexity) when complexity provided', () => {
      const commits = [
        commit({ files: [file('many-changes.ts'), file('few-changes.ts')] }),
        ...commitsBy('dev', [file('many-changes.ts')], 2),
      ];

      const stats = aggregateCommits(commits);
      // many-changes.ts: 3 revisions, complexity 10 -> score 30
      // few-changes.ts: 1 revision, complexity 100 -> score 100
      const result = computeRevisions(stats, {
        complexity: new Map([
          ['many-changes.ts', 10],
          ['few-changes.ts', 100],
        ]),
      });

      expect(result[0]!.file).toBe('few-changes.ts');
      expect(result[0]!.score).toBe(100);
      expect(result[1]!.file).toBe('many-changes.ts');
      expect(result[1]!.score).toBe(30);
    });
  });
});

describe('computeCodeAge', () => {
  beforeEach(() => resetCounter());

  it('should compute age in months for each file', () => {
    const commits = [
      commit({ date: '2024-01-15T10:00:00Z', files: [file('old.ts', { additions: 10 })] }),
      commit({ date: '2024-06-15T10:00:00Z', files: [file('recent.ts', { additions: 5 })] }),
    ];

    const refDate = new Date('2024-07-15T10:00:00Z');
    const stats = aggregateCommits(commits);
    const result = computeCodeAge(stats, { referenceDate: refDate });

    expect(result.length).toBe(2);
    expect(result[0]!.file).toBe('old.ts');
    expect(result[0]!.ageMonths).toBe(6);
    expect(result[1]!.file).toBe('recent.ts');
    expect(result[1]!.ageMonths).toBe(1);
  });

  it('should use most recent modification date when file appears multiple times', () => {
    const commits = [
      commit({ date: '2024-01-01T10:00:00Z', files: [file('app.ts', { additions: 100 })] }),
      commit({ date: '2024-06-01T10:00:00Z', files: [file('app.ts', { additions: 5 })] }),
    ];

    const refDate = new Date('2024-07-01T10:00:00Z');
    const stats = aggregateCommits(commits);
    const result = computeCodeAge(stats, { referenceDate: refDate });

    expect(result[0]!.ageMonths).toBe(1); // Uses June date, not January
  });

  it('should clamp future dates to ageMonths = 0', () => {
    const refDate = new Date('2024-07-15T10:00:00Z');
    const commits = [commit({ date: '2024-12-15T10:00:00Z', files: [file('future.ts')] })];

    const stats = aggregateCommits(commits);
    const result = computeCodeAge(stats, { referenceDate: refDate });

    expect(result[0]!.ageMonths).toBe(0);
  });
});

describe('computeChurn', () => {
  beforeEach(() => resetCounter());

  it('should calculate total churn per file', () => {
    const commits = [
      commit({ author: 'alice', files: [file('app.ts', { additions: 100, deletions: 20 })] }),
      commit({ author: 'bob', files: [file('app.ts', { additions: 30, deletions: 10 })] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeChurn(stats);

    expect(result.length).toBe(1);
    expect(result[0]!.file).toBe('app.ts');
    expect(result[0]!.added).toBe(130);
    expect(result[0]!.deleted).toBe(30);
    expect(result[0]!.churn).toBe(160);
    expect(result[0]!.revisions).toBe(2);
  });

  it('should sort by churn descending', () => {
    const commits = [
      commit({
        files: [
          file('high.ts', { additions: 100, deletions: 50 }),
          file('low.ts', { additions: 10, deletions: 5 }),
          file('medium.ts', { additions: 50, deletions: 25 }),
        ],
      }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeChurn(stats);

    expect(result[0]!.file).toBe('high.ts');
    expect(result[1]!.file).toBe('medium.ts');
    expect(result[2]!.file).toBe('low.ts');
  });

  it('should respect topN limit', () => {
    const commits = [
      commit({
        files: Array.from({ length: 10 }, (_, i) =>
          file(`file-${i}.ts`, { additions: (10 - i) * 10 })
        ),
      }),
    ];

    const stats = aggregateCommits(commits);
    expect(computeChurn(stats, { topN: 3 })).toHaveLength(3);
  });
});
