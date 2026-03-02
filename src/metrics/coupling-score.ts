import type { FileCoupling } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface CouplingScoreOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

/** Sum of Coupling - how often a file changes alongside other files. */
export function computeCouplingScore(
  stats: AggregatedStats,
  options: CouplingScoreOptions = {}
): FileCoupling[] {
  const { topN } = options;

  const results: FileCoupling[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    if (fileStats.couplingScore > 0) {
      results.push({ file, couplingScore: fileStats.couplingScore, exists: fileStats.exists });
    }
  }

  const sorted = results.toSorted(
    (a, b) => b.couplingScore - a.couplingScore || a.file.localeCompare(b.file)
  );

  return withTopN(sorted, topN);
}
