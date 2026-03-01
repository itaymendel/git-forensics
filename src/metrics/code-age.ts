import type { FileAge } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

export interface CodeAgeOptions {
  /** Date to calculate age from (default: now) */
  referenceDate?: Date;
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

export function computeCodeAge(stats: AggregatedStats, options: CodeAgeOptions = {}): FileAge[] {
  const { referenceDate = new Date(), topN } = options;
  const refTime = referenceDate.getTime();

  const results: FileAge[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    const lastMod = fileStats.latestCommit;
    if (!lastMod) continue;

    const ageMs = refTime - lastMod.timestamp;
    const ageMonths = Math.max(0, Math.floor(ageMs / MS_PER_MONTH));

    results.push({
      file,
      lastModified: lastMod.date,
      ageMonths,
      exists: fileStats.exists,
    });
  }

  const sorted = results.toSorted(
    (a, b) => b.ageMonths - a.ageMonths || a.file.localeCompare(b.file)
  );

  return withTopN(sorted, topN);
}
