import { describe, it, expect, beforeEach } from 'vitest';
import { computeForensicsFromData } from './from-data.js';
import { commit, file, resetCounter, createGitLogData } from './__mocks__/commit-log.mock.js';

describe('computeForensicsFromData', () => {
  beforeEach(() => resetCounter());

  it('should compute forensics from valid data', () => {
    const commits = [
      commit({
        author: 'Alice',
        files: [
          file('src/app.ts', { additions: 50, deletions: 10 }),
          file('src/utils.ts', { additions: 20, deletions: 5 }),
        ],
      }),
    ];
    const data = createGitLogData(commits);

    const result = computeForensicsFromData(data);

    expect(result.analyzedCommits).toBe(1);
    expect(result.hotspots.length).toBeGreaterThan(0);
    expect(result.metadata.totalFilesAnalyzed).toBe(2);
  });

  it('should throw on invalid data', () => {
    expect(() => computeForensicsFromData(null as never)).toThrow();
    expect(() => computeForensicsFromData({ log: {} } as never)).toThrow();
  });

  it('should be synchronous (not return a Promise)', () => {
    const data = createGitLogData([commit({ files: [file('app.ts')] })]);
    const result = computeForensicsFromData(data);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it('should track file existence from trackedFiles', () => {
    const commits = [commit({ files: [file('deleted.ts', { additions: 10 })] })];
    const data = createGitLogData(commits, ['other.ts']); // deleted.ts not tracked

    const result = computeForensicsFromData(data);
    expect(result.hotspots[0]?.exists).toBe(false);
  });

  describe('complexityScores option', () => {
    it('should sort hotspots by score when complexityScores provided', () => {
      const commits = [
        commit({ files: [file('low-rev.ts'), file('high-rev.ts')] }),
        commit({ files: [file('high-rev.ts')] }),
        commit({ files: [file('high-rev.ts')] }),
      ];
      const data = createGitLogData(commits);

      const result = computeForensicsFromData(data, {
        complexityScores: {
          'low-rev.ts': 100, // 1 revision × 100 = score 100
          'high-rev.ts': 1, // 3 revisions × 1  = score 3
        },
      });

      expect(result.hotspots[0]!.file).toBe('low-rev.ts');
      expect(result.hotspots[0]!.score).toBe(100);
      expect(result.hotspots[1]!.file).toBe('high-rev.ts');
      expect(result.hotspots[1]!.score).toBe(3);
    });

    it('should include complexity value on each hotspot entry', () => {
      const commits = [commit({ files: [file('app.ts')] })];
      const data = createGitLogData(commits);

      const result = computeForensicsFromData(data, {
        complexityScores: { 'app.ts': 42 },
      });

      expect(result.hotspots[0]!.complexity).toBe(42);
      expect(result.hotspots[0]!.score).toBe(42); // 1 revision × 42
    });

    it('should sort by revisions when complexityScores not provided', () => {
      const commits = [
        commit({ files: [file('low.ts'), file('high.ts')] }),
        commit({ files: [file('high.ts')] }),
        commit({ files: [file('high.ts')] }),
      ];
      const data = createGitLogData(commits);

      const result = computeForensicsFromData(data);

      expect(result.hotspots[0]!.file).toBe('high.ts');
      expect(result.hotspots[0]!.score).toBeUndefined();
    });
  });
});
