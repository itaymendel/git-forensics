import { describe, it, expect, beforeEach } from 'vitest';
import { computeOwnership } from './ownership.js';
import { aggregateCommits } from '../preprocessing/aggregate.js';
import { commit, file, resetCounter, SCENARIOS } from '../__mocks__/commit-log.mock.js';

describe('computeOwnership', () => {
  beforeEach(() => resetCounter());

  // Algorithm: mainDev by additions, refactoringDev by deletions, fractal = Σ(ratio²)
  it('should determine mainDev by additions and refactoringDev by deletions', () => {
    // Alice: 50 additions, 200 deletions. Bob: 100 additions, 10 deletions
    // mainDev = Bob (more additions), refactoringDev = Alice (more deletions)
    const commits = [
      commit({ author: 'alice', files: [file('app.ts', { additions: 50, deletions: 200 })] }),
      commit({ author: 'bob', files: [file('app.ts', { additions: 100, deletions: 10 })] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats);

    expect(result[0]!.mainDev).toBe('bob');
    expect(result[0]!.ownershipPercent).toBe(67); // 100 / 150
    expect(result[0]!.refactoringDev).toBe('alice');
    expect(result[0]!.refactoringOwnership).toBe(95); // 200 / 210
  });

  it('should compute fractal fragmentation and sort by it ascending', () => {
    // Fractal = Σ(contribution_i / total)². Lower = more fragmented
    const commits = [
      // single.ts: 1 owner → fractal = 1
      commit({ author: 'solo', files: [file('single.ts', { additions: 100 })] }),
      // fragmented.ts: 4 equal owners → fractal = 4 * 0.25² = 0.25
      ...['alice', 'bob', 'charlie', 'diana'].map((author) =>
        commit({ author, files: [file('fragmented.ts', { additions: 25 })] })
      ),
    ];

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats);

    // Sorted by fractal ascending (most fragmented first)
    expect(result[0]!.file).toBe('fragmented.ts');
    expect(result[0]!.fractalValue).toBe(0.25);
    expect(result[0]!.authorCount).toBe(4);
    expect(result[1]!.file).toBe('single.ts');
    expect(result[1]!.fractalValue).toBe(1);
  });

  it('should identify refactoring developer by deletions', () => {
    const commits = SCENARIOS.ownershipSplit();

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats);

    expect(result[0]!.mainDev).toBe('alice'); // By additions
    expect(result[0]!.refactoringDev).toBe('bob'); // By deletions
    expect(result[0]!.refactoringOwnership).toBe(89); // 80/90
  });

  it('should respect topN limit', () => {
    const commits = [
      commit({
        files: Array.from({ length: 10 }, (_, i) => file(`file-${i}.ts`)),
      }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats, { topN: 3 });

    expect(result).toHaveLength(3);
  });

  it('should handle file with zero additions', () => {
    const commits = [
      commit({ author: 'alice', files: [file('cleanup.ts', { additions: 0, deletions: 50 })] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats);

    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('cleanup.ts');
    expect(result[0]!.mainDev).toBe(''); // No additions means no main dev
    expect(result[0]!.ownershipPercent).toBe(0);
    expect(result[0]!.refactoringDev).toBe('alice');
    expect(result[0]!.refactoringOwnership).toBe(100);
    expect(result[0]!.fractalValue).toBe(1); // No additions = treat as single owner
  });

  it('should handle file with zero lines changed', () => {
    const commits = [
      commit({ author: 'alice', files: [file('script.sh', { additions: 0, deletions: 0 })] }),
    ];

    const stats = aggregateCommits(commits);
    const result = computeOwnership(stats);

    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('script.sh');
    expect(result[0]!.mainDev).toBe(''); // No additions
    expect(result[0]!.refactoringDev).toBe(''); // No deletions
    expect(result[0]!.ownershipPercent).toBe(0);
    expect(result[0]!.refactoringOwnership).toBe(0);
    expect(result[0]!.authorCount).toBe(1);
  });
});
