import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeForensics, filterMergeCommits } from './orchestrator.js';
import type { SimpleGit } from 'simple-git';
import type { CommitLog } from './types.js';

function createMockGit(commits: CommitLog[], existingFiles: string[] = []): SimpleGit {
  // Build the list of existing files from commits if not provided
  const files =
    existingFiles.length > 0 ? existingFiles : commits.flatMap((c) => c.files.map((f) => f.file));

  return {
    log: vi.fn().mockResolvedValue({
      all: commits.map((c) => ({
        hash: c.parentCount && c.parentCount > 1 ? `${c.hash} parent1 parent2` : c.hash,
        date: c.date,
        author_name: c.author,
        message: c.message,
        diff: {
          files: c.files.map((f) => ({
            file: f.file,
            insertions: f.additions,
            deletions: f.deletions,
          })),
        },
      })),
    }),
    raw: vi.fn().mockResolvedValue(files.join('\n')),
  } as unknown as SimpleGit;
}

describe('computeForensics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter merge commits based on skipMergeCommits option', async () => {
    const commits: CommitLog[] = [
      {
        hash: 'abc123',
        date: '2024-06-15T10:00:00Z',
        author: 'Alice',
        message: 'Regular commit',
        files: [{ file: 'app.ts', additions: 10, deletions: 2 }],
        parentCount: 1,
      },
      {
        hash: 'def456',
        date: '2024-06-14T10:00:00Z',
        author: 'Bob',
        message: 'Merge branch feature',
        files: [{ file: 'feature.ts', additions: 50, deletions: 0 }],
        parentCount: 2,
      },
    ];

    const mockGit = createMockGit(commits);

    // With skipMergeCommits: true
    const withSkip = await computeForensics(mockGit, { skipMergeCommits: true });
    expect(withSkip.analyzedCommits).toBe(1);
    expect(withSkip.codeAge.map((a) => a.file)).not.toContain('feature.ts');

    // With skipMergeCommits: false
    const withoutSkip = await computeForensics(mockGit, { skipMergeCommits: false });
    expect(withoutSkip.analyzedCommits).toBe(2);
  });

  it('should apply topN limit to metric results', async () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      file: `file-${i}.ts`,
      additions: 10 + i,
      deletions: i,
    }));

    const mockGit = createMockGit([
      {
        hash: 'abc123',
        date: '2024-06-15T10:00:00Z',
        author: 'Alice',
        message: 'Add files',
        files,
      },
    ]);

    const result = await computeForensics(mockGit, { topN: 5 });

    expect(result.codeAge.length).toBeLessThanOrEqual(5);
    expect(result.ownership.length).toBeLessThanOrEqual(5);
  });

  it('should return empty result when no commits remain after filtering', async () => {
    const mockGit = createMockGit([
      {
        hash: 'abc123',
        date: '2024-06-15T10:00:00Z',
        author: 'Alice',
        message: 'Merge PR',
        files: [{ file: 'app.ts', additions: 10, deletions: 2 }],
        parentCount: 2,
      },
    ]);

    const result = await computeForensics(mockGit, { skipMergeCommits: true });

    expect(result.analyzedCommits).toBe(0);
    expect(result.dateRange).toEqual({ from: '', to: '' });
    expect(result.hotspots).toEqual([]);
    expect(result.codeAge).toEqual([]);
  });

  it('should propagate options to getCommitLog', async () => {
    const mockGit = {
      log: vi.fn().mockResolvedValue({ all: [] }),
    } as unknown as SimpleGit;

    await computeForensics(mockGit, {
      maxCommits: 500,
      since: '2024-01-01',
      followRenames: false,
    });

    expect(mockGit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCount: 500,
        '--since': '2024-01-01',
      })
    );
    // followRenames: false means no -M flag
    expect(mockGit.log).toHaveBeenCalledWith(expect.not.objectContaining({ '-M': null }));
  });

  it('should apply exclude patterns and authorMap', async () => {
    const commits: CommitLog[] = [
      {
        hash: 'abc123',
        date: '2024-06-15T10:00:00Z',
        author: 'alice@work.com',
        message: 'Add files',
        files: [
          { file: 'src/app.ts', additions: 10, deletions: 0 },
          { file: 'node_modules/pkg/index.js', additions: 100, deletions: 0 },
        ],
      },
      {
        hash: 'def456',
        date: '2024-06-14T10:00:00Z',
        author: 'alice@personal.com',
        message: 'Update',
        files: [{ file: 'src/app.ts', additions: 5, deletions: 0 }],
      },
    ];

    const mockGit = createMockGit(commits);
    const result = await computeForensics(mockGit, {
      exclude: ['node_modules/**'],
      authorMap: { 'alice@work.com': 'Alice', 'alice@personal.com': 'Alice' },
    });

    // Exclude patterns applied
    expect(result.codeAge.map((a) => a.file)).not.toContain('node_modules/pkg/index.js');

    // Author mapping applied
    const ownership = result.ownership.find((o) => o.file === 'src/app.ts');
    expect(ownership?.mainDev).toBe('Alice');
    expect(ownership?.authorCount).toBe(1);
  });

  it('should compute metadata correctly', async () => {
    const commits: CommitLog[] = [
      {
        hash: 'abc123',
        date: '2024-06-15T10:00:00Z',
        author: 'Alice',
        message: 'Commit 1',
        files: [
          { file: 'app.ts', additions: 10, deletions: 0 },
          { file: 'utils.ts', additions: 5, deletions: 0 },
        ],
      },
      {
        hash: 'def456',
        date: '2024-01-10T10:00:00Z',
        author: 'Bob',
        message: 'Commit 2',
        files: [{ file: 'app.ts', additions: 1, deletions: 0 }],
      },
    ];

    const mockGit = createMockGit(commits);
    const result = await computeForensics(mockGit, { maxCommits: 100, topN: 25 });

    expect(result.dateRange.from).toBe('2024-01-10T10:00:00Z');
    expect(result.dateRange.to).toBe('2024-06-15T10:00:00Z');
    expect(result.metadata.maxCommitsAnalyzed).toBe(100);
    expect(result.metadata.topN).toBe(25);
    expect(result.metadata.totalFilesAnalyzed).toBe(2);
    expect(result.metadata.totalAuthors).toBe(2);
  });

  it('should reject invalid options', async () => {
    const mockGit = { log: vi.fn() } as unknown as SimpleGit;

    await expect(computeForensics(mockGit, { maxCommits: 0 })).rejects.toThrow(
      'maxCommits must be positive'
    );
    await expect(computeForensics(mockGit, { maxCommits: -5 })).rejects.toThrow(
      'maxCommits must be positive'
    );
    await expect(computeForensics(mockGit, { topN: 0 })).rejects.toThrow('topN must be positive');
    await expect(computeForensics(mockGit, { minRevisions: -1 })).rejects.toThrow(
      'minRevisions must be non-negative'
    );
  });
});

describe('filterMergeCommits', () => {
  it('should filter commits by parentCount', () => {
    const commits: CommitLog[] = [
      { hash: 'a', date: '2024-06-15', author: 'A', message: '', files: [], parentCount: 1 },
      { hash: 'b', date: '2024-06-14', author: 'B', message: '', files: [], parentCount: 2 },
      { hash: 'c', date: '2024-06-13', author: 'C', message: '', files: [], parentCount: 3 },
      { hash: 'd', date: '2024-06-12', author: 'D', message: '', files: [] }, // undefined defaults to 1
    ];

    const result = filterMergeCommits(commits);

    expect(result.map((c) => c.hash)).toEqual(['a', 'd']);
  });

  it('should handle edge cases', () => {
    expect(filterMergeCommits([])).toEqual([]);

    const allMerges: CommitLog[] = [
      { hash: 'a', date: '2024-06-15', author: 'A', message: '', files: [], parentCount: 2 },
      { hash: 'b', date: '2024-06-14', author: 'B', message: '', files: [], parentCount: 2 },
    ];
    expect(filterMergeCommits(allMerges)).toEqual([]);
  });
});
