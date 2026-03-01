import type { SimpleGit } from 'simple-git';
import type { AggregatedStats, FileStats } from './aggregate.js';

/**
 * Core enrichment: marks each file in stats as existing or not
 * based on the provided set of tracked files.
 */
export function enrichWithExistenceFromSet(
  stats: AggregatedStats,
  existingFiles: Set<string>
): AggregatedStats {
  const enrichedFileStats: Record<string, FileStats> = {};

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    enrichedFileStats[file] = {
      ...fileStats,
      exists: existingFiles.has(file),
    };
  }

  return {
    fileStats: enrichedFileStats,
    pairCoChanges: stats.pairCoChanges,
  };
}

/**
 * Enrich aggregated stats with file existence information.
 *
 * Queries git for currently tracked files and marks each file in stats
 * with `exists: true` or `exists: false`.
 */
export async function enrichWithExistence(
  git: SimpleGit,
  stats: AggregatedStats
): Promise<AggregatedStats> {
  const output = await git.raw(['ls-files']);
  const existingFiles = new Set(output.trim().split('\n').filter(Boolean));
  return enrichWithExistenceFromSet(stats, existingFiles);
}
