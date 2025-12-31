import type { FileSoc } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface SocOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

/** SOC (Sum of Coupling) - how often a file changes alongside other files. */
export function computeSoc(stats: AggregatedStats, options: SocOptions = {}): FileSoc[] {
  const { topN } = options;

  const results: FileSoc[] = [];

  for (const [file, fileStats] of stats.fileStats) {
    if (fileStats.socScore > 0) {
      results.push({ file, soc: fileStats.socScore, exists: fileStats.exists });
    }
  }

  const sorted = results.toSorted((a, b) => b.soc - a.soc || a.file.localeCompare(b.file));

  return withTopN(sorted, topN);
}
