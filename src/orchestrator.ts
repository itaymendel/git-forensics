import { readFile } from 'node:fs/promises';
import type { SimpleGit } from 'simple-git';
import { analyzeComplexity } from 'indent-complexity';
import type { Forensics, ForensicsOptions, CommitLog } from './types.js';
import { getCommitLog, computeCommitMetadata } from './commit-log.js';
import {
  filterCommitFiles,
  normalizeAuthors,
  aggregateCommits,
  enrichWithExistence,
} from './preprocessing/index.js';
import type { AggregatedStats } from './preprocessing/aggregate.js';
import {
  computeRevisions,
  computeCoupledPairs,
  computeSoc,
  computeCodeAge,
  computeOwnership,
  computeChurn,
  computeCommunication,
} from './metrics/index.js';
import { withTopN } from './utils.js';

export function filterMergeCommits(commits: CommitLog[]): CommitLog[] {
  return commits.filter((c) => (c.parentCount ?? 1) <= 1);
}

export interface CoreForensicsOptions {
  topN?: number;
  minRevisions?: number;
  complexity?: Map<string, number>;
}

/** Core forensics computation from pre-processed commits and stats. */
export function computeForensicsCore(
  commits: CommitLog[],
  stats: AggregatedStats,
  options: CoreForensicsOptions & { maxCommitsRequested: number }
): Forensics {
  const { topN = 50, minRevisions = 1, complexity, maxCommitsRequested } = options;

  if (commits.length === 0) {
    return {
      analyzedCommits: 0,
      dateRange: { from: '', to: '' },
      metadata: {
        maxCommitsRequested,
        topN,
        totalFilesAnalyzed: 0,
        totalAuthors: 0,
        analyzedAt: new Date().toISOString(),
      },
      hotspots: [],
      coupledPairs: [],
      socRankings: [],
      codeAge: [],
      ownership: [],
      churn: [],
      communication: [],
      stats: { fileStats: new Map(), pairCoChanges: new Map() },
    };
  }

  const revisions = computeRevisions(stats, { minRevisions, complexity });
  const hotspots = withTopN(revisions, topN);
  const coupledPairs = computeCoupledPairs(stats, { topN });
  const socRankings = withTopN(computeSoc(stats), topN);
  const codeAge = withTopN(computeCodeAge(stats), topN);
  const ownership = withTopN(computeOwnership(stats), topN);
  const churn = withTopN(computeChurn(stats), topN);
  const communication = withTopN(computeCommunication(stats), topN);

  const { dateRange, totalFilesAnalyzed, totalAuthors } = computeCommitMetadata(commits);

  return {
    analyzedCommits: commits.length,
    dateRange,
    metadata: {
      maxCommitsRequested,
      topN,
      totalFilesAnalyzed,
      totalAuthors,
      analyzedAt: new Date().toISOString(),
    },
    hotspots,
    coupledPairs,
    socRankings,
    codeAge,
    ownership,
    churn,
    communication,
    stats,
  };
}

function validateOptions(options: ForensicsOptions): void {
  const { maxCommits, topN, minRevisions } = options;

  if (maxCommits !== undefined && maxCommits <= 0) {
    throw new Error(`maxCommits must be positive, got ${maxCommits}`);
  }
  if (topN !== undefined && topN <= 0) {
    throw new Error(`topN must be positive, got ${topN}`);
  }
  if (minRevisions !== undefined && minRevisions < 0) {
    throw new Error(`minRevisions must be non-negative, got ${minRevisions}`);
  }
}

/** Compute all forensics metrics from git history. */
export async function computeForensics(
  git: SimpleGit,
  options: ForensicsOptions = {}
): Promise<Forensics> {
  validateOptions(options);

  const {
    maxCommits = 1000,
    since,
    topN = 50,
    exclude,
    authorMap,
    minRevisions = 1,
    skipMergeCommits = true,
    followRenames = true,
    complexity = true,
  } = options;

  let commits = await getCommitLog(git, {
    maxCommits,
    since,
    detectRenames: followRenames,
  });

  if (skipMergeCommits) {
    commits = filterMergeCommits(commits);
  }

  commits = filterCommitFiles(commits, { exclude });
  commits = normalizeAuthors(commits, { authorMap });

  if (commits.length === 0) {
    return {
      analyzedCommits: 0,
      dateRange: { from: '', to: '' },
      metadata: {
        maxCommitsRequested: maxCommits,
        topN,
        totalFilesAnalyzed: 0,
        totalAuthors: 0,
        analyzedAt: new Date().toISOString(),
      },
      hotspots: [],
      coupledPairs: [],
      socRankings: [],
      codeAge: [],
      ownership: [],
      churn: [],
      communication: [],
      stats: { fileStats: new Map(), pairCoChanges: new Map() },
    };
  }

  const rawStats = aggregateCommits(commits, { maxFilesPerCommit: 50 });
  const stats = await enrichWithExistence(git, rawStats);

  // Calculate complexity for all files when enabled
  let complexityMap: Map<string, number> | undefined;
  if (complexity) {
    complexityMap = new Map();
    const filesToAnalyze = [...stats.fileStats.entries()].filter(([, s]) => s.exists);
    const results = await Promise.all(
      filesToAnalyze.map(async ([file]) => {
        try {
          const content = await readFile(file, 'utf-8');
          const result = analyzeComplexity(content);
          return [file, result.score] as const;
        } catch {
          return null;
        }
      })
    );
    for (const entry of results) {
      if (entry) complexityMap.set(entry[0], entry[1]);
    }
  }

  return computeForensicsCore(commits, stats, {
    topN,
    minRevisions,
    complexity: complexityMap,
    maxCommitsRequested: maxCommits,
  });
}
