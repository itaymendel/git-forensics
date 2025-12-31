import { describe, it, expect, beforeEach } from 'vitest';
import { aggregateCommits } from './aggregate.js';
import { commit, file, resetCounter, commitsBy, SCENARIOS } from '../__mocks__/commit-log.mock.js';

describe('aggregateCommits', () => {
  beforeEach(() => resetCounter());

  it('should aggregate file stats by author', () => {
    const commits = [
      commit({
        author: 'alice',
        files: [
          file('src/index.ts', { additions: 10, deletions: 2 }),
          file('src/utils.ts', { additions: 5 }),
        ],
      }),
      commit({ author: 'bob', files: [file('src/index.ts', { additions: 3, deletions: 1 })] }),
      commit({ author: 'alice', files: [file('src/index.ts', { additions: 1, deletions: 1 })] }),
    ];

    const stats = aggregateCommits(commits);

    expect(stats.fileStats.size).toBe(2);

    const indexStats = stats.fileStats.get('src/index.ts');
    expect(indexStats!.byAuthor.size).toBe(2);
    expect(indexStats!.byAuthor.get('alice')).toHaveLength(2);
    expect(indexStats!.byAuthor.get('bob')).toHaveLength(1);

    const utilsStats = stats.fileStats.get('src/utils.ts');
    expect(utilsStats!.byAuthor.size).toBe(1);
    expect(utilsStats!.byAuthor.get('alice')).toHaveLength(1);
  });

  it('should compute SOC score for multi-file commits', () => {
    const commits = [commit({ files: [file('a.ts'), file('b.ts'), file('c.ts')] })];

    const stats = aggregateCommits(commits);

    // Each file gets SOC = (3 - 1) = 2
    expect(stats.fileStats.get('a.ts')!.socScore).toBe(2);
    expect(stats.fileStats.get('b.ts')!.socScore).toBe(2);
    expect(stats.fileStats.get('c.ts')!.socScore).toBe(2);
  });

  it('should skip SOC for single-file commits', () => {
    const commits = [commit({ files: [file('solo.ts')] })];

    const stats = aggregateCommits(commits);
    expect(stats.fileStats.get('solo.ts')!.socScore).toBe(0);
  });

  it('should skip SOC for commits exceeding maxFilesPerCommit', () => {
    const commits = [commit({ files: [file('a.ts'), file('b.ts'), file('c.ts')] })];

    const stats = aggregateCommits(commits, { maxFilesPerCommit: 2 });
    expect(stats.fileStats.get('a.ts')!.socScore).toBe(0);
  });

  it('should count pair co-changes', () => {
    const commits = commitsBy('dev', [file('a.ts'), file('b.ts')], 2);

    const stats = aggregateCommits(commits);
    expect(stats.pairCoChanges.get('a.ts::b.ts')).toBe(2);
  });

  it('should store commit entry data correctly', () => {
    const commits = [
      commit({
        date: '2024-01-15T10:30:00Z',
        files: [file('test.ts', { additions: 10, deletions: 5 })],
      }),
    ];

    const stats = aggregateCommits(commits);

    const entries = stats.fileStats.get('test.ts')!.byAuthor.get('dev')!;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.date).toBe('2024-01-15T10:30:00Z');
    expect(entries[0]!.timestamp).toBe(new Date('2024-01-15T10:30:00Z').getTime());
    expect(entries[0]!.additions).toBe(10);
    expect(entries[0]!.deletions).toBe(5);
  });

  it('should return empty stats for empty commits', () => {
    const stats = aggregateCommits([]);

    expect(stats.fileStats.size).toBe(0);
    expect(stats.pairCoChanges.size).toBe(0);
  });

  it('should track author contributions with additions, deletions, and revisions', () => {
    const commits = [
      commit({ author: 'alice', files: [file('src/index.ts', { additions: 10, deletions: 2 })] }),
      commit({ author: 'bob', files: [file('src/index.ts', { additions: 5, deletions: 3 })] }),
      commit({ author: 'alice', files: [file('src/index.ts', { additions: 1, deletions: 1 })] }),
    ];

    const stats = aggregateCommits(commits);
    const indexStats = stats.fileStats.get('src/index.ts');

    expect(indexStats!.authorContributions.get('alice')).toEqual({
      additions: 11,
      deletions: 3,
      revisions: 2,
    });
    expect(indexStats!.authorContributions.get('bob')).toEqual({
      additions: 5,
      deletions: 3,
      revisions: 1,
    });
  });

  describe('rename handling', () => {
    it('should consolidate stats for renamed file under current name', () => {
      const commits = SCENARIOS.simpleRename();

      const stats = aggregateCommits(commits);

      expect(stats.fileStats.size).toBe(1);
      expect(stats.fileStats.has('new.ts')).toBe(true);
      expect(stats.fileStats.has('old.ts')).toBe(false);

      const fileStats = stats.fileStats.get('new.ts')!;
      expect(fileStats.nameHistory).toEqual(['old.ts']);
      expect(fileStats.totalRevisions).toBe(2);
    });

    it('should handle rename chains correctly (A→B→C)', () => {
      const commits = SCENARIOS.renameChain();

      const stats = aggregateCommits(commits);

      expect(stats.fileStats.size).toBe(1);
      expect(stats.fileStats.has('c.ts')).toBe(true);

      const fileStats = stats.fileStats.get('c.ts')!;
      expect(fileStats.nameHistory).toEqual(['a.ts', 'b.ts']);
      expect(fileStats.totalRevisions).toBe(3);
    });

    it('should leave nameHistory empty for non-renamed files', () => {
      const commits = commitsBy('dev', [file('stable.ts', { additions: 10 })], 2);

      const stats = aggregateCommits(commits);

      const fileStats = stats.fileStats.get('stable.ts')!;
      expect(fileStats.nameHistory).toEqual([]);
    });

    it('should use resolved names for pair co-changes', () => {
      const commits = [
        commit({ files: [file('renamed.ts'), file('other.ts')] }),
        commit({
          files: [
            { file: 'renamed.ts', renamedFrom: 'old.ts', additions: 0, deletions: 0 },
            file('other.ts'),
          ],
        }),
      ];

      const stats = aggregateCommits(commits);

      expect(stats.pairCoChanges.get('other.ts::renamed.ts')).toBe(2);
      expect(stats.pairCoChanges.has('old.ts::other.ts')).toBe(false);
    });
  });
});
