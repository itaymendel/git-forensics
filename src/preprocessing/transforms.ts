import picomatch from 'picomatch';
import type { CommitLog } from '../types.js';

export interface FilterOptions {
  /** Glob patterns to exclude from analysis */
  exclude?: string[];
}

export interface AuthorOptions {
  /** Maps author names/emails to canonical name */
  authorMap?: Record<string, string>;
}

export function filterCommitFiles(commits: CommitLog[], options: FilterOptions = {}): CommitLog[] {
  const { exclude = [] } = options;

  if (exclude.length === 0) {
    return commits;
  }

  const isExcluded = createExcludeMatcher(exclude);

  return commits
    .map((commit) => ({
      ...commit,
      files: commit.files.filter((f) => !isExcluded(f.file)),
    }))
    .filter((commit) => commit.files.length > 0);
}

export function normalizeAuthors(commits: CommitLog[], options: AuthorOptions = {}): CommitLog[] {
  const { authorMap } = options;

  if (!authorMap || Object.keys(authorMap).length === 0) {
    return commits;
  }

  return commits.map((commit) => ({
    ...commit,
    author: authorMap[commit.author] ?? commit.author,
  }));
}

function createExcludeMatcher(patterns: string[]): (file: string) => boolean {
  if (patterns.length === 0) {
    return () => false;
  }

  const matchers = patterns.map((pattern) => {
    try {
      return picomatch(pattern, { dot: true });
    } catch (error) {
      throw new Error(
        `Invalid exclude pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  });

  return (file: string) => matchers.some((match) => match(file));
}
