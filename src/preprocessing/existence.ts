import type { SimpleGit } from 'simple-git';
import type { AggregatedStats, FileStats } from './aggregate.js';

/**
 * Enrich aggregated stats with file existence information.
 *
 * Queries git for currently tracked files and marks each file in stats
 * with `exists: true` or `exists: false`.
 *
 * @param git - SimpleGit instance for repository operations
 * @param stats - The aggregated stats from commit analysis
 * @returns New AggregatedStats with existence information populated
 */
export async function enrichWithExistence(
  git: SimpleGit,
  stats: AggregatedStats
): Promise<AggregatedStats> {
  const output = await git.raw(['ls-files']);
  const existingFiles = new Set(output.trim().split('\n').filter(Boolean));

  const enrichedFileStats = new Map<string, FileStats>();

  for (const [file, fileStats] of stats.fileStats) {
    enrichedFileStats.set(file, {
      ...fileStats,
      exists: existingFiles.has(file),
    });
  }

  return {
    fileStats: enrichedFileStats,
    pairCoChanges: stats.pairCoChanges,
  };
}
