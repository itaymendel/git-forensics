import { describe, it, expect, beforeEach } from 'vitest';
import { filterCommitFiles, normalizeAuthors } from './transforms.js';
import { commit, file, resetCounter } from '../__mocks__/commit-log.mock.js';

describe('filterCommitFiles', () => {
  beforeEach(() => resetCounter());

  const commits = [
    commit({
      message: 'Add feature',
      files: [
        file('src/index.ts', { additions: 10 }),
        file('src/index.test.ts', { additions: 20 }),
        file('node_modules/lodash/index.js', { additions: 100 }),
      ],
    }),
    commit({
      message: 'Update tests',
      files: [file('src/utils.test.ts', { additions: 5, deletions: 2 })],
    }),
  ];

  it('should filter files matching exclude patterns', () => {
    const result = filterCommitFiles(commits, { exclude: ['**/*.test.ts'] });

    expect(result).toHaveLength(1); // Second commit removed entirely
    expect(result[0]!.files).toHaveLength(2); // index.ts and node_modules
    expect(result[0]!.files.map((f) => f.file)).toContain('src/index.ts');
    expect(result[0]!.files.map((f) => f.file)).not.toContain('src/index.test.ts');
  });

  it('should filter multiple patterns', () => {
    const result = filterCommitFiles(commits, { exclude: ['**/*.test.ts', 'node_modules/**'] });

    expect(result).toHaveLength(1);
    expect(result[0]!.files).toHaveLength(1);
    expect(result[0]!.files[0]!.file).toBe('src/index.ts');
  });

  it('should return original commits when no patterns', () => {
    const result = filterCommitFiles(commits, { exclude: [] });
    expect(result).toEqual(commits);
  });

  it('should return empty array when all files in all commits are excluded', () => {
    const testCommits = [commit({ files: [file('src/index.test.ts', { additions: 100 })] })];

    const result = filterCommitFiles(testCommits, { exclude: ['**/*.test.ts'] });
    expect(result).toEqual([]);
  });
});

describe('normalizeAuthors', () => {
  beforeEach(() => resetCounter());

  it('should return mapped name when found', () => {
    const authorMap = { 'alice@old.com': 'Alice Smith', bob: 'Bob Jones' };

    expect(normalizeAuthors([commit({ author: 'alice@old.com' })], { authorMap })[0]!.author).toBe(
      'Alice Smith'
    );
    expect(normalizeAuthors([commit({ author: 'bob' })], { authorMap })[0]!.author).toBe(
      'Bob Jones'
    );
  });

  it('should return original name when not in map', () => {
    const authorMap = { 'alice@old.com': 'Alice Smith' };

    expect(normalizeAuthors([commit({ author: 'charlie' })], { authorMap })[0]!.author).toBe(
      'charlie'
    );
    expect(
      normalizeAuthors([commit({ author: 'unknown@email.com' })], { authorMap })[0]!.author
    ).toBe('unknown@email.com');
  });

  it('should return original commits when authorMap is missing or empty', () => {
    const c = commit({ author: 'alice' });
    expect(normalizeAuthors([c], { authorMap: {} })).toEqual([c]);
    expect(normalizeAuthors([c], {})).toEqual([c]);
    expect(normalizeAuthors([c])).toEqual([c]);
  });

  it('should be case-sensitive', () => {
    const authorMap = { Alice: 'Alice Smith' };

    expect(normalizeAuthors([commit({ author: 'Alice' })], { authorMap })[0]!.author).toBe(
      'Alice Smith'
    );
    expect(normalizeAuthors([commit({ author: 'alice' })], { authorMap })[0]!.author).toBe('alice');
    expect(normalizeAuthors([commit({ author: 'ALICE' })], { authorMap })[0]!.author).toBe('ALICE');
  });

  it('should normalize multiple commits', () => {
    const commits = [
      commit({ author: 'alice@old.com', files: [file('src/index.ts', { additions: 10 })] }),
      commit({ author: 'alice@new.com', files: [file('src/utils.ts', { additions: 5 })] }),
      commit({ author: 'bob', files: [file('src/app.ts', { additions: 20 })] }),
    ];

    const authorMap = { 'alice@old.com': 'Alice Smith', 'alice@new.com': 'Alice Smith' };
    const result = normalizeAuthors(commits, { authorMap });

    expect(result[0]!.author).toBe('Alice Smith');
    expect(result[1]!.author).toBe('Alice Smith');
    expect(result[2]!.author).toBe('bob');
  });
});
