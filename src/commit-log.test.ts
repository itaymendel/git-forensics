import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCommitLog, parseRename, getChangedFiles, computeCommitMetadata } from './commit-log.js';
import type { SimpleGit } from 'simple-git';
import type { CommitLog } from './types.js';

describe('getCommitLog', () => {
  it('should transform git log to CommitLog format', async () => {
    const mockGit = {
      log: vi.fn().mockResolvedValue({
        all: [
          {
            hash: 'abc123 parent1',
            date: '2024-01-15T10:00:00Z',
            author_name: 'Alice',
            message: 'Add feature',
            diff: {
              files: [
                { file: 'src/app.ts', insertions: 10, deletions: 2 },
                { file: 'image.png', binary: true }, // Should be filtered
              ],
            },
          },
        ],
      }),
    } as unknown as SimpleGit;

    const commits = await getCommitLog(mockGit);

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      hash: 'abc123',
      author: 'Alice',
      parentCount: 1,
      files: [{ file: 'src/app.ts', additions: 10, deletions: 2 }],
    });
  });

  it('should pass options to git log', async () => {
    const mockGit = {
      log: vi.fn().mockResolvedValue({ all: [] }),
    } as unknown as SimpleGit;

    await getCommitLog(mockGit, { maxCommits: 100, since: '2024-01-01' });

    expect(mockGit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCount: 100,
        '--since': '2024-01-01',
      })
    );
  });
});

describe('parseRename', () => {
  it('should return null for non-rename files', () => {
    expect(parseRename('src/app.ts')).toBeNull();
  });

  it('should parse simple rename notation', () => {
    expect(parseRename('old.ts => new.ts')).toEqual(['old.ts', 'new.ts']);
  });

  it('should parse brace notation', () => {
    expect(parseRename('src/{old => new}/file.ts')).toEqual(['src/old/file.ts', 'src/new/file.ts']);
    expect(parseRename('src/{old => new}.ts')).toEqual(['src/old.ts', 'src/new.ts']);
  });

  it('should return null for empty string', () => {
    expect(parseRename('')).toBeNull();
  });

  it('should return null for arrow-only string', () => {
    expect(parseRename('=>')).toBeNull();
  });

  it('should return null for missing right side in simple notation', () => {
    // (.+) requires at least one char on right side
    expect(parseRename('old.ts => ')).toBeNull();
  });

  it('should return null for missing left side in simple notation', () => {
    // " => new.ts" can't match: no room for (.+) then literal " => "
    expect(parseRename(' => new.ts')).toBeNull();
  });

  it('should handle brace notation with no prefix or suffix', () => {
    expect(parseRename('{old => new}')).toEqual(['old', 'new']);
  });

  it('should handle whitespace in file names with simple notation', () => {
    expect(parseRename('old name.ts => new name.ts')).toEqual(['old name.ts', 'new name.ts']);
  });

  it('should parse first arrow when multiple arrows present', () => {
    // "a => b => c" — simple regex matches first (.+) greedily, so:
    // simpleMatch[1] = "a => b", simpleMatch[2] = "c"
    const result = parseRename('a => b => c');
    expect(result).toEqual(['a => b', 'c']);
  });
});

describe('getChangedFiles', () => {
  let mockGit: SimpleGit;

  beforeEach(() => {
    mockGit = { diff: vi.fn() } as unknown as SimpleGit;
  });

  it('should return files from git diff', async () => {
    vi.mocked(mockGit.diff).mockResolvedValue('src/app.ts\nsrc/utils.ts\n');

    const files = await getChangedFiles(mockGit, 'origin/main');

    expect(mockGit.diff).toHaveBeenCalledWith(['--name-only', 'origin/main...HEAD']);
    expect(files).toEqual(['src/app.ts', 'src/utils.ts']);
  });

  it('should use custom headRef', async () => {
    vi.mocked(mockGit.diff).mockResolvedValue('file.ts\n');

    await getChangedFiles(mockGit, 'main', 'feature');

    expect(mockGit.diff).toHaveBeenCalledWith(['--name-only', 'main...feature']);
  });
});

describe('computeCommitMetadata', () => {
  it('returns empty metadata for empty commits', () => {
    expect(computeCommitMetadata([])).toEqual({
      dateRange: { from: '', to: '' },
      totalFilesAnalyzed: 0,
      totalAuthors: 0,
    });
  });

  it('computes date range, unique files, and unique authors', () => {
    const commits: CommitLog[] = [
      {
        hash: 'a',
        date: '2024-03-15',
        author: 'alice',
        message: '',
        files: [{ file: 'a.ts', additions: 1, deletions: 0 }],
      },
      {
        hash: 'b',
        date: '2024-01-01',
        author: 'bob',
        message: '',
        files: [{ file: 'a.ts', additions: 1, deletions: 0 }],
      },
      {
        hash: 'c',
        date: '2024-06-30',
        author: 'alice',
        message: '',
        files: [{ file: 'b.ts', additions: 1, deletions: 0 }],
      },
    ];

    const result = computeCommitMetadata(commits);

    expect(result.dateRange).toEqual({ from: '2024-01-01', to: '2024-06-30' });
    expect(result.totalFilesAnalyzed).toBe(2); // a.ts, b.ts
    expect(result.totalAuthors).toBe(2); // alice, bob
  });
});
