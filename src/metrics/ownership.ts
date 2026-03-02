import type { FileOwnership, AuthorContribution } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface OwnershipOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

/**
 * Single-pass computation of fractal value, main dev, and refactoring dev.
 * Replaces three separate Object.entries() iterations with one.
 */
function computeOwnershipStats(
  contributions: Readonly<Record<string, AuthorContribution>>,
  totalAdditions: number,
  totalDeletions: number
): {
  fractalValue: number;
  mainDev: string;
  ownershipPercent: number;
  refactoringDev: string;
  refactoringOwnership: number;
  authorCount: number;
} {
  let fractal = 0;
  let mainDev = '';
  let maxAdditions = 0;
  let refactoringDev = '';
  let maxDeletions = 0;
  let authorCount = 0;

  for (const [author, contrib] of Object.entries(contributions)) {
    authorCount++;

    // Fractal calculation
    if (totalAdditions > 0) {
      const ratio = contrib.additions / totalAdditions;
      fractal += ratio * ratio;
    }

    // Main dev (most additions)
    if (contrib.additions > maxAdditions) {
      maxAdditions = contrib.additions;
      mainDev = author;
    }

    // Refactoring dev (most deletions)
    if (contrib.deletions > maxDeletions) {
      maxDeletions = contrib.deletions;
      refactoringDev = author;
    }
  }

  const fractalValue = totalAdditions === 0 ? 1 : Math.round(fractal * 100) / 100;
  const ownershipPercent =
    totalAdditions > 0 ? Math.round((maxAdditions / totalAdditions) * 100) : 0;
  const refactoringOwnership =
    totalDeletions > 0 ? Math.round((maxDeletions / totalDeletions) * 100) : 0;

  return {
    fractalValue,
    mainDev,
    ownershipPercent,
    refactoringDev,
    refactoringOwnership,
    authorCount,
  };
}

export function computeOwnership(
  stats: AggregatedStats,
  options: OwnershipOptions = {}
): FileOwnership[] {
  const { topN } = options;

  const results: FileOwnership[] = [];

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    const contributions = fileStats.authorContributions;
    if (Object.keys(contributions).length === 0) continue;

    const ownership = computeOwnershipStats(
      contributions,
      fileStats.totalAdditions,
      fileStats.totalDeletions
    );

    results.push({
      file,
      mainDev: ownership.mainDev,
      ownershipPercent: ownership.ownershipPercent,
      refactoringDev: ownership.refactoringDev,
      refactoringOwnership: ownership.refactoringOwnership,
      fractalValue: ownership.fractalValue,
      authorCount: ownership.authorCount,
      exists: fileStats.exists,
    });
  }

  const sorted = results.toSorted(
    (a, b) => a.fractalValue - b.fractalValue || a.file.localeCompare(b.file)
  );

  return withTopN(sorted, topN);
}
