import type { FileContributors, ContributorBreakdown } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface TopContributorsOptions {
  /** Limit to top N files (default: unlimited) */
  topN?: number;
  /** Max contributors per file (default: unlimited) */
  maxContributorsPerFile?: number;
}

export function computeTopContributors(
  stats: AggregatedStats,
  options: TopContributorsOptions = {}
): FileContributors[] {
  const { topN, maxContributorsPerFile } = options;

  const results: FileContributors[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    if (fileStats.totalRevisions === 0) continue;

    const contributors: ContributorBreakdown[] = [];
    for (const [author, contrib] of Object.entries(fileStats.authorContributions)) {
      contributors.push({
        author,
        percent: Math.round((contrib.revisions / fileStats.totalRevisions) * 10000) / 100,
        revisions: contrib.revisions,
      });
    }

    contributors.sort((a, b) => b.revisions - a.revisions || a.author.localeCompare(b.author));

    const trimmed = maxContributorsPerFile
      ? contributors.slice(0, maxContributorsPerFile)
      : contributors;

    results.push({
      file,
      contributors: trimmed,
      authorCount: contributors.length,
      exists: fileStats.exists,
    });
  }

  results.sort((a, b) => b.authorCount - a.authorCount || a.file.localeCompare(b.file));

  return withTopN(results, topN);
}
