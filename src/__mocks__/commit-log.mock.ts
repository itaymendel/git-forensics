/**
 * Test factories for creating CommitLog data.
 *
 * @example
 * ```ts
 * import { commit, file, resetCounter } from '../__mocks__/commit-log.mock.js';
 *
 * beforeEach(() => resetCounter());
 *
 * const commits = [
 *   commit({ author: 'alice', files: [file('app.ts', { additions: 100 })] }),
 *   commit({ author: 'bob', files: [file('app.ts', { additions: 20 })] }),
 * ];
 * ```
 */
import type { CommitLog, FileChange, GitLogData } from '../types.js';

let counter = 0;

/** Reset counter in beforeEach for deterministic hashes/dates */
export function resetCounter(): void {
  counter = 0;
}

/** Create a file change with sensible defaults */
export function file(path: string, overrides?: Partial<FileChange>): FileChange {
  return {
    file: path,
    additions: 1,
    deletions: 0,
    ...overrides,
  };
}

/** Create a commit with auto-incrementing hash and date */
export function commit(overrides?: Partial<CommitLog>): CommitLog {
  counter++;
  return {
    hash: counter.toString(16).padStart(7, '0'),
    date: `2024-01-${String(counter).padStart(2, '0')}T10:00:00Z`,
    author: 'dev',
    message: 'commit',
    files: [],
    ...overrides,
  };
}

/** Create multiple commits from the same author touching the same files */
export function commitsBy(author: string, files: FileChange[], count: number): CommitLog[] {
  return Array.from({ length: count }, () => commit({ author, files }));
}

/**
 * Pre-built scenarios for common test patterns.
 * Each scenario is a function to ensure fresh data per test.
 */
export const SCENARIOS = {
  /**
   * 3 commits where api.ts and db.ts always change together.
   * Result: 100% coupling, 3 co-changes
   */
  coupledPair: (): CommitLog[] => [
    commit({ files: [file('api.ts', { additions: 10 }), file('db.ts', { additions: 5 })] }),
    commit({ files: [file('api.ts', { additions: 2 }), file('db.ts', { additions: 3 })] }),
    commit({ files: [file('api.ts', { additions: 1 }), file('db.ts', { additions: 2 })] }),
  ],

  /**
   * 3 authors with unequal contributions: alice 60%, bob 30%, charlie 10%
   * Result: fractal = 0.46, mainDev = alice
   */
  fragmentedOwnership: (): CommitLog[] => [
    commit({ author: 'alice', files: [file('app.ts', { additions: 60 })] }),
    commit({ author: 'bob', files: [file('app.ts', { additions: 30 })] }),
    commit({ author: 'charlie', files: [file('app.ts', { additions: 10 })] }),
  ],

  /**
   * alice and bob both touch shared1.ts and shared2.ts
   * Result: 2 shared entities, used for communication tests
   */
  sharedFiles: (): CommitLog[] => [
    commit({
      author: 'alice',
      files: [file('shared1.ts'), file('shared2.ts'), file('alice-only.ts')],
    }),
    commit({
      author: 'alice',
      files: [file('shared1.ts'), file('shared2.ts'), file('alice-only.ts')],
    }),
    commit({
      author: 'bob',
      files: [file('shared1.ts'), file('shared2.ts')],
    }),
    commit({
      author: 'bob',
      files: [file('shared1.ts'), file('shared2.ts')],
    }),
  ],

  /**
   * File renamed: old.ts → new.ts
   * Result: stats consolidated under 'new.ts'
   */
  simpleRename: (): CommitLog[] => [
    commit({ files: [file('new.ts', { additions: 5 })] }),
    commit({ files: [{ file: 'new.ts', renamedFrom: 'old.ts', additions: 0, deletions: 0 }] }),
  ],

  /**
   * Chain rename: a.ts → b.ts → c.ts
   * Result: stats consolidated under 'c.ts', nameHistory = ['a.ts', 'b.ts']
   */
  renameChain: (): CommitLog[] => [
    commit({ files: [file('c.ts', { additions: 1 })] }),
    commit({ files: [{ file: 'c.ts', renamedFrom: 'b.ts', additions: 0, deletions: 0 }] }),
    commit({ files: [{ file: 'b.ts', renamedFrom: 'a.ts', additions: 0, deletions: 0 }] }),
  ],

  /**
   * alice: many additions, few deletions. bob: few additions, many deletions.
   * Result: mainDev = alice, refactoringDev = bob
   */
  ownershipSplit: (): CommitLog[] => [
    commit({
      author: 'alice',
      files: [file('app.ts', { additions: 100, deletions: 10 })],
    }),
    commit({
      author: 'bob',
      files: [file('app.ts', { additions: 5, deletions: 80 })],
    }),
  ],

  /**
   * Merge commit (parentCount: 2) and regular commit
   * Result: used to test skipMergeCommits option
   */
  withMergeCommit: (): CommitLog[] => [
    commit({ files: [file('app.ts', { additions: 10 })] }),
    commit({
      parentCount: 2,
      message: 'Merge branch',
      files: [file('feature.ts', { additions: 50 })],
    }),
  ],
};

/** Convert CommitLog[] to GitLogData format for data-driven API tests */
export function createGitLogData(commits: CommitLog[], trackedFiles?: string[]): GitLogData {
  const files = trackedFiles ?? commits.flatMap((c) => c.files.map((f) => f.file));

  return {
    log: {
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
    },
    trackedFiles: files.join('\n'),
  };
}
