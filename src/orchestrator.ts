import { readFile } from 'node:fs/promises';
import type { SimpleGit } from 'simple-git';
import { analyzeComplexity } from 'indent-complexity';
import type { Forensics, ForensicsOptions, CommitLog, TruncationInfo } from './types.js';
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
  computeCouplingScore,
  computeCodeAge,
  computeOwnership,
  computeChurn,
  computeCommunication,
  computeTopContributors,
} from './metrics/index.js';
import { withTopN } from './utils.js';

function truncationInfo(fullLength: number, topN?: number): TruncationInfo {
  const sliced = topN && topN > 0 ? Math.min(fullLength, topN) : fullLength;
  return { truncated: sliced < fullLength, totalBeforeTopN: fullLength };
}

export function filterMergeCommits(commits: CommitLog[]): CommitLog[] {
  return commits.filter((c) => (c.parentCount ?? 1) <= 1);
}

export interface CoreForensicsOptions {
  topN?: number;
  minRevisions?: number;
  complexity?: Map<string, number>;
  minCoChanges?: number;
  minCouplingPercent?: number;
  minSharedEntities?: number;
}

function createEmptyForensics(metadata: { maxCommitsAnalyzed: number; topN: number }): Forensics {
  return {
    analyzedCommits: 0,
    dateRange: { from: '', to: '' },
    metadata: {
      maxCommitsAnalyzed: metadata.maxCommitsAnalyzed,
      topN: metadata.topN,
      totalFilesAnalyzed: 0,
      totalAuthors: 0,
      analyzedAt: new Date().toISOString(),
    },
    hotspots: [],
    coupledPairs: [],
    couplingRankings: [],
    codeAge: [],
    ownership: [],
    churn: [],
    communication: [],
    topContributors: [],
    stats: { fileStats: {}, pairCoChanges: {} },
  };
}

export function computeForensicsCore(
  commits: CommitLog[],
  stats: AggregatedStats,
  options: CoreForensicsOptions & { maxCommitsAnalyzed: number }
): Forensics {
  const {
    topN = 50,
    minRevisions = 1,
    complexity,
    maxCommitsAnalyzed,
    minCoChanges,
    minCouplingPercent,
    minSharedEntities,
  } = options;

  if (commits.length === 0) {
    return createEmptyForensics({ maxCommitsAnalyzed, topN });
  }

  const revisions = computeRevisions(stats, { minRevisions, complexity });
  const allCouplingRankings = computeCouplingScore(stats);
  const allCodeAge = computeCodeAge(stats);
  const allOwnership = computeOwnership(stats);
  const allChurn = computeChurn(stats);
  const allCommunication = computeCommunication(stats, { minSharedEntities });
  const allTopContributors = computeTopContributors(stats);

  const hotspots = withTopN(revisions, topN);
  const coupledPairs = computeCoupledPairs(stats, { topN, minCoChanges, minCouplingPercent });
  const couplingRankings = withTopN(allCouplingRankings, topN);
  const codeAge = withTopN(allCodeAge, topN);
  const ownership = withTopN(allOwnership, topN);
  const churn = withTopN(allChurn, topN);
  const communication = withTopN(allCommunication, topN);
  const topContributors = withTopN(allTopContributors, topN);

  const { dateRange, totalFilesAnalyzed, totalAuthors } = computeCommitMetadata(commits);

  const truncation = {
    hotspots: truncationInfo(revisions.length, topN),
    couplingRankings: truncationInfo(allCouplingRankings.length, topN),
    codeAge: truncationInfo(allCodeAge.length, topN),
    ownership: truncationInfo(allOwnership.length, topN),
    churn: truncationInfo(allChurn.length, topN),
    communication: truncationInfo(allCommunication.length, topN),
    topContributors: truncationInfo(allTopContributors.length, topN),
  };

  return {
    analyzedCommits: commits.length,
    dateRange,
    metadata: {
      maxCommitsAnalyzed,
      topN,
      totalFilesAnalyzed,
      totalAuthors,
      analyzedAt: new Date().toISOString(),
      truncation,
    },
    hotspots,
    coupledPairs,
    couplingRankings,
    codeAge,
    ownership,
    churn,
    communication,
    topContributors,
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
    complexity = false,
    maxFilesPerCommit = 50,
    minCoChanges,
    minCouplingPercent,
    minSharedEntities,
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
    return createEmptyForensics({ maxCommitsAnalyzed: maxCommits, topN });
  }

  const rawStats = aggregateCommits(commits, { maxFilesPerCommit });
  const stats = await enrichWithExistence(git, rawStats);

  // Calculate complexity for all files when enabled
  let complexityMap: Map<string, number> | undefined;
  if (complexity) {
    complexityMap = new Map();
    const filesToAnalyze = Object.entries(stats.fileStats).filter(([, s]) => s.exists);
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
    maxCommitsAnalyzed: maxCommits,
    minCoChanges,
    minCouplingPercent,
    minSharedEntities,
  });
}
