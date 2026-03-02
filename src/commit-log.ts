import type { SimpleGit, DiffResultTextFile } from 'simple-git';
import type { CommitLog, FileChange, GitLog } from './types.js';

/** Computed metadata from a set of commits */
export interface CommitMetadata {
  /** Date range of analyzed commits */
  dateRange: { from: string; to: string };
  /** Total unique files found in analyzed commits */
  totalFilesAnalyzed: number;
  /** Total unique authors found in analyzed commits */
  totalAuthors: number;
}

export function computeCommitMetadata(commits: CommitLog[]): CommitMetadata {
  if (commits.length === 0) {
    return {
      dateRange: { from: '', to: '' },
      totalFilesAnalyzed: 0,
      totalAuthors: 0,
    };
  }

  const allFiles = new Set<string>();
  const allAuthors = new Set<string>();

  let minDate = '';
  let minTs = Infinity;
  let maxDate = '';
  let maxTs = -Infinity;

  for (const commit of commits) {
    allAuthors.add(commit.author);
    for (const file of commit.files) {
      allFiles.add(file.file);
    }

    const ts = new Date(commit.date).getTime();
    if (ts < minTs) {
      minTs = ts;
      minDate = commit.date;
    }
    if (ts > maxTs) {
      maxTs = ts;
      maxDate = commit.date;
    }
  }

  return {
    dateRange: {
      from: minDate,
      to: maxDate,
    },
    totalFilesAnalyzed: allFiles.size,
    totalAuthors: allAuthors.size,
  };
}

export interface GetCommitLogOptions {
  /** Max commits to analyze (default: 1000) */
  maxCommits?: number;
  /** Only analyze commits after this date (ISO format) */
  since?: string;
  /** Whether to detect renames (default: true) */
  detectRenames?: boolean;
}

export interface TransformGitLogOptions {
  /** Whether to detect renames (default: true) */
  detectRenames?: boolean;
}

/**
 * Transform raw git log data to CommitLog format.
 * Use this with computeForensicsFromData() when you have pre-fetched git data.
 */
export function transformGitLog(log: GitLog, options: TransformGitLogOptions = {}): CommitLog[] {
  const { detectRenames = true } = options;

  return log.all.map((commit) => {
    const { hash, parentCount } = parseHashAndParents(commit.hash);
    return {
      hash,
      date: commit.date,
      author: commit.author_name,
      message: commit.message,
      files: parseFiles(commit.diff?.files, detectRenames),
      parentCount,
    };
  });
}

/** Fetch commit history with file-level stats. */
export async function getCommitLog(
  git: SimpleGit,
  options: GetCommitLogOptions = {}
): Promise<CommitLog[]> {
  const { maxCommits = 1000, since, detectRenames = true } = options;

  const logOptions: Record<string, unknown> = {
    maxCount: maxCommits,
    '--stat': null,
    '--parents': null,
  };

  if (since) {
    logOptions['--since'] = since;
  }

  if (detectRenames) {
    logOptions['-M'] = null;
  }

  const log = await git.log(logOptions);

  // SAFETY: simple-git's LogResult type doesn't reflect --stat/--parents fields,
  // but the runtime shape matches our GitLog interface because we control logOptions above.
  return transformGitLog(log as unknown as GitLog, { detectRenames });
}

function parseHashAndParents(hashWithParents: string): { hash: string; parentCount: number } {
  const parts = hashWithParents.trim().split(/\s+/);
  return {
    hash: parts[0] ?? hashWithParents,
    parentCount: Math.max(parts.length - 1, 1),
  };
}

function parseFiles(
  files:
    | readonly { file: string; binary?: boolean; insertions?: number; deletions?: number }[]
    | undefined,
  detectRenames: boolean = true
): FileChange[] {
  if (!files) return [];

  return files
    .filter((f): f is DiffResultTextFile => !('binary' in f && f.binary === true))
    .map((f) => {
      const rename = detectRenames ? parseRename(f.file) : null;

      return {
        file: rename ? rename[1] : f.file,
        renamedFrom: rename ? rename[0] : undefined,
        additions: f.insertions ?? 0,
        deletions: f.deletions ?? 0,
      };
    });
}

/** Parse git rename format: returns [oldName, newName] or null. */
export function parseRename(fileStr: string): [string, string] | null {
  if (!fileStr.includes('=>')) return null;

  const braceMatch = fileStr.match(/^(.*?)\{([^}]+) => ([^}]+)\}(.*)$/);
  if (braceMatch) {
    const [, prefix = '', oldPart, newPart, suffix = ''] = braceMatch;
    return [`${prefix}${oldPart}${suffix}`, `${prefix}${newPart}${suffix}`];
  }

  const simpleMatch = fileStr.match(/^(.+) => (.+)$/);
  if (simpleMatch?.[1] && simpleMatch[2]) {
    return [simpleMatch[1], simpleMatch[2]];
  }

  return null;
}

/** Get files changed between two git refs (e.g., 'origin/main' and 'HEAD'). */
export async function getChangedFiles(
  git: SimpleGit,
  baseRef: string,
  headRef: string = 'HEAD'
): Promise<string[]> {
  const diff = await git.diff(['--name-only', `${baseRef}...${headRef}`]);

  return diff
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
