import type { CommitLog, AuthorContribution, FileChange } from '../types.js';
import { getOrCreate } from '../utils.js';

/** A single commit's contribution to a file */
export interface CommitEntry {
  readonly timestamp: number;
  readonly date: string;
  readonly additions: number;
  readonly deletions: number;
}

/** Aggregated statistics for a single file */
export interface FileStats {
  /** Commit history grouped by author (enables temporal + cross-ref analysis) */
  readonly byAuthor: Readonly<Record<string, readonly CommitEntry[]>>;
  /** Coupling score: sum of co-changed files across all commits (pre-computed during aggregation) */
  readonly couplingScore: number;
  /** Total revision count (pre-computed: sum of commits across all authors) */
  readonly totalRevisions: number;
  /** Most recent commit info (pre-computed: max timestamp across all commits) */
  readonly latestCommit: { readonly date: string; readonly timestamp: number } | null;
  /** Contribution breakdown per author (additions, deletions, revisions) */
  readonly authorContributions: Readonly<Record<string, AuthorContribution>>;
  /** Total additions across all authors (pre-computed during aggregation) */
  readonly totalAdditions: number;
  /** Total deletions across all authors (pre-computed during aggregation) */
  readonly totalDeletions: number;
  /**
   * Historical names for this file, ordered oldest → newest.
   * Excludes current name (that's the map key).
   * Only populated for files that were renamed.
   */
  readonly nameHistory: readonly string[];
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
}

/** Result of single-pass aggregation over commits */
export interface AggregatedStats {
  /** Per-file statistics */
  readonly fileStats: Readonly<Record<string, FileStats>>;
  /** Pair co-change counts: "file1::file2" → count */
  readonly pairCoChanges: Readonly<Record<string, number>>;
}

/** Options for commit aggregation */
export interface AggregateOptions {
  /** Skip commits with more than this many files for coupling score (default: 50) */
  maxFilesPerCommit?: number;
}

interface MutableAuthorContribution {
  additions: number;
  deletions: number;
  revisions: number;
}

interface MutableFileStats {
  byAuthor: Map<string, CommitEntry[]>;
  couplingScore: number;
  totalRevisions: number;
  latestCommit: { date: string; timestamp: number } | null;
  authorContributions: Map<string, MutableAuthorContribution>;
  totalAdditions: number;
  totalDeletions: number;
  nameHistory: string[];
  exists: boolean;
}

function createEmptyFileStats(): MutableFileStats {
  return {
    byAuthor: new Map<string, CommitEntry[]>(),
    couplingScore: 0,
    totalRevisions: 0,
    latestCommit: null,
    authorContributions: new Map<string, MutableAuthorContribution>(),
    totalAdditions: 0,
    totalDeletions: 0,
    nameHistory: [],
    exists: false,
  };
}

function countPairsInCommit(
  files: readonly FileChange[],
  currentName: Map<string, string>,
  pairCoChanges: Map<string, number>
): void {
  const seen = new Set<string>();
  const uniqueFiles: string[] = [];

  for (const f of files) {
    const resolved = currentName.get(f.file) ?? f.file;
    if (!seen.has(resolved)) {
      seen.add(resolved);
      uniqueFiles.push(resolved);
    }
  }

  for (let i = 0; i < uniqueFiles.length; i++) {
    const fileA = uniqueFiles[i] as string;
    for (let j = i + 1; j < uniqueFiles.length; j++) {
      const fileB = uniqueFiles[j] as string;
      const [a, b] = fileA < fileB ? [fileA, fileB] : [fileB, fileA];
      const key = `${a}::${b}`;
      pairCoChanges.set(key, (pairCoChanges.get(key) ?? 0) + 1);
    }
  }
}

function handleRename(
  change: FileChange,
  resolvedName: string,
  currentName: Map<string, string>,
  fileStats: Map<string, MutableFileStats>
): void {
  if (!change.renamedFrom) return;
  currentName.set(change.renamedFrom, resolvedName);
  const stats = getOrCreate(fileStats, resolvedName, createEmptyFileStats);
  stats.nameHistory.unshift(change.renamedFrom);
}

function processFileChange(
  change: FileChange,
  commit: CommitLog,
  commitTimestamp: number,
  isMultiFileCommit: boolean,
  fileCount: number,
  currentName: Map<string, string>,
  fileStats: Map<string, MutableFileStats>
): void {
  const resolvedName = currentName.get(change.file) ?? change.file;

  handleRename(change, resolvedName, currentName, fileStats);

  const stats = getOrCreate(fileStats, resolvedName, createEmptyFileStats);

  // Record author commit
  const authorCommits = getOrCreate(stats.byAuthor, commit.author, () => []);
  authorCommits.push({
    timestamp: commitTimestamp,
    date: commit.date,
    additions: change.additions,
    deletions: change.deletions,
  });

  stats.totalRevisions += 1;

  // Update latest commit
  if (!stats.latestCommit || commitTimestamp > stats.latestCommit.timestamp) {
    stats.latestCommit = { date: commit.date, timestamp: commitTimestamp };
  }

  // Update author contributions and file-level totals
  const contrib = getOrCreate(stats.authorContributions, commit.author, () => ({
    additions: 0,
    deletions: 0,
    revisions: 0,
  }));
  contrib.additions += change.additions;
  contrib.deletions += change.deletions;
  contrib.revisions += 1;

  stats.totalAdditions += change.additions;
  stats.totalDeletions += change.deletions;

  if (isMultiFileCommit) {
    stats.couplingScore += fileCount - 1;
  }
}

/** Single-pass aggregation of commits into statistics for all metrics. */
export function aggregateCommits(
  commits: CommitLog[],
  options: AggregateOptions = {}
): AggregatedStats {
  const { maxFilesPerCommit = 50 } = options;

  const fileStats = new Map<string, MutableFileStats>();
  const pairCoChanges = new Map<string, number>();
  const currentName = new Map<string, string>();

  for (const commit of commits) {
    const commitTimestamp = new Date(commit.date).getTime();
    if (Number.isNaN(commitTimestamp)) continue;

    const files = commit.files;
    const fileCount = files.length;
    const isMultiFileCommit = fileCount >= 2 && fileCount <= maxFilesPerCommit;

    for (const change of files) {
      processFileChange(
        change,
        commit,
        commitTimestamp,
        isMultiFileCommit,
        fileCount,
        currentName,
        fileStats
      );
    }

    if (isMultiFileCommit) {
      countPairsInCommit(files, currentName, pairCoChanges);
    }
  }

  const fileStatsRecord: Record<string, FileStats> = {};
  for (const [file, stats] of fileStats) {
    fileStatsRecord[file] = {
      ...stats,
      byAuthor: Object.fromEntries(stats.byAuthor),
      authorContributions: Object.fromEntries(stats.authorContributions),
    };
  }

  return {
    fileStats: fileStatsRecord,
    pairCoChanges: Object.fromEntries(pairCoChanges),
  };
}
