import type { FileOwnership, AuthorContribution } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { withTopN } from '../utils.js';

export interface OwnershipOptions {
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

function computeFractal(contributions: Readonly<Record<string, AuthorContribution>>): number {
  const values = Object.values(contributions);
  let totalAdditions = 0;
  for (const contrib of values) {
    totalAdditions += contrib.additions;
  }

  if (totalAdditions === 0) return 1; // No additions = treat as single owner

  let fractal = 0;
  for (const contrib of values) {
    const ratio = contrib.additions / totalAdditions;
    fractal += ratio * ratio;
  }

  return Math.round(fractal * 100) / 100;
}

function findMainDevByAdditions(contributions: Readonly<Record<string, AuthorContribution>>): {
  mainDev: string;
  maxAdditions: number;
  totalAdditions: number;
} {
  let mainDev = '';
  let maxAdditions = 0;
  let totalAdditions = 0;

  for (const [author, contrib] of Object.entries(contributions)) {
    totalAdditions += contrib.additions;
    if (contrib.additions > maxAdditions) {
      maxAdditions = contrib.additions;
      mainDev = author;
    }
  }

  return { mainDev, maxAdditions, totalAdditions };
}

function findRefactoringDev(contributions: Readonly<Record<string, AuthorContribution>>): {
  refactoringDev: string;
  maxDeletions: number;
  totalDeletions: number;
} {
  let refactoringDev = '';
  let maxDeletions = 0;
  let totalDeletions = 0;

  for (const [author, contrib] of Object.entries(contributions)) {
    totalDeletions += contrib.deletions;
    if (contrib.deletions > maxDeletions) {
      maxDeletions = contrib.deletions;
      refactoringDev = author;
    }
  }

  return { refactoringDev, maxDeletions, totalDeletions };
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

    const { mainDev, maxAdditions, totalAdditions } = findMainDevByAdditions(contributions);
    const { refactoringDev, maxDeletions, totalDeletions } = findRefactoringDev(contributions);

    const ownershipPercent =
      totalAdditions > 0 ? Math.round((maxAdditions / totalAdditions) * 100) : 0;

    const refactoringOwnership =
      totalDeletions > 0 ? Math.round((maxDeletions / totalDeletions) * 100) : 0;

    results.push({
      file,
      mainDev,
      ownershipPercent,
      refactoringDev,
      refactoringOwnership,
      fractalValue: computeFractal(contributions),
      authorCount: Object.keys(contributions).length,
      exists: fileStats.exists,
    });
  }

  const sorted = results.toSorted(
    (a, b) => a.fractalValue - b.fractalValue || a.file.localeCompare(b.file)
  );

  return withTopN(sorted, topN);
}
