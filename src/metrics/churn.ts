import type { FileChurn } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface ChurnOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

export function computeChurn(stats: AggregatedStats, options: ChurnOptions = {}): FileChurn[] {
  const { topN } = options;

  const results: FileChurn[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    let added = 0;
    let deleted = 0;

    for (const contrib of Object.values(fileStats.authorContributions)) {
      added += contrib.additions;
      deleted += contrib.deletions;
    }

    results.push({
      file,
      added,
      deleted,
      churn: added + deleted,
      revisions: fileStats.totalRevisions,
      exists: fileStats.exists,
    });
  }

  const sorted = results.toSorted((a, b) => b.churn - a.churn || a.file.localeCompare(b.file));

  return withTopN(sorted, topN);
}
