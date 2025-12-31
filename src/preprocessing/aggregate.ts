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
  readonly byAuthor: ReadonlyMap<string, readonly CommitEntry[]>;
  /** SOC score (depends on commit context, pre-computed during aggregation) */
  readonly socScore: number;
  /** Total revision count (pre-computed: sum of commits across all authors) */
  readonly totalRevisions: number;
  /** Most recent commit info (pre-computed: max timestamp across all commits) */
  readonly latestCommit: { readonly date: string; readonly timestamp: number } | null;
  /** Contribution breakdown per author (additions, deletions, revisions) */
  readonly authorContributions: ReadonlyMap<string, AuthorContribution>;
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
  readonly fileStats: ReadonlyMap<string, FileStats>;
  /** Pair co-change counts: "fileA::fileB" → count */
  readonly pairCoChanges: ReadonlyMap<string, number>;
}

/** Options for commit aggregation */
export interface AggregateOptions {
  /** Skip commits with more than this many files for SOC/coupling (default: 50) */
  maxFilesPerCommit?: number;
}

interface MutableAuthorContribution {
  additions: number;
  deletions: number;
  revisions: number;
}

interface MutableFileStats {
  byAuthor: Map<string, CommitEntry[]>;
  socScore: number;
  totalRevisions: number;
  latestCommit: { date: string; timestamp: number } | null;
  authorContributions: Map<string, MutableAuthorContribution>;
  nameHistory: string[];
  exists: boolean;
}

function createEmptyFileStats(): MutableFileStats {
  return {
    byAuthor: new Map<string, CommitEntry[]>(),
    socScore: 0,
    totalRevisions: 0,
    latestCommit: null,
    authorContributions: new Map<string, MutableAuthorContribution>(),
    nameHistory: [],
    exists: true,
  };
}

function countPairsInCommit(
  resolvedFiles: readonly string[],
  pairCoChanges: Map<string, number>
): void {
  const uniqueFiles = [...new Set(resolvedFiles)].toSorted();

  for (let i = 0; i < uniqueFiles.length; i++) {
    for (let j = i + 1; j < uniqueFiles.length; j++) {
      const key = `${uniqueFiles[i]}::${uniqueFiles[j]}`;
      pairCoChanges.set(key, (pairCoChanges.get(key) ?? 0) + 1);
    }
  }
}

/** Track file rename in the name resolution map and history. */
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

/** Update author's commit history for this file. */
function addAuthorCommit(
  stats: MutableFileStats,
  author: string,
  commitTimestamp: number,
  date: string,
  change: FileChange
): void {
  const authorCommits = getOrCreate(stats.byAuthor, author, () => []);
  authorCommits.push({
    timestamp: commitTimestamp,
    date,
    additions: change.additions,
    deletions: change.deletions,
  });
}

/** Update latest commit if this one is newer. */
function updateLatestCommit(stats: MutableFileStats, date: string, timestamp: number): void {
  const isNewer = !stats.latestCommit || timestamp > stats.latestCommit.timestamp;
  if (isNewer) {
    stats.latestCommit = { date, timestamp };
  }
}

/** Update author contribution totals. */
function updateAuthorContributions(
  stats: MutableFileStats,
  author: string,
  change: FileChange
): void {
  const contrib = getOrCreate(stats.authorContributions, author, () => ({
    additions: 0,
    deletions: 0,
    revisions: 0,
  }));
  contrib.additions += change.additions;
  contrib.deletions += change.deletions;
  contrib.revisions += 1;
}

/** Process a single file change within a commit. */
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
  addAuthorCommit(stats, commit.author, commitTimestamp, commit.date, change);
  stats.totalRevisions += 1;
  updateLatestCommit(stats, commit.date, commitTimestamp);
  updateAuthorContributions(stats, commit.author, change);

  if (isMultiFileCommit) {
    stats.socScore += fileCount - 1;
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
      const resolvedFiles = files.map((f) => currentName.get(f.file) ?? f.file);
      countPairsInCommit(resolvedFiles, pairCoChanges);
    }
  }

  return { fileStats: fileStats as Map<string, FileStats>, pairCoChanges };
}
