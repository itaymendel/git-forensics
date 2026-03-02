import type { CommunicationPair } from '../types.js';
import type { AggregatedStats } from '../preprocessing/aggregate.js';
import { getOrCreate, withTopN } from '../utils.js';

export interface CommunicationOptions {
  /** Minimum shared files to include pair (default: 2) */
  minSharedEntities?: number;
  /** Limit results to top N (default: unlimited) */
  topN?: number;
}

interface AuthorMaps {
  authorToFiles: Map<string, Set<string>>;
  authorTotals: Map<string, number>;
}

function buildAuthorMaps(stats: AggregatedStats): AuthorMaps {
  const authorToFiles = new Map<string, Set<string>>();
  const authorTotals = new Map<string, number>();

  for (const [file, fileStats] of Object.entries(stats.fileStats)) {
    for (const [author, contrib] of Object.entries(fileStats.authorContributions)) {
      getOrCreate(authorToFiles, author, () => new Set()).add(file);
      authorTotals.set(author, (authorTotals.get(author) ?? 0) + contrib.revisions);
    }
  }

  return { authorToFiles, authorTotals };
}

function countSharedFiles(files1: Set<string>, files2: Set<string>): number {
  let count = 0;
  for (const file of files1) {
    if (files2.has(file)) count++;
  }
  return count;
}

function computeStrength(sharedEntities: number, revisions1: number, revisions2: number): number {
  const avgRevisions = (revisions1 + revisions2) / 2;
  return avgRevisions > 0 ? Math.round((sharedEntities / avgRevisions) * 100) : 0;
}

function createPairIfSignificant(
  author1: string,
  author2: string,
  maps: AuthorMaps,
  minSharedEntities: number
): CommunicationPair | null {
  const files1 = maps.authorToFiles.get(author1);
  const files2 = maps.authorToFiles.get(author2);
  if (!files1 || !files2) return null;

  const sharedEntities = countSharedFiles(files1, files2);
  if (sharedEntities < minSharedEntities) return null;

  const strength = computeStrength(
    sharedEntities,
    maps.authorTotals.get(author1) ?? 0,
    maps.authorTotals.get(author2) ?? 0
  );

  return { author1, author2, sharedEntities, strength };
}

/** Communication needs between developers based on shared code (Conway's Law). */
export function computeCommunication(
  stats: AggregatedStats,
  options: CommunicationOptions = {}
): CommunicationPair[] {
  const { minSharedEntities = 2, topN } = options;
  const maps = buildAuthorMaps(stats);
  const authors = [...maps.authorToFiles.keys()].toSorted();
  const pairs: CommunicationPair[] = [];

  for (let i = 0; i < authors.length; i++) {
    const author1 = authors[i] as string;
    for (let j = i + 1; j < authors.length; j++) {
      const author2 = authors[j] as string;
      const pair = createPairIfSignificant(author1, author2, maps, minSharedEntities);
      if (pair) pairs.push(pair);
    }
  }

  const sorted = pairs.toSorted(
    (a, b) =>
      b.sharedEntities - a.sharedEntities ||
      b.strength - a.strength ||
      a.author1.localeCompare(b.author1)
  );

  return withTopN(sorted, topN);
}
