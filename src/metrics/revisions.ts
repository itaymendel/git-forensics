import type { FileRevisions } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface RevisionsOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
  /** Minimum revisions for a file to be included (default: 1) */
  minRevisions?: number;
  /**
   * Complexity scores per file path.
   * When provided, results include complexity and score fields,
   * and are sorted by score (revisions × complexity) instead of revisions.
   */
  complexity?: Map<string, number>;
}

export function computeRevisions(
  stats: AggregatedStats,
  options: RevisionsOptions = {}
): FileRevisions[] {
  const { topN, minRevisions = 1, complexity } = options;

  const hasComplexity = complexity !== undefined && complexity.size > 0;

  const results: FileRevisions[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    if (fileStats.totalRevisions >= minRevisions) {
      const fileComplexity = complexity?.get(file);
      const score =
        fileComplexity === undefined ? undefined : fileStats.totalRevisions * fileComplexity;

      results.push({
        file,
        revisions: fileStats.totalRevisions,
        exists: fileStats.exists,
        complexity: fileComplexity,
        score,
      });
    }
  }

  const sorted = results.toSorted((a, b) => {
    if (hasComplexity) {
      if (a.score !== undefined && b.score !== undefined) {
        return b.score - a.score || a.file.localeCompare(b.file);
      }
      if (a.score !== undefined) return -1;
      if (b.score !== undefined) return 1;
    }
    return b.revisions - a.revisions || a.file.localeCompare(b.file);
  });

  return withTopN(sorted, topN);
}
