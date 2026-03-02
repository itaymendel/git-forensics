import type { CoupledPair } from '../types.js';
import type { AggregatedStats, FileStats } from '../preprocessing/aggregate.js';
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

  const [sorted1, sorted2] = file1 < file2 ? [file1, file2] : [file2, file1];
  const [sorted1Exists, sorted2Exists] =
    file1 < file2 ? [file1Exists, file2Exists] : [file2Exists, file1Exists];

  return {
    file1: sorted1,
    file2: sorted2,
    couplingPercent,
    coChanges,
    file1Exists: sorted1Exists,
    file2Exists: sorted2Exists,
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

function sortByStrength(pairs: CoupledPair[]): CoupledPair[] {
  return pairs.toSorted((a, b) => {
    const scoreA = a.couplingPercent * Math.log(a.coChanges + 1);
    const scoreB = b.couplingPercent * Math.log(b.coChanges + 1);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.file1.localeCompare(b.file1) || a.file2.localeCompare(b.file2);
  });
}

/** Find files that frequently change together (temporal coupling). */
export function computeCoupledPairs(
  stats: AggregatedStats,
  options: CoupledPairsOptions = {}
): CoupledPair[] {
  const { minCoChanges = 3, minCouplingPercent = 30, topN } = options;
  const fileStats = stats.fileStats;

  const pairs: CoupledPair[] = [];

  for (const [key, coChanges] of Object.entries(stats.pairCoChanges)) {
    if (coChanges < minCoChanges) continue;

    // Inline key parsing: use indexOf+slice instead of split to avoid array allocation
    const sep = key.indexOf('::');
    const file1 = key.slice(0, sep);
    const file2 = key.slice(sep + 2);

    // Compute coupling % inline — skip early before allocating CoupledPair object
    const stats1 = fileStats[file1] as FileStats | undefined;
    const stats2 = fileStats[file2] as FileStats | undefined;
    const appearancesA = stats1?.totalRevisions ?? 0;
    const appearancesB = stats2?.totalRevisions ?? 0;
    const avgAppearances = (appearancesA + appearancesB) / 2;
    const rawPercent = avgAppearances > 0 ? Math.round((coChanges / avgAppearances) * 100) : 0;
    const couplingPercent = Math.min(100, Math.max(0, rawPercent));

    if (couplingPercent < minCouplingPercent) continue;

    // Keys are already sorted (file1 < file2) from aggregation, so no re-sort needed
    pairs.push({
      file1,
      file2,
      couplingPercent,
      coChanges,
      file1Exists: stats1?.exists ?? false,
      file2Exists: stats2?.exists ?? false,
    });
  }

  return withTopN(sortByStrength(pairs), topN);
}
