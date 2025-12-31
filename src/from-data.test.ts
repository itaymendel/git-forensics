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
});
