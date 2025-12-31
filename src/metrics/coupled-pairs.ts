import type { CoupledPair } from '../types.js';
import type { AggregatedStats, CommitEntry, FileStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export function createCoupledPair(
  file1: string,
  file2: string,
  couplingPercent: number,
  coChanges: number,
  file1Exists: boolean,
  file2Exists: boolean
): CoupledPair {
  if (file1 === file2) {
    throw new Error(`A file cannot be coupled with itself: ${file1}`);
  }
  if (coChanges < 0) {
    throw new Error(`coChanges must be non-negative, got ${coChanges}`);
  }
  if (couplingPercent < 0 || couplingPercent > 100) {
    throw new Error(`couplingPercent must be 0-100, got ${couplingPercent}`);
  }

  const [fileA, fileB] = file1 < file2 ? [file1, file2] : [file2, file1];
  const [fileAExists, fileBExists] =
    file1 < file2 ? [file1Exists, file2Exists] : [file2Exists, file1Exists];

  return {
    fileA,
    fileB,
    couplingPercent,
    coChanges,
    fileAExists,
    fileBExists,
  };
}

export interface CoupledPairsOptions {
  /** Minimum co-changes to be considered coupled (default: 3) */
  minCoChanges?: number;
  /** Minimum coupling percentage to include (default: 30) */
  minCouplingPercent?: number;
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

function countRevisions(byAuthor: ReadonlyMap<string, readonly CommitEntry[]>): number {
  let count = 0;
  for (const commits of byAuthor.values()) {
    count += commits.length;
  }
  return count;
}

function parsePairKey(
  key: string,
  coChanges: number,
  fileStats: ReadonlyMap<string, FileStats>
): CoupledPair {
  const [file1, file2] = key.split('::');
  if (!file1 || !file2) {
    throw new Error(`Internal error: malformed pair key "${key}"`);
  }

  const stats1 = fileStats.get(file1);
  const stats2 = fileStats.get(file2);

  const appearancesA = stats1 ? countRevisions(stats1.byAuthor) : 0;
  const appearancesB = stats2 ? countRevisions(stats2.byAuthor) : 0;
  const avgAppearances = (appearancesA + appearancesB) / 2;

  const rawPercent = avgAppearances > 0 ? Math.round((coChanges / avgAppearances) * 100) : 0;
  const couplingPercent = Math.min(100, Math.max(0, rawPercent));

  const file1Exists = stats1?.exists ?? false;
  const file2Exists = stats2?.exists ?? false;

  return createCoupledPair(file1, file2, couplingPercent, coChanges, file1Exists, file2Exists);
}

function sortByStrength(pairs: CoupledPair[]): CoupledPair[] {
  return pairs.toSorted((a, b) => {
    const scoreA = a.couplingPercent * Math.log(a.coChanges + 1);
    const scoreB = b.couplingPercent * Math.log(b.coChanges + 1);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.fileA.localeCompare(b.fileA) || a.fileB.localeCompare(b.fileB);
  });
}

/** Find files that frequently change together (temporal coupling). */
export function computeCoupledPairs(
  stats: AggregatedStats,
  options: CoupledPairsOptions = {}
): CoupledPair[] {
  const { minCoChanges = 3, minCouplingPercent = 30, topN } = options;

  const pairs: CoupledPair[] = [];

  for (const [key, coChanges] of stats.pairCoChanges) {
    if (coChanges < minCoChanges) continue;

    const pair = parsePairKey(key, coChanges, stats.fileStats);
    if (pair.couplingPercent >= minCouplingPercent) {
      pairs.push(pair);
    }
  }

  return withTopN(sortByStrength(pairs), topN);
}
