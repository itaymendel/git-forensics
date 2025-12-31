/** A single commit with file-level changes */
export interface CommitLog {
  readonly hash: string;
  readonly date: string;
  readonly author: string;
  readonly message: string;
  readonly files: readonly FileChange[];
  /** Number of parent commits (>1 = merge commit) */
  readonly parentCount?: number;
}

export interface FileChange {
  readonly file: string;
  /** Previous filename if this file was renamed in this commit */
  readonly renamedFrom?: string;
  readonly additions: number;
  readonly deletions: number;
}

export interface FileRevisions {
  readonly file: string;
  readonly revisions: number;
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
  /** Complexity score (if provided via options) */
  readonly complexity?: number;
  /** Weighted score: revisions × complexity (if complexity provided) */
  readonly score?: number;
}

/** Temporally coupled file pair */
export interface CoupledPair {
  readonly fileA: string;
  readonly fileB: string;
  readonly couplingPercent: number;
  readonly coChanges: number;
  /** Whether fileA currently exists in the repository */
  readonly fileAExists: boolean;
  /** Whether fileB currently exists in the repository */
  readonly fileBExists: boolean;
}

/** Sum of Coupling for a file */
export interface FileSoc {
  readonly file: string;
  readonly soc: number;
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
}

/** Code age for a file (time since last modification) */
export interface FileAge {
  readonly file: string;
  /** ISO date of last modification */
  readonly lastModified: string;
  /** Months since last modification */
  readonly ageMonths: number;
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
}

/** Main developer (primary owner) of a file */
export interface FileOwnership {
  readonly file: string;
  /** Primary developer by additions */
  readonly mainDev: string;
  /** Percentage of additions by main dev */
  readonly ownershipPercent: number;
  /** Developer with most deletions (active refactoring) */
  readonly refactoringDev: string;
  /** Percentage of deletions by refactoring dev */
  readonly refactoringOwnership: number;
  /** Fractal fragmentation value: sum((contrib/total)^2), 0=fragmented, 1=single owner */
  readonly fractalValue: number;
  /** Total number of unique authors */
  readonly authorCount: number;
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
}

/** Code churn for a file (lines added/deleted) */
export interface FileChurn {
  readonly file: string;
  readonly added: number;
  readonly deleted: number;
  /** Total churn (added + deleted) */
  readonly churn: number;
  readonly revisions: number;
  /** Whether the file currently exists in the repository */
  readonly exists: boolean;
}

/** Communication need between two authors based on shared code */
export interface CommunicationPair {
  readonly author1: string;
  readonly author2: string;
  /** Number of files both authors have touched */
  readonly sharedEntities: number;
  /** Communication strength percentage */
  readonly strength: number;
}

/** Author contribution breakdown per file */
export interface AuthorContribution {
  readonly additions: number;
  readonly deletions: number;
  readonly revisions: number;
}

/** Metadata about the forensics analysis */
export interface ForensicsMetadata {
  /** Maximum commits that were requested for analysis */
  readonly maxCommitsRequested: number;
  /** Maximum results per metric */
  readonly topN: number;
  /** Total unique files found in analyzed commits */
  readonly totalFilesAnalyzed: number;
  /** Total unique authors found in analyzed commits */
  readonly totalAuthors: number;
  /** Analysis timestamp (ISO 8601) */
  readonly analyzedAt: string;
}

/** Complete forensics result */
export interface Forensics {
  readonly analyzedCommits: number;
  readonly dateRange: {
    readonly from: string;
    readonly to: string;
  };
  /** Metadata about the analysis configuration and scope */
  readonly metadata: ForensicsMetadata;
  /** Files sorted by revision count (most changed first) */
  readonly hotspots: readonly FileRevisions[];
  readonly coupledPairs: readonly CoupledPair[];
  readonly socRankings: readonly FileSoc[];
  /** Files sorted by age (oldest first) - stale code detection */
  readonly codeAge: readonly FileAge[];
  /** Files with ownership info - who owns what */
  readonly ownership: readonly FileOwnership[];
  /** Files sorted by churn (most volatile first) */
  readonly churn: readonly FileChurn[];
  /** Author pairs needing communication based on shared code (Conway's Law) */
  readonly communication: readonly CommunicationPair[];
  /**
   * Raw aggregated statistics for building custom metrics.
   * Contains full temporal history: every commit, by every author, for every file.
   */
  readonly stats: import('./preprocessing/aggregate.js').AggregatedStats;
}

/** File diff info from git log --stat */
export interface GitDiffFile {
  readonly file: string;
  /** True for binary files (will be filtered out) */
  readonly binary?: boolean;
  /** Lines added */
  readonly insertions?: number;
  /** Lines deleted */
  readonly deletions?: number;
}

/** A single commit from git log */
export interface GitCommit {
  /** Commit hash, may include parent hashes space-separated (e.g., "abc123 def456") */
  readonly hash: string;
  /** ISO date string */
  readonly date: string;
  /** Author name */
  readonly author_name: string;
  /** Commit message */
  readonly message: string;
  /** File diff stats (present when --stat is used) */
  readonly diff?: {
    readonly files?: readonly GitDiffFile[];
  };
}

/** Git log output structure */
export interface GitLog {
  readonly all: readonly GitCommit[];
}

/** Input data for computeForensicsFromData() */
export interface GitLogData {
  /** Output matching git.log() with --stat --parents -M */
  readonly log: GitLog;
  /** Output of git.raw(['ls-files']) - newline-separated file list */
  readonly trackedFiles: string;
}

/** Options for forensics computation */
export interface ForensicsOptions {
  /** Max commits to analyze (default: 1000) */
  maxCommits?: number;
  /** Only analyze commits after this date */
  since?: string;
  /** Max results per metric (default: 50) */
  topN?: number;
  /** Glob patterns to exclude from analysis */
  exclude?: string[];
  /** Maps author names/emails to canonical name */
  authorMap?: Record<string, string>;
  /** Minimum revisions for a file to be included in results (default: 1) */
  minRevisions?: number;
  /** Whether to skip merge commits (default: true) */
  skipMergeCommits?: boolean;
  /** Whether to follow file renames (default: true) */
  followRenames?: boolean;
  /**
   * Calculate complexity for hotspot scoring (default: true).
   * When enabled, hotspots will include complexity and score fields,
   * and will be sorted by score (revisions × complexity) instead of revisions.
   * Set to false to disable complexity calculation.
   */
  complexity?: boolean;
}

/**
 * Options for computeForensicsFromData().
 * Excludes maxCommits and since (user controls these when fetching data).
 */
export interface ForensicsFromDataOptions {
  /** Max results per metric (default: 50) */
  topN?: number;
  /** Glob patterns to exclude from analysis */
  exclude?: string[];
  /** Maps author names/emails to canonical name */
  authorMap?: Record<string, string>;
  /** Minimum revisions for a file to be included in results (default: 1) */
  minRevisions?: number;
  /** Whether to skip merge commits (default: true) */
  skipMergeCommits?: boolean;
  /** Whether to follow file renames (default: true) */
  followRenames?: boolean;
  /**
   * Pre-calculated complexity scores per file path.
   * When provided, hotspots will include complexity and score fields,
   * and will be sorted by score (revisions × complexity) instead of revisions.
   */
  complexity?: Record<string, number>;
}
